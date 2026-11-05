"""
Tambahkan SATU warung madura ke basis data simulasi: Warung Madura Barokah 24 Jam.

    python -m dataset.warung_madura                # pasang kalau belum ada, lalu isi perkiraan dan saran
    python -m dataset.warung_madura --ulang        # hapus versi lama, lalu pasang lagi
    python -m dataset.warung_madura --tanpa-mesin  # data saja, tanpa Mesin 1 dan Mesin 2

Konsep awal Turnify Flow adalah mengakomodasi warung madura, yang barangnya sangat
banyak dan bukanya tidak pernah berhenti (revisi V8, Q175 sampai Q177). Warung kelontong
di data utama hanya menjual 9 barang, jadi konsep itu belum terlihat.

**Kenapa skrip terpisah.** Sama dengan `umkm_produksi`: simulasi utama memakai satu
generator acak untuk seluruh warung, jadi menambah warung di sana menggeser semua angka
70 UMKM lain. Skrip ini hanya MENAMBAH baris, dengan generator acaknya sendiri. Warung ini
hanya memesan ke empat distributor kelontong yang juga baru, jadi riwayat dan statistik
Mesin 2 delapan distributor lama tidak berubah. Barangnya pun produk baru, jadi tidak
masuk ke daftar kandidat UMKM lain.

**Kenapa bukan image basis data baru.** `siapkan.cmd` dan `nyalakan.cmd` menjalankan skrip
ini sesudah `dataset.geser_tanggal`. Simulasinya tetap memakai kalender asli (`MULAI`
sampai `AKHIR`), lalu semua tanggal digeser sebanyak geseran yang sudah berlaku. Hasilnya
sama persis kapan pun dipasang, dan lonjakan musimannya sejajar dengan warung lain. Barisnya
juga didaftarkan ke `geseran_tanggal`, supaya ikut geseran berikutnya.

Yang dibuat, untuk 400 hari yang sama dengan dataset utama:

* akun `madura1@warungku.test` (kata sandi sama dengan akun contoh lain), jenis
  `warung-kelontong`, tanpa Portal POS: penjualannya dari kasir simulasi seperti UMKM lain;
* 153 barang bernama generik tanpa merek dalam 12 kelompok, termasuk rokok dan LPG,
  tanpa bensin eceran, masing-masing produk master baru;
* empat distributor kelontong (`distributor9` sampai `distributor12@warungku.test`). Tiap
  kelompok barang punya dua pemasok, supaya Mesin 2 punya pilihan;
* nota sepanjang 24 jam dengan puncak di malam hari, buku besar, pesanan, ulasan,
  `permintaan_harian` untuk setiap hari, dan `fitur_pesanan`.

Angka permintaan, harga, dan watak distributor di sini adalah **asumsi simulasi**.
"""

from __future__ import annotations

import argparse
import math
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

import numpy as np
from sqlalchemy import text

from warungku.basis_data import mesin, segarkan_statistik
from warungku.enum import (
    CaraHitungStok,
    JenisPergerakan,
    JenisUsaha,
    PeranPengguna,
    StatusKasir,
    StatusVerifikasi,
    SumberBatasAman,
)
from warungku.model import (
    Barang,
    DataKasir,
    Distributor,
    FiturPesanan,
    Keanggotaan,
    Kemasan,
    PaketKontrak,
    PemetaanMenu,
    PemetaanMenuBahan,
    Penawaran,
    Pengguna,
    Pergerakan,
    PermintaanHarian,
    Pesanan,
    PesananBaris,
    PesananJejak,
    ProdukMaster,
    Ulasan,
    Usaha,
)

from . import nota as modul_nota
from .buat_dataset import AKHIR, HARI_PERSEDIAAN, HARI_SIMULASI, KATA_SANDI_CONTOH, MULAI, PELUANG_TERMURAH, _wkt
from .geser_tanggal import _ada_tabel, akhir_data
from .kalender import hari_ke_lebaran, sedang_lebaran
from .katalog import ProfilDistributor, deskripsi_kemasan
from .pola import (
    FAKTOR_GAJIAN,
    FAKTOR_LIBUR,
    POLA_MINGGUAN,
    KarakterDistributor,
    hari_libur,
    musim_hujan,
    pekan_gajian,
    sedang_ramadan,
)
from .umkm_produksi import Penampung, _pesan, _terima, _tulis

BENIH = 20261103

NAMA_USAHA = "Warung Madura Barokah 24 Jam"
JENIS = JenisUsaha.WARUNG_KELONTONG
EMAIL = "madura1@warungku.test"
PEMILIK = "Abdul Rokib"
KOTA = "Kota Yogyakarta"
#: Kunci di `dataset.nota` untuk jam ramai dan belanja per nota warung ini.
JENIS_NOTA = "warung-madura"
#: Baris buku besar harian warung 24 jam ditulis sesudah nota terakhir (lihat `nota.TUTUP_24_JAM`).
JAM_BUKU_BESAR = (23, 50)
JAM_KOREKSI = (23, 55)
JAM_PROSES_NOTA = "23:50"

#: Dua belas kelompok barang (Q176). Dipakai juga oleh frontend, lihat `KATEGORI_KELONTONG`
#: di `frontend/src/data/rekomendasi.ts`.
KATEGORI_KELONTONG: tuple[str, ...] = (
    "Beras & Sembako", "Minyak & Bumbu", "Mi Instan", "Minuman Kemasan", "Kopi & Teh Saset", "Rokok",
    "Makanan Ringan", "Sabun & Deterjen", "Perlengkapan Mandi", "Obat Warung", "Gas & Galon", "Perlengkapan Rumah",
)


@dataclass(frozen=True)
class BarangWarung:
    nama: str
    kategori: str
    #: Nama kemasan jual distributor dan isinya dalam pcs.
    kemasan: str
    isi: int
    #: Harga beli acuan per kemasan, rupiah. Tiap distributor mengalikannya dengan indeks harganya.
    harga_acuan: int
    #: Harga jual per pcs di nota, rupiah.
    harga_jual: int
    #: Rata-rata terjual per hari, pcs.
    pakai: float
    jarang: bool = False
    sinonim: tuple[str, ...] = ()


def _kelompok(kategori: str, *baris: tuple) -> tuple[BarangWarung, ...]:
    return tuple(BarangWarung(b[0], kategori, *b[1:]) for b in baris)


