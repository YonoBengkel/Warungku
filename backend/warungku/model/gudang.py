"""
Lapis 3 — gudang satu UMKM.

Tabel terpenting di berkas ini adalah `pergerakan`: **buku besar stok yang hanya
bisa ditambah, tidak pernah diubah**. `barang.stok` cuma singgahan (cache) dari
jumlah seluruh pergerakan, dan ada skrip rekonsiliasi yang membandingkan
keduanya.

Tiga hal lahir dari keputusan itu:

* Stok bisa diaudit. "Kenapa sisa kopi jadi 3,4 kg?" selalu punya jawaban.
* `terjual` terpisah dari `koreksi`. Barang basi yang dibuang **tidak pernah**
  terbaca sebagai barang laku, jadi Mesin 1 tidak belajar dari sampah.
* Data latih Mesin 1 lahir di sini, bukan dari kolom stok yang ditimpa.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Index, Text, UniqueConstraint
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import Field, SQLModel

from ..enum import JenisPergerakan, StatusKasir, SumberBatasAman
from .dasar import bawaan, kolom_dibuat_pada, kolom_enum, kolom_jumlah, kolom_uang, kolom_waktu


class Barang(SQLModel, table=True):
    """
    Satu baris stok di gudang UMKM.

    `satuan` adalah satu-satunya satuan tempat angka disimpan. `satuan_tampil`
    hanya mengubah cara angka itu dibacakan ke layar (3.400 gram → 3,4 kg).
    """

    __tablename__ = "barang"
    __table_args__ = (
        UniqueConstraint("usaha_id", "kode_barang", name="uq_barang_kode"),
        Index("ix_barang_usaha", "usaha_id"),
        CheckConstraint("stok >= 0", name="ck_barang_stok_tak_negatif"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    #: Penghubung ke kosakata bersama. Boleh kosong untuk barang yang unik.
    produk_master_id: int | None = Field(default=None, foreign_key="produk_master.id", index=True)

    nama: str = Field(max_length=120)
    #: Ukuran atau varian: "1 liter", "jerigen 5 L", "16 oz".
    deskripsi: str | None = Field(default=None, max_length=160)
    #: Sebutan sehari-hari; ikut dicari supaya "skm" menemukan susu kental manis.
    nama_lain: list[str] = Field(
        default_factory=list, sa_column=Column(ARRAY(String(80)), nullable=False, server_default="{}")
    )
    kategori: str = Field(max_length=60)
    kode_barang: str = Field(max_length=40)
    satuan: str = Field(max_length=10)
    satuan_tampil: str | None = Field(default=None, max_length=20)

    stok: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    batas_aman: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    #: Usulan sistem; Mesin 1 menulisnya sebagai kuantil 90% permintaan selama hari_kirim.
    batas_aman_saran: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    sumber_batas_aman: SumberBatasAman = Field(
        sa_column=kolom_enum(SumberBatasAman, "sumber_batas_aman", nullable=False)
    )

    #: Berapa hari biasanya barang sampai setelah dipesan (lead time).
    hari_kirim: int = Field(default=2, **bawaan(2))
    harga_beli_terakhir: int = Field(sa_column=kolom_uang(nullable=False, server_default="0"))
    #: Hari data pemakaian yang sudah terkumpul; menentukan kematangan perkiraan.
    hari_data_terkumpul: int = Field(default=0, **bawaan(0))

    ingatkan_kedaluwarsa: bool = Field(default=False, **bawaan(False))
    kedaluwarsa: date | None = Field(default=None)
    terhubung_kasir: bool = Field(default=False, **bawaan(False))
    #: Barang yang memang dicatat manual (gas, tisu): DIBUANG dari data latih model.
    dicatat_manual: bool = Field(default=False, **bawaan(False))
    catatan: str | None = Field(default=None, sa_column=Column(Text))


class Kemasan(SQLModel, table=True):
    """Lapisan tampilan: 1 dus = 1.000 pcs. `isi` selalu dalam satuan dasar barang."""

    __tablename__ = "kemasan"
    __table_args__ = (UniqueConstraint("barang_id", "nama", name="uq_kemasan"),)

    id: int | None = Field(default=None, primary_key=True)
    barang_id: int = Field(foreign_key="barang.id", index=True)
    nama: str = Field(max_length=30)
    isi: Decimal = Field(sa_column=kolom_jumlah(nullable=False))


class PemetaanMenu(SQLModel, table=True):
    """
    Jembatan antara nama menu di struk kasir dan bahan di gudang.

    Secara bawaan pemetaannya **1:1** — satu menu memotong satu barang sebanyak
    satu satuan. Itu sudah benar untuk warung kelontong dan barang kemasan siap
    jual, dan itulah yang dipakai sekarang.

    Resep berbilang bahan (satu kopi susu = 15 g biji + 100 ml susu) sudah
    didukung strukturnya lewat `PemetaanMenuBahan`, tapi sengaja belum diisi:
    pemilik proyek memutuskan menu bersifat opsional dan ditunda.
    """

    __tablename__ = "pemetaan_menu"
    __table_args__ = (
        UniqueConstraint("usaha_id", "nama_menu", name="uq_pemetaan_menu"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id", index=True)
    #: Nama menu apa adanya seperti tertulis di struk kasir.
    nama_menu: str = Field(max_length=160)
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class PemetaanMenuBahan(SQLModel, table=True):
    """
    Satu bahan dalam satu menu, beserta takarannya dalam satuan dasar barang.

    Untuk pemetaan 1:1 bawaan, `takaran` = 1 dan hanya ada satu baris per menu.
    """

    __tablename__ = "pemetaan_menu_bahan"
    __table_args__ = (
        UniqueConstraint("pemetaan_id", "barang_id", name="uq_pemetaan_bahan"),
        CheckConstraint("takaran > 0", name="ck_takaran_positif"),
    )

    id: int | None = Field(default=None, primary_key=True)
    pemetaan_id: int = Field(foreign_key="pemetaan_menu.id", index=True)
    barang_id: int = Field(foreign_key="barang.id", index=True)
    takaran: Decimal = Field(sa_column=kolom_jumlah(nullable=False))


class Transaksi(SQLModel, table=True):
    """
    Satu struk dari kasir, apa adanya.

    `UNIQUE(usaha_id, nomor_struk)` adalah **kunci idempotensi**: sinkron yang
    diulang (dan itu pasti terjadi) tidak boleh memotong stok dua kali.
    """

    __tablename__ = "transaksi"
    __table_args__ = (
        UniqueConstraint("usaha_id", "nomor_struk", name="uq_transaksi_struk"),
        Index("ix_transaksi_usaha_waktu", "usaha_id", "waktu"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    nomor_struk: str = Field(max_length=60)
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    kasir: str | None = Field(default=None, max_length=120)
    #: 'pos' | 'impor-csv' | 'catat-manual'
    sumber: str = Field(default="pos", max_length=20, **bawaan("pos"))
    #: Struk batal mengembalikan stok lewat pergerakan balik.
    dibatalkan: bool = Field(default=False, **bawaan(False))
    diproses_pada: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))


class TransaksiBaris(SQLModel, table=True):
    """
    Satu baris struk.

    `harga_jual_satuan` dicatat karena struk memang membawanya — membuang data
    yang sudah diterima itu mubazir, dan nanti ia memungkinkan prediksi arus kas
    tanpa migrasi. Tapi ia **fakta dari POS**, bukan isian aplikasi: tidak ada
    layar yang menyuntingnya, dan `barang` sengaja TIDAK punya kolom harga jual.
    """

    __tablename__ = "transaksi_baris"

    id: int | None = Field(default=None, primary_key=True)
    transaksi_id: int = Field(foreign_key="transaksi.id", index=True)
    nama_menu: str = Field(max_length=160)
    jumlah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    satuan: str = Field(max_length=20)
    harga_jual_satuan: int | None = Field(default=None, sa_column=kolom_uang(nullable=True))


class Pergerakan(SQLModel, table=True):
    """
    Buku besar stok. Hanya ditambah, tidak pernah diubah atau dihapus.

    `jumlah` positif untuk masuk, negatif untuk keluar, dalam satuan dasar.
    Indeks `(usaha_id, barang_id, waktu)` adalah yang paling panas di sistem ini:
    ia dipakai riwayat barang, rekonsiliasi stok, dan pembangunan `permintaan_harian`.
    """

    __tablename__ = "pergerakan"
    __table_args__ = (
        Index("ix_pergerakan_usaha_barang_waktu", "usaha_id", "barang_id", "waktu"),
        Index("ix_pergerakan_jenis_waktu", "jenis", "waktu"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    barang_id: int = Field(foreign_key="barang.id")
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    jenis: JenisPergerakan = Field(
        sa_column=kolom_enum(JenisPergerakan, "jenis_pergerakan", nullable=False)
    )
    jumlah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    stok_sesudah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    keterangan: str | None = Field(default=None, max_length=200)
    #: Asal pergerakan, supaya riwayat bisa diketuk balik ke sumbernya.
    pesanan_id: int | None = Field(default=None, foreign_key="pesanan.id", index=True)
    transaksi_id: int | None = Field(default=None, foreign_key="transaksi.id", index=True)
    #: Bahan baku yang terpakai satu sesi produksi (UMKM produsen).
    produksi_id: int | None = Field(default=None, foreign_key="produksi.id", index=True)
    oleh: str | None = Field(default=None, max_length=120)


class DataKasir(SQLModel, table=True):
    """Keadaan sambungan POS per usaha. Satu baris per usaha."""

    __tablename__ = "data_kasir"
    __table_args__ = (UniqueConstraint("usaha_id", name="uq_data_kasir_usaha"),)

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    status: StatusKasir = Field(
        sa_column=kolom_enum(StatusKasir, "status_kasir", nullable=False)
    )
    merek: str | None = Field(default=None, max_length=60)
    terakhir_masuk: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
