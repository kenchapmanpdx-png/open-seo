import type { CheckContext } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import type {
  FactRef,
  SiteFactMap,
} from "@/server/features/handbook/contracts/site-fact-map";
import { normalizeUrl } from "./support";

/**
 * WO-B9-017 judge views (FULL-READ §5.4). With a K15 SiteFactMap (full read:
 * the map stage ran), LLM checks get targeted views — candidate pages named
 * by the fact map plus counter-examples, or every page's head lines — not
 * the first-8 sample. Without one (quick) the checks keep their old views.
 * Leaf module: llm-copy / llm-content / llm-templates import from here.
 */

export type View = { url: string; text: string };

export function htmlPages(ctx: CheckContext): PageSnapshot[] {
  const pages = ctx.collected.pages;
  if (pages.status !== "ok") return [];
  return pages.snapshots.filter(
    (s) => s.status === 200 && (s.contentType ?? "").includes("html"),
  );
}

export function headLines(s: PageSnapshot): string {
  return [
    `Title: ${s.head.title ?? "(none)"}`,
    `Meta description: ${s.head.metaDescription ?? "(none)"}`,
    `H1: ${s.h1.length > 0 ? s.h1.join(" | ") : "(none)"}`,
  ].join("\n");
}

/** Visible text from the first H1 on (skips header navigation). */
export function mainText(s: PageSnapshot, chars: number): string {
  const h1 = s.h1[0];
  const at = h1 ? s.markup.text.indexOf(h1) : -1;
  return s.markup.text.slice(Math.max(at, 0), Math.max(at, 0) + chars);
}

/** Head-line items (P4-02, P4-07) read every page in one call; cap keeps the prompt bounded. */
export const MAX_HEAD_LINE_PAGES = 300;

/** Every page's title, meta description and H1 (P4-02 / P4-07 full read). */
export function headLineViews(pages: readonly PageSnapshot[]): View[] {
  return pages
    .slice(0, MAX_HEAD_LINE_PAGES)
    .map((p) => ({ url: p.url, text: headLines(p) }));
}

/** Verbatim fact-map quotes per normalized page url. */
function quotesByUrl(refs: readonly FactRef[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of refs) {
    const key = normalizeUrl(r.url);
    const list = out.get(key) ?? [];
    if (!list.includes(r.quote)) list.push(r.quote);
    out.set(key, list);
  }
  return out;
}

const quoteBlock = (label: string, quotes: readonly string[] | undefined) =>
  quotes && quotes.length > 0
    ? `\n\n${label}:\n${quotes.map((q) => `- ${q}`).join("\n")}`
    : "";

/**
 * P5-04: pages the fact map flags (superlatives, placeholders, undefined
 * acronyms), most hits first, each with its text and the flagged verbatim
 * quotes; plus up to two clean pages (home first) as counter-examples.
 */
export function inventoryViews(
  ctx: CheckContext,
  map: SiteFactMap,
  max = 16,
): View[] {
  const quotes = quotesByUrl(
    [...map.superlatives, ...map.placeholders, ...map.undefinedAcronyms]
      .flatMap((i) => i.refs)
      .filter((r) => r.source === "page" || r.source === "template"),
  );
  const pages = htmlPages(ctx);
  const hits = (p: PageSnapshot) =>
    quotes.get(normalizeUrl(p.url))?.length ?? 0;
  const flagged = pages.filter((p) => hits(p) > 0);
  flagged.sort((a, b) => hits(b) - hits(a));
  const home = normalizeUrl(new URL("/", ctx.origin).href);
  const clean = pages.filter((p) => hits(p) === 0);
  clean.sort(
    (a, b) =>
      Number(normalizeUrl(b.url) === home) -
      Number(normalizeUrl(a.url) === home),
  );
  return [...flagged.slice(0, max), ...clean.slice(0, 2)].map((p) => ({
    url: p.url,
    text:
      p.markup.text.slice(0, 6_000) +
      quoteBlock(
        "Flagged by extraction (verbatim)",
        quotes.get(normalizeUrl(p.url)),
      ),
  }));
}

/** Image names and alts that look like awards, press, certifications or trust/compliance badges. */
export const AWARD_WORD =
  /award|badge|certif|accredit|winner|best[\s_-]?of|press|featured|as[\s_-]seen|voted|top[\s_-]?\d+/i;
const BADGE_WORD =
  /complian|hipaa|gdpr|soc[\s_-]?2|iso[\s_-]?\d{4,5}|pci|ssl|secur|seal|trust|verified|licens|insured|bonded|bbb|member/i;

/** Lower-cased words of an image file name ("trust-hipaa-compliant.png" → "trust hipaa compliant"). */
function fileWords(src: string): string {
  const name = src.split(/[?#]/)[0].split("/").at(-1) ?? "";
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_.]+/g, " ");
}

