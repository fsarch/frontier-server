# Fachliche Anforderungen – frontier-server

Dieses Dokument beschreibt das fachliche Verhalten von **frontier-server**, einem API-Gateway aus
zwei Komponenten:

- **frontier-api** (Control Plane): verwaltet die Gateway-Konfiguration und verteilt sie an Worker.
- **frontier-worker** (Data Plane): nimmt Endnutzer-Traffic an und leitet ihn anhand der Konfiguration
  an Upstreams weiter.

Jede fachliche Änderung am Verhalten muss hier nachgezogen werden (siehe `CLAUDE.md`).
Anforderungen sind mit stabilen IDs versehen (`API-…`, `WRK-…`, `PROT-…`), damit man sie in Issues,
PRs und Commits referenzieren kann. Neue Anforderungen bekommen die nächste freie Nummer, entfernte
werden gestrichen statt neu nummeriert.

Stand: Version 0.0.21

---

## 1. Domänenmodell

| Begriff | Bedeutung |
|---|---|
| **Domain Group** | Fachliche Klammer um eine Anwendung/Site. Fasst Hostnamen, Pfadregeln, Upstreams und Policies zusammen. |
| **Domain** | Ein Hostname, der einer Domain Group zugeordnet ist. Anfragen an diesen Host werden nach den Regeln dieser Gruppe behandelt. |
| **Path Rule** | Geordnete Regel innerhalb einer Domain Group: Pfadmuster → Upstream Group, optional mit Cache-, CORS-, Log-Policy und Pre-/Post-Hook. |
| **Upstream Group** | Menge gleichwertiger Backends, auf die Anfragen verteilt werden. |
| **Upstream** | Ein einzelnes Backend (Protokoll, Host, Port, Basispfad, TLS-Optionen). |
| **Cache Policy** | Regeln für den `Cache-Control`-Header der Antwort (TTL-Grenzen). |
| **CORS Policy** | Erlaubte Origins und Credentials-Verhalten für Cross-Origin-Anfragen. |
| **Log Policy** | Legt fest, ob Anfragen einer Pfadregel protokolliert werden und wie lange. |
| **Hook** | Verweis auf eine Funktion auf dem externen Function Server, die vor oder nach dem Upstream-Aufruf ausgeführt wird. |
| **Request Log** | Protokolleintrag einer einzelnen Anfrage. |

Cache-, CORS- und Log-Policies sowie Upstream Groups gehören jeweils zu einer Domain Group. Hooks sind
global (nicht an eine Domain Group gebunden).

---

## 2. frontier-api (Control Plane)

### 2.1 Zugriff und Berechtigungen

- **API-001** Alle Verwaltungs-Endpunkte erfordern einen authentifizierten Benutzer (OIDC/JWT) mit der Rolle `manage`.
- **API-002** Benutzer und deren Berechtigungen werden statisch in der Konfiguration (`uac`) gepflegt.
- **API-003** Die Verwaltungs-API ist versioniert (`/v1/...`) und per Swagger unter `/docs` dokumentiert.
- **API-004** Löschen erfolgt als Soft-Delete: gelöschte Objekte verschwinden aus der API und aus der Worker-Konfiguration, bleiben aber in der Datenbank erhalten. (Ausnahme: Request Logs werden hart gelöscht, siehe API-061.)

### 2.2 Domain Groups und Domains

- **API-010** Domain Groups können angelegt, gelistet, einzeln abgerufen, umbenannt und gelöscht werden. Pflichtfeld: `name`.
- **API-011** Einer Domain Group können Hostnamen (`domainName`) zugeordnet und diese gelistet werden.
- **API-012** Hostnamen werden ohne Beachtung von Groß-/Kleinschreibung und ohne Port abgeglichen (siehe WRK-002).

### 2.3 Path Rules

- **API-020** Path Rules können je Domain Group angelegt, gelistet, abgerufen, geändert und gelöscht werden.
- **API-021** Eine Path Rule hat `name`, `path` (Pfadmuster), `order` (Reihenfolge), eine Upstream Group sowie optional Cache Policy, CORS Policy, Log Policy, Pre-Hook und Post-Hook.
- **API-022** Path Rules werden aufsteigend nach `order` ausgeliefert und ausgewertet.
- **API-023** Beim Zuordnen einer CORS- oder Log-Policy wird geprüft, dass diese existiert; andernfalls wird mit `404` abgelehnt.
- **API-024** Optionale Zuordnungen (CORS, Log, Hooks) können durch `null` wieder entfernt werden.

