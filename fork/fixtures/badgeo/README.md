# BadGEO — handbook rule fixture site

Static site served on `127.0.0.1` by `fork/scripts/badgeo-serve.ts`; audited by
`fork/scripts/badgeo-run.ts` (CLI engine, `--allow-private`). Each HTML page
declares the registry item ids it must fire in
`<meta name="badgeo-expect" content="…">`; empty content = clean control page
(anything firing there is a false positive). Site-level expectations that have
no HTML page live in `_expect.json` (pseudo-page path → item ids).

- `{{ORIGIN}}` in `robots.txt` / `sitemap.xml` is replaced with the server origin.
- `_headers.json`: response headers per path. `"*"` applies to every path unless
  the exact path has its own entry, which replaces `"*"` (an empty object = no
  extra headers).

| Path                                       | Exercises                                                                                                  | Expected items |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------- |
| `/`                                        | Clean control (Organization `@id`, canonical, full header set)                                             | —              |
| `/about/`                                  | Clean control, second Organization reference with same `@id`                                               | —              |
| `/events/`, `/events/spring-run-2026.html` | Template clustering (index + detail)                                                                       | —              |
| `/broken-jsonld.html`                      | JSON-LD block with a trailing comma (parse error)                                                          | P6-08          |
| `/placeholder.html`                        | §24 placeholder sentinels in JSON-LD (`Business Name`, `555-555-5555`, `email@example.com`, `123 Main St`) | P6-15          |
| `/no-headers.html`                         | No HSTS / CSP / nosniff / Referrer-Policy                                                                  | P8-01, P8-05   |
| `/robots.txt`                              | Named AI-bot groups carry only `Allow: /`, missing the `*` Disallow set                                    | P3-15, P9-05   |

Status: skeleton (B1 R4). No checks exist yet, so `badgeo-run.ts` reports every
expectation missing; run it with `--report-only` until the B1 R5 exemplars land.
R5 exit gate: `pnpm exec tsx fork/scripts/badgeo-run.ts` exits 0.

Host: the server listens on `127.0.0.1` but advertises `http://127.0.0.1.nip.io:<port>`
(public wildcard DNS → 127.0.0.1), because the engine's `safeFetch` rejects
loopback IP literals even under the CLI's `--allow-private`. Offline runs need
a hosts entry for that name.
