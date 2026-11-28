# B26 — Precision fixes 2 (wellnessforzebras.com false readings) + round 3 app half · HEAVY (SINGLE: Opus 5.5)

Runs after B25 (STATE order B25 → B26). Inputs: this file, `fork/work-orders/WO-B26-000.md` … `WO-B26-007.md`, `WO-B26-090.md`, `WO-B26-091.md`, `fork/work-orders/WO-B22-004.md`, `fork/reports/B25.md`, `fork/ACCURACY.md` §0, `fork/FORK.md`.

## Why

- [Ken 2026-11-27] Owner order "Do 1 then 2": (1) queue and build the fixes for the 7 false readings found on wellnessforzebras.com, (2) then run the app half of round 3 (WO-B22-004).
- [Ken 2026-11-26] Nothing in the checks should be up to interpretation; "it's all black or white".

## Origin

- Site: wellnessforzebras.com (React, Tailwind, Radix accordions, AOS reveal). First site of this stack the app has read.
- App audit `329ddb98`, build `handbook-v3.14.0`: 28 findings. Live verification 2026-11-26 (raw HTML of all 34 sitemap URLs, rendered checks on 3 pages): 18 TRUE, 4 FALSE POSITIVE, 2 LIKELY FALSE, 2 PARTLY TRUE, 2 NOT VERIFIED.
- Ken 2026-11-26: nothing in the checks should be up to interpretation; "it's all black or white".
- Causes below were first inferred from the site, then read against `ken/main` source on 2026-11-27. Tag per WO: CODE-CONFIRMED (line read) / CODE-LIKELY (path read, not run) / UNCONFIRMED. The red step decides. Red does not reproduce → B25 rule (keep the unit red test from stored evidence, note "live not reproduced"); cause proven wrong → fix the real cause and record it; finding proven TRUE → close the WO with no change and say so.

## Rules

- [Ken 2026-11-21] Delegated: documented default, recorded in `fork/reports/B26.md` with "For Ken: say X to revert".
- B20 prevention rule: red test at the public entry point first (failing on the pre-fix tree, output in `fork/runs/b26/wo<NNN>-red.txt`) → class fix at the one derivation point → guard → replay.
- Precision only: each WO names the true case its guard keeps open.
- ACCURACY.md §0: fork paths only; no CONTRACTS_VERSION bump, schema or migration change; stored evidence for every finding. Needs a contract field → ESCALATE, do not bump.
- No change to `fork/handbook/`, `fork/research/`, severities or scoring weights.
- Replay: BadGEO 0 / 0, GoodGEO 0, finding-contract gate, eight goldens caught Δ ≥ 0 and grades Δ 0 unless listed with its WO. `pnpm types:check`, `lint`, `test`, `format:check` vs `fork/BASELINE.md`.
- B13 rules: ops maint on first, secrets, ops verbs.
- Do not run the upstream sync (M1) during B26.
- Public repo: no personal data, no usernames, no local paths in any committed file.

## Work orders

| WO         | Item                                                                                               | Detail                           |
| ---------- | -------------------------------------------------------------------------------------------------- | -------------------------------- |
| WO-B26-000 | Housekeeping: upstream-sync (M1) policy → monthly; STATE reboot-test line                          | `fork/work-orders/WO-B26-000.md` |
| WO-B26-001 | P6-07 + SUPP FAQ "not in raw HTML": text split at character references                             | `fork/work-orders/WO-B26-001.md` |
| WO-B26-002 | P6-01 / P6-09: `alternateName` (and other text properties) given as an array rejected              | `fork/work-orders/WO-B26-002.md` |
| WO-B26-003 | SUPP-03: responsive copy hidden by utility classes (Tailwind / Bootstrap) counted as repeated text | `fork/work-orders/WO-B26-003.md` |
| WO-B26-004 | P8-02: axe contrast measured while reveal animations are still running                             | `fork/work-orders/WO-B26-004.md` |
| WO-B26-005 | P5-14: primary-action verb list lacks "join" / waitlist (step 1 may close it as TRUE)              | `fork/work-orders/WO-B26-005.md` |
| WO-B26-006 | P5-13: one unreachable connection reported as a dead link                                          | `fork/work-orders/WO-B26-006.md` |
| WO-B26-007 | LLM entity-test: "spelled two ways" passed with a spelling that is not on the page                 | `fork/work-orders/WO-B26-007.md` |
| WO-B26-090 | Exit                                                                                               | `fork/work-orders/WO-B26-090.md` |
| WO-B26-091 | Round 3 app half (closes WO-B22-004)                                                               | `fork/work-orders/WO-B26-091.md` |

Order: 000 first (housekeeping), then 001–007, then 090 (exit, tag `handbook-v3.15.0`), then 091 (after the tag).

## Residual weaknesses (from the chat, 2026-11-27)

- SUPPORTED: WO-001 and WO-007 causes are read from the code path, not run. WO-004's cause is unconfirmed (2 of 5 nodes never measured).
- SUPPORTED: WO-005 may be a true finding (mobile first screen not checked); step 1 decides.
- SUPPORTED: every red case comes from one site; no cause is confirmed on a second site.
- SPECULATIVE: WO-001 changes `markup.text`, which many checks read; word counts and LLM inputs may move on the goldens.
- SPECULATIVE: WO-003's class rule misses sites that hide copies with custom class names in an external stylesheet.
