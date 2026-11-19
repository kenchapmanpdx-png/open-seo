import {
  boolean,
  pgTable,
  text,
  integer,
  real,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";
import { audits } from "./audit.schema";
import {
  HANDBOOK_MODES,
  ITEM_STATUSES,
  RUN_STATUSES,
  SITE_TIERS,
  FIXABILITY,
  EFFORTS,
} from "@/server/features/handbook/contracts/status";
import { HANDBOOK_DEPTHS } from "@/server/features/handbook/contracts/exports";

// ============================================================================
// Handbook audit engine (fork feature; ADR-002). Mirror of ../handbook.schema.ts.
// Item ids reference the versioned registry (registry.json), not a table.
// ============================================================================

const SEVERITIES = ["S1", "S2", "S3", "S4"] as const;
// Text timestamps, same shape as the SQLite schema (see pg/audit.schema.ts).
const now = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const handbookProjectSettings = pgTable("handbook_project_setting", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  mode: text("mode", { enum: HANDBOOK_MODES }).notNull().default("AUDIT"),
  tierOverride: text("tier_override", { enum: SITE_TIERS }),
  // B11 per-run options (ADR-023): apply to every following run.
  copyQuality: boolean("copy_quality").notNull().default(false),
  serpOriginality: boolean("serp_originality").notNull().default(false),
  updatedAt: text("updated_at").notNull().default(now),
});

export const handbookRuns = pgTable(
  "handbook_run",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    auditId: text("audit_id").references(() => audits.id, {
      onDelete: "set null",
    }),
    origin: text("origin").notNull(),
    handbookVersion: text("handbook_version").notNull(),
    contractsVersion: text("contracts_version").notNull(),
    mode: text("mode", { enum: HANDBOOK_MODES }).notNull(),
    tier: text("tier", { enum: SITE_TIERS }),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("queued"),
    scoreUncapped: real("score_uncapped"),
    scoreFinal: real("score_final"),
    capReason: text("cap_reason"),
    grade: text("grade"),
    llmCostUsd: real("llm_cost_usd").notNull().default(0),
    errorCode: text("error_code"),
    // ADR-018 (contracts 1.5.0): rows before B8 were quick-depth runs.
    depth: text("depth", { enum: HANDBOOK_DEPTHS }).notNull().default("quick"),
    coverageDiscovered: integer("coverage_discovered"),
    coverageRead: integer("coverage_read"),
    coverageCapped: boolean("coverage_capped").notNull().default(false),
    startedAt: text("started_at").notNull().default(now),
    finishedAt: text("finished_at"),
  },
  (table) => [
    index("handbook_run_project_started_idx").on(
      table.projectId,
      table.startedAt,
    ),
  ],
);

const runId = () =>
  text("run_id")
    .notNull()
    .references(() => handbookRuns.id, { onDelete: "cascade" });

export const handbookSiteProfiles = pgTable(
  "handbook_site_profile",
  {
    runId: runId(),
    spCode: text("sp_code").notNull(),
    value: text("value", { enum: ["Y", "N", "?"] }).notNull(),
    evidence: text("evidence").notNull(),
    confidence: text("confidence", {
      enum: ["high", "medium", "low"],
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.spCode] })],
);

export const handbookTemplates = pgTable(
  "handbook_template",
  {
    id: text("id").primaryKey(),
    runId: runId(),
    templateKey: text("template_key").notNull(),
    urlPattern: text("url_pattern").notNull(),
    skeletonHash: text("skeleton_hash").notNull(),
    pageCount: integer("page_count").notNull(),
  },
  (table) => [
    uniqueIndex("handbook_template_run_key_idx").on(
      table.runId,
      table.templateKey,
    ),
  ],
);

export const handbookTemplateSamples = pgTable(
  "handbook_template_sample",
  {
    templateId: text("template_id")
      .notNull()
      .references(() => handbookTemplates.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    rank: integer("rank").notNull(),
    reason: text("reason", {
      enum: ["first", "median", "largest"],
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.rank] })],
);

export const handbookPageSnapshots = pgTable(
  "handbook_page_snapshot",
  {
    id: text("id").primaryKey(),
    runId: runId(),
    url: text("url").notNull(),
    finalUrl: text("final_url"),
    templateId: text("template_id").references(() => handbookTemplates.id, {
      onDelete: "set null",
    }),
    status: integer("status"),
    contentType: text("content_type"),
    rawKey: text("raw_key"),
    renderedKey: text("rendered_key"),
    nojsKey: text("nojs_key"),
    wordsRaw: integer("words_raw"),
    wordsRendered: integer("words_rendered"),
    fetchedAt: text("fetched_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("handbook_page_snapshot_run_url_idx").on(
      table.runId,
      table.url,
    ),
  ],
);

export const handbookItemStatuses = pgTable(
  "handbook_item_status",
  {
    runId: runId(),
    itemId: text("item_id").notNull(),
    status: text("status", { enum: ITEM_STATUSES }).notNull(),
    score: real("score"),
    note: text("note"),
    severity: text("severity", { enum: SEVERITIES }),
  },
  (table) => [primaryKey({ columns: [table.runId, table.itemId] })],
);

