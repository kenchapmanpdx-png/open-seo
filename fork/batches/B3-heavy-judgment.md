# B3 — Judgment layer · HEAVY (SINGLE: Opus 5.5 · SPLIT: Opus 5.5 | Fable 5.2)

WPs 19–26. Input: `fork/reports/B2.md`, `fork/reports/B2-golden.md`, queue ESCALATE rows.

## R1 — Rebase + review (WP19, WP20)

1. `git fetch upstream`; new commits → `git rebase upstream/main`, resolve, rerun baseline, refresh `fork/BASELINE.md` if upstream changed it; none → skip.
2. Review all B2 commits with `fork/templates/REVIEW-CHECKLIST.md`. Fix defects directly.
3. Close every ESCALATE: fix contract (bump `CONTRACTS_VERSION` minor) or rewrite WO for B4.
4. Golden triage: every `missed` / `partial` → rule fix, new WO, or documented reason.

## R2 — LLM judge (WP21, WP22)

1. Implement K5: AI SDK + OpenRouter; Zod structured output; quotes verified as exact substrings of fetched text (normalize whitespace only); reject unverified verdicts; per-run cost cap + `handbook_llm_call` logging; page text treated as untrusted data.
2. Exemplar LLM checks (5): opening sentence (P5), unsupported superlatives + acronyms (P5), page-specific FAQ (P5), titles state offer/topic + H1 = topic (P4), entity test (P5/§25).
3. Cross-page fact table: extract stats, names, prices, addresses, phone formats per page → consistency checks (P5 stats single-sourced; names one way; llms.txt numbers match site).
4. Eval set from golden findings (whyracingevents F09, F10, F14, F15, F18, F19; ryanmscottsdale F02, F11, F12, A05, A06) → `fork/evals/`; pass threshold recorded in ADR-007.

## R3 — Scoring + exports + deploy design (WP23–WP25)

1. EP-7 scorer + status reconciliation (K6). Reproduce golden grades within ±10 (older handbook versions); record deltas + reasons.
2. Export spec (K7): `seo-geo-status.md` exactly in handbook format; report JSON schema; client report content model mapped onto upstream `reports` + share routes.
3. Runtime ADR-011: local production run (`run-local.sh prod`), sidecar compose, Supabase hardening + migration order, Vercel report publishing (static snapshot, unguessable path, `noindex`, `REPORTS_DOMAIN` optional), schedule catch-up when the computer was off, nightly `pg_dump` backup, upgrade procedure.

## R4 — B4 queue (WP26)

WOs: remaining LLM checks (one WO per 3–5 items with full prompt + rubric + eval cases), report UI, share + PDF, exports, MCP tools + skill, deploy files + runbook, full regression. Fill `fork/queue.md`.

## Exit

Escalations closed; LLM eval ≥ threshold; scorer within tolerance; ADR-011 written; B4 queue written; no new failures. `fork/reports/B3.md`; `STATE.md` → B4 LIGHT; commit + push; batch end per `STATE.md` protocol step 6 (SINGLE: continue · SPLIT: SWITCH banner).
