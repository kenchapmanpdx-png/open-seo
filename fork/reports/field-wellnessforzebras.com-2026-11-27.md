# In-app re-check — wellnessforzebras.com (B26 exit, 2026-11-27)

Check a site, Whole site, full check on, no leave-outs. Audit `764b3a4f` (app build stamp `d0ed0dd88413`, B26 WO-001…007). Before: audit `329ddb98` (build `handbook-v3.14.0`, 2026-11-26). Both read 34 of 34 sitemap URLs; no page cap.

Grade C 67.6 → B 72.2 (no cap either run). Findings 28 → 22.

## The seven false readings

| #   | WO  | Reading in `329ddb98`                                                                                      | Now               | Evidence in `764b3a4f`                                                                                                                                |
| --- | --- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 001 | P6-07 S2 "FAQPage markup is not visible or is duplicated" (12 pages)                                       | gone              | P6-07 PASS: "28 FAQPage page(s): Q&A visible, no duplicate sets"                                                                                      |
| 1b  | 001 | SUPP-16 "… missing from raw HTML": 7 questions "not in raw HTML" on 6 pages                                | narrowed          | every "not in raw HTML" line gone; the finding keeps only answer-length / stand-alone lines (5 pages), the true half                                  |
| 2   | 002 | P6-01 S2 "Home WebSite node is incomplete" ("WebSite node missing alternateName")                          | gone              | P6-01 PASS: "home WebSite node has name, url, alternateName"                                                                                          |
| 3   | 003 | SUPP-03 S3 "Same text block printed more than once" (3 pages)                                              | narrowed          | `/` gone; `/ingredients/l-theanine` and `/ingredients/nicotinamide-riboside` stay (both copies visible, TRUE per WO-003)                              |
| 4   | 004 | P8-02 S2 "axe: Elements must meet minimum color contrast" (1 page)                                         | gone              | P8-02 PASS: "34 samples: no color-contrast violations" (sidecar 1.3.1)                                                                                |
| 5   | 005 | P5-14 S3 "No primary action in the first mobile screen" (34 pages)                                         | still open (TRUE) | WO-005 step 1: "Join Waitlist" is not on the 390×844 first screen; closed with no change                                                              |
| 6   | 006 | P5-13 S4 "Outbound links are dead": `tmsforacure.org/overview/mast-cell-activation-syndromes/` "no answer" | gone              | the link answered this run (not listed); live check 2026-11-27 HTTP 200. The "not confirmed dead" path was not exercised in-app (unit test covers it) |
| 7   | 007 | P5-07 S3 "Entity test fails or names are spelled more than one way" ("ZebraThrive" vs "Zebra Thrive")      | gone              | P5-07 PASS (LLM judge, confidence 0.80, 14 pages)                                                                                                     |

## Other changes (by section + title)

- Gone, not a fix: P5-06 "Article furniture on home, service or product pages" — P5-06 is BLOCKED "llm budget" this run, with P4-07, P5-11 and P5-15. Run LLM cost $0.44 against the auto budget $0.84 (judge share 40 %). Pre-existing: the uncached 2026-11-26 22:21 run on `handbook-v3.14.0` (cost $0.48) blocked the same four items; the 22:22 run (`329ddb98`, $0.25) did not.
- Changed: SUPP-15 3 → 7 pages and SUPP-16 answer word counts (e.g. "Can I take this with my POTS or MCAS medications?" 140 → 200 words) — the page text now joins character references and inline tags without a space (WO-001 / WO-007 change `markup.text`), so FAQ answers match their full text. Not verified line by line.
- Changed, variance: P7-09 lab LCP 5 → 6 URLs (5 of 7 templates both runs); P4-02 2 → 1 page, P5-01 / P5-04 reworded (LLM).
- New findings: none.

## Findings (22)

- S2 · P2-07 · Most of the page text waits at opacity:0 for an animation · 1 URL(s)
  - https://www.wellnessforzebras.com/our-promise
- S2 · P7-09 · Lab LCP above 2.5 s or CLS above 0.1 on 5 of 7 measured templates · 6 URL(s)
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/terms
- S2 · P4-02 · Titles or H1s do not state the page's offer or topic · 1 URL(s) · llm
  - https://www.wellnessforzebras.com/our-promise
- S2 · P4-08 · Heading order / landmark structure broken · 26 URL(s)
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/boron
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/copper-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/manganese-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/methylfolate
  - https://www.wellnessforzebras.com/ingredients/molybdenum
  - https://www.wellnessforzebras.com/ingredients/niacinamide
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/ingredients/quercetin-phytosome
  - https://www.wellnessforzebras.com/ingredients/r5p
  - https://www.wellnessforzebras.com/ingredients/selenium
  - https://www.wellnessforzebras.com/ingredients/taurine
  - https://www.wellnessforzebras.com/ingredients/vitamin-b12
  - https://www.wellnessforzebras.com/ingredients/vitamin-c
  - https://www.wellnessforzebras.com/ingredients/vitamin-d3
  - https://www.wellnessforzebras.com/ingredients/vitamin-k2
  - https://www.wellnessforzebras.com/ingredients/zinc-carnosine
