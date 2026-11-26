# Field rerun — five sites through "Check a site" (2026-11-25)

Purpose: train the app. No code changes. Build: running app built 2026-11-25 17:30 MST, after the last `src` commit (`4699ffd1`); `ops status` before and after: `health_ok=true`, `maintenance=off`, `test_mode=off`.

Method: the in-app Check a site page (`/p/<project>/handbook/check`) filled by a scratch Playwright script (website, size, "Leave out sections", "Include the full SEO / GEO / AEO check" on), then `bash fork/scripts/run-local.sh ops e2e <label> --audit <id>` to poll and read the UI. The harness's own `--via check-page` mode only does Quick and cannot fill "Leave out sections".

## Results

| #   | Site                    | Size · pages read                  | Grade (before → now) | Findings (before → now) | Final | AI cost | Audit      | Harness |
| --- | ----------------------- | ---------------------------------- | -------------------- | ----------------------- | ----- | ------- | ---------- | ------- |
| 1   | nwpersonaltraining.com  | Whole site · 96 (86 pages checked) | F 39 → F 39          | 72 → 66                 | yes   | $0.43   | `a6af196e` | PASS    |
| 2   | love4pawsrescue.com     | Quick · 22                         | D 52.2 → D 52.2      | 46 → 45                 | yes   | $0.02   | `f590a4e7` | PASS    |
| 3   | theogdenver.com         | Quick · 14                         | D 49.6 → D 51.7      | 66 → 53                 | yes   | $0.19   | `907d0a17` | PASS    |
| 4   | bluebonnetroofs.com     | Quick · 2                          | D 53.5 → D 53.5      | 27 → 27                 | yes   | $0      | `cacb82a9` | PASS    |
| 5   | mobilepetgroomingaz.com | Quick · 5                          | C 63.2 → C 63.2      | 29 → 29                 | yes   | $0      | `24413df1` | PASS    |

Findings counts agreed between the database, the runs list and the run page on every run. Harness results: `fork/runs/_ops/e2e-field-{nwpt,l4p,og,bb,mpg}-r2.json`.

## Scope (leave-out sections)

- nwpersonaltraining.com (sitemap 1 466 URLs; core = main nav + footer ≈ 34 pages): `/blog/` (852 posts, 155 category, 151 tag, 3 author archives), `/success-stories/*/` (183; the index page kept), `/awards/` (32), `/presenter/`, `/envira/`, `/widgets/`, `*/page/`, `/?ww_type=`, `*/attachment/`, `/?attachment_id=`, `/*thank-you/`. 84 sitemap URLs left (≤ 100 limit). Check a site offers only 500 or 50 pages, so the run used Whole site and was watched for > 100 pages; it read 96: 85 sitemap pages, 2 redirects from slashless links, 9 PDFs under `/wp-content/uploads/` (should have been left out).
- theogdenver.com: `/press/?p=` (press list pages 1–6) and `/event/` (dated event posts). Verified: none read; all 10 sitemap pages read.
- love4pawsrescue.com, bluebonnetroofs.com, mobilepetgroomingaz.com: nothing to leave out; Quick (50) is the lowest size that covers the core pages.

## Changes against the previous run (by section + title; F-codes renumber per run)

- nwpersonaltraining.com (previous run 500 pages, blog included): blog-only findings gone (Article JSON-LD, demo content, placeholder text, og:type=article). Non-canonical internal links S1 → S3 (one redirect left). Grade still F, capped by S1 "Bots allowed by robots.txt do not get the browser response" (Googlebot 13/17, ClaudeBot 13/13 refused).
- theogdenver.com: six Event JSON-LD findings and the pagination findings gone (sections left out); score up for that reason.
- love4pawsrescue.com: "Outbound links are dead" gone.
- bluebonnetroofs.com, mobilepetgroomingaz.com: unchanged.

## Residual weaknesses

- SUPPORTED: Check a site cannot set a 100-page limit (sizes 500 / 50 only).
- SUPPORTED: the harness check-page mode cannot do Whole site or leave-outs; the Fix List landing was not verified for these runs.
- SUPPORTED: `/wp-content/uploads/` was not left out on nwpersonaltraining.com (9 PDFs read).
- SUPPORTED: leaving out `/event/` hid real Event JSON-LD problems on theogdenver.com; its D 51.7 is not comparable with D 49.6.
- SUPPORTED: leave-outs cannot remove one-off non-nav pages (about 12 stayed on nwpersonaltraining.com).
- SUPPORTED (resolved later, WO-B25-008): the nwpersonaltraining.com S1 rests on ClaudeBot; Googlebot's refusals were a WP Defender lockout that did not reproduce live.
- SUPPORTED: a read-only SELECT was first sent through `run-local.sh sql`, which also re-ran the idempotent `supabase-harden.sql`; no change.