export const handbookFindings = pgTable(
  "handbook_finding",
  {
    id: text("id").primaryKey(),
    runId: runId(),
    code: text("code").notNull(),
    phase: text("phase").notNull(),
    sectionRef: text("section_ref"),
    severity: text("severity", { enum: SEVERITIES }).notNull(),
    severityReason: text("severity_reason"),
    class: text("class").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    fix: text("fix").notNull(),
    fixability: text("fixability", { enum: FIXABILITY }).notNull(),
    limitedReason: text("limited_reason"),
    effort: text("effort", { enum: EFFORTS }).notNull(),
    templateKey: text("template_key"),
    source: text("source", { enum: ["deterministic", "llm"] }).notNull(),
  },
  (table) => [
    uniqueIndex("handbook_finding_run_code_idx").on(table.runId, table.code),
  ],
);

const findingId = () =>
  text("finding_id")
    .notNull()
    .references(() => handbookFindings.id, { onDelete: "cascade" });

export const handbookFindingItems = pgTable(
  "handbook_finding_item",
  {
    findingId: findingId(),
    itemId: text("item_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.findingId, table.itemId] })],
);

export const handbookFindingUrls = pgTable(
  "handbook_finding_url",
  {
    findingId: findingId(),
    url: text("url").notNull(),
  },
  (table) => [primaryKey({ columns: [table.findingId, table.url] })],
);

export const handbookEvidence = pgTable(
  "handbook_evidence",
  {
    id: text("id").primaryKey(),
    runId: runId(),
    findingId: text("finding_id").references(() => handbookFindings.id, {
      onDelete: "cascade",
    }),
    itemId: text("item_id").notNull(),
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    excerpt: text("excerpt").notNull(),
    sha256: text("sha256").notNull(),
    byteSize: integer("byte_size").notNull().default(0),
    contentType: text("content_type"),
    capturedAt: text("captured_at").notNull().default(now),
  },
  (table) => [
    index("handbook_evidence_run_item_idx").on(table.runId, table.itemId),
    index("handbook_evidence_finding_idx").on(table.findingId),
  ],
);

export const handbookBotFetches = pgTable(
  "handbook_bot_fetch",
  {
    id: text("id").primaryKey(),
    runId: runId(),
    url: text("url").notNull(),
    bot: text("bot").notNull(),
    status: integer("status"),
    finalUrl: text("final_url"),
    bytes: integer("bytes"),
    words: integer("words"),
    bodySha256: text("body_sha256"),
    blockedReason: text("blocked_reason"),
  },
  (table) => [
    uniqueIndex("handbook_bot_fetch_run_url_bot_idx").on(
      table.runId,
      table.url,
      table.bot,
    ),
  ],
);

export const handbookLlmCalls = pgTable(
  "handbook_llm_call",
  {
    id: text("id").primaryKey(),
    runId: runId(),
    itemId: text("item_id").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    promptSha256: text("prompt_sha256").notNull(),
    verdict: text("verdict"),
    quotesVerified: boolean("quotes_verified").notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [index("handbook_llm_call_run_idx").on(table.runId)],
);

// ADR-018: one row per staged-workflow step (`runId:stage:batch`). A replayed
// step whose row is `done` returns immediately.
export const HANDBOOK_RUN_STAGES = [
  "crawl",
  "render",
  "axe",
  "lighthouse",
  "map",
  "reduce",
  "checks",
  "report",
] as const;
export const HANDBOOK_STAGE_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
] as const;

export const handbookRunStages = pgTable(
  "handbook_run_stage",
  {
    runId: runId(),
    stage: text("stage", { enum: HANDBOOK_RUN_STAGES }).notNull(),
    batch: integer("batch").notNull().default(0),
    status: text("status", { enum: HANDBOOK_STAGE_STATUSES })
      .notNull()
      .default("pending"),
    attempt: integer("attempt").notNull().default(0),
    itemsTotal: integer("items_total").notNull().default(0),
    itemsDone: integer("items_done").notNull().default(0),
    error: text("error"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
  },
  (table) => [primaryKey({ columns: [table.runId, table.stage, table.batch] })],
);

// ADR-018: one handbook run per machine. `key` = lease name ("machine");
// the holder renews `expiresAt` at each stage start; an expired lease is
// taken over.
export const handbookRunLeases = pgTable("handbook_run_lease", {
  key: text("key").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => handbookRuns.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  renewedAt: text("renewed_at").notNull().default(now),
});

// ADR-019: map-stage PageProfile cache, project-scoped, keyed by
// (url, text sha256, prompt version, model). `profileJson` is the verified
// K14 document, validated with `pageProfileSchema` on read and never queried
// by field — an opaque cached LLM output, not relational data.
export const handbookPageProfiles = pgTable(
  "handbook_page_profile",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => handbookRuns.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    textSha256: text("text_sha256").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    scope: text("scope", { enum: ["page", "template"] }).notNull(),
    templateKey: text("template_key"),
    pageType: text("page_type").notNull(),
    profileJson: text("profile_json").notNull(),
    droppedQuotes: integer("dropped_quotes").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
    lastUsedAt: text("last_used_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("handbook_page_profile_key_idx").on(
      table.projectId,
      table.url,
      table.textSha256,
      table.promptVersion,
      table.model,
    ),
    index("handbook_page_profile_run_idx").on(table.runId),
  ],
);
