import { REGISTRY } from "@/server/features/handbook/registry";
import {
  backfillGrades,
  buildReport,
  scoreRun,
  type ReportRows,
} from "./HandbookScore";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import {
  getReportRows,
  getRunItemEvidence,
} from "@/server/features/handbook/repositories/HandbookReportRepository";
import type {
  HandbookMode,
  SiteTier,
} from "@/server/features/handbook/contracts/status";
import {
  createSupabaseEvidenceStore,
  createSupabaseSignedUrl,
} from "@/server/features/handbook/engine/supabase-evidence-store";
import {
  COPY_QUALITY_EVIDENCE_ITEM,
  SCALED_CONTENT_EVIDENCE_ITEM,
} from "@/server/features/handbook/engine/evidence";
import {
  copyQualitySchema,
  scaledContentSchema,
} from "@/server/features/handbook/contracts/scaled-copy";
import type { z } from "zod";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { renderClientReportHtml } from "@/server/features/handbook/export/client-report";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import { AgencyService } from "@/server/features/agency/agencyService";
import { OutcomeService } from "@/server/features/agency/outcomeService";
import { ReportService } from "@/server/features/reports/services/ReportService";
import { AppError } from "@/server/lib/errors";
import { supabaseConfig } from "./HandbookRunService";
import { HandbookStageRepository } from "@/server/features/handbook/repositories/HandbookStageRepository";
import { HandbookLeaseRepository } from "@/server/features/handbook/repositories/HandbookLeaseRepository";
import {
  STAGES,
  type StageName,
  type StageStatus,
} from "@/server/features/handbook/engine/stages";

const SIGNED_URL_SECONDS = 300;

async function getSettings(projectId: string) {
  const row = await HandbookRepository.getProjectSetting(projectId);
  return {
    enabled: row?.enabled ?? false,
    mode: row?.mode ?? ("AUDIT" as const),
    tierOverride: row?.tierOverride ?? null,
    copyQuality: row?.copyQuality ?? false,
    serpOriginality: row?.serpOriginality ?? false,
  };
}

async function updateSettings(input: {
  projectId: string;
  enabled: boolean;
  mode: HandbookMode;
  tierOverride: SiteTier | null;
  copyQuality: boolean;
  serpOriginality: boolean;
}) {
  await HandbookRepository.upsertProjectSetting(input);
  return getSettings(input.projectId);
}

/**
 * A run plus its scored report.json, for the run page and the MCP tools.
 * Null when the run is not in `projectId` (tenant scoping).
 */
async function getRunDetail(projectId: string, runId: string) {
  const rows = await getReportRows(projectId, runId);
  if (!rows) return null;
  return { run: rows.run, report: await withSections(rows) };
}

/**
 * Copy quality (ADR-023) and the scaled-content summary (ADR-022) are
 * stored as one artifact body each in the evidence store, not in rows;
 * null when absent (option off, older run) or no store is set.
 */
