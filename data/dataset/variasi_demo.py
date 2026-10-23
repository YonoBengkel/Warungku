"""
Variasi data untuk dua akun demo, supaya setiap penyaring di layar punya isi.

    python -m dataset.variasi_demo              # pasang ulang variasi
    python -m dataset.variasi_demo --jika-basi  # hanya kalau belum ada atau umurnya > 3 hari

Diminta Ilham (19 Okt 2026). Data simulasi berakhir dengan keadaan yang sangat
rapi: semua pesanan sudah selesai, tidak ada kontrak, dan hampir semua stok
aman. Akibatnya penyaring Berjalan, Akan berakhir, Habis, dan Menipis kosong
saat demo. Skrip ini menambah variasi untuk Kopi Kita Jogja (umkm1) dan Dapur
Sambal Bu Ratmi (produksi1):

* **Stok**: beberapa barang dibuat habis dan menipis lewat baris `koreksi`
  pada hari terakhir data (5 Okt 2026). Koreksi tidak masuk data latih Mesin 1,
  jadi perkiraan tidak berubah dan pemeriksaan konsistensi tetap lolos. Supaya
  setiap penyaring di halaman Stok berisi: beberapa barang diberi pengingat
  kedaluwarsa yang dekat, beberapa batas amannya dikembalikan ke bawaan, dan
  ada barang baru (kode `V..`) yang dibeli tapi belum pernah terpakai, untuk
  penyaring "Tidak bergerak".
* **Pesanan**: menunggu konfirmasi, disiapkan, dikirim, sudah sampai (menunggu
  dihitung), dan dibatalkan, ke beberapa distributor. Nomornya berawalan
  `PS-yymmdd-V`.
* **Kontrak**: berjalan, akan berakhir, menunggu persetujuan, selesai,
  dihentikan, dan ditolak, dengan beberapa distributor.
* **Menu kasir** (Kopi Kita saja): resep minuman yang memotong beberapa bahan
  sekaligus, dan nota beberapa hari terakhir untuk menu baru yang belum
  dipasangkan ke bahan (isi tab "Perlu Dibereskan" di Akun > Data dari Kasir).
  Nomor notanya berawalan `DEMO-V-` dan tidak ikut data latih omset.
* **Portal distributor** (Sumber Tani Nusantara, distributor1): pesanan masuk dari
  lima kedai simulasi di setiap tahap (nomor `PS-yymmdd-W`), kontrak dengan beberapa
  kedai di setiap status, dan promo berjalan yang beragam, ditambah promo dari
  distributor lain supaya Beranda Kopi Kita punya promo. Diminta Ilham 23 Okt 2026.
* **Kiriman simulasi yang terlambat** (masih "dikirim" padahal perkiraan tibanya
  sudah lewat lebih dari dua hari) ditandai sudah sampai oleh distributornya, sama
  seperti tombol "Tandai Sudah Sampai". Stok pemiliknya tidak berubah sampai ia
  menghitung barangnya sendiri. Perubahan ini tidak dibatalkan saat dipasang ulang.

**Tanggal pesanan dan kontrak relatif terhadap HARI INI**, bukan terhadap
akhir data simulasi: status kontrak "akan berakhir" dan keterangan "perkiraan
tiba" di layar dihitung dari tanggal sungguhan. Karena itu variasinya menjadi
basi seiring waktu; `nyalakan.cmd` menyegarkannya kalau umurnya lebih dari tiga
hari. Memasang ulang MENGHAPUS pesanan variasi sebelumnya (beserta perubahan
yang dibuat lewat layar pada pesanan itu) dan SEMUA kontrak kedua akun.
"""

from __future__ import annotations

import argparse
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text

from warungku.basis_data import mesin
from warungku.enum import JenisPergerakan, StatusBayar, StatusKontrak, StatusPesanan
from warungku.model import (
    Kontrak,
    KontrakPeriode,
    Pergerakan,
    Pesanan,
    PesananBaris,
    PesananJejak,
    Promo,
    PromoPenawaran,
    TingkatKeanggotaan,
)

from .buat_dataset import AKHIR, _wkt
from .katalog import deskripsi_kemasan

OLEH = "Variasi demo"
UMUR_BASI = timedelta(days=3)
WIB = timezone(timedelta(hours=7))

#: Barang yang dibuat habis dan menipis. Menipis = 45% batas aman.
STOK: dict[str, dict[str, tuple[str, ...]]] = {
    "umkm1@warungku.test": {
        "habis": ("Susu UHT Full Cream", "Es Batu Kristal", "Sedotan Kertas"),
        "menipis": ("Biji Kopi Arabika", "Gula Aren Cair", "Gelas Plastik 16 oz", "Bubuk Cokelat"),
    },
    "produksi1@warungku.test": {
        "habis": ("Teri Nasi",),
        # Cabai Merah tidak punya pesanan berjalan, jadi masuk penyaring "Perlu dibeli".
        "menipis": ("Minyak Goreng", "Bawang Putih", "Bawang Merah", "Cabai Merah"),
    },
}

#: Pengingat kedaluwarsa: (barang, berapa hari lagi). Di bawah 14 hari = "Segera kedaluwarsa".
KEDALUWARSA: dict[str, tuple[tuple[str, int], ...]] = {
    "umkm1@warungku.test": (("Susu Kental Manis", 6), ("Teh Hitam", 11), ("Matcha Bubuk", 75)),
    "produksi1@warungku.test": (("Cabai Merah", 3), ("Bawang Merah", 9), ("Garam Dapur", 300)),
}

#: Batas aman yang dikembalikan ke bawaan (belum diatur sistem maupun pemilik).
BAWAAN: dict[str, tuple[str, ...]] = {
    "umkm1@warungku.test": ("Cup Sealer Film", "Sirup Vanila"),
    "produksi1@warungku.test": ("Gula Pasir", "Garam Dapur"),
}

#: Barang baru yang dibeli tapi belum pernah terpakai: (produk katalog, jumlah
#: kemasan, berapa hari sebelum akhir data dibeli, catatan). Kodenya V01, V02, ...
BARANG_BARU: dict[str, tuple[tuple[str, int, int, str], ...]] = {
    "umkm1@warungku.test": (
        ("Keju Cheddar", 2, 45, "Untuk menu roti bakar keju yang belum mulai dijual."),
        ("Kentang Beku", 3, 60, "Untuk camilan kentang goreng; menunggu penggorengan baru."),
    ),
    "produksi1@warungku.test": (
        ("Kantong Plastik", 2, 50, "Untuk kemasan eceran yang belum dijalankan; kiriman ke toko memakai dus."),
        ("Gula Aren Cair", 1, 40, "Untuk uji coba sambal manis yang belum diproduksi."),
    ),
}