#: (nama, kemasan, isi, harga beli per kemasan, harga jual per pcs, terjual per hari, [jarang], [sinonim])
BARANG: tuple[BarangWarung, ...] = (
    *_kelompok(
        "Beras & Sembako",
        ("Beras Kemasan 5 kg", "bal", 4, 272_000, 74_000, 3.0),
        ("Beras Kemasan 1 kg", "bal", 20, 280_000, 15_500, 6.0),
        ("Gula Pasir Kemasan 1 kg", "bal", 20, 330_000, 18_500, 7.0),
        ("Tepung Terigu Kemasan 1 kg", "dus", 12, 132_000, 13_000, 2.5),
        ("Tepung Beras 500 g", "dus", 20, 140_000, 8_500, 1.0),
        ("Telur Ayam Butir", "krat", 180, 360_000, 2_500, 70.0, False, ("telor",)),
        ("Mi Telur Kering 200 g", "dus", 20, 100_000, 6_500, 1.5),
        ("Bihun Jagung 175 g", "dus", 20, 90_000, 6_000, 1.2),
        ("Kacang Hijau 250 g", "dus", 24, 156_000, 8_500, 0.5, True),
        ("Garam Beryodium 250 g", "dus", 40, 88_000, 3_000, 2.5),
        ("Susu Kental Manis Kaleng 370 g", "dus", 24, 288_000, 14_500, 3.0, False, ("skm",)),
        ("Susu Kental Manis Saset 37 g", "dus", 144, 216_000, 2_000, 14.0, False, ("skm",)),
        ("Sarden Kaleng 155 g", "dus", 24, 228_000, 12_000, 2.5),
        ("Kornet Kaleng 198 g", "dus", 24, 480_000, 24_000, 0.6, True),
    ),
    *_kelompok(
        "Minyak & Bumbu",
        ("Minyak Goreng Pouch 1 L", "dus", 12, 192_000, 18_500, 8.0),
        ("Minyak Goreng Pouch 2 L", "dus", 6, 189_000, 36_000, 3.0),
        ("Kecap Manis Botol 135 ml", "dus", 24, 180_000, 9_500, 2.5),
        ("Kecap Manis Saset 12 ml", "dus", 288, 115_000, 500, 15.0),
        ("Saus Sambal Botol 135 ml", "dus", 24, 168_000, 9_000, 2.0),
        ("Saus Sambal Saset 9 g", "dus", 288, 100_000, 500, 14.0),
        ("Penyedap Rasa Saset 8 g", "dus", 288, 130_000, 600, 20.0, False, ("micin",)),
        ("Kaldu Ayam Saset 9 g", "dus", 240, 120_000, 700, 16.0),
        ("Bumbu Nasi Goreng Saset 20 g", "dus", 120, 276_000, 3_000, 3.5),
        ("Merica Bubuk Saset 4 g", "dus", 240, 180_000, 1_000, 5.0),
        ("Santan Instan 65 ml", "dus", 36, 108_000, 4_000, 5.0),
        ("Kecap Asin Botol 135 ml", "dus", 24, 192_000, 10_000, 0.4, True),
        ("Cuka Masak 150 ml", "dus", 24, 96_000, 5_500, 0.3, True),
    ),
    *_kelompok(
        "Mi Instan",
        ("Mi Instan Goreng 85 g", "dus", 40, 114_000, 3_500, 38.0, False, ("indomi", "mie goreng")),
        ("Mi Instan Goreng Pedas 85 g", "dus", 40, 118_000, 3_700, 16.0),
        ("Mi Instan Kuah Ayam Bawang 70 g", "dus", 40, 108_000, 3_300, 24.0),
        ("Mi Instan Kuah Soto 70 g", "dus", 40, 108_000, 3_300, 16.0),
        ("Mi Instan Kuah Kari 72 g", "dus", 40, 110_000, 3_300, 10.0),
        ("Mi Instan Kuah Baso 70 g", "dus", 40, 108_000, 3_300, 8.0),
        ("Mi Instan Goreng Jumbo 129 g", "dus", 24, 98_000, 5_000, 7.0),
        ("Mi Instan Cup Kuah 75 g", "dus", 24, 125_000, 6_500, 8.0),
        ("Mi Instan Cup Goreng 80 g", "dus", 24, 134_000, 7_000, 5.0),
        ("Mi Instan Korea Pedas 130 g", "dus", 20, 190_000, 12_000, 3.5),
        ("Bihun Instan Kuah 55 g", "dus", 40, 100_000, 3_200, 3.0),
        ("Soun Instan Cup 40 g", "dus", 24, 108_000, 5_500, 1.5, True),
    ),
    *_kelompok(
        "Minuman Kemasan",
        ("Air Mineral Botol 600 ml", "dus", 24, 55_000, 3_500, 34.0, False, ("aqua",)),
        ("Air Mineral Botol 1,5 L", "dus", 12, 58_000, 6_500, 9.0),
        ("Air Mineral Gelas 220 ml", "dus", 48, 31_000, 1_000, 28.0),
        ("Teh Botol Manis 350 ml", "dus", 24, 94_000, 5_000, 20.0),
        ("Teh Kotak Melati 200 ml", "dus", 24, 79_000, 4_500, 12.0),
        ("Minuman Soda Kaleng 330 ml", "dus", 24, 144_000, 7_500, 10.0),
        ("Minuman Soda Botol 390 ml", "dus", 12, 60_000, 6_500, 8.0),
        ("Minuman Isotonik Botol 500 ml", "dus", 24, 151_000, 8_000, 11.0),
        ("Minuman Energi Saset 4 g", "dus", 240, 312_000, 1_800, 14.0),
        ("Minuman Energi Botol 150 ml", "dus", 30, 165_000, 7_000, 8.0),
        ("Susu UHT Kotak 125 ml", "dus", 40, 136_000, 4_500, 15.0),
        ("Susu UHT Kotak 250 ml", "dus", 24, 132_000, 7_000, 8.0),
        ("Jus Buah Kotak 200 ml", "dus", 24, 94_000, 5_000, 5.0),
        ("Kopi Botol Siap Minum 240 ml", "dus", 24, 132_000, 7_000, 10.0),
        ("Susu Fermentasi Botol 65 ml", "dus", 50, 90_000, 2_500, 7.0),
    ),
    *_kelompok(
        "Kopi & Teh Saset",
        ("Kopi Hitam Saset 6,5 g", "dus", 120, 162_000, 2_000, 20.0),
        ("Kopi Susu Saset 20 g", "dus", 120, 186_000, 2_200, 34.0),
        ("Kopi Gula Aren Saset 25 g", "dus", 120, 228_000, 2_500, 11.0),
        ("Kopi Moka Saset 25 g", "dus", 120, 204_000, 2_300, 9.0),
        ("Kopi Putih Saset 20 g", "dus", 120, 204_000, 2_300, 13.0),
        ("Kopi Bubuk Hitam 165 g", "dus", 24, 312_000, 16_000, 2.0),
        ("Teh Celup Melati Isi 25", "dus", 24, 132_000, 7_000, 5.0),
        ("Teh Celup Hitam Isi 25", "dus", 24, 151_000, 8_000, 3.0),
        ("Teh Tubruk Melati 40 g", "dus", 40, 104_000, 3_500, 6.0),
        ("Cokelat Bubuk Saset 30 g", "dus", 120, 228_000, 2_500, 8.0),
        ("Susu Bubuk Saset 27 g", "dus", 120, 276_000, 3_000, 10.0),
        ("Jahe Merah Saset 20 g", "dus", 120, 216_000, 2_500, 6.0),
        ("Krimer Saset 8 g", "dus", 240, 144_000, 1_000, 3.0, True),
    ),
    *_kelompok(
        "Rokok",
        ("Rokok Kretek Filter 12 Batang", "slof", 10, 240_000, 26_000, 11.0),
        ("Rokok Kretek Filter 16 Batang", "slof", 10, 300_000, 33_000, 15.0),
        ("Rokok Kretek Tangan 12 Batang", "slof", 10, 190_000, 21_000, 13.0),
        ("Rokok Kretek Tangan 16 Batang", "slof", 10, 260_000, 28_500, 6.0),
        ("Rokok Mild 12 Batang", "slof", 10, 225_000, 25_000, 9.0),
        ("Rokok Mild 16 Batang", "slof", 10, 305_000, 33_000, 13.0),
        ("Rokok Mild Mentol 16 Batang", "slof", 10, 295_000, 32_000, 5.0),
        ("Rokok Putih 20 Batang", "slof", 10, 335_000, 36_500, 4.0),
        ("Rokok Kretek Rasa Kopi 12 Batang", "slof", 10, 200_000, 22_000, 3.0),
        ("Tembakau Linting 50 g", "dus", 20, 300_000, 18_000, 1.5),
        ("Kertas Linting Isi 50", "dus", 100, 150_000, 2_000, 2.0),
        ("Korek Api Gas", "dus", 50, 100_000, 3_000, 9.0),
        ("Korek Api Kayu", "dus", 100, 60_000, 1_000, 3.0),
    ),
    *_kelompok(
        "Makanan Ringan",
        ("Keripik Kentang 68 g", "dus", 24, 180_000, 9_500, 6.0),
        ("Keripik Singkong Pedas 60 g", "dus", 24, 120_000, 6_500, 7.0),
        ("Kacang Atom 65 g", "dus", 24, 110_000, 6_000, 4.0),
        ("Kacang Kulit 70 g", "dus", 24, 115_000, 6_000, 5.0),
        ("Biskuit Cokelat 120 g", "dus", 24, 192_000, 10_000, 5.0),
        ("Biskuit Krim Saset 38 g", "dus", 60, 114_000, 2_500, 14.0),
        ("Wafer Cokelat 21 g", "dus", 96, 154_000, 2_000, 18.0),
        ("Roti Kemasan Cokelat 55 g", "dus", 40, 140_000, 4_500, 12.0),
        ("Permen Mint Butir", "bal", 200, 70_000, 500, 40.0),
        ("Permen Karet Butir", "bal", 100, 35_000, 500, 24.0),
        ("Cokelat Batang 30 g", "dus", 48, 192_000, 5_000, 6.0),
        ("Camilan Mi Kremes 18 g", "dus", 120, 132_000, 1_500, 18.0),
        ("Kerupuk Bawang 40 g", "dus", 50, 95_000, 2_500, 7.0),
        ("Jeli Cup 15 g", "bal", 100, 70_000, 1_000, 12.0),
        ("Sosis Siap Makan 20 g", "dus", 50, 110_000, 3_000, 11.0),
    ),
    *_kelompok(
        "Sabun & Deterjen",
        ("Deterjen Bubuk Saset 40 g", "dus", 144, 151_000, 1_500, 15.0),
        ("Deterjen Bubuk 800 g", "dus", 12, 228_000, 23_000, 2.5),
        ("Deterjen Cair Isi Ulang 700 ml", "dus", 12, 204_000, 20_500, 1.5),
        ("Sabun Colek 155 g", "dus", 48, 144_000, 4_000, 3.0),
        ("Sabun Cuci Piring Isi Ulang 400 ml", "dus", 24, 180_000, 9_500, 5.0),
        ("Sabun Cuci Piring Batang 170 g", "dus", 36, 97_000, 3_500, 3.0),
        ("Pewangi Pakaian Saset 20 ml", "dus", 240, 168_000, 1_000, 14.0),
        ("Pewangi Pakaian Isi Ulang 800 ml", "dus", 12, 144_000, 14_500, 1.0),
        ("Pembersih Lantai Isi Ulang 770 ml", "dus", 12, 126_000, 12_500, 1.2),
        ("Pemutih Pakaian 500 ml", "dus", 24, 125_000, 6_500, 1.0),
        ("Pembersih Kamar Mandi 700 ml", "dus", 12, 138_000, 14_000, 0.4, True),
        ("Sabun Cuci Tangan Isi Ulang 200 ml", "dus", 24, 163_000, 8_500, 0.6, True),
    ),
    *_kelompok(
        "Perlengkapan Mandi",
        ("Sabun Mandi Batang 75 g", "dus", 72, 194_000, 3_500, 10.0),
        ("Sabun Mandi Cair Isi Ulang 450 ml", "dus", 12, 222_000, 22_000, 1.5),
        ("Sampo Saset 10 ml", "dus", 240, 180_000, 1_000, 30.0),
        ("Sampo Botol 170 ml", "dus", 24, 396_000, 20_000, 1.2),
        ("Pasta Gigi 75 g", "dus", 72, 490_000, 8_500, 4.0),
        ("Pasta Gigi 190 g", "dus", 36, 450_000, 15_500, 2.0),
        ("Sikat Gigi Dewasa", "dus", 144, 490_000, 4_500, 2.5),
        ("Pembalut Isi 8", "dus", 48, 230_000, 6_000, 3.5),
        ("Popok Bayi Saset", "bal", 100, 190_000, 2_500, 9.0),
        ("Pencukur Sekali Pakai", "dus", 144, 403_000, 3_500, 1.5),
        ("Tisu Wajah 250 Lembar", "dus", 12, 126_000, 13_000, 1.2),
        ("Tisu Basah Isi 10", "dus", 48, 163_000, 4_500, 2.0),
        ("Minyak Telon 30 ml", "dus", 48, 470_000, 12_000, 0.5, True),
    ),
    *_kelompok(
        "Obat Warung",
        ("Obat Sakit Kepala Strip", "dus", 100, 240_000, 3_000, 9.0),
        ("Obat Flu Strip", "dus", 100, 280_000, 3_500, 7.0),
        ("Obat Batuk Sirup Saset 15 ml", "dus", 120, 240_000, 2_500, 5.0),
        ("Obat Maag Tablet Strip", "dus", 100, 320_000, 4_000, 3.0),
        ("Obat Masuk Angin Saset 15 ml", "dus", 120, 384_000, 4_000, 11.0),
        ("Obat Diare Strip", "dus", 100, 240_000, 3_000, 1.2),
        ("Minyak Angin 12 ml", "dus", 48, 326_000, 8_500, 2.0),
        ("Balsem Gosok 10 g", "dus", 72, 331_000, 6_000, 1.2),
        ("Plester Luka Isi 10", "dus", 50, 195_000, 5_000, 1.5),
        ("Oralit Saset", "dus", 100, 90_000, 1_500, 0.8, True),
        ("Vitamin C Strip", "dus", 100, 320_000, 4_000, 3.0),
        ("Salep Kulit 5 g", "dus", 72, 576_000, 10_000, 0.4, True),
    ),
    *_kelompok(
        "Gas & Galon",
        ("Gas LPG 3 kg", "tabung", 1, 19_000, 23_000, 6.0, False, ("elpiji", "gas melon")),
        ("Gas LPG 5,5 kg", "tabung", 1, 92_000, 105_000, 0.6, True, ("elpiji",)),
        ("Gas LPG 12 kg", "tabung", 1, 205_000, 230_000, 0.4, True, ("elpiji",)),
        ("Air Galon Isi Ulang 19 L", "galon", 1, 5_000, 7_000, 6.0),
        ("Air Mineral Galon 19 L", "galon", 1, 18_500, 22_000, 3.0),
        ("Tabung Galon Kosong", "galon", 1, 38_000, 45_000, 0.15, True),
        ("Regulator Gas LPG", "dus", 10, 450_000, 55_000, 0.15, True),
        ("Selang Gas 1,8 m", "dus", 10, 280_000, 35_000, 0.12, True),
    ),
    *_kelompok(
        "Perlengkapan Rumah",
        ("Baterai AA Isi 2", "dus", 40, 220_000, 7_000, 2.0),
        ("Baterai AAA Isi 2", "dus", 40, 220_000, 7_000, 1.2),
        ("Lampu LED 9 Watt", "dus", 20, 380_000, 24_000, 0.5, True),
        ("Obat Nyamuk Bakar Isi 10", "dus", 40, 168_000, 5_500, 5.0),
        ("Obat Nyamuk Semprot 600 ml", "dus", 12, 324_000, 32_000, 0.5, True),
        ("Kantong Kresek Hitam Isi 50", "dus", 40, 192_000, 6_000, 2.5),
        ("Tali Rafia 1 Roll", "dus", 20, 120_000, 8_000, 0.5, True),
        ("Lilin Putih Isi 5", "dus", 50, 150_000, 4_000, 0.8, True),
        ("Spons Cuci Piring", "dus", 100, 180_000, 2_500, 2.0),
        ("Kain Lap Serbaguna", "dus", 100, 300_000, 4_000, 0.8),
        ("Isolasi Bening", "dus", 72, 252_000, 5_000, 0.8),
        ("Lem Serbaguna 10 g", "dus", 100, 250_000, 3_500, 1.0),
        ("Payung Lipat", "dus", 12, 336_000, 35_000, 0.15, True),
    ),
)

