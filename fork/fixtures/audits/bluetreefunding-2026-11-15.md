# SEO/GEO Audit — bluetreefunding.com

- Handbook: on-site SEO/GEO reference unified v4.6 (last verified 2026-11-14) · scored item by item under EP-7
- Date: 2026-11-15 · Mode: REVIEW (read-only; no repo, no owner access) · Tier: T3 (service catalog: `/equipment-leasing/` hub → 7 industry pages; `/working-capital/` hub → 4 loan products)
- Platform: self-hosted WordPress 7.1.4 on Apache. Theme Salient 18.1.1 + WPBakery 8.7.2; Elementor 4.2.1 on some pages; SEOPress Pro; Gravity Forms. An openresty bot-check layer sits in front of the origin (F01). DNS: Namecheap. Mail: Microsoft 365. Not a hosted builder → every finding FIXABLE (code, content or settings).
- Evidence:
  - Raw HTML of all 40 sitemap URLs (40 × 200) + link crawl (links reach 25 of 40).
  - 30+ URL-variant probes: protocol, host, case, trailing slash, params, `/index.php`, `/page/2/`, WP defaults, unknown URLs.
  - robots.txt (one `*` group). Sitemap index + 3 child sitemaps with `<lastmod>`. llms.txt.
  - Response headers by value: HTML, CSS, JS, image, 404, plain HTTP.
  - Bot-UA parity: 200 HTTPS fetches (Googlebot, Bingbot, OAI-SearchBot, ClaudeBot, PerplexityBot × 40 URLs) + 18 more bot tokens on home.
  - Headless Chrome, JS on and JS off, all 40 URLs: word counts, hidden text, network weight. Mobile first-screen screenshots (11 templates). Plain-HTTP navigation test.
  - Lighthouse 12.8.2 CLI: 10 templates mobile + home desktop (cloud container).
  - python-seo-analyzer on home (2 runs).
  - 140 image files and 6 video files sized.
  - 11 outbound URLs, each tested with a browser UA and a Googlebot UA.
  - DNS: A, NS, MX, TXT, DMARC.
  - Section 179 claim checked against the source the site cites (section179.org, fetched 2026-11-15).
  - Not available: GSC, Bing WMT, CrUX (PSI API 429), Rich Results Test, WAF settings/logs. Semrush (no API units) and Ahrefs (plan) returned no data.

## Grade: 41 / 100 — D (no cap; no confirmed S1)

Cap watch: F01 is S2 on current evidence. If WAF logs show verified search or AI-citation bots receiving the challenge page, F01 becomes S1 and the total caps at 39 (F).

| Phase | Weight | Score | Driver |
|---|---|---|---|
| P2 Architecture + rendering | 15 | 43 | Key prices render as `$0` / `0%` / `0 mo` in raw HTML; opacity-0 animations; 48 MB home; WP server rendering otherwise solid |
| P3 Crawl + index controls | 15 | 77 | No HTTP→HTTPS redirect; 5 test/dev pages + 3 duplicate pairs + 3 Pocket Nurse variants in sitemap; empty category archive indexable. Canonicals, 404s, robots, lastmod clean |
| P4 Page templates | 15 | 30 | 33/40 pages without H1; no `<main>`; brand-only and label titles; auto-cut descriptions; zoom-blocking viewport; no og:image |
| P5 Content + facts | 15 | 33 | Stale Section 179 figure; conflicting terms/approval times; unsourced stats; template leftovers; no About page |
| P6 Structured data + entity | 15 | 44 | No Organization node; 3 conflicting org nodes; FAQPage contradicts visible answers; no breadcrumbs |
| P7 Performance + media | 10 | 25 | Lab LCP fails 10/10 templates (3.7–12.7 s); 5 autoplay hero videos; no asset caching; HTTP/1.1 |
| P8 Accessibility + security | 10 | 20 | No security headers on HTTPS; unnamed icon links; content images `alt=""`; contrast |
| P9 AI / GEO access | 5 | 50 | Bot-check interstitial (200) to 7% of bot-UA fetches; training-bot 403s not stated in robots.txt |
| P10–P11 Measurement | — | not scored | Owner access needed |

Total = Σ (weight × score) ÷ 100 = 40.99. Per-item statuses: "§41 walk". Comparable only with other v4.6 runs (EP-7); not comparable with whyracingevents.com (39, v4.2).

## Site Profile (inferred)

| SP | Value | Evidence |
|---|---|---|
| SP1 Multi-locale | N | `lang=en-US`; US only; no hreflang |
| SP2 Ecommerce | N | Lead-gen forms; no catalog or cart |
| SP3 Facets | N | — |
| SP4 Video | N | 6 background videos + 1 YouTube embed; not video-led. Hero-video gate on |
| SP5 UGC | N | 3 curated testimonials |
| SP6 YMYL | Y | Business loans, credit checks, tax-deduction claims, healthcare receivables purchase |
| SP7 Local | ? | 6 office addresses on `/contact/` (Phoenix, Denver ×2, San Francisco, Austin, Seattle); LocalBusiness/MedicalBusiness markup with Phoenix; no hours; national online lender. Whether offices are customer-facing / have GBP listings → owner |
| SP8 Large | N | 40 URLs |
| SP9 Site search | Y | Header search form `?s=` |
| SP10 Merchant / agentic | N | — |
| SP11 EU AI | N | US audience; no AI chat |
| SP12 Bot-managed CDN | Y (medium) | openresty challenge page on all plain-HTTP requests and intermittently on HTTPS; Apache 403 by bot UA |
| Gates on | — | Hero video; FAQPage (2 pages); admin paths (WP); internal search; sensitive-data forms (SSN, DOB, bank statements); SP6 items |

