import { and, asc, eq, lte } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  aiWebQueries,
  byokAiAnswers,
  byokAiMatches,
  byokAiRuns,
  byokAiSchedules,
  byokAiSources,
  byokAiTrackerProviders,
} from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import { aiPrompts, aiTrackers, projects } from "@/db/schema";

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

export const ByokRepository = {
  getTrackerScope,
  listActivePrompts,
  listTrackerProviders,
  createRun,
  finishRun,
  saveAnswer,
  listDueSchedules,
  advanceSchedule,
};
