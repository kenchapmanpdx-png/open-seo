# ADR-004: Collectors and render sidecar contract (K2, K3)

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- Upstream has: `discoverUrls` / `parseRobotsTxt` (`src/server/lib/audit/discovery.ts`, Allow/Disallow for one UA), `crawlPage` (`src/server/workflows/site-audit-workflow-helpers.ts`), `createCrawlThrottle`, `publicFetch` (`src/server/lib/public-fetch.ts`; DNS-pinning gateway when `CRAWL_GATEWAY_URL` is set), `isCrawlableUrl` / `normalizeAndValidateStartUrl` (`src/server/lib/audit/url-policy.ts`).
- Upstream rendering (`src/server/lib/audit/rendered-page.ts`) tries Cloudflare Browser Run, then Context.dev `GET https://api.context.dev/v1/web/scrape/html?url=…` returning `{ success, type: "html", html, metadata: { finalUrl }, finalDOMState: "loaded" }`. Neither is available locally without paid keys.
- Upstream gap (`fork/fixtures/upstream-gap.md`): no robots per-group evaluation, no header-by-value, no URL variants, no bot parity, no JSON-LD parse, no raw-vs-render.

## Decision

- K2 collectors run once per run, in dependency order, each producing a typed keyed output in `HandbookContext.collected`:
  `pages` (raw snapshots of crawled URLs) · `robots` (per-host body + parsed groups + per-bot decisions via a full RFC 9309 group evaluator, not upstream's single-UA parser) · `sitemap` (index + children, URL set, lastmod) · `llms` (`/llms.txt`, `/llms-full.txt`, `.md` mirrors of key pages) · `headers` (home + one URL per template, all response headers by value) · `variants` (apex/www × http/https, trailing slash, `index.html`, random unknown path → status + redirect chain) · `botFetch` (6 bots × key routes: status, bytes, body sha256, word count) · `jsonld` (per page: blocks, parse errors, flattened graph with `@id`/`@type`) · `templates` (ADR-006) · `render` · `axe` · `lighthouse` (sidecar, samples only).
- A collector that cannot run sets `{ status: "unavailable", reason }`; checks needing it return BLOCKED or LIMITED (ADR-005), never PASS.
- All collector fetches: same-origin only (plus apex/www sibling of the project host), `isCrawlableUrl` on every URL, manual redirects re-validated per hop, `publicFetch`, throttle shared with the run. Bot UAs only against the project's own hosts.
- K3 sidecar (`fork/sidecar/`, Node + Playwright + Chromium + axe-core + Lighthouse CLI, Docker, bound to 127.0.0.1): `GET /health`, `POST /render` (`{ url, javascript: bool, viewport: mobile|desktop, screenshot: none|firstScreen|fullPage, scrollToEnd }` → `{ finalUrl, status, html, screenshotPng?, consoleErrors, timingMs }`), `POST /axe` (`{ url, scrollToEnd: true }` → violations), `POST /lighthouse` (`{ url, formFactor }` → categories + LCP/CLS/TBT + LCP element). Plus `GET /v1/web/scrape/html` with Context.dev's query/response shape, so upstream rendering can point at the sidecar instead of `api.context.dev` (wiring is a later, separately logged edit).
- Sidecar auth: shared bearer token `HANDBOOK_SIDECAR_TOKEN`; sidecar itself re-checks targets (no private ranges, http/https only).

## Alternatives

| Option                                    | Why not                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Extend upstream `parseRobotsTxt`          | Upstream file edit; its contract (one UA, Allow/Disallow) serves the crawler and must not change behavior. |
| Render via Cloudflare Browser Run locally | Not available outside Cloudflare; paid.                                                                    |
| Lighthouse through DataForSEO (upstream)  | Paid per call; no axe after scroll, no no-JS render. Upstream Lighthouse stays for upstream UI.            |

## Consequences

- Without the sidecar (Docker not running, or Cloudflare deploy) RENDER/PERF/A11Y items become LIMITED with reason `sidecar unavailable`.
- Contract file: `src/server/features/handbook/contracts/collectors.ts` (K2), `fork/sidecar/openapi.yaml` (K3).

## Verification

- BadGEO pages per collector (robots groups, header values, variants, JSON-LD errors); sidecar contract test against `openapi.yaml` in B2.
