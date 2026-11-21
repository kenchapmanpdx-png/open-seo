<!-- Part 2 of 2 (Findings NB-24–NB-46 + Off-site + Gaps). Continues from part 1. -->

#### NB-24 Brand answers: 2.8% wrong, 31.2% no answer

what: 1,562 branded prompts, six surfaces: 66.0% accurate, 2.8% inaccurate, 31.2% no answer; comparative prompts 80.3% no answer; own site over 35% of citations.
fills: G-13 | baseline: none
surfaces: AI Mode, AIO, ChatGPT search, Claude, Gemini app, Perplexity | metric: facts stated correctly | grade: E3 | risk: OK
do_this: "State services offered and not offered, locations and comparisons explicitly on owned pages; non-answers outnumber wrong answers 11 to 1."
check: "Each tracked brand attribute has one explicit sentence on an indexable owned page."
limits: One brand (the vendor itself); no on-site fix tested; accuracy judged by the vendor.
sources:

- Vendor | Seer Interactive | Study: AI Declined to Answer Prompts About Our Brand 31% of the Time (But Got Our Info Mostly Right When It Answered) | https://www.seerinteractive.com/insights/ai-brand-accuracy-study | 2026-08-27 | 1,562 prompts, 28,123 responses, 87 attributes, 2026-05-01 to 2026-06-09, daily; inaccurate: AIO 5.7%, Gemini 4.3%, Perplexity 3.3%, AI Mode 1.7%, ChatGPT 1.3%, Claude 1.1%; Claude no-answer 46.3%

#### NB-25 AIO citations from Google top 10 halved

what: AIO-cited URLs ranking in Google's top 10 fell from 76.1% (July 2025) to 37.9% (March 2026); 31.0% rank beyond the top 100.
fills: G-14 | baseline: none
surfaces: AIO | metric: cited with link | grade: E3 | risk: OK
do_this: "Answer fan-out sub-questions on the page; head-query top-10 rank alone no longer predicts AIO citation."
check: not detectable from the site
limits: Correlational; vendor; parsing improved between studies; window not stated; YouTube is 18.2% of beyond-top-100 citations.
sources:

- Vendor | Ahrefs | Update: 38% of AI Overview Citations Pull From The Top 10 | https://ahrefs.com/blog/ai-overview-citations-top-10/ | 2026-03-02 | 863K keyword SERPs, 4M AIO URLs; organic-only test: 37.10% top 10, 26.20% positions 11–100, 36.70% not in top 100
- Vendor | Ahrefs | 76% of AI Overview Citations Pull From the Top 10 | https://ahrefs.com/blog/search-rankings-ai-citations/ | 2025-07-21 | 1.9M citations from 1M AIOs, top 3 citations per response; 9.50% positions 11–100, 14.40% beyond top 100

#### NB-26 Profound shares are top-10-source shares

what: Profound's 47.9% (Wikipedia, ChatGPT), 46.7% (Reddit, Perplexity), 21.0% (Reddit, AIO) are shares within each platform's top-10 sources; overall shares are 7.8%, 6.6%, 2.2%.
fills: G-14 | baseline: none
surfaces: ChatGPT search, Perplexity, AIO | metric: cited with link | grade: E3 | risk: OK
do_this: "Quote Profound figures with their denominator; use 7.8% / 6.6% / 2.2% for share of all citations."
check: not detectable from the site
limits: Vendor; window August 2024–June 2025; page states 680M citations while 2025 coverage said 30M; update contents undisclosed.
sources:

- Vendor | Profound | AI Platform Citation Patterns: How ChatGPT, Google AI Overviews, and Perplexity Source Information | https://www.tryprofound.com/blog/ai-platform-citation-patterns | 2025-06-05 (updated 2025-08) | 680M citations, August 2024–June 2025; YouTube 18.8% of AIO top-10 share (1.9% overall), 13.9% of Perplexity top-10 share (2.0% overall)

#### NB-27 "YouTube overtook Reddit" is contested

what: Bluefish via Adweek: YouTube in 16% of LLM answers vs Reddit 10%; Tinuiti: Reddit share grew ≥73% October 2025–January 2026; Perplexity: Reddit 24%, YouTube 3%.
fills: G-14 | baseline: none
surfaces: ChatGPT search, Perplexity, Gemini app, AIO | metric: cited with link | grade: E3 | risk: OK
do_this: "Do not state 'YouTube overtook Reddit' as settled; give dataset, surface and denominator."
check: not detectable from the site
limits: Adweek paywalled after lede (n and method hidden); Tinuiti n not stated; Ahrefs: YouTube top AIO domain, +34% in six months.
sources:

