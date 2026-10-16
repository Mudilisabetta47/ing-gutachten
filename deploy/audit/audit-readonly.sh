#!/usr/bin/env bash
# Rein lesende Bestandsaufnahme des VPS (Teil 2 von Phase 1: alles, was Root-Rechte braucht).
# Aufruf:  sudo bash /opt/ing-studio/deploy/audit/audit-readonly.sh | tee ~/audit-phase1.txt
#
# Garantien:
#  - verändert nichts: kein Neustart, keine Konfigurationsänderung, keine Firewall-Regel, keine Schreibzugriffe auf Datenbanken
#  - gibt keine Geheimnisse aus: keine Umgebungsvariablen, keine Passwörter, keine Schlüsselinhalte; Ausgabe läuft zusätzlich durch einen Maskierfilter
#  - GoKlinik: nur Namen/Ports/Netze/Rechte (docker ps/inspect), KEINE Abfragen an dessen Datenbank oder Anwendung
#  - schreibt nur auf die Standardausgabe (keine Dateien); die kurzen Netztests unten sind einzelne GET-Anfragen im internen ING-Netz, nur Statuscodes
set -u
[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo ausführen."; exit 1; }
export LC_ALL=C

main() {
H() { printf '\n##### %s\n' "$*"; }
S() { printf '\n--- %s\n' "$*"; }
run() { "$@" 2>&1 | head -${LINES_MAX:-80}; }

H "A. System"
run lsb_release -ds; uname -srm; uptime; free -h; df -hT -x tmpfs -x devtmpfs -x squashfs -x overlay; df -i / | tail -1
S "Docker-Version"; docker version --format 'Client {{.Client.Version}} / Server {{.Server.Version}}' 2>&1
S "Neustart nötig? / Dienste mit veralteten Bibliotheken (needrestart, nur Liste)"
[ -f /var/run/reboot-required ] && echo "Neustart erforderlich" || echo "Neustart nicht erforderlich"
needrestart -b 2>&1 | head -15

H "B. Firewall und Netzwerkregeln"
S "ufw"; ufw status verbose 2>&1 | head -40
S "ufw: Standardrichtlinien / IPv6"; grep -E '^(IPV6|DEFAULT_)' /etc/default/ufw 2>&1
S "nftables (Kopf der Regelliste; docker/ufw/fail2ban)"; nft list tables 2>&1
S "iptables DOCKER-USER (Docker umgeht ufw für veröffentlichte Ports, hier wäre der Schutz)"; iptables -S DOCKER-USER 2>&1 | head -10
S "Ports, die auf allen Schnittstellen lauschen (mit Prozess)"; ss -tulnp 2>&1 | awk 'NR==1 || $5 !~ /^(127\.|\[::1\]|172\.|::1)/' | cut -c1-170 | head -30

H "C. SSH, Benutzer, sudo, fail2ban"
S "sshd – wirksame Einstellungen"; sshd -T 2>&1 | grep -E '^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|allowusers|allowgroups|maxauthtries|logingracetime|x11forwarding|allowtcpforwarding|allowagentforwarding|clientaliveinterval|clientalivecountmax|permitemptypasswords|authenticationmethods|ciphers|kexalgorithms) ' | cut -c1-160
S "Benutzer mit Login-Shell"; awk -F: '$7 !~ /(nologin|false)/ {print $1, "uid="$3, $7}' /etc/passwd
S "Gruppen sudo/docker (docker-Gruppe = Root-Äquivalent)"; getent group sudo docker
S "sudoers (nur Regeln, keine Kommentare)"; cat /etc/sudoers /etc/sudoers.d/* 2>/dev/null | grep -vE '^\s*(#|$)' | head -20
S "Passwörter gesetzt/gesperrt (nur Status)"; for u in root ingadmin goklinik; do passwd -S "$u" 2>&1 | awk '{print $1, $2}'; done
S "fail2ban"; fail2ban-client status 2>&1 | head -5; fail2ban-client status sshd 2>&1 | grep -E 'Currently|Total'
S "fail2ban: Wirksamkeit (bantime/findtime/maxretry)"; fail2ban-client get sshd bantime 2>&1; fail2ban-client get sshd findtime 2>&1; fail2ban-client get sshd maxretry 2>&1
S "Fehlgeschlagene SSH-Anmeldungen letzte 24 h (Anzahl)"; journalctl -u ssh -u ssh.socket --since -24h 2>/dev/null | grep -cE 'Failed|Invalid user|Connection closed by authenticating'

H "D. Updates"
S "Automatische Updates"; cat /etc/apt/apt.conf.d/20auto-upgrades 2>&1; systemctl is-active unattended-upgrades 2>&1
S "Letzte Läufe (unattended-upgrades)"; tail -n 8 /var/log/unattended-upgrades/unattended-upgrades.log 2>&1 | cut -c1-160
S "Offene Updates"; apt list --upgradable 2>/dev/null | tail -n +2 | head -20
S "Ubuntu Pro/ESM (Status)"; pro status 2>&1 | head -12

H "E. Docker: Container, Images, Netze, Volumes, Ressourcen"
S "Container (alle)"; docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>&1
S "Ressourcennutzung"; docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}' 2>&1
S "Images"; docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}' 2>&1
S "Netze (intern = kein Weg nach außen)"; for n in $(docker network ls -q); do docker network inspect "$n" --format '{{.Name}}  driver={{.Driver}} internal={{.Internal}} subnet={{range .IPAM.Config}}{{.Subnet}} {{end}}| Container: {{range .Containers}}{{.Name}} {{end}}' 2>&1; done
S "Volumes und Größe"; docker system df -v 2>&1 | sed -n '/Local Volumes/,/^$/p' | head -25
S "Speicher gesamt"; docker system df 2>&1
S "Härtung je Container (ohne Umgebungsvariablen)"
for c in $(docker ps -aq); do docker inspect "$c" --format '{{.Name}}: user={{if .Config.User}}{{.Config.User}}{{else}}root{{end}} privileged={{.HostConfig.Privileged}} netmode={{.HostConfig.NetworkMode}} pid={{.HostConfig.PidMode}} readonly_rootfs={{.HostConfig.ReadonlyRootfs}} capadd={{.HostConfig.CapAdd}} capdrop={{.HostConfig.CapDrop}} secopt={{.HostConfig.SecurityOpt}} mem={{.HostConfig.Memory}} restart={{.HostConfig.RestartPolicy.Name}} log={{.HostConfig.LogConfig.Type}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}keiner{{end}}' 2>&1 | cut -c1-330; done
S "Container mit Docker-Socket oder sensiblen Host-Verzeichnissen als Mount (nur Quellpfade)"
for c in $(docker ps -aq); do docker inspect "$c" --format '{{.Name}}: {{range .Mounts}}{{.Source}}({{if .RW}}rw{{else}}ro{{end}}) {{end}}' 2>&1 | cut -c1-260; done | grep -E 'docker.sock|/etc|/root|/home|/var/run| / ' || echo "keine Treffer"
S "Veröffentlichte Ports je Container"; docker ps --format '{{.Names}}: {{.Ports}}' 2>&1 | grep -- '->' || echo "keine"
S "Größe der Container-Logs (größte 6) – ohne Rotation wächst das unbegrenzt"
du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -rh | head -6; cat /etc/docker/daemon.json 2>/dev/null || echo "keine daemon.json (also keine log-opts / kein live-restore / keine userns)"

H "F. PostgreSQL (ING Studio) – nur lesende Abfragen, keine Passwörter"
PG=$(docker ps --format '{{.Names}}' | grep -E '^ing-staging.*postgres' | head -1)
echo "Container: ${PG:-nicht gefunden}"
if [ -n "${PG:-}" ]; then
  export PGCONNECT_TIMEOUT=5
  S "Version, TLS, Lauschadresse, Verbindungen, Passwortverfahren"
  docker exec "$PG" psql -w -U ing_staging -d ing_staging -Atc "select version();" 2>&1 | cut -c1-90
  for p in ssl listen_addresses max_connections password_encryption ssl_min_protocol_version log_connections log_disconnections log_statement shared_buffers; do printf '%s = ' "$p"; docker exec "$PG" psql -w -U ing_staging -d ing_staging -Atc "show $p;" 2>&1 | head -1; done
  S "Rollen (ohne Passwörter)"; docker exec "$PG" psql -w -U ing_staging -d ing_staging -c "select rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolreplication, rolbypassrls, rolconnlimit from pg_roles where rolname !~ '^pg_' order by 1;" 2>&1 | head -15
  S "Datenbanken und Größe"; docker exec "$PG" psql -w -U ing_staging -d ing_staging -c "select datname, pg_size_pretty(pg_database_size(datname)) size, datallowconn from pg_database order by 1;" 2>&1 | head -10
  S "Aktive Verbindungen nach Benutzer/Adresse-Art"; docker exec "$PG" psql -w -U ing_staging -d ing_staging -c "select usename, ssl, count(*) from pg_stat_activity a left join pg_stat_ssl s using(pid) where usename is not null group by 1,2 order by 3 desc;" 2>&1 | head -10
  S "pg_hba.conf (Zugriffsregeln; enthält keine Geheimnisse)"; docker exec "$PG" sh -c 'grep -vE "^\s*(#|$)" /etc/postgresql/tls/pg_hba.conf' 2>&1 | head -20
  S "Anzahl Tabellen / angewendete Migrationen"; docker exec "$PG" psql -w -U ing_staging -d ing_staging -Atc "select count(*) from information_schema.tables where table_schema='public'; select count(*) from _prisma_migrations where finished_at is not null;" 2>&1 | head -3
fi
S "Weitere Postgres-Container (nur Namen; GoKlinik wird NICHT abgefragt)"; docker ps --format '{{.Names}} {{.Image}}' | grep -i postgres

H "G. SeaweedFS (ING Studio) – Angriffsfläche"
ST=$(docker ps --format '{{.Names}}' | grep -E '^ing-staging.*storage' | head -1)
echo "Container: ${ST:-nicht gefunden}"
if [ -n "${ST:-}" ]; then
  S "Startbefehl und Netze (keine Umgebungsvariablen)"; docker inspect "$ST" --format 'cmd={{.Config.Cmd}} networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}} ports={{.NetworkSettings.Ports}}' 2>&1 | cut -c1-300
  S "S3-Zugangsschutz: anonyme Anfragen aus dem internen Netz (nur Statuscodes)"
  NET=$(docker inspect "$ST" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | tr ' ' '\n' | grep storage_backend | head -1)
  IMG=$(docker ps -a --format '{{.Image}}' | grep -E '^ing-studio-staging' | head -1)
  if [ -n "$NET" ] && [ -n "$IMG" ]; then
    docker run --rm --network "$NET" --cap-drop ALL --security-opt no-new-privileges:true --read-only --memory 64m --entrypoint node "$IMG" -e '
      const t=[["storage-backend",8333,"S3 (ohne TLS, Backend)"],["storage-backend",9333,"Master-Verwaltung"],["storage-backend",8888,"Filer-Verwaltung"],["storage-backend",8080,"Volume-Server"],["storage-backend",23646,"Admin-Oberfläche"]];
      (async()=>{for(const [h,p,n] of t){try{const r=await fetch("http://"+h+":"+p+"/",{signal:AbortSignal.timeout(4000)});console.log(n+" "+h+":"+p+" -> HTTP "+r.status+(r.status===200?"  (OHNE Anmeldung erreichbar)":""))}catch(e){console.log(n+" "+h+":"+p+" -> "+((e.cause&&e.cause.code)||e.name))}}})()' 2>&1
  else echo "Testnetz oder Image nicht gefunden – übersprungen"; fi
fi

H "H. Reverse Proxys, Zertifikate, Domains"
S "Proxy-Container (Caddy/nginx/traefik): Namen und Ports"; docker ps --format '{{.Names}} | {{.Image}} | {{.Ports}}' | grep -iE 'caddy|nginx|traefik|haproxy'
S "TLS-Zertifikate der ING-Dienste (Ablauf; nur öffentliche Zertifikate gelesen)"
for f in /opt/ing-studio/deploy/tls/*/*.crt; do [ -f "$f" ] && printf '%s  ' "${f#/opt/ing-studio/deploy/}" && openssl x509 -noout -subject -enddate -in "$f" 2>&1 | tr '\n' ' ' && echo; done
S "Öffentliche Zertifikate von außen (Ablauf)"; for h in goklinik.de; do echo | timeout 8 openssl s_client -connect "$h:443" -servername "$h" 2>/dev/null | openssl x509 -noout -subject -enddate 2>/dev/null | tr '\n' ' '; echo; done
S "Antwort-Header der öffentlichen Seite (HSTS, Server)"; curl -sI -m 8 https://goklinik.de/ 2>&1 | grep -iE '^(HTTP|strict-transport|server|x-frame|content-security|x-content-type|referrer-policy|permissions-policy)' | cut -c1-140

H "I. Monitoring, Logrotation, Alarmierung"
S "Timer / Cron (root und ingadmin)"; systemctl list-timers --all --no-legend 2>&1 | awk '{print $1,$2,$NF}' | head -15; crontab -l -u root 2>&1 | grep -vE '^\s*(#|$)' | head -10; crontab -l -u ingadmin 2>&1 | grep -vE '^\s*(#|$)' | head -10; ls /etc/cron.d
S "Werkzeuge für Monitoring/Backup/Mail vorhanden?"; for t in restic borg rclone mail sendmail msmtp node_exporter netdata monit; do printf '%-14s %s\n' "$t" "$(command -v $t || echo nein)"; done
S "Alarmierungsweg: gibt es einen Dienst, der bei Speicher-/Dienstausfall benachrichtigt?"; systemctl list-units --type=service --state=running --no-legend 2>&1 | awk '{print $1}' | grep -iE 'monit|netdata|zabbix|prometheus|exporter|uptime|alert|health' || echo "keiner erkennbar"

H "J. Backups"
S "ING Studio: Dumps (Rechte, Größe, Alter, Verschlüsselung = Dateikopf)"
for f in /opt/ing-studio/deploy/backups/*; do [ -f "$f" ] && printf '%s %s %s bytes  Kopf=%s\n' "$(stat -c '%a %U' "$f")" "$(basename "$f")" "$(stat -c %s "$f")" "$(head -c5 "$f" | tr -c 'A-Za-z0-9' '.')"; done
echo "(Kopf PGDMP = unverschlüsselter pg_dump im Custom-Format)"
S "Weitere Sicherungsorte auf dem Server (Namen, kein Inhalt)"; ls -ld /var/backups /home/*/backup* /srv/* /root/backup* 2>&1 | head -10
S "Sicherungen außerhalb des Servers: erkennbar?"; (crontab -l -u root; crontab -l -u ingadmin; cat /etc/cron.d/* ) 2>/dev/null | grep -iE 'rsync|rclone|restic|borg|scp|s3|backup|pg_dump' | sed -E 's/(password|secret|key|token)=[^ ]+/\1=***/Ig' | head -10 || true

H "K. Isolation ING Studio ↔ GoKlinik"
S "Compose-Projekte"; docker ps -a --format '{{.Names}}' | while read c; do printf '%s -> %s\n' "$c" "$(docker inspect "$c" --format '{{index .Config.Labels "com.docker.compose.project"}}')"; done
S "Gemeinsame Docker-Netze (Container beider Seiten im selben Netz)"; for n in $(docker network ls --filter driver=bridge -q); do docker network inspect "$n" --format '{{.Name}}: {{range .Containers}}{{.Name}} {{end}}'; done | awk 'NF>2'
S "Host-Dienste von GoKlinik (Benutzer goklinik)"; ps -u goklinik -o pid,rss,etime,comm --sort=-rss 2>&1 | head -12
S "Home-/Projekt-Verzeichnisse: Leserechte für andere Benutzer"; stat -c '%a %U %n' /home/* /opt/ing-studio /opt/ing-studio/deploy/secrets /opt/ing-studio/deploy/backups 2>&1
S "Kann der Benutzer goklinik ING-Container steuern? (docker-Gruppe)"; id goklinik 2>&1
S "Ressourcen-Konkurrenz: Speicher gesamt / frei, Container ohne Limit"; free -m | sed -n 1,2p; for c in $(docker ps -q); do docker inspect "$c" --format '{{.Name}} mem_limit={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}}'; done | awk '$2=="mem_limit=0"{print $1" ohne Speicherlimit"}'

H "L. Laufender Test-Tunnel (falls aktiv)"
docker ps --filter name=ing-gate --filter name=ing-cloudflared --format '{{.Names}} {{.Status}}' 2>&1; systemctl list-timers ing-tunnel-expire.timer --no-legend 2>&1 | head -2

printf '\n##### ENDE – alles rein lesend. Nichts verändert, keine Geheimnisse ausgegeben.\n'
}

main 2>&1 | sed -E 's/((password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization)[A-Za-z_]*[=:] *)[^ ,;]+/\1***/Ig'
