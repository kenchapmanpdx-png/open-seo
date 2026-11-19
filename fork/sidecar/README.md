# Handbook render sidecar (K3)

Node HTTP service wrapping Playwright Chromium, axe-core and Lighthouse for the
handbook RENDER / A11Y / PERF collectors (ADR-004). Contract:
`openapi.yaml` + `src/server/features/handbook/contracts/sidecar.ts`
(requests and responses are validated with those Zod schemas).

## Run (Docker, bound to 127.0.0.1)

```sh
export HANDBOOK_SIDECAR_TOKEN=$(openssl rand -hex 24)   # same value in the app env
docker compose -f fork/sidecar/compose.yaml up -d --build
curl -s http://127.0.0.1:4777/health
```

- BadGEO / local fixture sites: use the test-only service `sidecar-badgeo` on
  `127.0.0.1:4778` (`compose.badgeo.yaml`, `HANDBOOK_SIDECAR_ALLOW_PRIVATE=1`,
  `127.0.0.1.nip.io` → host gateway). `start-build.sh` starts it with the real
  one. Never set `ALLOW_PRIVATE=1` on the real sidecar (4777): it is the SSRF
  guard for live audits.
- Stall recovery (1.2.1): every task has a hard deadline (render = request
  timeout + 60 s, axe 120 s, Lighthouse 240 s) → HTTP 504 `deadline`. Two misses
  within 10 min, or a task still running at 2× its deadline → one log line and
  `exit(1)`; Docker restarts the container (`restart: unless-stopped`). Chromium
  is relaunched after `HANDBOOK_SIDECAR_RECYCLE_AFTER` tasks (default 500) when
  idle. The engine times out at deadline + 30 s; 3 timeouts in a row → it waits
  60 s, probes `/health` once, then resumes or marks the sidecar unavailable for
  the run.
- Playwright Chromium does not launch directly on the WSL host (missing system
  libs), so the container is the supported runtime.

## Endpoints

| Method | Path                  | Notes                                                                 |
| ------ | --------------------- | --------------------------------------------------------------------- |
| GET    | `/health`             | no auth; sidecar + Chromium + contracts versions                      |
| POST   | `/render`             | JS on/off, mobile/desktop, screenshots, scroll, requests, opacity:0   |
| POST   | `/axe`                | axe-core after a full-page scroll                                     |
| POST   | `/lighthouse`         | Lighthouse node API, own Chromium on a debugging port; mobile default |
| GET    | `/v1/web/scrape/html` | Context.dev-compatible shape for upstream `rendered-page.ts`          |

All but `/health` need `Authorization: Bearer $HANDBOOK_SIDECAR_TOKEN`. Non-http(s)
and private targets → 422 `{ error }`; page timeouts → 504; at most
`HANDBOOK_SIDECAR_MAX_RENDERS` browser jobs (default 3, 1–8) run at once.

`/render` (K3 1.2.0) records every request with `transferBytes`, `protocol`
and `aborted`: media bodies are always aborted (never downloaded), and with
`blockBeacons: true` (default) analytics / ad / pixel requests are aborted too
(`classify.ts`), so an audit never fires the client's tags. Aborted requests
stay in the log, so tag detection (P7-04) still sees them. `mediaElements`
lists every `<video>` and video iframe with first-screen and reserved-size
flags.

## Tests

The root Vitest config only includes `src/**` and `scripts/**`, so run the
sidecar test with its own root:

```sh
pnpm exec vitest run --root fork/sidecar
```

## Local fixture sites from the container

BadGEO advertises `http://127.0.0.1.nip.io:<port>`, which resolves to the
container's own loopback. `sidecar-badgeo` maps that name to the host gateway
(`extra_hosts`), and `badgeo-run.ts --sidecar http://127.0.0.1:4778` serves
BadGEO on `0.0.0.0` so the container can reach it.
