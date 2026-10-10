"""
Lapis 5 — tabel yang hanya ditulis layanan model.

Aturan yang memisahkan lapis ini dari sisanya: **layanan model menulis ke tabel,
API membaca tabel.** API tidak pernah memanggil model saat halaman dibuka.
Kalau layanan model mati, halaman tetap terbuka dengan angka terakhir yang
tersimpan, dan `tingkat_layanan` menyatakan apa adanya bahwa angkanya tidak segar.

`permintaan_harian` adalah tabel turunan dari `pergerakan`. Model membaca tabel
ini, bukan buku besar mentah — supaya satu definisi "permintaan" berlaku di
seluruh sistem, dan supaya mengganti model tidak berarti menulis ulang kueri.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Column, Index, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from ..enum import KematanganPerkiraan, TingkatLayanan
from .dasar import bawaan, kolom_enum, kolom_jumlah, kolom_waktu


class PermintaanHarian(SQLModel, table=True):
    """
    Permintaan satu barang pada satu hari, dalam satuan dasar.

    Dibangun dari `pergerakan` berjenis `terjual` saja. Barang `dicatat_manual`
    tidak pernah masuk ke sini.

    `stok_habis` adalah kolom yang paling sering dilupakan orang dan paling
    sering merusak model: saat stok kosong, penjualan tercatat nol — padahal
    permintaannya tidak nol, cuma tidak bisa dilayani. Hari seperti itu ditandai
    di sini supaya model memperlakukannya sebagai **data hilang**, bukan sebagai
    permintaan nol. Tanpa ini, model belajar bahwa barang laris itu tidak laku.
    """

    __tablename__ = "permintaan_harian"
    __table_args__ = (
        UniqueConstraint("usaha_id", "barang_id", "tanggal", name="uq_permintaan_harian"),
        Index("ix_permintaan_barang_tanggal", "barang_id", "tanggal"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    barang_id: int = Field(foreign_key="barang.id")
    tanggal: date
    jumlah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    stok_habis: bool = Field(default=False, **bawaan(False))

    # Kovariat. Disimpan ikut baris supaya layanan model tidak perlu
    # menghitung ulang kalender tiap kali dijalankan.
    hari_libur: bool = Field(default=False, **bawaan(False))
    pekan_gajian: bool = Field(default=False, **bawaan(False))
    ramadan: bool = Field(default=False, **bawaan(False))
    promo_aktif: bool = Field(default=False, **bawaan(False))


class Prediksi(SQLModel, table=True):
    """
    Keluaran Mesin 1: satu baris per barang per hari target.

    Disimpan sebagai **kuantil**, bukan satu angka. p10/p50/p90 itulah yang
    membuat batas aman bisa dihitung dengan dasar yang jelas: batas aman =
    kuantil 90% permintaan selama `hari_kirim`, bukan angka 10 yang dikarang.

    `model_versi` dan `dijalankan_pada` wajib ada. Tanpa keduanya, angka di
    laporan tidak bisa direproduksi tiga minggu kemudian saat sidang.
    """

    __tablename__ = "prediksi"
    __table_args__ = (
        UniqueConstraint("barang_id", "tanggal_target", "jalan_id", name="uq_prediksi"),
        Index("ix_prediksi_usaha_tanggal", "usaha_id", "tanggal_target"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    barang_id: int = Field(foreign_key="barang.id")
    tanggal_target: date
    p10: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    p50: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    p90: Decimal = Field(sa_column=kolom_jumlah(nullable=False))

    #: Satu id untuk satu kali jalan batch, supaya hasil lama tidak tertimpa.
    jalan_id: str = Field(max_length=40)
    model_nama: str = Field(max_length=60)
    model_versi: str = Field(max_length=40)
    dijalankan_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
    kematangan: KematanganPerkiraan = Field(
        sa_column=kolom_enum(KematanganPerkiraan, "kematangan_perkiraan", nullable=False)
    )
    tingkat_layanan: TingkatLayanan = Field(
        sa_column=kolom_enum(TingkatLayanan, "tingkat_layanan", nullable=False)
    )


class FiturPesanan(SQLModel, table=True):
    """
    Satu baris per pesanan selesai: fitur + label. **Tabel latih Mesin 2.**

    TabPFN belajar di dalam konteks — ia tidak menghasilkan berkas model yang
    bisa dipasang. Setiap inferensi harus membawa tabel ini. Karena itu ia
    disimpan sebagai tabel jadi (bukan view): layanan model memuatnya sekali ke
    memori dan menyegarkannya harian, bukan menghitung ulang gabungan lima tabel
    setiap kali seseorang membuka daftar distributor.

    `sukses` adalah label: tepat waktu DAN jumlah sesuai DAN kondisi barang baik.
    """

    __tablename__ = "fitur_pesanan"
    __table_args__ = (
        UniqueConstraint("pesanan_id", name="uq_fitur_pesanan"),
        Index("ix_fitur_pesanan_distributor", "distributor_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    pesanan_id: int = Field(foreign_key="pesanan.id")
    usaha_id: int = Field(foreign_key="usaha.id")
    distributor_id: int = Field(foreign_key="distributor.id")
    tanggal: date

    # --- Fitur distributor (keadaan PADA SAAT pesanan dibuat) ---
    d_aspek_ketepatan: float
    d_aspek_jumlah: float
    d_aspek_kondisi: float
    d_jumlah_ulasan: int
    d_pesanan_selesai: int
    d_umur_hari: int

    # --- Fitur hubungan ---
    h_pernah_kontrak: bool
    h_pesanan_sebelumnya: int

    # --- Fitur pesanan ---
    p_jumlah_item: int
    p_nilai: int
    #: Harga kandidat dibanding kandidat termurah saat itu. 1,0 = termurah.
    p_rasio_harga: float
    p_sekota: bool
    p_hari_pekan: int
    p_bulan: int
    p_musim_hujan: bool
    p_stok_cukup: bool
    p_minimum_terpenuhi: bool

    # --- Label ---
    sukses: bool
    l_tepat_waktu: bool
    l_jumlah_sesuai: bool
    l_kondisi_baik: bool
    #: Selisih hari antara perkiraan tiba dan waktu sampai sungguhan.
    l_telat_hari: int


class RekomendasiSkor(SQLModel, table=True):
    """
    Keluaran Mesin 2, disinggahkan (cache) karena skornya bergantung keadaan
    saat itu: stok, harga, dan promo yang sedang berjalan.
    """

    __tablename__ = "rekomendasi_skor"
    __table_args__ = (
        Index("ix_rekomendasi_usaha_barang", "usaha_id", "barang_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    barang_id: int | None = Field(default=None, foreign_key="barang.id")
    penawaran_id: int = Field(foreign_key="penawaran.id")
    distributor_id: int = Field(foreign_key="distributor.id")

    #: Taksiran peluang pesanan berjalan mulus.
    p_sukses: float
    #: Peringkat akhir: p_sukses x utilitas harga, atau sampel Thompson.
    skor: float
    #: Satu kalimat, bahasa pemilik usaha. Layar menuntutnya.
    alasan: str | None = Field(default=None, sa_column=Column(Text))
    #: Segmen distributor untuk barang ini: "sangat-layak", "layak", atau
    #: "kurang-layak", dari inferensi fuzzy atas keandalan dan harga. Boleh
    #: kosong untuk penaksir yang tidak menghasilkan segmen (BART, logistik).
    segmen: str | None = Field(default=None, max_length=20)

    model_nama: str = Field(max_length=60)
    model_versi: str = Field(max_length=40)
    dijalankan_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
    kedaluwarsa_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
