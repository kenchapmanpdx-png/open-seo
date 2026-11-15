import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import type { AgencyBrand } from "@/server/features/agency/contracts";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";

/**
 * Client report (ADR-012 §3): the EP-7 review rewritten for a business
 * owner, as one self-contained HTML document for the upstream report
 * sandbox (inline CSS, no scripts, no external requests, ends `</html>`,
 * ≤ 500 KB). All report text is escaped: findings quote crawled pages.
 */

type Finding = ReportJson["findings"][number];
/** White-label brand (ADR-017 §2); absent → neutral look. */
export type ClientReportBrand = AgencyBrand & { logoDataUri: string | null };
type Options = {
  screenshots?: ReadonlyMap<string, string>;
  brand?: ClientReportBrand;
};

const MAX_BYTES = 500_000;
const TARGET_BYTES = 480_000;

const SEVERITY = {
  S1: "Critical",
  S2: "High",
  S3: "Medium",
  S4: "Low",
} as const;

/** Why each handbook phase matters, in an owner's words. */
const PHASE_WHY: Record<string, string> = {
  P2: "Search engines and AI crawlers read the HTML your server sends; content they cannot see cannot rank or be quoted.",
  P3: "Crawl and index hygiene decides which of your URLs search engines keep.",
  P4: "Titles, headings and links are how search results and AI answers describe your pages.",
  P5: "Clear, specific, sourced copy is what answer engines quote and customers trust.",
  P6: "Structured data tells search engines exactly what each page is about.",
  P7: "Slow pages lose visitors and rank lower.",
  P8: "Accessible, secure pages work for everyone and are trusted by browsers.",
  P9: "AI crawlers and llms.txt decide what AI assistants know about your business.",
};
const EFFORT = { S: "small", M: "medium", L: "large" } as const;

/** Escapes HTML, plus backtick and `$` so no `${` survives (upstream save rule). */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("`", "&#96;")
    .replaceAll("$", "&#36;");
}

const CSS = `
body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a1a1a;max-width:860px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.6rem;margin-bottom:.25rem}h2{margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
.card{display:flex;gap:1.5rem;align-items:center;border:1px solid #ddd;border-radius:8px;padding:1rem 1.25rem}
.grade{font-size:3rem;font-weight:700;line-height:1}.muted{color:#555;font-size:.9rem}
.sev{display:inline-block;font-size:.75rem;font-weight:600;padding:.05rem .4rem;border-radius:4px;margin-right:.4rem;border:1px solid currentColor}
.S1{color:#a40000}.S2{color:#b34700}.S3{color:#7a5c00}.S4{color:#335}
.ai{font-size:.75rem;color:#4b3c8f;border:1px solid #4b3c8f;border-radius:4px;padding:0 .3rem;margin-left:.3rem}
pre{white-space:pre-wrap;word-break:break-word;background:#f6f6f6;padding:.5rem;border-radius:4px;font-size:.8rem}
img{max-width:100%;border:1px solid #ddd}article{margin:1rem 0 1.5rem}ul{padding-left:1.2rem}
@media print{body{margin:0;max-width:none}h2{break-after:avoid}article,.card{break-inside:avoid}a{color:inherit}}
`;

function isSameSite(url: string, origin: string): boolean {
  try {
    return new URL(url).host === new URL(origin).host;
  } catch {
    return false;
  }
}

/** A link only for URLs on the audited site; anything else is plain text. */
function urlHtml(url: string, origin: string): string {
  const text = escapeHtml(url);
  return isSameSite(url, origin) ? `<a href="${text}">${text}</a>` : text;
}

/** Same grouping as the review report: one fix text, many findings. */
function topFixes(report: ReportJson): Finding[][] {
  const fixable = report.findings.filter((f) => f.fixability === "FIXABLE");
  fixable.sort(
    (a, b) =>
      a.severity.localeCompare(b.severity) ||
      "SML".indexOf(a.effort) - "SML".indexOf(b.effort),
  );
  const byFix = new Map<string, Finding[]>();
  for (const f of fixable) byFix.set(f.fix, [...(byFix.get(f.fix) ?? []), f]);
  return [...byFix.values()].slice(0, 8);
}

const ai = (f: Finding) =>
  f.source === "llm" ? '<span class="ai">AI-reviewed</span>' : "";

type Budget = {
  screenshots: ReadonlyMap<string, string>;
  excerptChars: number;
  evidence: boolean;
  maxFindings: number;
  brand?: ClientReportBrand;
};

