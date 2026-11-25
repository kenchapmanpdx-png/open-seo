# B23 — External source review fixes (Perplexity 2026-11-24, verified) · HEAVY (SINGLE: Opus 5.5)

Runs after B22 (STATE order B22 → B23). Inputs: this file, `fork/work-orders/WO-B23-00{1-5}.md`, `fork/adr/ADR-034-s1-scope-indexable.md`, `fork/adr/ADR-037-ai-crawler-block-severity.md`, `fork/reports/B21.md`, `fork/reports/B22.md` (grade-spread), `fork/ACCURACY.md` §0, `fork/FORK.md`, `fork/handbook/` (read-only).

## Why

- [Ken 2026-11-24] A Perplexity static review of `ken/main` was verified line by line against the source at `f1ce14b1` and Google's documentation (Project doc `seo-app-v2-perplexity-review-verified_2026-11-24_2110.md`). Ken asked to queue the accepted fixes.
- [Ken 2026-11-24] Target state: "not checking things it shouldn't", focused on what matters for SEO / GEO. Two checks cap the grade at 39 for conditions Google documents as optional or as normal practice (WO-B23-001, 002).
- Verification was a source read: no test, no run. Every WO starts with a red case that proves the defect before any fix.

## Rules

- [Ken 2026-11-21] Delegated: choose the documented default, record it in `fork/reports/B23.md` with "For Ken: say X to revert".
- B20 prevention rule on every WO: red case (failing test at the public entry point or BadGEO page with an `ITEM:Sx` expectation, output saved to `fork/runs/b23/<wo>-red.txt`) → class fix at the one derivation point → guard shown failing on the pre-fix tree → rerun → replay.
- **This batch changes severities** (001, 002, 004): grades may move. `S1_CAP`, the scoring formula, the registry, `fork/handbook/` and `fork/research/` are not touched. Decision record: ADR-038 (addendum to ADR-034), written by WO-B23-001.
- A BadGEO or golden expectation that moves is updated with a note in `_expect.json` history / the report, never silently. A cap that disappears on a golden is allowed only when every S1 code behind it is a finding this batch lowers; list the codes per site.
- Replay after every WO: BadGEO 0 / 0, GoodGEO 0, finding-contract gate passes, eight goldens caught Δ ≥ 0, every added / removed / re-graded finding listed in `fork/reports/B23.md` with its WO. `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`. Update the WO's `fork/queue.md` row in the same commit.
- ACCURACY.md §0: fork paths only, no `CONTRACTS_VERSION` bump, no schema or migration change, stored evidence for every finding.
- B13 rules: `ops maint on` first, secrets, ops verbs. Never ask Ken.
- A red case that does not reproduce (the source moved after `f1ce14b1`, or the read was wrong) → mark the WO `done` with note "not reproduced", quote the evidence in the report, change nothing.

## Work orders

| WO         | Item                                                                                   | Detail                           |
| ---------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| WO-B23-001 | P3-04: a missing canonical alone is S3, not S1 (no cap)                                | `fork/work-orders/WO-B23-001.md` |
| WO-B23-002 | P3-15 / P9-05: named-group gaps judged by crawl outcome, not rule text; S3 "intended?" | `fork/work-orders/WO-B23-002.md` |
| WO-B23-003 | Crawl robots verdict uses path + query string                                          | `fork/work-orders/WO-B23-003.md` |
| WO-B23-004 | Hreflang: x-default is advice (S4); PASS states what was verified; P3-25 PASS wording  | `fork/work-orders/WO-B23-004.md` |
| WO-B23-005 | P4-06: "year in heading" wording, past years only, fix text that clears the finding    | `fork/work-orders/WO-B23-005.md` |
| WO-B23-090 | Exit                                                                                   | below                            |

Depends: 001–005 independent; 090 after all. Order 001 → 002 → 003 (grade effect first).

## Verified, not queued

AGENTS.md: edge cases found only by reading the code are flagged, not ticketed. Take one up only when a run shows it.

| Claim                                                                                                                                                          | State at `f1ce14b1`                                                                                             | Tag         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| `canonical-form.ts` `formKey` lower-cases the path: two real case-distinct self-canonical pages share a key, a link to one reads "non-canonical URL form" (S1) | Real, rare. Fix when seen: skip the pair when the linked href is itself a crawled indexable self-canonical page | SUPPORTED   |
| `site-crawl.ts` `crawl`: first-seen redirect pushes stub + destination after one cap check; `maxPages` overshoots by 1, `coverage.read` counts the stub        | Real, off by one                                                                                                | SUPPORTED   |
| `canonical-form.ts` `decodedKey` turns `+` into a space in paths; URLs differing only by `+` vs `%20` are accepted as one page                                 | Real, rare; suppresses a finding                                                                                | SUPPORTED   |
| `crawlSecondPass` does not expand a frontier from the pages it fetches                                                                                         | Real; ADR-021 design, budget-bound                                                                              | SUPPORTED   |
| P3-25 judges variants by one sitewide contract                                                                                                                 | No store has shown a false flag                                                                                 | SPECULATIVE |
| SUPP-25 (links through 302 / 303 / 307) overstates                                                                                                             | Kept: S3, SUPP-only, never scored (ADR-020); Google does not treat a temporary redirect as a canonical signal   | SUPPORTED   |
| `crawlSecondPass` admits excluded URLs                                                                                                                         | Refuted: `engine/render-pass.ts` filters `handbookExcluded` before the call                                     | SUPPORTED   |
| An unassessed run grades F                                                                                                                                     | Fixed by WO-B21-001 (`notGradedReason`). Left: pages read but every item excluded stores F 0; no known path     | SPECULATIVE |

## Handbook conflicts (recorded, not resolved here)

- WO-B23-001 vs handbook §10 "every indexable page is self-canonical": handbook rule, Google recommendation. The finding stays; only its severity changes.
- WO-B23-002 vs handbook §18 group-matching rule: the mistake §18 names (a named `Allow: /` group dropping the `*` rules) is real; the app cannot tell it from deliberate per-crawler policy.
- Handbook wording is Ken's (old Project). `fork/reports/B23.md` lists both under "For Ken".

## WO-B23-090 Exit

- `fork/reports/B23.md`: per WO table (red case · class fix · guard · rerun), decisions with "For Ken" and revert phrases, replay diff table, grade before / after per golden and field-test site with the S1 codes removed.
- Rerun `grade-spread.ts` (WO-B22-002) and put the before / after table in the report.
- Tag `handbook-v3.12.0`. STATE per protocol 6: next batch none → `status: done`; `needs_ken:` lists BLOCKED-KEN rows.
