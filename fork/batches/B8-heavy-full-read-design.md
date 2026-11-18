# B8 — Full-read design · HEAVY (SINGLE: Opus 5.5)

Spec: `fork/FULL-READ.md` (read fully first). Also read: `fork/FORK.md`, `fork/BLUEPRINT.md` §3, `fork/adr/ADR-001…017`, `fork/MAINTENANCE.md` (M3), `fork/reports/B7.md`, `fork/reports/B2-golden.md`.
Rules: contracts, DB schema, migrations and upstream registration hooks change only in this batch and B10. [Ken] no external truth/legal verification (FULL-READ §0).
Secrets: never source or read `.env.local` in the agent shell; never print values. Use scripts that load their own config (`handbook-audit.ts`, `run-local.sh`). The sidecar is already running (Ken starts it before launch; `curl -s http://127.0.0.1:4777/health`). A step that still needs secrets in the shell → BLOCKED-KEN, continue.

## R1 — Rebase, measure, decide

1. `git fetch upstream`; rebase if new commits (FORK.md "Upstream sync"); refresh `fork/BASELINE.md` if failures changed.
2. Measure on current code, record in `fork/reports/B8.md`:
   - CLI wall time + peak RSS at `--max-pages` 60 / 200 / 500 (`fork/scripts/perf-500.ts` synthetic + whyracingevents live).
   - Sidecar throughput: renders/min at concurrency 1/2/3 on whyracingevents (running sidecar; rebuilds in R2 need Ken to restart it → BLOCKED-KEN note if the token is required).
   - In-app path memory ceiling (vite preview / workerd) at 200 and 500 pages; does the 128 MB Worker limit apply locally? Decides in-app vs local-runner handoff for large sites.
   - LLM: tokens per page (main text) on why/ryan/bluetree; Anthropic prices for `claude-haiku-5-5`, `claude-sonnet-5-5` from Anthropic's pricing docs → fix `llm/model.ts` price table if wrong (B7 run 25 assumed them).
3. ADRs (template `fork/templates/ADR.md`), each citing FULL-READ § and code paths:
   - ADR-018 Full-read runtime: depth model, caps, staged workflow, run queue, memory, in-app vs local-runner threshold (from R2 measurements).
   - ADR-019 LLM map → reduce → judge: PageProfile, cache key, extract model + fallback, budget formula, stability rule.
   - ADR-020 SUPP rules + operator-disabled items (P5-03 N/A, not scored; SUPP not scored).
   - ADR-021 Collection scale-up: headers in PageSnapshot, render-discovered links, beacon blocking, interstitial detector, escalation table, numeric parity, MinHash duplicates.
     Deviate from FULL-READ only with measured cause; record it in the ADR.

Checkpoint.

## R2 — Contracts 1.5.0 + schema

1. Contracts (bump `CONTRACTS_VERSION` 1.5.0; additive where possible):
   - K2: markup video fields (`preload`, `loop`, width/height / `aspect-ratio`, `sources[]`, `tracks[]`, `inRawHtml`) + `embeds[]` (provider, videoId, src, `loading`, size, facade) (FULL-READ §3.12); `PageSnapshot.headers`, `ttfbMs`; crawl `discoveredBy: raw|sitemap|seed|render`; coverage `{discovered, read, capped}`; template boilerplate split (FULL-READ §3.11).
   - K3: render request `transferBytes`, `aborted`, `protocol`; `blockBeacons` request flag; media requests recorded + aborted (never downloaded); per video / embed element first-screen flag + reserved-size flag; batch endpoint or client-side concurrency (choose in ADR-021); `fork/sidecar/openapi.yaml` + sidecar implementation.
   - K14 `PageProfile` (Zod; incl. `videoText` transcript|summary|none, `sections[]` {heading, isQuestion, answerFirst}, FAQ pairs {question, answerWords, standsAlone}) + K15 `SiteFactMap` (Zod).
   - Registry: `registry-supp.ts` types (SUPP-nn), report section "Additional findings".
   - Escalation log type in report contract.
2. Schema both dialects (`src/db/` SQLite + Postgres; parity test must pass): `handbook_page_profile`, `handbook_run_stage`, `handbook_run_lease`, run `depth` + coverage columns. Migrations up + down round-trip; `fork/scripts/supabase-harden.sql` covers new tables; `run-local.sh migrate` on Supabase.
3. Sidecar: implement K3 additions; `docker compose -f fork/sidecar/compose.yaml build`; sidecar tests (unit, no live container). The running container keeps the old image until Ken restarts it (token needed) — see Exit.
4. Session-end checks; commit; push.

Checkpoint.

## R3 — Goldens + evals

1. M3 (`fork/MAINTENANCE.md`): `fork/fixtures/audits/bluetreefunding-2026-11-15.md` (verbatim source added by Ken, read-only; README row present) → `fork/fixtures/expected/bluetreefunding.com.expected.yaml` (every finding + Passes line, `detectableBy`). F12 (Section 179 currency) = `truth-verification [Ken]`, excluded from catch rate; F13 keeps conflicts + unsourced (on-page).
2. Re-classify golden findings that are SUPP or outside-scope: map to SUPP ids / `outside-scope`; keep `detectableBy`. Findings or notes covering only the dropped items (FULL-READ §6: sensitive forms, SPF/DMARC, author archives, generator meta) → `outside-scope [Ken]`. bluetree F10 video part (hero `preload="auto"`, autoplay files 6.2–16.2 MB) → P7-01 + SUPP-08.
3. Judge eval: rebuild `why-F19` with llms.txt + the site pages that state the event count; add cases for bluetree F12–F15 content items **excluding** truth verification (F12 Section 179 currency → drop; keep "unsourced / conflicting").
4. New extraction eval `fork/evals/extract/`: per golden, the quotes a PageProfile must contain (stats, names, superlatives, placeholders, awards); scorer script `fork/scripts/extract-eval.ts` (spec here, built in B9).

