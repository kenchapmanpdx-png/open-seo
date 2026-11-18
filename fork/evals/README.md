# K5 judge eval set (B3 R2.4)

Cases are golden findings the LLM checks must reproduce, built from the judge
inputs of a `handbook-audit.ts --llm` run (page views exactly as the checks
build them). Threshold: ADR-007.

    pnpm exec tsx fork/scripts/handbook-audit.ts https://whyracingevents.com --llm --out fork/runs/llm-trial/why
    pnpm exec tsx fork/scripts/llm-eval.ts build why fork/runs/llm-trial/why
    pnpm exec tsx fork/scripts/llm-eval.ts run [--model anthropic/claude-haiku-5.5]

Results land in `results/<date>-<model>.md`.

| Case            | Golden                         | Item  | Expected | Pages                                       |
| --------------- | ------------------------------ | ----- | -------- | ------------------------------------------- |
| why-F09         | same FAQ on event pages        | P5-05 | fail     | event pages with FAQ                        |
| why-F10         | conflicting stats              | P5-02 | fail     | fact table, no llms.txt                     |
| why-F14         | slogan H1s                     | P4-02 | fail     | 20 head views                               |
| why-F15         | superlatives, PNW              | P5-04 | fail     | 8 sampled pages                             |
| why-F18         | names spelled several ways     | P5-07 | fail     | 12 head views + home                        |
| why-F19         | llms.txt 21 vs 19 listed       | P5-02 | fail     | llms.txt + home/About/Partners (hand-built) |
| why-PASS-02     | event titles state topic       | P4-02 | pass     | `/events/<slug>` only                       |
| ryan-F02        | brand-only titles              | P4-02 | fail     | head views                                  |
| ryan-F11        | uncited superlatives           | P5-04 | fail     | sampled pages                               |
| ryan-A06        | names spelled several ways     | P5-07 | fail     | head views + home                           |
| why-F16         | thin event pages               | P5-15 | fail     | `/events/ho-ho-5k`                          |
| why-PASS-MATRIX | home without article furniture | P5-06 | pass     | `/`                                         |
| why-F02         | "No Events Found" as current   | P2-03 | fail     | `/` server HTML                             |
| why-HUB         | bare hub title (§2)            | P4-07 | fail     | `/events`, locations                        |
| ryan-F12        | awards as images only          | P5-11 | fail     | `/`                                         |
| ryan-F14        | one /service page              | P5-09 | fail     | `/service` + bio twins                      |
| blue-F13        | conflicting terms / approvals  | P5-02 | fail     | fact table                                  |
| blue-F14        | template leftovers             | P5-04 | fail     | `/`, rcm-connect, vilo                      |
| blue-F15        | superlatives, acronyms         | P5-04 | fail     | other sampled pages                         |
| blue-F15-badge  | HIPAA badge image only         | P5-11 | fail     | award-like image view                       |

B4 cases (WO-B4-001/002/004) are built from the r13b sidecar runs; why-F18 now
includes the `Name mentions:` views. Not in the set: ryan A05 (P5-08,
deterministic in `crawl.raw-copy`); P5-03 source check (no off-site fetch in
checks until contracts 1.3.0).

B8 R3: `blue-*` cases built from `fork/runs/b8r3/blue-llm` (`build blue`); bluetree
F12 (Section 179 currency) has no case — truth verification is out of scope
([Ken], FULL-READ §0). `why-F19` is hand-built (see its `note`) and not in the
build specs. Extraction (map stage) eval: `extract/README.md`.
