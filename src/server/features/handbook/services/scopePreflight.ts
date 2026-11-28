import { isIdentityPage } from "@/server/features/handbook/engine/exclude";
import { sort } from "remeda";
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import {
  robotsCollector,
  sitemapCollector,
} from "@/server/features/handbook/collectors/fetch-collectors";
import { robotsAllowed } from "@/server/features/handbook/collectors/crawl-robots";
import { sectionOf } from "@/server/features/handbook/engine/depth";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";

/**
 * WO-B27-003: Check a site decides the scope before the run, in the app
 * (was `fork/scripts/field-test.ts --preflight`). The census reads
 * robots.txt and the sitemaps with the run's own collectors and fetcher, so
 * the count the page shows is the count the run reads.
 */
export type SitemapCensus = {
  /** Distinct robots-allowed sitemap URLs; 0 = no sitemap. */
  total: number;
  /** Counts by first path section, largest first. */
  sections: { section: string; count: number }[];
  /** Share of sitemap URLs with a query string, 0–1. */
  paramShare: number;
};

type ScopeDecision = {
  limit: number;
  census: SitemapCensus;
  /** Sections to leave out (upstream exclude-path syntax, `/blog/`). */
  excludePaths: string[];
  leftOut: { section: string; count: number }[];
  inScope: number;
};

export async function sitemapCensus(host: string): Promise<SitemapCensus> {
  const ctx: CollectorContext = {
    runId: "scope-preflight",
    origin: `https://${host}`,
    fetch: createSafeFetch({
      allowedHosts: siblingHosts(host),
      shortNameRetry: true,
    }),
    fetchOffsite: () => Promise.reject(new Error("not used by the preflight")),
    // Nothing is stored before a run exists.
    storeBody: async () => "",
    log: () => {},
  };
  const collected: Partial<CollectedData> = {};
  collected.robots = await robotsCollector.collect(ctx, collected);
  collected.sitemap = await sitemapCollector.collect(ctx, collected);
  const urls = new Set<string>();
  if (collected.sitemap.status === "ok")
    for (const { loc } of collected.sitemap.urls) {
      try {
        if (robotsAllowed(collected, loc)) urls.add(new URL(loc).href);
      } catch {
        // An unparsable <loc> is P3-13's finding, not a page to count.
      }
    }
  const counts = new Map<string, number>();
  let withQuery = 0;
  for (const url of urls) {
    // About / Contact are never left out (WO-B27-090): they count with home.
    const section = isIdentityPage(new URL(url).pathname)
      ? "/"
      : sectionOf(url);
    counts.set(section, (counts.get(section) ?? 0) + 1);
    if (new URL(url).search) withQuery += 1;
  }
  return {
    total: urls.size,
    sections: bySize(
      [...counts].map(([section, count]) => ({ section, count })),
    ),
    paramShare: urls.size ? withQuery / urls.size : 0,
  };
}

const ARCHIVE =
  /^\/(?:blogs?|news|tags?|category|categories|authors?|archives?|page|\d{4})\/$/i;

const bySize = <T extends { section: string; count: number }>(list: T[]) =>
  sort(list, (a, b) => b.count - a.count || a.section.localeCompare(b.section));

/**
 * WO-B27-003 step 3: count ≤ limit → whole site. Over the limit → leave out
 * whole sections, archive-type first (`/blog/`, `/news/`, `/tag/`,
 * `/category/`, `/author/`, date and `/page/` archives), largest first,
 * then the largest remaining section, until the in-scope count is ≤ 90 % of
 * the limit. Home (`/`) is never left out. Deterministic: ties by name.
 */
export function decideScope(
  census: SitemapCensus,
  limit: number,
): ScopeDecision {
  const leftOut: { section: string; count: number }[] = [];
  let inScope = census.total;
  if (census.total > limit) {
    const target = Math.floor(limit * 0.9);
    const candidates = census.sections.filter((s) => s.section !== "/");
    const order = [
      ...bySize(candidates.filter((s) => ARCHIVE.test(s.section))),
      ...bySize(candidates.filter((s) => !ARCHIVE.test(s.section))),
    ];
    for (const section of order) {
      if (inScope <= target) break;
      leftOut.push(section);
      inScope -= section.count;
    }
  }
  return {
    limit,
    census,
    excludePaths: leftOut.map((s) => s.section),
    leftOut,
    inScope,
  };
}
