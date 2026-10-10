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
    "aturan_sederhana": "#9ca3af",
    "ets": "#b45309",
    "sarimax": "#7c3aed",
    "var": "#be185d",
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


#: Pada grafik Mesin 2, nama metode berbentuk "penaksir+kebijakan". Mewarnainya
#: dengan satu aturan membuat keempat kebijakan berpenaksir sama tampil dengan
#: warna identik — dan justru perbandingan kebijakan itulah isi grafiknya.
#: Jadi warna dipakai untuk KEBIJAKAN, gaya garis untuk PENAKSIR.
GAYA_PENAKSIR = {"logistik": "-", "bart": "--", "pohon": "-."}


def _warna_kebijakan(nama: str) -> str:
    kebijakan = nama.split("+", 1)[1] if "+" in nama else nama
    return _warna(kebijakan)


def _gaya_penaksir(nama: str) -> str:
    penaksir = nama.split("+", 1)[0] if "+" in nama else nama
    for kunci, g in GAYA_PENAKSIR.items():
        if kunci in penaksir:
            return g
    return "-"


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
    from .mesin1.dasar import holt_winters

    deret = muat_deret()
    if not deret:
        return None
    d = next((x for x in deret if x.barang_id == barang_id), deret[0])

    cakrawala = 30
    akhir = len(d) - cakrawala
    # Model produksi sejak 10 Okt 2026 adalah ETS, jadi kipasnya juga ETS.
    r = holt_winters(d, akhir, cakrawala)

    ekor = 60
    t_lalu = np.arange(-ekor, 0)
    t_depan = np.arange(0, cakrawala)
    lalu = d.terisi[akhir - ekor : akhir]
    asli = d.nilai[akhir : akhir + cakrawala]

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(t_lalu, lalu, color="#374151", lw=1.2, label="riwayat")
    w = WARNA["holt_winters"]
    ax.fill_between(t_depan, r[0.1], r[0.9], color=w, alpha=0.18, label="p10-p90")
    ax.plot(t_depan, r[0.5], color=w, lw=1.8, label="p50 (perkiraan)")
    ax.plot(t_depan, r[0.9], color=w, lw=1.0, ls="--", label="p90 (dasar batas aman)")
    ax.plot(t_depan, asli, color="#dc2626", lw=1.4, marker="o", ms=2.5, label="permintaan sebenarnya")
    ax.axvline(0, color="#9ca3af", lw=0.8)
    ax.set_xlabel("hari (0 = titik perkiraan dibuat)")
    ax.set_ylabel("permintaan (%s)" % d.satuan if hasattr(d, "satuan") else "permintaan")
    ax.set_title("Mesin 1 — ETS (Holt-Winters): %s" % d.nama)
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


def _pita_lewis(ax, batas_atas: float) -> None:
    """Pita latar skala Lewis (1982) dan garis sasaran 5% dari dosen."""
    for bawah, atas, label, w in (
        (0, 10, "sangat akurat", "#dcfce7"),
        (10, 20, "baik", "#ecfccb"),
        (20, 50, "layak", "#fef9c3"),
        (50, max(batas_atas, 60), "tidak akurat", "#fee2e2"),
    ):
        if bawah >= batas_atas:
            continue
        ax.axvspan(bawah, min(atas, batas_atas), color=w, zorder=0)
        ax.text((bawah + min(atas, batas_atas)) / 2, 1.01, label, transform=ax.get_xaxis_transform(),
                ha="center", va="bottom", fontsize=7, color="#4b5563")
    ax.axvline(5, color="#dc2626", lw=1.2, ls="--", zorder=4)
    ax.text(5, -0.06, "sasaran 5%", transform=ax.get_xaxis_transform(), color="#dc2626",
            fontsize=7, ha="center", va="top")


