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
}

case "${1:-}" in
  dev)
    load_testmode
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
    pnpm build
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
