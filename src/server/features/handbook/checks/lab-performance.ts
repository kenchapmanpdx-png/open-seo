import { sort } from "remeda";
import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import type {
  LighthouseData,
  RenderData,
} from "@/server/features/handbook/contracts/render-data";
import { createResult, normalizeUrl } from "./support";

/**
 * PERF lab checks (handbook §0, §14, §15, §32, §33). Split by collector so
 * the raw-HTML parts run without the render sidecar:
 * - labMetricsCheck (Lighthouse): LCP ≤ 2.5 s / CLS ≤ 0.1 per sample (P7-09),
 *   CLS measured (P7-08), lab environment recorded (P7-10). CrUX → DATA (B6).
 * - pageWeightCheck (raw HTML + render when present): HTML weight and total
 *   page weight per rendered page (P2-05, Σ transferBytes; media bodies are
 *   aborted by the sidecar and not sized yet), render-blocking scripts and
 *   animation libraries in <head> (P7-05).
 * - resourceHintsCheck (raw HTML + render): preconnect only to origins the
 *   rendered page uses; image preload only for the hero; ≤3 preloads (P7-06).
 */
const LCP_MS = 2500;
const CLS = 0.1;
const HTML_BYTES = 500_000;
/** Total page weight (Σ transfer bytes) per rendered page (§15 "multi-MB"). */
const PAGE_BYTES = 5_000_000;
const BLOCKING_SCRIPTS = 5;
const MAX_PRELOADS = 3;
/** Lighthouse render-blocking savings worth naming in P7-05. */
const LH_BLOCKING_MS = 500;
const ANIMATION_LIB = /gsap|lottie|\baos\b|framer-motion|anime(\.min)?\.js/i;
/** Third-party font / icon services, named in the P7-05 finding (why F26, ryan A08). */
const FONT_SERVICES: ReadonlyArray<[RegExp, string]> = [
  [/fonts\.googleapis\.com/i, "Google Fonts"],
  [/use\.typekit\.net|p\.typekit\.net/i, "Adobe Fonts (Typekit)"],
  [/font-?awesome/i, "Font Awesome"],
  [/fonts\.bunny\.net/i, "Bunny Fonts"],
];

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

function absolute(url: string, base: string): string {
  try {
    return normalizeUrl(new URL(url, base).href);
  } catch {
    return url;
  }
}

const blocking = (s: PageSnapshot) =>
  s.markup.scripts.filter(
    (x) =>
      x.inHead &&
      x.src &&
      !x.async &&
      !x.defer &&
      x.type?.toLowerCase() !== "module",
  );

/** Head stylesheets and blocking scripts served by a third-party font/icon service. */
const fontBlockers = (s: PageSnapshot) =>
  [
    ...s.markup.headLinks
      .filter((l) => /\bstylesheet\b/i.test(l.rel))
      .map((l) => l.href),
    ...blocking(s).map((x) => x.src ?? ""),
  ].flatMap((url) => {
    const hit = FONT_SERVICES.find(([re]) => re.test(url));
    return hit ? [`${hit[1]} blocks rendering: ${url}`] : [];
  });

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/** Rendered-page weight line + top 10 requests by bytes (evidence excerpt). */
function weightLines(p: RenderData["pages"][number]) {
  const requests = p.js.requests;
  const media = requests.filter((q) => q.aborted === "media").length;
  const top = sort(
    requests.filter((q) => (q.transferBytes ?? 0) > 0),
    (a, b) => (b.transferBytes ?? 0) - (a.transferBytes ?? 0),
  ).slice(0, 10);
  return {
    line: `${p.url} — ${mb(p.js.pageWeightBytes ?? 0)} over ${requests.length} requests${media > 0 ? ` (${media} media not sized)` : ""}`,
    excerpt: top
      .map((q) => `${mb(q.transferBytes ?? 0)} ${q.resourceType} ${q.url}`)
      .join("\n"),
  };
}

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const lhLine = (p: LighthouseData["pages"][number]) =>
  `${p.url} (${p.formFactor}) — LCP ${p.lcpMs === null ? "?" : Math.round(p.lcpMs)} ms · CLS ${p.cls ?? "?"} · TBT ${p.tbtMs === null ? "?" : Math.round(p.tbtMs)} ms · performance ${p.performance ?? "?"}`;

