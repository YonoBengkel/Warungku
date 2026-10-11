"""
Metrik untuk kedua mesin.

Satu aturan yang mendasari seluruh berkas ini: **metrik harus bisa menyatakan
model kita kalah.** Metrik yang tidak mungkin buruk tidak mengukur apa pun.

Karena itu tidak ada MAPE di sini. MAPE membagi dengan nilai sebenarnya, dan
permintaan harian UMKM sering nol — hari warung tutup, hari barang kosong.
Pembagian dengan nol itu kadang dibuang diam-diam oleh pustaka, dan yang
terbuang justru hari-hari paling penting. MASE memakai galat metode naif
sebagai penyebut, jadi ia tetap terdefinisi saat permintaan nol, dan angkanya
punya arti yang bisa dipertahankan di depan penguji: 1,0 berarti sama saja
dengan menebak "besok sama seperti pekan lalu".
"""

from __future__ import annotations

import numpy as np

# --------------------------------------------------------------------------
# Mesin 1 — perkiraan permintaan
# --------------------------------------------------------------------------


def galat_naif_musiman(latih: np.ndarray, musim: int = 7) -> float:
    """
    Penyebut MASE: rata-rata |y[t] - y[t-musim]| pada data latih.

    Dihitung dari data LATIH, bukan data uji. Kalau dihitung dari data uji,
    penyebutnya berubah tiap kali jendela ujinya digeser dan angka MASE dari
    dua percobaan tidak bisa dibandingkan.
    """
    if len(latih) <= musim:
        return float("nan")
    d = np.abs(latih[musim:] - latih[:-musim])
    g = float(np.mean(d))
    # Deret yang benar-benar rata (mis. barang yang tidak pernah laku) membuat
    # penyebutnya nol. Dikembalikan NaN supaya baris itu dibuang saat
    # merata-rata, bukan menjadi tak-hingga yang merusak seluruh ringkasan.
    return g if g > 1e-9 else float("nan")


def mase(asli: np.ndarray, ramalan: np.ndarray, penyebut: float) -> float:
    """
    Galat absolut rata-rata berskala. 1,0 = setara naif musiman.

    < 1 berarti model mengalahkan naif musiman. > 1 berarti kalah, dan itu
    hasil yang sah untuk dilaporkan.
    """
    if not np.isfinite(penyebut):
        return float("nan")
    return float(np.mean(np.abs(asli - ramalan)) / penyebut)


def galat_kuantil(asli: np.ndarray, ramalan: np.ndarray, taraf: float) -> np.ndarray:
    """
    Galat kuantil (pinball). Inilah yang membuat p10/p50/p90 punya arti.

    Ia menghukum tidak simetris: untuk p90, meramal terlalu rendah dihukum
    sembilan kali lebih berat daripada terlalu tinggi. Itu memang yang kita
    mau — kehabisan stok lebih mahal daripada kelebihan stok sedikit.
    """
    selisih = asli - ramalan
    return np.maximum(taraf * selisih, (taraf - 1.0) * selisih)


def wql(
    asli: np.ndarray,
    kuantil: dict[float, np.ndarray],
    taraf: tuple[float, ...] = (0.1, 0.5, 0.9),
) -> float:
    """
    Galat kuantil tertimbang, dinormalkan oleh jumlah nilai sebenarnya.

    Ini metrik utama Mesin 1, bukan MASE. Yang dipakai aplikasi adalah p90
    (untuk batas aman), jadi yang harus diukur adalah mutu seluruh sebarannya,
    bukan cuma titik tengahnya. Model dengan p50 bagus tapi p90 terlalu sempit
    akan terlihat baik di MASE dan membuat warung kehabisan stok.
    """
    pembagi = float(np.sum(np.abs(asli)))
    if pembagi < 1e-9:
        return float("nan")
    total = sum(float(np.sum(galat_kuantil(asli, kuantil[t], t))) for t in taraf)
    return 2.0 * total / (len(taraf) * pembagi)


def cakupan(asli: np.ndarray, bawah: np.ndarray, atas: np.ndarray) -> float:
    """
    Berapa bagian nilai sebenarnya yang jatuh di dalam selang.

    Untuk p10-p90 angkanya harus mendekati 0,80. Jauh di bawah = selangnya
    terlalu sempit dan janji "aman 90%" tidak ditepati. Jauh di atas = terlalu
    lebar, dan batas amannya menyuruh warung menimbun barang tanpa perlu.
    """
    return float(np.mean((asli >= bawah) & (asli <= atas)))


# --------------------------------------------------------------------------
# Mesin 2 — saran distributor
# --------------------------------------------------------------------------


