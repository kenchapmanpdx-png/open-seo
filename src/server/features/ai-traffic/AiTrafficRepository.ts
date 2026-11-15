import { and, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  aiTrafficClasses,
  aiTrafficDaily,
  aiTrafficEvents,
} from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import type { TrafficClass, TrafficEvent } from "./contracts";

// AI traffic storage (ADR-013 §3). Events arrive from the drain receiver; the
// app classifies them and keeps a daily rollup. Portable SQL only.

const dayOf = sql<string>`substr(${aiTrafficEvents.observedAt}, 1, 10)`;

export type StoredEvent = { id: string } & TrafficEvent;

export async function listUnclassifiedEvents(
  limit: number,
): Promise<StoredEvent[]> {
  const rows = await db
    .select({
      id: aiTrafficEvents.id,
      eventId: aiTrafficEvents.eventId,
      observedAt: aiTrafficEvents.observedAt,
      method: aiTrafficEvents.method,
      host: aiTrafficEvents.host,
      path: aiTrafficEvents.path,
      queryString: aiTrafficEvents.queryString,
      status: aiTrafficEvents.status,
      userAgent: aiTrafficEvents.userAgent,
      remoteIp: aiTrafficEvents.remoteIp,
      referer: aiTrafficEvents.referer,
      sourceType: aiTrafficEvents.sourceType,
    })
    .from(aiTrafficEvents)
    .leftJoin(
      aiTrafficClasses,
      eq(aiTrafficClasses.eventId, aiTrafficEvents.id),
    )
    .where(isNull(aiTrafficClasses.eventId))
    .limit(limit);
  return rows;
}

export async function insertClasses(
  rows: Array<{ eventId: string; traffic: TrafficClass }>,
) {
  // 10 columns per row: 9 rows keep a statement under D1's ~100 parameters.
  for (const part of chunk(rows, 50)) {
    await runBatch((tx) =>
      chunk(part, 9).map((group) =>
        tx
          .insert(aiTrafficClasses)
          .values(
            group.map(({ eventId, traffic }) => ({
              eventId,
              kind: traffic.kind,
              ruleId: traffic.ruleId,
              operator: traffic.operator,
              product: traffic.product,
              purpose: traffic.purpose,
              verification: traffic.verification,
              evidenceType: traffic.evidenceType,
              rulesVersion: traffic.rulesVersion,
            })),
          )
          .onConflictDoNothing(),
      ),
    );
  }
}

/** Classified, non-self events observed on or after `fromDay` (YYYY-MM-DD). */
export async function listRollupSource(fromDay: string) {
  return db
    .select({
      siteId: aiTrafficEvents.siteId,
      day: dayOf,
      method: aiTrafficEvents.method,
      path: aiTrafficEvents.path,
      queryString: aiTrafficEvents.queryString,
      kind: aiTrafficClasses.kind,
      ruleId: aiTrafficClasses.ruleId,
      verification: aiTrafficClasses.verification,
    })
    .from(aiTrafficEvents)
    .innerJoin(
      aiTrafficClasses,
      eq(aiTrafficClasses.eventId, aiTrafficEvents.id),
    )
    .where(and(sql`${dayOf} >= ${fromDay}`, ne(aiTrafficClasses.kind, "self")));
}

export type DailyRow = typeof aiTrafficDaily.$inferInsert;

/** Replaces the rollup rows of `days` with `rows` (one atomic batch). */
export async function replaceDaily(days: string[], rows: DailyRow[]) {
  const updatedAt = new Date().toISOString();
  await runBatch((tx) => [
    tx.delete(aiTrafficDaily).where(inArray(aiTrafficDaily.day, days)),
    // 8 columns per row → 12 rows per statement.
    ...chunk(rows, 12).map((group) =>
      tx
        .insert(aiTrafficDaily)
        .values(group.map((row) => ({ ...row, updatedAt }))),
    ),
  ]);
}

export async function deleteEventsObservedBefore(iso: string) {
  await db.delete(aiTrafficEvents).where(lt(aiTrafficEvents.observedAt, iso));
}

/** Drops up to `limit` class rows from older rules so the tick re-classifies them. */
export async function deleteStaleClasses(rulesVersion: string, limit: number) {
  const stale = await db
    .select({ eventId: aiTrafficClasses.eventId })
    .from(aiTrafficClasses)
    .where(ne(aiTrafficClasses.rulesVersion, rulesVersion))
    .limit(limit);
  for (const ids of chunk(
    stale.map((row) => row.eventId),
    90,
  ))
    await db
      .delete(aiTrafficClasses)
      .where(inArray(aiTrafficClasses.eventId, ids));
  return stale.length;
}
