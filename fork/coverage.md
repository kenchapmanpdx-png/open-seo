# Coverage — handbook v4.6 §41 registry

Source: `src/server/features/handbook/registry.ts` (129 items; `pnpm tsx fork/scripts/handbook-sync.ts` → 0 diffs). Class definitions + severity rules: `src/server/features/handbook/contracts/registry-types.ts`. Generated 2026-11-14 (B1 R2).

## Phase × primary class

| Phase     | CRAWL | HEADERS | ROBOTS | BOTFETCH | SCHEMA | RENDER | PERF | A11Y | LLM | DATA | OWNER | Total |
| --------- | ----- | ------- | ------ | -------- | ------ | ------ | ---- | ---- | --- | ---- | ----- | ----- |
| P0        | 2     | ·       | ·      | ·        | ·      | ·      | ·    | ·    | ·   | ·    | 1     | 3     |
| P1        | 3     | ·       | ·      | ·        | ·      | ·      | ·    | ·    | ·   | 2    | ·     | 5     |
| P2        | 4     | ·       | ·      | ·        | 1      | 5      | 1    | ·    | 1   | ·    | 1     | 13    |
| P3        | 17    | 1       | 5      | ·        | ·      | ·      | ·    | ·    | ·   | 1    | 1     | 25    |
| P4        | 9     | ·       | ·      | ·        | ·      | ·      | ·    | ·    | 2   | 1    | ·     | 12    |
| P5        | 5     | ·       | ·      | 1        | ·      | 1      | ·    | ·    | 10  | 1    | ·     | 18    |
| P6        | ·     | ·       | ·      | ·        | 14     | ·      | ·    | ·    | ·   | ·    | 1     | 15    |
| P7        | 2     | 1       | ·      | ·        | ·      | 1      | 6    | ·    | ·   | ·    | ·     | 10    |
| P8        | ·     | 2       | ·      | ·        | ·      | 1      | ·    | 4    | ·   | ·    | 2     | 9     |
| P9        | 2     | ·       | 1      | 1        | ·      | ·      | ·    | ·    | ·   | 1    | 1     | 6     |
| P10       | ·     | ·       | ·      | ·        | ·      | ·      | ·    | ·    | ·   | 5    | 2     | 7     |
| P11       | ·     | ·       | ·      | ·        | ·      | ·      | ·    | ·    | ·   | 4    | ·     | 4     |
| REVIEW    | 2     | ·       | ·      | ·        | ·      | ·      | ·    | ·    | ·   | ·    | ·     | 2     |
| **Total** | 46    | 4       | 6      | 2        | 15     | 8      | 7    | 4    | 13  | 15   | 9     | 129   |

Secondary-class touches: CRAWL 26 · HEADERS 4 · ROBOTS 4 · BOTFETCH 0 · SCHEMA 6 · RENDER 7 · PERF 4 · A11Y 0 · LLM 21 · DATA 11 · OWNER 25

| automatable | count |
| ----------- | ----- |
| full        | 50    |
| partial     | 74    |
| none        | 5     |

| severityDefault | scale | default |
| --------------- | ----- | ------- |
| S1              | 9     | 0       |
| S2              | 25    | 0       |
| S3              | 24    | 39      |
| S4              | 32    | 0       |

Reading: CRAWL dominates P3–P4 (raw fetch + link graph + sitemap); SCHEMA owns P6; LLM owns P5 (content + facts); DATA/OWNER own P10–P11 (account access, never PASS without evidence). Engine process items (P0-01, P1-02…P1-04, RV-01, RV-02) are filed under CRAWL because the engine produces them from the crawl.

## automatable = none

- P3-18 — [T3+] [AUDIT] Evergreen archive content on own domain (§10 Site migration)
- P6-12 — [gate: a Knowledge Panel exists for the brand] Panel claim queued for the owner (§33 Set up at launch)
- P8-07 — [gate: SP6] Legal review of pixels/analytics on condition-specific pages before launch (§30)
- P10-05 — [gate: GA4 in use AND owner approves a Google Cloud project] GA4 → BigQuery export linked at launch (§33 Set up at launch)
- P10-06 — [AUDIT] Validate Fix on every fixed GSC issue (§17, §24)

All five are owner actions or owner-only account steps. The engine marks them BLOCKED (owner) or N/A (gate false); they never score PASS.

## Upstream gaps → registry items

Every `N` / `partial` row of `fork/fixtures/upstream-gap.md`, with the registry item(s) that catch it (from `fork/fixtures/expected/*.expected.yaml`).

