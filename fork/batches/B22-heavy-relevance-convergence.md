# B22 — Relevance, grade spread, convergence rule · HEAVY (SINGLE: Opus 5.5)

Runs after B21 (STATE order B21 → B22). Inputs: `fork/reports/B21.md`, `fork/FIELD-TESTS.md` + `fork/reports/field-*.md` (verdict tables), `fork/MAINTENANCE.md` M6, `fork/ACCURACY.md` §0, `fork/FORK.md`, `fork/handbook/` (read-only).

## Why

- [Ken 2026-11-18] A check belongs in the app only if it affects Google rankings, SEO or GEO. Nothing enforces this: 129 registry items + 26 SUPP rules carry no recorded search or AI effect; the fix list shows S3 / S4 items together as "nice to have" (24 on a 5-page site, mobilepetgroomingaz.com 2026-11-24).
- [Ken 2026-11-24] "Where we need to be": no misses vs Semrush on ranking-relevant issues, no errors, nothing checked that should not be, efficient. "Done" has no definition yet; two field-test rounds ran, none closed all three conditions.
- Larger sites ran in B18 / B19 (aircorheatingcooling.com app 238 pages vs Semrush 23, nwpersonaltraining.com 131 vs 60, valentinecoffeeco.com 61 vs 20) with **scopes that did not match**: the comparisons were not apples to apples, the rule Ken set 2026-11-24.

## Rules

- [Ken 2026-11-24] Delegated: choose the documented default, record it in `fork/reports/B22.md` with "For Ken: say X to revert".
- B20 prevention rule on every WO that fixes a defect (WO-B22-003): red case → class fix at the one derivation point → guard shown failing on the old tree → rerun → replay. Measurement WOs (002, 005) and the effect map (001) have a guard, not a red case.
- **Scoring is not touched.** Registry, `S1_CAP`, formula, `fork/handbook/`, `fork/research/` stay as they are. Anything that would change a grade is a report line for Ken ("For Ken: say 'hygiene out of grade' …"), not a code change.
- ACCURACY.md §0: fork paths only, additive report-only contract fields, **no `CONTRACTS_VERSION` bump** (sidecar health check needs an exact match; `contracts/version.ts` B19 note), no schema or migration change, no upstream edit.
- Replay after every WO touching checks, report or fix list: BadGEO 0 / 0, GoodGEO 0, eight goldens caught Δ ≥ 0 and grades Δ 0, `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`. Update the WO's `fork/queue.md` row in the same commit.
- B13 rules: `ops maint on` first, secrets, ops verbs. Never ask Ken.
- Semrush: never from autopilot or a sub-agent. Round 3 (WO-B22-004) is run by Ken's Project chat with the Semrush connector (≤ 2 concurrent crawls, polls ≥ 10 min apart, projects deleted after); the build half runs on the CSV it commits.

## Work orders

| WO         | Item                                                                                          | Detail                           |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| WO-B22-001 | Effect map: every check says what search or AI effect it has; hygiene-only S3 / S4 folds away | `fork/work-orders/WO-B22-001.md` |
| WO-B22-002 | Grade-spread report: which items fail on nearly every site                                    | `fork/work-orders/WO-B22-002.md` |
| WO-B22-003 | Field-test ledger counts come from the verdict table, never stored twice                      | `fork/work-orders/WO-B22-003.md` |
| WO-B22-004 | Round 3: three larger sites with matched scope (chat-side Semrush half)                       | `fork/work-orders/WO-B22-004.md` |
| WO-B22-005 | Convergence rule: definition of "done", `fork/reports/convergence.md`                         | `fork/work-orders/WO-B22-005.md` |
| WO-B22-006 | Fix-list ordering from Search Console / GA4 (waits for Ken's Google sign-in)                  | `fork/work-orders/WO-B22-006.md` |
| WO-B22-090 | Exit                                                                                          | below                            |

Depends: 001, 002, 003, 005 independent. 004 after B21 exit, 001 and 005. 006 after Ken connects Google. 090 after 001, 002, 003, 005 only: BLOCKED-KEN 004 / 006 do not hold the batch (STATE protocol 4).

## WO-B22-090 Exit

- `fork/reports/B22.md`: per WO table (what changed · guard · replay diff), decisions with "For Ken", the effect-map counts (items per effect), grade-spread findings with proposals for Ken, convergence table as of exit.
- Replay: every golden's finding list unchanged (effect map and ledger fix change presentation only); fix-list default-visible count per site before / after in the report.
- Tag `handbook-v3.11.0`. STATE per protocol 6: next batch none → `status: done`; `needs_ken:` lists BLOCKED-KEN rows (WO-B22-004 round 3 needs the Project chat; WO-B22-006 needs Ken's Google sign-in).
