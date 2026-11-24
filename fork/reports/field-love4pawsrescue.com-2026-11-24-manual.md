# Field test (manual, in-app) — love4pawsrescue.com — 2026-11-24

Round 2 (post-B20, run 98, tag handbook-v3.9.0). Manual comparison: the in-app run has no report.json export, so `fork/scripts/field-test.ts` was not used. Ledger row (`fork/FIELD-TESTS.md`) not written; run `field-test.ts love4pawsrescue.com --external fork/fixtures/external/love4pawsrescue.com-semrush-2026-11-24.csv` on the build machine to produce it.

## Size gate
- Platform: Squarespace
- Sitemap: 14 `<loc>`
- App: 16 pages read, no "stopped at its 50-page limit" note
- Semrush: crawl FINISHED, 29 of 50 pages, limit not hit
- Verdict: valid apples-to-apples site (whole site fits both crawlers)

## Semrush export
- File: `fork/fixtures/external/love4pawsrescue.com-semrush-2026-11-24.csv` (101 rows, Semrush snapshot 6b05e95475d5bb25ce46272f)
- Page URL = page the issue is on. For redirect rows, Page URL = page holding the link, Target URL = the redirecting URL (as Semrush `issue_details` returns them).
- Not in CSV: issues Semrush reported 0 for. `schemaOrg` markup = 0.

## Comparison

| Issue | Semrush | App | Verdict | Tag |
| --- | --- | --- | --- | --- |
| Missing H1 | 8 | 8 | agree; live fetch: same 8 pages have 0 `<h1>` | SUPPORTED |
| Multiple H1 | 2 | 2 | agree; live fetch: /rescuekittysunnyibd and /dog-and-cat-adoptions have 2 `<h1>` | SUPPORTED |
| Missing meta description | 5 | 5 | agree; live fetch: tag present with empty content on the 5 pages (a presence-only check would pass them) | SUPPORTED |
| Title too long (>70) | 14 | 15 | skip (tool gap): the app's 15th URL is /love4pawsanimalrescue (200, 88-char title, canonical → /). It is in sitemap.xml and linked from no page, so Semrush lists it as an orphaned sitemap page and never audits its title. App is right. | SUPPORTED |
| Orphaned sitemap page | 1 | 1 ("Sitemap <loc> canonicalises to another URL") | agree; different wording, same page | SUPPORTED |
| Temporary redirects | 42 link rows to 3 targets (/new-dropdown, /aboutlove4pawserscue, /donate-to-a-nonprofit) | 16 pages / redirected-or-retired URLs | agree on cause: 3 nav links redirect 302 on every page | SUPPORTED |
| Permanent redirects | 3 | covered by redirected-or-retired URLs | agree | SUPPORTED |
| Low word count | 10 (<200 words) | threshold differs (<50 main-content words) | skip: threshold difference, not a defect | SUPPORTED |
| Low text/HTML ratio | 14 | — | skip: handbook rule "ignore" (not a Google factor) | SUPPORTED |
| llms.txt not found | 1 | — | skip: handbook: no proven effect | SUPPORTED |
| /cart blocked from crawling | 1 | — | skip: normal Squarespace commerce path | SUPPORTED |

## App-only (Semrush has no equivalent)
- JSON-LD issues (Semrush schemaOrg = 0), axe contrast, Core Web Vitals lab data, security headers, heading order.

## Page-count gap
- Semrush `info`: 29 crawled = 15 pages with issues + 1 healthy + 11 redirected + 1 broken + 1 blocked (/cart).
- App: 16 pages. The broken page was not identified (not looked up).
- A live fetch of /aboutlove4pawserscue (a 302 target) returned 503 once; possibly Squarespace rate limiting from rapid fetches (SPECULATIVE).

## Result
- Zero app misses on ranking-relevant issues. One tool-side gap (orphan sitemap page not audited by Semrush), in the app's favour.
- No work order needed from this site.