#: Tiap kelompok dijual dua distributor, jadi Mesin 2 selalu punya pilihan.
DISTRIBUTOR_BARU: tuple[ProfilDistributor, ...] = (
    ProfilDistributor(
        "Grosir Sembako Makmur", "Kota Yogyakarta",
        ("Beras & Sembako", "Minyak & Bumbu", "Mi Instan", "Makanan Ringan", "Obat Warung"),
        ("Kota Yogyakarta", "Sleman", "Bantul"), 300_000, lat=-7.8095, lng=110.3715,
    ),
    ProfilDistributor(
        "Agen Kelontong Sentosa", "Sleman",
        ("Beras & Sembako", "Mi Instan", "Minuman Kemasan", "Kopi & Teh Saset", "Rokok", "Makanan Ringan",
         "Sabun & Deterjen", "Perlengkapan Mandi", "Perlengkapan Rumah"),
        ("Sleman", "Kota Yogyakarta"), 250_000, lat=-7.7690, lng=110.3900,
    ),
    ProfilDistributor(
        "Mitra Niaga Rumah Tangga", "Bantul",
        ("Minyak & Bumbu", "Minuman Kemasan", "Kopi & Teh Saset", "Sabun & Deterjen", "Perlengkapan Mandi",
         "Obat Warung", "Gas & Galon", "Perlengkapan Rumah"),
        ("Bantul", "Kota Yogyakarta"), 200_000, lat=-7.8530, lng=110.3580,
    ),
    ProfilDistributor(
        "Agen Rokok dan Gas Merapi", "Sleman",
        ("Rokok", "Gas & Galon"),
        ("Sleman", "Kota Yogyakarta"), 150_000, lat=-7.7350, lng=110.4020,
    ),
)

