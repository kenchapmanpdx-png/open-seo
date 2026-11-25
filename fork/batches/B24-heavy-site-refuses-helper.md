# B24 — Site refuses the browser helper (live red, aweandorderorganizing.com) · HEAVY (SINGLE: Opus 5.5)

Runs after B23 (STATE order B23 → B24). Inputs: this file, `fork/work-orders/WO-B24-001.md`, `fork/adr/ADR-030-*.md` (novice wording, "not final" banner), `fork/reports/B21.md`–`B23.md`, `fork/ACCURACY.md` §0, `fork/FORK.md`, `fork/sidecar/`.

## Why

- [Ken 2026-11-25] Post-B23 in-app re-check of aweandorderorganizing.com (runs `hb-76a1d2fa…`, `hb-d604e7d9…`, both 2026-11-25, build `928f765d354e`): grade D 46.4 shown as "This grade is not final … without the browser helper (it returned an error)"; fix list "Needs the browser helper — 10 checks. Start it, then Check again." Two runs, same result. The stored 2026-11-24 field run was non-final too.
- Details tab raw reason: `render HTTP 403 (no-JS 403)` (`collectors/sidecar-collectors.ts`). The helper was running (it rendered samanthaco.ca between the two runs; `ops status` sidecar running; Lighthouse render-blocking rows exist for this site). The site refuses the helper's render request.
- Novice harm: the app tells Ken to start a helper that is already running, and "Check again" can never make the grade final. The grade silently omits 10 checks on every run of this site.
- Project doc: `seo-app-v2-post-b23-rechecks_2026-11-25_1400.md`.

## Rules

- [Ken 2026-11-21] Delegated: choose the documented default, record it in `fork/reports/B24.md` with "For Ken: say X to revert".
- B20 prevention rule: red case (live store of this site, plus a test at the public entry point) → class fix at the one derivation point → guard shown failing on the pre-fix tree → rerun → replay.
- ACCURACY.md §0: fork paths only, no `CONTRACTS_VERSION` bump, no schema or migration change, stored evidence for every finding. Sidecar change → rebuild both sidecars (`start-build.sh` does it), contracts version unchanged.
- Never scrape or evade: no CAPTCHA solving, no challenge bypass, no rotating identities. A browser-standard user agent is allowed only if the handbook / ADRs already permit it for render; otherwise record the site as refusing and stop there.
- Replay: BadGEO 0 / 0, GoodGEO 0, finding-contract gate passes, eight goldens caught Δ ≥ 0 and grades Δ 0 unless the change is listed with its WO. `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`.
- B13 rules: `ops maint on` first, secrets, ops verbs. Never ask Ken.
- Red case does not reproduce (site stopped refusing) → mark `done`, note "not reproduced", still ship the wording fix if a unit red case shows it.

## Work orders

| WO         | Item                                                                                             | Detail                           |
| ---------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| WO-B24-001 | Site refuses the browser helper (render HTTP 4xx): name the cause, correct action, finality rule | `fork/work-orders/WO-B24-001.md` |
| WO-B24-090 | Exit                                                                                             | below                            |

## WO-B24-090 Exit

- `fork/reports/B24.md`: red case · cause · class fix · guard · rerun; decisions with revert phrases; replay table; in-app re-check of aweandorderorganizing.com (grade, final or not, banner and fix-list wording quoted).
- Rerun `grade-spread.ts`; note any site whose non-final flag changed. Tag `handbook-v3.13.0`.
