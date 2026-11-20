#!/usr/bin/env bash
# Fixed ops verbs for the unattended build agent and the watchdog (ADR-028,
# fork/DEPENDABILITY.md WO-B13-001). Reached only through
#   bash fork/scripts/run-local.sh ops <verb> …
# which has already loaded .env.local into this process. Nothing here prints
# an env value; every verb's output goes through `redact`.
# Exit codes: 0 ok · 1 check failed · 2 usage.
set -uo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 1

OPS_DIR="fork/runs/_ops"
mkdir -p "$OPS_DIR"
APP_UNIT="openseo-app.service"
SIDECAR="sidecar-sidecar-1"
APP_URL="${OPENSEO_APP_URL:-http://127.0.0.1:3001}"
MAX_AGE_S=$((12 * 3600))

redact() {
  sed -E 's#postgres(ql)?://[^[:space:]"]+#postgres://[redacted]#g; s#Bearer [^[:space:]"]+#Bearer [redacted]#g; s#eyJ[A-Za-z0-9_-]{8,}[A-Za-z0-9._-]*#[redacted-jwt]#g'
}

usage() {
  cat >&2 <<'EOF'
usage: run-local.sh ops <verb>
  status | logs <since> <until> | sockets | measure <label> <minutes>
  wait <label> <max-min> | restart app|sidecar|tick | kill-workerd
  sidecar stop|start|pause|unpause | units | maint on|off
  testmode on [--rerun]|off | e2e <args…> | e2e-read <auditId>
  watchdog | selftest | backfill-grades
EOF
  exit 2
}

docker_bin() {
  if command -v docker >/dev/null 2>&1; then
    command -v docker
  elif [ -x /usr/bin/docker ]; then
    echo /usr/bin/docker
  else
    echo "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
  fi
}

# Age in seconds of a file's mtime, or empty when missing.
age_s() {
  [ -e "$1" ] || return 0
  echo $(($(date +%s) - $(stat -c %Y "$1")))
}

fresh() {
  local a
  a=$(age_s "$1")
  [ -n "$a" ] && [ "$a" -lt "$MAX_AGE_S" ]
}

pooler_sockets() {
  ss -Htn state established '( dport = :5432 or dport = :6543 )' 2>/dev/null | wc -l
}

# Runs a long verb detached: prints PID + output path, returns at once.
detach() {
  local label="$1"
  shift
  local out="$OPS_DIR/job-$label.log"
  : >"$out"
  rm -f "$OPS_DIR/job-$label.exit"
  # New session, no inherited stdout: the job outlives this call and does not
  # hold the `| redact` pipe open.
  setsid bash -c '"${@:2}" 2>&1 | sed -u -E "s#postgres(ql)?://[^[:space:]]+#postgres://[redacted]#g; s#Bearer [^[:space:]]+#Bearer [redacted]#g" >>"$1"; echo "${PIPESTATUS[0]}" >"${1%.log}.exit"' \
    _ "$out" "$@" </dev/null >/dev/null 2>&1 &
  local pid=$!
  echo "$pid" >"$OPS_DIR/job-$label.pid"
  echo "pid=$pid output=$out"
}

cmd_status() {
  local unit tick wd sc
  unit=$(systemctl --user is-active "$APP_UNIT" 2>/dev/null)
  tick=$(systemctl --user is-active openseo-tick.timer 2>/dev/null)
  wd=$(systemctl --user is-active openseo-watchdog.timer 2>/dev/null)
  sc=$("$(docker_bin)" inspect -f '{{.State.Status}}' "$SIDECAR" 2>/dev/null || echo missing)
  echo "app_unit=${unit:-unknown}"
  echo "tick_timer=${tick:-unknown}"
  echo "watchdog_timer=${wd:-unknown}"
  echo "sidecar_container=$sc"
  echo "pool_mode=$(cat "$OPS_DIR/pool-mode" 2>/dev/null || echo session)"
  echo "pooler_sockets=$(pooler_sockets)"
  if [ -f "$OPS_DIR/build-stamp" ]; then
    echo "build_stamp=$(cut -c1-12 "$OPS_DIR/build-stamp")"
  else
    echo "build_stamp=none"
  fi
  if [ -f "$OPS_DIR/build-failed" ]; then echo "build_failed=yes"; else echo "build_failed=no"; fi
  if fresh "$OPS_DIR/testmode.env"; then echo "test_mode=on"; else echo "test_mode=off"; fi
  if fresh "$OPS_DIR/maintenance"; then echo "maintenance=on"; else echo "maintenance=off"; fi
  local newest
  newest=$(ls -1t "${OPENSEO_BACKUP_DIR:-$HOME/openseo-backups}"/????-??-??.dump 2>/dev/null | head -n 1)
  if [ -n "$newest" ]; then
    echo "backup_age_h=$(($(age_s "$newest") / 3600))"
  else
    echo "backup_age_h=none"
  fi
  echo "backup_unit=$(systemctl --user is-failed openseo-backup.service 2>/dev/null || echo unknown)"
  echo "disk_free_gb=$(df -BG --output=avail . | tail -n 1 | tr -dc '0-9')"
  local health
  health=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$APP_URL/api/fork-health" 2>/dev/null)
  echo "health_http=${health:-000}"
  if [ "$health" = 200 ]; then
    curl -s -m 5 "$APP_URL/api/fork-health" |
      node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const h=JSON.parse(s);console.log("health_ok="+h.ok);for(const[k,v]of Object.entries(h.checks??{}))if(v&&v.ok===false)console.log("health_fail="+k)}catch{console.log("health_ok=unparsable")}})'
  fi
  if [ -f "$OPS_DIR/status.json" ]; then
    node -e 'try{const s=require(process.argv[1]);console.log("watchdog_level="+s.level+" at="+s.at)}catch{}' "$PWD/$OPS_DIR/status.json"
  fi
}

