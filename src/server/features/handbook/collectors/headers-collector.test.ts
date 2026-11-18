import { describe, expect, it } from "vitest";
import type {
  CollectorContext,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import { headersCollector } from "./headers-collector";
import { createCrawlCollectors } from "./site-crawl";

const ORIGIN = "https://example.com";
const fetched: string[] = [];
const ctx: CollectorContext = {
  runId: "r1",
  origin: ORIGIN,
  fetch: async (url) => {
    fetched.push(url);
    return {
      url,
      finalUrl: url,
      status: 200,
      headers: [
        ["content-type", "text/html"],
        ["set-cookie", "sid=1"],
        ["content-security-policy", "x".repeat(3000)],
      ],
      body: "<html><body><p>hi</p></body></html>",
      truncated: false,
      redirectChain: [],
      timingMs: 1,
    };
  },
  fetchOffsite: () => Promise.reject(new Error("unused")),
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

const home: PageSnapshot = {
  ...snapshot("/"),
  headers: [["strict-transport-security", "max-age=63072000"]],
  images: [
    {
      src: `${ORIGIN}/hero.jpg`,
      dataSrc: null,
      srcset: null,
      alt: null,
      width: null,
      height: null,
      loading: null,
      fetchpriority: null,
    },
  ],
  markup: {
    ...snapshot("/").markup,
    scripts: [
      {
        src: `${ORIGIN}/app.js`,
        type: null,
        async: false,
        defer: false,
        inHead: true,
      },
    ],
    headLinks: [
      { rel: "stylesheet", href: `${ORIGIN}/site.css`, as: null, type: null },
      { rel: "preload", href: `${ORIGIN}/f.woff2`, as: "font", type: null },
    ],
  },
};

describe("headers collector", () => {
  it("reads HTML headers from snapshots and probes one asset per type, a 404 and plain HTTP", async () => {
    fetched.length = 0;
    const pages = [
      home,
      ...Array.from({ length: 49 }, (_, i) => ({
        ...snapshot(`/p${i}`),
        headers: [["content-type", "text/html"]] as const,
      })),
    ];
    const result = await headersCollector.collect(ctx, {
      pages: { status: "ok", snapshots: pages },
    });
    expect(fetched).toHaveLength(6);
    expect(fetched.slice(0, 4)).toEqual([
      `${ORIGIN}/site.css`,
      `${ORIGIN}/app.js`,
      `${ORIGIN}/hero.jpg`,
      `${ORIGIN}/f.woff2`,
    ]);
    expect(result.status === "ok" && result.responses).toHaveLength(56);
  });
});

describe("crawl snapshot headers", () => {
  it("drops set-cookie and cuts values to 2 kB", async () => {
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 1,
    });
    const result = await pages.collect(ctx, {});
    const headers =
      result.status === "ok" ? (result.snapshots[0]?.headers ?? []) : [];
    expect(headers.map(([k]) => k)).toEqual([
      "content-type",
      "content-security-policy",
    ]);
    expect(headers[1]?.[1]).toHaveLength(2048);
  });
});
