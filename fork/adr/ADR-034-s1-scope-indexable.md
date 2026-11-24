# ADR-034: S1 only where an indexable page is affected (B20)

- Status: accepted (run 93)
- Date: 2026-11-23 · Batch: B20 · `fork/batches/B20-heavy-cap-scope-speed.md` (WO-B20-002)

## Context

The handbook cap rule ("any open S1 → total ≤ 39") flattened four field sites to F · 39 (`fork/reports/B19-grade-cap-note.md`). Ken delegated the decision (chat, 2026-11-23): the cap rule, `S1_CAP` and the scoring formula stay; what changes is which findings are S1. A defect that can only affect pages search engines cannot index is not a Must fix.

## Decision

1. One shared step, `engine/s1-scope.ts` (`scopeS1ToIndexable`), runs in `evaluateRun` after the checks and before findings are numbered. Checks do not repeat it.
2. It applies only to S1 findings whose primary item is **page-scoped**: the defect is about what search engines see on the page (rendered content, render resources, link / canonical form, bot-check content). Built from the registry text of every S1-default item:

   | Item    | Registry text (short)                                         | Class       |
   | ------- | ------------------------------------------------------------- | ----------- |
   | P2-01   | Core content in server HTML                                   | page-scoped |
   | P3-04   | Self-canonical; canonical = internal links = `<loc>` URL form | page-scoped |
   | P3-20   | No Disallow on paths fetched during rendering                 | page-scoped |
   | SUPP-07 | Bot-check / interstitial page returned as HTTP 200 content    | page-scoped |
   | P3-01   | Apex↔www / HTTP→HTTPS one-hop 301/308                         | access      |
   | P3-05   | Moved URLs → closest relevant page, never homepage            | access      |
   | P3-10   | Unknown URLs return real 404                                  | access      |
   | P3-15   | robots.txt named groups carry the full Disallow set           | access      |
   | P9-01   | Each AI bot deliberately allowed / blocked; bot fetch = 200   | access      |
   | P9-05   | robots.txt evaluated per group                                | access      |

   Access items (indexability or crawl access is the defect itself) stay S1 whatever the page. A test fails when an S1-default item (registry or SUPP) is in neither list or in both.

3. A URL is **not indexable** when: robots.txt (a host that answered 200) disallows its path for Googlebot; or the crawled snapshot is not HTTP 200, redirects, carries `noindex` (meta or `X-Robots-Tag`), or (except for P3-04, whose defect is the canonical) has a canonical pointing elsewhere. A URL the run has no snapshot for keeps the finding's severity (unknown is not evidence).
4. All affected URLs not indexable → S3 with `severityReason` "affects only pages search engines cannot index (url (why); …)". Mixed → the finding is split: S1 on the indexable URLs, an S3 finding with the same evidence and that reason on the rest (deviation from the WO's "listed as info": the split keeps a finding with stored evidence on every affected page, and BadGEO can assert both severities).
5. BadGEO: `ITEM:Sx` in `badgeo-expect` asserts the severity (`badgeo-run.ts`); `/needs-blocked-js.html` expects `P3-20:S1`, `/members-results.html` (noindex, same blocked script) `P3-20:S3`.

## Finding on the motivating case

valentinecoffeeco `/cart` is **indexable** (checked live 2026-11-23 with a browser and a Googlebot UA): HTTP 200, self-canonical, no `noindex`, and Shopify's robots.txt disallows `/cart/` and `/cart.js`, not `/cart`. Under this rule the `/cart` P3-20 finding stays S1 and valentine stays capped. A carve-out for transactional pages (cart / account / checkout by path) would be a separate rule; it is not made here because the delegated decision was "indexable", and a path list would also hide real defects on such pages. Recorded for Ken in `fork/reports/B20.md`.

## Alternatives

- Change the cap (option 1 / 2 of the grade-cap note): rejected by the decision; the handbook rule stays.
- Per-check indexability filters: rejected; three copies of "indexable" already drifted (`scaled-sets.ts`, `canonical-form.ts`, `head-tags.ts`).
- Treat uncrawled URLs as not indexable: rejected; it would lower findings on evidence the run does not have.

## Addendum: link-form severity (WO-B20-009)

theogdenver.com was capped by "Internal links use a non-canonical URL form": `/menus` and `/happenings` link without the trailing slash, each answering one 301 to the canonical. Handbook §10 (P3-04) asks for links in the canonical form; it does not call a one-hop permanent redirect an indexing error. Decision (Ken delegated severity calls 2026-11-23): the crawl's own fetch of the linked form decides. One 301 / 308 straight to the canonical (200) → S3, title "… (one permanent redirect)", reason "each link reaches the canonical in one permanent redirect". A form that answers 200 (live duplicate), a 302 / 307, a chain of 2+ hops, an error or another landing URL stays S1. A form the crawl did not fetch keeps S1 (no new fetch class).

## Addendum: paginated series canonical to page 1 (B20 run 96)

theogdenver.com (field test 7, r2) was capped by "Indexable pages are not self-canonical": `/press/?p=2…6` canonical → `/press/`. Handbook §10 / common mistakes forbid it ("Don't canonical-tag a paginated series back to page 1 … self-canonical instead") without a severity; the harm is that Google may drop page 2+ and with it the only path to content linked from there. On theogdenver those pages link only off-site press articles. Decision (Ken delegated severity calls 2026-11-23): page N ≥ 2 of a list (one shared reading, `engine/pagination.ts`: numeric `page` / `paged` / `p` / `pg` / `pagenum` or `/page/N`) whose canonical is the list's first page is its own finding, "Paginated pages canonical to page 1". S1 when a crawled 200 site page is linked only from such pages (the detail names it); otherwise S3, reason "no crawled site page is linked only from these pages, so nothing is orphaned (the §11 risk); the series is still not self-canonical". P3-21 (S3) keeps reporting the series too. Alternatives: keep S1 always (caps a site for a defect with no indexing effect on it); drop to S3 always (misses the orphaning case the handbook names).