#: (status, distributor, [(barang, jumlah kemasan)], hari yang lalu, alasan tolak)
#: Status "sampai" = dikirim dan sudah ditandai sampai oleh distributor.
PESANAN: dict[str, list[tuple]] = {
    "umkm1@warungku.test": [
        ("menunggu", "Sumber Tani Nusantara", [("Biji Kopi Arabika", 4)], 0, None),
        ("menunggu", "Dairy Prima Jaya", [("Susu UHT Full Cream", 3)], 0, None),
        ("disiapkan", "Kemasan Andalan", [("Gelas Plastik 16 oz", 1), ("Sedotan Kertas", 1)], 1, None),
        ("dikirim", "Es Segar Mandiri", [("Es Batu Kristal", 5)], 1, None),
        ("sampai", "Manis Sejahtera", [("Gula Aren Cair", 2)], 2, None),
        ("batal", "Kopi Rakyat Merapi", [("Bubuk Cokelat", 2)], 3, "Stok bubuk cokelat sedang kosong sampai akhir bulan."),
    ],
    "produksi1@warungku.test": [
        ("menunggu", "Pangan Harian Sejati", [("Teri Nasi", 3)], 0, None),
        ("disiapkan", "Manis Sejahtera", [("Minyak Goreng", 3)], 1, None),
        ("dikirim", "Pangan Harian Sejati", [("Bawang Putih", 4), ("Bawang Merah", 6)], 1, None),
        ("sampai", "Kemasan Andalan", [("Toples Kaca 200 ml", 3)], 2, None),
        ("batal", "Manis Sejahtera", [("Garam Dapur", 5)], 4, "Armada kirim ke Kalasan penuh pekan ini."),
    ],
}

#: (status, distributor, barang, paket, berapa hari lalu kontrak mulai)
#: "akan-berakhir" disimpan sebagai aktif; API membacanya akan berakhir karena
#: sisa masanya 30 hari atau kurang.
KONTRAK: dict[str, list[tuple]] = {
    "umkm1@warungku.test": [
        ("aktif", "Sumber Tani Nusantara", "Biji Kopi Arabika", "Kontrak C", 20),
        ("aktif-rutin", "Dairy Prima Jaya", "Susu UHT Full Cream", "Kontrak E", 100),
        ("akan-berakhir", "Kemasan Andalan", "Gelas Plastik 16 oz", "Kontrak C", 70),
        ("menunggu-persetujuan", "Manis Sejahtera", "Gula Aren Cair", "Kontrak B", 1),
        ("selesai", "Kopi Rakyat Merapi", "Biji Kopi Robusta", "Kontrak B", 100),
        ("dihentikan", "Es Segar Mandiri", "Es Batu Kristal", "Kontrak C", 90),
    ],
    "produksi1@warungku.test": [
        ("aktif", "Pangan Harian Sejati", "Cabai Merah", "Kontrak C", 25),
        ("aktif-rutin", "Kemasan Andalan", "Toples Kaca 200 ml", "Kontrak E", 50),
        ("akan-berakhir", "Manis Sejahtera", "Minyak Goreng", "Kontrak B", 40),
        ("menunggu-persetujuan", "Pangan Harian Sejati", "Teri Nasi", "Kontrak A", 1),
        ("selesai", "Sumber Tani Nusantara", "Gula Pasir", "Kontrak A", 75),
        ("ditolak", "Manis Sejahtera", "Bawang Merah", "Kontrak C", 6),
    ],
}


#: Resep menu yang sudah dijual: (menu, ((barang, takaran per porsi dalam satuan dasar), ...)).
RESEP: dict[str, tuple[tuple[str, tuple[tuple[str, str], ...]], ...]] = {
    "umkm1@warungku.test": (
        ("Es Kopi Susu Gula Aren", (
            ("Biji Kopi Arabika", "18"), ("Susu UHT Full Cream", "150"), ("Gula Aren Cair", "20"),
            ("Es Batu Kristal", "150"), ("Gelas Plastik 16 oz", "1"), ("Sedotan Kertas", "1"),
        )),
        ("Americano", (("Biji Kopi Robusta", "18"), ("Air Mineral Galon", "200"), ("Gelas Plastik 16 oz", "1"))),
        ("Matcha Latte", (
            ("Matcha Bubuk", "10"), ("Susu UHT Full Cream", "180"), ("Gula Pasir", "15"), ("Gelas Plastik 16 oz", "1"),
        )),
        ("Cokelat Panas", (("Bubuk Cokelat", "25"), ("Susu Kental Manis", "30"), ("Air Mineral Galon", "150"))),
    ),
}

#: Menu baru di kasir yang belum dipasangkan: (menu, satuan, harga jual, porsi
#: terjual, berapa hari lalu nota pertamanya). Bahannya sudah ada di gudang
#: (Keju Cheddar, Kentang Beku dari BARANG_BARU), jadi bisa dipasangkan saat demo.
MENU_BARU: dict[str, tuple[tuple[str, str, int, int, int], ...]] = {
    "umkm1@warungku.test": (
        ("Kopi Susu Pandan", "gelas", 24000, 41, 6),
        ("Roti Bakar Keju", "porsi", 18000, 18, 3),
        ("Kentang Goreng", "porsi", 15000, 12, 2),
    ),
}

#: Akun distributor yang portalnya dibuka saat demo.
EMAIL_DISTRIBUTOR = "distributor1@warungku.test"

#: Banyaknya kedai simulasi yang memesan ke distributor demo.
JUMLAH_PEMBELI = 5

#: Pesanan masuk ke distributor demo: (status, urutan pembeli 0..4, [(produk, kemasan)], hari lalu, alasan tolak).
#: "sampai" = dikirim dan sudah ditandai sampai; di portal distributor terbaca selesai.
PESANAN_DISTRIBUTOR: list[tuple] = [
    ("menunggu", 0, [("Biji Kopi Arabika", 3), ("Gula Aren Cair", 2)], 0, None),
    ("menunggu", 1, [("Teh Hitam", 2)], 0, None),
    ("menunggu", 2, [("Gula Pasir", 1), ("Sirup Vanila", 4)], 1, None),
    ("disiapkan", 3, [("Biji Kopi Robusta", 5)], 0, None),
    ("disiapkan", 4, [("Bubuk Cokelat", 2), ("Matcha Bubuk", 1)], 1, None),
    ("dikirim", 0, [("Biji Kopi Robusta", 4)], 0, None),
    ("dikirim", 2, [("Biji Kopi Arabika", 2), ("Teh Hitam", 1)], 1, None),
    ("dikirim", 4, [("Gula Aren Cair", 3)], 1, None),
    ("sampai", 1, [("Gula Pasir", 2)], 2, None),
    ("sampai", 3, [("Matcha Bubuk", 2)], 3, None),
    ("batal", 2, [("Bubuk Cokelat", 6)], 3, "Bubuk cokelat sedang kosong sampai kiriman pekan depan."),
]

