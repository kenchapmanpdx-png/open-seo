# ADR-002: Handbook data model

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- BLUEPRINT §3.4 lists 11 tables. Review invariants (`docs/maintainers/review-guidelines.md`): normalized rows, SQLite + Postgres parity (`src/db/*.schema.ts` + `src/db/pg/*.schema.ts`, `schema-parity.test.ts`), tenant scoping on every caller-keyed read, deterministic ids / conflict-safe upserts for retryable Workflow writes.
- Upstream timestamps are `text` with `current_timestamp` defaults in SQLite (`src/db/audit.schema.ts`); the pg schema mirrors them.
- A per-project on/off flag is needed (ADR-001) and no upstream table may be edited.

## Decision

- New files `src/db/handbook.schema.ts` and `src/db/pg/handbook.schema.ts`, exported from both `schema.ts` barrels (one export line each = registration hook, logged).
- Tables (all ids `text`; FK cascade from `projects` / `handbook_run`):

| Table                      | Columns (beyond §3.4)                                                                                      | Keys / indexes                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `handbook_project_setting` | project_id PK, enabled bool, mode (`AUDIT`\|`REVIEW`\|`BUILD`\|`MAINTAIN`), tier_override null, updated_at | PK project_id                                              |
| `handbook_run`             | §3.4 + `organization_id`, `error_code`, `grade`                                                            | idx (project_id, started_at); audit_id nullable (CLI runs) |
| `handbook_site_profile`    | run_id, sp_code, value, evidence, confidence (`high`\|`medium`\|`low`)                                     | PK (run_id, sp_code)                                       |
| `handbook_template`        | id, run_id, template_key, url_pattern, skeleton_hash, page_count                                           | unique (run_id, template_key)                              |
| `handbook_template_sample` | template_id, url, rank (1–3), reason (`first`\|`median`\|`largest`)                                        | PK (template_id, rank)                                     |
| `handbook_page_snapshot`   | §3.4 + `final_url`, `content_type`, `fetched_at`                                                           | unique (run_id, url)                                       |
| `handbook_item_status`     | run_id, item_id, status, score, note, severity null                                                        | PK (run_id, item_id)                                       |
| `handbook_finding`         | §3.4 + `phase`, `section_ref`, `fix`, `limited_reason` null                                                | unique (run_id, code)                                      |
| `handbook_finding_item`    | finding_id, item_id                                                                                        | PK (finding_id, item_id)                                   |
| `handbook_finding_url`     | finding_id, url                                                                                            | PK (finding_id, url) — URL lists are relational, not JSON  |
| `handbook_evidence`        | §3.4 + `byte_size`, `content_type`                                                                         | idx (run_id, item_id), idx finding_id                      |
| `handbook_bot_fetch`       | §3.4 + `final_url`, `words`, `blocked_reason` null                                                         | unique (run_id, url, bot)                                  |
| `handbook_llm_call`        | §3.4 + `verdict`, `quotes_verified` bool, `created_at`                                                     | idx run_id                                                 |

- Deterministic ids for workflow writes: `sha256(run_id + natural key)` truncated to 26 chars, so replays upsert instead of duplicating.
- Item ids reference the registry (`registry.json`), not a DB table: the registry is versioned code, and `handbook_run.handbook_version` pins it.
- Tenant scoping: repositories take `projectId` and join `handbook_run.project_id`; MCP/server functions authorize the project first (`requireProjectContext`, `withMcpProjectAuth`).

## Alternatives

| Option                                       | Why not                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Findings + statuses as one JSON blob per run | Violates normalized-data invariant; no per-item queries across runs.                                          |
| Registry table in DB                         | Duplicates versioned source; drift risk; registry test already guards it.                                     |
| Reuse upstream `audit_issues`                | Different severity scale (S1–S4 vs critical/warning/info), no item linkage; would need upstream schema edits. |

## Consequences

- Migrations generated with `pnpm db:generate` for both dialects in R4; `fork/scripts/supabase-harden.sql` re-run after migration.
- `handbook_finding_url` added beyond §3.4 to keep URL lists relational.

## Verification

- `schema-parity.test.ts` green; `sqliteMigrations.test.ts` green; repository tests through services with real SQL evaluation.
