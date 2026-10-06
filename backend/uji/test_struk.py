"""
Uji alur sinkron kasir: idempotensi dan invarian buku besar.

Dua hal yang diuji di sini adalah dua hal yang paling mahal kalau salah, dan
paling sulit terlihat kalau dibiarkan tanpa uji:

1. **Nota yang dikirim ulang tidak boleh mengurangi stok dua kali.** Kasir yang
   kehilangan jaringan memang akan mengirim ulang. Tanpa uji ini, cacatnya baru
   terlihat berbulan-bulan kemudian sebagai "stok di aplikasi selalu lebih
   sedikit daripada stok sebenarnya", dan pada titik itu tidak ada lagi cara
   memisahkan mana selisih yang nyata.

2. **Jumlah seluruh pergerakan harus sama dengan stok tercatat.** Kalau tidak,
   nilai `barang.stok` adalah angka yang tidak ada asalnya.

Uji ini membuat usaha, barang, dan pemetaannya sendiri, lalu menghapusnya lagi.
Ia TIDAK memakai data yang sudah ada di basis data: uji yang bergantung pada isi
database akan lulus hari ini dan gagal besok tanpa ada kode yang berubah.

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
from warungku.enum import (
    CaraHitungStok,
    JenisUsaha,
    PeranPengguna,
    StatusVerifikasi,
    SumberBatasAman,
)
from warungku.model import Barang, Keanggotaan, PemetaanMenu, PemetaanMenuBahan, Pengguna, Usaha

NOMOR = "UJI-20261006-001"


SANDI_UJI = "ujistruk123"


@pytest.fixture
def warung():
    """
    Satu usaha lengkap dengan pemiliknya, barangnya, dan pemetaan menunya.

    Pemiliknya ikut dibuat karena endpoint sekarang berpenjaga token. Uji yang
    memotong otentikasi — misalnya dengan menimpa dependency — akan berhenti
    menguji hal yang paling penting: bahwa nota hanya bisa dikirim oleh orang
    yang memang berhak atas usaha itu.
    """
    with Session(mesin()) as sesi:
        u = Usaha(
            nama="Warung Uji Otomatis",
            jenis_usaha=JenisUsaha.KEDAI_KOPI,
            nama_pemilik="Penguji",
            alamat="Jl. Uji No.1",
            kota="Yogyakarta",
            nomor_hp="080000000000",
            cara_hitung=CaraHitungStok.KEMASAN,
            verifikasi=StatusVerifikasi.MENUNGGU,
            bergabung_sejak=datetime.now(timezone.utc).date(),
        )
        sesi.add(u)
        sesi.flush()

        email = "uji-struk-%d@contoh.id" % int(datetime.now(timezone.utc).timestamp() * 1000)
        pemilik = Pengguna(
            nomor_hp="08999%07d" % (int(datetime.now(timezone.utc).timestamp()) % 10_000_000),
            email=email,
            kata_sandi_hash=acak_kata_sandi(SANDI_UJI),
            nama="Pemilik Uji",
        )
        sesi.add(pemilik)
        sesi.flush()
        sesi.add(
            Keanggotaan(pengguna_id=pemilik.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK)
        )

        b = Barang(
            usaha_id=u.id,
            nama="Biji Kopi Uji",
            kategori="Kopi",
            kode_barang="UJI001",
            satuan="gram",
            stok=Decimal("1000.000"),
            batas_aman=Decimal("200.000"),
            sumber_batas_aman=SumberBatasAman.SENDIRI,
        )
        sesi.add(b)
        sesi.flush()

        pm = PemetaanMenu(usaha_id=u.id, nama_menu="Kopi Susu")
        sesi.add(pm)
        sesi.flush()
        # 18 gram biji per gelas kopi susu.
        sesi.add(PemetaanMenuBahan(pemetaan_id=pm.id, barang_id=b.id, takaran=Decimal("18.000")))
        sesi.commit()
        usaha_id, barang_id, pemilik_id = u.id, b.id, pemilik.id

    klien = TestClient(app)
    masuk = klien.post("/auth/umkm/masuk", json={"email": email, "kata_sandi": SANDI_UJI})
    assert masuk.status_code == 200, masuk.text
    kepala = {"Authorization": "Bearer " + masuk.json()["token"]}

    yield usaha_id, barang_id, kepala

    with mesin().begin() as kon:
        kon.execute(text("DELETE FROM pergerakan WHERE usaha_id = :u"), {"u": usaha_id})
        kon.execute(
            text(
                "DELETE FROM transaksi_baris WHERE transaksi_id IN "
                "(SELECT id FROM transaksi WHERE usaha_id = :u)"
            ),
            {"u": usaha_id},
        )
        kon.execute(text("DELETE FROM transaksi WHERE usaha_id = :u"), {"u": usaha_id})
        kon.execute(
            text(
                "DELETE FROM pemetaan_menu_bahan WHERE pemetaan_id IN "
                "(SELECT id FROM pemetaan_menu WHERE usaha_id = :u)"
            ),
            {"u": usaha_id},
        )
        kon.execute(text("DELETE FROM pemetaan_menu WHERE usaha_id = :u"), {"u": usaha_id})
        kon.execute(text("DELETE FROM barang WHERE usaha_id = :u"), {"u": usaha_id})
        kon.execute(text("DELETE FROM keanggotaan WHERE usaha_id = :u"), {"u": usaha_id})
        kon.execute(text("DELETE FROM usaha WHERE id = :u"), {"u": usaha_id})
        kon.execute(text("DELETE FROM pengguna WHERE id = :p"), {"p": pemilik_id})


def _struk(nomor: str = NOMOR, jumlah: int = 5) -> dict:
    return {
        "nomor_struk": nomor,
        "waktu": "2026-10-05T13:30:00+00:00",
        "kasir": "Kasir Uji",
        "sumber": "pos",
        "baris": [
            {"nama_menu": "Kopi Susu", "jumlah": jumlah, "satuan": "gelas", "harga_jual_satuan": 18000}
        ],
    }


def _stok(barang_id: int) -> Decimal:
    with mesin().connect() as kon:
        return kon.execute(
            text("SELECT stok FROM barang WHERE id = :b"), {"b": barang_id}
        ).scalar_one()


def test_struk_mengurangi_stok_dan_menulis_buku_besar(warung):
    usaha_id, barang_id, kepala = warung
    klien = TestClient(app)

    r = klien.post("/usaha/%d/transaksi" % usaha_id, headers=kepala, json=_struk())
    assert r.status_code == 200, r.text
    hasil = r.json()
    assert hasil["sudah_ada"] is False
    assert hasil["tak_dikenali"] == []

    # 5 gelas x 18 gram = 90 gram
    assert _stok(barang_id) == Decimal("910.000")

    with mesin().connect() as kon:
        baris = kon.execute(
            text(
                "SELECT jenis, jumlah, stok_sesudah, transaksi_id FROM pergerakan "
                "WHERE barang_id = :b"
            ),
            {"b": barang_id},
        ).all()
    assert len(baris) == 1
    # Kueri SQL mentah mengembalikan nilai teks enum, bukan anggota enum —
    # dan nilai teks itulah yang juga dikirim frontend.
    assert baris[0].jenis == "terjual"
    assert baris[0].jumlah == Decimal("-90.000")
    # Stok sesudah yang dicatat harus sama dengan stok yang benar-benar
    # tersimpan; kalau tidak, riwayat di layar bercerita hal lain daripada
    # angka di kartu stok.
    assert baris[0].stok_sesudah == Decimal("910.000")
    assert baris[0].transaksi_id == hasil["transaksi_id"]


def test_nota_dikirim_ulang_tidak_mengurangi_dua_kali(warung):
    usaha_id, barang_id, kepala = warung
    klien = TestClient(app)

    pertama = klien.post("/usaha/%d/transaksi" % usaha_id, headers=kepala, json=_struk()).json()
    kedua = klien.post("/usaha/%d/transaksi" % usaha_id, headers=kepala, json=_struk()).json()

    assert kedua["sudah_ada"] is True
    assert kedua["transaksi_id"] == pertama["transaksi_id"]
    assert _stok(barang_id) == Decimal("910.000")

    with mesin().connect() as kon:
        n = kon.execute(
            text("SELECT COUNT(*) FROM pergerakan WHERE barang_id = :b"), {"b": barang_id}
        ).scalar_one()
    assert n == 1


def test_menu_tak_dikenali_dilaporkan_tapi_nota_tetap_diterima(warung):
    usaha_id, barang_id, kepala = warung
    klien = TestClient(app)

    struk = _struk(nomor="UJI-20261006-002")
    struk["baris"].append(
        {"nama_menu": "Menu Yang Belum Dipetakan", "jumlah": 2, "satuan": "porsi"}
    )
    hasil = klien.post("/usaha/%d/transaksi" % usaha_id, headers=kepala, json=struk).json()

    assert hasil["diterima"] is True
    assert hasil["baris_tercatat"] == 2
    assert hasil["tak_dikenali"] == ["Menu Yang Belum Dipetakan"]
    # Baris yang dikenali tetap mengurangi stok.
    assert _stok(barang_id) == Decimal("910.000")


def test_invarian_buku_besar_berlaku_sesudah_banyak_nota(warung):
    usaha_id, barang_id, kepala = warung
    klien = TestClient(app)

    awal = _stok(barang_id)
    for i in range(12):
        klien.post("/usaha/%d/transaksi" % usaha_id, headers=kepala, json=_struk(nomor="UJI-B-%03d" % i, jumlah=3))

    with mesin().connect() as kon:
        total = kon.execute(
            text("SELECT COALESCE(SUM(jumlah), 0) FROM pergerakan WHERE barang_id = :b"),
            {"b": barang_id},
        ).scalar_one()

    # Inilah invariannya: stok sekarang == stok awal + jumlah seluruh pergerakan.
    assert _stok(barang_id) == awal + total
    assert total == Decimal("-648.000")  # 12 x 3 gelas x 18 gram
