"""
Saringan barang sebelum peramalan: mana yang diramal dengan model, mana yang cukup aturan sederhana.

Permintaan dosen: hanya barang yang layak yang diramal, dengan memperhatikan
laju pemakaian dan pola musiman. Tiga saringan baku, masing-masing menjawab
satu pertanyaan:

| Saringan            | Pertanyaan                                    | Sumber                         |
|---------------------|-----------------------------------------------|--------------------------------|
| ABC (Pareto)        | Barang mana yang paling penting nilainya?     | praktik persediaan klasik      |
| Syntetos–Boylan     | Polanya cukup teratur untuk diramal model?    | Syntetos, Boylan & Croston 2005 |
| Kekuatan musiman    | Ada pola mingguan yang harus ditangkap?       | Wang, Smith & Hyndman 2006 (STL) |

**Kenapa bukan sell-through 30%.** Sell-through (terjual dibagi stok tersedia)
mengukur kebijakan restock, bukan permintaan: penyebutnya stok yang dibeli
pemilik. Di simulasi, korelasinya dengan barang terlaris hanya 0,23, dan
separuh barang lolos ambang 30% hanya karena posisi pekannya dalam siklus
restock. Ketiga saringan di sini dihitung dari permintaan saja, sehingga bisa
dipakai juga pada data toko roti yang tidak punya catatan stok.

Barang yang tidak lolos TETAP dapat batas aman, lewat aturan sederhana
(rata-rata pemakaian x lama kirim x faktor aman). Saringan menentukan cara
menghitung, bukan siapa yang dilayani.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np

from ..data import DeretBarang

#: Batas klasifikasi Syntetos–Boylan. Angka ini dari makalah aslinya, bukan
#: pilihan kami: titik potong tempat metode yang berbeda mulai unggul.
BATAS_ADI = 1.32
BATAS_CV2 = 0.49

#: Ambang kekuatan musiman. Tidak ada angka baku di literatur; 0,40 kami pilih
#: sebagai "musim menjelaskan sedikitnya 40% ragam di luar tren". Ini asumsi,
#: dan laporan harus menyebutnya begitu.
BATAS_MUSIMAN = 0.40

#: Berapa barang teratas menurut nilai yang diramal per UMKM (permintaan dosen).
TERATAS = 10

#: Panjang jendela pengamatan untuk saringan, hari. Delapan pekan cukup untuk
#: melihat pola mingguan dan cukup pendek untuk mengikuti perubahan.
JENDELA = 56


@dataclass
class HasilSaringan:
    barang_id: int
    usaha_id: int
    nama: str
    #: Nilai pemakaian rata-rata per hari (unit x harga). None kalau harga
    #: tidak tersedia; ABC lalu tidak bisa dihitung untuk barang ini.
    nilai_harian: float | None
    peringkat_nilai: int | None
    adi: float
    cv2: float
    pola: str
    kekuatan_musiman: float
    lolos_abc: bool
    layak_model: bool
    musiman: bool
    #: Keputusan akhir: diramal dengan model, atau cukup aturan sederhana.
    diramal: bool
    alasan: str


def syntetos_boylan(nilai: np.ndarray) -> tuple[float, float, str]:
    """
    Klasifikasi pola permintaan dari dua angka.

    ADI  = rata-rata jarak (dalam periode) antara dua permintaan bukan nol.
    CV²  = (simpangan baku / rata-rata)² dari ukuran permintaan bukan nol.

    ADI < 1,32 dan CV² < 0,49  → halus     (smooth)
    ADI < 1,32 dan CV² ≥ 0,49  → tak menentu (erratic)
    ADI ≥ 1,32 dan CV² < 0,49  → terputus  (intermittent)
    ADI ≥ 1,32 dan CV² ≥ 0,49  → bergumpal (lumpy)

    Periode kosong (NaN, hari stok habis) dibuang dulu, bukan dianggap nol —
    hari tanpa barang bukan hari tanpa permintaan.
    """
    v = np.asarray(nilai, dtype=float)
    v = v[np.isfinite(v)]
    bukan_nol = np.flatnonzero(v > 0)
    if len(bukan_nol) < 2:
        return float("inf"), float("nan"), "bergumpal"
    adi = float(len(v) / len(bukan_nol))
    ukuran = v[bukan_nol]
    rata = float(ukuran.mean())
    cv2 = float((ukuran.std() / rata) ** 2) if rata > 0 else float("nan")
    if adi < BATAS_ADI:
        pola = "halus" if cv2 < BATAS_CV2 else "tak menentu"
    else:
        pola = "terputus" if cv2 < BATAS_CV2 else "bergumpal"
    return adi, cv2, pola


def kekuatan_musiman(nilai: np.ndarray, periode: int = 7) -> float:
    """
    Kekuatan musiman dari dekomposisi STL: F = maks(0, 1 − Var(R) / Var(S + R)).

    0 berarti tidak ada pola mingguan sama sekali; 1 berarti seluruh ragam di
    luar tren dijelaskan oleh pola mingguan. Rumus dari Wang, Smith & Hyndman
    (2006), dipakai juga di buku Forecasting: Principles and Practice.
    """
    from statsmodels.tsa.seasonal import STL

    v = np.asarray(nilai, dtype=float)
    if np.isnan(v).any():
        # STL tidak menerima bolong; diisi interpolasi linear. Untuk mengukur
        # kekuatan pola, cara mengisi ini tidak menggeser hasil berarti.
        idx = np.arange(len(v))
        ok = np.isfinite(v)
        if ok.sum() < 2 * periode:
            return float("nan")
        v = np.interp(idx, idx[ok], v[ok])
    if len(v) < 2 * periode or np.allclose(v, v[0]):
        return 0.0
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        hasil = STL(v, period=periode, robust=True).fit()
    sisa = np.asarray(hasil.resid)
    musim = np.asarray(hasil.seasonal)
    penyebut = float(np.var(musim + sisa))
    if penyebut <= 0:
        return 0.0
    return float(max(0.0, 1.0 - np.var(sisa) / penyebut))


def saring(
    deret: list[DeretBarang],
    harga: dict[int, float] | None = None,
    *,
    akhir: int | None = None,
    teratas: int = TERATAS,
) -> list[HasilSaringan]:
    """
    Terapkan ketiga saringan pada data sampai indeks `akhir` (bawaan: seluruhnya).

    `akhir` penting untuk evaluasi: saringan pada titik asal t hanya boleh
    melihat data sebelum t. Kalau tidak, barang yang "layak diramal" dipilih
    dengan mengintip masa depan, dan MAPE barang lolos jadi terlalu baik.

    Aturan keputusan:
    * diramal = lolos ABC DAN (pola halus atau tak menentu), ATAU musiman kuat.
      Barang musiman diramal walau di luar 10 teratas — kriteria kedua dosen.
    * Barang terputus/bergumpal yang tidak musiman → aturan sederhana. Model
      peramalan pada pola seperti itu hampir selalu kalah dari rata-rata.
    """
    harga = harga or {}
    hasil: list[HasilSaringan] = []
    for d in deret:
        ujung = len(d) if akhir is None else min(akhir, len(d))
        jendela = d.nilai[max(0, ujung - JENDELA) : ujung]
        adi, cv2, pola = syntetos_boylan(jendela)
        kuat = kekuatan_musiman(jendela)
        h = harga.get(d.barang_id)
        rata = float(np.nanmean(jendela)) if np.isfinite(jendela).any() else 0.0
        hasil.append(
            HasilSaringan(
                barang_id=d.barang_id, usaha_id=d.usaha_id, nama=d.nama,
                nilai_harian=(rata * h) if h is not None else None,
                peringkat_nilai=None, adi=adi, cv2=cv2, pola=pola,
                kekuatan_musiman=kuat, lolos_abc=False,
                layak_model=pola in ("halus", "tak menentu"),
                musiman=bool(np.isfinite(kuat) and kuat >= BATAS_MUSIMAN),
                diramal=False, alasan="",
            )
        )

    # ABC per UMKM: urutkan menurut nilai, ambil `teratas`. Tanpa harga, ABC
    # tidak bisa dihitung — semua barang dianggap lolos ABC, dan itu dicatat
    # di alasan supaya tidak disangka saringannya bekerja.
    per_usaha: dict[int, list[HasilSaringan]] = {}
    for h in hasil:
        per_usaha.setdefault(h.usaha_id, []).append(h)
    for daftar in per_usaha.values():
        punya_harga = [h for h in daftar if h.nilai_harian is not None]
        if punya_harga:
            urut = sorted(punya_harga, key=lambda h: -h.nilai_harian)
            for i, h in enumerate(urut, 1):
                h.peringkat_nilai = i
                h.lolos_abc = i <= teratas
        for h in daftar:
            if h.nilai_harian is None:
                h.lolos_abc = True

    for h in hasil:
        h.diramal = (h.lolos_abc and h.layak_model) or h.musiman
        bagian = []
        if h.nilai_harian is None:
            bagian.append("harga tidak tersedia, ABC dilewati")
        elif h.lolos_abc:
            bagian.append("nilai ke-%d di katalog" % h.peringkat_nilai)
        else:
            bagian.append("di luar %d teratas (ke-%d)" % (teratas, h.peringkat_nilai))
        bagian.append("pola %s (ADI %.2f, CV² %.2f)" % (h.pola, h.adi, h.cv2))
        if h.musiman:
            bagian.append("musiman kuat (%.2f)" % h.kekuatan_musiman)
        h.alasan = "; ".join(bagian)
    return hasil


def batas_aman_sederhana(
    deret: DeretBarang, akhir: int, hari_kirim: int, faktor_aman: float = 1.5
) -> float:
    """
    Batas aman untuk barang yang tidak diramal model.

    Rata-rata pemakaian empat pekan terakhir x lama kirim x faktor aman. Faktor
    1,5 artinya cadangan setengah kali pemakaian selama barang di jalan — angka
    yang lazim untuk barang bergumpal, dan cukup kasar untuk diakui kasar.
    """
    jendela = deret.nilai[max(0, akhir - 28) : akhir]
    rata = float(np.nanmean(jendela)) if np.isfinite(jendela).any() else 0.0
    return rata * hari_kirim * faktor_aman
