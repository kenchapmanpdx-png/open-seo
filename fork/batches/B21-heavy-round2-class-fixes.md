# B21 — Round-2 field-test class fixes · HEAVY (SINGLE: Opus 5.5)

Inputs: `fork/reports/field-love4pawsrescue.com-2026-11-24-manual.md`, `fork/reports/field-mobilepetgroomingaz.com-2026-11-24-manual.md`, `fork/reports/field-aweandorderorganizing.com-2026-11-24-manual.md`, `fork/reports/defect-zero-pages-grade-a-2026-11-24.md`, `fork/reports/B20.md` (prevention rule), `fork/MAINTENANCE.md` M6, `fork/ACCURACY.md` §0, `fork/FORK.md`.

## Rules

- [Ken 2026-11-24] "Let's get those fixes in queue make sure It's methodical and systematic so that they work flawlessly into our build and on the next sites they check." Ken delegates decisions: choose the documented default, record it in `fork/reports/B21.md` with a one-line "For Ken: say X to revert".
- B20 prevention rule on every WO, in this order: (1) **red case**: failing test at the public entry point, or BadGEO page with an `ITEM:Sx` expectation; red output saved to `fork/runs/b21/<wo>-red.txt` and quoted in the report. (2) **class fix** at the one place the class is derived (never per screen, per site, per URL). (3) **guard**: a test, source scan or exit gate in `pnpm test` / the batch exit, shown failing on the pre-fix tree. (4) **rerun** the red-case site. (5) **replay** (below).
- Replay, after every WO: BadGEO 0 / 0, GoodGEO 0, finding-contract gate (`golden-score`, `badgeo-run`) passes, eight goldens caught Δ ≥ 0. Every finding added or removed on a golden or field-test site is listed in `fork/reports/B21.md` with its WO. A change no WO explains is a defect: fix before moving on.
- Fixture scope: a fix is proven on a minimal fixture (BadGEO page or unit fixture) first, on the live red-case site second. A fix that passes only on the red-case site is not done.
- ACCURACY.md §0 carries over: fork paths only, contract changes additive and report-only (WO-B21-001: optional `score.notGradedReason`; ADR-036). Do NOT bump `CONTRACTS_VERSION` (sidecar health check needs an exact match, `collectors/sidecar-config.ts`; the sidecar does not use the field; B19 precedent in `contracts/version.ts`), no schema or migration change, stored evidence for every finding, LLM-judged findings never gate. No change to `fork/handbook/`, `S1_CAP`, the scoring formula or `fork/research/`.
- B13 rules: `ops maint on` first, secrets, test mode, ops verbs. Never ask Ken.
- After every WO: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check` vs `fork/BASELINE.md`; update the WO's row in `fork/queue.md` (status, commit) in the same commit as the work.
- New field-test sites follow the size gate in `fork/MAINTENANCE.md` M6 (added by WO-B21-090): app Details lacks "Site audit stopped at its 50-page limit" AND Semrush finishes < 50 pages.

## Work orders

| WO         | Item                                                                                                              | Detail                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| WO-B21-001 | A run that read no page is never graded and never says "every check passed" (every consumer, one derivation)      | `fork/work-orders/WO-B21-001.md` |
| WO-B21-002 | P7-07: probed static files with no caching header are reported; no PASS wording on "0 hashed assets"              | `fork/work-orders/WO-B21-002.md` |
| WO-B21-003 | Sitemap `<loc>` scheme (http vs https) is one finding, owned by P3-19; P3-12 / P3-13 compare scheme-insensitively | `fork/work-orders/WO-B21-003.md` |
| WO-B21-004 | AI-crawler-only block is S2, not S1; one report per bot evidence; every bot classified                            | `fork/work-orders/WO-B21-004.md` |
| WO-B21-090 | Exit: report, M6 size-gate rule, round-2 ledgers, reruns + replay, tag `handbook-v3.10.0`                         | below                            |

Depends: 001–004 independent; 090 after all.

## WO-B21-090 Exit

- `fork/reports/B21.md`: table per WO (red case · class fix · guard · site rerun), decisions with "For Ken", replay diff table.
- `fork/MAINTENANCE.md` M6: add the size gate (rule above) as a precondition for any new field-test site; sitemap ≲ 20 `<loc>`, no link trap, cap note absent, Semrush crawl < 50 pages.
- Ledgers: `pnpm exec tsx fork/scripts/field-test.ts <site> --external fork/fixtures/external/<site>-semrush-2026-11-24.csv` for love4pawsrescue.com, mobilepetgroomingaz.com, aweandorderorganizing.com (sidecar up); 0 open rows each. A run on a later day opens a new dated ledger with all rows open (B20 papercut): run on the build day, keep the closed one.
- Reruns in-app (Check a site, Quick, 50 pages, live LLM): zmklaw.com ("Not graded"), aweandorderorganizing.com (P7-07 S4 finding, no `unlisted` double count, P9-01 S2 uncapped), love4pawsrescue.com, mobilepetgroomingaz.com (no unexplained diff vs the 2026-11-24 manual reports), samanthaco.ca, bluebonnetroofs.com, theogdenver.com (0 check errors, 0 open ledger rows).
- Eight goldens live, sequential (B20 exit procedure); `bluetreefunding.com` cap ("Bots get a different response") may change under WO-B21-004: expected-grade change allowed only with a ledger note naming the bots.
- aweandorderorganizing.com keeps 10 "couldn't check" items (browser helper HTTP 403 from Cloudflare): not a defect, not queued; the NOT FINAL banner is the correct output. Record in the report.
- Tag `handbook-v3.10.0`; STATE per protocol 6 (next batch B22).

## Not queued (flagged, SPECULATIVE until verified in a run)

- Page cap (50) consumed by link-trap 404s, query-string variants and PDF 301 variants (`defect-zero-pages-grade-a-2026-11-24.md` § Related). Verify on a run before opening a WO (AGENTS.md: no WO for an edge found only by reading).
- Semrush "Unminified JavaScript and CSS files" (91 on aweandorderorganizing.com, connector returns 50): mapped to skip in `SEMRUSH_MAP`; no ranking effect established.
- aweandorderorganizing.com Cloudflare 403 to the render sidecar: platform setting of an unaffiliated site; no bypass.
