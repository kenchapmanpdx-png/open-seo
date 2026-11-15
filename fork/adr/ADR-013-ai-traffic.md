# ADR-013: AI traffic — Canonry rules + Vercel drain receiver

- Status: accepted (design); build in B6 (`fork/queue.md` WO-B6-01x), review in B7
- Date: 2026-11-14 · Batch: B5 R3 · Batch table row "012" (renumbered: ADR-012 is exports)
- Sources read: `Canonry/canonry` @ `4b91e077` (MIT, © 2026 Arber X and contributors), packages `integration-traffic`, `integration-vercel`, `contracts/src/traffic.ts`, `contracts/src/ai-engines.ts`

## Context

- Handbook §18 (verified-bot log check, vendor IP files), §27 (AI referral tracking) and P11 (+4/+12-week outcome record) need request-level evidence: which AI crawlers fetch which pages, and which visits arrive from AI answer surfaces. Ken's client sites run on Vercel.
- Canonry splits the problem cleanly:
  - `integration-traffic/src/rules.ts` — data only: `SELF_TRAFFIC_USER_AGENT_PATTERNS`, `DEFAULT_AI_CRAWLER_RULES` (id, operator, product, purpose `training | search | user-agent | …`, UA regexes, documented full UAs, `browser`), `DEFAULT_AI_REFERRER_RULES` (domain → operator/product).
  - `classifier.ts` — `isSelfTraffic`, `classifyCrawler`, `classifyAiUserFetch`, `classifyAiReferral` (referer host or `utm_source`), over a `NormalizedTrafficRequest`.
  - `ip-verify.ts` + `ip-ranges/*.json` — verifies a claimed bot against the operator's published IP list (`verified | claimed_unverified | unknown_ai_like`).
  - `rollup.ts`, `journey.ts`, `agent-trust.ts`, `browser-agents.ts`, `scanner-bursts.ts`, `unlisted-agents.ts` — reporting layers on top.
  - `integration-vercel` is a **pull** client of `GET https://vercel.com/api/logs/request-logs` (the endpoint the `vercel` CLI rides; undocumented), with retention probing and adaptive sub-windows. Its rows carry no client IP (`remoteIp: null`), so pulled bot hits can never be IP-verified.
- Vercel log drains **push** request logs (JSON, one object per request, `proxy.clientIp`, `proxy.userAgent[]`, `proxy.referer`, `proxy.path`, `proxy.statusCode`, `source`) to an HTTPS endpoint, signed with `x-vercel-signature` = HMAC-SHA1(raw body, drain secret). Drains need a Pro team (build-plan Costs: the reports project already needs Pro).
- ADR-011: the app runs on Ken's computer and is not reachable from outside; only Vercel Functions are always on.

## Decision

### 1. Ingestion = Vercel log drain → Vercel Function → Supabase

- Receiver: one Vercel Function project at `fork/vercel/receiver/` (`api/drain.ts`, Node runtime, no framework). Deployed with `VERCEL_TOKEN` to Ken's Pro team, separate project from `fork/vercel/reports/` (separate env, separate secret).
- Per request:
  1. Body ≤ 4 MB, else 413. Read raw bytes.
  2. Verify `x-vercel-signature` = hex HMAC-SHA1(raw body, `DRAIN_SECRET`) with a constant-time compare; mismatch → 403, nothing parsed. The verification handshake Vercel performs when the drain is created is answered with the `x-vercel-verify` header from `DRAIN_VERIFY_TOKEN` (exact handshake re-checked against Vercel docs when built; record the doc date in the WO note).
  3. Parse JSON array or NDJSON with the K9 `vercelDrainEntrySchema` (loose: unknown fields ignored). Keep only `source ∈ {static, lambda, edge, external, redirect}` entries with a `proxy` object; drop build/firewall/console lines.
  4. Map to K9 `trafficEvent` (`normalizeVercelDrainEntry`: same field mapping as Canonry `normalize.ts`, plus `remoteIp` from `proxy.clientIp`).
  5. **Pre-filter at the edge**: keep an event only if its UA contains a `DEFAULT_AI_CRAWLER_USER_AGENT_SUBSTRINGS` token or its referer / `utm_source` matches an AI referrer rule. Everything else is counted (per site, per hour, `human_or_other`) and discarded. Raw human traffic never leaves Vercel; this also keeps Supabase rows small.
  6. Insert kept events with `ON CONFLICT DO NOTHING` — no conflict target: a target needs SELECT on its columns, which `traffic_ingest` does not have; the unique (`site_id`,`event_id`) index still makes drain retries idempotent (B5 R4a, verified on Postgres 17). Upsert the hourly discard counter.
