"""
Uji pembangkit Warung Madura Barokah 24 Jam (revisi V8, Q175 sampai Q177).

Yang dijaga:

1. **Rancangannya:** sekitar 150 barang generik dalam 12 kelompok, termasuk rokok dan LPG,
   tanpa bensin, dan tiap kelompok punya dua pemasok yang mengirim ke kota warung ini.
2. **Buku besar:** stok sama dengan jumlah pergerakan, nota sama dengan penjualan per barang
   per hari, dan `permintaan_harian` menutup setiap hari.
3. **24 jam:** nota tersebar di semua jam, dengan puncak di malam hari.
4. **Data lain tidak tersentuh:** warung ini hanya memesan ke distributor kelontong, dan barangnya
   produk baru.
5. **Geseran tanggal:** dipasang sesudah data digeser, tanggalnya sejajar dengan akhir data,
   nomornya mengikuti, dan barisnya ikut geseran berikutnya.

Semuanya di satu transaksi yang dibatalkan di akhir. Dilewati kalau warungnya sudah terpasang,
atau di basis data berisi data simulasi penuh, karena geseran menyentuh seluruh data.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest
from sqlalchemy import text

from api.gudang import waktu_nota
from dataset.buat_dataset import AKHIR, HARI_SIMULASI
from dataset.geser_tanggal import POLA_NOTA, geser
from dataset.nota import _menit
from dataset.variasi_demo import PROMO
from dataset.warung_madura import (
    BARANG,
    DISTRIBUTOR_BARU,
    EMAIL,
    JENIS_NOTA,
    KARAKTER_BARU,
    KATEGORI_KELONTONG,
    KOTA,
    _hapus_lama,
    bangkitkan,
)
from warungku.basis_data import mesin

GESER = 28
TUJUH = 7
AKHIR_BARU = AKHIR + timedelta(days=GESER)


def test_rancangan_katalog():
    """Tidak butuh basis data."""
    assert 140 <= len(BARANG) <= 160
    assert len({b.nama for b in BARANG}) == len(BARANG)
    jumlah = Counter(b.kategori for b in BARANG)
    assert set(jumlah) == set(KATEGORI_KELONTONG) and len(jumlah) == 12
    assert min(jumlah.values()) >= 8
    nama = " ".join(b.nama.lower() for b in BARANG)
    assert "rokok" in nama and "lpg" in nama and "bensin" not in nama and "pertalite" not in nama
    # Tanpa merek dagang: nama generik dengan ukuran.
    for merek in ("indomie", "aqua", "sampoerna", "gudang garam", "djarum", "rinso", "lifebuoy", "pepsodent"):
        assert merek not in nama, merek
    # Harga jual di atas harga beli, supaya omset warung masuk akal.
    for b in BARANG:
        assert b.harga_jual > b.harga_acuan / b.isi, b.nama
    # Tiap kelompok dua pemasok yang mengirim ke kota warung ini, dan watak semuanya ada.
    for k in KATEGORI_KELONTONG:
        pemasok = [d for d in DISTRIBUTOR_BARU if k in d.kategori and KOTA in d.area_kirim]
        assert len(pemasok) >= 2, k
    assert {d.nama for d in DISTRIBUTOR_BARU} == set(KARAKTER_BARU)
    # Promo kelontong mencakup tiga jenis promo, dan barangnya benar-benar dijual pemasok itu.
    kategori_barang = {b.nama: b.kategori for b in BARANG}
    pemasok = {d.nama: d.kategori for d in DISTRIBUTOR_BARU}
    promo = [p for p in PROMO if p[0] in pemasok]
    assert {p[1] for p in promo} == {"cuci-gudang", "produk-baru", "membership"}
    for distributor, _, _, _, produk, *_ in promo:
        for nama in produk:
            assert kategori_barang[nama] in pemasok[distributor], (distributor, nama)


def test_jam_nota_simulasi_terbaca_sebagai_jam_setempat():
    """Nota simulasi pukul 20.00 tampil pukul 20.00 WIB, nota kasir sungguhan apa adanya."""
    wkt = datetime(2026, 11, 2, 20, 0, tzinfo=timezone.utc)
    wib = timezone(timedelta(hours=7))
    assert waktu_nota("20261102-072-261", wkt).astimezone(wib).hour == 20
    assert waktu_nota("POS-20261102-0001", wkt) == wkt


def test_nota_tidak_menumpuk_di_menit_terakhir():
    """Tidak butuh basis data. Warung 24 jam sampai tengah malam, tanpa satu menit yang menumpuk."""
    menit = _menit(JENIS_NOTA, 20_000, np.random.default_rng(1))
    assert menit.max() <= 23 * 60 + 49
    _, jumlah = np.unique(menit, return_counts=True)
    assert jumlah.max() < 100


@pytest.fixture(scope="module")
def warung():
    with mesin().connect() as kon:
        t = kon.begin()
        try:
            if kon.execute(text("SELECT 1 FROM usaha WHERE email = :e"), {"e": EMAIL}).first():
                pytest.skip("Warung Madura sudah terpasang di basis data ini.")
            if kon.execute(text("SELECT count(*) FROM transaksi WHERE nomor_struk ~ :p"), {"p": POLA_NOTA}).scalar():
                pytest.skip("Basis data berisi data simulasi; geseran akan menyentuh semuanya.")
            kon.execute(text("DELETE FROM geseran_tanggal"))
            kosong = '{"pergerakan": "{}", "produksi": "{}", "penjualan": "{}", "pembeli": "{}", "pesanan": "{}", "permintaan_harian": "{}"}'
            kon.execute(
                text(
                    "INSERT INTO geseran_tanggal (id, hari, akhir_data, id_simulasi, diperbarui_pada) "
                    "VALUES (1, :h, :a, CAST(:i AS jsonb), :k)"
                ),
                {"h": GESER, "a": AKHIR_BARU, "i": kosong, "k": datetime.now(timezone.utc)},
            )
            lama = {
                "distributor": set(kon.execute(text("SELECT id FROM distributor")).scalars()),
                "pesanan": kon.execute(text("SELECT count(*) FROM pesanan")).scalar_one(),
            }
            jumlah = bangkitkan(kon)
            yield kon, jumlah, jumlah["usaha_id"], lama
        finally:
            t.rollback()


def test_barang_dan_akun(warung):
    kon, _, u, _lama = warung
    assert kon.execute(text("SELECT jenis_usaha::text FROM usaha WHERE id = :u"), {"u": u}).scalar_one() == "warung-kelontong"
    baris = kon.execute(text("SELECT nama, kategori, satuan, hari_kirim, batas_aman FROM barang WHERE usaha_id = :u"), {"u": u}).all()
    assert len(baris) == len(BARANG)
    assert {b.kategori for b in baris} == set(KATEGORI_KELONTONG)
    assert all(b.satuan == "pcs" and 1 <= b.hari_kirim <= 3 and b.batas_aman >= 1 for b in baris)
    # Masuk lewat akun simulasi, tanpa akun kasir: Portal POS tetap milik Kopi Kita.
    peran = kon.execute(
        text("SELECT p.email, k.peran::text FROM keanggotaan k JOIN pengguna p ON p.id = k.pengguna_id WHERE k.usaha_id = :u"),
        {"u": u},
    ).all()
    assert [tuple(x) for x in peran] == [(EMAIL, "pemilik")]


def test_buku_besar_cocok(warung):
    kon, _, u, _lama = warung
    p = {"u": u}
    beda = kon.execute(
        text(
            """
            SELECT count(*) FROM barang b
             WHERE b.usaha_id = :u
               AND abs(b.stok - (SELECT sum(g.jumlah) FROM pergerakan g WHERE g.barang_id = b.id)) > 0.001
            """
        ),
        p,
    ).scalar_one()
    assert beda == 0
    # Baris terakhir menurut waktu memuat saldo akhir: riwayat stok di layar tidak melompat mundur.
    beda = kon.execute(
        text(
            """
            SELECT count(*) FROM barang b
              JOIN LATERAL (SELECT stok_sesudah FROM pergerakan g WHERE g.barang_id = b.id
                             ORDER BY waktu DESC, id DESC LIMIT 1) t ON true
             WHERE b.usaha_id = :u AND abs(b.stok - t.stok_sesudah) > 0.001
            """
        ),
        p,
    ).scalar_one()
    assert beda == 0
    negatif = kon.execute(
        text("SELECT count(*) FROM pergerakan WHERE usaha_id = :u AND stok_sesudah < 0"), p
    ).scalar_one()
    assert negatif == 0


def test_nota_sama_dengan_penjualan_dan_permintaan(warung):
    kon, _, u, _lama = warung
    p = {"u": u}
    beda_nota = kon.execute(
        text(
            """
            WITH nota AS (
                SELECT b.id AS barang_id, (t.waktu AT TIME ZONE 'UTC')::date AS tanggal, sum(tb.jumlah) AS jumlah
                  FROM transaksi_baris tb
                  JOIN transaksi t ON t.id = tb.transaksi_id
                  JOIN barang b ON b.usaha_id = t.usaha_id AND b.nama = tb.nama_menu
                 WHERE t.usaha_id = :u
                 GROUP BY 1, 2
            ), buku AS (
                SELECT barang_id, (waktu AT TIME ZONE 'UTC')::date AS tanggal, sum(-jumlah) AS jumlah
                  FROM pergerakan WHERE usaha_id = :u AND jenis = 'terjual'
                 GROUP BY 1, 2
            )
            SELECT count(*) FROM nota n FULL OUTER JOIN buku l USING (barang_id, tanggal)
             WHERE abs(coalesce(n.jumlah, 0) - coalesce(l.jumlah, 0)) > 0.001
            """
        ),
        p,
    ).scalar_one()
    assert beda_nota == 0
    # Setiap barang punya baris permintaan untuk setiap hari, jadi Mesin 1 tidak melihat lubang.
    per_barang = kon.execute(
        text("SELECT count(*), min(tanggal), max(tanggal) FROM permintaan_harian WHERE usaha_id = :u GROUP BY barang_id"), p
    ).all()
    assert len(per_barang) == len(BARANG)
    assert {tuple(x) for x in per_barang} == {
        (HARI_SIMULASI, AKHIR_BARU - timedelta(days=HARI_SIMULASI - 1), AKHIR_BARU)
    }
    # Stok habis ada, tetapi tidak mendominasi.
    habis = kon.execute(
        text("SELECT avg((stok_habis)::int) FROM permintaan_harian WHERE usaha_id = :u"), p
    ).scalar_one()
    assert 0 < habis < 0.10


def test_nota_24_jam_dengan_puncak_malam(warung):
    kon, _, u, _lama = warung
    per_jam = dict(
        kon.execute(
            text(
                """
                SELECT extract(hour FROM waktu AT TIME ZONE 'UTC')::int, count(*)
                  FROM transaksi WHERE usaha_id = :u GROUP BY 1
                """
            ),
            {"u": u},
        ).all()
    )
    assert set(per_jam) == set(range(24))
    malam = sum(per_jam[j] for j in (19, 20, 21, 22))
    dini = sum(per_jam[j] for j in (3, 4, 5, 6))
    assert malam > dini * 2
    assert max(per_jam, key=per_jam.get) in (19, 20, 21, 22)
    # Nota lebih dulu daripada baris buku besar hariannya.
    assert kon.execute(
        text("SELECT max((waktu AT TIME ZONE 'UTC')::time) FROM transaksi WHERE usaha_id = :u"), {"u": u}
    ).scalar_one().strftime("%H:%M") < "23:50"
    # Omset dan jumlah nota sewajarnya warung madura yang ramai.
    nota_per_hari = sum(per_jam.values()) / HARI_SIMULASI
    assert 100 < nota_per_hari < 600
    omset = kon.execute(
        text(
            """
            SELECT sum(tb.jumlah * tb.harga_jual_satuan) FROM transaksi_baris tb
              JOIN transaksi t ON t.id = tb.transaksi_id WHERE t.usaha_id = :u
            """
        ),
        {"u": u},
    ).scalar_one()
    assert 3_000_000 < float(omset) / HARI_SIMULASI < 15_000_000


def test_data_lain_tidak_tersentuh(warung):
    kon, _, u, lama = warung
    baru = {r[0] for r in kon.execute(text("SELECT id FROM distributor WHERE nama = ANY(:n)"), {"n": [d.nama for d in DISTRIBUTOR_BARU]})}
    assert len(baru) == len(DISTRIBUTOR_BARU) and not baru & lama["distributor"]
    # Semua pesanan, ulasan, dan fitur Mesin 2 jatuh ke distributor baru.
    for tabel in ("pesanan", "ulasan", "fitur_pesanan"):
        tujuan = {r[0] for r in kon.execute(text(f"SELECT DISTINCT distributor_id FROM {tabel} WHERE usaha_id = :u"), {"u": u})}
        assert tujuan and tujuan <= baru, tabel
    # Tiap distributor baru benar-benar dapat pesanan, jadi Mesin 2 punya bahan belajar.
    per = kon.execute(
        text("SELECT distributor_id, count(*) FROM fitur_pesanan WHERE usaha_id = :u GROUP BY 1"), {"u": u}
    ).all()
    assert len(per) == len(baru) and min(n for _, n in per) >= 20
    # Yang murah tapi sering telat memang lebih sering gagal daripada grosir yang andal.
    sukses = dict(
        kon.execute(
            text(
                """
                SELECT d.nama, avg(f.sukses::int)::float FROM fitur_pesanan f JOIN distributor d ON d.id = f.distributor_id
                 WHERE f.usaha_id = :u GROUP BY 1
                """
            ),
            {"u": u},
        ).all()
    )
    assert sukses["Agen Kelontong Sentosa"] < sukses["Grosir Sembako Makmur"]
    # Barangnya produk baru: tidak ada usaha lain yang memegangnya.
    lain = kon.execute(
        text(
            """
            SELECT count(*) FROM barang b JOIN produk_master pm ON pm.id = b.produk_master_id
             WHERE b.usaha_id <> :u AND pm.nama_kanonik = ANY(:n)
            """
        ),
        {"u": u, "n": [b.nama for b in BARANG]},
    ).scalar_one()
    assert lain == 0


def test_jejak_pesanan_urut_dari_masuk_sampai_tiba(warung):
    kon, _, u, _lama = warung
    urutan = kon.execute(
        text(
            """
            SELECT count(*), count(*) FILTER (WHERE masuk < siap AND siap < berangkat AND berangkat < tiba)
              FROM (SELECT min(j.waktu) FILTER (WHERE j.status = 'menunggu-konfirmasi') AS masuk,
                           min(j.waktu) FILTER (WHERE j.status = 'disiapkan') AS siap,
                           min(j.waktu) FILTER (WHERE j.status = 'dikirim') AS berangkat,
                           min(j.waktu) FILTER (WHERE j.status IN ('selesai', 'selesai-catatan')) AS tiba
                      FROM pesanan p JOIN pesanan_jejak j ON j.pesanan_id = p.id
                     WHERE p.usaha_id = :u AND p.status IN ('selesai', 'selesai-catatan')
                     GROUP BY p.id) s
            """
        ),
        {"u": u},
    ).one()
    assert urutan[0] > 0 and urutan[0] == urutan[1]


def test_tanggal_sejajar_dan_ikut_geseran_berikutnya(warung):
    """Dijalankan terakhir di urutan berkas: geserannya mengubah tanggal barisnya."""
    kon, jumlah, u, _lama = warung
    p = {"u": u}
    # Sejajar dengan akhir data yang sudah digeser, dan nomornya mengikuti.
    akhir = kon.execute(text("SELECT max((waktu AT TIME ZONE 'UTC')::date) FROM transaksi WHERE usaha_id = :u"), p).scalar_one()
    assert akhir == AKHIR_BARU
    beda = kon.execute(
        text(
            """
            SELECT count(*) FROM transaksi WHERE usaha_id = :u
               AND left(nomor_struk, 8) <> to_char((waktu AT TIME ZONE 'UTC')::date, 'YYYYMMDD')
            """
        ),
        p,
    ).scalar_one()
    assert beda == 0
    assert kon.execute(
        text("SELECT count(*) FROM transaksi WHERE usaha_id = :u AND nomor_struk !~ :pola"), {"u": u, "pola": POLA_NOTA}
    ).scalar_one() == 0
    beda = kon.execute(
        text(
            """
            SELECT count(*) FROM pesanan WHERE usaha_id = :u
               AND substr(nomor, 4, 6) <> to_char((dibuat_pada AT TIME ZONE 'UTC')::date, 'YYMMDD')
            """
        ),
        p,
    ).scalar_one()
    assert beda == 0

    ids = kon.execute(text("SELECT id_simulasi FROM geseran_tanggal WHERE id = 1")).scalar_one()
    assert ids["pergerakan"] != "{}" and ids["pesanan"] != "{}" and ids["permintaan_harian"] != "{}"

    # Geseran tujuh hari berikutnya memindahkan semuanya, tanpa mengubah jumlah.
    sebelum = kon.execute(
        text("SELECT sum(jumlah), count(*) FROM permintaan_harian WHERE usaha_id = :u"), p
    ).one()
    hasil = geser(kon, AKHIR_BARU + timedelta(days=TUJUH))
    assert hasil["hari"] == TUJUH
    akhir_baru = AKHIR_BARU + timedelta(days=TUJUH)
    assert kon.execute(text("SELECT max(tanggal) FROM permintaan_harian WHERE usaha_id = :u"), p).scalar_one() == akhir_baru
    assert kon.execute(
        text("SELECT max((waktu AT TIME ZONE 'UTC')::date) FROM transaksi WHERE usaha_id = :u"), p
    ).scalar_one() == akhir_baru
    assert kon.execute(
        text("SELECT max((waktu AT TIME ZONE 'UTC')::date) FROM pergerakan WHERE usaha_id = :u"), p
    ).scalar_one() == akhir_baru
    assert tuple(
        kon.execute(text("SELECT sum(jumlah), count(*) FROM permintaan_harian WHERE usaha_id = :u"), p).one()
    ) == tuple(sebelum)
    assert kon.execute(
        text(
            """
            SELECT count(*) FROM pesanan WHERE usaha_id = :u
               AND substr(nomor, 4, 6) <> to_char((dibuat_pada AT TIME ZONE 'UTC')::date, 'YYMMDD')
               AND dibuat_pada < now() - interval '1 day'
            """
        ),
        p,
    ).scalar_one() == 0


def test_bisa_dihapus_bersih(warung):
    """Dasar `--ulang`: warungnya hilang tanpa sisa, distributor dan penawarannya tetap."""
    kon, _, u, _lama = warung
    assert _hapus_lama(kon) is True
    assert kon.execute(text("SELECT count(*) FROM usaha WHERE id = :u"), {"u": u}).scalar_one() == 0
    assert kon.execute(text("SELECT count(*) FROM pengguna WHERE email = :e"), {"e": EMAIL}).scalar_one() == 0
    for tabel in ("barang", "pergerakan", "transaksi", "pesanan", "permintaan_harian", "fitur_pesanan", "ulasan"):
        assert kon.execute(text(f"SELECT count(*) FROM {tabel} WHERE usaha_id = :u"), {"u": u}).scalar_one() == 0, tabel
    assert kon.execute(
        text("SELECT count(*) FROM distributor WHERE nama = ANY(:n)"), {"n": [d.nama for d in DISTRIBUTOR_BARU]}
    ).scalar_one() == len(DISTRIBUTOR_BARU)
