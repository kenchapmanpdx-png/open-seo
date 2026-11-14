# SEO/GEO Audit — ryanmscottsdale.com

- Handbook: on-site SEO/GEO reference v4.0
- Date: 2026-11-13 · Mode: AUDIT (read-only) · Tier: T2 Brochure (8 sitemap URLs, no templated collections)
- Platform: Squarespace (server-rendered); booking + gift cards off-site on Phorest
- Evidence: raw HTML of all 8 sitemap URLs + 14 probed URL variants; robots.txt; sitemap.xml; headers; 6 bot user-agents; headless-Chrome render of 4 templates; Lighthouse 12 lab runs (5); no GSC/CrUX access

## Grade: 48 / 100 — D

Scale: A 85+ · B 70–84 · C 55–69 · D 40–54 · F <40. Phase score = judged share of applicable checks passing, severity-weighted.

| Phase | Weight | Score | Driver |
|---|---|---|---|
| P2 Architecture + rendering | 15 | 80 | Content in raw HTML; bot parity; hero images JS-loaded |
| P3 Crawl + index controls | 15 | 60 | Clean redirects/404/robots; stale test page + duplicate bios indexable; sitemap lists `/home` |
| P4 Page templates | 15 | 35 | Titles lack service/place terms; 4/8 missing meta descriptions; H1 chaos; 1/8 pages has a share image |
| P5 Content + facts | 15 | 50 | Real price list + NAP + hours; thin home; uncited superlatives; awards as images only |
| P6 Structured data + entity | 15 | 15 | Only a WebSite node; no HairSalon/LocalBusiness, Organization, Person, BreadcrumbList |
| P7 Performance + media | 10 | 20 | Lab mobile perf 28–38; home 9.4 MB; PNG photos |
| P8 Accessibility + security | 10 | 50 | Contrast, unnamed carousel buttons, empty alt on 22 staff photos; HSTS off |
| P9 AI / GEO access | 5 | 85 | No AI bot blocked; prices/NAP in raw HTML |
| P10–P11 Measurement | — | not scored | Owner access needed |

Projected after Top fixes 1–6: ~65–72 (C/B). [SPECULATIVE]

## Site Profile (inferred)

| SP | Value | Evidence |
|---|---|---|
| SP1 Multi-locale | N | `lang=en-US`, no hreflang |
| SP2 Ecommerce | N | Products page = image gallery; gift cards on Phorest |
| SP3 Facets | N | — |
| SP4 Video | N | 0 `<video>` |
| SP5 UGC | N | Instagram embed only |
| SP6 YMYL | N | Salon + facials; no medical claims beyond skin-care copy |
| SP7 Local | Y | Address, hours, `tel:` on every page |
| SP8 Large | N | 8 URLs |
| SP9 Site search | Y (minor) | `/search` route, Disallowed |
| SP10 Merchant/agentic | N | — |
| SP11 EU AI | N | — |
| SP12 Bot-managed CDN | ? | Squarespace; UA-spoof fetches all 200, IP-verified treatment untested |

## Top fixes (ranked)