- The receiver connects to Supabase with its own Postgres role `traffic_ingest` (SELECT on `ai_traffic_site` + `ai_traffic_site_host` to resolve the site, INSERT on `ai_traffic_event`, SELECT/INSERT/UPDATE on `ai_traffic_discard` (SELECT needed by the upsert), USAGE on schema; nothing else). Connection string lives only in the receiver project's Vercel env (`TRAFFIC_INGEST_DB_URL`, Supabase transaction pooler). RLS stays on (`supabase-harden.sql`); the role gets an explicit insert policy.
- Which site an event belongs to: `ai_traffic_site` maps a Vercel `projectId` (+ optional host list) to an OpenSEO `project_id`. Unknown `projectId` → dropped and counted in a discard row with `site_id` NULL (so a mis-wired drain is visible).
- Classification happens in the app, not in the receiver: the receiver only filters and stores evidence. Rules can change and re-run over stored rows (`reclassify`).

### 2. Classification = Canonry port (MIT header kept)

| Canonry source                                                                            | Fork target                                                 | Change                                                                                   |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `integration-traffic/src/rules.ts`                                                        | `src/server/features/ai-traffic/rules.ts`                   | Copy verbatim + MIT header; `AI_ENGINE_DOMAINS` inlined (only the referrer rows use it). |
| `integration-traffic/src/classifier.ts`                                                   | `src/server/features/ai-traffic/classifier.ts`              | Imports re-pointed to K9; `hostMatchesDomain`/`hostOf` copied into the same file.        |
| `integration-traffic/src/ip-verify.ts`, `ip-range-manifest.ts`, `ip-ranges/*.json`        | `src/server/features/ai-traffic/ip-verify.ts`, `ip-ranges/` | Copy; manifests refreshed by a fork script ported from `scripts/refresh-ip-ranges.ts`.   |
| `integration-traffic/src/agent-trust.ts`, `browser-agents.ts`                             | same folder                                                 | Copy (needed by `classifyAiUserFetch`).                                                  |
| `rollup.ts`, `journey.ts`, `scanner-bursts.ts`, `unlisted-agents.ts`, `agent-journeys.ts` | —                                                           | Not ported in v1 (see Alternatives). Daily rollup below is ours.                         |
| `integration-vercel/src/normalize.ts`                                                     | `fork/vercel/receiver/lib/normalize.ts` (drain shape)       | Rewritten for the drain payload; Canonry's pull-row mapping is the reference.            |
| `integration-vercel/src/{client,drain}.ts`                                                | —                                                           | Not ported (pull path rejected, below).                                                  |