export const labMetricsCheck: HandbookCheck = {
  id: "perf.lab-metrics",
  itemIds: ["P7-09", "P7-08", "P7-10"],
  class: "PERF",
  requires: ["lighthouse"],
  run(ctx) {
    const out = createResult(["P7-09", "P7-08", "P7-10"]);
    const { lighthouse, templates } = ctx.collected;
    if (lighthouse.status !== "ok") return out.build();
    const runs = lighthouse.pages;
    const ref = (p: (typeof runs)[number]) =>
      out.evidence(
        "lighthouse",
        p.url,
        `${lhLine(p)}\nenvironment: ${p.environment}\nLCP element: ${p.lcpElement ?? "?"}`,
        p.storageKey,
      );
    const templateCount =
      templates.status === "ok" ? templates.templates.length : null;
    const coverage = `${runs.length} Lighthouse runs${templateCount === null ? "" : ` for ${templateCount} templates (home + first samples)`}`;

    // P7-10 — environment recorded.
    const envs = [...new Set(runs.map((p) => p.environment))];
    out.pass(
      "P7-10",
      `lab: Lighthouse ${runs[0]?.formFactor ?? "mobile"} in ${envs.join("; ")}; field data (CrUX) not queried yet (DATA, B6)`,
      runs.slice(0, 1).map(ref),
    );

    // P7-09 — LCP / CLS budgets; TBT recorded as INP proxy.
    const slow = runs.filter(
      (p) => (p.lcpMs ?? 0) > LCP_MS || (p.cls ?? 0) > CLS,
    );
    if (slow.length > 0)
      out.finding({
        itemIds: ["P7-09"],
        severity: "S2",
        title: "Lab LCP above 2.5 s or CLS above 0.1",
        detail: `${slow.map(lhLine).join("\n")}\nINP proxy: TBT (lab); CrUX field data pending (B6).`,
        fix: "Bring lab LCP under 2.5 s (fast server response, hero image in HTML with fetchpriority=high, no render-blocking scripts) and CLS under 0.1 (sizes on images, embeds and banners).",
        fixability: "FIXABLE",
        effort: "M",
        urls: slow.map((p) => p.url),
        evidenceRefs: slow.slice(0, 5).map(ref),
      });
    else
      out.pass(
        "P7-09",
        `${coverage}: LCP ≤ 2.5 s, CLS ≤ 0.1; TBT recorded as INP proxy; CrUX pending (B6)`,
        runs.slice(0, 3).map(ref),
      );

    // P7-08 — CLS measured on the sampled templates.
    const shifty = runs.filter((p) => (p.cls ?? 0) > CLS);
    const unmeasured = runs.filter((p) => p.cls === null);
    if (shifty.length > 0)
      out.finding({
        itemIds: ["P7-08"],
        severity: "S2",
        title: "Lab CLS above 0.1",
        detail: shifty.map(lhLine).join("\n"),
        fix: "Reserve space for images, embeds, fonts and banners (width/height, aspect-ratio, font-display with metric overrides).",
        fixability: "FIXABLE",
        effort: "M",
        urls: shifty.map((p) => p.url),
        evidenceRefs: shifty.slice(0, 5).map(ref),
      });
    else
      out.pass(
        "P7-08",
        `${coverage}: CLS ≤ 0.1${unmeasured.length > 0 ? `; CLS not reported for ${unmeasured.map((p) => p.url).join(", ")}` : ""}; templates beyond the Lighthouse sample and CrUX/GSC CWV not checked (B6)`,
        runs.slice(0, 3).map(ref),
      );
    return out.build();
  },
};

