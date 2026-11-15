import {
  REPORT_JSON_VERSION,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import type { HandbookMode } from "@/server/features/handbook/contracts/status";
import type { RunResult } from "./runner";
import { scoreItems } from "./scoring";

/**
 * RunResult → K7 ReportJson with the EP-7 score (K6). Markdown exports
 * render from the ReportJson (`../export/`).
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
  const report: ReportJson = {
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
  return { ...report, score: scoreReport(report) };
}

/**
 * EP-7 score of a report (K6). Works on a saved report.json too, so earlier
 * runs can be re-scored. LLM findings never cap the grade (ADR-007: never
 * release-blocking).
 */
export function scoreReport(
  report: ReportJson,
): NonNullable<ReportJson["score"]> {
  const findingByCode = new Map(report.findings.map((f) => [f.code, f]));
  const score = scoreItems({
    handbookVersion: report.handbookVersion,
    mode: report.run.mode,
    items: report.items.map((item) => {
      const linked = item.findingCodes.flatMap((code) => {
        const f = findingByCode.get(code);
        return f && f.source !== "llm" ? [f] : [];
      });
      return {
        itemId: item.itemId,
        phase: item.phase,
        status: item.status,
        openSeverities: linked.map((f) => f.severity),
        openFindingCodes: linked.map((f) => f.code),
      };
    }),
  });
  return {
    final: score.final,
    uncapped: score.uncapped,
    grade: score.grade,
    capReason: score.capReason,
    phases: score.phases.map((p) => ({
      phase: p.phase,
      weight: p.weight,
      score: p.score,
      driver: phaseDriver(report, p.phase),
    })),
  };
}

/** The two most severe findings behind the phase's OPEN/PARTIAL items. */
function phaseDriver(report: ReportJson, phase: string): string | null {
  const codes = new Set(
    report.items
      .filter(
        (i) =>
          i.phase === phase && (i.status === "OPEN" || i.status === "PARTIAL"),
      )
      .flatMap((i) => i.findingCodes),
  );
  const open = report.findings.filter((f) => codes.has(f.code));
  open.sort((a, b) => a.severity.localeCompare(b.severity));
  const drivers = open.slice(0, 2).map((f) => `${f.code} ${f.title}`);
  return drivers.length ? drivers.join("; ") : null;
}
