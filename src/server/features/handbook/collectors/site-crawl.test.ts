import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import { sleep } from "@/server/features/handbook/engine/transient-retry";
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
      // Each page takes 6 simulated minutes; fetches run 4 at a time
      // (WO-B20-005), so overlapping fetches end together. Budget 10 min.
      fetch: async (url, init) => {
        const end = Date.now() + 6 * 60_000;
        const res = await ctx.fetch(url, init);
        vi.setSystemTime(Math.max(Date.now(), end));
        return res;
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
      maxMinutes: 10,
    });
    const out = await pages.collect(slow, { sitemap });
    if (out.status !== "ok") throw new Error("expected pages");
    // Six pages at 6 min each cannot all fit in 10 min, even 4 at a time.
    const read = out.snapshots.length;
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(6);
    expect(out.coverage).toMatchObject({ read, capped: true });
  });

  it("never reads a section the user left out", async () => {
    fetched.length = 0;
    const sitemap: CollectedData["sitemap"] = {
      status: "ok",
      sources: [],
      urls: ["/services", "/blog/post-1"].map((p) => ({
        loc: ORIGIN + p,
        lastmod: null,
        source: "fixture",
      })),
    };
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 100,
      excludePaths: ["/blog/"],
    });
    await pages.collect(ctx, { sitemap });
    expect(fetched).toEqual([`${ORIGIN}/`, `${ORIGIN}/services`]);
  });

  // Field test 6 (samanthaco.ca): /blogs/x 301 → /blog/%20x, linked nowhere
  // else. The page was stored only under /blogs/x (finalUrl ≠ url), which
  // every page-fact check skips, so its duplicate title went unreported.
  it("keeps a redirect target first reached by the redirect as its own page", async () => {
    const redirecting: CollectorContext = {
      ...ctx,
      fetch: async (url, init) => {
        const res = await ctx.fetch(url, init);
        return url.endsWith("/old")
          ? {
              ...res,
              finalUrl: `${ORIGIN}/new`,
              redirectChain: [{ url, status: 301 }],
            }
          : res;
      },
    };
    const sitemap: CollectedData["sitemap"] = {
      status: "ok",
      sources: [],
      urls: [{ loc: `${ORIGIN}/old`, lastmod: null, source: "fixture" }],
    };
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 100,
    });
    const out = await pages.collect(redirecting, { sitemap });
    if (out.status !== "ok") throw new Error("expected pages");
    const old = out.snapshots.find((s) => s.url === `${ORIGIN}/old`);
    const page = out.snapshots.find((s) => s.url === `${ORIGIN}/new`);
    expect(old).toMatchObject({ finalUrl: `${ORIGIN}/new`, rawKey: null });
    expect(page).toMatchObject({
      finalUrl: `${ORIGIN}/new`,
      redirectChain: [],
    });
    expect(page?.rawKey).not.toBeNull();
  });

  // Run 97 (salonvata.com): reading 4 pages at a time drew 429s (6 → 28 of
  // 79 pages); each was kept as a 429 page, unread.
  it("reads a page the site answered 429 on a retry, one page at a time from then on", async () => {
    vi.useFakeTimers();
    let inFlight = 0;
    let most = 0;
    const throttledOnce = new Set<string>();
    const throttling: CollectorContext = {
      ...ctx,
      fetch: async (url, init) => {
        inFlight += 1;
        most = throttledOnce.size > 0 ? Math.max(most, inFlight) : most;
        const res = await ctx.fetch(url, init);
        await sleep(100);
        inFlight -= 1;
        if (url.endsWith("/a") && !throttledOnce.has(url)) {
          throttledOnce.add(url);
          return { ...res, status: 429, headers: [["retry-after", "2"]] };
        }
        return res;
      },
    };
    const sitemap: CollectedData["sitemap"] = {
      status: "ok",
      sources: [],
      urls: ["/a", "/b", "/c", "/d", "/e", "/f", "/g"].map((p) => ({
        loc: ORIGIN + p,
        lastmod: null,
        source: "fixture",
      })),
    };
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 100,
    });
    const done = pages.collect(throttling, { sitemap });
    await vi.runAllTimersAsync();
    const out = await done;
    if (out.status !== "ok") throw new Error("expected pages");
    expect(out.snapshots.find((p) => p.url === `${ORIGIN}/a`)?.status).toBe(
      200,
    );
    expect(most).toBe(1);
  });
});
