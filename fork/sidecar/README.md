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

- BadGEO / local fixture sites: add `HANDBOOK_SIDECAR_ALLOW_PRIVATE=1` before
  `up` (the guard otherwise refuses hosts resolving to private/loopback ranges;
  `127.0.0.1.nip.io` inside the container needs `host.docker.internal` routing,
  see below).
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
container's own loopback. Serve BadGEO on `0.0.0.0` and point the audit at
`http://host.docker.internal:<port>` (compose adds no extra_hosts; Docker
Desktop provides that name), or run the container with `network_mode: host`.
