---
name: handbook-audit
description: Run and read an OpenSEO handbook SEO/GEO audit through the handbook MCP tools — start a run, read the grade and findings, export the status file, and save the client report. Use when asked to audit or review a site against the handbook, explain a handbook grade, or publish a handbook client report.
metadata:
  internal: true
---

Fork-only skill (not shipped in the OpenSEO plugin). Tools: `handbook_audit_run`, `handbook_findings_get`, `handbook_status_export`, `handbook_report_publish`.

## Pick the mode

The mode is a project setting (Handbook tab); `handbook_audit_run` refuses a `mode` that differs from it.

- **REVIEW** — read-only assessment of a site you do not run (prospect, competitor, first look). Outputs the EP-7 graded report. Never uses ranking, traffic, or backlink data.
- **AUDIT** — the site is a client's and you will fix it. Outputs the status file with release gates.
- **BUILD / MAINTAIN** — new build or recurring check of a live client site.

When unsure, use REVIEW: it changes nothing and its report is client-safe.

## Run it

1. `handbook_audit_run({ projectId })`. It starts a site audit crawl (same credits and limits as `run_site_audit`) and returns `runId`. A refusal (capacity, concurrency, handbook off) comes back as text: relay it.
2. Poll `handbook_findings_get({ projectId, runId })`. "Not found" means the crawl is still running; wait a minute between polls. `status: completed` with a grade means done.

## Read the grade

- The grade compares only with runs on the **same handbook version** (`handbookVersion`). Say the version when you quote a grade.
- `capReason` set → an S1 problem capped the grade. Lead with that fix: it lifts the grade most.
- A provisional grade (render evidence missing) can still drop once render checks run. Say so.
- "AI-reviewed" findings came from the LLM judge. Quote them as review notes; they never block a release.
- "platform limit" (LIMITED) findings cannot be fully fixed on the site's platform; give the workaround, not a promise.

Never quote rankings, traffic, or backlink numbers in a handbook review, even if other tools have them.

## Report back

Reply with: grade + handbook version, the cap reason if any, the top three fixes (code, one line each), and the dashboard link. Do not paste the whole findings list.

- Status file for the repo: `handbook_status_export({ projectId, runId, format: "status-md" })`.
- Client report: `handbook_report_publish({ projectId, runId })` saves it privately in Reports. Share it publicly only when the user asks (upstream `set_report_sharing`).
