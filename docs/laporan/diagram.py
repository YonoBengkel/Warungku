"""
Diagram untuk laporan progres: arsitektur, alur data, ERD, dan Gantt.

    python docs/laporan/diagram.py

Tiap diagram ditulis sebagai HTML (SVG atau grid), lalu dirender menjadi PNG
oleh `tools/tangkap_layar.mjs` (Chrome headless). Hasilnya di
`docs/laporan/gambar/dosen/`.

ERD dibaca dari metadata SQLModel, bukan diketik ulang: kalau skema berubah,
diagramnya ikut berubah saat skrip ini dijalankan lagi.
"""

from __future__ import annotations

import collections
import json
import subprocess
import sys
import tempfile
from html import escape
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
KELUAR = AKAR / "docs" / "laporan" / "gambar" / "dosen"

UNGU = "#5b3fc4"
UNGU_MUDA = "#efeafd"
ORANYE = "#d9572b"
ORANYE_MUDA = "#fdeee7"
ABU = "#94a3b8"
TINTA = "#1f2937"
TINTA_2 = "#4b5563"
GARIS = "#cbd5e1"
HURUF = "'Segoe UI', Arial, sans-serif"

GAYA = f"""
<style>
  html, body {{ margin: 0; background: #ffffff; font-family: {HURUF}; color: {TINTA}; }}
  .judul {{ font-size: 26px; font-weight: 700; margin: 0 0 4px; }}
  .sub {{ font-size: 16px; color: {TINTA_2}; margin: 0 0 18px; }}
</style>
"""


# --------------------------------------------------------------------------
# 1. Arsitektur
# --------------------------------------------------------------------------
def _kotak(x, y, w, h, judul, baris, warna=UNGU, latar=UNGU_MUDA, garis_putus=False):
    dash = ' stroke-dasharray="8 6"' if garis_putus else ""
    teks = [f'<text x="{x + 18}" y="{y + 34}" font-size="21" font-weight="700" fill="{warna}">{escape(judul)}</text>']
    for i, b in enumerate(baris):
        teks.append(f'<text x="{x + 18}" y="{y + 64 + i * 25}" font-size="17" fill="{TINTA}">{escape(b)}</text>')
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{latar}" stroke="{warna}" '
            f'stroke-width="2"{dash}/>' + "".join(teks))


def _panah(x1, y1, x2, y2, label="", putus=False, warna=TINTA_2, lx=None, ly=None, anchor="middle"):
    dash = ' stroke-dasharray="8 6"' if putus else ""
    s = (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{warna}" stroke-width="2.4"{dash} '
         f'marker-end="url(#ujung)"/>')
    if label:
        lx = (x1 + x2) / 2 if lx is None else lx
        ly = (y1 + y2) / 2 - 10 if ly is None else ly
        s += (f'<text x="{lx}" y="{ly}" font-size="16" fill="{TINTA_2}" text-anchor="{anchor}" '
              f'paint-order="stroke" stroke="#ffffff" stroke-width="6">{escape(label)}</text>')
    return s


