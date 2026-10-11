"""
Jalankan simulasi regret berurutan untuk Mesin 2.

    python -m ml.mesin2.jalankan_simulasi                  # tanpa BART (cepat)
    python -m ml.mesin2.jalankan_simulasi --bart           # ikut BART (~10 menit)
    python -m ml.mesin2.jalankan_simulasi --keputusan 2000 # cepat

Tiga sumbu, dipisah dengan sengaja:

* **Sumbu penaksir** — kebijakan dipegang tetap (Thompson), jadwal latih sama
  untuk semua (tiap 30 hari). Menjawab: apakah model yang lebih rumit memberi
  keandalan lebih baik daripada hitungan Beta-Bernoulli?
* **Sumbu kebijakan** — penaksir dipegang tetap (Beta-Bernoulli daring).
  Menjawab: apakah eksplorasi membayar dirinya?
* **Sumbu harga** — keputusan yang ikut menimbang harga (TOPSIS, fuzzy).
  Regret di sini PASTI lebih tinggi, karena regret hanya mengukur keandalan;
  yang harus dibaca adalah harga rata-rata yang didapat sebagai gantinya.

Kalau sumbu dicampur, "Beta+Thompson+fuzzy menang" tidak bisa dipecah menjadi
bagian mana yang membuatnya menang.
"""

from __future__ import annotations

import argparse
import json

from ..data import muat_counterfactual
from .bandit import EpsilonGreedy, Greedy, LinUCB, ThompsonSampling
from .beta import BetaBernoulli
from .dasar import Topsis
from .fuzzy import ATURAN_BAWAAN
from .penaksir import BartBayesian, LogistikBayesian
from .simulasi import acuan_oracle_dan_termurah, jalankan


def _fuzzy(skor, rasio_harga):
    return ATURAN_BAWAAN.skor(skor, rasio_harga)


def main() -> None:
    p = argparse.ArgumentParser(description="Simulasi regret berurutan Mesin 2.")
    p.add_argument("--keputusan", type=int, default=0, help="batasi jumlah keputusan (0 = semua)")
    p.add_argument("--bart", action="store_true", help="ikutkan BART pada sumbu penaksir")
    p.add_argument("--json", type=str, default="")
    arg = p.parse_args()

    cf = muat_counterfactual()
    acuan = acuan_oracle_dan_termurah(cf, arg.keputusan)
    print("Keputusan berkandidat >=2 : %d" % acuan["keputusan"])
    print()
    print("Acuan (rata-rata per keputusan):")
    print("  oracle          sukses %.4f  regret 0       harga %.4f" % (acuan["oracle_sukses"], acuan["oracle_harga"]))
    print("  memilih acak    sukses %.4f  regret %.4f  harga %.4f" % (acuan["acak_sukses"], acuan["acak_regret"], acuan["acak_harga"]))
    print("  selalu termurah sukses %.4f  regret %.4f  harga 1.0000" % (acuan["termurah_sukses"], acuan["termurah_regret"]))
    print()

    kelompok: list[tuple[str, list]] = [
        (
            "Sumbu penaksir (kebijakan Thompson, latih ulang tiap 30 hari)",
            [
                ("logistik+thompson", LogistikBayesian, ThompsonSampling(), None),
                ("beta+thompson", lambda: BetaBernoulli(), ThompsonSampling(), None),
                ("beta_konteks+thompson", lambda: BetaBernoulli(pisah_konteks=True), ThompsonSampling(), None),
            ]
            + ([("bart+thompson", BartBayesian, ThompsonSampling(), None)] if arg.bart else []),
        ),
        (
            "Sumbu kebijakan (penaksir Beta-Bernoulli daring)",
            [
                ("beta_daring+greedy", lambda: BetaBernoulli(daring=True), Greedy(), None),
                ("beta_daring+epsilon_greedy_0.1", lambda: BetaBernoulli(daring=True), EpsilonGreedy(0.10), None),
                ("beta_daring+thompson", lambda: BetaBernoulli(daring=True), ThompsonSampling(), None),
                ("beta_daring+linucb_a1", lambda: BetaBernoulli(daring=True), LinUCB(1.0), None),
            ],
        ),
        (
            "Sumbu harga (keputusan ikut menimbang harga)",
            [
                ("topsis", Topsis, None, None),
                ("beta_daring+thompson+fuzzy", lambda: BetaBernoulli(daring=True), ThompsonSampling(), _fuzzy),
                # Tanpa eksplorasi: fuzzy terdorong ke kandidat termurah dan
                # tidak pernah belajar bahwa sebagian di antaranya buruk.
                ("beta_daring+greedy+fuzzy", lambda: BetaBernoulli(daring=True), Greedy(), _fuzzy),
            ],
        ),
    ]

    hasil = []
    for judul, daftar in kelompok:
        print("=== %s ===" % judul)
        for nama, buat, keb, lapis in daftar:
            r = jalankan(nama, buat, keb, cf, maks_keputusan=arg.keputusan, lapis_harga=lapis)
            hasil.append((judul, r))
            print(r.baris(), flush=True)
        print()

    if arg.json:
        with open(arg.json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "acuan": acuan,
                    "hasil": [
                        {
                            "sumbu": judul, "nama": r.nama, "keputusan": r.keputusan,
                            "regret_total": r.regret_total, "regret_rata": r.regret_rata,
                            "sukses_rata": r.sukses_rata, "harga_rata": r.harga_rata,
                            "detik": r.detik, "kurva": r.kurva,
                            "tanggal": [t.isoformat() for t in r.tanggal],
                        }
                        for judul, r in hasil
                    ],
                },
                f,
                indent=1,
                ensure_ascii=False,
            )
        print("JSON: %s" % arg.json)


if __name__ == "__main__":
    main()