- S3 · P2-07 · Content waits at opacity:0 for an animation · 1 URL(s)
  - https://www.wellnessforzebras.com/
- S3 · P7-04 · Pixels fire before any interaction (pre-consent requests) · 34 URL(s)
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/contact
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/boron
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/copper-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/manganese-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/methylfolate
  - https://www.wellnessforzebras.com/ingredients/molybdenum
  - https://www.wellnessforzebras.com/ingredients/niacinamide
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/ingredients/quercetin-phytosome
  - https://www.wellnessforzebras.com/ingredients/r5p
  - https://www.wellnessforzebras.com/ingredients/selenium
  - https://www.wellnessforzebras.com/ingredients/taurine
  - https://www.wellnessforzebras.com/ingredients/vitamin-b12
  - https://www.wellnessforzebras.com/ingredients/vitamin-c
  - https://www.wellnessforzebras.com/ingredients/vitamin-d3
  - https://www.wellnessforzebras.com/ingredients/vitamin-k2
  - https://www.wellnessforzebras.com/ingredients/zinc-carnosine
  - https://www.wellnessforzebras.com/our-promise
  - https://www.wellnessforzebras.com/privacy
  - https://www.wellnessforzebras.com/shipping
  - https://www.wellnessforzebras.com/terms
- S3 · SUPP-03 · Same text block printed more than once on a page · 2 URL(s)
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
- S3 · P7-02 · Images without dimensions / hero not prioritised (26 pages, 1 template group) · 26 URL(s)
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/boron
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/copper-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/manganese-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/methylfolate
  - https://www.wellnessforzebras.com/ingredients/molybdenum
  - https://www.wellnessforzebras.com/ingredients/niacinamide
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/ingredients/quercetin-phytosome
  - https://www.wellnessforzebras.com/ingredients/r5p
  - https://www.wellnessforzebras.com/ingredients/selenium
  - https://www.wellnessforzebras.com/ingredients/taurine
  - https://www.wellnessforzebras.com/ingredients/vitamin-b12
  - https://www.wellnessforzebras.com/ingredients/vitamin-c
  - https://www.wellnessforzebras.com/ingredients/vitamin-d3
  - https://www.wellnessforzebras.com/ingredients/vitamin-k2
  - https://www.wellnessforzebras.com/ingredients/zinc-carnosine
- S3 · P3-15, P9-05 · Named robots.txt groups miss the \* Disallow set (Googlebot, Bingbot, Applebot, DuckDuckBot, Amazonbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot, Meta-WebIndexer, ChatGPT-User, Perplexity-User, Claude-User, GPTBot, ClaudeBot, anthropic-ai, Google-Extended, Applebot-Extended, Meta-ExternalAgent, Bytespider, CCBot, cohere-ai, Diffbot, FacebookBot) — intended? · 1 URL(s)
  - https://www.wellnessforzebras.com/robots.txt
- S3 · P3-03 · /index.html is a live duplicate of the homepage · 1 URL(s)
  - https://www.wellnessforzebras.com/index.html
- S3 · P6-09 · Brand is not disambiguated in schema · 1 URL(s)
  - https://www.wellnessforzebras.com/
- S3 · P5-01 · Opening sentences do not name brand, subject and offer · 3 URL(s) · llm
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/p5p
- S3 · P5-10 · No site-wide link to editorial / review standards · 1 URL(s)
  - https://www.wellnessforzebras.com/
- S3 · P5-04 · Unsupported superlatives, placeholders or unexplained acronyms · 3 URL(s) · llm
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
- S3 · P5-17 · No About page found · 1 URL(s)
  - https://www.wellnessforzebras.com
- S3 · P5-14 · No primary action in the first mobile screen · 34 URL(s)
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/contact
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/boron
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/copper-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/manganese-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/methylfolate
  - https://www.wellnessforzebras.com/ingredients/molybdenum
  - https://www.wellnessforzebras.com/ingredients/niacinamide
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/ingredients/quercetin-phytosome
  - https://www.wellnessforzebras.com/ingredients/r5p
  - https://www.wellnessforzebras.com/ingredients/selenium
  - https://www.wellnessforzebras.com/ingredients/taurine
  - https://www.wellnessforzebras.com/ingredients/vitamin-b12
  - https://www.wellnessforzebras.com/ingredients/vitamin-c
  - https://www.wellnessforzebras.com/ingredients/vitamin-d3
  - https://www.wellnessforzebras.com/ingredients/vitamin-k2
  - https://www.wellnessforzebras.com/ingredients/zinc-carnosine
  - https://www.wellnessforzebras.com/our-promise
  - https://www.wellnessforzebras.com/privacy
  - https://www.wellnessforzebras.com/shipping
  - https://www.wellnessforzebras.com/terms
