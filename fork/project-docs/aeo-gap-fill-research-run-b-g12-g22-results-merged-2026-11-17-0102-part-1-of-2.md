<!-- Part 1 of 2 (Gap status + Findings NB-01–NB-23). Split only for Project size limit; continues in part 2. -->

# AEO Gap-Fill Research — Run B (G-12–G-22 + discovery) — Claude: pass 1 research mode (web_search + web_fetch + 1 subagent) + pass 2 completion (WebSearch + WebFetch) — 2026-11-17

## Gap status

| G-ID | Status (CLOSED / PARTIAL / OPEN) | Answer (≤40 words)                                                                                                                                                                                                                                                                              | Grade | Source URL                                                                                                              |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| G-12 | CLOSED                           | Gemini/Claude apps fetch new pages live; Claude search tracks Brave's index (87.8% of retrieved URLs in Brave top 10). Median days to first citation: Perplexity 4, AI Mode 6, ChatGPT 11, Copilot 13, Gemini 16, AIO 18, Claude 22.                                                            | E3    | https://maxaeo.ai/blog/time-to-citation-ai-search/                                                                      |
| G-13 | CLOSED                           | Two independent agency cases with before/after numbers: an owned page stating the correct fact removed or fixed the wrong claim (ChatGPT, Perplexity, AIO). Effect faded without refresh. HTML facts page adopted in 3 of 4 tests. No head-to-head format test.                                 | E2    | https://www.verticality.co/blog/how-to-correct-what-chatgpt-says-about-your-brand/                                      |
| G-14 | CLOSED                           | Profound's 47.9% / 46.7% / 21% are shares within each platform's top-10 sources (7.8% / 6.6% / 2.2% of all citations). "71%" = undisclosed-method press release; Ahrefs: 37.9% of AIO citations in top 10. "3.2×" unsourced; YouTube-over-Reddit contested.                                     | E3    | https://www.tryprofound.com/blog/ai-platform-citation-patterns                                                          |
| G-15 | CLOSED                           | Google: Generative AI report (impressions by page, country, device, date; no clicks). Bing: Intents, Topics, Citation Share, Compare (preview). GA4: "AI Assistant" channel since 2026-05-13. OpenAI: only utm_source=chatgpt.com. Perplexity, Anthropic: none found.                           | E1    | https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports                                            |
| G-16 | CLOSED                           | AIO: cited 2.07% vs not cited 0.94% vs no AIO 3.35% effective organic CTR; position-1 CTR −58% with AIO. Referral quality mixed: e-commerce ChatGPT converts below organic; B2B ChatGPT 2.1% vs Google 0.5%. Other surfaces: no cited-vs-uncited data.                                          | E3    | https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update                                           |
| G-17 | CLOSED                           | ChatGPT, Claude, Gemini, Perplexity, Meta AI fetchers read raw HTML only; Mistral, DeepSeek, Qwen, Kimi, ERNIE execute JS; Copilot and Grok inconsistent. Browser agents use real Chromium; Applebot may render. Citation effect of JS-only content not measured.                               | E3    | https://www.searchengineworld.com/do-ai-assistants-actually-render-your-javascript-when-grounding-we-put-it-to-the-test |
| G-18 | CLOSED                           | No official doc says an answer surface reads llms.txt, Markdown alternates or Content Signals; Google says Search ignores them. 97% of llms.txt files never fetched. One controlled test: Perplexity +10.2 points, others null. AIPREF training token: Google 2027, Anthropic live.             | E1    | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide                                            |
| G-19 | CLOSED                           | Yes. Non-English queries got fewer citations and more empty answers (ChatGPT none for 33% of Twi); German prompts cite local-signal URLs 64.9%; 43% of ChatGPT fan-outs for non-English prompts run in English.                                                                                 | E3    | https://arxiv.org/pdf/2609.00319                                                                                        |
| G-20 | CLOSED                           | Sources: Google Business Profile (Google, official); Yelp grounds 95.83% of ChatGPT business cards; Siri answers from Applebot-crawled pages. On-site: own website most-cited; more pages and freshness correlate; structured data shows no relationship. Copilot, Siri selection undocumented. | E3    | https://insites.com/what-ai-uses-to-choose-local-businesses-and-what-it-ignores                                         |
| G-21 | CLOSED                           | OpenAI feed spec: nine required fields (price, availability); eligibility does not guarantee display. Google: Merchant Center feeds help products appear in AI responses; schema not required. ChatGPT's top product: Google Shopping top 3 in 75%. No on-page markup outcome study.            | E1    | https://developers.openai.com/commerce/specs/feed                                                                       |
| G-22 | CLOSED                           | Citation effect inconsistent: controlled byline test null for AIO, positive for Bing; 497-page study no byline effect; Perplexity cites company pages over individual-author pages (OR 0.40); author-page and sameAs lifts correlational only. No fact-accuracy evidence found.                 | E1    | https://www.seerinteractive.com/work/case-studies/author-bylines                                                        |

