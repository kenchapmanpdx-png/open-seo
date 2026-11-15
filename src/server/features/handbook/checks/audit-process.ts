import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { createResult, normalizeUrl } from "./support";

/**
 * AUDIT process (handbook §0 EP, §17). P1-02: each rendered template sample
 * is recorded as Mode 1 (content in server HTML) or Mode 2 (JavaScript adds
 * > 20% words). Baseline date and S1–S4 severity tags come from the run
 * record and the runner. P1-03 (evidence reconciliation) is computed by the
 * runner in B3; P1-04 (checker re-fetch) needs upstream issue data that
 * CollectedData does not carry (escalated to B3) — neither gets a verdict here.
 */
const MODE2_RATIO = 1.2;

export const auditProcessCheck: HandbookCheck = {
  id: "audit.process",
  itemIds: ["P1-02"],
  class: "CRAWL",
  requires: ["pages", "render"],
  run(ctx) {
    const out = createResult(["P1-02"]);
    const { pages, render, templates } = ctx.collected;
    if (pages.status !== "ok" || render.status !== "ok") return out.build();
    const raw = new Map(
      pages.snapshots.map((s) => [normalizeUrl(s.url), s.wordsRaw]),
    );
    const templateOf = new Map<string, string>();
    if (templates.status === "ok")
      for (const t of templates.templates)
        for (const u of t.urls) templateOf.set(normalizeUrl(u), t.key);

    const rows = render.pages.flatMap((p) => {
      const words = raw.get(normalizeUrl(p.url));
      if (words === undefined) return [];
      const mode = p.js.words > MODE2_RATIO * words ? "Mode 2" : "Mode 1";
      const template = templateOf.get(normalizeUrl(p.url)) ?? p.url;
      return [{ template, url: p.url, raw: words, rendered: p.js.words, mode }];
    });
    if (rows.length === 0) {
      out.na("P1-02", "no rendered sample matches a crawled page");
      return out.build();
    }
    const table = rows
      .map(
        (r) =>
          `${r.template} · ${r.mode} · raw ${r.raw} / rendered ${r.rendered} words · ${r.url}`,
      )
      .join("\n");
    const mode2 = rows.filter((r) => r.mode === "Mode 2").length;
    out.pass(
      "P1-02",
      `${rows.length} templates: ${rows.length - mode2} Mode 1, ${mode2} Mode 2 (${rows
        .map((r) => `${r.template}=${r.mode}`)
        .join(", ")})`,
      [out.evidence("renderedDom", rows[0].url, table)],
    );
    return out.build();
  },
};
