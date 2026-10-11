"""
Turnamen omset Mesin 1: SARIMAX melawan Chronos-2 dengan kovariat kalender.

    python -m ml.mesin1.turnamen_omset --json ml/hasil/hasil_mesin1_turnamen_omset.json

Pertanyaannya: kalau Chronos-2 diberi kalender yang sama dengan SARIMAX (libur,
gajian, Ramadan, Lebaran — diketahui di masa depan), apakah ia menyusul
SARIMAX? Pada evaluasi sebelumnya (`jalankan_omset.py`) hanya SARIMAX yang
diberi kalender, sehingga perbandingannya tidak setara.

Pembagian waktu, tiap sumber dilatih dan diuji di dirinya sendiri:

* Simulasi (70 UMKM): delapan titik asal pekanan; yang terakhir DIKUNCI
  sebagai uji, tujuh sebelumnya validasi. Uji = 70 pekan-UMKM.
* French Bakery (satu toko): satu pekan uji hanya memberi satu angka, jadi
  yang dikunci adalah DELAPAN pekan terakhir; 32 pekan sebelumnya validasi.

Juara dipilih dengan rank-sum (MAPE, WAPE, MDA, RMSE) di lipatan validasi
saja. Pencilan Mahalanobis untuk SARIMAX dihitung ulang di setiap titik asal
dari data latih saja — `pencilan.tandai` memakai median bergulir berpusat, dan
menjalankannya sekali pada seluruh deret akan membiarkan pekan uji ikut
menentukan hari mana yang dianggap pencilan.
"""

from __future__ import annotations

import argparse
import json
import time

import numpy as np
import pandas as pd

from .. import sumber as sumber_data
from . import omset as O
from . import turnamen as T
from .pencilan import tandai

CAKRAWALA = O.CAKRAWALA
PEMBAGIAN = {"simulasi": (7, 1), "french_bakery": (32, 8)}  # (validasi, uji) dalam pekan
#: Panjang konteks Chronos, sama dengan Chronos tanpa kovariat (`chronos.py`).
KONTEKS = 200


def _kolom_kalender(g: pd.DataFrame, akhir: int) -> list[str]:
    return [k for k in O.EXOG if k in g and g[k].iloc[:akhir].astype(bool).nunique() > 1]


def chronos_kalender(g: pd.DataFrame, akhir: int, h: int) -> np.ndarray:
    """
    Chronos-2 dengan kalender sebagai kovariat yang diketahui di masa depan.

    Masukan sama dengan Chronos tanpa kovariat (omset terisi median hari-pekan,
    200 hari terakhir); bedanya hanya `past_covariates` dan `future_covariates`.
    Kolom kalender yang konstan di data latih tidak dikirim. Kalau tidak ada yang
    tersisa (toko roti Prancis tanpa Ramadan atau gajian), hasilnya sama dengan
    Chronos tanpa kovariat — dan itu dicatat di keluaran.
    """
    from .chronos import _muat

    pipa = _muat()
    awal = max(0, akhir - KONTEKS)
    v = O._isi(g["omset"].to_numpy(), g["tanggal"])[awal:akhir]
    kolom = _kolom_kalender(g, akhir)
    masukan = {"target": v.astype(np.float32)}
    if kolom:
        masukan["past_covariates"] = {k: g[k].astype(float).to_numpy()[awal:akhir].astype(np.float32) for k in kolom}
        masukan["future_covariates"] = {k: g[k].astype(float).to_numpy()[akhir : akhir + h].astype(np.float32) for k in kolom}
    q, _ = pipa.predict_quantiles([masukan], prediction_length=h, quantile_levels=[0.5])
    return np.maximum(np.asarray(q[0][0, :, 0], dtype=float), 0.0)


def sarimax_tanpa_intip(g: pd.DataFrame, akhir: int, h: int) -> np.ndarray:
    """SARIMAX `omset.py`, dengan pencilan ditandai dari data latih saja."""
    latih = tandai(g.iloc[:akhir].copy())
    g2 = g.copy()
    g2["pencilan"] = False
    g2.loc[g2.index[:akhir], "pencilan"] = latih["pencilan"].to_numpy(dtype=bool)
    return O.sarimax(g2, akhir, h)


METODE = {
    "naif_musiman": O.naif,
    "ets": O.ets,
    "sarimax": sarimax_tanpa_intip,
    "var": O.var,
    "chronos_2": O.chronos,
    "chronos_2_kalender": chronos_kalender,
}


