"""
Uji SARIMA produksi Mesin 1 pada deret buatan; tidak butuh basis data.

    python -m pytest ml/uji/test_mesin1_sarima.py -q
"""

from datetime import date, timedelta

import numpy as np

from ml.data import DeretBarang
from ml.mesin1 import sarima as S
from ml.mesin1.dasar import TARAF


def _deret(n: int = 140, akhir: date = date(2026, 3, 10), konstan: bool = False) -> DeretBarang:
    tanggal = np.array([akhir - timedelta(days=n - 1 - i) for i in range(n)])
    acak = np.random.default_rng(7)
    if konstan:
        nilai = np.full(n, 5.0)
    else:
        pola = np.array([8, 9, 10, 11, 14, 18, 16], dtype=float)
        nilai = np.array([pola[t.weekday()] for t in tanggal]) + acak.normal(0, 1.5, n)
        nilai = np.maximum(np.round(nilai), 0)
    from dataset.kalender import hari_libur, sedang_ramadan
    from dataset.pola import pekan_gajian

    return DeretBarang(
        barang_id=1, usaha_id=1, nama="uji", tanggal=tanggal, nilai=nilai.astype(float),
        stok_habis=np.zeros(n, dtype=bool),
        hari_libur=np.array([hari_libur(t) for t in tanggal]),
        pekan_gajian=np.array([pekan_gajian(t) for t in tanggal]),
        ramadan=np.array([sedang_ramadan(t) for t in tanggal]),
    )


def test_kalender_masa_depan_mengikuti_aturan_yang_sama():
    d = _deret()
    ex = S.kalender(d, len(d) - 3, len(d) + 30)
    assert ex.shape == (33, 3)
    # Tiga baris pertama berasal dari deret, sisanya dihitung dari tanggal.
    assert np.array_equal(ex[:3, 1], d.pekan_gajian[-3:].astype(float))
    # 2026-03-20 dan 21: Idulfitri 1447 H; 11 Mar - 19 Mar masih Ramadan.
    t_akhir = d.tanggal[-1]
    i_ramadan = (date(2026, 3, 15) - t_akhir).days - 1 + 3
    assert ex[i_ramadan, 2] == 1.0


def test_kuantil_tidak_menyilang_dan_tidak_negatif():
    d = _deret()
    r = S.sarima_kuantil(d, len(d), 30)
    assert set(r) == set(TARAF)
    for t in TARAF:
        assert r[t].shape == (30,) and np.all(r[t] >= 0)
    assert np.all(r[0.1] <= r[0.5]) and np.all(r[0.5] <= r[0.9])
    # Pola mingguan tertangkap: hari ramai (Sabtu) di atas hari sepi (Senin).
    hari = [(d.tanggal[-1] + timedelta(days=i + 1)).weekday() for i in range(30)]
    sabtu = np.mean([r[0.5][i] for i in range(30) if hari[i] == 5])
    senin = np.mean([r[0.5][i] for i in range(30) if hari[i] == 0])
    assert sabtu > senin


def test_deret_terlalu_pendek_jatuh_ke_ets():
    d = _deret(n=20)
    r = S.sarima(d, len(d), 7)
    assert set(r) == set(TARAF) and all(np.isfinite(r[t]).all() for t in TARAF)
