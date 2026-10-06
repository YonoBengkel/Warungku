"""
Pembantu kolom yang dipakai seluruh tabel.

Tiga aturan angka yang tidak boleh dilanggar di mana pun:

1. **Uang adalah bilangan bulat rupiah** (`BIGINT`). Tidak ada sen di Indonesia,
   dan `FLOAT` untuk uang cepat atau lambat menghasilkan Rp 148.000,00000001.
2. **Jumlah barang adalah `NUMERIC`**, bukan `FLOAT`. Stok bisa 3,4 kg, dan
   pembulatan biner akan membuat penjumlahan buku besar tidak pernah pas.
3. **Jumlah selalu dalam satuan dasar** (gram, ml, pcs). "kg" dan "liter" cuma
   lapisan tampilan; tidak pernah ada angka bersatuan tampil di kolom numerik.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import BigInteger, Column, DateTime, Enum as EnumSA, Numeric, text
from sqlalchemy.sql import func

# Presisi jumlah: 14 digit, 3 di belakang koma. Cukup untuk 99 miliar gram
# dengan ketelitian miligram.
PRESISI_JUMLAH = (14, 3)


def kolom_uang(**kwargs: Any) -> Column:
    """Rupiah bulat."""
    return Column(BigInteger, **kwargs)


def kolom_jumlah(**kwargs: Any) -> Column:
    """Jumlah barang dalam satuan dasar."""
    return Column(Numeric(*PRESISI_JUMLAH), **kwargs)


def kolom_enum(jenis: type[Enum], nama: str, **kwargs: Any) -> Column:
    """
    Enum yang disimpan sebagai NILAI teksnya, bukan nama anggotanya.

    `values_callable` penting: tanpa itu SQLAlchemy menyimpan "MENUNGGU_KONFIRMASI"
    padahal frontend mengirim "menunggu-konfirmasi".
    """
    return Column(
        EnumSA(jenis, name=nama, values_callable=lambda e: [x.value for x in e]),
        **kwargs,
    )


def kolom_waktu(**kwargs: Any) -> Column:
    """Stempel waktu berzona. Semua waktu disimpan UTC, ditampilkan WIB."""
    return Column(DateTime(timezone=True), **kwargs)


def kolom_dibuat_pada() -> Column:
    return Column(DateTime(timezone=True), nullable=False, server_default=func.now())


def sekarang() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


def bawaan(nilai: Any) -> dict[str, Any]:
    """
    Nilai bawaan yang juga berlaku di sisi basis data, bukan hanya di Python.

    `Field(default=False)` saja hanya berlaku kalau barisnya dibuat lewat kode
    Python. Kolom NOT NULL tanpa DEFAULT di basis data akan menolak setiap
    INSERT yang tidak menyebut kolom itu — termasuk skrip SQL pemeliharaan,
    pengimpor CSV, dan `psql` di tangan anggota tim. Cacat seperti ini tidak
    terlihat sampai ada yang menulis data tanpa lewat ORM.
    """
    if isinstance(nilai, bool):
        sql = "true" if nilai else "false"
    elif isinstance(nilai, (int, float)):
        sql = str(nilai)
    else:
        sql = "'%s'" % str(nilai).replace("'", "''")
    return {"sa_column_kwargs": {"server_default": text(sql)}}