| Site            | Finding                                                                        | Upstream | Registry item(s)                  | detectableBy  |
| --------------- | ------------------------------------------------------------------------------ | -------- | --------------------------------- | ------------- |
| whyracingevents | F01 Core content JS-only (team grid, home calendar)                            | N        | P2-01, P2-09, P5-17               | render        |
| whyracingevents | F02 Fallback / error text in raw HTML                                          | N        | P2-04, P2-03                      | deterministic |
| whyracingevents | F03 robots.txt named groups lack `*` Disallows                                 | N        | P3-15, P9-05                      | deterministic |
| whyracingevents | F04 Retired events 302 → homepage                                              | N        | P3-05, P3-07, P3-08               | deterministic |
| whyracingevents | F05 Public admin page: noindex + Disallow conflict, footer link                | partial  | P3-16, P3-13                      | deterministic |
| whyracingevents | F06 Event schema thin (city-only place, date-only, no price, filler performer) | N        | P2-06, P6-05, P6-15               | deterministic |
| whyracingevents | F07 Duplicate Organization nodes, WebSite without `@id`                        | N        | P6-03, P6-01                      | deterministic |
| whyracingevents | F08 Placeholder venue "Main Event Site"                                        | N        | P5-04, P6-15, P9-03               | llm           |
| whyracingevents | F09 Same 5-question FAQ on 11 pages                                            | N        | P5-05, P6-07                      | deterministic |
| whyracingevents | F10 Conflicting, unsourced stats                                               | N        | P5-02                             | llm           |
| whyracingevents | F11 Mobile LCP 4.9–23.9 s, 47–53 MB pages                                      | partial  | P7-09, P2-05, P7-03, P7-01        | render        |
| whyracingevents | F12 Logo as `og:image`, no `max-image-preview`                                 | N        | P4-09, P4-11                      | deterministic |
| whyracingevents | F13 `.reveal` opacity-0 without JS                                             | N        | P2-07                             | render        |
| whyracingevents | F14 Slogan H1s                                                                 | N        | P4-02                             | llm           |
| whyracingevents | F15 Unsupported superlatives                                                   | N        | P5-04, P5-03                      | llm           |
| whyracingevents | F16 Thin event pages (138–236 words)                                           | N        | P5-15                             | deterministic |
| whyracingevents | F17 `/pages/first-5k.html` orphan; 1–2 inlinks to event pages                  | N        | P3-12, P2-10                      | deterministic |
| whyracingevents | F18 Brand naming inconsistent                                                  | N        | P5-07, P6-09                      | llm           |
| whyracingevents | F19 llms.txt numbers contradict                                                | N        | P9-02, P5-02                      | llm           |
| whyracingevents | F20 About: no first-screen CTA, no Person schema                               | N        | P5-14, P5-17                      | render        |
| whyracingevents | F21 `http://www` → 2 hops                                                      | N        | P3-01                             | deterministic |
| whyracingevents | F22 `/index.html` 200, trailing-slash split, 404 canonical → home              | N        | P3-03, P3-02, P3-11               | deterministic |
| whyracingevents | F23 6 titles lack brand suffix; 2 meta descriptions > 170 chars                | partial  | P4-01                             | deterministic |
| whyracingevents | F24 299 `<img>` without width/height; distorted logos                          | partial  | P7-02                             | deterministic |
| whyracingevents | F25 Pixels load early; CSP console errors                                      | partial  | P7-04                             | render        |
| whyracingevents | F26 Render-blocking fonts; cache policy                                        | partial  | P7-05, P7-07                      | render        |
| whyracingevents | F27 Contrast failures                                                          | partial  | P8-02                             | render        |
| whyracingevents | F28 HSTS preload without list entry                                            | N        | P8-01, P8-05                      | deterministic |
| whyracingevents | F29 Outbound links to redirecting URLs                                         | N        | P5-13                             | deterministic |
| whyracingevents | F30 Mixed URL styles, slug artifacts                                           | N        | P2-12                             | llm           |
| ryanmscottsdale | F01 No LocalBusiness / Organization schema; empty WebSite fields               | N        | P6-10, P6-11, P6-02, P6-03, P6-01 | deterministic |
| ryanmscottsdale | F02 Titles lack service + place terms                                          | N        | P4-02                             | llm           |
| ryanmscottsdale | F05 `og:image` home only, `http://`, wrong size                                | N        | P4-09, P4-11                      | deterministic |
| ryanmscottsdale | F06 `/stylists-test` stale roster, indexable, in sitemap                       | partial  | P3-12, P4-03, P5-02               | deterministic |
| ryanmscottsdale | F07 Lab perf 28–38, LCP 11.8–36 s, 9.4 MB                                      | partial  | P7-09, P2-05, P7-03, P7-04        | render        |
| ryanmscottsdale | F08 Contrast, unnamed carousel buttons, `alt=""` staff photos, unlabeled navs  | partial  | P8-02, P8-04, P8-06               | render        |
| ryanmscottsdale | F09 Duplicate bio (99 %) + 3-word soft-404 bio                                 | partial  | P3-12                             | deterministic |
| ryanmscottsdale | F10 Sitemap lists canonicalised `/home`                                        | partial  | P3-12, P3-04                      | deterministic |
| ryanmscottsdale | F11 Uncited superlatives                                                       | N        | P5-04, P5-03                      | llm           |
| ryanmscottsdale | F12 Awards as images only                                                      | N        | P5-11                             | llm           |
| ryanmscottsdale | F13 Thin home, no mobile Book button                                           | N        | P5-14, P5-01                      | render        |
| ryanmscottsdale | F14 One `/service` page for all services; `/products` thin                     | partial  | P5-09, P5-18                      | llm           |
| ryanmscottsdale | F15 Prices printed twice in raw HTML                                           | N        | P5-12, P2-09                      | deterministic |
| ryanmscottsdale | F16 404 body = About page with canonical `/about-rms`                          | N        | P3-11                             | deterministic |
| ryanmscottsdale | F17 Generic anchors ("Read more", "Click here")                                | N        | — (no §41 item)                   | deterministic |
| ryanmscottsdale | F18 HSTS `max-age=0`, missing security headers                                 | N        | P8-05, P8-01                      | deterministic |
| ryanmscottsdale | F19 No GA4/GTM; Facebook pixel everywhere                                      | N        | P10-03, P7-04                     | deterministic |
| ryanmscottsdale | F20 Training bots share `*` group (policy decision)                            | N        | P9-04, P9-05                      | owner         |
| ryanmscottsdale | F21 Contact form client-side only                                              | N        | P2-08, P2-01                      | render        |
| ryanmscottsdale | F22 `target=_blank` without `noopener`                                         | N        | P4-12                             | deterministic |
| ryanmscottsdale | F23 `/contact/` 200 instead of redirect                                        | N        | P3-02                             | deterministic |
| ryanmscottsdale | A01 Viewport lacks `width=device-width`                                        | N        | P4-04                             | deterministic |
| ryanmscottsdale | A02 No SPF / DMARC                                                             | N        | out of scope                      | —             |
| ryanmscottsdale | A03 Spammy backlink profile                                                    | N        | out of scope                      | —             |
| ryanmscottsdale | A04 Ranking context                                                            | N        | out of scope                      | —             |
| ryanmscottsdale | A05 Address not machine-parseable; 2 phone formats                             | N        | P5-08                             | deterministic |
| ryanmscottsdale | A06 Brand naming inconsistent                                                  | N        | P5-07                             | llm           |
| ryanmscottsdale | A07 Instagram link unnamed; no skip link                                       | partial  | P8-04                             | deterministic |
| ryanmscottsdale | A08 Render-blocking CSS/JS, short cache lifetimes                              | partial  | P7-05, P7-07                      | render        |
| ryanmscottsdale | A09 Award image + footer logo `alt=""`                                         | N        | P8-04, P5-11                      | deterministic |
| ryanmscottsdale | A10 No CrUX data                                                               | N        | P7-10                             | data          |
| ryanmscottsdale | S01 Gift-card link 403 for bot UAs                                             | N        | P5-13                             | deterministic |
| ryanmscottsdale | S02 Price list built from `<div>`s                                             | N        | P5-12                             | deterministic |
| ryanmscottsdale | S03 `/ryanm-bio` no meta description, 1 inlink                                 | partial  | P4-03, P3-12                      | deterministic |

