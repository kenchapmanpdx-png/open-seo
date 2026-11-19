import type {
  LlmsData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import type { FactRef } from "@/server/features/handbook/contracts/site-fact-map";
import { sort } from "remeda";
import { normalizeUrl } from "../checks/support";

/**
 * Reduce helpers (ADR-019): list counts from llms.txt sections and hub
 * pages, and stated counts ("21 annual events") found in page text.
 */
const MAX_QUOTE = 300;

export const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
};
const NUMBER_WORD = Object.keys(NUMBER_WORDS).join("|");
export const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "our",
  "total",
  "all",
  "in",
]);

export const singular = (word: string) =>
  word.endsWith("ies") && word.length > 4
    ? `${word.slice(0, -3)}y`
    : /[^s]s$/.test(word) && word.length > 3
      ? word.slice(0, -1)
      : word;

const clipQuote = (s: string) =>
  s.replace(/\s+/g, " ").trim().slice(0, MAX_QUOTE);

export type Claim = { value: string; ref: FactRef };

type Lists = {
  noun: string;
  count: number;
  ref: FactRef;
  children: string[];
};

/** `## Events` sections of llms.txt: entries are `- [` lines. */
export function llmsLists(llms: LlmsData | null): Lists[] {
  const out: Lists[] = [];
  for (const file of llms?.files ?? []) {
    if (file.status !== 200 || !file.text) continue;
    let current: Lists | null = null;
    for (const line of file.text.split("\n")) {
      const heading = /^##\s+(.+?)\s*$/.exec(line);
      if (heading?.[1]) {
        const last = heading[1].toLowerCase().split(/\s+/).at(-1) ?? "";
        current = {
          noun: singular(last.replace(/[^a-z]/g, "")),
          count: 0,
          ref: { url: file.url, source: "llmsTxt", quote: line.trim() },
          children: [],
        };
        out.push(current);
      } else if (current && /^\s*[-*]\s+\[/.test(line)) current.count += 1;
    }
  }
  return out.filter((l) => l.count > 0 && l.noun);
}

export const live = (s: PageSnapshot) =>
  s.status === 200 && /html/i.test(s.contentType ?? "html");

const dirOf = (url: string) => {
  const path = new URL(url).pathname.replace(/index\.html?$/i, "");
  return path.endsWith("/") ? path : null;
};

/** Hub = a directory page linking ≥ 2 crawled pages one level below it. */
export function hubs(pages: readonly PageSnapshot[]): Lists[] {
  const crawled = new Map(
    pages.filter(live).map((p) => [normalizeUrl(p.finalUrl), p]),
  );
  const out: Lists[] = [];
  for (const page of crawled.values()) {
    const dir = dirOf(page.finalUrl);
    if (!dir || dir === "/") continue;
    const children = new Set<string>();
    for (const link of page.links) {
      let target: URL;
      try {
        target = new URL(link.href, page.finalUrl);
      } catch {
        continue;
      }
      const rest = target.pathname.slice(dir.length).replace(/\/$/, "");
      if (
        target.origin !== new URL(page.finalUrl).origin ||
        !target.pathname.startsWith(dir) ||
        !rest ||
        rest.includes("/") ||
        /^index\.html?$/i.test(rest)
      )
        continue;
      const child = crawled.get(normalizeUrl(target.href));
      if (child) children.add(child.finalUrl);
    }
    if (children.size < 2) continue;
    const segment = dir.split("/").filter(Boolean).at(-1) ?? "";
    out.push({
      noun: singular(segment.toLowerCase().replace(/[^a-z]/g, "")),
      count: children.size,
      ref: {
        url: page.finalUrl,
        source: "page",
        quote: clipQuote(page.h1[0] ?? page.head.title ?? dir),
      },
      children: sort([...children], (a, b) => a.localeCompare(b)),
    });
  }
  return out;
}

/** A preposition between number and noun: "14 produced by X Events" is not a count of events. */
const LINKING = /\b(by|from|with|for|of|to|at|per|in|on|than)\b/i;

/** "21 annual events", "20+ events", "View all 18 races", "lists six events". */
export function countClaims(
  text: string,
  noun: string,
  ref: Omit<FactRef, "quote">,
): Claim[] {
  const plural = noun.endsWith("y")
    ? `${noun.slice(0, -1)}(?:y|ies)`
    : `${noun}s?`;
  const re = new RegExp(
    `\\b(\\d{1,4}|${NUMBER_WORD})(\\+)?\\s+((?:[a-z'-]+,?\\s+){0,5})${plural}\\b`,
    "gi",
  );
  const out: Claim[] = [];
  for (const line of text.split(/\n+/)) {
    if (/^\s*[-*]\s+\[/.test(line)) continue; // the list's own entries
    for (const m of line.matchAll(re)) {
      const [, num = "", plus = "", words = ""] = m;
      if (/^(19|20)\d{2}$/.test(num) || /\d/.test(words) || LINKING.test(words))
        continue;
      const at = m.index ?? 0;
      const start = Math.max(0, line.lastIndexOf(". ", at) + 1);
      const stop = line.indexOf(". ", at + m[0].length);
      const sentence = line.slice(start, stop < 0 ? undefined : stop + 1);
      const quote = clipQuote(sentence.replace(/^\s*[>#*-]+\s*/, ""));
      out.push({ value: `${num}${plus}`, ref: { ...ref, quote } });
    }
  }
  return out;
}