- News | Adweek (Trishla Ostwal) | EXCLUSIVE: YouTube Overtakes Reddit as Go-To Citation Source on AI Search | https://www.adweek.com/media/youtube-reddit-ai-search-engine-citations/ | 2026-01-26 | Bluefish data, past six months; "four sources" cited, one named; paywalled
- Vendor | Tinuiti (Jen Cornwell) | AI Citation Trends Report Q1 2026 | https://tinuiti.com/research-insights/research/ai-citation-trends-report-q1-2026/ | date not shown (page modified 2026-08-26) | 7 platforms, 9 categories, October 2025–January 2026, Profound tooling; Gemini: Reddit 0.1%, YouTube 0.7%; AIO: Reddit 44% of social citations

#### NB-28 "Perplexity 3.2×" freshness stat is unsourced

what: No original found for "Perplexity cites under-30-day content 3.2×"; nearest primary data: AI-cited URLs average 1,064 days old vs 1,432 for organic results.
fills: G-14 | baseline: none
surfaces: ChatGPT search, Perplexity, Gemini app, Microsoft Copilot, AIO | metric: cited with link | grade: E3 | risk: OK
do_this: "Drop the 3.2× claim (unsourced, E4); cite the Ahrefs age gap instead: AI-cited URLs 25.7% fresher than organic results."
check: not detectable from the site
limits: Correlational; July 2025 data; AIO cited content 16 days older than organic on average; ChatGPT showed the strongest recency preference.
sources:

- Vendor | Ahrefs (Ryan Law) | New Study: AI Assistants Prefer to Cite "Fresher" Content (17 Million Citations Analyzed) | https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/ | 2025-07-28 | 16.975M cited URLs, 7 platforms; ChatGPT cited URLs 393–458 days newer than organic (search-result excerpt of original)

#### NB-29 GA4 adds AI Assistant default channel

what: Since 2026-05-13, GA4 puts sessions whose referrer matches a recognized AI assistant in channel "AI Assistant", medium ai-assistant, campaign (ai-assistant).
fills: G-15 | baseline: none
surfaces: ChatGPT search, Gemini app, Claude | metric: clicks | grade: E1 | risk: OK
do_this: "Report AI referrals from GA4's AI Assistant channel; verify other assistants' referrers manually because the recognized list is unpublished."
check: not detectable from the site
limits: Referrer-based; only ChatGPT, Gemini, Claude named; AIO and AI Mode clicks remain in Organic Search (Orbit Media).
sources:

- Official | Google Analytics Help | What's new — New AI Assistant traffic measurement | https://support.google.com/analytics/answer/9164320 | 2026-05-13 | release note

#### NB-30 OpenAI offers only a UTM tag

what: OpenAI documents only utm_source=chatgpt.com on referral links; no publisher impression or citation report exists; an unannounced Business Hub chart of impressions and clicks was reported.
fills: G-15 | baseline: none
surfaces: ChatGPT search | metric: clicks | grade: E4 | risk: OK
do_this: "Track ChatGPT by utm_source=chatgpt.com landing URLs, not referrer alone; expect no first-party citation data yet."
check: not detectable from the site
limits: UTM documentation seen via secondary sources; Business Hub unconfirmed by OpenAI; UTM tagging briefly vanished 2026-10-14 (reported as a bug).
sources:

- News | PPC Land | ChatGPT builds mention and click charts for verified businesses | https://ppc.land/chatgpt-builds-mention-and-click-charts-for-verified-businesses/ | 2026-11-06 | LinkedIn post by Juozas Kaziukėnas via Search Engine Roundtable; fields: daily impressions and clicks; verified businesses
- Practitioner | max.nardit.com | Does ChatGPT traffic convert better than Google? The 8x claim, the Marketing Science study, and how to measure your own | https://max.nardit.com/articles/chatgpt-traffic-conversion-rate | 2026-10 | own-site logs; LLM Pulse tracker: 96.55% of cited ChatGPT answers had a tagged link on 2026-10-25

#### NB-31 AIO presence cuts position-1 CTR 58%

what: Position-1 CTR on AIO keywords fell from 7.3% (December 2023) to 1.6% (December 2025), 58% below the no-AIO forecast; April 2025 study found 34.5%.
fills: G-16 | baseline: none
surfaces: AIO | metric: clicks | grade: E3 | risk: OK
do_this: "Forecast informational-query clicks with a 58% position-1 CTR reduction wherever an AIO shows."
check: not detectable from the site
limits: Correlational; desktop only; counterfactual assumes non-AIO informational keywords are a valid proxy; no cited-vs-uncited split.
sources:

- Vendor | Ahrefs (Ryan Law) | Update: AI Overviews Reduce Clicks by 58% | https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ | 2026-02-04 | 300,000 keywords (150,000 with AIO, 150,000 informational without), aggregated Search Console data; positions 2–10: −50.8% to −19.4%

#### NB-32 AI referral conversion differs by vertical

