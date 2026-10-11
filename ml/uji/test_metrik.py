"""
Uji metrik terhadap acuan luar dan terhadap kasus yang jawabannya bisa dihitung tangan.

Kenapa berkas ini ada. Seluruh angka di laporan bersandar pada fungsi-fungsi di
`ml/metrik.py`, dan beberapa di antaranya ditulis sendiri — AUC dengan
penanganan skor seri, WQL, NDCG. Fungsi metrik yang salah tidak pernah jatuh
dengan galat; ia memberi angka yang sedikit berbeda, laporan tetap terbaca
wajar, dan kesimpulannya salah tanpa ada yang tahu.

Jadi tiap fungsi diuji dua cara:

* terhadap `sklearn` untuk yang punya acuan luar (AUC, Brier, NDCG);
* terhadap kasus yang jawabannya bisa dihitung tangan untuk yang tidak (MASE,
  WQL, cakupan).

    python -m pytest -q
"""

from __future__ import annotations

import numpy as np
import pytest

from ml import metrik


# --------------------------------------------------------------------------
# AUC
# --------------------------------------------------------------------------
def test_auc_sama_dengan_sklearn():
    from sklearn.metrics import roc_auc_score

    acak = np.random.default_rng(20261006)
    for _ in range(20):
        n = int(acak.integers(20, 300))
        label = acak.integers(0, 2, n).astype(bool)
        if label.all() or not label.any():
            continue
        skor = acak.normal(size=n) + label * 0.8
        assert metrik.auc(label, skor) == pytest.approx(roc_auc_score(label, skor), abs=1e-9)


def test_auc_menangani_skor_seri():
    """
    Skor yang sama harus diberi peringkat rata-rata.

    Ini jebakannya: model yang mengeluarkan skor konstan punya AUC tepat 0,5.
    Kalau skor seri diurutkan sembarang, nilainya bisa keluar 0,0 atau 1,0
    tergantung urutan baris — dan model yang tidak memutuskan apa pun akan
    terlihat sempurna atau terburuk, keduanya salah.
    """
    label = np.array([True, False, True, False])
    assert metrik.auc(label, np.array([0.5, 0.5, 0.5, 0.5])) == pytest.approx(0.5)
    # Separuh seri: satu pasang terbedakan sempurna, satu pasang seri.
    assert metrik.auc(label, np.array([1.0, 0.5, 0.5, 0.0])) == pytest.approx(0.875)


def test_auc_tanpa_salah_satu_kelas_adalah_nan():
    """Satu kelas saja berarti AUC tidak terdefinisi — bukan 0, bukan 1."""
    assert np.isnan(metrik.auc(np.array([True, True]), np.array([0.1, 0.9])))
    assert np.isnan(metrik.auc(np.array([False, False]), np.array([0.1, 0.9])))


# --------------------------------------------------------------------------
# Brier
# --------------------------------------------------------------------------
def test_brier_sama_dengan_sklearn():
    from sklearn.metrics import brier_score_loss

    acak = np.random.default_rng(7)
    label = acak.integers(0, 2, 200)
    p = acak.random(200)
    assert metrik.brier(label, p) == pytest.approx(brier_score_loss(label, p), abs=1e-12)


def test_brier_ramalan_sempurna_nol():
    assert metrik.brier(np.array([1, 0, 1]), np.array([1.0, 0.0, 1.0])) == pytest.approx(0.0)


# --------------------------------------------------------------------------
# MASE
# --------------------------------------------------------------------------
def test_galat_naif_musiman_dihitung_tangan():
    # Deret naik 1 per hari: |y[t] - y[t-7]| selalu 7.
    v = np.arange(30, dtype=float)
    assert metrik.galat_naif_musiman(v, musim=7) == pytest.approx(7.0)


