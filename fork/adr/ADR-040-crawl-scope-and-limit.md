# ADR-040: scope is decided before the run; the page limit goes to sitemap pages first

- Status: accepted (B27 run 110, WO-B27-003 / 004)
- Contracts: additive optional field `Coverage.scope` / report `run.coverage.scope` (`crawlScopeSchema`: limit, sitemap total and in-scope count, sections left out, in-scope sitemap URLs not read by section, discovered URLs not followed, parameter variants sampled / skipped). Not K3; `CONTRACTS_VERSION` stays 1.11.0 (ADR-036 / ADR-039 precedent).

## Context

antiquecandleco.com, audit `5cdbb86c` (B26 WO-091): sitemap 612 URLs, `/blogs/` left out → 481 in scope; the full check read 452 pages and reported "discovered 452, not capped". From the stored crawl list (`handbook_page_snapshot`, `audit_pages`) and the live sitemap, read only:

| Count                                                                             | URLs |
| --------------------------------------------------------------------------------- | ---- |
| In-scope sitemap URLs not read (`/pages/` 59, `/products/` 41, `/collections/` 5) | 105  |
| Non-sitemap URLs read: `?pr_prod_strat=…` recommendation variants                 | 57   |
| Non-sitemap URLs read: `?variant=`                                                | 5    |
| Non-sitemap URLs read: other (login / account / `/policies/` / cart)              | 14   |

Replaying the crawl's discovery list through `infiniteSpaceGuard` drops exactly the 105 in-scope sitemap URLs: past 300 URLs each path template keeps 100, and the dropped URLs never reach `coverage.unread` or `capped`. That is the cause, not the limit: the run never reached its 500-page limit. The 57 `pr_prod_strat` variants came from the render pass (Shopify renders recommendations in JavaScript); the second pass ran the guard over the render-only links alone, so the clean twin was not "listed" and every variant passed. The one S1 "not self-canonical" URL was the single variant whose clean twin was among the 105 unread.

Scope was chosen by a CLI preflight (`field-test.ts --preflight`) and a rule in a chat instruction; the app showed "Whole site (up to 500 pages)".

## Decision

1. **Sitemap first.** The crawl reads home, then every in-scope, robots-allowed sitemap URL round-robin across first path sections, then other URLs. The crawl-space guard (calendars, filters, archives, 100-per-template) applies to non-sitemap URLs only. Over the limit, sitemap URLs fill the room before the stratified fill picks among the rest.
2. **Variants.** A non-sitemap URL that differs from a known URL (read, queued or in the sitemap) only by its query string is a variant. The first of each parameter pattern (sorted parameter names) is read as a sample and not counted against the limit; the rest are skipped and counted. Numbered pagination is never a variant. The linking page keeps its link, so link checks keep their evidence. Both crawl passes use one rule.
3. **One limit, stated.** The run stores `coverage.scope`. One function (`scopeLines`) writes the run page notes and the export lines: the scope (in scope of total, sections left out with counts, the limit), and when the limit or the time budget stopped the run: pages read, in-scope sitemap pages not read by section, discovered URLs not followed, variants skipped, and "Site-wide findings are based on N of M in-scope sitemap pages". The review export lists the unread URLs by section. A site read whole gets no scope line.
4. **Preflight in the app.** `services/scopePreflight.ts` runs the run's own robots and sitemap collectors and counts robots-allowed sitemap URLs by first path section. `decideScope`: count ≤ limit → whole site; over → leave out archive-type sections (`/blog/`, `/news/`, `/tag/`, `/category/`, `/author/`, `/archive/`, `/page/`, `/YYYY/`) largest first, then the largest remaining sections, until in scope ≤ 90 % of the limit; home never; ties by name. Check a site (Whole site, no sections typed) shows the decision and prefills "Leave out sections"; the next press starts with the list as edited. A caller that passes no scope (`checkSite` without `excludePaths`) takes the automatic one. Quick (50 pages) samples and leaves nothing out.
5. **Stored with the run.** The report is rebuilt from the `handbook_run` row, so `coverage.scope` and `coverage.shortName` (ADR-039) are kept in one nullable JSON text column `coverage_extra` (both dialects; report-only metadata, never queried or joined). An unreadable value is dropped, not fatal; runs before this column show no scope line (WO-B27-090).
6. **Identity pages are never left out.** Like home, an About / Contact page (`about`, `about-us`, `our-story`, `who-we-are`, `our-team`, `meet-the-team`, `team`, `contact`, `contact-us` as the last path segment) is read even inside a left-out section, and the preview counts it with home. Leave-outs are for volume; P5-17 and the contact checks need these pages. Shopify keeps them under `/pages/`, which the automatic scope left out on antiquecandleco.com and produced a false "No About page found" (WO-B27-090).

## Alternatives

- Raise the limit: hides the cause (the guard, not the limit, dropped the pages). Rejected by WO-004.
- Keep the guard over sitemap URLs with a higher per-template cap: still silent on large shops; a sitemap is the site's own page list.
- Skip every variant without a sample: loses the evidence of what a variant answers (canonical, status) on sites where variants are the only link form.