## Findings

#### NB-01 Gemini and Claude apps read fresh pages live

what: Same-morning test: ChatGPT, Claude, Gemini apps fetched a new page and reported HTML text; Perplexity and Copilot could not read a minutes-old page.
fills: G-12 | baseline: none
surfaces: ChatGPT search, Claude, Gemini app, Perplexity, Microsoft Copilot | metric: facts stated correctly | grade: E3 | risk: OK
do_this: "Expect index-dependent surfaces (Perplexity, Copilot) to lag on brand-new URLs; submit to Bing (IndexNow) and Google immediately."
check: not detectable from the site
limits: Two single-page tests (2025-05-30, 2026-09-25); Perplexity/Copilot failure cause unconfirmed by authors; AI Mode could not read the page in the 2025 test.
pass2: grade E4 → E3 (second independent test, Dejan: Gemini app retrieved a newly Google-indexed page; AI Mode, AI Studio, Vertex did not). Pass-1 check rule "New URL present in Bing and Google index within 7 days of publish." kept as guidance; not site-detectable.
sources:

- Practitioner | Forge AI Bot Log | Can AI crawlers run JavaScript? What ChatGPT-User really sees | https://www.forgeaibotlog.com/articles/can-ai-crawlers-execute-javascript/ | 2026-09-24 | 5 assistants, 2026-09-25, one test page, free+paid accounts
- Practitioner | DEJAN (Dan Petrovic) | AI Mode & Page Indexing | https://dejan.ai/blog/ai-mode-page-indexing/ | 2025-05-30 | one new test page with secret message, indexed via Search Console; no timing reported

#### NB-02 ChatGPT surfaces Google-indexed pages Bing lacks

what: Sting pages indexed only in Google were quoted by ChatGPT (paid) and Perplexity; ChatGPT free and Claude failed; ChatGPT echoed Google snippets.
fills: G-12 | baseline: replicates B-11 (independent)
surfaces: ChatGPT search, Perplexity, Gemini app | metric: cited with link, facts stated correctly | grade: E3 | risk: OK
do_this: "Get every answer-worthy URL indexed in Google as well as Bing; Google indexation gates ChatGPT paid-tier retrieval."
check: not detectable from the site
limits: Small sting tests (2025); Aleyda Solís test dated July 2025; tiers and models changed since.
pass2: overlap magnitude differs by method and tier → NB-20. Pass-1 check rule (Search Console shows 'URL is on Google'; URL indexed in Bing Webmaster Tools) kept as guidance; not site-detectable.
sources:

- Practitioner | Aleyda Solís | Confirmed: ChatGPT uses Google SERP Snippets for its Answers | https://www.aleydasolis.com/en/ai-search/chatgpt-uses-google-serp-snippets-for-answers/ | 2025-07-24 | 1 new page, repeated checks vs GSC/Bing index status
- News | Search Engine Land | ChatGPT is using Google, multiple tests suggest | https://searchengineland.com/chatgpt-using-google-search-tests-460101 | 2025 | Backlinko sting page "NexorbalOptimization", Googlebot-only crawl, multiple LLMs
- Practitioner | HackerNoon (Evgheni Cernigovet) | I Tested Whether ChatGPT Could Find a Page That Google Had Not Indexed | https://hackernoon.com/i-tested-whether-chatgpt-could-find-a-page-that-google-had-not-indexed | 2026-11-11 | 1 page, anecdotal; page found via other engines (E4)

#### NB-03 Owned page stating correct fact fixes AI errors

what: Seer post publishing real retention figure ended "high turnover" claim (67 mentions → 1); Verticality pricing pages flipped ChatGPT pricing answers 0/3 → 3/3.
fills: G-13 | baseline: replicates B-17 (independent)
surfaces: ChatGPT search, Perplexity, AIO | metric: facts stated correctly, cited with link | grade: E2 | risk: OK
do_this: "For each wrong AI claim, publish one crawlable owned page stating the correct fact in a plain, dated sentence; recheck monthly."
check: "Each tracked brand fact appears verbatim in server-rendered HTML on ≥1 indexable owned URL."
limits: No controls; vendor self-reports; run counts after fix not stated (Seer); Verticality reviews question not fixed.
sources:

- Vendor | Seer Interactive | How LLMs Amplify Brand Misconceptions & How to Address Them With GEO | https://www.seerinteractive.com/insights/using-geo-to-address-brand-misconceptions | 2026-01-27 | 1 prompt tracked Aug–Oct 2025; 1,152 branded outputs; ChatGPT, Perplexity, AIO
- Vendor | Verticality | How to Correct What ChatGPT Says About Your Brand: Fix the Source | https://www.verticality.co/blog/how-to-correct-what-chatgpt-says-about-your-brand/ | 2026-10-03 | 8 questions × 3 runs, ChatGPT, 2026-08-15 vs 2026-10-03

