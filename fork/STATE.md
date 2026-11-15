# STATE (read first, every run)

autonomy: AUTOPILOT (AUTOPILOT = unattended, BLUEPRINT §1.7; INTERACTIVE = Ken typed the command in a live session)
mode: SINGLE (SINGLE = Opus 5.5 for every batch; SPLIT = fallback, BLUEPRINT §1.0)
status: in-progress (not-started | in-progress | needs-ken | done)
needs_ken: (empty unless status = needs-ken: one line per item Ken must do)
current_batch: B3
batch_file: fork/batches/B3-heavy-judgment.md
required_model: Opus 5.5 (SINGLE) · SPLIT: per batch table below
current_run: 9
next_action: B3 R1 — `git fetch upstream` (rebase if new commits; rerun baseline), review B2 commits with fork/templates/REVIEW-CHECKLIST.md, close escalation P1-04 (needs upstream checker issues in CollectedData → contract minor bump; sidebar nav escalation done in run 9), golden triage of every missed/partial in fork/reports/B2-golden.md (notes in fork/reports/B2.md: whyracingevents F03/F12 covered by BadGEO but missed on the live site — check drift vs URL matching). Sidecar: `export HANDBOOK_SIDECAR_TOKEN=$(openssl rand -hex 24)` then `docker compose -f fork/sidecar/compose.yaml -f fork/sidecar/compose.badgeo.yaml up -d` and the CLI with `--sidecar http://127.0.0.1:4777` in the same shell call. Route tree: new routes need `src/routeTree.gen.ts` regenerated (`pnpm exec vite dev` ~45 s). Carry-over BLOCKED-KEN: in-app UI smoke (Playwright system libs on host).
contracts_version: 1.0.0 (frozen at end of B1, 2026-11-14; R5 added pre-freeze K2/K3 fields)
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
| B3    | fork/batches/B3-heavy-judgment.md       | HEAVY         | in-progress |
| B4    | fork/batches/B4-light-product-deploy.md | LIGHT         | —           |
| B5    | fork/batches/B5-heavy-v1-signoff.md     | HEAVY (Opus)  | —           |
| B6    | fork/batches/B6-light-integrations.md   | LIGHT         | —           |
| B7    | fork/batches/B7-heavy-v2.md             | HEAVY         | —           |

## Run log

| Run | Date       | Model    | Done                                                                                                                                                                                                                                                                                                                                                      | Next  |
| --- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | 2026-11-14 | Opus 5.5 | B1 R1: fork wiring, Supabase migrate + harden, app on Postgres, baseline green, upstream headless audit ×2, upstream-gap                                                                                                                                                                                                                                  | B1 R2 |
| 2   | 2026-11-14 | Opus 5.5 | B1 R2: registry 129 (JSON + Zod), handbook-sync 0 diffs, registry test, coverage.md, golden expected YAML ×2                                                                                                                                                                                                                                              | B1 R3 |
| 3   | 2026-11-14 | Opus 5.5 | B1 R3: ADR-001…010, contracts K1–K8 (`contracts/*.ts`, `fork/sidecar/openapi.yaml`), CONTRACTS_VERSION 1.0.0                                                                                                                                                                                                                                              | B1 R4 |
| 4   | 2026-11-14 | Opus 5.5 | B1 R4: handbook schema both dialects + migrations, engine (safeFetch, collectors K2, intake, runner), repo/service/fns, workflow hook, CLI, BadGEO skeleton + harness, golden scorer                                                                                                                                                                      | B1 R5 |
| 5   | 2026-11-14 | Opus 5.5 | B1 R5: 5 exemplar checks + BadGEO (exit 0), pre-freeze K2/K3 additions + fetchOffsite, 38 WO-B2 + queue, B1 exit gate met, B1 report                                                                                                                                                                                                                      | B2 r1 |
| 6   | 2026-11-14 | Opus 5.5 | B2 r1: WO-B2-001…015 + 017…020 done (harness --only/golden md/timing; 19 checks CRAWL/ROBOTS/HEADERS/SCHEMA/PERF; outbound collector via fetchOffsite; crawler redirect stubs; home asset probes); BadGEO 31 pages exit 0; tests 2126 pass                                                                                                                | B2 r2 |
| 7   | 2026-11-14 | Opus 5.5 | B2 r2: WO-B2-016, 021…026, 033 done (About people/editorial, Event, LocalBusiness, ItemList/Breadcrumb/Article, FAQ/Review/Product/brand visibility, raw-HTML a11y; K3 sidecar in Docker + render/axe/lighthouse collectors + CLI --sidecar); BadGEO 34 pages exit 0; tests 2146 pass                                                                     | B2 r3 |
| 8   | 2026-11-14 | Opus 5.5 | B2 r3: WO-B2-027…036 done, 037 partial (RENDER parity, first screen + consent LCP, render-resource guard, Lighthouse lab/weight/hints, third-party + hero video, axe rules, AUDIT Mode 1/2, intake tier/SP3/SP7/SP9 + platform; handbook tab + run page); sidecar LCP fix; BadGEO 38 pages exit 0 with sidecar; golden tiers T2/T3 match; tests 2164 pass | B2 r4 |
| 9   | 2026-11-14 | Opus 5.5 | B2 r4: WO-B2-037 done (evidence tab + tenant-scoped `getHandbookEvidence` with signed URL, checklist filters, tenant test), WO-B2-038 done (BadGEO 38 pages 0 missing with sidecar; golden caught whyracing 2→14/30, ryanmscottsdale 6→20/36); B2 exit gate met, fork/reports/B2.md; tests 2165 pass                                                      | B3 R1 |

## Batch history

| Batch | Model    | Started    | Finished   | Report             |
| ----- | -------- | ---------- | ---------- | ------------------ |
| B1    | Opus 5.5 | 2026-11-14 | 2026-11-14 | fork/reports/B1.md |
| B2    | Opus 5.5 | 2026-11-14 | 2026-11-14 | fork/reports/B2.md |
| B3    | Opus 5.5 | 2026-11-14 | —          | fork/reports/B3.md |
