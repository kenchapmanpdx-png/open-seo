# Defect: grade A 100/100 shown when 0 pages were read

Status: observed, not fixed. Needs a HEAVY batch (class fix + guard, B20 prevention rule: red case → class fix → guard → rerun). Not yet in `fork/queue.md` (file too large to edit from the remote session); add on the build machine.

## Red case (SUPPORTED, observed in the app UI)
- Site: zmklaw.com, run `e8f77e8b` (round 2 field test, 2026-11-24)
- Banner: "The site could not be read"
- Details panel, same run: "Grade A 100/100" and "Every automated check passed"
- Cause of the unread site: collector `site-crawl` returns `unavailable` ("no page could be fetched") when it holds 0 snapshots (`src/server/features/handbook/collectors/site-crawl.ts`)

## Class
- Any score / grade / "all passed" text computed from findings while the collectors that feed it are `unavailable`.
- Zero findings from zero evidence reads as a pass. Violates "record a finding without stored evidence" in spirit: a pass needs evidence too.

## Proposed class fix (SPECULATIVE until the code path is read)
- Grade = null ("Not graded") whenever pages read = 0 or every page-level collector is `unavailable`.
- Details copy follows the banner state; never "Every automated check passed" unless at least one page was read and no check was `unavailable`.
- Fix at the single place the grade and summary text are derived, not per screen.

## Proposed guard
- Test at the public entry point: run with 0 snapshots → grade null, summary text states the site was not read, no pass wording.
- Same test for partial reads where a collector is `unavailable`: grade carries the cap note, no pass wording for that collector's checks.
- Rerun: zmklaw.com (or its fixture) must show "Not graded" in Details.

## Related observation (SPECULATIVE)
- App Site Audit counts 404s from page-relative-link traps, query-string variants and PDF 301 variants toward its 50-page cap. A site with a link trap can hit the cap with few real pages. Verify against a run before opening a work order.
