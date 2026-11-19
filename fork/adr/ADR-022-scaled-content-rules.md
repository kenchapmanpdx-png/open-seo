# ADR-022: Scaled-content rules (SUPP-17, SUPP-19, summary block)

- Status: accepted
- Date: 2026-11-19 · Batch: B11 (R1)

## Context

- Spec: `fork/SCALED-COPY.md` §1, §3.1, §3.2, §3.4, §3.5, §7. Builds on ADR-020 (SUPP registry, "Additional findings", not scored) and ADR-021 (MinHash, boilerplate split).
- Existing code: `checks/llm-templates.ts` holds `swapped` (title differs by one run of ≤ 2 words) and P5-09 (title-swap pages with `sharedSentenceRatios` ≥ 0.6 → LLM judge); `checks/llm-content.ts` holds `sharedSentenceRatios` (per page: share of its sentences found on any other given page, over `markup.text`, which includes header / nav / footer text); `checks/duplicates.ts` holds P3-12 (MinHash clusters J ≥ 0.8, thin < 50 words, boilerplate note) with private `indexable` and `clusters`; `engine/minhash.ts` exports `similarPairs` (LSH 32 bands × 4 rows); `engine/boilerplate.ts` exports `pageBlocks` / `templateBoilerplate`; templates come from `collectors/site-crawl.ts` `clusterTemplates` (path pattern + skeleton hash).
- Checks receive `PageSnapshot`s, not raw HTML; raw bodies sit in the evidence store (`rawKey`).
- Measured B11 R1 on the stored B10 goldens (`fork/scripts/scaled-measure.ts`, real template keys, sentences from `pageBlocks`, pair ratio = shared / smaller page):

| Site     | Template (pages) | Chrome = on ≥ 2 templates: median / max · sets @0.5 / 0.6 / 0.7 | Chrome = on ≥ 50 % of pages: median / max · sets @0.5 / 0.6 / 0.7 |
| -------- | ---------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| why      | /events/\* (11)  | 0.29 / 0.38 · 0 / 0 / 0                                         | 0.74 / 0.81 · 9 / 9 / 7                                           |
| why      | /events/\* (8)   | 0.13 / 0.13 · 0 / 0 / 0                                         | 0.43 / 0.63 · 3 / 3 / 0                                           |
| ryan     | /\* (5), /\* (4) | 0 / 0 · none                                                    | 0 / ≤ 0.26 · none                                                 |
| bluetree | /\* (27)         | 0.25 / 1.00 · 3+7 / 3+6 / 3                                     | 0.59 / 1.00 · 3+7 / 3+6 / 3+3                                     |
| bluetree | /partner/\* (6)  | 0.40 / 1.00 · 0 / 0 / 0                                         | same                                                              |

- why's two event templates share a 12-sentence FAQ block and "related events" cards; each event page also has its own course, date and venue text (golden F16 is P5-15 key facts, not a duplicate set). bluetree's 6-page industry set (/construction/, /transportation/, /manufacturing/ …) is golden F23 ("near-identical industry pages"), today reported by no item; the 3-page financing set (/pool-spa-financing/, /financing-hci/, /construction-financing/) is only partly inside the P3-12 cluster.
- LSH 32 × 4 is tuned for J ≈ 0.8: the chance a pair at J = 0.3 shares a band is 1 − (1 − 0.3⁴)³² ≈ 0.23.

## Decision

