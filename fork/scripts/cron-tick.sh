#!/usr/bin/env bash
# Fires the Worker crons on the local production run (ADR-011 "Schedules"):
# `vite preview` does not run them itself. Called every 5 minutes by
# openseo-tick.timer; at 03:17 local it also fires the daily expression
# (wrangler.jsonc triggers.crons: "*/5 * * * *", "17 3 * * *").
# Path: Miniflare 5's trigger route. `vite preview` hands every request to
# Miniflare with unsafeTriggerHandlers on; the older /cdn-cgi/handler/ path
# is only rewritten by the dev-server middleware.
set -euo pipefail

BASE="${OPENSEO_LOCAL_URL:-http://127.0.0.1:3001}"

fire() {
  curl --silent --show-error --fail --max-time 120 -o /dev/null \
    -w "tick $1 → %{http_code}\n" -X POST \
    "$BASE/cdn-cgi/local/scheduled?cron=$(printf '%s' "$1" | sed 's/ /+/g')"
}

fire "*/5 * * * *"
# The timer fires on 5-minute marks, so 03:15–03:19 catches 03:17 once.
if [ "$(date +%H)" = 03 ] && [ "$(date +%M)" -ge 15 ] && [ "$(date +%M)" -lt 20 ]; then
  fire "17 3 * * *"
fi
