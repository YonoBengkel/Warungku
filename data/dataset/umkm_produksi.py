"""
Tambahkan SATU UMKM produsen ke basis data simulasi: Dapur Sambal Bu Ratmi.

    python -m dataset.umkm_produksi            # tambah (berhenti kalau sudah ada)
    python -m dataset.umkm_produksi --ulang    # hapus versi lama, lalu tambah lagi

Diminta dosen pengampu (16 Okt 2026): selain warung kopi dan warung makan,
simulasi perlu satu UMKM yang MEMPRODUKSI barang, punya potensi tumbuh, dan
menjual ke usaha lain. Bu Ratmi dan ibu-ibu tetangganya memasak sambal goreng
rumahan, membeli bahan baku (cabai, bawang, minyak, teri, toples) dari
distributor di aplikasi, lalu mengirim toples sambal ke ritel modern
(Indomaret), swalayan, toko oleh-oleh, dan katering.

**Kenapa skrip terpisah, bukan baris baru di `katalog.UMKM`.** Simulasi di
`buat_dataset.py` berjalan hari demi hari untuk seluruh warung dengan SATU
generator acak. Menambah satu UMKM di sana menggeser setiap tarikan acak sesudah
hari pertama, sehingga data 70 UMKM lama dan seluruh angka evaluasi model ikut
berubah. Skrip ini hanya MENAMBAH baris, dengan generator acaknya sendiri, ke
basis data yang sudah diisi `buat_dataset.py`. `buat_dataset.py` memanggilnya
di akhir, jadi membangkitkan ulang dataset tetap menghasilkan UMKM ini.

Yang dibuat, untuk 400 hari yang sama dengan dataset utama:

* akun `produksi1@warungku.test` (kata sandi sama dengan akun contoh lain),
  usaha berjenis `produksi-makanan`, 8 bahan baku, 2 produk jadi beserta resep;
* 4 produk katalog baru (bawang putih, teri nasi, garam, toples kaca) dan
  penawarannya di distributor yang melayani kategorinya;
* pesanan bahan baku ke distributor (dengan karakter distributor yang sama
  dengan dataset utama), sesi produksi tiga kali sepekan, dan penjualan ke
  empat pembeli usaha;
* `permintaan_harian` bahan baku untuk SETIAP hari (nol pun ditulis), supaya
  Mesin 1 bisa meramal kebutuhan bahan baku.
"""

from __future__ import annotations

import argparse
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np
from sqlalchemy import text

from warungku.basis_data import mesin
from warungku.enum import (
    AlasanSelisih,
    CaraHitungStok,
    JenisPergerakan,
    JenisUsaha,
    PeranPengguna,
    StatusBayar,
    StatusKasir,
    StatusPesanan,
    StatusVerifikasi,
    SumberBatasAman,
)
from warungku.model import (
    Barang,
    DataKasir,
    Keanggotaan,
    Kemasan,
    PaketKontrak,
    Pembeli,
    Penawaran,
    Pengguna,
    Penjualan,
    PenjualanBaris,
    Pergerakan,
    PermintaanHarian,
    Pesanan,
    PesananBaris,
    PesananJejak,
    Produksi,
    ProdukJadi,
    ProdukMaster,
    ResepBahan,
    Ulasan,
    Usaha,
)

from .buat_dataset import AKHIR, HARI_SIMULASI, KATA_SANDI_CONTOH, MULAI, _wkt
from .katalog import DISTRIBUTOR, PRODUK_PER_NAMA, Produk, deskripsi_kemasan
from .pola import KARAKTER, hari_kirim_asli, hari_libur, musim_hujan, pekan_gajian, sedang_ramadan

BENIH = 20261016

NAMA_USAHA = "Dapur Sambal Bu Ratmi"
JENIS = JenisUsaha.PRODUKSI_MAKANAN
EMAIL = "produksi1@warungku.test"
PEMILIK = "Ratmi Lestari"
KOTA = "Sleman"

#: Produk katalog yang belum ada di `katalog.KATALOG`. Ditaruh di sini, bukan di
#: sana, karena menambah produk di KATALOG menggeser tarikan acak dataset utama.
KATALOG_TAMBAHAN: tuple[Produk, ...] = (
    Produk("Bawang Putih", "Bahan Makanan", "gram", "kg", 1000, 38_000),
    Produk("Teri Nasi", "Protein", "gram", "kg", 1000, 140_000),
    Produk("Garam Dapur", "Bahan Makanan", "gram", "pak", 1000, 9_000, sinonim=("garam",)),
    Produk("Toples Kaca 200 ml", "Kemasan", "pcs", "dus", 48, 168_000, sinonim=("toples", "jar")),
)
_PRODUK = {**PRODUK_PER_NAMA, **{p.nama: p for p in KATALOG_TAMBAHAN}}

