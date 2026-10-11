"""
Uji adaptor sumber data (`ml/sumber/`).

Yang dijaga adalah keputusan yang tidak akan pernah menampakkan diri sebagai
galat kalau salah:

1. **Hari tutup = data hilang, bukan nol.** Kalau nol, model belajar bahwa ada
   hari tanpa permintaan sama sekali.
2. **Pengembalian dijumlahkan, bukan dibuang.** Kalau dibuang, penjualan
   terlihat lebih tinggi daripada yang sebenarnya.
3. **Nota yang isinya hanya pengembalian bukan pembeli.**
4. **Kontrak bentuk "omset" ditegakkan di pintu**, bukan diandaikan.

Uji French Bakery memakai CSV buatan kecil, jadi tetap jalan di komputer yang
belum mengunduh data aslinya.
"""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest

from ml import sumber
from ml.sumber import KOLOM_OMSET, periksa_omset
from ml.sumber import french_bakery as fb

pytestmark = pytest.mark.filterwarnings("ignore:Sidik")

# Tiga hari: Sabtu 2021-01-02 buka, Minggu 2021-01-03 TUTUP (tidak ada baris),
# Senin 2021-01-04 buka. Nota 3 isinya hanya pengembalian.
CSV = '''\
,date,time,ticket_number,article,Quantity,unit_price
0,2021-01-02,08:38,1.0,BAGUETTE,2.0,"0,90 €"
1,2021-01-02,08:40,1.0,CROISSANT,1.0,"1,10 €"
2,2021-01-02,09:00,2.0,BAGUETTE,1.0,"0,90 €"
3,2021-01-02,09:05,2.0,BAGUETTE,-1.0,"0,90 €"
4,2021-01-02,09:06,2.0,GATEAU,1.0,"1.234,50 €"
5,2021-01-04,10:00,3.0,BAGUETTE,-1.0,"0,90 €"
6,2021-01-04,10:01,4.0,BAGUETTE,3.0,"0,95 €"
'''


@pytest.fixture
def berkas(tmp_path):
    p = tmp_path / "bakery_kecil.csv"
    p.write_text(CSV, encoding="utf-8")
    return p


# --------------------------------------------------------------------------
# Kalender Prancis
# --------------------------------------------------------------------------
@pytest.mark.parametrize(
    "tahun, paskah",
    [(2021, date(2021, 4, 4)), (2022, date(2022, 4, 17)), (2024, date(2024, 3, 31)), (2025, date(2025, 4, 20))],
)
def test_paskah(tahun, paskah):
    assert fb._paskah(tahun) == paskah


def test_libur_prancis_2022():
    libur = fb.libur_prancis(2022)
    assert len(libur) == 11
    assert date(2022, 4, 18) in libur  # Lundi de Pâques
    assert date(2022, 5, 26) in libur  # Ascension
    assert date(2022, 6, 6) in libur  # Lundi de Pentecôte
    assert date(2022, 7, 14) in libur


# --------------------------------------------------------------------------
# French Bakery
# --------------------------------------------------------------------------
def test_harga_format_eropa():
    s = pd.Series(["0,90 €", "1.234,50 €", "12,00 €"])
    assert fb._harga(s).tolist() == [0.90, 1234.50, 12.00]


def test_omset_hari_tutup_dan_pengembalian(berkas):
    df = fb.omset(berkas)
    periksa_omset(df)
    assert tuple(df.columns) == KOLOM_OMSET
    assert len(df) == 3  # tanggal lengkap, termasuk hari tutup

    sabtu, minggu, senin = (df.iloc[i] for i in range(3))
    # Minggu tutup: data hilang, angkanya NaN, bukan nol.
    assert bool(minggu["data_hilang"])
    assert np.isnan(minggu["omset"]) and np.isnan(minggu["jumlah_nota"])

    # Sabtu: baguette 2 + 1 - 1 = 2 potong, croissant 1, gateau 1.
    assert sabtu["jumlah_barang"] == 4
    assert sabtu["omset"] == pytest.approx(2 * 0.90 + 1.10 + 0.90 - 0.90 + 1234.50)
    assert sabtu["jumlah_nota"] == 2

    # Senin: nota 3 hanya pengembalian, jadi bukan pembeli; omsetnya tetap mengurangi.
    assert senin["jumlah_nota"] == 1
    assert senin["jumlah_barang"] == 2
    assert senin["omset"] == pytest.approx(3 * 0.95 - 0.90)

    # Toko roti tidak punya data stok dan tidak memakai kalender Indonesia.
    assert df["stok_habis_parsial"].isna().all()
    assert not df["pekan_gajian"].any() and not df["ramadan"].any() and not df["lebaran"].any()


