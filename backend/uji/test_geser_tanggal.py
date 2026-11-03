"""
Uji geser tanggal data simulasi (revisi V8, Q180).

Nota simulasi harus pindah kelipatan 7 hari bersama tanggal di nomornya, nota Portal
POS tidak boleh pindah, dan bagian nota sungguhan di `permintaan_harian` tetap di
tanggalnya walau barisnya bercampur dengan data simulasi.

Semuanya dikerjakan di satu transaksi yang dibatalkan di akhir, jadi basis datanya
tidak berubah. Dilewati di basis data yang berisi data simulasi penuh: geseran
menyentuh seluruh data simulasi, dan uji tidak boleh mengunci atau bergantung padanya.

    python -m pytest uji -q
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from dataset.geser_tanggal import POLA_NOTA, geser
from warungku.basis_data import mesin
from warungku.enum import CaraHitungStok, JenisUsaha, StatusVerifikasi, SumberBatasAman

AWAL = date(2026, 9, 22)  # 14 hari data simulasi, sampai 5 Okt 2026
HARI = 14


@pytest.fixture
def kon():
    with mesin().connect() as k:
        t = k.begin()
        try:
            if k.execute(text("SELECT count(*) FROM transaksi WHERE nomor_struk ~ :p"), {"p": POLA_NOTA}).scalar():
                pytest.skip("Basis data berisi data simulasi; geseran akan menyentuh semuanya.")
            yield k
        finally:
            t.rollback()


def _isi(kon) -> tuple[int, int]:
    """Satu kedai dengan 14 hari data simulasi, ditambah satu nota Portal POS pada 20 Okt."""
    kon.execute(text("DELETE FROM geseran_tanggal"))
    u = kon.execute(
        text(
            """
            INSERT INTO usaha (nama, jenis_usaha, nama_pemilik, alamat, kota, nomor_hp, cara_hitung, verifikasi, bergabung_sejak)
            VALUES ('Warung Uji Geser', :j, 'Penguji', 'Jl. Uji', 'Yogyakarta', '080000000901', :c, :v, '2025-01-01')
            RETURNING id
            """
        ),
        {"j": JenisUsaha.KEDAI_KOPI.value, "c": CaraHitungStok.KEMASAN.value, "v": StatusVerifikasi.MENUNGGU.value},
    ).scalar_one()
    b = kon.execute(
        text(
            """
            INSERT INTO barang (usaha_id, nama, kategori, kode_barang, satuan, sumber_batas_aman)
            VALUES (:u, 'Biji Kopi Uji', 'Bahan Baku', 'UJI-GESER', 'gram', :s) RETURNING id
            """
        ),
        {"u": u, "s": SumberBatasAman.SENDIRI.value},
    ).scalar_one()
    for i in range(HARI):
        t = AWAL + timedelta(days=i)
        kon.execute(
            text("INSERT INTO transaksi (usaha_id, nomor_struk, waktu) VALUES (:u, :n, :w)"),
            {"u": u, "n": f"{t:%Y%m%d}-901-001", "w": datetime(t.year, t.month, t.day, 10, tzinfo=timezone.utc)},
        )
        kon.execute(
            text("INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah) VALUES (:u, :b, :t, :n)"),
            {"u": u, "b": b, "t": t, "n": i + 1},
        )
    trx = kon.execute(
        text("INSERT INTO transaksi (usaha_id, nomor_struk, waktu) VALUES (:u, 'POS-UJI-GESER', :w) RETURNING id"),
        {"u": u, "w": datetime(2026, 10, 20, 3, tzinfo=timezone.utc)},
    ).scalar_one()
    kon.execute(
        text(
            """
            INSERT INTO pergerakan (usaha_id, barang_id, waktu, jenis, jumlah, stok_sesudah, transaksi_id)
            VALUES (:u, :b, :w, 'terjual', -2, 0, :t)
            """
        ),
        {"u": u, "b": b, "w": datetime(2026, 10, 20, 3, tzinfo=timezone.utc), "t": trx},
    )
    kon.execute(
        text("INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah) VALUES (:u, :b, '2026-10-20', 2)"),
        {"u": u, "b": b},
    )
    return u, b


def _permintaan(kon, b: int) -> dict[date, float]:
    return {
        t: float(n)
        for t, n in kon.execute(text("SELECT tanggal, jumlah FROM permintaan_harian WHERE barang_id = :b"), {"b": b})
    }


def _nota(kon, u: int) -> list[tuple[str, datetime]]:
    return list(kon.execute(text("SELECT nomor_struk, waktu FROM transaksi WHERE usaha_id = :u ORDER BY waktu"), {"u": u}))


def test_geser_kelipatan_tujuh_dan_nota_sungguhan_tetap(kon):
    u, b = _isi(kon)

    hasil = geser(kon, date(2026, 11, 3))
    assert (hasil["hari"], hasil["akhir"]) == (28, date(2026, 11, 2))
    nota = _nota(kon, u)
    sim = [n for n in nota if n[0] != "POS-UJI-GESER"]
    assert (sim[0][0], sim[-1][0]) == ("20261020-901-001", "20261102-901-001")
    assert sim[-1][1] == datetime(2026, 11, 2, 10, tzinfo=timezone.utc)
    assert ("POS-UJI-GESER", datetime(2026, 10, 20, 3, tzinfo=timezone.utc)) in nota
    ph = _permintaan(kon, b)
    # Data simulasi 22 Sep pindah ke 20 Okt dan bergabung dengan nota sungguhan hari itu.
    assert (min(ph), max(ph), len(ph)) == (date(2026, 10, 20), date(2026, 11, 2), HARI)
    assert ph[date(2026, 10, 20)] == 1 + 2
    assert sum(ph.values()) == sum(range(1, HARI + 1)) + 2

    assert geser(kon, date(2026, 11, 3))["hari"] == 0

    # Seminggu kemudian: bagian simulasi 20 Okt pindah ke 27 Okt, bagian sungguhan tetap.
    assert geser(kon, date(2026, 11, 9))["hari"] == 7
    ph = _permintaan(kon, b)
    assert ph[date(2026, 10, 20)] == 2
    assert ph[date(2026, 10, 27)] == 1
    assert ph[date(2026, 11, 9)] == HARI
    assert sum(ph.values()) == sum(range(1, HARI + 1)) + 2
    assert _nota(kon, u)[-1][0] == "20261109-901-001"
    assert ("POS-UJI-GESER", datetime(2026, 10, 20, 3, tzinfo=timezone.utc)) in _nota(kon, u)
    assert kon.execute(text("SELECT hari, akhir_data FROM geseran_tanggal")).one() == (35, date(2026, 11, 9))
