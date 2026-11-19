import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import type { ItemStatus } from "@/server/features/handbook/contracts/status";
import { copyQualityMd } from "./copy-quality-md";
import { scaledContentRows } from "@/server/features/handbook/contracts/scaled-copy";
import { depthLine } from "../engine/depth";

/**
 * K7 markdown exports, rendered from a ReportJson (spec: fork/adr/ADR-012).
 * - BUILD / AUDIT / MAINTAIN: `seo-geo-status.md` in the handbook EP-5
 *   template, plus `seo-audit-baseline.md` (EP-5 table) for findings.
 * - REVIEW: one EP-7 report, no status files.
 */

type Item = ReportJson["items"][number];
type Finding = ReportJson["findings"][number];

const cell = (text: string | null | undefined) =>
  (text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

const day = (iso: string) => iso.slice(0, 10);

/** Handbook item vocabulary (§0): PASS → DONE, NA → N/A, PARTIAL → OPEN. */
const HANDBOOK_STATUS: Record<ItemStatus, string> = {
  PASS: "DONE",
  PARTIAL: "OPEN",
  OPEN: "OPEN",
  BLOCKED: "BLOCKED",
  NA: "N/A",
  LIMITED: "LIMITED",
  DEFERRED: "DEFERRED",
};

/** EP-5 phase gate: FAIL = a tested defect remains; BLOCKED = evidence missing. */
function phaseGate(items: readonly Item[]) {
  const has = (...s: ItemStatus[]) => items.some((i) => s.includes(i.status));
  if (has("OPEN", "PARTIAL")) return "FAIL";
  if (has("BLOCKED")) return "BLOCKED";
  if (has("PASS", "LIMITED")) return "PASS";
  return "N/A";
}

function counts(items: readonly Item[]) {
  const byStatus = new Map<string, number>();
  for (const i of items)
    byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
  return [...byStatus].map(([s, n]) => `${n} ${s}`).join(", ");
}

/**
 * WO-B4-006: without the render collector the grade cannot see JS-only
 * content or S1 render defects. Detected from the runner's BLOCKED notes
 * ("render unavailable: …"), as ReportJson has no collector field.
 */
function provisionalLine(report: ReportJson): string | null {
  return report.items.some((i) => i.note?.startsWith("render unavailable"))
    ? "Grade provisional: render evidence missing (JS-only content and S1 render defects cannot be seen)"
    : null;
}

const phasesOf = (report: ReportJson) => [
  ...new Set(report.items.map((i) => i.phase)),
];

/** `seo-geo-status.md`, EP-5 template (handbook v4.6 §0). */
export function renderStatusMd(
  report: ReportJson,
  registry: readonly Pick<RegistryEntry, "id" | "text">[],
): string {
  const textOf = new Map(registry.map((e) => [e.id, e.text]));
  const sp12 = report.siteProfile.find((sp) => sp.code === "SP12");
  const provisional = provisionalLine(report);
  const date = day(report.generatedAt);
  const lines = [
    "# SEO/GEO Status",
    `handbook: ${report.handbookVersion} | mode: ${report.run.mode} | tier: ${report.run.tier} (${cell(report.run.tierEvidence)}) | updated: ${date}`,
    depthLine(report.run.depth, report.run.coverage),
    ...(provisional ? [provisional] : []),
    "## Site Profile",
    "| SP | Y/N/? | evidence | confidence |",
    "| --- | --- | --- | --- |",
    ...report.siteProfile.map(
      (sp) =>
        `| ${sp.code} | ${sp.value} | ${cell(sp.evidence)} | ${sp.confidence} |`,
    ),
    "## Decisions",
    // Owner decisions; the run fills only what it observed.
    `training bots: · GSC Search generative AI: · canonical host: ${new URL(report.site.origin).host} · trailing slash: · consent: · CDN: ${sp12?.value === "Y" ? cell(sp12.evidence) : ""}`,
    "## Phase gates",
    "| Phase | OPEN/PASS/FAIL/BLOCKED/N/A | date | evidence |",
    "| --- | --- | --- | --- |",
    ...phasesOf(report).map((phase) => {
      const items = report.items.filter((i) => i.phase === phase);
      const codes = [...new Set(items.flatMap((i) => i.findingCodes))];
      return `| ${phase} | ${phaseGate(items)} | ${date} | ${counts(items)}${codes.length ? ` (${codes.join(", ")})` : ""} |`;
    }),
    "## Release",
    report.release.status === "RELEASE_BLOCKED"
      ? `RELEASE BLOCKED (${report.release.blockingItemIds.join(", ")})`
      : "CLEAR",
    "## Checklist (§41 copy)",
    ...report.items.map((i) => {
      const note = [
        i.status === "PARTIAL" ? "partial" : "",
        cell(i.note),
        i.findingCodes.join(", "),
      ]
        .filter(Boolean)
        .join(" · ");
      return `- [${HANDBOOK_STATUS[i.status]}] ${cell(textOf.get(i.itemId) ?? i.itemId)}${note ? ` — ${note}` : ""}`;
    }),
    "## Blocked / owner needed",
    ...itemList(report, "BLOCKED", textOf),
    "## Deferred (trigger)",
    ...itemList(report, "DEFERRED", textOf),
    "",
  ];
  return lines.join("\n");
}

/** `seo-audit-baseline.md` (EP-5): `| ID | Handbook § | Template / URL | Finding | Severity | Fix |`. */
export function renderAuditBaselineMd(report: ReportJson): string {
  return [
    "# SEO/GEO Audit Baseline",
    `handbook: ${report.handbookVersion} | site: ${report.site.origin} | run: ${report.run.id} | date: ${day(report.generatedAt)}`,
    "",
    "| ID | Handbook § | Template / URL | Finding | Severity | Fix |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.findings.map(
      (f) =>
        `| ${f.code} | ${f.sectionRef} | ${cell(urlSummary(f))} | ${cell(f.title)}: ${cell(f.detail).slice(0, 400)} | ${f.severity} | ${cell(f.fix)} |`,
    ),
    "",
  ].join("\n");
}

