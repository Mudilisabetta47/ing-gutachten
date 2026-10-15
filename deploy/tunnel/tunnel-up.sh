#!/usr/bin/env bash
# Startet den TEMPORÄREN Test-Zugang zu ING Studio Staging (Cloudflare Quick Tunnel hinter Caddy-Zugangsschutz).
# Aufruf auf dem VPS:  sudo bash /opt/ing-studio/deploy/tunnel/tunnel-up.sh
# Reihenfolge ist Absicht: Der Tunnel wird erst gestartet, wenn (1) der Zugangsschutz alle Prüfungen bestanden hat,
# (2) die Netz-Isolation bestätigt ist und (3) die automatische Abschaltung geplant UND überprüft ist. Jeder Fehler baut alles wieder ab.
set -Eeuo pipefail

CHECK_ONLY=0; [ "${1:-}" = "--check" ] && CHECK_ONLY=1   # Prüfmodus: nur Tor + Prüfungen A/B, KEIN Tunnel, KEIN Timer, KEINE öffentliche Adresse
TUN=${TUN:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}
TTL_SECONDS=${TTL_SECONDS:-14400}          # 4 Stunden
WATCHDOG_EXTRA=${WATCHDOG_EXTRA:-120}      # zweite, unabhängige Abschaltung etwas später
URL_TRIES=${URL_TRIES:-45}; URL_SLEEP=${URL_SLEEP:-2}; PUBLIC_SLEEP=${PUBLIC_SLEEP:-8}; GATE_TRIES=${GATE_TRIES:-30}; GATE_SLEEP=${GATE_SLEEP:-1}
PROJECT=ing-tunnel
WEB_NAME=ing-staging-web-1
ING_NET=ing-staging_private
EDGE_NET=ing-tunnel_edge
CADDY_IMAGE=caddy:2.10.2-alpine
CF_IMAGE=cloudflare/cloudflared:2026.10.1
PROBE_IMAGE=ing-studio-staging:local        # vorhandenes Image mit Node 22, kein neuer Download
GATE_USER_NAME=ing-test
COMPOSE=(docker compose -p "$PROJECT" -f "$TUN/compose.tunnel.yaml" --project-directory "$TUN")

step() { printf '\n== %s\n' "$*"; }
fail() { printf '\nFEHLER: %s\n' "$*" >&2; exit 1; }
STARTED=0
cleanup() {  # läuft bei JEDEM Beenden (auch nach fail): Wurde etwas gestartet und nicht erfolgreich abgeschlossen, wird alles abgebaut
  if [ "$STARTED" = 1 ]; then
    printf '\n!! Baue den Test-Zugang wieder ab.\n' >&2
    bash "$TUN/tunnel-down.sh" --abort || true
  fi
}
trap cleanup EXIT
trap 'code=$?; printf "\nFehler in Zeile %s (Exit %s).\n" "${BASH_LINENO[0]}" "$code" >&2; exit "$code"' ERR

