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
import {
  CRAWLER_VERIFICATION,
  TRAFFIC_CLASS_KINDS,
} from "@/server/features/ai-traffic/contracts";

// ADR-013 — AI traffic (Vercel drain receiver writes event + discard rows)
// Fork tables (B5 R4a). Mirrored in pg/ai-traffic.schema.ts.
// Conventions: integrations.schema.ts.
const now = sql`(current_timestamp)`;
const createdAt = () => text("created_at").notNull().default(now);

export const aiTrafficSites = sqliteTable(
  "ai_traffic_site",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    vercelProjectId: text("vercel_project_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ai_traffic_site_vercel_project_idx").on(t.vercelProjectId),
    index("ai_traffic_site_project_idx").on(t.projectId),
  ],
);

// Optional host filter per site (empty = every host of the Vercel project).
export const aiTrafficSiteHosts = sqliteTable(
  "ai_traffic_site_host",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => aiTrafficSites.id, { onDelete: "cascade" }),
    host: text("host").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.host] })],
);

export const aiTrafficEvents = sqliteTable(
  "ai_traffic_event",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => aiTrafficSites.id, { onDelete: "cascade" }),
    // Vercel's request id; drain retries are idempotent on (site_id, event_id).
    eventId: text("event_id").notNull(),
    observedAt: text("observed_at").notNull(),
    method: text("method").notNull(),
    host: text("host").notNull(),
    path: text("path").notNull(),
    queryString: text("query_string"),
    status: integer("status"),
    userAgent: text("user_agent"),
    remoteIp: text("remote_ip"),
    referer: text("referer"),
    sourceType: text("source_type", { enum: ["vercel-drain"] })
      .notNull()
      .default("vercel-drain"),
    receivedAt: text("received_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("ai_traffic_event_site_event_idx").on(t.siteId, t.eventId),
    index("ai_traffic_event_site_observed_idx").on(t.siteId, t.observedAt),
  ],
);

// One classification per event; absent row = not yet classified.
export const aiTrafficClasses = sqliteTable(
  "ai_traffic_class",
  {
    eventId: text("event_id")
      .primaryKey()
      .references(() => aiTrafficEvents.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: TRAFFIC_CLASS_KINDS }).notNull(),
    ruleId: text("rule_id"),
    operator: text("operator"),
    product: text("product"),
    purpose: text("purpose"),
    verification: text("verification", { enum: CRAWLER_VERIFICATION }),
    evidenceType: text("evidence_type", {
      enum: ["referer", "utm", "referer-utm"],
    }),
    rulesVersion: text("rules_version").notNull(),
    classifiedAt: text("classified_at").notNull().default(now),
  },
  (t) => [index("ai_traffic_class_kind_idx").on(t.kind)],
);

// Daily rollup. Key columns are NOT NULL so the composite PK upserts on both
// dialects: no rule → rule_id '', not a crawler → verification ''.
export const aiTrafficDaily = sqliteTable(
  "ai_traffic_daily",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => aiTrafficSites.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    kind: text("kind", { enum: TRAFFIC_CLASS_KINDS }).notNull(),
    ruleId: text("rule_id").notNull().default(""),
    verification: text("verification").notNull().default(""),
    hits: integer("hits").notNull().default(0),
    distinctPaths: integer("distinct_paths").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    primaryKey({
      columns: [t.siteId, t.day, t.kind, t.ruleId, t.verification],
    }),
  ],
);

// Hourly count of entries the receiver dropped (human/other traffic, or an
// unknown Vercel project → site_id NULL so a mis-wired drain is visible).
export const aiTrafficDiscards = sqliteTable(
  "ai_traffic_discard",
  {
    vercelProjectId: text("vercel_project_id").notNull(),
    hour: text("hour").notNull(),
    siteId: text("site_id").references(() => aiTrafficSites.id, {
      onDelete: "cascade",
    }),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.vercelProjectId, t.hour] })],
);
