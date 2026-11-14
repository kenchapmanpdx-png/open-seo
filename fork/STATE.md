# STATE (read first, every run)

autonomy: AUTOPILOT (AUTOPILOT = unattended, BLUEPRINT §1.7; INTERACTIVE = Ken typed the command in a live session)
mode: SINGLE (SINGLE = Opus 5.5 for every batch; SPLIT = fallback, BLUEPRINT §1.0)
status: in-progress (not-started | in-progress | needs-ken | done)
needs_ken: (empty unless status = needs-ken: one line per item Ken must do)
current_batch: B1
batch_file: fork/batches/B1-heavy-foundation.md
required_model: Opus 5.5 (SINGLE) · SPLIT: per batch table below
current_run: 1
next_action: B1 R1 — fork wiring, app running, test baseline, headless upstream audit, upstream-gap
contracts_version: none (frozen at end of B1)
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
| B1    | fork/batches/B1-heavy-foundation.md     | HEAVY         | not-started |
| B2    | fork/batches/B2-light-deterministic.md  | LIGHT         | —           |
| B3    | fork/batches/B3-heavy-judgment.md       | HEAVY         | —           |
| B4    | fork/batches/B4-light-product-deploy.md | LIGHT         | —           |
| B5    | fork/batches/B5-heavy-v1-signoff.md     | HEAVY (Opus)  | —           |
| B6    | fork/batches/B6-light-integrations.md   | LIGHT         | —           |
| B7    | fork/batches/B7-heavy-v2.md             | HEAVY         | —           |

## Run log

| Run | Date | Model | Done | Next |
| --- | ---- | ----- | ---- | ---- |

## Batch history

| Batch | Model | Started | Finished | Report |
| ----- | ----- | ------- | -------- | ------ |
