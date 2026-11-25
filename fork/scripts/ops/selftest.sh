#!/usr/bin/env bash
# Weekly self-test (fork/DEPENDABILITY.md WO-B13-016, R10). Run by
# openseo-selftest.timer (Sunday 05:10) or `ops selftest` (detached).
#
#   1. Skips when an audit or a Handbook run is active (health route).
#   2. BadGEO quick: `badgeo-run.ts` on the fixture site → missing / unexpected.
#   3. Live part (SELFTEST_INAPP=0 skips it): `ops e2e weekly --max-pages 50`
#      in the B13 test project with test mode off. A test mode that is on is
#      put aside for the run and restored afterwards (same file, same expiry).
#   4. Writes fork/runs/_ops/selftest.json { at, badgeo, e2e, ok } through
#      selftest-eval.mjs; the watchdog reads it (W8).
#
#   selftest.sh --evaluate <e2e.json> [missing unexpected]
#      verdict only (defaults 0 0); prints the JSON, writes nothing.
# Never prints an env value.
set -uo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

OPS_DIR=fork/runs/_ops
OUT="$OPS_DIR/selftest.json"
EVAL=fork/scripts/ops/selftest-eval.mjs
APP_URL="${OPENSEO_APP_URL:-http://127.0.0.1:3001}"
E2E_TIMEOUT_MIN=90

if [ "${1:-}" = "--evaluate" ]; then
  [ $# -ge 2 ] || {
    echo "usage: selftest.sh --evaluate <e2e.json> [missing unexpected]" >&2
    exit 2
  }
  node "$EVAL" "$2" "${3:-0}" "${4:-0}"
  exit $?
fi

mkdir -p "$OPS_DIR"
log() { echo "$(date -u +%FT%TZ) selftest: $*"; }

exec 9>"$OPS_DIR/selftest.lock"
flock -n 9 || {
  log "another self-test is running; skipped"
  exit 0
}

health() { curl -s --max-time 20 "$APP_URL/api/fork-health"; }

wait_healthy() {
  for _ in $(seq 1 36); do
    if health | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.exit(JSON.parse(s).checks.db.ok?0:1)}catch{process.exit(1)}})'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

busy=$(health | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const c=JSON.parse(s).checks;console.log(c.audits.running>0||c.handbook.leaseHolder?"busy":"idle")}catch{console.log("unreachable")}})')
case "$busy" in
  busy)
    log "an audit or Handbook run is active; skipped"
    exit 0
    ;;
  unreachable)
    log "health route unreachable; recording a failed self-test"
    ;;
esac

# --- BadGEO quick ---------------------------------------------------------
log "BadGEO run"
badgeo_out=$(pnpm exec tsx fork/scripts/badgeo-run.ts 2>&1)
summary=$(printf '%s\n' "$badgeo_out" | grep -E '^pages [0-9]+ · missing' | tail -1)
missing=$(printf '%s' "$summary" | sed -nE 's/.*missing ([0-9]+).*/\1/p')
unexpected=$(printf '%s' "$summary" | sed -nE 's/.*unexpected ([0-9]+).*/\1/p')
log "BadGEO missing=${missing:-?} unexpected=${unexpected:-?}"

# --- field-test ledgers (WO-B22-003) --------------------------------------
ledger_out=$(pnpm exec tsx fork/scripts/field-test.ts --verify-ledgers 2>&1)
drift=$(printf '%s\n' "$ledger_out" | sed -nE 's/.*: ([0-9]+) drifted row.*/\1/p' | tail -1)
log "field-test ledgers drifted=${drift:-?}"

# --- live in-app run ------------------------------------------------------
e2e_file="-"
if [ "${SELFTEST_INAPP:-1}" = 0 ]; then
  log "SELFTEST_INAPP=0: live part skipped"
elif [ "$busy" = unreachable ]; then
  e2e_file="$OPS_DIR/e2e-weekly.missing"
else
  saved=""
  if [ -f "$OPS_DIR/testmode.env" ]; then
    saved="$OPS_DIR/testmode.env.selftest"
    cp -p "$OPS_DIR/testmode.env" "$saved"
    log "test mode on: off for the run, restored afterwards"
    bash fork/scripts/run-local.sh ops testmode off >/dev/null
    wait_healthy || log "app not healthy after the test-mode restart"
  fi
  rm -f "$OPS_DIR/e2e-weekly.json" "$OPS_DIR/job-e2e-weekly.exit"
  export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64
  bash fork/scripts/run-local.sh ops e2e weekly --max-pages 50 >/dev/null
  log "in-app E2E started (fork/runs/_ops/job-e2e-weekly.log)"
  deadline=$(($(date +%s) + E2E_TIMEOUT_MIN * 60))
  while [ ! -f "$OPS_DIR/job-e2e-weekly.exit" ] && [ "$(date +%s)" -lt "$deadline" ]; do
    sleep 30
  done
  log "in-app E2E exit $(cat "$OPS_DIR/job-e2e-weekly.exit" 2>/dev/null || echo timeout)"
  e2e_file="$OPS_DIR/e2e-weekly.json"
  if [ -n "$saved" ]; then
    mv "$saved" "$OPS_DIR/testmode.env"
    bash fork/scripts/run-local.sh ops restart app >/dev/null
    log "test mode restored"
  fi
fi

result=$(node "$EVAL" "$e2e_file" "${missing:-x}" "${unexpected:-x}" "${drift:-x}")
code=$?
# Pretty-printed: fork/runs is inside prettier's scope (format:check).
printf '%s' "$result" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s),null,2)))' \
    >"$OUT.tmp" && mv "$OUT.tmp" "$OUT"
log "wrote $OUT: $result"
exit "$code"
