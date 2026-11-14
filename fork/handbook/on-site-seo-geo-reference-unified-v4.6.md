# Unified On-Site SEO + GEO Reference (Generic, One-Pass Implementation, Extended)

Scope: actions performed on your own website in one implementation pass. Covers classic SEO + UX/CRO + Generative Engine Optimization (GEO/AEO). Includes Google Search Console + Bing Webmaster Tools + IndexNow setup. Excludes off-site authority building, backlink acquisition, PR.

For LLM consumption. Terse, structured, no filler.

Version: 4.6 · Last verified: 2026-11-14 · v4.6 = v4.5 + desk-review gap fill (2026-11-14): source check for quotes / studies / citations (§0 EP-1, §4–§6); keyword → URL map + cannibalization check (§1); page-type applicability, page blueprints and local-business pages (§7, §9, §24); per-engine facts + AI answer panel (§16, §27); key events, INP lab proxy, CSP rollout (§14, §27; P7, P8, P10 gates); §33 "Set up at launch"; connected `@graph` example (§24); Mistral + DuckDuckGo crawler rows (§18). v4.6 additions are desk-derived (no field test) unless tagged `[SPEC]`; they are listed as field-test targets in the archive file. Moved out of this file, verbatim: §34, §38, §40 and all earlier version notes → `on-site-seo-geo-reference-v4.6-archive.md` (not needed to implement). Decision record: `seo-geo-merge-decisions-2026-11-14-v4.6.md`. Claims no run verified carry `[UNVERIFIED as of <date>]`. Dated facts are as-of the date shown.

---

## How to use this document (implementing LLM — read first)

**Start here:** follow the **Execution Protocol** (end of §0). It sets mode, site tier, phase order, gates and tracking files. Do not tackle the handbook all at once.

**This is a reference, not a checklist.** Do not implement every section. Apply the Site Profile filter below to scope the work.

- **§1-30:** Conditional baseline. Apply only as filtered by Site Profile.
- **§32:** Reference card. Consult while implementing §1-30; do not implement as standalone work.
- **§33:** **Deferred menu.** Do NOT implement during initial build. Mark as future-state and revisit when the site has 6+ months of post-launch data, established baseline organic traffic, and bandwidth for non-baseline optimization. Exception: the §33 "Set up at launch" list (first subsection) is handled in P10.
- **§35–§40:** §35 Google Ranking Changes Log (attribution windows) · §36 Agentic Commerce Readiness (gated SP2=Y AND SP10=Y) · §37 Preferred Sources (gated: publisher) · §38 Retired Guidance (do NOT implement; text in the archive file) · §39 Watchlist (unproven — do NOT implement) · §40 Platform Change Timeline (reference only; archive file). §34 Coverage Confirmation (merge history) is in the archive file too.
- **§41:** Launch + Audit Checklist — every item tagged with phase (P0–P11) and tier/gate. Copied into `seo-geo-status.md` at P0; implement from the referenced sections.
- **External review (no repo, no owner access):** Execution Protocol EP-7 (REVIEW mode) — read-only audit, findings and grade.

If a section is gated to a Site Profile answer marked **N**, skip it silently. Do not add scaffolding "just in case." When a gate is ambiguous, mark it `?` and apply the UNKNOWN rule below the Site Profile table.

### Rules vs. heuristics (read before treating any line as binding)

Rules in §1-31 are stated tersely as imperatives for compactness. Most are conventions, not platform-enforced rules. §32 tags items by source type: `[SPEC]` = formal spec / Google official docs (treat as rule); `[STUDY]` = single-study finding (directional); `[HEURISTIC]` = industry convention (treat as default, override when context warrants); `[FIELD]` = defect found and fixed in live site builds/audits — practitioner evidence (single source, E3-equivalent); treat as default; combined tags (e.g. `[FIELD + SPEC]`) mean a platform doc also supports it.

- **Platform owner wins.** If a line in this doc conflicts with current Google Search Central docs, Bing Webmaster guidance, schema.org canonical docs, or recent public statements from John Mueller / Gary Illyes / Frédéric Dubut, the platform owner is authoritative. This doc loses.
- **Flag spec conflicts explicitly — do not pick silently.** When a doc rule conflicts with platform guidance, OR when fixing one rule breaks another, surface the trade-off before acting. Example: "doc says X; Google has publicly said Y; recommending Y." Example: "fixing canonical to comply with §10 would break the existing redirect chain set up under §11 — confirm which side to keep."
- **Don't contort architecture to satisfy a heuristic.** Examples of heuristics that should NOT drive structural rewrites: single-H1 convention, exact title character count, "click depth ≤ 3" target, "DOM depth <1,500 nodes." Useful defaults; not enforcement-grade.

### Site Profile (user fills in before handoff)

| # | Question | Y / N / ? |
|---|---|---|
| SP1 | Multi-locale (multiple languages, countries, or currencies)? | |
| SP2 | Ecommerce / product catalog with variants + availability tracking? | |
| SP3 | Faceted navigation (filterable listings — color/size/sort/price/etc.)? | |
| SP4 | Significant video content (>10 videos, or video-led pages)? | |
| SP5 | User-generated content (reviews, comments, forum, Q&A, user-created public or link-shared pages)? | |
| SP6 | YMYL category (health, medical, finance, legal, safety, supplements)? | |
| SP7 | Physical location(s) — local SEO relevant? | |
| SP8 | Large catalog (>500 indexable URLs)? | |
| SP9 | Internal search feature on site? | |
| SP10 | Sells via Google Merchant Center and/or wants agentic checkout (Google UCP, ChatGPT)? | |
| SP11 | EU-facing users AND (site runs an AI chat interface OR publishes AI-generated public-interest text/media)? | |
| SP12 | Site served through a bot-managed CDN (Cloudflare, Vercel/Fastly bot management, etc.)? | |

**UNKNOWN rule:** `?` = insufficient evidence. Absence from supplied facts ≠ N. Resolve `?` from repo, live site, host/CDN config first. Still `?` → decisions that depend on it are BLOCKED (queued in `seo-owner-todo.md`); keep existing behavior; build no scaffolding for it. Gates whose Y branch only adds an internal safeguard (SP6 pixel review) → apply as if Y. SP11 = `?` → inspect audience, AI features and content provenance first; disclose an AI chat interface that exists; never publish an AI-origin label for content whose provenance is unknown — queue that decision for the owner and block only that disclosure. Requested BUILD ≠ no legacy URLs: check whether the domain already serves a site or has GSC/index history before any destructive URL or content change.

### Build state

- [ ] Pre-launch (new site, no legacy URLs, no ranking history)
- [ ] Existing site (legacy URLs, prior rankings, possible redirect needs)

### Section Applicability

**Universal baseline — apply regardless of Site Profile:**
§1 keyword/intent · §2 page headers · §3 content structure · §4 writing patterns · §5 density/NLP · §6 content quality · §7 per-page required elements · §8 design/UX/conversion · §9 URL structure · §10 canonical tags + status codes (pre-launch: from "Redirect rules" apply only the one-hop + permanent-redirect rules for host, protocol and trailing-slash redirects; skip the rest) · §12 internal linking · §14 technical setup · §15 image rules (skip "Video on-page" subsection) · §16 featured snippets + PAA + AI Overviews + AI-feature controls decision (record Include/Exclude for the GSC "Search generative AI" control — default Include) · §17 crawlability validation · §18 robots.txt (citation-bot allowlist always; training-bot policy per user preference) · §19 XML sitemap · §23 non-working techniques (awareness only — do not implement) · §24 schemas: WebSite (home page), Organization, Article, BreadcrumbList, Person (FAQPage and other schema types conditional) · §25 entity engineering · §26 GSC + Bing + IndexNow setup · §27 core analytics stack + AI referral tracking · §28 freshness + error review + technical audits · §29 hard don'ts · §30 universal compliance (skip YMYL items unless SP6=Y; skip EU AI Act items unless SP11=Y) · §31 tools reference · §32 verified constants (reference only) · §35 ranking changes log (reference only).

Removed from universal baseline 2026-11-01: §20–22 llms.txt / llms-full.txt / .md mirrors (Google Search ignores them — see gate below) · §24 FAQPage (Google FAQ rich results retired 2026-05-07).

**Page-type scoping:** §3–§8 elements apply per the §7 Page-type applicability matrix. Rules written for articles (bylines, answer capsules, Key Takeaways, citation density, visible last-updated) are not added to home, service, product, hub, contact or legal pages unless the matrix marks them. [HEURISTIC]

**Conditional sections — apply only when gate is true:**

| Section / element | Gate |
|---|---|
| §11 Pagination subsection | Site has paginated listings (any size) OR SP8=Y |
| §11 Faceted navigation subsection | SP3=Y |
| §11 Internal search subsection | SP9=Y |
| §11 Infinite scroll subsection | SP8=Y AND site uses infinite scroll UX |
| §13 Hreflang + locale selector + soft geo + machine-readable geo | SP1=Y |
| §15 Video on-page subsection | SP4=Y |
| §24 Product schema (with availability) | SP2=Y |
| §24 LocalBusiness schema | SP7=Y |
| §24 VideoObject schema | SP4=Y OR any page pursuing video rich results |
| §24 HowTo schema | Site has how-to / step-by-step content |
| §24 Review schema | SP5=Y OR product reviews displayed on-site |
| §24 FAQPage schema | Visible Q&A block exists on the page AND no expectation of a Google rich result (retired 2026-05-07) |
| §24 Event schema | Site publishes publicly bookable events at physical locations |
| §7 Local business pages · §9 Local / service-business patterns | SP7=Y (URL patterns also for non-local service businesses) |
| §15 Hero / background video subsection | Site uses autoplay hero or background video |
| §10 Site migration + retired items subsections | Existing site being rebuilt/migrated, OR site retires events/products/services |
| §30 Consumer-health-data item | SP6=Y (health/condition pages) |
| §14 Legacy AMP note | Existing AMP implementation |
| §17 UGC indexing policy | SP5=Y |
| §18 CDN defaults subsection | SP12=Y |
| §20–22 llms.txt / llms-full.txt / .md mirrors | A named consumer documents reading them (none verified 2026-11-01). Not for Google. |
| §22 Same-URL Markdown content negotiation | SP12=Y (Cloudflare "Markdown for Agents") OR server implements `Accept: text/markdown` |
| §30 EU AI Act Art. 50 items | SP11=Y |
| §36 Agentic Commerce Readiness | SP2=Y AND SP10=Y, then per channel (§36 Channel gates): Merchant Center consistency when a feed exists; Google native/agentic checkout only when requested + eligibility confirmed; OpenAI feed only when that channel is selected |
| §37 Preferred Sources | Publisher (news/editorial) pursuing Preferred Sources |
| §27 AI segment event tagging + analytics-friendly IDs/classes | Defer until 6+ months post-launch (needs AI traffic baseline) |
| §27 AI answer panel | AUDIT / BUILD / MAINTAIN; owner-run; not a gate; never in REVIEW mode |
| §28 Iterative improvement (rank-based optimization) | Existing site (pre-launch has no rankings to optimize) |
| §28 Content pruning | Existing site only |
| §28 Product lifecycle rules | SP2=Y |
| §30 YMYL items (reviewer bylines, credentials, "Reviewed by") | SP6=Y |
| §33 Expert-Tier (all subsections except "Set up at launch") | **DEFERRED — do not implement in initial build** |
| §33 Set up at launch | Per-item gate (§33); handled in P10 (resource hints in P7) |

If the Site Profile is blank, infer it in Execution Protocol P0 (evidence + confidence per answer) and proceed. Ask only for low-confidence answers that gate an irreversible change. Unknown → `?` (UNKNOWN rule above). Tier (EP-3) narrows applicability further: an item applies only when its tier tag ≤ site tier AND its gate is true.

### Verification rules (apply to every change)

- **Verify against real tools, not just `curl` + `grep`.** Run every meaningful change through at least one of: third-party SEO checker (Screaming Frog, Sitechecker, Seobility, Ahrefs Site Audit), Google Rich Results Test (URL test mode — not paste), PageSpeed Insights, Lighthouse, or GSC URL Inspection "View Tested Page." Self-written parsers + counts are insufficient.
- ⚠ CONFLICT (field test 2026-11-13): the line above vs checkers that were wrong on presence checks (robots.txt, sitemap and canonical reported missing when present) and blind beyond one URL. Resolution: both are required. Direct fetch + own extraction decide presence, values and the sitewide inventory; third-party tools decide rendering, lab performance, accessibility and rich-result eligibility. Neither alone closes an item. [FIELD]
- **Checkers are evidence, not findings.** Reproduce every checker-flagged issue with a direct fetch of the live URL (status, headers, tag in raw HTML) before recording it. Log tool errors (§31 Checker triage). [FIELD]
- **Single-URL checkers test one page.** A home-page pass is not a sitewide pass: check every template, plus the §17 URL inventory. Read values, not presence — `Strict-Transport-Security: max-age=0`, `alt=""`, `content=""` and an `http://` share image all pass presence checks. [FIELD]
- **Lab environment.** Lighthouse outside PageSpeed Insights (local, CI, container): LCP and CLS are comparable; TBT, main-thread time and the performance score depend on host CPU (field test: TBT 3.5 s in a container vs 0.5–1.0 s in PageSpeed Insights, same page; LCP 36 s vs 38–45 s). Record the environment; never quote main-thread savings from a non-PSI run as fact. No CrUX data for the URL or origin → record "no field data"; that is a result, not BLOCKED. [FIELD]
- **Pre-launch / unreachable URLs.** URL-mode tools (Rich Results Test URL mode, PageSpeed Insights, URL Inspection) need a publicly reachable URL. Use a public preview deploy when one exists. Otherwise: Rich Results Test code mode on the full built HTML of the route (never a hand-pasted JSON fragment); Lighthouse CLI (mobile preset) on a local production build; mark the URL-mode re-test DEFERRED (trigger: P10 launch). [FIELD + HEURISTIC]
- **Protected preview.** Preserve preview/staging authentication (Vercel Authentication, basic auth, IP allowlist); never remove it to satisfy a gate. A 401/403 on a protected preview is intended behavior, not a production crawl defect. Verify built routes locally or through an authenticated browser/session (Mode 1/Mode 2 on the local production build). DEFER every anonymous public-origin check (anonymous + bot-UA fetch, URL-mode tools) to P10, run immediately after cutover: public routes must pass; private routes must stay authenticated. [HEURISTIC]
- **Dual-mode test mandatory.** Every assertion about element counts, content visibility, headings, or schema must hold in BOTH crawler modes (see §17 Dual-mode crawler test):
  - **Mode 1 (raw HTML):** `curl -A "GPTBot" URL` — what AI crawlers and the initial fetch see. Limit: a UA-spoofed fetch from a non-vendor IP does NOT reproduce CDN bot-management treatment (Cloudflare verifies bots by IP and blocks AI crawlers by default since 2025-07-01). Also check CDN AI-crawler settings and server/CDN logs for the real bot IPs (§18 CDN defaults). [SPEC]
  - **Mode 2 (rendered DOM):** PageSpeed Insights / GSC URL Inspection "View Tested Page" / headless Chrome — what Googlebot and third-party checkers see.
- **Before structural HTML changes** (heading levels, hiding content from users, schema affecting layout): snapshot before, apply change, snapshot after, diff. Count headings + links + schema blocks explicitly.
- **Hidden content: judge by purpose.** Google's hidden-text policy targets content placed "solely to manipulate search engines"; accordions/tabs, sliders, tooltips and screen-reader-only text that improves the screen-reader experience are not violations (spam policies, 2026-08-28). [SPEC] Never create search-only hidden content: no SEO copy or links in sr-only, off-screen, `opacity:0`, `display:none` or `<noscript>`-only blocks. AI crawlers read raw HTML only (§14): collapsible content must be in the initial HTML (`<details>`). Crawlable pagination = visible `<a href>` links (§11).
- **Original-HTML directives govern.** Never ship `noindex` in the original HTML expecting JavaScript to remove it; keep the canonical identical in original and rendered HTML; pages returning non-200 may not be rendered at all (Google 2025-12-15/17/18). [SPEC]

### Confirm before acting

Stop and ask the user before any of:
- Changing domain canonical (www vs apex, subdomain consolidation, HTTP→HTTPS).
- Filling in real business specifics not explicitly provided (hours, service area, price range, phone, social URLs, addresses).
- Removing or renaming assets (images, files, URLs) that could break inbound links.
- Adding new build/deploy dependencies, frameworks, or pipeline steps.
- Site-wide rewrites of visible body copy (typo + clarity fixes per page are fine without asking).
- Any change that touches more than ~5 templates at once.

### Definition of done

For every SEO/GEO change, before declaring it complete:
1. `curl -A "GPTBot" <URL>` returns the expected per-route title, meta, canonical, schema, headings, and primary content.
2. Browser load (headless screenshot or live visit) shows the expected visible content + DOM structure.
3. Page passes at least one third-party SEO checker on the changed dimension. A checker FAIL contradicted by a direct fetch is a tool error: record the evidence and proceed (Verification rules).
4. Schema: every JSON-LD block parses; Rich Results Test (URL mode; pre-launch see Verification rules) shows 0 errors for the Google features it supports; Schema Markup Validator for vocabulary; features the RRT doesn't support checked manually against their Google doc (site names: "Site names aren't supported in the Rich Results Test", 2025-12-10). Not detected / unsupported ≠ PASS. Validator PASS never certifies visibility, truth or policy compliance (§24 Validator limits). [SPEC]
5. No new unintended `noindex`, `robots.txt` Disallow, or canonical pointing to a different URL.
6. Cross-consistency check (§17): host in sitemap.xml `<loc>` entries = canonical host in HTML; the `Sitemap:` line in robots.txt points to the intended sitemap (a cross-site sitemap on another host is valid — §17).
7. Element counts (H1s, links, schema blocks) match between Mode 1 (raw HTML) and Mode 2 (rendered DOM) for crawler-visible content.
8. Commit message documents the empirical reason for the change, not just what changed: which checker / crawler reported what, before-state and after-state. Example: `"§24: drop empty sameAs[] — Rich Results Test was flagging Organization schema as 'empty array property'; verified resolved on URL test."` Future maintainers and future LLM sessions will revisit the same code; the empirical rationale prevents regression cycles.

### Execution Protocol (follow this; it sequences the whole handbook)

Handbook = rules. This protocol = order of work, scope per site, and proof of completion. Supersedes `seo-geo-implementation-kickoff.md` (2026-11-05); all of its content is carried here.

#### EP-1 Operating rules
- One phase at a time, in EP-4 order. Start phase N+1 only when phase N's gate passes, or every failing item is BLOCKED with a reason.
- **Release safety.** BLOCKED lets independent work continue; it never authorizes a production deploy. Release-blocking until resolved (waiver limits below): crawl/index/render blockers (S1 class per P1 definition, any mode); missing authentication on private paths; unreviewed SP6 pixels/consent or sensitive-form data flows (§30); placeholder or unverified facts on indexable pages (§24 Placeholder sentinels); legacy URLs without a redirect map [AUDIT/migration]. **Waivers:** the owner may waive in writing (item IDs + date, recorded under Release in the status file) only SEO, performance and content trade-offs. Never waivable: missing authentication on private paths; sensitive data sent to unreviewed recipients or tracking that runs before legally required consent; fabricated or unverified facts presented as true (§29). For these: RELEASE BLOCKED stays until the affected feature is disabled or the defect is resolved and retesting records evidence the prohibited exposure no longer exists; then clear that item (never by waiver). Disabling one feature does not clear an exposure elsewhere. Record `RELEASE BLOCKED (item IDs)` in the status file; finish independent work; hand off once. Owner-access items (GSC, BWT, GA4, PSI field data, CDN dashboard) are not release-blocking: BLOCKED or DEFERRED, never PASS without evidence.
- Per change: Definition of done 1–8. Per phase: the phase gate. Max ~5 templates per commit batch.
- Act without asking. Ask only for: Confirm-before-acting items · business facts not provided · policy choices · Site Profile answers that gate an irreversible change. Batch known questions in P0 (`seo-owner-todo.md`); continue on defaults; mark dependent items BLOCKED. Approval needs found after P0 (new dependency, >5-template change, site-wide rewrite): append to `seo-owner-todo.md`, mark only the dependent changes BLOCKED, continue independent work, report the queue once at phase end. Never assume approval; never install dependencies or make destructive changes unapproved; never re-ask an unanswered question.
- Context per phase: load §0 + the phase's scope sections + §29 (always) + §32 (lookup) + any section or subsection a gate cites by name, even when its owning phase is later. Never implement §33 (deferred — except its "Set up at launch" list, P10), §38 (retired; archive file), §39 (watchlist). §35 = reference only; §34, §40 = archive file (not loaded).
- Precedence: current platform docs (Google, Bing, schema.org, vendor bot docs) > Confirm before acting + §29 > this protocol > rest of handbook. Tags: `[SPEC]` > `[FIELD]` > `[STUDY]` > `[HEURISTIC]`. ⚠ CONFLICT lines: apply the stated resolution.
- `[UNVERIFIED …]` items: implement only if cheap + reversible; flag in the change log.
- Date-sensitive rules: with web access, re-check the cited source before any costly change or change touching >5 templates. Platform owner wins; flag conflicts, never pick silently.
- Never fabricate: hours, addresses, phone, prices, GTINs, ratings, reviews, testimonials, quotes, studies, citations, source URLs, awards, case studies, credentials, author bios, sameAs URLs, stats. Use `TODO(owner)` in code only: the block stays hidden and the schema property omitted until filled (§6, §24). A `TODO` never renders on an indexable page.
- Source check: every citation, study reference, quotation, testimonial and external statistic added or kept in copy is verified at the source — fetch the URL: it returns 200, the page states the claim (number, date, wording), quotations match verbatim, and the named person or organization appears there. Unverifiable → remove the claim, or `TODO(owner)` (hidden). Never add a source, study or quote to satisfy a template or density rule (§4, §5). Record source URL + fetch date in `seo-change-log.md`. [HEURISTIC]
- Every applicable item gets a status: `DONE` · `N/A (reason)` · `DEFERRED (trigger)` · `BLOCKED (needs X)` · `OPEN` · `LIMITED (platform, evidence)`. No silent skips. N/A is a valid outcome — never build scaffolding for it. PASS/FAIL apply to phase gates only. P1 mapping: verified compliant → DONE (baseline evidence); defect → OPEN + finding ID; required evidence unavailable → BLOCKED (missing X); inapplicable → N/A (reason). A recorded finding never closes an item.
- Platform limits: on hosted builders (Squarespace, Wix, Shopify, Webflow, Duda-based and similar) some rules cannot be implemented — response headers, robots.txt body, sitemap contents, redirect behaviour, platform-emitted schema, HTML cache headers. Classify every defect `FIXABLE (content | settings | code injection)` or `LIMITED (platform, evidence)`. Claim a limit only with evidence: the platform's documentation or the inspected setting. Unconfirmed → the item stays OPEN with "limit suspected". Many apparent limits are settings (field test: `Strict-Transport-Security: max-age=0` was written off as platform-fixed; Squarespace exposes an "HSTS Secure" option in its SSL settings, per third-party setup guides opened 2026-11-13). LIMITED items stay in the report, are never top fixes, and never get server-config advice (`add_header`, `.htaccess`) the platform cannot run. [FIELD]
  - Hosted-builder patterns seen in the field test (one Squarespace site — check per site; not platform facts): `WebSite` JSON-LD on every page with an empty `description` and a protocol-relative logo URL; `<meta name="description" content="">` on pages without a description; sitemap `<loc>` `/home` while that page's canonical is the root; share image on the home page only, `http://`; viewport `initial-scale=1`; `data-src` image loader + gallery hero; menu block printing each price twice; a chosen live page served as the 404 body; trailing-slash variant returning 200 + canonical instead of a redirect; no `Cache-Control` on HTML; robots.txt listing AI bots in the shared `*` group. [FIELD]
- Off-site work (backlinks, PR, Reddit/YouTube, review acquisition, directories): out of scope → log in `seo-followups.md`. Non-SEO hygiene surfaced by checkers (SPF/DMARC/DKIM, MTA-STS, security.txt) and backlink-profile observations: one line each in `seo-followups.md` (REVIEW mode: "Outside scope — noted"); never scored, never a top fix. [FIELD]
- Re-entry: a change that touches an earlier phase's scope (new template, new route, new collection) re-runs that phase's gate for the affected template.

#### EP-2 Mode
| Mode | When | Phase path |
|---|---|---|
| BUILD | Pre-launch; no legacy URLs (verified — Site Profile UNKNOWN rule) | P0 → P2 … P10 → P11 |
| AUDIT | Existing site | P0 → P1 (read-only) → S1 fix batch → P2 … P10 (remaining findings) → P11 |
| MAINTAIN | All gates passed previously | P11; any regression → re-enter the owning phase |
| REVIEW | External or read-only assessment: no repo, no owner access, no edits (prospect or competitor review, handbook field test) | P0 (profile inferred from the live site) → P1 (read-only, sitewide) → EP-7 report + grade. No fix phases, no status files |

#### EP-3 Site tier
Assign the highest tier whose criterion is true. Record evidence in the status file.

| Tier | Criterion | Typical |
|---|---|---|
| T4 Commerce / app / large | SP2, SP8 or SP10 = Y, or logged-in/user areas | Store, marketplace, SaaS + marketing site |
| T3 Collection site | ≥1 collection: index page + templated detail pages (events, articles, light product/service catalog, team, locations), CMS/API/data-driven | Event series, content site, multi-location |
| T2 Brochure | Multi-page, no collections (typically < ~30 pages) | Local service business |
| T1 Landing | 1 page (+ legal pages) | Campaign or launch page |

Item applies only when: tier tag ≤ site tier AND its §0 gate is true AND its mode tag matches. Gated sections (§11, §13, §15 video, §17 UGC, §20–22, §30 EU AI Act, §36, §37) and §24 gated schema types (Product, LocalBusiness, Event, VideoObject, Review) apply at any tier when their gate is true; P6 depth cells list typical additions, not limits — e.g. SP3 faceted nav or SP9 internal search on a T3 site. §41 tags: `[T1+]` all sites · `[T2+]` · `[T3+]` · `[T4]` · `[AUDIT]` existing sites only · `[gate: …]` condition must be true.

Phase depth by tier:

| Phase | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| P0 Intake + triage | Full | Full | Full | Full |
| P1 Audit baseline (AUDIT only) | Full | Full | Full | Full |
| P2 Architecture + rendering | Light: static/SSR HTML, one URL | Full (no collections) | Full | Full + §11 [gate] |
| P3 Crawl + index controls | Light: HTTPS host, canonical, 404, robots, sitemap | Full | Full | Full + §11, §13 [gate] |
| P4 Page templates | Full (1 template) | Full | Full | Full |
| P5 Content + facts | Light: answer-first, facts, contact | Full; §1 clusters optional | Full | Full |
| P6 Structured data + entity | WebSite + Organization or LocalBusiness | + BreadcrumbList, Person | + collection types (Article, Event, ItemList) | + Product/merchant, Review |
| P7 Performance + media | Full | Full | Full | Full |
| P8 Accessibility + security + compliance | Full | Full | Full | Full |
| P9 AI / GEO access | Bot policy + CDN + AI controls | Same | Same + §20–22 [gate] | Same + §36 [gate] |
| P10 Launch + indexing + measurement | Full | Full | Full | Full |
| P11 Monitor + maintain | §28 cadence; may run quarterly | §28 cadence | §28 cadence + per-update attribution | §28 cadence + per-update attribution |

#### EP-4 Phases
Order rationale: rendering + URLs first (everything else attaches to them) → crawl controls → templates → content → schema (marked-up values must already be visible) → performance → accessibility/security → AI access → launch → monitoring.

**P0 — Intake + triage (no edits)**
- Scope: §0, §41.
- Inputs (owner fills; blanks allowed):

| Field | Value |
|---|---|
| Site URL | |
| Repo / codebase | |
| Build state | pre-launch / existing |
| Site Profile SP1–SP12 | blank → infer |
| Priority pages / products / services | |
| Target topics or keywords | |
| Competitors (2–5 URLs) | |
| GSC / Bing WMT / GA4 access or exports | |
| AI training-bot policy | default Allow |
| GSC "Search generative AI" control | default Include |

- Do: stack inventory (framework; rendering SSR/SSG/CSR/hybrid; host; hosted builder if any (`Server` header, generator meta, asset hosts → EP-1 Platform limits); CDN + bot management; build command; routes → templates; indexable URL count). Infer SP1–SP12 from repo + live site → table `SP | answer (Y/N/?) | evidence | confidence`; proceed on inferred answers. Set mode (EP-2) + tier (EP-3). Copy §41 into the status file; set every item OPEN or N/A per EP-3. Record decisions (training bots, GSC AI control, canonical host, trailing-slash policy, consent approach). Batch owner questions.
- Gate: `seo-geo-status.md` complete; `seo-owner-todo.md` written.

