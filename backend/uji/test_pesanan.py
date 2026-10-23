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
from warungku.model import (
    Barang,
    Distributor,
    Keanggotaan,
    Penawaran,
    Pengguna,
    ProdukMaster,
    RekomendasiSkor,
    Usaha,
)

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
        kon.execute(text("DELETE FROM kontrak_periode WHERE kontrak_id IN (SELECT id FROM kontrak WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM kontrak WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM paket_kontrak WHERE distributor_id = :d"), {"d": d})
        kon.execute(text("DELETE FROM promo_penawaran WHERE promo_id IN (SELECT id FROM promo WHERE distributor_id = :d)"), {"d": d})
        kon.execute(text("DELETE FROM tingkat_keanggotaan WHERE promo_id IN (SELECT id FROM promo WHERE distributor_id = :d)"), {"d": d})
        kon.execute(text("DELETE FROM penawaran WHERE distributor_id = :d"), {"d": d})
        kon.execute(text("DELETE FROM barang WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM promo WHERE distributor_id = :d"), {"d": d})
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



def _paket(w: dict) -> int:
    with mesin().begin() as kon:
        return kon.execute(
            text(
                "INSERT INTO paket_kontrak (penawaran_id, distributor_id, kode, durasi_bulan, kuota_min_per_bulan, "
                "harga_satuan, hemat_persen) VALUES (:p, :d, 'Kontrak Uji', 3, 10, 140000, 7) RETURNING id"
            ),
            {"p": w["penawaran"], "d": w["distributor"]},
        ).scalar_one()


def test_kontrak_dari_pengajuan_sampai_kuota_dan_berhenti(dunia):
    w, klien = dunia, TestClient(app)
    paket = _paket(w)
    u, d = f"/usaha/{w['usaha']}", f"/distributor/{w['distributor']}"

    r = klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": paket})
    assert r.status_code == 201 and r.json()["status"] == "menunggu-persetujuan"
    kid = r.json()["id"]
    assert r.json()["harga_satuan"] == 140000 and r.json()["barang_id"] == w["barang"]
    # Mengajukan lagi sebelum dijawab: pengajuan yang sama, bukan kembaran.
    assert klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": paket}).json()["id"] == kid
    # Belum disetujui: belum bisa dipakai memesan.
    r = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"],
                   json={"baris": [{"penawaran_id": w["penawaran"], "jumlah": "4", "kontrak_id": kid}]})
    assert r.status_code == 422

    r = klien.post(f"{d}/kontrak/{kid}/setujui", headers=w["kepala_dist"], json={})
    assert r.status_code == 200 and r.json()["status"] == "aktif"
    assert len(r.json()["periode"]) == 1 and r.json()["periode"][0]["diterima"] == "0.000"

    # Pesan dengan kontrak: harga kontrak, dan masuk hitungan "dalam perjalanan".
    r = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"],
                   json={"baris": [{"penawaran_id": w["penawaran"], "jumlah": "4", "kontrak_id": kid}]})
    assert r.status_code == 201, r.text
    [p] = r.json()
    assert p["kontrak_id"] == kid and p["baris"][0]["harga_satuan"] == 140000
    [k] = [x for x in klien.get(f"{u}/kontrak", headers=w["kepala_umkm"]).json() if x["id"] == kid]
    assert k["dalam_perjalanan"] == "4.000"

    _majukan_sampai_dikirim(klien, w, p["id"])
    r = klien.post(f"{u}/pesanan/{p['id']}/terima", headers=w["kepala_umkm"],
                   json={"baris": [{"baris_id": p["baris"][0]["id"], "jumlah_diterima": "4"}]})
    assert r.status_code == 200
    [k] = [x for x in klien.get(f"{d}/kontrak", headers=w["kepala_dist"]).json() if x["id"] == kid]
    assert k["dalam_perjalanan"] == "0.000" and k["periode"][-1]["diterima"] == "4.000"
    assert k["nama_usaha"] == "Warung Uji Pesanan"

    # Berhenti: menolak wajib beralasan; disetujui -> dihentikan, kontrak tak bisa dipakai lagi.
    assert klien.post(f"{u}/kontrak/{kid}/berhenti", headers=w["kepala_umkm"], json={"alasan": "Pindah pemasok"}).status_code == 200
    assert klien.post(f"{d}/kontrak/{kid}/jawab-berhenti", headers=w["kepala_dist"], json={"setuju": False}).status_code == 422
    r = klien.post(f"{d}/kontrak/{kid}/jawab-berhenti", headers=w["kepala_dist"], json={"setuju": True})
    assert r.status_code == 200 and r.json()["status"] == "dihentikan"
    r = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"],
                   json={"baris": [{"penawaran_id": w["penawaran"], "jumlah": "1", "kontrak_id": kid}]})
    assert r.status_code == 422


