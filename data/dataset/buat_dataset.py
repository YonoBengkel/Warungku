"""
Pembangkit dataset Warungku.

Satu simulasi, dua dataset. Ini bukan penghematan — ini syarat kebenaran:

* **D1 (deret permintaan)** untuk Mesin 1 lahir dari penjualan harian.
* **D2 (riwayat pesanan berlabel)** untuk Mesin 2 lahir dari pemesanan ulang
  yang dipicu oleh stok yang menipis karena penjualan itu.

Kalau keduanya dibangkitkan terpisah, pesanan tidak akan pernah nyambung dengan
pemakaian, dan model yang dilatih di atasnya belajar dari dunia yang tidak
konsisten.

Yang disimulasikan:

1. Permintaan harian per barang, dengan pola mingguan, tanggal gajian, Ramadan,
   Lebaran, hari libur, tren, dan barang yang jarang laku.
2. **Sensor kehabisan stok**: saat stok kosong, penjualan tercatat nol padahal
   permintaannya tidak nol. Hari seperti itu ditandai supaya model
   memperlakukannya sebagai data hilang, bukan permintaan nol.
3. Pemesanan ulang ke distributor, dengan kebijakan yang mengandung eksplorasi.
4. Hasil pesanan (tepat waktu, jumlah sesuai, kondisi barang) yang ditarik dari
   karakter tersembunyi tiap distributor.
5. **Matriks counterfactual**: untuk tiap pesanan, hasil yang AKAN terjadi
   seandainya dipesan ke distributor lain. Hanya untuk evaluasi, tidak pernah
   dilatihkan.
6. **Nota kasir** untuk seluruh 400 hari, lengkap dengan harga jual, sumber
   omset harian dan jumlah nota harian (lihat `dataset/nota.py`).

Jalankan: python -m dataset.buat_dataset
"""

from __future__ import annotations

import argparse
import csv
import math
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np
from sqlalchemy import text

from warungku.basis_data import mesin
from warungku.enum import (
    AlasanSelisih,
    CaraHitungStok,
    JenisPergerakan,
    PeranPengguna,
    StatusBayar,
    StatusKasir,
    StatusKontrak,
    StatusPesanan,
    StatusVerifikasi,
    SumberBatasAman,
)
from warungku.model import (
    Barang,
    DataKasir,
    FiturPesanan,
    HariLiburNasional,
    Distributor,
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
    Transaksi,
    TransaksiBaris,
    Ulasan,
    Usaha,
)

from . import nota as modul_nota
from .kalender import SEMUA_LIBUR
from .katalog import DISTRIBUTOR, KATALOG, PRODUK_PER_NAMA, RAK, UMKM, deskripsi_kemasan
from .pola import KARAKTER, faktor_musiman, hari_kirim_asli, hari_libur, musim_hujan, pekan_gajian, sedang_ramadan

# --------------------------------------------------------------------------
# Tetapan simulasi
# --------------------------------------------------------------------------
BENIH = 20261006
#: 400 hari: 365 untuk melatih, 35 terakhir disembunyikan untuk menguji.
HARI_SIMULASI = 400
HARI_UJI = 35
#: Nota kasir dibuat untuk seluruh 400 hari. Asumsi harga jual, belanja per
#: nota, dan jam ramai ada di `dataset/nota.py`.

#: Pesan ulang saat stok di bawah batas aman; sekali pesan untuk ~21 hari pakai.
HARI_PERSEDIAAN = 21
#: Peluang memilih distributor termurah. Sisanya acak — inilah eksplorasi yang
#: membuat data punya sinyal untuk distributor yang jarang dipilih.
PELUANG_TERMURAH = 0.70

#: Kata sandi untuk SELURUH akun contoh. Ini data simulasi, bukan data orang —
#: tidak ada rahasia yang bocor, dan tim butuh satu kata sandi yang bisa dipakai
#: masuk ke akun mana pun saat mencoba. Jangan pernah dipakai di luar simulasi.
KATA_SANDI_CONTOH = "warungku123"

AKHIR = date(2026, 10, 5)
MULAI = AKHIR - timedelta(days=HARI_SIMULASI - 1)
BATAS_UJI = AKHIR - timedelta(days=HARI_UJI - 1)

KELUARAN = Path(__file__).resolve().parent.parent / "keluaran"


def _wkt(t: date, jam: int = 9, menit: int = 0) -> datetime:
    return datetime.combine(t, time(jam, menit), tzinfo=timezone.utc)


# --------------------------------------------------------------------------
# Keadaan simulasi
# --------------------------------------------------------------------------
@dataclass
class BarangSim:
    id: int
    usaha_id: int
    produk_id: int
    nama: str
    kategori: str
    satuan: str
    pakai_harian: float
    isi_kemasan: float
    kemasan: str
    jarang: bool
    manual: bool
    hari_kirim: int
    stok: float = 0.0
    batas_aman: float = 0.0
    #: Sudah dipesan tapi belum sampai, dalam satuan dasar.
    dalam_perjalanan: float = 0.0
    tren: float = 0.0


@dataclass
class WarungSim:
    id: int
    nama: str
    jenis: object
    kota: str
    skala: float
    barang: list[BarangSim] = field(default_factory=list)


@dataclass
class PenawaranSim:
    id: int
    distributor_id: int
    produk_id: int
    kategori: str
    harga: int
    isi: float
    kemasan: str
    satuan_isi: str


