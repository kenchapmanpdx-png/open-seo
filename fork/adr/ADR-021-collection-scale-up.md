# ADR-021: Collection scale-up

- Status: accepted (extends ADR-004)
- Date: 2026-11-18 · Batch: B8 (R1)

## Context

- Spec: `fork/FULL-READ.md` §3 (collection), §4 (escalations), §6 (SUPP-04, SUPP-07), §8 (no new npm dependency unless allow-listed).
- Today: crawl = raw links + sitemap + upstream seeds (`collectors/site-crawl.ts`); headers by value = 40 URLs on a second fetch (`collectors/fetch-collectors.ts`); render / axe 1 per template max 16, Lighthouse home + 2 (`collectors/sidecar-collectors.ts`); bot parity 8 URLs with Cloudflare-only challenge markers; `.md` mirrors first 5 pages; sidecar K3 1.1.0 (`fork/sidecar/`, `contracts/sidecar.ts`).
- Measured B8 R1: render ≈ 2.3 s median per page (JS on, scroll), throughput 27 / 52 / 54 renders/min at client concurrency 1 / 2 / 3 with sidecar `MAX_RENDERS = 2`; axe ≈ 2.6 s per page; Lighthouse ≈ 9 s per page. Headers collector on bluetree 23.7 s and bot fetch 27.9 s for 41 pages — both re-fetch pages the crawl already fetched.

## Decision

- Headers in `PageSnapshot` (K2): crawl stores response `headers` (lower-cased, `set-cookie` values dropped, each value ≤ 2 kB) and `ttfbMs` per page. The headers collector reads them — zero extra page fetches — and keeps a separate probe only for asset types (CSS, JS, image, font, a 404 URL, plain HTTP).
- Render-discovered links: after the render stage, links present only in rendered DOM (same host, crawlable) are queued as a second crawl pass with `discoveredBy: render`; report "JS-only links: N". `discoveredBy: raw | sitemap | seed | render` on every page.
- Render all pages (`full`): client-side concurrency via `HANDBOOK_RENDER_CONCURRENCY` (default 3) against `/render`; no batch endpoint. Sidecar `MAX_RENDERS` env-configurable (default 3). K3 1.2.0 adds per request `transferBytes`, `aborted`, `protocol` (Resource Timing `nextHopProtocol`), request flag `blockBeacons` (default true: analytics / ad / pixel hosts from a fixed in-repo list → recorded then aborted), media requests recorded + aborted (never downloaded), per `<video>` / video iframe: first-screen flag + reserved-size flag. Page weight = Σ transferBytes + declared size of media that starts loading with the page.
- Beacon blocking list: in-repo list of known analytics / tag / pixel hosts and path patterns (GA4 `collect`, GTM, Meta pixel, LinkedIn insight, Hotjar, Clarity, TikTok, Segment, etc.). P7-04 detection reads the recorded (aborted) requests, so detection is unchanged.
- Interstitial / challenge detector (all responses, all UAs): vendor signature table (Cloudflare, openresty "One moment, please", Imunify360 / WebShield, Sucuri, Akamai, Incapsula, DataDome, PerimeterX / HUMAN, AWS WAF) + generic rule (≤ 40 words AND (`location.reload` | meta refresh | JS challenge) AND no canonical) + identical small-body hash on ≥ 3 distinct URLs. Output feeds SUPP-07 and the bot-parity escalation.
- Escalation table: exactly FULL-READ §4, implemented as data (trigger predicate → action → cap) in one fork module; every fired escalation is appended to the run's escalation log (`{trigger, because, action, urls, capped}`) and printed in the report ("Escalated: … because …"). Safety: a UA stops after 5 consecutive blocks; ≥ 300 ms between requests to the site across all escalations.
- Numeric parity (SUPP-04): per page, numeric tokens in visible raw text vs rendered text; flag only where raw shows a zero-like placeholder (`0`, `$0`, `0%`, `0+`) and render shows a non-zero value at the same DOM text position (counter class), with both values as evidence.
- Duplicates: in-repo MinHash (128 permutations, 32-bit FNV-1a seeds) + LSH (32 bands × 4 rows) on 5-word shingles of main text; candidate pairs verified with exact Jaccard; clusters ≥ 0.8 → P3-12 unless pages canonicalize to one URL, are noindex, or redirect. Thin = indexable 200 page with < 50 main-content words → P3-12. Boilerplate-sentence ratio per page; duplicate blocks inside one page → SUPP-03. No npm dependency.
- Boilerplate split: text blocks shared by ≥ 80 % of a template's pages = template boilerplate, stored once per template; page-unique text stored per page (feeds ADR-019 map).
- Outbound links: every unique external URL (cap 500) HEAD → GET with browser UA, 1 retry; Googlebot UA only for non-2xx.
- Images: sizes from render requests (bytes + display size) → P2-05.
- `.md` mirrors: probe all pages (cap 200) when llms.txt or any mirror exists.
- AI-bot policy map: home × ≈ 23 UA tokens vs robots.txt groups → stated vs served (fork constant list).
- Video & embeds: FULL-READ §3.12 as written (HEAD per unique media URL cap 200, `Range: bytes=0-0` fallback, unknown → noted, no finding).
- CrUX: optional, `CRUX_API_KEY`; else P7-10 BLOCKED-KEN.

## Alternatives

| Option                           | Why not                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Sidecar `/render-batch` endpoint | Same throughput as client concurrency (measured near-linear up to the server cap); one more contract surface |
| Keep a second fetch for headers  | Doubles requests per page; bluetree spent 24 s on it for 41 pages                                            |
| npm MinHash / simhash library    | `pnpm add` refused in B6; ≈ 80 lines in-repo                                                                 |
| Let beacons fire                 | Pollutes the client's analytics from the audit IP on every rendered page                                     |
| Download media to measure size   | Bandwidth and time; `Content-Length` / `Content-Range` gives the number needed                               |

## Consequences

- Contracts 1.5.0 (R2): K2 `PageSnapshot.headers`, `ttfbMs`, `discoveredBy`, markup video fields + `embeds[]`, coverage; K3 1.2.0 fields + `blockBeacons`; escalation log type; `fork/sidecar/openapi.yaml`.
- Sidecar image rebuild (R2.3) → restart with `fork/scripts/start-build.sh --check` at B8 exit.
- Evidence store load grows with all-page rendering; gzip + retention (ADR-018 / WO-B9-023).

## Verification

- BadGEO page per new check / SUPP rule / escalation (0 missing, 0 unexpected).
- Unit tests: MinHash estimate within ± 0.05 of exact Jaccard on fixtures; interstitial detector on vendor fixtures and a normal short page (no false positive); numeric parity only on zero-like raw values.
- Sidecar unit tests (no live container): beacon abort, media abort, `transferBytes` present.
