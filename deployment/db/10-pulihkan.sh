#!/bin/sh
# Dijalankan entrypoint resmi postgres SEKALI, saat volume data masih kosong.
set -e
echo "Turnify Flow: memulihkan data simulasi (beberapa menit)..."
pg_restore --no-owner --no-privileges --exit-on-error \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" /opt/turnify/warungku_dev.dump
# Penanda asal data (sejak 0.3.0). siapkan.cmd membacanya untuk mengenali volume
# yang dipulihkan dari image lama dan menawarkan menggantinya.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "COMMENT ON DATABASE \"$POSTGRES_DB\" IS 'turnify-flow-db $TURNIFY_DATA_VERSI'"
echo "Turnify Flow: data simulasi siap (turnify-flow-db $TURNIFY_DATA_VERSI)."
