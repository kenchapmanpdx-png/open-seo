# AEO Gap-Fill Research — Run A (G-01–G-11) — Claude (research-agent pass 1 + web search/fetch pass 2, merged) — 2026-11-17

## Gap status

| G-ID | Status (CLOSED / PARTIAL / OPEN) | Answer (≤40 words)                                                                                                                                                                                                                                                                                                         | Grade   | Source URL                                                                                                                                                                                                    |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 | CLOSED                           | Google: `max-snippet:0` = `nosnippet`; both remove snippets and direct AIO/AI Mode input; no documented or tested minimum. Bing: `data-nosnippet` text excluded from Bing snippets and Copilot answers, stays indexed. Other engines: no evidence found.                                                                   | E1      | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag · https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/                         |
| G-02 | PARTIAL                          | No controlled production test found. Correlational production studies: cited pages open with a direct answer 20% vs 5%; 44.2% of ChatGPT citations from first 30% of text; tables +69% odds, FAQ sections +26%, lists +22%.                                                                                                | E3      | https://tjrobertson.com/ai-citation-study/ · https://searchengineland.com/chatgpt-citations-content-study-469483                                                                                              |
| G-03 | PARTIAL                          | Google: no special schema needed for AI features. Microsoft: schema helps LLMs understand content; no citation claim. No OpenAI, Perplexity, Anthropic, Apple, Amazon statement found. JSON-LD-only fact tests conflict. No type-isolated citation test. Speakable still beta.                                             | E1 / E3 | https://developers.google.com/search/docs/appearance/ai-features · https://searchengineland.com/microsoft-bing-copilot-use-schema-for-its-llms-453455                                                         |
| G-04 | PARTIAL                          | Official docs opened for OpenAI, Anthropic (incl. Claude-Agent), Mistral, Perplexity, Google-Agent, You.com, Diffbot, Cohere, Meta, Apple, Amazon, Bing syntax. OAI-SearchBot fills ChatGPT search. xAI and DeepSeek: no official crawler doc found.                                                                       | E1      | https://developers.openai.com/api/docs/bots.md · https://docs.mistral.ai/robots                                                                                                                               |
| G-05 | CLOSED                           | Official docs opened for all eight platforms state eligibility only (crawl access, indexing, snippet eligibility). None publishes passage-selection rules, freshness weights or link-vs-mention rules. Bing: missing, stale or conflicting support can lead to abstention.                                                 | E1      | https://developers.google.com/search/docs/appearance/ai-features · https://blogs.bing.com/search/2026/5/Evolving-role-of-the-index-From-ranking-pages-to-supporting-answers/                                  |
| G-06 | CLOSED                           | Three independent correlational studies: cited pages skew recently updated (75% within 1 year; +88% odds if updated within 12 months). Update date, not publish date, carries it. No study isolates the signal; B-08 not replicated.                                                                                       | E3      | https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026 · https://tjrobertson.com/ai-citation-study/                                                                  |
| G-07 | PARTIAL                          | Google documents no VideoObject `transcript` property; key moments come from Clip, SeekToAction or YouTube timestamps. YouTube takes 31.8% of social-media citations vs Vimeo 0.1%. No controlled on-page transcript test; no caption statement for ChatGPT, Perplexity, Copilot.                                          | E1 / E3 | https://developers.google.com/search/docs/appearance/structured-data/video · https://otterly.ai/blog/youtube-ai-citation-study-2026/                                                                          |
| G-08 | CLOSED                           | Siri: Applebot crawl data can feed AI answers in Siri and Search, with links. Alexa: Amzn-SearchBot. Google voice: Speakable beta; Gemini Live API grounds on Google Search, excluding Google-Extended-disallowed pages. No on-site factor measured beyond crawl access.                                                   | E1      | https://support.apple.com/en-us/119829 · https://firebase.google.com/docs/ai-logic/grounding-google-search                                                                                                    |
| G-09 | CLOSED                           | Featured snippets fell from 15.41% to 5.53% of 1M US desktop SERPs (Jan–Jun 2025) while AIO rose to 27.43%. PAA answers AI-generated: 12.6% (Jul 2025) to 97% (Sep 2026). No controlled selection test since 2025 found.                                                                                                   | E3      | https://ahrefs.com/blog/how-serp-features-have-evolved-in-the-ai-era · https://seroundtable.com/ppa-ai-overviews-google-42047.html                                                                            |
| G-10 | PARTIAL                          | No two studies agree on a run count. SparkToro: 60–100 runs per prompt (heuristic). B-12: 14–58. Source sets: same-day repeat 23–25%, next week 24–28%; monthly domain drift 40–59%. Use multi-run presence rate over rolling weeks.                                                                                       | E3      | https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/ · https://tjrobertson.com/ai-citation-study/ |
| G-11 | PARTIAL                          | Policy text: Google (AI-response manipulation, invisible markup, scaled pages), Bing (prompt injection; wording unverified), Anthropic (Usage Policy, Claude users only). Microsoft deployed Copilot mitigations. OpenAI, Perplexity: no site-owner manipulation policy found. Listicle enforcement observed, unconfirmed. | E1 / E3 | https://developers.google.com/search/docs/essentials/spam-policies · https://www.anthropic.com/legal/aup                                                                                                      |

## Findings

#### NA-01 Google `max-snippet:0` equals `nosnippet`; both cut AI input

what: `nosnippet` applies to web, Images, Discover, AIO, AI Mode and blocks direct AI input; `max-snippet:0` is defined as "Equivalent to nosnippet."
fills: G-01 | baseline: changes B-19 (adds Discover/Images scope; explicit 0 = nosnippet)
surfaces: Google featured snippets, AIO, AI Mode | metric: picked as snippet; cited with link | grade: E1 | risk: OK
do_this: "Never ship `max-snippet:0` or `nosnippet` on pages meant for featured snippets, AIO or AI Mode; use `max-snippet:-1`."
check: "Flag any indexable page whose robots meta or X-Robots-Tag contains `nosnippet` or `max-snippet:0`."
limits: Doc states scope, not measured citation loss. When both directives appear, `nosnippet` wins. Pass-1 source; not re-opened in pass 2.
sources:

- Official | Google Search Central | Robots meta tag, data-nosnippet, and X-Robots-Tag specifications | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag | undated | doc text (pass 1)

#### NA-02 `max-snippet:[n]` limits AIO/AI Mode input; no threshold

what: `max-snippet:[n]` applies to web, Images, Discover, Assistant, AIO and AI Mode and limits how much content feeds AIO/AI Mode; no minimum is documented.
fills: G-01 | baseline: replicates B-19 (official restatement; adds Assistant/Discover)
surfaces: Google featured snippets, AIO, AI Mode, Google voice | metric: picked as snippet; cited with link | grade: E1 | risk: OK
do_this: "Remove legacy `max-snippet:160`-style caps on answer pages; set `max-snippet:-1`."
check: "Flag pages with `max-snippet` between 0 and 300 on pages targeting question queries."
limits: No documented or tested minimum length. The 300 threshold in check is a heuristic, SPECULATIVE. Pass-1 source.
sources:

- Official | Google Search Central | Robots meta tag, data-nosnippet, and X-Robots-Tag specifications | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag | undated | doc text (pass 1)

#### NA-03 Featured snippets: no minimum length; PAA uses same feature

what: Google states no exact minimum for featured snippets; a low `max-snippet` does not guarantee removal; featured snippets also appear in related-question (PAA) groups.
fills: G-01 | baseline: none
surfaces: Google featured snippets, PAA | metric: picked as snippet | grade: E1 | risk: OK
do_this: "To exit featured snippets only, lower `max-snippet` stepwise and re-check; to guarantee exit use `nosnippet` (also exits AIO and AI Mode)."
check: not detectable from the site
limits: Minimum varies by snippet, language, platform. PAA statement from Japanese doc version. PAA answers now mostly AI-generated (NA-38), so AIO rules apply there — INFERENCE.
sources:

- Official | Google Search Central | Featured snippets and your website | https://developers.google.com/search/docs/appearance/featured-snippets | undated | doc text (pass 1)
- Official | Google Search Central | 強調スニペットとウェブサイト | https://developers.google.com/search/docs/appearance/featured-snippets?hl=ja | undated | doc text (pass 1)

#### NA-04 `data-nosnippet` removes text from Bing snippets and Copilot answers

what: Bing (2025-10-15): `data-nosnippet` sections are kept out of Bing snippets and Copilot AI answers; "any content marked with data-nosnippet is still indexed normally".
fills: G-01 | baseline: changes B-03 (official scope: excluded, not only 'may limit citation quality')
surfaces: Microsoft Copilot / Bing, Google featured snippets | metric: picked as snippet; facts stated correctly | grade: E1 | risk: OK
do_this: "Wrap only paywalled, legal or outdated passages in `data-nosnippet`; never wrap the answer block."
check: "Flag `data-nosnippet` on any element containing the first paragraph after H1 or the first list/table."
limits: Bing blog describes no interaction with `nosnippet` or `max-snippet`. Google side from featured-snippets doc (pass 1): excluded from featured and regular snippets.
sources:

- Official | Microsoft Bing Webmaster Blog | Bing Introduces Support for the data-nosnippet HTML Attribute | https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/ | 2025-10-15 | announcement text (pass 2; replaces pass-1 news source)
- Official | Google Search Central | Featured snippets and your website | https://developers.google.com/search/docs/appearance/featured-snippets | undated | doc text (pass 1)

#### NA-05 Google spam policy covers AI-answer manipulation

