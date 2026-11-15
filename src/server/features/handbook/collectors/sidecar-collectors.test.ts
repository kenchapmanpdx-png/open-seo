import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
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
