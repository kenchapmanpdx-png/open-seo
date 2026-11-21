# salonvata.com — OpenSEO app vs Semrush Site Audit (v3, 2026-11-19 23:55)

v2 = v1 + Semrush full export (5 XLSX: mega export, issues, pages, structured data, JS impact) + browser verification of disputed findings + full Semrush check catalog mapped to app coverage. Nothing from v1 removed; corrections marked **[v2]**.

v3 = v2 + app Handbook run (run 3) vs Semrush. Nothing from v2 removed; corrections marked **[v3]**.

## Runs

| Run | When (AZ) | Source | Limit | Crawled | Notes |
|---|---|---|---|---|---|
| Semrush (trial acct 2) | 22:27–22:44 | robots.txt sitemap | 100 | 71 URLs (62 HTML + sitemaps, robots, llms.txt, www→apex 301) | Mobile UA, JS render on, crawl delay = robots.txt (`Crawl-delay: 10`), schedule Once |
| App run 1 | 18:26 | links | 50 | 50 | Cap hit. 12 core pages never crawled (below) |
| App run 2 | 22:47–22:59 | sitemap + links | 200 | 155 | All core pages. Handbook OFF (toggle was never saved on) |
| App run 3 | 23:00 | sitemap + links | 200 | unknown | Handbook ON. App then errored: "Something went wrong" + "could not verify DataForSEO setup" on every page. No results readable. **[v3]** Fixed by restarting sidecar + app (23:35); Handbook run had completed: 56 findings, grade F 34.5/100 (provisional: render evidence missing) |

- Blocking: none. Semrush 0 blocked pages; app 155 URLs fetched. One crawler at a time; Semrush and app never overlapped.
- App run 1 missed: `/services/`, `/services/hair/`, `/services/skincare/`, `/services/waxing/`, `/services/wedding-special-event-makeup-hair/`, `/about/`, `/about/contact/`, `/about/location/`, `/hair-extensions/`, `/meet-the-staff/`, `/meet-the-staff-2/`, `/teeth-whitening/`. Cause: 50-page cap filled by WordPress image-attachment pages.
- **[v2]** Semrush sitemap mode reports crawl depth 0 for every URL: depth and "orphaned sitemap pages" checks are meaningless in this mode.

## Scores (not comparable)

- Semrush: Site Health 75%, AI Search Health 85%, 132 errors, 1,309 warnings, 0 pages blocked from AI bots. 101 checks run; 22 failed.
- App run 2: 84 critical, 214 warning, 93 info.

## Finding-by-finding (Semrush vs app run 2)

| Finding | Semrush | App | Winner |
|---|---|---|---|
| Broken internal links: 8 dead targets linked from 84 pages — `/?page_id=15790` (sitewide), `/specials/`, `/eyelash-extensions/`, `/about/careers/` (home); `/nail-services/`, `/hair-services/`, `/contact-vata-salon/` (`/about/`, `/services/`); `/about-vata-salon/stylists/` (`/about/`) | **missed** (0 failed of 1,474 internal links checked) | Critical, 84 pages + 8 × 4xx | **App** |
| Broken internal image: logo `/wp-content/uploads/2016/07/vata-logo.png` 404 on 64 pages | Error, 64 (of 959 images checked) | **missed** | **Semrush** |
| Broken external links: `http://myhairgirlmichele` (`/meet-the-staff/`); `pureprivilege.com/templates/home/?SET_LOCALE=us` (`/why-aveda/pure-privilege/`) | Warning, 2 (of 134) | **missed** | **Semrush** |
| Links with no anchor text (4) / non-descriptive anchor (4) | Notice | missed | Semrush |
| HSTS not supported (2 hosts) | Notice | not in Site Audit (Handbook has it) | Semrush (Site Audit layer) |
| Duplicate meta description | 47 | 47 | Tie |
| Duplicate content | 10 | 10 | Tie |
| Missing H1 | 7 | 7 | Tie |
| Slow page | 1 (`/privacy-policy/`, HTML load 5.7 s) | 1 (slow server response) | Tie |
| Duplicate title | 10 | 14 | App (also crawled tag archives) |
| Missing meta description | 4 | 15 | App (more pages) |
| Orphan pages | 6 "only one incoming link"; "Orphaned sitemap pages" 0 checked | 2 true orphans: `/cpt_staff_lst/meet-the-staff/`, `/home/promo-gift/` | **[v2] Both under-report** (below) |
| Noindex pages | — | 2 | App |
| Images missing alt | 124 images | 73 pages | Both (units differ) |
| Thin / low word count | 49 | 38 | Both (thresholds differ) |
| Title too long | 1 | 17 (info) | Thresholds differ |
| Heading levels skip | — | 73 (info) | App; low value |
| Unminified JS/CSS 992; too many JS/CSS 62; low text-HTML ratio 62 | Warning | — | Noise (counts = resource × page; handbook ignores text-HTML ratio; Lighthouse covers speed) |
| Underscores in URL 6 | Warning | — | Noise (all attachment pages) |
| Resources formatted as page links 48 | Notice | — | Symptom of attachment pages |
| llms.txt 404 | AI Search issue | — | Ignore (handbook: no proven effect) |
| 1 nofollow external link | Notice | — | Ignore |
| **[v2]** Structured data | 0 markup errors (315 items checked); every page tagged "Software App items" | not checked in Site Audit (Handbook pending) | **Neither** (below) |
| **[v2]** JS/CSS weight: 131 files, ~957 KB on every template | "Too many JS/CSS" 62 | — | Semrush (report once per template) |
| **[v2]** JS rendering changes | 1 page changed (home: +3 words, +2 links after JS); 61 unchanged | Rendering off (no Context.dev key; Handbook sidecar renders) | Semrush; low impact here |