| # | Fix | § | Effort | Impact |
|---|---|---|---|---|
| 1 | Add one `HairSalon` JSON-LD node on home (`@id` #organization): name, url, logo, address, geo, telephone, openingHoursSpecification, sameAs (Instagram, GBP, Phorest). WebSite node home-only, drop empty `description`, absolute https `image` | §24, §25 | Low (Code Injection) | High |
| 2 | Rewrite all 8 titles + meta descriptions with service + place terms. Ex: home `Luxury Hair Salon in Scottsdale, AZ \| Ryan M Scottsdale`; services `Hair Salon Services & Prices — Scottsdale \| Ryan M Scottsdale` | §2 | Low | High |
| 3 | Unpublish `/stylists-test` (stale roster, typo title, in sitemap). 301 `/ryanm-bio` + `/ryan-mckinley-bio` → `/ryan-mckinley`; repoint "Read more" | §10, §6 | Low | Med |
| 4 | One H1 per page with the page's topic; gift-card promo → H2 or button. Add H1 to `/contact`, `/products`; one H1 on `/terms` | §2, §3 | Low | Med |
| 5 | Images: convert PNG photos to JPG/WebP at display size; alt text = stylist name + role; award badges → HTML text with year + source link | §15, §6 | Med | High (perf + entity) |
| 6 | Visible "Book Appointment" button above the fold on mobile; replace hero slider with one static image | §8, §15 | Low | Med (conversion + LCP) |
| 7 | Per-page 1200×630 social image (Squarespace page → Social Image); site default share image https | §2 | Low | Low |
| 8 | Service sub-pages for top-value services (extensions, color correction, Milbon head spa, facials, Brazilian blowout): price, duration, who performs it, page-specific FAQ | §1, §3, §16 | High | High (new queries + AI answers) |
| 9 | Remove Facebook pixel from pages where ads don't need it, or load after consent/interaction; replace Google Maps embed with static map + link | §14 | Low | Med (up to ~1.9 s less main-thread time per page) |
| 10 | Text-label carousel controls; fix H1 contrast; label 6 `<nav>`s; title the Instagram iframe | §14 | Low | Low |

## Findings

No S1 (crawl/index/render blockers).

### S2 — page fundamentals

| ID | § | Finding | Evidence |
|---|---|---|---|
| F01 | §24, §25 | No local-business entity markup. Only JSON-LD = `WebSite` repeated on every page, with `"description": ""` (empty field) and protocol-relative `//images…` logo. No Organization / HairSalon / Person / BreadcrumbList. NAP, hours, prices exist as text only | JSON-LD parse, all 10 fetched pages |
| F02 | §2 | Titles = brand or one-word label + brand, all caps, no "hair salon" or service term. Home = `RYAN M SCOTTSDALE` (17 chars); others `SERVICES — RYAN M SCOTTSDALE` pattern | 8/8 pages |
| F03 | §2 | Meta description missing on `/contact`, `/ryan-mckinley`, `/stylists-test`, `/terms`. Home 76 chars; `/service` 163 chars | Raw HTML |
| F04 | §2, §3 | Home has 2 H1s; first = `GET AN ONLINE GIFT CARD!`. `/contact`, `/products`: 0 H1. `/terms`: 5 H1s. Skipped levels H1→H3 on home and `/ryan-mckinley`. Home starts with an H2 before any H1 | Raw + rendered (match) |
| F05 | §2 | `og:image` only on home: `http://` URL, 1035×414 (not 1200×630). 7/8 pages no share image. `twitter:card=summary`. No `max-image-preview:large` | Raw HTML |
| F06 | §6, §10 | `/stylists-test` indexable + in sitemap: title typo `Sylists`, no meta description, roster lists 11 names absent from live `/our-stylists` (e.g. Olivia Adamson, Brooke Stanley, Megan Miller) = stale staff facts | Diff of H2/H3 names |
| F07 | §14 | Lab performance (mobile): perf 28–38, LCP 11.8–36.0 s, TBT 1.5–3.5 s. Home 9.4 MB; est. 2.9 MB saved by sizing images. Hero LCP = JS gallery slide image. Main-thread: Squarespace JS 1.6–2.0 s, Facebook pixel 0.5–1.0 s, Google Maps 0.35–0.94 s (home, contact) | Lighthouse table below |
| F08 | §14, §15 | Accessibility: contrast failures on all 4 templates tested (H1 text on home + services); 3–4 carousel buttons without accessible name; Instagram iframe untitled; 22/24 staff headshots `alt=""` on `/our-stylists`; award images alt = filenames (`Bestofourvalley_Winner_ryanm.png`, `headings-4.png`); 6 `<nav>` with no labels | Lighthouse + raw HTML |

### S3 — content, extraction, index hygiene

| ID | § | Finding | Evidence |
|---|---|---|---|
| F09 | §10 | Duplicate owner bio: `/ryan-mckinley` (in sitemap) vs `/ryanm-bio` (99% identical text, self-canonical, linked from `/our-stylists` "Read more"). `/ryan-mckinley-bio` = 3-word 200 page (soft 404), linked from `/stylists-test` | Text similarity 0.99 / 0.01 |
| F10 | §17, §19 | Sitemap lists `https://www.ryanmscottsdale.com/home`; that page's canonical is the root URL. Sitemap ships a canonicalised URL instead of the canonical home | sitemap.xml vs `<link rel=canonical>` |
| F11 | §6 | Uncited superlatives: "the ultimate destination in luxury hair care", "Scottsdale's go-to salon". Bio claims "number one salon in Salt Lake City", "one of the 10 best salons in the USA" (New Beauty) — no year, no source link | Home, bio |
| F12 | §6, §25 | Awards ("Best of Our Valley" winner, NAHA finalist) exist only as images: no text, year or link → invisible to crawlers/AI as facts | Home raw HTML |
| F13 | §3, §8 | Home body 256 words; above-the-fold mobile = carousel + tagline, no Book button; booking CTA = announcement-bar link "Click here" | Screenshot 390×844 |
| F14 | §1, §12 | One `/service` page covers all services; no service pages, no FAQ. `/products` ≈105 words, no product names (gallery only) | Raw HTML |
| F15 | §16 | Each service price appears twice in raw HTML (Squarespace menu block `price-top` + `price-bottom`); text extractors read doubled prices | `/service` source; raw 1,081 vs rendered 813 words |
| F16 | §10 | 404 status correct, but 404 body = "About RMS" page with canonical `/about-rms`; `/about-rms` is a live 200 near-copy of home, not in sitemap | Unknown URL test |
| F17 | §12 | Generic anchors: "Read more" / "READ MORE"; "Click here" (announcement bar) | Raw HTML |

### S4 — security, measurement, polish

| ID | § | Finding | Evidence |
|---|---|---|---|
| F18 | §14 | `Strict-Transport-Security: max-age=0` (HSTS disabled); no CSP, Referrer-Policy, Permissions-Policy; `X-Frame-Options` sent twice. Platform-controlled → likely unfixable on Squarespace | Response headers |
| F19 | §27 | No GA4 / GTM / GSC meta tag in HTML; Facebook pixel on every page. GSC may be DNS-verified; Squarespace Analytics may be in use | Raw HTML |
| F20 | §18 | Training bots (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Meta-ExternalAgent …) named in robots.txt but share the `*` group → allowed. Valid default; record as owner policy decision | robots.txt |
| F21 | §17 | Contact form renders client-side (raw HTML has none of the 6 form fields; rendered DOM has all 6). Email + phone visible in raw HTML, so no extraction loss | Raw vs rendered |
| F22 | §12 | `target="_blank"` links without `rel="noopener"` (9 on home, 24 on `/our-stylists`). Modern browsers imply it | Raw HTML |
| F23 | §2 | `/contact/` returns 200 (canonical → `/contact`) instead of a redirect. Squarespace behaviour; canonical covers it | URL-form test |

## Passes

- HTTP + apex → `https://www.` in one 301 hop
- Unknown URLs return real 404
- robots.txt: no citation/search bot blocked; named bots share the full Disallow set (correct group matching); `Sitemap:` host = canonical host
- All content server-rendered; GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Googlebot, Bingbot get 200 + identical HTML
- Raw vs rendered heading counts match on 4 templates
- Self-canonicals on every page; `?utm_source=` canonicalizes to clean URL
- Sitemap `<lastmod>` varies per page (2023-10-31 → 2026-10-12), consistent with real edits
- NAP + hours + `tel:` link in server HTML; full price list with "and up" ranges on `/service` (strong AI-answer material)
- TTFB 40–160 ms; CLS 0–0.022; Lighthouse SEO 92–100
- llms.txt absent → N/A under v4.0 gate (not a defect)

## Lighthouse lab (cloud container, simulated throttling)

| Page | Perf | A11y | BP | SEO | LCP | TBT | CLS | Payload |
|---|---|---|---|---|---|---|---|---|
| Home (mobile) | 31 | 85 | 79 | 100 | 36.0 s | 3,520 ms | 0.022 | 9.4 MB |
| Home (desktop) | 57 | 80 | 78 | 100 | 4.7 s | 250 ms | 0 | 6.9 MB |
| /service | 35 | 90 | 79 | 100 | 12.7 s | 2,780 ms | 0.019 | 1.8 MB |
| /our-stylists | 38 | 96 | 79 | 92 | 14.4 s | 1,500 ms | 0.015 | 2.5 MB |
| /contact | 28 | 96 | 79 | 92 | 11.8 s | 2,920 ms | 0.015 | 2.3 MB |

## Blocked (owner access)

- GSC: Page indexing, CWV field data, Generative AI report, canonical chosen for `/home`
- CrUX / PageSpeed field data (PSI API quota exhausted on shared key)
- Google Business Profile, Bing Webmaster AI Performance, GA4 / Squarespace Analytics
- Squarespace "block AI crawlers" setting; server logs (verified-bot visits)

## Comparing against third-party tools

| Finding | Likely caught by common tools | Notes |
|---|---|---|
| F02–F05 titles, meta, H1, OG | Yes | Most checkers flag these first |
| F07 performance, F08 a11y | Yes (PSI, Lighthouse-based tools) | Lab numbers vary run to run |
| F18 HSTS / headers | Some (securityheaders-style checks) | — |
| F01 missing LocalBusiness | Some | Many only report "schema found: WebSite" as a pass |
| F09 duplicate bios, F10 sitemap `/home` | Crawlers (Screaming Frog, Sitebulb) | Needs near-duplicate + "canonicalised URL in sitemap" checks |
| F06 stale `/stylists-test` roster | Rarely | Needs fact comparison across pages |
| F11–F13 claims, awards-as-images, CTA | Rarely | Content-quality judgment |
| F15 doubled prices, F20 bot policy, P9 bot parity | Rarely | GEO-specific |

## Residual weaknesses

- [SUPPORTED] Lab performance from a cloud container; field (CrUX) data not seen. Mobile LCP 36 s on home is tied to the JS gallery hero.
- [SPECULATIVE] Real-user LCP is likely well below the 36 s lab value.
- [SUPPORTED] Phase weights and phase scores are judgment, not a published rubric; tool scores will not match the 48.
- [SUPPORTED] Bot parity tested by user-agent spoof only; IP-verified bot handling at Squarespace untested.
- [SUPPORTED] Only the 8 sitemap URLs + 14 probed URL variants were fetched; unlinked legacy pages may exist.
- [SPECULATIVE] Projected post-fix grade (65–72).
- [SPECULATIVE] "Likely caught by tools" column — based on typical checker coverage, not run.
- [SPECULATIVE] Squarespace platform limits (headers, sitemap `/home`, menu price duplication, trailing slash) assumed fixed-by-platform; not confirmed in the site's settings.

---

## Addendum — cross-check against 5 third-party checkers (2026-11-13)

Tools (home page only, all five): Backlinko/Semrush free checker 55/100 · SEOptimer (letter grade not in export) · Seobility 76% · Geoptie GEO 57/100 · Outrun 80% (B). Grade here unchanged: 48.

### Missed in this audit (each re-verified unless noted)

| ID | Finding | Flagged by | Severity | Handbook v4.0 |
|---|---|---|---|---|
| A01 | Viewport meta = `initial-scale=1`, no `width=device-width`. Page still renders responsive at 390 px and passes Lighthouse's viewport audit | Backlinko, SEOptimer, Outrun, Geoptie | S4 | Not covered (gap) |
| A02 | No SPF record, no DMARC record; mail runs on Google (MX = aspmx.l.google.com). Spoofing + deliverability risk for `info@` mail. No SEO effect | SEOptimer, Outrun | Not SEO; high for email | Out of scope |
| A03 | Backlink profile looks spam-hit: 360 of 560 backlinks use anchor "Get Higher Rankings with Expert SEO Backlinks ryanmscottsdale.com"; 219 of 387 referring domains on `.space/.store/.online/.site`. Not re-verified (single tool) | SEOptimer | Watch only: check GSC Manual actions; no disavow without one | Off-site, excluded by design |
| A04 | Ranking context (Semrush estimate): #2 for "hair salon in scottsdale" (1.9K/mo) and "hair salon scottsdale" (720/mo); home = 98% of estimated organic traffic. Not re-verified | Backlinko | Changes fix #2 risk (below) | §2: confirm queries in GSC before rewriting titles — rule existed, not applied |
| A05 | Address not machine-parseable: `15446 N GREENWAY HAYDEN LOOP <br>SUITE 1010 \| SCOTTSDALE, AZ \| 85260` in a plain `<p>`. Two tools could not find an address. Two phone link formats on home (`tel:+14803619166`, `tel:4803619166`). Audit had passed NAP | Backlinko, SEOptimer | S3 | §25 NAP covered; postal-format check not explicit (gap) |
| A06 | Brand naming inconsistent: "Ryan M Scottsdale" / "Ryan M. Scottsdale™" / "RYAN M SCOTTSDALE" / "RMS" (nav: "ABOUT RMS"); owner "Mckinley" vs "McKinley". One AI tool read the home page as a personal site for "Ryan" | Geoptie (indirect) | S3 | §25 covered — missed |
| A07 | Instagram icon link has no accessible name; no skip-to-content link | Seobility, Outrun, Backlinko | S4 | Link names covered; skip link not covered (gap) |
| A08 | In the Lighthouse data but left out of the findings: render-blocking CSS/JS (est. 0.5 s home, 5.7 s contact, lab); 5–12 static resources with short cache lifetimes; no `Cache-Control` on HTML | SEOptimer, Outrun | S4, platform-controlled | §14 / §41 P7 covered — not reported |
| A09 | Third award image `ReadersChoice2025_awards.jpg` and the footer logo have `alt=""` on home. Adds "Readers' Choice 2025" to F12 (awards as images only) | Backlinko, SEOptimer, Seobility | S3 (part of F12/F08) | Covered |
| A10 | No real-user (CrUX) data exists for this page, per the tools' PageSpeed runs (not re-verified) — lab data is all there is | Backlinko, SEOptimer | Info | — |

Not worth acting on (not in handbook, negligible): apple-touch-icon, web manifest, theme-color, `og:image:alt`, `inLanguage`, security.txt, MTA-STS, inline styles, missing Facebook/X/LinkedIn/YouTube links.

### Corrections to this audit

- Main-thread numbers were inflated by the test container: TBT here 3,520 ms vs 530–970 ms in the tools' PageSpeed runs; mobile performance 31 here vs 49. LCP agrees (36.0 s here; 38.3 / 38.6 / 45.5 s in the tools). Fix #9's "up to ~1.9 s" saving is overstated; treat as a few hundred ms.
- Fix #2 (title rewrite): the home page reportedly ranks #2 for the two main local terms with its current title. Impact on the home page is uncertain, not "High". Keep the brand in the title, check GSC queries first, change the home title last and watch it. The other 7 pages are unaffected by this caveat.
- "Blocked: CrUX / PageSpeed field data" → resolved as "none available".
- Page weight: 9.4 MB here vs 5.06 MB (SEOptimer). Different capture methods; both exceed 5 MB.

### Tool errors

| Tool | Claim | Actual |
|---|---|---|
| Backlinko | Missing robots.txt | Exists, 200, 30 user-agent lines |
| Backlinko | No XML sitemap | Exists, 200, declared in robots.txt |
| Backlinko | Missing canonical | Present (`https://www.ryanmscottsdale.com`); 3 other tools confirm |
| Backlinko | No local contact details | Phone present; address present but unparseable (A05) |
| Seobility | Server clock wrong | CDN-cached response: stale `Date` header + `Age: ~29,000 s` |
| Seobility | Title and meta description "perfect"; heading structure "perfect" | Length-only checks; page starts with H2 and skips H1→H3 |
| SEOptimer | Images optimized; cache lifetimes efficient | Its own PageSpeed block lists image delivery 20.75 s and cache 2.7 s savings |
| SEOptimer | HSTS present | Header sent with `max-age=0` (disabled) |
| Outrun | Performance signals pass | Lab LCP 36–45 s in every other tool |
| Outrun | Name AI search bots explicitly in robots.txt | Unnamed bots already inherit the `*` group (allowed); Squarespace robots.txt is not editable |
| SEOptimer, Outrun | Add llms.txt | Handbook §20: off baseline; no documented consumer |

Backlink counts disagree by up to ~80× (referring domains: 1.5K Semrush, 387 SEOptimer, 19 Seobility).

### Found here, by none of the five

F03 (4 pages with no meta description) · F04 beyond home (0-H1 and 5-H1 pages) · F05 (share image on home only, `http://`, 1035×414) · F06 (stale `/stylists-test`) · F09 (duplicate + empty bio pages) · F10 (sitemap lists `/home`) · F15 (doubled prices) · F16 (`/about-rms` as 404 body) · F18 HSTS disabled · 22 staff photos with empty alt · bot user-agent parity · raw vs rendered comparison.

### Handbook gaps exposed (candidates for the next version)

- §14 Mobile: check viewport meta contains `width=device-width`.
- §14 Accessibility: skip-to-content link.
- §7 / §25: address in standard postal format in HTML (parseable without schema); one phone link format.
- EP-1 off-site note: in AUDIT mode, log email authentication (SPF/DMARC) and backlink-spam observations to `seo-followups.md`.

### Residual weaknesses (addendum)

- [SUPPORTED] A03 and A04 rest on one tool each and are third-party estimates; not verified against GSC.
- [SUPPORTED] A02 verified with one public DNS resolver only.
- [SPECULATIVE] A01 rated low because Lighthouse passes and the 390 px render is responsive; behaviour on older or unusual mobile browsers not tested.
- [SPECULATIVE] A03 as a negative-SEO or spam-seller blast; cause not established.

---

## Addendum 2 — Semrush Site Audit cross-check (2026-11-13)

Semrush Site Audit (trial; 12 URLs crawled from links): Site Health 94%, AI Search Health 79%, 0 errors, 15 warnings. Grade here unchanged: 48.

### New (re-verified)

| ID | Finding | Severity | § |
|---|---|---|---|
| S01 | Gift-card link (nav/footer, every page) → bot user agents get 403 (GPTBot, Googlebot, SemrushBot UAs); browsers get 302 → 200. Crawlers and AI agents cannot follow it. Booking link works for bots. Both links point to URLs that redirect | S4 (third-party; fix = link the final URL) | §12 |
| S02 | `/service` price list built from `<div>`s: 0 tables, 0 lists in main content; semantic tags 2% of elements. With F15 (each price printed twice) the price list is hard for parsers to extract | S3 | §14, §16 |
| S03 | `/ryanm-bio` (the bio the team page links to) has no meta description and one incoming internal link. The sitemap lists the orphan copy `/ryan-mckinley` instead | S2 (extends F03, F09) | §2, §12, §17 |

### Corrections

- F03: 5 pages lack a meta description, not 4 — add `/ryanm-bio`.
- Passes: "full price list … strong AI-answer material" → overstated. Prices are in raw HTML (pass) but doubled and unstructured (F15, S02).
- F06, F09, F10 confirmed as sitemap orphans: Semrush's links-only crawl reached 5 of 8 sitemap URLs; `/home`, `/ryan-mckinley`, `/stylists-test` unreached.

### Agrees with this audit

Missing H1 on `/contact`, `/products` · multiple H1 on home (2) and `/terms` (5) · "Read more" anchor · thin home and `/products`.

### Semrush errors

| Claim | Actual |
|---|---|
| 0 pages with slow load speed | Measures HTML response time; lab LCP 36–45 s in every Lighthouse/PSI run |
| 0 duplicate content | `/ryan-mckinley` vs `/ryanm-bio` 99% identical; first never crawled |
| 0 orphaned pages in sitemaps; 0 incorrect sitemap pages | Its own chart: 8 sitemap URLs, 5 crawled; sitemap lists non-canonical `/home` |
| 1 page blocked from 8 AI bots | `/search`, intentionally Disallowed |
| Google-Extended listed as a blocked bot | Control token, not a crawler (§18) |
| 0 images missing alt | 22 staff photos `alt=""` |
| 7 links return 403 | One link repeated on 7 pages; 200 for browsers |

Not flagged by Semrush: HSTS `max-age=0`; missing business schema (no structured-data findings in the export); viewport value (passed). Ignored per handbook: text-HTML ratio, word-count thresholds, llms.txt.

### Still caught by no tool (6 tools)

F05 share image · F06 stale `/stylists-test` · F09 duplicate + empty bio pages · F10 sitemap `/home` · F15 doubled prices · F16 `/about-rms` as 404 body · F18 HSTS disabled · 22 staff photos `alt=""` · bot-UA parity · raw vs rendered comparison. (Semrush newly caught F03 partly and F04 beyond home.)

### Residual weaknesses (addendum 2)

- [SUPPORTED] S01 tested by user-agent string only; the gift-card platform's handling of verified bot IPs is unknown.
- [SUPPORTED] Semrush's crawl source inferred from its sitemap-vs-crawled chart.