class Pembangkit:
    def __init__(self, acak: np.random.Generator) -> None:
        self.acak = acak
        self.baris: dict[str, list[dict]] = {}
        self.penghitung: dict[str, int] = {}
        # Argon2 sengaja lambat (itu gunanya). Menghitungnya 78 kali memakan
        # belasan detik untuk hasil yang identik, jadi dihitung sekali.
        self._sandi_hash: str | None = None
        #: Pesanan yang sudah sampai, lengkap dengan hasilnya. Sumber D2.
        self.kiriman_selesai: list[dict] = []
        #: (barang_id, tanggal) -> catatan permintaan harian. Sumber D1.
        self.penjualan_harian: dict[tuple[int, date], dict] = {}

    # -- penampung baris ---------------------------------------------------
    def tambah(self, tabel: str, data: dict) -> int:
        """Menyimpan satu baris dan mengembalikan id yang diberikan sendiri."""
        n = self.penghitung.get(tabel, 0) + 1
        self.penghitung[tabel] = n
        data["id"] = n
        self.baris.setdefault(tabel, []).append(data)
        return n

    @property
    def sandi_hash(self) -> str:
        if self._sandi_hash is None:
            from argon2 import PasswordHasher

            self._sandi_hash = PasswordHasher().hash(KATA_SANDI_CONTOH)
        return self._sandi_hash

    # -- langkah 1: katalog ------------------------------------------------
    def buat_katalog(self) -> dict[str, int]:
        peta: dict[str, int] = {}
        for p in KATALOG:
            peta[p.nama] = self.tambah(
                "produk_master",
                {
                    "nama_kanonik": p.nama,
                    "kategori": p.kategori,
                    "satuan_dasar": p.satuan_dasar,
                    "sinonim": list(p.sinonim),
                },
            )
        return peta

    # -- langkah 2: pelaku -------------------------------------------------
    def buat_distributor(self, produk_id: dict[str, int]) -> list[PenawaranSim]:
        penawaran: list[PenawaranSim] = []
        for i, d in enumerate(DISTRIBUTOR):
            karakter = KARAKTER[i]
            pengguna_id = self.tambah(
                "pengguna",
                {
                    "nomor_hp": f"0812200{i:04d}",
                    "email": f"distributor{i + 1}@warungku.test",
                    "kata_sandi_hash": self.sandi_hash,
                    "nama": d.nama,
                    "aktif": True,
                },
            )
            dist_id = self.tambah(
                "distributor",
                {
                    "pengguna_id": pengguna_id,
                    "nama": d.nama,
                    "kota": d.kota,
                    "deskripsi": f"Distributor {', '.join(d.kategori).lower()} wilayah {d.kota}.",
                    "warna": ["#0f766e", "#1d4ed8", "#b45309", "#4a3aa7", "#0e7490", "#9a3412", "#166534", "#15803d"][i],
                    "kategori": list(d.kategori),
                    "area_kirim": list(d.area_kirim),
                    "terverifikasi": not d.baru,
                    "baru": d.baru,
                    "sejak": MULAI - timedelta(days=int(self.acak.integers(200, 1800))),
                    "alamat_gudang": f"Jl. Industri No.{10 + i}, {d.kota}",
                    "nomor_hp": f"0812733{i:04d}",
                    "jam_operasional": "Senin sampai Sabtu, 07.00 - 16.00",
                    "minimum_pesanan": d.minimum_pesanan,
                    "lat": d.lat,
                    "lng": d.lng,
                },
            )

            # Katalog distributor: semua produk pada kategori yang ia layani.
            for p in KATALOG:
                if p.kategori not in d.kategori or p.manual:
                    continue
                harga = int(round(p.harga_acuan * karakter.indeks_harga / 500) * 500)
                pid = self.tambah(
                    "penawaran",
                    {
                        "distributor_id": dist_id,
                        "produk_master_id": produk_id[p.nama],
                        "nama": p.nama,
                        "kategori": p.kategori,
                        "satuan": p.kemasan,
                        "harga_satuan": harga,
                        "kemasan_nama": p.kemasan,
                        "kemasan_isi": p.isi,
                        "satuan_isi": p.satuan_dasar,
                        "stok_tersedia": float(self.acak.integers(40, 600)),
                        "stok_diperbarui_pada": _wkt(AKHIR, 7, 30),
                        "keterangan": f"1 {p.kemasan} = {p.isi:g} {p.satuan_dasar}",
                        "aktif": True,
                    },
                )
                penawaran.append(
                    PenawaranSim(pid, dist_id, produk_id[p.nama], p.kategori, harga, p.isi, p.kemasan, p.satuan_dasar)
                )

                # Paket kontrak: makin panjang komitmen, makin murah.
                for kode, durasi, potong in (("A", 1, 0), ("B", 2, 3), ("C", 3, 5), ("E", 6, 10)):
                    self.tambah(
                        "paket_kontrak",
                        {
                            "penawaran_id": pid,
                            "distributor_id": dist_id,
                            "kode": f"Kontrak {kode}",
                            "durasi_bulan": durasi,
                            "kuota_min_per_bulan": float(max(5, round(20 * (1 - potong / 40)))),
                            "harga_satuan": int(round(harga * (1 - potong / 100) / 500) * 500),
                            "hemat_persen": potong,
                            "ketentuan_kuota_kurang": (
                                "Kekurangan kuota bulan berjalan ditagihkan pada bulan berikutnya."
                            ),
                            "ketentuan_berhenti": (
                                "Penghentian di tengah masa kontrak hanya bisa lewat persetujuan distributor."
                            ),
                        },
                    )
        return penawaran

    def buat_warung(self, produk_id: dict[str, int]) -> list[WarungSim]:
        warungs: list[WarungSim] = []
        for i, u in enumerate(UMKM):
            pengguna_id = self.tambah(
                "pengguna",
                {
                    "nomor_hp": f"0813100{i:04d}",
                    "email": f"umkm{i + 1}@warungku.test",
                    "kata_sandi_hash": self.sandi_hash,
                    "nama": f"Pemilik {u.nama}",
                    "aktif": True,
                },
            )
            usaha_id = self.tambah(
                "usaha",
                {
                    "nama": u.nama,
                    "jenis_usaha": u.jenis,
                    "nama_pemilik": f"Pemilik {u.nama}",
                    "nib": f"12042500{i:05d}",
                    "npwp": None,
                    "alamat": f"Jl. Contoh No.{10 + i}, {u.kota}",
                    "kota": u.kota,
                    "lat": u.lat,
                    "lng": u.lng,
                    "nomor_hp": f"0813388{i:04d}",
                    "email": f"umkm{i + 1}@warungku.test",
                    "bio": None,
                    "warna": "#0f766e",
                    "cara_hitung": CaraHitungStok.KEMASAN,
                    "verifikasi": StatusVerifikasi.TERVERIFIKASI,
                    "tingkat_verifikasi": "penuh",
                    "bergabung_sejak": MULAI - timedelta(days=int(self.acak.integers(30, 400))),
                    "tampilkan_alamat": True,
                    "tampilkan_nomor_hp": True,
                },
            )
            self.tambah("keanggotaan", {"pengguna_id": pengguna_id, "usaha_id": usaha_id, "peran": PeranPengguna.PEMILIK})
            self.tambah(
                "data_kasir",
                {
                    "usaha_id": usaha_id,
                    "status": StatusKasir.TERHUBUNG,
                    "merek": "Kasir Open POS",
                    "terakhir_masuk": _wkt(AKHIR, 21, 0),
                },
            )

            w = WarungSim(usaha_id, u.nama, u.jenis, u.kota, u.skala)
            for kode, (nama_produk, pakai) in enumerate(RAK[u.jenis]):
                p = PRODUK_PER_NAMA[nama_produk]
                pakai_harian = pakai * u.skala
                hari_kirim = int(self.acak.integers(1, 4))
                batas = pakai_harian * (hari_kirim + 2)
                barang_id = self.tambah(
                    "barang",
                    {
                        "usaha_id": usaha_id,
                        "produk_master_id": produk_id[nama_produk],
                        "nama": nama_produk,
                        "deskripsi": deskripsi_kemasan(p.isi, p.satuan_dasar, p.kemasan),
                        "nama_lain": list(p.sinonim),
                        "kategori": p.kategori,
                        "kode_barang": f"B{kode + 1:03d}",
                        "satuan": p.satuan_dasar,
                        "satuan_tampil": None,
                        "stok": 0,
                        "batas_aman": round(batas, 3),
                        "batas_aman_saran": round(batas, 3),
                        "sumber_batas_aman": SumberBatasAman.SISTEM,
                        "hari_kirim": hari_kirim,
                        "harga_beli_terakhir": p.harga_acuan,
                        "hari_data_terkumpul": HARI_SIMULASI,
                        "ingatkan_kedaluwarsa": False,
                        "kedaluwarsa": None,
                        "terhubung_kasir": not p.manual,
                        "dicatat_manual": p.manual,
                        "catatan": None,
                    },
                )
                self.tambah("kemasan", {"barang_id": barang_id, "nama": p.kemasan, "isi": p.isi})

                # Pemetaan menu 1:1 — struktur resep sudah ada, tapi sesuai
                # keputusan pemilik proyek belum diisi berbilang bahan.
                pemetaan_id = self.tambah("pemetaan_menu", {"usaha_id": usaha_id, "nama_menu": nama_produk})
                self.tambah(
                    "pemetaan_menu_bahan",
                    {"pemetaan_id": pemetaan_id, "barang_id": barang_id, "takaran": 1},
                )

                warung_barang = BarangSim(
                    id=barang_id,
                    usaha_id=usaha_id,
                    produk_id=produk_id[nama_produk],
                    nama=nama_produk,
                    kategori=p.kategori,
                    satuan=p.satuan_dasar,
                    pakai_harian=pakai_harian,
                    isi_kemasan=p.isi,
                    kemasan=p.kemasan,
                    jarang=p.jarang,
                    manual=p.manual,
                    hari_kirim=hari_kirim,
                    batas_aman=batas,
                    # Tren halus: sebagian barang naik, sebagian turun pelan.
                    tren=float(self.acak.normal(0.0, 0.00055)),
                )
                warung_barang.stok = batas * float(self.acak.uniform(1.8, 3.2))
                # Stok pembuka WAJIB punya barisnya sendiri di buku besar.
                # Buku besar yang tidak bisa menjelaskan dari mana stok awal
                # datang akan selalu meleset dari stok tercatat, dan layar
                # riwayat barang menampilkan saldo yang menggantung tanpa asal.
                self.tambah(
                    "pergerakan",
                    {
                        "usaha_id": usaha_id,
                        "barang_id": barang_id,
                        "waktu": _wkt(MULAI - timedelta(days=1), 7, 0),
                        "jenis": JenisPergerakan.MASUK,
                        "jumlah": round(warung_barang.stok, 3),
                        "stok_sesudah": round(warung_barang.stok, 3),
                        "keterangan": "Stok awal saat pendaftaran",
                        "pesanan_id": None,
                        "transaksi_id": None,
                        "oleh": f"Pemilik {u.nama}",
                    },
                )
                w.barang.append(warung_barang)
            warungs.append(w)
        return warungs

    # -- langkah 3: simulasi hari demi hari --------------------------------
    def permintaan(self, b: BarangSim, t: date, jenis, hari_ke: int) -> float:
        """
        Permintaan satu barang pada satu hari, dalam satuan dasar.

        Dipakai sebaran binomial negatif (Poisson dengan ragam berlebih), bukan
        Gaussian: permintaan itu cacahan, tidak pernah negatif, dan ragamnya
        selalu lebih besar daripada rata-ratanya di data penjualan nyata.
        """
        rata = b.pakai_harian * faktor_musiman(t, jenis) * (1.0 + b.tren * hari_ke)
        if rata <= 0:
            return 0.0

        if b.jarang:
            # Barang jarang laku: kebanyakan hari nol, sesekali melonjak.
            # Inilah bentuk permintaan yang merontokkan model naif dan yang
            # membuat Croston layak jadi pembanding.
            if self.acak.random() > 0.28:
                return 0.0
            rata *= 3.4

        # Binomial negatif lewat campuran Gamma-Poisson.
        bentuk = 6.0
        lam = self.acak.gamma(bentuk, rata / bentuk)
        nilai = float(self.acak.poisson(lam)) if lam < 1e6 else lam
        return max(0.0, nilai)

    def pilih_distributor(
        self, b: BarangSim, kota: str, penawaran: list[PenawaranSim], dist_area: dict[int, set[str]]
    ) -> tuple[list[PenawaranSim], PenawaranSim | None]:
        """
        Lapis 1 (kelayakan) lalu kebijakan pemilihan.

        Kebijakannya sengaja TIDAK selalu memilih termurah. Kalau semua pesanan
        dalam data selalu jatuh ke distributor termurah, Mesin 2 tidak akan
        pernah melihat hasil distributor lain — dan model yang dilatih dari data
        begitu cuma mengukuhkan kebiasaan lama, bukan memperbaikinya.
        """
        layak = [
            p
            for p in penawaran
            if p.produk_id == b.produk_id and kota in dist_area[p.distributor_id]
        ]
        if not layak:
            return [], None
        if self.acak.random() < PELUANG_TERMURAH:
            pilihan = min(layak, key=lambda p: p.harga / p.isi)
        else:
            pilihan = layak[int(self.acak.integers(0, len(layak)))]
        return layak, pilihan

    def hasil_pesanan(self, karakter, *, besar_relatif: float, hujan: bool, luar_kota: bool) -> dict:
        """Menarik hasil satu pesanan dari karakter tersembunyi distributor."""
        p_tepat = karakter.peluang_tepat_waktu(
            besar_relatif=besar_relatif, hujan=hujan, luar_kota=luar_kota
        )
        tepat = bool(self.acak.random() < p_tepat)
        jumlah_sesuai = bool(self.acak.random() < karakter.p_jumlah_sesuai)
        kondisi_baik = bool(self.acak.random() < karakter.p_kondisi_baik)
        return {
            "tepat_waktu": tepat,
            "jumlah_sesuai": jumlah_sesuai,
            "kondisi_baik": kondisi_baik,
            "sukses": tepat and jumlah_sesuai and kondisi_baik,
            "hari_sampai": hari_kirim_asli(karakter, tepat, self.acak),
            "rasio_diterima": 1.0 if jumlah_sesuai else float(self.acak.uniform(0.70, 0.97)),
        }

    # ----------------------------------------------------------------------
    def simulasi(
        self,
        warungs: list[WarungSim],
        penawaran: list[PenawaranSim],
        dist_area: dict[int, set[str]],
        dist_kota: dict[int, str],
        karakter_per_dist: dict[int, object],
    ) -> list[dict]:
        """Jalan hari demi hari. Mengembalikan matriks counterfactual."""
        from collections import defaultdict

        counterfactual: list[dict] = []
        menunggu: dict[date, list[dict]] = defaultdict(list)
        penjualan_harian: dict[tuple[int, date], dict] = {}
        nomor = 0

        for hari_ke in range(HARI_SIMULASI):
            t = MULAI + timedelta(days=hari_ke)
            hujan = musim_hujan(t)

            # --- 1. Kedatangan barang yang dipesan beberapa hari lalu ------
            for kiriman in menunggu.pop(t, []):
                self._terima_kiriman(kiriman, t)

            for w in warungs:
                perlu_pesan: dict[int, list[tuple[BarangSim, PenawaranSim, float]]] = defaultdict(list)

                # --- 2. Permintaan dan penjualan --------------------------
                for b in w.barang:
                    permintaan = self.permintaan(b, t, w.jenis, hari_ke)
                    terjual = min(permintaan, b.stok)
                    # Sensor kehabisan stok: permintaan ada, barangnya tidak.
                    habis = permintaan - terjual > 1e-6
                    b.stok -= terjual

                    if terjual > 1e-9:
                        # Barang yang dicatat manual (tisu, gas) tidak lewat
                        # kasir, jadi tidak pernah muncul di nota. Pemakaiannya
                        # dicatat pemilik sendiri.
                        self.tambah(
                            "pergerakan",
                            {
                                "usaha_id": w.id,
                                "barang_id": b.id,
                                "waktu": _wkt(t, 20, 30),
                                "jenis": JenisPergerakan.TERJUAL,
                                "jumlah": -round(terjual, 3),
                                "stok_sesudah": round(b.stok, 3),
                                "keterangan": (
                                    "Pemakaian harian, dicatat manual" if b.manual
                                    else "Penjualan harian dari kasir"
                                ),
                                "pesanan_id": None,
                                "transaksi_id": None,
                                "oleh": f"Pemilik {w.nama}" if b.manual else "Kasir Open POS",
                            },
                        )

                    # Barang yang dicatat manual tidak pernah masuk data model.
                    if not b.manual:
                        penjualan_harian[(b.id, t)] = {
                            "usaha_id": w.id,
                            "barang_id": b.id,
                            "tanggal": t,
                            "jumlah": round(terjual, 3),
                            "stok_habis": habis,
                            "hari_libur": hari_libur(t),
                            "pekan_gajian": pekan_gajian(t),
                            "ramadan": sedang_ramadan(t),
                            "promo_aktif": False,
                        }

                    # --- 3. Perlu pesan ulang? ----------------------------
                    if b.stok + b.dalam_perjalanan < b.batas_aman:
                        layak, pilihan = self.pilih_distributor(b, w.kota, penawaran, dist_area)
                        if pilihan is None:
                            continue
                        butuh = b.pakai_harian * HARI_PERSEDIAAN + b.batas_aman - b.stok - b.dalam_perjalanan
                        jumlah_jual = max(1.0, math.ceil(butuh / pilihan.isi))
                        b.dalam_perjalanan += jumlah_jual * pilihan.isi
                        perlu_pesan[pilihan.distributor_id].append((b, pilihan, jumlah_jual))
                        # Catat seluruh kandidat untuk evaluasi counterfactual.
                        self._catat_counterfactual(
                            counterfactual, w, b, layak, pilihan, butuh, t,
                            dist_kota, karakter_per_dist, hujan,
                        )

                # --- 4. Buat pesanan, satu per distributor ----------------
                for dist_id, daftar in perlu_pesan.items():
                    nomor += 1
                    self._buat_pesanan(
                        w, dist_id, daftar, t, nomor, menunggu,
                        karakter_per_dist[dist_id], dist_kota[dist_id], hujan,
                    )

                # --- 5. Koreksi stok sesekali (barang basi, salah hitung) --
                # Dicatat pukul 21.30, SESUDAH penjualan pukul 20.30 — bukan
                # pukul 17.00 seperti versi sebelumnya. Waktu pada baris buku
                # besar harus mengikuti urutan penerapannya; kalau tidak,
                # `stok_sesudah` pada baris terakhir menurut waktu bukan saldo
                # yang sebenarnya, dan riwayat stok di layar akan terlihat
                # melompat mundur. Cacat ini lolos pada 20 UMKM dan baru
                # tertangkap pada 70.
                if self.acak.random() < 0.04:
                    b = w.barang[int(self.acak.integers(0, len(w.barang)))]
                    if b.stok > 10:
                        susut = float(self.acak.uniform(0.01, 0.06)) * b.stok
                        b.stok -= susut
                        self.tambah(
                            "pergerakan",
                            {
                                "usaha_id": w.id,
                                "barang_id": b.id,
                                "waktu": _wkt(t, 21, 30),
                                "jenis": JenisPergerakan.KOREKSI,
                                "jumlah": -round(susut, 3),
                                "stok_sesudah": round(b.stok, 3),
                                "keterangan": "Koreksi stok",
                                "pesanan_id": None,
                                "transaksi_id": None,
                                "oleh": f"Pemilik {w.nama}",
                            },
                        )

        self.penjualan_harian = penjualan_harian
        return counterfactual

    # ----------------------------------------------------------------------
    def _catat_counterfactual(
        self, keluaran, w, b, layak, pilihan, butuh, t, dist_kota, karakter_per_dist, hujan
    ) -> None:
        """
        Hasil yang AKAN terjadi seandainya dipesan ke tiap kandidat.

        Tidak pernah dilatihkan — hanya dipakai menghitung NDCG dan regret saat
        evaluasi. Tanpa ini, evaluasi peringkat cuma bisa mengukur kandidat yang
        kebetulan terpilih, dan itu bukan evaluasi peringkat.

        Jumlah kemasan dihitung ULANG untuk tiap kandidat dari kebutuhan yang
        sama (`butuh`), bukan disalin dari jumlah kemasan kandidat yang
        terpilih. Kalau disalin, kandidat berkemasan besar akan tampak membawa
        pesanan jauh lebih besar daripada yang sebenarnya perlu, dan karakter
        distributor yang peka ukuran pesanan ikut terhukum oleh angka karangan.
        """
        termurah = min(p.harga / p.isi for p in layak)
        for kandidat in layak:
            karakter = karakter_per_dist[kandidat.distributor_id]
            jumlah_jual = max(1.0, math.ceil(butuh / kandidat.isi))
            satuan_dasar = jumlah_jual * kandidat.isi
            besar = satuan_dasar / max(1e-6, b.pakai_harian * HARI_PERSEDIAAN)
            hasil = self.hasil_pesanan(
                karakter,
                besar_relatif=besar,
                hujan=hujan,
                luar_kota=dist_kota[kandidat.distributor_id] != w.kota,
            )
            keluaran.append(
                {
                    "tanggal": t.isoformat(),
                    "usaha_id": w.id,
                    "barang_id": b.id,
                    "distributor_id": kandidat.distributor_id,
                    "dipilih": int(kandidat.distributor_id == pilihan.distributor_id),
                    "harga_per_satuan_dasar": round(kandidat.harga / kandidat.isi, 4),
                    "rasio_harga": round((kandidat.harga / kandidat.isi) / termurah, 4),
                    # Jumlah dan nilai per kandidat: evaluasi peringkat perlu
                    # merakit vektor fitur untuk kandidat yang TIDAK dipilih,
                    # dan tanpa kedua kolom ini fitur itu cuma bisa dikarang.
                    "jumlah_kemasan": jumlah_jual,
                    "jumlah_satuan_dasar": round(satuan_dasar, 3),
                    "nilai": int(kandidat.harga) * int(jumlah_jual),
                    "sekota": int(dist_kota[kandidat.distributor_id] == w.kota),
                    "sukses": int(hasil["sukses"]),
                    "tepat_waktu": int(hasil["tepat_waktu"]),
                    "jumlah_sesuai": int(hasil["jumlah_sesuai"]),
                    "kondisi_baik": int(hasil["kondisi_baik"]),
                }
            )

    # ----------------------------------------------------------------------
    def _buat_pesanan(
        self, w, dist_id, daftar, t, nomor, menunggu, karakter, kota_dist, hujan
    ) -> None:
        """Satu pesanan ke satu distributor, berisi semua barang yang perlu diisi hari itu."""
        nilai = sum(int(p.harga) * int(q) for _, p, q in daftar)
        besar = sum(q * p.isi for b, p, q in daftar) / max(
            1e-6, sum(b.pakai_harian * HARI_PERSEDIAAN for b, _, _ in daftar)
        )
        hasil = self.hasil_pesanan(
            karakter, besar_relatif=besar, hujan=hujan, luar_kota=kota_dist != w.kota
        )
        # Perkiraan tiba yang DIJANJIKAN ke pemilik usaha; dibandingkan nanti
        # dengan waktu sampai sungguhan untuk menentukan "tepat waktu".
        janji_hari = int(self.acak.integers(2, 4))
        tiba_janji = t + timedelta(days=janji_hari)
        tiba_asli = t + timedelta(days=hasil["hari_sampai"])

        pesanan_id = self.tambah(
            "pesanan",
            {
                "nomor": f"PS-{t.strftime('%y%m%d')}-{nomor:05d}",
                "usaha_id": w.id,
                "distributor_id": dist_id,
                "kontrak_id": None,
                "dibuat_pada": _wkt(t, 8, 15),
                "status": StatusPesanan.DIKIRIM,
                "ongkos_kirim": int(self.acak.choice([0, 20_000, 25_000, 28_000])),
                "perkiraan_tiba": _wkt(tiba_janji, 15, 0),
                "status_bayar": StatusBayar.BUKTI_TERKIRIM,
                "jumlah_bukti": 1,
                "dari_saran": bool(self.acak.random() < 0.55),
                "dari_rutin": False,
                "catatan_untuk_distributor": None,
                "sudah_diulas": False,
                "kode_belanja": None,
                "alasan_tolak": None,
                "kirim_kurir": None,
                "kirim_pengantar": None,
                "kirim_nomor_resi": None,
                "kirim_diterima_oleh": None,
                "kirim_waktu_sampai": None,
                "kirim_catatan": None,
            },
        )
        for status, jam, ket in (
            (StatusPesanan.MENUNGGU_KONFIRMASI, 8, "Pesanan dikirim ke distributor."),
            (StatusPesanan.DISIAPKAN, 10, "Distributor menerima pesanan dan menyiapkan barang."),
            (StatusPesanan.DIKIRIM, 7, "Barang berangkat dari gudang distributor."),
        ):
            self.tambah(
                "pesanan_jejak",
                {"pesanan_id": pesanan_id, "waktu": _wkt(t, jam, 0), "status": status, "keterangan": ket},
            )

        baris_ids = []
        for b, p, q in daftar:
            baris_id = self.tambah(
                "pesanan_baris",
                {
                    "pesanan_id": pesanan_id,
                    "penawaran_id": p.id,
                    "barang_id": b.id,
                    "nama": b.nama,
                    "jumlah": float(q),
                    "satuan": p.kemasan,
                    "harga_satuan": int(p.harga),
                    "harga_normal": int(p.harga),
                    "promo_id": None,
                    "isi_per_satuan": p.isi,
                    "jumlah_diterima": None,
                    "alasan_selisih": None,
                    "catatan_penerimaan": None,
                },
            )
            baris_ids.append((baris_id, b, p, q))

        if tiba_asli <= AKHIR:
            menunggu[tiba_asli].append(
                {
                    "pesanan_id": pesanan_id,
                    "usaha_id": w.id,
                    "distributor_id": dist_id,
                    "warung": w,
                    "baris": baris_ids,
                    "hasil": hasil,
                    "nilai": nilai,
                    "tiba_janji": tiba_janji,
                    "tanggal_pesan": t,
                }
            )

    # ----------------------------------------------------------------------
    def _terima_kiriman(self, kiriman: dict, t: date) -> None:
        """Barang sampai: stok bertambah, selisih dicatat, pesanan ditutup."""
        hasil = kiriman["hasil"]
        w = kiriman["warung"]
        pesanan = self.baris["pesanan"][kiriman["pesanan_id"] - 1]
        ada_selisih = False

        for baris_id, b, p, q in kiriman["baris"]:
            diterima = q if hasil["jumlah_sesuai"] else max(0.0, round(q * hasil["rasio_diterima"], 2))
            masuk = diterima * p.isi
            b.stok += masuk
            b.dalam_perjalanan = max(0.0, b.dalam_perjalanan - q * p.isi)

            baris = self.baris["pesanan_baris"][baris_id - 1]
            baris["jumlah_diterima"] = float(diterima)
            if not hasil["jumlah_sesuai"]:
                baris["alasan_selisih"] = AlasanSelisih.KURANG
                baris["catatan_penerimaan"] = "Jumlah kurang dari yang dipesan."
                ada_selisih = True
            elif not hasil["kondisi_baik"]:
                baris["alasan_selisih"] = AlasanSelisih.RUSAK
                baris["catatan_penerimaan"] = "Sebagian barang rusak saat diterima."
                ada_selisih = True

            if masuk > 0:
                self.tambah(
                    "pergerakan",
                    {
                        "usaha_id": w.id,
                        "barang_id": b.id,
                        "waktu": _wkt(t, 11, 0),
                        "jenis": JenisPergerakan.MASUK,
                        "jumlah": round(masuk, 3),
                        "stok_sesudah": round(b.stok, 3),
                        "keterangan": "Masuk dari pesanan " + pesanan["nomor"],
                        "pesanan_id": kiriman["pesanan_id"],
                        "transaksi_id": None,
                        "oleh": f"Pemilik {w.nama}",
                    },
                )

        pesanan["status"] = StatusPesanan.SELESAI_CATATAN if ada_selisih else StatusPesanan.SELESAI
        pesanan["status_bayar"] = StatusBayar.DIKONFIRMASI
        pesanan["kirim_kurir"] = "Armada sendiri"
        pesanan["kirim_pengantar"] = "Kurir distributor"
        pesanan["kirim_nomor_resi"] = "RSI-%06d" % kiriman["pesanan_id"]
        pesanan["kirim_diterima_oleh"] = f"Pemilik {w.nama}"
        pesanan["kirim_waktu_sampai"] = _wkt(t, 11, 0)
        pesanan["kirim_catatan"] = "Dihitung bersama penerima saat barang diturunkan."

        self.tambah(
            "pesanan_jejak",
            {
                "pesanan_id": kiriman["pesanan_id"],
                "waktu": _wkt(t, 11, 0),
                "status": pesanan["status"],
                "keterangan": "Barang sampai dan dihitung di tempat.",
            },
        )

        # Ulasan hanya ditulis sebagian pemilik usaha — seperti di dunia nyata.
        if self.acak.random() < 0.45:
            dasar = 5 if hasil["sukses"] else int(self.acak.integers(2, 5))
            pesanan["sudah_diulas"] = True
            self.tambah(
                "ulasan",
                {
                    "pesanan_id": kiriman["pesanan_id"],
                    "usaha_id": w.id,
                    "distributor_id": kiriman["distributor_id"],
                    "rating": dasar,
                    "isi": None,
                    "waktu": _wkt(t, 19, 0),
                    "aspek_ketepatan_waktu": 5 if hasil["tepat_waktu"] else int(self.acak.integers(2, 4)),
                    "aspek_jumlah_sesuai": 5 if hasil["jumlah_sesuai"] else int(self.acak.integers(2, 4)),
                    "aspek_kondisi_barang": 5 if hasil["kondisi_baik"] else int(self.acak.integers(2, 4)),
                },
            )

        kiriman["tiba_asli"] = t
        self.kiriman_selesai.append(kiriman)

    # ----------------------------------------------------------------------
    def buat_nota(self, acak: np.random.Generator) -> modul_nota.Nota:
        """
        Nota kasir untuk seluruh 400 hari, dari penjualan di buku besar.

        `acak` sengaja generator terpisah dari `self.acak`, supaya menambah nota
        tidak menggeser satu angka pun di D1 dan D2.

        Baris `pergerakan` tidak ditautkan ke nota (`transaksi_id` kosong). Satu
        baris buku besar di sini adalah ringkasan sehari dari puluhan nota, jadi
        menautkannya ke salah satu nota akan menyesatkan. Jalur API yang
        sungguhan (`POST /usaha/{id}/transaksi`) menulis satu baris per bahan per
        nota, dan di sana tautannya selalu ada.
        """
        manual = {b["id"] for b in self.baris["barang"] if b["dicatat_manual"]}
        terjual = [
            (pg["usaha_id"], pg["barang_id"], pg["waktu"].date(), -pg["jumlah"])
            for pg in self.baris.get("pergerakan", [])
            if pg["jenis"] is JenisPergerakan.TERJUAL and pg["barang_id"] not in manual
        ]
        jenis = {u["id"]: str(u["jenis_usaha"]) for u in self.baris["usaha"]}
        beli = {
            b["id"]: PRODUK_PER_NAMA[b["nama"]].harga_acuan / PRODUK_PER_NAMA[b["nama"]].isi
            for b in self.baris["barang"]
            if b["id"] not in manual
        }
        harga = modul_nota.harga_jual(
            [b for b in self.baris["barang"] if b["id"] not in manual], jenis, beli, acak
        )
        return modul_nota.bangkitkan(terjual, jenis, harga, acak)

    # ----------------------------------------------------------------------
    def bangun_fitur_pesanan(self, counterfactual: list[dict]) -> list[dict]:
        """
        Tabel latih Mesin 2: satu baris per pesanan selesai, fitur + label.

        Fitur distributor dihitung **pada keadaan saat pesanan dibuat**, bukan
        keadaan hari ini. Kalau dipakai angka hari ini, model melihat masa depan
        — rating yang terbentuk justru karena pesanan ini — dan akurasinya jadi
        bohong (kebocoran data).
        """
        from collections import defaultdict

        rasio = {
            (r["tanggal"], r["usaha_id"], r["barang_id"], r["distributor_id"]): r["rasio_harga"]
            for r in counterfactual
        }
        kota_usaha = {u["id"]: u["kota"] for u in self.baris["usaha"]}
        kota_dist = {d["id"]: d["kota"] for d in self.baris["distributor"]}
        minimum_dist = {d["id"]: d["minimum_pesanan"] for d in self.baris["distributor"]}
        sejak_dist = {d["id"]: d["sejak"] for d in self.baris["distributor"]}

        stat: dict[int, dict] = defaultdict(
            lambda: {"n": 0, "tepat": 0, "jumlah": 0, "kondisi": 0, "ulasan": 0, "selesai": 0}
        )
        hubungan: dict[tuple[int, int], int] = defaultdict(int)
        hasil: list[dict] = []

        for k in sorted(self.kiriman_selesai, key=lambda x: (x["tanggal_pesan"], x["pesanan_id"])):
            d = k["distributor_id"]
            s = stat[d]
            n = max(1, s["n"])
            tanggal = k["tanggal_pesan"]
            pesanan = self.baris["pesanan"][k["pesanan_id"] - 1]

            # Penghalusan Bayesian: distributor dengan sedikit riwayat ditarik ke
            # 4,2 (rata-rata umum). Tanpa ini, satu pesanan mulus pertama membuat
            # distributor baru terlihat sempurna.
            BOBOT_AWAL, PRIOR = 8.0, 4.2
            def halus(berhasil: int) -> float:
                return (BOBOT_AWAL * PRIOR + 5.0 * berhasil + 2.5 * (s["n"] - berhasil)) / (BOBOT_AWAL + s["n"])

            rasio_baris = [
                rasio.get((tanggal.isoformat(), k["usaha_id"], b.id, d), 1.0)
                for _, b, _, _ in k["baris"]
            ]
            telat = (k["tiba_asli"] - k["tiba_janji"]).days

            hasil.append(
                {
                    "pesanan_id": k["pesanan_id"],
                    "usaha_id": k["usaha_id"],
                    "distributor_id": d,
                    "tanggal": tanggal,
                    "d_aspek_ketepatan": round(halus(s["tepat"]), 4),
                    "d_aspek_jumlah": round(halus(s["jumlah"]), 4),
                    "d_aspek_kondisi": round(halus(s["kondisi"]), 4),
                    "d_jumlah_ulasan": s["ulasan"],
                    "d_pesanan_selesai": s["selesai"],
                    "d_umur_hari": (tanggal - sejak_dist[d]).days,
                    "h_pernah_kontrak": False,
                    "h_pesanan_sebelumnya": hubungan[(k["usaha_id"], d)],
                    "p_jumlah_item": len(k["baris"]),
                    "p_nilai": int(k["nilai"]),
                    "p_rasio_harga": round(sum(rasio_baris) / max(1, len(rasio_baris)), 4),
                    "p_sekota": kota_usaha[k["usaha_id"]] == kota_dist[d],
                    "p_hari_pekan": tanggal.weekday(),
                    "p_bulan": tanggal.month,
                    "p_musim_hujan": musim_hujan(tanggal),
                    "p_stok_cukup": True,
                    "p_minimum_terpenuhi": int(k["nilai"]) >= minimum_dist[d],
                    "sukses": bool(k["hasil"]["sukses"]),
                    "l_tepat_waktu": bool(k["hasil"]["tepat_waktu"]),
                    "l_jumlah_sesuai": bool(k["hasil"]["jumlah_sesuai"]),
                    "l_kondisi_baik": bool(k["hasil"]["kondisi_baik"]),
                    "l_telat_hari": int(telat),
                }
            )

            # Baru SESUDAH baris ditulis, statistik diperbarui.
            s["n"] += 1
            s["selesai"] += 1
            s["tepat"] += int(k["hasil"]["tepat_waktu"])
            s["jumlah"] += int(k["hasil"]["jumlah_sesuai"])
            s["kondisi"] += int(k["hasil"]["kondisi_baik"])
            if pesanan["sudah_diulas"]:
                s["ulasan"] += 1
            hubungan[(k["usaha_id"], d)] += 1

        return hasil

    # ----------------------------------------------------------------------
    def selaraskan_stok_akhir(self, warungs: list[WarungSim]) -> None:
        """
        `barang.stok` harus sama dengan hasil akhir buku besar.

        Tabel `barang` menyimpan stok sebagai nilai berjalan supaya layar tidak
        perlu menjumlah ribuan baris pergerakan tiap kali dibuka. Nilai berjalan
        itu hanya boleh ada kalau ada yang menjaganya tetap sama dengan buku
        besar — di sini, dan di API nanti, lewat jalur tulis yang sama.
        """
        peta = {b["id"]: b for b in self.baris["barang"]}
        for w in warungs:
            for b in w.barang:
                peta[b.id]["stok"] = round(b.stok, 3)

    # ----------------------------------------------------------------------
    def baris_permintaan_harian(self) -> list[dict]:
        """D1 dalam bentuk baris tabel, urut barang lalu tanggal."""
        return [
            dict(v)
            for _, v in sorted(
                self.penjualan_harian.items(), key=lambda x: (x[0][0], x[0][1])
            )
        ]


