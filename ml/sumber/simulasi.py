"""
Adaptor data simulasi (Postgres, 70 UMKM, 400 hari).

Bentuk "deret", "pesanan", dan "counterfactual" hanya meneruskan pemuat yang
sudah ada di `ml/data.py`; bentuk "rfm" meneruskan `muat_rfm` Mesin 3. Yang baru
hanya bentuk "omset", dari nota kasir (`transaksi`, `transaksi_baris`).
"""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy import text

from warungku.basis_data import mesin

from .. import data
from . import KOLOM_RFM, bingkai_omset


def deret(**opsi) -> list[data.DeretBarang]:
    return data.muat_deret(**opsi)


def pesanan() -> pd.DataFrame:
    return data.muat_fitur_pesanan()


def counterfactual(**opsi) -> pd.DataFrame:
    return data.muat_counterfactual(**opsi)


def omset() -> pd.DataFrame:
    """
    Omset, jumlah baris nota, dan jumlah nota per UMKM per hari.

    * `omset` = jumlah (jumlah x harga_jual_satuan) di seluruh baris nota yang
      tidak dibatalkan. Hari stok habis tetap berisi omset (uang yang benar-benar
      masuk), bukan NaN.
    * `jumlah_barang` = banyaknya **baris nota**. Satuan dasar barang
      berbeda-beda (gram, ml, pcs), jadi jumlahnya tidak bisa dijumlah.
    * `jumlah_nota` = banyaknya nota, pendekatan jumlah pembeli.
    * Kalender (`libur`, `pekan_gajian`, `ramadan`) diambil dari
      `permintaan_harian`, sumber yang sama dengan deret Mesin 1. `lebaran`
      (dua hari Idulfitri, saat hampir semua warung tutup) dari
      `dataset/kalender.py`, definisi yang sama dengan yang dipakai pembangkit
      untuk menekan permintaan. Lonjakan tujuh hari menjelangnya ada di dalam
      `ramadan`.
    * `stok_habis_parsial` = banyaknya barang yang kehabisan stok hari itu.
    """
    with mesin().connect() as kon:
        angka = pd.read_sql_query(
            text(
                """
                WITH per_nota AS (
                    SELECT transaksi_id,
                           SUM(jumlah * harga_jual_satuan) AS nilai,
                           COUNT(*) AS baris
                      FROM transaksi_baris
                     GROUP BY transaksi_id
                )
                SELECT t.usaha_id AS entitas_id,
                       (t.waktu AT TIME ZONE 'UTC')::date AS tanggal,
                       SUM(pn.nilai)::float8 AS omset,
                       SUM(pn.baris)::float8 AS jumlah_barang,
                       COUNT(*)::float8 AS jumlah_nota
                  FROM transaksi t
                  JOIN per_nota pn ON pn.transaksi_id = t.id
                 WHERE NOT t.dibatalkan
                 GROUP BY 1, 2
                """
            ),
            kon,
        )
        harian = pd.read_sql_query(
            text(
                """
                SELECT usaha_id AS entitas_id, tanggal,
                       COUNT(*) FILTER (WHERE stok_habis)::float8 AS stok_habis_parsial
                  FROM permintaan_harian
                 GROUP BY 1, 2
                """
            ),
            kon,
        )
        kalender = pd.read_sql_query(
            text(
                """
                SELECT tanggal, bool_or(hari_libur) AS libur,
                       bool_or(pekan_gajian) AS pekan_gajian, bool_or(ramadan) AS ramadan
                  FROM permintaan_harian
                 GROUP BY tanggal
                 ORDER BY tanggal
                """
            ),
            kon,
        )

    if angka.empty:
        raise ValueError(
            "tabel transaksi kosong. Bangkitkan ulang dataset: python -m dataset.buat_dataset"
        )
    for df in (angka, harian, kalender):
        df["tanggal"] = pd.to_datetime(df["tanggal"])

    tanggal = pd.date_range(kalender["tanggal"].min(), kalender["tanggal"].max(), freq="D")
    kal = kalender.set_index("tanggal").reindex(tanggal)
    if kal.isna().any().any():
        raise ValueError("kalender permintaan_harian bolong; dataset perlu dibangkitkan ulang")

    from dataset.kalender import sedang_lebaran

    lebaran = np.array([sedang_lebaran(t.date()) for t in tanggal], dtype=bool)

    bagian = []
    for e in sorted(harian["entitas_id"].unique()):
        a = angka[angka["entitas_id"] == e].set_index("tanggal")
        h = harian[harian["entitas_id"] == e].set_index("tanggal")["stok_habis_parsial"]
        bagian.append(
            bingkai_omset(
                int(e),
                tanggal,
                a[["omset", "jumlah_barang", "jumlah_nota"]],
                kal["libur"].to_numpy(dtype=bool),
                kal["pekan_gajian"].to_numpy(dtype=bool),
                kal["ramadan"].to_numpy(dtype=bool),
                lebaran,
                h.reindex(tanggal).to_numpy(dtype=float),
            )
        )
    return pd.concat(bagian, ignore_index=True)


def rfm(tanggal_acuan: date | None = None) -> pd.DataFrame:
    """Masukan Mesin 3. Di simulasi, pelanggan distributor adalah UMKM."""
    from ..mesin3.segmentasi import muat_rfm

    df = muat_rfm(tanggal_acuan)
    hasil = df.rename(columns={"usaha_id": "pelanggan_id"})[list(KOLOM_RFM)].reset_index(drop=True)
    hasil.attrs.update(df.attrs)
    return hasil

