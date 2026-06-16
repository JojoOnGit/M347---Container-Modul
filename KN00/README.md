# M347 – Zusammenfassung (KN01–KN06)

Kompakte Übersicht aller bisherigen Aufträge: wichtigste Befehle, Konzepte und Stolpersteine.

---

## Grundbefehle (überall gebraucht)

```bash
docker version                      # Version Client + Server
docker ps                           # laufende Container
docker ps -a                        # alle Container (auch gestoppte)
docker images                       # lokale Images
docker run -d <image>               # Container im Hintergrund starten (detached)
docker run -it <image> sh|bash      # interaktiv mit Shell starten
docker run -p 8080:80 <image>       # Port Host:Container mappen
docker run --name <name> <image>    # fester Containername
docker exec -it <name> bash         # in laufenden Container einsteigen
docker stop/start/rm <name>         # stoppen / starten / löschen
docker rm -f <name>                 # erzwingen löschen (auch laufend)
docker inspect <name>               # Details (IP, Mounts, …) als JSON
docker logs <name>                  # Logs ansehen
```

**Wichtige Flags:**
- `-d` = **detached** (Hintergrund, Terminal bleibt frei)
- `-i` = **interactive** (stdin offen), `-t` = **tty** (Pseudo-Terminal) → zusammen `-it` für Shell
- `-p HOST:CONTAINER` = **Port-Mapping** (ohne `-p` ist der Container von aussen nicht erreichbar)

---

## KN01 – Erste Schritte & Docker Hub

```bash
docker pull <image>                          # Image von Docker Hub laden
docker tag <image> <repo>:<tag>              # lokal umbenennen/taggen
docker push <repo>:<tag>                      # ins eigene Repo pushen
# Beispiel:
docker pull nginx
docker tag nginx:latest jojoondocker/m347:nginx
docker push jojoondocker/m347:nginx
```

- `docker run -d nginx` läuft, ist aber **nicht erreichbar** ohne `-p`.
- `docker run -it ...` → Shell im Container; `exit` stoppt den Container.

---

## KN02 – Dockerfile (eigenes Image bauen)

```dockerfile
FROM nginx                       # Basis-Image
WORKDIR /usr/share/nginx/html    # Arbeitsverzeichnis (nginx serviert von hier)
COPY helloworld.html .           # Datei ins Image kopieren
EXPOSE 80                        # Port dokumentieren (öffnet ihn NICHT, das macht -p)
```

```bash
docker build -t <repo>:<tag> .   # Image aus Dockerfile bauen ( . = Build-Kontext)
docker run -d -p 8080:80 --name <name> <repo>:<tag>
```

**DB-Image (mariadb) per ENV konfigurieren:**
```dockerfile
FROM mariadb
ENV MYSQL_ROOT_PASSWORD=rootpassword
ENV MYSQL_DATABASE=mydb
ENV MYSQL_USER=dbuser
ENV MYSQL_PASSWORD=dbpassword
EXPOSE 3306
```
- `RUN docker-php-ext-install mysqli` → mysqli-Extension, sonst kann PHP nicht auf MariaDB zugreifen.
- **Stolperstein:** DB-IP fix in `db.php` einzutragen ist schlecht, weil sich die IP bei jedem Neustart ändern kann → besser Container-Name (siehe KN03).

---

## KN03 – Netzwerke

```bash
docker network create --subnet 172.18.0.0/16 tbz   # user-defined Netzwerk
docker run -dit --name busybox3 --network tbz busybox
docker network ls                                  # Netzwerke auflisten
```

| | default `bridge` | user-defined Netzwerk |
|---|---|---|
| **DNS / Namensauflösung** | ❌ nein (`ping name` → `bad address`) | ✅ ja (`ping containername` klappt) |
| **Isolation** | – | sauber pro Anwendung |
| Ping per **IP** im selben Netz | ✅ | ✅ |
| Ping über Netzgrenzen | ❌ 100% loss (isoliert) | ❌ 100% loss (isoliert) |

**Kernaussage:** User-defined Netzwerke haben **eingebautes DNS** → Container per Name ansprechen statt per fixer IP. Darum in `db.php` `$host = "kn02b-db"` (Containername) statt IP.

```bash
docker exec <web> getent hosts <db-name>   # Namensauflösung testen
```

---

## KN04 – Docker Compose

Eine `docker-compose.yml` beschreibt die ganze Umgebung, `docker compose up` startet alles.

```yaml
services:
  web:
    build: ./web              # eigenes Dockerfile bauen …
    # image: mariadb:latest   # … oder fertiges Image nutzen
    container_name: m347-web
    ports:
      - "8080:80"
    networks: [meinnetz]
    depends_on: [db]
  db:
    image: mariadb:latest
    environment:
      MYSQL_ROOT_PASSWORD: root1234
      MYSQL_DATABASE: mydb
    networks: [meinnetz]

networks:
  meinnetz:
    driver: bridge
    ipam:
      config:
        - subnet: 172.10.0.0/16
          ip_range: 172.10.5.0/24
          gateway: 172.10.5.254
```

```bash
docker compose up -d --build    # alles starten (mit Neubau)
docker compose down             # alles stoppen + entfernen
docker compose ps               # Status
```

- **Stolperstein:** Ein **fertiges Image** mit fest einkompiliertem Hostnamen (z. B. `kn02b-db`) findet den DB-Service nicht, wenn der anders heisst → `getaddrinfo failed`. Lösung: Service gleich benennen, Netzwerk-Alias setzen, oder Host per ENV konfigurierbar machen.
- Cloud-Deployment: per `cloud-init.yaml` (`write_files` + `runcmd: docker compose up`) auf AWS EC2.

---

