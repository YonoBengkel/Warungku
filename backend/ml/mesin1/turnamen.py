"""
Turnamen model Mesin 1 gaya MarketCast: kelompokkan barang, adu model di barang
perwakilan, terapkan juara tiap kelompok ke seluruh anggotanya.

Inilah maksud catatan dosen "training cukup top 10, clustering kayak PBL
kemarin". MarketCast (repo PBL sebelumnya) memakai K-Means atas fitur deret,
memilih k dengan siluet, mengambil barang terdekat ke pusat sebagai perwakilan,
lalu menentukan juara per kelompok dengan rank-sum beberapa metrik. MarketCast
TIDAK pernah menguji apakah juara itu benar-benar lebih baik untuk anggota
lain; uji itu (langkah terakhir di sini) yang menentukan dipakai atau tidaknya.

Rancangan waktu, dengan delapan titik asal pekanan yang sama seperti
`pekanan.py`:

    a1 a2 a3 a4 a5 a6 a7 | a8
    ---- lipatan validasi --- | uji (DIKUNCI)

* Fitur, kelompok, dan perwakilan dihitung pada data sampai a1 — tidak
  melihat satu pun pekan yang dipakai menilai.
* Juara per kelompok dipilih dari ramalan perwakilan di a1..a7.
* Pekan a8 tidak dipakai memilih apa pun. Di a8, barang yang lolos saringan
  pada a8 dimasukkan ke kelompok terdekat (penskala dan pusat dari a1, tidak
  dilatih ulang), lalu diramal dengan juara kelompoknya.

Metrik (sama dengan MarketCast, ditambah WAPE): MAPE pekanan, WAPE, MDA, RMSE.
Pekan yang memuat hari stok habis dikeluarkan dari metrik pekanan, sama
seperti `pekanan.py`.
"""

from __future__ import annotations

import time
import warnings
from dataclasses import dataclass, field

import numpy as np

from ..data import DeretBarang
from .pekanan import CAKRAWALA, JUMLAH_ASAL, titik_asal_pekanan
from .saringan import kekuatan_musiman, syntetos_boylan

BENIH = 20261006
KISARAN_K = tuple(range(2, 9))
#: Perwakilan per kelompok. MarketCast mengambil satu; dengan satu barang dan
#: tujuh pekan validasi, juara ditentukan oleh tujuh angka saja.
PERWAKILAN = 3
#: Jendela fitur pengelompokan, hari. Dua kali jendela saringan supaya tren
#: dan musim terbaca, tetapi tetap mengikuti keadaan terbaru.
JENDELA_FITUR = 112
FITUR = ("cv", "tren", "adi", "cv2", "musiman")
#: Urutan dari yang paling sederhana. Dipakai memecah seri rank-sum: kalau
#: dua model sama baik, yang lebih sederhana menang.
MODEL = ("naif_musiman", "ets", "sarima", "lightgbm", "chronos_2")
METRIK = ("mape", "wape", "mda", "rmse")
#: Arah tiap metrik: True = kecil lebih baik.
KECIL_LEBIH_BAIK = {"mape": True, "wape": True, "mda": False, "rmse": True}


def asal_validasi_dan_uji(panjang: int) -> tuple[list[int], int]:
    semua = titik_asal_pekanan(panjang, JUMLAH_ASAL)
    return semua[:-1], semua[-1]


# --------------------------------------------------------------------------
# Fitur dan pengelompokan
# --------------------------------------------------------------------------
def fitur_barang(d: DeretBarang, akhir: int, jendela: int = JENDELA_FITUR) -> np.ndarray:
    """
    CV, kemiringan tren relatif per pekan, ADI, CV², dan kekuatan musiman.

    Hari stok habis (NaN) dibuang, bukan dihitung nol. ADI tak hingga (hampir
    tidak pernah laku) dibatasi 7 — lebih dari itu sudah sama-sama "jarang".
    """
    v = d.nilai[max(0, akhir - jendela) : akhir]
    ok = np.isfinite(v)
    x = v[ok]
    rata = float(x.mean()) if len(x) else 0.0
    cv = float(x.std() / rata) if rata > 0 else 0.0
    if rata > 0 and len(x) > 2:
        tren = float(np.polyfit(np.flatnonzero(ok), x, 1)[0] * 7 / rata)
    else:
        tren = 0.0
    adi, cv2, _ = syntetos_boylan(v)
    musim = kekuatan_musiman(v)
    return np.array([
        cv, tren,
        min(adi, 7.0) if np.isfinite(adi) else 7.0,
        cv2 if np.isfinite(cv2) else 0.0,
        musim if np.isfinite(musim) else 0.0,
    ])