Headline: 64 upstream misses/partials. 61 map to ≥1 registry item; 1 has no §41 item (ryanmscottsdale F17 generic anchors: §12 rule only); 3 are out of scope (A02–A04). By detection path: 35 deterministic · 12 render (sidecar) · 12 LLM · 1 data · 1 owner.

## Notes

- Severity defaults: 90 items map onto a category the handbook EP severity scale names (`severitySource: scale`); 39 fall back to S3 (`default`). Golden audits show auditors downgrade per finding (e.g. redirect hop count S4, robots over-allow S2); checks may do the same with a stated reason.
- Handbook gap candidates seen in the golden audits that v4.6 now covers: viewport `width=device-width` (P4-04), skip link (P8-04), postal-format address + one `tel:` format (P5-08).
- Generic anchor text (§12) has no §41 line; since B9 it is reported as SUPP-01 (unscored).

## Full-read refresh (B10, 2026-11-19, contracts 1.6.0)

- Item coverage on a `quick` run (whyracingevents.com, run 53): 129 items · PASS 30 · OPEN 22 · BLOCKED 39 (no sidecar / no LLM key in that run, owner decisions) · NA 20 · DEFERRED 18. The 18 with no automated check: P1-01, P1-05, P2-13, P3-06, P3-09, P3-18, P4-05, P5-18, P10-01…P10-07 (minus P10-05), P11-01…P11-04 (owner / off-site / data items).
- Supplementary rules (FULL-READ §6, ADR-020; reported under "Additional findings", never scored): SUPP-01…SUPP-16, each with a BadGEO page. The earlier sensitive-data-forms rule was dropped as outside scope [Ken 2026-11-16]; SUPP-05 is now test / dev / numbered-slug pages.
- Full-depth golden results (catch rates per site, FULL-READ §9) are in `fork/reports/B10.md`.
