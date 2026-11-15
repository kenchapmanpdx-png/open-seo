# B5 — v1 sign-off + integration design · HEAVY (Opus 5.5)

WPs 32–36.

## R1 — Rebase + v1 review (WP32)

1. `git fetch upstream`; new commits → rebase + refresh baseline; none → skip.
2. Review B4 with `REVIEW-CHECKLIST.md`.
3. Security pass: SSRF (collectors, sidecar), published-report content (no secrets/evidence leakage, `noindex`, unguessable paths), Supabase (RLS/privileges via Supabase advisors, service-role key server-side only, private buckets), tenant scoping, secrets in logs, LLM injection guards, sidecar bound to 127.0.0.1, dependency audit.
4. Data integrity: evidence present for every finding; reruns idempotent; migration up/down on both dialects.
5. Fix all S1/S2 issues found.
6. Registration hook (WO-B4-011): one line `registerHandbookTools(register);` at the end of `registerOpenSeoTools` in `src/server/mcp/server.ts` (import from `@/server/features/handbook/mcp/tools`); log in `fork/UPSTREAM-EDITS.md`; then the tools/list contract test must pass.

## R2 — Release (WP33)

Tag `v1.0.0` on `ken/main`; release notes in `fork/reports/B5.md`.

## R3 — Integration + agency design (WP34, WP35)

ADRs + contracts (bump `CONTRACTS_VERSION` major if needed):
| ADR | Scope |
|---|---|
| 012 | ai-traffic: port Canonry `integration-traffic/src/rules.ts` (MIT header kept), Vercel drain ingestion (`integration-vercel` drain/normalize) as a Vercel Function in `fork/vercel/receiver/` writing to Supabase, signature verification, rollups read by the local app, self-traffic exclusion |
| 013 | Bing WMT + Bing AI Performance (Canonry `integration-bing`) |
| 014 | BYOK AI visibility: direct OpenAI/Anthropic/Gemini/Perplexity with web search; query fan-out storage; citation domain categories (Elmo patterns); provider interface beside DataForSEO |
| 015 | Common Crawl backlinks (Canonry `integration-commoncrawl`, DuckDB) — local Node job on Ken's computer writing to Supabase; Cloudflare = N/A |
| 016 | Agency layer: orgs/projects reuse, white-label on upstream report templates, +4/+12-week outcome record scheduler (handbook P11) |

## R4 — B6 queue (WP36)

WOs with explicit source→target file maps for every port; fill `fork/queue.md`.

## Exit

v1.0.0 tagged; security pass clean; ADR-012…016; B6 queue written. `STATE.md` → B6 LIGHT; commit + push; batch end per `STATE.md` protocol step 6 (SINGLE: continue · SPLIT: SWITCH banner).
