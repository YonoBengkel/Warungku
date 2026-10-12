"""
Laporan progres teknis untuk dosen pengampu (Word).

    python docs/laporan/diagram.py          # sekali, kalau diagram belum ada
    python docs/laporan/bangun_laporan_dosen.py

Urutan bagian mengikuti laporan PAD2 tim (proses bisnis dan UI/UX), digeser ke
sisi teknis dan keputusan di baliknya. Skema B2B/B2C dan tanggapan arahan dosen
sengaja tidak dimuat (keputusan Ilham, 12 Okt 2026).

Angka tidak diketik ulang: semuanya dibaca dari `ml/hasil/*.json` dan dari
basis data saat skrip dijalankan. Times New Roman 12, rata kiri-kanan.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AKAR = Path(__file__).resolve().parents[2]
HASIL = AKAR / "ml" / "hasil"
GAMBAR = AKAR / "docs" / "laporan" / "gambar"
ASET = AKAR / "docs" / "aset"
BERKAS = AKAR / "docs" / "laporan" / "Laporan-Progres-Turnify-Flow.docx"

HURUF = "Times New Roman"
HITAM = RGBColor(0, 0, 0)
JUDUL = "TURNIFY FLOW: SISTEM ANALITIKA RANTAI PASOK UNTUK UMKM SEBAGAI PENDAMPING APLIKASI KASIR"
TIM = [
    ("Kadek Savita Dyutianaya", "3324600033"),
    ("Ilham Bintang Satria", "3324600041"),
    ("Raja Rahman Aziiz", "3324600045"),
    ("Lailatul Maghfiroh", "3324600060"),
]
TANGGAL = "12 Oktober 2026"


# ==========================================================================
# Angka
# ==========================================================================
def _j(nama: str) -> dict:
    return json.loads((HASIL / nama).read_text(encoding="utf-8"))


def _jalur_paket() -> None:
    for sub in ("backend", "data", ""):
        p = str(AKAR / sub)
        if p not in sys.path:
            sys.path.insert(0, p)


def angka_db() -> dict:
    _jalur_paket()
    from sqlalchemy import text

    from warungku.basis_data import mesin

    tabel = ["usaha", "distributor", "barang", "penawaran", "transaksi", "transaksi_baris", "pergerakan",
             "pesanan", "pesanan_baris", "kontrak", "permintaan_harian", "fitur_pesanan", "prediksi",
             "rekomendasi_skor", "segmen_pelanggan"]
    with mesin().connect() as k:
        n = {t: int(k.execute(text(f"SELECT count(*) FROM {t}")).scalar()) for t in tabel}
        awal, akhir = k.execute(text("SELECT min(tanggal), max(tanggal) FROM permintaan_harian")).one()
        n["semua"] = int(k.execute(text(
            "SELECT sum(n_live_tup) FROM pg_stat_user_tables WHERE relname <> 'alembic_version'")).scalar() or 0)
        n["tabel"] = int(k.execute(text(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name <> 'alembic_version'")).scalar())
        n["stok_habis"] = float(k.execute(text("SELECT avg(stok_habis::int) FROM permintaan_harian")).scalar())
        n["segmen"] = dict(k.execute(text("SELECT nama_segmen, count(*) FROM segmen_pelanggan GROUP BY 1 ORDER BY 2 DESC")).all())
        n["prediksi_terakhir"] = dict(k.execute(text(
            "SELECT model_nama, count(DISTINCT barang_id) FROM prediksi WHERE jalan_id = "
            "(SELECT jalan_id FROM prediksi ORDER BY dijalankan_pada DESC LIMIT 1) GROUP BY 1")).all())
    n["awal"], n["akhir"] = awal, akhir
    return n


# ==========================================================================
# Format
# ==========================================================================
class Laporan:
    def __init__(self) -> None:
        self.d = Document()
        self.n_gambar = 0
        self.n_tabel = 0
        d = self.d
        g = d.styles["Normal"]
        g.font.name = HURUF
        g.font.size = Pt(12)
        g.element.rPr.rFonts.set(qn("w:eastAsia"), HURUF)
        pf = g.paragraph_format
        pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        pf.space_after = Pt(6)
        pf.line_spacing = 1.15
        for nama, ukuran in (("Heading 1", 13), ("Heading 2", 12), ("Heading 3", 12)):
            h = d.styles[nama]
            h.font.name = HURUF
            h.font.size = Pt(ukuran)
            h.font.bold = True
            h.font.italic = nama == "Heading 3"
            h.font.color.rgb = HITAM
            rf = h.element.rPr.rFonts
            # Gaya judul bawaan memakai huruf tema (Calibri Light); buang supaya TNR berlaku.
            for a in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
                rf.attrib.pop(qn(a), None)
            for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
                rf.set(qn(a), HURUF)
            h.paragraph_format.space_before = Pt(12 if nama == "Heading 1" else 8)
            h.paragraph_format.space_after = Pt(6)
            h.paragraph_format.keep_with_next = True
        for nama in ("List Bullet", "List Number"):
            d.styles[nama].font.name = HURUF
            d.styles[nama].font.size = Pt(12)
        for s in d.sections:
            s.page_height, s.page_width = Cm(29.7), Cm(21.0)
            s.top_margin = s.bottom_margin = Cm(2.5)
            s.left_margin = Cm(3.0)
            s.right_margin = Cm(2.5)

    def bagian_baru(self, mendatar: bool) -> None:
        """Mulai section baru di halaman baru, tegak atau mendatar (untuk diagram lebar)."""
        s = self.d.add_section(WD_SECTION.NEW_PAGE)
        s.different_first_page_header_footer = False
        lebar, tinggi = (Cm(29.7), Cm(21.0)) if mendatar else (Cm(21.0), Cm(29.7))
        s.orientation = WD_ORIENT.LANDSCAPE if mendatar else WD_ORIENT.PORTRAIT
        s.page_width, s.page_height = lebar, tinggi
        s.top_margin = s.bottom_margin = Cm(2.5)
        s.left_margin = Cm(3.0) if not mendatar else Cm(2.5)
        s.right_margin = Cm(2.5)

    # -- teks --------------------------------------------------------------
    def h1(self, teks: str, halaman_baru: bool = True) -> None:
        p = self.d.add_heading(teks, level=1)
        p.paragraph_format.page_break_before = halaman_baru

    def h2(self, teks: str) -> None:
        self.d.add_heading(teks, level=2)

    def h3(self, teks: str) -> None:
        self.d.add_heading(teks, level=3)

    def p(self, *bagian, rata: str = "justify", tebal: bool = False, ukuran: float = 12, setelah: float | None = None):
        """Alinea. `bagian` boleh teks biasa atau ('teks', 'b'/'i') untuk tebal/miring."""
        par = self.d.add_paragraph()
        par.alignment = {"justify": WD_ALIGN_PARAGRAPH.JUSTIFY, "tengah": WD_ALIGN_PARAGRAPH.CENTER,
                         "kiri": WD_ALIGN_PARAGRAPH.LEFT}[rata]
        if setelah is not None:
            par.paragraph_format.space_after = Pt(setelah)
        for b in bagian:
            t, gaya = (b, "") if isinstance(b, str) else b
            r = par.add_run(t)
            r.bold = tebal or "b" in gaya
            r.italic = "i" in gaya
            r.font.size = Pt(ukuran)
        return par

    def butir(self, *bagian, nomor: bool = False) -> None:
        par = self.d.add_paragraph(style="List Number" if nomor else "List Bullet")
        par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        par.paragraph_format.space_after = Pt(3)
        for b in bagian:
            t, gaya = (b, "") if isinstance(b, str) else b
            r = par.add_run(t)
            r.bold = "b" in gaya
            r.italic = "i" in gaya

    def kode(self, teks: str) -> None:
        for baris in teks.splitlines():
            par = self.d.add_paragraph()
            par.alignment = WD_ALIGN_PARAGRAPH.LEFT
            par.paragraph_format.left_indent = Cm(0.6)
            par.paragraph_format.space_after = Pt(0)
            par.paragraph_format.line_spacing = 1.0
            r = par.add_run(baris if baris else " ")
            r.font.name = "Consolas"
            r.font.size = Pt(9.5)
        self.d.add_paragraph().paragraph_format.space_after = Pt(2)

    # -- tabel & gambar ----------------------------------------------------
    def tabel(self, keterangan: str, kepala: list[str], isi: list[list], lebar: list[float]) -> None:
        self.n_tabel += 1
        k = self.p((f"Tabel {self.n_tabel}. ", "b"), keterangan, rata="tengah", ukuran=11, setelah=3)
        k.paragraph_format.keep_with_next = True
        t = self.d.add_table(rows=1, cols=len(kepala))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, teks in enumerate(kepala):
            self._sel(t.rows[0].cells[i], teks, tebal=True, latar="E7E3F7")
        for baris in isi:
            sel = t.add_row().cells
            for i, teks in enumerate(baris):
                self._sel(sel[i], str(teks))
        t.autofit = False
        for i, gc in enumerate(t._tbl.tblGrid.findall(qn("w:gridCol"))):
            gc.set(qn("w:w"), str(int(Cm(lebar[i]).emu / 635)))
        for i, w in enumerate(lebar):
            for row in t.rows:
                row.cells[i].width = Cm(w)
        # Tabel pendek jangan terpotong ke halaman berikutnya.
        for row in t.rows:
            trPr = row._tr.get_or_add_trPr()
            cs = OxmlElement("w:cantSplit")
            trPr.append(cs)
            if len(t.rows) <= 14 and row is not t.rows[-1]:
                for c in row.cells:
                    for par in c.paragraphs:
                        par.paragraph_format.keep_with_next = True
        # Baris kepala diulang di halaman berikutnya kalau tabelnya terpotong.
        trPr = t.rows[0]._tr.get_or_add_trPr()
        h = OxmlElement("w:tblHeader")
        h.set(qn("w:val"), "true")
        trPr.append(h)
        self.d.add_paragraph().paragraph_format.space_after = Pt(4)

    @staticmethod
    def _sel(sel, teks: str, tebal: bool = False, latar: str | None = None) -> None:
        sel.text = ""
        par = sel.paragraphs[0]
        par.alignment = WD_ALIGN_PARAGRAPH.LEFT
        par.paragraph_format.space_after = Pt(0)
        par.paragraph_format.line_spacing = 1.0
        r = par.add_run(teks)
        r.bold = tebal
        r.font.size = Pt(10.5)
        if latar:
            tcPr = sel._tc.get_or_add_tcPr()
            shd = OxmlElement("w:shd")
            shd.set(qn("w:val"), "clear")
            shd.set(qn("w:color"), "auto")
            shd.set(qn("w:fill"), latar)
            tcPr.append(shd)

    def gambar(self, berkas: Path, keterangan: str, lebar_cm: float = 15.5, tinggi_maks_cm: float = 20.0) -> None:
        if not berkas.exists():
            self.p(f"[gambar belum ada: {berkas.name}]", rata="tengah")
            return
        from PIL import Image

        w, h = Image.open(berkas).size
        lebar_cm = min(lebar_cm, tinggi_maks_cm * w / h)
        self.n_gambar += 1
        self.d.add_picture(str(berkas), width=Cm(lebar_cm))
        gp = self.d.paragraphs[-1]
        gp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        gp.paragraph_format.keep_with_next = True
        self.p((f"Gambar {self.n_gambar}. ", "b"), keterangan, rata="tengah", ukuran=10.5, setelah=10)

    def gambar_berjajar(self, berkas: list[Path], keterangan: str, lebar_cm: float = 5.0) -> None:
        self.n_gambar += 1
        t = self.d.add_table(rows=1, cols=len(berkas))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, b in enumerate(berkas):
            par = t.rows[0].cells[i].paragraphs[0]
            par.alignment = WD_ALIGN_PARAGRAPH.CENTER
            par.add_run().add_picture(str(b), width=Cm(lebar_cm))
        self.p((f"Gambar {self.n_gambar}. ", "b"), keterangan, rata="tengah", ukuran=10.5, setelah=10)

    def simpan(self) -> Path:
        self.d.save(BERKAS)
        return BERKAS


def _bidang(par, instr: str, teks_awal: str = "") -> None:
    """Sisipkan field Word (daftar isi, nomor halaman)."""
    def fc(jenis):
        e = OxmlElement("w:fldChar")
        e.set(qn("w:fldCharType"), jenis)
        return e
    r = par.add_run()
    r._r.append(fc("begin"))
    it = OxmlElement("w:instrText")
    it.set(qn("xml:space"), "preserve")
    it.text = instr
    r._r.append(it)
    r._r.append(fc("separate"))
    par.add_run(teks_awal)
    r2 = par.add_run()
    r2._r.append(fc("end"))


def _ak(x: float, n: int = 1) -> str:
    return ("%.*f" % (n, x)).replace(".", ",").replace("-", "−")


def _rb(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def _pr(x: float, n: int = 1) -> str:
    return _ak(x, n) + "%"


# ==========================================================================
# Grafik tambahan (Mesin 1)
# ==========================================================================
def grafik_mesin1() -> tuple[Path, Path]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    UNGU, ORANYE, ABU = "#5b3fc4", "#d9572b", "#9ca3af"
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False,
                         "axes.spines.right": False, "axes.edgecolor": "#9ca3af", "figure.dpi": 160,
                         "savefig.bbox": "tight"})
    out = GAMBAR / "dosen"
    out.mkdir(parents=True, exist_ok=True)

    t = _j("hasil_mesin1_turnamen.json")["uji"]["strategi"]
    nama = {"sarima_untuk_semua": "SARIMA (dipakai sekarang)", "lightgbm_untuk_semua": "LightGBM",
            "juara_per_kelompok": "Model terbaik per kelompok barang", "chronos_2_untuk_semua": "Chronos-2",
            "ets_untuk_semua": "ETS (model sebelumnya)", "naif_musiman_untuk_semua": "Naif musiman (pembanding dasar)"}
    urut = sorted(t, key=lambda k: t[k]["mape"])
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    for i, k in enumerate(urut):
        w = UNGU if k.startswith("sarima") else ORANYE if k.startswith("ets") else ABU
        ax.barh(i, t[k]["mape"], color=w, height=0.6)
        ax.text(t[k]["mape"] + 0.2, i, _pr(t[k]["mape"]), va="center", fontsize=9)
    ax.set_yticks(range(len(urut)))
    ax.set_yticklabels([nama.get(k, k) for k in urut])
    ax.invert_yaxis()
    ax.set_xlabel("Rata-rata meleset per pekan (%), ujian akhir 29 Sep–5 Okt 2026")
    ax.set_xlim(0, max(v["mape"] for v in t.values()) * 1.15)
    ax.grid(axis="x", color="#e5e7eb")
    ax.set_axisbelow(True)
    g1 = out / "mesin1_turnamen.png"
    fig.savefig(g1)
    plt.close(fig)

    o = _j("hasil_mesin1_turnamen_omset.json")
    nama_m = {"sarimax": "SARIMAX", "chronos_2_kalender": "Chronos-2 + kalender", "chronos_2": "Chronos-2",
              "ets": "ETS", "naif_musiman": "Naif musiman", "var": "VAR"}
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.8), sharex=True)
    for ax, (sumber, judul) in zip(axs, (("simulasi", "Simulasi, 70 UMKM"), ("french_bakery", "Toko roti sungguhan"))):
        u = o[sumber]["uji"]
        urut = sorted(u, key=lambda k: u[k]["mape"])
        for i, k in enumerate(urut):
            w = UNGU if i == 0 else ABU
            ax.barh(i, u[k]["mape"], color=w, height=0.6)
            ax.text(u[k]["mape"] + 0.3, i, _pr(u[k]["mape"]), va="center", fontsize=8.5)
        ax.set_yticks(range(len(urut)))
        ax.set_yticklabels([nama_m.get(k, k) for k in urut], fontsize=9)
        ax.invert_yaxis()
        ax.axvline(5, color=ORANYE, ls="--", lw=1.2)
        ax.set_title(judul, fontsize=10, loc="left")
        ax.grid(axis="x", color="#e5e7eb")
        ax.set_axisbelow(True)
    fig.supxlabel("Rata-rata meleset ramalan omset per pekan, % (garis putus oranye: sasaran 5%)", fontsize=9.5)
    fig.tight_layout()
    g2 = out / "mesin1_omset_uji.png"
    fig.savefig(g2)
    plt.close(fig)

    # Mesin 2: kerugian total tiap cara memilih, nama yang bisa dibaca orang awam.
    u = {b["nama"]: b for b in _j("hasil_eksperimen_mesin2_ulangan.json")["hasil"]}
    nama2 = [("greedy", "Pilih rapor terbaik (greedy)"), ("linucb_a1", "LinUCB"),
             ("thompson", "Thompson sampling saja"), ("epsilon_greedy_0.1", "Sesekali coba acak (ε-greedy)"),
             ("thompson+fuzzy (produksi)", "Thompson + fuzzy (dipakai)"), ("greedy+fuzzy", "Rapor terbaik + fuzzy"),
             ("topsis", "TOPSIS (peringkat berbobot)")]
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    for i, (k, n) in enumerate(nama2):
        r = u[k]["regret"]
        w = UNGU if "produksi" in k else ABU
        ax.barh(i, r["rata"], color=w, height=0.6, xerr=r["sd"] or None, ecolor="#374151", capsize=3)
        ax.text(r["rata"] + max(r["sd"], 0) + 12, i, _rb(r["rata"]), va="center", fontsize=9)
    ax.set_yticks(range(len(nama2)))
    ax.set_yticklabels([n for _, n in nama2])
    ax.invert_yaxis()
    lo = min(u[k]["regret"]["rata"] for k, _ in nama2)
    ax.set_xlim(lo * 0.85, max(u[k]["regret"]["rata"] for k, _ in nama2) * 1.08)
    ax.set_xlabel("Kerugian total selama 400 hari, 9.328 keputusan (makin kecil makin baik)")
    ax.grid(axis="x", color="#e5e7eb")
    ax.set_axisbelow(True)
    g3 = out / "mesin2_kerugian.png"
    fig.savefig(g3)
    plt.close(fig)
    return g1, g2, g3


# ==========================================================================
# Isi
# ==========================================================================
def sampul(L: Laporan) -> None:
    for teks in ("LAPORAN PROGRES TEKNIS", f"“{JUDUL}”", "PROJECT ANALITIKA DATA"):
        L.p(teks, rata="tengah", tebal=True, setelah=2)
    L.p("Dosen Pengampu : Dr. Edi Satriyanto, S.Si., M.Si", rata="tengah", setelah=24)
    if (ASET / "logo-pens.png").exists():
        L.d.add_picture(str(ASET / "logo-pens.png"), width=Cm(8.5))
        L.d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    L.p("", setelah=18)
    L.p("Disusun Oleh:", rata="tengah", tebal=True, setelah=4)
    t = L.d.add_table(rows=0, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for nama, nrp in TIM:
        c = t.add_row().cells
        c[0].text, c[1].text = nama, ": " + nrp
        c[0].width, c[1].width = Cm(6.0), Cm(4.0)
        for x in c:
            x.paragraphs[0].paragraph_format.space_after = Pt(0)
    L.p("", setelah=36)
    for teks in ("POLITEKNIK ELEKTRONIKA NEGERI SURABAYA", "DEPARTEMEN TEKNIK INFORMATIKA DAN KOMPUTER",
                 "PROGRAM STUDI SAINS DATA TERAPAN", TANGGAL.split(" ", 1)[1].upper()):
        L.p(teks, rata="tengah", tebal=True, setelah=4)


def daftar_isi(L: Laporan) -> None:
    p = L.p("DAFTAR ISI", rata="tengah", tebal=True)
    p.paragraph_format.page_break_before = True
    par = L.d.add_paragraph()
    _bidang(par, 'TOC \\o "1-2" \\h \\z \\u', "Klik kanan lalu pilih Update Field untuk memuat daftar isi.")


def abstrak(L: Laporan, A: dict) -> None:
    L.h1("ABSTRAK")
    t, c, u, m3 = A["turnamen"], A["cakupan"], A["ulang"], A["m3eks"]
    L.p("Turnify Flow (sebelumnya bernama Warungku) adalah aplikasi pendamping (add-on) bagi aplikasi kasir yang "
        "dipakai usaha mikro, kecil, dan menengah seperti warung Madura dan kedai kopi. Aplikasi kasir tetap "
        "mencatat penjualan; Turnify Flow membaca nota dari kasir itu, menghitung sisa stok gudang, meramal "
        "kebutuhan pekan dan bulan berikutnya, lalu menyarankan ke distributor mana sebaiknya memesan. Laporan ini "
        f"mencatat progres teknis proyek per {TANGGAL}, beserta alasan teknis dan keputusan bisnis di balik "
        "setiap pilihan.")
    L.p(f"Sistem terdiri atas portal pemilik usaha dan portal distributor (React), API (FastAPI) dengan basis data "
        f"PostgreSQL berisi {A['db']['tabel']} tabel, dan layanan model terpisah yang menjalankan tiga mesin "
        f"analitik. Karena data warung sungguhan belum tersedia, model dilatih dan diuji pada dataset simulasi "
        f"{A['db']['usaha']} UMKM selama 400 hari, dan metode peramalannya divalidasi juga pada data penjualan "
        "sebuah toko roti sungguhan.")
    L.p("Mesin 1 meramal kebutuhan stok per barang dengan SARIMA. Pada pekan uji, MAPE pekanannya "
        f"{_pr(t['sarima_untuk_semua']['mape'])}, lebih baik daripada model sebelumnya, ETS "
        f"({_pr(t['ets_untuk_semua']['mape'])}), dan rentang p10–p90-nya mencakup "
        f"{_pr(100 * c['sarima']['cakupan_p10_p90'])} permintaan sungguhan (sasaran 80%). Peramalan omset mencapai "
        f"MAPE {_pr(A['omset']['simulasi']['uji']['sarimax']['mape'])} di simulasi dan "
        f"{_pr(A['omset']['french_bakery']['uji']['chronos_2']['mape'])} di toko roti sungguhan. Mesin 2 memilih "
        "distributor dengan Beta-Bernoulli, Thompson sampling, dan inferensi fuzzy; regretnya "
        f"{_rb(u['thompson+fuzzy (produksi)']['regret']['rata'])} ± {_rb(u['thompson+fuzzy (produksi)']['regret']['sd'])} "
        f"dibanding TOPSIS {_rb(u['topsis']['regret']['rata'])}, dan kebijakan “selalu pilih termurah” terbukti "
        "lebih buruk daripada memilih acak. Mesin 3 mengelompokkan pelanggan distributor dengan K-Prototypes, "
        f"dengan stabilitas segmen {_ak(m3['kprototypes_log']['ari_rata'], 3)} dari skala 0 sampai 1.")
    L.p("Yang belum selesai: kedua portal belum tersambung ke API dan masih memakai data contoh, konektor ke "
        "aplikasi kasir tertentu belum dibuat, dan seluruh angka model masih berasal dari simulasi yang dirancang "
        "tim sendiri.")
    L.p(("Kata kunci: ", "b"), "UMKM, manajemen stok, peramalan permintaan, SARIMA, contextual bandit, "
        "inferensi fuzzy, K-Prototypes, aplikasi pendamping kasir.")


def perubahan(L: Laporan) -> None:
    L.h1("PERUBAHAN SEJAK LAPORAN PAD2")
    L.p("Laporan proses bisnis dan UI/UX (PAD2) disusun pada pertengahan September 2026. Sejak itu beberapa hal "
        "berubah, sebagian atas keputusan tim dan sebagian karena hasil pengujian. Tabel di bawah mencatat "
        "perubahannya, supaya laporan ini bisa dibaca berdampingan dengan PAD2 tanpa menimbulkan pertentangan.")
    L.tabel("Perubahan dari PAD2 ke laporan ini", ["Hal", "Di PAD2", "Sekarang", "Alasan"], [
        ["Nama produk", "Warungku", "Turnify Flow, dengan logo baru", "Identitas baru yang menggambarkan perputaran (turnover) stok dan aliran (flow) pasokan"],
        ["Judul dan fokus", "Modul prediksi penjualan", "Sistem analitika rantai pasok dengan tiga mesin", "Yang diramal adalah kebutuhan stok, bukan penjualan; ditambah saran distributor dan profil pelanggan"],
        ["Teknologi", "Antarmuka saja (React)", "Antarmuka, API FastAPI, PostgreSQL, layanan model", "Backend dan model dibangun 5–12 Oktober 2026"],
        ["Menu portal distributor", "Beranda, Pesanan, Lacak Pesanan, Profil", "Beranda, Pesanan, Kontrak, Promo, Profil", "Lacak Pesanan tumpang tindih dengan Pesanan; dilebur ke Pesanan dan halaman Sebaran"],
        ["Koreksi stok", "Dengan alasan, ditambah Hitung Fisik", "Cukup isi sisa sekarang; Hitung Fisik dihapus", "Penyederhanaan (keputusan tim 2 Okt); jenis pergerakan tetap dicatat sistem untuk data model"],
        ["Alasan prediksi di layar", "Disertai alasan dan tingkat keyakinan", "Alasan tidak ditampilkan; keyakinan dinyatakan lewat rentang p10–p90 di model", "Keputusan tim 2 Okt untuk menyederhanakan layar"],
        ["Potongan promo", "Kabar promo", "Potongan masuk ke harga beli sekali, tidak ke harga kontrak", "Keputusan tim 2 Okt; harga kontrak adalah kesepakatan yang mengikat"],
        ["Status stok", "Termasuk “kebanyakan”", "Tiga status: habis, menipis, aman", "Keputusan tim 2 Okt"],
    ], [2.8, 3.3, 4.2, 5.2])


def latar_belakang(L: Laporan) -> None:
    L.h1("A. LATAR BELAKANG")
    L.p("Sebagaimana dijabarkan di laporan PAD2, UMKM kuliner dan ritel kecil di Indonesia sudah banyak memakai "
        "aplikasi kasir digital untuk mencatat penjualan, mencetak struk, dan merekap pendapatan harian. Namun "
        "pemakaiannya berhenti di tahap pencatatan: aplikasi kasir tahu persis apa yang laku hari ini, tetapi tidak "
        "pernah menghitung sisa bahan di gudang, tidak memperkirakan kebutuhan pekan depan, dan tidak membantu "
        "memilih ke distributor mana harus memesan. Di sisi lain, distributor menerima pesanan yang datang mendadak "
        "lewat telepon dan pesan singkat tanpa gambaran kebutuhan pelanggannya.")
    L.p("Turnify Flow dirancang untuk mengisi jarak itu tanpa memaksa pemilik usaha mengganti kasir yang sudah ia "
        "kuasai. Data penjualan dari kasir diubah menjadi tiga keputusan yang sehari-hari diambil pemilik usaha "
        "dengan perkiraan kasar: berapa banyak harus memesan, kapan, dan ke siapa.")
    L.p("Dari sisi analitika data, tiga keputusan itu mengandung tiga masalah teknis yang tidak sederhana:")
    L.butir(("Permintaan yang tersensor. ", "b"), "Saat stok habis, penjualan tercatat nol padahal permintaannya tidak "
            "nol. Model yang menganggap nol itu sebagai permintaan akan menyimpulkan barang yang paling sering kosong "
            "adalah barang yang paling tidak laku, lalu menyarankan stok lebih sedikit.")
    L.butir(("Umpan balik yang tidak lengkap. ", "b"), "Pemilik usaha hanya tahu hasil pesanan ke distributor yang "
            "benar-benar ia pilih. Distributor yang tidak pernah dipilih tidak pernah punya riwayat, sehingga tidak "
            "pernah terpilih. Masalah ini tidak bisa diselesaikan dengan klasifikasi biasa.")
    L.butir(("Data campuran. ", "b"), "Pelanggan distributor dicirikan oleh angka (seberapa sering dan seberapa banyak "
            "memesan) sekaligus kategori (jenis usaha, kategori barang), sehingga metode pengelompokan yang hanya "
            "mengenal jarak angka tidak cocok.")


def rumusan(L: Laporan) -> None:
    L.h1("B. RUMUSAN MASALAH", halaman_baru=False)
    L.p("Lima rumusan dari PAD2 tetap berlaku. Tiga rumusan teknis ditambahkan untuk tahap analitika data.")
    for i, teks in enumerate([
        "Bagaimana merancang aplikasi pendamping yang mengubah data transaksi dari aplikasi kasir menjadi angka sisa "
        "stok gudang yang bisa dipercaya, tanpa mengharuskan pemilik usaha mencatat ulang dan tanpa menggantikan "
        "aplikasi kasir yang sudah dipakainya?",
        "Bagaimana menyusun perkiraan kebutuhan stok periode berikutnya dari riwayat pemakaian?",
        "Bagaimana menghubungkan hasil perkiraan tersebut langsung ke proses pengadaan ke distributor, termasuk "
        "mekanisme kontrak berjangka dengan kuota bulanan?",
        "Bagaimana merancang portal bagi distributor agar pesanan masuk, tahap pengerjaan, dan sebaran pemesan dapat "
        "dikelola dalam satu tempat?",
        "Bagaimana menjaga agar angka stok di dalam sistem tidak menyimpang dari keadaan fisik di gudang?",
        "Metode peramalan apa yang paling tepat untuk kebutuhan stok per barang dan omset per usaha, dan seberapa "
        "akurat menurut MAPE pekanan?",
        "Bagaimana memilih distributor bila hasil dari distributor yang tidak dipesan tidak pernah diketahui, dan "
        "bagaimana menimbang keandalan terhadap harga?",
        "Bagaimana mengelompokkan pelanggan distributor dari data campuran angka dan kategori sehingga segmennya stabil "
        "dan berarti?",
    ], 1):
        L.p(f"{i}. ", teks)


def batasan(L: Laporan) -> None:
    L.h1("C. BATASAN MASALAH", halaman_baru=False)
    L.butir(("Add-on dari aplikasi kasir, bukan aplikasi kasirnya. ", "b"), "Pencatatan penjualan, struk pelanggan, "
            "dan laci uang tetap menjadi pekerjaan aplikasi kasir (POS).")
    L.butir(("Bidang usaha. ", "b"), "UMKM seperti warung Madura, kedai kopi, warung makan, dan kedai minuman. Wilayah "
            "tidak dibatasi; data simulasi memakai kota-kota di DIY.")
    L.butir(("Satu aplikasi kasir. ", "b"), "Integrasi dibatasi pada satu POS (Kasir Open POS); format nota mengikuti "
            "POS tersebut.")
    L.butir(("Tidak ada omzet, laba, atau margin di layar. ", "b"), "Harga jual tetap milik POS. Harga jual dari nota "
            "hanya dipakai di sisi model untuk meramal omset, sesuai arahan dosen.")
    L.butir(("Data simulasi. ", "b"), "Model dilatih dan diuji pada dataset simulasi; metode peramalan divalidasi pada "
            "satu set data nyata (toko roti). Data warung sungguhan belum ada.")
    L.butir(("Resep 1:1. ", "b"), "Satu menu di kasir mengurangi satu barang di gudang. Struktur tabel resep berbilang "
            "bahan sudah tersedia tetapi belum diisi.")
    L.butir(("Purwarupa lokal. ", "b"), "Sistem dijalankan di laptop untuk demo; belum ada Dockerfile layanan, OTP "
            "WhatsApp, atau penyegaran token.")


def tujuan(L: Laporan, A: dict) -> None:
    L.h1("D. TUJUAN")
    L.p(("Tujuan utama. ", "b"), "Membangun platform yang menyambungkan data penjualan UMKM dengan proses pengadaan ke "
        "distributor, sehingga keputusan pembelian stok didasarkan pada pemakaian yang benar-benar tercatat, dan "
        "membantu pemilik UMKM memperkirakan stok yang akan dibutuhkan.")
    L.p(("Tujuan khusus dan status capaian per " + TANGGAL + ". ", "b"),
        "Status ditulis apa adanya: “Sebagian” berarti sudah bekerja di salah satu lapisan (antarmuka atau "
        "backend) tetapi belum tersambung ujung ke ujung.")
    L.tabel("Tujuan khusus dan status capaiannya", ["No", "Tujuan khusus", "Status", "Bukti"], [
        ["1", "Pengurangan stok otomatis dari transaksi kasir melalui satu basis data transaksi terpusat",
         "Sebagian", "Endpoint nota idempoten dan buku besar stok teruji; belum tersambung ke aplikasi kasir sungguhan"],
        ["2", "Perkiraan kebutuhan stok periode berikutnya", "Tercapai di model",
         f"SARIMA, MAPE pekanan {_pr(A['turnamen']['sarima_untuk_semua']['mape'])}, rentang p10–p90 terkalibrasi; layar Prediksi masih data contoh"],
        ["3", "Jalur pengadaan lengkap: saran, keranjang, pesanan, penerimaan barang", "Sebagian",
         "Lengkap di antarmuka (data contoh); di API baru saran distributor dan nota"],
        ["4", "Portal distributor untuk pesanan, kontrak, promo, dan sebaran", "Sebagian",
         "Lengkap di antarmuka; API portal distributor baru bisa membaca"],
        ["5", "Satu pintu kenaikan stok dari pengadaan dan jejak pada setiap penyesuaian", "Tercapai",
         "Setiap perubahan stok tercatat di riwayat stok; pemeriksaan otomatis memastikan angka stok selalu cocok dengan riwayatnya"],
        ["6", "Tiga mesin analitik yang dievaluasi terhadap pembanding", "Tercapai",
         "Turnamen Mesin 1, simulasi regret Mesin 2, uji stabilitas Mesin 3 (bagian J)"],
    ], [1.0, 6.0, 2.6, 6.0])


def arsitektur(L: Laporan) -> None:
    L.h1("E. ARSITEKTUR SISTEM")
    L.gambar(GAMBAR / "dosen" / "arsitektur.png", "Arsitektur Turnify Flow per 12 Oktober 2026", 15.5)
    L.p("Sistem dibagi menjadi empat bagian yang masing-masing punya folder sendiri di repositori: antarmuka "
        "(frontend/), API dan basis data (backend/), layanan model (ml/), dan pembangkit dataset (data/). Satu "
        "aturan memisahkan API dan layanan model: ", ("layanan model menulis ke tabel, API membaca tabel", "b"),
        ". API tidak pernah memanggil model saat halaman dibuka. Akibatnya, kalau layanan model mati, aplikasi "
        "tetap terbuka dengan angka terakhir yang tersimpan, dan kolom tingkat layanan menyatakan bahwa angkanya "
        "tidak segar. Pemisahan ini juga berarti beban komputasi model (beberapa menit untuk 890 barang) tidak "
        "pernah dirasakan pengguna, karena dijalankan penjadwal pada pukul 02.00 WIB.")
    L.tabel("Pilihan teknologi dan alasannya", ["Bagian", "Teknologi", "Kenapa dipilih"], [
        ["Antarmuka", "React 19, Vite, TypeScript, Tailwind CSS v4, Zustand", "Komponen dan tipe data dibagi untuk dua portal; TypeScript menangkap kesalahan bentuk data sebelum dijalankan"],
        ["API", "FastAPI, SQLModel, Alembic", "Satu bahasa dengan layanan model (Python); dokumentasi API (Swagger) terbentuk otomatis; migrasi skema berversi"],
        ["Basis data", "PostgreSQL 16 (Docker, port 5433)", "Transaksi ACID untuk aksi yang mengubah beberapa tabel sekaligus; NUMERIC untuk jumlah barang; port 5433 agar tidak bentrok dengan PostgreSQL lain"],
        ["Otentikasi", "argon2 untuk sandi, JWT", "Satu tabel pengguna, dua pintu masuk, dua jenis token: token pemilik usaha tidak bisa membuka portal distributor"],
        ["Mesin 1", "statsmodels (SARIMA, SARIMAX, ETS), Chronos-2", "SARIMA berorde tetap dan koefisiennya bisa dijelaskan; Chronos-2 (lisensi Apache-2.0) sebagai pembanding model fondasi"],
        ["Mesin 2", "Beta-Bernoulli, Thompson sampling, fuzzy Sugeno", "Bisa dihitung tangan dan dijelaskan; sesuai arahan dosen (Bayesian dan fuzzy)"],
        ["Mesin 3", "K-Prototypes (Huang, 1998)", "Satu-satunya metode di daftar kandidat yang menangani angka dan kategori sekaligus"],
        ["Penjadwal", "APScheduler di dalam layanan model", "Mesin 1 setiap hari pukul 02.00 WIB; Mesin 2 dan 3 setiap empat jam"],
    ], [2.4, 4.6, 8.6])
    L.h2("Keputusan bisnis yang tercermin di arsitektur")
    L.butir(("Add-on, bukan POS. ", "b"), "Satu-satunya pintu data penjualan adalah endpoint nota. Nota yang sama "
            "boleh dikirim ulang berapa kali pun tanpa memotong stok dua kali, karena pasangan (usaha, nomor nota) "
            "dijaga unik. Ini penting untuk koneksi warung yang sering terputus.")
    L.butir(("Satu pesanan, dua tampilan. ", "b"), "Pesanan disimpan di satu tabel dan dibaca dari dua portal. "
            "Status yang diubah distributor langsung terlihat oleh pemilik usaha.")
    L.butir(("Harga disalin saat pesanan dibuat. ", "b"), "Harga kontrak atau harga promo disalin ke baris pesanan, "
            "tidak dihitung ulang dari daftar harga hari ini, supaya pesanan lama tidak berubah nilainya.")
    L.butir(("Satuan dasar. ", "b"), "Semua jumlah disimpan dalam gram, mililiter, atau buah. Kilogram, liter, dan "
            "dus hanya lapisan tampilan, sehingga penjumlahan buku besar selalu pas.")


def tangkapan_layar(L: Laporan) -> None:
    L.h1("F. TANGKAPAN LAYAR APLIKASI")
    A = GAMBAR / "aplikasi"
    L.p("Tangkapan layar diambil dari aplikasi yang berjalan dengan perintah npm run dev, pada lebar desktop "
        "1440 piksel dan lebar HP 390 piksel. Seluruh angka di layar berasal dari data contoh di antarmuka, "
        "karena portal belum tersambung ke API.")
    L.h2("1. Halaman depan dan pintu masuk")
    L.gambar(A / "hero-desktop.png", "Halaman depan: penegasan bahwa Turnify Flow adalah aplikasi tambahan, bukan aplikasi kasir")
    L.gambar_berjajar([A / "masuk-hp.png", A / "daftar-hp.png"], "Layar masuk dan pendaftaran di HP", 5.6)
    L.h2("2. Portal pemilik usaha")
    L.gambar(A / "beranda-desktop.png", "Beranda: promo distributor, empat pintasan Perlu Tindakan, dan tugas hari ini")
    L.gambar(A / "stok-desktop.png", "Daftar stok dengan status habis, menipis, aman, dan satuan tampil per barang")
    L.gambar(A / "stok-detail-desktop.png", "Rincian satu barang: riwayat pergerakan stok dan batas aman")
    L.gambar(A / "prediksi-desktop.png", "Prediksi: nilai pemakaian setahun terakhir dan perkiraan bulan depan per kategori")
    L.gambar(A / "distributor-desktop.png", "Daftar distributor dan rekomendasi untuk usaha pengguna")
    L.gambar(A / "keranjang-desktop.png", "Keranjang: dipecah per distributor dan per kontrak sebelum dikirim menjadi pesanan")
    L.gambar(A / "pesanan-desktop.png", "Daftar pesanan dan kontrak")
    L.gambar(A / "pesanan-detail-desktop.png", "Rincian pesanan: jejak status, bukti pengiriman, dan penerimaan barang")
    L.h2("3. Tampilan HP")
    L.gambar_berjajar([A / "beranda-hp.png", A / "stok-hp.png", A / "prediksi-hp.png"],
                      "Beranda, Stok, dan Prediksi di HP. Pemilik usaha diasumsikan lebih sering membuka dari HP", 4.6)
    L.h2("4. Portal distributor")
    L.gambar(A / "portal-beranda-desktop.png", "Beranda portal distributor")
    L.gambar(A / "portal-pesanan-desktop.png", "Pesanan masuk: terima atau tolak dengan alasan, lalu disiapkan, dikirim, selesai")
    L.gambar(A / "portal-kontrak-desktop.png", "Kontrak: pengajuan, kontrak berjalan, permintaan berhenti, dan paket kontrak")
    L.gambar(A / "portal-promo-desktop.png", "Promo: distributor membuat dan mengakhiri promo")
    L.gambar(A / "portal-sebaran-desktop.png", "Sebaran pemesan: titik berwarna dan berbentuk cincin berbeda menurut status pesanan")
    L.h2("5. Antarmuka API")
    L.gambar(A / "swagger-api.png", "Dokumentasi interaktif API utama (port 8000)", 14.0)
    L.gambar(A / "swagger-ml.png", "Dokumentasi interaktif layanan model (port 8001)", 14.0)


def alur_erd(L: Laporan, A: dict) -> None:
    L.h1("G. ALUR DATA DAN SKEMA BASIS DATA")
    L.h2("1. Perjalanan data dari nota sampai pesanan")
    L.p("Gambar berikut menunjukkan perjalanan data di Turnify Flow dalam sembilan langkah. Kotak oranye adalah "
        "langkah yang dikerjakan ketiga mesin analitik; kotak lainnya dikerjakan aplikasi.")
    L.gambar(GAMBAR / "dosen" / "alur-data.png", "Perjalanan data di Turnify Flow. Oranye: langkah yang dikerjakan mesin analitik", 13.5)
    L.p("Semuanya berawal dari nota penjualan yang dikirim aplikasi kasir. Setiap nota otomatis mengurangi stok "
        "barang yang terjual, lalu penjualan dijumlahkan per barang per hari. Dari catatan harian itu Mesin 1 "
        "memperkirakan kebutuhan 30 hari ke depan dan menetapkan batas aman tiap barang. Ketika stok turun di bawah "
        "batas aman, Mesin 2 menyarankan distributor yang paling layak dipesani. Pesanan lalu dikirim ke distributor, "
        "dan saat barangnya diterima, stok bertambah kembali. Di sisi distributor, Mesin 3 merangkum para pelanggannya "
        "menjadi beberapa kelompok.")
    L.p("Ada dua putaran balik yang membuat sistem belajar dari pemakaiannya sendiri. Pertama, barang yang diterima "
        "menambah stok, sehingga perhitungan berikutnya memakai stok yang baru. Kedua, setiap pesanan dicatat hasilnya: "
        "datang tepat waktu atau terlambat, jumlahnya sesuai atau kurang, kondisinya baik atau rusak. Catatan ini "
        "memperbarui “rapor” distributor yang dipakai Mesin 2, sehingga sarannya makin tepat seiring bertambahnya pesanan.")

    # ERD di halaman mendatar supaya nama tabelnya terbaca.
    L.bagian_baru(mendatar=True)
    L.h2("2. Skema basis data")
    L.gambar(GAMBAR / "dosen" / "erd.png", f"Skema basis data: {A['db']['tabel']} tabel dalam enam kelompok", 24.0, 12.5)
    L.bagian_baru(mendatar=False)
    L.p(f"Seluruh data disimpan di {A['db']['tabel']} tabel yang dikelompokkan menjadi enam menurut isinya:")
    for judul, isi in (("Inti", "data pengguna, usaha, distributor, dan katalog barang bersama."),
                       ("Gudang", "barang milik tiap usaha, nota dari kasir, dan riwayat keluar-masuk stok."),
                       ("Niaga", "penawaran harga distributor, kontrak, promo, pesanan, dan ulasan."),
                       ("Analitik", "bahan dan hasil Mesin 1 dan Mesin 2, yaitu catatan penjualan harian, hasil ramalan, dan skor distributor."),
                       ("Segmen", "hasil Mesin 3, yaitu kelompok pelanggan tiap distributor."),
                       ("Referensi", "kalender hari libur nasional dan cuti bersama.")):
        L.butir((judul + ": ", "b"), isi)
    L.p("Tiga kelompok pertama diisi oleh aplikasi saat pengguna bekerja. Kelompok analitik dan segmen hanya diisi oleh "
        "mesin analitik. Dengan pembagian ini selalu jelas dari mana setiap angka berasal.")
    L.p("Tiga aturan menjaga angka di dalamnya tetap benar:")
    L.butir(("Uang disimpan dalam rupiah bulat. ", "b"), "Tidak ada angka pecahan untuk uang, sehingga tidak muncul selisih "
            "pembulatan di layar.")
    L.butir(("Jumlah barang disimpan dalam satuan terkecil. ", "b"), "Gram, mililiter, atau buah. Kilogram, liter, dan dus "
            "hanya cara menampilkan, sehingga penjumlahan selalu tepat.")
    L.butir(("Stok tidak pernah diubah langsung. ", "b"), "Setiap barang yang terjual, masuk, atau dikoreksi dicatat sebagai "
            "satu baris riwayat, dan angka stok selalu sama dengan jumlah seluruh riwayat itu. Dengan begitu setiap angka "
            "stok bisa ditelusuri asal-usulnya.")


def komponen(L: Laporan) -> None:
    L.h1("H. KOMPONEN ALUR KERJA SISTEM")
    L.p("Tabel ini memperbarui tabel komponen alur kerja di laporan PAD2 dengan kolom status pengerjaan saat ini.")
    L.tabel("Komponen alur kerja sistem", ["No", "Alur", "Komponen", "Pelaku", "Penjelasan", "Status"], [
        ["1", "Data penjualan masuk", "Penerimaan nota", "Aplikasi kasir", "Nota dari kasir diterima dan langsung mengurangi stok; nota yang terkirim dua kali tetap dihitung sekali", "Selesai di server"],
        ["2", "Pemantauan stok", "Stok gudang dan riwayatnya", "Pemilik, manajer, kasir", "Sisa stok tiap barang beserta riwayat keluar-masuknya", "Selesai di server"],
        ["3", "Pemantauan stok", "Batas aman dan pemberitahuan", "Pemilik, manajer", "Barang yang menipis atau habis ditandai dan diberitahukan", "Selesai di tampilan"],
        ["4", "Perkiraan kebutuhan", "Mesin 1", "Mesin analitik", "Perkiraan pemakaian 30 hari ke depan per barang", "Selesai"],
        ["5", "Pengadaan", "Katalog dan penawaran", "Distributor, pemilik", "Daftar barang, harga, promo, dan paket kontrak dari distributor", "Selesai di tampilan"],
        ["6", "Pengadaan", "Saran distributor", "Mesin analitik", "Distributor yang paling layak untuk tiap barang", "Selesai"],
        ["7", "Pengadaan", "Keranjang dan pemesanan", "Pemilik, manajer", "Keranjang dipecah per distributor lalu dikirim sebagai pesanan", "Selesai di tampilan"],
        ["8", "Pengadaan", "Kontrak dan kuota bulanan", "Pemilik, distributor", "Kesepakatan harga dan jumlah per bulan untuk jangka waktu tertentu", "Selesai di tampilan"],
        ["9", "Penerimaan barang", "Penerimaan dan selisih", "Pemilik, manajer, kasir", "Barang yang datang dicek; selisih jumlah atau kondisi dicatat", "Selesai di tampilan"],
        ["10", "Sisi distributor", "Pesanan masuk", "Distributor", "Pesanan diterima atau ditolak, lalu disiapkan dan dikirim", "Sebagian"],
        ["11", "Sisi distributor", "Profil pelanggan", "Mesin analitik", "Kelompok pelanggan: andalan, rutin, baru, mulai menjauh", "Selesai"],
        ["12", "Pendukung", "Verifikasi legalitas", "Admin", "Pemeriksaan dokumen usaha sebelum akun aktif", "Rencana"],
    ], [1.0, 2.3, 2.6, 2.4, 5.0, 2.2])
    L.p(("Arti status. ", "b"), "Selesai di tampilan: layarnya sudah jadi dan bisa dicoba dengan data contoh, tetapi belum "
        "tersambung ke server. Selesai di server: logika dan penyimpanannya sudah bekerja dan teruji, tetapi layarnya belum "
        "memakainya. Sebagian: server baru bisa menampilkan data, belum bisa mengubahnya.")


def dataset(L: Laporan, A: dict) -> None:
    db = A["db"]
    L.h1("I. DATASET")
    L.h2("1. Kenapa memakai data simulasi")
    L.p("Mesin analitik perlu riwayat penjualan dan riwayat pesanan beserta hasilnya, sedangkan tim belum memiliki data "
        "warung sungguhan. Data dari internet yang mengaku sebagai data UMKM Indonesia ternyata buatan atau tidak jelas "
        "asal-usulnya. Karena itu tim membuat simulasi yang menghasilkan semua data sekaligus: penjualan mengurangi stok, "
        "stok yang menipis memicu pesanan, dan pesanan menghasilkan catatan pengiriman. Karena berasal dari satu simulasi, "
        "data untuk ketiga mesin saling cocok.")
    L.h2("2. Isi simulasi")
    L.tabel("Isi dataset simulasi", ["Unsur", "Jumlah"], [
        ["Rentang waktu", f"{db['awal'].strftime('%d %b %Y')} sampai {db['akhir'].strftime('%d %b %Y')} (400 hari)"],
        ["UMKM", f"{_rb(db['usaha'])} usaha: kedai kopi, warung makan, kedai minuman, toko roti dan kue, serta kelontong"],
        ["Distributor", f"{_rb(db['distributor'])} distributor, masing-masing dengan watak tersembunyi: seberapa sering tepat waktu, jumlahnya sesuai, dan barangnya baik"],
        ["Barang di gudang", f"{_rb(db['barang'])} barang"],
        ["Nota kasir", f"{_rb(db['transaksi'])} nota berisi {_rb(db['transaksi_baris'])} baris barang"],
        ["Pesanan ke distributor", f"{_rb(db['pesanan'])} pesanan"],
        ["Hari dengan stok habis", f"{_pr(100 * db['stok_habis'])} dari seluruh hari per barang"],
    ], [4.6, 11.0])
    L.p("Penjualan harian dibuat acak, tetapi mengikuti pola yang wajar: ramai atau sepi menurut hari dan jenis usaha, "
        "naik saat gajian (tanggal 25 sampai 5), berubah selama Ramadan dan Lebaran, dan mengikuti hari libur nasional "
        "serta cuti bersama 2025–2027. Distributor juga punya kebiasaan: ada yang sering terlambat saat hujan, ada yang "
        "kewalahan dengan pesanan besar, dan ada yang lebih murah tetapi kurang andal.")
    L.h2("3. Dua rancangan penting")
    L.butir(("Stok habis tidak dianggap tidak laku. ", "b"), "Saat stok habis, penjualan tercatat nol padahal pembelinya ada. "
            "Hari-hari seperti itu ditandai dan tidak dipakai untuk menilai ramalan, supaya mesin tidak menyimpulkan bahwa "
            "barang yang sering kosong adalah barang yang tidak laku.")
    L.butir(("Kunci jawaban untuk saran distributor. ", "b"), "Untuk setiap pesanan, simulasi juga mencatat apa yang akan "
            "terjadi seandainya pemilik memesan ke distributor lain. Catatan ini tidak pernah diperlihatkan ke mesin; ia "
            "hanya dipakai untuk menilai seberapa jauh saran Mesin 2 dari pilihan terbaik.")
    L.h2("4. Data toko sungguhan untuk menguji metode")
    L.p("Supaya hasilnya tidak hanya berlaku di simulasi buatan sendiri, metode peramalan juga diuji pada data penjualan "
        "sebuah toko roti di Prancis (French Bakery Daily Sales): sekitar 234 ribu baris penjualan dari Januari 2021 sampai "
        "September 2022, 149 jenis produk. Data ini hanya dipakai untuk menguji metodenya dan tidak ikut disimpan di "
        "repositori karena lisensinya bukan lisensi terbuka.")
    L.h2("5. Keterbatasan yang sudah diketahui")
    L.butir("Simulasi dirancang tim sendiri. Beberapa temuan di bab J, misalnya bahwa distributor termurah kurang andal, "
            "sebagian lahir dari rancangan itu dan ditandai demikian.")
    L.butir("Ditemukan satu cacat: tidak ada distributor yang mengirim susu, es batu, dan air galon ke Kabupaten Bantul. "
            "Akibatnya 44 barang di 16 UMKM Bantul tidak pernah dipesan ulang dan hampir selalu kosong. Penilaian ramalan "
            "tidak terpengaruh karena hari stok habis tidak dinilai, tetapi omset UMKM Bantul menjadi lebih rendah daripada "
            "seharusnya. Perbaikannya dijadwalkan bersama pembaruan dataset berikutnya.")


def mesin(L: Laporan, A: dict, g_turnamen: Path, g_omset: Path, g_m2: Path) -> None:
    t, ta, c, o, ft = A["turnamen"], A["anggota"], A["cakupan"], A["omset"], A["finetune"]
    sar = A["saringan"]
    s = t["uji"]["strategi"]
    L.h1("J. MESIN ANALITIK")
    L.p("Ketiga mesin dinilai dengan cara yang sama. Setiap model dibandingkan dengan cara yang lebih sederhana, dan data "
        "dibagi tiga: bagian awal untuk melatih, beberapa pekan berikutnya untuk memilih pengaturan, dan satu pekan "
        "terakhir (29 September sampai 5 Oktober 2026) yang dikunci sebagai ujian akhir. Angka yang dilaporkan berasal "
        "dari ujian akhir itu, sehingga tidak ada model yang dinilai dengan data yang sudah pernah dilihatnya.")
    L.p(("Cara membaca angka ramalan. ", "b"), "Akurasi ramalan diukur dengan MAPE, yaitu rata-rata persentase meleset "
        "ramalan dari kenyataan, dihitung per pekan. MAPE 15% berarti ramalan pekanan rata-rata meleset 15% dari "
        "pemakaian sebenarnya. Makin kecil makin baik.")

    # ---- Mesin 1 -----------------------------------------------------------
    L.h2("1. Mesin 1: perkiraan kebutuhan stok")
    L.p(("Tugasnya. ", "b"), "Memperkirakan berapa banyak tiap barang akan terpakai setiap hari selama 30 hari ke depan. "
        "Perkiraannya berupa rentang: perkiraan rendah, tengah, dan tinggi. Perkiraan tinggi dipakai sebagai batas aman. "
        "Kalau sisa stok tidak cukup untuk memenuhi perkiraan tinggi selama menunggu barang dikirim, barang itu berstatus "
        "menipis dan perlu dipesan.")
    L.p(("Barang mana yang diramal. ", "b"), f"Tidak semua barang perlu model. Dari {_rb(sar['barang'])} barang milik "
        f"{sar['usaha']} UMKM, barang yang paling besar nilai belanjanya dan cukup sering terjual diramal dengan model "
        f"({_rb(sar['diramal'])} barang). Sisanya dihitung dengan aturan sederhana: rata-rata pemakaian harian dikali lama "
        "pengiriman. Hari-hari yang tidak wajar, misalnya lonjakan pembelian mendadak, ditandai agar tidak mengacaukan "
        "ramalan, sedangkan hari libur dan Ramadan tetap dianggap wajar karena polanya bisa diperkirakan.")
    L.p(("Model yang dibandingkan. ", "b"), "Lima model diadu, ditambah satu cara gabungan:")
    L.tabel("Model yang dibandingkan untuk Mesin 1", ["Model", "Cara kerjanya secara singkat"], [
        ["Naif musiman", "Pemakaian pekan depan dianggap sama dengan pekan ini. Pembanding paling dasar"],
        ["ETS", "Meratakan riwayat dengan bobot lebih besar untuk data terbaru. Model yang dipakai sebelumnya"],
        ["SARIMA", "Membaca pola mingguan dari riwayat, ditambah pengaruh hari libur, gajian, dan Ramadan"],
        ["LightGBM", "Model pembelajaran mesin berbasis pohon keputusan yang belajar dari banyak barang sekaligus"],
        ["Chronos-2", "Model siap pakai yang sudah dilatih dari sangat banyak data deret waktu di luar proyek ini"],
        ["Terbaik per kelompok", "Barang dikelompokkan menurut kemiripan polanya, lalu tiap kelompok memakai model yang paling cocok untuknya"],
    ], [3.6, 12.0])
    L.gambar(g_turnamen, "Rata-rata meleset ramalan per pekan di ujian akhir. Ungu: model yang dipakai sekarang; oranye: model sebelumnya", 15.0)
    L.p(f"SARIMA meleset rata-rata {_pr(s['sarima_untuk_semua']['mape'])} per pekan, lebih baik daripada ETS yang dipakai "
        f"sebelumnya ({_pr(s['ets_untuk_semua']['mape'])}) dan pembanding dasar ({_pr(s['naif_musiman_untuk_semua']['mape'])}). "
        f"LightGBM sama akuratnya ({_pr(s['lightgbm_untuk_semua']['mape'])}), tetapi cara kerjanya jauh lebih sulit dijelaskan. "
        f"Cara terbaik per kelompok ({_pr(s['juara_per_kelompok']['mape'])}) ternyata tidak menambah akurasi, karena "
        "barang-barangnya tidak terbagi ke dalam kelompok yang tegas; bila dicek ke seluruh barang hasilnya setara ETS "
        f"({_pr(ta['pendukung_validasi_anggota']['juara_perwakilan']['mape'])} melawan "
        f"{_pr(ta['pendukung_validasi_anggota']['ets']['mape'])}).")
    L.p(("Apakah rentangnya bisa dipercaya? ", "b"), "Karena batas aman memakai perkiraan tinggi, rentangnya harus tepat. "
        "Rentang yang baik memuat pemakaian sebenarnya sekitar 80% dari waktu, dan pemakaian melebihi perkiraan tinggi "
        "sekitar 10% dari waktu. Hasil pengecekan di tujuh pekan, 890 barang:")
    L.tabel("Ketepatan rentang perkiraan", ["Model", "Pemakaian jatuh di dalam rentang (sasaran 80%)", "Pemakaian melebihi perkiraan tinggi (sasaran 10%)"], [
        ["SARIMA (dipakai)", _pr(100 * c["sarima"]["cakupan_p10_p90"]), _pr(100 * c["sarima"]["di_atas_p90"])],
        ["ETS (sebelumnya)", _pr(100 * c["ets"]["cakupan_p10_p90"]), _pr(100 * c["ets"]["di_atas_p90"])],
    ], [4.0, 5.8, 5.8])
    pred = A["db"]["prediksi_terakhir"]
    cad = sum(v for k, v in pred.items() if "cadangan" in k)
    L.p("Rentang SARIMA tepat sasaran dan sedikit berhati-hati: pemakaian lebih jarang melewati perkiraan tinggi, sehingga "
        f"stok lebih jarang habis. Pada perhitungan terakhir, {_rb(sum(pred.values()) - cad)} barang diramal dengan SARIMA dan "
        f"{_rb(cad)} barang memakai ETS sebagai cadangan, karena riwayatnya hampir seluruhnya kosong akibat cacat dataset "
        "Bantul (bab I).")
    L.p(("Perkiraan omset. ", "b"), "Sesuai arahan dosen, omset tiap UMKM juga diramal, baik dari riwayat omset saja "
        "(ETS, naif musiman) maupun bersama data lain seperti kalender, jumlah barang, dan jumlah nota (SARIMAX, VAR), "
        "dengan Chronos-2 sebagai pembanding.")
    L.gambar(g_omset, "Rata-rata meleset ramalan omset per pekan di ujian akhir. Garis putus: sasaran 5%", 15.5)
    L.p(f"Di simulasi, SARIMAX paling akurat ({_pr(o['simulasi']['uji']['sarimax']['mape'])}); sebagian keunggulannya karena "
        "simulasi dibuat dengan kalender yang sama dengan yang diberikan ke SARIMAX. Di toko roti sungguhan, Chronos-2 "
        f"paling akurat ({_pr(o['french_bakery']['uji']['chronos_2']['mape'])}), sudah di bawah sasaran 5%, tetapi baru diuji "
        f"selama {o['french_bakery']['uji']['chronos_2']['n_pekan']} pekan sehingga angka itu belum kuat. Chronos-2 juga "
        "dicoba dilatih ulang khusus dengan data toko roti; hasilnya membaik sedikit, dari "
        f"{_pr(ft['uji']['tanpa_finetune']['omset']['mape'])} menjadi {_pr(ft['uji']['finetune']['omset']['mape'])}, selisih "
        "yang terlalu kecil untuk dipastikan bukan kebetulan.")
    L.p(("Tentang sasaran 5%. ", "b"), "Sasaran ini sudah tercapai untuk omset toko roti, tetapi belum untuk pemakaian per "
        f"barang ({_pr(s['sarima_untuk_semua']['mape'])}). Penjualan satu barang di satu warung jauh lebih acak daripada omset "
        "seluruh warung: kalau hari ini kopi kurang laku, mungkin teh yang lebih laku, dan keduanya saling menutupi di "
        "omset. Makin besar yang dijumlahkan, makin kecil melesetnya. Sebagai pembanding luar, salah satu tim terbaik di "
        "kompetisi peramalan penjualan toko Rossmann melaporkan meleset sekitar 9,3% untuk omset harian per toko "
        "(Guo dan Berkhahn, 2016).")

    # ---- Mesin 2 -----------------------------------------------------------
    u, sim = A["ulang"], A["simulasi"]
    L.h2("2. Mesin 2: saran distributor")
    L.p(("Tugasnya. ", "b"), "Menyarankan ke distributor mana sebaiknya pemilik usaha memesan suatu barang. Jawabannya bisa "
        "berbeda menurut barang, besar pesanan, musim, dan jarak, sehingga tidak ada satu distributor yang selalu terbaik.")
    L.p(("Cara kerjanya. ", "b"), "Setiap distributor punya rapor: berapa pesanan yang berhasil (tepat waktu, jumlahnya "
        "sesuai, kondisinya baik) dan berapa yang gagal. Dari rapor itu sistem memperkirakan peluang distributor berhasil "
        "pada pesanan berikutnya. Distributor yang baru sedikit pesanannya punya perkiraan yang masih kabur, sehingga "
        "sesekali tetap diberi kesempatan agar sistem bisa mengenalnya; cara ini disebut Thompson sampling. Perkiraan "
        "keandalan lalu ditimbang dengan harga lewat sembilan aturan sederhana, misalnya “jika sangat andal dan harganya "
        "murah, maka sangat layak”. Cara menimbang dengan aturan seperti ini disebut logika fuzzy. Hasil akhirnya skor "
        "0 sampai 1 dan label sangat layak, layak, atau kurang layak.")
    L.p(("Cara menilainya. ", "b"), f"Simulasi dijalankan hari demi hari selama 400 hari, {_rb(sim['acuan']['keputusan'])} "
        "keputusan. Setiap kali memilih, hasilnya dibandingkan dengan distributor terbaik saat itu menurut kunci jawaban "
        "(bab I). Selisihnya disebut kerugian, lalu dijumlahkan; makin kecil makin baik. Karena ada unsur acak, simulasi "
        "diulang sepuluh kali.")
    L.gambar(g_m2, "Kerugian total tiap cara memilih distributor, rata-rata sepuluh ulangan. Garis kecil: sebaran antarulangan", 15.0)
    hk = {k: u[k]["harga"]["rata"] for k in ("greedy", "thompson+fuzzy (produksi)", "topsis")}
    L.p("Ada tiga temuan:")
    L.butir(("Memilih yang termurah justru merugikan. ", "b"), f"Kerugian per keputusannya "
            f"{_ak(sim['acuan']['termurah_regret'], 2)}, lebih buruk daripada memilih acak ({_ak(sim['acuan']['acak_regret'], 2)}). "
            "Ini dasar keberadaan Mesin 2, meskipun sebagian karena simulasi memang dirancang begitu.")
    L.butir(("Di simulasi ini, memilih rapor terbaik saja sudah paling baik. ", "b"), "Hanya ada delapan distributor dan "
            "rapornya dipakai bersama oleh 70 UMKM, sehingga dalam beberapa pekan semuanya sudah dikenal. Setelah itu "
            "“mencoba-coba” tidak lagi berguna.")
    L.butir(("Cara yang dipakai sengaja ikut menimbang harga. ", "b"), "Thompson + fuzzy sedikit lebih besar kerugiannya, "
            f"tetapi harga yang dibayar rata-rata {_ak(100 * (hk['thompson+fuzzy (produksi)'] - 1), 1)}% di atas distributor "
            f"termurah, dibanding {_ak(100 * (hk['greedy'] - 1), 1)}% bila hanya melihat rapor. Hasilnya tetap lebih baik daripada "
            "TOPSIS, metode peringkat berbobot yang umum dipakai untuk memilih pemasok.")
    L.p("Aturan fuzzy juga dibandingkan dengan rumus lurus yang paling sederhana (skor dikurangi selisih harga); hasilnya "
        "setara. Kelebihan fuzzy ada pada aturannya yang bisa dibaca seperti kalimat, sehingga pemilik usaha bisa diberi "
        "tahu alasan sebuah saran.")

    # ---- Mesin 3 -----------------------------------------------------------
    m3, e = A["m3"], A["m3eks"]
    L.h2("3. Mesin 3: profil pelanggan")
    L.p(("Tugasnya. ", "b"), "Membantu distributor mengenali pelanggannya: mana yang andal, mana yang baru, dan mana yang "
        "mulai jarang memesan. Mesin ini fitur pendukung di portal distributor.")
    L.p(("Cara kerjanya. ", "b"), "Setiap pelanggan dicirikan oleh kapan terakhir memesan, seberapa sering memesan, berapa "
        "nilai belanjanya, sudah berapa lama berlangganan, jenis usahanya, dan kategori barang yang paling sering dibeli. "
        "Ciri-ciri ini campuran angka dan kategori, sehingga dipakai K-Prototypes, metode pengelompokan yang bisa mengukur "
        "kemiripan untuk keduanya sekaligus. Nilai belanja dan frekuensi sangat timpang, karena beberapa pelanggan belanja "
        "jauh lebih banyak daripada yang lain, sehingga skalanya diperkecil dengan logaritma agar pelanggan besar tidak "
        "mendominasi. Jumlah kelompok (3 sampai 6) ditentukan per distributor, lalu tiap kelompok diberi nama dari cirinya.")
    seg = A["db"]["segmen"]
    L.p(f"Hasilnya, {m3['baris']} pelanggan di {m3['distributor']} distributor terbagi menjadi: "
        + ", ".join(f"{k.lower()} ({v})" for k, v in seg.items()) + ".")
    L.p(("Cara menilainya. ", "b"), "Kelompok pelanggan yang baik harus stabil: kalau sebagian pelanggan diambil acak lalu "
        "dikelompokkan ulang, hasilnya tetap sama. Uji ini diulang 100 kali; nilai 1 berarti selalu sama. Selain stabil, "
        "kelompoknya juga harus berguna, yaitu bisa memisahkan pelanggan yang mulai menjauh, dan tidak sekadar mengulang "
        "jenis usaha yang sebenarnya sudah diketahui distributor.")
    L.tabel("Perbandingan metode pengelompokan, rata-rata 8 distributor",
            ["Metode", "Kestabilan (0–1)", "Memisahkan pelanggan yang mulai menjauh (0–1)", "Kemiripan dengan jenis usaha (0–1)"], [
        ["K-Prototypes + logaritma (dipakai)", _ak(e["kprototypes_log"]["ari_rata"], 2), _ak(e["kprototypes_log"]["eta2_rata"]["recency"], 2), _ak(e["kprototypes_log"]["ari_jenis_usaha_rata"], 2)],
        ["K-Prototypes tanpa logaritma (sebelumnya)", _ak(e["kprototypes_produksi"]["ari_rata"], 2), _ak(e["kprototypes_produksi"]["eta2_rata"]["recency"], 2), _ak(e["kprototypes_produksi"]["ari_jenis_usaha_rata"], 2)],
        ["Pengelompokan bertingkat (jarak Gower)", _ak(e["gower_aglomeratif"]["ari_rata"], 2), _ak(e["gower_aglomeratif"]["eta2_rata"]["recency"], 2), _ak(e["gower_aglomeratif"]["ari_jenis_usaha_rata"], 2)],
        ["Pengelompokan berbasis kepadatan (HDBSCAN)", _ak(e["gower_hdbscan"]["ari_rata"], 2), _ak(e["gower_hdbscan"]["eta2_rata"]["recency"], 2), _ak(e["gower_hdbscan"]["ari_jenis_usaha_rata"], 2)],
    ], [5.6, 2.8, 3.8, 3.4])
    L.p("Dua metode pembanding memang lebih stabil, tetapi kelompoknya hampir sama dengan jenis usaha dan nyaris tidak "
        "bisa memisahkan pelanggan yang mulai menjauh. Bagi distributor, kelompok seperti itu tidak memberi informasi baru. "
        "Logaritma membuat K-Prototypes lebih stabil tanpa kehilangan kemampuan itu.")

    # ---- Kesimpulan --------------------------------------------------------
    L.h2("4. Kesimpulan: model yang digunakan")
    L.tabel("Model yang digunakan tiap mesin dan alasannya", ["Mesin", "Model yang digunakan", "Alasan"], [
        ["Mesin 1: perkiraan kebutuhan stok", "SARIMA, dengan ETS sebagai cadangan",
         f"Paling akurat bersama LightGBM ({_pr(s['sarima_untuk_semua']['mape'])}, ETS {_pr(s['ets_untuk_semua']['mape'])}), "
         f"rentangnya tepat sasaran ({_pr(100 * c['sarima']['cakupan_p10_p90'])} dari sasaran 80%), dan cara kerjanya bisa "
         "dijelaskan. ETS dipakai bila riwayat barang terlalu banyak yang kosong"],
        ["Mesin 2: saran distributor", "Rapor keandalan (Beta-Bernoulli) + Thompson sampling + logika fuzzy",
         f"Lebih baik daripada TOPSIS ({_rb(u['thompson+fuzzy (produksi)']['regret']['rata'])} melawan "
         f"{_rb(u['topsis']['regret']['rata'])}), ikut menimbang harga, dan alasannya bisa dibaca seperti kalimat. Thompson "
         "dipertahankan untuk distributor baru dan distributor yang mutunya berubah"],
        ["Mesin 3: profil pelanggan", "K-Prototypes dengan logaritma pada frekuensi dan nilai belanja",
         f"Satu-satunya kandidat yang langsung menangani angka dan kategori; kestabilan naik dari "
         f"{_ak(e['kprototypes_produksi']['ari_rata'], 2)} menjadi {_ak(e['kprototypes_log']['ari_rata'], 2)} dan tetap bisa "
         "memisahkan pelanggan yang mulai menjauh"],
    ], [3.6, 4.4, 7.6])
    L.p("Untuk Mesin 1, keputusan berpindah dari ETS ke SARIMA diambil setelah dua pengecekan: akurasi di ujian akhir dan "
        "ketepatan rentang perkiraannya, karena rentang itulah yang menentukan kapan pemilik usaha diminta memesan. Untuk "
        "Mesin 2, pilihan antara Thompson sampling dan pemilihan rapor terbaik ditunda sampai dataset memuat distributor "
        "yang baru bergabung dan distributor yang mutunya berubah, dua keadaan yang menjadi alasan Thompson dipakai tetapi "
        "belum ada di simulasi. Untuk Mesin 3, metode tetap K-Prototypes dan perbaikannya cukup pada cara menyiapkan data.")
    L.p("Ketiga hasil ini masih berasal dari data simulasi dan satu data toko roti. Langkah berikutnya adalah memperbaiki "
        "cacat dataset Bantul, menyambungkan kedua portal ke server, lalu menguji ketiga mesin dengan data warung sungguhan.")


# ==========================================================================
def ke_pdf(docx: Path) -> Path | None:
    """Perbarui daftar isi dan ekspor PDF lewat Microsoft Word (Windows saja)."""
    if sys.platform != "win32":
        return None
    pdf = docx.with_suffix(".pdf")
    ps = (
        "$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0; "
        f"try {{ $d = $w.Documents.Open('{docx}'); "
        "foreach ($t in $d.TablesOfContents) { $t.Update() }; $d.Fields.Update() | Out-Null; "
        "foreach ($t in $d.TablesOfContents) { $t.Update() }; $d.Save(); "
        f"$d.ExportAsFixedFormat('{pdf}', 17); $d.ComputeStatistics(2); $d.Close($false) }} finally {{ $w.Quit() }}"
    )
    h = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=600)
    if h.returncode != 0:
        print("Word gagal:", h.stderr.strip()[:400])
        return None
    print("Halaman:", h.stdout.strip())
    return pdf


def main() -> None:
    A = {
        "turnamen": _j("hasil_mesin1_turnamen.json"),
        "anggota": _j("hasil_mesin1_turnamen_anggota.json"),
        "cakupan": _j("hasil_eksperimen_mesin1_cakupan.json")["hasil"],
        "omset": _j("hasil_mesin1_turnamen_omset.json"),
        "finetune": _j("hasil_mesin1_turnamen_finetune.json"),
        "saringan": _j("hasil_mesin1_saringan.json"),
        "ulang": {b["nama"]: b for b in _j("hasil_eksperimen_mesin2_ulangan.json")["hasil"]},
        "simulasi": _j("hasil_simulasi_mesin2.json"),
        "m3": _j("hasil_mesin3.json"),
        "m3eks": _j("hasil_eksperimen_mesin3.json")["agregat"],
        "db": angka_db(),
    }
    # Abstrak dan tujuan memakai papan strategi pekan uji secara langsung.
    A_t = dict(A)
    A_t["turnamen"] = A["turnamen"]["uji"]["strategi"]
    g1, g2, g3 = grafik_mesin1()

    L = Laporan()
    sampul(L)
    daftar_isi(L)
    abstrak(L, A_t)
    perubahan(L)
    latar_belakang(L)
    rumusan(L)
    batasan(L)
    tujuan(L, A_t)
    arsitektur(L)
    tangkapan_layar(L)
    alur_erd(L, A)
    komponen(L)
    dataset(L, A)
    mesin(L, A, g1, g2, g3)

    # Nomor halaman di kaki, kecuali sampul.
    s = L.d.sections[0]
    s.different_first_page_header_footer = True
    kaki = s.footer.paragraphs[0]
    kaki.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _bidang(kaki, "PAGE", "1")
    berkas = L.simpan()
    print("Laporan: %s (%d gambar, %d tabel)" % (berkas, L.n_gambar, L.n_tabel))
    pdf = ke_pdf(berkas)
    if pdf:
        print("PDF:", pdf)


if __name__ == "__main__":
    main()
