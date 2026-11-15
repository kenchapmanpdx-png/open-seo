# ADR-014: Bing Webmaster Tools + Bing AI Performance

- Status: accepted (design); build in B6, review in B7
- Date: 2026-11-14 · Batch: B5 R3 · Batch table row "013"
- Sources read: `Canonry/canonry` @ `4b91e077` (MIT), `packages/integration-bing/{src,AGENTS.md}`, `docs/bing-webmaster-setup.md`

## Context

- Handbook §26 (GSC + Bing + IndexNow setup) and P10/P11 want Bing verification state, crawl issues, index coverage and query/page performance; P11 also wants the AI Performance report (Copilot citations, grounding queries).
- Canonry `integration-bing/src/bing-client.ts` wraps the BWT JSON API (`https://ssl.bing.com/webmaster/api.svc/json/<Method>?apikey=…`): sites, URL info, crawl stats/issues, rank-and-traffic, query/page stats (weekly buckets), feeds, quotas, blocked URLs, link counts, keyword research. Retry + per-account throttle cooldown live only in the client (Canonry AGENTS: callers must not add a second retry layer). Shapes come from captured responses; quirks documented (`/Date(ms)/` dates, `AvgClickPosition = -1`, `QueryStats.Query` holds the page URL for page stats, quota = remaining).
- **AI Performance is not in the API.** Canonry probed 68 plausible method names; none exist. The BWT UI offers a CSV export of the report.
- Upstream already has `indexnow` (submit) and Google OAuth integrations; there is no Bing integration.
- Auth: BWT API key (account-level, from BWT settings). Preflight OPT row `BING_WEBMASTER_API_KEY` (currently missing → BLOCKED-KEN for live calls).

## Decision

### 1. API client = Canonry port

| Canonry source                          | Fork target                              | Change                                                                                                                                  |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `integration-bing/src/bing-client.ts`   | `src/server/features/bing/bingClient.ts` | MIT header. Port only the methods in the table below. Keep `withRetry`, throttle cooldown (keyed by key digest), key redaction in logs. |
| `integration-bing/src/types.ts`         | `src/server/features/bing/bingTypes.ts`  | Port the types the kept methods use.                                                                                                    |
| `integration-bing/src/constants.ts`     | folded into `bingClient.ts`              | —                                                                                                                                       |
| `integration-bing/test/fixtures/*.json` | `src/server/features/bing/__fixtures__/` | The fixtures for kept methods (already anonymised upstream). Tests run on them; no live call in CI.                                     |

Kept methods (v1): `getSites`, `getUrlInfo`, `getCrawlStats`, `getCrawlIssues`, `getRankAndTrafficStats`, `getQueryStats`, `getPageStats`, `getUrlSubmissionQuota`, `getBlockedUrls`, `getFeeds`; helpers `parseBingDate`, `bingDateToDay`, `bingPositionOrNull`, `isBlockingCrawlIssue`. Write methods (`submitUrl*`, `addSite`, `submitFeed`) are **not** ported: URL submission already goes through upstream IndexNow; adding sites stays a human step in BWT.

- Key storage: one key per organization in `bing_credential`, encrypted at rest with the helper upstream uses for Google OAuth tokens (`tokenCrypto()` in `src/server/features/google/googleOAuth.ts`, Better Auth secret; reuse, do not invent — export it from a leaf module if needed, logged in UPSTREAM-EDITS). Env `BING_WEBMASTER_API_KEY` is the fallback for the single-tenant local deployment. Key never returned to the client, never logged (Canonry redaction kept).
- Site binding: `bing_site` (project_id → projects, `site_url` exactly as BWT lists it, `verified` from `getSites`). Bind by picking from `getSites` (no free text).

### 2. Sync

