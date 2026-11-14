# B2 — Deterministic build-out · LIGHT (SINGLE: Opus 5.5 · SPLIT: Sonnet 5.5)

WPs 13–18. Input: `fork/queue.md` (WO-B2-\*), contracts `CONTRACTS_VERSION` from B1, `fork/reports/B1.md`.

## Executor protocol (all LIGHT batches)

0. SINGLE mode (BLUEPRINT §1.0): same protocol; resolve ESCALATE items inline instead of skipping.
1. Take the first `todo` WO in `fork/queue.md` whose `Depends` are all `done`. Mark `doing`.
2. Read the WO fully + every file it lists under "Read first". Touch only files it lists.
3. Implement → tests → BadGEO page(s) → run the WO's acceptance commands.
4. Pass → mark `done` + commit hash. Fail after 2 fix attempts, ambiguity, or a needed contract/schema/upstream change → mark `ESCALATE` + one-line reason; revert partial edits to contract-adjacent files; move on.
5. Every 3 WOs: `pnpm types:check`, `pnpm lint`, affected tests. New failures vs `fork/BASELINE.md` → fix before the next WO.
6. Never edit: `src/server/features/handbook/contracts/**`, DB schema/migrations, upstream files, `fork/handbook/`, `fork/fixtures/audits/`.
7. Early stop only if ESCALATE blocks ≥25% of remaining WOs (BLUEPRINT §1.2). If lever L2 is ON, first try `heavy-escalation` on a blocker with ≥3 dependents.
8. Checkpoint per BLUEPRINT §1.3.

## First run only (SPLIT mode)

- If `levers: L2=on`: spawn `heavy-escalation` once, confirm it reports Opus from this Sonnet session; not Opus → set L2=off in `STATE.md`, remove `.claude/agents/heavy-escalation.md`.

## Expected order

CRAWL → HEADERS → SCHEMA → ROBOTS/BOTFETCH remaining → render sidecar (K3) + `fork/sidecar/compose.yaml` (Docker Desktop, 127.0.0.1) → RENDER → PERF → A11Y → findings UI → harness runs.

## Exit

1. Queue exhausted (all `done` or `ESCALATE`).
2. `fork/scripts/badgeo-run.ts`: 100% for implemented rules.
3. `fork/scripts/golden-score.ts` on both golden sites → `fork/reports/B2-golden.md`.
4. CLI audit of `extra_site` from `STATE.md` (skip if blank) → `fork/runs/`.
5. Full checks: no new failures vs `BASELINE.md`.
6. `fork/reports/B2.md`: done / escalated (with reasons) / golden headline / timing per audit.
7. `STATE.md` → B3. Commit + push. batch end per `STATE.md` protocol step 6 (SINGLE: continue · SPLIT: SWITCH banner).