@dataclass
class Pengelompokan:
    k: int
    siluet_per_k: dict[int, float]
    batas_bawah: np.ndarray
    batas_atas: np.ndarray
    model: object
    label: np.ndarray

    def skala(self, X: np.ndarray) -> np.ndarray:
        """
        MinMax seperti MarketCast, tetapi batasnya persentil 1 dan 99, bukan
        minimum dan maksimum. Satu barang dengan ADI ekstrem tidak boleh
        memampatkan seluruh barang lain ke ujung skala.
        """
        rentang = np.where(self.batas_atas > self.batas_bawah, self.batas_atas - self.batas_bawah, 1.0)
        return np.clip((X - self.batas_bawah) / rentang, 0.0, 1.0)

    def tetapkan(self, X: np.ndarray) -> np.ndarray:
        """Kelompok terdekat untuk barang baru — tanpa melatih ulang."""
        return self.model.predict(self.skala(X))

    @property
    def pusat(self) -> np.ndarray:
        return self.model.cluster_centers_


def kelompokkan(X: np.ndarray, kisaran=KISARAN_K, benih: int = BENIH) -> Pengelompokan:
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

    bawah = np.percentile(X, 1, axis=0)
    atas = np.percentile(X, 99, axis=0)
    sementara = Pengelompokan(0, {}, bawah, atas, None, np.array([]))
    Xs = sementara.skala(X)

    siluet: dict[int, float] = {}
    for k in kisaran:
        if k >= len(X):
            break
        lbl = KMeans(n_clusters=k, random_state=benih, n_init=10).fit_predict(Xs)
        siluet[k] = float(silhouette_score(Xs, lbl))
    k_terbaik = max(siluet, key=lambda k: (siluet[k], -k))
    akhir = KMeans(n_clusters=k_terbaik, random_state=benih, n_init=20).fit(Xs)
    return Pengelompokan(k_terbaik, siluet, bawah, atas, akhir, akhir.labels_)


def perwakilan(kel: Pengelompokan, X: np.ndarray, jumlah: int = PERWAKILAN) -> dict[int, list[int]]:
    """Indeks barang terdekat ke pusat (jarak Euklides di ruang terskala)."""
    Xs = kel.skala(X)
    hasil: dict[int, list[int]] = {}
    for c in range(kel.k):
        anggota = np.flatnonzero(kel.label == c)
        jarak = np.linalg.norm(Xs[anggota] - kel.pusat[c], axis=1)
        hasil[c] = [int(i) for i in anggota[np.argsort(jarak, kind="stable")[:jumlah]]]
    return hasil


# --------------------------------------------------------------------------
# Model. Semua berbentuk ramal(tugas, cakrawala) -> list[np.ndarray p50].
# --------------------------------------------------------------------------
def _p50_dari(fungsi):
    from .pekanan import satu_per_satu

    banyak = satu_per_satu(fungsi)

    def ramal(tugas, h):
        return [np.asarray(r[0.5], dtype=float) for r in banyak(tugas, h)]

    return ramal


def _kalender(d: DeretBarang) -> np.ndarray:
    return np.column_stack([d.hari_libur, d.pekan_gajian, d.ramadan]).astype(float)


def sarima_satu(d: DeretBarang, akhir: int, h: int, konteks: int = 200) -> np.ndarray:
    """
    SARIMAX(1,0,1)(0,1,1)7 pada log1p unit, kalender sebagai peubah luar.

    Orde sama dengan SARIMAX omset (`omset.py`) dan ditetapkan, tidak dicari per
    barang. Hari stok habis dibiarkan NaN: model ruang-keadaan menganggapnya
    pengamatan hilang. Kolom kalender yang konstan di data latih dibuang
    (matriks singular).
    """
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    awal = max(0, akhir - konteks)
    y = np.log1p(d.nilai[awal:akhir])
    ex = _kalender(d)
    pakai = [j for j in range(ex.shape[1]) if np.ptp(ex[awal:akhir, j]) > 0]
    ex_latih = ex[awal:akhir, pakai] if pakai else None
    ex_depan = ex[akhir : akhir + h, pakai] if pakai else None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pas = SARIMAX(y, exog=ex_latih, order=(1, 0, 1), seasonal_order=(0, 1, 1, 7)).fit(disp=False, maxiter=100)
        f = pas.forecast(h, exog=ex_depan)
    return np.maximum(np.expm1(np.asarray(f, dtype=float)), 0.0)


def sarima(tugas, h):
    hasil = []
    for d, akhir in tugas:
        try:
            hasil.append(sarima_satu(d, akhir, h))
        except Exception:
            hasil.append(np.full(h, np.nan))
    return hasil


