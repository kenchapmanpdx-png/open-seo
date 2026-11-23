# Maintenance (after B7)

Six loops keep the fork current (BLUEPRINT §9). Each loop is a runnable checklist. Start a loop with:

`Read fork/MAINTENANCE.md and run loop M<n>.`

Rules from `fork/FORK.md` still apply: never ask Ken, record decisions, never open `.env*`, log upstream edits in `fork/UPSTREAM-EDITS.md`. In SINGLE mode every loop runs on Opus 5.5. In SPLIT mode use the Model column; a loop that needs both models switches once, at the marked step.

| Loop                | Trigger                                      | Model                    | Output                                                        |
| ------------------- | -------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| M1 Upstream rebase  | weekly                                       | LIGHT                    | `ken/main` on top of `upstream/main`, checks green            |
| M2 Handbook update  | new handbook version                         | HEAVY → LIGHT (1 switch) | registry, checks, fixtures on the new version                 |
| M3 New golden audit | each manual field audit                      | HEAVY                    | `fork/fixtures/expected/<site>.expected.yaml`, triage         |
| M4 Guide refresh    | by 2027-05-20 or a new writing-guide version | HEAVY                    | excerpts, copy-quality thresholds, copy-rules pack re-checked |
| M5 Ops review       | weekly                                       | LIGHT                    | ops status, watchdog and self-test reviewed; findings queued  |
| M6 External export  | each new external audit export (Semrush …)   | HEAVY                    | importer misses both ways → backlog rows                      |

Log every loop run as one row in the table at the end of this file.

## M1 — Upstream rebase (weekly, LIGHT)

1. `git status` is clean and on `ken/main`. Not clean → commit or stash the fork's own work first; never discard it.
2. `git fetch upstream` then `git rev-list --count HEAD..upstream/main`. `0` → log "no upstream commits" and stop.
3. Preview conflicts without touching the tree: `git merge-tree --write-tree --name-only upstream/main HEAD`. Exit 0 = clean. Otherwise it lists the conflicting files.
4. `git rebase upstream/main`. On conflict:
   - File outside fork paths (not `fork/`, not a fork feature folder) and not in `fork/UPSTREAM-EDITS.md` → take upstream's side with `git checkout --ours <file>` (during a rebase `--ours` is upstream and `--theirs` is the fork commit being replayed), `git add`, `git rebase --continue`.
   - File listed in `fork/UPSTREAM-EDITS.md` (registration hooks, `wrangler*.jsonc`, `.prettierignore`, `.claude/CLAUDE.md`, routes) → re-apply the fork's one-line edit on top of upstream's version. A hook whose surrounding upstream code changed shape → **ESCALATE**: `git rebase --abort`, add a row to `fork/queue.md` (`ESCALATE`, file, upstream commit), stop. The next HEAVY run resolves it.
   - `src/routeTree.gen.ts` → take upstream's, then regenerate (see "Route tree" below).
   - Drizzle migrations / `meta/_journal.json` (upstream added a migration with a number the fork uses) → `node fork/scripts/migration-renumber.mjs "$(git rev-parse REBASE_HEAD)"`, resolve any other file, `git rebase --continue`; the stop repeats once per fork migration. Done 2026-11-19 for upstream #1336 (see "Migration collisions" below).
