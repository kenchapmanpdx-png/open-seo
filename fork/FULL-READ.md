# FULL-READ — read every page, measure every template · v1 · 2026-11-16

Source of truth for B8–B10. Overrides sampling defaults in BLUEPRINT §3.3 where they conflict. Decisions marked [Ken] are operator instructions; do not revisit.

## 0. Goal

- Catch everything an agent-run handbook audit (`fork/fixtures/audits/*`) catches, at app cost and repeatability.
- Principle: **read every page; measure performance per template; escalate when anything looks off.**
- [Ken] No truth / legal / external-source verification of site statements. Internal consistency across the site's own pages stays (it is what AI answers quote).

## 1. Current gaps (measured 2026-11-16, ken/main 5089808)

| Area               | Now                                                                | Effect                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page cap           | in-app 200 (`HandbookService` DEFAULT_MAX_PAGES), CLI 60           | Larger sites partly read                                                                                                                                                |
| Crawl frontier     | raw-HTML links + sitemap + upstream seeds                          | JS-only links never discovered                                                                                                                                          |
| Render / axe       | 1 page per template, max 16 (`sidecar-collectors` MAX_SAMPLES)     | Per-page render defects missed (counters, opacity-0, forms)                                                                                                             |
| Lighthouse         | home + 2 samples                                                   | Slow templates missed                                                                                                                                                   |
| Page weight        | Lighthouse URLs only                                               | Multi-MB pages missed                                                                                                                                                   |
| Headers by value   | 40 URLs, second fetch                                              | Per-path header rules missed; double fetching                                                                                                                           |
| Bot parity         | 8 URLs × bots; Cloudflare-only challenge markers                   | Non-Cloudflare interstitials (openresty / Imunify360 / Sucuri…) and intermittent challenges missed (bluetreefunding F01)                                                |
| .md mirrors        | first 5 pages                                                      | Partial                                                                                                                                                                 |
| Outbound links     | per check                                                          | Partial                                                                                                                                                                 |
| LLM checks         | first 8 sampled pages (`SAMPLE_PAGES`), text clipped 2.5–6 k chars | Site-level conflicts, name variants, thin pages, awards, leftovers outside the sample missed (golden misses: why F08 F10 F14 F15 F16 F19 F30; ryan F02 F11 F12 F14 A06) |
| Non-§41 defects    | not checked                                                        | ryan F17 generic anchors; bluetree F17 duplicate text, F20 internal `_blank`, F11 counters, sensitive forms indexable                                                   |
| P5-03 source check | fetches off-site sources                                           | Conflicts with [Ken] rule                                                                                                                                               |
| In-app run         | one workflow step, 30-min timeout, retries 1                       | Large sites time out; no resume                                                                                                                                         |
| Concurrency        | 3 first audits at once exhausted the Supabase session pool (15)    | Runs fail / orphan at 0 pages                                                                                                                                           |

## 2. Depth model

| Depth            | Use             | Raw HTML        | Render JS-on       | Render JS-off                                                             | Axe                | Lighthouse                                                                 | LLM                                              |
| ---------------- | --------------- | --------------- | ------------------ | ------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `full` (default) | every audit     | all pages ≤ cap | all 200 HTML pages | 1 per template; all pages of a template where hidden-without-JS words > 0 | all rendered pages | rank-1 of every template (cap 15) mobile + home desktop + 3 heaviest pages | map every page, reduce site-wide, judge targeted |
| `quick`          | spot checks, CI | as today        | as today           | —                                                                         | as today           | as today                                                                   | as today                                         |

- Env / CLI: `HANDBOOK_DEPTH` = `full` or `quick`; CLI `--depth`. Report header states depth; grades compare only within the same depth (EP-7).
- Lighthouse scope: `HANDBOOK_LIGHTHOUSE` = `templates` (default) or `all` (every 200 HTML page, ~30 s each). Performance is template-driven, so `templates` + escalations is the efficient default; `all` is for one-off deep dives. In `all` mode: Lighthouse runs in batches of 25 (one `pgStep` each), mobile only (desktop = home), run cap rises by 0.6 min per Lighthouse page, and CLI + UI show the time estimate before start. Every page still gets server time (`ttfbMs`) and page weight (`transferBytes`) in both modes.
- Cap `HANDBOOK_MAX_PAGES` default 1000 (app + CLI). Over cap: stratified fill (every template, then round-robin per template); coverage line "read N of M discovered"; grade flagged `partial coverage` if N/M < 0.9.
- Infinite-space guard: after 300 pages, ≤ 100 pages per template; query-string URLs deduped to their canonical; calendar/facet patterns (`?page=`, `/page/N/`, date paths) capped at 20 each.

