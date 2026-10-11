"""
Fine-tune Chronos-2 HANYA pada data French Bakery, lalu bandingkan dengan Chronos-2 tanpa fine-tune.

    python -m ml.mesin1.finetune_bakery --keluaran-model <folder-singgah> --json keluaran/hasil_mesin1_turnamen_finetune.json

Data simulasi sengaja TIDAK dipakai: fine-tune pada data yang kami bangkitkan
sendiri hanya mengajari model rumus pembangkit kami.

Pembagian waktu sama dengan `turnamen_omset.py` untuk toko roti: 40 pekan
terakhir dibagi 32 validasi + 8 uji yang DIKUNCI.

1. Pilih konfigurasi: fine-tune dengan data sampai awal 8 pekan validasi
   terakhir, nilai di 8 pekan itu, untuk tiap konfigurasi di `KONFIGURASI`.
2. Uji: konfigurasi terbaik dilatih ulang dengan data sampai awal blok uji,
   dinilai di 8 pekan uji, berdampingan dengan Chronos-2 tanpa fine-tune.

Yang dinilai: omset toko (8 pekan) dan unit per artikel (149 artikel x 8 pekan,
pekan dengan hari kosong dikeluarkan). Fine-tune penuh (bukan LoRA: pustaka
`peft` tidak terpasang, dan memasangnya di luar wilayah percobaan ini).
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from .. import sumber as sumber_data
from ..data import DeretBarang
from . import omset as O
from . import turnamen as T
from .chronos import PANJANG_KONTEKS, _muat, ramal_banyak
from .turnamen_omset import PEMBAGIAN

H = O.CAKRAWALA
#: (laju belajar, langkah). Sedikit dan disengaja: tiap fine-tune di CPU makan
#: belasan menit, dan memilih dari banyak konfigurasi dengan delapan pekan
#: validasi hanya berarti memilih derau.
KONFIGURASI = ((1e-5, 300), (1e-6, 1000))


def _omset_sebagai_deret(om) -> DeretBarang:
    v = O._isi(om["omset"].to_numpy(), om["tanggal"])
    z = np.zeros(len(v), dtype=bool)
    return DeretBarang(0, 0, "omset", om["tanggal"].dt.date.to_numpy(), v, z, z, z, z)


def _nilai(nama_model: str, om, d_omset: DeretBarang, artikel: list[DeretBarang], asal: list[int]) -> dict:
    hilang = om["data_hilang"].astype(bool).to_numpy()
    asal_om = [a for a in asal if not hilang[a : a + H].any()]
    r_om = ramal_banyak([(d_omset, a) for a in asal_om], H, nama=nama_model)
    om_v = om["omset"].to_numpy(dtype=float)
    ramalan_om = [T.Ramalan(0, a, om_v[a : a + H], np.asarray(r[0.5]), float(om_v[a - 1])) for a, r in zip(asal_om, r_om)]
    tugas = [(d, a) for d in artikel for a in asal]
    r_ar = ramal_banyak(tugas, H, nama=nama_model)
    ramalan_ar = [T.buat_ramalan(d, a, np.asarray(r[0.5])) for (d, a), r in zip(tugas, r_ar)]
    return {"omset": T.ukur(ramalan_om), "artikel": T.ukur(ramalan_ar),
            "_ape_omset": [r.ape for r in ramalan_om], "_ape_artikel": [r.ape for r in ramalan_ar]}


def _fine_tune(d_omset: DeretBarang, artikel: list[DeretBarang], potong: int, lr: float, langkah: int, folder: Path) -> tuple[str, float]:
    pipa = _muat()
    masukan = [d_omset.terisi[:potong].astype(np.float32)] + [d.terisi[:potong].astype(np.float32) for d in artikel]
    t = time.perf_counter()
    baru = pipa.fit(
        masukan, prediction_length=H, context_length=PANJANG_KONTEKS, learning_rate=lr,
        num_steps=langkah, batch_size=32, output_dir=str(folder), seed=T.BENIH,
    )
    detik = time.perf_counter() - t
    simpan = folder / "model"
    baru.save_pretrained(str(simpan))
    return str(simpan), detik


def main() -> None:
    p = argparse.ArgumentParser(description="Fine-tune Chronos-2 di French Bakery.")
    p.add_argument("--keluaran-model", required=True, help="folder untuk checkpoint (di luar repo)")
    p.add_argument("--json", type=str, default="")
    p.add_argument("--konfigurasi", type=str, default="", help="mis. '1e-5:30' untuk uji cepat")
    arg = p.parse_args()
    akar = Path(arg.keluaran_model)
    konfigurasi = KONFIGURASI
    if arg.konfigurasi:
        konfigurasi = tuple((float(a), int(b)) for a, b in (x.split(":") for x in arg.konfigurasi.split(",")))

    om = sumber_data.muat("french_bakery", bentuk="omset").sort_values("tanggal").reset_index(drop=True)
    artikel = sumber_data.muat("french_bakery", bentuk="deret")
    d_omset = _omset_sebagai_deret(om)
    n_val, n_uji = PEMBAGIAN["french_bakery"]
    semua = sorted(len(om) - H * (k + 1) for k in range(n_val + n_uji))
    validasi, uji = semua[:n_val], semua[n_val:]
    pilih = validasi[-8:]

    hasil = {"rancangan": {"validasi_pemilihan": [str(om["tanggal"].iloc[a].date()) for a in pilih],
                           "uji_dikunci": [str(om["tanggal"].iloc[a].date()) for a in uji],
                           "artikel": len(artikel), "konfigurasi": konfigurasi}}

    print("== tanpa fine-tune, validasi", flush=True)
    nol_val = _nilai("amazon/chronos-2", om, d_omset, artikel, pilih)
    hasil["validasi"] = {"tanpa_finetune": nol_val}
    for lr, langkah in konfigurasi:
        nama = "lr%g_langkah%d" % (lr, langkah)
        print("== fine-tune %s (potong di %s)" % (nama, om["tanggal"].iloc[pilih[0]].date()), flush=True)
        model, detik = _fine_tune(d_omset, artikel, pilih[0], lr, langkah, akar / ("validasi_" + nama))
        hasil["validasi"][nama] = {**_nilai(model, om, d_omset, artikel, pilih), "detik_latih": detik}
        print("   omset %.1f%% | artikel %.1f%% | %.0f d" % (
            hasil["validasi"][nama]["omset"]["mape"], hasil["validasi"][nama]["artikel"]["mape"], detik), flush=True)

    # Pemilihan: MAPE pekanan artikel (1.192 pekan-artikel) — omset hanya 8 angka.
    calon = [k for k in hasil["validasi"] if k != "tanpa_finetune"]
    terbaik = min(calon, key=lambda k: hasil["validasi"][k]["artikel"]["mape"])
    hasil["terpilih"] = terbaik
    lr, langkah = next((a, b) for a, b in konfigurasi if "lr%g_langkah%d" % (a, b) == terbaik)

    print("== uji DIKUNCI: %s vs tanpa fine-tune" % terbaik, flush=True)
    model, detik = _fine_tune(d_omset, artikel, uji[0], lr, langkah, akar / ("uji_" + terbaik))
    ft = {**_nilai(model, om, d_omset, artikel, uji), "detik_latih": detik}
    nol = _nilai("amazon/chronos-2", om, d_omset, artikel, uji)
    banding = {}
    for tingkat in ("omset", "artikel"):
        x = np.array(ft["_ape_" + tingkat])
        y = np.array(nol["_ape_" + tingkat])
        sah = np.isfinite(x) & np.isfinite(y)
        banding[tingkat] = T.bootstrap_selisih(x[sah], y[sah])
    hasil["uji"] = {"finetune": ft, "tanpa_finetune": nol, "finetune_vs_tanpa": banding}
    for tingkat in ("omset", "artikel"):
        print("   %s: fine-tune %.1f%% vs tanpa %.1f%% | selisih %+.2f (95%%: %+.2f .. %+.2f)" % (
            tingkat, ft[tingkat]["mape"], nol[tingkat]["mape"], banding[tingkat]["selisih"],
            banding[tingkat]["bawah"], banding[tingkat]["atas"]), flush=True)

    def bersih(x):
        if isinstance(x, dict):
            return {k: bersih(v) for k, v in x.items() if not k.startswith("_")}
        return x

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(bersih(hasil), f, indent=1, ensure_ascii=False, default=float)
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