what: E-commerce: ChatGPT referrals convert below organic search (973 sites); B2B lead generation: ChatGPT 2.1% vs Google Search 0.5% lead conversion (97 sites).
fills: G-16 | baseline: none
surfaces: ChatGPT search | metric: clicks | grade: E3 | risk: OK
do_this: "Benchmark AI-referral conversion per vertical; do not assume a conversion premium for e-commerce."
check: not detectable from the site
limits: Different verticals, windows and conversion definitions; AI sources were 0.5% of B2B traffic; e-commerce organic gap fragile in robustness checks.
sources:

- Study | Marketing Science (Kaiser & Schulze) | Frontiers: ChatGPT Referrals to E-Commerce Websites: How Do LLMs Compare Against Traditional Channels? | https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489 | 2026 | 973 sites, $20B combined revenue, 12 months (August 2024–July 2025), 50,000+ ChatGPT transactions vs 164M (abstract excerpt); organic ≈13% higher conversion odds per max.nardit.com summary
- Practitioner | Orbit Media | AI Traffic Conversion Rates: New Research from 97 B2B Websites and 29M visits | https://www.orbitmedia.com/blog/conversion-rates-ai-search/ | date not shown | 97 GA4 accounts, 29M visits, one year through June 2026; 140,000 AI visits (search-result excerpt of original)

#### NB-33 Siri AI: Applebot crawl, rendering, nosnippet opt-out

what: Apple: Siri and Search answers may link sources crawled by Applebot; nosnippet excludes content from AI answers; Applebot may render JavaScript; Siri AI shipped 2026-09-14.
fills: G-17, G-20, discovery | baseline: none
surfaces: Siri / Apple Intelligence | metric: cited with link | grade: E1 | risk: OK
do_this: "Allow Applebot (it inherits Googlebot rules if unnamed), keep JS and CSS unblocked, and remove nosnippet from content meant for Siri answers."
check: "robots.txt does not block Applebot or required JS/CSS; answer content carries no nosnippet."
limits: Apple documents no source-selection rules, no local-business data source and no reporting; Siri AI not in EU or China at launch.
sources:

- Official | Apple Support | About Applebot | https://support.apple.com/en-us/119829 | 2026-09-04 | crawler documentation; Applebot-Extended = training opt-out only
- Official | Apple Newsroom | Introducing Apple Business — a new all-in-one platform for businesses of all sizes | https://www.apple.com/newsroom/2026/03/introducing-apple-business-a-new-all-in-one-platform-for-businesses-of-all-sizes/ | 2026-03-24 | place cards display across Apple Maps, Safari, Spotlight; Siri named among reach surfaces; available from 2026-04-14
- News | PPC Land | Apple ships Siri AI today, but not in the EU or China | https://ppc.land/apple-ships-siri-ai-today-but-not-in-the-eu-or-china/ | 2026-09-14 | launch report; iOS 27 family; English beta first

#### NB-34 Browser agents read the rendered page

what: Claude in Chrome reads text and DOM inside the user's Chrome; ChatGPT's cloud browser signs requests (Signature-Agent "https://chatgpt.com"); Atlas retired 2026-08-09; agents appear as Chromium.
fills: G-17 | baseline: none
surfaces: ChatGPT search, Claude, Perplexity | metric: facts stated correctly | grade: E3 | risk: OK
do_this: "Serve the same facts in raw HTML and rendered DOM; never vary content by user-agent, browser agents look like ordinary Chrome."
check: "No fact differs between raw HTML and rendered DOM on priority URLs."
limits: Official pages describe browser control, not JS execution explicitly; Comet undocumented by Perplexity; OpenAI help pages unfetchable (search-result text used).
sources:

- Official | Anthropic Help Center | Get started with Claude in Chrome | https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome.md | date not shown | permissions: scripting reads text on webpages; debugger clicks, types, takes screenshots (search-result excerpt of original)
- Official | OpenAI Help Center | ChatGPT agent allowlisting | https://help.openai.com/es-419/articles/11845367-chatgpt-agent-allowlisting | date not shown | HTTP Message Signatures (RFC 9421) on every request (search-result excerpt, localized page)
- Official | OpenAI Help Center | Evolving Atlas into ChatGPT for browser-based agentic work | https://help-lb.openai.com/en/articles/20001371-evolving-atlas-into-chatgpt-for-browser-based-agentic-work | date not shown | Atlas scheduled to stop working 2026-08-09 (search-result excerpt; fetch failed)
- Vendor | HUMAN Security | [title not captured] (ChatGPT Atlas vs Perplexity Comet agentic browsers) | https://humansecurity.com/learn/blog/chatgpt-atlas-vs-perplexity-comet-agentic-browsers/ | date not shown | technical analysis: both Chromium-based; Atlas agent reads rendered and raw HTML (search-result excerpt)

