"""
Bangkitkan logo promo per kategori barang untuk frontend.

    python tools/buat_logo_promo.py

Revisi V4 (Q92): dulu kartu promo hanya punya tiga ikon, satu per jenis promo,
sehingga tiga promo Cuci Gudang tampak kembar. Kini ada delapan glyph, satu per
kelompok barang, dan frontend menggambarnya di ubin berwarna jenis promo
(`LogoPromo` di `frontend/src/components/domain/KartuPromo.tsx`). Keluaran:

* `frontend/src/data/glyphPromo.ts` — path SVG tiap glyph, dipakai `GlyphPromo`.
* `docs/desain/logo-promo/<kunci>.svg` — master hitam tiap glyph, untuk laporan
  dan alat desain.

Aturan gambar (skill logo-design): kanvas 256 x 256, isian padat satu warna,
ruang negatif lewat `evenodd`, sudut garis lurus di kelipatan 15 derajat, dan
celah paling sempit 14-16 unit supaya masih terlihat saat glyph selebar 24 px.
Geometrinya dihitung, bukan digambar tangan, jadi hasilnya sama di komputer
siapa pun.
"""

from __future__ import annotations

import math
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
DATA_TS = AKAR / "frontend" / "src" / "data" / "glyphPromo.ts"
KELUAR_SVG = AKAR / "docs" / "desain" / "logo-promo"

Titik = tuple[float, float]


def f(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def pt(p: Titik) -> str:
    return f"{f(p[0])} {f(p[1])}"


def putar(p: Titik, derajat: float, pusat: Titik = (128, 128)) -> Titik:
    a = math.radians(derajat)
    x, y = p[0] - pusat[0], p[1] - pusat[1]
    return (pusat[0] + x * math.cos(a) - y * math.sin(a), pusat[1] + x * math.sin(a) + y * math.cos(a))


def lensa(a: Titik, b: Titik, lebar: float) -> str:
    """Lensa (dua busur lingkaran) dari a ke b, lebar paling besar `lebar`, searah jarum jam."""
    panjang = math.dist(a, b)
    s = lebar / 2
    r = (panjang * panjang / 4 + s * s) / (2 * s)
    return f"M{pt(a)} A{f(r)} {f(r)} 0 0 1 {pt(b)} A{f(r)} {f(r)} 0 0 1 {pt(a)} Z"


def poligon_bulat(titik: list[Titik], r: float) -> str:
    """Poligon bersudut bulat berjari-jari r; urutan titik searah jarum jam di layar."""
    n = len(titik)
    sudut = []
    for i in range(n):
        p0, p1, p2 = titik[i - 1], titik[i], titik[(i + 1) % n]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1 = (v1[0] / l1, v1[1] / l1)
        u2 = (v2[0] / l2, v2[1] / l2)
        besar = math.acos(max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1])))
        t = min(r / math.tan(besar / 2), l1 / 2, l2 / 2)
        rr = t * math.tan(besar / 2)
        a = (p1[0] + u1[0] * t, p1[1] + u1[1] * t)
        b = (p1[0] + u2[0] * t, p1[1] + u2[1] * t)
        sapuan = 0 if u1[0] * u2[1] - u1[1] * u2[0] > 0 else 1
        sudut.append((a, b, rr, sapuan))
    d = f"M{pt(sudut[0][1])}"
    for i in range(1, n + 1):
        a, b, rr, sapuan = sudut[i % n]
        if math.dist(sudut[i - 1][1], a) > 0.01:
            d += f" L{pt(a)}"
        d += f" A{f(rr)} {f(rr)} 0 0 {sapuan} {pt(b)}"
    return d + " Z"


def kotak_bulat(x: float, y: float, w: float, h: float, r: float) -> str:
    return poligon_bulat([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], r)


def elips(pusat: Titik, rx: float, ry: float, derajat: float) -> str:
    atas = putar((pusat[0], pusat[1] - ry), derajat, pusat)
    bawah = putar((pusat[0], pusat[1] + ry), derajat, pusat)
    return (
        f"M{pt(atas)} A{f(rx)} {f(ry)} {f(derajat)} 1 1 {pt(bawah)} "
        f"A{f(rx)} {f(ry)} {f(derajat)} 1 1 {pt(atas)} Z"
    )


def lingkaran(pusat: Titik, r: float) -> str:
    kiri, kanan = (pusat[0] - r, pusat[1]), (pusat[0] + r, pusat[1])
    return f"M{pt(kiri)} A{f(r)} {f(r)} 0 1 1 {pt(kanan)} A{f(r)} {f(r)} 0 1 1 {pt(kiri)} Z"


