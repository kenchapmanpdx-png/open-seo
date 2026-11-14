import {
  REPORT_JSON_VERSION,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import type { HandbookMode } from "@/server/features/handbook/contracts/status";
import type { RunResult } from "./runner";

/**
 * RunResult → K7 ReportJson, and the EP-5 `seo-geo-status.md` draft.
 * Scoring (EP-7) lands in B3; until then `score` is null.
 */
export function buildReportJson(input: {
  result: RunResult;
  registry: readonly RegistryEntry[];
  handbookVersion: string;
  runId: string;
  origin: string;
  mode: HandbookMode;
  startedAt: string;
  finishedAt: string | null;
}): ReportJson {
  const { result } = input;
  const phaseOf = new Map(input.registry.map((e) => [e.id, e.phase]));
  const codesByItem = new Map<string, string[]>();
  for (const f of result.findings) {
    for (const id of f.itemIds)
      codesByItem.set(id, [...(codesByItem.get(id) ?? []), f.code]);
  }
  const s1Open = result.findings.filter((f) => f.severity === "S1");
  return {
    reportVersion: REPORT_JSON_VERSION,
    contractsVersion: CONTRACTS_VERSION,
    handbookVersion: input.handbookVersion,
    generatedAt: input.finishedAt ?? input.startedAt,
    site: { origin: input.origin, platform: null },
    run: {
      id: input.runId,
      mode: input.mode,
      tier: result.intake.tier,
      tierEvidence: result.intake.tierEvidence,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    },
    score: null,
    siteProfile: result.intake.siteProfile,
    findings: result.findings.map((f) => ({
      code: f.code,
      severity: f.severity,
      phase: f.phase,
      sectionRef: f.sectionRef,
      title: f.title,
      detail: f.detail,
      fix: f.fix,
      fixability: f.fixability,
      limitedReason: f.limitedReason ?? null,
      effort: f.effort,
      source: f.source,
      itemIds: [...f.itemIds],
      urls: [...f.urls],
      evidence: result.evidence
        .filter((e) => e.findingCode === f.code)
        .map((e) => ({ kind: e.kind, url: e.url, excerpt: e.excerpt })),
    })),
    items: result.statuses.map((s) => ({
      itemId: s.itemId,
      phase: phaseOf.get(s.itemId) ?? "",
      status: s.status,
      note: s.note,
      findingCodes: codesByItem.get(s.itemId) ?? [],
    })),
    release: {
      status:
        input.mode === "REVIEW"
          ? "NOT_APPLICABLE"
          : s1Open.length > 0
            ? "RELEASE_BLOCKED"
            : "CLEAR",
      blockingItemIds: [...new Set(s1Open.flatMap((f) => f.itemIds))],
    },
    checkerErrors: result.checkerErrors,
    outsideScope: [],
  };
}

const cell = (text: string | null | undefined) =>
  (text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** EP-5 `seo-geo-status.md` (section order: STATUS_MD_SECTIONS). */
export function renderStatusMd(
  report: ReportJson,
  registry: readonly RegistryEntry[],
): string {
  const textOf = new Map(registry.map((e) => [e.id, e.text]));
  const lines: string[] = [
    `# seo-geo-status — ${report.site.origin}`,
    "",
    `Mode: ${report.run.mode} · Tier: ${report.run.tier} (${report.run.tierEvidence}) · Handbook v${report.handbookVersion} · Run ${report.run.id} · ${report.generatedAt}`,
    "",
    "## Site Profile",
    "",
    "| SP | Answer | Evidence | Confidence |",
    "| --- | --- | --- | --- |",
    ...report.siteProfile.map(
      (sp) =>
        `| ${sp.code} | ${sp.value} | ${cell(sp.evidence)} | ${sp.confidence} |`,
    ),
    "",
    "## Decisions",
    "",
    "- (owner decisions are recorded here; none captured by the automated run)",
    "",
    "## Phase gates",
    "",
    "| Phase | PASS | PARTIAL | OPEN | LIMITED | BLOCKED | DEFERRED | NA |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const phases = [...new Set(report.items.map((i) => i.phase))];
  for (const phase of phases) {
    const items = report.items.filter((i) => i.phase === phase);
    const count = (s: string) => items.filter((i) => i.status === s).length;
    lines.push(
      `| ${phase} | ${["PASS", "PARTIAL", "OPEN", "LIMITED", "BLOCKED", "DEFERRED", "NA"].map(count).join(" | ")} |`,
    );
  }
  lines.push(
    "",
    "## Release",
    "",
    `${report.release.status}${report.release.blockingItemIds.length ? ` (${report.release.blockingItemIds.join(", ")})` : ""}`,
    "",
    "## Checklist (§41 copy)",
    "",
    "| Item | Status | Findings | Note | Text |",
    "| --- | --- | --- | --- | --- |",
    ...report.items.map((i) => {
      // Handbook vocabulary: PASS is written DONE outside REVIEW (ADR-005).
      const status =
        i.status === "PASS" && report.run.mode !== "REVIEW" ? "DONE" : i.status;
      return `| ${i.itemId} | ${status} | ${i.findingCodes.join(", ")} | ${cell(i.note)} | ${cell(textOf.get(i.itemId))} |`;
    }),
    "",
    "## Blocked / owner needed",
    "",
    ...listItems(report, "BLOCKED"),
    "",
    "## Deferred (trigger)",
    "",
    ...listItems(report, "DEFERRED"),
    "",
  );
  if (report.findings.length) {
    lines.push("## Findings", "");
    for (const f of report.findings) {
      lines.push(
        `### ${f.code} · ${f.severity} · ${f.title}`,
        "",
        `Items: ${f.itemIds.join(", ")} · ${f.sectionRef} · ${f.fixability} · effort ${f.effort}`,
        "",
        f.detail,
        "",
        `Fix: ${f.fix}`,
        "",
        ...f.urls.slice(0, 10).map((u) => `- ${u}`),
        ...f.evidence
          .slice(0, 3)
          .map(
            (e) =>
              `- evidence (${e.kind}) ${e.url}: \`${cell(e.excerpt).slice(0, 300)}\``,
          ),
        "",
      );
    }
  }
  if (report.checkerErrors.length) {
    lines.push(
      "## Checker errors",
      "",
      ...report.checkerErrors.map((e) => `- ${e}`),
      "",
    );
  }
  return lines.join("\n");
}

function listItems(report: ReportJson, status: string) {
  const items = report.items.filter((i) => i.status === status);
  if (items.length === 0) return ["- none"];
  return items.map((i) => `- ${i.itemId}: ${cell(i.note)}`);
}