## Top fixes (FIXABLE, severity then effort)

| # | Fix | Findings | Effort | Impact |
|---|---|---|---|---|
| 1 | Bot-check layer: allowlist IP-verified search and AI-citation bots; answer challenges with 403/429/503, never a 200 page; issue the HTTP→HTTPS 301 before any challenge. Then pull logs for Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, ClaudeBot (verified by vendor IP lists) | F01, F02 | Low (settings) | Crawlers stop indexing/quoting an 8–9-word "One moment, please…" page |
| 2 | HTTPS: one-hop 301 `http://` and `http://www.` → `https://bluetreefunding.com`. Add HSTS `max-age=31536000` (host-only; `includeSubDomains`/`preload` only after a subdomain inventory — `app.bluetreefunding.com` exists), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors`. Ship CSP report-only first | F02, F03 | Low | Required baseline for a site collecting SSNs |
| 3 | Unpublish test/dev/duplicate pages; one application form. Per URL: `/healthcare-pre-funding-dev/` → 301 `/medical-funding/`; keep one of `/pocket-nurse/`, `/pocket-nurse3/`, `/partner/pocket-nurse/` and 301 the others; `/nicole/`, `/1045-2/` → remove or 301 `/application/`; `/vilo/` → finish or remove; one of each duplicate pair (`/vendor/` ↔ `/healthcare-revenue-services/`, `/partner/compass-mining/` ↔ `/partner/mining-financing/`, `/construction-financing/` ↔ `/financing-hci/`). Partner-only landing pages: noindex + out of sitemap if not meant for search. SEOPress: noindex category archives | F04 | Low–Med | Clean index; fewer public SSN forms |
| 4 | Counters: ship final values in HTML (Elementor counter start = end value, or static text; `/pocket-nurse3/` `stat-value` divs render `100%`, `84 mo`, `$99/mo`, animate from there) | F11 | Low | AI crawlers stop reading "$0/mo", "0%", "0 mo" |
| 5 | Templates: one H1 per page = page topic; slogan "Think outside the bank." → eyebrow `<p>`; home H1 states what the business is and for whom (owner wording); content wrapped in one `<main>`; footer "Contact"/"Resources" not headings; no level skips. >5 templates → confirm first | F05 | Med | — |
| 6 | Titles + descriptions in SEOPress: offer before brand on every page; home title names the business type; one suffix style (` \| Blue Tree Funding` or ` - Blue Tree Funding`); hand-written 140–160-char descriptions on all 40 (none empty, none auto-cut) | F06, F07 | Low–Med | Entity test passes |
| 7 | Viewport → `width=device-width, initial-scale=1` (drop `maximum-scale=1, user-scalable=0`) | F08 | Low | Zoom restored (WCAG 1.4.4) |
| 8 | SEOPress Social: default + per-page 1200×630 `og:image` with width/height; `twitter:card` = `summary_large_image`; fill or remove empty `fb:pages`, `fb:app_id`, `twitter:site`, `twitter:creator` | F09 | Low | Share previews |
| 9 | Performance: home hero → one poster `<img fetchpriority="high">` (WebP, display size); if video stays: one clip, `preload="none"`/`"metadata"`, mobile encode ≤ ~1–2 MB, pause control, `prefers-reduced-motion` off. Same for `/working-capital/` (17 MB) and `/financing-hci/` + `/construction-financing/` (6 MB). Background photos → WebP at display size. Page cache (cold TTFB 3.1–3.5 s). `Cache-Control: max-age=31536000, immutable` on versioned `/wp-content/` + `/wp-includes/` assets; HTML `no-cache`/must-revalidate. HTTP/2 at host. Defer non-critical JS; self-host or preconnect fonts | F10 | Med | −40 MB on home; LCP |
| 10 | Facts: Section 179 → 2026 limit $2,560,000 / phase-out $4,090,000 with source + date, or drop the dollar figure; qualify "100% tax-deductible" (owner/tax counsel). One terms / approval / funding-time statement per program, reused everywhere. Source + date or remove: "96% Approval Rate", "Keep 94%", "$3 billion … leased each year", "tens of thousands of businesses", "decades of experience". Testimonials: company + date, or remove | F12, F13 | Low (owner input) | YMYL trust; AI answers quote correct figures |
| 11 | Leftovers: remove "$ 99 Per Month" from the "Traditional Banks" column (home) and the rcm-connect comparison; "(555) 555-5555"; stray "1 1"; "Cookie Policy." link → real policy or remove. Drop or source superlatives and HIPAA/"100% Compliant" claims; spell out acronyms on first use per page | F14, F15 | Low | — |
| 12 | Schema: one `Organization` (or `FinancialService`) node on home, `@id` `https://bluetreefunding.com/#organization`, logo, telephone, email, `sameAs` (LinkedIn, Facebook, X; YouTube if owned). WebSite: `publisher` → that `@id`; `alternateName` only for real variants (owner-confirmed: "BlueTree Funding", "BTF"). Replace MedicalBusiness / LocalBusiness / bare Organization nodes with `@id` references. FAQPage text = visible text verbatim, or drop FAQPage. BreadcrumbList on hub children | F18, F19 | Low–Med | One entity |
| 13 | Accessibility: `aria-label` on 3 social icon links (37 pages) and slider arrows; alt text on partner logos and product images; darken `#5dad2b` badges (white text 2.8:1) and `#6b7d94` body text (4.21:1); Pocket Nurse accent text ≥ 4.5:1 | F25 | Low | — |
| 14 | No-JS reveal for Salient animations: `<noscript><style>.img-with-animation,[data-animation]{opacity:1!important;transform:none!important}</style></noscript>`, or disable entrance animations on content | F16 | Low | No-JS and screenshot renderers see content |
| 15 | Navigation + links: add Working Capital (and Franchise, Home Improvement, Pool & Spa) to header nav; descriptive anchors instead of "Learn More"/"Find Out More"; internal links same tab; fix Calendly 404 on `/franchise/`; `twitter.com` → `x.com`; `fundedbiz.com` → `www.fundedbiz.com` | F20, F21 | Low | — |
| 16 | About / company page: named leadership + roles, history, credentials with sources, contact; Person schema. Editorial/review standards page for financial claims, linked from footer | F22 | Med (owner content) | YMYL trust |

