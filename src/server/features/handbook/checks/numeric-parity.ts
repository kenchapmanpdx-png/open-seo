import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { createResult, normalizeUrl } from "./support";

/**
 * SUPP-04 (ADR-021, FULL-READ §3.4): counters and prices that ship as a
 * zero placeholder in server HTML and get their real value from JavaScript
 * (Elementor / count-up widgets). Raw-HTML readers (AI crawlers) quote
 * "$0/mo" or "0%". Pairs come from the render collector
 * (`js.numericMismatches`). P2-01 is PARTIAL when every real value also
 * appears elsewhere in the page's server HTML (the fact is readable, the
 * widget is wrong), OPEN otherwise. SUPP-04 itself is not scored.
 */
const ITEMS = ["SUPP-04", "P2-01"];

/** Pairs printed in evidence per finding. */
const MAX_PAIRS = 10;

const numberOf = (display: string) => display.match(/\d+(?:[.,]\d+)*/)?.[0];

/** Whole-number match, so `99` does not hit `1999`. */
const textHasNumber = (text: string, n: string) =>
  new RegExp(`(?<![\\d.,])${n.replace(/[.]/g, "\\.")}(?![\\d])`).test(text);

const line = (p: { raw: string; rendered: string }) =>
  `raw: ${p.raw} → rendered: ${p.rendered}`;

export const numericParityCheck: HandbookCheck = {
  id: "render.numeric-parity",
  itemIds: ITEMS,
  class: "RENDER",
  requires: ["pages", "render"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, render } = ctx.collected;
    if (pages.status !== "ok" || render.status !== "ok") return out.build();
    const snapOf = new Map(
      pages.snapshots.map((s) => [normalizeUrl(s.url), s]),
    );
    const hits = render.pages.flatMap((r) => {
      const snap = snapOf.get(normalizeUrl(r.url));
      const pairs = r.js.numericMismatches ?? [];
      if (!snap || pairs.length === 0) return [];
      const elsewhere = pairs.every((p) => {
        const n = numberOf(p.rendered);
        return n !== undefined && textHasNumber(snap.markup.text, n);
      });
      return [{ url: r.url, pairs, elsewhere, snap }];
    });
    if (hits.length === 0) {
      const refs = render.pages
        .slice(0, 3)
        .map((r) =>
          out.evidence(
            "renderedDom",
            r.url,
            "no zero placeholder replaced by a non-zero number after render",
            r.js.renderedKey,
          ),
        );
      if (refs.length > 0)
        out.pass(
          "SUPP-04",
          `${render.pages.length} rendered pages: no counter placeholder`,
          refs,
        );
      return out.build();
    }

    const allPairs = hits.flatMap((h) =>
      h.pairs.map((p) => ({ url: h.url, ...p })),
    );
    const evidenceRefs = allPairs
      .slice(0, MAX_PAIRS)
      .map((p) =>
        out.evidence("renderedDom", p.url, `${line(p)} (${p.context})`),
      )
      .concat(
        hits
          .slice(0, 3)
          .map((h) =>
            out.evidence(
              "rawHtml",
              h.url,
              h.pairs.map((p) => `raw: ${p.raw}`).join(" · "),
              h.snap.rawKey,
            ),
          ),
      );
    out.finding({
      itemIds: ITEMS,
      severity: "S3",
      title:
        "Numbers are placeholders in server HTML (JavaScript sets the real value)",
      detail: hits
        .map(
          (h) =>
            `${h.url} — ${h.pairs.map(line).join("; ")}${h.elsewhere ? " (real value also in server HTML elsewhere on the page)" : ""}`,
        )
        .join("\n"),
      fix: "Ship the final value in the HTML (counter start = end value, or static text) and animate from there; raw-HTML readers and AI crawlers quote the placeholder.",
      fixability: "FIXABLE",
      effort: "S",
      urls: hits.map((h) => h.url),
      evidenceRefs,
    });
    const result = out.build();
    if (!hits.every((h) => h.elsewhere)) return result;
    return {
      ...result,
      statuses: result.statuses.map((s) =>
        s.itemId === "P2-01" ? { ...s, status: "PARTIAL" as const } : s,
      ),
    };
  },
};