step "0. Voraussetzungen (nur Prüfungen)"
docker info >/dev/null 2>&1 || fail "Kein Docker-Zugriff für $(whoami)."
if [ "$CHECK_ONLY" = 0 ]; then command -v systemd-run >/dev/null && command -v systemctl >/dev/null || fail "systemd-run fehlt: Ohne geplante automatische Abschaltung wird kein Tunnel gestartet."; fi
[ "$(id -u)" = 0 ] || fail "Bitte mit sudo ausführen (nötig für die geplante Abschaltung)."
for f in compose.tunnel.yaml Caddyfile probe.mjs tunnel-down.sh; do [ -f "$TUN/$f" ] || fail "Datei fehlt: $TUN/$f"; done
[ -n "$(docker ps -q -f "name=^${WEB_NAME}$")" ] || fail "$WEB_NAME läuft nicht – erst das Update (update-web.sh) abschließen."
[ "$(docker inspect "$WEB_NAME" --format '{{index .Config.Labels "com.docker.compose.project"}}')" = "ing-staging" ] || fail "$WEB_NAME gehört nicht zum Projekt ing-staging."
docker network inspect "$ING_NET" >/dev/null 2>&1 || fail "Netz $ING_NET nicht gefunden."
[ -z "$(docker ps -aq -f "label=com.docker.compose.project=$PROJECT")" ] || fail "Es gibt bereits Container des Projekts $PROJECT. Erst: sudo bash $TUN/tunnel-down.sh"
ADMIN=${SUDO_USER:-$(logname 2>/dev/null || echo root)}
GATE_UID=$(id -u "$ADMIN"); GATE_GID=$(id -g "$ADMIN"); export GATE_UID GATE_GID
"${COMPOSE[@]}" config -q || fail "compose.tunnel.yaml ist ungültig."
echo "Verwalter für Geheimnisse: $ADMIN (uid $GATE_UID) | Laufzeit: $((TTL_SECONDS/3600)) h ($TTL_SECONDS s)"
docker image inspect "$PROBE_IMAGE" >/dev/null 2>&1 || fail "Image $PROBE_IMAGE fehlt."
docker image inspect "$CADDY_IMAGE" >/dev/null 2>&1 || docker pull "$CADDY_IMAGE"
if [ "$CHECK_ONLY" = 0 ]; then docker pull "$CF_IMAGE" >/dev/null; echo "cloudflared-Image: $(docker image inspect "$CF_IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null | cut -c1-90)"; else echo "PRÜFMODUS: es wird kein Tunnel gestartet und keine öffentliche Adresse erzeugt."; fi

step "1. Ausgangszustand festhalten (zum späteren Vergleich: nichts anderes darf sich ändern)"
snapshot_containers() { docker ps -q --no-trunc | while read -r id; do docker inspect -f '{{.Name}} {{.Id}} {{.State.StartedAt}}' "$id"; done | sort; }
snapshot_ports() { ss -ltnH 2>/dev/null | awk '{print $4}' | sort -u; }
BASE_CONT=$(snapshot_containers); BASE_PORTS=$(snapshot_ports)
echo "Laufende Container: $(printf '%s\n' "$BASE_CONT" | grep -c .) | lauschende Adressen: $(printf '%s\n' "$BASE_PORTS" | grep -c .)"

STARTED=1   # ab hier räumt cleanup() bei jedem Fehler auf (inkl. Zugangsdaten)
step "2. Zugangsdaten erzeugen (Passwort wird nur in einer Datei auf dem VPS abgelegt, nie ausgegeben)"
SECDIR="$TUN/secrets"; mkdir -p "$SECDIR"; chown "$ADMIN" "$SECDIR"; chmod 700 "$SECDIR"
PW=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-28)
[ "${#PW}" -ge 24 ] || fail "Passwort konnte nicht erzeugt werden."
HASH=$(PW="$PW" docker run --rm -e PW "$CADDY_IMAGE" sh -c 'caddy hash-password --plaintext "$PW"')
case "$HASH" in '$2'*) ;; *) fail "Passwort-Hash unerwartet." ;; esac
EXPIRES=$(date -d "+${TTL_SECONDS} seconds" '+%F %H:%M' 2>/dev/null || date -v+"${TTL_SECONDS}"S '+%F %H:%M')
( umask 077
  printf 'basic_auth {\n\t%s %s\n}\n' "$GATE_USER_NAME" "$HASH" > "$SECDIR/gate-auth.caddy"
  printf 'Benutzer:  %s\nPasswort:  %s\nGültig bis: %s (automatische Abschaltung)\n' "$GATE_USER_NAME" "$PW" "$EXPIRES" > "$SECDIR/gate-password.txt" )
chown "$ADMIN" "$SECDIR/gate-password.txt" "$SECDIR/gate-auth.caddy"; chmod 600 "$SECDIR/gate-password.txt"; chmod 644 "$SECDIR/gate-auth.caddy"   # Hash (nicht das Passwort); Ordner ist 700
echo "Passwort liegt in: $SECDIR/gate-password.txt (Rechte 600, Besitzer $ADMIN)"
docker run --rm --network none --user "$GATE_UID:$GATE_GID" -v "$TUN/Caddyfile:/etc/caddy/Caddyfile:ro" -v "$SECDIR/gate-auth.caddy:/etc/gate/auth.caddy:ro" \
  -e XDG_CONFIG_HOME=/tmp -e XDG_DATA_HOME=/tmp "$CADDY_IMAGE" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || fail "Caddy-Konfiguration ist ungültig."
