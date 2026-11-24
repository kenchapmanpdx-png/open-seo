# Field test (manual, in-app) — mobilepetgroomingaz.com — 2026-11-24

Round 2 (post-B20, run 98, tag handbook-v3.9.0). Manual comparison: in-app run has no report.json export, so `fork/scripts/field-test.ts` was not used. Ledger row (`fork/FIELD-TESTS.md`) not written; run `field-test.ts mobilepetgroomingaz.com --external fork/fixtures/external/mobilepetgroomingaz.com-semrush-2026-11-24.csv` on the build machine.

## Size gate
- Platform: Wix
- Sitemap: pages-sitemap.xml, 5 `<loc>`
- App: 5 pages read (/, /about, /contact, /faq, /services); Details has no "stopped at its 50-page limit" note
- Semrush: crawl FINISHED, 13 of 50 pages, limit not hit (project 32116853, snapshot 6b05f6952e0d468f0663c951)
- Verdict: valid apples-to-apples site

## App run
- Run hb-e4253256-4e72-464e-8776-e2ada7b6b9be, 2026-11-24 13:25 MST, completed
- Grade C · 62.1 (SEO 63 / GEO 50 / AEO 45); must fix 0, should fix 6, nice to have 24; couldn't check 5 (4 owner facts, 1 owner decision)
- Grade is final (browser helper worked)

## Semrush export
- File: `fork/fixtures/external/mobilepetgroomingaz.com-semrush-2026-11-24.csv` (39 rows)
- Semrush counted the root twice (with and without trailing slash), so 6 audited URLs = 5 real pages + 1 variant. Rows keep both.
- Not in CSV: issues Semrush reported 0 for (title too long, missing/multiple H1, missing meta, 4xx, broken internal links, temporary/permanent redirects, HTTP sitemap URLs, HSTS, uncached/unminified JS-CSS, disallowed external resources, orphaned sitemap pages, llms.txt).

## Comparison

| Issue | Semrush | App | Verdict | Tag |
| --- | --- | --- | --- | --- |
| Broken external links | 12 rows = 2 targets (http://jempetsupplies.com, https://www.jempetsupplies.com/) x 6 source URLs | "Outbound links are dead", 5 pages, same 2 targets (no DNS answer) | agree | SUPPORTED |
| Low word count | 2 (/contact, /about) | 1 (/contact, 30 words; threshold < 50 main-content words) | skip: threshold difference (Semrush < 200 words); /contact agree | SUPPORTED |
| Missing/multiple H1, title, meta description | 0 | 0 | agree | SUPPORTED |
| Redirects, HTTP sitemap URLs, HSTS | 0 | 0 on these; app adds apex http→https in 2 hops (F23) and nuvet.com 302 (F25) | agree; app-only extras | SUPPORTED |
| Low text/HTML ratio | 6 | — | skip: handbook rule "ignore" | SUPPORTED |
| Resources formatted as page links | 12 rows (2 wixstatic images) | — | skip: live fetch of / has 4 anchors to wixstatic; not a ranking factor, no handbook rule | SUPPORTED (anchors); SPECULATIVE (no ranking effect) |
| Links with no anchor text | 4 (nuvet.com/70832, Vimeo player; on / and root variant) | — | skip, not reproduced: live raw HTML of / has 3 nuvet.com anchors, all with text | SUPPORTED (anchors have text); SPECULATIVE (Semrush reads a different text node) |
| Pages with only one internal link | 1 (/) | — | skip: live / has 8 internal anchors to 5 distinct pages; Semrush counts inbound links and splits / from the no-slash variant | SUPPORTED (anchors); SPECULATIVE (cause) |
| Low semantic HTML | 1 (/services) | — | skip: notice-level; app landmark/heading check has no finding on this site | SUPPORTED |
| Content not optimized | 1 (/faq) | FAQ answers finding (F30) | skip: LLM-judged | SUPPORTED |

## App-only (Semrush has no equivalent)
- JSON-LD: WebSite missing alternateName, LocalBusiness missing @id and address, generic type, no sameAs.
- Lab LCP 4.4–8.4 s on 2 of 2 templates; HTML above 500 KB on 4 pages; analytics before load.
- Skip link, filename alts, og:image declared 2500x1330 (not 1200x630), max-image-preview, sitemap lastmod = build date, robots named groups miss `*?lightbox=`, NAP formats, entity/local checks, FAQ answers.

## Result
- Zero app misses on ranking-relevant issues. All Semrush rows without an app counterpart are skip-class (ratio, image-as-link, notice-level, not reproduced).
- No work order needed from this site.
