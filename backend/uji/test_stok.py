"""
Uji tulis stok dari layar (audit 3 Nov 2026): tambah, ubah, koreksi, pemakaian,
batas aman massal, dan ganti kategori. Dulu semuanya hanya mengubah data di
peramban. Selain hasilnya, setiap uji memeriksa invarian buku besar `api.gudang`:
stok barang sama dengan jumlah semua pergerakannya.

Uji membuat usaha, pemilik, dan barangnya sendiri, lalu menghapusnya lagi.

    python -m pytest uji -q
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

SANDI_UJI = "ujistok123"


def _usaha(sesi: Session, akhiran: str) -> tuple[int, str]:
    u = Usaha(
        nama=f"Warung Uji Stok {akhiran}", jenis_usaha=JenisUsaha.KEDAI_KOPI, nama_pemilik="Penguji", alamat="Jl. Uji",
        kota="Yogyakarta", nomor_hp="080000000000", cara_hitung=CaraHitungStok.KEMASAN,
        verifikasi=StatusVerifikasi.MENUNGGU, bergabung_sejak=datetime.now(timezone.utc).date(),
    )
    sesi.add(u)
    sesi.flush()
    cap = int(datetime.now(timezone.utc).timestamp() * 1000)
    email = f"uji-stok-{akhiran}-{cap}@contoh.id"
    p = Pengguna(nomor_hp=f"0897{cap % 100_000_000:08d}", email=email, kata_sandi_hash=acak_kata_sandi(SANDI_UJI), nama="Pemilik Uji Stok")
    sesi.add(p)
    sesi.flush()
    sesi.add(Keanggotaan(pengguna_id=p.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK))
    return u.id, email


@pytest.fixture
def gudang():
    with Session(mesin()) as sesi:
        u1, email1 = _usaha(sesi, "a")
        u2, _ = _usaha(sesi, "b")
        b = Barang(
            usaha_id=u1, nama="Gula Pasir Uji", kategori="Bahan", kode_barang="UJI-GULA", satuan="gram",
            stok=Decimal("1000.000"), batas_aman=Decimal("200.000"), batas_aman_saran=Decimal("350.000"),
            sumber_batas_aman=SumberBatasAman.SENDIRI,
        )
        lain = Barang(
            usaha_id=u2, nama="Barang Usaha Lain", kategori="Bahan", kode_barang="UJI-LAIN", satuan="pcs",
            batas_aman_saran=Decimal("5"), sumber_batas_aman=SumberBatasAman.SENDIRI,
        )
        sesi.add(b)
        sesi.add(lain)
        sesi.commit()
        ids = {"u1": u1, "u2": u2, "barang": b.id, "lain": lain.id}
    klien = TestClient(app)
    masuk = klien.post("/auth/umkm/masuk", json={"email": email1, "kata_sandi": SANDI_UJI})
    assert masuk.status_code == 200, masuk.text
    yield ids, {"Authorization": "Bearer " + masuk.json()["token"]}, klien
    with mesin().begin() as kon:
        for tabel in ("pergerakan", "permintaan_harian"):
            kon.execute(text(f"DELETE FROM {tabel} WHERE usaha_id = ANY(:u)"), {"u": [u1, u2]})
        kon.execute(text("DELETE FROM kemasan WHERE barang_id IN (SELECT id FROM barang WHERE usaha_id = ANY(:u))"), {"u": [u1, u2]})
        kon.execute(text("DELETE FROM barang WHERE usaha_id = ANY(:u)"), {"u": [u1, u2]})
        pengguna = kon.execute(text("SELECT pengguna_id FROM keanggotaan WHERE usaha_id = ANY(:u)"), {"u": [u1, u2]}).scalars().all()
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = ANY(:u)"), {"u": [u1, u2]})
        kon.execute(text("DELETE FROM pengguna WHERE id = ANY(:p)"), {"p": list(pengguna)})
        kon.execute(text("DELETE FROM usaha WHERE id = ANY(:u)"), {"u": [u1, u2]})


def _buku_besar_utuh(barang_id: int) -> bool:
    with mesin().connect() as kon:
        stok, jumlah = kon.execute(
            text("SELECT b.stok, COALESCE((SELECT sum(jumlah) FROM pergerakan WHERE barang_id = b.id), 0) FROM barang b WHERE b.id = :b"),
            {"b": barang_id},
        ).one()
    return Decimal(stok) == Decimal(jumlah)


def _awal_buku_besar(barang_id: int) -> None:
    """Stok awal fixture dicatat sebagai koreksi, supaya invarian berlaku sejak awal."""
    with mesin().begin() as kon:
        kon.execute(
            text(
                "INSERT INTO pergerakan (usaha_id, barang_id, waktu, jenis, jumlah, stok_sesudah) "
                "SELECT usaha_id, id, now(), 'koreksi', stok, stok FROM barang WHERE id = :b"
            ),
            {"b": barang_id},
        )


def test_tambah_barang_mencatat_stok_awal_dan_kemasan(gudang):
    ids, kepala, klien = gudang
    r = klien.post(f"/usaha/{ids['u1']}/barang", headers=kepala, json={
        "nama": "Susu Oat", "kategori": "Susu", "satuan": "ml", "stok_awal": "2000", "batas_aman": "500",
        "nama_lain": ["oat milk", "Oat Milk"], "kemasan": [{"nama": "kotak", "isi": "1000"}],
    })
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["kode_barang"] == f"B{b['id']:05d}"
    assert (Decimal(b["stok"]), b["nama_lain"], b["kemasan"][0]["nama"]) == (Decimal("2000"), ["oat milk"], "kotak")
    assert _buku_besar_utuh(b["id"])
    semua = klien.get(f"/usaha/{ids['u1']}/barang", headers=kepala).json()
    assert any(x["id"] == b["id"] and x["nama"] == "Susu Oat" for x in semua)
    dobel = klien.post(f"/usaha/{ids['u1']}/barang", headers=kepala, json={
        "nama": "Gula Lain", "kategori": "Bahan", "satuan": "gram", "kode_barang": "UJI-GULA", "batas_aman": "1",
    })
    assert dobel.status_code == 409


def test_ubah_barang_tersimpan_dan_satuan_dijaga(gudang):
    ids, kepala, klien = gudang
    url = f"/usaha/{ids['u1']}/barang/{ids['barang']}"
    r = klien.patch(url, headers=kepala, json={
        "nama": "Gula Pasir Putih", "batas_aman": "300", "sumber_batas_aman": "sendiri",
        "kemasan": [{"nama": "karung", "isi": "50000"}], "ingatkan_kedaluwarsa": True, "kedaluwarsa": "2027-01-31",
    })
    assert r.status_code == 200, r.text
    b = next(x for x in klien.get(f"/usaha/{ids['u1']}/barang", headers=kepala).json() if x["id"] == ids["barang"])
    assert (b["nama"], Decimal(b["batas_aman"]), b["kemasan"][0]["nama"], b["kedaluwarsa"]) == (
        "Gula Pasir Putih", Decimal("300"), "karung", "2027-01-31")
    # Tanpa riwayat stok, satuan boleh diganti. Sesudah ada riwayat, tidak.
    assert klien.patch(url, headers=kepala, json={"satuan": "kg"}).status_code == 200
    _awal_buku_besar(ids["barang"])
    assert klien.patch(url, headers=kepala, json={"satuan": "gram"}).status_code == 422


def test_koreksi_dan_pemakaian_menjaga_buku_besar(gudang):
    ids, kepala, klien = gudang
    _awal_buku_besar(ids["barang"])
    r = klien.post(f"/usaha/{ids['u1']}/barang/{ids['barang']}/koreksi", headers=kepala, json={"stok": "750"})
    assert r.status_code == 200 and Decimal(r.json()["stok"]) == Decimal("750")
    assert _buku_besar_utuh(ids["barang"])
    r = klien.post(f"/usaha/{ids['u1']}/pemakaian", headers=kepala, json={"baris": [{"barang_id": ids["barang"], "jumlah": "900"}]})
    assert r.status_code == 200, r.text
    assert r.json() == {"tercatat": 1, "stok_kurang": ["Gula Pasir Uji"]}
    b = next(x for x in klien.get(f"/usaha/{ids['u1']}/barang", headers=kepala).json() if x["id"] == ids["barang"])
    assert Decimal(b["stok"]) == 0 and b["status"] == "habis"
    assert _buku_besar_utuh(ids["barang"])
    with mesin().connect() as kon:
        jumlah = kon.execute(text("SELECT sum(jumlah) FROM permintaan_harian WHERE barang_id = :b"), {"b": ids["barang"]}).scalar()
    assert Decimal(jumlah) == Decimal("750")


def test_batas_aman_massal_dan_ganti_kategori(gudang):
    ids, kepala, klien = gudang
    r = klien.post(f"/usaha/{ids['u1']}/batas-aman/ikut-saran", headers=kepala, json={"barang_id": [ids["barang"], ids["lain"]]})
    assert r.json() == {"diubah": 1}  # barang usaha lain tidak tersentuh
    r = klien.post(f"/usaha/{ids['u1']}/kategori/ganti", headers=kepala, json={"dari": ["Bahan"], "ke": "Bahan Pokok"})
    assert r.json() == {"diubah": 1}
    b = next(x for x in klien.get(f"/usaha/{ids['u1']}/barang", headers=kepala).json() if x["id"] == ids["barang"])
    assert (Decimal(b["batas_aman"]), b["sumber_batas_aman"], b["kategori"]) == (Decimal("350"), "sistem", "Bahan Pokok")


def test_barang_usaha_lain_tidak_bisa_diubah(gudang):
    ids, kepala, klien = gudang
    assert klien.patch(f"/usaha/{ids['u1']}/barang/{ids['lain']}", headers=kepala, json={"nama": "Bukan milikku"}).status_code == 404
    assert klien.post(f"/usaha/{ids['u2']}/barang", headers=kepala, json={
        "nama": "Titipan", "kategori": "Bahan", "satuan": "pcs", "batas_aman": "1"}).status_code == 403
