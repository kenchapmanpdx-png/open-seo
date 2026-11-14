# SEO/GEO Audit — whyracingevents.com

- Handbook: on-site SEO/GEO reference v4.2 · first run scored item-by-item under EP-7
- Date: 2026-11-13 · Mode: REVIEW (read-only, no owner access) · Tier: T3 (collection: `/events` index + 18 event detail pages)
- Platform: own stack on Vercel (`Server: Vercel`). Static `/pages/*.html` + server-rendered `/events/<slug>`. Supabase backend (events, team, calendar). Registration is off-site (RunSignUp, UltraSignup). No hosted-builder limits apply, so every finding is FIXABLE.
- Evidence:
  - Raw HTML of 33 crawled URLs (sitemap + links; 30 × 200, 3 × 302) plus 20 probed URL variants and legacy paths.
  - robots.txt, tested with `urllib.robotparser` and Protego. Sitemap with `<lastmod>`. llms.txt and `.md` mirrors.
  - Response headers by value. Bot-user-agent parity across 6 bots.
  - Headless Chrome render with JS on (4 templates) and JS off (4 templates). Mobile first-screen screenshots (3 templates).
  - 99 outbound URLs, each tested with a browser user agent and a bot user agent; WAF-blocked ones re-tested in headless Chrome.
  - Lighthouse 12 CLI: 5 templates mobile + home desktop.
  - DNS (TXT/MX/DMARC); HSTS preload API.
  - Not available: GSC, CrUX (PSI API 429), Rich Results Test.
- Independence: all evidence was collected before the Semrush exports arrived. Semrush is compared in the Addendum. The one finding added because of Semrush is marked `(post-Semrush)`.

## Grade: 39 / 100 — F (capped; 54 / D uncapped)

Cap rule (EP-7): any open S1 limits the total to 39. The S1 here is F01, JavaScript-only core content. Fixing F01 alone lifts the grade to the uncapped score (~54, D) or higher.

| Phase | Weight | Score | Driver |
|---|---|---|---|
| P2 Architecture + rendering | 15 | 44 | Team bios + home calendar are JS-only; error strings sit in raw HTML; opacity-0 reveals; `/events` index + nav are solid |
| P3 Crawl + index controls | 15 | 53 | robots named-group bug; admin page publicly linked with a Disallow/noindex conflict; retired events 302 to the homepage; orphan page. Clean 404s, canonicals, lastmod |
| P4 Page templates | 15 | 75 | Strong titles + descriptions; slogan H1s; logo as share image; no `max-image-preview` |
| P5 Content + facts | 15 | 36 | Conflicting stats, placeholder venue, boilerplate FAQ, bios not in HTML; event openings are excellent |
| P6 Structured data + entity | 15 | 39 | Event schema thin (city-only place, no time, no price, filler performer); duplicate Organization nodes; FAQPage boilerplate |
| P7 Performance + media | 10 | 50 | Event templates pass; home 4.9 s LCP (video); About / Locations 47–53 MB of photos |
| P8 Accessibility + security | 10 | 90 | Full header set, skip link, labelled forms; two contrast failures |
| P9 AI / GEO access | 5 | 50 | Bot parity OK; robots group bug; llms.txt numbers wrong |
| P10–P11 Measurement | — | not scored | Owner access needed |

Uncapped total = Σ (weight × score) ÷ 100 = 53.6. Per-item statuses are listed under "§41 walk".

## Site Profile (inferred)

