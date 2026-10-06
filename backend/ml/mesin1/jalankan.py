"""
Jalankan perbandingan Mesin 1.

    python -m ml.mesin1.jalankan                 # garis dasar saja
    python -m ml.mesin1.jalankan --moirai        # ikut MOIRAI
    python -m ml.mesin1.jalankan --batas 40      # cepat, untuk 40 deret saja

Keluarannya satu tabel. Urutannya tidak diatur supaya model kita di atas:
diurutkan menurut WQL, dan kalau garis dasar yang menang, itulah yang tercetak
paling atas.
"""

from __future__ import annotations

import argparse
import json

from ..data import CAKRAWALA, muat_deret
from .dasar import METODE
from .evaluasi import uji_ulang


def main() -> None:
    p = argparse.ArgumentParser(description="Perbandingan metode Mesin 1.")
    p.add_argument("--batas", type=int, default=0, help="batasi jumlah deret (0 = semua)")
    p.add_argument("--asal", type=int, default=3, help="jumlah titik asal uji ulang")
    p.add_argument("--cakrawala", type=int, default=CAKRAWALA)
    p.add_argument("--moirai", action="store_true", help="ikutkan MOIRAI (perlu uni2ts)")
    p.add_argument("--ukuran", type=str, default="small", choices=("small", "base", "large"))
    p.add_argument("--kelompok", type=int, default=16, help="ukuran kelompok inferensi MOIRAI")
    p.add_argument("--json", type=str, default="", help="tulis hasil ke berkas JSON")
    arg = p.parse_args()

    deret = muat_deret()
    if arg.batas:
        deret = deret[: arg.batas]

    print("Deret       : %d" % len(deret))
    print("Titik asal  : %d (bergulir, jarak %d hari)" % (arg.asal, arg.cakrawala))
    print("Cakrawala   : %d hari" % arg.cakrawala)
    print("Kuantil     : p10 / p50 / p90")
    print()
    print("MASE 1,000 = setara naif musiman. Di bawah 1 berarti menang.")
    print("Cakupan p10-p90 seharusnya mendekati 80%.")
    print()

    metode: dict[str, tuple] = {n: (f, None) for n, f in METODE.items()}
    if arg.moirai:
        from .moirai import bungkus_moirai, ramal_banyak

        # MOIRAI diberi jalur berkelompok. Dipanggil satu per satu ia tampak
        # puluhan kali lebih lambat, dan angka itu akan salah dipakai sebagai
        # alasan menolaknya — padahal di produksi ia memang dijalankan sekali
        # sehari untuk semua barang sekaligus.
        metode["moirai_%s" % arg.ukuran] = (
            bungkus_moirai(arg.ukuran),
            lambda tugas, ck: ramal_banyak(tugas, ck, arg.ukuran, kelompok=arg.kelompok),
        )

    hasil = []
    for nama, (f, f_banyak) in metode.items():
        r = uji_ulang(
            deret, f, nama,
            cakrawala=arg.cakrawala, jumlah_asal=arg.asal, metode_banyak=f_banyak,
        )
        hasil.append(r)
        print(r.baris(), flush=True)

    print()
    urut = sorted(hasil, key=lambda r: (r.wql if r.wql == r.wql else 9e9))
    print("Peringkat menurut WQL (metrik utama): " + " > ".join(r.nama for r in urut))

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(
                [
                    {
                        "nama": r.nama, "mase": r.mase, "wql": r.wql,
                        "cakupan": r.cakupan, "n": r.n, "detik": r.detik,
                        "gagal": r.gagal, "mase_per_asal": r.mase_per_asal,
                    }
                    for r in hasil
                ],
                f,
                indent=2,
                ensure_ascii=False,
            )
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
