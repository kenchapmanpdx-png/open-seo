import {
  boolean,
  pgTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";
import { aiPrompts, aiSources, aiTrackers } from "./ai-visibility.schema";
import {
  BYOK_PROVIDERS,
  CITATION_CATEGORIES,
  CITATION_PAGE_TYPES,
} from "@/server/features/ai-visibility/providers/byok/contracts";

// ADR-015 — BYOK AI visibility (fork tables keyed to upstream prompts)
// Fork tables (B5 R4a). Mirror of ../byok-ai.schema.ts.
// Conventions: integrations.schema.ts.
// Text timestamps, same shape as the SQLite schema (see pg/handbook.schema.ts).
const now = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const RUN_STATUSES = ["queued", "running", "completed", "failed"] as const;
const ANSWER_STATUSES = ["completed", "failed"] as const;

export const byokAiCredentials = pgTable(
  "byok_ai_credential",
  {
    organizationId: text("organization_id").notNull(),
    provider: text("provider", { enum: BYOK_PROVIDERS }).notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.provider] })],
);

// Which providers/models a tracker runs with the user's keys.
export const byokAiTrackerProviders = pgTable(
  "byok_ai_tracker_provider",
  {
    trackerId: text("tracker_id")
      .notNull()
      .references(() => aiTrackers.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: BYOK_PROVIDERS }).notNull(),
    model: text("model").notNull(),
  },
  (t) => [primaryKey({ columns: [t.trackerId, t.provider] })],
);

// Optional schedule; due-selection on the 5-minute tick (ADR-011).
export const byokAiSchedules = pgTable(
  "byok_ai_schedule",
  {
    trackerId: text("tracker_id")
      .primaryKey()
      .references(() => aiTrackers.id, { onDelete: "cascade" }),
    intervalDays: integer("interval_days").notNull(),
    nextRunAt: text("next_run_at").notNull(),
  },
  (t) => [index("byok_ai_schedule_next_run_idx").on(t.nextRunAt)],
);

export const byokAiRuns = pgTable(
  "byok_ai_run",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => aiTrackers.id, { onDelete: "cascade" }),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("queued"),
    costUsdMicros: integer("cost_usd_micros").notNull().default(0),
    startedAt: text("started_at").notNull().default(now),
    finishedAt: text("finished_at"),
  },
  (t) => [
    index("byok_ai_run_tracker_started_idx").on(t.trackerId, t.startedAt),
  ],
);

export const byokAiAnswers = pgTable(
  "byok_ai_answer",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => byokAiRuns.id, { onDelete: "cascade" }),
    promptId: text("prompt_id")
      .notNull()
      .references(() => aiPrompts.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: BYOK_PROVIDERS }).notNull(),
    model: text("model").notNull(),
    modelVersion: text("model_version"),
    webSearch: boolean("web_search").notNull(),
    status: text("status", { enum: ANSWER_STATUSES }).notNull(),
    answerMarkdown: text("answer_markdown"),
    // Raw provider JSON lives in the evidence store (ADR-003), not a column.
    rawOutputPath: text("raw_output_path"),
    error: text("error"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    searchCalls: integer("search_calls"),
    costUsdMicros: integer("cost_usd_micros").notNull().default(0),
    collectedAt: text("collected_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("byok_ai_answer_run_prompt_provider_idx").on(
      t.runId,
      t.promptId,
      t.provider,
    ),
    index("byok_ai_answer_prompt_idx").on(t.promptId),
  ],
);

const answerId = () =>
  text("answer_id")
    .notNull()
    .references(() => byokAiAnswers.id, { onDelete: "cascade" });

export const byokAiSources = pgTable(
  "byok_ai_source",
  {
    id: text("id").primaryKey(),
    answerId: answerId(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    title: text("title"),
    position: integer("position").notNull(),
    category: text("category", { enum: CITATION_CATEGORIES }).notNull(),
    pageType: text("page_type", { enum: CITATION_PAGE_TYPES }).notNull(),
    categoriesVersion: text("categories_version").notNull(),
  },
  (t) => [index("byok_ai_source_answer_idx").on(t.answerId)],
);

// Same columns as upstream ai_matches.
export const byokAiMatches = pgTable(
  "byok_ai_match",
  {
    id: text("id").primaryKey(),
    answerId: answerId(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    own: boolean("own").notNull(),
    mentioned: boolean("mentioned").notNull(),
    cited: boolean("cited").notNull(),
    firstMention: integer("first_mention"),
  },
  (t) => [
    uniqueIndex("byok_ai_match_answer_domain_idx").on(t.answerId, t.domain),
  ],
);

// Query fan-out, one row per web query in provider order.
export const aiWebQueries = pgTable(
  "ai_web_query",
  {
    id: text("id").primaryKey(),
    answerId: answerId(),
    position: integer("position").notNull(),
    query: text("query").notNull(),
    normalized: text("normalized").notNull(),
    isFanout: boolean("is_fanout").notNull(),
  },
  (t) => [
    uniqueIndex("ai_web_query_answer_position_idx").on(t.answerId, t.position),
    index("ai_web_query_normalized_idx").on(t.normalized),
  ],
);

// Categories for upstream (DataForSEO) sources, computed by the fork.
export const aiSourceCategories = pgTable("ai_source_category", {
  sourceId: text("source_id")
    .primaryKey()
    .references(() => aiSources.id, { onDelete: "cascade" }),
  category: text("category", { enum: CITATION_CATEGORIES }).notNull(),
  pageType: text("page_type", { enum: CITATION_PAGE_TYPES }).notNull(),
  categoriesVersion: text("categories_version").notNull(),
});
