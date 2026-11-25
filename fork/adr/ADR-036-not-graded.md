# ADR-036: a run that read no page is not graded

- Status: accepted (B21 run 99, WO-B21-001)
- Contracts: additive optional `score.notGradedReason` in the K7 report schema. `CONTRACTS_VERSION` stays 1.11.0 (sidecar health check needs an exact match; the sidecar does not read the field).

## Context

zmklaw.com run `e8f77e8b` read no page (`pages` collector unavailable) and showed "Grade A 100/100" and "Every automated check passed". No check passed vacuously: `missingInput` already turns every check whose collector is unavailable into BLOCKED. The handful of items that need no page (robots.txt, HTTP headers) passed, and BLOCKED items leave the formula, so those few alone scored 100. WO-B20-010 had fixed one screen (`unreadSiteReason` in the Fix list); every other consumer read `score.grade` itself.

## Decision

- `scoreReport` sets `score.notGradedReason` when `run.coverage.read === 0`, or when the run has no coverage and an item carries the runner note `pages unavailable: …` (the stored zmklaw run). A legacy run without coverage and without that note stays graded.
- `contracts/grade-view.ts` is the one reader: `gradeView(score)` → graded / not-graded / none; `gradeLabel` for lists and summaries; `noFindingsText` for empty states ("passed" only when pages were read and no check was blocked by an unavailable collector).
- Persisted: a not-graded run stores NULL grade / score and `cap_reason = "not graded: <reason>"`; `listUngradedRuns` skips rows with a cap reason, so `ops backfill-grades` does not pick them again. No schema change.
- Guard: `grade-view.test.ts` renders every consumer for a not-graded report (no letter, no "/ 100", no pass wording) and scans the handbook + agency sources for `score.grade` / `score.final` outside an allow-list.

## Alternatives

- Grade from PASS items only when ≥ N page items are applicable: a threshold with no handbook basis.
- Persist `read: 0` coverage for unavailable crawls only: misses runs already stored without coverage.
