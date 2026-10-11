"""
Jalankan perbandingan Mesin 2.

    python -m ml.mesin2.jalankan                  # garis dasar saja
    python -m ml.mesin2.jalankan --bandit         # ikut BART + Thompson
    python -m ml.mesin2.jalankan --keputusan 400  # cepat
"""

from __future__ import annotations

import argparse
import json

import pandas as pd

from ..data import belah_waktu, muat_counterfactual, muat_fitur_pesanan
from .dasar import GARIS_DASAR
from .evaluasi import acuan_oracle, evaluasi


def main() -> None:
    p = argparse.ArgumentParser(description="Perbandingan metode Mesin 2.")
    p.add_argument("--keputusan", type=int, default=0, help="batasi jumlah keputusan (0 = semua)")
    p.add_argument("--bandit", action="store_true", help="ikutkan BART + Thompson")
    p.add_argument("--json", type=str, default="")
    arg = p.parse_args()

    df = muat_fitur_pesanan()
    cf = muat_counterfactual()
    latih, uji = belah_waktu(df)
    batas = pd.to_datetime(uji["tanggal"]).min().date()
    acak, oracle = acuan_oracle(cf, batas)

    print("Baris latih   : %d (sampai %s)" % (len(latih), batas - pd.Timedelta(days=1).to_pytimedelta()))
    print("Baris uji     : %d (sejak %s)" % (len(uji), batas))
    print("Sukses latih  : %.1f%%   uji: %.1f%%" % (100 * latih["sukses"].mean(), 100 * uji["sukses"].mean()))
    print()
    print("Acuan P@1 di jendela uji — memilih acak: %.3f, sempurna (oracle): %.3f" % (acak, oracle))
    print("Angka P@1 model harus dibaca terhadap kedua batas itu, bukan terhadap nol.")
    print()

    metode = [(k.__name__, k) for k in GARIS_DASAR]
    if arg.bandit:
        from .bandit import BanditLengkap, Greedy, ThompsonSampling
        from .penaksir import BartBayesian, LogistikBayesian

        # Dibungkus kelas kecil supaya kerangka evaluasi yang lama — yang
        # memanggil `kelas()` tanpa argumen — tidak perlu diubah.
        def bungkus(penaksir, kebijakan, nama):
            return type(nama, (), {
                "nama": nama,
                "per_keputusan": False,
                "__init__": lambda self: BanditLengkap.__init__(self, penaksir(), kebijakan),
                "latih": BanditLengkap.latih,
                "peluang": BanditLengkap.peluang,
                "peluang_murni": BanditLengkap.peluang_murni,
            })

        metode += [
            ("bart_greedy", bungkus(BartBayesian, Greedy(), "bart+greedy")),
            ("bart_thompson", bungkus(BartBayesian, ThompsonSampling(), "bart+thompson")),
            ("logistik_bayes", bungkus(LogistikBayesian, Greedy(), "logistik_bayes+greedy")),
        ]

    hasil = []
    for _, kelas in metode:
        try:
            r = evaluasi(kelas, kelas.nama, df, cf, maks_keputusan=arg.keputusan)
        except Exception as e:
            print("%-20s GAGAL: %s: %s" % (kelas.nama, type(e).__name__, e), flush=True)
            continue
        hasil.append(r)
        print(r.baris(), flush=True)

    if hasil:
        print()
        urut = sorted(hasil, key=lambda r: (-r.presisi1, r.sesal))
        print("Peringkat menurut P@1 (metrik keputusan): " + " > ".join(r.nama for r in urut))

    if arg.json and hasil:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "acuan": {"acak": acak, "oracle": oracle},
                    "hasil": [vars(r) for r in hasil],
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
