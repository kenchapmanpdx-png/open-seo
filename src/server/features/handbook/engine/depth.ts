import { sort } from "remeda";
import { z } from "zod";
import type { Coverage } from "@/server/features/handbook/contracts/collectors";
import {
  pagePathBase,
  paginationParam,
} from "@/server/features/handbook/engine/pagination";
import {
  handbookDepthSchema,
  type CrawlScope,
  type HandbookDepth,
} from "@/server/features/handbook/contracts/exports";

/**
 * Run depth and crawl caps (ADR-018, FULL-READ §2 / §8). `full` reads every
 * discovered page up to the cap; `quick` keeps the pre-B9 sampling (CI,
 * BadGEO default). Grades compare only within one depth (EP-7).
 */

export const DEPTH_ENV = "HANDBOOK_DEPTH";
export const MAX_PAGES_ENV = "HANDBOOK_MAX_PAGES";
const FULL_MAX_PAGES = 1000;

/** CLI flag wins over `HANDBOOK_DEPTH`; default `full`. */
export function resolveDepth(
  env: string | undefined,
  cli?: string,
): HandbookDepth {
  return handbookDepthSchema.parse(cli || env || "full");
}

/**
 * CLI `--max-pages` wins over `HANDBOOK_MAX_PAGES`; otherwise 1000 for
 * `full` and the caller's pre-B9 cap for `quick`.
 */
export function resolveMaxPages(input: {
  depth: HandbookDepth;
  env: string | undefined;
  cli?: string;
  quickDefault: number;
}): number {
  const raw = input.cli || input.env;
  if (raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`max pages must be a positive integer, got "${raw}"`);
    }
    return n;
  }
  return input.depth === "full" ? FULL_MAX_PAGES : input.quickDefault;
}

export const LIGHTHOUSE_ENV = "HANDBOOK_LIGHTHOUSE";
const lighthouseScopeSchema = z.enum(["templates", "all"]);
export type LighthouseScope = z.infer<typeof lighthouseScopeSchema>;

/** CLI flag wins over `HANDBOOK_LIGHTHOUSE`; default `templates` (ADR-018). */
export function resolveLighthouseScope(
  env: string | undefined,
  cli?: string,
): LighthouseScope {
  return lighthouseScopeSchema.parse(cli || env || "templates");
}

/** `all` mode: one Lighthouse run ≈ 30 s plus overhead (FULL-READ §2). */
const LIGHTHOUSE_MINUTES_PER_PAGE = 0.6;
/** Everything but Lighthouse, per page (ADR-018 100-page budget ≈ 15 min). */
const BASE_MINUTES_PER_PAGE = 0.15;

/** Minutes the run cap rises by: 0.6 per Lighthouse page in `all`, else 0. */
export function lighthouseCapMinutes(
  scope: LighthouseScope,
  lighthousePages: number,
): number {
  return scope === "all" ? lighthousePages * LIGHTHOUSE_MINUTES_PER_PAGE : 0;
}

/** Whole-run estimate shown before start: base + 0.6 min per Lighthouse page in `all`. */
export function estimateRunMinutes(
  pages: number,
  scope: LighthouseScope,
): number {
  return Math.ceil(
    pages * BASE_MINUTES_PER_PAGE + lighthouseCapMinutes(scope, pages),
  );
}

/**
 * Over the cap: every template's first URL, then round-robin across
 * templates until `cap`. Template order = first appearance.
 */
export function stratifiedFill(
  urlsByTemplate: ReadonlyMap<string, readonly string[]>,
  cap: number,
): string[] {
  const lists = [...urlsByTemplate.values()];
  const out: string[] = [];
  for (let round = 0; out.length < cap; round += 1) {
    let added = false;
    for (const list of lists) {
      const url = list[round];
      if (url === undefined) continue;
      added = true;
      out.push(url);
      if (out.length >= cap) break;
    }
    if (!added) break;
  }
  return out;
}

/** Group URLs by path pattern (template proxy before the pages are fetched). */
export function groupByPattern(urls: readonly string[]): Map<string, string[]> {
  const patterns = pathPatterns(urls);
  const out = new Map<string, string[]>();
  for (const url of urls) {
    const key = patterns.get(url) ?? "/";
    out.set(key, [...(out.get(key) ?? []), url]);
  }
  return out;
}

