import type {
  PageSnapshot,
  TemplatesData,
} from "@/server/features/handbook/contracts/collectors";
import {
  estimateJaccard,
  similarPairs,
} from "@/server/features/handbook/engine/minhash";
import { sort } from "remeda";
import { normalizeUrl, pathOf } from "./support";

/**
 * Shared page-set helpers (ADR-022): one implementation for P3-12
 * (duplicate clusters), P5-09 (title swaps) and SUPP-17 (templated /
 * variation sets, SCALED-COPY §3.2). Page text = the crawl's block
 * sentence hashes (`PageSnapshot.sentenceHashes`); chrome = a sentence on
 * pages of ≥ 2 templates. Pairs: full-signature MinHash ≥ 0.3 within one
 * template, then the exact shared-sentence ratio (shared / smaller page).
 */

/** SUPP-17 link: shared sentences / sentences of the smaller page. */
const SET_RATIO = 0.6;
const SET_MIN_PAGES = 3;
const CANDIDATE_JACCARD = 0.3;
/** Above this many pages per template, candidates come from LSH bands only. */
const ALL_PAIRS_MAX = 400;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);

/** Indexable, self-canonical 200 page with main-text facts. */
export const indexable = (s: PageSnapshot) =>
  s.status === 200 &&
  s.mainWords !== undefined &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  !noindex(s) &&
  (!s.head.canonical ||
    normalizeUrl(s.head.canonical) === normalizeUrl(s.finalUrl));

/** Union-find over index pairs; groups of ≥ `minSize` linked indices. */
export function linkedSets(
  n: number,
  pairs: ReadonlyArray<{ a: number; b: number }>,
  minSize = 2,
): number[][] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (const { a, b } of pairs) parent[find(a)] = find(b);
  const linked = new Set(pairs.flatMap(({ a, b }) => [a, b]));
  const groups = new Map<number, number[]>();
  for (const i of sort([...linked], (x, y) => x - y)) {
    const list = groups.get(find(i)) ?? [];
    list.push(i);
    groups.set(find(i), list);
  }
  return [...groups.values()].filter((g) => g.length >= minSize);
}

/** P3-12 clusters (MinHash J ≥ `threshold`) over pages, as URL lists. */
export function duplicateClusters(
  pages: readonly PageSnapshot[],
  threshold: number,
): string[][] {
  const withSig = pages.filter((s) => (s.minhash?.length ?? 0) > 0);
  const pairs = similarPairs(
    withSig.map((s) => s.minhash ?? []),
    threshold,
  );
  return linkedSets(withSig.length, pairs).map((g) =>
    g.map((i) => withSig[i].url),
  );
}

/**
 * The differing run when two phrases differ only by one run of ≤ 2 words
 * (place or service swapped), else null.
 */
function swapRun(
  a: string,
  b: string,
  minWords = 3,
): { a: string; b: string } | null {
  const x = a.toLowerCase().split(/\s+/).filter(Boolean);
  const y = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (x.length !== y.length || x.length < minWords) return null;
  const diff = x.flatMap((w, i) => (w === y[i] ? [] : [i]));
  const run =
    diff.length > 0 &&
    diff.length <= 2 &&
    diff[diff.length - 1] - diff[0] < diff.length;
  if (!run) return null;
  const pick = (w: string[]) => w.slice(diff[0], diff[diff.length - 1] + 1);
  return { a: pick(x).join(" "), b: pick(y).join(" ") };
}

/** Titles that differ only by one run of ≤ 2 words (P5-09). */
export const swapped = (a: string, b: string) => swapRun(a, b) !== null;

/** Per page: its sentence hashes minus chrome (hashes on pages of ≥ 2 templates). */
function ownSentences(
  pages: ReadonlyArray<{ template: string; hashes: readonly number[] }>,
): Set<number>[] {
  const templatesOf = new Map<number, Set<string>>();
  for (const p of pages)
    for (const h of p.hashes) {
      const set = templatesOf.get(h) ?? new Set();
      set.add(p.template);
      templatesOf.set(h, set);
    }
  return pages.map(
    (p) => new Set(p.hashes.filter((h) => (templatesOf.get(h)?.size ?? 0) < 2)),
  );
}

