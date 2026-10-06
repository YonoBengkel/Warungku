"""
Uji otentikasi: dua pintu, dua token, dan penjagaan alamat.

Yang diuji di sini adalah hal-hal yang **tidak terlihat sebagai galat** kalau
salah. Endpoint tanpa penjagaan tetap menjawab 200 dengan data yang benar —
hanya saja data itu milik orang lain. Tidak ada yang akan curiga sampai
seseorang mencoba mengganti angka di alamat.

    python -m pytest uji/test_otentikasi.py -q
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, select

from api.otentikasi import acak_kata_sandi
from api.utama import app
from warungku.basis_data import mesin
from warungku.enum import PeranPengguna
from warungku.model import Distributor, Keanggotaan, Pengguna, Usaha

SANDI = "warungku123"


@pytest.fixture(scope="module")
def klien():
    return TestClient(app)


@pytest.fixture(scope="module")
def akun():
    """
    Ambil satu pemilik usaha dan satu distributor dari data contoh.

    Dipakai data yang sudah ada, bukan membuat akun baru, justru supaya uji ini
    ikut membuktikan bahwa pembangkit dataset menulis hash kata sandi yang
    benar-benar bisa dipakai masuk — bukan teks tempelan seperti versi lama.
    """
    with Session(mesin()) as sesi:
        anggota = sesi.exec(select(Keanggotaan).order_by(Keanggotaan.id)).first()
        pemilik = sesi.get(Pengguna, anggota.pengguna_id)
        usaha = sesi.get(Usaha, anggota.usaha_id)
        dist = sesi.exec(
            select(Distributor).where(Distributor.pengguna_id.is_not(None)).order_by(Distributor.id)
        ).first()
        pengguna_dist = sesi.get(Pengguna, dist.pengguna_id)
        return {
            "umkm_email": pemilik.email,
            "usaha_id": usaha.id,
            "dist_email": pengguna_dist.email,
            "distributor_id": dist.id,
        }


def _token(klien, pintu: str, email: str) -> str:
    r = klien.post("/auth/%s/masuk" % pintu, json={"email": email, "kata_sandi": SANDI})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --------------------------------------------------------------------------
def test_hash_dari_pembangkit_bisa_dipakai_masuk(klien, akun):
    r = klien.post(
        "/auth/umkm/masuk", json={"email": akun["umkm_email"], "kata_sandi": SANDI}
    )
    assert r.status_code == 200, r.text
    isi = r.json()
    assert isi["peran"] == "umkm"
    assert isi["usaha_id"] == akun["usaha_id"]
    assert isi["distributor_id"] is None


def test_kata_sandi_salah_ditolak(klien, akun):
    r = klien.post(
        "/auth/umkm/masuk", json={"email": akun["umkm_email"], "kata_sandi": "salahsekali"}
    )
    assert r.status_code == 401


def test_email_tidak_ada_pesannya_sama_dengan_sandi_salah(klien, akun):
    """
    Membedakan keduanya memberi tahu penebak bahwa emailnya benar, dan itu
    separuh pekerjaan menebak sudah selesai.
    """
    a = klien.post("/auth/umkm/masuk", json={"email": akun["umkm_email"], "kata_sandi": "salah1234"})
    b = klien.post("/auth/umkm/masuk", json={"email": "tidakada@warungku.test", "kata_sandi": "salah1234"})
    assert a.status_code == b.status_code == 401
    assert a.json()["detail"] == b.json()["detail"]


def test_distributor_di_pintu_umkm_diberi_tahu_pintu_yang_benar(klien, akun):
    r = klien.post(
        "/auth/umkm/masuk", json={"email": akun["dist_email"], "kata_sandi": SANDI}
    )
    assert r.status_code == 403
    assert "distributor" in r.json()["detail"].lower()


def test_umkm_di_pintu_distributor_diberi_tahu_pintu_yang_benar(klien, akun):
    r = klien.post(
        "/auth/distributor/masuk", json={"email": akun["umkm_email"], "kata_sandi": SANDI}
    )
    assert r.status_code == 403
    assert "umkm" in r.json()["detail"].lower()


# --------------------------------------------------------------------------
def test_tanpa_token_ditolak(klien, akun):
    assert klien.get("/usaha/%d/barang" % akun["usaha_id"]).status_code == 401


def test_token_palsu_ditolak(klien, akun):
    r = klien.get(
        "/usaha/%d/barang" % akun["usaha_id"],
        headers={"Authorization": "Bearer bukan.token.sungguhan"},
    )
    assert r.status_code == 401


def test_token_umkm_hanya_membuka_usahanya_sendiri(klien, akun):
    """
    Inilah lubang yang ditutup otentikasi: sebelumnya setiap endpoint menerima
    usaha_id dari alamat dan mempercayainya, jadi mengganti satu angka sudah
    cukup untuk membaca stok warung orang lain.
    """
    t = _token(klien, "umkm", akun["umkm_email"])
    h = {"Authorization": "Bearer " + t}

    sendiri = klien.get("/usaha/%d/barang" % akun["usaha_id"], headers=h)
    assert sendiri.status_code == 200

    orang_lain = klien.get("/usaha/%d/barang" % (akun["usaha_id"] + 1), headers=h)
    assert orang_lain.status_code == 403


def test_token_umkm_tidak_membuka_portal_distributor(klien, akun):
    t = _token(klien, "umkm", akun["umkm_email"])
    r = klien.get(
        "/distributor/%d/segmen" % akun["distributor_id"],
        headers={"Authorization": "Bearer " + t},
    )
    assert r.status_code == 403


def test_token_distributor_hanya_membuka_dirinya_sendiri(klien, akun):
    t = _token(klien, "distributor", akun["dist_email"])
    h = {"Authorization": "Bearer " + t}
    assert klien.get("/distributor/%d/pesanan" % akun["distributor_id"], headers=h).status_code == 200
    assert klien.get("/distributor/%d/pesanan" % (akun["distributor_id"] + 1), headers=h).status_code == 403


def test_saya_mengembalikan_identitas_pemegang_token(klien, akun):
    t = _token(klien, "umkm", akun["umkm_email"])
    r = klien.get("/auth/saya", headers={"Authorization": "Bearer " + t})
    assert r.status_code == 200
    assert r.json()["peran"] == "umkm"
    assert r.json()["usaha_id"] == akun["usaha_id"]


# --------------------------------------------------------------------------
def test_daftar_membuat_akun_dan_usaha_lalu_bisa_masuk(klien):
    # Domain sungguhan, bukan `.test`: endpoint daftar sengaja memeriksa
    # alamat secara ketat, dan `.test` adalah domain cadangan yang ditolak.
    email = "uji-daftar-%s@contoh.id" % datetime.now(timezone.utc).strftime("%H%M%S%f")
    badan = {
        "email": email,
        "kata_sandi": "rahasia123",
        "nama": "Penguji Daftar",
        "nomor_hp": "081200000000",
        "nama_usaha": "Warung Uji Daftar",
        "jenis_usaha": "kedai-kopi",
        "kota": "Sleman",
        "alamat": "Jl. Uji Daftar No.1",
    }
    r = klien.post("/auth/umkm/daftar", json=badan)
    assert r.status_code == 201, r.text
    usaha_id = r.json()["usaha_id"]

    # Email yang sama ditolak — bukan membuat akun kedua diam-diam.
    assert klien.post("/auth/umkm/daftar", json=badan).status_code == 409

    masuk = klien.post("/auth/umkm/masuk", json={"email": email, "kata_sandi": "rahasia123"})
    assert masuk.status_code == 200
    assert masuk.json()["usaha_id"] == usaha_id

    with mesin().begin() as kon:
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), {"u": usaha_id})
        kon.execute(text("DELETE FROM usaha WHERE id = :u"), {"u": usaha_id})
        kon.execute(text("DELETE FROM pengguna WHERE email = :e"), {"e": email})
