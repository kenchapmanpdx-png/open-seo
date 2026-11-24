import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { AxeData } from "@/server/features/handbook/contracts/render-data";
import { createResult, normalizeUrl } from "./support";

/**
 * A11Y via axe-core after full-page scroll (handbook §14, §15). P8-03: axe
 * ran on every template sample. P8-02: color-contrast. P8-06: label,
 * landmark-unique, scrollable-region-focusable, label-content-name-mismatch
 * (link-name / button-name belong to P8-04's raw-HTML check and image-alt to
 * P8-04 too (a11y-markup reads it from this axe data), so they are not
 * reported twice). One finding per rule across pages, grouped by template
 * (`full` runs axe on every rendered page).
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

/**
 * P8-02 "Contrast 4.5:1 / 3:1 large; brand accents on small text checked
 * (§14)": evidence names the node text next to its selector when the sidecar
 * sends `sampleTexts` (1.3.0); older sidecars → selectors only.
 */
const samples = (v: Page["violations"][number]) =>
  v.sampleTargets.map((target, i) => {
    const text = v.sampleTexts?.[i]?.trim();
    return text ? `${target} — "${text}"` : target;
  });

/** Up to MAX_URLS pages listed per rule and MAX_NODES node excerpts as evidence. */
const MAX_URLS = 10;
const MAX_NODES = 10;

type Hit = { page: Page; v: Page["violations"][number] };

/** One evidence row per page, ≤ MAX_NODES node excerpts across the rule. */
function nodeExcerpts(hits: readonly Hit[]) {
  let budget = MAX_NODES;
  return hits.flatMap((h) => {
    const taken = samples(h.v)
      .slice(0, budget)
      .map((s) => s.slice(0, 300));
    budget -= taken.length;
    return taken.length > 0 ? [{ ...h, sample: taken.join("\n") }] : [];
  });
}

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
        ? `axe (after full-page scroll) ran on ${pages.length} pages`
        : `axe ran on ${pages.length} pages; not scanned (sample cap): ${missing.map((t) => t.key).join(", ")}`,
      pages.slice(0, 3).map((p) => ref(p)),
    );

    // P8-02 / P8-06 — one finding per axe rule.
    const byRule = new Map<string, Hit[]>();
    for (const page of pages)
      for (const v of page.violations) {
        if (!RULES[v.id]) continue;
        const list = byRule.get(v.id) ?? [];
        list.push({ page, v });
        byRule.set(v.id, list);
      }
    // Which template each scanned URL belongs to; at `full` axe reads every
    // page, so one finding per rule groups its pages by template.
    const patternOf = new Map<string, string>();
    if (templates.status === "ok")
      for (const t of templates.templates)
        for (const u of t.urls) patternOf.set(normalizeUrl(u), t.urlPattern);
    const patternFor = (url: string) =>
      patternOf.get(normalizeUrl(url)) ?? "(no template)";
    for (const [id, hits] of byRule) {
      const rule = RULES[id];
      const perTemplate = new Map<string, number>();
      for (const { page } of hits)
        perTemplate.set(
          patternFor(page.url),
          (perTemplate.get(patternFor(page.url)) ?? 0) + 1,
        );
      const templatesLine = `Templates: ${[...perTemplate]
        .map(
          ([pattern, n]) => `${pattern} (${n} ${n === 1 ? "page" : "pages"})`,
        )
        .join(", ")}`;
      const pageLines = hits
        .slice(0, MAX_URLS)
        .map(
          ({ page, v }) =>
            `${page.url} [template ${patternFor(page.url)}] — ${v.nodes} nodes (${v.impact ?? "?"}): ${v.sampleTargets.join(", ")}`,
        );
      const more =
        hits.length > MAX_URLS
          ? [`… and ${hits.length - MAX_URLS} more pages`]
          : [];
      out.finding({
        itemIds: [rule.item],
        severity: rule.severity,
        title: `axe: ${hits[0].v.help}`,
        detail: [templatesLine, ...pageLines, ...more].join("\n"),
        fix: FIX[rule.item],
        fixability: "FIXABLE",
        effort: "S",
        urls: hits.map(({ page }) => page.url),
        evidenceRefs: nodeExcerpts(hits).map(({ page, v, sample }) =>
          ref(page, `${v.id}: ${v.help}\n${sample}`),
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