#: Bahan baku di gudang Bu Ratmi, urut kode barang.
BAHAN: tuple[str, ...] = (
    "Cabai Merah", "Bawang Merah", "Bawang Putih", "Minyak Goreng",
    "Teri Nasi", "Gula Pasir", "Garam Dapur", "Toples Kaca 200 ml",
)


@dataclass(frozen=True)
class ProdukJadiSim:
    nama: str
    isi_bersih: str
    harga_jual: int
    ukuran_sesi: int
    #: Takaran per toples, dalam satuan dasar bahan (gram, ml, pcs).
    resep: dict[str, float]


PRODUK_JADI: tuple[ProdukJadiSim, ...] = (
    ProdukJadiSim(
        "Sambal Bawang", "200 g", 19_000, 60,
        {"Cabai Merah": 110, "Bawang Merah": 45, "Bawang Putih": 20, "Minyak Goreng": 70,
         "Garam Dapur": 4, "Gula Pasir": 6, "Toples Kaca 200 ml": 1},
    ),
    ProdukJadiSim(
        "Sambal Goreng Teri", "200 g", 26_000, 48,
        {"Cabai Merah": 80, "Bawang Merah": 35, "Bawang Putih": 12, "Teri Nasi": 45,
         "Minyak Goreng": 55, "Gula Pasir": 10, "Garam Dapur": 3, "Toples Kaca 200 ml": 1},
    ),
)


@dataclass(frozen=True)
class PembeliSim:
    nama: str
    jenis: str
    kota: str
    ketentuan: str
    #: Hari ke berapa simulasi pembeli ini mulai memesan (0 = sejak awal).
    mulai: int
    #: Hari pesan (0 = Senin). Kosong berarti pesan tak tentu dengan `peluang`.
    hari: tuple[int, ...]
    peluang: float
    #: Rata-rata toples per pesanan, per produk jadi.
    rata: dict[str, float]
    #: Pertumbuhan per hari sejak mulai (0,002 = sekitar dua kali lipat setahun).
    tumbuh: float = 0.0


PEMBELI: tuple[PembeliSim, ...] = (
    PembeliSim(
        "Indomaret Sleman", "ritel-modern", "Sleman",
        "Pesan tiap Senin lewat program kemitraan UMKM, dibayar 14 hari sesudah kirim.",
        150, (0,), 1.0, {"Sambal Bawang": 30, "Sambal Goreng Teri": 18}, 0.0022,
    ),
    PembeliSim(
        "Swalayan Gading Mas", "ritel-modern", "Kota Yogyakarta",
        "Pesan tiap Kamis, konsinyasi, dibayar tiap akhir bulan.",
        0, (3,), 1.0, {"Sambal Bawang": 14, "Sambal Goreng Teri": 10}, 0.0006,
    ),
    PembeliSim(
        "Toko Oleh-oleh Sari Rasa", "toko-oleh-oleh", "Kota Yogyakarta",
        "Pesan saat stok di toko menipis; ramai menjelang Lebaran dan musim libur.",
        0, (), 0.18, {"Sambal Bawang": 16, "Sambal Goreng Teri": 16}, 0.0004,
    ),
    PembeliSim(
        "Katering Dapur Wening", "katering", "Sleman",
        "Pesan tiap Selasa dan Jumat untuk paket nasi kotak.",
        40, (1, 4), 1.0, {"Sambal Bawang": 6, "Sambal Goreng Teri": 4}, 0.0,
    ),
)

#: Hari masak: Selasa, Kamis, Sabtu. Pesanan Senin dari Indomaret dipenuhi dari
#: masakan Sabtu.
HARI_MASAK = (1, 3, 5)
#: Pesan bahan baku untuk sekitar dua pekan pemakaian.
HARI_PERSEDIAAN = 14
PELUANG_TERMURAH = 0.70


@dataclass
class BahanSim:
    id: int
    nama: str
    produk: Produk
    produk_master_id: int
    pakai_harian: float
    hari_kirim: int
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


@dataclass
class Penampung:
    """Baris per tabel dengan id yang diberikan sendiri, mulai dari id tertinggi di basis data."""

    awal: dict[str, int]
    baris: dict[str, list[dict]] = field(default_factory=lambda: defaultdict(list))

    def tambah(self, tabel: str, data: dict) -> int:
        self.awal[tabel] = self.awal.get(tabel, 0) + 1
        data["id"] = self.awal[tabel]
        self.baris[tabel].append(data)
        return data["id"]