| SP | Value | Evidence |
|---|---|---|
| SP1 Multi-locale | N | `lang=en`, no hreflang |
| SP2 Ecommerce | N | Registration on RunSignUp / UltraSignup |
| SP3 Facets | N | Distance filter is client-side only; robots.txt still lists `?sort` / `?filter` |
| SP4 Video | Y | Autoplay hero video on home (`preload="auto"`) |
| SP5 UGC | N | Testimonials are curated |
| SP6 YMYL | N | Race events; the first-5K guide is general training copy |
| SP7 Local | N | Service-area org (La Center, WA; phone only); venues handled through Event |
| SP8 Large | N | 33 URLs |
| SP9 Site search | N | — |
| SP10 Merchant / agentic | N | — |
| SP11 EU AI | N | — |
| SP12 Bot-managed CDN | ? | Vercel; spoofed-UA fetches all 200; firewall / bot settings not observable |
| Gates on | — | Event, FAQPage, ItemList, BreadcrumbList; API-driven pages; admin path; retired items; hero video; llms.txt; `.md` mirrors |

## Top fixes (FIXABLE, severity then effort)

| # | Fix | Findings | Effort | Impact |
|---|---|---|---|---|
| 1 | Server-render the About team grid and the home calendar from the same Supabase snapshot `/events` already uses (build-time or SSR). Ship empty, error and loading states as JS-injected markup only, never as static text | F01, F02 | Med | Lifts the S1 cap; AI crawlers get people + calendar |
| 2 | robots.txt: give every named group the full Disallow set, or delete the 19 named groups (the `*` group already covers them). Add `&sort=` / `&filter=` shapes. Re-test with one named and one unlisted bot | F03 | Low | Correct crawl scope |
| 3 | Admin: remove the "Staff Portal" footer link. Keep `X-Robots-Tag: noindex` and drop the `/pages/admin/` Disallow, or gate the path at the edge (Vercel middleware / password protection) | F05 | Low | Hidden-page hygiene |
| 4 | Retired events (3): 301 to the closest current event, or serve a "no longer offered" page (410 if no demand). Update the 3 links on `/pages/locations.html` | F04 | Low | No soft redirects to home |
| 5 | Facts: one stats source (event count, WHY vs partner split, $ raised, athletes) feeding home, About, Community, meta and llms.txt, each with a source + date. Replace "Address: Main Event Site" with the real venue, or hide the line until known | F08, F10, F19 | Low | Removes contradictions that AI answers can quote |
| 6 | FAQ: page-specific questions per event (course, parking, cutoffs, packet pickup), or drop the FAQ block + FAQPage on pages without real Q&A | F09 | Med | — |
| 7 | Event JSON-LD: venue name + street address + postal code + geo; `startDate` with time + offset where start times are published; offer `price` / `lowPrice`–`highPrice` when known; remove filler `performer` | F06 | Med | Event rich-result eligibility; precise AI answers |
| 8 | Organization: reference `{"@id":"https://whyracingevents.com/#organization"}` on Partners, Locations, About and Beneficiary instead of new nodes. WebSite: `@id`, `alternateName` ["Why Racing Events", "WHY Racing"], `publisher` → #organization | F07, F18 | Low | One entity |
| 9 | Images: resize the About / Locations collage and venue photos to WebP ≤ ~1600 px with `srcset`; `Vancouver.png` → JPEG/WebP; width/height on every `<img>`. Hero video: `preload="metadata"`, poster first, mobile encode ≤ ~1 MB | F11, F24 | Med | −45 MB on two pages; home LCP |
| 10 | Per-page 1200×630 OG images (event photo or template card) with declared dimensions; `<meta name="robots" content="max-image-preview:large">` sitewide | F12 | Low | Better shares and Discover/AI image use |
| 11 | H1 = page topic (e.g. "About WHY Racing Events", "Race Sponsorship Opportunities"); keep slogans as an eyebrow/tagline. One brand spelling; "PeaceHealth AppleTree Marathon" consistent with the event name | F14, F18 | Low | — |
| 12 | `.reveal`: show content by default; add the hidden state only when JS sets an `html.js` class | F13 | Low | No-JS and screenshot renderers see content |

## Findings

Severity: S1 blocks crawl, index or render · S2 page fundamentals · S3 content / extraction · S4 polish / measurement.

### S1 — render

