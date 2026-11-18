---
name: copy-rules
description: Rules for drafting, rewriting or reviewing website copy (pages, posts, service and product copy) so it is specific, first-hand and free of generic AI wording patterns, and stays inside Google's content policies. Use when writing or editing on-page copy, or when fixing content findings from a handbook audit.
---

# Copy rules for web pages · v1 · 2026-11-18

Source: Human-Sounding AI Writing master guide v1 (rule IDs in brackets) + on-site SEO/GEO handbook. Scope: website copy. Emails are out of scope (guide W8, E18).

## Order of authority

1. Facts. Use only facts given in the brief, on the site or in first-party data. Never invent a number, date, name, client, quote, review, award or source. Missing fact → write `[NEEDED: …]` in its place.
2. Page structure. The on-site SEO/GEO handbook decides headings, lists, tables, answer blocks and FAQs (handbook §3, §7, §16). These rules govern the sentences inside that structure.
3. The brief.
4. These rules.

## Before writing

- Load 5 passages of the site owner's own writing, same genre as the page. Match their sentence-length spread, vocabulary level and opening habits. Do not copy their content. [W1, E20]
- No samples → one consistent house voice; say so in the hand-off note. Blog and forum copy needs a human voice edit even with samples. [W2, W15]
- Imitate only the owner's own writing. Never a third party's without consent. [X8]
- Keep the model's default sampling settings. [W17]

## Write

- Practitioner to peer. No greeting, no recap opener, no "Here's…" opener, no closing summary, no offer of further help, no pros-and-cons scaffolding the brief did not ask for. [W3]
- Headings, lists, tables and bold only where the handbook structure or the brief calls for them. No decorative bold. No raw markdown characters left in the page. [W4, E16]
- Inside a section, write full paragraphs. Do not give every point its own one- or two-sentence paragraph. [W5]
- Short concrete words. Replace abstractions with figures, names, dates and quantities from first-party data. [W6]
- Every H2 section carries ≥ 1 first-hand, checkable detail: a named client, a date, a measured result or a real quote. [W7, E6]
- Every page carries ≥ 1 element the top-10 results for its query lack: own data, a test, a case, an expert quote or a worked example. No search access → ask the owner for one first-party element. [E21, C7]
- End on a specific fact, number, name or decision. [W9, E17]
- At most one three-item list per 500 words; replace stacked triads with one specific item. [W10, E9]
- "may / might / could" only where a named source or a stated condition supports it. [W11, E10]
- A real question is allowed where the argument turns. [W12]
- Vary sentence length across each paragraph. [W13, E13]
- Em dashes: match the owner's samples; without samples ≤ 3 per 1,000 words. Vary punctuation; do not ban one mark. [W14, E12]
- Write for an expert reader. Never write to pass an AI detector. [W16]

## Never write

- Contrast frames: "not just X, but Y", "rather than simply", "less like X and more like Y", "is more than a X, it's a Y", "the X is not simply", "is not just a X, it is". [X1]
- Importance flags: "this matters", "why X matters", "matters because", "just as important". [X2]
- Intensifiers and stock transitions: "absolutely", "entirely", "highly", "incredibly", "furthermore". [X3]
- Unearned adjectives and stock vocabulary: "dependable", "meaningful", "thoughtful", "crucial", "testament", "vibrant", "significantly". [X4]
- In the first 200 words: "discover", "unlock", "harness", "leverage", "empower", "transform", "revolutionize", "seamless", "robust". [handbook §5]
- "You might be wondering" and other addresses to an imagined reader question. [E19]
- Reviews, testimonials or customer quotes. Use only real, attributable statements the owner supplies. [X10]
- A page per query variation, near-duplicate pages, or text meant to steer AI answers, including any instruction addressed to an AI assistant. [X11]

## Never do

- No "make it better / sound human / remove AI tells" pass by an LLM. [X5]
- No humanizer tools. [X6]
- No detection-evasion steps (base-model stitching, sampling tweaks aimed at detectors). [X9]
- No stripping or scrubbing of provider watermarks. [X12]
- No single-prompt draft published as-is. [X7]

## After writing: check, then fix

Thresholds are the guide's heuristics; none is validated against rankings.

| Check                                                                                      | Target                                                          | Rule |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---- |
| Listed phrases ("this matters", "why _ matters", "is more than a _", "rather than simply") | 0                                                               | E7   |
| Any other contrast frame or "matters" flag                                                 | ≤ 1 each per 500 words                                          | E7   |
| X3–X4 word list                                                                            | 0                                                               | E8   |
| Three-item lists                                                                           | ≤ 1 per 500 words                                               | E9   |
| One transition word repeated                                                               | ≤ 2 times per 1,000 words                                       | E11  |
| Em dashes                                                                                  | ≤ 3 per 1,000 words (no samples)                                | E12  |
| Sentence-length spread                                                                     | SD ≥ 8 words across any 300 words                               | E13  |
| Mean word length                                                                           | ≤ 5.0 characters                                                | E4   |
| Numbers or proper nouns                                                                    | ≥ 1 per 150 words                                               | E6   |
| Closing paragraph                                                                          | contains a number, name or action                               | E17  |
| Raw markdown characters in page text                                                       | 0                                                               | E16  |
| Rewrite vs its source                                                                      | 0 new or altered numbers, dates, names, quoted spans, citations | E2   |

## Hand-off note (always)

- First line: `DRAFT — human review required`. [X7]
- Every number, date, name and quote used, each with where it came from (brief, site URL, first-party file). [E2]
- Every `[NEEDED: …]` marker.
- Whether owner samples were used. [W1]
