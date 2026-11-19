# SCALED-COPY — scaled-content checks, copy quality, copy rules · v1 · 2026-11-18

Source of truth for B11. Builds on `fork/FULL-READ.md` (B8–B10). Research: `fork/research/human-writing-guide-v1-excerpts-2026-11-18.md` ("the guide"; rule IDs W / X / E / C / Q). Decisions marked [Ken] are operator instructions; do not revisit.

## 0. Goal

- [Ken 2026-11-18] Purpose: (1) check that a site is optimized, including after a build; (2) hand a building LLM the rules so it builds optimized; (3) both available inside the app.
- [Ken] A check goes in only if it affects Google rankings, SEO or GEO. No truth or legal verification of site claims.
- [Ken] Never use an AI-detector verdict (Pangram, GPTZero, any classifier, any LLM "is this AI-written" judgment) as a check, metric, label or evidence (guide §4 Q1, Q4, Q7). No output states or implies who or what wrote a page.
- [Ken] No step needs Ken's approval or validation. Unclear → the default in this file, else the most conservative reversible option; record it in `fork/reports/B11.md`.
- Handbook §41 items stay as the handbook defines them. Everything new is SUPP (not scored) or a report section (not scored). EP-7 grade unchanged.

## 1. What exists vs what B11 adds

| Signal                                                   | Exists (after B9)                                                                                                                        | B11 adds                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Near-duplicate pages                                     | P3-12 (scored): MinHash clusters, Jaccard ≥ 0.8 (FULL-READ §3.5)                                                                         | nothing (no SUPP duplicate of a scored item)                              |
| Thin pages                                               | P3-12 (scored): < 50 main-content words (handbook §17); P5-15 (scored): thin detail pages                                                | nothing                                                                   |
| Local pages differing only by place / service            | P5-09 (scored, gate SP7): title-swap + shared sentences ≥ 0.6 (`checks/llm-templates.ts`: `swapped`, `sharedSentenceRatios`) → LLM judge | set evidence in the judge view (§3.2)                                     |
| Page per query variation / templated sets, any site type | not checked when SP7 is false; H1 / slug swaps not checked                                                                               | SUPP-17                                                                   |
| Original value vs top-10 results                         | not checked (P5-18 keyword map is BLOCKED without data)                                                                                  | SUPP-18 (AUDIT mode, flag)                                                |
| Text instructing AI assistants                           | not checked                                                                                                                              | SUPP-19                                                                   |
| Wording patterns                                         | P5-01, P5-04 (LLM, scored)                                                                                                               | Copy quality section (deterministic, flag, not scored)                    |
| Rules for a drafting LLM                                 | none in the app                                                                                                                          | Copy rules pack `fork/skills/copy-rules/SKILL.md`, served by the app (§5) |

## 2. Verdicts (guide rule → app)

