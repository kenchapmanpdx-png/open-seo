# On-Site SEO + GEO Reference — Archive + Maintainer Notes (companion to v4.6)

Not for implementation. The implementing LLM does not load this file. Contents, verbatim from v4.5 unless marked: A. Version history · §34 Coverage Confirmation · §38 Retired Guidance · §40 Platform Change Timeline · E. Maintainer notes (field-test coverage, v4.6 desk additions awaiting field confirmation, re-verification cadence, merge hygiene).

Companion to `on-site-seo-geo-reference-unified-v4.6.md` · Created 2026-11-14 · Decision record: `seo-geo-merge-decisions-2026-11-14-v4.6.md`.

---

## A. Version history (v4.5 header line, verbatim)

Version: 4.5 · Last verified: 2026-11-14 · v4.5 = v4.4 + two items closed against primary pages (§18 `Claude-Agent` identification; §30 / §39 EU AI Act Art. 5 additions) + new watchlist row F-16 (EU Digital Omnibus, data part). v4.4 = v4.3 + severity calibration (S1 scope for JS-only content; robots group bug class — §0 EP-1), re-verified owner-page items (§10, §16, §18, §24, §27, §39, §40). v4.3 = v4.2 + (a) the 27 defect-audit fixes of 2026-11-12, which the v4.1 and v4.2 builds did not contain (merge record §34; replaced lines §38) + (b) field test FT2 (2026-11-13; own-stack site on Vercel, tier T3): fallback strings in raw HTML (§14), image weight (§15), Event place / time / price detail (§24), checker-triage rows (§31), §41 items. Decision records: `seo-geo-merge-decisions-2026-11-14.md` (v4.2→v4.3→v4.4). v4.2 = v4.1 + FT1 site-crawler cross-check: outbound and third-party link checks (§12), price lists and menus as table/list markup (§14), crawler configuration (§17), crawler rows in §31 Checker triage. v4.1 = v4.0 + field test FT1 (2026-11-13): read-only external audit of a live local-business site on a hosted builder, cross-checked against 5 third-party checkers. Adds REVIEW mode + scoring (EP-7), P1 evidence set + reconciliation, platform limits, checker rules (§0, §31), URL inventory reconciliation (§17) and new on-page checks. Section numbers §0–§41 unchanged. Decision record + verbatim archive of changed lines: `seo-geo-merge-decisions-2026-11-13.md`. v4.0 = consolidated release: v3.3 content with all red-team merges applied (R1, R2, R3, R3b, R3c); patch/version markers removed from the body. Release notes + full change log (v4.0): `seo-geo-v4.0-changelog.md`. Decision records: `seo-geo-merge-decisions-2026-11-11.md` (v3.0→v3.3), `seo-geo-merge-decisions-2026-11-01.md` (v2). Claims no run verified carry `[UNVERIFIED as of 2026-11-01]` (P1 only). Dated facts are as-of the date shown.

- Not in the project as of 2026-11-14: `seo-geo-v4.0-changelog.md`, `seo-geo-v4.1-changelog.md` (cited above and in §34).

---

## 34. Coverage Confirmation

### Sources merged

- **Source A:** Original GEO/AEO doc (BLUF, answer capsules, AI bot allowlist, llms.txt, schema, Bing/IndexNow, entity engineering, freshness).
- **Source B:** Ultimate SEO Landing Page Guide (keyword research, Three Kings, meta description, body copy placement, NLP, readability, design/UX, internal linking, technical SEO, schema validation, E-E-A-T, analytics, post-publish maintenance).
- **Source C:** Gap analysis additions (canonical tags, redirects, status codes, Open Graph + Twitter, pagination, faceted nav, internal search, hreflang, security headers, cookie consent + CWV, responsive images, video on-page + transcripts, featured snippets, PAA, AI referral tracking, brand entity mention patterns, product lifecycle, sitemap field accuracy).
- **Source D:** Expert-tier / superpower additions (log file analysis, edge SEO, internal PageRank modeling, JS SEO forensics, crawl budget engineering, resource hints, server-side A/B testing, Information Gain optimization, entity coverage scoring, programmatic SEO, first-party data publishing, tool-as-content, SERP-derived topic cluster, cross-LLM citation tracking, prompt-pattern reverse engineering, embedding-level semantic analysis, AI Overview structural targeting, MCP server publishing, instructional llms.txt, defensive AI bot strategy, structured Q&A endpoint, Knowledge Panel claim, author entity building, editorial standards, citation networks, sameAs saturation, BigQuery exports, custom SoV dashboards, algorithm update tracking, Bing AI Performance Report).

### Scope excluded (off-site)

- Backlink acquisition / external link building.
- Digital PR / third-party validation.
- Wikipedia / Wikidata creation.
- Reddit, YouTube, podcast authority building.
- Industry directory submissions.
- Press release distribution.

### Items considered but dropped as redundant or not needle-moving

- "Conversational query targeting" — covered by question H3s + featured snippet patterns.
- "JavaScript hydration edge cases" — covered by HTML-first SSR/SSG rule.
- "Voice search" — covered by question H3s + featured snippets. (Current state of voice/assistant search not re-verified 2026-11-01.)
- "Mobile-first indexing specifics" — covered in mobile + responsive image sections.
- "HTTP/2 / HTTP/3" — handled automatically by any modern CDN.

### Merge 2026-11-01 (v2)

- **Source E:** Research Run A (Claude, MODE DISCOVERY, 2026-11-01): Google ranking updates 2025–2026, Google AI-features guide, GSC Generative AI report + control, Gemini 3, OpenAI/Anthropic bot docs, Cloudflare defaults, UCP, Lighthouse 13, num=100, EU AI Act, Bing AI Performance, AIO CTR studies.
- **Source F:** Research Run B (other LLM, MODE BOTH partial, 2026-11-01): Google changelog items (breadcrumbs desktop-only, returnPolicyCountry, loyalty/shipping policy, Event eligibility, VideoObject creator, UGC Fresh Data Program, Preferred Sources, AMP, aggregator units), OpenAI product-feed spec, Bing chronology, 9 audit verdicts.
- **Source G:** Merge verification (T1 fetches 2026-11-01): GA4 AI Assistant channel, Meta-WebIndexer/ExternalFetcher, Perplexity-User, Applebot-Extended, IndexNow participants, robots-meta AI controls, HowTo/Mobile-tool retirements, TTFB/WCAG target size, HSTS, Content Signals, WebMCP Chrome doc, Seer/Ahrefs/Pew originals.
- Decision tables: `seo-geo-merge-decisions-2026-11-01.md`. Parked off-site: `seo-geo-offsite-findings-2026-11-01.md`.
- Not re-verified in this merge (SKIP, text unchanged; P1 items carry `[UNVERIFIED as of 2026-11-01]`): C-00-01, C-02-01/02/05, C-03-02, C-04-01, C-05-01/02/03, C-06-02, C-08-01/02, C-10-01/02/03, C-11-01/02/03/04/05, C-13-01, C-14-02/03/06/08/09/10, C-15-01/03, C-18-06, C-19-01/02, C-20-02, C-24-06/09/10, C-25-01, C-26-05, C-27-03, C-28-01/02, C-32-01/02, C-33-02/05/06/10, C-34-01.

### Merge 2026-11-11 (v3)

- **Source H:** Field checklists from live site builds and SEO/GEO audits (2 lists, ~107 items, 2026-11): redirects/migration, retired items, robots.txt group matching, admin paths, rendering + API fallbacks, animation opacity, fact integrity, page-specific FAQ, Organization/WebSite/Article/Event schema, OG per page, hero video, performance hygiene, accessibility, GSC setup, audit prep, health-data pixels.
- **Source I:** Merge-time T1 checks (2026-11-11): Google robots.txt spec (group matching), redirects doc (301/308 permanent), sitemap build doc (`lastmod` significance), Event doc, Article doc (timezone), site-names doc (WebSite), Discover doc (`max-image-preview:large`), HTTP/network-errors doc (soft 404; homepage-redirect rule NOT in current docs).
- Decision table: `seo-geo-merge-decisions-2026-11-11.md`. Rejected field items: "FAQ rich results limited to government and health sites" (stale — retired for all sites 2026-05-07); "ChatGPT search draws on Bing" as fact (unverified); "security headers = quality signal" as a ranking claim (no Google source).
- P1 defect fixed: §18 robots.txt template group matching (v2 named-bot groups ignored all Disallows).

### Merge 2026-11-11 (v3.1)

