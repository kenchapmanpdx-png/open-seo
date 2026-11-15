import {
  bigint,
  boolean,
  pgTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// ADR-016 — Common Crawl backlink baseline (written by a local CLI)
// Fork tables (B5 R4a). Mirror of ../commoncrawl.schema.ts.
// Conventions: integrations.schema.ts.
// Text timestamps, same shape as the SQLite schema (see pg/handbook.schema.ts).
const now = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const createdAt = () => text("created_at").notNull().default(now);
const CC_RELEASE_STATUSES = ["downloading", "imported", "failed"] as const;

export const ccReleases = pgTable("cc_release", {
  // Release slug, e.g. cc-main-2026-jul-aug-sep.
  id: text("id").primaryKey(),
  // ADR says `window`; renamed because WINDOW is reserved in Postgres.
  windowLabel: text("window_label").notNull(),
  status: text("status", { enum: CC_RELEASE_STATUSES }).notNull(),
  importedAt: text("imported_at"),
  bytes: bigint("bytes", { mode: "number" }),
});

export const ccTargets = pgTable(
  "cc_target",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    domain: text("domain").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("cc_target_project_domain_idx").on(t.projectId, t.domain),
  ],
);

export const ccBacklinkSummaries = pgTable(
  "cc_backlink_summary",
  {
    id: text("id").primaryKey(),
    targetId: text("target_id")
      .notNull()
      .references(() => ccTargets.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => ccReleases.id, { onDelete: "cascade" }),
    referringDomains: integer("referring_domains").notNull(),
    referringHostsSum: integer("referring_hosts_sum").notNull(),
    importedAt: text("imported_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("cc_backlink_summary_target_release_idx").on(
      t.targetId,
      t.releaseId,
    ),
  ],
);

export const ccBacklinkDomains = pgTable(
  "cc_backlink_domain",
  {
    id: text("id").primaryKey(),
    summaryId: text("summary_id")
      .notNull()
      .references(() => ccBacklinkSummaries.id, { onDelete: "cascade" }),
    linkingDomain: text("linking_domain").notNull(),
    numHosts: integer("num_hosts").notNull(),
  },
  (t) => [
    uniqueIndex("cc_backlink_domain_summary_domain_idx").on(
      t.summaryId,
      t.linkingDomain,
    ),
    index("cc_backlink_domain_summary_hosts_idx").on(t.summaryId, t.numHosts),
  ],
);
