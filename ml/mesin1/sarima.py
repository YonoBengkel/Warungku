"""
SARIMA untuk produksi Mesin 1: ramalan unit per barang beserta kuantil.

Menggantikan ETS (Holt-Winters) sebagai model produksi sejak 12 Okt 2026,
atas dasar turnamen Mesin 1 (`ml/mesin1/turnamen.py`, `ml/hasil/hasil_mesin1_turnamen.json`):
MAPE pekanan 14,8% vs ETS 17,5% di pekan uji, 14,3% vs 15,1% di validasi.

Modelnya sama dengan `turnamen.sarima_satu`: SARIMAX(1,0,1)(0,1,1)7 pada
log1p unit, 200 hari konteks, kalender (libur, pekan gajian, Ramadan) sebagai
peubah luar, orde tetap untuk semua barang. Yang ditambahkan di sini dua hal
yang dibutuhkan produksi dan tidak dibutuhkan turnamen:

1. **Kuantil, bukan satu titik.** Batas aman memakai p90, jadi sebaran itulah
   keluaran yang sebenarnya. SARIMAX memberi rata-rata dan simpangan baku
   ramalan pada skala log1p; kuantil normal di skala itu lalu dikembalikan
   dengan expm1. Karena expm1 monoton, kuantil di skala log tetap kuantil di
   skala unit (tidak berlaku untuk rata-rata, jadi p50 = median, bukan mean).
2. **Kalender masa depan.** Turnamen meramal titik di dalam deret, sehingga
   kalendernya sudah ada. Produksi meramal 30 hari sesudah ujung deret; kalender
   hari-hari itu dihitung dengan fungsi yang sama dengan yang membangun kolom di
   basis data (`dataset.kalender`, `dataset.pola`; kecocokannya 100% pada
   seluruh deret simulasi).

Pemasangan model bisa gagal per barang (deret pendek, datar, atau tidak
menyatu). Barang itu memakai ETS — bukan NaN, karena NaN di tabel `prediksi`
berarti barang tanpa batas aman sama sekali.
"""

from __future__ import annotations

import warnings
from datetime import timedelta

import numpy as np

from ..data import DeretBarang
from .dasar import TARAF, Ramalan, _rapikan, holt_winters

ORDE = (1, 0, 1)
ORDE_MUSIM = (0, 1, 1, 7)
KONTEKS = 200
#: Deret lebih pendek dari ini langsung memakai ETS: dengan pembedaan musiman
#: 7 hari, SARIMA butuh beberapa pekan penuh sebelum taksirannya berarti.
MIN_PANJANG = 5 * 7


def kalender(d: DeretBarang, awal: int, akhir: int) -> np.ndarray:
    """
    Matriks (akhir - awal, 3): libur, pekan gajian, Ramadan, untuk indeks awal..akhir-1.

    Indeks di luar deret (masa depan) dihitung dari tanggal, dengan aturan yang
    sama dengan kolom di basis data.
    """
    from dataset.kalender import hari_libur, sedang_ramadan
    from dataset.pola import pekan_gajian

    n = len(d)
    baris = []
    for i in range(awal, akhir):
        if i < n:
            baris.append((d.hari_libur[i], d.pekan_gajian[i], d.ramadan[i]))
        else:
            t = d.tanggal[-1] + timedelta(days=i - n + 1)
            baris.append((hari_libur(t), pekan_gajian(t), sedang_ramadan(t)))
    return np.asarray(baris, dtype=float)


def _normal_ppf(q: float) -> float:
    from statistics import NormalDist

    return NormalDist().inv_cdf(q)


def sarima_kuantil(d: DeretBarang, akhir_latih: int, cakrawala: int) -> Ramalan:
    """SARIMA dengan kuantil TARAF. Melempar galat kalau pemasangan gagal."""
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    awal = max(0, akhir_latih - KONTEKS)
    y = np.log1p(np.asarray(d.nilai[awal:akhir_latih], dtype=float))
    if np.isfinite(y).sum() < MIN_PANJANG:
        raise ValueError("deret terlalu pendek untuk SARIMA")
    ex = kalender(d, awal, akhir_latih + cakrawala)
    latih, depan = ex[: akhir_latih - awal], ex[akhir_latih - awal :]
    # Kolom yang konstan di data latih membuat matriks singular: dibuang.
    pakai = [j for j in range(ex.shape[1]) if np.ptp(latih[:, j]) > 0]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pas = SARIMAX(
            y, exog=latih[:, pakai] if pakai else None, order=ORDE, seasonal_order=ORDE_MUSIM
        ).fit(disp=False, maxiter=100)
        f = pas.get_forecast(cakrawala, exog=depan[:, pakai] if pakai else None)
    rata = np.asarray(f.predicted_mean, dtype=float)
    sb = np.sqrt(np.maximum(np.asarray(f.var_pred_mean, dtype=float), 0.0))
    if not (np.isfinite(rata).all() and np.isfinite(sb).all()):
        raise ValueError("ramalan SARIMA tidak hingga")
    hasil = {t: np.maximum(np.expm1(rata + _normal_ppf(t) * sb), 0.0) for t in TARAF}
    return _rapikan(hasil)


def sarima(deret: DeretBarang, akhir_latih: int, cakrawala: int) -> Ramalan:
    """Antarmuka sama dengan `dasar.METODE`: SARIMA, atau ETS kalau SARIMA gagal."""
    try:
        return sarima_kuantil(deret, akhir_latih, cakrawala)
    except Exception:
        return holt_winters(deret, akhir_latih, cakrawala)
