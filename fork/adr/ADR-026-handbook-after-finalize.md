# ADR-026: Handbook phase runs after `finalizeAudit` (amends ADR-001)

- Status: accepted
- Date: 2026-11-20 · Batch: B13

## Context

- ADR-001 placed the Handbook hook after Lighthouse, before `finalizeAudit` (`src/server/workflows/siteAuditWorkflowPhases.ts`). `finalizeAudit` uses no Handbook output.
- Effect: site-audit results stay hidden for the whole Handbook phase (≈ 9–22 min), and a late failure in `finalizeAudit` after a long Handbook run fails the audit (salonvata run 3: `db_error` 12 min after Handbook finished).
- `finalizeAudit` clears progress KV and crawl scratch state; `audit_pages` (the Handbook seed list) is deleted only with the audit. The hook swallows its own errors; upstream `mark-failed` leaves a `completed` audit completed.

## Decision

- Move the existing one-statement hook to directly after the `finalizeAudit({...})` call (authorisation A1: move only). The audit is `completed` before Handbook starts.

## Alternatives

| Option                              | Why not                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| Separate `HandbookWorkflow` binding | More `wrangler*.jsonc` and runtime edits                   |
| Keep the hook before finalize       | Results delayed; Handbook-phase trouble can fail the audit |

## Consequences

- One upstream line moved; `fork/UPSTREAM-EDITS.md` row updated.
- Upstream post-phase steps (render-credit settle) now run after Handbook; local only, no billing in self-hosted mode.
- "Audit completed" no longer implies "Handbook finished"; recovery (ADR-027) keys interrupted Handbook runs off the run row, not the audit status.

## Verification

- Unit: every `finalizeAudit` step (first `multipage-checks`) runs before `handbook-setting-v1`.
- E2E (test mode): `audit.completedAt < handbook.finishedAt`; audit page shows results while the Handbook run is `running`.
