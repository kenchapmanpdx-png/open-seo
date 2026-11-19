#!/usr/bin/env bash
# Start or resume the unattended build. Safe to run again at any time.
#   cd ~/open-seo && git pull --ff-only && bash fork/scripts/start-build.sh
# Steps: Docker reachable -> sidecar token in .env.local -> sidecar (+ BadGEO test sidecar on 4778) rebuilt + started with that
#        token -> health, contracts version and token check -> clear a "restart sidecar"
#        needs-ken in fork/STATE.md -> autopilot.
# Never prints the token and never exports it to the build. `--check` = do everything except
# launch the autopilot.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

say() { printf 'START-BUILD: %s\n' "$*"; }
die() { say "STOPPED. $*"; exit 1; }

LAUNCH=1
[ "${1:-}" = "--check" ] && LAUNCH=0
WAIT_DOCKER="${WAIT_DOCKER:-180}"   # seconds
WAIT_HEALTH="${WAIT_HEALTH:-120}"   # seconds
ENV_FILE=.env.local
TMP_ENV=.env.sidecar                # gitignored (.env.*); deleted right after use
COMPOSE=fork/sidecar/compose.yaml
COMPOSE_BADGEO=fork/sidecar/compose.badgeo.yaml   # test-only sidecar on 4778 (WO-B12-004)
BASE="${SIDECAR_URL:-http://127.0.0.1:4777}"
VERSION_FILE=src/server/features/handbook/contracts/version.ts

# A token exported in the calling shell would win over .env.local, both for Compose and for
# every CLI run the build makes. The build must only ever see the .env.local value.
unset HANDBOOK_SIDECAR_TOKEN HANDBOOK_SIDECAR_ALLOW_PRIVATE
# When Docker Desktop's Ubuntu integration is off, `docker` is the Windows CLI, which only
# receives the variables named in WSLENV. Naming these two lets the build's own
# `HANDBOOK_SIDECAR_TOKEN=... docker compose ...` commands work there. No effect on the Linux CLI.
export WSLENV="HANDBOOK_SIDECAR_TOKEN:HANDBOOK_SIDECAR_ALLOW_PRIVATE${WSLENV:+:$WSLENV}"

trap 'rm -f "$TMP_ENV"' EXIT

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found in $(pwd)."
[ -f "$COMPOSE" ] || die "$COMPOSE not found."

# 1. Docker
command -v docker >/dev/null 2>&1 || die "The docker command was not found. Open Docker Desktop, then run this again."
waited=0
until docker info >/dev/null 2>&1; do
  [ "$waited" -eq 0 ] && say "waiting for Docker (open Docker Desktop if it is closed)"
  waited=$((waited + 5))
  [ "$waited" -ge "$WAIT_DOCKER" ] && die "Docker is not running. Open Docker Desktop, wait until it shows running, then run this again."
  sleep 5