# --------------------------------------------------------------------------
# Penulisan ke basis data
# --------------------------------------------------------------------------

#: Urutan tulis = urutan kunci asing. Tabel induk selalu lebih dulu, jadi
#: tidak perlu menonaktifkan constraint — kalau urutannya salah, Postgres yang
#: memberi tahu, bukan kita yang menebak.
URUTAN: tuple[tuple[str, type], ...] = (
    ("hari_libur_nasional", HariLiburNasional),
    ("produk_master", ProdukMaster),
    ("pengguna", Pengguna),
    ("usaha", Usaha),
    ("keanggotaan", Keanggotaan),
    ("distributor", Distributor),
    ("data_kasir", DataKasir),
    ("barang", Barang),
    ("kemasan", Kemasan),
    ("pemetaan_menu", PemetaanMenu),
    ("pemetaan_menu_bahan", PemetaanMenuBahan),
    ("penawaran", Penawaran),
    ("paket_kontrak", PaketKontrak),
    ("pesanan", Pesanan),
    ("pesanan_baris", PesananBaris),
    ("pesanan_jejak", PesananJejak),
    ("transaksi", Transaksi),
    ("transaksi_baris", TransaksiBaris),
    ("pergerakan", Pergerakan),
    ("ulasan", Ulasan),
    ("permintaan_harian", PermintaanHarian),
    ("fitur_pesanan", FiturPesanan),
)