#: Kontrak dengan distributor demo: (status, urutan pembeli, produk, paket, berapa hari lalu mulai).
KONTRAK_DISTRIBUTOR: list[tuple] = [
    ("aktif", 0, "Biji Kopi Arabika", "Kontrak C", 30),
    ("aktif-rutin", 3, "Biji Kopi Robusta", "Kontrak B", 15),
    ("akan-berakhir", 1, "Teh Hitam", "Kontrak B", 40),
    ("menunggu-persetujuan", 2, "Gula Pasir", "Kontrak C", 1),
    ("menunggu-persetujuan", 4, "Sirup Vanila", "Kontrak A", 0),
    ("selesai", 4, "Bubuk Cokelat", "Kontrak A", 80),
    ("dihentikan", 2, "Gula Aren Cair", "Kontrak C", 95),
    ("ditolak", 1, "Matcha Bubuk", "Kontrak A", 5),
]

#: Promo berjalan: (distributor, jenis, judul, keterangan, [produk], potongan %, berakhir dalam hari | None,
#: dibuat berapa hari lalu, tingkat). Judulnya dipakai untuk membuangnya lagi saat dipasang ulang.
PROMO: list[tuple] = [
    ("Sumber Tani Nusantara", "produk-baru", "Panen Baru Arabika Gayo",
     "Biji panen terbaru baru masuk gudang. Sangrai menyusul sesuai pesanan.",
     ["Biji Kopi Arabika", "Biji Kopi Robusta"], 8, 21, 0, None),
    ("Sumber Tani Nusantara", "cuci-gudang", "Cuci Gudang Gula Pasir",
     "Stok gula kiriman bulan lalu dilepas lebih murah sebelum karung baru datang.",
     ["Gula Pasir"], 15, 2, 6, None),
    ("Sumber Tani Nusantara", "cuci-gudang", "Diskon Teh Akhir Bulan",
     "Teh hitam dan teh melati turun harga sampai akhir bulan.",
     ["Teh Hitam", "Teh Melati"], 10, 9, 3, None),
    ("Sumber Tani Nusantara", "cuci-gudang", "Sisa Kiriman Sirup & Gula Aren",
     "Sirup vanila dan gula aren cair sisa kiriman, masa simpan masih panjang.",
     ["Sirup Vanila", "Gula Aren Cair"], 20, 5, 1, None),
    ("Sumber Tani Nusantara", "produk-baru", "Matcha Ceremonial Baru",
     "Matcha giling halus untuk latte dan minuman dingin, stok perdana.",
     ["Matcha Bubuk"], None, None, 0, None),
    ("Sumber Tani Nusantara", "membership", "Langganan Kopi Bulanan",
     "Daftar sekali, biji kopi dan cokelat datang tiap pekan dengan harga tetap sebulan.",
     ["Biji Kopi Arabika", "Biji Kopi Robusta", "Bubuk Cokelat"], 6, None, 10,
     [("Perunggu", "Langganan kirim sekali seminggu", "Potongan 6% dan harga tetap sebulan"),
      ("Perak", "Belanja minimal Rp 2 jt per bulan", "Semua di Perunggu, plus sangrai sesuai pesanan"),
      ("Emas", "Belanja minimal Rp 4 jt per bulan", "Semua di Perak, plus gratis ongkos kirim")]),
    ("Dairy Prima Jaya", "cuci-gudang", "Cuci Gudang Susu UHT",
     "Susu UHT tanggal kedaluwarsa awal tahun depan dilepas lebih murah.",
     ["Susu UHT Full Cream"], 12, 6, 2, None),
    ("Kemasan Andalan", "cuci-gudang", "Cuci Gudang Kemasan",
     "Gelas dan sedotan menumpuk sebelum kiriman baru datang. Harga turun sampai gudang lega.",
     ["Gelas Plastik 16 oz", "Sedotan Kertas"], 15, 10, 4, None),
    ("Es Segar Mandiri", "membership", "Langganan Es Harian",
     "Es batu datang tiap pagi tanpa perlu pesan ulang. Bisa dihentikan kapan saja.",
     ["Es Batu Kristal"], 5, None, 20,
     [("Perunggu", "Langganan kirim harian 1 bulan", "Potongan 5% untuk es batu"),
      ("Perak", "Langganan 3 bulan", "Semua di Perunggu, plus kirim dua kali sehari saat ramai")]),
]

#: Kiriman simulasi dianggap terlambat kalau perkiraan tibanya sudah lewat sebanyak ini.
TERLAMBAT = timedelta(days=2)

#: Porsi per nota, diputar supaya notanya tidak seragam.
POLA_NOTA = (2, 1, 3, 1, 2)


def _usaha(kon, email: str) -> int | None:
    return kon.execute(text("SELECT id FROM usaha WHERE email = :e"), {"e": email}).scalar()


def _barang(kon, usaha_id: int) -> dict[str, dict]:
    return {
        r["nama"]: dict(r)
        for r in kon.execute(
            text("SELECT id, nama, produk_master_id, stok, batas_aman, satuan FROM barang WHERE usaha_id = :u"),
            {"u": usaha_id},
        ).mappings()
    }


def _penawaran(kon, distributor: str, produk_master_id: int) -> dict:
    r = kon.execute(
        text(
            """
            SELECT p.id, p.distributor_id, p.harga_satuan, p.satuan, p.kemasan_isi
              FROM penawaran p JOIN distributor d ON d.id = p.distributor_id
             WHERE d.nama = :d AND p.produk_master_id = :pm AND p.aktif
             ORDER BY p.id LIMIT 1
            """
        ),
        {"d": distributor, "pm": produk_master_id},
    ).mappings().first()
    if r is None:
        raise ValueError(f"{distributor} tidak menawarkan produk {produk_master_id}")
    return dict(r)


def _tambah_bulan(t: datetime, n: int) -> datetime:
    from api.kontrak import tambah_bulan

    return tambah_bulan(t, n)