def html_arsitektur() -> str:
    b = []
    # Empat kolom: pengguna/kasir, frontend/dataset, API/basis data, layanan model.
    xa, xb, xc, xd = 40, 470, 1000, 1500
    b.append(_kotak(xa, 70, 300, 120, "Pengguna", ["Pemilik usaha (HP)", "Distributor (desktop)"], TINTA_2, "#f8fafc"))
    b.append(_kotak(xa, 380, 300, 120, "Aplikasi kasir (POS)", ["Sumber nota penjualan", "di warung"], TINTA_2, "#f8fafc"))
    b.append(_kotak(xb, 50, 360, 170, "frontend/  ·  port 5173", ["React 19 + Vite + TypeScript", "Portal pemilik usaha", "Portal distributor"]))
    b.append(_kotak(xc, 40, 360, 200, "backend/  ·  API port 8000", ["FastAPI + SQLModel", "Otentikasi: dua pintu, dua token", "Gudang, nota kasir, pesanan", "Hanya MEMBACA hasil model"]))
    b.append(_kotak(xc, 380, 360, 160, "PostgreSQL 16  ·  port 5433", ["32 tabel dalam 6 lapis", "Buku besar pergerakan stok", "Hasil ketiga mesin"], TINTA, "#f1f5f9"))
    b.append(_kotak(xd, 300, 380, 280, "ml/  ·  layanan model, port 8001", ["Penjadwal: 02.00 dan tiap 4 jam", "Mesin 1: SARIMA (ramalan)", "Mesin 2: Beta-Thompson + fuzzy", "Mesin 3: K-Prototypes (profil)", "", "MENULIS hasil ke tabel"], ORANYE, ORANYE_MUDA))
    b.append(_kotak(xb, 650, 360, 130, "data/  ·  dataset simulasi", ["70 UMKM, 8 distributor, 400 hari", "Kalender SKB 3 Menteri"], TINTA_2, "#f8fafc"))
    b.append(_kotak(xd, 690, 380, 110, "Data nyata pihak luar", ["French Bakery (toko roti)", "untuk validasi metode"], TINTA_2, "#f8fafc", garis_putus=True))
    b.append(_panah(xa + 300, 130, xb - 2, 130, "memakai", ly=118))
    b.append(_panah(xb + 360, 135, xc - 2, 135, "", putus=True, warna=ORANYE))
    b.append(f'<text x="{(xb + 360 + xc) / 2}" y="112" font-size="15" fill="{ORANYE}" text-anchor="middle">belum tersambung</text>'
             f'<text x="{(xb + 360 + xc) / 2}" y="164" font-size="15" fill="{ORANYE}" text-anchor="middle">(data contoh)</text>')
    b.append(_panah(xa + 300, 440, xc - 2, 225, "nota kasir (aman dikirim ulang)", lx=640, ly=318))
    b.append(_panah(xc + 180, 240, xc + 180, 378, "baca / tulis", lx=xc + 192, ly=315, anchor="start"))
    b.append(_panah(xd - 2, 420, xc + 362, 420, "tulis hasil", lx=(xc + 360 + xd) / 2, ly=408))
    b.append(_panah(xc + 360, 500, xd - 2, 500, "baca riwayat", lx=(xc + 360 + xd) / 2, ly=488))
    b.append(_panah(xb + 360, 700, xc + 60, 542, "mengisi", lx=xb + 470, ly=640))
    b.append(_panah(xd + 190, 688, xd + 190, 582, "validasi metode", putus=True, lx=xd + 202, ly=645, anchor="start"))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1900" height="820" viewBox="0 0 1900 820">'
           f'<defs><marker id="ujung" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
           f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{TINTA_2}"/></marker></defs>'
           + "".join(b) + "</svg>")
    return f"<!doctype html><meta charset='utf-8'>{GAYA}<body style='padding:24px 24px 12px'>{svg}</body>"


# --------------------------------------------------------------------------
# 2. Alur data
# --------------------------------------------------------------------------
LANGKAH = [
    ("Nota kasir masuk", "Aplikasi kasir mengirim nota; nota yang terkirim dua kali tetap dihitung sekali", TINTA_2),
    ("Stok berkurang", "Setiap barang yang terjual mengurangi stok dan dicatat di riwayat stok", TINTA_2),
    ("Permintaan harian", "Penjualan dijumlah per barang per hari; hari stok habis tidak dihitung sebagai tidak laku", TINTA_2),
    ("Mesin 1: ramalan 30 hari", "SARIMA memberi p10, p50, dan p90 per barang, diperbarui setiap malam", ORANYE),
    ("Batas aman", "p90 selama lead time pengiriman; stok di bawahnya berstatus menipis", TINTA_2),
    ("Mesin 2: ke distributor mana", "Keandalan tiap distributor (Beta-Bernoulli) ditimbang dengan harganya (fuzzy)", ORANYE),
    ("Pesanan ke distributor", "Pesanan yang sama terlihat oleh pemilik usaha dan distributor", TINTA_2),
    ("Barang diterima", "Tepat waktu? Jumlah sesuai? Kondisi baik? Jawabannya memperbarui catatan keandalan distributor", TINTA_2),
    ("Mesin 3: profil pelanggan", "Dari sisi distributor: pelanggan andalan, rutin, baru, atau mulai menjauh", ORANYE),
]