const orNone = (xs: string[]) => (xs.length > 0 ? xs : ["- none needed"]);

/** BLOCKED notes that need the owner (accounts, access, consoles, decisions). */
const OWNER_NOTE =
  /owner|access|credential|login|account|search console|\bgsc\b|analytics|dns|registrar|decision/i;

/**
 * `seo-owner-todo.md` (EP-5, P0-02): owner questions batched in one file.
 * Every section prints "none needed" when empty.
 */
export function renderOwnerTodoMd(
  report: ReportJson,
  registry: readonly Pick<RegistryEntry, "id" | "text" | "class">[],
): string {
  const entry = new Map(registry.map((e) => [e.id, e]));
  const facts = report.siteProfile
    .filter((sp) => sp.value === "?" || sp.confidence === "low")
    .map(
      (sp) =>
        `- ${sp.code} (now ${sp.value}, ${sp.confidence} confidence): ${cell(sp.evidence)}`,
    );
  const confirm = [
    ...report.findings
      .filter((f) => f.fixability === "LIMITED")
      .map(
        (f) =>
          `- ${f.code} ${cell(f.title)} — ${cell(f.limitedReason ?? "platform limit")}`,
      ),
    ...report.items
      .filter(
        (i) =>
          entry.get(i.itemId)?.class === "OWNER" &&
          i.status !== "NA" &&
          i.status !== "PASS",
      )
      .map(
        (i) =>
          `- ${i.itemId} ${cell(entry.get(i.itemId)?.text ?? "")} (${i.status})`,
      ),
  ];
  const sp12 = report.siteProfile.find((sp) => sp.code === "SP12");
  const policy = [
    "- Training bots (GPTBot, ClaudeBot, Google-Extended…): allow or block?",
    "- Google Search Console generative AI features: opt in or out?",
    "- Trailing slash: with or without (one form, the other redirects)?",
    "- Consent: which tags wait for consent, and which banner?",
    ...(sp12?.value === "Y" ? [] : ["- CDN: which one, and who manages it?"]),
  ];
  const todo = report.items
    .filter((i) => i.status === "BLOCKED" && OWNER_NOTE.test(i.note ?? ""))
    .map(
      (i) =>
        `- TODO(owner) ${i.itemId} ${cell(entry.get(i.itemId)?.text ?? "")} — ${cell(i.note)}`,
    );
  return [
    "# SEO/GEO owner to-do",
    `site: ${report.site.origin} | handbook: ${report.handbookVersion} | run: ${report.run.id} | date: ${day(report.generatedAt)}`,
    "",
    "## Business facts needed",
    ...orNone(facts),
    "",
    "## Confirm before acting",
    ...orNone(confirm),
    "",
    "## Policy decisions",
    ...policy,
    "",
    "## TODO(owner)",
    ...orNone(todo),
    "",
  ].join("\n");
}