def hapus(kon, usaha_id: int) -> None:
    """Buang variasi lama: pesanan berawalan V, semua kontrak usaha ini, koreksi stok, dan menu demo."""
    p = {"u": usaha_id}
    email = kon.execute(text("SELECT email FROM usaha WHERE id = :u"), p).scalar()
    # Menu demo dihapus sebelum barang V: resep yang dipasangkan saat demo bisa
    # menunjuk Keju Cheddar atau Kentang Beku, dan barangnya tidak bisa dihapus
    # selama masih ditunjuk.
    kon.execute(
        text(
            "DELETE FROM transaksi_baris WHERE transaksi_id IN "
            "(SELECT id FROM transaksi WHERE usaha_id = :u AND nomor_struk LIKE 'DEMO-V-%')"
        ),
        p,
    )
    kon.execute(text("DELETE FROM transaksi WHERE usaha_id = :u AND nomor_struk LIKE 'DEMO-V-%'"), p)
    menu = [m.lower() for m, _ in RESEP.get(email, ())] + [m[0].lower() for m in MENU_BARU.get(email, ())]
    if menu:
        q = {"u": usaha_id, "m": menu}
        dipetakan = "SELECT id FROM pemetaan_menu WHERE usaha_id = :u AND lower(btrim(nama_menu)) = ANY(:m)"
        kon.execute(text(f"DELETE FROM pemetaan_menu_bahan WHERE pemetaan_id IN ({dipetakan})"), q)
        kon.execute(text("DELETE FROM pemetaan_menu WHERE usaha_id = :u AND lower(btrim(nama_menu)) = ANY(:m)"), q)
    pesanan = "SELECT id FROM pesanan WHERE usaha_id = :u AND nomor LIKE 'PS-%-V%'"
    for sql in (
        f"UPDATE pergerakan SET pesanan_id = NULL WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM ulasan WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM fitur_pesanan WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM pesanan_jejak WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM pesanan_baris WHERE pesanan_id IN ({pesanan})",
        "DELETE FROM pesanan WHERE usaha_id = :u AND nomor LIKE 'PS-%-V%'",
        "UPDATE pesanan SET kontrak_id = NULL WHERE kontrak_id IN (SELECT id FROM kontrak WHERE usaha_id = :u)",
        "DELETE FROM kontrak_periode WHERE kontrak_id IN (SELECT id FROM kontrak WHERE usaha_id = :u)",
        "DELETE FROM kontrak WHERE usaha_id = :u",
    ):
        kon.execute(text(sql), p)
    baru = "SELECT id FROM barang WHERE usaha_id = :u AND kode_barang LIKE 'V%'"
    for sql in (
        f"UPDATE pesanan_baris SET barang_id = NULL WHERE barang_id IN ({baru})",
        f"UPDATE notifikasi SET barang_id = NULL WHERE barang_id IN ({baru})",
        f"DELETE FROM pemetaan_menu_bahan WHERE barang_id IN ({baru})",
        f"DELETE FROM rekomendasi_skor WHERE barang_id IN ({baru})",
        f"DELETE FROM prediksi WHERE barang_id IN ({baru})",
        f"DELETE FROM permintaan_harian WHERE barang_id IN ({baru})",
        f"DELETE FROM pergerakan WHERE barang_id IN ({baru})",
        f"DELETE FROM kemasan WHERE barang_id IN ({baru})",
        "DELETE FROM barang WHERE usaha_id = :u AND kode_barang LIKE 'V%'",
    ):
        kon.execute(text(sql), p)
    for nama, _ in KEDALUWARSA.get(email, ()):
        kon.execute(
            text("UPDATE barang SET ingatkan_kedaluwarsa = false, kedaluwarsa = NULL WHERE usaha_id = :u AND nama = :n"),
            {"u": usaha_id, "n": nama},
        )
    for nama in BAWAAN.get(email, ()):
        kon.execute(
            text("UPDATE barang SET sumber_batas_aman = 'sistem' WHERE usaha_id = :u AND nama = :n AND sumber_batas_aman = 'bawaan'"),
            {"u": usaha_id, "n": nama},
        )
    kena = [r[0] for r in kon.execute(
        text("SELECT DISTINCT barang_id FROM pergerakan WHERE usaha_id = :u AND oleh = :o"), {"u": usaha_id, "o": OLEH}
    )]
    if kena:
        kon.execute(text("DELETE FROM pergerakan WHERE usaha_id = :u AND oleh = :o"), {"u": usaha_id, "o": OLEH})
        # Stok kembali ke saldo buku besar tanpa koreksi variasi.
        kon.execute(
            text(
                """
                UPDATE barang b SET stok = COALESCE((SELECT SUM(jumlah) FROM pergerakan g WHERE g.barang_id = b.id), 0)
                 WHERE b.id = ANY(:ids)
                """
            ),
            {"ids": kena},
        )


def _variasi_stok(kon, usaha_id: int, email: str) -> int:
    barang = _barang(kon, usaha_id)
    waktu = _wkt(AKHIR, 21, 45)
    n = 0
    for kelompok, daftar in STOK[email].items():
        for nama in daftar:
            b = barang[nama]
            stok = Decimal(b["stok"])
            if kelompok == "habis":
                sasaran = Decimal(0)
            else:
                sasaran = Decimal(b["batas_aman"]) * Decimal("0.45")
                sasaran = sasaran.quantize(Decimal("1"))
            if stok <= sasaran:
                continue
            kon.execute(
                Pergerakan.__table__.insert(),
                {
                    "usaha_id": usaha_id, "barang_id": b["id"], "waktu": waktu, "jenis": JenisPergerakan.KOREKSI,
                    "jumlah": sasaran - stok, "stok_sesudah": sasaran,
                    "keterangan": "Koreksi sesudah hitung rak" if kelompok == "menipis" else "Koreksi: barang rusak dibuang",
                    "oleh": OLEH,
                },
            )
            kon.execute(text("UPDATE barang SET stok = :s WHERE id = :b"), {"s": sasaran, "b": b["id"]})
            n += 1
    return n


def _variasi_atribut(kon, usaha_id: int, email: str, sekarang: datetime) -> None:
    """Pengingat kedaluwarsa (relatif terhadap hari ini) dan batas aman bawaan."""
    hari_ini = sekarang.astimezone(WIB).date()
    for nama, hari in KEDALUWARSA[email]:
        kon.execute(
            text("UPDATE barang SET ingatkan_kedaluwarsa = true, kedaluwarsa = :t WHERE usaha_id = :u AND nama = :n"),
            {"t": hari_ini + timedelta(days=hari), "u": usaha_id, "n": nama},
        )
    for nama in BAWAAN[email]:
        kon.execute(
            text("UPDATE barang SET sumber_batas_aman = 'bawaan' WHERE usaha_id = :u AND nama = :n"),
            {"u": usaha_id, "n": nama},
        )


