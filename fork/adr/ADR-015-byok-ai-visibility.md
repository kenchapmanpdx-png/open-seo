# ADR-015: BYOK AI visibility — direct providers, query fan-out, citation categories

- Status: accepted (design); build in B6, review in B7
- Date: 2026-11-14 · Batch: B5 R3 · Batch table row "014"
- Sources read: `elmohq/elmo` @ `2b477bd6` (MIT, © 2026 Blue Whale Software, LLC): `packages/lib/src/providers/{types,runner}.ts`, `providers/registry/{openai-api,anthropic-api}.ts`, `citations/{domain-categories,domain-lists,page-classification}.ts`, `rollups/fanout.ts`; upstream `src/db/ai-visibility.schema.ts`, `src/server/features/ai-visibility/**`

## Context

- Upstream AI visibility (per project): `ai_trackers` (engine flags, location, schedule) → `ai_prompts` → `ai_runs` → `ai_observations` (one answer per prompt × engine, unique (run, prompt, engine)) → `ai_sources` (cited pages, ordered) + `ai_matches` (brand mentioned/cited per answer). All answers come from DataForSEO (`providers/dataforseoEvidence.ts`: `ParsedAiAnswer { answerMarkdown, answerText, citations[] }`). Matching is provider-neutral (`aiVisibilityMatching.ts`). Billing and trends read these tables.
- P4 exit: "same prompt set comparable across both sources" (DataForSEO vs direct APIs).
- Elmo's provider interface: `Provider.run(model, prompt, {webSearch}) → { rawOutput, webQueries[], modelVersion }`, text + citations re-derived from `rawOutput`. OpenAI uses the Responses API `web_search` tool (queries from `web_search_call` items, citations from `url_citation` annotations); Anthropic uses `web_search_20250305` (queries from `server_tool_use` blocks, citations from `web_search_tool_result`). Elmo has no direct Gemini or Perplexity provider. Elmo stores web queries as a Postgres `text[]` on the run row (we cannot: dual dialect + AGENTS normalization rule).
- Elmo citation categories: `brand | competitor | editorial | reviews | ecommerce | social | developer | pr | reference | institutional | other`, from domain lists (`domain-lists.ts`, ~840 lines) + a 25k-line editorial list, plus an orthogonal page type (`homepage | article | listicle | howto | …`) from URL/title heuristics.
- Build-plan: do NOT borrow Elmo's Jev/TypeSafe mention judging; mention judging = upstream `aiVisibilityMatching` (deterministic) — no LLM judge in v1.
- Keys: preflight OPT `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` — all missing today → live runs BLOCKED-KEN; build + tests on recorded fixtures.

## Decision

### 1. Separate BYOK runs in fork tables, same prompts

Do not write BYOK answers into upstream `ai_runs`/`ai_observations`: upstream trends, billing and the engine enum would silently mix sources, and the unique (run, prompt, engine) index has no source column. Instead mirror the shape in fork tables keyed to the **same upstream prompts**:

| Table                | Columns (abridged)                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `byok_ai_run`        | `id`, `project_id` → projects, `organization_id`, `tracker_id` → ai_trackers (cascade), `status` (queued/running/completed/failed), `started_at`, `finished_at`, `cost_usd_micros`                                                                                                                 |
| `byok_ai_answer`     | `id`, `run_id` → run (cascade), `prompt_id` → ai_prompts (cascade), `provider` (`openai`/`anthropic`/`gemini`/`perplexity`), `model`, `model_version`, `web_search` bool, `status`, `answer_markdown`, `raw_output_path` (evidence store), `error`, `collected_at`; unique (run, prompt, provider) |
| `byok_ai_source`     | `id`, `answer_id` → answer (cascade), `url`, `domain`, `title`, `position`, `category`, `page_type`                                                                                                                                                                                                |
| `byok_ai_match`      | same columns as upstream `ai_matches`, `answer_id` → answer                                                                                                                                                                                                                                        |
| `ai_web_query`       | `id`, `answer_id` → byok answer (cascade), `position`, `query`, `normalized` (lower/trim), `is_fanout` (≠ prompt text, non-empty)                                                                                                                                                                  |
| `ai_source_category` | `source_id` → upstream `ai_sources` (cascade, PK), `category`, `page_type` — categories for DataForSEO answers, computed by the fork after an upstream run completes (no upstream edit)                                                                                                            |

