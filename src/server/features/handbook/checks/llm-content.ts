import type {
  CheckContext,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import {
  type View,
  SAMPLE_PAGES,
  headLines,
  htmlPages,
  judged,
  llmCheck,
  mainText,
  only,
  samplePages,
} from "./llm-copy";
import { AWARD_WORD, awardViews, keyFactsViews } from "./llm-views";
import { normalizeUrl } from "./support";

/**
 * WO-B4-001 LLM content checks (handbook §6, §7): page-type matrix (P5-06),
 * awards as text (P5-11), detail-page key facts (P5-15). Verdict mapping is
 * the shared `judged` one in llm-copy.ts.
 */

/** Paths of article-like templates, where article furniture belongs. */
const ARTICLE_PATH =
  /\/(?:blog|news|articles?|guides?|posts?|stories|insights|resources|journal|press)(?:\/|$)/i;

type Template = Extract<
  CheckContext["collected"]["templates"],
  { status: "ok" }
>["templates"][number];

function templates(ctx: CheckContext): readonly Template[] {
  const t = ctx.collected.templates;
  return t.status === "ok" ? t.templates : [];
}

/** ADR-006 detail clusters: `/parent/*` patterns with ≥ 3 URLs. */
export function detailTemplates(ctx: CheckContext): Template[] {
  const list = templates(ctx).filter(
    (t) =>
      t.urls.length >= 3 &&
      t.urlPattern !== "/*" &&
      t.urlPattern.endsWith("/*"),
  );
  list.sort((a, b) => b.urls.length - a.urls.length);
  return list;
}

const pageTypeMatrixCheck = llmCheck(
  "llm.page-type-matrix",
  {
    itemId: "P5-06",
    rubricId: "page-type-matrix",
    title: "Article furniture on home, service or product pages",
    fix: "Remove author bylines, 'key takeaways', citation lists and visible 'last updated' stamps from home, service, product, location and contact pages; keep them on articles and guides (§7).",
    effort: "S",
  },
  (ctx) => {
    const isArticle = (url: string) => ARTICLE_PATH.test(new URL(url).pathname);
    const views = samplePages(ctx, SAMPLE_PAGES * 2)
      .filter((s) => !isArticle(s.url))
      .slice(0, SAMPLE_PAGES)
      .map((s) => ({
        url: s.url,
        text: `${headLines(s)}\n\n${mainText(s, 3_000)}`,
      }));
    return views.length > 0 ? views : "no non-article pages crawled";
  },
);

const AWARD_SENTENCE =
  /\b(?:award(?:ed|s)?|winner|won|certified|certification|accredited|featured (?:in|on)|as seen (?:in|on)|voted|best of)\b/i;

function awardSentences(text: string, max: number): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    if (sentence.length < 6 || sentence.length > 300) continue;
    if (AWARD_SENTENCE.test(sentence)) out.add(sentence);
    if (out.size >= max) break;
  }
  return [...out];
}

function awardView(s: PageSnapshot): View | null {
  const images = s.images
    .filter((i) => AWARD_WORD.test(`${i.alt ?? ""} ${i.src}`))
    .slice(0, 12)
    .map((i) => `- image alt="${i.alt ?? ""}" src="${i.src}"`);
  const claims = awardSentences(s.markup.text, 12).map((t) => `- ${t}`);
  if (images.length === 0 && claims.length === 0) return null;
  const links = s.links
    .filter((l) => AWARD_WORD.test(`${l.text} ${l.href}`))
    .slice(0, 8)
    .map((l) => `- link "${l.text}" → ${l.href}`);
  return {
    url: s.url,
    text: [
      "Award-like images:",
      ...(images.length > 0 ? images : ["(none)"]),
      "Award-like text:",
      ...(claims.length > 0 ? claims : ["(none)"]),
      "Award-like links:",
      ...(links.length > 0 ? links : ["(none)"]),
    ].join("\n"),
  };
}

