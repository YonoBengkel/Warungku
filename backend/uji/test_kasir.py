"""
Uji akun kasir dan shift Portal POS.

Yang paling mahal kalau salah: kasir bisa membatalkan nota atau mengubah harga (celah
kecurangan yang paling umum), akun kasir bisa membuka Portal UMKM, dan selisih kas dihitung
dari nota yang salah. Token kasir hanya diterima endpoint di daftar pendek `kasir_atau_pemilik`,
jadi uji ini memeriksa dua sisi: yang boleh, dan sisanya yang harus ditolak.

Fixture `kedai` dan pembantunya dipinjam dari `test_menu_jual.py`. Fixture `kasir` di sini
menghapus akun dan shift yang dibuatnya sebelum fixture `kedai` menghapus usahanya.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text

from test_menu_jual import SANDI_UJI, _bayar, _nota, _simpan, kedai  # noqa: F401  (kedai dipakai pytest)
from warungku.basis_data import mesin

SANDI_KASIR = "kasirpos123"


@pytest.fixture
def kasir(kedai):  # noqa: F811
    """Pemilik membuat satu akun kasir, lalu kasir itu masuk lewat pintu POS."""
    ids, kepala_pemilik, kepala_lain, klien = kedai
    u = ids["u1"]
    email = "kasir-uji-%d@contoh.id" % ids["p1"]
    dibuat = klien.post(
        f"/usaha/{u}/kasir",
        headers=kepala_pemilik,
        json={"nama": "Kasir Uji", "email": email, "nomor_hp": "0899%07d" % (ids["p1"] % 10_000_000), "kata_sandi": SANDI_KASIR},
    )
    assert dibuat.status_code == 201, dibuat.text
    masuk = klien.post("/auth/pos/masuk", json={"email": email, "kata_sandi": SANDI_KASIR})
    assert masuk.status_code == 200, masuk.text
    kepala_kasir = {"Authorization": "Bearer " + masuk.json()["token"]}

    yield ids, kepala_pemilik, kepala_kasir, klien, email, masuk.json()

    with mesin().begin() as kon:
        p = {"u": u}
        kon.execute(text("UPDATE transaksi SET shift_id = NULL WHERE usaha_id = :u"), p)
        kon.execute(text("DELETE FROM shift_kas WHERE usaha_id = :u"), p)
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u AND peran = 'pegawai'"), p)
        kon.execute(text("DELETE FROM pengguna WHERE email = :e"), {"e": email})


def test_kasir_masuk_lewat_pos_dengan_token_jenis_kasir(kasir):
    ids, _, _, klien, email, jawaban = kasir
    assert jawaban["peran"] == "kasir" and jawaban["usaha_id"] == ids["u1"]
    # Pintu Portal UMKM menolak akun kasir dengan penjelasan.
    tolak = klien.post("/auth/umkm/masuk", json={"email": email, "kata_sandi": SANDI_KASIR})
    assert tolak.status_code == 403 and "Portal POS" in tolak.json()["detail"]


def test_pemilik_masuk_lewat_pos_tetap_token_umkm(kedai):
    ids, kepala, _, klien = kedai
    saya = klien.get("/auth/saya", headers=kepala).json()
    assert saya["peran"] == "umkm"


def test_kasir_boleh_menjual_membaca_menu_dan_mengajukan_batal(kasir):
    ids, kepala_pemilik, kepala_kasir, klien, _, _ = kasir
    u = ids["u1"]
    _simpan(klien, u, kepala_pemilik)
    assert klien.get(f"/usaha/{u}/menu-jual", headers=kepala_kasir).status_code == 200
    assert _bayar(klien, u, kepala_kasir, "POS-UJI-S1", cara_bayar="tunai").status_code == 200
    assert klien.get(f"/usaha/{u}/transaksi", headers=kepala_kasir).status_code == 200
    ajukan = klien.post(f"/usaha/{u}/transaksi/POS-UJI-S1/ajukan-batal", headers=kepala_kasir, json={"alasan": "Salah pesan"})
    assert ajukan.json()["status"] == "diajukan"


def test_kasir_ditolak_di_semua_yang_lain_dan_stok_tidak_berubah(kasir):
    ids, kepala_pemilik, kepala_kasir, klien, _, _ = kasir
    u = ids["u1"]
    _simpan(klien, u, kepala_pemilik)
    _bayar(klien, u, kepala_kasir, "POS-UJI-S2", cara_bayar="tunai")

    ditolak = [
        klien.post(f"/usaha/{u}/transaksi/POS-UJI-S2/batal", headers=kepala_kasir, json={"alasan": "Curang"}),
        klien.put(f"/usaha/{u}/menu-jual", headers=kepala_kasir, json={"nama_menu": "Americano", "harga_jual": 1}),
        klien.put(f"/usaha/{u}/menu-kasir", headers=kepala_kasir, json={"nama_menu": "Americano", "bahan": [{"barang_id": ids["kopi"], "takaran": 1}]}),
        klien.get(f"/usaha/{u}/barang", headers=kepala_kasir),
        klien.get(f"/usaha/{u}/ringkasan-penjualan", headers=kepala_kasir),
        klien.get(f"/usaha/{u}/menu-kasir", headers=kepala_kasir),
        klien.get(f"/usaha/{u}/kasir", headers=kepala_kasir),
        klien.post(f"/usaha/{u}/kasir", headers=kepala_kasir, json={"nama": "Dia", "email": "dia@contoh.id", "nomor_hp": "08123456789", "kata_sandi": "rahasia123"}),
        klien.get(f"/usaha/{u}/shift", headers=kepala_kasir),
    ]
    assert [r.status_code for r in ditolak] == [403] * len(ditolak)
    # Nota tetap ada, dan harga di POS tidak berubah.
    assert klien.get(f"/usaha/{u}/transaksi", headers=kepala_pemilik).json()[0]["nomor_struk"] == "POS-UJI-S2"
    assert klien.get(f"/usaha/{u}/menu-jual", headers=kepala_pemilik).json()[0]["harga_jual"] == 18000


def test_kasir_tidak_bisa_masuk_ke_usaha_lain(kasir):
    ids, _, kepala_kasir, klien, _, _ = kasir
    assert klien.get(f"/usaha/{ids['u2']}/menu-jual", headers=kepala_kasir).status_code == 403
    assert klien.get(f"/usaha/{ids['u2']}/shift/aktif", headers=kepala_kasir).status_code == 403


def test_kelola_kasir_nonaktif_atur_sandi_dan_duplikat(kasir):
    ids, kepala_pemilik, _, klien, email, _ = kasir
    u = ids["u1"]
    [akun] = klien.get(f"/usaha/{u}/kasir", headers=kepala_pemilik).json()
    assert akun["email"] == email and akun["aktif"] is True
    # Email atau nomor HP yang sudah dipakai ditolak.
    dobel = klien.post(f"/usaha/{u}/kasir", headers=kepala_pemilik, json={"nama": "Lain", "email": email, "nomor_hp": "08777777777", "kata_sandi": "rahasia123"})
    assert dobel.status_code == 409

    # Nonaktif: tidak bisa masuk lagi. Aktif lagi dengan kata sandi baru: bisa.
    assert klien.patch(f"/usaha/{u}/kasir/{akun['pengguna_id']}", headers=kepala_pemilik, json={"aktif": False}).json()["aktif"] is False
    assert klien.post("/auth/pos/masuk", json={"email": email, "kata_sandi": SANDI_KASIR}).status_code == 403
    klien.patch(f"/usaha/{u}/kasir/{akun['pengguna_id']}", headers=kepala_pemilik, json={"aktif": True, "kata_sandi": "sandibaru456"})
    assert klien.post("/auth/pos/masuk", json={"email": email, "kata_sandi": SANDI_KASIR}).status_code == 401
    assert klien.post("/auth/pos/masuk", json={"email": email, "kata_sandi": "sandibaru456"}).status_code == 200
    # Pemilik usaha lain tidak bisa mengubah kasir ini.
    assert klien.patch(f"/usaha/{ids['u2']}/kasir/{akun['pengguna_id']}", headers=kedai_lain(kasir), json={"aktif": False}).status_code == 404


def kedai_lain(kasir):
    """Kepala pemilik usaha kedua dari fixture kedai."""
    ids, _, _, klien, _, _ = kasir
    with mesin().connect() as kon:
        email = kon.execute(text("SELECT email FROM pengguna WHERE id = :p"), {"p": ids["p2"]}).scalar_one()
    masuk = klien.post("/auth/umkm/masuk", json={"email": email, "kata_sandi": SANDI_UJI})
    return {"Authorization": "Bearer " + masuk.json()["token"]}


def test_shift_buka_jual_tutup_dan_selisih(kasir):
    ids, kepala_pemilik, kepala_kasir, klien, _, _ = kasir
    u = ids["u1"]
    _simpan(klien, u, kepala_pemilik)
    assert klien.get(f"/usaha/{u}/shift/aktif", headers=kepala_kasir).json() is None
    assert klien.post(f"/usaha/{u}/shift/tutup", headers=kepala_kasir, json={"uang_dihitung": 0}).status_code == 409

    buka = klien.post(f"/usaha/{u}/shift/buka", headers=kepala_kasir, json={"modal_awal": 100000})
    assert buka.status_code == 201 and buka.json()["nama_kasir"] == "Kasir Uji"
    assert klien.post(f"/usaha/{u}/shift/buka", headers=kepala_kasir, json={"modal_awal": 5}).status_code == 409

    _bayar(klien, u, kepala_kasir, "POS-UJI-T1", cara_bayar="tunai", diskon=6000, uang_diterima=30000)  # 36.000 - 6.000 = 30.000
    _bayar(klien, u, kepala_kasir, "POS-UJI-T2", cara_bayar="qris")  # 36.000, tidak masuk laci
    _bayar(klien, u, kepala_kasir, "POS-UJI-T3", cara_bayar="tunai")  # 36.000, lalu dibatalkan pemilik
    klien.post(f"/usaha/{u}/transaksi/POS-UJI-T3/batal", headers=kepala_pemilik, json={"alasan": "Salah catat"})

    hidup = klien.get(f"/usaha/{u}/shift/aktif", headers=kepala_kasir).json()
    assert (hidup["jumlah_nota"], hidup["tunai"], hidup["qris"], hidup["tunai_diharapkan"]) == (2, 30000, 36000, 130000)

    # Laci kurang 5.000 dari yang diharapkan 130.000.
    tutup = klien.post(f"/usaha/{u}/shift/tutup", headers=kepala_kasir, json={"uang_dihitung": 125000, "catatan": "Uang receh kurang"})
    assert tutup.status_code == 200, tutup.text
    t = tutup.json()
    assert (t["tunai_diharapkan"], t["uang_dihitung"], t["selisih"]) == (130000, 125000, -5000)
    assert klien.get(f"/usaha/{u}/shift/aktif", headers=kepala_kasir).json() is None

    # Rekap tertutup dibekukan: pembatalan sesudahnya tidak mengubahnya.
    klien.post(f"/usaha/{u}/transaksi/POS-UJI-T1/batal", headers=kepala_pemilik, json={"alasan": "Pembeli batal"})
    [riwayat] = klien.get(f"/usaha/{u}/shift", headers=kepala_pemilik).json()
    assert (riwayat["tunai"], riwayat["selisih"], riwayat["jumlah_nota"]) == (30000, -5000, 2)

    # Sesudah ditutup, shift baru boleh dibuka.
    assert klien.post(f"/usaha/{u}/shift/buka", headers=kepala_kasir, json={"modal_awal": 0}).status_code == 201


def test_modal_negatif_ditolak(kasir):
    ids, _, kepala_kasir, klien, _, _ = kasir
    assert klien.post(f"/usaha/{ids['u1']}/shift/buka", headers=kepala_kasir, json={"modal_awal": -1}).status_code == 422