## Findings

Severity: S1 blocks crawl, index or render · S2 page fundamentals · S3 content / extraction · S4 polish / measurement. No S1 confirmed.

### S2 — page fundamentals, access, security

| ID | § | Finding | Evidence |
|---|---|---|---|
| F01 | §18, §14, P9 | Bot-check layer returns HTTP 200 + an 8–9-word interstitial ("One moment, please… Please wait while your request is being verified…", `Server: openresty/1.31.1.1`, JS `location.reload()` after 5 s, no canonical/robots). Plain HTTP: every URL tested (home, `/contact/`, `/robots.txt`, an image, www host), every UA (browser, curl, Googlebot UA). HTTPS, intermittent: 14 of 200 bot-UA fetches (7%: Googlebot 5/40, PerplexityBot 4/40, ClaudeBot 2/40, OAI-SearchBot 2/40, Bingbot 1/40), 6 of 91 headless Chrome loads, first Lighthouse attempt on 5 of 10 templates, python-seo-analyzer run 1, `?s=` search. Non-JS crawlers get the interstitial as page content with a 200. Spoofed UAs from a datacenter IP: verified-bot treatment unknown. S1 if logs show verified bots challenged | `botparity_full.json`; interstitial HTML; Playwright + Lighthouse runs |
| F02 | §10 | No HTTP→HTTPS redirect: `http://bluetreefunding.com/` and `http://www.bluetreefunding.com/` → 200 interstitial (F01), not 301/308. Headless Chrome stayed on the interstitial 8+ s (2 × 200, never reached HTTPS). No HSTS to upgrade return visitors. `https://www.` → 301 apex ✓ | curl; Playwright navigation chain |
| F03 | §14, §30 | No security headers on any HTTPS response: no `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` (HTML, CSS, JS, images, 404). The HTTP interstitial carries nosniff/XFO/CSP; the origin carries none. Site collects SSN, DOB, home address, bank statements (F04). Not a ranking signal | Headers by value |
| F04 | §10, §17, §30 | Test, dev and duplicate pages are public, indexable and in the sitemap. Test/dev: `/healthcare-pre-funding-dev/` (title "Healthcare Pre-Funding (Dev)"), `/pocket-nurse3/` ("Pocket Nurse3"), `/1045-2/` (title " - Blue Tree Funding"; 3-step lease application with owner SSN, DOB, signature fields), `/nicole/` (copy of the loan application incl. SSN/DOB fields), `/vilo/` (logo + "(555) 555-5555", 0 main-content words). Duplicates (5-word-shingle Jaccard): `/vendor/` = `/healthcare-revenue-services/` 1.0; `/partner/mining-financing/` = `/partner/compass-mining/` 1.0; `/financing-hci/` ≈ `/construction-financing/` 0.99; 3 pages for one Pocket Nurse offer (`/pocket-nurse/` ≈ `/pocket-nurse3/` 0.82; `/partner/pocket-nurse/`). `/category/uncategorized/` = 200, indexable, self-canonical, "No archives to show". 15 of 40 sitemap URLs have no internal link. 4 indexable URLs collect SSNs: `/application/`, `/nicole/`, `/1045-2/`, `/partner/doclab/` | Sitemap; crawl inlinks; text extraction; form labels |
| F05 | §2, §3 | No H1 on 33 of 40 pages, raw and rendered (incl. home, `/contact/`, `/equipment-leasing/`, `/working-capital/`, 7 industry pages, 4 loan products, all partner pages). H1 present only on `/rcm-connect/`, `/medical-funding/`, `/vendor/`, `/healthcare-revenue-services/`, `/franchise/`, `/pocket-nurse3/`, `/privacy-policy/`. No `<main>` on any page. Service pages open with h5 "Think outside the bank."; h4 after h2 (Lighthouse heading-order: rcm-connect, financing-hci); footer "Contact"/"Resources" are h3. `/pocket-nurse/`: hero split across 8 h2s (badge, 3-part headline, microcopy, "PN" logo letters) | Raw HTML; Playwright DOM |
| F06 | §2, §25 | Titles: home = brand only "Blue Tree Funding"; bare labels "Contact", "Construction", "Consumer", "All Others", "Nicole", "Vilo", "Pocket Nurse3", "pocket nurse", " - Blue Tree Funding"; hubs "Equipment Leasing - Blue Tree Funding", "Working Capital - Blue Tree Funding" (no promise). Suffix mixes " - " and " \| ". Entity test fails on home: title + description ("Think Outside The Bank") + no H1 never state the business type | Title extraction |
| F07 | §2 | Meta descriptions: empty on `/application/`, `/nicole/`, `/1045-2/`; "(555) 555-5555" on `/vilo/`; home = slogan (22 chars). 34 of 40 run 177–372 chars; all but `/rcm-connect/` and `/medical-funding/` are body text cut by SEOPress (e.g., "Get Approved → • Partner Program Equip Your…"); 17 start "Think outside the bank."; 3 duplicate pairs (+ the 3 empties) | Meta extraction |
| F08 | §14 | Viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0` on 38 of 40 pages (not `/pocket-nurse/`, `/pocket-nurse3/`): pinch-zoom blocked (WCAG 1.4.4; Lighthouse meta-viewport fail on 9 of 10 templates) | Raw HTML; Lighthouse |
| F09 | §2, §24 | No `og:image` or `twitter:image` on any page; `twitter:card=summary`. Empty `content=""` on `fb:pages`, `fb:app_id`, `twitter:site`, `twitter:creator` on every page | Raw HTML |
| F10 | §14, §15 | Lab mobile LCP fails on 10 of 10 templates (3.7–12.7 s; table below). Home: LCP = hero `<video preload="auto">`; 5 autoplay slider videos (iStock mp4, 6.2–16.2 MB each, 52 MB of files), no poster, no pause control, no reduced-motion handling; 43.7 MB transferred (Lighthouse), 47.8 MB decoded (Playwright). `/working-capital/` 17.1 MB background video (12.5 MB transferred, LCP 7.1 s). `/financing-hci/`, `/construction-financing/` 6.2 MB video (8.4–10.4 MB, LCP 12.7 s). LCP elsewhere = CSS background images (not discoverable, no preload/fetchpriority); originals up to 2.4 MB JPG / 2.2 MB PNG. No `Cache-Control`/`Expires` on HTML or static assets (Lighthouse cache savings: 16,642 KiB on home). All origin requests HTTP/1.1. TTFB cold 3.1–3.5 s (Lighthouse server-response-time on 5 templates; curl first hit 3.49 s), warm 0.55–0.73 s. Render-blocking CSS est. 1.2–2.3 s; Google Fonts + Font Awesome 4.7 render-blocking. Home TBT 633 ms (> 600 ms INP proxy) | Lighthouse; Playwright network; file sizes; curl timing |
| F11 | §14, §6 | Key facts JS-only, wrong in raw HTML. `/pocket-nurse/` Elementor counters ship "$ 0 /mo", "0 %", "0 mo", "$ 0 mo" (data-to-value 99, 100, 84, 99). `/pocket-nurse3/` ships "0%", "0 mo", "$0/mo" (data-target 100, 84, 99). `/medical-funding/` mock dashboard ships "Claim ID 0 … ENR $0 Advance $0 … 0 Days". Raw-HTML readers (AI crawlers) get $0 / 0% / 0 months. S2 because the correct values exist elsewhere in each page's server HTML ("$99", "24–84 months") | Raw HTML vs Playwright DOM |

### S3 — content, extraction, schema, accessibility

| ID | § | Finding | Evidence |
|---|---|---|---|
| F12 | §6, §29 | Stale tax figure (YMYL): "Section 179 … deduct the full purchase price … (up to $1,000,000)" on home, `/vendor/`, `/healthcare-revenue-services/`. The site's cited source (section179.org, fetched 2026-11-15) states $2,560,000 for 2026, phase-out $4,090,000 (IRS Rev. Proc. 2025-32 per multiple 2026 sources). "Financing is 100% tax-deductible … as part of the Section 179 Tax Code" / "100% TAX DEDUCTIBLE" omits limits, taxable-income cap and qualifying-property rules. Release-blocking class (EP-1) | Text; source fetch |
| F13 | §6 | Conflicting, unsourced figures. Terms: "12-72 months" (home, avenu, doclab), "24–84" (3 Pocket Nurse pages), "up to 36 months" (working capital), "80 month terms" (kiwi), "180 month terms" (HCI). Approval: "same-day approvals" (working-capital, 4 partner pages, vendor) vs "Approval as fast as 24 hours" (7 industry pages); home says both ("typically same day approval", "Approval within 24 hours"). Funding: "within days" (home) vs "within 2 business days" (industry pages) vs "48 hours" (medical-funding). Unsourced: "96 % Approval Rate" (medical-funding), "You Keep 94% of Collections" (rcm-connect), "over $3 billion … leased each year" ("According to medical industry research", medical-dental), "leading financial services company for tens of thousands of businesses … decades of experience" (working-capital). Testimonials "Toby M", "Dave R", "Kris T", all "Business Development Manager": no company, date or source. Program-specific terms may each be true; no page states which program a figure belongs to | Pattern scan, all pages |
| F14 | §6 | Template leftovers: "$ 99 Per Month" under "Traditional Banks Old Way of Funding" (home comparison; same price as the Blue Tree column); "Blue Tree Records + Revenue $ 99 Per Month" on `/rcm-connect/` (contradicts "6% of new revenue, zero upfront"); "(555) 555-5555" (`/vilo/` body + meta + dc.description); stray "1 1" on home; "Cookie Policy." link → home (no cookie policy page) | Raw text |
| F15 | §6 | Unsupported superlatives/claims: "best pricing available", "most competitive pricing in the industry", "Industry-Leading Loan Products", "truly unique and the best in the industry", "the most aggressive interest-only product in the marketplace", "lowest payments", "unmatched benefits", "Simply Better Funding"; boilerplate "unlike any other leasing or financing provider in the industry" on 17 pages. Compliance claims without basis: "full HIPAA compliance standards with encryption at every level", "HIPAA Compliant – Full data protection with BAA" (image badge), "100% Compliant". Acronyms not spelled out: BTF, MMJ, TI, EHR, CPT, MCA, HCI, BAA, CBR, H&P, DME/HME | Text |
| F16 | §14 | Salient entrance animations keep content at opacity 0 without JS. JS-off hidden words (incl. ~47-word off-canvas menu): home 348, equipment-leasing 317, interest-only 300, business-line-of-credit 290, bankroll 230, franchise 159 | Playwright, JS disabled, computed styles |
| F17 | §14 | Duplicate text in HTML: home slider prints the slogan h2 4× and "Give your Business a Boost…" 4× (3 identical "Heavy Equipment" slides); fancy-box cards print each title twice; the boilerplate paragraph appears twice on 8 pages | Raw HTML |
| F18 | §24, §25 | No Organization node anywhere. Home: WebSite only (`alternateName` = `name`, no `publisher`). Three different nodes for the same company, none with `@id`, logo or `sameAs`: `MedicalBusiness` (`/rcm-connect/`, street address 515 E. Grant St not shown on that page), `LocalBusiness` (`/medical-funding/`, city only), bare `Organization` (publisher, name only). A lender typed MedicalBusiness. Name variants "Blue Tree Funding", "BlueTree Funding", "Blue Tree", "BTF"; YouTube channel "BlueTree" (@BlueTreeservices). No BreadcrumbList; no ItemList on hubs | JSON-LD, 3 pages |
| F19 | §24 | FAQPage disagrees with visible FAQ. `/medical-funding/`: 4 marked-up Qs vs 6 visible; "How does repayment work?" not on page; markup "advances payment … repaid automatically when the payor remits" vs visible "We purchase your insurance receivables … no repayment schedule"; markup "within 48 hours of submitting" omits visible "initial onboarding … approximately two weeks"; markup adds "credit score of 600 or higher". `/rcm-connect/`: all 6 question names reworded vs visible headings (answers match) | JSON-LD vs visible text |
| F20 | §12, §8 | Navigation: Working Capital hub (4 products) absent from header nav (footer + home cards only); Franchise, Pool & Spa, Home Improvement, Consumer, CBD absent too. `/consumer/` 0 inlinks, `/cbd/` 1. Generic anchors "Learn More" ×4 (working-capital), "Find Out More". 169 `target="_blank"` links without `rel` on 37 pages, incl. internal pages (`/application/`, `/terms-and-conditions/`) opening new tabs | Crawl; Lighthouse link-text |
| F21 | §12 | Outbound: `calendly.com/hello-btf` → 404 ("Set Appointment", `/franchise/`); `fundedbiz.com/…` → 307 `www.`; `twitter.com/HelloBlueTree` → 301 `x.com` (37 pages). Privacy policy: 2 links pasted from Gmail (`data-saferedirecturl`) → `http://bluetreefunding.com/` (F02) | Browser-UA + Googlebot-UA tests |
| F22 | §7, §30 | No About/company page (`/about/`, `/about-us/` 404): no named people, roles, history, credentials; no Person schema. No editorial/review standards for financial claims (SP6) | Probes; crawl |
| F23 | §6, §7, §9 | Thin / near-identical service pages: 7 industry pages share the same meta prefix and boilerplate paragraphs, 196–351 main-content words; partner pages 112–192. URL hierarchy inconsistent: industry pages at root (`/construction/`) while loan products nest (`/working-capital/*`); `/construction/` (equipment) vs `/construction-financing/` (home improvement); slugs `/1045-2/`, `/pocket-nurse3/`, `/nicole/` | Extraction; URL inventory |
| F24 | §8 | First mobile screen without a labelled button: `/contact/` (phone/email links, form below fold), `/vilo/` (no CTA). Home, equipment-leasing, working-capital, medical-dental, medical-funding, rcm-connect, pocket-nurse pass | Screenshots 390×844 |
| F25 | §14, §15 | Accessibility: 3 social icon links unnamed on 37 pages; slider prev/next unnamed (home). `alt=""` on content images: Kiwi Med Group logo, Arobella wound-therapy product photo, DocLabs logo, HCI logo, Pocket Nurse logo, Antminer/Compass Mining images. Contrast: white on `#5dad2b` 2.8:1 (medical-funding, rcm-connect, financing-hci), `#6b7d94` on white 4.21:1 (rcm-connect body copy), `#0084f4` on `#00284a` 3.99:1 and `#6e808d` 3.66:1 (pocket-nurse). Autoplay video loops without reduced-motion handling | Lighthouse (axe); raw HTML |