function pairRatio(a: ReadonlySet<number>, b: ReadonlySet<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const h of a) if (b.has(h)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

export type ScaledSet = {
  templateKey: string;
  subtype: "variation" | "templated";
  pages: ReadonlyArray<{
    snapshot: PageSnapshot;
    /** Share of the page's own sentences also found on another set page. */
    shared: number;
    /** ≈ main-content words outside the shared sentences. */
    ownWords: number;
  }>;
  /** Swapped terms when `variation` (title, H1 or slug), else []. */
  swaps: string[];
  swapField: "title" | "H1" | "slug" | null;
  /** Set when candidate pairs came from LSH bands (template > 400 pages). */
  limited: string | null;
};

const slugWords = (url: string) =>
  (pathOf(url).split("/").filter(Boolean).at(-1) ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ");

const FIELDS = [
  { name: "title", value: (s: PageSnapshot) => s.head.title ?? "", min: 3 },
  { name: "H1", value: (s: PageSnapshot) => s.h1[0] ?? "", min: 3 },
  { name: "slug", value: (s: PageSnapshot) => slugWords(s.url), min: 2 },
] as const;

/** First field on which every pair of the set differs by one swapped run. */
function swapsOf(pages: readonly PageSnapshot[]) {
  for (const field of FIELDS) {
    const values = pages.map(field.value);
    const terms = new Set<string>();
    let ok = true;
    for (let i = 0; i < values.length && ok; i += 1)
      for (let j = i + 1; j < values.length && ok; j += 1) {
        const run = swapRun(values[i], values[j], field.min);
        if (!run) ok = false;
        else terms.add(run.a).add(run.b);
      }
    if (ok) return { field: field.name, terms: [...terms] };
  }
  return null;
}

/** Candidate index pairs of one template (MinHash estimate ≥ 0.3). */
function candidatePairs(sigs: ReadonlyArray<readonly number[]>) {
  if (sigs.length > ALL_PAIRS_MAX) return similarPairs(sigs, CANDIDATE_JACCARD);
  const out: { a: number; b: number }[] = [];
  for (let a = 0; a < sigs.length; a += 1)
    for (let b = a + 1; b < sigs.length; b += 1)
      if (estimateJaccard(sigs[a], sigs[b]) >= CANDIDATE_JACCARD)
        out.push({ a, b });
  return out;
}

/** SUPP-17 sets: ≥ 3 indexable pages of one template linked at ratio ≥ 0.6. */
export function findScaledSets(
  snapshots: readonly PageSnapshot[],
  templates: TemplatesData["templates"],
): ScaledSet[] {
  const byUrl = new Map(snapshots.map((s) => [s.url, s]));
  const members = templates.flatMap((t) =>
    t.urls.flatMap((u) => {
      const snapshot = byUrl.get(u);
      return snapshot ? [{ template: t.key, snapshot }] : [];
    }),
  );
  const owns = ownSentences(
    members.map((m) => ({
      template: m.template,
      hashes: m.snapshot.sentenceHashes ?? [],
    })),
  );
  const ownOf = new Map(members.map((m, i) => [m.snapshot.url, owns[i]]));
  const sets: ScaledSet[] = [];
  for (const t of templates) {
    const pages = t.urls
      .flatMap((u) => byUrl.get(u) ?? [])
      .filter(
        (s) =>
          indexable(s) &&
          (s.minhash?.length ?? 0) > 0 &&
          (ownOf.get(s.url)?.size ?? 0) > 0,
      );
    if (pages.length < SET_MIN_PAGES) continue;
    const own = pages.map((s) => ownOf.get(s.url) ?? new Set<number>());
    const links = candidatePairs(pages.map((s) => s.minhash ?? [])).filter(
      ({ a, b }) => pairRatio(own[a], own[b]) >= SET_RATIO,
    );
    for (const group of linkedSets(pages.length, links, SET_MIN_PAGES)) {
      const set = group.map((i) => pages[i]);
      const swap = swapsOf(set);
      sets.push({
        templateKey: t.key,
        subtype: swap ? "variation" : "templated",
        pages: group.map((i) => {
          const others = new Set(
            group.filter((j) => j !== i).flatMap((j) => [...own[j]]),
          );
          const shared =
            [...own[i]].filter((h) => others.has(h)).length / own[i].size;
          return {
            snapshot: pages[i],
            shared,
            ownWords: Math.round((pages[i].mainWords ?? 0) * (1 - shared)),
          };
        }),
        swaps: swap?.terms ?? [],
        swapField: swap?.field ?? null,
        limited:
          pages.length > ALL_PAIRS_MAX
            ? `template has ${pages.length} pages (> ${ALL_PAIRS_MAX}): candidate pairs from MinHash LSH bands only`
            : null,
      });
    }
  }
  return sets;
}

export const median = (xs: readonly number[]) => {
  const s = sort(xs, (a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};
