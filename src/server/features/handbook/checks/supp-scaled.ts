import type {
  CheckResult,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import {
  duplicateClusters,
  findScaledSets,
  indexable,
  median,
  type ScaledSet,
} from "./scaled-sets";
import { createResult } from "./support";

/**
 * SUPP-17 templated / variation page sets (SCALED-COPY §3.2, ADR-022):
 * ≥ 3 indexable pages of one template whose own sentences (site chrome
 * removed) are ≥ 60 % shared pairwise. Precedence §3.1: a set wholly inside
 * one P3-12 duplicate cluster (J ≥ 0.8) is skipped here; URLs a P5-09
 * finding reports are removed after all checks (`applyScaledPrecedence`).
 * A crawl that sampled pages (cap reached, quick depth) → N/A: sets would
 * be partial. Not scored (ADR-020).
 */
const ITEM = "SUPP-17";
const DUPLICATE = 0.8;
const S2_PAGES = 10;
const S2_SHARE = 0.2;
const MAX_EVIDENCE = 20;

const pct = (x: number) => Math.round(x * 100);

const FIX =
  "Merge the set into one page, or give each page content of its own (own facts, examples, prices, photos). Remove or noindex pages with nothing of their own. Google spam policies, scaled content abuse: https://developers.google.com/search/docs/essentials/spam-policies";

function scaledSetTitle(set: ScaledSet) {
  const m = pct(median(set.pages.map((p) => p.shared)));
  const variation =
    set.subtype === "variation" ? ", titles differ by one term" : "";
  return `Page set shares most of its text (${set.pages.length} pages, median ${m} % shared${variation})`;
}

/** One-line set facts, shared by the finding and the P5-09 judge view. */
export function scaledSetSummary(set: ScaledSet): string {
  const shares = set.pages.map((p) => p.shared);
  return [
    `subtype ${set.subtype}`,
    `${set.pages.length} pages`,
    `shared ratio min ${pct(Math.min(...shares))} % / median ${pct(median(shares))} %`,
    set.swaps.length
      ? `${set.swapField} swaps: ${set.swaps.slice(0, 12).join(", ")}`
      : "no single-term swap",
  ].join(" · ");
}

export const suppScaledCheck: HandbookCheck = {
  id: "crawl.supp-scaled",
  itemIds: [ITEM],
  class: "CRAWL",
  requires: ["pages", "templates"],
  run(ctx) {
    const out = createResult([ITEM]);
    const { pages, templates } = ctx.collected;
    if (pages.status !== "ok" || templates.status !== "ok") return out.build();
    if (pages.coverage?.capped) {
      out.na(
        ITEM,
        "quick depth: the crawl sampled pages (cap reached), so page sets would be partial",
      );
      return out.build();
    }
    const live = pages.snapshots.filter(indexable);
    const clusters = duplicateClusters(live, DUPLICATE).map((c) => new Set(c));
    const sets = findScaledSets(pages.snapshots, templates.templates).filter(
      (set) =>
        !clusters.some((c) => set.pages.every((p) => c.has(p.snapshot.url))),
    );
    for (const set of sets) {
      const n = set.pages.length;
      const big = n >= S2_PAGES || n >= S2_SHARE * live.length;
      const summary = scaledSetSummary(set);
      const refs = set.pages
        .slice(0, MAX_EVIDENCE)
        .map((p) =>
          out.evidence(
            "rawHtml",
            p.snapshot.url,
            `${p.snapshot.url} · ${summary} · this page ${pct(p.shared)} % shared · ≈ ${p.ownWords} own-text words`,
            p.snapshot.rawKey,
          ),
        );
      const urls = set.pages.map((p) => p.snapshot.url);
      refs.push(
        out.evidence("url", urls[0], `${set.templateKey}\n${urls.join("\n")}`),
      );
      out.finding({
        itemIds: [ITEM],
        severity: big ? "S2" : "S3",
        ...(big
          ? {
              severityReason: `set of ${n} pages (≥ ${S2_PAGES} pages or ≥ ${pct(S2_SHARE)} % of ${live.length} indexable pages)`,
            }
          : {}),
        title: scaledSetTitle(set),
        detail: [
          summary,
          ...(set.limited ? [`LIMITED: ${set.limited}`] : []),
          ...set.pages.map(
            (p) =>
              `${p.snapshot.url} — ${pct(p.shared)} % shared, ≈ ${p.ownWords} own-text words`,
          ),
        ].join("\n"),
        fix: FIX,
        fixability: "FIXABLE",
        effort: "L",
        urls,
        templateKey: set.templateKey,
        evidenceRefs: refs,
      });
    }
    if (sets.length === 0) {
      const ref = out.evidence(
        "url",
        ctx.origin,
        `${live.length} indexable pages in ${templates.templates.length} templates; no set of ≥ 3 pages with ≥ 60 % shared sentences outside a duplicate cluster`,
      );
      out.pass(ITEM, "no templated or variation page set", [ref]);
    }
    return out.build();
  },
};

/**
 * Precedence rule 1 (SCALED-COPY §3.1) after all checks: URLs reported by a
 * P5-09 finding leave the SUPP-17 sets; a set left with < 3 pages is dropped.
 */
export function applyScaledPrecedence<
  T extends { checkId: string; result: CheckResult },
>(pending: readonly T[]): T[] {
  const p509 = new Set(
    pending.flatMap((p) =>
      p.result.findings
        .filter((f) => f.itemIds.includes("P5-09"))
        .flatMap((f) => f.urls),
    ),
  );
  if (p509.size === 0) return [...pending];
  return pending.map((p) => {
    if (p.checkId !== suppScaledCheck.id) return p;
    const findings = p.result.findings.flatMap((f) => {
      const urls = f.urls.filter((u) => !p509.has(u));
      if (urls.length === f.urls.length) return [f];
      if (urls.length < 3) return [];
      const keep = new Set(urls);
      const refs = new Set(
        p.result.evidence
          .filter((e) => f.evidenceRefs.includes(e.ref))
          .filter((e) => e.kind !== "rawHtml" || keep.has(e.url))
          .map((e) => e.ref),
      );
      return [
        {
          ...f,
          title: f.title.replace(/\(\d+ pages/, `(${urls.length} pages`),
          detail: `${f.detail}\n${f.urls.length - urls.length} page(s) left to P5-09 (local pages)`,
          urls,
          evidenceRefs: f.evidenceRefs.filter((r) => refs.has(r)),
        },
      ];
    });
    return { ...p, result: { ...p.result, findings } };
  });
}
