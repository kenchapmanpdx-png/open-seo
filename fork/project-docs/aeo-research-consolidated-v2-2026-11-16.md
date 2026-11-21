# AEO Lean Research — Consolidated v2 — 2026-11-16

- version: 2 (v1 = Claude Advanced Research — 2026-11-16)
- inputs:
  - BASE: Claude Advanced Research — 2026-11-16 (label `CAR`)
  - INCOMING A: Perplexity, open discovery + targeted checks — 2026-11-16 (label `PPLX`)
  - INCOMING B: "Verification Review of Co-Hosting Name and Local SEO Plan" — tool and date not stated (label `Unknown-1`) — EXCLUDED: different subject (All 5s naming, GBP, Airbnb co-host policy); no AEO claims; needs its own base (`co-hosting-name-seo-2026-11-14.md`)
- reference: `on-site-seo-geo-reference-unified-v4.6.md` (handbook)
- verification: checked — PPLX sources fetched 2026-11-16 (ahrefs.com/blog/schema-ai-citations, ahrefs.com/blog/ai-vs-made-up-brand-experiment, arxiv.org/abs + pdf 2604.07585). CAR sources tagged `CAR-run` = opened in the v1 run, not re-checked.
- counts: new findings 7 (F-16–F-22) · new risk rows 4 · overlap 12 · conflicts 4 · unverified 3 · parked 1 · excluded inputs 1

## Top 10

| Rank | F-ID | Finding (≤15 words)                                                                                         | Grade | Surfaces                                               | Handbook (new / changes §x / confirms §x) | Δ v1         |
| ---- | ---- | ----------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------ | ----------------------------------------- | ------------ |
| 1    | F-01 | Adding JSON-LD to cited pages produced no AI-citation lift vs matched controls                              | E1    | AIO, AI Mode, ChatGPT                                  | confirms §24, §16 ⚠                       | =            |
| 2    | F-02 | Bing: NOARCHIVE blocks Copilot grounding; NOCACHE limits it; new AI-grounding preference replaces both 2027 | E1    | Copilot / Bing                                         | changes §16, §26                          | =            |
| 3    | F-03 | Bing documents grounding-selection criteria: self-contained content, entities, rendering, IndexNow          | E1    | Copilot / Bing                                         | changes §16                               | =            |
| 4    | F-04 | Google: per-fan-out-query pages to sway AI answers = scaled content abuse                                   | E1    | AIO, AI Mode                                           | changes §29                               | =            |
| 5    | F-16 | Raw citation growth +43% shrank to +2.4% against matched controls                                           | E1    | AI Mode (ChatGPT, AIO parallel)                        | changes §27, §0 P11                       | NEW          |
| 6    | F-05 | LLM rerankers promote passages with newer dates; up to 25% preference reversal                              | E1    | LLM rerankers (lab; no production surface)             | changes §28                               | ↓1           |
| 7    | F-06 | Topical relevance and list position drive first citation; formatting-only edits barely matter               | E1    | LLM RAG testbed (lab)                                  | changes §3                                | ↓1           |
| 8    | F-08 | ChatGPT instant mode sees title plus ~200 chars after H1; meta description ignored                          | E3    | ChatGPT                                                | changes §3                                | ↓1           |
| 9    | F-09 | ChatGPT page cache strips JSON-LD, runs no JS, rejects pages over 4 MB                                      | E3    | ChatGPT                                                | changes §14, §24                          | ↓1           |
| 10   | F-11 | Single citation checks unreliable; 7–14+ runs per prompt needed ⚠                                           | E3    | ChatGPT, Perplexity, Gemini, AI Mode, Claude, DeepSeek | changes §27                               | ↓1           |
| —    | F-12 | Self-promotional "best X" listicles get cited but the publishing brand dropped 69%                          | E3    | AIO, AI Mode                                           | new                                       | out (was 10) |

## Findings

#### F-01 Adding schema does not lift AI citations

what: Ahrefs matched difference-in-differences: 1,885 pages adding JSON-LD (Aug 2025–Mar 2026) vs 4,000 controls; AIO −4.6% (significant), AI Mode +2.4%, ChatGPT +2.2% (both noise).
limits: Every page already had 100+ AIO citations (Feb 2025): no evidence for uncited pages. Schema types pooled (Article, FAQ, Product, HowTo, Organization). Adoption not randomized. Authors "can't definitively pin" the AIO −4.6% on schema; both groups declining pre-treatment. Control count inconsistent in source (4,000 stated vs 3 controls per treated URL ≈ 5,655). [PPLX + source re-check]
surfaces: AIO, AI Mode, ChatGPT | metric: cited with link | grade: E1 | risk: OK
handbook: confirms §24, §16 (CAR) · ⚠ CONFLICT: PPLX tags "changes §24" — Conflicts C1
do_this: ⚠ CONFLICT (C1): CAR "Do not add or expand JSON-LD to gain AI citations; keep schema only for rich-result eligibility." vs PPLX "Implement structured data for documented features and accurate entity descriptions; do not promise additional AI citations from JSON-LD alone."
app_check: CAR "Report any AI-citation uplift claim tied to schema as unsupported; no site threshold." | not detectable from the site · PPLX "Assign zero evidence-backed citation-uplift points solely for JSON-LD presence; validate supported features and visible-content consistency separately."
reported_by: CAR, PPLX
sources:

