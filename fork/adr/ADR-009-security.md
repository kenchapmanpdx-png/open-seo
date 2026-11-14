# ADR-009: Security model

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- Review invariants: tenant scoping, untrusted outbound URLs (`normalizeAndValidateStartUrl`, `isCrawlableUrl`, manual redirects), safe external links in UI.
- `publicFetch` is plain `fetch` on Workers (strictly-public flag) and goes through a DNS-pinning gateway only when `CRAWL_GATEWAY_URL` is set. Local wrangler/workerd dev does not enforce the strictly-public flag the same way, so private-range protection locally depends on `isCrawlableUrl` (literal IPs + internal hostnames) and start-URL DNS checks.
- Supabase hardening already applied (`fork/scripts/supabase-harden.sql`; 57 tables RLS, 0 anon grants).

## Decision

- Outbound: every handbook fetch target passes `isCrawlableUrl`; the run's origin passed `normalizeAndValidateStartUrl` (DNS) at project/audit start; collectors re-run the DNS check once per distinct host they touch (apex/www sibling) before fetching; redirects manual, each hop re-validated, max 10 hops; bodies capped (`MAX_HTML_BYTES`).
- Scope: fetches only to the project host and its apex/www sibling, plus the fixed AI-bot vendor IP list URLs (§18) — no third-party page fetches except source-check fetches in B3 (separate allow decision then).
- Bot UAs: only against project hosts; ≤ 1 request/second per bot; logged with run id.
- Sidecar: listens on 127.0.0.1 only; bearer token; validates URL scheme + non-private DNS itself; Chromium launched with `--disable-dev-shm-usage`, no file:// access, downloads disabled.
- LLM: fixed prompts, page text as data, no tool use, Zod output, quote verification (ADR-007).
- Secrets: env only; never logged; evidence never contains request headers we send.
- UI: every URL from crawl/evidence rendered through `ExternalUrlCell` / `SafeExternalLink`.
- Tenant: server functions use `requireProjectContext`; MCP tools use `withMcpProjectAuth`; repositories filter by `project_id` via `handbook_run`.
- Public surface: Vercel report snapshots only (B4): unguessable id, `noindex`, excerpts only.

## Alternatives

| Option                                     | Why not                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Run local through upstream's crawl gateway | Docker standalone only; adds a process for a single-user localhost app; revisit if the app is ever exposed. |

## Consequences

- R4 collectors must use one shared `safeFetch` helper (wraps `publicFetch` + validation + manual redirects) — the single SSRF seam for the fork.

## Verification

- Unit tests: private IP literals, `localhost`, `metadata.google.internal`, redirect to private target, non-http scheme → refused. B5 security review.
