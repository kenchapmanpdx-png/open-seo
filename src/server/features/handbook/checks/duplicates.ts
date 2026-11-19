import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { similarPairs } from "@/server/features/handbook/engine/minhash";
import { createResult, normalizeUrl } from "./support";

/**
 * Duplicates + thin pages (FULL-READ §3.5, ADR-021). P3-12: indexable,
 * self-canonical 200 pages whose main text (5-word shingles, MinHash) is
 * ≥ 0.8 similar; pages that canonicalize elsewhere, are noindex or redirect
 * are not candidates. Thin pages (< 50 main words) follow once the BadGEO
 * fixtures carry real body text (queue WO-B9-011 note). SUPP-03: a text block (≥ 8 words) printed ≥ 2× inside one page's main
 * HTML (sliders, duplicated cards, pasted paragraphs). Not scored.
 */
const ITEMS = ["P3-12", "SUPP-03"];

const SIMILAR = 0.8;
const MAX_LIST = 10;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);

const indexable = (s: PageSnapshot) =>
  s.status === 200 &&
  s.mainWords !== undefined &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  !noindex(s) &&
  (!s.head.canonical ||
    normalizeUrl(s.head.canonical) === normalizeUrl(s.finalUrl));

/** Union-find clusters over similar pairs. */
function clusters(n: number, pairs: ReadonlyArray<{ a: number; b: number }>) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (const { a, b } of pairs) parent[find(a)] = find(b);
  const groups = new Map<number, number[]>();
  for (const { a, b } of pairs)
    for (const i of [a, b]) {
      const root = find(i);
      const list = groups.get(root) ?? [];
      if (!list.includes(i)) list.push(i);
      groups.set(root, list);
    }
  return [...groups.values()];
}

export const duplicatesCheck: HandbookCheck = {
  id: "crawl.duplicates",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const live = pages.snapshots.filter(indexable);

    // P3-12 near-duplicates.
    const withSig = live.filter((s) => (s.minhash?.length ?? 0) > 0);
    const pairs = similarPairs(
      withSig.map((s) => s.minhash ?? []),
      SIMILAR,
    );
    const groups = clusters(withSig.length, pairs);
    if (groups.length > 0) {
      const pairText = (p: (typeof pairs)[number]) =>
        `${withSig[p.a].url} ≈ ${withSig[p.b].url} · Jaccard ${p.jaccard.toFixed(2)} (5-word shingles, MinHash estimate)`;
      out.finding({
        itemIds: ["P3-12"],
        severity: "S3",
        title: "Near-duplicate pages (main text ≥ 80 % the same)",
        detail: groups
          .slice(0, MAX_LIST)
          .map((g) => g.map((i) => withSig[i].url).join(" ≈ "))
          .join("\n"),
        fix: "Merge each cluster into one page and 301 the rest, or rewrite each page around its own topic; if a copy must stay, point its canonical at the main URL.",
        fixability: "FIXABLE",
        effort: "M",
        urls: groups.flat().map((i) => withSig[i].url),
        evidenceRefs: pairs
          .slice(0, MAX_LIST)
          .map((p) =>
            out.evidence(
              "rawHtml",
              withSig[p.a].url,
              `${pairText(p)} · ${withSig[p.a].markup.text.slice(0, 200)}`,
              withSig[p.a].rawKey,
            ),
          ),
      });
    }

    // SUPP-03 repeated blocks inside one page.
    const repeats = pages.snapshots.filter(
      (s) => s.status === 200 && (s.duplicateBlocks?.length ?? 0) > 0,
    );
    if (repeats.length > 0)
      out.finding({
        itemIds: ["SUPP-03"],
        severity: "S3",
        title: "Same text block printed more than once on a page",
        detail: repeats
          .slice(0, MAX_LIST * 2)
          .map(
            (s) =>
              `${s.url} — ${(s.duplicateBlocks ?? [])
                .map((b) => `${b.count}× "${b.text.slice(0, 80)}"`)
                .join("; ")}`,
          )
          .join("\n"),
        fix: "Print each block once in the HTML (slider clones, responsive copies and duplicated cards: hide with CSS or render one instance); extractors and AI readers otherwise weigh the repeated text.",
        fixability: "FIXABLE",
        effort: "S",
        urls: repeats.map((s) => s.url),
        evidenceRefs: repeats
          .slice(0, MAX_LIST)
          .map((s) =>
            out.evidence(
              "rawHtml",
              s.url,
              (s.duplicateBlocks ?? [])
                .map((b) => `${b.count}× ${b.text}`)
                .join(" | "),
              s.rawKey,
            ),
          ),
      });
    return out.build();
  },
};
