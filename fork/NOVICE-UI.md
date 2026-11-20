# NOVICE-UI — B14 spec (simpler layout for a novice)

Spec for batch B14 (`fork/batches/B14-heavy-novice-ui.md`). Approved by Ken 2026-11-20 02:02 MST ("do that along with the changes we discussed"): proposal of 2026-11-19 (option A, all six changes), every `A#` in §6 is a `[Ken]` decision.
Runs after B13 (`fork/DEPENDABILITY.md`) and builds on its WO-B13-014 parts (`RunFullAuditButton`, `ForkHealthChip`, cap notes, banner reasons) and its E2E harness (`ops e2e`).
Legend: VERIFIED = read in code or the live app. INFERRED = reasoned, not observed.

## 0. Goal and rules

- Goal: Ken enters a site, gets one plain-English list of what fails on SEO, GEO and AEO, ranked by what to fix first. Keyword, rank, GSC / GA4, backlink and AI-search features stay; they move into clear groups.
- Same look: existing shadcn components, no visual redesign, no new npm dependency.
- [Ken] No approval stops. The SEO / GEO / AEO tags are drafted by rule (§4) and shipped; Ken may edit them later (`fork/RUNBOOK.md` says how). Never `status: needs-ken` except STATE protocol rule 2.
- Nothing removed: every page reachable before B14 is reachable after it.
- Codes (S1–S4, F23, P7-09, OPEN, BLOCKED, Tier, Mode, phases) stay in the data and appear only under "Details".
- `FORK.md` and `fork/DEPENDABILITY.md` §5 constraints apply (secrets, ops verbs, test mode, maintenance flag, dual dialect).

## 1. Problems (Ken, 2026-11-19; app walk-through)

| #   | Problem                                                                                                                                                                                                                                                | Where                                                                                  | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------- |
| N1  | Two separate audits: "Site Audit" (basic crawl) and "Handbook" (the real SEO / GEO / AEO check, only after a Site Audit, off by default)                                                                                                               | Site Audit, Handbook                                                                   | VERIFIED |
| N2  | Build jargon on result pages: S1–S4, F-codes, item ids, OPEN, BLOCKED, Tier, Mode, phases                                                                                                                                                              | `src/client/features/handbook/*`                                                       | VERIFIED |
| N3  | Findings not grouped by SEO / GEO / AEO; the registry has no such tag (fields: `id, phase, text, refs, tags, class, secondaryClasses, automatable, severityDefault, severitySource, evidence`; `tags` holds tier / audit / review / gate / buildPhase) | `registry.json`, `registry-supp.ts`                                                    | VERIFIED |
| N4  | 15 sidebar items in 5 groups; three "Prompt" pages; 7 sub-pages inside Handbook                                                                                                                                                                        | `src/client/navigation/items.ts`                                                       | VERIFIED |
| N5  | Site Audit says rendering needs a Context.dev key; Ken's full check already renders pages with the local browser helper                                                                                                                                | `src/client/features/audit/launch/LaunchFormCard.tsx` (self-hosted `FieldDescription`) | VERIFIED |
| N6  | The dashboard does not lead to "check my site"                                                                                                                                                                                                         | `src/client/features/dashboard/DashboardPage.tsx`                                      | VERIFIED |

## 2. Changes (work orders)

| WO         | Change                                                                                                                                    | Fixes      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| WO-B14-001 | SEO / GEO / AEO tags for every registry and SUPP item + category scores                                                                   | N3         |
| WO-B14-002 | Plain words + glossary in every Handbook view                                                                                             | N2         |
| WO-B14-003 | Fix List page (run results) + CSV / document export + checkboxes                                                                          | N1, N2, N3 |
| WO-B14-004 | "Check a site" page: one button runs Site Audit + full check, shows progress, lands on the Fix List; works for a site with no project yet | N1         |
| WO-B14-005 | Sidebar regrouped; AI Search pages under one tabbed page (fallback in §5)                                                                 | N4         |
| WO-B14-006 | Dashboard "Your top 5 fixes" card + corrected rendering message                                                                           | N5, N6     |
| WO-B14-090 | Exit: checks, live check through the new page, screenshots, report                                                                        | —          |

Order: 001 → 002 → 003 → 004 → 005 → 006 → 090 (data, then words, then the page that uses both).

### WO-B14-001 — Tags and category scores

