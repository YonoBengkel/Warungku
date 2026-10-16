"""
LightGBM kuantil untuk produksi Mesin 1: ramalan unit per barang, p10/p50/p90.

Menggantikan SARIMA sebagai model produksi sejak 16 Okt 2026 atas permintaan
dosen pengampu. Di turnamen (`turnamen.py`) LightGBM dan SARIMA sama akuratnya
di pekan uji (MAPE pekanan 14,8%); evaluasi versi kuantil ini ada di
`ml/eksperimen/mesin1_lgbm.py`.

Rancangan:

1. **Satu model global untuk semua barang.** Target dibagi rata-rata 28 hari
   terakhir barang itu (skala), sehingga barang bergram-gram dan barang
   berbungkus-bungkus bisa dipelajari bersama. Sama dengan turnamen.
2. **Direct per pekan, bukan rekursif.** Hari 1–7 diramal model blok 1 dengan
   lag 7, 14, 21, 28; hari 8–14 oleh model blok 2 dengan lag 14..35; dan
   seterusnya. Setiap blok hanya melihat data yang sudah diketahui di titik asal,
   jadi ramalan tidak pernah diumpankan balik sebagai masukan. Blok 1 memakai
   fitur yang persis sama dengan LightGBM di turnamen.
3. **Kuantil langsung.** Tiga model per blok. p10 dan p90 memakai objective
   `quantile`; nilai tengah memakai L2 (rata-rata), karena MAPE dinilai pada
   jumlah sepekan dan median meremehkan jumlah dari permintaan yang menceng.
   Alpha bawah 0,08 (bukan 0,10) dan nilai tengah L2 dipilih di VALIDASI
   (`ml/eksperimen/mesin1_lgbm.py`), lalu dicek di pekan uji. Kuantil yang
   menyilang dirapikan oleh `_rapikan`.

Fitur (11): lag 7k, 7k+7, 7k+14, 7k+21; rata-rata 7 dan 28 hari dari deret yang
digeser 7k; hari dalam pekan (kategori); hari libur, pekan gajian, Ramadan pada
tanggal target; log skala barang. Hari stok habis (NaN, tersensor) tidak ikut
dilatih sebagai target.
"""

from __future__ import annotations

import math
import warnings
from datetime import timedelta

import numpy as np

from ..data import DeretBarang
from .dasar import TARAF, Ramalan, _rapikan
from .sarima import kalender

BENIH = 20261006
LAG_DASAR = (0, 7, 14, 21)
KOLOM = ("lag_a", "lag_b", "lag_c", "lag_d", "rata7", "rata28", "hari", "libur", "gajian", "ramadan", "log_skala")
INDEKS_HARI = KOLOM.index("hari")
#: Baris latih dimulai di sini supaya lag terpendek blok 1 sudah terisi.
MULAI_LATIH = 35
NAMA_MODEL = "lightgbm-kuantil"
#: Konfigurasi produksi, dipilih di validasi (lihat docstring).
ALPHA = {0.1: 0.08, 0.5: 0.5, 0.9: 0.9}
TENGAH_L2 = True


def _skala(d: DeretBarang, akhir: int) -> float:
    akhir28 = d.terisi[max(0, akhir - 28) : akhir]
    m = float(np.mean(akhir28)) if len(akhir28) else 0.0
    return m if m > 0 else 1.0


def _hari_pekan(d: DeretBarang, n: int) -> np.ndarray:
    hasil = np.empty(n)
    for i in range(n):
        t = d.tanggal[i] if i < len(d) else d.tanggal[-1] + timedelta(days=i - len(d) + 1)
        hasil[i] = t.weekday()
    return hasil


class _Barang:
    """Bahan yang sama untuk semua blok: deret terpotong di titik asal, skala, kalender."""

    def __init__(self, d: DeretBarang, akhir: int, h: int):
        import pandas as pd

        self.d, self.akhir, self.n = d, akhir, akhir + h
        self.skala = _skala(d, akhir)
        v = np.full(self.n, np.nan)
        m = min(akhir, len(d))
        v[:m] = d.nilai[:m]
        self.s = pd.Series(v / self.skala)
        self.hari = _hari_pekan(d, self.n)
        self.kal = kalender(d, 0, self.n)

    def fitur(self, k: int) -> np.ndarray:
        geser = 7 * k
        kolom = [self.s.shift(geser + l).to_numpy() for l in LAG_DASAR]
        g = self.s.shift(geser)
        kolom.append(g.rolling(7, min_periods=3).mean().to_numpy())
        kolom.append(g.rolling(28, min_periods=10).mean().to_numpy())
        kolom.append(self.hari)
        kolom.extend([self.kal[:, 0], self.kal[:, 1], self.kal[:, 2]])
        kolom.append(np.full(self.n, math.log(self.skala)))
        return np.column_stack(kolom)


def ramal_kuantil(
    tugas: list[tuple[DeretBarang, int]],
    h: int,
    benih: int = BENIH,
    n_jobs: int = 6,
    n_estimators: int = 300,
    taraf: tuple[float, ...] = TARAF,
    alpha: dict[float, float] | None = None,
    tengah_l2: bool = TENGAH_L2,
) -> list[Ramalan]:
    """
    Ramal `h` hari sesudah `akhir` untuk setiap (deret, akhir).

    Semua model dilatih pada SEMUA deret sampai titik asalnya masing-masing,
    seperti di produksi. Mengembalikan satu Ramalan (kuantil -> larik h hari)
    per tugas, urut sama dengan `tugas`.
    """
    import lightgbm as lgb

    bahan = [_Barang(d, akhir, h) for d, akhir in tugas]
    hasil = [{a: np.zeros(h) for a in taraf} for _ in tugas]
    for k in range(1, math.ceil(h / 7) + 1):
        fitur = [b.fitur(k) for b in bahan]
        Xs, ys = [], []
        for b, X in zip(bahan, fitur):
            baris = np.arange(MULAI_LATIH, b.akhir)
            y = b.s.to_numpy()[baris]
            sah = np.isfinite(y)
            Xs.append(X[baris][sah])
            ys.append(y[sah])
        X_latih, y_latih = np.vstack(Xs), np.concatenate(ys)
        hari = np.arange(7 * (k - 1), min(7 * k, h))
        for a in taraf:
            # Nilai tengah boleh dilatih sebagai rata-rata (L2) dan kuantil
            # boleh digeser (`alpha`); keduanya dipilih di validasi.
            l2 = tengah_l2 and a == 0.5
            model = lgb.LGBMRegressor(
                objective="regression" if l2 else "quantile",
                alpha=(ALPHA if alpha is None else alpha).get(a, a), n_estimators=n_estimators, learning_rate=0.05,
                num_leaves=31, min_child_samples=50, subsample=0.8, subsample_freq=1,
                colsample_bytree=0.8, random_state=benih, n_jobs=n_jobs, verbose=-1,
            )
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model.fit(X_latih, y_latih, categorical_feature=[INDEKS_HARI])
                for i, (b, X) in enumerate(zip(bahan, fitur)):
                    f = model.predict(X[b.akhir + hari])
                    hasil[i][a][hari] = np.asarray(f, dtype=float) * b.skala
    return [_rapikan(r) for r in hasil]
