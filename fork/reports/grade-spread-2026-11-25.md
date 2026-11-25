# Grade spread — 2026-11-25

By `fork/scripts/grade-spread.ts` (WO-B22-002). Latest stored `report.json` per site without a check error; read-only, no scoring change. Proposals are rows for Ken; default: no change.

## Sites

| Site                      | Run                                                    | Grade | Uncapped | Final | Capped by     | Non-final |
| ------------------------- | ------------------------------------------------------ | ----- | -------- | ----- | ------------- | --------- |
| aircorheatingcooling.com  | `fork/runs/aircorheatingcooling.com/b21r100`           | F     | 29.5     | 29.5  | —             |           |
| aweandorderorganizing.com | `fork/runs/aweandorderorganizing.com/field-2026-11-24` | F     | 47.1     | 39    | F01           | yes       |
| bluebonnetroofs.com       | `fork/runs/bluebonnetroofs.com/field-2026-11-23`       | C     | 58.7     | 58.7  | —             |           |
| bluetreefunding.com       | `fork/runs/bluetreefunding.com/b21r101`                | D     | 42.2     | 42.2  | —             |           |
| love4pawsrescue.com       | `fork/runs/love4pawsrescue.com/field-2026-11-24`       | D     | 50.9     | 50.9  | —             | yes       |
| mobilepetgroomingaz.com   | `fork/runs/mobilepetgroomingaz.com/field-2026-11-24`   | C     | 65.3     | 65.3  | —             |           |
| nwpersonaltraining.com    | `fork/runs/nwpersonaltraining.com/field-2026-11-22`    | F     | 39.8     | 39    | F01, F02, F03 |           |
| ryanmscottsdale.com       | `fork/runs/ryanmscottsdale.com/b21r100`                | D     | 40.2     | 40.2  | —             |           |
| salonvata.com             | `fork/runs/salonvata.com/b21r100`                      | D     | 44.4     | 44.4  | —             |           |
| samanthaco.ca             | `fork/runs/samanthaco.ca/field-2026-11-23`             | F     | 46.8     | 39    | F01           |           |
| spoiledspaandsalon.com    | `fork/runs/spoiledspaandsalon.com/b21r100`             | D     | 51.6     | 51.6  | —             |           |
| theogdenver.com           | `fork/runs/theogdenver.com/field-2026-11-24`           | D     | 50.4     | 50.4  | —             |           |
| valentinecoffeeco.com     | `fork/runs/valentinecoffeeco.com/b21r101`              | F     | 43.6     | 39    | F01           |           |
| whyracingevents.com       | `fork/runs/whyracingevents.com/b21r100`                | F     | 51.6     | 39    | F01           |           |
| wsparkdental.com          | `fork/runs/wsparkdental.com/b21r100`                   | F     | 37.2     | 37.2  | F01           |           |

Skipped: none.

## (a) Grades

| A   | B   | C   | D   | F   |
| --- | --- | --- | --- | --- |
| 0   | 0   | 2   | 6   | 7   |

With an open S1 (capped at 39): 6 of 15.

## (b) Mean score per phase

| Phase | Mean | Sites |
| ----- | ---- | ----- |
| P2    | 67.1 | 15    |
| P3    | 65.2 | 15    |
| P4    | 32.2 | 15    |
| P5    | 40.3 | 15    |
| P6    | 28.6 | 15    |
| P7    | 44.8 | 15    |
| P8    | 39.5 | 15    |
| P9    | 63.3 | 15    |

## (c) Items failing nearly everywhere

items OPEN on ≥ 80 % of the ≥ 8 sites where they were scored.

