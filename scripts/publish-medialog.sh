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
FIRST_YEAR=2024
CURRENT_YEAR=$(date +%Y)
trap 'docker compose exec -T medialog sh -c "rm -f /tmp/medialog*.json; rm -rf /tmp/medialog-covers" >/dev/null 2>&1 || true' EXIT

docker compose exec -T medialog node /app/scripts/export-medialog.mjs "$OUTPUT"
docker compose exec -T -e EXPORT_RANGE=year medialog node /app/scripts/export-medialog.mjs "$YEAR_OUTPUT"
# Zakończone lata (od FIRST_YEAR) eksportowane co publikację, żeby poprawki starych wpisów też trafiały na stronę.
PAST_FILES=""
year=$FIRST_YEAR
while [ "$year" -lt "$CURRENT_YEAR" ]; do
  docker compose exec -T -e EXPORT_RANGE=year -e CALENDAR_DATE="$year-01-01" medialog node /app/scripts/export-medialog.mjs "/tmp/medialog-$year.json"
  PAST_FILES="$PAST_FILES data/medialog-$year.json"
  year=$((year + 1))
done
mkdir -p "$PAGES_DIR/data"
mkdir -p "$PAGES_DIR/data/medialog-covers"
docker compose cp "medialog:$OUTPUT" "$PAGES_DIR/data/medialog.json"
docker compose cp "medialog:$YEAR_OUTPUT" "$PAGES_DIR/data/medialog-year.json"
for file in $PAST_FILES; do
  docker compose cp "medialog:/tmp/$(basename "$file")" "$PAGES_DIR/$file"
done
docker compose cp "medialog:$COVERS_OUTPUT/." "$PAGES_DIR/data/medialog-covers"

git -C "$PAGES_DIR" add -- data/medialog.json data/medialog-year.json $PAST_FILES data/medialog-covers
if git -C "$PAGES_DIR" diff --cached --quiet -- data/medialog.json data/medialog-year.json $PAST_FILES data/medialog-covers; then
  echo "Dane MediaLogu bez zmian."
else
  git -C "$PAGES_DIR" commit --only -m "Aktualizuj dane MediaLogu" -- data/medialog.json data/medialog-year.json $PAST_FILES data/medialog-covers
fi

# Push także przy braku zmian: wypycha commity zaległe po wcześniejszym nieudanym pushu.
git -C "$PAGES_DIR" pull --rebase --autostash
git -C "$PAGES_DIR" push