## [v2] Verified in a real browser (2026-11-19 23:30)

| Item | Result |
|---|---|
| `/specials/` | Title "Page not found » Vata Hair Salon & Spa" |
| Home menu "Careers" | `href="https://salonvata.com/?page_id=15790"` (404 per app) |
| Home menu "Eyelash Extensions & Lift" | `/eyelash-extensions/` (404 per app) |
| Home "5-time Winner of Best of Clark County" | `/about/careers/` (404 per app) |
| Logo `vata-logo.png` on home | Loaded twice, `naturalWidth` 0 (broken) |
| Home JSON-LD | `WebPage`, `BreadcrumbList`, `WebSite` "Vata Hair Salon & Spa", `BeautySalon` "Vata Salon + Spa" (205 W 6th St, Vancouver WA), `WebSite` "Vata Salon", `LocalBusiness` "Vata Salon"; microdata `WebPage`, `BeautySalon`, `PostalAddress`. No `SoftwareApplication` |

Conclusion: the app's broken-internal-link finding is real; Semrush checked 1,474 internal links and missed all 8 dead targets.

## [v2] Orphans: both tools under-report

- Semrush pages export: 37 sitemap HTML URLs have **0 incoming internal links**: 11 under `/about/` + `/about/location/` (attachments), 7 under `/home/`, 7 under `/teeth-whitening/`, 5 `/services/cavitation*`, 3 `/services/hair-style-*`, `/services/wedding-special-event-makeup-hair/microblading-01/`, `/meet-the-staff-2/bookonlinebutton/`, `/why-aveda/22-1103-interiorheader-p1-01/`, `/cpt_staff_lst/meet-the-staff/`.
- Semrush issue list: "Orphaned sitemap pages" 0 checks (needs a links crawl). App: 2.
- Data to fix the app's orphan check is in Semrush's own export.

## [v2] Structured data: neither tool flagged

- 3 business entities on home with 2 names: `BeautySalon` "Vata Salon + Spa" (JSON-LD), `LocalBusiness` "Vata Salon" (JSON-LD), `BeautySalon` (microdata). 2 `WebSite` nodes: "Vata Hair Salon & Spa" and "Vata Salon".
- Effect: Google and AI answers get conflicting business names. Fix: one `BeautySalon` node, one name ("Vata Hair Salon & Spa", matching titles), one `@id`; remove duplicate plugin/theme output.
- Semrush "Software App items" on 62 pages: no `SoftwareApplication` in the home JSON-LD → Semrush misclassification.

## Root causes neither tool named

| Root cause | Evidence | Fix |
|---|---|---|
| WordPress attachment pages indexed (~35 URLs): image files served as pages with filename titles (`Y69A5865`, `thumbnail (1)`, `46337844_2216…_n`) | Sitemap index includes `attachment-sitemap.xml`; drives most thin, duplicate-title, duplicate-content, underscore and alt counts in both tools; **[v2]** these are the 37 zero-link sitemap URLs | Yoast → Search appearance → Media: redirect attachment URLs to the file; drop attachment sitemap |
| Theme demo leftovers indexed: `/portugal-2013-road-trip-gallery/`, `/recent-trends-in-storytelling/`, `/supernatural-fx-showreel/`, `/services/hair-style-one\|two\|three/`, `/services/cavitation*` variants, `/category/art\|business\|sport/`, 9 `/tag/*` archives, `/author/imaginal-admin/` | Both tools list them only as thin/duplicate pages | Delete or noindex; remove from sitemap |
| Old URL structure still linked in content/nav (`/hair-services/`, `/contact-vata-salon/`, `/about-vata-salon/stylists/`) | App 404 list | 301 old URLs to current pages; fix menu item `?page_id=15790` |
| **[v2]** Duplicate schema output (theme + SEO plugin both emit business/site nodes) | 3 business + 2 WebSite nodes, different names | Keep one source (Yoast or theme), disable the other |

