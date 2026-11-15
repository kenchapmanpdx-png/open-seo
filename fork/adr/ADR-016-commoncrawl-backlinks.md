# ADR-016: Common Crawl backlink baseline (local DuckDB job)

- Status: accepted (design); build in B6, review in B7
- Date: 2026-11-14 · Batch: B5 R3 · Batch table row "015"
- Sources read: `Canonry/canonry` @ `4b91e077` (MIT), `packages/integration-commoncrawl/src/*`; upstream `src/db/app.schema.ts` (`backlink_snapshots`), `src/server/features/backlinks/**`

## Context

- P6 exit: "backlink overview without a DataForSEO call". Upstream backlinks are DataForSEO-only; `backlink_snapshots` stores per-project domain totals (rank, backlinks, referring domains, new/lost) from DataForSEO.
- Common Crawl publishes a **domain-level hyperlink graph** per rolling 3-month release (`cc-main-YYYY-mon-mon-mon`): `…/domain/<release>-domain-vertices.txt.gz` (`id \t rev_domain \t num_hosts`) and `…-domain-edges.txt.gz` (`from_id \t to_id`). Multi-GB downloads (vertices + edges ≈ 15–20 GB gz per release, SPECULATIVE until the first download is measured).
- Canonry `integration-commoncrawl`: release-id parsing/compare, `probeLatestRelease` (HEAD probes), resumable `downloadFile`, local cache + prune, DuckDB loaded as an optional plugin (`@duckdb/node-api`), and `queryBacklinks({ vertexPath, edgesPath, targets, limitPerTarget })` = one SQL over the gz TSVs returning `{ targetDomain, linkingDomain, numHosts }`.
- ADR-011: heavy jobs run on Ken's computer (951 GB free on the WSL disk), results go to Supabase. Workers/Cloudflare cannot run DuckDB over 20 GB files → Cloudflare = N/A.
- Domain-level only: no URLs, no anchors, no follow/nofollow, no first-seen dates. It is a **baseline** (who links to the domain at all), not a replacement for DataForSEO's link-level data.

## Decision

### 1. Local Node job, not app code

- `fork/scripts/commoncrawl-backlinks.ts` (run with `pnpm tsx`), on Ken's machine:
  1. `probeLatestRelease()`; skip if that release is already imported (`cc_release.status = 'imported'`).
  2. Download vertices + edges to `~/.cache/openseo/commoncrawl/<release>/` (resumable; `CC_CACHE_DIR` override); keep only the latest two releases (`pruneCachedRelease`).
  3. Targets = the primary domain of every project with Common Crawl enabled (`cc_target` rows) + their tracked competitor domains (upstream AI visibility brands with `own = false`, if any). Registrable domain (eTLD+1) only; no subdomains in the domain graph.
  4. One `queryBacklinks` call for all targets (`limitPerTarget` 5 000, ordered by `num_hosts` desc — larger linking domains first).
  5. Write to Supabase in one transaction per target: `cc_backlink_domain` rows (replace for that release) + one `cc_backlink_summary` row.