export const pageWeightCheck: HandbookCheck = {
  id: "perf.page-weight",
  itemIds: ["P2-05", "P7-05"],
  class: "PERF",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(["P2-05", "P7-05"]);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);
    if (pagesLive.length === 0) {
      out.na("P2-05", "no 200 HTML page crawled");
      out.na("P7-05", "no 200 HTML page crawled");
      return out.build();
    }
    const ref = (s: PageSnapshot, excerpt: string) =>
      out.evidence("rawHtml", s.url, excerpt, s.rawKey);

    // P2-05 — total page weight per rendered page (Σ transfer bytes).
    const { render } = ctx.collected;
    const weighed =
      render.status === "ok"
        ? render.pages.filter((p) => typeof p.js.pageWeightBytes === "number")
        : [];
    const overweight = weighed.filter(
      (p) => (p.js.pageWeightBytes ?? 0) > PAGE_BYTES,
    );
    const weightRef = (p: (typeof weighed)[number]) => {
      const w = weightLines(p);
      const excerpt = `${w.line}\n${w.excerpt}`;
      return out.evidence("renderedDom", p.url, excerpt, p.js.renderedKey);
    };
    if (overweight.length > 0)
      out.finding({
        itemIds: ["P2-05"],
        severity: "S3",
        title: "Pages heavier than 5 MB",
        detail: overweight.map((p) => weightLines(p).line).join("\n"),
        fix: "Resize photos to about 2× their largest display size, serve WebP/AVIF with srcset and width/height, and lazy-load images below the first screen.",
        fixability: "FIXABLE",
        effort: "M",
        urls: overweight.map((p) => p.url),
        evidenceRefs: overweight.slice(0, 5).map(weightRef),
      });

    // P2-05 — HTML weight.
    const heavy = pagesLive.filter((s) => s.bytesRaw > HTML_BYTES);
    if (heavy.length > 0)
      out.finding({
        itemIds: ["P2-05"],
        severity: "S3",
        title: "HTML documents above 500 KB",
        detail: heavy
          .map((s) => `${s.url} — ${Math.round(s.bytesRaw / 1000)} KB HTML`)
          .join("\n"),
        fix: "Move inlined data, SVG sprites and base64 images out of the HTML; paginate long lists.",
        fixability: "FIXABLE",
        effort: "M",
        urls: heavy.map((s) => s.url),
        evidenceRefs: heavy
          .slice(0, 5)
          .map((s) => ref(s, `HTML ${s.bytesRaw} bytes`)),
      });
    else if (weighed.length === 0)
      out.blocked(
        "P2-05",
        `total page weight not measured: ${render.status === "ok" ? "rendered pages carry no transfer sizes (sidecar < 1.2.0)" : "render unavailable"} (${pagesLive.length} pages, HTML ≤ 500 KB)`,
      );
    else if (overweight.length === 0) {
      const biggest = sort(pagesLive, (a, b) => b.bytesRaw - a.bytesRaw);
      const heaviest = sort(
        weighed,
        (a, b) => (b.js.pageWeightBytes ?? 0) - (a.js.pageWeightBytes ?? 0),
      )[0];
      out.pass(
        "P2-05",
        `${pagesLive.length} pages, largest HTML ${Math.round((biggest[0]?.bytesRaw ?? 0) / 1000)} KB; ${weighed.length} rendered pages ≤ 5 MB, heaviest ${weightLines(heaviest).line}`,
        [weightRef(heaviest)],
      );
    }

    // P7-05 — "Bundle code-split; animation libraries lazy-loaded;
    // render-blocking fonts preloaded (§14)": blocking head scripts, animation
    // libraries, third-party font CSS, and (sidecar ≥ 1.3.0) Lighthouse
    // render-blocking resources that cost ≥ 500 ms.
    const lhOf = new Map(
      ctx.collected.lighthouse.status === "ok"
        ? ctx.collected.lighthouse.pages.map((p) => [normalizeUrl(p.url), p])
        : [],
    );
    const lhBlocking = (s: PageSnapshot) =>
      (lhOf.get(normalizeUrl(s.url))?.renderBlocking ?? []).filter(
        (r) => r.wastedMs >= LH_BLOCKING_MS,
      );
    const problems = pagesLive.flatMap((s) => {
      const list = blocking(s);
      const why: string[] = [];
      if (list.length > BLOCKING_SCRIPTS)
        why.push(`${list.length} render-blocking scripts in <head>`);
      for (const x of list)
        if (x.src && ANIMATION_LIB.test(x.src))
          why.push(`animation library blocks rendering: ${x.src}`);
      why.push(...fontBlockers(s));
      for (const r of lhBlocking(s))
        if (!why.some((w) => w.includes(r.url)))
          why.push(
            `Lighthouse render-blocking (${Math.round(r.wastedMs)} ms): ${r.url}`,
          );
      return why.length > 0 ? [{ s, why }] : [];
    });
    if (problems.length > 0)
      out.finding({
        itemIds: ["P7-05"],
        severity: "S3",
        title: "Render-blocking scripts or font CSS in <head>",
        detail: problems
          .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
          .join("\n"),
        fix: "Add defer (or type=module) to head scripts, split bundles per route, lazy-load animation libraries after first render, and self-host fonts/icons (or load them with preload + font-display: swap) instead of third-party render-blocking CSS.",
        fixability: "FIXABLE",
        effort: "M",
        urls: problems.map(({ s }) => s.url),
        evidenceRefs: problems.slice(0, 5).flatMap(({ s, why }) => {
          const lh = lhOf.get(normalizeUrl(s.url));
          const lhRows = lhBlocking(s);
          return [
            ref(
              s,
              [
                ...why,
                ...blocking(s).map((x) => `<script src="${x.src}"> in head`),
              ].join("\n"),
            ),
            ...(lh && lhRows.length > 0
              ? [
                  out.evidence(
                    "lighthouse",
                    s.url,
                    lhRows
                      .map(
                        (r) => `${r.url} — wastedMs ${Math.round(r.wastedMs)}`,
                      )
                      .join("\n"),
                    lh.storageKey,
                  ),
                ]
              : []),
          ];
        }),
      });
    else
      out.pass(
        "P7-05",
        `${pagesLive.length} pages: ≤ ${BLOCKING_SCRIPTS} blocking head scripts, no blocking animation library (code-split and font preload judged in B3)`,
        pagesLive
          .slice(0, 1)
          .map((s) => ref(s, `${blocking(s).length} blocking head scripts`)),
      );
    return out.build();
  },
};

