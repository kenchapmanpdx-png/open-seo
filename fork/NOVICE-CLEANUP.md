# NOVICE-CLEANUP — B16 spec (4 known gaps + visual restyle)

Spec for batch B16 (`fork/batches/B16-heavy-novice-cleanup-restyle.md`). Decided 2026-11-21 00:10 MST under Ken's delegation ("make the pending decisions"): record in `fork/project-docs/seo-geo-app-handoff-supplement-for-repo-2026-11-21-0010.md` §10. Written 2026-11-21 from code at `ken/main` `82373b8`.
Runs after B14 (`fork/NOVICE-UI.md`) and before B15 accuracy (`fork/DEPENDABILITY.md` §9).
Legend: VERIFIED = read in code on 2026-11-21. INFERRED = reasoned, not observed. Nothing here was seen in the running app.

## 0. Goal and rules

- Goal: the pages Ken uses (Dashboard, Check a site, Fix list, Handbook) read as plain English end to end, and the app looks different from upstream in a way Ken chose.
- [Ken] After B14 Ken expected the look to change as well as the function and saw no change. B14 kept upstream colors, fonts and dark theme on purpose (`fork/NOVICE-UI.md` §0 "Same look"). B16 lifts that rule for the theme layer only.
- Fork paths only: `fork/`, `src/client/features/handbook/`, `src/server/features/handbook/`. No new upstream edit. No new npm dependency (fonts: system stacks only). No contract, schema or migration change.
- Nothing removed: every page and button reachable before B16 is reachable after it.
- Data unchanged: statuses, severities, findings, grades and the CSV rows stay as they are. B16 changes how they are shown.
- Codes (item ids, S1–S4, F-codes, collector names) appear only under "Details" (`fork/NOVICE-UI.md` §3 word rules still apply).
- One Ken decision: the look (§4). Everything else ships without an approval stop.
- `FORK.md`, `fork/DEPENDABILITY.md` §5 constraints apply (secrets, ops verbs, test mode, maintenance flag).

## 1. Problems

| #   | Problem                                                                                                                                                                                                                                                                                  | Where                                                                                                 | Status                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| G1  | Handbook page header holds a row of technical buttons: "Overview", "AI traffic", "Bing", "AI visibility (own keys)", "Backlinks (Common Crawl)", "Agency" (links to `handbook/overview`, `ai-traffic`, `bing`, `ai-visibility-byok`, `backlinks-cc`, `agency`) + the "Copy rules" dialog | `src/client/features/handbook/HandbookRunsPage.tsx`, `CopyRulesDialog.tsx`                            | VERIFIED                                                               |
| G2  | "Couldn't check (N)" lists every blocked item as its id in monospace + the raw runner note, e.g. `P2-05 render unavailable: collector not configured.`                                                                                                                                   | `FixList.tsx` (blocked section), `fixList.ts` `blockedItems`                                          | VERIFIED                                                               |
| G3  | Yellow "Grade provisional" alert. Text: "Browser checks skipped: <reason>." No date, no next step. An old run made without the browser helper keeps showing it                                                                                                                           | `FixList.tsx`, `ScoreCard.tsx`, `fixList.ts` `provisionalReason`; export text in `export/markdown.ts` | VERIFIED (code). Live cause on Ken's run: INFERRED (supplement §1, §3) |
| G4  | Many "Nice to have" rows repeat one title ("Images without dimensions"), one per page group                                                                                                                                                                                              | `fixList.ts` `buildFixGroups` (one row per finding)                                                   | VERIFIED (code path). Row counts on Ken's run: not re-read             |
| G5  | Look is upstream's: tokens in `src/client/styles/app.css` under `[data-theme="openseo"]` and `[data-theme="openseo-dark"]` (neutral grays, blue primary `oklch(50% 0.12 262)`, radius 0.5rem); theme switch in `src/client/lib/theme.ts`                                                 | upstream files (not edited)                                                                           | VERIFIED                                                               |

## 2. Changes (work orders)

| WO         | Change                                                       | Fixes |
| ---------- | ------------------------------------------------------------ | ----- |
| WO-B16-001 | Handbook page: one "More tools" menu with plain names        | G1    |
| WO-B16-002 | "Couldn't check": plain reasons, grouped, one next step each | G2    |
| WO-B16-003 | Provisional note: date, cause in plain words, "Check again"  | G3    |
| WO-B16-004 | Fix list: rows with the same title shown as one row          | G4    |
| WO-B16-005 | Fork theme layer + 3 looks + screenshots for Ken             | G5    |
| WO-B16-006 | Apply the chosen look; polish the four fork pages            | G5    |
| WO-B16-090 | Exit: checks, live check, screenshots, report                | —     |

Order: 005 (screenshots go to Ken first, so the pick can arrive while the rest builds) → 001 → 002 → 003 → 004 → 006 → 090.

### WO-B16-001 — Handbook page tools