| Rule                                | Verdict         | App effect                                                                                          | Ranking effect            |
| ----------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ------------------------- |
| W1, W2, E20                         | adopt-partially | pack: owner samples as optional input; blog voice needs a human edit                                | SPECULATIVE               |
| W3, W6, W9–W16                      | adopt           | pack                                                                                                | SPECULATIVE               |
| W4, W5                              | adopt-partially | pack: handbook page structure wins; rules apply inside sections                                     | SPECULATIVE               |
| W7                                  | adopt           | pack                                                                                                | SUPPORTED (Google policy) |
| W8, E18                             | skip            | email only                                                                                          | —                         |
| W17                                 | adopt           | pack; app drafting calls set no sampling override                                                   | SPECULATIVE               |
| X1–X4                               | adopt           | pack + copy quality E7, E8                                                                          | SPECULATIVE               |
| X5–X9, X12                          | adopt           | pack bans only; no site check                                                                       | —                         |
| X10                                 | adopt           | pack ban only; no site check (authorship not detectable; legal)                                     | —                         |
| X11                                 | adopt           | pack ban + P3-12 / P5-09 (existing) + SUPP-17 + SUPP-19                                             | SUPPORTED (Google policy) |
| E1, E3                              | reject          | need draft history; the app sees the published page only                                            | —                         |
| E2                                  | adopt-partially | pack instruction (rewrite keeps every number, date, name, quote)                                    | SPECULATIVE               |
| E4, E7, E8, E11, E12, E13           | adopt           | copy quality metric with the guide threshold                                                        | SPECULATIVE               |
| E5, E10, E15                        | adopt-partially | copy quality, number only (no threshold flag)                                                       | SPECULATIVE               |
| E6, E9, E16, E17, E19               | adopt-partially | copy quality, deterministic proxy (§4.3)                                                            | SPECULATIVE               |
| E14                                 | skip            | needs author samples                                                                                | —                         |
| E21, C7 (original element)          | adopt           | SUPP-18                                                                                             | SUPPORTED (Google policy) |
| E22                                 | reject          | internal process / legal; not visible on a site                                                     | —                         |
| C7 ("fact-check claims")            | reject          | [Ken] no truth checks; effort / authorship covered by P5-10, P5-17                                  | —                         |
| C10–C13                             | reject          | Medium, KDP, LinkedIn, publisher rules: not rankings / SEO / GEO                                    | —                         |
| §13 mass pages per query variant    | adopt           | SUPP-17, P5-09                                                                                      | SUPPORTED (Google policy) |
| §13 unedited AI sites at scale      | adopt-partially | P3-12, P5-15, SUPP-17, SUPP-18; "unedited AI" itself is never detected or stated                    | SUPPORTED (Google policy) |
| §13 single detector as QA gate      | adopt           | design rule: no detector anywhere                                                                   | —                         |
| §13 stock-word deletion as main fix | adopt           | design rule: copy quality lists phrase and structure metrics first, word lists after                | —                         |
| §13 em-dash ban as main fix         | adopt           | E12 listed last                                                                                     | —                         |
| §13 humanizers, prompt scrubbing    | adopt           | pack bans X6, X5                                                                                    | —                         |
| §13 AI-generated reviews            | adopt           | pack ban X10; no check                                                                              | —                         |
| §13 other rows                      | reject          | detector evasion, watermarks, EU label, Merchant Center, LinkedIn, Medium: not rankings / SEO / GEO | —                         |

## 3. Scaled-content checks

Registry: `registry-supp.ts` entries SUPP-17, SUPP-18, SUPP-19 (ids continue after SUPP-16). Reported in "Additional findings". Not scored. Finding text states the defect and the fix; no ranking-impact claim (EP-7).

### 3.1 Reporting precedence (one URL set, one finding)

1. P5-09 applies (SP7 true) and reports the pages → SUPP-17 skips those URLs.
2. All pages of a set sit in one P3-12 duplicate cluster → SUPP-17 skips the set.
3. Otherwise SUPP-17.
4. [Ken 2026-11-19] Partial overlap: a set page that also sits in a P3-12 cluster stays in the set (dropping it can drop real sets below 3 pages, e.g. bluetree /pool-spa-financing/ + /financing-hci/). Its SUPP-17 evidence names the P3-12 cluster (`alsoIn`), and the scaled-content summary counts every URL once.

### 3.2 SUPP-17 — templated / variation page set

- Scope: indexable 200 HTML pages, grouped by template.
- Reuse `swapped` and `sharedSentenceRatios` from `checks/llm-templates.ts` (move to a shared leaf module if needed; one implementation for P5-09 and SUPP-17).
- Set = connected group of ≥ 3 pages of one template; two pages are linked when their pairwise shared-sentence ratio is ≥ 0.6 (main text; site chrome excluded). Candidate pairs come from the FULL-READ §3.5 MinHash signatures (Jaccard ≥ 0.3), then the exact ratio.
- Subtype `variation`: titles, H1s or last URL segments of the set differ by one swapped term (`swapped`). Otherwise subtype `templated`.
- Finding: one per set. Evidence: URLs, subtype, swapped terms, shared ratio (min, median), own-text word count per page.
- Title: `Page set shares most of its text (N pages, median M % shared)`; `variation` adds `titles differ by one term`.
- Fix: `Merge the set into one page, or give each page content of its own (own facts, examples, prices, photos). Remove or noindex pages with nothing of their own. Google spam policies, scaled content abuse: https://developers.google.com/search/docs/essentials/spam-policies`
- Severity default S3; S2 when the set is ≥ 10 pages or ≥ 20 % of indexable pages.
- Handbook refs: §6, §9, §29.
- P5-09 judge view (SP7 true): receives the same set evidence (subtype, ratios, H1 / slug swaps).
- Thresholds (≥ 3 pages, ratio 0.6) = P5-09's existing value + [HEURISTIC]. Tuning bound in B11 R4: ratio 0.5–0.7.

