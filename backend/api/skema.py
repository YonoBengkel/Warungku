"""
Bentuk badan permintaan dan jawaban. Terpisah dari model tabel, dengan sengaja.

Model tabel punya kolom yang tidak boleh sampai ke luar (hash kata sandi) dan
kolom yang tidak diisi klien (`stok_sesudah`, dihitung server). Kalau model
tabel dipakai langsung sebagai skema API, keduanya bocor: yang pertama ke
pembaca, yang kedua ke penulis — dan penulis yang bisa menentukan
`stok_sesudah` sendiri berarti buku besarnya bisa dikarang dari luar.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class BarisStruk(BaseModel):
    nama_menu: str = Field(min_length=1, max_length=120)
    jumlah: Decimal = Field(gt=0)
    satuan: str = Field(min_length=1, max_length=20)
    #: Fakta dari struk. Tidak pernah dipakai menghitung stok.
    harga_jual_satuan: int | None = None


class StrukMasuk(BaseModel):
    """
    Satu nota dari kasir.

    `nomor_struk` adalah **kunci idempotensi**, bukan sekadar keterangan. Kasir
    yang kehilangan jaringan akan mengirim ulang nota yang sama, dan tanpa
    kunci ini stok warung berkurang dua kali untuk satu penjualan. Keunikannya
    dijaga oleh basis data (UNIQUE usaha_id + nomor_struk), bukan oleh
    pemeriksaan di kode — pemeriksaan di kode selalu bisa dilewati dua
    permintaan yang datang bersamaan.
    """

    nomor_struk: str = Field(min_length=1, max_length=60)
    waktu: datetime
    kasir: str | None = Field(default=None, max_length=60)
    sumber: str = Field(default="pos", max_length=20)
    baris: list[BarisStruk] = Field(min_length=1)


class HasilStruk(BaseModel):
    diterima: bool
    #: True kalau nota ini sudah pernah masuk. Bukan galat: justru tanda
    #: pengiriman ulang berhasil ditangkis.
    sudah_ada: bool
    transaksi_id: int
    baris_tercatat: int
    #: Nama bahan yang tidak dikenali. Bukan galat juga — menu baru di kasir
    #: lebih sering daripada yang diduga, dan menolak seluruh nota karena satu
    #: menu belum dipetakan akan membuat pemilik warung berhenti memakai
    #: sinkronisasi sama sekali.
    tak_dikenali: list[str]


class BarangRingkas(BaseModel):
    id: int
    nama: str
    satuan: str
    stok: Decimal
    batas_aman: Decimal
    status: str
    dicatat_manual: bool


class PerkiraanRingkas(BaseModel):
    barang_id: int
    tanggal_target: date
    p10: Decimal
    p50: Decimal
    p90: Decimal
    model_nama: str
    model_versi: str
    dijalankan_pada: datetime
    kematangan: str
    tingkat_layanan: str


class SaranDistributor(BaseModel):
    """
    Satu kandidat distributor beserta alasannya.

    `kedaluwarsa_pada` ikut dikirim, tidak disembunyikan. Skor Mesin 2
    bergantung pada harga dan stok yang bisa berubah hari itu juga; frontend
    perlu bisa berkata "angka ini dihitung tadi pagi" alih-alih menampilkannya
    seolah baru.
    """

    barang_id: int
    distributor_id: int
    penawaran_id: int
    nama_distributor: str
    p_sukses: float
    skor: float
    alasan: str | None
    model_nama: str
    dijalankan_pada: datetime
    kedaluwarsa_pada: datetime
    kedaluwarsa: bool


class PesananMasuk(BaseModel):
    """Satu pesanan dilihat dari sisi distributor."""

    id: int
    nomor: str
    usaha_id: int
    nama_usaha: str
    kota: str
    dibuat_pada: datetime
    status: str
    status_bayar: str
    ongkos_kirim: int | None
    perkiraan_tiba: datetime | None
    dari_saran: bool
    sudah_diulas: bool
    jumlah_baris: int
    nilai: int


class RingkasanSegmen(BaseModel):
    """Satu segmen pelanggan beserta rata-rata RFM anggotanya."""

    segmen: str
    nama_segmen: str
    ciri: str | None
    saran: str | None
    jumlah: int
    rata_recency: int
    rata_frequency: int
    rata_monetary: int
    dijalankan_pada: datetime
    tanggal_acuan: date


class PelangganTersegmen(BaseModel):
    """
    Satu pelanggan di dalam sebuah segmen.

    `jarak_ke_pusat` ikut dikirim: anggota berjarak jauh adalah pelanggan yang
    "dipaksa masuk" ke segmen terdekat. Menampilkannya mencegah layar terdengar
    lebih yakin daripada yang pantas.
    """

    usaha_id: int
    nama_usaha: str
    kota: str
    segmen: str
    nama_segmen: str
    recency: int
    frequency: int
    monetary: int
    lama_berlangganan: int
    jenis_usaha: str
    kategori_utama: str
    jarak_ke_pusat: float
