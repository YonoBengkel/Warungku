"""
Penyetelan Mesin 2 di atas simulasi regret berurutan yang sama dengan produksi.

    python -m ml.eksperimen.mesin2_penyetelan                 # semua percobaan
    python -m ml.eksperimen.mesin2_penyetelan --hanya ulangan # satu percobaan
    python -m ml.eksperimen.mesin2_penyetelan --cepat         # uji asap

Empat pertanyaan, masing-masing satu percobaan:

1. **ulangan** — Angka regret di laporan (greedy 1.383, Thompson 1.420, ...)
   berasal dari SATU benih acak. Benih itu ikut menentukan cuplikan Thompson,
   lemparan epsilon, dan ulasan mana yang ditulis (yang mengubah fitur rating).
   Selisih 37 regret bisa saja hanya derau. Di sini tiap kebijakan diulang
   dengan banyak benih, dan selisihnya diberi selang kepercayaan.
2. **prior** — Beta(1, 1) adalah pilihan bawaan, bukan hasil penyetelan.
   Kekuatan prior (s) dan rata-ratanya (m) ditala: a = s·m, b = s·(1 − m).
3. **peluruhan** — Hitungan lama dilupakan perlahan (faktor γ per keputusan),
   supaya distributor yang mutunya berubah cepat terbaca. Simulasi kita TIDAK
   memuat perubahan mutu, jadi hasil yang diharapkan: seri atau sedikit kalah.
   Percobaan ini tetap dijalankan sebagai bukti bahwa datasetnya yang perlu
   diubah sebelum pertanyaan ini bisa dijawab.
4. **harga** — Lapis fuzzy dibandingkan dengan pembanding paling sederhana yang
   mungkin: skor − λ·(rasio_harga − 1). Kalau garis lurus itu memberi kompromi
   regret-harga yang sama baiknya, fuzzy tidak menambah apa-apa selain
   kemudahan dijelaskan — dan itu harus dikatakan.

**Aturan pemilihan.** Rentang simulasi dibelah dua menurut tanggal. Paruh
pertama (P1) dipakai MEMILIH pengaturan; paruh kedua (P2) hanya untuk
MELAPORKAN. Pengaturan yang dipilih dan dinilai di data yang sama akan selalu
tampak lebih baik daripada yang sebenarnya.

Modul produksi tidak diubah sama sekali; semuanya lewat parameter.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import numpy as np

from ..data import muat_counterfactual
from ..mesin2.bandit import EpsilonGreedy, Greedy, LinUCB, ThompsonSampling
from ..mesin2.beta import BetaBernoulli
from ..mesin2.dasar import Topsis
from ..mesin2.fuzzy import ATURAN_BAWAAN
from ..mesin2.simulasi import _siapkan, jalankan

BENIH_DASAR = 20261006
KELUARAN = Path(__file__).resolve().parents[1] / "hasil"


# --------------------------------------------------------------------------
# Penaksir dan lapis harga yang hanya ada di percobaan
# --------------------------------------------------------------------------
class BetaPeluruhan(BetaBernoulli):
    """
    Beta-Bernoulli yang melupakan perlahan: setiap pesanan baru, semua hitungan
    lama dikali γ. Ingatan efektifnya sekitar 1 / (1 − γ) pesanan.
    """

    def __init__(self, gamma: float, **kw) -> None:
        super().__init__(**kw)
        self.gamma = gamma
        self.nama += "_luruh%g" % gamma

    def perbarui(self, kunci, hasil: int) -> None:
        if self.gamma < 1.0:
            for d in (self.sukses, self.gagal):
                for k in d:
                    d[k] *= self.gamma
        super().perbarui(kunci, hasil)


class LapisFuzzy:
    """Fuzzy produksi, dengan kepekaan harga diskalakan: rasio' = 1 + c·(rasio − 1)."""

    def __init__(self, c: float) -> None:
        self.c = c

    def __call__(self, skor, rasio):
        return ATURAN_BAWAAN.skor(skor, 1.0 + self.c * (np.asarray(rasio) - 1.0))