async function storedArtifact<T>(
  projectId: string,
  runId: string,
  itemId: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const row = await getRunItemEvidence(projectId, runId, itemId);
  const config = row?.storageKey ? await supabaseConfig() : null;
  if (!config || !row?.storageKey) return null;
  const bytes = await createSupabaseEvidenceStore(config).get(row.storageKey);
  if (!bytes) return null;
  try {
    const parsed = schema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function withSections(rows: ReportRows): Promise<ReportJson> {
  const { projectId, id, depth } = rows.run;
  const [copyQuality, scaledContent] = await Promise.all([
    storedArtifact(
      projectId,
      id,
      COPY_QUALITY_EVIDENCE_ITEM,
      copyQualitySchema,
    ),
    depth === "full"
      ? storedArtifact(
          projectId,
          id,
          SCALED_CONTENT_EVIDENCE_ITEM,
          scaledContentSchema,
        )
      : null,
  ]);
  return {
    ...buildReport(rows),
    ...(scaledContent ? { scaledContent } : {}),
    ...(copyQuality ? { copyQuality } : {}),
  };
}

/**
 * A stored run as K7 report.json (WO-B4-009), scored with K6. Tier evidence
 * and checker errors are not persisted, so they read "" and []. Null when
 * the run is not in `projectId`.
 */
async function getRunReport(
  projectId: string,
  runId: string,
): Promise<ReportJson | null> {
  const rows = await getReportRows(projectId, runId);
  return rows ? withSections(rows) : null;
}

/**
 * Saves the run's client report (WO-B4-008) into upstream Reports, so list,
 * view, print and delete come for free. Re-publishing a run updates the
 * report with the same title. `skill: "handbook-audit"` is the attribution
 * contract; the caller passes the authenticated user.
 */
async function publishToReports(input: {
  projectId: string;
  organizationId: string;
  userId: string;
  runId: string;
}) {
  const report = await getRunReport(input.projectId, input.runId);
  if (!report) throw new AppError("NOT_FOUND", "Handbook run not found");
  const host = new URL(report.site.origin).host;
  const title = `Handbook review — ${host} — ${report.generatedAt.slice(0, 10)} (${report.run.id.slice(0, 8)})`;
  const existing = await ReportRepository.findReportByTitle(
    input.projectId,
    title,
  );
  return ReportService.saveReport({
    projectId: input.projectId,
    organizationId: input.organizationId,
    ...(existing ? { reportId: existing.id } : {}),
    title,
    summary: `${report.score?.grade ?? "?"} · ${report.findings.length} findings`,
    html: renderClientReportHtml(report, REGISTRY, {
      brand: await AgencyService.getBrandForRender(input.organizationId),
      outcomes: await OutcomeService.getOutcomeRecord(input),
    }),
    skill: "handbook-audit",
    createdBy: "handbook",
    createdByUserId: input.userId,
  });
}

/**
 * One evidence excerpt plus a short-lived signed URL to the full body.
 * Null when the evidence does not belong to `projectId` (tenant scoping).
 */
async function getEvidence(projectId: string, evidenceId: string) {
  const evidence = await HandbookRepository.getEvidence(projectId, evidenceId);
  if (!evidence) return null;
  const config = evidence.storageKey ? await supabaseConfig() : null;
  const bodyUrl =
    config && evidence.storageKey
      ? await createSupabaseSignedUrl(
          config,
          evidence.storageKey,
          SIGNED_URL_SECONDS,
        )
      : null;
  return { ...evidence, bodyUrl };
}

type StageProgress = {
  stage: StageName;
  status: StageStatus;
  batchesDone: number;
  batches: number;
  itemsDone: number;
  error: string | null;
};

/**
 * Live run progress (FULL-READ §7.5): per-stage batch state, pages done in
 * the current stage against pages read by the crawl, bot-parity escalation
 * probes, and LLM spend so far. A queued run names the run it waits on only
 * when that run is in the same project. Null when the run is not in
 * `projectId`.
 */
async function getRunProgress(projectId: string, runId: string) {
  const run = await HandbookRepository.getRun(projectId, runId);
  if (!run) return null;
  const rows = await HandbookStageRepository.progressRows(runId);
  const stages: StageProgress[] = STAGES.flatMap((stage) => {
    const batches = rows.stages.filter((r) => r.stage === stage);
    if (batches.length === 0) return [];
    const has = (status: StageStatus) =>
      batches.some((b) => b.status === status);
    const finished = batches.filter(
      (b) => b.status === "done" || b.status === "skipped",
    );
    return [
      {
        stage,
        status: has("failed")
          ? "failed"
          : has("running")
            ? "running"
            : finished.length === batches.length
              ? batches.every((b) => b.status === "skipped")
                ? "skipped"
                : "done"
              : "pending",
        batchesDone: finished.length,
        batches: batches.length,
        itemsDone: batches.reduce((n, b) => n + b.itemsDone, 0),
        error: batches.find((b) => b.error)?.error ?? null,
      },
    ];
  });
  const current =
    stages.find((s) => s.status === "running" || s.status === "pending") ??
    stages.at(-1) ??
    null;
  const pagesTotal =
    run.coverageRead ??
    stages.find((s) => s.stage === "crawl" && s.status === "done")?.itemsDone ??
    null;

  let queuedBehind: { sameProject: boolean; runId: string | null } | null =
    null;
  if (run.status === "queued") {
    const holder = await HandbookLeaseRepository.currentHolder();
    const holderRun = holder
      ? await HandbookRepository.getRun(projectId, holder)
      : null;
    queuedBehind = holderRun
      ? { sameProject: true, runId: holderRun.id }
      : { sameProject: false, runId: null };
  }

  return {
    runId,
    status: run.status,
    stages,
    currentStage: current?.stage ?? null,
    pagesDone: current && current.stage !== "crawl" ? current.itemsDone : null,
    pagesTotal,
    escalations: rows.botProbes,
    llmCostUsd: Math.max(rows.llmCostUsd, run.llmCostUsd),
    queuedBehind,
  };
}

export type HandbookRunProgress = NonNullable<
  Awaited<ReturnType<typeof getRunProgress>>
>;

export const HandbookService = {
  getRunProgress,
  getSettings,
  updateSettings,
  listRuns: (projectId: string) => HandbookRepository.listRuns(projectId),
  getRunDetail,
  scoreRun,
  backfillGrades,
  getRunReport,
  publishToReports,
  listEvidence: (projectId: string, runId: string) =>
    HandbookRepository.listEvidence(projectId, runId),
  getEvidence,
  listCrawledUrls: (auditId: string) =>
    HandbookRepository.listCrawledUrls(auditId),
} as const;