## KN05 – Speicher (Bind Mount, Volume, tmpfs)

**Die drei Speichertypen:**

| Typ | Was | Wofür | `-v` Schreibweise |
|-----|-----|-------|-------------------|
| **Bind Mount** | konkreter **Host-Ordner** im Container | Entwicklung (Code live testen) | `-v /abs/pfad:/ziel` |
| **Named Volume** | von **Docker verwalteter** Speicher | persistente App-Daten (DB) | `-v volname:/ziel` |
| **tmpfs** | nur im **RAM**, weg bei Stop | temporäre/geheime Daten | `--tmpfs /ziel` |

> **Erkennen:** linke Seite beginnt mit `/` oder absolutem Pfad → Bind Mount. Nur ein Name → Named Volume.

**A) Bind Mount** (Host-Änderung sofort im Container sichtbar):
```bash
docker run -d --name c1 -v "$(pwd)":/host nginx   # $(pwd) = absoluter Pfad nötig
docker exec c1 bash /host/script.sh               # ausführen → Host ändern → erneut ausführen
```

**B) Named Volume zwischen 2 Containern teilen:**
```bash
docker volume create meinvol
docker run -d --name c1 -v meinvol:/data nginx
docker run -d --name c2 -v meinvol:/data nginx
# in beiden:  echo "text" >> /data/shared.txt   (schreiben)
#             cat /data/shared.txt              (lesen) → beide sehen alles
```

**C) Alle drei per Compose** (Volume als Top-Level-Element):
```yaml
services:
  web1:
    image: nginx
    volumes:
      - type: volume          # LONG Syntax
        source: kn05c-data
        target: /data
      - type: bind            # Bind Mount
        source: ./bind
        target: /host
      - type: tmpfs           # tmpfs
        target: /cache
  web2:
    image: nginx
    volumes:
      - kn05c-data:/data      # SHORT Syntax (gleiches Volume)
volumes:
  kn05c-data:                 # Top-Level Named Volume
```

```bash
docker exec web1 mount | grep -E "on /(data|host|cache) "   # zeigt alle drei Typen
```
- **Short Syntax:** `- name:/ziel` (kompakt). **Long Syntax:** `type/source/target` (ausführlich).
- `tmpfs on /cache` = RAM, `... on /data type ext4` = Volume, `... on /host type fakeowner` = Bind Mount (Docker Desktop).

---

## KN06 – Kubernetes I (MicroK8s-Cluster)

Vom einzelnen Docker-Host zum **Cluster** aus mehreren Servern. **MicroK8s** ist eine schlanke Kubernetes-Variante; drei Ubuntu-EC2-Instanzen (2 vCPU / 4 GB / 30 GB) wurden per Cloud-Init (`snap install microk8s`) aufgesetzt und zu einem Cluster verbunden.

**Zwei Werkzeuge – nicht verwechseln:**

| Befehl | Wofür |
|--------|-------|
| `microk8s …` | den **Cluster betreiben/administrieren**: `add-node`, `join`, `leave`, `remove-node`, `status`, `start/stop`, `enable <addon>` |
| `microk8s kubectl …` | **im Cluster arbeiten** (Standard-Kubernetes): `get nodes`, Pods/Deployments/Services verwalten |

**Cluster bilden:**
```bash
# auf dem Master einen Einmal-Token erzeugen:
microk8s add-node
# -> microk8s join <MASTER-IP>:25000/<token>/<hash>

# auf dem neuen Node ausführen (ohne Flag = Control-Plane, mit --worker = nur Worker):
microk8s join <MASTER-IP>:25000/<token>/<hash>
microk8s join <MASTER-IP>:25000/<token>/<hash> --worker
```

**Node entfernen (2 Schritte):**
```bash
microk8s leave                         # auf dem zu entfernenden Node
microk8s remove-node <node-name>       # danach auf dem Master
```

**Hochverfügbarkeit (HA) verstehen** – erste Zeilen von `microk8s status`:
```
high-availability: yes
  datastore master nodes: …   # halten die verteilte DB (dqlite) und stimmen mit (Quorum)
  datastore standby nodes: …  # Reserve, rücken bei Ausfall nach
```
- HA schaltet sich **automatisch ab 3 Control-Plane-Nodes** ein → verträgt den Ausfall **eines** Nodes (Mehrheit 2 von 3).
- Ein **Worker** läuft **ohne** Control-Plane/dqlite (nur kubelet). Sinken die Control-Plane-Nodes unter 3, wird `high-availability: no`.
- **Stolperstein:** `microk8s kubectl get nodes` auf einem **Worker** liefert keine Liste, sondern *„use the microk8s kubectl on the master"* – der Worker hat keinen API-Server.

---

## Merksätze fürs Schnell-Nachschauen

- **`-p` fehlt → Container nicht erreichbar.**
- **`-d`** = Hintergrund, **`-it`** = interaktive Shell.
- **`EXPOSE`** dokumentiert nur, **`-p`** öffnet wirklich.
- **default bridge = kein DNS**, user-defined = DNS per Name.
- **Bind Mount = Host-Pfad** (Entwicklung), **Volume = Docker-verwaltet** (Daten), **tmpfs = RAM** (flüchtig).
- **`-v /pfad:...` = Bind**, **`-v name:...` = Volume.**
- **Compose:** `up -d --build` starten, `down` aufräumen, Top-Level `volumes:`/`networks:` definieren.
- **K8s:** `microk8s` = Cluster administrieren, **`microk8s kubectl`** = im Cluster arbeiten.
- **HA braucht ≥ 3 Control-Plane-Nodes**; `--worker` = ohne Control-Plane; Worker kann `get nodes` nicht selbst beantworten.
