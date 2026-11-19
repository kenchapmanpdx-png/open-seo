/**
 * SUPP-04 numeric parity (ADR-021, FULL-READ §3.4): numbers a script rewrites
 * after load. Raw and rendered visible text are tokenized; numeric tokens are
 * aligned by their surrounding ±3 tokens (other numbers masked) and paired in
 * order of appearance. Only the counter class is reported: the raw value is a
 * zero-like placeholder (`0`, `$0`, `0%`, `0+`, `0.00`) and the rendered
 * value at the same position is non-zero. Dates, clocks and any other
 * number that changes between fetches never match the placeholder test.
 */

import { sort } from "remeda";

export type NumericMismatch = {
  raw: string;
  rendered: string;
  context: string;
};

const WINDOW = 3;
/** Pairs kept per page (the check prints ≤ 10). */
const MAX_PAIRS = 20;
const TOKEN = /\d+(?:[.,]\d+)*|\p{L}+|[$€£%+/]/gu;
const ZERO_LIKE = /^0(?:[.,]0+)?$/;
/** Any spelling of zero, so `0` → `00` is not a mismatch. */
const ZERO = /^0+(?:[.,]0+)?$/;
const CURRENCY = new Set(["$", "€", "£"]);

const isNumber = (t: string) => /^\d/.test(t);

function tokenize(text: string): string[] {
  return (text.match(TOKEN) ?? []).map((t) => t.toLowerCase());
}

/** Neighbours of token `i`, numbers masked so adjacent counters share a key. */
function contextKey(tokens: readonly string[], i: number): string {
  const side = (from: number, to: number) =>
    tokens
      .slice(Math.max(0, from), Math.max(0, to))
      .map((t) => (isNumber(t) ? "#" : t))
      .join(" ");
  return `${side(i - WINDOW, i)} | ${side(i + 1, i + 1 + WINDOW)}`;
}

/** The number with its currency prefix and unit suffix: `$ 0 /mo`, `0 %`, `84 mo`. */
function display(tokens: readonly string[], i: number): string {
  const parts: string[] = [];
  if (CURRENCY.has(tokens[i - 1] ?? "")) parts.push(tokens[i - 1]);
  parts.push(tokens[i]);
  const next = tokens[i + 1];
  if (next === "/" && tokens[i + 2] && !isNumber(tokens[i + 2]))
    parts.push(`/${tokens[i + 2]}`);
  else if (next && !isNumber(next)) parts.push(next);
  return parts.join(" ");
}

function numbersByContext(tokens: readonly string[]) {
  const byKey = new Map<string, number[]>();
  tokens.forEach((t, i) => {
    if (!isNumber(t)) return;
    const key = contextKey(tokens, i);
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  });
  return byKey;
}

export function numericMismatches(
  rawText: string,
  renderedText: string,
): NumericMismatch[] {
  const raw = tokenize(rawText);
  const rendered = tokenize(renderedText);
  const renderedByKey = numbersByContext(rendered);
  const out: Array<NumericMismatch & { at: number }> = [];
  for (const [key, rawAt] of numbersByContext(raw)) {
    const renderedAt = renderedByKey.get(key) ?? [];
    rawAt.forEach((i, n) => {
      const j = renderedAt[n];
      if (j === undefined || !ZERO_LIKE.test(raw[i])) return;
      if (ZERO.test(rendered[j])) return;
      out.push({
        at: i,
        raw: display(raw, i),
        rendered: display(rendered, j),
        context: [
          raw.slice(Math.max(0, i - WINDOW), i).join(" "),
          raw.slice(i + 1, i + 1 + WINDOW).join(" "),
        ].join(" … "),
      });
    });
  }
  return sort(out, (a, b) => a.at - b.at)
    .slice(0, MAX_PAIRS)
    .map((m) => ({ raw: m.raw, rendered: m.rendered, context: m.context }));
}