### 3.3 SUPP-18 — original value vs top-10 results

- Runs only when: run mode AUDIT **and** (`HANDBOOK_SERP_ORIGINALITY=on` or the per-run option). REVIEW mode → `N/A (REVIEW mode: search-results data not used, EP-7)`. Off → not listed.
- Pages: ≤ `HANDBOOK_SERP_ORIGINALITY_MAX_PAGES` (default 10). PageProfile.pageType = service, product, guide / article or hub page (K14 names); one per template first (highest internal in-links), then fill by in-links. Never home, contact, about, legal.
- Query: one judge-model call for all selected pages. Input per page: title, H1, PageProfile.topic. Output per page: one query ≤ 8 words a searcher would type, no brand name. Stored as evidence (`querySource: derived`).
- Results: existing DataForSEO client, Google organic, live, depth 10, project location / language (default US / en). Drop the audited host and non-HTML results. Cache per (query, location, language) 7 days in the evidence store.
- Competitor pages: `ctx.fetchOffsite`, browser UA, 1 retry, 10 s timeout; main-text extraction as for site pages; profile via the §5 map model and `handbook_page_profile` cache (FULL-READ §5.1–5.2).
- Verdict: one judge call per audited page. Input: its PageProfile + main text, the competitor profiles. Question: does the page contain ≥ 1 element — first-party data, a test, a case, an expert quote, a worked example — that none of the competitor pages contain? Output `{hasOriginalElement, elements[{type, quote}], confidence}`. Quotes verified verbatim on the audited page. The prompt forbids judging truth, quality of writing or authorship.
- Finding when `hasOriginalElement = false` and confidence ≥ 0.7. Confidence < 0.7 → second call; disagreement → `unsure` (shown, FULL-READ §5.7).
- Title: `Nothing on this page that the top-10 results for "<query>" lack`. Fix: `Add at least one first-party element: own data, a test, a case, an expert quote or a worked example. Google guidance on generative AI content: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content`
- Severity default S3. Handbook refs: §6, §33.
- BLOCKED states (never a finding): < 5 competitor pages fetched → `serp pages unavailable`; DataForSEO credentials missing, payment required or credit out → BLOCKED-KEN `dataforseo credit`; LLM budget out → `llm budget`.
- Budget: lookups ≤ max pages × $0.002; LLM `HANDBOOK_SERP_ORIGINALITY_BUDGET_USD` (default 0.50), separate from the FULL-READ §5.6 budget.

### 3.4 SUPP-19 — text instructing AI assistants

- Scope: every page. Sources: text nodes, `alt`, `title`, `aria-label`, `<meta>` content, HTML comments, JSON-LD string values. Excluded: `/llms.txt`, `/llms-full.txt`, `.md` mirrors, `robots.txt` (handbook §20–§22 own formats).
- Hidden = HTML comment, attribute / meta / JSON-LD value, or element with `hidden`, inline `display:none`, `visibility:hidden`, `font-size:0`, `opacity:0`, or text present in raw HTML and absent from rendered visible text (existing render data; no sidecar image change).
- Pattern A (any location): `ignore (all |any )?(previous|prior|above) instructions`; `(if|when) you are an? (ai|llm|language model|assistant|chatbot)`; `^(note|attention|instruction)s? (to|for) (ai|llm|ai assistants?|language models?|chatbots?)`; `(ai|llm) (assistants?|agents?|models?)\s*[:,]\s*(always|never|please|you must|do not)`.
- Pattern B (hidden locations only): addressee (`ai`, `llm`, `language model`, `assistant`, `chatbot`, `chatgpt`, `claude`, `gemini`, `copilot`, `perplexity`) and directive verb (`recommend`, `rank`, `cite`, `mention`, `prefer`, `describe .* as`, `always`, `never`, `do not`, `must`) in one sentence.
- Visible text that only talks about AI tools (no Pattern A match) → no finding.
- Finding per page: location, hidden Y/N, matched text ≤ 200 chars. Title: `Text addressed to AI assistants (hidden)` / `(visible)`.
- Fix: `Remove it. Google's spam policies cover attempts to manipulate generative AI responses (2026-05-15): https://developers.google.com/search/docs/essentials/spam-policies`
- Severity S2 hidden, S3 visible. Handbook refs: §23, §29. English patterns only; other languages → no finding, noted LIMITED.

