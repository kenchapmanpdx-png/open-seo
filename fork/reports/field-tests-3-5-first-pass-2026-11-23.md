# Field tests 3–5 — first pass from chat (2026-11-23)

In-app Check a site (whole site, app `handbook-v3.7.0`, no page cap) vs Semrush Site Audit (limit 300, no masks). Semrush rows: `fork/fixtures/external/<site>-semrush-2026-11-23.csv` (`Issue,Count,Page URL,Target URL`; large or skip-class issues are count-only rows, URL lists not pulled). By-URL verdicts: B19 via `field-test.ts`.

| #   | Site                     | Cell                                                            | App                                                                                         | Semrush                                                                     |
| --- | ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 3   | aircorheatingcooling.com | Squarespace · HVAC · neighborhood pages · sitemap 196           | F · 30.2 (SEO 30 / GEO 21 / AEO 17) · 238 pages · Must 2 · Should 24 · Nice 58 · Couldn't 8 | 184 pages · 172 errors · 738 warnings · 1333 notices · schema.org 163 pages |
| 4   | valentinecoffeeco.com    | Shopify · store · sitemap 53                                    | F · 39 (SEO 37 / GEO 38 / AEO 41) · 60 pages · Must 2 · Should 17 · Nice 44                 | 92 pages · 17 errors · 242 warnings · 293 notices · schema.org 0            |
| 5   | wsparkdental.com         | no sitemap.xml (404) · dental · ~18 pages · platform unverified | F · 39 (SEO 39 / GEO 38 / AEO 31) · 18 pages · Must 1 · Should 14 · Nice 22 · Couldn't 6    | 25 pages · 7 errors · 59 warnings · 10 notices · schema.org 0               |

## 3 — aircorheatingcooling.com

- App Must fix: internal links use a non-canonical URL form (86 pages) · indexable pages not self-canonical (33).
- Agree (counts near): title too long 136 / 129 · not exactly one H1 61 / 22 + 38 · temporary redirects on internal links 235 pages / 324 · JSON-LD errors 235 / 162 · orphaned sitemap URLs 95 / 72.
- Differ: missing meta description 164 / 93 (app read 238 pages, Semrush 184) · Semrush 4xx 4 pages (`/repair-coupon`, `/promotions`, `/financing`, `/duct-installation/`) + 6 broken internal links vs app "internal links point at redirected or retired URLs" 7 pages + "404 response serves a live page body" 2 → check by URL · Semrush page crawl depth 127 (blog pagination chain to depth 38) vs app "detail pages not linked from any index" 38 · Semrush blocked 9 (blog `?offset=` / `?author=`, `/cart`).
- App only: Organization without `@id`, locations not tied to it, LocalBusiness gaps (235 pages) · robots.txt blocks render resources (229) · page set shares most of its text (63 pages, median 100 %) + near-duplicates 81 + AI-judged "local or service pages are not distinct" (3) · HSTS max-age 0 · content at opacity:0 (228) · URL slugs (48) · test / draft URL in sitemap.
- Semrush only: non-descriptive anchors 975 · low text/HTML 162 (skip) · content not optimized 24 (skip) · nofollow external 21 (skip) · llms.txt (skip).

## 4 — valentinecoffeeco.com

- App Must fix: `/collections/all?page=1` canonical → `/collections/all` (flagged "not self-canonical") · robots.txt blocks resources needed to render (Shopify default rules: `/cart.js`, `/checkouts/`, `/cdn/wpm/*.js`, monorail).
- Agree: Semrush "disallowed internal resources" 157 + external 78 = the same robots-blocked resources · missing H1 6 (5 `/pages/*`, `/cart`) · duplicate meta descriptions 17 · orphaned sitemap pages 9.
- Semrush only: links with no anchor text 156 · one-inlink pages 30 · low text/HTML 78 (skip).

## 5 — wsparkdental.com

- App Must fix: indexable pages without a canonical (18 of 18). Semrush does not flag it.
- Agree: missing H1 2 (`/services`, `/dentists`) · missing meta description 3 · duplicate meta descriptions / titles 6.
- Semrush only: sitemap.xml not found + not in robots.txt (**no app finding for a missing sitemap in the Fix list**) · broken external links 17 (16 are one localmed.com booking widget: bot-blocked?) vs app dead outbound 1 page · one-inlink pages 9 (app rule is sitemap-based) · low word count 15 (skip) · unminified 18 (skip).
- App only: no WebSite / LocalBusiness node · `/index.html` live duplicate of the homepage · consent banner is the LCP element · no primary action in first mobile screen (16).

## App defects / questions seen (B19 work orders)

1. Valentine F02 Must fix: Shopify's default robots rules for cart / checkout / analytics endpoints are reported as "blocks resources needed to render". Also fired on Squarespace (229 pages, Should). Likely over-severe or false positive for non-render endpoints.
2. Valentine F01 Must fix: a `?page=1` URL whose canonical points at the unparameterised listing is correct canonicalisation, reported as a defect.
3. Valentine "text waits at opacity:0": "1266 of 1241 rendered words" (hidden count above the total) and the same 365 words on every page (shared hidden drawer / menu?).
4. wsparkdental: no finding for a missing sitemap.xml; one-inlink rule cannot fire without a sitemap.
5. wsparkdental run: 1 "the check itself failed". Aircor run: 2 "AI reviewer was not sure".
6. Aircor: "Image returns an error" appears as four separate findings (8 pages, 2 pages, 1 page, "19 page groups · 19 pages") → grouping.
7. Semrush reports schema.org 0 on Valentine and wsparkdental: verify in raw HTML (tool-wrong on Wix earlier).
8. Valentine run sat in the last stage "Running checks 0 / 1" with no progress for 60 pages while it held the lease; check duration and progress display for that stage.
9. Run time: 238 pages ≈ 60 min in-app. Record per-stage times for the three runs (run-query script) and list the slowest stage.
10. Four of six field sites graded exactly F · 39 (Must-fix cap); the grade does not separate them (WO-B19-011).
