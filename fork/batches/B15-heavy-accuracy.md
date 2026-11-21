# B15 — Handbook accuracy (§9 items #0–#4) · HEAVY (SINGLE: Opus 5.5)

Spec: `fork/ACCURACY.md` (read fully first). Also read: `fork/DEPENDABILITY.md` §9, `fork/reports/B13.md` (F-R8-1, runs 3–4), `fork/MAINTENANCE.md` M3, `fork/FORK.md`.

Rules:

- [Ken 2026-11-21] Runs before B16; the M5-review start rule is waived. Items #5–#12 are a later batch.
- `fork/fixtures/audits/salonvata.com-app-vs-semrush-2026-11-19.md` missing → WO for #1 is `BLOCKED-KEN`; continue every other WO.
- B13 rules still apply: `ops maint on` at the start of every run, secrets, test mode, ops verbs.

## R1 — Coverage gap (#0) + work orders

1. Work orders WO-B15-000 … 004 and 090 in `fork/work-orders/` (template `fork/templates/WO.md`, Class: HEAVY); rows in `fork/queue.md`.
2. #0: list the URLs the site audit crawled and the Handbook did not read for salonvata (latest full audit on the test project, or a fresh CLI run); classify; fix any missing status-200 page; AT0.

Checkpoint.

## R2 — Golden (#1) and baseline

Source file present → loop M3 → `salonvata.com.expected.yaml`, triage, baseline score (AT1). Absent → `BLOCKED-KEN`, record a baseline CLI run anyway (for AT5's caught ≥ baseline once the golden lands).

Checkpoint.

## R3 — Design #2–#4

ADR-031 (probe path, budgets, UA retest, finding vs info), contract addition (1.9.0), BadGEO pages.

Checkpoint.

## R4 — Build #2, #3, #4

AT2–AT4, BadGEO 0 / 0.

Checkpoint.

## R5 — Exit

WO-B15-090: AT5, AT6, `fork/reports/B15.md`, `fork/BASELINE.md`, tag handbook-v3.4.0, STATE → `done`; B16 stays on `hold` until Ken says go [Ken 2026-11-21].
