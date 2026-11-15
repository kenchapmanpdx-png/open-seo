import type {
  CheckContext,
  CheckResult,
  EvidenceDraft,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import type { Effort } from "@/server/features/handbook/contracts/status";
import { nameMentions } from "./name-mentions";
import { clip, normalizeUrl } from "./support";

/**
 * LLM-class K1 checks (B3 R2.2 exemplars, ADR-007). Each builds a short text
 * "view" per sampled page from collected facts, asks the K5 judge with a
 * fixed rubric (llm/rubrics.ts), and maps the verdict:
 * pass → PASS (judged views as evidence); fail with verified quotes → one
 * `source: "llm"` finding citing each quote; unsure or low confidence →
 * BLOCKED `llm unsure`. LLM findings never block a release (FORK.md).
 */

/** A fail below this confidence is reported as unsure, not OPEN. */
const MIN_FAIL_CONFIDENCE = 0.5;
export const SAMPLE_PAGES = 8;

export type View = { url: string; text: string };

export type Spec = {
  itemId: string;
  rubricId: string;
  title: string;
  fix: string;
  effort: Effort;
};

export function htmlPages(ctx: CheckContext): PageSnapshot[] {
  const pages = ctx.collected.pages;
  if (pages.status !== "ok") return [];
  return pages.snapshots.filter(
    (s) => s.status === 200 && (s.contentType ?? "").includes("html"),
  );
}

/** Home first, then one rank-1 sample per template, then crawl order. */
export function samplePages(ctx: CheckContext, max: number): PageSnapshot[] {
  const pages = htmlPages(ctx);
  const byUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));
  const picked = new Map<string, PageSnapshot>();
  const add = (url: string) => {
    const page = byUrl.get(normalizeUrl(url));
    if (page && picked.size < max) picked.set(normalizeUrl(page.url), page);
  };
  add(new URL("/", ctx.origin).href);
  const templates = ctx.collected.templates;
  if (templates.status === "ok")
    for (const t of templates.templates)
      for (const s of t.samples) if (s.rank === 1) add(s.url);
  for (const p of pages) add(p.url);
  return [...picked.values()];
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

const isLocal = (ctx: CheckContext) =>
  ctx.siteProfile.some((a) => a.code === "SP7" && a.value === "Y");

export async function judged(
  ctx: CheckContext,
  spec: Spec,
  views: readonly View[],
  facts: Record<string, unknown> = {},
): Promise<CheckResult> {
  if (!ctx.judge) throw new Error("no judge");
  const result = await ctx.judge({
    itemId: spec.itemId,
    rubricId: spec.rubricId,
    pages: views,
    facts: { local: isLocal(ctx), ...facts },
  });
  const tag = `${result.call.model}, confidence ${result.confidence.toFixed(2)}`;
  const unsure =
    result.verdict === "unsure" ||
    (result.verdict === "fail" && result.confidence < MIN_FAIL_CONFIDENCE);
  if (unsure) {
    return {
      statuses: [
        {
          itemId: spec.itemId,
          status: "BLOCKED",
          note: clip(`llm unsure (${tag}): ${result.rationale}`).slice(0, 500),
          evidenceRefs: [],
        },
      ],
      findings: [],
      evidence: [],
    };
  }
  const quoted = result.verdict === "fail" ? result.quotes : [];
  const evidence: EvidenceDraft[] =
    quoted.length > 0
      ? quoted.map((q, i) => ({
          ref: `quote:${i}`,
          kind: "textQuote",
          url: q.url,
          excerpt: clip(q.text),
        }))
      : views.map((v, i) => ({
          ref: `judged:${i}`,
          kind: "textQuote",
          url: v.url,
          excerpt: clip(v.text.slice(0, 400)),
        }));
  const refs = evidence.map((e) => e.ref);
  if (result.verdict === "pass") {
    return {
      statuses: [
        {
          itemId: spec.itemId,
          status: "PASS",
          note: `llm pass (${tag}, ${views.length} page(s))`,
          evidenceRefs: refs,
        },
      ],
      findings: [],
      evidence,
    };
  }
  const severity = ctx.applicableItems.get(spec.itemId)?.severityDefault;
  if (!severity) throw new Error(`item ${spec.itemId} not applicable`);
  return {
    statuses: [
      {
        itemId: spec.itemId,
        status: "OPEN",
        note: spec.title,
        evidenceRefs: refs,
      },
    ],
    findings: [
      {
        itemIds: [spec.itemId],
        severity,
        title: spec.title,
        detail: `${result.rationale} (LLM judge: ${tag}.)`,
        fix: spec.fix,
        fixability: "FIXABLE",
        effort: spec.effort,
        urls: [...new Set(quoted.map((q) => q.url))],
        source: "llm",
        evidenceRefs: refs,
      },
    ],
    evidence,
  };
}