## 3. Collection (deterministic)

1. **Crawl** = sitemap(s) ∪ raw links ∪ upstream seeds ∪ **render-discovered links** (second pass: links found only in rendered DOM are queued; report "JS-only links: N"). Obey robots for `OpenSEO-Handbook`; honor `Crawl-delay`; 300 ms politeness kept.
2. **PageSnapshot** keeps response headers + `ttfbMs` (K2 minor) → headers-by-value and server timing for every page with zero extra fetches; separate probe only for assets by type (CSS, JS, image, font, 404, plain HTTP).
3. **Render** (sidecar K3 1.2.0): per request `transferBytes`, `aborted`, `protocol` (Resource Timing `nextHopProtocol`, for HTTP/1.1 detection); page weight per page; `firstScreenActions` + `opacityZeroWords` are returned for every rendered page (first-screen CTA per page at no extra cost); concurrency 3 (`HANDBOOK_RENDER_CONCURRENCY`).
   - `blockBeacons: true` default: analytics / ad / pixel requests are recorded then aborted, so detection (P7-04) works without polluting the client's analytics from the audit IP.
   - Never submit forms; only scroll.
   - Screenshots: first-screen mobile for every template rank-1 + home + contact + hub pages.
4. **Numeric parity**: per page, numbers in visible raw text vs rendered text (counters shipping `0`/`$0`/`0%`) → finding with both values (bluetree F11 class).
5. **Duplicate content**: MinHash/LSH on 5-word shingles across all pages → clusters with Jaccard ≥ 0.8; boilerplate-sentence ratio per page; duplicate text blocks inside one page.
6. **Outbound links**: every unique external URL (cap 500) HEAD→GET with browser UA, 1 retry; Googlebot UA only for non-2xx.
7. **Images**: every image request from render with bytes + display size → originals above threshold (P2-05).
8. **Interstitial / challenge detector** (all responses, all UAs): vendor signatures (Cloudflare, openresty "One moment, please", Imunify360/WebShield, Sucuri, Akamai, Incapsula, DataDome, PerimeterX/HUMAN, AWS WAF) + generic rule (≤ 40 words AND (`location.reload` | meta refresh | JS challenge) AND no canonical) + identical small body hash on ≥ 3 distinct URLs.
9. **AI-bot policy map**: home × every known AI/search UA token (≈ 23: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot, Applebot, Applebot-Extended, Amazonbot, CCBot, Bytespider, meta-externalagent, DuckAssistBot, MistralAI-User, cohere-ai, …) vs robots.txt groups → stated policy vs served policy (bluetree F27 class).
10. **Field data** (optional): CrUX API per origin + top templates when `CRUX_API_KEY` is set (free Google Cloud key, CrUX API enabled); else P7-10 BLOCKED-KEN.
11. **Boilerplate split**: text shared by ≥ 80 % of a template's pages = template boilerplate, stored once per template; page-unique text stored per page (feeds §5 map efficiently).

## 4. Escalation rules (the "investigator")

| Trigger                                                                                             | Escalation                                                                                                                                                                      | Cap / safety                                                       |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Interstitial or block (403/429/503/challenge) on any probe, or bot body hash ≠ browser on any probe | Bot parity on **all pages** (≤ 200; stratified above) × {Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, ClaudeBot}, repeated ×2 (intermittency); plain-HTTP probe on 10 URLs | Stop a UA after 5 consecutive blocks; never more than 1 req/300 ms |
| Template JS-off hidden words > 0 on its rank-1 page                                                 | JS-off render all pages of that template                                                                                                                                        | —                                                                  |
| Raw vs render word gap > 20 % on any page                                                           | Render diff stored for every page of that template                                                                                                                              | —                                                                  |
| llms.txt or any `.md` mirror present                                                                | Probe mirrors for all pages                                                                                                                                                     | cap 200                                                            |
| Any LCP > 4 s on a template                                                                         | Lighthouse on 2 more pages of that template                                                                                                                                     | cap +10                                                            |
| Any page weight > 5 MB                                                                              | Lighthouse on that page                                                                                                                                                         | cap +5                                                             |
| Sensitive form fields (SSN, DOB, bank, card) on an indexable page                                   | Finding (SUPP) + list every such URL                                                                                                                                            | —                                                                  |