def mape_mesin1(berkas: str = "hasil_mesin1_pekanan.json") -> Path | None:
    """
    MAPE per barang di tiga tingkat: harian, pekanan semua barang, pekanan
    barang yang lolos saringan. Latarnya pita skala Lewis, garis merahnya
    sasaran 5% dari dosen — supaya jaraknya terlihat, bukan disembunyikan.
    """
    p = KELUARAN / berkas
    if not p.exists():
        return None
    data = sorted(json.load(p.open(encoding="utf-8"))["hasil"], key=lambda x: x["mape_pekanan_lolos"])
    nama = [d["nama"] for d in data]
    y = np.arange(len(nama))
    tinggi = 0.26
    fig, ax = plt.subplots(figsize=(10, 4.6))
    batas = max(d["mape_harian"] for d in data) * 1.15
    _pita_lewis(ax, batas)
    for geser, kunci, label, alfa in (
        (-tinggi, "mape_harian", "harian", 0.35),
        (0, "mape_pekanan", "pekanan, semua barang", 0.65),
        (tinggi, "mape_pekanan_lolos", "pekanan, barang lolos saringan", 1.0),
    ):
        nilai = [d[kunci] for d in data]
        ax.barh(y + geser, nilai, height=tinggi, color=[_warna(n) for n in nama], alpha=alfa,
                label=label, zorder=3, edgecolor="white")
        for i, v in enumerate(nilai):
            ax.text(v, i + geser, " %.1f%%" % v, va="center", fontsize=7, zorder=5)
    ax.set_yticks(y, nama)
    ax.invert_yaxis()
    ax.set_xlim(0, batas)
    ax.set_xlabel("MAPE (%), kecil lebih baik")
    from matplotlib.patches import Patch

    # Legenda abu-abu: warna batang menandai metode, kepekatannya menandai tingkat.
    ax.legend(
        handles=[Patch(color="#374151", alpha=a, label=t) for a, t in (
            (0.35, "harian"), (0.65, "pekanan, semua barang"), (1.0, "pekanan, barang lolos saringan"))],
        frameon=False, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.16), ncol=3,
    )
    ax.set_title("Mesin 1 — MAPE ramalan unit per barang, 8 pekan bergulir", pad=16)
    return _simpan(fig, "mesin1_mape.png")