echo "Caddy-Konfiguration: gültig"

probe() { # $1 Modus, $2 Ziel
  GATE_PW="$PW" docker run --rm --network "$EDGE_NET" --entrypoint node --memory 128m --cpus 0.5 --cap-drop ALL --security-opt no-new-privileges:true --read-only \
    -v "$TUN/probe.mjs:/probe.mjs:ro" -e MODE="$1" -e TARGET="${2:-}" -e GATE_USER="$GATE_USER_NAME" -e GATE_PW "$PROBE_IMAGE" /probe.mjs
}

if [ "$CHECK_ONLY" = 1 ]; then
  step "2b. Diagnose (nur Prüfmodus): Startet das Caddy-Image mit den Einstellungen des Tors?"
  if docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges:true "$CADDY_IMAGE" caddy version >/dev/null 2>&1; then echo "cap_drop ALL ohne Zusatz:        startet"; else echo "cap_drop ALL ohne Zusatz:        STARTET NICHT (Datei-Fähigkeit des Caddy-Images) – daher cap_add NET_BIND_SERVICE"; fi
  if docker run --rm --network none --cap-drop ALL --cap-add NET_BIND_SERVICE --security-opt no-new-privileges:true "$CADDY_IMAGE" caddy version >/dev/null 2>&1; then echo "cap_drop ALL + NET_BIND_SERVICE: startet (Einstellung des Tors)"; else fail "Caddy startet auch mit NET_BIND_SERVICE nicht – siehe Diagnose unten."; fi
fi

gate_diag() {  # Zustand und Protokoll des Tors (enthält keine Geheimnisse) – wird VOR dem Abbau ausgegeben
  echo "--- Zustand ing-gate: $(docker inspect ing-gate --format 'Status={{.State.Status}} Exit={{.State.ExitCode}} OOM={{.State.OOMKilled}} Fehler={{.State.Error}}' 2>&1 | cut -c1-200)" >&2
  echo "--- Letzte Protokollzeilen:" >&2; docker logs --tail 25 ing-gate 2>&1 | sed 's/^/    /' >&2 || true
}

step "3. Nur das Tor (gate) starten – noch KEIN Tunnel, noch nichts von außen erreichbar"
"${COMPOSE[@]}" up -d gate
READY=0
for i in $(seq 1 "$GATE_TRIES"); do
  STATE=$(docker inspect ing-gate --format '{{.State.Status}}' 2>/dev/null || echo fehlt)
  if [ "$STATE" != running ] && [ "$STATE" != created ] && [ "$STATE" != restarting ]; then gate_diag; fail "Das Tor ist nicht gestartet bzw. sofort wieder beendet (Zustand: $STATE)."; fi
  if docker exec ing-gate wget -qO- http://127.0.0.1:8080/robots.txt 2>/dev/null | grep -q Disallow; then READY=1; break; fi
  sleep "$GATE_SLEEP"
done
[ "$READY" = 1 ] || { gate_diag; fail "Das Tor läuft, antwortet aber nicht auf Port 8080 (nach $GATE_TRIES Versuchen)."; }
echo "Das Tor antwortet (nach $i Versuch(en))."
echo "-- Prüfung A: Zugangssperre vor allen Routen"; probe gate http://gate:8080
echo "-- Prüfung B: Tunnel-Netz erreicht weder ING-Web noch PostgreSQL noch SeaweedFS"; probe isolate

if [ "$CHECK_ONLY" = 1 ]; then
  step "PRÜFMODUS BESTANDEN – es wurde kein Tunnel gestartet und keine Adresse erzeugt. Das Tor wird jetzt wieder abgebaut."
  exit 0   # cleanup() baut Tor, Netz und Zugangsdaten ab
