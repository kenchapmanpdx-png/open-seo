import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §3, §14): one `<main>`, headings in order without skips,
 * nav/footer labels not marked up as headings (P4-08); prices, hours and
 * specs in table or list markup (P5-12; "one copy each" is LLM work in B3).
 */
const ITEMS = ["P4-08", "P5-12"];

const PRICE = /[$€£]\s?\d/g;
const DAY_TIME =
  /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]/gi;
const HOURS_HEADING = /\b(opening\s+)?hours\b/i;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

function structureProblems(s: PageSnapshot): string[] {
  const m = s.markup;
  const why: string[] = [];
  if (m.mainCount !== 1) why.push(`${m.mainCount} <main> elements`);
  const labels = m.headings.filter(
    (h) => h.landmark === "nav" || h.landmark === "footer",
  );
  if (labels.length > 0)
    why.push(
      `headings used as ${labels.map((h) => `${h.landmark} label <h${h.level}>${h.text}`).join(", ")}`,
    );
  const body = m.headings.filter((h) => h.landmark === null);
  const firstBody = body[0];
  const h1Before =
    firstBody &&
    m.headings
      .slice(0, m.headings.indexOf(firstBody))
      .some((h) => h.level === 1);
  if (firstBody && firstBody.level !== 1 && !h1Before)
    why.push(`first content heading is <h${firstBody.level}>`);
  for (let i = 1; i < body.length; i++) {
    const prev = body[i - 1];
    const cur = body[i];
    if (prev && cur && cur.level > prev.level + 1)
      why.push(`h${prev.level} → h${cur.level} skip ("${cur.text}")`);
  }
  return why;
}

export const pageStructureCheck: HandbookCheck = {
  id: "crawl.page-structure",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);
    if (pagesLive.length === 0) {
      for (const id of ITEMS) out.na(id, "no 200 HTML page crawled");
      return out.build();
    }
    const outline = (s: PageSnapshot) =>
      [
        `<main> × ${s.markup.mainCount}`,
        ...s.markup.headings.map(
          (h) =>
            `${h.landmark ? `[${h.landmark}] ` : ""}<h${h.level}>${h.text}`,
        ),
      ].join("\n");

    const structure = pagesLive.flatMap((s) => {
      const why = structureProblems(s);
      return why.length > 0 ? [{ s, why }] : [];
    });
    if (structure.length > 0) {
      out.finding({
        itemIds: ["P4-08"],
        severity: "S2",
        title: "Heading order / landmark structure broken",
        detail: structure
          .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
          .join("\n"),
        fix: "One <main> per page; start content with one <h1> and step down one level at a time; label nav/footer blocks with aria-label or plain text, not headings.",
        fixability: "FIXABLE",
        effort: "S",
        urls: structure.map(({ s }) => s.url),
        evidenceRefs: structure
          .slice(0, 20)
          .map(({ s }) => out.evidence("rawHtml", s.url, outline(s), s.rawKey)),
      });
    } else {
      out.pass(
        "P4-08",
        `${pagesLive.length} pages: one <main>, ordered headings, no heading labels in nav/footer`,
        pagesLive
          .slice(0, 5)
          .map((s) => out.evidence("rawHtml", s.url, outline(s), s.rawKey)),
      );
    }

    const facts = pagesLive.flatMap((s) => {
      const text = s.markup.text;
      const prices = text.match(PRICE)?.length ?? 0;
      const hours = text.match(DAY_TIME)?.length ?? 0;
      const hoursHeading = s.markup.headings.some((h) =>
        HOURS_HEADING.test(h.text),
      );
      const structured = s.markup.counts.tables + s.markup.counts.lists > 0;
      if (structured || (prices < 3 && hours < 3 && !hoursHeading)) return [];
      return [
        {
          s,
          why: `${prices} prices, ${hours} day/time pairs${hoursHeading ? ", hours heading" : ""}; 0 tables/lists`,
        },
      ];
    });
    if (facts.length > 0) {
      out.finding({
        itemIds: ["P5-12"],
        severity: "S3",
        title: "Prices / hours / specs not in table or list markup",
        detail: facts.map(({ s, why }) => `${s.url} — ${why}`).join("\n"),
        fix: "Put prices, menus, opening hours and specs in <table> or <ul>/<dl> markup so parsers and LLMs read them as data.",
        fixability: "FIXABLE",
        effort: "S",
        urls: facts.map(({ s }) => s.url),
        evidenceRefs: facts
          .slice(0, 20)
          .map(({ s, why }) =>
            out.evidence(
              "rawHtml",
              s.url,
              `${why}\n${s.markup.text.slice(0, 1200)}`,
              s.rawKey,
            ),
          ),
      });
    } else {
      out.pass(
        "P5-12",
        "price/hours/spec runs sit in table or list markup (one-copy judgment pending, LLM B3)",
        [
          out.evidence(
            "rawHtml",
            pagesLive[0]?.url ?? ctx.origin,
            `${pagesLive.length} pages scanned for price/hours runs outside tables/lists`,
            pagesLive[0]?.rawKey,
          ),
        ],
      );
    }
    return out.build();
  },
};