#: Urutan tulis mengikuti kunci asing.
URUTAN = (
    ("produk_master", ProdukMaster),
    ("pengguna", Pengguna),
    ("usaha", Usaha),
    ("keanggotaan", Keanggotaan),
    ("data_kasir", DataKasir),
    ("penawaran", Penawaran),
    ("paket_kontrak", PaketKontrak),
    ("barang", Barang),
    ("kemasan", Kemasan),
    ("produk_jadi", ProdukJadi),
    ("resep_bahan", ResepBahan),
    ("pembeli", Pembeli),
    ("pesanan", Pesanan),
    ("pesanan_baris", PesananBaris),
    ("pesanan_jejak", PesananJejak),
    ("produksi", Produksi),
    ("pergerakan", Pergerakan),
    ("ulasan", Ulasan),
    ("penjualan", Penjualan),
    ("penjualan_baris", PenjualanBaris),
    ("permintaan_harian", PermintaanHarian),
)


def _faktor_pembeli(p: PembeliSim, t: date, hari_ke: int) -> float:
    f = 1.0 + p.tumbuh * max(0, hari_ke - p.mulai)
    if sedang_ramadan(t):
        # Sambal laku untuk sahur dan buka puasa.
        f *= 1.35
    if p.jenis == "toko-oleh-oleh":
        if hari_libur(t) or t.month in (6, 7, 12):
            f *= 1.6
    elif pekan_gajian(t):
        f *= 1.1
    return f


def _hapus_lama(kon) -> bool:
    """Hapus UMKM produsen yang lama beserta seluruh jejaknya. Penawaran dan katalog dibiarkan."""
    u = kon.execute(text("SELECT id FROM usaha WHERE email = :e"), {"e": EMAIL}).scalar()
    if u is None:
        return False
    p = {"u": u}
    for sql in (
        "DELETE FROM permintaan_harian WHERE usaha_id = :u",
        "DELETE FROM prediksi WHERE usaha_id = :u",
        "DELETE FROM rekomendasi_skor WHERE usaha_id = :u",
        "DELETE FROM penjualan_baris WHERE penjualan_id IN (SELECT id FROM penjualan WHERE usaha_id = :u)",
        "DELETE FROM penjualan WHERE usaha_id = :u",
        "DELETE FROM pembeli WHERE usaha_id = :u",
        "DELETE FROM pergerakan WHERE usaha_id = :u",
        "DELETE FROM produksi WHERE usaha_id = :u",
        "DELETE FROM resep_bahan WHERE produk_jadi_id IN (SELECT id FROM produk_jadi WHERE usaha_id = :u)",
        "DELETE FROM produk_jadi WHERE usaha_id = :u",
        "DELETE FROM ulasan WHERE usaha_id = :u",
        "DELETE FROM pesanan_jejak WHERE pesanan_id IN (SELECT id FROM pesanan WHERE usaha_id = :u)",
        "DELETE FROM pesanan_baris WHERE pesanan_id IN (SELECT id FROM pesanan WHERE usaha_id = :u)",
        "DELETE FROM pesanan WHERE usaha_id = :u",
        "DELETE FROM kemasan WHERE barang_id IN (SELECT id FROM barang WHERE usaha_id = :u)",
        "DELETE FROM barang WHERE usaha_id = :u",
        "DELETE FROM data_kasir WHERE usaha_id = :u",
        "DELETE FROM notifikasi WHERE usaha_id = :u",
        "DELETE FROM segmen_pelanggan WHERE usaha_id = :u",
    ):
        kon.execute(text(sql), p)
    pengguna = kon.execute(text("SELECT pengguna_id FROM keanggotaan WHERE usaha_id = :u"), p).scalars().all()
    kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), p)
    kon.execute(text("DELETE FROM usaha WHERE id = :u"), p)
    for pid in pengguna:
        kon.execute(text("DELETE FROM pengguna WHERE id = :p"), {"p": pid})
    return True


