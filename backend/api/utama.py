"""
Titik masuk layanan API.

    uvicorn api.utama:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from warungku.basis_data import mesin
from warungku.konfigurasi import alamat_layanan_model

from . import distributor, gudang, katalog, kontrak, otentikasi, pesanan, produksi, promo

app = FastAPI(
    title="Turnify Flow API",
    version="0.1.0",
    description=(
        "Layanan baca-tulis basis data Turnify Flow. Tidak memanggil model: "
        "keluaran model dibaca dari tabel yang ditulis layanan `ml`."
    ),
)

app.add_middleware(
    CORSMiddleware,
    # Port pengembangan Vite. Daftar diperketat saat dipasang sungguhan —
    # `allow_origins=["*"]` bersama `allow_credentials=True` ditolak browser,
    # dan menaruh "*" di sini sekarang berarti menemukannya nanti saat
    # login mulai dipasang, dengan gejala yang membingungkan.
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(otentikasi.rute)
app.include_router(gudang.rute)
app.include_router(distributor.rute)
app.include_router(katalog.rute)
app.include_router(katalog.rute_distributor)
app.include_router(promo.rute)
app.include_router(kontrak.rute_umkm)
app.include_router(kontrak.rute_distributor)
app.include_router(pesanan.rute_umkm)
app.include_router(pesanan.rute_distributor)
app.include_router(produksi.rute)


@app.get("/", include_in_schema=False)
def akar() -> RedirectResponse:
    """Alamat utama tidak punya halaman; arahkan ke dokumentasi interaktif."""
    return RedirectResponse("/docs")


@app.get("/sehat", tags=["sistem"])
def sehat() -> dict:
    """
    Keadaan layanan. Memeriksa basis data, dan menyebut alamat layanan model.

    Layanan model TIDAK dihubungi dari sini. Kalau endpoint kesehatan API ikut
    gagal karena layanan model mati, pemisahan keduanya tidak ada artinya —
    dan pemantauan akan melaporkan API bermasalah padahal ia baik-baik saja.
    """
    try:
        with mesin().connect() as kon:
            tabel = kon.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = 'public'"
                )
            ).scalar_one()
        basis_data = {"terhubung": True, "tabel": int(tabel)}
    except Exception as e:
        basis_data = {"terhubung": False, "galat": type(e).__name__}

    return {
        "layanan": "api",
        "basis_data": basis_data,
        "layanan_model": alamat_layanan_model(),
    }
