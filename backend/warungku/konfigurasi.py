"""Pengaturan yang dibaca dari berkas .env."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

#: backend/.env, dicari dengan jalur pasti. `load_dotenv()` tanpa jalur kadang
#: mencari dari folder kerja; sejak perintah dijalankan dari akar repo, itu
#: akan meleset. Variabel yang sudah diset di lingkungan tetap menang.
BERKAS_ENV = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(BERKAS_ENV)

# Satuan dasar yang dikenal platform. Stok SELALU disimpan dalam satuan ini;
# "kg" dan "liter" hanyalah lapisan tampilan di antarmuka.
SATUAN_DASAR = ("gram", "ml", "pcs")

# Zona waktu operasional. Semua stempel waktu disimpan dengan zona (timestamptz),
# tapi batas "hari" untuk agregasi permintaan harian memakai zona ini.
ZONA_WAKTU = "Asia/Jakarta"


@lru_cache
def alamat_basis_data() -> str:
    alamat = os.getenv("WARUNGKU_DB")
    if not alamat:
        raise RuntimeError(
            "WARUNGKU_DB belum diisi. Salin backend/.env.example jadi backend/.env, "
            "lalu jalankan dari akar repo: docker compose -f deployment/docker-compose.yml up -d"
        )
    return alamat


@lru_cache
def alamat_layanan_model() -> str:
    return os.getenv("WARUNGKU_ML", "http://localhost:8001")
