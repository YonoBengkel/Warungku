"""
K-Prototypes (Huang, 1998) — pengelompokan untuk data campuran angka + kategori.

**Kenapa bukan K-Means.** Fitur pelanggan kami campuran: tiga angka (recency,
frequency, monetary) dan dua kategori (jenis usaha, kategori barang utama).
K-Means menghitung jarak sebagai selisih kuadrat, dan tidak ada yang namanya
selisih antara "kedai kopi" dan "warung makan". Memaksakannya — misalnya dengan
one-hot lalu Euclidean — membuat dua kategori yang berbeda selalu berjarak
akar-dua, berapa pun banyaknya kategori, sehingga bobotnya ikut berubah hanya
karena jumlah kategorinya berubah.

K-Prototypes menjumlahkan dua jarak yang berbeda jenis:

    d(a, b) = sum (a_num - b_num)^2  +  gamma * sum [a_kat != b_kat]

Pusat kelompok: **rata-rata** untuk angka, **modus** untuk kategori.

Ditulis sendiri, tidak memakai pustaka, karena tiga alasan: algoritmanya tiga
puluh baris, pustaka `kmodes` sudah lama tidak dirawat, dan menuliskannya
sendiri memaksa pilihan gamma dan inisialisasi menjadi terlihat alih-alih
tersembunyi di balik nilai bawaan orang lain.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class HasilKPrototypes:
    label: np.ndarray
    pusat_angka: np.ndarray
    pusat_kategori: np.ndarray
    jarak: np.ndarray
    biaya: float
    iterasi: int


def _modus(kolom: np.ndarray) -> object:
    nilai, hitung = np.unique(kolom, return_counts=True)
    return nilai[int(np.argmax(hitung))]


def jarak(
    X_num: np.ndarray, X_kat: np.ndarray,
    pusat_num: np.ndarray, pusat_kat: np.ndarray,
    gamma: float,
) -> np.ndarray:
    """Matriks jarak (baris x kelompok)."""
    d_num = ((X_num[:, None, :] - pusat_num[None, :, :]) ** 2).sum(axis=2)
    d_kat = (X_kat[:, None, :] != pusat_kat[None, :, :]).sum(axis=2).astype(float)
    return d_num + gamma * d_kat


def gamma_bawaan(X_num: np.ndarray) -> float:
    """
    Bobot kategori terhadap angka, mengikuti saran Huang: setengah simpangan
    baku rata-rata dari peubah numerik.

    Angkanya penting dan sering diabaikan. Gamma terlalu kecil membuat kategori
    tidak berpengaruh sama sekali, dan hasilnya sama dengan K-Means atas RFM
    saja. Terlalu besar membuat kelompok hanya memisahkan jenis usaha, dan
    pola belanjanya hilang. Karena angkanya dibakukan lebih dulu, simpangan
    bakunya 1, jadi gamma bawaan jatuh di 0,5.
    """
    return float(0.5 * np.mean(np.std(X_num, axis=0)))


def kprototypes(
    X_num: np.ndarray,
    X_kat: np.ndarray,
    k: int,
    *,
    gamma: float | None = None,
    maks_iterasi: int = 100,
    benih: int = 20261006,
    ulang: int = 10,
) -> HasilKPrototypes:
    """
    Jalankan K-Prototypes, ambil hasil terbaik dari beberapa inisialisasi.

    Diulang beberapa kali karena hasilnya bergantung pada titik awal, dan satu
    kali jalan bisa berhenti di minimum lokal yang buruk. Benihnya tetap supaya
    hasilnya sama setiap kali — distributor yang membuka halaman dua kali tidak
    boleh melihat pelanggannya berpindah segmen tanpa sebab.
    """
    X_num = np.asarray(X_num, dtype=float)
    X_kat = np.asarray(X_kat, dtype=object)
    n = len(X_num)
    if n < k:
        raise ValueError("jumlah pelanggan (%d) lebih sedikit daripada k (%d)" % (n, k))

    g = gamma_bawaan(X_num) if gamma is None else gamma
    acak = np.random.default_rng(benih)
    terbaik: HasilKPrototypes | None = None

    for _ in range(ulang):
        # Inisialisasi ala k-means++: titik pertama acak, sisanya dipilih
        # sebanding dengan jarak kuadrat ke pusat terdekat. Inisialisasi acak
        # murni sering menaruh dua pusat berdekatan dan menyisakan kelompok
        # kosong.
        idx = [int(acak.integers(0, n))]
        while len(idx) < k:
            d = jarak(X_num, X_kat, X_num[idx], X_kat[idx], g).min(axis=1)
            total = d.sum()
            if total <= 0:
                idx.append(int(acak.integers(0, n)))
            else:
                idx.append(int(acak.choice(n, p=d / total)))
        pusat_num = X_num[idx].copy()
        pusat_kat = X_kat[idx].copy()

        label = np.full(n, -1)
        for it in range(maks_iterasi):
            d = jarak(X_num, X_kat, pusat_num, pusat_kat, g)
            label_baru = d.argmin(axis=1)
            if np.array_equal(label_baru, label):
                break
            label = label_baru
            for c in range(k):
                anggota = label == c
                if not anggota.any():
                    # Kelompok kosong diisi ulang dengan titik terjauh, bukan
                    # dibiarkan. Kelompok kosong membuat k yang dilaporkan
                    # berbeda dari k yang sebenarnya terbentuk.
                    jauh = int(d.min(axis=1).argmax())
                    pusat_num[c] = X_num[jauh]
                    pusat_kat[c] = X_kat[jauh]
                    continue
                pusat_num[c] = X_num[anggota].mean(axis=0)
                for j in range(X_kat.shape[1]):
                    pusat_kat[c, j] = _modus(X_kat[anggota, j])

        d = jarak(X_num, X_kat, pusat_num, pusat_kat, g)
        label = d.argmin(axis=1)
        jarak_terpilih = d[np.arange(n), label]
        biaya = float(jarak_terpilih.sum())

        if terbaik is None or biaya < terbaik.biaya:
            terbaik = HasilKPrototypes(
                label=label, pusat_angka=pusat_num.copy(), pusat_kategori=pusat_kat.copy(),
                jarak=jarak_terpilih, biaya=biaya, iterasi=it + 1,
            )

    assert terbaik is not None
    return terbaik


def siluet(X_num: np.ndarray, X_kat: np.ndarray, label: np.ndarray, gamma: float) -> float:
    """
    Skor siluet dengan jarak K-Prototypes, untuk memilih k.

    Dipakai memilih k, bukan untuk mengaku kelompoknya "benar". Siluet tinggi
    berarti kelompoknya terpisah rapi menurut ukuran jarak yang kita pilih
    sendiri — ia tidak bisa membuktikan segmen itu berarti bagi distributor.
    Itu penilaian manusia, bukan penilaian angka.
    """
    n = len(label)
    kelompok = np.unique(label)
    if len(kelompok) < 2 or n <= len(kelompok):
        return float("nan")

    d = jarak(X_num, X_kat, X_num, X_kat, gamma)
    skor = np.zeros(n)
    for i in range(n):
        sendiri = label == label[i]
        sendiri[i] = False
        if not sendiri.any():
            skor[i] = 0.0
            continue
        a = d[i, sendiri].mean()
        b = min(d[i, label == c].mean() for c in kelompok if c != label[i])
        skor[i] = (b - a) / max(a, b) if max(a, b) > 0 else 0.0
    return float(skor.mean())
