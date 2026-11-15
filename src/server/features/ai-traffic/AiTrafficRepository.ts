import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  aiTrafficClasses,
  aiTrafficDaily,
  aiTrafficDiscards,
  aiTrafficEvents,
  aiTrafficSiteHosts,
  aiTrafficSites,
} from "@/db/integrations-tables";
import { projects } from "@/db/schema";
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

// ---------------------------------------------------------------- reads (UI, MCP)
// Every read joins ai_traffic_site and filters by project + organization.

const siteScope = (projectId: string, organizationId: string) =>
  and(
    eq(aiTrafficSites.projectId, projectId),
    eq(aiTrafficSites.organizationId, organizationId),
  );

export async function projectExists(projectId: string, organizationId: string) {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listSites(projectId: string, organizationId: string) {
  const sites = await db
    .select({
      id: aiTrafficSites.id,
      vercelProjectId: aiTrafficSites.vercelProjectId,
    })
    .from(aiTrafficSites)
    .where(siteScope(projectId, organizationId));
  const hosts = sites.length
    ? await db
        .select({
          siteId: aiTrafficSiteHosts.siteId,
          host: aiTrafficSiteHosts.host,
        })
        .from(aiTrafficSiteHosts)
        .where(
          inArray(
            aiTrafficSiteHosts.siteId,
            sites.map((site) => site.id),
          ),
        )
    : [];
  return sites.map((site) => ({
    ...site,
    hosts: hosts.filter((row) => row.siteId === site.id).map((row) => row.host),
  }));
}

export async function insertSite(input: {
  projectId: string;
  organizationId: string;
  vercelProjectId: string;
  hosts: string[];
}) {
  const id = crypto.randomUUID();
  await runBatch((tx) => [
    tx.insert(aiTrafficSites).values({
      id,
      projectId: input.projectId,
      organizationId: input.organizationId,
      vercelProjectId: input.vercelProjectId,
    }),
    ...(input.hosts.length
      ? [
          tx
            .insert(aiTrafficSiteHosts)
            .values(input.hosts.map((host) => ({ siteId: id, host }))),
        ]
      : []),
  ]);
  return id;
}

export async function deleteSite(
  siteId: string,
  projectId: string,
  organizationId: string,
) {
  await db
    .delete(aiTrafficSites)
    .where(
      and(eq(aiTrafficSites.id, siteId), siteScope(projectId, organizationId)),
    );
}

export async function sumDaily(
  projectId: string,
  organizationId: string,
  fromDay: string,
) {
  return db
    .select({
      kind: aiTrafficDaily.kind,
      ruleId: aiTrafficDaily.ruleId,
      verification: aiTrafficDaily.verification,
      hits: sql<number>`cast(sum(${aiTrafficDaily.hits}) as integer)`,
    })
    .from(aiTrafficDaily)
    .innerJoin(aiTrafficSites, eq(aiTrafficSites.id, aiTrafficDaily.siteId))
    .where(
      and(
        siteScope(projectId, organizationId),
        gte(aiTrafficDaily.day, fromDay),
      ),
    )
    .groupBy(
      aiTrafficDaily.kind,
      aiTrafficDaily.ruleId,
      aiTrafficDaily.verification,
    );
}

export async function topAiPaths(
  projectId: string,
  organizationId: string,
  fromIso: string,
  limit: number,
) {
  const hits = sql<number>`cast(count(*) as integer)`;
  return db
    .select({ path: aiTrafficEvents.path, hits })
    .from(aiTrafficEvents)
    .innerJoin(
      aiTrafficClasses,
      eq(aiTrafficClasses.eventId, aiTrafficEvents.id),
    )
    .innerJoin(aiTrafficSites, eq(aiTrafficSites.id, aiTrafficEvents.siteId))
    .where(
      and(
        siteScope(projectId, organizationId),
        gte(aiTrafficEvents.observedAt, fromIso),
        inArray(aiTrafficClasses.kind, ["crawler", "user_fetch", "referral"]),
      ),
    )
    .groupBy(aiTrafficEvents.path)
    .orderBy(desc(hits))
    .limit(limit);
}

export async function sumDiscards(
  projectId: string,
  organizationId: string,
  fromHour: string,
) {
  const [row] = await db
    .select({
      count: sql<number>`cast(coalesce(sum(${aiTrafficDiscards.count}), 0) as integer)`,
    })
    .from(aiTrafficDiscards)
    .innerJoin(aiTrafficSites, eq(aiTrafficSites.id, aiTrafficDiscards.siteId))
    .where(
      and(
        siteScope(projectId, organizationId),
        gte(aiTrafficDiscards.hour, fromHour),
      ),
    );
  return row?.count ?? 0;
}
