# ADR-012: Exports (K7) — status file, report JSON, client report

- Status: accepted; markdown exports built in B3 (`src/server/features/handbook/export/markdown.ts`), client report + publishing in B4
- Date: 2026-11-14 · Batch: B3

## Context

- Handbook EP-5 defines `seo-geo-status.md` (template), `seo-audit-baseline.md` (finding table) and EP-6 reporting; EP-7 says REVIEW mode writes one report and no status files, with a fixed section list.
- K7 `reportJsonSchema` (`contracts/exports.ts`) is the machine-readable result of a run; K6 fills `score`.
- Upstream reports (`reports` table) store one complete HTML document per row (inline CSS, no scripts, ≤ 500 KB), scoped by project; `ReportService.saveReport` creates/updates; members view at `/r/$reportId` (print → browser PDF); public share at `/s/$token` (noindex, Better Auth deployments only). There are no typed sections.

## Decision

### 1. Report JSON (source of every export)

- `report.json` = `reportJsonSchema` v1. Every other export renders from it, never from the DB or the run directly, so a saved report.json re-renders identically. `score` is recomputed with `scoreReport` when a report predates K6.
- Grade always printed with `handbookVersion`. LLM findings carry `source: "llm"`, never cap the grade, never set release status.

### 2. Markdown by mode

| Mode                     | Files                                        | Renderer                                  |
| ------------------------ | -------------------------------------------- | ----------------------------------------- |
| BUILD / AUDIT / MAINTAIN | `seo-geo-status.md`, `seo-audit-baseline.md` | `renderStatusMd`, `renderAuditBaselineMd` |
| REVIEW                   | `review-report.md`                           | `renderReviewMd`                          |

- `seo-geo-status.md` follows the EP-5 template line for line: `# SEO/GEO Status`, the `handbook: | mode: | tier: | updated:` line, Site Profile, Decisions (run fills canonical host and CDN; the rest are owner decisions, left blank), Phase gates `| Phase | OPEN/PASS/FAIL/BLOCKED/N/A | date | evidence |`, Release, Checklist `- [STATUS] [tag] item (§) — note`, Blocked / owner needed, Deferred (trigger).
- Status words in the status file use handbook vocabulary: PASS → `DONE`, NA → `N/A`, PARTIAL → `OPEN` with note `partial` (the handbook has no PARTIAL item status; EP-7 scoring keeps it). Phase gate: any OPEN/PARTIAL → FAIL; else any BLOCKED → BLOCKED; else any PASS/LIMITED → PASS; else N/A.
- REVIEW report sections, in order (`REVIEW_REPORT_SECTIONS`): header (handbook version, date, mode, tier, platform, evidence list) · grade + phase table (weight, score, driver = two most severe findings behind the phase's OPEN/PARTIAL items) · Site Profile · top fixes (FIXABLE, severity then effort, merged by identical fix) · findings by severity `| ID | § | Finding | Evidence |` · passes · LIMITED · BLOCKED · outside scope · checker errors · residual weaknesses.

### 3. Client report (B4)

- Content model = the REVIEW report, rewritten for a business owner: grade card (grade, handbook version, date) · "what we checked" (pages, templates, evidence types) · top fixes (plain-language title, why it matters, effort, affected URLs ≤ 5) · findings by severity with evidence (excerpt + screenshot where stored) · passes (count + short list) · what needs owner access (BLOCKED) · platform limits (LIMITED) · method note (handbook version, no ranking/traffic data, LLM-judged items marked).
- Rendered server-side from report.json into one self-contained HTML document (inline CSS, screenshots inlined as compressed data URIs within the 500 KB cap; over the cap → thumbnails only and a link list).
- In the app: saved with `ReportService.saveReport({ skill: "handbook-audit", … })` — no upstream edit; listing, view, print-to-PDF and cascade delete come for free. Share outside the app: Vercel snapshot (ADR-011), because upstream `/s/` needs a public app.
- Release status and LLM findings are labelled; nothing in the client report says "release blocked" on an LLM verdict.

## Alternatives

| Option                                       | Why not                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| New typed section table for handbook reports | Upstream schema change; upstream reports are HTML snapshots by design.    |
| Status file in REVIEW mode                   | EP-7: one report, no status files.                                        |
| Server PDF (headless Chrome in the app)      | Browser print already works; sidecar PDF only if B5 finds print unusable. |

## Consequences

- Golden comparisons read `report.json` + grade line (`golden-score.ts`).
- Client report HTML must stay under 500 KB; screenshot budget enforced by the renderer.

## Verification

- `export/markdown.test.ts` (template headings and vocabulary, capped grade line); `engine/scoring.test.ts` (golden whyracingevents grade from its §41 walk).
