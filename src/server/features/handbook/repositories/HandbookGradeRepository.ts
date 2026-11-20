import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { handbookRuns } from "@/db/handbook-tables";

/**
 * Stored K6 grade of a Handbook run (B13 WO-B13-008): written by the report
 * stage through `HandbookRepository.finishRun`, and by `ops backfill-grades`
 * for runs finished before the grade was persisted.
 */
export type RunScore = {
  final: number;
  uncapped: number;
  capReason: string | null;
  grade: string;
};

export function scoreColumns(score: RunScore) {
  return {
    scoreFinal: score.final,
    scoreUncapped: score.uncapped,
    capReason: score.capReason,
    grade: score.grade,
  };
}

/** Completed runs without a stored grade, all projects (`ops backfill-grades`). */
async function listUngradedRuns() {
  return db
    .select({ id: handbookRuns.id, projectId: handbookRuns.projectId })
    .from(handbookRuns)
    .where(
      and(eq(handbookRuns.status, "completed"), isNull(handbookRuns.grade)),
    );
}

async function saveRunScore(projectId: string, runId: string, score: RunScore) {
  await db
    .update(handbookRuns)
    .set(scoreColumns(score))
    .where(
      and(eq(handbookRuns.id, runId), eq(handbookRuns.projectId, projectId)),
    );
}

export const HandbookGradeRepository = {
  listUngradedRuns,
  saveRunScore,
} as const;