## Verdict

| | Semrush | App |
|---|---|---|
| Strengths | Resource status (images, external links), anchor text, HSTS, AI-bot block check, JS-render diff, polite crawl controls, per-page JS/CSS weight, full export | Broken internal links (biggest real issue on this site), sitemap + links crawl, noindex, finds more pages. **[v2]** v1 listed "true orphans" here; removed: app found 2 of 37 |
| Weaknesses | Sitemap-only crawl missed every dead internal link; orphan check off in sitemap mode; no schema conflict check; mislabels schema types; inflated counts; no root-cause grouping | No image/external link status; orphan check misses 35 of 37 (**[v3]** Site Audit only; Handbook F16 finds all 37); default cap starves real pages; Handbook off by default and easy to miss; crashed after Handbook-enabled run |

## Training backlog for the app

| # | Change | Priority |
|---|---|---|
| T1 | Status-check every linked resource: `<img>`, CSS/JS, external `<a>` (HEAD, GET fallback, browser UA re-test on 403). Handbook `headers-collector` samples only the first image/script/stylesheet | Must |
| T2 | Crawl priority: page/post sitemaps and nav links before attachment/tag/author sitemaps; default limit "whole site" or ≥200 | Must |
| T3 | Handbook ON by default for new projects; run-1 page shows "Handbook not run" | Must |
| T4 | Fix crash after Handbook-enabled audit (app-wide "Something went wrong"; DataForSEO verify banner) | Must |
| T5 | Root-cause rule: WordPress attachment pages (title = filename, path under parent page, single image, <150 words, `attachment-sitemap.xml` present) → one finding, not 5 symptom lists | Should |
| T6 | Root-cause rule: theme demo content (known demo slugs, `hair-style-one`, demo blog posts, default categories) | Should |
| T7 | Anchor-text checks: empty and generic ("click here", "read more"). Handbook `crawl.supp-links` covers generic internal anchors only | Should |
| T8 | HSTS in Site Audit summary (already in Handbook `headers.security-by-value`) | Nice |
| **T9 [v2]** | Orphan check: count incoming links from all crawled HTML; flag sitemap URLs with 0 (target: 37 on this site) and with 1 ("weak"). **[v3]** Handbook F16 already finds 37: reuse its logic in Site Audit; add the 1-link "weak" case | Must → Should |
| **T10 [v2]** | Entity-consistency check: >1 business node or >1 `WebSite` node, or differing `name` values across JSON-LD + microdata. **[v3]** Handbook partly covers (F25 spelling via AI judge, F10 no stable @id, F31, F32); still missing a deterministic node-count/name-diff rule | Should |
| **T11 [v2]** | Golden-set regression: add salonvata.com with the verified findings above (8 dead targets, broken logo, 2 dead external links, 37 orphans, entity conflict, attachment + demo root causes) | Must |
| **T12 [v2]** | Template-level reporting for per-page repeats (JS/CSS weight, logo): one finding per template with page count | Should |
| **T13 [v2]** | Add 19 Semrush-only checks marked GAP in the catalog below, by priority in its Note column | Should |
| Skip | text-HTML ratio, unminified counts, underscores, llms.txt, nofollow, AMP, URL length | — |

## [v2] Semrush check catalog → app coverage (101 checks)

Coverage key: SA = app Site Audit (`src/shared/audit-issues.ts`); HB = Handbook check exists by name in `src/server/features/handbook/checks/` (behavior not verified unless noted); GAP = not in app; SKIP = no ranking/GEO value per handbook. Totals: SA 23 · HB 40 · GAP 19 · SKIP 19. Fork read at `363194f` (ken/main, 2026-11-19 13:35).

