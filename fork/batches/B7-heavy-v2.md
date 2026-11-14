# B7 — v2 + maintenance · HEAVY (SINGLE: Opus 5.5 · SPLIT: Opus 5.5 | Fable 5.2)

WPs 43–44.

## R1 — Rebase + review + hardening (WP43)

1. `git fetch upstream`; new commits → rebase + refresh baseline; none → skip.
2. Review B6 with `REVIEW-CHECKLIST.md`; close escalations.
3. Cross-feature: AI traffic + AI visibility + handbook findings on one project dashboard; cost per project per month estimate.
4. Performance: audit time + memory on a 500-page site; fix hotspots.
5. Tag `v2.0.0`.

## R2 — Maintenance setup (WP44)

1. `fork/MAINTENANCE.md`: loops M1–M3 (BLUEPRINT §9) as runnable instructions.
2. Rebase drill: simulate weekly rebase as LIGHT instructions; verify.
3. Handbook-sync drill: run `handbook-sync` against current handbook; document the update procedure (HEAVY interpret → LIGHT implement, one switch).
4. `STATE.md` → `current_batch: MAINT`, `required_model: per loop`, `status: done` (protocol step 7: `needs_ken` lists leftover `BLOCKED-KEN` items); final report `fork/reports/B7.md`; commit + push.
