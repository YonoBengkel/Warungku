"""
Uji penaksir Beta-Bernoulli dan inferensi fuzzy Mesin 2.

Kedua komponen ini dipilih karena bisa dihitung tangan. Uji di sini memastikan
hitungan kodenya memang sama dengan hitungan tangan itu — kalau tidak, klaim
"setara TOPSIS, bisa dicek di Excel" tidak berlaku.

    python -m pytest ml/uji/test_mesin2_sederhana.py -q
"""

from __future__ import annotations

import numpy as np
import pytest

from ml.data import FITUR
from ml.mesin2.beta import BetaBernoulli, kunci_dari
from ml.mesin2.fuzzy import ATURAN_BAWAAN, AturanFuzzy, bahu_kanan, bahu_kiri, segitiga

X0 = np.zeros(len(FITUR))


# --------------------------------------------------------------------------
# Beta-Bernoulli
# --------------------------------------------------------------------------
def test_prior_seragam_sebelum_ada_pesanan():
    b = BetaBernoulli()
    p, s = b.peluang_dan_sebaran(X0[None, :], kunci=[(1, False, False)])
    assert p[0] == pytest.approx(0.5)
    # Beta(1, 1): sebaran = akar(1 / (4 * 3))
    assert s[0] == pytest.approx(np.sqrt(1 / 12))


def test_contoh_hitung_tangan_di_diskusi():
    """Distributor A 45 sukses 5 gagal, distributor B 2 sukses 0 gagal."""
    b = BetaBernoulli()
    a_k, b_k = (1, False, False), (2, False, False)
    for _ in range(45):
        b.perbarui(a_k, 1)
    for _ in range(5):
        b.perbarui(a_k, 0)
    for _ in range(2):
        b.perbarui(b_k, 1)

    assert b.parameter(a_k) == (46, 6)
    assert b.parameter(b_k) == (3, 1)
    p, _ = b.peluang_dan_sebaran(np.zeros((2, len(FITUR))), kunci=[a_k, b_k])
    assert p[0] == pytest.approx(46 / 52)
    assert p[1] == pytest.approx(0.75)

    # B menang undian sekitar 30% kali. Nilai pastinya 1 - E[A^3] untuk
    # A ~ Beta(46, 6), yaitu 1 - (46*47*48)/(52*53*54) = 0,3027.
    acak = np.random.default_rng(1)
    menang_b = np.mean([b.cuplik([a_k, b_k], acak).argmax() == 1 for _ in range(20_000)])
    assert menang_b == pytest.approx(1 - (46 * 47 * 48) / (52 * 53 * 54), abs=0.015)


def test_latih_ulang_sama_dengan_pembaruan_satu_satu():
    acak = np.random.default_rng(3)
    kunci = [(int(d), bool(h), bool(k)) for d, h, k in acak.integers(0, 2, (300, 3))]
    y = acak.integers(0, 2, 300)

    satu_satu = BetaBernoulli(daring=True)
    for k, v in zip(kunci, y):
        satu_satu.perbarui(k, int(v))
    sekaligus = BetaBernoulli()
    sekaligus.latih(np.zeros((300, len(FITUR))), y, kunci=kunci)

    for k in set(kunci):
        assert satu_satu.parameter(k) == sekaligus.parameter(k)


def test_kunci_memisah_musim_dan_kota():
    x = X0.copy()
    x[FITUR.index("p_musim_hujan")] = 1.0
    x[FITUR.index("p_sekota")] = 0.0
    assert kunci_dari(5, x, pisah_konteks=True) == (5, True, False)
    # Bawaannya tidak memisah: di simulasi, pemisahan memperburuk regret.
    assert kunci_dari(5, x) == (5, False, False)


# --------------------------------------------------------------------------
# Fuzzy
# --------------------------------------------------------------------------
def test_fungsi_keanggotaan():
    assert segitiga(np.array([0.55, 0.625, 0.70, 0.85]), 0.55, 0.70, 0.85).tolist() == pytest.approx([0, 0.5, 1, 0])
    assert bahu_kiri(np.array([0.5, 0.625, 0.7]), 0.55, 0.70).tolist() == pytest.approx([1, 0.5, 0])
    assert bahu_kanan(np.array([0.7, 0.775, 0.9]), 0.70, 0.85).tolist() == pytest.approx([0, 0.5, 1])


def test_keanggotaan_saling_menutup_di_seluruh_rentang():
    """
    Di setiap titik, derajat keanggotaan tiga himpunan berjumlah 1. Kalau ada
    celah, ada masukan yang tidak menyalakan aturan apa pun.
    """
    a = ATURAN_BAWAAN
    k = np.linspace(0.0, 1.0, 101)
    r = np.linspace(0.95, 1.30, 71)
    assert a.keanggotaan_keandalan(k).sum(axis=1) == pytest.approx(np.ones_like(k))
    assert a.keanggotaan_harga(r).sum(axis=1) == pytest.approx(np.ones_like(r))


def test_skor_di_titik_puncak_sama_dengan_keluaran_aturan():
    """Pada titik puncak satu himpunan, hanya satu aturan menyala penuh."""
    a = ATURAN_BAWAAN
    assert a.skor(np.array([0.90]), np.array([1.00]))[0] == pytest.approx(1.00)  # tinggi, murah
    assert a.skor(np.array([0.70]), np.array([1.10]))[0] == pytest.approx(0.50)  # sedang, sedang
    assert a.skor(np.array([0.40]), np.array([1.25]))[0] == pytest.approx(0.00)  # rendah, mahal


def test_contoh_hitung_tangan_di_antara_himpunan():
    """
    Keandalan 0,775 = setengah sedang + setengah tinggi; harga 1,05 = setengah
    murah + setengah sedang. Empat aturan menyala dengan kekuatan 0,5:
    (sedang, murah) 0,70; (sedang, sedang) 0,50; (tinggi, murah) 1,00;
    (tinggi, sedang) 0,85. Rata-rata tertimbangnya 0,7625.
    """
    skor = ATURAN_BAWAAN.skor(np.array([0.775]), np.array([1.05]))[0]
    assert skor == pytest.approx((0.70 + 0.50 + 1.00 + 0.85) / 4)


def test_lebih_andal_atau_lebih_murah_tidak_pernah_menurunkan_skor():
    a = ATURAN_BAWAAN
    k = np.linspace(0.3, 0.95, 40)
    for r in (1.0, 1.05, 1.1, 1.15, 1.2):
        s = a.skor(k, np.full_like(k, r))
        assert np.all(np.diff(s) >= -1e-12)
    r = np.linspace(1.0, 1.25, 40)
    for kk in (0.5, 0.7, 0.85):
        s = a.skor(np.full_like(r, kk), r)
        assert np.all(np.diff(s) <= 1e-12)


def test_segmen():
    a = AturanFuzzy()
    assert a.segmen(np.array([0.9, 0.70, 0.6, 0.45, 0.2])) == [
        "sangat-layak", "sangat-layak", "layak", "layak", "kurang-layak",
    ]
