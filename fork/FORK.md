# Fork rules (auto-loaded via `.claude/CLAUDE.md` import)

Fork of `every-app/open-seo`. Working branch: `ken/main`. Remote `upstream` = `https://github.com/every-app/open-seo.git`.
Upstream `AGENTS.md` still applies in full. This file adds fork rules on top.

## Start of every run

- Command: `Read fork/STATE.md and continue the build.` (normally sent by `fork/scripts/autopilot.sh`).
- Autonomy (BLUEPRINT §1.7): never ask Ken, never wait. Decide with documented defaults; record decisions. Missing credential/access → `BLOCKED-KEN` on dependent steps only; continue.
- Model protocol (HEAVY/LIGHT batches, runs, switch banner, model guard, escalation): `fork/BLUEPRINT.md` §1. It overrides any habit of asking Ken to switch models mid-batch.
- Once `fork/scripts/ops/ops.sh` exists: first command of every run `bash fork/scripts/run-local.sh ops maint on` (the watchdog stands down during builds; the flag expires after 12 h).

## Layout

- `fork/` — fork-only: build plan, handbook, fixtures, scripts, baselines, logs. Never sent upstream.
- `fork/BLUEPRINT.md` — architecture, work packages, batch schedule, model protocol.
- `fork/STATE.md` — current batch, required model, next action, run log.
- `fork/batches/` — one file per batch (B1–B14, B16). Specs: `fork/FULL-READ.md` (B8–B10), `fork/SCALED-COPY.md` (B11), `fork/DEPENDABILITY.md` (B13; §9 = B15 accuracy items), `fork/NOVICE-UI.md` (B14), `fork/NOVICE-CLEANUP.md` (B16).
- `fork/research/` — research excerpts the batches rely on (read-only; replaced only by Ken).
- `fork/project-docs/` — docs copied from the old claude.ai project (AEO research, handbook archive, handoff supplement, `handbook_lint.py`); `fork/HANDOFF-*.md` = bootstrap for a new project.
- `fork/skills/` — fork skills served by the app and usable as Claude Code skills (`copy-rules`).
- `fork/queue.md`, `fork/work-orders/` — LIGHT work queue written by HEAVY batches.
- `fork/adr/`, `fork/reports/`, `fork/templates/`, `fork/agents/`, `fork/evals/`, `fork/sidecar/`.
- `fork/build-plan.md` — phases, borrow map, decisions.
- `fork/handbook/` — current SEO/GEO handbook (source of truth for audit rules).
- `fork/fixtures/audits/` — golden audits (read-only); `fork/fixtures/expected/` — machine-readable expectations; `fork/fixtures/badgeo/` — rule fixture site.
- `fork/runs/` — local audit outputs (gitignored).
- `src/server/features/handbook/`, `src/client/features/handbook/` — handbook audit engine.
- Later phases: `src/server/features/ai-traffic/`, `src/server/features/bing/`; new data providers under the existing feature's `providers/`.

## Allowed upstream edits

- `.claude/CLAUDE.md`: one import line (`@../fork/FORK.md`).
- `.prettierignore`: `fork/handbook/` and `fork/fixtures/audits/` (verbatim sources).
- `wrangler.jsonc` + `wrangler.audit.jsonc`: enable the commented `hyperdrive` block in each (binding `HYPERDRIVE`, placeholder id, no connection string in the file) for the Supabase Postgres path.
- Registration hooks: one line each, only when a fork feature must be wired into upstream code (HEAVY batches only).
- Anything else: ask Ken first.
- Log every upstream edit in `fork/UPSTREAM-EDITS.md`: file · line · why · date.

## Never

- Rewrite, reformat, or reorganize upstream files.
- Edit `knip.jsonc`, `AGENTS.md`, `.github/**`, `docs/maintainers/review-guidelines.md` without asking.
- Put fork notes in `docs/` (public user docs upstream).
- Edit or reformat `fork/handbook/` or `fork/fixtures/audits/` (verbatim sources; replaced only by Ken).
- Change the content of `fork/research/` or the rules in `fork/skills/copy-rules/SKILL.md` (Ken's research; format-only fixes allowed).
- Use an AI-detector verdict or authorship wording ("AI-written", "human-written") in any check, metric or report (SCALED-COPY §0).
- Read back, print, log, or commit secrets (`.env.local`, `.dev.vars`, `deploy/standalone/.env`, Supabase keys, `VERCEL_TOKEN`). Write env values only by shell append; never open those files.
- Change contracts, DB schema, or migrations in a LIGHT batch.
- Break SQLite + Postgres dual-dialect compatibility (Drizzle schemas in both `src/db/` dialects).
- Scrape consumer AI UIs with personal accounts; use DataForSEO LLM endpoints or official APIs.
- Use ranking, traffic, or backlink data in REVIEW mode (handbook EP-7).
- Record a finding without stored evidence (URL + fetched snippet / header / screenshot).
- Let LLM-judged findings block a release.
- Copy code from Canonry/Elmo without keeping its MIT notice in the file header.

## Session end (every session)

- `pnpm exec prettier --write <files you created or changed>` (never `fork/handbook/`, `fork/fixtures/audits/`).
- `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check`: compare with `fork/BASELINE.md`; any new failure = not done.
- `git diff upstream/main --stat -- . ':!fork' ':!src/server/features/handbook' ':!src/client/features/handbook'` lists only edits logged in `fork/UPSTREAM-EDITS.md`.
- Small commits on `ken/main`; push to `origin`.
- Report ≤10 bullets: done · blocked (with reason) · papercuts · next.

## Upstream sync

- During the build: rebase at the start of every HEAVY batch (B3, B5, B7); skip when `git fetch upstream` shows no new commits. After B7: monthly LIGHT loop M1 (BLUEPRINT §9): only upstream releases public ≥ 14 days; security fixes immediately; next due 2026-12-26.
- `git fetch upstream && git rebase upstream/main` on `ken/main`; resolve conflicts in favor of upstream outside fork paths; rerun session-end checks; refresh `fork/BASELINE.md` if upstream changed failures.
