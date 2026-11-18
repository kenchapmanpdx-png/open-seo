# B10 — Full-read sign-off · HEAVY (SINGLE: Opus 5.5)

Read: `fork/FULL-READ.md` §9 (acceptance), `fork/reports/B9.md`, `fork/templates/REVIEW-CHECKLIST.md`.

## R1 — Rebase + review

1. Upstream rebase (skip if no new commits).
2. REVIEW-CHECKLIST over every B9 commit; plus: escalation safety stops, beacon blocking on, no form submission, P5-03 off by default, SUPP not scored, grade unchanged for `quick` depth.
3. Close every ESCALATE (contract minor bump allowed).

## R2 — Acceptance + tuning

1. Run FULL-READ §9 metrics: 3 goldens `--depth full --sidecar --llm`, BadGEO, judge eval, extraction eval, speed, cost, rerun cost, 1000-page scale.
2. Every golden `missed`/`partial` with `detectableBy` ∈ {deterministic, render, llm}: fix rule / prompt / view selection, or record the reason (site-changed, owner-only, truth-verification [Ken]).
3. Tuning allowed: rubrics, prompts, thresholds, view selection, escalation triggers. Not allowed: weakening evidence rules, scoring SUPP, external verification, checks with no effect on rankings / SEO / GEO (FULL-READ §0).
4. Repeat until §9 targets met or 3 tuning rounds; record each round.

## R3 — Repeatability, docs, release

1. Two `full` runs per golden site: grade Δ ≤ 2; report deltas.
2. Docs: RUNBOOK (depth, caps, budget, queue, storage, escalations), MAINTENANCE M3 (new field audit → expected YAML → SUPP candidates → BadGEO), `fork/coverage.md` refresh.
3. Tag `handbook-v3.0.0`; push tag.

## Exit

- `fork/reports/B10.md`: §9 table (target vs actual), remaining misses with reasons, spend per site, runtime per site.
- STATE: B10 done → B11 (`current_batch: B11`, `batch_file: fork/batches/B11-heavy-scaled-content-copy.md`, `next_action: B11 R1`); commit + push. SINGLE → continue into B11.
