"""Uji bagian percobaan penyetelan yang tidak butuh basis data."""

import numpy as np

from ml.eksperimen.mesin2_penyetelan import BetaPeluruhan, LapisFuzzy, LapisLinear
from ml.eksperimen.mesin3_stabilitas import eta_kuadrat, gower, ukuran_terkecil
from ml.mesin2.fuzzy import ATURAN_BAWAAN


def test_peluruhan_satu_sama_dengan_beta_biasa():
    a = BetaPeluruhan(1.0, daring=True)
    for h in (1, 1, 0, 1):
        a.perbarui((1, False, False), h)
    assert a.parameter((1, False, False)) == (4.0, 2.0)


def test_peluruhan_melupakan_hitungan_lama():
    a = BetaPeluruhan(0.5, daring=True)
    a.perbarui((1, False, False), 1)   # sukses 1
    a.perbarui((1, False, False), 0)   # sukses 0,5, gagal 1
    sukses, gagal = a.sukses[(1, False, False)], a.gagal[(1, False, False)]
    assert abs(sukses - 0.5) < 1e-12 and abs(gagal - 1.0) < 1e-12


def test_lapis_linear_nol_tidak_mengubah_skor():
    skor = np.array([0.4, 0.9, 0.6])
    assert np.allclose(LapisLinear(0.0)(skor, np.array([1.0, 1.2, 1.1])), skor)


def test_lapis_fuzzy_c1_sama_dengan_produksi():
    skor = np.array([0.5, 0.8])
    rasio = np.array([1.05, 1.15])
    assert np.allclose(LapisFuzzy(1.0)(skor, rasio), ATURAN_BAWAAN.skor(skor, rasio))


def test_gower_simetris_dan_nol_di_diagonal():
    X = np.array([[1.0, 10.0], [2.0, 30.0], [4.0, 20.0]])
    K = np.array([["a"], ["a"], ["b"]], dtype=object)
    D = gower(X, K)
    assert np.allclose(D, D.T) and np.allclose(np.diag(D), 0.0)
    assert 0.0 <= D.min() and D.max() <= 1.0


def test_eta_kuadrat_batas():
    x = np.array([1.0, 1.0, 5.0, 5.0])
    assert abs(eta_kuadrat(x, np.array([0, 0, 1, 1])) - 1.0) < 1e-12
    assert abs(eta_kuadrat(x, np.array([0, 1, 0, 1]))) < 1e-12


def test_ukuran_terkecil_abaikan_derau():
    assert ukuran_terkecil(np.array([-1, 0, 0, 1, 1, 1])) == 2
