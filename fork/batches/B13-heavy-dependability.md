# B13 — Dependability: database, browser helper, recovery, watchdog · HEAVY (SINGLE: Opus 5.5)

Spec: `fork/DEPENDABILITY.md` (read fully first). Also read: `fork/STATE.md`, `fork/FORK.md`, `fork/MAINTENANCE.md` M1, `fork/RUNBOOK.md`, `fork/adr/ADR-001`, `ADR-011`, `ADR-018`, `fork/reports/B12.md`.

Rules:

- [Ken] No approval stops. Never set `status: needs-ken` except STATE protocol rule 2 (model guard). Unclear → the spec's default, else the most conservative reversible option; record it in `fork/reports/B13.md`.
- [Ken] Authorisations A1–A11 (`fork/DEPENDABILITY.md` §5) are granted. Every other upstream edit: not allowed in B13 (ESCALATE row in `fork/queue.md`, continue).
- No schema, migration or contract change (`CONTRACTS_VERSION` stays 1.7.0). No new npm dependency. Do not edit `fork/scripts/autopilot.sh` or `fork/scripts/start-build.sh` (they run this batch).
- Secrets: never source, read or print `.env*`. Database, systemd, Docker and journal access only through `bash fork/scripts/run-local.sh …` (the `ops` verbs once WO-B13-001 exists).
- From WO-B13-001 on, every run starts with `bash fork/scripts/run-local.sh ops maint on`.
- Live audits, test mode and LLM spend: `fork/DEPENDABILITY.md` §5 (A8, A9) and §7 live-audit plan. Count every live audit and its `llmCostUsd` in `fork/reports/B13.md`; stop starting audits at $4.
- A WO that cannot pass because of a runtime fact the spec marks SPECULATIVE (e.g. loopback blocked, journal unavailable) → record the measured fact, mark the WO `ESCALATE` or `BLOCKED-KEN` as the spec says, continue with the next WO.

## R1 — Rebase, decide, write work orders

1. MAINTENANCE M1 (rebase onto `upstream/main` when it has new commits; checks vs `fork/BASELINE.md`).
2. Re-verify against the current code the facts the WOs build on: spec §2 E2, E3, E10, E12, E13, E25, E26, E27, E28, E29, E30. A fact no longer true → adjust the affected WO, record it.
3. ADRs (template `fork/templates/ADR.md`): ADR-025 database pool mode · ADR-026 Handbook after finalize (amends ADR-001) · ADR-027 recovery (heartbeat, reconciler, terminate, re-run) · ADR-028 supervision (ops verbs, test mode, health, watchdog, Windows kit).
4. Work orders WO-B13-001 … 016 and 090 in `fork/work-orders/` (template `fork/templates/WO.md`, Class: HEAVY; Files, Spec, Acceptance copied from spec §8); rows in `fork/queue.md` with the `Depends` column from spec §7.
5. WO-B13-001 (ops verbs, test mode), WO-B13-002 (in-app E2E harness + test project; its first run is expected to fail as the spec says).

Checkpoint.

## R2 — Evidence

WO-B13-003. Fill-in while audits run: WO-B13-006, WO-B13-008.

Checkpoint.

## R3 — Database

WO-B13-004 with gate G1 (test mode off), then WO-B13-005 only where its triggers fire. Fill-in: WO-B13-012, WO-B13-015.

Checkpoint.

## R4 — Browser helper in the app

WO-B13-007.

Checkpoint.

## R5 — Audit first, then recovery

WO-B13-009, WO-B13-010.

Checkpoint.

## R6 — Health and watchdog

WO-B13-011, WO-B13-013 (fault tests F1–F5 with `ops maint off`, then `ops maint on`).

Checkpoint.

## R7 — UI and weekly self-test

WO-B13-014, WO-B13-016.

Checkpoint.

## R8 — Exit

WO-B13-090.

## Exit

- Done criteria D1–D9 (`fork/DEPENDABILITY.md` §1) met, or each miss recorded with its measured cause and a `BLOCKED-KEN` / `ESCALATE` row.
- `fork/reports/B13.md`: evidence, measurements, gate results, defaults chosen, upstream edits applied / not applied, live-audit count, LLM spend, what Ken can do (K1–K4).
- Session-end checks green vs `fork/BASELINE.md` (refresh it); tag `handbook-v3.2.0`; push with tags.
- STATE: B13 row `done`; `current_batch: B14`, `batch_file: fork/batches/B14-heavy-novice-ui.md`, `next_action: B14 R1`; SINGLE → continue into B14.
