# B6 — Integrations build · LIGHT (SINGLE: Opus 5.5 · SPLIT: Sonnet 5.5)

WPs 37–42. Executor protocol: `fork/batches/B2-light-deterministic.md` §Executor protocol.

## Expected order

ai-traffic (rules port → drain endpoint → rollups → UI) → Bing → BYOK AI visibility providers → fan-out + citation categories → Common Crawl backlinks → agency layer → integration tests → regression.

## Prerequisite gates (no waiting)

- `preflight.sh` OPT rows decide: `VERCEL_TOKEN` → deploy `fork/vercel/receiver/`, then create the drain via Vercel API/CLI pointing at it (Vercel Pro site required); `BING_WEBMASTER_API_KEY`; BYOK keys. Missing → affected WOs `BLOCKED-KEN`; build against recorded fixtures; continue.

## Exit

Queue exhausted; each integration verified live or on recorded fixtures (`BLOCKED-KEN` noted); handbook regression unchanged (BadGEO, golden, LLM eval). `fork/reports/B6.md`; `STATE.md` → B7 HEAVY; commit + push; batch end per `STATE.md` protocol step 6 (SINGLE: continue · SPLIT: SWITCH banner).

## Pre-authorized upstream edits (B5 R4b, HEAVY)

LIGHT never edits upstream files except these, each logged in `fork/UPSTREAM-EDITS.md` by the WO that makes it:

- New route files under `src/routes/_app/p/$projectId/handbook/` (thin wrappers) + the regenerated `src/routeTree.gen.ts`.
- `src/server/everyapp/tools.test.ts`: the catalog-size number, when a WO adds an MCP tool.
- `package.json` + `pnpm-lock.yaml`: `@ai-sdk/openai`, `@ai-sdk/google`, `@anthropic-ai/sdk` (WO-B6-031); devDependency `@duckdb/node-api` (WO-B6-040).

Already in place (B5 R4): integration tables + migrations (R4a), cron hook → `src/server/features/handbook/scheduled/forkScheduledJobs.ts` (R4b). Fork jobs register there; MCP tools register inside `registerHandbookTools`; nav stays untouched (sub-nav in the handbook tab).
