# B1 — Foundation · HEAVY (SINGLE: Opus 5.5 · SPLIT: Opus 5.5 | Fable 5.2)

WPs 01–12 (BLUEPRINT §4). Read first: `fork/FORK.md`, `fork/BLUEPRINT.md`, `fork/build-plan.md`, `AGENTS.md`, `docs/LOCAL_DEVELOPMENT.md`, `docs/maintainers/review-guidelines.md`.
Environment: Windows + WSL (Ubuntu). Repo in WSL filesystem (`~/...`), not `/mnt/c/...`.

## R1 — Fork wiring, app, baseline, upstream gap (WP01, WP02)

### Git + fork wiring

1. Remotes: `origin` = Ken's fork; add `upstream` = `https://github.com/every-app/open-seo.git` if missing; `git fetch upstream`.
2. Create `ken/main` from `main` if missing; work only on `ken/main`.
3. Append `@../fork/FORK.md` as the last line of `.claude/CLAUDE.md`.
4. Append to `.prettierignore`:
   ```
   # fork: verbatim sources
   fork/handbook/
   fork/fixtures/audits/
   ```
5. `wrangler.jsonc` + `wrangler.audit.jsonc` (the audit worker also reads the DB): enable the commented `hyperdrive` block in each (binding `HYPERDRIVE`, placeholder id, no `localConnectionString`). Create `fork/UPSTREAM-EDITS.md`; log every edit (file · line · why · date).
6. Do not install `fork/agents/` yet (R5 probe decides; installed agents can be auto-delegated).

### P0: run the app

1. `node -v` ≥ 20. `corepack enable`. `pnpm --version` must equal `packageManager` in `package.json`.
2. `pnpm install --frozen-lockfile` → `pnpm run db:migrate:local`.
3. `[ -f .env.local ] || cp .env.example .env.local` (never overwrite: Ken pre-fills keys). `grep -q '^AUTH_MODE=' .env.local || printf '\nAUTH_MODE=local_noauth\n' >> .env.local` (append only; never open `.env.local`).
4. `bash fork/scripts/preflight.sh` → record PASS/MISS/OPT in `fork/reports/B1.md`. MISS/OPT items → mark only dependent steps/WOs `BLOCKED-KEN`. Never ask Ken, never wait, never read or echo key values.
5. Supabase (ADR-003/ADR-009 defaults): write `fork/scripts/run-local.sh` — `set -a; . ./.env.local; set +a`; export `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=$SUPABASE_DB_URL`, `POSTGRES_DATABASE_URL=$SUPABASE_DB_URL`, `DATABASE_PROVIDER=postgres`; subcommands `dev` (`pnpm dev:agents`), `migrate` (`pnpm db:migrate:pg` then `supabase-harden.sql`), `prod` (build + preview). Never echo variables. Write `fork/scripts/supabase-harden.sql` (RLS on every table in exposed schemas, no policies; revoke `anon`/`authenticated`; default privileges). Run `bash fork/scripts/run-local.sh migrate`. Supabase keys missing → stay on local D1 for this run and mark Supabase steps `BLOCKED-KEN`.
6. `mkdir -p .logs && bash fork/scripts/run-local.sh dev`; use the printed URL (default `http://open-seo.localhost:1355`). Read `.logs/dev-server.log` for errors.
7. Baseline on the clean checkout: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check`. Write pass/fail counts + failing test names to `fork/BASELINE.md`.

### Upstream audit, headless

1. Write `fork/scripts/upstream-audit.ts`, modeled on `tests/badseo/scripts/run-audit.ts`: same upstream detection imports (`crawlPage`, `discoverUrls`, `parseRobotsTxt`, `runPageReporters`, `findDuplicates`, `findRedirectChainsAndLoops`), own frontier for a public origin, obeys robots.txt, ≤200 pages, `createCrawlThrottle`. No fixture checks. Output: issue type · count · URLs.
2. Run `pnpm tsx fork/scripts/upstream-audit.ts <origin>` on `https://whyracingevents.com` and `https://www.ryanmscottsdale.com` → `fork/fixtures/upstream-audit/<domain>.md`.
3. If the script cannot work: run the audit in the app UI via Playwright MCP.
4. Create both projects in the app (skip if no DataForSEO key).
5. Read `fork/fixtures/audits/README.md`, compare with `fork/fixtures/audits/*.md` → `fork/fixtures/upstream-gap.md`: `finding ID | finding (short) | caught by upstream: Y / N / partial | upstream issue type`.

Checkpoint.

## R2 — Registry, sync, coverage, golden expected (WP03, WP04)

1. Source: `fork/handbook/on-site-seo-geo-reference-unified-v4.6.md`, section `## 41.`; items = lines starting `- [ ]`; expected 129.
2. `src/server/features/handbook/contracts/registry-types.ts`: types + Zod schema for a registry entry.
3. `src/server/features/handbook/registry.ts`: one entry per item, document order:
   - `id`: `P{phase}-{nn}` (REVIEW items `RV-{nn}`); `handbookVersion: "4.6"`
   - `text`: verbatim line text after `- [ ] `
   - `refs`: § numbers from the text
   - `tags`: tier (`T1+`…`T4`), `AUDIT`, `REVIEW`, gate text verbatim
   - `class` + `secondaryClasses`: `CRAWL | HEADERS | ROBOTS | BOTFETCH | SCHEMA | RENDER | PERF | A11Y | LLM | DATA | OWNER`
   - `automatable`: `full | partial | none`
   - `severityDefault`: S1–S4 per the handbook severity scale; none given → `S3` + `severitySource: "default"`
   - `evidence`: evidence fields the check must store
   - no `check` yet
