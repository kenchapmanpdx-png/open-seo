import { Parser } from "htmlparser2";

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

/** Main-text blocks of raw HTML, whitespace collapsed, empty blocks dropped. */
function mainTextBlocks(html: string): string[] {
  const blocks: string[] = [];
  let buf: string[] = [];
  let skip = 0;
  const flush = () => {
    const text = buf.join("").replace(/\s+/g, " ").trim();
    if (text) blocks.push(text);
    buf = [];
  };
  const parser = new Parser(
    {
      onopentag(name) {
        if (BLOCK.has(name)) flush();
        if (SKIP.has(name)) skip += 1;
      },
      ontext(text) {
        if (skip === 0) buf.push(text);
      },
      onclosetag(name) {
        if (SKIP.has(name)) skip = Math.max(0, skip - 1);
        if (BLOCK.has(name)) flush();
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  flush();
  return blocks;
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
  const main = mainTextBlocks(html);
  const text = main.join(" ");
  const counts = new Map<string, number>();
  for (const block of main) {
    if (words(block).length < BLOCK_MIN_WORDS) continue;
    counts.set(block, (counts.get(block) ?? 0) + 1);
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
