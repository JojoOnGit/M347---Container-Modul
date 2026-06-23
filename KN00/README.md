# M347 – Zusammenfassung (KN01–KN08)

Kompakte Übersicht aller Aufträge: wichtigste Befehle, Konzepte und Stolpersteine.

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

## KN07 – Kubernetes II (Demo-Projekt)

WebApp (`nanajanashia/k8s-demo-app`) + MongoDB auf dem Cluster, gesteuert über **vier YAML-Objekte**: ConfigMap, Secret, Deployment+Service (MongoDB), Deployment+Service (WebApp). Reihenfolge beim Anwenden: ConfigMap/Secret → DB → WebApp.

```bash
microk8s kubectl apply -f mongo-config.yaml -f mongo-secret.yaml
microk8s kubectl apply -f mongo.yaml
microk8s kubectl apply -f webapp.yaml
microk8s kubectl get all -o wide                 # Kontrolle
microk8s kubectl describe service webapp-service # Details eines Service
```

**Die wichtigsten Begriffe (eigene Worte):**

| Begriff | Kurz |
|---------|------|
| **Pod** | kleinste Einheit, Hülle um Container, vergänglich |
| **Replica** | Anzahl identischer Pod-Kopien (`replicas`) → Skalierung/Ausfallsicherheit |
| **Deployment** | hält Pods am Leben (erstellt, skaliert, Updates/Rollback) |
| **Service** | stabile Adresse + DNS-Name vor den Pods, Load-Balancing |
| **Ingress** | **ein** HTTP(S)-Eintrittspunkt, Routing nach Host/Pfad, zentrales TLS |
| **StatefulSet** | für stateful Apps: feste Identität + eigener persistenter Speicher pro Pod (z. B. Kafka) |

**Service-Typen (entscheidend für Erreichbarkeit):**
- **ClusterIP** (Default) = **nur clusterintern** (so ist die MongoDB konfiguriert → von aussen nicht erreichbar, z. B. mit Compass).
- **NodePort** = auf **jedem Node** unter `<node-ip>:<nodePort>` von aussen erreichbar (so die WebApp, Port 30100). Firewall/Security-Group-Port muss offen sein.

**Konzepte aus dem Demo (Stolpersteine):**
- **DB als Deployment statt StatefulSet**: im Demo bewusst vereinfacht – ohne PersistentVolume sind die Daten bei Pod-Neustart weg; korrekt wäre StatefulSet + PV.
- **DNS = Service-Name**: in der ConfigMap ist `mongo-url: mongo-service`, weil der DNS-Name eines Service **exakt dessen `metadata.name`** ist (keine feste IP).
- **`replicas` ändern**: Wert in der YAML anpassen + `kubectl apply` → `describe service` zeigt danach **mehrere `Endpoints`** (eine IP pro Pod) statt einer.

---

## KN08 – Kubernetes III (Microservices)

Eine **Microservice-Applikation** (`tbzCoin`-Crypto-App) mit **4 Services** auf dem Cluster. Alles Gelernte kommt zusammen: eigene Komponenten entwickeln, containerisieren, in K8s deployen, updaten.

| Service | Rolle | Service-Typ |
|---------|-------|-------------|
| **frontend** | React-UI, ruft die anderen **vom Browser aus** auf | NodePort → LoadBalancer |
| **account** | **einziger** mit DB-Zugriff (Holdings & Friends) | NodePort |
| **BuySell** | kaufen/verkaufen, ruft account auf | NodePort |
| **SendReceive** | an Freunde senden, ruft account auf | NodePort |

**Architektur-Regeln:** Nur **ein** Service spricht mit der DB (account); die anderen rufen ihn per **HTTP-API** auf. Guthaben/Freund-Prüfung passiert via API-Request, kein Log – nur Totals aktualisieren.

### Kubernetes-Objekte (ConfigMap + Secret + Service + Deployment)

Pro Service ein **Deployment** mit **3 Replicas** + ein **Service**. Konfiguration kommt **von aussen** (nichts hardcodiert):
- **ConfigMap** = nicht-geheime Config (z. B. URLs: `ACCOUNT_BASE_URL`, die `FRONTEND_MS_*`-Endpoints).
- **Secret** = geheime Daten (DB-ConnectionString). Wird als **ENV-Variable** in den Container gegeben.

```bash
# Pull-Secret für eine private Registry (damit der Cluster Images ziehen darf):
kubectl create secret docker-registry ecr-cred -n kn08 \
  --docker-server=<registry> --docker-username=AWS \
  --docker-password="$(aws ecr get-login-password)"

kubectl apply -f k8s/               # alle Manifeste anwenden
kubectl get all -n kn08             # Kontrolle: 4×3 = 12 Pods
```

- **Namespace** trennt Umgebungen (`-n kn08`), ohne das laufende KN07 (`default`) zu stören.
- **ENV aus ConfigMap/Secret** im Deployment:
```yaml
env:
  - name: ACCOUNT_BASE_URL
    valueFrom: { configMapKeyRef: { name: app-config, key: ACCOUNT_BASE_URL } }
  - name: ConnectionString
    valueFrom: { secretKeyRef: { name: account-secret, key: ConnectionString } }
```