POTONG = 5_000


def tulis_basis_data(
    baris: dict[str, list[dict]], nota: modul_nota.Nota | None = None
) -> dict[str, int]:
    """
    Kosongkan lalu isi ulang. Id dibuat sendiri oleh pembangkit supaya relasi
    antar tabel bisa dirangkai di memori; sesudah menulis, urutan (sequence)
    Postgres digeser ke id tertinggi. Kalau langkah terakhir ini dilupakan,
    INSERT pertama dari API akan bentrok kunci primer — dan baru terlihat
    beberapa hari kemudian.

    Nota (`transaksi`, `transaksi_baris`) ditulis lewat COPY dari larik ringkas,
    bukan INSERT dari dict: jumlahnya jutaan baris. Masih di transaksi yang sama,
    jadi kalau ada yang gagal, seluruhnya batal.
    """
    jumlah: dict[str, int] = {}
    nama_barang = {b["id"]: b["nama"] for b in baris.get("barang", [])}
    satuan_barang = {b["id"]: b["satuan"] for b in baris.get("barang", [])}
    with mesin().begin() as kon:
        nama_tabel = [n for n, _ in URUTAN]
        kon.execute(text("TRUNCATE %s RESTART IDENTITY CASCADE" % ", ".join(nama_tabel)))

        for nama, model in URUTAN:
            if nota is not None and nama == "transaksi":
                with kon.connection.cursor() as kur:
                    jumlah[nama] = modul_nota.salin_transaksi(kur, nota)
                continue
            if nota is not None and nama == "transaksi_baris":
                with kon.connection.cursor() as kur:
                    jumlah[nama] = modul_nota.salin_transaksi_baris(
                        kur, nota, nama_barang, satuan_barang
                    )
                continue
            data = baris.get(nama, [])
            jumlah[nama] = len(data)
            if not data:
                continue
            tabel = model.__table__
            kolom = set(tabel.columns.keys())
            # Hanya kolom yang memang diisi pembangkit yang dikirim. Kalau
            # seluruh kolom dikirim dengan None, nilai bawaan kolom tidak
            # pernah jalan — None yang ditulis eksplisit mengalahkannya.
            kunci = {k for d in data for k in d} & kolom
            # Kunci asing yang ditambahkan belakangan (mis. transaksi_id pada
            # pergerakan) hanya ada di sebagian baris; sisanya jadi None.
            bersih = [{k: d.get(k) for k in kunci} for d in data]
            # Cap waktu bawaan memakai "sekarang" — di luar jendela simulasi.
            # Kalau dibiarkan, mengurutkan apa pun berdasarkan `dibuat_pada`
            # memberi urutan yang tidak nyambung dengan 400 hari riwayatnya.
            if "dibuat_pada" in kolom and "dibuat_pada" not in kunci:
                for b in bersih:
                    b["dibuat_pada"] = _wkt(MULAI)
            for i in range(0, len(bersih), POTONG):
                kon.execute(tabel.insert(), bersih[i : i + POTONG])

        for nama, model in URUTAN:
            # Tabel yang kunci primernya bukan `id` berurut (mis.
            # `hari_libur_nasional`, yang berkunci tanggal) tidak punya
            # sequence untuk disetel. Memanggil setval di situ melempar galat
            # yang menyesatkan tentang sequence yang tidak ada.
            if jumlah.get(nama) and "id" in model.__table__.columns:
                kon.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence(:t, 'id'), "
                        "(SELECT MAX(id) FROM %s))" % nama
                    ),
                    {"t": nama},
                )
    return jumlah


