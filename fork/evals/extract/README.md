# PageProfile extraction eval (B8 R3.4; scorer built in B9, WO-B9-025)

Checks the LLM **map** stage (FULL-READ §5.1, K14 `contracts/page-profile.ts`):
for each golden site, the quotes a `PageProfile` must contain so the reduce
stage (K15 `SiteFactMap`) can rebuild the golden findings. Extraction only — no
verdicts, no truth checks ([Ken] FULL-READ §0).

Files: one `<site>.yaml` per golden (`fork/fixtures/expected/<site>.expected.yaml`).
Every quote was checked verbatim (case-insensitive, whitespace-collapsed)
against the live page text on 2026-11-18.

## Case format

```yaml
site: bluetreefunding.com
origin: https://bluetreefunding.com
cases:
  - golden: F13 # finding id in the expected YAML
    url: /medical-funding/
    field: stats # K14 PageProfile array: names | stats | prices | superlatives | awards | placeholders | undefinedAcronyms | faqQuestions | freshness
    quote: "96 % Approval Rate"
    expect: { value: "96" } # optional: field values the entry must carry (stats.value, names.kind, awards.source / hasYear / hasSource)
```

## Scorer spec (`fork/scripts/extract-eval.ts`, WO-B9-025)

    pnpm exec tsx fork/scripts/extract-eval.ts <run-dir|--live> [--site why|ryan|blue] [--model slug]

1. Input: the `handbook_page_profile` rows of a run (CLI `--out` dir writes
   `page-profiles.json`), or `--live`: fetch each case URL and run the map
   prompt directly (costs one map call per URL; prints the estimate first).
2. A case is **found** when the profile for `url` has an entry in `field` whose
   `quote` (or `text` for name / text spans) contains the case quote after
   normalising both sides: lower-case, Unicode NFKC, collapse whitespace, strip
   `™ ® ©`. `expect` keys must match the entry (string equality after the same
   normalisation; booleans exact).
3. A case whose URL now returns ≠ 200 or whose quote is no longer in the raw or
   rendered page text → `site-changed` (excluded from the rate, like
   `golden-score.ts`).
4. Output: `fork/evals/results/<date>-extract-<model>.md` — table per site
   (golden, url, field, quote, found | missed | site-changed, entry seen) and
   the headline: found / (cases − site-changed), dropped-quote count per page
   (profiles' `droppedQuotes`).
5. Threshold (FULL-READ §5.1): ≥ 90 % found with the extract model; below →
   the run uses the Sonnet fallback and records it in ADR-019's build log.
   Exit 1 when under threshold.