#: Lag untuk LightGBM. Semuanya >= 7 sehingga ketujuh hari ke depan bisa
#: diramal langsung dari data yang sudah diketahui di titik asal, tanpa
#: memasukkan ramalan sendiri sebagai masukan (rekursif).
LAG = (7, 14, 21, 28)
KOLOM_LGBM = tuple(["lag%d" % l for l in LAG] + ["rata7", "rata28", "hari", "libur", "gajian", "ramadan", "log_skala"])


def fitur_lgbm(d: DeretBarang, akhir: int, h: int) -> tuple[np.ndarray, np.ndarray, float]:
    """
    Matriks fitur untuk indeks 0..akhir+h-1 dan target terskala.

    Nilai sejak `akhir` DIHAPUS dulu (NaN) sebelum fitur dibuat, jadi baris
    ramalan secara struktur tidak mungkin melihat masa depan. Target dibagi
    rata-rata 28 hari terakhir sebelum `akhir` supaya satu model bisa dilatih
    untuk barang bergram-gram dan barang berbungkus-bungkus sekaligus.
    """
    import pandas as pd

    n = akhir + h
    v = d.nilai[:n].astype(float).copy()
    v[akhir:] = np.nan
    akhir28 = d.terisi[max(0, akhir - 28) : akhir]
    skala = float(np.mean(akhir28)) if len(akhir28) and np.mean(akhir28) > 0 else 1.0
    s = pd.Series(v / skala)
    geser = s.shift(7)
    kolom = [s.shift(l).to_numpy() for l in LAG]
    kolom.append(geser.rolling(7, min_periods=3).mean().to_numpy())
    kolom.append(geser.rolling(28, min_periods=10).mean().to_numpy())
    kolom.append(np.array([t.weekday() for t in d.tanggal[:n]], dtype=float))
    kal = _kalender(d)[:n]
    kolom.extend([kal[:, 0], kal[:, 1], kal[:, 2]])
    kolom.append(np.full(n, np.log(skala)))
    return np.column_stack(kolom), s.to_numpy(), skala