/** One status for one item, no findings (NA / BLOCKED before any judge call). */
export function only(
  itemId: string,
  status: "NA" | "BLOCKED",
  note: string,
): CheckResult {
  return {
    statuses: [{ itemId, status, note, evidenceRefs: [] }],
    findings: [],
    evidence: [],
  };
}

export function llmCheck(
  id: string,
  spec: Spec,
  views: (ctx: CheckContext) => View[] | string,
): HandbookCheck {
  return {
    id,
    itemIds: [spec.itemId],
    class: "LLM",
    requires: ["pages"],
    run: async (ctx) => {
      const pages = views(ctx);
      if (typeof pages === "string") return only(spec.itemId, "NA", pages);
      if (pages.length === 0) throw new Error("no HTML pages to judge");
      return judged(ctx, spec, pages);
    },
  };
}

const openingSentenceCheck = llmCheck(
  "llm.opening-sentence",
  {
    itemId: "P5-01",
    rubricId: "opening-sentence",
    title: "Opening sentences do not name brand, subject and offer",
    fix: "Rewrite the first sentence of each listed page: brand + subject + what the page gives, within the first 60 words (§3).",
    effort: "M",
  },
  (ctx) =>
    samplePages(ctx, SAMPLE_PAGES).map((s) => ({
      url: s.url,
      text: `${headLines(s)}\n\n${mainText(s, 1_500)}`,
    })),
);

const superlativesCheck = llmCheck(
  "llm.superlatives-acronyms",
  {
    itemId: "P5-04",
    rubricId: "superlatives-acronyms",
    title: "Unsupported superlatives, placeholders or unexplained acronyms",
    fix: "Cite a source beside each superlative or percentage claim or remove it; delete placeholder copy; spell out each acronym on first use on every page (§6).",
    effort: "S",
  },
  (ctx) =>
    samplePages(ctx, SAMPLE_PAGES).map((s) => ({
      url: s.url,
      text: s.markup.text.slice(0, 6_000),
    })),
);

const FAQ_HEADING = /\bfaqs?\b|frequently asked|common questions/i;

const pageFaqCheck = llmCheck(
  "llm.page-specific-faq",
  {
    itemId: "P5-05",
    rubricId: "page-specific-faq",
    title: "FAQ questions are generic or repeated across pages",
    fix: "Keep only questions about each page's own subject, drawn from real customer questions; never repeat one FAQ block across pages (§3, §7).",
    effort: "M",
  },
  (ctx) => {
    const views = htmlPages(ctx).flatMap((s) => {
      const heading = s.markup.headings.find(
        (h) => h.landmark !== "nav" && FAQ_HEADING.test(h.text),
      );
      if (!heading) return [];
      const at = s.markup.text.indexOf(heading.text);
      return [
        {
          url: s.url,
          text: `${headLines(s)}\n\n${s.markup.text.slice(Math.max(at, 0), Math.max(at, 0) + 4_000)}`,
        },
      ];
    });
    return views.length > 0
      ? views.slice(0, SAMPLE_PAGES)
      : "no FAQ block on crawled pages";
  },
);

const titlesH1Check = llmCheck(
  "llm.titles-h1",
  {
    itemId: "P4-02",
    rubricId: "titles-h1",
    title: "Titles or H1s do not state the page's offer or topic",
    fix: "Lead each listed title with the service, product or topic (+ place for local businesses), brand last; make the H1 the page topic, not a promo (§2).",
    effort: "S",
  },
  (ctx) =>
    samplePages(ctx, 20).map((s) => ({ url: s.url, text: headLines(s) })),
);