const EFFORT_RANK = { S: 0, M: 1, L: 2 } as const;

/** EP-7 REVIEW report: one document, sections in REVIEW_REPORT_SECTIONS order. */
export function renderReviewMd(
  report: ReportJson,
  registry: readonly Pick<RegistryEntry, "id" | "text">[],
): string {
  const textOf = new Map(registry.map((e) => [e.id, e.text]));
  const score = report.score;
  const platform = report.site.platform ?? "not detected";
  const provisional = provisionalLine(report);
  const evidenceKinds = new Map<string, number>();
  for (const f of report.findings)
    for (const e of f.evidence)
      evidenceKinds.set(e.kind, (evidenceKinds.get(e.kind) ?? 0) + 1);

  const fixable = report.findings.filter((f) => f.fixability === "FIXABLE");
  fixable.sort(
    (a, b) =>
      a.severity.localeCompare(b.severity) ||
      EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort],
  );
  const topFixes = new Map<string, Finding[]>();
  for (const f of fixable)
    topFixes.set(f.fix, [...(topFixes.get(f.fix) ?? []), f]);

  const lines = [
    `# On-site SEO/GEO review — ${new URL(report.site.origin).host}`,
    "",
    `- Handbook: v${report.handbookVersion} · Date: ${day(report.generatedAt)} · Mode: ${report.run.mode} · Tier: ${report.run.tier} (${cell(report.run.tierEvidence)}) · Platform: ${platform}`,
    `- ${depthLine(report.run.depth, report.run.coverage)}`,
    `- Evidence: ${[...evidenceKinds].map(([k, n]) => `${k} ×${n}`).join(", ") || "none"} · run ${report.run.id}`,
    "- Ranking, traffic and backlink data: not used (EP-7).",
    ...(provisional ? [`- ${provisional}`] : []),
    "",
  ];
  if (score) {
    lines.push(
      `## Grade: ${score.final} / 100 — ${score.grade}${score.capReason ? ` (capped; ${score.uncapped} uncapped — ${score.capReason})` : ""}`,
      "",
      `Handbook v${report.handbookVersion}. Scores compare only between runs on the same handbook version.`,
      "",
      "| Phase | Weight | Score | Driver |",
      "| --- | --- | --- | --- |",
      ...score.phases.map(
        (p) =>
          `| ${p.phase} | ${p.weight} | ${p.score ?? "not applicable"} | ${cell(p.driver)} |`,
      ),
      "| P0, P1, P10, P11 | — | not scored | — |",
      "",
    );
  }
  lines.push(
    "## Site Profile (inferred)",
    "",
    "| SP | Value | Evidence | Confidence |",
    "| --- | --- | --- | --- |",
    ...report.siteProfile.map(
      (sp) =>
        `| ${sp.code} | ${sp.value} | ${cell(sp.evidence)} | ${sp.confidence} |`,
    ),
    "",
    "## Top fixes (FIXABLE, severity then effort)",
    "",
    "| # | Fix | Findings | Effort |",
    "| --- | --- | --- | --- |",
    ...[...topFixes]
      .slice(0, 12)
      .map(
        ([fix, fs], n) =>
          `| ${n + 1} | ${cell(fix)} | ${fs.map((f) => f.code).join(", ")} | ${fs[0].effort} |`,
      ),
    "",
    "## Findings",
    "",
  );
  for (const sev of ["S1", "S2", "S3", "S4"] as const) {
    const fs = report.findings.filter((f) => f.severity === sev);
    if (!fs.length) continue;
    lines.push(
      `### ${sev}`,
      "",
      "| ID | § | Finding | Evidence |",
      "| --- | --- | --- | --- |",
      ...fs.map(
        (f) =>
          `| ${f.code} | ${f.sectionRef} | ${cell(f.title)}. ${cell(f.detail).slice(0, 500)}${f.source === "llm" ? " (LLM-judged)" : ""} | ${cell(evidenceSummary(f))} |`,
      ),
      "",
    );
  }
  const limitedFindings = report.findings.filter(
    (f) => f.fixability === "LIMITED",
  );
  lines.push(
    "## Passes",
    "",
    ...itemList(report, "PASS", textOf),
    "",
    "## Limited (platform)",
    "",
    ...(limitedFindings.length ||
    report.items.some((i) => i.status === "LIMITED")
      ? [
          ...limitedFindings.map(
            (f) => `- ${f.code} ${cell(f.title)} — ${cell(f.limitedReason)}`,
          ),
          ...report.items
            .filter((i) => i.status === "LIMITED")
            .map((i) => `- ${i.itemId}: ${cell(i.note)}`),
        ]
      : ["- none"]),
    "",
    "## Blocked (owner access)",
    "",
    ...itemList(report, "BLOCKED", textOf),
    "",
    "## Outside scope — noted",
    "",
    ...(report.outsideScope.length
      ? report.outsideScope.map((o) => `- ${cell(o)}`)
      : ["- none"]),
    "",
    "## Additional findings (not scored)",
    "",
    ...(report.additionalFindings?.length
      ? [
          "| ID | Rule | Severity | Finding | Evidence |",
          "| --- | --- | --- | --- | --- |",
          ...report.additionalFindings.map(
            (f) =>
              `| ${f.code} | ${f.itemIds.join(", ")} | ${f.severity} | ${cell(f.title)}. ${cell(f.detail).slice(0, 500)} | ${cell(evidenceSummary(f))} |`,
          ),
        ]
      : ["- none"]),
    "",
    "## Answer-engine readiness (not scored)",
    "",
    ...(report.answerEngineReadiness?.length
      ? report.answerEngineReadiness.map(
          (r) => `- ${cell(r.label)}: ${cell(r.value)}`,
        )
      : ["- not collected"]),
    "",
    ...(report.scaledContent
      ? [
          "## Scaled content (not scored)",
          "",
          ...scaledContentRows(report.scaledContent).map(
            (r) => `- ${cell(r.label)}: ${cell(r.value)}`,
          ),
          "",
        ]
      : []),
    ...(report.copyQuality ? copyQualityMd(report.copyQuality) : []),
    "## Escalations",
    "",
    ...(report.escalations?.length
      ? report.escalations.map(
          (e) =>
            `- Escalated: ${cell(e.action)} because ${cell(e.because)} (${e.urls.length} URLs${e.capped ? ", capped" : ""})`,
        )
      : ["- none"]),
    "",
    "## Checker errors",
    "",
    ...(report.checkerErrors.length
      ? report.checkerErrors.map((e) => `- ${cell(e)}`)
      : ["- none"]),
    "",
    "## Residual weaknesses",
    "",
    ...residualWeaknesses(report),
    "",
  );
  return lines.join("\n");
}

