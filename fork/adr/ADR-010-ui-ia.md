# ADR-010: UI information architecture

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- Upstream project routes live under `src/routes/_app/p/$projectId/` (audit, reports, settings, ai-visibility, …); UI components use shadcn on Base UI (`render` prop, not `asChild`), TanStack Router/Query.
- Upstream sidebar/nav is an upstream file; each new entry is a registration hook edit.

## Decision

- Routes (fork files): `src/routes/_app/p/$projectId/handbook/index.tsx` (runs list + latest grade + start run), `handbook/$runId.tsx` (tabs below), `handbook/settings.tsx` (enable flag, mode, tier override).
- Run page tabs: **Overview** (grade, phase table with weight/score/driver, Site Profile with evidence, release status) · **Findings** (by severity: code, §, title, template/URLs, fixability, effort; top fixes first) · **Checklist** (all 129 items by phase with status + note, filter by status) · **Evidence** (viewer: excerpt, header table, screenshot, link to stored body) · **Exports** (status.md, report JSON, publish client report).
- One nav entry "Handbook" in the project sidebar (single upstream registration line, logged).
- Client feature code in `src/client/features/handbook/`; data via server functions (`src/serverFunctions/handbook*.ts` → services → repositories).

## Alternatives

| Option                                | Why not                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| Extend upstream audit page with a tab | Edits upstream audit UI files; tighter coupling to upstream churn. |
| Standalone app                        | Loses projects/orgs/reports/MCP reuse.                             |

## Consequences

- Upstream edit: nav entry only (B2 WO).

## Verification

- B2 `review-ui-states` capture of every tab state (empty, running, failed, complete).