### 2.4 Upstream Groups und Upstreams

- **API-030** Upstream Groups können je Domain Group angelegt, gelistet, abgerufen, umbenannt und gelöscht werden.
- **API-031** Upstreams können je Upstream Group angelegt, gelistet, abgerufen, geändert und gelöscht werden.
- **API-032** Ein Upstream hat `name`, `host`, `port`, `path` (Basispfad) und `protocol` (`http` oder `https`, Standard `http`).
- **API-033** Je Upstream kann die TLS-Zertifikatsprüfung abgeschaltet werden (`sslOptions.sslVerify`, Standard `true`). Gedacht für interne Backends mit selbstsignierten Zertifikaten.

### 2.5 Policies

- **API-040** Cache Policies können je Domain Group verwaltet werden (CRUD). Felder: `name`, `defaultTTL`, `minTTL`, `maxTTL` (Sekunden).
- **API-041** Cache Policies speichern zusätzlich Cache-Tags (`enableCacheTags`, `cacheTagsHeader`), Cache-Varianten nach Cookies/Headern/Query-Parametern sowie Stale-while-error und Stale-while-revalidate. **Diese Felder werden derzeit nur gespeichert und vom Worker noch nicht ausgewertet.**
- **API-042** CORS Policies können je Domain Group verwaltet werden (CRUD). Felder: `name`, `enabled` (Standard `false`), `allowCredentials` (Standard `false`), `allowedOrigins` (Liste, `*` erlaubt alle).
- **API-043** Log Policies können je Domain Group verwaltet werden (CRUD). Felder: `name`, `enabled` (Standard `false`), `retentionTimeSeconds` (Standard 604800 = 7 Tage).

### 2.6 Hooks

- **API-050** Hooks können angelegt, gelistet, abgerufen, geändert und gelöscht werden. Felder: `name`, `functionId` (UUID der Funktion auf dem Function Server).

### 2.7 Request Logs

- **API-060** Worker melden Request Logs über `POST /api/workers/logs`. Der Aufruf muss den Worker-Token im Header `x-worker-token` mitschicken, sonst `401`. Erfolgreiche Annahme: `202`.
- **API-061** Jeder Logeintrag erhält ein Ablaufdatum = Eingangszeit + Aufbewahrungsdauer der Log Policy (Fallback 7 Tage, falls Policy fehlt oder Dauer ≤ 0). Abgelaufene Einträge werden alle 5 Minuten endgültig gelöscht.
- **API-062** Request Logs einer Domain Group sind abfragbar, filterbar nach Path Rule, Log Policy und Zeitraum (`from`/`to`), sortiert neueste zuerst, mit Paginierung (`limit` Standard 50, max. 200; `offset`).
- **API-063** Ein Logeintrag enthält: eingehende Methode/URL/Header, Upstream-Methode/URL/Header, Antwort-Statuscode, Gesamtdauer in ms.

### 2.8 Konfigurationsverteilung

- **API-070** Die API stellt die gesamte Gateway-Konfiguration als einen zusammenhängenden Snapshot bereit und berechnet dafür eine Prüfsumme (SHA-256).
- **API-071** Der Snapshot ist zusätzlich für authentifizierte Clients per `GET /v1/workers/_actions/bootstrap` abrufbar.

---

## 3. Protokoll Control Plane ↔ Worker

- **PROT-001** Worker verbinden sich per WebSocket mit `/api/workers/websocket`.
- **PROT-002** Ein Worker muss sich innerhalb von 5 Sekunden mit dem gemeinsamen Worker-Token (`workers.websocket.auth_token`) authentifizieren. Andernfalls, oder bei falschem Token, erhält er `UNAUTHORIZED` und die Verbindung wird geschlossen.
- **PROT-003** Auf `bootstrap` antwortet die API mit Version, Prüfsumme und vollständigem Snapshot.
- **PROT-004** Die API prüft in einem konfigurierbaren Intervall (`config_check_interval_ms`), ob sich die Konfiguration geändert hat. Bei geänderter Prüfsumme wird die Version erhöht und ein `CONFIG_SNAPSHOT` an alle verbundenen Worker gepusht. Sind keine Worker verbunden, wird nicht geprüft.
- **PROT-005** Konfigurationsänderungen erreichen die Worker also mit einer Verzögerung von höchstens einem Prüfintervall, ohne Neustart.
- **PROT-006** `heartbeat` ist ein Keepalive; der Worker sendet dabei Metriken (laufende/gesamte Anfragen, Fehler, Uptime, aktive Konfigurationsversion).
- **PROT-007** Bei Verbindungsabbruch verbindet sich der Worker selbstständig neu (exponentielles Backoff, max. 15 s) und holt sich die Konfiguration erneut.

