"""
Tulis stok dari layar Portal UMKM (audit 3 Nov 2026).

Sampai audit itu, Tambah Barang, Ubah Barang, Koreksi Stok, Catat Pemakaian,
Batas Aman, dan Kelola Kategori hanya mengubah data di peramban: toastnya
menulis "tersimpan", lalu semuanya hilang saat halaman dimuat ulang.

Invarian `api.gudang` berlaku juga di sini: stok barang sama dengan jumlah semua
pergerakannya. Stok awal barang baru dan hasil hitung rak dicatat sebagai
pergerakan `koreksi`, yang tidak masuk data latih Mesin 1. Pemakaian manual
dicatat sebagai `terjual`, seperti nota kasir.
"""

from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import JenisPergerakan, SumberBatasAman
from warungku.model import Barang, Kemasan, Pengguna, Pergerakan, Usaha

from .gudang import ringkas_barang
from .otentikasi import Identitas, identitas, usaha_saya
from .skema import (
    BarangMasuk,
    BarangRingkas,
    BarangUbah,
    DaftarIdBarang,
    GantiKategori,
    HasilPemakaian,
    HasilUbahBanyak,
    KemasanMasuk,
    KoreksiStok,
    PemakaianMasuk,
)

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["stok"])
WIB = timezone(timedelta(hours=7))


def tambah_permintaan(sesi: Session, usaha_id: int, b: Barang, tanggal: date, jumlah: Decimal) -> None:
    """
    Tambah permintaan satu barang pada satu hari, bahan yang dibaca Mesin 1. Dipanggil
    sesudah `b.stok` dipotong. Dipakai pemakaian manual dan sesi masak di Produksi.
    """
    from dataset.kalender import hari_libur, sedang_ramadan
    from dataset.pola import pekan_gajian

    sesi.exec(
        text(
            """
            INSERT INTO permintaan_harian
                (usaha_id, barang_id, tanggal, jumlah, stok_habis, hari_libur, pekan_gajian, ramadan, promo_aktif)
            VALUES (:u, :b, :t, :n, :h, :l, :g, :r, false)
            ON CONFLICT (usaha_id, barang_id, tanggal) DO UPDATE
               SET jumlah = permintaan_harian.jumlah + EXCLUDED.jumlah,
                   stok_habis = permintaan_harian.stok_habis OR EXCLUDED.stok_habis
            """
        ).bindparams(
            u=usaha_id, b=b.id, t=tanggal, n=jumlah, h=b.stok <= 0,
            l=hari_libur(tanggal), g=pekan_gajian(tanggal), r=sedang_ramadan(tanggal),
        )
    )


def _nama(sesi: Session, saya: Identitas) -> str:
    p = sesi.get(Pengguna, saya.pengguna_id)
    return p.nama if p and p.nama else "Pemilik usaha"


def _barang(sesi: Session, usaha_id: int, barang_id: int, kunci: bool = False) -> Barang:
    q = select(Barang).where(Barang.id == barang_id, Barang.usaha_id == usaha_id)
    b = sesi.exec(q.with_for_update() if kunci else q).first()
    if b is None:
        raise HTTPException(404, "Barang tidak ditemukan di usaha ini.")
    return b


def _satu(sesi: Session, usaha_id: int, barang_id: int) -> BarangRingkas:
    return next(b for b in ringkas_barang(sesi, usaha_id) if b.id == barang_id)


def _kode_dipakai(sesi: Session, usaha_id: int, kode: str, kecuali: int | None = None) -> bool:
    q = select(Barang.id).where(Barang.usaha_id == usaha_id, Barang.kode_barang == kode)
    return any(i != kecuali for i in sesi.exec(q).all())


def _pasang_kemasan(sesi: Session, barang_id: int, kemasan: list[KemasanMasuk]) -> None:
    nama = [k.nama.strip().lower() for k in kemasan]
    if len(set(nama)) != len(nama):
        raise HTTPException(422, "Dua kemasan memakai nama yang sama. Beri nama berbeda, misalnya dus dan pak.")
    for k in kemasan:
        sesi.add(Kemasan(barang_id=barang_id, nama=k.nama.strip(), isi=k.isi))


def _bersih(nama_lain: list[str]) -> list[str]:
    hasil: list[str] = []
    for n in (x.strip() for x in nama_lain):
        if n and n.lower() not in (h.lower() for h in hasil):
            hasil.append(n[:60])
    return hasil


