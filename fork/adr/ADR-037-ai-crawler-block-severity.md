# ADR-037: an AI-crawler-only block is S2 (ADR-034 addendum)

- Status: accepted (B21 run 99, WO-B21-004)
- Contracts: additive constants `SEARCH_BOTS` / `AI_BOTS` (`contracts/bot-classes.ts`); `CONTRACTS_VERSION` unchanged.

## Context

aweandorderorganizing.com (Weebly behind Cloudflare) answered ClaudeBot HTTP 403 on every fetch while browsers got the page. P9-01 "Bots allowed by robots.txt do not get the browser response" was S1 (not intermittent) and capped the grade at 39. The same 403 was reported again by the S4 "AI-bot policy split". ADR-034's principle is that S1 applies where indexing of a page is affected; a block that leaves Googlebot and Bingbot untouched cannot stop indexing.

## Decision

- Every bot in `BOT_USER_AGENTS` belongs to one class: search crawlers (`Googlebot`, `Bingbot`) or AI crawlers (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`). A type check fails `types:check` when a bot has no class; a runtime test checks the same.
- P9-01 parity severity: intermittent → S2 (as before); consistent and at least one search crawler failing → S1; consistent and only AI crawlers failing → S2 with reason "AI-crawler-only block: Googlebot and Bingbot receive the page; a deliberate block is allowed (record it under P9-04)". The detail groups failing bots by class.
- One report per evidence: `ai-bot-policy` leaves out tokens the parity comparison already failed (`compareBotFetches`, shared); with none left it emits no S4 split. P9-04 stays BLOCKED with every token's decision to record.
- BadGEO: `/partners/acme.html` (GPTBot-only 403) moves from S1 to S2. One site carries one parity finding, so the search-crawler S1 case is proven by unit test, not on BadGEO.

For Ken: say "AI-bot block always S1" to revert.
