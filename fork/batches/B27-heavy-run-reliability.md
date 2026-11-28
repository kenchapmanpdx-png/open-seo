# B27 — Run reliability: no failed starts, no silent caps · HEAVY (SINGLE: Opus 5.5)

Runs after B26 (STATE order B26 → B27). Inputs: this file, `fork/work-orders/WO-B27-001.md` … `WO-B27-005.md`, `WO-B27-090.md`, `fork/reports/B26.md`, `fork/reports/field-evolvedmechanical.com-2026-11-28.md`, `fork/reports/field-antiquecandleco.com-2026-11-28.md`, `fork/ACCURACY.md` §0, `fork/FORK.md`.

## Why

- [Ken 2026-11-28] A site check must be plug and play. No failed starts. Know before a run whether a limit will be hit, and know what to do when one is hit. When something fails, find the cause and fix it.

## Origin (B26 WO-091, run 108)

- evolvedmechanical.com: no audit created. `verifyWebsite` (one GET through SafeFetch) got `SocketError: other side closed`, 0 bytes, for apex and `www`. Same request with the app user-agent `Mozilla/5.0 (compatible; OpenSEO-Handbook/1.0; +https://openseo.so)` from curl: connection closed. Default curl / empty / Node user-agent: 301 → 200. The app said "did not answer. Check the spelling and that the site is online." Semrush read 114 pages of this site on 2026-11-26.
- antiquecandleco.com, audit `5cdbb86c`: sitemap 612 URLs; `/blogs/` left out → 481 in scope; the site crawl stopped at its 500-page limit; the full check read 452 pages. So ≥ 29 in-scope sitemap URLs were not read while the crawl spent slots elsewhere. The first S1 finding URL is a `/products/…?pr_prod_strat=…&pr_rec_id=…` recommendation-parameter URL (SPECULATIVE: parameter variants used the slots; confirm from the stored crawl list).
- Two limits exist and disagree: the site audit `maxPages` (500 here) and the Handbook `FULL_MAX_PAGES` 1000 / `QUICK_MAX_PAGES` 200 (`engine/depth.ts`, `services/runScope.ts`, `services/capNotes.ts`).
- The scope decision (≤ 100 URLs whole site, else leave-outs) lives in a CLI script (`fork/scripts/field-test.ts --preflight`), not in Check a site.
- wellnessforzebras.com (34 pages): P4-07, P5-06, P5-11, P5-15 BLOCKED "llm budget" with run LLM cost $0.44 against an auto budget of $0.84 (judge share 40 %). Pre-existing on `handbook-v3.14.0`.

## Rules

- [Ken 2026-11-21] Delegated: documented default, recorded in `fork/reports/B27.md` with "For Ken: say X to revert".
- B20 prevention rule: red test at the public entry point first (output in `fork/runs/b27/wo<NNN>-red.txt`) → class fix at the one derivation point → guard → replay.
- First step of every WO: confirm the cause from stored evidence or code. Cause differs from this file → fix the real cause, record it.
- Contracts: a contract field is allowed in this batch where a WO needs one (ADR + CONTRACTS_VERSION bump, both dialects, migrations numbered per repo rules). No change to `fork/handbook/`, `fork/research/`, severities or scoring weights.
- Target behaviour for every WO: a run never ends as "failed to start" or silently partial. It either completes, or completes partly and states exactly what was not read and why.
- Unaffiliated sites: read only, robots.txt obeyed, crawl pacing unchanged, no form submits, no contact.
- Replay: BadGEO 0 / 0, GoodGEO 0, finding-contract gate, eight goldens caught Δ ≥ 0 and grades Δ 0 unless listed with its WO. `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`. B13 rules. No M1 during B27. Public repo: no personal data, usernames or local paths.

## Work orders

| WO         | Item                                                                       | Detail                           |
| ---------- | -------------------------------------------------------------------------- | -------------------------------- |
| WO-B27-001 | a site that refuses the app's crawler name is still read                   | `fork/work-orders/WO-B27-001.md` |
| WO-B27-002 | the start check says what actually happened                                | `fork/work-orders/WO-B27-002.md` |
| WO-B27-003 | scope is decided before the run, inside the app                            | `fork/work-orders/WO-B27-003.md` |
| WO-B27-004 | the limit is spent on the right pages, and a hit limit is reported exactly | `fork/work-orders/WO-B27-004.md` |
| WO-B27-005 | small sites do not lose AI-judged items to the budget split                | `fork/work-orders/WO-B27-005.md` |
| WO-B27-090 | Exit                                                                       | `fork/work-orders/WO-B27-090.md` |

Order: 001 → 005, then 090 (exit: in-app runs of both round 3 sites, grade-spread, tag `handbook-v3.16.0`).

## Residual weaknesses (from the chat, 2026-11-28)

- SUPPORTED: the antiquecandleco.com cause (parameter variants taking slots) is inferred from one finding URL and the counts; WO-004 step "First" confirms or corrects it.
- SUPPORTED: reading as a browser gets past a firewall rule the site owner set for unknown crawlers; robots.txt and pacing still apply. Revert phrase in WO-001.
- SPECULATIVE: sites that fingerprint beyond the user-agent (TLS, headers) will still refuse; WO-002 then gives the exact reason and the run does not start.
- SPECULATIVE: WO-004 ordering changes which pages are read on capped goldens; findings there may move.