/** First path section of a URL: `/pages/x` → `/pages/`, home → `/` (WO-B27-003/004). */
export function sectionOf(url: string): string {
  const first = new URL(url).pathname.split("/").filter(Boolean)[0];
  return first ? `/${first}/` : "/";
}

/**
 * WO-B27-004: sitemap URLs in read order, round-robin across first path
 * sections so every section gets pages before any is exhausted. Section
 * order = first appearance; order within a section is kept.
 */
export function roundRobinBySection(urls: readonly string[]): string[] {
  const bySection = new Map<string, string[]>();
  for (const url of urls) {
    const key = sectionOf(url);
    bySection.set(key, [...(bySection.get(key) ?? []), url]);
  }
  return stratifiedFill(bySection, urls.length);
}

/**
 * WO-B27-004: a query-string URL whose clean path (`origin + pathname`) is a
 * known page is a parameter variant of it. Returns its parameter pattern
 * (sorted parameter names), or null when the URL is not a variant. Numbered
 * pagination is never a variant (it lists other items).
 */
export function variantPattern(
  url: string,
  known: ReadonlySet<string>,
): string | null {
  const u = new URL(url);
  if (!u.search || paginationParam(u) !== null) return null;
  if (!known.has(`${u.origin}${u.pathname}`)) return null;
  return sort([...new Set(u.searchParams.keys())], (a, b) =>
    a.localeCompare(b),
  ).join("&");
}

const SPACE_CAP = 20;
const TEMPLATE_CAP_AFTER = 300;
const TEMPLATE_CAP = 100;
const DATE_ARCHIVE = /^(.*?)\/\d{4}(?:\/\d{2}){0,2}\/?$/;
/**
 * Keeps calendars, filters and archives from eating the page budget:
 * a query-string URL is dropped when its path (or an earlier query variant
 * of it) is already listed (except numeric pagination parameters, see
 * engine/pagination.ts); pagination, `/page/N/` and date
 * archives (`/YYYY/`, `/YYYY/MM/`) keep 20 URLs per base path, and after 300
 * URLs each template keeps 100. Order is kept.
 */
export function infiniteSpaceGuard(urls: readonly string[]): string[] {
  const listed = new Set(urls);
  const kept: string[] = [];
  const queryPaths = new Set<string>();
  const spaceCounts = new Map<string, number>();
  for (const url of urls) {
    const u = new URL(url);
    const page = paginationParam(u);
    const path = `${u.origin}${u.pathname}`;
    if (u.search && page === null) {
      if (listed.has(path) || queryPaths.has(path)) continue;
      queryPaths.add(path);
    }
    const pageBase = pagePathBase(u.pathname);
    const space =
      page !== null
        ? `q:${u.pathname}`
        : pageBase !== null
          ? `p:${pageBase}`
          : DATE_ARCHIVE.test(u.pathname)
            ? `d:${DATE_ARCHIVE.exec(u.pathname)?.[1] ?? ""}`
            : null;
    if (space) {
      const n = spaceCounts.get(space) ?? 0;
      if (n >= SPACE_CAP) continue;
      spaceCounts.set(space, n + 1);
    }
    kept.push(url);
  }
  if (kept.length <= TEMPLATE_CAP_AFTER) return kept;
  const patterns = pathPatterns(kept);
  const perTemplate = new Map<string, number>();
  return kept.filter((url, i) => {
    const key = patterns.get(url) ?? "/";
    const n = perTemplate.get(key) ?? 0;
    if (i >= TEMPLATE_CAP_AFTER && n >= TEMPLATE_CAP) return false;
    perTemplate.set(key, n + 1);
    return true;
  });
}

/** Grade flag only (score unchanged): read / discovered < 0.9. */
function isPartialCoverage(coverage: Coverage | undefined): boolean {
  if (!coverage || coverage.discovered === 0) return false;
  return coverage.read / coverage.discovered < 0.9;
}

/** "Depth: full · read N of M discovered" (+ "· partial coverage", "· not read N (…)"). */
export function depthLine(
  depth: HandbookDepth | undefined,
  coverage: Coverage | undefined,
): string {
  const parts = [`Depth: ${depth ?? "quick"}`];
  if (coverage)
    parts.push(`read ${coverage.read} of ${coverage.discovered} discovered`);
  if (isPartialCoverage(coverage)) parts.push("partial coverage");
  const unread = coverage?.unread;
  if (unread?.total) {
    const byClass = Object.entries(unread.byClass).map(([c, n]) => `${c} ${n}`);
    parts.push(`not read ${unread.total} (${byClass.join(", ")})`);
  }
  // WO-B27-001: exports state the mode next to the depth.
  if (coverage?.shortName) parts.push("read with the short app name");
  return parts.join(" · ");
}