#: Watak tersembunyi distributor baru. Sama dengan `pola.KARAKTER`: yang termurah justru
#: paling sering telat, jadi ada yang bisa ditemukan Mesin 2.
KARAKTER_BARU: dict[str, KarakterDistributor] = {
    "Grosir Sembako Makmur": KarakterDistributor(
        "Grosir Sembako Makmur", 0.93, 0.96, 0.95, peka_ukuran=0.05, indeks_harga=1.05),
    "Agen Kelontong Sentosa": KarakterDistributor(
        "Agen Kelontong Sentosa", 0.66, 0.87, 0.86, peka_hujan=0.18, indeks_harga=0.94),
    "Mitra Niaga Rumah Tangga": KarakterDistributor(
        "Mitra Niaga Rumah Tangga", 0.86, 0.93, 0.92, peka_ukuran=0.08, peka_luar_kota=0.06, indeks_harga=1.00),
    "Agen Rokok dan Gas Merapi": KarakterDistributor(
        "Agen Rokok dan Gas Merapi", 0.90, 0.97, 0.93, peka_hujan=0.06, indeks_harga=1.02),
}
WARNA_DISTRIBUTOR = {
    "Grosir Sembako Makmur": "#b45309",
    "Agen Kelontong Sentosa": "#be123c",
    "Mitra Niaga Rumah Tangga": "#0369a1",
    "Agen Rokok dan Gas Merapi": "#4d7c0f",
}

#: Barang terlaris yang punya paket kontrak. Tidak semua, karena `GET /katalog` mengirim
#: semua paket ke setiap akun, dan warung kecil jarang berkontrak untuk barang lambat.
BARANG_BERKONTRAK: frozenset[str] = frozenset({
    "Gas LPG 3 kg", "Air Galon Isi Ulang 19 L", "Telur Ayam Butir", "Beras Kemasan 5 kg", "Gula Pasir Kemasan 1 kg",
    "Minyak Goreng Pouch 1 L", "Mi Instan Goreng 85 g", "Mi Instan Kuah Ayam Bawang 70 g",
    "Air Mineral Botol 600 ml", "Air Mineral Gelas 220 ml", "Teh Botol Manis 350 ml", "Kopi Susu Saset 20 g",
    "Rokok Kretek Filter 16 Batang", "Rokok Kretek Tangan 12 Batang", "Rokok Mild 16 Batang",
    "Sabun Mandi Batang 75 g", "Sampo Saset 10 ml", "Deterjen Bubuk Saset 40 g",
})


@dataclass
class BarangSim:
    id: int
    nama: str
    kategori: str
    produk_master_id: int
    pakai: float
    jarang: bool
    tren: float
    batas_aman: float
    stok: float = 0.0
    dalam_perjalanan: float = 0.0


@dataclass
class PenawaranSim:
    id: int
    distributor_id: int
    produk_master_id: int
    harga: int
    isi: float
    kemasan: str


#: Urutan tulis mengikuti kunci asing. Nota ditulis terpisah lewat COPY.
URUTAN = (
    ("produk_master", ProdukMaster),
    ("pengguna", Pengguna),
    ("usaha", Usaha),
    ("keanggotaan", Keanggotaan),
    ("distributor", Distributor),
    ("data_kasir", DataKasir),
    ("penawaran", Penawaran),
    ("paket_kontrak", PaketKontrak),
    ("barang", Barang),
    ("kemasan", Kemasan),
    ("pemetaan_menu", PemetaanMenu),
    ("pemetaan_menu_bahan", PemetaanMenuBahan),
    ("pesanan", Pesanan),
    ("pesanan_baris", PesananBaris),
    ("pesanan_jejak", PesananJejak),
    ("pergerakan", Pergerakan),
    ("ulasan", Ulasan),
    ("permintaan_harian", PermintaanHarian),
    ("fitur_pesanan", FiturPesanan),
)
TABEL_NOTA = ("transaksi", "transaksi_baris")

#: Kolom tanggal per tabel yang ikut geseran. Kolom waktu digeser sebagai datetime.
KOLOM_TANGGAL: dict[str, tuple[str, ...]] = {
    "usaha": ("bergabung_sejak",),
    "distributor": ("sejak",),
    "data_kasir": ("terakhir_masuk",),
    "penawaran": ("stok_diperbarui_pada",),
    "pesanan": ("dibuat_pada", "perkiraan_tiba", "kirim_waktu_sampai"),
    "pesanan_jejak": ("waktu",),
    "pergerakan": ("waktu",),
    "ulasan": ("waktu",),
    "permintaan_harian": ("tanggal",),
    "fitur_pesanan": ("tanggal",),
}


