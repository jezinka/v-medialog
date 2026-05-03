# Medialog

Aplikacja do śledzenia filmów, seriali, książek i gier. Działa jako samodzielny kontener Docker z bazą SQLite.

---

## Rozwój lokalny

```bash
cp .env.local.example .env.local
# uzupełnij klucze API w .env.local

npm install
npm run dev        # http://localhost:5000
```

---

## Deploy na serwer (VPS)

### Wymagania na serwerze
- Docker + docker compose plugin
- SSH dostęp (najlepiej przez klucz)

### Migracja serwer → serwer (gotowy obraz Docker + baza)

Jeśli app już działa na starym serwerze i chcesz przenieść wszystko na nowy:

```bash
# Uruchom lokalnie z katalogu projektu
./scripts/server-to-server.sh user@stary-serwer.com user@nowy-serwer.com
# domyślnie używa ~/medialog na obu serwerach; możesz podać inny katalog jako 3. argument
```

Skrypt automatycznie:
1. Eksportuje obraz Docker ze starego serwera
2. Przesyła go strumieniowo na nowy serwer (`docker save | docker load`)
3. Kopiuje bazę danych SQLite
4. Uruchamia kontener na nowym serwerze

### Pierwsze uruchomienie (budowanie od zera)

```bash
# Skopiuj .env.local.example jako .env i uzupełnij klucze API
cp .env.local.example .env

./scripts/deploy.sh user@twoj-serwer.com
```

Aplikacja będzie dostępna pod `http://twoj-serwer.com:5000`.

### Kolejne deploye (po zmianach w kodzie)

```bash
./scripts/deploy.sh user@twoj-serwer.com
```

Script wysyła aktualny `docker-compose.yml`, buduje obraz i restartuje kontener. Dane w `data/` nie są ruszane.

### Backup bazy danych

```bash
./scripts/backup-db.sh              # zapisuje do ./backups/
./scripts/backup-db.sh /tmp/backup  # lub podaj własny katalog
```

---

## Architektura

```
VPS
├── /opt/medialog/          ← port 5000
│   ├── docker-compose.yml
│   ├── .env
│   └── data/
│       └── medialog.db     ← baza SQLite (wolumen Docker)
│
├── /opt/life-admin/        ← port 5001 (przyszły projekt)
└── /opt/life-events/       ← port 5002 (przyszły projekt)
```

Każdy projekt to osobne repozytorium z własnym `docker-compose.yml` i własną bazą danych. Deployowane niezależnie.

---

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `TMDB_API_KEY` | Klucz API do The Movie Database |
| `GOOGLE_BOOKS_API_KEY` | Klucz API do Google Books |
| `DATABASE_URL` | Ścieżka do pliku SQLite (domyślnie `/data/medialog.db`) |