- Replace the button row with one "More tools" menu (existing shadcn dropdown). Default view of the page: the runs list and the "Check a site" entry point only.
- Menu entries, each with a one-line description: "All checks at a glance" (overview), "AI visitors" (ai-traffic), "Bing data" (bing), "AI answers with your own keys" (ai-visibility-byok), "Backlinks (free index)" (backlinks-cc), "All my sites" (agency), "Writing rules for a builder" (Copy rules dialog).
- Final names: R1 opens each page and adjusts the label to what the page does; names go in `labels.ts` and `fork/RUNBOOK.md`.
- Routes unchanged. Sidebar unchanged (B14 groups stay).
- Acceptance: no button on the Handbook page uses a route name or build term; every former target is reachable in ≤ 2 clicks; `labels.test.ts` covers the names.

### WO-B16-002 — "Couldn't check"

- New pure function in `fixList.ts`: blocked items → groups by cause. Cause comes from the note prefix (`render unavailable`, `… not configured`, `… unavailable`, missing key names such as CrUX, sitemap or robots fetch failures). R1 lists every distinct note prefix the runner can write (`src/server/features/handbook/**`, grep `note:` and `BLOCKED`) and maps each to: plain reason · what Ken can do · whether it is expected.
- Default view: one line per cause, e.g. "Needs the browser helper — 21 checks. Start it, then Check again." / "Needs a free Google key (CrUX) — 1 check. Optional." Count in the heading stays the total.
- "Details" expander per cause: item id + raw note, as today.
- Unknown prefix → cause "Could not be checked (other)"; raw note under Details. Never hide an item.
- No status or data change; the CSV is unchanged.
- Acceptance: with a report fixture holding the runner's note prefixes, the default view shows 0 item ids and 0 raw notes; totals equal `blockedItems(report).length`; unknown-prefix test passes.

### WO-B16-003 — Provisional note

- First, on Ken's PC: re-run the salonvata check with the browser helper up (supplement §3: the audit Ken saw predates WO-B13-007 or ran without the helper). Record whether the note still shows.
- Text change (banner only; the stored reason and the export wording stay):
  - Title: "This grade is not final".
  - Body: "Checked on <run date> without the browser helper, so pages that need JavaScript were not fully checked: <reason>." + button "Check again" (existing `RunFullAuditButton`).
  - Run older than the newest completed run for the same site → add "A newer check exists" with a link to it.
- Acceptance: unit test on the text builder (reason present / absent, newer run present / absent); helper up → no banner on a fresh run (live, exit step 3).

### WO-B16-004 — Repeated rows

- Display only: in `buildFixGroups`, findings in the same priority group with the same title are shown as one row: title · "N page groups" · merged page list under the expander (each original finding kept as a sub-row with its own evidence and checkbox state).
- Checkbox on the merged row checks all sub-rows. Top-5 card counts a merged row once.
- CSV unchanged (one row per finding).
- B15 item 5 (T12 / T16, finding-level grouping in the engine) is separate. When it lands, merged rows with one member render as plain rows; no code removal needed.
- Acceptance: fixture with 15 same-title findings → 1 row, 15 sub-rows; done-state round trip; `topFixes` test.

### WO-B16-005 — Theme layer and three looks

