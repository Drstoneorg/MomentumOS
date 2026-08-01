#!/usr/bin/env bash
# Telegram-Worker als launchd-Dienst: läuft ohne offenes Terminal, startet beim
# Login mit und wird nach einem Absturz automatisch neu gestartet.
#
#   npm run worker:daemon          installieren / neu laden
#   npm run worker:daemon:stop     entfernen
#   npm run worker:daemon:status   Zustand + letzte Logzeilen
#
# Voraussetzung, damit er wirklich arbeitet: TELEGRAM_API_ID/HASH/SESSION und
# SUPABASE_SERVICE_ROLE_KEY in .env.local (einmalig `npm run telegram:login`).
# Fehlt das, beendet sich der Worker sauber und der Dienst schläft.
set -euo pipefail

LABEL="com.momentumos.telegram-worker"
PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/momentumos-worker.log"
NODE_BIN="$(command -v node || true)"
TSX="$PROJEKT/node_modules/tsx/dist/cli.mjs"

case "${1:-install}" in
  install)
    [ -n "$NODE_BIN" ] || { echo "node nicht gefunden — Node.js installieren"; exit 1; }
    [ -f "$TSX" ] || { echo "tsx fehlt — erst npm install im Projektordner"; exit 1; }
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE_BIN</string>
    <string>$TSX</string>
    <string>$PROJEKT/worker/telegram.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJEKT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
EOF
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "✓ Dienst installiert und gestartet. Log: $LOG"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ Dienst entfernt."
    ;;
  status)
    if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
      launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|pid|last exit" || true
    else
      echo "Nicht geladen."
    fi
    echo "— letzte Logzeilen ($LOG):"
    tail -n 5 "$LOG" 2>/dev/null || echo "(noch kein Log)"
    ;;
  *)
    echo "Verwendung: worker-launchd.sh install | uninstall | status"
    exit 1
    ;;
esac