- **Source J:** `seo-geo-implementation-kickoff.md` (2026-11-05) — inputs table, operating rules, audit phase, severity scale, fix order, deliverables, reporting → absorbed into the §0 Execution Protocol (mapping: `seo-geo-merge-decisions-2026-11-11.md`, v3.1 section). Kickoff severity `P0–P3` renamed `S1–S4` (phase IDs now use P0–P11). Kickoff fix order (schema before content) changed: schema now follows content because marked-up values must already be visible (§24 hygiene).
- New: site tiers T1–T4, modes BUILD/AUDIT/MAINTAIN, 12 gated phases, item status vocabulary, `seo-geo-status.md` state file; §41 regrouped by phase with tier/gate tags (all v3 items retained verbatim).

### Merge 2026-11-11 (v3.2)

- **Source K:** Red-team run R1 (Perplexity, passes A–H, 25 findings, 6 simulated sites). 24 adopted in full or part, 1 rejected (A-06: quoted §41 text not in v3.1; T1 depth already allows LocalBusiness).
- **Source L:** Merge-time checks (2026-11-11): Google site-names (2025-12-10), sitemap build (2026-07-08), spam policies hidden text (2026-08-28), structured-data policies (2026-07-10), Article (2026-09-08), Event (2026-09-08), Organization (2026-09-08), product variants (2026-09-08), robots.txt matching (2026-10-23), pagination + incremental loading (2025-12-10), Search Status Dashboard March 2026 entries; Protego robots parser tests; JSON-LD parse of all 12 snippets.
- Merge-time findings not in R1: placeholder sentinels missed by the P5 grep; shallow-clone `lastmod` fallback to today's date; unsupported "deprioritize the entire sitemap" claim; URL-mode tools unusable pre-launch; PSI pre-launch; robots group test on sites with no Disallows; duplicate LocalBusiness/Organization entity; Event organizer name/url; §41 missing gated items; §0 "ask when ambiguous" vs infer-and-proceed; Organization placement.
- Decision table + verbatim archive of replaced v3.1 lines: `seo-geo-merge-decisions-2026-11-11.md` (v3.2 section).

### Merge 2026-11-12 (audit pass; restored in v4.3)

- **Source M:** Defect audit of v4.0 (Claude, slice ALL, web on): whole-file read; quotes, dates, thresholds, gates, cross-references and code blocks tested against the owner pages in Source N (gaps listed below); fixes in place. 27 defects fixed in §0, §10, §14, §16, §18, §19, §22, §24, §25, §26, §27, §29, §31, §32, §33, §35, §39, §40, §41. The fixes were first built as a v4.1 that the FT1 merge (v4.1 → v4.2, 2026-11-13) did not descend from; v4.3 re-applied them to v4.2.
- **Source N:** Owner pages re-opened 2026-11-12: Google robots.txt spec (2026-10-23), robots.txt intro (2025-12-10), common crawlers (2026-10-30), user-triggered fetchers (2026-08-19), AI-optimization guide (2026-07-10), robots meta (2026-03-24), sd-policies (2026-07-10), Article / Event / Organization / product-variants / return-policy (2026-09-08), site names (2025-12-10), Search gallery (2026-10-16), build-sitemap (2026-07-08), redirects (2026-04-14), HTTP/network errors (2026-02-04), JavaScript SEO basics (2026-03-04), spam policies (2026-08-28), Search Central changelog (2026 entries), Search Status Dashboard, Search generative AI control help, Search Console property-verification help, GA4 default-channel page + "What's new" + engagement definitions, Merchant Center UCP help; OpenAI bots + commerce feed spec, Anthropic 8896518, Perplexity bots, Meta web crawlers, Apple 119829, Amazon amazonbot, indexnow.org FAQ, hstspreload.org, W3C SC 2.5.8, web.dev vitals + TTFB, Lighthouse 13 post, Chrome WebMCP, Cloudflare Markdown for Agents + 2025-07-01 post, ogp.me, schema.org `author`, Vercel+MERJ study, Seer v3, arXiv 2510.05396.
- Tool tests: JSON-LD parse of all 12 snippets; Protego parse of the §18 template (20 named + 4 unlisted agents × 28 paths, 0 mismatches); §19 git command in a scratch repo.
- Not re-verified in that run (text unchanged): Google 2025 changelog entries; body of the 2026-06 Generative AI report post; Bing Webmaster posts; Preferred Sources doc bodies; Commission Art. 50 guidelines date; CCBot / Bytespider; Profound / Ahrefs / Pew figures; 2025 rows of the Search Status Dashboard.
- Change table + items seen but not merged (new since v4.0): `seo-geo-v4.1-changelog.md` (the 2026-11-12 audit changelog). Replaced lines: §38 (2026-11-12 entries).

### Merge 2026-11-14 (v4.3–v4.4)

- **v4.3:** the 2026-11-12 audit fixes re-applied to v4.2 (v4.1 / v4.2 had been built from v4.0 without them); field test FT2 (own-stack Vercel site, T3): §14 fallback strings, §15 page weight, §24 Event detail, §31 checker-triage rows, §41 items.
- **v4.4:** two severity calibrations from FT2 (EP-1); 12 items seen on 2026-11-12 re-opened 2026-11-14 — merged: Google-Agent, Claude-Agent (UNVERIFIED), Amazon crawl-delay + 24 h, Meta 24 h, max-snippet permission exception, JS-set canonical, site names (no subdirectories), ProductGroup required fields, robots.txt 3xx / 5xx handling, two §40 rows; parked: EU Digital Omnibus (§39 F-15); not adopted: Markdown for Agents under SSL for SaaS.
- **v4.5:** closed two items against primary pages (2026-11-14) — `Claude-Agent` identification (UA token appended to a real browser UA; IP list at `claude.com/.well-known/sail`; robots.txt behavior still not stated), EU AI Act Art. 5 additions (confirmed by multiple independent summaries; §30, §39 F-15, §40); added §39 F-16 (EU Digital Omnibus data part, Council mandate 2026-10-21).
- Decision record + verbatim archive of changed header lines: `seo-geo-merge-decisions-2026-11-14.md`.

### Field test 2026-11-13 (v4.1)

- **Source M:** Field test FT1 — REVIEW-style audit of a live, unaffiliated local-business site on a hosted builder (8 sitemap URLs, all fetched; headless render of 4 templates; 5 Lighthouse lab runs), then cross-checked against 5 single-URL checkers (two SEO checkers with third-party link data, one on-page checker, one GEO auditor, one SEO + GEO checker).
- Result: 23 audit findings; the checkers added 10 observations (4 handbook gaps, 5 audit-process misses, 1 informational) and produced 11 false or misleading results; 12 audit findings were caught by no checker (all sitewide or value-level).
- Changes: REVIEW mode + scoring (EP-2, EP-7); P1 evidence set + reconciliation; platform limits + `LIMITED` status (EP-1); checker rules (§0 Verification rules, §31 Checker triage); URL inventory reconciliation (§17); on-page additions (§2, §6, §7, §8, §10, §14, §15, §18, §24, §25); §29 and §41 items.
- Owner decision: ranking, traffic and backlink data are out of scope for external reviews (EP-7).
- Decision record: `seo-geo-merge-decisions-2026-11-13.md`.
- **Source N (v4.2):** Semrush Site Audit (trial; 12 URLs crawled from links; Site Health 94%, AI Search Health 79%) on the FT1 site. New: third-party gift-card link 403 to bot user agents; services price list in div markup; a linked duplicate bio page missing a meta description and reachable by one internal link. Handbook changes: §12, §14, §17, §31, §41.
- Note (v4.6): Source IDs M and N in the "Field test 2026-11-13 (v4.1)" block above repeat the IDs of the "Merge 2026-11-12" block; read them as Source O (FT1) and Source P (Semrush Site Audit). Lines left as written.

### Merge 2026-11-14 (v4.6 — desk gap fill)

- **Source Q:** Desk review of v4.5 (Claude, 2026-11-14; whole-file read): 10 ranked gaps + smaller defects. Owner instruction: fill the gaps. The v4.5 rule "new checks enter from field tests, not from inference" is set aside for this merge only; every addition is tagged and listed in part E2 below as a field-test target.
- **Source R:** Owner pages opened 2026-11-14 (through a summarising fetch / search tool): Google review-snippet doc, Local business doc, Organization doc, spam policies (2026-08-28), Search Central changelog (2022-08 and 2023-08 local-business entries), Google Business Profile guidelines (service-area businesses), web.dev INP / TBT / vitals-measurement articles, Chrome Lighthouse TBT doc, GA4 Help (enhanced measurement events, recommended events, cross-domain measurement, BigQuery Export), Firebase Help (BigQuery link), DuckDuckGo DuckAssistBot help page, Mistral crawler doc, OpenAI Help "ChatGPT search", Forge AI Bot Log study (2026-09-24).
- Changes: source check (§0 EP-1, §4–§6, §29); keyword → URL map + cannibalization (§1); page-type matrix, blueprints, local-business pages (§7, §8, §9, §24); per-engine facts (§16); AI answer panel + key events + session-recording guard (§27); INP proxy + CSP rollout + 2026 JS log study (§14); Mistral / DuckDuckGo tokens (§18); `@graph` example + shipping pointer (§24); §33 "Set up at launch"; watchlist F-17 – F-19 (§39); gates P1, P4, P5, P7, P8, P10, P11; EP-7 comparability + repeatability; §41 items. §34, §38, §40 and the version history moved to this file.
- Not applied: severity-weighted EP-7 scoring (changes existing grades; needs repeatability data); generating §29 / §32 / §41 from tagged body lines (needs a build step) — `handbook_lint.py` checks cross-references instead; field tests (part E1).
- Decision record: `seo-geo-merge-decisions-2026-11-14-v4.6.md`.

