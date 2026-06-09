# KN05: Arbeit mit Speicher

Getestet werden die drei Speicherarten von Docker: **Bind Mount**, **Named Volume** und **tmpfs**.

## A) Bind Mounts

Ein Bind Mount verbindet ein Verzeichnis vom Host direkt in den Container. Damit lässt sich der typische Entwicklungs-Fall simulieren: Code wird auf dem Host bearbeitet und sofort im Container getestet, ohne das Image neu zu bauen.

Auf dem Host liegt das Skript `a/ausgabe.sh`, das eine einfache, eindeutige Ausgabe macht (eigener Geheim-Code `ZITRONE-347-A1`, also keine Kopie):

```bash
#!/bin/bash

echo "=================================================="
echo "  M347 KN05 - Bind Mount Demo von jojoondocker"
echo "=================================================="
echo "Hostname im Container : $(hostname)"
echo "Datum & Uhrzeit       : $(date)"
echo "Mein Geheim-Code      : ZITRONE-347-A1"
echo "Lieblingszahl         : 42"
echo "--------------------------------------------------"
echo "Version 1 des Skripts - Code wird vom Host gemountet."
echo "=================================================="
```

Der nginx-Container wird mit dem Host-Ordner als Bind Mount gestartet. Das Skript wird per `docker exec` ausgeführt, danach auf dem Host geändert und **ohne Neustart** erneut ausgeführt – die Änderung ist sofort sichtbar.

**Befehle**

```bash
# In den Ordner mit dem Skript wechseln
cd ~/Desktop/M347---Container-Modul-main/KN05/a

# nginx-Container starten, aktuellen Ordner als Bind Mount unter /host einbinden
docker run -d --name kn05a-nginx -v "$(pwd)":/host nginx

# Skript im Container ausführen (Version 1)
docker exec kn05a-nginx bash /host/ausgabe.sh

# Jetzt ausgabe.sh auf dem Host bearbeiten, z. B. die letzte echo-Zeile auf
#   "Version 2 des Skripts - geaendert auf dem Host, sofort im Container sichtbar."
# (Editor auf dem Host, NICHT im Container)

# Skript erneut ausführen - die Änderung erscheint, ohne den Container neu zu bauen
docker exec kn05a-nginx bash /host/ausgabe.sh
```

> Hinweis: `$(pwd)` liefert den absoluten Pfad des aktuellen Ordners – nötig, weil Bind Mounts einen absoluten Host-Pfad brauchen.

**Screencast:** `kn05a_screencast.mov` – zeigt: Skript Version 1 im Container, Änderung auf dem Host, Version 2 im Container (ohne Container-Neustart).

## B) Volumes

Ein Named Volume wird von Docker verwaltet und kann von **mehreren Containern gleichzeitig** verwendet werden. Beide Container schreiben in dieselbe Datei und lesen die Inhalte der jeweils anderen Seite.

**Befehle**

```bash
# Named Volume erstellen
docker volume create kn05b-vol

# Zwei nginx-Container mit demselben Volume unter /data starten
docker run -d --name kn05b-c1 -v kn05b-vol:/data nginx
docker run -d --name kn05b-c2 -v kn05b-vol:/data nginx

# Konsole von Container 1 öffnen und hineinschreiben
docker exec -it kn05b-c1 bash
echo "Nachricht von Container 1" >> /data/shared.txt
cat /data/shared.txt
exit

# Konsole von Container 2 öffnen: Inhalt von C1 lesen und selbst schreiben
docker exec -it kn05b-c2 bash
cat /data/shared.txt
echo "Nachricht von Container 2" >> /data/shared.txt
cat /data/shared.txt
exit

# Zurück in Container 1: beide Zeilen sind sichtbar
docker exec kn05b-c1 cat /data/shared.txt
```

`cat /data/shared.txt` zeigt am Ende auf **beiden** Seiten beide Zeilen – das Volume wird geteilt.

**Screencast:** `kn05b_screencast.mov` (zeigt das geteilte Volume: beide Container schreiben und lesen dieselbe Datei).

## C) Speicher mit docker compose

Ein Stack mit zwei nginx-Containern. Ein Named Volume wird als Top-Level-Element definiert und beiden Containern zugewiesen – Container 1 über die **Long Syntax**, Container 2 über die **Short Syntax**. Container 1 erhält zusätzlich einen **Bind Mount** und einen **tmpfs**-Mount.

**docker-compose.yml** (`c/docker-compose.yml`)

```yaml
services:
  web1:
    image: nginx
    container_name: kn05c-web1
    volumes:
      - type: volume
        source: kn05c-data
        target: /data
      - type: bind
        source: ./bind
        target: /host
      - type: tmpfs
        target: /cache

  web2:
    image: nginx
    container_name: kn05c-web2
    volumes:
      - kn05c-data:/data

volumes:
  kn05c-data:
```

- `web1`: Named Volume in Long Syntax (`type: volume`), Bind Mount (`type: bind`, Host-Ordner `c/bind`) und tmpfs (`type: tmpfs`).
- `web2`: dasselbe Named Volume in Short Syntax (`kn05c-data:/data`).
- Top-Level `volumes:` definiert das Named Volume `kn05c-data`.

**Befehle**

```bash
cd ~/Desktop/M347---Container-Modul-main/KN05/c
docker compose up -d

# mount-Ausgabe im ersten Container: zeigt alle drei Speichertypen
docker exec kn05c-web1 mount | grep -E "on /(data|host|cache) "

# mount-Ausgabe im zweiten Container: zeigt nur das Named Volume
docker exec kn05c-web2 mount | grep -E "on /data "
```

> Falls `mount` im Image fehlt, liefert `cat /proc/mounts` dieselbe Information.

**Auszug `mount` im ersten Container (web1)** – alle drei Speichertypen:

```
tmpfs on /cache type tmpfs (rw,nosuid,nodev,noexec,relatime)
/dev/vda1 on /data type ext4 (rw,relatime,discard)
/run/host_mark/Users on /host type fakeowner (rw,nosuid,nodev,relatime,fakeowner)
```

- `tmpfs on /cache type tmpfs` → der **tmpfs**-Mount (liegt nur im RAM).
- `... on /data type ext4` → das **Named Volume** (von Docker verwaltet).
- `... on /host type fakeowner` → der **Bind Mount** (Host-Ordner; der Typ heisst bei Docker Desktop `fakeowner`).

**Auszug `mount` im zweiten Container (web2)** – nur das Named Volume:

```
/dev/vda1 on /data type ext4 (rw,relatime,discard)
```

**Abgaben**

- Auszug `mount` erster Container (siehe oben).
- Auszug `mount` zweiter Container (siehe oben).
- docker compose Datei: `c/docker-compose.yml`.
- Zusätzlicher Beleg-Screencast: `kn05c_screencast.mov` (zeigt `compose up` und beide `mount`-Ausgaben live).

## Aufräumen

```bash
docker rm -f kn05a-nginx kn05b-c1 kn05b-c2
docker volume rm kn05b-vol
cd ~/Desktop/M347---Container-Modul-main/KN05/c && docker compose down -v
```
