"""
Evaluasi pekanan Mesin 1: MAPE di tingkat keputusan restock.

Ilham memilih tingkat pekanan karena itulah siklus restock: setiap pekan
pemilik warung memutuskan berapa yang dipesan untuk pekan berikutnya. Jadi
yang dinilai adalah jumlah permintaan TUJUH HARI ke depan, bukan tiap harinya.

Rancangan:

* **Titik asal:** delapan pekan terakhir, bergeser tujuh hari. Pada tiap titik
  asal, model dan saringan hanya melihat data sebelum titik itu.
* **Yang dibandingkan:** jumlah ramalan p50 tujuh hari melawan jumlah
  permintaan sebenarnya tujuh hari.
* **Pekan yang mengandung hari stok habis dikeluarkan** dari penilaian unit
  per barang. Permintaan hari itu tidak diketahui, jadi jumlah pekanannya pun
  tidak diketahui.
* **Dua kelompok barang:** seluruh barang, dan barang yang lolos saringan.
  Barang yang tidak lolos dinilai memakai aturan sederhana yang memang dipakai
  untuk mereka, supaya terlihat apakah aturan itu cukup.

Metrik utama MAPE (permintaan dosen), dengan WAPE sebagai pendamping dan skala
Lewis (1982) sebagai tafsiran.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass

import numpy as np

from .. import metrik
from ..data import DeretBarang
from .saringan import saring

CAKRAWALA = 7
JUMLAH_ASAL = 8


@dataclass
class HasilPekanan:
    nama: str
    mape_pekanan: float
    wape_pekanan: float
    mape_harian: float
    n_pekan: int
    #: MAPE pekanan hanya untuk barang yang lolos saringan pada titik asalnya.
    mape_pekanan_lolos: float
    n_pekan_lolos: int
    kategori: str
    detik: float

    def baris(self) -> str:
        return "%-22s MAPE pekanan %5.1f%% (%s) | barang lolos %5.1f%% | WAPE %5.1f%% | harian %5.1f%% | n=%d | %6.1fs" % (
            self.nama, self.mape_pekanan, self.kategori, self.mape_pekanan_lolos,
            self.wape_pekanan, self.mape_harian, self.n_pekan, self.detik,
        )


def titik_asal_pekanan(panjang: int, jumlah: int = JUMLAH_ASAL) -> list[int]:
    """Indeks akhir-latih untuk tiap pekan uji, dari yang paling lama."""
    return sorted(panjang - CAKRAWALA * (k + 1) for k in range(jumlah))


def _tugas(deret: list[DeretBarang], jumlah: int) -> list[tuple[DeretBarang, int]]:
    return [(d, a) for d in deret for a in titik_asal_pekanan(len(d), jumlah) if a > 120]


def lolos_per_asal(deret: list[DeretBarang], harga: dict[int, float] | None, jumlah: int) -> set[tuple[int, int]]:
    """
    Pasangan (barang_id, titik asal) yang lolos saringan, dihitung per titik asal.

    Saringan dijalankan ulang pada tiap titik asal dengan data sebelum titik
    itu saja. Menjalankannya sekali pada seluruh data berarti memilih barang
    "layak diramal" dengan mengintip pekan yang sedang diuji.
    """
    lolos: set[tuple[int, int]] = set()
    panjang = {len(d) for d in deret}
    for n in panjang:
        kelompok = [d for d in deret if len(d) == n]
        for a in titik_asal_pekanan(n, jumlah):
            for h in saring(kelompok, harga, akhir=a):
                if h.diramal:
                    lolos.add((h.barang_id, a))
    return lolos


def nilai(
    nama: str,
    deret: list[DeretBarang],
    ramal_banyak,
    lolos: set[tuple[int, int]],
    *,
    jumlah: int = JUMLAH_ASAL,
) -> HasilPekanan:
    """
    Nilai satu metode. `ramal_banyak(tugas, cakrawala)` mengembalikan daftar
    kuantil {taraf: array} sepanjang `tugas`.
    """
    mulai = time.perf_counter()
    tugas = _tugas(deret, jumlah)
    ramalan = ramal_banyak(tugas, CAKRAWALA)

    a_pekan, f_pekan, a_lolos, f_lolos, harian = [], [], [], [], []
    for (d, akhir), r in zip(tugas, ramalan):
        asli = d.nilai[akhir : akhir + CAKRAWALA]
        f = np.asarray(r[0.5], dtype=float)
        sah = np.isfinite(asli) & (asli > 0)
        harian.extend(np.abs(asli[sah] - f[sah]) / asli[sah] * 100.0)
        if np.isfinite(asli).all() and asli.sum() > 0:
            a_pekan.append(asli.sum())
            f_pekan.append(f.sum())
            if (d.barang_id, akhir) in lolos:
                a_lolos.append(asli.sum())
                f_lolos.append(f.sum())

    mp = metrik.mape(np.array(a_pekan), np.array(f_pekan))
    return HasilPekanan(
        nama=nama,
        mape_pekanan=mp,
        wape_pekanan=metrik.wape(np.array(a_pekan), np.array(f_pekan)),
        mape_harian=float(np.mean(harian)) if harian else float("nan"),
        n_pekan=len(a_pekan),
        mape_pekanan_lolos=metrik.mape(np.array(a_lolos), np.array(f_lolos)),
        n_pekan_lolos=len(a_lolos),
        kategori=metrik.kategori_lewis(mp),
        detik=time.perf_counter() - mulai,
    )


def satu_per_satu(fungsi):
    """Ubah metode `f(deret, akhir, cakrawala)` menjadi bentuk berkelompok."""

    def banyak(tugas, cakrawala):
        hasil = []
        for d, akhir in tugas:
            try:
                hasil.append(fungsi(d, akhir, cakrawala))
            except Exception:
                # Gagal dicatat sebagai ramalan NaN, bukan dilewati: kalau
                # dilewati, metode yang sering gagal tampak lebih akurat.
                hasil.append({t: np.full(cakrawala, np.nan) for t in (0.1, 0.5, 0.9)})
        return hasil

    return banyak


def aturan_sederhana(tugas, cakrawala):
    """Ramalan untuk barang yang tidak lolos saringan: rata-rata 28 hari terakhir."""
    hasil = []
    for d, akhir in tugas:
        jendela = d.nilai[max(0, akhir - 28) : akhir]
        rata = float(np.nanmean(jendela)) if np.isfinite(jendela).any() else 0.0
        hasil.append({t: np.full(cakrawala, rata) for t in (0.1, 0.5, 0.9)})
    return hasil


def ke_kamus(h: HasilPekanan) -> dict:
    return asdict(h)