| ID | § | Finding | Evidence |
|---|---|---|---|
| F01 | §14 | Core content is JS-only. About team grid (Karissa & Rod Schoene, Brock Schoene, Jesse Green, Marla Stone, Jim Mitts, with roles) is fetched client-side; raw HTML shows `Loading team...`. Home race calendar (18 event links + 18-item ItemList JSON-LD) is JS-only. Raw vs rendered words: home 446 → 881 (−49 %), About 341 → 899 (−62 %); handbook limit ~20 %. Non-rendering crawlers (GPTBot, ClaudeBot, PerplexityBot) get no team and no home calendar. Mitigation: `/events` and the event pages are server-rendered | Raw HTML vs Playwright DOM; `#teamGrid` comment "Dynamically populated by JavaScript" |

### S2 — page fundamentals

| ID | § | Finding | Evidence |
|---|---|---|---|
| F02 | §14 | Raw HTML ships fallback text as page copy. Home: H3 "No Events Found", "Connection Error … If you are the administrator, please check your Vercel Environment Variables", "Next Up Loading...". About: "Loading team...". Text extractors read these as content | Raw home + About HTML |
| F03 | §18 | robots.txt group bug (handbook v2 template): 19 named groups contain only `Allow: /`. A named bot obeys only its own group, so those bots get none of the `*` Disallows (`/pages/admin/`, `/api/`, `/.vercel/`, `/.git/`, `/schema/`, `?sort`, `?filter`). `&sort` / `&filter` shapes missing. Over-allows; blocks nothing indexable. Severity: handbook lists "robots group bug" under S1; classed S2 because it blocks nothing (no grade effect; F01 already caps) | Both parsers: named bot → `/pages/admin/` allowed, unlisted bot → disallowed |
| F04 | §10 | Retired events `pacific-coast-running-festival`, `reflection-run`, `scary-run` → 302 to `/#calendar` (homepage, temporary). Linked from `/pages/locations.html` | Status + Location headers; crawl inlinks |
| F05 | §10, §18 | `/pages/admin/races.html`: public 200 page with client-side login. `X-Robots-Tag: noindex, nofollow, noarchive` plus a `*`-group Disallow (unlisted bots cannot see the noindex). "Staff Portal" link in the footer of 29 pages (Semrush: 28 incoming links) | Headers; robots test; crawl |
| F06 | §24 | All 18 `SportsEvent` nodes: `location` is city-level only (`Place` "Vancouver, WA"; no street, postal code, geo). `startDate` is date-only although start times are published (e.g. Battle to the Pacific rucks 9:00 AM, 15K/20K 9:15, 5K 9:30). Offers have `url` + `availability` but no price. `performer` = filler "<Race> Athletes" on all 18. Present and correct: `eventStatus`, `eventAttendanceMode`, `image`, `organizer` (partner organizers named correctly), `subEvent` | JSON-LD, 18 pages |
| F07 | §24 | Home defines `#organization`; Partners, Locations (2 nodes, incl. `SportsOrganization`), About (`mainEntity`) and Beneficiary (`publisher`) each declare a new Organization node without `@id`. WebSite node has no `@id`, `alternateName` or `publisher`. `sameAs` = Facebook, Instagram, YouTube; no Google Business Profile (may not exist) | JSON-LD, 5 pages |
| F08 | §6, §24 | Placeholder venue "Address: Main Event Site" on 9 event pages and their `.md` mirrors | Raw HTML; `.md` files |
| F09 | §3, §7, §24 | The same 5-question FAQ + FAQPage on 11 WHY event pages. The stroller/dog question also appears on triathlon pages | Hash of question sets: 1 unique set across 11 pages |
| F10 | §6 | Stats conflict and none is sourced or dated. Event count: 18 (calendar, home CTA "View all 18 races"), 20+ (home strip + meta), 21 (About, llms.txt), 17+ (Community). WHY-produced: 14 (llms.txt) vs 11 on the site. Charity: $3M+ (Community, llms.txt), $3,000,000+ (About), "over $3 million" (Beneficiary meta), "raising millions" (About hero). 50,000+ athletes (home, About) and "50,000+ active PNW consumers" (Partners meta) | Text extraction, all pages |
| F11 | §14, §15 | Lab mobile LCP: home 4.9 s (LCP element = hero `<video preload="auto">`, 3 MB mp4), About 23.9 s (H1 delayed by 18 s of main-thread work decoding a 2–3.5 MB-per-image collage), Locations 3.3 s. Payload: About 46.9 MB, Locations 53.2 MB (incl. 7.68 MB `Vancouver.png`), home 7.4 MB. Lighthouse estimates 45 MB (About) and 42 MB (Locations) of savings from responsive images. `/events` 2.0 s and event pages 2.4 s pass | Lighthouse table below |
| F12 | §2 | `og:image` = the logo (291×237 px) on home + all 10 `/pages/*`. Event pages use their own images, but as 800×800 thumbnails; Girlfriends Triathlon uses an Unsplash stock photo. No `og:image:width/height` anywhere. No `max-image-preview:large` on any page | Raw HTML; PNG header |

