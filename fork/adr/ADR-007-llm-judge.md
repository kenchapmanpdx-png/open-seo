# ADR-007: LLM judge (K5) — design only

- Status: accepted (design); build in B3
- Date: 2026-11-14 · Batch: B1

## Context

- 13 registry items are primary class LLM (`fork/coverage.md`); upstream uses AI SDK + OpenRouter (`src/server/lib/openrouter.ts`) with organization billing in hosted mode.
- FORK.md: LLM-judged findings never block a release; page text is untrusted input (BLUEPRINT §3.6).

## Decision

- `judge({ itemId, rubricId, inputs, model? }) → { verdict: pass|fail|unsure, quotes: { url, text }[], confidence: 0–1, rationale }`.
- Fixed system prompt per rubric (versioned file under `llm/rubrics/`), page text passed as delimited data, no tools, output validated by Zod; one retry on schema failure, then `unsure`.
- Quote verification: every quote must be a substring of the fetched text of the cited URL after whitespace normalization; any unverified quote → verdict downgraded to `unsure`, call recorded with `quotes_verified = false`.
- `unsure` → item `BLOCKED` with note `llm unsure`, never OPEN.
- Cost cap per run (`HANDBOOK_LLM_BUDGET_USD`, default 1.00): the runner estimates tokens before each call and stops LLM checks when the cap would be exceeded (remaining items BLOCKED `llm budget`). Every call is logged in `handbook_llm_call`.
- Model default: an OpenRouter Claude model; key absent (`OPENROUTER_API_KEY`) → LLM items BLOCKED `no llm key`.

## Alternatives

| Option               | Why not                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| Direct Anthropic SDK | Upstream already routes via OpenRouter; `ANTHROPIC_API_KEY` is OPT in preflight. |
| Free-text verdicts   | Unverifiable; violates evidence rule.                                            |

## Consequences

- Contract file `contracts/llm.ts` frozen now; implementation B3.

## Verification

- Eval set from golden audits (B3); quote-verifier unit tests (substring, normalization, adversarial near-matches).

## Build decisions (B3 R2, run 11)

- Model: `HANDBOOK_LLM_MODEL` (default `anthropic/claude-sonnet-5.5`, $2/$10 per M tokens), not `OPENROUTER_MODEL`, which upstream's SAM agent owns. Price table in `llm/model.ts`; an unknown model is budgeted at $15/$75 so the cap still holds. Access via upstream `getOpenRouterAccess` (own key or Every App gateway).
- Runner: LLM-class checks receive `ctx.judge` (contracts 1.2.0). No judge → items BLOCKED `no llm key`. `LlmBudgetError` → that check's items and every later LLM check's items BLOCKED `llm budget`. Provider errors → BLOCKED `check error: …`.
- Checks (`checks/llm-copy.ts`): one judge call per check over a page sample (home, one rank-1 sample per template, crawl order; 8–25 pages), never per page. A `fail` below confidence 0.5 is treated as `unsure`. Fail evidence = each verified quote (`textQuote`); PASS evidence = the judged page views.
- Measured cost: whyracingevents $0.09, ryanmscottsdale $0.06 per run (five checks, before the fact table).
- Eval threshold: recall ≥ 80% on golden fails and 0 fails on golden passes (`fork/evals/`, `fork/scripts/llm-eval.ts`; exit 1 below threshold).
