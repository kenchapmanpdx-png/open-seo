# STATE (read first, every run)

autonomy: AUTOPILOT (AUTOPILOT = unattended, BLUEPRINT §1.7; INTERACTIVE = Ken typed the command in a live session)
mode: SINGLE (SINGLE = Opus 5.5 for every batch; SPLIT = fallback, BLUEPRINT §1.0)
status: in-progress (not-started | in-progress | needs-ken | done)
needs_ken: (empty unless status = needs-ken: one line per item Ken must do)
current_batch: B4
batch_file: fork/batches/B4-light-product-deploy.md
required_model: Opus 5.5 (SINGLE) · SPLIT: per batch table below
current_run: 13
next_action: B4 — continue the queue at WO-B4-010 (run page grade card), then 011…015 (executor protocol in fork/batches/B2-light-deterministic.md). WO-B4-001…009 done (003 ESCALATE part → WO-B5-C13 contracts 1.3.0 in B5). Eval: 21 cases built in fork/evals/cases (r13b sidecar runs); `llm-eval.ts run` BLOCKED-KEN until OpenRouter credits are topped up (WO-B3-EVAL). Sidecar token: the running sidecar's token is unknown to a new run — in ONE shell: `export HANDBOOK_SIDECAR_TOKEN=$(openssl rand -hex 24); docker compose -f fork/sidecar/compose.yaml up -d --force-recreate`, wait for /health, then run the CLI with `--sidecar http://127.0.0.1:4777` (template: run both golden sites with --llm ≈ 140 s + 100 s). Route tree: new routes need `src/routeTree.gen.ts` regenerated (`pnpm exec vite dev` ~45 s). Carry-over BLOCKED-KEN: OpenRouter credits; in-app UI smoke (Playwright host libs). BadGEO harness not re-run this run (do it in WO-B4-015).
contracts_version: 1.2.0 (B3 R2: additive `CheckContext.judge`, llms `text`; 1.1.0 B3 R1 `requests[].beforeLoad`; 1.0.0 frozen at end of B1)
extra_site: (Ken: optional third site URL for regression runs; blank = skip)
levers: L1=off L2=off (B1 R5 probe decides; SPLIT only)

## Protocol (every run)

1. Never ask Ken a question and never wait for input. Unclear → choose the documented default (BLUEPRINT, ADRs, build-plan) or the most conservative reversible option; record the choice in the batch report.
2. Model guard: SINGLE → must be Opus 5.5 (Fable 5.2 accepted). SPLIT → own model vs batch's Model column. Mismatch → set `status: needs-ken`, `needs_ken: switch model to …`, commit, exit.
3. Set `status: in-progress`. Open `batch_file`; resume at `next_action`.
4. Missing credential or access (run `bash fork/scripts/preflight.sh`; never read `.env*`) → mark only the dependent WOs/steps `BLOCKED-KEN` and continue everything else.
5. End of run scope or ~70% context: commit (every run must produce ≥1 commit; it is the autopilot progress signal), update this file (run log, next_action). AUTOPILOT → exit. INTERACTIVE → keep going (auto-compact handles context).
6. Batch exit gate met → write `fork/reports/{batch}.md`, set next batch below, commit + push. SINGLE → continue into the next batch. SPLIT → `status: needs-ken`, `needs_ken: switch model to …`, exit.
7. B7 complete → `status: done`; `needs_ken:` lists every `BLOCKED-KEN` item left in `fork/queue.md`; commit + push.
8. `status: needs-ken` only when no remaining work in the current or any later batch can proceed without Ken.
9. Ken switches to SPLIT (weekly usage low) → follow SPLIT rules from the next run. Weekly limit fully reached → autopilot stops; resume later with the same command.

## Batch sequence

| Batch | File                                    | Model (SPLIT) | Status      |
| ----- | --------------------------------------- | ------------- | ----------- |
| B1    | fork/batches/B1-heavy-foundation.md     | HEAVY         | done        |
| B2    | fork/batches/B2-light-deterministic.md  | LIGHT         | done        |
| B3    | fork/batches/B3-heavy-judgment.md       | HEAVY         | done        |
| B4    | fork/batches/B4-light-product-deploy.md | LIGHT         | in-progress |
| B5    | fork/batches/B5-heavy-v1-signoff.md     | HEAVY (Opus)  | —           |
| B6    | fork/batches/B6-light-integrations.md   | LIGHT         | —           |
| B7    | fork/batches/B7-heavy-v2.md             | HEAVY         | —           |

## Run log

