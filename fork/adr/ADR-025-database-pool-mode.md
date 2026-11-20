# ADR-025: App runtime uses the Supabase transaction pooler

- Status: accepted
- Date: 2026-11-20 · Batch: B13

## Context

- The app runs in workerd (Miniflare), not Node (`fork/scripts/run-local.sh prod` → `vite preview`). Sockets cannot be shared across requests.
- `src/db/pg/client.ts` opens one postgres.js client (`max: 1`) per request and per workflow step and never ends it (upstream comment: streamed responses keep querying). `pgStep` does the same; only Handbook steps release theirs (`hbStep` → `releasePgConnection`).
- The app connects to the Supabase session pooler (port 5432), pool 15 per role + database. Session mode pins one server connection per client. Transaction mode (port 6543, same host) shares server connections between clients; client cap 200 on free compute.
- Every Drizzle query goes through `client.unsafe()`; postgres.js `unsafe` is unprepared by default. No session-only SQL in `src/` (advisory locks, LISTEN/NOTIFY, `SET`, temp tables, named prepares).
- Driver options cannot arrive by URL or env inside workerd; only an explicit option in `client.ts` works.
- Run 3 on salonvata.com (2026-11-19) failed with `db_error` inside `finalizeAudit`; the app returned errors until restarted. Mechanism (pinned session slots) INFERRED; WO-B13-003 measures it.

## Decision

- `run-local.sh prod|dev` derives the Hyperdrive local connection string with port 6543 from the existing `SUPABASE_DB_URL` when `OPENSEO_DB_POOL_MODE` is `transaction` (default), the host ends in `pooler.supabase.com`, the port is 5432 and a 3-s TCP connect to 6543 succeeds. Otherwise the URL is unchanged and the script logs `pool-mode=session (<reason>)`. `.env.local` is not edited.
- Migrations, `run-sql.ts`, backups and other scripts stay on the session pooler (5432).
- Client options (`prepare: false`, `idle_timeout: 20`) and ending the `pgStep` client are conditional upstream edits (A4, A5), applied only when a WO-B13-005 trigger is measured.
- Rollback: `Environment=OPENSEO_DB_POOL_MODE=session` in `fork/deploy/openseo-app.service`.

## Alternatives

| Option                                         | Why not                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Process-wide pool in the app                   | Impossible in workerd (sockets are per request)                    |
| Raise the session pool size                    | Ken action; only moves the ceiling (kept as K3 fallback)           |
| Local PgBouncer                                | Another service to supervise                                       |
| End the client at scope exit in `withPgClient` | Breaks streamed responses (upstream comment); larger upstream edit |

## Consequences

- No upstream edit by default. Resolves the standing `needs_ken` item "pool size or transaction pooler" when gate G1 passes.
- A leaked or idle client no longer holds a database connection; the 15-slot ceiling stops mattering.
- Risk: a library issuing named prepared statements breaks in transaction mode (log pattern P4) → WO-B13-005 step a.

## Verification

- Gate G1 (WO-B13-004): three real audits back to back (full → full → 25) with `ops measure`; 0 `db_error`, 0 P1 / P4 log lines, serverConns peak ≤ 12, `ui-smoke.mjs` 0 problems during and 10 min after.
