"""
Lapis 0 — data acuan yang tidak dimiliki siapa pun.

Isi tabel di sini tidak berasal dari pengguna, tidak berubah karena transaksi,
dan sama untuk semua usaha. Ia dipisah dari lapis lain karena satu alasan
praktis: tabel acuan boleh diisi ulang dari sumbernya kapan saja tanpa
menyentuh data siapa pun.
"""

from __future__ import annotations

from datetime import date

from sqlmodel import Field, SQLModel


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