LOG_PATTERNS=(
  "P1:EMAXCONN|max client|MaxClientsInSessionMode|too many clients|remaining connection slots"
  "P2:CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED|Network connection lost"
  "P3:Failed query"
  "P4:prepared statement"
  "P5:out of memory|exceeded memory|Killed process"
  "P6:uncaught|Unhandled"
)

app_log() {
  local since="$1" until="$2" lines
  lines=$(journalctl --user -u "$APP_UNIT" --no-pager -o short-iso --since "$since" --until "$until" 2>/dev/null)
  if [ -z "$lines" ] && [ -f "$OPS_DIR/app.log" ]; then
    lines=$(cat "$OPS_DIR/app.log")
  fi
  printf '%s\n' "$lines"
}

cmd_logs() {
  [ $# -eq 2 ] || usage
  local tmp
  tmp=$(mktemp)
  app_log "$1" "$2" >"$tmp"
  local total
  total=$(grep -c . "$tmp")
  echo "lines=$total"
  if [ "$total" -eq 0 ]; then
    echo "log=not available"
    rm -f "$tmp"
    return 0
  fi
  local p id re n
  for p in "${LOG_PATTERNS[@]}"; do
    id=${p%%:*}
    re=${p#*:}
    n=$(grep -ciE "$re" "$tmp")
    echo "$id=$n"
    [ "$n" -gt 0 ] && grep -iE "$re" "$tmp" | head -n 5 | cut -c1-300 | sed "s/^/  $id| /"
  done
  rm -f "$tmp"
}

cmd_sockets() {
  echo "pooler_sockets=$(pooler_sockets)"
  ss -Htn state established '( dport = :5432 or dport = :6543 )' 2>/dev/null |
    awk '{print $4}' | sed -E 's/.*:([0-9]+)$/port=\1/' | sort | uniq -c | awk '{print $2"_count="$1}'
}

cmd_wait() {
  [ $# -eq 2 ] || usage
  local label="$1" max_min="$2" pid deadline
  [ "$max_min" -gt 9 ] && max_min=9
  deadline=$(($(date +%s) + max_min * 60))
  while :; do
    if [ -f "$OPS_DIR/job-$label.exit" ]; then
      if [ "$(cat "$OPS_DIR/job-$label.exit")" = 0 ]; then echo done; else echo failed; fi
      tail -n 5 "$OPS_DIR/job-$label.log"
      return 0
    fi
    pid=$(cat "$OPS_DIR/job-$label.pid" 2>/dev/null)
    if [ -z "$pid" ]; then
      echo "failed (no job $label)"
      return 1
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo failed
      return 0
    fi
    [ "$(date +%s)" -ge "$deadline" ] && {
      echo running
      return 0
    }
    sleep 10
  done
}

cmd_restart() {
  case "${1:-}" in
    app)
      # FORCE_BUILD / OPENSEO_BUILD_CMD (test hook) reach the unit for this
      # start only: set in the user manager, restart, unset.
      local vars=()
      [ -n "${FORCE_BUILD:-}" ] && vars+=("FORCE_BUILD=$FORCE_BUILD")
      [ -n "${OPENSEO_BUILD_CMD:-}" ] && vars+=("OPENSEO_BUILD_CMD=$OPENSEO_BUILD_CMD")
      [ ${#vars[@]} -gt 0 ] && systemctl --user set-environment "${vars[@]}"
      systemctl --user restart "$APP_UNIT" && echo "restarted $APP_UNIT"
      [ ${#vars[@]} -gt 0 ] && systemctl --user unset-environment FORCE_BUILD OPENSEO_BUILD_CMD
      return 0
      ;;
    tick) systemctl --user restart openseo-tick.timer && echo "restarted openseo-tick.timer" ;;
    sidecar) "$(docker_bin)" restart "$SIDECAR" >/dev/null && echo "restarted $SIDECAR" ;;
    *) usage ;;
  esac
}

cmd_kill_workerd() {
  local pid
  pid=$(systemctl --user show -p MainPID --value "$APP_UNIT" 2>/dev/null)
  [ -n "$pid" ] && [ "$pid" != 0 ] || {
    echo "app unit not running"
    return 1
  }
  local pids
  pids=$(pgrep -f workerd | while read -r p; do
    # Only workerd processes inside the app unit's cgroup.
    grep -q "$APP_UNIT" "/proc/$p/cgroup" 2>/dev/null && echo "$p"
  done)
  [ -n "$pids" ] || {
    echo "no workerd process in $APP_UNIT"
    return 1
  }
  # shellcheck disable=SC2086
  kill -9 $pids && echo "killed workerd: $(echo $pids | wc -w) process(es)"
}

cmd_sidecar() {
  local d
  d=$(docker_bin)
  case "${1:-}" in
    stop) "$d" stop "$SIDECAR" >/dev/null && echo "stopped $SIDECAR" ;;
    pause) "$d" pause "$SIDECAR" >/dev/null && echo "paused $SIDECAR" ;;
    unpause) "$d" unpause "$SIDECAR" >/dev/null && echo "unpaused $SIDECAR" ;;
    start)
      if [ -f fork/scripts/ops/sidecar-up.sh ]; then
        bash fork/scripts/ops/sidecar-up.sh "${@:2}"
      else
        "$d" start "$SIDECAR" >/dev/null && echo "started $SIDECAR"
      fi
      ;;
    *) usage ;;
  esac
}

