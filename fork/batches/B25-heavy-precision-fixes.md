# B25 — Precision fixes from the app-only audit (7 false-positive causes) · HEAVY (SINGLE: Opus 5.5)

Runs after B24 (STATE order B24 → B25). Inputs: this file, `fork/work-orders/WO-B25-001.md` … `WO-B25-007.md`, `fork/reports/B21.md`–`B24.md`, `fork/ACCURACY.md` §0, `fork/FORK.md`. Audit notes: `fork/reports/precision-audit-2026-11-25.md` (local, not committed; each WO repeats the evidence it needs).

## Why

- [Ken 2026-11-25] Precision audit of app-only findings (findings Semrush did not report) on the five in-app reruns of 2026-11-26 UTC (audits `a6af196e` nwpersonaltraining.com, `f590a4e7` love4pawsrescue.com, `907d0a17` theogdenver.com, `cacb82a9` bluebonnetroofs.com, `24413df1` mobilepetgroomingaz.com; build after `e47513e9`).
- 50 findings checked against the live pages (one request per URL): 43 true, 6 false positive, 1 unverifiable. All 6 false positives are deterministic; the 10 AI-judged findings held against their rubrics. A seventh false positive (P4-01 brand suffix, love4paws) was verified outside the sample.
- Each false positive is one distinct cause → one WO. None was verified on a second site; repeats listed in each WO are SPECULATIVE until the red step checks them.

## Rules

- [Ken 2026-11-21] Delegated: choose the documented default, record it in `fork/reports/B25.md` with "For Ken: say X to revert".
- B20 prevention rule: red test at the public entry point first (shown failing on the pre-fix tree, output saved to `fork/runs/b25/wo<NNN>-red.txt`) → class fix at the one derivation point → guard → replay.
- Precision only: a fix must not hide a true finding. Each WO lists the true case its guard keeps open.
- ACCURACY.md §0: fork paths only, no `CONTRACTS_VERSION` bump, no schema or migration change, stored evidence for every finding. A fix that needs a contract field (e.g. a probe canonical) → `ESCALATE`, do not bump.
- No change to `fork/handbook/`, `fork/research/`, severities or scoring weights.
- Replay: BadGEO 0 / 0, GoodGEO 0, finding-contract gate passes, eight goldens caught Δ ≥ 0 and grades Δ 0 unless the change is listed with its WO. `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`.
- B13 rules: `ops maint on` first, secrets, ops verbs. Never ask Ken.
- Red case does not reproduce (site changed) → keep the unit red test from the stored evidence, ship the fix, note "live not reproduced".

## Work orders

| WO         | Item                                                                                          | Detail                           |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| WO-B25-001 | SUPP-20: `<noscript>` tracking pixel reported as a broken image (nwpersonaltraining.com)      | `fork/work-orders/WO-B25-001.md` |
| WO-B25-002 | P4-01: keyword tagline taken as the brand suffix; titles with the real brand flagged          | `fork/work-orders/WO-B25-002.md` |
| WO-B25-003 | P3-11: a real 404 template flagged as a live page because its title equals a brand-only title | `fork/work-orders/WO-B25-003.md` |
| WO-B25-004 | P3-03: `/index.html` whose chain ends in 404 reported as a live duplicate                     | `fork/work-orders/WO-B25-004.md` |
| WO-B25-005 | P5-17: About page found only by "about" in the path (`/our-story/` missed)                    | `fork/work-orders/WO-B25-005.md` |
| WO-B25-006 | P0-03: BentoBox (`getbento.com`) not recognised as a builder                                  | `fork/work-orders/WO-B25-006.md` |
| WO-B25-007 | SUPP-03: hidden responsive copies (`display:none`) counted as repeated text                   | `fork/work-orders/WO-B25-007.md` |
| WO-B25-090 | Exit                                                                                          | below                            |

## WO-B25-090 Exit

- `fork/reports/B25.md`: per WO red case · cause · class fix · guard (true case kept open) · rerun; decisions with revert phrases; replay table.
- In-app re-check (Check a site, full check on; Quick, except Whole site for nwpersonaltraining.com) of theogdenver.com (`/press/?p=`, `/event/` left out), love4pawsrescue.com, bluebonnetroofs.com, and nwpersonaltraining.com with the B25 leave-out list from the 2026-11-26 rerun plus `/wp-content/uploads/`: quote each fixed finding as gone or narrowed and the grade.
- Rerun `grade-spread.ts`; list any grade change with its WO. Tag `handbook-v3.14.0`.