- Comparison view (P4 exit) reads upstream `ai_observations` + `ai_sources` + `ai_matches` and the BYOK tables for the same `prompt_id`s and the closest run dates; maps engine ↔ provider (`chatgpt`↔`openai`, `claude`↔`anthropic`, `gemini`↔`gemini`, `perplexity`↔`perplexity`).
- Raw provider output is stored as a JSON file in the evidence store (ADR-003), not in a DB column; text and citations are re-derivable (Elmo's replay rule) without bloating Postgres.

### 2. Provider interface beside DataForSEO

`src/server/features/ai-visibility/providers/byok/` (new files inside the upstream feature's `providers/` folder, FORK.md layout):

```ts
interface ByokProvider {
  id: "openai" | "anthropic" | "gemini" | "perplexity";
  isConfigured(env): boolean;
  run(input: {
    prompt: string;
    model: string;
    webSearch: true;
    location?: string;
    language?: string;
  }): Promise<ByokAnswer>;
}
// ByokAnswer = ParsedAiAnswer (upstream type, reused) + { webQueries: string[]; modelVersion: string | null; rawOutput: unknown; usage: { inputTokens; outputTokens; searchCalls } }
```

| Provider   | Port / build                                                                                                                            | Web queries from                      | Citations from                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| openai     | Port Elmo `openai-api.ts` (MIT header), AI SDK `@ai-sdk/openai` `openai.tools.webSearch`                                                | `web_search_call` action queries      | `url_citation` annotations / tool sources   |
| anthropic  | Port Elmo `anthropic-api.ts` (MIT header), `@anthropic-ai/sdk` Messages + `web_search_20250305` (current tool version checked at build) | `server_tool_use` `web_search` inputs | `web_search_tool_result` + text citations   |
| gemini     | Own: `@ai-sdk/google` with `google_search` grounding                                                                                    | `groundingMetadata.webSearchQueries`  | `groundingMetadata.groundingChunks[].web`   |
| perplexity | Own: Perplexity Sonar chat completions (`fetch`, no SDK)                                                                                | none exposed → `[]`, shown as "n/a"   | `search_results[]` (fallback `citations[]`) |

- Keys: per organization, encrypted like ADR-014 (`tokenCrypto`), env fallback for the local single-tenant deployment. Never sent to the client or logged.
- Cost: per-call cost computed from token usage + search-call price table (`byok/prices.ts`, dated); hard cap per run (`BYOK_RUN_BUDGET_USD`, default $2) checked before each call — over → remaining answers `failed: budget` (same pattern as the K5 judge budget, ADR-007). BYOK spend never goes through upstream billing/credits (user's own key).
- Scheduling: manual "Run with my keys" + optional schedule on the 5-minute tick (`next_run_at` due-selection, ADR-011). Concurrency 2 per provider.
- Never scrape consumer AI UIs (FORK.md) — APIs only.

### 3. Fan-out

- Stored as rows (`ai_web_query`), one per query, in provider order. `is_fanout` = Elmo `isFanoutQuery` semantics (normalized, non-empty, ≠ normalized prompt text), computed in TS at insert (no dialect-specific regex SQL).
- Views: per prompt, the distinct fan-out queries across providers and runs with counts; per project, top fan-out queries. Feeds §27 "AI answer panel prompt lists" and keyword research (link out to the upstream keyword tool with the query prefilled).
- DataForSEO answers: fan-out stored only if the DataForSEO payload exposes it; upstream does not keep the raw payload, so v1 has fan-out for BYOK answers only (labelled).

### 4. Citation categories

| Elmo source                                  | Fork target                                                       | Change                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `citations/domain-categories.ts`             | `src/server/features/ai-visibility/citations/domainCategories.ts` | MIT header; keep `CitationCategory`, `CitationPageType`, `extractDomain`, `normalizeUrl`, `inferPageType`, `resolvePageType`, Google surface helpers; drop chart colors/config (UI uses upstream tokens). |
| `citations/domain-lists.ts`                  | `.../citations/domainLists.ts`                                    | MIT header; copy lists.                                                                                                                                                                                   |
| `citations/editorial-domains.ts` (25k lines) | —                                                                 | Not ported in v1: size; editorial falls to `other` unless in the short editorial list inside `domain-lists.ts`. Revisit with data.                                                                        |
| `citations/page-classification.ts`           | `.../citations/pageClassification.ts`                             | MIT header.                                                                                                                                                                                               |

- `brand` = the project's own domains (upstream `ownedAiDomain`); `competitor` = the project's tracked competitor domains (upstream AI visibility brands with `own = false`); then list lookups; else `other`. Category is stored at write time (`byok_ai_source.category`, `ai_source_category`) with a `categories_version`; recomputed on version bump.

### 5. Contract

K11 in `src/server/features/ai-visibility/providers/byok/contracts.ts`: `BYOK_PROVIDERS`, `CITATION_CATEGORIES`, `CITATION_PAGE_TYPES`, `byokAnswerSchema`, `byokRunRequestSchema`, `aiVisibilityComparisonRowSchema`. CONTRACTS_VERSION 1.4.0.

## Alternatives

| Option                                            | Why not                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| BYOK answers in upstream tables + `source` column | Upstream schema edit; upstream trends/billing would mix sources unknowingly.                                              |
| OpenRouter `:online` instead of direct keys       | Grounding is OpenRouter's search, not the engine's own; fan-out queries not exposed; P4 asks for direct engine behaviour. |
| Elmo `text[]` web queries                         | Postgres-only; violates normalization rule.                                                                               |
| Port Elmo mention judge (Jev)                     | Build-plan: excluded. Deterministic upstream matcher is enough for v1.                                                    |

## Consequences

- Two parallel answer stores; the comparison view is the only place they meet. Retention for BYOK rows follows upstream AI-visibility retention (same days), via the daily tick.
- Perplexity shows no fan-out; Gemini/Perplexity are fork-built (no MIT source) and need recorded fixtures from the first live call.

## Verification (B6/B7)

- Provider parsers tested on recorded fixtures (one per provider; synthetic until keys exist).
- Fan-out normalization + `is_fanout` tests; category assignment tests (brand/competitor/list/other).
- Live: BLOCKED-KEN until at least one BYOK key exists; P4 exit = one prompt set compared across DataForSEO + one BYOK provider.
