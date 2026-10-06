"""
Simulasi berurutan 400 hari: mengukur regret kumulatif, bukan akurasi sesaat.

**Kenapa ini ada, padahal sudah ada evaluasi dua lapis.** Evaluasi yang lama
membekukan keadaan distributor di batas jendela uji, lalu menilai 266 keputusan
sekaligus. Itu potret sesaat, dan pada potret sesaat **eksplorasi hanya terlihat
sebagai derau** — tidak ada hari esok tempat pengetahuan baru terpakai. Itulah
sebabnya di evaluasi lama, rerata reputasi lima baris bisa menyamai LightGBM:
pada satu titik waktu, memang tidak ada lagi yang bisa dipelajari.

Di sini waktu berjalan. Kebijakan memilih, hasilnya terungkap, pengetahuannya
bertambah, besok ia memilih lagi dengan pengetahuan itu. Yang diukur:

    regret kumulatif = jumlah (hasil terbaik yang mungkin - hasil yang dipilih)

Kurva regret inilah yang membedakan "selalu pilih yang tertinggi" dari Thompson.
Yang pertama terjebak pada distributor yang kebetulan menang duluan; yang kedua
rugi di awal karena mencoba-coba, lalu menyusul melewatinya.

**Yang membuat ini mungkin:** matriks counterfactual. Ia memuat hasil yang AKAN
terjadi untuk setiap kandidat, jadi kita bisa mengungkap hasil pilihan mana pun
yang diambil kebijakan — bukan hanya pilihan yang kebetulan tercatat di riwayat.
Di dunia nyata informasi ini tidak pernah ada, dan karena itu kurva regret
hanya bisa dihitung di atas simulasi.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from ..data import FITUR
from .keadaan import KeadaanDistributor, muat_keadaan

#: Sebelum sebanyak ini keputusan terkumpul, penaksir belum dilatih dan semua
#: kebijakan memilih acak. Ini bukan kelemahan yang disembunyikan — masalah
#: awal-dingin memang nyata, dan kurvanya harus memperlihatkannya.
MULAI_BELAJAR = 300

#: Penaksir dilatih ulang tiap sekian hari, bukan tiap keputusan. Melatih ulang
#: tiap keputusan akan lebih "benar" secara teori dan sama sekali tidak mungkin
#: dijalankan: BART butuh puluhan detik sekali latih. Di produksi pun jadwalnya
#: harian, jadi simulasi ini justru lebih menyerupai keadaan sebenarnya.
LATIH_TIAP_HARI = 14


@dataclass
class HasilSimulasi:
    nama: str
    keputusan: int
    regret_total: float
    regret_rata: float
    sukses_rata: float
    #: Regret kumulatif per hari, untuk digambar.
    kurva: list[float] = field(default_factory=list)
    tanggal: list[date] = field(default_factory=list)
    detik: float = 0.0

    def baris(self) -> str:
        return "%-28s keputusan %5d | regret total %7.1f | regret/keputusan %.4f | sukses %.3f | %6.1fs" % (
            self.nama, self.keputusan, self.regret_total,
            self.regret_rata, self.sukses_rata, self.detik,
        )


def _siapkan(cf: pd.DataFrame) -> list[tuple[date, pd.DataFrame]]:
    """Kelompokkan matriks counterfactual jadi keputusan, urut tanggal."""
    keputusan: list[tuple[date, pd.DataFrame]] = []
    for (tanggal, _usaha, _barang), g in cf.groupby(
        ["tanggal", "usaha_id", "barang_id"], sort=True
    ):
        if len(g) >= 2:
            keputusan.append((tanggal, g.reset_index(drop=True)))
    keputusan.sort(key=lambda x: x[0])
    return keputusan


def jalankan(
    nama: str,
    buat_penaksir,
    kebijakan,
    cf: pd.DataFrame,
    *,
    benih: int = 20261006,
    latih_tiap: int = LATIH_TIAP_HARI,
    mulai_belajar: int = MULAI_BELAJAR,
    maks_keputusan: int = 0,
) -> HasilSimulasi:
    """
    Jalankan satu kebijakan sepanjang rentang simulasi.

    `buat_penaksir` boleh None untuk kebijakan yang tidak belajar sama sekali
    (termurah, acak) — dipakai sebagai batas bawah di grafik.
    """
    mulai = time.perf_counter()
    acak = np.random.default_rng(benih)
    keadaan = muat_keadaan()
    keputusan = _siapkan(cf)
    if maks_keputusan:
        keputusan = keputusan[:maks_keputusan]

    penaksir = buat_penaksir() if buat_penaksir is not None else None
    riwayat_X: list[np.ndarray] = []
    riwayat_y: list[int] = []
    terlatih = False
    hari_latih_terakhir: date | None = None

    regret = 0.0
    sukses = 0
    kurva: list[float] = []
    tanggal_kurva: list[date] = []
    hari_sekarang: date | None = None

    for tanggal, kandidat in keputusan:
        # --- latih ulang kalau sudah waktunya --------------------------------
        if (
            penaksir is not None
            and len(riwayat_X) >= mulai_belajar
            and (hari_latih_terakhir is None or (tanggal - hari_latih_terakhir).days >= latih_tiap)
        ):
            penaksir.latih(np.vstack(riwayat_X), np.array(riwayat_y, dtype=int))
            terlatih = True
            hari_latih_terakhir = tanggal

        # --- rakit fitur tiap kandidat pada keadaan HARI INI -----------------
        X = np.array(
            [
                [
                    keadaan.fitur(
                        distributor_id=int(r.distributor_id),
                        usaha_id=int(r.usaha_id),
                        tanggal=tanggal,
                        rasio_harga=float(r.rasio_harga),
                        nilai=int(r.nilai),
                    )[k]
                    for k in FITUR
                ]
                for r in kandidat.itertuples()
            ],
            dtype=float,
        )

        # --- pilih -----------------------------------------------------------
        if penaksir is None or not terlatih:
            # Awal-dingin: belum ada yang bisa dipelajari, jadi acak. Memilih
            # termurah di sini akan membuat kurva awal tiap kebijakan berbeda
            # karena alasan yang tidak ada hubungannya dengan kebijakannya.
            skor = acak.random(len(X))
        else:
            p, sigma = penaksir.peluang_dan_sebaran(X)
            skor = kebijakan.skor(p, sigma, acak)

        pilih = int(np.argmax(skor))

        # --- hasilnya terungkap (dari matriks counterfactual) ----------------
        hasil = kandidat["sukses"].to_numpy(dtype=int)
        terbaik = int(hasil.max())
        diperoleh = int(hasil[pilih])
        regret += terbaik - diperoleh
        sukses += diperoleh

        # --- pengetahuan bertambah; HANYA dari lengan yang dipilih -----------
        # Inilah bandit feedback. Kalau hasil kandidat lain ikut dimasukkan ke
        # riwayat, kebijakannya belajar dari informasi yang di dunia nyata tidak
        # pernah ia punya, dan seluruh perbandingannya kehilangan arti.
        riwayat_X.append(X[pilih])
        riwayat_y.append(diperoleh)

        baris = kandidat.iloc[pilih]
        keadaan.perbarui(
            {
                "distributor_id": int(baris["distributor_id"]),
                "usaha_id": int(baris["usaha_id"]),
                "l_tepat_waktu": bool(baris["tepat_waktu"]),
                "l_jumlah_sesuai": bool(baris["jumlah_sesuai"]),
                "l_kondisi_baik": bool(baris["kondisi_baik"]),
            }
        )
        # Sebagian pemilik usaha menulis ulasan; angkanya mengikuti pembangkit.
        if acak.random() < 0.45:
            keadaan.catat_ulasan(int(baris["distributor_id"]))

        if tanggal != hari_sekarang:
            hari_sekarang = tanggal
            kurva.append(regret)
            tanggal_kurva.append(tanggal)

    n = max(1, len(keputusan))
    return HasilSimulasi(
        nama=nama,
        keputusan=len(keputusan),
        regret_total=regret,
        regret_rata=regret / n,
        sukses_rata=sukses / n,
        kurva=kurva,
        tanggal=tanggal_kurva,
        detik=time.perf_counter() - mulai,
    )


def acuan_oracle_dan_termurah(cf: pd.DataFrame, maks_keputusan: int = 0) -> dict[str, float]:
    """
    Batas atas dan kebijakan yang berlaku sekarang, untuk membingkai kurva.

    Tanpa keduanya, "regret 180" tidak berarti apa-apa.
    """
    keputusan = _siapkan(cf)
    if maks_keputusan:
        keputusan = keputusan[:maks_keputusan]

    n = max(1, len(keputusan))
    oracle = sum(int(g["sukses"].max()) for _, g in keputusan)
    termurah = sum(
        int(g.loc[g["harga_per_satuan_dasar"].idxmin(), "sukses"]) for _, g in keputusan
    )
    acak = sum(float(g["sukses"].mean()) for _, g in keputusan)
    return {
        "keputusan": n,
        "oracle_sukses": oracle / n,
        "termurah_sukses": termurah / n,
        "termurah_regret": (oracle - termurah) / n,
        "acak_sukses": acak / n,
        "acak_regret": (oracle - acak) / n,
    }
