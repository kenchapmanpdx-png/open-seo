# B12 — After the v0.1.30 rebase: Supabase, reliability, overlap note · LIGHT (SINGLE: Opus 5.5)

Context: on 2026-11-19 `ken/main` was rebased onto upstream v0.1.30 (`672a66ce`) from a chat session (Ken approved fork/reports/B10.md R1.1). Fork migrations moved one number up (sqlite 0073–0076, pg 0051–0054; journal `when` kept); upstream's `project_embeds` (sqlite 0072 / pg 0050) is in the journal but not yet on Supabase. Checked before push: types 0, lint 0, tests 411 files / 2550, format clean, both `drizzle-kit generate` configs "No schema changes", `vite build` OK. Procedure: `fork/MAINTENANCE.md` M1 "Migration collisions".

Read first: `fork/STATE.md`, `fork/FORK.md`, `fork/MAINTENANCE.md` M1, `fork/reports/B10.md` R1.1, `fork/reports/B11.md` R4, `fork/SCALED-COPY.md` §3.1, `fork/FULL-READ.md` §8, the WOs below.

Rules:

- [Ken] No approval stops. Never set `status: needs-ken` except STATE protocol rule 2. Unclear → most conservative reversible option; record it in `fork/reports/B12.md`.
- Secrets: never source or read `.env*`. Supabase only through `fork/scripts/run-local.sh` (loads its own config). A step refused or needing secrets in the shell → BLOCKED-KEN for that step only; continue.
- No contract or schema change, no migration, no new npm dependency. Sidecar internals and its compose files may change (WO-B12-003/004).
- Live audits one at a time. No paid calls beyond one LLM golden run in WO-B12-090 (budget FULL-READ §5.6).

## Order

`WO-B12-001 → WO-B11-091 → WO-B12-002 → WO-B12-003 → WO-B12-004 → WO-B12-090` (work orders in `fork/work-orders/`; status in `fork/queue.md`).

## Exit

- `fork/reports/B12.md`: what changed, measured results, defaults chosen, BLOCKED-KEN left.
- Session-end checks green vs `fork/BASELINE.md` (refresh it to the current counts).
- Tag `handbook-v3.1.1`; push tags.
- STATE: `status: done`, `current_batch: MAINT`, `batch_file: fork/MAINTENANCE.md`, `needs_ken:` lists only what is left (STATE protocol rule 7).
