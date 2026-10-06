"""
Garis dasar Mesin 2, termasuk kebijakan yang sekarang dipakai pemilik warung.

Dua yang pertama bukan model sama sekali, dan justru itu gunanya:

* `termurah` adalah apa yang sebenarnya dilakukan orang. Kalau model kalah dari
  ini, tidak ada alasan memasangnya.
* `topsis` adalah rencana awal tim: pembobotan berbilang kriteria tanpa belajar
  dari hasil. Ia dimasukkan supaya pergantian pendekatan punya angka, bukan
  cuma pendapat.

Semua pengklasifikasi mengeluarkan **peluang**, bukan kelas. Layar Warungku
menampilkan angka peluangnya kepada pemilik warung, jadi kalibrasi itu bagian
dari keluaran, bukan urusan internal.
"""

from __future__ import annotations

import numpy as np

from ..data import FITUR

I_RASIO_HARGA = FITUR.index("p_rasio_harga")
I_KETEPATAN = FITUR.index("d_aspek_ketepatan")
I_JUMLAH = FITUR.index("d_aspek_jumlah")
I_KONDISI = FITUR.index("d_aspek_kondisi")
I_SELESAI = FITUR.index("d_pesanan_selesai")
I_SEKOTA = FITUR.index("p_sekota")


#: Metode yang skornya bergantung pada kandidat lain di keputusan yang sama,
#: jadi TIDAK boleh dinilai bersama kandidat dari keputusan lain. Hanya TOPSIS
#: yang begitu: ia menormalkan tiap kriteria terhadap seluruh baris yang
#: diberikan, lalu mengukur jarak ke kandidat ideal DI ANTARA baris itu.
#: Diberi seluruh kandidat dari semua keputusan sekaligus, "ideal"-nya menjadi
#: ideal global dan hasilnya bukan TOPSIS lagi — tanpa galat apa pun, cuma
#: angka yang lebih buruk. Kerangka evaluasi membaca atribut ini.
PER_KEPUTUSAN_DEFAULT = False


class Termurah:
    """Selalu pilih yang termurah. Kebijakan yang berlaku sekarang."""

    nama = "termurah"
    butuh_latih = False
    per_keputusan = False

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        # Tidak belajar apa pun. Itu memang intinya.
        pass

    def peluang(self, X: np.ndarray) -> np.ndarray:
        # Skor = kebalikan rasio harga, jadi termurah (rasio 1,0) paling tinggi.
        # Bukan peluang sungguhan; hanya dipakai untuk memeringkat. Angkanya
        # TIDAK boleh dipakai menghitung Brier, dan evaluasi memang tidak
        # memakainya untuk itu.
        return 1.0 / np.maximum(X[:, I_RASIO_HARGA], 1e-6)


class Topsis:
    """
    TOPSIS: jarak ke solusi ideal, bobot ditentukan manusia.

    Tiga aspek ulasan dan harga dinormalkan, lalu dihitung kedekatan ke
    kandidat ideal. Tidak ada satu pun hasil pesanan yang dipakai — ia percaya
    sepenuhnya pada rating, dan rating itu sendiri produk dari sedikit orang
    yang mau menulis ulasan.
    """

    nama = "topsis"
    butuh_latih = False
    #: Wajib. Lihat PER_KEPUTUSAN_DEFAULT di atas.
    per_keputusan = True

    def __init__(self, bobot: tuple[float, ...] = (0.30, 0.20, 0.20, 0.30)) -> None:
        self.bobot = np.array(bobot, dtype=float)
        self.bobot /= self.bobot.sum()

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        pass

    def peluang(self, X: np.ndarray) -> np.ndarray:
        kriteria = np.column_stack(
            [
                X[:, I_KETEPATAN],
                X[:, I_JUMLAH],
                X[:, I_KONDISI],
                # Harga: makin murah makin baik, jadi dibalik supaya semua
                # kriteria searah "makin besar makin baik".
                1.0 / np.maximum(X[:, I_RASIO_HARGA], 1e-6),
            ]
        )
        norma = np.sqrt((kriteria**2).sum(axis=0))
        norma[norma < 1e-12] = 1.0
        v = kriteria / norma * self.bobot
        ideal, buruk = v.max(axis=0), v.min(axis=0)
        d_ideal = np.sqrt(((v - ideal) ** 2).sum(axis=1))
        d_buruk = np.sqrt(((v - buruk) ** 2).sum(axis=1))
        return d_buruk / np.maximum(d_ideal + d_buruk, 1e-12)


class RegresiLogistik:
    """
    Regresi logistik dengan penskalaan. Garis dasar yang belajar.

    Dipertahankan di daftar karena dua alasan. Ia hampir selalu terkalibrasi
    baik, jadi Brier-nya sulit dikalahkan. Dan koefisiennya bisa dibaca — kalau
    model besar kita menang tipis, pertanyaan "kenapa tidak pakai yang bisa
    dijelaskan saja" harus punya jawaban berupa angka.
    """

    nama = "regresi_logistik"
    butuh_latih = True

    def __init__(self) -> None:
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler

        self.model = make_pipeline(
            StandardScaler(), LogisticRegression(max_iter=2000, C=1.0)
        )

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        self.model.fit(X, y)

    def peluang(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)[:, 1]


class PohonGradien:
    """
    LightGBM. Garis dasar terkuat untuk data tabular, dan lawan sebenarnya.

    Kalau TabPFN tidak bisa mengalahkan ini, pilihan yang jujur adalah memakai
    ini: ia menghasilkan berkas model yang bisa dipasang, inferensinya
    milidetik, dan tidak perlu membawa seluruh tabel latih setiap kali.
    """

    nama = "pohon_gradien"
    butuh_latih = True

    def __init__(self, **kwargs) -> None:
        import lightgbm as lgb

        self.model = lgb.LGBMClassifier(
            n_estimators=400,
            learning_rate=0.05,
            num_leaves=15,
            min_child_samples=30,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            verbose=-1,
            **kwargs,
        )

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        # LightGBM mengingat nama kolom saat dilatih dan memperingatkan kalau
        # saat meramal namanya hilang. Dibungkus DataFrame di kedua sisi supaya
        # nama kolomnya selalu sama — peringatan itu menandai kemungkinan
        # kolom tertukar, jadi dibungkam tanpa disamakan akan berbahaya.
        self.model.fit(self._bingkai(X), y)

    def peluang(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(self._bingkai(X))[:, 1]

    @staticmethod
    def _bingkai(X: np.ndarray):
        import pandas as pd

        return pd.DataFrame(np.asarray(X, dtype=float), columns=list(FITUR))


class RerataSejarah:
    """
    Pilih distributor dengan riwayat sukses terbaik. Tanpa fitur pesanan.

    Garis dasar paling sederhana yang masih "belajar dari hasil". Ia menjawab
    pertanyaan yang pantas ditanyakan: apakah seluruh fitur pesanan itu memang
    berguna, atau cukup melihat reputasi saja?
    """

    nama = "rerata_sejarah"
    butuh_latih = False

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        pass

    def peluang(self, X: np.ndarray) -> np.ndarray:
        # Ketiga aspek sudah berupa rata-rata terhalus pada skala 1-5.
        return (X[:, I_KETEPATAN] + X[:, I_JUMLAH] + X[:, I_KONDISI]) / 15.0


GARIS_DASAR = (Termurah, Topsis, RerataSejarah, RegresiLogistik, PohonGradien)
