import { and, eq, sql } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
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
