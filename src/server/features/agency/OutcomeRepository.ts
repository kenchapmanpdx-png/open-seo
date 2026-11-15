import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  handbookFindingItems,
  handbookFindingUrls,
  handbookFindings,
  handbookItemStatuses,
  handbookRuns,
} from "@/db/handbook-tables";
import {
  aiTrafficClasses,
  aiTrafficEvents,
  aiTrafficSites,
  bingPageWeeks,
  byokAiAnswers,
  byokAiRuns,
  byokAiSources,
  bingSites,
  outcomeBatchClasses,
  outcomeBatches,
  outcomeChecks,
  outcomeMetrics,
} from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import { aiObservations, aiRuns, aiSources, projects } from "@/db/schema";
import type { OUTCOME_CHECK_STATUSES } from "./contracts";

// Outcome record (ADR-017 §3): fix batches, +4/+12-week checks, per-metric
// rows. Project rows are always filtered by organization too.

type BatchRow = typeof outcomeBatches.$inferInsert;
type ClassRow = Omit<typeof outcomeBatchClasses.$inferInsert, "batchId">;
type CheckRow = Omit<typeof outcomeChecks.$inferInsert, "batchId">;
export type MetricRow = typeof outcomeMetrics.$inferInsert;

export async function getRun(
  runId: string,
  projectId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({
      id: handbookRuns.id,
      mode: handbookRuns.mode,
      origin: handbookRuns.origin,
      status: handbookRuns.status,
      handbookVersion: handbookRuns.handbookVersion,
    })
    .from(handbookRuns)
    .where(
      and(
        eq(handbookRuns.id, runId),
        eq(handbookRuns.projectId, projectId),
        eq(handbookRuns.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** (finding code, item, url) triples of a run; URL null when a finding has none. */
export async function listFindingTargets(runId: string) {
  return db
    .select({
      code: handbookFindings.code,
      itemId: handbookFindingItems.itemId,
      url: handbookFindingUrls.url,
    })
    .from(handbookFindings)
    .innerJoin(
      handbookFindingItems,
      eq(handbookFindingItems.findingId, handbookFindings.id),
    )
    .leftJoin(
      handbookFindingUrls,
      eq(handbookFindingUrls.findingId, handbookFindings.id),
    )
    .where(eq(handbookFindings.runId, runId));
}

export async function listItemStatuses(runId: string) {
  return db
    .select({
      itemId: handbookItemStatuses.itemId,
      status: handbookItemStatuses.status,
    })
    .from(handbookItemStatuses)
    .where(eq(handbookItemStatuses.runId, runId));
}

export async function insertBatch(
  batch: BatchRow,
  classes: ClassRow[],
  checks: CheckRow[],
) {
  await runBatch((tx) => [
    tx.insert(outcomeBatches).values(batch),
    ...classes.map((c) =>
      tx
        .insert(outcomeBatchClasses)
        .values({ ...c, batchId: batch.id })
        .onConflictDoNothing(),
    ),
    ...checks.map((c) =>
      tx.insert(outcomeChecks).values({ ...c, batchId: batch.id }),
    ),
  ]);
}

/** Scheduled checks due at `nowIso`, oldest first. */
export async function listDueChecks(nowIso: string, limit: number) {
  return db
    .select({
      id: outcomeChecks.id,
      dueAt: outcomeChecks.dueAt,
      offsetWeeks: outcomeChecks.offsetWeeks,
      batchId: outcomeBatches.id,
      projectId: outcomeBatches.projectId,
      organizationId: outcomeBatches.organizationId,
      baselineRunId: outcomeBatches.baselineRunId,
      fixedAt: outcomeBatches.fixedAt,
    })
    .from(outcomeChecks)
    .innerJoin(outcomeBatches, eq(outcomeBatches.id, outcomeChecks.batchId))
    .where(
      and(
        eq(outcomeChecks.status, "scheduled"),
        lte(outcomeChecks.dueAt, nowIso),
      ),
    )
    .orderBy(asc(outcomeChecks.dueAt))
    .limit(limit);
}

/**
 * Lease a due check by moving `due_at` forward; only one tick wins (same
 * conditional-claim pattern as the BYOK schedule). A crashed run retries
 * after the lease.
 */
export async function claimCheck(
  checkId: string,
  seenDueAt: string,
  leaseUntil: string,
) {
  const rows = await db
    .update(outcomeChecks)
    .set({ dueAt: leaseUntil })
    .where(
      and(
        eq(outcomeChecks.id, checkId),
        eq(outcomeChecks.status, "scheduled"),
        eq(outcomeChecks.dueAt, seenDueAt),
      ),
    )
    .returning({ id: outcomeChecks.id });
  return rows.length === 1;
}

export async function listBatchClasses(batchId: string) {
  return db
    .select({
      itemId: outcomeBatchClasses.itemId,
      url: outcomeBatchClasses.url,
    })
    .from(outcomeBatchClasses)
    .where(eq(outcomeBatchClasses.batchId, batchId));
}

export async function completeCheck(input: {
  checkId: string;
  status: (typeof OUTCOME_CHECK_STATUSES)[number];
  resultRunId: string | null;
  metrics: MetricRow[];
}) {
  const completedAt = new Date().toISOString();
  await runBatch((tx) => [
    ...input.metrics.map((m) =>
      tx
        .insert(outcomeMetrics)
        .values(m)
        .onConflictDoUpdate({
          target: [
            outcomeMetrics.checkId,
            outcomeMetrics.itemId,
            outcomeMetrics.url,
            outcomeMetrics.metric,
          ],
          set: {
            beforeValue: m.beforeValue ?? null,
            afterValue: m.afterValue ?? null,
            source: m.source,
            evidencePath: m.evidencePath ?? null,
          },
        }),
    ),
    tx
      .update(outcomeChecks)
      .set({
        status: input.status,
        resultRunId: input.resultRunId,
        completedAt,
      })
      .where(eq(outcomeChecks.id, input.checkId)),
  ]);
}

/** Batches of a project with their checks, newest first. */
export async function listBatches(projectId: string, organizationId: string) {
  return db
    .select({
      batchId: outcomeBatches.id,
      baselineRunId: outcomeBatches.baselineRunId,
      fixedAt: outcomeBatches.fixedAt,
      checkId: outcomeChecks.id,
      offsetWeeks: outcomeChecks.offsetWeeks,
      dueAt: outcomeChecks.dueAt,
      status: outcomeChecks.status,
      completedAt: outcomeChecks.completedAt,
    })
    .from(outcomeBatches)
    .innerJoin(outcomeChecks, eq(outcomeChecks.batchId, outcomeBatches.id))
    .where(
      and(
        eq(outcomeBatches.projectId, projectId),
        eq(outcomeBatches.organizationId, organizationId),
      ),
    )
    .orderBy(
      sql`${outcomeBatches.fixedAt} desc`,
      asc(outcomeChecks.offsetWeeks),
    );
}

export async function listMetrics(checkIds: string[]) {
  if (checkIds.length === 0) return [];
  return db
    .select()
    .from(outcomeMetrics)
    .where(inArray(outcomeMetrics.checkId, checkIds));
}

// ---------------------------------------------------------------- metric sources

/** Bing page clicks per page for weeks starting in [fromDay, toDay). */
export async function sumBingPageClicks(
  projectId: string,
  organizationId: string,
  pages: string[],
  fromDay: string,
  toDay: string,
) {
  return db
    .select({
      page: bingPageWeeks.page,
      clicks: sql<number>`cast(sum(${bingPageWeeks.clicks}) as integer)`,
    })
    .from(bingPageWeeks)
    .innerJoin(bingSites, eq(bingSites.id, bingPageWeeks.siteId))
    .where(
      and(
        eq(bingSites.projectId, projectId),
        eq(bingSites.organizationId, organizationId),
        inArray(bingPageWeeks.page, pages),
        gte(bingPageWeeks.weekStart, fromDay),
        lt(bingPageWeeks.weekStart, toDay),
      ),
    )
    .groupBy(bingPageWeeks.page);
}

export async function hasBingSite(projectId: string, organizationId: string) {
  const [row] = await db
    .select({ id: bingSites.id })
    .from(bingSites)
    .where(
      and(
        eq(bingSites.projectId, projectId),
        eq(bingSites.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function hasAiTrafficSite(
  projectId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({ id: aiTrafficSites.id })
    .from(aiTrafficSites)
    .where(
      and(
        eq(aiTrafficSites.projectId, projectId),
        eq(aiTrafficSites.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/**
 * AI referrals and verified AI crawler hits per path in [fromIso, toIso).
 * Raw events are kept 90 days (ADR-013), enough for both 28-day windows of a
 * +4-week check; older windows come back empty and the caller says so.
 */
export async function countAiTrafficByPath(
  projectId: string,
  organizationId: string,
  paths: string[],
  fromIso: string,
  toIso: string,
) {
  return db
    .select({
      path: aiTrafficEvents.path,
      kind: aiTrafficClasses.kind,
      verification: aiTrafficClasses.verification,
      hits: sql<number>`cast(count(*) as integer)`,
    })
    .from(aiTrafficEvents)
    .innerJoin(
      aiTrafficClasses,
      eq(aiTrafficClasses.eventId, aiTrafficEvents.id),
    )
    .innerJoin(aiTrafficSites, eq(aiTrafficSites.id, aiTrafficEvents.siteId))
    .where(
      and(
        eq(aiTrafficSites.projectId, projectId),
        eq(aiTrafficSites.organizationId, organizationId),
        inArray(aiTrafficEvents.path, paths),
        inArray(aiTrafficClasses.kind, ["referral", "crawler"]),
        gte(aiTrafficEvents.observedAt, fromIso),
        lt(aiTrafficEvents.observedAt, toIso),
      ),
    )
    .groupBy(
      aiTrafficEvents.path,
      aiTrafficClasses.kind,
      aiTrafficClasses.verification,
    );
}

/**
 * Cited source URLs on the given domains from completed AI answers collected
 * in [from, to): upstream AI visibility observations and BYOK answers.
 * `answerId` lets the caller count each answer once per URL.
 */
export async function listAiAnswerCitations(
  projectId: string,
  organizationId: string,
  domains: string[],
  fromIso: string,
  toIso: string,
) {
  const upstream = await db
    .select({ answerId: aiObservations.id, url: aiSources.url })
    .from(aiSources)
    .innerJoin(aiObservations, eq(aiObservations.id, aiSources.observationId))
    .innerJoin(aiRuns, eq(aiRuns.id, aiObservations.runId))
    .innerJoin(projects, eq(projects.id, aiRuns.projectId))
    .where(
      and(
        eq(aiRuns.projectId, projectId),
        eq(projects.organizationId, organizationId),
        eq(aiObservations.status, "completed"),
        inArray(aiSources.domain, domains),
        gte(aiObservations.collectedAt, fromIso),
        lt(aiObservations.collectedAt, toIso),
      ),
    );
  const byok = await db
    .select({ answerId: byokAiAnswers.id, url: byokAiSources.url })
    .from(byokAiSources)
    .innerJoin(byokAiAnswers, eq(byokAiAnswers.id, byokAiSources.answerId))
    .innerJoin(byokAiRuns, eq(byokAiRuns.id, byokAiAnswers.runId))
    .where(
      and(
        eq(byokAiRuns.projectId, projectId),
        eq(byokAiRuns.organizationId, organizationId),
        eq(byokAiAnswers.status, "completed"),
        inArray(byokAiSources.domain, domains),
        gte(byokAiAnswers.collectedAt, fromIso),
        lt(byokAiAnswers.collectedAt, toIso),
      ),
    );
  return [...upstream, ...byok];
}

/** Whether the project has any AI visibility or BYOK run to compare. */
export async function hasAiAnswerRuns(
  projectId: string,
  organizationId: string,
) {
  const [upstream] = await db
    .select({ id: aiRuns.id })
    .from(aiRuns)
    .innerJoin(projects, eq(projects.id, aiRuns.projectId))
    .where(
      and(
        eq(aiRuns.projectId, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (upstream) return true;
  const [byok] = await db
    .select({ id: byokAiRuns.id })
    .from(byokAiRuns)
    .where(
      and(
        eq(byokAiRuns.projectId, projectId),
        eq(byokAiRuns.organizationId, organizationId),
      ),
    )
    .limit(1);
  return byok !== undefined;
}
