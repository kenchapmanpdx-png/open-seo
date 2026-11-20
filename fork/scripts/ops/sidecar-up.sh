#!/usr/bin/env bash
# Bring the render sidecar up and prove it works (fork/DEPENDABILITY.md WO-B13-012, ADR-028).
# Steps 1–5 of fork/scripts/start-build.sh (that script stays untouched in B13):
#   Docker reachable → token present or created → compose up → health + contracts → token check.
# Reached through `bash fork/scripts/run-local.sh ops sidecar start [--build]` and the watchdog.
# Only the production sidecar (4777); the BadGEO test sidecar stays start-build.sh's job.
# `--build` forces an image rebuild; default builds only when the image is missing.
# `--probe` also renders HEALTH_RENDER_PROBE_URL (default https://example.com/) once.
# The token is never put in argv and never printed.
# Exit 0 = sidecar healthy, contracts match, token accepted (and probe ok when asked); 1 otherwise.
set -u
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 1

say() { printf 'sidecar-up: %s\n' "$*"; }
die() {
  say "FAILED: $*"
  exit 1
}

BUILD=0
PROBE=0
for a in "$@"; do
  case "$a" in
    --build) BUILD=1 ;;
    --probe) PROBE=1 ;;
    *)
      echo "usage: sidecar-up.sh [--build] [--probe]" >&2
      exit 2
      ;;
  esac
done

WAIT_DOCKER="${WAIT_DOCKER:-180}" # seconds
WAIT_HEALTH="${WAIT_HEALTH:-120}" # seconds
ENV_FILE=.env.local
TMP_ENV=fork/runs/_ops/.env.sidecar # git-ignored; deleted right after use
COMPOSE=fork/sidecar/compose.yaml
BASE="${SIDECAR_URL:-http://127.0.0.1:4777}"
VERSION_FILE=src/server/features/handbook/contracts/version.ts
DESKTOP="/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe"

# The token must come from .env.local only (same rule as start-build.sh).
unset HANDBOOK_SIDECAR_TOKEN HANDBOOK_SIDECAR_ALLOW_PRIVATE
# The Windows docker CLI only receives the variables named in WSLENV.
export WSLENV="HANDBOOK_SIDECAR_TOKEN:HANDBOOK_SIDECAR_ALLOW_PRIVATE${WSLENV:+:$WSLENV}"

mkdir -p fork/runs/_ops
trap 'rm -f "$TMP_ENV"' EXIT
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found"
[ -f "$COMPOSE" ] || die "$COMPOSE not found"

# systemd units get a minimal PATH.
if command -v docker >/dev/null 2>&1; then
  DOCKER=$(command -v docker)
elif [ -x /usr/bin/docker ]; then
  DOCKER=/usr/bin/docker
else
  DOCKER="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
fi

# Token for curl via a config on stdin (never argv).
auth_config() {
  grep -m1 '^HANDBOOK_SIDECAR_TOKEN=' "$ENV_FILE" | tr -d '\r"' | sed -E 's/^HANDBOOK_SIDECAR_TOKEN=//' |
    { IFS= read -r t; printf 'header = "Authorization: Bearer %s"\n' "$t"; }
}

# POST /render of one public page, 60 s limit. Prints the HTTP code.
sidecar_render_probe() {
  local url="${HEALTH_RENDER_PROBE_URL:-https://example.com/}" body
  body=$(printf '{"url":"%s","javascript":true,"viewport":"desktop","screenshot":"none","scrollToEnd":false,"timeoutMs":45000}' "$url")
  auth_config | curl -s --max-time 60 -o /dev/null -w '%{http_code}' -K - \
    -H 'content-type: application/json' --data "$body" "$BASE/render" || true
}

# 1. Docker (start Docker Desktop once when it is installed; best effort under systemd)
waited=0
started_desktop=0
until "$DOCKER" info >/dev/null 2>&1; do
  if [ "$started_desktop" -eq 0 ] && [ -f "$DESKTOP" ]; then
    say "Docker not answering; starting Docker Desktop (best effort)"
    setsid "$DESKTOP" </dev/null >/dev/null 2>&1 &
    started_desktop=1
  fi
  waited=$((waited + 5))
  [ "$waited" -ge "$WAIT_DOCKER" ] && die "Docker is not running after ${WAIT_DOCKER}s"
  sleep 5
done

# 2. Token (kept in .env.local; value never shown)
if ! grep -qE '^HANDBOOK_SIDECAR_TOKEN=.{16,}' "$ENV_FILE"; then
  tok=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  [ "${#tok}" -eq 48 ] || die "could not generate a sidecar token"
  sed -i '/^HANDBOOK_SIDECAR_TOKEN=/d' "$ENV_FILE"
  printf '\nHANDBOOK_SIDECAR_TOKEN=%s\n' "$tok" >>"$ENV_FILE"
  unset tok
  say "sidecar token created in $ENV_FILE (restart the app so it reads it)"
fi

# 3. Compose up (build only when forced or the image is missing)
image=$(sed -nE 's/^[[:space:]]*image:[[:space:]]*([^[:space:]]+).*/\1/p' "$COMPOSE" | head -n 1)
build_flag=()
if [ "$BUILD" -eq 1 ] || ! "$DOCKER" image inspect "$image" >/dev/null 2>&1; then
  build_flag=(--build)
  say "building $image"
fi
(umask 077 && grep -m1 '^HANDBOOK_SIDECAR_TOKEN=' "$ENV_FILE" | tr -d '\r' >"$TMP_ENV")
"$DOCKER" compose --env-file "$TMP_ENV" -f "$COMPOSE" up -d "${build_flag[@]}" >/dev/null 2>&1 ||
  die "docker compose up failed"
rm -f "$TMP_ENV"

# 4. Health + contracts version
want=$(grep -oE 'CONTRACTS_VERSION = "[^"]+"' "$VERSION_FILE" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
waited=0
while :; do
  health=$(curl -s --max-time 5 "$BASE/health" || true)
  case "$health" in
    *'"ok":true'*)
      [ -z "$want" ] && break
      case "$health" in *"\"contractsVersion\":\"$want\""*) break ;; esac
      ;;
  esac
  waited=$((waited + 3))
  [ "$waited" -ge "$WAIT_HEALTH" ] && die "not healthy on contracts ${want:-?} after ${WAIT_HEALTH}s"
  sleep 3
done

# 5. The running sidecar accepts the .env.local token (401 = started with another one)
code=$(auth_config | curl -s --max-time 5 -o /dev/null -w '%{http_code}' -K - "$BASE/token-check" || true)
case "$code" in
  401) die "sidecar runs with a different token than $ENV_FILE (docker compose -f $COMPOSE down, then start again)" ;;
  "" | 000) die "no answer from the token check" ;;
esac
say "ok (contracts ${want:-unknown}, token matches, ${waited}s)"

if [ "$PROBE" -eq 1 ]; then
  code=$(sidecar_render_probe)
  [ "$code" = 200 ] || die "render probe HTTP ${code:-000}"
  say "render probe ok"
fi
exit 0