**P1 — Audit baseline (AUDIT only; no edits)**
- Scope: §17, §26, §27, §41 (every OPEN item) + the body subsections those items cite, loaded one phase-group at a time (P2 items, then P3 …); audit only.
- Do: per template, Mode 1 vs Mode 2 (§17): title, meta, canonical, H1/H2s, schema blocks, primary content, links; record count mismatches. Global: robots.txt + group test, sitemaps + `<lastmod>`, canonical-host consistency, status codes, redirects, `noindex` in original HTML, OG/Twitter, schema validity, CWV field data, CDN AI-crawler settings (SP12), security headers. Run every OPEN §41 item read-only. Baseline with date: GSC Page indexing, Performance, Generative AI; Bing AI Performance; GA4 AI Assistant channel; AI answer panel when the owner runs it (§27). Content gap per priority topic: top-ranking pages' H2s/entities vs site coverage (§1 method; §33 not required for baseline completion).
- Evidence set (minimum). Per page, every template: status; title; meta description (empty `content=""` = missing); robots meta; canonical; viewport value; `lang`; H1–H6 outline in order; `<main>` count; `<nav>` labels; skip link; JSON-LD types + empty fields + URL schemes; OG/Twitter tags incl. image scheme and declared dimensions; images — `alt` absent, `alt=""` on content images, filename-as-alt, missing dimensions, format, `data-src` loaders; links — internal targets, generic anchors, links with no accessible name, `tel:` / `mailto:` formats; forms + labels; visible word count raw vs rendered; trackers. Sitewide: robots.txt evaluated per group; sitemap (`<loc>` vs each page's canonical; `<lastmod>`); redirects (HTTP, apex/www, one hop); URL variants (trailing slash, case, `/index.html`, tracking params); unknown-URL status + the 404 body's canonical; response headers by value (HSTS `max-age`, CSP, Referrer-Policy, Permissions-Policy, `Cache-Control` on HTML and static assets); bot-UA parity; §17 URL inventory reconciliation; near-duplicate and thin 200 pages. [FIELD]
- Evidence reconciliation (before closing P1): every failed or warned audit in tool output (Lighthouse, axe, crawler, checker) and every non-zero defect count from the evidence set maps to a finding ID, or is listed under "Observed, not actioned (reason)". Collected-but-unreported data is a P1 defect (field test: the viewport value, render-blocking and cache audits, an unnamed link and a second `tel:` format were captured and left out of the report). [FIELD]
- Severity: `S1` blocks crawl/index/render (robots.txt that blocks indexable URLs or citation bots, including through a group mismatch; unintended noindex; JS-only unique primary content — text the page exists to deliver, absent from server HTML on every URL of the site; 200 catch-all; canonical/redirect errors; CDN blocking citation bots) · `S2` page fundamentals (title/meta/H1, schema errors, CWV fails, serious a11y; robots group bug that only over-allows — named bots ignore the `*` Disallows; JS-only content that server HTML carries elsewhere on the site) · `S3` content/extraction · `S4` measurement, gated, polish.
- Gate: every applicable item is DONE, OPEN + finding ID, BLOCKED (missing evidence) or N/A (EP-1 P1 mapping); baseline numbers + date stored. Evidence reconciliation done: no collected defect without a finding ID or a stated reason.
- Then: fix all S1 as one batch (any phase scope); re-check them; continue P2 … P10 for S2–S4.

**P2 — Architecture + rendering**
- Scope: §9, §2 URL, §12, §14 Rendering / AI-critical block visibility / Deployment build chain, §8 Navigation.
- Do: SSR/SSG for every indexable route; primary content in raw HTML; API fallback; no `opacity:0` primary content; URL structure + slugs; one crawlable HTML index per collection; header nav → core hubs; breadcrumb UI; no orphans; build command runs the full chain.
- Gate: per template Mode 1 = Mode 2 for crawler-visible content; JS-off view shows primary content; every detail URL linked from an HTML index; after deploy, sitemap/robots served fresh.

**P3 — Crawl + index controls**
- Scope: §10, §11 [gate], §13 [gate], §17, §18, §19, §2 URL.
- Do: canonical host + HTTPS (one-hop 301/308); trailing-slash policy; self-canonicals; identical URL form everywhere; real 404s; legacy URL map [AUDIT]; retired items; junk URLs 404/410; hidden-page hygiene (noindex ≠ unlinked, §10); admin paths; robots.txt (full rule set per group + render-resource guard + route coverage, §18); sitemap with truthful `<lastmod>` (provenance, §19); variant URL contract [gate: SP2] (§10).
- Gate: §17 cross-consistency; robots tests when any Disallow exists (§18 Route coverage: named bot + unlisted bot vs each protected route shape → blocked; indexable routes → allowed); unknown URL → 404; zero redirect chains in a crawl; no `noindex` in original HTML of indexable pages; `<lastmod>` per URL from content provenance (§19) — never all = build/deploy date; equal values only where real updates share a date; omitted where provenance unknown.

**P4 — Page templates**
- Scope: §2, §3 heading rules, §7 structural elements, §12 Outbound links.
- Do per template: title formula + brand suffix; meta description; one primary H1 (default; keep a justified multi-H1 outline per §2; never zero); heading outline; one `<main>`; labelled `<nav>`s; canonical tag; breadcrumbs and visible last-updated where the §7 Page-type applicability matrix marks them; OG/Twitter with per-page image; Article OG tags; `max-image-preview:large`; new-tab link attributes.
- Gate (script over built HTML): titles, meta descriptions, H1s unique; multi-H1 count flags = review item, not failure; exactly one `<main>`; no skipped heading levels; `og:image` declared dimensions = file; no empty `content=""`.

**P5 — Content + facts**
- Scope: §1, §3, §4, §5, §6, §7 content elements, §8 Above the fold + CTA rules, §16 snippet/PAA/AI Overview patterns, §25 copy rules, §24 Placeholder sentinels + Validator limits (gate definitions).
- Do: keyword → URL map + cannibalization check (T2+; §1; needs GSC or tool data); answer-first openings; key-facts blocks (T3+); single-source stats; page-specific FAQs; About, author pages; Contact route or existing contact block (§7); remove placeholders + unsupported superlatives; acronyms spelled out per page. Rewrites beyond typo/clarity: list pages, confirm once, then batch. Source check on every citation, study, quotation and external stat (EP-1). Page-type matrix applied (§7).
- Gate: built HTML has no placeholder strings (`TODO`, `lorem`, `XXX`, `[Brand]`); no §24 placeholder sentinels (typed match; recorded provenance exempts — §24); each stat identical across copy, meta, schema, llms.txt, About; every stat, percentage, superlative, comparative, scientific or medical claim has a visible source (+ date when time-sensitive); owner-supplied business facts (hours, services, contact) need recorded provenance in the status/owner files, not an inline citation; CTAs and navigation exempt; no FAQ block duplicated across pages. Every cited source fetched and confirmed to state the claim; no invented quote, study or citation (EP-1 Source check). [T2+] `seo-keyword-map.md` covers the priority pages: one primary query + intent per URL; no two indexable URLs share a primary query (§1); map data unavailable → BLOCKED, not PASS.

**P6 — Structured data + entity**
- Scope: §24, §25, §16 Structured data note.
- Do: WebSite (home); one `@id` per real organization (the site's own organization defined once); BreadcrumbList; Article + Person; gated types (Product/ProductGroup, Event, LocalBusiness, VideoObject, Review, FAQPage, ItemList).
- Gate: JSON-LD present in raw HTML (Mode 1); every block parses; Rich Results Test 0 errors for supported features per template (Definition of done #4; site names checked manually); one `@id` per real organization sitewide; no duplicate node for the same organization in a page graph (distinct organizations — third-party publishers, manufacturers, organizers — and location nodes keep their own `@id`s; never merge them to satisfy a node count); identical values wherever repeated; no empty values; no §24 placeholder sentinels (typed match; recorded provenance exempts — §24); user-facing marked-up facts visible on the page (§24 content rule); dates in each feature's format — Article date-time + offset (recommended), Event offset when the time is known, date-only for all-day/unknown; never an invented time or offset.

**P7 — Performance + media**
- Scope: §14 Core Web Vitals / Cookie consent / Code optimization, §15.
- Gate: per template PSI mobile lab (pre-launch: Lighthouse CLI mobile preset) LCP ≤ 2.5 s, CLS ≤ 0.1; CrUX field data when available; INP from CrUX when available, otherwise TBT from the same PSI lab run recorded as a proxy (§14; over 600 ms = finding) + primary interactions checked; LCP image eager + `fetchpriority="high"`; every `<img>` dimensioned; third-party scripts authorized first (consent where legally required, SP6 review), then scheduled after load/interaction; pre-consent network requests verified, not only cookies; hero video rules [gate].

**P8 — Accessibility + security + compliance**
- Scope: §14 Accessibility / Mobile / HTTPS / Security headers, §30.
- Gate: axe-core after full scroll: 0 critical/serious; contrast passes incl. brand accents; every §14 security header present and read by value (HSTS `max-age` > 0; CSP enforcing or report-only recorded — an allow-all policy is a finding, §14); consent banner doesn't block LCP; SP6 pixel review recorded; [gate: forms collect health, financial, account or other sensitive data] data-flow check recorded (§30).

**P9 — AI / GEO access**
- Scope: §16 AI-feature controls, §18 bot tokens + CDN defaults, §20–22 [gate], §23 (awareness), §36 [gate], §37 [gate].
- Gate: robots.txt decisions parser-tested per bot class; `/robots.txt` = HTTP 200 on every serving host (§18 delivery); bot-UA fetch of key routes = 200 + full HTML on a publicly reachable origin (protected preview: authenticated/local check now, anonymous public-origin check DEFERRED to P10 — Verification rules); CDN AI-crawler/bot settings inspected and recorded (SP12; dashboard unavailable → BLOCKED, owner item); AI-control + training-bot decisions in the status file. Verified-bot log check (vendor IP files, §18): record genuine requests when present; none yet (pre-launch, low traffic) → DEFERRED (trigger: P11 +2 weeks), not FAIL and not verified. Never wait for unsolicited crawler visits.

**P10 — Launch + indexing + measurement**
- Scope: §26, §27, §19 submission, §17 Validate Fix.
- Do: release check — no `RELEASE BLOCKED` items (EP-1) before production deploy; GSC Domain property; BWT import; submit sitemaps to both; IndexNow key + deploy ping; Request indexing for key pages; GA4 with consent; verify GA4 AI Assistant channel + custom AI group; annotate launch/fix dates. AUDIT: Validate Fix on every fixed GSC issue. Key events per §27. §33 "Set up at launch" items by gate. BUILD: first AI answer panel run after launch (§27; owner-run).
- Gate: anonymous + bot-UA fetch of key production routes = 200 + full HTML, run immediately after cutover (private routes still authenticated); sitemaps read successfully in GSC + BWT; IndexNow returns 200/202; GA4 receives hits after consent; each primary action fires its key event once (§27 Key events), checked in DebugView / Realtime.

**P11 — Monitor + maintain (recurring)**
- Scope: §28, §35, §26 reports, §39 revisit triggers, §33 (eligible 6+ months post-launch).
- Do: §28 cadence; re-baseline at +4 and +12 weeks (GSC Performance + Generative AI, Bing AI Performance, GA4 AI channel, key events, AI answer panel — §27); before interpreting any ranking change, refresh the Search Status Dashboard and record active incidents with timestamps (§35 is historical, not a completeness guarantee); attribute shifts to §35 windows; check §39 triggers; at 6+ months evaluate §33.
- Outcome record: for each fixed finding class, store before → after for the affected URLs at +4 and +12 weeks in `seo-followups.md` — index state, GSC impressions / clicks, key events, AI answer panel rows; list fixes that produced no measurable change. Input for handbook maintenance (archive file, part E), never a ranking promise. [HEURISTIC]
- Output: `seo-followups.md`.

#### EP-5 Files (repo root, outside the public build directory — never deployed)
| File | Written in | Content |
|---|---|---|
| `seo-geo-status.md` | P0, updated every phase | Template below |
| `seo-owner-todo.md` | P0 onward | Business facts needed, low-confidence SP answers, Confirm-before-acting items, policy decisions, `TODO(owner)` list |
| `seo-audit-baseline.md` | P1 | `\| ID \| Handbook § \| Template / URL \| Finding \| Severity \| Fix \|` |
| `seo-change-log.md` | P2–P10 | `\| ID \| § \| Change \| Files \| Before → After \| Verified with \| Result \|` |
| `seo-keyword-map.md` | P5 (T2+) | §1 Keyword → URL map: URL, page type, primary query, intent, evidence, action |
| `seo-followups.md` | P11 (and any phase) | Re-baseline schedule, §33 candidates, off-site opportunities, unresolved platform-doc conflicts, AI answer panel log, outcome record |

Commits: one per handbook § per template; message per Definition of done #8.

`seo-geo-status.md` template:
```
# SEO/GEO Status
handbook: 4.6 | mode: BUILD|AUDIT|MAINTAIN|REVIEW | tier: T1–T4 (evidence) | updated: YYYY-MM-DD
## Site Profile
| SP | Y/N/? | evidence | confidence |
## Decisions
training bots: Allow|Block · GSC Search generative AI: Include|Exclude · canonical host: · trailing slash: · consent: · CDN: 
## Phase gates
| Phase | OPEN/PASS/FAIL/BLOCKED/N/A | date | evidence |
## Release
CLEAR | RELEASE BLOCKED (item IDs) | owner waiver (date, items; waivable classes only — EP-1)
## Checklist (§41 copy)
- [STATUS] [tag] item (§) — note
## Blocked / owner needed
## Deferred (trigger)
```

Phase gate statuses: FAIL = a tested defect remains; BLOCKED = required action or evidence unavailable (record the dependency); neither is PASS. DEFERRED is an item status with a trigger, not a phase status. Release eligibility is recorded separately under Release. LIMITED items (EP-1 Platform limits) do not fail a gate; list them in EP-6 reporting.

#### EP-6 Reporting
- End of each phase: `Pn — gate PASS|FAIL` + table: Done · N/A · Deferred · Blocked · Needs owner · Limited (platform). Name the next phase. No narration.
- End of run: AUDIT counts by severity (fixed / open); phase-gate summary; release status (CLEAR / RELEASE BLOCKED items); file list.

#### EP-7 External review + scoring (REVIEW mode)
- Use: assess a live site with no repo, no owner access and no edits (prospect or competitor review, handbook field test).
- Scope: on-site defects observable from outside. Ranking position, traffic, backlink and authority metrics are out of scope — never pull them, never use them to soften, drop or reorder a finding. State the defect and the fix; omit ranking-impact claims or tag them [SPECULATIVE].
- Run: P0 (Site Profile inferred with evidence, tier, platform) → P1 evidence set sitewide (every sitemap URL + every internal-link target; above ~50 URLs sample ≥1 URL per template) → walk §41 item by item (`[AUDIT]` items apply where observable from outside): PASS · finding ID · BLOCKED · N/A · LIMITED → evidence reconciliation → score → report.
- Not observable from outside → BLOCKED (owner access); never a defect, never scored: Search Console / Bing data, CDN and bot-management settings, server logs, consent configuration, analytics that leave no tag (platform or server-side analytics; DNS-verified Search Console). "No tag found" ≠ "not installed".
- Cross-check: ≥2 independent single-URL checkers on the home page + one lab performance run per template; reconcile per §0 Verification rules; list checker errors in the report.
- Phase score = applicable §41 items passing ÷ applicable items × 100 (partial pass 0.5; LIMITED 0.5; BLOCKED and N/A excluded). Total = Σ (weight × phase score) ÷ 100. P0, P1, P10, P11 are not scored.

| Phase | Weight |
|---|---|
| P2 Architecture + rendering | 15 |
| P3 Crawl + index controls | 15 |
| P4 Page templates | 15 |
| P5 Content + facts | 15 |
| P6 Structured data + entity | 15 |
| P7 Performance + media | 10 |
| P8 Accessibility + security + compliance | 10 |
| P9 AI / GEO access | 5 |

- Cap: any open S1 → total ≤ 39. Grade: A ≥ 85 · B 70–84 · C 55–69 · D 40–54 · F < 40. Weights and cap are [HEURISTIC]: they make runs comparable; they do not measure ranking. Third-party checker scores are not comparable (one URL, presence checks).
- Version comparability: scores compare only between runs on the same handbook version — the §41 item set changes between versions (v4.6 added scored items in P5, P6, P7). State the handbook version beside every grade. [HEURISTIC]
- Repeatability: where a grade is compared across sites or dates, compute it from two independent P1 runs; report both; a finding present in only one run is re-checked by direct fetch before the grade is issued. [HEURISTIC]
- The AI answer panel (§27) and keyword data (§1) are visibility measures: out of scope in REVIEW mode, like ranking data.
- Report (one document, no status files): header (handbook version, date, mode, tier, platform, evidence list) · grade + phase table (weight, score, driver) · inferred Site Profile · top fixes (FIXABLE only, ordered by severity then effort) · findings by severity `| ID | § | Finding | Evidence |` · passes · LIMITED (platform) · BLOCKED (owner access) · outside scope — noted · checker errors · residual weaknesses.

---

## 1. Keyword + Intent Strategy

### Search intent
- Map content format to top-ranking pages for target query.
- Match the underlying user goal, not just the phrase.
- Account for device-based intent differences (mobile vs desktop).
- Semantic keyword clustering: address the topic fully, not just one phrase.

### Primary keyword selection
- Pick keyword with adequate search volume.
- Target consistently across Title Tag, H1, URL, meta description, body copy first 100 words, final paragraph.
- Long-tail and question-based keywords convert higher than broad terms.
- Prioritization: relevance × intent × keyword difficulty × CPC.

### Commercial / transactional focus
- Start at bottom of funnel ("most aware" buyers).
- Commercial keywords closer to conversion need less content depth to rank.
- Don't lead with high-volume informational keywords unless funded for long content investment.

### Topical authority
- Pick one core topic and dominate it before expanding.
- Build pillar + supporting page coverage for every subtopic.
- Random unrelated content dilutes authority — avoid.

### Competitor + gap analysis
- Analyze top-ranking pages for target query.
- Replicate working structures; do them better.
- Splinter different-intent keywords onto dedicated pages (one page = one dominant intent).
- Opportunity zones: pages ranking positions 2-15 (optimization-fixable) and 51-100 (depth/relevance gaps).

### Keyword → URL map (procedure) [HEURISTIC]
- Output: `seo-keyword-map.md` (repo root, never deployed): `| URL (existing or planned) | Page type (§7) | Primary query | Intent (informational / commercial / transactional / navigational / local) | Secondary queries | Evidence (source + date) | Action (keep / rewrite / merge / create / retire) |`.
- Evidence sources, in this order: GSC Performance, queries × pages (existing sites; up to 16 months) → a keyword tool (Ahrefs, Semrush) for volume and related terms → the live results page for the query: which page types rank and which features show (local pack, AI Overview, shopping, video). No data source available → the map is BLOCKED and queued in `seo-owner-todo.md`. Never invent a query, a volume or a difficulty score.
- One primary query + one intent per URL; one URL per primary query. The results page shows a different page type than yours (guides rank; you have a product page) → build that type or choose another query.
- Order of work: pages that sell first (service, product, location, pricing), then supporting content (Commercial / transactional focus above).
- SP7: primary queries carry the service and the place the way searchers write them ("[service] in [city]") — confirmed by GSC or tool data, not assumed.
- Each row drives that URL's title, H1 and opening sentence (§2, §3). Action = create or merge → owner approval first (§0 Confirm before acting); a planned page with no distinct facts to publish is not created (§6; doorway and scaled-content limits, §29).
- Depth: T1 one row · T2 every indexable page · T3+ every template plus the priority pages named at P0.

### Cannibalization check [HEURISTIC]
- Cannibalization = two or more indexable URLs competing for the same primary query and intent. Similar wording with different intent (guide vs product page) is not cannibalization.
- Detect: (1) the map — duplicate primary queries, near-identical titles or H1s; (2) GSC Performance — filter one query, open the Pages tab: two or more URLs collecting impressions for it; (3) a site crawl — duplicate or near-duplicate titles. (§17 URL inventory catches copies of a page; this check catches distinct pages aimed at one query.)
- Fix, in this order: differentiate (retitle and refocus one page on its own query) → consolidate into the stronger URL and 301 the other (§10) → `rel="canonical"` only for true duplicates. Never `noindex` a page that holds links or traffic as the first move. Repoint internal links and anchors to the kept URL (§12).
- No GSC access → run checks (1) and (3) and record the limit.

---

## 2. Page Header Elements

### Title Tag
- Pixel width <600px desktop / <920px mobile to avoid truncation. ~50-65 characters is the typical safe zone, but wide letters (W, M, uppercase) consume more pixels. Google indexes the full title regardless of display length and rewrites ~76% of titles per Q1 2025 studies — prioritize clarity over hitting an exact character count.
- Primary keyword early in the title.
- Brand name optional, append at end. If used: one consistent suffix format sitewide (e.g. ` | Brand`); shorten the main text rather than dropping the suffix. [FIELD]
- Current year appended ("...2026") for time-sensitive queries.
  - ⚠ CONFLICT (field, 2026-11-11): stale year headings ("2026 Calendar") were a recurring audit defect. Resolution: append a year only when a maintained process refreshes it (annual guides, rate tables). Never hard-code a year in titles/headings of listing, calendar or evergreen pages — use "Upcoming", "Current", "Latest". [FIELD]
- Every title unique sitewide. [FIELD]
- Title says what the page offers (service or topic, + place for SP7) before the brand. Brand-only titles (`BRAND`) and bare page-label titles (`Services — Brand`, `Contact — Brand`) are defects. [FIELD]
- Titles and H1s use the names people actually search — including legacy, former and brand names. Confirm with GSC Performance queries + top landing pages before rewriting. [FIELD]
- Hub/category pages: brand + a specific promise, never generic ("All Items", "Events"). [FIELD]
- Never repeat the keyword for stuffing.
- Never put phone numbers in the title.

### H1
- Primary H1 with primary keyword, above the fold.
- HTML5 spec and Google (Mueller, 2019) both allow multiple H1s — there is no upper or lower bound enforced by Google. One H1 is convention for outline clarity, not a Google requirement. Don't contort architecture to enforce single-H1 if a multi-H1 outline (one per `<section>` / `<article>`) is genuinely clearer.
- Pages with zero H1 anywhere = real problem (no document outline anchor); always fix this.
- SSR/SSG with hydration may produce a transient duplicate H1 (one in the SSR'd HTML + one rehydrated by the client framework). Accept it. Do not contort hydration logic to suppress — Google has confirmed multiple H1s don't affect ranking.
- First H2 should contain a keyword variation.
- Never generic ("Welcome," "Home").
- H1 = the page's topic. Never a promo, banner, offer or decorative label (field test: the first H1 on a home page was a gift-card promo). Page builders pick heading levels for size: fix the level, style with CSS. [FIELD]
- Every H1 unique sitewide. [FIELD]
- Default to one H1 per page: third-party checkers and accessibility audits flag multiple H1s (field audits 2026-11). Multiple H1s remain allowed by Google — don't contort architecture; fix only where an audit tool you rely on flags it. [FIELD + HEURISTIC]

### URL
- Lowercase, hyphenated (never underscores).
- Contains primary keyword.
- Concise.
- Subfolder depth maximum 3-4 levels.
- Never change URLs of pages with established rankings (301 redirect if forced).
- No dates in URLs. No query params for primary content. (Pagination, variant and approved facet parameters: §10, §11.)
- Pick trailing-slash convention; permanently redirect the other (301 or 308 — Google treats both as permanent). Apply identically on every route, including nested routes and the routes your framework generates. [FIELD + SPEC]
- Nav and logo link to `/`, never `/index.html`. Query-string variants (`?ref=`, `?utm_`) canonicalize to the clean URL. [FIELD]
- One canonical per concept.

### Meta Description
- 150-160 characters (conservative range: 125-155 ensures full mobile display). Field audits used ~120–155; display length varies by device and query — treat any range as [HEURISTIC].
- Primary keyword present.
- Persuasive, CTA-driven.
- Unique per page (no duplicates).
- A tag with an empty `content=""` counts as missing (hosted builders emit it when the field is blank). [FIELD]
- Capitalize trigger words sparingly for SERP scannability.
- Not a direct ranking factor, but drives CTR.

### Body Copy
- Primary keyword in first 100 words.
- Primary keyword in final paragraph.
- LSI / semantic variations throughout body, naturally. [UNVERIFIED as of 2026-11-01] ("LSI" terminology vs Google's stated position not re-verified.)
- No keyword stuffing.

### Open Graph + Twitter Card Meta Tags
- Required on every public page (not just blog posts).
- Used by Facebook, LinkedIn, Slack, Discord, iMessage, X/Twitter for link previews. Google uses `og:image` (alongside schema.org `image`) as a thumbnail source for Search and Discover (2026-03-02). [SPEC] Use by AI assistants for link previews: undocumented as of 2026-11-01.
- Preferred thumbnail: declare the same image in schema.org `image` and `og:image`. [SPEC]
- `og:image` minimum 1200×630 px, max 5MB, PNG or JPG.
- If declaring `og:image:width` / `og:image:height` meta values, they MUST match the actual image file dimensions. Mismatch breaks LinkedIn, Slack, Discord, and iMessage previews and gets flagged by SEO checkers.
- Drop tags with empty values entirely. Rendering `<meta property="og:description" content="" />` is worse than omitting the tag — empty `content=""` is a positive "we have nothing here" signal to parsers (see §24 Schema hygiene for the same principle).
- Mismatched OG vs page content = trust signal failure.
- Each page gets its own 1200×630 share image (template-generated is fine). Never the logo as the default `og:image`. [FIELD]
- `og:image` / `twitter:image`: absolute `https://` URL — never `http://`, never protocol-relative. Check every template: builders often set a share image on the home page only. [FIELD]
- Pages marked up as `Article`: `og:type=article` + `article:published_time` / `article:modified_time`, identical to the JSON-LD dates. [FIELD]
- `<meta name="robots" content="max-image-preview:large">` on indexable pages. Google Discover: large image previews are "Enabled by the max-image-preview:large setting"; large images ≥1200 px wide, 16:9, >300,000 pixels. [SPEC]

```html
<meta property="og:title" content="[Page Title — matches or refines Title Tag]" />
<meta property="og:description" content="[150-160 chars, matches or refines meta description]" />
<meta property="og:image" content="https://yoursite.com/img/og-preview.jpg" />
<meta property="og:url" content="https://yoursite.com/page-canonical-url" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="[Brand Name]" />
<meta property="og:locale" content="en_US" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[Page Title]" />
<meta name="twitter:description" content="[150-160 chars]" />
<meta name="twitter:image" content="https://yoursite.com/img/og-preview.jpg" />
<meta name="twitter:site" content="@brandhandle" />
```

---

## 3. Content Structure Rules

- BLUF: answer in first 60 words. Name brand/entity. 2-3 sentences. Opening sentence names the brand, the subject and what the page gives. [FIELD] (Compatible with: keyword in first 100 words — both must be true.) [HEURISTIC]
- Answer capsule under each H2: 40-60 words, self-contained, before elaboration. [HEURISTIC] Readability/snippet convention only — Google (2026-05-15): "There's no requirement to break your content into tiny pieces for AI to better understand it."
- H1 → H2 → H3 by default; H4+ only where the content has that depth (specs, legal, documentation). No skipped levels. [HEURISTIC] (HTML defines h1–h6; the former "No H4+" had no source.)
- Every page has exactly one `<main>` landmark. [FIELD]
- Nav and footer labels are not headings: use labelled `<nav aria-label="…">` with `<p>`/`<span>` labels. Each `<nav>` gets a distinct label. [FIELD]
- Items listed inside a section use the next heading level down — never siblings of their own section heading. [FIELD]
- One H2 = one extractable claim.
- Question-format H3s mirroring real user prompts (also targets Featured Snippets + People Also Ask).
- Modular sections: 75-300 words for direct-answer blocks; 300-500 tokens for evidence chunks. [HEURISTIC] Google says to ignore "chunking" for Google Search (2026-05-15); retrieval chunk sizes of other engines are not vendor-documented.
- Each section stands alone as a complete answer to a sub-query.
- Key Takeaways box at top of long pages: 5 bullets, 1 sentence each.
- No sitewide boilerplate FAQ. Each FAQ is specific to its page, or omitted. [FIELD]
- Tables for comparative data.
- Parallel bullet structure.

---

## 4. Writing Patterns LLMs Extract

Use these sentence templates verbatim where the content fits:

- Definition: "X is a [category] that [function]."
- Function: "X enables [outcome] by [mechanism]."
- Evidence: "A [year] study by [source] (n=[N]) found [outcome]."
- Process: "Step 1: [action]. Step 2: [action]. Result: [outcome]."
- Comparison: "X differs from Y in [dimension]: [specific]."
- Numbers: "X reduces [metric] by [%] in [timeframe]."
- Quotation: "According to [named expert, credentials], '[direct quote].'"

- Templates are sentence shapes, not content to invent: fill a slot only with a verified fact. No verified study, number or quotation → do not use that template (§0 EP-1 Source check). [HEURISTIC]
- The extraction benefit is [HEURISTIC]: no engine documents these patterns (§16 Per-engine facts).

---

## 5. Density + NLP Rules

- 1 authoritative outbound link per 150 words in evidence sections.
  - Ceiling, not a quota: cite where a claim needs support; never add a link or citation to reach a ratio (§0 EP-1 Source check). Evidence-bearing pages only — articles, guides, YMYL (§7 Page-type applicability). [HEURISTIC]
- Specific numbers replace adjectives ("Reduced by 43% in Q3 2025" not "significantly reduced").
- Bracketed inline citations [12] linking to References at bottom.
  - Article / guide pages only; other page types use a plain inline link. [HEURISTIC]
- Synonyms / LSI inline on first mention: "GraphQL (a query language for APIs)."
- LSI/semantic variations spread throughout body. [UNVERIFIED as of 2026-11-01]
- NLP coverage: use optimization tools to extract relevant subtopics from top-ranking competitors; cover them.
- Banned filler in first 200 words: discover, unlock, harness, leverage, empower, transform, revolutionize, seamless, robust.
- Focus on brevity at top end of word count; avoid bloated word-padding for rank.

---

## 6. Content Quality

### Original content
- Add proprietary anecdotes, case studies, original data.
- Information Gain: include data the LLM/search engine can't get from other sources.
- Personalize AI-drafted content with company-specific USPs and testimonials.
- Never publish AI-only boilerplate. Follow Google's generative-AI content guidance (doc added 2025-05-21; updated 2026-10-01 with Search Quality Rater Guidelines material) and the scaled content abuse spam policy ("many pages are generated for the primary purpose of manipulating search rankings and not helping users"). [SPEC]
- Prioritize first-hand experience, original data and expert takes over summaries of what is already online — Google (2026-05-15): content people find "unique, compelling, and useful will likely influence your website's presence in generative AI search". [SPEC]

### Fact integrity [FIELD]
- Counts and stats ("20+ events", "50,000 participants", "$3M raised") come from one data-driven source and match everywhere: page copy, meta description, schema, llms.txt, About page.
- Every stat or claim carries a visible source and date on the page.
- Sources are checked, not assumed: fetch each cited URL and confirm it states the claim; quotations verbatim, attributed to a named source that exists (§0 EP-1 Source check). [HEURISTIC]
- No superlatives ("best", "most absorbed") or percentage claims without an on-page citation.
- Awards, press mentions, certifications and "as featured in" items: HTML text naming the award, the awarding body and the year, linked to the source. A badge or logo image alone carries no fact a crawler can read. [FIELD]
- One live version of each fact set. Test, draft, old or duplicate copies of a page (staff roster, bio, menu, price list) left published contradict the live page: unpublish or redirect (§17 URL inventory). [FIELD]
- Copy matches current product/spec decisions. When a spec, formulation or price changes, re-check every page that mentions it.
- Detail pages carry substantive, unique facts from the primary source (registration page, product spec sheet) — not filler to hit a word count.
- No placeholder or template copy on indexable pages. When real data is missing, hide the block (same rule as §24 schema hygiene).
- Spell out acronyms and condition names on first use on each page, not only once sitewide.

### Readability
- Target Hemingway Editor Grade 6-8 for consumer; up to Grade 10-12 for technical.
- Grammarly score 95+.
- Short paragraphs (1-3 sentences).
- Conversational tone where appropriate.
- Skimmable structure: headings every 200-300 words, bulleted lists, bolded key terms.

---

## 7. Required Per-Page Elements

- Author byline (Person schema, see §24).
- "Last updated [YYYY-MM-DD]" visible in HTML.
- Author credentials displayed (title, certifications).
- About-page link in footer.
- YMYL pages: reviewer byline + reviewer credentials + "Reviewed by [Name, credentials]" visible.
- Self-referencing canonical tag (see §10).
- Open Graph + Twitter Card meta tags (see §2).
- Breadcrumbs (BreadcrumbList schema).
- FAQ block where applicable (visible Q&A; source questions from PAA + customer inquiries). FAQPage schema optional — Google FAQ rich results retired 2026-05-07 (see §24). Page-specific only — no sitewide boilerplate FAQ. [FIELD]
- Key-facts block on every detail page: price, date + time, address, parking, cutoffs/deadlines, policies — server-rendered, quotable, mirrored in any Markdown version (§22). [FIELD]
- Contact route or existing contact block: expose verified channels in server HTML; an accessible working form or email may suffice. Publish a full address only when the business has a public address, and a phone (as `tel:` link) only when supplied and approved — expected for SP7=Y local businesses. Never invent a channel or add a separate page solely for this item. [FIELD]
- SP7: address as one text block in standard postal format (`street, suite, city, ST ZIP`) — not split by pipes, line art or images; one `tel:` format sitewide (E.164, `tel:+1…`); opening hours in server HTML. Field test: two checkers could not find an address written `STREET | CITY, ST | ZIP`. [FIELD]
- About page: named people with roles, server-rendered, Person schema; author/Article schema links to it. [FIELD]
- Internal links to related entity/topic pages + relevant conversion pages.
- Related-content + CTA block at page end.
- Testimonials / social proof block where applicable (Review or AggregateRating schema). Never fake or undisclosed incentivized reviews — Google review snippet guideline added 2026-07-24. [SPEC]
  - Markup only where eligible: product reviews → `Product`. Reviews of the business itself shown on its own site are self-serving — no `Review` / `AggregateRating` markup expecting stars (§24 LocalBusiness). [SPEC]

### Page-type applicability [HEURISTIC]
R = required when that page type exists · O = add only with real content · — = do not add. A thin or empty block is worse than none (§6). Rules in §3–§8 written for articles apply elsewhere only as marked here. A page with two roles (a home page that is also the only service page) takes the union.

| Element | Home | Service | Location | Product | Hub / category | Article / guide | About / team | Contact | Legal / utility |
|---|---|---|---|---|---|---|---|---|---|
| Unique title, meta description, H1, self-canonical, OG / Twitter (§2, §10) | R | R | R | R | R | R | R | R | R |
| Opening sentence: brand + subject + what the page gives (§3) | R | R | R | R | R | R | R | O | — |
| Answer capsules under H2s, question H3s (§3, §16) | — | O | O | O | — | R | — | — | — |
| Key Takeaways box (§3) | — | — | — | — | — | O (long pages) | — | — | — |
| Key-facts block (§7) | O | R | R | R | — | O | — | R (channels, hours) | — |
| Author byline + credentials, Person schema (§7) | — | — | — | — | — | R | — | — | — |
| Reviewer byline [gate: SP6] (§7, §30) | — | R if the page makes health, financial, legal or safety claims | same | same | — | R | — | — | — |
| Visible "Last updated" (§7) | — | O | O | O (price / spec date) | — | R | — | — | R (policy date) |
| Breadcrumbs + BreadcrumbList [T2+] (§7, §24) | — | R | R | R | R | R | O | O | — |
| Page-specific FAQ (§3, §7) | — | O | O | O | — | O | — | — | — |
| Outbound citations / references (§5) | — | where a claim needs one | same | same | — | R for claims | — | — | — |
| Primary CTA in the first mobile screen (§8) | R | R | R | R | O | O | O | R | — |
| Related content + CTA block at page end (§7) | — | R | R | R | — | R | O | — | — |
| Testimonials / reviews with source (§7) | O | O | O | R when real reviews exist | — | — | O | — | — |
| Primary schema (§24) | WebSite + Organization or LocalBusiness | none required (`Service` optional, vocabulary only) | LocalBusiness | Product / ProductGroup | ItemList [T3+] | Article + Person | Organization / Person | none (contact data sits on the organization node) | none |

### Page blueprints (block order; all server-rendered) [HEURISTIC]
- **Home:** H1 = what the business is + for whom or where (§25 entity test) → one-sentence proposition → primary CTA → core offers as links to service / product / hub pages with descriptive anchors (§12) → proof: reviews with source, awards as text (§6), clients → SP7: address, hours, phone → About link. No article furniture.
- **Service:** H1 = the service (+ place for SP7) → opening sentence: who provides what, where → primary CTA → what is included / how it works (list) → price or price range only if the owner publishes one (table or list — §14) → key facts: duration, area served, booking, policies → proof specific to this service → page-specific FAQ from real customer questions → related services + CTA. One page per service that has its own demand (§1 map).
- **Location** [gate: SP7, multi-location or service area]: H1 = business or service + place → name, address, phone block, hours, directions and parking in text → services at this location (links) → staff or photos of this location → proof from this location → CTA. Doorway limit: Local business pages below.
- **Product:** name + deciding facts → price and availability, visible and equal to markup and feed (§24, §36) → primary CTA → specs table → what is included; shipping and returns summary with policy links → real reviews → related products. Variants §10; lifecycle §28.
- **Hub / category:** H1 = brand + specific promise (§2) → 1–3 sentences on what is listed → crawlable `<a href>` list of every child with a one-line description (§12) → pagination (§11). No article furniture.
- **About / team:** who runs the business, named people with roles → history and credentials with sources (§6) → links to author / team pages → contact route.

### Local business pages (gate: SP7=Y) [HEURISTIC unless tagged]
- Service pages: one per service with its own demand. Location pages: one per real location, or per served area where the business has distinct things to say (staff, projects, photos, reviews, access, local conditions).
- Doorway limit: Google's spam policies treat pages "created to rank for specific, similar search queries" as doorway abuse — for example city- or region-targeted pages that funnel users to one page, or near-identical pages standing in for a browseable hierarchy (spam policies, 2026-08-28; opened 2026-11-14). [SPEC] A page that differs from its siblings only by the place or service name is not created; an existing set is consolidated into the pages with distinct content + 301 (§10).
- Service-area business (serves customers at their locations; no customer-facing premises): no street address on the site; state the areas served in server HTML. Google Business Profile guidelines: a service-area business "should hide your business address from customers" (opened 2026-11-14). [SPEC] Site and profile agree (markup: §24 LocalBusiness).
- Profile consistency: business name, address, phone, hours and website URL on the Google Business Profile equal the site's (§25 NAP). The profile's website link points to the page for that location (home page for a single location). A mismatch found in an audit = finding; the profile edit itself is an owner item (`seo-owner-todo.md`) — off-site.
- Reviews on the site: real reviews with their source (platform, date) and a link to the profile; no star markup about the business itself (§24 LocalBusiness). [SPEC]
- Embedded map: lazy-load the iframe; the address also appears as text — a map carries no readable address.
- Hours, holiday hours, prices, service area: owner-supplied, provenance recorded (§0 EP-1).

---

## 8. Design / UX / Conversion

### Above the fold
- Primary CTA, form, or key takeaway visible immediately on page load.
- Big font for the headline answer / value proposition.
- No huge sliders, social media icons, or non-essential elements above the fold.
- Most users do not scroll — assume the answer must be here.
- Check at a phone viewport (390×844): the primary action (book, call, buy, get a quote) is a labelled button in the first screen on every template. An announcement bar or a "Click here" link is not a primary CTA. Flows hosted on a third-party platform (booking, ordering, gift cards) still need that button. [FIELD]

### CTA rules
- Fewer than 5 words.
- Specific about action ("Get pricing," "Start free trial," not "Contact us").
- Inspire urgency where honest ("Start your 14-day trial").
- Buttons over text links.
- Contrasting color against page palette.
- Don't overuse — one primary CTA per scroll viewport, not five.

### Engagement triggers
- Embed video where it adds value (boosts dwell time).
- Custom graphics over stock imagery.
- Pattern interrupts (callout boxes, pull quotes, mini-tools).
- Interactive elements (calculators, configurators, quizzes) where applicable.
- Target engagement rate >20% (GA4 metric).

### Trust + social proof
- Testimonials displayed prominently with names + photos + roles where possible.
- Aggregated star ratings near top of page.
  - Show the rating's source, count and date. Organization and local-business sites: own-site markup earns no review stars (§24 LocalBusiness). [SPEC]
- Trust badges, certifications, partner logos visible.
- "As featured in" press logos if applicable.
- About-page link visible from every page.

### Navigation
- Main header nav links to the core content hubs (the differentiator pages), not only About/Promise pages. [FIELD]

### Visual / functional clarity
- Clean layout — no ad clutter, no autoplay video with sound, no popup spam.
- Never manipulate browser history / the Back button — "back button hijacking" is a Google malicious-practices spam policy (2026-04-13). [SPEC]
- Bulleted lists and tables over wall-of-text prose.
- Consistent typography (max 2 fonts).
- Clear visual hierarchy.

---

## 9. URL Structure

```
/                                          # homepage
/products/                                 # catalog hub
/products/{slug}                           # product/service page
/products/category/{slug}                  # category hub
/topics/                                   # topic/entity hub
/topics/{slug}                             # canonical topic explainer
/learn/                                    # education hub
/learn/{category}/{slug}                   # use-case / how-to pages
/learn/guides/{slug}                       # pillar guides
/compare/{a}-vs-{b}                        # comparisons
/case-studies/{slug}                       # proof pages
/about/team/{slug}                         # Person profiles
/faq                                       # global FAQ
```

Rules:
- Subfolder depth ≤ 3-4 levels.
- Every page reachable in ≤3 clicks from homepage.
- Use breadcrumb navigation.

### Local / service-business patterns (gate: SP7=Y or service business) [HEURISTIC]
```
/services/                                 # service hub
/services/{service}                        # one page per service with its own demand
/locations/                                # location hub (multi-location)
/locations/{city-or-branch}                # one page per real location
/areas/{place}                             # served-area page — only with distinct local content (§7)
/pricing                                   # only if prices are published
/reviews                                   # optional; real reviews with source
/book   or   /contact                      # primary action
```
- No `/services/{service}-{city}` grid across every service × place unless each page has its own demand (§1 map) and distinct content (§7 doorway limit).

---

## 10. Canonicalization + Redirects + Status Codes

### Canonical tags
- Self-referencing canonical on every unique page: `<link rel="canonical" href="https://yoursite.com/exact-page-url">`.
- Use absolute URLs, not relative.
- Points to preferred URL when duplicates exist (URL params, syndicated content, print versions, AMP).
- Mismatched canonical (canonical ≠ accessed URL) confuses crawlers — only do it intentionally.
- Don't canonical-tag a paginated series back to page 1 (outdated Google advice; self-canonical instead).
- Canonical in the original HTML must equal the canonical after rendering; don't rely on JavaScript to set or change it (Google 2025-12-17). [SPEC] Google does read a JavaScript-injected canonical when the original HTML has none, but calls HTML "the best way"; with both present they must match and only one `rel="canonical"` may exist (JavaScript SEO basics, updated 2026-03-04; opened 2026-11-14). Handbook rule stays: set it in HTML. [SPEC]
- Canonical, internal links, sitemap `<loc>` and redirect targets all use the identical URL form: protocol, host, trailing slash, case. Strip tracking and duplicate-only parameters (`utm_*`, `gclid`, `fbclid`, `ref`, non-indexable sort/filter). Keep content-defining parameters: pagination (`?page=2`, self-canonical — §11), approved indexable facets (§11). Variant parameters: canonical per Product variant URLs below. Never strip a content-defining parameter to get a "clean" URL. [FIELD + SPEC]
- Pages hidden from Search: `noindex` (or Disallow — never both, §29) AND excluded from the sitemap. Only `noindex` (or authentication) keeps a URL out of results: Disallow stops crawling, and a Disallowed URL can still be indexed without a description when other pages link to it (Google robots.txt intro, 2025-12-10). [SPEC] Remove public links only to private, staff, unpublished or sensitive resources. Utility pages users need — cart, checkout, account entry, internal search, legal — stay linked: noindex/Disallow ≠ unnavigable. [FIELD]

### HTTP status codes
- `200 OK` — live page.
- `301 Moved Permanently` — permanent redirect; signals canonicalization to new URL; passes ~100% PageRank.
- `302 Found` — temporary redirect; both 301 and 302 pass equity (Google confirmed). Difference is indexation signaling: 302 keeps original URL indexed; long-running 302s eventually treated as 301s. For permanent moves use 301 to ensure correct indexation.
- `307 Temporary Redirect` / `308 Permanent Redirect` — HTTP/1.1 strict equivalents (preserve HTTP method). Google: permanent = 301, 308 (+ instant meta refresh); temporary = 302, 303, 307 — temporary redirects "Show the source page in search results". [SPEC]
- `404 Not Found` — page doesn't exist, may return.
- `410 Gone` — page permanently removed. Google handles 410 like 404 (all 4xx except 429 are treated the same; HTTP-status doc, fetched 2026-11-12) — not a faster-deindexing lever; choose 410 for intent clarity. [SPEC]
- `503 Service Unavailable` — temporary downtime, set `Retry-After` header.
- Non-200 responses may not be rendered by Google — JS-injected content on error/redirect pages is unreliable (2025-12-18). [SPEC]

### Redirect rules
- Maximum one hop. `A → B`, never `A → B → C → D`.
- Always 301 (permanent) for URL changes — passes equity. 308 is equally permanent for Google; never 302/307 for apex↔www, HTTP→HTTPS, trailing-slash or moved URLs. [FIELD + SPEC]
- Redirect to the closest relevant page. Never redirect removed URLs to the homepage or an unrelated page — Google commonly reports these as soft 404s (observed in GSC during field audits; long-standing Google statements; not in the current redirect doc as of 2026-11-11). [FIELD]
- Update internal links to the new URL; don't rely on redirects forever. Remove or update every internal link pointing to a redirected or retired URL. [FIELD]
- Junk URLs from a hacked or spam history: leave them 404/410. Never redirect them. [FIELD]
- After site migration, monitor GSC redirect errors for 90 days.
- Audit redirect chains with Screaming Frog quarterly.

### Soft 404s
- Empty/thin pages returning `200 OK` are flagged "Soft 404" in GSC.
- Either: add real content to make it valuable, OR return real `410 Gone` / `404 Not Found`.
- Unknown URLs return a real 404 status. SPA catch-all routes commonly return 200 for every path → soft 404s. `noindex` on the 404 template is harmless but never a substitute for the status code. [FIELD]
- 404 template: its own content. Never an existing live page served as the 404 body — the error response then carries that page's title and canonical. Stray thin pages returning 200 (empty bio, placeholder, a few words) are soft 404s: fill, redirect to the real page, or remove. [FIELD]

### Site migration (gate: existing site being rebuilt/migrated)
- Before launch, map every legacy URL to its new page with a one-hop permanent redirect. Sources: old sitemap, GSC Page indexing 404 list, GSC top landing pages, backlink-tool export. [FIELD]
- Keep evergreen archive content (results, past editions, maps, specs) on your own domain — never redirect it away or leave it only on third-party platforms. [FIELD]

### Retired items (discontinued events, products, services)
- Item with search demand or inbound links: keep a page stating it is no longer offered, linking to similar current items. Preferred: keep the item's own URL live (200) with that content. [FIELD]
- ⚠ CONFLICT (field, 2026-11-11): field practice 301'd old item URLs to one shared "no longer offered" page. A single generic destination for many unrelated URLs risks the same soft-404 treatment as homepage redirects. Resolution: per-item page, or 301 to the closest equivalent current item; use a shared page only for near-identical items; watch GSC soft 404s after shipping. [FIELD + HEURISTIC]
- No demand and no links → 410. Product variants: see §28 Product lifecycle.

### Product variant URLs (gate: SP2=Y)
- Decide and record per product type before canonical/schema/feed work: variants share one page (single-page ProductGroup) or have their own pages (multi-page). [SPEC]
- Each variant is directly selectable by a distinct URL (query parameter or path) that preselects the right image, price and availability and adds that variant to the cart. Google: "The site must have the ability to preselect each variant directly with a distinct URL" (product-variants doc, 2026-09-08). [SPEC]
- Single-page: one canonical for the whole group — "Typically this is the base URL that leads to a page without a variant pre-selected". [SPEC] Multi-page: no group canonical (Google); each variant page self-canonical. [HEURISTIC]
- Markup: `ProductGroup` with `productGroupID`, `variesBy`, `hasVariant` (or variant `Product` + `isVariantOf` / `inProductGroupWithID`); unique ID per variant (§24). [SPEC]
- Test every feed-linked variant URL (Mode 1 + Mode 2): selected options, visible price/availability, `Offer`, add-to-cart item and feed row agree; selection survives reload and direct entry. [FIELD + SPEC]

---

## 11. Pagination + Faceted Navigation + Internal Search

### Pagination (paged archives, blog, comments)
- Self-canonical on each paginated page (page 2 canonicals to page 2, NOT to page 1).
- `rel="next"` and `rel="prev"` for browser/UX hints (Google deprecated March 2019; Bing still uses as hints per Frédéric Dubut).
- Provide "View All" page if content is finite and small.
- Don't `noindex` paginated pages — risks orphaning linked content.
- Each paginated URL must be unique, crawlable (in `<a href>`), and return 200; out-of-bounds pages return 404.

### Infinite scroll / load-more handling
- Google does not scroll or click buttons. JS-only infinite scroll = crawler sees only first batch.
- Required pattern: paginated series URLs mirror the infinite scroll (per Google's official guidance, 2014, still current 2025).
- Include standard `<a href="?page=2">` links in initial HTML, visible to users — e.g. a "Load more" or "Next page" control that is a real `<a href>` progressively enhanced by JS. Google: crawlers "don't 'click' buttons" and generally crawl URLs "found in the `href` attribute of `<a>` elements" (pagination doc, 2025-12-10). [SPEC] Never hide pagination links with sr-only: they exist for crawlers, not screen-reader users, and focusable invisible links fail WCAG 2.4.7 Focus Visible. The sr-only utility below is only for screen-reader text that improves that experience (Google: not hidden-text abuse):
  ```css
  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  ```
- Never hide content or links meant for search (`display:none`, `visibility:hidden`, off-screen, sr-only, `<noscript>`-only): content hidden "solely to manipulate search engines" violates Google's hidden-text policy; user-revealable UI (accordions, tabs, tooltips) is fine (spam policies, 2026-08-28). [SPEC]
- Each component page = unique URL, self-canonical, indexable, 200 OK.
- "Load More" buttons must update browser URL via History API or have crawlable fallback link.

### Faceted navigation / URL parameters
- Filter combos: `?color=red&size=large&sort=price-asc`.
- Crawler-blockable approaches:
  - `robots.txt` block of low-value parameter patterns.
  - `rel="canonical"` to the unfaceted/base URL.
  - `noindex,follow` (NOT `noindex,nofollow` — preserve link equity).
- Don't block ALL parameters indiscriminately — UTM, gclid, fbclid are tracking, not content variants.
- Limit indexable facet combos to high-intent commercial facets only.

### Internal search
- Internal search result pages are thin/duplicate content; low-value search pages harm overall site quality assessment.
- Choose ONE approach, never both:
  - **Block crawl:** `Disallow: /search?` in robots.txt. Page never crawled. (Note: page can still appear in index via external links without snippet.)
  - **Allow crawl + noindex:** `noindex,follow` meta tag. Page crawled, sees the directive, gets deindexed.
- Anti-pattern: blocking in robots.txt + adding noindex. Crawler can't see the noindex if blocked.

---

## 12. Internal Linking

- Hub-and-spoke. Pillar pages link to 5-10 entity/topic pages + 3-5 conversion pages.
- Entity pages link back to pillars + relevant conversion pages.
- Conversion pages link to constituent entity pages.
- Important pages receive 5+ unique internal links from related content.
- Reverse silo: supporting content links to core commercial/conversion pages.
- No orphan pages.
- Every detail page is linked from a crawlable, server-rendered HTML index/hub page — not reachable only via search, filters or JS. [FIELD]
- No links from public nav, footer or content to admin/staff, unpublished or private resources. Utility pages users need (cart, checkout, account, internal search, legal) stay linked even when noindex/Disallowed (§10). [FIELD]

### Internal anchor text
- Descriptive and relevant. Banned: "click here," "learn more," "read more."
- Diversity required for UX clarity, not penalty avoidance. Don't use the same exact-match anchor on every link to a page.
- Mix of: exact match, partial match, branded, naked URL, generic.
- Google has confirmed no internal linking over-optimization penalty exists. The 5-10% exact-match safe threshold applies to EXTERNAL backlink profiles (Penguin algorithm), not internal anchors. Vary for clarity, not protection.
- Place links inside relevant content near primary keyword.

### Outbound links
- Link to authoritative sources when citing stats, studies, or concepts.
- Use `rel="nofollow"` for untrusted or paid links.
- Use `rel="sponsored"` for affiliate/paid links (FTC + Google guideline).
- Use `rel="ugc"` for user-generated content links.
- Never link to spammy or low-quality domains.
- Links opening a new tab (`target="_blank"`): `rel="noopener"` (modern browsers imply it). Add `noreferrer` only to strip the referrer deliberately — it also hides your referral from the destination's analytics. [FIELD + HEURISTIC]
- Outbound link status: fetch each outbound link with a browser user agent and one bot user agent. Browser 4xx/5xx = broken link → fix or remove. Bot-only 403 = third-party bot blocking: record it (crawlers and AI agents cannot follow that link); not a site defect. Link to the final destination, not a URL that redirects. Check conversion-critical third-party flows first (booking, ordering, gift cards, checkout). Field test: gift-card link → browsers 302 → 200; GPTBot, Googlebot and SemrushBot user agents → 403. [FIELD]

---

## 13. Hreflang (International Variants)

Required when serving distinct content per language/region. Skip if single-locale.

### Implementation
- Format: `<link rel="alternate" hreflang="LANG-COUNTRY" href="URL" />`.
- Common values: `en-US`, `en-GB`, `en-CA`, `en-AU`, `fr-FR`, `fr-CA`, `de-DE`, `es-ES`, `es-MX`.
- `x-default` for fallback when no language/region matches.
- Hreflang must be **symmetric**: page A references B, B references back to A.
- Self-reference required: page must reference its own hreflang.

### Example (head of every page)
```html
<link rel="alternate" hreflang="en-US" href="https://yoursite.com/us/page" />
<link rel="alternate" hreflang="en-GB" href="https://yoursite.com/uk/page" />
<link rel="alternate" hreflang="fr-FR" href="https://yoursite.com/fr/page" />
<link rel="alternate" hreflang="x-default" href="https://yoursite.com/us/page" />
```

### Alternative: hreflang in XML sitemap
- Cleaner for large sites — avoids cluttering every page's head.
- Use `<xhtml:link>` elements within `<url>` entries in sitemap.

### Currency / locale display
- Show price banner: "Shipping to UK? View prices in GBP →"
- Soft geo notices acceptable: inline banner/modal prompting user to switch locale. Does not redirect. Bots receive same HTML.
- Don't auto-redirect crawlers by IP. Google crawls primarily from US; auto-redirects mean Google never sees non-US versions. Allow all crawlers full access to all localized URLs.
- Let user choose locale; persist choice in cookie.

### Locale selector page pattern
- Crawlable `/locale/`, `/country/`, or `/region/` selector page listing every market with link to each.
- All selector links in HTML `<a href>` (server-rendered), NOT JS-only — bots can't click JS buttons.
- Map selector page to `x-default` hreflang so unmatched languages resolve here.
- Each link maps 1:1 to a locale URL that has full hreflang reciprocity.

### Machine-readable geo / fulfillment data
- Store locator, delivery coverage, shipping zones: expose as visible HTML (lists, tables) or structured data (`Place`, `PostalAddress`, `LocalBusiness.areaServed`).
- Never lock this data behind interactive map JS without HTML fallback.

---

## 14. Technical Setup

### Rendering
- HTML-first. SSR or SSG if using React/Next/Vue/Svelte/Angular/etc.
- Major AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta-ExternalAgent, Bytespider) executed no JavaScript in the Vercel+MERJ analysis of 500M+ crawl events (2024 data; vendor study). [STUDY] Treat as directional, re-verify per vendor; Claude-SearchBot and user-driven agentic browsers (e.g. in-browser agents) are outside that sample. Design as if AI fetchers read raw HTML only.
- 2026 corroboration from one site: a 30-day news-site server log (to 2026-09-24) recorded no script fetches during page loads by ChatGPT-User (37,045 page requests), Claude-User (10,028), PerplexityBot (3,193), ClaudeBot (915) or GPTBot (37). MistralAI-User, DuckAssistBot and YouBot did fetch scripts, so "raw HTML only" is not universal across assistant fetchers (§39 F-18). Limits: user agents not IP-verified; vendor author; a fetched script is not proof of execution (Forge AI Bot Log, 2026-09-24; opened 2026-11-14). [STUDY] Design rule unchanged.
- Never ship `noindex` in the original HTML expecting JavaScript to remove it — Google: a page that should be indexed must not carry a `noindex` tag in its original page code; when Google meets `noindex` it may skip rendering and JavaScript execution (JavaScript SEO basics, 2025-12-15). [SPEC]
- Googlebot fully renders JavaScript (via Web Rendering Service / headless Chromium); Applebot may also render pages in a browser (Apple doc, 2026-09-04) [SPEC]; Bingbot has partial rendering.
- Content rendered client-side, fetched via JS, or hydrated post-load is INVISIBLE to AI crawlers.
- Content behind tabs/accordions/`display:none` toggled by JS is invisible to AI crawlers unless server-rendered into initial HTML.
- Use native `<details>`/`<summary>` instead of JS accordions.
- Test: `curl -A "GPTBot" https://yoursite.com/page` — output must contain the actual content, not just shell HTML.
- Core content in server HTML: listings, calendars, team bios, prices, key facts. Nothing important appears only after JavaScript runs. [FIELD]
- One instance of each fact in the HTML. Builder widgets and responsive layouts often emit the same text twice (desktop + mobile copies; a menu block printing each price above and below the item) with one copy hidden by CSS; raw-HTML extractors read both. Flag a template when raw-HTML visible text exceeds rendered visible text by more than ~20%. [FIELD + HEURISTIC]
- Pages that depend on an API/backend keep a static fallback (build-time snapshot or cache) so the HTML still carries content when the backend is paused, sleeping (free-tier databases) or down. [FIELD]
- Empty, loading and error states are JS-injected markup only. Never ship them as static page copy: text extractors and AI crawlers read "Loading team…", "No events found" or "Connection error — check your environment variables" as the page's content, and a server-side config hint leaks. Test: raw HTML contains none of these strings. [FIELD]
  - Freshness: record snapshot time + a max age per data class (event status, bookability, price, availability, stock). Past max age → do not present those facts as current: show the stable content with a visible "availability unconfirmed — updated <time>" notice, disable booking/purchase actions, omit stale `offers` / `eventStatus` / `availability` from structured data. No reliable content at all → 503 + `Retry-After` (§10), never an empty or fabricated 200. [FIELD + HEURISTIC]
- Never server-render primary content at `opacity:0` waiting for an animation library (Framer Motion `initial`, GSAP from-states, scroll-reveal). Screenshots, checkers and no-JS users see blank content, and elements are not LCP candidates until painted. Animate from a visible state, or animate only decorative/below-the-fold elements. [FIELD + HEURISTIC]
  - If kept: add a no-JS reveal, e.g. `<noscript><style>[data-animate]{opacity:1!important;transform:none!important}</style></noscript>`. This reveals content already in the HTML — it is not the cloaking pattern in §11 (content placed only inside `<noscript>`). [FIELD]

### AI-critical block visibility rule
- Pricing, plans, feature lists, definitions, FAQ answers, comparison tables, contact info must be in initial HTML on first paint.
- Never hide these behind login walls, fetch-on-open "Show more" modals, or personalized-after-load gates if AI summarization is a goal. Accordions and tabs are acceptable when the complete content is in the initial HTML and reachable through normal controls; native `<details>` preferred (§0 Hidden content).
- Do not duplicate the same content elsewhere solely for crawlers. Fetch-on-open content needs an HTML-first implementation (content in the initial HTML), not an SEO-only mirror.

### HTTPS / SSL
- Lightweight direct ranking factor (Google 2014; affects <1% of queries directly). Non-HTTPS still indexes but browsers display "Not Secure" warning that hurts CTR + conversion.
- Treat as required for any modern site.
- Verify "Secure" status across all pages.
- No mixed content (HTTP assets on HTTPS pages).

### Security headers
- `Strict-Transport-Security: max-age=31536000` (HSTS, forces HTTPS for return visitors). Host-only default. New domain or migration in progress: start `max-age=300`; raise after HTTPS is verified on key routes. Add `includeSubDomains` only after every public, delegated and internal subdomain serves HTTPS — it blocks HTTP-only subdomains for returning browsers. Add `preload` and submit to hstspreload.org only with owner approval: it requires `includeSubDomains` + `max-age` ≥ 31536000 and cannot easily be undone. [SPEC: hstspreload.org, MDN; opened 2026-11-12; staged start = HEURISTIC]
- `Content-Security-Policy` (CSP, prevents XSS).
  - Roll out in report-only first: send the intended policy as `Content-Security-Policy-Report-Only`; load every template with consent denied and with consent granted; list the blocked origins (analytics, tag manager, fonts, maps, video, booking and payment widgets); allow only those; then switch to the enforcing header. [HEURISTIC]
  - Inline scripts and styles: nonce or hash. A final policy with script `'unsafe-inline'` and no nonce / hash, or one that allows every origin (`default-src *`), is a presence-only pass → finding (same value-over-presence rule as HSTS below). [HEURISTIC]
  - Record the state per host: enforcing / report-only / absent, plus the directives. Hosted builder without header control → LIMITED with evidence (EP-1).
  - Never ship an enforcing policy untested: a wrong CSP blocks analytics, consent, fonts and embeds. Severity S4.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` to control browser feature access.
- Clickjacking: CSP `frame-ancestors` (modern); `X-Frame-Options: DENY|SAMEORIGIN` for legacy browsers. [FIELD]
- Test with securityheaders.com.
- Read header values, not presence: `Strict-Transport-Security: max-age=0` disables HSTS, yet checkers report "HSTS present". On a hosted builder, inspect the platform's SSL/HSTS setting before recording a platform limit (EP-1). [FIELD]
- Security headers are not a documented Google ranking signal; treat as security/quality hygiene, not SEO lift. [HEURISTIC]

### DOM
- DOM size: Lighthouse 13+ (2025-10-10) reports it via the "Optimize DOM size" insight (replaced the `dom-size` audit; no scoring change; no published node/depth threshold). Treat as a diagnostic, not a node-count rule. [HEURISTIC] (former wording: "Depth under 1,500 nodes")
- Semantic HTML5: `<section>`, `<article>`, `<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`.
- Wrap key terms in `<strong>`.
- Semantic lists: `<ol>`, `<ul>`, `<dl>`.
- Price lists, service menus, hours and spec sheets: `<table>` (with `<th>`) or `<ul>` / `<dl>` — never a grid of `<div>`s. Builder "menu" or "pricing" blocks often emit divs only (field test: services page with 0 tables or lists; semantic tags 2% of main-content elements; each price printed twice). If the block cannot be changed, rebuild that content in a text or code block. [FIELD]
- Tables with `<thead>`, `<tbody>`, `<th>`, `<td>`.

### Core Web Vitals
- LCP ≤ 2.5s (same threshold on mobile and desktop).
- INP ≤ 200ms (replaced FID on March 12, 2024; FID deprecated).
- INP needs real interactions. No CrUX data → record lab proxies as proxies, never as INP: Total Blocking Time from the same PageSpeed Insights lab run — Lighthouse mobile bands 0–200 ms fast, 200–600 ms moderate, over 600 ms slow; web.dev calls TBT a reasonable lab proxy that is "not a substitute for INP" (Chrome Lighthouse TBT doc; web.dev TBT + INP articles; opened 2026-11-14) [SPEC] — plus a manual check of the primary controls (menu, form, filter, add-to-cart) in the Chrome DevTools Performance panel: interactions over 200 ms are findings. [HEURISTIC]
- TBT over 600 ms in PageSpeed Insights = finding, same class as a CWV fail; 200–600 ms = review item. TBT depends on host CPU: PageSpeed Insights runs only (§0 Lab environment). Usual causes: third-party scripts, hydration of large component trees, long event handlers (Code optimization below). [HEURISTIC]
- CLS ≤ 0.1.
- TTFB: not a Core Web Vital. web.dev guidance: ≤ 800 ms at p75 as an LCP diagnostic. [SPEC] (former wording: "TTFB < 500ms")
- All CWV thresholds evaluated at 75th percentile of real-user field data (CrUX dataset), not lab tests.
- Monitor via GSC Core Web Vitals report + PageSpeed Insights. Review mobile and desktop separately. [FIELD]
- Lab-test CLS on every page template, not only the homepage. Field data (CrUX/GSC) surfaces issues lab runs miss. Treat Lighthouse scores as directional; confirm with CrUX. [FIELD]
- Lab environment and missing field data: §0 Verification rules (Lab environment). The PageSpeed Insights API without a key shares a daily quota (HTTP 429 when exhausted): use an API key or Lighthouse CLI, and record which. [FIELD]

### Cookie consent + CWV interaction
- Cookie banner must NOT block content rendering — counts against LCP.
- Use bottom banner instead of full-screen modal.
- Don't fire CMP scripts render-blocking.
- Pre-consent: only essential cookies (functional, security).
- Post-consent: fire analytics, ads, marketing.
- Where no consent regime applies (confirm per audience and jurisdiction), analytics may load after load/interaction; consent gates loading wherever it is required.
- Use Google Consent Mode v2 if running Google Ads/Analytics in EU.

### Mobile
- Responsive design (no separate mobile URLs).
- Viewport meta: `<meta name="viewport" content="width=device-width, initial-scale=1">` — Chrome's Lighthouse doc: include both key-value pairs (opened 2026-11-13). [SPEC] `initial-scale=1` without `width=device-width` rendered responsively and passed Lighthouse 12's viewport audit in the field test, but 4 of 5 checkers flagged it: fix where the template allows; severity S4. [FIELD]
- Content parity across mobile + desktop.
- Clickable phone numbers (`tel:` links).
- Tap targets: WCAG 2.2 SC 2.5.8 (Level AA): at least 24×24 CSS px unless an exception applies — spacing (24 px circles don't overlap), equivalent control elsewhere, inline (in a sentence or constrained by text line-height), user-agent-controlled, or essential [SPEC; W3C, opened 2026-11-12]. Do not force inline text links into 24×24 boxes. 48×48 px is platform guidance (Google/Material, Lighthouse) [HEURISTIC]. Adequate spacing either way.
- Test via Lighthouse / PageSpeed Insights. (GSC Mobile Usability report, Mobile-Friendly Test and its API were retired 2023-12-01 — see §38.)

### Code optimization
- Minify HTML, CSS, JS.
- Leverage browser caching (`Cache-Control` headers).
- Use a CDN (HTTP/2 + HTTP/3 multiplexing handled by CDN automatically).
- Optimize server response times.
- Host fonts locally where possible; use system / web-safe fonts otherwise.
- Eliminate render-blocking JavaScript.
- Defer non-critical JS with `defer` or `async`.
- Authorize analytics and ad pixels first (consent where legally required; SP6 review), then load them after load or first interaction — usually the largest main-thread cost. Load, scroll, interaction and delay are performance triggers, never substitutes for consent or sensitive-data authorization. Verify pre-consent network requests, not only cookie state. Audit third-party script weight per template. [FIELD]
- Code-split the main bundle; lazy-load animation libraries. [FIELD]
- Hashed static assets: long `Cache-Control` max-age + `immutable`. HTML: `no-cache` / must-revalidate. [FIELD]
- Preload fonts that block rendering. [FIELD]

### Deployment build chain
Platform-level `buildCommand` settings (Vercel, Netlify, Cloudflare Pages, Render, etc.) can silently bypass the project's full `npm run build` sequence and skip postbuild scripts. Postbuild scripts are typically what generate sitemap.xml, llms.txt, llms-full.txt, .md mirrors, IndexNow ping, and updated robots.txt — so a missing buildCommand is a silent SEO/GEO failure.

- Bug pattern: `"buildCommand": "vite build"` in `vercel.json` runs the bundler but not `npm run build`'s full chain (no postbuild).
- Fix: set platform `buildCommand` to `npm run build` (or the project's full build entrypoint), not the bundler step alone.
- Verify after every deploy: sitemap.xml, robots.txt (and llms.txt if the §20 gate applies) all served at expected URLs with current content; `/robots.txt` must return HTTP 200 (5xx pauses Google crawling for 12 h; 4xx drops every Disallow — §18). If any are missing or stale, buildCommand is bypassing the chain.

### Legacy AMP (gate: existing AMP implementation)
- Since 2026-07-01 Google Search sends users directly to the publisher-hosted AMP page; Google AMP Cache and Signed Exchanges are no longer needed for Search. Audit whether AMP still earns its maintenance cost. [SPEC]

### Accessibility
- WCAG 2.2 AA.
- Alt text on every image.
- Color contrast ≥ 4.5:1 for normal text, 3:1 for large text.
- Keyboard navigability.
- Logical heading hierarchy.
- Descriptive link text (no "click here").
- Audit via Lighthouse.
- Large text = ≥24 CSS px regular or ≥18.66 CSS px bold (WCAG 18pt / 14pt bold) → 3:1; everything else 4.5:1. Check brand accent colors used on small text. [SPEC + FIELD]
- Run an axe-core scan after scrolling the full page — Lighthouse misses elements inside scroll-triggered animations. [FIELD]
- Visible button/link text is included in the accessible name; never override it with a different `aria-label` (WCAG 2.5.3 Label in Name). [SPEC]
- Every form and search input has a `<label>`, not placeholder-only. [SPEC + FIELD]
- Skip link: first focusable element jumps to `<main>` ("Skip to content"), visible on focus. WCAG 2.4.1 Bypass Blocks (Level A) is also met by landmarks or headings (W3C Understanding doc, opened 2026-11-13) [SPEC]; add the link anyway — it serves sighted keyboard users and checkers flag its absence. [HEURISTIC]
- Icon-only links and buttons (social icons, search, carousel arrows, menu toggles) have an accessible name (`aria-label` or visually hidden text). [SPEC: WCAG 4.1.2 / 2.4.4 — not re-opened 2026-11-13] [FIELD]
- Horizontally scrollable tables/regions: `tabindex="0"`, `role="region"`, `aria-label`. [FIELD]
- Multiple `<nav>` elements each get a distinct label. [FIELD]
- Respect `prefers-reduced-motion` (e.g. Framer Motion `<MotionConfig reducedMotion="user">`). [FIELD]
- Accessibility fixes also lift the Lighthouse score and help AI agents that read the accessibility tree (§33).

---

## 15. Image + Media Rules

### Images
- Alt text on every image (descriptive, not keyword-stuffed).
- WebP or AVIF format. Convert legacy JPG/PNG.
- Compress (target <100KB per image where possible).
- Lazy-load below-the-fold media (`loading="lazy"`). Never lazy-load the LCP / above-the-fold image — web.dev names lazy-loading in-viewport images a pattern to avoid. [SPEC]
- Custom visuals over stock photography.
- Filename describes the image: `blue-leather-armchair-side-view.webp` not `IMG_2847.jpg`.
- Image dimensions specified in HTML to prevent CLS — every `<img>` has `width`/`height` or a CSS `aspect-ratio`. [FIELD]
- Hero/LCP image: `loading="eager"`, `fetchpriority="high"`, `srcset`. All other images WebP/AVIF with dimensions set. [FIELD]
- Alt text names the people and the brand where relevant (genuine context, not stuffing — §25). [FIELD]
- `alt=""` only on decorative images. Empty alt on a content image (staff headshot, product, award badge, linked logo) = missing; alt is never a filename (`Bestof_Winner_2025.png`). Checkers count absent `alt` attributes and pass `alt=""`: audit empty alt on content images separately (field test: 22 of 24 staff photos had `alt=""`; checkers reported 2 images). [FIELD]
- Hero/LCP image is a real `<img src>` (or preloaded) in the initial HTML. A `data-src` swapped in by a JS lazy-loader, or a slide inside a JS carousel, makes LCP wait for script (field test: lab LCP 36–45 s on a slider hero). Prefer one static hero image. [FIELD]
- Photos as JPEG/WebP/AVIF sized to their display dimensions; PNG only for flat graphics or transparency (field test: PNG photos, 5–9 MB home page). [FIELD]

### Responsive image serving (LCP-critical)
- Use `srcset` + `sizes` for resolution switching.
- Page weight: record total transfer size per template. Multi-MB photo collages, a PNG used as a photo, or originals scaled down by CSS are defects — resize to about 2× the largest display size, serve WebP/AVIF, set width/height. Field test: two pages of 47 and 53 MB; Lighthouse estimated 42–45 MB of savings from responsive images. [FIELD]
- Use `<picture>` element when serving different images per breakpoint (art direction).
- Use CDN with on-the-fly image optimization (Cloudinary, Cloudflare Images, Vercel Image Optimization, imgix).

```html
<img 
  src="image-800w.webp"
  srcset="image-400w.webp 400w, image-800w.webp 800w, image-1200w.webp 1200w"
  sizes="(max-width: 600px) 100vw, 800px"
  alt="Descriptive alt text"
  width="800"
  height="600"
  loading="eager"
  fetchpriority="high"
/>
<!-- Example is the LCP (above-the-fold) image: loading="eager" (default) + fetchpriority="high". Use loading="lazy" only below the fold. -->
```

### Hero / background video (gate: site uses autoplay hero or background video) [FIELD]
- Poster image always set — it is often the LCP element; optimize it like a hero image.
- Visible pause control. WCAG 2.2.2 (Pause, Stop, Hide, Level A): auto-moving content lasting >5 s needs a pause mechanism. [SPEC]
- `prefers-reduced-motion: reduce` → show the poster, no autoplay.
- Separate encodes per device size, with a file-size cap per encode; `muted playsinline`; `preload="none"` or `"metadata"`.

### Video on-page
- Publish a full transcript as visible page text — critical for AI ingestion + accessibility.
- Captions/subtitles via WebVTT file.
- Self-hosted (`<video>` tag) gives you full control + better SEO; YouTube embed gives YouTube the SEO credit. [UNVERIFIED as of 2026-11-01] (Google video-indexing requirements and YouTube's AI-citation share not re-verified.)
- `loading="lazy"` for below-fold video embeds.
- Always specify dimensions to prevent CLS.
- Use VideoObject schema (see §24). `creator` / `author` supported since 2026-09-24; re-validate against the current video structured-data doc. [SPEC]
- Thumbnail with descriptive alt text. Declare the same preferred image in schema.org `image` and `og:image` (Google thumbnail sources, 2026-03-02). [SPEC]

```html
<video controls preload="none" width="800" height="450" poster="thumbnail.webp">
  <source src="video.mp4" type="video/mp4">
  <source src="video.webm" type="video/webm">
  <track kind="captions" src="captions.vtt" srclang="en" label="English">
</video>
```

---

## 16. Featured Snippets + People Also Ask (PAA) Targeting

### Snippet types + on-page patterns

**Definition snippet (40-60 words, 1-2 sentences):**
- Format: Question H2 → 40-60 word direct answer immediately below.
- Use exact-match query phrase early in answer.
- Pattern: "[Term] is [definition]. [Supporting context]."

**List snippet (5-8 items):**
- Real `<ol>` for ordered/sequential, `<ul>` for unordered.
- Each item starts with imperative verb (for how-to) or noun (for inventories).
- 1-2 lines per item.

**Table snippet:**
- Real HTML `<table>` with `<thead>` + `<tbody>` + `<th>`.
- Comparison data, specs, pricing tiers, schedules.

**Video snippet:**
- VideoObject schema with `transcript` property recommended for AI ingestion; not required by Google for rich results.
- Timestamps in `description` help Google extract clip segments.

### PAA (People Also Ask) targeting
- Anticipate follow-up questions; structure as FAQ block.
- Each question = full sentence, capitalized like a sentence, ending with `?`.
- Each answer = self-contained, 40-60 words. [HEURISTIC]
- FAQPage schema optional (Google FAQ rich results retired 2026-05-07; see §24).
- Mine real PAA queries from SERP for your target keywords.

### AI Overviews + AI Mode optimization

AI Overviews differ from Featured Snippets: they synthesize multi-source content into one answer rather than extracting from a single page. Optimization patterns:

- **Self-contained extractable blocks.** Every H2/H3 + paragraph must answer a discrete question and make sense without surrounding context. AI extracts blocks, not pages.
- **Lead with the answer.** First 1-2 sentences under each heading = direct answer in plain prose. Supporting detail follows.
- **Question-as-heading.** H2/H3 phrased as the exact query a user would type. Examples: "What is X?", "How does Y work?", "When should you use Z?".
- **Answer capsules.** Short, direct answers aid extraction and readability [HEURISTIC]; no length threshold is documented for AI eligibility — Google (2026-05-15): no requirement to break content into tiny pieces; "chunking" can be ignored for Google Search. [SPEC]
- **Multi-source friendliness.** Include time qualifiers ("as of 2026", "since the 2024 update"), explicit numerical specificity, and named sources for claims. AI Overviews favor content easy to corroborate against other sources.
- **Query fan-out coverage.** Google documents fan-out as "a set of concurrent, related queries generated by the model to request more information" — no sub-query count is published. AI Overviews' default model is Gemini 3 (since 2026-01-27); the AI Mode model version is not stated by Google. Address adjacent questions on the same page or via tightly linked cluster pages. [SPEC]
- **How Google AI features retrieve.** AI Overviews / AI Mode use retrieval over Google's core ranking systems plus query fan-out; optimize with standard SEO and non-commodity content. Google (2026-05-15): ignore "chunking", unnecessary AI text files (llms.txt), special markup or Markdown for Google, and "inauthentic mentions". [SPEC]
- **BlockRank algorithm (UT Austin + Google + Google DeepMind, arXiv 2510.05396, Oct 2025).** Research paper; production use in AI Overviews is not confirmed by any Google Search document. [STUDY] Enables semantic ranking at scale, evaluates more candidate sources; rewards clear semantic structure + topical depth — directional only.
- **Structured data.** Not required for Google generative AI features; "there's no special schema.org markup you need to add" (2026-05-15). FAQ and HowTo rich results are retired. Keep structured data for rich-result eligibility and entity clarity; correlation claims between FAQPage/HowTo/Article/Person markup and AI citation are unverified. [SPEC]
- **Currency.** AI Overviews favor freshly updated content; visible `Last Updated` dates help.
- **Eligibility.** A page must be indexed and eligible to appear in Google Search with a snippet, and the property must be Included in Search generative AI features (Search Console control). Google does not state a ranking-position precondition. AI features are layered on regular Search, not a separate index. (2026-05-15) [SPEC]
- **Measurement.** GSC Performance → Generative AI report (Search; separate Discover report): impressions only, launched 2026-06-03, global 2026-08-31. [SPEC] Citation effect on clicks: Seer Interactive v3 (53 brands, 5.47M queries, Jan 2025–Feb 2026): informational queries 2025 average organic CTR 2.07% when cited in the AIO vs 0.94% uncited vs 3.35% with no AIO; AIO-query CTR 1.31% (Dec 2025) → 2.36% (Feb 2026). AIO appears on 36% of informational, 8% of commercial, 5% of transactional queries; 95.4% of "X vs Y" comparisons. [STUDY: single-source, vendor, correlational]

### AI-feature controls (Google + Bing) — decide and record
- `nosnippet` (robots meta / X-Robots-Tag): applies to all result forms incl. AI Overviews and AI Mode; prevents use as direct input to them. `max-snippet:[n]` limits how much may be used as direct input, except where a publisher has separately granted permission for use of content (e.g. a licensing deal); `nosnippet` states no such exception. (Google robots meta doc, 2026-03-24; opened 2026-11-14) [SPEC]
- `data-nosnippet` on HTML elements: excludes marked text from snippets; listed by Google among Search generative AI controls (2026-10-21); supported by Bing since 2025-10-15. [SPEC]
- GSC Settings → **Search generative AI** control (property-level): Exclude removes the site's links AND grounding use from AI Overviews, AI Mode and generative features in Discover; default Include; child properties inherit; takes effect within ~1–2 days; "isn't used as a ranking or inclusion signal affecting other parts of Search"; excluded sites get no AI-feature impressions or traffic. Launched 2026-06-03 (UK subset), all properties worldwide 2026-08-31. [SPEC]
- `Google-Extended` (robots.txt) governs Gemini training and grounding only — it does NOT remove pages from AI Overviews / AI Mode (Google crawler doc 2026-10-30; see §18). [SPEC]
- Decision rule: default Include; do not Exclude without baseline Generative AI report data; record the choice in the Site Profile handoff.

### Per-engine facts (documented only)
Rows restate what this handbook verifies elsewhere. "—" = no vendor document found, not "no effect".

| Surface | Inclusion path | Site-side control | First-party measurement |
|---|---|---|---|
| Google AI Overviews / AI Mode | Google Search index; page indexed + snippet-eligible (Eligibility above) | GSC Search generative AI control; `nosnippet`, `max-snippet`, `data-nosnippet` | GSC Generative AI report (impressions only) |
| Gemini app / Vertex AI grounding | Google crawling; `Google-Extended` governs training + grounding (§18) | robots.txt `Google-Extended` | — |
| Microsoft Copilot / Bing AI answers | Bing index (Bingbot); IndexNow (§26) | `data-nosnippet` (Bing, since 2025-10-15) | Bing Webmaster Tools AI Performance (citations) |
| ChatGPT search | `OAI-SearchBot` (OpenAI bots doc) + third-party search providers — OpenAI Help names Bing; wording differed between two retrievals on 2026-11-14 (§39 F-19) | robots.txt `OAI-SearchBot` | — (GA4 referrals only) |
| Perplexity | `PerplexityBot` | robots.txt | — |
| Claude | `Claude-SearchBot` | robots.txt | — |
| Meta AI | `Meta-WebIndexer` | robots.txt / allow-list | — |
| Apple (Siri, Spotlight, Safari) | `Applebot` | robots.txt | — |
| Amazon (Alexa and other products) | `Amzn-SearchBot` | robots.txt | — |
| Mistral | `MistralAI-Index` | not stated (§18) | — |
| DuckDuckGo AI answers | `DuckAssistBot` (real-time) | robots.txt (applies after 72 h) | — |

- No vendor document found (as of 2026-11-14) for: how sources are chosen or ordered, freshness weighting, use of structured data, effect of answer-first formatting. Rules in §3, §4 and §16 that target these are [HEURISTIC] outside Google.
- Documented to matter for every engine: crawl access (§18), content in server HTML (§14), accurate and consistent facts (§6). Do these first.
- Where an answer cites third-party pages about the brand, the lever is off-site → `seo-followups.md`.

---

## 17. Crawlability + Indexation Validation

- Verify no accidental `noindex` tags on production pages.
- Audit `robots.txt` for accidental blocking of important paths.
- No hidden algorithmic pages allowed in crawl.
- Crawl-test with Screaming Frog before launch.
- Check GSC **Page indexing** report (formerly Index Coverage) regularly for crawl errors.
- After fixing an issue flagged in a GSC report (Enhancements, Page indexing), click **Validate Fix** in that report. [FIELD]
- Before launch, compare raw HTML (curl, JavaScript off) against the rendered DOM for every template (§17 Dual-mode). [FIELD]
- Use GSC URL Inspection to confirm specific pages are indexed correctly ("View crawled page" for indexed state; "Test live URL" → "View tested page" for rendered screenshot, HTML, console).
- Original HTML must not contain `noindex` when indexing is intended; canonical must be identical in original and rendered HTML (Google 2025-12-15/17). Verify in Mode 1. [SPEC]
- SP5=Y: decide whether user-created / link-shared pages belong in Search; block indexing of link-shared content you don't want indexed and monitor abuse in Search Console (Google UGC-spam guidance 2026-10-26). UGC Fresh Data Program (doc 2026-10-08): assess eligibility separately. [SPEC]

### Cross-consistency check (run after any domain / canonical / sitemap change)
- Within one site: host in `sitemap.xml` `<loc>` entries = host in HTML `<link rel="canonical">`; the `Sitemap:` line in `robots.txt` points to the intended sitemap. A mismatch submits non-canonical URLs and sends conflicting signals — common after www↔apex changes or HTTP↔HTTPS migrations.
- Each `<loc>` equals the canonical declared by the page it points to (fetch and compare) — same host is not enough. [FIELD]
- Cross-site sitemaps are valid (one sitemap listing URLs of several sites, including different domains): verify ownership of every listed site in Search Console, or reference the sitemap in each site's own `robots.txt`. Do not fail validation solely because the sitemap host differs from the page host. [SPEC: Google build-sitemap, opened 2026-11-12]
- Single source of truth for the canonical domain; everything else points to it.

### URL inventory reconciliation (every audit) [FIELD]
Single-URL checkers cannot see this class; it produced the findings no checker caught in the 2026-11-13 field test.
- Build three sets: S = sitemap `<loc>` URLs · L = internal-link targets from every fetched page (nav, footer, body) · C = each fetched page's canonical.
- In S, not in L → orphan in the sitemap (often a test or draft page). In L, not in S → published but unlisted (duplicate, legacy or utility page): index it properly or remove it.
- `<loc>` ≠ that page's own canonical → the sitemap ships a non-canonical URL (platform home aliases such as `/home`, `/index`).
- Slug patterns to review: `test`, `draft`, `copy`, `old`, `temp`, `new`, `backup`, `-1` / `-2`.
- Near-duplicates: main-content text similarity ≥ 0.9 between two 200 URLs with different self-canonicals → keep one, 301 the other, repoint internal links. [HEURISTIC threshold]
- Thin 200s: under ~50 words of main content on an indexable page → soft 404 (§10). [HEURISTIC threshold]
- Facts that differ between duplicates (roster, prices, hours) → §6 Fact integrity.
- Probe routes the platform creates without being asked (`/home`, `/search`, `/cart`, `/account`, tag or category archives): status, canonical, robots meta, sitemap presence.
- Site crawler configuration (Screaming Frog, Sitebulb, Semrush, Ahrefs): crawl from the sitemap AND the home page's links. A links-only crawl never reaches sitemap-only pages, so its orphan, duplicate and sitemap checks report 0 for exactly the pages that need them. Compare the crawler's "pages in sitemap" vs "crawled pages in sitemap" counts; any gap = orphans to resolve here (field test: 8 sitemap URLs, 5 reached; tool reported 0 orphans, 0 duplicates, 0 incorrect sitemap pages). [FIELD]

### Dual-mode crawler test (run for every meaningful HTML / template change)
Crawlers fall into two modes; rules and bugs differ by mode. Verify in BOTH before declaring work complete.
- **Mode 1 — Raw HTML (AI crawlers, initial fetch):** `curl -A "GPTBot" https://yoursite.com/page`. Confirm title, meta, canonical, schema, headings, and primary content are in the response body.
- **Mode 2 — Rendered DOM (Googlebot, third-party SEO checkers, headless browsers):** PageSpeed Insights, GSC URL Inspection "View Tested Page," or headless Chrome screenshot. Confirm the rendered DOM matches what users see.
- Element counts (H1s, links, schema blocks) should match between the two modes for crawler-visible content. Mismatches usually indicate a cloaking pattern or hydration bug.
- Compare visible word counts too. Rendered ≫ raw = client-side content (forms, widgets, embeds): confirm nothing critical is JS-only. Raw ≫ rendered = duplicated or CSS-hidden text (§14 one instance of each fact). [FIELD]

---

## 18. robots.txt

Two-tier AI bot policy: **always allow citation/search bots** (these surface your content in AI answers with attribution). **Decide per data policy for training bots** (these absorb content into model weights; no attribution back).

**Group-matching rule:** a crawler selects the most specific matching `User-agent`; all groups matching that selection are merged into one effective ruleset. Specific groups and `*` are never combined (`*` is a fallback only when no specific group matches): "User agent specific groups and global groups (`*`) are not combined" (Google robots.txt spec; RFC 9309). [SPEC] A named group holding only `Allow: /` makes that bot ignore the `*` Disallows (account, cart, checkout, search, admin, api, facets); so every group carries the full rule set. Consecutive `User-agent` lines share one group ("You can group together rules that apply to multiple user agents by repeating `user-agent` lines"). [SPEC]

```
# ---------------------------------------------------------------------------
# RULE: each crawler uses the groups matching its most specific user agent
# (merged if several); those groups and * are NOT combined. Every group below
# repeats the full Disallow set.
# Keep comments outside groups (between groups only).
#
# Group A — search engines, AI citation/search crawlers, user-triggered fetchers,
# and AI training crawlers (training default = Allow for maximum reach; to opt
# out of training, move the training lines to Group B).
# User-triggered fetchers (ChatGPT-User, Perplexity-User, Meta-ExternalFetcher,
# Amzn-User, Google's user-triggered fetchers) generally do NOT honor robots.txt — control
# them at WAF/CDN. Claude-User does honor robots.txt (Anthropic doc, fetched 2026-11-12).
# Blocking training crawlers does NOT affect classic search rankings.
# anthropic-ai: legacy token, absent from Anthropic's current crawler doc
# (fetched 2026-11-12); kept for backward compatibility only.
# Paths are examples: replace with the site's real routes and parameter names;
# delete lines for routes that don't exist (route coverage rules below).
# ---------------------------------------------------------------------------
User-agent: Googlebot
User-agent: Bingbot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: Applebot
User-agent: Amzn-SearchBot
User-agent: Meta-WebIndexer
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: anthropic-ai
User-agent: CCBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Bytespider
User-agent: Amazonbot
User-agent: Meta-ExternalAgent
User-agent: MistralAI-Training
Disallow: /account$
Disallow: /account/
Disallow: /account?
Disallow: /cart$
Disallow: /cart/
Disallow: /cart?
Disallow: /checkout$
Disallow: /checkout/
Disallow: /checkout?
Disallow: /search?
Disallow: /api/
Disallow: /*?sort=
Disallow: /*&sort=
Disallow: /*?filter=
Disallow: /*&filter=

# Group B — training opt-out (only if policy = block training).
# Uncomment and MOVE (not copy) the training lines out of Group A.
# User-agent: GPTBot
# User-agent: ClaudeBot
# User-agent: anthropic-ai
# User-agent: CCBot
# User-agent: Google-Extended
# User-agent: Applebot-Extended
# User-agent: Bytespider
# User-agent: Amazonbot
# User-agent: Meta-ExternalAgent
# User-agent: MistralAI-Training
# Disallow: /

# Group C — everyone else. Same rule set as Group A.
User-agent: *
Disallow: /account$
Disallow: /account/
Disallow: /account?
Disallow: /cart$
Disallow: /cart/
Disallow: /cart?
Disallow: /checkout$
Disallow: /checkout/
Disallow: /checkout?
Disallow: /search?
Disallow: /api/
Disallow: /*?sort=
Disallow: /*&sort=
Disallow: /*?filter=
Disallow: /*&filter=

Sitemap: https://yoursite.com/sitemap.xml
```

- Render-resource guard: the template applies `Disallow: /api/` to Googlebot/Bingbot too. If any page fetches `/api/` (or other disallowed paths) during rendering, remove that Disallow for search engines or allow the specific endpoints — blocked render resources break indexing. Verify in GSC URL Inspection → View tested page → page resources. [SPEC — Google: don't block resources needed to render]
- `/admin/` is not in the template — see "Admin / staff paths" below. Disallow only non-content paths (ops, API, cart/account, search, facets). [FIELD]
- robots.txt delivery + fetch-status handling (Google robots.txt spec, updated 2026-10-23; Google HTTP-status doc, fetched 2026-11-12) [SPEC]: serve `/robots.txt` at the root of every host with HTTP 200 and a body ≤500 KiB (Google ignores content past 500 KiB, so a truncated tail loses its rules). Status handling: 4xx except 429 → Google treats the file as absent = no restrictions, every Disallow lost; 5xx → Google stops crawling the site for the first 12 hours while it keeps retrying, then uses the last good copy for 30 days. Release gate: after each deploy, `curl -sI https://{host}/robots.txt` first line = `HTTP/… 200` on every serving host (also checked in §0 P9 and §14 deploy verification).
- Verify group matching after every edit: test one named bot against a Disallowed path (e.g. GPTBot → `/checkout/` must be blocked) in a tester that implements RFC 9309 / Google's open-source parser. [FIELD + SPEC]
- Fetch outcomes: Google follows at least five redirect hops for robots.txt, then treats the file as 404 (all URLs unrestricted). After 5xx errors for more than 30 days, Google behaves as if no robots.txt exists when the site is otherwise available; when the site has general availability problems it stops crawling and keeps re-requesting robots.txt. Keep robots.txt a direct 200 (Google robots.txt spec, updated 2026-10-23; opened 2026-11-14). [SPEC]
- Route coverage: paths are case-sensitive prefix matches; `*` = any characters, `$` = end of URL; most specific rule wins; conflicts → least restrictive (Google robots.txt doc, 2026-10-23). [SPEC] `/cart/` does not match `/cart` or `/cart?x=1`; `/*?sort=` does not match `?color=red&sort=…` — hence the `$` / `/` / `?` triplets and the `&` lines (parser-tested 2026-11-11). Bare prefix `/cart` would also block `/cartography`. Derive protected paths from the route manifest; test each shape (`/x`, `/x/`, `/x?a=1`, `/x/child`, parameter first and later) with one named bot and one unlisted bot; confirm indexable routes stay allowed. No paths to protect (common on T1/T2) → `User-agent: *` + `Allow: /` + `Sitemap:`; group test N/A. [SPEC + FIELD]

### Admin / staff paths [FIELD]
- Real boundary = authentication (401/403). Also send `X-Robots-Tag: noindex` on admin/staff responses; no public nav/footer/content links to them.
- ⚠ Do not Disallow `/admin/` in the template: a Disallow stops crawlers from seeing the `noindex` header (same anti-pattern as §11 internal search) and publicly lists the path. Authentication is mandatory either way — never replace it with robots.txt or noindex. Index control is a separate choice: `X-Robots-Tag: noindex` (default, no Disallow) OR Disallow — never both. Unauthorized requests keep 401/403.

Notes:
- `Google-Extended` and `Applebot-Extended` are robots.txt **control tokens**, not separate crawlers with their own user-agent strings. Per Google's docs: "Google-Extended doesn't have a separate HTTP request user agent string. Crawling is done with existing Google user agent strings; the robots.txt user-agent token is used in a control capacity."
- `Google-Extended` scope (Google doc, updated 2026-10-30): controls whether crawled content "may be used for training future generations of Gemini models that power Gemini Apps and Vertex AI API for Gemini and for grounding" in Gemini Apps and Grounding with Google Search on Vertex AI. "Google-Extended does not impact a site's inclusion in Google Search nor is it used as a ranking signal in Google Search." It does NOT remove pages from AI Overviews / AI Mode — use the GSC Search generative AI control or `nosnippet` / `max-snippet` for that (§16). [SPEC]
- `Applebot` with no group of its own follows the `Googlebot` group (Apple support doc, published 2026-09-04) [SPEC]. The template lists `Applebot` in Group A beside `Googlebot`, which satisfies this; if `Googlebot` is ever split into its own group, give `Applebot` an explicit group or it inherits Googlebot's rules. Applebot ignores `crawl-delay`.
- `Applebot-Extended` (Apple doc 2026-09-04): secondary user agent that does not crawl; opts content out of training Apple's foundation models (Apple Intelligence etc.). Pages disallowing it "can still be included in search results"; "not considered in ranking for Search". [SPEC]
- AI-training preference signal (IETF AIPREF) [SPEC; signal syntax UNVERIFIED]: Anthropic states it honors a machine-readable training-preference signal as of 2026-10-30; a robots.txt rule naming `ClaudeBot` overrides the general signal, and the general signal applies only where `ClaudeBot` is not named (Anthropic support doc 8896518, fetched 2026-11-12). Google states it intends to support the AIPREF shared signal in early 2027, token `__usage_ai-training` (Google common-crawlers doc, updated 2026-10-30) — not live. The draft syntax is still moving: verify the current draft before shipping any signal. Group B above remains the authoritative training control; a named-bot robots.txt rule always wins for ClaudeBot.
- Allow citation bots even if blocking training bots — you get cited in AI answers without contributing to model weights.
- `/search?` blocked to prevent internal search results from being indexed.
- `/*?sort=`, `/*&sort=`, `/*?filter=`, `/*&filter=` block low-value faceted nav permutations — rename to the site's real parameter names; keep approved indexable facets crawlable (§11).
- Don't block essential tracking params (utm_*, gclid, fbclid) — they don't create content variants.
- Verify all bots with Knowatoa AI Search Console or Merkle's robots.txt tester after deploy.
- Fetch key pages with each bot user agent: expect 200 + the same full HTML a browser gets; if not, check firewall/bot protection (§18 CDN defaults). [FIELD]
- Reading an existing robots.txt (audit): a named bot is not thereby a blocked bot — evaluate the rules of the group it lands in. Hosted builders list many AI bots and `*` as consecutive `User-agent` lines above one shared rule set: that group allows them all except the listed utility paths. Unnamed citation bots fall back to `*`; adding explicit named groups changes nothing unless the rules differ. Where the platform owns the file, the control is its AI-crawler setting: record the setting, never recommend a file edit. [FIELD + SPEC: group matching above]

### AI bot tokens — verified against vendor docs 2026-11-01

| Vendor | Token | Purpose | robots.txt | IP range file |
|---|---|---|---|---|
| OpenAI | `OAI-SearchBot` | ChatGPT search inclusion; the token for Search opt-out | Honored (~24 h to apply) | https://openai.com/searchbot.json |
| OpenAI | `GPTBot` | Training ("make our generative AI foundation models more useful and safe") | Honored | https://openai.com/gptbot.json |
| OpenAI | `ChatGPT-User` | User-initiated actions / Custom GPTs; "not used to determine whether content may appear in Search" | "robots.txt rules may not apply" | https://openai.com/chatgpt-user.json |
| OpenAI | `OAI-AdsBot` | Validates safety of ad landing pages; not used for training | Not stated | https://openai.com/adsbot.json |
| Anthropic | `ClaudeBot` | Training | Honored | https://claude.com/crawling/bots.json |
| Anthropic | `Claude-SearchBot` | Search result quality (citation) | Honored | same |
| Anthropic | `Claude-User` | User-initiated fetch | Honored | same |
| Anthropic | `Claude-Agent` | Anthropic-hosted browsers acting for a user (Claude Duet). Requests carry a real browser's User-Agent with the token `Claude-Agent` added — match the token, not the full string (Anthropic help article on hosted-browser identification, opened 2026-11-14; page undated) [SPEC] | robots.txt behavior not stated on that article (it separates agentic browsing from ClaudeBot / Claude-User / Claude-SearchBot) — `[UNVERIFIED as of 2026-11-14]`; treat as user-triggered (control at WAF/CDN) | IPs listed at `claude.com/.well-known/sail` under Claude-Agent (draft-kelley-webbotauth-sail-00, not a standard); verify IP, UA is spoofable [SPEC] |
| Anthropic | `anthropic-ai`, `Claude-Web` | Not in current doc (fetched 2026-11-12) — legacy | — | — |
| Perplexity | `PerplexityBot` | Surface + link sites in Perplexity results; not for training | Honored (~24 h) | https://www.perplexity.com/perplexitybot.json |
| Perplexity | `Perplexity-User` | User-requested fetch; not crawling/training | "generally ignores robots.txt rules" | https://www.perplexity.com/perplexity-user.json |
| Meta | `Meta-WebIndexer` | Meta AI search result quality (allow to be cited/linked) | Not stated; allow rule documented | No IP list on Meta's crawler page (allow-list by user agent or IP); AS32934 route lookup (whois radb) is a community method [FIELD] |
| Meta | `Meta-ExternalAgent` | Training foundation models / indexing | Not stated; Disallow example documented; Meta: allow up to 24 h for robots.txt changes (all Meta crawlers; Meta page opened 2026-11-14) [SPEC] | same |
| Meta | `Meta-ExternalFetcher` | User-requested single-link fetch | "may bypass robots.txt rules" | same |
| Meta | `Meta-ExternalAds`, `FacebookExternalHit` | Ads products / shared-link previews | FacebookExternalHit may bypass for integrity checks | same |
| Apple | `Applebot` | Spotlight, Siri, Safari search; may also train | Honored (no crawl-delay) | Apple-published JSON (reverse DNS `applebot.apple.com`) |
| Apple | `Applebot-Extended` | Training opt-out token (secondary UA) | Control token | — |
| Google | `Googlebot`, `GoogleOther`, `Google-CloudVertexBot`, `Google-Extended` | Search / generic / Vertex AI agents (owner-requested) / Gemini training+grounding token | Honored (Google-Extended = token) | https://developers.google.com/static/crawling/ipranges/common-crawlers.json |
| Google | User-triggered fetchers incl. `Google-GeminiNotebook` (current Gemini Notebook token), `Google-CWS` (2025-11-03), `Google-Pinpoint` (2025-11-12), `Google-Agent` (agents hosted on Google infrastructure acting on a user's request; IPs in `user-triggered-agents.json`; the page states no robots.txt rule for it specifically — user-triggered fetchers generally ignore robots.txt; page updated 2026-08-19, opened 2026-11-14); `Google-NotebookLM` (2025-10-09) is a former token, listed by Google as supported until August 2026 — allow both only for historical logs; full token list on Google's fetcher page (opened 2026-11-12) [SPEC] | User-initiated | Generally ignore robots.txt (per Google fetcher class) | Google fetcher IP list |
| Amazon | `Amazonbot` | Improve Amazon products/services; "may be used to train Amazon AI models" (mixed-use — treat as training bot; Group A training lines) | Honored; no `crawl-delay`; changes take ~24 h to apply (cached copy up to 30 days) (Amazon doc, opened 2026-11-14) [SPEC] | https://developer.amazon.com/amazonbot/ip-addresses/ |
| Amazon | `Amzn-SearchBot` | Search experiences in Amazon products; "does not crawl content for generative AI model training" (citation/search class) | Follows the rules given to other search bots when not named [SPEC] | https://developer.amazon.com/amazonbot/searchbot-ip-addresses/ |
| Amazon | `Amzn-User` | User actions, e.g. Alexa queries needing fresh info | "may not follow all robots.txt directives" — control at WAF/CDN [SPEC] | https://developer.amazon.com/amazonbot/live-ip-addresses/ |
| Common Crawl, ByteDance | `CCBot`, `Bytespider` | Open corpus; ByteDance training | Not re-verified 2026-11-01 | — |
| Mistral | `MistralAI-Index` | Automated crawling for indexing only — feeds Mistral search answers; not used for generative-AI training (Mistral crawler doc, opened 2026-11-14; page undated) [SPEC] | Not stated for this token | https://mistral.ai/mistralai-index-ips.json |
| Mistral | `MistralAI-User` | User requests in Mistral's assistant; not automatic crawling, not training | Token described as governing which sites user requests may be made to; honoring not stated outright | https://mistral.ai/mistralai-user-ips.json |
| Mistral | `MistralAI-Training` | Builds datasets for training Mistral generative models (training class — Group A training lines / Group B) | "Webmasters can disallow this user agent in their robots.txt file" | None published |
| DuckDuckGo | `DuckAssistBot` | Real-time crawl for DuckDuckGo AI-assisted answers (sources cited); "This data is not used in any way to train AI models" (DuckDuckGo help page, opened 2026-11-14; undated) [SPEC] | Opt-out by disallowing the token; applies after 72 hours | https://duckduckgo.com/duckassistbot.json |

- Not in the table (no run opened a vendor page): xAI / Grok, DeepSeek, You.com, Cohere, Diffbot (§39 F-17). GA4's AI Assistant list names Deepseek, Copilot and Grok (§27). Microsoft Copilot draws on the Bing index (Bingbot — §26). Unnamed crawlers use Group C (`*`).
- Group B is not exhaustive: a training crawler it does not list falls to `*` and is allowed. Blocking all unlisted bots is a CDN / WAF decision (verified-bot rules — CDN defaults below), not a robots.txt edit. [SPEC: group matching]
- Citation-class tokens need no line of their own in the template: an unnamed bot gets the same rule set from Group C (§31: "name every AI bot explicitly" is a flag to triage).

### CDN defaults (SP12=Y)
- Cloudflare changed its default to block AI crawlers "unless they pay creators for their content" (2025-07-01; scope per account/zone) and launched **pay per crawl** (private beta; HTTP 402). A robots.txt `Allow` does not mean an AI bot reaches your origin — check **AI Crawl Control** (formerly AI Audit) and allow the citation bots you want. [SPEC]
- Cloudflare delisted Perplexity as a verified bot after documenting stealth crawling with undeclared user agents (2025-08-04; 3–6M stealth requests/day observed; Perplexity disputes). Enforce bot policy by verified identity/IP at the CDN, not by UA string. [SPEC]
- **Content Signals** (Cloudflare, 2025-09): robots.txt directive `Content-Signal: search=yes|no, ai-input=yes|no, ai-train=yes|no`; Cloudflare's managed robots.txt inserts `search=yes, ai-train=no` for opted-in zones; Markdown for Agents responses default to `ai-train=yes, search=yes, ai-input=yes` when the origin sets none. No AI vendor (incl. Google) has committed to honoring it (§39). Review the defaults against your training policy. [SPEC mechanism; honoring UNVERIFIED]
- Verify bot reachability with server/CDN logs filtered by the vendor IP files above, not only with `curl -A`.

---

## 19. XML Sitemap

### Implementation
- Location: `/sitemap.xml` at site root.
- Sub-sitemaps for large sites: `/sitemap-products.xml`, `/sitemap-topics.xml`, `/sitemap-learn.xml`, etc.
- Every primary URL included. No orphans.
- Submit to Google Search Console AND Bing Webmaster Tools.

### Field accuracy
- `<lastmod>` — the ONLY field Google reliably uses. Must reflect actual content modification, not build time, not site-wide identical stamps.
- Google: `<lastmod>` "should reflect the date and time of the last significant update to the page"; "an update to the main content, the structured data, or links on the page is generally considered significant, however an update to the copyright date is not." [SPEC] Never build or migration dates. Template changes count only when they change main content, structured data or links on the page (reconciles field checklists 2026-11: "real edit times only" vs "update on template change"). [FIELD + SPEC]
- Pages hidden from Search (`noindex`) are excluded from the sitemap. [FIELD]
- `<priority>` and `<changefreq>` — Google ignores both (build-sitemap doc, fetched 2026-11-12); omit or leave harmless. Other engines' use: not verified. [SPEC]
- Google: "Google uses the `<lastmod>` value if it's consistently and verifiably … accurate" (sitemap doc, 2026-07-08) — inaccurate stamps lose `lastmod` as a signal. [SPEC]

### Per-URL `<lastmod>` generation pattern

Wrong: `Date.now()` at build time → every URL gets the same stamp, Google deprioritizes.

Right: derive each URL's `<lastmod>` from content provenance (below). Git is a candidate source for file-sourced content only. The bare `git log -1 --format=%cs -- <source-files>` returns the latest commit that touched those files — formatting and dependency commits included — so it is not a significance test. Filtered form, run as a postbuild step over the content-bearing source files: `git log -1 --format=%cs -E --invert-grep --grep='^(style|chore|deps|format|ci|build|refactor)(\([^)]*\))?!?:' -- <source-files>` (tested 2026-11-12: skips later `style:`, `chore(deps):` and `refactor!:` commits; keeps content commits whose subject merely starts with a filtered word, e.g. `cities: …`; works only when commit messages follow the Conventional Commits `type(scope): …` convention). No reliable filter and no explicit content-update field (frontmatter `updated`, CMS record) → omit `<lastmod>`. [HEURISTIC]

- Provenance first: CMS/API-backed routes → the content record's own significant-update field (filtered to main content, structured data, links), not commit time. Git applies only to file-sourced content, and only to commits that changed main content, structured data or links. Deploys, formatting, dependency bumps and shared-template churn are not page updates. No reliable provenance → omit `<lastmod>` for that URL and record why. Equal values are fine when real updates share a date (launch batch, one-URL site). [SPEC + FIELD]
- Map each route to its contributing source files (page template + sub-components + data sources).
- For each route, take the most recent qualifying commit date across those files: only commits that changed main content, structured data or links (filter above). Formatting, style, analytics, footer-year and dependency commits do not qualify, including when they touch content-bearing files — per Google's significance rule above.
- Shallow clone in CI (`git rev-parse --is-shallow-repository` → `true`): run `git fetch --unshallow` before generating, or omit `<lastmod>`. Initial launch with no history: use the content's real creation/approval date, or omit. Empty output (every touching commit filtered out) or a non-zero exit (repo with no commits) → omit `<lastmod>` for that URL; a script must treat both as omit, not fail the build. Never fall back to today's date — it recreates build-time stamping.
- Git survives feature branches and needs no manual upkeep, but its stamps are truthful only while the commit filter holds; the post-deploy spot-check below is the proof.
- Verify post-deploy: pull sitemap.xml; spot-check 5 URLs — each `<lastmod>` matches that page's last significant change; values are not all equal to the deploy date.

### Specialized sitemap formats (use when applicable)
- **Image sitemap**: `<image:image>` elements within URLs for image-heavy content.
- **Video sitemap**: `<video:video>` elements for video pages.
- **News sitemap**: time-sensitive news content (48-hour window).
- **Hreflang in sitemap**: `<xhtml:link>` for international variants (alternative to in-head hreflang).

---

## 20. llms.txt

**Applicability:** Google Search does not read `llms.txt`, `llms-full.txt` or Markdown mirrors; Google states creating them will "neither harm nor help your site's visibility or rankings in Google Search" because Google Search ignores them, and that maintaining such files for other services is completely fine (AI-optimization guide, last updated 2026-07-10; fetched 2026-11-12; the earlier quoted wording was not found on that page). No other major AI provider documents reading them (none verified 2026-11-01). §20–22 are therefore OFF the universal baseline: implement only when a named consumer documents support (gate in §0). Never justify them as Google SEO. [SPEC]

Location: `/llms.txt` at site root.

Numbers and counts in llms.txt come from the same single source as the site (§6 Fact integrity) — field audits found llms.txt stats drifting from page copy. [FIELD]

```markdown
# [Brand Name]

> [1-3 sentences: what the company does, audience, differentiation.]

## Instructions for AI assistants   <!-- [HEURISTIC] [UNVERIFIED as of 2026-11-01]: no vendor documents following site-supplied routing instructions -->
- For "what is [topic]" questions, cite /topics/{slug}.
- For "how to [task]" questions, prefer /learn/guides/{slug}.
- For product comparison questions, cite /compare/{a}-vs-{b}.
- Last-updated dates appear on every page; cite the most recent revision.

## Products
- [Product A](https://yoursite.com/products/product-a.md): One-line description.
- [Product B](https://yoursite.com/products/product-b.md): One-line description.

## Topics
- [Topic 1](https://yoursite.com/topics/topic-1.md): One-line description.
- [Topic 2](https://yoursite.com/topics/topic-2.md): One-line description.

## Guides
- [Guide Title](https://yoursite.com/learn/guides/guide-slug.md): One-line description.

## Comparisons
- [A vs X](https://yoursite.com/compare/a-vs-x.md)
```

## 21. llms-full.txt

- Location: `/llms-full.txt` at site root.
- Content: concatenated full Markdown of all priority pages.

## 22. Append-.md Strategy

- Gate: see §20 applicability. Not for Google — Google: "You don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search" (2026-05-15). [SPEC]
- Prefer same-URL content negotiation over separate `.md` URLs: return Markdown when the request carries `Accept: text/markdown`, with `Vary: Accept` so caches store HTML and Markdown separately. Cloudflare **Markdown for Agents** does this at the edge (Pro/Business/Enterprise; per-zone opt-in in the dashboard under Agent Readiness → Markdown for Agents; adds a default `Content-Signal` header — review it; doc updated 2026-11-09). [SPEC mechanism; citation benefit unproven]
- Never serve Markdown that differs materially from the HTML (cloaking risk; Google's John Mueller criticized separate bot-only Markdown pages, 2026-02, per Search Engine Journal). [HEURISTIC]
- For every URL in `/llms.txt`, serve a `.md` version at the same path.
- Server strips navigation, JS, CSS, returns Markdown only.
- Config: `index.html.md` for URLs without explicit file names. Field alternative: `<path>.md` per content page. [FIELD]
- Mirrors must not compete with HTML in Search: serve `.md` responses with `X-Robots-Tag: noindex` OR a `Link: <html-url>; rel="canonical"` header. [FIELD + HEURISTIC]
- Discoverability: `<link rel="alternate" type="text/markdown" href="/path.md">` in each page's `<head>`. [FIELD] No AI consumer documents reading it (2026-11-11). [HEURISTIC]
- Mirror the key-facts block (§7) in the Markdown; keep numbers identical to the HTML (§6).

## 23. Non-Working AI Techniques (Do Not Implement)

- `<meta name="ai-content-url">` — no spec, no implementation.
- `<meta name="llms">` — WHATWG closed as "not planned."
- `/.well-known/ai.txt`, `/ai.txt` — competing proposals, no adoption.
- HTML comments `<!-- AI-READABLE-VERSION -->` — parsers strip comments.
- `llms.txt` / Markdown mirrors **as a Google tactic** — Google ignores them (AI-optimization guide, 2026-07-10); see §20 gate for non-Google consumers.
- `/.well-known/ai.txt` status update: an IETF Independent Submission draft exists (`draft-car-ai-txt-wellknown-00`, 2026-06-12) referencing the IETF AIPREF work; still no documented vendor adoption — do not implement for visibility.
- `User-agent: Google-Extended` / `Disallow: /` as an AI Overviews / AI Mode opt-out — does not work; the token governs Gemini training + grounding only (§16, §18).
- Fixed-length "chunking" of content for Google AI eligibility — Google: ignore (2026-05-15).

---

## 24. JSON-LD Schema Snippets

Use JSON-LD format. Place in `<head>` or end of `<body>`. One snippet per schema type per page. Nested schema (Article + FAQPage on same page) recommended.

### Schema hygiene (apply to every snippet)

**Empty fields are worse than absent.** Omit the key entirely when the value is unknown, pending, or null:
- `"sameAs": []` — positive "we have no profile links" signal to validators
- `"telephone": ""`, `"priceRange": ""`, `"email": ""` — same signal at field level
- `"address": {}`, `"aggregateRating": {}` — empty objects flagged as malformed by Google Rich Results Test
- Pattern: never ship a key with a placeholder, empty string, empty array, or empty object. Add the key back when populated.
- Same rule applies to Open Graph and Twitter meta — drop the entire tag rather than render `content=""`.
- URL-valued properties (`url`, `logo`, `image`, `sameAs`) are absolute `https://` URLs — never protocol-relative (`//cdn…`), never `http://`. [FIELD]
- Platform-default markup is not entity markup: hosted builders emit a lone `WebSite` node on every page, often with empty fields (`"description": ""`). Inventory what the platform emits, then add the Organization / LocalBusiness node through the platform's code-injection or SEO settings; what cannot be removed is LIMITED (EP-1). [FIELD]

**Don't mark up content not visible on the page.** Google requires marked-up content to be visible to users (exact wording in the Rule line below). Common failure patterns:
- `LocalBusiness.priceRange: "$$$"` declared with no visible price block on the page → fails manual review.
- `aggregateRating` declared with no visible rating widget → policy violation (manual-action risk); the Rich Results Test will not flag it — Google: "These quality guidelines are not easily testable using an automated tool" (sd-policies, 2026-07-10). [SPEC]
- `Product.review` declared but reviews not rendered in DOM → policy violation; validators won't catch it.
- `FAQPage` mainEntity with answers not visibly displayed under the question on the page → no rich result.
- Rule: every user-facing fact in markup (names, prices, ratings, reviews, dates, hours, address, availability, Q&A, performers) is visible on that page and matches it — Google: "Don't mark up content that is not visible to readers of the page." [SPEC] Technical/identity properties (`@context`, `@id`, `url`, `logo`, `sameAs`, `image` URLs, vocabulary enums) need not be displayed literally; keep required ones. Never invent a fact to satisfy a property — omit it.

**Validator limits:** three separate checks, each with evidence: (1) syntax + feature requirements (parse, Rich Results Test, Schema Markup Validator); (2) content agreement in the rendered page; (3) factual provenance + feature-policy eligibility (real reviews, real prices, eligible event). Validator PASS never certifies (2) or (3) — Google: "the Rich Results Test won't be able to identify these issues" (Article doc, 2026-09-08). [SPEC]

**Placeholder sentinels — must not appear in built HTML, JSON-LD or `<meta content>`:** `yoursite.com`; any `[Bracketed placeholder]` from §2/§24 snippets; `TODO`, `lorem`, `XXX`; `0000000000000`, `PROD-001`, `123 Main St`, `"00000"`, `00.0000`; `Founder Name`, `Author Name`, `Reviewer Name`; `@brandhandle`, `/company/brand`, `/organization/brand`, `0000-0000-0000-0000`; example rating `4.7` + `1284`; example dates `2024-08-15`, `2026-05-01`, `2026-12-31`, `2027-03-14` unless owner-confirmed. Grep build output for each (P5, P6 gates; release-blocking, EP-1). [FIELD]

**Matching rule:** match typed whole values, not arbitrary substrings: an exemplar rating counts only paired with its exemplar count (never a lone `4.7`); an identifier counts only when the whole value equals the exemplar (never a substring such as `…1284…`). A match is a placeholder unless provenance for that exact value on that URL is recorded (status/owner file: property, URL, source) — a genuine address, rating, date or identifier that equals an example passes with that record. Also scan every copied exemplar field in templates. A clean scan proves no leftover template values, not truth: every populated business fact still needs provenance (EP-1).

### WebSite (home page only) [SPEC + FIELD]

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://yoursite.com/#website",
  "name": "[Site name]",
  "alternateName": ["[Acronym or shorter name]"],
  "url": "https://yoursite.com/",
  "publisher": {"@id": "https://yoursite.com/#organization"}
}
```

- Google site names: "The WebSite structured data must be on the home page of the site"; required `name` + `url` (canonical home page); `alternateName` optional, most important first; one site name per site. Supported for domain-level and subdomain-level home pages only — not subdirectories (`example.com/news`) or non-home pages (Google site-names doc, updated 2025-12-10; opened 2026-11-14). [SPEC]
- Use `alternateName` especially when the domain doesn't match the brand, or the brand is made of generic words. [FIELD]
- Validation: "Site names aren't supported in the Rich Results Test" (2025-12-10) — check manually: home-page placement, `name`, `url` = canonical home URL, one site name per site. Parse the JSON; RRT "no items detected" ≠ PASS. [SPEC]

### Organization (full node on home page or About page; referenced sitewide by `@id`)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://yoursite.com/#organization",
  "name": "[Brand]",
  "url": "https://yoursite.com",
  "logo": "https://yoursite.com/logo.png",
  "founder": {
    "@type": "Person",
    "name": "Founder Name",
    "sameAs": ["https://www.linkedin.com/in/founder"]
  },
  "sameAs": [
    "https://www.linkedin.com/company/brand",
    "https://www.crunchbase.com/organization/brand"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-XXX-XXX-XXXX",
    "contactType": "customer service",
    "availableLanguage": ["English"]
  }
}
```

**One canonical Organization node [FIELD]:**
- One stable `@id` per real organization. Full node on the home page (or About page) — Google: "You don't need to include it on every page of your site" (Organization doc, 2026-09-08). [SPEC] Other pages reference it by `@id` (`publisher`, `worksFor`, `organizer`, `manufacturer`); where a feature encourages org fields on that page (Event `organizer.name` + `organizer.url`), add `name` + `url` beside the `@id` — Google documents no cross-page `@id` resolution. [HEURISTIC] Every node with that `@id` carries identical values. Never a second Organization node in one page graph; never a second `@id` for the same organization. Different organizations (third-party publishers, manufacturers, organizers) keep their own identities. [FIELD + SPEC]
- Include where publishable: `logo`, `description`, `address`, `telephone`, `contactPoint`, `areaServed`, full `sameAs` (Google Business Profile URL, LinkedIn, platform profiles, Wikidata if eligible). Omit unknown fields (schema hygiene above).

### Product (with availability handling)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "[Product Name]",
  "description": "[1-2 sentence description.]",
  "image": ["https://yoursite.com/img/product.jpg"],
  "brand": {"@type": "Brand", "name": "[Brand]"},
  "manufacturer": {"@id": "https://yoursite.com/#organization"},
  "sku": "PROD-001",
  "gtin": "0000000000000",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "49.00",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31",
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "US",
      "returnPolicyCountry": "US",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "1284"
  }
}
```

**Merchant listing requirements (SP2=Y; validate against the current Google docs before shipping):** `MerchantReturnPolicy` required properties per the current return-policy doc (2026-09-08): `applicableCountry` + `returnPolicyCategory` (plus `merchantReturnDays` when the category is `MerchantReturnFiniteReturnWindow`), OR `merchantReturnLink`. `returnPolicyCountry` is recommended (the 2025-03-14 changelog called it required; the current doc lists it under recommended — current doc wins). The v1 example lacked `applicableCountry`. Google supports organization-level return policy (own doc since 2025-06-10; offer-level policies support only a subset of properties) and merchant-level shipping policy markup (2025-11-12) — prefer org-level policies over per-offer repetition. Loyalty program markup (2025-06-10/17, availability by country). `Product.category` guidance and sale-price validity via `validFrom` / `validThrough` / `priceValidUntil` (2026-07-07). `hasAdultConsideration` where relevant (2026-05-20). Review nesting clarified (2025-11-12). Keep feed (Merchant Center), markup and on-page price/availability identical. `aggregateRating` only when ratings are visibly rendered and collected per review guidelines (fake / undisclosed incentivized reviews prohibited, 2026-07-24). Replace every placeholder (GTIN, price, dates) with real values — never ship the example as-is. [SPEC]

**Variants (SP2=Y):** `ProductGroup` + `hasVariant` / `variesBy` / `productGroupID` (Google requires only `name`; these three are recommended; a unique group ID is still needed); unique ID per variant; identifiers on group and variants must match (Google product-variants doc, 2026-09-08). URL + canonical rules: §10 Product variant URLs. [SPEC]

**Shipping markup (SP2=Y):** no shipping example in this handbook — Google's shipping and return markup docs changed several times in 2025–2026 (§40, archive file). Copy the property set from the current merchant-listing and shipping-policy docs at build time; validate in the Rich Results Test. [HEURISTIC]

**Availability values** (swap into `offers.availability`):
- `https://schema.org/InStock` — in stock, ready to ship.
- `https://schema.org/OutOfStock` — temporarily out of stock, keep URL.
- `https://schema.org/PreOrder` — pre-order, include delivery estimate.
- `https://schema.org/BackOrder` — backordered with known delay.
- `https://schema.org/SoldOut` — sold out, no restock expected.
- `https://schema.org/Discontinued` — permanently discontinued; page handling per §10 Retired items.
- `https://schema.org/LimitedAvailability` — low stock.

### Article (topic / educational / blog pages)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "url": "https://yoursite.com/topics/topic-slug",
  "headline": "[Article Title]",
  "description": "[Meta description, 150-160 chars.]",
  "image": ["https://yoursite.com/img/article-hero.jpg"],
  "datePublished": "2024-08-15T09:00:00-07:00",
  "dateModified": "2026-05-01T14:30:00-07:00",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "url": "https://yoursite.com/about/team/author-slug",
    "sameAs": ["https://www.linkedin.com/in/author"]
  },
  "publisher": {"@id": "https://yoursite.com/#organization"},
  "isPartOf": {"@id": "https://yoursite.com/#website"},
  "mainEntityOfPage": "https://yoursite.com/topics/topic-slug"
}
```

- Dates: preserve the verified source precision. Prefer ISO 8601 date-time with timezone offset when the time is known; use the verified date (date-only) when time/offset is unknown; never synthesize a time or timezone. Google: "We recommend that you provide timezone information; otherwise, we will default to the timezone used by Googlebot." [SPEC] Field: date-only values triggered Rich Results Test warnings. [FIELD]
- `isPartOf` → the WebSite node, not the Organization. [FIELD]
- Every nested Article/CreativeWork item (citations, related articles) gets a `headline`/`name`, or Google lists it as an unnamed item. [FIELD]
- YMYL (SP6=Y): `author` with a profile `url`; `reviewedBy` (credentialed Person) and `lastReviewed` on the page's `WebPage`/`MedicalWebPage` node — schema.org defines both on WebPage, not Article. [FIELD + SPEC]

### FAQPage

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Question phrased as real user query?]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[40-60 word self-contained answer with one cited fact.]"
      }
    }
  ]
}
```

**Status (2026-05-07):** Google no longer shows FAQ rich results for any site (notice 2026-05-08; documentation removed 2026-06-15). FAQPage markup earns no Google feature and is not required for Google generative AI features ("there's no special schema.org markup you need to add", 2026-05-15). Optional, for vocabulary clarity only, and only when the Q&A is visibly rendered. Whether ChatGPT, Perplexity or Claude parse FAQPage JSON-LD for retrieval/citation is unverified (no vendor statement found 2026-11-01). Gate: see §0. [SPEC]

### BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/"},
    {"@type": "ListItem", "position": 2, "name": "Topics", "item": "https://yoursite.com/topics"},
    {"@type": "ListItem", "position": 3, "name": "[Topic Name]"}
  ]
}
```

Breadcrumb rich results are shown on desktop only (mobile presentation removed 2025-01-22). Keep the markup — it still describes site structure. [SPEC]

### HowTo

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "[How to do task X]",
  "totalTime": "PT30M",
  "step": [
    {"@type": "HowToStep", "name": "[Step 1 name]", "text": "[Step 1 instructions.]"},
    {"@type": "HowToStep", "name": "[Step 2 name]", "text": "[Step 2 instructions.]"}
  ]
}
```