const orNone = (lines: string[]) => (lines.length > 0 ? lines : ["(none)"]);

/**
 * P5-11: per page, award / badge images (alt + file name, incl. compliance
 * badges), the fact map's award quotes and award-like links. Pages with
 * neither an image nor an award quote are left out.
 */
export function awardViews(ctx: CheckContext, map: SiteFactMap): View[] {
  const quotes = quotesByUrl(
    map.awards.flatMap((a) => a.refs).filter((r) => r.source === "page"),
  );
  return htmlPages(ctx).flatMap((p) => {
    const images = p.images
      .filter((i) => {
        const words = `${i.alt ?? ""} ${fileWords(i.src)}`;
        return AWARD_WORD.test(words) || BADGE_WORD.test(words);
      })
      .slice(0, 12)
      .map(
        (i) =>
          `- image alt="${i.alt ?? ""}" src="${i.src}" (file: ${fileWords(i.src)})`,
      );
    const claims = (quotes.get(normalizeUrl(p.url)) ?? []).slice(0, 12);
    if (images.length === 0 && claims.length === 0) return [];
    const links = p.links
      .filter((l) => AWARD_WORD.test(`${l.text} ${l.href}`))
      .slice(0, 8)
      .map((l) => `- link "${l.text}" → ${l.href}`);
    return [
      {
        url: p.url,
        text: [
          "Award-like images:",
          ...orNone(images),
          "Award-like text:",
          ...orNone(claims.map((q) => `- ${q}`)),
          "Award-like links:",
          ...orNone(links),
        ].join("\n"),
      },
    ];
  });
}

export type DetailGroup = {
  pattern: string;
  pages: readonly PageSnapshot[];
  ratios: readonly number[];
};

/**
 * P5-15: every detail page's word count, key-facts block and shared-sentence
 * ratio in `facts`, plus the fact map's thin-page list; views are the
 * thinnest pages (head lines + opening main text).
 */
export function keyFactsViews(
  ctx: CheckContext,
  map: SiteFactMap,
  groups: readonly DetailGroup[],
  max = 12,
): { views: View[]; detailPages: Record<string, unknown>[] } {
  const keyFacts = new Map(
    (ctx.pageProfiles ?? [])
      .filter((p) => p.scope === "page")
      .map((p) => [normalizeUrl(p.url), p.keyFactsBlock?.text ?? null]),
  );
  const rows = groups.flatMap((g) =>
    g.pages.map((p, i) => ({
      page: p,
      row: {
        url: p.url,
        template: g.pattern,
        words: p.mainWords ?? p.wordsRaw,
        tables: p.markup.counts.tables,
        lists: p.markup.counts.lists,
        sharedSentenceRatio: g.ratios[i],
        keyFactsBlock: keyFacts.get(normalizeUrl(p.url)) ?? null,
      },
    })),
  );
  const listed = new Set(rows.map((r) => normalizeUrl(r.page.url)));
  const byUrl = new Map(htmlPages(ctx).map((p) => [normalizeUrl(p.url), p]));
  for (const t of map.thinPages) {
    const page = byUrl.get(normalizeUrl(t.url));
    if (!page || listed.has(normalizeUrl(t.url))) continue;
    rows.push({
      page,
      row: {
        url: page.url,
        template: "thin page",
        words: t.words,
        tables: page.markup.counts.tables,
        lists: page.markup.counts.lists,
        sharedSentenceRatio: 0,
        keyFactsBlock: keyFacts.get(normalizeUrl(t.url)) ?? null,
      },
    });
  }
  const thinnest = [...rows];
  thinnest.sort((a, b) => a.row.words - b.row.words);
  return {
    views: thinnest.slice(0, max).map(({ page }) => ({
      url: page.url,
      text: `${headLines(page)}\n\n${mainText(page, 1_500)}`,
    })),
    detailPages: rows.map((r) => r.row),
  };
}

/** Append fact-map quotes (stat conflicts, name variants) to views; add views for pages not yet in them. */
export function withFactQuotes(
  views: readonly View[],
  refs: readonly FactRef[],
  label: string,
): View[] {
  const quotes = quotesByUrl(refs);
  const out = views.map((v) => ({
    url: v.url,
    text: v.text + quoteBlock(label, quotes.get(normalizeUrl(v.url))),
  }));
  const seen = new Set(views.map((v) => normalizeUrl(v.url)));
  for (const [url, list] of quotes)
    if (!seen.has(url))
      out.push({
        url: refs.find((r) => normalizeUrl(r.url) === url)?.url ?? url,
        text: quoteBlock(label, list).trimStart(),
      });
  return out;
}
