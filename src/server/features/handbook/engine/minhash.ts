import { Parser } from "htmlparser2";
import { SCREENS, utilityHiddenBands } from "./utility-hidden";

/**
 * Near-duplicate pages and repeated blocks (ADR-021, FULL-READ §3.5), no npm
 * dependency. Main text = visible text outside header / nav / footer / aside
 * / form, split into blocks at block-level tags. Pages: MinHash over 5-word
 * shingles (128 permutations, seeds from 32-bit FNV-1a), LSH 32 bands × 4
 * rows for candidate pairs. Only the 128 values are stored per page (bodies
 * stay out of memory), so candidates are verified with the full-signature
 * estimate (standard error ≈ 0.035 at J = 0.8), not by re-reading shingles.
 */

const PERMUTATIONS = 128;
const SHINGLE = 5;
const BANDS = 32;
const ROWS = 4;
/** In-page duplicate block (SUPP-03): ≥ 8 words, ≥ 2 occurrences. */
const BLOCK_MIN_WORDS = 8;
const BLOCK_TEXT_MAX = 200;

const SKIP = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "header",
  "nav",
  "footer",
  "aside",
  "form",
  "select",
  "textarea",
  "button",
]);
const BLOCK = new Set([
  "p",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "td",
  "th",
  "dt",
  "dd",
  "blockquote",
  "figcaption",
  "div",
  "section",
  "article",
  "main",
  "br",
  "tr",
]);

function fnv1a(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Permutation i: h → (a_i · h + b_i) mod 2^32, a_i odd; deterministic seeds.
const A = Array.from({ length: PERMUTATIONS }, (_, i) => fnv1a(`a${i}`) | 1);
const B = Array.from({ length: PERMUTATIONS }, (_, i) => fnv1a(`b${i}`));

const words = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];

/**
 * Page `<style>` rules that hide a class in one layout (WO-B25-007): a
 * `.<scope> .<class>{display:none}` rule whose scope belongs to a layout
 * family (≥ 2 scopes prefix the same class: Showit `.d` / `.m`), or
 * `@media (…) { .<class>{display:none} }`. Raw HTML only, no external CSS.
 */
type LayoutRules = {
  scopes: string[];
  medias: string[];
  byScope: Map<string, Set<string>>;
  byMedia: Map<string, Set<string>>;
};

const addTo = (map: Map<string, Set<string>>, key: string, value: string) =>
  map.set(key, (map.get(key) ?? new Set()).add(value));

const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const HIDES = /display\s*:\s*none/i;