4. `fork/scripts/handbook-sync.ts` (`pnpm tsx`): parse §41 from a handbook file; diff vs registry (missing · extra · text changed); 0 diffs for v4.6.
5. `fork/coverage.md`: counts phase × class; counts by `automatable`; `none` items; for every `N`/`partial` row in `upstream-gap.md`, the registry item(s) that would catch it.
6. `fork/fixtures/expected/<domain>.expected.yaml` per golden audit: every finding ID + every Passes line → `{ id, items: [registry ids], urls, class, detectableBy: deterministic|render|llm|data|owner, severity }`. Source audits in `fork/fixtures/audits/` are read-only.
7. knip flags on new files: note in report; do not edit `knip.jsonc`.

Checkpoint.

## R3 — ADRs + contracts (WP05)

Write `fork/adr/ADR-001…010` (template `fork/templates/ADR.md`); decide, record alternatives, cite code paths:
| ADR | Decision | Default in BLUEPRINT |
|---|---|---|
| 001 | Runtime placement | Phase hook in `runAuditPhases`, lazy-loaded |
| 002 | Data model | BLUEPRINT §3.4 |
| 003 | Evidence storage + retention | Supabase Storage private bucket `handbook-evidence` via service-role key (server-side only) |
| 004 | Collectors + sidecar contract (K2, K3) | BLUEPRINT §3.3, §3.5; sidecar also implements upstream `rendered-page` provider shape |
| 005 | Check contract + status model (K1) | PASS/OPEN/PARTIAL/BLOCKED/N/A/LIMITED |
| 006 | Template clustering + sampling | path pattern + skeleton hash; ≤3 samples |
| 007 | LLM judge (K5) — design only | quotes verified as substrings; cost cap |
| 008 | Scoring EP-7 (K6) — design only | per handbook EP-7 |
| 009 | Security model | BLUEPRINT §3.6 |
| 010 | UI information architecture | handbook tab under project |
Then write contracts K1–K8 as TS under `src/server/features/handbook/contracts/` (+ `fork/sidecar/openapi.yaml` for K3). Set `CONTRACTS_VERSION = "1.0.0"`.

Checkpoint.

## R4 — Core build (WP06–WP10)

1. Schema + migrations, both dialects (`pnpm db:generate`); `schema-parity.test.ts` green. Repositories → services → server functions (AGENTS.md pattern).
2. Runner + one-line hook in `runAuditPhases` (log in `UPSTREAM-EDITS.md`); lazy import; feature flag per project.
3. `fork/scripts/handbook-audit.ts`: CLI runner (grows from `upstream-audit.ts`), runs intake + collectors + checks headless, writes findings + `seo-geo-status.md` draft to `fork/runs/<domain>/<date>/` (gitignored path: add `fork/runs/` to fork-local ignore via `fork/.gitignore`).
4. Intake: SP1–SP12 inference with evidence + confidence; tier; mode; gate evaluation → applicable item set.
5. Collectors (K2): robots (per-group evaluation, named vs `*`), sitemap(s), llms.txt + `.md` mirrors, headers by value, URL variants, bot-UA fetch parity (Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot), JSON-LD graph parse; template clustering.
6. BadGEO: `fork/fixtures/badgeo/` static site (pages declare expected item IDs in a `<meta name="badgeo-expect">`), local static server script, harness `fork/scripts/badgeo-run.ts`: every expected item fires on its page, nothing unexpected.
7. Golden scorer `fork/scripts/golden-score.ts`: run vs `fork/fixtures/expected/*.expected.yaml` → caught / partial / missed / `site-changed` (after direct re-fetch) per finding.

Checkpoint.

## R5 — Exemplars + B2 queue (WP11, WP12)

1. Exemplar checks, each with BadGEO page(s), unit test, golden mapping:
   - ROBOTS: full group-evaluation item(s) (P3 robots line, P9 robots-per-group line).
   - CRAWL: URL inventory reconciliation (sitemap vs canonical vs internal links).
   - HEADERS: security headers by value.
   - SCHEMA: JSON-LD parse + `@id` integrity + placeholder sentinels.
   - BOTFETCH: bot-UA parity.
2. Write `fork/work-orders/WO-B2-*.md` (template `fork/templates/WO.md`) for all remaining CRAWL / HEADERS / SCHEMA / ROBOTS / BOTFETCH / RENDER / PERF / A11Y items, BadGEO pages, render sidecar (K3), findings UI, harness runs. Group related items per WO (target 25–40 WOs). Order by dependency; fill `fork/queue.md`.
3. SPLIT mode only (skip in SINGLE): lever probe: copy `fork/agents/*.md` → `.claude/agents/`; spawn `light-helper` and `heavy-escalation`, each states its model; record in `fork/reports/B1.md`. Verified → set `levers:` in `STATE.md` ON for that lever. Not verified → remove that file from `.claude/agents/`, lever stays OFF. (L2 is invoked from a Sonnet session; B2's first run repeats the L2 probe from Sonnet before relying on it.)
4. Exit gate (BLUEPRINT §5): app runs; registry 129 + sync 0 diffs; contracts frozen; schema-parity green; exemplars pass BadGEO; queue written; no new failures vs `BASELINE.md`; upstream diff = logged edits only.
5. `fork/reports/B1.md` (≤15 bullets + coverage headline + upstream-gap headline + lever result if probed). `STATE.md` → B2. Commit + push. Batch end per `STATE.md` protocol step 6.
