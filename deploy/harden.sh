#!/usr/bin/env bash
# Укрепване на сървъра. Пуска се веднъж (и е безопасно да се пусне пак):
#   bash deploy/harden.sh
# Прави: firewall, защита от налучкване на паролата за SSH, автоматични обновления за сигурност,
# по-строг SSH и проверка на тайните в .env. Нищо не изтрива и не сменя пароли.
set -euo pipefail
cd "$(dirname "$0")/.."
ok() { echo "  ✓ $*"; }
warn() { echo "  ⚠ $*"; }

echo "==> 1. Firewall (ufw): отворени са само SSH, 80 и 443"
sudo apt-get update -y >/dev/null
sudo apt-get install -y ufw fail2ban unattended-upgrades >/dev/null
sudo ufw default deny incoming >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow OpenSSH >/dev/null
sudo ufw limit OpenSSH >/dev/null   # повече от 6 опита за 30 сек. от един адрес → блокиран
sudo ufw allow 80/tcp >/dev/null
sudo ufw allow 443/tcp >/dev/null
sudo ufw --force enable >/dev/null
ok "ufw е включен"
# Docker заобикаля ufw за публикуваните портове — проверяваме, че базата и вътрешните сървъри не са отвън
if sudo ss -ltnp | grep -E ':(5432|3000|4000)\b' | grep -vq '127.0.0.1'; then
  warn "порт 5432, 3000 или 4000 слуша навън — провери docker-compose.yml (трябва да е 127.0.0.1:...)"
else
  ok "базата (5432) и вътрешните сървъри (3000, 4000) не се виждат отвън"
fi

echo "==> 2. fail2ban: блокира адреси, които налучкват паролата за SSH"
sudo tee /etc/fail2ban/jail.d/belmaster.local >/dev/null <<'JAIL'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
sudo systemctl enable --now fail2ban >/dev/null 2>&1
sudo systemctl restart fail2ban
ok "fail2ban следи SSH (5 грешни опита за 10 мин. → бан за 1 час)"

echo "==> 3. Автоматични обновления за сигурност"
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
sudo systemctl enable --now unattended-upgrades >/dev/null 2>&1
ok "пачовете за сигурност се слагат сами всеки ден"

echo "==> 4. SSH"
CONF=/etc/ssh/sshd_config.d/90-belmaster.conf
KEYS=$(cat ~/.ssh/authorized_keys 2>/dev/null | grep -c . || true)
{
  echo "# добавено от deploy/harden.sh"
  echo "MaxAuthTries 4"
  echo "LoginGraceTime 30"
  echo "X11Forwarding no"
  if [ "${KEYS:-0}" -gt 0 ]; then
    echo "PermitRootLogin prohibit-password"
    echo "PasswordAuthentication no"
    echo "KbdInteractiveAuthentication no"
  fi
} | sudo tee "$CONF" >/dev/null
if sudo sshd -t; then
  sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd
  if [ "${KEYS:-0}" -gt 0 ]; then
    ok "вход само с SSH ключ (паролите са изключени) — имаш ${KEYS} ключа в ~/.ssh/authorized_keys"
  else
    warn "нямаш SSH ключ — входът с парола остава. Добави ключ и пусни скрипта пак, за да се изключат паролите."
  fi
else
  sudo rm -f "$CONF"
  warn "SSH настройката не мина проверката — нищо не е сменено"
fi

echo "==> 5. Тайните в .env"
if grep -q 'change-me' .env 2>/dev/null; then warn "в .env има стойност „change-me“ — смени я с дълъг случаен низ (openssl rand -hex 32)"; else ok "няма стойности по подразбиране"; fi
if ! grep -q '^POSTGRES_PASSWORD=' .env 2>/dev/null; then warn "няма POSTGRES_PASSWORD в .env — базата е с паролата по подразбиране"; else ok "базата е със собствена парола"; fi
PERM=$(stat -c %a .env 2>/dev/null || echo "")
if [ "$PERM" != "600" ]; then chmod 600 .env && ok ".env вече се чете само от теб (600)"; else ok ".env се чете само от теб"; fi

echo "==> 6. Caddy с новите заглавки за сигурност"
sudo docker compose --profile prod up -d caddy >/dev/null
sudo docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 && ok "Caddy презареди настройките" || warn "презареди Caddy ръчно: sudo docker compose restart caddy"

echo ""
echo "Готово. Статус на firewall:"
sudo ufw status verbose | sed -n '1,20p'