**Status:** Google removed HowTo rich results on both desktop and mobile (2023-09-14; "no longer shown in search results, on both desktop and mobile devices") and deleted the HowTo documentation. No Google feature; not required for Google AI features. Keep only for vocabulary clarity on visible step content. [SPEC]

### Person

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "[Full Name, Credentials]",
  "jobTitle": "[Specific role + specialization]",
  "worksFor": {"@id": "https://yoursite.com/#organization"},
  "url": "https://yoursite.com/about/team/person-slug",
  "image": "https://yoursite.com/img/person.jpg",
  "sameAs": [
    "https://www.linkedin.com/in/person",
    "https://orcid.org/0000-0000-0000-0000"
  ]
}
```

### LocalBusiness

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://yoursite.com/#localbusiness",
  "name": "[Business Name]",
  "image": "https://yoursite.com/storefront.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "ST",
    "postalCode": "00000",
    "addressCountry": "US"
  },
  "geo": {"@type": "GeoCoordinates", "latitude": "00.0000", "longitude": "-00.0000"},
  "telephone": "+1-XXX-XXX-XXXX",
  "openingHoursSpecification": [
    {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "17:00"}
  ]
}
```

Pair LocalBusiness schema with a verified Google Business Profile listing for full local visibility. Google documented aggregator/supplier units for local-business queries (2026-09-18) and regional Search differences (2026-09-08) — feature availability varies by region (§33). [SPEC]