### S4 — polish, measurement

| ID | § | Finding | Evidence |
|---|---|---|---|
| F26 | §10, §19 | `/CONTACT/` (any case) → 200 + canonical, not a redirect. `/page/2/` → 200 copy of home, canonical `/`. Home listed in 2 child sitemaps (post-sitemap without `<lastmod>`); category sitemap empty | Probes; sitemaps |
| F27 | §18, §16 | AI-bot policy split: robots.txt allows all; Apache returns 403 (custom page) to GPTBot, Bytespider, meta-externalagent by UA. 200: OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Perplexity-User, CCBot, Google-Extended, Amazonbot, Applebot, DuckAssistBot, MistralAI-User, anthropic-ai, cohere-ai. Decision unrecorded; robots.txt does not state it (Group B) | 23 UA tokens tested |
| F28 | §7 | `tel:18663329223` (no `+`, not E.164); one format sitewide ✓. Two emails: hello@ (sitewide), info@ (medical-funding only) | Link extraction |

## §41 walk (REVIEW)

Key: 1 pass · 0.5 partial · 0 open (finding) · N/A · BLOCKED. Reviewer-performed process items (raw-vs-render, crawl, axe, lab env) = N/A (done here).

| Phase | Item → status |
|---|---|
| P2 | Core in server HTML 0.5 (F11) · API fallback / freshness / loading strings N/A (WP server-rendered) · page weight + no multi-MB originals 0 (F10) · Event N/A · no opacity-0 0 (F16) · raw vs render compared N/A · one instance + ≤20% 0.5 (F17; forms excluded — conditional fields) · detail pages in HTML index 1 · header nav → hubs 0.5 (F20) · URL rules 0.5 (F23) · build chain BLOCKED → **3.0 / 7 = 43** |
| P3 | Host + protocol one hop 0 (F02) · trailing slash 1 · nav → `/` + query canonical 1 · self-canonical = links = sitemap 1 · moved URLs BLOCKED · legacy map BLOCKED · retired items N/A · links to redirected URLs 0.5 (F21) · junk URLs N/A · unknown → 404 1 · 404 own template 1 · URL inventory 0 (F04) · crawl run N/A · hidden pages 0 (F04) · robots groups 1 · admin path 1 (wp-admin 302 → login; wp-login noindex; WP-default Disallow hides no noindex) · lastmod provenance 1 · archive N/A · cross-consistency 1 · render-resource guard 1 · pagination / facets N/A · internal search 1 · hreflang / variants N/A → **11.5 / 15 = 77** |
| P4 | Unique title/meta/H1 + suffix 0 (F05, F06, F07) · topic titles + H1 0 (F05, F06) · meta present 0.5 (F07; 3 empty) · viewport 0 (F08) · searched names BLOCKED (GSC) · no hard-coded years 1 · hub titles 0 (F06) · heading order + one `<main>` 0 (F05) · OG per-page image 0 (F09) · Article OG N/A · `max-image-preview` 1 · `_blank` noopener 0.5 (F20; browsers imply noopener) → **3.0 / 10 = 30** |
| P5 | Opening sentence 0.5 (medical-funding, rcm-connect, partner pages pass; home + service pages slogan-first) · stats single-sourced 0 (F13) · source check 0 (F12, F13) · placeholders / superlatives / acronyms 0 (F14, F15) · page-specific FAQ 1 · page-type matrix 1 · names + entity test 0 (F06, F18) · SP7 address / local pages BLOCKED (SP7 = ?) · SP6 editorial standards 0 (F22) · awards / certifications as text 0 (F15) · prices / specs markup 0.5 (F14) · outbound links 0 (F21) · first-screen CTA 0.5 (F24) · detail-page facts 0.5 (F23) · contact block 1 · About + Person 0 (F22) · keyword map BLOCKED → **5.0 / 15 = 33** |
| P6 | WebSite node 0.5 (F18) · platform schema inventoried, absolute URLs, no empty fields 1 · one org `@id` 0 (F18) · Article / Event N/A · ItemList + BreadcrumbList 0 (F18) · FAQPage real Q&A 0.5 (F19) · parses + RRT 0.5 (all parse; RRT not run) · generic brand disambiguated 0 (F18) · LocalBusiness ×2 BLOCKED (SP7 = ?) · Knowledge Panel BLOCKED · Product / Review / VideoObject N/A · placeholder sentinels 1 (none from the typed list; "(555) 555-5555" → F14) → **3.5 / 8 = 44** |
| P7 | Hero video 0 (F10) · img dims + hero priority 0.5 (`<img>` dimensioned except 4 on `/1045-2/`; heroes are CSS/video, no priority) · LCP `<img>` + display size 0 (F10) · pixels deferred N/A (no client trackers found) · code split / fonts 0 (F10) · resource hints 0.5 (no misuse; LCP not discoverable, no font preconnect) · caching 0 (F10) · CLS every template 1 (0–0.005 mobile; 0.048 desktop home) · LCP ≤ 2.5 s per template 0 (0 of 10) · lab env N/A → **2.0 / 8 = 25** |
| P8 | Headers set 0 (F03) · contrast 0.5 (F25; 6 of 10 templates pass) · axe run N/A · skip link + icon names + alts 0 (F25) · header values 0 (F03) · labels / nav / motion / targets / alts 0.5 (inputs + navs labelled; motion F25; zoom F08) · SP6 condition-page pixel review N/A (no condition pages, no pixels) · sensitive-form data flow BLOCKED · consent N/A (no trackers; US) → **1.0 / 5 = 20** |
| P9 | Bots + parity 0 (F01, F27) · llms.txt / `.md` N/A (§20 gate off) · AI-control decisions 0.5 (F27) · robots per group 1 · agentic N/A → **1.5 / 3 = 50** |

