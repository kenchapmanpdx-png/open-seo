# BadGEO — handbook rule fixture site

Static site served on `127.0.0.1` by `fork/scripts/badgeo-serve.ts`; audited by
`fork/scripts/badgeo-run.ts` (CLI engine, `--allow-private`). Each HTML page
declares the registry item ids it must fire in
`<meta name="badgeo-expect" content="…">`; empty content = clean control page
(anything firing there is a false positive). Site-level expectations that have
no HTML page live in `_expect.json` (pseudo-page path → item ids).

- `{{ORIGIN}}` in `robots.txt` / `sitemap.xml` is replaced with the server origin.
- `_headers.json`: response headers per path (`/no-headers.html` keeps only
  `cache-control`). `"*"` applies to every path unless
  the exact path has its own entry, which replaces `"*"` (an empty object = no
  extra headers).

- `_bots.json`: path → user-agent tokens answered with 403 (bot-parity fixtures).
- `_redirects.json`: path → `[status, location]` answered before any file
  (`{{ORIGIN}}` substituted in the location).

| Path                                       | Exercises                                                                                                                                                                                                                 | Expected items      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `/`                                        | Clean control (Organization `@id`, canonical, full header set)                                                                                                                                                            | —                   |
| `/about/`                                  | Clean control, same Organization `@id`; links the fixture pages below                                                                                                                                                     | —                   |
| `/events/`, `/events/spring-run-2026.html` | Template clustering (index + detail)                                                                                                                                                                                      | —                   |
| `/broken-jsonld.html`                      | JSON-LD block with a trailing comma (`prettier-ignore` keeps it broken)                                                                                                                                                   | P6-08               |
| `/placeholder.html`                        | §24 sentinel `123 Main St` in JSON-LD; generic `LocalBusiness` type and a node separate from the Organization `@id`                                                                                                       | P6-15, P6-11, P6-10 |
| `/duplicate-org.html`                      | Same organization without `@id` and under a second `@id`                                                                                                                                                                  | P6-03               |
| `/no-headers.html`                         | No HSTS / CSP / nosniff / Referrer-Policy / Permissions-Policy                                                                                                                                                            | P8-01, P8-05        |
| `/orphan.html`                             | In the sitemap, no internal link                                                                                                                                                                                          | P3-12               |
| `/canonicalised.html`                      | In the sitemap, canonical → `/about/`                                                                                                                                                                                     | P3-12               |
| `/partners/acme.html`                      | 403 to GPTBot although robots.txt allows it (own template, so the bot probe samples it)                                                                                                                                   | P9-01               |
| `/robots.txt`                              | Named AI-bot group carries only `Allow: /`; `/*?sort=` without `&sort=`                                                                                                                                                   | P3-15, P9-05        |
| `/canonical-mismatch.html`                 | Canonical carries `utm_source` (not self-canonical, tracking param); not in the sitemap                                                                                                                                   | P3-04               |
| `/events/unlinked-run-2026.html`           | Event detail in the sitemap, linked from nowhere (dynamic slug so it joins `/events/*`)                                                                                                                                   | P2-10, P3-12        |
| `/Bad_Slug.html`                           | Uppercase + underscore slug, linked from `/about/`, in the sitemap                                                                                                                                                        | P2-12               |
| `/admin/`                                  | noindex + `Disallow: /admin/` (not crawled) + linked from the `/about/` footer                                                                                                                                            | P3-14, P3-16        |
| `/events/page/2.html`                      | Pagination page canonical → `/events/` (also not self-canonical, P3-04)                                                                                                                                                   | P3-21, P3-04        |
| `/search.html?q=run`                       | Internal search `noindex, nofollow` (rule wants `noindex,follow` or Disallow)                                                                                                                                             | P3-23               |
| `/sitemap-build.xml` (`_expect.json`)      | Second sitemap (robots `Sitemap:`), 6 `<loc>` all lastmod 2026-11-01 (build date)                                                                                                                                         | P3-17               |
| `/dup-title-a.html`, `/dup-title-b.html`   | Same title + meta description (distinct H1s)                                                                                                                                                                              | P4-01               |
| `/no-og.html`                              | No OG / Twitter tags, no `max-image-preview:large` (all other indexable pages have them)                                                                                                                                  | P4-09, P4-11        |
| `/bad-structure.html`                      | Two `<main>`, `<h2>` in the footer, h1 → h3 skip, prices as paragraphs                                                                                                                                                    | P4-08, P5-12        |
| `/blank-target.html`                       | `target="_blank"` link to https://example.org/ without rel (outbound fetch needs network)                                                                                                                                 | P4-12               |
| `/contact.html`                            | Clean control: mailto channel in server HTML (P5-16 PASS)                                                                                                                                                                 | —                   |
| `/lazy-hero.html`                          | Hero `<img>`: data: URI src + `data-src`, `loading=lazy`, no width/height or srcset                                                                                                                                       | P7-02, P7-03        |
| `/assets/app.3f9a1c.js` (`_expect.json`)   | Hashed script loaded by `/`, served `cache-control: max-age=60` (HTML gets `no-cache`)                                                                                                                                    | P7-07               |
| `/relative-urls.html`                      | JSON-LD WebPage with `"url": "/relative-urls.html"` and `"description": ""`                                                                                                                                               | P6-02               |
| `/events/thin-event.html`                  | Event JSON-LD with city-only location, date-only `startDate` while text says 9:00 AM, no offers, no BreadcrumbList (spring-run / unlinked-run carry full Event + BreadcrumbList controls; `/events/` carries an ItemList) | P2-06, P6-05, P6-06 |
| `/old-event.html` (`_redirects.json`)      | 301 → `/`, still linked from `/events/` (moved URL sent to the homepage)                                                                                                                                                  | P3-08, P3-05        |
| `/index.html` (`_expect.json`)             | Static server answers 200 for `/index.html` (duplicate of `/`)                                                                                                                                                            | P3-03               |
| `/about` (`_expect.json`)                  | Slash-toggled probe of `/about/` answers 200 (both slash forms live)                                                                                                                                                      | P3-02               |

Unit tests only (no BadGEO page): hreflang P3-24 / variant URLs P3-25 (single-language site); loading copy P2-04 (gate "API/backend-driven pages" stays `?` → BLOCKED on BadGEO, so no `/loading-copy.html`); llms.txt P9-02 / .md mirrors P9-03 (intake sets gate §20 = N, handbook §0). About people P5-17 / editorial standards P5-10 (no BadGEO page: needs multi-person fixture; `/about/` carries one Person control so P5-17 stays clean).

Status: B1 R5 exemplars pass. `pnpm exec tsx fork/scripts/badgeo-run.ts` exits 0
(every expectation fires on its page, nothing else fires).

Host: the server listens on `127.0.0.1` but advertises `http://127.0.0.1.nip.io:<port>`
(public wildcard DNS → 127.0.0.1), because the engine's `safeFetch` rejects
loopback IP literals even under the CLI's `--allow-private`. Offline runs need
a hosts entry for that name.
