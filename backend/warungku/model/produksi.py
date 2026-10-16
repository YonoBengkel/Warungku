"""
Lapis 3b — produksi dan penjualan antarusaha (B2B) satu UMKM produsen.

Diminta dosen pengampu (16 Okt 2026): selain warung yang menjual menu, aplikasi
harus bisa melayani UMKM yang MEMPRODUKSI barang, misalnya sambal goreng buatan
ibu-ibu rumahan yang dijual ke ritel modern seperti Indomaret.

Alurnya tiga langkah, dan ketiganya meninggalkan jejak:

1. **Beli bahan baku** dari distributor: jalur yang sudah ada (`pesanan`,
   `pergerakan` jenis `masuk`).
2. **Produksi**: satu sesi masak (`produksi`) memotong bahan baku sesuai
   `resep_bahan` dan menambah stok barang jadi (`produk_jadi.stok`). Bahan baku
   yang terpakai ditulis sebagai `pergerakan` jenis `terjual` dengan
   `produksi_id` terisi. Jenisnya sengaja `terjual`: bagi gudang bahan baku,
   "dipakai produksi" sama artinya dengan "laku" di warung, yaitu pemakaian yang
   harus diramal Mesin 1. Dengan begitu `permintaan_harian` dan Mesin 1 bekerja
   tanpa perubahan apa pun.
3. **Jual ke usaha lain** (`penjualan`, `penjualan_baris`) kepada `pembeli`
   (ritel, toko oleh-oleh, katering): stok barang jadi berkurang.

Stok barang jadi disimpan sebagai nilai berjalan, sama seperti `barang.stok`.
Penjaganya: stok = jumlah produksi - jumlah penjualan, diperiksa oleh
`skrip/02_periksa_konsistensi.sql`.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Index, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from .dasar import bawaan, kolom_dibuat_pada, kolom_jumlah, kolom_uang, kolom_waktu


class ProdukJadi(SQLModel, table=True):
    """Barang hasil produksi yang dijual ke usaha lain, mis. "Sambal Bawang 200 g"."""

    __tablename__ = "produk_jadi"
    __table_args__ = (
        UniqueConstraint("usaha_id", "nama", name="uq_produk_jadi_nama"),
        CheckConstraint("stok >= 0", name="ck_produk_jadi_stok_tak_negatif"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id", index=True)
    nama: str = Field(max_length=120)
    #: Satuan jual: "toples", "pouch", "botol".
    satuan: str = Field(max_length=20)
    #: Isi bersih satu satuan, untuk dibaca orang: "200 g".
    isi_bersih: str | None = Field(default=None, max_length=40)
    stok: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    batas_aman: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    #: Harga jual ke pembeli usaha, per satuan.
    harga_jual: int = Field(sa_column=kolom_uang(nullable=False, server_default="0"))
    #: Berapa satuan yang biasanya dibuat dalam satu sesi masak.
    ukuran_sesi: int = Field(default=60, **bawaan(60))
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class ResepBahan(SQLModel, table=True):
    """Satu bahan untuk SATU satuan produk jadi, dalam satuan dasar barang."""

    __tablename__ = "resep_bahan"
    __table_args__ = (
        UniqueConstraint("produk_jadi_id", "barang_id", name="uq_resep_bahan"),
        CheckConstraint("takaran > 0", name="ck_resep_takaran_positif"),
    )

    id: int | None = Field(default=None, primary_key=True)
    produk_jadi_id: int = Field(foreign_key="produk_jadi.id", index=True)
    barang_id: int = Field(foreign_key="barang.id", index=True)
    takaran: Decimal = Field(sa_column=kolom_jumlah(nullable=False))


class Produksi(SQLModel, table=True):
    """Satu sesi masak: sekian satuan produk jadi, memotong bahan sesuai resep."""

    __tablename__ = "produksi"
    __table_args__ = (
        Index("ix_produksi_usaha_waktu", "usaha_id", "waktu"),
        CheckConstraint("jumlah > 0", name="ck_produksi_jumlah_positif"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    produk_jadi_id: int = Field(foreign_key="produk_jadi.id", index=True)
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    jumlah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    catatan: str | None = Field(default=None, sa_column=Column(Text))
    oleh: str | None = Field(default=None, max_length=120)
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class Pembeli(SQLModel, table=True):
    """Usaha lain yang membeli produk jadi: ritel modern, toko oleh-oleh, katering."""

    __tablename__ = "pembeli"
    __table_args__ = (UniqueConstraint("usaha_id", "nama", name="uq_pembeli_nama"),)

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id", index=True)
    nama: str = Field(max_length=120)
    #: 'ritel-modern' | 'toko-oleh-oleh' | 'katering' | 'warung'
    jenis: str = Field(max_length=30)
    kota: str | None = Field(default=None, max_length=60)
    #: Kesepakatan singkat, mis. "Pesan tiap Senin, bayar 14 hari".
    ketentuan: str | None = Field(default=None, max_length=200)
    sejak: date | None = Field(default=None)
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class Penjualan(SQLModel, table=True):
    """Satu kiriman produk jadi ke satu pembeli."""

    __tablename__ = "penjualan"
    __table_args__ = (
        UniqueConstraint("usaha_id", "nomor", name="uq_penjualan_nomor"),
        Index("ix_penjualan_usaha_waktu", "usaha_id", "waktu"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    pembeli_id: int = Field(foreign_key="pembeli.id", index=True)
    nomor: str = Field(max_length=40)
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    total: int = Field(sa_column=kolom_uang(nullable=False, server_default="0"))
    catatan: str | None = Field(default=None, sa_column=Column(Text))
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class PenjualanBaris(SQLModel, table=True):
    __tablename__ = "penjualan_baris"
    __table_args__ = (CheckConstraint("jumlah > 0", name="ck_penjualan_jumlah_positif"),)

    id: int | None = Field(default=None, primary_key=True)
    penjualan_id: int = Field(foreign_key="penjualan.id", index=True)
    produk_jadi_id: int = Field(foreign_key="produk_jadi.id", index=True)
    jumlah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    harga_satuan: int = Field(sa_column=kolom_uang(nullable=False))
