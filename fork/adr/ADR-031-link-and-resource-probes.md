# ADR-031: Link and resource probes (B15 #2–#4)

- Status: accepted
- Date: 2026-11-21 · Batch: B15 · Spec: `fork/ACCURACY.md` · `fork/DEPENDABILITY.md` §9 #2–#4

## Context

- P3-08 judges only links between crawled pages; un-crawled internal targets (salonvata `?page_id=…`) are skipped.
- No rule checks `<img>` / CSS / JS URLs; a broken logo on 64 pages goes unreported.
- P5-13 treats every non-200 outbound answer (bot blocks, redirects) as broken.

## Decision

1. One probe helper (`collectors/probe.ts`, moved out of `outbound.ts`): HEAD → GET on 405 / 501 / failure, one retry after 2 s on 429 / 502 / 503 / 504, a 403 retried with a browser user-agent (`browserRetest`). `null` = no HTTP answer.
2. Collector `linkTargets` (crawl stage, after `pages`): internal targets of `<a href>` not fetched by the crawl, most-linked first, cap 200, own-site `ctx.fetch` (its pacing). P3-08 reads them with the crawled ones; one finding, rows grouped by final URL.
3. Collector `resources`: unique `<img src>`, stylesheet `<link href>`, `<script src>` URLs on read pages, cap 300 (most pages first); own host `ctx.fetch`, other hosts `ctx.fetchOffsite` at 1 request / s / host; 4 workers. New SUPP-20 (deterministic, S2): broken = no answer, 404, 410 or 5xx after the browser retest; a 403 that a browser gets as 2xx is not broken. One finding per broken URL, with page count.
4. P5-13 classes: dead = no answer, 404, 410 → finding. Redirects, bot-only blocks and any other status → pass note (info), never a finding.
5. Caps reached → logged and stated in the pass / finding text (found vs probed).
6. Contracts 1.9.0: additive collector keys `linkTargets`, `resources`, type `LinkProbe`. Sidecars rebuilt for the version check.

## Consequences

- More requests per run (≤ 500 extra); bounded by the caps and host pacing.
- §9 #0 report table (WO-B15-000) not in this ADR; it adds its own field later.
- SUPP-20 is "Additional findings" (not scored), like every SUPP rule.

## Alternatives

- Probing inside the checks: rejected, checks are pure (K5).
- A resource finding per page: rejected (§9 "one finding with page count").