done
hash -r
case "$(command -v docker)" in
  /mnt/*) say "docker = Windows CLI (Ubuntu integration is off in Docker Desktop; that is fine)" ;;
  *) say "docker = $(command -v docker)" ;;
esac

# 2. Token (kept in .env.local; value never shown)
if ! grep -qE '^HANDBOOK_SIDECAR_TOKEN=.{16,}' "$ENV_FILE"; then
  tok=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  [ "${#tok}" -eq 48 ] || die "Could not generate a sidecar token."
  sed -i '/^HANDBOOK_SIDECAR_TOKEN=/d' "$ENV_FILE"
  printf '\nHANDBOOK_SIDECAR_TOKEN=%s\n' "$tok" >>"$ENV_FILE"
  unset tok
  say "sidecar token created in $ENV_FILE"
fi

# 3. Sidecar: build from the current code, start with the .env.local token
(umask 077 && grep -m1 '^HANDBOOK_SIDECAR_TOKEN=' "$ENV_FILE" | tr -d '\r' >"$TMP_ENV")
say "building and starting the sidecar"
docker compose --env-file "$TMP_ENV" -f "$COMPOSE" -f "$COMPOSE_BADGEO" up -d --build || die "The sidecar did not start. Docker's message is above."
rm -f "$TMP_ENV"

# 4. Health + contracts version
want=$(grep -oE 'CONTRACTS_VERSION = "[^"]+"' "$VERSION_FILE" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
waited=0
while :; do
  health=$(curl -s --max-time 5 "$BASE/health" || true)
  case "$health" in
    *'"ok":true'*)
      if [ -z "$want" ]; then break; fi
      case "$health" in *"\"contractsVersion\":\"$want\""*) break ;; esac
      ;;
  esac
  waited=$((waited + 3))
  [ "$waited" -ge "$WAIT_HEALTH" ] && die "The sidecar is not healthy on contracts ${want:-?}. Last answer: ${health:-none}"
  sleep 3
done

# 5. The running sidecar accepts the .env.local token (401 = it was started with another one)
code=$(grep -m1 '^HANDBOOK_SIDECAR_TOKEN=' "$ENV_FILE" | tr -d '\r"' | sed -E 's/^HANDBOOK_SIDECAR_TOKEN=//' |
  { IFS= read -r t; printf 'header = "Authorization: Bearer %s"\n' "$t"; } |
  curl -s --max-time 5 -o /dev/null -w '%{http_code}' -K - "$BASE/token-check" || true)
case "$code" in
  401) die "The sidecar is running with a different token than $ENV_FILE. Run: docker compose -f $COMPOSE down ; then run this again." ;;
  "" | 000) die "No answer from the sidecar token check." ;;
esac
say "sidecar ok (contracts ${want:-unknown}, token matches)"
# The BadGEO test sidecar only warns: real audits do not need it.
waited=0
until curl -s --max-time 5 http://127.0.0.1:4778/health | grep -q '"ok":true'; do
  waited=$((waited + 3))
  if [ "$waited" -ge 30 ]; then say "warning: BadGEO test sidecar (4778) not healthy; BadGEO --sidecar runs will fail"; break; fi
  sleep 3
done
docker rm -f hb-sidecar-badgeo >/dev/null 2>&1 || true   # ad-hoc container from B9/B10

# 6. The app reads the token when it starts: restart it so it always holds the .env.local value
if systemctl --user restart openseo-app.service 2>/dev/null; then
  say "app restarted (http://localhost:3001)"
else
  say "note: could not restart openseo-app.service; in-app audits may not reach the sidecar until the app is restarted"
fi

# 7. Build state
status=$(grep -m1 '^status:' fork/STATE.md | sed -E 's/^status:[[:space:]]*//; s/[[:space:]].*//')
case "$status" in
  done)
    say "the build is complete (fork/STATE.md)."
    exit 0
    ;;
  needs-ken)
    if grep -m1 '^needs_ken:' fork/STATE.md | grep -qi 'restart sidecar'; then
      sed -i -E '0,/^status:[[:space:]]*needs-ken/s//status: in-progress/' fork/STATE.md
      sed -i -E "0,/^needs_ken:.*/s//needs_ken: (none; sidecar restarted by start-build.sh $(date +%F))/" fork/STATE.md
      git add fork/STATE.md && git commit -q -m "ken: sidecar restarted (start-build.sh); resume build" ||
        die "Could not record the sidecar restart in fork/STATE.md."
      say "sidecar restart recorded; the build resumes"
    else
      say "the build is waiting on you:"
      grep -m1 '^needs_ken:' fork/STATE.md
      exit 2
    fi
    ;;
esac

[ "$LAUNCH" -eq 1 ] || { say "all checks passed (--check: autopilot not started)"; exit 0; }

# 8. Autopilot
say "starting the build. Watch: tail -f fork/runs/autopilot.log   Stop: Ctrl+C"
bash fork/scripts/autopilot.sh
rc=$?
case "$rc" in
  0) say "build complete." ;;
  2) say "the build stopped for you: see needs_ken in fork/STATE.md. If it says 'restart sidecar', run this script again." ;;
  3) say "three runs made no progress: see fork/runs/autopilot.log." ;;
  4) say "usage limit reached: run this script again after the reset." ;;
  5) say "run cap reached: run this script again to continue." ;;
  *) say "autopilot exited with code $rc: see fork/runs/autopilot.log." ;;
esac
exit "$rc"
