import type { CopyMetric, CopyMetricId } from "../contracts/scaled-copy";

/**
 * Copy-quality metrics (fork/SCALED-COPY.md §4.2–4.3, ADR-023). Pure: no I/O,
 * no clock. Input = main-content `<p>` text with the index of the preceding
 * H2 (−1 before the first). Not scored; thresholds and word lists are the
 * §4.3 table copied verbatim, changed only via MAINTENANCE M4.
 *
 * Literal readings where §4.3 is loose (recorded in fork/reports/B11.md):
 * - Word = letters with inner `'` / `-`; numbers are never words, so every
 *   rate uses letter words (§4.2 says "not words for E4, E5"; one count keeps
 *   rates comparable). Curly apostrophes count as `'`.
 * - Proper noun: `I` and its contractions (`I'm`, `I've`, `I'd`, `I'll`) are excluded.
 * - Sentences never cross paragraphs; a paragraph end closes a sentence.
 * - E7a `is more than a <word>` also matches `an`. E7a / E7b patterns with
 *   `…` match within one sentence. Overlapping patterns each count.
 * - E9: `A, B, and C` with B and C each 1–4 words (A is bounded by the regex
 *   start, so ≤ 4 words always holds); only `and`.
 * - E13: windows [s, s + 300) for s = 0, 50, … while s + 300 ≤ words; a
 *   window holds every sentence with a word in it; population SD;
 *   value = lowest window SD.
 * - E6b / E5: share as a ratio 0–1 (threshold text keeps `%`). E6b sections =
 *   paragraphs grouped by H2 index ≥ 0; no H2 section with ≥ 50 words → null.
 * - E17: value 1 = yes, 0 = no.
 * - HB5 inflections use English spelling (`leveraged`, `harnesses`, `transforming`).
 * Values are rounded to 2 decimals; `over` uses the unrounded value.
 */

export type Paragraph = { h2: number; text: string };

