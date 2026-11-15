import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";
import { handbookRuns } from "./handbook.schema";
import {
  OUTCOME_CHECK_STATUSES,
  OUTCOME_METRICS,
  REPORT_CADENCES,
} from "@/server/features/agency/contracts";

// ADR-017 — Agency layer + outcome record (+4 / +12 weeks)
// Fork tables (B5 R4a). Mirrored in pg/agency.schema.ts.
// Conventions: integrations.schema.ts.
const now = sql`(current_timestamp)`;
const createdAt = () => text("created_at").notNull().default(now);

export const agencyClients = sqliteTable("agency_client", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull(),
  clientName: text("client_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  reportCadence: text("report_cadence", { enum: REPORT_CADENCES })
    .notNull()
    .default("none"),
  notes: text("notes"),
  updatedAt: text("updated_at").notNull().default(now),
});

export const agencyBrands = sqliteTable("agency_brand", {
  organizationId: text("organization_id").primaryKey(),
  agencyName: text("agency_name").notNull(),
  logoPath: text("logo_path"),
  accentColor: text("accent_color"),
  contactLine: text("contact_line"),
  footerText: text("footer_text"),
  hideOpenseoCredit: integer("hide_openseo_credit", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: text("updated_at").notNull().default(now),
});

export const outcomeBatches = sqliteTable(
  "outcome_batch",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    baselineRunId: text("baseline_run_id")
      .notNull()
      .references(() => handbookRuns.id, { onDelete: "cascade" }),
    fixedAt: text("fixed_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("outcome_batch_project_fixed_idx").on(t.projectId, t.fixedAt)],
);

// Finding classes in a fix batch: item id + affected URL (site-level items
// use the project home URL).
export const outcomeBatchClasses = sqliteTable(
  "outcome_batch_class",
  {
    batchId: text("batch_id")
      .notNull()
      .references(() => outcomeBatches.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    url: text("url").notNull(),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.itemId, t.url] })],
);

export const outcomeChecks = sqliteTable(
  "outcome_check",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => outcomeBatches.id, { onDelete: "cascade" }),
    // 4 or 12 (OUTCOME_OFFSETS_WEEKS); validated in the service.
    offsetWeeks: integer("offset_weeks").notNull(),
    dueAt: text("due_at").notNull(),
    status: text("status", { enum: OUTCOME_CHECK_STATUSES })
      .notNull()
      .default("scheduled"),
    resultRunId: text("result_run_id").references(() => handbookRuns.id, {
      onDelete: "set null",
    }),
    completedAt: text("completed_at"),
  },
  (t) => [
    uniqueIndex("outcome_check_batch_offset_idx").on(t.batchId, t.offsetWeeks),
    index("outcome_check_status_due_idx").on(t.status, t.dueAt),
  ],
);

// One row per (check, item, url, metric). Values are text: counts, index states and
// handbook statuses share the column; NULL = BLOCKED (source not connected).
export const outcomeMetrics = sqliteTable(
  "outcome_metric",
  {
    id: text("id").primaryKey(),
    checkId: text("check_id")
      .notNull()
      .references(() => outcomeChecks.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    url: text("url").notNull(),
    metric: text("metric", { enum: OUTCOME_METRICS }).notNull(),
    beforeValue: text("before_value"),
    afterValue: text("after_value"),
    source: text("source").notNull(),
    evidencePath: text("evidence_path"),
  },
  (t) => [
    uniqueIndex("outcome_metric_check_item_url_metric_idx").on(
      t.checkId,
      t.itemId,
      t.url,
      t.metric,
    ),
  ],
);
