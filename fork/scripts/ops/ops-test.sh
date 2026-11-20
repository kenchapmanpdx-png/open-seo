#!/usr/bin/env bash
# Checks for the ops verbs (WO-B13-001). Read-only verbs only; nothing is
# restarted. Run: bash fork/scripts/ops/ops-test.sh
set -uo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 1

fail=0
check() {
  if eval "$2"; then echo "ok   $1"; else
    echo "FAIL $1"
    fail=1
  fi
}
ops() { bash fork/scripts/run-local.sh ops "$@"; }
no_secret() { ! grep -qE 'postgres(ql)?://[^[]|Bearer [^[]|eyJ[A-Za-z0-9_-]{8}' <<<"$1"; }

check "bash -n run-local.sh" "bash -n fork/scripts/run-local.sh"
check "bash -n ops.sh" "bash -n fork/scripts/ops/ops.sh"

out=$(ops status)
code=$?
check "status exits 0" "[ $code -eq 0 ]"
check "status ≥ 10 lines" "[ $(grep -c '=' <<<"$out") -ge 10 ]"
check "status has no secret" "no_secret \"\$out\""

ops nonsense >/dev/null 2>&1
check "unknown verb exits 2" "[ $? -eq 2 ]"
ops restart nonsense >/dev/null 2>&1
check "bad restart target exits 2" "[ $? -eq 2 ]"

for v in "sockets" "logs 2026-11-19T22:40 2026-11-19T23:40" "e2e-read 00000000-0000-0000-0000-000000000000"; do
  # shellcheck disable=SC2086
  out=$(ops $v 2>&1)
  check "no secret: $v" "no_secret \"\$out\""
done

# redact() itself
red=$(printf 'x postgres://u:p@h:5432/db y Bearer abc.def eyJhbGciOiJIUzI1NiJ9.e30.x\n' |
  bash -c "$(sed -n '/^redact() {/,/^}/p' fork/scripts/ops/ops.sh); redact")
check "redact strips url / bearer / jwt" "no_secret \"\$red\""

# testmode.env older than 12 h is ignored by run-local.sh (load_testmode).
tmp=$(mktemp -d)
mkdir -p "$tmp/fork/runs/_ops"
echo "OPENSEO_TEST_MODE=1" >"$tmp/fork/runs/_ops/testmode.env"
fn=$(sed -n '/^load_testmode() {/,/^}/p' fork/scripts/run-local.sh)
fresh=$(cd "$tmp" && bash -c "$fn; load_testmode; echo \${OPENSEO_TEST_MODE:-unset}")
touch -d '13 hours ago' "$tmp/fork/runs/_ops/testmode.env"
stale=$(cd "$tmp" && bash -c "$fn; load_testmode; echo \${OPENSEO_TEST_MODE:-unset}")
check "fresh testmode.env loaded" "[ '$fresh' = 1 ]"
check "stale testmode.env ignored" "[ '$stale' = unset ]"
rm -r "$tmp"

exit $fail