class LapisLinear:
    """Pembanding paling sederhana: skor − λ·(rasio − 1)."""

    def __init__(self, lam: float) -> None:
        self.lam = lam

    def __call__(self, skor, rasio):
        return np.asarray(skor) - self.lam * (np.asarray(rasio) - 1.0)


# --------------------------------------------------------------------------
# Satu konfigurasi = satu baris yang bisa dikirim ke proses pekerja
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Konfig:
    percobaan: str
    nama: str
    kebijakan: str = "thompson"          # greedy | epsilon | thompson | linucb | topsis
    prior_s: float = 2.0                  # Beta(1, 1) = s 2, m 0,5
    prior_m: float = 0.5
    gamma: float = 1.0
    lapis: str = ""                       # "" | fuzzy | linear
    lapis_param: float = 0.0
    benih: int = BENIH_DASAR

    def buat(self):
        if self.kebijakan == "topsis":
            return Topsis, None, None
        a, b = self.prior_s * self.prior_m, self.prior_s * (1.0 - self.prior_m)
        if self.gamma < 1.0:
            penaksir = lambda: BetaPeluruhan(self.gamma, daring=True, prior_a=a, prior_b=b)  # noqa: E731
        else:
            penaksir = lambda: BetaBernoulli(daring=True, prior_a=a, prior_b=b)  # noqa: E731
        keb = {
            "greedy": Greedy(),
            "epsilon": EpsilonGreedy(0.10),
            "thompson": ThompsonSampling(),
            "linucb": LinUCB(1.0),
        }[self.kebijakan]
        lapis = None
        if self.lapis == "fuzzy":
            lapis = LapisFuzzy(self.lapis_param)
        elif self.lapis == "linear":
            lapis = LapisLinear(self.lapis_param)
        return penaksir, keb, lapis


@dataclass
class Hasil:
    konfig: Konfig
    keputusan: int
    regret: float
    regret_p1: float
    regret_p2: float
    harga: float
    harga_p1: float
    harga_p2: float
    detik: float
    kurva: list[float] = field(default_factory=list)


_CF = None
_KEPUTUSAN = None


def _siapkan_pekerja():
    global _CF, _KEPUTUSAN
    if _CF is None:
        _CF = muat_counterfactual()
        _KEPUTUSAN = _siapkan(_CF)


def tanggal_belah(keputusan) -> date:
    """Titik tengah rentang tanggal: P1 sebelum, P2 sejak tanggal ini."""
    awal, akhir = keputusan[0][0], keputusan[-1][0]
    return awal + (akhir - awal) / 2


def jalankan_satu(k: Konfig) -> Hasil:
    _siapkan_pekerja()
    penaksir, keb, lapis = k.buat()
    r = jalankan(k.nama, penaksir, keb, _CF, benih=k.benih, lapis_harga=lapis)

    # Pecah regret dan harga per paruh dari pilihan per keputusan. Urutan
    # `pilihan` sama dengan urutan `_siapkan(cf)`, jadi bisa dicocokkan langsung.
    belah = tanggal_belah(_KEPUTUSAN)
    reg = [0.0, 0.0]
    hrg = [0.0, 0.0]
    n = [0, 0]
    for (tgl, g), p in zip(_KEPUTUSAN, r.pilihan):
        i = 0 if tgl < belah else 1
        hasil = g["sukses"].to_numpy(dtype=int)
        reg[i] += int(hasil.max()) - int(hasil[p])
        hrg[i] += float(g["rasio_harga"].iloc[p])
        n[i] += 1
    assert abs(sum(reg) - r.regret_total) < 1e-9, "pemecahan per paruh tidak cocok dengan total"
    return Hasil(
        konfig=k, keputusan=r.keputusan, regret=r.regret_total,
        regret_p1=reg[0], regret_p2=reg[1],
        harga=r.harga_rata, harga_p1=hrg[0] / max(1, n[0]), harga_p2=hrg[1] / max(1, n[1]),
        detik=r.detik,
        # Kurva hanya disimpan untuk benih pertama, supaya JSON tidak membengkak.
        kurva=r.kurva if k.benih == BENIH_DASAR else [],
    )


