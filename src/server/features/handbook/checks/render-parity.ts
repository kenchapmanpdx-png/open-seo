import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { createResult, normalizeUrl } from "./support";

/**
 * RENDER (handbook §14, §17): raw HTML vs rendered DOM per template sample.
 * Core content must not be JS-only (P2-01), the comparison runs for every
 * template (P2-08), raw and rendered visible words stay within ~20% (P2-09),
 * no primary content waits at opacity:0 (P2-07), API-driven pages keep a
 * static fallback (P2-02). Which content is "core" and duplicate facts are
 * LLM work (B3); this check covers the word-count parts.
 */
const ITEMS = ["P2-01", "P2-08", "P2-09", "P2-07", "P2-02"];

const DRIFT = 1.2;
/** Word drift below this is noise on small pages (rule says "~20%"). */
const DRIFT_MIN_WORDS = 20;

/** Raw vs rendered words more than ~20% apart (P2-09; render-diff escalation). */
export function isWordDrift(raw: number, rendered: number): boolean {
  const hi = Math.max(raw, rendered);
  const lo = Math.min(raw, rendered);
  return hi >= DRIFT * lo && hi - lo >= DRIFT_MIN_WORDS;
}
const JS_ONLY_WORDS = 150;
const JS_ONLY_SHARE = 0.4;
const OPACITY_WORDS = 30;
/** Share of a page's rendered words at opacity:0 that makes P2-07 S2. */
const MOSTLY_HIDDEN = 0.5;
const NO_FALLBACK_RAW = 50;

type Pair = {
  url: string;
  templateKey: string | null;
  raw: number;
  rendered: number;
  noJs: number;
  opacityZero: number;
  /** Denominator of `opacityZero`: same-walker main words (WO-B19-006), else rendered words. */
  opacityBase: number;
  snap: PageSnapshot;
  render: RenderData["pages"][number];
};

const formsOf = (p: Pair) => ({
  raw: p.snap.markup.counts.forms,
  rendered: p.render.js.forms,
});

const numbers = (p: Pair) =>
  `raw (JS off, server HTML) ${p.raw} words · rendered ${p.rendered} words · browser JS off ${p.noJs} words`;

const mostlyHidden = (p: Pair) =>
  p.opacityZero > MOSTLY_HIDDEN * Math.max(p.opacityBase, 1);
const opacityLine = (p: Pair) =>
  `${p.url} — ${p.opacityZero} of ${p.opacityBase} ${p.render.js.mainWords === undefined ? "rendered" : "main-content"} words at opacity:0 after load (before scroll) · browser JS off ${p.noJs} words`;

