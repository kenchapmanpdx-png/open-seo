import type {
  CheckContext,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { detailTemplates, sharedSentenceRatios } from "./llm-content";
import {
  type View,
  SAMPLE_PAGES,
  headLines,
  htmlPages,
  judged,
  llmCheck,
  only,
} from "./llm-copy";
import { createResult, normalizeUrl } from "./support";

/**
 * WO-B4-002 LLM template checks: hub titles (P4-07, §2), local pages
 * distinct (P5-09, §9/§24), fallback freshness (P2-03, §14). Verdict
 * mapping is the shared `judged` one in llm-copy.ts.
 */

const pathOf = (url: string) => new URL(url).pathname.replace(/\/$/, "");

/** Hub pages: a detail cluster's parent path, or a page linking ≥ 5 of its URLs. */
function hubPages(ctx: CheckContext): { page: PageSnapshot; items: number }[] {
  const pages = htmlPages(ctx);
  const hubs = new Map<string, { page: PageSnapshot; items: number }>();
  for (const t of detailTemplates(ctx)) {
    const parent = t.urlPattern.slice(0, -2);
    const members = new Set(t.urls.map(normalizeUrl));
    for (const p of pages) {
      // Detail pages linking their siblings ("more events") are not hubs.
      if (
        members.has(normalizeUrl(p.url)) ||
        pathOf(p.url).startsWith(`${parent}/`)
      )
        continue;
      const linked = new Set(
        p.links.map((l) => normalizeUrl(l.href)).filter((h) => members.has(h)),
      ).size;
      const isParent = [parent, `${parent}/index.html`].includes(pathOf(p.url));
      if (isParent || linked >= 5)
        hubs.set(normalizeUrl(p.url), { page: p, items: t.urls.length });
    }
  }
  // Home links to everything; it is not a hub for this rule.
  hubs.delete(normalizeUrl(new URL("/", ctx.origin).href));
  return [...hubs.values()];
}

const hubTitlesCheck = llmCheck(
  "llm.hub-titles",
  {
    itemId: "P4-07",
    rubricId: "hub-titles",
    title: "Hub titles are bare labels without a specific promise",
    fix: "Title each hub with the collection, a specific promise (what, where, for whom) and the brand, e.g. 'Portland Running Events & Races 2026 | Brand' instead of 'Events | Brand' (§2).",
    effort: "S",
  },
  (ctx) => {
    const hubs = hubPages(ctx);
    return hubs.length > 0
      ? hubs.slice(0, SAMPLE_PAGES).map(({ page }) => ({
          url: page.url,
          text: headLines(page),
        }))
      : "no hub pages (no detail cluster with ≥ 3 URLs)";
  },
);

const SERVICE_PATH = /\/(?:services?|locations?|areas?|service-areas?)$/i;

/** Titles that differ only by one run of ≤ 2 words (place or service swapped). */
function swapped(a: string, b: string): boolean {
  const x = a.toLowerCase().split(/\s+/);
  const y = b.toLowerCase().split(/\s+/);
  if (x.length !== y.length || x.length < 3) return false;
  const diff = x.flatMap((w, i) => (w === y[i] ? [] : [i]));
  return (
    diff.length > 0 &&
    diff.length <= 2 &&
    diff[diff.length - 1] - diff[0] < diff.length
  );
}

const localPagesCheck: HandbookCheck = {
  id: "llm.local-pages",
  itemIds: ["P5-09"],
  class: "LLM",
  requires: ["pages"],
  run: async (ctx) => {
    const pages = htmlPages(ctx).filter((p) => p.head.title);
    // (a) title-swap pages whose bodies are mostly shared sentences.
    const swaps = pages.filter((p) =>
      pages.some(
        (q) => q !== p && swapped(p.head.title ?? "", q.head.title ?? ""),
      ),
    );
    const ratios = sharedSentenceRatios(swaps);
    const twins = swaps.filter((_, i) => ratios[i] >= 0.6);
    // (b) a services/locations page with no page below it (ryan F14); the
    // judge reads its text to tell one real service from a list of many.
    const single = pages.filter((p) => {
      const path = pathOf(p.url);
      return (
        SERVICE_PATH.test(path) &&
        !pages.some((q) => pathOf(q.url).startsWith(`${path}/`))
      );
    });
    if (twins.length === 0 && single.length === 0) {
      const out = createResult(["P5-09"]);
      const ref = out.evidence(
        "textQuote",
        ctx.origin,
        `titles checked (${pages.length}):\n${pages.map((p) => p.head.title).join("\n")}`,
      );
      out.pass(
        "P5-09",
        "no title-swap pages with ≥ 60% shared sentences and no services/locations page without child pages (deterministic, no llm call)",
        [ref],
      );
      return out.build();
    }
    const views: View[] = [
      ...twins.slice(0, 6).map((p) => ({
        url: p.url,
        text: `${headLines(p)}\nsharedSentenceRatio: ${ratios[swaps.indexOf(p)]}\n\n${p.markup.text.slice(0, 2_500)}`,
      })),
      ...single.slice(0, 2).map((p) => ({
        url: p.url,
        text: `${headLines(p)}\nNo crawled page below ${pathOf(p.url)}/.\n\n${p.markup.text.slice(0, 3_000)}`,
      })),
    ];
    return judged(
      ctx,
      {
        itemId: "P5-09",
        rubricId: "local-pages",
        title: "Local or service pages are not distinct",
        fix: "Give each real service and each real location its own page with content specific to it (process, prices, examples, local facts); merge or remove pages that differ only by the swapped name (§9, §24).",
        effort: "L",
      },
      views,
    );
  },
};

const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");

/** Pages whose rendered version calls a same-site fetch/XHR (intake API gate). */
function apiPages(ctx: CheckContext): PageSnapshot[] {
  const render = ctx.collected.render;
  if (render.status !== "ok") return [];
  const urls = new Set(
    render.pages
      .filter((p) =>
        p.js.requests.some(
          (q) =>
            /^(fetch|xhr)$/.test(q.resourceType) && host(q.url) === host(p.url),
        ),
      )
      .map((p) => normalizeUrl(p.url)),
  );
  return htmlPages(ctx).filter((p) => urls.has(normalizeUrl(p.url)));
}

const fallbackFreshnessCheck: HandbookCheck = {
  id: "llm.fallback-freshness",
  itemIds: ["P2-03"],
  class: "LLM",
  requires: ["pages", "render"],
  run: async (ctx) => {
    const pages = apiPages(ctx);
    if (pages.length === 0)
      return only("P2-03", "NA", "no rendered page calls a same-site API");
    return judged(
      ctx,
      {
        itemId: "P2-03",
        rubricId: "fallback-freshness",
        title: "Server HTML shows stale or fallback facts as current",
        fix: "Ship server HTML with a dated snapshot ('as of <date>') or neutral copy; never show prices, availability, dates, counts or 'none found' states as current without a timestamp (§14).",
        effort: "M",
      },
      pages.slice(0, SAMPLE_PAGES).map((p) => ({
        url: p.url,
        text: `${headLines(p)}\n\n${p.markup.text.slice(0, 4_000)}`,
      })),
    );
  },
};

export const LLM_TEMPLATE_CHECKS: readonly HandbookCheck[] = [
  hubTitlesCheck,
  localPagesCheck,
  fallbackFreshnessCheck,
];
