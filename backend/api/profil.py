"""
Profil usaha untuk portal UMKM (audit 3 Nov 2026).

    GET   /usaha/{u}/profil   profil usaha yang sedang masuk
    PATCH /usaha/{u}/profil   ubahan sebagian dari Akun: Profil Usaha, Data Usaha, Cara Hitung Stok

Dulu layar Akun memakai profil data contoh dan Simpan hanya mengubah peramban.
Kolomnya sudah ada di tabel `usaha` sejak skema awal, jadi tidak ada migrasi.

Status verifikasi tidak bisa diisi pemilik usaha. `ajukan_verifikasi` hanya
mengembalikannya ke "menunggu", seperti Kirim Ulang di layar Data Usaha.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from warungku.basis_data import mesin
from warungku.enum import CaraHitungStok, JenisUsaha, StatusVerifikasi
from warungku.model import Usaha

from .otentikasi import usaha_saya
from .skema import ProfilUsahaLengkap, UbahProfilUsaha

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["profil"])

#: Kolom teks yang kosongnya disimpan sebagai NULL, bukan string kosong.
BOLEH_KOSONG = ("nib", "npwp", "email", "bio")


def _lengkap(u: Usaha) -> ProfilUsahaLengkap:
    # Enum dibaca sebagai teks, apa pun bentuk yang dikembalikan basis data.
    teks = {k: str(getattr(getattr(u, k), "value", getattr(u, k))) for k in ("jenis_usaha", "cara_hitung", "verifikasi")}
    return ProfilUsahaLengkap.model_validate(u).model_copy(update=teks)


@rute.get("/profil", response_model=ProfilUsahaLengkap)
def profil(usaha_id: int = Depends(usaha_saya)) -> ProfilUsahaLengkap:
    with Session(mesin()) as sesi:
        u = sesi.get(Usaha, usaha_id)
        if u is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        return _lengkap(u)


@rute.patch("/profil", response_model=ProfilUsahaLengkap)
def ubah_profil(badan: UbahProfilUsaha, usaha_id: int = Depends(usaha_saya)) -> ProfilUsahaLengkap:
    ubahan = badan.model_dump(exclude_unset=True, exclude={"ajukan_verifikasi"})
    for kolom, nilai in list(ubahan.items()):
        if isinstance(nilai, str):
            ubahan[kolom] = nilai = nilai.strip()
        if nilai in (None, "") and kolom not in BOLEH_KOSONG:
            raise HTTPException(422, f'Isian "{kolom}" tidak boleh kosong.')
        if nilai == "":
            ubahan[kolom] = None
    with Session(mesin()) as sesi:
        u = sesi.get(Usaha, usaha_id)
        if u is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        if "jenis_usaha" in ubahan:
            ubahan["jenis_usaha"] = JenisUsaha(ubahan["jenis_usaha"])
        if "cara_hitung" in ubahan:
            ubahan["cara_hitung"] = CaraHitungStok(ubahan["cara_hitung"])
        for kolom, nilai in ubahan.items():
            setattr(u, kolom, nilai)
        if badan.ajukan_verifikasi:
            u.verifikasi = StatusVerifikasi.MENUNGGU
        sesi.add(u)
        sesi.commit()
        sesi.refresh(u)
        return _lengkap(u)
