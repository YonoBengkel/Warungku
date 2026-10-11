"""
Jalankan evaluasi peramalan omset pada semua sumber yang tersedia.

    python -m ml.mesin1.jalankan_omset
    python -m ml.mesin1.jalankan_omset --sumber french_bakery --asal 40

Tiap sumber dilatih dan diuji di dirinya sendiri; tidak ada parameter yang
dipindah antarsumber. Data toko roti hanya membuktikan metodenya bekerja pada
data toko sungguhan, bukan menggantikan data Warungku.
"""

from __future__ import annotations

import argparse
import json

from .. import sumber as sumber_data
from . import omset as O
from .pencilan import ringkas, tandai

#: Jumlah titik asal per sumber. Toko roti hanya satu entitas, jadi butuh jauh
#: lebih banyak pekan supaya selisih antarmetode punya arti; simulasi punya 70
#: entitas, jadi delapan pekan sudah memberi 560 pekan nilai.
ASAL_BAWAAN = {"simulasi": 8, "french_bakery": 40}


def main() -> None:
    p = argparse.ArgumentParser(description="Evaluasi peramalan omset (MAPE pekanan).")
    p.add_argument("--sumber", nargs="*", default=["simulasi", "french_bakery"])
    p.add_argument("--asal", type=int, default=0, help="jumlah titik asal (0 = bawaan per sumber)")
    p.add_argument("--tanpa-chronos", action="store_true")
    p.add_argument("--json", type=str, default="")
    arg = p.parse_args()

    keluaran: dict[str, dict] = {}
    for nama_sumber in arg.sumber:
        try:
            df = sumber_data.muat(nama_sumber, bentuk="omset")
        except Exception as e:
            print("== %s: DILEWATI (%s: %s)" % (nama_sumber, type(e).__name__, e))
            keluaran[nama_sumber] = {"dilewati": "%s: %s" % (type(e).__name__, e)}
            continue

        df = tandai(df)
        info = ringkas(df)
        asal = arg.asal or ASAL_BAWAAN.get(nama_sumber, 8)
        print("== %s: %d entitas, %d hari dinilai, pencilan %d (%.1f%%), dijelaskan kalender %d, titik asal %d" % (
            nama_sumber, df["entitas_id"].nunique(), info["hari_dinilai"], info["pencilan"],
            info["persen_pencilan"], info["dijelaskan_kalender"], asal))

        hasil = []
        for nama, f in O.METODE.items():
            if nama == "chronos_2" and arg.tanpa_chronos:
                continue
            r = O.evaluasi(nama, f, df, jumlah_asal=asal)
            hasil.append(r)
            print("  " + r.baris(), flush=True)
        keluaran[nama_sumber] = {"pencilan": info, "titik_asal": asal, "hasil": [O.ke_kamus(r) for r in hasil]}
        print()

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(keluaran, f, indent=1, ensure_ascii=False)
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