/**
 * WO-B27-003 / 004: the scope and limit lines, one derivation for the run
 * page and the exports. A site read whole within the limit gets none.
 */
export function scopeLines(
  scope: CrawlScope | undefined,
  coverage: { read: number; capped: boolean },
): string[] {
  if (!scope) return [];
  const { read, capped } = coverage;
  const lines: string[] = [];
  const unread = scope.sitemapUnread.reduce((n, g) => n + g.urls.length, 0);
  if (scope.sitemapTotal === null) {
    lines.push(
      `No sitemap; scope was decided while crawling (page limit ${scope.limit}).`,
    );
  } else if (scope.leftOut.length > 0) {
    const left = scope.leftOut.map((l) => `${l.section} (${l.count})`);
    lines.push(
      `Scope: ${scope.sitemapInScope} of ${scope.sitemapTotal} sitemap pages; left out ${left.join(", ")}; page limit ${scope.limit}.`,
    );
  }
  const counted = read - scope.variants.sampled;
  if (unread > 0 || capped) {
    const which =
      counted >= scope.limit ? `Page limit ${scope.limit}` : "Time limit";
    const parts = [`${which} reached: ${read} pages read`];
    if (unread > 0) {
      const groups = scope.sitemapUnread.map(
        (g) => `${g.section} ${g.urls.length}`,
      );
      parts.push(
        `${unread} in-scope sitemap pages not read (${groups.join(", ")})`,
      );
    }
    if (scope.notFollowed > 0)
      parts.push(`${scope.notFollowed} discovered URLs not followed`);
    if (scope.variants.skipped > 0)
      parts.push(
        `${scope.variants.skipped} parameter variants of known pages skipped (${scope.variants.sampled} read as samples, not counted)`,
      );
    lines.push(`${parts.join("; ")}.`);
    if (scope.sitemapInScope > 0)
      lines.push(
        `Site-wide findings are based on ${scope.sitemapInScope - unread} of ${scope.sitemapInScope} in-scope sitemap pages.`,
      );
  }
  return lines;
}

/**
 * Exports: the depth line, then the scope lines (WO-B27-003 / 004). The
 * review export passes its list bullet and also gets the unread sitemap
 * URLs by section.
 */
export function depthLines(
  depth: HandbookDepth | undefined,
  coverage: Coverage | undefined,
  reviewBullet?: string,
): string[] {
  const scope = coverage?.scope;
  const lists = reviewBullet ? (scope?.sitemapUnread ?? []) : [];
  const lines = [
    depthLine(depth, coverage),
    ...(coverage ? scopeLines(scope, coverage) : []),
    ...lists.map(
      (g) => `not read, ${g.section} (${g.urls.length}): ${g.urls.join(", ")}`,
    ),
  ];
  return reviewBullet ? lines.map((l) => `${reviewBullet}${l}`) : lines;
}

const DYNAMIC_SEGMENT =
  /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27}|[0-9a-f]{12,}|.*\d.*-.*|.*-.*\d.*)$/i;

/** Path pattern per ADR-006: dynamic segments and ≥3-sibling runs become `*`. */
export function pathPatterns(urls: readonly string[]): Map<string, string> {
  const segs = new Map(
    urls.map((u) => [u, new URL(u).pathname.split("/").filter(Boolean)]),
  );
  const out = new Map<string, string>();
  for (const [url, parts] of segs) {
    if (parts.length === 0) {
      out.set(url, "/");
      continue;
    }
    const pattern = parts.map((part, i) => {
      if (DYNAMIC_SEGMENT.test(part)) return "*";
      // Siblings: same depth, every other segment equal.
      let siblings = 0;
      for (const other of segs.values()) {
        if (other.length !== parts.length) continue;
        if (other.every((o, j) => j === i || o === parts[j])) siblings += 1;
      }
      return siblings >= 3 ? "*" : part;
    });
    out.set(url, "/" + pattern.join("/"));
  }
  return out;
}
