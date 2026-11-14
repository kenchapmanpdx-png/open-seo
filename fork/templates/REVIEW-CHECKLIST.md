# Review checklist (HEAVY, start of B3 / B5 / B7)

Assume defects exist; find them.

| #   | Check                 | How                                                                                                                                                |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Contract conformance  | Every check implements K1 exactly; no contract files changed by LIGHT (`git log -- src/server/features/handbook/contracts`)                        |
| 2   | Spec fidelity         | Sample ≥20% of WOs: logic matches quoted handbook rule; status mapping complete                                                                    |
| 3   | Evidence completeness | Every finding has ≥1 evidence row with URL + excerpt/storage key                                                                                   |
| 4   | False positives       | BadGEO negative pages silent; golden "Passes" lines not contradicted                                                                               |
| 5   | SSRF / network        | All fetches go through upstream url-policy / public-fetch; sidecar bound to 127.0.0.1; bot-UA fetches own origin only                              |
| 5b  | Supabase              | `supabase-harden.sql` applied after the last migration; advisors clean; service-role key never in client bundle or Vercel reports; buckets private |
| 5c  | Vercel publish        | Published reports: `noindex`, unguessable path, no secrets, no raw evidence beyond the report                                                      |
| 6   | Secrets               | No keys in code, logs, fixtures, reports                                                                                                           |
| 7   | Tenant scoping        | Every query scoped by project/org                                                                                                                  |
| 8   | Dual dialect          | schema-parity test green; queries valid on SQLite + Postgres                                                                                       |
| 9   | Lean bundle           | Handbook code lazy-imported; build assertion passes                                                                                                |
| 10  | Tests                 | Follow AGENTS.md testing rules; no tests of libraries; negative tests fail for the stated reason                                                   |
| 11  | Upstream diff         | Only edits logged in `fork/UPSTREAM-EDITS.md`                                                                                                      |
| 12  | Hygiene               | knip, lint, format, types: no new failures vs `BASELINE.md`                                                                                        |
| 13  | Escalations           | Each ESCALATE closed: fixed, rewritten WO, or documented reason                                                                                    |
| 14  | Licenses              | Ported Canonry/Elmo files keep MIT notice (B7)                                                                                                     |
