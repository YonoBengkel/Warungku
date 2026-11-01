"""
Kasir Portal POS: akun kasir yang dikelola pemilik, dan shift kas.

* Akun kasir = `pengguna` + `keanggotaan` berperan pegawai. Ia masuk lewat `/auth/pos/masuk`
  dan mendapat token jenis `kasir`, yang hanya diterima endpoint POS (`kasir_atau_pemilik`).
  Mengelola akun kasir hanya untuk pemilik (`usaha_saya`).
* Shift: buka dengan uang modal, tutup dengan uang yang dihitung di laci. Selisih =
  uang dihitung dikurangi (modal + tunai dari nota shift ini). QRIS dan transfer tidak
  masuk laci, jadi tidak ikut dihitung.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import PeranPengguna
from warungku.model import Keanggotaan, Pengguna, ShiftKas

from .otentikasi import Identitas, acak_kata_sandi, identitas, kasir_atau_pemilik, usaha_saya

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["kasir"])


# ---------------------------------------------------------------- akun kasir


class KasirBaru(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    email: EmailStr
    nomor_hp: str = Field(min_length=8, max_length=20)
    kata_sandi: str = Field(min_length=6, max_length=128)


class KasirUbah(BaseModel):
    aktif: bool | None = None
    kata_sandi: str | None = Field(default=None, min_length=6, max_length=128)


class KasirKeluar(BaseModel):
    pengguna_id: int
    nama: str
    email: str | None
    nomor_hp: str
    aktif: bool
    dibuat_pada: datetime | None


def _kasir_keluar(p: Pengguna) -> KasirKeluar:
    return KasirKeluar(pengguna_id=p.id, nama=p.nama, email=p.email, nomor_hp=p.nomor_hp, aktif=p.aktif, dibuat_pada=p.dibuat_pada)


def _kasir_usaha(sesi: Session, usaha_id: int) -> list[Pengguna]:
    return list(
        sesi.exec(
            select(Pengguna)
            .join(Keanggotaan, Keanggotaan.pengguna_id == Pengguna.id)
            .where(Keanggotaan.usaha_id == usaha_id, Keanggotaan.peran == PeranPengguna.PEGAWAI)
            .order_by(Pengguna.nama)
        ).all()
    )


@rute.get("/kasir", response_model=list[KasirKeluar])
def daftar_kasir(usaha_id: int = Depends(usaha_saya)) -> list[KasirKeluar]:
    with Session(mesin()) as sesi:
        return [_kasir_keluar(p) for p in _kasir_usaha(sesi, usaha_id)]


@rute.post("/kasir", response_model=KasirKeluar, status_code=201)
def tambah_kasir(badan: KasirBaru, usaha_id: int = Depends(usaha_saya)) -> KasirKeluar:
    """Pemilik membuat akun kasir. Email dan nomor HP tidak boleh sudah dipakai akun lain."""
    with Session(mesin()) as sesi:
        email = str(badan.email).lower()
        if sesi.exec(select(Pengguna).where(Pengguna.email == email)).first() is not None:
            raise HTTPException(409, "Email ini sudah dipakai akun lain.")
        if sesi.exec(select(Pengguna).where(Pengguna.nomor_hp == badan.nomor_hp)).first() is not None:
            raise HTTPException(409, "Nomor HP ini sudah dipakai akun lain.")
        pengguna = Pengguna(
            nomor_hp=badan.nomor_hp,
            email=email,
            kata_sandi_hash=acak_kata_sandi(badan.kata_sandi),
            nama=badan.nama.strip(),
        )
        sesi.add(pengguna)
        sesi.flush()
        sesi.add(Keanggotaan(pengguna_id=pengguna.id, usaha_id=usaha_id, peran=PeranPengguna.PEGAWAI))
        sesi.commit()
        sesi.refresh(pengguna)
        return _kasir_keluar(pengguna)


@rute.patch("/kasir/{pengguna_id}", response_model=KasirKeluar)
def ubah_kasir(pengguna_id: int, badan: KasirUbah, usaha_id: int = Depends(usaha_saya)) -> KasirKeluar:
    """Nonaktifkan atau aktifkan lagi akun kasir, atau atur ulang kata sandinya."""
    with Session(mesin()) as sesi:
        pengguna = next((p for p in _kasir_usaha(sesi, usaha_id) if p.id == pengguna_id), None)
        if pengguna is None:
            raise HTTPException(404, "Kasir tidak ditemukan di usaha ini.")
        if badan.aktif is not None:
            pengguna.aktif = badan.aktif
        if badan.kata_sandi is not None:
            pengguna.kata_sandi_hash = acak_kata_sandi(badan.kata_sandi)
        sesi.add(pengguna)
        sesi.commit()
        sesi.refresh(pengguna)
        return _kasir_keluar(pengguna)


# ---------------------------------------------------------------------- shift


class BukaShift(BaseModel):
    modal_awal: int = Field(ge=0, le=1_000_000_000)


class TutupShift(BaseModel):
    uang_dihitung: int = Field(ge=0, le=1_000_000_000)
    catatan: str | None = Field(default=None, max_length=200)


class ShiftKeluar(BaseModel):
    id: int
    nama_kasir: str
    dibuka_pada: datetime
    ditutup_pada: datetime | None
    modal_awal: int
    jumlah_nota: int
    tunai: int
    qris: int
    transfer: int
    #: Modal awal ditambah tunai dari nota shift ini.
    tunai_diharapkan: int
    uang_dihitung: int | None
    #: Uang dihitung dikurangi yang diharapkan. Negatif: laci kurang.
    selisih: int | None
    catatan: str | None


_REKAP = """
    SELECT COUNT(*) AS jumlah,
           COALESCE(SUM(bersih) FILTER (WHERE cara_bayar = 'tunai'), 0) AS tunai,
           COALESCE(SUM(bersih) FILTER (WHERE cara_bayar = 'qris'), 0) AS qris,
           COALESCE(SUM(bersih) FILTER (WHERE cara_bayar = 'transfer'), 0) AS transfer
      FROM (
        SELECT t.id, t.cara_bayar,
               GREATEST(COALESCE(SUM(b.jumlah * b.harga_jual_satuan), 0) - t.diskon, 0) AS bersih
          FROM transaksi t JOIN transaksi_baris b ON b.transaksi_id = t.id
         WHERE t.shift_id = :s AND NOT t.dibatalkan
         GROUP BY t.id
      ) n
