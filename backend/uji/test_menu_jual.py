"""
Uji menu Portal POS: menu dan harga diatur pemilik, POS hanya membaca.

Yang paling mahal kalau salah: menu yang belum berharga ikut tampil di kasir, menu
tanpa resep tidak bisa dijual, dan usaha lain bisa mengubah harga. Seperti
`test_struk.py`, uji ini membuat datanya sendiri lalu menghapusnya lagi.
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
from warungku.model import Barang, Keanggotaan, PemetaanMenu, PemetaanMenuBahan, Pengguna, Usaha

SANDI_UJI = "ujimenujual1"


def _usaha_uji(sesi: Session, cap: int, urut: int) -> tuple[int, int, str]:
    u = Usaha(
        nama="Kedai Uji POS %d" % urut,
        jenis_usaha=JenisUsaha.KEDAI_KOPI,
        nama_pemilik="Penguji",
        alamat="Jl. Uji No.3",
        kota="Yogyakarta",
        nomor_hp="08000000000%d" % urut,
        cara_hitung=CaraHitungStok.KEDUANYA,
        verifikasi=StatusVerifikasi.MENUNGGU,
        bergabung_sejak=datetime.now(timezone.utc).date(),
    )
    sesi.add(u)
    sesi.flush()
    email = "uji-pos-%d-%d@contoh.id" % (cap, urut)
    pemilik = Pengguna(
        nomor_hp="0897%d%07d" % (urut, cap % 10_000_000),
        email=email,
        kata_sandi_hash=acak_kata_sandi(SANDI_UJI),
        nama="Pemilik Uji POS",
    )
    sesi.add(pemilik)
    sesi.flush()
    sesi.add(Keanggotaan(pengguna_id=pemilik.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK))
    return u.id, pemilik.id, email


@pytest.fixture
def kedai():
    """Dua kedai. Kedai pertama punya satu bahan dan satu pemetaan bawaan tanpa harga."""
    cap = int(datetime.now(timezone.utc).timestamp() * 1000)
    with Session(mesin()) as sesi:
        u1, p1, email1 = _usaha_uji(sesi, cap, 1)
        u2, p2, email2 = _usaha_uji(sesi, cap, 2)
        kopi = Barang(
            usaha_id=u1,
            nama="Biji Kopi Uji",
            kategori="Uji",
            kode_barang="UJIKOP",
            satuan="gram",
            stok=Decimal("1000.000"),
            batas_aman=Decimal("10.000"),
            sumber_batas_aman=SumberBatasAman.SENDIRI,
            terhubung_kasir=True,
            dicatat_manual=False,
        )
        sesi.add(kopi)
        sesi.flush()
        bawaan = PemetaanMenu(usaha_id=u1, nama_menu="Biji Kopi Uji")
        americano = PemetaanMenu(usaha_id=u1, nama_menu="Americano")
        sesi.add_all([bawaan, americano])
        sesi.flush()
        sesi.add(PemetaanMenuBahan(pemetaan_id=bawaan.id, barang_id=kopi.id, takaran=Decimal("1")))
        sesi.add(PemetaanMenuBahan(pemetaan_id=americano.id, barang_id=kopi.id, takaran=Decimal("18")))
        sesi.commit()
        ids = {"u1": u1, "u2": u2, "p1": p1, "p2": p2, "kopi": kopi.id}

    klien = TestClient(app)

    def kepala(email: str) -> dict:
        masuk = klien.post("/auth/umkm/masuk", json={"email": email, "kata_sandi": SANDI_UJI})
        assert masuk.status_code == 200, masuk.text
        return {"Authorization": "Bearer " + masuk.json()["token"]}

    yield ids, kepala(email1), kepala(email2), klien

    with mesin().begin() as kon:
        for u in (ids["u1"], ids["u2"]):
            p = {"u": u}
            kon.execute(text("DELETE FROM pergerakan WHERE usaha_id = :u"), p)
            kon.execute(text("DELETE FROM permintaan_harian WHERE usaha_id = :u"), p)
            kon.execute(
                text("DELETE FROM transaksi_baris WHERE transaksi_id IN (SELECT id FROM transaksi WHERE usaha_id = :u)"),
                p,
            )
            kon.execute(text("DELETE FROM transaksi WHERE usaha_id = :u"), p)
            kon.execute(
                text(
                    "DELETE FROM pemetaan_menu_bahan WHERE pemetaan_id IN "
                    "(SELECT id FROM pemetaan_menu WHERE usaha_id = :u)"
                ),
                p,
            )
            kon.execute(text("DELETE FROM pemetaan_menu WHERE usaha_id = :u"), p)
            kon.execute(text("DELETE FROM barang WHERE usaha_id = :u"), p)
            kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), p)
            kon.execute(text("DELETE FROM usaha WHERE id = :u"), p)
        kon.execute(text("DELETE FROM pengguna WHERE id IN (:a, :b)"), {"a": ids["p1"], "b": ids["p2"]})


def _simpan(klien, u, kepala, nama="Americano", harga=18000, kategori="Minuman", aktif=True):
    return klien.put(
        f"/usaha/{u}/menu-jual",
        headers=kepala,
        json={"nama_menu": nama, "harga_jual": harga, "kategori": kategori, "aktif": aktif},
    )


def _nota(nomor: str, menu: str, harga: int) -> dict:
    return {
        "nomor_struk": nomor,
        "waktu": "2026-10-31T03:00:00+00:00",
        "kasir": "Portal POS",
        "sumber": "pos",
        "baris": [{"nama_menu": menu, "jumlah": 2, "satuan": "porsi", "harga_jual_satuan": harga}],
    }


def test_hanya_menu_berharga_yang_tampil(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    assert klien.get(f"/usaha/{u}/menu-jual", headers=kepala).json() == []
    assert _simpan(klien, u, kepala).status_code == 200
    # Pemetaan bawaan "Biji Kopi Uji" tanpa harga bukan menu kasir.
    assert [m["nama_menu"] for m in klien.get(f"/usaha/{u}/menu-jual", headers=kepala).json()] == ["Americano"]


def test_menu_tanpa_resep_boleh_dijual_dan_tidak_memotong_stok(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    baru = _simpan(klien, u, kepala, nama="Kentang Goreng", harga=15000, kategori="Makanan").json()
    assert baru["punya_resep"] is False

    r = klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("POS-UJI-1", "Kentang Goreng", 15000))
    assert r.status_code == 200, r.text
    assert r.json()["tak_dikenali"] == ["Kentang Goreng"]
    belum = klien.get(f"/usaha/{u}/menu-kasir", headers=kepala).json()["belum_dipasangkan"]
    assert [m["nama_menu"] for m in belum] == ["Kentang Goreng"]


def test_menu_beresep_memotong_stok_dan_harga_tidak_menyentuh_resep(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    menu = _simpan(klien, u, kepala).json()
    assert menu["punya_resep"] is True

    # Ejaan berbeda tetap menu yang sama, dan mengubah harga tidak membuang resep.
    ubah = _simpan(klien, u, kepala, nama=" americano ", harga=20000).json()
    assert ubah["nama_menu"] == "Americano" and ubah["harga_jual"] == 20000 and ubah["punya_resep"] is True

    r = klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("POS-UJI-2", "Americano", 20000))
    assert r.json()["tak_dikenali"] == []
    with mesin().connect() as kon:
        stok = kon.execute(text("SELECT stok FROM barang WHERE id = :b"), {"b": ids["kopi"]}).scalar_one()
    assert stok == Decimal("964.000")


def test_menu_dimatikan_tetap_terbaca_pemilik(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    _simpan(klien, u, kepala, aktif=False)
    [menu] = klien.get(f"/usaha/{u}/menu-jual", headers=kepala).json()
    assert menu["aktif"] is False


@pytest.mark.parametrize("isian", [{"harga_jual": 0}, {"harga_jual": -500}, {"nama_menu": "   "}])
def test_isian_tidak_sah_ditolak(kedai, isian):
    ids, kepala, _, klien = kedai
    badan = {"nama_menu": "Americano", "harga_jual": 18000, **isian}
    assert klien.put(f"/usaha/{ids['u1']}/menu-jual", headers=kepala, json=badan).status_code == 422


def test_usaha_lain_tidak_bisa_membaca_atau_mengubah(kedai):
    ids, kepala1, kepala2, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala1)
    assert klien.get(f"/usaha/{u}/menu-jual", headers=kepala2).status_code == 403
    assert _simpan(klien, u, kepala2, harga=1).status_code == 403
    assert klien.get(f"/usaha/{u}/menu-jual").status_code in (401, 403)
    assert klien.get(f"/usaha/{u}/menu-jual", headers=kepala1).json()[0]["harga_jual"] == 18000


def test_daftar_nota_membawa_harga_dan_bisa_berhalaman(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    for urut in range(3):
        nota = _nota("POS-UJI-H%d" % urut, "Americano", 18000)
        nota["waktu"] = "2026-10-31T0%d:00:00+00:00" % (3 + urut)
        assert klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=nota).status_code == 200

    semua = klien.get(f"/usaha/{u}/transaksi?batas=10", headers=kepala).json()
    assert [n["nomor_struk"] for n in semua] == ["POS-UJI-H2", "POS-UJI-H1", "POS-UJI-H0"]
    assert semua[0]["baris"][0]["harga_jual_satuan"] == 18000

    # Halaman kedua melewati satu nota terbaru, tanpa tumpang tindih dengan yang pertama.
    kedua = klien.get(f"/usaha/{u}/transaksi?batas=2&mulai=1", headers=kepala).json()
    assert [n["nomor_struk"] for n in kedua] == ["POS-UJI-H1", "POS-UJI-H0"]
    assert klien.get(f"/usaha/{u}/transaksi?batas=2&mulai=-1", headers=kepala).status_code == 422


def _bayar(klien, u, kepala, nomor, **tambahan):
    badan = _nota(nomor, "Americano", 18000)
    badan["baris"][0]["jumlah"] = 2
    badan.update(tambahan)
    return klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=badan)


def test_pembayaran_tersimpan_dan_terbaca(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    r = _bayar(klien, u, kepala, "POS-UJI-B1", cara_bayar="tunai", diskon=6000, uang_diterima=50000)
    assert r.status_code == 200, r.text
    [nota] = klien.get(f"/usaha/{u}/transaksi", headers=kepala).json()
    assert (nota["cara_bayar"], nota["diskon"], nota["uang_diterima"]) == ("tunai", 6000, 50000)

    # Uang diterima hanya berarti untuk tunai: QRIS tidak menyimpannya.
    _bayar(klien, u, kepala, "POS-UJI-B2", cara_bayar="qris", uang_diterima=99999)
    baru = klien.get(f"/usaha/{u}/transaksi?batas=1", headers=kepala).json()[0]
    assert (baru["cara_bayar"], baru["uang_diterima"]) == ("qris", None)


@pytest.mark.parametrize(
    "isian",
    [
        {"diskon": 36001},  # melebihi belanja 2 x 18.000
        {"cara_bayar": "tunai", "diskon": 6000, "uang_diterima": 29999},  # kurang dari total 30.000
        {"cara_bayar": "bitcoin"},
        {"diskon": -1},
    ],
)
def test_pembayaran_tidak_masuk_akal_ditolak_dan_stok_utuh(kedai, isian):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    assert _bayar(klien, u, kepala, "POS-UJI-X", **isian).status_code == 422
    assert klien.get(f"/usaha/{u}/transaksi", headers=kepala).json() == []
    with mesin().connect() as kon:
        stok = kon.execute(text("SELECT stok FROM barang WHERE id = :b"), {"b": ids["kopi"]}).scalar_one()
    assert stok == Decimal("1000.000")


def test_nota_lama_tanpa_pembayaran_tetap_diterima(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    assert klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("POS-UJI-L", "Americano", 18000)).status_code == 200
    [nota] = klien.get(f"/usaha/{u}/transaksi", headers=kepala).json()
    assert (nota["cara_bayar"], nota["diskon"], nota["uang_diterima"]) == (None, 0, None)


def test_ringkasan_memotong_diskon_dan_memisah_cara_bayar(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    _bayar(klien, u, kepala, "POS-UJI-R1", cara_bayar="tunai", diskon=6000, uang_diterima=30000)  # 36.000 - 6.000
    _bayar(klien, u, kepala, "POS-UJI-R2", cara_bayar="qris")  # 36.000
    klien.post(f"/usaha/{u}/transaksi", headers=kepala, json=_nota("POS-UJI-R3", "Americano", 18000))  # 36.000, tanpa cara bayar
    r = klien.get(f"/usaha/{u}/ringkasan-penjualan", headers=kepala).json()
    assert r["total"] == 30000 + 36000 + 36000 and r["jumlah_transaksi"] == 3
    assert {x["label"]: x["nilai"] for x in r["rincian"]} == {"Tunai": 30000, "QRIS": 36000, "Transfer": 0, "Belum dicatat": 36000}
    # Terlaris tetap harga baris sebelum diskon.
    assert r["terlaris"][0]["total"] == 3 * 36000


def _stok(barang_id: int) -> Decimal:
    with mesin().connect() as kon:
        return kon.execute(text("SELECT stok FROM barang WHERE id = :b"), {"b": barang_id}).scalar_one()


def _jumlah_pergerakan(barang_id: int) -> Decimal:
    with mesin().connect() as kon:
        return kon.execute(text("SELECT COALESCE(SUM(jumlah), 0) FROM pergerakan WHERE barang_id = :b"), {"b": barang_id}).scalar_one()


def test_batal_mengembalikan_stok_dan_buku_besar_tetap_utuh(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    assert _bayar(klien, u, kepala, "POS-UJI-K1", cara_bayar="qris").status_code == 200  # 2 x 18 g
    assert _stok(ids["kopi"]) == Decimal("964.000")

    r = klien.post(f"/usaha/{u}/transaksi/POS-UJI-K1/batal", headers=kepala, json={"alasan": "Salah pesan"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "dibatalkan" and r.json()["stok_dikembalikan"] == ["Biji Kopi Uji"]
    assert _stok(ids["kopi"]) == Decimal("1000.000")
    # Jumlah semua pergerakan tetap sama dengan stok: pembatalan menambah baris, tidak mengubah yang lama.
    with mesin().connect() as kon:
        awal = kon.execute(text("SELECT COALESCE(SUM(jumlah), 0) FROM pergerakan WHERE barang_id = :b AND jenis = 'terjual'"), {"b": ids["kopi"]}).scalar_one()
    assert awal == Decimal("-36.000") and _jumlah_pergerakan(ids["kopi"]) == Decimal("0.000")

    # Nota batal hilang dari daftar dan dari ringkasan, tetapi nomornya tetap terpakai.
    assert klien.get(f"/usaha/{u}/transaksi", headers=kepala).json() == []
    ringkasan = klien.get(f"/usaha/{u}/ringkasan-penjualan", headers=kepala).json()
    assert ringkasan["total"] == 0 and ringkasan["jumlah_transaksi"] == 0
    ulang = _bayar(klien, u, kepala, "POS-UJI-K1", cara_bayar="qris")
    assert ulang.json()["sudah_ada"] is True and _stok(ids["kopi"]) == Decimal("1000.000")


def test_batal_diulang_tidak_mengembalikan_stok_dua_kali(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    _bayar(klien, u, kepala, "POS-UJI-K2")
    pertama = klien.post(f"/usaha/{u}/transaksi/POS-UJI-K2/batal", headers=kepala, json={"alasan": "Salah catat"})
    kedua = klien.post(f"/usaha/{u}/transaksi/POS-UJI-K2/batal", headers=kepala, json={"alasan": "Salah catat"})
    assert (pertama.json()["status"], kedua.json()["status"]) == ("dibatalkan", "sudah-dibatalkan")
    assert _stok(ids["kopi"]) == Decimal("1000.000")


def test_batal_hanya_mengembalikan_yang_dulu_terpotong(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    with mesin().begin() as kon:
        kon.execute(text("UPDATE barang SET stok = 10 WHERE id = :b"), {"b": ids["kopi"]})
    assert _bayar(klien, u, kepala, "POS-UJI-K3").json()["stok_kurang"] == ["Biji Kopi Uji"]  # butuh 36, hanya ada 10
    assert _stok(ids["kopi"]) == Decimal("0.000")
    klien.post(f"/usaha/{u}/transaksi/POS-UJI-K3/batal", headers=kepala, json={"alasan": "Pembeli batal"})
    assert _stok(ids["kopi"]) == Decimal("10.000")


def test_pengajuan_tidak_mengubah_stok_sampai_pemilik_membatalkan(kedai):
    ids, kepala, _, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala)
    _bayar(klien, u, kepala, "POS-UJI-K4")
    r = klien.post(f"/usaha/{u}/transaksi/POS-UJI-K4/ajukan-batal", headers=kepala, json={"alasan": "Pembeli berubah pikiran"})
    assert r.json()["status"] == "diajukan"
    [nota] = klien.get(f"/usaha/{u}/transaksi", headers=kepala).json()
    assert nota["pengajuan_batal"] == "Pembeli berubah pikiran"
    assert _stok(ids["kopi"]) == Decimal("964.000")
    klien.post(f"/usaha/{u}/transaksi/POS-UJI-K4/batal", headers=kepala, json={"alasan": "Disetujui"})
    assert klien.post(f"/usaha/{u}/transaksi/POS-UJI-K4/ajukan-batal", headers=kepala, json={"alasan": "Terlambat"}).json()["status"] == "sudah-dibatalkan"


def test_batal_nota_tidak_ada_atau_milik_usaha_lain_atau_alasan_kosong(kedai):
    ids, kepala1, kepala2, klien = kedai
    u = ids["u1"]
    _simpan(klien, u, kepala1)
    _bayar(klien, u, kepala1, "POS-UJI-K5")
    assert klien.post(f"/usaha/{u}/transaksi/TIDAK-ADA/batal", headers=kepala1, json={"alasan": "Coba"}).status_code == 404
    assert klien.post(f"/usaha/{u}/transaksi/POS-UJI-K5/batal", headers=kepala2, json={"alasan": "Curang"}).status_code == 403
    assert klien.post(f"/usaha/{ids['u2']}/transaksi/POS-UJI-K5/batal", headers=kepala2, json={"alasan": "Coba"}).status_code == 404
    assert klien.post(f"/usaha/{u}/transaksi/POS-UJI-K5/batal", headers=kepala1, json={"alasan": "x"}).status_code == 422
    assert _stok(ids["kopi"]) == Decimal("964.000")
