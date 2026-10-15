# Temporärer Test-Zugang zu ING Studio Staging (Cloudflare Quick Tunnel)

Nur für Tests mit **synthetischen Daten**. Der Datenverkehr läuft über Cloudflare (Quick Tunnels: keine Verfügbarkeitszusage, zufällige Adresse, max. 200 gleichzeitige Anfragen, kein SSE).

| Datei | Zweck |
|---|---|
| `compose.tunnel.yaml` | Projekt `ing-tunnel`: `gate` (Caddy) + `cloudflared`; kein `ports:`; cloudflared nur im Netz `ing-tunnel_edge` |
| `Caddyfile` | Basic Auth vor jeder Route (außer `robots.txt`), `X-Robots-Tag: noindex`, Weiterleitung nur an `web:3000` |
| `probe.mjs` | Prüfprogramm (Zugangssperre, Netz-Isolation, öffentliche Adresse) – gibt nie Passwörter aus |
| `tunnel-up.sh` | Startet in sicherer Reihenfolge; baut bei jedem Fehler alles ab |
| `tunnel-down.sh` | Beendet alles, löscht Zugangsdaten; jederzeit und mehrfach ausführbar |

Start: `sudo bash /opt/ing-studio/deploy/tunnel/tunnel-up.sh`
Passwort anzeigen: `cat /opt/ing-studio/deploy/tunnel/secrets/gate-password.txt`
Sofort beenden: `sudo bash /opt/ing-studio/deploy/tunnel/tunnel-down.sh`
Automatische Abschaltung: nach 4 Stunden (systemd-Timer `ing-tunnel-expire` + zweiter Wächter-Prozess).