- Daily on the `17 3 * * *` tick (ADR-011), per bound site: crawl stats, crawl issues, rank-and-traffic (daily), query stats + page stats (weekly buckets), quota, blocked URLs, feeds. Upsert by natural key (site, day | week, query/page). Throttled → stop the site for today (no second retry layer), record `last_error`.
- Tables (both dialects): `bing_site`, `bing_daily_traffic` (site, day, impressions, clicks), `bing_query_week` (site, week_start, query, impressions, clicks, avg_impression_position, avg_click_position nullable), `bing_page_week` (same keyed by page), `bing_crawl_issue` (site, url, issue_type, http_code, first_seen, last_seen), `bing_sync_state` (site, last_success_at, last_error).

### 3. AI Performance = CSV import

- The user exports the AI Performance report CSV(s) from the BWT UI and uploads them on the Bing tab (or `fork/scripts/bing-ai-import.ts <projectId> <file.csv>` for headless use).
- Parser: header-driven, Zod-validated (`bingAiPerformanceRowSchema`, K10); unknown columns kept in a `extra` map only for the import log, not stored. Known report columns (as of 2026-11: date, citations, cited pages, grounding queries; exact header names confirmed on the first real export — fixture added then) map to `bing_ai_citation_day` (site, day, citations, cited_pages) and `bing_ai_grounding_query` (site, period_start, period_end, query, citations). Rows are upserted, so re-importing an overlapping export is idempotent.
- Every import stores the original file in Supabase Storage (private bucket, evidence store, ADR-003) and an `bing_ai_import` row (who, when, file hash, row counts) — evidence rule.
- If Microsoft ships an API method later, it replaces the import behind the same tables.

### 4. Surface

- Project tab "Bing" (verification, crawl issues table, traffic chart, top queries/pages, AI citations + grounding queries). MCP read tool `bing_summary` (B6).
- Handbook: DATA evidence for §26 Bing setup items (site verified in BWT, sitemap submitted = `getFeeds`, crawl blocking issues = `isBlockingCrawlIssue`). Never in REVIEW mode (EP-7).

### 5. Contract

K10 in `src/server/features/bing/contracts.ts`: `bingSiteBindingSchema`, `bingAiPerformanceRowSchema`, `bingSummarySchema`. CONTRACTS_VERSION 1.4.0.

## Alternatives

| Option                               | Why not                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Scrape the BWT UI for AI Performance | Automating a logged-in consumer UI with a personal account (FORK.md never-list spirit); fragile. |
| Port the whole Bing client           | Write methods duplicate IndexNow; keyword research overlaps DataForSEO. Smaller surface.         |
| OAuth instead of API key             | BWT OAuth needs an app registration; the API key is what BWT offers site owners directly.        |

## Consequences

- AI Performance data is only as fresh as the last manual export; the tab shows "last imported" prominently.
- Bing's account-level throttle can outlast a run (Canonry measured > 1 h): sync is best-effort daily.

## Verification (B6/B7)

- Client tests on the ported fixtures (date parsing, -1 positions, page-stat quirk, throttle cooldown).
- CSV import test with a synthetic export; idempotent re-import.
- Live: BLOCKED-KEN until `BING_WEBMASTER_API_KEY` exists and one site is verified in BWT.

## Amendments (B5 R4a, schema)

- `bing_credential` (`organization_id` PK, `encrypted_api_key`) holds the per-organization key.
- `bing_ai_import` columns: `site_id`, `imported_by`, `file_hash` (unique per site: re-importing the same file is a no-op), `evidence_path`, `rows_read`, `rows_upserted`, `imported_at`. `bing_ai_grounding_query` PK is named `bing_ai_grounding_query_pk` (the generated name exceeds Postgres' 63-byte limit).
- Key encryption (B5 R4b): upstream `tokenCrypto()` is not exported and skips encryption when `encryptOAuthTokens` is off. The fork uses its own helper (`handbook/secrets/keyCrypto.ts`, WO-B6-001) with the same `better-auth/crypto` primitives and the Better Auth secret, always encrypting. No upstream edit.
