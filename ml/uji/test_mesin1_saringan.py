"""
Uji MAPE, skala Lewis, saringan barang, dan pencilan Mahalanobis.

Semua uji di sini memakai data buatan dengan jawaban yang diketahui, tidak
membaca basis data. Saringan dan pencilan menentukan barang mana yang diramal
dan hari mana yang diabaikan saat melatih; kalau salah, kesalahannya tidak
kelihatan sebagai galat, hanya sebagai MAPE yang aneh.

    python -m pytest ml/uji/test_mesin1_saringan.py -q
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from ml import metrik
from ml.data import DeretBarang
from ml.mesin1.pencilan import tandai
from ml.mesin1.saringan import kekuatan_musiman, saring, syntetos_boylan


# --------------------------------------------------------------------------
# MAPE dan Lewis
# --------------------------------------------------------------------------
def test_mape_dihitung_tangan_dan_nol_dikeluarkan():
    # (10/100 + 10/50) / 2 = 15%; periode bernilai nol dibuang.
    assert metrik.mape([100, 0, 50], [90, 5, 60]) == pytest.approx(15.0)


def test_mape_mengabaikan_nan():
    assert metrik.mape([100, np.nan, 50], [90, 1, 60]) == pytest.approx(15.0)


def test_wape_dihitung_tangan():
    assert metrik.wape([100, 0, 50], [90, 5, 60]) == pytest.approx(25 / 150 * 100)


@pytest.mark.parametrize(
    "nilai, kategori",
    [(4.9, "sangat akurat"), (9.99, "sangat akurat"), (10.0, "baik"), (24.4, "layak"),
     (50.0, "tidak akurat"), (float("nan"), "tidak terdefinisi")],
)
def test_skala_lewis(nilai, kategori):
    assert metrik.kategori_lewis(nilai) == kategori


# --------------------------------------------------------------------------
# Syntetos–Boylan dan musiman
# --------------------------------------------------------------------------
def test_syntetos_boylan_empat_pola():
    acak = np.random.default_rng(0)
    halus = acak.normal(100, 10, 56)
    terputus = np.where(np.arange(56) % 3 == 0, 100.0, 0.0)
    tak_menentu = acak.lognormal(4, 1.0, 56)
    bergumpal = np.where(np.arange(56) % 4 == 0, acak.lognormal(4, 1.0, 56), 0.0)
    assert syntetos_boylan(halus)[2] == "halus"
    assert syntetos_boylan(terputus)[2] == "terputus"
    assert syntetos_boylan(tak_menentu)[2] == "tak menentu"
    assert syntetos_boylan(bergumpal)[2] == "bergumpal"


def test_syntetos_boylan_hari_stok_habis_bukan_nol():
    """Hari stok habis (NaN) dibuang, bukan dihitung sebagai permintaan nol."""
    v = np.full(56, 100.0)
    v[::3] = np.nan
    adi, _, pola = syntetos_boylan(v)
    assert adi == pytest.approx(1.0)
    assert pola == "halus"


def test_kekuatan_musiman_membedakan_pola():
    acak = np.random.default_rng(1)
    t = np.arange(84)
    musiman = 100 + 40 * np.sin(2 * np.pi * t / 7) + acak.normal(0, 3, 84)
    datar = 100 + acak.normal(0, 10, 84)
    assert kekuatan_musiman(musiman) > 0.8
    assert kekuatan_musiman(datar) < 0.4


def _deret(bid, uid, nilai, harga=None):
    n = len(nilai)
    tgl = np.array([date(2026, 1, 1) + timedelta(days=i) for i in range(n)])
    z = np.zeros(n, dtype=bool)
    d = DeretBarang(bid, uid, "barang-%d" % bid, tgl, np.asarray(nilai, dtype=float), z, z, z, z)
    if harga is not None:
        d.harga_satuan = harga
    return d


def test_saring_abc_memakai_nilai_bukan_unit():
    """
    Barang A: 1.000 gram/hari x Rp1 = Rp1.000. Barang B: 10 pcs/hari x Rp500
    = Rp5.000. Menurut unit A lebih besar; menurut nilai B lebih penting.
    """
    acak = np.random.default_rng(2)
    a = _deret(1, 1, 1000 + acak.normal(0, 30, 56))
    b = _deret(2, 1, 10 + acak.normal(0, 0.3, 56))
    hasil = {h.barang_id: h for h in saring([a, b], {1: 1.0, 2: 500.0}, teratas=1)}
    assert hasil[2].peringkat_nilai == 1 and hasil[2].lolos_abc
    assert hasil[1].peringkat_nilai == 2 and not hasil[1].lolos_abc


def test_saring_tidak_mengintip_masa_depan():
    """Pola yang baru muncul sesudah `akhir` tidak boleh memengaruhi keputusan."""
    v = np.concatenate([np.where(np.arange(56) % 4 == 0, 50.0, 0.0), np.full(56, 100.0)])
    d = _deret(1, 1, v)
    sebelum = saring([d], akhir=56)[0]
    sesudah = saring([d])[0]
    assert sebelum.pola == "terputus"
    assert sesudah.pola == "halus"


# --------------------------------------------------------------------------
# Pencilan
# --------------------------------------------------------------------------
def _omset(n=200, seed=3):
    acak = np.random.default_rng(seed)
    tgl = pd.date_range("2026-01-01", periods=n, freq="D")
    nota = 100 * (1 + 0.3 * (tgl.weekday >= 5)) * acak.lognormal(0, 0.05, n)
    barang = nota * 2.5 * acak.lognormal(0, 0.03, n)
    omset = nota * 20_000 * acak.lognormal(0, 0.03, n)
    return pd.DataFrame(
        {
            "entitas_id": 1, "tanggal": tgl, "omset": omset, "jumlah_barang": barang,
            "jumlah_nota": nota, "libur": False, "pekan_gajian": False, "ramadan": False,
            "lebaran": False, "data_hilang": False, "stok_habis_parsial": np.nan,
        }
    )


def test_pencilan_menangkap_kombinasi_janggal_bukan_akhir_pekan():
    df = _omset()
    # Hari 100: omset tiga kali lipat tapi nota biasa — pembelian borongan
    # atau salah catat. Masing-masing kolom lain normal.
    df.loc[100, "omset"] *= 3
    hasil = tandai(df)
    assert bool(hasil.loc[100, "pencilan"])
    # Akhir pekan yang memang ramai tidak boleh ikut ditandai massal.
    akhir_pekan = hasil[pd.to_datetime(hasil["tanggal"]).dt.weekday >= 5]
    assert akhir_pekan["pencilan"].mean() < 0.05


def test_lebaran_tidak_ditandai_pencilan():
    df = _omset()
    df.loc[120, ["omset", "jumlah_barang", "jumlah_nota"]] *= 0.15
    df.loc[120, "lebaran"] = True
    hasil = tandai(df)
    assert not bool(hasil.loc[120, "pencilan"])
    assert bool(hasil.loc[120, "dijelaskan_kalender"])
