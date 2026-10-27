# Image basis data Turnify Flow: PostgreSQL 16 yang langsung berisi data simulasi.
#
# Saat kontainer pertama kali dinyalakan dengan volume KOSONG, skrip di
# /docker-entrypoint-initdb.d memulihkan cadangan warungku_dev.dump. Volume yang
# sudah berisi data tidak disentuh: skrip itu hanya jalan sekali, saat inisialisasi.
#
# Cadangan TIDAK dilacak git (besar). Buat dulu dari basis data lokal, lalu build
# dari folder ini:
#   docker build -t yonobengkel/turnify-flow-db:0.3.0 deployment/db
#
# 0.3.0 (27 Okt 2026) adalah salinan basis data lokal Ilham pada hari itu: data
# simulasi, variasi demo revisi V4, dan keluaran ketiga mesin. TURNIFY_DATA_VERSI
# ditulis sebagai komentar basis data saat pemulihan; samakan dengan tag image
# setiap kali membangun versi baru.

FROM postgres:16-alpine

ENV TZ=Asia/Jakarta \
    TURNIFY_DATA_VERSI=0.3.0

COPY warungku_dev.dump /opt/turnify/warungku_dev.dump
COPY 10-pulihkan.sh /docker-entrypoint-initdb.d/10-pulihkan.sh