- Escalations log to the report ("Escalated: … because …").

## 5. LLM: map → reduce → judge

1. **Map** (every HTML 200 page, once; plus one call per template for its boilerplate, §3.11): `HANDBOOK_LLM_EXTRACT_MODEL` (default `claude-haiku-5-5`; fallback Sonnet if extraction eval < 90 %). Input = head lines + page-unique text (raw, plus rendered-only text marked), chunked at 24 k chars. Output = `PageProfile` (K14): pageType, topic (≤ 12 words), brand/person/place name spans, stats `{subject, value, unit, quote}`, prices/terms, superlatives, awards (text | image alt; hasYear; hasSource), placeholders/template leftovers, undefined acronyms, FAQ questions, freshness/date strings, ctaFirstScreen, keyFactsBlock, contact data. Extraction only, no verdicts. Every quote verified verbatim against the page text; unverifiable quotes dropped and counted.
2. **Cache** `handbook_page_profile` keyed (normalized url, sha256(main text), promptVersion, model) → unchanged pages cost $0 on reruns.
3. **Reduce** (deterministic, `SiteFactMap` K15): stat conflicts by normalized subject across pages + llms.txt + JSON-LD; name-variant clusters; superlative / placeholder / acronym inventories; FAQ duplication; thin-page list (words + keyFactsBlock); service-coverage map (hub → children).
4. **Judge** (K5, Sonnet): existing LLM items receive targeted views built from the fact map (candidate pages + counter-examples), not the first 8 pages. Site-wide head-line items (P4-02, P4-07) receive **all** pages' head lines in one call.
5. **P5-03** off-site source fetch → off by default (`HANDBOOK_SOURCE_CHECK=off`); item status `N/A (operator: no external verification)`; excluded from score. "Claim with no on-page source" stays a P5-04 content finding (on-page signal, not truth).
6. **Budget**: auto = $0.50 + $0.01 × pages, cap $5 (`HANDBOOK_LLM_BUDGET_USD` overrides); map ≤ 60 %, judge ≥ 40 %. Exhaustion / credit error → remaining items BLOCKED `llm budget` (never silent). Concurrency 4; backoff on 429/529/5xx ×3.
7. **Stability**: confidence < 0.7 → second judge call; disagreement → `unsure` (BLOCKED-REVIEW, shown, not scored).

## 6. Supplementary rules (SUPP)

- Registry extension `registry-supp.ts`: id `SUPP-nn`, handbook § refs, class, severityDefault, evidence. Reported in "Additional findings"; **not scored** (EP-7 grade stays §41-only and comparable).
- Initial set (from golden misses + bluetree audit):
  | id | Rule | § |
  |---|---|---|
  | SUPP-01 | Generic anchors ("Read more", "Click here", "Learn more") on internal links | §12 |
  | SUPP-02 | Internal links with `target=_blank` | §12 |
  | SUPP-03 | Duplicate text blocks inside one page (raw HTML) | §14 |
  | SUPP-04 | Counters / numbers wrong in raw HTML vs rendered | §6, §14 |
  | SUPP-05 | Sensitive-data form on an indexable URL | §30 |
  | SUPP-06 | Test / dev / numbered-slug pages in sitemap or index (`-dev`, `test`, `-2`, `copy`, `\d$`) | §10, §17 |
  | SUPP-07 | Empty social meta (`content=""`) | §2 |
  | SUPP-08 | Bot-check / interstitial page returned as HTTP 200 content | §18 |
- "Outside scope — noted" (informational, never scored): SPF/DMARC (DNS TXT via DNS-over-HTTPS), public author/user archive URLs, generator meta. No form submission, no login attempts, no vulnerability probing.

## 7. Runtime