def test_distributor_menolak_kontrak_dengan_alasan(dunia):
    w, klien = dunia, TestClient(app)
    paket = _paket(w)
    kid = klien.post(f"/usaha/{w['usaha']}/kontrak", headers=w["kepala_umkm"], json={"paket_id": paket}).json()["id"]
    r = klien.post(f"/distributor/{w['distributor']}/kontrak/{kid}/tolak", headers=w["kepala_dist"], json={"alasan": "Kuota belum sanggup"})
    assert r.status_code == 200 and r.json()["status"] == "ditolak" and r.json()["alasan_ditolak"] == "Kuota belum sanggup"
    # Distributor lain / token pemilik usaha tidak bisa menyetujui.
    r = klien.post(f"/distributor/{w['distributor']}/kontrak/{kid}/setujui", headers=w["kepala_umkm"], json={})
    assert r.status_code == 403


def test_distributor_mengelola_paket_dari_katalognya(dunia):
    w, klien = dunia, TestClient(app)
    d = f"/distributor/{w['distributor']}"
    badan = {"penawaran_id": w["penawaran"], "kode": "Paket Uji", "durasi_bulan": 6,
             "kuota_min_per_bulan": "12", "harga_satuan": 135000, "hemat_persen": 10}
    r = klien.post(f"{d}/paket", headers=w["kepala_dist"], json=badan)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    k = klien.get(f"{d}/katalog", headers=w["kepala_dist"]).json()
    assert [p["id"] for p in k["penawaran"]] == [w["penawaran"]] and [p["id"] for p in k["paket"]] == [pid]
    r = klien.put(f"{d}/paket/{pid}", headers=w["kepala_dist"], json={**badan, "harga_satuan": 130000})
    assert r.status_code == 200 and r.json()["harga_satuan"] == 130000
    # Paket hanya untuk penawaran milik sendiri.
    r = klien.post(f"{d}/paket", headers=w["kepala_dist"], json={**badan, "penawaran_id": 1})
    assert r.status_code == 422
    assert klien.delete(f"{d}/paket/{pid}", headers=w["kepala_dist"]).status_code == 204
    assert klien.get(f"{d}/katalog", headers=w["kepala_dist"]).json()["paket"] == []


def test_promo_memotong_harga_beli_sekali_sampai_diakhiri(dunia):
    w, klien = dunia, TestClient(app)
    d = f"/distributor/{w['distributor']}"
    r = klien.post(f"{d}/promo", headers=w["kepala_dist"], json={
        "jenis": "cuci-gudang", "judul": "Cuci Gudang Uji", "potongan_persen": 10,
        "penawaran_ids": [w["penawaran"]],
    })
    assert r.status_code == 201, r.text
    promo = r.json()["id"]
    # Pemilik usaha melihat promonya di katalog.
    k = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_umkm"]).json()
    assert any(p["id"] == promo and p["penawaran_ids"] == [w["penawaran"]] for p in k["promo"])
    # Harga beli sekali terpotong 10%, harga normal dan asal potongannya tercatat.
    [p] = klien.post(f"/usaha/{w['usaha']}/pesanan", headers=w["kepala_umkm"],
                     json={"baris": [{"penawaran_id": w["penawaran"], "jumlah": "1"}]}).json()
    assert p["baris"][0]["harga_satuan"] == 135000 and p["baris"][0]["harga_normal"] == 150000
    assert p["baris"][0]["promo_id"] == promo
    # Diakhiri: pesanan berikutnya kembali ke harga normal.
    assert klien.post(f"{d}/promo/{promo}/akhiri", headers=w["kepala_dist"], json={}).status_code == 200
    [p] = klien.post(f"/usaha/{w['usaha']}/pesanan", headers=w["kepala_umkm"],
                     json={"baris": [{"penawaran_id": w["penawaran"], "jumlah": "1"}]}).json()
    assert p["baris"][0]["harga_satuan"] == 150000 and p["baris"][0]["promo_id"] is None


