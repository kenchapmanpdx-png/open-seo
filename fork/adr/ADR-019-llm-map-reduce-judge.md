# ADR-019: LLM map → reduce → judge

- Status: accepted (extends ADR-007)
- Date: 2026-11-18 · Batch: B8 (R1)

## Context

- Spec: `fork/FULL-READ.md` §5; acceptance §9 (extraction eval ≥ 90 %, judge recall ≥ 80 % with 0 false fails, ≤ $1.50 per ≤ 100-page site, unchanged rerun ≤ 10 % of first run).
- Today: each LLM check judges a page sample (`checks/llm-copy.ts` `SAMPLE_PAGES = 8`, text clipped 2.5–6 k chars) in one call per check; misses site-level conflicts and anything outside the sample (golden misses listed in FULL-READ §1).
- Judge plumbing: `llm/judge.ts` (`createJudge`, quote verification, budget), `llm/model.ts` (OpenAI-compatible client; `OPENROUTER_BASE_URL` may point at Anthropic's endpoint; price table), call log `handbook_llm_call`.
- Prices verified B8 R1 against Anthropic's model table (cached 2026-11-03): `claude-haiku-5-5` $0.10 / $0.50 per M tokens (prompts ≤ 100 k tokens; $0.50 / $2.50 beyond), `claude-sonnet-5-5` $2 / $10, `claude-opus-5-5` $4 / $20. `llm/model.ts` already has these values → no change.
- Measured main-text size (B8 R1 CLI runs, words per 200 page): why 33 pages, mean 446 (max 912); ryan 11 pages, mean 856 (max 2 744); bluetree 41 pages, mean 603 (max 1 667). Token estimate ≈ words × 1.35 + head lines ≈ 100 + fixed prompt/schema ≈ 1 500 input; profile output ≈ 600 tokens (estimate; WO-B9-015 logs real usage per call).
  - Per page input ≈ 2.2 k (why) – 2.8 k (ryan) tokens; all well under one 24 k-char chunk except ryan's longest page.
  - Map cost per page: Haiku ≈ $0.0005, Sonnet ≈ $0.010 (≈ $0.007 with the fixed prompt cached).
  - Map cost per site: why ≈ $0.02 (Haiku) / $0.33 (Sonnet); bluetree ≈ $0.02 / $0.43; ryan ≈ $0.01 / $0.12.

## Decision

- PageProfile (K14, Zod, `contracts/page-profile.ts`): fields exactly as FULL-READ §5.1 incl. `videoText` (`transcript | summary | none`), `sections[] {heading, isQuestion, answerFirst}`, FAQ pairs `{question, answerWords, standsAlone}`. Extraction only; no verdict fields. Every field that carries text carries a `quote`; quotes are verified verbatim (whitespace-normalized substring) against the page's main text (raw + rendered-only text); unverifiable quotes are dropped and counted in `profile.droppedQuotes`.
- Input: head lines (title, meta description, H1, canonical, og:title) + page-unique text (template boilerplate removed per ADR-021 §boilerplate), rendered-only text marked `[rendered-only]`. Chunked at 24 k chars; > 100 k chars → chunks merged into one profile, truncation noted. One extra map call per template for its boilerplate text.
- Model: `HANDBOOK_LLM_EXTRACT_MODEL` default `claude-haiku-5-5`. Fallback to `claude-sonnet-5-5` only if the extraction eval (`fork/evals/extract/`, WO-B9-025) scores Haiku < 90 %; the decision and score are written to this ADR's build log. Judge stays `HANDBOOK_LLM_MODEL` (Sonnet).
- Prompt caching: the fixed extraction system prompt + schema is sent as a cacheable prefix (`cache_control` where the endpoint supports it; harmless otherwise).
- Cache: `handbook_page_profile` keyed `(normalized url, sha256(main text), promptVersion, model)`; project-scoped. Hit → no call, $0. `promptVersion` is a constant bumped on any prompt/schema change.
- Reduce (deterministic, K15 `SiteFactMap`): stat conflicts by normalized subject across pages + llms.txt + JSON-LD; name-variant clusters; superlative / placeholder / acronym / award inventories; FAQ duplication; thin-page list (words + keyFactsBlock); service-coverage map (hub → children). Every SiteFactMap entry references the profile quotes it came from (evidence rule).
- Judge: existing K5 items receive targeted views from the fact map (candidate pages + counter-examples) instead of the first 8 pages; P4-02 / P4-07 receive all pages' head lines in one call. Judge output contract unchanged (K5).
- Budget: auto = $0.50 + $0.01 × pages, cap $5; `HANDBOOK_LLM_BUDGET_USD` overrides. Map ≤ 60 %, judge ≥ 40 % of the budget. Map spend counts toward the map share only; when the map share is exhausted, remaining pages get no profile (counted, coverage noted) and judges run on what exists. Exhaustion of the judge share / credit error (402) → remaining items BLOCKED `llm budget` / `llm credits`, never silent. Check with the measured numbers: 100 pages → budget $1.50, map share $0.90 ≥ Haiku ≈ $0.05 and ≥ Sonnet-with-cached-prefix ≈ $0.70 — fits either model; FULL-READ formula kept unchanged.
- Concurrency 4 map calls; backoff on 429 / 529 / 5xx up to 3 retries (exponential, 2 s base, honor `retry-after`).
- Stability: judge confidence < 0.7 → second judge call; verdicts disagree → `unsure` (BLOCKED-REVIEW, shown, not scored). Replaces ADR-007's "fail below 0.5 → unsure" rule.

## Alternatives

| Option                                   | Why not                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Judge every page with every rubric       | 13 rubrics × pages calls; cost ≈ 13 × map at Sonnet price; no site-level view                     |
| Bigger samples (25 → 50 pages) per judge | Still misses pages outside the sample; long contexts reduce quote precision                       |
| Embeddings + clustering for conflicts    | Needs another provider/key; stat conflicts need exact values, which the profile extracts directly |
| Sonnet as default extractor              | ≈ 20× Haiku per page; only justified if Haiku fails the extraction eval                           |
| Anthropic Batches API (50 % off) for map | Async minutes-to-hours latency breaks the staged run's time cap; Haiku cost is already negligible |

## Consequences

- Contracts 1.5.0 (R2): K14 `PageProfile`, K15 `SiteFactMap`, `handbook_page_profile` table (both dialects).
- `llm/model.ts`: new env `HANDBOOK_LLM_EXTRACT_MODEL`; price table unchanged (verified).
- ADR-007 rules superseded: sampling (`SAMPLE_PAGES`), fixed $1.00 default budget, 0.5 confidence rule.

## Verification

- Extraction eval (WO-B9-025): ≥ 90 % of golden quotes present in profiles.
- Judge eval (K5): recall ≥ 80 %, false fails 0 (why-F19 rebuilt, B8 R3).
- Cost: why / bluetree / ryan `full` runs logged; unchanged rerun ≤ 10 % of the first run (cache hits).
- Unit tests: quote verifier on profiles; cache key changes when text / promptVersion / model changes; budget split.

## Build log

- B8 R2 (2026-11-18): `handbook_page_profile` stores the verified K14 document as `profile_json` text with scalar columns for the cache key, page type, scope and cost. The profile is an opaque cached LLM output, validated with `pageProfileSchema` on read and never queried by field; the reduce stage reads whole profiles. Normalizing its ≈ 15 sub-arrays into tables would add joins for no query. Extract-model decision (Haiku vs Sonnet) pending WO-B9-025.
- B9 run 43 (2026-11-18, WO-B9-015): map output is JSON as plain text, keys and limits written in the cacheable system prompt, validated and repaired locally (over-long arrays cut, invalid items dropped). Anthropic's OpenAI-compatible endpoint rejects the K14 schema as a structured-output grammar ("compiled grammar is too large"). Haiku runs with thinking disabled: hidden thinking tokens more than doubled output (probe page 1 321 → 577 output tokens). Measured why `full` (36 jobs: 33 pages + 2 templates + llms.txt): $0.0383 first run, $0 unchanged rerun (36/36 cache hits), 6 quotes dropped. The cache-control hint is dropped: the endpoint ignores it and the prefix (≈ 1.9 k tokens) is below Haiku's minimum cacheable length; the fixed prompt still goes first.
- B9 run 44 (2026-11-18, WO-B9-016): reduce is deterministic and runs inside the checks stage (no separate stage unit): `stageFactMap` builds K15 from the stored profiles, so a resumed run rebuilds the same map. Built only when profiles exist; without a mapper checks see `siteFactMap` undefined. List counts read stated counts from raw page text and llms.txt as well as profile stats, so the why-F19 shape (intro "21 events", 19 list entries) is caught even when the extractor drops that stat. A preposition between the number and the noun ("14 produced by WHY RACING EVENTS") is not a count claim. The fact map is stored as one `factMap` evidence row filed under P5-02.
