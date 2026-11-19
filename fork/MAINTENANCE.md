# Maintenance (after B7)

Three loops keep the fork current (BLUEPRINT §9). Each loop is a runnable checklist. Start a loop with:

`Read fork/MAINTENANCE.md and run loop M<n>.`

Rules from `fork/FORK.md` still apply: never ask Ken, record decisions, never open `.env*`, log upstream edits in `fork/UPSTREAM-EDITS.md`. In SINGLE mode every loop runs on Opus 5.5. In SPLIT mode use the Model column; a loop that needs both models switches once, at the marked step.

| Loop                | Trigger                 | Model                    | Output                                                |
| ------------------- | ----------------------- | ------------------------ | ----------------------------------------------------- |
| M1 Upstream rebase  | weekly                  | LIGHT                    | `ken/main` on top of `upstream/main`, checks green    |
| M2 Handbook update  | new handbook version    | HEAVY → LIGHT (1 switch) | registry, checks, fixtures on the new version         |
| M3 New golden audit | each manual field audit | HEAVY                    | `fork/fixtures/expected/<site>.expected.yaml`, triage |

Log every loop run as one row in the table at the end of this file.

## M1 — Upstream rebase (weekly, LIGHT)

1. `git status` is clean and on `ken/main`. Not clean → commit or stash the fork's own work first; never discard it.
2. `git fetch upstream` then `git rev-list --count HEAD..upstream/main`. `0` → log "no upstream commits" and stop.
3. Preview conflicts without touching the tree: `git merge-tree --write-tree --name-only upstream/main HEAD`. Exit 0 = clean. Otherwise it lists the conflicting files.
4. `git rebase upstream/main`. On conflict:
   - File outside fork paths (not `fork/`, not a fork feature folder) and not in `fork/UPSTREAM-EDITS.md` → take upstream's side with `git checkout --ours <file>` (during a rebase `--ours` is upstream and `--theirs` is the fork commit being replayed), `git add`, `git rebase --continue`.
   - File listed in `fork/UPSTREAM-EDITS.md` (registration hooks, `wrangler*.jsonc`, `.prettierignore`, `.claude/CLAUDE.md`, routes) → re-apply the fork's one-line edit on top of upstream's version. A hook whose surrounding upstream code changed shape → **ESCALATE**: `git rebase --abort`, add a row to `fork/queue.md` (`ESCALATE`, file, upstream commit), stop. The next HEAVY run resolves it.
   - `src/routeTree.gen.ts` → take upstream's, then regenerate (see "Route tree" below).
   - Drizzle migrations / `meta/_journal.json` → **ESCALATE** (fork migrations must be renumbered after upstream's; HEAVY only).
5. Session-end checks: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check`. Compare with `fork/BASELINE.md`. A failure caused by upstream alone (it also fails on a clean `upstream/main` checkout) → refresh `fork/BASELINE.md` with the new count and the upstream commit. A failure in fork code → fix it if the fix is local to fork files; otherwise ESCALATE.
6. Fork regression: `pnpm exec tsx fork/scripts/badgeo-run.ts` (exit 0) and `pnpm exec tsx fork/scripts/handbook-sync.ts` (0 diffs).
7. `git diff upstream/main --stat -- . ':!fork' ':!src/server/features/handbook' ':!src/client/features/handbook'` lists only files in `fork/UPSTREAM-EDITS.md` or fork feature folders.
8. Push: `git push --force-with-lease origin ken/main` (the rebase rewrote history; `--force-with-lease` refuses if `origin` moved unexpectedly).
9. Log the run below.

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

## Drill results (B7 R2, 2026-11-14)

- **M1 rebase**: `git fetch upstream` → 0 new commits; `git merge-tree --write-tree --name-only upstream/main HEAD` → clean; `git rebase upstream/main` → "Current branch ken/main is up to date". Steps 3–4 verified as commands; no conflict to resolve this week.
- **M2 handbook sync**: v4.6 → `129 items · registry 129 · 0 diffs`. A copy with one changed §41 line (written to `fork/runs/drill/`, gitignored; delete it afterwards: `pnpm format:check` scans `fork/runs/` and fails on the unformatted copy) → `1 diffs · text changed P2-01` with old and new text. Detection works; procedure above.
- **Route tree**: regenerated with `@tanstack/router-generator` 1.167.40 for the B7 overview route; Register block kept.

## Loop log

| Date       | Loop | Model    | Result                                                  |
| ---------- | ---- | -------- | ------------------------------------------------------- |
| 2026-11-14 | M1   | Opus 5.5 | drill: 0 upstream commits, merge-tree clean             |
| 2026-11-14 | M2   | Opus 5.5 | drill: v4.6 0 diffs; injected change detected as 1 diff |
