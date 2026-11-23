# Baseline (clean checkout of upstream `2df84ff9`, 2026-11-14, B1 R1)

| Check               | Result                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm types:check`  | pass (0 errors)                                                                                                                                                                   |
| `pnpm lint`         | pass (0 warnings, 0 errors; 1452 files)                                                                                                                                           |
| `pnpm test`         | pass: 289 files, 2033 tests, 0 failures                                                                                                                                           |
| `pnpm format:check` | pass on upstream files. The fork seed docs under `fork/` were unformatted; formatted once with prettier in B1 R1 (`fork/handbook/`, `fork/fixtures/audits/` are prettier-ignored) |

Failing tests on the clean checkout: none.

## Current (B18 run 88, 2026-11-23, `ken/main` on upstream v0.1.31)

| Check                                                                                          | Result                                  |
| ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| `pnpm types:check`                                                                             | pass (0 errors)                         |
| `pnpm lint`                                                                                    | pass (0 warnings, 0 errors)             |
| `pnpm test`                                                                                    | pass: 436 files, 2682 tests, 0 failures |
| `pnpm format:check`                                                                            | pass                                    |
| `pnpm exec vitest run --root fork/sidecar`                                                     | pass: 2 files, 10 tests                 |
| `bash fork/scripts/ops/ops-test.sh`                                                            | pass: 18 / 18                           |
| `node --test fork/scripts/ops/*.test.mjs`                                                      | pass: 40 tests                          |
| `pnpm exec vitest run --root fork/scripts lib/external-audit.test.ts lib/field-ledger.test.ts` | pass: 2 files, 4 tests                  |

Compare session-end results with this section; the table above is the B1 clean-checkout record.

Rule: any failure in the checks above after a fork change is a new failure (not done).

## Knip (not in the session-end list; noted)

- Clean checkout: no findings.
- Fork CLI scripts under `fork/scripts/*.ts` show as "Unused files" (entry points knip does not know). `knip.jsonc` is upstream and not edited (FORK.md). Treat `fork/scripts/*` knip rows as expected; Ken may add `fork/scripts/*.ts` to knip `entry` or `ignore`.