---

## 4. frontier-worker (Data Plane)

### 4.1 Grundverhalten

- **WRK-001** Solange der Worker keine Konfiguration erhalten hat, beantwortet er jede Anfrage mit `503`.
- **WRK-002** Die Domain Group wird über den `Host`-Header bestimmt (Port wird ignoriert, Groß-/Kleinschreibung egal). Fehlt der Host oder ist er keiner Domain Group zugeordnet: `404`.
- **WRK-003** Eine neue Konfiguration wird atomar übernommen und gilt sofort für alle folgenden Anfragen.

### 4.2 Routing (Path Rules)

- **WRK-010** Path Rules werden in aufsteigender `order` geprüft; die erste passende Regel gewinnt. Passt keine: `404`.
- **WRK-011** Unterstützte Pfadmuster:
  - **Catch-all**: leer, `/`, `*` oder `/*` – passt auf jeden Pfad.
  - **Endungs-Wildcard**: `*.ext` bzw. `/*.ext` – passt auf Pfade, die auf `.ext` enden.
  - **Präfix**: `/foo` oder `/foo/*` – passt auf `/foo` und alles unterhalb von `/foo/` (aber nicht `/foobar`).
- **WRK-012** Regeln ohne Upstream Group oder ohne gültigen Upstream werden ignoriert.
- **WRK-013** Pfad-Umschreibung zum Upstream: Bei Präfix-Regeln wird das Präfix entfernt und der Rest an den Basispfad des Upstreams angehängt (`/api/users` mit Regel `/api` und Basispfad `/v2` → `/v2/users`). Bei Catch-all und Endungs-Wildcard wird der vollständige Pfad angehängt. Der Query-String bleibt unverändert.
- **WRK-014** Hat eine Upstream Group mehrere Upstreams, werden Anfragen pro Regel reihum (Round-Robin) verteilt.

### 4.3 Weiterleitung an den Upstream

- **WRK-020** Methode, Header und Body der Anfrage werden an den Upstream weitergereicht. Nicht weitergereicht werden: `Host`, Hop-by-Hop-Header (`Connection`, `Transfer-Encoding`, …) und vom Client gesendete Trace-Header (`traceparent`, `tracestate`, `baggage`).
- **WRK-021** Der Worker ergänzt `X-Forwarded-Host`, `X-Forwarded-Proto` und `X-Forwarded-Port` (an bestehende Werte angehängt).
- **WRK-022** Der Request-Body wird ohne Zwischenspeicherung zum Upstream gestreamt, außer ein Pre-Hook ist aktiv (dann wird er vollständig gelesen, damit der Hook ihn prüfen/ändern kann).
- **WRK-023** Weiterleitungen (3xx) des Upstreams werden nicht selbst verfolgt, sondern an den Client durchgereicht.
- **WRK-024** Bei `https`-Upstreams mit abgeschalteter Zertifikatsprüfung (API-033) werden ungültige Zertifikate akzeptiert.
- **WRK-025** Ist der Upstream nicht erreichbar oder tritt ein unerwarteter Fehler auf: `502`.
- **WRK-026** Gzip-komprimierte Upstream-Antworten werden entpackt, damit Post-Hooks und eingebaute Verarbeitung auf dem Klartext arbeiten können.

### 4.4 CORS

- **WRK-030** CORS greift nur, wenn der Path Rule eine CORS Policy mit `enabled = true` zugeordnet ist.
- **WRK-031** Preflight (`OPTIONS` mit `Origin` und `Access-Control-Request-Method`): Bei erlaubtem Origin antwortet der Worker selbst mit `204` und den CORS-Headern, ohne den Upstream aufzurufen; sonst `403`.
- **WRK-032** Normale Anfragen mit nicht erlaubtem `Origin` werden mit `403` abgewiesen. Anfragen ohne `Origin` sind nicht betroffen.
- **WRK-033** Ein Origin ist erlaubt, wenn er exakt in `allowedOrigins` steht oder dort `*` eingetragen ist.
- **WRK-034** Antwort-Header: `Access-Control-Allow-Origin` (bei `*` ohne Credentials `*`, sonst der konkrete Origin), `Access-Control-Allow-Methods` (GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS), `Access-Control-Allow-Headers` (angefragte Header bzw. `*`), `Access-Control-Max-Age: 600`, `Vary: Origin` und bei `allowCredentials` zusätzlich `Access-Control-Allow-Credentials: true`.