function residualWeaknesses(report: ReportJson) {
  const out: string[] = [];
  const llm = report.findings.filter((f) => f.source === "llm").length;
  if (llm)
    out.push(
      `- ${llm} finding(s) are LLM-judged (quotes verified against fetched text); they never cap the grade or block a release.`,
    );
  const noLlm = report.items.filter(
    (i) => i.status === "BLOCKED" && i.note?.includes("llm"),
  ).length;
  if (noLlm)
    out.push(
      `- ${noLlm} item(s) BLOCKED for want of the LLM judge; the grade excludes them.`,
    );
  out.push(
    "- Above ~50 URLs the crawl samples pages per template; a defect on an unsampled page can be missed.",
    "- Single run: grades compared across sites or dates need two independent runs (EP-7 repeatability).",
  );
  return out;
}

function urlSummary(f: Finding) {
  if (f.urls.length <= 3) return f.urls.join(", ");
  return `${f.urls.slice(0, 3).join(", ")} (+${f.urls.length - 3})`;
}

function evidenceSummary(f: Finding) {
  return f.evidence
    .slice(0, 2)
    .map((e) => `${e.kind} ${e.url}`)
    .join("; ");
}

function itemList(
  report: ReportJson,
  status: ItemStatus,
  textOf: Map<string, string>,
) {
  const items = report.items.filter((i) => i.status === status);
  if (items.length === 0) return ["- none"];
  return items.map(
    (i) =>
      `- ${i.itemId} ${cell(textOf.get(i.itemId) ?? "")}${i.note ? ` — ${cell(i.note)}` : ""}`,
  );
}
