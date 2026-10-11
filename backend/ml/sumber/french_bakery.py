"""
Adaptor French Bakery Daily Sales: data penjualan nyata satu toko roti di Prancis,
2021-01-02 sampai 2022-09-30.

Hanya untuk validasi metode Mesin 1. Asal, lisensi, dan keanehan datanya ada di
`backend/data_nyata/french_bakery/README.md`. Berkas CSV-nya tidak dilacak git
(lisensi "© Original Authors"), jadi tiap anggota tim mengunduhnya sendiri.

Keputusan pembersihan, masing-masing dengan alasannya:

* **Baris berjumlah negatif dijumlahkan, tidak dibuang.** Itu pengembalian
  barang. Kalau dibuang, penjualan terlihat lebih tinggi daripada yang
  sebenarnya. Jumlah bersih per barang per hari tidak pernah negatif di data ini.
* **Hari tanpa satu nota pun = toko tutup**, bukan hari tanpa pembeli. 29 dari
  37 hari itu jatuh pada hari Rabu, yaitu hari libur mingguan toko pada sebagian
  bulan. Hari itu NaN di deret dan `data_hilang=True` di bentuk omset. Kalau
  diisi nol, model belajar bahwa ada hari-hari tanpa permintaan sama sekali.
* **Hari toko buka tapi satu barang tidak terjual = nol**, bukan NaN. Toko roti
  ini tidak punya data stok, jadi hari barang habis tidak bisa dibedakan dari
  hari tanpa pembeli. `stok_habis` selalu False dan `stok_habis_parsial` NaN.
  Batasan ini harus ditulis di laporan.
* **Nota yang isinya hanya pengembalian (765 nota) tidak dihitung** di
  `jumlah_nota`, karena tidak mewakili pembeli. Omsetnya tetap mengurangi omset.
* **Harga per baris dipakai apa adanya.** 78 artikel berganti harga selama
  rentang data; omset dihitung dari harga yang berlaku saat itu.
* Kalender Prancis. `libur` = hari libur nasional Prancis. `pekan_gajian`,
  `ramadan`, dan `lebaran` tidak berlaku, jadi diisi False seluruhnya. **Buang
  ketiga kolom itu sebelum dipakai sebagai exog SARIMAX**: kolom konstan membuat
  matriksnya singular.
* `harga_satuan` di deret = median harga jual artikel (baris jumlah positif,
  harga di atas nol). Toko roti tidak punya harga beli, jadi saringan ABC di
  sini menimbang dengan harga jual, bukan harga pokok seperti di simulasi.
"""

from __future__ import annotations

import hashlib
import warnings
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from ..data import DeretBarang
from . import bingkai_omset

BERKAS = Path(__file__).resolve().parents[2] / "data_nyata" / "french_bakery" / "Bakery sales.csv"
#: Sidik berkas yang diterima 2026-10-10. Berkas berbeda tetap dibaca, tapi
#: dengan peringatan: angkanya tidak lagi sebanding dengan hasil yang tercatat.
SHA256 = "af5eede55b6eb2efb6bebb0e6dd1a51568c7eb73554d2f8ad2563081025681b2"
UNDUH = "https://www.kaggle.com/datasets/matthieugimbert/french-bakery-daily-sales"

#: Satu toko, jadi satu entitas dan satu "usaha".
ENTITAS_ID = 1


