import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { handbookLlmCalls, handbookRuns } from "@/db/handbook-tables";
import {
  byokAiAnswers,
  byokAiMatches,
  byokAiRuns,
  byokAiSchedules,
} from "@/db/integrations-tables";
import {
  aiMatches,
  aiObservations,
  aiRuns,
  aiTrackers,
  projects,
} from "@/db/schema";

// Project overview reads (B7 R1): spend and AI answer mention rates.
// Every query is filtered by project and organization.

const total = (column: unknown) =>
  sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

/** Handbook LLM judge spend (USD) on runs started since `sinceIso`. */
export async function sumHandbookLlmUsd(
  projectId: string,
  organizationId: string,
  sinceIso: string,
) {
  const [row] = await db
    .select({ usd: total(handbookLlmCalls.costUsd) })
    .from(handbookLlmCalls)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookLlmCalls.runId))
    .where(
      and(
        eq(handbookRuns.projectId, projectId),
        eq(handbookRuns.organizationId, organizationId),
        gte(handbookLlmCalls.createdAt, sinceIso),
      ),
    );
  return row?.usd ?? 0;
}

/** BYOK runs started since `sinceIso`: count and spend (micro-USD). */
export async function sumByokRuns(
  projectId: string,
  organizationId: string,
  sinceIso: string,
) {
  const [row] = await db
    .select({
      runs: sql<number>`count(*)`.mapWith(Number),
      micros: total(byokAiRuns.costUsdMicros),
    })
    .from(byokAiRuns)
    .where(
      and(
        eq(byokAiRuns.projectId, projectId),
        eq(byokAiRuns.organizationId, organizationId),
        gte(byokAiRuns.startedAt, sinceIso),
      ),
    );
  return { runs: row?.runs ?? 0, micros: row?.micros ?? 0 };
}

/** BYOK schedule interval for the project's tracker, or null. */
export async function getByokIntervalDays(
  projectId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({ intervalDays: byokAiSchedules.intervalDays })
    .from(byokAiSchedules)
    .innerJoin(aiTrackers, eq(aiTrackers.id, byokAiSchedules.trackerId))
    .innerJoin(projects, eq(projects.id, aiTrackers.projectId))
    .where(
      and(
        eq(aiTrackers.projectId, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.intervalDays ?? null;
}

/** Latest completed upstream AI visibility run: answers + own mentions. */
export async function latestUpstreamMentions(
  projectId: string,
  organizationId: string,
) {
  const [run] = await db
    .select({ id: aiRuns.id, at: aiRuns.completedAt })
    .from(aiRuns)
    .innerJoin(projects, eq(projects.id, aiRuns.projectId))
    .where(
      and(
        eq(aiRuns.projectId, projectId),
        eq(projects.organizationId, organizationId),
        eq(aiRuns.status, "completed"),
      ),
    )
    .orderBy(desc(aiRuns.completedAt))
    .limit(1);
  if (!run) return null;
  const [row] = await db
    .select({
      answers: sql<number>`count(distinct ${aiObservations.id})`.mapWith(
        Number,
      ),
      mentioned:
        sql<number>`count(distinct ${aiMatches.observationId})`.mapWith(Number),
    })
    .from(aiObservations)
    .leftJoin(
      aiMatches,
      and(
        eq(aiMatches.observationId, aiObservations.id),
        eq(aiMatches.own, true),
        eq(aiMatches.mentioned, true),
      ),
    )
    .where(
      and(
        eq(aiObservations.runId, run.id),
        eq(aiObservations.status, "completed"),
      ),
    );
  return {
    at: run.at,
    answers: row?.answers ?? 0,
    mentioned: row?.mentioned ?? 0,
  };
}

/** Latest completed BYOK run: answers + own mentions. */
export async function latestByokMentions(
  projectId: string,
  organizationId: string,
) {
  const [run] = await db
    .select({ id: byokAiRuns.id, at: byokAiRuns.finishedAt })
    .from(byokAiRuns)
    .where(
      and(
        eq(byokAiRuns.projectId, projectId),
        eq(byokAiRuns.organizationId, organizationId),
        eq(byokAiRuns.status, "completed"),
      ),
    )
    .orderBy(desc(byokAiRuns.finishedAt))
    .limit(1);
  if (!run) return null;
  const [row] = await db
    .select({
      answers: sql<number>`count(distinct ${byokAiAnswers.id})`.mapWith(Number),
      mentioned: sql<number>`count(distinct ${byokAiMatches.answerId})`.mapWith(
        Number,
      ),
    })
    .from(byokAiAnswers)
    .leftJoin(
      byokAiMatches,
      and(
        eq(byokAiMatches.answerId, byokAiAnswers.id),
        eq(byokAiMatches.own, true),
        eq(byokAiMatches.mentioned, true),
      ),
    )
    .where(
      and(
        eq(byokAiAnswers.runId, run.id),
        eq(byokAiAnswers.status, "completed"),
      ),
    );
  return {
    at: run.at,
    answers: row?.answers ?? 0,
    mentioned: row?.mentioned ?? 0,
  };
}