@rute.post("/barang", status_code=201, response_model=BarangRingkas)
def tambah_barang(
    badan: BarangMasuk, usaha_id: int = Depends(usaha_saya), saya: Identitas = Depends(identitas)
) -> BarangRingkas:
    with Session(mesin()) as sesi:
        if sesi.get(Usaha, usaha_id) is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        kode = badan.kode_barang.strip()
        if kode and _kode_dipakai(sesi, usaha_id, kode):
            raise HTTPException(409, f"Kode {kode} sudah dipakai barang lain. Kosongkan saja supaya dibuatkan otomatis.")
        if badan.ingatkan_kedaluwarsa and badan.kedaluwarsa is None:
            raise HTTPException(422, "Pengingat kedaluwarsa butuh tanggalnya. Isi tanggal, misalnya 30 Desember 2026.")
        b = Barang(
            usaha_id=usaha_id,
            nama=badan.nama.strip(),
            deskripsi=(badan.deskripsi or "").strip() or None,
            nama_lain=_bersih(badan.nama_lain),
            kategori=badan.kategori.strip(),
            # Kode sementara yang unik; kode kosong diganti kode dari id sesudah flush.
            kode_barang=kode or f"B-{secrets.token_hex(4)}",
            satuan=badan.satuan.strip(),
            satuan_tampil=badan.satuan_tampil,
            stok=badan.stok_awal,
            batas_aman=badan.batas_aman,
            batas_aman_saran=badan.batas_aman,
            sumber_batas_aman=SumberBatasAman(badan.sumber_batas_aman),
            hari_kirim=badan.hari_kirim,
            ingatkan_kedaluwarsa=badan.ingatkan_kedaluwarsa,
            kedaluwarsa=badan.kedaluwarsa if badan.ingatkan_kedaluwarsa else None,
            dicatat_manual=badan.dicatat_manual,
            catatan=(badan.catatan or "").strip() or None,
        )
        sesi.add(b)
        sesi.flush()
        if not kode:
            b.kode_barang = f"B{b.id:05d}"
        _pasang_kemasan(sesi, b.id, badan.kemasan)
        if badan.stok_awal > 0:
            sesi.add(
                Pergerakan(
                    usaha_id=usaha_id, barang_id=b.id, waktu=datetime.now(timezone.utc), jenis=JenisPergerakan.KOREKSI,
                    jumlah=badan.stok_awal, stok_sesudah=badan.stok_awal, keterangan="Stok awal saat barang ditambahkan",
                    oleh=_nama(sesi, saya),
                )
            )
        sesi.commit()
        return _satu(sesi, usaha_id, b.id)


@rute.patch("/barang/{barang_id}", response_model=BarangRingkas)
def ubah_barang(
    badan: BarangUbah, barang_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)
) -> BarangRingkas:
    isi = badan.model_dump(exclude_unset=True)
    with Session(mesin()) as sesi:
        b = _barang(sesi, usaha_id, barang_id, kunci=True)
        if "satuan" in isi and isi["satuan"] != b.satuan:
            ada_riwayat = sesi.exec(
                text("SELECT EXISTS (SELECT 1 FROM pergerakan WHERE barang_id = :b)").bindparams(b=b.id)
            ).scalar()
            if ada_riwayat:
                raise HTTPException(
                    422,
                    "Satuan barang yang sudah punya riwayat stok tidak bisa diganti, karena angka stoknya ikut berubah arti. "
                    "Buat barang baru untuk satuan lain, misalnya Gula Pasir (kg).",
                )
        if "kode_barang" in isi and _kode_dipakai(sesi, usaha_id, isi["kode_barang"].strip(), kecuali=b.id):
            raise HTTPException(409, f"Kode {isi['kode_barang'].strip()} sudah dipakai barang lain.")
        if isi.get("ingatkan_kedaluwarsa") and (isi.get("kedaluwarsa") or b.kedaluwarsa) is None:
            raise HTTPException(422, "Pengingat kedaluwarsa butuh tanggalnya. Isi tanggal, misalnya 30 Desember 2026.")
        for kolom in ("nama", "kategori", "kode_barang", "satuan"):
            if kolom in isi and isi[kolom] is not None:
                setattr(b, kolom, isi[kolom].strip())
        for kolom in ("deskripsi", "catatan"):
            if kolom in isi:
                setattr(b, kolom, (isi[kolom] or "").strip() or None)
        if "nama_lain" in isi and isi["nama_lain"] is not None:
            b.nama_lain = _bersih(isi["nama_lain"])
        for kolom in ("satuan_tampil", "batas_aman", "hari_kirim", "ingatkan_kedaluwarsa", "kedaluwarsa", "dicatat_manual"):
            if kolom in isi and (isi[kolom] is not None or kolom in ("satuan_tampil", "kedaluwarsa")):
                setattr(b, kolom, isi[kolom])
        if "sumber_batas_aman" in isi and isi["sumber_batas_aman"] is not None:
            b.sumber_batas_aman = SumberBatasAman(isi["sumber_batas_aman"])
        if b.ingatkan_kedaluwarsa is False:
            b.kedaluwarsa = None
        if badan.kemasan is not None:
            sesi.exec(text("DELETE FROM kemasan WHERE barang_id = :b").bindparams(b=b.id))
            _pasang_kemasan(sesi, b.id, badan.kemasan)
        sesi.add(b)
        sesi.commit()
        return _satu(sesi, usaha_id, b.id)