| Semrush check | Type | Failed / checked (salonvata) | App coverage | App check | Note |
|---|---|---|---|---|---|
| 5xx errors | ERROR | 0 / 70 | SA | server-error |  |
| 4xx errors | ERROR | 0 / 70 | SA | broken-page |  |
| Title tag is missing or empty | ERROR | 0 / 62 | SA | missing-title |  |
| Blocked from crawling | NOTICE | 0 / 62 | SA | blocked-page |  |
| Duplicate title tag | ERROR | 10 / 3906 | SA | duplicate-title |  |
| Duplicate content | ERROR | 10 / 72 | SA | duplicate-content | HB duplicates.ts too |
| Broken internal links | ERROR | 0 / 1474 | SA | broken-internal-link | App caught 8 targets/84 pages; Semrush 0 |
| Pages not crawled | ERROR | 0 / 70 | SA | crawl-* limits |  |
| DNS resolution issue | ERROR | 0 / 70 | GAP | — | Low value; fetch error covers it |
| We couldn't open the page's URL | ERROR | 0 / 0 | SA | blocked-page / fetch error |  |
| Broken external links | WARNING | 2 / 134 | HB | botfetch.outbound-links | Not in Site Audit; add (T1) |
| Broken internal images | ERROR | 64 / 959 | GAP | HB headers-collector samples 1 image only | Add full image status check (T1) |
| Broken external images | WARNING | 0 / 2 | GAP | — | Add with T1 |
| Duplicate meta descriptions | ERROR | 47 / 3906 | SA | duplicate-meta-description |  |
| Invalid robots.txt format | ERROR | 0 / 1 | HB | robots-groups |  |
| Invalid sitemap.xml format | ERROR | 0 / 6 | HB | url-inventory / sitemap-lastmod | SPECULATIVE coverage |
| Incorrect pages found in sitemap.xml | ERROR | 0 / 62 | HB | url-inventory | SPECULATIVE coverage |
| www resolve issues | ERROR | 0 / 2 | HB | url-variants |  |
| Viewport not configured | ERROR | 0 / 62 | HB | head-tags | SPECULATIVE coverage |
| Large HTML page size | ERROR | 0 / 63 | HB | lab-performance / image-weight | SPECULATIVE coverage |
| Missing canonical tags in AMP pages | ERROR | 0 / 0 | SKIP | — | AMP |
| Issues with hreflang values | ERROR | 0 / 0 | HB | hreflang |  |
| Hreflang conflicts within page source code | ERROR | 0 / 0 | HB | hreflang |  |
| Issues with incorrect hreflang links | ERROR | 0 / 0 | HB | hreflang |  |
| Non-secure pages | ERROR | 0 / 0 | HB | url-variants | SPECULATIVE coverage |
| Certificate Expiration | ERROR | 0 / 2 | GAP | — | Cheap TLS check; Nice |
| Old security protocol version | ERROR | 0 / 2 | GAP | — | Nice |
| Certificate registered to incorrect name | ERROR | 0 / 2 | GAP | — | Nice |
| Issues with mixed content | ERROR | 0 / 9971 | GAP | — | Should; render-parity may see it SPECULATIVE |
| Links lead to HTTP pages for HTTPS site | WARNING | 0 / 1517 | GAP | — | Should |
| Neither canonical URL nor 301 redirect from HTTP homepage | ERROR | 0 / 0 | HB | url-variants |  |
| Redirect chains and loops | ERROR | 0 / 9900 | SA | redirect-chain / redirect-loop |  |
| AMP Pages with HTML Issues | ERROR | 0 / 0 | SKIP | — | AMP |
| AMP Pages with Style and Layout Issues | ERROR | 0 / 0 | SKIP | — | AMP |
| AMP Pages with Templating Issues | ERROR | 0 / 0 | SKIP | — | AMP |
| Broken canonical URLs | ERROR | 0 / 62 | HB | canonical-form |  |
| Multiple canonical URLs | ERROR | 0 / 62 | SA | canonical-conflict |  |
| Meta refresh redirects | ERROR | 0 / 62 | GAP | — | Should |
| Broken internal JavaScript and CSS files | ERROR | 0 / 7633 | GAP | HB headers-collector samples 1 each | Add with T1 |
| Insecure encryption algorithms | ERROR | 0 / 2 | GAP | — | Nice |
| Sitemap file too large | ERROR | 0 / 6 | HB | url-inventory | SPECULATIVE coverage |
| Malformed links | ERROR | 0 / 1853 | GAP | — | Should |
| Structured data that contains markup errors | ERROR | 0 / 315 | HB | jsonld-integrity / schema-* | App deeper: Semrush 0 errors while site has 3 business entities with 2 names |
| Viewport width not set | ERROR | 0 / 62 | HB | head-tags | SPECULATIVE coverage |
| Title element is too short | WARNING | 0 / 62 | SA | title-too-short |  |
| Title element is too long | WARNING | 1 / 62 | SA | title-too-long | Thresholds differ: app 17, Semrush 1 |
| Missing h1 | WARNING | 7 / 62 | SA | missing-h1 |  |
| Multiple h1 tags | NOTICE | 0 / 55 | SA | multiple-h1 |  |
| Duplicate content in h1 and title | WARNING | 0 / 55 | SKIP | — | No ranking evidence |
| Missing meta description | WARNING | 4 / 62 | SA | missing-meta-description |  |
| Too many on-page links | WARNING | 0 / 62 | SKIP | — | No ranking evidence |
| Temporary redirects | WARNING | 0 / 9900 | GAP | — | Should: 302s on internal links |
| Missing ALT attributes | WARNING | 124 / 435 | SA | images-missing-alt | HB a11y-markup too |
| Slow page load speed | ERROR | 1 / 62 | SA | slow-response | HB lab-performance = real LCP |
| Low text to HTML ratio | WARNING | 62 / 62 | SKIP | — | Handbook rule: ignore |
| Too many URL parameters | WARNING | 0 / 62 | SKIP | — | Low value |
| Missing hreflang and lang attributes | WARNING | 0 / 62 | HB | hreflang / head-tags | lang attr SPECULATIVE |
| Encoding not declared | WARNING | 0 / 62 | HB | head-tags | SPECULATIVE coverage |
| Doctype not declared | WARNING | 0 / 62 | GAP | — | Nice |
| Low word count | WARNING | 49 / 62 | SA | thin-content | Thresholds differ |
| Incompatible plugins used | WARNING | 0 / 62 | SKIP | — | Flash/Java era |
| Frames used | WARNING | 0 / 62 | SKIP | — | Rare |
| Underscores in URL | WARNING | 6 / 62 | SKIP | — | No ranking effect |
| Nofollow attributes in internal links | WARNING | 0 / 1469 | HB | supp-links | SPECULATIVE coverage |
| Sitemap.xml not specified in robots.txt | WARNING | 0 / 1 | HB | robots-groups / url-inventory | SPECULATIVE coverage |
| Sitemap.xml not found | WARNING | 0 / 6 | HB | url-inventory |  |
| HTTPS encryption not used | WARNING | 0 / 0 | HB | url-variants |  |
| No SNI support | WARNING | 0 / 2 | SKIP | — | Rare |
| HTTP URLs in sitemap.xml for HTTPS site | WARNING | 0 / 62 | HB | url-inventory | SPECULATIVE coverage |
| Uncompressed pages | WARNING | 0 / 62 | HB | cache-policy | SPECULATIVE coverage |
| Disallowed internal resources | WARNING | 0 / 8110 | HB | render-resources |  |
| Uncompressed JavaScript and CSS files | WARNING | 0 / 7819 | HB | cache-policy | SPECULATIVE coverage |
| Uncached JavaScript and CSS files | WARNING | 0 / 7819 | HB | cache-policy |  |
| Too large JavaScript and CSS total size | WARNING | 0 / 63 | HB | lab-performance | Site: 131 files / ~957 KB per page |
| Too many JavaScript and CSS files | WARNING | 62 / 62 | HB | lab-performance | Report once per template, not per page |
| Unminified JavaScript and CSS files | WARNING | 992 / 7819 | SKIP | — | Lighthouse covers; count per resource×page is noise |
| Warning - Too long URLs | WARNING | 0 / 1853 | SKIP | — | Low value |
| Llms.txt not found | NOTICE | 1 / 1 | SKIP | — | Handbook: no proven effect |
| Too long URLs | NOTICE | 0 / 62 | SKIP | — | Low value |
| Nofollow attributes in external links | NOTICE | 1 / 322 | SKIP | — | Info only |
| Robots.txt not found | NOTICE | 0 / 1 | HB | robots-groups |  |
| Hreflang language mismatch issues | NOTICE | 0 / 0 | HB | hreflang |  |
| No HSTS support | NOTICE | 2 / 2 | HB | headers.security-by-value | Not in Site Audit summary (T8) |
| Orphaned pages (Google Analytics) | NOTICE | 0 / 0 | GAP | — | App has GA4 connected: add GA-landing vs crawl diff |
| Orphaned sitemap pages | NOTICE | 0 / 0 | SA | orphan-page | Both under-report: 37 sitemap URLs have 0 incoming links (Semrush export); app flagged 2 |
| Pages have high Document Interactive Time | NOTICE | 0 / 0 | HB | lab-performance |  |
| Blocked by X-Robots-Tag: noindex HTTP header | NOTICE | 0 / 0 | SA | noindex-page | Header form SPECULATIVE |
| Disallowed external resources | NOTICE | 0 / 187 | HB | render-resources | SPECULATIVE coverage |
| Broken external JavaScript and CSS files | NOTICE | 0 / 186 | GAP | — | Add with T1 |
| Page crawl depth | NOTICE | 0 / 63 | SA | deep-page |  |
| Pages with only one internal link | NOTICE | 6 / 62 | GAP | — | Should: weak-link pages, not just orphans |
| Permanent redirects | NOTICE | 0 / 9900 | HB | redirected-links |  |
| Resources formatted as page links | NOTICE | 48 / 1838 | GAP | — | Symptom of WP attachment pages; fold into T5 |
| Links with no anchor text | NOTICE | 4 / 612 | GAP | HB supp-links covers generic, not empty | Add empty-anchor case (T7) |
| Links with non-descriptive anchor text | NOTICE | 4 / 606 | HB | crawl.supp-links |  |
| External pages or resources with 403 HTTP status code | NOTICE | 0 / 321 | HB | botfetch.outbound-links | Browser-UA retest rule |
| Llms.txt has formatting issues | NOTICE | 0 / 1 | SKIP | — | Handbook: no proven effect |
| Too much content | NOTICE | 0 / 62 | SKIP | — | No ranking evidence |
| Outdated content | NOTICE | 0 / 62 | HB | sitemap-lastmod / llm-content | SPECULATIVE coverage |
| Low Semantic HTML usage | NOTICE | 0 / 62 | HB | page-structure |  |
| Content not optimized | NOTICE | 0 / 62 | HB | llm-content / supp-aeo | SPECULATIVE coverage |

