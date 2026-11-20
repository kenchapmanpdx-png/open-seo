# B14 — Novice layout: Check a site, Fix List, plain words, simpler sidebar · HEAVY (SINGLE: Opus 5.5)

Spec: `fork/NOVICE-UI.md` (read fully first). Also read: `fork/DEPENDABILITY.md` §5 and WO-B13-014, `fork/reports/B13.md`, `fork/FORK.md`, `fork/adr/ADR-010` (UI), `src/client/navigation/items.ts`, `src/client/features/handbook/*`.

Rules:

- [Ken] No approval stops. Never set `status: needs-ken` except STATE protocol rule 2 (model guard). The SEO / GEO / AEO tags ship as drafted by the spec's rules; Ken may edit them later. Unclear → the spec's default, else the most conservative reversible option; record it in `fork/reports/B14.md`.
- [Ken] Authorisations A12–A17 (`fork/NOVICE-UI.md` §6) are granted. Every other upstream edit: not allowed (ESCALATE row in `fork/queue.md`, continue).
- Contracts: additive 1.7.0 → 1.8.0 only (A16). No schema change, no migration, no new npm dependency.
- Same look: existing components; no visual redesign. Nothing removed from the app (spec §0).
- B13 rules still apply: `ops maint on` at the start of every run, secrets, test mode, ops verbs (`fork/DEPENDABILITY.md` §5).
- Live checks: ≤ 2 test-mode audits, LLM ≤ $0.50 (A17).

## R1 — Verify, decide, write work orders

1. Re-verify the spec's §1 facts N1–N6 against the current code (B13 may have moved files); adjust WOs, record.
2. ADR-029 novice layout (Fix List as default run view, tag rules, category score formula, fork nav hook, AI Search page fallback rule).
3. Contracts 1.8.0 (A16) + `fork/STATE.md` `contracts_version`.
4. Work orders WO-B14-001 … 006 and 090 in `fork/work-orders/` (template `fork/templates/WO.md`, Class: HEAVY; Files, Spec, Acceptance from spec §2); rows in `fork/queue.md`.

Checkpoint.

## R2 — Data and words

WO-B14-001 (tags + category scores; tag table into the report), WO-B14-002 (plain words).

Checkpoint.

## R3 — Pages

WO-B14-003 (Fix List), WO-B14-004 (Check a site).

Checkpoint.

## R4 — Navigation and dashboard

WO-B14-005 (sidebar, AI Search page or its fallback), WO-B14-006 (top-5 card, rendering message).

Checkpoint.

## R5 — Exit

WO-B14-090.

## Exit

- `fork/reports/B14.md`: what changed, tag table, AI Search outcome, screenshots list, upstream edits, live-check count and LLM spend, residual weaknesses.
- Session-end checks green vs `fork/BASELINE.md` (refresh it); BadGEO 0 / 0; goldens Δ 0; tag `handbook-v3.3.0`; push with tags.
- STATE (last batch in the sequence): `status: done`, `current_batch: MAINT`, `batch_file: fork/MAINTENANCE.md`, `needs_ken:` lists every `BLOCKED-KEN` item left in `fork/queue.md` (STATE protocol rule 7).
