# ADR-020: Supplementary rules (SUPP) and operator-disabled items

- Status: accepted
- Date: 2026-11-18 · Batch: B8 (R1)

## Context

- Spec: `fork/FULL-READ.md` §0 ([Ken] no truth / legal / external-source verification; scope = rankings, SEO, GEO), §5.5 (P5-03), §6 (SUPP-01…16, AEO section, dropped items), `fork/SCALED-COPY.md` (SUPP-17…19, B11).
- Registry today: `registry.json` / `registry.ts` = 129 handbook §41 items, scored by EP-7 (`engine/scoring.ts`, ADR-008). Golden misses that are not §41 items (ryan F17, bluetree F11 / F17 / F20, video and AEO patterns) have nowhere to land.
- P5-03 currently fetches off-site sources through `CheckContext.fetchOffsite` (cap 10 per check, contracts 1.3.0) — conflicts with [Ken] FULL-READ §0.

## Decision

- SUPP registry: separate file `registry-supp.ts` (typed TS const, not merged into `registry.json`, so handbook-sync stays a pure §41 diff). Entry: `id` `SUPP-nn`, `title`, handbook `§` refs, `class` (deterministic | render | llm), `severityDefault`, `effect` (one of ranking / SEO / GEO — the FULL-READ §0 scope test; an entry with no effect is not added), `evidence` kind.
- SUPP findings use the same finding + evidence contracts as §41 items (evidence rule unchanged) but carry `itemId: SUPP-nn`; they are reported in a separate report section **Additional findings** and are **never scored** — `scoring.ts` filters on registry membership, so EP-7 grades stay §41-only and comparable with earlier runs.
- Initial set: SUPP-01…07 (§6 table), video set SUPP-08…12, AEO set SUPP-13…16 (FULL-READ §6); SUPP-17…19 reserved for B11. SUPP-13 wording asks "intended?" and is high severity only on home / service / product pages; AEO formatting rules are low severity ([HEURISTIC] in the handbook).
- Report section **Answer-engine readiness**: built only from collected data (no new fetches), not scored.
- Operator-disabled items: P5-03 runs only when `HANDBOOK_SOURCE_CHECK=on` (default `off`). When off its status is `N/A` with note `operator: no external verification`, it is excluded from the score (N/A already is), and "claim with no on-page source" stays a P5-04 content finding. A generic `operatorDisabled` map (itemId → note) in the runner handles this, so a future [Ken] item is one line.
- Golden comparisons recompute the golden total with P5-03 = N/A (FULL-READ §8).
- Dropped [Ken 2026-11-16]: sensitive-data forms, SPF/DMARC, author archives, generator meta — no SUPP id; golden findings covering only these are classified `outside-scope [Ken]` and excluded from catch rate.
- Promotion path: if Ken adds a SUPP rule to handbook §41, the SUPP entry is deleted and the check re-registered under the new §41 id (then scored).

## Alternatives

| Option                                     | Why not                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Add SUPP rules to `registry.json` as items | Breaks handbook-sync (registry = handbook §41 verbatim); changes the grade scale                     |
| Score SUPP findings with a small weight    | Grades stop being comparable across runs and with goldens; the handbook decides scoring, not the app |
| Keep P5-03 on with a domain allow-list     | Still external truth verification, which [Ken] ruled out                                             |
| Fold AEO checks into P5-01 / P5-05         | Those items have handbook-defined scope; widening them changes §41 semantics without a handbook edit |

## Consequences

- Contracts 1.5.0 (R2): `registry-supp.ts` types; report contract gets `additionalFindings` and `answerEngineReadiness` sections; status `N/A` note for operator-disabled items.
- No schema change (findings table already stores free `item_id`); verify `item_id` has no FK to the registry in both dialects during R2.
- BadGEO: one page per SUPP rule (FULL-READ §9).

## Verification

- Scoring test: a run with SUPP findings has the same grade as without them.
- Runner test: `HANDBOOK_SOURCE_CHECK` unset → P5-03 `N/A` with the operator note, no `fetchOffsite` call.
- BadGEO: every SUPP rule caught, 0 unexpected.