### 3.5 Scaled-content summary block

- Report + run page, not scored, built from data already collected: indexable pages N · pages in P3-12 duplicate clusters · thin pages (P3-12, P5-15) · SUPP-17 sets and pages · median own-text share per template · SUPP-18 (pages checked / without an original element / BLOCKED) · SUPP-19 pages.
- Zero counts shown as 0 (no hiding).

## 4. Copy quality section

### 4.1 Gate

- Runs only when `HANDBOOK_COPY_QUALITY=on` or the per-run option. Default off. Any mode.
- Deterministic: 0 LLM calls, 0 fetches. Same input → identical output.
- Page measured when: `<html lang>` starts with `en` or is absent; prose words ≥ 200; PageProfile.pageType not a contact, legal, listing / index or form page (K14 names; no PageProfile → rule skipped). Otherwise `not measured (<reason>)`.

### 4.2 Text and tokens

- Prose = text of `<p>` elements in main content; excluded: header, nav, footer, aside, list items, table cells, headings, blockquotes, forms, template boilerplate (FULL-READ §3.11).
- Word = letters, plus inner apostrophes and hyphens. Numbers are not words for E4, E5.
- Sentence = split on `.`, `?`, `!` followed by whitespace and an uppercase letter, digit or quote; abbreviations `e.g.`, `i.e.`, `vs.`, `Mr.`, `Mrs.`, `Ms.`, `Dr.`, `Inc.`, `Ltd.`, `Co.`, `U.S.`, `No.` do not split.
- Proper noun = capitalized word not at sentence start, not `I`.
- Rates per 500 / 1,000 words use prose words.

### 4.3 Metrics (report order)

| id  | Metric                                                                                                                                                                                                                                                                                                                                                | Threshold (over = flagged)   | Guide       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------- |
| E7a | Count of `this matters`, `why <1–3 words> matters`, `is more than a <word>`, `rather than simply`                                                                                                                                                                                                                                                     | > 0                          | E7, X1, X2  |
| E7b | Each of, per 500 words: `not just`, `not simply`, `not only … but`, `less like … and more like`, `is not just a … it is`, `the … is not simply`, `matters because`, `just as important`                                                                                                                                                               | > 1 for any one              | E7, X1, X2  |
| E9  | Three-item lists (`A, B, and C` / `A, B and C`, each item ≤ 4 words) per 500 words                                                                                                                                                                                                                                                                    | > 1                          | E9, W10     |
| E13 | Sentence-length SD (words) in sliding 300-word windows (step 50 words); needs ≥ 300 prose words                                                                                                                                                                                                                                                       | any window < 8               | E13, W13    |
| E6a | Numeric tokens + proper nouns per 150 words                                                                                                                                                                                                                                                                                                           | < 1                          | E6, W6      |
| E6b | Share of H2 sections (≥ 50 prose words) with ≥ 1 number, date, proper noun or quoted span (proxy for first-hand detail); no H2 → n/a                                                                                                                                                                                                                  | < 100 %                      | E6, W7      |
| E17 | Last prose paragraph contains a number or proper noun                                                                                                                                                                                                                                                                                                 | no                           | E17, W9     |
| E19 | Count of `you might be wondering`, `you may be wondering`, `you're probably wondering`; first prose sentence starts `Here's` / `Here is`                                                                                                                                                                                                              | > 0                          | E19, W3     |
| E16 | Markdown characters in visible text: `**text**`, line-leading `#`–`######` + space, `[text](url)`                                                                                                                                                                                                                                                     | > 0                          | E16, W4     |
| E4  | Mean word length (characters)                                                                                                                                                                                                                                                                                                                         | > 5.0                        | E4          |
| E5  | Share of words ≥ 10 characters                                                                                                                                                                                                                                                                                                                        | number only (reference 14 %) | E5          |
| E8  | Count of `absolutely`, `entirely`, `highly`, `incredibly`, `furthermore`, `dependable`, `meaningful`, `thoughtful`, `crucial`, `testament`, `vibrant`, `significantly`                                                                                                                                                                                | > 0                          | E8, X3, X4  |
| HB5 | Count in the first 200 prose words of `discover`, `unlock`, `harness`, `leverage`, `empower`, `transform`, `revolutionize`, `seamless`, `robust` (+ `-s`, `-ed`, `-ing`)                                                                                                                                                                              | > 0                          | handbook §5 |
| E11 | Highest per-1,000-word rate among: `however`, `moreover`, `furthermore`, `additionally`, `therefore`, `consequently`, `nevertheless`, `nonetheless`, `thus`, `hence`, `meanwhile`, `ultimately`, `overall`, `indeed`, `in addition`, `in conclusion`, `on the other hand`, `as a result` (list defined here; the guide gives the rule, not the words) | > 2                          | E11         |
| E10 | `may` + `might` + `could` per 1,000 words                                                                                                                                                                                                                                                                                                             | number only                  | E10, W11    |
| E15 | Paragraphs per 500 words                                                                                                                                                                                                                                                                                                                              | number only                  | E15, W5     |
| E12 | Em dashes (U+2014) per 1,000 words                                                                                                                                                                                                                                                                                                                    | > 3                          | E12, W14    |