def periksa_turunan() -> list[str]:
    """
    Membuktikan `permintaan_harian` benar-benar turunan dari `pergerakan`.

    Tabel turunan itu enak dipakai tapi mudah melenceng dari sumbernya. Jadi ia
    dibangun ulang dari buku besar lewat SQL, lalu dibandingkan. Kalau meleset,
    salah satu dari dua hal bohong — dan lebih baik tahu sekarang daripada saat
    angka laporan tidak bisa dijelaskan.
    """
    catatan: list[str] = []
    with mesin().connect() as kon:
        selisih = kon.execute(
            text(
                """
                WITH dari_ledger AS (
                    SELECT pg.usaha_id, pg.barang_id, (pg.waktu AT TIME ZONE 'UTC')::date AS tanggal,
                           SUM(-pg.jumlah) AS jumlah
                      FROM pergerakan pg
                      JOIN barang b ON b.id = pg.barang_id
                     WHERE pg.jenis = 'terjual' AND b.dicatat_manual = false
                     GROUP BY 1, 2, 3
                )
                SELECT COUNT(*) FROM permintaan_harian ph
                FULL OUTER JOIN dari_ledger dl
                  ON dl.usaha_id = ph.usaha_id AND dl.barang_id = ph.barang_id
                 AND dl.tanggal = ph.tanggal
                 WHERE ph.id IS NULL
                    OR (dl.jumlah IS NULL AND ph.jumlah <> 0)
                    OR ABS(COALESCE(dl.jumlah, 0) - ph.jumlah) > 0.001
                """
            )
        ).scalar_one()
        catatan.append(
            "permintaan_harian vs pergerakan: %s baris tidak cocok" % selisih
            + ("  [LULUS]" if selisih == 0 else "  [GAGAL]")
        )

        # Rekonsiliasi stok: stok_sesudah pada baris pergerakan terakhir tiap
        # barang harus sama dengan jumlah kumulatif seluruh pergerakannya.
        buruk = kon.execute(
            text(
                """
                WITH kumulatif AS (
                    SELECT barang_id, SUM(jumlah) AS total FROM pergerakan GROUP BY 1
                ), terakhir AS (
                    SELECT DISTINCT ON (barang_id) barang_id, stok_sesudah
                      FROM pergerakan ORDER BY barang_id, waktu DESC, id DESC
                )
                SELECT COUNT(*) FROM kumulatif k JOIN terakhir t USING (barang_id)
                 WHERE ABS(k.total - t.stok_sesudah) > 0.01
                """
            )
        ).scalar_one()
        catatan.append(
            "stok_sesudah vs jumlah kumulatif: %s barang tidak cocok" % buruk
            + ("  [LULUS]" if buruk == 0 else "  [GAGAL]")
        )

        # Label Mesin 2 tidak boleh berisi masa depan: tanggal fitur harus
        # sama dengan tanggal pesanan dibuat.
        bocor = kon.execute(
            text(
                """
                SELECT COUNT(*) FROM fitur_pesanan f JOIN pesanan p ON p.id = f.pesanan_id
                 WHERE f.tanggal <> (p.dibuat_pada AT TIME ZONE 'UTC')::date
                """
            )
        ).scalar_one()
        catatan.append(
            "tanggal fitur vs tanggal pesanan: %s baris menyimpang" % bocor
            + ("  [LULUS]" if bocor == 0 else "  [GAGAL]")
        )

        # Nota hanya merinci penjualan, tidak boleh menambah atau mengurangi.
        beda_nota = kon.execute(text(SQL_NOTA_VS_BUKU_BESAR)).scalar_one()
        catatan.append(
            "nota vs pergerakan: %s barang-hari tidak cocok" % beda_nota
            + ("  [LULUS]" if beda_nota == 0 else "  [GAGAL]")
        )
        cacat = kon.execute(text(SQL_NOTA_CACAT)).scalar_one()
        catatan.append(
            "nota tanpa baris atau tanpa harga jual: %s" % cacat
            + ("  [LULUS]" if cacat == 0 else "  [GAGAL]")
        )
    return catatan