function render(
  report: ReportJson,
  registry: readonly Pick<RegistryEntry, "id" | "text">[],
  budget: Budget,
): string {
  const { origin } = report.site;
  const host = new URL(origin).host;
  const esc = escapeHtml;
  const textOf = new Map(registry.map((e) => [e.id, e.text]));
  const score = report.score;
  const date = report.generatedAt.slice(0, 10);
  const urls = (list: readonly string[]) =>
    list.length === 0
      ? ""
      : `<ul>${list
          .slice(0, 5)
          .map((u) => `<li>${urlHtml(u, origin)}</li>`)
          .join(
            "",
          )}${list.length > 5 ? `<li>…and ${list.length - 5} more</li>` : ""}</ul>`;
  const shot = (f: Finding) => {
    const url = f.urls.find((u) => budget.screenshots.has(u));
    const data = url ? budget.screenshots.get(url) : undefined;
    return data?.startsWith("data:image/")
      ? `<img src="${esc(data)}" alt="Screenshot of ${esc(url ?? "")}">`
      : "";
  };
  const evidence = (f: Finding) =>
    budget.evidence
      ? f.evidence
          .slice(0, 2)
          .map(
            (e) =>
              `<p class="muted">${esc(e.kind)} · ${urlHtml(e.url, origin)}</p><pre>${esc(e.excerpt.slice(0, budget.excerptChars))}</pre>`,
          )
          .join("")
      : "";

  const passes = report.items.filter((i) => i.status === "PASS");
  const blocked = report.items.filter((i) => i.status === "BLOCKED");
  const limited = report.findings.filter((f) => f.fixability === "LIMITED");
  const pages = new Set(report.findings.flatMap((f) => f.urls)).size;
  const kinds = [
    ...new Set(report.findings.flatMap((f) => f.evidence.map((e) => e.kind))),
  ];
  const provisional = report.items.some((i) =>
    i.note?.startsWith("render unavailable"),
  );

  const parts: string[] = [
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SEO &amp; AI search review — ${esc(host)}</title><style>${CSS}${brandCss(budget.brand)}</style></head><body>`,
    ...brandHeader(budget.brand),
    `<h1>SEO &amp; AI search review — ${esc(host)}</h1>`,
    `<p class="muted">${esc(date)} · handbook v${esc(report.handbookVersion)} · ${esc(report.run.mode)} · tier ${esc(report.run.tier)}${report.site.platform ? ` · platform ${esc(report.site.platform)}` : ""}</p>`,
  ];
  if (score)
    parts.push(
      `<div class="card"><div class="grade">${esc(score.grade)}</div><div><strong>${score.final} / 100</strong>${
        score.capReason
          ? `<br>Capped from ${score.uncapped}: a critical problem limits the grade until it is fixed (${esc(score.capReason)}).`
          : ""
      }${provisional ? "<br>Provisional: the page-rendering check could not run, so problems only visible after JavaScript are not counted yet." : ""}<br><span class="muted">Scores compare only between reviews on the same handbook version.</span></div></div>`,
    );
  parts.push(
    "<h2>What we checked</h2>",
    `<p>${report.items.length} handbook checks on ${esc(host)}: ${passes.length} passed, ${report.findings.length} problems found on ${pages} page(s), ${blocked.length} need your access. Evidence collected: ${esc(kinds.join(", ") || "none")}.</p>`,
    "<h2>Top fixes</h2>",
  );
  const fixes = topFixes(report);
  if (fixes.length === 0) parts.push("<p>No fixable problems found.</p>");
  for (const group of fixes) {
    const f = group[0];
    parts.push(
      `<article><h3><span class="sev ${f.severity}">${SEVERITY[f.severity]}</span>${esc(f.title)}${ai(f)}</h3><p>${esc(f.fix)}</p><p class="muted">Why it matters: ${esc(PHASE_WHY[f.phase] ?? "It affects how search engines and AI assistants read your site.")} · Effort: ${EFFORT[f.effort]}</p>${urls([...new Set(group.flatMap((g) => g.urls))])}</article>`,
    );
  }
  parts.push("<h2>All findings</h2>");
  const findings = [...report.findings];
  findings.sort((a, b) => a.severity.localeCompare(b.severity));
  for (const f of findings.slice(0, budget.maxFindings))
    parts.push(
      `<article><h3><span class="sev ${f.severity}">${SEVERITY[f.severity]}</span>${esc(f.code)} ${esc(f.title)}${ai(f)}</h3><p>${esc(f.detail)}</p>${urls(f.urls)}${shot(f)}${evidence(f)}</article>`,
    );
  if (findings.length > budget.maxFindings)
    parts.push(
      `<p class="muted">${findings.length - budget.maxFindings} more findings are in the full report file.</p>`,
    );
  parts.push(
    `<h2>What passed (${passes.length})</h2><ul>${passes
      .slice(0, 15)
      .map((i) => `<li>${esc(textOf.get(i.itemId) ?? i.itemId)}</li>`)
      .join(
        "",
      )}${passes.length > 15 ? `<li>…and ${passes.length - 15} more</li>` : ""}</ul>`,
    `<h2>Needs your access</h2>${
      blocked.length === 0
        ? "<p>Nothing.</p>"
        : `<ul>${blocked
            .map(
              (i) =>
                `<li>${esc(textOf.get(i.itemId) ?? i.itemId)}${i.note ? ` — <span class="muted">${esc(i.note)}</span>` : ""}</li>`,
            )
            .join("")}</ul>`
    }`,
    `<h2>Platform limits</h2>${
      limited.length === 0
        ? "<p>None recorded.</p>"
        : `<ul>${limited
            .map(
              (f) =>
                `<li>${esc(f.title)} — ${esc(f.limitedReason ?? "platform limit")}</li>`,
            )
            .join("")}</ul>`
    }`,
    `<h2>How this review works</h2><p>Every check follows the SEO/GEO handbook v${esc(report.handbookVersion)} and is backed by evidence fetched from your site on ${esc(date)}. No ranking, traffic or backlink data is used. Items marked <span class="ai">AI-reviewed</span> were judged by a language model against a fixed rule and quoted text from your pages; they never block a release or cap the grade.</p>`,
    ...brandFooter(budget.brand),
    "</body></html>",
  );
  return parts.join("\n");
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const LOGO_URI = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function brandCss(brand: ClientReportBrand | undefined): string {
  if (!brand || !HEX.test(brand.accentColor)) return "";
  const c = brand.accentColor;
  return `h1,h2{color:${c}}h2{border-bottom-color:${c}}.card{border-color:${c}}.grade{color:${c}}.brand{display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;font-weight:600}.brand img{max-height:48px;border:0}`;
}

function brandHeader(brand: ClientReportBrand | undefined): string[] {
  if (!brand) return [];
  const logo =
    brand.logoDataUri && LOGO_URI.test(brand.logoDataUri)
      ? `<img src="${brand.logoDataUri}" alt="${escapeHtml(brand.agencyName)}">`
      : "";
  return [
    `<div class="brand">${logo}<span>${escapeHtml(brand.agencyName)}</span></div>`,
  ];
}

function brandFooter(brand: ClientReportBrand | undefined): string[] {
  if (!brand) return [];
  const lines = [
    `<strong>${escapeHtml(brand.agencyName)}</strong>`,
    brand.contactLine ? escapeHtml(brand.contactLine) : "",
    brand.footerText ? escapeHtml(brand.footerText) : "",
    brand.hideOpenseoCredit ? "" : "Prepared with OpenSEO.",
  ].filter(Boolean);
  return [`<footer class="muted"><hr>${lines.join("<br>")}</footer>`];
}

const bytes = (html: string) => new TextEncoder().encode(html).length;

/**
 * Renders under the byte budget: all screenshots → top-fix screenshots →
 * none → 300-char excerpts → no excerpts → fewer findings. Never > 500 KB.
 */
export function renderClientReportHtml(
  report: ReportJson,
  registry: readonly Pick<RegistryEntry, "id" | "text">[],
  options: Options = {},
): string {
  const all = options.screenshots ?? new Map<string, string>();
  const topUrls = new Set(
    topFixes(report).flatMap((g) => g.flatMap((f) => f.urls)),
  );
  const top = new Map([...all].filter(([url]) => topUrls.has(url)));
  const none = new Map<string, string>();
  const brand = options.brand;
  const full = {
    excerptChars: 1_800,
    evidence: true,
    maxFindings: 500,
    brand,
  };
  const steps: Budget[] = [
    { ...full, screenshots: all },
    { ...full, screenshots: top },
    { ...full, screenshots: none },
    { ...full, screenshots: none, excerptChars: 300 },
    { ...full, screenshots: none, evidence: false },
  ];
  for (const budget of steps) {
    const html = render(report, registry, budget);
    if (bytes(html) <= TARGET_BYTES) return html;
  }
  let maxFindings = report.findings.length;
  for (;;) {
    maxFindings = Math.floor(maxFindings / 2);
    const html = render(report, registry, {
      screenshots: none,
      excerptChars: 0,
      evidence: false,
      maxFindings,
      brand,
    });
    if (bytes(html) <= MAX_BYTES || maxFindings === 0) return html;
  }
}