- Create `src/server/features/handbook/registry-tags.json` (`{ "<itemId>": ["SEO" | "GEO" | "AEO", …] }`, every registry and SUPP id present; `[]` = process item), `fork/scripts/registry-tags-draft.ts` (applies §4 rules + its override list, writes the JSON; `--check` exits 1 when the JSON differs), test `registry-tags.test.ts` (every id covered, only the three values, no duplicates).
- Contracts (fork, additive, `CONTRACTS_VERSION` 1.7.0 → 1.8.0): report JSON gains `categoryScores: { SEO: number | null; GEO: number | null; AEO: number | null }`; each finding gains `categories: ("SEO" | "GEO" | "AEO")[]` = union of its items' tags.
- Category score = mean of `ITEM_SCORE` (PASS 1, PARTIAL / LIMITED 0.5, OPEN 0; BLOCKED / NA / DEFERRED excluded) over applicable items carrying the tag, × 100, rounded; capped at `S1_CAP` (39) when an open non-LLM S1 finding carries the tag (same rule as the overall score); `null` with no applicable item. Overall score and grade unchanged.
- Computed where the report is built (`buildReport` / `scoreRun` from WO-B13-008); no schema change.
- Report (`fork/reports/B14.md`): full tag table (id, phase, short text, tags, rule that set it).
- Tests: score math (all PASS → 100; one OPEN of two → 50; S1 cap; no items → null); finding categories = union.

### WO-B14-002 — Plain words

- Create `src/client/features/handbook/labels.ts` (one map, used everywhere) and a small glossary tooltip component.

| Code                | Shown as                        | Hover text                                               |
| ------------------- | ------------------------------- | -------------------------------------------------------- |
| OPEN                | Needs fixing                    | The check found a problem on the site.                   |
| PARTIAL             | Partly done                     | Some pages pass, some don't.                             |
| LIMITED             | Limited fix                     | Only partly fixable from the site itself (reason shown). |
| BLOCKED             | Couldn't check                  | The app could not run this check; reason shown.          |
| NA                  | Doesn't apply                   | Not relevant to this kind of site.                       |
| DEFERRED            | Later                           | Checked in a later step.                                 |
| PASS                | OK                              | No problem found.                                        |
| S1                  | Must fix                        | Hurts rankings or AI visibility now.                     |
| S2                  | Should fix                      | Clear improvement; fix after the must-fixes.             |
| S3, S4              | Nice to have                    | Small gain.                                              |
| LLM-sourced finding | AI-judged                       | Found by the AI reviewer; never lowers the grade.        |
| Tier T1–T4          | Site size / type (Details only) | —                                                        |
| Mode                | Check type (Details only)       | —                                                        |

- Apply in `FindingsTable.tsx`, `HandbookRunPage.tsx`, `HandbookRunsPage.tsx`, `ScoreCard.tsx`, `RunProgress.tsx`, `CopyQualityPanel.tsx`, `ScaledContentPanel.tsx`; codes move under a "Details" disclosure.
- Stage names in progress: crawl → "Reading pages", render → "Opening pages in a browser", axe → "Accessibility check", lighthouse → "Speed test", map / reduce → "AI review", checks → "Running checks", report → "Writing the report".
- Test: `labels.ts` covers every `ITEM_STATUSES` value and `S1`–`S4`.

### WO-B14-003 — Fix List page

- The run page (`/p/$projectId/handbook/$runId`) opens on a new default view "Fix list"; today's views stay under a "Details" tab. The Handbook index (`/p/$projectId/handbook`) shows the latest completed run's Fix List on top, then run history (label "Past checks").
- Layout, top to bottom:
  1. Header: site, date, "Overall: <grade>", three score tiles SEO / GEO / AEO (`null` → "—"), the B13 cap note and provisional reason when present, "Check again" (WO-B13-014 start logic).
  2. "Must fix (n)", "Should fix (n)", "Nice to have (n)": one row per finding: checkbox · category chips · plain title · page count · expand → "Why it matters" (`detail`), "How to fix" (`fix`), pages (first 20 + "show all"), "Details" (codes, item ids, evidence links).
  3. "Couldn't check (n)": BLOCKED items with their reason in plain words.
  4. Filter chips: All / SEO / GEO / AEO.
- Ordering within a group: non-AI-judged first, then by page count descending.
- Checkboxes: browser `localStorage` key `fork:fix-done:<runId>` (wrapped in try/catch; storage failure = no persistence, no error). Checked rows move to the bottom of their group, struck through.
- Exports (buttons): CSV (`priority, categories, title, how_to_fix, pages_count, pages` with up to 50 URLs joined by spaces) generated in the browser; "Document" = the existing client report export.
- Tests: grouping by severity, AEO filter, CSV columns and escaping (commas, quotes, newlines).

