# Blueprint — SEO/GEO App (fork of every-app/open-seo) · v1 · 2026-11-14

Source of truth for architecture, dependencies, model batching, schedule. `fork/build-plan.md` = product scope; this file = how it gets built.

## 0. Outcome

| Milestone              | Batch                | Definition                                                                                                                                                                           |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 Skeleton            | end B1               | App runs; registry (129 §41 items); contracts frozen; engine + collectors + 5 exemplar checks; CLI runner                                                                            |
| M2 Deterministic audit | end B2               | All deterministic/render/perf/a11y checks run via CLI + UI on any site; BadGEO + golden harness green                                                                                |
| M3 v1.0                | end B4 + B5 sign-off | Full handbook audit (incl. LLM checks, EP-7 score), status.md + client report + PDF, MCP; production build running on Ken's computer on Supabase; client reports published to Vercel |
| M4 v2.0                | end B7               | AI-crawler traffic, Bing, BYOK AI visibility, Common Crawl backlinks, agency layer                                                                                                   |

## 1. Model protocol

### 1.0 Mode (set in `STATE.md` → `mode:`)

| Mode   | Default  | Models                                                       | Switches |
| ------ | -------- | ------------------------------------------------------------ | -------- |
| SINGLE | ✅       | Opus 5.5 for every batch                                     | 0        |
| SPLIT  | fallback | HEAVY batches Opus 5.5 / Fable 5.2; LIGHT batches Sonnet 5.5 | 6        |

- SINGLE rules: HEAVY/LIGHT labels stay (they mark where SPLIT would switch). Batch end → set `STATE.md` to the next batch and continue; context full → RUN CHECKPOINT (§1.3). No switch banner, no model guard beyond "is Opus". WOs still written (persistent task list across `/clear`), compact form allowed (Files, Spec, Acceptance required; rest optional). ESCALATE resolved inline. Levers L1/L2 unused.
- Plan = Claude Ultra: one weekly limit shared by all models (+ a separate Fable cap); verified accounts have no five-hour limit. Sonnet does not open a second pool; it only drains the shared weekly limit more slowly.
- Switch SINGLE → SPLIT only preemptively: Ken sees weekly usage running low in `/usage` (rule of thumb <30% left with LIGHT batches remaining) → set `mode: SPLIT` in `STATE.md`; LIGHT-labeled batches continue on Sonnet 5.5; every SPLIT rule below applies from that point.
- Weekly limit fully reached → SPLIT does not help (shared pool). Options: limit reset (if the account has one), usage credits (`/usage-credits`), or wait for the weekly reset; `STATE.md` resumes exactly where it stopped.
- §1.1–§1.6 = SPLIT rules.

### 1.1 Classes

| Class | Models                                                                         | Owns                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HEAVY | Opus 5.5 or Fable 5.2 (interchangeable; Opus preferred for B5 security review) | Architecture, contracts, schema, interpretation of the handbook, hard algorithms, LLM-judge design, scoring, security, reviewing LIGHT output, writing work orders |
| LIGHT | Sonnet 5.5                                                                     | Executing work orders against frozen contracts: checks from spec, fixtures, tests, UI on existing patterns, ports with a mapping, scripts, docs, deploy files      |

### 1.2 Batching rules

- Batch = maximal block of work for one model class. 7 batches, alternating HEAVY → LIGHT. 6 model switches for the whole build.
- Every HEAVY batch = review previous LIGHT batch → resolve escalations → hard build → write ALL work orders for next LIGHT batch.
- Every LIGHT batch = execute the work-order queue to exhaustion. No design decisions.
- Contracts change only in HEAVY batches. LIGHT never edits `src/server/features/handbook/contracts/**`, DB schema, migrations, or upstream files.
- LIGHT escalation: WO ambiguous, contract defect, or test still failing after 2 attempts → mark `ESCALATE` in `fork/queue.md` with reason → continue with WOs not depending on it. Never stall, never ask for a switch mid-batch.
- LIGHT early stop: only if escalations block ≥25% of remaining WOs. Then finish what is unblocked, close batch, print switch banner.
- HEAVY doing light work: only when it sits on the critical path of the same batch's heavy work; else write it as a WO.
- Upstream rebase: at the start of every HEAVY batch (B3, B5, B7); skip when `git fetch upstream` shows no new commits. Conflict resolution is HEAVY work.