what: Google's spam definition includes attempts to manipulate generative AI responses in Search; its cloaking and hidden-text sections name no AI crawlers.
fills: G-11 | baseline: changes B-05 (extends beyond scaled content to the spam definition)
surfaces: AIO, AI Mode | metric: cited with link; brand mentioned | grade: E1 | risk: VIOLATES (https://developers.google.com/search/docs/essentials/spam-policies)
do_this: "Treat hidden instructions, cloaking and scaled fake Q&A aimed at AI answers as Google spam."
check: "Flag CSS-hidden or zero-size text containing imperative phrases addressed to AI, LLM or assistant."
limits: Tactics not named individually; AI-crawler cloaking not addressed explicitly; no public enforcement data. Page updated 2026-08-28; AI wording added 2026-05 (pass 1).
sources:

- Official | Google Search Central | Spam policies for Google web search | https://developers.google.com/search/docs/essentials/spam-policies | updated 2026-08-28 | policy text (pass 1 + pass 2)
- Official | Google Search Central | Latest documentation updates | https://developers.google.com/search/updates | 2026-05 | changelog (pass 1)

#### NA-06 Bing lists prompt injection and AI manipulation as abuse

what: Bing guidelines list prompt injection and AI manipulation as abuse: content built to manipulate Bing or Copilot language models may lose visibility or be removed.
fills: G-11 | baseline: none (B-04 covers guidelines, not the abuse section)
surfaces: Microsoft Copilot / Bing | metric: cited with link | grade: E1 | risk: VIOLATES (https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
do_this: "Remove any text, alt, comment or schema field that instructs an AI system; audit 'Summarize with AI' buttons."
check: "Flag prefilled AI share links (chatgpt.com/?q=, claude.ai/new?q=, perplexity.ai/search?q=) containing 'remember' or 'cite'."
limits: Guidelines page is JavaScript-only; not opened in either pass. Wording paraphrased from pass-1 search snippet and SEJ report — UNVERIFIED wording.
sources:

- Official | Microsoft Bing | Webmaster Guidelines | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | undated (rewritten 2026-02) | policy text via snippet (pass 1)
- News | Search Engine Journal | Bing Adds GEO To Official Guidelines, Expands AI Abuse Definitions | https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ | 2026-02-27 | report (pass 1)

#### NA-07 Self-ranking listicles lose further ground in AIO

what: Versus June 2026, AIO cite 38% fewer self-promotional 'best of' listicles; publishing brand left out 83% (was 69%); 70% help competitors.
fills: G-11 | baseline: changes B-13 (same author, same query set, later wave)
surfaces: AIO | metric: cited with link; brand mentioned | grade: E3 | risk: GREY
do_this: "Do not publish 'best X' lists ranking your own product first; publish comparison pages with disclosed criteria instead."
check: "Flag pages with 'best' in H1 where the site's own brand is item #1 in the first `<ol>`."
limits: Practitioner study, not independent of B-13; 100 B2B 'best [category] software' queries; Google has not named listicles in policy.
sources:

- Practitioner | Lily Ray (Substack) | Prediction: the next massive Google update is around the corner | https://lilyraynyc.substack.com/p/prediction-the-next-massive-google | 2026-10-04 | 100 B2B 'best' queries, June vs Sept 2026, AIO capture (pass 1)

#### NA-08 Bing AI Training / AI Grounding preference syntax

what: robots.txt `User-Agent: __usage_ai-training`; page-level `<meta name="Bingbot" content="ai-grounding:disallow">` or `X-Robots-Tag: Bingbot: ai-training:disallow`; grounding is page-level only; effective 2027-02-01.
fills: G-04 | baseline: changes B-03 (adds syntax, values, where set, transition dates)
surfaces: Microsoft Copilot / Bing | metric: cited with link | grade: E1 | risk: OK
do_this: "Leave AI Grounding at default allow on pages you want cited in Copilot; replace NOARCHIVE/NOCACHE with explicit preferences before 2027-03-01."
check: "Flag NOARCHIVE, NOCACHE, `ai-grounding:disallow` or `ai-grounding:disallowextended` on pages meant for Copilot."
limits: `disallowextended` keeps Microsoft-operated experiences, drops third-party grounding. Preferences don't change classic Bing eligibility. Temporary-preference window opens 2026-12-15, expires 2027-09-30.
sources:

- Official | Microsoft Bing Blog (Krishna Madhavan) | Your content, your choice: clearer preferences for training and grounding | https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/ | 2026-10-30 | announcement text (pass 2, page opened)

#### NA-09 Meta AI citations depend on Meta-WebIndexer

what: Meta-WebIndexer improves Meta AI search; allowing it "helps us cite and link to your content" in Meta AI responses.
fills: G-04, G-05 | baseline: changes B-19 (adds Meta search token)
surfaces: Meta AI | metric: cited with link | grade: E1 | risk: OK
do_this: "Allow `meta-webindexer` in robots.txt and WAF; decide `meta-externalagent` (training) separately."
check: "Flag robots.txt groups disallowing `meta-webindexer` on public content paths."
limits: No outcome data. Meta-ExternalFetcher may bypass robots.txt. Pass-1 source.
sources:

- Official | Meta for Developers | Meta Web Crawlers | https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers | undated (fetched 2026-11-17) | doc text (pass 1)

#### NA-10 Alexa search eligibility via Amzn-SearchBot

what: Allowing Amzn-SearchBot makes content "eligible to appear in search experiences such as Alexa"; it follows other search bots' rules when unnamed.
fills: G-08, G-04 | baseline: replicates B-19 (adds Alexa source path)
surfaces: Alexa | metric: cited with link; facts stated correctly | grade: E1 | risk: OK
do_this: "Allow Amzn-SearchBot explicitly in robots.txt and WAF."
check: "Flag robots.txt disallowing `Amzn-SearchBot`, or disallowing all search bots with no Amzn-SearchBot group."
limits: Eligibility only; no ranking or voice-answer selection data. Pass-1 source.
sources:

- Official | Amazon Developer | Amazon Web Search crawlers | https://developer.amazon.com/amazonbot | undated | doc text (pass 1)

#### NA-11 Structured data: Bing guidelines hedge; staff say it aids understanding

what: Bing guidelines: structured data may support grounding without guaranteeing visibility (wording unverified). Fabrice Canel (Bing): "schema markup helps Microsoft's LLMs understand your content".
fills: G-03 | baseline: none (B-01 tested Google/ChatGPT only)
surfaces: Microsoft Copilot / Bing | metric: cited with link | grade: E1 | risk: OK
do_this: "Keep valid Organization, Product and Article JSON-LD for Bing/Copilot understanding; expect no citation lift from markup alone."
check: "Flag JSON-LD values (price, name, date) that differ from visible page text."
limits: Canel statement relayed via David Mihm's LinkedIn post, confirmed in comments; covers understanding, not citations. Guidelines page JS-only. No outcome data.
sources:

- News (named platform staff) | Search Engine Land | Microsoft Bing/Copilot use schema for its LLMs | https://searchengineland.com/microsoft-bing-copilot-use-schema-for-its-llms-453455 | undated on page (SMX Munich) | statement report (pass 2)
- Official | Microsoft Bing | Webmaster Guidelines §14 | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | undated | policy text via snippet (pass 1)

#### NA-12 JSON-LD-only facts: three tests conflict

what: JSON-LD-only facts: searchVIU 0 of 5 systems reported them; Otterly none; Williams-Cook saw ChatGPT and Perplexity return an address from invalid JSON-LD.
fills: G-03 | baseline: replicates B-10 (independent, 2 of 3 tests); 1 test contradicts
surfaces: ChatGPT search, Perplexity, Claude, Gemini app, AI Mode, Microsoft Copilot / Bing | metric: facts stated correctly | grade: E3 | risk: OK
do_this: "State every key fact (price, spec, date, address) in visible HTML text; never rely on JSON-LD alone."
check: "Flag JSON-LD `price`, `telephone`, `address`, `datePublished` values absent from visible text."
limits: CONFLICT unresolved: three single-run tests, prompt counts undisclosed in two. Williams-Cook read his result as plain-text pickup, not schema parsing.
sources:

- Vendor | searchVIU | Schema markup and AI in 2025: what ChatGPT, Claude, Perplexity, Gemini really see | https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ | 2025-12-02 | 8 page variants × 5 systems, one run 2025-10-30 (pass 1)
- Vendor | OtterlyAI | GEO Experiment: Does Schema Markup Really Impact AI Search? | https://otterly.ai/blog/schema-markup-real-impact-ai-search/ | 2026-03-23 | unique FAQ-schema fact, 7 platforms, one prompt each; direct-fetch test: only Gemini returned the JSON-LD correctly (pass 2)
- News | Search Engine Roundtable | Report: ChatGPT & Perplexity Treat Structured Data As Text On A Page | https://www.seroundtable.com/chatgpt-perplexity-structured-data-text-40862.html | 2026-02-06 | Mark Williams-Cook: fictional company, address only in invalid JSON-LD; runs not stated (pass 2)

#### NA-13 Speakable remains beta, news-only, US English

what: Speakable (BETA) is used by Google Assistant for topical news; reads up to 3 articles; US Google Home devices set to English.
fills: G-03, G-08 | baseline: none
surfaces: Google voice | metric: picked as snippet | grade: E1 | risk: OK
do_this: "Add Speakable only on English news articles targeting US Google Assistant; skip elsewhere."
check: "Flag Speakable markup on non-news or non-English pages as no-op."
limits: Scope unchanged since 2018; no outcome data; not documented for Gemini Live. Pass-1 source.
sources:

- Official | Google Search Central | Speakable (Article, WebPage) structured data (BETA) | https://developers.google.com/search/docs/appearance/structured-data/speakable | undated | doc text (pass 1)

#### NA-14 AI-cited pages skew fresher; AIO does not

what: AI-cited URLs 25.7% fresher by publish date, 13.1% by last update vs organic; AIO cites 16 days older; ChatGPT cites 458 days newer than organic.
fills: G-06 | baseline: replicates B-06 direction in production (correlational)
surfaces: ChatGPT search, Perplexity, Gemini app, Microsoft Copilot / Bing, AIO | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Refresh substantive content on ChatGPT/Perplexity-targeted pages; do not rely on freshness for AIO."
check: "Flag cited-target pages with last real content change >13 months."
limits: Correlational; 16.975M cited URLs; date-only changes not isolated. Pass-1 figures: average cited page 1,064 days vs 1,432 organic; 909-day figure also reported — not re-verified.
sources:

- Vendor | Ahrefs | New Study: AI Assistants Prefer to Cite "Fresher" Content (17 Million Citations Analyzed) | https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content | 2025-07-28 | 16.975M cited URLs vs organic SERP; publish and update dates (pass 1)

#### NA-15 Citation churn: judge over 7 days, not one check

what: Gone next day: AIO 50%, AI Mode 58%, ChatGPT 59%, Gemini 81%, Copilot 83%; ~75% of lost citations returned within 20 days, ≈half within 3.
fills: G-10 | baseline: replicates B-18 (independent; supports rolling aggregation)
surfaces: AIO, AI Mode, ChatGPT search, Gemini app, Microsoft Copilot / Bing | metric: cited with link; brand mentioned | grade: E3 | risk: OK
do_this: "Report AI citation as days-cited-of-last-7 per prompt; treat brand mentions as primary KPI."
check: not detectable from the site
limits: Vendor study; 20 days; no run count per precision target. Citations held 8+ days returned 96–99%. Gemini (64%) and Copilot (53%) answers cited no sources.
sources:

- Vendor | Ahrefs | How Stable Are AI Citations? 10 Things We Learned Tracking 37,500 Citations | https://ahrefs.com/blog/how-stable-are-ai-citations/ | 2026-10-29 | ~37,500 citations, 7,831 questions, 5 tools, daily for 20 days (pass 1)

#### NA-16 Churn mostly occurs after retrieval, not in fan-out

what: ChatGPT repeated identical fan-out searches 26% of the time; with identical searches, cited sites still changed 81% (vs 91%).
fills: G-05, G-10 | baseline: none
surfaces: ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "Optimize page-level answer fit, not only retrieval presence."
check: not detectable from the site
limits: Vendor study; mechanism inferred, not documented by OpenAI. Pass-1 source.
sources:

- Vendor | Ahrefs | How Stable Are AI Citations? | https://ahrefs.com/blog/how-stable-are-ai-citations/ | 2026-10-29 | same dataset as NA-15 (pass 1)

#### NA-17 OAI-SearchBot fills ChatGPT search; opt-out leaves navigational links

what: OpenAI: OAI-SearchBot surfaces sites in ChatGPT search; opted-out sites are excluded from search answers but may appear as navigational links; changes take about 24 hours.
fills: G-04, G-05 | baseline: changes B-19 (adds index bot, opt-out effect, OAI-AdsBot)
surfaces: ChatGPT search | metric: cited with link | grade: E1 | risk: OK
do_this: "Allow `OAI-SearchBot` in robots.txt and allowlist its published IPs at CDN/WAF; decide `GPTBot` separately."
check: "Flag robots.txt groups disallowing `OAI-SearchBot`; flag WAF rules blocking openai.com/searchbot.json ranges."
limits: ChatGPT-User may bypass robots.txt and does not decide Search inclusion. OpenAI help also names third-party providers such as Bing (context for B-11).
sources:

- Official | OpenAI | Overview of OpenAI Crawlers | https://developers.openai.com/api/docs/bots.md | undated (fetched 2026-11-17) | doc text; example user agents at v1.4
- Official | OpenAI Help Center | ChatGPT search | https://help.openai.com/en/articles/9237897-chatgpt-search | undated | help text

#### NA-18 Anthropic: three robots.txt-honoring bots plus Claude-Agent

what: ClaudeBot (training), Claude-SearchBot (search index) and Claude-User (user fetch) honor robots.txt; Claude-Agent marks Anthropic-hosted agent browsers, robots.txt behavior not stated.
fills: G-04 | baseline: changes B-19 (adds Claude-Agent and IP list)
surfaces: Claude | metric: cited with link | grade: E1 | risk: OK
do_this: "Allow `Claude-SearchBot` and `Claude-User` for Claude visibility; handle `Claude-Agent` by token plus IP check."
check: "Flag robots.txt disallowing `Claude-SearchBot` or `Claude-User` on public content paths."
limits: Doc says IP blocking may not opt out reliably. Claude-Agent verification file follows an IETF draft, not a standard. No outcome data.
sources:

- Official | Anthropic (Claude Help Center) | Does Anthropic crawl data from the web, and how can site owners block the crawler? | https://support.claude.com/en/articles/8896518 | undated | doc text
- Official | Anthropic (Claude Help Center) | How do Anthropic-hosted browsers identify themselves when they browse the web on a user's behalf? | https://support.claude.com/en/articles/18234133-how-do-anthropic-hosted-browsers-identify-themselves-when-they-browse-the-web-on-a-user-s-behalf | undated | doc text; UA token `Claude-Agent/1.0`

#### NA-19 Mistral: three tokens; robots.txt wording only for training

what: MistralAI-Index (search index), MistralAI-User (user fetch), MistralAI-Training (training); only the training entry says webmasters can disallow it in robots.txt.
fills: G-04 | baseline: changes B-19 (adds MistralAI-Training; honoring not stated for Index/User)
surfaces: none in §3 (Mistral assistant) | metric: cited with link | grade: E1 | risk: OK
do_this: "Add explicit robots.txt groups for all three Mistral tokens; do not assume Index or User obey Disallow."
check: "Flag robots.txt lacking explicit `MistralAI-Index`, `MistralAI-User`, `MistralAI-Training` groups when an AI-crawler policy exists."
limits: CONFLICT: page fetched 2026-11-17 names the product Vibe; search listing of the same URL says Le Chat. Pass-1 secondary honoring claims superseded.
sources:

- Official | Mistral AI | Mistral crawlers | https://docs.mistral.ai/robots | undated (fetched 2026-11-17) | doc text

#### NA-20 Google-Agent ignores robots.txt; control by IP only

what: Google-Agent, a user-triggered fetcher for Google-hosted agents, falls under fetchers that generally ignore robots.txt; IPs published in user-triggered-agents.json; Web Bot Auth experimental.
fills: G-04 | baseline: none
surfaces: none in §3 (Google-hosted agents) | metric: none measured (access only) | grade: E1 | risk: OK
do_this: "Do not rely on robots.txt for Google-Agent; use IP rules from user-triggered-agents.json if blocking is required."
check: "Flag robots.txt `Google-Agent` Disallow groups as ineffective; verify WAF handling instead."
limits: Doc updated 2026-08-19. Products using the agent are not enumerated.
sources:

- Official | Google (Crawling docs) | List of Google user-triggered fetchers | https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent | updated 2026-08-19 | doc text

#### NA-21 Perplexity: PerplexityBot for search; Perplexity-User skips robots.txt

what: PerplexityBot surfaces and links sites in Perplexity search and is not used for foundation-model training; Perplexity-User fetches on user request and generally ignores robots.txt.
fills: G-04 | baseline: replicates B-19 (official restatement; adds IP URLs, 24-hour propagation)
surfaces: Perplexity | metric: cited with link | grade: E1 | risk: OK
do_this: "Allow `PerplexityBot` in robots.txt and allowlist perplexitybot.json ranges in the WAF."
check: "Flag robots.txt disallowing `PerplexityBot`; flag WAF blocks on published PerplexityBot IP ranges."
limits: Doc does not state what a block does to result display. robots.txt changes take up to 24 hours.
sources:

- Official | Perplexity | Perplexity Crawlers | https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md | undated (fetched 2026-11-17) | doc text

#### NA-22 YouBot, Diffbot, Cohere: official robots.txt positions

what: YouBot respects robots.txt and crawl-delay (30-minute cache). Diffbot adheres by default, overridable under partnership. Cohere says it runs no training crawler at this time.
fills: G-04 | baseline: none
surfaces: none in §3 | metric: none measured (access only) | grade: E1 | risk: OK
do_this: "Use tokens `YouBot`, `Diffbot`, `Diffbot-User`; treat `cohere-ai` rules as undocumented by Cohere."
check: "Flag robots.txt groups for `cohere-ai` or `cohere-training-data-crawler` as tokens absent from Cohere's own doc."
limits: Cohere doc names only `Coherebot`, in an example. xAI and DeepSeek: no official crawler doc found; third-party token lists conflict.
sources:

- Official | You.com | YouBot: You.com's Web Crawler | https://you.com/docs/youbot | undated | doc text
- Official | Diffbot | Does Diffbot respect robots.txt? | https://www.diffbot.com/docs/crawl/faq/robots-txt | undated | doc text
- Official | Cohere | Cohere Web Crawlers | https://docs.cohere.com/docs/cohere-web-crawlers | undated | doc text

#### NA-23 Applebot feeds Siri AI answers; falls back to Googlebot rules

what: Applebot data powers Siri, Spotlight and Safari search and can supply context for AI-generated answers in Siri and Search, which may link to sources.
fills: G-08, G-04, G-05 | baseline: changes B-19 (adds Siri AI-answer path, Googlebot fallback, ranking factors)
surfaces: Siri / Apple Intelligence | metric: cited with link; facts stated correctly | grade: E1 | risk: OK
do_this: "Keep `Applebot` allowed and JS/CSS unblocked so Applebot can render; use `Applebot-Extended` only for training opt-out."
check: "Flag robots.txt blocking `Applebot`, or blocking Googlebot with no Applebot group; flag blocked JS/CSS paths."
limits: Listed ranking factors (engagement, term relevance, links, location, page design) carry no weights. No voice-answer selection data. Published 2026-09-04.
sources:

- Official | Apple Support | [article 119829, Applebot] | https://support.apple.com/en-us/119829 | 2026-09-04 | doc text (pass 1 + pass 2)

#### NA-24 Gemini grounding skips pages that disallow Google-Extended

what: Gemini API Grounding with Google Search excludes pages disallowing Google-Extended; Gemini Live API models support the same grounding and return source URIs.
fills: G-08, G-04 | baseline: replicates B-19 (independent official doc; adds Live API)
surfaces: Gemini API / Live API (developer surface) | metric: cited with link | grade: E1 | risk: OK
do_this: "Keep `Google-Extended` allowed on pages you want used for Gemini grounding."
check: "Flag robots.txt disallowing `Google-Extended` on pages targeted for Gemini answers."
limits: Developer documentation. Consumer Gemini Live and Gemini app source paths not documented in any opened source — transfer is SPECULATIVE.
sources:

- Official | Google (Firebase AI Logic) | Grounding with Google Search | https://firebase.google.com/docs/ai-logic/grounding-google-search | updated 2026-11-16 | doc text

#### NA-25 Google AI features: eligibility is indexed plus snippet-eligible

what: Google: supporting links need a page "indexed and eligible to be shown in Google Search with a snippet"; fan-out runs related searches; no selection rules.
fills: G-05 | baseline: replicates B-05 / B-19 (adds eligibility wording and fan-out description)
surfaces: AIO, AI Mode | metric: cited with link | grade: E1 | risk: OK
do_this: "Keep target pages indexable and snippet-eligible; add no AI-specific files or markup."
check: "Flag target pages that are noindex, `nosnippet`, `max-snippet:0`, or blocked for Googlebot."
limits: Doc states no extra requirements or special optimizations; AIO and AI Mode may use different models, so links vary. Freshness, mentions not addressed. Updated 2025-12-10.
sources:

- Official | Google Search Central | [AI features doc] | https://developers.google.com/search/docs/appearance/ai-features | updated 2025-12-10 | doc text

#### NA-26 OpenAI: any public site eligible; `noindex` needs crawl access

what: OpenAI: "Any public website can appear in ChatGPT search."; don't block OAI-SearchBot; `noindex` keeps a page out only if the crawler can read it.
fills: G-05 | baseline: none
surfaces: ChatGPT search | metric: cited with link | grade: E1 | risk: OK
do_this: "To exclude a page from ChatGPT search use `noindex` with OAI-SearchBot allowed; do not combine with a robots.txt block."
check: "Flag URLs that are both robots.txt-disallowed for `OAI-SearchBot` and carry `noindex`."
limits: A disallowed page found elsewhere may still show as link and title in Atlas. FAQ has no ranking factors; referrals carry `utm_source=chatgpt.com`.
sources:

- Official | OpenAI Help Center | Publishers and Developers - FAQ | https://help.openai.com/en/articles/12627856-publishers-and-developers-faq | undated ('updated 9 days ago' on 2026-11-17) | help text

#### NA-27 Bing: missing, stale or conflicting support can cause abstention

what: Bing (2026-05-06): indexed content carries unequal evidence weight; outdated facts mislead answers; "Abstention is a valid outcome when support is missing, stale, or conflicting."
fills: G-05 | baseline: changes B-04 (adds evidence weight, abstention, conflict handling)
surfaces: Microsoft Copilot / Bing | metric: cited with link; facts stated correctly | grade: E1 | risk: OK
do_this: "Keep facts current and non-contradictory across your own pages; remove or update stale duplicates."
check: "Flag same-site pages stating different values for the same fact (price, date, spec)."
limits: No tactics, signals or weights named; provenance must be verifiable. Bing 2026-02-12 post defines grounding and GEO but gives no selection method or citation rules.
sources:

- Official | Microsoft Bing Blog | Evolving role of the index: From ranking pages to supporting answers | https://blogs.bing.com/search/2026/5/Evolving-role-of-the-index-From-ranking-pages-to-supporting-answers/ | 2026-05-06 | post text
- Official | Microsoft Bing Blog (Jordi Ribas) | Elevating the Role of Grounding on the AI Web | https://blogs.bing.com/search/2026/2/Elevating-the-Role-of-Grounding-on-the-AI-Web/ | 2026-02-12 | post text

#### NA-28 Perplexity FAQ: real-time search, numbered footnotes, no criteria

what: Perplexity says it searches the web in real time, "gathering insights from top-tier sources", and footnotes each answer; it publishes no selection criteria.
fills: G-05 | baseline: none
surfaces: Perplexity | metric: cited with link | grade: E1 | risk: OK
do_this: "Treat Perplexity selection as undocumented; rely on PerplexityBot access plus general answer quality."
check: not detectable from the site
limits: FAQ is undated and names GPT-4 Omni and Claude 3 — likely stale. Quick Search uses indexed sources; index freshness not stated.
sources:

- Official | Perplexity | How does Perplexity work? | https://hub-prod.perplexity.ai/hub/faq/how-does-perplexity-work | undated | FAQ text

#### NA-29 Direct-answer openings correlate with citation

what: Cited pages open with a direct answer 20% vs 5% for passed-over top-10 pages; 44.2% of ChatGPT citations come from the first 30% of text.
fills: G-02 | baseline: none (production, correlational; B-07 and B-14 are lab)
surfaces: ChatGPT search, AIO, AI Mode | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Answer the page's main question in the first sentence under the H1 and under each H2."
check: "Flag pages where the first 100 words after H1 contain no sentence answering the title question."
limits: Correlational. Blind ratings covered 866 pages (195 pairs, main round); earlier round 23% vs 14%. Indig sample reported inconsistently (1.2M vs 3M responses).
sources:

- Study (agency; Peec AI data) | TJ Digital (TJ Robertson) | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | 193,507 answers, 4,167 questions, 78 clients, 2026-08-27 to 2026-10-21; 21,874 cited vs 4,507 passed-over top-10 pages on 434 questions; odds ratios controlling Domain Rating and page type
- News (study by Kevin Indig) | Search Engine Land | 44% of ChatGPT citations come from the first third of content: Study | https://searchengineland.com/chatgpt-citations-content-study-469483 | undated on page | 18,012 verified citations from ChatGPT responses; sentence-embedding match to source text; correlational

#### NA-30 Tables, lists, FAQ sections, visible prices: higher citation odds

what: TJ odds vs passed-over pages: table +69% (ChatGPT +88%), first-hand experience +45%, prices +28%, FAQ section +26%, list +22%, schema +13%; byline −28%, CTA −12%.
fills: G-02, G-03 | baseline: none (context for B-01: correlational, not causal)
surfaces: ChatGPT search, AIO, AI Mode | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Put comparisons in a real `<table>`, steps in `<ol>`, prices in visible text; add an on-page FAQ section where real questions exist."
check: "Flag comparison or pricing pages with zero `<table>` elements and no visible price string."
limits: Controls: Domain Rating and page type only. AirOps (ChatGPT, 217,508 retrieved pages): 3 tables +25.7%, 7–26 list sections +6–15.2%, 5–7 statistics +20.3% — also correlational.
sources:

- Study (agency; Peec AI data) | TJ Digital | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | as NA-29
- Vendor | AirOps (Oshen Davidson) | From Retrieved to Cited: How Commercial Content Earns Citations in AI Search | https://www.airops.com/report/from-retrieved-to-cited-how-commercial-content-earns-citations-in-ai-search | 2026-04-01 | 7,500 commercial queries, 217,508 retrieved pages, ChatGPT only; cited vs retrieved-not-cited; regression models; window not stated

#### NA-31 Question headings: question-tied citations come from headings

what: Indig: 78.4% of question-tied ChatGPT citations came from headings; cited text ~2× likelier to contain a question mark. TJ: question-matched openings and headings raise odds.
fills: G-02 | baseline: none
surfaces: ChatGPT search, AIO, AI Mode | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Phrase H2/H3 as the user's question where the section answers one; answer in the next sentence."
check: "Flag informational pages where under 30% of H2/H3 end with a question mark."
limits: TJ gives no odds for headings. The 30% threshold is a heuristic, SPECULATIVE. Short answer blocks (40–60 words) and key-facts blocks: no evidence found.
sources:

- News (study by Kevin Indig) | Search Engine Land | 44% of ChatGPT citations come from the first third of content: Study | https://searchengineland.com/chatgpt-citations-content-study-469483 | undated on page | as NA-29
- Study (agency; Peec AI data) | TJ Digital | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | as NA-29

#### NA-32 Live-engine measurement: influential pages are structured, evidence-rich

what: arXiv 2604.25707: 602 prompts, 21,143 citations on ChatGPT, Google AIO/Gemini, Perplexity; high-influence cited pages are longer, more structured, query-aligned, rich in definitions, numbers, comparisons, steps.
fills: G-02 | baseline: replicates B-14 direction (independent; measurement, abstract only)
surfaces: ChatGPT search, AIO, Perplexity | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Include definitions, numeric facts, comparisons and procedural steps as extractable units on answer pages."
check: "Flag answer pages with no number, no definition sentence and no list or table in main content."
limits: Abstract only; no effect sizes. Controlled prompts on live engines, not a page-level intervention.
sources:

- Study | arXiv (Zhang, He, Yao) | From Citation Selection to Citation Absorption: A Measurement Framework for Generative Engine Optimization Across AI Search Platforms | https://arxiv.org/abs/2604.25707 | 2026-04-28 | 602 prompts; 21,143 search-layer citations; 18,151 fetched pages; 72 features

#### NA-33 Freshness tracks last update, not publish date

what: Seer: 75% of cited pages updated within 1 year; 72% fresh by update date vs 42% by publish date. TJ: ≤12-month update +88% odds.
fills: G-06 | baseline: replicates B-06 direction (independent of NA-14; correlational)
surfaces: ChatGPT search, Gemini app, Perplexity, AIO, AI Mode | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Refresh existing answer pages with substantive changes at least yearly; keep visible date, `dateModified` and sitemap `lastmod` consistent."
check: "Flag target pages whose visible date, `dateModified` and sitemap `lastmod` disagree or are older than 12 months."
limits: No study isolates visible date vs `dateModified` vs `lastmod` vs real change. Seer ≤1 year by engine: Gemini 78%, ChatGPT 73%, Perplexity 65%; four brands.
sources:

- Vendor (agency) | Seer Interactive (Sonny Vasquez) | Study: Content Recency's Impact on AI Visibility in 2026 | https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026 | 2026-07-24 | 47,097 citations, 7,683 dated pages (≈two-thirds of pages), ChatGPT/Gemini/Perplexity, 2026-03 to 2026-06, four brands; dates from schema, sitemaps, headers; correlational
- Study (agency; Peec AI data) | TJ Digital | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | as NA-29

#### NA-34 Dates must reflect real publish or update; title year correlates

what: Google's byline-date doc: visible and structured dates must match and reflect the page's own publication or update. TJ: year in title, >2× citation odds.
fills: G-06, G-11 | baseline: none (B-08 not replicated; year-in-title is adjacent and correlational)
surfaces: Google Search byline dates, ChatGPT search, AIO, AI Mode | metric: cited with link | grade: E1 (doc) / E3 (TJ, correlational) | risk: GREY (date or year change without content change)
do_this: "Change dates and title years only with a real content update; never use future or event dates as page dates."
check: "Flag pages where `dateModified` changed but main-content hash did not; flag title years newer than the `dateModified` year."
limits: Opened doc has no penalty text and no 'artificially freshen' wording. Lily Ray lists artificial date refreshing among traits of sites that dropped (unproven).
sources:

- Official | Google Search Central | Influence your byline dates in Google Search | https://developers.google.com/search/docs/appearance/publication-dates | updated 2025-12-10 | doc text
- Study (agency; Peec AI data) | TJ Digital | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | as NA-29

#### NA-35 Google documents no VideoObject `transcript`; key moments via Clip/SeekToAction

what: Google's video doc lists no `transcript` property and no caption guidance; key moments come from Clip, SeekToAction or YouTube description timestamps; `nosnippet` opts out.
fills: G-07 | baseline: none
surfaces: Google Search video features | metric: picked as snippet | grade: E1 | risk: OK
do_this: "Publish the transcript as visible page text; add `Clip` or `SeekToAction` for key moments; do not rely on VideoObject `transcript`."
check: "Flag pages with VideoObject markup but no visible transcript text block of at least 150 words."
limits: Doc does not mention AIO or AI Mode. No controlled on-page transcript test found. The 150-word threshold is a heuristic, SPECULATIVE. Updated 2026-09-24.
sources:

- Official | Google Search Central | Video (VideoObject, Clip, BroadcastEvent) structured data | https://developers.google.com/search/docs/appearance/structured-data/video | updated 2026-09-24 | doc text; required: name, thumbnailUrl, uploadDate

#### NA-36 YouTube dominates video citations; timestamps only on Google surfaces

what: Otterly (100M+ citations, 30 days): YouTube 31.8% of social-media citations, Vimeo 0.1%; 94% long-form; timestamped citations only in AIO (73%) and AI Mode (27%).
fills: G-07 | baseline: none
surfaces: Perplexity, AIO, AI Mode, ChatGPT search, Microsoft Copilot / Bing, Gemini app | metric: cited with link | grade: E3 (correlational) | risk: OK
do_this: "Embed the YouTube-hosted version on the answer page and put the transcript in visible text."
check: "Flag answer pages embedding self-hosted or Vimeo video with no YouTube version linked."
limits: Share of YouTube citations: Perplexity 38.7%, AIO 36.6%, AI Mode 19.6%, ChatGPT 4.4%, Copilot 0.5%, Gemini 0.2%. Transcript share not measured; self-hosted not compared.
sources:

- Vendor | OtterlyAI (Rick Tousseyn) | The YouTube Citation Study 2026 | https://otterly.ai/blog/youtube-ai-citation-study-2026/ | 2026-03-02 | 100M+ AI citations, 30 days, six platforms; only already-cited YouTube videos; Pearson r; correlational
- Study (agency; Peec AI data) | TJ Digital | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | YouTube share as reported: AIO 23%, AI Mode 9%, ChatGPT about none

#### NA-37 Featured snippets displaced as AIO expanded

what: Ahrefs, 1M US desktop SERPs: featured snippets 15.41% (Jan 2025) to 5.53% (Jun 2025); AIO 3.93% to 27.43%; correlation −0.9053.
fills: G-09 | baseline: none
surfaces: Google featured snippets, AIO | metric: picked as snippet | grade: E3 (correlational) | risk: OK
do_this: "Keep snippet-ready answer blocks, but check featured-snippet and AIO presence per query before prioritizing snippet work."
check: not detectable from the site
limits: US desktop only; correlation, not causation; co-occurrence rate not reported. No controlled or before/after snippet-selection test since 2025 found.
sources:

- Vendor | Ahrefs (Ryan Law, Xibeijia Guan) | Goodbye, Featured Snippets: How SERP Features Have Evolved in the AI Era | https://ahrefs.com/blog/how-serp-features-have-evolved-in-the-ai-era | 2025-07-22 | 1,000,000 random SERPs, US desktop, Jan vs Jun 2025; 'question' feature 73.73% to 79.13%

#### NA-38 PAA answers are now mostly AI-generated

what: AlsoAsked (19.2M English queries, 2026): PAA answers AI-generated 86% in Aug 2026, 97% in first week of Sep 2026; 12.6% in Jul 2025.
fills: G-09 | baseline: none
surfaces: PAA, AIO | metric: picked as snippet; cited with link | grade: E3 | risk: OK
do_this: "Treat PAA as an AIO citation surface: target PAA questions with indexable, snippet-eligible pages."
check: "Flag PAA-target pages carrying `nosnippet` or `max-snippet:0`."
limits: Allintitle reports 100% from Aug 2026 (no n), conflicting with 86%. PAA box still present on 91.9% of 69,817 SERPs (cloro).
sources:

- News | Search Engine Roundtable | Almost 100% Of People Also Ask Results Are Answered By Google AI Overviews | https://seroundtable.com/ppa-ai-overviews-google-42047.html | 2026-09-09 | AlsoAsked sample 19.2M English queries (Mark Williams-Cook); Allintitle Also Ask Miner, no n
- News | Search Engine Roundtable | Report: Over 12% Of People Also Ask Results Are Google AI Overviews | https://www.seroundtable.com/people-also-ask-results-are-google-ai-overviews-39702.html | 2025-07-03 | AlsoAsked 12.6%, no n; "Historically the people also ask were featured snippets."

#### NA-39 AIO presence differs by market and drifts over time

what: cloro (69,817 SERPs, 41 markets): AIO on 79.2% pooled, US 85.4%; US fixed cohort fell from 96.7% (Apr) to 86.9% (Sep 2026).
fills: G-09 | baseline: none
surfaces: AIO, PAA | metric: picked as snippet | grade: E3 | risk: OK
do_this: "Measure AIO and PAA presence on your own query set per market; do not reuse a global prevalence figure."
check: not detectable from the site
limits: Corpus over-represents conversational and commercial-research queries; market rows confounded with query mix; featured-snippet presence not reported.
sources:

- Vendor | cloro | [SERP feature census] | https://cloro.dev/research/serp-feature-census/ | 2026-07-05, updated 2026-10-13 | 69,817 scored Google SERPs, 41 markets, 30 days to 2026-10-07; binary feature presence

#### NA-40 Brand lists rarely repeat; presence rate needs many runs

what: SparkToro/Gumshoe: 2,961 runs, 12 prompts; same brand list <1 in 100, same order ~1 in 1,000; authors suggest "usually at least 60-100X" runs per prompt.
fills: G-10 | baseline: conflicts with B-12 (higher run count; heuristic, not computed) — not reconciled
surfaces: ChatGPT search, Claude, AIO, AI Mode | metric: brand mentioned | grade: E3 | risk: OK
do_this: "Report brand presence rate over many runs per prompt; never report an AI 'rank position'."
check: not detectable from the site
limits: Run count not statistically derived. Binomial worst case (computed here, not sourced): ±10 points at 95% needs ~97 runs; ±15 ~43; ±20 ~25.
sources:

- Study (with vendor co-author) | SparkToro (Rand Fishkin) × Gumshoe.ai (Patrick O'Donnell) | [AI recommendation consistency research] | https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/ | 2026-01-27 | 600 volunteers, 12 prompts, 2,961 responses, ChatGPT/Claude/Google AI, Nov–Dec 2025; uncontrolled settings

#### NA-41 Source-set repeat rates are low at every horizon

what: TJ: cited pages recur same-day 23–25%, next week 24–28%, after seven weeks 11–16%; 2–3% in three of four weekly checks. Profound: monthly domain drift 40.5–59.3%.
fills: G-10 | baseline: replicates B-18 (independent; low source-set stability)
surfaces: ChatGPT search, AIO, AI Mode, Microsoft Copilot / Bing, Perplexity | metric: cited with link | grade: E3 | risk: OK
do_this: "Measure source coverage as share of runs citing the domain over a rolling 2–4 weeks, not single-run URL presence."
check: not detectable from the site
limits: No run count per precision target. BrightEdge reports 96.8% of cited domains unchanged week to week (sample undisclosed; domain share metric); differs by metric level.
sources:

- Study (agency; Peec AI data) | TJ Digital | 2026 AI Citation Study: What ChatGPT and Google's AI Cite | https://tjrobertson.com/ai-citation-study/ | 2026-10-25 | 8 weekly snapshots plus next-day repeats
- Vendor | Profound (Josh Blyskal, Sartaj Rajpal) | AI Search Volatility: Why AI search results keep changing | https://www.tryprofound.com/blog/ai-search-volatility | 2025-07-17 | ~80,000 prompts per platform; 2025-06-11/13 vs 2025-07-11/13; share of July domains absent in June: AIO 59.3%, ChatGPT 54.1%, Copilot 53.4%, Perplexity 40.5%
- Vendor | BrightEdge | [AI search citations week-to-week changes] | https://www.brightedge.com/resources/weekly-ai-search-insights/ai-search-citations-week-to-week-changes | 2026-02-06 | 'thousands of prompts', nine industries, one week; n undisclosed — E4, not counted toward closure

#### NA-42 Anthropic policy bans seeding deceptive answer sources with Claude

what: Anthropic Usage Policy (effective 2026-11-12) prohibits using Claude to seed sources search engines or AI systems draw on with content misrepresenting origin, authorship or independence.
fills: G-11 | baseline: none
surfaces: Claude | metric: brand mentioned | grade: E1 | risk: VIOLATES (https://www.anthropic.com/legal/aup) when the content is produced with Claude
do_this: "Do not use Claude to build networks of pseudo-independent pages, fake reviews or personas corroborating your own claims."
check: "Flag owned sites or subdomains presenting as unaffiliated third parties while endorsing the brand."
limits: Governs Claude users, not site owners generally; silent on how Claude search treats such sites. Its prompt-injection clause covers product guardrails only.
sources:

- Official | Anthropic | [Usage Policy] | https://www.anthropic.com/legal/aup | effective 2026-11-12 | policy text
- News | Search Engine Journal | Claude's New Rules Target Fake Sources Built To Sway AI Answers | https://www.searchenginejournal.com/claude-rules-fake-sources-ai-answers/592456/ | 2026-10-09 | policy announced 2026-10-08

#### NA-43 Microsoft mitigates 'Summarize with AI' memory poisoning in Copilot

what: Microsoft (2026-02-10): 50+ prompts from 31 companies in 14 industries over 60 days used prefilled AI links to plant memory instructions; Copilot mitigations deployed.
fills: G-11 | baseline: changes B-15 (primary source: adds mitigations, targeted assistants, MITRE IDs)
surfaces: Microsoft Copilot / Bing, ChatGPT search, Claude, Perplexity, Grok | metric: brand mentioned | grade: E1 | risk: GREY (no policy named by Microsoft; Bing guidelines treat prompt injection as abuse, NA-06)
do_this: "Remove prefilled AI share links that carry instructions to remember, trust or recommend the brand."
check: "Flag links to copilot.microsoft.com/?q=, chatgpt.com/?q=, claude.ai/new?q=, perplexity.ai/search?q=, grok.com/?q= whose query contains 'remember', 'trust' or 'recommend'."
limits: No action against the companies described. MITRE ATLAS AML.T0080 and AML.T0051. Mitigations: prompt filtering, content separation, memory controls, monitoring.
sources:

- Official | Microsoft Security Blog (Defender Security Research Team) | [AI Recommendation Poisoning] | https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/ | 2026-02-10 | AI-related URLs in email traffic, 60 days

#### NA-44 Self-promotional listicles: ≈11% of listicle citations; Google drops observed

what: Peec (232,000 citations): self-promotional listicles ≈11% of sampled listicle citations; ChatGPT 3.6%, AI Mode 10.3%, Perplexity 10.4%. Lily Ray: listicle-heavy sites lost 29–49% Google visibility.
fills: G-11 | baseline: none (independent of B-13; different metric)
surfaces: ChatGPT search, AI Mode, Perplexity, Google Search organic | metric: cited with link; clicks | grade: E3 | risk: GREY
do_this: "Do not scale 'best X' pages ranking your own product first; if kept, disclose selection criteria."
check: "Flag sites with more than 10 URLs whose title contains 'best' and whose first list item is the own brand."
limits: Peec: no correction Dec 2025–Feb 2026; software niche. Google drops unconfirmed, six of seven sites quantified, non-random; threshold 10 is the smallest affected case, SPECULATIVE.
sources:

- Vendor | Peec AI (Tom Wells) | Self-promotional listicles analysis: Data from 232,000 citations | https://peec.ai/blog/self-promotional-listicles-analysis-from-232k-citations | 2026-03-03 | 232,000 citations, 13,000 listicles, six platforms, 12 weeks (2025-CW49 to 2026-CW08); top 1,000 listicles per platform per week
- Practitioner | Lily Ray (Substack) | Is Google Finally Cracking Down on Self-Promotional Listicles? | https://lilyraynyc.substack.com/p/is-google-finally-cracking-down-on | 2026-02-03 | seven SaaS/B2B sites, Sistrix US visibility, drops from ~2026-01-19; listicle counts 10 to 340 per site

#### NA-45 Markup of non-visible content breaks Google structured-data guidelines

what: Google structured-data guidelines bar markup of content not visible to readers and misleading or fake-review markup; a manual action removes rich-result eligibility, not web ranking.
fills: G-11, G-03 | baseline: none
surfaces: Google Search rich results | metric: picked as snippet | grade: E1 | risk: VIOLATES (https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
do_this: "Mark up only Q&A that is visible on the page; delete FAQPage blocks whose questions are not rendered."
check: "Flag FAQPage `name` or `acceptedAnswer` strings not found in rendered visible text."
limits: Covers rich-result eligibility; no statement on AIO or AI Mode use. FAQ rich results already retired (B-19). Updated 2026-07-10.
sources:

- Official | Google Search Central | General structured data guidelines | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | updated 2026-07-10 | policy text

#### NA-46 Site-wide schema rollout: mixed coverage shifts, no attributable lift

what: Otterly added FAQ, Organization, SoftwareApplication, Review, Article schema site-wide: brand coverage ChatGPT −71%, Copilot −64%, Gemini −35%, Perplexity 0%, AI Mode +42%, AIO +611%.
fills: G-03 | baseline: replicates B-01 (independent; no attributable lift)
surfaces: ChatGPT search, Microsoft Copilot / Bing, Gemini app, Perplexity, AI Mode, AIO | metric: brand mentioned | grade: E3 | risk: OK
do_this: "Do not forecast AI citation or mention lift from adding schema types."
check: not detectable from the site
limits: One site, 319 US prompts, three months, before/after with unnamed competitor comparison; types not isolated; shifts attributed to algorithm changes; internal conflict (+611% vs +1,500%).
sources:

- Vendor | OtterlyAI (Rick Tousseyn) | GEO Experiment: Does Schema Markup Really Impact AI Search? | https://otterly.ai/blog/schema-markup-real-impact-ai-search/ | 2026-03-23 | schema live 2025-12-07; tracked 2025-11-01 to 2026-03; HowTo and Product not tested

## Platform policy by tactic

| Tactic                                    | Platform                                  | Policy or enforcement (quote ≤15 words)                                                                                                             | Date                 | Risk                             | URL                                                                                   |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Hidden on-page text instructing LLMs      | Google                                    | Spam definition covers manipulating "generative AI responses in Google Search"; hidden-text section names no AI                                     | updated 2026-08-28   | VIOLATES                         | https://developers.google.com/search/docs/essentials/spam-policies                    |
| Hidden on-page text instructing LLMs      | Bing                                      | Prompt injection / AI manipulation abuse section; may reduce visibility or cause removal (paraphrase; wording unverified, JS-only page)             | 2026-02              | VIOLATES                         | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a                    |
| Hidden on-page text instructing LLMs      | OpenAI                                    | No site-owner manipulation text in Publishers FAQ or crawler doc (both opened)                                                                      | checked 2026-11-17   | GREY                             | https://help.openai.com/en/articles/12627856-publishers-and-developers-faq            |
| Hidden on-page text instructing LLMs      | Perplexity                                | No source quality or spam guidelines in crawler doc or FAQ (both opened)                                                                            | checked 2026-11-17   | GREY                             | https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md                      |
| Hidden on-page text instructing LLMs      | Anthropic                                 | Usage Policy bars prompt injection against product guardrails by Claude users; no site-owner rule (paraphrase)                                      | effective 2026-11-12 | GREY                             | https://www.anthropic.com/legal/aup                                                   |
| AI-only cloaking                          | Google                                    | Cloaking section names search-engine user agents only; AI crawlers not named; covered by general cloaking rule — INFERENCE                          | updated 2026-08-28   | VIOLATES (inferred)              | https://developers.google.com/search/docs/essentials/spam-policies                    |
| AI-only cloaking                          | Bing                                      | No AI-specific cloaking text opened                                                                                                                 | —                    | VIOLATES (inferred, SPECULATIVE) | —                                                                                     |
| AI-only cloaking                          | OpenAI / Perplexity / Anthropic           | No policy text found                                                                                                                                | —                    | GREY                             | —                                                                                     |
| Fake FAQs / markup of non-visible content | Google                                    | "Don't mark up content that is not visible to readers of the page." Manual action removes rich-result eligibility                                   | updated 2026-07-10   | VIOLATES                         | https://developers.google.com/search/docs/appearance/structured-data/sd-policies      |
| Fake FAQs                                 | Bing / OpenAI / Perplexity / Anthropic    | No specific policy found                                                                                                                            | —                    | GREY                             | —                                                                                     |
| Self-serving 'best' lists                 | Google                                    | AI optimization guide: inauthentic mentions help less than they seem (paraphrase, pass 1); no named policy                                          | 2026-05-15           | GREY                             | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide          |
| Self-serving 'best' lists                 | Google (observed)                         | Seven SaaS/B2B sites; six lost 29–49% Sistrix visibility from ~2026-01-19; no confirmed action                                                      | 2026-02-03           | GREY                             | https://lilyraynyc.substack.com/p/is-google-finally-cracking-down-on                  |
| Self-serving 'best' lists                 | Google AIO (observed)                     | AIO cite 38% fewer; brand omitted 83% (practitioner data)                                                                                           | 2026-10-04           | GREY                             | https://lilyraynyc.substack.com/p/prediction-the-next-massive-google                  |
| Self-serving 'best' lists                 | ChatGPT / AI Mode / Perplexity (observed) | ≈11% of sampled listicle citations self-promotional; no correction over 12 weeks                                                                    | 2026-03-03           | GREY                             | https://peec.ai/blog/self-promotional-listicles-analysis-from-232k-citations          |
| Fake independent sources / networks       | Anthropic                                 | Prohibited use of Claude: "Manipulate the sources from which search engines or AI systems draw answers"                                             | effective 2026-11-12 | VIOLATES (Claude users)          | https://www.anthropic.com/legal/aup                                                   |
| Date-only freshness bumps                 | Google                                    | "The dates must describe the publication or update date of the page"; no penalty text on page                                                       | updated 2025-12-10   | GREY                             | https://developers.google.com/search/docs/appearance/publication-dates                |
| Date-only freshness bumps                 | Bing / OpenAI / Perplexity / Anthropic    | No policy text found                                                                                                                                | —                    | GREY                             | —                                                                                     |
| Scaled Q&A / fan-out pages                | Google                                    | Separate pages per query variation built mainly to manipulate AI responses = scaled content abuse (paraphrase, pass 1)                              | 2026-05-15           | VIOLATES                         | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide          |
| Scaled Q&A / fan-out pages                | Google                                    | Scaled-content section: generative AI tools used to produce many pages without user value (paraphrase)                                              | updated 2026-08-28   | VIOLATES                         | https://developers.google.com/search/docs/essentials/spam-policies                    |
| Scaled Q&A / fan-out pages                | Bing / OpenAI / Perplexity / Anthropic    | No policy text found                                                                                                                                | —                    | GREY                             | —                                                                                     |
| Prompt-injection share links              | Microsoft (Copilot)                       | Microsoft "has implemented and continues to deploy mitigations"; prompt filtering, content separation, memory controls; no action against companies | 2026-02-10           | GREY                             | https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/ |
| Prompt-injection share links              | Bing                                      | Prompt injection / AI manipulation abuse section (paraphrase; wording unverified)                                                                   | 2026-02              | VIOLATES                         | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a                    |
| Prompt-injection share links              | Google                                    | Covered by AI-manipulation spam definition (not named) — INFERENCE                                                                                  | updated 2026-08-28   | VIOLATES (inferred)              | https://developers.google.com/search/docs/essentials/spam-policies                    |
| Prompt-injection share links              | OpenAI / Perplexity / Anthropic           | No site-owner policy found                                                                                                                          | —                    | GREY                             | —                                                                                     |

## Token matrix additions

| Platform   | Token                                                                                               | Class (search / training / user / agent)                              | robots.txt honored (quote)                                                                                                                                                                                                                                   | IP list URL                                                                                        | Doc URL + date                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI     | OAI-SearchBot                                                                                       | search (fills ChatGPT search)                                         | Honored; opt-out removes site from search answers, navigational links may remain; ~24 h to apply (paraphrase)                                                                                                                                                | https://openai.com/searchbot.json                                                                  | https://developers.openai.com/api/docs/bots.md (undated; fetched 2026-11-17)                                                                               |
| OpenAI     | GPTBot                                                                                              | training                                                              | Disallow signals content should not be used for training (paraphrase)                                                                                                                                                                                        | https://openai.com/gptbot.json                                                                     | same                                                                                                                                                       |
| OpenAI     | ChatGPT-User                                                                                        | user                                                                  | "robots.txt rules may not apply"                                                                                                                                                                                                                             | https://openai.com/chatgpt-user.json                                                               | same                                                                                                                                                       |
| OpenAI     | OAI-AdsBot                                                                                          | other (ad landing-page checks)                                        | No robots.txt guidance given                                                                                                                                                                                                                                 | https://openai.com/adsbot.json                                                                     | same                                                                                                                                                       |
| Anthropic  | ClaudeBot                                                                                           | training                                                              | Honors robots.txt incl. Crawl-delay (paraphrase)                                                                                                                                                                                                             | https://claude.com/crawling/bots.json                                                              | https://support.claude.com/en/articles/8896518 (undated)                                                                                                   |
| Anthropic  | Claude-SearchBot                                                                                    | search                                                                | Honors robots.txt; disabling may reduce visibility and accuracy in search results (paraphrase)                                                                                                                                                               | same                                                                                               | same                                                                                                                                                       |
| Anthropic  | Claude-User                                                                                         | user                                                                  | Honors robots.txt; disabling prevents retrieval for user queries (paraphrase)                                                                                                                                                                                | same                                                                                               | same                                                                                                                                                       |
| Anthropic  | Claude-Agent                                                                                        | agent                                                                 | Not stated; allow or block by `Claude-Agent` token; verify IP                                                                                                                                                                                                | claude.com/.well-known/sail                                                                        | https://support.claude.com/en/articles/18234133-how-do-anthropic-hosted-browsers-identify-themselves-when-they-browse-the-web-on-a-user-s-behalf (undated) |
| Mistral    | MistralAI-Index                                                                                     | search                                                                | Not stated on page                                                                                                                                                                                                                                           | https://mistral.ai/mistralai-index-ips.json                                                        | https://docs.mistral.ai/robots (undated; fetched 2026-11-17)                                                                                               |
| Mistral    | MistralAI-User                                                                                      | user                                                                  | Not stated on page                                                                                                                                                                                                                                           | https://mistral.ai/mistralai-user-ips.json                                                         | same                                                                                                                                                       |
| Mistral    | MistralAI-Training                                                                                  | training                                                              | "Webmasters can disallow this user agent in their robots.txt file."                                                                                                                                                                                          | none published                                                                                     | same                                                                                                                                                       |
| Perplexity | PerplexityBot                                                                                       | search                                                                | Doc recommends allowing it; changes take up to 24 h (paraphrase)                                                                                                                                                                                             | https://www.perplexity.com/perplexitybot.json                                                      | https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md (undated)                                                                                 |
| Perplexity | Perplexity-User                                                                                     | user                                                                  | "generally ignores robots.txt rules"                                                                                                                                                                                                                         | https://www.perplexity.com/perplexity-user.json                                                    | same                                                                                                                                                       |
| Google     | Google-Agent                                                                                        | agent (user-triggered fetcher)                                        | "these fetchers generally ignore robots.txt rules"                                                                                                                                                                                                           | user-triggered-agents.json (file name per doc)                                                     | https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent (2026-08-19)                                                                    |
| Google     | Google-Extended                                                                                     | training + grounding control token                                    | Grounding "does not use web pages for grounding that have disallowed Google-Extended"                                                                                                                                                                        | —                                                                                                  | https://firebase.google.com/docs/ai-logic/grounding-google-search (2026-11-16)                                                                             |
| You.com    | YouBot                                                                                              | search                                                                | "YouBot fully respects robots.txt directives"; crawl-delay honored; robots.txt cached 30 min                                                                                                                                                                 | 68.67.112.0/24; Web Bot Auth keys at https://you.com/.well-known/http-message-signatures-directory | https://you.com/docs/youbot (undated)                                                                                                                      |
| Diffbot    | Diffbot                                                                                             | search (Knowledge Graph and web search; doc says not for AI training) | "By default Diffbot's web crawls adhere to a site's robots.txt instructions."; overridable under partnership                                                                                                                                                 | none                                                                                               | https://www.diffbot.com/docs/crawl/faq/robots-txt (undated)                                                                                                |
| Diffbot    | Diffbot-User                                                                                        | user                                                                  | Not separately stated                                                                                                                                                                                                                                        | none                                                                                               | same                                                                                                                                                       |
| Cohere     | none active (`Coherebot` appears only in an example)                                                | training (hypothetical)                                               | Policy is to "require that crawlers be designed to respect `robots.txt`"; no training crawl at this time                                                                                                                                                     | none                                                                                               | https://docs.cohere.com/docs/cohere-web-crawlers (undated)                                                                                                 |
| Meta       | meta-webindexer                                                                                     | search                                                                | Allowing it supports citing and linking in Meta AI (paraphrase; quote in NA-09)                                                                                                                                                                              | —                                                                                                  | https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers (fetched 2026-11-17, pass 1)                                                 |
| Meta       | meta-externalagent                                                                                  | training                                                              | Blockable via robots.txt disallow (paraphrase)                                                                                                                                                                                                               | —                                                                                                  | same                                                                                                                                                       |
| Meta       | meta-externalfetcher                                                                                | user / agent                                                          | May bypass robots.txt (paraphrase)                                                                                                                                                                                                                           | —                                                                                                  | same                                                                                                                                                       |
| Meta       | meta-externalads                                                                                    | other (ads)                                                           | Disallow example given in doc                                                                                                                                                                                                                                | —                                                                                                  | same                                                                                                                                                       |
| Meta       | facebookexternalhit                                                                                 | other (link preview)                                                  | May bypass robots.txt for security or integrity checks (paraphrase)                                                                                                                                                                                          | —                                                                                                  | same                                                                                                                                                       |
| Apple      | Applebot                                                                                            | search (Siri, Spotlight, Safari; AI answers in Siri and Search)       | Follows robots.txt; uses Googlebot rules if no Applebot group; ignores crawl-delay (paraphrase)                                                                                                                                                              | http://search.developer.apple.com/applebot.json                                                    | https://support.apple.com/en-us/119829 (2026-09-04)                                                                                                        |
| Apple      | Applebot-Extended                                                                                   | training control token (does not crawl)                               | Disallow opts out of training; no effect on search inclusion or ranking (paraphrase)                                                                                                                                                                         | —                                                                                                  | same                                                                                                                                                       |
| Amazon     | Amzn-SearchBot                                                                                      | search (Alexa)                                                        | Follows rules given to other search bots if unnamed (paraphrase; quote in NA-10)                                                                                                                                                                             | listed on doc page (secondary, pass 1)                                                             | https://developer.amazon.com/amazonbot (undated, pass 1)                                                                                                   |
| Microsoft  | `__usage_ai-training` (robots.txt user-agent); `ai-training:disallow` (Bingbot meta / X-Robots-Tag) | training                                                              | robots.txt per site or path, or page-level; page-level overrides robots.txt; Allow does not override a Bingbot crawl block                                                                                                                                   | —                                                                                                  | https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/ (2026-10-30)                                |
| Microsoft  | `ai-grounding:` allow / disallowextended / disallow (Bingbot meta / X-Robots-Tag)                   | search (grounding)                                                    | Page-level only; no robots.txt form; once new preferences are detected, remaining NoArchive/NoCache on that site are ignored; pages without a temporary preference default to allow after 2027-03-01 until recrawled; Bing search syndication API unaffected | —                                                                                                  | same                                                                                                                                                       |
| xAI        | none published                                                                                      | —                                                                     | No official crawler doc found (pass 1 and pass 2; secondary sources only)                                                                                                                                                                                    | none                                                                                               | —                                                                                                                                                          |
| DeepSeek   | none published                                                                                      | —                                                                     | No official crawler doc found                                                                                                                                                                                                                                | none                                                                                               | —                                                                                                                                                          |

## Off-site (parked)

| Finding (≤20 words)                                                                                            | Surface                      | Grade | Source URL                                                           |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----- | -------------------------------------------------------------------- |
| Paid listicle placements with followed links violate Google link spam policy per practitioner analysis         | AIO, AI Mode                 | E4    | https://lilyraynyc.substack.com/p/prediction-the-next-massive-google |
| YouTube description length correlates with citation frequency (r=0.31); views and subscribers do not (r≈−0.03) | Perplexity, AIO, AI Mode     | E3    | https://otterly.ai/blog/youtube-ai-citation-study-2026/              |
| Reddit 46.4% and YouTube 31.8% of social-media citations; social and video are 5.54% of all citations          | six AI engines               | E3    | https://otterly.ai/blog/youtube-ai-citation-study-2026/              |
| Among Google top-10 pages, higher Domain Rating went with more citations in every engine                       | ChatGPT search, AIO, AI Mode | E3    | https://tjrobertson.com/ai-citation-study/                           |
| Reddit share of citations: AIO 16%, AI Mode 7%, ChatGPT 1%                                                     | AIO, AI Mode, ChatGPT search | E3    | https://tjrobertson.com/ai-citation-study/                           |

## Gaps

- searches with no result: controlled production test of answer-first / question headings / short answer blocks / key-facts blocks; featured-snippet selection test (controlled or before/after) since 2025; OpenAI or Perplexity site-owner manipulation policy; xAI official crawler doc; DeepSeek official crawler doc; consumer Gemini Live source-path documentation; controlled on-page transcript test; caption/transcript statement for AIO, ChatGPT, Perplexity, Copilot; JSON-LD statement from OpenAI, Perplexity, Anthropic, Apple, Amazon; independent replication of B-08 (date-only bump); study isolating visible date vs `dateModified` vs `lastmod`; type-isolated schema citation test; `nosnippet` / `max-snippet` behavior in engines other than Google and Bing
- inaccessible sources: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a — JavaScript-only in both passes (NA-06, NA-11 wording unverified); https://dailycoloradonews.com/ai-search-optimization-five-assumptions-checked-primary-sources-daily_colorado/ — site blocked (primary behind the ground.news lead); GEO paper Section 6 — only abstract opened (https://arxiv.org/abs/2311.09735), abstract has no deployed-engine numbers; Growth Memo original post (Indig) — not opened, cited via Search Engine Land; Google 2019 blog on byline dates ('artificially freshen' wording) — not opened; OpenAI Usage Policies — not opened
- opened, excluded under §5 (figures kept here for zero loss, not used as evidence):
  - https://www.searchpilot.com/resources/case-studies/top-brands-faqs — 2022-10-05, pre-2025; controlled split test, FAQ question added to category pages, organic sessions +9%; no AI metric
  - https://patrickstox.com/technical-seo/on-page/meta-tags/max-snippet-max-image-preview/ — page labeled AI-generated; gives no minimum `max-snippet` value; references a Glenn Gabe `nosnippet` test without figures
  - https://www.airops.com/report/the-2026-state-of-ai-search — 2025-12-02; no sample or method; claims: 30% of brands visible across back-to-back answers, 20% across five runs; pages not updated for 3+ months over 3× likelier to lose citations; sequential headings 2.8×; 61% of cited pages use 3+ schema types (13% higher likelihood); FAQ schema on 10.5% of cited pages; ~60% of AIO citations outside top 20
  - https://brightedge.com/resources/weekly-ai-search-insights/youtube-presence-ai-search — 2025-09-25; sample undisclosed; YouTube citation share AIO 29.5%, AI Mode 16.6%, Perplexity 9.7%, ChatGPT 0.2%; Vimeo 0.1%, TikTok 0.1%
  - https://ahrefs.com/blog/on-page-aeo/ — 2026-05-08; compiles third-party correlational figures; no original test
  - https://ahrefs.com/blog/fresh-content/ — 2025-12-22; restates the NA-14 study; no date-only test
  - https://www.iloveseo.net/the-ahrefs-schema-study-is-right-and-its-testing-the-wrong-thing/ — 2026-05-11; commentary on B-01 (1,885 treated vs 4,000 control pages); no new data
  - https://ground.news/article/the-paper-everyone-cites-for-ai-search-tested-its-own-advice-on-a-real-engine-the-tactic-lost-three-quarters-of-its-effect — aggregator summary: GEO paper's deployed-engine gain for adding statistics 8.7% vs 30–40% headline; engine and n not stated; primary not opened — UNVERIFIED, and the paper is pre-2025 and not independent
  - https://ipullrank.com/claude-geo-guidelines — practitioner comparison; used only as pointer: OpenAI guidance has nothing on seeding sources; Perplexity has no published source quality guidelines
  - https://support.google.com/gemininotebook/answer/16215270 — Gemini Notebook (not a §3 surface): imports only the caption transcript of public YouTube videos with captions
- conflicts flagged inline: NA-12 (JSON-LD-only facts read vs not read); NA-19 (Mistral product name Vibe vs Le Chat); NA-38 (Allintitle 100% vs AlsoAsked 86% for Aug 2026); NA-40 vs B-12 (run counts); NA-41 (BrightEdge weekly stability vs URL-level churn); NA-46 (Otterly +611% vs +1,500%); NA-29 (Indig sample 1.2M vs 3M responses); NA-14 (average cited age 1,064 vs 909 days, pass 1); OpenAI ranking sentence quoted by secondary sources from the ChatGPT search help page was not present in the page as fetched
- changes vs pass 1: G-01 PARTIAL→CLOSED (Bing blog opened); G-02 OPEN→PARTIAL; G-05 PARTIAL→CLOSED; G-06 PARTIAL→CLOSED; G-07 OPEN→PARTIAL; G-08 PARTIAL→CLOSED; G-09 OPEN→CLOSED; G-03, G-04, G-10, G-11 remain PARTIAL with added evidence; NA-04, NA-08, NA-11, NA-12 amended; NA-17 to NA-46 new; token rows for OpenAI, Mistral, Google-Agent moved from secondary to official docs; pass-1 Mistral 'reported as honored' claim superseded by 'not stated on page'
- quote handling: this file keeps at most one verbatim quote per source; other pass-1 quotes were converted to paraphrase (marked) — verbatim spans remain in the pass-1 report
- skipped: Run B scope (G-12–G-22, open discovery); leads seen only in search listings and not opened — Semrush 2025-12 PAA/AIO co-occurrence (90.03%), ppc.land 2026-08-24 listicle study (5.32M rows), Stackfox Grok traffic test, CXL 100 AIO citations (55% from top 30%), Glenn Gabe `nosnippet` AIO test; Anthropic crawler doc mentions recognizing an AI training preference signal from 2026-10-30 — detail not extracted (lead for Run B)
- assumption: pass-1 sources not re-opened in pass 2 are carried forward and marked '(pass 1)'
- assumption: G-05 and G-08 counted CLOSED on 'official doc quoted' even though the docs disclose eligibility and source paths only, not selection rules
- assumption: G-06 counted CLOSED on '≥2 independent studies'; signal isolation and B-08 replication remain open and are listed above
- assumption: TJ Digital classed as Study (agency author, disclosed method, client data via Peec AI); conflict of interest noted
- assumption: thresholds in NA-02 (300), NA-31 (30%), NA-35 (150 words), NA-44 (10 URLs) are heuristics, not documented values