| Item  | Severity default | Effect  | OPEN | Scored on | OPEN rate | Mean points lost | Proposal for Ken                                    |
| ----- | ---------------- | ------- | ---- | --------- | --------- | ---------------- | --------------------------------------------------- |
| P4-01 | S2               | search  | 15   | 15        | 100 %     | 1.8              | fails on 15 of 15 sites; keep, or re-read the check |
| P5-13 | S4               | hygiene | 15   | 15        | 100 %     | 2.6              | fails on 15 of 15 sites; keep, or re-read the check |
| P7-09 | S2               | search  | 15   | 15        | 100 %     | 1.1              | fails on 15 of 15 sites; keep, or re-read the check |
| P8-01 | S4               | hygiene | 15   | 15        | 100 %     | 1.5              | fails on 15 of 15 sites; keep, or re-read the check |
| P5-17 | S3               | both    | 14   | 14        | 100 %     | 2.5              | fails on 14 of 14 sites; keep, or re-read the check |
| P6-09 | S3               | both    | 12   | 12        | 100 %     | 1.7              | fails on 12 of 12 sites; keep, or re-read the check |
| P3-12 | S3               | search  | 14   | 15        | 93 %      | 1                | fails on 14 of 15 sites; keep, or re-read the check |
| P4-08 | S2               | ai      | 14   | 15        | 93 %      | 1.8              | fails on 14 of 15 sites; keep, or re-read the check |
| P6-01 | S2               | both    | 14   | 15        | 93 %      | 2.7              | fails on 14 of 15 sites; keep, or re-read the check |
| P7-02 | S3               | search  | 14   | 15        | 93 %      | 1.1              | fails on 14 of 15 sites; keep, or re-read the check |
| P8-04 | S2               | ai      | 14   | 15        | 93 %      | 1.4              | fails on 14 of 15 sites; keep, or re-read the check |
| P8-05 | S4               | hygiene | 14   | 15        | 93 %      | 1.5              | fails on 14 of 15 sites; keep, or re-read the check |
| P2-10 | S3               | search  | 7    | 8         | 88 %      | 1.7              | fails on 7 of 8 sites; keep, or re-read the check   |
| P6-06 | S2               | both    | 7    | 8         | 88 %      | 1.5              | fails on 7 of 8 sites; keep, or re-read the check   |
| P4-09 | S3               | search  | 13   | 15        | 87 %      | 1.8              | fails on 13 of 15 sites; keep, or re-read the check |
| P6-03 | S2               | both    | 12   | 15        | 80 %      | 2.8              | fails on 12 of 15 sites; keep, or re-read the check |
| P7-05 | S3               | search  | 12   | 15        | 80 %      | 1.1              | fails on 12 of 15 sites; keep, or re-read the check |
| P7-07 | S3               | hygiene | 12   | 15        | 80 %      | 1.1              | fails on 12 of 15 sites; keep, or re-read the check |
| P6-11 | S2               | both    | 8    | 10        | 80 %      | 1.9              | fails on 8 of 10 sites; keep, or re-read the check  |

### All scored items by OPEN rate