### 1.3 Runs (same model, no switch)

- Run = one Claude Code context window. A batch spans several runs.
- Checkpoint after each run scope or when context is ~70% used: commit, update `fork/STATE.md` run log. AUTOPILOT → exit (the driver starts the next run). INTERACTIVE → continue. Manual sessions only, print:
  ```
  === RUN CHECKPOINT (same model) ===
  /clear  →  Read fork/STATE.md and continue the build.
  ```

### 1.4 Switch (batch boundary only)

- End of batch: full checks, batch report `fork/reports/B{n}.md`, `STATE.md` → next batch, commit + push, print:
  ```
  === BATCH B{n} COMPLETE — SWITCH MODEL ===
  1. /model → {Sonnet 5.5 | Opus 5.5 or Fable 5.2}
  2. /clear
  3. Read fork/STATE.md and continue the build.
  ```
- Model guard (start of every run): compare own model with `required_model` in `STATE.md`. Mismatch → print switch banner, stop. Ken may reply `override` to proceed anyway.

### 1.5 Universal command

`Read fork/STATE.md and continue the build.` — the prompt every run receives (from the autopilot driver, or typed by Ken in a manual/interactive session).

### 1.6 Optional levers (default OFF; B1 probes, enables only if verified)

| Lever               | Where         | What                                                                                         | Enable if                     |
| ------------------- | ------------- | -------------------------------------------------------------------------------------------- | ----------------------------- |
| L1 light-helper     | HEAVY batches | Subagent `model: sonnet` for bulk mechanical chores (fixture pages, formatting, boilerplate) | Probe subagent reports Sonnet |
| L2 heavy-escalation | LIGHT batches | Subagent `model: opus` resolves one ESCALATE that blocks ≥3 WOs, avoiding early stop         | Probe subagent reports Opus   |

- Definitions: `fork/agents/*.md`, copied to `.claude/agents/` (gitignored upstream).

### 1.7 Autonomy (default AUTOPILOT)

- Goal: zero Ken interaction between start and `status: done`.
- Driver: `bash fork/scripts/autopilot.sh` (WSL). Loops `claude -p "Read fork/STATE.md and continue the build…" --model claude-opus-5-5 --permission-mode auto`; one fresh context per run, so no `/clear`.
- Stops only on: `status: done` (exit 0) · `status: needs-ken` (2) · 3 runs without a new commit (3) · usage limit (4) · MAX_RUNS 60 (5). Re-running resumes from `STATE.md`.
- Permission mode `auto`: a classifier reviews each action; deny rules in `.claude/settings.local.json` still apply in every mode. Repeated classifier blocks abort a headless run → the loop retries; stall rule stops it. `PERM_MODE=bypassPermissions` only on an isolated VM/container (WSL can reach Windows drives).
- Agent behavior: never asks, never waits; defaults + ADRs decide; missing credentials → only dependent steps `BLOCKED-KEN`; `needs-ken` only when nothing else can proceed.
- Every Ken input moves before start: credentials in `.env.local`, access set up, `bash fork/scripts/preflight.sh` all PASS (§7).
- Fallback: INTERACTIVE — `claude --model claude-opus-5-5 --permission-mode auto`, type the universal command once; the agent keeps going through checkpoints (auto-compact) instead of exiting.
- Watch progress: `tail -f fork/runs/autopilot.log`, `fork/STATE.md`, `fork/reports/`.

## 2. Work classification

| Work                                                                                                  | Class |
| ----------------------------------------------------------------------------------------------------- | ----- |
| ADRs, contracts, DB schema + migrations (both dialects)                                               | HEAVY |
| Handbook interpretation → rule logic, severity, gates, SP inference                                   | HEAVY |
| robots.txt group semantics, raw-vs-rendered diffing, template clustering, cross-page fact consistency | HEAVY |
| LLM-judge design, prompts, eval sets, injection guards                                                | HEAVY |
| EP-7 scoring, status reconciliation                                                                   | HEAVY |
| Security (SSRF, share auth, secrets, tenant scoping), code review, golden triage                      | HEAVY |
| Integration design incl. Canonry/Elmo port mapping                                                    | HEAVY |
| Checks implemented from a WO spec                                                                     | LIGHT |
| BadGEO fixture pages, unit tests, golden harness runs                                                 | LIGHT |
| UI on existing upstream patterns (TanStack Router/Query/Form, shadcn on Base UI)                      | LIGHT |
| Render sidecar service from OpenAPI contract                                                          | LIGHT |
| MCP tools from schema, export templates, PDF, deploy files, docs                                      | LIGHT |
| Ports with an explicit file mapping                                                                   | LIGHT |
| Weekly upstream rebase without core conflicts                                                         | LIGHT |