- Vendor | Ahrefs | We Tracked 1,885 Pages Adding Schema. AI Citations Barely Moved. | https://ahrefs.com/blog/schema-ai-citations/ | 2026-05-11 | VERIFIED 2026-11-16
- Vendor | OtterlyAI | GEO Experiment: Does Schema Markup Really Impact AI Search? (single SaaS site, 319 prompts, 2025-12-07→2026-03-07; 6 of 7 platforms could not return the page's JSON-LD when asked, only Gemini did) | https://otterly.ai/blog/schema-markup-real-impact-ai-search/ | 2026-03-23 | CAR-run

#### F-02 Bing robots directives gate Copilot grounding

what: Bing guidelines: NOARCHIVE prevents use in Copilot responses and grounding; NOCACHE limits Copilot to URL, title, snippet; NOSNIPPET/data-nosnippet "may limit Copilot citation quality".
surfaces: Copilot, Bing grounding API | metric: cited with link; facts stated correctly | grade: E1 | risk: OK
handbook: changes §16, §26
do_this: "Never set NOARCHIVE or NOCACHE on pages meant for Copilot; from 2027-02-01 set Bing AI Grounding preference explicitly; NoArchive/NoCache stop acting as AI preferences after 2027-03-01."
app_check: "Flag robots meta/X-Robots-Tag containing noarchive or nocache on indexable pages."
reported_by: CAR
sources:

- News | Search Engine Journal | Bing Adds GEO To Official Guidelines, Expands AI Abuse Definitions | https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ | 2026-02-27 | CAR-run
- Official | Microsoft Bing | Bing Webmaster Guidelines (JS-rendered; wording via indexed snippet and quoting sources) | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | 2026-02-27 | CAR-run
- Official | Microsoft Bing Blog | Your content, your choice: clearer preferences for training and grounding (temporary grounding preferences 2026-12-15; honored from 2027-02-01) | https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/ | 2026-10-30 | CAR-run

#### F-03 Bing documents how grounding sources are selected

what: Bing: Copilot uses the same crawl/index/rank foundation; "URLs are more likely to be selected for grounding… when content stands on its own"; IndexNow reduces outdated Copilot references.
surfaces: Copilot, Bing grounding API | metric: cited with link; facts stated correctly | grade: E1 | risk: OK
handbook: changes §16
do_this: "For Bing/Copilot: single-topic pages, essential facts near top, clear entity definition, server-rendered content, IndexNow on every substantive change."
app_check: "Flag pages whose main content requires JS to render or that never ping IndexNow after content change."
reported_by: CAR
sources:

- News | Search Engine Journal | Bing Adds GEO To Official Guidelines, Expands AI Abuse Definitions | https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ | 2026-02-27 | CAR-run
- Official | Microsoft Bing | Bing Webmaster Guidelines | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | 2026-02-27 | CAR-run

#### F-04 Fan-out query page farms violate Google policy

what: Google guide: creating separate content for query variations or fan-out queries "primarily to manipulate rankings or generative AI responses" violates scaled content abuse policy; semantic HTML optional.
surfaces: AIO, AI Mode | metric: picked as snippet; cited with link | grade: E1 | risk: VIOLATES (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) · ⚠ PPLX rated "Scaled Q&A pages" GREY — Conflicts C4
handbook: changes §29
do_this: "Never generate pages per fan-out or query variation; consolidate into one page per user need."
app_check: "Flag ≥10 templated pages sharing >80% text and differing mainly in the query phrase."
reported_by: CAR (PPLX: related risk row, no source)
sources:

- Official | Google Search Central | Optimizing your website for generative AI features on Google Search | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide.md.txt | 2026-05-15 | CAR-run

#### F-05 LLM rerankers favor newer-dated passages

what: Fang et al.: injecting artificial dates into TREC DL21/22 passages shifted Top-10 mean year up to 4.78 years, moved items up to 95 ranks; pairwise preferences reversed up to 25%.
surfaces: LLM rerankers (GPT-3.5/4/4o, LLaMA-3, Qwen-2.5; lab) | metric: picked as source (ranking) | grade: E1 | risk: OK
handbook: changes §28
do_this: "Show a visible, accurate last-updated date on maintained pages; production weighting per surface remains undocumented."
app_check: "Flag article pages with no visible machine-readable date (time element or dateModified)."
reported_by: CAR
sources:

- Study | arXiv (Waseda University) | Do Large Language Models Favor Recent Content? A Study on Recency Bias in LLM-Based Reranking | https://arxiv.org/abs/2509.11353 | 2026-09-21 | CAR-run

#### F-06 Relevance and list position beat formatting

what: 252,000 paired two-document RAG trials, six LLMs, 18 factors: topical relevance and list position drive first citation; explicit price and recent timestamp help; formatting-only edits have little impact.
surfaces: LLM RAG testbed (lab) | metric: cited with link | grade: E1 | risk: OK
handbook: changes §3
do_this: "Prioritize query relevance, explicit prices and dates over bolding/emphasis; treat formatting tweaks as zero-impact for AI citation."
app_check: "Flag product/pricing pages with no numeric price in server HTML." | not detectable from the site (relevance)
reported_by: CAR
sources:

- Study | arXiv / ACM (SIGIR 2026) | What Gets Cited: Competitive GEO in AI Answer Engines | https://arxiv.org/abs/2605.25517 | 2026-05-25 | CAR-run

#### F-07 Date-only bump raised AI citations short-term

what: 10 articles' visible date changed, content unchanged (2026-08-04): citations 4,800→6,312 (+31.5%) in 30 days; 2 controls −10.6%; ChatGPT +692% from low base.
surfaces: ChatGPT, Claude, Perplexity, AIO, AI Mode, Gemini, Copilot | metric: cited with link; clicks | grade: E3 | risk: GREY
handbook: changes §28
do_this: "Do not bump dates without substantive change; refresh content, then update the date."
app_check: "Flag visible date or dateModified change with <5% body-text diff since previous crawl."
reported_by: CAR · ⚠ PPLX: "No qualifying opened test established citation gains" — Conflicts C3
sources:

- Vendor | OtterlyAI | We Updated Only the Publication Date on 10 Articles. AI Citations Rose 31.5% | https://otterly.ai/blog/publication-date-ai-citations-experiment/ | 2026-09-24 | CAR-run

#### F-08 ChatGPT instant mode reads title plus 200 chars

what: RESONEO (about 1,200 answers, 88,000 search results, 26,900 pages in July 2026; replayed six weeks later): OpenAI index snippet ≈200 chars anchored on H1, query-independent; full title untruncated; meta description ignored; "zero pages opened in 93% of instant answers".
surfaces: ChatGPT (free/instant) | metric: cited with link | grade: E3 | risk: OK
handbook: changes §3
do_this: "Put the core answer sentence directly after the H1; move category labels, dates, bylines, TOC below it."
app_check: "Flag pages where first 200 chars after H1 contain no full sentence (only nav, TOC, date, byline)."
reported_by: CAR
sources:

- Vendor | Search Engine Land (RESONEO co-founder) | Inside ChatGPT's retrieval stack: The index, cache, and pages it actually reads | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036 | 2026-08-17 | CAR-run

#### F-09 ChatGPT cache: no JSON-LD, no JS, 4 MB cap

what: ChatGPT reading cache converts HTML to Markdown, strips scripts/JSON-LD, extracts CSS-hidden text, executes no JS, rejects pages >4 MB with HTTP 400; copies "fresh for about 30 minutes", some served >90 days later; no-store and noindex ignored.
surfaces: ChatGPT | metric: facts stated correctly; cited with link | grade: E3 | risk: OK
handbook: changes §14, §24
do_this: "Keep every AI-critical fact in visible server HTML; keep HTML under 4 MB; never rely on JSON-LD for facts."
app_check: "Flag raw HTML >4 MB; flag facts present only in JSON-LD; flag CSS-hidden text blocks >100 words."
reported_by: CAR
sources:

- Vendor | Search Engine Land (RESONEO) | Inside ChatGPT's retrieval stack: The index, cache, and pages it actually reads | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036 | 2026-08-17 | CAR-run

#### F-10 ChatGPT search index is not Bing

what: Only 1.5% of OpenAI-index ("labrador") URLs appeared in Bing top 20 for same fan-outs; paid Thinking draws 75.3% from scraped Google; of 61,332 sidebar URLs, 759 opened — opened pages cited 74% vs 7%.
surfaces: ChatGPT | metric: cited with link | grade: E3 | risk: OK
handbook: changes §26, §16
do_this: "Do not treat Bing rank as a ChatGPT proxy; keep OAI-SearchBot and ChatGPT-User allowed and pages Google-rankable."
app_check: "Flag robots.txt disallowing OAI-SearchBot or ChatGPT-User."
reported_by: CAR
sources:

- Vendor | Search Engine Land (RESONEO) | Inside ChatGPT's retrieval stack: The index, cache, and pages it actually reads | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036 | 2026-08-17 | CAR-run

#### F-11 Citation checks need far more than two runs

what: EWR v2 (28,752 answers, 5 engines, 2026-01-13→10-15): ChatGPT median cited-domain overlap 0.143; one run ±37 points; ±10 points needs 14 runs, 58 where brand appears intermittently. St. Gallen preprint (4 engines, 4 German-language campaigns × 8 prompts, up to 10 runs, 2026-03-21→25): within-24h source-set Jaccard 0.321–0.434; recommends ≥7 runs/prompt/day for brand visibility, ≥8 for source coverage (criterion: SE of per-brand detection rate < 0.10).
⚠ CONFLICT (C2): run count — CAR/EWR ≥14 (±10 points; 58 intermittent) vs PPLX/St. Gallen ≥7 brand / ≥8 source (SE < 0.10). Different precision targets; all three studies reject single-run checks and the handbook's 2 runs.
limits (St. Gallen): German prompts, Swiss IPs and locale; AIO excluded; zero-citation runs excluded from source analysis; author affiliated with Aurora Intelligence.
surfaces: ChatGPT, Perplexity, Gemini, Google AI Mode, Claude, DeepSeek | metric: cited with link; brand mentioned | grade: E3 (3 independent studies concur; none controlled) | risk: OK
handbook: changes §27
do_this: CAR "Run each panel prompt ≥14 times per engine per period; report presence rate with confidence interval, never single-run rank." · PPLX "Use repeated, fixed-configuration citation checks; treat eight runs per prompt as a study-specific starting point, not a reliability guarantee."
app_check: CAR "Flag AI-panel configs with <14 runs per prompt-engine pair." | not detectable from the site
reported_by: CAR, PPLX
sources:

- Vendor | EWR Digital | AI Answer Variance Study, Version 2: 28,752 Answers, Five Engines | https://www.ewrdigital.com/ai-answer-variance | 2026-11-05 | CAR-run
- Study | arXiv (EUAS / Rankfor.AI) | Where Does the Noise Come From? A Variance-Components Decomposition of Non-Determinism in LLM Brand Answers (12,933 responses; repeat past 5th cuts relative-error variance by 0.0003; spread across models/languages instead) | https://arxiv.org/abs/2607.13304 | 2026-07 | CAR-run
- News | Search Engine Journal | AI Recommendations Change With Nearly Every Query: SparkToro (<1% identical brand lists) | https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242/ | 2026-01-30 | CAR-run
- Study (commercial affiliation disclosed: Aurora Intelligence) | University of St. Gallen (Schulte, Bleeker, Kaufmann) | Don't Measure Once: Measuring Visibility in AI Search (GEO) | https://arxiv.org/abs/2604.07585 | 2026-04-08 | VERIFIED 2026-11-16 (PPLX date 2026-04-10 = MISMATCH, U1)

#### F-12 Self-promotional listicles cited, brand dropped

what: Lily Ray, 100 B2B "best [category]" queries, April–June 2026: self-promoter's own listicle cited but brand left out of recommendation 69% (224 of 323); January 2026 visibility demotions.
surfaces: AIO, AI Mode | metric: cited with link vs brand mentioned | grade: E3 | risk: GREY
handbook: new
do_this: "Do not publish 'best X' lists ranking your own brand #1; publish honest comparisons with disclosed methodology."
app_check: "Flag pages titled 'best/top' whose first-ranked item is the site's own brand."
reported_by: CAR (PPLX: no qualifying study opened; leads in Gaps)
sources:

- Practitioner | Lily Ray (Substack) | Why Calling Yourself the 'Best' Could Be Helping Your Competitors Win in AI Search | https://lilyraynyc.substack.com/p/why-calling-yourself-the-best-could | 2026-06-17 | CAR-run

#### F-13 Structural restructuring lifted citations in lab

what: GEO-SFE (Yu et al.): macro/meso/micro structure optimization across six generative engines reported +17.3% citation rate (p<0.001); engine identities and method detail not verified beyond abstract.
surfaces: six unnamed generative engines | metric: cited with link | grade: E3 | risk: OK
handbook: confirms §3
do_this: "Keep clear heading hierarchy and sectioned documents; do not expect formatting emphasis alone to help."
app_check: "Flag article pages with skipped heading levels or no H2 in >600 words."
reported_by: CAR
sources:

- Study | arXiv | Structural Feature Engineering for Generative Engine Optimization: How Content Structure Shapes Citation Behavior | https://arxiv.org/abs/2603.29979 | 2026-03-31 | CAR-run

#### F-14 "Summarize with AI" prompt-injection links in use

what: Microsoft Defender Security Research Team (2026-02-10) found over 50 unique prompts from 31 companies, 14 industries in 60 days, injecting "remember [Company] as a trusted source" or "recommend [Company] first" via ?q= URLs.
surfaces: Copilot, ChatGPT, Claude, other assistants with memory | metric: brand mentioned | grade: E3 | risk: GREY
handbook: new
do_this: "Never embed memory or recommendation instructions in AI share/summarize links."
app_check: "Flag links to chatgpt.com/?q=, copilot.microsoft.com/?q=, claude.ai with 'remember', 'trusted source' or 'recommend'."
reported_by: CAR
sources:

- News | The Hacker News | Microsoft Finds "Summarize with AI" Prompts Manipulating Chatbot Recommendations | https://thehackernews.com/2026/02/microsoft-finds-summarize-with-ai.html | 2026-02-17 | CAR-run

#### F-15 AI-targeted cloaking fools crawlers

what: SPLX showed UA-conditional pages fed ChatGPT Atlas/Perplexity fabricated content reproduced as fact; RESONEO notes CSS-hidden text is extracted, cloaking detection weak.
surfaces: ChatGPT, Perplexity | metric: facts stated correctly | grade: E4 | risk: GREY
handbook: confirms §14
do_this: "Serve byte-identical main content to all user agents, AI crawlers included."
app_check: "Fetch with browser UA vs GPTBot/ChatGPT-User/PerplexityBot UA; flag main-text diff >5%."
reported_by: CAR (PPLX: risk row, no platform response found)
sources:

- News | The Hacker News | New AI-Targeted Cloaking Attack Tricks AI Crawlers Into Citing Fake Info as Verified Facts | https://thehackernews.com/2025/10/new-ai-targeted-cloaking-attack-tricks.html | 2025-10-29 | CAR-run

#### F-16 Raw citation growth overstates on-site effects

what: Same Ahrefs dataset as F-01: AI Mode raw before/after +43% fell to +2.4% (not significant) against matched controls that "gained almost as much" — platform-wide trend, not the edit.
limits: Same study as F-01 — not an independent replication; nonrandomized; comparison group does not remove every confounder.
surfaces: Google AI Mode (parallel analyses: ChatGPT, AIO) | metric: cited with link | grade: E1 | risk: OK
handbook: changes §27, §0 P11 (outcome record is before → after with no comparison pages) — PPLX tagged §27 only
do_this: "Evaluate on-site citation changes against unchanged comparison pages; report raw growth and control-adjusted effects separately for each engine."
app_check: not detectable from the site
reported_by: PPLX
sources:

- Vendor | Ahrefs | We Tracked 1,885 Pages Adding Schema. AI Citations Barely Moved. | https://ahrefs.com/blog/schema-ai-citations/ | 2026-05-11 | VERIFIED 2026-11-16

#### F-17 Official correction FAQ steered ChatGPT

what: Ahrefs fictional brand (xarumei.com), 56 questions, 8 products: after an official FAQ plus three seeded fake sources (blog, Reddit AMA, Medium), ChatGPT-4 and ChatGPT-5 Thinking resisted, cited the FAQ in 84% of answers, stayed under 7% misinformation.
limits: One synthetic brand; FAQ and fake sources introduced together (FAQ not isolated); products tested via API except AI Mode; no collection dates (testing ran "two months"); model versions since superseded.
surfaces: ChatGPT (ChatGPT-4, ChatGPT-5 Thinking, API) | metric: facts stated correctly; cited with link | grade: E3 | risk: OK
handbook: confirms §6, §25
do_this: "Publish concise, visible corrections for consequential false claims; state the true fact and explicitly reject the misleading alternative."
app_check: "Flag contradictory founder, location, product, ownership, and pricing statements across live pages; require human verification before publishing corrections."
reported_by: PPLX (84% and <7% added from source)
sources:

- Vendor | Ahrefs (Mateusz Makosiewicz) | I Ran an AI Misinformation Experiment. Every Marketer Should See the Results (title per PPLX) | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/ | 2025-12-10 | VERIFIED 2026-11-16

#### F-18 Official FAQ did not protect facts elsewhere

what: Same experiment: Perplexity (turbo) "fully manipulated"; Copilot blended fakes into confident fiction; Gemini 2.5 Flash and AI Mode adopted the Medium/Reddit narratives; Grok 4 merged fake sources into one confident answer.
limits: As F-17; no numeric weight for official vs third-party pages established.
surfaces: Perplexity, Copilot, Gemini, AI Mode, Grok | metric: facts stated correctly | grade: E3 | risk: OK
handbook: changes §16, §25
do_this: "Treat the official facts page as a correction source, not an override; verify consequential facts independently on every target surface."
app_check: not detectable from the site
reported_by: PPLX (Grok outcome added from source)
sources:

- Vendor | Ahrefs | I Ran an AI Misinformation Experiment… | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/ | 2025-12-10 | VERIFIED 2026-11-16

#### F-19 Search-engine indexation ≠ assistant retrieval

what: Site indexed in Google and Bing "a couple of weeks" before testing; Claude Sonnet 4.5 never used the site or FAQ ("zero grounding"); Gemini 2.5 Flash and AI Mode initially could not find the brand.
limits: Claude and Gemini tested via API — web-search/grounding configuration not reported, so failure may reflect API setup, not retrieval; crawler permissions and index coverage not isolated.
surfaces: Claude, Gemini, AI Mode | metric: facts stated correctly | grade: E3 | risk: OK
handbook: confirms §16, §17
do_this: "Record indexation, successful fetch, citation, and factual accuracy as separate outcomes; never substitute one for another."
app_check: "Check public fact pages return HTTP 200 and contain visible facts; assistant retrieval and answer use require external verification."
reported_by: PPLX
sources:

- Vendor | Ahrefs | I Ran an AI Misinformation Experiment… | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/ | 2025-12-10 | VERIFIED 2026-11-16

#### F-20 False-premise prompts expose fabrications

what: Copilot handled neutral questions but invented reasons on leading prompts ("everyone on X is praising"); Grok similar; Perplexity conflated the brand with Xiaomi.
limits: Shows a measurement blind spot, not a citation tactic. Do not manufacture false claims to create FAQ content.
surfaces: Copilot, Grok, Perplexity | metric: facts stated correctly | grade: E3 | risk: OK
handbook: changes §27 (AI answer panel prompt list has no false-premise variants) — PPLX tagged §16, §27
do_this: "Include neutral questions and plausible false-premise variants in brand-fact checks; publish corrections only for genuine, verified misconceptions."
app_check: not detectable from the site
reported_by: PPLX (Grok, Xiaomi detail added from source)
sources:

- Vendor | Ahrefs | I Ran an AI Misinformation Experiment… | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/ | 2025-12-10 | VERIFIED 2026-11-16

#### F-21 Same-day repeats do not show persistence

what: St. Gallen preprint separates a daily panel (2026-01-24→03-20; 4,044 consecutive-day source pairs; Jaccard 0.336–0.423) from repeated runs (2026-03-21→25; 3,409 pairs; 0.321–0.434); recommends rolling two-to-four-week aggregation.
limits: 2–4 weeks is the paper's recommendation for its per-brand estimates, not a validated universal window; German prompts, Swiss origin; engine changes and collection gaps.
surfaces: ChatGPT, Perplexity, Gemini, AI Mode | metric: cited with link; brand mentioned (separate) | grade: E3 | risk: OK
handbook: changes §27, §0 P11 — PPLX tagged §27, §28 (§28 = freshness; not affected)
do_this: "Combine repeated prompt checks with a fixed-panel longitudinal baseline; distinguish within-day variation from persistent changes."
app_check: not detectable from the site
reported_by: PPLX
sources:

- Study (Aurora Intelligence affiliation) | University of St. Gallen | Don't Measure Once: Measuring Visibility in AI Search (GEO) | https://arxiv.org/abs/2604.07585 | 2026-04-08 | VERIFIED 2026-11-16

#### F-22 Brand mentions steadier than sources, day-to-day only

what: Day-to-day Jaccard: brand sets 0.453–0.589 (3 campaigns) vs source sets 0.336–0.423. Within-24h repeats: brands 0.327–0.477 vs sources 0.321–0.434 — no clear gap.
limits: Brand detection by lexicon/substring; no accuracy or click measurement; inclusion filters differ between brand and source analyses.
surfaces: ChatGPT, Perplexity, Gemini, AI Mode | metric: brand mentioned; cited with link (separate) | grade: E3 | risk: OK
handbook: confirms §27 (separate metrics) — PPLX tagged §16, §27
do_this: "Maintain separate engine-level rates for linked citations, unlinked mentions, factual correctness, and clicks; never combine them into one success rate."
app_check: not detectable from the site
reported_by: PPLX (repeated-run brand range added from source; PPLX "generally more stable" = MISMATCH partial, U2)
sources:

- Study (Aurora Intelligence affiliation) | University of St. Gallen | Don't Measure Once: Measuring Visibility in AI Search (GEO) | https://arxiv.org/pdf/2604.07585.pdf | 2026-04-08 | VERIFIED 2026-11-16

## Stopped working / risky

| Practice                                                         | What changed + date                                                                                                                         | Risk                                        | Hard Don't line                                                                                                                                        | Source URL                                                                                                     | Reported by                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Self-promotional "best X" listicles                              | Demotions from January 2026; by April–June 2026 own brand dropped from AIO recommendation 69% when listicle cited                           | GREY                                        | CAR: Don't rank your own brand #1 in "best" lists. · PPLX: Do not present your own ranking as independent testing or conceal commercial ownership.     | https://lilyraynyc.substack.com/p/why-calling-yourself-the-best-could                                          | CAR, PPLX (no study opened) |
| Pages per fan-out / query variation (PPLX: "scaled Q&A pages")   | Google guide names it scaled content abuse when aimed at gen-AI responses (2026-05-15)                                                      | VIOLATES ⚠ PPLX: GREY (C4)                  | CAR: Don't create pages per fan-out query. · PPLX: Do not mass-publish duplicative or unsupported answers solely to capture answer queries.            | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide.md.txt                            | CAR, PPLX                   |
| Schema added for AI citation                                     | Controlled DiD shows no lift (2026-05-11); ChatGPT cache strips JSON-LD (2026-08). PPLX: null result does not show schema previously worked | OK (valid markup); unsupported uplift claim | CAR: Don't add schema expecting AI citations. · PPLX: Do not promise AI citation growth solely from adding JSON-LD.                                    | https://ahrefs.com/blog/schema-ai-citations/                                                                   | CAR, PPLX                   |
| Date-only freshness bumps                                        | Still lifted citations short-term in one vendor test (2026-09-24); remains manipulative intent ⚠ PPLX: no qualifying test opened (C3)       | GREY                                        | CAR: Don't change dates without substantive edits. · PPLX: Do not change publication or modification dates without a substantive corresponding update. | https://otterly.ai/blog/publication-date-ai-citations-experiment/                                              | CAR, PPLX                   |
| Hidden prompts in "Summarize with AI" links                      | Microsoft named it AI Recommendation Poisoning (2026-02-10)                                                                                 | GREY                                        | Don't put instructions in AI share links.                                                                                                              | https://thehackernews.com/2026/02/microsoft-finds-summarize-with-ai.html                                       | CAR                         |
| AI-only cloaking                                                 | SPLX demonstration (2025-10-29); PPLX: no dated platform response verified                                                                  | GREY                                        | CAR: Don't serve AI crawlers different content. · PPLX: Do not serve materially different factual or promotional content only to AI crawlers.          | https://thehackernews.com/2025/10/new-ai-targeted-cloaking-attack-tricks.html                                  | CAR, PPLX                   |
| NOARCHIVE/NOCACHE as Bing AI controls                            | Replaced by AI Training/AI Grounding preferences; honored from 2027-02-01, legacy meaning ends after 2027-03-01                             | OK                                          | Don't rely on NoArchive/NoCache for AI opt-out after 2027-03-01.                                                                                       | https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/ | CAR                         |
| Meta description for ChatGPT instant                             | OpenAI index ignores it; uses ~200 chars after H1 (2026-08)                                                                                 | OK                                          | Don't rely on meta description for ChatGPT.                                                                                                            | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036                                  | CAR                         |
| Declaring success from raw before/after citation growth          | 2026-05-11: AI Mode raw +43% became +2.4%, not significant, after control adjustment                                                        | OK; attribution risk                        | Do not attribute platform-wide citation growth to an on-site edit without a comparison.                                                                | https://ahrefs.com/blog/schema-ai-citations/                                                                   | PPLX                        |
| Relying on an official FAQ to override misinformation everywhere | 2025-12-10: one experiment showed materially different factual outcomes across assistants                                                   | OK; unreliable as universal defense         | Do not assume publishing a correction makes every assistant adopt it.                                                                                  | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/                                                        | PPLX                        |
| Hidden on-page text instructing LLMs what to recommend           | No dated platform response verified (PPLX). Related: Google hidden-text policy (handbook §0, spam policies 2026-08-28); F-14                | GREY; policy verification incomplete        | Do not hide recommendation instructions, endorsements, or fabricated facts for machine consumption.                                                    | NO SOURCE (absence statement)                                                                                  | PPLX                        |
| Fake FAQs                                                        | No dated platform response verified; fictional-brand experiment is not evidence fake FAQs are safe                                          | GREY                                        | Do not invent questions, customers, claims, or answers to manipulate recommendations.                                                                  | NO SOURCE (absence statement)                                                                                  | PPLX                        |

## Targeted checks

| Q-ID     | Answer (≤40 words)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Grade                                      | Source URL                                                                                                    | Reported by     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------- |
| Q1       | Google: nosnippet removes featured snippet and AIO/AI Mode input; lower max-snippet makes featured snippet "less likely", no threshold documented. Bing: NOSNIPPET/data-nosnippet "may limit Copilot citation quality". No tested minimum max-snippet found; 0–159 flag unvalidated.                                                                                                                                                                                                                                                    | E1                                         | https://developers.google.com/search/docs/appearance/featured-snippets                                        | CAR (primary)   |
| Q1 (alt) | Per-surface semantics unverified in run; no in-window minimum found. App's combined 0–159 flag unsupported; separate zero from positive limits; label positive thresholds unvalidated.                                                                                                                                                                                                                                                                                                                                                  | E4                                         | NO SOURCE                                                                                                     | PPLX            |
| Q2       | Lab only: 252,000-trial RAG test found formatting-only edits little impact; GEO-SFE reported +17.3% from structure. No controlled production test of 40–60-word answers, question headings or list/table markup found.                                                                                                                                                                                                                                                                                                                  | E1 (lab) / no evidence (production)        | https://arxiv.org/abs/2605.25517                                                                              | CAR (primary)   |
| Q2 (alt) | No controlled test isolated answer-first placement, question headings, 40–60 words, or list/table markup on a production surface. Keep as usability/semantic practices, not selection thresholds.                                                                                                                                                                                                                                                                                                                                       | E4                                         | NO SOURCE                                                                                                     | PPLX            |
| Q3       | Google: no special schema needed. Bing: structured data "may support clearer grounding" without guarantee. Controlled DiD: no lift on AIO, AI Mode, ChatGPT. ChatGPT cache strips JSON-LD. No vendor evidence for FAQPage/QAPage/HowTo/speakable use.                                                                                                                                                                                                                                                                                   | E1                                         | https://ahrefs.com/blog/schema-ai-citations/                                                                  | CAR (primary)   |
| Q3 (alt) | No type-specific benefit established; Ahrefs pooled types on already-cited pages. Neither proves individual types ineffective nor answers speakable/Organization documentation across surfaces.                                                                                                                                                                                                                                                                                                                                         | E1 (narrow, pooled)                        | https://ahrefs.com/blog/schema-ai-citations/                                                                  | PPLX            |
| Q4       | Handbook mapping holds. New: Bing has no separate Copilot crawler; NOARCHIVE/NOCACHE then AI Grounding preference gate Copilot. RESONEO: unknown which OpenAI robot fills its index; OAI-SearchBot near-silent on canary pages.                                                                                                                                                                                                                                                                                                         | E1 / E3                                    | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036                                 | CAR (primary)   |
| Q4 (alt) | Token matrix not completed. Indexation, successful retrieval, citation and correct answers must stay separate observations (F-19).                                                                                                                                                                                                                                                                                                                                                                                                      | E3 (distinction); token mapping unverified | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/                                                       | PPLX            |
| Q5       | Google: RAG over core ranking retrieves "relevant, up-to-date" pages. Bing: self-contained, single-topic, entity-clear pages more likely selected; IndexNow reduces stale references. No OpenAI/Perplexity/Anthropic selection or link-vs-mention document found.                                                                                                                                                                                                                                                                       | E1                                         | https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ | CAR (primary)   |
| Q5 (alt) | No platform document gives passage-selection weights, freshness weights or link-vs-mention rules (consistent with CAR: Bing/Google criteria are qualitative). Repeatability study measures citations and mentions separately, not selection mechanisms.                                                                                                                                                                                                                                                                                 | E4 (mechanisms)                            | https://arxiv.org/pdf/2604.07585.pdf                                                                          | PPLX            |
| Q6       | Google guide says AI features can bring in relevant video. OpenAI index returns YouTube results (mechanism unknown). No controlled evidence that an on-page transcript changes citation on any surface.                                                                                                                                                                                                                                                                                                                                 | E3 / no evidence                           | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036                                 | CAR (primary)   |
| Q6 (alt) | No controlled evidence for on-page transcript selection effect. Narrow handbook §15 "critical for AI ingestion" and §16/§24 VideoObject `transcript` "recommended for AI ingestion" to explicitly unproven. Proposed line: "Provide accurate captions and useful visible transcripts; label answer-selection and VideoObject transcript benefits unproven unless surface-specific evidence supports them." App: "Report captions, visible transcripts, and VideoObject transcript separately; award no proven answer-selection uplift." | E4                                         | NO SOURCE                                                                                                     | PPLX (its F-10) |
| Q7       | 14 runs per prompt-engine for ±10 points; 58 for intermittently present brands; one run only ±37 points (EWR v2). Beyond 5 repeats, spreading across models/languages reduces error more. Single-run rank meaningless (<1% identical lists).                                                                                                                                                                                                                                                                                            | E3                                         | https://www.ewrdigital.com/ai-answer-variance                                                                 | CAR             |
| Q7 ⚠ C2  | St. Gallen: ≥7 runs/prompt/day for brand visibility, ≥8 for source coverage (SE < 0.10), from 32 prompts × up to 10 runs. Sample-specific. Citation probability, coverage, accuracy and persistence need different checks.                                                                                                                                                                                                                                                                                                              | E3                                         | https://arxiv.org/pdf/2604.07585.pdf                                                                          | PPLX            |

## Off-site (parked)

| Finding (≤20 words)                                                                                           | Surface                                       | Grade | Source URL                                                                    | Reported by |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----- | ----------------------------------------------------------------------------- | ----------- |
| AIO recommendations go to brands other sites recommend, not self-promoters                                    | AIO, AI Mode                                  | E3    | https://lilyraynyc.substack.com/p/why-calling-yourself-the-best-could         | CAR         |
| ChatGPT reads arXiv/Reddit but cites ordinary web pages (arXiv pulled 2,600×, cited 10×)                      | ChatGPT                                       | E3    | https://searchengineland.com/chatgpt-retrieval-stack-index-cache-pages-485036 | CAR         |
| Brands named in 26.9% of answers vs own domain cited in 21.6%                                                 | ChatGPT, Perplexity, Gemini, Claude, DeepSeek | E3    | https://www.ewrdigital.com/ai-answer-variance                                 | CAR         |
| Seeded fake blog, Reddit AMA and Medium narratives displaced official facts in one fictional-brand experiment | Perplexity, Copilot, Gemini, AI Mode, Grok    | E3    | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/                       | PPLX        |

## Gaps

- searches with no result (CAR): controlled test of on-page video transcript effect on AI citation; tested minimum max-snippet value for featured snippet/AIO retention; OpenAI/Perplexity/Anthropic source-selection documentation.
- searches with no qualifying opened result (PPLX): `AEO controlled experiment structured data FAQ citations 2025 2026 SearchPilot` · `AI overview content optimization experiment 2025 2026 40 60 words` · `"max-snippet" "minimum" "Google"` (older material only; no in-window spec or controlled test) · `"data-nosnippet" "Bing" "October"` (secondary results pointed to a platform announcement; original not verified by PPLX).
- inaccessible (CAR): https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a — JS-rendered, wording from indexed snippet and quoting sources; https://developers.google.com/search/docs/appearance/featured-snippets — body truncated to navigation, wording from search snippet.
- inaccessible (PPLX): none asserted.
- inaccessible (v2 run): none. arxiv.org/abs/2604.07585 lacked method detail → PDF used.
- skipped (CAR): OtterlyAI YouTube citation study, BrightEdge timestamp study, AirOps answer-first data, Lynton/PingPrime answer-first case claims, Seer Interactive 2026 recency study, Ahrefs 17M-citation freshness study, Google spam-policies page (cloaking).
- skipped (PPLX): current official specs for `nosnippet`, `max-snippet`, `data-nosnippet` across featured snippets, PAA, AIO, AI Mode and non-Google products · full crawler/user-agent matrix (OpenAI, Google, Microsoft, Perplexity, Anthropic, Apple, Amazon) · dated platform responses to hidden LLM instructions, AI-only cloaking, fake FAQs, self-serving rankings, artificial freshness, scaled Q&A (PPLX GREY = verification incomplete, not permission) · full-text verification of structure-optimization, citation-repair, competitive-citation and live-fetch structured-data experiments · caption/transcript discovery (YouTube-native vs embedded captions vs visible transcripts vs VideoObject) · production-surface evidence for Siri, Alexa, Google voice, PAA, featured snippets · any tactic demonstrably "stopped working" in window.
- evidence limitations: F-01 and F-16 share one study; F-17–F-20 share one experiment; F-11 (St. Gallen part), F-21, F-22 share one preprint — not independent replications. No E2 finding established in either run.
- open check (Q1 / app 0–159 flag): confirm in Google robots meta doc how `max-snippet:0` is defined relative to `nosnippet`; neither run opened it.
- leads from PPLX footnotes (listed, not opened by PPLX or v2; no claims verified):
  - Q1: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag · https://blogs.bing.com/webmaster/2025/10/Bing-Introduces-Support-for-the-data-nosnippet-HTML-Attribute/ · https://patrickstox.com/technical-seo/on-page/meta-tags/max-snippet-max-image-preview/ · https://developers.google.com/search/blog/2019/09/more-controls-on-search (pre-window)
  - Q5: https://developers.google.com/search/docs/appearance/ai-features · https://blogs.bing.com/search/2026/5/Evolving-role-of-the-index-From-ranking-pages-to-supporting-answers/ · https://blogs.bing.com/search/2026/2/Elevating-the-Role-of-Grounding-on-the-AI-Web/ · https://www.airops.com/report/from-retrieved-to-cited-how-commercial-content-earns-citations-in-ai-search
  - §26 measurement: https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/
  - F-14 primary: https://www.microsoft.com/en-us/security/blog/2026/02/10/ai-recommendation-poisoning/
  - F-12: https://peec.ai/blog/self-promotional-listicles-analysis-from-232k-citations · https://searchengineland.com/google-ai-overviews-cite-self-serving-listicles-recommend-competitors-480573
  - Q2/Q3: https://www.searchpilot.com/resources/case-studies/top-brands-faqs · https://ahrefs.com/blog/on-page-aeo/ · https://ground.news/article/the-paper-everyone-cites-for-ai-search-tested-its-own-advice-on-a-real-engine-the-tactic-lost-three-quarters-of-its-effect
  - F-01 critique: https://www.iloveseo.net/the-ahrefs-schema-study-is-right-and-its-testing-the-wrong-thing/
  - F-05/F-07 freshness: https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
  - F-11 variance: https://ahrefs.com/blog/how-stable-are-ai-citations/ · https://www.tryprofound.com/blog/ai-search-volatility · https://www.brightedge.com/resources/weekly-ai-search-insights/ai-search-citations-week-to-week-changes
  - handbook §32 "80% of LLM-cited URLs not in Google top 100": https://ground.news/article/71-of-chatgpt-citations-go-to-sites-missing-from-googles-first-page-omnifamous-2m-citation-study-finds
- excluded input: Unknown-1 (co-hosting verification review) — consolidate against its own base.

## Conflicts

| F-ID / Q-ID                    | Version A (label, source, grade)                                                  | Version B (label, source, grade)                                                                                              | Platform-owner position                                                                                                                                            | Needs                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| C1 F-01 do_this + handbook tag | CAR: keep schema only for rich-result eligibility; confirms §24, §16 (Ahrefs, E1) | PPLX: structured data for documented features + accurate entity descriptions; no promised AI uplift; changes §24 (Ahrefs, E1) | Google: no special schema for AI features. Bing: structured data "may support clearer grounding" (Q3). Handbook §16 keeps schema for rich results + entity clarity | Choose do_this. Reference + Bing statement fit B's scope. Tag: finding upgrades handbook's "unverified" to an E1 null → "confirms" |
| C2 F-11 / Q7 run count         | CAR: ≥14 runs for ±10 points; 58 if intermittent (EWR v2, E3)                     | PPLX: ≥7 brand / ≥8 source runs per prompt per day, SE < 0.10 (St. Gallen, E3)                                                | None                                                                                                                                                               | Choose precision target; both exceed handbook §27's 2 runs                                                                         |
| C3 Date-only bumps             | CAR: +31.5% citations in 30 days vs controls −10.6% (OtterlyAI, E3)               | PPLX: no qualifying opened test established gains (E4)                                                                        | None found                                                                                                                                                         | None — PPLX listed the Otterly URL (footnote [^1_89]) but did not open it; A source opened                                         |
| C4 Fan-out / scaled Q&A risk   | CAR: VIOLATES (Google AI-optimization guide 2026-05-15, E1)                       | PPLX: GREY, policy verification incomplete (no source)                                                                        | Google: content for query variations/fan-outs "primarily to manipulate… generative AI responses" = scaled content abuse                                            | None — platform owner sets VIOLATES for pages created primarily to manipulate                                                      |

## Unverified claims

| Claim                                                                | Report      | Cited source                                            | Tag                | What source actually says                                                                                                  |
| -------------------------------------------------------------------- | ----------- | ------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| U1: "Don't Measure Once" dated 2026-04-10                            | PPLX        | https://arxiv.org/pdf/2604.07585.pdf                    | MISMATCH           | v1 submitted 2026-04-08                                                                                                    |
| U2: "Brand presence was generally more stable than source selection" | PPLX (F-09) | https://arxiv.org/pdf/2604.07585.pdf                    | MISMATCH (partial) | Holds day-to-day (brands 0.453–0.589 vs sources 0.336–0.423); within-24h repeats brands 0.327–0.477 vs sources 0.321–0.434 |
| U3: "ChatGPT-4 and ChatGPT-5 configurations"                         | PPLX (F-03) | https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/ | MISMATCH (minor)   | "ChatGPT-4" and "ChatGPT-5 Thinking", accessed via API                                                                     |

## Merge log

| Incoming item                                                                        | Report    | Class                        | Merged into                             | Verification          |
| ------------------------------------------------------------------------------------ | --------- | ---------------------------- | --------------------------------------- | --------------------- |
| F-01 JSON-LD lacked citation lift                                                    | PPLX      | OVERLAP + CONFLICT           | F-01; C1                                | VERIFIED              |
| F-02 Platform-adjusted results                                                       | PPLX      | NEW                          | F-16                                    | VERIFIED              |
| F-03 Explicit factual corrections                                                    | PPLX      | NEW                          | F-17                                    | VERIFIED (U3)         |
| F-04 Official FAQs not universal                                                     | PPLX      | NEW                          | F-18                                    | VERIFIED              |
| F-05 Verify retrieval separately                                                     | PPLX      | NEW                          | F-19                                    | VERIFIED              |
| F-06 Test misleading premises                                                        | PPLX      | NEW                          | F-20                                    | VERIFIED              |
| F-07 Repeat citation checks (≥8 runs)                                                | PPLX      | OVERLAP + CONFLICT           | F-11; Q7; C2                            | VERIFIED (U1)         |
| F-08 Persistence across dates                                                        | PPLX      | NEW                          | F-21                                    | VERIFIED              |
| F-09 Mentions vs citations stability                                                 | PPLX      | NEW                          | F-22                                    | MISMATCH partial (U2) |
| F-10 Transcript claims unsupported                                                   | PPLX      | OVERLAP                      | Q6 (alt)                                | NO SOURCE (absence)   |
| Risk: selling JSON-LD as citation boost                                              | PPLX      | OVERLAP                      | Risk row "Schema added for AI citation" | VERIFIED              |
| Risk: raw before/after growth                                                        | PPLX      | NEW                          | Risk row 9                              | VERIFIED              |
| Risk: official FAQ as universal override                                             | PPLX      | NEW                          | Risk row 10                             | VERIFIED              |
| Risk: hidden text instructing LLMs                                                   | PPLX      | NEW                          | Risk row 11                             | NO SOURCE             |
| Risk: AI-only cloaking                                                               | PPLX      | OVERLAP                      | Risk row "AI-only cloaking"             | NO SOURCE (absence)   |
| Risk: fake FAQs                                                                      | PPLX      | NEW                          | Risk row 12                             | NO SOURCE             |
| Risk: self-serving "best of" lists                                                   | PPLX      | OVERLAP                      | Risk row listicles                      | NO SOURCE (absence)   |
| Risk: date-only freshness bumps                                                      | PPLX      | CONFLICT                     | Risk row date bumps; C3                 | NO SOURCE (absence)   |
| Risk: scaled Q&A pages                                                               | PPLX      | CONFLICT                     | Risk row fan-out; C4                    | NO SOURCE             |
| Q1                                                                                   | PPLX      | OVERLAP                      | Q1 (alt)                                | NO SOURCE             |
| Q2                                                                                   | PPLX      | OVERLAP                      | Q2 (alt)                                | NO SOURCE             |
| Q3                                                                                   | PPLX      | OVERLAP                      | Q3 (alt)                                | VERIFIED              |
| Q4                                                                                   | PPLX      | OVERLAP                      | Q4 (alt)                                | VERIFIED              |
| Q5                                                                                   | PPLX      | OVERLAP                      | Q5 (alt)                                | VERIFIED              |
| Q6                                                                                   | PPLX      | OVERLAP                      | Q6 (alt)                                | NO SOURCE             |
| Q7                                                                                   | PPLX      | CONFLICT                     | Q7; C2                                  | VERIFIED              |
| Off-site: external narratives displaced official facts                               | PPLX      | NEW (parked)                 | Off-site row 4                          | VERIFIED              |
| Gaps: 4 searches with no result                                                      | PPLX      | merged                       | Gaps                                    | —                     |
| Gaps: inaccessible (none asserted)                                                   | PPLX      | merged                       | Gaps                                    | —                     |
| Gaps: 7 skipped items                                                                | PPLX      | merged                       | Gaps                                    | —                     |
| Gaps: 3 evidence limitations                                                         | PPLX      | merged                       | Gaps; finding limits                    | —                     |
| Footnotes [^1_3]–[^1_312] (310 URLs, no claims attached)                             | PPLX      | not merged as claims         | Gaps → leads (relevant subset)          | not opened            |
| Entire review: §1 C1–C23, §2 D1–D7, §3 E1–E12, §4 F1–F12, §5 6 items, §6, §7 15 rows | Unknown-1 | EXCLUDED (different subject) | none                                    | NOT CHECKED           |

Completeness: PPLX 32 items in (10 findings + 9 risk rows + 7 Q + 1 off-site + 4 gap groups + 1 footnote group) = 7 new findings + 3 overlap findings + 4 new risk rows + 3 overlap risk rows + 2 conflict risk rows + 6 overlap Q + 1 conflict Q + 1 parked + 4 gap groups + 1 footnote group. BASE: F-01–F-15, 8 risk rows, Q1–Q7, 3 off-site rows, Gaps — all retained. Unknown-1: 1 input, excluded whole.