#### NB-35 97% of llms.txt files are never fetched

what: 137,210 domains: 28% publish llms.txt; 97% of those files got zero requests in May 2026; AI retrieval bots made 1.1% of requests.
fills: G-18 | baseline: replicates B-05 (independent)
surfaces: ChatGPT search, Perplexity, Claude | metric: cited with link | grade: E3 | risk: OK
do_this: "Skip llms.txt for answer-surface citations; keep it only if AI coding agents are an audience."
check: "Zero /llms.txt requests from OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User over 30 days = no-op asset."
limits: Fetch is not use; one month; UA-based classification; customer base skews technical; coding agents made 10.5% of requests.
sources:

- Vendor | Ahrefs (Louise Linehan) | We Analyzed 137K Sites: 97% of llms.txt Files Never Get Read | https://ahrefs.com/blog/llmstxt-study/ | 2026-06-15 | 137,210 domains, May 2026, bot analytics; AI assistants (ChatGPT-User, Claude-User) 2.5% of requests; training crawlers 5.3%; no AI bot requested a missing llms.txt

#### NB-36 llms.txt controlled test: Perplexity lift only

what: Ten-site matched-pair test: adding llms.txt and llms-full.txt lifted Perplexity citations +10.2 points (p = 0.04); Claude +3.6 (p = 0.18); ChatGPT and Gemini no effect.
fills: G-18 | baseline: none
surfaces: Perplexity, Claude, ChatGPT search, Gemini app | metric: cited with link | grade: E1 | risk: OK
do_this: "Treat llms.txt as unproven: one underpowered positive for Perplexity; do not prioritize it over server-HTML fixes."
check: not detectable from the site
limits: Five pairs; no multiple-comparison correction; six weeks; vendor sells the measurement tool; conflicts with log evidence (NB-12, NB-35).
sources:

- Vendor | Attrifast (Vincent Ruan) | Is llms.txt Worth It? A 10-Site, 6-Week Controlled Experiment (2026 Data) | https://attrifast.com/blog/should-i-publish-llms-txt-honest-test | 2026-05-26 | 5 treatment vs 5 control sites, 2026-04-08 to 2026-05-19, 30 prompts per vertical weekly; ChatGPT +0.4 points (p = 0.71), Gemini −3.1 (p = 0.31)
- Practitioner | Deepak Gupta | The GEO Measurement Study: 50,000 AI Citations in 90 Days, What Actually Moves Citation Share | https://guptadeepak.com/the-geo-measurement-study-50000-ai-citations-in-90-days-what-actually-moves-citation-share/ | 2026-06-01 (updated 2026-08-19) | author's own +11% llms.txt observation later marked "unreplicated" by the author

#### NB-37 ChatGPT researches non-English prompts partly in English

what: For non-English prompts, 43% of ChatGPT fan-out queries ran in English; conversations with English fan-outs: Turkish 94.4%, German 77.3%, Spanish 66.7%.
fills: G-19 | baseline: none
surfaces: ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "In non-English markets, publish an English counterpart of answer-worthy pages and check which English sources ChatGPT cites."
check: "Each priority non-English page has an indexable English equivalent linked via hreflang."
limits: Vendor; window given only as recent months; language-classification method undisclosed; measures queries, not citations.
sources:

- Vendor | Peec AI (Tomek Rudzki) | ChatGPT searches in English, even when you don't | https://peec.ai/blog/chatgpt-searches-in-english-even-when-you-don-t | 2026-02-12 | 10M+ prompts, 20M+ fan-outs, location–language matched; Dutch 88.4%, Polish 88.2%, Portuguese 87.6%, Italian 82.2%, French 81.8%

#### NB-38 Local AI: site depth and freshness, not schema

what: 10,000 businesses, ChatGPT and Perplexity: own website most-cited source; AI-visible businesses had >2× the pages; structured data, FAQ schema, llms.txt, speed showed no relationship.
fills: G-20 | baseline: replicates B-01 (independent)
surfaces: ChatGPT search, Perplexity | metric: brand mentioned, cited with link | grade: E3 | risk: OK
do_this: "For local AI answers, add and refresh crawlable service and location content before investing in LocalBusiness markup."
check: "Each service and each location has its own indexable page updated within 12 months."
limits: Correlational; vendor; window and statistics undisclosed; full data in gated report; NAP, location pages, LocalBusiness type not isolated.
sources:

- Vendor | Insites (Andrew Waite) | What AI uses to choose local businesses and what It ignores | https://insites.com/what-ai-uses-to-choose-local-businesses-and-what-it-ignores | 2026-05-05 | 10,000 businesses, 200+ signals; ChatGPT cited the business website in 72% of awareness and reputation queries; 93% known to ≥1 platform, 55% with accurate information

#### NB-39 Cited local business pages show phone and schema

