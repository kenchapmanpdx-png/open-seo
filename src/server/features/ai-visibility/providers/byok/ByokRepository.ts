import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  aiSourceCategories,
  aiWebQueries,
  byokAiAnswers,
  byokAiMatches,
  byokAiRuns,
  byokAiSchedules,
  byokAiSources,
  byokAiTrackerProviders,
} from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import {
  aiMatches,
  aiObservations,
  aiPrompts,
  aiRuns,
  aiSources,
  aiTrackers,
  projects,
} from "@/db/schema";

// BYOK AI visibility persistence (ADR-015 §1). Every read starts from a
// tracker joined to its project, so callers scope by organization there.

type AnswerRow = typeof byokAiAnswers.$inferInsert;
type SourceRow = typeof byokAiSources.$inferInsert;
type MatchRow = typeof byokAiMatches.$inferInsert;
type WebQueryRow = typeof aiWebQueries.$inferInsert;

// ≤ 100 D1 parameters per statement: sources 9 columns, matches 8, queries 6.
const SOURCE_ROWS = 11;
const MATCH_ROWS = 12;
const QUERY_ROWS = 16;

async function getTrackerScope(trackerId: string) {
  const [row] = await db
    .select({
      trackerId: aiTrackers.id,
      projectId: projects.id,
      organizationId: projects.organizationId,
      locationCode: aiTrackers.locationCode,
      languageCode: aiTrackers.languageCode,
    })
    .from(aiTrackers)
    .innerJoin(projects, eq(projects.id, aiTrackers.projectId))
    .where(eq(aiTrackers.id, trackerId))
    .limit(1);
  return row ?? null;
}

function listActivePrompts(trackerId: string) {
  return db
    .select({ id: aiPrompts.id, text: aiPrompts.text })
    .from(aiPrompts)
    .where(
      and(
        eq(aiPrompts.trackerId, trackerId),
        eq(aiPrompts.paused, false),
        eq(aiPrompts.archived, false),
      ),
    )
    .orderBy(asc(aiPrompts.createdAt), asc(aiPrompts.id));
}

function listTrackerProviders(trackerId: string) {
  return db
    .select({
      provider: byokAiTrackerProviders.provider,
      model: byokAiTrackerProviders.model,
    })
    .from(byokAiTrackerProviders)
    .where(eq(byokAiTrackerProviders.trackerId, trackerId));
}

async function createRun(row: typeof byokAiRuns.$inferInsert) {
  await db.insert(byokAiRuns).values(row);
}

async function finishRun(
  runId: string,
  values: { status: "completed" | "failed"; costUsdMicros: number },
) {
  await db
    .update(byokAiRuns)
    .set({ ...values, finishedAt: new Date().toISOString() })
    .where(eq(byokAiRuns.id, runId));
}

/** One answer with its sources, brand matches and web queries, in one batch. */
async function saveAnswer(input: {
  answer: AnswerRow;
  sources: SourceRow[];
  matches: MatchRow[];
  webQueries: WebQueryRow[];
}) {
  await runBatch((tx) => [
    tx.insert(byokAiAnswers).values(input.answer),
    ...chunk(input.sources, SOURCE_ROWS).map((rows) =>
      tx.insert(byokAiSources).values(rows),
    ),
    ...chunk(input.matches, MATCH_ROWS).map((rows) =>
      tx.insert(byokAiMatches).values(rows),
    ),
    ...chunk(input.webQueries, QUERY_ROWS).map((rows) =>
      tx.insert(aiWebQueries).values(rows),
    ),
  ]);
}

function listDueSchedules(nowIso: string, limit: number) {
  return db
    .select()
    .from(byokAiSchedules)
    .where(lte(byokAiSchedules.nextRunAt, nowIso))
    .orderBy(asc(byokAiSchedules.nextRunAt))
    .limit(limit);
}

/**
 * Moves a due schedule to its next slot. Conditional on the `next_run_at` that
 * was read, so two overlapping ticks cannot both claim it.
 */
async function advanceSchedule(
  trackerId: string,
  expectedNextRunAt: string,
  nextRunAt: string,
): Promise<boolean> {
  const claimed = await db
    .update(byokAiSchedules)
    .set({ nextRunAt })
    .where(
      and(
        eq(byokAiSchedules.trackerId, trackerId),
        eq(byokAiSchedules.nextRunAt, expectedNextRunAt),
      ),
    )
    .returning({ trackerId: byokAiSchedules.trackerId });
  return claimed.length > 0;
}

// ---- Reads for the BYOK page / comparison (WO-B6-033) ----

const IDS_PER_QUERY = 90; // D1 parameter cap

async function inChunks<T>(
  ids: string[],
  read: (ids: string[]) => Promise<T[]>,
) {
  const out: T[] = [];
  for (const part of chunk(ids, IDS_PER_QUERY)) out.push(...(await read(part)));
  return out;
}

