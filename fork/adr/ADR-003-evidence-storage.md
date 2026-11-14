# ADR-003: Evidence storage and retention

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- FORK.md: no finding without stored evidence (URL + fetched snippet / header / screenshot).
- Upstream stores Lighthouse payloads in R2 (`src/server/lib/r2.ts`, `audit_lighthouse.r2_key`); local R2 is a miniflare directory and is not backed up.
- Supabase project is provisioned (preflight: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` PASS). BLUEPRINT §3.6: buckets private, service-role key server-side only.
- Volume estimate: ≤ 500 pages × (raw ≈ 60 KB gzip 15 KB) + ≤ 30 samples × (rendered + no-JS + screenshot ≈ 400 KB) ≈ 20 MB per run.

## Decision

- K4 `EvidenceStore` interface: `put(key, bytes, contentType) → { key, sha256, byteSize }`, `get(key) → bytes`, `deleteRun(runId)`.
- Implementations:
  - `SupabaseEvidenceStore` (default in app): private bucket `handbook-evidence`, REST via `fetch` with the service-role key from env (no SDK dependency in the worker bundle).
  - `FsEvidenceStore` (CLI default): `fork/runs/<domain>/<date>/evidence/`.
  - `MemoryEvidenceStore` (tests).
- Key layout: `<projectId>/<runId>/<kind>/<sha256-prefix>-<slug>.<ext>`; content-addressed within a run (same body stored once).
- Every `handbook_evidence` row stores `excerpt` (≤ 2 KB, the snippet the finding cites) inline in DB, so findings render without a storage round trip; the full body sits in storage.
- Retention: keep the latest 5 runs per project plus any run referenced by a published report; older runs' storage objects are deleted by `deleteRun` (DB rows kept, `storage_key` nulled). Default enforced at run start.
- Missing Supabase keys → app falls back to `FsEvidenceStore` under `.logs/handbook-evidence/` and logs one warning.

## Alternatives

| Option                     | Why not                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Upstream R2 binding        | Local-only miniflare state on Ken's machine; not shared with Vercel report publishing; no backup. |
| Bodies in Postgres `bytea` | Bloats DB and backups; dual-dialect blob handling differs.                                        |
| `@supabase/supabase-js`    | Extra dependency in worker bundle; plain REST is three endpoints.                                 |

## Consequences

- Service-role key must never reach the client bundle: store module lives under `src/server/` and reads env at call time.
- Report snapshots (Vercel, B4) copy only the excerpts they show, never storage URLs.

## Verification

- Unit tests on `MemoryEvidenceStore` contract shared by all implementations; one opt-in integration test against Supabase (skipped without keys).
