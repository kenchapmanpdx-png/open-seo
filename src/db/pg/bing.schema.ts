import {
  boolean,
  pgTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// ADR-014 — Bing Webmaster Tools + AI Performance CSV import
// Fork tables (B5 R4a). Mirror of ../bing.schema.ts.
// Conventions: integrations.schema.ts.
// Text timestamps, same shape as the SQLite schema (see pg/handbook.schema.ts).
const now = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const createdAt = () => text("created_at").notNull().default(now);

// One key per organization, encrypted with upstream's tokenCrypto.
export const bingCredentials = pgTable("bing_credential", {
  organizationId: text("organization_id").primaryKey(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  updatedAt: text("updated_at").notNull().default(now),
});

export const bingSites = pgTable(
  "bing_site",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    // Exactly as Bing Webmaster Tools lists it (picked from getSites).
    siteUrl: text("site_url").notNull(),
    verified: boolean("verified").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bing_site_project_url_idx").on(t.projectId, t.siteUrl)],
);

const bingSiteId = () =>
  text("site_id")
    .notNull()
    .references(() => bingSites.id, { onDelete: "cascade" });

export const bingSyncState = pgTable("bing_sync_state", {
  siteId: text("site_id")
    .primaryKey()
    .references(() => bingSites.id, { onDelete: "cascade" }),
  lastSuccessAt: text("last_success_at"),
  lastError: text("last_error"),
  updatedAt: text("updated_at").notNull().default(now),
});

export const bingDailyTraffic = pgTable(
  "bing_daily_traffic",
  {
    siteId: bingSiteId(),
    day: text("day").notNull(),
    impressions: integer("impressions").notNull(),
    clicks: integer("clicks").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day] })],
);

export const bingQueryWeeks = pgTable(
  "bing_query_week",
  {
    siteId: bingSiteId(),
    weekStart: text("week_start").notNull(),
    query: text("query").notNull(),
    impressions: integer("impressions").notNull(),
    clicks: integer("clicks").notNull(),
    avgImpressionPosition: real("avg_impression_position"),
    avgClickPosition: real("avg_click_position"),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.weekStart, t.query] })],
);

export const bingPageWeeks = pgTable(
  "bing_page_week",
  {
    siteId: bingSiteId(),
    weekStart: text("week_start").notNull(),
    page: text("page").notNull(),
    impressions: integer("impressions").notNull(),
    clicks: integer("clicks").notNull(),
    avgImpressionPosition: real("avg_impression_position"),
    avgClickPosition: real("avg_click_position"),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.weekStart, t.page] })],
);

export const bingCrawlIssues = pgTable(
  "bing_crawl_issue",
  {
    siteId: bingSiteId(),
    url: text("url").notNull(),
    issueType: text("issue_type").notNull(),
    httpCode: integer("http_code"),
    firstSeen: text("first_seen").notNull(),
    lastSeen: text("last_seen").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.url, t.issueType] })],
);

// Evidence row for every AI Performance CSV import (file kept in the
// evidence store; ADR-003). Re-importing the same file is a no-op.
export const bingAiImports = pgTable(
  "bing_ai_import",
  {
    id: text("id").primaryKey(),
    siteId: bingSiteId(),
    importedBy: text("imported_by").notNull(),
    fileHash: text("file_hash").notNull(),
    evidencePath: text("evidence_path").notNull(),
    rowsRead: integer("rows_read").notNull(),
    rowsUpserted: integer("rows_upserted").notNull(),
    importedAt: text("imported_at").notNull().default(now),
  },
  (t) => [uniqueIndex("bing_ai_import_site_hash_idx").on(t.siteId, t.fileHash)],
);

export const bingAiCitationDays = pgTable(
  "bing_ai_citation_day",
  {
    siteId: bingSiteId(),
    day: text("day").notNull(),
    citations: integer("citations").notNull(),
    citedPages: integer("cited_pages"),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day] })],
);

export const bingAiGroundingQueries = pgTable(
  "bing_ai_grounding_query",
  {
    siteId: bingSiteId(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    query: text("query").notNull(),
    citations: integer("citations").notNull(),
  },
  (t) => [
    primaryKey({
      name: "bing_ai_grounding_query_pk",
      columns: [t.siteId, t.periodStart, t.periodEnd, t.query],
    }),
  ],
);
