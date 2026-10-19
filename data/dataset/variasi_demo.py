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

**Tanggal pesanan dan kontrak relatif terhadap HARI INI**, bukan terhadap
akhir data simulasi: status kontrak "akan berakhir" dan keterangan "perkiraan
tiba" di layar dihitung dari tanggal sungguhan. Karena itu variasinya menjadi
basi seiring waktu; `nyalakan.cmd` menyegarkannya kalau umurnya lebih dari tiga
hari. Memasang ulang MENGHAPUS pesanan variasi sebelumnya (beserta perubahan
yang dibuat lewat layar pada pesanan itu) dan SEMUA kontrak kedua akun.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text

from warungku.basis_data import mesin
from warungku.enum import JenisPergerakan, StatusBayar, StatusKontrak, StatusPesanan
from warungku.model import Kontrak, KontrakPeriode, Pergerakan, Pesanan, PesananBaris, PesananJejak

from .buat_dataset import AKHIR, _wkt

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
    """Buang variasi lama: pesanan berawalan V, semua kontrak usaha ini, dan koreksi stok variasi."""
    p = {"u": usaha_id}
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
        f"DELETE FROM rekomendasi_skor WHERE barang_id IN ({baru})",
        f"DELETE FROM prediksi WHERE barang_id IN ({baru})",
        f"DELETE FROM permintaan_harian WHERE barang_id IN ({baru})",
        f"DELETE FROM pergerakan WHERE barang_id IN ({baru})",
        f"DELETE FROM kemasan WHERE barang_id IN ({baru})",
        "DELETE FROM barang WHERE usaha_id = :u AND kode_barang LIKE 'V%'",
    ):
        kon.execute(text(sql), p)
    email = kon.execute(text("SELECT email FROM usaha WHERE id = :u"), p).scalar()
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
                "u": usaha_id, "pm": pm["id"], "nama": nama, "desk": f"{float(isi):g} {pm['satuan_dasar']} per {pm['kemasan_nama']}",
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
                "nomor": f"PS-{dibuat.astimezone(WIB):%y%m%d}-V{nomor:04d}", "usaha_id": usaha_id,
                "distributor_id": dist_id, "kontrak_id": None, "dibuat_pada": dibuat, "status": kode,
                "ongkos_kirim": 20_000 if nomor % 2 else 25_000, "perkiraan_tiba": dibuat + timedelta(days=2, hours=5),
                "status_bayar": StatusBayar.BUKTI_TERKIRIM if dibayar else StatusBayar.BELUM_DIBAYAR,
                "jumlah_bukti": 1 if dibayar else 0, "dari_saran": nomor % 2 == 0, "dari_rutin": False,
                "sudah_diulas": False, "alasan_tolak": alasan,
                "kirim_kurir": "Armada sendiri" if dikirim else None,
                "kirim_pengantar": "Kurir distributor" if dikirim else None,
                "kirim_nomor_resi": f"RSI-V{nomor:04d}" if dikirim else None,
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
    return nomor


def _variasi_kontrak(kon, usaha_id: int, email: str, sekarang: datetime) -> int:
    barang = _barang(kon, usaha_id)
    hari_ini = sekarang.astimezone(WIB).replace(hour=9, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    n = 0
    for status, distributor, nama, kode, hari_mulai in KONTRAK[email]:
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
                pengajuan_berhenti_alasan="Pemakaian es batu turun sejak musim hujan.",
                jawaban_berhenti_waktu=henti, jawaban_berhenti_disetujui=True,
                jawaban_berhenti_alasan="Disetujui, kuota bulan berjalan dianggap lunas.",
            )
        elif status == "ditolak":
            data.update(
                status=StatusKontrak.DITOLAK,
                alasan_ditolak="Kuota minimum terlalu kecil untuk ongkos kirim ke Kalasan.",
            )
        kid = kon.execute(Kontrak.__table__.insert().returning(Kontrak.__table__.c.id), data).scalar_one()
        n += 1

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
    return n


def basi(kon) -> bool:
    """Belum ada variasi, atau pesanan variasi terbarunya sudah lebih dari tiga hari."""
    terbaru = kon.execute(
        text("SELECT MAX(dibuat_pada) FROM pesanan WHERE nomor LIKE 'PS-%-V%'")
    ).scalar()
    return terbaru is None or datetime.now(timezone.utc) - terbaru > UMUR_BASI


def pasang(jika_basi: bool = False) -> dict | None:
    """Pasang ulang variasi untuk kedua akun. None kalau `jika_basi` dan variasinya masih segar."""
    sekarang = datetime.now(timezone.utc)
    hasil: dict[str, dict] = {}
    with mesin().begin() as kon:
        if jika_basi and not basi(kon):
            return None
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
            nomor = _variasi_pesanan(kon, u, email, sekarang, nomor)
            hasil[email]["pesanan"] = nomor - awal
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
        print(f"  {email}: {h['pesanan']} pesanan, {h['kontrak']} kontrak, {h['koreksi_stok']} koreksi stok, "
              f"{h['barang_baru']} barang belum terpakai")
    if not arg.tanpa_mesin2:
        # Barang yang kini menipis dan habis butuh saran distributor yang segar.
        from ml.mesin2.saran import jalankan

        for h in hasil.values():
            jalankan(h["usaha_id"], thompson=True, nama_model="beta")
        print("  Mesin 2 dijalankan ulang untuk kedua akun.")
    print("Selesai: variasi demo terpasang.")


if __name__ == "__main__":
    main()
