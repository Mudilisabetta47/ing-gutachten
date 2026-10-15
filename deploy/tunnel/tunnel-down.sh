#!/usr/bin/env bash
# Beendet den TEMPORÄREN Test-Zugang vollständig. Idempotent (darf jederzeit mehrfach laufen).
# Fasst nur das Compose-Projekt "ing-tunnel" an (gate, cloudflared, Netz ing-tunnel_edge) – nie den ING-Stack, nie GoKlinik.
# Aufruf:  sudo bash /opt/ing-studio/deploy/tunnel/tunnel-down.sh
set -uo pipefail
TUN=${TUN:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}
PROJECT=ing-tunnel
REASON="manuell"; FROM_WATCHDOG=0
for a in "$@"; do case "$a" in --expired) REASON="Zeit abgelaufen";; --abort) REASON="Abbruch nach Fehler";; --from-watchdog) FROM_WATCHDOG=1;; esac; done
echo "Test-Zugang wird beendet ($REASON)."
docker compose -p "$PROJECT" -f "$TUN/compose.tunnel.yaml" --project-directory "$TUN" down 2>&1 | sed 's/^/  /'
systemctl stop ing-tunnel-expire.timer ing-tunnel-expire.service >/dev/null 2>&1 || true
if [ "$FROM_WATCHDOG" = 0 ] && [ -f "$TUN/secrets/watchdog.pid" ]; then kill "$(cat "$TUN/secrets/watchdog.pid")" >/dev/null 2>&1 || true; fi
rm -f "$TUN/secrets/watchdog.pid" "$TUN/secrets/gate-password.txt" "$TUN/secrets/gate-auth.caddy"
LEFT=$(docker ps -aq -f "label=com.docker.compose.project=$PROJECT" | grep -c . || true)
if [ "$LEFT" = 0 ]; then echo "Beendet: keine Tunnel-Container mehr, Zugangsdaten gelöscht. Die bisherige Adresse ist ungültig."; else echo "WARNUNG: $LEFT Container des Projekts $PROJECT existieren noch." >&2; exit 1; fi
