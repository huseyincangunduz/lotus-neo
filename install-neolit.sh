#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  exit 1
fi

# .env'i yükle
set -o allexport
source "$ENV_FILE"
set +o allexport

if [[ -z "${NEOLIT_PATH:-}" ]] || [[ -z "${LOTUS_NEO_PATH:-}" ]]; then
  echo "ERROR: .env içinde NEOLIT_PATH ve LOTUS_NEO_PATH tanımlı olmalı"
  exit 1
fi

echo "==> neolit build alınıyor: $NEOLIT_PATH"
cd "$NEOLIT_PATH"
npm run build:lib

echo "==> npm pack yapılıyor..."
PACK_OUTPUT=$(npm pack --json 2>/dev/null | grep '"filename"' | head -1 | sed 's/.*"filename": "\(.*\)".*/\1/')

if [[ -z "$PACK_OUTPUT" ]]; then
  # json parse başarısız olursa klasik yöntemle bul
  PACK_OUTPUT=$(ls -t *.tgz 2>/dev/null | head -1)
fi

if [[ -z "$PACK_OUTPUT" ]]; then
  echo "ERROR: .tgz dosyası oluşturulamadı"
  exit 1
fi

echo "==> Oluşturulan paket: $PACK_OUTPUT"

echo "==> $LOTUS_NEO_PATH dizinine kopyalanıyor..."
cp "$NEOLIT_PATH/$PACK_OUTPUT" "$LOTUS_NEO_PATH/$PACK_OUTPUT"

echo "==> lotus-neo'ya yükleniyor..."
cd "$LOTUS_NEO_PATH"
npm install "./$PACK_OUTPUT"

echo ""
echo "Tamamlandı! $PACK_OUTPUT lotus-neo'ya kuruldu."
