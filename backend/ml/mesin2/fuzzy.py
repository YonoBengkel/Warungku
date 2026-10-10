"""
Inferensi fuzzy Sugeno orde-nol: keandalan dan harga menjadi skor kelayakan.

Lapis ini menjawab pertanyaan yang tidak dijawab penaksir: kalau distributor A
lebih andal tapi 12% lebih mahal, mana yang disarankan? TOPSIS menjawabnya
dengan bobot; di sini dijawab dengan aturan yang bisa dibaca seperti kalimat:

    JIKA keandalan tinggi DAN harga sedang MAKA kelayakan 0,85

Seluruh hitungannya bisa dikerjakan di Excel:

1. **Fuzzifikasi.** Tiap masukan diberi derajat keanggotaan 0 sampai 1 pada
   tiga himpunan, lewat fungsi segitiga dan trapesium.
2. **Aturan.** Sembilan aturan (3 keandalan x 3 harga). Kekuatan tiap aturan =
   nilai terkecil dari dua derajat keanggotaannya (operator DAN = min).
3. **Defuzzifikasi.** Skor = rata-rata tertimbang keluaran aturan, dengan
   kekuatan aturan sebagai bobot. Itulah bentuk Sugeno orde-nol: keluaran tiap
   aturan berupa angka tetap, bukan himpunan fuzzy, sehingga tidak perlu
   menghitung titik berat kurva seperti pada Mamdani.

**Batas himpunan diambil dari data simulasi, bukan dikarang:** tingkat sukses
distributor berkisar 0,39 sampai 0,86, dan rasio harga terhadap kandidat
termurah berkisar 1,00 sampai 1,22. Tabel aturan adalah pengetahuan pakar —
pilihan kami tentang seberapa besar keandalan boleh ditukar dengan harga — dan
harus disebut begitu di laporan, sama seperti bobot TOPSIS.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


def segitiga(x: np.ndarray, a: float, b: float, c: float) -> np.ndarray:
    """Naik dari a ke puncak di b, turun ke c."""
    x = np.asarray(x, dtype=float)
    naik = (x - a) / max(b - a, 1e-12)
    turun = (c - x) / max(c - b, 1e-12)
    return np.clip(np.minimum(naik, turun), 0.0, 1.0)


def bahu_kiri(x: np.ndarray, penuh: float, nol: float) -> np.ndarray:
    """1 sampai `penuh`, turun lurus, 0 sejak `nol`."""
    x = np.asarray(x, dtype=float)
    return np.clip((nol - x) / max(nol - penuh, 1e-12), 0.0, 1.0)


def bahu_kanan(x: np.ndarray, nol: float, penuh: float) -> np.ndarray:
    """0 sampai `nol`, naik lurus, 1 sejak `penuh`."""
    x = np.asarray(x, dtype=float)
    return np.clip((x - nol) / max(penuh - nol, 1e-12), 0.0, 1.0)


@dataclass(frozen=True)
class AturanFuzzy:
    # Batas himpunan keandalan (peluang sukses).
    k_rendah_penuh: float = 0.55
    k_tengah: float = 0.70
    k_tinggi_penuh: float = 0.85
    # Batas himpunan harga (rasio terhadap kandidat termurah).
    h_murah_penuh: float = 1.00
    h_tengah: float = 1.10
    h_mahal_penuh: float = 1.20
    #: Keluaran tiap aturan. Baris: keandalan rendah, sedang, tinggi.
    #: Kolom: harga murah, sedang, mahal.
    keluaran: tuple[tuple[float, float, float], ...] = (
        (0.30, 0.15, 0.00),
        (0.70, 0.50, 0.30),
        (1.00, 0.85, 0.60),
    )
    #: Batas segmen pada skor kelayakan.
    batas_sangat_layak: float = 0.70
    batas_layak: float = 0.45

    def keanggotaan_keandalan(self, k: np.ndarray) -> np.ndarray:
        """Matriks (n, 3): rendah, sedang, tinggi."""
        return np.column_stack(
            [
                bahu_kiri(k, self.k_rendah_penuh, self.k_tengah),
                segitiga(k, self.k_rendah_penuh, self.k_tengah, self.k_tinggi_penuh),
                bahu_kanan(k, self.k_tengah, self.k_tinggi_penuh),
            ]
        )

    def keanggotaan_harga(self, r: np.ndarray) -> np.ndarray:
        """Matriks (n, 3): murah, sedang, mahal."""
        return np.column_stack(
            [
                bahu_kiri(r, self.h_murah_penuh, self.h_tengah),
                segitiga(r, self.h_murah_penuh, self.h_tengah, self.h_mahal_penuh),
                bahu_kanan(r, self.h_tengah, self.h_mahal_penuh),
            ]
        )

    def skor(self, keandalan: np.ndarray, rasio_harga: np.ndarray) -> np.ndarray:
        """Skor kelayakan 0 sampai 1 untuk tiap kandidat."""
        mk = self.keanggotaan_keandalan(keandalan)
        mh = self.keanggotaan_harga(rasio_harga)
        z = np.asarray(self.keluaran, dtype=float)  # (3 keandalan, 3 harga)
        # Kekuatan aturan (i, j) = min(mk_i, mh_j), untuk tiap kandidat.
        w = np.minimum(mk[:, :, None], mh[:, None, :])  # (n, 3, 3)
        total = w.sum(axis=(1, 2))
        # Selalu ada aturan yang menyala: himpunan saling menutup di seluruh
        # rentang, sehingga total tidak pernah nol. Pengaman ini hanya untuk
        # masukan di luar rentang yang direncanakan.
        return (w * z).sum(axis=(1, 2)) / np.maximum(total, 1e-12)

    def segmen(self, skor: np.ndarray) -> list[str]:
        return [
            "sangat-layak" if s >= self.batas_sangat_layak
            else "layak" if s >= self.batas_layak
            else "kurang-layak"
            for s in np.asarray(skor, dtype=float)
        ]


ATURAN_BAWAAN = AturanFuzzy()