what: Gemini local citations pointed to the business's own site 59.9% (July) and 49.6% (September 2026); cited business pages showed a visible phone number in 74–79%.
fills: G-20 | baseline: none
surfaces: Gemini app, AIO, AI Mode, ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "Show phone number and core business facts as visible text on every page meant to be cited locally."
check: "Phone number appears as text in raw HTML on every location and service page."
limits: Descriptive, no uncited comparison group; Gemini via API; ChatGPT website share restated to 10.5%; US only; schema on 74–79% of cited pages.
sources:

- Practitioner | Steady Demand (Ben Fisher) | Steady Demand Research Index – AI and GBP Stats | https://www.steadydemand.com/?p=4957 | 2026-08-29 (data updated 2026-11-16) | 1,487 queries, 14,472 citations, 50 US metros, 10 verticals (2026-07-27 to 2026-08-20); re-run 1,500 queries, 10,229 citations (2026-09-06 to 2026-09-09); AIO vs AI Mode business-site citations: schema 79.3% / 74.0%, visible phone 78.9% / 74.4%

#### NB-40 Google: Business Profile and Merchant Center feed AI

what: Google's AI guide: Merchant Center feeds and Business Profiles help products and local business details appear in AI responses; structured data is not required.
fills: G-20, G-21 | baseline: none
surfaces: AIO, AI Mode | metric: brand mentioned | grade: E1 | risk: OK
do_this: "Maintain the Merchant Center feed and Business Profile as product and local data inputs for Google AI responses."
check: not detectable from the site
limits: No weighting or thresholds given; guide last updated 2026-07-10; Microsoft's Copilot equivalent seen only in an unfetchable PDF; Perplexity publishes no feed spec.
sources:

- Official | Google Search Central | [title not captured] (AI optimization guide) | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide | 2026-07-10 (last updated) | documentation; same page as B-05, new statements

#### NB-41 ChatGPT product carousel mirrors Google Shopping

what: ChatGPT's top carousel product appeared in Google Shopping's first three results for 75% of 100 prompts; ChatGPT ran hidden Google Shopping fan-out queries.
fills: G-21 | baseline: none
surfaces: ChatGPT search | metric: brand mentioned | grade: E3 | risk: OK
do_this: "Win the Google Shopping listing for target queries (feed quality, price, availability); it predicts ChatGPT carousel inclusion."
check: not detectable from the site
limits: Small sample; logged-in account; window not stated; on-site and feed variables not tested.
sources:

- Vendor | Semrush (Leigh McKenzie) | ChatGPT Searches Google Shopping to Create its Recommendations | https://www.semrush.com/blog/chatgpt-searches-google-shopping/ | 2026-01-20 | 100 prompts × 5 runs; shopping fan-outs decoded from network traffic

#### NB-42 Perplexity favors company pages over author pages

what: Among 5,770 Google page-one pages, Perplexity cited company-published pages 39.5% vs individual-author pages 27.1%; adjusted odds ratio 0.40 for individual authors.
fills: G-22 | baseline: none
surfaces: Perplexity | metric: cited with link | grade: E3 | risk: OK
do_this: "Do not expect a personal byline alone to raise Perplexity citation; ranking position explained far more variance."
check: not detectable from the site
limits: Correlational; Perplexity only; page-one pages only; individual-author pages n = 361; publisher sells AEO services.
sources:

- Vendor | Discovered Labs | Companies outperform individual authors in Perplexity citations: 39.5% vs 27.1% | https://discoveredlabs.com/research/perplexity-citations-companies-vs-individual-authors | 2026-09 (last updated) | 400 questions × 3 runs, 8 industries; logistic regression; pseudo-R² ranking position 0.163, publisher type 0.005, domain authority 0.004

#### NB-43 Byline and sameAs studies conflict

what: 497-page study: bylines and credentials had no measurable effect; 22-site AIO study: author pages 2.6×, valid sameAs 1.9×; one-site study: deep sameAs +34%.
fills: G-22 | baseline: none
surfaces: AIO, ChatGPT search, Perplexity, Claude, Gemini app, Microsoft Copilot / Bing | metric: cited with link | grade: E3 | risk: OK
do_this: "Keep author pages and sameAs links valid for entity clarity; do not promise citation gains from them."
check: "Every sameAs URL in Person and Organization markup returns HTTP 200."
limits: All correlational or uncontrolled; Ranko reports no sample sizes; Gupta's changes shipped sequentially; DAP engines and window undisclosed.
sources:

