# GoodGEO — clean fixture site (WO-B19-008)

Four clean pages for a small local business. Nothing should fire here: every
finding is a false positive and every "check contract violation" is a check
bug (a PASS path that carries no evidence). Same server and harness as BadGEO:

    FIXTURE_ROOT=fork/fixtures/goodgeo pnpm exec tsx fork/scripts/badgeo-run.ts

`_headers.json`, `_bots.json`, `_redirects.json`, `_expect.json` follow the
BadGEO format (see `fork/fixtures/badgeo/README.md`).
