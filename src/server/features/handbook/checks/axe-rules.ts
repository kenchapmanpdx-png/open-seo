import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { AxeData } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * A11Y via axe-core after full-page scroll (handbook §14, §15). P8-03: axe
 * ran on every template sample. P8-02: color-contrast. P8-06: label,
 * landmark-unique, scrollable-region-focusable, label-content-name-mismatch
 * (link-name / button-name belong to P8-04's raw-HTML check, so they are not
 * reported twice). One finding per rule across pages.
 */
const ITEMS = ["P8-03", "P8-02", "P8-06"];

const RULES: Record<string, { item: "P8-02" | "P8-06"; severity: "S2" }> = {
  "color-contrast": { item: "P8-02", severity: "S2" },
  label: { item: "P8-06", severity: "S2" },
  "landmark-unique": { item: "P8-06", severity: "S2" },
  "scrollable-region-focusable": { item: "P8-06", severity: "S2" },
  "label-content-name-mismatch": { item: "P8-06", severity: "S2" },
};

const FIX: Record<"P8-02" | "P8-06", string> = {
  "P8-02":
    "Raise text contrast to 4.5:1 (3:1 for large text), including brand accent colours on small text.",
  "P8-06":
    "Label every input, give each <nav>/landmark a distinct label, make scrollable regions focusable and labelled, and keep the visible text inside each accessible name.",
};

type Page = AxeData["pages"][number];

const summary = (p: Page) =>
  p.violations.length === 0
    ? "0 violations"
    : p.violations
        .map((v) => `${v.id} (${v.impact ?? "?"}, ${v.nodes} nodes)`)
        .join("\n");

export const axeRulesCheck: HandbookCheck = {
  id: "a11y.axe-rules",
  itemIds: ITEMS,
  class: "A11Y",
  requires: ["axe"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { axe, templates } = ctx.collected;
    if (axe.status !== "ok") return out.build();
    const pages = axe.pages;
    const ref = (p: Page, excerpt = summary(p)) =>
      out.evidence("axe", p.url, excerpt);

    // P8-03 — coverage of template samples.
    const scanned = new Set(pages.map((p) => normalizeUrl(p.url)));
    const missing =
      templates.status === "ok"
        ? templates.templates.filter(
            (t) => !t.samples.some((s) => scanned.has(normalizeUrl(s.url))),
          )
        : [];
    out.pass(
      "P8-03",
      missing.length === 0
        ? `axe (after full-page scroll) ran on ${pages.length} template samples`
        : `axe ran on ${pages.length} template samples; not scanned (sample cap): ${missing.map((t) => t.key).join(", ")}`,
      pages.slice(0, 3).map((p) => ref(p)),
    );

    // P8-02 / P8-06 — one finding per axe rule.
    const byRule = new Map<
      string,
      { page: Page; v: Page["violations"][number] }[]
    >();
    for (const page of pages)
      for (const v of page.violations) {
        if (!RULES[v.id]) continue;
        const list = byRule.get(v.id) ?? [];
        list.push({ page, v });
        byRule.set(v.id, list);
      }
    // Which template each scanned URL samples, so `/events/*` hits read as such.
    const patternOf = new Map<string, string>();
    if (templates.status === "ok")
      for (const t of templates.templates)
        for (const u of t.urls) patternOf.set(normalizeUrl(u), t.urlPattern);
    const label = (url: string) => {
      const pattern = patternOf.get(normalizeUrl(url));
      return pattern ? `${url} [template ${pattern}]` : url;
    };
    for (const [id, hits] of byRule) {
      const rule = RULES[id];
      out.finding({
        itemIds: [rule.item],
        severity: rule.severity,
        title: `axe: ${hits[0].v.help}`,
        detail: hits
          .map(
            ({ page, v }) =>
              `${label(page.url)} — ${v.nodes} nodes (${v.impact ?? "?"}): ${v.sampleTargets.join(", ")}`,
          )
          .join("\n"),
        fix: FIX[rule.item],
        fixability: "FIXABLE",
        effort: "S",
        urls: hits.map(({ page }) => page.url),
        evidenceRefs: hits
          .slice(0, 5)
          .map(({ page, v }) =>
            ref(page, `${v.id}: ${v.help}\n${v.sampleTargets.join("\n")}`),
          ),
      });
    }
    const passRefs = pages.slice(0, 3).map((p) => ref(p));
    out.pass(
      "P8-02",
      `${pages.length} samples: no color-contrast violations`,
      passRefs,
    );
    out.pass(
      "P8-06",
      `${pages.length} samples: no label / landmark-unique / scrollable-region / name-mismatch violations (reduced motion and target size need render review)`,
      passRefs,
    );
    return out.build();
  },
};
