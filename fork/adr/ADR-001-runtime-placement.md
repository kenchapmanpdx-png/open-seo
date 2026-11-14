# ADR-001: Runtime placement of the handbook engine

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- `runAuditPhases` (`src/server/workflows/siteAuditWorkflowPhases.ts`) runs discovery → crawl → Lighthouse → `finalizeAudit` (multipage checks, then `finalize`). Every step goes through `pgStep` (review invariant: no raw `step.do`).
- Upstream does not persist raw HTML: `audit_pages` (`src/db/audit.schema.ts`) keeps extracted fields only (title, canonical, robots meta, word count, `content_hash`, `x_robots_tag`, …). Raw HTML exists only in memory inside crawl-chunk steps.
- Step outputs are capped near 1 MiB (comment in `runDiscoveryPhase`); the isolate has 128 MB and `vite-plugin-lean-worker-bundle.ts` fails the build when a denylisted dependency becomes eagerly reachable.
- `fork/scripts/upstream-audit.ts` already runs upstream detection (`crawlPage`, `discoverUrls`, `parseRobotsTxt`, `createCrawlThrottle`) under Node via `pnpm tsx`, so upstream audit code is importable outside workerd.
- Runtime host is Ken's computer (BLUEPRINT §3.7); the Cloudflare deploy is unused.

## Decision

- Engine core (`src/server/features/handbook/engine/`) is runtime-agnostic: plain async functions taking a `HandbookRuntime` (fetch, clock, evidence store, sidecar client, logger). No `cloudflare:workers` import anywhere under `engine/`, `collectors/`, `checks/`.
- Two adapters share the core:
  1. Workflow adapter `src/server/features/handbook/workflow/runHandbookPhase.ts`: called from `runAuditPhases` after `runLighthousePhase`, before `finalizeAudit`. One-line hook:
     `await (await import("@/server/features/handbook/workflow/hook")).runHandbookPhase(step, { auditId, workflowInstanceId, projectId, startUrl });`
     `hook.ts` reads the project flag (`handbook_project_setting.enabled`) in a `pgStep`; disabled → return. Enabled → dynamic-imports the engine. Each engine stage (intake, collectors, clustering, render samples, checks, reconcile, score) is its own `pgStep` named `handbook-<stage>-v1`; stage results persist to DB, step returns only ids/counts (< 1 MiB).
  2. CLI adapter `fork/scripts/handbook-audit.ts`: same stages in-process, writes to `fork/runs/<domain>/<date>/` and (optionally, `--db`) to the DB.
- The handbook phase re-fetches page HTML itself (upstream discards it): it reads the crawled URL list from `audit_pages` (status 200, indexable or not), fetches raw HTML through `publicFetch` with `createCrawlThrottle`, stores a gzip snapshot per URL in the evidence store (ADR-003) and keeps only parsed facts in memory per chunk (chunks of 25 URLs per step).
- Handbook failure never fails the upstream audit: the hook catches, marks `handbook_run.status = failed` with an error code, and returns.

## Alternatives

| Option                                            | Why not                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Separate `HandbookWorkflow` binding               | Needs `wrangler*.jsonc` + standalone runtime edits (more upstream edits); kept as fallback if the hook proves fragile. |
| Hook inside crawl-chunk steps to reuse raw HTML   | Edits upstream crawl internals in several places; couples to upstream refactors; step-size risk.                       |
| Persist raw HTML upstream (`audit_pages.raw_key`) | Schema change to an upstream table; not allowed by FORK.md.                                                            |
| CLI-only engine                                   | No in-app runs, no UI/MCP; rejected by BLUEPRINT §0.                                                                   |

## Consequences

- Upstream edits: one line in `runAuditPhases` (logged in `fork/UPSTREAM-EDITS.md` when added in R4).
- Second fetch of each page (≈2× origin requests); acceptable at ≤ a few hundred pages on a local runtime and throttled per origin.
- Content can drift between upstream crawl and handbook fetch; checks use handbook snapshots only, never mixed.
- `engine/` must stay free of eager heavy deps; lean-bundle plugin enforces it for the worker.

## Verification

- `siteAuditWorkflowPhases.test.ts` still green with the hook (flag off path is a no-op).
- Unit test: hook returns without importing the engine when the flag is off.
- CLI and workflow runs on BadGEO produce identical item statuses (R4 harness).