5. Session-end checks: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check`. Compare with `fork/BASELINE.md`. A failure caused by upstream alone (it also fails on a clean `upstream/main` checkout) → refresh `fork/BASELINE.md` with the new count and the upstream commit. A failure in fork code → fix it if the fix is local to fork files; otherwise ESCALATE.
6. Fork regression: `pnpm exec tsx fork/scripts/badgeo-run.ts` (exit 0) and `pnpm exec tsx fork/scripts/handbook-sync.ts` (0 diffs).
7. `git diff upstream/main --stat -- . ':!fork' ':!src/server/features/handbook' ':!src/client/features/handbook'` lists only files in `fork/UPSTREAM-EDITS.md` or fork feature folders.
8. Push: `git push --force-with-lease origin ken/main` (the rebase rewrote history; `--force-with-lease` refuses if `origin` moved unexpectedly).
9. Log the run below.

Migration collisions: fork migrations always sit after upstream's. The script moves each fork migration one number up, keeps its journal `when` (databases that applied it do not apply it again), chains its snapshot to the one before it and copies in tables upstream added. After the rebase:

1. `pnpm exec drizzle-kit generate --config drizzle/sqlite.config.ts` and `--config drizzle/pg.config.ts` both print "No schema changes". Anything else (upstream changed an existing table) → **ESCALATE**.
2. Supabase: an upstream migration whose journal `when` is older than the newest applied fork migration is skipped by `pnpm db:migrate:pg`. Apply each one once: `bash fork/scripts/run-local.sh sql drizzle/pg/<file>.sql` (also re-hardens and checks). Newer ones: `bash fork/scripts/run-local.sh migrate`.
3. Local D1 (`wrangler dev` only; the fork app runs on Supabase) tracks migrations by file name: reset it (`.wrangler/state`) if it was used.

Route tree: `vite dev` regenerates `src/routeTree.gen.ts`. Without a dev server, run `@tanstack/router-generator` (version in `node_modules/.pnpm`) with `routesDirectory: ./src/routes`, then check that the `declare module '@tanstack/react-start'` Register block is still at the end of the file. Re-append it from upstream's version if the generator dropped it, then `pnpm types:check`.

## M2 — Handbook update (new handbook version)

Ken drops the new handbook into `fork/handbook/` (verbatim, never reformatted).

### HEAVY (interpret)

1. `pnpm exec tsx fork/scripts/handbook-sync.ts fork/handbook/<new file>.md`. It prints `missing`, `extra`, `text changed`, `tags/refs changed` per item, and golden expectations that name unknown ids.
2. For each diff, decide one of: registry text only · check logic change · new check · item removed (keep the id retired, never reuse it) · golden expectation update. Read the changed handbook sections, not only the §41 line.
3. Contract impact (K1–K13)? Bump `CONTRACTS_VERSION` (minor for additive fields, major for breaking ones) and write an ADR when a decision is not obvious.
4. Write one WO per change in `fork/work-orders/` (template `fork/templates/WO.md`) and add rows to `fork/queue.md`. Every WO quotes the handbook rule, names its fixture page in BadGEO, and states the status mapping.
5. Update `src/server/features/handbook/registry.json` (and `HANDBOOK_VERSION`) so `handbook-sync` reports 0 diffs against the new file. Commit.
6. SPLIT mode: switch to LIGHT here (the one switch).

### LIGHT (implement)

7. Work the queue in order: check change → BadGEO fixture page with `badgeo-expect` meta → unit test where the rule has an edge case.
8. `pnpm exec tsx fork/scripts/badgeo-run.ts` → 0 missing / 0 unexpected (with `--sidecar` when the sidecar runs).
9. Golden: rerun both sites (`handbook-audit.ts <origin> --mode AUDIT --out fork/runs/<site>/<run>`), then `golden-score.ts`. Caught count must not drop; a drop is a regression unless the expectation is `site-changed`.
10. Session-end checks as in M1 step 5, then commit and push. Scores compare only within one handbook version: note the version bump in the next client report.

## M3 — New golden audit (each manual field audit, HEAVY)

Ken adds a manual audit to `fork/fixtures/audits/` (verbatim).

1. Convert it to `fork/fixtures/expected/<site>.expected.yaml` in the format of the existing two files: each finding → `items`, `urls` (path patterns, `*` = one segment), severity, `note`; each stated pass → `passes`. Ids must exist in the registry (`handbook-sync.ts` checks this).
2. Mark each finding's `detectableBy` (deterministic · render · llm · owner-only) and drop findings outside Ken's scope (rankings, SEO, GEO) as `outside-scope [Ken]`.
3. Run the engine at full depth: `pnpm exec tsx fork/scripts/handbook-audit.ts https://<site> --mode AUDIT --depth full --sidecar http://127.0.0.1:4777 --llm --out fork/runs/<site>/<run>`.
4. `pnpm exec tsx fork/scripts/golden-score.ts fork/runs/<site>/<run>/report.json fork/fixtures/expected/<site>.expected.yaml --md fork/runs/<site>/<run>-score.md`. Target (FULL-READ §9): caught ≥ 85 %, caught + partial ≥ 95 % over `detectableBy` deterministic / render / llm.
5. Triage every `missed` and `partial`: site changed since the field audit (`note: site-changed`) · check defect (WO for LIGHT, or fix now) · rule gap in a §41 item (M2-style registry/check change) · not a §41 item but affects rankings / SEO / GEO → **SUPP candidate** (new `SUPP-nn` in `registry-supp.ts`, reported unscored; FULL-READ §6) · truth verification or owner-only (note why, `[Ken]`).
6. Every new check, SUPP rule or escalation gets a BadGEO page (`fork/fixtures/badgeo/`, `badgeo-expect` meta, linked from `/about/`, listed in `sitemap.xml`); `pnpm exec tsx fork/scripts/badgeo-run.ts` must end `missing 0 · unexpected 0`.
7. Write the triage into `fork/reports/` and the WOs into `fork/queue.md`; commit and push.

