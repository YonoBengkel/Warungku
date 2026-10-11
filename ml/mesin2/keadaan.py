"""
Perakit fitur kandidat untuk evaluasi peringkat.

Masalah yang diselesaikan berkas ini. Tabel `fitur_pesanan` hanya berisi fitur
untuk distributor yang BENAR-BENAR dipilih — satu baris per pesanan. Tapi
evaluasi peringkat butuh skor untuk SEMUA kandidat pada satu keputusan,
termasuk yang tidak dipilih. Fitur mereka tidak tersimpan di mana pun, karena
pesanannya tidak pernah ada.

Jadi keadaan distributor diputar ulang dari riwayat: baris `fitur_pesanan`
dibaca urut tanggal, dan statistik berjalan tiap distributor direkam. Untuk
menilai keputusan pada tanggal T, dipakai keadaan sebelum T.

Aturan yang tidak boleh dilanggar: **keadaan diperbarui hanya oleh pesanan yang
tanggalnya lebih awal.** Satu baris saja yang bocor dari masa depan, dan seluruh
angka evaluasinya tidak bisa dipertahankan.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from ..data import FITUR

#: Harus sama dengan yang dipakai pembangkit dataset, kalau tidak fitur
#: kandidat dan fitur pesanan sungguhan tidak berada di skala yang sama.
BOBOT_AWAL, PRIOR = 8.0, 4.2


@dataclass
class _Catatan:
    n: int = 0
    tepat: int = 0
    jumlah: int = 0
    kondisi: int = 0
    ulasan: int = 0


@dataclass
class KeadaanDistributor:
    """Statistik berjalan tiap distributor, diputar ulang menurut tanggal."""

    sejak: dict[int, date]
    sekota: dict[tuple[int, int], bool]
    minimum: dict[int, int]
    _stat: dict[int, _Catatan] = field(default_factory=lambda: defaultdict(_Catatan))
    _hubungan: dict[tuple[int, int], int] = field(default_factory=lambda: defaultdict(int))

    def _halus(self, s: _Catatan, berhasil: int) -> float:
        return (BOBOT_AWAL * PRIOR + 5.0 * berhasil + 2.5 * (s.n - berhasil)) / (BOBOT_AWAL + s.n)

    def fitur(
        self,
        *,
        distributor_id: int,
        usaha_id: int,
        tanggal: date,
        rasio_harga: float,
        nilai: int,
        jumlah_item: int = 1,
    ) -> dict[str, float]:
        """Vektor fitur satu kandidat, memakai keadaan SEBELUM `tanggal`."""
        s = self._stat[distributor_id]
        return {
            "d_aspek_ketepatan": self._halus(s, s.tepat),
            "d_aspek_jumlah": self._halus(s, s.jumlah),
            "d_aspek_kondisi": self._halus(s, s.kondisi),
            "d_jumlah_ulasan": float(s.ulasan),
            "d_pesanan_selesai": float(s.n),
            "d_umur_hari": float((tanggal - self.sejak[distributor_id]).days),
            "h_pernah_kontrak": 0.0,
            "h_pesanan_sebelumnya": float(self._hubungan[(usaha_id, distributor_id)]),
            "p_jumlah_item": float(jumlah_item),
            "p_nilai": float(nilai),
            "p_rasio_harga": float(rasio_harga),
            "p_sekota": float(self.sekota.get((usaha_id, distributor_id), False)),
            "p_hari_pekan": float(tanggal.weekday()),
            "p_bulan": float(tanggal.month),
            "p_musim_hujan": float(tanggal.month in (11, 12, 1, 2, 3)),
            "p_stok_cukup": 1.0,
            "p_minimum_terpenuhi": float(nilai >= self.minimum.get(distributor_id, 0)),
        }

    def perbarui(self, baris) -> None:
        """Serap hasil satu pesanan yang sudah selesai."""
        d = int(baris["distributor_id"])
        s = self._stat[d]
        s.n += 1
        s.tepat += int(bool(baris["l_tepat_waktu"]))
        s.jumlah += int(bool(baris["l_jumlah_sesuai"]))
        s.kondisi += int(bool(baris["l_kondisi_baik"]))
        self._hubungan[(int(baris["usaha_id"]), d)] += 1

    def catat_ulasan(self, distributor_id: int) -> None:
        """
        Ulasan dihitung terpisah dari pesanan selesai, karena memang terpisah:
        hanya sebagian pemilik usaha menulis ulasan. Menyamakan keduanya akan
        membuat `d_jumlah_ulasan` menjadi salinan `d_pesanan_selesai`, dan satu
        fitur yang seharusnya berdiri sendiri berubah jadi duplikat.
        """
        self._stat[distributor_id].ulasan += 1


def muat_keadaan() -> KeadaanDistributor:
    """Baca info distributor yang tidak berubah sepanjang waktu."""
    from sqlalchemy import text

    from warungku.basis_data import mesin

    with mesin().connect() as kon:
        dist = pd.read_sql_query(
            text("SELECT id, kota, sejak, minimum_pesanan FROM distributor"), kon
        )
        usaha = pd.read_sql_query(text("SELECT id, kota FROM usaha"), kon)

    sejak = {int(r.id): pd.Timestamp(r.sejak).date() for r in dist.itertuples()}
    minimum = {int(r.id): int(r.minimum_pesanan or 0) for r in dist.itertuples()}
    kota_dist = {int(r.id): r.kota for r in dist.itertuples()}
    sekota = {
        (int(u.id), int(d)): kota_dist[d] == u.kota
        for u in usaha.itertuples()
        for d in kota_dist
    }
    return KeadaanDistributor(sejak=sejak, sekota=sekota, minimum=minimum)


def muat_ulasan() -> pd.DataFrame:
    """Tanggal dan distributor tiap ulasan, untuk diputar ulang."""
    from sqlalchemy import text

    from warungku.basis_data import mesin

    with mesin().connect() as kon:
        df = pd.read_sql_query(
            text("SELECT distributor_id, (waktu AT TIME ZONE 'UTC')::date AS tanggal FROM ulasan"),
            kon,
        )
    df["tanggal"] = pd.to_datetime(df["tanggal"]).dt.date
    return df


def keadaan_pada(df_latih: pd.DataFrame, batas: date) -> KeadaanDistributor:
    """
    Putar ulang seluruh data latih, hasilkan keadaan di akhir jendela latih.

    Dipakai untuk menilai keputusan di jendela uji. Keadaannya tidak diperbarui
    lagi selama penilaian: di jendela uji, model memang belum tahu hasil
    pesanan-pesanan di jendela itu.
    """
    k = muat_keadaan()
    for _, r in df_latih.sort_values("tanggal").iterrows():
        k.perbarui(r)
    ulasan = muat_ulasan()
    for r in ulasan[ulasan["tanggal"] < batas].itertuples():
        k.catat_ulasan(int(r.distributor_id))
    return k


def rakit_kandidat(
    keputusan: pd.DataFrame, keadaan: KeadaanDistributor
) -> tuple[np.ndarray, np.ndarray]:
    """
    Matriks fitur (kandidat x fitur) + label `sukses` untuk satu keputusan.

    Label di sini berasal dari matriks counterfactual, yaitu hasil yang AKAN
    terjadi. Itulah yang membuat evaluasi peringkat mungkin — dan itulah juga
    sebabnya ia tidak boleh ikut dilatihkan.
    """
    baris = []
    for r in keputusan.itertuples():
        f = keadaan.fitur(
            distributor_id=int(r.distributor_id),
            usaha_id=int(r.usaha_id),
            tanggal=r.tanggal,
            rasio_harga=float(r.rasio_harga),
            nilai=int(r.nilai),
        )
        baris.append([f[k] for k in FITUR])
    return np.array(baris, dtype=float), keputusan["sukses"].to_numpy(dtype=int)
