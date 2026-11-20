# ADR-027: Handbook recovery — heartbeat, reconciler, terminate, one re-run

- Status: accepted
- Date: 2026-11-20 · Batch: B13

## Context

- The Handbook lease expires after 2 h and is released only in a `finally` step; process death leaves it held (ADR-018). An interrupted run stays `running`.
- Upstream's reconciler flips only `running` audits whose workflow instance is errored / terminated / missing. Upstream ships `readWorkflowStatus` and `terminateStuckWorkflow`; a frozen step on the Docker edition can stay "running" for good.
- KV binding `KV` has the same namespace id in both workers. No schema change is allowed in B13.

## Decision

- `hbStep` writes `fork:hb:beat:<runId>` = `{ ts, stage, batch }` on entry and every 30 s (TTL 1 day).
- Run-status guard before every Handbook unit: run row not `running | queued` → stop the phase without writing; log `handbook.phase.superseded`.
- 5-minute fork reconciler: KV self-test → runs `running | queued` older than 600 s with a beat missing or older than 600 s → `terminateStuckWorkflow` (unless already complete / errored / terminated / missing) → `finishRun(failed, interrupted)` → `releaseIfHolder` → orphan leases released → at most one automatic whole-audit re-run per project + start URL per 6 h, under the rules in `fork/DEPENDABILITY.md` WO-B13-010 step 5 (`HANDBOOK_AUTO_RERUN`, no running audit, no newer audit, DB ping ok).
- Re-run uses `AuditService.startAudit` with the failed audit's start URL and stored config; failed audits wait 600 s; interrupted Handbook runs are eligible at once; `oom`, `cpu_limit`, `step_output_too_large` never re-run.

## Alternatives

| Option                   | Why not                                              |
| ------------------------ | ---------------------------------------------------- |
| Resume in place          | Needs a second durable driver                        |
| Rely on the 2-h lease    | Run stays `running`, nobody re-runs, UI lies for 2 h |
| Cooldown on every re-run | Delays recovery of interrupted runs for no gain      |

## Consequences

- No schema change; KV keys only. `HandbookRepository.listActiveRuns`, `HandbookLeaseRepository.releaseIfHolder` added.
- A re-run crawls the site a second time (at most once per 6 h per site).
- Risk: Miniflare may resume, kill or freeze the instance after a restart; the guard prevents a late-resuming instance from overwriting a run already marked interrupted.

## Verification

- Unit matrix in WO-B13-010 (fresh / stale beat, instance running / missing, young run, KV down, orphan lease, guard, each re-run rule, second failure, DB ping fail).
- Fault injection: `ops restart app` while `render` runs → same run completes, or `interrupted` ≤ 15 min after restart, lease free, re-run graded within 40 min.
