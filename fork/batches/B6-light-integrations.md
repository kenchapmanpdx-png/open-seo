# B6 — Integrations build · LIGHT (SINGLE: Opus 5.5 · SPLIT: Sonnet 5.5)

WPs 37–42. Executor protocol: `fork/batches/B2-light-deterministic.md` §Executor protocol.

## Expected order

ai-traffic (rules port → drain endpoint → rollups → UI) → Bing → BYOK AI visibility providers → fan-out + citation categories → Common Crawl backlinks → agency layer → integration tests → regression.

## Prerequisite gates (no waiting)

- `preflight.sh` OPT rows decide: `VERCEL_TOKEN` → deploy `fork/vercel/receiver/`, then create the drain via Vercel API/CLI pointing at it (Vercel Pro site required); `BING_WEBMASTER_API_KEY`; BYOK keys. Missing → affected WOs `BLOCKED-KEN`; build against recorded fixtures; continue.

## Exit

Queue exhausted; each integration verified live or on recorded fixtures (`BLOCKED-KEN` noted); handbook regression unchanged (BadGEO, golden, LLM eval). `fork/reports/B6.md`; `STATE.md` → B7 HEAVY; commit + push; batch end per `STATE.md` protocol step 6 (SINGLE: continue · SPLIT: SWITCH banner).
