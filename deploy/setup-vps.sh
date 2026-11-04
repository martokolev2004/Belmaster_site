#!/usr/bin/env bash
# Първоначална настройка на VPS (Ubuntu 24.04). Пуска се от папката на проекта:
#   bash deploy/setup-vps.sh belmaster.eu
set -euo pipefail
DOMAIN="${1:-belmaster.eu}"
cd "$(dirname "$0")/.."

echo "==> Swap (2 GB), за да не спре компилирането"
if ! sudo swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Docker, firewall"
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 openssl ufw
sudo systemctl enable --now docker
sudo ufw allow OpenSSH >/dev/null
sudo ufw allow 80/tcp >/dev/null
sudo ufw allow 443/tcp >/dev/null
sudo ufw --force enable >/dev/null

echo "==> Настройки (.env)"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s#^APP_URL=.*#APP_URL=\"https://${DOMAIN}\"#" .env
  sed -i "s#^GAME_JWT_SECRET=.*#GAME_JWT_SECRET=\"$(openssl rand -hex 32)\"#" .env
  {
    echo ""
    echo "# Сървър"
    echo "DOMAIN=${DOMAIN}"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
  } >> .env
  echo "    създаден .env (тайните са генерирани автоматично)"
else
  echo "    .env вече съществува — не го пипам"
fi

echo "==> Компилиране и пускане (първия път отнема 5–10 минути)"
sudo docker compose --profile prod up -d --build

echo "==> База: таблици + произведения + въпроси"
sudo docker compose run --rm setup

echo ""
echo "Готово! Сайтът: https://${DOMAIN}"
echo "(Сертификатът се издава автоматично, щом DNS сочи към този сървър.)"
