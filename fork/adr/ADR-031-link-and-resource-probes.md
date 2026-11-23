# ADR-031: Link and resource probes (B15 #2–#4)

- Status: accepted
- Date: 2026-11-21 · Batch: B15 · Spec: `fork/ACCURACY.md` · `fork/DEPENDABILITY.md` §9 #2–#4

## Context

- P3-08 judges only links between crawled pages; un-crawled internal targets (salonvata `?page_id=…`) are skipped.
- No rule checks `<img>` / CSS / JS URLs; a broken logo on 64 pages goes unreported.
- P5-13 treats every non-200 outbound answer (bot blocks, redirects) as broken.

## Decision

1. One probe helper (`collectors/probe.ts`, moved out of `outbound.ts`): HEAD, confirmed by GET when HEAD fails or answers ≥ 400 (Google Maps JS answers HEAD 404), one retry after 2 s on 429 / 502 / 503 / 504, a 403 retried with a browser user-agent (`browserRetest`). `null` = no HTTP answer.
2. Collector `linkTargets` (crawl stage, after `pages`): internal targets of `<a href>` not fetched by the crawl, most-linked first, cap 200, own-site `ctx.fetch` at 1 request / s (parallel probes drew 429s on salonvata). P3-08 reads them with the crawled ones; one finding, rows grouped by final URL.
3. Collector `resources`: unique `<img src>`, stylesheet `<link href>`, `<script src>` URLs on read pages, cap 300 (most pages first); own host `ctx.fetch`, other hosts `ctx.fetchOffsite`; 1 request / s per host; 4 workers. New SUPP-20 (deterministic, S2): broken = no answer, 404, 410 or 5xx after the browser retest; a 403 that a browser gets as 2xx is not broken. One finding per broken URL, with page count.
4. P5-13 classes: dead = no answer, 404, 410 → finding. Redirects → one separate S4 "(info)" finding (the golden audits why F29 and ryan S01 expect P5-13 for redirecting outbound links; §9 #4 calls them info — kept visible at the lowest severity, flagged to Ken). Bot-only blocks and any other status → pass note, never a finding.
5. Caps reached → logged and stated in the pass / finding text (found vs probed).
6. Contracts 1.9.0: additive collector keys `linkTargets`, `resources`, type `LinkProbe`. Sidecars rebuilt for the version check.

## Consequences

- More requests per run (≤ 500 extra); bounded by the caps and host pacing.
- §9 #0 report table (WO-B15-000) not in this ADR; it adds its own field later.
- SUPP-20 is "Additional findings" (not scored), like every SUPP rule.

## Alternatives

- Probing inside the checks: rejected, checks are pure (K5).
- A resource finding per page: rejected (§9 "one finding with page count").

## Amendment (B19 WO-B19-007, 2026-11-23)

SUPP-20 emits one finding per resource kind (images, stylesheets, scripts), not one per broken URL: each URL is a detail line with its page count, largest first, and keeps its own status evidence. aircorheatingcooling.com had 22 broken images spread over 4 Fix-list rows; grouping rule #5 (one finding per rule, detail rows per instance) applies here too.

## Amendment (B19 run 90, 2026-11-23)

P5-13 dead also covers a 5xx other than 503 that survives the probe's retry (§1: 502 / 504 are retried once after 2 s), the same rule SUPP-20 uses for resources. wsparkdental.com links a localmed.com booking widget from 16 pages; it answered 502 to the run, to Semrush ("Broken external links") and to a re-fetch the same day, and the app listed it as info only. 503 stays info (bot walls and rate limits answer 503).