---

## 38. Retired Guidance (do NOT implement — kept for traceability)

Format: `<original line> — <verdict> <date> — <reason> — <source>`

- "Test via GSC Mobile Usability report." (§14) — DEPRECATED 2026-11-01 — Report, Mobile-Friendly Test and API retired 2023-12-01 — https://developers.google.com/search/blog/2016/05/a-new-mobile-friendly-testing-tool (Google page marked "retired"; "As of December 1, 2023, both the test and the usability report have been retired"); April-2023 announcement https://developers.google.com/search/blog/2023/04/page-experience-in-search (body not rendered in merge; Google text quoted via Search Engine Land 2023-12-04)
- "5. Check Coverage + Mobile Usability + Core Web Vitals reports." (§26) — DEPRECATED 2026-11-01 — Coverage renamed "Page indexing"; Mobile Usability retired 2023-12-01 — https://support.google.com/webmasters/answer/7440203
- "Use GSC URL Inspection live test + Mobile-Friendly Test render comparison" (§33 JS forensics) — DEPRECATED 2026-11-01 — Mobile-Friendly Test retired 2023-12-01; use URL Inspection "View tested page" — https://support.google.com/webmasters/answer/9012289
- "**Eligibility note (August 2023 restriction):** Google restricted FAQ rich results to 'well-known, authoritative government and health websites' only … expect FAQ rich snippets in Google SERPs only on government/health domains." (§24) — DEPRECATED 2026-11-01 — FAQ rich results stopped for all sites 2026-05-07 — https://developers.google.com/search/updates (2026-05-08, 2026-06-15)
- "the schema remains valuable for AI Overviews, AI synthesizers (ChatGPT, Perplexity, Claude)" (§24 FAQPage) — UPDATE→UNVERIFIED 2026-11-01 — Google: structured data not required for generative AI features; other vendors undocumented — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- "**Eligibility note (September 2023 restriction):** Google removed HowTo rich results from desktop search entirely; mobile rich results restricted." (§24) — REFUTED 2026-11-01 — HowTo removed on both desktop and mobile 2023-09-14 — https://developers.google.com/search/updates (2023-09-14 entries)
- "**Answer capsules <40 words** for AI Overview eligibility; under 60 words still works." (§16) — REFUTED 2026-11-01 — No documented length threshold; Google: no requirement to break content into pieces — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- "**Query fan-out coverage.** AI Mode (Gemini 2.5) breaks one query into up to 16 sub-queries." (§16) — REFUTED 2026-11-01 — Gemini 3 is AIO default since 2026-01-27; no sub-query count documented — https://blog.google/products-and-platforms/products/search/ai-mode-ai-overviews-updates/ ; ai-optimization-guide
- "`[SPEC]` Google AI Overviews powered by BlockRank algorithm (Google DeepMind, Nov 2024); query fan-out up to 16 parallel sub-queries" (§32) — UPDATE (tag) 2026-11-01 — Research paper ≠ Google doc; count unsupported — same sources
- "**Schema reinforcement.** FAQPage and HowTo schema correlate with AI Overview citation; Article and Person schema reinforce E-E-A-T signals AI synthesizers weigh heavily." (§16) — REFUTED (as stated) 2026-11-01 — FAQ/HowTo rich results retired; Google: no special markup needed for AI features; correlation unverified — ai-optimization-guide; updates 2026-05-08
- "**No reliance on AI Overview alone.** Page must rank in classic results to be eligible for AI Overview citation" (§16) — UPDATE 2026-11-01 — Google states indexed + snippet-eligible + Included in Search generative AI control; no ranking precondition stated — ai-optimization-guide
- "Blocking these opts out of AI training without affecting Search." (§18 Google-Extended/Applebot-Extended note) — UPDATE 2026-11-01 — Google-Extended also governs grounding; does not remove pages from AI Overviews / AI Mode — https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers ; https://support.google.com/webmasters/answer/16908024
- "5. **Why it still matters:** ChatGPT Search historically pulled from Bing's index … OpenAI is transitioning to its own search index in 2025-2026 … Bing Webmaster Tools also provides the only AI Performance Report" (§26) — UPDATE 2026-11-01 — OpenAI documents OAI-SearchBot; GSC Generative AI report exists; "only" false; Bing report dates to 2026-02-10 — https://developers.openai.com/api/docs/bots ; https://blogs.bing.com/webmaster/ ; https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports
- "**Bing Webmaster Tools AI Performance Report** — New report (rolled out 2024-2025)" (§33) — REFUTED (date) 2026-11-01 — Public preview 2026-02-10 — https://blogs.bing.com/webmaster/
- "GA4 default channel grouping does not categorize AI tools as 'AI.' Manual setup required." (§27) — DEPRECATED 2026-11-01 — Native "AI Assistant" default channel since 2026-05-13 — https://support.google.com/analytics/answer/9756891
- "§20-22 llms.txt + .md strategy" in the universal baseline (§0) — REFUTED (as universal Google SEO) 2026-11-01 — Google: no effect on visibility/rankings; no other consumer verified — https://developers.google.com/search/updates (2026-06-15)
- "§24 schemas: … FAQPage …" in the universal baseline (§0) — DEPRECATED 2026-11-01 — FAQ rich results retired 2026-05-07 — https://developers.google.com/search/updates
- "- Depth under 1,500 nodes." (§14) / "`[HEURISTIC]` DOM depth: <1,500 nodes." (§32) — UPDATE 2026-11-01 — Lighthouse 13 insight; no published threshold; node count ≠ depth — https://developer.chrome.com/blog/lighthouse-13-0
- "- TTFB < 500ms." (§14) / "`[SPEC]` TTFB: <500ms." (§32) — UPDATE 2026-11-01 — Not a Core Web Vital; web.dev guidance ≤ 0.8 s — https://web.dev/articles/ttfb
- "- Tap targets ≥ 48×48 px" (§14) / "`[SPEC]` Tap target size: ≥ 48×48 px." (§32) — UPDATE (tag) 2026-11-01 — WCAG 2.2 SC 2.5.8 AA minimum is 24×24 CSS px; 48 px is platform guidance — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- "`[SPEC]` AI crawlers … do NOT execute JavaScript. Verified by Vercel+MERJ analysis" (§14, §32) — UPDATE (tag) 2026-11-01 — Vendor study (T4) → [STUDY]; 2024 data — handbook's own attribution
- "External backlink exact-match safe zone: 5-10% (Penguin algorithm)" tagged `[SPEC]` (§32) — UPDATE (tag) 2026-11-01 — No Google document specifies a percentage → [HEURISTIC] — n/a
- "4. Single ping submits to Bing, Yandex, Seznam simultaneously." (§26) — UPDATE 2026-11-01 — Participants now Amazon, Bing, Naver, Seznam.cz, Yandex, Yep — https://www.indexnow.org/faq
- "Check GSC Coverage report …" (§17, §28) — UPDATE 2026-11-01 — Renamed "Page indexing report" — https://support.google.com/webmasters/answer/7440203
- `loading="lazy"` on the LCP-critical `<img>` example (§15) — UPDATE 2026-11-01 — Lazy-loading above-the-fold images is a pattern to avoid — https://web.dev/articles/lcp-lazy-loading
- "Cloudflare AI Audit dashboard … Cloudflare AI marketplace" (§33) — UPDATE 2026-11-01 — Product now AI Crawl Control; monetization = pay per crawl — https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ ; https://blog.cloudflare.com/content-independence-day-no-ai-crawl-without-compensation/

