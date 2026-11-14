#!/usr/bin/env bash
# Run OpenSEO locally against Supabase Postgres (ADR-003 / ADR-009 defaults).
# Usage: bash fork/scripts/run-local.sh {dev|migrate|prod}
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

case "${1:-}" in
  dev)
    mkdir -p .logs
    exec pnpm dev:agents
    ;;
  migrate)
    pnpm db:migrate:pg
    pnpm exec tsx fork/scripts/run-sql.ts fork/scripts/supabase-harden.sql
    pnpm exec tsx fork/scripts/supabase-check.ts
    ;;
  prod)
    pnpm build
    exec pnpm exec vite preview --port "${PORT:-3001}"
    ;;
  *)
    echo "usage: $0 {dev|migrate|prod}" >&2
    exit 2
    ;;
esac
