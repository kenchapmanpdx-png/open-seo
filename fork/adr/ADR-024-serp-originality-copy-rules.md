# ADR-024: SERP originality (SUPP-18) and copy-rules delivery

- Status: accepted
- Date: 2026-11-19 · Batch: B11 (R1)

## Context

- Spec: `fork/SCALED-COPY.md` §3.3 (SUPP-18), §5 (copy rules pack), §6 (flags), §7 (contingencies), §8 (acceptance).
- Existing: DataForSEO live SERP client `src/server/lib/dataforseo/serp.ts` (`fetchLiveSerp`, depth 10); `CheckContext.fetchOffsite` (ADR-021, any host, 256 kB); map model + `handbook_page_profile` cache (ADR-019, `HandbookPageProfileRepository`); judge verdict cache in the evidence store under `<projectId>/_judge-cache/` (`services/HandbookRunService.ts`); run LLM budget `llm/budget.ts` (FULL-READ §5.6); REVIEW mode excludes ranking / traffic data (handbook EP-7).
- Copy rules pack: `fork/skills/copy-rules/SKILL.md` (Ken's; frontmatter `name`, `description`; 7.1 kB). Precedent for a generated bundle: `registry.json` + `fork/scripts/handbook-sync.ts` (`--check`).
- SAM: `src/server/features/sam/samSkills.ts` bundles `/.agents/skills/*/SKILL.md` via `import.meta.glob`, skipping `metadata.internal: true`. R1 smoke (headless, local app :3001, 2026-11-19): SAM answered a one-line prompt → hook goes ahead (WO-B11-007). `fork/skills/handbook-audit` is `internal: true`, so only `copy-rules` reaches SAM.

## Decision

### SUPP-18

- Gate: mode AUDIT and (`HANDBOOK_SERP_ORIGINALITY=on` or project setting `serpOriginality` or CLI `--serp-originality`). REVIEW → item N/A `REVIEW mode: search-results data not used, EP-7`. Off → not listed (no item status row).
- Stage: runs after the map stage (needs PageProfiles) as an LLM-class check with its own budget `HANDBOOK_SERP_ORIGINALITY_BUDGET_USD` (default 0.50), separate from the §5.6 run budget.
- Page selection: PageProfile.pageType ∈ {service, product, guide, article, category} (K14 has no `hub`; `category` = hub / listing), never home / contact / about / legal; one per template first (highest internal in-links), then fill by in-links, ≤ `HANDBOOK_SERP_ORIGINALITY_MAX_PAGES` (default 10, CLI `--serp-originality-pages N`).
- Query: one judge-model call for all selected pages (title, H1, topic) → one query ≤ 8 words per page, brand stripped (post-check: drop the site's brand tokens from the host and `Organization.name`). Evidence `querySource: derived`.
- Results: `fetchLiveSerp` Google organic, depth 10, project location / language (default US / en); drop the audited host and non-HTML URLs. Cache per (query, location, language) 7 days in the evidence store `<projectId>/_serp-cache/<sha256>.json` (CLI: fs store, same key). Lookup cost recorded; cap max pages × $0.002.
- Competitors: `ctx.fetchOffsite` browser UA, 1 retry, 10 s timeout; main text as for site pages; profile via the map model + `handbook_page_profile` cache keyed by URL + body hash.
- Verdict: one judge call per audited page (its profile + main text, competitor profiles); output `{hasOriginalElement, elements[{type, quote}], confidence}`; each quote verified verbatim on the audited page (normalized whitespace / quotes) — an unverified quote is dropped; if none remain and the model said true, the verdict becomes `unsure`. Confidence < 0.7 → second call; disagreement → `unsure` (shown, not a finding). Prompt forbids judging truth, writing quality or authorship.
- BLOCKED (never a finding): < 5 competitor pages fetched → `serp pages unavailable`; DataForSEO credentials missing / 402 / credit out → BLOCKED-KEN `dataforseo credit`; budget out → `llm budget`.
- Contracts: `contracts/serp-originality.ts` (Zod): query, results, competitor fetch status, verdict, blocked reason. Tests use recorded fixtures `fork/fixtures/serp-originality/` (stub SERP + stub off-site pages); live calls only in WO-B11-090.

### Copy rules delivery

- `fork/scripts/copy-rules-sync.ts` writes `src/server/features/handbook/copy-rules.json` `{version, sha256, text}`: `text` = SKILL.md body after frontmatter, `version` = the `v…` token in its H1, `sha256` of `text`. `--check` exits 1 on drift. JSON import works in workerd (Vite) and node (tsx), as `registry.json` does.
- MCP (K8 1.7.0): `handbook_copy_rules_get` (read-only, no input beyond auth) → `{version, text}`. `handbook_findings_get` output adds `copyRules: {tool: "handbook_copy_rules_get", version}` when ≥ 1 returned finding is in phase P5 or has item SUPP-17 / SUPP-18; its description tells the agent to load the rules before rewriting page copy.
- Handbook tab: "Copy rules" button in the existing tab header opens a dialog (shadcn Dialog, Base UI `render` composition) with the pack text and a copy button; no route, no nav item.
- SAM: the glob in `samSkills.ts` becomes `["/.agents/skills/*/SKILL.md", "/fork/skills/*/SKILL.md"]` (one upstream line, logged in `fork/UPSTREAM-EDITS.md`); fix the skill-list test if it counts skills.
- Claude Code: the folder is a skill as-is.
- No app code drafts copy in B11; any future drafting call loads the pack as its system prompt and sets no sampling override (W17).

## Alternatives

| Option                                             | Why not                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| SERP cache table                                   | Evidence store already caches judge verdicts per project; no schema needed     |
| Read SKILL.md at runtime                           | workerd has no filesystem; bundle via JSON like `registry.json`                |
| SUPP-18 inside the §5.6 budget                     | Spec keeps it separate so an opt-in feature cannot starve the scored LLM items |
| Use target keywords from rank tracking for queries | P5-18 keyword map is BLOCKED without data; derived queries work on any site    |

## Consequences

- K8 1.7.0: one new tool, one optional output field. Registry SUPP-18.
- Upstream edits: one line in `samSkills.ts` (allowed by B11 rules).
- Paid calls only when the flag is on (default off), AUDIT mode only.

## Verification

- `copy-rules-sync.ts --check` exit 0 in session-end checks; sync test compares JSON text to the SKILL.md body.
- MCP tool test: text = SKILL.md body; findings hint present / absent per rule.
- SUPP-18 fixture tests: unique first-party stat → no finding; none → finding; REVIEW → N/A; < 5 pages → BLOCKED.
- Live once (WO-B11-090): bluetreefunding.com, 3 pages, lookups ≤ $0.01, LLM ≤ $0.20, or BLOCKED-KEN recorded.