#### NB-04 Single-post corrections decay without refresh

what: Perplexity citations to Seer's correction post "essentially disappeared" by February 2026; republishing restored citations and the correct figure.
fills: G-13 | baseline: none
surfaces: Perplexity | metric: cited with link, facts stated correctly | grade: E3 | risk: OK
do_this: "Treat corrections as maintained assets: centralize brand facts on one page and refresh it on a schedule."
check: "Brand-facts page dateModified within last 90 days."
limits: One brand, one surface, no run counts or control.
sources:

- Vendor | Seer Interactive | GEO Experiment: How AI highlighted the 1 bad review we got in 24 years | https://www.seerinteractive.com/insights/geo-experiment-how-ai-highlighted-the-1-bad-review-we-got-in-24-years | 2026-03-24 | single-brand follow-up, Oct 2025–Feb 2026

#### NB-05 AI info (facts) page adopted in 3 of 4 tests

what: HTML "AI info page" facts adopted in 3 of 4 client tests (e.g., 21/57 facts in ChatGPT); one failed because bots never fetched it.
fills: G-13 | baseline: none
surfaces: ChatGPT search, Gemini app, Perplexity, AI Mode, AIO | metric: facts stated correctly, cited with link | grade: E3 | risk: OK
do_this: "Publish an HTML brand-facts page, link it internally, and confirm AI user-agents actually fetch it before measuring."
check: "Brand-facts page receives ≥1 ChatGPT-User/OAI-SearchBot/PerplexityBot request per 30 days in server logs."
limits: Author states no controls; mostly single-platform reads; small answer samples.
sources:

- Vendor | Seer Interactive | Testing llms.txt vs. AI Info Pages: GEO Quick Wins or Waste of Time? | https://www.seerinteractive.com/insights/llms.txt-vs-ai-info-page | 2026-11-10 | 4 client tests + own page, 403 answers Nov 2025–Sep 2026

#### NB-06 Most AI citations point beyond Google page one

what: 75% of AIO citation links pointed beyond page one; 1% of ChatGPT's 213 cited URLs were page-one results; ChatGPT searched in 21% of runs.
fills: G-14 | baseline: none
surfaces: AIO, ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "Do not treat page-one Google rank as a proxy for AIO or ChatGPT citation; track citations directly."
check: not detectable from the site
limits: 50 keywords, one day, US English; ChatGPT via API not consumer app; correlational.
pass2: larger originals behind the "71–80% not in Google top results" claim → NB-20 (ChatGPT) and NB-25 (AIO).
sources:

- Vendor | On-Page.ai Research | Do AI Assistants Cite Original Content? 793 AI Citations Measured Against the Pages That Rank | https://api.on-page.ai/research/ai-citation-study | 2026-07-15 | 50 keywords, 2026-07-15, 584 AIO links, 150 ChatGPT API runs
- Vendor | OMNIFAMOUS (press release via Saint Paul Chronicle) | 71% of ChatGPT citations go to sites missing from Google's first page | https://news.saintpaulchronicle.com/story/805506/71-of-chatgpt-citations-go-to-sites-missing-from-googles-first-page-omnifamous-2m-citation-study-finds.html | 2026-11-06 | 7,949 prompts, 239,841 citations, 5 engines, Jul–Sep 2026; method undisclosed (E4 for "71%")

#### NB-07 Cited pages are not more original

what: Cited vs uncited ranking pages scored equally on information gain (median 52 vs 55.5, p = .07); legal vertical the exception.
fills: G-14 | baseline: none
surfaces: AIO | metric: cited with link | grade: E3 | risk: OK
do_this: "Do not expect originality alone to win AIO citations; pair it with retrievability and query coverage."
check: not detectable from the site
limits: Vendor's own originality metric; correlational; 312 scored pages.
sources:

- Vendor | On-Page.ai Research | Do AI Assistants Cite Original Content? | https://api.on-page.ai/research/ai-citation-study | 2026-07-15 | 312 page-one results scored; within-SERP permutation test

#### NB-08 First-party AI reporting: Google and Bing

