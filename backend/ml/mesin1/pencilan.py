"""
Deteksi pencilan multivariat dengan jarak Mahalanobis (permintaan dosen).

**Kenapa multivariat, bukan boxplot.** Boxplot menilai satu kolom sendirian.
Hari dengan omset tinggi DAN nota banyak itu wajar (ramai); hari dengan omset
tinggi tapi nota sedikit itu janggal (satu pembeli borongan, atau salah catat).
Boxplot per kolom tidak bisa membedakan keduanya, karena masing-masing angka
sendirian masih dalam rentang biasa. Jarak Mahalanobis mengukur jarak dari
pusat data dengan memperhitungkan hubungan antarkolom, jadi kombinasi yang
janggal terdeteksi walau tiap angkanya biasa.

**Langkahnya, per entitas (satu UMKM atau satu toko):**

1. Vektor harian x = [log omset, log jumlah barang, log jumlah nota].
   Log dipakai karena ketiganya condong ke kanan; Mahalanobis mengandaikan
   sebaran yang kira-kira simetris.
2. Level lokal dan pola mingguan dibuang dulu: tiap nilai dikurangi median
   bergulir 29 hari, lalu dikurangi median hari yang sama (Senin dengan
   Senin). Tanpa ini, setiap Sabtu yang ramai dan seluruh musim ramai
   terdeteksi sebagai pencilan, padahal memang begitu polanya. Versi pertama
   hanya membuang pola mingguan dan menandai 10% hari toko roti, kebanyakan
   hari musim panas.
3. Pusat dan kovarian ditaksir dengan **Minimum Covariance Determinant**
   (Rousseeuw, 1984), bukan rata-rata biasa. Rata-rata biasa ikut tertarik
   oleh pencilan itu sendiri sehingga pencilan besar justru menyamarkan
   dirinya (efek masking). MCD memakai separuh data yang paling rapat.
4. Jarak d² dibandingkan dengan batas chi-kuadrat derajat bebas 3 pada
   peluang 0,999 (alasannya di `PELUANG`). Hari di atas batas adalah calon
   pencilan.

**Pencilan ditandai, tidak dibuang.** Datanya tetap di basis data; hanya saat
melatih model, hari itu diperlakukan sebagai data hilang. Dan hari yang
dijelaskan kalender — libur, Ramadan, Lebaran — tidak pernah ditandai:
penjualan Lebaran yang anjlok adalah kejadian nyata yang harus dipelajari
model, bukan kesalahan yang harus disingkirkan.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

KOLOM = ("omset", "jumlah_barang", "jumlah_nota")
#: Batas peluang chi-kuadrat. Bukan 0,975 yang lazim di buku: pada sampel
#: harian sepanjang ratusan hari, MCD menaksir sebaran sedikit kekecilan
#: (Hardin & Rocke, 2005), dan batas 0,975 menandai 5,8% hari pada data buatan
#: yang sama sekali bersih. Pada 0,999, data bersih ditandai 0,8% dan data toko
#: roti 2,5% — yang tertangkap di data nyata tiga kali lipat derau dasarnya.
PELUANG = 0.999


def batas_chi2(derajat: int = len(KOLOM), peluang: float = PELUANG) -> float:
    from scipy.stats import chi2

    return float(chi2.ppf(peluang, derajat))


def _satu_entitas(g: pd.DataFrame, batas: float) -> pd.DataFrame:
    from sklearn.covariance import MinCovDet

    g = g.sort_values("tanggal").copy()
    g["jarak_mahalanobis"] = np.nan
    g["pencilan"] = False

    sah = (~g["data_hilang"].astype(bool)) & (g[list(KOLOM)] > 0).all(axis=1)
    if sah.sum() < 30:
        return g

    log = np.log(g.loc[sah, list(KOLOM)].to_numpy(dtype=float))
    hari = pd.to_datetime(g.loc[sah, "tanggal"]).dt.weekday.to_numpy()
    # Level lokal: median bergulir 29 hari, berpusat. Membuang musim tahunan
    # dan tren (musim panas di toko roti, Ramadan di warung). Pusatnya di
    # tengah, bukan di belakang, karena ini menandai data masa lalu, bukan
    # meramal — memakai hari sesudahnya di sini tidak membocorkan apa pun.
    level = (
        pd.DataFrame(log).rolling(29, center=True, min_periods=7).median().to_numpy()
    )
    sisa = log - level
    for h in range(7):
        pilih = hari == h
        if pilih.any():
            sisa[pilih] -= np.median(log[pilih], axis=0)

    mcd = MinCovDet(random_state=20261006).fit(sisa)
    d2 = mcd.mahalanobis(sisa)

    kalender = np.zeros(len(g), dtype=bool)
    for kolom in ("libur", "ramadan", "lebaran"):
        if kolom in g:
            kalender |= g[kolom].astype(bool).to_numpy()

    g.loc[sah, "jarak_mahalanobis"] = d2
    pencilan = np.zeros(len(g), dtype=bool)
    pencilan[np.flatnonzero(sah.to_numpy())] = d2 > batas
    g["dijelaskan_kalender"] = pencilan & kalender
    g["pencilan"] = pencilan & ~kalender
    return g


def tandai(omset: pd.DataFrame, peluang: float = PELUANG) -> pd.DataFrame:
    """
    Tambahkan kolom `jarak_mahalanobis`, `pencilan`, dan `dijelaskan_kalender`.

    `dijelaskan_kalender` = jaraknya melewati batas, TAPI harinya libur,
    Ramadan, atau Lebaran. Hari seperti itu tidak ditandai pencilan; kolom ini
    ada supaya laporan bisa menyebut berapa hari yang lolos karena kalender.
    """
    batas = batas_chi2(len(KOLOM), peluang)
    bagian = [_satu_entitas(g, batas) for _, g in omset.groupby("entitas_id", sort=True)]
    return pd.concat(bagian, ignore_index=True)


def ringkas(ditandai: pd.DataFrame) -> dict:
    sah = ditandai["jarak_mahalanobis"].notna()
    return {
        "hari_dinilai": int(sah.sum()),
        "pencilan": int(ditandai["pencilan"].sum()),
        "dijelaskan_kalender": int(ditandai.get("dijelaskan_kalender", pd.Series(False)).sum()),
        "persen_pencilan": round(100 * float(ditandai["pencilan"].sum()) / max(1, int(sah.sum())), 2),
        "batas_chi2": round(batas_chi2(), 3),
    }