# --------------------------------------------------------------------------
# Kalender
# --------------------------------------------------------------------------
def _paskah(tahun: int) -> date:
    """Minggu Paskah, kalender Gregorius (algoritma anonim Meeus/Jones/Butcher)."""
    a = tahun % 19
    b, c = divmod(tahun, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    bulan, hari = divmod(h + l - 7 * m + 114, 31)
    return date(tahun, bulan, hari + 1)


def libur_prancis(tahun: int) -> dict[date, str]:
    """
    Sebelas hari libur nasional Prancis (jours fériés). Libur daerah
    Alsace-Moselle tidak dimasukkan, karena letak toko tidak diketahui.
    """
    p = _paskah(tahun)
    return {
        date(tahun, 1, 1): "Jour de l'an",
        p + timedelta(days=1): "Lundi de Pâques",
        date(tahun, 5, 1): "Fête du Travail",
        date(tahun, 5, 8): "Victoire 1945",
        p + timedelta(days=39): "Ascension",
        p + timedelta(days=50): "Lundi de Pentecôte",
        date(tahun, 7, 14): "Fête nationale",
        date(tahun, 8, 15): "Assomption",
        date(tahun, 11, 1): "Toussaint",
        date(tahun, 11, 11): "Armistice",
        date(tahun, 12, 25): "Noël",
    }


# --------------------------------------------------------------------------
# Pembacaan
# --------------------------------------------------------------------------
def _harga(teks: pd.Series) -> pd.Series:
    """'1.234,50 €' -> 1234.5. Format Eropa: titik ribuan, koma desimal."""
    bersih = (
        teks.str.replace("€", "", regex=False)
        .str.replace(" ", "", regex=False)
        .str.strip()
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
    )
    return pd.to_numeric(bersih, errors="raise")


@lru_cache(maxsize=4)
def _baca(berkas: str) -> pd.DataFrame:
    p = Path(berkas)
    if not p.exists():
        raise FileNotFoundError(
            "%s tidak ada. Unduh dari %s dan taruh di folder itu dengan nama yang sama "
            "(lihat data_nyata/french_bakery/README.md)." % (p, UNDUH)
        )
    sidik = hashlib.sha256(p.read_bytes()).hexdigest()
    if sidik != SHA256:
        warnings.warn(
            "Sidik %s berbeda dari yang tercatat (%s...). Hasil tidak sebanding dengan "
            "angka yang sudah dilaporkan." % (p.name, SHA256[:12]),
            stacklevel=3,
        )

    mentah = pd.read_csv(p, dtype={"unit_price": str, "article": str, "date": str, "time": str})
    df = pd.DataFrame(
        {
            "tanggal": pd.to_datetime(mentah["date"], format="%Y-%m-%d"),
            "jam": mentah["time"],
            "nota": mentah["ticket_number"].astype(np.int64),
            "artikel": mentah["article"].str.strip(),
            "jumlah": mentah["Quantity"].astype(float),
            "harga": _harga(mentah["unit_price"]),
        }
    )
    df["nilai"] = df["jumlah"] * df["harga"]
    return df


def baca(berkas: str | Path = BERKAS) -> pd.DataFrame:
    """
    Baris nota yang sudah dibersihkan: tanggal, jam, nota, artikel, jumlah,
    harga, nilai. Satu baris = satu baris nota asli, termasuk pengembalian.
    """
    return _baca(str(berkas)).copy()


def _rentang(df: pd.DataFrame) -> pd.DatetimeIndex:
    return pd.date_range(df["tanggal"].min(), df["tanggal"].max(), freq="D")


def _libur(tanggal: pd.DatetimeIndex) -> np.ndarray:
    hari = set()
    for th in range(tanggal[0].year, tanggal[-1].year + 1):
        hari |= set(libur_prancis(th))
    return np.array([t.date() in hari for t in tanggal], dtype=bool)


# --------------------------------------------------------------------------
# Bentuk keluaran
# --------------------------------------------------------------------------
def deret(berkas: str | Path = BERKAS, min_hari_laku: int = 0) -> list[DeretBarang]:
    """
    Satu DeretBarang per artikel, seluruhnya sepanjang rentang data (637 hari).

    `barang_id` = urutan abjad nama artikel, dimulai dari 1; stabil selama
    berkasnya sama. `min_hari_laku` membuang artikel yang terjual di kurang dari
    sekian hari (bawaan 0: semua 149 artikel ikut, penyaringan barang adalah
    bagian metode di sisi model).
    """
    df = baca(berkas)
    tanggal = _rentang(df)
    buka = pd.DatetimeIndex(df["tanggal"].unique())
    tutup = ~tanggal.isin(buka)

    tabel = (
        df.groupby(["artikel", "tanggal"])["jumlah"].sum()
        .unstack("tanggal")
        .reindex(columns=tanggal)
        .fillna(0.0)
    )
    nilai_semua = tabel.to_numpy(dtype=float)
    nilai_semua[:, tutup] = np.nan

    tgl = np.array([t.date() for t in tanggal])
    libur = _libur(tanggal)
    salah = np.zeros(len(tanggal), dtype=bool)
    laku = df[(df["jumlah"] > 0) & (df["harga"] > 0)]
    harga = laku.groupby("artikel")["harga"].median()

    hasil = []
    for i, artikel in enumerate(tabel.index):
        v = nilai_semua[i].copy()
        if int((v > 0).sum()) < min_hari_laku:
            continue
        hasil.append(
            DeretBarang(
                barang_id=i + 1,
                usaha_id=ENTITAS_ID,
                nama=str(artikel),
                tanggal=tgl.copy(),
                nilai=v,
                stok_habis=salah.copy(),
                hari_libur=libur.copy(),
                pekan_gajian=salah.copy(),
                ramadan=salah.copy(),
                harga_satuan=float(harga[artikel]) if artikel in harga.index else None,
            )
        )
    return hasil


def omset(berkas: str | Path = BERKAS) -> pd.DataFrame:
    """
    Omset (euro), jumlah potong bersih, dan jumlah nota per hari.

    * `omset` = jumlah (jumlah x harga) seluruh baris, pengembalian mengurangi.
    * `jumlah_barang` = jumlah potong bersih (Quantity dijumlah, retur mengurangi).
    * `jumlah_nota` = nota dengan jumlah bersih positif. Nota yang isinya hanya
      pengembalian tidak dihitung sebagai pembeli.
    """
    df = baca(berkas)
    tanggal = _rentang(df)

    per_nota = df.groupby(["tanggal", "nota"])["jumlah"].sum()
    nota_beli = (per_nota > 0).groupby(level="tanggal").sum()
    harian = df.groupby("tanggal").agg(omset=("nilai", "sum"), jumlah_barang=("jumlah", "sum"))
    harian["jumlah_nota"] = nota_beli.reindex(harian.index).astype(float)
    harian["omset"] = harian["omset"].round(2)

    n = len(tanggal)
    salah = np.zeros(n, dtype=bool)
    return bingkai_omset(
        ENTITAS_ID,
        tanggal,
        harian,
        _libur(tanggal),
        salah,
        salah,
        salah,
        np.full(n, np.nan),
    )