## M4 — Guide refresh (by 2027-05-20 or a new guide version, HEAVY)

Source: the writing guide excerpts in `fork/research/` (Ken replaces them; never edit their content) and `fork/SCALED-COPY.md` §2 verdicts.

1. Diff the new excerpts against the ones `fork/SCALED-COPY.md` cites (rule ids W / X / E / C / Q). List added, removed and changed rules.
2. Copy quality thresholds (`engine/copy-metrics.ts`, SCALED-COPY §4.3) change only here, and only to the guide's new value; record old → new in `fork/reports/`. Never add an authorship label or a classifier verdict on who wrote a page (SCALED-COPY §0).
3. Copy rules pack: Ken's session owns the rules in `fork/skills/copy-rules/SKILL.md`. Note rule changes the guide implies in the report for Ken; format-only fixes are allowed here.
4. After any pack edit: `pnpm exec tsx fork/scripts/copy-rules-sync.ts`, then `--check`; commit the regenerated `copy-rules.json`.
5. Re-run the copy-quality fixtures (`fork/fixtures/copy-quality/`) and BadGEO SUPP-17 / SUPP-19 pages (`badgeo-run.ts --only SUPP-17,SUPP-19`); session-end checks green.
6. Set the next due date (+6 months) in the table above and log the run below.

## M5 — Ops review (weekly, LIGHT)

Reads only; changes nothing unless a step says so. Database, systemd, Docker and journal access only through `bash fork/scripts/run-local.sh ops …`.