def auc(label: np.ndarray, skor: np.ndarray) -> float:
    """
    AUC lewat statistik Mann-Whitney, menangani nilai skor yang sama.

    Ditulis sendiri (bukan sklearn) supaya layanan model tidak wajib membawa
    sklearn hanya untuk satu angka, dan supaya perlakuan terhadap skor seri
    terlihat jelas: mereka diberi peringkat rata-rata, bukan diurutkan
    sembarang — kalau tidak, model yang mengeluarkan skor konstan bisa
    kelihatan punya AUC 1,0 atau 0,0 tergantung urutan baris.
    """
    label = np.asarray(label, dtype=bool)
    n_pos, n_neg = int(label.sum()), int((~label).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    urut = np.argsort(skor, kind="mergesort")
    peringkat = np.empty(len(skor), dtype=float)
    s = skor[urut]
    i = 0
    while i < len(s):
        j = i
        while j + 1 < len(s) and s[j + 1] == s[i]:
            j += 1
        peringkat[urut[i : j + 1]] = 0.5 * (i + j) + 1.0
        i = j + 1
    return float((peringkat[label].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def brier(label: np.ndarray, peluang: np.ndarray) -> float:
    """
    Galat kuadrat rata-rata peluang. Mengukur KALIBRASI, bukan peringkat.

    Dipakai berdampingan dengan AUC karena keduanya menjawab pertanyaan
    berbeda. AUC hanya peduli urutan; model yang selalu bilang "peluang 0,99"
    untuk semua yang baik bisa punya AUC sempurna. Tapi layar Warungku
    menampilkan angka peluangnya kepada pemilik warung, jadi angka itu harus
    benar sebagai angka — dan itu yang diukur Brier.
    """
    return float(np.mean((np.asarray(peluang) - np.asarray(label, dtype=float)) ** 2))


def ndcg_k(relevan: np.ndarray, skor: np.ndarray, k: int = 3) -> float:
    """NDCG@k untuk satu keputusan. `relevan` biner: pesanan berjalan mulus."""
    n = len(skor)
    if n == 0:
        return float("nan")
    k = min(k, n)
    urut = np.argsort(-np.asarray(skor, dtype=float), kind="mergesort")[:k]
    diskon = 1.0 / np.log2(np.arange(2, k + 2))
    dcg = float(np.sum(np.asarray(relevan, dtype=float)[urut] * diskon))
    ideal = np.sort(np.asarray(relevan, dtype=float))[::-1][:k]
    idcg = float(np.sum(ideal * diskon))
    return dcg / idcg if idcg > 1e-12 else float("nan")


def presisi_1(relevan: np.ndarray, skor: np.ndarray) -> float:
    """Apakah kandidat peringkat satu memang pilihan yang baik."""
    if len(skor) == 0:
        return float("nan")
    return float(np.asarray(relevan, dtype=float)[int(np.argmax(skor))])


def sesal(hasil_terpilih: float, hasil_terbaik: float) -> float:
    """
    Sesal (regret): berapa yang hilang karena tidak memilih yang terbaik.

    Hanya bisa dihitung di atas data simulasi, karena butuh tahu hasil yang
    AKAN terjadi seandainya memilih kandidat lain — dan di dunia nyata
    informasi itu tidak pernah ada. Inilah satu-satunya alasan matriks
    counterfactual dibuat. Ia tidak pernah dilatihkan.
    """
    return float(hasil_terbaik - hasil_terpilih)


# --------------------------------------------------------------------------
# MAPE — metrik utama Mesin 1 sejak konsultasi dosen 10 Okt 2026
# --------------------------------------------------------------------------


def mape(asli: np.ndarray, ramalan: np.ndarray) -> float:
    """
    Rata-rata galat persentase absolut, dalam persen.

    Periode dengan nilai sebenarnya nol atau kosong (NaN) **dikeluarkan**, dan
    itu harus disebut setiap kali angkanya dilaporkan. MAPE membagi dengan
    nilai sebenarnya; pada periode bernilai nol hasilnya tak terhingga, dan
    pustaka yang diam-diam membuangnya membuat dua angka MAPE dari sumber
    berbeda tidak bisa dibandingkan. Karena itulah MAPE paling bermakna pada
    tingkat agregat (pekanan, per UMKM), tempat nilai nol jarang.
    """
    a = np.asarray(asli, dtype=float)
    f = np.asarray(ramalan, dtype=float)
    sah = np.isfinite(a) & np.isfinite(f) & (a > 0)
    if not sah.any():
        return float("nan")
    return float(np.mean(np.abs(a[sah] - f[sah]) / a[sah]) * 100.0)


def wape(asli: np.ndarray, ramalan: np.ndarray) -> float:
    """
    Galat absolut tertimbang, dalam persen: jumlah |galat| / jumlah nilai.

    Pendamping MAPE yang tidak meledak pada periode kecil. Kalau MAPE jauh di
    atas WAPE, sumbernya periode-periode bernilai kecil, bukan ramalan yang
    buruk secara umum.
    """
    a = np.asarray(asli, dtype=float)
    f = np.asarray(ramalan, dtype=float)
    sah = np.isfinite(a) & np.isfinite(f)
    total = float(np.abs(a[sah]).sum())
    if total <= 0:
        return float("nan")
    return float(np.abs(a[sah] - f[sah]).sum() / total * 100.0)


#: Skala tafsir MAPE menurut Lewis (1982), Industrial and Business Forecasting
#: Methods. Lazim dipakai di skripsi Indonesia untuk membaca angka MAPE.
SKALA_LEWIS: tuple[tuple[float, str], ...] = (
    (10.0, "sangat akurat"),
    (20.0, "baik"),
    (50.0, "layak"),
    (float("inf"), "tidak akurat"),
)


def kategori_lewis(nilai_mape: float) -> str:
    """Kategori Lewis (1982) untuk satu angka MAPE dalam persen."""
    if not np.isfinite(nilai_mape):
        return "tidak terdefinisi"
    for batas, nama in SKALA_LEWIS:
        if nilai_mape < batas:
            return nama
    return SKALA_LEWIS[-1][1]