## [v3] Handbook run vs Semrush (app run 3, 2026-11-19 23:00)

Grade F 34.5/100, provisional ("render evidence is missing, so JS-only content and S1 render defects are not counted"). Cause: sidecar not started with its token at run time. 56 findings (S2 13, S3 35, S4 8).

| Phase | Weight | Score | Driver |
|---|---|---|---|
| P2 | 15 | 33.3 | F14 detail pages not linked from any index page; F56 URL slugs break slug rules |
| P3 | 15 | 76.9 | F15 links to retired URLs; F16 orphan sitemap URLs |
| P4 | 15 | 18.2 | F01 duplicate titles/descriptions/H1s; F02 missing title or not exactly one H1 |
| P5 | 15 | 38.5 | F24 opening sentences; F25 entity/name spelling |
| P6 | 15 | 30 | F08 WebSite node incomplete; F09 empty JSON-LD values |
| P7 | 10 | 25 | F33–F47 images without dimensions / hero not prioritised |
| P8 | 10 | 0 | F13 skip link / names / alts; F61 security headers missing |
| P9 | 5 | 50 | F62 AI-bot policy split |

### Findings list

| ID | Sev | Finding | Items |
|---|---|---|---|
| F01 | S2 | Duplicate titles, descriptions or H1s (one description on 36 pages, another on 11) | 72 |
| F02 | S2 | Missing title or not exactly one H1 (home + 6) | 7 |
| F03 | S2 | Titles/H1s don't state offer or topic (AI judge 0.90) | — |
| F04 | S2 | Indexable pages without meta description (tag/category archives, staff CPT) | 13 |
| F05 | S2 | Viewport blocks zoom (`user-scalable=no`) | 71 |
| F06 | S2 | Hub titles are bare labels (AI judge 0.93) | — |
| F07 | S2 | Heading order / landmarks: 0 `<main>`, nav/footer labels as h3/h5, skips; demo lorem ipsum in headings ("Far far away, behind the word mountains…") | 73 |
| F08 | S2 | Home WebSite node missing alternateName | 1 |
| F09 | S2 | JSON-LD empty values (`@id`, contactPoint email/contactOption/areaServed) | 80 |
| F10 | S2 | Organization nodes lack one stable @id | 80 |
| F11 | S2 | Article JSON-LD date/isPartOf/name gaps | 3 |
| F12 | S2 | Index/detail templates lack ItemList / BreadcrumbList | 5 |
| F13 | S2 | Skip link / accessible names / image alts | 74 |
| F14 | S3 | Detail pages not linked from any index page | 34 |
| F15 | S3 | Internal links to retired URLs: `/about/careers/`, `/specials/`, `/eyelash-extensions/`, `/hair-services/`, `/nail-services/`, `/contact-vata-salon/`, `/about-vata-salon/stylists/` (all 404) | 7 |
| F16 | S3 | Sitemap URLs without an internal link (orphans) | 37 |
| F17 | S3 | Test/draft URL in sitemap: `/home/67-st15_2234_r3_crop-copy-copy/` | 1 |
| F18 | S3 | Indexable pages missing from sitemap (tag archives) | 9 |
| F19 | S3 | Near-duplicate pages (≥ 80 % same main text) | 8 |
| F20 | S3 | Thin pages (< 50 main-content words) | 20 |
| F21 | S3 | Hard-coded years in evergreen headings | 1 |
| F22 | S3 | Missing Open Graph / Twitter tags | 13 |
| F23 | S3 | Share image not 1200×630 | 69 |
| F24 | S3 | Opening sentences don't name brand, subject, offer | — |
| F25 | S3 | Brand spelled more than one way: "Vata Salon + Spa", "Vata Salon & Spa", "Vata Hair Salon & Spa" (AI judge 0.85) | — |
| F26 | S3 | Local/service pages not distinct | — |
| F27 | S3 | No site-wide link to editorial/review standards | 1 |
| F28 | S3 | Awards/press as images or unsourced | — |
| F29 | S3 | Detail pages lack key-facts block | — |
| F30 | S3 | About-page people not marked up | — |
| F31 | S3 | Brand not disambiguated in schema (0 sameAs) | 1 |
| F32 | S3 | LocalBusiness uses the generic type | 80 |
| F33–F47 | S3 | Images without dimensions / hero not prioritised (15 separate findings, one per group) | 1–13 each |
| F48 | S3 | Render-blocking scripts / font CSS in `<head>` | 73 |
| F49 | S3 | Cache policy: hashed assets not immutable / HTML not revalidated | 73 |
| F56 | S4 | URL slugs break slug rules | 6 |
| F57 | S4 | http/www variants reach canonical in 2 hops (want 1) | 1 |
| F58 | S4 | `/page/2/` serves the homepage (200, same 318 words) | 1 |
| F59 | S4 | `target="_blank"` without `rel="noopener"` | 80 |
| F60 | S4 | Outbound links broken or redirected (see below) | 14 |
| F61 | S4 | Security headers missing: HSTS, CSP, frame-ancestors/XFO, nosniff, Referrer-Policy, Permissions-Policy | 1 |
| F62 | S4 | AI-bot policy split: robots.txt allows Bytespider, server returns 403 | 1 |

