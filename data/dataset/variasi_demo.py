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
  jadi perkiraan tidak berubah dan pemeriksaan konsistensi tetap lolos.
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
        "menipis": ("Minyak Goreng", "Bawang Putih", "Bawang Merah"),
    },
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
                "kontrak": _variasi_kontrak(kon, u, email, sekarang),
            }
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
        print(f"  {email}: {h['pesanan']} pesanan, {h['kontrak']} kontrak, {h['koreksi_stok']} koreksi stok")
    if not arg.tanpa_mesin2:
        # Barang yang kini menipis dan habis butuh saran distributor yang segar.
        from ml.mesin2.saran import jalankan

        for h in hasil.values():
            jalankan(h["usaha_id"], thompson=True, nama_model="beta")
        print("  Mesin 2 dijalankan ulang untuk kedua akun.")
    print("Selesai: variasi demo terpasang.")


if __name__ == "__main__":
    main()