# --------------------------------------------------------------------------
# Daftar percobaan
# --------------------------------------------------------------------------
def daftar_percobaan(n_ulang: int, n_tala: int) -> dict[str, list[Konfig]]:
    benih_ulang = [BENIH_DASAR + i for i in range(n_ulang)]
    benih_tala = [BENIH_DASAR + i for i in range(n_tala)]
    out: dict[str, list[Konfig]] = {}

    # 1. Ulangan: kebijakan produksi dan pembandingnya, banyak benih.
    ulangan = [
        ("greedy", dict(kebijakan="greedy")),
        ("epsilon_greedy_0.1", dict(kebijakan="epsilon")),
        ("thompson", dict(kebijakan="thompson")),
        ("linucb_a1", dict(kebijakan="linucb")),
        ("thompson+fuzzy (produksi)", dict(kebijakan="thompson", lapis="fuzzy", lapis_param=1.0)),
        ("greedy+fuzzy", dict(kebijakan="greedy", lapis="fuzzy", lapis_param=1.0)),
        ("topsis", dict(kebijakan="topsis")),
    ]
    out["ulangan"] = [Konfig("ulangan", nama, benih=b, **kw) for nama, kw in ulangan for b in benih_ulang]

    # 2. Prior: kekuatan s dan rata-rata m, untuk Thompson dan greedy.
    out["prior"] = [
        Konfig("prior", "%s s=%g m=%g" % (keb, s, m), kebijakan=keb, prior_s=s, prior_m=m, benih=b)
        for keb in ("thompson", "greedy")
        for m in (0.5, 0.7)
        for s in (0.5, 1.0, 2.0, 5.0, 10.0, 20.0)
        for b in benih_tala
    ]

    # 3. Peluruhan.
    out["peluruhan"] = [
        Konfig("peluruhan", "thompson gamma=%g" % g, kebijakan="thompson", gamma=g, benih=b)
        for g in (1.0, 0.9995, 0.999, 0.998, 0.995)
        for b in benih_tala
    ]

    # 4. Harga: fuzzy dengan kepekaan c vs garis lurus dengan λ.
    out["harga"] = [
        Konfig("harga", "fuzzy c=%g" % c, kebijakan="thompson", lapis="fuzzy", lapis_param=c, benih=b)
        for c in (0.0, 0.5, 1.0, 1.5, 2.0, 3.0)
        for b in benih_tala
    ] + [
        Konfig("harga", "linear lambda=%g" % lam, kebijakan="thompson", lapis="linear", lapis_param=lam, benih=b)
        for lam in (0.0, 0.25, 0.5, 1.0, 2.0, 4.0)
        for b in benih_tala
    ]
    return out


# --------------------------------------------------------------------------
# Ringkasan
# --------------------------------------------------------------------------
def _ringkas(nilai: list[float]) -> dict:
    x = np.asarray(nilai, dtype=float)
    n = len(x)
    rata = float(x.mean())
    sd = float(x.std(ddof=1)) if n > 1 else 0.0
    # Selang 95% untuk rata-rata, pakai t (n kecil).
    t = {2: 12.706, 3: 4.303, 4: 3.182, 5: 2.776, 6: 2.571, 8: 2.365, 10: 2.262, 12: 2.201, 15: 2.145, 20: 2.093}
    tk = t.get(n, 1.96)
    se = sd / math.sqrt(n) if n > 1 else 0.0
    return {"n": n, "rata": rata, "sd": sd, "ci95": [rata - tk * se, rata + tk * se]}