### App-Update – Rolling Update **ohne Downtime** (Stärke von K8s)

1. Code ändern (z. B. Frontend-Titel) → 2. neues **Image bauen & pushen** (`:v2`) → 3. Deployment-YAML aufs neue Image setzen → 4. neu anwenden.

```bash
kubectl -n kn08 set image deploy/frontend-deployment frontend=<registry>/kn08-frontend:v2
kubectl -n kn08 rollout status  deploy/frontend-deployment   # Fortschritt
kubectl -n kn08 rollout history deploy/frontend-deployment   # Revisionen
kubectl -n kn08 rollout undo    deploy/frontend-deployment   # Rollback
```

**Strategie `RollingUpdate`** (Default): neue Pods werden **sukzessive** hochgefahren, alte erst beendet, wenn die neuen `Ready` sind (`maxSurge`/`maxUnavailable` je 25 %) → die App ist **nie offline**.

### Multistage-Dockerfile & Laufzeit-Environment (Frontend)

**Multistage** = Bauen und Ausliefern in **getrennten Stages**, im Endimage bleibt nur das Ergebnis (kleines Image, kein manuelles `npm run build`):
```dockerfile
FROM node:20-alpine AS build      # Stage 1: bauen
WORKDIR /app
COPY app/ ./
RUN npm install && npm run build
FROM nginx:alpine                 # Stage 2: ausliefern
COPY --from=build /app/build/ /usr/share/nginx/html
```

- **Stolperstein (React-ENV):** CRA-Variablen werden **beim Build** fest in den JS-Code kompiliert → nachträglich nicht änderbar. **Lösung:** in `.env.production` **Platzhalter** setzen und beim **Container-Start** per Skript (`sed` in `/docker-entrypoint.d/`) durch die echten Werte aus der **ConfigMap** ersetzen → **dasselbe Image, andere Config** je Umgebung.
- Auch in den **eigenen** Services (BuySell/SendReceive) kommt die account-URL aus einer **ENV-Variable** (ConfigMap), nicht hardcodiert.

### LoadBalancer (von NodePort auf LoadBalancer)

Eine einzelne Node-IP aufzurufen ist schlecht (fällt die Instanz aus, ist die App weg) → **externer Load Balancer**. Service-Typ ändern:
```diff
- type: NodePort
+ type: LoadBalancer
```
- **Stolperstein:** Auf einem **selbst verwalteten** Cluster (MicroK8s **ohne** Cloud-Controller-Manager) kann K8s den ELB **nicht selbst** anlegen → `EXTERNAL-IP` bleibt `<pending>`. Dann den LB **direkt in AWS** erstellen (NLB, Listener → NodePorts) – oder **MetalLB** aktivieren. Bei einem **managed Cluster** (EKS) würde `type: LoadBalancer` den LB automatisch provisionieren.

### Weitere Stolpersteine KN08

- **Container-Registry:** Image **amd64** bauen (Cluster-Nodes sind amd64) und in eine **Registry pushen** (Docker Hub / AWS ECR). Private Registry → **imagePullSecret** nötig.
- **API-Vertrag genau prüfen (Swagger):** account erwartet `AddCrypto`/`RemoveCrypto` mit **Query-Parametern** (`?userId=&amount=`), **nicht** im JSON-Body – sonst „passiert nichts", obwohl `true` zurückkommt.
- **CORS:** Da der **Browser** die Services direkt (cross-origin) aufruft, müssen diese `Access-Control-Allow-Origin` setzen – und von aussen erreichbar sein (**NodePort/LoadBalancer**, nicht ClusterIP).
- **Managed DB (RDS):** MariaDB als AWS-RDS-Dienst; erzwingt oft **TLS** (`require_secure_transport=ON`) → Verbindung mit `--ssl`.

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
- **ClusterIP = nur intern, NodePort = von aussen** (`<node-ip>:<nodePort>`, Firewall öffnen).
- **Service-Name = interner DNS-Name**; **`replicas`** = Anzahl Pod-Kopien (mehr Replicas → mehr `Endpoints`).
- **DB gehört in ein StatefulSet + PersistentVolume** (im Demo vereinfacht als Deployment).
- **Config von aussen:** **ConfigMap** = nicht-geheim, **Secret** = geheim → beide als **ENV** in den Pod (nichts hardcodieren).
- **Rolling Update = ohne Downtime:** Image neu bauen/pushen → `set image`/`apply` → `rollout status`; Rückzug mit `rollout undo`.
- **Multistage Dockerfile** = bauen + ausliefern getrennt (kleines Image); **React-ENV** wird beim Build einkompiliert → zur Laufzeit per **Skript + ConfigMap** ersetzen.
- **`type: LoadBalancer`** bleibt auf selbst verwaltetem Cluster `<pending>` → externen AWS-LB (NLB) oder MetalLB nutzen.
- **Nur ein Service spricht mit der DB**; die anderen rufen ihn per HTTP-API auf. **Browser-Aufrufe → CORS + NodePort/LoadBalancer** (nicht ClusterIP).
- **Image immer für die Cluster-Architektur (amd64) bauen** und in eine **Registry** pushen; private Registry → **imagePullSecret**.