## 3. Architecture

### 3.1 Components

| #   | Component                                                                          | Location                                                                                                                                                                                                                | Runtime                                                                             |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| C1  | Upstream OpenSEO app (UI, server functions, MCP, reports, projects, orgs)          | upstream                                                                                                                                                                                                                | Ken's computer (WSL): Workers runtime via wrangler/vite (workerd), production build |
| C2  | Upstream audit engine (discovery → crawl → Lighthouse → finalize)                  | `src/server/workflows/siteAuditWorkflowPhases.ts`, aux worker `src/audit-worker.ts`                                                                                                                                     | SiteAuditWorkflow                                                                   |
| C3  | Handbook engine: intake, collectors, checks, runner, scoring                       | `src/server/features/handbook/`                                                                                                                                                                                         | new phase in SiteAuditWorkflow (lazy-loaded)                                        |
| C4  | Render sidecar: Playwright + Chromium + axe-core + Lighthouse CLI                  | `fork/sidecar/` (own `compose.yaml`)                                                                                                                                                                                    | Docker Desktop on Ken's computer, bound to 127.0.0.1                                |
| C5  | LLM judge                                                                          | `src/server/features/handbook/llm/`                                                                                                                                                                                     | AI SDK + OpenRouter (existing)                                                      |
| C6  | Evidence store                                                                     | Supabase Storage, private bucket `handbook-evidence` (upstream R2 stays local for upstream features)                                                                                                                    | Supabase                                                                            |
| C7  | Handbook UI                                                                        | `src/client/features/handbook/` + routes under `src/routes/_app/p/$projectId/`                                                                                                                                          | app                                                                                 |
| C8  | Exports: `seo-geo-status.md`, report JSON, client report on upstream reports/share | `src/server/features/handbook/export/`                                                                                                                                                                                  | app                                                                                 |
| C9  | MCP tools                                                                          | registered beside upstream `src/server/mcp/tools/`                                                                                                                                                                      | app                                                                                 |
| C10 | CLI runner (local, headless)                                                       | `fork/scripts/handbook-audit.ts` (grows from `upstream-audit.ts`)                                                                                                                                                       | Node via `pnpm tsx`                                                                 |
| C11 | Integrations (v2): ai-traffic, bing, ai-visibility BYOK, commoncrawl, agency       | `src/server/features/{ai-traffic,bing}/`, providers under existing features                                                                                                                                             | app (Ken's computer)                                                                |
| C12 | Database                                                                           | Supabase Postgres: `DATABASE_PROVIDER=postgres`; HYPERDRIVE binding resolved locally via `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` = Supabase session pooler (port 5432, IPv4, prepared statements OK) | Supabase                                                                            |
| C13 | Public client reports                                                              | Static report snapshots published to a Vercel project (`fork/vercel/reports/`): unguessable URLs, `noindex`                                                                                                             | Vercel                                                                              |
| C14 | Always-on receivers                                                                | Vercel Functions in `fork/vercel/receiver/`: Vercel drain ingestion → Supabase (B6)                                                                                                                                     | Vercel                                                                              |

### 3.2 Runtime placement (ADR-001 default; B1 confirms)

- Handbook = extra phase in `runAuditPhases` after crawl, before finalize. One-line registration hook, guarded by a project flag.
- Lazy `import()` only: `vite-plugin-lean-worker-bundle.ts` asserts the audit worker's eager bundle stays lean.
- Alternative if the hook proves fragile: separate HandbookWorkflow binding (needs `wrangler*.jsonc` + standalone runtime edits → HEAVY decision).
- Runtime host = Ken's computer; schedules (rank checks, AI visibility, outcome re-baselines) run only while it is on and the app is running; missed runs execute on next start (ADR-011 verifies upstream catch-up behavior).
- Full port of the app to Vercel is out of scope for this build: 88 upstream files import `cloudflare:workers` (Workflows, KV, Durable Objects, MCP OAuth provider); a port permanently forks from upstream. Revisit only as a separate HEAVY decision.

### 3.3 Audit data flow

1. Intake: site profile SP1–SP12 (inferred + evidence + confidence), tier T1–T4, mode BUILD/AUDIT/REVIEW → applicable items via tier/gate/mode filter.
2. Upstream crawl (pages, links, status, redirects, raw HTML) — reused, not duplicated.
3. Collectors (once per run): robots.txt (per-group evaluation), sitemap(s), llms.txt + `.md` mirrors, headers by value, URL-variant probes (apex/www/http/trailing slash/`index.html`/unknown URL), bot-UA fetch parity (6 bots), JSON-LD parse graph.
4. Template clustering: path pattern + raw-HTML skeleton hash → templates; sample ≤3 URLs per template (first, median, largest).
5. Sidecar on samples: JS-on render, JS-off render, mobile first-screen screenshot, axe after full scroll, Lighthouse mobile + desktop.
6. Deterministic checks (all pages for raw-HTML checks; samples for render/perf/a11y).
7. LLM checks (samples + cross-page fact table); every verdict carries quotes verified as substrings of fetched text.
8. Reconcile → item status per §41 item: PASS / OPEN(finding) / PARTIAL / BLOCKED / N/A / LIMITED.
9. EP-7 scoring (phase weights, S1 cap) — REVIEW mode excludes ranking/traffic/backlink data.
10. Outputs: findings + evidence in DB/storage; `seo-geo-status.md`; client report; MCP.

### 3.4 Data model (ADR-002; dual-dialect, rows not JSON, schema-parity test must pass)

| Table                      | Key columns                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handbook_run`             | id, project_id, audit_id, handbook_version, contracts_version, mode, tier, status, score_uncapped, score_final, cap_reason, llm_cost_usd, started_at, finished_at |
| `handbook_site_profile`    | run_id, sp_code, value (Y/N/?), evidence, confidence                                                                                                              |
| `handbook_template`        | id, run_id, template_key, url_pattern, page_count                                                                                                                 |
| `handbook_template_sample` | template_id, url, rank                                                                                                                                            |
| `handbook_page_snapshot`   | run_id, url, template_id, status, raw_key, rendered_key, nojs_key, words_raw, words_rendered                                                                      |
| `handbook_item_status`     | run_id, item_id, status, score (1/0.5/0/null), note                                                                                                               |
| `handbook_finding`         | id, run_id, code (F01…), severity S1–S4, class, title, detail, fixability (FIXABLE/LIMITED), effort                                                               |
| `handbook_finding_item`    | finding_id, item_id                                                                                                                                               |
| `handbook_evidence`        | id, run_id, finding_id?, item_id, kind, url, storage_key, excerpt, sha256, captured_at                                                                            |
| `handbook_bot_fetch`       | run_id, url, bot, status, bytes, body_sha256                                                                                                                      |
| `handbook_llm_call`        | run_id, item_id, model, tokens_in, tokens_out, cost_usd, prompt_sha256                                                                                            |

- Tenant scoping on every query (project → org), per upstream review invariants.

### 3.5 Contracts (frozen at end of B1; `CONTRACTS_VERSION`; WOs pin it)

| ID  | Contract                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | `HandbookCheck`: `{ itemIds, class, requires: CollectorKey[], run(ctx) → { statuses, findings, evidence } }`                                                             |
| K2  | `Collector`: keyed outputs in run context (robots, sitemap, llms, headers, variants, botFetch, jsonld, render, axe, lighthouse)                                          |
| K3  | Sidecar OpenAPI: `POST /render`, `POST /axe`, `POST /lighthouse`, `GET /health`; also implements upstream `rendered-page` provider shape so it can replace `context.dev` |
| K4  | Evidence store put/get + retention                                                                                                                                       |
| K5  | LLM judge: `judge(itemId, inputs, rubric) → { verdict, quotes[], confidence }` + quote verification + per-run cost cap                                                   |
| K6  | Scoring (EP-7) input/output                                                                                                                                              |
| K7  | Exports: status.md template, report JSON schema                                                                                                                          |
| K8  | MCP tool schemas: `handbook_audit_run`, `handbook_findings_get`, `handbook_status_export`                                                                                |

### 3.6 Security model (ADR-009)

- SSRF: collectors + sidecar reuse upstream `url-policy.ts` / `public-fetch.ts`; resolve DNS and refuse private ranges; sidecar port bound to 127.0.0.1 only.
- Bot-UA fetches only against the project's own origin; low rate; identify in logs.
- Page text is untrusted LLM input: fixed system prompt, schema-validated output, quote verification; no tool use by the judge.
- Secrets env-only; never logged; Claude Code deny-reads `.env*`.
- Public surface = Vercel report snapshots (unguessable path, `noindex`, no secrets, no evidence beyond what the report shows) + Vercel drain receiver (signature-verified). The app itself is never exposed publicly.
- Supabase: app connects as the database owner over the session pooler; every table in exposed schemas gets RLS enabled with no policies and `anon`/`authenticated` privileges revoked (`fork/scripts/supabase-harden.sql`, run after every migration); service-role key only server-side; Storage buckets private.

### 3.7 Deployment topology (PD, in B4)

| Piece                                              | Where                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App (UI, workflows, crawler, handbook engine, MCP) | Ken's computer, WSL: `fork/scripts/run-local.sh` (production build; sources `.env.local` into the process without printing it) |
| Render sidecar                                     | Ken's computer, Docker Desktop, `fork/sidecar/compose.yaml`, 127.0.0.1                                                         |
| Database                                           | Supabase Postgres (dedicated project)                                                                                          |
| Evidence + report assets                           | Supabase Storage (private buckets)                                                                                             |
| Public client reports                              | Vercel project from `fork/vercel/reports/`, deployed with `VERCEL_TOKEN`                                                       |
| Drain receiver (B6)                                | Vercel Functions from `fork/vercel/receiver/` → Supabase                                                                       |

- Access: app at localhost only; MCP endpoint local for Claude Code on the same machine.
- Backups: nightly `pg_dump` of the Supabase database to a local folder (`fork/scripts/backup.sh`) + Supabase's own plan backups.
- Cloudflare deploy remains possible upstream; not used. RENDER/PERF/A11Y items = LIMITED there.

## 4. Work packages + dependencies

| WP  | Name                                                                                                                                              | Depends    | Class                | Batch |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- | ----- |
| 01  | Fork wiring, app running, test baseline                                                                                                           | —          | L (on critical path) | B1    |
| 02  | Headless upstream audit + upstream-gap table                                                                                                      | 01         | H                    | B1    |
| 03  | Registry 129 items + handbook-sync + coverage                                                                                                     | 01         | H                    | B1    |
| 04  | Golden expected files (`fork/fixtures/expected/*.expected.yaml`: finding → items, URLs, class)                                                    | 03         | H                    | B1    |
| 05  | ADR-001…010 + contracts K1–K8                                                                                                                     | 02, 03     | H                    | B1    |
| 06  | Schema + migrations + repos/services                                                                                                              | 05         | H                    | B1    |
| 07  | Runner + workflow hook + CLI runner                                                                                                               | 05, 06     | H                    | B1    |
| 08  | Intake (SP/tier/mode/gates)                                                                                                                       | 05         | H                    | B1    |
| 09  | Collectors (robots, sitemap, llms, headers, variants, botFetch, jsonld) + template clustering                                                     | 05         | H                    | B1    |
| 10  | BadGEO skeleton + harness; golden scorer                                                                                                          | 04, 07     | H                    | B1    |
| 11  | Exemplar checks: ROBOTS (full), CRAWL, HEADERS, SCHEMA, BOTFETCH                                                                                  | 07, 09, 10 | H                    | B1    |
| 12  | WO queue for B2                                                                                                                                   | 11         | H                    | B1    |
| 13  | Remaining CRAWL / HEADERS / SCHEMA / ROBOTS / BOTFETCH checks                                                                                     | 12         | L                    | B2    |
| 14  | BadGEO pages for every B2 rule                                                                                                                    | 12         | L                    | B2    |
| 15  | Render sidecar service (K3) + `fork/sidecar/compose.yaml` (127.0.0.1)                                                                             | 12         | L                    | B2    |
| 16  | RENDER / PERF / A11Y checks                                                                                                                       | 15         | L                    | B2    |
| 17  | Findings UI (runs, items, findings, evidence viewer)                                                                                              | 12         | L                    | B2    |
| 18  | BadGEO + golden runs → reports                                                                                                                    | 13–16      | L                    | B2    |
| 19  | Upstream rebase; review B2 (checklist)                                                                                                            | B2         | H                    | B3    |
| 20  | Resolve B2 escalations; golden triage                                                                                                             | 19         | H                    | B3    |
| 21  | LLM judge framework + 5 exemplar LLM checks + eval set from golden                                                                                | 20         | H                    | B3    |
| 22  | Cross-page fact table + consistency checks (stats, names, prices)                                                                                 | 21         | H                    | B3    |
| 23  | EP-7 scoring + status reconciliation                                                                                                              | 20         | H                    | B3    |
| 24  | Export spec (status.md, report JSON, client report content model on upstream reports)                                                             | 23         | H                    | B3    |
| 25  | Runtime + publish architecture (local production run, Supabase hardening, Vercel report publishing, backup)                                       | 15         | H                    | B3    |
| 26  | WO queue for B4                                                                                                                                   | 21–25      | H                    | B3    |
| 27  | Remaining LLM checks from prompt specs                                                                                                            | 26         | L                    | B4    |
| 28  | Report UI, share, PDF, status.md + JSON export                                                                                                    | 26         | L                    | B4    |
| 29  | MCP tools + Claude Code skill                                                                                                                     | 26         | L                    | B4    |
| 30  | Local production run script, Vercel report publisher, Supabase hardening + backup scripts, runbook                                                | 26         | L                    | B4    |
| 31  | Full regression: BadGEO, golden, 1 new live site, timing + cost                                                                                   | 27–30      | L                    | B4    |
| 32  | Upstream rebase; v1 review: security, integrity, golden; fixes                                                                                    | B4         | H                    | B5    |
| 33  | Tag v1.0                                                                                                                                          | 32         | H                    | B5    |
| 34  | Integration designs: ai-traffic (Canonry rules + Vercel drain), Bing, BYOK AI visibility (+ fan-out, citation categories), Common Crawl backlinks | 33         | H                    | B5    |
| 35  | Agency layer design (orgs/projects, white-label on upstream report templates, +4/+12-week outcome record)                                         | 33         | H                    | B5    |
| 36  | WO queue for B6                                                                                                                                   | 34, 35     | H                    | B5    |
| 37  | ai-traffic build (port with MIT headers, Vercel receiver function + signature check → Supabase, rollups, UI)                                      | 36         | L                    | B6    |
| 38  | Bing WMT + AI Performance                                                                                                                         | 36         | L                    | B6    |
| 39  | BYOK AI visibility providers, fan-out, citation categories                                                                                        | 36         | L                    | B6    |
| 40  | Common Crawl backlinks (local Node + DuckDB on Ken's computer)                                                                                    | 36         | L                    | B6    |
| 41  | Agency layer build                                                                                                                                | 36         | L                    | B6    |
| 42  | Integration tests + regression                                                                                                                    | 37–41      | L                    | B6    |
| 43  | Upstream rebase; review B6; hardening; perf; v2.0 tag                                                                                             | B6         | H                    | B7    |
| 44  | Maintenance playbook + handbook-sync drill + rebase drill                                                                                         | 43         | H                    | B7    |

- Critical path: 01 → 03 → 05 → 06/07/09 → 11 → 12 → 13/15/16 → 19/20 → 21/23 → 26 → 27/28/30 → 32 → v1.0.
- Independent of the handbook engine: 34–41 (scheduled after v1 for value order, not dependency).

## 5. Batch schedule

| Batch                               | Model                  | WPs   | Est. runs | Exit gate                                                                                                                                  |
| ----------------------------------- | ---------------------- | ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| B1 Foundation                       | HEAVY                  | 01–12 | 4–5       | App runs; registry + sync 0 diffs; contracts frozen; schema-parity green; 5 exemplars pass BadGEO; B2 queue written                        |
| B2 Deterministic build-out          | LIGHT                  | 13–18 | 6–10      | Queue exhausted or escalated; BadGEO 100% on implemented rules; golden report written; no new test/type/lint failures                      |
| B3 Judgment layer                   | HEAVY                  | 19–26 | 3–5       | Escalations closed; LLM eval passes on golden; EP-7 scorer reproduces golden grades within ±10 (older handbook versions); B4 queue written |
| B4 Product surface + deploy         | LIGHT                  | 27–31 | 4–6       | v1 RC: full audit from UI, MCP, CLI; report PDF + Vercel-published snapshot; production build running locally on Supabase                  |
| B5 v1 sign-off + integration design | HEAVY (Opus preferred) | 32–36 | 3–4       | Security review clean; v1.0 tagged; B6 queue written                                                                                       |
| B6 Integrations build               | LIGHT                  | 37–42 | 6–8       | All integration WOs done or escalated; regression green                                                                                    |
| B7 v2 + maintenance                 | HEAVY                  | 43–44 | 2–3       | v2.0 tagged; playbooks written                                                                                                             |

- Totals: 7 batches · 28–41 runs · SINGLE mode 0 switches (SPLIT: 6).
- "Model" column = class label; in SINGLE mode every batch runs on Opus 5.5.
- First useful output: end of B2 (deterministic handbook audit on any site via CLI + UI).

## 6. Single-day mode

- Target: B1 → B7 in one day. No calendar.
- Ultra (verified): no five-hour limit, so the day is bounded only by the weekly limit. Check `/usage` before starting.
- Every §7 prerequisite done before start; `preflight.sh` all PASS. `BLOCKED-KEN` stays as fallback only.
- Slow-to-provision items first: DataForSEO deposit, Supabase project, Vercel token (+ Pro for drains), Bing API key, Google OAuth app.
- Upstream rebase at HEAVY batch start: skip when `git fetch upstream` shows no new commits.
- Ken's turns after start: none (AUTOPILOT). Only if the driver stops: read its exit message, fix, re-run.

## 7. Ken's prerequisites (all before start; "First used" = batch that needs it; `preflight.sh` checks every row it can)

| Item                                                                                                                                                | First used           | Notes                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| Ultra account verified: Settings > Usage shows no "Current session" bar; weekly usage mostly unused                                                 | B1                   | Unverified accounts keep a temporary five-hour limit                                                   |
| Fork `every-app/open-seo`; clone in WSL `~/`; unzip seed at repo root                                                                               | B1                   | —                                                                                                      |
| Node ≥20 + corepack + Claude Code CLI in WSL; `gh auth login`                                                                                       | B1                   | Push to fork without prompts                                                                           |
| Copy `fork/claude-settings.suggested.json` → `.claude/settings.local.json`                                                                          | B1                   | Deny rules hold in auto mode too: no `.env*` reads, no edits to verbatim sources                       |
| `cp .env.example .env.local`, then add keys below (B1 never overwrites an existing `.env.local`)                                                    | B1                   | Agent checks presence only, never reads values                                                         |
| `DATAFORSEO_API_KEY` (base64 `login:password`; $50 min deposit)                                                                                     | B1 (in-app features) | Required                                                                                               |
| Docker Desktop with WSL integration, running                                                                                                        | B2                   | Sidecar; required                                                                                      |
| `OPENROUTER_API_KEY`                                                                                                                                | B3                   | LLM judge; required                                                                                    |
| Supabase: new dedicated project; in `.env.local`: `SUPABASE_DB_URL` (Session pooler string, port 5432), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | B1                   | Required; DB + evidence storage                                                                        |
| `VERCEL_TOKEN` (scope: Ken's Pro team) in `.env.local`; optional `REPORTS_DOMAIN`                                                                   | B4                   | Required; report publishing (and B6 receiver). Client reports are commercial use → Pro team, not Hobby |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (OAuth app with GSC + GA4 redirect URLs); `GOOGLE_MAPS_API_KEY`                                         | B5                   | Optional; connecting a property in the app is still a one-time browser step                            |
| Vercel Pro on ≥1 site                                                                                                                               | B6                   | Optional; drains are Pro/Enterprise only, billed per volume                                            |
| `BING_WEBMASTER_API_KEY` (site verified in BWT)                                                                                                     | B6                   | Optional                                                                                               |
| BYOK: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`                                                                 | B6                   | Optional; AI visibility direct path                                                                    |

- Fork-defined env names (`SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_TOKEN`, `REPORTS_DOMAIN`, `BING_WEBMASTER_API_KEY`, BYOK keys) are binding for ADR-003, ADR-011…014. `fork/scripts/run-local.sh` maps `SUPABASE_DB_URL` → `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` and `POSTGRES_DATABASE_URL`.

## 8. Handoff artifacts

| File                                 | Owner                        | Purpose                                                    |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------------- |
| `fork/STATE.md`                      | every run                    | Current batch, required model, next action, run log        |
| `fork/queue.md`                      | HEAVY writes, LIGHT executes | WO queue with status                                       |
| `fork/work-orders/WO-B{n}-{nnn}.md`  | HEAVY                        | One self-contained task (template: `fork/templates/WO.md`) |
| `fork/adr/ADR-{nnn}.md`              | HEAVY                        | Decisions (template: `fork/templates/ADR.md`)              |
| `fork/reports/B{n}.md`               | end of batch                 | Done / escalated / metrics / next                          |
| `fork/templates/REVIEW-CHECKLIST.md` | HEAVY                        | Review of LIGHT output                                     |
| `fork/UPSTREAM-EDITS.md`             | any                          | Log of upstream file edits                                 |
| `fork/BASELINE.md`                   | B1, refreshed per rebase     | Pre-existing failures                                      |

## 9. Steady state (after B7)

| Loop                | Trigger                 | Model                    | Steps                                                                                                       |
| ------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| M1 Upstream rebase  | weekly                  | LIGHT                    | Rebase; checks; escalate core-path conflicts to next HEAVY run                                              |
| M2 Handbook update  | new handbook version    | HEAVY → LIGHT (1 switch) | HEAVY: `handbook-sync` diff → interpret → contract/rule changes + WOs. LIGHT: implement WOs, BadGEO, golden |
| M3 New golden audit | each manual field audit | HEAVY                    | Convert to `*.expected.yaml`; triage misses                                                                 |

## 10. Residual weaknesses

- [SPECULATIVE] Single-day completion: 28–41 Opus runs inside one Ultra weekly limit; depends on run length, remaining weekly usage at start, and capacity caps Anthropic may apply. Fallbacks: SPLIT before the limit, then limit reset / usage credits / weekly reset; STATE.md resumes exactly where it stopped.
- [SUPPORTED] On Ultra, SPLIT saves $0; its only effect is slower drain of the shared weekly limit. (On API billing it would save ≈25–30% before overhead — SPECULATIVE.)
- [SPECULATIVE] Auto-mode classifier may block legitimate steps (Vercel deploys, docker, Supabase migrations, bot-UA fetches); headless runs abort after repeated blocks, the driver retries, and the stall rule stops it. Narrow allow rules in settings carry over into auto mode; bypassPermissions only in isolation.
- [SPECULATIVE] Unattended external-service setup (Supabase schema, Vercel report publishing, drains) runs without a human eye; B4 publishes only after `supabase-harden.sql` passes; B5 security review (incl. Supabase advisors) is the full check.
- [SUPPORTED] The app lives on Ken's computer: schedules pause while it is off; nothing is reachable from a phone or another machine except published Vercel reports.
- [SUPPORTED] Always-on alternative without porting: upstream's own Cloudflare deploy with Postgres via Hyperdrive → Supabase; excluded because the stack is Vercel + Supabase + Ken's computer.
- [SPECULATIVE] Supabase session pooler caps concurrent clients (~15 per project reported); fine for one user, watch during large crawls.
- [SPECULATIVE] Subagent model routing: public bug reports show frontmatter/param model overrides not honored in some versions; levers stay OFF until B1 probe confirms.
- [SPECULATIVE] Fable 5.2's added cybersecurity safeguards may slow SSRF / bot-UA security work; B5 prefers Opus.
- [SUPPORTED] Golden audits were written under handbook v4.0 / v4.2; v4.6 rules produce extra findings — tolerance, not exact match.
- [SUPPORTED] Upstream moves fast (last commit 2026-11-13); rebase at each HEAVY batch start limits drift.
- [SPECULATIVE] Handbook phase memory inside the Workers isolate; mitigated by lazy loading, page batching, sidecar offload; ADR-001 fallback = separate workflow.
- [SUPPORTED] Cloudflare-only deploys cannot run the sidecar → RENDER/PERF/A11Y = LIMITED there.
- [SPECULATIVE] LIGHT batch quality depends on WO precision; review checklist + escalation rule are the guard.
