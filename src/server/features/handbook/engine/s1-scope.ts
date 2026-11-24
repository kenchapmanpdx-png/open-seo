import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { normalizeUrl } from "../checks/support";
import { decide } from "./robots";
import type { PendingResult } from "./runner";

/**
 * ADR-034 — S1 scope. A Must-fix about what search engines see on a page
 * is S1 only when at least one affected URL is indexable. The cap rule
 * itself ("any open S1 → total ≤ 39") is untouched; this decides which
 * findings are S1.
 *
 * PAGE_SCOPED: S1 items whose defect is on the page (rendered content,
 * render resources, link / canonical form, bot-check content).
 * ACCESS_S1: S1 items whose defect is indexability or crawl access itself;
 * they stay S1 whatever the page. Every item a check can emit at S1 is in
 * exactly one list (guarded by s1-scope.test.ts).
 */
export const PAGE_SCOPED_S1 = new Set(["P2-01", "P3-04", "P3-20", "SUPP-07"]);
export const ACCESS_S1 = new Set([
  "P3-01",
  "P3-05",
  "P3-10",
  "P3-15",
  "P9-01",
  "P9-05",
]);

/** Items whose defect is the page's canonical: the canonical rule is not used to judge them. */
const CANONICAL_ITEMS = new Set(["P3-04"]);

const SHOWN = 10;

/**
 * Why `url` cannot be indexed, or null when it can (or the run has no
 * record of it: unknown pages keep the finding's severity).
 */
export function notIndexableReason(
  url: string,
  byUrl: ReadonlyMap<string, PageSnapshot>,
  robots: CollectedData["robots"],
  opts: { canonical: boolean },
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (robots.status === "ok") {
    const host = robots.hosts.find(
      (h) => h.host === parsed.host && h.status === 200,
    );
    if (host) {
      const d = decide(
        host.host,
        host.groups,
        "Googlebot",
        parsed.pathname + parsed.search,
      );
      if (!d.allowed)
        return `robots.txt ${d.matchedRule ?? "disallow"} for Googlebot`;
    }
  }
  const s = byUrl.get(normalizeUrl(url));
  if (!s) return null;
  if (s.status !== 200) return `HTTP ${s.status}`;
  if (normalizeUrl(s.finalUrl) !== normalizeUrl(s.url))
    return `redirects to ${s.finalUrl}`;
  if (/noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`))
    return "noindex";
  if (
    opts.canonical &&
    s.head.canonical &&
    normalizeUrl(s.head.canonical) !== normalizeUrl(s.finalUrl)
  )
    return `canonical → ${s.head.canonical}`;
  return null;
}

/**
 * Applies ADR-034 to every S1 finding on a PAGE_SCOPED item: all URLs
 * non-indexable → S3 with the reason; mixed → split into the S1 finding on
 * the indexable URLs and an S3 one on the rest; none non-indexable → unchanged.
 */
export function scopeS1ToIndexable(
  pending: readonly PendingResult[],
  collected: CollectedData,
): PendingResult[] {
  const pages = collected.pages;
  const byUrl = new Map<string, PageSnapshot>();
  if (pages.status === "ok")
    for (const s of pages.snapshots) byUrl.set(normalizeUrl(s.url), s);
  return pending.map((p) => ({
    ...p,
    result: {
      ...p.result,
      findings: p.result.findings.flatMap((f) => {
        const item = f.itemIds[0] ?? "";
        if (f.severity !== "S1" || !PAGE_SCOPED_S1.has(item)) return [f];
        const opts = { canonical: !CANONICAL_ITEMS.has(item) };
        const blocked: string[] = [];
        const reasons: string[] = [];
        const open: string[] = [];
        for (const url of f.urls) {
          const why = notIndexableReason(url, byUrl, collected.robots, opts);
          if (why) {
            blocked.push(url);
            reasons.push(`${url} (${why})`);
          } else open.push(url);
        }
        if (blocked.length === 0) return [f];
        const list =
          reasons.slice(0, SHOWN).join("; ") +
          (reasons.length > SHOWN ? `; +${reasons.length - SHOWN} more` : "");
        const lowered = {
          ...f,
          severity: "S3" as const,
          severityReason: `affects only pages search engines cannot index (${list})`,
          urls: blocked,
        };
        return open.length === 0 ? [lowered] : [{ ...f, urls: open }, lowered];
      }),
    },
  }));
}