def test_ringkasan_saran_mesin2_per_distributor(dunia):
    """Rata-rata skor per distributor, urutan, dan barang yang menempatkannya di urutan pertama."""
    w, klien = dunia, TestClient(app)
    sekarang = datetime.now(timezone.utc)
    with Session(mesin()) as sesi:
        dunia_b = sesi.get(Barang, w["barang"])
        dunia_p = sesi.get(Penawaran, w["penawaran"])
        dist2 = Distributor(nama="Distributor Uji Dua", kota="Sleman", kategori=["Kopi & Teh"],
                            area_kirim=["Sleman"], sejak=date(2024, 1, 1))
        sesi.add(dist2)
        sesi.flush()
        pen2 = Penawaran(**dunia_p.model_dump(exclude={"id", "distributor_id"}), distributor_id=dist2.id)
        brg2 = Barang(**dunia_b.model_dump(exclude={"id", "nama", "kode_barang"}), nama="Biji Kopi Uji Dua",
                      kode_barang="UJIP02")
        sesi.add(pen2)
        sesi.add(brg2)
        sesi.flush()
        d2, p2, b2 = dist2.id, pen2.id, brg2.id
        # Barang pertama: distributor dunia unggul. Barang kedua: distributor dua unggul.
        for barang, dist, pen, skor, segmen in (
            (w["barang"], w["distributor"], w["penawaran"], 0.9, "sangat-layak"),
            (w["barang"], d2, p2, 0.5, "layak"),
            (b2, d2, p2, 0.8, "sangat-layak"),
            (b2, w["distributor"], w["penawaran"], 0.3, "kurang-layak"),
        ):
            sesi.add(RekomendasiSkor(
                usaha_id=w["usaha"], barang_id=barang, penawaran_id=pen, distributor_id=dist, p_sukses=skor,
                skor=skor, segmen=segmen, model_nama="beta+thompson+fuzzy", model_versi="uji",
                dijalankan_pada=sekarang, kedaluwarsa_pada=sekarang.replace(year=sekarang.year + 1),
            ))
        sesi.commit()
    try:
        r = klien.get(f"/usaha/{w['usaha']}/saran-distributor", headers=w["kepala_umkm"])
        assert r.status_code == 200, r.text
        dua, satu = r.json()
        assert dua["distributor_id"] == d2 and satu["distributor_id"] == w["distributor"]
        assert round(dua["skor_rata"], 3) == 0.65 and round(satu["skor_rata"], 3) == 0.6
        assert dua["jumlah_barang"] == 2 and dua["jumlah_teratas"] == 1 and dua["barang_teratas"] == ["Biji Kopi Uji Dua"]
        assert satu["barang_teratas"] == ["Biji Kopi Uji"] and satu["jumlah_sangat_layak"] == 1
        assert dua["kedaluwarsa"] is False
        # Hanya pemilik usaha ini yang boleh membacanya.
        r = klien.get(f"/usaha/{w['usaha']}/saran-distributor", headers=w["kepala_dist"])
        assert r.status_code in (401, 403)
    finally:
        with mesin().begin() as kon:
            kon.execute(text("DELETE FROM rekomendasi_skor WHERE usaha_id = :u"), {"u": w["usaha"]})
            kon.execute(text("DELETE FROM barang WHERE id = :b"), {"b": b2})
            kon.execute(text("DELETE FROM penawaran WHERE id = :p"), {"p": p2})
            kon.execute(text("DELETE FROM distributor WHERE id = :d"), {"d": d2})


