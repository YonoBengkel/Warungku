"""
Gambar untuk laporan: kipas perkiraan, kurva regret, perbandingan metrik, segmen.

Semua gambar dibuat dari berkas hasil di `keluaran/`, bukan dari angka yang
diketik ulang. Kalau percobaannya dijalankan ulang dan angkanya berubah,
gambarnya ikut berubah — tidak ada jalan bagi gambar dan tabel untuk saling
bertentangan.

    python -m ml.grafik
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

AKAR = Path(__file__).resolve().parent.parent.parent
KELUARAN = AKAR / "backend" / "keluaran"
#: Gambar ditaruh di folder laporan, bukan di `keluaran/`. Isi `keluaran/`
#: ter-gitignore karena berisi CSV besar yang bisa dibangkitkan ulang; gambar
#: laporan justru harus ikut terlacak, supaya dokumen Word dan berkas gambarnya
#: tidak pernah terpisah.
GAMBAR = AKAR / "laporan" / "gambar"

#: Palet yang sama dipakai seluruh gambar supaya satu metode punya satu warna
#: di mana pun ia muncul. Pembaca laporan tidak perlu memeriksa legenda dua kali.
WARNA = {
    "chronos": "#0f766e",
    "moirai": "#4a3aa7",
    "holt_winters": "#b45309",
    "kuantil_hari_pekan": "#0e7490",
    "croston": "#9a3412",
    "naif_musiman": "#6b7280",
    "bart": "#0f766e",
    "logistik": "#1d4ed8",
    "pohon": "#b45309",
    "thompson": "#0f766e",
    "greedy": "#9a3412",
    "linucb": "#1d4ed8",
    "epsilon": "#b45309",
    "oracle": "#16a34a",
    "termurah": "#dc2626",
    "acak": "#6b7280",
}


def _warna(nama: str) -> str:
    for kunci, w in WARNA.items():
        if kunci in nama:
            return w
    return "#6b7280"


def _siapkan():
    GAMBAR.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update(
        {
            "font.size": 10,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "grid.alpha": 0.25,
            "figure.dpi": 150,
        }
    )


def _simpan(fig, nama: str) -> Path:
    berkas = GAMBAR / nama
    fig.savefig(berkas, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return berkas


# --------------------------------------------------------------------------
def kipas_perkiraan(barang_id: int | None = None) -> Path | None:
    """
    Kipas p10-p50-p90 melawan permintaan sebenarnya, satu barang.

    Gambar ini yang menjelaskan Mesin 1 dalam sekali lihat — dan terutama
    menjelaskan kenapa keluarannya sebaran, bukan satu angka: batas aman
    diambil dari tepi atas kipas, bukan dari garis tengahnya.
    """
    from .data import muat_deret
    from .mesin1.chronos import ramal_banyak

    deret = muat_deret()
    if not deret:
        return None
    d = next((x for x in deret if x.barang_id == barang_id), deret[0])

    cakrawala = 30
    akhir = len(d) - cakrawala
    r = ramal_banyak([(d, akhir)], cakrawala)[0]

    ekor = 60
    t_lalu = np.arange(-ekor, 0)
    t_depan = np.arange(0, cakrawala)
    lalu = d.terisi[akhir - ekor : akhir]
    asli = d.nilai[akhir : akhir + cakrawala]

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t_lalu, lalu, color="#374151", lw=1.2, label="riwayat")
    ax.fill_between(t_depan, r[0.1], r[0.9], color=WARNA["chronos"], alpha=0.18, label="p10-p90")
    ax.plot(t_depan, r[0.5], color=WARNA["chronos"], lw=1.8, label="p50 (perkiraan)")
    ax.plot(t_depan, r[0.9], color=WARNA["chronos"], lw=1.0, ls="--", label="p90 (dasar batas aman)")
    ax.plot(t_depan, asli, color="#dc2626", lw=1.4, marker="o", ms=2.5, label="permintaan sebenarnya")
    ax.axvline(0, color="#9ca3af", lw=0.8)
    ax.set_xlabel("hari (0 = titik perkiraan dibuat)")
    ax.set_ylabel("permintaan (%s)" % d.satuan if hasattr(d, "satuan") else "permintaan")
    ax.set_title("Mesin 1 — Chronos-2: %s" % d.nama)
    ax.legend(frameon=False, ncol=3, fontsize=8)
    return _simpan(fig, "mesin1_kipas.png")


def banding_mesin1(berkas: str = "hasil_mesin1.json") -> Path | None:
    """Batang WQL dan MASE berdampingan, diurutkan dari yang terbaik."""
    p = KELUARAN / berkas
    if not p.exists():
        return None
    data = sorted(json.load(p.open(encoding="utf-8")), key=lambda x: x["wql"])
    nama = [d["nama"] for d in data]
    wql = [d["wql"] for d in data]
    mase = [d["mase"] for d in data]
    warna = [_warna(n) for n in nama]

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
    a1.barh(nama, wql, color=warna)
    a1.invert_yaxis()
    a1.set_xlabel("WQL (kecil lebih baik)")
    a1.set_title("Metrik utama: galat kuantil tertimbang")
    for i, v in enumerate(wql):
        a1.text(v, i, " %.4f" % v, va="center", fontsize=8)

    a2.barh(nama, mase, color=warna)
    a2.invert_yaxis()
    a2.axvline(1.0, color="#dc2626", lw=1.2, ls="--")
    a2.text(1.0, -0.6, " 1,0 = setara naif musiman", color="#dc2626", fontsize=8)
    a2.set_xlabel("MASE (kecil lebih baik)")
    a2.set_title("Pembanding: galat absolut berskala")
    for i, v in enumerate(mase):
        a2.text(v, i, " %.3f" % v, va="center", fontsize=8)

    fig.suptitle("Mesin 1 — perbandingan metode, 3 titik asal bergulir", y=1.02)
    return _simpan(fig, "mesin1_banding.png")


# --------------------------------------------------------------------------
def kurva_regret(berkas: str = "hasil_simulasi_mesin2.json") -> Path | None:
    """
    Regret kumulatif sepanjang simulasi — gambar terpenting untuk Mesin 2.

    Di sinilah kebijakan yang tidak menjelajah terlihat tertinggal: ia memilih
    yang terbaik menurut pengetahuan awalnya, dan pengetahuan itu tidak pernah
    bertambah karena ia tidak pernah mencoba yang lain.
    """
    p = KELUARAN / berkas
    if not p.exists():
        return None
    data = json.load(p.open(encoding="utf-8"))
    acuan = data["acuan"]

    fig, ax = plt.subplots(figsize=(9.5, 4.6))
    for h in data["hasil"]:
        if not h["kurva"]:
            continue
        x = np.arange(len(h["kurva"]))
        ax.plot(x, h["kurva"], lw=1.5, color=_warna(h["nama"]), label=h["nama"])

    # Garis acuan: kalau setiap keputusan diambil dengan kebijakan termurah.
    n_hari = max((len(h["kurva"]) for h in data["hasil"]), default=0)
    if n_hari:
        per_hari = acuan["keputusan"] / n_hari
        x = np.arange(n_hari)
        ax.plot(
            x, x * per_hari * acuan["termurah_regret"], lw=1.4, ls="--",
            color=WARNA["termurah"], label="selalu termurah (kebijakan sekarang)",
        )
        ax.plot(
            x, x * per_hari * acuan["acak_regret"], lw=1.2, ls=":",
            color=WARNA["acak"], label="memilih acak",
        )

    ax.set_xlabel("hari simulasi")
    ax.set_ylabel("regret kumulatif (pesanan gagal yang bisa dihindari)")
    ax.set_title("Mesin 2 — regret kumulatif: makin landai makin baik")
    ax.legend(frameon=False, fontsize=8, ncol=2)
    return _simpan(fig, "mesin2_regret.png")


def banding_mesin2(berkas: str = "hasil_simulasi_mesin2.json") -> Path | None:
    """Regret per keputusan, dengan acuan termurah dan acak sebagai garis."""
    p = KELUARAN / berkas
    if not p.exists():
        return None
    data = json.load(p.open(encoding="utf-8"))
    acuan = data["acuan"]
    hasil = sorted(data["hasil"], key=lambda x: x["regret_rata"])

    nama = [h["nama"] for h in hasil]
    nilai = [h["regret_rata"] for h in hasil]

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.barh(nama, nilai, color=[_warna(n) for n in nama])
    ax.invert_yaxis()
    ax.axvline(acuan["termurah_regret"], color=WARNA["termurah"], ls="--", lw=1.3)
    ax.text(acuan["termurah_regret"], -0.7, " selalu termurah", color=WARNA["termurah"], fontsize=8)
    ax.axvline(acuan["acak_regret"], color=WARNA["acak"], ls=":", lw=1.2)
    ax.text(acuan["acak_regret"], len(nama) - 0.2, " memilih acak", color=WARNA["acak"], fontsize=8)
    for i, v in enumerate(nilai):
        ax.text(v, i, " %.4f" % v, va="center", fontsize=8)
    ax.set_xlabel("regret per keputusan (kecil lebih baik; 0 = sempurna)")
    ax.set_title("Mesin 2 — regret rata-rata per keputusan")
    return _simpan(fig, "mesin2_banding.png")


# --------------------------------------------------------------------------
def sebaran_segmen() -> Path | None:
    """Jumlah pelanggan per segmen, dan posisi RFM rata-ratanya."""
    from sqlalchemy import text

    from warungku.basis_data import mesin

    with mesin().connect() as kon:
        baris = kon.execute(
            text(
                """
                SELECT nama_segmen, COUNT(*) AS n,
                       AVG(recency)::float8 AS r, AVG(frequency)::float8 AS f,
                       AVG(monetary)::float8 AS m
                  FROM segmen_pelanggan GROUP BY 1 ORDER BY n DESC
                """
            )
        ).all()
    if not baris:
        return None

    nama = [r[0] for r in baris]
    n = [r[1] for r in baris]
    r_ = [r[2] for r in baris]
    f_ = [r[3] for r in baris]
    m_ = [r[4] / 1e6 for r in baris]

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
    a1.barh(nama, n, color="#0f766e")
    a1.invert_yaxis()
    a1.set_xlabel("jumlah pelanggan")
    a1.set_title("Sebaran segmen (semua distributor)")
    for i, v in enumerate(n):
        a1.text(v, i, " %d" % v, va="center", fontsize=8)

    titik = a2.scatter(r_, f_, s=np.array(m_) * 2.2 + 30, c=range(len(nama)), cmap="viridis", alpha=0.8)
    for i, t in enumerate(nama):
        a2.annotate(t, (r_[i], f_[i]), fontsize=7, xytext=(4, 4), textcoords="offset points")
    a2.set_xlabel("rata-rata recency (hari sejak pesanan terakhir)")
    a2.set_ylabel("rata-rata frequency (banyak pesanan)")
    a2.set_title("Posisi segmen; besar titik = nilai belanja")
    return _simpan(fig, "mesin3_segmen.png")


# --------------------------------------------------------------------------
def semua() -> list[Path]:
    _siapkan()
    hasil = []
    for nama, f in (
        ("kipas perkiraan", kipas_perkiraan),
        ("banding Mesin 1", banding_mesin1),
        ("kurva regret", kurva_regret),
        ("banding Mesin 2", banding_mesin2),
        ("sebaran segmen", sebaran_segmen),
    ):
        try:
            p = f()
        except Exception as e:
            print("  %-18s GAGAL: %s: %s" % (nama, type(e).__name__, e))
            continue
        if p is None:
            print("  %-18s dilewati (berkas hasil belum ada)" % nama)
        else:
            print("  %-18s %s" % (nama, p))
            hasil.append(p)
    return hasil


if __name__ == "__main__":
    print("Gambar untuk laporan:")
    semua()