F60 items: dead `http://myhairgirlmichele/`, `http://www.pureprivilege.com/templates/home/?SET_LOCALE=us`; 403 `aveda.com/salon/vatasalon`, `aveda.com/ShopAveda.tmpl?SalonID=301055`, `…SalonID=0000`, `aveda.com/discover/index.tmpl`, `yelp.com/biz/vata-salon-and-spa-aveda-vancouver`; 400 `facebook.com/VataSalonAveda/` (×2 forms); 302 `instagram.com/vatasalon/`; 301 `fbj.glossgenius.com`, `simonedenny.glossgenius.com`, `atfirstsite.glossgenius.com`, `squareup.com/appointments/book/89NJ6NW27SJQE`.

### Handbook vs Semrush

| Finding | Semrush | Handbook | Site Audit (run 2) | Best |
|---|---|---|---|---|
| Dead internal link targets | 0 | 7 (misses `?page_id=15790`) | 8 | Site Audit |
| Orphan sitemap URLs | 0 (check off) | **37** | 2 | Handbook |
| Broken logo image (64 pages) | ✓ | **missed** | missed | Semrush |
| Dead external links (2) | ✓ | ✓ (+12 platform blocks/redirects, mixed in) | missed | Tie (Semrush cleaner) |
| Viewport blocks zoom (71 pages) | **missed** ("Viewport not configured" 0) | ✓ | — | Handbook |
| Business-name conflict | missed | ✓ partial (F25, F10, F31, F32) | — | Handbook |
| Empty JSON-LD values (80) | missed (0 markup errors) | ✓ | — | Handbook |
| Redirect hops http/www → canonical (2) | missed (chains 0) | ✓ | — | Handbook |
| `/page/2/` duplicate of home | missed | ✓ | — | Handbook |
| AI bot blocked by server (Bytespider 403) | missed (0 blocked) | ✓ | — | Handbook |
| Test/draft URL in sitemap | missed | ✓ | — | Handbook |
| Indexable pages not in sitemap (tags) | n/a (sitemap mode) | ✓ 9 | — | Handbook |
| HSTS + other security headers | HSTS only | ✓ all | — | Handbook |
| Heading/landmark structure, no `<main>` | missed | ✓ 73 | heading skip only | Handbook |
| Demo lorem ipsum text | missed | visible inside F07 evidence only | — | Neither (no dedicated finding) |
| Render-blocking head, cache policy | unminified/too many (noise) | ✓ F48, F49 | — | Handbook |
| Duplicate titles/descriptions/H1s | ✓ | ✓ (one finding, all three) | ✓ | Tie |
| Missing H1 | 7 | 7 | 7 | Tie |
| Images without dimensions | — | ✓ but split into 15 findings | — | Handbook (needs grouping) |
| Empty / non-descriptive anchors | ✓ 4/4 | not in this run | — | Semrush |
| Attachment + demo root causes | no | no (symptoms only) | no | Neither |

