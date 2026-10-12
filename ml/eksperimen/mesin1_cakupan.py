"""
Cek cakupan kuantil SARIMA sebelum menggantikan ETS di produksi Mesin 1.

    python -m ml.eksperimen.mesin1_cakupan

Batas aman di aplikasi memakai p90. Kalau rentang p10–p90 terlalu sempit,
permintaan sungguhan akan lebih sering melewati p90 daripada yang dijanjikan,
dan stok habis lebih sering daripada yang diperkirakan pemilik warung.

Dinilai di tujuh titik asal VALIDASI turnamen Mesin 1 (11 Agt–22 Sep 2026,
masing-masing 7 hari ke depan). Pekan uji (29 Sep–5 Okt) tetap dikunci. Hari
stok habis (nilai NaN, permintaan tersensor) tidak dinilai.

Yang diukur per metode:

* cakupan p10–p90 (sasaran 80%);
* porsi hari di atas p90 (sasaran 10%; inilah yang menentukan stok habis);
* porsi hari di bawah p10 (sasaran 10%);
* lebar rentang relatif terhadap p50;
* MAPE pekanan p50 (pembanding dengan angka turnamen);
* jumlah barang yang jatuh ke cadangan ETS.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np

from ..data import muat_deret
from ..mesin1.dasar import holt_winters
from ..mesin1.sarima import sarima_kuantil

HASIL = Path(__file__).resolve().parents[1] / "hasil"
H = 7


def _asal() -> list[date]:
    t = json.loads((HASIL / "hasil_mesin1_turnamen.json").read_text(encoding="utf-8"))
    return [date.fromisoformat(x) for x in t["rancangan"]["validasi"]]


def _satu(argumen):
    """Semua titik asal untuk satu barang. Mengembalikan baris per (metode, asal)."""
    d, asal = argumen
    indeks = {t: i for i, t in enumerate(d.tanggal)}
    keluar = []
    for a in asal:
        akhir = indeks.get(a)
        if akhir is None or akhir + H > len(d):
            continue
        aktual = np.asarray(d.nilai[akhir : akhir + H], dtype=float)
        for nama in ("sarima", "ets"):
            cadangan = False
            if nama == "sarima":
                try:
                    r = sarima_kuantil(d, akhir, H)
                except Exception:
                    r = holt_winters(d, akhir, H)
                    cadangan = True
            else:
                r = holt_winters(d, akhir, H)
            keluar.append({
                "metode": nama, "asal": a.isoformat(), "cadangan": cadangan,
                "aktual": aktual.tolist(),
                "p10": r[0.1].tolist(), "p50": r[0.5].tolist(), "p90": r[0.9].tolist(),
            })
    return d.barang_id, d.usaha_id, keluar


def ringkas(baris: list[dict]) -> dict:
    a = np.array([b["aktual"] for b in baris], dtype=float)
    p10 = np.array([b["p10"] for b in baris]); p50 = np.array([b["p50"] for b in baris]); p90 = np.array([b["p90"] for b in baris])
    sah = np.isfinite(a)
    dalam = (a >= p10) & (a <= p90)
    atas, bawah = a > p90, a < p10
    lebar = np.where(p50 > 0, (p90 - p10) / np.maximum(p50, 1e-9), np.nan)
    # MAPE pekanan: hanya pekan tanpa hari tersensor dan dengan permintaan > 0.
    lengkap = sah.all(axis=1)
    jum_a, jum_f = np.nansum(a, axis=1), p50.sum(axis=1)
    pakai = lengkap & (jum_a > 0)
    mape = float(np.mean(np.abs(jum_f[pakai] - jum_a[pakai]) / jum_a[pakai]) * 100) if pakai.any() else float("nan")
    return {
        "barang_pekan": len(baris),
        "hari_dinilai": int(sah.sum()),
        "cakupan_p10_p90": float(dalam[sah].mean()),
        "di_atas_p90": float(atas[sah].mean()),
        "di_bawah_p10": float(bawah[sah].mean()),
        "lebar_relatif_median": float(np.nanmedian(lebar)),
        "mape_pekanan_p50": mape,
        "pekan_mape": int(pakai.sum()),
        "cadangan_ets": int(sum(b["cadangan"] for b in baris)),
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Cakupan kuantil SARIMA vs ETS (Mesin 1).")
    p.add_argument("--pekerja", type=int, default=max(1, min(8, (os.cpu_count() or 2) // 2)))
    p.add_argument("--batas", type=int, default=0, help="batasi jumlah barang (0 = semua)")
    arg = p.parse_args()

    mulai = time.perf_counter()
    deret = muat_deret()
    if arg.batas:
        deret = deret[: arg.batas]
    asal = _asal()
    print("Barang %d | titik asal %s..%s (%d) | cakrawala %d hari | pekerja %d"
          % (len(deret), asal[0], asal[-1], len(asal), H, arg.pekerja), flush=True)

    semua: list[dict] = []
    with ProcessPoolExecutor(max_workers=arg.pekerja) as ex:
        for i, (_b, _u, keluar) in enumerate(ex.map(_satu, [(d, asal) for d in deret], chunksize=4), 1):
            semua += keluar
            if i % 100 == 0:
                print("  %d barang (%.0f d)" % (i, time.perf_counter() - mulai), flush=True)

    hasil = {m: ringkas([b for b in semua if b["metode"] == m]) for m in ("sarima", "ets")}
    for m, r in hasil.items():
        print("%-7s cakupan p10-p90 %5.1f%% | di atas p90 %5.1f%% | di bawah p10 %5.1f%% | lebar %.2f | "
              "MAPE pekanan p50 %5.1f%% | cadangan ETS %d"
              % (m, 100 * r["cakupan_p10_p90"], 100 * r["di_atas_p90"], 100 * r["di_bawah_p10"],
                 r["lebar_relatif_median"], r["mape_pekanan_p50"], r["cadangan_ets"]), flush=True)

    berkas = HASIL / "hasil_eksperimen_mesin1_cakupan.json"
    berkas.write_text(json.dumps({
        "titik_asal": [a.isoformat() for a in asal], "cakrawala_hari": H, "barang": len(deret),
        "sasaran": {"cakupan_p10_p90": 0.8, "di_atas_p90": 0.1, "di_bawah_p10": 0.1},
        "hasil": hasil, "detik": round(time.perf_counter() - mulai, 1),
    }, indent=1, ensure_ascii=False), encoding="utf-8")
    print("JSON: %s (%.0f d)" % (berkas, time.perf_counter() - mulai))


if __name__ == "__main__":
    main()
