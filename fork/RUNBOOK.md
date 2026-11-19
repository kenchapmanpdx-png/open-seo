# Runbook — OpenSEO fork, local production

Local production per ADR-011: the app runs on this computer (`vite preview`, 127.0.0.1:3001) against Supabase Postgres; the render sidecar runs in Docker; client reports are published as static snapshots on Vercel. Env names only below; values live in `.env.local` (never open, print, or commit it — append with the shell).

## Start / stop / status

| What         | Start                                                                                                                           | Stop                                                                                         | Status                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Units (once) | `bash fork/scripts/install-units.sh`                                                                                            | `systemctl --user disable --now openseo-app.service openseo-tick.timer openseo-backup.timer` | `systemctl --user status openseo-app.service openseo-tick.timer openseo-backup.timer` |
| App          | `systemctl --user start openseo-app.service` (or by hand: `bash fork/scripts/run-local.sh prod`)                                | `systemctl --user stop openseo-app.service`                                                  | `journalctl --user -u openseo-app.service -n 50`                                      |
| Cron ticker  | `systemctl --user start openseo-tick.timer`                                                                                     | `systemctl --user stop openseo-tick.timer`                                                   | `journalctl --user -u openseo-tick.service -n 20`                                     |
| Backup       | `systemctl --user start openseo-backup.timer`                                                                                   | `systemctl --user stop openseo-backup.timer`                                                 | `ls -lh ~/openseo-backups`                                                            |
| Sidecar      | `bash fork/scripts/start-build.sh --check` (builds, starts with the `.env.local` token, verifies; creates the token if missing) | `docker compose -f fork/sidecar/compose.yaml down`                                           | `curl -s http://127.0.0.1:4777/health`                                                |

- Build (start or resume, any time): `bash fork/scripts/start-build.sh` — Docker check, sidecar on the current code + `.env.local` token, app restart, clears a `restart sidecar` needs-ken, then `autopilot.sh`. Docker Desktop must be running.
- Units need systemd in WSL (`/etc/wsl.conf`: `[boot]` `systemd=true`, then `wsl --shutdown`).
- Development instead of production: `bash fork/scripts/run-local.sh dev`.
- The ticker posts to `/cdn-cgi/local/scheduled?cron=…` every 5 minutes and fires the daily expression between 03:15 and 03:19. Computer off → no ticks; the first tick after start runs whatever became due.

## Run an audit

- **UI**: project → Handbook tab → enable, pick the mode → run a site audit; the handbook phase runs after the crawl. The run page shows grade, phases, findings, checklist, evidence.
- **MCP** (after the B5 registration hook): `handbook_audit_run` → poll `handbook_findings_get` → `handbook_status_export` / `handbook_report_publish`. Agent instructions: `fork/skills/handbook-audit/SKILL.md`.
- **CLI** (no app needed): `pnpm exec tsx fork/scripts/handbook-audit.ts https://example.com --mode REVIEW --out fork/runs/example.com/r1` — add `--sidecar http://127.0.0.1:4777` for render/axe/Lighthouse evidence and `--llm` for the LLM-judged checks. `--lighthouse all` (or `HANDBOOK_LIGHTHOUSE=all`; needs `--depth full` + `--sidecar`) runs Lighthouse on every live page in batches of 25, prints a time estimate (0.6 min per page + base) before start and the exact page count after the crawl, and raises the run cap by 0.6 min per page. In-app runs have no sidecar, so the scope only affects the CLI.
- BadGEO regression: `pnpm exec tsx fork/scripts/badgeo-run.ts` (see the script header for `--only` and sidecar use). With render: `--sidecar http://127.0.0.1:4778` (test-only sidecar that may reach private addresses; started by `start-build.sh`; the real sidecar on 4777 refuses them).

## Full-read audits (depth, caps, budget, queue, storage, escalations)