## Passes

- Self-canonical on all 40 pages; canonical = sitemap `<loc>` = internal link form; `?utm_source=` canonicalizes; `https://www.` → 301 apex in one hop; trailing slash → 301 (incl. nested `/working-capital/bankroll`); `/index.php` → 301 `/`.
- Real 404 with own template (noindex, no canonical); `/?p=1` 404; `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml` → 301 `/sitemaps.xml`.
- robots.txt: one `*` group, Disallow only `/wp-admin/` (admin-ajax allowed); no render-resource blocks; `Sitemap:` → live index.
- `<lastmod>` per page from WordPress modified dates (2023-08 → 2026-10); not a build date.
- Internal search `?s=` → `noindex, follow`, not Disallowed.
- `wp-admin` → 302 login; `wp-login.php` noindex; `xmlrpc.php` 403; `/wp-json/wp/v2/users` 401.
- `max-image-preview:large` + `max-snippet:-1` on all indexable pages; `lang=en-US`; skip link; labelled `<nav>`s ("Skip links", "Main Menu"); form inputs labelled.
- Server-rendered content: raw vs rendered words within ~20% on non-form pages (except F11 values).
- No client-side analytics or ad pixels in raw HTML or rendered network; no third-party scripts on SSN forms (same-origin POST).
- Titles unique across 40 pages. No broken internal links.
- CLS ≤ 0.005 on 10 mobile templates.
- Page-specific FAQs on `/medical-funding/` and `/rcm-connect/`; no boilerplate FAQ.
- `/contact/`: phone, email, form, office addresses in server HTML.
- JSON-LD parses on all 3 pages carrying it; absolute `https://` URLs; no empty fields.
- `/medical-funding/` and `/rcm-connect/`: topic H1, answer-first hero, eligibility facts, first-screen CTA.