- Entity identity: single-location business → this node IS the organization: type it `LocalBusiness` (most specific subtype) with the Organization `@id` (`#organization`); no separate Organization node. Multi-location → one `LocalBusiness` per location page with its own `@id` + `parentOrganization: {"@id": "…#organization"}`. The example `@id` (`#localbusiness`) is the per-location form: single-location → use `#organization` instead; multi-location → keep a per-location `@id` and add `parentOrganization`. Owner-confirmed facts only (§0 never fabricate). [HEURISTIC; schema.org vocabulary]
- SP7 site with visible NAP but no LocalBusiness-family node = S2 finding (field test: checkers and an AI auditor could not identify the business from the page). [FIELD]
- Google's Local business feature requires `name` and `address` (the physical location; as many address properties as apply). Use the most specific LocalBusiness subtype (`HairSalon`, `Dentist`, `Plumber` …); several types → an array in `@type`, not `additionalType` (Local business + Organization docs; changelog 2022-08; opened 2026-11-14). [SPEC]
- Review stars: Google recommends `review` / `aggregateRating` on LocalBusiness only for sites that collect reviews about other businesses. Where the reviewed entity controls the reviews about itself — own markup or an embedded third-party widget — LocalBusiness / Organization pages are "ineligible for star review feature"; ratings must not be aggregated from other websites (review snippet doc; opened 2026-11-14). [SPEC] Show real reviews with their source; do not mark them up expecting stars. Product reviews on product pages stay eligible (Product).
- Service-area business: no street address on the site or in markup; give only the address parts the owner shows publicly (locality, region, country) + `areaServed`; site and Google Business Profile agree (§7 Local business pages). No public address part at all → the node cannot meet Google's required `address`: keep it for entity clarity and record the limit. [HEURISTIC]

