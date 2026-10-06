"""
Lapis 4 — niaga lintas penyewa: penawaran, kontrak, pesanan, promo, ulasan.

Dua keputusan bentuk yang menentukan seluruh berkas ini:

1. **Satu tabel `pesanan` untuk dua portal.** Pemilik usaha dan distributor
   melihat baris yang sama dari dua sudut; yang berbeda cuma kuerinya. Dua tabel
   terpisah pernah dicoba di purwarupa dan hasilnya pesanan yang dikirim UMKM
   tidak pernah sampai ke portal distributor.

2. **Harga dibekukan saat disalin.** `pesanan_baris.harga_satuan` dan
   `kontrak.harga_satuan` adalah SALINAN pada saat kesepakatan dibuat, bukan
   rujukan ke daftar harga hari ini. Distributor boleh menaikkan harga besok;
   pesanan kemarin tidak ikut berubah.

`pesanan_baris.jumlah_diterima` dan `alasan_selisih` terlihat sepele, tapi
keduanya adalah **sumber label Mesin 2**: dari sanalah "pesanan ini sukses atau
tidak" dihitung.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Index, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from ..enum import (
    AlasanSelisih,
    JenisPromo,
    KategoriNotifikasi,
    StatusBayar,
    StatusKontrak,
    StatusPesanan,
    TingkatNotifikasi,
)
from .dasar import bawaan, kolom_dibuat_pada, kolom_enum, kolom_jumlah, kolom_uang, kolom_waktu


# --------------------------------------------------------------------------
# Katalog distributor
# --------------------------------------------------------------------------
class Penawaran(SQLModel, table=True):
    """
    Satu barang yang dijual satu distributor.

    `kemasan_isi` adalah kelipatan pemesanan sekaligus faktor konversi: 1 jerigen
    = 5.000 ml. Inilah satu-satunya tempat konversi satuan terjadi saat barang
    diterima — `jumlah_dipesan x kemasan_isi` menjadi angka pergerakan.
    """

    __tablename__ = "penawaran"
    __table_args__ = (
        Index("ix_penawaran_distributor", "distributor_id"),
        CheckConstraint("kemasan_isi > 0", name="ck_penawaran_isi_positif"),
    )

    id: int | None = Field(default=None, primary_key=True)
    distributor_id: int = Field(foreign_key="distributor.id")
    produk_master_id: int | None = Field(default=None, foreign_key="produk_master.id", index=True)

    nama: str = Field(max_length=120)
    kategori: str = Field(max_length=60)
    #: Satuan jual distributor: "kg", "dus", "jerigen".
    satuan: str = Field(max_length=20)
    harga_satuan: int = Field(sa_column=kolom_uang(nullable=False))
    #: Nama kemasan jual; sama dengan `satuan` kalau dijual satuan.
    kemasan_nama: str = Field(max_length=30)
    #: Isi satu satuan jual, dalam satuan dasar produk.
    kemasan_isi: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    #: Satuan dasar isi di atas: gram / ml / pcs.
    satuan_isi: str = Field(max_length=10)

    stok_tersedia: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    #: Angka stok tanpa stempel waktu membuat orang memesan barang yang sudah habis.
    stok_diperbarui_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
    keterangan: str | None = Field(default=None, max_length=200)
    #: Disembunyikan distributor. Tidak dihapus: pesanan dan kontrak lama masih merujuknya.
    aktif: bool = Field(default=True, **bawaan(True))


class PaketKontrak(SQLModel, table=True):
    """
    Tawaran kontrak untuk SATU penawaran.

    Paket wajib membawa harganya sendiri — itulah seluruh gunanya kontrak bagi
    pemilik warung. Rancangan awal tim hanya menyimpan durasi dan kuota minimum,
    sehingga kontrak tidak mengunci apa pun.
    """

    __tablename__ = "paket_kontrak"
    __table_args__ = (
        UniqueConstraint("penawaran_id", "durasi_bulan", name="uq_paket_durasi"),
    )

    id: int | None = Field(default=None, primary_key=True)
    penawaran_id: int = Field(foreign_key="penawaran.id", index=True)
    distributor_id: int = Field(foreign_key="distributor.id", index=True)
    kode: str = Field(max_length=30)
    durasi_bulan: int
    kuota_min_per_bulan: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    harga_satuan: int = Field(sa_column=kolom_uang(nullable=False))
    hemat_persen: int = Field(default=0, **bawaan(0))
    ketentuan_kuota_kurang: str | None = Field(default=None, sa_column=Column(Text))
    ketentuan_berhenti: str | None = Field(default=None, sa_column=Column(Text))


class Kontrak(SQLModel, table=True):
    """
    Kesepakatan berjalan. Satu kontrak mengikat tepat satu barang.

    Seluruh isi paket DISALIN ke sini saat distributor menyetujui, dan masa
    kontrak dihitung sejak persetujuan — bukan sejak pengajuan, karena sebelum
    disetujui belum ada kewajiban bagi siapa pun.
    """

    __tablename__ = "kontrak"
    __table_args__ = (
        Index("ix_kontrak_usaha_status", "usaha_id", "status"),
        Index("ix_kontrak_distributor_status", "distributor_id", "status"),
    )

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int = Field(foreign_key="usaha.id")
    distributor_id: int = Field(foreign_key="distributor.id")
    penawaran_id: int = Field(foreign_key="penawaran.id")
    paket_id: int | None = Field(default=None, foreign_key="paket_kontrak.id")
    barang_id: int | None = Field(default=None, foreign_key="barang.id")

    nama_barang: str = Field(max_length=120)
    durasi_bulan: int
    kuota_min_per_bulan: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    #: Harga terkunci. Promo tidak pernah menyentuhnya.
    harga_satuan: int = Field(sa_column=kolom_uang(nullable=False))
    satuan: str = Field(max_length=20)
    mulai: datetime = Field(sa_column=kolom_waktu(nullable=False))
    berakhir: datetime = Field(sa_column=kolom_waktu(nullable=False))
    status: StatusKontrak = Field(
        sa_column=kolom_enum(StatusKontrak, "status_kontrak", nullable=False)
    )
    #: Sudah dipesan tapi belum diterima. Segmen kedua pada bar kuota.
    dalam_perjalanan: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    ketentuan_kuota_kurang: str | None = Field(default=None, sa_column=Column(Text))

    pesanan_rutin_aktif: bool = Field(default=False, **bawaan(False))
    pesanan_rutin_berikutnya: date | None = Field(default=None)

    alasan_ditolak: str | None = Field(default=None, sa_column=Column(Text))
    pengajuan_berhenti_waktu: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
    pengajuan_berhenti_alasan: str | None = Field(default=None, sa_column=Column(Text))
    jawaban_berhenti_waktu: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
    jawaban_berhenti_disetujui: bool | None = Field(default=None)
    jawaban_berhenti_alasan: str | None = Field(default=None, sa_column=Column(Text))


class KontrakPeriode(SQLModel, table=True):
    """
    Pemenuhan kuota per bulan. Tabel tersendiri, bukan JSON: ini sering dikueri
    (bar kuota, daftar kontrak, rekap distributor) dan perlu diindeks.
    """

    __tablename__ = "kontrak_periode"
    __table_args__ = (UniqueConstraint("kontrak_id", "periode", name="uq_kontrak_periode"),)

    id: int | None = Field(default=None, primary_key=True)
    kontrak_id: int = Field(foreign_key="kontrak.id", index=True)
    #: Format "2026-10".
    periode: str = Field(max_length=7)
    kuota: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    diterima: Decimal = Field(sa_column=kolom_jumlah(nullable=False, server_default="0"))
    selesai: bool = Field(default=False, **bawaan(False))


# --------------------------------------------------------------------------
# Promo
# --------------------------------------------------------------------------
class Promo(SQLModel, table=True):
    """
    Potongan dari distributor. Berlaku untuk beli sekali, TIDAK untuk harga
    kontrak. Promo tidak pernah dihapus, hanya diakhiri — pesanan lama masih
    perlu menyebut promo mana asal potongannya.
    """

    __tablename__ = "promo"
    __table_args__ = (Index("ix_promo_distributor", "distributor_id"),)

    id: int | None = Field(default=None, primary_key=True)
    distributor_id: int = Field(foreign_key="distributor.id")
    jenis: JenisPromo = Field(sa_column=kolom_enum(JenisPromo, "jenis_promo", nullable=False))
    judul: str = Field(max_length=120)
    keterangan: str | None = Field(default=None, sa_column=Column(Text))
    #: Null berarti tanpa tenggat.
    berakhir: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
    potongan_persen: int | None = Field(default=None)
    dibuat_pada: datetime | None = Field(default=None, sa_column=kolom_dibuat_pada())


class PromoPenawaran(SQLModel, table=True):
    __tablename__ = "promo_penawaran"
    __table_args__ = (UniqueConstraint("promo_id", "penawaran_id", name="uq_promo_penawaran"),)

    id: int | None = Field(default=None, primary_key=True)
    promo_id: int = Field(foreign_key="promo.id", index=True)
    penawaran_id: int = Field(foreign_key="penawaran.id", index=True)


class TingkatKeanggotaan(SQLModel, table=True):
    """Keuntungan per tingkat untuk promo keanggotaan, diisi distributor."""

    __tablename__ = "tingkat_keanggotaan"

    id: int | None = Field(default=None, primary_key=True)
    promo_id: int = Field(foreign_key="promo.id", index=True)
    urutan: int
    nama: str = Field(max_length=60)
    syarat: str | None = Field(default=None, sa_column=Column(Text))
    manfaat: str | None = Field(default=None, sa_column=Column(Text))


# --------------------------------------------------------------------------
# Pesanan
# --------------------------------------------------------------------------
class Pesanan(SQLModel, table=True):
    """Satu pesanan, dibaca dua portal."""

    __tablename__ = "pesanan"
    __table_args__ = (
        UniqueConstraint("nomor", name="uq_pesanan_nomor"),
        Index("ix_pesanan_usaha_status", "usaha_id", "status"),
        Index("ix_pesanan_distributor_status", "distributor_id", "status", "dibuat_pada"),
    )

    id: int | None = Field(default=None, primary_key=True)
    nomor: str = Field(max_length=40)
    usaha_id: int = Field(foreign_key="usaha.id")
    distributor_id: int = Field(foreign_key="distributor.id")
    kontrak_id: int | None = Field(default=None, foreign_key="kontrak.id", index=True)

    dibuat_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
    status: StatusPesanan = Field(
        sa_column=kolom_enum(StatusPesanan, "status_pesanan", nullable=False)
    )
    ongkos_kirim: int = Field(default=0, sa_column=kolom_uang(nullable=False, server_default="0"))
    perkiraan_tiba: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
    status_bayar: StatusBayar = Field(
        sa_column=kolom_enum(StatusBayar, "status_bayar", nullable=False)
    )
    jumlah_bukti: int = Field(default=0, **bawaan(0))

    #: Pesanan yang lahir dari saran model. Dipakai mengukur kegunaan Mesin 1.
    dari_saran: bool = Field(default=False, **bawaan(False))
    dari_rutin: bool = Field(default=False, **bawaan(False))
    catatan_untuk_distributor: str | None = Field(default=None, sa_column=Column(Text))
    sudah_diulas: bool = Field(default=False, **bawaan(False))
    #: Kode induk saat satu keranjang melahirkan beberapa pesanan.
    kode_belanja: str | None = Field(default=None, max_length=40)
    alasan_tolak: str | None = Field(default=None, sa_column=Column(Text))

    # Bukti pengiriman, diisi distributor saat menandai barang sampai.
    kirim_kurir: str | None = Field(default=None, max_length=120)
    kirim_pengantar: str | None = Field(default=None, max_length=120)
    kirim_nomor_resi: str | None = Field(default=None, max_length=60)
    kirim_diterima_oleh: str | None = Field(default=None, max_length=120)
    kirim_waktu_sampai: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
    kirim_catatan: str | None = Field(default=None, sa_column=Column(Text))


class PesananBaris(SQLModel, table=True):
    """
    Satu barang dalam satu pesanan.

    `jumlah_diterima` dan `alasan_selisih` diisi saat pemilik usaha menghitung
    barang di tempat. **Dari dua kolom inilah label Mesin 2 lahir**, digabung
    dengan `kirim_waktu_sampai` vs `perkiraan_tiba` di tabel induknya.
    """

    __tablename__ = "pesanan_baris"
    __table_args__ = (Index("ix_pesanan_baris_pesanan", "pesanan_id"),)

    id: int | None = Field(default=None, primary_key=True)
    pesanan_id: int = Field(foreign_key="pesanan.id")
    penawaran_id: int = Field(foreign_key="penawaran.id", index=True)
    barang_id: int | None = Field(default=None, foreign_key="barang.id")

    nama: str = Field(max_length=120)
    jumlah: Decimal = Field(sa_column=kolom_jumlah(nullable=False))
    satuan: str = Field(max_length=20)
    #: Harga yang benar-benar dibayar per satuan jual, dibekukan saat pesanan dibuat.
    harga_satuan: int = Field(sa_column=kolom_uang(nullable=False))
    #: Harga sebelum potongan promo. Sama dengan harga_satuan kalau tanpa potongan.
    harga_normal: int | None = Field(default=None, sa_column=kolom_uang(nullable=True))
    promo_id: int | None = Field(default=None, foreign_key="promo.id")
    #: Isi satu satuan jual dalam satuan dasar; dipakai menghitung penambahan stok.
    isi_per_satuan: Decimal = Field(sa_column=kolom_jumlah(nullable=False))

    jumlah_diterima: Decimal | None = Field(default=None, sa_column=kolom_jumlah(nullable=True))
    alasan_selisih: AlasanSelisih | None = Field(
        default=None, sa_column=kolom_enum(AlasanSelisih, "alasan_selisih", nullable=True)
    )
    catatan_penerimaan: str | None = Field(default=None, sa_column=Column(Text))


class PesananJejak(SQLModel, table=True):
    """Garis waktu status. Dibaca dua portal dengan kalimat yang berbeda."""

    __tablename__ = "pesanan_jejak"
    __table_args__ = (Index("ix_pesanan_jejak_pesanan", "pesanan_id", "waktu"),)

    id: int | None = Field(default=None, primary_key=True)
    pesanan_id: int = Field(foreign_key="pesanan.id")
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    status: StatusPesanan = Field(
        sa_column=kolom_enum(StatusPesanan, "status_pesanan_jejak", nullable=False)
    )
    keterangan: str | None = Field(default=None, sa_column=Column(Text))


# --------------------------------------------------------------------------
# Ulasan & pemberitahuan
# --------------------------------------------------------------------------
class Ulasan(SQLModel, table=True):
    """
    Penilaian setelah pesanan selesai. Satu pesanan satu ulasan.

    Tiga aspeknya bukan hiasan: ketiganya jadi fitur Mesin 2 dan jadi `subRating`
    yang ditampilkan di profil distributor.
    """

    __tablename__ = "ulasan"
    __table_args__ = (
        UniqueConstraint("pesanan_id", name="uq_ulasan_pesanan"),
        Index("ix_ulasan_distributor", "distributor_id"),
        CheckConstraint("rating between 1 and 5", name="ck_ulasan_rating"),
    )

    id: int | None = Field(default=None, primary_key=True)
    pesanan_id: int = Field(foreign_key="pesanan.id")
    usaha_id: int = Field(foreign_key="usaha.id")
    distributor_id: int = Field(foreign_key="distributor.id")
    rating: int
    isi: str | None = Field(default=None, sa_column=Column(Text))
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    aspek_ketepatan_waktu: int
    aspek_jumlah_sesuai: int
    aspek_kondisi_barang: int


class Notifikasi(SQLModel, table=True):
    __tablename__ = "notifikasi"
    __table_args__ = (Index("ix_notifikasi_usaha_waktu", "usaha_id", "waktu"),)

    id: int | None = Field(default=None, primary_key=True)
    usaha_id: int | None = Field(default=None, foreign_key="usaha.id")
    distributor_id: int | None = Field(default=None, foreign_key="distributor.id")
    kategori: KategoriNotifikasi = Field(
        sa_column=kolom_enum(KategoriNotifikasi, "kategori_notifikasi", nullable=False)
    )
    tingkat: TingkatNotifikasi = Field(
        sa_column=kolom_enum(TingkatNotifikasi, "tingkat_notifikasi", nullable=False)
    )
    judul: str = Field(max_length=160)
    pesan: str | None = Field(default=None, sa_column=Column(Text))
    waktu: datetime = Field(sa_column=kolom_waktu(nullable=False))
    dibaca: bool = Field(default=False, **bawaan(False))
    #: Hanya yang ini dihitung pada angka merah lonceng.
    butuh_tindakan: bool = Field(default=False, **bawaan(False))
    tautan: str | None = Field(default=None, max_length=200)
    barang_id: int | None = Field(default=None, foreign_key="barang.id")
    dibisukan_sampai: datetime | None = Field(default=None, sa_column=kolom_waktu(nullable=True))
