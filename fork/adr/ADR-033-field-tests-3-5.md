# ADR-033: Field tests 3–5 fixes (B19)

- Status: accepted (run 89)
- Date: 2026-11-23 · Batch: B19 · `fork/batches/B19-heavy-field-tests-3-5.md`

## Context

Three field sites (Squarespace, Shopify, a site with no sitemap) compared with Semrush showed false positives by rule shape, not by effect: every Shopify store got an S1 for robots-blocked checkout scripts, canonicalised duplicates were reported as "not self-canonical", hidden-text counts exceeded the page's word count, and a site without a sitemap got no sitemap finding at all.

## Decision

1. **P3-20 by effect (WO-004)**: the render collector re-renders each template sample that made robots-blocked same-host requests, with those exact URLs aborted (K3 `abortUrls`, aborted reason `robots`), and stores `RenderData.js.robotsBlocked` (URLs, words before / after, same content, up to 5 missing lines). Different text → S1 with the missing lines; same text on every measured sample → S4 with `severityReason` "blocked resources do not change the rendered content". No platform allow-list. Runs without the measurement keep the by-type rule. Text is compared, layout is not (no screenshot diff): a blocked stylesheet that only changes layout reads as "same content".
2. **P2-07 denominator (WO-006)**: the sidecar's opacity walker reads the main content root (`main`, `[role=main]`, else body), skips script / style / noscript / template text and `display:none` / `visibility:hidden` subtrees, and returns `mainWords` (all words it read) next to `opacityZeroWords` (those under an `opacity:0` ancestor). The check divides by `mainWords` when present; the hidden count cannot exceed it.
3. **P3-04 by content (WO-005)**: a page canonical to another URL is a canonicalised duplicate (no canonical finding) when the target is crawled, 200, self-canonical and has the same main text (MinHash ≥ 0.9, else equal text), or when the URLs differ only in encoding (`%20` / `+`). Page 2 canonical to page 1 has different text and stays a finding. Internal links to a canonicalised duplicate join "Internal links use a non-canonical URL form".
4. **No sitemap (WO-013)**: P3-12 "No XML sitemap" (S3) with the fetched statuses as evidence; the robots `Sitemap:` part of P3-19 runs regardless; the one-inlink rule uses the crawl link graph; P3-13 / P3-17 N/A point at the finding.

Contracts 1.11.0 (additive): K3 request `abortUrls`, response `mainWords`, aborted `robots`; `RenderData.js.mainWords` and `js.robotsBlocked`. Sidecar 1.3.0; both sidecars rebuilt.

## Alternatives

- Platform allow-list for Shopify / Squarespace blocked paths: rejected (Ken's rule: measure the effect; a list goes stale and hides a real block on a custom theme).
- Canonical rule by parameter name (`?page=1` ok): rejected; §10 requires page 2+ self-canonical, and a name rule cannot tell page 1 from page 2 on every platform.
- Fetching an uncrawled canonical target inside the check: checks do not fetch; an uncrawled target keeps the finding unless the URLs differ only in encoding.
