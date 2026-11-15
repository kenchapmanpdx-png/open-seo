# ADR-011: Production runtime on Ken's computer

- Status: accepted (design); build in B4 (WOs in `fork/queue.md`), verify in B5
- Date: 2026-11-14 · Batch: B3

## Context

- BLUEPRINT §3.7: the app runs on Ken's computer (WSL), database on Supabase Postgres, client reports published to Vercel. Nothing else is reachable from outside.
- `fork/scripts/run-local.sh {dev|migrate|prod}` already maps `SUPABASE_DB_URL` to the Hyperdrive local connection string and `POSTGRES_DATABASE_URL`; `prod` = `pnpm build` + `vite preview` (workerd).
- Upstream crons (`wrangler.jsonc` `triggers.crons`: `*/5 * * * *` rank checks + AI visibility + stale-audit watchdog; `17 3 * * *` daily cleanup) are dispatched by `scheduled()` in `src/server.ts`. Rank checks select configs whose next check is due, so a missed tick is picked up by the next one (oldest first).
- The K3 render sidecar runs in Docker (`fork/sidecar/compose.yaml`), port bound to 127.0.0.1, bearer token `HANDBOOK_SIDECAR_TOKEN`.

## Decision

### Process layout

| Process        | Command                                             | Restart                                            |
| -------------- | --------------------------------------------------- | -------------------------------------------------- |
| App (workerd)  | `bash fork/scripts/run-local.sh prod` (port 3001)   | systemd user unit, `always`                        |
| Render sidecar | `docker compose -f fork/sidecar/compose.yaml up -d` | compose `restart: unless-stopped`                  |
| Cron ticker    | `fork/scripts/cron-tick.sh` (B4)                    | systemd user timer, every 5 min                    |
| Nightly backup | `fork/scripts/backup.sh` (B4)                       | systemd user timer, 03:30 daily, `Persistent=true` |

- One token for app + sidecar: `HANDBOOK_SIDECAR_TOKEN` appended to `.env.local` by shell (`openssl rand -hex 24`), read by `run-local.sh` and passed to compose through the environment. Never printed.
- The app binds 127.0.0.1 only. No tunnel, no port forward.

### Schedules and catch-up

- `vite preview` does not fire Worker crons by itself. The ticker posts to the local scheduled-handler endpoint the Cloudflare Vite plugin exposes (`/cdn-cgi/handler/scheduled?cron=<expr>`) every 5 minutes, and with the daily expression once a day. B4 verifies the endpoint under `vite preview`; fallback: a fork route that calls the same `scheduled()` export, behind a loopback-only check.
- Computer off → no ticks. On start, systemd `Persistent=true` runs a missed daily timer once; the first 5-minute tick runs every rank check / AI-visibility config that became due while off (upstream due-selection). No backfill of the missed intermediate points: the history shows a gap, which is the truth.
- Handbook re-baselines (B6/B7 outcome loop) follow the same rule: store `next_run_at`, select due rows on tick.

### Supabase

- Migration order on every upgrade: `run-local.sh migrate` = upstream `db:migrate:pg` (includes fork handbook migrations, ADR-002) → `supabase-harden.sql` (RLS on, no `anon`/`authenticated` grants on app tables, idempotent) → `supabase-check.ts` (fails on any table readable through the Data API).
- The app connects with the pooled connection string as a dedicated role; the service-role key is used only for evidence storage (ADR-003).

### Client report publishing (Vercel)

- A published report is a static snapshot: `index.html` (the client report HTML, ADR-012) + its evidence screenshots, deployed to the Vercel project from `fork/vercel/reports/` with `VERCEL_TOKEN` (Ken's Pro team).
- Path `/<32-char base64url random>/` (unguessable; no listing page; root returns 404). Every response carries `X-Robots-Tag: noindex, nofollow` (`vercel.json` headers) and the page has `<meta name="robots" content="noindex, nofollow">`.
- `REPORTS_DOMAIN` optional: custom domain on the project; unset → the `*.vercel.app` URL.
- Unpublish = delete the snapshot directory and redeploy; the slug is never reused.

### Backup

- `backup.sh`: `pg_dump --format=custom` of the app schema via `SUPABASE_DB_URL` to `~/openseo-backups/YYYY-MM-DD.dump`, keep 14 daily + 8 weekly; evidence objects stay in Supabase Storage (their own durability). Restore drill documented in the runbook (B4) and run once in B5.

### Upgrade procedure

1. Stop the app unit. 2. `git fetch upstream && git rebase upstream/main` on `ken/main` (FORK.md). 3. `pnpm install`. 4. Backup now (`backup.sh`). 5. `run-local.sh migrate`. 6. Session-end checks. 7. Rebuild sidecar if `fork/sidecar/` changed (`--build`). 8. Start the app; smoke: home page, one handbook run on BadGEO.

## Alternatives

| Option                             | Why not                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Cloudflare deploy (Alchemy)        | BLUEPRINT puts runtime on Ken's computer; sidecar would need a public host.       |
| Publish reports via upstream `/s/` | Needs the app reachable from the internet; it is not.                             |
| Backfill missed rank checks        | Fabricates history points at times no check ran.                                  |
| Cron in WSL crontab                | WSL cron is not started by default; systemd user units are (with `systemd=true`). |

## Consequences

- Schedules pause while the computer is off; reports state their run date.
- B4 WOs: systemd units, `cron-tick.sh` (+ endpoint verification), `backup.sh`, Vercel publisher, runbook.

## Verification

- B5: reboot drill (app, sidecar and ticker come back; a due rank check runs on the first tick), restore drill from a dump into a scratch database, a published report returns `noindex` and the root returns 404.
