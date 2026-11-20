# ADR-028: Supervision — ops verbs, test mode, health route, watchdog, Windows kit

- Status: accepted
- Date: 2026-11-20 · Batch: B13

## Context

- The unattended agent may only run `bash fork/scripts/run-local.sh …` (allowlist); no `systemctl`, `journalctl`, `docker restart`, `ss`.
- Nothing watches the app, sidecar, database or cron; background jobs (backup, tick, build) fail silently. Every app start rebuilds; a failed build leaves the app down.
- workerd has no disk, so the app cannot write a status file; a dead app cannot heal itself. The sidecar container already has `restart: unless-stopped`.
- The machine is Ken's WSL session on Windows; WSL may stop with no session process.

## Decision

- `run-local.sh ops <verb>` → `fork/scripts/ops/ops.sh`, a fixed `case` list of verbs (status, logs, sockets, measure, wait, restart, kill-workerd, sidecar, units, maint, testmode, e2e, e2e-read, watchdog, selftest, backfill-grades). Unknown verb → exit 2. No `eval`. Output redacts connection strings and bearer tokens.
- Test mode = `fork/runs/_ops/testmode.env` (Handbook 25 pages, LLM $0.25 per run, auto re-run off unless `--rerun`), sourced by `run-local.sh prod|dev` only while < 12 h old.
- Restart without rebuild: build stamp over HEAD + diff + untracked + `.env.local`; last good `dist/` kept and restored on build failure (`build-failed` marker).
- The app reports health only: `GET /api/fork-health` (`ForkHealth`), `POST` accepts the watchdog summary with header `X-OpenSEO-Watchdog: 1`; both off in hosted auth mode.
- Supervision runs outside the app: Node watchdog on a 2-min systemd timer with a pure `decide()` core, rules W0–W9 (`fork/DEPENDABILITY.md` WO-B13-013), restart budgets, own DB ping (no restart loop when Supabase or the internet is down).
- Weekly self-test (Sunday 05:10): BadGEO quick + one real in-app audit in the test project.
- Windows start-up kit: a user-level Startup-folder keepalive script shipped in the repo; Ken runs it once (K1).

## Alternatives

| Option                                      | Why not                                             |
| ------------------------------------------- | --------------------------------------------------- |
| New allowlist entries                       | Ken settings change; arbitrary-command escape hatch |
| systemd unit wrapping Docker Compose        | Two supervisors fighting Compose's restart policy   |
| Status file written by the app              | workerd has no disk                                 |
| Agent installs Windows start-up via interop | Ken's machine settings are his to change            |

## Consequences

- Upstream edits: `src/routes/api/fork-health.ts` + regenerated route tree (A3), one line in `src/client/layout/AppShell.tsx` (A2).
- Every autopilot run starts with `ops maint on` so the watchdog stands down during builds (flag expires after 12 h).
- Residual: PC off / asleep = app down with nothing running to alert.

## Verification

- `ops` script tests (bash -n, exit codes, no secret in output); `watchdog.test.mjs` ≥ 16 table cases; fault tests F1–F5 through `systemctl --user start openseo-watchdog.service`; `selftest.sh --evaluate` fixtures.