def tetes(ujung: Titik, pusat: Titik, r: float) -> str:
    """Tetes: ujung runcing, sisi lurus yang menyinggung lingkaran bawah (pusat, r)."""
    jarak = math.dist(ujung, pusat)
    alfa = math.asin(r / jarak)
    singgung = math.sqrt(jarak * jarak - r * r)
    ux, uy = (pusat[0] - ujung[0]) / jarak, (pusat[1] - ujung[1]) / jarak

    def belok(sudut: float) -> Titik:
        return (
            ujung[0] + (ux * math.cos(sudut) - uy * math.sin(sudut)) * singgung,
            ujung[1] + (ux * math.sin(sudut) + uy * math.cos(sudut)) * singgung,
        )

    return f"M{pt(ujung)} L{pt(belok(-alfa))} A{f(r)} {f(r)} 0 1 1 {pt(belok(alfa))} Z"


# ---------------------------------------------------------------- glyph


def kopi() -> str:
    """Biji kopi miring 30 derajat dengan celah S di dalamnya."""
    pusat = (128, 130)
    lebar_celah = 15
    lokal = [
        (0, -84),
        (-30 - lebar_celah, -30), (30 - lebar_celah, 30), (0, 84),
        (30 + lebar_celah, 30), (-30 + lebar_celah, -30), (0, -84),
    ]
    g = [putar((pusat[0] + x, pusat[1] + y), 30, pusat) for x, y in lokal]
    celah = f"M{pt(g[0])} C{pt(g[1])} {pt(g[2])} {pt(g[3])} C{pt(g[4])} {pt(g[5])} {pt(g[6])} Z"
    return elips(pusat, 70, 102, 30) + " " + celah


def daun(pangkal: Titik, dari_tegak: float, panjang: float, lebar: float) -> str:
    a = math.radians(dari_tegak)
    return lensa(pangkal, (pangkal[0] + math.sin(a) * panjang, pangkal[1] - math.cos(a) * panjang), lebar)


def teh() -> str:
    """Pucuk teh: satu kuncup dan dua daun yang tumbuh berselang dari satu tangkai."""
    return " ".join([
        kotak_bulat(121, 118, 14, 108, 7),
        lensa((128, 28), (128, 128), 40),
        daun((124, 186), -56, 100, 44),
        daun((132, 160), 56, 100, 44),
    ])


# Kotak susu tampak samping: atap pelana 45 derajat dengan sirip tegak di puncaknya.
KOTAK_SUSU: list[Titik] = [(60, 228), (60, 104), (116, 48), (116, 26), (140, 26), (140, 48), (196, 104), (196, 228)]


def susu() -> str:
    """Kotak susu dengan label tetes (sisi tetesnya 30 derajat dari tegak)."""
    return poligon_bulat(KOTAK_SUSU, 9) + " " + tetes((128, 136), (128, 188), 26)


def permen(cx: float, cy: float, r: float, leher: float, luar: float, tinggi: float, sudut: float = -30) -> str:
    """Permen berbungkus: bulatan di tengah dan dua ujung bungkus yang dipisah celah pilinan."""
    kanan = [(cx + leher, cy - tinggi * 0.28), (cx + luar, cy - tinggi), (cx + luar, cy + tinggi),
             (cx + leher, cy + tinggi * 0.28)]
    kiri = [(cx - leher, cy + tinggi * 0.28), (cx - luar, cy + tinggi), (cx - luar, cy - tinggi),
            (cx - leher, cy - tinggi * 0.28)]
    bungkus = [poligon_bulat([putar(p, sudut, (cx, cy)) for p in poli], 8) for poli in (kanan, kiri)]
    return " ".join([lingkaran((cx, cy), r), *bungkus])


def pemanis() -> str:
    return permen(128, 128, 46, 60, 91.7, 44)


def kemasan() -> str:
    """Gelas bawa pulang bertutup kubah, dengan sedotan miring 15 derajat."""
    badan = poligon_bulat([(74, 122), (182, 122), (168, 228), (88, 228)], 10)
    bibir = kotak_bulat(62, 96, 132, 18, 8)
    kubah = "M84 96 A44 38 0 0 1 172 96 Z"
    p0, sudut, tebal = (132.0, 66.0), math.radians(75), 8
    p1 = (p0[0] + 36 * math.cos(sudut), p0[1] - 36 * math.sin(sudut))
    nx, ny = math.sin(sudut) * tebal, math.cos(sudut) * tebal
    sedotan = (
        f"M{pt((p0[0] - nx, p0[1] - ny))} L{pt((p1[0] - nx, p1[1] - ny))} "
        f"A{tebal} {tebal} 0 0 1 {pt((p1[0] + nx, p1[1] + ny))} L{pt((p0[0] + nx, p0[1] + ny))} Z"
    )
    return " ".join([badan, bibir, kubah, sedotan])


