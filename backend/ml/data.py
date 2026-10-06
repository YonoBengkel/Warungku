"""
Pemuat data untuk kedua mesin. Satu-satunya tempat yang tahu bentuk tabelnya.

Semua eksperimen memuat data lewat berkas ini, tidak menulis SQL sendiri. Kalau
tiap percobaan punya kueri sendiri, perbedaan hasil antar model jadi tidak bisa
dipisahkan dari perbedaan cara mengambil datanya.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy import text

from warungku.basis_data import mesin

#: Panjang jendela uji, harus sama dengan yang dipakai pembangkit dataset.
HARI_UJI = 35

#: Perkiraan harian, cakrawala 30 hari ke depan.
CAKRAWALA = 30

#: Panjang riwayat minimum sebelum satu barang layak diramal. Di bawah ini
#: aplikasi menampilkan "data belum cukup" alih-alih angka yang dikarang.
MIN_RIWAYAT = 60


@dataclass
class DeretBarang:
    """
    Satu barang, satu deret harian lengkap tanpa tanggal bolong.

    `nilai` sudah **disensor**: hari kehabisan stok diganti NaN, bukan nol.
    Itu perbedaan yang menentukan. Nol berarti "tidak ada yang mau beli"; NaN
    berarti "tidak tahu, barangnya tidak ada". Model yang diberi nol akan
    menyimpulkan barang paling laris adalah barang yang paling sering kosong,
    lalu menyarankan stok lebih sedikit — persis kebalikan dari yang benar.
    """

    barang_id: int
    usaha_id: int
    nama: str
    tanggal: np.ndarray
    nilai: np.ndarray
    stok_habis: np.ndarray
    hari_libur: np.ndarray
    pekan_gajian: np.ndarray
    ramadan: np.ndarray

    def __len__(self) -> int:
        return len(self.nilai)

    @property
    def terisi(self) -> np.ndarray:
        """Deret dengan NaN diisi — untuk metode yang tidak bisa menerima NaN."""
        v = self.nilai.copy()
        bolong = np.isnan(v)
        if not bolong.any():
            return v
        # Diisi dengan median hari-pekan yang sama. Mengisi dengan nol
        # mengulang kesalahan yang justru ingin dihindari; mengisi dengan
        # rata-rata keseluruhan menghapus pola mingguan yang mau dipelajari.
        hari = np.array([t.weekday() for t in self.tanggal])
        for h in range(7):
            pilih = (hari == h) & ~bolong
            isi = float(np.median(v[pilih])) if pilih.any() else float(np.nanmedian(v))
            v[(hari == h) & bolong] = isi
        sisa = np.isnan(v)
        if sisa.any():
            v[sisa] = 0.0
        return v


def muat_deret(min_riwayat: int = MIN_RIWAYAT) -> list[DeretBarang]:
    """Muat D1: satu DeretBarang per barang yang terhubung kasir."""
    with mesin().connect() as kon:
        df = pd.read_sql_query(
            text(
                """
                SELECT ph.barang_id, ph.usaha_id, b.nama, ph.tanggal,
                       ph.jumlah::float8 AS jumlah, ph.stok_habis,
                       ph.hari_libur, ph.pekan_gajian, ph.ramadan
                  FROM permintaan_harian ph
                  JOIN barang b ON b.id = ph.barang_id
                 ORDER BY ph.barang_id, ph.tanggal
                """
            ),
            kon,
        )

    deret: list[DeretBarang] = []
    for barang_id, g in df.groupby("barang_id", sort=True):
        g = g.sort_values("tanggal")
        tanggal = pd.to_datetime(g["tanggal"]).dt.date.to_numpy()
        # Tanggal yang benar-benar hilang (bukan nol, tapi tidak ada barisnya)
        # akan membuat indeks ke-t tidak lagi berarti "hari ke-t". Diperiksa
        # di sini supaya kalau terjadi, kelihatan sebagai galat, bukan sebagai
        # ramalan yang pelan-pelan melenceng.
        rentang = (tanggal[-1] - tanggal[0]).days + 1
        if rentang != len(tanggal):
            raise ValueError(
                "barang %s: %d baris untuk rentang %d hari — ada tanggal bolong"
                % (barang_id, len(tanggal), rentang)
            )
        if len(tanggal) < min_riwayat:
            continue

        nilai = np.array(g["jumlah"].to_numpy(dtype=float), copy=True)
        habis = g["stok_habis"].to_numpy(dtype=bool)
        nilai[habis] = np.nan  # sensor kehabisan stok

        deret.append(
            DeretBarang(
                barang_id=int(barang_id),
                usaha_id=int(g["usaha_id"].iloc[0]),
                nama=str(g["nama"].iloc[0]),
                tanggal=tanggal,
                nilai=nilai,
                stok_habis=habis,
                hari_libur=g["hari_libur"].to_numpy(dtype=bool),
                pekan_gajian=g["pekan_gajian"].to_numpy(dtype=bool),
                ramadan=g["ramadan"].to_numpy(dtype=bool),
            )
        )
    return deret


# --------------------------------------------------------------------------
# Mesin 2
# --------------------------------------------------------------------------

#: Kolom fitur Mesin 2, urutannya tetap. Label TIDAK ada di sini.
FITUR = (
    "d_aspek_ketepatan",
    "d_aspek_jumlah",
    "d_aspek_kondisi",
    "d_jumlah_ulasan",
    "d_pesanan_selesai",
    "d_umur_hari",
    "h_pernah_kontrak",
    "h_pesanan_sebelumnya",
    "p_jumlah_item",
    "p_nilai",
    "p_rasio_harga",
    "p_sekota",
    "p_hari_pekan",
    "p_bulan",
    "p_musim_hujan",
    "p_stok_cukup",
    "p_minimum_terpenuhi",
)

LABEL = "sukses"


def muat_fitur_pesanan() -> pd.DataFrame:
    """Muat D2: tabel latih Mesin 2, urut tanggal."""
    with mesin().connect() as kon:
        return pd.read_sql_query(
            text("SELECT * FROM fitur_pesanan ORDER BY tanggal, pesanan_id"), kon
        )


def belah_waktu(df: pd.DataFrame, hari_uji: int = HARI_UJI) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Belah menurut WAKTU, bukan acak.

    Pembelahan acak pada data pesanan membuat angka bohong dua kali. Pertama,
    pesanan pada hari yang sama saling berkaitan. Kedua, dan lebih parah,
    reputasi distributor dibangun dari pesanan sebelumnya — jika pesanan Maret
    masuk latih dan pesanan Februari masuk uji, model memakai reputasi yang
    baru terbentuk SETELAH pesanan yang sedang diujinya. Akurasinya naik, dan
    angkanya tidak ada artinya.
    """
    t = pd.to_datetime(df["tanggal"])
    batas = t.max() - pd.Timedelta(days=hari_uji - 1)
    return df[t < batas].copy(), df[t >= batas].copy()


