# ADR-017: Agency layer — client workspaces, white-label report, outcome record

- Status: accepted (design); build in B6, review in B7
- Date: 2026-11-14 · Batch: B5 R3 · Batch table row "016"
- Sources read: upstream `src/db/app.schema.ts` (`projects`: `organization_id`, `name`, `brand_name`, `domain`), `src/db/report-templates.schema.ts`, `src/server/features/reports/**`; fork `export/client-report.ts` (ADR-012); handbook §0 P11 + EP-5 (`seo-followups.md` outcome record)

## Context

- P5 exit: "one client report delivered end-to-end". Scope D2: internal + client deliverables, no SaaS billing work.
- Upstream tenancy: Better Auth organizations own projects (`projects.organization_id`); every query is organization-scoped (review-guidelines tenant invariant). Projects already carry `brand_name` and `domain`. Members/invitations come from Better Auth.
- Upstream `report_templates` are markdown **instructions for agents** (audience, sections, tone), not render templates. The handbook client report is rendered by the fork (`export/client-report.ts`) from `report.json` into one HTML file (≤ 500 KB), saved via `ReportService.saveReport` and optionally published to Vercel (ADR-011/012).
- Handbook P11 outcome record: per fixed finding class, before → after for the affected URLs at **+4 and +12 weeks**: index state, GSC impressions/clicks, key events, AI answer panel rows; list fixes with no measurable change; output `seo-followups.md`. Never a ranking promise.

## Decision

### 1. Workspaces = reuse, no new tenancy

- Agency = Ken's organization. Client = one **project** per client site (upstream). No new org/workspace tables, no per-client logins in v1 (clients receive published reports, not app accounts). A client who needs app access later = Better Auth invitation to a separate organization; no fork code needed.
- One fork table for client contact/report metadata: `agency_client` (`project_id` PK → projects cascade, `organization_id`, `client_name`, `contact_name`, `contact_email` nullable, `report_cadence` (`none`/`monthly`/`quarterly`), `notes`). Organization-scoped like everything else.

### 2. White-label = brand settings applied by the fork renderer

- `agency_brand` (`organization_id` PK, `agency_name`, `logo_path` (evidence store / Storage, private; inlined as data URI at render), `accent_color` (hex, validated), `contact_line`, `footer_text`, `hide_openseo_credit` bool default true).
- `client-report.ts` takes an optional `brand` input: header logo + agency name, accent color for headings/grade card, footer contact line. Absent → current neutral look. 500 KB cap unchanged (logo ≤ 50 KB after compression or the renderer falls back to text).
- Published Vercel snapshots inherit the same HTML; the `noindex` + unguessable path rules (ADR-011) unchanged.
- Upstream `report_templates`: the fork seeds one template per project on first white-label save ("Client SEO/GEO report": audience, section order matching ADR-012 client model, tone) through `ReportTemplateService` — so SAM/agents writing ad-hoc reports follow the same structure. No upstream edit.

### 3. Outcome record scheduler (+4 / +12 weeks)

- Trigger: a handbook run in AUDIT or MAINTAIN mode (never REVIEW) records a **fix batch** when the user marks findings fixed (or a rerun shows a finding class flipped OPEN → PASS). `outcome_batch` (`id`, `project_id`, `organization_id`, `baseline_run_id` → handbook_run, `fixed_at`, `finding_classes` → child table `outcome_batch_class` (`batch_id`, `item_id`, `url`)).
- Schedule rows: `outcome_check` (`id`, `batch_id` → cascade, `offset_weeks` ∈ {4, 12}, `due_at`, `status` (`scheduled`/`done`/`skipped`/`failed`), `result_run_id` nullable, `completed_at`); unique (`batch_id`, `offset_weeks`). Due-selection on the 5-minute tick (ADR-011): computer off → runs on the next tick after `due_at`; no backfill needed.
- At a due check: (a) rerun the handbook audit limited to the affected URLs (deterministic checks only — LLM checks optional and labelled); (b) collect per URL: index state (GSC URL inspection if connected, else BLOCKED), GSC impressions/clicks for the 28 days before `fixed_at` vs the 28 days before the check (if GSC connected), Bing clicks (ADR-014, if bound), AI referral + verified AI crawler hits (ADR-013, if a drain exists), AI answer panel rows for prompts mentioning the URL's topic (upstream AI visibility + ADR-015, if configured). Missing source → that cell `BLOCKED (not connected)`, never guessed.
- Store as `outcome_metric` rows (`check_id`, `url`, `metric`, `before`, `after`, `source`, `evidence_path`) — normalized, one row per metric, evidence rule satisfied by the stored source payload.
- Export: `seo-followups.md` (EP-5 file) rendered from the rows: per finding class → URLs → before/after table; "no measurable change" list; header line "not a ranking promise; handbook vX". K7 export added beside the status file (ADR-012 table gains a row). The client report gains an optional "Results since last report" section from the latest completed checks.

### 4. Contract

K13 in `src/server/features/agency/contracts.ts`: `agencyBrandSchema`, `agencyClientSchema`, `OUTCOME_OFFSETS_WEEKS = [4, 12]`, `outcomeMetricSchema`, `outcomeCheckStatusSchema`. CONTRACTS_VERSION 1.4.0.

## Alternatives

| Option                                           | Why not                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| One organization per client                      | Ken would switch orgs constantly; cross-client views impossible; nothing gained without client logins.   |
| White-label by editing upstream report pages     | Upstream edit; upstream `/r/` and `/s/` render stored HTML anyway — the fork renderer is the right seam. |
| Outcome record as a cron that reruns full audits | Cost and noise; only affected URLs and the fixed classes matter (handbook wording).                      |
| Store outcome tables as JSON per check           | AGENTS normalization rule; per-metric rows also make the client-report section a plain query.            |

## Consequences

- Outcome quality depends on connected sources; with nothing connected the record still shows the handbook rerun (fixed or regressed) and marks the rest BLOCKED — honest, still useful.
- REVIEW-mode runs never create outcome batches (EP-7).

## Verification (B6/B7)

- Renderer test: brand applied, size cap with an oversized logo → text fallback.
- Scheduler test: due-selection (+4/+12 created once; idempotent re-tick; REVIEW mode excluded).
- `seo-followups.md` renderer test on a fixture batch with one BLOCKED source.
- P5 exit: one client report with brand + one outcome check (synthetic `fixed_at` 4 weeks back on a fixture project) delivered to a published URL; live publish BLOCKED-KEN while the Vercel publish permission is open (B4).
