# Field tests 6–8 — first pass (2026-11-23, small sites, whole site on both tools)

Scope: same on both tools, no sections left out. Semrush limit 300, subdomains on (default), mobile bot. App: Check a site → Whole site, in-app.

| #   | Site                | Type · platform           | Sitemap           | App pages (step 1 / handbook) | App grade                                                  | Semrush pages                                                  | Semrush E / W / N | App run                                   |
| --- | ------------------- | ------------------------- | ----------------- | ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ----------------- | ----------------------------------------- |
| 6   | samanthaco.ca       | law firm (CA) · Webflow   | 24                | 32 / 32                       | D 51.9 (SEO 47, GEO 36, AEO 45) · 0 / 14 / 29              | pending (stuck "Auditing site" at 38 crawled, 05:38–06:25 UTC) | pending           | `hb-9f9bd81a-95f4-4975-84a0-3809360ee72e` |
| 7   | theogdenver.com     | restaurant · BentoBox     | 10                | 26 / 20                       | F 39 (50.3 uncapped; SEO 39, GEO 50, AEO 48) · 1 / 23 / 36 | 33                                                             | 15 / 32 / 23      | `hb-911409d8-8aa9-4344-8103-3fd51234f3aa` |
| 8   | bluebonnetroofs.com | roofer · Showit, one page | 1, robots.txt 404 | 2 / 2                         | D 53.2 (SEO 55, GEO 25, AEO 36) · 0 / 8 / 20               | 6 URLs                                                         | 3 / 1 / 6         | `hb-c94afb1a-03f8-4a7c-9096-44ba15cfd6aa` |

## App defects found (cause verified in code or run output)

| #   | Defect                                                                                               | Evidence                                                                    | Cause                                                                                         | WO         |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| 1   | 11 checks crash on samanthaco.ca                                                                     | Details: `P2-10 … P5-17 check error: Invalid URL string.`                   | unguarded `new URL(href)` on page links; one malformed href throws, runner discards the check | WO-B20-007 |
| 2   | 4 speed items lost on samanthaco.ca                                                                  | `lighthouse unavailable: collector error: evidence upload failed: HTTP 520` | evidence store retries only 404 / 400                                                         | WO-B20-008 |
| 3   | theogdenver.com capped to F by two slashless home links that 301 once to the canonical               | Must fix: `/menus → /menus/`, `/happenings → /happenings/`; Semrush: notice | link-form finding is S1 regardless of how the linked form resolves                            | WO-B20-009 |
| 4   | Malformed Website value accepted; "F · 0 · Nothing to fix"                                           | run `hb-5d98da26`, site `https://aircorheatingcooling.comsamanthaco.ca`     | no host validation before project / run creation; grade shown with 0 pages                    | WO-B20-010 |
| 5   | bluebonnetroofs.com: "robots.txt has no Sitemap: line" for a 404 robots.txt; no missing-file finding | Semrush: Robots.txt not found                                               | P3-19 title does not distinguish missing file                                                 | WO-B20-011 |
| 6   | Fixed run time on small sites                                                                        | 2 pages ≥ 7 min; 32 pages ≈ 11 min; 20 pages ≈ 25 min                       | not measured yet                                                                              | WO-B20-012 |

## Semrush vs app by issue (first pass, by title; by-URL close = WO-B20-013)

### theogdenver.com

| Semrush issue (count)                                                                              | App                                                                  | First-pass verdict                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| Broken external links (3, `/press/?p=2…4`)                                                         | Outbound links are dead (5 pages)                                    | agree (verify URLs)                             |
| Duplicate meta descriptions (3)                                                                    | Duplicate titles, descriptions or H1s (3 pages)                      | agree                                           |
| Structured data markup errors (12: `/happenings/` ×6, 6 events)                                    | JSON-LD empty / relative values (18 pages); Event JSON-LD incomplete | agree                                           |
| Title too long (1)                                                                                 | Titles over 70 characters (3)                                        | agree                                           |
| Missing h1 (1, `/accessibility-statement/`)                                                        | missing title / not one H1 (1 page)                                  | agree (verify URL)                              |
| Missing ALT (1)                                                                                    | Skip link / names / alts (1 page)                                    | agree (verify URL)                              |
| Low word count (1)                                                                                 | Thin pages (3)                                                       | agree                                           |
| Permanent redirects (2, home)                                                                      | Must fix link form + Internal links point at redirected URLs (2)     | agree; severity = defect 3                      |
| Links with no anchor (1), non-descriptive anchor (2)                                               | both reported                                                        | agree                                           |
| External 403 (1, bakersway.com)                                                                    | Outbound links are dead?                                             | verify                                          |
| Pages with only one internal link (10)                                                             | not reported (pages are outside the sitemap)                         | open: verify, WO-B20-013                        |
| Page crawl depth (3, `/press/?p=4…6`)                                                              | —                                                                    | skip candidate (deep-page is a Site Audit item) |
| Uncompressed JS (tripleseat.com), Disallowed external resource (audioeye.com)                      | —                                                                    | skip candidate (third-party resources)          |
| Low text to HTML ratio (23), Llms.txt not found, Content not optimized (2), Duplicate h1/title (1) | —                                                                    | skip (map)                                      |
| schema.org markup = 0 pages                                                                        | JSON-LD found on 18 pages                                            | tool-wrong (same as earlier sites)              |

