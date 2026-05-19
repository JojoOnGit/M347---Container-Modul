# KN02: Dockerfile

## A) Dockerfile I

### Dokumentiertes Dockerfile (Original)

```dockerfile
FROM nginx
# Gibt das Basis-Image an, auf dem der neue Layer aufgebaut wird.
# In diesem Fall wird das offizielle nginx-Image von Docker Hub verwendet.

COPY static-html-directory /var/www/html
# Kopiert den Inhalt des lokalen Ordners "static-html-directory" in den Pfad
# /var/www/html im Container. Dort erwartet nginx standardmässig die HTML-Dateien.

EXPOSE 80
# Dokumentiert, dass der Container auf Port 80 lauscht (HTTP).
# Öffnet den Port aber nicht automatisch – das geschieht erst beim docker run mit -p.
```

---

### Angepasstes Dockerfile (für helloworld.html)

```dockerfile
FROM nginx
# Verwendet das offizielle nginx-Image als Basis.

WORKDIR /usr/share/nginx/html
# Setzt das Arbeitsverzeichnis im Container.
# nginx legt seine Standard-HTML-Seiten unter /usr/share/nginx/html ab (laut Docker Hub).
# Alle nachfolgenden COPY-Anweisungen ohne absoluten Pfad beziehen sich auf dieses Verzeichnis.

COPY helloworld.html .
# Kopiert die lokale Datei helloworld.html in das aktuelle Arbeitsverzeichnis
# im Container (/usr/share/nginx/html).

EXPOSE 80
# Exponiert Port 80, damit nginx von aussen erreichbar ist.
```


---

### Docker-Befehle

#### Image bauen

```bash
docker build -t <dockerhub-benutzername>/kn02:kn02a .
```

Ersetzen Sie `<dockerhub-benutzername>` durch Ihren eigenen Docker Hub Benutzernamen.

#### Container starten

```bash
docker run -d -p 8080:80 --name kn02a <dockerhub-benutzername>/kn02:kn02a
```

Die Seite ist danach erreichbar unter: `http://localhost:8080/helloworld.html`

#### Image in privates Repository pushen

```bash
docker push <dockerhub-benutzername>/kn02:kn02a
```

---

### Screenshot: Docker Desktop – Image kn02a


![Docker Desktop Image kn02a](screenshots/kn02a_docker_desktop.png)

---

### Screenshot: Browser – helloworld.html


![helloworld.html im Browser](screenshots/kn02a_helloworld.png)

---

## B) Dockerfile II

### DB-Container (mariadb)

#### Dockerfile – DB

```dockerfile
FROM mariadb
# Verwendet das offizielle MariaDB-Image als Basis.

ENV MYSQL_ROOT_PASSWORD=rootpassword
# Setzt das Root-Passwort für MariaDB direkt im Image (statt als -e Parameter beim docker run).

ENV MYSQL_DATABASE=mydb
# Erstellt beim Start automatisch eine Datenbank mit diesem Namen.

ENV MYSQL_USER=dbuser
# Erstellt einen zusätzlichen Datenbankbenutzer.

ENV MYSQL_PASSWORD=dbpassword
# Setzt das Passwort für den zusätzlichen Benutzer.

EXPOSE 3306
# Exponiert den Standard-MariaDB-Port 3306.
```

#### docker build – DB

```bash
docker build -t <dockerhub-benutzername>/kn02:kn02b-db .
```

#### docker run – DB

```bash
docker run -d -p 3306:3306 --name kn02b-db <dockerhub-benutzername>/kn02:kn02b-db
```

#### Image pushen – DB

```bash
docker push <dockerhub-benutzername>/kn02:kn02b-db
```

---

### Screenshot: Telnet – DB-Verbindung

![Telnet DB-Verbindung](screenshots/kn02b_telnet_db.png)

---

### Web-Container (PHP + Apache)

#### Angepasste db.php

Vor dem Erstellen des Web-Images müssen Sie die IP-Adresse des DB-Containers herausfinden:

```bash
docker inspect kn02b-db
```

Suchen Sie in der Ausgabe nach `"IPAddress"` und tragen Sie diesen Wert in `db.php` ein:

```php
$host = "172.17.0.x"; // IP-Adresse aus docker inspect kn02b-db
```


#### Dockerfile – Web

```dockerfile
FROM php:8.0-apache
# Verwendet die offizielle PHP 8.0 Variante mit integriertem Apache-Webserver.

WORKDIR /var/www/html
# Setzt das Arbeitsverzeichnis auf den Standard-Dokumenten-Ordner von Apache.

COPY info.php .
# Kopiert info.php in das Webverzeichnis des Containers.

COPY db.php .
# Kopiert die angepasste db.php (mit der korrekten DB-IP) in das Webverzeichnis.

RUN docker-php-ext-install mysqli
# Installiert das PHP-Modul mysqli, damit PHP eine Verbindung zu MariaDB aufbauen kann.

EXPOSE 80
# Exponiert Port 80 für den Apache-Webserver.
```

#### docker build – Web

```bash
docker build -t <dockerhub-benutzername>/kn02:kn02b-web .
```

#### docker run – Web

```bash
docker run -d -p 8080:80 --name kn02b-web <dockerhub-benutzername>/kn02:kn02b-web
```

#### Image pushen – Web

```bash
docker push <dockerhub-benutzername>/kn02:kn02b-web
```

---

### Screenshot: Browser – info.php

![info.php im Browser](screenshots/kn02b_info_php.png)

---

### Screenshot: Browser – db.php

![db.php im Browser](screenshots/kn02b_db_php.png)