| Item  | Phase | OPEN | PARTIAL / LIMITED | PASS | N/A / blocked | OPEN rate | Mean points lost |
| ----- | ----- | ---- | ----------------- | ---- | ------------- | --------- | ---------------- |
| P4-01 | P4    | 15   | 0                 | 0    | 0             | 100 %     | 1.8              |
| P5-13 | P5    | 15   | 0                 | 0    | 0             | 100 %     | 2.6              |
| P7-09 | P7    | 15   | 0                 | 0    | 0             | 100 %     | 1.1              |
| P8-01 | P8    | 15   | 0                 | 0    | 0             | 100 %     | 1.5              |
| P5-17 | P5    | 14   | 0                 | 0    | 1             | 100 %     | 2.5              |
| P6-09 | P6    | 12   | 0                 | 0    | 3             | 100 %     | 1.7              |
| P5-10 | P5    | 7    | 0                 | 0    | 8             | 100 %     | 2.2              |
| P6-04 | P6    | 5    | 0                 | 0    | 10            | 100 %     | 1.5              |
| P7-01 | P7    | 3    | 0                 | 0    | 12            | 100 %     | 1                |
| P2-06 | P2    | 2    | 0                 | 0    | 13            | 100 %     | 1.6              |
| P6-05 | P6    | 2    | 0                 | 0    | 13            | 100 %     | 1.6              |
| P6-07 | P6    | 2    | 0                 | 0    | 13            | 100 %     | 1.6              |
| P6-13 | P6    | 2    | 0                 | 0    | 13            | 100 %     | 1.6              |
| P3-16 | P3    | 1    | 0                 | 0    | 14            | 100 %     | 1                |
| P5-04 | P5    | 1    | 0                 | 0    | 14            | 100 %     | 1.9              |
| P3-12 | P3    | 14   | 0                 | 1    | 0             | 93 %      | 1                |
| P4-08 | P4    | 14   | 0                 | 1    | 0             | 93 %      | 1.8              |
| P6-01 | P6    | 14   | 0                 | 1    | 0             | 93 %      | 2.7              |
| P7-02 | P7    | 14   | 0                 | 1    | 0             | 93 %      | 1.1              |
| P8-04 | P8    | 14   | 0                 | 1    | 0             | 93 %      | 1.4              |
| P8-05 | P8    | 14   | 0                 | 1    | 0             | 93 %      | 1.5              |
| P2-10 | P2    | 7    | 0                 | 1    | 7             | 88 %      | 1.7              |
| P6-06 | P6    | 7    | 0                 | 1    | 7             | 88 %      | 1.5              |
| P4-09 | P4    | 13   | 0                 | 2    | 0             | 87 %      | 1.8              |
| P6-03 | P6    | 12   | 0                 | 3    | 0             | 80 %      | 2.8              |
| P7-05 | P7    | 12   | 0                 | 3    | 0             | 80 %      | 1.1              |
| P7-07 | P7    | 12   | 0                 | 3    | 0             | 80 %      | 1.1              |
| P6-11 | P6    | 8    | 0                 | 2    | 5             | 80 %      | 1.9              |
| P4-10 | P4    | 4    | 0                 | 1    | 10            | 80 %      | 1.7              |
| P2-05 | P2    | 11   | 0                 | 3    | 1             | 79 %      | 1.7              |
| P4-11 | P4    | 11   | 0                 | 4    | 0             | 73 %      | 1.8              |
| P4-12 | P4    | 11   | 0                 | 4    | 0             | 73 %      | 1.8              |
| P8-02 | P8    | 10   | 0                 | 4    | 1             | 71 %      | 1.4              |
| P3-01 | P3    | 10   | 0                 | 5    | 0             | 67 %      | 1.1              |
| P3-08 | P3    | 10   | 0                 | 5    | 0             | 67 %      | 1.1              |
| P4-03 | P4    | 10   | 0                 | 5    | 0             | 67 %      | 1.8              |
| P6-02 | P6    | 8    | 0                 | 4    | 3             | 67 %      | 1.7              |
| P5-08 | P5    | 6    | 0                 | 3    | 6             | 67 %      | 2.3              |
| P7-04 | P7    | 9    | 0                 | 5    | 1             | 64 %      | 1.1              |
| P7-08 | P7    | 9    | 0                 | 6    | 0             | 60 %      | 1.1              |
| P9-01 | P9    | 9    | 0                 | 6    | 0             | 60 %      | 2.5              |
| P6-10 | P6    | 6    | 0                 | 4    | 5             | 60 %      | 2                |
| P2-07 | P2    | 8    | 0                 | 6    | 1             | 57 %      | 1.7              |
| P5-14 | P5    | 8    | 0                 | 6    | 1             | 57 %      | 2.4              |
| P8-06 | P8    | 8    | 0                 | 6    | 1             | 57 %      | 1.4              |
| P3-04 | P3    | 8    | 0                 | 7    | 0             | 53 %      | 1                |
| P2-09 | P2    | 6    | 0                 | 8    | 1             | 43 %      | 1.7              |
| P3-17 | P3    | 6    | 0                 | 8    | 1             | 43 %      | 1                |
| P3-03 | P3    | 6    | 0                 | 9    | 0             | 40 %      | 1.1              |
| P3-20 | P3    | 4    | 0                 | 7    | 4             | 36 %      | 1                |
| P3-02 | P3    | 5    | 0                 | 9    | 1             | 36 %      | 1                |
| P3-21 | P3    | 1    | 0                 | 2    | 12            | 33 %      | 0.9              |
| P2-12 | P2    | 4    | 0                 | 11   | 0             | 27 %      | 1.7              |
| P4-06 | P4    | 4    | 0                 | 11   | 0             | 27 %      | 1.7              |
| P5-12 | P5    | 4    | 0                 | 11   | 0             | 27 %      | 2.4              |
| P2-01 | P2    | 3    | 0                 | 11   | 1             | 21 %      | 1.6              |
| P3-11 | P3    | 3    | 0                 | 12   | 0             | 20 %      | 1                |
| P3-15 | P3    | 3    | 0                 | 12   | 0             | 20 %      | 1.2              |
| P4-04 | P4    | 3    | 0                 | 12   | 0             | 20 %      | 1.8              |
| P2-08 | P2    | 2    | 0                 | 12   | 1             | 14 %      | 1.6              |
| P3-14 | P3    | 2    | 0                 | 12   | 1             | 14 %      | 1                |
| P9-05 | P9    | 2    | 0                 | 12   | 1             | 14 %      | 2.5              |
| P0-03 | P0    | 2    | 0                 | 13   | 0             | 13 %      | 0                |
| P3-19 | P3    | 2    | 0                 | 13   | 0             | 13 %      | 1.2              |
| P2-04 | P2    | 1    | 0                 | 9    | 5             | 10 %      | 1.5              |
| P7-06 | P7    | 1    | 0                 | 13   | 1             | 7 %       | 1.1              |
| P8-09 | P8    | 1    | 0                 | 14   | 0             | 7 %       | 1.4              |
| P0-01 | P0    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P0-02 | P0    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P1-02 | P1    | 0    | 0                 | 14   | 1             | 0 %       | 0                |
| P1-03 | P1    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P1-04 | P1    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P2-02 | P2    | 0    | 0                 | 10   | 5             | 0 %       | 0                |
| P2-11 | P2    | 0    | 0                 | 3    | 12            | 0 %       | 0                |
| P3-05 | P3    | 0    | 0                 | 8    | 7             | 0 %       | 0                |
| P3-10 | P3    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P3-13 | P3    | 0    | 0                 | 13   | 2             | 0 %       | 0                |
| P3-23 | P3    | 0    | 0                 | 1    | 14            | 0 %       | 0                |
| P5-16 | P5    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P6-08 | P6    | 0    | 0                 | 12   | 3             | 0 %       | 0                |
| P6-15 | P6    | 0    | 0                 | 12   | 3             | 0 %       | 0                |
| P7-03 | P7    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P7-10 | P7    | 0    | 0                 | 15   | 0             | 0 %       | 0                |
| P8-03 | P8    | 0    | 0                 | 14   | 1             | 0 %       | 0                |

## (d) Caps (open S1)

| Finding                                                    | Items | Sites                                                      |
| ---------------------------------------------------------- | ----- | ---------------------------------------------------------- |
| Indexable pages without a canonical                        | P3-04 | aweandorderorganizing.com, samanthaco.ca, wsparkdental.com |
| Core content is added by JavaScript (not in server HTML)   | P2-01 | nwpersonaltraining.com, whyracingevents.com                |
| Internal links use a non-canonical URL form                | P3-04 | nwpersonaltraining.com                                     |
| Bots allowed by robots.txt do not get the browser response | P9-01 | nwpersonaltraining.com                                     |
| robots.txt blocks resources needed to render the page      | P3-20 | valentinecoffeeco.com                                      |