- Vendor | Digital Authority Partners | The AI Content Fingerprint: An Original Data Study by Digital Authority Partners | https://www.digitalauthority.me/?p=89184 | date not shown | 497 organic results, 30 queries, 6 industries, 3 waves; citation rate by type: reference 75%, editorial 58%, landing/service 25%, forum 8%
- Practitioner | Ranko SEO (J. Ho) | Author bylines in AI Overviews: 30 days of E-E-A-T signal data in 2026 | https://rankseo-4k0.pages.dev/blog/author-eeat-ai-overviews-2026/ | 2026-05-02 | 22 client sites, 60 queries each, 30 days; "Editorial"/"Team" bylines cited 0.4× as often; photos, badges, credential strings no effect
- Practitioner | Deepak Gupta | The GEO Measurement Study: 50,000 AI Citations in 90 Days, What Actually Moves Citation Share | https://guptadeepak.com/the-geo-measurement-study-50000-ai-citations-in-90-days-what-actually-moves-citation-share/ | 2026-06-01 (updated 2026-08-19) | 240 pages, 200 prompts, 6 engines, 13 weeks from February 2026, 50,431 citations; sameAs +52% on Gemini and Bing; observational

#### NB-44 Search Console adds multimodal search type

what: Search Console added a multimodal search type (Lens, Circle to Search, image uploads, Chrome image search) to Performance and Generative AI reports from 2026-09-24.
fills: discovery | baseline: none
surfaces: AIO, AI Mode | metric: cited with link | grade: E1 | risk: OK
do_this: "Add the multimodal search type to Search Console monitoring for image-led queries."
check: not detectable from the site
limits: Post does not name which AI surfaces the multimodal data covers; data appears only if the site receives such traffic.
sources:

- Official | Google Search Central Blog | Announcing web multimodal Search performance reporting in Search Console | https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc | 2026-09-24 | product announcement; global rollout from that date

#### NB-45 Page-level Google AI exclusion due 2027-03-03

what: Google's Search generative AI control is property-level (all sites since 2026-08-31); page-level exclusion from AIO/AI Mode grounding is due 2027-03-03 under a UK CMA requirement.
fills: discovery | baseline: changes B-19
surfaces: AIO, AI Mode | metric: cited with link | grade: E4 | risk: OK
do_this: "Plan page-level AI exclusions for March 2027; today only whole-property exclusion or nosnippet (which also removes snippets) exist."
check: not detectable from the site
limits: News reports only; Google has not published the page-level mechanism; date is a regulatory deadline, not a product commitment.
sources:

- News | PPC Land | [title not captured] (Google reacts to UK order with a Search Console AI opt-out toggle) | https://ppc.land/google-reacts-to-uk-order-with-a-search-console-ai-opt-out-toggle/ | date not shown | CMA nine-month implementation period for page-level controls (search-result excerpt)
- News | Search Engine Journal | Google Search Console AI Reports Rolled Out Worldwide | https://www.searchenginejournal.com/google-search-console-ai-reports-rolled-out-worldwide/587836/ | date not shown | property-level control; CMA timeline to March 2027 (search-result excerpt)

#### NB-46 Title–query overlap doubles ChatGPT citation rate

what: Among 548,534 pages ChatGPT retrieved, 15% were cited; pages with ≥50% title–query overlap were cited at 20.1% vs 9.3% under 10% overlap.
fills: discovery | baseline: none
surfaces: ChatGPT search | metric: cited with link | grade: E3 | risk: OK
do_this: "Write titles that restate the specific question the page answers, in fan-out phrasing; never build one page per query variation (B-05)."
check: "Title shares ≥50% of words with the page's primary target query."
limits: Correlational; vendor; window not stated; 95% of fan-out queries show zero search volume; fan-outs vary per run.
sources:

- Vendor | AirOps (Oshen Davidson) | The Influence of Retrieval, Fan-out, and Google SERPs on ChatGPT Citations | https://www.airops.com/report/influence-of-retrieval-fanout-and-google-serps-in-chatgpt | 2026-03-12 | 15,000 prompts in 8 intent types, 43,233 queries, 82,108 citations; citation rate: product discovery 18.3%, how-to 16.9%, comparison 13.1%, validation 11.3%; DA 20–80 sites earned 63.6% of citations

## Off-site (parked)