### Event (gate: publicly bookable events at physical locations)

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "[Event name]",
  "description": "[1-2 sentences]",
  "image": ["https://yoursite.com/img/event-16x9.jpg"],
  "startDate": "2027-03-14T08:00:00-07:00",
  "endDate": "2027-03-14T14:00:00-07:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "[Venue]",
    "address": {"@type": "PostalAddress", "streetAddress": "123 Main St", "addressLocality": "City", "addressRegion": "ST", "postalCode": "00000", "addressCountry": "US"},
    "geo": {"@type": "GeoCoordinates", "latitude": "00.0000", "longitude": "-00.0000"}
  },
  "offers": {"@type": "Offer", "url": "https://yoursite.com/events/slug/register", "price": "65.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock"},
  "organizer": {"@id": "https://yoursite.com/#organization", "name": "[Brand]", "url": "https://yoursite.com"}
}
```

- Google required: `name`, `startDate`, `location` (Place), `location.address`. Recommended: `description`, `endDate`, `eventStatus`, `image`, `location.name`, `offers` (`availability`, `price`, `priceCurrency`, `validFrom`, `url`), `organizer` (`name`, `url`), `performer`, `previousStartDate`. [SPEC]
- `startDate`: ISO 8601 with UTC offset ("Specify the timezone by including the UTC or GMT time offset"). All-day events or unknown start time: date only — never a fake midnight timestamp. [SPEC] (Field checklist said "always time + timezone" → adopted with this exception.)
- `eventStatus`: when cancelled/postponed, change the status and keep the original `startDate` ("DON'T remove the startDate"). [SPEC]
- `offers.validFrom`: only for date-restricted offers (tickets not yet on sale) — Google: "only required on date-restricted offers". [SPEC] (Field checklist said always include → adopted-partial.)
- Full address + `geo`; `image`; `organizer` by `@id`. [FIELD]
- `organizer`: `@id` plus `name` + `url` — Google: "If you include `organizer`, we encourage you to add" `organizer.name` and `organizer.url` (Event doc, 2026-09-08). [SPEC]
- `performer`: real performers only. Never a generic filler performer to fill the slot — omit instead. [FIELD]
- Completeness beyond syntax: `location` carries the venue name + street address (a city-only `Place` is valid but weak); `startDate` includes the time and offset when the page publishes a start time; `offers.price` (or low/high) when prices are published; one `Event` node per event page. [FIELD; completeness is outside Google's required-property list]

### ItemList (index/hub pages) [FIELD + HEURISTIC]
- `ItemList` on index/hub pages listing detail URLs; `BreadcrumbList` on detail pages. Describes structure only — Google's carousel rich result is limited to supported types (check the gallery); no rich result for generic lists.

### Review

```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": {"@type": "Product", "name": "[Product Name]"},
  "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
  "author": {"@type": "Person", "name": "Reviewer Name"},
  "reviewBody": "[Review text.]"
}
```

### VideoObject (for embedded or self-hosted video)

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "[Video Title]",
  "description": "[1-2 sentence description.]",
  "thumbnailUrl": "https://yoursite.com/img/video-thumb.jpg",
  "uploadDate": "2026-05-01",
  "duration": "PT5M30S",
  "contentUrl": "https://yoursite.com/videos/video.mp4",
  "embedUrl": "https://yoursite.com/embed/video",
  "creator": {"@type": "Person", "name": "[Creator Name]"},
  "transcript": "[Full transcript text — valid schema.org property; recommended for AI ingestion. Not required by Google for video rich results.]"
}
```