def bahan() -> str:
    """Mangkuk nasi. Gundukannya bergelombang tiga supaya tidak terbaca sebagai tutup panci."""
    nasi = "M62 104 A32 32 0 0 1 98 62 A34 34 0 0 1 158 62 A32 32 0 0 1 194 104 Z"
    mangkuk = "M40 120 H216 A88 76 0 0 1 40 120 Z"
    return " ".join([nasi, mangkuk, kotak_bulat(98, 186, 60, 24, 8)])


def pendukung() -> str:
    """Tetes air berisi es batu (kotak miring 15 derajat)."""
    pusat, s = (128, 162), 30
    es = [putar(p, 15, pusat) for p in [
        (pusat[0] - s, pusat[1] - s), (pusat[0] + s, pusat[1] - s),
        (pusat[0] + s, pusat[1] + s), (pusat[0] - s, pusat[1] + s)]]
    return tetes((128, 28), (128, 156), 72) + " " + poligon_bulat(es, 10)


def campuran() -> str:
    """Empat siluet mini dari set ini (biji kopi, daun teh, kotak susu, tetes air) dalam kisi 2 x 2."""
    def mini_daun(cx: float, cy: float) -> str:
        return lensa(putar((cx, cy - 46), 35, (cx, cy)), putar((cx, cy + 46), 35, (cx, cy)), 50)

    def mini_susu(cx: float, cy: float, k: float = 0.42) -> str:
        return poligon_bulat([(cx + (x - 128) * k, cy + (y - 127) * k) for x, y in KOTAK_SUSU], 5)

    return " ".join([
        elips((79, 76), 30, 44, 30),
        mini_daun(179, 76),
        mini_susu(79, 178),
        tetes((179, 132), (179, 190), 32),
    ])


# kunci: (nama di laporan, isi kelompok, fungsi gambar, pakai evenodd)
GLYPH = {
    "kopi": ("Kopi", "Biji kopi miring dengan celah S.", kopi, True),
    "teh": ("Teh & Matcha", "Pucuk teh: satu kuncup dan dua daun.", teh, False),
    "susu": ("Susu & Olahan", "Kotak susu tampak samping dengan label tetes.", susu, True),
    "pemanis": ("Pemanis", "Permen berbungkus.", pemanis, False),
    "kemasan": ("Kemasan", "Gelas bawa pulang bertutup kubah dan bersedotan.", kemasan, False),
    "bahan": ("Bahan Makanan", "Mangkuk nasi.", bahan, False),
    "pendukung": ("Pendukung", "Tetes air berisi es batu.", pendukung, True),
    "campuran": ("Campuran", "Biji kopi, daun teh, kotak susu, dan tetes air dalam kisi 2 x 2.", campuran, False),
}


def main() -> None:
    KELUAR_SVG.mkdir(parents=True, exist_ok=True)
    baris = [
        "/**",
        " * Glyph logo promo per kategori barang (revisi V4, Q92), kanvas 256 x 256.",
        " *",
        " * JANGAN DIUBAH TANGAN: ditulis oleh `tools/buat_logo_promo.py`.",
        " */",
        "",
        f"export type KategoriLogo = {' | '.join(repr(k) for k in GLYPH)}",
        "",
        "export const GLYPH_PROMO: Record<KategoriLogo, { d: string; ganjil?: true }> = {",
    ]
    for kunci, (nama, keterangan, gambar, ganjil) in GLYPH.items():
        d = gambar()
        baris.append(f"  /** {nama}: {keterangan[0].lower()}{keterangan[1:]} */")
        baris.append(f"  {kunci}: {{")
        if ganjil:
            baris.append("    ganjil: true,")
        baris.append(f"    d: '{d}',")
        baris.append("  },")
        aturan = ' fill-rule="evenodd"' if ganjil else ""
        (KELUAR_SVG / f"{kunci}.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
            f"<title>Logo promo {nama}</title>"
            f'<path fill="#111111"{aturan} d="{d}"/></svg>\n',
            encoding="utf-8",
        )
    baris.append("}")
    DATA_TS.write_text("\n".join(baris) + "\n", encoding="utf-8")
    print(f"{len(GLYPH)} glyph -> {DATA_TS.relative_to(AKAR)} dan {KELUAR_SVG.relative_to(AKAR)}")


if __name__ == "__main__":
    main()