function layoutRules(html: string): LayoutRules {
  const family = new Map<string, Set<string>>();
  const scopeHides: [string, string][] = [];
  const byMedia = new Map<string, Set<string>>();
  const rule = (selectors: string, body: string, media: string | null) => {
    for (const raw of selectors.split(",")) {
      const sel = raw.trim();
      const scoped = /^\.([\w-]+)\s+\.([\w-]+)$/.exec(sel);
      if (!media && scoped) {
        addTo(family, scoped[2], scoped[1]);
        if (HIDES.test(body)) scopeHides.push([scoped[2], scoped[1]]);
      }
      const single = /^\.([\w-]+)$/.exec(sel);
      if (media && single && HIDES.test(body)) addTo(byMedia, single[1], media);
    }
  };
  // Top-level rules and one level of @media; other at-rules are skipped.
  const scan = (css: string, media: string | null) => {
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf("{", i);
      if (open < 0) return;
      const prelude = css.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth += 1;
        else if (css[j] === "}") depth -= 1;
        j += 1;
      }
      const body = css.slice(open + 1, j - 1);
      if (prelude.startsWith("@media") && !media)
        scan(body, prelude.replace(/\s+/g, " "));
      else if (!prelude.startsWith("@")) rule(prelude, body, media);
      i = j;
    }
  };
  for (const m of html.matchAll(STYLE))
    scan(m[1].replace(/\/\*[\s\S]*?\*\//g, ""), null);
  const families = new Set(
    [...family.values()].filter((f) => f.size >= 2).flatMap((f) => [...f]),
  );
  const byScope = new Map<string, Set<string>>();
  for (const [cls, scope] of scopeHides)
    if (families.has(scope)) addTo(byScope, cls, scope);
  return {
    scopes: [...families],
    medias: [...new Set([...byMedia.values()].flatMap((m) => [...m]))],
    byScope,
    byMedia,
  };
}

/** Where a block is hidden: everywhere, or in some scope / media / band layouts. */
type Hidden = {
  all: boolean;
  scopes: Set<string>;
  medias: Set<string>;
  bands: Set<string>;
};
type Block = { text: string; hidden: Hidden };

/** Main-text blocks of raw HTML, whitespace collapsed, empty blocks dropped. */
function mainTextBlocks(html: string, rules: LayoutRules): Block[] {
  const blocks: Block[] = [];
  let buf: string[] = [];
  let bufHidden: Hidden | null = null;
  let skip = 0;
  const stack: { name: string; hidden: Hidden }[] = [];
  const none: Hidden = {
    all: false,
    scopes: new Set(),
    medias: new Set(),
    bands: new Set(),
  };
  const flush = () => {
    const text = buf.join("").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ text, hidden: bufHidden ?? none });
    buf = [];
    bufHidden = null;
  };
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (BLOCK.has(name)) flush();
        if (SKIP.has(name)) skip += 1;
        const parent = stack.at(-1)?.hidden ?? none;
        const classes = (attrs.class ?? "").split(/\s+/).filter(Boolean);
        const scopes = classes.flatMap((c) => [
          ...(rules.byScope.get(c) ?? []),
        ]);
        const medias = classes.flatMap((c) => [
          ...(rules.byMedia.get(c) ?? []),
        ]);
        const bands = utilityHiddenBands(classes);
        const all =
          "hidden" in attrs ||
          attrs["aria-hidden"] === "true" ||
          /display\s*:\s*none/i.test(attrs.style ?? "") ||
          bands.length === SCREENS.length;
        stack.push({
          name,
          hidden:
            all || scopes.length > 0 || medias.length > 0 || bands.length > 0
              ? {
                  all: parent.all || all,
                  scopes: new Set([...parent.scopes, ...scopes]),
                  medias: new Set([...parent.medias, ...medias]),
                  bands: new Set([...parent.bands, ...bands]),
                }
              : parent,
        });
      },
      ontext(text) {
        if (skip > 0) return;
        buf.push(text);
        if (!bufHidden && text.trim()) bufHidden = stack.at(-1)?.hidden ?? none;
      },
      onclosetag(name) {
        if (SKIP.has(name)) skip = Math.max(0, skip - 1);
        if (BLOCK.has(name)) flush();
        const at = stack.map((e) => e.name).lastIndexOf(name);
        if (at >= 0) stack.length = at;
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  flush();
  return blocks;
}

/**
 * Layouts to count copies in: each scope of a layout family (the page is in
 * exactly one), crossed with each `@media` layout (two or more queries are
 * taken to split the screens; one query also leaves the screens outside it),
 * crossed with each breakpoint band when a block is utility-hidden in one.
 */
function layouts(rules: LayoutRules, banded: boolean) {
  const scopes = rules.scopes.length > 0 ? rules.scopes : [null];
  const medias =
    rules.medias.length >= 2
      ? rules.medias
      : rules.medias.length === 1
        ? [rules.medias[0], null]
        : [null];
  const screens = banded ? SCREENS : [null];
  return scopes.flatMap((scope) =>
    medias.flatMap((media) =>
      screens.map((screen) => ({ scope, media, screen })),
    ),
  );
}

/** 128 MinHash values over 5-word shingles; empty text → []. */
function minhashSignature(text: string): number[] {
  const w = words(text);
  if (w.length === 0) return [];
  const sig = Array.from({ length: PERMUTATIONS }, () => 0xffffffff);
  const n = Math.max(1, w.length - SHINGLE + 1);
  for (let s = 0; s < n; s += 1) {
    const h = fnv1a(w.slice(s, s + SHINGLE).join(" "));
    for (let i = 0; i < PERMUTATIONS; i += 1) {
      const v = (Math.imul(A[i], h) + B[i]) >>> 0;
      if (v < sig[i]) sig[i] = v;
    }
  }
  return sig;
}