| Finding (≤20 words)                                                                                                        | Surface                         | Grade | Source URL                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| Google Business Profile = 28.6% of local AI citations, highest on AI Mode/AIO                                              | AI Mode, AIO, ChatGPT search    | E3    | https://www.brightlocal.com/research/local-ai-visibility-study/                    |
| Yelp appeared in 80% of ChatGPT local answers                                                                              | ChatGPT search                  | E3    | https://www.brightlocal.com/resources/ai-directory-sources/                        |
| YouTube received 22% of AIO citation links; Reddit second                                                                  | AIO                             | E3    | https://api.on-page.ai/research/ai-citation-study                                  |
| A single 2018 third-party review drove a repeated wrong brand claim                                                        | ChatGPT search, Perplexity, AIO | E3    | https://www.seerinteractive.com/insights/using-geo-to-address-brand-misconceptions |
| Reddit 0.60% of German vs 1.79% of US citations; consumer-test publishers lead in Germany                                  | 7 engines                       | E3    | https://otterly.ai/blog/ai-search-index-germany/                                   |
| Yelp grounded 95.83% of ChatGPT local business cards; TripAdvisor 28.90%; Foursquare 0% (4,607 runs, August 2026)          | ChatGPT search                  | E3    | https://www.steadydemand.com/?p=4927                                               |
| ChatGPT local citations: Reddit fell from 41.7% to 0.0% after a 2026-08-20 source-mix change                               | ChatGPT search                  | E3    | https://www.steadydemand.com/?p=4957                                               |
| Gemini-named local businesses matched Google Places 93% (July) and 92% (September 2026)                                    | Gemini app                      | E3    | https://www.steadydemand.com/?p=4957                                               |
| Businesses visible to ChatGPT and Perplexity averaged 133 Google reviews vs 11; Local Pack presence 3.5× recommendations   | ChatGPT search, Perplexity      | E3    | https://insites.com/what-ai-uses-to-choose-local-businesses-and-what-it-ignores    |
| AI-named businesses had median 444 Google reviews vs 192 not named (1,851 top-20 Google listings, 2026-08-24)              | ChatGPT search, AI Mode         | E3    | https://www.zarla.com/guides/ai-visibility-index                                   |
| ChatGPT local providers: scraped Google Maps, Yelp, TripAdvisor, plus pipes surfacing business websites and Facebook pages | ChatGPT search                  | E3    | https://docs.peec.ai/research/chatgpt-search-result-providers                      |
| Yelp licensed reviews, ratings, photos and business data to OpenAI (Axios, 2026-07-23)                                     | ChatGPT search                  | E4    | https://searchengineland.com/openai-yelp-deal-483326                               |
| YouTube = 5.6% of all AIO-cited URLs; top-cited AIO domain, +34% in six months                                             | AIO                             | E3    | https://ahrefs.com/blog/ai-overview-citations-top-10/                              |

## Gaps

