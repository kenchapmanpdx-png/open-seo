# NoRobots — GoodGEO without a robots.txt (WO-B20-011)

GoodGEO with no `/robots.txt` (404); the sitemap stays. Expected: one P3-15
finding "No robots.txt (HTTP 404)" (S3, on `/robots.txt`) and no P3-19
"robots.txt has no Sitemap: line"; nothing else.

    FIXTURE_ROOT=fork/fixtures/norobots pnpm exec tsx fork/scripts/badgeo-run.ts
