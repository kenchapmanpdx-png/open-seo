#!/usr/bin/env bash
# Nightly Supabase backup (ADR-011 "Backup"): pg_dump --format=custom of the
# app database to ~/openseo-backups/YYYY-MM-DD.dump, then prune to the 14
# newest daily dumps + the 8 newest Sunday dumps.
# Usage: bash fork/scripts/backup.sh [--dry-run]
# SUPABASE_DB_URL comes from .env.local (sourced into this process, never
# printed). No local pg_dump → runs it from the postgres:17 Docker image,
# passing the URL through the environment, not the command line.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL missing in .env.local}"

DIR="${OPENSEO_BACKUP_DIR:-$HOME/openseo-backups}"
OUT="$DIR/$(date +%F).dump"

if command -v pg_dump >/dev/null 2>&1; then
  dump() { pg_dump --format=custom --no-owner --dbname="$SUPABASE_DB_URL" --file="$1"; }
  TOOL="pg_dump (local)"
else
  dump() {
    docker run --rm -e SUPABASE_DB_URL -v "$DIR:/backups" postgres:17-alpine \
      sh -c 'pg_dump --format=custom --no-owner --dbname="$SUPABASE_DB_URL" --file="/backups/$0"' "$(basename "$1")"
  }
  TOOL="pg_dump (docker postgres:17-alpine)"
fi

# Keep: the 14 newest dumps, plus the 8 newest dumps taken on a Sunday.
prune_list() {
  local keep
  keep=$(
    {
      ls -1 "$DIR"/????-??-??.dump 2>/dev/null | sort -r | head -n 14
      for f in $(ls -1 "$DIR"/????-??-??.dump 2>/dev/null | sort -r); do
        [ "$(date -d "$(basename "$f" .dump)" +%u)" = 7 ] && echo "$f"
      done | head -n 8
    } | sort -u
  )
  for f in $(ls -1 "$DIR"/????-??-??.dump 2>/dev/null); do
    grep -qxF "$f" <<<"$keep" || echo "$f"
  done
}

if [ "$DRY_RUN" = 1 ]; then
  echo "dry run: would write $OUT with $TOOL"
  echo "dry run: would prune: $(prune_list | tr '\n' ' ')"
  exit 0
fi

mkdir -p "$DIR"
TMP="$OUT.partial"
dump "$TMP"
mv "$TMP" "$OUT"
echo "backup: $OUT ($(du -h "$OUT" | cut -f1))"
prune_list | while read -r f; do
  rm -f -- "$f"
  echo "pruned: $f"
done