def html_alur() -> str:
    w, h, jarak, x0 = 900, 96, 34, 70
    tinggi = len(LANGKAH) * (h + jarak) + 40
    b = []
    for i, (judul, isi, warna) in enumerate(LANGKAH):
        y = 20 + i * (h + jarak)
        latar = ORANYE_MUDA if warna == ORANYE else "#f8fafc"
        b.append(f'<rect x="{x0}" y="{y}" width="{w}" height="{h}" rx="14" fill="{latar}" stroke="{warna}" stroke-width="2"/>')
        b.append(f'<circle cx="{x0 + 40}" cy="{y + h / 2}" r="20" fill="{warna}"/>'
                 f'<text x="{x0 + 40}" y="{y + h / 2 + 7}" font-size="19" font-weight="700" fill="#fff" text-anchor="middle">{i + 1}</text>')
        b.append(f'<text x="{x0 + 80}" y="{y + 40}" font-size="22" font-weight="700" fill="{TINTA}">{escape(judul)}</text>')
        b.append(f'<text x="{x0 + 80}" y="{y + 70}" font-size="16.5" fill="{TINTA_2}">{escape(isi)}</text>')
        if i < len(LANGKAH) - 1:
            yb = y + h
            b.append(f'<line x1="{x0 + w / 2}" y1="{yb}" x2="{x0 + w / 2}" y2="{yb + jarak - 2}" stroke="{TINTA_2}" '
                     f'stroke-width="2.4" marker-end="url(#ujung)"/>')
    # Umpan balik: barang diterima -> Mesin 2 (belajar), dan -> stok naik.
    y_terima = 20 + 7 * (h + jarak) + h / 2
    y_m2 = 20 + 5 * (h + jarak) + h / 2
    y_stok = 20 + 1 * (h + jarak) + h / 2
    xr = x0 + w
    b.append(f'<path d="M{xr},{y_terima} H{xr + 60} V{y_m2} H{xr + 4}" fill="none" stroke="{ORANYE}" stroke-width="2.4" '
             f'stroke-dasharray="8 6" marker-end="url(#ujung2)"/>')
    b.append(f'<text x="{xr + 70}" y="{(y_terima + y_m2) / 2}" font-size="15" fill="{ORANYE}">belajar</text>')
    b.append(f'<path d="M{x0},{y_terima} H{x0 - 40} V{y_stok} H{x0 - 4}" fill="none" stroke="{TINTA_2}" stroke-width="2.4" '
             f'stroke-dasharray="8 6" marker-end="url(#ujung)"/>')
    b.append(f'<text x="{x0 - 48}" y="{(y_terima + y_stok) / 2}" font-size="15" fill="{TINTA_2}" text-anchor="end" '
             f'transform="rotate(-90 {x0 - 48} {(y_terima + y_stok) / 2})">stok naik</text>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{x0 + w + 150}" height="{tinggi}" viewBox="0 0 {x0 + w + 150} {tinggi}">'
           f'<defs><marker id="ujung" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
           f'<path d="M0,0 L10,5 L0,10 z" fill="{TINTA_2}"/></marker>'
           f'<marker id="ujung2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">'
           f'<path d="M0,0 L10,5 L0,10 z" fill="{ORANYE}"/></marker></defs>' + "".join(b) + "</svg>")
    return f"<!doctype html><meta charset='utf-8'>{GAYA}<body style='padding:16px 24px'>{svg}</body>"


# --------------------------------------------------------------------------
# 3. ERD dari metadata SQLModel
# --------------------------------------------------------------------------
NAMA_LAPIS = {
    "inti": ("1 · Inti", "Pengguna, usaha, distributor, katalog bersama"),
    "gudang": ("2 · Gudang", "Barang, nota kasir, buku besar stok"),
    "niaga": ("3 · Niaga", "Penawaran, kontrak, promo, pesanan, ulasan"),
    "analitik": ("4 · Analitik", "Ditulis layanan model, dibaca API"),
    "segmen": ("5 · Segmen", "Keluaran Mesin 3"),
    "referensi": ("6 · Referensi", "Kalender SKB 3 Menteri"),
}


def data_erd() -> dict[str, list[tuple[str, int, list[str]]]]:
    for sub in ("backend", "data", ""):
        p = str(AKAR / sub)
        if p not in sys.path:
            sys.path.insert(0, p)
    import warungku.model as M  # noqa: F401  (mendaftarkan semua tabel)
    from sqlmodel import SQLModel

    asal = {}
    for obj in vars(M).values():
        t = getattr(obj, "__tablename__", None)
        if isinstance(t, str):
            asal[t] = obj.__module__.split(".")[-1]
    lapis = collections.OrderedDict((k, []) for k in NAMA_LAPIS)
    for t in SQLModel.metadata.sorted_tables:
        fk = sorted({f.column.table.name for f in t.foreign_keys if f.column.table.name != t.name})
        lapis.setdefault(asal.get(t.name, "lain"), []).append((t.name, len(t.columns), fk))
    return lapis


