"""
Uji dua keputusan data yang paling menentukan hasil model.

Keduanya tidak akan pernah menampakkan diri sebagai galat kalau salah. Model
tetap jalan, angka tetap keluar, laporan tetap terbaca wajar — dan
kesimpulannya salah. Jadi keduanya dijaga uji.

1. **Sensor kehabisan stok.** Hari stok kosong harus menjadi NaN, bukan nol.
   Kalau nol yang masuk, model menyimpulkan barang paling laris adalah barang
   yang paling sering kosong, lalu menyarankan stok lebih sedikit — persis
   kebalikan dari yang benar.

2. **Pembelahan menurut waktu.** Data uji Mesin 2 harus seluruhnya sesudah data
   latih. Pembelahan acak membuat model memakai reputasi distributor yang baru
   TERBENTUK oleh pesanan yang sedang diujinya.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from ml.data import FITUR, LABEL, DeretBarang, _isi_bolong, belah_waktu


def _deret(nilai, habis, mulai=date(2026, 1, 5)) -> DeretBarang:
    """Deret buatan. Mulai Senin supaya pola hari-pekan mudah dibaca."""
    n = len(nilai)
    tanggal = np.array([mulai + timedelta(days=i) for i in range(n)])
    v = np.array(nilai, dtype=float)
    h = np.array(habis, dtype=bool)
    v[h] = np.nan
    kosong = np.zeros(n, dtype=bool)
    return DeretBarang(
        barang_id=1, usaha_id=1, nama="Uji", tanggal=tanggal, nilai=v,
        stok_habis=h, hari_libur=kosong, pekan_gajian=kosong, ramadan=kosong,
    )


def test_hari_kehabisan_stok_jadi_nan_bukan_nol():
    d = _deret([10, 20, 0, 40], [False, False, True, False])
    assert np.isnan(d.nilai[2])
    # Dan yang bukan hari kehabisan stok tetap apa adanya, termasuk nol asli.
    d2 = _deret([10, 20, 0, 40], [False, False, False, False])
    assert d2.nilai[2] == 0.0


def test_terisi_memakai_median_hari_pekan_bukan_nol():
    """
    Mengisi bolong dengan nol mengulang kesalahan yang justru ingin dihindari.
    Mengisi dengan rata-rata keseluruhan menghapus pola mingguan yang mau
    dipelajari. Jadi yang dipakai median hari-pekan yang sama.
    """
    # Empat pekan. Senin selalu 100, Sabtu selalu 500. Senin pekan ketiga kosong.
    nilai, habis = [], []
    for pekan in range(4):
        for hari, v in enumerate([100, 110, 120, 130, 140, 500, 300]):
            nilai.append(v)
            habis.append(pekan == 2 and hari == 0)
    d = _deret(nilai, habis)

    terisi = d.terisi
    assert not np.isnan(terisi).any()
    # Senin pekan ketiga (indeks 14) harus terisi ~100, bukan 0 dan bukan
    # rata-rata keseluruhan (~200).
    assert terisi[14] == pytest.approx(100.0)


def test_terisi_tidak_mengubah_hari_yang_tidak_bolong():
    d = _deret([10, 20, 0, 40], [False, False, True, False])
    terisi = d.terisi
    assert terisi[0] == 10.0
    assert terisi[1] == 20.0
    assert terisi[3] == 40.0


def test_hari_bolong_nol_kalau_usaha_berjualan_dan_disensor_kalau_tidak():
    """
    Nota Portal POS hanya menulis baris pada hari barangnya terpakai. Hari bolong
    tidak boleh menghentikan Mesin 1. Kalau usaha itu berjualan barang lain hari
    itu, barang ini memang tidak laku (nol). Kalau tidak ada penjualan sama sekali,
    permintaannya tidak diketahui dan disensor seperti hari kehabisan stok.
    """
    tanggal = np.array([date(2025, 12, 31), date(2026, 1, 3)])
    tidak = np.zeros(2, dtype=bool)
    hari, nilai, habis, libur, _, _ = _isi_bolong(
        7, tanggal, np.array([5.0, 8.0]), tidak, tidak, tidak, tidak, aktif={(7, date(2026, 1, 1))}
    )
    assert list(hari) == [date(2025, 12, 31) + timedelta(days=k) for k in range(4)]
    assert (nilai[1], habis[1]) == (0.0, False)  # 1 Jan: usaha berjualan, barang ini tidak laku
    assert habis[2]  # 2 Jan: tidak ada penjualan sama sekali
    assert (nilai[0], nilai[3]) == (5.0, 8.0)
    assert libur[1] and not libur[2]  # kovariat dari kalender: 1 Jan tanggal merah


def test_belah_waktu_tidak_pernah_bocor_ke_masa_lalu():
    """Setiap tanggal di data uji harus lebih besar daripada semua tanggal latih."""
    hari = [date(2026, 1, 1) + timedelta(days=i) for i in range(100)]
    df = pd.DataFrame({"tanggal": hari, "pesanan_id": range(100)})
    latih, uji = belah_waktu(df, hari_uji=35)

    assert len(uji) == 35
    assert len(latih) == 65
    assert pd.to_datetime(latih["tanggal"]).max() < pd.to_datetime(uji["tanggal"]).min()


def test_belah_waktu_menjaga_hari_yang_sama_tidak_terpotong():
    """
    Pesanan pada hari yang sama harus jatuh di sisi yang sama.

    Kalau satu hari terbelah, pesanan pagi masuk latih dan pesanan sore masuk
    uji — padahal keduanya memakai reputasi distributor yang sama persis, dan
    kemiripannya akan terbaca sebagai akurasi.
    """
    hari = [date(2026, 3, 1)] * 5 + [date(2026, 3, 2)] * 5
    df = pd.DataFrame({"tanggal": hari, "pesanan_id": range(10)})
    latih, uji = belah_waktu(df, hari_uji=1)

    assert set(pd.to_datetime(latih["tanggal"]).dt.date) == {date(2026, 3, 1)}
    assert set(pd.to_datetime(uji["tanggal"]).dt.date) == {date(2026, 3, 2)}


def test_daftar_fitur_tidak_memuat_label():
    """
    Satu kolom label yang menyelip ke daftar fitur memberi akurasi sempurna
    dan tidak ada yang akan curiga, karena angkanya justru terlihat bagus.
    """
    label = {LABEL, "l_tepat_waktu", "l_jumlah_sesuai", "l_kondisi_baik", "l_telat_hari"}
    assert label.isdisjoint(FITUR)
    # Begitu juga kolom pengenal: id pesanan bukan fitur, dan model yang
    # memakainya cuma menghafal baris.
    assert {"pesanan_id", "id"}.isdisjoint(FITUR)
