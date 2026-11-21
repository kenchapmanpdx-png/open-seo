# DEPENDABILITY — B13 spec (dependability)

Spec for batch B13 (`fork/batches/B13-heavy-dependability.md`). Approved by Ken 2026-11-20 02:02 MST: every `A#` in §5 is a `[Ken]` decision.
Source: blueprint v3 (2026-11-20 01:45), Claude project docs `claude/seo-geo-app-dependability-blueprint-v3-2026-11-20-0145-part-1-of-2.md` / `-part-2-of-2.md`. Repo state when written: `ken/main` @ `363194f`, STATE `done / MAINT`.
[Ken 2026-11-20] Order after B13: B14 novice layout (`fork/NOVICE-UI.md`), then B15 accuracy (§9).
Legend: VERIFIED = read in code, dependency source, vendor docs or the live app. INFERRED = reasoned, not observed. `[v2]` / `[v3]` = changed in that blueprint version.

## 1. Goal and done criteria

Goal: audits finish and report truthfully without Ken restarting anything, exporting tokens, or watching.

| #   | Done when (B13 exit)                                          | Measured by                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | No database lock-up                                           | `[v3]` 3 real audits back to back on one process (run-2→3 condition, gate G1) + exit overlap test: 0 `db_error`, 0 pool errors (P1) in the app log, app pages load during and 10 min after                       |
| D2  | In-app Handbook uses the browser helper (sidecar)             | Run page: no provisional banner; stages `render`, `axe`, `lighthouse` = `done`                                                                                                                                   |
| D3  | Site-audit result never waits on or fails because of Handbook | audit `completedAt` < Handbook `finishedAt`; Handbook failure leaves audit `completed`                                                                                                                           |
| D4  | Interrupted work recovers alone                               | `[v3]` App restarted mid-Handbook → run marked `interrupted` ≤ 15 min after the restart, lease free, re-run started in the same reconciler pass, graded run complete ≤ 40 min after the restart; no human action |
| D5  | Status is true                                                | Runs list count = findings rows; grade shown; every skipped check group names its cause; `[v3]` page-cap notes use the right cap (Handbook vs site audit)                                                        |
| D6  | Self-supervision                                              | Sidecar stopped / hung, app process killed → healthy ≤ 10 min, logged; `[v3]` database unreachable → no restart loop, red status + alert attempt; restart budget spent → red status + alert attempt              |
| D7  | Survives reboot                                               | After Windows sign-in: app + sidecar healthy ≤ 5 min, no window opened (needs K1, §11)                                                                                                                           |
| D8  | Regression guard                                              | In-app end-to-end test exists, used by every WO, runs weekly                                                                                                                                                     |
| D9  | `[v3]` Silent background failures surface                     | Status shows backup age, cron tick age, disk free, failed build; each has a warn threshold                                                                                                                       |

## 2. Evidence