def titik_asal(n: int, validasi: int, uji: int) -> tuple[list[int], list[int]]:
    semua = sorted(n - CAKRAWALA * (k + 1) for k in range(validasi + uji))
    return semua[:validasi], semua[validasi:]


def jalankan_sumber(nama_sumber: str) -> dict:
    df = sumber_data.muat(nama_sumber, bentuk="omset")
    n_val, n_uji = PEMBAGIAN[nama_sumber]
    ramalan = {m: {"validasi": [], "uji": []} for m in METODE}
    detik = {m: 0.0 for m in METODE}
    gagal = {m: 0 for m in METODE}
    kalender_dipakai: set[str] = set()

    for eid, g in df.groupby("entitas_id", sort=True):
        g = g.sort_values("tanggal").reset_index(drop=True)
        val, uji = titik_asal(len(g), n_val, n_uji)
        for bagian, daftar in (("validasi", val), ("uji", uji)):
            for akhir in daftar:
                if akhir < O.MIN_LATIH:
                    continue
                pekan = g.iloc[akhir : akhir + CAKRAWALA]
                if pekan["data_hilang"].astype(bool).any():
                    continue
                kalender_dipakai.update(_kolom_kalender(g, akhir))
                asli = pekan["omset"].to_numpy(dtype=float)
                for m, f in METODE.items():
                    t = time.perf_counter()
                    try:
                        x = np.asarray(f(g, akhir, CAKRAWALA), dtype=float)
                        if not np.isfinite(x).all():
                            raise ValueError("ramalan tidak hingga")
                    except Exception:
                        gagal[m] += 1
                        x = np.full(CAKRAWALA, np.nan)
                    detik[m] += time.perf_counter() - t
                    ramalan[m][bagian].append(
                        T.Ramalan(int(eid), akhir, asli, x, float(g["omset"].iloc[akhir - 1]))
                    )
        if int(eid) % 10 == 0:
            print("  %s entitas %s selesai" % (nama_sumber, eid), flush=True)

    skor_val = {m: T.ukur(ramalan[m]["validasi"]) for m in METODE}
    papan = T.rank_sum(skor_val)
    juara = papan[0]["model"]
    skor_uji = {m: T.ukur(ramalan[m]["uji"]) for m in METODE}

    def ape(m):
        return np.array([r.ape for r in ramalan[m]["uji"]])

    banding = {}
    for a, b in (("chronos_2_kalender", "sarimax"), (juara, "sarimax"), ("chronos_2_kalender", "chronos_2")):
        if a == b:
            continue
        x, y = ape(a), ape(b)
        sah = np.isfinite(x) & np.isfinite(y)
        banding["%s_vs_%s" % (a, b)] = T.bootstrap_selisih(x[sah], y[sah])

    return {
        "pekan_validasi": n_val, "pekan_uji": n_uji,
        "kalender_dipakai": sorted(kalender_dipakai),
        "papan_validasi": papan, "juara_validasi": juara,
        "uji": skor_uji, "banding_uji": banding,
        "detik": detik, "gagal": gagal,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Turnamen omset Mesin 1.")
    p.add_argument("--sumber", nargs="*", default=["simulasi", "french_bakery"])
    p.add_argument("--json", type=str, default="")
    arg = p.parse_args()

    keluaran = {}
    for s in arg.sumber:
        print("== %s" % s, flush=True)
        h = jalankan_sumber(s)
        keluaran[s] = h
        print("  kalender: %s | juara validasi: %s" % (h["kalender_dipakai"], h["juara_validasi"]))
        for b in h["papan_validasi"]:
            print("  validasi %-20s MAPE %5.1f%% MDA %5.1f%% rank-sum %d" % (b["model"], b["mape"], b["mda"], b["rank_sum"]))
        for m, u in sorted(h["uji"].items(), key=lambda x: x[1]["mape"]):
            print("  UJI      %-20s MAPE %5.1f%% WAPE %5.1f%% MDA %5.1f%% n=%d | %.0f d" % (
                m, u["mape"], u["wape"], u["mda"], u["n_pekan"], h["detik"][m]))
        for k, b in h["banding_uji"].items():
            print("  %s: %+.2f poin (95%%: %+.2f .. %+.2f), n=%d" % (k, b["selisih"], b["bawah"], b["atas"], b["n"]))
        print(flush=True)

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(keluaran, f, indent=1, ensure_ascii=False, default=float)
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