def bangkitkan(kon) -> dict[str, int]:
    """Bangkitkan seluruh baris UMKM produsen di memori, lalu tulis. Mengembalikan jumlah baris per tabel."""
    from argon2 import PasswordHasher

    acak = np.random.default_rng(BENIH)
    awal = {
        nama: int(kon.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {nama}")).scalar())
        for nama, _ in URUTAN
    }
    t_ = Penampung(awal)

    # --- katalog dan penawaran tambahan ---------------------------------
    produk_master: dict[str, int] = {
        n: i for i, n in kon.execute(text("SELECT id, nama_kanonik FROM produk_master")).all()
    }
    distributor = {
        n: (i, list(area), kota)
        for i, n, area, kota in kon.execute(text("SELECT id, nama, area_kirim, kota FROM distributor")).all()
    }
    for p in KATALOG_TAMBAHAN:
        if p.nama in produk_master:
            continue
        produk_master[p.nama] = t_.tambah(
            "produk_master",
            {"nama_kanonik": p.nama, "kategori": p.kategori, "satuan_dasar": p.satuan_dasar, "sinonim": list(p.sinonim)},
        )
        for i, d in enumerate(DISTRIBUTOR):
            if p.kategori not in d.kategori:
                continue
            dist_id = distributor[d.nama][0]
            harga = int(round(p.harga_acuan * KARAKTER[i].indeks_harga / 500) * 500)
            pid = t_.tambah(
                "penawaran",
                {
                    "distributor_id": dist_id, "produk_master_id": produk_master[p.nama], "nama": p.nama,
                    "kategori": p.kategori, "satuan": p.kemasan, "harga_satuan": harga,
                    "kemasan_nama": p.kemasan, "kemasan_isi": p.isi, "satuan_isi": p.satuan_dasar,
                    "stok_tersedia": float(acak.integers(40, 600)), "stok_diperbarui_pada": _wkt(AKHIR, 7, 30),
                    "keterangan": f"1 {p.kemasan} = {p.isi:g} {p.satuan_dasar}", "aktif": True,
                },
            )
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

    # Penawaran yang bisa dipakai Bu Ratmi: produknya ia butuhkan dan distributornya mengirim ke Sleman.
    karakter = {distributor[d.nama][0]: KARAKTER[i] for i, d in enumerate(DISTRIBUTOR)}
    kota_dist = {v[0]: v[2] for v in distributor.values()}
    melayani = {v[0] for v in distributor.values() if KOTA in v[1]}
    penawaran: dict[int, list[PenawaranSim]] = defaultdict(list)
    lama = kon.execute(
        text("SELECT id, distributor_id, produk_master_id, harga_satuan, kemasan_isi, kemasan_nama FROM penawaran WHERE aktif")
    ).all()
    baru = [
        (r["id"], r["distributor_id"], r["produk_master_id"], r["harga_satuan"], r["kemasan_isi"], r["kemasan_nama"])
        for r in t_.baris["penawaran"]
    ]
    for pid, did, pmid, harga, isi, kemasan in list(lama) + baru:
        if did in melayani:
            penawaran[pmid].append(PenawaranSim(pid, did, pmid, int(harga), float(isi), kemasan))

    # --- pelaku -----------------------------------------------------------
    pengguna_id = t_.tambah(
        "pengguna",
        {"nomor_hp": "081319900001", "email": EMAIL, "kata_sandi_hash": PasswordHasher().hash(KATA_SANDI_CONTOH),
         "nama": PEMILIK, "aktif": True},
    )
    usaha_id = t_.tambah(
        "usaha",
        {
            "nama": NAMA_USAHA, "jenis_usaha": JENIS, "nama_pemilik": PEMILIK, "nib": "1204250099001",
            "npwp": None, "alamat": "Jl. Tirtomartani No.7, Kalasan, Sleman", "kota": KOTA,
            "lat": -7.7647, "lng": 110.4725, "nomor_hp": "081338899001", "email": EMAIL,
            "bio": "Sambal goreng rumahan buatan ibu-ibu Kalasan, dikirim ke ritel dan toko oleh-oleh.",
            "warna": "#c62828", "cara_hitung": CaraHitungStok.RACIKAN, "verifikasi": StatusVerifikasi.TERVERIFIKASI,
            "tingkat_verifikasi": "penuh", "bergabung_sejak": MULAI - timedelta(days=20),
            "tampilkan_alamat": True, "tampilkan_nomor_hp": True,
        },
    )
    t_.tambah("keanggotaan", {"pengguna_id": pengguna_id, "usaha_id": usaha_id, "peran": PeranPengguna.PEMILIK})
    # Tidak memakai kasir: penjualannya kiriman ke usaha lain, dicatat di aplikasi.
    t_.tambah("data_kasir", {"usaha_id": usaha_id, "status": StatusKasir.MANUAL, "merek": None, "terakhir_masuk": None})

    # Perkiraan toples per hari, untuk menakar batas aman bahan baku.
    rata_toples = {pj.nama: 0.0 for pj in PRODUK_JADI}
    for pb in PEMBELI:
        per_pekan = len(pb.hari) if pb.hari else pb.peluang * 7
        for nama, n in pb.rata.items():
            rata_toples[nama] += n * per_pekan / 7 * 1.25

    bahan: dict[str, BahanSim] = {}
    for kode, nama in enumerate(BAHAN):
        p = _PRODUK[nama]
        pakai = sum(rata_toples[pj.nama] * pj.resep.get(nama, 0) for pj in PRODUK_JADI)
        hari_kirim = int(acak.integers(1, 4))
        # Masak tiga kali sepekan: batas aman menutup satu sesi masak lebih banyak dari biasa.
        batas = pakai * (hari_kirim + 4)
        bid = t_.tambah(
            "barang",
            {
                "usaha_id": usaha_id, "produk_master_id": produk_master[nama], "nama": nama,
                "deskripsi": deskripsi_kemasan(p.isi, p.satuan_dasar, p.kemasan), "nama_lain": list(p.sinonim),
                "kategori": p.kategori, "kode_barang": f"B{kode + 1:03d}", "satuan": p.satuan_dasar,
                "satuan_tampil": None, "stok": 0, "batas_aman": round(batas, 3), "batas_aman_saran": round(batas, 3),
                "sumber_batas_aman": SumberBatasAman.SISTEM, "hari_kirim": hari_kirim,
                "harga_beli_terakhir": p.harga_acuan, "hari_data_terkumpul": HARI_SIMULASI,
                "ingatkan_kedaluwarsa": False, "kedaluwarsa": None,
                # Bahan baku tidak lewat kasir; pemakaiannya datang dari sesi produksi.
                "terhubung_kasir": False, "dicatat_manual": False, "catatan": None,
            },
        )
        t_.tambah("kemasan", {"barang_id": bid, "nama": p.kemasan, "isi": p.isi})
        b = BahanSim(bid, nama, p, produk_master[nama], pakai, hari_kirim, batas)
        b.stok = batas * float(acak.uniform(1.8, 2.6))
        t_.tambah(
            "pergerakan",
            {
                "usaha_id": usaha_id, "barang_id": bid, "waktu": _wkt(MULAI - timedelta(days=1), 7, 0),
                "jenis": JenisPergerakan.MASUK, "jumlah": round(b.stok, 3), "stok_sesudah": round(b.stok, 3),
                "keterangan": "Stok awal saat pendaftaran", "oleh": PEMILIK,
            },
        )
        bahan[nama] = b

    produk_jadi: dict[str, int] = {}
    stok_jadi: dict[str, float] = {}
    for pj in PRODUK_JADI:
        produk_jadi[pj.nama] = t_.tambah(
            "produk_jadi",
            {
                "usaha_id": usaha_id, "nama": pj.nama, "satuan": "toples", "isi_bersih": pj.isi_bersih,
                "stok": 0, "batas_aman": round(rata_toples[pj.nama] * 3), "harga_jual": pj.harga_jual,
                "ukuran_sesi": pj.ukuran_sesi,
            },
        )
        stok_jadi[pj.nama] = 0.0
        for nama, takaran in pj.resep.items():
            t_.tambah("resep_bahan", {"produk_jadi_id": produk_jadi[pj.nama], "barang_id": bahan[nama].id, "takaran": takaran})

    pembeli: dict[str, int] = {
        pb.nama: t_.tambah(
            "pembeli",
            {"usaha_id": usaha_id, "nama": pb.nama, "jenis": pb.jenis, "kota": pb.kota,
             "ketentuan": pb.ketentuan, "sejak": MULAI + timedelta(days=pb.mulai)},
        )
        for pb in PEMBELI
    }

    # --- simulasi hari demi hari --------------------------------------------
    menunggu: dict[date, list[dict]] = defaultdict(list)
    terkirim: dict[str, list[float]] = {pj.nama: [] for pj in PRODUK_JADI}
    nomor_pesanan = 0
    total_minta = total_kirim = 0.0

    for hari_ke in range(HARI_SIMULASI):
        t = MULAI + timedelta(days=hari_ke)
        pakai_hari: dict[str, float] = defaultdict(float)
        kurang_hari: set[str] = set()

        # 1. Kiriman bahan baku yang sampai hari ini.
        for k in menunggu.pop(t, []):
            _terima(t_, k, t, usaha_id, acak)

        # 2. Pesan bahan baku yang menipis, satu pesanan per distributor.
        perlu: dict[int, list[tuple[BahanSim, PenawaranSim, float]]] = defaultdict(list)
        for b in bahan.values():
            if b.stok + b.dalam_perjalanan >= b.batas_aman:
                continue
            layak = penawaran.get(b.produk_master_id, [])
            if not layak:
                continue
            if acak.random() < PELUANG_TERMURAH:
                pilih = min(layak, key=lambda x: x.harga / x.isi)
            else:
                pilih = layak[int(acak.integers(0, len(layak)))]
            butuh = b.pakai_harian * HARI_PERSEDIAAN + b.batas_aman - b.stok - b.dalam_perjalanan
            q = max(1.0, math.ceil(butuh / pilih.isi))
            b.dalam_perjalanan += q * pilih.isi
            perlu[pilih.distributor_id].append((b, pilih, q))
        for dist_id, daftar in perlu.items():
            nomor_pesanan += 1
            k = _pesan(t_, usaha_id, dist_id, daftar, t, nomor_pesanan, karakter[dist_id], kota_dist[dist_id] != KOTA, acak)
            if k["tiba"] <= AKHIR:
                menunggu[k["tiba"]].append(k)

        # 3. Masak (Selasa, Kamis, Sabtu, dan hari pertama untuk stok pembuka).
        if t.weekday() in HARI_MASAK or hari_ke == 0:
            for pj in PRODUK_JADI:
                riwayat = terkirim[pj.nama][-28:]
                harian = (sum(riwayat) / len(riwayat)) if riwayat else rata_toples[pj.nama]
                # Cukup sampai sesi masak berikutnya (paling jauh tiga hari,
                # Sabtu ke Selasa) ditambah cadangan, karena pesanan ritel
                # datang sekaligus dalam jumlah besar.
                sasaran = harian * 6.0
                ingin = max(0.0, sasaran - stok_jadi[pj.nama])
                ingin = min(math.ceil(ingin / 6) * 6, pj.ukuran_sesi * 3)
                if ingin <= 0:
                    continue
                bisa = min(bahan[n].stok / takaran for n, takaran in pj.resep.items())
                jumlah = float(min(ingin, math.floor(bisa)))
                for n, takaran in pj.resep.items():
                    if bahan[n].stok / takaran < ingin:
                        kurang_hari.add(n)
                if jumlah <= 0:
                    continue
                prod_id = t_.tambah(
                    "produksi",
                    {"usaha_id": usaha_id, "produk_jadi_id": produk_jadi[pj.nama], "waktu": _wkt(t, 13, 0),
                     "jumlah": jumlah, "catatan": None, "oleh": PEMILIK, "dibuat_pada": _wkt(t, 13, 0)},
                )
                for n, takaran in pj.resep.items():
                    b = bahan[n]
                    pakai = jumlah * takaran
                    b.stok -= pakai
                    pakai_hari[n] += pakai
                    t_.tambah(
                        "pergerakan",
                        {
                            "usaha_id": usaha_id, "barang_id": b.id, "waktu": _wkt(t, 13, 0),
                            "jenis": JenisPergerakan.TERJUAL, "jumlah": -round(pakai, 3),
                            "stok_sesudah": round(b.stok, 3),
                            "keterangan": f"Dipakai produksi {jumlah:g} toples {pj.nama}",
                            "produksi_id": prod_id, "oleh": PEMILIK,
                        },
                    )
                stok_jadi[pj.nama] += jumlah

        # 4. Pesanan dari pembeli usaha, dikirim sore hari dari stok barang jadi.
        diminta_hari = {pj.nama: 0.0 for pj in PRODUK_JADI}
        nomor_jual = 0
        for pb in PEMBELI:
            if hari_ke < pb.mulai:
                continue
            pesan = (t.weekday() in pb.hari) if pb.hari else (acak.random() < pb.peluang * (1.5 if hari_libur(t) else 1.0))
            if not pesan:
                continue
            f = _faktor_pembeli(pb, t, hari_ke)
            baris = []
            for pj in PRODUK_JADI:
                rata = pb.rata.get(pj.nama, 0) * f
                if rata <= 0:
                    continue
                minta = float(acak.poisson(acak.gamma(8.0, rata / 8.0)))
                # Ritel memesan dalam kelipatan karton isi 6.
                if pb.jenis == "ritel-modern":
                    minta = float(max(6, round(minta / 6) * 6))
                diminta_hari[pj.nama] += minta
                kirim = min(minta, stok_jadi[pj.nama])
                total_minta += minta
                total_kirim += kirim
                if kirim > 0:
                    stok_jadi[pj.nama] -= kirim
                    baris.append((pj, kirim))
            if not baris:
                continue
            nomor_jual += 1
            jual_id = t_.tambah(
                "penjualan",
                {
                    "usaha_id": usaha_id, "pembeli_id": pembeli[pb.nama],
                    "nomor": f"PJ-{t.strftime('%y%m%d')}-{nomor_jual:02d}", "waktu": _wkt(t, 15, 0),
                    "total": int(sum(pj.harga_jual * q for pj, q in baris)), "catatan": None,
                    "dibuat_pada": _wkt(t, 15, 0),
                },
            )
            for pj, q in baris:
                t_.tambah(
                    "penjualan_baris",
                    {"penjualan_id": jual_id, "produk_jadi_id": produk_jadi[pj.nama], "jumlah": q, "harga_satuan": pj.harga_jual},
                )
        for pj in PRODUK_JADI:
            terkirim[pj.nama].append(diminta_hari[pj.nama])

        # 5. D1: pemakaian bahan baku hari ini, nol pun ditulis.
        for b in bahan.values():
            t_.tambah(
                "permintaan_harian",
                {
                    "usaha_id": usaha_id, "barang_id": b.id, "tanggal": t, "jumlah": round(pakai_hari[b.nama], 3),
                    "stok_habis": b.nama in kurang_hari, "hari_libur": hari_libur(t),
                    "pekan_gajian": pekan_gajian(t), "ramadan": sedang_ramadan(t), "promo_aktif": False,
                },
            )

    # Nilai berjalan harus sama dengan hasil akhir buku besar.
    for r in t_.baris["barang"]:
        r["stok"] = round(next(b.stok for b in bahan.values() if b.id == r["id"]), 3)
    for r in t_.baris["produk_jadi"]:
        r["stok"] = round(stok_jadi[r["nama"]], 3)

    jumlah = _tulis(kon, t_)
    jumlah["persen_terpenuhi"] = round(100 * total_kirim / max(1.0, total_minta))
    return jumlah


def _pesan(t_, usaha_id, dist_id, daftar, t, nomor, karakter, luar_kota, acak) -> dict:
    """Satu pesanan bahan baku ke satu distributor; hasilnya ditarik dari karakter distributor."""
    p_tepat = karakter.peluang_tepat_waktu(besar_relatif=1.0, hujan=musim_hujan(t), luar_kota=luar_kota)
    tepat = bool(acak.random() < p_tepat)
    sesuai = bool(acak.random() < karakter.p_jumlah_sesuai)
    baik = bool(acak.random() < karakter.p_kondisi_baik)
    hasil = {
        "tepat_waktu": tepat, "jumlah_sesuai": sesuai, "kondisi_baik": baik, "sukses": tepat and sesuai and baik,
        "rasio_diterima": 1.0 if sesuai else float(acak.uniform(0.70, 0.97)),
    }
    tiba = t + timedelta(days=hari_kirim_asli(karakter, tepat, acak))
    janji = t + timedelta(days=int(acak.integers(2, 4)))
    pesanan_id = t_.tambah(
        "pesanan",
        {
            "nomor": f"PS-{t.strftime('%y%m%d')}-P{nomor:04d}", "usaha_id": usaha_id, "distributor_id": dist_id,
            "kontrak_id": None, "dibuat_pada": _wkt(t, 8, 15), "status": StatusPesanan.DIKIRIM,
            "ongkos_kirim": int(acak.choice([0, 20_000, 25_000])), "perkiraan_tiba": _wkt(janji, 15, 0),
            "status_bayar": StatusBayar.BUKTI_TERKIRIM, "jumlah_bukti": 1, "dari_saran": bool(acak.random() < 0.55),
            "dari_rutin": False, "sudah_diulas": False,
        },
    )
    for status, jam, ket in (
        (StatusPesanan.MENUNGGU_KONFIRMASI, 8, "Pesanan dikirim ke distributor."),
        (StatusPesanan.DISIAPKAN, 10, "Distributor menerima pesanan dan menyiapkan barang."),
        (StatusPesanan.DIKIRIM, 7, "Barang berangkat dari gudang distributor."),
    ):
        t_.tambah("pesanan_jejak", {"pesanan_id": pesanan_id, "waktu": _wkt(t, jam, 0), "status": status, "keterangan": ket})
    baris = []
    for b, p, q in daftar:
        bid = t_.tambah(
            "pesanan_baris",
            {
                "pesanan_id": pesanan_id, "penawaran_id": p.id, "barang_id": b.id, "nama": b.nama, "jumlah": float(q),
                "satuan": p.kemasan, "harga_satuan": p.harga, "harga_normal": p.harga, "promo_id": None,
                "isi_per_satuan": p.isi, "jumlah_diterima": None,
            },
        )
        baris.append((bid, b, p, q))
    return {"pesanan_id": pesanan_id, "distributor_id": dist_id, "baris": baris, "hasil": hasil, "tiba": tiba}


def _terima(t_, k: dict, t: date, usaha_id: int, acak) -> None:
    hasil = k["hasil"]
    pesanan = next(r for r in t_.baris["pesanan"] if r["id"] == k["pesanan_id"])
    semua_baris = {r["id"]: r for r in t_.baris["pesanan_baris"] if r["pesanan_id"] == k["pesanan_id"]}
    selisih = False
    for bid, b, p, q in k["baris"]:
        # Kiriman kurang tetap berupa kemasan utuh (karton, karung, jerigen),
        # bukan pecahan. Pesanan satu kemasan tidak bisa kurang sebagian.
        diterima = q if hasil["jumlah_sesuai"] or q <= 1 else max(1.0, math.floor(q * hasil["rasio_diterima"]))
        masuk = diterima * p.isi
        b.stok += masuk
        b.dalam_perjalanan = max(0.0, b.dalam_perjalanan - q * p.isi)
        r = semua_baris[bid]
        r["jumlah_diterima"] = float(diterima)
        if diterima < q:
            r["alasan_selisih"], r["catatan_penerimaan"] = AlasanSelisih.KURANG, "Jumlah kurang dari yang dipesan."
            selisih = True
        elif not hasil["kondisi_baik"]:
            r["alasan_selisih"], r["catatan_penerimaan"] = AlasanSelisih.RUSAK, "Sebagian barang rusak saat diterima."
            selisih = True
        if masuk > 0:
            t_.tambah(
                "pergerakan",
                {
                    "usaha_id": usaha_id, "barang_id": b.id, "waktu": _wkt(t, 11, 0), "jenis": JenisPergerakan.MASUK,
                    "jumlah": round(masuk, 3), "stok_sesudah": round(b.stok, 3),
                    "keterangan": "Masuk dari pesanan " + pesanan["nomor"], "pesanan_id": k["pesanan_id"], "oleh": PEMILIK,
                },
            )
    pesanan.update(
        status=StatusPesanan.SELESAI_CATATAN if selisih else StatusPesanan.SELESAI,
        status_bayar=StatusBayar.DIKONFIRMASI, kirim_kurir="Armada sendiri", kirim_pengantar="Kurir distributor",
        kirim_nomor_resi="RSI-P%05d" % k["pesanan_id"], kirim_diterima_oleh=PEMILIK, kirim_waktu_sampai=_wkt(t, 11, 0),
        kirim_catatan="Dihitung bersama penerima saat barang diturunkan.",
    )
    t_.tambah(
        "pesanan_jejak",
        {"pesanan_id": k["pesanan_id"], "waktu": _wkt(t, 11, 0), "status": pesanan["status"],
         "keterangan": "Barang sampai dan dihitung di tempat."},
    )
    if acak.random() < 0.45:
        pesanan["sudah_diulas"] = True
        t_.tambah(
            "ulasan",
            {
                "pesanan_id": k["pesanan_id"], "usaha_id": usaha_id, "distributor_id": k["distributor_id"],
                "rating": 5 if hasil["sukses"] else int(acak.integers(2, 5)), "isi": None, "waktu": _wkt(t, 19, 0),
                "aspek_ketepatan_waktu": 5 if hasil["tepat_waktu"] else int(acak.integers(2, 4)),
                "aspek_jumlah_sesuai": 5 if hasil["jumlah_sesuai"] else int(acak.integers(2, 4)),
                "aspek_kondisi_barang": 5 if hasil["kondisi_baik"] else int(acak.integers(2, 4)),
            },
        )


def _tulis(kon, t_: Penampung) -> dict[str, int]:
    jumlah: dict[str, int] = {}
    for nama, model in URUTAN:
        data = t_.baris.get(nama, [])
        jumlah[nama] = len(data)
        if not data:
            continue
        tabel = model.__table__
        kolom = set(tabel.columns.keys())
        kunci = {k for d in data for k in d} & kolom
        bersih = [{k: d.get(k) for k in kunci} for d in data]
        if "dibuat_pada" in kolom and "dibuat_pada" not in kunci:
            for b in bersih:
                b["dibuat_pada"] = _wkt(MULAI)
        for i in range(0, len(bersih), 5000):
            kon.execute(tabel.insert(), bersih[i : i + 5000])
        kon.execute(
            text("SELECT setval(pg_get_serial_sequence(:t, 'id'), (SELECT MAX(id) FROM %s))" % nama), {"t": nama}
        )
    return jumlah


def tambahkan(ulang: bool = True) -> dict[str, int] | None:
    """Dipanggil `buat_dataset.py` sesudah basis data diisi. Mengembalikan None bila sudah ada dan `ulang` False."""
    with mesin().begin() as kon:
        ada = kon.execute(text("SELECT 1 FROM usaha WHERE email = :e"), {"e": EMAIL}).first() is not None
        if ada and not ulang:
            return None
        if ada:
            _hapus_lama(kon)
        return bangkitkan(kon)


def main() -> None:
    ap = argparse.ArgumentParser(description="Tambah UMKM produsen sambal ke basis data simulasi.")
    ap.add_argument("--ulang", action="store_true", help="hapus versi lama lebih dulu")
    arg = ap.parse_args()
    hasil = tambahkan(ulang=arg.ulang)
    if hasil is None:
        print(f"{NAMA_USAHA} sudah ada. Pakai --ulang untuk membangkitkan ulang.")
        return
    for nama, n in hasil.items():
        if n:
            print(f"  {nama:<20} {n:>6}")
    print(f"Selesai: {NAMA_USAHA} ({EMAIL}). Jalankan Mesin 1 dan Mesin 2 supaya perkiraan dan saran terisi.")


if __name__ == "__main__":
    main()
