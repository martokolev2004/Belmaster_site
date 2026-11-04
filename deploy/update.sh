#!/usr/bin/env bash
# Обновяване след нови промени:  bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull
sudo docker compose --profile prod up -d --build
sudo docker compose run --rm setup
sudo docker image prune -f >/dev/null
echo "Обновено."