### S3 — content, extraction, index hygiene

| ID | § | Finding | Evidence |
|---|---|---|---|
| F13 | §14 | Scroll-reveal elements stay at opacity 0 without JS on 8 `/pages/*` templates (5–19 `.reveal` blocks each). JS-off render hides ~220 words on About and ~700 on Locations | Playwright, JS disabled |
| F14 | §2, §3 | H1 = slogan, not topic. Home "PREMIER PNW RACING: RUN. RIDE. REMEMBER.", About "THE STORY OF PNW RACING: WHY.", Partners "PNW RACE SPONSORSHIP WHY RACING EVENTS". Community: H1 "Partner Race Companies: Stronger Together." vs title "PNW Racing Community & Athlete Teams". First-5K H1 contains a title-style pipe | Raw HTML |
| F15 | §6 | Unsupported superlatives and claims: "Premier" (home, About meta "the premier race production team"), "most supportive", "the best racing in Washington and Oregon" (Volunteers meta), "real, measurable ROI" (Partners meta), "fully insured and certified courses", Appletree "Boston Qualifier" — no source or year. "PNW" used before it is spelled out on About and Training | Text + meta |
| F16 | §6, §7 | Thin pages (main-content words): Ho Ho 5K 153, Silver Falls 170, White River 170, Crown Stub 236 (partner events); Training 138 | Extraction (Semrush "low word count" flags 4 of the same) |
| F17 | §12, §17 | Internal links: `/pages/first-5k.html` is orphaned (sitemap only). In server HTML, event detail pages get 1–2 inbound links (from `/events`; home links are JS-only, F01) `(post-Semrush: flagged as "9 pages with only one internal link"; verified against crawl inlinks)` | Crawl inlinks |
| F18 | §25 | Brand written "WHY RACING EVENTS" (titles, schema, footer), "Why Racing Events" (alts, copy), "Why Racing" (testimonials). Event name "Appletree Marathon" (title, H1) vs "PeaceHealth AppleTree Marathon" (description, RunSignUp). "Why" is a generic word and there is no `alternateName` to disambiguate it | Text + JSON-LD |
| F19 | §20 | llms.txt intro says 21 events (14 WHY + 7 partner) and $3M+ giving; the same file lists 18 events (11 + 7) | llms.txt |
| F20 | §8, §7 | About: no primary action in the first mobile screen (hero + partner logos only). No Person schema for the team (names are JS-only; F01) | Screenshot 390×844 |

### S4 — polish, measurement