- **Depth**: `HANDBOOK_DEPTH` / `--depth` = `full` (default: every page up to the cap, render + axe on every live page, JS-off render per template, LLM map of every page) or `quick` (pre-full-read sampling, 60 pages; CI and BadGEO). Grades compare only within one depth; the report header names it.
- **Caps**: `HANDBOOK_MAX_PAGES` / `--max-pages` (full default 1000). Over the cap the crawl fills every template first; coverage reads "read N of M" and the grade is flagged `partial coverage` below 90 %. After 300 pages ≤ 100 per template; pagination / calendar patterns ≤ 20 each. Whole-run cap `HANDBOOK_RUN_MAX_MINUTES` (default 90) stops cleanly with partial coverage.
- **LLM budget**: auto $0.50 + $0.01 × pages, cap $5 (`HANDBOOK_LLM_BUDGET_USD` overrides); map ≤ 60 %, judge ≥ 40 %. Exhausted → remaining LLM items BLOCKED `llm budget`. Map model `HANDBOOK_LLM_EXTRACT_MODEL` (default Haiku; `claude-sonnet-5-5` is the fallback if extraction quality drops). Page profiles (DB `handbook_page_profile`, CLI `fork/runs/.profile-cache/`) and judge verdicts (app: evidence bucket `<projectId>/_judge-cache/`; CLI `fork/runs/.judge-cache/`) are cached, so an unchanged rerun costs little. Delete the cache folder to force fresh verdicts.
- **Source check**: P5-03 is N/A unless `HANDBOOK_SOURCE_CHECK=on` (no off-site verification by default).
- **Queue**: one handbook run per machine (`handbook_run_lease`, 2-h expiry); others show `queued`. CLI runs that write to Supabase take the same lease.
- **Storage**: bodies are gzipped; full bodies kept for the newest 2 runs per project (`EVIDENCE_RETAIN_RUNS`), older runs keep findings + excerpts (daily retention job). At ≥ 80 % of the 1 GB bucket the job writes `_status/storage.json` and the run page shows a warning. The evidence viewer opens bodies as plain text (gunzipped in the browser).
- **Escalations** (logged in the report as "Escalated: … because …"): bot block / challenge / different bot body on the 8-URL probe → bot parity on ≤ 200 pages × 5 bots × 2 rounds + 10 plain-HTTP probes (a UA stops after 5 blocks in a row; any 429 stops the pass; ≥ 300 ms between requests); hidden-without-JS text on a template's rank-1 page → JS-off render of the template; raw vs rendered word gap > 20 % → render diff for the template; llms.txt / .md mirror → mirror probes (cap 200); LCP > 4 s → Lighthouse on 2 more pages of the template (cap +10); page weight > 5 MB → Lighthouse on that page (cap +5).
- **Never**: form submission, logins, vulnerability probing; beacons and media bodies are aborted in the render.

## Scaled content, copy quality and copy rules (B11, SCALED-COPY)

None of these is scored; the grade is unchanged. Findings go under "Additional findings".

| Flag                                   | Default | CLI                          | Handbook tab                                             |
| -------------------------------------- | ------- | ---------------------------- | -------------------------------------------------------- |
| `HANDBOOK_COPY_QUALITY`                | `off`   | `--copy-quality`             | checkbox "Copy quality"                                  |
| `HANDBOOK_SERP_ORIGINALITY`            | `off`   | `--serp-originality`         | checkbox "Compare with top-10 results" (AUDIT mode only) |
| `HANDBOOK_SERP_ORIGINALITY_MAX_PAGES`  | 10      | `--serp-originality-pages N` | —                                                        |
| `HANDBOOK_SERP_ORIGINALITY_BUDGET_USD` | 0.50    | —                            | —                                                        |