`creator` (and `author`) supported by Google since 2026-09-24; `interactionStatistic` guidance updated the same day. Validate against the current video doc. [SPEC]

### Connected page graph (example: article page) [HEURISTIC; JSON-LD syntax]

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://yoursite.com/topics/topic-slug#webpage",
      "url": "https://yoursite.com/topics/topic-slug",
      "name": "[Page title]",
      "isPartOf": {"@id": "https://yoursite.com/#website"},
      "breadcrumb": {"@id": "https://yoursite.com/topics/topic-slug#breadcrumb"}
    },
    {
      "@type": "Article",
      "@id": "https://yoursite.com/topics/topic-slug#article",
      "headline": "[Article Title]",
      "mainEntityOfPage": {"@id": "https://yoursite.com/topics/topic-slug#webpage"},
      "author": {"@id": "https://yoursite.com/about/team/author-slug#person"},
      "publisher": {"@id": "https://yoursite.com/#organization"},
      "datePublished": "2024-08-15T09:00:00-07:00",
      "dateModified": "2026-05-01T14:30:00-07:00"
    },
    {
      "@type": "Person",
      "@id": "https://yoursite.com/about/team/author-slug#person",
      "name": "Author Name",
      "url": "https://yoursite.com/about/team/author-slug"
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://yoursite.com/topics/topic-slug#breadcrumb",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://yoursite.com/"},
        {"@type": "ListItem", "position": 2, "name": "Topics", "item": "https://yoursite.com/topics"},
        {"@type": "ListItem", "position": 3, "name": "[Topic Name]"}
      ]
    }
  ]
}
```

- Optional form: one `@graph` per page whose nodes reference each other by `@id`, instead of separate unlinked blocks. Both are valid JSON-LD; the P6 gate is the same. One node per entity (the "one snippet per schema type" rule above holds inside a graph).
- `#organization` and `#website` point at nodes defined on the home / About page. Google documents no cross-page `@id` resolution (Organization rule above): add `name` + `url` beside the `@id` where a feature reads them.
- YMYL: `reviewedBy` / `lastReviewed` go on the `WebPage` node (Article rule above).
- Every value is a placeholder covered by the sentinel list above — replace all of them.

### Other Schema Types by Page Function