- New fork files: `src/client/features/handbook/fork-theme.css`, `forkTheme.ts`.
- Mount without an upstream edit: `ForkHealthChip.tsx` (fork file, already rendered in `AppShell.tsx`, VERIFIED) imports the CSS and calls `applyForkLook()` once, which sets `data-fork-look="<look>"` on `<html>`.
- CSS overrides the upstream tokens only, scoped `:root[data-fork-look="a"][data-theme="openseo"] { … }` and the `openseo-dark` pair (higher specificity than upstream's selector, so import order does not matter). No component CSS, no `!important`.
- Look value: constant `FORK_LOOK` in `forkTheme.ts` (`upstream` | `a` | `b` | `c`), default `upstream` until Ken picks. `?look=a|b|c` on any URL previews a look for that tab (session only; used for the screenshots).
- Pages without the app shell (public share page `sharePage.tsx`, widgets `widgets/main.tsx`) keep the upstream look.
- Three looks (token sets; R1 may tune values for contrast, not character):

| Look | Character                       | Light: background / card / text                                        | Primary                       | Sidebar                                  | Radius   | Type                                                   |
| ---- | ------------------------------- | ---------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- | -------- | ------------------------------------------------------ |
| A    | Clean and bright, green "go"    | `oklch(98.5% 0.003 160)` / white / `oklch(22% 0.02 200)`               | `oklch(52% 0.13 160)`         | white, soft border                       | 0.75rem  | system sans, base 16px, headings semibold              |
| B    | Warm paper, calm indigo         | `oklch(97% 0.012 85)` / `oklch(99.5% 0.005 85)` / `oklch(24% 0.02 60)` | `oklch(45% 0.14 275)`         | `oklch(94% 0.015 85)`                    | 0.625rem | system serif headings, system sans body, base 16px     |
| C    | Bold dashboard, dark by default | `oklch(96% 0.005 250)` / white / `oklch(20% 0.03 255)`                 | `oklch(62% 0.19 45)` (orange) | `oklch(24% 0.03 255)` dark in both modes | 0.375rem | system sans, base 15px, headings bold, tabular numbers |

- Each look also sets `--ring`, `--sidebar-*`, `--chart-1…5`, `--success`, `--warning`, `--destructive` and the dark pair. Status colors keep their meaning (green pass, amber warn, red fail) in all looks.
- Contrast: body text ≥ 4.5 : 1, large text and UI borders ≥ 3 : 1, in light and dark (axe via the sidecar, exit step 4).
- Screenshots (Playwright, `b14-shots.mjs` extended): Dashboard, Check a site, Fix list (top + one expanded row), Handbook page × looks upstream / A / B / C × light / dark → `fork/runs/b16/looks/`; a contact sheet `looks.html` beside them. `fork/runs/` is gitignored: list the file names in the report and tell Ken where they are (`fork/RUNBOOK.md` § "Pick a look").
- Then: `look_choice:` line in `fork/STATE.md`. Empty → WO-B16-006 is `BLOCKED-KEN`; other WOs continue (STATE protocol rule 8).

### WO-B16-006 — Apply the look, polish fork pages

- Set `FORK_LOOK` to `look_choice`. Keep the other two token sets in the CSS (switch = one constant).
- Fork pages only (`CheckSitePage`, `FixList`, `ScoreCard`, `TopFixesCard`, `HandbookRunsPage`, `HandbookRunPage`): score boxes colored by grade band; Must / Should / Nice group headers with a colored marker and count; more space between rows; one clear primary button per page.
- No layout change to upstream pages beyond what the tokens do.
- Rollback: `FORK_LOOK = "upstream"` (one line, fork file).

### WO-B16-090 — Exit

1. Session-end checks vs `fork/BASELINE.md`; upstream diff lists only logged edits (no new row expected).
2. BadGEO quick 0 / 0; CLI goldens ×3 no LLM: caught Δ 0 (display changes must not move verdicts).
3. Live: `ops testmode on`; browser helper up; one check through "Check a site" (25 pages, test project) by the harness → Fix list: no "not final" note, "Couldn't check" shows causes without ids, repeated titles merged, CSV row count = finding count; `ops testmode off`.
4. axe on Dashboard, Check a site, Fix list, Handbook page in the chosen look, light and dark: 0 contrast violations.
5. `ui-smoke.mjs`: 0 problems. Screenshots after → `fork/runs/b16/after/`.
6. `fork/reports/B16.md`; `fork/RUNBOOK.md` § "Pick a look" and § "Couldn't check" (cause table); tag `handbook-v3.4.0`; STATE → `status: done`, `current_batch: MAINT`.

## 3. Words used in the UI

- `fork/NOVICE-UI.md` §3 applies unchanged.
- Add: "browser helper" (never sidecar, collector, render), "not final" (never provisional in the default view), "More tools".

## 4. The look (Ken's one decision)

- Options: A, B, C (§2 WO-B16-005) or keep upstream.
- How: Ken opens `fork/runs/b16/looks/looks.html`, or adds `?look=a` / `b` / `c` to the app URL, then says the letter. The session that hears it writes `look_choice: <letter>` in `fork/STATE.md`.
- A pick made earlier from mock-ups (chat, 2026-11-21) counts: `look_choice` may already be set when B16 starts; WO-B16-005 still produces the screenshots.

## 5. Authorisations (delegated decision, 2026-11-21)

| #   | Authorisation                                                                                       | Limit                    |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| A18 | Visual restyle through a fork-owned theme layer (token overrides) mounted from `ForkHealthChip.tsx` | no upstream file edited  |
| A19 | Live checks: ≤ 2 test-mode audits of `https://salonvata.com/` in the B13 test project; LLM ≤ $0.50  | —                        |
| A20 | Display-level merge of same-title rows in the Fix list                                              | no engine or data change |

Not authorised: any upstream edit, contract change, new dependency, web fonts, removal of a page.

## 6. Risks and residual weaknesses

SUPPORTED

- G1, G2, G3 (code), G4 (code path), G5 read in code at `82373b8`.
- Theme tokens are CSS variables on `[data-theme]`; `ForkHealthChip` is mounted in the app shell.

SPECULATIVE

- A CSS import inside a fork component applies app-wide once that chunk loads; a first-paint flash of the upstream look is possible before it does. If visible: accept, or ask Ken for a one-line upstream import (not authorised here).
- Upstream components that use fixed colors instead of tokens will not follow the look.
- The three looks are token sets written without the running app; values may need tuning for contrast.
- The provisional note on Ken's run comes from an old run; unconfirmed until the re-run in WO-B16-003.
- Note-prefix list for WO-B16-002 is not enumerated here; R1 does it.
- Same-title merge may join findings that differ in cause but share a title; sub-rows keep each one's evidence.
- Effort ≈ 3–5 h unattended. Exit steps 2–5 need Ken's PC (app, database, browser helper).
- B16 commits land on `ken/main`; if the M1 force-push happens after B16 starts, they are ported the same way as the 2026-11-21 prep (`ken/rebase-v0.1.31-m1`).