## Lighthouse lab (cloud container, simulated throttling; TBT inflated in this environment)

| Page | Perf | A11y | BP | SEO | LCP | TBT | CLS | Transfer |
|---|---|---|---|---|---|---|---|---|
| Home (mobile) | 52 | 90 | 100 | 100 | 5.8 s | 633 ms | 0 | 43.7 MB |
| Home (desktop) | 86 | 90 | 100 | 100 | 1.8 s | 77 ms | 0.048 | 44.9 MB |
| /equipment-leasing/ | 72 | 90 | 100 | 100 | 4.8 s | 29 ms | 0 | 1.6 MB |
| /working-capital/ | 69 | 90 | 100 | 92 | 7.1 s | 188 ms | 0 | 12.5 MB |
| /medical-funding/ | 77 | 87 | 100 | 100 | 3.8 s | 50 ms | 0 | 0.65 MB |
| /rcm-connect/ | 71 | 87 | 96 | 100 | 5.8 s | 101 ms | 0 | 1.8 MB |
| /pocket-nurse/ | 75 | 93 | 100 | 100 | 3.7 s | 73 ms | 0.004 | 0.70 MB |
| /partner/pocket-nurse/ | 72 | 90 | 96 | 100 | 6.8 s | 61 ms | 0 | 1.0 MB |
| /contact/ | 83 | 91 | 75 | 100 | 3.8 s | 94 ms | 0.005 | 1.0 MB |
| /application/ | 73 | 91 | 100 | 92 | 3.7 s | 192 ms | 0 | 0.67 MB |
| /financing-hci/ | 57 | 83 | 96 | 100 | 12.7 s | 309 ms | 0 | 8.4 MB |

