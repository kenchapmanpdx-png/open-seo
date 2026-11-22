# B17 — Handbook accuracy part 2 (§9 items #5–#12) · HEAVY (SINGLE: Opus 5.5)

Requirement text: `fork/DEPENDABILITY.md` §9 (item rows #5–#12 and backlog ids T5–T7, T9, T10, T12, T13, T16, T17). Rules and AT format: `fork/ACCURACY.md` §0, §3, §4. Inputs: `fork/reports/B15.md`, `fork/fixtures/expected/salonvata.com.expected.yaml` (B15 WO-B15-001), `fork/fixtures/audits/salonvata.com-app-vs-semrush-2026-11-19.md` (T-table, 101-check catalog with Note column), `fork/MAINTENANCE.md` M3, `fork/FORK.md`.

Rules:

- [Ken 2026-11-21] Build everything on the accuracy list; no deferral. Runs right after B15, then B16. Item #12 is last and may be skipped when usage runs out (queue row `deferred`).
- ACCURACY.md §0 rules carry over: fork paths only, no upstream edit, additive contract (1.9.0 → 1.10.0, ADR-032), no schema or migration change, every new finding has stored evidence and a BadGEO page, LLM-judged findings never gate. Live cost: CLI goldens no LLM; ≤ 2 in-app test-mode audits; LLM ≤ $0.50 for the batch.
- B13 rules still apply: `ops maint on` at the start of every run, secrets, test mode, ops verbs.
- After every work order: `pnpm types:check`, `pnpm lint`, `pnpm test`, `pnpm format:check` vs `fork/BASELINE.md`; three goldens + salonvata golden caught Δ ≥ 0; BadGEO 0 / 0; commit and push to `ken/main`.
- A golden entry that a new rule legitimately changes (grouping #5 merges F33–F47) is updated through loop M3 with the triage written in `fork/reports/B17.md`, never by hand-editing a verbatim source.

## R1 — Work orders

WO-B17-005 … 011 (one per §9 item #5–#11), WO-B17-012 (#12, optional), WO-B17-090 (exit). Template `fork/templates/WO.md`, Class HEAVY; rows in `fork/queue.md`. One ADR-032 for all contract additions.

Order (value first, dependencies respected):

1. #8 root-cause rules: WordPress attachment pages, theme demo content incl. lorem ipsum (T5, T6, T17). Folds the ~30 single attachment rows left by B15 P3-08 into one finding.
2. #5 grouping: one finding per rule with template / page groups (T12, T16).
3. #6 anchor text: empty anchors, generic external anchors (T7).
4. #7 entity rule: more than one business node, more than one `WebSite` node, or differing `name` values (T10).
5. #9 weak-link pages: sitemap URLs with exactly one inlink (T9, Handbook part).
6. #10 the 19 Semrush GAP checks (T13): catalog Note column priority, Must and Should first, Nice last; each as a Handbook check with evidence; skip none silently (cap note in the report).
7. #11 external-export importer + loop M6: `fork/scripts/import-external-audit.ts <xlsx>` maps export rows to registry items and lists misses both ways; add M6 to `fork/MAINTENANCE.md`.
8. #12 AI-judge stability (optional).

Checkpoint after each item.

## R-last — Exit (WO-B17-090)

- AT: salonvata golden caught count ≥ B15 exit value, every expectation tied to #5–#11 caught or partial; other goldens Δ ≥ 0; BadGEO 0 / 0; session-end checks green.
- Field test: if a Semrush export of a new site is in `fork/fixtures/audits/` (Ken supplies), run the importer, record misses both ways in `fork/reports/B17.md` as the next backlog; otherwise `BLOCKED-KEN` on this step only, continue.
- `fork/reports/B17.md`, `fork/BASELINE.md`, tag `handbook-v3.5.0`, STATE → B16.
