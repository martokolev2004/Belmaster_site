#!/usr/bin/env bash
# Ежедневен архив на базата. Пази последните 7 дни в ~/belmaster-backups,
# а ако е настроено (deploy/offsite-setup.sh) — и криптирано копие за 30 дни в Google Drive.
# Възстановяване: gunzip -c ФАЙЛ.sql.gz | sudo docker compose exec -T db psql -U belmaster belmaster
# От Google Drive: rclone copy belmaster-offsite:ФАЙЛ.sql.gz .   (после както горе)
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

# копие извън сървъра
if command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -qx 'belmaster-offsite:'; then
  if rclone copy "$FILE" belmaster-offsite: --retries 3 --low-level-retries 5; then
    rclone delete belmaster-offsite: --min-age 30d --include 'belmaster-*.sql.gz' 2>/dev/null || true
    echo "Копие в Google Drive: ок"
  else
    echo "⚠ Копието в Google Drive не успя — местният архив е запазен" >&2
    exit 1
  fi
fi