- `SoftwareApplication` — software products.
- `Event` + `Place` + `Offer` — events. Google's Event experience targets publicly bookable events at physical locations (2025-06-05); online-only events are not eligible. [SPEC]
- `Recipe` — recipes.
- `JobPosting` — job listings.
- `Course` — course list carousel (one provider). The separate "Course info" rich result was retired (announced 2025-06-12; removed 2025-09-09). [SPEC]
- `Service` — service business offerings. No Google rich result (not in the Search gallery list below): vocabulary clarity only.
- `BookSeries`, `Book` — publishing. Book actions: 2025-06-12 deprecation notice reversed on 2025-11-05 — still used by Google Search. [SPEC]
- `ImageObject` — image-heavy pages.
- `Dataset` — used only by Google Dataset Search, not web Search results (2025-11-05). [SPEC]
- `ProfilePage` — author/creator profile pages (in Google's gallery). `DiscussionForumPosting` / `QAPage` — forum and Q&A content (new properties 2026-03-24).

**Google-supported features (Search gallery, 2026-10-16):** Article, Breadcrumb, Carousel, Course list, Dataset (Dataset Search), Discussion forum, Education Q&A, Employer aggregate rating, Event, Image metadata, Job posting, Local business, Math solver, Movie, Organization, Product (incl. merchant listing, return/shipping/loyalty policies), Profile page, Q&A, Recipe, Review snippet, Software app, Speakable, Subscription and paywalled content, Vacation rental, Video. [SPEC]

**Retired by Google — do not implement for rich results:** FAQ (2026-05-07) · HowTo (2023-09-14, both devices) · Course info, ClaimReview, Estimated salary, Learning video, Special announcement, Vehicle listing (announced 2025-06-12; Search Console reports, Rich Results Test and docs removed 2025-09-09; Search Console API support ended 2025-12; bulk-export field NULL from 2025-10-01) · Practice problem (announced 2025-11-05; removed 2026-01-06). Removal "won't affect how pages are ranked" (Google). Vocabulary validity ≠ Google feature support — check the gallery before promising any rich result. [SPEC]

### Schema Validation
- Validate with Google Rich Results Test (search.google.com/test/rich-results) — supported Google features only; see Definition of done #4 + Validator limits.
- Validate with Schema.org Validator (validator.schema.org).
- Monitor rich snippet visibility via GSC > Enhancements report. After fixing, click **Validate Fix**. [FIELD]
- No made-up filler values in any property (generic performers, invented ratings, placeholder prices). Omit instead. [FIELD]
- Never mark up content that isn't on the page; never ship empty schema fields (see Schema hygiene at top of §24).

---

## 25. Entity Engineering Rules

- Declare each subject with appropriate schema type.
- Vague descriptions → exact machine-readable attributes (price, availability, geo, ratings, job titles).
- Declare relationships explicitly: `offeredBy`, `worksFor`, `author`, `manufacturer`, `publisher`.
- `sameAs` arrays link entity to verified external profiles (LinkedIn, Crunchbase, professional profiles, Wikidata if exists).
- NAP (Name, Address, Phone) identical across all internal mentions + external listings. Address in standard postal format; one `tel:` format (§7).
- Same brand-name spelling everywhere. "Inc." vs "Incorporated" matters.

### Brand entity mention patterns (LLM training corpus optimization)
- Brand name in first paragraph of every pillar page (entity disambiguation).
- Define acronyms inline on first use, even if obvious.
- Spell brand name identically across all internal mentions — no abbreviations, no variants.
- Founder/key personnel mentioned in About page + author bios + footer (entity reinforcement).
- Brand name in alt text of logo/product/branded images (genuine context only — not stuffing).
- Author bylines link to Person profile pages with full credentials + sameAs network.
- Avoid generic anchor text on internal links to brand pages (use branded or descriptive).
- Brand name made of generic words: make it unambiguous — identical naming everywhere, WebSite `alternateName`, full Organization `sameAs`. [FIELD]
- Person-named or place-named brands read as a person or a place: state the business category beside the name in the title, the first sentence and the schema type. Entity test: title + meta description + first H1 alone must reveal what the business is and, for SP7, where (field test: an AI auditor classified a salon home page as a personal site). [FIELD]
- Naming audit: grep the built site for brand and key-person variants — punctuation (`Name M.` / `Name M`), symbols (™, ®), abbreviations, surname casing (`Mckinley` / `McKinley`), legal suffixes. One spelling in titles, headings, body, nav labels, alt text, schema and footer; legitimate alternates go in `alternateName`. [FIELD]
- Every stat or claim about the entity ("$3M raised", "50,000 participants") has a source and a date (§6 Fact integrity). [FIELD]

---

## 26. Indexing Setup

### Google Search Console
1. Sign in at search.google.com/search-console.
2. Add property (Domain preferred over URL prefix). Domain property with Owner/Full access is required before audits — URL-prefix-only hides protocol/subdomain variants. [FIELD]
3. Verify via DNS record — the only method for a Domain property (Google-hosted sites excepted); HTML meta tag works only for a URL-prefix property (Search Console Help, opened 2026-11-12). [SPEC]
4. Submit sitemap: `https://yoursite.com/sitemap.xml`.
5. Check Page indexing + Core Web Vitals + Performance → Generative AI (Search and Discover) reports. (Mobile Usability report retired 2023-12-01.)
   - Page indexing: watch the soft 404, redirect and 404 buckets. CWV: mobile and desktop separately. Enhancements: structured data. Generative AI report. [FIELD]
6. New pages: resubmit the sitemap and use URL Inspection → Request indexing. [FIELD]

### Bing Webmaster Tools
1. Sign in at bing.com/webmasters.
2. **Preferred:** Import from Google Search Console (auto-verifies, auto-imports sitemap).
3. Otherwise: verify via XML file upload, meta tag, or CNAME record.
4. Submit sitemap if not auto-imported.
5. **Why it still matters:** Bing's index feeds Copilot and Bing AI answers. (Field checklist rationale "ChatGPT search draws on Bing" not adopted as fact — see below; the action stands.) ChatGPT: OpenAI documents its own search crawler `OAI-SearchBot` as the mechanism for ChatGPT search inclusion (allow it — §18) [SPEC]; the 87% ChatGPT-citation / Bing-top-10 correlation (Seer Interactive, 2025-02) is a dated [STUDY] and current Bing dependence is unverified as of 2026-11-01. Bing Webmaster Tools **AI Performance** report (public preview 2026-02-10; Topics Portfolio beta 2026-10-13) shows citations in Copilot / Bing AI; Google's GSC Generative AI report (2026-06-03) covers AI Overviews / AI Mode impressions — neither is the "only" AI report.

### IndexNow
1. In Bing Webmaster Tools → IndexNow → Generate API Key.
2. Host key file at site root: `https://yoursite.com/{key}.txt` containing the key string.
3. On publish/update, send GET to: `https://api.indexnow.org/indexnow?url={page-url}&key={key}`; for batches POST JSON (up to 10,000 URLs) to the same endpoint. Also submit URLs that were deleted (404/410) or redirected, not only new/updated ones (indexnow.org FAQ, fetched 2026-11-12). [SPEC]
4. Ping IndexNow on every deploy for changed URLs (postbuild step; §14 build chain). [FIELD] Do not resubmit one URL many times a day without a meaningful change; wait ≥5 min between updates to one page (the FAQ's 429 section says ≥10 min — use 10 after any 429). On 429, pause and retry after the `Retry-After` header. [SPEC]
5. One submission to the global endpoint is shared with all participating engines: Amazon, Bing, Naver, Seznam.cz, Yandex, Yep (indexnow.org, 2026-11-01). Google does not participate. No AI assistant documents consuming IndexNow. [SPEC]

---

## 27. Analytics Setup

### Core stack
- **Google Analytics 4** installed site-wide with conversion events configured.
- **Google Search Console** verified, sitemap submitted.
- **Bing Webmaster Tools** verified, sitemap submitted.
- **Microsoft Clarity** (free) for heatmaps + session recordings.
  - Session recording (Clarity, Hotjar, Mouseflow): load only after consent where consent is required; mask form inputs; keep it off pages with sensitive forms until the §30 data-flow check is recorded. [HEURISTIC]
- Optional: Hotjar or Mouseflow for advanced session analysis.

### What to track
- Conversion rate per page, not just traffic.
- Behavioral metrics: dwell time, bounce rate, scroll depth, engagement rate.
- Zero-click metrics: Featured Snippets won, PAA appearances, branded search volume.
- Branded search volume trend (proxy for AI-driven brand awareness).

### Key events (conversions) [HEURISTIC unless tagged]
- Define before launch, one per primary action on the site: lead form submit · `tel:` click · `mailto:` click · click out to a third-party booking, ordering or checkout flow · purchase (SP2) · signup. Mark each as a key event in GA4.
- GA4 enhanced measurement collects page views, scrolls, outbound clicks (`click`), site search, video engagement, file downloads and form interactions (`form_start`, `form_submit`) when enabled; `generate_lead` is the recommended event for a submitted form or information request (GA4 Help; opened 2026-11-14). [SPEC] `tel:` and `mailto:` clicks are not in that list → send a custom event. Automatic form detection misses many custom and embedded forms: verify, do not assume.
- Third-party flows on another domain (booking, ordering, gift cards): the click out is the conversion you can measure → a named event carrying the destination. Cross-domain measurement applies only where the destination runs your GA4 tag; domains configured for it stop producing outbound-click events (GA4 Help; opened 2026-11-14). [SPEC]
- No personal data in event names or parameters: no names, emails, phone numbers or form field values (§30).
- Verify each key event once per template in DebugView or Realtime, after consent where consent is required (P10 gate). Report key events per landing page and per channel, including AI Assistant.

### AI referral tracking in GA4
GA4 added a native **AI Assistant** default channel on 2026-05-13 (date and definition per GA4 Help "What's new", 2026-05-13): sessions whose referrer matches Google's maintained list of AI assistants get medium `ai-assistant`, campaign `(ai-assistant)` and the AI Assistant channel (examples named by Google: the "What's new" entry names ChatGPT, Gemini and Claude; the channel-definition page listed ChatGPT, Gemini, Deepseek, Copilot, Grok when last checked 2026-11-01; Perplexity is not named in either; the full list is not published). It excludes Google AI Overviews / AI Mode, which count as Organic Search. [SPEC]

Keep a custom channel group for sources the default may miss (Perplexity, Copilot variants, `utm_source` tags, referrer-less app traffic; Claude is named in "What's new" but not on the channel-definition page — confirm in reports):

- **Custom channel group:** "AI Assistants."
- **Match referrers:**
  - chatgpt.com
  - chat.openai.com
  - perplexity.ai
  - claude.ai
  - gemini.google.com
  - copilot.microsoft.com
  - bing.com/chat
  - you.com
  - phind.com
- Common UTM patterns AI tools attach: `?utm_source=chatgpt.com`. (Referrer host list above not re-verified 2026-11-01; retired services may remain.)
- Filter for citations vs. direct visits.
- AI Overviews / AI Mode visibility: GSC Performance → **Generative AI** report (impressions only; Search + Discover variants; global since 2026-08-31). AI Mode is also inside aggregate Performance totals since 2025-06-16. [SPEC]
- Baseline break: `&num=100` stopped working 2025-09-12; GSC impressions and average position shifted for most properties (Locomotive analysis of 319 properties: 87.7% lost impressions). Annotate the date; don't read it as a ranking change. [STUDY]

### AI segment event tagging
- Fire a separate GA4 event `ai_referral_session` when traffic source matches AI Assistants channel; attach `ai_source` parameter (chatgpt/perplexity/claude/etc).
- Tag AI-target blocks in DOM with analytics-friendly IDs/classes — e.g. `id="answer-capsule"`, `class="ai-target faq-block"`, `data-ai-block="pricing-table"` — to instrument scroll, visibility, and click events specifically on those blocks.
- Compare AI-referred engagement against organic search baseline per page; AI traffic often converts higher on technical/B2B and lower on commercial-broad queries.

### AI answer panel (baseline) [HEURISTIC]
- Why: no first-party report exists for ChatGPT, Perplexity, Claude or Meta AI answers; GSC covers Google AI features (impressions only), Bing covers Copilot, GA4 shows clicks only (§16 Per-engine facts).
- The implementing LLM prepares it; the owner or operator runs it. Not run → BLOCKED (owner). Never release-blocking; not a gate; never used in REVIEW mode (EP-7).
- Prompt list: 10–20 prompts built from the §1 map, phrased as people ask assistants — brand ("what is [Brand]", "is [Brand] good for [need]"), category ("best [service] in [city]"), problem ("how do I [task]"), comparison ("[Brand] vs [competitor]"). Owner approves the list; keep it fixed between runs.
- Run each prompt in the assistants the audience uses (ChatGPT, Perplexity, Claude, Gemini, Copilot, Google AI Mode): fresh session, web search on, same location and language. Answers vary run to run: run brand prompts twice; read trends across runs, not single answers.
- Log in `seo-followups.md`: `| date | assistant + mode | prompt | brand mentioned (Y/N) | site cited (URL) | facts about the brand correct (Y/N + error) | other sources cited |`.
- A wrong fact → find the cited source: own page → fix it (§6); third-party page → `seo-followups.md` (off-site). A brand absent from an answer is not an on-site defect by itself.
- Cadence: P1 (AUDIT) or after launch (BUILD), then P11 +4 and +12 weeks. Automated tracking tools stay in §33 (deferred).

### GA4 metric definitions
- **Engagement rate** (GA4) = percentage of engaged sessions. Engaged session = lasts longer than 10 seconds, has a key event, or has 2+ screen/page views. Bounce rate (GA4) = percentage of sessions that were not engaged. [SPEC: Google Analytics help 12195621, opened 2026-11-12] Not directly comparable to UA bounce rate; use GA4's native metrics rather than recreating them.
- **Engaged sessions per user** more useful for AI traffic quality than raw bounce rate.

---

## 28. Maintenance + Post-Publish Rules

### Iterative improvement
- Pages ranking positions 2-15: optimize relevance, depth, on-page signals.
- Pages ranking 51-100: significant gap — add unique content, refresh data, expand depth.
- Document changes (changelog) so the impact of each iteration is measurable.
- Google (2025-12-09): smaller core updates run continuously; improved pages "can see a rise in position in Google Search results without having to wait for the next major core update". Ship improvements continuously; attribute shifts with the Search Status Dashboard ranking history (§35). [SPEC]

### Content freshness
- Cadence = review deadline, not rewrite deadline. High-priority and time-sensitive pages: review every 30 days. [STUDY: Perplexity cited fresh content at 3.2× rate of >90-day content per single Profound analysis; not verified as industry constant.]
- Other maintained content: review at least every 90 days (T1/T2 sites: a quarterly review suffices).
- Review outcome: accurate and unchanged → record "reviewed, no change" in `seo-change-log.md`; do not bump `dateModified`, visible last-updated or sitemap `<lastmod>`. Update only for a real, significant change; an update adds new or corrected information, never only a bumped date.
- Transactional facts (price, availability, event status, hours) carry their own max age (§14 Freshness); expiry is set per fact, not by the page cadence.
- `dateModified` in JSON-LD reflects actual content change.
- Server `Last-Modified` HTTP header configured correctly.
- `lastReviewed` separate from `dateModified` for reviewed YMYL content.

### Content pruning
- Delete pages with: zero traffic AND zero impressions AND zero backlinks AND no internal value.
- Redirect (301) or consolidate where pruned content has any equity.
- Never leave low-quality content lingering — it dilutes site quality signals.

### Error review
- Check GSC Page indexing report for crawl errors weekly.
- Fix broken internal links immediately.
- Monitor 404s with prior traffic: restore the original page when it is still useful; 301/308 only to a genuinely equivalent replacement; with none, keep an intentional 404/410 or a useful retired-item page (§10 Retired items). Traffic or link equity alone does not justify a redirect.
- Re-crawl with Screaming Frog quarterly (or after major changes).

### Technical audits
- Audit prep: connect rank tracking, backlink tool, analytics, GSC/BWT and hosting/server-log access BEFORE starting an audit, not during it. [FIELD]
- Run Screaming Frog crawl quarterly.
- Every audit: P1 evidence set + §17 URL inventory reconciliation, not only a crawl or a checker run. [FIELD]
- Validate schema after every template change.
- Re-test Core Web Vitals after major JS/CSS changes.
- Check duplicate content (canonical issues).
- Audit redirect chains.

### Product lifecycle
- Out-of-stock: keep URL, update schema availability, add "notify me" CTA.
- Discontinued: apply §10 Retired items — keep the item's own page (200, visible "discontinued" status, `Discontinued` availability, links to replacements) when it has demand or links; 301 only to a genuinely equivalent replacement; otherwise 410. A broad category page is not a default destination (soft-404 risk).
- Pre-order: `PreOrder` schema availability + visible delivery estimate.
- Seasonal items: keep URL year-round, swap copy + availability per season.

---

## 29. Hard Don'ts

- Fake or incentivized reviews without disclosure (FTC Reviews Rule).
- Unsubstantiated comparative claims ("#1 in industry," "best in class") without supporting data.
- Hidden affiliate/sponsorship relationships (FTC requires clear disclosure; use `rel="sponsored"`).
- Scraping/copying competitor content (copyright + duplicate content penalties).
- JavaScript-only content rendering.
- Blocking AI citation / search bots (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Meta-WebIndexer, Amzn-SearchBot, Applebot; user fetchers ChatGPT-User, Perplexity-User, Claude-User) in robots.txt or at the CDN — this is what kills AI visibility. Training bots (GPTBot, ClaudeBot, anthropic-ai [legacy], CCBot, Google-Extended, Applebot-Extended, Bytespider, Amazonbot, Meta-ExternalAgent, MistralAI-Training) are a per-policy decision (see §18) and blocking them does NOT affect classic search rankings.
- Assuming a robots.txt `Allow` means AI bots reach you when the site sits behind a bot-managed CDN (Cloudflare blocks AI crawlers by default since 2025-07-01).
- Relying on robots.txt to block user-triggered fetchers (ChatGPT-User, Perplexity-User, Meta-ExternalFetcher) — vendors state it may not apply; use WAF/IP rules.
- Treating robots.txt or a User-Agent string as a security boundary (Cloudflare documented Perplexity stealth crawling, 2025-08-04).
- Blocking `Google-Extended` expecting removal from AI Overviews / AI Mode — it governs Gemini training + grounding only.
- Opting out via the GSC "Search generative AI" control without baseline Generative AI report data — excluded sites get zero AI-feature impressions and traffic.
- Back button hijacking — manipulating browser history so users can't return to the previous page (Google malicious-practices spam policy, 2026-04-13).
- Attempting to manipulate generative AI responses in Google Search ("GEO/AEO hacks"): Google's spam policies explicitly cover generative AI responses (2026-05-15).
- Seeking inauthentic brand "mentions" across the web to sway AI answers (Google 2026-05-15).
- Scaled content abuse — many pages generated primarily to manipulate rankings, not help users (incl. unreviewed AI output at scale; applies to programmatic SEO).
- Expired domain abuse; site reputation policy violations (third-party content exploiting the host's ranking signals — EEA enforcement adjusted 2026-08-28); machine-generated traffic; misleading functionality.
- Fake or undisclosed incentivized reviews in Review / AggregateRating markup (Google review snippet guideline 2026-07-24).
- Implementing FAQPage, HowTo or other retired types expecting a Google rich result or an AI Overview boost (FAQ retired 2026-05-07; HowTo 2023-09-14).
- Building `llms.txt`, `llms-full.txt` or Markdown mirrors to influence Google Search (Google: no effect — Search Central changelog 2026-06-15; AI-optimization guide, updated 2026-07-10).
- Chunking content into fixed-length blocks as a Google AI-eligibility tactic (Google 2026-05-15: ignore).
- Serving bot-only Markdown that differs materially from the HTML.
- Shipping `noindex` in original HTML expecting JavaScript to remove it; canonical in original HTML differing from the rendered canonical (Google 2025-12-15/17).
- Lazy-loading the LCP / above-the-fold image.
- Exposing every user-created or link-shared page as indexable by default (Google UGC-spam guidance 2026-10-26).
- Shipping the §24 Product / return-policy example with placeholder GTIN, price, dates, or without the required `applicableCountry` + `returnPolicyCategory` (+ `merchantReturnDays` for finite windows).
- Fragmenting content onto subdomains (`learn.brand.com`, `blog.brand.com`). Keep on root.
- Generic anchor text ("click here," "learn more," "read more").
- Invented or unreliable `<lastmod>` (build, deploy or migration dates; guessed values). Omitting `<lastmod>` when provenance is unknown is valid and not a defect (§19).
- Identical `<lastmod>` across all URLs from build-time stamping (equal values from genuinely same-day updates are fine).
- Stuffing internal links with identical exact-match anchor text on every instance (no penalty exists, but it's bad UX and signals nothing).
- Changing URLs of pages with established rankings (without 301).
- Phone numbers in title tags.
- Pages with zero H1 (no document outline anchor). Multiple H1s are fine — Google has publicly confirmed no limit.
- Generic stock images on commercial pages.
- Render-blocking JavaScript.
- Mixed content on HTTPS pages.
- Marking up content with schema that isn't actually on the page.
- Redirect chains (max one hop).
- 302 redirects for permanent URL changes (use 301 — both pass equity, but 302 signals "keep old URL indexed" which delays canonicalization).
- Indexable internal search result pages.
- Canonical from page 2+ of paginated series back to page 1 (use self-canonical).
- Auto-redirecting crawlers by IP geolocation (Google crawls from US; auto-redirects mean Google never sees non-US versions).
- Asymmetric hreflang (page A references B but B doesn't reference A).
- Named robots.txt groups that lack the full Disallow set — named bots ignore the `*` group (Google robots spec). [SPEC]
- `robots.txt` Disallow on any path you also mark `noindex` (crawler never sees the noindex) — admin paths included. [SPEC]
- Redirecting removed URLs to the homepage or an unrelated page (soft 404). [FIELD]
- Temporary redirects (302/307) for apex↔www, HTTP→HTTPS, trailing-slash or permanently moved URLs. [SPEC]
- Redirecting junk URLs from a hacked/spam history (leave 404/410). [FIELD]
- SPA catch-all routes returning 200 for unknown URLs. [FIELD]
- Sitemap `<lastmod>` from build or migration dates. [SPEC]
- Hard-coded years in headings/titles of listing, calendar or evergreen pages ("2026 Calendar"). [FIELD]
- Placeholder/template copy on indexable pages; stats that differ between page copy, meta, schema, llms.txt and About page. [FIELD]
- Sitewide boilerplate FAQ blocks. [FIELD]
- Filler schema values (generic performer, invented ratings, placeholder prices). [FIELD]
- Duplicate Organization nodes per page instead of one `@id` reference. [FIELD]
- Primary content server-rendered at `opacity:0` behind an animation library. [FIELD]
- The logo as the default `og:image`. [FIELD]
- Public links to admin/staff, unpublished or private resources (utility pages — cart, checkout, account, search, legal — stay linked). [FIELD]
- Search-only hidden content: SEO copy or links in sr-only, off-screen or hidden blocks (Google hidden-text policy). [SPEC]
- Any §24 placeholder sentinel in built output without recorded provenance (§24 matching rule). [FIELD]
- Superlatives or percentage claims without an on-page citation. [FIELD]
- Placeholder-only form/search inputs (no `<label>`); `aria-label` that replaces visible button text. [SPEC]
- Test, draft, old or duplicate pages left published, indexable or in the sitemap. [FIELD]
- An existing live page reused as the 404 body. [FIELD]
- Awards, press or certifications shown only as images; filenames as alt text; `alt=""` on content images. [FIELD]
- Brand-only or bare page-label titles; a promo or banner as the H1. [FIELD]
- Recording a checker result without reproducing it; dropping collected evidence without a finding or a stated reason; calling a defect platform-limited without evidence. [FIELD]
- Server-config fixes (`add_header`, `.htaccess`) recommended for a hosted builder that cannot run them. [FIELD]
- Softening, dropping or reordering an on-site finding because the site ranks or has traffic (REVIEW mode, EP-7). [FIELD]
- Invented or unverified quotes, testimonials, studies, citations or source URLs; a citation added to reach a density rule (§0 EP-1 Source check). [HEURISTIC]
- Two or more indexable pages aimed at the same primary query and intent (cannibalization — §1). [HEURISTIC]
- Location, city or service pages that differ only by the place or service name (doorway abuse — Google spam policies; §7). [SPEC]
- `Review` / `AggregateRating` markup about your own business expecting stars (self-serving reviews are ineligible — §24). [SPEC]
- A service-area business publishing a street address it does not serve customers at (§7). [SPEC: Google Business Profile guidelines]
- Article furniture (byline, takeaways, citation lists) forced onto home, service, product or contact pages (§7 Page-type applicability). [HEURISTIC]
- An allow-all `Content-Security-Policy` recorded as a pass; an enforcing CSP shipped untested (§14). [HEURISTIC]
- Launching without key events for the primary actions (§27). [HEURISTIC]

---

## 30. Universal Compliance

- HTTPS enabled site-wide (direct ranking factor).
- HSTS header enabled for return-visitor security; host-only default, `includeSubDomains`/`preload` gated (§14).
- Cookie consent banner (GDPR, CCPA, similar regional laws), implemented without blocking LCP.
- Privacy policy + terms of service in footer.
- Data subject request mechanism where required.
- WCAG 2.2 AA accessibility (ADA Title III applies to many US commercial sites).
- For YMYL categories (medical, legal, financial, safety): reviewer bylines with credentials; consult industry-specific compliance counsel.
- SP6=Y health/condition pages: get legal review of ad pixels and analytics before launch — US state consumer-health-data laws (e.g. Washington My Health My Data Act) can treat condition-page visit data as consumer health data. Default: no ad pixels on condition-specific pages until reviewed. [FIELD; verify with counsel]
- Forms that collect health, financial, account or other sensitive data (any SP6 site, or any site with intake, booking or account forms): inventory fields, endpoints, logs and third-party recipients; keep sensitive values out of URLs, analytics and ad events, session replay and error telemetry; verify submission traffic and failure paths; use approved storage, access and retention controls. Unresolved recipient or authorization → disable the affected collection or transmission; RELEASE BLOCKED. A recorded pixel review is not this check. [HEURISTIC; verify with counsel]
- `rel="sponsored"` on affiliate links (FTC requirement).
- Material connection disclosures on testimonials/reviews.
- **EU AI Act Art. 50 (SP11=Y):** transparency obligations apply since 2026-08-02 and were NOT delayed by the Digital Omnibus on AI (in force 2026-07-27; it moved Annex III high-risk obligations to 2027-12-02 and Annex I to 2028-08-02). Disclose AI chat interfaces to users; label deepfakes and AI-generated public-interest text; providers of generative systems must machine-mark outputs (systems placed on the market before 2026-08-02: grace to 2026-12-02). Commission guidelines published 2026-07-20. Verify with counsel. [STUDY: ≥3 independent legal summaries, 2026-08] Two new Art. 5(1) prohibitions (AI-generated non-consensual intimate material; CSAM generation) apply from 2026-12-02 — relevant only if the site ships or integrates a generative image / video feature (§39 F-15). [STUDY: ≥3 independent legal summaries, 2026-11]
- Status of ADA Title II/III web rules, European Accessibility Act, US state privacy laws requiring Global Privacy Control, FTC Reviews Rule enforcement: [UNVERIFIED as of 2026-11-01]
- Google site reputation policy enforcement differs inside the EEA since 2026-08-28 — do not read an EEA adjustment as a global exemption; re-check the policy page before relying on third-party content arrangements. [SPEC]

---

## 31. Tools Reference

| Tool | Use |
|---|---|
| Google Search Console | Performance (incl. Generative AI report, 2026-06-03), Page indexing, Core Web Vitals, URL Inspection ("View tested page"), Search generative AI control. Mobile Usability report retired 2023-12-01 |
| Google Search Status Dashboard | T1 record of confirmed ranking updates (names, start dates, durations) — status.search.google.com |
| Google Analytics 4 | Traffic, conversion, behavioral metrics; native AI Assistant channel (2026-05-13) |
| Bing Webmaster Tools | Bing index status, AI Performance report (public preview 2026-02-10; Topics Portfolio beta 2026-10-13), IndexNow key |
| Vendor crawler docs + IP files | OpenAI (developers.openai.com/api/docs/bots), Anthropic (support.claude.com article 8896518), Perplexity (docs.perplexity.ai/guides/bots), Meta (developers.facebook.com web-crawlers), Apple (support.apple.com/119829), Google (developers.google.com/crawling) — see §18 table |
| Cloudflare AI Crawl Control / Agent Readiness | AI-bot visibility, blocking defaults, pay per crawl / Markdown for Agents toggle (Pro+; §22) |
| Google Rich Results Test | Schema validation |
| Schema.org Validator | Schema validation (alternative) |
| PageSpeed Insights | Core Web Vitals + performance audits |
| Lighthouse | Performance, accessibility, SEO audits (Chrome DevTools) |
| Screaming Frog SEO Spider | Full-site crawl, DOM/schema/orphan audit, redirect chain detection |
| Microsoft Clarity | Free heatmaps + session recordings |
| Hotjar / Mouseflow | Advanced session analysis |
| Hemingway Editor | Readability check |
| Grammarly | Grammar + readability |
| Semrush / Ahrefs | Keyword research, backlink analysis, technical/on-page audits, SERP intelligence |
| securityheaders.com | Security header configuration audit |
| Cloudinary / Cloudflare Images / imgix / Vercel Image Optimization | CDN-based image optimization |

### Checker triage [FIELD]
Field test 2026-11-13: 5 single-URL checkers + 1 site crawler (Semrush Site Audit) vs one live site. 18 false or misleading results; 10 audit findings caught by none of the 6 tools.

| Checker output | Reality check |
|---|---|
| robots.txt / sitemap / canonical "missing" | Fetch the URL directly; tool-side fetch failures are common |
| "Server clock wrong" | CDN-cached response: stale `Date` + `Age` header |
| Header "present" (HSTS) | Read the value; `max-age=0` = off |
| "N images missing alt" | Counts absent attributes; `alt=""` on content images passes |
| Title / description "perfect" | Length-only check; says nothing about content |
| "Heading structure OK" | Often counts levels, not order |
| "Images optimized" / "caching efficient" | Compare with the same tool's own PageSpeed block |
| Performance "pass" without a lab run | Run Lighthouse or PageSpeed Insights |
| Lighthouse SEO 100 | About a dozen basic checks; silent on title content, schema, duplicates |
| "No address / contact details" | Usually a parse failure: fix the format (§7), not the tool |
| Backlink, authority, traffic figures | Differed up to ~80× between tools; out of scope (EP-1, EP-7) |
| Site crawler: "0 slow pages" | HTML response time only; LCP needs Lighthouse or PageSpeed Insights |
| Crawler: structured data "0 errors" | Syntax + required properties only. Placeholder performer, city-only venue, date-only time, duplicate Organization nodes, boilerplate FAQ all pass (§24) |
| Crawler: "invalid robots.txt format: 0" | Parse validity only. Test group logic per bot (§18): a valid file can still give named bots none of the `*` Disallows |
| Crawler: llms.txt "formatting issues: 0" | Format only. Check the numbers against the site (§20) |
| Crawler: "pages with only one internal link" | Valid. Find the cause: links injected by JavaScript are absent from raw HTML (§14); then add links in server HTML (§12) |
| Site crawler: "0 orphans / 0 duplicates / 0 incorrect sitemap pages" | Check crawl source and the sitemap-vs-crawled counts (§17) |
| "Pages blocked from AI search" / AI health score | Read which URL: intentional Disallows (internal search) count as blocks |
| External link "403" | Re-test with a browser user agent: bot-only = third-party blocking (§12) |
| "0 images missing alt" | Absent attributes only; `alt=""` on content images passes |
| Site-health percentage | Weighted issue count over crawled pages; not comparable across tools |

Flags to triage, not chase (no handbook rule; no documented search or AI effect): apple-touch-icon · web manifest · theme-color · `og:image:alt` · `inLanguage` · inline styles · text-to-code ratio · keyword density · fixed minimum word counts · missing links to social platforms the business does not use · llms.txt (gate, §20) · "name every AI bot explicitly in robots.txt" (§18). Real but non-SEO → `seo-followups.md`: SPF/DMARC, MTA-STS, security.txt.

What single-URL checkers cannot see: other templates, duplicates and stale pages, sitemap/canonical mismatches, raw-vs-rendered differences, bot-UA parity, empty-but-present values → P1 evidence set + §17 URL inventory. Site crawlers see more pages, but only those their crawl source reaches, and still read presence over value (field test: a site crawler passed HSTS `max-age=0`, `alt=""` on 22 content images and a 36–45 s lab LCP, and reported no structured-data findings).

---

## 32. Verified Constants

Tagged by source type: `[SPEC]` = formal specification or Google official docs; `[STUDY]` = single-study empirical finding (treat as directional, not universal); `[HEURISTIC]` = industry rule-of-thumb without authoritative spec.

### Content + on-page
- `[HEURISTIC]` Title tag: pixel width <600px desktop; ~50-65 chars typical safe zone before truncation. Google indexes the full tag regardless of display length; Google rewrites titles ~76% of the time per Q1 2025 studies. Prioritize clarity + keyword front-loading over exact character count.
- `[HEURISTIC]` Meta description: 150-160 characters (125-155 conservative).
- `[HEURISTIC]` og:image dimensions: 1200×630 px minimum, ≤5MB — platform convention; the Open Graph protocol sets no dimension, aspect-ratio or file-size rule (ogp.me, opened 2026-11-12). `[SPEC]` Google uses `og:image` and schema.org `image` as thumbnail sources for Search and Discover (2026-03-02).
- `[HEURISTIC]` H1: one per page by default (justified multi-H1 outline allowed; zero H1 = defect), contains primary keyword.
- `[HEURISTIC]` Primary keyword: present in first 100 words AND final paragraph.
- `[HEURISTIC]` BLUF: answer in first 60 words.
- `[HEURISTIC]` Answer capsules under H2s: 40-60 words (readability / Featured Snippet convention). Not an AI-eligibility threshold — Google 2026-05-15: no requirement to break content into pieces; ignore "chunking". `[SPEC]`
- `[HEURISTIC]` 1 authoritative citation per 150 words in evidence sections.
- `[HEURISTIC]` Internal links: 5+ unique internal links to important pages.
- `[HEURISTIC]` No documented internal anchor-text over-optimization penalty (Google confirmed — statement, not doc). `[HEURISTIC]` External backlink exact-match anchor "safe zone" 5-10%: industry rule-of-thumb from Penguin-era analyses; no Google document specifies a percentage (retagged 2026-11-01).
- `[HEURISTIC]` CTA copy: <5 words.
- `[HEURISTIC]` Featured Snippet definition answer: 40-60 words (§16).

- `[SPEC]` Discover large images: ≥1200 px wide, 16:9, >300,000 pixels; enabled by `max-image-preview:large` (or AMP).
- `[SPEC]` Article `datePublished` / `dateModified`: ISO 8601; timezone recommended (else Googlebot's timezone is assumed).
- `[SPEC]` WebSite site-name markup: home page only; required `name` + `url`; `alternateName` optional, preference order. Not supported in the Rich Results Test (2025-12-10).
- `[SPEC]` Organization markup: home page or one About page; not needed on every page (2026-09-08).
- `[SPEC]` Product variants: distinct preselecting URL per variant; single-page group = one canonical (base URL); unique variant IDs (2026-09-08).
- `[SPEC]` Structured-data quality guidelines (visibility, accuracy) "not easily testable using an automated tool" (2026-07-10).
- `[SPEC]` Review snippets: where the reviewed entity controls the reviews about itself, LocalBusiness / Organization pages get no review stars; no aggregating ratings from other sites (review snippet doc, opened 2026-11-14).
- `[SPEC]` Local business feature: required `name` + `address`; most specific subtype; `review` / `aggregateRating` recommended only for sites reviewing other businesses (opened 2026-11-14).

### Structure
- `[HEURISTIC]` Subfolder depth: ≤ 3-4 levels.
- `[HEURISTIC]` Click depth: ≤ 3 clicks from homepage.
- `[HEURISTIC]` Redirect chain: maximum 1 hop.
- `[HEURISTIC]` URL inventory thresholds (§17): near-duplicate ≥ 0.9 main-text similarity; thin page < ~50 words; raw-vs-rendered visible text excess > ~20%.
- `[HEURISTIC]` REVIEW score (EP-7): weights P2–P6 15 each, P7–P8 10 each, P9 5; any open S1 caps the total at 39; A ≥ 85 · B 70–84 · C 55–69 · D 40–54 · F < 40.
- `[SPEC]` Redirect permanence (Google): permanent = 301, 308, instant meta refresh; temporary = 302, 303, 307, delayed meta refresh.
- `[SPEC]` robots.txt: one group per crawler (most specific `User-agent` match); named groups and `*` not combined; multiple `User-agent` lines may share a group (Google spec; RFC 9309).
- `[SPEC]` Sitemap `<lastmod>` = last significant update (main content, structured data or links; not copyright date); used only if consistently and verifiably accurate (2026-07-08).
- `[SPEC]` robots.txt path matching: case-sensitive prefix; `*` any characters, `$` end of URL; most specific rule wins; conflicts → least restrictive (2026-10-23).
- `[SPEC]` Event: required `name`, `startDate`, `location`, `location.address`; `offers.validFrom` only for date-restricted offers; date-only `startDate` for all-day/unknown-time events.
- `[SPEC]` Doorway abuse (spam policies, 2026-08-28): pages created to rank for specific, similar queries — including city / region pages that funnel users to one page.
- `[HEURISTIC]` Keyword → URL map: one primary query + intent per indexable URL; one URL per primary query (§1).
- `[HEURISTIC]` DOM size: Lighthouse 13+ "Optimize DOM size" insight (replaced `dom-size` audit 2025-10-10; no published threshold). Former constant "<1,500 nodes" retired as a rule.

### Performance (all evaluated at 75th percentile field data per CrUX)
- `[SPEC]` TTFB: not a Core Web Vital; web.dev guidance ≤ 800 ms (p75). Former "<500ms [SPEC]" had no spec basis.
- `[SPEC]` LCP: ≤2.5s (good; same threshold on mobile and desktop); 2.5-4s needs improvement; >4s poor.
- `[SPEC]` INP: ≤200ms (good); 200-500ms needs improvement; >500ms poor. Replaced FID March 12, 2024.
- `[SPEC]` CLS: ≤0.1 (good); 0.1-0.25 needs improvement; >0.25 poor.
- `[SPEC]` TBT (lab proxy for INP, not a substitute): Lighthouse mobile 0–200 ms fast · 200–600 ms moderate · over 600 ms slow (Chrome Lighthouse doc, web.dev; opened 2026-11-14).

### Security
- `[SPEC]` HSTS preload eligibility requires `max-age` ≥ 31536000 + `includeSubDomains` + `preload`; preload is opt-in and not easily undone (§14).
- `[SPEC]` HTTPS: lightweight direct ranking factor (Google 2014, affects <1% of queries directly). Required for HTTP/2 and many modern browser features.

### Accessibility + UX
- `[SPEC]` WCAG: 2.2 AA.
- `[SPEC]` Color contrast: 4.5:1 normal, 3:1 large text (large = ≥24 CSS px, or ≥18.66 CSS px bold).
- `[SPEC]` WCAG 2.2.2 Pause, Stop, Hide (A): auto-moving content >5 s needs a pause control. WCAG 2.5.3 Label in Name (A): accessible name contains the visible label.
- `[SPEC]` Tap target size: WCAG 2.2 SC 2.5.8 (AA) minimum 24×24 CSS px. `[HEURISTIC]` 48×48 px platform guidance.
- `[SPEC]` WCAG 2.4.1 Bypass Blocks (A): a mechanism to bypass repeated blocks — skip link, landmarks or headings each suffice (W3C, opened 2026-11-13).
- `[SPEC]` Viewport meta: `width=device-width, initial-scale=1` (Chrome Lighthouse viewport doc, opened 2026-11-13). `[FIELD]` Lighthouse 12 passed `initial-scale=1` alone.
- `[HEURISTIC]` Engagement rate target: >20% (GA4).
- `[HEURISTIC]` Image alt text: every meaningful image.
- `[HEURISTIC]` Image format: WebP or AVIF.
- `[HEURISTIC]` Image responsive: `srcset` + `sizes` + width/height attributes.

### International
- `[SPEC]` Hreflang symmetric: page A ↔ page B mutual references required.

### Freshness
- `[HEURISTIC]` Content freshness: 30 days for priority pages, 90 days general max.

### AI ecosystem
- `[STUDY]` AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta-ExternalAgent, Bytespider) executed no JavaScript in the Vercel+MERJ analysis of 500M+ crawls (vendor study, 2024 data; retagged from [SPEC] 2026-11-01). Googlebot fully renders JS; Applebot may render in a browser (Apple doc 2026-09-04). Bingbot "partial rendering" not re-verified. Claude-SearchBot and agentic browsers not covered.
- `[STUDY]` 2026 single-site server log (Forge AI Bot Log, 2026-09-24; vendor; user agents not IP-verified): no script fetches by ChatGPT-User, Claude-User, PerplexityBot, ClaudeBot, GPTBot; scripts fetched by MistralAI-User, DuckAssistBot, YouBot — detail in §14.
- `[SPEC]` Google-Extended and Applebot-Extended are robots.txt control tokens, NOT separate crawlers with their own user-agent strings. Google-Extended governs Gemini training + grounding (Gemini Apps, Vertex AI) and does not affect Search inclusion/ranking or AI Overviews/AI Mode presence (Google doc 2026-10-30). Applebot-Extended governs Apple foundation-model training only (Apple doc 2026-09-04).
- `[SPEC]` Robots.txt honoring by user-triggered fetchers: ChatGPT-User "may not apply"; Perplexity-User "generally ignores"; Meta-ExternalFetcher "may bypass"; Claude-User honors (vendor docs, 2026-11-01).
- `[SPEC]` Google AI-feature controls: `nosnippet` and `max-snippet` limit direct input to AI Overviews / AI Mode (robots meta doc 2026-03-24); GSC "Search generative AI" property control (launched 2026-06-03; global 2026-08-31; default Include; not a ranking signal).
- `[STUDY]` ChatGPT Search citations: 87% correlation with Bing top 10 when browsing active (Seer Interactive, Feb 2025). `[SPEC]` OpenAI documents its own ChatGPT search crawler `OAI-SearchBot`; current Bing dependence unverified as of 2026-11-01.
- `[STUDY]` Citation source patterns from Profound 30M-citation analysis (Aug 2024 - June 2025): Wikipedia 47.9% of ChatGPT top citations, Reddit 46.7% of Perplexity top citations, Reddit 21% of Google AI Overviews top citations. Patterns shifting — Q1 2026 data shows YouTube overtaking Reddit as #1 social source across LLMs. [UNVERIFIED as of 2026-11-01] (original source, windows and metric definitions not re-verified).
- `[STUDY]` 80% of LLM-cited URLs do not rank in Google's top 100 (sample-bound; reflects that AI citation logic differs from classic ranking). [UNVERIFIED as of 2026-11-01]
- `[STUDY]` Perplexity citation lift: 3.2× for content updated <30 days vs >90 days (single Profound study; not verified as industry constant). [UNVERIFIED as of 2026-11-01]
- `[STUDY]` BlockRank (UT Austin + Google + Google DeepMind research paper, arXiv 2510.05396, Oct 2025): production use in AI Overviews unconfirmed by any Google Search document (retagged from [SPEC] 2026-11-01). `[SPEC]` AI Overviews default model: Gemini 3 (since 2026-01-27). Query fan-out: "a set of concurrent, related queries generated by the model" — no count published; a published "up to 16 sub-queries" figure has no T1 basis. Multi-source synthesis differentiates AI Overviews from single-source Featured Snippets.
- `[STUDY]` AIO click impact (Seer Interactive v3, 2026-04-24; 53 brands, 5.47M queries, Jan 2025–Feb 2026; vendor, correlational): informational 2025 avg organic CTR 2.07% cited-in-AIO vs 0.94% uncited vs 3.35% no-AIO; AIO-query CTR 1.31% (Dec 2025) → 2.36% (Feb 2026); AIO on 36% informational / 8% commercial / 5% transactional queries. Ahrefs (2025-04-17): −34.5% position-1 desktop CTR vs forecast (300k keywords, Mar 2024 vs Mar 2025). Pew (2025-07-22; 900 US adults, Mar 2025): 8% click a result when an AI summary is present vs 15% without; 1% click inside the summary. Off-site detail → `seo-geo-offsite-findings-2026-11-01.md`.
- `[SPEC]` Retirements: FAQ rich results 2026-05-07; HowTo 2023-09-14; Course info, ClaimReview, Estimated salary, Learning video, Special announcement, Vehicle listing 2025-09-09; Practice problem 2026-01-06; Book actions retained (2025-11-05); Dataset = Dataset Search only. GSC Mobile Usability report / Mobile-Friendly Test / API retired 2023-12-01. `&num=100` removed 2025-09-12.
- `[SPEC]` GA4 native "AI Assistant" default channel (definition: GA4 Help; launch date 2026-05-13 per GA4 Help "What's new") — excludes AI Overviews / AI Mode. GSC Generative AI performance report (Search + Discover) since 2026-06-03 (impressions only). Bing AI Performance report public preview 2026-02-10.
- `[SPEC]` GA4 enhanced measurement: page views, scrolls, outbound clicks, site search, video engagement, file downloads, form interactions; `tel:` / `mailto:` not listed. BigQuery export holds no data from before the link date (GA4 + Firebase Help, opened 2026-11-14).
- `[SPEC]` IndexNow participants (2026-11-01): Amazon, Bing, Naver, Seznam.cz, Yandex, Yep; batch POST ≤ 10,000 URLs.
- `[SPEC]` Google UCP agentic checkout: eligible products US / Canada / Australia; select merchants; integration via API, MCP or A2A; `native_commerce(checkout_eligibility)` attribute (Merchant Center Help, 2026-11-01).
- `[SPEC]` Confirmed Google ranking updates 2025-01-01 → 2026-11-01: 11 (6 core/Discover, 5 spam) — see §35.
- `[STUDY]` EU AI Act Art. 50 applicable 2026-08-02; Digital Omnibus in force 2026-07-27 (high-risk delays only); Art. 50(2) legacy-system marking grace to 2026-12-02 (≥3 independent legal summaries).
- `[SPEC]` Mistral tokens `MistralAI-Index`, `MistralAI-User`, `MistralAI-Training`; DuckDuckGo `DuckAssistBot` (not used for training; robots.txt opt-out applies after 72 h) — vendor pages opened 2026-11-14.
- `[HEURISTIC]` AI answer panel (§27): 10–20 fixed prompts; owner-run; P1 or launch, then +4 and +12 weeks; not a gate; never in REVIEW mode.

---

## 33. Expert-Tier / Superpower Moves

Advanced on-site or one-shot-setup techniques used by top practitioners. Higher-effort, higher-leverage than baseline implementation. Order is not priority — pick by site stage + resources.

### Set up at launch (not deferred) [HEURISTIC]
One-time or unrecoverable-later items, handled in P10 (resource hints in P7). Each applies only when its gate is true. Everything else in §33 stays deferred.
- **GA4 → BigQuery export** [gate: GA4 in use AND owner approves a Google Cloud project]: link at launch. Firebase Help: "Data prior to linking to BigQuery is not available for import"; GA4's native export has no backfill (Google developer forum answers; opened 2026-11-14). [SPEC] Owner item: new dependency and possible cost (§0 Confirm before acting).
- **Resource hints** [T1+]: `preconnect` only to origins needed for the first render (font host, image CDN, consent or tag host); `preload` only the LCP image or render-blocking fonts (§14, §15). Check a lab run: LCP must not regress.
- **Knowledge Panel claim** [gate: a panel already exists for the brand]: owner item. Site side: Organization `sameAs` + consistent naming (§24, §25).
- **Editorial / review standards page** [gate: SP6 or publisher]: who writes, who reviews, sourcing, corrections — only what the organization actually does; linked from the footer and from author / reviewer bylines.
- **Search data retention** [gate: owner wants history beyond 16 months]: GSC keeps 16 months; start an export (Search Console API → BigQuery, below) before the oldest data needed ages out.
- **AI answer panel** → §27 (baseline at P1 or after launch).

### Technical

**Log file analysis** — Parse raw server logs for bot user-agents (Googlebot, Bingbot, PerplexityBot, ClaudeBot, GPTBot, OAI-SearchBot, anthropic-ai). Reveals: which URLs are crawled vs ignored, crawl frequency by template, redirect chains hit in practice, AI-bot crawl share. Tools: Screaming Frog Log Analyzer, GoAccess (free CLI), Botify, OnCrawl.

**Edge SEO via CDN workers** — Run SEO logic at the CDN edge (Cloudflare Workers, Vercel Edge Functions, Fastly Compute). Fix canonicalization, inject schema, manipulate headers, set redirects, handle hreflang — without origin code deploys. High leverage when dev cycles are slow.

**Internal PageRank flow modeling** — Crawl the site, run PageRank on internal link graph, surface trapped equity (footer-only links to important pages) and undervalued pages. Tools: Sitebulb internal PageRank score, Screaming Frog Link Score, custom Python on crawl exports.

**JavaScript SEO forensics** — Diff rendered DOM vs raw HTML. Use GSC URL Inspection live test → "View tested page" (screenshot, rendered HTML, console) + view-source vs DevTools elements panel. (The Mobile-Friendly Test and its API were retired 2023-12-01.) Confirms what crawlers actually see. Critical for SPAs and heavy-JS frameworks.

**Crawl budget engineering** — `robots.txt` segmentation + sitemap prioritization + internal link distribution engineered to direct crawler attention to commercial pages. Matters at >10k URLs.

**Resource hints** — `<link rel="preload">` for critical assets, `<link rel="preconnect">` for known external origins, `<link rel="dns-prefetch">` for likely-needed domains. Direct LCP improvement. Most sites don't use these.

**Server-side SEO A/B testing** — Test title/meta/on-page changes at statistical scale to measure CTR + ranking impact. Tools: SearchPilot, Distroscale, RankScience. Enterprise-tier; almost no SMBs do this.

### Content + Topical Authority

**Information Gain Score optimization** — Systematically add what no competitor has: proprietary data points, original frameworks, named expert quotes, unique imagery, first-hand experience markers. Tools: MarketMuse, Frase, Surfer for gap detection.

**Entity coverage scoring** — Map every entity top-ranking competitors mention; ensure your page covers them with semantic precision (not keyword matching). Tools: InLinks, WordLift, MarketMuse.

**Programmatic SEO at scale** — Templated coverage of a vertical: 500-5,000 pages from a structured data source (currency pairs, integration pages, city pages, glossary terms). Requires data feed + page template + unique-value-per-page logic. Guardrail: Google's scaled content abuse policy targets pages generated in bulk mainly to manipulate search rankings rather than help users (spam policies, 2026-08-28; verbatim wording in §6) — pages without distinct user value must not ship. [SPEC]

**First-party data publishing** — Publish proprietary data competitors can't replicate (pricing benchmarks, usage stats, survey results, original research). On-site asset; becomes a reference page LLMs ingest into training corpora and AI search systems retrieve repeatedly for the data itself.

**Tool-as-content** — Build a free interactive tool on-site solving a narrow problem in the vertical (calculator, validator, generator, comparator). Drives repeat AI citations because the tool itself is the citable resource.

**SERP-derived topic cluster** — Pull top 10 ranking pages for every target keyword, extract their H2s + entities, build the union as your coverage target.

### GEO / AI-Search

**Cross-LLM citation tracking** — Daily automated prompt testing across ChatGPT, Claude, Perplexity, Gemini, Copilot, You.com, Phind for target queries. Reveals what's cited, paraphrased, where competitors win. Tools: Profound, Athena HQ, Otterly.AI, Peec AI, AI Brand Monitor.

**Prompt-pattern reverse engineering** — Real AI prompts differ from Google queries ("I have X and tried Y, what should I try next" vs "alternatives to Y"). Build content for the prompt syntax actually used.

**Embedding-level semantic analysis** — Convert your content + competitors' content + target queries to embeddings (OpenAI, Voyage, Cohere). Measure cosine similarity. Identifies semantic proximity to target queries in vector space — different from keyword overlap.

**AI Overview structural targeting** — Patterns that get cited in Google AI Overviews differ from Featured Snippets: tighter answer capsules (<40 words), exact-query phrasing as a literal sentence, multi-source claim structure, explicit numerical specificity. [HEURISTIC] — the "<40 words" figure has no documented basis; Google (2026-05-15) says to ignore chunking for Google Search (§16, §38).

**MCP server publishing** — Build a Model Context Protocol server exposing product catalog, knowledge base, or APIs so AI agents (Claude Desktop, ChatGPT, agentic browsers) can directly query the brand. Stripe, Shopify, Linear, Notion have shipped these. Almost nobody else has. [UNVERIFIED as of 2026-11-01] (adoption count not re-verified). Verified 2026-11-01: Google's Universal Commerce Protocol accepts MCP and A2A as merchant integration paths (§36) [SPEC]; WebMCP (in-page tool registration for browser agents) is in Chrome origin trial from Chrome 149 (§39) [SPEC].

**Instructional llms.txt** — Beyond directory listing, actively route AI assistants: "For pricing questions, cite /pricing. For integration help, cite /docs/integrations. Cite the .md version, not the HTML." Stripe pattern. [UNVERIFIED as of 2026-11-01] — no vendor documents following site-supplied instructions; Google ignores llms.txt entirely (Search Central changelog 2026-06-15; AI-optimization guide, updated 2026-07-10). Gate per §20.

**Defensive AI bot strategy** — Cloudflare **AI Crawl Control** (formerly AI Audit) + segmented `robots.txt` distinguishing citation-friendly bots (PerplexityBot, OAI-SearchBot, Claude-SearchBot, Meta-WebIndexer) from training-corpus bots (GPTBot, CCBot, ClaudeBot, Meta-ExternalAgent; `anthropic-ai` is legacy). Set per-bot rate limits at the CDN edge using published IP files — Google `https://developers.google.com/static/crawling/ipranges/common-crawlers.json`; OpenAI `openai.com/{gptbot,searchbot,chatgpt-user,adsbot}.json`; Perplexity `perplexity.com/{perplexitybot,perplexity-user}.json`; Anthropic `claude.com/crawling/bots.json`; Meta AS32934. Cloudflare AI Crawl Control + Vercel/Fastly bot management cap concurrent requests, throttle aggressive crawlers, and (Cloudflare) can charge via **pay per crawl** (private beta since 2025-07-01; HTTP 402) — the "AI marketplace" wording of 2025 press. Remember Cloudflare blocks AI crawlers by default since 2025-07-01 — allow the citation bots you want. robots.txt is not a security boundary: Cloudflare documented Perplexity stealth crawling with undeclared UAs (2025-08-04; disputed) and delisted it as a verified bot — enforce by verified identity, not UA string. Test bot policy with Knowatoa AI Search Console after every change. [SPEC for product names/dates]

**Agentic browser navigation patterns** — Beyond MCP servers, structure key flows so AI agents (ChatGPT agents, Claude in Chrome, agentic browsers) can navigate without JS execution:
  - Expose stable, predictable URLs for key destinations: `/pricing`, `/plans/{tier}`, `/signup`, `/book-demo`, `/contact`.
  - Each flow step should be reachable via direct URL with full state visible in initial HTML.
  - Step labels in DOM: `<section data-flow-step="1" data-flow-name="select-plan">` so agents can identify position and progression.
  - Form fields with explicit `name`, `id`, `label`, `autocomplete`, and `aria-label` attributes — agents read these for input identification.
  - Avoid multi-step modals that hide state behind JS; prefer multi-page flows or visible expandable sections.
  - `data-flow-step` / `data-flow-name` attributes are a [HEURISTIC] with no vendor backing. The vendor-backed path is **WebMCP** (Chrome origin trial from 149; declarative form annotations + imperative `document.modelContext.registerTool`) — experiment only; see §39. Standard `name` / `id` / `<label>` / `autocomplete` / ARIA remain the accessibility-tree inputs agents read. [SPEC status]

**Self-served structured Q&A endpoint** — `/api/faq.json` or `/api/qa.json` serving machine-readable answers to top queries about brand/products. Direct ingestion path for agents.

### Entity Engineering

**Knowledge Panel claim** — One-shot via Google Search ("Claim this knowledge panel" button when logged in as authorized representative). Then curate via on-site Organization schema: official site, social profiles, full sameAs network across verified profiles.

**Advanced author entity building** — Beyond Person schema: ORCID iD, Google Scholar profile, LinkedIn with full credentials, About-page author profile with bio + image + credentials + publications + sameAs network linking all of the above. Each author becomes a recognized entity.

**Editorial standards page** — Publicly publish: editorial policy, fact-checking process, sourcing standards, correction policy, who reviews content, conflict-of-interest policy. Healthline, NYT, Guardian style. Strong E-E-A-T signal almost no SMB publishes.

**Citation network engineering** — Authors citing other named experts with proper attribution and links (internal Person profiles + outbound to expert's site). Builds recognizable expert clusters that LLMs ingest as networks, not isolated names.

**`sameAs` saturation** — Don't stop at LinkedIn + Crunchbase. Add: GitHub (if technical), Wikidata, Wikipedia, Bloomberg, industry directories, professional licensing bodies, conference speaker pages, academic profiles. Each verified link strengthens entity disambiguation.

### Analytics + Measurement

**GA4 → BigQuery raw data export** — Free tier supports it. Bypass GA4 UI limits, query raw event data with SQL. Cohort analysis, custom attribution, anomaly detection. Most marketers never enable this even though it's free.

**Search Console API → BigQuery** — Pull beyond the 1,000-row UI limit, retain >16 months of data, query historic position/CTR/impressions with SQL. Free.

**Custom share-of-voice dashboard** — Define competitor set + target keyword cluster, calculate weighted SoV (impressions × position decay), track shift monthly. Tools: Looker Studio + GSC + rank tracker data. Beats generic "industry visibility" estimates.

**Algorithm update tracker alerts** — Set up alerts: Semrush Sensor, Mozcast, SISTRIX VOI, Algoroo. When traffic shifts, attribute correctly to confirmed updates instead of guessing — the T1 record is the Google Search Status Dashboard ranking history (names, start dates, durations; §35). Google also runs smaller unannounced core updates (2025-12-09), so not every shift maps to a named update. [SPEC]

**Bing Webmaster Tools AI Performance Report** — Public preview 2026-02-10; Topics Portfolio beta 2026-10-13. Shows which of your pages are cited by Copilot / Bing AI answers (citations, cited pages, grounding queries per trade press; no clicks; no API — API on backlog per S). Free. Google's counterpart: GSC Generative AI report (2026-06-03, impressions only). [SPEC dates]

**Regional / local Search units** — Google documents regional Search differences (2026-09-08) and aggregator/supplier units for local-business queries (2026-09-18). Check regional feature availability before promising local units. [SPEC]

### Meta-Patterns

- Measure causation, not correlation — server-side A/B testing, counterfactual reasoning when traffic moves.
- Build durable assets — tools, datasets, methodologies that compound over years vs. tactics that decay.
- Operate at entity level, not keyword level — Knowledge Graph thinking vs SERP thinking.
- Go where competitors won't — log analysis, embedding analysis, edge SEO, MCP servers.
- Instrument before optimizing — tracking and dashboards built FIRST, optimizations second.

---

## 34. Coverage Confirmation

Moved verbatim to `on-site-seo-geo-reference-v4.6-archive.md` (sources merged, merge and field-test records, scope excluded, items dropped). Not needed to implement. Off-site scope: §0 EP-1.

---

## 35. Google Ranking Changes Log

Source: Google Search Status Dashboard ranking history (T1), verified 2026-11-01; November 2026 core update row added 2026-11-12 (dashboard opened 2026-11-12). Newest first. This table is a dated snapshot: before interpreting a current ranking change, re-open the dashboard; during an active rollout avoid causal conclusions from timing alone and compare after completion + 1 week. Use start → end as attribution windows; measure after completion + 1 week. No independent winner/loser analysis was verified for any update — none recorded. No update confirmed 2026-10-09 → 2026-11-01.

| Update | Start | End (computed from duration) | Type | On-site implication |
|---|---|---|---|---|
| November 2026 core update | 2026-11-10 | not listed on the dashboard as of 2026-11-12 (treat as in progress) | Core | Do not attribute movement inside the window to site changes; compare after completion + 1 week |
| September 2026 spam update | 2026-09-24 | 2026-10-08 (13 d 16 h) | Spam | Drops inside the window → audit against §29 spam policies first |
| August 2026 spam update | 2026-08-18 | 2026-08-21 (2 d 16 h) | Spam | Same |
| June 2026 spam update | 2026-06-24 | 2026-06-26 (2 d 1 h) | Spam | Same |
| May 2026 core update | 2026-05-21 | 2026-06-02 (11 d 21 h) | Core | No Google companion post; separate AI-feature impression changes via GSC Generative AI report |
| March 2026 core update | 2026-03-27 | 2026-04-08 (12 d 4 h) | Core | Attribution window |
| March 2026 spam update | 2026-03-24 | 2026-03-25 (19 h 30 m) | Spam | Ended 2 days before the March core update began (no overlap) — attribute drops on 03-24/25 separately from drops from 03-27; verify dashboard timestamps |
| February 2026 Discover update | 2026-02-05 | 2026-02-27 (21 d 17 h) | Discover core | Segment Discover from web Search before diagnosing; Google expanded Discover guidance 2026-02-05; preferred-image guidance (schema.org `image` / `og:image`) followed 2026-03-02 |
| December 2025 core update | 2025-12-11 | 2025-12-29 (18 d 2 h) | Core | Google (2025-12-09): smaller ongoing core updates also run — recovery need not wait for a named update |
| August 2025 spam update | 2025-08-26 | 2025-09-22 (26 d 15 h) | Spam | "applies globally and to all languages" |
| June 2025 core update | 2025-06-30 | 2025-07-17 (16 d 18 h) | Core | "rollout may take up to 3 weeks" |
| March 2025 core update | 2025-03-13 | 2025-03-27 (13 d 21 h) | Core | "rollout may take up to 2 weeks" |

Policy / guidance changes affecting ranking interpretation: spam policies apply to generative AI responses (2026-05-15); back button hijacking added to malicious practices (2026-04-13); spam reports may trigger manual actions (2026-04-14, criteria clarified 2026-04-23); site reputation policy EEA enforcement adjusted (2026-08-28); generative-AI content guide synced with Quality Rater Guidelines (2026-10-01). [SPEC]

Revealed signals (US v. Google remedies, 2024 Content Warehouse leak, patents): not investigated in any merged run — gap.

---

## 36. Agentic Commerce Readiness (gate: SP2=Y AND SP10=Y)

On-site + feed requirements for AI-assistant shopping surfaces. All items [SPEC] (vendor docs verified 2026-11-01) unless tagged.

**Channel gates:** one channel never activates another. Merchant Center participation → feed consistency checks only (price, availability, return policy, shipping identical across feed, markup and page). Google UCP / native checkout → only when the owner requests agentic checkout and eligibility + integration access are confirmed. OpenAI discovery feed → only when ChatGPT shopping is explicitly selected and production onboarding requirements are confirmed. Otherwise N/A (reason); no scaffolding, feeds or owner-approval queues for an unselected channel.

### Google — Universal Commerce Protocol (UCP)
- Enables a checkout button ("Buy") on eligible product listings in AI Mode (Google Search) and Gemini; Google Pay checkout; merchant remains seller of record. Launched 2026-01-11; available for select merchants, rolling out in phases.
- Eligibility: products eligible in the United States, Canada and Australia; participating merchants/partners submit an interest form and meet Merchant Center requirements.
- Integration paths: API, MCP or A2A (UCP standardizes the exchange between the AI agent and the merchant backend). Shopify merchants: via Shopify's UCP implementation ("Agentic Storefronts"; Shopify Engineering, T4).
- Only listings carrying the `native_commerce(checkout_eligibility)` Merchant Center attribute show the Buy button.
- On-site rule: price, availability, return policy and shipping terms must be identical across Merchant Center feed, JSON-LD (§24 merchant markup) and the visible page. Divergence breaks eligibility and trust.
- Expansion beyond US/CA/AU and self-serve onboarding: vendor-reported only → §39.

### OpenAI — product discovery feeds (ChatGPT shopping)
- Use the **Stable** feed schema; **Draft** "is published for planning and feedback only" and "is not supported for production integrations yet".
- Nine required discovery fields: `item_id`, `title`, `description`, `url`, `brand`, `seller_name`, `image_url`, `availability`, `price`.
- One row per purchasable item or variant; stable identifiers; never encode price in an offer ID ("Never include price in an offer ID"); never invent GTINs.
- Market scope: "The standard OpenAI-format upload currently targets the US"; an omitted/empty `target_countries` "does not mean worldwide".
- Checkout "requires a separately enabled integration"; "Setting an eligibility flag does not complete checkout onboarding". Feed acceptance ≠ checkout enrollment (Agentic Commerce Protocol checkout → §39).
- Source: developers.openai.com/commerce/specs/file-upload/products (no publication date shown; accessed 2026-11-01).

### Cross-platform
- Keep `OAI-SearchBot`, `PerplexityBot`, `Meta-WebIndexer`, Googlebot allowed (robots.txt AND CDN) — feeds supplement crawling, they don't replace it.
- Perplexity / Copilot merchant programs: not investigated in merged runs — gap.

---

## 37. Preferred Sources (gate: publisher pursuing Google Preferred Sources)

- Google Preferred Sources lets users select publishers they want to see more of in Search (Top Stories; description from general knowledge — doc body not opened 2026-11-01); documentation launched 2026-01-30; expanded to all Google Search languages 2026-04-30; rolling out to AI Overviews and AI Mode since 2026-05-27; a custom interactive "add as preferred source" button for publisher pages documented 2026-08-20. [SPEC — changelog entries; doc bodies not opened]
- Implement the documented button on article templates and prompt loyal readers; it is user opt-in, not a ranking boost, and guarantees no AI citation.
- Hard Don't: never present Preferred Sources enrollment as a general ranking or AI-visibility guarantee.

---

## 38. Retired Guidance (do NOT implement — kept for traceability)

Moved verbatim to `on-site-seo-geo-reference-v4.6-archive.md`. Retired lines are refuted or superseded rules: never restore one from memory, from a checker or from an older copy of this handbook. A rule you expect but cannot find here → check the archive's §38 before adding it.

---

## 39. Watchlist (unproven — do NOT implement)

| ID | Item | Status (2026-11-01) | Grade / tier | Revisit trigger | Source |
|---|---|---|---|---|---|
| F-01 | WebMCP — pages register tools for in-browser agents (`document.modelContext.registerTool`; `navigator.modelContext` deprecated Chrome 150); W3C Web ML CG draft; Edge behind flag | Chrome origin trial from Chrome 149 (doc 2026-05-18, upd. 2026-10-07) | T1 status; API details S | Ships in stable Chrome; second browser ships | https://developer.chrome.com/docs/ai/webmcp |
| F-02 | Google UCP expansion beyond US/CA/AU; self-serve onboarding | ANNOUNCED (vendor-reported) | T4 | Merchant Center Help lists new countries | https://support.google.com/merchants/answer/16837055 |
| F-03 | OpenAI Agentic Commerce checkout (separate enablement); Draft feed schema; non-US feed markets | Feeds LIVE; checkout gated; Draft unsupported | T1 | OpenAI announces production support / new markets | https://developers.openai.com/commerce/specs/file-upload/products |
| F-04 | Bing AI Performance API | Backlog, no timeline | S | Bing Webmaster blog/API changelog | https://blogs.bing.com/webmaster/ |
| F-05 | UK CMA conduct requirements: page-level AI-feature / grounding controls from Google (deadline reported 2027-03) | UNVERIFIED (S only) | S | Google doc update; CMA notice | https://www.searchenginejournal.com/what-opting-out-of-googles-ai-search-features-means-now/584321/ |
| F-06 | Content Signals (`Content-Signal:` robots.txt) and IETF AIPREF vocabulary/attach drafts — vendor honoring | Mechanism LIVE at Cloudflare; Anthropic honors an AIPREF-based signal since 2026-10-30; Google states intent to support AIPREF early 2027; AIPREF itself still draft; no other vendor documented | T1 (Anthropic, Google docs 2026-11-12); signal syntax UNVERIFIED | Any vendor doc stating it honors `ai-train` / `ai-input` | https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ ; IETF draft-car-ai-txt-wellknown-00 |
| F-07 | AIO CTR trajectory — Seer v3: AIO-query organic CTR 1.31% (2025-12) → 2.36% (2026-02); informational no-AIO 4.91% (2026-02) | E3 trend, vendor | T4 | Seer v4 / independent replication | https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update |
| F-08 | GA4 "AI Assistant" channel referrer list completeness (Perplexity not named by Google; Claude named in "What's new" but not on the channel-definition page) | Open | T1 doc | Google publishes the list or names more sources | https://support.google.com/analytics/answer/9756891 |
| F-09 | Agentic browsers (user-driven) rendering JavaScript vs the zero-JS crawler finding (§14) | Uninvestigated | — | Vendor doc or independent log study | — |
| F-10 | Ahrefs 2026 re-run: AIO ≈ −58% position-1 CTR (Dec 2025 data) | Reported via S; original not opened | E3 / S | Open Ahrefs update article | https://ahrefs.com/blog/ai-overviews-reduce-clicks/ (editor's note) |
| F-11 | RSL (Really Simple Licensing), TDMRep, `X-Robots-Tag` AI values — vendor honoring | Uninvestigated | — | Vendor docs | — |
| F-12 | Independent winner/loser analyses for 2025–2026 core/spam updates | None verified | — | Named analyst with disclosed n | — |
| F-13 | `<link rel="alternate" type="text/markdown">` discovery for Markdown mirrors — any AI consumer reading it | Field practice (2026-11); no consumer documented | [FIELD] / no tier | A vendor doc names it | — |
| F-14 | Homepage / generic-page redirects treated as soft 404 — current T1 wording | Observed in GSC (field); not in current Google redirect or HTTP-errors docs (2026-11-11) | [FIELD] + legacy T2 | Google doc restates it | https://developers.google.com/search/docs/crawling-indexing/http-network-errors |
| F-15 | EU Digital Omnibus on AI (in force 2026-07-27; reg. no. 2026/1744 per one summary): two new AI Act Art. 5(1) prohibitions — non-consensual intimate material (ba), CSAM generation (bb) — apply from 2026-12-02 | CONFIRMED by ≥3 independent legal summaries + one aggregator stating EUR-Lex verification (re-opened 2026-11-14); Official Journal text not opened | T4 | Official Journal text | — |
| F-16 | EU Digital Omnibus (data part), ePrivacy Art. 5(3): Council mandate agreed 2026-10-21 — consent still required except six purposes (incl. first-party audience measurement); 4-month re-ask wait after refusal; browser-signal duty (Art. 88b) removed; application date bracketed (24 months after adoption), not final | Council mandate only; Parliament position not adopted; trilogue not started (as of 2026-10-25; one trade-press source) | T4 | Parliament position, trilogue agreement or Official Journal text | https://ppc.land/eu-council-agrees-4-month-cookie-re-ask-wait-for-digital-omnibus-talks/ |
| F-17 | Crawler tokens + robots.txt behavior for xAI / Grok, DeepSeek, You.com, Cohere, Diffbot; robots.txt honoring of `MistralAI-User` / `MistralAI-Index` (not stated on Mistral's page) | Uninvestigated / not stated (2026-11-14) | — | Vendor doc | https://docs.mistral.ai/robots |
| F-18 | Assistant fetchers that fetched scripts in one 2026 site log (MistralAI-User, DuckAssistBot, YouBot) — do they execute JavaScript? | One vendor log study; user agents not IP-verified | [STUDY] | Vendor doc or independent replication | https://www.forgeaibotlog.com/articles/can-ai-crawlers-execute-javascript/ |
| F-19 | ChatGPT search third-party search providers: OpenAI Help names Bing; exact wording differed between two retrievals on 2026-11-14 | Open | T1 page; wording unverified | Re-open the help article | https://help.openai.com/en/articles/9237897-chatgpt-search |

---

## 40. Platform Change Timeline 2025-01 → 2026-11 (reference)

Moved verbatim to `on-site-seo-geo-reference-v4.6-archive.md` (reference only). Dated platform facts needed to implement are stated in the section that uses them.

---

## 41. Launch + Audit Checklist (field-derived index; phase/tier-keyed)

Copy into `seo-geo-status.md` at P0. Work top to bottom, one phase at a time (§0 Execution Protocol). Tags: `[T1+]` all sites · `[T2+]` · `[T3+]` · `[T4]` · `[AUDIT]` existing sites only · `[gate: …]` condition must be true. Item applies only when tier tag ≤ site tier AND gate true AND mode matches; otherwise mark `N/A (reason)`. Each line points to the governing section; implement from there. Source: field checklists (§34 Source H) + existing baseline. REVIEW mode (EP-7): walk every item in one report instead of a status file; `[AUDIT]` items apply where observable from outside.

### P0 — Intake + triage
- [ ] [T1+] `seo-geo-status.md` created: mode, tier (evidence), Site Profile (evidence + confidence), decisions, §41 statuses (§0 EP)
- [ ] [T1+] Owner questions batched in `seo-owner-todo.md` (§0 EP)
- [ ] [T1+] Platform identified (hosted builder vs own stack); each platform limit recorded with evidence (§0 EP-1)

### P1 — Audit baseline
- [ ] [AUDIT] (BUILD: at P10) GSC Domain property with full access; BWT; analytics; rank tracker; backlink tool; server/host logs connected (§26, §28)
- [ ] [AUDIT] Mode 1 vs Mode 2 per template recorded; global checks run; baseline numbers + date stored; findings severity-tagged S1–S4 (§0 EP, §17)
- [ ] [AUDIT] Evidence set captured per template + sitewide; evidence reconciliation done — every collected defect has a finding ID or a stated reason (§0 P1)
- [ ] [AUDIT] Checker-flagged issues reproduced by direct fetch before recording; checker errors logged (§0 Verification rules, §31)
- [ ] [AUDIT] (BUILD: at P10) AI answer panel: prompt list approved by the owner; first run logged — owner-run; BLOCKED (owner) if not run; never release-blocking; not used in REVIEW mode (§27)

### P2 — Architecture + rendering
- [ ] [T1+] Core content (listings, calendars, bios, prices, key facts) in server HTML (§14)
- [ ] [gate: API/backend-driven pages] API-dependent pages have a static fallback (§14)
- [ ] [gate: API/backend-driven pages] Fallback freshness: snapshot time + max age; stale transactional facts not shown as current; 503 if no reliable content (§14)
- [ ] [gate: API/backend-driven pages] Raw HTML contains no empty / loading / error strings as page copy; those states are JS-injected only (§14)
- [ ] [T1+] Total page weight recorded per template; no multi-MB photo collage or oversized original (§15)
- [ ] [gate: Event pages] Event JSON-LD: venue name + street address; `startDate` with time + offset where a time is published; price when published (§24)
- [ ] [T1+] No primary content at `opacity:0` awaiting animation; no-JS reveal if kept (§14)
- [ ] [T1+] Raw HTML (JS off) vs rendered DOM compared per template (§17)
- [ ] [T1+] One instance of each fact in the HTML; raw vs rendered visible word counts within ~20% per template (§14, §17)
- [ ] [T3+] Every detail page linked from a crawlable HTML index page (§12)
- [ ] [T2+] Header nav links to core content hubs (§8)
- [ ] [T1+] URL structure + slugs per rules (§9, §2)
- [ ] [T1+] Build command runs the full chain; sitemap/robots(/llms.txt) fresh after deploy (§14)

### P3 — Crawl + index controls
- [ ] [T1+] Apex↔www and HTTP→HTTPS: one-hop 301/308, never 302/307 (§10)
- [ ] [T1+] One trailing-slash policy on every route incl. nested; other form 301/308 (§2)
- [ ] [T1+] Nav/logo → `/`, not `/index.html`; query variants canonicalize to clean URL (§2)
- [ ] [T1+] Self-canonical; canonical = internal links = sitemap `<loc>` URL form; tracking params stripped, content-defining params kept (§10)
- [ ] [AUDIT] Moved URLs → closest relevant page; never homepage (§10)
- [ ] [AUDIT] Legacy URL map complete (old sitemap + GSC 404s + top landing pages + backlinks) (§10 Site migration)
- [ ] [gate: site retires items] Retired items: no-longer-offered page or closest equivalent; 410 if no demand (§10 Retired items)
- [ ] [AUDIT] Internal links to redirected/retired URLs updated (§10)
- [ ] [AUDIT] Hacked/spam junk URLs left 404/410 (§10)
- [ ] [T1+] Unknown URLs return real 404 (SPA catch-all checked) (§10 Soft 404s)
- [ ] [T1+] 404 body is its own template, not a live page (§10)
- [ ] [T1+] URL inventory reconciled: sitemap vs internal links vs canonicals; each `<loc>` = its page's canonical; no test, draft, duplicate or thin pages published (§17)
- [ ] [T2+] Site crawl run from sitemap + links; "pages in sitemap" vs "crawled pages in sitemap" compared (§17)
- [ ] [T2+] Hidden pages: noindex or Disallow (not both) + out of sitemap; private/staff resources unlinked; utility pages (cart, checkout, account, search, legal) still linked (§10, §12)
- [ ] [T1+] robots.txt: every named group carries the full Disallow set; only real routes; route shapes covered + tested with one named and one unlisted bot (§18 Route coverage)
- [ ] [gate: admin/staff paths exist] Admin/staff: auth + `X-Robots-Tag: noindex`, no Disallow conflict, no public links (§18)
- [ ] [T1+] Sitemap `lastmod` = last significant update; provenance per route type (CMS field / git); unknown → omit; never build, deploy or migration date (§19)
- [ ] [T3+] [AUDIT] Evergreen archive content on own domain (§10 Site migration)
- [ ] [T1+] Cross-consistency: sitemap `<loc>` host = canonical host; robots `Sitemap:` line points to the intended sitemap (cross-site sitemap host may differ) (§17)
- [ ] [T1+] Render-resource guard: no Disallow on paths fetched during rendering (§18)
- [ ] [gate: SP8 or paginated lists] Pagination: visible `<a href>` page links, self-canonical, 200; out-of-range 404 (§11)
- [ ] [gate: SP3] Facets: low-value combos Disallowed or noindex (not both); approved indexable facets crawlable + self-canonical (§11, §18)
- [ ] [gate: SP9] Internal search: Disallow OR `noindex,follow` — never both (§11)
- [ ] [gate: SP1] Hreflang reciprocal + self-referencing + x-default; no IP auto-redirects (§13)
- [ ] [gate: SP2] Variant URL contract recorded + tested per feed-linked variant (§10 Product variant URLs)

### P4 — Page templates
- [ ] [T1+] Unique title, meta description and H1 per page; consistent brand suffix (§2)
- [ ] [T1+] Titles state offer or topic (+ place for SP7) before the brand; no brand-only or bare page-label titles; H1 = page topic, not a promo (§2)
- [ ] [T1+] Meta description present and non-empty on every indexable page (§2)
- [ ] [T1+] Viewport meta = `width=device-width, initial-scale=1` (§14)
- [ ] [T1+] Titles/H1s use searched names incl. legacy/brand names (GSC queries) (§2)
- [ ] [T1+] No hard-coded years in listing/evergreen headings (§2)
- [ ] [T3+] Hub/category titles: brand + specific promise (§2)
- [ ] [T1+] Heading order, one `<main>`, nav/footer labels not headings (§3)
- [ ] [T1+] OG + Twitter tags on every page; per-page 1200×630 image, not the logo; dimensions match file (§2)
- [ ] [gate: Article pages] Article pages: `og:type=article` + published/modified times (§2)
- [ ] [T1+] `max-image-preview:large` on indexable pages (§2)
- [ ] [T1+] `target="_blank"` links: noopener; noreferrer only by intent (§12)

### P5 — Content + facts
- [ ] [T1+] Opening sentence: brand + subject + what the page gives (§3)
- [ ] [T1+] Stats single-sourced and matching across copy/meta/schema/llms.txt/About; every stat sourced + dated (§6)
- [ ] [T1+] Source check: every citation, study, quotation, testimonial and external stat fetched and confirmed at the source; none invented; none added to reach a density rule (§0 EP-1, §6)
- [ ] [T1+] No placeholder copy; no unsupported superlatives; acronyms spelled out per page (§6)
- [ ] [T1+] Page-specific FAQ only (§3, §7)
- [ ] [T1+] Page-type matrix applied: no article furniture (byline, takeaways, citation lists, visible last-updated) on home, service, product, hub, contact or legal pages unless marked (§7)
- [ ] [T1+] Brand and key-person names spelled one way sitewide; entity test passes (title + description + H1 reveal business type, and place for SP7) (§25)
- [ ] [gate: SP7] Address in standard postal format as one text block; one `tel:` format; hours in server HTML (§7, §25)
- [ ] [gate: SP7] Local pages: one page per real service / location with distinct content; no pages differing only by place or service name; service-area business publishes no street address; Google Business Profile name, address, phone, hours and URL equal the site (§7, §9)
- [ ] [gate: SP6 or publisher] Editorial / review standards page linked from footer and bylines (§33 Set up at launch)
- [ ] [T1+] Awards, press, certifications as HTML text with awarding body + year + source link (§6)
- [ ] [T1+] Prices, menus, hours and specs in table or list markup, one copy each (§14)
- [ ] [T1+] Outbound and third-party conversion links: 200 for browsers; bot-only blocks recorded; links point to final URLs (§12)
- [ ] [T1+] Primary action is a labelled button in the first mobile screen on every template (§8)
- [ ] [T3+] Detail pages: unique primary-source facts + key-facts block (§6, §7)
- [ ] [T1+] Contact route or existing contact block: verified channels in server HTML; address/phone only when supplied and approved; no invented channel or extra page (§7)
- [ ] [T2+] About page: named people + roles, Person schema, linked from author schema (§7)
- [ ] [T2+] Keyword → URL map for priority pages: one primary query + intent per URL; no two indexable URLs share a primary query; cannibalization check run; no data → BLOCKED (§1)

### P6 — Structured data + entity
- [ ] [T1+] WebSite node on home page (name, url, alternateName) (§24)
- [ ] [T1+] Platform-emitted schema inventoried; URL-valued properties absolute `https://`; no empty fields (§24)
- [ ] [T1+] One stable `@id` per real organization; full node on home/About page; no duplicate node for the same organization in a page graph (distinct organizations and location nodes keep their own IDs); identical values wherever repeated; full sameAs incl. GBP (§24)
- [ ] [gate: Article pages] Article: date-time + offset when known, verified date otherwise, never an invented time or offset; `isPartOf` WebSite; nested items named; YMYL reviewedBy/lastReviewed on WebPage (§24)
- [ ] [gate: §24 Event] Event: full address + geo, image, organizer, eventStatus, offers; time + offset (date-only if all-day); validFrom only for presales; no filler performer (§24)
- [ ] [T3+] ItemList on index pages; BreadcrumbList on detail pages (§24)
- [ ] [gate: §24 FAQPage] FAQPage only for real, page-specific, visible Q&A (§24)
- [ ] [T1+] Every JSON-LD block parses; Rich Results Test (supported features) per template; site names checked manually; Validate Fix in GSC after fixes (§0 Definition of done #4, §17, §24)
- [ ] [T1+] Generic-word brand disambiguated (naming, alternateName, sameAs) (§25)
- [ ] [gate: SP7] LocalBusiness: single location = the organization node; multi-location = per-location node + parentOrganization; owner-confirmed facts only (§24)
- [ ] [gate: SP7] LocalBusiness subtype most specific; `name` + `address` present (service-area business: public address parts + `areaServed`); no Review / AggregateRating markup about the business itself expecting stars (§24)
- [ ] [gate: a Knowledge Panel exists for the brand] Panel claim queued for the owner (§33 Set up at launch)
- [ ] [gate: SP2] Product/ProductGroup: offers, return policy, variants; price/availability identical across page, markup, feed (§24, §36)
- [ ] [gate: §24 Review / VideoObject] Review and VideoObject only for real, visible reviews/videos (§24)
- [ ] [T1+] No §24 placeholder sentinels in built HTML / JSON-LD / meta; typed whole-value match; recorded provenance exempts (§24)

### P7 — Performance + media
- [ ] [gate: §15 hero video] Hero video: poster, pause control, reduced-motion, per-device encodes with size cap (§15)
- [ ] [T1+] Every `<img>` has width/height or `aspect-ratio`; hero eager + `fetchpriority="high"` + srcset (§15)
- [ ] [T1+] Hero/LCP image is an `<img src>` in the initial HTML (no `data-src` loader, no JS carousel); photos JPEG/WebP/AVIF at display size (§15)
- [ ] [T1+] Analytics/pixels: authorized first (consent where required), then deferred after load/interaction; pre-consent requests verified; third-party weight audited (§14)
- [ ] [T1+] Bundle code-split; animation libraries lazy-loaded; render-blocking fonts preloaded (§14)
- [ ] [T1+] Resource hints: `preconnect` only to first-render origins; `preload` only the LCP image or blocking fonts; lab LCP not regressed (§33 Set up at launch)
- [ ] [T1+] Hashed assets long-cached + immutable; HTML must-revalidate (§14)
- [ ] [T1+] CLS lab-tested on every template; CrUX/GSC CWV mobile + desktop reviewed (§14)
- [ ] [T1+] Per template: lab LCP ≤ 2.5 s, CLS ≤ 0.1; CrUX when available; INP: CrUX, otherwise TBT (PSI lab) recorded as proxy + primary interactions checked (§14, §32)
- [ ] [T1+] Lab environment recorded (PageSpeed Insights preferred); "no field data" recorded when CrUX has none (§0 Verification rules)

### P8 — Accessibility + security + compliance
- [ ] [T1+] HSTS host-only (`includeSubDomains` only after subdomain check; `preload` only with owner approval), CSP incl. `frame-ancestors`, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options (legacy) (§14)
- [ ] [T1+] Contrast 4.5:1 / 3:1 large; brand accents on small text checked (§14)
- [ ] [T1+] axe-core run after full-page scroll (§14)
- [ ] [T1+] Skip link present; icon-only links and buttons named; `alt=""` only on decorative images; no filename alts (§14, §15)
- [ ] [T1+] Security headers checked by value (HSTS `max-age` > 0; CSP state recorded: enforcing / report-only / absent — allow-all = finding); platform SSL/HSTS setting inspected before marking LIMITED (§14, §0 EP-1)
- [ ] [T1+] Visible text inside accessible names; labelled inputs; distinct `<nav>` labels; scrollable regions focusable + labelled; reduced motion respected; targets ≥24 px; descriptive alt text (§14, §15)
- [ ] [gate: SP6] Legal review of pixels/analytics on condition-specific pages before launch (§30)
- [ ] [gate: forms collect health, financial, account or other sensitive data] Sensitive-form data flow inventoried + verified: fields, endpoints, logs, recipients; no sensitive values in URLs/analytics/replay/error telemetry (§30)
- [ ] [T1+] Consent banner doesn't block LCP; Consent Mode v2 where EU (§14)

### P9 — AI / GEO access
- [ ] [T1+] Each AI bot deliberately allowed/blocked; CDN/firewall checked; bot-UA fetch = 200 + full HTML on a public origin (protected preview → P10); verified-bot log check DEFERRED until real traffic (§0 P9, §18)
- [ ] [gate: §20] llms.txt (if gate applies) with numbers matching the site (§20)
- [ ] [gate: §20–22] `.md` mirrors (if gate applies): noindex or canonical header; `rel="alternate" type="text/markdown"`; key facts mirrored (§22)
- [ ] [T1+] AI-feature controls + training-bot decisions recorded (§16, §18)
- [ ] [T1+] Existing robots.txt evaluated per group (named ≠ blocked); platform AI-crawler setting recorded where the platform owns the file (§18)
- [ ] [gate: SP2+SP10] Agentic commerce readiness (§36; per-channel gates — Merchant Center consistency / Google checkout / OpenAI feed)

### P10 — Launch + indexing + measurement
- [ ] [T1+] Sitemap resubmitted; Request indexing for new pages; IndexNow pinged on deploy (§26)
- [ ] [T1+] GSC Domain property; BWT import; sitemaps submitted to both; IndexNow key + deploy ping (§26)
- [ ] [T1+] GA4 with consent; AI Assistant channel verified; custom AI group added (§27)
- [ ] [T1+] Key events defined and verified for every primary action: form, `tel:`, `mailto:`, booking / outbound, purchase (§27)
- [ ] [gate: GA4 in use AND owner approves a Google Cloud project] GA4 → BigQuery export linked at launch (§33 Set up at launch)
- [ ] [AUDIT] Validate Fix on every fixed GSC issue (§17, §24)
- [ ] [T1+] Release check: no `RELEASE BLOCKED` items before production deploy (§0 EP-1)

### P11 — Monitor + maintain
- [ ] [T1+] GSC: Page indexing (soft 404, redirect, 404), CWV (mobile + desktop), Enhancements, Generative AI (§26)
- [ ] [T1+] Re-baseline at +4 and +12 weeks: GSC Performance + Generative AI, Bing AI Performance, GA4 AI channel, key events, AI answer panel (§26, §27)
- [ ] [T1+] Outcome record: before → after per fixed finding class at +4 and +12 weeks in `seo-followups.md` (§0 P11)
- [ ] [T1+] Traffic shifts attributed to §35 windows after refreshing the Search Status Dashboard; §39 triggers checked; §33 evaluated at 6+ months (§28)

### REVIEW mode (EP-7)
- [ ] [REVIEW] Every §41 item above given PASS / finding ID / BLOCKED / N/A / LIMITED; no ranking, traffic or backlink data used (§0 EP-7) AI answer panel and keyword-map data are visibility data: not used.
- [ ] [REVIEW] Score computed per EP-7; report sections complete: top fixes (FIXABLE only), LIMITED, BLOCKED, outside scope, checker errors, residual weaknesses (§0 EP-7)
