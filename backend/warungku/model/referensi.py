"""
Lapis 0 — data acuan yang tidak dimiliki siapa pun.

Isi tabel di sini tidak berasal dari pengguna, tidak berubah karena transaksi,
dan sama untuk semua usaha. Ia dipisah dari lapis lain karena satu alasan
praktis: tabel acuan boleh diisi ulang dari sumbernya kapan saja tanpa
menyentuh data siapa pun.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from .dasar import kolom_waktu


class HariLiburNasional(SQLModel, table=True):
    """
    Tanggal merah dan cuti bersama, mengutip SKB 3 Menteri.

    Kenapa ia harus ada di basis data, bukan cukup di Python. Kolom
    `permintaan_harian.hari_libur` adalah kovariat yang dibaca model. Selama
    kalendernya hanya hidup di `dataset/pola.py`, satu-satunya yang bisa
    mengisinya adalah skrip Python — skrip SQL pemeliharaan tidak bisa, dan
    API tidak bisa. Akibatnya tabel turunan tidak benar-benar bisa dibangun
    ulang dari sumbernya, dan itu melanggar aturan yang kami pegang sendiri.

    Cuti bersama ikut dicatat. Bagi warung, hari orang tidak bekerja adalah
    hari orang jajan; pengaruhnya pada penjualan sama saja dengan tanggal
    merah, jadi memisahkannya hanya akan membuat kovariatnya tidak lengkap.
    """

    __tablename__ = "hari_libur_nasional"

    #: Tanggalnya sendiri jadi kunci primer. Tidak ada dua hari libur pada
    #: tanggal yang sama; kalau SKB mencantumkan dua nama untuk satu tanggal,
    #: yang dicatat satu baris dengan nama gabungan, bukan dua baris.
    tanggal: date = Field(primary_key=True)
    nama: str = Field(max_length=120)
    #: "libur-nasional" atau "cuti-bersama". Disimpan sebagai teks biasa,
    #: bukan enum: daftar jenisnya ditentukan pemerintah, bukan oleh kami,
    #: dan menambah jenis baru tidak boleh butuh migrasi.
    jenis: str = Field(max_length=20)


class GeseranTanggal(SQLModel, table=True):
    """
    Seberapa jauh tanggal data simulasi sudah digeser maju (revisi V8, Q180). Satu baris.

    Data simulasi dibangkitkan berakhir 5 Okt 2026 (`dataset.buat_dataset.AKHIR`).
    `dataset.geser_tanggal` menggesernya maju kelipatan 7 hari supaya berakhir
    paling lambat kemarin, dan pola hari tetap (Sabtu tetap Sabtu). Bukan data
    acuan dari luar, tetapi sama seperti acuan: milik seluruh basis data, bukan
    milik satu usaha, dan tidak berubah karena transaksi.

    `id_simulasi` memetakan nama tabel ke id baris simulasinya (teks
    `int8multirange`), diambil sekali pada geseran pertama. Baris yang dibuat
    sesudahnya, lewat layar atau Portal POS, tidak pernah ikut digeser.
    """

    __tablename__ = "geseran_tanggal"
    __table_args__ = (CheckConstraint("id = 1", name="ck_geseran_tanggal_satu"),)

    id: int = Field(default=1, primary_key=True)
    #: Jumlah hari yang sudah digeser sejak data dibangkitkan, selalu kelipatan 7.
    hari: int = Field(default=0)
    #: Tanggal terakhir data simulasi sekarang: AKHIR + hari.
    akhir_data: date
    id_simulasi: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
    diperbarui_pada: datetime = Field(sa_column=kolom_waktu(nullable=False))