#: Dipakai juga di `backend/skrip/02_periksa_konsistensi.sql`; ubah keduanya bersamaan.
SQL_NOTA_VS_BUKU_BESAR = """
WITH dari_nota AS (
    SELECT t.usaha_id, b.id AS barang_id,
           (t.waktu AT TIME ZONE 'UTC')::date AS tanggal,
           SUM(tb.jumlah) AS jumlah
      FROM transaksi_baris tb
      JOIN transaksi t ON t.id = tb.transaksi_id
      JOIN barang b ON b.usaha_id = t.usaha_id AND b.nama = tb.nama_menu
     WHERE NOT t.dibatalkan
       -- Nota yang diproses API memotong stok lewat resep (satu menu, banyak
       -- bahan), jadi tidak cocok dicocokkan per nama. Kebenarannya dijaga
       -- terima_struk dan diuji di backend/uji (test_struk, test_menu_kasir).
       -- Yang diperiksa di sini nota pembangkit simulasi: satu baris, satu barang.
       AND NOT EXISTS (SELECT 1 FROM pergerakan p2 WHERE p2.transaksi_id = t.id)
     GROUP BY 1, 2, 3
), dari_ledger AS (
    SELECT pg.usaha_id, pg.barang_id,
           (pg.waktu AT TIME ZONE 'UTC')::date AS tanggal,
           SUM(-pg.jumlah) AS jumlah
      FROM pergerakan pg
      JOIN barang b ON b.id = pg.barang_id
     -- Bahan baku yang terpakai produksi (UMKM produsen) tidak lewat nota kasir.
     WHERE pg.jenis = 'terjual' AND b.dicatat_manual = false AND pg.produksi_id IS NULL
       AND pg.transaksi_id IS NULL
     GROUP BY 1, 2, 3
)
SELECT COUNT(*)
  FROM dari_nota n
  FULL OUTER JOIN dari_ledger l USING (usaha_id, barang_id, tanggal)
 WHERE ABS(COALESCE(n.jumlah, 0) - COALESCE(l.jumlah, 0)) > 0.001
"""

