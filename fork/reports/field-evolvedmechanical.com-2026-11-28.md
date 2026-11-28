# Field run — evolvedmechanical.com, app half of round 3 (WO-B26-091, 2026-11-28)

- Status: BLOCKED. No audit was created: Check a site (Whole site, full check on, no leave-outs) refused the site with "evolvedmechanical.com did not answer. Check the spelling and that the site is online." Tried twice (08:05 and 10:05 UTC), same result.
- Platform: WordPress (Rank Math). Unaffiliated site: read only; nothing was sent beyond the home-page check.
- Scope that was planned: whole site, no leave-outs. Preflight (`field-test.ts --preflight`): 96 sitemap URLs (`/blog/` 26, `/plumbing/` 15, smaller sections), under the 100-URL whole-site rule. Semrush crawled 114 pages on 2026-11-26.

## Cause (read only)

- The app's website check (`verifyWebsite`, one GET of the home page through SafeFetch) fails with `fetch failed` / `SocketError: other side closed`: the server closes the TLS connection before any byte (bytes read 0), for both `evolvedmechanical.com` and `www.evolvedmechanical.com`.
- The same request with the app's user-agent `Mozilla/5.0 (compatible; OpenSEO-Handbook/1.0; +https://openseo.so)` from curl: no response (connection closed). With curl's default user-agent, an empty user-agent, or Node's default fetch: `https://evolvedmechanical.com/` 301 → `https://www.evolvedmechanical.com/` 200.
- So the site (or its host's firewall) drops connections from the app's crawler user-agent. The app cannot read it without changing who it says it is, which round 3 does not allow (no workarounds, no fixes in B26).

## Findings

None: no run. Items BLOCKED: all (site refuses the app's user-agent). Crawl errors: the home page, connection closed by the server.

## For the chat

- The app-vs-Semrush comparison has no app side for this site. Options: drop it from round 3, or pick another WordPress site that Semrush has crawled (Semrush is cancelled, so a new site has no Semrush half).
- Product note, not a fix here: "did not answer. Check the spelling" is misleading when the site answers other clients and refuses only this user-agent; the message could say the site closed the connection.