### WO-B14-004 — "Check a site"

- New route `src/routes/_app/p/$projectId/handbook/check.tsx` → `src/client/features/handbook/CheckSitePage.tsx`.
- Form: website (prefilled with the project's site), size choice "Whole site (up to 500 pages)" (default) / "Quick (50 pages)", "Include the full SEO / GEO / AEO check" (default on; on saves the project's Handbook setting `enabled: true` through `updateHandbookSettings`), one "Check" button.
- Site of another domain: use the existing project for that domain if one exists (`getProjects`), else create one through `createProject`; then continue in that project.
- Start: existing `startAudit` server function (`maxPages`, `renderJavaScript: false`, schema-default `lighthouseStrategy`). Disabled with the reason when health says the database is down; warns when the browser helper or AI key is missing (WO-B13-014 rules).
- Progress (same page): step 1 "Reading the site" (audit crawl %), step 2 "Full check" (Handbook stages, WO-B14-002 names). Site Audit results link appears as soon as step 1 completes (WO-B13-009 order). Finished → go to the Fix List.
- Tests: domain match → same project; new domain → create called once; start payload values.

### WO-B14-005 — Sidebar

- Create `src/client/navigation/forkNav.ts` exporting `getForkNavGroups(projectId, all, aiNavItem)`; one hook in upstream `getProjectNavGroups` (A12) returns its result when non-null.

| Group                  | Items (label shown)                                                           | Target                                                     |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Overview               | Dashboard                                                                     | `/p/$projectId`                                            |
| Check & Fix            | Check a site · Fix list · Site Audit (basic crawl)                            | `/handbook/check` · `/handbook` · `/audit`                 |
| My Search Data         | Google Search Console · Rank Tracking · Local SEO                             | `/search-performance` · `/rank-tracking` · `/local-seo`    |
| Keywords & Competitors | Keyword Research · Saved Keywords · Domain Overview · Backlinks               | `/keywords` · `/saved` · `/domain` · `/backlinks`          |
| AI Search              | AI Search                                                                     | `/handbook/ai-search` (§5)                                 |
| More                   | Handbook extras · Reports · Context · Agent setup · anything not placed above | `/handbook/overview` · `/reports` · `/context` · `/ai` · — |

- Upstream items the fork map does not know (future upstream pages) go to "More" automatically, so nothing disappears after a rebase.
- Test: every `/p/$projectId/*` item of the upstream list appears exactly once in the fork groups; an unknown item lands in "More".

### WO-B14-006 — Dashboard card + rendering message

- `src/client/features/handbook/TopFixesCard.tsx`: latest completed run's first 5 Must / Should fixes (plain titles, category chips) + "See full fix list"; no run → "Check your site" button to `/handbook/check`. One hook line in `DashboardPage.tsx` (A13), first card in the grid.
- Upstream `LaunchFormCard.tsx` self-hosted rendering message (A14), text only: "Site Audit can't run JavaScript on this install. You don't need it for the full check: the Fix List check opens every page in the browser helper on this PC." Keep the setup-guide link, relabelled "Optional: set up Context.dev".
- Test: card with no runs shows the button; with a run lists ≤ 5 rows in Must → Should order.

### WO-B14-090 — Exit

1. Session-end checks vs `fork/BASELINE.md`; upstream diff lists only logged edits (A12–A14 + route files).
2. BadGEO quick 0 / 0 (labels and tags must not change verdicts); CLI goldens ×3 no LLM: caught Δ 0.
3. Live: `ops testmode on`; one check started through "Check a site" (25 pages, test project) by the harness (`--via check-page`, added here) → lands on the Fix List; scores, groups, export and checkbox verified in the browser; `ops testmode off`.
4. Screenshots (Playwright) of Dashboard, Check a site (form + progress), Fix List (top + expanded row), Details tab, sidebar → `fork/runs/b14/` and listed in the report.
5. `ui-smoke.mjs` extended to the new routes: 0 problems.
6. `fork/reports/B14.md`; `fork/RUNBOOK.md` § "Fix List" (what each label means; how to change a tag: edit the override list in `registry-tags-draft.ts`, run it, commit); tag `handbook-v3.3.0`; STATE → `status: done`, `current_batch: MAINT`.

## 3. Words used in the UI

