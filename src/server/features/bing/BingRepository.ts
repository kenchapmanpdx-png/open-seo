import { and, desc, eq, gte, sql } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  bingAiCitationDays,
  bingAiGroundingQueries,
  bingAiImports,
  bingCrawlIssues,
  bingDailyTraffic,
  bingPageWeeks,
  bingQueryWeeks,
  bingSites,
  bingSyncState,
} from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import { projects } from "@/db/schema";

// Bing Webmaster Tools storage (ADR-014 §1–2). Project-facing reads and writes
// are scoped by project + organization; the cron sync walks every bound site.
// Upserts use `excluded.*`, which SQLite and Postgres both support.

const excluded = (column: string) => sql.raw(`excluded.${column}`);

// D1 caps a statement at 100 bound parameters: rows per insert = 100 / columns.
const ROWS_PER_STATEMENT = { daily: 20, week: 12, issue: 14 } as const;
const STATEMENTS_PER_BATCH = 20;

type BatchTx = Parameters<Parameters<typeof runBatch>[0]>[0];

async function batchedUpserts<T>(
  rows: T[],
  rowsPerStatement: number,
  statement: (tx: BatchTx, group: T[]) => Promise<unknown>,
) {
  const groups = chunk(rows, rowsPerStatement);
  for (const part of chunk(groups, STATEMENTS_PER_BATCH)) {
    await runBatch((tx) => part.map((group) => statement(tx, group)));
  }
}

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
  return row !== undefined;
}

export async function upsertSite(input: {
  projectId: string;
  organizationId: string;
  siteUrl: string;
  verified: boolean;
}) {
  const [row] = await db
    .insert(bingSites)
    .values({ id: crypto.randomUUID(), ...input })
    .onConflictDoUpdate({
      target: [bingSites.projectId, bingSites.siteUrl],
      set: { verified: input.verified },
    })
    .returning({ id: bingSites.id });
  return row.id;
}

/** Every bound site, oldest binding first (cron sync). */
export async function listAllSites(limit: number) {
  return db
    .select({
      id: bingSites.id,
      organizationId: bingSites.organizationId,
      siteUrl: bingSites.siteUrl,
    })
    .from(bingSites)
    .orderBy(bingSites.createdAt, bingSites.id)
    .limit(limit);
}

export async function setVerified(siteId: string, verified: boolean) {
  await db.update(bingSites).set({ verified }).where(eq(bingSites.id, siteId));
}

export async function recordSyncResult(
  siteId: string,
  result: { ok: true; at: string } | { ok: false; at: string; error: string },
) {
  const set = result.ok
    ? { lastSuccessAt: result.at, lastError: null, updatedAt: result.at }
    : { lastError: result.error, updatedAt: result.at };
  await db
    .insert(bingSyncState)
    .values({ siteId, ...set })
    .onConflictDoUpdate({ target: bingSyncState.siteId, set });
}

export type DailyTrafficRow = {
  day: string;
  impressions: number;
  clicks: number;
};

export async function upsertDailyTraffic(
  siteId: string,
  rows: DailyTrafficRow[],
) {
  await batchedUpserts(rows, ROWS_PER_STATEMENT.daily, (tx, group) =>
    tx
      .insert(bingDailyTraffic)
      .values(group.map((row) => ({ siteId, ...row })))
      .onConflictDoUpdate({
        target: [bingDailyTraffic.siteId, bingDailyTraffic.day],
        set: {
          impressions: excluded("impressions"),
          clicks: excluded("clicks"),
        },
      }),
  );
}

type WeekStats = {
  weekStart: string;
  impressions: number;
  clicks: number;
  avgImpressionPosition: number | null;
  avgClickPosition: number | null;
};
export type QueryWeekRow = WeekStats & { query: string };
export type PageWeekRow = WeekStats & { page: string };

const weekStatsSet = {
  impressions: excluded("impressions"),
  clicks: excluded("clicks"),
  avgImpressionPosition: excluded("avg_impression_position"),
  avgClickPosition: excluded("avg_click_position"),
};

export async function upsertQueryWeeks(siteId: string, rows: QueryWeekRow[]) {
  await batchedUpserts(rows, ROWS_PER_STATEMENT.week, (tx, group) =>
    tx
      .insert(bingQueryWeeks)
      .values(group.map((row) => ({ siteId, ...row })))
      .onConflictDoUpdate({
        target: [
          bingQueryWeeks.siteId,
          bingQueryWeeks.weekStart,
          bingQueryWeeks.query,
        ],
        set: weekStatsSet,
      }),
  );
}

export async function upsertPageWeeks(siteId: string, rows: PageWeekRow[]) {
  await batchedUpserts(rows, ROWS_PER_STATEMENT.week, (tx, group) =>
    tx
      .insert(bingPageWeeks)
      .values(group.map((row) => ({ siteId, ...row })))
      .onConflictDoUpdate({
        target: [
          bingPageWeeks.siteId,
          bingPageWeeks.weekStart,
          bingPageWeeks.page,
        ],
        set: weekStatsSet,
      }),
  );
}

export type CrawlIssueRow = {
  url: string;
  issueType: string;
  httpCode: number | null;
};

/** New issues get `first_seen = seenOn`; known ones keep it and bump `last_seen`. */
export async function upsertCrawlIssues(
  siteId: string,
  rows: CrawlIssueRow[],
  seenOn: string,
) {
  await batchedUpserts(rows, ROWS_PER_STATEMENT.issue, (tx, group) =>
    tx
      .insert(bingCrawlIssues)
      .values(
        group.map((row) => ({
          siteId,
          ...row,
          firstSeen: seenOn,
          lastSeen: seenOn,
        })),
      )
      .onConflictDoUpdate({
        target: [
          bingCrawlIssues.siteId,
          bingCrawlIssues.url,
          bingCrawlIssues.issueType,
        ],
        set: {
          httpCode: excluded("http_code"),
          lastSeen: excluded("last_seen"),
        },
      }),
  );
}

