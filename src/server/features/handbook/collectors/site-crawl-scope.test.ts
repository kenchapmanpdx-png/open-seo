import { describe, expect, it } from "vitest";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import { crawlSecondPass, createCrawlCollectors } from "./site-crawl";

// WO-B27-004: the page limit goes to in-scope sitemap URLs first, parameter
// variants of known pages are sampled and not counted, and every unread
// sitemap URL is reported (red case: antiquecandleco.com audit 5cdbb86c).
const ORIGIN = "https://shop.test";
const fetched: string[] = [];
const linksOf = new Map<string, string[]>();
const ctx: CollectorContext = {
  runId: "r1",
  origin: ORIGIN,
  fetch: async (url) => {
    fetched.push(url);
    const links = (linksOf.get(url) ?? [])
      .map((href) => `<a href="${href}">x</a>`)
      .join("");
    return {
      url,
      finalUrl: url,
      status: 200,
      headers: [["content-type", "text/html"]],
      body: `<html><head><title>T</title></head><body>${links}</body></html>`,
      truncated: false,
      redirectChain: [],
      timingMs: 1,
    };
  },
  fetchOffsite: () => Promise.reject(new Error("unused")),
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

const sitemapOf = (paths: string[]): CollectedData["sitemap"] => ({
  status: "ok",
  sources: [],
  urls: paths.map((p) => ({ loc: ORIGIN + p, lastmod: null, source: "f" })),
});
const range = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("crawl scope (WO-B27-004)", () => {
  it("reads every in-scope sitemap URL under the limit, even past 100 per template", async () => {
    fetched.length = 0;
    const paths = [...range("/pages/p", 220), ...range("/products/x", 160)];
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 500,
    });
    const out = await pages.collect(ctx, { sitemap: sitemapOf(paths) });
    if (out.status !== "ok") throw new Error("expected pages");
    expect(out.snapshots.length).toBe(381);
    expect(out.coverage?.scope?.sitemapUnread).toEqual([]);
  });

  it("spends the limit round-robin across sections and lists what was not read", async () => {
    fetched.length = 0;
    const paths = [...range("/pages/p", 8), ...range("/products/x", 2)];
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 5,
    });
    const out = await pages.collect(ctx, { sitemap: sitemapOf(paths) });
    if (out.status !== "ok") throw new Error("expected pages");
    expect(fetched).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/pages/p0`,
      `${ORIGIN}/products/x0`,
      `${ORIGIN}/pages/p1`,
      `${ORIGIN}/products/x1`,
    ]);
    expect(out.coverage).toMatchObject({
      capped: true,
      scope: {
        limit: 5,
        sitemapInScope: 10,
        sitemapUnread: [
          { section: "/pages/", urls: range(`${ORIGIN}/pages/p`, 8).slice(2) },
        ],
      },
    });
  });

  it("samples one parameter variant per pattern and does not count it", async () => {
    fetched.length = 0;
    linksOf.set(`${ORIGIN}/products/x0`, [
      "/products/x0?pr_rec_id=1&pr_seq=a",
      "/products/x1?pr_rec_id=2&pr_seq=b",
    ]);
    const { pages } = createCrawlCollectors({ followLinks: true, maxPages: 3 });
    const out = await pages.collect(ctx, {
      sitemap: sitemapOf(["/products/x0", "/products/x1"]),
    });
    linksOf.clear();
    if (out.status !== "ok") throw new Error("expected pages");
    expect(fetched).toContain(`${ORIGIN}/products/x1`);
    expect(fetched.filter((u) => u.includes("pr_rec_id"))).toHaveLength(1);
    expect(out.coverage?.scope?.variants).toEqual({ sampled: 1, skipped: 1 });
    expect(out.coverage?.capped).toBe(false);
  });

  it("render pass: a variant of a read page is skipped once its pattern was sampled", async () => {
    fetched.length = 0;
    const { pages } = createCrawlCollectors({
      followLinks: false,
      maxPages: 10,
    });
    const first = await pages.collect(ctx, {
      sitemap: sitemapOf(["/products/x0", "/products/x1"]),
    });
    if (first.status !== "ok") throw new Error("expected pages");
    fetched.length = 0;
    await crawlSecondPass(
      ctx,
      { pages: first },
      [
        `${ORIGIN}/products/x0?pr_rec_id=1`,
        `${ORIGIN}/products/x1?pr_rec_id=2`,
        `${ORIGIN}/js-only`,
      ],
      10,
    );
    expect(fetched).toEqual([
      `${ORIGIN}/products/x0?pr_rec_id=1`,
      `${ORIGIN}/js-only`,
    ]);
  });
});