const entityTestCheck = llmCheck(
  "llm.entity-test",
  {
    itemId: "P5-07",
    rubricId: "entity-test",
    title: "Entity test fails or names are spelled more than one way",
    fix: "State the business category (+ place for local businesses) in the home title, meta description and H1; spell the brand and people's names one way everywhere (§25).",
    effort: "S",
  },
  (ctx) => {
    const mentions = nameMentions(ctx, htmlPages(ctx));
    const block = (url: string) => {
      const lines = mentions.get(url);
      return lines ? `\n\nName mentions:\n${lines.join("\n")}` : "";
    };
    const views = samplePages(ctx, 12).map((s, i) => ({
      url: s.url,
      // Home (first) carries its opening text for the name-spelling part.
      text:
        (i === 0 ? `${headLines(s)}\n\n${mainText(s, 2_000)}` : headLines(s)) +
        block(s.url),
    }));
    const sampled = new Set(views.map((v) => normalizeUrl(v.url)));
    for (const [url, lines] of mentions)
      if (!sampled.has(normalizeUrl(url)))
        views.push({ url, text: `Name mentions:\n${lines.join("\n")}` });
    return views;
  },
);

/** A number worth comparing: 2+ digits, or with $ / % / + / k. */
const STAT = /[$€£]\s?\d|\d\s?(?:%|\+|[kK]\b)|\b\d{2,}/;
/** Phone numbers, years and clock times are not stats. */
const NOT_STAT =
  /\+?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}|\b(?:19|20)\d{2}\b|\b\d{1,2}:\d{2}\b/g;

/** Sentences (≤240 chars) holding at least one stat-like number. */
function statSentences(text: string, max: number): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    if (sentence.length < 8 || sentence.length > 240) continue;
    if (STAT.test(sentence.replace(NOT_STAT, " "))) out.add(sentence);
    if (out.size >= max) break;
  }
  return [...out];
}

/**
 * R2.3 cross-page fact table (P5-02, P9-02 "numbers match the site"): stat
 * sentences per page + llms files, judged for conflicting values. A conflict
 * quoted from an llms file also opens P9-02.
 */
const factTableCheck: HandbookCheck = {
  id: "llm.fact-table",
  itemIds: ["P5-02", "P9-02"],
  class: "LLM",
  requires: ["pages"],
  run: async (ctx) => {
    const views: View[] = htmlPages(ctx)
      .slice(0, 25)
      .map((s) => ({
        url: s.url,
        text: [
          `Meta description: ${s.head.metaDescription ?? "(none)"}`,
          ...statSentences(s.markup.text, 25),
        ].join("\n"),
      }));
    const llms = ctx.collected.llms;
    const llmsUrls = new Set<string>();
    if (llms.status === "ok")
      for (const f of llms.files)
        if (f.text) {
          llmsUrls.add(f.url);
          views.push({
            url: f.url,
            text: statSentences(f.text, 40).join("\n"),
          });
        }
    const withStats = views.filter((v) => STAT.test(v.text));
    if (withStats.length < 2)
      return {
        statuses: [
          {
            itemId: "P5-02",
            status: "NA",
            note: "stats on fewer than two pages",
            evidenceRefs: [],
          },
        ],
        findings: [],
        evidence: [],
      };
    const result = await judged(
      ctx,
      {
        itemId: "P5-02",
        rubricId: "stats-consistency",
        title: "The same statistic has different values across the site",
        fix: "Pick one current value per statistic, with its source and date, and use it in copy, meta descriptions, schema, llms.txt and About (§6, §20).",
        effort: "S",
      },
      withStats,
    );
    // Extend to P9-02 only when the llms file is part of the evidence.
    const finding = result.findings[0];
    const llmsQuoted = result.evidence.some((e) => llmsUrls.has(e.url));
    if (!ctx.applicableItems.has("P9-02") || llmsUrls.size === 0) return result;
    if (finding && llmsQuoted)
      return {
        ...result,
        findings: [{ ...finding, itemIds: ["P5-02", "P9-02"] }],
        statuses: [
          ...result.statuses,
          {
            itemId: "P9-02",
            status: "OPEN",
            note: "llms.txt numbers differ from the site",
            evidenceRefs: finding.evidenceRefs,
          },
        ],
      };
    const p502 = result.statuses[0];
    if (p502?.status === "PASS")
      return {
        ...result,
        statuses: [
          ...result.statuses,
          {
            ...p502,
            itemId: "P9-02",
            note: `llms.txt numbers match: ${p502.note}`,
          },
        ],
      };
    return result;
  },
};

export const LLM_CHECKS: readonly HandbookCheck[] = [
  openingSentenceCheck,
  superlativesCheck,
  pageFaqCheck,
  titlesH1Check,
  entityTestCheck,
  factTableCheck,
];
