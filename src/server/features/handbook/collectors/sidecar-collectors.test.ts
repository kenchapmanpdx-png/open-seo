import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import { createSidecarCollectors } from "./sidecar-collectors";

const ORIGIN = "https://example.com";
const [render] = createSidecarCollectors({ url: "http://sidecar", token: "t" });

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
        ? "<html><body><p>one two three four</p></body></html>"
        : "<html><body><p>one</p></body></html>";
      return Response.json(rendered(html));
    });
    const result = await render.collect(ctx, collected);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.pages[0]).toMatchObject({
      url: `${ORIGIN}/`,
      js: { renderedKey: `rendered:${ORIGIN}/`, words: 4, opacityZeroWords: 3 },
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