- Schedule: monthly systemd user timer (`Persistent=true`, ADR-011 pattern) on the 5th; manual `--release <id>` and `--target <domain>` flags. It is a fork CLI (like `fork/scripts/handbook-audit.ts`), so `@duckdb/node-api` is a **devDependency of the fork script path only** — not imported by the app bundle (workerd cannot load native modules).
- Dependency: add `@duckdb/node-api` (pinned, Canonry's version `1.5.6-r.2` or newer patch) as a root devDependency; logged in UPSTREAM-EDITS (`package.json`, `pnpm-lock.yaml`). Rejected Canonry's "install plugin at runtime into ~/.canonry" path: needless indirection for a single-machine CLI.

### 2. Port map (MIT header kept in each file)

| Canonry source                                      | Fork target                                                      | Change                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/reverse-domain.ts`, `src/release-id.ts`        | `src/server/features/backlinks/providers/commoncrawl/release.ts` | Merge into one file (pure, app-safe: used by the UI to show the release window). |
| `src/release-discovery.ts`, `src/constants.ts`      | `fork/scripts/lib/commoncrawl/release-discovery.ts`              | Drop plugin constants; `CC_CACHE_DIR` default `~/.cache/openseo/commoncrawl`.    |
| `src/downloader.ts`, `src/cache.ts`                 | `fork/scripts/lib/commoncrawl/{download,cache}.ts`               | Copy.                                                                            |
| `src/duckdb-query.ts`                               | `fork/scripts/lib/commoncrawl/query.ts`                          | Import `@duckdb/node-api` directly (no `unknown` plugin cast).                   |
| `src/plugin-installer.ts`, `src/plugin-resolver.ts` | —                                                                | Not ported (see above).                                                          |

### 3. Storage (both dialects)

| Table                 | Columns (abridged)                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `cc_release`          | `id` (release slug, PK), `window` (display), `status` (`downloading`/`imported`/`failed`), `imported_at`, `bytes`                     |
| `cc_target`           | `id`, `project_id` → projects (cascade), `organization_id`, `domain`, `enabled`; unique (`project_id`, `domain`)                      |
| `cc_backlink_summary` | `id`, `target_id` → target (cascade), `release_id` → cc_release, `referring_domains`, `referring_hosts_sum`; unique (target, release) |
| `cc_backlink_domain`  | `id`, `summary_id` → summary (cascade), `linking_domain`, `num_hosts`; index (summary, num_hosts desc)                                |

- Retention: last 4 releases per target (one year of quarters, enough for trend); older summary rows kept, domain rows deleted.
- Upstream `backlink_snapshots` is **not** written: its columns (rank, backlinks, new/lost) are DataForSEO semantics; filling them from a domain graph would mislead the upstream UI.

### 4. Surface

- Backlinks area: a fork card "Common Crawl baseline" on the project (referring domains this release vs previous, new/lost linking domains by set difference, top linking domains by `num_hosts`, competitor gap = domains linking to competitors but not to the project). Server fn → service → repository.
- MCP read tool `cc_backlinks_get` (project-scoped), B6.
- Never used in REVIEW mode (EP-7: no backlink data).

### 5. Contract

K12 in `src/server/features/backlinks/providers/commoncrawl/contracts.ts`: `ccReleaseIdSchema` (Canonry regex), `ccBacklinkRowSchema` (`targetDomain`, `linkingDomain`, `numHosts`), `ccBacklinkSummarySchema`. CONTRACTS_VERSION 1.4.0.

## Alternatives

| Option                                 | Why not                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Run DuckDB inside the app (workerd)    | Native module; 20 GB inputs; the app process must stay responsive.      |
| Common Crawl host-level graph          | ~10× larger; domain level answers "who links to us" for the baseline.   |
| Write into `backlink_snapshots`        | Semantics mismatch (above) and an upstream table used by upstream code. |
| CC index (CDX) per-URL link extraction | Needs WARC parsing at scale; out of scope for a free baseline.          |

## Consequences

- First run downloads tens of GB (hours on a home line); the job is resumable and idempotent per release.
- Data lags (3-month windows, published later); UI labels the release window.
- Machine off on the 5th → timer catches up (`Persistent=true`).

## Verification (B6/B7)

- Unit tests: release-id parse/compare, reverse domain, summary/new/lost set logic.
- Query test on a tiny synthetic vertices/edges pair (≤ 10 rows, gz) under `fork/fixtures/commoncrawl/` — runs only in the fork script test (DuckDB native).
- Live: one real release for one project (P6 exit). Long download = expected, not BLOCKED.

## Amendments (B5 R4a, schema)

- `cc_release.window` is `window_label` (WINDOW is reserved in Postgres). `cc_release.bytes` is `bigint` on Postgres (release files exceed 2 GB). `cc_backlink_domain` is also unique on (`summary_id`, `linking_domain`).
