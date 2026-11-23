import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import {
  crawlSecondPass,
  createCrawlCollectors,
  renderOnlyLinks,
} from "./site-crawl";

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
      headers: [["content-type", "text/html"]],
      body: "<html><head><title>T</title></head><body><p>hi</p></body></html>",
      truncated: false,
      redirectChain: [],
      timingMs: 1,
    };
  },
  fetchOffsite: () => Promise.reject(new Error("unused")),
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

const collected: Partial<CollectedData> = {
  pages: { status: "ok", snapshots: [snapshot("/", { links: ["/about"] })] },
  robots: {
    status: "ok",
    hosts: [
      {
        host: "example.com",
        status: 200,
        storageKey: null,
        groups: [
          {
            userAgents: ["*"],
            rules: [{ type: "disallow", path: "/private" }],
          },
        ],
        sitemaps: [],
        parseWarnings: [],
      },
    ],
    decisions: [],
  },
};

describe("render-discovered crawl pass", () => {
  it("keeps same-host links missing from the raw HTML", () => {
    const links = renderOnlyLinks(
      `${ORIGIN}/`,
      [
        { href: `${ORIGIN}/about` },
        { href: `${ORIGIN}/js-only` },
        { href: "https://other.com/x" },
      ],
      [{ href: `${ORIGIN}/about` }],
    );
    expect(links).toEqual([`${ORIGIN}/js-only`]);
  });

  it("fetches each new render-only link once, skipping crawled and robots-disallowed URLs", async () => {
    fetched.length = 0;
    const pass = await crawlSecondPass(
      ctx,
      collected,
      [
        `${ORIGIN}/js-only`,
        `${ORIGIN}/js-only#top`,
        `${ORIGIN}/`,
        `${ORIGIN}/private/page`,
      ],
      100,
    );
    expect(fetched).toEqual([`${ORIGIN}/js-only`]);
    expect(pass.snapshots.map((s) => [s.url, s.discoveredBy])).toEqual([
      [`${ORIGIN}/js-only`, "render"],
    ]);
    expect(pass.coverage.read).toBe(2);
  });
});

describe("crawl time budget", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops reading at the budget and reports capped coverage", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-22T00:00:00Z") });
    const slow: CollectorContext = {
      ...ctx,
      // Each page takes 6 simulated minutes; the budget is 15.
      fetch: async (url, init) => {
        vi.setSystemTime(Date.now() + 6 * 60_000);
        return ctx.fetch(url, init);
      },
    };
    const sitemap: CollectedData["sitemap"] = {
      status: "ok",
      sources: [],
      urls: ["/a", "/b", "/c", "/d", "/e"].map((p) => ({
        loc: ORIGIN + p,
        lastmod: null,
        source: "fixture",
      })),
    };
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 100,
      maxMinutes: 15,
    });
    const out = await pages.collect(slow, { sitemap });
    if (out.status !== "ok") throw new Error("expected pages");
    expect(out.snapshots).toHaveLength(3);
    expect(out.coverage).toMatchObject({ read: 3, capped: true });
  });
});