def test_deret_hari_tutup_nan_hari_tak_laku_nol(berkas):
    deret = {d.nama: d for d in fb.deret(berkas)}
    assert sorted(deret) == ["BAGUETTE", "CROISSANT", "GATEAU"]
    roti = deret["BAGUETTE"]
    assert np.isnan(roti.nilai[1])  # Minggu tutup
    assert roti.nilai[0] == 2 and roti.nilai[2] == 2
    # Croissant tidak terjual hari Senin padahal toko buka: nol, bukan NaN.
    assert deret["CROISSANT"].nilai[2] == 0
    assert not roti.stok_habis.any()
    # Harga satuan = median harga jual baris positif: 0,90; 0,90; 0,95.
    assert roti.harga_satuan == pytest.approx(0.90)
    assert deret["GATEAU"].harga_satuan == pytest.approx(1234.50)


def test_deret_min_hari_laku(berkas):
    assert [d.nama for d in fb.deret(berkas, min_hari_laku=2)] == ["BAGUETTE"]


# --------------------------------------------------------------------------
# Penjaga kontrak
# --------------------------------------------------------------------------
def _contoh_omset() -> pd.DataFrame:
    tanggal = pd.date_range("2026-01-01", periods=4, freq="D")
    angka = pd.DataFrame(
        {"omset": [10.0, 12.0, 11.0], "jumlah_barang": [3.0, 4.0, 3.0], "jumlah_nota": [2.0, 2.0, 2.0]},
        index=tanggal[[0, 1, 3]],
    )
    nol = np.zeros(4, dtype=bool)
    return sumber.bingkai_omset(7, tanggal, angka, nol, nol, nol, nol, np.zeros(4))


def test_bingkai_omset_mengisi_hari_hilang():
    df = _contoh_omset()
    periksa_omset(df)
    assert df["data_hilang"].tolist() == [False, False, True, False]


def test_periksa_omset_menolak_tanggal_bolong():
    df = _contoh_omset().drop(index=2)
    with pytest.raises(ValueError, match="bolong"):
        periksa_omset(df)


def test_periksa_omset_menolak_nol_di_hari_hilang():
    df = _contoh_omset()
    df.loc[2, "omset"] = 0.0
    with pytest.raises(ValueError, match="data_hilang"):
        periksa_omset(df)


def test_periksa_omset_menolak_nan_di_hari_ada():
    df = _contoh_omset()
    df.loc[0, "jumlah_nota"] = np.nan
    with pytest.raises(ValueError, match="NaN"):
        periksa_omset(df)


# --------------------------------------------------------------------------
# Pintu `muat`
# --------------------------------------------------------------------------
@pytest.mark.parametrize(
    "sumber_, bentuk, galat",
    [
        ("toko_sebelah", "omset", ValueError),
        ("simulasi", "apa", ValueError),
        ("french_bakery", "rfm", ValueError),
        ("french_bakery", "pesanan", ValueError),
        ("online_retail", "rfm", NotImplementedError),
    ],
)
def test_muat_menolak_yang_tidak_tersedia(sumber_, bentuk, galat):
    with pytest.raises(galat):
        sumber.muat(sumber_, bentuk=bentuk)


def test_muat_french_bakery_lewat_pintu(berkas):
    df = sumber.muat("french_bakery", bentuk="omset", berkas=berkas)
    assert len(df) == 3


# --------------------------------------------------------------------------
# Simulasi (butuh Postgres yang sudah diisi pembangkit)
# --------------------------------------------------------------------------
def test_omset_simulasi_lengkap_400_hari():
    try:
        df = sumber.muat("simulasi", bentuk="omset")
    except Exception as e:  # basis data mati atau belum diisi
        pytest.skip("basis data simulasi tidak tersedia: %s" % e)
    per_usaha = df.groupby("entitas_id").size()
    assert (per_usaha == 400).all()
    # Simulasi tidak punya hari tutup.
    assert not df["data_hilang"].any()
    # Idulfitri 1447 H: 21-22 Maret 2026 (SKB), di dalam rentang simulasi.
    tgl_lebaran = sorted(df.loc[df["lebaran"], "tanggal"].dt.date.unique())
    assert [str(t) for t in tgl_lebaran] == ["2026-03-21", "2026-03-22"]
    assert (df["jumlah_nota"] >= 1).all()
    # Stok habis tidak membuat omset hilang: hari dengan barang kosong tetap
    # punya omset.
    assert (df.loc[df["stok_habis_parsial"] > 0, "omset"] > 0).all()
