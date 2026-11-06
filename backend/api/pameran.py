"""
Pengaman saat aplikasi dibuka untuk umum di pameran. Pembatas tulis selalu aktif, sisanya
hanya menyala kalau `WARUNGKU_SANDI_BOOTH` diisi.

**Akun simulasi hanya bisa membaca.** Kata sandinya ada di repo dan di tombol halaman Masuk,
jadi siapa pun bisa memakainya, dan semua pengunjung berbagi data yang sama. Token untuk
akun itu membawa `baca_saja`, dan penjaga di sini menolak semua permintaan tulis dari token
tersebut sebelum sampai ke rute. Penjagaan di satu tempat, bukan di tiap rute, supaya rute
baru otomatis ikut tertutup. Tim di booth masuk ke akun yang sama dengan `WARUNGKU_SANDI_BOOTH`
dan mendapat token biasa.

**Batas percobaan masuk dan daftar.** Disimpan di memori proses, jadi hanya berlaku untuk satu
pekerja uvicorn, dan itu yang dipakai image ini. Batasnya longgar karena pengunjung di Wi-Fi
pameran bisa berbagi satu alamat.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

import jwt
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .otentikasi import ALGORITMA, mode_pameran, rahasia

METODE_BACA = {"GET", "HEAD", "OPTIONS"}
PESAN_BACA_SAJA = (
    "Ini akun simulasi untuk dilihat-lihat, jadi perubahan tidak disimpan. "
    "Daftar akun sendiri untuk mencobanya sungguhan."
)
PESAN_TERLALU_SERING = "Terlalu banyak percobaan dari jaringan ini. Tunggu sebentar, lalu coba lagi."

#: Akhiran jalur -> (jumlah percobaan, lama jendela dalam detik).
BATAS_PERCOBAAN = {"/masuk": (60, 60), "/daftar": (10, 600)}
_BATAS_ALAMAT_DIINGAT = 10_000

_percobaan: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def token_baca_saja(request: Request) -> bool:
    kepala = request.headers.get("authorization", "")
    if not kepala.lower().startswith("bearer "):
        return False
    try:
        isi = jwt.decode(kepala[7:], rahasia(), algorithms=[ALGORITMA])
    except jwt.InvalidTokenError:
        # Token rusak atau kedaluwarsa dijawab rutenya sendiri, dengan 401.
        return False
    return bool(isi.get("baca_saja"))


def _terlalu_sering(request: Request) -> bool:
    batas = next((b for akhiran, b in BATAS_PERCOBAAN.items() if request.url.path.endswith(akhiran)), None)
    if batas is None:
        return False
    jumlah, jendela = batas
    # Di belakang Cloudflare Tunnel semua permintaan datang dari kontainer tunnel.
    alamat = request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")
    if len(_percobaan) > _BATAS_ALAMAT_DIINGAT:
        _percobaan.clear()
    catatan = _percobaan[(request.url.path, alamat)]
    sekarang = time.monotonic()
    while catatan and sekarang - catatan[0] > jendela:
        catatan.popleft()
    if len(catatan) >= jumlah:
        return True
    catatan.append(sekarang)
    return False


def pasang(app: FastAPI) -> None:
    """Panggil sebelum CORS dipasang: CORS harus di luar, supaya penolakan tetap terbaca peramban."""

    @app.middleware("http")
    async def jaga(request: Request, lanjut):
        if request.method not in METODE_BACA:
            jalur = request.url.path
            if not jalur.startswith("/auth/") and token_baca_saja(request):
                return JSONResponse({"detail": PESAN_BACA_SAJA, "baca_saja": True}, status_code=403)
            if jalur.startswith("/auth/") and mode_pameran() and _terlalu_sering(request):
                return JSONResponse({"detail": PESAN_TERLALU_SERING}, status_code=429)
        return await lanjut(request)