Heaviest pages (Playwright, decoded, JS on, full scroll): home 47.8 MB · financing-hci 10.4 · construction-financing 10.4 · rcm-connect 6.9 · pool-spa-financing 5.9 · contact 5.8 · equipment-leasing 5.4 · vendor 3.7 · partner/doclab 3.3 · interest-only-flex-pay-loan 3.2. Field data (CrUX): none retrieved (PSI API 429).

## Observed, not actioned (reason)

- Forms: raw > rendered words on `/application/` (1,210 → 171), `/nicole/`, `/partner/doclab/`, `/1045-2/` — conditional / multi-step fields; expected.
- JS-on hidden words ~47 per page = off-canvas menu; higher counts on franchise, business-line-of-credit, cbd, healthcare-revenue-services = toggles present in HTML (allowed).
- dom-size 1,354 (application), 1,096 (rcm-connect), 1,036 (medical-funding): under ~1,400.
- legacy-javascript 1–5 KB, unminified JS 12 KB (home), unused CSS 39–88 KB, unused JS 66–248 KB: minor; covered by F10.
- third-party-cookies + inspector-issues: reCAPTCHA cookie (contact), YouTube embed cookie (rcm-connect). YouTube iframe loads eagerly (facade available): minor.
- unsized-images (medical-funding, pocket-nurse) and image-size-responsive (contact, partner/pocket-nurse, financing-hci, logo served larger than display): minor; resize with F10.
- forced-reflow, bootup-time, main-thread: container lab.
- Dublin Core metas duplicate title/description: harmless.
- `/feed/`, `/comments/feed/`: empty channels: harmless.
- llms.txt (SEOPress, `X-Robots-Tag: noindex`): "Recent Content" empty; description = slogan. §20 gate off; not scored.
- Home linked as `https://bluetreefunding.com` (no slash) on 29 pages: same resource as canonical `/`.
- 48.5 MB `BTF-Video-1.mp4` linked from `/construction-financing/`, `/financing-hci/`: loads on click only.
- LinkedIn 403 to browser UA from datacenter (200 to Googlebot UA); Facebook → login redirect when logged out: bot walls, not broken.
- `app.bluetreefunding.com/registration` 200.