export const renderParityCheck: HandbookCheck = {
  id: "render.parity",
  itemIds: ITEMS,
  class: "RENDER",
  requires: ["pages", "render"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, render, templates } = ctx.collected;
    if (pages.status !== "ok" || render.status !== "ok") return out.build();

    const templateOf = new Map<string, string>();
    const templateList = templates.status === "ok" ? templates.templates : [];
    for (const t of templateList)
      for (const u of t.urls) templateOf.set(normalizeUrl(u), t.key);
    const snapOf = new Map(
      pages.snapshots.map((s) => [normalizeUrl(s.url), s]),
    );

    const pairs: Pair[] = render.pages.flatMap((r) => {
      const snap = snapOf.get(normalizeUrl(r.url));
      if (!snap || snap.status !== 200) return [];
      return [
        {
          url: r.url,
          templateKey: templateOf.get(normalizeUrl(r.url)) ?? null,
          raw: snap.wordsRaw,
          rendered: r.js.words,
          noJs: r.noJs.words,
          opacityZero: r.js.opacityZeroWords,
          opacityBase: r.js.mainWords ?? r.js.words,
          snap,
          render: r,
        },
      ];
    });
    if (pairs.length === 0) {
      for (const id of ITEMS) out.na(id, "no rendered 200 page");
      return out.build();
    }

    const refs = (p: Pair) => [
      out.evidence("rawHtml", p.url, numbers(p), p.snap.rawKey),
      out.evidence(
        "renderedDom",
        p.url,
        `${numbers(p)} · opacity:0 words ${p.opacityZero}`,
        p.render.js.renderedKey,
      ),
    ];
    const lines = (list: Pair[]) =>
      list.map((p) => `${p.url} — ${numbers(p)}`).join("\n");
    const base = (list: Pair[]) => ({
      urls: list.map((p) => p.url),
      ...(list.length === 1 && list[0].templateKey
        ? { templateKey: list[0].templateKey }
        : {}),
      evidenceRefs: list.slice(0, 5).flatMap(refs),
    });
    const passRefs = () => pairs.slice(0, 3).flatMap(refs);

    // P2-01 — core content added by JavaScript (deterministic part).
    const jsOnly = pairs.filter(
      (p) =>
        p.rendered - p.raw >= JS_ONLY_WORDS &&
        p.rendered - p.raw >= JS_ONLY_SHARE * p.rendered,
    );
    if (jsOnly.length > 0)
      out.finding({
        itemIds: ["P2-01"],
        severity: "S1",
        title: "Core content is added by JavaScript (not in server HTML)",
        detail: `${lines(jsOnly)}\nWhich of the missing text is core (listings, prices, bios, key facts) is judged in the LLM pass.`,
        fix: "Server-render (SSR/SSG) the page body so listings, dates, prices and bios are in the HTML response; keep JavaScript for enhancement only.",
        fixability: "FIXABLE",
        effort: "L",
        ...base(jsOnly),
      });
    else
      out.pass(
        "P2-01",
        `${pairs.length} rendered samples: JS adds < ${JS_ONLY_WORDS} words or < ${JS_ONLY_SHARE * 100}% (core-content judgement pending LLM pass)`,
        passRefs(),
      );

    // P2-08 — "Raw HTML (JS off) vs rendered DOM compared per template
    // (§17)": the comparison exists per template, and (sidecar ≥ 1.3.0) a
    // form that only exists after JavaScript is reported.
    const jsForms = pairs.filter((p) => {
      const f = formsOf(p);
      return f.rendered !== undefined && f.rendered > f.raw;
    });
    const formLine = (p: Pair) =>
      `${p.url} — forms: raw HTML ${formsOf(p).raw} · rendered ${formsOf(p).rendered ?? "?"}`;
    const rendered = new Set(pairs.map((p) => p.templateKey));
    const missing = templateList.filter((t) => !rendered.has(t.key));
    if (jsForms.length > 0)
      out.finding({
        itemIds: ["P2-08"],
        severity: "S4",
        // Severity scales (§17): a JS-only form hides an action, not page
        // content. Without a reason the contract guard blocked P2-01…09
        // (B18 WO-B18-017).
        severityReason:
          "only a form is missing from the server HTML; the page content is there",
        title: "Form exists only after JavaScript runs",
        detail: `${jsForms.map(formLine).join("\n")}\nCrawlers and visitors without JavaScript see no form (contact, booking or search).`,
        fix: "Put the <form> (fields, labels and a working action URL) in the server HTML; let JavaScript enhance it instead of creating it.",
        fixability: "FIXABLE",
        effort: "M",
        urls: jsForms.map((p) => p.url),
        evidenceRefs: jsForms
          .slice(0, 5)
          .flatMap((p) => [
            out.evidence("rawHtml", p.url, formLine(p), p.snap.rawKey),
            out.evidence(
              "renderedDom",
              p.url,
              formLine(p),
              p.render.js.renderedKey,
            ),
          ]),
      });
    else
      out.pass(
        "P2-08",
        missing.length === 0
          ? `raw vs rendered compared for all ${pairs.length} template samples`
          : `raw vs rendered compared for ${pairs.length} templates; not rendered (sample cap): ${missing.map((t) => t.key).join(", ")}`,
        passRefs(),
      );

    // P2-09 — word counts within ~20% (both directions).
    const drift = pairs.filter((p) => isWordDrift(p.raw, p.rendered));
    if (drift.length > 0)
      out.finding({
        itemIds: ["P2-09"],
        severity: "S3",
        title: "Raw vs rendered visible words differ by more than 20%",
        detail: `${lines(drift)}\nDuplicate-fact check pending LLM pass.`,
        fix: "Ship the same visible text in the server HTML as after hydration; remove content that only appears (or disappears) once JavaScript runs.",
        fixability: "FIXABLE",
        effort: "M",
        ...base(drift),
      });
    else
      out.pass(
        "P2-09",
        `${pairs.length} rendered samples within 20% raw vs rendered (duplicate-fact check pending LLM pass)`,
        passRefs(),
      );

    // P2-07 — primary content waiting at opacity:0, per page (every rendered
    // page at `full`). A page with more than half its text hidden is S2.
    const hidden = pairs.filter((p) => p.opacityZero >= OPACITY_WORDS);
    for (const [severity, list] of [
      ["S2", hidden.filter(mostlyHidden)],
      ["S3", hidden.filter((p) => !mostlyHidden(p))],
    ] as const) {
      if (list.length === 0) continue;
      out.finding({
        itemIds: ["P2-07"],
        severity,
        ...(severity === "S2"
          ? {
              severityReason: `more than ${MOSTLY_HIDDEN * 100}% of the page's rendered words wait at opacity:0`,
            }
          : {}),
        title:
          severity === "S2"
            ? "Most of the page text waits at opacity:0 for an animation"
            : "Content waits at opacity:0 for an animation",
        detail: list.map(opacityLine).join("\n"),
        fix: "Render primary text visible by default; start reveal animations from a visible state or add a <noscript>/prefers-reduced-motion reveal.",
        fixability: "FIXABLE",
        effort: "S",
        urls: list.map((p) => p.url),
        evidenceRefs: list
          .slice(0, 5)
          .flatMap((p) => [
            out.evidence(
              p.render.firstScreenKey ? "screenshot" : "renderedDom",
              p.url,
              opacityLine(p),
              p.render.firstScreenKey ?? p.render.js.renderedKey,
            ),
            out.evidence(
              "renderedDom",
              p.url,
              opacityLine(p),
              p.render.noJs.nojsKey,
            ),
          ]),
      });
    }
    if (hidden.length === 0)
      out.pass(
        "P2-07",
        `${pairs.length} rendered pages: < ${OPACITY_WORDS} words at opacity:0 after load`,
        passRefs(),
      );

    // P2-02 — API-driven page with no static fallback.
    const noFallback = pairs.filter(
      (p) => p.raw < NO_FALLBACK_RAW && p.rendered >= JS_ONLY_WORDS,
    );
    if (noFallback.length > 0)
      out.finding({
        itemIds: ["P2-02"],
        severity: "S3",
        title: "API-driven page has no static fallback",
        detail: lines(noFallback),
        fix: "Render the last known data into the HTML at build or request time so the page has content when the API call fails or JavaScript does not run.",
        fixability: "FIXABLE",
        effort: "M",
        ...base(noFallback),
      });
    else
      out.pass(
        "P2-02",
        `${pairs.length} rendered samples: none under ${NO_FALLBACK_RAW} raw words with ≥ ${JS_ONLY_WORDS} rendered`,
        passRefs(),
      );

    return out.build();
  },
};