### [v3] Handbook weaknesses (new training items)

| # | Change | Priority |
|---|---|---|
| T14 | F15: include query-string targets (`?page_id=15790`, sitewide Careers menu item) | Must |
| T15 | F60: split "dead" (DNS fail, 404/410) from "platform blocks bots" (Facebook 400, Yelp/Aveda 403, Instagram 302) and "redirects"; only dead = finding, rest = info | Must |
| T16 | Group F33–F47 (same title, 15 rows) into one finding with page groups | Should |
| T17 | Dedicated demo-content finding: lorem ipsum / "Far far away, behind the word mountains" / theme demo slugs (pairs with T6) | Should |
| T18 | Runs without render evidence: block the run or show a clear "sidecar down — start it" banner before grading (this run graded provisional silently on the project list: "0 findings, —") | Must |
| T19 | Project Handbook list shows "0 findings / —" for a run with 56 findings | Must (bug) |
| T20 | Broken-image check in Handbook (T1 also applies here) | Must |

### [v3] Residual weaknesses

- SUPPORTED: Handbook findings read from the run page (`/handbook/hb-b634ee10-…`), 2026-11-19 23:45.
- SUPPORTED: F15 7 targets match Site Audit and the browser check; `?page_id=15790` absent from F15.
- SPECULATIVE: F60 403/400 results are platform bot-blocking, not dead links; Semrush reported 0 external 403s from its crawler. Not browser-verified.
- SPECULATIVE: provisional grade will drop or hold after a render-enabled rerun; S1 render defects untested.
- SPECULATIVE: list-page "0 findings" is a display bug, not a second empty run.

