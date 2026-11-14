# B4 — Product surface + deploy · LIGHT (SINGLE: Opus 5.5 · SPLIT: Sonnet 5.5)

WPs 27–31. Executor protocol: `fork/batches/B2-light-deterministic.md` §Executor protocol.

## Expected order

Remaining LLM checks → exports (status.md, JSON) → report UI + share + PDF → MCP tools + Claude Code skill → local production run + sidecar compose → Supabase hardening + backup scripts → Vercel report publisher (`fork/vercel/reports/`) → runbook `fork/RUNBOOK.md` → full regression.

## Prerequisite gates (no waiting)

- `preflight.sh`: Supabase rows PASS → production run on Supabase; `VERCEL_TOKEN` PASS → publish reports to Vercel. Any MISS → mark those WOs `BLOCKED-KEN`, continue the rest.

## Exit

1. Queue exhausted.
2. Full audit end-to-end from UI, MCP, and CLI on both golden sites + `extra_site` (if set).
3. LLM eval still ≥ threshold; BadGEO 100%; golden report refreshed.
4. Production build runs locally on Supabase; one client report published to Vercel opens publicly with `noindex`; Supabase advisors show no exposed tables (or `BLOCKED-KEN` recorded); nothing else public.
5. Timing + LLM cost per audit recorded.
6. `fork/reports/B4.md`; `STATE.md` → B5; commit + push; batch end per `STATE.md` protocol step 6 (SINGLE: continue · SPLIT: SWITCH banner).
