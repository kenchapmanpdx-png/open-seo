# ADR-038: an optional signal that is only absent is not S1 (ADR-034 addendum)

- Status: accepted (B23 run 103, WO-B23-001 / 002 / 004)
- Contracts: none; `CONTRACTS_VERSION` unchanged. `S1_CAP`, the scoring formula, the registry and `fork/handbook/` are not touched.

## Context

A Perplexity source review of `ken/main` (verified by Ken 2026-11-24) found checks that cap a grade at 39, or report a defect, for conditions Google documents as optional or as normal practice:

- P3-04: an indexable page with no `<link rel=canonical>` was S1. Google: canonical methods are recommended, none required; without one Google picks the canonical itself. `checks/hreflang.ts` already read a missing canonical as self-canonical.
- P3-15 / P9-05: a named robots.txt group that lets one crawler into paths `*` blocks was S1 for any search or AI bot. Google: a crawler follows only its most specific group; per-crawler groups are documented practice. The app cannot tell a deliberate rule from a mistake.
- P3-24: a missing `x-default` was part of the S3 "not reciprocal / complete" finding. Google: x-default is recommended for the fallback page.

## Decision

Principle: a signal Google documents as optional or recommended is not S1 (and not part of a broader defect) when it is only absent. The finding stays, with its fix; only its severity or grouping changes.

| WO         | Item          | Before                                                 | After                                                                                                    | Revert phrase                |
| ---------- | ------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| WO-B23-001 | P3-04         | "Indexable pages without a canonical" S1 (cap)         | S3, reason "no canonical declared: Google chooses one itself; …". Every other P3-04 branch unchanged     | "missing canonical stays S1" |
| WO-B23-002 | P3-15 / P9-05 | Named-group gap S1 for search / AI bots (cap)          | S3, title ends "— intended?", reason "… deliberate per-crawler rules are valid"; gap = evaluated outcome | "named-group gap stays S1"   |
| WO-B23-004 | P3-24         | No x-default inside the S3 "not reciprocal / complete" | Own S4 finding "Hreflang set has no x-default fallback"; PASS note counts alternates checked / declared  | "x-default required"         |

P3-04, P3-15 and P9-05 stay in the ADR-034 tables: other branches (canonical to another page, paginated series with orphans, link forms) still emit S1 for P3-04, and the registry default of P3-15 / P9-05 is S1, so `s1-scope.test.ts` requires them classified.

## Handbook conflicts (for Ken)

- Handbook §10 says every indexable page is self-canonical. That remains the recommendation and the finding's fix; only the severity changes.
- Handbook §18 names the mistake a named `Allow: /` group makes (it drops the `*` rules). The mistake is real; the app cannot tell it from a deliberate per-crawler policy, so it asks.

## Alternatives

- Remove the findings: rejected; the fixes are still good practice and the owner should decide.
- Keep S1 and exempt by platform: rejected; a platform list hides the same condition elsewhere.
