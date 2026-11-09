#!/usr/bin/env bash
# Обновяване след нови промени:  bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull
sudo docker compose --profile prod up -d --build
sudo docker compose run --rm setup
sudo docker image prune -f >/dev/null
# стар кеш от билдове (иначе запълва диска с времето)
sudo docker builder prune -f --filter until=72h >/dev/null || true
# ежедневен архив на базата в 03:30 (слага се веднъж)
JOB="30 3 * * * $(pwd)/deploy/backup.sh >> $HOME/belmaster-backups.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q 'deploy/backup.sh'; then
  (crontab -l 2>/dev/null; echo "$JOB") | crontab -
  echo "Добавен е ежедневен архив на базата (03:30, пази 7 дни в ~/belmaster-backups)."
  ./deploy/backup.sh || echo "Първият архив не успя — провери с: ./deploy/backup.sh"
fi
echo "Обновено."