def muat_counterfactual(berkas: str = "keluaran/d2_counterfactual.csv") -> pd.DataFrame:
    """
    Matriks counterfactual — **hanya untuk evaluasi.**

    Berisi hasil yang akan terjadi seandainya memesan ke kandidat lain. Di
    dunia nyata informasi ini tidak pernah ada. Satu-satunya alasan ia ada di
    sini: tanpanya, "model saya memilih lebih baik" tidak bisa dibuktikan —
    kita cuma bisa melihat hasil pilihan yang memang diambil.
    """
    from pathlib import Path

    p = Path(berkas)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent.parent / berkas
    df = pd.read_csv(p)
    df["tanggal"] = pd.to_datetime(df["tanggal"]).dt.date
    return df


def keputusan_counterfactual(
    cf: pd.DataFrame, sejak: date | None = None, min_kandidat: int = 2
) -> list[pd.DataFrame]:
    """
    Pecah matriks jadi daftar keputusan, masing-masing dengan kandidatnya.

    Keputusan berkandidat tunggal dibuang: di situ tidak ada yang bisa dipilih,
    jadi memasukkannya hanya mengencerkan angka dengan kasus yang semua
    kebijakan pasti benar.
    """
    if sejak is not None:
        cf = cf[cf["tanggal"] >= sejak]
    hasil = []
    for _, g in cf.groupby(["tanggal", "usaha_id", "barang_id"], sort=True):
        if len(g) >= min_kandidat:
            hasil.append(g.reset_index(drop=True))
    return hasil
