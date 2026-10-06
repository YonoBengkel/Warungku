"""Pengaturan yang dibaca dari berkas .env."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

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
            "lalu jalankan: docker compose -f backend/docker-compose.yml up -d"
        )
    return alamat


@lru_cache
def alamat_layanan_model() -> str:
    return os.getenv("WARUNGKU_ML", "http://localhost:8001")
