#!/usr/bin/env bash
# Unattended build driver: one fresh Claude Code context per run until fork/STATE.md says done.
# Usage: bash fork/scripts/autopilot.sh
# Watch:  tail -f fork/runs/autopilot.log     Stop: Ctrl+C (STATE.md resumes on next start)
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

MODEL="${MODEL:-claude-opus-5-5}"
PERM_MODE="${PERM_MODE:-auto}"     # auto = classifier-gated (default) · bypassPermissions = isolated VM/container only
MAX_RUNS="${MAX_RUNS:-60}"
STALL_LIMIT="${STALL_LIMIT:-3}"    # consecutive runs without a new commit → stop
LOG=fork/runs/autopilot.log
mkdir -p fork/runs

field() { grep -m1 "^$1:" fork/STATE.md | sed -E "s/^$1:[[:space:]]*//; s/[[:space:]].*//"; }

bash fork/scripts/preflight.sh || echo "AUTOPILOT: preflight has MISS items — dependent steps will be BLOCKED-KEN" | tee -a "$LOG"

stalls=0
for i in $(seq 1 "$MAX_RUNS"); do
  case "$(field status)" in
    done)      echo "AUTOPILOT: build complete. Leftover Ken items: fork/STATE.md (needs_ken)"; exit 0 ;;
    needs-ken) echo "AUTOPILOT: needs Ken — fork/STATE.md (needs_ken)"; exit 2 ;;
  esac

  before=$(git rev-parse HEAD)
  echo "=== run $i · $(date -Is) · $(field current_batch) · $MODEL · $PERM_MODE ===" | tee -a "$LOG"
  claude -p "Read fork/STATE.md and continue the build. Autopilot run $i: headless and unattended. Never ask questions. Work until this run's scope is complete or context is ~70% used, then commit, update fork/STATE.md, and exit." \
    --model "$MODEL" --permission-mode "$PERM_MODE" >>"$LOG" 2>&1
  rc=$?
  after=$(git rev-parse HEAD)

  if [ "$rc" -ne 0 ] && tail -n 40 "$LOG" | grep -qiE "hit your (weekly |session )?limit|usage limit"; then
    echo "AUTOPILOT: usage limit — stopped. Re-run this script after reset." | tee -a "$LOG"; exit 4
  fi

  if [ "$before" = "$after" ]; then stalls=$((stalls+1)); else stalls=0; fi
  if [ "$stalls" -ge "$STALL_LIMIT" ]; then
    echo "AUTOPILOT: $STALL_LIMIT runs without a commit — stopped. Check $LOG and fork/STATE.md." | tee -a "$LOG"; exit 3
  fi
  [ "$rc" -ne 0 ] && sleep 20
done
echo "AUTOPILOT: MAX_RUNS ($MAX_RUNS) reached — re-run to continue." | tee -a "$LOG"; exit 5