const WORD = /\p{L}+(?:['-]\p{L}+)*/gu;
const NUMBER = /\d+(?:[.,:/-]\d+)*%?/g;
const ABBREVIATIONS = new Set([
  "e.g.",
  "i.e.",
  "vs.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Inc.",
  "Ltd.",
  "Co.",
  "U.S.",
  "No.",
]);
const FIRST_PERSON = new Set(["I", "I'm", "I've", "I'd", "I'll"]);

const THRESHOLDS: Record<CopyMetricId, string | null> = {
  E7a: "> 0",
  E7b: "> 1 for any one",
  E9: "> 1",
  E13: "any window < 8",
  E6a: "< 1",
  E6b: "< 100 %",
  E17: "no",
  E19: "> 0",
  E16: "> 0",
  E4: "> 5.0",
  E5: null,
  E8: "> 0",
  HB5: "> 0",
  E11: "> 2",
  E10: null,
  E15: null,
  E12: "> 3",
};

const E7A = [
  /\bthis matters\b/g,
  /\bwhy(?: [\p{L}'-]+){1,3} matters\b/gu,
  /\bis more than an? [\p{L}'-]+/gu,
  /\brather than simply\b/g,
];
const E7B = [
  /\bnot just\b/g,
  /\bnot simply\b/g,
  /\bnot only\b[^.?!\n]*?\bbut\b/g,
  /\bless like\b[^.?!\n]*?\band more like\b/g,
  /\bis not just an?\b[^.?!\n]*?\bit is\b/g,
  /\bthe\b[^.?!\n]*?\bis not simply\b/g,
  /\bmatters because\b/g,
  /\bjust as important\b/g,
];
const LIST_ITEM = "[\\p{L}\\d'-]+(?: [\\p{L}\\d'-]+){0,3}";
const E9 = new RegExp(`${LIST_ITEM}, ${LIST_ITEM},? and ${LIST_ITEM}\\b`, "gu");
const E19 = [
  /\byou might be wondering\b/g,
  /\byou may be wondering\b/g,
  /\byou're probably wondering\b/g,
];
const E8_WORDS = [
  "absolutely",
  "entirely",
  "highly",
  "incredibly",
  "furthermore",
  "dependable",
  "meaningful",
  "thoughtful",
  "crucial",
  "testament",
  "vibrant",
  "significantly",
];
const HB5_STEMS = [
  "discover",
  "unlock",
  "harness",
  "leverage",
  "empower",
  "transform",
  "revolutionize",
  "seamless",
  "robust",
];
const E11_PHRASES = [
  "however",
  "moreover",
  "furthermore",
  "additionally",
  "therefore",
  "consequently",
  "nevertheless",
  "nonetheless",
  "thus",
  "hence",
  "meanwhile",
  "ultimately",
  "overall",
  "indeed",
  "in addition",
  "in conclusion",
  "on the other hand",
  "as a result",
];
const E10_WORDS = ["may", "might", "could"];
const E13_WINDOW = 300;
const E13_STEP = 50;
const E6B_MIN_WORDS = 50;
const HB5_LEAD_WORDS = 200;

const normalize = (text: string) => text.replace(/[‘’]/g, "'");
const words = (text: string) => normalize(text).match(WORD) ?? [];
const countMatches = (text: string, re: RegExp) =>
  (text.match(re) ?? []).length;
const hasNumber = (text: string) => /\d/.test(text);
const round = (n: number) => Math.round(n * 100) / 100;
const per = (count: number, total: number, unit: number) =>
  total === 0 ? 0 : (count * unit) / total;

/** Whole-word, case-insensitive count of each phrase in `text`. */
function phraseCounts(text: string, phrases: string[]) {
  const lower = normalize(text).toLowerCase();
  return phrases.map((p) =>
    countMatches(lower, new RegExp(`\\b${p.replace(/ /g, "\\s+")}\\b`, "g")),
  );
}

/** Sentences of one paragraph (§4.2 split rule and abbreviations). */
function sentences(paragraph: string): string[] {
  const text = normalize(paragraph).trim();
  const out: string[] = [];
  const boundary = /[.?!]+\s+(?=[\p{Lu}\d"'“])/gu;
  let start = 0;
  for (const m of text.matchAll(boundary)) {
    const end = m.index + m[0].trimEnd().length;
    const lastToken = text.slice(start, end).split(/\s+/).at(-1) ?? "";
    if (ABBREVIATIONS.has(lastToken)) continue;
    out.push(text.slice(start, end));
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push(text.slice(start));
  return out.filter((s) => s.trim() !== "");
}

function properNounCount(paragraph: string) {
  let count = 0;
  for (const sentence of sentences(paragraph)) {
    for (const word of words(sentence).slice(1)) {
      if (/^\p{Lu}/u.test(word) && !FIRST_PERSON.has(word)) count++;
    }
  }
  return count;
}

function hb5Forms(stem: string) {
  if (stem.endsWith("e")) {
    const base = stem.slice(0, -1);
    return [stem, `${stem}s`, `${stem}d`, `${base}ing`];
  }
  const plural = stem.endsWith("s") ? `${stem}es` : `${stem}s`;
  return [stem, plural, `${stem}ed`, `${stem}ing`];
}

type Measured = { value: number | null; over: boolean };
type Ctx = {
  prose: Paragraph[];
  joined: string;
  words: string[];
  wordCount: number;
};

const count = (value: number): Measured => ({ value, over: value > 0 });

function e7a(c: Ctx): Measured {
  const lower = c.joined.toLowerCase();
  return count(E7A.reduce((n, re) => n + countMatches(lower, re), 0));
}

function e7b(c: Ctx): Measured {
  const lower = c.joined.toLowerCase();
  const rates = E7B.map((re) => per(countMatches(lower, re), c.wordCount, 500));
  const value = Math.max(...rates);
  return { value, over: rates.some((r) => r > 1) };
}

function e9(c: Ctx): Measured {
  const value = per(countMatches(c.joined, E9), c.wordCount, 500);
  return { value, over: value > 1 };
}

function e13(c: Ctx): Measured {
  if (c.wordCount < E13_WINDOW) return { value: null, over: false };
  const spans: { start: number; length: number }[] = [];
  let position = 0;
  for (const p of c.prose) {
    for (const s of sentences(p.text)) {
      const length = words(s).length;
      if (length === 0) continue;
      spans.push({ start: position, length });
      position += length;
    }
  }
  let lowest = Number.POSITIVE_INFINITY;
  for (let s = 0; s + E13_WINDOW <= position; s += E13_STEP) {
    const lengths = spans
      .filter((x) => x.start < s + E13_WINDOW && x.start + x.length > s)
      .map((x) => x.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
    lowest = Math.min(lowest, Math.sqrt(variance));
  }
  return { value: lowest, over: lowest < 8 };
}

function e6a(c: Ctx): Measured {
  const numbers = countMatches(c.joined, NUMBER);
  const nouns = c.prose.reduce((n, p) => n + properNounCount(p.text), 0);
  const value = per(numbers + nouns, c.wordCount, 150);
  return { value, over: value < 1 };
}

function e6b(c: Ctx): Measured {
  const sections = new Map<number, string[]>();
  for (const p of c.prose) {
    if (p.h2 < 0) continue;
    sections.set(p.h2, [...(sections.get(p.h2) ?? []), p.text]);
  }
  const eligible = [...sections.values()].filter(
    (texts) => texts.reduce((n, t) => n + words(t).length, 0) >= E6B_MIN_WORDS,
  );
  if (eligible.length === 0) return { value: null, over: false };
  const detailed = eligible.filter((texts) =>
    texts.some(
      (t) => hasNumber(t) || properNounCount(t) > 0 || /["“][^"”]+["”]/.test(t),
    ),
  );
  const value = detailed.length / eligible.length;
  return { value, over: value < 1 };
}

function e17(c: Ctx): Measured {
  const last = c.prose.at(-1)?.text ?? "";
  const yes = hasNumber(last) || properNounCount(last) > 0;
  return { value: yes ? 1 : 0, over: !yes };
}

function e19(c: Ctx): Measured {
  const lower = c.joined.toLowerCase();
  const phrases = E19.reduce((n, re) => n + countMatches(lower, re), 0);
  const first = c.prose.length > 0 ? (sentences(c.prose[0].text)[0] ?? "") : "";
  const opener = /^(?:Here's|Here is)\b/.test(first) ? 1 : 0;
  return count(phrases + opener);
}

function e16(c: Ctx): Measured {
  const value = c.prose.reduce(
    (n, p) =>
      n +
      countMatches(p.text, /\*\*[^*\n]+\*\*/g) +
      countMatches(p.text.trimStart(), /^#{1,6} /g) +
      countMatches(p.text, /\[[^\]\n]+\]\([^)\s]+\)/g),
    0,
  );
  return count(value);
}

function e4(c: Ctx): Measured {
  const chars = c.words.reduce((n, w) => n + w.length, 0);
  const value = c.wordCount === 0 ? 0 : chars / c.wordCount;
  return { value, over: value > 5.0 };
}

function e5(c: Ctx): Measured {
  const long = c.words.filter((w) => w.length >= 10).length;
  return { value: c.wordCount === 0 ? 0 : long / c.wordCount, over: false };
}

function e8(c: Ctx): Measured {
  return count(phraseCounts(c.joined, E8_WORDS).reduce((a, b) => a + b, 0));
}

function hb5(c: Ctx): Measured {
  const lead = c.words.slice(0, HB5_LEAD_WORDS).map((w) => w.toLowerCase());
  const forms = new Set(HB5_STEMS.flatMap(hb5Forms));
  return count(lead.filter((w) => forms.has(w)).length);
}

function e11(c: Ctx): Measured {
  const rates = phraseCounts(c.joined, E11_PHRASES).map((n) =>
    per(n, c.wordCount, 1000),
  );
  const value = Math.max(...rates);
  return { value, over: value > 2 };
}

function e10(c: Ctx): Measured {
  const n = phraseCounts(c.joined, E10_WORDS).reduce((a, b) => a + b, 0);
  return { value: per(n, c.wordCount, 1000), over: false };
}

function e15(c: Ctx): Measured {
  return { value: per(c.prose.length, c.wordCount, 500), over: false };
}

function e12(c: Ctx): Measured {
  const value = per(countMatches(c.joined, /—/g), c.wordCount, 1000);
  return { value, over: value > 3 };
}

const METRICS: [CopyMetricId, (c: Ctx) => Measured][] = [
  ["E7a", e7a],
  ["E7b", e7b],
  ["E9", e9],
  ["E13", e13],
  ["E6a", e6a],
  ["E6b", e6b],
  ["E17", e17],
  ["E19", e19],
  ["E16", e16],
  ["E4", e4],
  ["E5", e5],
  ["E8", e8],
  ["HB5", hb5],
  ["E11", e11],
  ["E10", e10],
  ["E15", e15],
  ["E12", e12],
];

/** Prose word count (letters with inner `'` / `-`; numbers excluded). */
export function proseWords(prose: Paragraph[]): number {
  return prose.reduce((n, p) => n + words(p.text).length, 0);
}

/** All 17 metrics in report order (§4.3). */
export function measureProse(prose: Paragraph[]): CopyMetric[] {
  const joined = normalize(prose.map((p) => p.text).join("\n"));
  const all = words(joined);
  const ctx: Ctx = { prose, joined, words: all, wordCount: all.length };
  return METRICS.map(([id, fn]) => {
    const { value, over } = fn(ctx);
    return {
      id,
      value: value === null ? null : round(value),
      threshold: THRESHOLDS[id],
      over,
    };
  });
}
