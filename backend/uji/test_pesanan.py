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

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from api.otentikasi import acak_kata_sandi
from api.utama import app
from dataset.variasi_demo import _jam_berangkat
from warungku.basis_data import mesin
from warungku.enum import (
    CaraHitungStok,
    JenisUsaha,
    PeranPengguna,
    StatusBayar,
    StatusPesanan,
    StatusVerifikasi,
    SumberBatasAman,
)
from warungku.model import (
    Barang,
    Distributor,
    Keanggotaan,
    Penawaran,
    Pengguna,
    Pesanan,
    PesananBaris,
    PesananJejak,
    ProdukMaster,
    RekomendasiSkor,
    Ulasan,
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
        kon.execute(text("DELETE FROM ulasan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM pergerakan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM pesanan_jejak WHERE pesanan_id IN (SELECT id FROM pesanan WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM pesanan_baris WHERE pesanan_id IN (SELECT id FROM pesanan WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM pesanan WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM kontrak_periode WHERE kontrak_id IN (SELECT id FROM kontrak WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM kontrak WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM paket_kontrak WHERE distributor_id = :d"), {"d": d})
        kon.execute(text("DELETE FROM promo_penawaran WHERE promo_id IN (SELECT id FROM promo WHERE distributor_id = :d)"), {"d": d})
        kon.execute(text("DELETE FROM tingkat_keanggotaan WHERE promo_id IN (SELECT id FROM promo WHERE distributor_id = :d)"), {"d": d})
        kon.execute(text("DELETE FROM rekomendasi_skor WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM penawaran WHERE distributor_id = :d"), {"d": d})
        kon.execute(text("DELETE FROM kemasan WHERE barang_id IN (SELECT id FROM barang WHERE usaha_id = :u)"), {"u": u})
        kon.execute(text("DELETE FROM barang WHERE usaha_id = :u"), {"u": u})
        kon.execute(text("DELETE FROM produk_master WHERE nama_kanonik = 'Teh Melati Uji'"))
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


def _pesanan_simulasi(w: dict, jam, status: StatusPesanan, jejak, ulasan=False) -> int:
    """Pesanan seperti tulisan pembangkit: jam setempat di kolom UTC, tepat di menit."""
    with Session(mesin()) as sesi:
        p = Pesanan(
            nomor=f"PS-SIM-{_cap()}", usaha_id=w["usaha"], distributor_id=w["distributor"], dibuat_pada=jam(8, 15),
            status=status, status_bayar=StatusBayar.DIKONFIRMASI, perkiraan_tiba=jam(15), sudah_diulas=ulasan,
            kirim_waktu_sampai=jam(11) if ulasan else None,
        )
        sesi.add(p)
        sesi.flush()
        sesi.add(PesananBaris(pesanan_id=p.id, penawaran_id=w["penawaran"], barang_id=w["barang"], nama="Biji Kopi Uji 1 kg",
                              jumlah=Decimal("1"), satuan="kg", harga_satuan=140_000, isi_per_satuan=Decimal("1000")))
        for st, h in jejak:
            sesi.add(PesananJejak(pesanan_id=p.id, waktu=jam(h), status=st, keterangan="Simulasi"))
        if ulasan:
            sesi.add(Ulasan(pesanan_id=p.id, usaha_id=w["usaha"], distributor_id=w["distributor"], rating=5, waktu=jam(19),
                            aspek_ketepatan_waktu=5, aspek_jumlah_sesuai=5, aspek_kondisi_barang=5))
        sesi.commit()
        return p.id


def _waktu(s: str) -> datetime:
    return datetime.fromisoformat(s)


def test_jam_pesanan_simulasi_terbaca_sebagai_wib(dunia):
    w, klien = dunia, TestClient(app)
    u, d = f"/usaha/{w['usaha']}", f"/distributor/{w['distributor']}"

    def jam(h, m=0):
        return datetime(2020, 1, 4, h, m, tzinfo=timezone.utc)

    pid = _pesanan_simulasi(
        w, jam, StatusPesanan.SELESAI, ulasan=True,
        jejak=((StatusPesanan.MENUNGGU_KONFIRMASI, 8), (StatusPesanan.DISIAPKAN, 10), (StatusPesanan.DIKIRIM, 13)),
    )
    for r in (klien.get(f"{u}/pesanan/{pid}", headers=w["kepala_umkm"]), klien.get(f"{d}/pesanan/{pid}", headers=w["kepala_dist"])):
        assert r.status_code == 200, r.text
        p = r.json()
        assert _waktu(p["dibuat_pada"]) == jam(1, 15) and _waktu(p["perkiraan_tiba"]) == jam(8)
        assert _waktu(p["kirim_waktu_sampai"]) == jam(4)
        assert [(j["status"], _waktu(j["waktu"])) for j in p["jejak"]] == [
            ("menunggu-konfirmasi", jam(1)), ("disiapkan", jam(3)), ("dikirim", jam(6)),
        ]
        # 19.00 setempat: tanggalnya tidak boleh terbawa ke hari berikutnya saat dibaca sebagai WIB.
        assert _waktu(p["ulasan"]["waktu"]) == jam(12)
    [ringkas] = [x for x in klien.get(f"{d}/pesanan", headers=w["kepala_dist"]).json() if x["id"] == pid]
    assert _waktu(ringkas["dibuat_pada"]) == jam(1, 15) and _waktu(ringkas["perkiraan_tiba"]) == jam(8)
    [ul] = klien.get(f"{u}/ulasan", headers=w["kepala_umkm"]).json()
    assert _waktu(ul["waktu"]) == jam(12)


def test_pesanan_sungguhan_tidak_digeser_dan_urut_dengan_simulasi(dunia):
    w, klien = dunia, TestClient(app)
    u, d = f"/usaha/{w['usaha']}", f"/distributor/{w['distributor']}"
    sekarang = datetime.now(timezone.utc)
    # Tiga jam ke depan di kolom, jadi tampil empat jam lalu. Urutan kolom mentah akan menaruhnya di atas.
    dasar = sekarang.replace(second=0, microsecond=0) + timedelta(hours=3)

    def jam(h, m=0):
        return dasar + timedelta(hours=h - 8, minutes=m)

    lama = _pesanan_simulasi(w, jam, StatusPesanan.MENUNGGU_KONFIRMASI, jejak=((StatusPesanan.MENUNGGU_KONFIRMASI, 8),))
    baru = _buat(klien, w)
    assert abs(_waktu(baru["dibuat_pada"]) - sekarang) < timedelta(minutes=5)
    assert abs(_waktu(baru["jejak"][0]["waktu"]) - sekarang) < timedelta(minutes=5)
    daftar = [x["id"] for x in klien.get(f"{u}/pesanan", headers=w["kepala_umkm"]).json()]
    assert daftar.index(baru["id"]) < daftar.index(lama)
    masuk = [x["id"] for x in klien.get(f"{d}/pesanan-masuk", headers=w["kepala_dist"]).json()]
    assert masuk.index(baru["id"]) < masuk.index(lama)
    ringkas = [x["id"] for x in klien.get(f"{d}/pesanan", headers=w["kepala_dist"]).json()]
    assert ringkas.index(baru["id"]) < ringkas.index(lama)

    # Langkah sungguhan pada pesanan simulasi jadi jejak terakhir, memakai jam sebenarnya.
    r = klien.post(f"{d}/pesanan/{lama}/konfirmasi", headers=w["kepala_dist"], json={})
    assert r.status_code == 200, r.text
    jejak = r.json()["jejak"]
    assert [j["status"] for j in jejak] == ["menunggu-konfirmasi", "disiapkan"]
    assert abs(_waktu(jejak[1]["waktu"]) - sekarang) < timedelta(minutes=5)

    # Ulasan sungguhan tetap memakai jam sebenarnya dan berada di atas ulasan simulasi.
    with mesin().begin() as kon:
        kon.execute(
            text("UPDATE pesanan SET status = 'selesai', sudah_diulas = FALSE WHERE id = ANY(:p)"), {"p": [lama, baru["id"]]}
        )
        kon.execute(
            text(
                "INSERT INTO ulasan (pesanan_id, usaha_id, distributor_id, rating, waktu, aspek_ketepatan_waktu,"
                " aspek_jumlah_sesuai, aspek_kondisi_barang) VALUES (:p, :u, :d, 4, :t, 4, 4, 4)"
            ),
            {"p": lama, "u": w["usaha"], "d": w["distributor"], "t": dasar},
        )
    r = klien.post(
        f"{u}/pesanan/{baru['id']}/ulasan", headers=w["kepala_umkm"],
        json={"aspek_ketepatan_waktu": 5, "aspek_jumlah_sesuai": 5, "aspek_kondisi_barang": 5},
    )
    assert r.status_code == 201, r.text
    assert abs(_waktu(r.json()["ulasan"]["waktu"]) - sekarang) < timedelta(minutes=5)
    ulasan = klien.get(f"{d}/ulasan", headers=w["kepala_dist"]).json()
    assert [x["rating"] for x in ulasan] == [5, 4]


def test_jejak_berangkat_simulasi_pindah_sesudah_barang_disiapkan(dunia):
    w = dunia

    def jam(h, m=0):
        return datetime(2020, 1, 4, h, m, tzinfo=timezone.utc)

    pid = _pesanan_simulasi(
        w, jam, StatusPesanan.DIKIRIM,
        jejak=((StatusPesanan.DIKIRIM, 7), (StatusPesanan.MENUNGGU_KONFIRMASI, 8), (StatusPesanan.DISIAPKAN, 10)),
    )
    # Jejak sungguhan yang kebetulan di jam yang sama tetap di tempatnya, karena membawa mikrodetik.
    nyata = jam(7).replace(microsecond=5)
    with Session(mesin()) as sesi:
        sesi.add(PesananJejak(pesanan_id=pid, waktu=nyata, status=StatusPesanan.DIKIRIM, keterangan="Nyata"))
        sesi.commit()
    with mesin().begin() as kon:
        assert _jam_berangkat(kon) >= 1
        assert _jam_berangkat(kon) == 0
        baris = kon.execute(
            text("SELECT status::text, waktu FROM pesanan_jejak WHERE pesanan_id = :p ORDER BY waktu"), {"p": pid}
        ).all()
    assert [(s, t.astimezone(timezone.utc)) for s, t in baris] == [
        ("dikirim", nyata), ("menunggu-konfirmasi", jam(8)), ("disiapkan", jam(10)), ("dikirim", jam(13)),
    ]


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



def _draf(w: dict, kontrak_id: int | None = None, jumlah: str = "2") -> int:
    """Draf seperti draf pesanan rutin di data simulasi. Belum ada endpoint yang membuatnya."""
    with Session(mesin()) as sesi:
        p = Pesanan(
            nomor=f"PS-DRAF-{_cap()}",
            usaha_id=w["usaha"],
            distributor_id=w["distributor"],
            kontrak_id=kontrak_id,
            dibuat_pada=datetime.now(timezone.utc),
            status=StatusPesanan.DRAF,
            status_bayar=StatusBayar.BELUM_DIBAYAR,
            dari_rutin=True,
        )
        sesi.add(p)
        sesi.flush()
        sesi.add(PesananBaris(pesanan_id=p.id, penawaran_id=w["penawaran"], barang_id=w["barang"], nama="Biji Kopi Uji 1 kg",
                              jumlah=Decimal(jumlah), satuan="kg", harga_satuan=140_000, isi_per_satuan=Decimal("1000")))
        sesi.commit()
        return p.id


def test_draf_dikirim_atau_dibatalkan_pemilik(dunia):
    w, klien = dunia, TestClient(app)
    u = f"/usaha/{w['usaha']}"
    kid = klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": _paket(w)}).json()["id"]
    assert klien.post(f"/distributor/{w['distributor']}/kontrak/{kid}/setujui", headers=w["kepala_dist"], json={}).status_code == 200

    # Draf belum terlihat distributor dan belum dihitung "sedang dikirim".
    pid = _draf(w, kontrak_id=kid)
    masuk = klien.get(f"/distributor/{w['distributor']}/pesanan-masuk", headers=w["kepala_dist"]).json()
    assert pid not in [x["id"] for x in masuk]
    r = klien.post(f"{u}/pesanan/{pid}/ajukan", headers=w["kepala_umkm"])
    assert r.status_code == 200 and r.json()["status"] == "menunggu-konfirmasi", r.text
    assert r.json()["jejak"][-1]["keterangan"] == "Draf dikirim ke distributor."
    [k] = [x for x in klien.get(f"{u}/kontrak", headers=w["kepala_umkm"]).json() if x["id"] == kid]
    assert k["dalam_perjalanan"] == "2.000"
    masuk = klien.get(f"/distributor/{w['distributor']}/pesanan-masuk", headers=w["kepala_dist"]).json()
    assert pid in [x["id"] for x in masuk]
    # Mengirim dua kali tidak menghitung kuota dua kali.
    assert klien.post(f"{u}/pesanan/{pid}/ajukan", headers=w["kepala_umkm"]).status_code == 409

    # Draf yang dibatalkan tidak melepas kuota yang tidak pernah dihitung.
    pid2 = _draf(w, kontrak_id=kid)
    r = klien.post(f"{u}/pesanan/{pid2}/batal", headers=w["kepala_umkm"], json={"alasan": "Belum perlu"})
    assert r.status_code == 200 and r.json()["status"] == "batal", r.text
    [k] = [x for x in klien.get(f"{u}/kontrak", headers=w["kepala_umkm"]).json() if x["id"] == kid]
    assert k["dalam_perjalanan"] == "2.000"
    # Distributor tidak bisa mengirim draf milik usaha.
    assert klien.post(f"{u}/pesanan/{_draf(w)}/ajukan", headers=w["kepala_dist"]).status_code == 403


def test_penilaian_sekali_per_pesanan_dan_jadi_rating(dunia):
    w, klien = dunia, TestClient(app)
    u = f"/usaha/{w['usaha']}"
    p = _buat(klien, w)
    nilai = {"aspek_ketepatan_waktu": 5, "aspek_jumlah_sesuai": 4, "aspek_kondisi_barang": 4, "isi": "  Rapi.  "}
    # Belum selesai: belum boleh dinilai.
    assert klien.post(f"{u}/pesanan/{p['id']}/ulasan", headers=w["kepala_umkm"], json=nilai).status_code == 409
    _majukan_sampai_dikirim(klien, w, p["id"])
    r = klien.post(f"{u}/pesanan/{p['id']}/terima", headers=w["kepala_umkm"],
                   json={"baris": [{"baris_id": p["baris"][0]["id"], "jumlah_diterima": "3"}]})
    assert r.status_code == 200
    assert klien.post(f"{u}/pesanan/{p['id']}/ulasan", headers=w["kepala_umkm"],
                      json={**nilai, "aspek_kondisi_barang": 0}).status_code == 422

    r = klien.post(f"{u}/pesanan/{p['id']}/ulasan", headers=w["kepala_umkm"], json=nilai)
    assert r.status_code == 201 and r.json()["sudah_diulas"] is True, r.text
    assert klien.post(f"{u}/pesanan/{p['id']}/ulasan", headers=w["kepala_umkm"], json=nilai).status_code == 409
    katalog = klien.get(f"{u}/katalog", headers=w["kepala_umkm"]).json()
    [d] = [x for x in katalog["distributor"] if x["id"] == w["distributor"]]
    assert d["jumlah_ulasan"] == 1 and d["rating"] == 4
    [ul] = klien.get(f"{u}/distributor/{w['distributor']}/ulasan", headers=w["kepala_umkm"]).json()
    assert ul["isi"] == "Rapi." and ul["rating"] == 4 and ul["aspek_ketepatan_waktu"] == 5

    # Terbaca di kedua portal: menempel di pesanan, dan di daftar ulasan masing-masing.
    d = f"/distributor/{w['distributor']}"
    r = klien.get(f"{u}/pesanan/{p['id']}", headers=w["kepala_umkm"])
    assert r.json()["ulasan"]["rating"] == 4 and r.json()["ulasan"]["aspek_jumlah_sesuai"] == 4
    [masuk] = [x for x in klien.get(f"{d}/pesanan-masuk", headers=w["kepala_dist"]).json() if x["id"] == p["id"]]
    assert masuk["ulasan"]["isi"] == "Rapi."
    [saya] = klien.get(f"{u}/ulasan", headers=w["kepala_umkm"]).json()
    assert saya["nomor_pesanan"] == p["nomor"]
    [diterima] = klien.get(f"{d}/ulasan", headers=w["kepala_dist"]).json()
    assert diterima["nama_usaha"] == "Warung Uji Pesanan"
    # Daftar ulasan milik pihak lain tertutup.
    assert klien.get(f"{u}/ulasan", headers=w["kepala_dist"]).status_code == 403
    assert klien.get(f"{d}/ulasan", headers=w["kepala_umkm"]).status_code == 403


def test_pesanan_lama_bisa_dimuat_lewat_mulai(dunia):
    """Daftar berhalaman: `mulai` melewati pesanan terbaru, tanpa baris kembar di dua halaman."""
    w, klien = dunia, TestClient(app)
    ids = [_buat(klien, w)["id"] for _ in range(3)]
    u, d = f"/usaha/{w['usaha']}/pesanan", f"/distributor/{w['distributor']}/pesanan-masuk"
    for jalur, kepala in ((u, w["kepala_umkm"]), (d, w["kepala_dist"])):
        awal = klien.get(f"{jalur}?batas=2", headers=kepala).json()
        lanjut = klien.get(f"{jalur}?batas=2&mulai=2", headers=kepala).json()
        assert [x["id"] for x in awal] + [x["id"] for x in lanjut] == list(reversed(ids))
    # Rincian satu pesanan terbuka walau di luar halaman pertama.
    r = klien.get(f"/distributor/{w['distributor']}/pesanan/{ids[0]}", headers=w["kepala_dist"])
    assert r.status_code == 200 and r.json()["id"] == ids[0]


def test_barang_mencatat_yang_sudah_dipesan_sampai_diterima_atau_batal(dunia):
    """Stok ditambah angka ini yang dibandingkan dengan batas aman, supaya barang tidak disarankan dua kali."""
    w, klien = dunia, TestClient(app)
    u = f"/usaha/{w['usaha']}"

    def dipesan() -> Decimal:
        isi = klien.get(f"{u}/barang", headers=w["kepala_umkm"]).json()
        return Decimal(next(b for b in isi if b["id"] == w["barang"])["dalam_perjalanan"])

    assert dipesan() == 0
    # Dalam satuan simpan: 3 kemasan berisi 1.000 gram. Draf belum dikirim, jadi belum dihitung.
    _draf(w)
    assert dipesan() == 0
    p = _buat(klien, w, "3")
    assert dipesan() == 3000
    batal = _buat(klien, w, "2")
    assert dipesan() == 5000
    r = klien.post(f"{u}/pesanan/{batal['id']}/batal", headers=w["kepala_umkm"], json={"alasan": "Salah pesan"})
    assert r.status_code == 200, r.text
    assert dipesan() == 3000
    # Masih dihitung selama di jalan, hilang begitu diterima.
    _majukan_sampai_dikirim(klien, w, p["id"])
    assert dipesan() == 3000
    r = klien.post(
        f"{u}/pesanan/{p['id']}/terima",
        headers=w["kepala_umkm"],
        json={"baris": [{"baris_id": p["baris"][0]["id"], "jumlah_diterima": "3"}]},
    )
    assert r.status_code == 200, r.text
    assert dipesan() == 0


def test_kuota_kurang_tidak_memblokir_dan_akun_tanpa_nib_boleh_berkontrak(dunia):
    """
    Keputusan Ilham 4 Nov 2026. Fixture ini memang tanpa NIB dan belum terverifikasi: pengajuan
    kontrak tetap diterima. Kuota yang belum terpenuhi hanya peringatan: pesanan berikutnya, baik
    di dalam maupun di luar kontrak, tidak ditolak.
    """
    w, klien = dunia, TestClient(app)
    u, d = f"/usaha/{w['usaha']}", f"/distributor/{w['distributor']}"
    assert klien.get(f"{u}/profil", headers=w["kepala_umkm"]).json()["nib"] is None
    r = klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": _paket(w)})
    assert r.status_code == 201, r.text
    kid = r.json()["id"]
    assert klien.post(f"{d}/kontrak/{kid}/setujui", headers=w["kepala_dist"], json={}).status_code == 200

    # Kuota 10 per bulan, baru dipesan 1 di dalam kontrak dan 1 di luar kontrak.
    for baris in ({"penawaran_id": w["penawaran"], "jumlah": "1", "kontrak_id": kid},
                  {"penawaran_id": w["penawaran"], "jumlah": "1"}):
        r = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"], json={"baris": [baris]})
        assert r.status_code == 201, r.text


def test_pengajuan_kontrak_bisa_ditarik_sebelum_dijawab(dunia):
    w, klien = dunia, TestClient(app)
    u = f"/usaha/{w['usaha']}"
    paket = _paket(w)
    kid = klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": paket}).json()["id"]
    assert klien.post(f"{u}/kontrak/{kid}/tarik", headers=w["kepala_dist"]).status_code == 403
    assert klien.post(f"{u}/kontrak/{kid}/tarik", headers=w["kepala_umkm"]).status_code == 204
    assert kid not in [x["id"] for x in klien.get(f"{u}/kontrak", headers=w["kepala_umkm"]).json()]
    dist = klien.get(f"/distributor/{w['distributor']}/kontrak", headers=w["kepala_dist"]).json()
    assert kid not in [x["id"] for x in dist]
    assert klien.post(f"{u}/kontrak/{kid}/tarik", headers=w["kepala_umkm"]).status_code == 404
    # Sesudah disetujui, menarik tidak lagi berlaku.
    kid = klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": paket}).json()["id"]
    assert klien.post(f"/distributor/{w['distributor']}/kontrak/{kid}/setujui", headers=w["kepala_dist"], json={}).status_code == 200
    assert klien.post(f"{u}/kontrak/{kid}/tarik", headers=w["kepala_umkm"]).status_code == 409


def test_profil_usaha_disimpan_dan_verifikasi_tidak_bisa_diisi(dunia):
    w, klien = dunia, TestClient(app)
    jalur = f"/usaha/{w['usaha']}/profil"
    r = klien.get(jalur, headers=w["kepala_umkm"])
    assert r.status_code == 200 and r.json()["nama"] == "Warung Uji Pesanan" and r.json()["jenis_usaha"] == "kedai-kopi"
    assert klien.get(jalur, headers=w["kepala_dist"]).status_code == 403

    ubahan = {"bio": "  Kopi susu gula aren.  ", "warna": "#4a148c", "tampilkan_alamat": False, "email": "",
              "verifikasi": "terverifikasi"}
    assert klien.patch(jalur, headers=w["kepala_umkm"], json=ubahan).status_code == 200
    baru = klien.get(jalur, headers=w["kepala_umkm"]).json()
    assert baru["bio"] == "Kopi susu gula aren." and baru["warna"] == "#4a148c" and baru["tampilkan_alamat"] is False
    # Kolom "verifikasi" bukan isian: diabaikan, statusnya tetap.
    assert baru["email"] is None and baru["verifikasi"] == "menunggu" and baru["nama"] == "Warung Uji Pesanan"
    assert klien.patch(jalur, headers=w["kepala_umkm"], json={"nomor_hp": "12345"}).status_code == 422
    assert klien.patch(jalur, headers=w["kepala_umkm"], json={"nama": "   "}).status_code == 422

    with mesin().begin() as kon:
        kon.execute(text("UPDATE usaha SET verifikasi = 'terverifikasi' WHERE id = :u"), {"u": w["usaha"]})
    r = klien.patch(jalur, headers=w["kepala_umkm"], json={"nib": "1234567890123", "ajukan_verifikasi": True})
    assert r.json()["verifikasi"] == "menunggu" and r.json()["nib"] == "1234567890123"


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


def _penawaran_baru(**ubahan) -> dict:
    return {
        "nama": "Teh Melati Uji", "kategori": "Kopi & Teh", "satuan": "dus", "harga_satuan": 96000,
        "kemasan_isi": "2000", "satuan_isi": "gram", "stok_tersedia": "40", "keterangan": "Kemasan 2 kg",
        **ubahan,
    }


def _katalog_umkm(klien: TestClient, w: dict, penawaran_id: int) -> dict:
    isi = klien.get(f"/usaha/{w['usaha']}/katalog", headers=w["kepala_umkm"]).json()["penawaran"]
    return next(p for p in isi if p["id"] == penawaran_id)


def test_distributor_mengelola_penawaran_dan_pembeli_melihatnya(dunia):
    w, klien = dunia, TestClient(app)
    d, kepala = f"/distributor/{w['distributor']}", w["kepala_dist"]

    # Barang baru tersimpan dan terbaca di kedua portal.
    r = klien.post(f"{d}/penawaran", headers=kepala, json=_penawaran_baru())
    assert r.status_code == 201, r.text
    baru = r.json()
    assert baru["kemasan_nama"] == "dus" and baru["aktif"] is True
    assert any(p["id"] == baru["id"] for p in klien.get(f"{d}/katalog", headers=kepala).json()["penawaran"])
    assert Decimal(_katalog_umkm(klien, w, baru["id"])["stok_tersedia"]) == 40

    # Nama yang sama di katalog sendiri ditolak, termasuk beda huruf besar.
    assert klien.post(f"{d}/penawaran", headers=kepala, json=_penawaran_baru(nama="teh melati UJI")).status_code == 409
    # Nama produk yang sudah terdaftar tertaut ke gudang pembeli, dan satuannya harus sama.
    with mesin().connect() as kon:
        kanonik = kon.execute(text("SELECT nama_kanonik FROM produk_master WHERE id = :p"), {"p": w["produk"]}).scalar_one()
    r = klien.post(f"{d}/penawaran", headers=kepala, json=_penawaran_baru(nama=kanonik, satuan_isi="ml"))
    assert r.status_code == 422 and "gram" in r.json()["detail"]
    r = klien.post(f"{d}/penawaran", headers=kepala, json=_penawaran_baru(nama=kanonik))
    assert r.status_code == 201, r.text
    assert _katalog_umkm(klien, w, r.json()["id"])["barang_id_terkait"] == w["barang"]

    # Ubah: harga dan stok baru terbaca pembeli, stempel stoknya maju, satuan isi tidak bisa diganti.
    r = klien.put(f"{d}/penawaran/{baru['id']}", headers=kepala, json=_penawaran_baru(harga_satuan=90000, stok_tersedia="5"))
    assert r.status_code == 200, r.text
    assert r.json()["stok_diperbarui_pada"] >= baru["stok_diperbarui_pada"]
    dilihat = _katalog_umkm(klien, w, baru["id"])
    assert dilihat["harga_satuan"] == 90000 and Decimal(dilihat["stok_tersedia"]) == 5
    assert klien.put(f"{d}/penawaran/{baru['id']}", headers=kepala, json=_penawaran_baru(satuan_isi="pcs")).status_code == 422
    # Isian tidak sah ditolak.
    assert klien.post(f"{d}/penawaran", headers=kepala, json=_penawaran_baru(nama="Teh Lain", harga_satuan=0)).status_code == 422

    # Sembunyikan: masih terbaca dengan penandanya, tetapi tidak bisa dibeli lagi.
    r = klien.patch(f"{d}/penawaran/{baru['id']}", headers=kepala, json={"aktif": False})
    assert r.status_code == 200 and r.json()["aktif"] is False
    assert _katalog_umkm(klien, w, baru["id"])["aktif"] is False
    badan = {"baris": [{"penawaran_id": baru["id"], "jumlah": "1"}]}
    assert klien.post(f"/usaha/{w['usaha']}/pesanan", headers=w["kepala_umkm"], json=badan).status_code == 422
    assert klien.patch(f"{d}/penawaran/{baru['id']}", headers=kepala, json={"aktif": True}).status_code == 200
    assert klien.post(f"/usaha/{w['usaha']}/pesanan", headers=w["kepala_umkm"], json=badan).status_code == 201


def test_penawaran_distributor_lain_tidak_bisa_diubah(dunia):
    w, klien = dunia, TestClient(app)
    d = f"/distributor/{w['distributor']}"
    # Token distributor ini tidak berlaku untuk jalur distributor lain.
    r = klien.put(f"/distributor/{w['distributor'] + 1}/penawaran/{w['penawaran']}", headers=w["kepala_dist"], json=_penawaran_baru())
    assert r.status_code in (403, 404)
    # Penawaran milik distributor lain, lewat jalur sendiri.
    with mesin().begin() as kon:
        lain = kon.execute(
            text("SELECT id FROM penawaran WHERE distributor_id <> :d ORDER BY id LIMIT 1"), {"d": w["distributor"]}
        ).scalar()
    if lain is not None:
        assert klien.patch(f"{d}/penawaran/{lain}", headers=w["kepala_dist"], json={"aktif": False}).status_code == 404
    # Pemilik usaha bukan distributor.
    assert klien.post(f"{d}/penawaran", headers=w["kepala_umkm"], json=_penawaran_baru()).status_code in (401, 403)


def test_barang_baru_masuk_gudang_pembeli_saat_diterima(dunia):
    """Barang yang belum pernah ada di gudang pembeli dibuatkan saat diterima, lalu dipakai pesanan berikutnya."""
    w, klien = dunia, TestClient(app)
    d, u = f"/distributor/{w['distributor']}", f"/usaha/{w['usaha']}"
    pn = klien.post(f"{d}/penawaran", headers=w["kepala_dist"], json=_penawaran_baru()).json()
    assert _katalog_umkm(klien, w, pn["id"])["barang_id_terkait"] is None

    badan = {"baris": [{"penawaran_id": pn["id"], "jumlah": "3"}]}

    def terima(p: dict) -> None:
        _majukan_sampai_dikirim(klien, w, p["id"])
        r = klien.post(
            f"{u}/pesanan/{p['id']}/terima", headers=w["kepala_umkm"],
            json={"baris": [{"baris_id": p["baris"][0]["id"], "jumlah_diterima": "3"}]},
        )
        assert r.status_code == 200, r.text

    [p] = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"], json=badan).json()
    # Pesanan yang masih bisa batal belum menambah baris stok.
    assert not any(b["nama"] == pn["nama"] for b in klien.get(f"{u}/barang", headers=w["kepala_umkm"]).json())
    terima(p)

    barang = [b for b in klien.get(f"{u}/barang", headers=w["kepala_umkm"]).json() if b["nama"] == pn["nama"]]
    assert len(barang) == 1
    baru = barang[0]
    assert Decimal(baru["stok"]) == 6000 and baru["satuan"] == "gram" and baru["kemasan"][0]["nama"] == "dus"
    with mesin().connect() as kon:
        assert kon.execute(
            text("SELECT sum(jumlah) FROM pergerakan WHERE barang_id = :b"), {"b": baru["id"]}
        ).scalar_one() == 6000
    assert _katalog_umkm(klien, w, pn["id"])["barang_id_terkait"] == baru["id"]

    # Pesanan berikutnya masuk ke barang yang sama, tidak membuat baris kembar.
    [p2] = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"], json=badan).json()
    terima(p2)
    barang = [b for b in klien.get(f"{u}/barang", headers=w["kepala_umkm"]).json() if b["nama"] == pn["nama"]]
    assert len(barang) == 1 and Decimal(barang[0]["stok"]) == 12000


def test_kontrak_berjalan_tetap_dipakai_saat_barang_disembunyikan(dunia):
    """Layar menjanjikan kontrak yang sudah ada tidak terpengaruh, dan saran Mesin 2 tidak menawarkannya lagi."""
    w, klien = dunia, TestClient(app)
    u, d = f"/usaha/{w['usaha']}", f"/distributor/{w['distributor']}"
    r = klien.post(f"{u}/kontrak", headers=w["kepala_umkm"], json={"paket_id": _paket(w)})
    assert r.status_code == 201, r.text
    kid = r.json()["id"]
    assert klien.post(f"{d}/kontrak/{kid}/setujui", headers=w["kepala_dist"], json={}).status_code == 200

    sekarang = datetime.now(timezone.utc)
    with Session(mesin()) as sesi:
        sesi.add(RekomendasiSkor(
            usaha_id=w["usaha"], barang_id=w["barang"], distributor_id=w["distributor"], penawaran_id=w["penawaran"],
            p_sukses=0.9, skor=0.9, segmen="sangat-layak", alasan="Uji", model_nama="uji", model_versi="uji",
            dijalankan_pada=sekarang, kedaluwarsa_pada=sekarang,
        ))
        sesi.commit()
    jalur_saran = f"{u}/barang/{w['barang']}/saran"
    assert len(klien.get(jalur_saran, headers=w["kepala_umkm"]).json()) == 1

    assert klien.patch(f"{d}/penawaran/{w['penawaran']}", headers=w["kepala_dist"], json={"aktif": False}).status_code == 200

    assert klien.get(jalur_saran, headers=w["kepala_umkm"]).json() == []
    assert klien.get(f"{u}/saran-distributor", headers=w["kepala_umkm"]).json() == []
    daftar = klien.get(f"{u}/barang", headers=w["kepala_umkm"]).json()
    assert next(b for b in daftar if b["id"] == w["barang"])["penawaran_saran_id"] is None
    barang = {"penawaran_id": w["penawaran"], "jumlah": "1"}
    assert klien.post(f"{u}/pesanan", headers=w["kepala_umkm"], json={"baris": [barang]}).status_code == 422
    r = klien.post(f"{u}/pesanan", headers=w["kepala_umkm"], json={"baris": [{**barang, "kontrak_id": kid}]})
    assert r.status_code == 201, r.text


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
        # Daftar barang menunjuk penawaran teratas tiap barang, supaya semua layar sepakat.
        daftar = klien.get(f"/usaha/{w['usaha']}/barang", headers=w["kepala_umkm"]).json()
        saran = {b["id"]: b["penawaran_saran_id"] for b in daftar}
        assert saran[w["barang"]] == w["penawaran"] and saran[b2] == p2
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
