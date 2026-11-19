import { z } from "zod";
import type { Coverage } from "@/server/features/handbook/contracts/collectors";
import {
  handbookDepthSchema,
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

const SPACE_CAP = 20;
const TEMPLATE_CAP_AFTER = 300;
const TEMPLATE_CAP = 100;
const PAGE_PATH = /^(.*?)\/page\/\d+\/?$/i;
const DATE_ARCHIVE = /^(.*?)\/\d{4}(?:\/\d{2}){0,2}\/?$/;

/**
 * Keeps calendars, filters and archives from eating the page budget:
 * a query-string URL is dropped when its path (or an earlier query variant
 * of it) is already listed (except `?page=`), `?page=`, `/page/N/` and date
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
    const page = u.searchParams.get("page");
    const path = `${u.origin}${u.pathname}`;
    if (u.search && page === null) {
      if (listed.has(path) || queryPaths.has(path)) continue;
      queryPaths.add(path);
    }
    const space =
      page !== null
        ? `q:${u.pathname}`
        : PAGE_PATH.test(u.pathname)
          ? `p:${PAGE_PATH.exec(u.pathname)?.[1] ?? ""}`
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

/** "Depth: full · read N of M discovered" (+ "· partial coverage"). */
export function depthLine(
  depth: HandbookDepth | undefined,
  coverage: Coverage | undefined,
): string {
  const parts = [`Depth: ${depth ?? "quick"}`];
  if (coverage)
    parts.push(`read ${coverage.read} of ${coverage.discovered} discovered`);
  if (isPartialCoverage(coverage)) parts.push("partial coverage");
  return parts.join(" · ");
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