def test_mase_satu_berarti_setara_naif():
    """
    Pemeriksaan kalibrasi: ramalan naif musiman pada deret mana pun harus
    memberi MASE sekitar 1,0. Kalau tidak, penyebutnya salah, dan seluruh
    angka MASE di laporan tidak bisa dibaca sebagai "menang" atau "kalah".
    """
    acak = np.random.default_rng(3)
    v = 100 + 20 * np.sin(np.arange(200) * 2 * np.pi / 7) + acak.normal(0, 8, 200)
    latih, uji = v[:170], v[170:]
    penyebut = metrik.galat_naif_musiman(latih)
    naif = np.array([latih[-7 + (i % 7)] for i in range(len(uji))])
    # Toleransi lebar: ini uji skala, bukan uji nilai persis.
    assert 0.7 < metrik.mase(uji, naif, penyebut) < 1.4


def test_mase_penyebut_nol_jadi_nan():
    """Deret rata (barang yang tidak pernah laku) tidak punya MASE."""
    assert np.isnan(metrik.galat_naif_musiman(np.ones(30)))
    assert np.isnan(metrik.mase(np.ones(5), np.ones(5), float("nan")))


# --------------------------------------------------------------------------
# Kuantil / WQL
# --------------------------------------------------------------------------
def test_galat_kuantil_menghukum_tidak_simetris():
    """
    Untuk p90, meramal terlalu RENDAH harus dihukum sembilan kali lebih berat.
    Itulah yang membuat p90 berguna untuk batas aman: kehabisan stok lebih
    mahal daripada kelebihan sedikit.
    """
    terlalu_rendah = metrik.galat_kuantil(np.array([100.0]), np.array([90.0]), 0.9)
    terlalu_tinggi = metrik.galat_kuantil(np.array([100.0]), np.array([110.0]), 0.9)
    assert terlalu_rendah[0] == pytest.approx(9.0)
    assert terlalu_tinggi[0] == pytest.approx(1.0)
    assert terlalu_rendah[0] / terlalu_tinggi[0] == pytest.approx(9.0)

    # Untuk p10 kebalikannya.
    assert metrik.galat_kuantil(np.array([100.0]), np.array([90.0]), 0.1)[0] == pytest.approx(1.0)
    assert metrik.galat_kuantil(np.array([100.0]), np.array([110.0]), 0.1)[0] == pytest.approx(9.0)


def test_wql_sempurna_nol():
    asli = np.array([10.0, 20.0, 30.0])
    tepat = {0.1: asli, 0.5: asli, 0.9: asli}
    assert metrik.wql(asli, tepat) == pytest.approx(0.0)


def test_wql_memburuk_saat_selang_melebar_tanpa_perlu():
    asli = np.array([100.0] * 10)
    sempit = {0.1: asli * 0.95, 0.5: asli, 0.9: asli * 1.05}
    lebar = {0.1: asli * 0.3, 0.5: asli, 0.9: asli * 3.0}
    assert metrik.wql(asli, sempit) < metrik.wql(asli, lebar)


def test_cakupan_dihitung_tangan():
    asli = np.array([1.0, 5.0, 9.0, 20.0])
    bawah = np.array([0.0, 0.0, 0.0, 0.0])
    atas = np.array([10.0, 10.0, 10.0, 10.0])
    assert metrik.cakupan(asli, bawah, atas) == pytest.approx(0.75)


# --------------------------------------------------------------------------
# Peringkat
# --------------------------------------------------------------------------
def test_ndcg_sama_dengan_sklearn():
    from sklearn.metrics import ndcg_score

    acak = np.random.default_rng(11)
    for _ in range(20):
        n = int(acak.integers(2, 9))
        relevan = acak.integers(0, 2, n)
        if relevan.sum() == 0:
            continue
        skor = acak.random(n)
        k = min(3, n)
        acuan = ndcg_score(relevan.reshape(1, -1), skor.reshape(1, -1), k=k)
        assert metrik.ndcg_k(relevan, skor, k=3) == pytest.approx(acuan, abs=1e-9)


def test_presisi_1_memeriksa_peringkat_teratas():
    assert metrik.presisi_1(np.array([0, 1, 0]), np.array([0.1, 0.9, 0.2])) == 1.0
    assert metrik.presisi_1(np.array([0, 1, 0]), np.array([0.9, 0.1, 0.2])) == 0.0


def test_sesal_nol_kalau_memilih_yang_terbaik():
    assert metrik.sesal(1.0, 1.0) == pytest.approx(0.0)
    assert metrik.sesal(0.0, 1.0) == pytest.approx(1.0)
