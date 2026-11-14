# ADR-008: Scoring per EP-7 (K6) — design only

- Status: accepted (design); build in B3
- Date: 2026-11-14 · Batch: B1

## Context

- Handbook EP-7: phase score = passing ÷ applicable × 100; PARTIAL 0.5, LIMITED 0.5; BLOCKED and N/A excluded; P0, P1, P10, P11 unscored; weights P2–P6 15, P7–P8 10, P9 5; any open S1 caps total at 39; grade A ≥ 85 · B 70–84 · C 55–69 · D 40–54 · F < 40; scores compare only within one handbook version; ranking/traffic/backlink data excluded in REVIEW.

## Decision

- `score({ handbookVersion, mode, items: { itemId, phase, status, openSeverities[] }[] }) → { phases: { phase, weight, applicable, points, score|null }[], uncapped, final, capReason|null, grade, handbookVersion }`.
- Item score: PASS 1 · PARTIAL 0.5 · LIMITED 0.5 · OPEN 0 · BLOCKED/NA/DEFERRED excluded.
- A phase with 0 applicable items has `score: null` and its weight is redistributed proportionally across scored phases (handbook is silent; documented choice so totals stay on 0–100).
- `REVIEW` items (`RV-*`) are not scored (they are report-procedure items).
- Cap: any finding with severity S1 and status OPEN/PARTIAL → `final = min(uncapped, 39)`, `capReason` lists finding codes.
- Scorer is a pure function; inputs never include DATA-class metrics.

## Alternatives

| Option                    | Why not                                     |
| ------------------------- | ------------------------------------------- |
| Treat empty phases as 0   | Penalizes T1 sites for inapplicable phases. |
| Treat empty phases as 100 | Inflates totals.                            |

## Consequences

- Grade always printed with handbook version.

## Verification

- Unit tests reproduce the two golden audits' grades from their expected item statuses (B3).