def test_lokasi_gudang_disimpan_dan_terbaca_pembeli(dunia):
    """Titik gudang (revisi 23 Okt): disimpan distributor, terbaca di katalog pembeli, bisa dikosongkan."""
    w, klien = dunia, TestClient(app)
    jalur = f"/distributor/{w['distributor']}"

    r = klien.get(f"{jalur}/profil", headers=w["kepala_dist"])
    assert r.status_code == 200, r.text
    assert r.json()["lat"] is None and r.json()["lng"] is None

    r = klien.put(f"{jalur}/lokasi", headers=w["kepala_dist"], json={"lat": -7.7412, "lng": 110.3901})
    assert r.status_code == 200, r.text
    assert (r.json()["lat"], r.json()["lng"]) == (-7.7412, 110.3901)

    katalog = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_umkm"]).json()
    [d] = [x for x in katalog["distributor"] if x["id"] == w["distributor"]]
    assert (d["lat"], d["lng"]) == (-7.7412, 110.3901)

    # Satu sisi saja, atau titik di luar Indonesia, ditolak tanpa mengubah data.
    assert klien.put(f"{jalur}/lokasi", headers=w["kepala_dist"], json={"lat": -7.7}).status_code == 422
    assert klien.put(f"{jalur}/lokasi", headers=w["kepala_dist"], json={"lat": 48.85, "lng": 2.35}).status_code == 422
    # Akun pemilik usaha tidak boleh mengubah gudang distributor.
    assert klien.put(f"{jalur}/lokasi", headers=w["kepala_umkm"], json={"lat": -7.7, "lng": 110.4}).status_code == 403
    assert klien.get(f"{jalur}/profil", headers=w["kepala_dist"]).json()["lat"] == -7.7412

    r = klien.put(f"{jalur}/lokasi", headers=w["kepala_dist"], json={"lat": None, "lng": None})
    assert r.status_code == 200 and r.json()["lat"] is None and r.json()["lng"] is None