- S4 · P3-01 · Host/protocol variants reach the canonical origin in more than one hop · 1 URL(s)
  - http://wellnessforzebras.com/
- S4 · P5-13 · Outbound links point at redirected URLs (info) · 26 URL(s)
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/boron
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/copper-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/manganese-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/methylfolate
  - https://www.wellnessforzebras.com/ingredients/molybdenum
  - https://www.wellnessforzebras.com/ingredients/niacinamide
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/ingredients/quercetin-phytosome
  - https://www.wellnessforzebras.com/ingredients/r5p
  - https://www.wellnessforzebras.com/ingredients/selenium
  - https://www.wellnessforzebras.com/ingredients/taurine
  - https://www.wellnessforzebras.com/ingredients/vitamin-b12
  - https://www.wellnessforzebras.com/ingredients/vitamin-c
  - https://www.wellnessforzebras.com/ingredients/vitamin-d3
  - https://www.wellnessforzebras.com/ingredients/vitamin-k2
  - https://www.wellnessforzebras.com/ingredients/zinc-carnosine
- S4 · P8-01 · HSTS includeSubDomains/preload without a recorded subdomain check or owner decision · 34 URL(s)
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/contact
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients
  - https://www.wellnessforzebras.com/ingredients/benfotiamine
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/boron
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/copper-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/magnesium-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/manganese-bisglycinate
  - https://www.wellnessforzebras.com/ingredients/methylfolate
  - https://www.wellnessforzebras.com/ingredients/molybdenum
  - https://www.wellnessforzebras.com/ingredients/niacinamide
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pantothenic-acid
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/ingredients/quercetin-phytosome
  - https://www.wellnessforzebras.com/ingredients/r5p
  - https://www.wellnessforzebras.com/ingredients/selenium
  - https://www.wellnessforzebras.com/ingredients/taurine
  - https://www.wellnessforzebras.com/ingredients/vitamin-b12
  - https://www.wellnessforzebras.com/ingredients/vitamin-c
  - https://www.wellnessforzebras.com/ingredients/vitamin-d3
  - https://www.wellnessforzebras.com/ingredients/vitamin-k2
  - https://www.wellnessforzebras.com/ingredients/zinc-carnosine
  - https://www.wellnessforzebras.com/our-promise
  - https://www.wellnessforzebras.com/privacy
  - https://www.wellnessforzebras.com/shipping
  - https://www.wellnessforzebras.com/terms
- S4 · P4-01 · Meta descriptions over 170 characters · 5 URL(s)
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract
  - https://www.wellnessforzebras.com/our-promise
- S4 · SUPP-16 · FAQ answers that don't stand alone or are missing from raw HTML · 5 URL(s)
  - https://www.wellnessforzebras.com/
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/chlorogenic-acid
  - https://www.wellnessforzebras.com/ingredients/l-theanine
  - https://www.wellnessforzebras.com/ingredients/p5p
- S4 · SUPP-15 · Informational page without question headings or answer-first sections · 7 URL(s)
  - https://www.wellnessforzebras.com/excipients
  - https://www.wellnessforzebras.com/ingredients/biotin
  - https://www.wellnessforzebras.com/ingredients/grape-seed-extract
  - https://www.wellnessforzebras.com/ingredients/nicotinamide-riboside
  - https://www.wellnessforzebras.com/ingredients/p5p
  - https://www.wellnessforzebras.com/ingredients/palmitoylethanolamide
  - https://www.wellnessforzebras.com/ingredients/pine-bark-extract

## BLOCKED / LIMITED

- P10-05 BLOCKED: gate "GA4 in use AND owner approves a Google Cloud project" = ? (gate "GA4 in use AND owner approves a Google Cloud project" needs owner/render evidence)
- P3-07 BLOCKED: gate "site retires items" = ? (gate "site retires items" needs owner/render evidence)
- P4-07 BLOCKED: llm budget
- P5-02 BLOCKED: llm unsure (claude-sonnet-5-5, confidence 0.00): output failed schema validation twice
- P5-06 BLOCKED: llm budget
- P5-11 BLOCKED: llm budget
- P5-15 BLOCKED: llm budget
- P6-12 BLOCKED: gate "a Knowledge Panel exists for the brand" = ? (gate "a Knowledge Panel exists for the brand" needs owner/render evidence)
- P8-08 BLOCKED: gate "forms collect health, financial, account or other sensitive data" = ? (gate "forms collect health, financial, account or other sensitive data" needs owner/render evidence)
- P9-04 BLOCKED: Owner to record the AI-bot decisions: allowed GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, anthropic-ai, PerplexityBot, Perplexity-User, Googlebot, Google-Extended, Bingbot, Applebot, Applebot-Extended, Amazonbot, CCBot, Bytespider, meta-externalagent, DuckAssistBot, MistralAI-User, cohere-ai; robots.txt disallows —; server blocks while robots.txt allows —

## Crawl errors

None (0 snapshots with status ≥ 400 or no answer).