### 4.4 Output

- Per page: `{url, proseWords, metrics[{id, value, threshold, over}], overCount}`; number-only metrics never count toward `overCount`.
- Site: median per metric; median per template; pages sorted by `overCount` desc, then URL.
- Report + run page: label line (verbatim) `Copy quality — not scored. Ranking effect: SPECULATIVE. Thresholds come from studies of articles and are not validated (guide §14 G-10). These numbers describe wording patterns only; they say nothing about who or what wrote a page.` Then site medians, then the 20 pages with the highest `overCount`. Full list in report JSON.
- No severity, no finding IDs, no grade effect, no words `AI`, `human`, `detector` in any metric name or per-page line.

## 5. Copy rules pack

- Canonical file: `fork/skills/copy-rules/SKILL.md` (frontmatter `name`, `description`; body = the pack; version line in its H1). Written by Ken's session 2026-11-18. B11 does not edit its rules; format-only fixes allowed.
- App bundle: `src/server/features/handbook/copy-rules.json` `{version, sha256, text}` generated from the SKILL.md body by `fork/scripts/copy-rules-sync.ts` (`--check` exits 1 on drift). Precedent: `registry.json` + `fork/scripts/handbook-sync.ts`. Must load in the app (workerd) and the CLI (node).
- Served by:
  1. MCP tool `handbook_copy_rules_get` → `{version, text}` (K8 addition; read-only).
  2. `handbook_findings_get`: result carries `copyRules: {tool: "handbook_copy_rules_get", version}` when it returns ≥ 1 finding in phase P5, SUPP-17 or SUPP-18; tool description says to load the rules before rewriting page copy.
  3. Handbook tab: "Copy rules" button → dialog or section showing the pack text with a copy button, inside the existing tab (`src/client/features/handbook/`; no new route file, no new nav item).
  4. SAM chat (conditional, §7): fork skills folder added to the skill glob.
  5. Claude Code: the folder is a skill as-is (`cp -r fork/skills/copy-rules ~/.claude/skills/`).
- Handbook status files (`seo-geo-status.md` …) keep the handbook format: no pack text inside them.
- Any app code that calls a model to draft or rewrite page copy (none in B11) must load the pack as its system prompt and set no sampling override (W17).

## 6. Flags

| Flag                                   | Values / default        | CLI                          | Run form (Handbook tab)                                  |
| -------------------------------------- | ----------------------- | ---------------------------- | -------------------------------------------------------- |
| `HANDBOOK_COPY_QUALITY`                | `off` (default) \| `on` | `--copy-quality`             | checkbox "Copy quality"                                  |
| `HANDBOOK_SERP_ORIGINALITY`            | `off` (default) \| `on` | `--serp-originality`         | checkbox "Compare with top-10 results" (AUDIT mode only) |
| `HANDBOOK_SERP_ORIGINALITY_MAX_PAGES`  | 10                      | `--serp-originality-pages N` | —                                                        |
| `HANDBOOK_SERP_ORIGINALITY_BUDGET_USD` | 0.50                    | —                            | —                                                        |

- Per-run option overrides the env value. SUPP-17, SUPP-19 and the summary block have no flag (deterministic, always on at `full` depth).

## 7. Contingencies

