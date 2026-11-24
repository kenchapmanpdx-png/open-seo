import { and, asc, count, eq, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  handbookBotFetches,
  handbookLlmCalls,
  handbookPageProfiles,
  handbookRunStages,
  handbookRuns,
} from "@/db/handbook-tables";
import type {
  StageName,
  StageRow,
  StageTracker,
} from "@/server/features/handbook/engine/stages";

/**
 * `handbook_run_stage` rows (ADR-018): one per `(runId, stage, batch)`.
 * Writes are upserts on the primary key, so a replayed step rewrites its own
 * row instead of duplicating it. Callers pass a run id the workflow created
 * for the project; rows cascade with the run.
 */
const now = () => new Date().toISOString();

/**
 * Stage rows are written only while the run is live (B18 WO-B18-012): a step
 * attempt the workflow already timed out keeps running in-process and must
 * not mark its unit `done` after the run was marked `failed`. The report
 * unit is the one that completes the run, so its own `done` row may land on
 * a `completed` run (WO-B19-012).
 */
async function runLive(
  runId: string,
  statuses: ReadonlyArray<"queued" | "running" | "completed"> = [
    "queued",
    "running",
  ],
): Promise<boolean> {
  const rows = await db
    .select({ id: handbookRuns.id })
    .from(handbookRuns)
    .where(
      and(
        eq(handbookRuns.id, runId),
        inArray(handbookRuns.status, [...statuses]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

function forRun(runId: string): StageTracker {
  const where = (stage: StageName, batch: number) =>
    and(
      eq(handbookRunStages.runId, runId),
      eq(handbookRunStages.stage, stage),
      eq(handbookRunStages.batch, batch),
    );
  const upsert = async (
    stage: StageName,
    batch: number,
    set: Partial<typeof handbookRunStages.$inferInsert>,
  ) => {
    const live = await runLive(
      runId,
      stage === "report" && set.status === "done"
        ? ["queued", "running", "completed"]
        : undefined,
    );
    if (!live) return;
    await db
      .insert(handbookRunStages)
      .values({ runId, stage, batch, ...set })
      .onConflictDoUpdate({
        target: [
          handbookRunStages.runId,
          handbookRunStages.stage,
          handbookRunStages.batch,
        ],
        set,
      });
  };
  const get = async (
    stage: StageName,
    batch: number,
  ): Promise<StageRow | null> => {
    const rows = await db
      .select({
        status: handbookRunStages.status,
        attempt: handbookRunStages.attempt,
        error: handbookRunStages.error,
      })
      .from(handbookRunStages)
      .where(where(stage, batch))
      .limit(1);
    return rows[0] ?? null;
  };

  return {
    get,
    async start(stage, batch) {
      if (!(await runLive(runId))) throw new Error("handbook: run not live");
      await db
        .insert(handbookRunStages)
        .values({
          runId,
          stage,
          batch,
          status: "running",
          attempt: 1,
          startedAt: now(),
        })
        .onConflictDoUpdate({
          target: [
            handbookRunStages.runId,
            handbookRunStages.stage,
            handbookRunStages.batch,
          ],
          set: {
            status: "running",
            attempt: sql`${handbookRunStages.attempt} + 1`,
            error: null,
            startedAt: now(),
            finishedAt: null,
          },
        });
      const row = await get(stage, batch);
      return row?.attempt ?? 1;
    },
    async finish(stage, batch, itemsDone) {
      await upsert(stage, batch, {
        status: "done",
        itemsTotal: itemsDone,
        itemsDone,
        error: null,
        finishedAt: now(),
      });
    },
    async fail(stage, batch, error) {
      await upsert(stage, batch, {
        status: "failed",
        error: error.slice(0, 500),
        finishedAt: now(),
      });
    },
    async progress(stage, batch, itemsDone, itemsTotal) {
      if (!(await runLive(runId))) return;
      await db
        .update(handbookRunStages)
        .set(
          itemsTotal === undefined ? { itemsDone } : { itemsDone, itemsTotal },
        )
        .where(where(stage, batch));
    },
    async skip(stage, batch, reason) {
      await upsert(stage, batch, {
        status: "skipped",
        error: reason,
        finishedAt: now(),
      });
    },
  };
}

/**
 * Live progress inputs for one run (FULL-READ §7.5): its stage rows, LLM
 * spend so far, and bot-parity escalation probes. Callers pass a run id
 * already checked against the project.
 */
async function progressRows(runId: string) {
  const stages = await db
    .select({
      stage: handbookRunStages.stage,
      batch: handbookRunStages.batch,
      status: handbookRunStages.status,
      itemsDone: handbookRunStages.itemsDone,
      itemsTotal: handbookRunStages.itemsTotal,
      error: handbookRunStages.error,
    })
    .from(handbookRunStages)
    .where(eq(handbookRunStages.runId, runId))
    .orderBy(asc(handbookRunStages.batch));
  const [llm] = await db
    .select({ costUsd: sum(handbookLlmCalls.costUsd).mapWith(Number) })
    .from(handbookLlmCalls)
    .where(eq(handbookLlmCalls.runId, runId));
  const [map] = await db
    .select({ costUsd: sum(handbookPageProfiles.costUsd).mapWith(Number) })
    .from(handbookPageProfiles)
    .where(eq(handbookPageProfiles.runId, runId));
  const [bot] = await db
    .select({ n: count() })
    .from(handbookBotFetches)
    .where(eq(handbookBotFetches.runId, runId));
  return {
    stages,
    // Judge calls + map-stage page profiles (WO-B18-018).
    llmCostUsd: (llm?.costUsd ?? 0) + (map?.costUsd ?? 0),
    botProbes: bot?.n ?? 0,
  };
}

export const HandbookStageRepository = { forRun, progressRows } as const;