### 4.5 Cache-Header

- **WRK-040** Ist der Path Rule eine Cache Policy zugeordnet, wird der `Cache-Control`-Header der Antwort angepasst; ohne Policy bleibt er unverändert.
- **WRK-041** Liefert der Upstream ein `max-age`, wird es auf den Bereich [`minTTL`, `maxTTL`] begrenzt; übrige Direktiven bleiben erhalten.
- **WRK-042** Liefert der Upstream kein `max-age`, wird `defaultTTL` verwendet (ebenfalls begrenzt). Gab es noch gar keinen `Cache-Control`-Header, wird zusätzlich `public` gesetzt.
- **WRK-043** Der Worker selbst speichert keine Antworten zwischen; er steuert nur die Header für nachgelagerte Caches/Browser.

### 4.6 Komprimierung

- **WRK-050** Antworten werden gzip-komprimiert, wenn der Client `gzip` per `Accept-Encoding` akzeptiert, der Body größer als 100 Byte ist und der Content-Type textbasiert ist (u. a. `text/html`, `text/plain`, `text/css`, `text/javascript`, `application/json`, `application/javascript`, `application/xml`).
- **WRK-051** Bei Komprimierung wird `Vary: Accept-Encoding` ergänzt. Binäre Antworten werden nicht komprimiert.

### 4.7 Hooks (Pre/Post)

- **WRK-060** Pro Path Rule kann ein Pre-Hook und ein Post-Hook hinterlegt werden. Hooks werden auf dem externen Function Server ausgeführt; der Worker authentifiziert sich dort per OAuth2 Client Credentials.
- **WRK-061** Hooks sind nur aktiv, wenn im Worker ein Function Server (`function_worker`) konfiguriert ist; sonst werden sie übersprungen.
- **WRK-062** Pre-Hooks laufen vor dem Upstream-Aufruf (nicht bei `GET`/`HEAD`). Sie erhalten die Original-Anfrage des Clients und die geplante Upstream-Anfrage und können
  - die Upstream-Anfrage verändern (Methode, Header, Body) oder
  - direkt eine eigene Antwort liefern (Short-Circuit, der Upstream wird nicht aufgerufen).
- **WRK-063** Schlägt ein Pre-Hook fehl, wird die Anfrage mit `500` und Header `x-error: pre-hook failed` beantwortet; der Upstream wird nicht aufgerufen.
- **WRK-064** Post-Hooks laufen nach dem Upstream-Aufruf und können die Antwort verändern. Schlägt ein Post-Hook fehl, wird die unveränderte Upstream-Antwort mit Header `x-error: post-hook failed` ausgeliefert.
- **WRK-065** Ein einzelner Hook-Aufruf bricht nach 5 Sekunden ab (gilt als Fehler).
- **WRK-066** Request-Bodies werden dem Hook je nach Content-Type als JSON-Objekt, Text oder Binärdaten (Base64) übergeben.
- **WRK-067** Reihenfolge der Antwortverarbeitung: Post-Hook → CORS-Header → Cache-Header → Komprimierung.

### 4.8 Request Logging

- **WRK-070** Anfragen werden nur protokolliert, wenn der Path Rule eine Log Policy mit `enabled = true` zugeordnet ist.
- **WRK-071** Protokolliert werden alle Ausgänge einer zugeordneten Anfrage: normale Antworten, CORS-Ablehnungen und -Preflights, Pre-Hook-Fehler, Short-Circuit-Antworten und Upstream-Fehler.
- **WRK-072** Logs werden an die API gesendet (API-060). Fehler beim Senden beeinträchtigen die Anfrage des Endnutzers nicht.

### 4.9 Betrieb und Beobachtbarkeit

- **WRK-080** Optional exportiert der Worker OpenTelemetry-Traces (Konsole, OTLP/HTTP oder OTLP/gRPC) mit Spans für Routing, Hooks und Upstream-Aufruf; Trace-Kontext wird vom Client zum Upstream weitergegeben.
- **WRK-081** Port, Control-Plane-URL, Worker-Token, Heartbeat-Intervall und Log-Ingest-URL werden über Umgebungsvariablen konfiguriert (siehe `apps/frontier-worker/README.md`).
