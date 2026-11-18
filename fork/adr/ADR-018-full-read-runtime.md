# ADR-018: Full-read runtime — depth model, caps, staged workflow, run queue, memory

- Status: accepted
- Date: 2026-11-18 · Batch: B8 (R1)

## Context

- Spec: `fork/FULL-READ.md` §2 (depth model), §7 (runtime), §8 (contingencies), §9 (speed / scale gates).
- Today: in-app cap 200 (`services/HandbookService.ts` `DEFAULT_MAX_PAGES`), CLI 60 (`fork/scripts/handbook-audit.ts`); the whole audit is one `pgStep` with a 30-min timeout and 1 retry (`workflow/hook.ts`); render/axe 1 page per template, max 16 (`collectors/sidecar-collectors.ts` `MAX_SAMPLES`); Lighthouse home + 2.
- Upstream pg client uses `max: 1` per process (`src/db/pg/client.ts`, Hyperdrive guidance); the pool exhaustion seen in run 25 came from 3 concurrent first audits each holding session-pooler connections (Supabase pool 15) on `run-local.sh dev`.
- Measured B8 R1 (`fork/reports/B8.md` §1):
  - Engine CLI, synthetic site, no sidecar/LLM: 60 / 200 / 500 pages → 0.8 / 1.1 / 2.4 s engine time; peak heap 121 / 135 / 158 MB; peak RSS 335 / 332 / 364 MB (RSS is dominated by the tsx/esbuild process baseline). Heap grows ≈ 85 KB per page with all `PageSnapshot`s held in memory.
  - Live CLI (`--max-pages 500`, sites are small): whyracingevents 33 pages with sidecar 2 min 40 s (render 26 s / 15 pages, axe 39 s / 15, Lighthouse 28 s / 3), peak RSS 236 MB; bluetreefunding 41 pages no sidecar 1 min 44 s; ryanmscottsdale 11 pages 49 s.
  - Sidecar `/render` (JS on, mobile, scroll): 26.9 renders/min at client concurrency 1, 52.2 at 2, 53.7 at 3 — flat at 3 because the sidecar caps browser work at `MAX_RENDERS = 2` (`fork/sidecar/server.ts`).
  - In-app path: the local app runs under `vite preview` → workerd; idle workerd RSS is ≈ 283 MB and runs normally, so the 128 MB Worker memory limit is not enforced locally (it is a Cloudflare production isolate limit). An in-app 200/500-page run could not be measured this run: the SSRF policy (correctly) refuses the 127.0.0.1 synthetic site, and none of the three goldens has more than 41 pages. Moved to WO-B9-026 (1000-page synthetic site with an explicit local-only allow, in-app and CLI).

## Decision