cmd_maint() {
  case "${1:-}" in
    on) date -u +%FT%TZ >"$OPS_DIR/maintenance" && echo "maintenance=on (expires after 12 h)" ;;
    off) rm -f "$OPS_DIR/maintenance" && echo "maintenance=off" ;;
    *) usage ;;
  esac
}

cmd_testmode() {
  case "${1:-}" in
    on)
      local rerun=0
      [ "${2:-}" = "--rerun" ] && rerun=1
      cat >"$OPS_DIR/testmode.env" <<EOF
OPENSEO_TEST_MODE=1
HANDBOOK_MAX_PAGES=25
HANDBOOK_LLM_BUDGET_USD=0.25
HANDBOOK_AUTO_RERUN=$rerun
EOF
      echo "test_mode=on rerun=$rerun (expires after 12 h)"
      [ "${OPS_NO_RESTART:-0}" = 1 ] || cmd_restart app
      ;;
    off)
      rm -f "$OPS_DIR/testmode.env"
      echo "test_mode=off"
      [ "${OPS_NO_RESTART:-0}" = 1 ] || cmd_restart app
      ;;
    *) usage ;;
  esac
}

run_tsx() {
  pnpm exec tsx "$@"
}

verb="${1:-}"
[ $# -gt 0 ] && shift
case "$verb" in
  status) cmd_status ;;
  logs) cmd_logs "$@" ;;
  sockets) cmd_sockets ;;
  measure)
    [ $# -eq 2 ] || usage
    detach "measure-$1" pnpm exec tsx fork/scripts/ops/measure.ts "$1" "$2"
    ;;
  wait) cmd_wait "$@" ;;
  restart) cmd_restart "$@" ;;
  kill-workerd) cmd_kill_workerd ;;
  sidecar) cmd_sidecar "$@" ;;
  units) bash fork/scripts/install-units.sh ;;
  maint) cmd_maint "$@" ;;
  testmode) cmd_testmode "$@" ;;
  e2e)
    label=""
    prev=""
    for a in "$@"; do
      [ "$prev" = "--label" ] && label="$a"
      prev="$a"
    done
    # `ops e2e <label> …` shorthand: first bare word is the label.
    if [ -z "$label" ] && [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; then
      label="$1"
      shift
      set -- --label "$label" "$@"
    fi
    [ -n "$label" ] || usage
    export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64
    detach "e2e-$label" node fork/scripts/ops/inapp-audit.mjs "$@"
    ;;
  e2e-read)
    [ $# -ge 1 ] || usage
    run_tsx fork/scripts/ops/e2e-read.ts "$@"
    ;;
  watchdog)
    [ -f fork/scripts/ops/watchdog.mjs ] || {
      echo "watchdog not built yet (WO-B13-013)"
      exit 1
    }
    node fork/scripts/ops/watchdog.mjs "$@"
    ;;
  selftest)
    [ -f fork/scripts/ops/selftest.sh ] || {
      echo "selftest not built yet (WO-B13-016)"
      exit 1
    }
    export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64
    if [ "${1:-}" = "--evaluate" ]; then
      bash fork/scripts/ops/selftest.sh "$@"
    else
      detach selftest bash fork/scripts/ops/selftest.sh "$@"
    fi
    ;;
  backfill-grades)
    [ -f fork/scripts/ops/backfill-grades.ts ] || {
      echo "backfill-grades not built yet (WO-B13-008)"
      exit 1
    }
    run_tsx --import ./fork/scripts/ops/cf-env-shim.mjs fork/scripts/ops/backfill-grades.ts "$@"
    ;;
  *) usage ;;
esac 2>&1 | redact
exit "${PIPESTATUS[0]}"
