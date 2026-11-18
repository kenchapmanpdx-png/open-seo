import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import { createSidecarCollectors } from "./sidecar-collectors";

const ORIGIN = "https://example.com";
const [render, axe, lighthouse] = createSidecarCollectors({
  url: "http://sidecar",
  token: "t",
});

const unused = () => Promise.reject(new Error("site fetch not used"));
const ctx: CollectorContext = {
  runId: "r1",
  origin: ORIGIN,
  fetch: unused,
  fetchOffsite: unused,
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

const collected: Partial<CollectedData> = {
  templates: {
    status: "ok",
    templates: [
      {
        key: "/:x",
        urlPattern: "/",
        skeletonHash: "x",
        urls: [`${ORIGIN}/`],
        samples: [{ url: `${ORIGIN}/`, rank: 1, reason: "first" }],
      },
    ],
  },
};

const rendered0 = {
  finalUrl: `${ORIGIN}/`,
  status: 200,
  html: "<html><body><p>one</p></body></html>",
  screenshotPng: null,
  consoleErrors: [],
  requests: [],
  opacityZeroWords: 0,
  firstScreenActions: [],
  timingMs: 10,
};

const rendered = (html: string) => ({
  finalUrl: `${ORIGIN}/`,
  status: 200,
  html,
  screenshotPng: null,
  consoleErrors: [],
  requests: [{ url: `${ORIGIN}/app.js`, resourceType: "script", status: 200 }],
  opacityZeroWords: 3,
  firstScreenActions: [],
  timingMs: 10,
});

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("sidecar render collector", () => {
  it("maps two sidecar renders into RenderData", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const js =
        typeof init?.body === "string" &&
        init.body.includes('"javascript":true');
      const html = js
        ? "<html><body><p>one two three four</p><form></form></body></html>"
        : "<html><body><p>one</p></body></html>";
      return Response.json(rendered(html));
    });
    const result = await render.collect(ctx, collected);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.pages[0]).toMatchObject({
      url: `${ORIGIN}/`,
      js: {
        renderedKey: `rendered:${ORIGIN}/`,
        words: 4,
        opacityZeroWords: 3,
        forms: 1,
      },
      noJs: { nojsKey: `nojs:${ORIGIN}/`, words: 1 },
      firstScreenKey: null,
    });
  });

  it("is unavailable with the sidecar's reason on a 500", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ error: "boom" }, { status: 500 }),
    );
    const result = await render.collect(ctx, collected);
    expect(result).toMatchObject({ status: "unavailable" });
    if (result.status === "unavailable") expect(result.reason).toContain("500");
  });
});

describe("sidecar axe + lighthouse collectors (contracts 1.3.0 fields)", () => {
  it("derives axe node texts and Lighthouse render-blocking items", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      typeof init?.body === "string" && init.body.includes("scrollToEnd")
        ? Response.json({
            url: `${ORIGIN}/`,
            axeVersion: "4",
            violations: [
              {
                id: "color-contrast",
                impact: "serious",
                help: "h",
                helpUrl: "https://x",
                nodes: [
                  { target: ["a"], html: '<a href="/">Read <b>more</b></a>' },
                ],
              },
            ],
          })
        : Response.json({
            url: `${ORIGIN}/`,
            lighthouseVersion: "12",
            environment: "e",
            categories: {
              performance: 0.5,
              accessibility: null,
              bestPractices: null,
              seo: null,
            },
            metrics: { lcpMs: 1, cls: 0, tbtMs: 0, fcpMs: 1 },
            lcpElement: null,
            report: {
              audits: {
                "render-blocking-resources": {
                  details: {
                    items: [{ url: `${ORIGIN}/a.css`, wastedMs: 312.6 }],
                  },
                },
              },
            },
          }),
    );
    const axeResult = await axe.collect(ctx, collected);
    const lhResult = await lighthouse.collect(ctx, collected);
    expect(axeResult).toMatchObject({
      pages: [{ violations: [{ sampleTexts: ["Read more"] }] }],
    });
    expect(lhResult).toMatchObject({
      pages: [{ renderBlocking: [{ url: `${ORIGIN}/a.css`, wastedMs: 313 }] }],
    });
  });
});

const renderBody = z.object({
  url: z.string(),
  javascript: z.boolean(),
  blockBeacons: z.boolean(),
});

describe("render depth", () => {
  const paths = Array.from({ length: 20 }, (_, i) => `/p${i}`);
  const site: Partial<CollectedData> = {
    pages: {
      status: "ok",
      snapshots: [
        ...paths.map((p) => snapshot(p)),
        snapshot("/gone", { status: 404 }),
      ],
    },
    templates: {
      status: "ok",
      templates: paths.map((p) => ({
        key: p,
        urlPattern: p,
        skeletonHash: p,
        urls: [`${ORIGIN}${p}`],
        samples: [{ url: `${ORIGIN}${p}`, rank: 1, reason: "first" }],
      })),
    },
  };
  /** URLs sent for a JS-on render; every call asks for beacons blocked. */
  const jsRendered = () =>
    fetchMock.mock.calls.flatMap(([, init]) => {
      const body = renderBody.parse(JSON.parse(z.string().parse(init?.body)));
      expect(body.blockBeacons).toBe(true);
      return body.javascript ? [body.url] : [];
    });

  beforeEach(() => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        ...rendered0,
        requests: [
          { url: "a", resourceType: "script", status: 200, transferBytes: 10 },
          { url: "b", resourceType: "ping", status: null, transferBytes: null },
          { url: "c", resourceType: "image", status: 200, transferBytes: 5 },
        ],
      }),
    );
  });

  it("full renders every 200 HTML page and sums transfer bytes", async () => {
    const [fullRender] = createSidecarCollectors({
      url: "http://sidecar",
      token: "t",
      depth: "full",
    });
    const result = await fullRender.collect(ctx, site);
    if (result.status !== "ok") throw new Error(result.reason);
    expect(result.pages).toHaveLength(20);
    expect(result.pages[0].js.pageWeightBytes).toBe(15);
    expect(new Set(jsRendered())).toEqual(
      new Set(paths.map((p) => `${ORIGIN}${p}`)),
    );
  });

  it("quick keeps at most 16 template samples", async () => {
    const result = await render.collect(ctx, site);
    if (result.status !== "ok") throw new Error(result.reason);
    expect(result.pages).toHaveLength(16);
  });
});