## Still open

- ~~Handbook vs Semrush comparison: blocked by app crash after run 3.~~ **[v3]** done (section above).
- **[v3]** Handbook render checks: rerun with the sidecar up (run 3 grade provisional).
- ~~Semrush full issue export not downloaded~~ **[v2]** done (5 XLSX).

## Residual weaknesses

- SUPPORTED: 4 of 8 dead internal targets verified in a real browser (`/specials/` 404 page; Careers, Eyelash, Best-of links present on home); other 4 from app output only.
- SUPPORTED: logo broken (browser `naturalWidth` 0).
- SUPPORTED: Semrush checked 1,474 internal links, 0 failed (issues export).
- SUPPORTED: Semrush miss of internal broken links observed on this run only (sitemap source).
- SUPPORTED: `/specials/` also returned 4xx to an independent fetch.
- SUPPORTED: 37 zero-incoming-link sitemap URLs (Semrush pages export).
- SPECULATIVE: Semrush missed the dead links because sitemap mode doesn't status-check targets outside the sitemap; a "Website" crawl may catch them.
- SPECULATIVE: app crash cause (Supabase connection limit during Handbook run, or service restart).
- SPECULATIVE: app run 2 listed many attachment paths as both 301 and 200; likely http/www variants, not verified.
- SPECULATIVE: "HB" rows mean a check file with that name exists; coverage of each Semrush check not tested. Handbook may already catch the broken logo (headers-collector samples first image). **[v3]** It did not: no `vata-logo` mention in run 3.
- SPECULATIVE: schema conflict seen on home only; other templates assumed identical (Semrush shows Local Business items on all 62 pages).
- SPECULATIVE: Semrush "Software App items" label is a misclassification; checked home only.
