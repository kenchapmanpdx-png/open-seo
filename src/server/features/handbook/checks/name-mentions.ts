import type { CheckContext } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { normalizeUrl, siteUrl } from "./support";

/**
 * WO-B4-004 (P5-07 entity test): body-text spellings of the brand and of
 * JSON-LD event/person names, so the judge sees "WHY Racing" next to
 * "Why Racing" instead of only titles and H1s.
 */

const ORG_TYPE = /Organization$|Business$|^(?:Corporation|NGO|Store|Shop)$/;
const NAMED_TYPE = /^(?:Event|SportsEvent|Person)$/;
const MAX_MENTIONS = 60;
const PER_FORM = 3;

/** Brand (Organization.name, og:site_name, title tail) + JSON-LD event/person names. */
function entityNames(ctx: CheckContext, home: PageSnapshot | undefined) {
  const names = new Set<string>();
  const jsonld = ctx.collected.jsonld;
  const nodes =
    jsonld.status === "ok" ? jsonld.pages.flatMap((p) => p.nodes) : [];
  for (const n of nodes) {
    const name = n.properties.name;
    if (
      typeof name === "string" &&
      n.types.some((t) => ORG_TYPE.test(t) || NAMED_TYPE.test(t))
    )
      names.add(name.trim());
  }
  const siteName = home?.head.og["og:site_name"] ?? home?.head.og.site_name;
  if (siteName) names.add(siteName.trim());
  const tail = home?.head.title
    ?.split(/\s[|–—-]\s/)
    .at(-1)
    ?.trim();
  if (tail) names.add(tail);
  return [...names].filter((n) => n.length >= 3).slice(0, 15);
}

/** Short (acronym-like) words may be written with dots: W.H.Y. */
const wordPattern = (w: string) =>
  w.length <= 4 ? Array.from(w).join("\\.?") : w;

/**
 * Spelling variants of a name: any case, optional spacing/punctuation between
 * words, "&" or "and". Words keep letters/digits only, so need no escaping.
 */
function variantPattern(name: string): RegExp | null {
  const words = name
    .split(/[\s\-_.&,]+/)
    .filter((w) => w && !/^and$/i.test(w))
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${words.map(wordPattern).join("[\\s\\-_.]*(?:&|and)?[\\s\\-_.]*")}(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

type Hit = { url: string; line: string };

/** Spellings of one name across pages; a single word must start upper-case ("why" is not a mention). */
function collect(
  name: string,
  pages: readonly PageSnapshot[],
  byForm: Map<string, Hit[]>,
) {
  const pattern = variantPattern(name);
  if (!pattern) return;
  const single = !/\s/.test(name.trim());
  for (const p of pages) {
    const sentences = p.markup.text
      .split(/(?<=[.!?])\s+|\n+/)
      .filter((t) => t.length <= 300);
    for (const sentence of sentences) {
      const forms = [...sentence.matchAll(pattern)]
        .map((m) => m[0])
        .filter((f) => !single || /^\p{Lu}/u.test(f));
      for (const form of forms) {
        const list = byForm.get(form) ?? [];
        if (list.length < PER_FORM && !list.some((l) => l.url === p.url))
          list.push({ url: p.url, line: sentence.trim() });
        byForm.set(form, list);
      }
    }
  }
}

/** Mention lines per page URL, ≤ 60, every distinct spelling before repeats. */
export function nameMentions(
  ctx: CheckContext,
  pages: readonly PageSnapshot[],
): Map<string, string[]> {
  const home = pages.find(
    (p) => normalizeUrl(p.url) === normalizeUrl(siteUrl(ctx.origin)),
  );
  const byForm = new Map<string, Hit[]>();
  for (const name of entityNames(ctx, home)) collect(name, pages, byForm);
  const out = new Map<string, string[]>();
  const lists = [...byForm.values()];
  let added = 0;
  for (let round = 0; round < PER_FORM; round++)
    for (const hit of lists.map((l) => l[round])) {
      if (!hit || added >= MAX_MENTIONS) continue;
      out.set(hit.url, [...(out.get(hit.url) ?? []), hit.line]);
      added += 1;
    }
  return out;
}