| #   | Fact                                                                                                                                                                                                                                                                                                     | Source                                                                                                     | Status                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| E1  | App runtime = workerd (Miniflare 5), not Node: `run-local.sh prod` → `pnpm build` + `vite preview`                                                                                                                                                                                                       | `fork/scripts/run-local.sh`, `fork/deploy/openseo-app.service`                                             | VERIFIED                                                                     |
| E2  | One Postgres client per request and per workflow step (`max: 1`), never ended; upstream comment: not ending lets streamed responses keep querying                                                                                                                                                        | `src/db/pg/client.ts`, `src/server/workflows/pgStep.ts`                                                    | VERIFIED                                                                     |
| E3  | Handbook steps end their client (`hbStep` → `releasePgConnection`); upstream steps do not                                                                                                                                                                                                                | `src/server/features/handbook/workflow/hook.ts`                                                            | VERIFIED                                                                     |
| E4  | App connects to the Supabase **session** pooler (port 5432; preflight enforces it); pool 15                                                                                                                                                                                                              | `fork/scripts/preflight.sh`, `fork/RUNBOOK.md` line 117                                                    | VERIFIED                                                                     |
| E5  | Session mode: clients capped at pool size (15) per role + database. Transaction mode (port 6543, same host): connections shared, no prepared statements. `[v3]` Free (Nano) compute: 60 direct connections, 200 pooler clients (hard-coded); pool size is configurable                                   | Supabase docs (Supavisor FAQ; Connect to your database; max connections), Supabase GitHub discussion 22305 | VERIFIED (docs)                                                              |
| E6  | `[v3]` `src/db/pg/client.ts` is the only Postgres client in `src/`. Every Drizzle query goes through `client.unsafe()` (drizzle-orm 0.45.2 `postgres-js/session.js`); postgres.js 3.4.9 `unsafe` defaults `prepare: false` (unnamed statements); defaults `idle_timeout: null`, `max_lifetime` 30–60 min | grep of `src/`, package source                                                                             | VERIFIED                                                                     |
| E7  | No session-only SQL in `src/` (advisory locks, LISTEN/NOTIFY, `SET`, `search_path`, `statement_timeout`, temp tables, named prepares)                                                                                                                                                                    | grep of `src/`                                                                                             | VERIFIED (app code; libraries go through Drizzle → E6)                       |
| E8  | Driver options cannot arrive by URL or env in workerd (Hyperdrive rebuilds the URL; Worker build of postgres.js has empty `process.env`) → only an explicit option in `client.ts` works                                                                                                                  | workerd `hyperdrive.cpp`, postgres.js `cf/src`                                                             | VERIFIED                                                                     |
| E9  | Miniflare outbound allow-list = `["public", "private", "240.0.0.0/4"]` → fetch from the app to `127.0.0.1:4777` is permitted                                                                                                                                                                             | miniflare 5.20261012.0-beta source                                                                         | VERIFIED in source; runtime proof = first WO-007 E2E                         |
| E10 | In-app Handbook never passes a sidecar config: `prepareStage` calls `createDefaultCollectors({...})` with one argument; `HANDBOOK_SIDECAR_TOKEN` / `HANDBOOK_SIDECAR_URL` read nowhere in `src/`                                                                                                         | `services/HandbookRunService.ts:288`, grep                                                                 | VERIFIED                                                                     |
| E11 | In-app depth default = `full`, max pages 1000                                                                                                                                                                                                                                                            | `engine/depth.ts`                                                                                          | VERIFIED                                                                     |
| E12 | Handbook hook sits after Lighthouse, before `finalizeAudit`; `finalizeAudit` uses no Handbook output                                                                                                                                                                                                     | `src/server/workflows/siteAuditWorkflowPhases.ts:106–108`                                                  | VERIFIED                                                                     |
| E13 | `finishRun` never writes `scoreFinal / scoreUncapped / capReason / grade`; live app: both completed runs return `grade: null, scoreFinal: null, findingsCount: 0`                                                                                                                                        | `repositories/HandbookRepository.ts:100–148`; app query cache                                              | VERIFIED                                                                     |
| E14 | Lease: 2-h expiry, released in a `finally` step only → process death leaves it held                                                                                                                                                                                                                      | `hook.ts`, ADR-018                                                                                         | VERIFIED (code); effect INFERRED                                             |
| E15 | Upstream reconciler flips only `running` audits whose workflow instance is errored / terminated / missing                                                                                                                                                                                                | `features/audit/services/auditReconciler.ts`                                                               | VERIFIED                                                                     |
| E16 | No in-app end-to-end test exists: `ui-smoke.mjs` only loads pages; B9 in-app measurement was BLOCKED-KEN; goldens run through the CLI                                                                                                                                                                    | `fork/scripts/ui-smoke.mjs`, `fork/reports/B9.md`, `B12.md`                                                | VERIFIED                                                                     |
| E17 | Every app start rebuilds (`pnpm build` = widgets + vite build + `tsc`); output `dist/`                                                                                                                                                                                                                   | `run-local.sh` `prod)`, `package.json`, `.gitignore`                                                       | VERIFIED                                                                     |
| E18 | Agent allowlist contains `Bash(bash fork/scripts/run-local.sh:*)`; no `systemctl`, `journalctl`, `docker restart`, `ss`                                                                                                                                                                                  | `fork/claude-settings.suggested.json`                                                                      | VERIFIED (suggested file; Ken's `.claude/settings.local.json` assumed equal) |
| E19 | Sidecar container has `restart: unless-stopped`; `/health` needs no token; any other path returns 401 on a wrong token (`/token-check` = 404 when the token is right)                                                                                                                                    | `fork/sidecar/compose.yaml`, `server.ts`, `start-build.sh`                                                 | VERIFIED                                                                     |
| E20 | Sidecar once stopped making network requests after ~13 h while still "up" (B10); B12 added stall exit + recycle after 500 tasks                                                                                                                                                                          | `fork/reports/B10.md`, `B12.md`                                                                            | VERIFIED (reports)                                                           |
| E21 | Upstream Site Audit JS rendering calls a hard-coded `https://api.context.dev/...`                                                                                                                                                                                                                        | `src/server/lib/audit/rendered-page.ts:124`                                                                | VERIFIED                                                                     |
| E22 | Site audit workflow builds as a separate worker (`dist/open_seo_audit/`); the OpenRouter key reaches Handbook stages there (runs 3 and 4 recorded LLM spend)                                                                                                                                             | `vite.config.ts`, run data                                                                                 | VERIFIED; same path for `HANDBOOK_SIDECAR_TOKEN` INFERRED                    |
| E23 | `AuditService.startAudit` can be called without a browser request (precedent `DashboardFirstAuditService`); `self_hosted` tier: 10 000 pages per audit, no running-audit limit                                                                                                                           | `features/dashboard/services/DashboardFirstAuditService.ts`, `features/audit/services/audit-capacity.ts`   | VERIFIED                                                                     |
| E24 | `[v3]` Handbook is off by default: column default `false`, `getSettings` falls back to `false`                                                                                                                                                                                                           | `src/db/pg/handbook.schema.ts:37`, `hb/services/HandbookService.ts` `getSettings`                          | VERIFIED                                                                     |
| E25 | `[v3]` Drizzle strips table names from columns inside `sql` fields of single-table selects → `listRuns` subquery renders `"run_id" = "id"`, both resolved inside the subquery → always 0                                                                                                                 | drizzle-orm 0.45.2 `pg-core/dialect.js` `buildSelection` (`isSingleTable`)                                 | VERIFIED                                                                     |
| E26 | `[v3]` Unit outputs merge with `Object.assign` in stage / batch order (a later batch replaces an earlier one's keys); the run-time-cap skip stores "unavailable" for batch 0 and `{}` for later batches                                                                                                  | `hb/engine/stages.ts` `loadCollected`, `runStageUnit`, `capped`                                            | VERIFIED                                                                     |
| E27 | `[v3]` Handbook seeds from `audit_pages` rows with status 200, follows links, and caps at its own max pages (E11), not the audit's page limit. Runs 3 and 4: audit 155 pages, Handbook read 80                                                                                                           | `HandbookRepository.listCrawledUrls`, `prepareStage`; run rows                                             | VERIFIED (code + data)                                                       |
| E28 | `[v3]` `finalizeAudit` clears progress KV and crawl scratch state (frontier, links, mirror); `audit_pages` is deleted only with the audit                                                                                                                                                                | `siteAuditWorkflowPhases.ts` `finalize`, `AuditRepository`                                                 | VERIFIED                                                                     |
| E29 | `[v3]` Upstream ships `readWorkflowStatus` and `terminateStuckWorkflow`; its comment: a frozen step on the Docker edition stays "running" for good                                                                                                                                                       | `src/server/lib/startWorkflow.ts`                                                                          | VERIFIED                                                                     |
| E30 | `[v3]` KV binding `KV` has the same namespace id in `wrangler.jsonc` and `wrangler.audit.jsonc` (upstream crawl progress already shares it between workers)                                                                                                                                              | `wrangler.audit.jsonc`, `progress-kv.ts`                                                                   | VERIFIED                                                                     |
| E31 | `[v3]` Per-run LLM budget env `HANDBOOK_LLM_BUDGET_USD` (default cap $5)                                                                                                                                                                                                                                 | `hb/contracts/llm.ts`, `hb/llm/budget.ts`                                                                  | VERIFIED                                                                     |
| E32 | `[v3]` Existing timers: tick every 5 min, backup daily 03:30 (`pg_dump`, else Docker `postgres:17`), Common Crawl monthly on the 5th 04:00                                                                                                                                                               | `fork/deploy/*.timer`, `fork/scripts/backup.sh`                                                            | VERIFIED                                                                     |

## 3. What happened (salonvata.com, times UTC; MST = UTC−7)

| Run      | Audit start                                                                                 | Handbook start → finish                                 | Audit end | Result                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| 1 `[v3]` | —                                                                                           | off                                                     | —         | completed, 50 pages (upstream default limit)                                                             |
| 2        | 05:47:37                                                                                    | off (toggle not saved)                                  | 05:50:22  | completed, 155 pages, 2 min 45 s                                                                         |
| 3        | 06:00:34                                                                                    | 06:03:16 → 06:12:58, completed, 80/80 pages, LLM $0.220 | 06:25:31  | **failed, `errorCode: db_error`**, 12 min 33 s after Handbook finished = inside upstream `finalizeAudit` |
| —        | `[v3]` Ken saw app-wide errors ≈ 06:15 (23:15 MST, reported); app restarted by Ken 06:35:41 |                                                         |           |                                                                                                          |
| 4        | 06:43:56                                                                                    | 06:46:40 → 06:55:39, completed, 80/80 pages, LLM $0.223 | 06:55:41  | completed; finalize took 2 s; grade F 35.2 provisional                                                   |

- Crash class = database: VERIFIED (`db_error` on the run-3 audit row; app-wide errors until restart; run 4 on a fresh process finalised in 2 s). Not memory (process stayed up; no `oom`). Not Handbook code (it had completed; its errors are swallowed).
- Mechanism: INFERRED. Clients opened by upstream workflow steps and requests stay pinned to session-pooler slots after the work ends; back-to-back audits (run 2 at 05:47, run 3 at 06:00) plus UI polling on one long-lived process passed 15. Matches the RUNBOOK `EMAXCONNSESSION` precedent. WO-003 measures it; the plan does not depend on the mechanism being right (§6 D-A).
- `[v3]` The `mark-failed` write at 06:25:31 succeeded on a fresh client → exhaustion was intermittent, not total (session mode queues new clients up to ~1 min; slots free as old connections close). INFERRED. Consequence: detection must also read pool errors from the app log, not only "DB down 3 times in a row" (W2c).
- `[v2]` v1 said run-4 Handbook "completed ~11:47 PM"; actual 23:55:39 MST.
- Timing: in-app Handbook without render ≈ 9–10 min (80 pages). With render expect ≈ 18–22 min (CLI reference, bluetree run 65: render 282 s + axe 48 s + Lighthouse 151 s); whole audit ≈ 21–25 min. INFERRED.

## 4. Root causes and corrections

### 4.1 Root causes

| ID  | Problem                                                                                                                                                                                       | Status                                                          | Fixed by                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| R1  | In-app Handbook never uses the sidecar → every in-app grade provisional (E10)                                                                                                                 | VERIFIED                                                        | WO-007                                           |
| R2  | `[v2]` DB slots pinned: per-request / per-step clients on a 15-slot session pooler (E2–E5)                                                                                                    | class VERIFIED, mechanism INFERRED                              | WO-003, 004, 005                                 |
| R3  | `[v2]` Sidecar is not "manual" (auto-restarts; `start-build.sh` sets the token). Real gap: nothing checks it is up, token-matched, really rendering (E20), or that Docker Desktop is running  | VERIFIED                                                        | WO-012, 013                                      |
| R4  | `[v2]` Site-audit result is held behind Handbook (E12): hidden for the whole Handbook phase; a late failure fails the audit (run 3)                                                           | VERIFIED                                                        | WO-009                                           |
| R5  | Interrupted Handbook run: stuck `running`, lease held ≤ 2 h, nobody re-runs; `[v3]` a frozen workflow instance can stay "running" for good (E14, E15, E29)                                    | VERIFIED (code)                                                 | WO-010                                           |
| R6  | Status wrong or silent: list shows `0 findings / —` (E25), grade never saved (E13), banner gives no cause, Handbook off by default (E24); `[v3]` UI does not say which page cap applies (E27) | VERIFIED                                                        | WO-008, 014                                      |
| R7  | Default 50-page cap starved real Site Audit pages (run 1)                                                                                                                                     | VERIFIED (run 1)                                                | WO-014 (fork button; upstream crawler untouched) |
| R8  | Nothing watches app, sidecar, database, cron                                                                                                                                                  | VERIFIED                                                        | WO-011, 012, 013                                 |
| R9  | Depends on a live Windows session (WSL / Docker Desktop)                                                                                                                                      | INFERRED (not tested on Ken's PC)                               | WO-015 + K1                                      |
| R10 | `[v2]` No in-app end-to-end test (E16) → R1 and R6 shipped unnoticed                                                                                                                          | VERIFIED                                                        | WO-002, 016                                      |
| R11 | `[v2]` Every restart rebuilds (E17): minutes of downtime; a failed build = app down                                                                                                           | VERIFIED                                                        | WO-006                                           |
| R12 | `[v2]` Unattended agent cannot run ops commands (E18)                                                                                                                                         | VERIFIED                                                        | WO-001                                           |
| R13 | Accuracy has no ongoing check (no salonvata golden, no external-export loop)                                                                                                                  | VERIFIED                                                        | B15 (§9)                                         |
| R14 | `[v3]` Background jobs fail silently: nothing reports backup age, cron tick age, disk space, or a failed build                                                                                | VERIFIED (no reporter exists); failures themselves not observed | WO-001, 013                                      |

### 4.2 Version accounting (nothing dropped silently)

v1 → v2

| v1 item                                                      | v2                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2 text "local Node app"                                     | WRONG: runtime is workerd (E1)                                                                                                                                                                                                                     |
| WO-B13-001 process-wide Node pool, `idle_timeout` via config | REPLACED: sockets cannot be shared across requests in workerd; options not settable by URL/env (E8) → WO-004 + WO-005                                                                                                                              |
| WO-B13-002 sidecar wiring                                    | KEPT → WO-007; no `.env.local` edit (URL defaults to `SIDECAR_DEFAULT_URL`); probe also checks contracts version and token                                                                                                                         |
| WO-B13-003 systemd unit running `docker compose up`          | REPLACED: Compose already restarts the container; two supervisors would fight → WO-012 + WO-013                                                                                                                                                    |
| WO-B13-004 truthful status                                   | KEPT → WO-008 + WO-014; Handbook default by service default, no migration. "Remove Context.dev message" DROPPED: upstream UI, endpoint hard-coded (E21)                                                                                            |
| WO-B13-005 crawl priority + default 500                      | REPLACED: upstream crawler edits not allowed → fork "Run full audit" (500) + cap warning (WO-014). Crawl priority NOT DONE (§12)                                                                                                                   |
| WO-B13-006 resume site audit from frontier                   | REPLACED: upstream code → WO-009 (audit completes first) + WO-010 (one automatic re-run)                                                                                                                                                           |
| WO-B13-007 watchdog writing a status file the app reads      | REDESIGNED: workerd has no disk → app computes `/api/fork-health`; watchdog runs outside the app. "LLM key valid" → `configured` only (no paid call). "DataForSEO balance" DROPPED: upstream shows its own DataForSEO banner; audits do not use it |
| WO-B13-008 preflight chips on "Start audit"                  | NARROWED: upstream launch form untouched → chips on the fork button + app-wide status chip (WO-014)                                                                                                                                                |
| WO-B13-009 Task Scheduler + `.wslconfig vmIdleTimeout`       | CHANGED: Startup-folder keepalive; no `.wslconfig`, registry or admin; Ken runs it (K1)                                                                                                                                                            |
| WO-B13-010 salonvata golden + importer "M5"                  | MOVED → accuracy batch (now B15; golden source lives in a Ken-only path). Loop renamed M6; M5 = ops review (WO-090)                                                                                                                                |
| WO-B13-011 weekly self-test                                  | KEPT → WO-016; adds the in-app end-to-end run                                                                                                                                                                                                      |
| WO-B13-090 integration pass                                  | KEPT → WO-090 with numeric gates                                                                                                                                                                                                                   |
| "4–6 h" build estimate                                       | REVISED → 6–9 h                                                                                                                                                                                                                                    |
| Claude Code launch prompt + `.txt`                           | SUPERSEDED → `fork/batches/B13-heavy-dependability.md`                                                                                                                                                                                             |
| Run 4 result                                                 | KEPT (§3), time corrected                                                                                                                                                                                                                          |
| v1 residual weaknesses                                       | CARRIED (§12); crash class upgraded to VERIFIED from the audit row                                                                                                                                                                                 |

v2 → v3 (replacements only; additions are marked `[v3]` in place)

| v2 item                                                        | v3                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Test audits "25 pages" for cost and time                       | REPLACED → test mode (WO-001) caps Handbook pages and LLM per run; a 25-page site audit alone does not limit Handbook (E27) |
| Tests in Ken's salonvata project                               | REPLACED → dedicated project "B13 test – salonvata.com" (WO-002)                                                            |
| A8 ≤ 16 audits / ≤ 2 full · A9 ≤ $2                            | REPLACED → A8 ≤ 20 / ≤ 5 full · A9 ≤ $4 hard stop                                                                           |
| Build estimate 6–9 h                                           | REVISED → 9–13 h                                                                                                            |
| WO-003 audits in session mode at default size                  | REPLACED → test mode; plus audit row `error_detail` read                                                                    |
| G1 = A3 (25) → A4 (25) → A5 (full)                             | REPLACED → test mode off: full → full → 25-page, each started when the previous audit completes                             |
| WO-005 step b `idle_timeout`, step c `pgStep` release          | REORDERED → b = `pgStep` release, c = `idle_timeout`                                                                        |
| WO-006 stamp from `git status --porcelain`                     | REPLACED → hash of HEAD + diff + untracked + `.env.local`; last-good build fallback                                         |
| WO-007 probe on every unit, skip any unit                      | REPLACED → probe once at `render` batch 0; later sidecar units follow that row (E26)                                        |
| WO-007 separate "step 1" proof                                 | MERGED → first E2E reason string                                                                                            |
| WO-010 interrupted = stale beat only; cooldown for all re-runs | REPLACED → stale beat + terminate frozen instance + run-status guard; no cooldown for interrupted runs                      |
| WO-013 W2 restarts on DB failure                               | SPLIT → W2a / W2b / W2c                                                                                                     |
| WO-014 cap warning on audit `maxPages`                         | REPLACED → Handbook `coverageCapped` + site-audit cap note                                                                  |
| WO-016 Sunday 03:30, 25-page test run                          | REPLACED → Sunday 05:10 (backup at 03:30), real audit in the test project                                                   |
| WO-016 live `ok: false` check                                  | REPLACED → `--evaluate` unit test                                                                                           |
| WO-013 acceptance from a shell                                 | REPLACED → run through `systemctl` (tests the systemd `PATH`)                                                               |
| WO-011 `cron.ok` inside overall `ok`; open POST                | REPLACED → `cron.state` outside `ok`; POST needs `X-OpenSEO-Watchdog`                                                       |
| A2 / WO-014 hook file `AppShellParts.tsx`                      | REPLACED → `AppShell.tsx` (renders the banners)                                                                             |
| §5 "Supabase connector" line                                   | REWORDED                                                                                                                    |

## 5. Global constraints (every WO)

- `fork/FORK.md` in full: never ask Ken, record decisions, small commits on `ken/main`, session-end checks vs `fork/BASELINE.md`, dual-dialect Drizzle, no AI-detector checks, checks limited to rankings / SEO / GEO.
- Secrets: never read, print, log or commit `.env*`. All DB / systemd / Docker access goes through `bash fork/scripts/run-local.sh …` (it loads its own config). Script output must never contain a connection string, token or key (tests grep for it).
- No schema, migration or contract change in B13 (`CONTRACTS_VERSION` stays 1.7.0). Columns and fields used already exist: `handbook_run.score_final / score_uncapped / cap_reason / grade / error_code / coverage_capped`, `handbook_run_stage.error`, `audits.error_detail / failed_phase`, KV binding `KV`.
- No new npm dependency (`postgres`, `@playwright/test` already present).
- Do not edit `fork/handbook/`, `fork/fixtures/audits/`, `fork/research/`.
- `[v3]` The Supabase connector in Claude chat reaches an unrelated project only; never use it for this work.
- Watchdog and build must not fight: every autopilot run starts with `bash fork/scripts/run-local.sh ops maint on` (once WO-001 exists); the flag expires after 12 h; WO-090 ends with `maint off`; watchdog rule W0 stands down while the flag is fresh.
- `[v3]` Test mode (WO-001) is on for every live audit except G1, WO-016 and the WO-090 overlap test (those measure real load); it expires after 12 h; WO-090 ends with `testmode off`.
- Never edit a script that is executing: `fork/scripts/autopilot.sh` and `fork/scripts/start-build.sh` stay untouched in B13.
- The app listens on loopback only (`vite preview` default). Never add `--host`.
- `[v3]` After editing a file under `fork/deploy/`: `ops units`, then `ops restart app` (installed unit copies do not change otherwise).

Authorisations requested (granted by Ken's "go"; written into the batch file as `[Ken]` decisions):

| #   | Authorisation                                                                                                                             | Limit                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Upstream edit: move the existing Handbook hook statement below `finalizeAudit(...)` in `src/server/workflows/siteAuditWorkflowPhases.ts`  | move only                                                                                                                                                                                                           |
| A2  | Upstream edit: one line in `src/client/layout/AppShell.tsx` rendering `<ForkHealthChip />` next to `<SeoApiStatusBanners />` `[v3]`       | 1 line                                                                                                                                                                                                              |
| A3  | New route file `src/routes/api/fork-health.ts` + regenerated `src/routeTree.gen.ts`                                                       | additive                                                                                                                                                                                                            |
| A4  | Conditional upstream edits in `src/db/pg/client.ts`: `prepare: false,` and/or `idle_timeout: 20,`                                         | only when a WO-005 trigger fires; 1 line each                                                                                                                                                                       |
| A5  | Conditional upstream edit in `src/server/workflows/pgStep.ts`: end the step's client in `finally`                                         | only when WO-005 step b fires; ≤ 6 lines                                                                                                                                                                            |
| A6  | Conditional: one `vars` line in `wrangler.audit.jsonc` if the sidecar token is not visible inside workflow steps                          | only if the first WO-007 E2E reports `sidecar token not set`                                                                                                                                                        |
| A7  | New `ops` verbs behind `run-local.sh` (restart app / sidecar / timer, read logs, install units, test mode) usable by the unattended agent | verbs listed in WO-001 only                                                                                                                                                                                         |
| A8  | `[v3]` Live in-app test audits of `https://salonvata.com/`                                                                                | ≤ 20 total, ≤ 5 full-site (max 500 pages), rest 25 pages (selftest 50); one at a time except G1 and the exit overlap test; ≥ 10 min between other starts; pause 60 min when ≥ 10 % of a run's responses are 403/429 |
| A9  | `[v3]` LLM spend                                                                                                                          | ≤ $4 for B13; agent sums `llmCostUsd` from the E2E files and stops starting audits at $4                                                                                                                            |
| A10 | CLI golden runs at exit (3 sites, once, no LLM)                                                                                           | as B12 exit                                                                                                                                                                                                         |
| A11 | `[v3]` Create one app project "B13 test – salonvata.com" for test audits                                                                  | Handbook on, copy quality off, SERP originality off                                                                                                                                                                 |

Every applied upstream edit gets a row in `fork/UPSTREAM-EDITS.md`. Not applied → said so in the report.

## 6. Design decisions

| #   | Decision                                                                                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                        | Rejected                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-A | App runtime uses the Supabase **transaction** pooler: `run-local.sh` derives port 6543 from the existing `SUPABASE_DB_URL` for `prod` / `dev`; `.env.local` untouched; migrations and scripts stay on session 5432 | Per-request clients are the pattern transaction mode exists for: an idle or leaked client holds no database connection, so the 15-slot ceiling stops mattering whatever the leak mechanism is (E5). Client ceiling becomes 200 (E5). Query path already compatible (E6, E7). Zero upstream edits. Resolves the standing `needs_ken` item "pool size or transaction pooler" | Shared pool in the app (impossible in workerd); raising pool size (Ken action; only moves the ceiling); local PgBouncer (another service to supervise); ending the client at scope exit in `withPgClient` (breaks streamed responses, E2) |
| D-B | Client options (`prepare: false`, `idle_timeout`) and step release are conditional, each with a measured trigger                                                                                                   | Fewest upstream edits; each one justified by a number                                                                                                                                                                                                                                                                                                                      | Applying all up front                                                                                                                                                                                                                     |
| D-C | Handbook runs after `finalizeAudit` (amends ADR-001)                                                                                                                                                               | Site-audit results appear in minutes; Handbook trouble can no longer fail or delay the audit (R4, run 3); Handbook seeds survive finalize (E28)                                                                                                                                                                                                                            | Separate `HandbookWorkflow` binding (more `wrangler*.jsonc` edits)                                                                                                                                                                        |
| D-D | `[v3]` Recovery = heartbeat in KV + fork reconciler (stale beat → terminate frozen instance → `interrupted` → one automatic whole-audit re-run) + run-status guard before every Handbook unit                      | No schema change; works whether Miniflare resumes, kills or freezes the instance (E29); the guard stops a late-resuming instance from overwriting the run                                                                                                                                                                                                                  | Resume-in-place (needs a second durable driver); relying on the 2-h lease                                                                                                                                                                 |
| D-E | Supervision lives outside the app: Node watchdog on a systemd timer; the app only reports health                                                                                                                   | A dead app cannot heal itself; Compose keeps its own restart policy (R3)                                                                                                                                                                                                                                                                                                   | systemd unit wrapping Compose (v1)                                                                                                                                                                                                        |
| D-F | Everything the agent must run goes through `run-local.sh ops <verb>`, a fixed verb list                                                                                                                            | Already allowlisted (E18); no settings change by Ken; no arbitrary-command escape hatch                                                                                                                                                                                                                                                                                    | New allowlist entries                                                                                                                                                                                                                     |
| D-G | In-app end-to-end harness is the acceptance instrument for every WO; `[v3]` truth read from the database, UI checked against it                                                                                    | R10; UI scraping alone can't prove the UI is right                                                                                                                                                                                                                                                                                                                         | Unit tests + CLI goldens only                                                                                                                                                                                                             |
| D-H | Windows start-up: repo ships the installer; Ken runs it once                                                                                                                                                       | Changes to Ken's Windows start-up are his to make                                                                                                                                                                                                                                                                                                                          | Agent installs it via interop                                                                                                                                                                                                             |
| D-I | `[v3]` Test mode env file + dedicated test project                                                                                                                                                                 | Bounds Handbook pages and LLM per test run (E27, E31); keeps Ken's project history clean; avoids his project options (SERP originality uses DataForSEO credit)                                                                                                                                                                                                             | Per-run overrides (none exist in-app); tests in Ken's project                                                                                                                                                                             |
| D-J | `[v3]` Watchdog pings the database itself before restarting the app on DB failure                                                                                                                                  | Restarting cannot fix Supabase down / paused / no internet; restart loops would hide the real cause                                                                                                                                                                                                                                                                        | Restart on any DB failure                                                                                                                                                                                                                 |

ADRs to write in R1: ADR-025 database pool mode · ADR-026 hook after finalize (amends ADR-001) · ADR-027 recovery (heartbeat, reconciler, terminate, re-run) · ADR-028 supervision (ops verbs, test mode, health, watchdog, Windows kit).

## 7. Order and dependencies

Critical path: `001 → 002 → 003 → 004 (gate G1) → [005] → 007 → 009 → 010 → 011 → 013 → 016 → 090`
Fill-in work (code only, done while a live audit runs or cools down): `006, 008, 012, 015`, then `014` after `008 + 011`.

| WO                                                  | Needs         | Why this position                                                              |
| --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------ |
| 001 ops verbs + test mode                           | —             | every measurement, test and fault injection uses them                          |
| 002 in-app E2E harness + test project               | 001           | acceptance instrument; first run records today's failures (failing test first) |
| 003 evidence + baseline                             | 001, 002      | numbers before any change                                                      |
| 004 transaction pooler                              | 003           | first fix; everything after needs a stable DB                                  |
| 005 client hygiene (conditional)                    | 004           | triggers come from 004's measurements                                          |
| 006 restart without rebuild                         | 001           | makes every later restart test take seconds                                    |
| 007 sidecar in in-app runs                          | G1            | E2E must not be disturbed by DB lock-ups                                       |
| 008 persist grade, fix count                        | 002           | independent; needed by 010 / 014 acceptance                                    |
| 009 hook after finalize                             | G1            | changes what "audit completed" means for 010                                   |
| 010 heartbeat, reconciler, re-run                   | 006, 008, 009 | recovery rules assume 009                                                      |
| 011 health route                                    | 007, 010      | reuses the sidecar probe and heartbeat                                         |
| 012 `sidecar-up.sh`                                 | 001           | watchdog action                                                                |
| 013 watchdog                                        | 006, 011, 012 | needs health + actions + fast restart                                          |
| 014 fork UI (chip, Run button, defaults, cap notes) | 008, 011      | shows what 008 / 011 produce                                                   |
| 015 Windows kit (files)                             | —             | independent                                                                    |
| 016 weekly self-test                                | 002, 013      | reports through the watchdog                                                   |
| 090 exit                                            | all           | —                                                                              |

Runs (each ends with a commit + STATE update): R1 rebase check (M1), ADRs, WO files, queue rows, 001, 002 · R2 003 (+006, 008) · R3 004, G1, 005 (+012, 015) · R4 007 · R5 009, 010 · R6 011, 013 · R7 014, 016 · R8 090.

`[v3]` Live-audit plan (A8, A9; LLM ≈ $0.07 per test-mode run, ≈ $0.22 per real run):

| WO     | Audits                                         | Mode                |
| ------ | ---------------------------------------------- | ------------------- |
| 002    | 1 × 25                                         | test                |
| 003    | 2 × 25                                         | test                |
| 004 G1 | full → full → 25 (repeat once if G1 fails: +3) | real                |
| 005    | ≤ 2 × 25                                       | test                |
| 007    | 2 × 25                                         | test                |
| 009    | 1 × 25                                         | test                |
| 010    | 1 × 25 + its automatic re-run                  | test (re-run on)    |
| 014    | 1 × 25 (via the new button)                    | test                |
| 016    | 1 × 50                                         | real                |
| 090    | 25 + full, overlapping                         | real                |
| Total  | 17 (≤ 20 with a G1 repeat); full-site 3 (≤ 5)  | LLM ≈ $2.1 (≤ $2.8) |

## 8. Work orders

Paths under `src/server/features/handbook/` are written as `hb/…`; `src/client/features/handbook/` as `hbc/…`.

### WO-B13-001 — Ops verbs and test mode (R12, R14)

- Modify `fork/scripts/run-local.sh`: new case `ops)` → `exec bash fork/scripts/ops/ops.sh "${@:2}"`; `prod` and `dev` source `fork/runs/_ops/testmode.env` after `.env.local` when that file is < 12 h old. Create `fork/scripts/ops/ops.sh`, `fork/scripts/ops/measure.ts`.
- `ops.sh` accepts only the verbs below (`case` list; no `eval`; unknown verb → exit 2).

| Verb                                      | Does                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `status`                                  | `key=value` lines: app unit, tick timer, watchdog timer, sidecar container, pool mode, pooler sockets, build stamp + build-failed marker, test mode, maintenance flag, newest backup age (h), disk free (GB) on the repo filesystem, health summary (once WO-011 exists) |
| `logs <since> <until>`                    | app log lines (source below); per-pattern counts + ≤ 5 lines each; redacts `postgres(ql)?://\S+` and `Bearer \S+`                                                                                                                                                        |
| `sockets`                                 | established TCP sockets to remote ports 5432 / 6543 (`ss -Htn state established`)                                                                                                                                                                                        |
| `measure <label> <minutes>`               | every 10 s → `fork/runs/_ops/measure-<label>.csv`: time, sockets, serverConns (`pg_stat_activity` for `current_user`, own session excluded; one persistent session-pooler connection for the whole run), workerd RSS MB; prints min / peak / last                        |
| `wait <label> <max-min>`                  | blocks ≤ 9 min per call; prints `running \| done \| failed` for a detached job                                                                                                                                                                                           |
| `restart app\|sidecar\|tick`              | `systemctl --user restart …` / `docker restart sidecar-sidecar-1`                                                                                                                                                                                                        |
| `kill-workerd`                            | fault injection: SIGKILL the app's workerd processes                                                                                                                                                                                                                     |
| `sidecar stop\|start\|pause\|unpause`     | fault injection; `start` = `sidecar-up.sh` once WO-012 exists                                                                                                                                                                                                            |
| `units`                                   | `bash fork/scripts/install-units.sh`                                                                                                                                                                                                                                     |
| `maint on\|off`                           | write / remove `fork/runs/_ops/maintenance` (expires after 12 h)                                                                                                                                                                                                         |
| `testmode on [--rerun]\|off`              | write / remove `fork/runs/_ops/testmode.env`: `OPENSEO_TEST_MODE=1`, `HANDBOOK_MAX_PAGES=25`, `HANDBOOK_LLM_BUDGET_USD=0.25`, `HANDBOOK_AUTO_RERUN=0` (`1` with `--rerun`); then `restart app`                                                                           |
| `e2e …`, `e2e-read <auditId>`             | WO-002                                                                                                                                                                                                                                                                   |
| `watchdog`, `selftest`, `backfill-grades` | added by WO-013, 016, 008                                                                                                                                                                                                                                                |

- Long verbs (`measure`, `e2e`, `selftest`) run detached: print PID + output path and return at once (agent shell calls time out at ≤ 10 min).
- `ops e2e` and `ops selftest` export `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` (as the unit files do).
- Log source: `journalctl --user -u openseo-app.service`. If it returns no lines while the unit runs: add `StandardOutput=append:@REPO@/fork/runs/_ops/app.log` and `StandardError=append:@REPO@/fork/runs/_ops/app.log` to `fork/deploy/openseo-app.service`, `ops units`, read that file (the watchdog rotates it at 20 MB, keeps 2).
- Log patterns (case-insensitive): P1 `EMAXCONN|max client|MaxClientsInSessionMode|too many clients|remaining connection slots` · P2 `CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED|Network connection lost` · P3 `Failed query` · P4 `prepared statement` · P5 `out of memory|exceeded memory|Killed process` · P6 `uncaught|Unhandled`.
- Exit codes: 0 ok · 1 check failed · 2 usage.
- Tests: `bash -n` on both scripts; `ops status` exits 0 with ≥ 10 lines; `ops nonsense` exits 2; output of every verb contains none of `postgres://`, `postgresql://`, `Bearer `, `eyJ`; `testmode.env` older than 12 h is ignored by `run-local.sh`.

### WO-B13-002 — In-app end-to-end harness + test project (R10)

- Create `fork/scripts/ops/inapp-audit.mjs` (Playwright; problem collection as in `ui-smoke.mjs`) and `fork/scripts/ops/e2e-read.ts` (read-only DB queries through the `run-local.sh` env).
- Test project (A11): created once through the UI if absent; id stored in `fork/runs/_ops/test-project-id`. UI creation fails → use the existing salonvata project; if its SERP originality option is on, turn it off for B13 and restore it in WO-090; record both in the report.
- CLI: `--base http://127.0.0.1:3001 --url https://salonvata.com/ --max-pages <n> --label <name> [--project <id>] [--via form|button] [--no-wait-handbook] [--timeout-min 60]`. Starts the audit through the UI, takes the audit id from the page URL, polls.
- Truth from `e2e-read` (audit row, Handbook run row, stage rows, findings count, `llmCostUsd`, status-code share); UI values compared against it.
- Once WO-006 exists: refuses to start when `fork/runs/_ops/build-failed` exists or the build stamp ≠ the current tree.
- Output `fork/runs/_ops/e2e-<label>.json`:

```ts
type E2EResult = {
  label: string;
  startedAt: string;
  buildStamp: string;
  testMode: boolean;
  audit: {
    id: string;
    status: "completed" | "failed" | "running";
    pagesCrawled: number;
    maxPages: number;
    errorCode: string | null;
    errorDetail: string | null;
    completedAt: string | null;
    share403or429: number;
  };
  handbook: null | {
    runId: string;
    status: "queued" | "running" | "completed" | "failed";
    errorCode: string | null;
    grade: string | null;
    scoreFinal: number | null;
    findingsDb: number;
    findingsListCount: number;
    findingsPageCount: number;
    provisional: boolean;
    provisionalReason: string | null;
    coverageRead: number | null;
    coverageCapped: boolean;
    stages: Record<
      string,
      "pending" | "running" | "done" | "failed" | "skipped"
    >;
    llmCostUsd: number;
    finishedAt: string | null;
  };
  problems: string[];
};
```

- Exit 0 only when audit `completed`, Handbook `completed` (unless `--no-wait-handbook`), `findingsListCount === findingsPageCount === findingsDb`, and `problems` is empty.
- Acceptance: first run on today's code (test mode, 25 pages) → JSON written, exit 1, with `grade: null`, `findingsListCount: 0`, `findingsDb > 0`, `provisional: true` (records R1 + R6 before they are fixed).

### WO-B13-003 — Evidence and baseline (R2), no code change

1. `ops logs "2026-11-19 22:40" "2026-11-19 23:40"` → counts P1–P6 into `fork/reports/B13.md` §Evidence. No lines → "not available".
2. `[v3]` `ops e2e-read b634ee10-80d3-4210-8cd0-5b6a7d48be72` → `error_code`, `error_detail`, `failed_phase` of run 3 into §Evidence.
3. Session pooler as today, test mode on: `ops measure base 45` while 5 min idle → audit A1 (25) → audit A2 (25) started when A1 completes → 10 min idle.
4. Record sockets and serverConns at start, after A1, after A2, after idle. App errors during the run (`db_error`, UI problems) → record the time, `ops restart app`, continue; that counts as outcome C1.

| Outcome                                                   | Meaning                                                 | Next                                                          |
| --------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| C1 counts step up per audit and do not fall within 10 min | pinned-slot mechanism confirmed                         | WO-004                                                        |
| C2 counts fall back                                       | mechanism not reproduced; mark R2 mechanism UNCONFIRMED | WO-004 anyway (removes the ceiling); keep the watchdog metric |

### WO-B13-004 — Transaction pooler for the app runtime (R2)

- Modify `fork/scripts/run-local.sh` (`prod`, `dev`), `fork/scripts/preflight.sh`, `fork/RUNBOOK.md` (replace the `EMAXCONNSESSION` advice); ADR-025.
- `OPENSEO_DB_POOL_MODE` = `transaction` (default) | `session`. In `transaction`: when the `SUPABASE_DB_URL` host ends in `pooler.supabase.com`, the port is 5432, and a 3-s TCP connect to that host on 6543 succeeds, the Hyperdrive local connection string uses port 6543. Anything else → unchanged, log `pool-mode=session (<reason>)`. `POSTGRES_DATABASE_URL` stays session. Nothing printed but the mode line.
- Preflight adds `Supabase transaction pooler reachable (:6543)` as OPT.
- Gate G1 — test mode off. `ops measure tx 90` across A3 (full, max 500) → A4 (full) → A5 (25), each started through the harness the moment the previous audit is `completed`; UI polled throughout. All must hold:

|     | Criterion                                                               |
| --- | ----------------------------------------------------------------------- |
| a   | A3, A4, A5 audits and their Handbook runs all `completed`; 0 `db_error` |
| b   | app log: 0 matches for P1 and P4 in the window                          |
| c   | serverConns peak ≤ 12 (pool is 15)                                      |
| d   | `ui-smoke.mjs` 0 problems during A5 and again 10 min after              |

- G1 fails on P4 → WO-005 step a, repeat G1 once. Fails otherwise after that → `OPENSEO_DB_POOL_MODE=session`, apply WO-005 steps b and c, add `BLOCKED-KEN K3` (raise pool size), continue with the remaining WOs (watchdog W2a / W2c are the backstop).
- Rollback: `Environment=OPENSEO_DB_POOL_MODE=session` in `fork/deploy/openseo-app.service`.

### WO-B13-005 — Client hygiene, conditional (A4, A5)

| Step     | Trigger (measured)                                                              | Edit                                                                                                                                                  | Re-test                                                              |
| -------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| a        | any P4 match in G1 (not expected: E6)                                           | `src/db/pg/client.ts` options: `prepare: false,`                                                                                                      | G1 once                                                              |
| b `[v3]` | after G1 passes: pooler sockets 10 min after the last audit > idle baseline + 8 | `src/server/workflows/pgStep.ts`: end the step's client in `finally` (technique of `hook.ts` `releasePgConnection`), env `PG_STEP_RELEASE` default on | 1 audit (25, test mode) + 10 min idle; pass = sockets ≤ baseline + 8 |
| c `[v3]` | b applied, trigger still true                                                   | `src/db/pg/client.ts` options: `idle_timeout: 20,`                                                                                                    | as b                                                                 |
| d        | c applied, trigger still true                                                   | no more edits; watchdog rule W7 covers it; record                                                                                                     | —                                                                    |

- Each applied step: unit test, `fork/UPSTREAM-EDITS.md` row, ADR-025 note. No trigger → no upstream edit.

### WO-B13-006 — Restart without rebuild (R11)

- Modify `fork/scripts/run-local.sh` `prod)`, `fork/deploy/openseo-app.service` (`RestartSec=10` → `30`), then `ops units`.
- `[v3]` Build stamp `fork/runs/_ops/build-stamp` = sha256 over: HEAD sha, `git diff HEAD --binary -- src public package.json pnpm-lock.yaml vite.config.ts wrangler.jsonc wrangler.audit.jsonc`, contents of untracked files under those paths, and `.env.local` (only the combined hash is stored; nothing printed). Stamp equal and `dist/` exists → skip the build. `FORCE_BUILD=1` forces. Build command `pnpm build`, overridable by `OPENSEO_BUILD_CMD` (test hook only).
- `[v3]` Before building: copy `dist/` to `dist.prev/`. Build fails → restore `dist.prev/`, write `fork/runs/_ops/build-failed` (time + exit code), serve the restored build. Success → remove the marker, write the stamp.
- While building, `fork/runs/_ops/building` exists (removed on success or failure) so the watchdog does not restart a build in progress.
- Acceptance: `ops restart app` twice → second start answers HTTP 200 on `/` in ≤ 30 s; editing an already-modified file under `src/` → next start rebuilds; `OPENSEO_BUILD_CMD=false ops restart app` (test hook) → app serves the previous build, marker present, harness refuses to run.

### WO-B13-007 — Sidecar in in-app runs (R1)

- Create `hb/collectors/sidecar-config.ts` + test. Modify `hb/services/HandbookRunService.ts` (`prepareStage`), `hb/engine/stages.ts` (`StageContext`, `runStageUnit`), `hbc/ScoreCard.tsx`, `hbc/RunProgress.tsx`.

```ts
/** Pure: null config when the token is unset. URL default SIDECAR_DEFAULT_URL. */
export function sidecarConfigFromEnv(
  env: {
    token: string | undefined; // HANDBOOK_SIDECAR_TOKEN
    url: string | undefined; // HANDBOOK_SIDECAR_URL
    lighthouse: string | undefined; // HANDBOOK_LIGHTHOUSE
    concurrency: string | undefined; // HANDBOOK_RENDER_CONCURRENCY
  },
  depth: HandbookDepth,
): SidecarConfig | null;

/** null = usable. Reasons: "sidecar token not set" | "sidecar unreachable: <cause>"
 *  | "sidecar contracts <got> ≠ app <want>" | "sidecar token rejected" */
export async function probeSidecar(
  config: SidecarConfig | null,
  fetchImpl?: typeof fetch,
): Promise<string | null>;
```

- Probe: `GET /health` (3 s; `ok` and `contractsVersion === CONTRACTS_VERSION`), then `GET /token-check` with the Bearer token (401 → rejected; any other status → accepted). Token never logged.
- `prepareStage` passes `sidecarConfigFromEnv(...)` as the second argument of `createDefaultCollectors` (existing form) and `probe` into the stage context.
- `[v3]` `StageContext` gains `sidecarProbe?: () => Promise<string | null>`. In `runStageUnit`: `render` batch 0 calls the probe; a reason → that unit takes the existing cap skip path with the reason (stored "unavailable" + `tracker.skip(stage, batch, reason)`). Every later `render`, `axe`, `lighthouse` unit reads the `render` batch-0 row: `skipped` → skip with the same reason (batch 0 stores "unavailable", later batches `{}`, so the merged result stays unavailable, E26); `done` → run normally (later sidecar outages are handled per URL by the existing gate).
- Cause reaches the UI through existing fields only: stage rows `skipped` with `error = reason`; `getHandbookRunProgress` already returns it and `RunProgress` shows it. Banner: `Grade provisional — browser checks skipped: <reason>.`
- First E2E after the change tells the runtime facts: `sidecar token not set` → token not visible in workflow steps → mirror how `OPENROUTER_API_KEY` reaches them, `wrangler.audit.jsonc` `vars` line only if needed (A6). `sidecar unreachable: <network error>` while `ops sidecar` shows it healthy → loopback blocked → STOP this WO, `ESCALATE` with the error text, continue the batch; D2 then not met in B13.
- Unit tests: token missing · health timeout · contracts mismatch · 401 · config carries depth / lighthouse / concurrency · probe reason at `render` batch 0 skips `render`, `axe`, `lighthouse` (all batches) with that reason and still runs `crawl`, `map`, `checks` · probe ok at batch 0 → later units never probe.
- Acceptance (test mode): (1) sidecar up, `ops e2e s-up --max-pages 25` → `provisional: false`, stages `render`, `axe`, `lighthouse` = `done`. (2) `ops sidecar stop`, `ops e2e s-down --max-pages 25` → `provisional: true`, those stages `skipped`, `provisionalReason` contains `sidecar unreachable`; then `ops sidecar start`.

### WO-B13-008 — Persist grade, fix count, backfill (R6)

- Modify `hb/repositories/HandbookRepository.ts` (`finishRun`, `listRuns`), `hb/services/HandbookRunService.ts` (report stage), `hb/services/HandbookService.ts`, `hbc/HandbookRunsPage.tsx`. Create `fork/scripts/ops/backfill-grades.ts`.
- `[v3]` `HandbookService.scoreRun(projectId, runId): Promise<ScoreOutput | null>` = `scoreReport` over the same `buildReport(rows)` the run page uses; one code path for the report stage, the backfill and `getRunDetail`.
- `finishRun` input gains `score?: { final: number; uncapped: number; capReason: string | null; grade: string }`; the report stage fills it from `scoreRun`.
- `[v3]` `listRuns.findingsCount`: Drizzle drops table names here (E25). Use a left join on `handbook_finding` + `groupBy(handbook_run.id)` (two tables → qualified names), or a raw qualified `"handbook_run"."id"` in the subquery. Test (harness of `HandbookLeaseRepository.test.ts`), both dialects: 2 runs with 3 and 0 findings → `[3, 0]`.
- `ops backfill-grades`: completed runs with `grade IS NULL` → `scoreRun`, update; idempotent; prints the count.
- Acceptance: E2E `findingsListCount === findingsPageCount === findingsDb > 0`, `grade` non-null; backfill updates every completed run without a grade (at least `hb-b634ee10…`, `hb-b379783f…`).

### WO-B13-009 — Handbook after finalize (R4, A1)

- Modify `src/server/workflows/siteAuditWorkflowPhases.ts`: move the existing 3-line hook statement to directly after the `finalizeAudit({...})` call. Update the `fork/UPSTREAM-EDITS.md` row; ADR-026; adjust `hb/workflow/hook.test.ts` and the phases test.
- Holds already: hook swallows its errors; upstream `mark-failed` leaves a `completed` audit completed; Handbook seeds (`audit_pages`) survive finalize (E28).
- Recorded side effect: upstream post-phase steps (render-credit settle) now run after Handbook; local only.
- Acceptance: unit — every `finalizeAudit` step (first one: `multipage-checks`) is called before `handbook-setting-v1`. E2E (test mode) — `audit.completedAt < handbook.finishedAt`; audit page shows results while the Handbook run is `running`.

### WO-B13-010 — Heartbeat, reconciler, terminate, automatic re-run (R5)

- Create `hb/ops/kv.ts`, `hb/ops/heartbeat.ts`, `hb/scheduled/handbook-reconciler.ts` (+ tests). Modify `hb/workflow/hook.ts`, `hb/scheduled/forkScheduledJobs.ts` (add `handbookReconcilerJob` to the 5-minute list), `hb/repositories/HandbookRepository.ts` (`listActiveRuns()`), `hb/repositories/HandbookLeaseRepository.ts` (`releaseIfHolder(runId)`), `hbc/HandbookRunPage.tsx`.
- `hbStep`: write the beat on entry and every 30 s (interval stopped in `finally`; the key keeps its last value).
- `[v3]` Run-status guard in `hook.ts` `unit()`: before each unit, read the run row; status not `running | queued` → stop the phase without writing (no `finishRun`), log `handbook.phase.superseded`.
- Constants: `HEARTBEAT_INTERVAL_S 30` · `STALE_AFTER_S 600` · `RERUN_COOLDOWN_S 600` (failed audits only) · `RERUN_LOOKBACK_S 3600` · `RERUN_WINDOW_S 21600`.
- KV (shared by both workers, E30): `fork:hb:beat:<runId>` = `{ ts, stage, batch }` (TTL 1 day) · `fork:hb:rerun:<auditId>` = `{ newAuditId, at }` or `{ blockedBy }` (TTL 7 days; UI note only — eligibility comes from DB rows).
- Reconciler pass:
  1. KV self-test (put + get). Fails → do nothing, log `handbook.reconciler.kv-unavailable`.
  2. `[v3]` Run `running | queued`, started more than `STALE_AFTER_S` ago, beat missing or older than `STALE_AFTER_S` (a live step always beats; lease waits poll every 30 s) → `terminateStuckWorkflow` on the audit's workflow instance unless `readWorkflowStatus` says complete / errored / terminated / missing (upstream helpers, import only; errors ignored) → `finishRun({ status: "failed", errorCode: "interrupted" })` → `releaseIfHolder(runId)`.
  3. Lease whose holder is not `running | queued` → release.
  4. Re-run candidates, finished within `RERUN_LOOKBACK_S`: Handbook runs failed `interrupted` (eligible at once); audits `failed` with `errorCode ∈ { db_error, instance_lost, workflow_internal, step_timeout, unknown }` (eligible `RERUN_COOLDOWN_S` after `completedAt`). Never: `oom`, `cpu_limit`, `step_output_too_large` (they repeat).
  5. Start one new audit only if all hold: `HANDBOOK_AUTO_RERUN !== "0"` · no audit `running` in the project · no newer audit for the same project + start URL · inside `RERUN_WINDOW_S`, at most 1 audit for that project + start URL either failed or had its Handbook run interrupted (the current one) · DB ping ok.
  6. Re-run = `AuditService.startAudit` (E23) with the failed audit's `startUrl` and stored `config` (maxPages, lighthouseStrategy, excludePaths; `renderJavaScript` only when `isAuditRenderingAllowed()`); `actorUserId = startedByUserId`; `billingCustomer = { organizationId: project.organizationId, userId: startedByUserId, userEmail: "" }`; `limitTier = await AuditService.resolveAuditLimitTier(billingCustomer)` (local → `self_hosted`, no billing call).
- Run page for an interrupted run: `Interrupted — re-run started automatically <time>` or `Interrupted — not re-run: <rule>`.
- Unit matrix: fresh beat · stale beat + instance running (terminate called) · stale beat + instance missing · missing beat on a young run · KV down · orphan lease · guard stops a superseded run · each rule in step 5 false · second failure in the window → no re-run · DB ping fails → nothing now, retried next tick.
- Acceptance (`ops testmode on --rerun`): `ops e2e f1 --max-pages 25 --no-wait-handbook`; when stage `render` is `running` → `ops restart app`. Within 40 min: either the same run completes (workflow resumed, beats continue) or it is `failed / interrupted` ≤ 15 min after the restart, the lease is free, and the re-run audit completes with a graded run. Record which path occurred. Then `ops testmode on` (re-run off again).

### WO-B13-011 — Health (R8, A3)

- Create `hb/ops/health.ts` (+ test), `src/routes/api/fork-health.ts`. Modify `hb/functions.ts` (server fn `getForkHealth`), `hb/scheduled/forkScheduledJobs.ts` (`healthTickJob` writes KV `fork:health:tick`).

```ts
export type ForkHealth = {
  ok: boolean;
  checkedAt: string;
  testMode: boolean;
  checks: {
    db: {
      ok: boolean;
      ms: number | null;
      serverConns: number | null;
      error: string | null;
    };
    sidecar: { ok: boolean; version: string | null; reason: string | null };
    llm: { configured: boolean };
    cron: {
      state: "ok" | "stale" | "unknown";
      lastTickAt: string | null;
      ageSec: number | null;
    };
    handbook: {
      leaseHolder: string | null;
      beatAgeSec: number | null;
      interrupted24h: number;
    };
    audits: { running: number };
  };
  watchdog: null | {
    at: string;
    level: "ok" | "warn" | "fail";
    note: string;
    selftest: null | { at: string; ok: boolean };
    backupAgeH: number | null;
    diskFreeGb: number | null;
    buildFailed: boolean;
  };
};
```

- `GET /api/fork-health` → `ForkHealth`. `POST /api/fork-health` accepts only the `watchdog` object (validated, ≤ 1 KB) with header `X-OpenSEO-Watchdog: 1` (blocks cross-site browser posts) and stores it in KV `fork:health:watchdog`. Both answer only outside hosted auth mode (guard as upstream `/api/health`).
- Rules: each check ≤ 5 s; `testMode` = `OPENSEO_TEST_MODE === "1"`; `ok = db.ok && sidecar.ok`; cron `stale` = tick age > 900 s, `unknown` = no tick recorded yet (KV may be empty after a restart); `sidecar` = `probeSidecar` result; no env value in any response.
- Acceptance: `GET` returns every key; `ops sidecar stop` → `checks.sidecar.ok: false`, `ok: false`; POST without the header → 403; response bodies contain no value from `.env.local` (test greps the token).

### WO-B13-012 — `sidecar-up.sh` (R3)

- Create `fork/scripts/ops/sidecar-up.sh` = copy of steps 1–5 of `start-build.sh` (Docker reachable → token present or created → `docker compose --env-file <temp> up -d` → health + contracts → token check), including its `WSLENV` handling. Default: no `--build` unless the image is missing; `--build` forces. `start-build.sh` itself is not edited in B13; making it call `sidecar-up.sh` is a follow-up for loop M5.
- `[v3]` Docker binary: `command -v docker`, else `/usr/bin/docker`, else `"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"` (systemd units get a minimal `PATH`).
- `docker info` fails and `"/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe"` exists → start it detached (best effort; Windows interop may be unavailable under systemd), wait up to `WAIT_DOCKER`.
- New function `sidecar_render_probe`: `POST /render` of `HEALTH_RENDER_PROBE_URL` (default `https://example.com/`), 60 s limit.
- Token never in argv (keep the `curl -K -` pattern), never printed.
- Acceptance: `ops sidecar stop` → `ops sidecar start` → health ok ≤ 120 s; output contains no token.

### WO-B13-013 — Watchdog (R8, R14)

- Create `fork/scripts/ops/watchdog.mjs`, `watchdog.test.mjs` (`node --test`), `fork/deploy/openseo-watchdog.service` (Type=oneshot, `ExecStart=/usr/bin/env bash fork/scripts/run-local.sh ops watchdog`, `TimeoutStartSec=15min`), `fork/deploy/openseo-watchdog.timer` (`OnBootSec=3min`, `OnUnitActiveSec=2min`). Modify `fork/scripts/install-units.sh`, `fork/RUNBOOK.md` (what each status means; what Ken does when red).
- Files: state `fork/runs/_ops/watchdog-state.json` · status `fork/runs/_ops/status.json` · log `fork/runs/_ops/watchdog.log` (rotate at 1 MB, keep 3).
- Pure core: `decide(prev: State, probe: Probe, now: number): { actions: Action[]; next: State; level: "ok" | "warn" | "fail" }`.
- `[v3]` Probe includes the watchdog's own DB ping (same pooler port as the app's current pool mode, `postgres` package already installed, one query, closed after; host override `WATCHDOG_DB_PING_HOST` for tests only), the app unit's start time, newest backup file age, disk free, and the markers from WO-006. Ping errors are classed `pool` (P1 text) or `connection` (DNS, TCP, TLS, timeout, auth).

| #          | Condition                                                                                       | Action                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0         | maintenance flag younger than 12 h, or `building` marker younger than 15 min                    | probe and log only                                                                                                                                                          |
| W1         | health route unreachable on 2 passes in a row                                                   | restart app                                                                                                                                                                 |
| W2a `[v3]` | `db.ok: false` on 3 passes in a row and own DB ping ok                                          | restart app (allowed even with a fresh beat)                                                                                                                                |
| W2b `[v3]` | own DB ping fails with a `connection` error on 2 passes in a row                                | no restart; level `fail`; note `database unreachable (Supabase down or paused, or no internet)`                                                                             |
| W2c `[v3]` | P1 lines in the app log, or own ping fails with a `pool` error, on 2 passes in a row            | restart app                                                                                                                                                                 |
| W3         | `sidecar.ok: false`                                                                             | `sidecar-up.sh`; still down → `docker unpause` (errors ignored) + `docker restart`; still down → compose down + `sidecar-up.sh --build`; token rejected → compose down + up |
| W4         | deep render probe due (every 30 min, lease free) fails twice                                    | `docker restart sidecar-sidecar-1`                                                                                                                                          |
| W5         | cron `stale`, or `unknown` with the app up > 15 min                                             | restart `openseo-tick.timer`                                                                                                                                                |
| W6         | budget spent (app 3 restarts / h, sidecar 3 / h)                                                | no restart; level `fail`; notify                                                                                                                                            |
| W7         | lease free, no audit running, pooler sockets > 120 (client cap 200, E5)                         | restart app (counts toward the budget)                                                                                                                                      |
| W8         | level changed since the last pass                                                               | notify: Windows toast (best effort) + email if `RESEND_API_KEY` and `HEALTH_ALERT_EMAIL` are set; `POST /api/fork-health`                                                   |
| W9 `[v3]`  | newest backup older than 36 h · disk free < 5 GB · `build-failed` marker present · test mode on | level `warn` with the reason; no action                                                                                                                                     |

- Never restart the app while a beat is younger than 120 s, except W2a and W2c.
- Unit tests, table-driven, ≥ 16 cases: each row above, budget, maintenance, flapping (ok → fail → ok = 2 notifications), W2a vs W2b vs W2c (`pool` ping error restarts, `connection` ping error does not).
- Acceptance (run as `systemctl --user start openseo-watchdog.service`, not from a shell, so the systemd `PATH` is tested; `ops maint off` before, `ops maint on` after; timestamps recorded): F1 `ops sidecar stop` → healthy ≤ 6 min · F2a `ops sidecar pause` → W3 chain → healthy ≤ 8 min · F2b `HEALTH_RENDER_PROBE_URL=https://example.invalid/` + `WATCHDOG_DEEP_EVERY_S=120` → 2 failed probes → `docker restart` logged; then unset · F3 `ops kill-workerd` → app healthy ≤ 8 min · F4 budget forced in the state file → level `fail`, notification attempt logged, no restart · F5 `[v3]` own-ping target forced unreachable (`WATCHDOG_DB_PING_HOST=203.0.113.1`, test hook) → W2b, no restart.

### WO-B13-014 — Fork UI: status chip, Run button, defaults, cap notes (R6, R7, A2)

- Create `hbc/ForkHealthChip.tsx`, `hbc/RunFullAuditButton.tsx`. Modify `hbc/HandbookRunsPage.tsx`, `hbc/HandbookRunPage.tsx`, `hbc/queries.ts`, `hb/services/HandbookService.ts` (`getSettings`), `hb/workflow/hook.ts` (setting step), `src/client/layout/AppShell.tsx` (one line, A2), `fork/scripts/ops/inapp-audit.mjs` (default `--via button`).
- Default: project without a settings row → `enabled = HANDBOOK_DEFAULT_ENABLED !== "0"` (on), one shared helper used by `getSettings` and the hook. Saved rows win. Effect: every site audit of such a project also runs Handbook (LLM ≈ $0.22 per 80 pages, runs 3 and 4).
- `RunFullAuditButton` (Handbook page): calls the existing `startAudit` server function with the project's site, `maxPages: 500`, schema-default `lighthouseStrategy`, `renderJavaScript: false` (Site Audit rendering needs Context.dev, E21; Handbook renders through the sidecar). Before starting it reads health: DB failing → disabled, reason shown; sidecar or LLM failing → warning naming the check groups that will be skipped (browser render, accessibility, Lighthouse / AI-judged items); test mode on → warning.
- `[v3]` Cap notes (runs list + run page): Handbook `coverageCapped` → `Handbook stopped at its page limit: <coverageRead> pages read; results are incomplete.` Linked audit `pagesCrawled >= maxPages` → `Site audit stopped at its <n>-page limit (Handbook read <coverageRead> pages on its own).`
- Chip: green / amber / red, first failing check in plain words, one-line fix; "Test mode" label while on.
- Tests: chip states · both cap notes · default helper (row true / false / missing × env) · button disabled on DB failure.
- Acceptance: `ui-smoke.mjs` 0 problems; one test-mode E2E started through the new button.

### WO-B13-015 — Windows start-up kit, files only (R9)

- Create `fork/scripts/windows/install-autostart.ps1` (params `-Distro <name>` default = `$WSL_DISTRO_NAME` captured at build time and written into the README command, `-Uninstall`), `fork/scripts/windows/README.md`; `fork/RUNBOOK.md` § "Survives reboot".
- Installer, user level, no admin, no registry, no `.wslconfig`: writes `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenSEO-keepalive.vbs`, which runs hidden `wsl.exe -d <distro> --exec /bin/sh -c "sleep infinity"`; prints every file it writes; idempotent.
- The build does not run it. Queue row `BLOCKED-KEN (K1)`.
- Acceptance: script parses through `powershell.exe -NoProfile` when interop is available, else skipped with a note.

### WO-B13-016 — Weekly self-test (R10)

- Create `fork/scripts/ops/selftest.sh`, `fork/deploy/openseo-selftest.service` + `.timer` (`[v3]` Sunday 05:10 local, `Persistent=true`; backup runs 03:30 daily, Common Crawl 04:00 on the 5th, E32); modify `install-units.sh`.
- Skips when an audit is running. Steps: BadGEO quick (`badgeo-run.ts`) → `ops e2e weekly --max-pages 50` in the test project, test mode off → `fork/runs/_ops/selftest.json` `{ at, badgeo: { missing, unexpected }, e2e: { auditStatus, handbookStatus, grade, provisional }, ok }`. `ok` = BadGEO 0 / 0, audit `completed`, Handbook `completed`, `grade` non-null, `provisional: false`. Watchdog reports it (W8). `SELFTEST_INAPP=0` skips the live part.
- `[v3]` `selftest.sh --evaluate <e2e.json>` computes `ok` alone; unit-tested with passing and failing fixtures (no live run needed for the failing case).
- Acceptance: `systemctl --user start openseo-selftest.service` → JSON with `ok: true`.

### WO-B13-090 — Exit

1. Session-end checks vs `fork/BASELINE.md`; upstream diff lists only logged edits.
2. BadGEO quick 0 missing / 0 unexpected; `--sidecar http://127.0.0.1:4778` 0 / 0.
3. CLI goldens ×3, `--depth full --sidecar`, no LLM: caught Δ 0 vs B12.
4. `[v3]` Overlap test, test mode off: X1 (25-page audit); when X1's audit is `completed` and its Handbook `running` → X2 (full). X2's Handbook shows `queued` behind X1 (lease), then both complete. Assert D1–D5 from the E2E files, log patterns and the measure CSV.
5. D4 and D6 evidence from WO-010 and WO-013; D9 from `ops status` and the watchdog status file.
6. `fork/reports/B13.md`: evidence table, measurements, gate results, defaults chosen, upstream edits applied / not applied, live-audit count, LLM spend, BLOCKED-KEN list.
7. `fork/MAINTENANCE.md`: add loop M5 "Ops review" (weekly: `ops status`, watchdog log summary, `selftest.json`; follow-up: `start-build.sh` calls `sidecar-up.sh`).
8. `ops testmode off`; `ops maint off`; `ops status` shows both off; any project option changed by WO-002's fallback restored.
9. Refresh BASELINE; tag `handbook-v3.2.0`; STATE → `status: done`, `current_batch: MAINT`; remove "pool size or transaction pooler" from `needs_ken` when G1 passed.

## 9. After B13: B14 novice layout, then B15 accuracy (Handbook only)

[Ken 2026-11-20] B14 = novice layout (`fork/NOVICE-UI.md`), straight after B13. The accuracy items below are B15: start after B14 is green and loop M5 has one clean review ≥ 24 h later; B15 gets its own spec.

[2026-11-21, delegated decision] B16 novice cleanup + visual restyle (`fork/NOVICE-CLEANUP.md`) runs before B15. B15 scope and start rule below are unchanged.

[Ken 2026-11-21] Accuracy before restyle: B15 runs before B16, limited to items #0–#4 (spec `fork/ACCURACY.md`); the M5-review start rule is waived. Items #5–#12 move to a later batch.

| #        | Item (backlog id)                   | Change                                                                                                                                                                                                                            | Needs                                            |
| -------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0 `[v3]` | Coverage gap                        | Handbook read 80 URLs; the site audit crawled 155 (runs 3, 4). Seeds are status-200 rows only (E27). List the 75, classify (redirect, 404, attachment, non-HTML, unseen), fix any missing 200 page                                | first                                            |
| 1        | salonvata golden (T11)              | Source file `fork/fixtures/audits/salonvata.com-app-vs-semrush-2026-11-19.md` (comparison v3; Ken-only path, pushed on a separate go when B15 is launched) → `fork/fixtures/expected/salonvata.com.expected.yaml` through loop M3 | gives every later rule a target                  |
| 2        | Resource status (T1, T20)           | Every `<img>`, CSS, JS URL on read pages: HEAD → GET fallback → browser-UA retest on 403; one finding with page count (logo ×64)                                                                                                  | collector + contract addition (design with 3, 4) |
| 3        | Query-string link targets (T14)     | P3-08 probes un-crawled internal targets (e.g. `?page_id=15790`), cap 200                                                                                                                                                         | —                                                |
| 4        | Outbound link classes (T15)         | dead (DNS fail, 404, 410) = finding; platform bot blocks and redirects = info                                                                                                                                                     | —                                                |
| 5        | Grouping (T12, T16)                 | one finding per rule with template / page groups (F33–F47 → 1)                                                                                                                                                                    | —                                                |
| 6        | Anchor text (T7)                    | empty anchors; generic external anchors                                                                                                                                                                                           | —                                                |
| 7        | Entity rule (T10)                   | deterministic: > 1 business node, > 1 `WebSite` node, or differing `name` values                                                                                                                                                  | —                                                |
| 8        | Root-cause rules (T5, T6, T17)      | WordPress attachment pages; theme demo content incl. lorem ipsum                                                                                                                                                                  | 1                                                |
| 9        | Weak-link pages (T9, Handbook part) | sitemap URLs with exactly 1 inlink                                                                                                                                                                                                | —                                                |
| 10       | 19 Semrush GAP checks (T13)         | by priority in the comparison catalog                                                                                                                                                                                             | 2–9                                              |
| 11       | External-export importer + loop M6  | `fork/scripts/import-external-audit.ts <xlsx>` maps export rows to registry items, lists misses both ways                                                                                                                         | 1                                                |
| 12       | AI-judge stability (optional)       | findings such as F25 change between runs                                                                                                                                                                                          | —                                                |

- Done in B13: T3, T4, T18, T19; T2 partly (500-page fork button).
- Not possible under fork rules (upstream Site Audit code): T2 crawl priority, T8 HSTS in the Site Audit summary, T9 Site Audit orphan logic. Handbook covers the findings.
- B14 novice layout builds on `RunFullAuditButton`, `ForkHealthChip`, the cap notes and banner reasons from WO-B13-014.

## 10. Review focus (failure modes most likely to bite; each has a test)

| #   | Condition                                                                      | Expected                                                                                              | Test                                         |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Three audits back to back on one process (run-3 condition)                     | no lock-up                                                                                            | G1 (WO-004)                                  |
| 2   | Sidecar alive but not rendering (B10 incident)                                 | detected by a real render, restarted                                                                  | WO-013 F2a, F2b                              |
| 3   | `[v3]` App restarts mid-Handbook; instance frozen "running"; lease left behind | run marked interrupted ≤ 15 min, instance terminated, work re-done once, late resume cannot overwrite | WO-010 fault injection + unit matrix         |
| 4   | `[v3]` Internet or Supabase drops mid-run                                      | run ends cleanly; no re-run storm; no restart loop; app heals when DB returns                         | WO-010 "DB ping fails", WO-013 W2b / F5 / W6 |
| 5   | Audit hits a page cap                                                          | UI says which cap and that results are incomplete                                                     | WO-014 cap-note tests                        |

## 11. Ken actions

| #             | Action                                                                                                                                                         | When                        | Needed                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------- |
| K0            | Say "go": approves §5 A1–A11 and the spec push                                                                                                                 | done 2026-11-20 02:02       | —                                     |
| K-launch      | Ubuntu: `cd ~/open-seo && git pull --ff-only && bash fork/scripts/start-build.sh`                                                                              | after the push              | yes                                   |
| K-wait `[v3]` | Leave the app alone during the build (it restarts often; test audits appear in the "B13 test – salonvata.com" project); done when `fork/reports/B13.md` exists | during the build            | yes                                   |
| K1            | Windows PowerShell: run `fork\scripts\windows\install-autostart.ps1` once (command in `fork/scripts/windows/README.md`)                                        | after B13                   | for D7                                |
| K2            | Docker Desktop → Settings → General → start at sign-in                                                                                                         | any time                    | optional (watchdog tries to start it) |
| K3            | Supabase dashboard → Database settings → raise pooler pool size (possible on free: 60 direct connections, E5)                                                  | only if the B13 report asks | conditional                           |
| K4            | Add `RESEND_API_KEY` and `HEALTH_ALERT_EMAIL` to `.env.local`                                                                                                  | any time                    | optional (email alerts)               |
| K5            | PC on, awake, signed in                                                                                                                                        | always                      | inherent (§12)                        |

## 12. Risks and residual weaknesses

SUPPORTED

- Crash class = database (`db_error` on the run-3 audit row; restart cured it; run 4 clean).
- R1, R4, R5, R6, R10, R11, R12 read directly in code; R6 also seen in live data; `[v3]` the zero count traced to Drizzle's single-table rendering (E25).
- Transaction-pooler compatibility of app code: one Postgres client, every query unprepared, no session-only SQL in `src/` (E6, E7).
- `[v3]` Transaction-mode client cap 200 on free compute; pool size configurable (E5).

SPECULATIVE

- Pinned-slot mechanism behind R2 (WO-003 measures; plan proceeds either way).
- App log for 2026-11-19 22:40–23:40 may no longer exist.
- Loopback fetch from workflow steps to the sidecar works at runtime (source says yes); sidecar token visible inside steps. Either false → WO-007 escalates and D2 slips.
- postgres.js timers firing inside workflow contexts (matters only if WO-005 step c triggers).
- Miniflare after an app restart: workflow instances resume, die or freeze; KV and workflow state persist or not. WO-010 passes on each; `terminate` on a frozen local instance untested.
- `docker pause` is a fair stand-in for a hung sidecar.
- Windows interop (toast, starting Docker Desktop) from systemd services; both best effort.
- WSL stops a distro with no session process, and the Startup-folder keepalive prevents it, on Ken's Windows build. Untested until K1.
- `[v3]` Supabase free plan pauses idle projects; the 5-min cron queries probably count as activity. A pause shows as W2b (red, no restarts).
- `[v3]` B13 effort 9–13 h unattended; LLM ≈ $2.1 (≤ $2.8); in-app Handbook with render ≈ 18–22 min on salonvata (80 pages), ≈ 7–10 min in test mode.
- Playwright harness breaks when upstream changes the audit UI after a rebase: failure is loud, fix is local to `inapp-audit.mjs`.
- AI-judge findings (F03, F06, F24, F25) vary between runs (carried from v1; B15 item 12).

NOT SOLVED BY THIS PLAN

- PC off, asleep, or rebooted and not signed in = app down, and nothing is running to send an alert. An always-on host (mini PC or a server running `deploy/standalone`) is a separate decision.
- Upstream Site Audit: crawl priority, 50-page default in its own form, JS rendering that needs Context.dev (E21). Unchanged.
- One Handbook run per machine (lease) stays; a second audit's Handbook queues.
- Automatic re-run crawls the site a second time; at most once per 6 h per site.
- Up to 6 new small upstream edits in 5 files (A1, A2, A4 ×2, A5, A6; 2 certain, 4 conditional) widen the weekly rebase conflict surface (loop M1 handles logged edits).
- `[v3]` ≤ 20 test audits during B13 + 1 per week afterwards hit salonvata.com; A8 limits them, a host-side block is still possible.
- `[v3]` Last-good build fallback serves older code after a failed build until someone fixes it; status shows `warn`.