App only (not in Semrush): LCP / CLS on 14 of 14 templates, page text at opacity:0 (13 pages), consent banner is the LCP element (7), `/index.html` live duplicate, CSP `default-src *`, HSTS preload note, axe items, Event / WebSite / Organization schema detail, pages missing from the sitemap (8), AI-judged ×5.

### bluebonnetroofs.com

| Semrush issue                                                      | App                                                                                  | First-pass verdict                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------ |
| Broken internal link `/www.jhcreativeconcepts.com` (404)           | Malformed link URLs (1 page); Internal links point at redirected or retired URLs (1) | agree                                |
| Robots.txt not found                                               | "robots.txt has no Sitemap: line"                                                    | defect 5                             |
| No HSTS support (2)                                                | Security headers missing: Strict-Transport-Security …                                | agree                                |
| Pages with only one internal link (home)                           | —                                                                                    | tool-wrong candidate (one-page site) |
| Nofollow external link, Low text to HTML ratio, Llms.txt not found | —                                                                                    | skip (map)                           |

App only: no WebSite node, Organization @id, LCP / CLS, form labels, heading order, OG / Twitter tags, cache policy, render-blocking, same text block twice, AI-judged ×5.

### samanthaco.ca

Semrush finished 06:27 UTC: 38 pages, 23 errors / 40 warnings / 46 notices. csv: `fork/fixtures/external/samanthaco.ca-semrush-2026-11-23.csv`.

| Semrush issue (count)                                                                                                 | App                                                                 | First-pass verdict                                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 4xx `/team/law-students`, linked from 7 team pages; 4xx `/blogs/znge05…` linked from 1 post (Broken internal links 8) | Internal links point at redirected or retired URLs (4 pages)        | open: 8 source pages vs 4; P3-13 crashed (defect 1). Verify after WO-B20-007 |
| Duplicate title / content / meta description on 3 URL forms of one post (`/blog/x`, `/blog//x`, `/blog/%20x`)         | Near-duplicate pages (3); Duplicate titles, descriptions or H1s (3) | agree                                                                        |
| Malformed links (2: `https://<https://…>`, `https://RSC 1985, c 3 (2nd Supp)`)                                        | Malformed link URLs (3 pages)                                       | agree; these hrefs are the cause of defect 1                                 |
| Broken external links (6, incl. `chrome-extension//` PDF links)                                                       | Outbound links are dead (2 pages)                                   | agree (verify URLs)                                                          |
| Structured data markup errors (2: `/`, `/legal-services`)                                                             | JSON-LD relative / empty values (10 pages)                          | agree                                                                        |
| Title too long (14)                                                                                                   | Titles over 70 characters (16)                                      | agree                                                                        |
| Missing h1 (7 team pages)                                                                                             | missing title / not one H1 (7 pages)                                | agree                                                                        |
| Missing meta description (1)                                                                                          | Indexable pages without a meta description (1)                      | agree                                                                        |
| Pages with only one internal link (10)                                                                                | Sitemap URLs with only one internal link (10)                       | agree                                                                        |
| Permanent redirects (4, `/blog/x` → `/blogs/x`)                                                                       | Internal links point at redirected or retired URLs                  | agree (verify URLs)                                                          |
| Orphaned sitemap page; Low word count `/our-team`                                                                     | Test / draft URLs in the sitemap; —                                 | verify                                                                       |
| Links with no anchor text (15, footnote links on 6 posts)                                                             | not reported on this run                                            | open: verify, WO-B20-013                                                     |
| External 403 (5: westlaw, tandfonline)                                                                                | —                                                                   | tool-wrong candidate (sites refuse bots)                                     |
| Low text to HTML ratio (11), Llms.txt not found, Content not optimized (10)                                           | —                                                                   | skip (map)                                                                   |
| schema.org markup = 0 pages                                                                                           | JSON-LD findings on 24 pages                                        | tool-wrong                                                                   |

App only: accessibility (28 pages), ItemList / BreadcrumbList gaps (24), Article JSON-LD gaps (16), OG / Twitter tags missing (28; Semrush counts 28 pages **with** them: verify in WO-B20-013), image dimensions, cache policy, security headers, no primary action on first mobile screen (21), hard-coded years, AI-bot policy split, AI-judged ×6. Grade not final: 15 items without a result (defects 1–2).

## Residual weaknesses

- SUPPORTED: defects 1–5 (run output + code read).
- SUPPORTED: the theogdenver and bluebonnet rows above are matched by title and count, not by URL; `field-test.ts` was not run (report.json is behind a download button, not a link).
- SPECULATIVE: app read 20 pages on theogdenver vs Semrush 33 because Semrush counts redirects and `/press/?p=N`; not verified.
- SPECULATIVE: defect 6 causes.
