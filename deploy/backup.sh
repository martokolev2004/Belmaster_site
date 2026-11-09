#!/usr/bin/env bash
# Ежедневен архив на базата. Пази последните 7 дни в ~/belmaster-backups.
# Възстановяване: gunzip -c ФАЙЛ.sql.gz | sudo docker compose exec -T db psql -U belmaster belmaster
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-$HOME/belmaster-backups}"
mkdir -p "$DIR"
chmod 700 "$DIR"
DOCKER="docker"
$DOCKER info >/dev/null 2>&1 || DOCKER="sudo -n docker"
FILE="$DIR/belmaster-$(date +%F).sql.gz"
$DOCKER compose exec -T db pg_dump -U belmaster --clean --if-exists belmaster | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
find "$DIR" -name 'belmaster-*.sql.gz' -mtime +6 -delete
echo "Архив: $FILE ($(du -h "$FILE" | cut -f1))"
