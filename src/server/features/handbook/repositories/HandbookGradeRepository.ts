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
  /** WO-B21-001: set = the run read no page; stored as no grade. */
  notGradedReason?: string | null;
};

/** Prefix of `cap_reason` on a run stored as not graded (WO-B21-001). */
const NOT_GRADED_PREFIX = "not graded: ";

export function scoreColumns(score: RunScore) {
  // A not-graded run keeps NULL grade / score and says why in `cap_reason`,
  // which also keeps `listUngradedRuns` from picking it again.
  if (score.notGradedReason)
    return {
      scoreFinal: null,
      scoreUncapped: null,
      capReason: `${NOT_GRADED_PREFIX}${score.notGradedReason}`,
      grade: null,
    };
  return {
    scoreFinal: score.final,
    scoreUncapped: score.uncapped,
    capReason: score.capReason,
    grade: score.grade,
  };
}

/**
 * Completed runs never scored, all projects (`ops backfill-grades`). A run
 * stored as not graded has a `cap_reason` and is not picked again.
 */
async function listUngradedRuns() {
  return db
    .select({ id: handbookRuns.id, projectId: handbookRuns.projectId })
    .from(handbookRuns)
    .where(
      and(
        eq(handbookRuns.status, "completed"),
        isNull(handbookRuns.grade),
        isNull(handbookRuns.capReason),
      ),
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
