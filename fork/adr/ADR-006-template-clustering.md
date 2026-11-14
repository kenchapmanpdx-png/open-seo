# ADR-006: Template clustering and sampling

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- EP-7: above ~50 URLs sample ≥ 1 URL per template; P7 gate is per template; render/axe/Lighthouse cost ~10–40 s per URL on a local sidecar.
- Upstream keeps `content_hash` per page but no structural signature.

## Decision

- Template key = `pathPattern + ":" + skeletonHash8`.
  - `pathPattern`: path segments; a segment becomes `*` when it is numeric, a slug containing a digit, a UUID/hash, or when ≥ 3 sibling URLs share every other segment. Root `/` is its own pattern.
  - `skeletonHash`: sha256 of the raw-HTML tag sequence of `<body>` with text, attributes (except `class` tokens on landmark elements), and repeated sibling runs collapsed; first 8 hex chars. Pages whose pattern matches but skeleton differs split into separate templates.
- Samples per template: up to 3 — `first` (shortest URL), `median` (median raw byte size), `largest` (largest raw bytes); deduplicated; templates with 1–2 pages sample all.
- Raw-HTML checks run on every fetched page; render/perf/a11y and LLM checks run on samples only; findings on samples name the template so the report says "template X (n pages)".
- Hard cap 40 sampled URLs per run (config); beyond the cap, templates with the most pages win and the rest are LIMITED `sample cap`.

## Alternatives

| Option                            | Why not                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| Path pattern only                 | Mixed templates under one path (`/blog/*` lists + posts) hide defects. |
| DOM tree-edit distance clustering | Costly, non-deterministic thresholds; overkill for ≤ 500 pages.        |
| Render every page                 | Hours per run on a local sidecar.                                      |

## Consequences

- Clustering is a pure function over snapshots; testable without network.

## Verification

- Unit tests with synthetic URL sets; golden sites' template count recorded in R4 report.