SQL_NOTA_CACAT = """
SELECT (SELECT COUNT(*) FROM transaksi t
         WHERE NOT EXISTS (SELECT 1 FROM transaksi_baris tb WHERE tb.transaksi_id = t.id))
     + (SELECT COUNT(*) FROM transaksi_baris WHERE harga_jual_satuan IS NULL)
"""


# --------------------------------------------------------------------------
# Ekspor CSV
# --------------------------------------------------------------------------
def ekspor_csv(nama: str, baris: list[dict]) -> Path:
    KELUARAN.mkdir(parents=True, exist_ok=True)
    berkas = KELUARAN / nama
    if not baris:
        berkas.write_text("", encoding="utf-8")
        return berkas
    kunci = list(baris[0].keys())
    with berkas.open("w", newline="", encoding="utf-8") as f:
        tulis = csv.DictWriter(f, fieldnames=kunci)
        tulis.writeheader()
        for b in baris:
            tulis.writerow({k: _csv_nilai(b.get(k)) for k in kunci})
    return berkas


def _csv_nilai(v):
    if hasattr(v, "value"):  # enum
        return v.value
    if isinstance(v, bool):
        return int(v)
    return "" if v is None else v


# --------------------------------------------------------------------------
def main() -> None:
    p = argparse.ArgumentParser(description="Pembangkit dataset Warungku (D1 + D2).")
    p.add_argument("--benih", type=int, default=BENIH, help="benih acak; sama benih, sama data")
    p.add_argument("--tanpa-db", action="store_true", help="hanya ekspor CSV, tidak menyentuh basis data")
    p.add_argument("--tanpa-csv", action="store_true", help="hanya isi basis data")
    arg = p.parse_args()

    acak = np.random.default_rng(arg.benih)
    gen = Pembangkit(acak)

    print("Rentang simulasi : %s .. %s (%d hari)" % (MULAI, AKHIR, HARI_SIMULASI))
    print("Jendela uji      : %s .. %s (%d hari, tidak boleh dilihat saat latih)"
          % (BATAS_UJI, AKHIR, HARI_UJI))
    print("Benih            : %d" % arg.benih)
    print("UMKM / distributor: %d / %d" % (len(UMKM), len(DISTRIBUTOR)))
    print("Hari libur (SKB) : %d tanggal" % len(SEMUA_LIBUR))
    print("Kata sandi contoh: %s  (semua akun)" % KATA_SANDI_CONTOH)
    print()

    # Kalender diisi lebih dulu: ia acuan, bukan hasil simulasi, dan kolom
    # kovariat `hari_libur` di permintaan_harian harus bisa ditelusuri ke sini.
    gen.baris["hari_libur_nasional"] = [
        {"tanggal": x.tanggal, "nama": x.nama, "jenis": x.jenis} for x in SEMUA_LIBUR
    ]

    produk_id = gen.buat_katalog()
    penawaran = gen.buat_distributor(produk_id)
    warungs = gen.buat_warung(produk_id)

    dist_area = {d["id"]: set(d["area_kirim"]) for d in gen.baris["distributor"]}
    dist_kota = {d["id"]: d["kota"] for d in gen.baris["distributor"]}
    karakter_per_dist = {i + 1: KARAKTER[i] for i in range(len(KARAKTER))}

    counterfactual = gen.simulasi(warungs, penawaran, dist_area, dist_kota, karakter_per_dist)
    # Generator terpisah, diturunkan dari benih yang sama: nota tidak boleh
    # menggeser angka D1 dan D2 yang dibangkitkan sebelumnya.
    nota = gen.buat_nota(np.random.default_rng([arg.benih, 1]))
    gen.selaraskan_stok_akhir(warungs)

    d1 = gen.baris_permintaan_harian()
    d2 = gen.bangun_fitur_pesanan(counterfactual)
    gen.baris["permintaan_harian"] = d1
    gen.baris["fitur_pesanan"] = d2

    # -- ringkasan yang bisa diperiksa tanpa membuka database ---------------
    hari_habis = sum(1 for r in d1 if r["stok_habis"])
    sukses = sum(1 for r in d2 if r["sukses"])
    print("D1  permintaan_harian : %6d baris, %d hari kehabisan stok (%.1f%%)"
          % (len(d1), hari_habis, 100 * hari_habis / max(1, len(d1))))
    print("D2  fitur_pesanan     : %6d baris, %d sukses (%.1f%%)"
          % (len(d2), sukses, 100 * sukses / max(1, len(d2))))
    print("    counterfactual    : %6d baris (evaluasi saja, tidak untuk latih)"
          % len(counterfactual))
    harian = nota.ringkasan_harian()
    print("Nota                  : %d nota, %d baris, %d usaha-hari"
          % (nota.n_nota, nota.n_baris, len(harian)))
    print("    per usaha per hari: median %d nota, omset median Rp%s"
          % (np.median([r["jumlah_nota"] for r in harian]),
             f"{np.median([r['omset'] for r in harian]):,.0f}".replace(",", ".")))
    print()

    if not arg.tanpa_csv:
        for nama, data in (
            ("d1_permintaan_harian.csv", d1),
            ("d2_fitur_pesanan.csv", d2),
            ("d2_counterfactual.csv", counterfactual),
            ("d1_omset_harian.csv", harian),
        ):
            print("CSV  %s" % ekspor_csv(nama, data))
        print()

    if not arg.tanpa_db:
        jumlah = tulis_basis_data(gen.baris, nota)
        lebar = max(len(n) for n in jumlah)
        for nama, n in jumlah.items():
            print("  %-*s %7d" % (lebar, nama, n))
        print("  %-*s %7d" % (lebar, "TOTAL", sum(jumlah.values())))
        print()
        # UMKM produsen ditambahkan SESUDAH data utama, dengan generator acaknya
        # sendiri, supaya 70 UMKM di atas tidak bergeser (lihat umkm_produksi.py).
        # Ia tidak ikut diekspor ke CSV.
        from .umkm_produksi import NAMA_USAHA, tambahkan

        tambahan = tambahkan()
        print("UMKM produsen    : %s, %d baris, pesanan terpenuhi %d%%" % (
            NAMA_USAHA, sum(n for k, n in tambahan.items() if k != "persen_terpenuhi"),
            tambahan["persen_terpenuhi"],
        ))
        # Variasi pesanan, kontrak, dan stok untuk dua akun demo (lihat variasi_demo.py).
        from .variasi_demo import pasang as pasang_variasi, ringkas as ringkas_variasi

        for baris in ringkas_variasi(pasang_variasi() or {}):
            print("Variasi demo     :" + baris)
        print()
        print("Pemeriksaan konsistensi:")
        for c in periksa_turunan():
            print("  " + c)


if __name__ == "__main__":
    main()