1. `bash fork/scripts/run-local.sh ops status`. Expected: `app_unit`, `tick_timer`, `watchdog_timer` `active`; `sidecar_container=running`; `pool_mode=transaction`; `build_failed=no`; `test_mode=off`; `maintenance=off`; `backup_age_h` ≤ 36; `backup_unit` not `failed`; `disk_free_gb` ≥ 5; `health_ok=true`; `watchdog_level=ok`. Note every value that differs.
2. Watchdog log summary for the last 7 days: `fork/runs/_ops/watchdog.log` (one line per pass and action; `fork/runs/_ops/status.json` holds the latest report, `watchdog-state.json` the restart counts). List level changes and actions (`W1`–`W9`); count restarts per target (app, sidecar). More than 3 in a week → queue row with the times. App errors: `bash fork/scripts/run-local.sh ops logs <since> <until>`.
3. Self-test: `fork/runs/_ops/selftest.json`. `ok: true` and `at` within 8 days; else read `fork/runs/_ops/job-selftest*.log`, add a queue row with the failing part (BadGEO, audit, Handbook, grade, provisional).
4. Stuck rows: health `audits.stale` > 0 → name the audit ids in the queue row (Ken's data; never delete a row in this loop).
5. Follow-up: `fork/scripts/start-build.sh` should call `fork/scripts/ops/sidecar-up.sh` for the production sidecar instead of its own steps 1–5 (B13 did not edit `start-build.sh`). Do it in the next HEAVY session that may edit that script; remove this step afterwards.
6. Log the run below (date, M5, levels seen, rows added).

## M6 — External audit export (each new Semrush / other tool export, HEAVY)

Ken adds an external tool export (Semrush Site Audit xlsx or csv: issues sheet, pages sheet or the mega export) to `fork/fixtures/audits/` (verbatim, never edited). A chat session may instead pull the same data through the Semrush connector and commit it as a long-form csv (`Issue,Page URL,Target URL`) to `fork/fixtures/external/` (verbatim after the commit); no Ken step is needed then.

Rule [Ken 2026-11-22]: every comparison is learned from. Each miss, both ways, ends with a verdict: `fixed` · `skip` (handbook reason) · `site-changed` · `tool-wrong` (evidence) · `owner-only`. A comparison is closed only when no row lacks a verdict and every `fixed` has a BadGEO page or a golden expectation. From B18 on: `fork/scripts/field-test.ts` runs steps 1–2 and keeps the ledger `fork/FIELD-TESTS.md`.

0. Pre-flight (B18 WO-B18-021): `pnpm exec tsx fork/scripts/field-test.ts <site> --preflight` counts sitemap URLs per section. Over 100 URLs: pick the scope before any run (in-app: Check a site "Leave out sections"; Semrush masks are `/path/`, not `/path/*`) and use the same scope on both sides.
   One command for steps 1–2 and the ledger: `pnpm exec tsx fork/scripts/field-test.ts <site> --external <export> [--run <dir>]` → verdict table in `fork/reports/field-<site>-<date>.md` (earlier verdicts kept on rerun) + row in `fork/FIELD-TESTS.md`. Write a verdict per open row, rerun to refresh the ledger, then `--close` (exit 1 while any row is open).
1. Run the engine on the same site at full depth (M3 step 3), or reuse a run from the same week.
2. `pnpm exec tsx fork/scripts/import-external-audit.ts fork/fixtures/audits/<export>.xlsx --report fork/runs/<site>/<run>/report.json --out fork/runs/<site>/<run>-import.md`. The importer reads every sheet (long form: one row per issue or per issue × page; wide form: one column per issue), maps each Semrush check name through `SEMRUSH_MAP` (`fork/scripts/lib/external-audit.ts`) and lists three sets.
3. "unknown check name": the tool added or renamed a check. Add it to `SEMRUSH_MAP` (Handbook ids, `skip` with the handbook reason, or `siteAudit`) and rerun; the map is the only place check names live.
4. "Handbook item exists, no finding": triage as M3 step 5 (site changed · check defect → WO · rule gap · truth verification). The export's example URLs are the evidence to start from.
5. "export issue, no Handbook item" with a `skip` reason: confirm the reason still holds; a check the handbook now values → SUPP candidate (M3 step 5).
6. "Handbook findings with no export issue": the Handbook sees more than the tool. Spot-check two in a browser; a false positive → check defect WO.
7. Write the misses both ways into `fork/reports/` as the next backlog (one queue row per WO); a new check gets a BadGEO page (M3 step 6). Commit and push.
8. Importer tests: `pnpm exec vitest run --root fork/scripts lib/external-audit.test.ts`.

## Drill results (B7 R2, 2026-11-14)

- **M1 rebase**: `git fetch upstream` → 0 new commits; `git merge-tree --write-tree --name-only upstream/main HEAD` → clean; `git rebase upstream/main` → "Current branch ken/main is up to date". Steps 3–4 verified as commands; no conflict to resolve this week.
- **M2 handbook sync**: v4.6 → `129 items · registry 129 · 0 diffs`. A copy with one changed §41 line (written to `fork/runs/drill/`, gitignored; delete it afterwards: `pnpm format:check` scans `fork/runs/` and fails on the unformatted copy) → `1 diffs · text changed P2-01` with old and new text. Detection works; procedure above.
- **Route tree**: regenerated with `@tanstack/router-generator` 1.167.40 for the B7 overview route; Register block kept.

## Loop log

| Date       | Loop | Model     | Result                                                                                                                                                                                      |
| ---------- | ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | M1   | Opus 5.5  | drill: 0 upstream commits, merge-tree clean                                                                                                                                                 |
| 2026-11-14 | M2   | Opus 5.5  | drill: v4.6 0 diffs; injected change detected as 1 diff                                                                                                                                     |
| 2026-11-20 | M4   | Fable 5.2 | guide v3: E12 > 3 → > 1, pack v2, SCALED-COPY v2; merged `00683b43`, BadGEO SUPP-17 / 19 0 / 0 (`fork/reports/M4-2026-11-20.md`)                                                            |
| 2026-11-21 | M1   | Fable 5.2 | prep only: 40 commits after `32da778f` ported onto `ken/rebase-v0.1.31-m1` (v0.1.31), checks green; force-push waits on Ken (`fork/reports/M1-2026-11-21-prep.md`)                          |
| 2026-11-21 | M1   | Opus 5.5  | v0.1.31: prep branch ported 40 commits (1 conflict), local gates green, goldens Δ 0, BadGEO 0 / 0; force-pushed on Ken's "push" (`fork/reports/M1-2026-11-21-prep.md`); next due 2026-11-28 |
