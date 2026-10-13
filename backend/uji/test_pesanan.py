"""
Uji jalur tulis pesanan: keranjang -> distributor -> penerimaan -> stok dan Mesin 2.

Yang dijaga:

1. **Stok hanya naik saat pemilik usaha menghitung barang**, sebanyak yang
   diterima (bukan yang dipesan), dan buku besar tetap sama dengan stok.
2. **Urutan status tidak bisa dilompati**: pesanan yang belum dikirim tidak
   bisa diterima, dan distributor lain tidak bisa menyentuh pesanan ini.
3. **Penerimaan menulis satu baris `fitur_pesanan`** dengan label yang sesuai
   hasil hitung. Inilah yang menutup putaran belajar Mesin 2.

Seperti `test_struk.py`, uji ini membuat usaha, distributor, produk, dan
penawarannya sendiri, lalu menghapus semuanya. Ia tidak bergantung pada isi
basis data simulasi.
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
from warungku.model import Barang, Distributor, Keanggotaan, Penawaran, Pengguna, ProdukMaster, Usaha

SANDI = "ujipesanan123"


def _cap() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


@pytest.fixture
def dunia():
    """Satu warung, satu distributor, satu produk yang ditawarkan distributor itu."""
    t = _cap()
    with Session(mesin()) as sesi:
        pm = ProdukMaster(nama_kanonik=f"Biji Kopi Uji {t}", kategori="Kopi & Teh", satuan_dasar="gram")
        sesi.add(pm)
        sesi.flush()

        u = Usaha(
            nama="Warung Uji Pesanan",
            jenis_usaha=JenisUsaha.KEDAI_KOPI,
            nama_pemilik="Penguji",
            alamat="Jl. Uji No.2",
            kota="Sleman",
            nomor_hp="080000000001",
            cara_hitung=CaraHitungStok.KEMASAN,
            verifikasi=StatusVerifikasi.MENUNGGU,
            bergabung_sejak=date.today(),
        )
        sesi.add(u)
        sesi.flush()
        pemilik = Pengguna(
            nomor_hp="08988%07d" % (t % 10_000_000),
            email=f"uji-pesanan-umkm-{t}@contoh.id",
            kata_sandi_hash=acak_kata_sandi(SANDI),
            nama="Pemilik Uji",
        )
        akun_dist = Pengguna(
            nomor_hp="08977%07d" % (t % 10_000_000),
            email=f"uji-pesanan-dist-{t}@contoh.id",
            kata_sandi_hash=acak_kata_sandi(SANDI),
            nama="Distributor Uji",
        )
        sesi.add(pemilik)
        sesi.add(akun_dist)
        sesi.flush()
        sesi.add(Keanggotaan(pengguna_id=pemilik.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK))

        d = Distributor(
            pengguna_id=akun_dist.id,
            nama="Distributor Uji",
            kota="Sleman",
            kategori=["Kopi & Teh"],
            area_kirim=["Sleman"],
            sejak=date(2024, 1, 1),
            minimum_pesanan=100_000,
        )
        sesi.add(d)
        sesi.flush()

        b = Barang(
            usaha_id=u.id,
            produk_master_id=pm.id,
            nama="Biji Kopi Uji",
            kategori="Kopi & Teh",
            kode_barang="UJIP01",
            satuan="gram",
            stok=Decimal("500.000"),
            batas_aman=Decimal("1000.000"),
            sumber_batas_aman=SumberBatasAman.SENDIRI,
            hari_kirim=2,
        )
        pn = Penawaran(
            distributor_id=d.id,
            produk_master_id=pm.id,
            nama="Biji Kopi Uji 1 kg",
            kategori="Kopi & Teh",
            satuan="kg",
            harga_satuan=150_000,
            kemasan_nama="kg",
            kemasan_isi=Decimal("1000.000"),
            satuan_isi="gram",
            stok_tersedia=Decimal("100.000"),
            stok_diperbarui_pada=datetime.now(timezone.utc),
        )
        sesi.add(b)
        sesi.add(pn)
        sesi.commit()
        ids = {"usaha": u.id, "barang": b.id, "distributor": d.id, "penawaran": pn.id, "produk": pm.id,
               "pengguna": [pemilik.id, akun_dist.id]}
        email_umkm, email_dist = pemilik.email, akun_dist.email

    klien = TestClient(app)
    r1 = klien.post("/auth/umkm/masuk", json={"email": email_umkm, "kata_sandi": SANDI})
    r2 = klien.post("/auth/distributor/masuk", json={"email": email_dist, "kata_sandi": SANDI})
    assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2.text)
    ids["kepala_umkm"] = {"Authorization": "Bearer " + r1.json()["token"]}
    ids["kepala_dist"] = {"Authorization": "Bearer " + r2.json()["token"]}

    yield ids

    with mesin().begin() as kon:
        u, d = ids["usaha"], ids["distributor"]
        kon.execute(text("DELETE FROM fitur_pesanan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM pergerakan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM pesanan_jejak WHERE pesanan_id IN (SELECT id FROM pesanan WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM pesanan_baris WHERE pesanan_id IN (SELECT id FROM pesanan WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM pesanan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM penawaran WHERE distributor_id = :d"), {"d": d})
        kon.execute(text("DELETE FROM barang WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM distributor WHERE id = :d"), {"d": d})
        kon.execute(text("DELETE FROM usaha WHERE id = :u"), {"u": u})
        kon.execute(text("DELETE FROM produk_master WHERE id = :p"), {"p": ids["produk"]})
        kon.execute(text("DELETE FROM pengguna WHERE id = ANY(:p)"), {"p": ids["pengguna"]})


def _stok(barang_id: int) -> Decimal:
    with mesin().connect() as kon:
        return kon.execute(text("SELECT stok FROM barang WHERE id = :b"), {"b": barang_id}).scalar_one()


def _buat(klien: TestClient, w: dict, jumlah: str = "3") -> dict:
    r = klien.post(
        f"/usaha/{w['usaha']}/pesanan",
        headers=w["kepala_umkm"],
        json={"baris": [{"penawaran_id": w["penawaran"], "jumlah": jumlah}], "dari_saran": True},
    )
    assert r.status_code == 201, r.text
    [p] = r.json()
    return p


def _majukan_sampai_dikirim(klien: TestClient, w: dict, pid: int) -> None:
    jalur = f"/distributor/{w['distributor']}/pesanan/{pid}"
    for langkah, badan in (("konfirmasi", {}), ("kirim", {"kurir": "Kurir Uji"}), ("sampai", {"diterima_oleh": "Kasir"})):
        r = klien.post(f"{jalur}/{langkah}", headers=w["kepala_dist"], json=badan)
        assert r.status_code == 200, (langkah, r.text)


def test_alur_lengkap_menaikkan_stok_dan_menulis_fitur(dunia):
    w, klien = dunia, TestClient(app)
    p = _buat(klien, w)
    assert p["status"] == "menunggu-konfirmasi"
    assert p["baris"][0]["barang_id"] == w["barang"]
    assert p["baris"][0]["harga_satuan"] == 150_000
    # Stok belum berubah hanya karena pesanan dibuat.
    assert _stok(w["barang"]) == Decimal("500.000")

    _majukan_sampai_dikirim(klien, w, p["id"])
    # "Sudah sampai" menurut distributor pun belum menambah stok.
    assert _stok(w["barang"]) == Decimal("500.000")

    bid = p["baris"][0]["id"]
    r = klien.post(
        f"/usaha/{w['usaha']}/pesanan/{p['id']}/terima",
        headers=w["kepala_umkm"],
        json={"baris": [{"baris_id": bid, "jumlah_diterima": "3"}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "selesai"
    # 3 kg x 1000 gram
    assert _stok(w["barang"]) == Decimal("3500.000")

    with mesin().connect() as kon:
        jumlah_buku = kon.execute(
            text("SELECT coalesce(sum(jumlah), 0) FROM pergerakan WHERE barang_id = :b"), {"b": w["barang"]}
        ).scalar_one()
        f = kon.execute(text("SELECT * FROM fitur_pesanan WHERE pesanan_id = :p"), {"p": p["id"]}).mappings().one()
    # Buku besar mencatat persis kenaikannya (stok awal 500 dibuat langsung oleh fixture).
    assert jumlah_buku == Decimal("3000.000")
    assert f["sukses"] is True and f["l_jumlah_sesuai"] is True and f["l_kondisi_baik"] is True
    assert f["p_nilai"] == 450_000 and f["p_minimum_terpenuhi"] is True and f["p_sekota"] is True


def test_selisih_menurunkan_label_dan_stok_ikut_yang_diterima(dunia):
    w, klien = dunia, TestClient(app)
    p = _buat(klien, w, jumlah="4")
    _majukan_sampai_dikirim(klien, w, p["id"])
    r = klien.post(
        f"/usaha/{w['usaha']}/pesanan/{p['id']}/terima",
        headers=w["kepala_umkm"],
        json={"baris": [{"baris_id": p["baris"][0]["id"], "jumlah_diterima": "3", "alasan_selisih": "rusak"}]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "selesai-catatan"
    assert _stok(w["barang"]) == Decimal("3500.000")
    with mesin().connect() as kon:
        f = kon.execute(text("SELECT sukses, l_kondisi_baik FROM fitur_pesanan WHERE pesanan_id = :p"), {"p": p["id"]}).one()
    assert f.sukses is False and f.l_kondisi_baik is False


def test_urutan_status_dijaga_dan_distributor_lain_ditolak(dunia):
    w, klien = dunia, TestClient(app)
    p = _buat(klien, w)
    # Belum dikirim: tidak bisa diterima.
    r = klien.post(
        f"/usaha/{w['usaha']}/pesanan/{p['id']}/terima",
        headers=w["kepala_umkm"],
        json={"baris": [{"baris_id": p["baris"][0]["id"], "jumlah_diterima": "3"}]},
    )
    assert r.status_code == 409
    # Tidak bisa dikirim sebelum dikonfirmasi.
    r = klien.post(f"/distributor/{w['distributor']}/pesanan/{p['id']}/kirim", headers=w["kepala_dist"], json={})
    assert r.status_code == 409
    # Token UMKM tidak bisa memakai pintu distributor.
    r = klien.post(f"/distributor/{w['distributor']}/pesanan/{p['id']}/konfirmasi", headers=w["kepala_umkm"], json={})
    assert r.status_code == 403
    # Tolak dengan alasan -> batal, stok tidak berubah.
    r = klien.post(
        f"/distributor/{w['distributor']}/pesanan/{p['id']}/tolak",
        headers=w["kepala_dist"],
        json={"alasan": "Stok sedang kosong"},
    )
    assert r.status_code == 200 and r.json()["status"] == "batal" and r.json()["alasan_tolak"] == "Stok sedang kosong"
    assert _stok(w["barang"]) == Decimal("500.000")


def test_pemilik_bisa_membatalkan_dan_distributor_melihat_pesanan_masuk(dunia):
    w, klien = dunia, TestClient(app)
    p = _buat(klien, w)
    r = klien.get(f"/distributor/{w['distributor']}/pesanan-masuk", headers=w["kepala_dist"])
    assert r.status_code == 200
    [masuk] = [x for x in r.json() if x["id"] == p["id"]]
    assert masuk["nama_usaha"] == "Warung Uji Pesanan" and masuk["usaha_kota"] == "Sleman"
    assert masuk["baris"][0]["penawaran_id"] == w["penawaran"]

    r = klien.post(f"/usaha/{w['usaha']}/pesanan/{p['id']}/batal", headers=w["kepala_umkm"], json={"alasan": "Salah pesan"})
    assert r.status_code == 200 and r.json()["status"] == "batal"
    # Sudah batal: distributor tidak bisa lagi mengonfirmasi.
    r = klien.post(f"/distributor/{w['distributor']}/pesanan/{p['id']}/konfirmasi", headers=w["kepala_dist"], json={})
    assert r.status_code == 409


def test_katalog_mencocokkan_penawaran_ke_barang_pemanggil(dunia):
    w, klien = dunia, TestClient(app)
    r = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_umkm"])
    assert r.status_code == 200, r.text
    k = r.json()
    assert k["usaha"]["nama"] == "Warung Uji Pesanan"
    [pn] = [p for p in k["penawaran"] if p["id"] == w["penawaran"]]
    # Penawaran dicocokkan ke barang milik usaha pemanggil lewat produk master.
    assert pn["barang_id_terkait"] == w["barang"]
    [d] = [x for x in k["distributor"] if x["id"] == w["distributor"]]
    # Distributor tanpa ulasan tidak diberi rating karangan.
    assert d["rating"] is None and d["jumlah_ulasan"] == 0
    # Token distributor tidak bisa membuka katalog pemilik usaha.
    r = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_dist"])
    assert r.status_code == 403
