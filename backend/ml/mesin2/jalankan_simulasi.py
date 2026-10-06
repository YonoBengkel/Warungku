"""
Jalankan simulasi regret berurutan untuk Mesin 2.

    python -m ml.mesin2.jalankan_simulasi                  # kebijakan, penaksir cepat
    python -m ml.mesin2.jalankan_simulasi --bart           # ikut BART
    python -m ml.mesin2.jalankan_simulasi --keputusan 2000 # cepat

Rancangan percobaannya dua sumbu, dipisah dengan sengaja:

* **Sumbu kebijakan** — semua kebijakan dijalankan dengan penaksir yang sama
  (logistik Bayesian, cepat). Selisih yang muncul murni karena kebijakannya.
* **Sumbu penaksir** — satu kebijakan (Thompson) dijalankan dengan tiga
  penaksir. Selisih yang muncul murni karena penaksirnya.

Kalau keduanya dicampur, "BART+Thompson menang" tidak bisa dipisahkan menjadi
"BART-nya yang bagus" atau "Thompson-nya yang bagus".
"""

from __future__ import annotations

import argparse
import json

from ..data import muat_counterfactual
from .bandit import EpsilonGreedy, Greedy, LinUCB, ThompsonSampling
from .penaksir import BartBayesian, LogistikBayesian, PohonBootstrap
from .simulasi import acuan_oracle_dan_termurah, jalankan


def main() -> None:
    p = argparse.ArgumentParser(description="Simulasi regret berurutan Mesin 2.")
    p.add_argument("--keputusan", type=int, default=0, help="batasi jumlah keputusan (0 = semua)")
    p.add_argument("--bart", action="store_true", help="ikutkan BART pada sumbu penaksir")
    p.add_argument("--latih-tiap", type=int, default=14, help="hari antar pelatihan ulang")
    p.add_argument("--json", type=str, default="")
    arg = p.parse_args()

    cf = muat_counterfactual()
    acuan = acuan_oracle_dan_termurah(cf, arg.keputusan)

    print("Keputusan berkandidat >=2 : %d" % acuan["keputusan"])
    print("Latih ulang tiap          : %d hari" % arg.latih_tiap)
    print()
    print("Acuan (rata-rata sukses per keputusan):")
    print("  oracle (batas atas)     : %.4f   regret 0" % acuan["oracle_sukses"])
    print("  memilih acak            : %.4f   regret %.4f" % (acuan["acak_sukses"], acuan["acak_regret"]))
    print("  selalu termurah         : %.4f   regret %.4f" % (acuan["termurah_sukses"], acuan["termurah_regret"]))
    print()

    hasil = []

    # --- sumbu kebijakan: penaksir dipegang tetap ---------------------------
    print("=== Sumbu kebijakan (penaksir: logistik Bayesian) ===")
    for keb in (Greedy(), EpsilonGreedy(0.10), ThompsonSampling(), LinUCB(1.0)):
        r = jalankan(
            "logistik+" + keb.nama, LogistikBayesian, keb, cf,
            latih_tiap=arg.latih_tiap, maks_keputusan=arg.keputusan,
        )
        hasil.append(r)
        print(r.baris(), flush=True)

    # --- sumbu penaksir: kebijakan dipegang tetap ---------------------------
    print()
    print("=== Sumbu penaksir (kebijakan: Thompson Sampling) ===")
    penaksir = [("pohon_bootstrap", PohonBootstrap)]
    if arg.bart:
        penaksir.append(("bart", BartBayesian))
    for nama, kelas in penaksir:
        r = jalankan(
            nama + "+thompson", kelas, ThompsonSampling(), cf,
            latih_tiap=arg.latih_tiap, maks_keputusan=arg.keputusan,
        )
        hasil.append(r)
        print(r.baris(), flush=True)

    print()
    urut = sorted(hasil, key=lambda r: r.regret_total)
    print("Peringkat menurut regret kumulatif (kecil lebih baik):")
    for i, r in enumerate(urut, 1):
        print("  %d. %-28s %7.1f" % (i, r.nama, r.regret_total))

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "acuan": acuan,
                    "hasil": [
                        {
                            "nama": r.nama, "keputusan": r.keputusan,
                            "regret_total": r.regret_total, "regret_rata": r.regret_rata,
                            "sukses_rata": r.sukses_rata, "detik": r.detik,
                            "kurva": r.kurva,
                            "tanggal": [t.isoformat() for t in r.tanggal],
                        }
                        for r in hasil
                    ],
                },
                f,
                indent=1,
                ensure_ascii=False,
            )
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