- One shared leaf module `checks/scaled-sets.ts`: `swapped` (moved from `llm-templates.ts`), `ownSentences` (page blocks → sentences ≥ 20 chars, minus chrome), `pairRatio` (shared sentences / sentence count of the smaller page), `linkedSets` (union-find over pairs ≥ ratio, sets ≥ 3 pages), `duplicateClusters` + `indexable` (moved from `duplicates.ts`). P5-09 and SUPP-17 call the same functions; P5-09 keeps its own title-swap gate and threshold.
- Page text for SUPP-17 = `pageBlocks` of the raw body, computed during the crawl and kept on the snapshot as sentence hashes (K2 additive `PageSnapshot.sentenceHashes?: number[]`, FNV-1a of the lower-cased sentence, ≤ 400 per page) — checks never re-read bodies, memory stays ≈ 1.6 kB per page.
- Chrome = a sentence found on pages of ≥ 2 templates (conservative of the two measured definitions: why's shared FAQ across both event templates is not a set; bluetree's sets are found either way). Template boilerplate inside one template is not chrome — it is what SUPP-17 measures.
- Candidate pairs: within one template, full-signature MinHash estimate ≥ 0.3 (128 compares per pair), not LSH (recall ≈ 0.23 at 0.3); then the exact sentence ratio. Template > 400 pages → pairs only among pages that share an LSH band (cap, recorded LIMITED in the finding).
- Subtype `variation` when titles, H1s or last URL segments of the set differ pairwise by one swapped term (`swapped`), else `templated`.
- Precedence (§3.1): rule 2 inside the check (`duplicateClusters` at 0.8 over the same indexable pages: a set fully inside one cluster is skipped). Rule 1 after all checks, in one engine function `applyScaledPrecedence` (report assembly): URLs reported by a P5-09 finding are removed from SUPP-17 sets; a set left with < 3 pages is dropped.
- SUPP-19: the crawl extracts candidate texts from the raw body with htmlparser2 (text nodes, `alt`, `title`, `aria-label`, `<meta content>`, comments, JSON-LD string values) and keeps only Pattern A / B matches with location and hidden flag (K2 additive `PageSnapshot.aiAddressed?: {location, hidden, text}[]`). Hidden = comment / attribute / meta / JSON-LD, or an element (or ancestor) with `hidden`, inline `display:none`, `visibility:hidden`, `font-size:0`, `opacity:0`. Raw-vs-render: a visible-in-raw text match whose text is absent from the page's rendered visible text (render data, when collected) is marked hidden. No sidecar change. `/llms.txt`, `/llms-full.txt`, `.md` mirrors and `robots.txt` are not pages, so never scanned. `<html lang>` not `en*` (and present) → no finding, check note LIMITED.
- Scaled-content summary: built in report assembly from findings + snapshots already in memory (no new collection), report JSON `scaledContent` (optional), run page block, markdown block. Zero counts shown.
- SUPP-17 / SUPP-19 / summary have no flag; they run at `full` depth (quick depth samples pages, so sets would be partial: SUPP-17 → N/A `quick depth`).

## Alternatives

| Option                                               | Why not                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Chrome = sentence on ≥ 50 % of all pages             | Flags why's 9 event pages (real events with own facts; shared FAQ + cards); fix text would be wrong |
| `markup.text` sentences (as P5-09 today)             | Includes header / footer text; every page shares it                                                 |
| LSH bands for candidates at 0.3                      | Recall ≈ 23 % at J 0.3                                                                              |
| Read raw bodies from the evidence store in the check | One store read per page per check; the crawl already has the body in memory                         |
| Precedence rule 1 inside the check                   | P5-09's verdict comes from the LLM judge, known only after checks run                               |
| Sidecar computed-style hidden detection              | Sidecar image change not allowed in B11 (§7)                                                        |

## Consequences

- K2 1.7.0 (additive): `PageSnapshot.sentenceHashes?`, `PageSnapshot.aiAddressed?`; report JSON `scaledContent?`; registry SUPP-17, SUPP-19.
- P5-09 behavior unchanged (same `swapped`, same 0.6 over its own text); its judge view gains the SUPP-17 set evidence when SP7 is true.
- Risk: inline-style-only hidden detection misses CSS-class hiding; raw-vs-render covers JS-removed text only when render ran. Recorded LIMITED.

## Verification

- Unit tests: `scaled-sets` (ratio, sets, swapped), precedence (P5-09 set → no SUPP-17; P3-12 cluster covers set → no SUPP-17), SUPP-19 Pattern A / B and hidden locations.
- BadGEO pages (§8): 4-page variation set → 1 finding; 3 pages below ratio → none; 2-page set → none; hidden / comment / visible Pattern A → 3 findings; article about AI tools → none.
- Goldens: bluetree industry set reported; why and ryan none (R1 measurement above); speed ≤ 10 s per 100 pages.
