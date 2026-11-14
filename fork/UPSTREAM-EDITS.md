# Upstream edits log

Every edit to a file outside `fork/`, `src/server/features/handbook/`, `src/client/features/handbook/`.

| File                   | Line    | Why                                                                                                                                                                               | Date       |
| ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `.claude/CLAUDE.md`    | 2       | Import fork rules (`@../fork/FORK.md`)                                                                                                                                            | 2026-11-14 |
| `.prettierignore`      | end     | Exclude verbatim sources `fork/handbook/`, `fork/fixtures/audits/`                                                                                                                | 2026-11-14 |
| `wrangler.jsonc`       | 148–153 | Enable `hyperdrive` block (binding `HYPERDRIVE`, placeholder id, no `localConnectionString`) for Supabase Postgres via `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` | 2026-11-14 |
| `wrangler.audit.jsonc` | 70–75   | Same as above; the audit worker also reads the DB                                                                                                                                 | 2026-11-14 |
