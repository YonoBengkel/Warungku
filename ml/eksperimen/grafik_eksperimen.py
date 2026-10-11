"""
Grafik untuk percobaan penyetelan Mesin 2 dan Mesin 3.

    python -m ml.eksperimen.grafik_eksperimen

Membaca `ml/hasil/hasil_eksperimen_*.json`, menulis PNG ke `docs/laporan/gambar/`.

Palet: ungu #5b3fc4 dan oranye #d9572b (warna logo Turnify Flow), lolos
validator palet dataviz untuk latar terang (CVD ΔE 27,8; kontras >= 3:1).
Abu-abu hanya untuk acuan. Identitas tidak pernah dibawa warna saja: setiap
seri punya label langsung atau bentuk penanda berbeda.
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

AKAR = Path(__file__).resolve().parents[2]
KELUARAN = AKAR / "ml" / "hasil"
GAMBAR = AKAR / "docs" / "laporan" / "gambar"

UNGU = "#5b3fc4"
ORANYE = "#d9572b"
ABU = "#6b7280"
TINTA = "#1f2937"
TINTA_2 = "#4b5563"
GARIS = "#e5e7eb"


def _gaya() -> None:
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 9,
            "axes.edgecolor": "#9ca3af",
            "axes.labelcolor": TINTA_2,
            "xtick.color": TINTA_2,
            "ytick.color": TINTA_2,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "grid.color": GARIS,
            "grid.linewidth": 0.6,
            "figure.dpi": 150,
            "savefig.bbox": "tight",
        }
    )


def _muat(nama: str) -> dict | None:
    p = KELUARAN / nama
    if not p.exists():
        print("lewati, belum ada: %s" % p.name)
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def _angka(x: float, d: int = 0) -> str:
    """Format Indonesia: titik ribuan, koma desimal."""
    s = ("{:,.%df}" % d).format(x)
    return s.replace(",", "_").replace(".", ",").replace("_", ".")


# --------------------------------------------------------------------------
def grafik_ulangan() -> None:
    data = _muat("hasil_eksperimen_mesin2_ulangan.json")
    if not data:
        return
    baris = sorted(data["hasil"], key=lambda b: b["regret"]["rata"])
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    for i, b in enumerate(baris):
        produksi = "produksi" in b["nama"]
        warna = ORANYE if produksi else UNGU
        nilai = [r["regret"] for r in b["per_benih"]]
        ax.scatter(nilai, [i] * len(nilai), s=14, color=warna, alpha=0.45, linewidths=0, zorder=3)
        lo, hi = b["regret"]["ci95"]
        ax.plot([lo, hi], [i, i], color=warna, lw=2, solid_capstyle="round", zorder=4)
        ax.scatter([b["regret"]["rata"]], [i], s=46, color=warna, edgecolor="white", linewidth=1.5, zorder=5)
        sd = b["regret"]["sd"]
        ket = _angka(b["regret"]["rata"]) + (" ± %s" % _angka(sd) if sd > 0 else " (deterministik)")
        ax.text(max(nilai) + 6, i, ket, va="center", fontsize=8, color=TINTA_2)
    ax.set_yticks(range(len(baris)))
    ax.set_yticklabels([b["nama"] for b in baris], color=TINTA)
    ax.invert_yaxis()
    ax.set_xlabel("Regret total, 9.328 keputusan (makin kecil makin baik)")
    ax.grid(axis="y", visible=False)
    n = len(data["benih"])
    ax.set_title("Mesin 2: regret tiap kebijakan, diulang %d benih acak" % n, loc="left", color=TINTA, fontsize=10)
    fig.text(0.0, -0.04, "Titik kecil = satu benih; titik besar = rata-rata; garis = selang kepercayaan 95%. "
             "Oranye = konfigurasi produksi.", fontsize=7.5, color=TINTA_2)
    kanan = max(max(r["regret"] for r in b["per_benih"]) for b in baris)
    ax.set_xlim(right=kanan + 120)
    fig.savefig(GAMBAR / "eksperimen_mesin2_ulangan.png")
    plt.close(fig)


def grafik_kompromi() -> None:
    data = _muat("hasil_eksperimen_mesin2_harga.json")
    ulang = _muat("hasil_eksperimen_mesin2_ulangan.json")
    if not data:
        return
    #: Hanya titik ini yang diberi label; sisanya terbaca dari garisnya.
    berlabel = {("fuzzy", 1.0): "c=1 (produksi)", ("fuzzy", 1.5): "c=1,5", ("fuzzy", 3.0): "c=3",
                ("linear", 1.0): "λ=1", ("linear", 2.0): "λ=2"}
    geser = {"fuzzy": (7, -13), "linear": (0, 9)}
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    terpotong = []
    for awalan, warna, penanda, label in (("fuzzy", UNGU, "o", "Fuzzy Sugeno, kepekaan harga c"),
                                          ("linear", ORANYE, "s", "Garis lurus: skor − λ·(rasio − 1)")):
        bs = sorted([b for b in data["hasil"] if b["nama"].startswith(awalan)],
                    key=lambda b: b["konfig"]["lapis_param"])
        tampil = [b for b in bs if b["harga_p2"]["rata"] >= 1.02]
        terpotong += [b for b in bs if b["harga_p2"]["rata"] < 1.02]
        x = [b["harga_p2"]["rata"] for b in tampil]
        y = [b["regret_p2"]["rata"] for b in tampil]
        ye = [b["regret_p2"]["sd"] for b in tampil]
        ax.errorbar(x, y, yerr=ye, color=warna, marker=penanda, ms=6, lw=1.8, capsize=0,
                    elinewidth=1, label=label, zorder=4, markeredgecolor="white", markeredgewidth=1)
        for b, xi, yi in zip(tampil, x, y):
            teks = berlabel.get((awalan, b["konfig"]["lapis_param"]))
            if teks:
                dx, dy = geser[awalan]
                ax.annotate(teks, (xi, yi), textcoords="offset points", xytext=(dx, dy),
                            ha="left" if dx > 0 else "center", fontsize=7.5, color=warna)
    if ulang:
        for b in ulang["hasil"]:
            if b["nama"] in ("topsis", "greedy"):
                ax.scatter([b["harga_p2"]["rata"]], [b["regret_p2"]["rata"]], marker="D", s=34,
                           color=ABU, zorder=5)
                ax.annotate("TOPSIS" if b["nama"] == "topsis" else "greedy, tanpa harga",
                            (b["harga_p2"]["rata"], b["regret_p2"]["rata"]),
                            textcoords="offset points", xytext=(0, -14), ha="center", fontsize=7.5, color=ABU)
    koma2 = matplotlib.ticker.FuncFormatter(lambda v, _p: _angka(v, 3))
    ax.xaxis.set_major_formatter(koma2)
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _p: _angka(v)))
    ax.set_xlabel("Rasio harga rata-rata terhadap kandidat termurah, paruh kedua (makin kecil makin murah)")
    ax.set_ylabel("Regret paruh kedua")
    ax.set_title("Mesin 2: kompromi keandalan–harga, fuzzy vs garis lurus", loc="left", color=TINTA, fontsize=10)
    ax.legend(frameon=False, fontsize=8, loc="upper right")
    catatan = "Kiri-bawah lebih baik. Rata-rata %d benih; garis tegak = simpangan baku. Dinilai di paruh kedua." % len(data["benih"])
    if terpotong:
        catatan += " Tidak tampil: " + "; ".join(
            "%s (rasio %s, regret %s)" % (b["nama"].replace("lambda", "λ").replace("linear ", "garis lurus "),
                                         _angka(b["harga_p2"]["rata"], 3), _angka(b["regret_p2"]["rata"]))
            for b in terpotong) + "."
    fig.text(0.0, -0.03, catatan, fontsize=7.5, color=TINTA_2)
    fig.savefig(GAMBAR / "eksperimen_mesin2_kompromi.png")
    plt.close(fig)


def grafik_prior() -> None:
    data = _muat("hasil_eksperimen_mesin2_prior.json")
    if not data:
        return
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    geser = {("thompson", 0.5): -0.03, ("thompson", 0.7): 0.03, ("greedy", 0.5): 0.0, ("greedy", 0.7): 0.0}
    for keb, warna, penanda in (("thompson", UNGU, "o"), ("greedy", ORANYE, "s")):
        for m, gaya in ((0.5, "-"), (0.7, "--")):
            bs = sorted([b for b in data["hasil"] if b["konfig"]["kebijakan"] == keb and b["konfig"]["prior_m"] == m],
                        key=lambda b: b["konfig"]["prior_s"])
            if not bs:
                continue
            # Geser sedikit di sumbu log supaya batang galat dua seri tidak menumpuk.
            x = [b["konfig"]["prior_s"] * (10 ** geser[(keb, m)]) for b in bs]
            y = [b["regret_p2"]["rata"] for b in bs]
            ye = [b["regret_p2"]["sd"] for b in bs]
            ax.errorbar(x, y, yerr=ye, color=warna, ls=gaya, marker=penanda, ms=5, lw=1.6, elinewidth=1,
                        capsize=0, markeredgecolor="white", markeredgewidth=1,
                        label="%s, rata-rata prior m = %s" % (keb, _angka(m, 1)))
    ax.set_xscale("log")
    ax.set_xticks([0.5, 1, 2, 5, 10, 20])
    ax.set_xticklabels(["0,5", "1", "2", "5", "10", "20"])
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _p: _angka(v)))
    ax.set_ylim(660, 725)
    ax.set_xlabel("Kekuatan prior s (Beta(1,1) bawaan = s 2, m 0,5)")
    ax.set_ylabel("Regret paruh kedua")
    ax.set_title("Mesin 2: kepekaan terhadap prior Beta", loc="left", color=TINTA, fontsize=10)
    ax.legend(frameon=False, fontsize=7.5, loc="upper left", ncol=2)
    fig.text(0.0, -0.03, "Rata-rata %d benih; garis tegak = simpangan baku. Greedy deterministik, kedua garisnya berimpit. "
             "Dipilih di paruh pertama, dilaporkan di paruh kedua." % len(data["benih"]), fontsize=7.5, color=TINTA_2)
    fig.savefig(GAMBAR / "eksperimen_mesin2_prior.png")
    plt.close(fig)


def grafik_mesin3() -> None:
    data = _muat("hasil_eksperimen_mesin3.json")
    if not data:
        return
    nama_tampil = {
        "kprototypes_produksi": "K-Prototypes produksi",
        "kprototypes_log": "K-Prototypes + log F, M",
        "kprototypes_ditala": "K-Prototypes, gamma ditala",
        "gower_aglomeratif": "Gower + aglomeratif",
        "gower_hdbscan": "Gower + HDBSCAN",
    }
    fig, ax = plt.subplots(figsize=(7.2, 4.0))
    for kunci, nama in nama_tampil.items():
        a = data["agregat"].get(kunci)
        if not a:
            continue
        x = a["ari_jenis_usaha_rata"]
        y = a["ari_rata"]
        warna = ORANYE if kunci == "kprototypes_produksi" else (UNGU if kunci.startswith("kproto") else ABU)
        ax.scatter([x], [y], s=60, color=warna, edgecolor="white", linewidth=1.5, zorder=4)
        ax.annotate("%s\nη² recency %s" % (nama, _angka(a["eta2_rata"]["recency"], 2)), (x, y),
                    textcoords="offset points", xytext=(8, -4), fontsize=7.5, color=TINTA_2)
    ax.set_xlim(0, 1.15)
    ax.set_ylim(0.7, 1.0)
    koma = matplotlib.ticker.FuncFormatter(lambda v, _p: _angka(v, 2))
    ax.xaxis.set_major_formatter(koma)
    ax.yaxis.set_major_formatter(koma)
    ax.set_xlabel("Kemiripan segmen dengan jenis usaha (ARI; 1 = segmen = jenis usaha)")
    ax.set_ylabel("Stabilitas segmen (ARI subsampel 80%)")
    ax.set_title("Mesin 3: stabil karena perilaku belanja, atau karena jenis usaha?", loc="left",
                 color=TINTA, fontsize=10)
    fig.text(0.0, -0.03, "Rata-rata 8 distributor, %d subsampel. Kanan-atas = stabil, tapi hanya mengulang jenis usaha."
             % data["bootstrap"], fontsize=7.5, color=TINTA_2)
    fig.savefig(GAMBAR / "eksperimen_mesin3_banding.png")
    plt.close(fig)


def main() -> None:
    _gaya()
    GAMBAR.mkdir(parents=True, exist_ok=True)
    grafik_ulangan()
    grafik_kompromi()
    grafik_prior()
    grafik_mesin3()
    print("Gambar ditulis ke %s" % GAMBAR)


if __name__ == "__main__":
    main()
