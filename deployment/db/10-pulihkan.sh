#!/bin/sh
# Dijalankan entrypoint resmi postgres SEKALI, saat volume data masih kosong.
set -e
echo "Turnify Flow: memulihkan data simulasi (beberapa menit)..."
pg_restore --no-owner --no-privileges --exit-on-error \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" /opt/turnify/warungku_dev.dump
echo "Turnify Flow: data simulasi siap."
