"""
Evaluasi LightGBM kuantil sebelum menggantikan SARIMA di produksi Mesin 1.

    python -m ml.eksperimen.mesin1_lgbm

Diminta dosen pengampu (16 Okt 2026): Mesin 1 memakai LightGBM. Penilaiannya
sama persis dengan `mesin1_cakupan.py` (yang dulu meloloskan SARIMA), supaya
angkanya bisa dibandingkan langsung:

* VALIDASI: tujuh titik asal turnamen (11 Agt–22 Sep 2026), 7 hari ke depan,
  semua barang. Cakupan p10–p90, porsi di atas p90, lebar rentang, MAPE pekanan.
  Angka SARIMA untuk titik yang sama dibaca dari `hasil_eksperimen_mesin1_cakupan.json`.
* UJI: pekan yang dikunci (29 Sep–5 Okt 2026). LightGBM dan SARIMA dihitung
  ulang di sini dengan saringan pekan yang sama (tujuh hari tanpa sensor stok
  habis, permintaan > 0).

Beberapa konfigurasi LightGBM dicoba di VALIDASI saja (nilai tengah median vs
L2, alpha kuantil bawah). Yang dipakai adalah yang kedua ekornya paling dekat
ke 10% (di atas p90 dan di bawah p10), seri dipecah dengan MAPE terkecil.
Pekan uji hanya dipakai menilai konfigurasi terpilih.
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
from ..mesin1.lgbm import ramal_kuantil
from ..mesin1.sarima import sarima_kuantil
from .mesin1_cakupan import H, ringkas

HASIL = Path(__file__).resolve().parents[1] / "hasil"


def _baris(nama: str, d, akhir: int, a: date, r, cadangan: bool = False) -> dict:
    return {
        "metode": nama, "asal": a.isoformat(), "cadangan": cadangan,
        "aktual": np.asarray(d.nilai[akhir : akhir + H], dtype=float).tolist(),
        "p10": r[0.1].tolist(), "p50": r[0.5].tolist(), "p90": r[0.9].tolist(),
    }


KANDIDAT = {
    "median, alpha 0,10/0,90": dict(tengah_l2=False, alpha={0.1: 0.10, 0.5: 0.5, 0.9: 0.90}),
    "L2, alpha 0,10/0,90": dict(tengah_l2=True, alpha={0.1: 0.10, 0.5: 0.5, 0.9: 0.90}),
    "L2, alpha 0,08/0,90": dict(tengah_l2=True, alpha={0.1: 0.08, 0.5: 0.5, 0.9: 0.90}),
    "L2, alpha 0,06/0,90": dict(tengah_l2=True, alpha={0.1: 0.06, 0.5: 0.5, 0.9: 0.90}),
    "L2, alpha 0,06/0,92": dict(tengah_l2=True, alpha={0.1: 0.06, 0.5: 0.5, 0.9: 0.92}),
}


def _skor(r: dict) -> tuple[float, float]:
    return (abs(r["di_atas_p90"] - 0.1) + abs(r["di_bawah_p10"] - 0.1), r["mape_pekanan_p50"])


def lgbm_di(deret, a: date, **kw) -> list[dict]:
    tugas = []
    for d in deret:
        indeks = {t: i for i, t in enumerate(d.tanggal)}
        akhir = indeks.get(a)
        if akhir is not None and akhir + H <= len(d):
            tugas.append((d, akhir))
    ramalan = ramal_kuantil(tugas, H, **kw)
    return [_baris("lightgbm", d, akhir, a, r) for (d, akhir), r in zip(tugas, ramalan)]


def _sarima_satu(argumen):
    d, a = argumen
    indeks = {t: i for i, t in enumerate(d.tanggal)}
    akhir = indeks.get(a)
    if akhir is None or akhir + H > len(d):
        return None
    try:
        return _baris("sarima", d, akhir, a, sarima_kuantil(d, akhir, H))
    except Exception:
        return _baris("sarima", d, akhir, a, holt_winters(d, akhir, H), cadangan=True)


def main() -> None:
    p = argparse.ArgumentParser(description="Evaluasi LightGBM kuantil vs SARIMA (Mesin 1).")
    p.add_argument("--pekerja", type=int, default=max(1, min(8, (os.cpu_count() or 2) // 2)))
    arg = p.parse_args()

    mulai = time.perf_counter()
    deret = muat_deret()
    t = json.loads((HASIL / "hasil_mesin1_turnamen.json").read_text(encoding="utf-8"))["rancangan"]
    validasi = [date.fromisoformat(x) for x in t["validasi"]]
    uji = date.fromisoformat(t["uji_dikunci"])
    print("Barang %d | validasi %s..%s | uji %s" % (len(deret), validasi[0], validasi[-1], uji), flush=True)

    kandidat: dict[str, dict] = {}
    for nama, kw in KANDIDAT.items():
        val: list[dict] = []
        for a in validasi:
            val += lgbm_di(deret, a, **kw)
        kandidat[nama] = ringkas(val)
        print("  kandidat %-26s selesai (%.0f d)" % (nama, time.perf_counter() - mulai), flush=True)
    terpilih = min(kandidat, key=lambda n: _skor(kandidat[n]))
    print("Terpilih di validasi: %s" % terpilih, flush=True)
    hasil_val = {"lightgbm": kandidat[terpilih]}
    sarima_val = json.loads((HASIL / "hasil_eksperimen_mesin1_cakupan.json").read_text(encoding="utf-8"))["hasil"]
    hasil_val["sarima"] = sarima_val["sarima"]

    uji_lgbm = lgbm_di(deret, uji, **KANDIDAT[terpilih])
    with ProcessPoolExecutor(max_workers=arg.pekerja) as ex:
        uji_sarima = [b for b in ex.map(_sarima_satu, [(d, uji) for d in deret], chunksize=8) if b]
    hasil_uji = {"lightgbm": ringkas(uji_lgbm), "sarima": ringkas(uji_sarima)}

    for judul, h in (("VALIDASI", hasil_val), ("UJI", hasil_uji)):
        for m, r in h.items():
            print("%-8s %-8s cakupan %5.1f%% | di atas p90 %5.1f%% | di bawah p10 %5.1f%% | lebar %.2f | MAPE pekanan %5.1f%% (%d pekan)"
                  % (judul, m, 100 * r["cakupan_p10_p90"], 100 * r["di_atas_p90"], 100 * r["di_bawah_p10"],
                     r["lebar_relatif_median"], r["mape_pekanan_p50"], r["pekan_mape"]), flush=True)

    berkas = HASIL / "hasil_eksperimen_mesin1_lgbm.json"
    berkas.write_text(json.dumps({
        "titik_asal_validasi": [a.isoformat() for a in validasi], "titik_asal_uji": uji.isoformat(),
        "cakrawala_hari": H, "barang": len(deret),
        "sasaran": {"cakupan_p10_p90": 0.8, "di_atas_p90": 0.1, "di_bawah_p10": 0.1},
        "kandidat_validasi": kandidat, "terpilih": terpilih,
        "validasi": hasil_val, "uji": hasil_uji, "detik": round(time.perf_counter() - mulai, 1),
    }, indent=1, ensure_ascii=False), encoding="utf-8")
    print("JSON: %s (%.0f d)" % (berkas, time.perf_counter() - mulai))


if __name__ == "__main__":
    main()
