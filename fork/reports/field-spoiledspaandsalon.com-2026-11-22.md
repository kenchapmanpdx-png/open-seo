# Field test 1 — spoiledspaandsalon.com, app vs Semrush (first pass, 2026-11-22)

Source: in-app Check a site run (2026-11-22 19:05 PT, Handbook v4.6, look C) read in the browser; Semrush Site Audit through the connector. Per-URL Semrush rows: `fork/fixtures/external/spoiledspaandsalon.com-semrush-2026-11-22.csv`. The in-app `report.json` is not in the repo; B18 R1 reruns the engine by CLI and does the by-URL triage.

## Runs

| Item     | App                                                                       | Semrush                                               |
| -------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Pages    | 49 web pages + 1 file                                                     | 54 of 100                                             |
| Blocked  | 0                                                                         | 0                                                     |
| Result   | F · 39, capped from 49.3 (SEO 39 / GEO 36 / AEO 33)                       | 6 errors · 117 warnings · 41 notices · 14 issue types |
| Findings | Must 4 · Should 15 · Nice 38 · Couldn't check 6 (5 owner facts, 1 choice) | schema.org items 0 · Open Graph 45 · Twitter card 45  |

## Agreement

| Check                        | App                     | Semrush |
| ---------------------------- | ----------------------- | ------- |
| Missing H1                   | 13                      | 13      |
| Multiple H1                  | 3                       | 3       |
| Duplicate title              | 2                       | 2       |
| Missing meta description     | 21                      | 20      |
| Orphaned sitemap URLs        | 5                       | 5       |
| Pages with one internal link | 28                      | 30      |
| Dead outbound links          | 1 page                  | 2 + 1   |
| Generic anchor               | 1 page                  | 1       |
| Slow pages                   | lab LCP > 2.5 s 9 pages | 4       |

## App only

robots.txt named groups missing the `*` Disallow set (4 findings, grade cap) · axe contrast 49 pages · heading order / landmarks 49 · skip link / names / alts 49 · Product markup without offers / return policy 18 · no ItemList / BreadcrumbList 18 · LocalBusiness without `@id`, generic type · WebSite without alternateName · lab CLS 0.107 Home mobile · H1 "hair stylist" on 11 pages · video findings · security headers · share image size · max-image-preview · AI-judged title and copy findings (never gate).

## Semrush only

| Issue                     | URLs | First-pass verdict                                |
| ------------------------- | ---- | ------------------------------------------------- |
| Low text to HTML ratio    | 45   | skip (handbook rule: ignore)                      |
| Low word count            | 36   | open → WO-B18-005 (app thin-page rule flags 2)    |
| Title element is too long | 1    | open → WO-B18-004 (maps to P4-01, no app finding) |
| Low Semantic HTML usage   | 1    | open → R1 triage (maps to P4-08)                  |
| schema.org items = 0      | —    | open → WO-B18-007 (app read JSON-LD on 19 pages)  |

## Lessons queued (B18)

- One cause produced 4 Must-fix findings and the grade cap → WO-B18-001, 003.
- AdsBot may be a false positive in that finding → WO-B18-002.
- "Check a site" from a project with no domain created a duplicate project → WO-B18-008.
- No single command or ledger for field tests → WO-B18-009, 010.
