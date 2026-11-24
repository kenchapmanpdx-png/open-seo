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

## Measured after B19 (WO-B19-090 live reruns, final code, 2026-11-24)

| Site                     | Run     | Capped (final) | Uncapped | Grade | Open S1                                                                                                 |
| ------------------------ | ------- | -------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------- |
| whyracingevents.com      | b19r92  | 39             | 51.6     | F     | P2-01 core content added by JavaScript                                                                  |
| ryanmscottsdale.com      | b19r92  | 40.2           | 40.2     | D     | none                                                                                                    |
| bluetreefunding.com      | b19r92  | 39             | 42.2     | F     | P3-04 non-canonical link form · P9-01 bots do not get the browser response                              |
| salonvata.com            | b19r92e | 44.4           | 44.4     | D     | none                                                                                                    |
| spoiledspaandsalon.com   | b19r92  | 51.6           | 51.6     | D     | none                                                                                                    |
| wsparkdental.com         | b19r92  | 37.2           | 37.2     | F     | P3-04 home has no canonical                                                                             |
| aircorheatingcooling.com | b19r92b | 29.5           | 29.5     | F     | none (P3-20 measured on the whole site: S4)                                                             |
| valentinecoffeeco.com    | b19r92d | 39             | 40.7     | F     | P3-20 `/cart`: with `/cart.js` blocked the cart's "Spend $50.00 more for free shipping" line disappears |

- The cap changes the grade on three of eight sites: whyracingevents D 51.6 → F, bluetreefunding D 42.2 → F, valentinecoffeeco D 40.7 → F.
- whyracingevents (12.6 points) and bluetreefunding are capped by S1s that render or crawl access really depends on (content only after JavaScript; bots get a different response).
- valentinecoffeeco is capped by a real but small measured difference: seven words of cart messaging on `/cart`. Under option 2 below it would not cap (a cart page's free-shipping nudge does not block indexing); under option 1 it does.
- A third option the data suggests: cap only when the S1 affects an indexable content page (not cart, account or checkout pages).

The "Six field sites" table above is the before (stored runs as of run 91).
