# B9 — Full-read build · LIGHT (SINGLE: Opus 5.5)

Input: `fork/queue.md` (WO-B9-\*), `fork/FULL-READ.md`, ADR-018…021, contracts 1.5.0, `fork/reports/B8.md`.

## Executor protocol

- Same as `fork/batches/B2-light-deterministic.md` § "Executor protocol (all LIGHT batches)", steps 0–8.
- Every WO adds or updates BadGEO page(s) + unit tests; BadGEO must stay 0 missing / 0 unexpected.
- LLM WOs: tests use recorded fixtures; live calls only in acceptance commands, within the WO's stated spend cap.
- Live audits: one at a time (Supabase pool). Never source or read `.env.local` in the agent shell; use scripts that load their own config (`handbook-audit.ts`, `run-local.sh`). A step that still needs secrets in the shell → BLOCKED-KEN for that acceptance step only.
- No new npm dependencies (B6: `pnpm add` refused); implement in-repo. Unavoidable → ESCALATE.
- Bot-UA and escalation probes: only against whyracingevents.com, ryanmscottsdale.com, bluetreefunding.com, BadGEO; respect safety stops (FULL-READ §4).

## Expected order

022 → 021 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 031 → 008 → 009 → 028 → 010 → 011 → 012 → 013 → 014 → 027 → 029 → 030 → 019 → 020 → 015 → 016 → 017 → 018 → 025 → 023 → 024 → 026 → 090.
(Queue + staged workflow first: every later WO runs on the new runtime and cannot exhaust the Supabase pool.)

## Exit

1. All WO-B9-\* `done` (or `BLOCKED-KEN` with reason).
2. WO-B9-090 report in `fork/reports/B9.md`: BadGEO, goldens (3) per-finding verdicts, judge eval, extraction eval, perf (60/200/1000), cost per site, escalations fired.
3. STATE: B9 done → B10; commit + push.
