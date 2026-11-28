# ADR-039: a site that refuses the full app name is read with the short one

- Status: accepted (B27 run 109, WO-B27-001 / 002)
- Contracts: additive optional fields `SafeFetchResult.shortName`, `Coverage.shortName`, report `run.coverage.shortName`. Not K3 (the sidecar never sees them); `CONTRACTS_VERSION` stays 1.11.0, as ADR-036 did for an additive report field. A bump would fail the sidecar's exact-version handshake for no behaviour change there.

## Context

evolvedmechanical.com (B26 WO-091) could not be checked: the start check got "connection closed", 0 bytes, for apex and `www`. Probed read only, one request each, 2026-11-28:

| User-agent sent                                                         | Answer             |
| ----------------------------------------------------------------------- | ------------------ |
| `Mozilla/5.0 (compatible; OpenSEO-Handbook/1.0; +https://openseo.so)`   | connection dropped |
| `Mozilla/5.0 (Windows NT 10.0; …) Chrome/124.0 Safari/537.36` (browser) | connection dropped |
| `OpenSEO-Audit/1.0` (upstream site audit)                               | 301 → 200          |
| `curl/8.5.0`                                                            | 301 → 200          |
| `OpenSEO-Handbook/1.0 (+https://openseo.so)`                            | 301 → 200          |

The trigger is the `Mozilla/5.0` prefix, not the crawler name: the site's firewall drops clients that claim to be a browser without a browser's handshake. WO-B27-001 assumed the opposite (retest as a browser); the browser string is dropped too, so that fix would not have read this site.

## Decision

- SafeFetch option `shortNameRetry` (on for the run's site fetcher and the start check). A default-name request that the site drops (any non-timeout network error) or answers 403 / 406 is sent once more with `HANDBOOK_SHORT_USER_AGENT` = `OpenSEO-Handbook/1.0 (+https://openseo.so)`. Answered (< 400) → every later default-name request of that fetcher uses the short name. Refused too → the original outcome stands and no further retest happens in that fetcher.
- Requests that name their own user-agent (bot parity P9-01, link checks, media) are never retested. Timeouts and 429 are never retested (no bursts). Pacing per host is unchanged; robots.txt rules for `OpenSEO-Handbook` keep applying because the short form carries the same token.
- The crawl records `coverage.shortName`; the run page shows one info line ("This site refuses the app's full crawler name; pages were read with the short name OpenSEO-Handbook/1.0.") and exports add "read with the short app name" to the depth line. No severity, no score effect.
- Not built: reading as a browser. Sending a browser's user-agent to get past a block a site owner set is impersonation, and here it would not have worked. A site that drops both names gets a start-check reason that says so (WO-B27-002).

## Revert

- "never use the short name": set `shortNameRetry` off at both call sites; the start check then refuses such a site with the "closed the connection" reason.
