# Field test (manual, in-app) — aweandorderorganizing.com — 2026-11-24

Round 2 (post-B20, run 98, tag handbook-v3.9.0). Manual comparison: in-app run has no report.json export, so `fork/scripts/field-test.ts` was not used. Ledger row (`fork/FIELD-TESTS.md`) not written; run `field-test.ts aweandorderorganizing.com --external fork/fixtures/external/aweandorderorganizing.com-semrush-2026-11-24.csv` on the build machine.

## Size gate
- Platform: Weebly behind Cloudflare (handbook P0-03: cf-ray + editmysite scripts)
- Sitemap: 7 `<loc>` (all `http://`)
- App: 8 pages read (7 `.html` pages + /index.html); no "stopped at its 50-page limit" note in Details
- Semrush: crawl FINISHED, 15 of 50 pages, limit not hit (project 32116854, snapshot 6b05f69575d5bb25ce55c994)
- Verdict: valid apples-to-apples site

## App run
- Run hb-c99f1071-a911-4e07-b108-0efbed4227a5, 2026-11-24 13:27 MST, completed
- Grade F · 39 (45.4 before the must-fix cap; SEO 39 / GEO 33 / AEO 42); must fix 3, should fix 9, nice to have 21; couldn't check 18
- **Grade is not final**: the browser helper got HTTP 403 (no-JS fetch also 403). 10 checks need it (P1-02, P2-01, P2-05, P2-07, P2-08, P2-09, P3-20, P5-14, P7-04, P7-06). Normal Chrome gets 200 on all 8 pages.
- Cap drivers: no canonical (8 pages), NerdyBot robots group, ClaudeBot 403 (7 of 7 fetches)

## Semrush export
- File: `fork/fixtures/external/aweandorderorganizing.com-semrush-2026-11-24.csv` (98 rows)
- "Unminified JavaScript and CSS files": Semrush total 91; the connector returned the first 50 (page parameter ignored). CSV carries those 50. Mapped to skip, so no effect on the comparison.
- Not in CSV: issues Semrush reported 0 for (title too long, multiple H1, redirects, broken external links, orphaned sitemap pages, blocked, only-one-internal-link, no anchor text, low semantic HTML, content not optimized).

## Comparison

| Issue | Semrush | App | Verdict | Tag |
| --- | --- | --- | --- | --- |
| Missing H1 | 7 | 8 (same 7 + /index.html) | agree; live fetch: 0 `<h1>` on all 8 pages | SUPPORTED |
| Missing meta description | 6 | 6 (same pages) | agree; live: empty on those 6, 53 chars on / and /index.html | SUPPORTED |
| Canonical missing | not in the Semrush issues pulled | 8 pages, must-fix | app-only; live: 0 `<link rel=canonical>` on all 8 pages | SUPPORTED |
| HTTP URLs in sitemap (HTTPS site) | 7 | F17: same 7 `http://` URLs, HTTP 200 then redirect to https | agree (P3-19 itself says OK because it compares host only; the defect surfaces under P3-12) | SUPPORTED |
| 4xx + broken internal links | 1 URL + 7 links, all /cdn-cgi/l/email-protection | F16: same URL, 404, 8 pages | agree; live fetch: 404. Cloudflare email-obfuscation path; real links normally carry a `#hash` decoded by script | SUPPORTED (404); SPECULATIVE (hash behaviour) |
| No HSTS | 2 (www / and apex /) | F31 lists Strict-Transport-Security missing, 8 of 8 | agree | SUPPORTED |
| Uncached JS/CSS | 7 (main_style.css, query-versioned) | P7-07 = OK ("0 hashed asset(s) immutable; no hashed asset found") | **MISS (tool gap)**: live fetch of /files/main_style.css returns 200 with no Cache-Control header. App only judges hashed assets, so unhashed assets pass. | SUPPORTED (header absent); SPECULATIVE (size of ranking effect: repeat-visit speed only) |
| Low word count | 2 (/photos.html, /contact.html) | — | skip: threshold difference (Semrush < 200 words, app < 50 main-content words); word counts not measured | SPECULATIVE |
| Low text/HTML ratio | 6 | — | skip: handbook rule "ignore" | SUPPORTED |
| Unminified JS/CSS | 91 | — | skip: Lighthouse render-blocking (F28) covers it | SUPPORTED |
| Resources formatted as page links | 1 (/ → uploaded .jpg) | — | skip: not a ranking factor | SPECULATIVE |
| Disallowed external resources | 1 (/contact.html → Weebly map widget) | P3-20 couldn't check (browser helper 403) | skip: third-party widget; not checked this run | SPECULATIVE |
| llms.txt not found | 1 | — | skip; live /llms.txt = 404 | SUPPORTED |

## App-only (Semrush has no equivalent)
- Duplicates: /index.html live duplicate of / (same title and description), /about.html/ trailing-slash duplicate, host/protocol variant in 2 hops.
- Robots: NerdyBot named group misses `*` Disallows; ClaudeBot and Bytespider get 403 while robots.txt allows them.
- JSON-LD absent (no WebSite/Organization), heading order / no `<main>`, skip link, icon-only buttons, lab LCP 3.4–8.9 s, render-blocking head scripts, images without dimensions, lastmod = 2023-01-02, twitter:card, max-image-preview, AI-judged copy findings.

## Work-order candidates (red case → class fix → guard → rerun)
1. **P7-07 passes unhashed uncached assets.** Red case: this site (live: no Cache-Control on same-origin CSS). Class fix: when no hashed asset exists, evaluate same-origin CSS/JS for any caching header and report missing ones. Guard: entry-point test with an unhashed, header-less stylesheet fixture. Rerun: this site.
2. **F18 double-counts F17.** Red case: sitemap lists 7 pages under `http://`; P3-13 reports `sitemap-only 7 · crawled-only 8`, so F18 says 8 pages are "missing from the sitemap" while F17 already reports the same 7 URLs as redirecting. Class fix: normalise scheme (same host) before comparing sitemap `<loc>` to crawled URLs; F17 carries the scheme defect, F18 only truly absent pages. Guard: sitemap fixture with http:// `<loc>` for an https site. Rerun: this site.
3. **Cloudflare 403 drives a grade cap before the owner decision.** F03 (must-fix, ClaudeBot 403 on 7 of 7 fetches) caps the grade at 39 while P9-04 (owner decides which AI bots may read the site) is still open, and F32 reports the same evidence at nice-to-have. Cloudflare's bot/AI blocking is typically a platform setting, so the cause is likely deliberate (SPECULATIVE). Candidate fix: report the split once, and do not cap the grade on it until P9-04 is recorded. Needs Ken's call on severity policy; not a defect with a single right answer.

## Result
- Of the 6 ranking-relevant Semrush issue types on this site (H1, meta, sitemap scheme, 4xx/broken links, HSTS, uncached CSS), the app matches 5 and misses 1 (uncached CSS, P7-07).
- The browser helper outage makes the grade provisional (banner shown correctly); 10 checks need a rerun with the helper allowed through Cloudflare, or a different render route. Live bot-UA test (curl as ClaudeBot) was not run (blocked in this session), so the 403 cause is SUPPORTED only by the app's stored evidence.
