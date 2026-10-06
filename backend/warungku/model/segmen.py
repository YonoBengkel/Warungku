"""
Lapis 5 (analitik) — keluaran Mesin 3: segmentasi pelanggan distributor.

Dipisah dari `analitik.py` karena arahnya berbeda. Tabel di `analitik.py`
melayani portal UMKM: apa yang harus saya beli, dari siapa. Tabel di sini
melayani portal **distributor**: pelanggan mana yang harus saya jaga.

Pesanan yang sama dibaca dari dua arah berlawanan, dan tidak satu pun bisa
diturunkan dari yang lain. Dari `rekomendasi_skor` tidak ada cara mengetahui
kapan terakhir seseorang memesan.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Column, Index, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from .dasar import kolom_uang, kolom_waktu


class SegmenPelanggan(SQLModel, table=True):
    """
    Satu baris per (distributor, pelanggan): segmen beserta fitur RFM-nya.

    Fitur RFM-nya ikut disimpan, tidak hanya nomor segmennya. Alasannya:
    tanpa itu, layar hanya bisa berkata "Pelanggan andalan" tanpa bisa
    menjawab "kenapa?". Dan pertanyaan itu pasti muncul dari distributor yang
    merasa pelanggannya salah dikelompokkan.
    """

    __tablename__ = "segmen_pelanggan"
    __table_args__ = (
        UniqueConstraint("distributor_id", "usaha_id", "jalan_id", name="uq_segmen_pelanggan"),
        Index("ix_segmen_distributor", "distributor_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    distributor_id: int = Field(foreign_key="distributor.id")
    usaha_id: int = Field(foreign_key="usaha.id")

    #: Kunci segmen: "andalan", "rutin", "sedang", "baru", "kecil", "jarang".
    segmen: str = Field(max_length=20)
    nama_segmen: str = Field(max_length=60)
    #: Satu kalimat: siapa mereka. Satu kalimat: apa yang sebaiknya dilakukan.
    ciri: str | None = Field(default=None, sa_column=Column(Text))
    saran: str | None = Field(default=None, sa_column=Column(Text))

    # --- Fitur RFM, disimpan apa adanya supaya layar bisa menjelaskan ---
    #: Hari sejak pesanan terakhir.
    recency: int
    #: Banyaknya pesanan yang tidak ditolak.
    frequency: int
    #: Nilai belanja barang, rupiah.
    monetary: int = Field(sa_column=kolom_uang(nullable=False))
    #: Hari sejak pesanan pertamanya ke distributor ini.
    lama_berlangganan: int
    jenis_usaha: str = Field(max_length=30)
    kategori_utama: str = Field(max_length=60)

    #: Jarak ke pusat kelompoknya. Anggota berjarak jauh adalah pelanggan yang
    #: "dipaksa masuk" ke segmen terdekat; menampilkannya mencegah layar
    #: terdengar lebih yakin daripada yang pantas.
    jarak_ke_pusat: float

    jalan_id: str = Field(max_length=40)
    model_nama: str = Field(max_length=60)
    model_versi: str = Field(max_length=40)
    dijalankan_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
    tanggal_acuan: date
