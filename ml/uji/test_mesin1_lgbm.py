"""
Uji LightGBM kuantil produksi Mesin 1 pada deret buatan; tidak butuh basis data.

    python -m pytest ml/uji/test_mesin1_lgbm.py -q
"""

from datetime import timedelta

import numpy as np

from ml.mesin1 import lgbm as L
from ml.mesin1.dasar import TARAF
from ml.uji.test_mesin1_sarima import _deret


def test_kuantil_tidak_menyilang_dan_tidak_negatif():
    # Dua barang, karena modelnya global (dilatih bersama semua deret).
    deret = [_deret(), _deret(n=120)]
    hasil = L.ramal_kuantil([(d, len(d)) for d in deret], 30, n_estimators=60, n_jobs=1)
    assert len(hasil) == 2
    for r in hasil:
        assert set(r) == set(TARAF)
        for t in TARAF:
            assert r[t].shape == (30,) and np.all(np.isfinite(r[t])) and np.all(r[t] >= 0)
        assert np.all(r[0.1] <= r[0.5]) and np.all(r[0.5] <= r[0.9])
    # Pola mingguan tertangkap: hari ramai (Sabtu) di atas hari sepi (Senin).
    d, r = deret[0], hasil[0]
    hari = [(d.tanggal[-1] + timedelta(days=i + 1)).weekday() for i in range(30)]
    sabtu = np.mean([r[0.5][i] for i in range(30) if hari[i] == 5])
    senin = np.mean([r[0.5][i] for i in range(30) if hari[i] == 0])
    assert sabtu > senin


def test_uji_balik_tidak_melihat_data_sesudah_titik_asal():
    # Ramalan dari titik asal di tengah deret tidak boleh berubah kalau data
    # sesudah titik itu diubah: itulah syarat garis uji balik di grafik.
    d = _deret()
    akhir = len(d) - 14
    a = L.ramal_kuantil([(d, akhir)], 14, n_estimators=60, n_jobs=1)[0]
    d.nilai[akhir:] = 999.0
    b = L.ramal_kuantil([(d, akhir)], 14, n_estimators=60, n_jobs=1)[0]
    for t in TARAF:
        assert np.allclose(a[t], b[t])