def test_ringkasan_penjualan_nota_dan_pesanan_selesai(dunia):
    """Ringkasan penjualan (revisi 23 Okt): nota demo, nota batal, dan pesanan variasi demo tidak dihitung."""
    from datetime import timedelta

    w, klien = dunia, TestClient(app)
    hari = datetime(2026, 9, 10, 10, 0, tzinfo=timezone.utc)
    nota = [
        ("UJI-1", hari, False, [("Kopi Susu", "3", 18_000), ("Roti Bakar", "1", 15_000)]),
        ("UJI-2", hari + timedelta(days=1), False, [("Kopi Susu", "2", 18_000)]),
        ("DEMO-V-UJI", hari, False, [("Kopi Susu", "9", 18_000)]),
        ("UJI-BATAL", hari, True, [("Kopi Susu", "5", 18_000)]),
    ]
    try:
        with mesin().begin() as kon:
            for nomor, waktu, batal, baris in nota:
                tid = kon.execute(
                    text(
                        "INSERT INTO transaksi (usaha_id, nomor_struk, waktu, sumber, dibatalkan)"
                        " VALUES (:u, :n, :w, 'pos', :b) RETURNING id"
                    ),
                    {"u": w["usaha"], "n": nomor, "w": waktu, "b": batal},
                ).scalar_one()
                for nama, jumlah, harga in baris:
                    kon.execute(
                        text(
                            "INSERT INTO transaksi_baris (transaksi_id, nama_menu, jumlah, satuan, harga_jual_satuan)"
                            " VALUES (:t, :n, :j, 'porsi', :h)"
                        ),
                        {"t": tid, "n": nama, "j": Decimal(jumlah), "h": harga},
                    )

        r = klien.get(
            f"/usaha/{w['usaha']}/ringkasan-penjualan?dari=2026-09-10&sampai=2026-09-11", headers=w["kepala_umkm"]
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sumber"] == "nota" and d["data_terakhir"] == "2026-09-11"
        assert (d["total"], d["jumlah_transaksi"]) == (3 * 18_000 + 15_000 + 2 * 18_000, 2)
        assert [h["total"] for h in d["per_hari"]] == [69_000, 36_000]
        assert d["terlaris"][0] == {"nama": "Kopi Susu", "satuan": "porsi", "jumlah": 5.0, "total": 90_000}
        # Tanpa tanggal: 30 hari yang berakhir di nota terakhir, bukan hari ini.
        d = klien.get(f"/usaha/{w['usaha']}/ringkasan-penjualan", headers=w["kepala_umkm"]).json()
        assert (d["dari"], d["sampai"], len(d["per_hari"])) == ("2026-08-13", "2026-09-11", 30)
        assert klien.get(
            f"/usaha/{w['usaha']}/ringkasan-penjualan?dari=2026-09-11&sampai=2026-09-10", headers=w["kepala_umkm"]
        ).status_code == 422
    finally:
        with mesin().begin() as kon:
            kon.execute(
                text("DELETE FROM transaksi_baris WHERE transaksi_id IN (SELECT id FROM transaksi WHERE usaha_id = :u)"),
                {"u": w["usaha"]},
            )
            kon.execute(text("DELETE FROM transaksi WHERE usaha_id = :u"), {"u": w["usaha"]})

    # Distributor: satu pesanan selesai dihitung, satu pesanan bernomor variasi demo tidak.
    p1, p2 = _buat(klien, w, "2"), _buat(klien, w, "1")
    _majukan_sampai_dikirim(klien, w, p1["id"])
    _majukan_sampai_dikirim(klien, w, p2["id"])
    with mesin().begin() as kon:
        kon.execute(text("UPDATE pesanan SET nomor = 'PS-260101-W9999' WHERE id = :p"), {"p": p2["id"]})
        tanggal = kon.execute(
            text("SELECT (dibuat_pada AT TIME ZONE 'UTC')::date FROM pesanan WHERE id = :p"), {"p": p1["id"]}
        ).scalar_one()
    r = klien.get(
        f"/distributor/{w['distributor']}/ringkasan-penjualan?dari={tanggal}&sampai={tanggal}", headers=w["kepala_dist"]
    )
    assert r.status_code == 200, r.text
    d = r.json()
    nilai = 2 * 150_000
    assert (d["jumlah_transaksi"], d["jumlah_pihak"]) == (1, 1)
    assert d["total"] == nilai + p1["ongkos_kirim"]
    assert {x["label"]: x["nilai"] for x in d["rincian"]} == {"Nilai barang": nilai, "Ongkos kirim": p1["ongkos_kirim"]}
    # Akun pemilik usaha tidak boleh membaca ringkasan distributor.
    assert klien.get(f"/distributor/{w['distributor']}/ringkasan-penjualan", headers=w["kepala_umkm"]).status_code == 403


def test_info_usaha_disimpan_dan_terbaca_pembeli(dunia):
    """Info usaha dari Profil: disimpan distributor, terbaca di katalog pembeli, isian salah ditolak."""
    w, klien = dunia, TestClient(app)
    jalur = f"/distributor/{w['distributor']}"
    isi = {
        "deskripsi": "  Biji kopi sangrai dari Temanggung.  ",
        "alamat_gudang": "Jl. Magelang KM 7 No. 12, Sleman",
        "nomor_hp": "0812-3456-7890",
        "jam_operasional": "Senin sampai Sabtu, 07.00 - 16.00",
        "minimum_pesanan": 250_000,
    }
    # Titik gudang dipasang dulu: menyimpan info usaha tidak boleh ikut menghapusnya.
    r = klien.put(f"{jalur}/lokasi", headers=w["kepala_dist"], json={"lat": -7.7412, "lng": 110.3901})
    assert r.status_code == 200, r.text

    r = klien.put(f"{jalur}/profil", headers=w["kepala_dist"], json=isi)
    assert r.status_code == 200, r.text
    # Disimpan rapi: spasi di tepi dibuang, nomor HP tinggal angkanya.
    assert r.json()["deskripsi"] == "Biji kopi sangrai dari Temanggung." and r.json()["nomor_hp"] == "081234567890"
    assert (r.json()["minimum_pesanan"], r.json()["lat"]) == (250_000, -7.7412)

    katalog = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_umkm"]).json()
    [d] = [x for x in katalog["distributor"] if x["id"] == w["distributor"]]
    assert (d["deskripsi"], d["alamat_gudang"], d["nomor_hp"], d["jam_operasional"], d["minimum_pesanan"]) == (
        "Biji kopi sangrai dari Temanggung.",
        "Jl. Magelang KM 7 No. 12, Sleman",
        "081234567890",
        "Senin sampai Sabtu, 07.00 - 16.00",
        250_000,
    )

    # Aturan FormInfoUsaha berlaku juga di sini. Pesannya satu kalimat, karena layar menampilkannya apa adanya.
    for salah in (
        {"alamat_gudang": "  Jl. 7  "},
        {"nomor_hp": "0712345678"},
        {"nomor_hp": "0812345"},
        {"nomor_hp": "0812345678901234"},
        {"jam_operasional": "pagi"},
        {"jam_operasional": "x" * 121},
        {"minimum_pesanan": -1},
        {"minimum_pesanan": 1_000_000_001},
    ):
        r = klien.put(f"{jalur}/profil", headers=w["kepala_dist"], json={**isi, **salah})
        assert r.status_code == 422 and isinstance(r.json()["detail"], str), (salah, r.text)
    # Akun pemilik usaha tidak boleh mengubah info distributor.
    assert klien.put(f"{jalur}/profil", headers=w["kepala_umkm"], json=isi).status_code == 403
    assert klien.get(f"{jalur}/profil", headers=w["kepala_dist"]).json()["minimum_pesanan"] == 250_000

    # Tentang toko boleh dikosongkan, dan 0 berarti tanpa minimum.
    r = klien.put(f"{jalur}/profil", headers=w["kepala_dist"], json={**isi, "deskripsi": "   ", "minimum_pesanan": 0})
    assert r.status_code == 200 and r.json()["deskripsi"] is None and r.json()["minimum_pesanan"] == 0


def test_layanan_disimpan_dan_dipakai_saringan_mesin2(dunia):
    """Kategori dan area kirim dari Profil: disimpan, terbaca pembeli, dan langsung dipakai saringan Mesin 2."""
    # Diimpor di sini: hanya uji ini yang butuh Mesin 2 (numpy dan pandas).
    from ml.mesin2.saran import kandidat_untuk

    w, klien = dunia, TestClient(app)
    jalur = f"/distributor/{w['distributor']}"
    # Usaha dunia ada di Sleman, dan distributornya mengirim ke Sleman.
    assert len(kandidat_untuk(w["usaha"])) == 1

    r = klien.put(
        f"{jalur}/layanan",
        headers=w["kepala_dist"],
        json={"kategori": ["Kopi & Teh", "Pemanis", "Kopi & Teh"], "area_kirim": ["Bantul", "Kota Yogyakarta"]},
    )
    assert r.status_code == 200, r.text
    # Pilihan ganda dibuang, urutannya tetap.
    assert r.json()["kategori"] == ["Kopi & Teh", "Pemanis"]
    assert r.json()["area_kirim"] == ["Bantul", "Kota Yogyakarta"]

    katalog = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_umkm"]).json()
    [d] = [x for x in katalog["distributor"] if x["id"] == w["distributor"]]
    assert (d["kategori"], d["area_kirim"]) == (["Kopi & Teh", "Pemanis"], ["Bantul", "Kota Yogyakarta"])
    # Sleman tidak lagi dikirimi: putaran Mesin 2 berikutnya tidak menilai distributor ini untuk usaha dunia.
    assert len(kandidat_untuk(w["usaha"])) == 0

    # Kosong atau di luar daftar ditolak; "Yogyakarta" tidak akan pernah cocok dengan kota "Kota Yogyakarta".
    benar = {"kategori": ["Pemanis"], "area_kirim": ["Sleman"]}
    for salah in ({"kategori": []}, {"area_kirim": []}, {"kategori": ["Elektronik"]}, {"area_kirim": ["Yogyakarta"]}):
        r = klien.put(f"{jalur}/layanan", headers=w["kepala_dist"], json={**benar, **salah})
        assert r.status_code == 422 and isinstance(r.json()["detail"], str), (salah, r.text)
    # Akun pemilik usaha tidak boleh mengubah layanan distributor.
    assert klien.put(f"{jalur}/layanan", headers=w["kepala_umkm"], json=benar).status_code == 403
    assert klien.get(f"{jalur}/profil", headers=w["kepala_dist"]).json()["area_kirim"] == ["Bantul", "Kota Yogyakarta"]