/** Jaccard estimate: share of equal signature values. */
export function estimateJaccard(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== PERMUTATIONS || b.length !== PERMUTATIONS) return 0;
  let same = 0;
  for (let i = 0; i < PERMUTATIONS; i += 1) if (a[i] === b[i]) same += 1;
  return same / PERMUTATIONS;
}

/** Index pairs sharing ≥ 1 LSH band, verified at `threshold`. */
export function similarPairs(
  signatures: ReadonlyArray<readonly number[]>,
  threshold: number,
): Array<{ a: number; b: number; jaccard: number }> {
  const n = signatures.length;
  const seen = new Set<number>();
  const out: Array<{ a: number; b: number; jaccard: number }> = [];
  const addPairs = (members: readonly number[]) => {
    for (let x = 0; x < members.length; x += 1)
      for (let y = x + 1; y < members.length; y += 1) {
        const [a, b] = [members[x], members[y]];
        if (seen.has(a * n + b)) continue;
        seen.add(a * n + b);
        const jaccard = estimateJaccard(signatures[a], signatures[b]);
        if (jaccard >= threshold) out.push({ a, b, jaccard });
      }
  };
  for (let band = 0; band < BANDS; band += 1) {
    const buckets = new Map<string, number[]>();
    signatures.forEach((sig, i) => {
      if (sig.length !== PERMUTATIONS) return;
      const key = sig.slice(band * ROWS, band * ROWS + ROWS).join(",");
      const list = buckets.get(key);
      if (list) list.push(i);
      else buckets.set(key, [i]);
    });
    for (const members of buckets.values()) addPairs(members);
  }
  return out;
}

/**
 * Main-text facts per page, computed while the body is in memory;
 * `blocks` (`pageBlocks`) feed the SUPP-17 sentence hashes (ADR-022).
 */
export function mainTextFacts(html: string, blocks: readonly string[] = []) {
  const rules = layoutRules(html);
  const main = mainTextBlocks(html, rules);
  // mainWords and the minhash keep every copy (near-duplicate / thin pages).
  const text = main.map((b) => b.text).join(" ");
  // SUPP-03: a block repeats when ≥ 2 copies are visible in one layout.
  const counts = new Map<string, number>();
  const banded = main.some((b) => b.hidden.bands.size > 0);
  for (const { scope, media, screen } of layouts(rules, banded)) {
    const here = new Map<string, number>();
    for (const { text: block, hidden } of main) {
      if (hidden.all) continue;
      if (scope && hidden.scopes.has(scope)) continue;
      if (media && hidden.medias.has(media)) continue;
      if (screen && hidden.bands.has(screen)) continue;
      if (words(block).length < BLOCK_MIN_WORDS) continue;
      here.set(block, (here.get(block) ?? 0) + 1);
    }
    for (const [block, n] of here)
      counts.set(block, Math.max(counts.get(block) ?? 0, n));
  }
  return {
    mainWords: words(text).length,
    minhash: minhashSignature(text),
    duplicateBlocks: [...counts]
      .filter(([, count]) => count >= 2)
      .map(([block, count]) => ({
        text: block.slice(0, BLOCK_TEXT_MAX),
        count,
      })),
    sentenceHashes: sentenceHashes(blocks),
  };
}

/** SUPP-17 sentence: ≥ 20 chars, lower-cased; ≤ 400 per page (ADR-022). */
const SENTENCE_MIN_CHARS = 20;
const SENTENCE_HASHES_MAX = 400;

/** FNV-1a hashes of the unique sentences of a page's blocks, document order. */
function sentenceHashes(blocks: readonly string[]): number[] {
  const seen = new Set<number>();
  for (const block of blocks)
    for (const part of block.split(/(?<=[.!?])\s+/)) {
      const sentence = part.trim().toLowerCase();
      if (sentence.length < SENTENCE_MIN_CHARS) continue;
      seen.add(fnv1a(sentence));
      if (seen.size >= SENTENCE_HASHES_MAX) return [...seen];
    }
  return [...seen];
}