const awardsAsTextCheck = llmCheck(
  "llm.awards-as-text",
  {
    itemId: "P5-11",
    rubricId: "awards-as-text",
    title: "Awards, press or certifications shown as images or without source",
    fix: "State each award, press mention and certification as HTML text with the awarding body, the year and a link to the source; keep the badge image as decoration (§6).",
    effort: "S",
  },
  (ctx) => {
    if (ctx.siteFactMap) {
      const views = awardViews(ctx, ctx.siteFactMap);
      return views.length > 0 ? views : "no awards or badges found";
    }
    const views = htmlPages(ctx)
      .map(awardView)
      .filter((v): v is View => v !== null);
    return views.length > 0 ? views.slice(0, SAMPLE_PAGES) : "no awards found";
  },
);

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 20);
}

/** Per page: share of its sentences that also appear on another given page. */
export function sharedSentenceRatios(pages: readonly PageSnapshot[]): number[] {
  const perPage = pages.map((p) => new Set(sentences(p.markup.text)));
  const seen = new Map<string, number>();
  for (const set of perPage)
    for (const t of set) seen.set(t, (seen.get(t) ?? 0) + 1);
  return perPage.map((set) => {
    const own = [...set];
    const shared = own.filter((t) => (seen.get(t) ?? 0) >= 2).length;
    return own.length > 0 ? Number((shared / own.length).toFixed(2)) : 0;
  });
}

const KEY_FACTS_SPEC = {
  itemId: "P5-15",
  rubricId: "detail-key-facts",
  title: "Detail pages lack a key-facts block or unique facts",
  fix: "Give every detail page a key-facts list or table with the item's own facts (date, place, price, distance, specs) and write copy specific to it instead of shared template text (§6, §7).",
  effort: "M",
} as const;

/**
 * P5-15. Quick: 3 pages per detail template, numbers in `facts`. Full read
 * (fact map): every detail page's words + key-facts block in `facts`, the
 * thinnest pages as views (WO-B9-017).
 */
const detailKeyFactsCheck: HandbookCheck = {
  id: "llm.detail-key-facts",
  itemIds: ["P5-15"],
  class: "LLM",
  requires: ["pages"],
  run: async (ctx) => {
    const byUrl = new Map(htmlPages(ctx).map((p) => [normalizeUrl(p.url), p]));
    const map = ctx.siteFactMap;
    const groups = detailTemplates(ctx)
      .map((t) => ({
        pattern: t.urlPattern,
        pages: [...t.samples.map((s) => s.url), ...t.urls]
          .map((u) => byUrl.get(normalizeUrl(u)))
          .filter((p): p is PageSnapshot => p !== undefined)
          .filter((p, i, all) => all.indexOf(p) === i)
          .slice(0, map ? undefined : 3),
      }))
      .filter((g) => g.pages.length >= 2);
    if (groups.length === 0 && (map?.thinPages.length ?? 0) === 0)
      return only("P5-15", "NA", "no detail template with ≥ 3 crawled pages");
    if (map) {
      const { views, detailPages } = keyFactsViews(
        ctx,
        map,
        groups.map((g) => ({ ...g, ratios: sharedSentenceRatios(g.pages) })),
      );
      return judged(ctx, KEY_FACTS_SPEC, views, { detailPages });
    }
    const views: View[] = [];
    const stats: Record<string, unknown>[] = [];
    for (const g of groups) {
      const ratios = sharedSentenceRatios(g.pages);
      g.pages.forEach((p, i) => {
        if (views.length >= SAMPLE_PAGES + 1) return;
        stats.push({
          url: p.url,
          template: g.pattern,
          words: p.wordsRaw,
          tables: p.markup.counts.tables,
          lists: p.markup.counts.lists,
          sharedSentenceRatio: ratios[i],
        });
        views.push({
          url: p.url,
          text: `${headLines(p)}\n\n${mainText(p, 3_000)}`,
        });
      });
    }
    return judged(ctx, KEY_FACTS_SPEC, views, { detailPages: stats });
  },
};

export const LLM_CONTENT_CHECKS: readonly HandbookCheck[] = [
  pageTypeMatrixCheck,
  awardsAsTextCheck,
  detailKeyFactsCheck,
];
