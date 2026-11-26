# B25 — Precision fixes from the app-only audit (10 causes) · HEAVY (SINGLE: Opus 5.5)

Runs after B24 (STATE order B24 → B25). Inputs: this file, `fork/work-orders/WO-B25-001.md` … `WO-B25-010.md`, `fork/reports/B21.md`–`B24.md`, `fork/adr/ADR-037-ai-crawler-block-severity.md`, `fork/ACCURACY.md` §0, `fork/FORK.md`. Audit notes: `fork/reports/precision-audit-2026-11-25.md` (local, not committed; each WO carries the evidence it needs).

## Why

- [Ken 2026-11-25] Precision audit of app-only findings (findings Semrush did not report) on the five in-app reruns of 2026-11-26 UTC (audits `a6af196e` nwpersonaltraining.com, `f590a4e7` love4pawsrescue.com, `907d0a17` theogdenver.com, `cacb82a9` bluebonnetroofs.com, `24413df1` mobilepetgroomingaz.com; build after `e47513e9`).
- 50 findings checked against the live pages (one request per URL): 43 true, 6 false positive, 1 unverifiable; the 10 AI-judged findings held against their rubrics. Verified outside the sample: P4-01 brand suffix (love4paws), P9-01 bot refusal not reproduced (nwpt Googlebot), P5-08 phone text variants (nwpt).
- [Ken 2026-11-25, chat review] WO-B25-010 added: the `data:`-placeholder gap that WO-B25-001 only recorded.
- [Ken 2026-11-25] Amendment before the build: every cause is checked against the stored snapshots of every other site where the same check fired (no new fetches). Each WO has a "Cases" table: per site same cause / different cause / true finding. The fix covers all known cases, and every true case is a guard.

## Rules

- [Ken 2026-11-21] Delegated: choose the documented default, record it in `fork/reports/B25.md` with "For Ken: say X to revert".
- B20 prevention rule: red test at the public entry point first (shown failing on the pre-fix tree, output saved to `fork/runs/b25/wo<NNN>-red.txt`) → class fix at the one derivation point → guard → replay.
- A fix must not hide a true finding: each WO's "Cases" table names the true cases its guards keep open. Two listed exceptions change what is reported on purpose: WO-B25-008 (bots that cannot be tested from our IP no longer count toward P9-01 severity; ADR-037 itself unchanged) and WO-B25-009 step 3 (adds the §7 E.164 `tel:` rule as written).
- ACCURACY.md §0: fork paths only, no `CONTRACTS_VERSION` bump, no schema or migration change, stored evidence for every finding. A fix that needs a contract field → `ESCALATE`, do not bump.
- No change to `fork/handbook/`, `fork/research/`, registry severity defaults, ADR-037 classes or scoring weights.
- Replay: BadGEO 0 / 0, GoodGEO 0, finding-contract gate passes, eight goldens caught Δ ≥ 0 and grades Δ 0 unless the change is listed with its WO. `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`.
- B13 rules: `ops maint on` first, secrets, ops verbs. Never ask Ken.
- Red case does not reproduce live (site changed) → keep the unit red test from the stored evidence, ship the fix, note "live not reproduced".

## Work orders

| WO         | Item                                                                                                                                      | Detail                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| WO-B25-001 | SUPP-20: `<noscript>` tracking pixel reported as a broken image; skip pixel-pattern `<noscript>` images only                              | `fork/work-orders/WO-B25-001.md` |
| WO-B25-002 | P4-01: keyword tagline taken as the brand suffix; titles carrying `og:site_name` flagged                                                  | `fork/work-orders/WO-B25-002.md` |
| WO-B25-003 | P3-11: real 404 template flagged as a live page because its title equals a bare-brand title                                               | `fork/work-orders/WO-B25-003.md` |
| WO-B25-004 | P3-03: `/index.html` whose chain ends in 404 reported as a live duplicate                                                                 | `fork/work-orders/WO-B25-004.md` |
| WO-B25-005 | P5-17: About page found only by "about" in the path (`/our-story/`, `/our-team` missed)                                                   | `fork/work-orders/WO-B25-005.md` |
| WO-B25-006 | P0-03: BentoBox (`getbento.com`) not recognised as a builder                                                                              | `fork/work-orders/WO-B25-006.md` |
| WO-B25-007 | SUPP-03: copies hidden per layout (page `<style>` rules, `aria-hidden`, inline) counted as repeated text                                  | `fork/work-orders/WO-B25-007.md` |
| WO-B25-008 | P9-01: name only bots whose refusal reproduced; bots untestable from our IP listed "not tested"                                           | `fork/work-orders/WO-B25-008.md` |
| WO-B25-009 | P5-08: phone link-text variants alone open the finding; test `tel:` href formats and §7 E.164 instead                                     | `fork/work-orders/WO-B25-009.md` |
| WO-B25-010 | SUPP-20 / image budget: lazy images with a `data:` placeholder `src` never probed; use `data-src` (also `data-lazy-src`, `data-original`) | `fork/work-orders/WO-B25-010.md` |
| WO-B25-090 | Exit                                                                                                                                      | below                            |

## WO-B25-090 Exit

- `fork/reports/B25.md`: per WO red case · cause · class fix · guard (true cases kept open) · re-derived "Cases" table from stored snapshots; decisions with revert phrases; replay table.
- In-app re-check (Check a site, full check on; Quick, except Whole site for nwpersonaltraining.com) of theogdenver.com (`/press/?p=`, `/event/` left out), love4pawsrescue.com, bluebonnetroofs.com, and nwpersonaltraining.com with the 2026-11-26 leave-out list plus `/wp-content/uploads/`: quote each fixed finding as gone or narrowed, the P9-01 severity and listed bots on nwpersonaltraining.com, the SUPP-20 / image-weight rows and resource-cap note added by WO-B25-010 on nwpersonaltraining.com, and the grade.
- Rerun `grade-spread.ts`; list any grade change with its WO (expected: nwpersonaltraining.com loses the P9-01 S1 cap). Tag `handbook-v3.14.0`.