Checkpoint.

## R4 — B9 queue

WOs (template `fork/templates/WO.md`), one per row, explicit files, acceptance commands, BadGEO page(s) each. Suggested order and grouping:
| WO | Scope |
|---|---|
| WO-B9-001 | Depth flag + caps + stratified fill + coverage line (CLI + app) |
| WO-B9-002 | Crawl: render-discovered links second pass; per-pattern caps; canonical dedupe |
| WO-B9-003 | PageSnapshot headers; headers collector uses them + asset-type probes |
| WO-B9-004 | Render all pages (concurrency, beacons, transferBytes, page weight) |
| WO-B9-005 | JS-off render escalation + opacity-0 per page |
| WO-B9-006 | Axe all rendered pages; merge per rule/template |
| WO-B9-007 | Lighthouse per template + heaviest + escalations |
| WO-B9-008 | Interstitial/challenge detector (vendor + generic + hash) |
| WO-B9-009 | Bot-parity escalation all pages × 5 bots ×2; plain-HTTP probes; safety stops |
| WO-B9-010 | Numeric parity raw vs render (SUPP-04) |
| WO-B9-011 | MinHash duplicates (clusters ≥ 0.8 → P3-12) + thin pages (< 50 words → P3-12; list → P5-15 view) + in-page duplicate blocks (SUPP-03) |
| WO-B9-012 | Outbound links all unique (cap 500) |
| WO-B9-013 | Images sized from render requests (P2-05) |
| WO-B9-014 | .md mirror escalation |
| WO-B9-015 | LLM map stage + PageProfile + quote verification + cache |
| WO-B9-016 | Reduce: SiteFactMap (conflicts, names, inventories, thin pages, coverage) |
| WO-B9-017 | Judge rewiring: targeted views from fact map; all head lines for P4-02/P4-07 |
| WO-B9-018 | Budget formula, concurrency, backoff, stability rule |
| WO-B9-019 | P5-03 off by default → N/A (operator) |
| WO-B9-020 | SUPP-01…07 checks + "Additional findings" section |
| WO-B9-021 | Staged workflow steps + `handbook_run_stage` + resume |
| WO-B9-022 | Run lease/queue + pool max 5 |
| WO-B9-023 | Storage gzip + retention + quota warning |
| WO-B9-024 | Run page progress (stage, pages, escalations, spend) |
| WO-B9-025 | Extraction eval script + cases |
| WO-B9-026 | Synthetic 1000-page perf site + perf script `--depth full` |
| WO-B9-027 | Template boilerplate split + per-template map call |
| WO-B9-028 | AI-bot policy map (home × ≈ 23 UA tokens vs robots groups) |
| WO-B9-029 | CrUX field data when `CRUX_API_KEY` set (P7-10), else BLOCKED-KEN |
| WO-B9-032 | Video & embeds (FULL-READ §3.12): media recorded + aborted, HEAD / Range sizes, page weight incl. load-time video, P7-01 size cap, SUPP-08…12, `videoText`; BadGEO serves a fake media URL that answers HEAD with a large `Content-Length` (no video files in the repo) |
| WO-B9-033 | Answer-engine set (FULL-READ §6): SUPP-13 snippet blockers (meta + `X-Robots-Tag` + `data-nosnippet` share), SUPP-14 fake lists, SUPP-15 question headings + answer-first, SUPP-16 stand-alone FAQ answers; report section "Answer-engine readiness" |
| WO-B9-031 | `HANDBOOK_LIGHTHOUSE` = `templates` or `all` (`all`: batches of 25, mobile only, run cap +0.6 min/page, time estimate shown before start) |
| WO-B9-090 | Integration pass: BadGEO, 3 goldens `--depth full --sidecar --llm`, evals, perf; report |

- Mark WOs needing contract/schema not done in R2 as R2 follow-ups now, not ESCALATE later.
- Fill `fork/queue.md`.

## Exit

- `fork/reports/B8.md`: measurements, ADR list, contracts 1.5.0 summary, goldens/evals, WO count.
- STATE: B8 done → B9 (`current_batch: B9`, `batch_file`, `next_action: B9 first WO`); commit + push.
- If the sidecar image changed (R2.3): set `status: needs-ken` (planned checkpoint; overrides protocol rule 8) with `needs_ken: restart sidecar: cd ~/open-seo && grep '^HANDBOOK_SIDECAR_TOKEN=' .env.local > .env.sidecar && docker compose --env-file .env.sidecar -f fork/sidecar/compose.yaml up -d --build; rm -f .env.sidecar; curl -s http://127.0.0.1:4777/health` (token handed to Docker in a throwaway gitignored file; a shell-exported token did not reach Compose on Ken's PC, 2026-11-18). Ken runs it, then relaunches autopilot; next run sets `status: in-progress` and starts B9.