// ---------------------------------------------------------------- reads (page, MCP)
// Callers resolve the site through `listProjectSites` (project + organization
// scoped) and pass its id to the per-site reads below.

export async function listProjectSites(
  projectId: string,
  organizationId: string,
) {
  return db
    .select({
      id: bingSites.id,
      siteUrl: bingSites.siteUrl,
      verified: bingSites.verified,
      lastSuccessAt: bingSyncState.lastSuccessAt,
      lastError: bingSyncState.lastError,
    })
    .from(bingSites)
    .leftJoin(bingSyncState, eq(bingSyncState.siteId, bingSites.id))
    .where(
      and(
        eq(bingSites.projectId, projectId),
        eq(bingSites.organizationId, organizationId),
      ),
    )
    .orderBy(bingSites.createdAt, bingSites.id);
}

export async function deleteSite(
  siteId: string,
  projectId: string,
  organizationId: string,
) {
  await db
    .delete(bingSites)
    .where(
      and(
        eq(bingSites.id, siteId),
        eq(bingSites.projectId, projectId),
        eq(bingSites.organizationId, organizationId),
      ),
    );
}

export async function listDailyTraffic(siteId: string, fromDay: string) {
  return db
    .select({
      day: bingDailyTraffic.day,
      clicks: bingDailyTraffic.clicks,
      impressions: bingDailyTraffic.impressions,
    })
    .from(bingDailyTraffic)
    .where(
      and(
        eq(bingDailyTraffic.siteId, siteId),
        gte(bingDailyTraffic.day, fromDay),
      ),
    )
    .orderBy(bingDailyTraffic.day);
}

export async function latestWeekStart(siteId: string) {
  const [row] = await db
    .select({ weekStart: sql<string | null>`max(${bingQueryWeeks.weekStart})` })
    .from(bingQueryWeeks)
    .where(eq(bingQueryWeeks.siteId, siteId));
  return row?.weekStart ?? null;
}

export async function topQueries(
  siteId: string,
  fromWeek: string,
  limit: number,
) {
  const clicks = sql<number>`cast(sum(${bingQueryWeeks.clicks}) as integer)`;
  return db
    .select({
      label: bingQueryWeeks.query,
      clicks,
      impressions: sql<number>`cast(sum(${bingQueryWeeks.impressions}) as integer)`,
    })
    .from(bingQueryWeeks)
    .where(
      and(
        eq(bingQueryWeeks.siteId, siteId),
        gte(bingQueryWeeks.weekStart, fromWeek),
      ),
    )
    .groupBy(bingQueryWeeks.query)
    .orderBy(desc(clicks), bingQueryWeeks.query)
    .limit(limit);
}

export async function topPages(
  siteId: string,
  fromWeek: string,
  limit: number,
) {
  const clicks = sql<number>`cast(sum(${bingPageWeeks.clicks}) as integer)`;
  return db
    .select({
      label: bingPageWeeks.page,
      clicks,
      impressions: sql<number>`cast(sum(${bingPageWeeks.impressions}) as integer)`,
    })
    .from(bingPageWeeks)
    .where(
      and(
        eq(bingPageWeeks.siteId, siteId),
        gte(bingPageWeeks.weekStart, fromWeek),
      ),
    )
    .groupBy(bingPageWeeks.page)
    .orderBy(desc(clicks), bingPageWeeks.page)
    .limit(limit);
}

export async function listCrawlIssues(siteId: string, limit: number) {
  return db
    .select({
      url: bingCrawlIssues.url,
      issueType: bingCrawlIssues.issueType,
      httpCode: bingCrawlIssues.httpCode,
      firstSeen: bingCrawlIssues.firstSeen,
      lastSeen: bingCrawlIssues.lastSeen,
    })
    .from(bingCrawlIssues)
    .where(eq(bingCrawlIssues.siteId, siteId))
    .orderBy(desc(bingCrawlIssues.lastSeen), bingCrawlIssues.url)
    .limit(limit);
}

export async function listAiCitationDays(siteId: string, fromDay: string) {
  return db
    .select({
      day: bingAiCitationDays.day,
      citations: bingAiCitationDays.citations,
      citedPages: bingAiCitationDays.citedPages,
    })
    .from(bingAiCitationDays)
    .where(
      and(
        eq(bingAiCitationDays.siteId, siteId),
        gte(bingAiCitationDays.day, fromDay),
      ),
    )
    .orderBy(bingAiCitationDays.day);
}

export async function topGroundingQueries(
  siteId: string,
  fromDay: string,
  limit: number,
) {
  const citations = sql<number>`cast(sum(${bingAiGroundingQueries.citations}) as integer)`;
  return db
    .select({ query: bingAiGroundingQueries.query, citations })
    .from(bingAiGroundingQueries)
    .where(
      and(
        eq(bingAiGroundingQueries.siteId, siteId),
        gte(bingAiGroundingQueries.periodEnd, fromDay),
      ),
    )
    .groupBy(bingAiGroundingQueries.query)
    .orderBy(desc(citations), bingAiGroundingQueries.query)
    .limit(limit);
}

export async function lastAiImportAt(siteId: string) {
  const [row] = await db
    .select({ at: sql<string | null>`max(${bingAiImports.importedAt})` })
    .from(bingAiImports)
    .where(eq(bingAiImports.siteId, siteId));
  return row?.at ?? null;
}