def _faktor(t: date, kategori: str) -> float:
    """
    Pengali permintaan satu kelompok barang pada satu hari.

    Bedanya dengan warung lain: warung madura tidak tutup saat Lebaran, jadi hari itu
    justru ramai karena warung lain tutup, bukan anjlok seperti `pola.faktor_musiman`.
    """
    f = POLA_MINGGUAN[JenisUsaha.WARUNG_KELONTONG][t.weekday()]
    if pekan_gajian(t):
        f *= FAKTOR_GAJIAN
    if hari_libur(t):
        f *= FAKTOR_LIBUR
    if sedang_ramadan(t):
        f *= 0.80 if kategori == "Rokok" else 1.12
        sisa = hari_ke_lebaran(t)
        if sisa is not None and sisa <= 7:
            f *= 1.30
    if sedang_lebaran(t):
        f *= 1.30
    if musim_hujan(t):
        f *= {"Obat Warung": 1.30, "Mi Instan": 1.10, "Minuman Kemasan": 0.88}.get(kategori, 1.0)
    return f


def _permintaan(b: BarangSim, t: date, hari_ke: int, acak: np.random.Generator) -> float:
    """Binomial negatif seperti `buat_dataset.permintaan`, dalam pcs utuh."""
    rata = b.pakai * _faktor(t, b.kategori) * (1.0 + b.tren * hari_ke)
    if rata <= 0:
        return 0.0
    if b.jarang:
        if acak.random() > 0.28:
            return 0.0
        rata *= 3.4
    return float(acak.poisson(acak.gamma(6.0, rata / 6.0)))


def _katalog(kon, t_: Penampung, acak: np.random.Generator) -> tuple[dict[str, int], dict[str, tuple], dict[int, list[PenawaranSim]]]:
    """Produk, distributor, dan penawaran kelontong. Yang sudah ada dipakai ulang, jadi `--ulang` aman."""
    from argon2 import PasswordHasher

    produk_master: dict[str, int] = {
        n: i for i, n in kon.execute(text("SELECT id, nama_kanonik FROM produk_master")).all()
    }
    for b in BARANG:
        if b.nama not in produk_master:
            produk_master[b.nama] = t_.tambah(
                "produk_master",
                {"nama_kanonik": b.nama, "kategori": b.kategori, "satuan_dasar": "pcs", "sinonim": list(b.sinonim)},
            )

    ada = {n: (i, k) for i, n, k in kon.execute(text("SELECT id, nama, kota FROM distributor")).all()}
    distributor: dict[str, tuple] = {}
    sandi = None
    penawaran_ada: set[tuple[int, int]] = {
        (d, p) for d, p in kon.execute(text("SELECT distributor_id, produk_master_id FROM penawaran")).all()
    }
    penawaran: dict[int, list[PenawaranSim]] = defaultdict(list)
    lama = kon.execute(
        text("SELECT id, distributor_id, produk_master_id, harga_satuan, kemasan_isi, kemasan_nama FROM penawaran")
    ).all()
    nama_produk = {pid: n for n, pid in produk_master.items()}
    daftar = {b.nama for b in BARANG}
    for pid, did, pmid, harga, isi, kemasan in lama:
        if nama_produk.get(pmid) in daftar:
            penawaran[pmid].append(PenawaranSim(pid, did, pmid, int(harga), float(isi), kemasan))

    for i, d in enumerate(DISTRIBUTOR_BARU):
        # Bilangan acak ditarik apa pun yang terjadi, supaya hasilnya sama di pemasangan ulang.
        umur = int(acak.integers(200, 1500))
        if d.nama in ada:
            distributor[d.nama] = ada[d.nama]
        else:
            sandi = sandi or PasswordHasher().hash(KATA_SANDI_CONTOH)
            pengguna_id = t_.tambah(
                "pengguna",
                {"nomor_hp": f"0812200{8 + i:04d}", "email": f"distributor{9 + i}@warungku.test",
                 "kata_sandi_hash": sandi, "nama": d.nama, "aktif": True},
            )
            dist_id = t_.tambah(
                "distributor",
                {
                    "pengguna_id": pengguna_id, "nama": d.nama, "kota": d.kota,
                    "deskripsi": f"Pemasok warung kelontong: {', '.join(d.kategori).lower()}.",
                    "warna": WARNA_DISTRIBUTOR[d.nama], "kategori": list(d.kategori), "area_kirim": list(d.area_kirim),
                    "terverifikasi": True, "baru": False, "sejak": MULAI - timedelta(days=umur),
                    "alamat_gudang": f"Jl. Industri No.{30 + i}, {d.kota}", "nomor_hp": f"0812733{8 + i:04d}",
                    "jam_operasional": "Senin sampai Sabtu, 07.00 - 16.00", "minimum_pesanan": d.minimum_pesanan,
                    "lat": d.lat, "lng": d.lng,
                },
            )
            distributor[d.nama] = (dist_id, d.kota)
        dist_id = distributor[d.nama][0]
        karakter = KARAKTER_BARU[d.nama]
        for b in BARANG:
            stok_tersedia = float(acak.integers(40, 600))
            if b.kategori not in d.kategori or (dist_id, produk_master[b.nama]) in penawaran_ada:
                continue
            harga = int(round(b.harga_acuan * karakter.indeks_harga / 500) * 500)
            pid = t_.tambah(
                "penawaran",
                {
                    "distributor_id": dist_id, "produk_master_id": produk_master[b.nama], "nama": b.nama,
                    "kategori": b.kategori, "satuan": b.kemasan, "harga_satuan": harga, "kemasan_nama": b.kemasan,
                    "kemasan_isi": b.isi, "satuan_isi": "pcs", "stok_tersedia": stok_tersedia,
                    "stok_diperbarui_pada": _wkt(AKHIR, 7, 30), "keterangan": f"1 {b.kemasan} = {b.isi:g} pcs",
                    "aktif": True,
                },
            )
            penawaran[produk_master[b.nama]].append(
                PenawaranSim(pid, dist_id, produk_master[b.nama], harga, float(b.isi), b.kemasan)
            )
            if b.nama in BARANG_BERKONTRAK:
                for kode, durasi, potong in (("A", 1, 0), ("B", 2, 3), ("C", 3, 5), ("E", 6, 10)):
                    t_.tambah(
                        "paket_kontrak",
                        {
                            "penawaran_id": pid, "distributor_id": dist_id, "kode": f"Kontrak {kode}",
                            "durasi_bulan": durasi, "kuota_min_per_bulan": float(max(5, round(20 * (1 - potong / 40)))),
                            "harga_satuan": int(round(harga * (1 - potong / 100) / 500) * 500), "hemat_persen": potong,
                            "ketentuan_kuota_kurang": "Kekurangan kuota bulan berjalan ditagihkan pada bulan berikutnya.",
                            "ketentuan_berhenti": "Penghentian di tengah masa kontrak hanya bisa lewat persetujuan distributor.",
                        },
                    )
    return produk_master, distributor, penawaran


