#!/usr/bin/env bash
# Еднократно: копие на нощните архиви на базата в Google Drive, криптирано.
#   bash deploy/offsite-setup.sh
# Нужен е и компютърът ти (с браузър) за една команда — скриптът казва кога.
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE=belmaster-gdrive      # връзката с Google Drive
CRYPT=belmaster-offsite      # криптирана папка в нея (това ползва backup.sh)

echo "==> 1. rclone (програмата, която качва в облака)"
command -v rclone >/dev/null || { sudo apt-get update -y >/dev/null; sudo apt-get install -y rclone >/dev/null; }
echo "    $(rclone version | head -1)"

if rclone listremotes | grep -qx "${CRYPT}:"; then
  echo "Вече е настроено (${CRYPT}). За наново: rclone config delete ${CRYPT} && rclone config delete ${REMOTE}"
  exit 0
fi

echo ""
echo "==> 2. Връзка с Google Drive"
echo "    На ТВОЯ компютър (не на сървъра) отвори терминал и пусни:"
echo ""
echo "        sudo apt install -y rclone"
echo "        rclone authorize \"drive\" \"eyJzY29wZSI6ImRyaXZlLmZpbGUifQ\""
echo ""
echo "    Ще се отвори браузър → влез в Google акаунта, в който искаш архивите → Разреши."
echo "    В терминала ще излезе ред, който започва с {\"access_token\"… — копирай целия ред."
echo "    (Достъпът е само до файловете, които rclone създава — не вижда останалото ти в Drive.)"
echo ""
read -r -p "    Постави реда тук и натисни Enter: " TOKEN
[ -n "$TOKEN" ] || { echo "Празно — спирам."; exit 1; }
rclone config create "$REMOTE" drive scope=drive.file token="$TOKEN" >/dev/null
rclone lsd "${REMOTE}:" >/dev/null && echo "    ✓ връзката с Google Drive работи"

echo ""
echo "==> 3. Криптиране"
echo "    Архивите съдържат данни на ученици, затова се криптират преди качване."
read -r -p "    Имаш ли вече парола за архивите (ако правиш това наново)? [д/Н] " HAVE
if [[ "$HAVE" =~ ^[дДyY] ]]; then
  read -r -s -p "    Въведи паролата: " PASS; echo
else
  PASS=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-28)
  echo ""
  echo "    ┌──────────────────────────────────────────────────────────────┐"
  echo "    │  ПАРОЛА ЗА АРХИВИТЕ:  $PASS        │"
  echo "    └──────────────────────────────────────────────────────────────┘"
  echo "    ЗАПИШИ Я СЕГА в мениджър на пароли или на хартия."
  echo "    Без нея архивите в Google Drive НЕ МОГАТ да се отворят, ако сървърът изчезне."
  read -r -p "    Записах я — Enter, за да продължа. " _
fi
rclone config create "$CRYPT" crypt remote="${REMOTE}:belmaster-backups" password="$(rclone obscure "$PASS")" filename_encryption=off directory_name_encryption=false >/dev/null
unset PASS
chmod 600 ~/.config/rclone/rclone.conf

echo ""
echo "==> 4. Пробно качване"
bash deploy/backup.sh
rclone ls "${CRYPT}:" | tail -3
echo ""
echo "Готово. Всяка нощ в 03:30 архивът отива и в Google Drive (папка belmaster-backups, криптиран)."
echo "Там се пазят последните 30 дни."