| Run | Date       | Model    | Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Next  |
| --- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | 2026-11-14 | Opus 5.5 | B1 R1: fork wiring, Supabase migrate + harden, app on Postgres, baseline green, upstream headless audit ×2, upstream-gap                                                                                                                                                                                                                                                                                                                                                                               | B1 R2 |
| 2   | 2026-11-14 | Opus 5.5 | B1 R2: registry 129 (JSON + Zod), handbook-sync 0 diffs, registry test, coverage.md, golden expected YAML ×2                                                                                                                                                                                                                                                                                                                                                                                           | B1 R3 |
| 3   | 2026-11-14 | Opus 5.5 | B1 R3: ADR-001…010, contracts K1–K8 (`contracts/*.ts`, `fork/sidecar/openapi.yaml`), CONTRACTS_VERSION 1.0.0                                                                                                                                                                                                                                                                                                                                                                                           | B1 R4 |
| 4   | 2026-11-14 | Opus 5.5 | B1 R4: handbook schema both dialects + migrations, engine (safeFetch, collectors K2, intake, runner), repo/service/fns, workflow hook, CLI, BadGEO skeleton + harness, golden scorer                                                                                                                                                                                                                                                                                                                   | B1 R5 |
| 5   | 2026-11-14 | Opus 5.5 | B1 R5: 5 exemplar checks + BadGEO (exit 0), pre-freeze K2/K3 additions + fetchOffsite, 38 WO-B2 + queue, B1 exit gate met, B1 report                                                                                                                                                                                                                                                                                                                                                                   | B2 r1 |
| 6   | 2026-11-14 | Opus 5.5 | B2 r1: WO-B2-001…015 + 017…020 done (harness --only/golden md/timing; 19 checks CRAWL/ROBOTS/HEADERS/SCHEMA/PERF; outbound collector via fetchOffsite; crawler redirect stubs; home asset probes); BadGEO 31 pages exit 0; tests 2126 pass                                                                                                                                                                                                                                                             | B2 r2 |
| 7   | 2026-11-14 | Opus 5.5 | B2 r2: WO-B2-016, 021…026, 033 done (About people/editorial, Event, LocalBusiness, ItemList/Breadcrumb/Article, FAQ/Review/Product/brand visibility, raw-HTML a11y; K3 sidecar in Docker + render/axe/lighthouse collectors + CLI --sidecar); BadGEO 34 pages exit 0; tests 2146 pass                                                                                                                                                                                                                  | B2 r3 |
| 8   | 2026-11-14 | Opus 5.5 | B2 r3: WO-B2-027…036 done, 037 partial (RENDER parity, first screen + consent LCP, render-resource guard, Lighthouse lab/weight/hints, third-party + hero video, axe rules, AUDIT Mode 1/2, intake tier/SP3/SP7/SP9 + platform; handbook tab + run page); sidecar LCP fix; BadGEO 38 pages exit 0 with sidecar; golden tiers T2/T3 match; tests 2164 pass                                                                                                                                              | B2 r4 |
| 9   | 2026-11-14 | Opus 5.5 | B2 r4: WO-B2-037 done (evidence tab + tenant-scoped `getHandbookEvidence` with signed URL, checklist filters, tenant test), WO-B2-038 done (BadGEO 38 pages 0 missing with sidecar; golden caught whyracing 2→14/30, ryanmscottsdale 6→20/36); B2 exit gate met, fork/reports/B2.md; tests 2165 pass                                                                                                                                                                                                   | B3 R1 |
| 10  | 2026-11-14 | Opus 5.5 | B3 R1: no upstream commits (no rebase); review checklist (3 check defects fixed: P4-01 suffix majority + description length, P3-01 target-before-hops + S4 chains, P7-04 `beforeLoad` via contracts 1.1.0/sidecar 1.1.0; route files logged in UPSTREAM-EDITS); P1-04 closed as runner verdict; intake gates API/backend + hero video; golden whyracing 14→17 (+3 site-changed), ryan 20→21; BadGEO 0 missing/unexpected; B3 R2 started: K5 judge core + tests; tests 2170 pass                        | B3 R2 |
| 11  | 2026-11-14 | Opus 5.5 | B3 R2: K5 judge wired into runner (no key / budget → BLOCKED), OpenRouter model + price table (`HANDBOOK_LLM_MODEL`), `handbook_llm_call` persistence, CLI `--llm`; 5 exemplar LLM checks + cross-page fact table (P5-02/P9-02); eval set (10 cases) + `llm-eval.ts`, threshold in ADR-007; contracts 1.2.0; live: why 14→15, ryan 21→22 golden caught; OpenRouter credits exhausted → eval run BLOCKED-KEN; tests 2175 pass                                                                           | B3 R3 |
| 12  | 2026-11-14 | Opus 5.5 | B3 R3: EP-7 scorer (K6) in report.json + `scoreReport` re-scoring; golden grades why 39 (Δ0) / ryan 47.8 (Δ−0.2) on sidecar runs; P3-20 XHR-only → S2 (Squarespace telemetry false S1 cap); K7 markdown exports (EP-5 status file, audit baseline, EP-7 review report); ADR-011 runtime, ADR-012 exports                                                                                                                                                                                               | B3 R4 |
| 13  | 2026-11-14 | Opus 5.5 | B4 r1: WO-B4-001…009 — LLM checks P5-06/P5-11/P5-15, P4-07/P5-09/P2-03, P5-03 (no source fetch: ESCALATE → WO-B5-C13), entity test v2 name mentions; golden leftovers P7-05 fonts, P8-02 template labels, P3-11 canonical twin; runner process verdicts P1-03/RV-01 + export-confirmed P0-01/P0-02/RV-02, platform, provisional line; seo-owner-todo.md; client report HTML (≤ 500 KB); publish to upstream Reports + run page actions; 21 eval cases (eval run BLOCKED-KEN: credits); tests 2205 pass | B4 r2 |

## Batch history

| Batch | Model    | Started    | Finished   | Report             |
| ----- | -------- | ---------- | ---------- | ------------------ |
| B1    | Opus 5.5 | 2026-11-14 | 2026-11-14 | fork/reports/B1.md |
| B2    | Opus 5.5 | 2026-11-14 | 2026-11-14 | fork/reports/B2.md |
| B3    | Opus 5.5 | 2026-11-14 | 2026-11-14 | fork/reports/B3.md |
| B4    | Opus 5.5 | 2026-11-14 | —          | fork/reports/B4.md |