def _baris_fitur(selesai: list[dict], usaha_id: int, kota_dist: dict[int, str], minimum: dict[int, int],
                 sejak: dict[int, date], penawaran: dict[int, list[PenawaranSim]],
                 pesanan: dict[int, dict]) -> list[dict]:
    """
    Tabel latih Mesin 2, dengan definisi yang sama dengan `buat_dataset.bangun_fitur_pesanan`:
    fitur distributor dihitung pada keadaan saat pesanan dibuat. Karena warung ini satu-satunya
    pembeli distributor baru, statistiknya bisa dihitung sendiri tanpa membaca data lain.
    """
    stat: dict[int, dict] = defaultdict(lambda: {"n": 0, "tepat": 0, "jumlah": 0, "kondisi": 0, "ulasan": 0})
    hubungan: dict[int, int] = defaultdict(int)
    hasil: list[dict] = []
    for k in sorted(selesai, key=lambda x: (x["tanggal"], x["pesanan_id"])):
        d, s, t = k["distributor_id"], stat[k["distributor_id"]], k["tanggal"]

        def halus(berhasil: int, s=s) -> float:
            return (8.0 * 4.2 + 5.0 * berhasil + 2.5 * (s["n"] - berhasil)) / (8.0 + s["n"])

        rasio = []
        for _, b, p, _q in k["baris"]:
            termurah = min(x.harga / x.isi for x in penawaran[b.produk_master_id])
            rasio.append((p.harga / p.isi) / termurah)
        nilai = int(sum(p.harga * q for _, _b, p, q in k["baris"]))
        hasil.append(
            {
                "pesanan_id": k["pesanan_id"], "usaha_id": usaha_id, "distributor_id": d, "tanggal": t,
                "d_aspek_ketepatan": round(halus(s["tepat"]), 4), "d_aspek_jumlah": round(halus(s["jumlah"]), 4),
                "d_aspek_kondisi": round(halus(s["kondisi"]), 4), "d_jumlah_ulasan": s["ulasan"],
                "d_pesanan_selesai": s["n"], "d_umur_hari": (t - sejak[d]).days, "h_pernah_kontrak": False,
                "h_pesanan_sebelumnya": hubungan[d], "p_jumlah_item": len(k["baris"]), "p_nilai": nilai,
                "p_rasio_harga": round(sum(rasio) / max(1, len(rasio)), 4), "p_sekota": kota_dist[d] == KOTA,
                "p_hari_pekan": t.weekday(), "p_bulan": t.month, "p_musim_hujan": musim_hujan(t),
                "p_stok_cukup": True, "p_minimum_terpenuhi": nilai >= minimum[d], "sukses": bool(k["hasil"]["sukses"]),
                "l_tepat_waktu": bool(k["hasil"]["tepat_waktu"]), "l_jumlah_sesuai": bool(k["hasil"]["jumlah_sesuai"]),
                "l_kondisi_baik": bool(k["hasil"]["kondisi_baik"]), "l_telat_hari": int((k["tiba_asli"] - k["janji"]).days),
            }
        )
        s["n"] += 1
        s["tepat"] += int(k["hasil"]["tepat_waktu"])
        s["jumlah"] += int(k["hasil"]["jumlah_sesuai"])
        s["kondisi"] += int(k["hasil"]["kondisi_baik"])
        if pesanan[k["pesanan_id"]].get("sudah_diulas"):
            s["ulasan"] += 1
        hubungan[d] += 1
    return hasil


def _geser_baris(t_: Penampung, hari: int) -> None:
    """Pindahkan semua tanggal dari kalender simulasi ke kalender yang sudah digeser `geser_tanggal`."""
    if hari == 0:
        return
    iv = timedelta(days=hari)
    for tabel, kolom in KOLOM_TANGGAL.items():
        for r in t_.baris.get(tabel, []):
            for k in kolom:
                if r.get(k) is not None:
                    r[k] = r[k] + iv
    for r in t_.baris.get("pesanan", []):
        # Tanggal di nomor mengikuti, seperti pesanan simulasi yang digeser `geser_tanggal`.
        r["nomor"] = f"PS-{r['dibuat_pada']:%y%m%d}-{r['nomor'].rsplit('-', 1)[1]}"


def _daftarkan_geseran(kon, t_: Penampung, awal: dict[str, int]) -> None:
    """
    Daftarkan id baru ke `geseran_tanggal`, supaya ikut geseran berikutnya. Basis data yang
    belum pernah digeser belum punya catatannya, dan geseran pertama akan menemukannya sendiri.
    """
    if not _ada_tabel(kon):
        return
    ids = kon.execute(text("SELECT id_simulasi FROM geseran_tanggal WHERE id = 1")).scalar()
    if ids is None:
        return
    for tabel in ("pergerakan", "pesanan"):
        data = t_.baris.get(tabel, [])
        if data:
            ids[tabel] = _tambah_rentang(kon, ids[tabel], awal[tabel] + 1, awal[tabel] + len(data))
    barang = t_.baris.get("barang", [])
    if barang:
        # Untuk `permintaan_harian` yang dicatat id barangnya.
        ids["permintaan_harian"] = _tambah_rentang(kon, ids["permintaan_harian"], barang[0]["id"], barang[-1]["id"])
    import json

    kon.execute(text("UPDATE geseran_tanggal SET id_simulasi = CAST(:i AS jsonb) WHERE id = 1"), {"i": json.dumps(ids)})


def _tambah_rentang(kon, teks: str, a: int, b: int) -> str:
    return kon.execute(
        text("SELECT (CAST(:t AS int8multirange) + int8multirange(int8range(:a, :b, '[]')))::text"),
        {"t": teks, "a": a, "b": b},
    ).scalar_one()


def _hapus_lama(kon) -> bool:
    """Hapus warung ini beserta seluruh jejaknya. Distributor, produk, dan penawaran dibiarkan."""
    u = kon.execute(text("SELECT id FROM usaha WHERE email = :e"), {"e": EMAIL}).scalar()
    if u is None:
        return False
    p = {"u": u}
    pesanan = "SELECT id FROM pesanan WHERE usaha_id = :u"
    barang = "SELECT id FROM barang WHERE usaha_id = :u"
    nota = "SELECT id FROM transaksi WHERE usaha_id = :u"
    for sql in (
        "DELETE FROM permintaan_harian WHERE usaha_id = :u",
        "DELETE FROM prediksi WHERE usaha_id = :u",
        "DELETE FROM rekomendasi_skor WHERE usaha_id = :u",
        "DELETE FROM notifikasi WHERE usaha_id = :u",
        "DELETE FROM segmen_pelanggan WHERE usaha_id = :u",
        "DELETE FROM pergerakan WHERE usaha_id = :u",
        "DELETE FROM fitur_pesanan WHERE usaha_id = :u",
        "DELETE FROM ulasan WHERE usaha_id = :u",
        f"DELETE FROM pesanan_jejak WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM pesanan_baris WHERE pesanan_id IN ({pesanan})",
        "DELETE FROM pesanan WHERE usaha_id = :u",
        "DELETE FROM kontrak_periode WHERE kontrak_id IN (SELECT id FROM kontrak WHERE usaha_id = :u)",
        "DELETE FROM kontrak WHERE usaha_id = :u",
        f"DELETE FROM transaksi_baris WHERE transaksi_id IN ({nota})",
        "DELETE FROM transaksi WHERE usaha_id = :u",
        f"DELETE FROM pemetaan_menu_bahan WHERE barang_id IN ({barang})",
        "DELETE FROM pemetaan_menu WHERE usaha_id = :u",
        f"DELETE FROM kemasan WHERE barang_id IN ({barang})",
        "DELETE FROM barang WHERE usaha_id = :u",
        "DELETE FROM data_kasir WHERE usaha_id = :u",
    ):
        kon.execute(text(sql), p)
    pengguna = kon.execute(text("SELECT pengguna_id FROM keanggotaan WHERE usaha_id = :u"), p).scalars().all()
    kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), p)
    kon.execute(text("DELETE FROM usaha WHERE id = :u"), p)
    for pid in pengguna:
        kon.execute(text("DELETE FROM pengguna WHERE id = :p"), {"p": pid})
    return True


