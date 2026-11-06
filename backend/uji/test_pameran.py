"""
Uji mode pameran: akun simulasi tidak bisa menulis, tim booth tetap bisa, dan akun biasa tidak berubah.

Rute tulis dibaca dari aplikasinya sendiri, bukan didaftar di sini, supaya rute baru ikut teruji.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from api import pameran
from api.otentikasi import ALGORITMA, acak_kata_sandi, rahasia
from api.utama import app
from warungku.basis_data import mesin
from warungku.enum import CaraHitungStok, JenisUsaha, PeranPengguna, StatusVerifikasi
from warungku.model import Keanggotaan, Pengguna, Usaha

SANDI_BOOTH = "sandi-booth-untuk-uji"
SANDI_PUBLIK = "sandi-publik-untuk-uji"
EMAIL = "uji-pameran@warungku.test"
EMAIL_BIASA = "uji-pameran-biasa@contoh.test"
HP = ("0899000001", "0899000002")


@pytest.fixture
def klien():
    return TestClient(app)


@pytest.fixture
def pameran_menyala(monkeypatch):
    monkeypatch.setenv("WARUNGKU_SANDI_BOOTH", SANDI_BOOTH)
    pameran._percobaan.clear()
    yield
    pameran._percobaan.clear()


def _bersihkan(kon):
    pengguna = list(
        kon.execute(text("SELECT id FROM pengguna WHERE email = ANY(:e)"), {"e": [EMAIL, EMAIL_BIASA]}).scalars()
    )
    usaha = list(
        kon.execute(
            text("SELECT usaha_id FROM keanggotaan WHERE pengguna_id = ANY(:p)"), {"p": pengguna}
        ).scalars()
    )
    kon.execute(text("DELETE FROM keanggotaan WHERE pengguna_id = ANY(:p)"), {"p": pengguna})
    kon.execute(text("DELETE FROM pergerakan WHERE barang_id IN (SELECT id FROM barang WHERE usaha_id = ANY(:u))"), {"u": usaha})
    kon.execute(text("DELETE FROM barang WHERE usaha_id = ANY(:u)"), {"u": usaha})
    kon.execute(text("DELETE FROM usaha WHERE id = ANY(:u)"), {"u": usaha})
    kon.execute(text("DELETE FROM pengguna WHERE id = ANY(:p)"), {"p": pengguna})


@pytest.fixture
def akun():
    """Satu akun bersuffiks simulasi dan satu akun biasa, masing-masing punya usaha."""
    hash_sandi = acak_kata_sandi(SANDI_PUBLIK)
    with mesin().begin() as kon:
        _bersihkan(kon)
    hasil = {}
    with Session(mesin()) as sesi:
        for email, hp in ((EMAIL, HP[0]), (EMAIL_BIASA, HP[1])):
            pengguna = Pengguna(nomor_hp=hp, email=email, kata_sandi_hash=hash_sandi, nama="Uji Pameran")
            usaha = Usaha(
                nama="Usaha Uji Pameran", jenis_usaha=JenisUsaha.KEDAI_KOPI, nama_pemilik="Uji Pameran",
                alamat="Jl. Uji Pameran", kota="Sleman", nomor_hp=hp, cara_hitung=CaraHitungStok.KEMASAN,
                verifikasi=StatusVerifikasi.TERVERIFIKASI, bergabung_sejak=datetime.now(timezone.utc).date(),
            )
            sesi.add(pengguna)
            sesi.add(usaha)
            sesi.flush()
            sesi.add(Keanggotaan(pengguna_id=pengguna.id, usaha_id=usaha.id, peran=PeranPengguna.PEMILIK))
            hasil[email] = usaha.id
        sesi.commit()
    yield hasil
    with mesin().begin() as kon:
        _bersihkan(kon)


def _token_baca_saja() -> str:
    isi = {
        "sub": "1", "peran": "umkm", "usaha_id": 1, "baca_saja": True,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(isi, rahasia(), algorithm=ALGORITMA)


def _rute_tulis():
    for r in app.routes:
        if isinstance(r, APIRoute):
            for metode in r.methods - {"GET", "HEAD", "OPTIONS"}:
                yield metode, r.path


def test_semua_rute_tulis_menolak_token_baca_saja(klien):
    kepala = {"Authorization": f"Bearer {_token_baca_saja()}"}
    terperiksa = 0
    for metode, jalur in _rute_tulis():
        if jalur.startswith("/auth/"):
            continue  # Pintu masuk tidak memakai token.
        alamat = re.sub(r"{[^}]+}", "1", jalur)
        r = klien.request(metode, alamat, headers=kepala, json={})
        if jalur.startswith("/bayar/"):
            # Rute publik QR simulasi tidak memakai token, tetapi token baca saja tetap tidak boleh menulis.
            assert r.status_code == 403, (metode, jalur)
        else:
            assert r.status_code == 403 and r.json().get("baca_saja") is True, (metode, jalur, r.status_code)
        terperiksa += 1
    assert terperiksa >= 40


def test_penolakan_terbaca_peramban_lintas_asal(klien):
    r = klien.post(
        "/usaha/1/barang",
        headers={"Authorization": f"Bearer {_token_baca_saja()}", "Origin": "http://localhost:5173"},
        json={},
    )
    assert r.status_code == 403
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_token_baca_saja_tetap_bisa_membaca_rute_yang_ada(klien):
    r = klien.get("/sehat", headers={"Authorization": f"Bearer {_token_baca_saja()}"})
    assert r.status_code == 200


def test_akun_simulasi_baca_saja_dan_booth_tetap_menulis(klien, akun, pameran_menyala):
    uid = akun[EMAIL]
    baru = {"nama": "Barang Uji Pameran", "kategori": "Bahan", "satuan": "kg", "stok_awal": "1", "batas_aman": "1"}

    r = klien.post("/auth/umkm/masuk", json={"email": EMAIL, "kata_sandi": SANDI_PUBLIK})
    assert r.status_code == 200, r.text
    assert r.json()["baca_saja"] is True
    kepala = {"Authorization": f"Bearer {r.json()['token']}"}
    assert klien.get(f"/usaha/{uid}/barang", headers=kepala).status_code == 200
    r = klien.post(f"/usaha/{uid}/barang", headers=kepala, json=baru)
    assert r.status_code == 403
    assert "tidak disimpan" in r.json()["detail"]
    with mesin().connect() as kon:
        assert kon.execute(text("SELECT count(*) FROM barang WHERE usaha_id = :u"), {"u": uid}).scalar_one() == 0

    r = klien.post("/auth/umkm/masuk", json={"email": EMAIL, "kata_sandi": SANDI_BOOTH})
    assert r.status_code == 200, r.text
    assert not r.json()["baca_saja"]
    r = klien.post(f"/usaha/{uid}/barang", headers={"Authorization": f"Bearer {r.json()['token']}"}, json=baru)
    assert r.status_code == 201, r.text


def test_sandi_salah_ditolak_di_mode_pameran(klien, akun, pameran_menyala):
    assert klien.post("/auth/umkm/masuk", json={"email": EMAIL, "kata_sandi": "bukan-sandinya"}).status_code == 401


def test_akun_biasa_tidak_terpengaruh_dan_sandi_booth_tidak_membukanya(klien, akun, pameran_menyala):
    r = klien.post("/auth/umkm/masuk", json={"email": EMAIL_BIASA, "kata_sandi": SANDI_PUBLIK})
    assert r.status_code == 200, r.text
    assert not r.json()["baca_saja"]
    assert klien.post("/auth/umkm/masuk", json={"email": EMAIL_BIASA, "kata_sandi": SANDI_BOOTH}).status_code == 401


def test_tanpa_mode_pameran_akun_simulasi_tetap_bisa_menulis(klien, akun, monkeypatch):
    monkeypatch.delenv("WARUNGKU_SANDI_BOOTH", raising=False)
    r = klien.post("/auth/umkm/masuk", json={"email": EMAIL, "kata_sandi": SANDI_PUBLIK})
    assert r.status_code == 200, r.text
    assert not r.json()["baca_saja"]


def test_percobaan_masuk_dibatasi_per_alamat(klien, pameran_menyala, monkeypatch):
    monkeypatch.setitem(pameran.BATAS_PERCOBAAN, "/masuk", (3, 60))
    badan = {"email": "tidak-ada@warungku.test", "kata_sandi": "bukan-sandinya"}
    kepala = {"CF-Connecting-IP": "203.0.113.7"}
    for _ in range(3):
        assert klien.post("/auth/umkm/masuk", json=badan, headers=kepala).status_code == 401
    assert klien.post("/auth/umkm/masuk", json=badan, headers=kepala).status_code == 429
    # Alamat lain tidak ikut terkena.
    assert klien.post("/auth/umkm/masuk", json=badan, headers={"CF-Connecting-IP": "203.0.113.8"}).status_code == 401


def test_tanpa_mode_pameran_percobaan_tidak_dibatasi(klien, monkeypatch):
    monkeypatch.delenv("WARUNGKU_SANDI_BOOTH", raising=False)
    monkeypatch.setitem(pameran.BATAS_PERCOBAAN, "/masuk", (1, 60))
    badan = {"email": "tidak-ada@warungku.test", "kata_sandi": "bukan-sandinya"}
    for _ in range(3):
        assert klien.post("/auth/umkm/masuk", json=badan).status_code == 401