what: Search Console Generative AI report shows AIO/AI Mode impressions by page, country, device, date; no clicks. Bing adds intent, topic, citation share.
fills: G-15 | baseline: none
surfaces: AIO, AI Mode, Microsoft Copilot / Bing | metric: cited with link | grade: E1 | risk: OK
do_this: "Use Search Console Generative AI and Bing AI Performance reports as primary citation baselines; record weekly."
check: not detectable from the site
limits: Google report lacks clicks; Bing Citation Share is preview and "observational," not competitive.
pass2: Bing original now opened. Fields: Intents (Informational, Commercial, Navigational, Learn and Solve, Research, Creation, Local); Topics (clusters of grounding queries); Citation Share (site's share of all citations for the same grounding query); Compare (prior-period overlay). Coverage stated as Microsoft Copilot, Bing and select partner AI experiences. Citation Share exposes no competitor domains. Timeline (News): Bing AI Performance public preview 2026-02-10; grounding query→page mapping 2026-03-23; Topics Portfolio (Beta) 2026-10-13 (listed in Bing blog footer); Google reports all sites 2026-08-31. GA4 → NB-29. OpenAI → NB-30. Multimodal search type → NB-44.
sources:

- Official | Google Search Central | Introducing Search Generative AI performance reports in Search Console | https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports | 2026-06-03 | product announcement; worldwide rollout noted 2026-08-31
- Official | Google | Generative AI performance report (Search) – Search Console Help | https://support.google.com/webmasters/answer/16984139?hl=en | 2026 | help doc
- Official | Microsoft Bing Blogs | New AI Visibility Insights in Bing Webmaster Tools: Intents, Topics, Citation Share, Compare | https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/ | 2026-06-16 | product announcement, preview, global rollout
- News | Search Engine Journal | Bing Rolls Out AI Citation Share In Webmaster Tools | https://www.searchenginejournal.com/bing-rolls-out-ai-citation-share-in-webmaster-tools/579547/ | 2026-06-16 | report of Microsoft announcement (Krishna Madhavan)
- News | Search Engine Land | Bing Webmaster Tools updates AI reporting with Intents, Topics, Citation Share and Compare | https://searchengineland.com/bing-webmaster-tools-updates-ai-reporting-with-intents-topics-citation-share-and-compare-480277 | 2026-06 | quotes Microsoft definition of Citation Share
- News | PPC Land | ChatGPT builds mention and click charts for verified businesses | https://ppc.land/chatgpt-builds-mention-and-click-charts-for-verified-businesses/ | 2026-11-06 | reporting-launch timeline for Google and Bing

#### NB-09 AIO citation more than doubles clicks vs uncited

what: Effective organic CTR: 2.07% cited, 0.94% AIO-not-cited, 3.35% no AIO; paid CTR 15.74% cited vs 11.19% not cited.
fills: G-16 | baseline: none
surfaces: AIO | metric: clicks | grade: E3 | risk: OK
do_this: "Prioritize citation on AIO-triggering queries you already rank for; cited status is worth +120% clicks per impression."
check: not detectable from the site
limits: Correlational; AIO status is static last-snapshot label; 53 client brands; agency data.
sources:

- Vendor | Seer Interactive | AIO Impact on Google CTR: 2026 Update | https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update | 2026-04-24 | 53 brands, 5.47M queries, 2.43B impressions, Jan 2025–Feb 2026

#### NB-10 Assistant fetchers do not run JavaScript

what: 30-day log: ChatGPT-User 37,045 page reads, Claude-User 10,028, PerplexityBot 3,193 — zero script fetches; JS-drawn prices never seen in 237 reads.
fills: G-17 | baseline: none
surfaces: ChatGPT search, Claude, Perplexity | metric: facts stated correctly | grade: E3 | risk: OK
do_this: "Render every answer-worthy fact (price, spec, hours) in server HTML; never rely on client-side JS for it."
check: "Key facts present in raw HTML response (curl, no JS) for 100% of priority URLs."
limits: One news site; script counts matched by UA name, not IP; citation outcome not measured.
pass2: conflict flag — searchVIU's single October 2025 test saw Perplexity return a JS-inserted price; Forge logs and the Search Engine World test (NB-11) show Perplexity reading raw HTML. Unresolved; server HTML remains the safe rule.
sources:

- Practitioner | Forge AI Bot Log | Can AI crawlers run JavaScript? What ChatGPT-User really sees | https://www.forgeaibotlog.com/articles/can-ai-crawlers-execute-javascript/ | 2026-09-24 | 2,483,780 requests, 30 days to 2026-09-24; page reads verified against published IPs
- Practitioner | searchVIU (Michael Weber) | AI crawlers & JavaScript rendering: 39 bots compared | https://www.searchviu.com/en/guides/ai-crawlers-javascript-rendering/ | 2025-11-12 (updated 2026-11-03) | documentation review of 39 bots; relies on Vercel measurements of 2024-12-17; one own Perplexity test

#### NB-11 Some assistants do execute JavaScript

what: Twelve-assistant test: Mistral, DeepSeek, ERNIE, Qwen, Kimi reported the JS-injected value; ChatGPT, Claude, Gemini, Perplexity, Meta AI, Copilot, Grok reported raw HTML.
fills: G-17 | baseline: none
surfaces: Grok, Meta AI, ChatGPT search, Claude, Gemini app, Perplexity, Microsoft Copilot | metric: facts stated correctly | grade: E3 | risk: OK
do_this: "Keep HTML and JS-rendered values identical; divergent values give different answers per assistant."
check: "No fact differs between raw HTML and rendered DOM on priority URLs."
limits: One page, one prompt each; Copilot conflict (RESONEO January 2026: Copilot executed JS); Grok executed JS on one node yet answered from HTML.
pass2: Search Engine World original now opened (pass 1 had it secondhand via Forge). Added detail: Copilot fetched the JS file via Diffbot without executing it; Perplexity read the page (HTTP 200) while claiming it could not access it; MistralAI-User and DuckAssistBot fetched scripts in Forge logs (pass 1). RESONEO January 2026: ChatGPT-User, Claude-User, Gemini, Perplexity-User no JS; Copilot (stealth Chrome/142) and Grok, DeepSeek executed JS; ChatGPT, Claude, Gemini fetchers did not extract JSON-LD.
sources:

- Practitioner | Search Engine World (Andre Alpar) | Do AI Assistants Actually Render Your JavaScript when Grounding? We Put It to the Test. | https://www.searchengineworld.com/do-ai-assistants-actually-render-your-javascript-when-grounding-we-put-it-to-the-test | 2026-06-09 (updated 2026-07-02) | 12 assistants, one unlinked URL each, decoy value in HTML vs real value injected by JS, server logs
- Practitioner | Forge AI Bot Log | Can AI crawlers run JavaScript? | https://www.forgeaibotlog.com/articles/can-ai-crawlers-execute-javascript/ | 2026-09-24 | own log counts
- Study | RESONEO | AI Search crawler test results | https://think.resoneo.com/sentinel/geo-llm-crawler-report.html | 2026-01 | 15 content-injection methods with sentinel strings; user-mode fetchers only; runs not stated

#### NB-12 Frontier crawlers never request Markdown

what: Frontier AI crawlers sent Accept: text/markdown 0 times in 1,277,965 requests; Cloudflare serves Markdown only on explicit request.
fills: G-18 | baseline: none
surfaces: ChatGPT search, Claude, Perplexity | metric: cited with link | grade: E3 | risk: OK
do_this: "Do not invest in Markdown alternates or llms.txt for citation gains; fix server HTML instead."
check: "Zero /llms.txt or text/markdown requests from AI UAs over 30 days = no-op asset."
limits: Five properties; vendor with competing product; measures delivery, not citations.
pass2: Cloudflare doc opened: conversion happens only when the client sends Accept: text/markdown; doc names no crawler that does. Larger log study → NB-35. Controlled test → NB-36. Google's statement that Search does not use llms.txt or Markdown files = B-05 (same source, not re-reported).
sources:

- Vendor | AnswerShare | Cloudflare Agent Markdown and Frontier AI Crawlers | https://answershare.com/markdowndoesnotwork | 2026-08-17 | 1,277,965 frontier-crawler requests, 5 properties; 20,000 simulations
- Practitioner | DEV Community (Asad Abdullah Zafar) | llms.txt: 60 Days of Server Logs, Zero AI Crawler Requests | https://dev.to/asad_abdullah_zafar/llmstxt-60-days-of-server-logs-zero-ai-crawler-requests-3ld2 | 2026 | 4,218 AI crawler requests, 60 days, 0 to /llms.txt
- Official | Cloudflare Docs | Markdown for Agents | https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ | 2026-11-09 | product documentation

#### NB-13 Language changes citation volume and sources

what: Non-English queries averaged 9.2 sources vs 12.3 English; ChatGPT returned none for 33% Twi, 23% Japanese; Perplexity stable across languages.
fills: G-19 | baseline: changes B-12
surfaces: ChatGPT search, Perplexity, AIO | metric: cited with link | grade: E3 | risk: OK
do_this: "Measure AI citations separately per language and market; add runs for non-English prompts."
check: not detectable from the site
limits: Mental-health domain only; 3 questions per non-English language; free tiers.
sources:

- Study | arXiv (Nguyen et al., BIDMC/Harvard) | Sources of Truth: A Multi-Platform, Multilingual Audit of Citations in AI Mental Health Information Queries | https://arxiv.org/pdf/2609.00319 | 2026 | 1,140 responses, 15,942 citations, 7 languages, 2026-06-25 to 2026-07-20

#### NB-14 Localized URLs win German AI citations

what: 64.9% of German-prompt citations hit .de/.at/.ch or localized paths; 13.8% go to /de/ paths or de. subdomains on global domains.
fills: G-19 | baseline: none
surfaces: ChatGPT search, AIO, AI Mode, Gemini app, Perplexity, Microsoft Copilot, Claude | metric: cited with link | grade: E3 | risk: OK
do_this: "Serve market-language content on localized URLs (/de/ or ccTLD) to compete in non-English AI answers."
check: "Each target market has indexable localized URLs with matching hreflang."
limits: Vendor; correlational; German market only; 44 days.
sources:

- Vendor | OtterlyAI | AI Search in Germany Plays by Different Rules. Here Is the Data. | https://otterly.ai/blog/ai-search-index-germany/ | 2026-10-05 | 3.95M German + 3.73M US citations, 7 engines, 16 industries, 44 days

#### NB-15 Local answers draw on GBP, Yelp, websites

what: Google Business Profile 28.6% of local AI citations (94% of businesses); Yelp in 80% of ChatGPT local answers; businesses reappear 50%+ on reruns.
fills: G-20 | baseline: none
surfaces: AI Mode, AIO, ChatGPT search | metric: cited with link, brand mentioned | grade: E3 | risk: OK
do_this: "Keep website NAP, hours and services identical to Google Business Profile and Yelp records."
check: "Name, address, phone, hours in server HTML match GBP exactly on every location page."
limits: Vendor; on-site factor effects untested; no Perplexity, Copilot, Siri data.
pass2: on-site evidence added → NB-38, NB-39; official source statements → NB-33, NB-40; listing-platform data → Off-site. BrightLocal detail retained from pass 1: business websites 42% of citations (93% of cited domains).
sources:

- Vendor | BrightLocal | What 200k local AI searches tell us about what businesses get recommended | https://www.brightlocal.com/research/local-ai-visibility-study/ | 2026-09-16 | 200,085 localized searches, 1.9M+ AI citations, ~1,300 business locations

#### NB-16 ChatGPT shopping relies on structured metadata

what: OpenAI feed spec requires item_id, title, description, url, brand, seller_name, image_url, availability, price; eligibility does not guarantee display; ranking factors unstated.
fills: G-21 | baseline: none
surfaces: ChatGPT search | metric: brand mentioned, cited with link | grade: E1 | risk: OK
do_this: "Supply a direct product feed (or Shopify/Etsy integration) with current price and availability matching the product page."
check: "Feed price and availability equal on-page HTML values for 100% of SKUs."
limits: Spec does not explicitly require feed–page match; merchant approval needed; help-center article unfetchable twice; no outcome study for any surface.
pass2: official feed spec opened. Also required: target_countries, store_country. is_eligible_search defaults to true. Spec tells merchants to update price when a sale starts or ends and availability when stock changes; product and image URLs must be publicly accessible. Pass-1 statement retained (help-center page, search-result text only): products selected using structured metadata (price, description) from first- and third-party providers, prior model responses, and policies; results not ads; OpenAI doc does not mention schema.org.
sources:

- Official | OpenAI Developers | Product feed schema – Agentic Commerce | https://developers.openai.com/commerce/specs/feed | date not shown | stable spec; draft version not for production
- Official | OpenAI Help Center | Shopping with ChatGPT Search | https://help.openai.com/en/articles/11128490-shopping-with-chatgpt-search | 2026 | platform documentation (page bot-blocked; search-result text used)

#### NB-17 Author bylines: no AIO lift in controlled test

what: 123 pages gained detailed bylines and Person schema; AIO citations ≈ control (not significant); Bing citations +109% vs ~34% control (44% vs 27% pages improved).
fills: G-22 | baseline: none
surfaces: AIO, Microsoft Copilot / Bing | metric: cited with link | grade: E1 | risk: OK
do_this: "Add bylines for users and quality reviewers, not as an AIO citation lever; monitor Bing citations."
check: "Every article has a named human byline linked to an author page."
limits: Nonrandomized; Bing result not significance-tested, few pages per tier; author calls results inconclusive.
pass2: added from the same page: Bing gain by author tier — least-known authors +113%, best-known author +21%; pages with blanked or placeholder bylines showed no AI citation penalty; AI retrieval crawl effect −1.3% (statistically zero). More studies → NB-42, NB-43.
sources:

- Vendor | Seer Interactive | Do Author Bylines Influence AI Visibility? Testing EEAT Elements in GEO | https://www.seerinteractive.com/work/case-studies/author-bylines | 2026 | 123 treated pages vs untreated control; Semrush, Bing WMT, Googlebot logs

#### NB-18 Shared AI-training token maps to Google-Extended

what: Google will treat the shared AIPREF training opt-out token as a Google-Extended disallow unless Google-Extended is set explicitly; support aimed for 2027.
fills: discovery | baseline: changes B-19
surfaces: Gemini app, Claude | metric: cited with link | grade: E1 | risk: OK
do_this: "If you add a `User-agent: __usage_ai-training` disallow group, also add an explicit Google-Extended group stating your Gemini-grounding choice."
check: "robots.txt containing a \_\_usage_ai-training group also contains an explicit Google-Extended group."
limits: Token string comes from Google's crawler-page note via Search Engine Roundtable; Google post gives no syntax; OpenAI timing "coming months" (News); draft may change.
pass2: official Google post opened (pass 1: News only, syntax unconfirmed). Google: sites that allow Google-Extended are eligible to appear and get clicks via grounding in Gemini Apps; post does not address Search crawling, AIO or AI Mode. Crawler-page note: support intended early 2027. Anthropic help page: signal recognized as of 2026-10-30; rules naming ClaudeBot take priority. Bing: B-03. Pass-1 title "Shared IETF AI-training control in robots.txt", surfaces "Gemini app, AIO, AI Mode", do_this "Track the shared AI-training robots.txt token; verify per-vendor grounding effects before using it." superseded. Pass-1 what: Google announced support for a shared IETF (AIPREF) AI-training control in robots.txt, joining Bing, OpenAI and Anthropic; company tokens still work. Pass-1 check: robots.txt reviewed against shared token spec after vendor enforcement dates. Pass-1 limits: work-in-progress standard; token syntax and Google's grounding interpretation not confirmed from an official page.
sources:

- Official | Google Search Central Blog (John Mueller) | Supporting a shared AI training control for websites | https://developers.google.com/search/blog/2026/10/ai-training-control | 2026-10-30 | announcement; based on IETF AIPREF working-group draft
- Official | Anthropic Help Center | Does Anthropic crawl data from the web, and how can site owners block the crawler? | https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler | date not shown | bot documentation: ClaudeBot (training), Claude-User (user fetch), Claude-SearchBot (search index)
- News | Search Engine Roundtable | [title not captured] | https://seroundtable.com/google-ai-training-control-42430.html | 2026-10-30 | quotes Google's common-crawlers note with the token string
- News | Search Engine Land | Google also gives publishers more control over how AI uses their content | https://searchengineland.com/google-also-gives-publishers-more-control-over-how-ai-uses-their-content-499971 | 2026-10-30 | announcement report (page bot-blocked; search-result text used)

#### NB-19 Cloudflare Markdown for Agents defaults to allow AI

what: Cloudflare Markdown for Agents converts HTML to Markdown on Accept: text/markdown; without an origin header it adds Content-Signal ai-train=yes, search=yes, ai-input=yes.
fills: discovery | baseline: none
surfaces: none measured | metric: cited with link | grade: E1 | risk: GREY
do_this: "If enabling Markdown for Agents, set your own Content-Signal header; defaults grant AI training."
check: "Responses to Accept: text/markdown carry an explicit, site-set content-signal header."
limits: Doc last updated 2026-11-09; GA status not stated there; no answer surface confirmed to send the header (NB-12).
pass2: grade E4 → E1 for the default-header fact (Cloudflare doc opened). Available on Pro, Business, Enterprise and SSL for SaaS at no cost. Pass-1 what: Markdown for Agents reached GA 2026-11-09; absent an origin header, Cloudflare adds Content-Signal ai-train=yes, search=yes, ai-input=yes. Pass-1 limits: default confirmed in Cloudflare changelog (Origin Content Signals for Markdown for Agents); beta launched February 2026; GA date unconfirmed. GA date still unconfirmed: the doc carries only a last-updated date of 2026-11-09.
sources:

- Official | Cloudflare Docs | Markdown for Agents | https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ | 2026-11-09 | product documentation
- Practitioner | ansezz.com | Cloudflare will convert your pages to Markdown for agents. The default signal says they can train on them. | https://ansezz.com/blog/ship-your-own-markdown-for-agents/ | 2026-11 | documentation review

#### NB-20 ChatGPT–Google overlap estimates conflict by method

what: ChatGPT–Google overlap depends on method: Ahrefs 16.61% of fan-out results in Google SERPs; AirOps 55.8% of cited pages top-20; RESONEO paid Thinking ≈75% scraped Google.
fills: G-12 | baseline: changes B-11
surfaces: ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "Treat Google ranking as helpful, not sufficient, for ChatGPT; measure ChatGPT citations directly and separately for free and paid tiers."
check: not detectable from the site
limits: Different denominators and dates (2025-08 to 2026-08); all correlational; vendors; free tier draws mostly on OpenAI's own index.
sources:

- Vendor | Ahrefs | Is ChatGPT Really Powered by Google? 118,931 Fan-Out Queries Analyzed | https://ahrefs.com/blog/is-chatgpt-really-powered-by-google/ | 2025-08-20 | 118,931 fan-out queries; 6.82% of ChatGPT results in Google top 10, 9.85% top 20, 16.61% anywhere in SERP (search-result excerpt of original)
- Vendor | AirOps | The Influence of Retrieval, Fan-out, and Google SERPs on ChatGPT Citations | https://www.airops.com/report/influence-of-retrieval-fanout-and-google-serps-in-chatgpt | 2026-03-12 | 15,000 prompts, 548,534 retrieved pages, 82,108 citations; 32.9% of top-20 cited pages found only via fan-out queries; pages ranked #1 cited at 43.2%; window not stated
- Vendor | Grow and Convert | [title not captured] (fan-out query SERP study) | https://www.growandconvert.com/ai/fan-out-query-serp-study/ | date not shown | 100 buying-intent prompts; 27% of cited sources ranked on Google and 23% on Bing for the fan-out queries; 83 of 100 prompts triggered search (search-result excerpt of original)
- Study | RESONEO | What ChatGPT pulls, what it shows, what it cites | https://think.resoneo.com/chatgpt-retrieval/ | 2026-07 (updated 2026-08-08) | 1,249 answers, 88,000 results; free instant 63.6% own index / 34.7% scraped Google; paid Thinking 74.6% scraped Google (same study as B-09–B-11, original opened)

#### NB-21 New pages: AI Mode cites first, ChatGPT accrues

what: 81 new FAQ pages: AI Mode cited 36% day 1, 59% day 6, 26% day 30; ChatGPT 10% day 1, 42% day 30.
fills: G-12 | baseline: none
surfaces: AI Mode, ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "Judge new-page citation at day 30, not day 1; expect AI Mode churn and slow ChatGPT accrual."
check: not detectable from the site
limits: One high-authority site (Authority Score 84); FAQ pages only; prompts undisclosed; vendor's own tool.
sources:

- Vendor | Semrush | How Fast Do AI Search Platforms Cite New Content? | https://www.semrush.com/blog/how-fast-do-ai-search-platforms-cite-new-content/ | 2025-12-10 | 81 pages published September 2025, tracked daily for 30 days; ChatGPT day 1 = 8 of 81 pages (article text says 8%)

#### NB-22 Median days to first citation by surface

what: 740 new pages, 132 brands: median days to first citation Perplexity 4, AI Mode 6, ChatGPT 11, Copilot 13, Gemini 16, AIO 18, Claude 22.
fills: G-12 | baseline: none
surfaces: Perplexity, AI Mode, ChatGPT search, Microsoft Copilot, Gemini app, AIO, Claude | metric: cited with link | grade: E3 | risk: OK
do_this: "Set review dates per surface: Perplexity and AI Mode week 1, ChatGPT and Copilot week 2, Gemini, AIO, Claude weeks 3–4; stable citation near day 41."
check: not detectable from the site
limits: Vendor; per-engine n and spread undisclosed; correlational; 41% of first citations were gone the next day.
sources:

- Vendor | MaxAEO | Time to Citation in AI Search: How Long Until You Show Up? | https://maxaeo.ai/blog/time-to-citation-ai-search/ | 2026-07-02 | 1,240 sources (740 owned, 500 earned), 132 brands, Feb–May 2026, daily checks on ~50 prompts per brand; top-tertile domains 7 days vs bottom-tertile 21
- Practitioner | The GEO Lab (Artur Ferreira) | AI Citation Lag: How Long Before AI Search Cites a New Page? | https://thegeolab.net/citation-rate-after-publishing-new-page/ | 2026-08-31 | n = 1 page: PerplexityBot recrawled 12 days after a change; first Perplexity citation the same day as the crawl
- Vendor | Seer Interactive | GEO Experiment: How AI highlighted the 1 bad review we got in 24 years | https://www.seerinteractive.com/insights/geo-experiment-how-ai-highlighted-the-1-bad-review-we-got-in-24-years | 2026-03-24 | single case: Perplexity cited the correction post the day it was published (pass-1 G-12 timing datum)

#### NB-23 Claude retrieval tracks Brave Search top 10

what: Claude web-search API: 87.8% of retrieved URLs were in Brave's top 10 (Google 45.6%); citation rate 92.0% at Brave ranks 1–3, 11.9% outside top 20.
fills: G-12 | baseline: changes B-17
surfaces: Claude | metric: cited with link | grade: E3 | risk: OK
do_this: "Check Brave Search indexation and rank for target queries before expecting Claude citations; Google and Bing indexation is not enough."
check: not detectable from the site
limits: API, not consumer app; correlational; agency study; Anthropic lists Brave Search and turbopuffer as web-search subprocessors but discloses no ranking logic.
sources:

- Vendor | Complete SEO (Ryan Howard) | Nearly nine in ten URLs Claude retrieves are in Brave's top 10 | https://completeseo.com/claude-web-search-runs-on-brave/ | 2026-09-01 | 1,481 matched queries; 5,397 Claude runs; 52 accounts, 1,408 prompt observations; June–August 2026
- Practitioner | Xponent21 (Isaac Marcuson) | Anthropic Lists Two Web-Search Subprocessors Behind Claude — and the GEO Playbook Missed the Second | https://xponent21.com/insights/claude-web-search-brave-turbopuffer/ | 2026-07-02 | Brave Search listed 2025-03-19, turbopuffer 2026-05-06; Profound re-run ≈400 queries: 79.2% overlap (86.7% in 2025 came from 3 queries)
- News | Search Engine Land | Claude visibility may depend heavily on Brave Search rankings, new data suggests | https://searchengineland.com/claude-visibility-brave-search-rankings-480053 | date not shown | Jonathan Clark / Profound session: Claude searched in 36.6% of prompts; n not stated
