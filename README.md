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

### Migracja serwer → serwer (manualna)

Jeśli aplikacja już działa na starym serwerze i chcesz przenieść dane na nowy serwer, wykonaj ręczną migrację:

- Eksport obrazu Docker na źródłowym serwerze (`docker save`) i zaimportowanie na serwerze docelowym (`docker load`),
- Skopiowanie pliku bazy danych SQLite (`/data/medialog.db`) na serwer docelowy,
- Skopiowanie pliku `docker-compose.yml` oraz pliku `.env` na serwer docelowy,
- Uruchomienie kontenera na serwerze docelowym (`docker compose up -d`).

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
```

Każdy projekt to osobne repozytorium z własnym `docker-compose.yml` i własną bazą danych. Deployowane niezależnie.

---

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `TMDB_API_KEY` | Klucz API do The Movie Database |
| `DATABASE_URL` | Ścieżka do pliku SQLite (domyślnie `/data/medialog.db`) |