def lightgbm_global(semua: list[DeretBarang], benih: int = BENIH, n_jobs: int = 6):
    """
    Satu LightGBM untuk seluruh barang (global), dilatih ulang per titik asal
    pada SEMUA deret sampai titik itu — termasuk barang yang tidak diuji,
    karena di produksi pun semua riwayat tersedia.
    """
    import lightgbm as lgb

    singgahan: dict[int, object] = {}

    def latih(akhir: int, h: int):
        if akhir in singgahan:
            return singgahan[akhir]
        Xs, ys = [], []
        for d in semua:
            X, y, _ = fitur_lgbm(d, akhir, h)
            baris = np.arange(35, akhir)
            sah = np.isfinite(y[baris])
            Xs.append(X[baris][sah])
            ys.append(y[baris][sah])
        model = lgb.LGBMRegressor(
            n_estimators=400, learning_rate=0.05, num_leaves=31, min_child_samples=50,
            subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
            random_state=benih, n_jobs=n_jobs, verbose=-1,
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model.fit(np.vstack(Xs), np.concatenate(ys), categorical_feature=[KOLOM_LGBM.index("hari")])
        singgahan[akhir] = model
        return model

    def ramal(tugas, h):
        hasil = []
        for d, akhir in tugas:
            model = latih(akhir, h)
            X, _, skala = fitur_lgbm(d, akhir, h)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                f = model.predict(X[akhir : akhir + h])
            hasil.append(np.maximum(np.asarray(f, dtype=float) * skala, 0.0))
        return hasil

    return ramal


def chronos(tugas, h):
    from .chronos import ramal_banyak

    return [np.asarray(r[0.5], dtype=float) for r in ramal_banyak(tugas, h)]


def daftar_model(semua: list[DeretBarang]) -> dict:
    from .dasar import holt_winters, naif_musiman

    return {
        "naif_musiman": _p50_dari(naif_musiman),
        "ets": _p50_dari(holt_winters),
        "sarima": sarima,
        "lightgbm": lightgbm_global(semua),
        "chronos_2": chronos,
    }


# --------------------------------------------------------------------------
# Metrik dan rank-sum
# --------------------------------------------------------------------------
@dataclass
class Ramalan:
    """Satu ramalan tujuh hari beserta nilai sebenarnya."""

    barang_id: int
    akhir: int
    asli: np.ndarray
    ramal: np.ndarray
    sebelum: float  # nilai hari terakhir sebelum titik asal, untuk MDA

    @property
    def pekan_sah(self) -> bool:
        return bool(np.isfinite(self.asli).all() and self.asli.sum() > 0 and np.isfinite(self.ramal).all())

    @property
    def ape(self) -> float:
        a = self.asli.sum()
        return float(abs(a - self.ramal.sum()) / a * 100) if self.pekan_sah else float("nan")


def buat_ramalan(d: DeretBarang, akhir: int, f: np.ndarray) -> Ramalan:
    return Ramalan(d.barang_id, akhir, d.nilai[akhir : akhir + CAKRAWALA].astype(float),
                   np.asarray(f, dtype=float), float(d.nilai[akhir - 1]))


def ukur(daftar: list[Ramalan]) -> dict:
    """
    MAPE dan WAPE pada jumlah tujuh hari (pekan sah saja); MDA dan RMSE harian.

    MDA = persen hari ketika arah ramalan (naik/turun dari hari sebelumnya yang
    sebenarnya) sama dengan arah sebenarnya. Hari datar (selisih nol) dihitung
    sebagai arah tersendiri. Hari yang nilainya NaN dilewati.
    """
    a_p, f_p, cocok, total, kuadrat = [], [], 0, 0, []
    for r in daftar:
        if r.pekan_sah:
            a_p.append(r.asli.sum())
            f_p.append(r.ramal.sum())
        lalu = np.concatenate([[r.sebelum], r.asli])
        for i in range(CAKRAWALA):
            a0, a1, f1 = lalu[i], lalu[i + 1], r.ramal[i]
            if np.isfinite(a1) and np.isfinite(f1):
                kuadrat.append((a1 - f1) ** 2)
                if np.isfinite(a0):
                    total += 1
                    cocok += int(np.sign(a1 - a0) == np.sign(f1 - a0))
    a_p, f_p = np.array(a_p), np.array(f_p)
    return {
        "mape": float(np.mean(np.abs(a_p - f_p) / a_p) * 100) if len(a_p) else float("nan"),
        "wape": float(np.abs(a_p - f_p).sum() / a_p.sum() * 100) if len(a_p) else float("nan"),
        "mda": float(cocok / total * 100) if total else float("nan"),
        "rmse": float(np.sqrt(np.mean(kuadrat))) if kuadrat else float("nan"),
        "n_pekan": int(len(a_p)),
    }


def rank_sum(skor: dict[str, dict], metrik=METRIK) -> list[dict]:
    """
    Peringkat per metrik (cara 'min' seperti MarketCast), dijumlah; total
    terkecil menang. Seri dipecah oleh MAPE, lalu oleh kesederhanaan model.
    Metrik NaN mendapat peringkat terburuk.
    """
    nama = list(skor)
    peringkat = {m: {} for m in nama}
    for mt in metrik:
        nilai = []
        for m in nama:
            x = skor[m][mt]
            if not np.isfinite(x):
                x = np.inf
            elif not KECIL_LEBIH_BAIK[mt]:
                x = -x
            nilai.append(x)
        for m, x in zip(nama, nilai):
            peringkat[m][mt] = 1 + sum(1 for y in nilai if y < x)
    baris = []
    for m in nama:
        baris.append({"model": m, **skor[m], **{"peringkat_" + mt: peringkat[m][mt] for mt in metrik},
                      "rank_sum": sum(peringkat[m].values())})
    urutan = {m: i for i, m in enumerate(MODEL)}
    baris.sort(key=lambda b: (b["rank_sum"], b["mape"] if np.isfinite(b["mape"]) else np.inf, urutan.get(b["model"], 99)))
    return baris


def bootstrap_selisih(ape_a: np.ndarray, ape_b: np.ndarray, ulang: int = 2000, benih: int = BENIH) -> dict:
    """
    Selang 95% selisih MAPE (a − b) dengan bootstrap berpasangan per barang.
    Negatif berarti a lebih baik.
    """
    acak = np.random.default_rng(benih)
    n = len(ape_a)
    if n == 0:
        return {"selisih": float("nan"), "bawah": float("nan"), "atas": float("nan"), "n": 0}
    idx = acak.integers(0, n, size=(ulang, n))
    s = ape_a[idx].mean(axis=1) - ape_b[idx].mean(axis=1)
    return {
        "selisih": float(ape_a.mean() - ape_b.mean()),
        "bawah": float(np.percentile(s, 2.5)),
        "atas": float(np.percentile(s, 97.5)),
        "n": int(n),
        "a_lebih_baik": int((ape_a < ape_b).sum()),
        "b_lebih_baik": int((ape_b < ape_a).sum()),
        "seri": int((ape_a == ape_b).sum()),
    }


@dataclass
class Stopwatch:
    detik: dict[str, float] = field(default_factory=dict)

    def jalankan(self, nama: str, fungsi, *arg):
        t = time.perf_counter()
        hasil = fungsi(*arg)
        self.detik[nama] = self.detik.get(nama, 0.0) + time.perf_counter() - t
        return hasil
