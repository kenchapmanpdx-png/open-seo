#!/usr/bin/env bash
# Installs the OpenSEO local-production systemd user units (ADR-011):
# app, 5-minute cron ticker, nightly backup. Needs systemd in WSL
# (/etc/wsl.conf: [boot] systemd=true).
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

state=$(systemctl --user is-system-running 2>/dev/null || true)
case "$state" in
  running | degraded) ;;
  *)
    echo "systemd user manager unavailable ($state): enable systemd in /etc/wsl.conf" >&2
    exit 1
    ;;
esac

REPO="$PWD"
DEST="$HOME/.config/systemd/user"
mkdir -p "$DEST"
for unit in fork/deploy/openseo-*.service fork/deploy/openseo-*.timer; do
  sed "s#@REPO@#$REPO#g" "$unit" >"$DEST/$(basename "$unit")"
done
systemctl --user daemon-reload
systemctl --user enable --now openseo-app.service openseo-tick.timer openseo-backup.timer
# Keep user units running without an open login session.
loginctl enable-linger "$USER" 2>/dev/null || true
systemctl --user --no-pager status openseo-app.service openseo-tick.timer openseo-backup.timer | head -n 30