"""


def _rekap(sesi: Session, shift_id: int) -> tuple[int, int, int, int]:
    r = sesi.exec(text(_REKAP).bindparams(s=shift_id)).one()
    return int(r.jumlah), int(round(r.tunai)), int(round(r.qris)), int(round(r.transfer))


def _shift_keluar(sesi: Session, s: ShiftKas) -> ShiftKeluar:
    """Shift terbuka dihitung langsung. Shift tertutup memakai rekap yang dibekukan saat ditutup."""
    if s.ditutup_pada is None:
        jumlah, tunai, qris, transfer = _rekap(sesi, s.id)
        diharapkan, selisih = s.modal_awal + tunai, None
    else:
        jumlah, tunai, qris, transfer = s.jumlah_nota or 0, s.tunai or 0, s.qris or 0, s.transfer or 0
        diharapkan, selisih = s.tunai_diharapkan or 0, s.selisih
    return ShiftKeluar(
        id=s.id, nama_kasir=s.nama_kasir, dibuka_pada=s.dibuka_pada, ditutup_pada=s.ditutup_pada,
        modal_awal=s.modal_awal, jumlah_nota=jumlah, tunai=tunai, qris=qris, transfer=transfer,
        tunai_diharapkan=diharapkan, uang_dihitung=s.uang_dihitung, selisih=selisih, catatan=s.catatan,
    )


def _shift_terbuka(sesi: Session, usaha_id: int) -> ShiftKas | None:
    return sesi.exec(
        select(ShiftKas).where(ShiftKas.usaha_id == usaha_id, ShiftKas.ditutup_pada == None)  # noqa: E711
        .with_for_update()
    ).first()


@rute.get("/shift/aktif", response_model=ShiftKeluar | None)
def shift_aktif(usaha_id: int = Depends(kasir_atau_pemilik)) -> ShiftKeluar | None:
    with Session(mesin()) as sesi:
        s = _shift_terbuka(sesi, usaha_id)
        return _shift_keluar(sesi, s) if s else None


@rute.post("/shift/buka", response_model=ShiftKeluar, status_code=201)
def buka_shift(
    badan: BukaShift, usaha_id: int = Depends(kasir_atau_pemilik), saya: Identitas = Depends(identitas)
) -> ShiftKeluar:
    with Session(mesin()) as sesi:
        pengguna = sesi.get(Pengguna, saya.pengguna_id)
        s = ShiftKas(
            usaha_id=usaha_id, dibuka_oleh=saya.pengguna_id, nama_kasir=pengguna.nama if pengguna else "Kasir",
            dibuka_pada=datetime.now(timezone.utc), modal_awal=badan.modal_awal,
        )
        sesi.add(s)
        try:
            sesi.commit()
        except IntegrityError:
            sesi.rollback()
            raise HTTPException(409, "Sudah ada shift yang terbuka. Tutup dulu sebelum membuka yang baru.")
        sesi.refresh(s)
        return _shift_keluar(sesi, s)


@rute.post("/shift/tutup", response_model=ShiftKeluar)
def tutup_shift(badan: TutupShift, usaha_id: int = Depends(kasir_atau_pemilik)) -> ShiftKeluar:
    """Tutup shift: bekukan rekap, hitung selisih terhadap uang yang dihitung di laci."""
    with Session(mesin()) as sesi:
        s = _shift_terbuka(sesi, usaha_id)
        if s is None:
            raise HTTPException(409, "Tidak ada shift yang terbuka.")
        jumlah, tunai, qris, transfer = _rekap(sesi, s.id)
        s.ditutup_pada = datetime.now(timezone.utc)
        s.jumlah_nota, s.tunai, s.qris, s.transfer = jumlah, tunai, qris, transfer
        s.tunai_diharapkan = s.modal_awal + tunai
        s.uang_dihitung = badan.uang_dihitung
        s.selisih = badan.uang_dihitung - s.tunai_diharapkan
        s.catatan = (badan.catatan or "").strip() or None
        sesi.add(s)
        sesi.commit()
        sesi.refresh(s)
        return _shift_keluar(sesi, s)


@rute.get("/shift", response_model=list[ShiftKeluar])
def riwayat_shift(
    usaha_id: int = Depends(usaha_saya),
    batas: int = Query(default=10, ge=1, le=50),
    mulai: int = Query(default=0, ge=0, description="Lewati sekian shift terbaru, untuk halaman berikutnya."),
) -> list[ShiftKeluar]:
    """Shift terbaru, untuk pemilik."""
    with Session(mesin()) as sesi:
        daftar = sesi.exec(
            select(ShiftKas)
            .where(ShiftKas.usaha_id == usaha_id)
            .order_by(ShiftKas.dibuka_pada.desc(), ShiftKas.id.desc())
            .limit(batas)
            .offset(mulai)
        ).all()
        return [_shift_keluar(sesi, s) for s in daftar]