- Self-traffic exclusion: Canonry's `SELF_TRAFFIC_USER_AGENT_PATTERNS` **plus** the fork's own UAs: the handbook collector UA (`HANDBOOK_USER_AGENT` in the collectors), the sidecar render UA, the upstream site-audit crawler UA and the `cron-tick.sh` curl UA. One exported list `FORK_SELF_UA_PATTERNS` in `ai-traffic/rules.ts` (below the Canonry block, clearly marked as fork code). Self events are dropped at classification (never at the receiver, so the audit's own bot fetches remain inspectable as raw rows for 7 days).
- Verification status is stored per event; reports and handbook evidence count only `verified` hits as "genuine" (§18 verified-bot log check). `claimed_unverified` is shown, labelled.

### 3. Storage + rollups (both dialects; ADR-002 conventions)

| Table                | Columns (abridged)                                                                                                                                                                                                 | Written by         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `ai_traffic_site`    | `id`, `project_id` → projects (cascade), `organization_id`, `vercel_project_id` (unique), `hosts` (child table `ai_traffic_site_host`), `created_at`                                                               | app                |
| `ai_traffic_event`   | `id`, `site_id` → site (cascade), `event_id`, `observed_at`, `method`, `host`, `path`, `query_string`, `status`, `user_agent`, `remote_ip`, `referer`, `source_type='vercel-drain'`; unique (`site_id`,`event_id`) | receiver           |
| `ai_traffic_class`   | `event_id` → event (cascade, PK), `kind` (`crawler`, `user_fetch`, `referral`, `self`, `none`), `rule_id`, `operator`, `product`, `purpose`, `verification`, `evidence_type`, `rules_version`                      | app (classify job) |
| `ai_traffic_daily`   | PK (`site_id`, `day`, `kind`, `rule_id`, `verification`), `hits`, `distinct_paths`                                                                                                                                 | app (rollup job)   |
| `ai_traffic_discard` | PK (`vercel_project_id`, `hour`), `site_id` → site (nullable: unknown project), `count`                                                                                                                            | receiver           |

- Path-level rollup is a query over `ai_traffic_event` ⋈ `ai_traffic_class` within retention, not a table.
- Retention: raw events 90 days (enough for +12-week outcome records), daily rollups forever. Deletion in the existing daily cron (`17 3 * * *` tick, ADR-011).
- Jobs run on the 5-minute cron tick (ADR-011): classify unclassified events (batch 5 000), then upsert today's/yesterday's daily rollup rows. Computer off → events wait in Supabase; next tick catches up. Nothing is lost while the computer is off — the reason for push over pull.
- SQLite deployments have the tables (dual-dialect rule) but no receiver; the feature shows "needs a Postgres/Supabase deployment" when `DATABASE_PROVIDER !== 'postgres'`.

### 4. Surface

- App: project page tab "AI traffic" (crawler hits by operator/purpose/verification, user fetches, AI referrals by product, top paths, discard counts). Server functions → service → repository (AGENTS default).
- Handbook: a DATA-class evidence source for the §18 verified-bot check and §27 AI referral tracking items (status stays DEFERRED until data exists — never FAIL for "no hits yet", per §18). Not used in REVIEW mode (EP-7).
- MCP: one read tool `ai_traffic_summary` (project-scoped, `withMcpProjectAuth`), B6.

### 5. Contract

K9 in `src/server/features/ai-traffic/contracts.ts`: `vercelDrainEntrySchema`, `trafficEventSchema` (= Canonry `normalizedTrafficRequestSchema` subset), `trafficClassSchema`, `TRAFFIC_CLASS_KINDS`, `aiTrafficSummarySchema` (MCP/UI output). CONTRACTS_VERSION 1.4.0.

## Alternatives

| Option                                                      | Why not                                                                                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonry pull client (`request-logs` API) from Ken's machine | Undocumented internal endpoint; rows have no client IP, so no IP verification (§18 needs vendor-IP proof); gaps when the computer is off longer than Vercel's log retention. |
| Store all requests (no edge pre-filter)                     | Human visitor IPs/UAs in Supabase = personal data with no purpose; 10–100× rows. Hourly discard counts keep the denominator.                                                 |
| Classify in the receiver                                    | Rules change (new bots monthly); stored raw evidence + `rules_version` allows re-classification. Receiver stays tiny and stateless.                                          |
| Port Canonry journeys/scanner bursts now                    | Valuable but not needed for the P3 exit ("bot hits by operator/purpose on one live site"). Revisit in B7 with real data.                                                     |
| Cloudflare Worker receiver                                  | Not in the chosen stack (ADR-011: Vercel for always-on receivers).                                                                                                           |

## Consequences

- New always-on component with a DB credential outside Ken's machine: least-privilege role, insert-only, constant-time signature check, no read path. Rotating `DRAIN_SECRET` = update drain + receiver env together.
- Drain cost and Pro requirement: BLOCKED-KEN if the client site is not on a Pro team.
- `ip-ranges/*.json` go stale; the refresh script runs weekly in the M1 loop (BLUEPRINT §9).

## Verification (B6/B7)

- Receiver: unit tests for signature (good/bad/missing), size cap, NDJSON + array parse, pre-filter, idempotent insert (fixture payload under `fork/fixtures/traffic/vercel-drain-sample.json`, synthetic).
- Classifier: Canonry's own test cases ported for the copied functions (rules regressions), plus one self-traffic test per fork UA.
- Live: one Vercel site with drain → `ai_traffic_daily` rows by operator/purpose (P3 exit). No live site → BLOCKED-KEN, verified on fixtures.

## Amendments (B5 R4a, schema)

- `ai_traffic_daily` key columns `rule_id` and `verification` are NOT NULL with `''` for "none" (a nullable column cannot sit in a composite PK on Postgres, and upserts need the PK).
- `ai_traffic_event` gains `received_at`; `ai_traffic_class` gains `classified_at`.
- `traffic_ingest` (in `fork/scripts/supabase-harden.sql`) is created NOLOGIN; the receiver WO enables login with a generated password written only to the receiver's Vercel env. Verified on Postgres 17: site lookup + event insert + discard upsert allowed; event read/update/delete, class, projects, handbook tables and site update denied.
