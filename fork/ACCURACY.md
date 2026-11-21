# ACCURACY — B15 spec (Handbook accuracy, items #0–#4)

Spec for batch B15 (`fork/batches/B15-heavy-accuracy.md`). Written 2026-11-21 from code at `ken/main` `c5782210` (upstream v0.1.31 base after M1).

[Ken 2026-11-21] Order: accuracy before restyle. B15 runs now, B16 (`fork/NOVICE-CLEANUP.md`) after it. The §9 start rule ("loop M5 has one clean review ≥ 24 h after B14 green") is waived for B15.

Legend: VERIFIED = seen in code, reports or runs. INFERRED = reasoned, not observed.

## 0. Scope and rules

- Scope: `fork/DEPENDABILITY.md` §9 items **#0, #1, #2, #3, #4** only. The item text, backlog ids (T1, T11, T14, T15, T20) and "Needs" column there are the requirement; this file adds order, acceptance tests and limits. It does not restate them.
- Out of scope: §9 items #5–#12 move to a later batch (not scheduled). Do not start them, even where a change for #0–#4 makes one look easy; add a queue row instead.
- Fork paths only: `fork/`, `src/server/features/handbook/`, `src/client/features/handbook/`. No upstream edit (Site Audit crawl code stays upstream's; §9 "Not possible" list still holds).
- HEAVY batch: a contract addition for #2 is allowed (§9 "collector + contract addition"); additive only, ADR, `contracts_version` 1.8.0 → 1.9.0. No DB schema or migration change.
- Every new finding type has stored evidence (URL + status / header / snippet) and a BadGEO page (`fork/MAINTENANCE.md` M3 step 6). LLM-judged findings never gate.
- Live cost: CLI goldens with no LLM; in-app checks ≤ 2 test-mode audits, LLM ≤ $0.50 for the batch.
- B13 rules still apply: `ops maint on` at the start of every run, secrets, test mode, ops verbs.

## 1. Order

| Step | §9 item                      | Depends on                       | Notes                                                                                                                                                     |
| ---- | ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | #0 coverage gap              | —                                | First (§9). Produces the URL classification the other items reuse                                                                                         |
| 2    | #1 salonvata golden          | Ken's source file                | `BLOCKED-KEN` until `fork/fixtures/audits/salonvata.com-app-vs-semrush-2026-11-19.md` is pushed (not in the repo on 2026-11-21, VERIFIED). Continue #2–#4 |
| 3    | #2 resource status           | design together with #3, #4 (§9) | One ADR for #2–#4 (probe budget, UA retest, finding vs info)                                                                                              |
| 4    | #3 query-string link targets | —                                | P3-08                                                                                                                                                     |
| 5    | #4 outbound link classes     | —                                | Reuse #2's probe path                                                                                                                                     |

## 2. Known facts (salonvata.com)

- VERIFIED (`fork/reports/B13.md` F-R8-1, V3, runs 3–4): the site audit crawls 155 pages; Handbook `coverage.read` is 80 for both a 25-page and a 155-page audit, because the Handbook reads from status-200 sitemap seeds up to its own cap (E27).
- VERIFIED (§9): broken logo image used on 64 pages; un-crawled internal target `?page_id=15790`.
- Test project `af75f6d0-606a-4cac-9a3f-9bc9f94cb5e8` "B13 test – salonvata.com" (in-app checks).
- INFERRED: the 75-URL gap is mostly redirects, attachment pages and non-HTML; #0 confirms or refutes this.

## 3. Acceptance tests (salonvata golden)

Run: `pnpm exec tsx fork/scripts/handbook-audit.ts https://salonvata.com --mode AUDIT --depth full --sidecar http://127.0.0.1:4777 --out fork/runs/b15/salon-<run>` then `golden-score.ts … fork/fixtures/expected/salonvata.com.expected.yaml`. Record a **baseline score before any #2–#4 code change** (step 2 output on current code).

| AT  | Item | Pass when                                                                                                                                                                                                                                                                                            |
| --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AT0 | #0   | A coverage table in the report run lists every URL the site audit crawled that the Handbook did not read, each with one class (redirect, 404, attachment, non-HTML, unseen); 0 unclassified. Every status-200 HTML page of the crawl is read, or the report's cap note names the cap that stopped it |
| AT1 | #1   | `fork/fixtures/expected/salonvata.com.expected.yaml` exists, built through loop M3 from the source file (verbatim source; triage in `fork/reports/`); `golden-score.ts` runs on it; baseline score recorded                                                                                          |
| AT2 | #2   | One finding for the broken logo with its page count (64, or the golden's count if the site changed); HEAD → GET fallback and browser-UA retest on 403 visible in evidence; a resource that only blocks bots is not a broken-resource finding                                                         |
| AT3 | #3   | P3-08 reports the status of `?page_id=15790` (and every other un-crawled internal query-string target) with ≤ 200 probes; probe count in the report                                                                                                                                                  |
| AT4 | #4   | Dead outbound links (DNS fail, 404, 410) are findings; platform bot blocks and redirects are info only, never findings                                                                                                                                                                               |
| AT5 | all  | salonvata golden: every expectation tied to #0–#4 is caught or partial; caught count ≥ baseline. Other three goldens: caught Δ ≥ 0 vs B14 r79 / M1 2026-11-21 (20 · 23 · 23). BadGEO 0 / 0 incl. the new pages                                                                                       |
| AT6 | all  | Session-end checks green vs `fork/BASELINE.md`; one in-app test-mode run on the test project lands on the Fix List with the new findings (`ops e2e … --via check-page` PASS)                                                                                                                         |

While #1 is `BLOCKED-KEN`, AT2–AT4 are checked against the facts in §2 and BadGEO; AT1 and AT5's salonvata part stay open and the batch exit waits for them (rule: report, `status: needs-ken` only when nothing else is left).

## 4. Risks

- Probe volume (#2, #3, #4) on large sites: budgets per run, recorded in the report; over budget → cap note, not silence.
- Bot-blocked resources may look broken to the bot UA and fine to a browser: AT2's retest is the guard.
- #1's golden may contradict an existing rule; triage records it, the rule changes only through the normal M3 path.
