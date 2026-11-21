# B16 — Novice cleanup (4 known gaps) + visual restyle · HEAVY (SINGLE: Opus 5.5)

Spec: `fork/NOVICE-CLEANUP.md` (read fully first). Also read: `fork/NOVICE-UI.md` §0, §3, `fork/reports/B14.md`, `fork/FORK.md`, `fork/DEPENDABILITY.md` §5, `src/client/features/handbook/*`, `src/client/styles/app.css` (read only), `src/client/lib/theme.ts` (read only).

Rules:

- No approval stops except the look (spec §4). `look_choice:` empty in `fork/STATE.md` → WO-B16-006 is `BLOCKED-KEN`; continue every other WO. `status: needs-ken` only when nothing else is left (STATE protocol rule 8).
- Authorisations A18–A20 (spec §5) are granted. Upstream edits: none (ESCALATE row in `fork/queue.md`, continue).
- No contract, schema or migration change. No new npm dependency. No web fonts.
- Nothing removed from the app. Statuses, findings, grades and CSV rows unchanged.
- B13 rules still apply: `ops maint on` at the start of every run, secrets, test mode, ops verbs.
- Live checks: ≤ 2 test-mode audits, LLM ≤ $0.50 (A19).

## R0 — M1 local gates (before R1; never push)

Ken's PC only. Purpose: finish the checks `fork/reports/M1-2026-11-21-prep.md` could not run in the cloud.

1. `git fetch origin`; `git worktree add ../open-seo-m1 origin/ken/rebase-v0.1.31-m1` (reuse if present; `git -C ../open-seo-m1 checkout --detach origin/ken/rebase-v0.1.31-m1`). `pnpm install --frozen-lockfile` there. Symlink nothing; never copy or open `.env*`.
2. In the worktree: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check`; CLI goldens ×3 no LLM (caught Δ 0 vs `fork/BASELINE.md` / B14 report); BadGEO quick (0 / 0). Checks that need `.env.local` or the running app (`ops-test.sh`, `ui-smoke.mjs`, `ops e2e`): run from the main checkout against the current app and record them as "current app, v0.1.30 base"; they do not gate the prep branch.
3. Append a section "Local gates (date)" to `fork/reports/M1-2026-11-21-prep.md` with each result. All green → `needs_ken` M1 text gains "local gates green <date>". Any failure → queue row `M1-2026-11-21-F<n>` with the failing check; continue to R1 either way.
4. Never run `git push --force…`, never move `ken/main`. The force-push stays Ken's ("push").
5. Commits made on `ken/main` during B16 are not ported here; the session that hears "push" ports them first (report § Push, step 2).

Checkpoint.

## R1 — Verify, decide, write work orders

1. Re-verify spec §1 G1–G5 against the current code; adjust WOs, record.
2. Enumerate every blocked-note prefix the runner writes (WO-B16-002 input); table into the report.
3. ADR-030 novice cleanup + theme layer (mount point, look constant, `?look=` preview, same-title merge rule).
4. Work orders WO-B16-001 … 006 and 090 in `fork/work-orders/` (template `fork/templates/WO.md`, Class: HEAVY); rows in `fork/queue.md`.

Checkpoint.

## R2 — Looks

WO-B16-005: theme layer, three token sets, `?look=` preview, screenshots + contact sheet in `fork/runs/b16/looks/`; RUNBOOK § "Pick a look".

Checkpoint.

## R3 — Words

WO-B16-001 (More tools), WO-B16-002 (Couldn't check), WO-B16-003 (not-final note; re-run with the browser helper up first).

Checkpoint.

## R4 — Rows and look

WO-B16-004 (same-title rows). WO-B16-006 when `look_choice` is set.

Checkpoint.

## R5 — Exit

WO-B16-090. Then: B15 accuracy stays queued (`fork/DEPENDABILITY.md` §9: starts after loop M5 has one clean review ≥ 24 h after B14 green; B15 gets its own spec then).
