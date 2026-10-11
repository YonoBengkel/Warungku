"""
Uji turnamen Mesin 1: metrik, rank-sum, pengelompokan, dan kebocoran LightGBM.

Data buatan dengan jawaban yang diketahui, tanpa basis data.

    python -m pytest ml/uji/test_mesin1_turnamen.py -q
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pytest

from ml.data import DeretBarang
from ml.mesin1 import turnamen as T


def _deret(nilai, bid=1):
    n = len(nilai)
    tgl = np.array([date(2026, 1, 5) + timedelta(days=i) for i in range(n)])
    z = np.zeros(n, dtype=bool)
    return DeretBarang(bid, 1, "barang-%d" % bid, tgl, np.asarray(nilai, dtype=float), z, z, z, z)


def _ramalan(asli, ramal, sebelum):
    return T.Ramalan(1, 100, np.asarray(asli, float), np.asarray(ramal, float), float(sebelum))


def test_ukur_dihitung_tangan():
    # Jumlah asli 70, ramalan 63: APE pekanan 10%.
    asli = [10, 12, 8, 10, 10, 10, 10]
    ramal = [9, 9, 9, 9, 9, 9, 9]
    m = T.ukur([_ramalan(asli, ramal, sebelum=10)])
    assert m["mape"] == pytest.approx(10.0)
    assert m["wape"] == pytest.approx(10.0)
    # Arah sebenarnya dari hari sebelumnya: 10->10 datar, 10->12 naik,
    # 12->8 turun, 8->10 naik, lalu tiga kali datar.
    # Arah ramalan (ramal[i] - asli[i-1]): 9-10 turun, 9-10 turun, 9-12 turun,
    # 9-8 naik, 9-10 turun x3. Cocok: hari ke-3 (turun) dan ke-4 (naik) = 2 dari 7.
    assert m["mda"] == pytest.approx(2 / 7 * 100)
    galat = np.array(asli) - 9
    assert m["rmse"] == pytest.approx(np.sqrt(np.mean(galat ** 2)))


def test_ukur_pekan_stok_habis_dikeluarkan_dari_mape():
    rusak = _ramalan([10, np.nan, 10, 10, 10, 10, 10], [10] * 7, 10)
    utuh = _ramalan([10] * 7, [12] * 7, 10)
    m = T.ukur([rusak, utuh])
    assert m["n_pekan"] == 1
    assert m["mape"] == pytest.approx(20.0)


def test_rank_sum_mda_besar_lebih_baik_dan_seri_ke_yang_sederhana():
    skor = {
        "chronos_2": {"mape": 10.0, "wape": 10.0, "mda": 60.0, "rmse": 5.0},
        "ets": {"mape": 10.0, "wape": 10.0, "mda": 60.0, "rmse": 5.0},
        "naif_musiman": {"mape": 20.0, "wape": 20.0, "mda": 90.0, "rmse": 9.0},
    }
    papan = T.rank_sum(skor)
    # ETS dan Chronos seri sempurna; ETS lebih sederhana, jadi menang.
    assert papan[0]["model"] == "ets"
    naif = next(b for b in papan if b["model"] == "naif_musiman")
    assert naif["peringkat_mda"] == 1  # MDA tertinggi = peringkat 1
    assert naif["peringkat_mape"] == 3


def test_rank_sum_nan_mendapat_peringkat_terburuk():
    skor = {
        "ets": {"mape": float("nan"), "wape": 10.0, "mda": 50.0, "rmse": 1.0},
        "sarima": {"mape": 30.0, "wape": 10.0, "mda": 50.0, "rmse": 1.0},
    }
    papan = T.rank_sum(skor)
    assert next(b for b in papan if b["model"] == "ets")["peringkat_mape"] == 2


def test_lightgbm_tidak_mengintip_masa_depan():
    """Mengubah nilai sesudah titik asal tidak boleh mengubah baris ramalan."""
    acak = np.random.default_rng(0)
    v = acak.poisson(20, 200).astype(float)
    akhir, h = 150, 7
    X1, _, s1 = T.fitur_lgbm(_deret(v), akhir, h)
    v2 = v.copy()
    v2[akhir:] *= 100
    X2, _, s2 = T.fitur_lgbm(_deret(v2), akhir, h)
    assert s1 == s2
    np.testing.assert_array_equal(X1[akhir : akhir + h], X2[akhir : akhir + h])


def test_kelompok_menemukan_tiga_gumpalan_dan_perwakilan_terdekat():
    acak = np.random.default_rng(1)
    pusat = np.array([[0.2, 0.0, 1.0, 0.1, 0.1], [0.8, 0.5, 3.0, 0.6, 0.8], [0.4, -0.5, 6.0, 0.3, 0.4]])
    X = np.vstack([p + acak.normal(0, 0.02, (30, 5)) for p in pusat])
    kel = T.kelompokkan(X)
    assert kel.k == 3
    wakil = T.perwakilan(kel, X, 2)
    Xs = kel.skala(X)
    for c, idx in wakil.items():
        anggota = np.flatnonzero(kel.label == c)
        jarak = np.linalg.norm(Xs[anggota] - kel.pusat[c], axis=1)
        assert idx[0] == anggota[np.argmin(jarak)]
    # Barang baru di dekat gumpalan pertama masuk kelompok yang sama.
    assert kel.tetapkan(pusat[:1])[0] == kel.label[0]


def test_bootstrap_selisih_arah_dan_hitungan():
    a = np.array([5.0, 5.0, 5.0, 5.0])
    b = np.array([10.0, 10.0, 10.0, 4.0])
    hasil = T.bootstrap_selisih(a, b, ulang=500)
    assert hasil["selisih"] == pytest.approx(5.0 - 8.5)
    assert hasil["a_lebih_baik"] == 3 and hasil["b_lebih_baik"] == 1
    assert hasil["bawah"] <= hasil["selisih"] <= hasil["atas"]
