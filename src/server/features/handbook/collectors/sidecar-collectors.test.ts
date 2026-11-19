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

  it("backs off on a 429 render and keeps the page once it renders", async () => {
    vi.useFakeTimers();
    let calls = 0;
    fetchMock.mockImplementation(async () =>
      Response.json({ ...rendered0, status: ++calls <= 2 ? 429 : 200 }),
    );
    const pending = render.collect(ctx, collected);
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();
    expect(result.status === "ok" && result.pages.length).toBe(1);
  });

  it("skips a page that stays throttled", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () =>
      Response.json({ ...rendered0, status: 429 }),
    );
    const pending = render.collect(ctx, collected);
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();
    expect(result).toEqual({
      status: "unavailable",
      reason: "render HTTP 429 (no-JS 429)",
    });
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

const lhResponse = (url: string, lcpMs: number) =>
  Response.json({
    url,
    lighthouseVersion: "12",
    environment: "e",
    categories: {
      performance: 0.5,
      accessibility: null,
      bestPractices: null,
      seo: null,
    },
    metrics: { lcpMs, cls: 0, tbtMs: 0, fcpMs: 1 },
    lcpElement: null,
    report: {},
  });

describe("full Lighthouse targets", () => {
  const lhBody = z.object({
    url: z.string(),
    formFactor: z.enum(["mobile", "desktop"]),
  });
  const [, , fullLighthouse] = createSidecarCollectors({
    url: "http://sidecar",
    token: "t",
    depth: "full",
  });
  const href = (p: string) => `${ORIGIN}${p}`;
  const ids = Array.from({ length: 20 }, (_, i) => `/t${i}`);
  /** 20 templates × /a (rank 1), /b, /c; `weights` in MB by path, 1 MB otherwise. */
  const site = (weights: Record<string, number>): Partial<CollectedData> => ({
    templates: {
      status: "ok",
      templates: ids.map((t) => ({
        key: t,
        urlPattern: `${t}/*`,
        skeletonHash: t,
        urls: ["a", "b", "c"].map((x) => href(`${t}/${x}`)),
        samples: [{ url: href(`${t}/a`), rank: 1, reason: "first" }],
      })),
    },
    render: {
      status: "ok",
      pages: ids.flatMap((t) =>
        ["a", "b", "c"].map((x) => ({
          url: href(`${t}/${x}`),
          js: {
            finalUrl: href(`${t}/${x}`),
            status: 200,
            renderedKey: "k",
            words: 100,
            requests: [],
            pageWeightBytes: (weights[`${t}/${x}`] ?? 1) * 1_000_000,
            opacityZeroWords: 0,
            firstScreenActions: [],
          },
          noJs: { status: 200, nojsKey: "n", words: 100 },
          firstScreenKey: null,
          consoleErrors: [],
        })),
      ),
    },
  });
  const runsSent = () =>
    fetchMock.mock.calls.map(([, init]) =>
      lhBody.parse(JSON.parse(z.string().parse(init?.body))),
    );
  it("runs rank-1 of 15 templates + 3 heaviest on mobile and home on desktop, deduped", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      lhResponse(
        lhBody.parse(JSON.parse(z.string().parse(init?.body))).url,
        1000,
      ),
    );
    // Heaviest: /t0/a (already rank-1), /t1/b, /t2/c.
    const result = await fullLighthouse.collect(
      ctx,
      site({ "/t0/a": 4, "/t1/b": 3, "/t2/c": 2 }),
    );
    if (result.status !== "ok") throw new Error(result.reason);
    const sent = runsSent();
    expect(sent.filter((r) => r.formFactor === "desktop")).toEqual([
      { url: `${ORIGIN}/`, formFactor: "desktop" },
    ]);
    expect(
      sent.filter((r) => r.formFactor === "mobile").map((r) => r.url),
    ).toEqual([
      ...ids.slice(0, 15).map((t) => href(`${t}/a`)),
      href("/t1/b"),
      href("/t2/c"),
    ]);
    expect(result.pages).toHaveLength(18);
  });

  it("caps LCP escalations at +10 and page-weight escalations at +5", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      lhResponse(
        lhBody.parse(JSON.parse(z.string().parse(init?.body))).url,
        5000,
      ),
    );
    // 7 pages over 5 MB; the 3 heaviest are in the base set.
    const heavy = ["/t19/b", "/t19/c", "/t18/b", "/t18/c", "/t17/b"];
    const result = await fullLighthouse.collect(
      ctx,
      site({
        ...Object.fromEntries(heavy.map((p, i) => [p, 12 - i])),
        "/t17/c": 6.5,
        "/t16/b": 6,
      }),
    );
    if (result.status !== "ok") throw new Error(result.reason);
    const mobile = runsSent()
      .filter((r) => r.formFactor === "mobile")
      .map((r) => r.url);
    const extra = mobile.slice(18);
    // LCP > 4 s everywhere: 2 more pages for the first 5 templates (cap 10).
    expect(extra.slice(0, 10)).toEqual(
      ids.slice(0, 5).flatMap((t) => [href(`${t}/b`), href(`${t}/c`)]),
    );
    // > 5 MB: the 5 heaviest (cap 5), 3 already measured in the base set.
    expect(extra.slice(10)).toEqual([href("/t18/c"), href("/t17/b")]);
    expect(new Set(mobile).size).toBe(mobile.length);
  });

  it("all: each batch measures the next 25 live pages and re-emits the earlier ones", async () => {
    const [, , allLighthouse] = createSidecarCollectors({
      url: "http://sidecar",
      token: "t",
      depth: "full",
      lighthouse: "all",
    });
    fetchMock.mockImplementation(async (_url, init) =>
      lhResponse(
        lhBody.parse(JSON.parse(z.string().parse(init?.body))).url,
        1000,
      ),
    );
    const pages: Partial<CollectedData> = {
      pages: {
        status: "ok",
        snapshots: Array.from({ length: 60 }, (_, i) => snapshot(`/p${i}`)),
      },
    };
    const perBatch: number[] = [];
    let prior: Partial<CollectedData> = pages;
    for (let batch = 0; batch < 3; batch++) {
      fetchMock.mockClear();
      const result = await allLighthouse.collect(ctx, prior);
      perBatch.push(runsSent().filter((r) => r.formFactor === "mobile").length);
      prior = { ...pages, lighthouse: result };
    }
    expect(perBatch).toEqual([25, 25, 10]);
    const last = prior.lighthouse;
    if (last?.status !== "ok") throw new Error("no lighthouse");
    expect(last.pages.filter((p) => p.formFactor === "mobile")).toHaveLength(
      60,
    );
    expect(last.pages.filter((p) => p.formFactor === "desktop")).toHaveLength(
      1,
    );
  });
});
