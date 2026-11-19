# ADR-023: Copy quality section

- Status: accepted
- Date: 2026-11-19 · Batch: B11 (R1)

## Context

- Spec: `fork/SCALED-COPY.md` §0 (no detector, no authorship wording), §4 (gate, text and tokens, metrics E7a … E12, output, label line), §6 (flags), §7.
- Research: `fork/research/human-writing-guide-v1-excerpts-2026-11-18.md` (thresholds, guide §14 G-10: not validated).
- Existing: `engine/html-facts.ts` builds `PageMarkup` (headings with landmark, `text` = all visible text ≤ 20 000 chars, no paragraph boundaries); `engine/boilerplate.ts` gives template boilerplate blocks (`TemplatesData.templates[].boilerplate.blocks`, block = `p` / `li` / `h1–h6` / `td` text); `contracts/page-profile.ts` `PAGE_TYPES` (K14) has `contact`, `legal`, `category` but no `form`, `listing` or `hub` names.
- Runs start from the upstream audit hook (`workflow/hook.ts`); the Handbook tab has a settings form (enabled, mode, tier), no run form. CLI flags exist for depth / lighthouse / llm (`fork/scripts/handbook-audit.ts`); the app reads env only (`engine/depth.ts` resolvers). So the "per-run option" plumbing SCALED-COPY §1 assumes does not exist in the app (R1.2 finding → built in R2 / WO-B11-002).

## Decision

- Prose capture in the crawl: `extractHtmlFacts` adds `PageMarkup.prose?: {h2: number, text: string}[]` — text of each `<p>` outside header / nav / footer / aside / form / li / td / th / blockquote, whitespace collapsed, with the index of the preceding H2 (−1 before the first). Capped at 20 000 chars per page like `text`. Always collected (cheap, in memory while the body is); used only when the gate is on.
- Library `engine/copy-metrics.ts`: pure functions, one per metric id (E7a, E7b, E9, E13, E6a, E6b, E17, E19, E16, E4, E5, E8, HB5, E11, E10, E15, E12), plus `words`, `sentences` (abbreviation list from §4.2), `properNouns`. Thresholds and word lists are constants copied from §4.3 verbatim.
- Section builder `engine/copy-quality.ts`: `buildCopyQuality({snapshots, templates, profiles})`. Prose = page `prose` minus paragraphs equal to a template boilerplate block. Gate per page: lang absent or `en*`; prose words ≥ 200; PageProfile.pageType not `contact`, `legal`, `category` (K14 names for contact / legal / listing-index; `form` has no K14 name and is covered by `contact`); no profile → the page-type rule is skipped. Else `not measured (<reason>)`.
- Output (K report 1.7.0, `copyQuality?`): per page `{url, template, proseWords, measured: true, metrics[{id, value, threshold, over}], overCount}` or `{url, measured: false, reason}`; site `{medians[{id, value}], byTemplate[{template, medians}]}`; pages sorted by `overCount` desc, then URL. Number-only metrics (E5, E10, E15) have `threshold: null`, `over: false`.
- Label line verbatim from §4.4, printed before the numbers on the run page, in markdown and in the report JSON (`copyQuality.label`).
- Flag: `HANDBOOK_COPY_QUALITY` (`off` default | `on`), CLI `--copy-quality`; per-run option = `RunInput.options.copyQuality`. App: project setting `copyQuality` (boolean, default false) on `handbook_project_setting`, set by a "Copy quality" checkbox in the Handbook tab settings card; it applies to every following run (there is no run form). Setting wins over env when true; env `on` applies when the setting is false (env is the operator default).
- Determinism: no clock, no randomness, no LLM, no fetch; sorting stable. Two runs over the same snapshots → byte-identical JSON (test).
- Not scored, no finding ids, no severity; metric names and per-page lines carry no `AI`, `human`, `detector` wording.

## Alternatives

| Option                                                     | Why not                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Re-parse raw bodies from the evidence store at report time | One store read per page; the crawl already has the body                                       |
| Split `markup.text` into paragraphs                        | `text` has no paragraph boundaries and includes nav / footer                                  |
| Per-run option only in the CLI, app env-only               | §6 asks for a Handbook-tab control; env changes need a redeploy                               |
| Add a run form / "Run now" button                          | New run trigger path (billing / lease) outside B11 scope; the settings checkbox is reversible |

## Consequences

- Schema: `handbook_project_setting.copy_quality` and `.serp_originality` (boolean, default false), both dialects, one migration each (fork migration numbering: append after the existing fork migrations; the pending upstream-rebase renumbering plan in `fork/reports/B10.md` R1.1 grows by one file per dialect).
- K2 1.7.0 additive: `PageMarkup.prose?`. Snapshot memory + ≤ 20 kB per page at 1000 pages (≤ 20 MB).
- Thresholds are the guide's; changed only via MAINTENANCE M4.

## Verification

- One unit test per metric id (WO-B11-001).
- Fixtures: one page over on every threshold metric, one control page over on none; two runs byte-identical; 0 LLM calls (judge / mapper stubs count calls).
- Grep (§8): no `Pangram`, `GPTZero`, `AI-generated`, `AI-written`, `human-written`, `detector` in new code / templates / fixtures.