/** The project's tracker, only when the project belongs to the organization. */
async function getProjectTracker(projectId: string, organizationId: string) {
  const [row] = await db
    .select({ trackerId: aiTrackers.id })
    .from(aiTrackers)
    .innerJoin(projects, eq(projects.id, aiTrackers.projectId))
    .where(
      and(
        eq(aiTrackers.projectId, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.trackerId ?? null;
}

async function getSchedule(trackerId: string) {
  const [row] = await db
    .select()
    .from(byokAiSchedules)
    .where(eq(byokAiSchedules.trackerId, trackerId))
    .limit(1);
  return row ?? null;
}

function listRuns(trackerId: string, limit: number) {
  return db
    .select()
    .from(byokAiRuns)
    .where(eq(byokAiRuns.trackerId, trackerId))
    .orderBy(desc(byokAiRuns.startedAt))
    .limit(limit);
}

function listUpstreamRuns(trackerId: string, limit: number) {
  return db
    .select({
      id: aiRuns.id,
      status: aiRuns.status,
      createdAt: aiRuns.createdAt,
      completedAt: aiRuns.completedAt,
    })
    .from(aiRuns)
    .where(eq(aiRuns.trackerId, trackerId))
    .orderBy(desc(aiRuns.createdAt))
    .limit(limit);
}

/** BYOK answers of one run with their own-brand match, sources and fan-out. */
async function listRunAnswers(runId: string) {
  const answers = await db
    .select({
      id: byokAiAnswers.id,
      promptId: byokAiAnswers.promptId,
      provider: byokAiAnswers.provider,
      status: byokAiAnswers.status,
    })
    .from(byokAiAnswers)
    .where(eq(byokAiAnswers.runId, runId));
  const ids = answers.map((a) => a.id);
  const [matches, sources, queries] = await Promise.all([
    inChunks(ids, (part) =>
      db
        .select({
          answerId: byokAiMatches.answerId,
          mentioned: byokAiMatches.mentioned,
          cited: byokAiMatches.cited,
          firstMention: byokAiMatches.firstMention,
        })
        .from(byokAiMatches)
        .where(
          and(
            inArray(byokAiMatches.answerId, part),
            eq(byokAiMatches.own, true),
          ),
        ),
    ),
    inChunks(ids, (part) =>
      db
        .select({
          answerId: byokAiSources.answerId,
          category: byokAiSources.category,
        })
        .from(byokAiSources)
        .where(inArray(byokAiSources.answerId, part)),
    ),
    inChunks(ids, (part) =>
      db
        .select({
          answerId: aiWebQueries.answerId,
          isFanout: aiWebQueries.isFanout,
        })
        .from(aiWebQueries)
        .where(inArray(aiWebQueries.answerId, part)),
    ),
  ]);
  return { answers, matches, sources, queries };
}

/** Upstream (DataForSEO) answers of one run, same shape as `listRunAnswers`. */
async function listUpstreamRunAnswers(runId: string) {
  const answers = await db
    .select({
      id: aiObservations.id,
      promptId: aiObservations.promptId,
      engine: aiObservations.engine,
      status: aiObservations.status,
    })
    .from(aiObservations)
    .where(eq(aiObservations.runId, runId));
  const ids = answers.map((a) => a.id);
  const [matches, sources] = await Promise.all([
    inChunks(ids, (part) =>
      db
        .select({
          answerId: aiMatches.observationId,
          mentioned: aiMatches.mentioned,
          cited: aiMatches.cited,
          firstMention: aiMatches.firstMention,
        })
        .from(aiMatches)
        .where(
          and(inArray(aiMatches.observationId, part), eq(aiMatches.own, true)),
        ),
    ),
    inChunks(ids, (part) =>
      db
        .select({
          answerId: aiSources.observationId,
          category: aiSourceCategories.category,
        })
        .from(aiSources)
        .leftJoin(
          aiSourceCategories,
          eq(aiSourceCategories.sourceId, aiSources.id),
        )
        .where(inArray(aiSources.observationId, part)),
    ),
  ]);
  return { answers, matches, sources };
}

/** Every stored web query of the tracker's BYOK answers (newest runs first). */
function listTrackerWebQueries(trackerId: string, limit: number) {
  return db
    .select({
      promptId: byokAiAnswers.promptId,
      provider: byokAiAnswers.provider,
      query: aiWebQueries.query,
      normalized: aiWebQueries.normalized,
      isFanout: aiWebQueries.isFanout,
    })
    .from(aiWebQueries)
    .innerJoin(byokAiAnswers, eq(byokAiAnswers.id, aiWebQueries.answerId))
    .innerJoin(byokAiRuns, eq(byokAiRuns.id, byokAiAnswers.runId))
    .where(eq(byokAiRuns.trackerId, trackerId))
    .orderBy(desc(byokAiRuns.startedAt))
    .limit(limit);
}

// ---- Settings writes (WO-B6-033) ----

async function setTrackerProvider(
  trackerId: string,
  provider: (typeof byokAiTrackerProviders.$inferInsert)["provider"],
  model: string | null,
) {
  if (model === null) {
    await db
      .delete(byokAiTrackerProviders)
      .where(
        and(
          eq(byokAiTrackerProviders.trackerId, trackerId),
          eq(byokAiTrackerProviders.provider, provider),
        ),
      );
    return;
  }
  await db
    .insert(byokAiTrackerProviders)
    .values({ trackerId, provider, model })
    .onConflictDoUpdate({
      target: [
        byokAiTrackerProviders.trackerId,
        byokAiTrackerProviders.provider,
      ],
      set: { model },
    });
}

async function setSchedule(
  trackerId: string,
  schedule: { intervalDays: number; nextRunAt: string } | null,
) {
  if (schedule === null) {
    await db
      .delete(byokAiSchedules)
      .where(eq(byokAiSchedules.trackerId, trackerId));
    return;
  }
  await db
    .insert(byokAiSchedules)
    .values({ trackerId, ...schedule })
    .onConflictDoUpdate({ target: byokAiSchedules.trackerId, set: schedule });
}

export const ByokRepository = {
  getTrackerScope,
  listActivePrompts,
  listTrackerProviders,
  createRun,
  finishRun,
  saveAnswer,
  listDueSchedules,
  advanceSchedule,
  getProjectTracker,
  getSchedule,
  listRuns,
  listUpstreamRuns,
  listRunAnswers,
  listUpstreamRunAnswers,
  listTrackerWebQueries,
  setTrackerProvider,
  setSchedule,
};
