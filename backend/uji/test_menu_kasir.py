"""
Uji resep menu kasir: menu yang belum dipasangkan, resep berbilang bahan, dan
janji "hanya berlaku ke depan".

Yang paling mahal kalau salah adalah janji itu. Layar pemasangan menulis
terang-terangan bahwa penjualan yang sudah lewat tidak ditarik ulang; kalau
server diam-diam memotong stok mundur, angka yang sudah dikoreksi pemilik
usaha ikut berubah tanpa ia tahu sebabnya.

Seperti `test_struk.py`, uji ini membuat usaha dan barangnya sendiri lalu
menghapusnya lagi, dan tidak bergantung pada isi basis data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from api.otentikasi import acak_kata_sandi
from api.utama import app
from warungku.basis_data import mesin
from warungku.enum import CaraHitungStok, JenisUsaha, PeranPengguna, StatusVerifikasi, SumberBatasAman
from warungku.model import Barang, Keanggotaan, Pengguna, Usaha

SANDI_UJI = "ujimenu1234"


@pytest.fixture
def kedai():
    """Satu kedai dengan tiga bahan (satu dicatat manual) dan tanpa pemetaan menu."""
    cap = int(datetime.now(timezone.utc).timestamp() * 1000)
    with Session(mesin()) as sesi:
        u = Usaha(
            nama="Kedai Uji Resep",
            jenis_usaha=JenisUsaha.KEDAI_KOPI,
            nama_pemilik="Penguji",
            alamat="Jl. Uji No.2",
            kota="Yogyakarta",
            nomor_hp="080000000001",
            cara_hitung=CaraHitungStok.KEDUANYA,
            verifikasi=StatusVerifikasi.MENUNGGU,
            bergabung_sejak=datetime.now(timezone.utc).date(),
        )
        sesi.add(u)
        sesi.flush()
        email = "uji-menu-%d@contoh.id" % cap
        pemilik = Pengguna(
            nomor_hp="08988%07d" % (cap % 10_000_000),
            email=email,
            kata_sandi_hash=acak_kata_sandi(SANDI_UJI),
            nama="Pemilik Uji Resep",
        )
        sesi.add(pemilik)
        sesi.flush()
        sesi.add(Keanggotaan(pengguna_id=pemilik.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK))

        def barang(nama: str, satuan: str, stok: str, manual: bool = False) -> Barang:
            b = Barang(
                usaha_id=u.id,
                nama=nama,
                kategori="Uji",
                kode_barang="UJI%s" % nama[:3].upper(),
                satuan=satuan,
                stok=Decimal(stok),
                batas_aman=Decimal("10.000"),
                sumber_batas_aman=SumberBatasAman.SENDIRI,
                terhubung_kasir=False,
                dicatat_manual=manual,
            )
            sesi.add(b)
            sesi.flush()
            return b

        kopi = barang("Biji Kopi Uji", "gram", "1000.000")
        susu = barang("Susu Uji", "ml", "5000.000")
        tisu = barang("Tisu Uji", "pcs", "100.000", manual=True)
        sesi.commit()
        ids = {"usaha": u.id, "kopi": kopi.id, "susu": susu.id, "tisu": tisu.id, "pemilik": pemilik.id}

    klien = TestClient(app)
    masuk = klien.post("/auth/umkm/masuk", json={"email": email, "kata_sandi": SANDI_UJI})
    assert masuk.status_code == 200, masuk.text
    kepala = {"Authorization": "Bearer " + masuk.json()["token"]}

    yield ids, kepala, klien

    u = {"u": ids["usaha"]}
    with mesin().begin() as kon:
        kon.execute(text("DELETE FROM pergerakan WHERE usaha_id = :u"), u)
        kon.execute(text("DELETE FROM permintaan_harian WHERE usaha_id = :u"), u)
        kon.execute(
            text("DELETE FROM transaksi_baris WHERE transaksi_id IN (SELECT id FROM transaksi WHERE usaha_id = :u)"), u
        )
        kon.execute(text("DELETE FROM transaksi WHERE usaha_id = :u"), u)
        kon.execute(
            text(
                "DELETE FROM pemetaan_menu_bahan WHERE pemetaan_id IN "
                "(SELECT id FROM pemetaan_menu WHERE usaha_id = :u)"
            ),
            u,
        )
        kon.execute(text("DELETE FROM pemetaan_menu WHERE usaha_id = :u"), u)
        kon.execute(text("DELETE FROM barang WHERE usaha_id = :u"), u)
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), u)
        kon.execute(text("DELETE FROM usaha WHERE id = :u"), u)
        kon.execute(text("DELETE FROM pengguna WHERE id = :p"), {"p": ids["pemilik"]})


def _nota(nomor: str, menu: str, jumlah: int, waktu: str = "2026-10-05T13:30:00+00:00") -> dict:
    return {
        "nomor_struk": nomor,
        "waktu": waktu,
        "kasir": "Kasir Uji",
        "sumber": "pos",
        "baris": [{"nama_menu": menu, "jumlah": jumlah, "satuan": "gelas", "harga_jual_satuan": 20000}],
    }


def _stok(barang_id: int) -> Decimal:
    with mesin().connect() as kon:
        return kon.execute(text("SELECT stok FROM barang WHERE id = :b"), {"b": barang_id}).scalar_one()


def test_menu_tanpa_bahan_muncul_dengan_jumlah_dan_sejak(kedai):
    ids, kepala, klien = kedai
    u = ids["usaha"]
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("M-1", "Kopi Susu Pandan", 3, "2026-10-03T03:00:00+00:00"))
    # Ejaan berbeda di nota lain tetap satu menu: dikenali tanpa peduli huruf besar dan spasi tepi.
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("M-2", " kopi susu pandan ", 2, "2026-10-04T03:00:00+00:00"))

    r = klien.get(f"/usaha/{u}/menu-kasir", headers=kepala)
    assert r.status_code == 200, r.text
    isi = r.json()
    assert len(isi["belum_dipasangkan"]) == 1
    m = isi["belum_dipasangkan"][0]
    assert Decimal(m["jumlah_terjual"]) == 5
    assert m["sejak"].startswith("2026-10-03")
    assert isi["resep"] == []
    assert isi["nota_terakhir"].startswith("2026-10-04")


def test_resep_memotong_banyak_bahan_hanya_untuk_nota_berikutnya(kedai):
    ids, kepala, klien = kedai
    u = ids["usaha"]
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("R-1", "Es Kopi Susu", 4))

    r = klien.put(
        f"/usaha/{u}/menu-kasir",
        headers=kepala,
        json={
            "nama_menu": "Es Kopi Susu",
            "bahan": [{"barang_id": ids["kopi"], "takaran": 18}, {"barang_id": ids["susu"], "takaran": 150}],
        },
    )
    assert r.status_code == 200, r.text
    resep = r.json()
    assert [b["nama"] for b in resep["bahan"]] == ["Biji Kopi Uji", "Susu Uji"]
    assert resep["langsung"] is False

    # Empat gelas yang terjual sebelum resep ada TIDAK ditarik ulang.
    assert _stok(ids["kopi"]) == Decimal("1000.000")
    assert _stok(ids["susu"]) == Decimal("5000.000")

    hasil = klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("R-2", "es kopi susu", 2)).json()
    assert hasil["tak_dikenali"] == []
    assert _stok(ids["kopi"]) == Decimal("964.000")  # 1000 - 2 x 18
    assert _stok(ids["susu"]) == Decimal("4700.000")  # 5000 - 2 x 150

    isi = klien.get(f"/usaha/{u}/menu-kasir", headers=kepala).json()
    assert isi["belum_dipasangkan"] == []
    assert [m["nama_menu"] for m in isi["resep"]] == ["Es Kopi Susu"]

    with mesin().connect() as kon:
        terhubung = kon.execute(
            text("SELECT bool_and(terhubung_kasir) FROM barang WHERE id IN (:a, :b)"),
            {"a": ids["kopi"], "b": ids["susu"]},
        ).scalar_one()
    assert terhubung is True


def test_simpan_ulang_mengganti_seluruh_bahan(kedai):
    ids, kepala, klien = kedai
    u = ids["usaha"]
    jalur = f"/usaha/{u}/menu-kasir"
    klien.put(jalur, headers=kepala, json={"nama_menu": "Latte", "bahan": [
        {"barang_id": ids["kopi"], "takaran": 18}, {"barang_id": ids["susu"], "takaran": 150}]})
    r = klien.put(jalur, headers=kepala, json={"nama_menu": "LATTE", "bahan": [{"barang_id": ids["susu"], "takaran": 200}]})
    assert r.status_code == 200, r.text
    assert r.json()["nama_menu"] == "Latte"  # ejaan pertama dipertahankan
    assert [(b["nama"], Decimal(b["takaran"])) for b in r.json()["bahan"]] == [("Susu Uji", 200)]

    with mesin().connect() as kon:
        n = kon.execute(
            text("SELECT count(*) FROM pemetaan_menu WHERE usaha_id = :u"), {"u": u}
        ).scalar_one()
    assert n == 1


def test_resep_ditolak_dengan_pesan_yang_bisa_ditindaklanjuti(kedai):
    ids, kepala, klien = kedai
    jalur = f"/usaha/{ids['usaha']}/menu-kasir"

    manual = klien.put(jalur, headers=kepala, json={"nama_menu": "Kopi", "bahan": [{"barang_id": ids["tisu"], "takaran": 1}]})
    assert manual.status_code == 422
    assert "Tisu Uji dicatat manual" in manual.json()["detail"]

    asing = klien.put(jalur, headers=kepala, json={"nama_menu": "Kopi", "bahan": [{"barang_id": 999_999_999, "takaran": 1}]})
    assert asing.status_code == 404

    dobel = klien.put(jalur, headers=kepala, json={"nama_menu": "Kopi", "bahan": [
        {"barang_id": ids["kopi"], "takaran": 1}, {"barang_id": ids["kopi"], "takaran": 2}]})
    assert dobel.status_code == 422

    nol = klien.put(jalur, headers=kepala, json={"nama_menu": "Kopi", "bahan": [{"barang_id": ids["kopi"], "takaran": 0}]})
    assert nol.status_code == 422


def test_nota_terbaru_berurutan_dengan_barisnya(kedai):
    ids, kepala, klien = kedai
    u = ids["usaha"]
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("N-1", "Americano", 1, "2026-10-01T03:00:00+00:00"))
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("N-2", "Latte", 2, "2026-10-02T03:00:00+00:00"))

    r = klien.get(f"/usaha/{u}/transaksi?batas=5", headers=kepala)
    assert r.status_code == 200, r.text
    nota = r.json()
    assert [n["nomor_struk"] for n in nota] == ["N-2", "N-1"]
    assert nota[0]["baris"][0]["nama_menu"] == "Latte"


def _permintaan(barang_id: int) -> list[tuple]:
    with mesin().connect() as kon:
        return [
            (str(r.tanggal), r.jumlah, r.stok_habis)
            for r in kon.execute(
                text("SELECT tanggal, jumlah, stok_habis FROM permintaan_harian WHERE barang_id = :b ORDER BY tanggal"),
                {"b": barang_id},
            )
        ]


def test_penjualan_dari_nota_masuk_permintaan_harian(kedai):
    ids, kepala, klien = kedai
    u = ids["usaha"]
    klien.put(f"/usaha/{u}/menu-kasir", headers=kepala, json={"nama_menu": "Kopi Hitam", "bahan": [
        {"barang_id": ids["kopi"], "takaran": 15}]})
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("P-1", "Kopi Hitam", 2))
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("P-2", "Kopi Hitam", 1))

    # Satu baris per hari, dijumlah: 3 gelas x 15 gram. Tanpa ini penjualan dari
    # kasir tidak pernah sampai ke grafik pemakaian maupun data Mesin 1.
    assert _permintaan(ids["kopi"]) == [("2026-10-05", Decimal("45.000"), False)]


def test_stok_tercatat_kurang_tidak_menolak_nota(kedai):
    ids, kepala, klien = kedai
    u = ids["usaha"]
    klien.put(f"/usaha/{u}/menu-kasir", headers=kepala, json={"nama_menu": "Susu Kopi", "bahan": [
        {"barang_id": ids["kopi"], "takaran": 18}, {"barang_id": ids["susu"], "takaran": 150}]})

    # 40 gelas butuh 6.000 ml susu, padahal tercatat 5.000 ml.
    r = klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("K-1", "Susu Kopi", 40))
    assert r.status_code == 200, r.text
    assert r.json()["stok_kurang"] == ["Susu Uji"]

    assert _stok(ids["susu"]) == Decimal("0.000")
    assert _stok(ids["kopi"]) == Decimal("280.000")  # 1000 - 40 x 18, tidak terpengaruh
    # Hari itu tersensor: yang tercatat hanya yang bisa dipotong.
    assert _permintaan(ids["susu"]) == [("2026-10-05", Decimal("5000.000"), True)]

    # Stok yang sudah nol tidak menulis pergerakan nol, tapi harinya tetap tersensor.
    r2 = klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("K-2", "Susu Kopi", 1)).json()
    assert r2["stok_kurang"] == ["Susu Uji"]
    with mesin().connect() as kon:
        n = kon.execute(
            text("SELECT count(*) FROM pergerakan WHERE barang_id = :b"), {"b": ids["susu"]}
        ).scalar_one()
    assert n == 1