def mape_omset(berkas: str = "hasil_mesin1_omset.json") -> Path | None:
    """MAPE pekanan omset per metode, satu panel per sumber data."""
    p = KELUARAN / berkas
    if not p.exists():
        return None
    data = json.load(p.open(encoding="utf-8"))
    sumber = [(k, v) for k, v in data.items() if "hasil" in v]
    if not sumber:
        return None
    judul_sumber = {"simulasi": "Simulasi Warungku (70 UMKM)", "french_bakery": "French Bakery (toko roti nyata)"}

    fig, sumbu = plt.subplots(1, len(sumber), figsize=(5.4 * len(sumber), 3.8), squeeze=False)
    for ax, (k, v) in zip(sumbu[0], sumber):
        hasil = sorted(v["hasil"], key=lambda x: x["mape_pekanan"])
        nama = [h["nama"] for h in hasil]
        nilai = [h["mape_pekanan"] for h in hasil]
        batas = max(25.0, max(nilai) * 1.25)
        _pita_lewis(ax, batas)
        ax.barh(nama, nilai, color=[_warna(n) for n in nama], zorder=3)
        ax.invert_yaxis()
        for i, x in enumerate(nilai):
            ax.text(x, i, " %.1f%%" % x, va="center", fontsize=8, zorder=5)
        ax.set_xlim(0, batas)
        ax.set_xlabel("MAPE pekanan omset (%)")
        ax.set_title("%s\n%d pekan dinilai" % (judul_sumber.get(k, k), hasil[0]["n_pekan"]), fontsize=9, pad=16)
    fig.suptitle("Mesin 1 — ramalan omset 7 hari ke depan", y=1.04)
    fig.tight_layout()
    return _simpan(fig, "mesin1_omset.png")


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

    # Satu panel per sumbu percobaan. Sebelas garis dalam satu panel tidak
    # terbaca, dan tiap sumbu memang hanya mengubah satu hal: perbandingan yang
    # bermakna ada di dalam panel, bukan antarpanel.
    sumbu: dict[str, list] = {}
    for h in data["hasil"]:
        if h["kurva"]:
            sumbu.setdefault(h.get("sumbu", "semua"), []).append(h)
    n_hari = max((len(h["kurva"]) for h in data["hasil"]), default=0)
    palet = ["#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be185d"]

    fig, panel = plt.subplots(1, len(sumbu), figsize=(5.2 * len(sumbu), 4.6), sharey=True, squeeze=False)
    for ax, (nama_sumbu, isi) in zip(panel[0], sumbu.items()):
        for i, h in enumerate(sorted(isi, key=lambda x: x["regret_total"])):
            ax.plot(np.arange(len(h["kurva"])), h["kurva"], lw=1.6, color=palet[i % len(palet)],
                    label="%s (%s)" % (h["nama"], f"{h['regret_total']:,.0f}".replace(",", ".")))
        if n_hari:
            per_hari = acuan["keputusan"] / n_hari
            x = np.arange(n_hari)
            ax.plot(x, x * per_hari * acuan["termurah_regret"], lw=1.3, ls="--",
                    color=WARNA["termurah"], label="selalu termurah")
            ax.plot(x, x * per_hari * acuan["acak_regret"], lw=1.2, ls=":",
                    color=WARNA["acak"], label="memilih acak")
        ax.set_title(nama_sumbu.split(" (")[0], fontsize=10)
        ax.set_xlabel("hari simulasi")
        ax.legend(frameon=False, fontsize=7, loc="upper left")
    panel[0][0].set_ylabel("regret kumulatif (pesanan gagal yang bisa dihindari)")
    fig.suptitle("Mesin 2 — regret kumulatif: makin landai makin baik (angka = regret total)", y=1.02)
    fig.tight_layout()
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
    ax.barh(nama, nilai, color=[_warna_kebijakan(n) for n in nama])
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
def kompromi_mesin2(berkas: str = "hasil_simulasi_mesin2.json") -> Path | None:
    """
    Keandalan melawan harga: tiap kebijakan satu titik.

    Regret hanya mengukur keandalan, jadi kebijakan yang ikut menimbang harga
    (TOPSIS, fuzzy) pasti tampak kalah di kurva regret. Gambar ini menunjukkan
    apa yang mereka dapat sebagai gantinya. Titik yang lebih kanan-bawah
    daripada titik lain di kedua sumbu kalah mutlak; yang lain saling tukar.
    """
    p = KELUARAN / berkas
    if not p.exists():
        return None
    data = json.load(p.open(encoding="utf-8"))
    acuan = data["acuan"]
    if "harga_rata" not in data["hasil"][0]:
        return None

    fig, ax = plt.subplots(figsize=(9, 5))
    for h in data["hasil"]:
        ax.scatter(h["harga_rata"], h["sukses_rata"], s=46, color=_warna_kebijakan(h["nama"]),
                   marker="s" if "fuzzy" in h["nama"] or "topsis" in h["nama"] else "o", zorder=3)
        ax.annotate(h["nama"], (h["harga_rata"], h["sukses_rata"]), fontsize=7,
                    xytext=(5, 3), textcoords="offset points")
    for nama, x, y, w in (
        ("oracle", acuan["oracle_harga"], acuan["oracle_sukses"], WARNA["oracle"]),
        ("selalu termurah", acuan.get("termurah_harga", 1.0), acuan["termurah_sukses"], WARNA["termurah"]),
        ("memilih acak", acuan["acak_harga"], acuan["acak_sukses"], WARNA["acak"]),
    ):
        ax.scatter(x, y, s=70, marker="X", color=w, zorder=4)
        ax.annotate(nama, (x, y), fontsize=8, color=w, xytext=(5, -10), textcoords="offset points")
    ax.set_xlabel("rata-rata rasio harga terhadap kandidat termurah (kiri lebih murah)")
    ax.set_ylabel("rata-rata keberhasilan pesanan (atas lebih andal)")
    ax.set_title("Mesin 2 — keandalan melawan harga")
    return _simpan(fig, "mesin2_kompromi.png")


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
        ("MAPE Mesin 1", mape_mesin1),
        ("MAPE omset", mape_omset),
        ("kurva regret", kurva_regret),
        ("banding Mesin 2", banding_mesin2),
        ("kompromi Mesin 2", kompromi_mesin2),
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
