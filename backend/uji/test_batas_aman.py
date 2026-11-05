"""
Uji batas aman dari Mesin 1 dan bahan saran beli.

Yang dijaga:

1. **Batas aman = jumlah p90 selama lama kirim**, dari jalan terbaru, dibulatkan ke atas.
2. **Angka yang diatur pemilik usaha tidak ditimpa**, hanya sarannya yang ikut berubah.
3. Barang yang perkiraannya tidak menutup lama kirim, atau p90-nya nol, tidak diubah.
4. Mesin 1 sungguhan menuliskannya dalam satu jalan.
5. `pemakaian-bulanan` memberi kebutuhan 21 hari, dasar jumlah saran beli.

Seperti uji lain, uji ini membuat datanya sendiri lalu menghapusnya.
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
from warungku.basis_data import mesin
from warungku.batas_aman import segarkan_batas_aman
from warungku.enum import (
    CaraHitungStok,
    JenisUsaha,
    KematanganPerkiraan,
    PeranPengguna,
    StatusVerifikasi,
    SumberBatasAman,
    TingkatLayanan,
)
from warungku.model import Barang, Keanggotaan, Pengguna, PermintaanHarian, Prediksi, Usaha

SANDI = "ujibatasaman123"
AKHIR = date(2026, 10, 31)


def _usaha(sesi: Session, nama: str) -> Usaha:
    u = Usaha(
        nama=nama, jenis_usaha=JenisUsaha.KEDAI_KOPI, nama_pemilik="Penguji", alamat="Jl. Uji No.4", kota="Sleman",
        nomor_hp="080000000004", cara_hitung=CaraHitungStok.KEMASAN, verifikasi=StatusVerifikasi.MENUNGGU,
        bergabung_sejak=date.today(),
    )
    sesi.add(u)
    sesi.flush()
    return u


def _barang(sesi: Session, usaha_id: int, kode: str, hari_kirim: int, sumber=SumberBatasAman.SISTEM) -> Barang:
    b = Barang(
        usaha_id=usaha_id, nama=f"Barang {kode}", kategori="Bahan Makanan", kode_barang=kode, satuan="gram",
        stok=Decimal(500), batas_aman=Decimal(40), batas_aman_saran=Decimal(40), sumber_batas_aman=sumber,
        hari_kirim=hari_kirim,
    )
    sesi.add(b)
    sesi.flush()
    sesi.add(PermintaanHarian(usaha_id=usaha_id, barang_id=b.id, tanggal=AKHIR, jumlah=Decimal(1)))
    return b


def _ramalan(sesi: Session, b: Barang, jalan: str, p90: list[str], menit: int = 0, p50: str = "1") -> None:
    """Perkiraan hari-hari sesudah akhir data, satu baris per hari."""
    for i, nilai in enumerate(p90, start=1):
        sesi.add(
            Prediksi(
                usaha_id=b.usaha_id, barang_id=b.id, tanggal_target=AKHIR + timedelta(days=i),
                p10=Decimal(0), p50=Decimal(p50), p90=Decimal(nilai), jalan_id=jalan, model_nama="uji",
                model_versi="uji", dijalankan_pada=datetime(2026, 11, 1, 2, menit, tzinfo=timezone.utc),
                kematangan=KematanganPerkiraan.MANTAP, tingkat_layanan=TingkatLayanan.SEGAR,
            )
        )


@pytest.fixture
def toko():
    t = int(datetime.now(timezone.utc).timestamp() * 1000)
    with Session(mesin()) as sesi:
        u, lain = _usaha(sesi, f"Warung Uji Batas {t}"), _usaha(sesi, f"Warung Lain {t}")
        pemilik = Pengguna(
            nomor_hp="08955%07d" % (t % 10_000_000), email=f"uji-batas-{t}@contoh.id",
            kata_sandi_hash=acak_kata_sandi(SANDI), nama="Pemilik Uji",
        )
        sesi.add(pemilik)
        sesi.flush()
        sesi.add(Keanggotaan(pengguna_id=pemilik.id, usaha_id=u.id, peran=PeranPengguna.PEMILIK))

        sistem = _barang(sesi, u.id, "SIS", 3)
        # Jalan lama dan baris uji balik tidak boleh ikut terhitung, begitu juga hari sesudah lama kirim.
        _ramalan(sesi, sistem, "lama", ["100", "100", "100", "100"])
        _ramalan(sesi, sistem, "baru", ["1.2", "2.5", "3.1", "50"], menit=30, p50="2")
        sesi.add(
            Prediksi(
                usaha_id=u.id, barang_id=sistem.id, tanggal_target=AKHIR, p10=Decimal(0), p50=Decimal(0),
                p90=Decimal(999), jalan_id="baru", model_nama="uji", model_versi="uji-balik",
                dijalankan_pada=datetime(2026, 11, 1, 2, 30, tzinfo=timezone.utc),
                kematangan=KematanganPerkiraan.MANTAP, tingkat_layanan=TingkatLayanan.SEGAR,
            )
        )
        sendiri = _barang(sesi, u.id, "SEN", 2, SumberBatasAman.SENDIRI)
        _ramalan(sesi, sendiri, "baru", ["4", "5"])
        tanpa = _barang(sesi, u.id, "TAN", 2)
        nol = _barang(sesi, u.id, "NOL", 2)
        _ramalan(sesi, nol, "baru", ["0", "0"])
        pendek = _barang(sesi, u.id, "PEN", 5)
        _ramalan(sesi, pendek, "baru", ["9", "9"])
        cepat = _barang(sesi, u.id, "CEP", 0)
        _ramalan(sesi, cepat, "baru", ["6.5", "7"])
        bulan = _barang(sesi, u.id, "BUL", 2)
        _ramalan(sesi, bulan, "baru", ["3"] * 30, p50="2")
        usaha_lain = _barang(sesi, lain.id, "LAI", 1)
        _ramalan(sesi, usaha_lain, "baru", ["8"])
        sesi.commit()
        ids = {
            "usaha": u.id, "lain": lain.id, "pengguna": pemilik.id, "email": pemilik.email,
            "sistem": sistem.id, "sendiri": sendiri.id, "tanpa": tanpa.id, "nol": nol.id, "pendek": pendek.id,
            "cepat": cepat.id, "bulan": bulan.id, "usaha_lain": usaha_lain.id,
        }

    yield ids

    with mesin().begin() as kon:
        semua = [ids["usaha"], ids["lain"]]
        for tabel in ("prediksi", "permintaan_harian", "barang", "keanggotaan"):
            kon.execute(text(f"DELETE FROM {tabel} WHERE usaha_id = ANY(:u)"), {"u": semua})
        kon.execute(text("DELETE FROM usaha WHERE id = ANY(:u)"), {"u": semua})
        kon.execute(text("DELETE FROM pengguna WHERE id = :p"), {"p": ids["pengguna"]})


def _angka(barang_id: int) -> tuple[Decimal, Decimal]:
    with mesin().connect() as kon:
        r = kon.execute(text("SELECT batas_aman, batas_aman_saran FROM barang WHERE id = :b"), {"b": barang_id}).one()
    return Decimal(r[0]), Decimal(r[1])


def test_batas_aman_jumlah_p90_selama_lama_kirim(toko):
    with mesin().begin() as kon:
        assert segarkan_batas_aman(kon, toko["usaha"]) == 4

    # 1,2 + 2,5 + 3,1 = 6,8. Bukan 100-an dari jalan lama, bukan 999 uji balik, bukan hari keempat.
    assert _angka(toko["sistem"]) == (Decimal(7), Decimal(7))
    # Angka buatan pemilik tetap, sarannya ikut berubah.
    assert _angka(toko["sendiri"]) == (Decimal(40), Decimal(9))
    # Tanpa perkiraan, p90 nol, dan perkiraan yang tidak menutup lama kirim: angka lama bertahan.
    for k in ("tanpa", "nol", "pendek"):
        assert _angka(toko[k]) == (Decimal(40), Decimal(40)), k
    # Lama kirim 0 hari tetap dijaga satu hari.
    assert _angka(toko["cepat"]) == (Decimal(7), Decimal(7))
    # Usaha lain tidak tersentuh saat yang diminta satu usaha.
    assert _angka(toko["usaha_lain"]) == (Decimal(40), Decimal(40))

    with mesin().begin() as kon:
        segarkan_batas_aman(kon)
    assert _angka(toko["usaha_lain"]) == (Decimal(8), Decimal(8))


def test_pemakaian_bulanan_memberi_kebutuhan_21_hari(toko):
    klien = TestClient(app)
    r = klien.post("/auth/umkm/masuk", json={"email": toko["email"], "kata_sandi": SANDI})
    assert r.status_code == 200, r.text
    kepala = {"Authorization": "Bearer " + r.json()["token"]}

    isi = klien.get(f"/usaha/{toko['usaha']}/pemakaian-bulanan", headers=kepala).json()
    baris = next(b for b in isi if b["barang_id"] == toko["bulan"])
    assert Decimal(baris["perkiraan_p50"]) == 60
    assert Decimal(baris["perkiraan_persediaan"]) == 42


def test_pemakaian_bulanan_per_30_hari_mundur_dari_hari_terakhir(toko):
    klien = TestClient(app)
    r = klien.post("/auth/umkm/masuk", json={"email": toko["email"], "kata_sandi": SANDI})
    assert r.status_code == 200, r.text
    kepala = {"Authorization": "Bearer " + r.json()["token"]}
    jalur = f"/usaha/{toko['usaha']}/pemakaian-bulanan"

    # Fixture sudah menulis 1 di hari terakhir. Hari ke-5 tersensor stok habis, jadi tidak dihitung.
    with mesin().begin() as kon:
        kon.execute(
            text(
                """
                INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah, stok_habis)
                SELECT :u, :b, :akhir - h, 3, h = 5 FROM generate_series(1, 44) AS h
                """
            ),
            {"u": toko["usaha"], "b": toko["tanpa"], "akhir": AKHIR},
        )

    def periode(alamat):
        isi = klien.get(alamat, headers=kepala).json()
        return [
            (p["tanggal"], Decimal(p["jumlah"]), p["hari_tercatat"])
            for p in next(b for b in isi if b["barang_id"] == toko["tanpa"])["periode"]
        ]

    lama = (str(AKHIR - timedelta(days=37)), Decimal(90), 15)
    baru = (str(AKHIR - timedelta(days=15)), Decimal("87.931"), 29)
    assert periode(jalur) == [lama, baru]
    # Satu periode: hanya 30 hari terakhir.
    assert periode(f"{jalur}?periode=1") == [baru]

    # Usaha tanpa catatan sama sekali: kosong, bukan galat, walau perkiraannya masih ada.
    with mesin().begin() as kon:
        kon.execute(text("DELETE FROM permintaan_harian WHERE usaha_id = :u"), {"u": toko["usaha"]})
    r = klien.get(jalur, headers=kepala)
    assert r.status_code == 200 and r.json() == []


def test_nota_baru_tidak_menggeser_blok_dan_perkiraan_bulanan(toko):
    """Nota sesudah jalan Mesin 1 baru terbaca di jalan berikutnya: garis uji balik dan perkiraan tidak berubah."""
    klien = TestClient(app)
    r = klien.post("/auth/umkm/masuk", json={"email": toko["email"], "kata_sandi": SANDI})
    assert r.status_code == 200, r.text
    kepala = {"Authorization": "Bearer " + r.json()["token"]}
    jalur = f"/usaha/{toko['usaha']}/pemakaian-bulanan"

    with mesin().begin() as kon:
        kon.execute(
            text(
                """
                INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah)
                SELECT :u, :b, :akhir - h, 4 FROM generate_series(1, 59) AS h
                """
            ),
            {"u": toko["usaha"], "b": toko["bulan"], "akhir": AKHIR},
        )
    with Session(mesin()) as sesi:
        for mundur, nilai in ((1, "118"), (2, "119")):
            sesi.add(
                Prediksi(
                    usaha_id=toko["usaha"], barang_id=toko["bulan"], tanggal_target=AKHIR - timedelta(days=30 * mundur - 1),
                    p10=Decimal(nilai), p50=Decimal(nilai), p90=Decimal(nilai), jalan_id="baru", model_nama="uji",
                    model_versi="lightgbm/uji-balik-bulanan", dijalankan_pada=datetime(2026, 11, 1, 2, 0, tzinfo=timezone.utc),
                    kematangan=KematanganPerkiraan.MANTAP, tingkat_layanan=TingkatLayanan.SEGAR,
                )
            )
        sesi.commit()

    def bacaan():
        isi = klien.get(jalur, headers=kepala).json()
        return next(b for b in isi if b["barang_id"] == toko["bulan"])

    sebelum = bacaan()
    assert [Decimal(p["uji_balik"]) for p in sebelum["periode"]] == [Decimal(119), Decimal(118)]
    assert Decimal(sebelum["perkiraan_p50"]) == 60 and Decimal(sebelum["perkiraan_persediaan"]) == 42

    # Nota tujuh hari sesudah hari asal, untuk barang ini dan barang lain yang belum pernah diramal.
    with mesin().begin() as kon:
        kon.execute(
            text(
                """
                INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah)
                VALUES (:u, :b, :t, 50), (:u, :lain, :t, 50)
                """
            ),
            {"u": toko["usaha"], "b": toko["bulan"], "lain": toko["tanpa"], "t": AKHIR + timedelta(days=7)},
        )
    assert bacaan() == sebelum


def test_mesin1_menuliskan_batas_aman_dalam_satu_jalan(toko):
    """Jalur sungguhan: perkiraan tersimpan, lalu batas aman barang berubah di transaksi yang sama."""
    from ml.layanan import _jalankan_mesin1

    with mesin().begin() as kon:
        kon.execute(
            text(
                """
                INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah)
                SELECT :u, :b, :akhir - h, 10 + (h % 7) FROM generate_series(1, 90) AS h
                """
            ),
            {"u": toko["usaha"], "b": toko["tanpa"], "akhir": AKHIR},
        )

    h = _jalankan_mesin1(toko["usaha"], "kuantil_hari_pekan", 30, uji_bulanan=False)
    assert h.barang == 1 and h.batas_aman >= 1

    batas, saran = _angka(toko["tanpa"])
    with mesin().connect() as kon:
        harapan = kon.execute(
            text(
                """
                SELECT ceil(sum(p90)) FROM prediksi
                 WHERE barang_id = :b AND jalan_id = :j AND tanggal_target > :akhir AND tanggal_target <= :akhir + 2
                """
            ),
            {"b": toko["tanpa"], "j": h.jalan_id, "akhir": AKHIR},
        ).scalar_one()
    assert harapan > 0 and batas == saran == Decimal(harapan)
