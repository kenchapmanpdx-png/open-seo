# ADR-032: Handbook accuracy part 2 (B17, §9 #5–#12)

- Status: accepted (run 84; contract part pending, see 6)
- Date: 2026-11-21 · Batch: B17 · Spec: `fork/DEPENDABILITY.md` §9 #5–#12 · `fork/batches/B17-heavy-accuracy-2.md`

## Context

The salonvata comparison (T5–T17) shows the Handbook reporting symptoms many times (15 P7-02 findings, ~30 attachment rows in P3-08) and missing root causes (attachment pages, theme demo content, duplicate entity nodes), empty anchors, one-inlink pages and 19 Semrush-only checks.

## Decision

1. **Grouping (#5)**: a rule that found problems on several template groups emits one finding; groups are detail rows (`key (N pages):` + page lines); `urls` = union; evidence split across groups (≤ 20). Only P7-02 / P7-03 (`perf.image-markup`) did this on the four goldens.
2. **Root causes (#8)**: new check `crawl.root-causes` (findings only; the other P3-12 / P5-04 checks give the pass):
   - P3-12 "WordPress attachment pages are published": REST alternate link `/wp-json/wp/v2/media/{id}` or a URL in an `attachment-sitemap`.
   - P5-04 "Placeholder text published" (deterministic part of P5-04): lorem ipsum, "Far far away, behind the word mountains", Vokalia and Consonantia, WordPress default post / page / tagline text.
   - P3-12 "Theme demo content is published": the placeholder pages plus category / tag / author archives whose own links (not template links, i.e. links on ≤ half the pages) all point at them.
   - P3-08: targets that only drop the same query and redirect to themselves fold into one row.
3. **Anchors (#6)**: SUPP-01 now covers generic anchors on external links and links with no name (no text, no image alt, no `aria-label`; in-page `#` and `javascript:` excluded). The generic list gains "more", "here", "website", "details" and similar.
4. **Entity rule (#7)**: new check `schema.entity-nodes` (P6-03): per page, > 1 business node, > 1 `WebSite` node, or differing names among them; nodes referenced as brand / parent / department / member / sponsor / funder are distinct organizations. Pages with the same node set are one row. Microdata is not collected (no contract field); the JSON-LD part catches salonvata.
5. **Weak-link pages (#9)**: `crawl.url-inventory` adds "Sitemap URLs with only one internal link" (P3-12, S4 with a severity reason: weaker than an orphan).
6. **Semrush GAP checks (#10)**: deterministic SUPP rules, not scored: SUPP-21 mixed content (S2), SUPP-22 internal `http://` links on an HTTPS site (S3), SUPP-23 meta refresh (S3), SUPP-24 malformed links (S3), in `crawl.link-hygiene`. `html-facts` stores `<meta http-equiv>` in `head.meta` under `http-equiv:<name>` (no shape change). Temporary internal redirects and a missing doctype need snapshot fields: contract 1.10.0 adds optional `PageSnapshot.redirectChain` and `PageSnapshot.doctype` (both sidecars rebuilt for the strict version check). The full GAP list with each row's disposition is in `fork/reports/B17.md`.

## Consequences

- More findings in "Additional findings" (SUPP-01, SUPP-21…24); scored findings change only for P3-12 / P5-04 / P6-03 additions and the P7-02 merge (golden S26 matches the merged finding's URLs).
- Symptom findings (thin, orphan, near-duplicate) stay; the root-cause finding says they share one cause. Dropping them would lose golden matches and hide pages that are thin for other reasons.

## Alternatives

- SUPP rules for attachment / demo content: rejected; P3-12 ("no test, draft, duplicate or thin pages published") and P5-04 ("no placeholder copy") already state them and are scored.
- Parsing microdata for #7: deferred until a golden needs it (contract field + parser).
