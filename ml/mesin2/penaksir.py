"""
Penaksir peluang untuk Mesin 2, semuanya melaporkan ketidakpastiannya sendiri.

Tiga penaksir, tiga cara menaksir ketidakpastian — dan perbedaan caranya itulah
yang menentukan apakah lapis bandit di atasnya punya dasar atau cuma hiasan:

| Penaksir             | Posterior              | Jujur? |
|----------------------|------------------------|--------|
| BART                 | cuplikan MCMC asli     | ya     |
| Logistik Bayesian    | aproksimasi Laplace    | ya     |
| LightGBM + bootstrap | ragam antar-bootstrap  | kira-kira |

Yang TIDAK ada di sini: menaksir ketidakpastian dari jumlah pesanan lalu
menempelkannya ke peluang titik. Itu yang dilakukan versi TabPFN sebelumnya,
dan itu heuristik yang menyamar sebagai Thompson sampling.
"""

from __future__ import annotations

import gc
import os
import warnings

# Dibatasi SEBELUM numpy/scipy dimuat. PyMC menjalankan pencuplik BART di
# proses pekerja, dan tiap pekerja memuat BLAS-nya sendiri. Dengan jumlah utas
# bawaan, satu kali jalan simulasi yang melatih ulang puluhan kali menghabiskan
# memori virtual Windows dan berhenti dengan "The paging file is too small" —
# pesan yang sama sekali tidak menyinggung BLAS, sehingga mudah salah dikira
# cacat kode.
for _nama in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
              "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ.setdefault(_nama, "1")

import numpy as np

from .bandit import Penaksir


def _lupakan_singgahan_sampler(op) -> None:
    """
    Buang singgahan sampler milik pymc-bart untuk op ini.

    Singgahannya berkunci `id(op)`, dan Python memakai ulang alamat objek yang
    sudah dibebaskan. Tanpa dibuang, pelatihan berikutnya bisa mendapat sampler
    lama milik objek lain yang kebetulan menempati alamat yang sama — ramalan
    yang keluar akan tetap masuk akal bentuknya, tapi berasal dari pohon yang
    salah, dan tidak ada galat yang muncul.
    """
    try:
        from pymc_bart.utils import _posterior_sampler_cache

        _posterior_sampler_cache.pop(id(op), None)
    except Exception:
        pass


def _anak_sekarang() -> set:
    import multiprocessing

    return set(multiprocessing.active_children())


def _tutup_anak_baru(sebelum: set) -> None:
    """
    Tutup proses yang muncul selama pelatihan, dan HANYA itu.

    `pymc_bart.BART` membuat satu `multiprocessing.Manager()` untuk tiap
    instance dan tidak pernah menutupnya. Satu simulasi yang melatih ulang
    belasan kali meninggalkan belasan proses Manager, masing-masing sekitar
    290 MB karena memuat BLAS sendiri; di mesin 12 GB seluruh memori habis dan
    prosesnya berhenti dengan pesan tentang paging file yang tidak menyinggung
    PyMC sama sekali.

    Dua hal yang membuat pembersihan ini harus berhati-hati:

    1. `op.all_trees` adalah **proksi** ke Manager itu. Menutup Manager-nya
       sebelum pohonnya disalin keluar membuat ramalan berikutnya berhenti
       dengan `BrokenPipeError`. Pemanggil WAJIB menyalin pohonnya lebih dulu.
    2. Menutup semua `active_children()` tanpa pandang bulu juga membunuh
       proses pembantu milik multiprocessing sendiri, sehingga pelatihan
       berikutnya gagal. Karena itu yang ditutup hanya selisihnya.
    """
    for anak in _anak_sekarang() - sebelum:
        try:
            anak.terminate()
            anak.join(timeout=3)
        except Exception:
            # Proses yang sudah mati lebih dulu melempar galat saat ditutup.
            # Itu justru keadaan yang diinginkan.
            pass


