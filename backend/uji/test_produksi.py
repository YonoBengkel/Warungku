"""
Uji jalur tulis UMKM produsen: catat produksi dan catat kiriman ke pembeli.

Yang dijaga:

1. **Produksi memotong bahan sesuai resep** dan menambah stok barang jadi,
   dengan buku besar tetap sama dengan stok, dan setiap baris bahan tertaut
   ke sesi produksinya.
2. **Bahan yang tidak cukup menolak produksi seluruhnya**; tidak ada bahan
   yang terpotong sebagian.
3. **Kiriman mengurangi stok barang jadi** dan ditolak kalau stoknya kurang.
4. Usaha lain tidak bisa membaca atau menulis produksi usaha ini.

Seperti uji lain, uji ini membuat datanya sendiri lalu menghapusnya.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from api.otentikasi import acak_kata_sandi
from api.utama import app
from warungku.basis_data import mesin
from warungku.enum import CaraHitungStok, JenisUsaha, PeranPengguna, StatusVerifikasi, SumberBatasAman
from warungku.model import Barang, Keanggotaan, Pembeli, Pengguna, ProdukJadi, ResepBahan, Usaha

SANDI = "ujiproduksi123"


@pytest.fixture
def dapur():
    t = int(datetime.now(timezone.utc).timestamp() * 1000)
    with Session(mesin()) as sesi:
        u = Usaha(
            nama=f"Dapur Uji {t}", jenis_usaha=JenisUsaha.PRODUKSI_MAKANAN, nama_pemilik="Penguji",
            alamat="Jl. Uji No.3", kota="Sleman", nomor_hp="080000000003", cara_hitung=CaraHitungStok.RACIKAN,
            verifikasi=StatusVerifikasi.MENUNGGU, bergabung_sejak=date.today(),
        )
        sesi.add(u)
        sesi.flush()
        pemilik = Pengguna(
            nomor_hp="08966%07d" % (t % 10_000_000), email=f"uji-produksi-{t}@contoh.id",
            kata_sandi_hash=acak_kata_sandi(SANDI), nama="Pemilik Uji",
        )
        sesi.add(pemilik)
        sesi.flush()
        sesi.add(Keanggotaan(pengguna_id=pemilik.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK))

        def bahan(nama: str, satuan: str, stok: str) -> Barang:
            b = Barang(
                usaha_id=u.id, nama=nama, kategori="Bahan Makanan", kode_barang=nama[:3].upper(), satuan=satuan,
                stok=Decimal(stok), sumber_batas_aman=SumberBatasAman.SENDIRI,
            )
            sesi.add(b)
            sesi.flush()
            return b

        cabai = bahan("Cabai Uji", "gram", "1000")
        toples = bahan("Toples Uji", "pcs", "10")
        pj = ProdukJadi(usaha_id=u.id, nama="Sambal Uji", satuan="toples", harga_jual=20_000)
        sesi.add(pj)
        sesi.flush()
        sesi.add(ResepBahan(produk_jadi_id=pj.id, barang_id=cabai.id, takaran=Decimal("100")))
        sesi.add(ResepBahan(produk_jadi_id=pj.id, barang_id=toples.id, takaran=Decimal("1")))
        pb = Pembeli(usaha_id=u.id, nama="Ritel Uji", jenis="ritel-modern")
        sesi.add(pb)
        sesi.commit()
        ids = {"usaha": u.id, "pengguna": pemilik.id, "email": pemilik.email, "cabai": cabai.id,
               "toples": toples.id, "produk": pj.id, "pembeli": pb.id}

    klien = TestClient(app)
    r = klien.post("/auth/umkm/masuk", json={"email": ids["email"], "kata_sandi": SANDI})
    assert r.status_code == 200, r.text
    ids["kepala"] = {"Authorization": "Bearer " + r.json()["token"]}
    ids["klien"] = klien
    yield ids

    with mesin().begin() as kon:
        u = ids["usaha"]
        for sql in (
            "DELETE FROM pergerakan WHERE usaha_id = :u",
            "DELETE FROM permintaan_harian WHERE usaha_id = :u",
            "DELETE FROM penjualan_baris WHERE penjualan_id IN (SELECT id FROM penjualan WHERE usaha_id = :u)",
            "DELETE FROM penjualan WHERE usaha_id = :u",
            "DELETE FROM pembeli WHERE usaha_id = :u",
            "DELETE FROM produksi WHERE usaha_id = :u",
            "DELETE FROM resep_bahan WHERE produk_jadi_id IN (SELECT id FROM produk_jadi WHERE usaha_id = :u)",
            "DELETE FROM produk_jadi WHERE usaha_id = :u",
            "DELETE FROM barang WHERE usaha_id = :u",
            "DELETE FROM keanggotaan WHERE usaha_id = :u",
            "DELETE FROM usaha WHERE id = :u",
        ):
            kon.execute(text(sql), {"u": u})
        kon.execute(text("DELETE FROM pengguna WHERE id = :p"), {"p": ids["pengguna"]})


def _stok(tabel: str, i: int) -> Decimal:
    with mesin().connect() as kon:
        return Decimal(kon.execute(text(f"SELECT stok FROM {tabel} WHERE id = :i"), {"i": i}).scalar_one())


def test_produksi_memotong_bahan_sesuai_resep(dapur):
    k, u = dapur["klien"], dapur["usaha"]
    r = k.post(f"/usaha/{u}/produksi", json={"produk_jadi_id": dapur["produk"], "jumlah": "4"}, headers=dapur["kepala"])
    assert r.status_code == 201, r.text
    assert _stok("barang", dapur["cabai"]) == Decimal("600")
    assert _stok("barang", dapur["toples"]) == Decimal("6")
    assert _stok("produk_jadi", dapur["produk"]) == Decimal("4")
    with mesin().connect() as kon:
        baris = kon.execute(
            text("SELECT jenis, jumlah, produksi_id FROM pergerakan WHERE usaha_id = :u ORDER BY barang_id"), {"u": u}
        ).all()
    assert [(j, Decimal(n)) for j, n, _ in baris] == [("terjual", Decimal("-400")), ("terjual", Decimal("-4"))]
    assert all(p == r.json()["id"] for _, _, p in baris)

    ringkas = k.get(f"/usaha/{u}/produksi/ringkasan", headers=dapur["kepala"]).json()
    produk = ringkas["produk"][0]
    # Sisa cabai 600 g / 100 g = 6 toples, sisa toples 6: keduanya membatasi di 6.
    assert produk["bisa_dibuat"] == 6
    assert [b["cukup_untuk"] for b in produk["resep"]] == [6, 6]


def test_sesi_masak_menambah_permintaan_untuk_mesin1(dapur):
    """Bahan yang dipakai memasak adalah permintaan, sama seperti nota kasir dan pemakaian manual."""
    k, u, kepala = dapur["klien"], dapur["usaha"], dapur["kepala"]
    for _ in range(2):  # Dua sesi sehari menjumlah di baris hari yang sama.
        r = k.post(f"/usaha/{u}/produksi", json={"produk_jadi_id": dapur["produk"], "jumlah": "2"}, headers=kepala)
        assert r.status_code == 201, r.text
    with mesin().connect() as kon:
        baris = kon.execute(
            text("SELECT barang_id, jumlah FROM permintaan_harian WHERE usaha_id = :u"), {"u": u}
        ).all()
    jumlah = {b: Decimal(n) for b, n in baris}
    assert jumlah == {dapur["cabai"]: Decimal("400"), dapur["toples"]: Decimal("4")}


def test_usaha_selain_produsen_memakai_alur_yang_sama(dapur):
    """Tab Produksi berlaku untuk semua UMKM: warung makan pun bisa menambah pembeli, memasak, dan mengirim."""
    k, u, kepala = dapur["klien"], dapur["usaha"], dapur["kepala"]
    assert k.patch(f"/usaha/{u}/profil", json={"jenis_usaha": "warung-makan"}, headers=kepala).status_code == 200
    r = k.post(f"/usaha/{u}/pembeli", json={"nama": "  Katering Bu Sri ", "jenis": "katering", "kota": "Sleman"}, headers=kepala)
    assert r.status_code == 201 and r.json()["nama"] == "Katering Bu Sri", r.text
    pid = r.json()["id"]
    # Nama yang sama, apa pun besar-kecil hurufnya, tidak membuat pembeli kembar.
    r = k.post(f"/usaha/{u}/pembeli", json={"nama": "katering bu sri", "jenis": "warung"}, headers=kepala)
    assert r.status_code == 409
    assert k.post(f"/usaha/{u}/pembeli", json={"nama": "Toko", "jenis": "pasar"}, headers=kepala).status_code == 422
    assert k.post(f"/usaha/{u + 100_000}/pembeli", json={"nama": "Toko", "jenis": "warung"}, headers=kepala).status_code == 403

    r = k.post(f"/usaha/{u}/produksi", json={"produk_jadi_id": dapur["produk"], "jumlah": "1"}, headers=kepala)
    assert r.status_code == 201, r.text
    r = k.post(f"/usaha/{u}/penjualan", headers=kepala,
               json={"pembeli_id": pid, "baris": [{"produk_jadi_id": dapur["produk"], "jumlah": "1"}]})
    assert r.status_code == 201, r.text
    hasil = k.get(f"/usaha/{u}/produksi/ringkasan", headers=kepala).json()
    assert {x["nama"] for x in hasil["pembeli"]} >= {"Katering Bu Sri"}


def test_bahan_kurang_menolak_seluruh_produksi(dapur):
    k, u = dapur["klien"], dapur["usaha"]
    # Toples hanya 10: produksi 11 harus ditolak, dan cabai tidak boleh ikut terpotong.
    r = k.post(f"/usaha/{u}/produksi", json={"produk_jadi_id": dapur["produk"], "jumlah": "11"}, headers=dapur["kepala"])
    assert r.status_code == 409
    assert "Toples Uji" in r.json()["detail"]
    assert _stok("barang", dapur["cabai"]) == Decimal("1000")
    assert _stok("produk_jadi", dapur["produk"]) == Decimal("0")


def test_kiriman_mengurangi_stok_jadi_dan_menolak_kalau_kurang(dapur):
    k, u, kepala = dapur["klien"], dapur["usaha"], dapur["kepala"]
    k.post(f"/usaha/{u}/produksi", json={"produk_jadi_id": dapur["produk"], "jumlah": "5"}, headers=kepala)
    r = k.post(
        f"/usaha/{u}/penjualan",
        json={"pembeli_id": dapur["pembeli"], "baris": [{"produk_jadi_id": dapur["produk"], "jumlah": "3"}]},
        headers=kepala,
    )
    assert r.status_code == 201, r.text
    assert r.json()["total"] == 60_000
    assert _stok("produk_jadi", dapur["produk"]) == Decimal("2")

    r = k.post(
        f"/usaha/{u}/penjualan",
        json={"pembeli_id": dapur["pembeli"], "baris": [{"produk_jadi_id": dapur["produk"], "jumlah": "3"}]},
        headers=kepala,
    )
    assert r.status_code == 409
    assert _stok("produk_jadi", dapur["produk"]) == Decimal("2")
    assert len(k.get(f"/usaha/{u}/penjualan", headers=kepala).json()) == 1


def test_usaha_lain_ditolak(dapur):
    k = dapur["klien"]
    lain = dapur["usaha"] + 100_000
    assert k.get(f"/usaha/{lain}/produksi/ringkasan", headers=dapur["kepala"]).status_code == 403
    r = k.post(f"/usaha/{lain}/produksi", json={"produk_jadi_id": dapur["produk"], "jumlah": "1"}, headers=dapur["kepala"])
    assert r.status_code == 403


def test_produk_jadi_baru_tersimpan_dengan_komposisi(dapur):
    """Tab Menu (revisi V7, Q165): Bu Ratmi menambah produk jadi baru beserta komposisinya sekaligus."""
    k, u, kepala = dapur["klien"], dapur["usaha"], dapur["kepala"]
    r = k.post(
        f"/usaha/{u}/produk-jadi",
        json={
            "nama": "Sambal Teri Uji",
            "satuan": "toples",
            "isi_bersih": "150 g",
            "harga_jual": 25_000,
            "batas_aman": "5",
            "ukuran_sesi": 30,
            "bahan": [{"barang_id": dapur["cabai"], "takaran": "80"}, {"barang_id": dapur["toples"], "takaran": "1"}],
        },
        headers=kepala,
    )
    assert r.status_code == 201, r.text
    hasil = r.json()
    assert hasil["nama"] == "Sambal Teri Uji"
    assert hasil["harga_jual"] == 25_000
    assert {b["barang_id"]: Decimal(b["takaran"]) for b in hasil["resep"]} == {dapur["cabai"]: Decimal("80"), dapur["toples"]: Decimal("1")}
    # Dengan resepnya terpasang, produk baru ini langsung bisa dimasak.
    r2 = k.post(f"/usaha/{u}/produksi", json={"produk_jadi_id": hasil["id"], "jumlah": "1"}, headers=kepala)
    assert r2.status_code == 201, r2.text


def test_produk_jadi_dicocokkan_dari_nama_dan_komposisi_ditimpa(dapur):
    """Nama yang sama (apa pun besar-kecil hurufnya) mengubah produk yang sudah ada, bukan membuat duplikat."""
    k, u, kepala = dapur["klien"], dapur["usaha"], dapur["kepala"]
    with mesin().begin() as kon:
        kon.execute(text("UPDATE produk_jadi SET batas_aman = 7, ukuran_sesi = 25 WHERE id = :p"), {"p": dapur["produk"]})
    r = k.post(
        f"/usaha/{u}/produk-jadi",
        json={
            "nama": "sambal uji",  # nama produk yang sudah ada di fixture `dapur`, huruf kecil semua
            "satuan": "toples",
            "harga_jual": 22_000,
            "bahan": [{"barang_id": dapur["toples"], "takaran": "1"}],
        },
        headers=kepala,
    )
    assert r.status_code == 201, r.text
    hasil = r.json()
    assert hasil["id"] == dapur["produk"]
    assert hasil["harga_jual"] == 22_000
    # Cabai dibuang dari komposisi, bukan ditambah di sampingnya.
    assert [b["barang_id"] for b in hasil["resep"]] == [dapur["toples"]]
    # Layar Menu tidak mengirim batas aman dan ukuran sesi, jadi nilai lamanya tetap (audit 3 Nov 2026).
    assert Decimal(hasil["batas_aman"]) == 7 and hasil["ukuran_sesi"] == 25


def test_produk_jadi_bahan_dicatat_manual_ditolak(dapur):
    k, u, kepala = dapur["klien"], dapur["usaha"], dapur["kepala"]
    with Session(mesin()) as sesi:
        manual = Barang(
            usaha_id=u, nama="Tisu Uji", kategori="Lain", kode_barang="TSU", satuan="pak",
            stok=Decimal("10"), sumber_batas_aman=SumberBatasAman.SENDIRI, dicatat_manual=True,
        )
        sesi.add(manual)
        sesi.commit()
        sesi.refresh(manual)
    r = k.post(
        f"/usaha/{u}/produk-jadi",
        json={"nama": "Produk Uji Manual", "satuan": "pcs", "harga_jual": 1000, "bahan": [{"barang_id": manual.id, "takaran": "1"}]},
        headers=kepala,
    )
    assert r.status_code == 422
    assert "dicatat manual" in r.json()["detail"]
