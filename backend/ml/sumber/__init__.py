"""
Satu pintu untuk semua sumber data model.

    from ml import sumber

    deret = sumber.muat("simulasi", bentuk="deret")        # list[DeretBarang]
    omset = sumber.muat("french_bakery", bentuk="omset")   # DataFrame KOLOM_OMSET

Kontraknya ditulis lengkap di `README.md` di folder ini dan disepakati sesi Data
dan sesi Model pada 10 Okt 2026. Ringkasnya:

* Data simulasi menjalankan aplikasi. Data nyata hanya untuk **validasi metode**:
  tiap dataset dilatih dan diuji di dirinya sendiri, dan tidak ada parameter
  yang dipindah ke Warungku.
* Kode model tidak pernah membaca tabel atau berkas sendiri. Semua lewat
  `muat`, supaya beda hasil antar model tidak tercampur dengan beda cara
  mengambil datanya (alasan yang sama dengan `ml/data.py`).
* Setiap keluaran DataFrame diperiksa terhadap kontrak sebelum dikembalikan.
  Kalau adaptor melanggar kontrak, yang muncul adalah galat di sini, bukan angka
  model yang pelan-pelan salah.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

SUMBER = ("simulasi", "french_bakery", "online_retail")
BENTUK = ("deret", "omset", "rfm", "pesanan", "counterfactual")

#: Bentuk "omset" (Mesin 1, multivariat): satu baris per entitas per hari.
KOLOM_OMSET = (
    "entitas_id",
    "tanggal",
    "omset",
    "jumlah_barang",
    "jumlah_nota",
    "libur",
    "pekan_gajian",
    "ramadan",
    "lebaran",
    "data_hilang",
    "stok_habis_parsial",
)

#: Bentuk "rfm" (Mesin 3): satu baris per pasangan distributor-pelanggan.
KOLOM_RFM = (
    "distributor_id",
    "pelanggan_id",
    "recency",
    "frequency",
    "monetary",
    "lama_berlangganan",
    "jenis_usaha",
    "kategori_utama",
)

#: Sumber mana menyediakan bentuk apa. Selain yang tertulis di sini, `muat`
#: menolak dengan pesan yang menyebut alasannya.
TERSEDIA: dict[str, tuple[str, ...]] = {
    "simulasi": ("deret", "omset", "rfm", "pesanan", "counterfactual"),
    "french_bakery": ("deret", "omset"),
    "online_retail": (),
}

_ALASAN = {
    ("french_bakery", "rfm"): "toko roti tidak punya data pelanggan",
    ("french_bakery", "pesanan"): "Mesin 2 hanya diuji di simulasi (keputusan 10 Okt 2026)",
    ("french_bakery", "counterfactual"): "Mesin 2 hanya diuji di simulasi (keputusan 10 Okt 2026)",
}


def muat(sumber: str, bentuk: str, **opsi: Any):
    """
    sumber: "simulasi" | "french_bakery" | "online_retail"
    bentuk: "deret" | "omset" | "rfm" | "pesanan" | "counterfactual"

    `opsi` diteruskan ke adaptornya (mis. `min_riwayat` untuk deret simulasi,
    `berkas` untuk French Bakery, `tanggal_acuan` untuk RFM).
    """
    if sumber not in SUMBER:
        raise ValueError("sumber tidak dikenal: %r. Pilihan: %s" % (sumber, ", ".join(SUMBER)))
    if bentuk not in BENTUK:
        raise ValueError("bentuk tidak dikenal: %r. Pilihan: %s" % (bentuk, ", ".join(BENTUK)))
    if sumber == "online_retail":
        raise NotImplementedError(
            "Adaptor Online Retail II belum dibuat: usulannya (validasi Mesin 3) masih "
            "berstatus Diusulkan di sheet Catatan Perubahan, belum disetujui."
        )
    if bentuk not in TERSEDIA[sumber]:
        alasan = _ALASAN.get((sumber, bentuk), "tidak tersedia")
        raise ValueError("%s tidak menyediakan bentuk %r: %s" % (sumber, bentuk, alasan))

    if sumber == "simulasi":
        from . import simulasi as adaptor
    else:
        from . import french_bakery as adaptor

    hasil = getattr(adaptor, bentuk)(**opsi)
    if bentuk == "omset":
        periksa_omset(hasil)
    elif bentuk == "rfm":
        periksa_rfm(hasil)
    return hasil


# --------------------------------------------------------------------------
# Penjaga kontrak
# --------------------------------------------------------------------------
def periksa_omset(df: pd.DataFrame) -> None:
    """Melempar ValueError kalau `df` melanggar kontrak bentuk "omset"."""
    if tuple(df.columns) != KOLOM_OMSET:
        raise ValueError("kolom omset harus %s, didapat %s" % (KOLOM_OMSET, tuple(df.columns)))
    if not pd.api.types.is_datetime64_any_dtype(df["tanggal"]):
        raise ValueError("kolom tanggal harus datetime64, didapat %s" % df["tanggal"].dtype)
    for k in ("libur", "pekan_gajian", "ramadan", "lebaran", "data_hilang"):
        if df[k].dtype != bool:
            raise ValueError("kolom %s harus bool, didapat %s" % (k, df[k].dtype))
    if df.duplicated(["entitas_id", "tanggal"]).any():
        raise ValueError("ada entitas-tanggal ganda")

    # Tanggal lengkap tanpa bolong: hari tutup tetap punya baris.
    for e, g in df.groupby("entitas_id", sort=False):
        t = g["tanggal"].sort_values()
        rentang = (t.iloc[-1] - t.iloc[0]).days + 1
        if rentang != len(t):
            raise ValueError(
                "entitas %s: %d baris untuk rentang %d hari, ada tanggal bolong" % (e, len(t), rentang)
            )

    angka = df[["omset", "jumlah_barang", "jumlah_nota"]]
    hilang = df["data_hilang"].to_numpy()
    if angka[hilang].notna().any().any():
        raise ValueError("baris data_hilang harus berisi NaN, bukan angka")
    if angka[~hilang].isna().any().any():
        raise ValueError("baris yang tidak hilang tidak boleh berisi NaN")
    if (angka[~hilang] < 0).any().any():
        raise ValueError("omset, jumlah_barang, dan jumlah_nota tidak boleh negatif")


def periksa_rfm(df: pd.DataFrame) -> None:
    """Melempar ValueError kalau `df` melanggar kontrak bentuk "rfm"."""
    if tuple(df.columns) != KOLOM_RFM:
        raise ValueError("kolom rfm harus %s, didapat %s" % (KOLOM_RFM, tuple(df.columns)))
    if df.duplicated(["distributor_id", "pelanggan_id"]).any():
        raise ValueError("ada pasangan distributor-pelanggan ganda")
    if df[["recency", "frequency", "monetary", "lama_berlangganan"]].isna().any().any():
        raise ValueError("kolom angka RFM tidak boleh kosong")


def bingkai_omset(
    entitas_id: int,
    tanggal: pd.DatetimeIndex,
    angka: pd.DataFrame,
    libur: np.ndarray,
    pekan_gajian: np.ndarray,
    ramadan: np.ndarray,
    lebaran: np.ndarray,
    stok_habis_parsial: np.ndarray,
) -> pd.DataFrame:
    """
    Merangkai satu entitas menjadi bentuk "omset" bertanggal lengkap.

    `angka` berindeks tanggal (hanya hari yang ada catatannya) dengan kolom
    omset, jumlah_barang, jumlah_nota. Hari yang tidak ada di `angka` menjadi
    `data_hilang=True` dengan angka NaN.
    """
    angka = angka.reindex(tanggal)
    hilang = angka["omset"].isna().to_numpy()
    return pd.DataFrame(
        {
            "entitas_id": np.full(len(tanggal), entitas_id, dtype=np.int64),
            "tanggal": tanggal.to_numpy(dtype="datetime64[ns]"),
            "omset": angka["omset"].to_numpy(dtype=float),
            "jumlah_barang": angka["jumlah_barang"].to_numpy(dtype=float),
            "jumlah_nota": angka["jumlah_nota"].to_numpy(dtype=float),
            "libur": np.asarray(libur, dtype=bool),
            "pekan_gajian": np.asarray(pekan_gajian, dtype=bool),
            "ramadan": np.asarray(ramadan, dtype=bool),
            "lebaran": np.asarray(lebaran, dtype=bool),
            "data_hilang": hilang,
            "stok_habis_parsial": np.asarray(stok_habis_parsial, dtype=float),
        }
    )