- The project setting (Handbook tab) wins when on; the env value is the operator default.
- **Scaled-content summary** (full depth, always on): indexable pages, pages in P3-12 near-duplicate clusters, thin pages (P3-12, P5-15), SUPP-17 sets and pages, median own-text share per template (share of a page's sentences found on no other page), SUPP-18 counts (checked / without an original element / blocked) when it ran, SUPP-19 pages. Zeros are shown.
- **SUPP-17** (always on at full depth): ≥ 3 pages of one template that share ≥ 60 % of their main-text sentences. `variation` = titles, H1s or slugs differ by one swapped term. S2 at ≥ 10 pages or ≥ 20 % of indexable pages. Skipped when P5-09 already reports the pages or all pages sit in one P3-12 duplicate cluster.
- **SUPP-18** (flag, AUDIT only; REVIEW → N/A, EP-7): up to 10 service / product / guide / article / category pages; one derived query each; Google top 10 from DataForSEO (US / en, cached 7 days); ≥ 5 competitor pages read and profiled; one verdict per page: does the page have first-party data, a test, a case, an expert quote or a worked example that none of the results has? A finding only for a confident "no"; unsure verdicts are shown, never findings. Costs: lookups ≤ $0.002 per page (≤ $0.02 for 10 pages), LLM ≤ `HANDBOOK_SERP_ORIGINALITY_BUDGET_USD` ($0.50), separate from the run LLM budget. BLOCKED states: `dataforseo credit` (credentials, payment, balance), `llm budget` (no key or budget out), `serp pages unavailable` (< 5 results read). Lookup cache: app evidence bucket `<projectId>/_serp-cache/`, CLI `fork/runs/.serp-cache/`.
- **SUPP-19** (always on): text addressed to AI assistants ("ignore previous instructions", "note to AI", hidden directives to recommend / rank / cite). S2 when hidden (comment, attribute, meta, JSON-LD, hidden element, removed by JS), S3 when visible. English patterns only; other languages are LIMITED.
- **Copy quality** (flag): label line `Copy quality — not scored. Ranking effect: SPECULATIVE. …`; site medians, per-template medians and the 20 pages with the most metrics over the guide threshold. Deterministic (no LLM, no fetch). Pages under 200 prose words, non-English pages and contact / legal / listing / form pages are `not measured`. The numbers describe wording patterns only.
- **Copy rules pack** (`fork/skills/copy-rules/SKILL.md`): rules for drafting or rewriting page copy. In the app: Handbook tab "Copy rules" button, MCP `handbook_copy_rules_get`, and a `copyRules` hint on `handbook_findings_get` when P5 / SUPP-17 / SUPP-18 findings are returned; SAM chat loads it as a skill; Claude Code: `cp -r fork/skills/copy-rules ~/.claude/skills/`. After any edit to the pack run `pnpm exec tsx fork/scripts/copy-rules-sync.ts` (`--check` fails on drift).

## Publish / unpublish a client report

1. `pnpm exec tsx fork/scripts/publish-report.ts fork/runs/<site>/<run>/report.json` — prints the public URL (`REPORTS_DOMAIN` when set, else the `openseo-reports` project alias) and checks `x-robots-tag: noindex` + root 404.
2. `pnpm exec tsx fork/scripts/publish-report.ts --unpublish <slug>` — removes the snapshot and redeploys. Slugs are never reused.
3. `fork/vercel/reports/published.json` records slug → run id, origin, dates. Neither it nor the snapshots (`fork/vercel/reports/r/`) are committed (the repo is public; the slug is the only access control): publish from this machine only, or the next deploy drops them. Each deploy deletes the project's older deployments, so an unpublished snapshot is gone from every URL, not only the alias.

Saving into the app's own Reports (private) is the run page's "Save client report" button, or `handbook_report_publish`.

## AI traffic (Vercel drain receiver, ADR-013)

- Add a site: insert one `ai_traffic_site` row (`id`, `project_id`, `organization_id`, `vercel_project_id` from the client's Vercel project settings); optional `ai_traffic_site_host` rows limit it to listed hosts (none = every host). Then re-run the deploy below so the drain covers the new project.
- Deploy / re-create the drain / rotate secrets (one command, idempotent; rotates `DRAIN_SECRET` and the `traffic_ingest` password every run): `pnpm exec tsx fork/scripts/deploy-receiver.ts`. Expected tail: `drain openseo-ai-traffic: N project(s)` and `unsigned POST → 403`.
- Vercel log drains need a Pro team and are billed per GB; the receiver keeps only AI bot / AI referral requests and counts the rest per hour (`ai_traffic_discard`).
- Refresh the bundled crawler IP lists (weekly is plenty): `pnpm exec tsx fork/scripts/refresh-ip-ranges.ts`, then commit `src/server/features/ai-traffic/ip-ranges/`.
- Discards with an empty `site_id` mean the drain sends a project that has no `ai_traffic_site` row.

## Common Crawl backlink baseline (ADR-016)

- Monthly on the 5th at 04:00 (`openseo-commoncrawl.timer`, catches up after downtime). Manual: `pnpm exec tsx fork/scripts/commoncrawl-backlinks.ts [--release cc-main-YYYY-mon-mon-mon] [--target example.com] [--force]`.
- Downloads the newest domain graph (~9 GB gz per release) to `~/.cache/openseo/commoncrawl/<release>/` (`CC_CACHE_DIR` overrides); keeps the latest two releases. A complete file is reused; an interrupted one restarts.
- Targets: a project's own domain is enrolled disabled; turn it on in the handbook tab (Backlinks, Common Crawl) or run once with `--target <domain>`. Enabled projects' competitors (`project_competitors`) are imported too, for the competitor gap.
- Without `--target`, an already imported release is skipped (`--force` re-imports). Domain rows are kept for the last 4 releases per target; summaries forever.
- `cc_release.status = failed`: rerun the command; downloads already on disk are reused.

## Upgrade (ADR-011)

1. `systemctl --user stop openseo-app.service`
2. `git fetch upstream && git rebase upstream/main` on `ken/main` (conflicts: upstream wins outside fork paths, FORK.md)
3. `pnpm install`
4. `bash fork/scripts/backup.sh`
5. `bash fork/scripts/run-local.sh migrate` (upstream + handbook migrations → `supabase-harden.sql` → `supabase-check.ts`)
6. Session-end checks: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check` against `fork/BASELINE.md`
7. Sidecar changed (`fork/sidecar/`) → `bash fork/scripts/start-build.sh --check` (rebuilds both sidecars: 4777 real, 4778 BadGEO test)
8. `systemctl --user start openseo-app.service`; smoke: home page loads, one handbook run on BadGEO

## Backup and restore drill

- Nightly 03:30 (`openseo-backup.timer`, catches up after downtime): `pg_dump --format=custom` to `~/openseo-backups/YYYY-MM-DD.dump`; keeps the 14 newest + 8 newest Sunday dumps. Without a local `pg_dump` it uses the `postgres:17-alpine` image. Preview: `bash fork/scripts/backup.sh --dry-run`.
- Evidence bodies stay in Supabase Storage (not in the dump).
- Restore drill (into a scratch database, never production): start one with `docker run -d --name openseo-restore -e POSTGRES_PASSWORD=drill -p 127.0.0.1:55432:5432 postgres:17-alpine`, then `docker run --rm --network host -v ~/openseo-backups:/b postgres:17-alpine pg_restore --no-owner --dbname=postgres://postgres:drill@127.0.0.1:55432/postgres /b/<date>.dump`; check row counts of `handbook_run` and `projects`; `docker rm -f openseo-restore`.

## Rotate the sidecar token

One shell, so the new value never leaves it:

1. `export HANDBOOK_SIDECAR_TOKEN=$(openssl rand -hex 24)`
2. `docker compose -f fork/sidecar/compose.yaml up -d --force-recreate`, wait for `/health`
3. Replace the `HANDBOOK_SIDECAR_TOKEN` line in `.env.local` from that shell (edit by shell, never open the file), then `systemctl --user restart openseo-app.service`

A run started by a new shell does not know the running sidecar's token: rotate as above before CLI runs with `--sidecar`.

## LLM checks: OpenRouter credits and budget

- Key `OPENROUTER_API_KEY`; model `HANDBOOK_LLM_MODEL` (default in `src/server/features/handbook/llm/model.ts`); per-run cap `HANDBOOK_LLM_BUDGET_USD`.
- No key, budget reached, or credits exhausted → LLM items are `BLOCKED` with a note; deterministic checks and the grade are unaffected (LLM findings never cap the grade).
- Cost per run: `handbook_llm_call` rows (tokens + USD); eval: `pnpm exec tsx fork/scripts/llm-eval.ts run`.

## Troubleshooting

- **Sidecar unhealthy**: `docker compose -f fork/sidecar/compose.yaml logs --tail 50`; rebuild with `up -d --build`. Wrong token → 401 in the CLI log; rotate. A stalled sidecar (1.2.1+) exits by itself and Docker restarts it: look for `sidecar stall:` / `sidecar deadline:` lines in the log; audits mark the affected pages `sidecar timeout` / `sidecar unavailable` and finish.
- **`EMAXCONNSESSION` (max clients reached in session mode)**: several site audits at once exhaust the Supabase session pooler (15 clients) under `run-local.sh dev`; audits fail or stall at 0 pages. Run one audit at a time; restarting the app (or touching `.env.local`, which restarts vite) frees the connections. Handbook runs queue behind one machine lease (`handbook_run_lease`, 2-h expiry), but the upstream crawl phase and every app request open their own session-pooler client, so 2–3 concurrent site audits still exhaust the pool before the handbook starts (run 31). Start audits one at a time until B10 decides the pooler.
- **Playwright host libraries missing** (in-app UI smoke): the sidecar image has them; the host needs `pnpm exec playwright install-deps` (sudo).
- **New route 404 / route tree stale**: `pnpm exec vite dev` for ~45 s regenerates `src/routeTree.gen.ts`; commit it and log it in `fork/UPSTREAM-EDITS.md`.
- **Ticks fail (curl exit 7)**: the app is not up on 3001 — `journalctl --user -u openseo-app.service`.
- **Supabase check fails after migrate**: a table is readable through the Data API; rerun `run-local.sh migrate` (the harden SQL is idempotent) and read `supabase-check.ts` output.

## What is public

Only the Vercel snapshots under `/r/<32-char slug>/` (noindex, no listing, root 404). The app binds 127.0.0.1 with no tunnel or port forward; the sidecar binds 127.0.0.1:4777; Supabase app tables are closed to the Data API (`supabase-harden.sql`).

## Removing the handbook tables

`fork/scripts/handbook-down.sql` drops the 13 handbook tables (children first; SQLite and Postgres). Upstream tables are untouched. It does not remove the drizzle journal row, so re-apply by running `drizzle/pg/0050_handbook_engine.sql` (or the SQLite `0072_…`) directly. Take a backup first (`fork/scripts/backup.sh`).