def bangkitkan(kon) -> dict[str, int]:
    """Bangkitkan seluruh baris warung ini di memori, lalu tulis. Mengembalikan jumlah baris per tabel."""
    from argon2 import PasswordHasher

    acak = np.random.default_rng(BENIH)
    acak_katalog = np.random.default_rng([BENIH, 2])
    hari_geser = (akhir_data(kon) - AKHIR).days
    awal = {
        nama: int(kon.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {nama}")).scalar())
        for nama in (*(n for n, _ in URUTAN), *TABEL_NOTA)
    }
    t_ = Penampung(dict(awal))

    produk_master, distributor, penawaran = _katalog(kon, t_, acak_katalog)
    karakter = {distributor[d.nama][0]: KARAKTER_BARU[d.nama] for d in DISTRIBUTOR_BARU}
    kota_dist = {v[0]: v[1] for v in distributor.values()}
    profil = {distributor[d.nama][0]: d for d in DISTRIBUTOR_BARU}
    melayani = {i for i, d in profil.items() if KOTA in d.area_kirim}
    # Hanya distributor kelontong: distributor lama tidak boleh mendapat pesanan baru dari warung ini.
    for pmid in list(penawaran):
        penawaran[pmid] = [p for p in penawaran[pmid] if p.distributor_id in melayani]

    # --- pelaku -----------------------------------------------------------
    pengguna_id = t_.tambah(
        "pengguna",
        {"nomor_hp": "081319900002", "email": EMAIL, "kata_sandi_hash": PasswordHasher().hash(KATA_SANDI_CONTOH),
         "nama": PEMILIK, "aktif": True},
    )
    usaha_id = t_.tambah(
        "usaha",
        {
            "nama": NAMA_USAHA, "jenis_usaha": JENIS, "nama_pemilik": PEMILIK, "nib": "1204250099002",
            "npwp": None, "alamat": "Jl. Kusumanegara No.88, Umbulharjo, Kota Yogyakarta", "kota": KOTA,
            "lat": -7.8012, "lng": 110.3920, "nomor_hp": "081338899002", "email": EMAIL,
            "bio": "Buka 24 jam, tujuh hari seminggu. Sembako, rokok, gas, dan kebutuhan harian.",
            "warna": "#1E5AA8", "cara_hitung": CaraHitungStok.KEMASAN, "verifikasi": StatusVerifikasi.TERVERIFIKASI,
            "tingkat_verifikasi": "penuh", "bergabung_sejak": MULAI - timedelta(days=60),
            "tampilkan_alamat": True, "tampilkan_nomor_hp": True,
        },
    )
    t_.tambah("keanggotaan", {"pengguna_id": pengguna_id, "usaha_id": usaha_id, "peran": PeranPengguna.PEMILIK})
    t_.tambah(
        "data_kasir",
        {"usaha_id": usaha_id, "status": StatusKasir.TERHUBUNG, "merek": "Kasir Open POS", "terakhir_masuk": _wkt(AKHIR, 21, 0)},
    )

    barang: list[BarangSim] = []
    harga_jual: dict[int, int] = {}
    for kode, b in enumerate(BARANG):
        hari_kirim = int(acak.integers(1, 4))
        batas = float(max(1, math.ceil(b.pakai * (hari_kirim + 2))))
        bid = t_.tambah(
            "barang",
            {
                "usaha_id": usaha_id, "produk_master_id": produk_master[b.nama], "nama": b.nama,
                "deskripsi": deskripsi_kemasan(float(b.isi), "pcs", b.kemasan), "nama_lain": list(b.sinonim),
                "kategori": b.kategori, "kode_barang": f"B{kode + 1:03d}", "satuan": "pcs", "satuan_tampil": None,
                "stok": 0, "batas_aman": batas, "batas_aman_saran": batas, "sumber_batas_aman": SumberBatasAman.SISTEM,
                "hari_kirim": hari_kirim, "harga_beli_terakhir": b.harga_acuan, "hari_data_terkumpul": HARI_SIMULASI,
                "ingatkan_kedaluwarsa": False, "kedaluwarsa": None, "terhubung_kasir": True, "dicatat_manual": False,
                "catatan": None,
            },
        )
        t_.tambah("kemasan", {"barang_id": bid, "nama": b.kemasan, "isi": float(b.isi)})
        # Pemetaan menu 1:1: warung kelontong menjual barangnya apa adanya.
        pemetaan_id = t_.tambah("pemetaan_menu", {"usaha_id": usaha_id, "nama_menu": b.nama})
        t_.tambah("pemetaan_menu_bahan", {"pemetaan_id": pemetaan_id, "barang_id": bid, "takaran": 1})
        harga_jual[bid] = b.harga_jual
        sim = BarangSim(
            bid, b.nama, b.kategori, produk_master[b.nama], b.pakai, b.jarang,
            float(acak.normal(0.0, 0.00055)), batas,
        )
        sim.stok = float(max(1, round(batas * float(acak.uniform(1.8, 3.2)))))
        t_.tambah(
            "pergerakan",
            {
                "usaha_id": usaha_id, "barang_id": bid, "waktu": _wkt(MULAI - timedelta(days=1), 7, 0),
                "jenis": JenisPergerakan.MASUK, "jumlah": sim.stok, "stok_sesudah": sim.stok,
                "keterangan": "Stok awal saat pendaftaran", "oleh": PEMILIK,
            },
        )
        barang.append(sim)

    # --- simulasi hari demi hari --------------------------------------------
    menunggu: dict[date, list[dict]] = defaultdict(list)
    selesai: list[dict] = []
    terjual: list[tuple[int, int, date, float]] = []
    nomor_pesanan = 0
    for hari_ke in range(HARI_SIMULASI):
        t = MULAI + timedelta(days=hari_ke)

        # 1. Kiriman yang sampai hari ini, pukul 11.00, sebelum baris penjualan hari ini.
        for k in menunggu.pop(t, []):
            _terima(t_, k, t, usaha_id, acak, pemilik=PEMILIK)
            k["tiba_asli"] = t
            selesai.append(k)

        # 2. Penjualan sehari. Permintaan yang tidak terlayani ditandai stok habis.
        perlu: dict[int, list[tuple[BarangSim, PenawaranSim, float]]] = defaultdict(list)
        for b in barang:
            minta = _permintaan(b, t, hari_ke, acak)
            jual = min(minta, b.stok)
            habis = minta - jual > 1e-6
            b.stok -= jual
            if jual > 0:
                terjual.append((usaha_id, b.id, t, jual))
                t_.tambah(
                    "pergerakan",
                    {
                        "usaha_id": usaha_id, "barang_id": b.id, "waktu": _wkt(t, *JAM_BUKU_BESAR),
                        "jenis": JenisPergerakan.TERJUAL, "jumlah": -jual, "stok_sesudah": b.stok,
                        "keterangan": "Penjualan harian dari kasir", "oleh": "Kasir Open POS",
                    },
                )
            t_.tambah(
                "permintaan_harian",
                {
                    "usaha_id": usaha_id, "barang_id": b.id, "tanggal": t, "jumlah": jual, "stok_habis": habis,
                    "hari_libur": hari_libur(t), "pekan_gajian": pekan_gajian(t), "ramadan": sedang_ramadan(t),
                    "promo_aktif": False,
                },
            )

            # 3. Pesan ulang dengan aturan yang sama dengan warung lain di data utama.
            if b.stok + b.dalam_perjalanan < b.batas_aman:
                layak = penawaran.get(b.produk_master_id, [])
                if not layak:
                    continue
                if acak.random() < PELUANG_TERMURAH:
                    pilih = min(layak, key=lambda x: x.harga / x.isi)
                else:
                    pilih = layak[int(acak.integers(0, len(layak)))]
                butuh = b.pakai * HARI_PERSEDIAAN + b.batas_aman - b.stok - b.dalam_perjalanan
                q = max(1.0, math.ceil(butuh / pilih.isi))
                b.dalam_perjalanan += q * pilih.isi
                perlu[pilih.distributor_id].append((b, pilih, q))

        # 4. Satu pesanan per distributor.
        for dist_id, daftar in perlu.items():
            nomor_pesanan += 1
            k = _pesan(
                t_, usaha_id, dist_id, daftar, t, nomor_pesanan, karakter[dist_id], kota_dist[dist_id] != KOTA, acak,
                awalan="M",
            )
            if k["tiba"] <= AKHIR:
                menunggu[k["tiba"]].append(k)

        # 5. Koreksi stok sesekali (rusak, hilang), sesudah baris penjualan hari ini.
        if acak.random() < 0.10:
            b = barang[int(acak.integers(0, len(barang)))]
            susut = math.floor(float(acak.uniform(0.01, 0.06)) * b.stok)
            if susut >= 1:
                b.stok -= susut
                t_.tambah(
                    "pergerakan",
                    {
                        "usaha_id": usaha_id, "barang_id": b.id, "waktu": _wkt(t, *JAM_KOREKSI),
                        "jenis": JenisPergerakan.KOREKSI, "jumlah": -float(susut), "stok_sesudah": b.stok,
                        "keterangan": "Koreksi stok", "oleh": PEMILIK,
                    },
                )

    # Nilai berjalan harus sama dengan hasil akhir buku besar.
    stok_akhir = {b.id: b.stok for b in barang}
    for r in t_.baris["barang"]:
        r["stok"] = round(stok_akhir[r["id"]], 3)

    # --- turunan -------------------------------------------------------------
    dist_rinci = {r["id"]: r for r in t_.baris.get("distributor", [])}
    if len(dist_rinci) == len(DISTRIBUTOR_BARU):
        sejak = {i: r["sejak"] for i, r in dist_rinci.items()}
    else:
        # Pemasangan ulang: distributornya sudah ada dan tanggalnya sudah digeser, jadi dikembalikan dulu.
        sejak = {
            i: s - timedelta(days=hari_geser)
            for i, s in kon.execute(text("SELECT id, sejak FROM distributor WHERE id = ANY(:i)"), {"i": list(profil)}).all()
        }
    pesanan_per_id = {r["id"]: r for r in t_.baris.get("pesanan", [])}
    t_.baris["fitur_pesanan"] = [
        {"id": awal["fitur_pesanan"] + n + 1, **r}
        for n, r in enumerate(
            _baris_fitur(
                selesai, usaha_id, kota_dist, {i: d.minimum_pesanan for i, d in profil.items()}, sejak, penawaran,
                pesanan_per_id,
            )
        )
    ]

    # Generator terpisah, seperti data utama: menambah nota tidak menggeser angka penjualan.
    nota = modul_nota.bangkitkan(terjual, {usaha_id: JENIS_NOTA}, harga_jual, np.random.default_rng([BENIH, 1]))
    nota.tanggal = nota.tanggal + hari_geser

    _geser_baris(t_, hari_geser)
    jumlah = _tulis(kon, t_, urutan=URUTAN, dibuat_pada=_wkt(MULAI + timedelta(days=hari_geser)))
    nama = {r["id"]: r["nama"] for r in t_.baris["barang"]}
    satuan = {r["id"]: r["satuan"] for r in t_.baris["barang"]}
    with kon.connection.cursor() as kur:
        jumlah["transaksi"] = modul_nota.salin_transaksi(kur, nota, id_awal=awal["transaksi"], jam_proses=JAM_PROSES_NOTA)
        jumlah["transaksi_baris"] = modul_nota.salin_transaksi_baris(
            kur, nota, nama, satuan, id_awal=awal["transaksi_baris"], id_nota_awal=awal["transaksi"]
        )
    for tabel in TABEL_NOTA:
        kon.execute(text("SELECT setval(pg_get_serial_sequence(:t, 'id'), (SELECT MAX(id) FROM %s))" % tabel), {"t": tabel})
    _daftarkan_geseran(kon, t_, awal)
    jumlah["usaha_id"] = usaha_id
    return jumlah


def tambahkan(ulang: bool = False) -> dict[str, int] | None:
    """Mengembalikan None bila warungnya sudah ada dan `ulang` False."""
    with mesin().begin() as kon:
        ada = kon.execute(text("SELECT 1 FROM usaha WHERE email = :e"), {"e": EMAIL}).first() is not None
        if ada and not ulang:
            return None
        if ada:
            _hapus_lama(kon)
        return bangkitkan(kon)


def _perlu_mesin(kon) -> int | None:
    """Id usaha kalau warungnya ada tetapi belum punya perkiraan, mis. pemasangan yang terputus."""
    return kon.execute(
        text(
            """
            SELECT u.id FROM usaha u
             WHERE u.email = :e AND NOT EXISTS (SELECT 1 FROM prediksi p WHERE p.usaha_id = u.id)
            """
        ),
        {"e": EMAIL},
    ).scalar()


def jalankan_mesin(usaha_id: int) -> str:
    """Isi perkiraan dan saran untuk warung ini saja, supaya layarnya tidak menunggu jadwal malam."""
    from ml.layanan import _jalankan_mesin1
    from ml.mesin2.saran import jalankan

    h = _jalankan_mesin1(usaha_id, os.environ.get("WARUNGKU_METODE_MESIN1", "lightgbm"), 30)
    jalankan(usaha_id, thompson=True, nama_model="beta")
    return f"Mesin 1 meramal {h.barang} barang dalam {h.detik:.0f} detik, dan Mesin 2 sudah menilai pemasoknya."


def main() -> None:
    ap = argparse.ArgumentParser(description="Tambah Warung Madura Barokah 24 Jam ke basis data simulasi.")
    ap.add_argument("--ulang", action="store_true", help="hapus versi lama lebih dulu")
    ap.add_argument("--tanpa-mesin", action="store_true", help="jangan jalankan Mesin 1 dan Mesin 2 sesudahnya")
    arg = ap.parse_args()

    mulai = datetime.now()
    hasil = tambahkan(ulang=arg.ulang)
    if hasil is not None:
        # Sebelum mesin membaca baris baru, dan sebelum ada yang masuk ke akun warung ini.
        segarkan_statistik()
        for nama, n in hasil.items():
            if n and nama != "usaha_id":
                print(f"  {nama:<20} {n:>7}")
        print(f"  dibangkitkan dalam {(datetime.now() - mulai).total_seconds():.0f} detik")
    else:
        print(f"{NAMA_USAHA} sudah ada.")

    if not arg.tanpa_mesin:
        with mesin().connect() as kon:
            usaha_id = _perlu_mesin(kon)
        if usaha_id is not None:
            print("  " + jalankan_mesin(usaha_id))
            segarkan_statistik()
    if hasil is not None:
        print(f"Selesai: {NAMA_USAHA} ({EMAIL}).")


if __name__ == "__main__":
    main()