export const resourceHintsCheck: HandbookCheck = {
  id: "perf.resource-hints",
  itemIds: ["P7-06"],
  class: "PERF",
  requires: ["pages", "render"],
  run(ctx) {
    const out = createResult(["P7-06"]);
    const { pages, render } = ctx.collected;
    if (pages.status !== "ok" || render.status !== "ok") return out.build();
    const snapOf = new Map(
      pages.snapshots.map((s) => [normalizeUrl(s.url), s]),
    );
    const pairs = render.pages.flatMap((r) => {
      const s = snapOf.get(normalizeUrl(r.url));
      return s && live(s) ? [{ r, s }] : [];
    });
    if (pairs.length === 0) {
      out.na("P7-06", "no rendered 200 page");
      return out.build();
    }
    const rows = pairs.flatMap(({ r, s }) => {
      const used = new Set(r.js.requests.map((q) => host(q.url)));
      const hints = s.markup.headLinks;
      const why: string[] = [];
      for (const h of hints)
        if (/\bpreconnect\b/i.test(h.rel) && !used.has(host(h.href)))
          why.push(`preconnect to ${h.href} — no request to that origin`);
      const preloads = hints.filter((h) => /\bpreload\b/i.test(h.rel));
      if (preloads.length > MAX_PRELOADS)
        why.push(`${preloads.length} preloads (max ${MAX_PRELOADS})`);
      const hero = s.images[0];
      const heroUrls = hero
        ? [hero.src, hero.dataSrc, ...(hero.srcset ?? "").split(/,\s*/)]
            .filter((v): v is string => !!v)
            .map((v) => v.trim().split(/\s+/)[0])
        : [];
      for (const h of preloads)
        if (
          h.as === "image" &&
          !heroUrls.some((u) => absolute(u, s.url) === normalizeUrl(h.href))
        )
          why.push(`preload of non-hero image ${h.href}`);
      return why.length > 0 ? [{ r, s, why }] : [];
    });
    if (rows.length > 0)
      out.finding({
        itemIds: ["P7-06"],
        severity: "S3",
        title: "Resource hints point at unused origins or non-LCP assets",
        detail: rows
          .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
          .join("\n"),
        fix: "Keep preconnect for origins the first render uses, preload only the LCP image and blocking fonts, and re-test lab LCP after changing hints.",
        fixability: "FIXABLE",
        effort: "S",
        urls: rows.map(({ s }) => s.url),
        evidenceRefs: rows
          .slice(0, 5)
          .flatMap(({ r, s, why }) => [
            out.evidence(
              "rawHtml",
              s.url,
              [
                ...why,
                ...s.markup.headLinks.map(
                  (h) =>
                    `<link rel="${h.rel}" href="${h.href}"${h.as ? ` as="${h.as}"` : ""}>`,
                ),
              ].join("\n"),
              s.rawKey,
            ),
            out.evidence(
              "renderedDom",
              r.url,
              `request origins: ${[...new Set(r.js.requests.map((q) => host(q.url)))].join(", ")}`,
              r.js.renderedKey,
            ),
          ]),
      });
    else
      out.pass(
        "P7-06",
        `${pairs.length} rendered samples: preconnects used, image preload only for the hero, ≤ ${MAX_PRELOADS} preloads (LCP regression after hint changes not tracked)`,
        pairs
          .slice(0, 2)
          .map(({ s }) =>
            out.evidence(
              "rawHtml",
              s.url,
              s.markup.headLinks
                .map((h) => `<link rel="${h.rel}" href="${h.href}">`)
                .join("\n") || "no resource hints",
              s.rawKey,
            ),
          ),
      );
    return out.build();
  },
};