def html_erd() -> str:
    lapis = data_erd()
    total = sum(len(v) for v in lapis.values())
    kartu = []
    for kunci, tabel in lapis.items():
        if not tabel:
            continue
        nama, ket = NAMA_LAPIS.get(kunci, (kunci, ""))
        analitik = kunci in ("analitik", "segmen")
        warna = ORANYE if analitik else UNGU
        latar = ORANYE_MUDA if analitik else UNGU_MUDA
        baris = "".join(
            f"<div class='t'><div><b>{escape(n)}</b> <span class='k'>{c} kolom</span></div>"
            + (f"<div class='r'>→ {escape(', '.join(f))}</div>" if f else "<div class='r'>&nbsp;</div>")
            + "</div>"
            for n, c, f in tabel
        )
        kartu.append(
            f"<div class='kartu' style='border-color:{warna}'><div class='kepala' style='background:{latar};color:{warna}'>"
            f"<div class='nl'>{escape(nama)}</div><div class='kl'>{escape(ket)}</div></div>{baris}</div>"
        )
    gaya = f"""<style>
      .grid {{ display:grid; grid-template-columns: repeat(3, 1fr); gap:18px; align-items:start; }}
      .kartu {{ border:2px solid; border-radius:14px; overflow:hidden; background:#fff; }}
      .kepala {{ padding:10px 14px; }}
      .nl {{ font-size:20px; font-weight:700; }} .kl {{ font-size:14px; color:{TINTA_2}; }}
      .t {{ padding:6px 14px; border-top:1px solid #e5e7eb; font-size:15.5px; }}
      .k {{ color:{TINTA_2}; font-size:13px; }} .r {{ color:{TINTA_2}; font-size:13.5px; }}
    </style>"""
    return (f"<!doctype html><meta charset='utf-8'>{GAYA}{gaya}<body style='padding:24px;width:1600px'>"
            f"<p class='judul'>Skema basis data: {total} tabel dalam {sum(1 for v in lapis.values() if v)} lapis</p>"
            f"<p class='sub'>Panah menunjuk tabel yang dirujuk lewat foreign key. Oranye: tabel yang hanya ditulis layanan model.</p>"
            f"<div class='grid'>{''.join(kartu)}</div></body>")


# --------------------------------------------------------------------------
# 4. Gantt
# --------------------------------------------------------------------------
#: (kegiatan, penanggung jawab, status, minggu mulai, minggu selesai). Minggu 0 =
#: pekan 1 September 2026; empat minggu per bulan, sampai Januari 2027 (minggu 19).
#: Status per 12 Okt 2026. Jadwal kegiatan berstatus Rencana adalah usulan yang
#: masih perlu disepakati tim.
KEGIATAN = [
    ("Riset kebutuhan dan studi lapangan UMKM", "Analis", "Selesai", 0, 1),
    ("Analisis proses bisnis dan pemodelan data", "Analis", "Selesai", 1, 2),
    ("Antarmuka pemilik usaha", "Frontend", "Selesai", 1, 2),
    ("Portal distributor dan revisi antarmuka", "Frontend", "Selesai", 2, 4),
    ("Dokumen proses bisnis", "Tim", "Selesai", 2, 3),
    ("Skema basis data dan kontrak API", "Backend", "Selesai", 4, 4),
    ("Dataset simulasi dan data nyata", "Data", "Selesai", 4, 5),
    ("Mesin 1, 2, 3 dan evaluasinya", "Data", "Selesai", 4, 5),
    ("Rebrand Turnify Flow dan susun ulang repo", "Tim", "Berjalan", 5, 5),
    ("Laporan progres teknis", "Tim", "Berjalan", 5, 6),
    ("Perbaikan dataset dan hitung ulang model", "Data", "Rencana", 6, 7),
    ("Sambung portal ke API dan aksi distributor", "Frontend/Backend", "Rencana", 6, 10),
    ("Konektor kasir (impor nota) dan portal admin", "Backend", "Rencana", 9, 12),
    ("Uji coba terbatas dengan UMKM mitra", "Tim", "Rencana", 11, 14),
    ("Perbaikan dari hasil uji coba", "Tim", "Rencana", 13, 16),
    ("Laporan dan presentasi akhir", "Tim", "Rencana", 16, 19),
]
BULAN = ["September 2026", "Oktober 2026", "November 2026", "Desember 2026", "Januari 2027"]
WARNA_STATUS = {"Selesai": UNGU, "Berjalan": ORANYE, "Rencana": ABU}
#: 12 Okt 2026 jatuh di pekan kedua Oktober (minggu 5), sekitar sepertiganya.
HARI_INI = 5 + 0.6


