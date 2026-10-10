"""
Jalankan evaluasi pekanan Mesin 1.

    python -m ml.mesin1.jalankan_pekanan                    # tanpa Chronos
    python -m ml.mesin1.jalankan_pekanan --chronos          # ikut Chronos-2
    python -m ml.mesin1.jalankan_pekanan --batas 60         # cepat

Model utama: ETS/Holt-Winters (parameternya bisa dibaca per barang).
Pembanding: Chronos-2, naif musiman, kuantil hari-pekan, dan aturan sederhana.
"""

from __future__ import annotations

import argparse
import json

from ..data import muat_deret
from . import pekanan
from .dasar import holt_winters, kuantil_hari_pekan, naif_musiman


def main() -> None:
    p = argparse.ArgumentParser(description="Evaluasi pekanan Mesin 1 (MAPE).")
    p.add_argument("--batas", type=int, default=0)
    p.add_argument("--chronos", action="store_true")
    p.add_argument("--json", type=str, default="")
    arg = p.parse_args()

    deret = muat_deret()
    if arg.batas:
        deret = deret[: arg.batas]

    # Harga per satuan dasar datang dari kontrak data (DeretBarang.harga_satuan).
    # Barang tanpa harga dianggap lolos ABC, dan itu tercatat di alasannya.
    harga: dict[int, float] = {
        d.barang_id: d.harga_satuan for d in deret if getattr(d, "harga_satuan", None) is not None
    }
    lolos = pekanan.lolos_per_asal(deret, harga, pekanan.JUMLAH_ASAL)

    print("Deret: %d | titik asal: %d pekan | horizon: %d hari" % (len(deret), pekanan.JUMLAH_ASAL, pekanan.CAKRAWALA))
    print("Pasangan (barang, pekan) lolos saringan: %d" % len(lolos))
    print("MAPE pekanan: jumlah 7 hari; pekan dengan hari stok habis dikeluarkan.")
    print()

    metode = [
        ("naif_musiman", pekanan.satu_per_satu(naif_musiman)),
        ("aturan_sederhana", pekanan.aturan_sederhana),
        ("kuantil_hari_pekan", pekanan.satu_per_satu(kuantil_hari_pekan)),
        ("ets_holt_winters", pekanan.satu_per_satu(holt_winters)),
    ]
    if arg.chronos:
        from .chronos import ramal_banyak

        metode.append(("chronos_2", lambda t, c: ramal_banyak(t, c)))

    hasil = []
    for nama, f in metode:
        r = pekanan.nilai(nama, deret, f, lolos)
        hasil.append(r)
        print(r.baris(), flush=True)

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "rancangan": {
                        "titik_asal": pekanan.JUMLAH_ASAL,
                        "cakrawala_hari": pekanan.CAKRAWALA,
                        "deret": len(deret),
                        "pasangan_lolos": len(lolos),
                        "abc": "aktif untuk %d dari %d barang" % (len(harga), len(deret)),
                    },
                    "hasil": [pekanan.ke_kamus(r) for r in hasil],
                },
                f,
                indent=1,
                ensure_ascii=False,
            )
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