| Case                                                             | Behavior                                                                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A B9 / B10 piece this spec relies on is missing                  | Build the smallest version in B11 R2 (HEAVY allows contracts / schema); record in the report. Never ESCALATE to Ken   |
| LLM off or budget out                                            | Copy quality, SUPP-17, SUPP-19 unaffected; pageType gates skipped; SUPP-18 BLOCKED `llm budget`                       |
| DataForSEO credentials missing, payment required, credit out     | SUPP-18 BLOCKED-KEN `dataforseo credit`; live acceptance step skipped; recorded fixtures cover tests; batch continues |
| REVIEW mode                                                      | SUPP-18 N/A (EP-7); everything else runs                                                                              |
| Non-English page                                                 | Copy quality `not measured (language)`; SUPP-19 LIMITED; SUPP-17 runs                                                 |
| Template with < 3 pages                                          | SUPP-17 N/A for that template                                                                                         |
| Legitimate similar pages (variants, locations with real content) | Below ratio 0.6 → no finding; at / above → finding with fix text "merge or give each page content of its own"         |
| Hidden-text detection would need a sidecar image change          | Not allowed in B11 (would need Ken to restart it). Use raw-HTML signals + existing render data; record LIMITED        |
| New npm dependency                                               | Not allowed; implement in-repo                                                                                        |
| SAM chat not running locally (R1 smoke fails)                    | Skip the SAM hook; pack stays reachable via MCP, findings hint, Handbook tab, skill folder; record                    |
| Upstream edit beyond the one SAM glob line                       | Not allowed; drop that surface, record                                                                                |
| Secrets                                                          | Never source or read `.env*`; use scripts that load their own config (`handbook-audit.ts`, `run-local.sh`)            |
| A command is refused by the permission classifier                | Skip that step, record it, continue. Never retry through a workaround. Never `needs-ken` for it                       |
| Measurements disagree with a threshold                           | Only SUPP-17 ratio may move (0.5–0.7). Copy-quality thresholds are the guide's; change only via MAINTENANCE M4        |

## 8. Acceptance (B11 exit gate)

| Metric                           | Target                                                                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BadGEO                           | 0 missing · 0 unexpected with new pages: SUPP-17 (4-page variation set → 1 finding; 3 pages below ratio → none; 2-page set → none), SUPP-19 (hidden, comment, visible Pattern A → 3 findings; article about AI tools → none)                                           |
| Precedence                       | Unit tests: P5-09 reported set → no SUPP-17; P3-12 cluster covers set → no SUPP-17                                                                                                                                                                                     |
| Copy quality fixtures            | One page over on every threshold metric; one control page over on none; two runs byte-identical; 0 LLM calls (call counter)                                                                                                                                            |
| SUPP-18 fixtures                 | Stub SERP + stub off-site pages (`fork/fixtures/serp-originality/`): page with a unique first-party stat → no finding; page with none → finding; REVIEW mode → N/A; < 5 pages → BLOCKED                                                                                |
| SUPP-18 live (once)              | `handbook-audit.ts` AUDIT mode, bluetreefunding.com, 3 pages: completes; lookups ≤ $0.01; LLM ≤ $0.20; or BLOCKED-KEN `dataforseo credit` recorded                                                                                                                     |
| Goldens why, ryan, bluetree      | `--depth full --sidecar --llm`, flags off: grade Δ ≤ 2 vs B10; deterministic §41 verdicts identical to B10; SUPP-17–19 findings listed in the report with a keep / tune decision each                                                                                  |
| Golden mapping                   | `fork/fixtures/expected/*.yaml`: findings that match SUPP-17–19 re-mapped (M3); every bluetree F23 page reported by at least one of P5-09, P5-15, P3-12, SUPP-17 (overlaps cross-referenced per §3.1 rule 4, counted once), or recorded as missed with measured ratios |
| Speed                            | SUPP-17 + SUPP-19 + copy quality add ≤ 10 s per 100 pages; SUPP-18 ≤ 5 min at defaults                                                                                                                                                                                 |
| Copy rules                       | `copy-rules-sync.ts --check` exit 0; MCP tool text = SKILL.md body; findings hint present / absent per §5; Handbook tab link works (`ui-smoke.mjs` +1 check)                                                                                                           |
| No detector / authorship wording | grep over new code, report templates and fixtures: no `Pangram`, `GPTZero`, `AI-generated`, `AI-written`, `human-written`, `detector` outside comments citing this rule (excluded from the grep: `copy-rules.json`, `fork/skills/`, `fork/research/`, this file)       |
| Session-end checks               | green vs `fork/BASELINE.md`                                                                                                                                                                                                                                            |