def _barang_baru(kon, usaha_id: int, email: str) -> int:
    """Barang yang sudah dibeli tapi belum pernah terpakai: isi penyaring "Tidak bergerak"."""
    pos = kon.execute(
        text("SELECT status::text FROM data_kasir WHERE usaha_id = :u"), {"u": usaha_id}
    ).scalar() == "terhubung"
    n = 0
    for urut, (nama, jumlah, hari_lalu, catatan) in enumerate(BARANG_BARU[email], start=1):
        pm = kon.execute(
            text(
                """
                SELECT pm.id, pm.kategori, pm.satuan_dasar, pm.sinonim, p.kemasan_nama, p.kemasan_isi, p.harga_satuan
                  FROM produk_master pm JOIN penawaran p ON p.produk_master_id = pm.id
                 WHERE pm.nama_kanonik = :n AND p.aktif ORDER BY p.harga_satuan LIMIT 1
                """
            ),
            {"n": nama},
        ).mappings().one()
        isi = Decimal(pm["kemasan_isi"])
        stok = isi * jumlah
        bid = kon.execute(
            text(
                """
                INSERT INTO barang (usaha_id, produk_master_id, nama, deskripsi, nama_lain, kategori, kode_barang,
                                    satuan, stok, batas_aman, batas_aman_saran, sumber_batas_aman, hari_kirim,
                                    harga_beli_terakhir, hari_data_terkumpul, ingatkan_kedaluwarsa,
                                    terhubung_kasir, dicatat_manual, catatan)
                VALUES (:u, :pm, :nama, :desk, :lain, :kat, :kode, :sat, :stok, :batas, 0, 'bawaan', 2,
                        :harga, 0, false, :pos, false, :cat)
                RETURNING id
                """
            ),
            {
                "u": usaha_id, "pm": pm["id"], "nama": nama, "desk": deskripsi_kemasan(float(isi), pm["satuan_dasar"], pm["kemasan_nama"]),
                "lain": list(pm["sinonim"] or []), "kat": pm["kategori"], "kode": f"V{urut:02d}",
                "sat": pm["satuan_dasar"], "stok": stok, "batas": (isi / 2).quantize(Decimal("1")),
                "harga": pm["harga_satuan"], "pos": pos, "cat": catatan,
            },
        ).scalar_one()
        kon.execute(
            text("INSERT INTO kemasan (barang_id, nama, isi) VALUES (:b, :n, :i)"),
            {"b": bid, "n": pm["kemasan_nama"], "i": isi},
        )
        kon.execute(
            Pergerakan.__table__.insert(),
            {
                "usaha_id": usaha_id, "barang_id": bid, "waktu": _wkt(AKHIR - timedelta(days=hari_lalu), 10, 0),
                "jenis": JenisPergerakan.MASUK, "jumlah": stok, "stok_sesudah": stok,
                "keterangan": "Dibeli langsung, belum dipakai", "oleh": OLEH,
            },
        )
        n += 1
    return n


def _variasi_pesanan(kon, usaha_id: int, email: str, sekarang: datetime, nomor_awal: int) -> int:
    barang = _barang(kon, usaha_id)
    nomor = nomor_awal
    for status, distributor, isi, hari_lalu, alasan in PESANAN[email]:
        nomor += 1
        _satu_pesanan(kon, usaha_id, barang, status, distributor, isi, hari_lalu, alasan, nomor, sekarang, "V")
    return nomor


def _satu_pesanan(
    kon, usaha_id: int, barang: dict[str, dict], status: str, distributor: str, isi, hari_lalu: int,
    alasan: str | None, nomor: int, sekarang: datetime, awalan: str,
) -> None:
    """Satu pesanan beserta baris dan jejaknya. `awalan` membedakan pemiliknya: V akun UMKM, W distributor."""
    dibuat = sekarang - timedelta(days=hari_lalu, hours=2 + nomor % 3)
    baris = []
    for nama, jumlah in isi:
        b = barang[nama]
        baris.append((b, _penawaran(kon, distributor, b["produk_master_id"]), jumlah))
    dist_id = baris[0][1]["distributor_id"]
    kode = {
        "menunggu": StatusPesanan.MENUNGGU_KONFIRMASI, "disiapkan": StatusPesanan.DISIAPKAN,
        "dikirim": StatusPesanan.DIKIRIM, "sampai": StatusPesanan.DIKIRIM, "batal": StatusPesanan.BATAL,
    }[status]
    dibayar = status in ("disiapkan", "dikirim", "sampai")
    dikirim = status in ("dikirim", "sampai")
    pid = kon.execute(
        Pesanan.__table__.insert().returning(Pesanan.__table__.c.id),
        {
            "nomor": f"PS-{dibuat.astimezone(WIB):%y%m%d}-{awalan}{nomor:04d}", "usaha_id": usaha_id,
            "distributor_id": dist_id, "kontrak_id": None, "dibuat_pada": dibuat, "status": kode,
            "ongkos_kirim": 20_000 if nomor % 2 else 25_000, "perkiraan_tiba": dibuat + timedelta(days=2, hours=5),
            "status_bayar": StatusBayar.BUKTI_TERKIRIM if dibayar else StatusBayar.BELUM_DIBAYAR,
            "jumlah_bukti": 1 if dibayar else 0, "dari_saran": nomor % 2 == 0, "dari_rutin": False,
            "sudah_diulas": False, "alasan_tolak": alasan,
            "kirim_kurir": "Armada sendiri" if dikirim else None,
            "kirim_pengantar": "Kurir distributor" if dikirim else None,
            "kirim_nomor_resi": f"RSI-{awalan}{nomor:04d}" if dikirim else None,
            "kirim_waktu_sampai": dibuat + timedelta(days=1, hours=4) if status == "sampai" else None,
            "kirim_diterima_oleh": "Karyawan toko" if status == "sampai" else None,
            "kirim_catatan": "Diturunkan di depan gudang." if status == "sampai" else None,
        },
    ).scalar_one()
    for b, pw, jumlah in baris:
        kon.execute(
            PesananBaris.__table__.insert(),
            {
                "pesanan_id": pid, "penawaran_id": pw["id"], "barang_id": b["id"], "nama": b["nama"],
                "jumlah": float(jumlah), "satuan": pw["satuan"], "harga_satuan": pw["harga_satuan"],
                "harga_normal": pw["harga_satuan"], "promo_id": None, "isi_per_satuan": pw["kemasan_isi"],
                "jumlah_diterima": None,
            },
        )
    jejak = [(StatusPesanan.MENUNGGU_KONFIRMASI, dibuat, "Pesanan dikirim ke distributor.")]
    if status == "batal":
        jejak.append((StatusPesanan.BATAL, dibuat + timedelta(hours=3), "Distributor menolak pesanan: " + alasan))
    if status in ("disiapkan", "dikirim", "sampai"):
        jejak.append((StatusPesanan.DISIAPKAN, dibuat + timedelta(hours=2), "Distributor menerima pesanan dan menyiapkan barang."))
    if dikirim:
        jejak.append((StatusPesanan.DIKIRIM, dibuat + timedelta(hours=20), "Barang berangkat dari gudang distributor."))
    if status == "sampai":
        jejak.append((StatusPesanan.DIKIRIM, dibuat + timedelta(days=1, hours=4),
                      "Distributor menandai barang sudah sampai. Menunggu dihitung pemilik usaha."))
    for st, waktu, ket in jejak:
        kon.execute(PesananJejak.__table__.insert(), {"pesanan_id": pid, "waktu": waktu, "status": st, "keterangan": ket})


