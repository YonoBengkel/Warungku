"""
Otentikasi: satu tabel identitas, dua pintu masuk, dua jenis token.

**Satu tabel `pengguna`, bukan dua.** Dua tabel identitas terpisah berarti satu
email bisa ada di keduanya; saat orang lupa kata sandi, sistem tidak tahu akun
mana yang dimaksud. Lebih buruk lagi, kode hash, reset, dan verifikasi harus
ditulis dua kali — dua tempat untuk cacat keamanan yang sama.

**Dua pintu masuk.** `/auth/umkm/masuk` dan `/auth/distributor/masuk`. Akun
distributor yang salah masuk ke pintu UMKM ditolak dengan *"akun ini terdaftar
sebagai distributor"*, bukan *"kata sandi salah"* — orang yang tersesat di
portal yang salah tidak akan menebak sendiri.

**Dua jenis token.** Token UMKM membawa `usaha_id`; token distributor membawa
`distributor_id`. Portal distributor tidak bisa dibuka dengan token UMKM
walaupun alamatnya ditebak. Inilah pemisahan yang sebenarnya; dua pintu tanpa
dua token hanya pemisahan di layar.

OTP WhatsApp ditunda sesuai keputusan tim. Yang dipasang sekarang email +
kata sandi. Kolom `nomor_hp` sudah ada dan tidak perlu diubah saat OTP masuk.

**Rahasia token dibaca dari lingkungan.** Kalau `WARUNGKU_RAHASIA` tidak diisi,
sebuah rahasia acak dibuat saat proses mulai — artinya token hangus setiap kali
layanan dimuat ulang. Itu merepotkan saat mengembangkan, dan memang disengaja:
jauh lebih baik daripada rahasia bawaan yang ikut terpasang ke mana-mana.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.model import Distributor, Keanggotaan, Pengguna, Usaha

ALGORITMA = "HS256"
UMUR_TOKEN = timedelta(hours=12)

_pengacak = PasswordHasher()
_skema = HTTPBearer(auto_error=False)


def rahasia() -> str:
    nilai = os.environ.get("WARUNGKU_RAHASIA")
    if nilai:
        return nilai
    # Dibuat sekali per proses, lalu disimpan di lingkungan supaya pekerja
    # uvicorn yang sama tetap sepakat.
    if "_WARUNGKU_RAHASIA_SEMENTARA" not in os.environ:
        os.environ["_WARUNGKU_RAHASIA_SEMENTARA"] = secrets.token_urlsafe(48)
    return os.environ["_WARUNGKU_RAHASIA_SEMENTARA"]


def acak_kata_sandi(kata_sandi: str) -> str:
    return _pengacak.hash(kata_sandi)


def cocok(hash_tersimpan: str, kata_sandi: str) -> bool:
    try:
        _pengacak.verify(hash_tersimpan, kata_sandi)
        return True
    except (VerifyMismatchError, Exception):
        return False


# --------------------------------------------------------------------------
class Masuk(BaseModel):
    """
    Kredensial untuk masuk.

    `email` di sini sengaja **str biasa**, bukan `EmailStr`. Masuk hanyalah
    pencarian nilai yang sudah tersimpan; menolak akun yang sudah ada karena
    pemeriksa alamat tidak menyukai domainnya adalah menolak kenyataan. Data
    contoh kami memakai domain `.test` — domain yang justru DICADANGKAN untuk
    pengujian oleh RFC 2606 — dan `EmailStr` menolaknya.

    Pemeriksaan ketat tempatnya di `Daftar`, saat alamat baru dibuat.
    """

    email: str = Field(min_length=5, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    kata_sandi: str = Field(min_length=6, max_length=128)


class Daftar(BaseModel):
    #: Ketat di sini: salah ketik alamat saat mendaftar berarti akun yang tidak
    #: bisa dipulihkan kalau kata sandinya lupa.
    email: EmailStr
    kata_sandi: str = Field(min_length=6, max_length=128)
    nama: str = Field(min_length=2, max_length=120)
    nomor_hp: str = Field(min_length=8, max_length=20)
    nama_usaha: str = Field(min_length=2, max_length=120)
    jenis_usaha: str = Field(min_length=2, max_length=30)
    kota: str = Field(min_length=2, max_length=80)
    alamat: str = Field(min_length=4)


class Token(BaseModel):
    token: str
    jenis: str = "bearer"
    peran: str
    pengguna_id: int
    nama: str
    usaha_id: int | None = None
    distributor_id: int | None = None
    kedaluwarsa_pada: datetime


class Identitas(BaseModel):
    pengguna_id: int
    peran: str
    usaha_id: int | None = None
    distributor_id: int | None = None


def _buat_token(pengguna: Pengguna, peran: str, **tambahan) -> Token:
    kedaluwarsa = datetime.now(timezone.utc) + UMUR_TOKEN
    isi = {
        "sub": str(pengguna.id),
        "peran": peran,
        "exp": kedaluwarsa,
        **{k: v for k, v in tambahan.items() if v is not None},
    }
    return Token(
        token=jwt.encode(isi, rahasia(), algorithm=ALGORITMA),
        peran=peran,
        pengguna_id=pengguna.id,
        nama=pengguna.nama,
        kedaluwarsa_pada=kedaluwarsa,
        **tambahan,
    )


def identitas(
    kredensial: HTTPAuthorizationCredentials | None = Depends(_skema),
) -> Identitas:
    """Baca token dari header. Dipakai sebagai dependency FastAPI."""
    if kredensial is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Butuh token.")
    try:
        isi = jwt.decode(kredensial.credentials, rahasia(), algorithms=[ALGORITMA])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token kedaluwarsa, masuk lagi.")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token tidak sah.")
    return Identitas(
        pengguna_id=int(isi["sub"]),
        peran=isi["peran"],
        usaha_id=isi.get("usaha_id"),
        distributor_id=isi.get("distributor_id"),
    )


def usaha_saya(usaha_id: int = Path(ge=1), saya: Identitas = Depends(identitas)) -> int:
    """
    Pastikan token memang milik usaha yang ada di alamat.

    **Inilah yang menutup lubang terbesar sebelum ini:** setiap endpoint
    menerima `usaha_id` dari URL dan mempercayainya, jadi siapa pun bisa
    membaca stok usaha mana pun hanya dengan mengganti angka di alamat.
    """
    if saya.peran != "umkm" or saya.usaha_id != usaha_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token ini bukan untuk usaha tersebut.")
    return usaha_id


def distributor_saya(
    distributor_id: int = Path(ge=1), saya: Identitas = Depends(identitas)
) -> int:
    if saya.peran != "distributor" or saya.distributor_id != distributor_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Token ini bukan untuk distributor tersebut."
        )
    return distributor_id


# --------------------------------------------------------------------------
rute = APIRouter(prefix="/auth", tags=["otentikasi"])


@rute.post("/umkm/daftar", response_model=Token, status_code=201)
def daftar_umkm(badan: Daftar) -> Token:
    """Buat akun pemilik usaha beserta usahanya. Satu akun, satu usaha."""
    from warungku.enum import CaraHitungStok, JenisUsaha, PeranPengguna, StatusVerifikasi

    with Session(mesin()) as sesi:
        ada = sesi.exec(select(Pengguna).where(Pengguna.email == badan.email)).first()
        if ada is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email ini sudah terdaftar.")
        try:
            jenis = JenisUsaha(badan.jenis_usaha)
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Jenis usaha tidak dikenal.")

        pengguna = Pengguna(
            nomor_hp=badan.nomor_hp,
            email=badan.email,
            kata_sandi_hash=acak_kata_sandi(badan.kata_sandi),
            nama=badan.nama,
        )
        sesi.add(pengguna)
        sesi.flush()

        usaha = Usaha(
            nama=badan.nama_usaha,
            jenis_usaha=jenis,
            nama_pemilik=badan.nama,
            alamat=badan.alamat,
            kota=badan.kota,
            nomor_hp=badan.nomor_hp,
            email=badan.email,
            cara_hitung=CaraHitungStok.KEMASAN,
            verifikasi=StatusVerifikasi.MENUNGGU,
            bergabung_sejak=datetime.now(timezone.utc).date(),
        )
        sesi.add(usaha)
        sesi.flush()
        sesi.add(
            Keanggotaan(pengguna_id=pengguna.id, usaha_id=usaha.id, peran=PeranPengguna.PEMILIK)
        )
        sesi.commit()
        return _buat_token(pengguna, "umkm", usaha_id=usaha.id)


@rute.post("/umkm/masuk", response_model=Token)
def masuk_umkm(badan: Masuk) -> Token:
    with Session(mesin()) as sesi:
        pengguna = sesi.exec(select(Pengguna).where(Pengguna.email == badan.email)).first()
        if pengguna is None or not cocok(pengguna.kata_sandi_hash, badan.kata_sandi):
            # Pesan yang sama untuk email tidak ada dan kata sandi salah:
            # membedakannya memberi tahu penebak bahwa emailnya benar.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email atau kata sandi salah.")
        if not pengguna.aktif:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun ini tidak aktif.")

        anggota = sesi.exec(
            select(Keanggotaan).where(Keanggotaan.pengguna_id == pengguna.id)
        ).first()
        if anggota is None:
            punya_distributor = sesi.exec(
                select(Distributor).where(Distributor.pengguna_id == pengguna.id)
            ).first()
            if punya_distributor is not None:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Akun ini terdaftar sebagai distributor. Masuk lewat portal distributor.",
                )
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun ini belum punya usaha.")
        return _buat_token(pengguna, "umkm", usaha_id=anggota.usaha_id)


@rute.post("/distributor/masuk", response_model=Token)
def masuk_distributor(badan: Masuk) -> Token:
    with Session(mesin()) as sesi:
        pengguna = sesi.exec(select(Pengguna).where(Pengguna.email == badan.email)).first()
        if pengguna is None or not cocok(pengguna.kata_sandi_hash, badan.kata_sandi):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email atau kata sandi salah.")
        if not pengguna.aktif:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun ini tidak aktif.")

        dist = sesi.exec(
            select(Distributor).where(Distributor.pengguna_id == pengguna.id)
        ).first()
        if dist is None:
            punya_usaha = sesi.exec(
                select(Keanggotaan).where(Keanggotaan.pengguna_id == pengguna.id)
            ).first()
            if punya_usaha is not None:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Akun ini terdaftar sebagai pemilik usaha. Masuk lewat portal UMKM.",
                )
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun ini bukan distributor.")
        return _buat_token(pengguna, "distributor", distributor_id=dist.id)


@rute.get("/saya", response_model=Identitas)
def saya(ident: Identitas = Depends(identitas)) -> Identitas:
    """Siapa pemegang token ini. Dipakai frontend untuk memulihkan sesi."""
    return ident