def html_gantt() -> str:
    kiri, kol_pj, kol_st, lebar_m, tinggi_b, atas = 470, 190, 100, 46, 46, 110
    x0 = kiri + kol_pj + kol_st
    lebar = x0 + 20 * lebar_m + 30
    tinggi = atas + len(KEGIATAN) * tinggi_b + 90
    b = []
    for i, nama in enumerate(BULAN):
        x = x0 + i * 4 * lebar_m
        b.append(f'<rect x="{x}" y="20" width="{4 * lebar_m}" height="40" fill="{"#eef2f7" if i % 2 == 0 else "#f8fafc"}"/>'
                 f'<text x="{x + 2 * lebar_m}" y="47" font-size="17" font-weight="700" text-anchor="middle">{nama}</text>')
        for m in range(4):
            xm = x + m * lebar_m
            b.append(f'<text x="{xm + lebar_m / 2}" y="84" font-size="14" fill="{TINTA_2}" text-anchor="middle">M{m + 1}</text>')
            b.append(f'<line x1="{xm}" y1="96" x2="{xm}" y2="{atas + len(KEGIATAN) * tinggi_b}" stroke="#e5e7eb"/>')
    b.append(f'<text x="24" y="84" font-size="16" font-weight="700">Kegiatan</text>'
             f'<text x="{kiri}" y="84" font-size="16" font-weight="700">Penanggung jawab</text>'
             f'<text x="{kiri + kol_pj}" y="84" font-size="16" font-weight="700">Status</text>')
    for i, (nama, pj, st, a, z) in enumerate(KEGIATAN):
        y = atas + i * tinggi_b
        if i % 2 == 0:
            b.append(f'<rect x="16" y="{y}" width="{lebar - 32}" height="{tinggi_b}" fill="#f8fafc"/>')
        w = WARNA_STATUS[st]
        b.append(f'<text x="24" y="{y + 29}" font-size="16">{i + 1}. {escape(nama)}</text>'
                 f'<text x="{kiri}" y="{y + 29}" font-size="15" fill="{TINTA_2}">{escape(pj)}</text>'
                 f'<text x="{kiri + kol_pj}" y="{y + 29}" font-size="15" font-weight="700" fill="{w if st != "Rencana" else TINTA_2}">{st}</text>')
        b.append(f'<rect x="{x0 + a * lebar_m + 3}" y="{y + 10}" width="{(z - a + 1) * lebar_m - 6}" height="{tinggi_b - 20}" rx="7" fill="{w}"/>')
    xh = x0 + HARI_INI * lebar_m
    yb = atas + len(KEGIATAN) * tinggi_b
    b.append(f'<line x1="{xh}" y1="66" x2="{xh}" y2="{yb + 8}" stroke="#c81e1e" stroke-width="2.4" stroke-dasharray="6 5"/>'
             f'<rect x="{xh - 62}" y="{yb + 10}" width="124" height="30" rx="15" fill="#c81e1e"/>'
             f'<text x="{xh}" y="{yb + 31}" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">12 Okt 2026</text>')
    for j, (st, w) in enumerate(WARNA_STATUS.items()):
        b.append(f'<rect x="{24 + j * 150}" y="{yb + 52}" width="34" height="16" rx="5" fill="{w}"/>'
                 f'<text x="{66 + j * 150}" y="{yb + 66}" font-size="15">{st}</text>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{lebar}" height="{tinggi}" viewBox="0 0 {lebar} {tinggi}">'
           + "".join(b) + "</svg>")
    return (f"<!doctype html><meta charset='utf-8'>{GAYA}<body style='padding:20px'>"
            f"<p class='judul'>Gantt chart Turnify Flow</p>"
            f"<p class='sub'>September 2026 sampai Januari 2027, per minggu. Status per 12 Oktober 2026; "
            f"jadwal kegiatan berstatus Rencana masih perlu disepakati tim.</p>{svg}</body>")


# --------------------------------------------------------------------------
def main() -> None:
    KELUAR.mkdir(parents=True, exist_ok=True)
    sementara = Path(tempfile.mkdtemp(prefix="diagram-"))
    halaman = {
        "arsitektur": (html_arsitektur(), 1950),
        "alur-data": (html_alur(), 1140),
        "erd": (html_erd(), 1650),
        "gantt": (html_gantt(), 470 + 190 + 100 + 20 * 46 + 100),
    }
    daftar = []
    for nama, (isi, lebar) in halaman.items():
        p = sementara / f"{nama}.html"
        p.write_text(isi, encoding="utf-8")
        daftar.append({"nama": nama, "url": p.as_uri(), "lebar": lebar, "tinggi": 600,
                       "penuh": True, "tunggu": 600, "skala": 2})
    berkas_daftar = sementara / "daftar.json"
    berkas_daftar.write_text(json.dumps(daftar), encoding="utf-8")
    subprocess.run(["node", str(AKAR / "tools" / "tangkap_layar.mjs"), str(berkas_daftar), str(KELUAR)], check=True)
    print("Diagram ditulis ke %s" % KELUAR)


if __name__ == "__main__":
    main()
