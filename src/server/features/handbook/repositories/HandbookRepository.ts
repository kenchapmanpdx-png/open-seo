import { and, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { insertMany } from "./insertMany";
import { rowId, saveRunResult } from "./saveRunResult";
import { auditPages, audits } from "@/db/schema";
import {
  handbookEvidence,
  handbookItemStatuses,
  handbookLlmCalls,
  handbookPageProfiles,
  handbookProjectSettings,
  handbookRuns,
} from "@/db/handbook-tables";
import { scoreColumns, type RunScore } from "./HandbookGradeRepository";
import type {
  HandbookMode,
  RunStatus,
  SiteTier,
} from "@/server/features/handbook/contracts/status";
import type { Coverage } from "@/server/features/handbook/contracts/collectors";
import type { HandbookDepth } from "@/server/features/handbook/contracts/exports";
import type { LlmCallLog } from "@/server/features/handbook/llm/judge";

/**
 * Handbook persistence (ADR-002). Every caller-keyed read filters by
 * `project_id` through `handbook_run`. Writes use deterministic ids +
 * `onConflictDoNothing`, so a retried Workflow step completes a partial
 * write instead of duplicating it.
 */
export type HandbookRun = typeof handbookRuns.$inferSelect;
export type HandbookProjectSetting =
  typeof handbookProjectSettings.$inferSelect;

async function getProjectSetting(
  projectId: string,
): Promise<HandbookProjectSetting | null> {
  const rows = await db
    .select()
    .from(handbookProjectSettings)
    .where(eq(handbookProjectSettings.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertProjectSetting(input: {
  projectId: string;
  enabled: boolean;
  mode: HandbookMode;
  tierOverride: SiteTier | null;
  copyQuality: boolean;
  serpOriginality: boolean;
}) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(handbookProjectSettings)
    .values({ ...input, updatedAt })
    .onConflictDoUpdate({
      target: handbookProjectSettings.projectId,
      set: {
        enabled: input.enabled,
        mode: input.mode,
        tierOverride: input.tierOverride,
        copyQuality: input.copyQuality,
        serpOriginality: input.serpOriginality,
        updatedAt,
      },
    });
}

async function createRun(input: {
  id: string;
  projectId: string;
  organizationId: string;
  auditId: string | null;
  origin: string;
  handbookVersion: string;
  contractsVersion: string;
  mode: HandbookMode;
  /** Absent = DB default `quick` (outcome reruns). */
  depth?: HandbookDepth;
}) {
  await db
    .insert(handbookRuns)
    .values({ ...input, status: "running" })
    .onConflictDoNothing();
}

async function finishRun(input: {
  projectId: string;
  runId: string;
  status: RunStatus;
  tier?: SiteTier | null;
  errorCode?: string | null;
  coverage?: Coverage;
  /** K6 score of the finished run (B13 WO-B13-008); absent on failure. */
  score?: RunScore;
}) {
  await db
    .update(handbookRuns)
    .set({
      status: input.status,
      ...(input.score ? scoreColumns(input.score) : {}),
      tier: input.tier ?? null,
      errorCode: input.errorCode ?? null,
      ...(input.coverage
        ? {
            coverageDiscovered: input.coverage.discovered,
            coverageRead: input.coverage.read,
            coverageCapped: input.coverage.capped,
            coverageExtra: coverageExtraJson(input.coverage),
          }
        : {}),
      finishedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(handbookRuns.id, input.runId),
        eq(handbookRuns.projectId, input.projectId),
        // A finished run stays finished: a late step attempt must not
        // rewrite a failed run (B18 WO-B18-012).
        inArray(handbookRuns.status, LIVE_RUN_STATUSES),
      ),
    );
}

/** WO-B27-090 (ADR-040): the report-only coverage extras, or null when none. */
function coverageExtraJson(coverage: Coverage): string | null {
  const { shortName, scope } = coverage;
  if (!shortName && !scope) return null;
  return JSON.stringify({ shortName, scope });
}

const LIVE_RUN_STATUSES: RunStatus[] = ["queued", "running"];

/**
 * Runs with their findings count. A left join + group by, not a correlated
 * subquery: Drizzle drops table names inside `sql` fields of single-table
 * selects, so the subquery compared `run_id = id` inside itself (B13 E25).
 */
async function getRun(projectId: string, runId: string) {
  const rows = await db
    .select()
    .from(handbookRuns)
    .where(
      and(eq(handbookRuns.id, runId), eq(handbookRuns.projectId, projectId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function listItemStatuses(projectId: string, runId: string) {
  return db
    .select({
      itemId: handbookItemStatuses.itemId,
      status: handbookItemStatuses.status,
      score: handbookItemStatuses.score,
      note: handbookItemStatuses.note,
    })
    .from(handbookItemStatuses)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookItemStatuses.runId))
    .where(
      and(
        eq(handbookItemStatuses.runId, runId),
        eq(handbookRuns.projectId, projectId),
      ),
    );
}

const evidenceColumns = {
  id: handbookEvidence.id,
  findingId: handbookEvidence.findingId,
  itemId: handbookEvidence.itemId,
  kind: handbookEvidence.kind,
  url: handbookEvidence.url,
  storageKey: handbookEvidence.storageKey,
  excerpt: handbookEvidence.excerpt,
  byteSize: handbookEvidence.byteSize,
  contentType: handbookEvidence.contentType,
};

/** A run's evidence excerpts (bodies stay in the evidence store). */
async function listEvidence(projectId: string, runId: string, limit = 500) {
  return db
    .select(evidenceColumns)
    .from(handbookEvidence)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookEvidence.runId))
    .where(
      and(
        eq(handbookEvidence.runId, runId),
        eq(handbookRuns.projectId, projectId),
      ),
    )
    .orderBy(handbookEvidence.itemId, handbookEvidence.url)
    .limit(limit);
}

/** One evidence row, only when its run belongs to `projectId`. */
async function getEvidence(projectId: string, evidenceId: string) {
  const rows = await db
    .select(evidenceColumns)
    .from(handbookEvidence)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookEvidence.runId))
    .where(
      and(
        eq(handbookEvidence.id, evidenceId),
        eq(handbookRuns.projectId, projectId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** URLs the upstream crawl fetched with 200 (workflow seed list, ADR-001). */
async function listCrawledUrls(auditId: string) {
  const rows = await db
    .select({ url: auditPages.url })
    .from(auditPages)
    .where(
      and(eq(auditPages.auditId, auditId), eq(auditPages.statusCode, 200)),
    );
  return rows.map((r) => r.url);
}

/**
 * Runs not yet finished, across projects, with their audit's workflow
 * instance (B13 recovery reconciler, ADR-027). System job only: callers act
 * on the run's own `projectId`.
 */
async function listActiveRuns() {
  return db
    .select({
      id: handbookRuns.id,
      projectId: handbookRuns.projectId,
      auditId: handbookRuns.auditId,
      status: handbookRuns.status,
      startedAt: handbookRuns.startedAt,
      workflowInstanceId: audits.workflowInstanceId,
    })
    .from(handbookRuns)
    .leftJoin(audits, eq(audits.id, handbookRuns.auditId))
    .where(inArray(handbookRuns.status, ["running", "queued"]));
}

/** K5 call log (ADR-007) + the run's total LLM cost (idempotent). */
async function saveLlmCalls(runId: string, calls: readonly LlmCallLog[]) {
  const rows = await Promise.all(
    calls.map(async (c, i) => ({
      id: await rowId(runId, "llm", String(i)),
      runId,
      ...c,
    })),
  );
  await insertMany(rows, (tx, chunk) =>
    tx.insert(handbookLlmCalls).values(chunk).onConflictDoNothing(),
  );
  // Map-stage spend lives on the page profiles this run created (B18
  // WO-B18-018: it was missing from the run total).
  const [map] = await db
    .select({ usd: sum(handbookPageProfiles.costUsd).mapWith(Number) })
    .from(handbookPageProfiles)
    .where(eq(handbookPageProfiles.runId, runId));
  await db
    .update(handbookRuns)
    .set({
      llmCostUsd:
        calls.reduce((total, c) => total + c.costUsd, 0) + (map?.usd ?? 0),
    })
    .where(eq(handbookRuns.id, runId));
}

export const HandbookRepository = {
  getProjectSetting,
  upsertProjectSetting,
  createRun,
  finishRun,
  getRun,
  listItemStatuses,
  listEvidence,
  getEvidence,
  listCrawledUrls,
  listActiveRuns,
  saveRunResult,
  saveLlmCalls,
} as const;
