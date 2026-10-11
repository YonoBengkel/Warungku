"""
Jalankan turnamen Mesin 1 tingkat barang (lihat `turnamen.py`).

    python -m ml.mesin1.jalankan_turnamen --json keluaran/hasil_mesin1_turnamen.json
    python -m ml.mesin1.jalankan_turnamen --batas 120      # uji cepat, bukan untuk dilaporkan

Keluaran utamanya satu pertanyaan: apakah "juara per kelompok" lebih baik
daripada model produksi sekarang (ETS untuk semua barang) di pekan uji yang
dikunci? Jawabannya dilaporkan apa adanya, termasuk kalau kalah.
"""

from __future__ import annotations

import argparse
import json
import time

import numpy as np

from ..data import muat_deret
from . import turnamen as T
from .pekanan import CAKRAWALA
from .saringan import saring


def _harian(daftar: list[T.Ramalan]) -> float:
    ape = []
    for r in daftar:
        sah = np.isfinite(r.asli) & (r.asli > 0) & np.isfinite(r.ramal)
        ape.extend(np.abs(r.asli[sah] - r.ramal[sah]) / r.asli[sah] * 100)
    return float(np.mean(ape)) if ape else float("nan")


def _bulat(x):
    if isinstance(x, float):
        return round(x, 4) if np.isfinite(x) else None
    if isinstance(x, dict):
        return {k: _bulat(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_bulat(v) for v in x]
    return x


def main() -> None:
    p = argparse.ArgumentParser(description="Turnamen model Mesin 1 gaya MarketCast.")
    p.add_argument("--json", type=str, default="")
    p.add_argument("--batas", type=int, default=0, help="batasi jumlah deret (uji cepat)")
    p.add_argument("--perwakilan", type=int, default=T.PERWAKILAN)
    p.add_argument("--k", type=int, default=0, help="tetapkan k (uji kepekaan); 0 = pilih dengan siluet")
    p.add_argument(
        "--validasi-anggota", action="store_true",
        help="ramal juga SEMUA anggota di lipatan validasi (lama): juara dari anggota, dan bukti pendukung",
    )
    arg = p.parse_args()

    mulai = time.perf_counter()
    deret = muat_deret()
    if arg.batas:
        deret = deret[: arg.batas]
    harga = {d.barang_id: d.harga_satuan for d in deret if d.harga_satuan is not None}
    panjang = len(deret[0])
    validasi, uji = T.asal_validasi_dan_uji(panjang)
    a1 = validasi[0]
    tgl = deret[0].tanggal
    print("Deret %d | validasi %s..%s (%d titik asal) | uji DIKUNCI %s..%s" % (
        len(deret), tgl[validasi[0]], tgl[validasi[-1] + CAKRAWALA - 1], len(validasi),
        tgl[uji], tgl[uji + CAKRAWALA - 1]), flush=True)

    # --- 1-2. fitur, kelompok, perwakilan (data sampai a1 saja) -------------
    pop1 = [d for d, h in zip(deret, saring(deret, harga, akhir=a1)) if h.diramal]
    X1 = np.vstack([T.fitur_barang(d, a1) for d in pop1])
    kel = T.kelompokkan(X1, kisaran=(arg.k,) if arg.k else T.KISARAN_K)
    wakil = T.perwakilan(kel, X1, arg.perwakilan)
    print("Lolos saringan di a1: %d | k=%d | siluet %s" % (
        len(pop1), kel.k, {k: round(v, 3) for k, v in kel.siluet_per_k.items()}), flush=True)

    model = T.daftar_model(deret)
    jam = T.Stopwatch()

    # --- 3. turnamen di perwakilan, lipatan validasi -------------------------
    tugas = [(pop1[i], a) for c in range(kel.k) for i in wakil[c] for a in validasi]
    ramalan_val: dict[str, list[T.Ramalan]] = {}
    for m in T.MODEL:
        f = jam.jalankan("turnamen_" + m, model[m], tugas, CAKRAWALA)
        ramalan_val[m] = [T.buat_ramalan(d, a, x) for (d, a), x in zip(tugas, f)]
        print("  turnamen %-13s %6.1f d" % (m, jam.detik["turnamen_" + m]), flush=True)

    id_kel = {pop1[i].barang_id: c for c in range(kel.k) for i in wakil[c]}
    papan: dict[int, list[dict]] = {}
    juara: dict[int, str] = {}
    for c in range(kel.k):
        skor = {m: T.ukur([r for r in ramalan_val[m] if id_kel.get(r.barang_id) == c]) for m in T.MODEL}
        papan[c] = T.rank_sum(skor)
        juara[c] = papan[c][0]["model"]
        print("  kelompok %d (%d anggota): juara %s | %s" % (
            c, int((kel.label == c).sum()), juara[c],
            ", ".join("%s %d" % (b["model"], b["rank_sum"]) for b in papan[c])), flush=True)

    # --- 3b. (opsional) semua anggota di lipatan validasi ---------------------
    # Dua kegunaan. (a) Juara dipilih dari SEMUA anggota, bukan tiga perwakilan:
    # menguji apakah pemilihan lewat perwakilan yang jadi titik lemah. (b) Juara
    # perwakilan melawan ETS pada anggota yang BUKAN perwakilan — sampelnya
    # besar, tetapi pekannya sama dengan pekan pemilihan, jadi hanya bukti
    # pendukung. Uji yang menentukan tetap pekan yang dikunci.
    juara_anggota: dict[int, str] = {}
    pendukung: dict = {}
    if arg.validasi_anggota:
        tugas_a = [(d, a) for d in pop1 for a in validasi]
        kel_a = {d.barang_id: int(kel.label[i]) for i, d in enumerate(pop1)}
        wakil_id = {pop1[i].barang_id for c in range(kel.k) for i in wakil[c]}
        rv: dict[str, list[T.Ramalan]] = {}
        for m in T.MODEL:
            f = jam.jalankan("anggota_" + m, model[m], tugas_a, CAKRAWALA)
            rv[m] = [T.buat_ramalan(d, a, x) for (d, a), x in zip(tugas_a, f)]
            print("  anggota  %-13s %6.1f d" % (m, jam.detik["anggota_" + m]), flush=True)
        papan_anggota = {}
        for c in range(kel.k):
            skor = {m: T.ukur([r for r in rv[m] if kel_a[r.barang_id] == c]) for m in T.MODEL}
            papan_anggota[c] = T.rank_sum(skor)
            juara_anggota[c] = papan_anggota[c][0]["model"]
            print("  kelompok %d: juara dari anggota %s" % (c, juara_anggota[c]), flush=True)
        bukan_wakil = [i for i, r in enumerate(rv["ets"]) if r.barang_id not in wakil_id]
        rj = [rv[juara[kel_a[rv["ets"][i].barang_id]]][i] for i in bukan_wakil]
        re_ = [rv["ets"][i] for i in bukan_wakil]
        x = np.array([r.ape for r in rj])
        y = np.array([r.ape for r in re_])
        sah_ = np.isfinite(x) & np.isfinite(y)
        pendukung = {
            "catatan": "pekan validasi yang sama dengan pekan pemilihan juara; bukan uji",
            "juara_perwakilan": T.ukur(rj), "ets": T.ukur(re_),
            "juara_vs_ets": T.bootstrap_selisih(x[sah_], y[sah_]),
            "papan_anggota": papan_anggota,
            "per_model_semua_anggota": {m: T.ukur(rv[m]) for m in T.MODEL},
        }

    # --- 4. uji yang menentukan, pekan dikunci ------------------------------
    pop8 = [d for d, h in zip(deret, saring(deret, harga, akhir=uji)) if h.diramal]
    X8 = np.vstack([T.fitur_barang(d, uji) for d in pop8])
    c8 = kel.tetapkan(X8)
    tugas8 = [(d, uji) for d in pop8]
    f8: dict[str, list[np.ndarray]] = {}
    for m in T.MODEL:
        f8[m] = jam.jalankan("uji_" + m, model[m], tugas8, CAKRAWALA)
        print("  uji %-13s %6.1f d" % (m, jam.detik["uji_" + m]), flush=True)

    def strategi(pilih) -> list[T.Ramalan]:
        return [T.buat_ramalan(d, uji, f8[pilih(i)][i]) for i, d in enumerate(pop8)]

    hasil_uji: dict[str, dict] = {}
    rm: dict[str, list[T.Ramalan]] = {}
    rm["juara_per_kelompok"] = strategi(lambda i: juara[int(c8[i])])
    if juara_anggota:
        rm["juara_dari_anggota"] = strategi(lambda i: juara_anggota[int(c8[i])])
    for m in T.MODEL:
        rm[m + "_untuk_semua"] = strategi(lambda i, m=m: m)
    for nama, daftar in rm.items():
        hasil_uji[nama] = {**T.ukur(daftar), "mape_harian": _harian(daftar)}

    # Bootstrap berpasangan tiap strategi vs ETS, hanya pekan yang sah di keduanya.
    ape_e = np.array([r.ape for r in rm["ets_untuk_semua"]])
    banding_semua = {}
    for nama, daftar in rm.items():
        if nama == "ets_untuk_semua":
            continue
        x = np.array([r.ape for r in daftar])
        sah = np.isfinite(x) & np.isfinite(ape_e)
        banding_semua[nama] = T.bootstrap_selisih(x[sah], ape_e[sah])
    banding = banding_semua["juara_per_kelompok"]
    ape_uji = {
        "barang_id": [d.barang_id for d in pop8], "kelompok": [int(c) for c in c8],
        **{nama: [r.ape for r in daftar] for nama, daftar in rm.items()},
    }

    per_kelompok = []
    for c in range(kel.k):
        idx = [i for i in range(len(pop8)) if int(c8[i]) == c]
        baris = {"kelompok": c, "juara": juara[c], "anggota_uji": len(idx)}
        for m in T.MODEL:
            baris["mape_" + m] = T.ukur([rm[m + "_untuk_semua"][i] for i in idx])["mape"]
        # Model terbaik DI PEKAN UJI: hanya batas atas, karena memakai jendela uji.
        terbaik = min(T.MODEL, key=lambda m: baris["mape_" + m] if np.isfinite(baris["mape_" + m]) else np.inf)
        baris["terbaik_di_uji_mengintip"] = terbaik
        per_kelompok.append(baris)

    # Pusat kelompok dalam satuan asli, supaya kelompoknya bisa diberi nama.
    pusat_asli = kel.pusat * np.where(kel.batas_atas > kel.batas_bawah, kel.batas_atas - kel.batas_bawah, 1.0) + kel.batas_bawah
    keluaran = {
        "rancangan": {
            "deret": len(deret), "benih": T.BENIH, "cakrawala_hari": CAKRAWALA,
            "validasi": [str(tgl[a]) for a in validasi], "uji_dikunci": str(tgl[uji]),
            "fitur": list(T.FITUR), "jendela_fitur_hari": T.JENDELA_FITUR,
            "kisaran_k": [arg.k] if arg.k else list(T.KISARAN_K), "perwakilan_per_kelompok": arg.perwakilan,
            "lolos_saringan_a1": len(pop1), "lolos_saringan_uji": len(pop8),
        },
        "kelompok": {
            "k": kel.k, "siluet_per_k": kel.siluet_per_k,
            "ukuran": [int((kel.label == c).sum()) for c in range(kel.k)],
            "pusat": [dict(zip(T.FITUR, map(float, v))) for v in pusat_asli],
            "perwakilan": {c: [pop1[i].nama + " (%d)" % pop1[i].barang_id for i in wakil[c]] for c in range(kel.k)},
        },
        "turnamen": {c: {"juara": juara[c], "papan": papan[c]} for c in range(kel.k)},
        "juara_dari_anggota": juara_anggota,
        "pendukung_validasi_anggota": pendukung,
        "uji": {"strategi": hasil_uji, "juara_vs_ets": banding, "semua_vs_ets": banding_semua,
                "per_kelompok": per_kelompok, "ape_per_barang": ape_uji},
        "detik": jam.detik,
        "detik_total": time.perf_counter() - mulai,
    }

    print()
    for nama, h in sorted(hasil_uji.items(), key=lambda x: x[1]["mape"]):
        print("%-26s MAPE pekanan %5.1f%% | WAPE %5.1f%% | MDA %5.1f%% | RMSE %8.2f | harian %5.1f%% | n=%d" % (
            nama, h["mape"], h["wape"], h["mda"], h["rmse"], h["mape_harian"], h["n_pekan"]))
    print("Juara - ETS: %+.2f poin (95%%: %+.2f .. %+.2f), juara lebih baik di %d barang, ETS di %d, n=%d" % (
        banding["selisih"], banding["bawah"], banding["atas"], banding["a_lebih_baik"], banding["b_lebih_baik"], banding["n"]))
    print("Total %.0f d" % keluaran["detik_total"])

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(_bulat(keluaran), f, indent=1, ensure_ascii=False)
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
