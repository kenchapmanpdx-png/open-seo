#!/usr/bin/env bash
# Run OpenSEO locally against Supabase Postgres (ADR-003 / ADR-009 defaults).
# Usage: bash fork/scripts/run-local.sh {dev|migrate|sql <file.sql>|prod|ops <verb>}
# Sources .env.local into this process only; never prints any variable.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL missing in .env.local}"
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$SUPABASE_DB_URL"
export POSTGRES_DATABASE_URL="$SUPABASE_DB_URL"
export DATABASE_PROVIDER=postgres
# The Cloudflare Vite plugin reads Worker vars from .env.local; this also passes
# the exported DATABASE_PROVIDER through without editing .env.local.
export CLOUDFLARE_INCLUDE_PROCESS_ENV=true

# Pool mode (B13 WO-B13-004, ADR-025). prod / dev only: the app's Hyperdrive
# local connection string moves to the Supabase transaction pooler (:6543, same
# host) when OPENSEO_DB_POOL_MODE is `transaction` (default), the host ends in
# pooler.supabase.com, the port is 5432 and a 3-s TCP connect to :6543 works.
# Anything else keeps the session pooler. POSTGRES_DATABASE_URL, migrations and
# scripts stay on session. Prints only the mode line; the mode is also written
# to fork/runs/_ops/pool-mode for `ops status` and the build stamp.
apply_pool_mode() {
  local url="$SUPABASE_DB_URL" mode reason="" after hostport host port path
  mode="${OPENSEO_DB_POOL_MODE:-transaction}"
  after="${url##*@}"
  hostport="${after%%/*}"
  host="${hostport%%:*}"
  port="${hostport##*:}"
  [ "$hostport" = "$host" ] && port=""
  path=""
  [ "$after" != "$hostport" ] && path="/${after#*/}"
  if [ "$mode" != transaction ]; then
    reason="OPENSEO_DB_POOL_MODE=$mode"
  elif [ "${host%pooler.supabase.com}" = "$host" ]; then
    reason="host is not a Supabase pooler"
  elif [ "$port" != 5432 ]; then
    reason="port is not 5432"
  elif ! timeout 3 bash -c "exec 3<>/dev/tcp/$host/6543" 2>/dev/null; then
    reason="port 6543 unreachable"
  fi
  mkdir -p fork/runs/_ops
  if [ -n "$reason" ]; then
    POOL_MODE=session
    echo "pool-mode=session ($reason)"
  else
    POOL_MODE=transaction
    export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="${url%@*}@$host:6543$path"
    echo "pool-mode=transaction"
  fi
  echo "$POOL_MODE" >fork/runs/_ops/pool-mode
}

# Test mode (B13, ADR-028): `ops testmode on` writes this file; it applies to
# prod / dev only while it is younger than 12 h, so a forgotten flag expires.
load_testmode() {
  local f=fork/runs/_ops/testmode.env
  [ -f "$f" ] || return 0
  [ $(($(date +%s) - $(stat -c %Y "$f"))) -lt 43200 ] || return 0
  set -a
  # shellcheck disable=SC1090
  . "./$f"
  set +a
  TESTMODE_LOADED=1
}

# Restart without rebuild (B13 WO-B13-006, ADR-028). The build stamp hashes
# everything a build reads: HEAD, the tracked diff and untracked files under the
# build inputs, .env.local and the test-mode overrides (the Cloudflare plugin
# bakes env into dist/server/.dev.vars, so a test-mode switch needs a rebuild).
# Only the combined hash is stored; nothing is printed.
BUILD_INPUTS=(src public package.json pnpm-lock.yaml vite.config.ts wrangler.jsonc wrangler.audit.jsonc)
OPS_DIR=fork/runs/_ops
PREV_DIST="$OPS_DIR/prev/dist"

build_stamp() {
  {
    git rev-parse HEAD
    git diff HEAD --binary -- "${BUILD_INPUTS[@]}"
    git ls-files --others --exclude-standard -z -- "${BUILD_INPUTS[@]}" |
      sort -z | xargs -0 -r sha256sum
    cat .env.local
    if [ "${TESTMODE_LOADED:-0}" = 1 ]; then cat "$OPS_DIR/testmode.env"; fi
    echo "pool-mode=${POOL_MODE:-session}"
  } | sha256sum | cut -d' ' -f1
}

# Builds only when the stamp changed (FORCE_BUILD=1 forces). The previous build
# is kept in fork/runs/_ops/prev/dist (git-ignored; prettier skips any dist/
# directory) and restored when the
# build fails; fork/runs/_ops/build-failed then records time + exit code and the
# old build is served. fork/runs/_ops/building exists while a build runs so the
# watchdog leaves it alone. OPENSEO_BUILD_CMD overrides `pnpm build` (test hook).
build_if_needed() {
  mkdir -p "$OPS_DIR"
  local stamp rc
  stamp=$(build_stamp)
  if [ "${FORCE_BUILD:-0}" != 1 ] && [ -d dist ] &&
    [ "$(cat "$OPS_DIR/build-stamp" 2>/dev/null)" = "$stamp" ]; then
    echo "build: inputs unchanged, serving the existing build"
    # The served build matches the inputs, so an older failure is stale.
    rm -f "$OPS_DIR/build-failed"
    return 0
  fi
  touch "$OPS_DIR/building"
  trap 'rm -f "$OPS_DIR/building"' EXIT
  rm -rf "$PREV_DIST"
  mkdir -p "$(dirname "$PREV_DIST")"
  if [ -d dist ]; then cp -a dist "$PREV_DIST"; fi
  set +e
  ${OPENSEO_BUILD_CMD:-pnpm build}
  rc=$?
  set -e
  rm -f "$OPS_DIR/building"
  trap - EXIT
  if [ "$rc" -ne 0 ]; then
    if [ -d "$PREV_DIST" ]; then
      rm -rf dist
      cp -a "$PREV_DIST" dist
    fi
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) exit=$rc" >"$OPS_DIR/build-failed"
    echo "build: failed (exit $rc), serving the previous build" >&2
    return 0
  fi
  rm -f "$OPS_DIR/build-failed"
  echo "$stamp" >"$OPS_DIR/build-stamp"
}

case "${1:-}" in
  dev)
    load_testmode
    apply_pool_mode
    mkdir -p .logs
    exec pnpm dev:agents
    ;;
  migrate)
    pnpm db:migrate:pg
    pnpm exec tsx fork/scripts/run-sql.ts fork/scripts/supabase-harden.sql
    pnpm exec tsx fork/scripts/supabase-check.ts
    ;;
  sql)
    # Apply one SQL file (e.g. an upstream migration the journal skipped after a
    # rebase, MAINTENANCE M1), then re-harden and check.
    : "${2:?usage: $0 sql <file.sql>}"
    pnpm exec tsx fork/scripts/run-sql.ts "$2"
    pnpm exec tsx fork/scripts/run-sql.ts fork/scripts/supabase-harden.sql
    pnpm exec tsx fork/scripts/supabase-check.ts
    ;;
  prod)
    load_testmode
    apply_pool_mode
    build_if_needed
    exec pnpm exec vite preview --port "${PORT:-3001}"
    ;;
  ops)
    exec bash fork/scripts/ops/ops.sh "${@:2}"
    ;;
  *)
    echo "usage: $0 {dev|migrate|sql <file>|prod|ops <verb>}" >&2
    exit 2
    ;;
esac
