# Grade cap note for the handbook Project (B19 WO-B19-011)

For Ken's handbook Project. The app does not change scoring: the cap is the handbook's rule (§ scoring, "any open S1 → total ≤ 39", marked [HEURISTIC]) and `engine/scoring.ts` `S1_CAP` implements it. The Fix list now shows the score before the cap next to the capped grade.

## Six field sites (latest stored CLI run per site, 2026-11-23)

| Site                     | Run                       | Capped (final) | Uncapped | Grade | Open S1 at the time                                                                                                 | S1 after B19 fixes                                                                                 |
| ------------------------ | ------------------------- | -------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| nwpersonaltraining.com   | field-2026-11-22 (500 p.) | 39             | 39.8     | F     | P2-01 core content added by JavaScript · P3-04 non-canonical link form · P9-01 bots do not get the browser response | P2-01 and P9-01 stand (real); P3-04 depends on whether the links point at canonicalised duplicates |
| spoiledspaandsalon.com   | b18r88                    | 52.6           | 52.6     | D     | none                                                                                                                | none                                                                                               |
| salonvata.com            | b18r88                    | 39             | 39       | F     | none (the uncapped score is itself 39)                                                                              | none                                                                                               |
| aircorheatingcooling.com | field-2026-11-23 (whole)  | 29.5           | 29.5     | F     | none (P3-20 was S2: not measured)                                                                                   | the 15-page rerun found one false S1 (P3-20, review widget varies between renders): fixed run 91   |
| valentinecoffeeco.com    | field-2026-11-23 (60 p.)  | 39             | 41.9     | F     | P3-04 link to `?page=1` · P3-20 Shopify scripts blocked by robots.txt                                               | both were false positives: P3-04 → S3 (run 90), P3-20 → S4 when unchanged (WO-004 + run 90)        |
| wsparkdental.com         | field-2026-11-23 (18 p.)  | 35.8           | 35.8     | F     | P3-04 home has no canonical (real, live 2026-11-23)                                                                 | stands (uncapped is already below 39, so the cap does not change the grade)                        |

## What the numbers say

- The cap changed the score on two of six sites and the grade on one: nwpersonaltraining 39.8 → 39 (F either way; D starts at 40), valentinecoffeeco 41.9 → 39 (D → F).
- On valentinecoffeeco both capping S1s were false positives that B19 fixed, so its F came from the cap applied to wrong findings; with the fixes it reads D 41.9.
- Three of six sites score F without any cap (aircor 29.5, wsparkdental 35.8, salonvata 39). Low scores on small-business sites come from many S2 / S3 findings, not from the cap.
- The real S1s (wsparkdental: home has no canonical; nwpersonaltraining: core content only after JavaScript) sit on sites already below 40, so on these six sites the cap changed no grade through a real S1.

## Decision for the handbook (Ken)

The cap value (39) and whether it applies to every S1 are handbook decisions. Options the data supports:

1. Keep the cap as is. It only bites when a site is otherwise D or better and has a real S1.
2. Cap only on S1s that block indexing (noindex, robots Disallow on content, canonical errors), not on S1s that degrade rendering.

The WO-B19-090 reruns (eight goldens, live) refresh the "after" column with measured scores.