fi

step "4. Automatische Abschaltung planen und überprüfen (VOR dem Tunnelstart)"
systemd-run --unit=ing-tunnel-expire --on-active="${TTL_SECONDS}s" --description="ING Test-Tunnel: automatische Abschaltung" /bin/bash "$TUN/tunnel-down.sh" --expired >/dev/null
systemctl is-active --quiet ing-tunnel-expire.timer || fail "Die geplante Abschaltung (systemd-Timer) ist nicht aktiv."
echo "Timer aktiv: $(systemctl list-timers ing-tunnel-expire.timer --no-legend 2>/dev/null | awk '{print $1, $2}' | head -1)"
( setsid nohup bash -c "sleep $((TTL_SECONDS + WATCHDOG_EXTRA)); bash '$TUN/tunnel-down.sh' --expired --from-watchdog" >/dev/null 2>&1 & echo $! > "$SECDIR/watchdog.pid" )
echo "Zweite, unabhängige Abschaltung (Wächter-Prozess) gestartet: PID $(cat "$SECDIR/watchdog.pid")"

step "5. Tunnel starten (cloudflared, nur im Netz $EDGE_NET)"
"${COMPOSE[@]}" up -d cloudflared
URL=""
for i in $(seq 1 "$URL_TRIES"); do
  URL=$(docker logs ing-cloudflared 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | grep -v '^https://api\.' | tail -1 || true)
  [ -n "$URL" ] && docker logs ing-cloudflared 2>&1 | grep -qi 'registered tunnel connection' && break
  sleep "$URL_SLEEP"; [ "$i" = "$URL_TRIES" ] && fail "Keine Tunnel-Adresse erhalten."
done
echo "Tunnel steht (Adresse wird am Ende angezeigt)."

step "6. Prüfung C: öffentliche Adresse (mit Wiederholungen, bis die Namensauflösung steht)"
ok=0; for i in 1 2 3 4 5 6; do if probe public "$URL"; then ok=1; break; fi; echo "Versuch $i nicht bestanden – warte ${PUBLIC_SLEEP} s"; sleep "$PUBLIC_SLEEP"; done
[ "$ok" = 1 ] || fail "Prüfung der öffentlichen Adresse nicht bestanden."

step "7. Nichts anderes darf sich geändert haben"
AFTER_CONT=$(snapshot_containers); AFTER_PORTS=$(snapshot_ports)
CHANGED=$(comm -23 <(printf '%s\n' "$BASE_CONT") <(printf '%s\n' "$AFTER_CONT") | grep -c . || true)
[ "$CHANGED" = 0 ] || fail "Ein vorhandener Container wurde verändert oder neu gestartet ($CHANGED)."
NEWPORTS=$(comm -13 <(printf '%s\n' "$BASE_PORTS") <(printf '%s\n' "$AFTER_PORTS") | grep -c . || true)
[ "$NEWPORTS" = 0 ] || fail "Neue lauschende Ports auf dem Host: $NEWPORTS"
PUBPORTS=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Names}} {{.Ports}}' | grep -c -- '->' || true)
[ "$PUBPORTS" = 0 ] || fail "Ein Tunnel-Container veröffentlicht Ports."
echo "Bestehende Container unverändert, keine neuen Host-Ports, keine veröffentlichten Docker-Ports."
STARTED=0; trap - ERR

step "FERTIG – Test-Zugang ist aktiv"
echo "Adresse:       $URL"
echo "Zugang:        Benutzer und Passwort stehen in $SECDIR/gate-password.txt  (anzeigen: cat $SECDIR/gate-password.txt)"
echo "Danach:        zusätzlich der normale ING-Studio-Login (Konto + Zwei-Faktor)"
echo "Läuft bis:     $EXPIRES (automatisch abgeschaltet)"
echo "Sofort aus:    sudo bash $TUN/tunnel-down.sh"
echo "Nur synthetische Testdaten verwenden. Das Passwort nicht in Chats/Tickets einfügen."
