"""
Evaluasi Mesin 2, dua lapis yang menjawab dua pertanyaan berbeda.

**Lapis A — ramalan.** Pada pesanan yang benar-benar terjadi di jendela uji,
seberapa benar model menaksir peluang pesanan berjalan mulus? Diukur dengan AUC
(urutan) dan Brier (kalibrasi). Keduanya perlu: AUC bagus dengan Brier buruk
berarti urutannya betul tapi angka yang ditampilkan ke pemilik warung salah.

**Lapis B — keputusan.** Ini yang sebenarnya penting, dan yang hampir selalu
dilewatkan. Lapis A hanya menilai pesanan yang kebetulan dipilih; ia tidak bisa
menjawab "apakah saran model lebih baik daripada kebijakan sekarang". Untuk itu
dipakai matriks counterfactual: setiap kandidat diberi skor, lalu dilihat hasil
yang AKAN terjadi pada kandidat peringkat satu. Diukur dengan NDCG@3,
Precision@1, dan sesal rata-rata terhadap pilihan terbaik.

Lapis B hanya mungkin di atas data simulasi. Di dunia nyata hasil kandidat yang
tidak dipilih tidak pernah diketahui — dan itu alasan utama kami membangkitkan
dataset sendiri alih-alih mencari data siap pakai.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .. import metrik
from ..data import FITUR, LABEL, belah_waktu, keputusan_counterfactual
from .keadaan import keadaan_pada, rakit_kandidat


@dataclass
class Hasil:
    nama: str
    auc: float
    brier: float
    ndcg3: float
    presisi1: float
    sesal: float
    n_uji: int
    n_keputusan: int
    detik: float

    def baris(self) -> str:
        return (
            "%-20s AUC %5.3f  Brier %6.4f | NDCG@3 %5.3f  P@1 %5.3f  "
            "sesal %6.4f | n=%4d/%4d  %5.1fs"
            % (
                self.nama, self.auc, self.brier, self.ndcg3, self.presisi1,
                self.sesal, self.n_uji, self.n_keputusan, self.detik,
            )
        )


#: Garis dasar yang skornya bukan peluang sungguhan. Brier-nya tidak dilaporkan
#: supaya tidak ada yang mengira angka itu berarti sesuatu.
BUKAN_PELUANG = {"termurah", "rerata_sejarah"}


def evaluasi(
    buat_model,
    nama: str,
    df: pd.DataFrame,
    cf: pd.DataFrame,
    *,
    maks_keputusan: int = 0,
) -> Hasil:
    mulai = time.perf_counter()
    latih, uji = belah_waktu(df)
    batas = pd.to_datetime(uji["tanggal"]).min().date()

    X_latih = latih[list(FITUR)].to_numpy(dtype=float)
    y_latih = latih[LABEL].to_numpy(dtype=int)
    X_uji = uji[list(FITUR)].to_numpy(dtype=float)
    y_uji = uji[LABEL].to_numpy(dtype=int)

    model = buat_model()
    model.latih(X_latih, y_latih)

    # --- Lapis A ---------------------------------------------------------
    p_uji = np.asarray(model.peluang(X_uji), dtype=float)
    nilai_auc = metrik.auc(y_uji.astype(bool), p_uji)
    nilai_brier = (
        float("nan") if nama in BUKAN_PELUANG else metrik.brier(y_uji, np.clip(p_uji, 0, 1))
    )

    # --- Lapis B ---------------------------------------------------------
    # Keadaan distributor dibekukan pada batas jendela uji. Kalau diperbarui
    # terus selama penilaian, model ikut memakai hasil pesanan yang belum
    # terjadi pada saat keputusan itu diambil.
    keadaan = keadaan_pada(latih, batas)
    keputusan = keputusan_counterfactual(cf, sejak=batas)
    if maks_keputusan:
        keputusan = keputusan[:maks_keputusan]

    # Seluruh kandidat dari seluruh keputusan dinilai dalam SATU panggilan,
    # lalu dipecah kembali. Memanggil model sekali per keputusan membuat model
    # berbiaya-tetap-tinggi (TabPFN memuat ulang seluruh tabel konteks setiap
    # panggilan) tampak ratusan kali lebih lambat daripada cara ia memang akan
    # dipakai: menilai semua kandidat sekaligus, sekali sehari.
    potongan, label_per = [], []
    for k in keputusan:
        X, label = rakit_kandidat(k, keadaan)
        potongan.append(X)
        label_per.append(label)

    ndcg, p1, sesal = [], [], []
    if potongan:
        # Metode yang menormalkan antar kandidat (TOPSIS) harus menerima satu
        # keputusan per panggilan; diberi semuanya sekaligus, ia menghitung
        # kandidat ideal secara global dan berhenti menjadi TOPSIS. Tidak ada
        # galat yang muncul — hanya angka yang lebih buruk, dan itu akan
        # terbaca sebagai "metodenya jelek" padahal cara memanggilnya yang salah.
        if getattr(model, "per_keputusan", False):
            skor_per = [np.asarray(model.peluang(X), dtype=float) for X in potongan]
        else:
            skor_semua = np.asarray(model.peluang(np.vstack(potongan)), dtype=float)
            skor_per, awal = [], 0
            for X in potongan:
                skor_per.append(skor_semua[awal : awal + len(X)])
                awal += len(X)

        for skor, label in zip(skor_per, label_per):
            ndcg.append(metrik.ndcg_k(label, skor, k=3))
            p1.append(metrik.presisi_1(label, skor))
            sesal.append(metrik.sesal(float(label[int(np.argmax(skor))]), float(label.max())))

    return Hasil(
        nama=nama,
        auc=nilai_auc,
        brier=nilai_brier,
        ndcg3=float(np.nanmean(ndcg)) if ndcg else float("nan"),
        presisi1=float(np.nanmean(p1)) if p1 else float("nan"),
        sesal=float(np.nanmean(sesal)) if sesal else float("nan"),
        n_uji=len(uji),
        n_keputusan=len(keputusan),
        detik=time.perf_counter() - mulai,
    )


def acuan_oracle(cf: pd.DataFrame, batas) -> tuple[float, float]:
    """
    Batas atas dan batas bawah, supaya angka model punya konteks.

    Tanpa keduanya, "P@1 = 0,78" tidak berarti apa-apa. Dengan keduanya,
    terlihat berapa bagian jarak antara menebak dan sempurna yang berhasil
    ditutup model.
    """
    keputusan = keputusan_counterfactual(cf, sejak=batas)
    oracle = float(np.mean([k["sukses"].max() for k in keputusan]))
    acak = float(np.mean([k["sukses"].mean() for k in keputusan]))
    return acak, oracle