- Depth: `HANDBOOK_DEPTH` / CLI `--depth` = `full` (default) | `quick` exactly as FULL-READ §2. `quick` = today's behavior (kept for CI and BadGEO speed). Report header and `handbook_run.depth` carry the depth; scoring compares grades only within one depth.
- Caps: `HANDBOOK_MAX_PAGES` default 1000 for app and CLI (CLI `--max-pages` overrides). Over cap: stratified fill (every template's rank-1, then round-robin per template); coverage `{discovered, read, capped}` on the run; grade flagged `partial coverage` when read/discovered < 0.9. Infinite-space guard per FULL-READ §2 (after 300 pages ≤ 100 per template; query URLs deduped to canonical; `?page=`, `/page/N/`, date paths ≤ 20 each).
- Staged run: `crawl → render → axe → lighthouse → map → reduce → checks → report`, each a separate `pgStep` in `workflow/hook.ts`, with render/lighthouse in batches of 25 and map in batches of 20 (one step per batch). Step id = `runId:stage:batch`; state in `handbook_run_stage` (`status`, `startedAt`, `finishedAt`, `attempt`, `error`, counters). A replayed step whose row is `done` returns immediately (idempotent). Step timeout 30 min; whole-run cap `HANDBOOK_RUN_MAX_MINUTES` default 90 → remaining stages skipped, run completes with `partial coverage` and the skipped stages' items BLOCKED `run time cap`.
- Memory: a stage reloads what it needs from DB + evidence store; no stage holds more than one batch of bodies (25 pages ≈ 25 × (≈ 200 KB raw + ≈ 300 KB rendered) ≈ 12 MB). Bodies are streamed to the evidence store gzip'd (FULL-READ §7.4); `PageSnapshot` kept in memory is facts only (no `html`) after the crawl stage. At the measured ≈ 85 KB per page of facts, 1000 pages ≈ 85 MB — under the 128 MB isolate limit even if the app is ever deployed to Cloudflare, so no in-app → local-runner handoff threshold is needed. The CLI uses the same stages in-process (`--depth full`).
- Run queue: one handbook run per machine (DB lease row in `handbook_run_lease`, key `machine`, holder `runId`, 2-h expiry, renewed at each stage start). Others wait `queued` (the workflow step sleeps 30 s and re-checks; the run page shows "queued behind …"). CLI runs that write to Supabase take the same lease; file-only CLI runs do not. Fork code that opens its own Postgres pool (scripts, cron jobs) uses `max: 5`; upstream's `max: 1` client is not touched.
- Sidecar concurrency: `HANDBOOK_RENDER_CONCURRENCY` default 3 (client side), and the sidecar's `MAX_RENDERS` becomes env-configurable (`HANDBOOK_SIDECAR_MAX_RENDERS`, default 3) so the client concurrency is not silently halved. Axe shares the same limiter. Lighthouse stays sequential (one at a time; it measures timing, parallel runs skew it).
- Lighthouse scope: `HANDBOOK_LIGHTHOUSE` = `templates` (default: rank-1 of every template, cap 15, mobile + home desktop + 3 heaviest pages + escalations) | `all` (batches of 25, mobile only, run cap +0.6 min per Lighthouse page, time estimate shown before start).

## Alternatives

| Option                                                         | Why not                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Keep one long `pgStep`, raise its timeout                      | No resume; one failure repeats the whole crawl; a 1000-page run exceeds any sane single-step timeout                      |
| Local-runner handoff above N pages (app shells out to the CLI) | Measured memory makes it unnecessary; two code paths to keep in sync; the app process would need shell access             |
| Sidecar batch endpoint (`/render-batch`)                       | Client-side concurrency gives the same throughput (measured ≈ linear to the server cap) with no new endpoint; see ADR-021 |
| Unbounded parallel runs with a bigger pool                     | Supabase free tier pool is 15; Chromium in the sidecar is the real bottleneck anyway                                      |
| Lighthouse on every page by default                            | ≈ 9 s per page measured (28 s / 3) → +15 min per 100 pages; performance is template-driven, escalations cover outliers    |

## Consequences

- Contracts 1.5.0 (R2): run `depth` + coverage on the run/report contract; escalation log type.
- Schema (R2, both dialects): `handbook_run_stage`, `handbook_run_lease`, run `depth` + `coverage_discovered` / `coverage_read` / `coverage_capped` columns.
- Sidecar: `MAX_RENDERS` env (R2.3, image rebuild → restart via `fork/scripts/start-build.sh --check`).
- Speed budget for a 100-page `full` run (projected from the measurements above): crawl ≈ 1.5 min (300 ms politeness), render ≈ 2 min, axe ≈ 2 min, Lighthouse ≈ 3 min (≈ 19 pages), map ≈ 2 min (concurrency 4), judge ≈ 1.5 min, bot-parity escalation ≤ 5 min when triggered → ≈ 12–17 min against the 20-min gate. The bot-parity escalation is the largest variable; it keeps the 300 ms floor (FULL-READ §4).
- Risk: WSL2 + Docker Desktop CPU share; c = 3 may not scale linearly. WO-B9-004 re-measures at 3 after the image change and records it.

## Verification

- WO-B9-021 tests: replaying a finished stage is a no-op; a crashed batch resumes at that batch; the run cap ends a run as `partial coverage`.
- WO-B9-022 tests: second run waits `queued` while a lease is held; expired lease is taken over.
- WO-B9-026: 1000-page synthetic site completes in-app and CLI, no OOM, within the run cap; peak heap recorded.
- WO-B9-090: 100-page `full` wall time ≤ 20 min (FULL-READ §9).
