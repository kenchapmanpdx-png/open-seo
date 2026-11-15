# Runbook — OpenSEO fork, local production

Local production per ADR-011: the app runs on this computer (`vite preview`, 127.0.0.1:3001) against Supabase Postgres; the render sidecar runs in Docker; client reports are published as static snapshots on Vercel. Env names only below; values live in `.env.local` (never open, print, or commit it — append with the shell).

## Start / stop / status

| What         | Start                                                                                                   | Stop                                                                                         | Status                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Units (once) | `bash fork/scripts/install-units.sh`                                                                    | `systemctl --user disable --now openseo-app.service openseo-tick.timer openseo-backup.timer` | `systemctl --user status openseo-app.service openseo-tick.timer openseo-backup.timer` |
| App          | `systemctl --user start openseo-app.service` (or by hand: `bash fork/scripts/run-local.sh prod`)        | `systemctl --user stop openseo-app.service`                                                  | `journalctl --user -u openseo-app.service -n 50`                                      |
| Cron ticker  | `systemctl --user start openseo-tick.timer`                                                             | `systemctl --user stop openseo-tick.timer`                                                   | `journalctl --user -u openseo-tick.service -n 20`                                     |
| Backup       | `systemctl --user start openseo-backup.timer`                                                           | `systemctl --user stop openseo-backup.timer`                                                 | `ls -lh ~/openseo-backups`                                                            |
| Sidecar      | `docker compose -f fork/sidecar/compose.yaml up -d` (needs `HANDBOOK_SIDECAR_TOKEN` in the environment) | `docker compose -f fork/sidecar/compose.yaml down`                                           | `curl -s http://127.0.0.1:4777/health`                                                |

- Units need systemd in WSL (`/etc/wsl.conf`: `[boot]` `systemd=true`, then `wsl --shutdown`).
- Development instead of production: `bash fork/scripts/run-local.sh dev`.
- The ticker posts to `/cdn-cgi/local/scheduled?cron=…` every 5 minutes and fires the daily expression between 03:15 and 03:19. Computer off → no ticks; the first tick after start runs whatever became due.

## Run an audit

- **UI**: project → Handbook tab → enable, pick the mode → run a site audit; the handbook phase runs after the crawl. The run page shows grade, phases, findings, checklist, evidence.
- **MCP** (after the B5 registration hook): `handbook_audit_run` → poll `handbook_findings_get` → `handbook_status_export` / `handbook_report_publish`. Agent instructions: `fork/skills/handbook-audit/SKILL.md`.
- **CLI** (no app needed): `pnpm exec tsx fork/scripts/handbook-audit.ts https://example.com --mode REVIEW --out fork/runs/example.com/r1` — add `--sidecar http://127.0.0.1:4777` for render/axe/Lighthouse evidence and `--llm` for the LLM-judged checks.
- BadGEO regression: `pnpm exec tsx fork/scripts/badgeo-run.ts` (see the script header for `--only` and sidecar use).

## Publish / unpublish a client report

1. `pnpm exec tsx fork/scripts/publish-report.ts fork/runs/<site>/<run>/report.json` — prints the public URL (`REPORTS_DOMAIN` when set, else the `openseo-reports` project alias) and checks `x-robots-tag: noindex` + root 404.
2. `pnpm exec tsx fork/scripts/publish-report.ts --unpublish <slug>` — removes the snapshot and redeploys. Slugs are never reused.
3. `fork/vercel/reports/published.json` records slug → run id, origin, dates. Snapshots (`fork/vercel/reports/r/`) are not committed: publish from this machine only, or the next deploy drops them.

Saving into the app's own Reports (private) is the run page's "Save client report" button, or `handbook_report_publish`.

## Upgrade (ADR-011)

1. `systemctl --user stop openseo-app.service`
2. `git fetch upstream && git rebase upstream/main` on `ken/main` (conflicts: upstream wins outside fork paths, FORK.md)
3. `pnpm install`
4. `bash fork/scripts/backup.sh`
5. `bash fork/scripts/run-local.sh migrate` (upstream + handbook migrations → `supabase-harden.sql` → `supabase-check.ts`)
6. Session-end checks: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check` against `fork/BASELINE.md`
7. Sidecar changed (`fork/sidecar/`) → `docker compose -f fork/sidecar/compose.yaml up -d --build`
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

- **Sidecar unhealthy**: `docker compose -f fork/sidecar/compose.yaml logs --tail 50`; rebuild with `up -d --build`. Wrong token → 401 in the CLI log; rotate.
- **Playwright host libraries missing** (in-app UI smoke): the sidecar image has them; the host needs `pnpm exec playwright install-deps` (sudo).
- **New route 404 / route tree stale**: `pnpm exec vite dev` for ~45 s regenerates `src/routeTree.gen.ts`; commit it and log it in `fork/UPSTREAM-EDITS.md`.
- **Ticks fail (curl exit 7)**: the app is not up on 3001 — `journalctl --user -u openseo-app.service`.
- **Supabase check fails after migrate**: a table is readable through the Data API; rerun `run-local.sh migrate` (the harden SQL is idempotent) and read `supabase-check.ts` output.

## What is public

Only the Vercel snapshots under `/r/<32-char slug>/` (noindex, no listing, root 404). The app binds 127.0.0.1 with no tunnel or port forward; the sidecar binds 127.0.0.1:4777; Supabase app tables are closed to the Data API (`supabase-harden.sql`).
