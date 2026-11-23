# Field test 2 — nwpersonaltraining.com, app vs Semrush (first pass, 2026-11-22)

Site: WordPress (Yoast sitemaps), about 1,500 URLs: blog posts ~900 (estimate), success stories 183, blog categories 155, blog tags 151, pages 48, team 15, services 6, plus 6 small sitemaps not counted. Ken: check the core site only (no blog posts, category / tag pages, individual success stories).

Semrush rows: `fork/fixtures/external/nwpersonaltraining.com-semrush-core-2026-11-22.csv` (project 32084853, snapshot `6b03b3fd94e4d6fbb3c34b2a`, masks `/blog/`, `/success-stories/`, `/wp-content/uploads/`). Six issue types are count-only rows (URL lists not pulled): nofollow external 225, non-descriptive anchor 121, unminified JS/CSS 88, permanent redirects 71, low text/HTML ratio 57, nofollow internal 45.

## App runs (in-app, Check a site)

| Run (audit id) | Setting                                     | Result                                                                                                                                                                                     |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bdd54c7a`     | Whole site (500)                            | failed after 60 min: `WorkflowTimeoutError: Execution timed out after 1800000ms`. Stage `crawl#0` attempt 2 finished 6 min after the run was marked failed.                                |
| `a9541161`     | Quick (50)                                  | same stage still running after 25 min; interrupted by the app restart                                                                                                                      |
| `06f68853`     | Quick (50) + `HANDBOOK_MAX_PAGES=100` (env) | completed. F · 39 (SEO 38 / GEO 29 / AEO 28). Must 2 · Should 19 · Nice 40 · Couldn't check 11 (5 owner facts, 1 choice, **5 "the check itself failed"**). 100 pages read, mixed templates |

## Semrush (core only, 86 pages)

1 error · 248 warnings · 483 notices · 16 issue types · 16 healthy pages. schema.org on 59 pages.

## Agreement (first pass, scopes differ: app 100 mixed pages, Semrush 86 core pages)

| Check                     | App                                                             | Semrush                |
| ------------------------- | --------------------------------------------------------------- | ---------------------- |
| Missing meta description  | 99 pages                                                        | 58                     |
| Multiple H1 (home)        | in "not exactly one H1" 11                                      | 1                      |
| Links with no anchor text | 100 pages                                                       | 11                     |
| Generic internal anchors  | 49 pages                                                        | 121                    |
| One-inlink pages          | 4                                                               | 21                     |
| Redirected internal links | 2 pages (+ Must fix: calculators linked without trailing slash) | 71 permanent redirects |
| Structured data error     | JSON-LD relative / empty values 100 pages                       | 1 (home)               |

## App only

Bots allowed by robots.txt do not get the browser response (13 pages, Must) · AI-bot policy split · axe contrast / landmarks / labels · image returns an error on 100 pages · no LocalBusiness node · Article JSON-LD gaps · lab LCP / CLS on 15 of 15 templates · pre-consent pixels 83 pages · detail pages not linked from an index 46 · sitemap orphans 40 · near-duplicate pages 13 · `/page/2/` serves the homepage · security headers · AI-judged copy findings.

## Semrush only

| Issue                                 | Count | First-pass verdict                                                                       |
| ------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| External links returning 403          | 20    | open: 19 are mindbodyonline.com booking links (bot-blocked, likely `tool-wrong`); verify |
| Nofollow on internal links            | 45    | open: maps to SUPP-01, no app finding seen                                               |
| Nofollow on external links            | 225   | skip (info only)                                                                         |
| Unminified JS / CSS                   | 88    | skip (Lighthouse covers it)                                                              |
| Low text to HTML ratio                | 57    | skip (handbook rule: ignore)                                                             |
| Content not optimized                 | 9     | skip (not comparable)                                                                    |
| No HSTS                               | 2     | check: app lists Strict-Transport-Security in the header finding                         |
| llms.txt not found                    | 1     | skip (handbook: no proven effect)                                                        |
| Resource formatted as page link (mp4) | 1     | open: maps to P3-12                                                                      |

## App defects found by this test (B18)

1. Stage `crawl` is one unit with a 30-minute timeout and one retry (`workflow/hook.ts` `UNIT_STEP`); a site that takes longer to read fails with no result. `HANDBOOK_RUN_MAX_MINUTES` (90, "stops cleanly with partial coverage") is never reached.
2. A late attempt wrote stage `done` after the run was `failed`.
3. Failed run page prints "No findings. Every automated check passed".
4. UI "Quick (50 pages)" / "Whole site (up to 500)" limits the site audit only; the Handbook reads up to 1,000 pages on its own (`engine/depth.ts`).
5. No way to limit a check to chosen sections (include / exclude paths).
6. No progress during the crawl stage ("Reading pages 0 / 1" for 35 min).
7. 5 checks ended "the check itself failed" on run `06f68853`.
8. AI review stages done, cost shown $0.00 (verify).
9. Workaround in place on Ken's PC: `HANDBOOK_MAX_PAGES=100` appended to `.env.local` 2026-11-22 20:38 PT. Remove after fix 1.

## Process notes

- Semrush disallow masks: `/path/` works; `/path/*` is ignored.
- Before any field run: read the sitemap index, count URLs per section, confirm scope when over 100 pages.
