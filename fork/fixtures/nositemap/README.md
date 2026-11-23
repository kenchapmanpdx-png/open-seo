# NoSitemap — GoodGEO without a sitemap (WO-B19-013)

GoodGEO with no `/sitemap.xml` (404), no `Sitemap:` line in robots.txt, and
`/wheel-building.html` linked only from the home page body. Expected: P3-12
"No XML sitemap" (on `/sitemap.xml`), P3-19 "robots.txt has no Sitemap: line"
(on `/robots.txt`), P3-12 "Pages with only one internal link" on
`/wheel-building.html`; nothing else.

    FIXTURE_ROOT=fork/fixtures/nositemap pnpm exec tsx fork/scripts/badgeo-run.ts