- status changes pass 1 → pass 2: G-12, G-14, G-18, G-20, G-21, G-22 PARTIAL → CLOSED; G-13, G-15, G-16, G-17, G-19 CLOSED → CLOSED (evidence added)
- resolved in pass 2 (was open in pass 1): Bing blog original opened (NB-08); Profound original opened (NB-26); AirOps, Ahrefs ×3, searchVIU leads opened (NB-20, NB-25, NB-31, NB-10); Search Engine World test opened (NB-11); attrifast test opened (NB-36); Ranko byline data opened (NB-43); GA4 AI referral coverage (NB-29); per-surface time to first citation incl. Claude and Gemini (NB-22); Google AIPREF post opened, token mapping confirmed (NB-18); Cloudflare doc opened (NB-19); AI Mode shopping official statement (NB-40); Siri data source and controls (NB-33)
- residual sub-questions — no public evidence found after two passes (cannot be closed by research): independent replication of B-09 snippet length and B-10 cache behaviors beyond RESONEO/Oncrawl; head-to-head test of correction formats (facts page vs FAQ vs About vs press page); cited-vs-uncited click data for ChatGPT, Perplexity, Copilot, Gemini, AI Mode; citation effect of JS-only content (only fact visibility measured); official doc that any answer surface honors Content Signals; controlled test of LocalBusiness markup, NAP-in-HTML or location pages on local AI answers; official Copilot local data-source doc; Siri / Apple Intelligence business-selection rules; public Perplexity shopping feed spec; outcome study of product markup or feed–page consistency on any shopping surface; effect of author/entity markup on fact accuracy; original for "Perplexity 3.2×"
- baseline flags (conflicts kept, not resolved): B-09 says no page opened in 93% of instant answers — RESONEO original (updated 2026-08-08) reports 1,073 of 1,249 answers (85.9%) opened no page overall, only two free-tier conversations opened one, snippet cut at 202 characters; B-11 Google-dependence magnitude varies 16.61%–≈75% by method and tier (NB-20); B-17 Claude non-use of a Google/Bing-indexed site is consistent with a Brave-based index (NB-23)
- searches with no result: OpenAI / Perplexity / Anthropic publisher analytics (official); Copilot local answers Bing Places official doc; Perplexity merchant feed spec (official); LocalBusiness schema controlled test local AI; click-through rate of ChatGPT / Perplexity citations cited vs not cited; second independent all-surface time-to-citation dataset (MaxAEO is the only one found); "Perplexity cites <30-day content 3.2×" original
- inaccessible sources: https://help.openai.com/en/articles/11128490-shopping-with-chatgpt-search — client error on two fetches; https://help.openai.com/en/articles/20001371-evolving-atlas-into-chatgpt-for-browser-based-agentic-work — client error (search-result text used); https://about.ads.microsoft.com/content/dam/sites/msa-about/global/common/content-lib/pdf/prepare-for-the-age-of-ai-shop.pdf — client error (search-result excerpt: send 100% of products to Merchant Center for paid and organic AI experiences across Bing and Copilot; not used as a finding); https://www.adweek.com/media/youtube-reddit-ai-search-engine-citations/ — paywalled after lede; https://ground.news/article/71-of-chatgpt-citations-go-to-sites-missing-from-googles-first-page-omnifamous-2m-citation-study-finds — fetch not permitted (same press release opened via Saint Paul Chronicle); https://searchengineland.com/google-also-gives-publishers-more-control-over-how-ai-uses-their-content-499971 — bot-blocked (superseded by Google's own post)
- skipped (seen in search results, original not opened; not used as findings): Profound time-to-first-citation (LinkedIn post by Josh Blyskal: ≈900 pages, median 6.81 days, 90% within 37 days, ChatGPT + Claude); Agenzy tracking of 236 new pages (AIO median 4 days, ChatGPT 9); rankseo.studio time-to-first-citation (19 sites, AIO median 11 days); Marie Haynes 100-site GA4 study (145M sessions; ChatGPT 13.8% vs Google organic 3.02% conversion) via Search Engine Land; organikpi 153,425-citation study — not located; Glenn Gabe client-side-rendering case study; Whitespark 540-query local AIO study and SOCi Local Visibility Index (ChatGPT recommends 1.2% of locations) via secondary coverage; Meta Commercial Terms crawl clause (effective date moved to 2026-11-20 per secondary reports); TollBit H1 2026 report (ChatGPT-User reached disallowed pages on nearly half of European sites listing it; OpenAI doc says robots.txt "may not apply") — Run A crawler-token scope; CTAIO schema citation test (12 variations, results pending); Google "Update to the Site Reputation Policy" (2026-08-28) opened — EEA manual-action change, no AI content, not an AEO finding
- pass-1 sources opened but not cited in findings (retained for traceability): https://www.searchenginejournal.com/google-search-console-ai-reports-rolled-out-worldwide/587836/ ; https://www.tryvizup.com/blog/bing-ai-visibility-insights ; https://www.rivalhound.com/blog/ai-overviews-ctr-rebound-cited-only/ ; https://www.paz.ai/blog/chatgpt-shopping-how-to-show-up-in-product-results ; https://pritamr.substack.com/p/how-to-get-products-on-chatgpt ; https://searchengineland.com/guide/chatgpt-using-google-search ; https://mentionx.ai/learn/technical/bing-webmaster-tools-ai-visibility ; https://www.seroundtable.com/bing-intents-topics-citation-share-compare-ai-reporting-41513.html ; https://www.demandlocal.com/blog/presence-and-paid-search-cpc-statistics/ ; https://saaslinks.net/blog/llms-txt-server-log-study ; https://www.streetinsider.com/Pinion+Newswire/Study+Concludes+Markdown+is+Ineffective+for+AI+Citations/26964218.html ; https://finance.yahoo.com/technology/ai/articles/otterlyai-releases-study-german-ai-140000420.html ; https://www.herozite.com/blog/get-your-business-recommended-by-chatgpt/ ; https://www.lighthouselocal.ai/blog/how-to-get-your-business-recommended-by-chatgpt ; https://ranketta.com/blog/chatgpt-product-feed ; https://iconizer.io/chatgpt-shopping-how-products-get-into-the-answer ; https://www.aischemagen.com/blog/product-schema-chatgpt-shopping ; https://www.gptmelo.com/resources/ai-platform-citation-patterns-2026
- assumption: search-result text from an official page that blocked fetching is treated as opened when quoted verbatim in results. (pass 1)
- assumption: Seer Interactive and Verticality count as independent cases for E2. (pass 1)
- assumption: G-16 "Closes when" met by one disclosed-n study for AIO only. (pass 1)
- assumption: pass 2 also treats a search-result excerpt of the original page as opened; each such source is labeled "(search-result excerpt of original)".
- assumption: status CLOSED = the gap's "Closes when" criterion is met; sub-questions with no evidence are listed under residual sub-questions rather than holding the gap at PARTIAL.
- assumption: small controlled tests keep grade E1 per §4 (control group present); weakness is stated in limits (NB-17, NB-36).
- assumption: `pass2:` lines record every change made to a pass-1 finding (zero-loss merge); findings NB-20 to NB-46 are new in pass 2.
- assumption: where pass 1 gave both a quoted check rule and "not detectable from the site", pass 2 keeps one form: NB-01, NB-02 keep "not detectable" and preserve the rule in the pass2 line; NB-03, NB-04 keep the quoted rule (site-detectable).