def _variasi_kontrak(kon, usaha_id: int, email: str, sekarang: datetime) -> int:
    barang = _barang(kon, usaha_id)
    n = 0
    for status, distributor, nama, kode, hari_mulai in KONTRAK[email]:
        _satu_kontrak(kon, usaha_id, barang, status, distributor, nama, kode, hari_mulai, sekarang)
        n += 1
    return n


def _satu_kontrak(
    kon, usaha_id: int, barang: dict[str, dict], status: str, distributor: str, nama: str, kode: str,
    hari_mulai: int, sekarang: datetime,
) -> None:
    """Satu kontrak di status yang diminta, beserta pemenuhan kuota per bulannya."""
    hari_ini = sekarang.astimezone(WIB).replace(hour=9, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    kota = kon.execute(text("SELECT kota FROM usaha WHERE id = :u"), {"u": usaha_id}).scalar_one()
    b = barang[nama]
    pw = _penawaran(kon, distributor, b["produk_master_id"])
    paket = kon.execute(
        text("SELECT * FROM paket_kontrak WHERE penawaran_id = :p AND kode = :k"), {"p": pw["id"], "k": kode}
    ).mappings().one()
    mulai = hari_ini - timedelta(days=hari_mulai)
    berakhir = _tambah_bulan(mulai, paket["durasi_bulan"])
    data = {
        "usaha_id": usaha_id, "distributor_id": pw["distributor_id"], "penawaran_id": pw["id"], "paket_id": paket["id"],
        "barang_id": b["id"], "nama_barang": nama, "durasi_bulan": paket["durasi_bulan"],
        "kuota_min_per_bulan": paket["kuota_min_per_bulan"], "harga_satuan": paket["harga_satuan"],
        "satuan": pw["satuan"], "mulai": mulai, "berakhir": berakhir, "status": StatusKontrak.AKTIF,
        "dalam_perjalanan": 0, "ketentuan_kuota_kurang": paket["ketentuan_kuota_kurang"],
        "pesanan_rutin_aktif": status == "aktif-rutin",
        "pesanan_rutin_berikutnya": (hari_ini + timedelta(days=5)).date() if status == "aktif-rutin" else None,
    }
    if status == "akan-berakhir":
        # Sisa 20 hari: tetap "akan berakhir" selama sekitar tiga pekan.
        data["mulai"] = _tambah_bulan(hari_ini + timedelta(days=20), -paket["durasi_bulan"])
        data["berakhir"] = hari_ini + timedelta(days=20)
    elif status == "menunggu-persetujuan":
        data["status"] = StatusKontrak.MENUNGGU_PERSETUJUAN
    elif status == "selesai":
        data["status"] = StatusKontrak.SELESAI
    elif status == "dihentikan":
        henti = hari_ini - timedelta(days=30)
        data.update(
            status=StatusKontrak.DIHENTIKAN, berakhir=henti,
            pengajuan_berhenti_waktu=henti - timedelta(days=4),
            pengajuan_berhenti_alasan=f"Pemakaian {nama.lower()} turun, kuota bulanan tidak lagi terpakai.",
            jawaban_berhenti_waktu=henti, jawaban_berhenti_disetujui=True,
            jawaban_berhenti_alasan="Disetujui, kuota bulan berjalan dianggap lunas.",
        )
    elif status == "ditolak":
        data.update(
            status=StatusKontrak.DITOLAK,
            alasan_ditolak=f"Kuota minimum terlalu kecil untuk ongkos kirim ke {kota}.",
        )
    kid = kon.execute(Kontrak.__table__.insert().returning(Kontrak.__table__.c.id), data).scalar_one()

    # Pemenuhan kuota per bulan untuk kontrak yang pernah berjalan.
    if data["status"] in (StatusKontrak.AKTIF, StatusKontrak.SELESAI, StatusKontrak.DIHENTIKAN):
        kini = sekarang.astimezone(WIB)
        akhir = min(kini, data["berakhir"].astimezone(WIB))
        t = data["mulai"].astimezone(WIB).replace(day=1)
        kuota = Decimal(paket["kuota_min_per_bulan"])
        urut = 0
        while (t.year, t.month) <= (akhir.year, akhir.month):
            bulan_ini = (t.year, t.month) == (kini.year, kini.month)
            urut += 1
            diterima = kuota * (Decimal("0.6") if bulan_ini else Decimal("1.1") if urut % 3 else Decimal("0.8"))
            kon.execute(
                KontrakPeriode.__table__.insert(),
                {"kontrak_id": kid, "periode": f"{t.year}-{t.month:02d}", "kuota": kuota,
                 "diterima": diterima.quantize(Decimal("1")), "selesai": not bulan_ini},
            )
            t = (t.replace(day=28) + timedelta(days=4)).replace(day=1)


def _variasi_menu(kon, usaha_id: int, email: str, sekarang: datetime) -> tuple[int, int]:
    """Resep menu yang sudah dijual, dan nota menu baru yang belum dipasangkan. Hasil: (resep, nota)."""
    barang = _barang(kon, usaha_id)
    n_resep = 0
    for menu, bahan in RESEP.get(email, ()):
        pid = kon.execute(
            text("INSERT INTO pemetaan_menu (usaha_id, nama_menu) VALUES (:u, :n) RETURNING id"),
            {"u": usaha_id, "n": menu},
        ).scalar_one()
        for nama, takaran in bahan:
            kon.execute(
                text("INSERT INTO pemetaan_menu_bahan (pemetaan_id, barang_id, takaran) VALUES (:p, :b, :t)"),
                {"p": pid, "b": barang[nama]["id"], "t": Decimal(takaran)},
            )
        n_resep += 1

    # Porsi tiap menu dibagi rata dari hari nota pertamanya sampai hari ini.
    # Nota hari ini diletakkan sebelum jam sekarang, supaya "Data terakhir
    # masuk" di halaman kasir terbaca baru.
    hari_ini = sekarang.astimezone(WIB).date()
    nota: list[tuple[datetime, str, str, int, int]] = []
    for urut_menu, (menu, satuan, harga, porsi, hari) in enumerate(MENU_BARU.get(email, ())):
        n_hari = hari + 1
        for i in range(n_hari):
            bagian = round(porsi * (i + 1) / n_hari) - round(porsi * i / n_hari)
            mundur = hari - i
            k = 0
            while bagian > 0:
                q = min(bagian, POLA_NOTA[(k + i + urut_menu) % len(POLA_NOTA)])
                if mundur == 0:
                    waktu = sekarang - timedelta(minutes=20 + 35 * k + 11 * urut_menu)
                else:
                    pagi = datetime.combine(hari_ini - timedelta(days=mundur), time(9, 0), WIB)
                    waktu = pagi + timedelta(minutes=55 * k + 17 * urut_menu)
                nota.append((waktu.astimezone(timezone.utc), menu, satuan, harga, q))
                bagian -= q
                k += 1
    nota.sort()
    for urut, (waktu, menu, satuan, harga, q) in enumerate(nota, start=1):
        tid = kon.execute(
            text(
                "INSERT INTO transaksi (usaha_id, nomor_struk, waktu, kasir, sumber) "
                "VALUES (:u, :n, :w, 'Demo', 'pos') RETURNING id"
            ),
            {"u": usaha_id, "n": f"DEMO-V-{urut:04d}", "w": waktu},
        ).scalar_one()
        kon.execute(
            text(
                "INSERT INTO transaksi_baris (transaksi_id, nama_menu, jumlah, satuan, harga_jual_satuan) "
                "VALUES (:t, :m, :j, :s, :h)"
            ),
            {"t": tid, "m": menu, "j": q, "s": satuan, "h": harga},
        )
    return n_resep, len(nota)


def _demo_usaha(kon) -> list[int]:
    return [u for u in (_usaha(kon, e) for e in STOK) if u is not None]


def _pembeli_distributor(kon, distributor_id: int, demo: list[int]) -> list[int]:
    """Kedai simulasi di area kirim distributor yang barangnya paling banyak cocok dengan penawarannya."""
    return [
        r[0]
        for r in kon.execute(
            text(
                """
                SELECT u.id
                  FROM usaha u
                  JOIN distributor d ON d.id = :d
                  JOIN barang b ON b.usaha_id = u.id AND NOT b.dicatat_manual
                  JOIN penawaran p ON p.produk_master_id = b.produk_master_id
                                  AND p.distributor_id = d.id AND p.aktif
                 WHERE u.kota = ANY(d.area_kirim) AND u.id <> ALL(:demo)
                 GROUP BY u.id
                 ORDER BY count(*) DESC, u.id
                 LIMIT :n
                """
            ),
            {"d": distributor_id, "demo": demo, "n": JUMLAH_PEMBELI},
        )
    ]


def hapus_distributor(kon) -> None:
    """Buang variasi portal distributor: pesanan W, kontrak kedai non-demo, dan promo variasi."""
    pesanan = "SELECT id FROM pesanan WHERE nomor LIKE 'PS-%-W%'"
    demo = _demo_usaha(kon)
    # Data dasar tidak punya kontrak sama sekali; kontrak kedai di luar akun
    # demo hanya bisa berasal dari variasi ini.
    kontrak = "SELECT id FROM kontrak WHERE usaha_id <> ALL(:demo)"
    for sql in (
        f"UPDATE pergerakan SET pesanan_id = NULL WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM ulasan WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM fitur_pesanan WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM pesanan_jejak WHERE pesanan_id IN ({pesanan})",
        f"DELETE FROM pesanan_baris WHERE pesanan_id IN ({pesanan})",
        "DELETE FROM pesanan WHERE nomor LIKE 'PS-%-W%'",
        f"UPDATE pesanan SET kontrak_id = NULL WHERE kontrak_id IN ({kontrak})",
        f"DELETE FROM kontrak_periode WHERE kontrak_id IN ({kontrak})",
        "DELETE FROM kontrak WHERE usaha_id <> ALL(:demo)",
    ):
        kon.execute(text(sql), {"demo": demo})
    judul = [x[2] for x in PROMO]
    promo = "SELECT id FROM promo WHERE judul = ANY(:j)"
    for sql in (
        f"UPDATE pesanan_baris SET promo_id = NULL WHERE promo_id IN ({promo})",
        f"DELETE FROM tingkat_keanggotaan WHERE promo_id IN ({promo})",
        f"DELETE FROM promo_penawaran WHERE promo_id IN ({promo})",
        "DELETE FROM promo WHERE judul = ANY(:j)",
    ):
        kon.execute(text(sql), {"j": judul})


def _tandai_terlambat_sampai(kon, sekarang: datetime) -> int:
    """Kiriman simulasi yang perkiraan tibanya lewat jauh: ditandai sampai oleh distributornya."""
    batas = sekarang - TERLAMBAT
    ids = [
        r[0]
        for r in kon.execute(
            text(
                """
                SELECT id FROM pesanan
                 WHERE status = 'dikirim' AND kirim_waktu_sampai IS NULL
                   AND perkiraan_tiba < :b AND nomor NOT LIKE 'PS-%-V%' AND nomor NOT LIKE 'PS-%-W%'
                """
            ),
            {"b": batas},
        )
    ]
    for pid in ids:
        sampai = kon.execute(
            text(
                """
                UPDATE pesanan
                   SET kirim_waktu_sampai = perkiraan_tiba,
                       kirim_diterima_oleh = coalesce(kirim_diterima_oleh, 'Karyawan toko')
                 WHERE id = :p
             RETURNING kirim_waktu_sampai
                """
            ),
            {"p": pid},
        ).scalar_one()
        kon.execute(
            PesananJejak.__table__.insert(),
            {"pesanan_id": pid, "waktu": sampai, "status": StatusPesanan.DIKIRIM,
             "keterangan": "Distributor menandai barang sudah sampai. Menunggu dihitung pemilik usaha."},
        )
    return len(ids)


def _variasi_distributor(kon, sekarang: datetime) -> dict | None:
    """Pesanan masuk, kontrak, dan promo untuk portal distributor demo."""
    did = kon.execute(
        text("SELECT d.id FROM distributor d JOIN pengguna p ON p.id = d.pengguna_id WHERE p.email = :e"),
        {"e": EMAIL_DISTRIBUTOR},
    ).scalar()
    if did is None:
        return None
    nama_dist = kon.execute(text("SELECT nama FROM distributor WHERE id = :d"), {"d": did}).scalar_one()
    pembeli = _pembeli_distributor(kon, did, _demo_usaha(kon))
    if len(pembeli) < JUMLAH_PEMBELI:
        return None
    # Barang tiap pembeli dicari lewat nama produk katalog, karena nama barang
    # di gudang kedai bisa berbeda dari nama kanonik.
    barang_pembeli: list[dict[str, dict]] = []
    for u in pembeli:
        barang_pembeli.append({
            r["nama_kanonik"]: dict(r)
            for r in kon.execute(
                text(
                    """
                    SELECT b.id, b.nama, b.produk_master_id, b.stok, b.batas_aman, b.satuan, pm.nama_kanonik
                      FROM barang b JOIN produk_master pm ON pm.id = b.produk_master_id
                     WHERE b.usaha_id = :u AND NOT b.dicatat_manual
                    """
                ),
                {"u": u},
            ).mappings()
        })

    nomor = 0
    for status, i, isi, hari_lalu, alasan in PESANAN_DISTRIBUTOR:
        nomor += 1
        _satu_pesanan(kon, pembeli[i], barang_pembeli[i], status, nama_dist, isi, hari_lalu, alasan, nomor, sekarang, "W")
    for status, i, nama, kode, hari_mulai in KONTRAK_DISTRIBUTOR:
        _satu_kontrak(kon, pembeli[i], barang_pembeli[i], status, nama_dist, nama, kode, hari_mulai, sekarang)

    n_promo = 0
    for distributor, jenis, judul, keterangan, produk, potongan, berakhir_hari, dibuat_hari, tingkat in PROMO:
        d = kon.execute(text("SELECT id FROM distributor WHERE nama = :n"), {"n": distributor}).scalar()
        if d is None:
            continue
        penawaran = [
            r[0]
            for r in kon.execute(
                text(
                    """
                    SELECT p.id FROM penawaran p JOIN produk_master pm ON pm.id = p.produk_master_id
                     WHERE p.distributor_id = :d AND p.aktif AND pm.nama_kanonik = ANY(:n)
                     ORDER BY p.id
                    """
                ),
                {"d": d, "n": produk},
            )
        ]
        if not penawaran:
            continue
        pid = kon.execute(
            Promo.__table__.insert().returning(Promo.__table__.c.id),
            {
                "distributor_id": d, "jenis": jenis, "judul": judul, "keterangan": keterangan,
                "berakhir": sekarang + timedelta(days=berakhir_hari) if berakhir_hari is not None else None,
                "potongan_persen": potongan, "dibuat_pada": sekarang - timedelta(days=dibuat_hari),
            },
        ).scalar_one()
        for pw in penawaran:
            kon.execute(PromoPenawaran.__table__.insert(), {"promo_id": pid, "penawaran_id": pw})
        for urutan, (nama_t, syarat, manfaat) in enumerate(tingkat or (), start=1):
            kon.execute(
                TingkatKeanggotaan.__table__.insert(),
                {"promo_id": pid, "urutan": urutan, "nama": nama_t, "syarat": syarat, "manfaat": manfaat},
            )
        n_promo += 1
    return {
        "distributor_id": did, "pembeli": len(pembeli), "pesanan": len(PESANAN_DISTRIBUTOR),
        "kontrak": len(KONTRAK_DISTRIBUTOR), "promo": n_promo,
    }


def basi(kon) -> bool:
    """Belum ada variasi, atau pesanan variasi terbarunya sudah lebih dari tiga hari."""
    terbaru = kon.execute(
        text("SELECT MAX(dibuat_pada) FROM pesanan WHERE nomor LIKE 'PS-%-V%'")
    ).scalar()
    if terbaru is None or datetime.now(timezone.utc) - terbaru > UMUR_BASI:
        return True
    # Basis data yang variasinya dipasang sebelum menu demo atau variasi
    # portal distributor ada.
    if any(MENU_BARU.values()) and not kon.execute(
        text("SELECT EXISTS (SELECT 1 FROM transaksi WHERE nomor_struk LIKE 'DEMO-V-%')")
    ).scalar():
        return True
    return not kon.execute(text("SELECT EXISTS (SELECT 1 FROM pesanan WHERE nomor LIKE 'PS-%-W%')")).scalar()


def pasang(jika_basi: bool = False) -> dict | None:
    """Pasang ulang variasi untuk kedua akun. None kalau `jika_basi` dan variasinya masih segar."""
    sekarang = datetime.now(timezone.utc)
    hasil: dict[str, dict] = {}
    with mesin().begin() as kon:
        if jika_basi and not basi(kon):
            return None
        hapus_distributor(kon)
        nomor = 0
        for email in STOK:
            u = _usaha(kon, email)
            if u is None:
                continue
            hapus(kon, u)
            awal = nomor
            hasil[email] = {
                "usaha_id": u,
                "koreksi_stok": _variasi_stok(kon, u, email),
                "barang_baru": _barang_baru(kon, u, email),
                "kontrak": _variasi_kontrak(kon, u, email, sekarang),
            }
            _variasi_atribut(kon, u, email, sekarang)
            hasil[email]["resep"], hasil[email]["nota_menu"] = _variasi_menu(kon, u, email, sekarang)
            nomor = _variasi_pesanan(kon, u, email, sekarang, nomor)
            hasil[email]["pesanan"] = nomor - awal
        dist = _variasi_distributor(kon, sekarang)
        if dist is not None:
            hasil[EMAIL_DISTRIBUTOR] = dist
        hasil["terlambat_sampai"] = {"pesanan": _tandai_terlambat_sampai(kon, sekarang)}
    return hasil


def main() -> None:
    ap = argparse.ArgumentParser(description="Variasi pesanan, kontrak, dan stok untuk akun demo.")
    ap.add_argument("--jika-basi", action="store_true", help="hanya kalau belum ada atau umurnya lebih dari 3 hari")
    ap.add_argument("--tanpa-mesin2", action="store_true", help="jangan jalankan ulang Mesin 2 sesudahnya")
    arg = ap.parse_args()
    hasil = pasang(jika_basi=arg.jika_basi)
    if hasil is None:
        print("Variasi demo masih segar, tidak diubah.")
        return
    for email, h in hasil.items():
        if email == EMAIL_DISTRIBUTOR:
            print(f"  {email}: {h['pesanan']} pesanan masuk dari {h['pembeli']} kedai, {h['kontrak']} kontrak, "
                  f"{h['promo']} promo berjalan (termasuk distributor lain)")
            continue
        if email == "terlambat_sampai":
            print(f"  kiriman simulasi terlambat ditandai sampai: {h['pesanan']}")
            continue
        print(f"  {email}: {h['pesanan']} pesanan, {h['kontrak']} kontrak, {h['koreksi_stok']} koreksi stok, "
              f"{h['barang_baru']} barang belum terpakai, {h['resep']} resep menu, "
              f"{h['nota_menu']} nota menu baru")
    if not arg.tanpa_mesin2:
        # Barang yang kini menipis dan habis butuh saran distributor yang segar.
        from ml.mesin2.saran import jalankan

        for h in hasil.values():
            if "usaha_id" in h:
                jalankan(h["usaha_id"], thompson=True, nama_model="beta")
        print("  Mesin 2 dijalankan ulang untuk kedua akun.")
    print("Selesai: variasi demo terpasang.")


if __name__ == "__main__":
    main()