def ringkas(hasil: list[Hasil]) -> list[dict]:
    per_nama: dict[str, list[Hasil]] = {}
    for h in hasil:
        per_nama.setdefault(h.konfig.nama, []).append(h)
    baris = []
    for nama, hs in per_nama.items():
        k = hs[0].konfig
        baris.append(
            {
                "nama": nama,
                "konfig": {kk: vv for kk, vv in k.__dict__.items() if kk not in ("benih", "nama", "percobaan")},
                "regret": _ringkas([h.regret for h in hs]),
                "regret_p1": _ringkas([h.regret_p1 for h in hs]),
                "regret_p2": _ringkas([h.regret_p2 for h in hs]),
                "harga": _ringkas([h.harga for h in hs]),
                "harga_p2": _ringkas([h.harga_p2 for h in hs]),
                "detik_rata": float(np.mean([h.detik for h in hs])),
                "per_benih": [
                    {"benih": h.konfig.benih, "regret": h.regret, "regret_p1": h.regret_p1,
                     "regret_p2": h.regret_p2, "harga": h.harga, "harga_p2": h.harga_p2}
                    for h in sorted(hs, key=lambda h: h.konfig.benih)
                ],
                "kurva_benih_dasar": next((h.kurva for h in hs if h.kurva), []),
            }
        )
    return baris


def main() -> None:
    p = argparse.ArgumentParser(description="Penyetelan Mesin 2 (percobaan).")
    p.add_argument("--hanya", default="", help="ulangan | prior | peluruhan | harga (koma untuk beberapa)")
    p.add_argument("--ulang", type=int, default=10, help="jumlah benih percobaan ulangan")
    p.add_argument("--tala", type=int, default=5, help="jumlah benih percobaan penyetelan")
    p.add_argument("--pekerja", type=int, default=max(1, min(6, (os.cpu_count() or 2) // 3)))
    p.add_argument("--cepat", action="store_true", help="uji asap: 2 benih, satu percobaan")
    arg = p.parse_args()

    if arg.cepat:
        arg.ulang, arg.tala, arg.hanya = 2, 2, arg.hanya or "ulangan"

    semua = daftar_percobaan(arg.ulang, arg.tala)
    pilih = [s.strip() for s in arg.hanya.split(",") if s.strip()] or list(semua)

    _siapkan_pekerja()
    belah = tanggal_belah(_KEPUTUSAN)
    print("Keputusan: %d | P1 < %s <= P2 | pekerja %d" % (len(_KEPUTUSAN), belah, arg.pekerja), flush=True)

    for nama_percobaan in pilih:
        konfig = semua[nama_percobaan]
        mulai = time.perf_counter()
        hasil: list[Hasil] = []
        print("=== %s: %d jalan ===" % (nama_percobaan, len(konfig)), flush=True)
        with ProcessPoolExecutor(max_workers=arg.pekerja) as ex:
            masa = {ex.submit(jalankan_satu, k): k for k in konfig}
            for i, f in enumerate(as_completed(masa), 1):
                h = f.result()
                hasil.append(h)
                print("  [%3d/%3d] %-28s benih %d | regret %6.0f (P1 %5.0f, P2 %5.0f) | harga %.4f | %4.0fs"
                      % (i, len(konfig), h.konfig.nama, h.konfig.benih, h.regret, h.regret_p1,
                         h.regret_p2, h.harga, h.detik), flush=True)

        ring = ringkas(hasil)
        berkas = KELUARAN / ("hasil_eksperimen_mesin2_%s.json" % nama_percobaan)
        with open(berkas, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "percobaan": nama_percobaan,
                    "keputusan": len(_KEPUTUSAN),
                    "tanggal_belah": belah.isoformat(),
                    "benih": sorted({h.konfig.benih for h in hasil}),
                    "detik_total": time.perf_counter() - mulai,
                    "hasil": ring,
                },
                f, indent=1, ensure_ascii=False,
            )
        print("--- ringkasan %s (rata ± sd; P2 = paruh pelaporan) ---" % nama_percobaan)
        for b in sorted(ring, key=lambda b: b["regret"]["rata"]):
            print("  %-28s regret %7.1f ± %5.1f | P2 %6.1f ± %5.1f | harga %.4f"
                  % (b["nama"], b["regret"]["rata"], b["regret"]["sd"],
                     b["regret_p2"]["rata"], b["regret_p2"]["sd"], b["harga"]["rata"]))
        print("JSON: %s" % berkas, flush=True)


if __name__ == "__main__":
    main()