- Use: check, fix, page, site, "Needs fixing", "Couldn't check", "Must / Should / Nice to have", "AI-judged".
- Never in the default view: S1–S4, F-codes, item ids, OPEN / BLOCKED / PARTIAL, tier, mode, phase, collector, sidecar, stage names.
- Never: AI-detector or authorship wording (FORK.md).

## 4. Tag rules (WO-B14-001 draft)

Handbook phases (handbook §P0–§P11): P0 intake, P1 audit baseline, P2 architecture + rendering, P3 crawl + index, P4 page templates, P5 content + facts, P6 structured data + entity, P7 performance + media, P8 accessibility + security + compliance, P9 AI / GEO access, P10 launch + indexing + measurement, P11 monitor + maintain.

| Rule                                                                                                              | Tags                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2, P3, P4, P7, P8, P10                                                                                           | SEO                                                                                                                                                       |
| P5                                                                                                                | SEO, AEO                                                                                                                                                  |
| P6                                                                                                                | SEO, GEO, AEO                                                                                                                                             |
| P9                                                                                                                | GEO                                                                                                                                                       |
| P0, P1, P11, REVIEW                                                                                               | `[]` (process items: listed under "General", outside the three scores)                                                                                    |
| Item text mentions answer, FAQ, question, snippet, "first answer", speakable, HowTo                               | + AEO                                                                                                                                                     |
| Item text mentions AI, LLM, GPTBot, ClaudeBot, PerplexityBot, llms.txt, citation, entity, sameAs, knowledge graph | + GEO                                                                                                                                                     |
| SUPP items                                                                                                        | rules above on their text; `class` decides when the text is silent (CRAWL / HEADERS / ROBOTS → SEO; JSONLD → SEO, GEO, AEO; LLM content items → SEO, AEO) |

- Overrides: listed in the draft script with a one-line reason each; the report shows which rule set every tag.

## 5. AI Search page

- Route `src/routes/_app/p/$projectId/handbook/ai-search.tsx`, tabs "Track AI answers" (Prompt Tracking), "Find AI questions" (Prompt Research), "Ask AI engines" (Prompt Explorer), `?tab=` in the URL.
- Each tab renders the same feature component its upstream route renders, with the same setup gates and search params (import only; upstream routes unchanged).
- Fallback, decided per tab: a tab whose page cannot run inside the fork route without editing upstream code (loader, search schema or navigation tied to its own route) becomes a link card to the upstream page. All three fall back → no tab page; the "AI Search" group holds the three upstream pages under the plain names above. Record the outcome in the report.

## 6. Authorisations (Ken, 2026-11-20)

| #   | Authorisation                                                                                                                     | Limit                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| A12 | Upstream `src/client/navigation/items.ts`: import + hook in `getProjectNavGroups` returning `getForkNavGroups(...)` when non-null | ≤ 3 lines                      |
| A13 | Upstream `src/client/features/dashboard/DashboardPage.tsx`: import + `<TopFixesCard />`                                           | ≤ 2 lines                      |
| A14 | Upstream `src/client/features/audit/launch/LaunchFormCard.tsx`: self-hosted rendering message text                                | text of one `FieldDescription` |
| A15 | New route files `src/routes/_app/p/$projectId/handbook/check.tsx`, `ai-search.tsx` + regenerated `src/routeTree.gen.ts`           | additive                       |
| A16 | Contracts 1.7.0 → 1.8.0 (additive: `categoryScores`, finding `categories`)                                                        | additive only                  |
| A17 | Live checks: ≤ 2 test-mode audits of `https://salonvata.com/` in the B13 test project; LLM ≤ $0.50                                | —                              |

Every upstream edit gets a row in `fork/UPSTREAM-EDITS.md`.

## 7. Risks and residual weaknesses

SUPPORTED

- N1–N6 seen in code and in the app (2026-11-19 walk-through).
- No SEO / GEO / AEO field exists in the registry today (N3).

SPECULATIVE

- Tag rules are a judgment call; some checks matter to more than one area, so multiple tags are allowed and scores overlap.
- Category scores are simple pass shares; they are not comparable with other tools' scores.
- AI Search tabs may fall back to link cards (§5) depending on how tightly the upstream pages bind to their routes.
- Checkbox state lives in one browser; another browser or a cleared cache starts unchecked.
- Effort ≈ 3–5 h unattended after B13.
- Two more small upstream hooks (A12, A13) and one text edit (A14) add to the weekly rebase surface.