## LIMITED (platform)

None. Self-hosted WordPress. The bot-check layer appears host-provided; configuration access not confirmed → FIXABLE (settings), owner to confirm (EP-1: no limit claimed without evidence).

## BLOCKED (owner access)

- GSC (Page indexing, CWV, Generative AI, searched names), Bing WMT, GA4 (no client tag found ≠ not installed), CrUX (PSI 429), Rich Results Test per template.
- Bot-check layer: vendor, settings, verified-bot allowlist, logs; why plain HTTP is always challenged. Decides F01 severity.
- Apache UA rules (403 for GPTBot, Bytespider, meta-externalagent): origin and intent.
- Sensitive-form data flow (§30): Gravity Forms entry storage and encryption; notification emails (whether SSN/DOB are emailed); protection of uploaded bank statements; retention; recipients; which of the 4 SSN forms are live.
- SP7: are the 6 offices customer-facing; Google Business Profile listings; NAP.
- Provenance: testimonials, HIPAA/BAA claims, 96% / 94% / $3B / "tens of thousands" / "decades", program terms per product.
- Legacy URL map (old sitemap, GSC 404s); keyword map; Knowledge Panel; X handle status.
- WordPress configuration (SEOPress, Salient, Elementor settings).

## Outside scope — noted

- Email DNS: SPF `include:spf.protection.outlook.com -all` ✓; DMARC `p=none` (monitor only).
- WordPress username "admin" exposed by `/author/admin/` (noindex); generator meta "WordPress 7.1.4".
- Application accepts PDF uploads up to 264 MB: security review item.

## Checker errors

- python-seo-analyzer run 1 (bare `Mozilla/5.0` UA): analysed the interstitial (8–9 words) and reported missing description, OG title/description and H1 for home — wrong page. Run 2 with browser headers: correct page.
- python-seo-analyzer: "Anchor missing title tag" ×70 (no such requirement); "Image missing alt tag" for `alt=""` (attribute present; flags decorative icons and the logo alike).
- Lighthouse SEO 100 on 8 of 10 templates while 33/40 pages lack H1, home title is brand-only and 32 descriptions are auto-cut body text — Lighthouse SEO does not check these (§31).
- Lighthouse first attempts on 5 of 10 templates captured the interstitial (SEO 85–92); reruns clean. Playwright: 5 page loads + 1 mobile screenshot (`/partner/pocket-nurse/`) captured it; `/working-capital/` weight taken from Lighthouse. Evidence for F01, not tool faults.
- Semrush (no API units), Ahrefs (plan), PSI API (429): no output.

## Residual weaknesses

- [SUPPORTED] F01 = S2 provisional: UA-spoofed fetches from a datacenter IP; verified bots may be allowlisted. Logs showing verified bots challenged → S1 → total capped at 39 (F).
- [SUPPORTED] F02 observed through the session's egress only; residential clients may pass the challenge and then reach HTTPS. Headless Chrome stayed on the interstitial 8+ s.
- [SUPPORTED] Lab numbers from a cloud container: TBT/main-thread inflated; LCP comparable. Cold TTFB depends on cache state at test time.
- [SUPPORTED] One P1 run; EP-7 two-run repeatability not done.
- [SUPPORTED] Tier T3 is a judgment (hub + detail service pages). As T2 the total is 40.8 — same grade.
- [SUPPORTED] SP7 = ? removed 4 items from scoring.
- [SUPPORTED] Terms and approval times may each be true per program; scored as inconsistency + missing source, not as false. Section 179 figure checked against the site's own cited source.
- [SUPPORTED] 15 orphan URLs include partner landing pages that may be deliberate campaign pages; F04 asks for a per-URL decision, not deletion.
- [SPECULATIVE] Interstitial vendor (Imunify360 WebShield-style splash) not identified.
- [SPECULATIVE] Projected grade after top fixes 1–12: ~70–78 (B/C).
