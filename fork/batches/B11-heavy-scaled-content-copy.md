# B11 — Scaled content, copy quality, copy rules · HEAVY (SINGLE: Opus 5.5)

Spec: `fork/SCALED-COPY.md` (read fully first). Also read: `fork/research/human-writing-guide-v1-excerpts-2026-11-18.md`, `fork/skills/copy-rules/SKILL.md`, `fork/FULL-READ.md` §0, §3.5, §3.11, §5, §6, `fork/reports/B10.md`, the full-read ADRs, `fork/FORK.md`.

Rules:

- [Ken] Rankings / SEO / GEO scope; no truth or legal verification; no AI-detector verdicts or authorship wording anywhere (SCALED-COPY §0).
- [Ken] No approval stops. Never set `status: needs-ken` in this batch except STATE protocol rule 2 (model guard). Unclear → SCALED-COPY default, else most conservative reversible option; record in `fork/reports/B11.md`.
- Contracts and schema may change here (HEAVY), additive only. No sidecar image change. No new npm dependencies. Upstream edits: only the one SAM glob line (WO-B11-007); log in `fork/UPSTREAM-EDITS.md`. UI lives inside the existing Handbook tab (no new route file).
- Secrets: never source or read `.env*`; use scripts that load their own config (`handbook-audit.ts`, `run-local.sh`). A step that still needs secrets in the shell → BLOCKED-KEN for that step only; continue.
- Live audits one at a time. Paid calls only in the SUPP-18 live acceptance step (cap $0.01 lookups, $0.20 LLM) and LLM acceptance runs already budgeted by FULL-READ §5.6.
- Do not edit `fork/research/` or the rules in `fork/skills/copy-rules/SKILL.md` (format-only fixes allowed).

## R1 — Rebase, verify inputs, decide

1. `git fetch upstream`; rebase if new commits (FORK.md "Upstream sync"); refresh `fork/BASELINE.md` if failures changed.
2. Verify what SCALED-COPY §1 column "Exists (after B9)" lists: `registry-supp.ts` + "Additional findings", P3-12 fed by duplicate clusters (Jaccard ≥ 0.8) and thin pages (< 50 words), boilerplate split, PageProfile + cache, per-run options plumbing. Missing piece → add it to R2 (SCALED-COPY §7 row 1).
3. Measure on the stored B10 golden runs (no new crawl), record in `fork/reports/B11.md`:
   - shared-sentence ratio per template for why / ryan / bluetree; candidate SUPP-17 sets at 0.5, 0.6, 0.7;
   - copy-quality metric medians and p90 per site (run the metric functions once they exist; fill in R4 if not yet built);
   - SUPP-19 pattern hits (expect 0 on the goldens; any hit → inspect, keep or tighten Pattern A / B).
4. SAM smoke: does SAM chat return a model answer to a one-line prompt in the local app (`fork/scripts/ui-smoke.mjs` extension or a direct server call)? Record yes / no. No → WO-B11-007 `skipped`.
5. ADRs (template `fork/templates/ADR.md`, next free numbers; expected ADR-022…024), each citing SCALED-COPY § and code paths:
   - Scaled-content rules: precedence P5-09 → P3-12 → SUPP-17, shared helpers, SUPP-19 hidden-text signals available without a sidecar change.
   - Copy quality: text extraction, tokenization, where metrics live in the report contract, per-run option.
   - SERP originality + copy rules delivery: evidence-store cache, budgets, REVIEW guard; `copy-rules.json` generation; MCP / UI / SAM surfaces.
     Deviate from SCALED-COPY only with measured cause; record it in the ADR.

Checkpoint.

## R2 — Contracts + work orders

1. Contracts (bump `CONTRACTS_VERSION` minor from the B10 value; additive):
   - `registry-supp.ts`: SUPP-17, SUPP-18, SUPP-19 (refs, class, severityDefault, evidence) per SCALED-COPY §3.
   - Report contract: sections `scaledContent` (§3.5) and `copyQuality` (§4.4, optional); run options `copyQuality`, `serpOriginality`.
   - New Zod contracts: copy metrics (per page + site) and SERP originality (query, results, competitor fetch status, verdict, BLOCKED reasons).
   - K8: MCP tool `handbook_copy_rules_get`; `handbook_findings_get` result field `copyRules`.
