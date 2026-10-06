"""
Lapis 1 & 2 — katalog bersama, identitas, dan penyewa.

`produk_master` adalah kosakata bersama platform. Ia yang membuat dua hal
mungkin, dan keduanya penting:

1. **Perbandingan harga antar distributor.** Tanpa ini, "Telur Ayam" dari
   distributor A dan distributor C adalah dua teks asing yang tidak bisa
   dibandingkan — dan Mesin 2 kehilangan fitur terkuatnya.
2. **Belajar silang untuk Mesin 1.** MOIRAI bisa meminjam pola dari deret lain.
   Kalau 20 warung sama-sama menjual produk master `Kopi Bubuk Robusta`, warung
   ke-21 yang baru buka langsung dapat perkiraan masuk akal meski riwayatnya nol.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Column, String
from sqlmodel import Field, SQLModel

from ..enum import (
    CaraHitungStok,
    JenisUsaha,
    PeranPengguna,
    StatusVerifikasi,
)
from .dasar import bawaan, kolom_dibuat_pada, kolom_enum, kolom_uang, kolom_waktu


# --------------------------------------------------------------------------
# Lapis 1 — katalog bersama
# --------------------------------------------------------------------------
class ProdukMaster(SQLModel, table=True):
    __tablename__ = "produk_master"
    __table_args__ = (
        UniqueConstraint("nama_kanonik", name="uq_produk_master_nama"),
        CheckConstraint(
            "satuan_dasar in ('gram','ml','pcs')", name="ck_produk_master_satuan"
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    nama_kanonik: str = Field(max_length=120)
    kategori: str = Field(max_length=60)
    #: Satuan terkecil tempat stok disimpan untuk produk ini.
    satuan_dasar: str = Field(max_length=10)
    #: Sebutan lain yang dipakai di lapangan: "skm", "gula pasir", "telor".
    sinonim: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String(80)), nullable=False, server_default="{}")
    )


# --------------------------------------------------------------------------
# Lapis 2 — identitas
# --------------------------------------------------------------------------
class Pengguna(SQLModel, table=True):
    """
    Akun. Masuk memakai NOMOR HP, bukan email — itu yang dijanjikan layar Daftar,
    dan itu yang dipunyai pemilik warung.
    """

    __tablename__ = "pengguna"
    __table_args__ = (UniqueConstraint("nomor_hp", name="uq_pengguna_nomor_hp"),)

    id: int | None = Field(default=None, primary_key=True)
    nomor_hp: str = Field(max_length=20)
    email: str | None = Field(default=None, max_length=160)
    kata_sandi_hash: str = Field(max_length=255)
    nama: str = Field(max_length=120)
    aktif: bool = Field(default=True, **bawaan(True))
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class Usaha(SQLModel, table=True):
    """UMKM. Satu usaha bisa dipegang beberapa pengguna lewat `keanggotaan`."""

    __tablename__ = "usaha"

    id: int | None = Field(default=None, primary_key=True)
    nama: str = Field(max_length=120)
    jenis_usaha: JenisUsaha = Field(
        sa_column=kolom_enum(JenisUsaha, "jenis_usaha", nullable=False)
    )
    nama_pemilik: str = Field(max_length=120)
    nib: str | None = Field(default=None, max_length=40)
    npwp: str | None = Field(default=None, max_length=40)
    alamat: str = Field(sa_column=Column(Text, nullable=False))
    #: Dipisah dari alamat karena dipakai mencocokkan area kirim distributor.
    kota: str = Field(max_length=80)
    #: Untuk peta sebaran di portal distributor.
    lat: float | None = Field(default=None)
    lng: float | None = Field(default=None)
    nomor_hp: str = Field(max_length=20)
    email: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, sa_column=Column(Text))
    warna: str = Field(default="#0f766e", max_length=10, **bawaan("#0f766e"))
    cara_hitung: CaraHitungStok = Field(
        sa_column=kolom_enum(CaraHitungStok, "cara_hitung_stok", nullable=False)
    )
    verifikasi: StatusVerifikasi = Field(
        sa_column=kolom_enum(StatusVerifikasi, "status_verifikasi", nullable=False)
    )
    #: 'penuh' kalau NIB terisi dan terverifikasi, 'dasar' kalau tanpa NIB.
    tingkat_verifikasi: str = Field(default="dasar", max_length=10, **bawaan("dasar"))
    bergabung_sejak: date
    # Dua sakelar privasi yang sudah ada di layar Profil Usaha.
    tampilkan_alamat: bool = Field(default=True, **bawaan(True))
    tampilkan_nomor_hp: bool = Field(default=True, **bawaan(True))
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class Keanggotaan(SQLModel, table=True):
    """
    Siapa boleh berbuat apa di satu usaha.

    Tabel terpisah, bukan kolom `peran` di `pengguna`: satu warung punya pemilik
    DAN pegawai, dan layar `/akun/pengguna` sudah menjanjikan itu.
    """

    __tablename__ = "keanggotaan"
    # Satu akun satu usaha, sesuai keputusan pemilik proyek. Perhatikan arahnya:
    # yang dibatasi adalah PENGGUNA, bukan usaha — satu warung tetap boleh punya
    # pemilik dan beberapa pegawai, karena layar `/akun/pengguna` menjanjikan itu.
    #
    # Tabelnya dipertahankan alih-alih memindahkan `usaha_id` ke `pengguna`:
    # kalau nanti berubah pikiran, melonggarkan batasan jauh lebih murah
    # daripada memecah kolom yang sudah dipakai di mana-mana.
    __table_args__ = (
        UniqueConstraint("pengguna_id", name="uq_keanggotaan_pengguna"),
    )

    id: int | None = Field(default=None, primary_key=True)
    pengguna_id: int = Field(foreign_key="pengguna.id", index=True)
    usaha_id: int = Field(foreign_key="usaha.id", index=True)
    peran: PeranPengguna = Field(
        sa_column=kolom_enum(PeranPengguna, "peran_pengguna", nullable=False)
    )


class Distributor(SQLModel, table=True):
    """
    Pemasok. `kategori` dan `area_kirim` bukan hiasan profil — keduanya adalah
    MASUKAN LAPIS 1 Mesin 2 (penyaring kelayakan), jadi ia wajib terstruktur,
    bukan teks bebas.
    """

    __tablename__ = "distributor"

    id: int | None = Field(default=None, primary_key=True)
    pengguna_id: int | None = Field(default=None, foreign_key="pengguna.id", index=True)
    nama: str = Field(max_length=120)
    kota: str = Field(max_length=80)
    deskripsi: str | None = Field(default=None, sa_column=Column(Text))
    warna: str = Field(default="#0f766e", max_length=10, **bawaan("#0f766e"))
    kategori: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String(60)), nullable=False, server_default="{}")
    )
    area_kirim: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String(80)), nullable=False, server_default="{}")
    )
    terverifikasi: bool = Field(default=False, **bawaan(False))
    #: Distributor baru tidak pernah ditampilkan sebagai "0,0 bintang".
    baru: bool = Field(default=True, **bawaan(True))
    sejak: date
    # Info usaha, diisi distributor sendiri di portalnya.
    alamat_gudang: str | None = Field(default=None, sa_column=Column(Text))
    nomor_hp: str | None = Field(default=None, max_length=20)
    jam_operasional: str | None = Field(default=None, max_length=120)
    #: Nilai belanja terkecil per pesanan, rupiah. 0 berarti tanpa minimum.
    minimum_pesanan: int = Field(default=0, sa_column=kolom_uang(nullable=False, server_default="0"))
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class Berkas(SQLModel, table=True):
    """
    Bukti transfer dan foto pengiriman.

    Purwarupa menyimpan keterangannya saja; kolom `url` disiapkan untuk saat
    object storage dipasang, supaya tidak perlu migrasi lagi.
    """

    __tablename__ = "berkas"
    __table_args__ = (Index("ix_berkas_pemilik", "pemilik_tipe", "pemilik_id"),)

    id: int | None = Field(default=None, primary_key=True)
    pemilik_tipe: str = Field(max_length=30)  # 'pesanan' | 'usaha' | ...
    pemilik_id: int
    jenis: str = Field(max_length=30)  # 'bukti-transfer' | 'foto-kirim'
    keterangan: str | None = Field(default=None, sa_column=Column(Text))
    url: str | None = Field(default=None, max_length=500)
    diunggah_pada: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
