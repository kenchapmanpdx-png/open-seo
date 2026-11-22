import { REGISTRY } from "@/server/features/handbook/registry";
import { getReportRows } from "@/server/features/handbook/repositories/HandbookReportRepository";
import {
  REPORT_JSON_VERSION,
  reportJsonSchema,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { scoreReport } from "@/server/features/handbook/engine/report";
import { withCategories } from "@/server/features/handbook/engine/categories";
import { isSuppOnly } from "../registry-supp";
import { unreadCoverage } from "@/server/features/handbook/engine/unread";
import { HandbookGradeRepository } from "@/server/features/handbook/repositories/HandbookGradeRepository";

/**
 * Report building and scoring for a stored run (B13 WO-B13-008). One code
 * path for the run page, the report stage (grade persisted on the run row)
 * and `ops backfill-grades`; kept apart from HandbookService so the run
 * service and the backfill script can import it without a cycle or the
 * Reports / Agency services.
 */
export type ReportRows = NonNullable<Awaited<ReturnType<typeof getReportRows>>>;

/** K6 score of the run's report.json, or null when the run is not in `projectId`. */
export async function scoreRun(
  projectId: string,
  runId: string,
): Promise<ReturnType<typeof scoreReport> | null> {
  const rows = await getReportRows(projectId, runId);
  return rows ? buildReport(rows).score : null;
}

export function buildReport(rows: ReportRows): ReportJson {
  const { run } = rows;
  const phaseOf = new Map(REGISTRY.map((e) => [e.id, e.phase]));
  const codesByItem = new Map<string, string[]>();
  const codeOf = new Map(rows.findings.map((f) => [f.id, f.code]));
  for (const fi of rows.findingItems) {
    const code = codeOf.get(fi.findingId);
    if (code)
      codesByItem.set(fi.itemId, [...(codesByItem.get(fi.itemId) ?? []), code]);
  }
  const all = rows.findings.map((f) => ({
    code: f.code,
    severity: f.severity,
    phase: f.phase,
    sectionRef: f.sectionRef ?? "",
    title: f.title,
    detail: f.detail,
    fix: f.fix,
    fixability: f.fixability,
    limitedReason: f.limitedReason,
    effort: f.effort,
    source: f.source,
    itemIds: rows.findingItems
      .filter((x) => x.findingId === f.id)
      .map((x) => x.itemId),
    urls: rows.findingUrls
      .filter((x) => x.findingId === f.id)
      .map((x) => x.url),
    evidence: rows.evidence
      .filter((e) => e.findingId === f.id)
      .map((e) => ({ kind: e.kind, url: e.url, excerpt: e.excerpt })),
  }));
  // ADR-020: SUPP-only findings are reported apart and never scored or blocking.
  const findings = all.filter((f) => !isSuppOnly(f.itemIds));
  const additionalFindings = all.filter((f) => isSuppOnly(f.itemIds));
  const s1 = findings.filter((f) => f.severity === "S1" && f.source !== "llm");
  const report = reportJsonSchema.parse({
    reportVersion: REPORT_JSON_VERSION,
    contractsVersion: run.contractsVersion,
    handbookVersion: run.handbookVersion,
    generatedAt: run.finishedAt ?? run.startedAt,
    site: {
      origin: run.origin,
      platform:
        rows.items
          .find((i) => i.itemId === "P0-03")
          ?.note?.match(/^platform: (.+?) \(/)?.[1] ?? null,
    },
    run: {
      id: run.id,
      mode: run.mode,
      tier: run.tier ?? "T1",
      tierEvidence: "",
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      depth: run.depth,
      ...(run.coverageDiscovered !== null && run.coverageRead !== null
        ? {
            coverage: {
              discovered: run.coverageDiscovered,
              read: run.coverageRead,
              capped: run.coverageCapped,
              ...(rows.crawled.length
                ? { unread: unreadCoverage(rows.crawled, rows.read) }
                : {}),
            },
          }
        : {}),
    },
    score: null,
    siteProfile: rows.siteProfile.map((sp) => ({
      code: sp.spCode,
      value: sp.value,
      evidence: sp.evidence,
      confidence: sp.confidence,
    })),
    findings,
    ...(additionalFindings.length ? { additionalFindings } : {}),
    items: rows.items.map((i) => ({
      itemId: i.itemId,
      phase: phaseOf.get(i.itemId) ?? "",
      status: i.status,
      note: i.note,
      findingCodes: codesByItem.get(i.itemId) ?? [],
    })),
    release: {
      status:
        run.mode === "REVIEW"
          ? "NOT_APPLICABLE"
          : s1.length > 0
            ? "RELEASE_BLOCKED"
            : "CLEAR",
      blockingItemIds: [...new Set(s1.flatMap((f) => f.itemIds))],
    },
    checkerErrors: [],
    outsideScope: [],
  });
  return withCategories({ ...report, score: scoreReport(report) });
}

/**
 * Scores completed runs that have no stored grade (all projects) and saves
 * the grade; idempotent. Used by `ops backfill-grades`.
 */
export async function backfillGrades() {
  const runs = await HandbookGradeRepository.listUngradedRuns();
  const updated: { runId: string; grade: string; final: number }[] = [];
  for (const run of runs) {
    const score = await scoreRun(run.projectId, run.id);
    if (!score) continue;
    await HandbookGradeRepository.saveRunScore(run.projectId, run.id, score);
    updated.push({ runId: run.id, grade: score.grade, final: score.final });
  }
  return { found: runs.length, updated };
}