2. Schema: none expected (report JSON holds the sections; competitor profiles reuse `handbook_page_profile`; SERP cache in the evidence store). If R1 proves a table is needed → both dialects, migrations up + down, parity test, `fork/scripts/supabase-harden.sql`, `run-local.sh migrate`.
3. Work orders (template `fork/templates/WO.md`; explicit files, acceptance commands, BadGEO or fixture pages each); fill `fork/queue.md`:

| WO         | Scope                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WO-B11-001 | Copy metrics library (SCALED-COPY §4.2–4.3): pure functions, one unit test per metric id                                                                                                    |
| WO-B11-002 | Copy quality section: gate, flag + per-run option + CLI flag, report JSON, run page block, markdown export, label line verbatim; fixtures (one page over on all, one control page)          |
| WO-B11-003 | SUPP-17 templated / variation sets: shared helpers with P5-09, H1 + slug swaps, precedence, P5-09 judge-view evidence; BadGEO pages                                                         |
| WO-B11-004 | SUPP-19 text instructing AI assistants: raw-HTML + existing render signals, Pattern A / B; BadGEO pages                                                                                     |
| WO-B11-005 | Scaled-content summary block (report + run page)                                                                                                                                            |
| WO-B11-006 | Copy rules in the app: `fork/scripts/copy-rules-sync.ts` (+ `--check`), `copy-rules.json`, sync test, MCP tool, findings hint, Handbook tab "Copy rules" dialog, `ui-smoke.mjs` check       |
| WO-B11-007 | SAM chat loads `fork/skills/*/SKILL.md` (one glob line in `src/server/features/sam/samSkills.ts`; fix any skill-list test); only if R1 step 4 = yes                                         |
| WO-B11-008 | SUPP-18 collection: page selection, query derivation (one call), DataForSEO lookup + 7-day cache, off-site fetch, competitor profiles                                                       |
| WO-B11-009 | SUPP-18 verdict: judge view, quote verification, budgets, REVIEW → N/A, BLOCKED states, per-run option + CLI flags; stub fixtures `fork/fixtures/serp-originality/`                         |
| WO-B11-010 | Docs: RUNBOOK (flags, costs, what each block means), MAINTENANCE M4 (guide refresh: re-check excerpts, thresholds and the pack by 2027-05-18 or on a new guide version), `fork/coverage.md` |
| WO-B11-090 | Integration pass: BadGEO, fixtures, 3 goldens, speed, SUPP-18 live step; report                                                                                                             |

Checkpoint.

## R3 — Build

- Executor protocol: `fork/batches/B2-light-deterministic.md` § "Executor protocol (all LIGHT batches)", steps 0–8, with HEAVY rights (contract follow-ups allowed in place, recorded).
- Order: 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 090. (Deterministic, zero-cost parts first; paid / LLM part last so a credit problem blocks nothing else.)
- Every WO adds or updates BadGEO or fixture pages + unit tests; BadGEO stays 0 missing / 0 unexpected.
- LLM and SERP WOs: tests use recorded fixtures; live calls only in WO-B11-090.

Checkpoint after each WO.

## R4 — Acceptance, tuning, release

1. Run SCALED-COPY §8. Fill the R1 measurement gaps.
2. Tuning (≤ 2 rounds, record each): SUPP-17 ratio within 0.5–0.7; SUPP-19 patterns (tighten only); SUPP-18 prompts and page selection. Not allowed: scoring any B11 output, changing copy-quality thresholds, detector or authorship wording, external truth checks.
3. Goldens: re-map expected YAML for SUPP-17–19 (MAINTENANCE M3); re-score.
4. Session-end checks green vs `fork/BASELINE.md`.
5. Tag `handbook-v3.1.0`; push tag.

## Exit

- `fork/reports/B11.md`: §8 table (target vs actual), R1 measurements, tuning rounds, skipped / BLOCKED items with reasons (SAM hook, SUPP-18 live), spend, added runtime per 100 pages, every default chosen without Ken.
- STATE: B11 done → `status: done`; `needs_ken:` lists remaining `BLOCKED-KEN` (all optional); `current_batch: MAINT`; commit + push.