| ID | § | Finding | Evidence |
|---|---|---|---|
| F21 | §10 | `http://www.` → `https://www.` → apex: 2 hops (308 each). Other host / protocol forms take 1 hop | curl |
| F22 | §2 | `/index.html` returns 200 (canonical `/`). `/pages/about.html/` returns 200 (canonical) while `/events/` 308s to `/events` — two trailing-slash behaviours. 404 template carries `canonical` → home (noindex, so harmless; drop it) | URL-variant probes |
| F23 | §2 | 6 event titles lack the brand suffix (Columbia River Tri, Girlfriends Tri, Girlfriends Run, Hagg Lake, Santa's Holiday Hustle, Spring Classic); 2 of them = H1 verbatim. Meta descriptions over 170 chars: Corporate Wellness 173, Partners 176 | Title / meta extraction |
| F24 | §14, §15 | 299 `<img>` without width/height on home + `/pages/*` (Beneficiary 57, Locations 50, Community 43, home 40, First-5K 38, Training 38, About 26). Sponsor logos distorted on event pages (Lighthouse `image-aspect-ratio`, 5) | Raw HTML; Lighthouse |
| F25 | §14 | GA4 + Meta Pixel load from a `defer` script, not after load or interaction. Lab main-thread time: Facebook 741 ms, GTM 435 ms (container, inflated). Meta `fr` third-party cookie (Best Practices). CSP (`frame-src 'none'`, `form-action 'self'`) blocks the Pixel's iframe/form fallback → 2 console errors on event pages | Lighthouse third-party summary + console |
| F26 | §14 | Render-blocking Google Fonts CSS (Lighthouse estimates ~0.9 s). Full Font Awesome 6.4.0 CSS + webfonts from cdnjs for a handful of icons. Static assets: `max-age=86400` + `?v=` query versioning, not hashed + `immutable` | Lighthouse; headers |
| F27 | §14 | Contrast: footer "Staff Portal" link 2.0–2.1:1 on every template. Breadcrumb links 1.42:1 against surrounding text (`link-in-text-block`) on `/events` and event pages | Lighthouse (axe) |
| F28 | §14 | HSTS `max-age=31536000; includeSubDomains; preload`. The domain is not on the preload list (API status "unknown"). `preload` + `includeSubDomains` should be an owner decision after a subdomain inventory | Header; hstspreload.org API |
| F29 | §12 | Outbound links to redirecting URLs: `em3concrete.com` (footer sponsor, 36 pages) → `www`. 7 beneficiary / partner links point to the non-canonical host (301). UltraSignup `eid=` → 302 `did=`. No broken outbound links | Browser-UA + bot-UA tests |
| F30 | §2, §9 | Mixed URL styles: `/pages/*.html` vs extensionless `/events/*`. Slug artifacts `women-s`, `santa-s`. `/contact` 308 → About (no contact page; acceptable while the phone is in the footer) | URL inventory |

## §41 walk (REVIEW)

Key: 1 = pass · 0.5 = partial · 0 = open (finding) · N/A · BLOCKED. Process items the reviewer performs (raw-vs-render comparison, site crawl, axe run, lab-environment record) are marked N/A (done in this review).

| Phase | Item → status |
|---|---|
| P2 | Core in server HTML 0 (F01) · API fallback 0.5 (`/events` SSR; home/About none) · fallback freshness 0.5 (F02; event pages show updated dates) · no opacity-0 0 (F13) · raw vs render compared N/A · one instance + ≤20 % 0 (F01; home stats strip duplicated in raw) · detail pages in HTML index 1 · header nav → hubs 1 · URL rules 0.5 (F30) · build chain BLOCKED (repo) → **3.5 / 8 = 44** |
| P3 | Host + protocol one hop 0.5 (F21) · trailing slash 0.5 (F22) · nav → `/` + query canonical 1 · self-canonical = links = sitemap 1 · moved URLs not to home 0 (F04) · legacy map BLOCKED · retired items 0 (F04) · links to redirected URLs 0 (F04) · junk URLs N/A (none found) · unknown → 404 1 · 404 own template 1 · URL inventory 0.5 (F17) · crawl run N/A · hidden pages 0 (F05) · robots groups 0 (F03) · admin path 0 (F05) · lastmod provenance 1 · archive content N/A · host consistency 1 · render-resource guard 1 · pagination / facets / search / hreflang / variants N/A → **8.5 / 16 = 53** |
| P4 | Unique + suffix 0.5 (F23) · topic titles + H1 0.5 (F14) · meta present 1 · viewport 1 · searched names BLOCKED (GSC) · no hard-coded years 1 · hub title 1 · heading order + one `<main>` 1 · OG per-page image 0.5 (F12) · Article OG N/A · `max-image-preview` 0 (F12) · `_blank` noopener 1 → **7.5 / 10 = 75** |
| P5 | Opening sentence 0.5 (events excellent; home/About tagline-first) · stats single-sourced 0 (F10) · no placeholders / superlatives / acronyms 0 (F08, F15) · page-specific FAQ 0 (F09) · names one way + entity test 0.5 (F18) · SP7 address N/A · claims as sourced text 0.5 (F15) · prices / specs markup N/A (no prices on site) · outbound links 0.5 (F29) · first-screen CTA 0.5 (F20; home + events pass) · detail-page facts 0.5 (F08, F16) · contact block 1 · About people + Person 0 (F01, F20) · intent map BLOCKED → **4.0 / 11 = 36** |
| P6 | WebSite node 0.5 (F07) · URLs absolute, no empty fields 1 · one org `@id` 0 (F07) · Article N/A · Event 0 (F06) · ItemList + BreadcrumbList 1 · FAQPage real Q&A 0 (F09) · parses + RRT 0.5 (parses; Semrush 0 errors / 171 items; RRT not run) · generic brand disambiguated 0.5 (F18) · LocalBusiness / Product / Review N/A · no placeholder sentinels 0 (F06 performer, F08) → **3.5 / 9 = 39** |
| P7 | Hero video 0.5 (poster, pause, reduced motion, per-device boxes ✓; `preload="auto"` 3 MB ✗) · img dims + hero priority 0.5 (F24) · LCP image + display size 0 (F11) · pixels deferred after interaction 0.5 (F25) · fonts / code split 0.5 (F26) · caching 0.5 (F26) · CLS lab every template 1 (0–0.014) · LCP < 2.5 s per template 0.5 (2 of 5 pass) · lab env recorded N/A → **4.0 / 8 = 50** |
| P8 | Headers set 1 (preload choice → F28, owner) · contrast 0.5 (F27) · axe run N/A · skip link + icon names + alts 1 · header values 1 · labels / nav / motion / targets / alts 1 · SP6 / sensitive forms / consent N/A → **4.5 / 5 = 90** |
| P9 | Bots + parity 1 (CDN settings BLOCKED) · llms.txt numbers 0 (F19) · `.md` mirrors 0.5 (canonical `Link` header + `rel=alternate` ✓; "Main Event Site" copied ✗) · AI-control decisions 1 (deliberate per-bot Allow in robots.txt) · robots evaluated per group 0 (F03) → **2.5 / 5 = 50** |

## Passes

- One H1 on every page; one `<main>`; no skipped heading levels; titles and meta descriptions unique on all 28 indexable pages.
- Titles state topic + place on event pages (`Appletree Marathon in Vancouver, WA | …`). The event-page opening sentence is a model answer-first block: name, distances, city, full date, host.
- Self-canonicals everywhere; `?utm_source=` canonicalizes; sitemap host = canonical host = robots `Sitemap:` host.
- Sitemap `<lastmod>` per URL matches each event page's visible updated date; static pages vary (2026-06-11 → 2026-11-02). Not a build date.
- Unknown URLs → real 404 (own template, `noindex`); unknown event slugs → event-specific 404.
- WordPress-era event slugs redirected with 301 (`/appletree-marathon/`, `/girlfriends-run/`, `/events/appletree-marathon-2026`).
- `/events` index server-renders all 18 events + ItemList; BreadcrumbList on all event pages; organizer correctly attributed to Bivouac Racing / X-Dog Adventures on partner events.
- Bot-UA parity: Googlebot, Bingbot, GPTBot, OAI-SearchBot, ClaudeBot and PerplexityBot all get 200 + identical HTML.
- Security headers complete by value: HSTS 1 yr, CSP incl. `frame-ancestors`, nosniff, Referrer-Policy, Permissions-Policy, XFO. HTML `max-age=0, must-revalidate`.
- Accessibility: skip link, labelled newsletter form, tap targets pass, social icons named (`title`), hero video pause control + `prefers-reduced-motion`. Lighthouse a11y 91–95.
- Event `.md` mirrors: `text/markdown`, `Link: rel=canonical` header, `<link rel="alternate" type="text/markdown">` on the HTML.
- No broken outbound links. All 18 registration links return 200 for browsers and bots.
- CLS 0–0.014 on every template; TTFB fine (x-vercel-cache HIT).

## Lighthouse lab (cloud container, simulated throttling; TBT inflated in this environment)

| Page | Perf | A11y | BP | SEO | LCP | TBT | CLS | Payload |
|---|---|---|---|---|---|---|---|---|
| Home (mobile) | 54 | 95 | 79 | 100 | 4.9 s | 1,240 ms | 0 | 7.4 MB |
| Home (desktop) | 87 | 95 | 78 | 100 | 1.0 s | 240 ms | 0.014 | 9.6 MB |
| /events | 77 | 91 | 79 | 100 | 2.0 s | 900 ms | 0 | 0.63 MB |
| Appletree event | 86 | 92 | 89 | 100 | 2.4 s | 400 ms | 0 | 0.82 MB |
| /pages/about | 35 | 94 | 79 | 100 | 23.9 s | 5,160 ms | 0 | 46.9 MB |
| /pages/locations | 51 | 94 | 79 | 100 | 3.3 s | 5,850 ms | 0.012 | 53.2 MB |

## Observed, not actioned (reason)

- Lighthouse `legacy-javascript` 11 KB, `unused-css-rules` 18 KB, `unminified` 5 KB CSS + 3 KB JS: negligible.
- `unused-javascript` ~140 KB: mostly GTM / Meta. Covered by F25.
- `dom-size` 860 on Locations: under ~1,400.
- `network-dependency-tree`: informational.
- Extractor flagged 3 "empty" social links: they are named by `title`, and Lighthouse `link-name` passes. Optional: add `aria-label`.
- First-5K page uses no `.reveal`; Training's 138 words are reported in F16.

## LIMITED (platform)

None. Own stack on Vercel; every finding is fixable in code or settings.

## BLOCKED (owner access)

- GSC (Page indexing, CWV field data, Generative AI, searched names for P4) and Bing WMT.
- CrUX: PSI API returned 429. Field data unknown.
- Vercel firewall / bot-protection settings (SP12).
- Legacy URL map: needs the old WordPress sitemap + GSC 404s. Probes: 3 WP-era event slugs 301 correctly. `/about-us/`, `/volunteer/`, `/sponsors/`, `/races/` and similar → 404; unknown whether they existed.
- Rich Results Test per template; build chain (repo); GA4 AI channel.
- Admin data protection (Supabase RLS) behind the client-side login.
- HSTS `preload` intent (F28).

## Outside scope — noted

- Email DNS: SPF `include:spf.protection.outlook.com -all` ✓; DMARC `p=none` (monitor only).

## Residual weaknesses

- [SUPPORTED] F01 is graded S1 because the handbook's S1 list names "JS-only content" and §41 names bios + calendars as core. Googlebot renders JS and will see the bios; the loss is for non-rendering AI crawlers. The cap turns a 54 into a 39 on one template's JS dependency. Handbook calibration candidate: scope S1 "JS-only content" to unique primary content not available elsewhere in server HTML.
- [SUPPORTED] F03 severity is a judgment call against the handbook's literal S1 example; no grade effect this run.
- [SUPPORTED] Lab numbers come from a cloud container; TBT and main-thread values are inflated. The About LCP (23.9 s) is a main-thread artifact of decoding a huge collage; real-device LCP is lower, but the 47 MB payload is real.
- [SUPPORTED] 33 URLs, so every page was fetched; legacy (pre-migration) URLs are only partly probed.
- [SUPPORTED] Event dates (2027 editions) and start times are taken as published; not checked against RunSignUp per event.
- [SPECULATIVE] Projected grade after top fixes 1–8: ~75–82 (B).

---

## Addendum — Semrush Site Audit cross-check (2026-11-13)

Exports: issues summary, mega export, pages, structured data (35 URLs crawled, 28 HTML pages). Grade here unchanged: 39 (54 uncapped).

### Semrush flags vs this audit

| Semrush issue | Count | This audit | Verdict |
|---|---|---|---|
| Temporary redirects | 3 | F04 (+ target is the homepage, + linked from Locations) | Same defect; this audit adds the destination and the fix |
| Blocked from crawling | 1 (admin page) | F05 (+ public footer link, noindex/Disallow conflict, contrast) | Same page; Semrush did not flag the 28 public links |
| Orphaned sitemap pages | 1 | F17 (`/pages/first-5k.html`) | Same. The Semrush pages export omits First-5K entirely |
| Pages with only one internal link | 9 | F17 (added post-Semrush) | Valid. Root cause = F01 (home calendar JS-only) |
| Low word count | 4 | F16 | Same pages + Crown Stub 236 |
| Duplicate content in H1 and title | 2 | F23 | Side effect of the missing brand suffix |
| External pages with 403 | 5 | F29 notes | Semrush does not name them; likely the bot walls found here (TripAdvisor, Scleroderma, PeaceHealth, Autism Society, Pepsi bot-UA). PeaceHealth, Autism Society and Pepsi load 200 in a real browser. Not broken |
| Unminified JS / CSS | 70 / 126 | Observed, not actioned | ~8 KB savings per Lighthouse; noise |
| Low text-to-HTML ratio | 22 | Not reported | Not a ranking factor; driven by large inline CSS/JS |
| Structured data errors | 0 / 171 items | F06, F07, F09 | Syntax-valid ≠ complete: city-only venues, date-only times, no price, filler performer, duplicate orgs, boilerplate FAQ all pass Semrush |

### Found here, not by Semrush

F01 JS-only bios + calendar (S1) · F02 error text in raw HTML · F03 robots named-group bug · F06 Event schema completeness · F07 duplicate Organization nodes · F08 "Main Event Site" placeholder · F09 boilerplate FAQ ×11 · F10 / F19 conflicting stats incl. llms.txt · F11 47–53 MB pages + video LCP (Semrush "slow page load" times the HTML only: 0.03–0.3 s) · F12 logo as share image, no `max-image-preview` · F13 opacity-0 reveals · F14 slogan H1s · F15 unsourced claims · F18 naming · F20 About CTA · F21 2-hop `http://www` · F22 trailing-slash split · F24 299 undimensioned images · F25 pixel timing + CSP console errors · F26 render-blocking fonts, cache policy · F27 contrast · F28 HSTS preload.

### Found by Semrush, missed here

None new. "Pages with only one internal link" exposed a link-equity angle of F01 that was in the crawl data but not written up. It was added as part of F17 and marked.

### Checker errors / limits (Semrush)

- "Slow page load speed: 0" measures HTML download, not render or payload. It misses the 4.9 s home LCP and the 47–53 MB pages.
- "Structured data: 0 errors" checks syntax and required properties only, not completeness or truthfulness (filler performer, placeholder venue).
- 403 externals reported without a real-browser recheck.
- First-5K missing from the pages export although it is counted as an orphan.
- No robots.txt group analysis ("Invalid robots.txt format: 0" — the file is valid; the logic is wrong).
- No rendered-vs-raw comparison, no fact-consistency check, no llms.txt content check ("formatting issues: 0").