- §18 robots.txt template structure (v2): each named bot in its own `Allow: /`-only group, Disallows only under `User-agent: *` — REFUTED 2026-11-11 — named groups and `*` are not combined, so named bots ignored every Disallow — https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec (full v2 block preserved in `seo-geo-merge-decisions-2026-11-11.md`)
- `Disallow: /admin/` in the §18 template — UPDATE 2026-11-11 — conflicts with the `X-Robots-Tag: noindex` + auth pattern for admin paths; robots.txt also advertises the path — §18 Admin / staff paths
- "Always 301 (permanent) for URL changes — passes equity." (§10) / "Pick trailing-slash convention; 301 the other." (§2) — UPDATE 2026-11-11 — 308 is equally permanent for Google; lines kept and extended in place — https://developers.google.com/search/docs/crawling-indexing/301-redirects
- "If the user has not filled in the Site Profile, stop and ask before proceeding. Do not infer answers from the project context." (§0) — UPDATE 2026-11-11 (v3.1) — LLM infers the profile with evidence + confidence (Execution Protocol P0); kickoff doc had already overridden it — owner instruction
- Article example `"datePublished": "2024-08-15"`, `"dateModified": "2026-05-01"` (§24) — UPDATE 2026-11-11 — Google recommends timezone; date-only triggered RRT warnings in field audits — https://developers.google.com/search/docs/appearance/structured-data/article
- "Choose ONE: auth + `X-Robots-Tag: noindex` (default, no Disallow) OR Disallow only." (§18 Admin / staff paths) — REFUTED (as worded) 2026-11-11 (v3.2) — read as permitting robots-only protection; authentication is mandatory; noindex vs Disallow is a separate choice — §18, §29 (robots.txt is not a security boundary)
- "Canonical … all use the identical URL form: protocol, host, trailing slash, case, no parameters." (§10) — UPDATE 2026-11-11 (v3.2) — conflicted with self-canonical pagination, indexable facets and Google's variant-URL rules — https://developers.google.com/search/docs/appearance/structured-data/product-variants
- "Pages hidden from Search: `noindex` AND excluded from the sitemap AND not linked from content/nav." (§10) / "No links … to admin, staff, hidden or `noindex` pages." (§12) / "Public links to admin, staff, hidden or `noindex` pages." (§29) / "Hidden pages: noindex + out of sitemap + unlinked" (§41) — UPDATE 2026-11-11 (v3.2) — would remove cart/checkout/account/search links; noindex ≠ unnavigable — red-team R1 B-04
- "Use the sr-only pattern (see §11) when content must be DOM-present but visually hidden." (§0) / "If visually hidden for UX, use the sr-only pattern (DOM-present, accessible, crawler-visible)" (§11) — REFUTED 2026-11-11 (v3.2) — Google exempts screen-reader text only when it improves the screen-reader experience; hiding crawler-targeted links is search-only hidden content; focusable invisible links fail WCAG 2.4.7 — https://developers.google.com/search/docs/essentials/spam-policies
- "`display:none`, `visibility:hidden`, and `<noscript>` … read as cloaking by modern crawlers and third-party SEO checkers" (§0, §11) [UNVERIFIED] — UPDATE 2026-11-11 (v3.2) — Google judges hidden text by purpose; accordions/tabs/tooltips are not violations — same source
- "Inaccurate `<lastmod>` causes Google to deprioritize the entire sitemap." (§19) — REFUTED (no T1 basis) 2026-11-11 (v3.2) — Google: lastmod used only if consistently and verifiably accurate; no whole-sitemap penalty stated — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- "If git history is empty (initial commit, shallow clone in CI), fall back to today's date." (§19) — REFUTED 2026-11-11 (v3.2) — recreates build-time stamping on every shallow-clone build — same source
- "`<lastmod>` varies by URL" (P3 gate) / "confirm `<lastmod>` values vary by URL" (§19) — UPDATE 2026-11-11 (v3.2) — truthful equal values are valid (one-URL site, launch batch); accuracy, not variation — same source
- "`aggregateRating` declared with no visible rating widget → fails Rich Results Test." / "`Product.review` … → fails Google's product schema audit." (§24) — REFUTED 2026-11-11 (v3.2) — quality guidelines are not automatically testable; RRT won't flag — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- "render the value visibly in the DOM OR omit the schema property. Holds for every property without exception." (§24) — UPDATE 2026-11-11 (v3.2) — scoped to user-facing facts; technical/identity properties exempt — same source
- "Rich Results Test (URL mode) per template, 0 errors; one Organization definition sitewide; … every marked-up value visible; dates carry timezone." (P6 gate) / "Schema validates in Google Rich Results Test (URL test mode)." (Definition of done #4) — UPDATE 2026-11-11 (v3.2) — RRT doesn't support site names; date-only Event values valid; org identity per page graph — https://developers.google.com/search/docs/appearance/site-names
- "Define it once with a stable `@id`; every other page/node references it by `@id` … Never emit a second Organization node per page." + heading "Organization (site-wide)" (§24) — UPDATE 2026-11-11 (v3.2) — Google: home or About page, not every page; no documented cross-page `@id` resolution — https://developers.google.com/search/docs/appearance/structured-data/organization
- "Discontinued: 301 redirect to category page or similar product …" (§28) / "`Discontinued` — permanently discontinued, consider 301." (§24) — UPDATE 2026-11-11 (v3.2) — category redirects conflict with §10 Retired items (soft-404 risk) — §10
- "Overlaps start of March core update — separate the two" (§35, March 2026 spam update) — REFUTED 2026-11-11 (v3.2) — spam 2026-03-24 → 03-25; core began 2026-03-27 — https://status.search.google.com/summary
- "Batch all questions once in P0" (EP-1); "every OPEN item has PASS or a finding" (P1 gate); "citation bots get 200 + full HTML (verified via logs/IP files …)" (P9 gate); "every claim has a visible source + date" (P5 gate); "one H1" (P4) — UPDATE 2026-11-11 (v3.2) — late-approval queue; status vocabulary; pre-launch bot logs DEFERRED; claim classes; H1 heuristic per §2 — red-team R1 A-02, A-05, A-04, G-01, B-06
- `Disallow: /account/`, `/cart/`, `/checkout/`, `/*?sort=`, `/*?filter=` as the complete template set (§18) — UPDATE 2026-11-11 (v3.2) — prefix matching left `/cart`, `/cart?x`, `?a=1&sort=` crawlable (parser-tested) — https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
- "Release-blocking until resolved or waived by the owner in writing" (EP-1, all classes) — UPDATE 2026-11-12 (v3.3) — missing authentication, unreviewed sensitive-data flows and fabricated facts are not waivable; waivers cover SEO/performance/content trade-offs only — red-team R2 R-01
- "Missing `<lastmod>` in sitemap." (§29) — REFUTED 2026-11-12 (v3.3) — contradicted §19 omission when provenance is unknown; Google uses lastmod only if accurate — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- "≤1 Organization node per page graph" / "single Organization `@id`" (P6, §41) — UPDATE 2026-11-12 (v3.3) — a global cap forces merging distinct organizations; rule is per real organization — §24 Organization identity
- "If UX requires collapsible UI, mirror the same content elsewhere on the page in always-visible HTML." (§14) — UPDATE 2026-11-12 (v3.3) — conflicted with the v3.2 hidden-content rule; initial-HTML accordions are acceptable — https://developers.google.com/search/docs/essentials/spam-policies
- "third-party scripts after load/interaction/consent" (P7) / "after load, first interaction or consent" (§14) — UPDATE 2026-11-12 (v3.3) — alternatives let a performance trigger substitute for consent; authorization first, then scheduling — §14 Cookie consent
- "High-priority pages: update every 30 days. General content: 90 days maximum gap. Updates inject net-new data." (§28) — UPDATE 2026-11-12 (v3.3) — forced rewrites of accurate content; intervals are review deadlines — red-team R2 E-02
- "Monitor 404s; 301-redirect any 404s with prior traffic." (§28) — UPDATE 2026-11-12 (v3.3) — traffic alone is not redirect equivalence; conflicts with §10 Retired items and §29 — §10
- "Contact page: address + `tel:` phone, server-rendered" (§7, §41) — UPDATE 2026-11-12 (v3.3) — assumed publishable address/phone and a separate page; conflicts with never-fabricate and T1 scope — red-team R2 B-02
- "§10 canonical tags + status codes (skip "Redirect rules" subsection if pre-launch)" (§0) — UPDATE 2026-11-12 (audit, v4.3) — conflicted with P3 and the §41 [T1+] one-hop 301/308 host / protocol / trailing-slash items, which rest on §10 Redirect rules — §0 P3, §41
- "§24 schemas: Organization, Article, BreadcrumbList, Person" in the universal baseline (§0) — UPDATE 2026-11-12 (audit, v4.3) — WebSite omitted although EP-3 T1 depth and the §41 [T1+] WebSite item require it — §0 EP-3, §41
- "sitemap.xml domain = canonical domain in HTML = `Sitemap:` URL in robots.txt" (§0 Definition of done #6) / "sitemap host = canonical host = robots `Sitemap:` host" (§41) — UPDATE 2026-11-12 (audit, v4.3) — contradicted §17: cross-site sitemaps are valid; a differing sitemap host must not fail validation — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- "LCP < 2.5s mobile." / "INP < 200ms" / "CLS < 0.1." (§14); "LCP: <2.5s mobile (good)" / "INP: <200ms (good)" / "CLS: <0.1 (good)" (§32); "LCP < 2.5 s, CLS < 0.1" (P7 gate, §41) — UPDATE 2026-11-12 (audit, v4.3) — "good" thresholds are inclusive (2.5 s / 200 ms / 0.1 or less) and identical on mobile and desktop — https://web.dev/articles/vitals
- "Claude-SearchBot" in the crawler list of the Vercel+MERJ no-JavaScript finding (§14, §32) — REFUTED 2026-11-12 (audit, v4.3) — not named in the study (list: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Meta-ExternalAgent, Bytespider, PerplexityBot) — https://vercel.com/blog/the-rise-of-the-ai-crawler
- "Google: "If there's a possibility that you do want the page indexed, don't use a noindex tag in the original page code" (2025-12-15)" (§14) — UPDATE (quote) 2026-11-12 (audit, v4.3) — wording not found on the page; restated as a paraphrase — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- "Only Googlebot fully renders JavaScript" (§14) — UPDATE 2026-11-12 (audit, v4.3) — Apple documents that Applebot may render pages in a browser; the Vercel+MERJ study reports the same — https://support.apple.com/en-us/119829
- "BlockRank algorithm (Google DeepMind, Nov 2024)" (§16) / "BlockRank (Google DeepMind research paper, Nov 2024)" (§32) — REFUTED (date) 2026-11-12 (audit, v4.3) — the paper is arXiv 2510.05396, Oct 2025 (UT Austin, Google, Google DeepMind) — https://arxiv.org/abs/2510.05396
- "Anthropic doc 2026-04-07" / "current doc (2026-04-07)" (§18 template comments, bot table) — UPDATE (date) 2026-11-12 (audit, v4.3) — the article now carries a statement effective 2026-10-30 and shows no calendar date; claims re-checked against the page as fetched — Anthropic support article 8896518
- IP range file "—" for `Amazonbot`, `Amzn-SearchBot`, `Amzn-User` (§18 bot table) — UPDATE 2026-11-12 (audit, v4.3) — Amazon publishes an IP list per agent — https://developer.amazon.com/amazonbot
- `git log -1 --format=%cs --invert-grep --grep='^\(style\|chore\|deps\|format\|ci\|build\|refactor\)' -- <source-files>` + "tested 2026-11-12: skips a later `style:` commit" (§19) — REFUTED (regex) 2026-11-12 (audit, v4.3) — unanchored prefixes also dropped content commits such as `cities: …` or `citations: …` (`^ci` matched) and returned an older date; replaced by a pattern that requires the `type(scope)!:` delimiter — scratch-repo test
- "per-zone opt-in via AI Crawl Control; … doc updated 2026-10-09" (§22) / "Cloudflare AI Crawl Control | … Markdown for Agents (Pro+)" (§31) — UPDATE 2026-11-12 (audit, v4.3) — Cloudflare doc (updated 2026-11-09) places the toggle under Agent Readiness → Markdown for Agents — https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
- "Google's documented rule: "marked-up content must be visible to users."" (§24) — UPDATE (quote) 2026-11-12 (audit, v4.3) — that wording is not on the page; the verbatim rule stays quoted in the §24 Rule line — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- "`authoredBy`" in the relationship-property list (§25) — REFUTED 2026-11-12 (audit, v4.3) — not a schema.org property; the property is `author` — https://schema.org/author
- "3. Verify via DNS TXT record (preferred) or HTML meta tag." (§26) — UPDATE 2026-11-12 (audit, v4.3) — a Domain property (step 2) verifies by DNS record only; the HTML tag applies to URL-prefix properties — Search Console Help (add a website property)
- "sources the default misses (Perplexity, Claude, …)" (§27) / "(Perplexity, Claude not named by Google)" (§39 F-08) — UPDATE 2026-11-12 (audit, v4.3) — GA4 "What's new" (2026-05-13) names Claude; only the channel-definition page omits it — https://support.google.com/analytics/answer/9164320
- "`[SPEC]` og:image dimensions: 1200×630 px minimum, ≤5MB (Open Graph spec). (Attribution of the dimension rule to the OG protocol vs platform docs not re-verified 2026-11-01.)" (§32) — UPDATE (tag) 2026-11-12 (audit, v4.3) — ogp.me defines `og:image:width` / `og:image:height` but no size rule → [HEURISTIC] — https://ogp.me/
- "`[SPEC]` No documented internal anchor-text over-optimization penalty (Google confirmed — statement, not doc)" (§32) — UPDATE (tag) 2026-11-12 (audit, v4.3) — [SPEC] needs a formal spec or official doc; a public statement does not qualify → [HEURISTIC] — handbook tag definition (§0, §32)
- "Featured Snippet definition answer: 40-60 words / 120-150 chars." (§32) — UPDATE 2026-11-12 (audit, v4.3) — "120-150 chars" contradicts the word range (40-60 words ≈ 250-350 characters) and has no source; word range kept — §16
- "targets "many pages generated for the primary purpose of manipulating search rankings and not helping users"" (§33 Programmatic SEO) — UPDATE (quote) 2026-11-12 (audit, v4.3) — not verbatim; paraphrased, verbatim quote kept in §6 — https://developers.google.com/search/docs/essentials/spam-policies
- "Google expanded Discover guidance 2026-02-05 (preferred image: schema.org `image` / `og:image`)" (§35) — UPDATE (date) 2026-11-12 (audit, v4.3) — the preferred-image guidance is the 2026-03-02 changelog entry (§2, §40) — https://developers.google.com/search/updates
- "robots meta note (nosnippet/max-snippet ↔ AI features)" (§40, 2026-03-24) — REFUTED 2026-11-12 (audit, v4.3) — the 2026-03-24 note states that meta robots tags in the `<body>` are respected; the nosnippet / max-snippet ↔ AI-feature wording dates from 2025-03-05 — https://developers.google.com/search/updates
- "(date via S; definition T1)" (§40, 2026-05-13) — UPDATE 2026-11-12 (audit, v4.3) — the date is T1: GA4 Help "What's new" entry of 2026-05-13 — https://support.google.com/analytics/answer/9164320
- "[T3+] Evergreen archive content on own domain (§10)" (§41) — UPDATE 2026-11-12 (audit, v4.3) — the governing subsection (§10 Site migration) is gated to existing sites; tagged [AUDIT] — §10
- "`S1` blocks crawl/index/render (robots group bug, unintended noindex, JS-only content, …)" (§0 EP-1 severity) — UPDATE 2026-11-14 (v4.4) — the S1 definition is "blocks crawl/index/render": a group bug that only over-allows blocks nothing (FT2 graded it S2 by that definition), and JS-only content that server HTML carries elsewhere on the site is not a total loss of that content (FT2: home calendar duplicated in server-rendered `/events`); unique primary content missing from server HTML stays S1 — FT2 audit F01 / F03
- "`[UNVERIFIED as of 2026-11-14]` — robots.txt behavior not checked; treat as user-triggered (control at WAF/CDN) | Not checked" (§18 `Claude-Agent` row) — UPDATE 2026-11-14 (v4.5) — Anthropic's hosted-browser identification article opened: UA token + IP list stated; robots.txt behavior still not stated, so the UNVERIFIED tag stays on that part only — https://support.claude.com/en/articles/18234133-how-do-anthropic-hosted-browsers-identify-themselves-when-they-browse-the-web-on-a-user-s-behalf
- "UNVERIFIED (T4 legal summaries, seen 2026-11-12; not re-opened)" (§39 F-15) — UPDATE 2026-11-14 (v4.5) — re-opened: ≥3 independent legal summaries agree on Art. 5(1)(ba)/(bb) applying from 2026-12-02; Official Journal text still not opened (T4) — https://www.paulweiss.com/insights/client-memos/next-stop-on-the-digital-omnibus-ai-act-reforms-and-new-commission-guidance
- "(do NOT implement; kept for traceability)" / "§40 Platform Change Timeline (reference only)." (§0) — UPDATE 2026-11-14 (v4.6) — §34, §38 and §40 moved out of the implementing file (history is ~16% of v4.5; refuted wording sat beside live rules) — desk review 2026-11-14, gap 9
- "(all subsections)" (§0) — UPDATE 2026-11-14 (v4.6) — §33 mixed deferred bets with launch-time setup that cannot be recovered later — desk review 2026-11-14, gap 10
- "Never implement §33 (deferred), §38 (retired), §39 (watchlist). §35, §40 = reference only." (§0 EP-1) — UPDATE 2026-11-14 (v4.6) — archive split + §33 launch list — desk review 2026-11-14, gaps 9 + 10
- "ratings, reviews, credentials, author bios, sameAs URLs, stats." (§0 EP-1) — UPDATE 2026-11-14 (v4.6) — list omitted quotes, studies and citations while §4 / §5 told the implementer to produce them — desk review 2026-11-14, gap 3
- "Bing AI Performance; GA4 AI Assistant channel." (§0 P1) — UPDATE 2026-11-14 (v4.6) — baseline had no read of assistant answers outside Google and Bing — desk review 2026-11-14, gap 5
- "canonical tag; breadcrumbs; visible last-updated; OG/Twitter" (§0 P4) — UPDATE 2026-11-14 (v4.6) — article elements were required on every template — desk review 2026-11-14, gap 6
- "intent/keyword map (T2+; needs GSC or tool data)" (§0 P5) — UPDATE 2026-11-14 (v4.6) — §1 had no procedure or output format — desk review 2026-11-14, gap 4
- "CLS ≤ 0.1; CrUX field data when available;" (§0 P7) — UPDATE 2026-11-14 (v4.6) — INP had no gate; sites without CrUX data were never checked for responsiveness — desk review 2026-11-14, gap 8; web.dev + Lighthouse TBT docs
- "every §14 security header present;" (§0 P8) — UPDATE 2026-11-14 (v4.6) — presence-only gate; no CSP build rule — desk review 2026-11-14, gap 8
- "GA4 receives hits after consent." (§0 P10) — UPDATE 2026-11-14 (v4.6) — gate passed with no conversion tracked — desk review 2026-11-14, gap 8
- "(GSC Performance + Generative AI, Bing AI Performance, GA4 AI channel);" (§0 P11) — UPDATE 2026-11-14 (v4.6) — re-baseline set extended — desk review 2026-11-14, gaps 2 + 5
- "unresolved platform-doc conflicts |" (§0 EP-5) — UPDATE 2026-11-14 (v4.6) — new P11 outputs — desk review 2026-11-14, gaps 2 + 5
- "handbook: 4.5 |" (§0 EP-5) — UPDATE 2026-11-14 (v4.6) — version bump — —
- "- H1 → H2 → H3 only. No H4+. No skipped levels." (§3) — UPDATE 2026-11-14 (v4.6) — no source for a depth cap; the P1 evidence set already audits H1–H6 — desk review 2026-11-14
- "Bytespider, Amazonbot, Meta-ExternalAgent)" (§29) — UPDATE 2026-11-14 (v4.6) — training-bot list extended (Mistral crawler doc) — https://docs.mistral.ai/robots
- "(Google 2026-06-15: no effect)" (§29) — UPDATE 2026-11-14 (v4.6) — same claim was dated 2026-06-15 here and 2026-07-10 in §20 / §23; both sources now named — §20, §40
- "Google ignores llms.txt entirely (2026-06-15)." (§33) — UPDATE 2026-11-14 (v4.6) — same claim was dated 2026-06-15 here and 2026-07-10 in §20 / §23; both sources now named — §20, §40
- "- [ ] [T2+] Intent/keyword map for priority pages (§1)" (§41 P5) — UPDATE 2026-11-14 (v4.6) — item had no pass criterion — desk review 2026-11-14, gap 4
- "CrUX when available (§14, §32)" (§41 P7) — UPDATE 2026-11-14 (v4.6) — INP had no checklist item — desk review 2026-11-14, gap 8
- "(HSTS `max-age` > 0);" (§41 P8) — UPDATE 2026-11-14 (v4.6) — CSP was presence-only — desk review 2026-11-14, gap 8
- "GA4 AI channel (§26, §27)" (§41 P11) — UPDATE 2026-11-14 (v4.6) — re-baseline set extended — desk review 2026-11-14, gaps 2 + 5

---

## 40. Platform Change Timeline 2025-01 → 2026-11 (reference)

All entries verified against the cited T1 record on 2026-11-01 unless marked S/T4. Ranking updates are in §35.

| Date                 | Platform         | Event                                                                                                                                                                                                | §             |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 2025-01-15           | Google           | Review guidance: recommends ratings accompanied by a review comment and author name; not required for every rating (apply the feature's current required-property table). Entry date not re-verified | §24           |
| 2025-01-22           | Google           | Breadcrumb rich results desktop-only                                                                                                                                                                 | §24           |
| 2025-03-05           | Google           | AI Mode added to robots meta tag docs (preview controls apply)                                                                                                                                       | §16           |
| 2025-03-14           | Google           | `returnPolicyCountry` added to return-policy examples (changelog: "required"; current doc 2026-09-08 lists it as recommended — see §24)                                                              | §24           |
| 2025-03-18           | Bing             | Copilot in Bing Webmaster Tools for all users                                                                                                                                                        | §26           |
| 2025-04-25           | Google           | Google-Extended description updated                                                                                                                                                                  | §18           |
| 2025-05-19           | Bing             | IndexNow for Shopping/Ads; IndexNow discovery post                                                                                                                                                   | §26           |
| 2025-05-21           | Google           | AI features + generative-AI content docs added                                                                                                                                                       | §6, §16       |
| 2025-06-05           | Google           | Event markup: publicly bookable, physical-location events                                                                                                                                            | §24           |
| 2025-06-10 / 17      | Google           | Loyalty program markup docs; return policy own page; availability by country                                                                                                                         | §24           |
| 2025-06-12           | Google           | 7 structured-data features to be phased out (Book actions later reversed)                                                                                                                            | §24           |
| 2025-06-16           | Google           | AI Mode counted in Search Console Performance totals                                                                                                                                                 | §27           |
| 2025-07-01           | Cloudflare       | Default-block AI crawlers; pay per crawl private beta                                                                                                                                                | §18           |
| 2025-07-11           | Google           | Return policy / loyalty: org-level vs offer-level clarified                                                                                                                                          | §24           |
| 2025-08-04           | Cloudflare       | Perplexity stealth-crawling report; delisted as verified bot (disputed)                                                                                                                              | §18           |
| 2025-09-08 / 09      | Google           | GSC + docs removal for 6 retired types; API support to 2025-12                                                                                                                                       | §24           |
| 2025-09-12           | Google           | `&num=100` stops working (S)                                                                                                                                                                         | §27           |
| 2025-09              | Cloudflare       | Content Signals Policy (S + Cloudflare docs)                                                                                                                                                         | §18           |
| 2025-10-09           | Google           | Google-NotebookLM user-triggered fetcher added                                                                                                                                                       | §18           |
| 2025-10-10           | Chrome           | Lighthouse 13: `dom-size` → insight; legacy audits removed                                                                                                                                           | §14           |
| 2025-10-15           | Bing             | `data-nosnippet` support                                                                                                                                                                             | §16           |
| 2025-11-03           | Google           | Google-CWS fetcher added                                                                                                                                                                             | §18           |
| 2025-11-05           | Google           | Practice problem phase-out; Dataset = Dataset Search; Book actions retained                                                                                                                          | §24           |
| 2025-11-12           | Google           | Merchant shipping policy markup; Google-Pinpoint fetcher; review nesting clarified                                                                                                                   | §24, §18      |
| 2025-11-20           | Google           | Crawler docs migrated to developers.google.com/crawling                                                                                                                                              | §18           |
| 2025-12-09           | Google           | Smaller ongoing core updates documented                                                                                                                                                              | §28, §35      |
| 2025-12-15 / 17 / 18 | Google           | JS: no initial `noindex`; canonical consistency; non-200 may not render                                                                                                                              | §10, §14, §17 |
| 2026-01-06           | Google           | Practice problem docs removed                                                                                                                                                                        | §24           |
| 2026-01-11           | Google           | Universal Commerce Protocol launched (checkout in AI Mode + Gemini)                                                                                                                                  | §36           |
| 2026-01-27           | Google           | Gemini 3 default model for AI Overviews globally                                                                                                                                                     | §16           |
| 2026-01-30           | Google           | Preferred Sources documentation launched                                                                                                                                                             | §37           |
| 2026-02-05           | Google           | Discover guidance expanded alongside Discover core update                                                                                                                                            | §35           |
| 2026-02-10           | Bing             | AI Performance report public preview                                                                                                                                                                 | §26           |
| 2026-02              | Cloudflare       | Markdown for Agents (`Accept: text/markdown`)                                                                                                                                                        | §22           |
| 2026-03-02           | Google           | Preferred image: schema.org `image` + `og:image` as thumbnail sources                                                                                                                                | §2, §15       |
| 2026-03-24           | Google           | Discussion Forum / QA Page properties; robots meta note (meta robots tags in the `<body>` are respected)                                                                                             | §16, §24      |
| 2026-04-13           | Google           | Back button hijacking spam policy                                                                                                                                                                    | §29           |
| 2026-04-14 / 23      | Google           | Spam reports may trigger manual action; criteria clarified                                                                                                                                           | §29           |
| 2026-04-30           | Google           | Preferred Sources in all Search languages                                                                                                                                                            | §37           |
| 2026-05-07 / 08      | Google           | FAQ rich results stop appearing (notice 05-08)                                                                                                                                                       | §24           |
| 2026-05-13           | Google Analytics | Native "AI Assistant" default channel (date: GA4 Help "What's new"; definition: default-channel page — both T1)                                                                                      | §27           |
| 2026-05-15           | Google           | Generative-AI optimization guide; spam policies cover generative AI responses                                                                                                                        | §16, §29      |
| 2026-05-18           | Chrome           | WebMCP docs published (origin trial from Chrome 149)                                                                                                                                                 | §39           |
| 2026-05-20           | Google           | `hasAdultConsideration` for Product                                                                                                                                                                  | §24           |
| 2026-05-27           | Google           | Preferred Sources rolling out to AI Overviews + AI Mode                                                                                                                                              | §37           |
| 2026-06-03           | Google           | GSC Generative AI performance reports (Search, Discover) + Search generative AI control (UK subset first)                                                                                            | §16, §27      |
| 2026-06-05           | Google           | Guidance on third-party SEO tools                                                                                                                                                                    | §31           |
| 2026-06-12           | IETF             | `draft-car-ai-txt-wellknown-00` (ai.txt Independent Submission)                                                                                                                                      | §23           |
| 2026-06-15           | Google           | llms.txt: no effect on Google visibility/rankings; FAQ docs removed                                                                                                                                  | §20, §24      |
| 2026-07-01           | Google           | AMP: users sent to publisher AMP host; Cache/SXG unneeded                                                                                                                                            | §14           |
| 2026-07-07           | Google           | `Product.category`; sale-price validity dates                                                                                                                                                        | §24           |
| 2026-07-10           | Google           | Canonicalization troubleshooting: re-evaluation timing                                                                                                                                               | §10           |
| 2026-07-20           | EU               | Commission guidelines on AI Act Art. 50 transparency (T4 legal summaries)                                                                                                                            | §30           |
| 2026-07-24           | Google           | Review snippet guideline: fake / undisclosed incentivized reviews                                                                                                                                    | §7, §24, §29  |
| 2026-07-27           | EU               | Digital Omnibus on AI in force (high-risk delays; Art. 50 unchanged; two new Art. 5 prohibitions apply from 2026-12-02) (T4)                                                                         | §30, §39 F-15 |
| 2026-08-02           | EU               | AI Act Art. 50 transparency obligations apply (T4)                                                                                                                                                   | §30           |
| 2026-08-20           | Google           | Custom Preferred Sources button documented                                                                                                                                                           | §37           |
| 2026-08-28           | Google           | Site reputation policy EEA enforcement adjusted; favicon formats listed                                                                                                                              | §29, §30      |
| 2026-08-31           | Google           | GSC Generative AI reports + Search generative AI control to all properties worldwide                                                                                                                 | §16, §27      |
| 2026-09-08           | Google           | Regional Search differences documented                                                                                                                                                               | §33           |
| 2026-09-18           | Google           | Aggregator / supplier units support local-business queries                                                                                                                                           | §24, §33      |
| 2026-09-24           | Google           | VideoObject `creator` / `author`; `interactionStatistic`                                                                                                                                             | §24           |
| 2026-10-01           | Google           | Generative-AI content guide updated with Quality Rater Guidelines material                                                                                                                           | §6            |
| 2026-10-07           | Chrome           | WebMCP docs updated                                                                                                                                                                                  | §39           |
| 2026-10-08           | Google           | UGC Fresh Data Program page                                                                                                                                                                          | §17           |
| 2026-10-13           | Bing             | Topics Portfolio (Beta) in AI Performance                                                                                                                                                            | §26           |
| 2026-10-21           | Google           | "Control what you share" lists Search generative AI control alongside robots meta, data-nosnippet, X-Robots-Tag                                                                                      | §16, §18      |
| 2026-10-21           | EU               | Council negotiating mandate on Digital Omnibus (data: ePrivacy Art. 5(3), GDPR) (T4, one trade-press source)                                                                                         | §39 F-16      |
| 2026-10-23           | Google           | URL structure guidance: hyphens vs underscores                                                                                                                                                       | §2, §9        |
| 2026-10-26           | Google           | UGC spam guidance: block indexing of link-shared content; monitor abuse in GSC                                                                                                                       | §17, §29      |
| 2026-11-09           | Google           | Aggregator and supplier unit docs: both units support "things to do" queries (Search Central updates, opened 2026-11-14)                                                                             | §24           |
| 2026-11-10           | Google           | November 2026 core update begins (Search Status Dashboard; end not listed 2026-11-12)                                                                                                                | §35           |
| 2026-11-12           | Google           | New page: identifying traffic from Google Search via HTTP referrer information (Search Central updates, opened 2026-11-14)                                                                           | §27           |

---

## E. Maintainer notes (new in v4.6)

### E1. Field-test coverage (as of 2026-11-14; from §34 and the decision records)

| Run                      | Site                                                                                                                    | What it exercised                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| FT1 (2026-11-13)         | Live local-business site, Squarespace, T2, 8 sitemap URLs; read-only audit + 5 single-URL checkers + Semrush Site Audit | P0, P1 evidence set, scoring, platform limits, SP7, SP9 (minor), checker triage                        |
| FT2 (2026-11-13)         | Own-stack site on Vercel (static + SSR, Supabase), T3; audit                                                            | P0, P1, JS-only content, robots groups, Event schema, API fallbacks, page weight, severity calibration |
| R1–R3c (2026-11-11 / 12) | Red-team runs on simulated sites                                                                                        | Protocol logic, consistency, artifacts — no live site                                                  |

- No record of a live run for: BUILD mode · fix phases P2–P10 against their gates · P11 / MAINTAIN · tracking files in use · T1 · T4 (SP2, SP8, SP10: §10 variant URLs, §24 Product / merchant markup, §36) · §11 pagination, facets, infinite scroll · §13 hreflang (SP1) · §17 UGC (SP5) · SP6 YMYL items · §20–22 · §37 · platforms other than Squarespace and one custom Vercel stack (WordPress, Shopify, Wix, Webflow).
- `[FIELD]` tags rest on these two sites plus two field checklists (§34 Source H), yet rank above `[STUDY]` (§0 EP-1 precedence): revisit a `[FIELD]` rule when a later field test or a study disagrees with it.
- Next field tests, in priority order:
  1. FT3 — Shopify store (T4): §10 variants, §11, §24 Product, §36, platform limits.
  2. FT4 — WordPress local-service site (T2): v4.6 local rules, page-type matrix, review-markup rule, key events (observable part).
  3. FT5 — full AUDIT → fix → P10 run on an owned site with repo access: every gate, tracking files, key events, outcome record at +4 / +12 weeks.
  4. FT6 — repeatability: one site scored twice from independent P1 runs (EP-7).

### E2. v4.6 additions awaiting field confirmation

Desk-derived unless tagged `[SPEC]`. A field test confirms, corrects or retires each one; a retired one moves to §38 with its reason.

| ID   | §          | Addition                                                                                | Tag                                  |
| ---- | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
| E02  | §0         | §33 pointer: launch-list exception                                                      | [HEURISTIC]                          |
| E03  | §0         | How-to-use pointer: §34/§38/§40 in archive file                                         | —                                    |
| E04  | §0         | Universal baseline scoped by page type                                                  | [HEURISTIC]                          |
| E05a | §0         | Applicability row: local pages                                                          | —                                    |
| E05b | §0         | Applicability row: AI answer panel                                                      | —                                    |
| E06  | §0         | §33 gate row: launch list carved out                                                    | —                                    |
| E06b | §0         | Applicability row: §33 launch list                                                      | —                                    |
| E07  | §0 EP-1    | Context rule updated                                                                    | —                                    |
| E08  | §0 EP-1    | Never-fabricate list extended                                                           | [HEURISTIC]                          |
| E08b | §0 EP-1    | New rule: Source check                                                                  | [HEURISTIC]                          |
| E09  | §0 P1      | P1 baseline: AI answer panel                                                            | [HEURISTIC]                          |
| E10  | §0 P4      | P4: breadcrumbs / last-updated per page type                                            | [HEURISTIC]                          |
| E11  | §0 P5      | P5 Do: keyword → URL map                                                                | [HEURISTIC]                          |
| E11b | §0 P5      | P5 Do: source check + page-type matrix                                                  | [HEURISTIC]                          |
| E12  | §0 P5      | P5 gate: source check + keyword map                                                     | [HEURISTIC]                          |
| E13  | §0 P7      | P7 gate: INP / TBT proxy                                                                | [SPEC + HEURISTIC]                   |
| E14  | §0 P8      | P8 gate: headers by value, CSP state                                                    | [HEURISTIC]                          |
| E15  | §0 P10     | P10 Do: key events, launch list, panel                                                  | [HEURISTIC]                          |
| E15b | §0 P10     | P10 gate: key events                                                                    | [HEURISTIC]                          |
| E16  | §0 P11     | P11 re-baseline: key events + panel                                                     | [HEURISTIC]                          |
| E16b | §0 P11     | P11: outcome record                                                                     | [HEURISTIC]                          |
| E17  | §0 EP-5    | Tracking file: seo-keyword-map.md                                                       | [HEURISTIC]                          |
| E17b | §0 EP-5    | seo-followups.md content                                                                | —                                    |
| E19  | §0 EP-7    | EP-7: version comparability, repeatability, panel out of scope                          | [HEURISTIC]                          |
| E20  | §1         | §1: keyword → URL map procedure + cannibalization check                                 | [HEURISTIC]                          |
| E21  | §3         | §3: H4+ allowed where content has that depth                                            | [HEURISTIC]                          |
| E22  | §4         | §4: templates need verified facts                                                       | [HEURISTIC]                          |
| E23a | §5         | §5: citation density is a ceiling                                                       | [HEURISTIC]                          |
| E23b | §5         | §5: bracketed citations scoped to articles                                              | [HEURISTIC]                          |
| E24  | §6         | §6: sources checked at the source                                                       | [HEURISTIC]                          |
| E25  | §7         | §7: review markup eligibility                                                           | [SPEC]                               |
| E25b | §7         | §7: page-type applicability matrix, page blueprints, local business pages               | [HEURISTIC + SPEC]                   |
| E26  | §8         | §8: rating source; no stars from own-site markup                                        | [SPEC]                               |
| E27  | §9         | §9: local / service URL patterns                                                        | [HEURISTIC]                          |
| E28  | §14        | §14: 2026 log study corroborates no-JS; exceptions noted                                | [STUDY]                              |
| E29  | §14        | §14: CSP rollout + value check                                                          | [HEURISTIC]                          |
| E30  | §14        | §14: INP lab proxy (TBT) + interaction check                                            | [SPEC + HEURISTIC]                   |
| E31  | §16        | §16: per-engine facts table                                                             | [SPEC rows restated; HEURISTIC rule] |
| E32a | §18        | §18 template Group A: MistralAI-Training (training line)                                | [SPEC]                               |
| E32b | §18        | §18 template Group B: MistralAI-Training                                                | [SPEC]                               |
| E32c | §18        | §18 bot table: Mistral ×3, DuckDuckGo                                                   | [SPEC]                               |
| E32d | §18        | §18: unverified vendors; Group B not exhaustive                                         | [SPEC + HEURISTIC]                   |
| E33a | §24        | §24: shipping markup pointer (no example)                                               | [HEURISTIC]                          |
| E33b | §24        | §24 LocalBusiness: required props, subtype, self-serving reviews, service-area business | [SPEC + HEURISTIC]                   |
| E33c | §24        | §24: connected @graph example                                                           | [HEURISTIC]                          |
| E33d | §24        | §24: Service has no Google feature                                                      | [SPEC: gallery list]                 |
| E34a | §27        | §27: session-recording guard (cross-ref §30)                                            | [HEURISTIC]                          |
| E34b | §27        | §27: key events (conversions)                                                           | [HEURISTIC + SPEC]                   |
| E34c | §27        | §27: AI answer panel (baseline)                                                         | [HEURISTIC]                          |
| E35a | §29        | §29: MistralAI-Training in training list                                                | [SPEC]                               |
| E35b | §29        | §29: llms.txt claim dated consistently                                                  | —                                    |
| E35c | §29        | §29: eight hard don'ts for the new rules                                                | [SPEC + HEURISTIC]                   |
| E37a | §32        | §32: review-snippet + local-business constants                                          | [SPEC]                               |
| E37b | §32        | §32: doorway + keyword-map constants                                                    | [SPEC + HEURISTIC]                   |
| E37c | §32        | §32: TBT constant                                                                       | [SPEC]                               |
| E37d | §32        | §32: 2026 JS log study pointer                                                          | [STUDY]                              |
| E37e | §32        | §32: GA4 enhanced measurement + BigQuery constants                                      | [SPEC]                               |
| E37f | §32        | §32: Mistral / DuckDuckGo tokens; panel constant                                        | [SPEC + HEURISTIC]                   |
| E38  | §33        | §33: Set up at launch (not deferred)                                                    | [HEURISTIC + SPEC]                   |
| E38b | §33        | §33: llms.txt claim dated consistently                                                  | —                                    |
| E39  | §39        | §39: watchlist F-17, F-18, F-19                                                         | —                                    |
| E40a | §41 P1     | §41 P1: AI answer panel                                                                 | [HEURISTIC]                          |
| E40b | §41 P5     | §41 P5: source check                                                                    | [HEURISTIC]                          |
| E40c | §41 P5     | §41 P5: page-type matrix                                                                | [HEURISTIC]                          |
| E40d | §41 P5     | §41 P5: local pages; editorial standards page                                           | [HEURISTIC + SPEC]                   |
| E40e | §41 P5     | §41 P5: keyword map criterion                                                           | [HEURISTIC]                          |
| E40f | §41 P6     | §41 P6: LocalBusiness rules; Knowledge Panel                                            | [SPEC + HEURISTIC]                   |
| E40g | §41 P7     | §41 P7: INP / TBT proxy                                                                 | [SPEC + HEURISTIC]                   |
| E40h | §41 P7     | §41 P7: resource hints                                                                  | [HEURISTIC]                          |
| E40i | §41 P8     | §41 P8: CSP state                                                                       | [HEURISTIC]                          |
| E40j | §41 P10    | §41 P10: key events; BigQuery export                                                    | [HEURISTIC + SPEC]                   |
| E40k | §41 P11    | §41 P11: re-baseline set                                                                | [HEURISTIC]                          |
| E40l | §41 P11    | §41 P11: outcome record                                                                 | [HEURISTIC]                          |
| E40m | §41 REVIEW | §41 REVIEW: panel + keyword data out of scope                                           | —                                    |

### E3. Re-verification cadence [HEURISTIC]

| Block                                                                             | Decays because                        | Re-open                                    | Cadence                                |
| --------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ | -------------------------------------- |
| §18 bot table + template, CDN defaults                                            | Vendors add, rename and retire tokens | Vendor crawler docs (§31)                  | Monthly                                |
| §16 AI-feature controls + per-engine facts; §26 reports; §27 GA4 channel + events | Product changes                       | Google / Bing / OpenAI help pages          | Monthly                                |
| §24 feature gallery, required properties, retirements                             | Docs change                           | Search gallery + Search Central changelog  | Changelog monthly; full pass quarterly |
| §35 ranking log                                                                   | New updates                           | Search Status Dashboard                    | Before each attribution; monthly       |
| §36 agentic commerce                                                              | Programs gated and moving             | Merchant Center Help; OpenAI commerce spec | Monthly while SP10 work is active      |
| §39 watchlist                                                                     | Triggers fire                         | Per row                                    | Monthly                                |
| §30 compliance                                                                    | Law changes                           | Counsel; official texts                    | Quarterly                              |
| §10, §14 constants, §19                                                           | Slow-moving specs                     | Google docs, web.dev, W3C                  | Twice a year                           |
| §1–§9, §12 heuristics                                                             | No owner source                       | Field tests                                | Each field test                        |

- "Last verified" in the header moves only for lines actually re-opened; a line not re-opened keeps its own date.

### E4. Merge hygiene

- Build each version from the latest file. Lineage check before editing — these v4.6 fingerprints must be present: `Page-type applicability`, `Source check:`, `seo-keyword-map.md`, `Set up at launch`, `AI answer panel`, `MistralAI-Training`. (A lineage break on 2026-11-12 / 13 lost 27 fixes for two versions.)
- Every in-place replacement → a §38 entry in this file quoting the replaced wording verbatim. Appends need no entry.
- One rule lives in up to four places (body, §29, §32, §41): when changing a rule, search its key term in all four.
- Run `handbook_lint.py <core.md> [archive.md]` before release: section order, § references, JSON-LD parse, robots template group test, §41 item format, core-threshold consistency, companion files present.
- New v4.6 scored items (P5, P6, P7) change REVIEW grades: re-score FT1 / FT2 on v4.6 before comparing them with later runs.

### E5. Open design decisions (not applied in v4.6)

- Severity-weighted EP-7 scoring: every §41 item weighs the same inside a phase (a `noopener` item equals unique titles in P4). Needs a default severity per item + FT6 repeatability data; changing it re-grades FT1 / FT2.
- Generating §29, §32 and §41 from tagged body lines (one source per rule): needs a build step; the lint covers cross-references only.
