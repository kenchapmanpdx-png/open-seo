# SEO/GEO App — Build Plan (v3.3, 2026-11-14)

## Changelog

- v3.3: hosting = Ken's computer (app + sidecar) + Supabase (Postgres via upstream's Postgres path, Storage) + Vercel (published client reports, drain receiver). Mac Mini, Tailscale, Cloudflare Tunnel, standalone Docker deploy removed (BLUEPRINT §3.7, §7).
- v3.2: unattended build — `fork/scripts/autopilot.sh` drives `claude -p --permission-mode auto` runs until `STATE.md` says done; agent never asks or waits; all Ken inputs moved before start and checked by `fork/scripts/preflight.sh` (BLUEPRINT §1.7, §7).
- v3.1: default mode SINGLE — Opus 5.5 runs every batch, 0 model switches (plan: Claude Ultra; shared weekly limit, no five-hour limit when verified). SPLIT (Sonnet 5.5 for LIGHT batches) kept as a preemptive fallback when weekly usage runs low (BLUEPRINT §1.0).
- v3: execution moved to `fork/BLUEPRINT.md` — 7 model-batched sessions (HEAVY Opus 5.5/Fable 5.2 ↔ LIGHT Sonnet 5.5), 6 switches, work-order queue, STATE.md resume. Phase → batch: P0 + P1 task 1 → B1; P1 rest → B2; P2 → B3 (judgment) + B4 (surface); PD → B4; v1 sign-off → B5; P3/P4/P5/P6 → B5 design, B6 build, B7 review. Rebase cadence during build = start of each HEAVY batch. Golden expectations move to `fork/fixtures/expected/`. Universal command replaces the session-1 prompt.
- v2: kickoff prompt v1 superseded by `fork/KICKOFF.md` (v1 ran upstream's prebuilt Docker image, which excludes fork code; had no secrets stop, test baseline, or fixture comparison). P0 = local dev in WSL via `pnpm dev:agents`; Mac Mini deploy moved to new phase PD (fork image built from `compose.build.yaml`). Added `fork/` seed layout, `fork/FORK.md` rules, BadGEO fixture site (P1), upstream `tests/badseo` as reference. Upstream audit runs headless via `fork/scripts/upstream-audit.ts` (modeled on `tests/badseo/scripts/run-audit.ts`; no UI, no DataForSEO). `.prettierignore` gets `fork/handbook/` + `fork/fixtures/audits/` so verbatim sources are never reformatted (second allowed upstream edit).

## Decision

- Base: fork `every-app/open-seo` (MIT). Do not build from scratch.
- Moat: handbook-as-code — `on-site-seo-geo-reference-unified-v4.6.md` §41 compiled into an executable rule engine. Upstream audit is the weakest module; this is where the fork wins.
- Borrow (MIT, copy with attribution): `Canonry/canonry`, `elmohq/elmo`.

## Repo landscape (checked 2026-11-14)

| Repo                           | Stars                    | License      | What it is                                                                                  | Verdict                         |
| ------------------------------ | ------------------------ | ------------ | ------------------------------------------------------------------------------------------- | ------------------------------- |
| every-app/open-seo             | 27.7k / 3.9k forks       | MIT          | Full platform: keywords, rank, backlinks, audit, AI visibility, local, GSC/GA4, MCP, skills | BASE                            |
| AgriciDaniel/claude-seo        | 29.2k                    | MIT          | Claude Code skill suite, not an app                                                         | REFERENCE only                  |
| zubair-trabzada/geo-seo-claude | ~9–11k (catalog figures) | MIT          | Claude Code GEO skill, not an app                                                           | REFERENCE only                  |
| towfiqi/serpbear               | ~2.1k                    | MIT          | Rank tracker only                                                                           | SKIP — OpenSEO covers           |
| elmohq/elmo                    | 483                      | MIT          | AI visibility platform (TanStack Start, Postgres, pg-boss)                                  | BORROW                          |
| Canonry/canonry                | 196                      | MIT (≥5.0.0) | Agent-first AEO ops platform (SQLite, 20+ integrations)                                     | BORROW                          |
| LibreCrawl                     | ~980                     | MIT          | Crawler                                                                                     | SKIP                            |
| SiteOne Crawler                | ~917                     | MIT          | Crawler/QA, CI gates                                                                        | OPTIONAL deep-crawl later       |
| karust/openserp                | ~1.1k                    | MIT          | Self-hosted SERP scraping                                                                   | SKIP — CAPTCHA/proxy ops burden |
| danishashko/geo-aeo-tracker    | not checked              | not checked  | AI visibility via Bright Data                                                               | SKIP                            |

## OpenSEO inventory (from clone, commit 2026-11-13, v0.1.27)

- Size: ~240k lines TS/TSX; 1,102 commits on main; very active.
- Stack: TanStack Start, React, Vite, Tailwind, shadcn, TanStack Query/Form/Table, Drizzle (D1 SQLite + Postgres schemas), Better Auth, Cloudflare Workers + Workflows, Docker standalone runtime, AI SDK + OpenRouter (in-app agent "SAM"), MCP server, recharts, leaflet.
- Deploy: Docker Compose (`deploy/standalone/compose.yaml`) or Cloudflare (free plan). Docker min 4 GiB RAM.
- Data: DataForSEO for everything (keywords, SERP, backlinks, Labs, Lighthouse, business data, AI optimization). No provider abstraction beyond DataForSEO.
- Feature modules (`src/server/features/`): keywords, rank-tracking (organic + maps/local finder), backlinks, domain, audit, ai-visibility, ai-search (prompt explorer, share of voice, cited sources), local-seo (GBP info, reviews, Q&A), gsc, ga4, indexnow, reports, projects, sam.
- AI visibility engines: DataForSEO `ai_optimization` (ChatGPT, Claude, Perplexity, Gemini scraper, LLM mentions).
- Audit crawler: up to 10,000 pages; 1,000 with JS rendering; JS rendering via paid `context.dev` (`CONTEXT_API_KEY`).
- Audit issue set (`src/shared/audit-issues.ts`): 29 page/site issue types + 4 crawl-limit statuses. Issues: blocked-page, rate-limited-page, server-error, broken-page, broken-internal-link, slow-response, noindex-page, canonical-conflict, canonicalized-page, deep-page, orphan-page, javascript-rendering-suspected, missing-title, title-too-long, title-too-short, missing-meta-description, meta-description-too-long, meta-description-too-short, missing-h1, multiple-h1, heading-order-skip, thin-content, images-missing-alt, no-outgoing-links, duplicate-title, duplicate-meta-description, duplicate-content, redirect-chain, redirect-loop.

## Gaps vs handbook v4.6 (all SUPPORTED by code inspection)

- No llms.txt / `.md` mirror checks (§20–22).
- No robots.txt per-group evaluation, AI-bot UA fetch test, render-resource guard (§18, P9).
- No security-header-by-value checks (§14, P8).
- No JSON-LD parse/validation, @id integrity, placeholder-sentinel scan (§24, P6); only detects JSON-LD presence.
- No raw-vs-rendered diff, opacity:0 content, word-count delta (§14, §17, P2).
- No a11y (axe-core), contrast, target size (P8).
- og:title/description/image parsed but no OG issue type; no Twitter/viewport/max-image-preview/img width-height/LCP-img-in-HTML checks (P4, P7).
- No URL-inventory reconciliation (sitemap vs canonical vs internal links), trailing-slash/apex/HTTPS hop checks, soft-404 test (P3).
- No server-log AI crawler/referrer analytics.
- No Bing Webmaster Tools / Bing AI Performance.
- No REVIEW-mode scoring (EP-7), S1–S4 severity, evidence capture, checker-error reproduction.
- No `seo-geo-status.md` / client report export in handbook format.

## Borrow map

| From    | Module                                                                                             | Into                                       | Purpose                                                                           |
| ------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Canonry | `packages/integration-traffic/src/rules.ts`                                                        | `features/ai-traffic/`                     | AI crawler + AI referrer classification (operator, product, purpose, UA patterns) |
| Canonry | `packages/integration-vercel/` (drain, normalize)                                                  | `features/ai-traffic/providers/vercel`     | Vercel log drain ingestion — matches Ken's hosting                                |
| Canonry | `packages/integration-bing/`                                                                       | `features/bing/`                           | BWT + Bing AI Performance (handbook P10/P11)                                      |
| Canonry | `packages/integration-commoncrawl/` (DuckDB)                                                       | `features/backlinks/providers/commoncrawl` | Free domain-level backlink baseline; cuts DataForSEO spend                        |
| Elmo    | `packages/site-audit/src/{bots,fetcher,hosts}.ts`                                                  | `features/handbook/checks/ai-access`       | AI-bot fetch/access patterns                                                      |
| Elmo    | query fan-out storage, citation domain categorization (own/competitor/social/Google/institutional) | `features/ai-visibility/`                  | Richer AI visibility analysis                                                     |

- Do NOT borrow Elmo's Jev/TypeSafe judging dependency; implement mention/sentiment judging with own LLM call + evidence quote.

## Handbook-as-code engine

- Location: `src/server/features/handbook/` + `src/client/features/handbook/`. Zero edits to upstream audit files except one registration hook.
- Registry entry:
  ```ts
  { id: "P3-01", ref: "§10", handbookVersion: "4.6", tier: "T1+", gate: null | "SP7" | ..., mode: ["BUILD","AUDIT","REVIEW"],
    class: "CRAWL"|"HEADERS"|"ROBOTS"|"BOTFETCH"|"SCHEMA"|"RENDER"|"PERF"|"A11Y"|"LLM"|"DATA"|"OWNER",
    severityDefault: "S1"|"S2"|"S3"|"S4", evidence: [...required fields], check: (site, pages) => Finding[] }
  ```
- Statuses per item: PASS / finding ID / BLOCKED / N/A / LIMITED (handbook EP-7 vocabulary).
- Site Profile (SP1–SP12), tier (T1–T4), mode inferred at intake; gates filter applicable rules.
- Render sidecar: Docker service with Playwright + Chromium + axe-core; HTTP API `POST /render {url, ua, scroll:true}` → raw HTML, rendered DOM, screenshots, axe results, lab CLS/LCP. Replaces paid `context.dev` for handbook checks.
- LLM class: every finding must quote evidence text + URL; LLM findings never release-blocking; model via existing OpenRouter config (Claude via OpenRouter allowed).
- Checker-error rule: any third-party-sourced issue re-fetched directly before recording (handbook §0 Verification rules).
- Outputs: `seo-geo-status.md` (handbook format), client report (Vercel-published snapshot + PDF), MCP tools `handbook_audit_run`, `handbook_findings_get`, `handbook_status_export`.
- Handbook sync: script parses §41 of new handbook version → diffs item IDs/text vs registry → emits stub rules + TODO list. CI fails if a registry `ref` points to a missing §.
- Coverage estimate of 129 §41 items: ~60% deterministic, ~20% LLM-judged, ~20% DATA/OWNER (SPECULATIVE — exact mapping is P1 task 1).

## Hosting

- App: Ken's computer (WSL), production build via `fork/scripts/run-local.sh`; render sidecar on Docker Desktop (127.0.0.1).
- Database: Supabase Postgres via upstream's `DATABASE_PROVIDER=postgres` + local Hyperdrive connection string (Supabase session pooler).
- Storage: Supabase Storage (private buckets) for handbook evidence + report assets.
- Public client reports: static snapshots on Vercel (unguessable URL, `noindex`).
- Always-on receivers: Vercel Functions (drain ingestion → Supabase), B6.
- Superseded (v3.2): Docker standalone on Mac Mini + Tailscale + Cloudflare Tunnel; fork image via `compose.build.yaml`.
- Dev: WSL (repo in `~/`, not `/mnt/c/`), `pnpm dev:agents` → `http://open-seo.localhost:1355`, logs in `.logs/dev-server.log`.
- Rejected: port the app to Vercel — 88 files import `cloudflare:workers`; permanent fork from upstream. Rejected: Cloudflare-only deploy — no Playwright sidecar for render/a11y checks; outside the chosen stack.

## Costs

- App: $0 self-hosted (hosted openseo.so = $10/mo + 28% markup on DataForSEO).
- DataForSEO: $50 minimum deposit, credits don't expire; SERP $0.60/1k standard, $1.20 priority, $2.00 live.
- LLM: OpenRouter pay-per-use (SAM agent + LLM-class checks).
- Optional: Google OAuth app (GSC/GA4, free), Google Maps key (local SEO map).
- Supabase: free tier to start; free projects can pause when idle → Pro if that interrupts use (SPECULATIVE).
- Vercel: client reports for consulting = commercial use; Hobby is non-commercial only → Pro team for the reports project (SUPPORTED); drains also need Pro.

## Phases (exit criteria)

Execution order, dependencies, and model batching: `fork/BLUEPRINT.md` §4–§5.

| Phase | Scope                                                                                                                                                                                                                                                                                                                                                                                                        | Exit                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | Fork; local dev in WSL (`pnpm dev:agents`); DataForSEO key; GSC OAuth optional; test baseline (`fork/BASELINE.md`); upstream audits of whyracingevents + ryanmscottsdale; upstream-gap table vs golden audits                                                                                                                                                                                                | App runs; baseline + `fork/fixtures/upstream-gap.md` written                                                                                                                                                                                                                     |
| P1    | Task 1: registry (129 §41 items) + `fork/scripts/handbook-sync.ts` + `fork/coverage.md`. Task 2+: intake (SP/tier/mode); deterministic classes CRAWL, HEADERS, ROBOTS, BOTFETCH, SCHEMA; render sidecar; RENDER, PERF, A11Y; BadGEO fixture site `fork/fixtures/badgeo/` (static pages, one per deterministic rule, each declaring expected rule IDs; modeled on upstream `tests/badseo`, no upstream edits) | Golden fixtures: reproduces findings in `fork/fixtures/audits/whyracingevents-2026-11-13.md` and `fork/fixtures/audits/ryanmscottsdale-2026-11-13.md`; every miss logged with reason (`site-changed` allowed after re-fetch); BadGEO: every rule fires on its page, nothing else |
| P2    | LLM class; REVIEW score (EP-7); `seo-geo-status.md` export; client report; MCP tools                                                                                                                                                                                                                                                                                                                         | Report renders for both fixture sites; handbook-sync clean                                                                                                                                                                                                                       |
| PD    | Local production run on Supabase; sidecar on Docker Desktop; Supabase hardening; client report publish to Vercel                                                                                                                                                                                                                                                                                             | App runs from `run-local.sh`; published report opens publicly; Supabase advisors clean                                                                                                                                                                                           |
| P3    | AI crawler/referrer analytics (Vercel drain + Canonry rules); Bing WMT + Bing AI Performance                                                                                                                                                                                                                                                                                                                 | Bot hits by operator/purpose on one live Vercel site                                                                                                                                                                                                                             |
| P4    | AI visibility: BYOK direct APIs (OpenAI/Anthropic/Gemini/Perplexity with web search) beside DataForSEO; query fan-out; citation categories; §27 AI answer panel prompt lists                                                                                                                                                                                                                                 | Same prompt set comparable across both sources                                                                                                                                                                                                                                   |
| P5    | Agency layer: client workspaces, white-label report, +4/+12-week outcome record (handbook P11)                                                                                                                                                                                                                                                                                                               | One client report delivered end-to-end                                                                                                                                                                                                                                           |
| P6    | Cost cutters: Common Crawl backlink baseline; result caching                                                                                                                                                                                                                                                                                                                                                 | Backlink overview without DataForSEO call                                                                                                                                                                                                                                        |

## Fork rules (negative constraints; full set in `fork/FORK.md`)

- Never rewrite upstream modules; extend via new feature folders + minimal registration hooks.
- Rebase on upstream at the start of each HEAVY batch during the build, weekly after B7; one branch `ken/main`; feature branches off it.
- Never break DataForSEO paths; new data sources go behind a provider interface.
- Never scrape consumer AI UIs with personal accounts; use DataForSEO LLM endpoints or official APIs.
- Never use ranking/traffic/backlink data in REVIEW mode (EP-7).
- Never mark a finding without stored evidence (URL + fetched snippet/header/screenshot).
- Never let LLM-class findings block release.
- Upstream-worthy generic fixes → PR upstream, not fork-only.

## Open decisions (defaults applied)

| ID  | Decision                  | Default                                                                                         |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| D1  | Hosting                   | Ken's computer (app + sidecar) + Supabase (DB, storage) + Vercel (published reports, receivers) |
| D2  | Scope                     | Internal + client deliverables; SaaS productization deferred (no multi-tenant billing work)     |
| D3  | AI visibility source      | DataForSEO first; BYOK in P4                                                                    |
| D4  | App name / fork repo name | `<github-user>/<app-name>` placeholder until named                                              |

## Fork seed (`fork-seed-2026-11-14.zip` → unzip at repo root)

```
fork/
  FORK.md                      fork rules; auto-loaded via one import line in .claude/CLAUDE.md
  BLUEPRINT.md                 architecture, work packages, batch schedule, model protocol
  STATE.md                     current batch, required model, next action, run log
  KICKOFF.md                   before-start checklist, autopilot start, interactive fallback
  build-plan.md                this file
  batches/B1…B7-*.md           one file per model batch
  queue.md                     work-order queue
  templates/                   WO.md, ADR.md, REVIEW-CHECKLIST.md
  agents/                      light-helper.md (sonnet), heavy-escalation.md (opus) — optional levers
  claude-settings.suggested.json   copy to .claude/settings.local.json
  .gitignore                   ignores fork/runs/
  handbook/on-site-seo-geo-reference-unified-v4.6.md
  fixtures/audits/README.md    how to score against golden audits
  fixtures/audits/whyracingevents-2026-11-13.md
  fixtures/audits/ryanmscottsdale-2026-11-13.md
  scripts/                     preflight.sh + autopilot.sh (shipped); upstream-audit.ts, handbook-sync.ts, handbook-audit.ts, badgeo-run.ts, golden-score.ts (built in B1)
```

- Start: `bash fork/scripts/preflight.sh` (no MISS) → `bash fork/scripts/autopilot.sh`. Every run's prompt: `Read fork/STATE.md and continue the build.` (superseded: `Read fork/KICKOFF.md and execute it.`)
- Handbook updates later: replace file in `fork/handbook/`, run `pnpm tsx fork/scripts/handbook-sync.ts <file>`, implement the diff.

## Residual weaknesses

- Star counts drift fast; OpenSEO 27.7k, claude-seo 29.2k, Elmo 483, Canonry 196 read from GitHub pages 2026-11-14 (SUPPORTED); geo-seo-claude, SerpBear, crawler counts from catalogs/articles (SPECULATIVE for today).
- Upstream velocity → rebase conflicts; isolation rule mitigates (SUPPORTED: 1,102 commits, last commit 2026-11-13).
- Upstream's Postgres path is production-used upstream (Hyperdrive); local Hyperdrive → Supabase session pooler is the documented local mechanism (SUPPORTED); Supabase-specific behavior under long crawls untested (SPECULATIVE).
- §41 automation split is an estimate (SPECULATIVE).
- Single data vendor (DataForSEO) for most SEO data (SUPPORTED); Common Crawl/BYOK reduce, not remove, dependency.
- Scheduled rank/AI runs only happen while Ken's computer and the app are running (SUPPORTED).
