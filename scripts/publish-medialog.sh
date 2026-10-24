#!/bin/sh
# Publikuje dane MediaLogu do lokalnego klona repozytorium GitHub Pages.
set -eu

: "${PAGES_DIR:?Ustaw PAGES_DIR na katalog lokalnego klona repozytorium GitHub Pages}"

cd "$(dirname "$0")"

if [ ! -d "$PAGES_DIR/.git" ]; then
  echo "PAGES_DIR nie wskazuje na repozytorium Git." >&2
  exit 1
fi

OUTPUT="/tmp/medialog.json"
YEAR_OUTPUT="/tmp/medialog-year.json"
COVERS_OUTPUT="/tmp/medialog-covers"
trap 'docker compose exec -T medialog rm -f /tmp/medialog.json /tmp/medialog-year.json >/dev/null 2>&1 || true; docker compose exec -T medialog rm -rf /tmp/medialog-covers >/dev/null 2>&1 || true' EXIT

docker compose exec -T medialog node /app/scripts/export-medialog.mjs "$OUTPUT"
docker compose exec -T -e EXPORT_RANGE=year medialog node /app/scripts/export-medialog.mjs "$YEAR_OUTPUT"
mkdir -p "$PAGES_DIR/data"
mkdir -p "$PAGES_DIR/data/medialog-covers"
docker compose cp "medialog:$OUTPUT" "$PAGES_DIR/data/medialog.json"
docker compose cp "medialog:$YEAR_OUTPUT" "$PAGES_DIR/data/medialog-year.json"
docker compose cp "medialog:$COVERS_OUTPUT/." "$PAGES_DIR/data/medialog-covers"

git -C "$PAGES_DIR" add -- data/medialog.json data/medialog-year.json data/medialog-covers
if git -C "$PAGES_DIR" diff --cached --quiet -- data/medialog.json data/medialog-year.json data/medialog-covers; then
  echo "Dane MediaLogu bez zmian."
else
  git -C "$PAGES_DIR" commit --only -m "Aktualizuj dane MediaLogu" -- data/medialog.json data/medialog-year.json data/medialog-covers
fi

# Push także przy braku zmian: wypycha commity zaległe po wcześniejszym nieudanym pushu.
git -C "$PAGES_DIR" pull --rebase --autostash
git -C "$PAGES_DIR" push