@rute.post("/barang/{barang_id}/koreksi", response_model=BarangRingkas)
def koreksi_stok(
    badan: KoreksiStok,
    barang_id: int = Path(ge=1),
    usaha_id: int = Depends(usaha_saya),
    saya: Identitas = Depends(identitas),
) -> BarangRingkas:
    """Stok hasil hitung rak. Selisihnya dicatat sebagai pergerakan koreksi."""
    with Session(mesin()) as sesi:
        b = _barang(sesi, usaha_id, barang_id, kunci=True)
        selisih = badan.stok - b.stok
        if selisih != 0:
            sesi.add(
                Pergerakan(
                    usaha_id=usaha_id, barang_id=b.id, waktu=datetime.now(timezone.utc), jenis=JenisPergerakan.KOREKSI,
                    jumlah=selisih, stok_sesudah=badan.stok, keterangan=(badan.keterangan or "").strip() or "Koreksi stok",
                    oleh=_nama(sesi, saya),
                )
            )
            b.stok = badan.stok
            sesi.add(b)
            sesi.commit()
        return _satu(sesi, usaha_id, b.id)


@rute.post("/pemakaian", response_model=HasilPemakaian)
def catat_pemakaian(
    badan: PemakaianMasuk, usaha_id: int = Depends(usaha_saya), saya: Identitas = Depends(identitas)
) -> HasilPemakaian:
    """
    Pemakaian hari ini yang dicatat dengan tangan. Seperti nota kasir, yang dipotong
    paling banyak sisa stoknya, dan barang yang terhubung kasir ikut menambah
    permintaan harian hari itu. Barang `dicatat_manual` tidak masuk ke sana.
    """
    sekarang = datetime.now(timezone.utc)
    tanggal = sekarang.astimezone(WIB).date()
    kurang: list[str] = []
    tercatat = 0
    with Session(mesin()) as sesi:
        oleh = _nama(sesi, saya)
        for baris in badan.baris:
            b = _barang(sesi, usaha_id, baris.barang_id, kunci=True)
            potong = min(baris.jumlah, max(b.stok, 0))
            if baris.jumlah > b.stok:
                kurang.append(b.nama)
            if potong <= 0:
                continue
            b.stok -= potong
            sesi.add(b)
            sesi.add(
                Pergerakan(
                    usaha_id=usaha_id, barang_id=b.id, waktu=sekarang, jenis=JenisPergerakan.TERJUAL, jumlah=-potong,
                    stok_sesudah=b.stok, keterangan="Pemakaian dicatat manual", oleh=oleh,
                )
            )
            if not b.dicatat_manual:
                tambah_permintaan(sesi, usaha_id, b, tanggal, potong)
            tercatat += 1
        sesi.commit()
    return HasilPemakaian(tercatat=tercatat, stok_kurang=kurang)


@rute.post("/batas-aman/ikut-saran", response_model=HasilUbahBanyak)
def batas_aman_ikut_saran(badan: DaftarIdBarang, usaha_id: int = Depends(usaha_saya)) -> HasilUbahBanyak:
    """Batas aman beberapa barang sekaligus mengikuti saran sistem. Barang tanpa saran dilewati."""
    with Session(mesin()) as sesi:
        n = sesi.exec(
            text(
                """
                UPDATE barang SET batas_aman = batas_aman_saran, sumber_batas_aman = 'sistem'
                 WHERE usaha_id = :u AND id = ANY(:ids) AND batas_aman_saran > 0
                """
            ).bindparams(u=usaha_id, ids=badan.barang_id)
        ).rowcount
        sesi.commit()
    return HasilUbahBanyak(diubah=n)


@rute.post("/kategori/ganti", response_model=HasilUbahBanyak)
def ganti_kategori(badan: GantiKategori, usaha_id: int = Depends(usaha_saya)) -> HasilUbahBanyak:
    """Ganti nama satu kategori, atau gabungkan beberapa kategori ke satu nama."""
    with Session(mesin()) as sesi:
        n = sesi.exec(
            text("UPDATE barang SET kategori = :ke WHERE usaha_id = :u AND kategori = ANY(:dari)").bindparams(
                u=usaha_id, ke=badan.ke.strip(), dari=[d.strip() for d in badan.dari]
            )
        ).rowcount
        sesi.commit()
    return HasilUbahBanyak(diubah=n)