1. **Staged run**: `crawl → render(batches of 25) → axe → lighthouse(batches of 25) → map(batches of 20) → reduce → checks → report`; each stage a separate `pgStep` in `workflow/hook.ts` (fork file), idempotent by `runId + stage + batch`, state in `handbook_run_stage`. Step timeout 30 min each; whole-run cap `HANDBOOK_RUN_MAX_MINUTES` (default 90) → stop cleanly with partial coverage.
2. **Memory**: bodies streamed to the evidence store; stages reload facts from DB; no stage holds > 1 batch of bodies.
3. **Run queue**: one handbook run per machine at a time (DB lease row, 2-h expiry); others wait `queued`; CLI runs that write to Supabase take the same lease. Postgres pool max 5 per process.
4. **Storage**: gzip bodies; full bodies kept for the last 2 runs per project, older runs keep excerpts + findings; warn at 80 % of Supabase Storage quota.
5. **Progress UI**: run page shows stage, pages done/total, escalations, LLM spend.
6. **CLI parity**: `handbook-audit.ts --depth full` uses the same stages in-process.

## 8. Contingencies

| Case                                                         | Behavior                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidecar down                                                 | Render/axe/Lighthouse items BLOCKED `sidecar unavailable`; raw-only checks run; report says so                                                                                                                                                                              |
| Anthropic credits out / 402                                  | LLM items BLOCKED `llm credits`; run completes                                                                                                                                                                                                                              |
| Site blocks the auditor (WAF)                                | Detector fires → finding + stop that UA; crawl continues with browser UA; coverage reported                                                                                                                                                                                 |
| robots disallows our UA                                      | Obey; BLOCKED `robots` per URL; owner can allow `OpenSEO-Handbook`                                                                                                                                                                                                          |
| SPA (no raw links)                                           | Render-discovered links feed the crawl; raw-vs-render findings explain                                                                                                                                                                                                      |
| > cap pages                                                  | Stratified, coverage line, `partial coverage` flag                                                                                                                                                                                                                          |
| Pagination / facets / calendars                              | Per-pattern caps (§2)                                                                                                                                                                                                                                                       |
| Login / paywall                                              | Not crawled; listed                                                                                                                                                                                                                                                         |
| PDFs / non-HTML                                              | Listed with status + size; not read                                                                                                                                                                                                                                         |
| Multilingual                                                 | All locales within cap; templates per locale                                                                                                                                                                                                                                |
| Huge page (> 100 k chars)                                    | Chunked map; truncation noted in evidence                                                                                                                                                                                                                                   |
| Upstream crawl seeds capped                                  | Fork crawl follows links + sitemaps itself (`followLinks: true` in-app)                                                                                                                                                                                                     |
| Intermittent failures                                        | One retry per URL; transient flagged in evidence                                                                                                                                                                                                                            |
| Supabase free-tier limits (pool 15, DB 500 MB, Storage 1 GB) | Queue + pool cap + retention + warnings                                                                                                                                                                                                                                     |
| Secrets needed in the agent shell                            | Never source `.env.local` in the agent shell. Use scripts that read their own config (`handbook-audit.ts` loads `.env.local` itself; `run-local.sh`). Sidecar is started by Ken before launch. Any step that still needs secrets in the shell → BLOCKED-KEN, rest continues |
| New npm dependency needed                                    | Prefer in-repo implementation (MinHash, DoH); `pnpm add` was refused in B6 → only if allow-listed, else ESCALATE                                                                                                                                                            |
| P5-03 N/A vs goldens that scored it                          | Golden grade comparison recomputes the golden total with P5-03 = N/A                                                                                                                                                                                                        |

## 9. Acceptance (B10 exit gate)

| Metric                                                                                                                                             | Target                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Goldens why, ryan, bluetree, over findings with `detectableBy` ∈ {deterministic, render, llm} (site-changed and [Ken] truth-verification excluded) | caught ≥ 85 % and caught + partial ≥ 95 %, each site                            |
| BadGEO                                                                                                                                             | 0 missing · 0 unexpected (new pages for every new check, SUPP rule, escalation) |
| Judge eval (K5)                                                                                                                                    | recall ≥ 80 % · false fails 0 (why-F19 case rebuilt with llms.txt + site pages) |
| Extraction eval (new)                                                                                                                              | ≥ 90 % of golden quotes present in profiles                                     |
| Speed                                                                                                                                              | ≤ 100-page site, `full`: ≤ 20 min wall time                                     |
| Cost                                                                                                                                               | ≤ 100-page site: ≤ $1.50 LLM; unchanged rerun ≤ 10 % of first run               |
| Scale                                                                                                                                              | 1000-page synthetic site completes, no OOM, within run cap                      |
| Repeatability (EP-7)                                                                                                                               | two `full` runs, same site, grade Δ ≤ 2                                         |
| Session-end checks                                                                                                                                 | green vs `fork/BASELINE.md`                                                     |