class BartBayesian(Penaksir):
    """
    BART — Bayesian Additive Regression Trees (Chipman, George & McCulloch, 2010).

    **Kenapa ini, dan bukan model tabular yang lebih biasa.**

    *Posteriornya asli.* BART adalah jumlah ratusan pohon kecil yang
    masing-masing dibatasi prior agar hanya menjelaskan sedikit; MCMC
    menghasilkan ratusan cuplikan dari posterior, bukan satu taksiran titik.
    Thompson sampling tinggal mengambil satu cuplikan — tidak ada langkah
    heuristik di antaranya.

    *Silsilahnya cocok dengan masalah kita.* Hill (2011) memperkenalkan BART
    untuk menaksir hasil yang AKAN terjadi seandainya diberi perlakuan lain —
    persis bentuk matriks counterfactual yang kami bangun. Jadi pilihannya punya
    alasan, bukan sekadar mencari metode yang jarang dipakai.

    *Berbasis pohon, jadi menangkap interaksi.* "Distributor ini buruk HANYA
    saat hujan", "yang itu buruk HANYA untuk pesanan besar" — regresi logistik
    tidak bisa melihatnya kecuali kita menuliskan sukunya sendiri.

    Harganya: MCMC. Pelatihannya puluhan detik sampai beberapa menit, tergantung
    jumlah baris. Untuk tugas batch tiap empat jam itu tidak berarti apa-apa;
    untuk inferensi di dalam permintaan HTTP, mustahil — dan itulah sebabnya
    layanan model menulis ke tabel alih-alih dipanggil saat halaman dibuka.
    """

    nama = "bart"

    def __init__(
        self,
        pohon: int = 40,
        cuplikan: int = 200,
        pemanasan: int = 200,
        maks_baris: int = 4_000,
        benih: int = 20261006,
    ) -> None:
        self.pohon = pohon
        self.cuplikan = cuplikan
        self.pemanasan = pemanasan
        #: Di atas ini, data latih disubsampel. MCMC berskala dengan jumlah
        #: baris, dan 16.000 baris membuat satu kali latih memakan belasan
        #: menit. Subsampel acak berbenih, bukan "ambil yang terbaru" —
        #: memotong yang lama menghapus distributor yang jarang dipesan, dan
        #: justru merekalah yang paling perlu terwakili.
        self.maks_baris = maks_baris
        self.benih = benih
        #: Berapa cuplikan posterior dipakai saat meramal. Lebih banyak =
        #: taksiran sebaran lebih halus, dan sebaran itulah yang menentukan
        #: seberapa berani Thompson menjelajah.
        self.cuplikan_ramal = 200
        self._jejak = None
        self._op = None

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        import pymc as pm
        import pymc_bart as pmb

        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        if len(X) > self.maks_baris:
            acak = np.random.default_rng(self.benih)
            pilih = acak.choice(len(X), self.maks_baris, replace=False)
            X, y = X[pilih], y[pilih]

        sebelum = _anak_sekarang()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with pm.Model():
                mu = pmb.BART("mu", X=X, Y=y.astype(float), m=self.pohon)
                # Tautan probit: BART memodelkan peubah laten, lalu dipetakan
                # ke peluang lewat Phi. Ini bentuk baku BART untuk klasifikasi.
                p = pm.Deterministic("p", pm.math.invprobit(mu))
                pm.Bernoulli("y", p=p, observed=y)
                self._jejak = pm.sample(
                    draws=self.cuplikan,
                    tune=self.pemanasan,
                    # Satu rantai, bukan dua. Dua rantai berguna untuk memeriksa
                    # konvergensi, dan di percobaan tunggal itu memang kami
                    # pakai — tapi di simulasi yang melatih ulang puluhan kali,
                    # ia menggandakan memori untuk ketelitian yang tidak kami
                    # baca. Pemeriksaan konvergensi dilakukan terpisah.
                    chains=1,
                    cores=1,
                    random_seed=self.benih,
                    progressbar=False,
                    compute_convergence_checks=False,
                )
        # Pohon-pohonnya menempel pada op BART, bukan pada jejak MCMC. Inilah
        # yang dipakai meramal data baru.
        self._op = mu.owner.op
        # Pohonnya DISALIN keluar dari proksi Manager menjadi daftar Python
        # biasa. Sesudah ini tidak ada lagi yang bergantung pada proses
        # Manager, sehingga ia boleh ditutup — dan harus, karena ia tidak
        # pernah menutup dirinya sendiri.
        self._op.all_trees = list(self._op.all_trees)
        _lupakan_singgahan_sampler(self._op)

        # Jejak MCMC tidak dipakai lagi; yang dipakai meramal hanya pohonnya.
        self._jejak = None
        _tutup_anak_baru(sebelum)
        gc.collect()

    def peluang_dan_sebaran(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Ramalan untuk baris baru, lewat pohon-pohon hasil cuplikan posterior.

        **Jalur ini tidak boleh diganti `pm.set_data` + `sample_posterior_predictive`.**
        Cara itu berjalan tanpa galat tetapi mengembalikan ramalan yang sama
        untuk masukan apa pun — kami sempat memakainya dan baru sadar setelah
        memeriksa: peluangnya datar di 0,44 untuk tiga baris yang seharusnya
        0,01 / 0,43 / 0,98. Cacat paling berbahaya adalah yang tidak melempar
        galat, dan ini salah satunya.
        """
        from pymc_bart.utils import _get_posterior_sampler, _sample_posterior
        from scipy.stats import norm

        if self._op is None:
            raise RuntimeError("BART belum dilatih.")
        X = np.asarray(X, dtype=float)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            sampler = _get_posterior_sampler(self._op)
            cuplikan = _sample_posterior(
                sampler, X, np.random.default_rng(self.benih), size=self.cuplikan_ramal
            )
        # Bentuk (cuplikan, baris, keluaran) -> (cuplikan, baris)
        laten = np.asarray(cuplikan, dtype=float).reshape(-1, len(X))
        p = norm.cdf(laten)
        return p.mean(axis=0), p.std(axis=0)


class LogistikBayesian(Penaksir):
    """
    Regresi logistik dengan posterior Gauss lewat aproksimasi Laplace.

    Garis dasar yang **adil** untuk bandit: ia juga punya posterior sungguhan,
    jadi kalau BART menang, kemenangannya bukan karena lawannya tidak punya
    ketidakpastian.

    Aproksimasi Laplace: posterior bobot didekati Gauss berpusat di taksiran
    maksimum a posteriori, dengan ragam dari kebalikan matriks Hessian. Untuk
    regresi logistik aproksimasi ini terkenal cukup baik, dan ia memberi kita
    sebaran peluang tanpa MCMC sama sekali — hitungannya milidetik.
    """

    nama = "logistik_bayes"

    def __init__(self, c: float = 1.0) -> None:
        self.c = c
        self._pipa = None
        self._kovarian = None

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler

        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        self._pipa = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=self.c))
        self._pipa.fit(X, y)

        Z = self._pipa[0].transform(X)
        Z1 = np.hstack([Z, np.ones((len(Z), 1))])
        p = self._pipa.predict_proba(X)[:, 1]
        w = np.clip(p * (1 - p), 1e-6, None)
        # Hessian log-posterior = X' W X + prior. Prior-nya 1/C, sama dengan
        # regularisasi yang dipakai sklearn, jadi keduanya konsisten.
        H = Z1.T @ (Z1 * w[:, None]) + np.eye(Z1.shape[1]) / self.c
        self._kovarian = np.linalg.inv(H)

    def peluang_dan_sebaran(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        X = np.asarray(X, dtype=float)
        p = self._pipa.predict_proba(X)[:, 1]
        Z = self._pipa[0].transform(X)
        Z1 = np.hstack([Z, np.ones((len(Z), 1))])
        # Ragam logit, lalu dipindahkan ke skala peluang lewat metode delta.
        ragam_logit = np.einsum("ij,jk,ik->i", Z1, self._kovarian, Z1)
        sigma = np.sqrt(np.clip(ragam_logit, 0, None)) * p * (1 - p)
        return p, sigma


class PohonBootstrap(Penaksir):
    """
    LightGBM dengan ketidakpastian dari bootstrap. Garis dasar berkapasitas tinggi.

    Ada di sini untuk menjawab pertanyaan yang pasti muncul: *"kenapa tidak
    pakai gradient boosting saja yang sudah terbukti?"* — dengan angka, bukan
    pendapat.

    Ketidakpastiannya **kira-kira**, bukan posterior: dilatih beberapa kali pada
    cuplikan ulang data, lalu diambil sebaran ramalannya. Itu menangkap
    ketidakpastian karena data terbatas, tapi bukan ketidakpastian model yang
    sesungguhnya. Dicatat di sini supaya tidak ada yang mengira angkanya setara
    dengan posterior BART.
    """

    nama = "pohon_bootstrap"

    def __init__(self, n: int = 8, benih: int = 20261006) -> None:
        self.n = n
        self.benih = benih
        self._model: list = []
        self._kolom: list[str] = []

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        import lightgbm as lgb

        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        acak = np.random.default_rng(self.benih)
        self._model = []
        for i in range(self.n):
            pilih = acak.integers(0, len(X), len(X))
            m = lgb.LGBMClassifier(
                n_estimators=300, learning_rate=0.05, num_leaves=15,
                min_child_samples=30, subsample=0.9, colsample_bytree=0.9,
                reg_lambda=1.0, verbose=-1, random_state=self.benih + i,
            )
            m.fit(X[pilih], y[pilih])
            self._model.append(m)

    def peluang_dan_sebaran(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        X = np.asarray(X, dtype=float)
        p = np.vstack([m.predict_proba(X)[:, 1] for m in self._model])
        return p.mean(axis=0), p.std(axis=0)


PENAKSIR: tuple[type[Penaksir], ...] = (BartBayesian, LogistikBayesian, PohonBootstrap)
