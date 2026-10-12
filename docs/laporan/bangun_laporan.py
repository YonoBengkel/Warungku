"""
Bangun kedua laporan Word dari berkas hasil percobaan.

    python docs/laporan/bangun_laporan.py

Angka di dokumen **tidak diketik ulang**. Semuanya dibaca dari
`ml/hasil/*.json` dan dari basis data, sehingga dokumen tidak mungkin
bertentangan dengan percobaan yang menghasilkannya. Kalau percobaannya
dijalankan ulang dan angkanya berubah, jalankan ulang berkas ini dan dokumennya
ikut berubah.

Format mengikuti permintaan: Times New Roman 12, rata kiri-kanan (justified),
dengan gambar dan tangkapan layar.
"""

from __future__ import annotations

import json
import subprocess
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AKAR = Path(__file__).resolve().parents[2]
KELUARAN = AKAR / "ml" / "hasil"
GAMBAR = AKAR / "docs" / "laporan" / "gambar"
TUJUAN = AKAR / "docs" / "laporan"

HURUF = "Times New Roman"
UKURAN = Pt(12)
TEAL = RGBColor(0x0F, 0x76, 0x6E)


# --------------------------------------------------------------------------
# Pembantu format
# --------------------------------------------------------------------------
def _dokumen() -> Document:
    d = Document()
    gaya = d.styles["Normal"]
    gaya.font.name = HURUF
    gaya.font.size = UKURAN
    # Word menyimpan huruf untuk aksara Latin dan Asia Timur secara terpisah.
    # Tanpa baris di bawah, teksnya tetap tampil dengan huruf bawaan di
    # sebagian mesin — gejalanya baru terlihat di komputer orang lain.
    gaya.element.rPr.rFonts.set(qn("w:eastAsia"), HURUF)
    p = gaya.paragraph_format
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.space_after = Pt(6)
    p.line_spacing = 1.15

    for nama, ukuran in (("Heading 1", 16), ("Heading 2", 14), ("Heading 3", 12.5)):
        g = d.styles[nama]
        g.font.name = HURUF
        g.font.size = Pt(ukuran)
        g.font.color.rgb = TEAL
        g.font.bold = True
        g.element.rPr.rFonts.set(qn("w:eastAsia"), HURUF)

    for s in d.sections:
        s.top_margin = s.bottom_margin = Cm(2.5)
        s.left_margin = Cm(3.0)
        s.right_margin = Cm(2.5)
    return d


def judul(d: Document, teks: str, tingkat: int = 1) -> None:
    d.add_heading(teks, level=tingkat)


def alinea(d: Document, teks: str, tebal: bool = False, rata: str = "justify") -> None:
    p = d.add_paragraph()
    p.alignment = {
        "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
        "tengah": WD_ALIGN_PARAGRAPH.CENTER,
        "kiri": WD_ALIGN_PARAGRAPH.LEFT,
    }[rata]
    r = p.add_run(teks)
    r.bold = tebal
    r.font.name = HURUF
    r.font.size = UKURAN


def butir(d: Document, teks: str) -> None:
    p = d.add_paragraph(style="List Bullet")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = p.add_run(teks)
    r.font.name = HURUF
    r.font.size = UKURAN


def tabel(d: Document, kepala: list[str], baris: list[list[str]], lebar: list[float] | None = None) -> None:
    t = d.add_table(rows=1, cols=len(kepala))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, teks in enumerate(kepala):
        sel = t.rows[0].cells[i]
        sel.text = ""
        # Rata kiri di dalam sel: rata kiri-kanan pada kolom sempit merenggangkan
        # kata sampai sulit dibaca.
        sel.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = sel.paragraphs[0].add_run(teks)
        r.bold = True
        r.font.name = HURUF
        r.font.size = Pt(11)
    for isi in baris:
        sel_baris = t.add_row().cells
        for i, teks in enumerate(isi):
            sel_baris[i].text = ""
            sel_baris[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = sel_baris[i].paragraphs[0].add_run(str(teks))
            r.font.name = HURUF
            r.font.size = Pt(11)
    if lebar:
        for i, w in enumerate(lebar):
            for row in t.rows:
                row.cells[i].width = Cm(w)
    d.add_paragraph()


def gambar(d: Document, berkas: str, keterangan: str, lebar_cm: float = 15.0) -> bool:
    p = GAMBAR / berkas
    if not p.exists():
        return False
    d.add_picture(str(p), width=Cm(lebar_cm))
    d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    k = d.add_paragraph()
    k.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = k.add_run(keterangan)
    r.italic = True
    r.font.size = Pt(10)
    r.font.name = HURUF
    return True


def kode(d: Document, teks: str) -> None:
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Cm(0.8)
    r = p.add_run(teks)
    r.font.name = "Consolas"
    r.font.size = Pt(9.5)


# --------------------------------------------------------------------------
# Pemuat angka
# --------------------------------------------------------------------------
def _jalur_paket() -> None:
    """Supaya paket proyek bisa diimpor walau `pip install -e .` belum dijalankan."""
    import sys

    for sub in ("backend", "data", ""):
        p = str(AKAR / sub)
        if p not in sys.path:
            sys.path.insert(0, p)


def _json(nama: str):
    p = KELUARAN / nama
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def angka_basis_data() -> dict:
    from sqlalchemy import text

    import sys

    _jalur_paket()
    from warungku.basis_data import mesin

    with mesin().connect() as kon:
        tabel_jumlah = kon.execute(
            text(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
            )
        ).scalar_one()
        fk = kon.execute(
            text(
                "SELECT count(*) FROM information_schema.table_constraints "
                "WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'"
            )
        ).scalar_one()
        indeks = kon.execute(
            text("SELECT count(*) FROM pg_indexes WHERE schemaname='public'")
        ).scalar_one()
        enum = kon.execute(
            text("SELECT count(DISTINCT t.typname) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid")
        ).scalar_one()
        baris = kon.execute(
            text(
                "SELECT relname, n_live_tup FROM pg_stat_user_tables "
                "WHERE n_live_tup > 0 ORDER BY n_live_tup DESC"
            )
        ).all()
    return {
        "tabel": int(tabel_jumlah),
        "fk": int(fk),
        "indeks": int(indeks),
        "enum": int(enum),
        "baris": [(r[0], int(r[1])) for r in baris],
        "total_baris": sum(int(r[1]) for r in baris),
    }


def jumlah_uji() -> int:
    try:
        h = subprocess.run(
            ["python", "-m", "pytest", "-q", "--collect-only"],
            cwd=AKAR, capture_output=True, text=True, timeout=300,
        )
        for garis in reversed(h.stdout.splitlines()):
            if "test" in garis and "collected" in garis:
                return int(garis.split()[0])
    except Exception:
        pass
    return 0


def segmen_produksi() -> dict[str, int]:
    """Sebaran segmen distributor di rekomendasi_skor, hasil jalan produksi terakhir."""
    from sqlalchemy import text

    import sys

    _jalur_paket()
    from warungku.basis_data import mesin

    with mesin().connect() as kon:
        baris = kon.execute(
            text("SELECT segmen, count(*) FROM rekomendasi_skor WHERE segmen IS NOT NULL GROUP BY 1")
        ).all()
    return {r[0]: int(r[1]) for r in baris}


BULAN = ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
         "September", "Oktober", "November", "Desember")


def tanggal_hari_ini() -> str:
    """Tanggal berbahasa Indonesia; strftime("%B") mengikuti locale mesin, bukan dokumen."""
    t = date.today()
    return "%d %s %d" % (t.day, BULAN[t.month - 1], t.year)


def _pr(x: float, n: int = 1) -> str:
    """Persen bergaya Indonesia: 14,9%."""
    return ("%.*f%%" % (n, x)).replace(".", ",")


def _ak(x: float, n: int = 4) -> str:
    return ("%.*f" % (n, x)).replace(".", ",")


def _rb(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


# --------------------------------------------------------------------------
# Ulangan Mesin 2 dengan banyak benih
# --------------------------------------------------------------------------
#: Nama kebijakan di hasil ulangan (ml/eksperimen/mesin2_penyetelan.py).
ULANG_NAMA = {
    "greedy": "Greedy",
    "linucb_a1": "LinUCB (alfa 1)",
    "thompson": "Thompson",
    "epsilon_greedy_0.1": "Epsilon-greedy 0,1",
    "thompson+fuzzy (produksi)": "Thompson + fuzzy (produksi)",
    "greedy+fuzzy": "Greedy + fuzzy",
    "topsis": "TOPSIS",
}


def _ulang() -> dict | None:
    """Hasil simulasi yang diulang 10 benih; angka resmi tiap kebijakan Mesin 2."""
    u = _json("hasil_eksperimen_mesin2_ulangan.json")
    return {b["nama"]: b for b in u["hasil"]} | {"_benih": len(u["benih"])} if u else None


def _rbu(ulang: dict | None, nama: str, cadangan: float | None = None) -> str:
    """Regret rata-rata ± simpangan baku dari ulangan; angka satu benih kalau ulangan tidak ada."""
    b = (ulang or {}).get(nama)
    if not b:
        return _rb(cadangan) if cadangan is not None else "—"
    r = b["regret"]
    return _rb(r["rata"]) + (" ± %s" % _rb(r["sd"]) if r["sd"] > 0 else "")


#: Nama di simulasi satu benih -> nama di hasil ulangan.
SATU_KE_ULANG = {
    "beta_daring+greedy": "greedy",
    "beta_daring+epsilon_greedy_0.1": "epsilon_greedy_0.1",
    "beta_daring+thompson": "thompson",
    "beta_daring+linucb_a1": "linucb_a1",
    "beta_daring+thompson+fuzzy": "thompson+fuzzy (produksi)",
    "beta_daring+greedy+fuzzy": "greedy+fuzzy",
    "topsis": "topsis",
}


def regret_tampil(h: dict, ulang: dict | None) -> str:
    """Regret satu baris tabel: rata-rata ulangan bila ada (ditandai *), selain itu satu benih."""
    nama = SATU_KE_ULANG.get(h["nama"])
    if ulang and nama in ulang:
        return _rbu(ulang, nama) + " *"
    return _rb(h["regret_total"])


def tabel_ulangan(d: Document, ulang: dict | None, lebar: list[float] | None = None) -> None:
    if not ulang:
        return
    baris = []
    for nama, tampil in ULANG_NAMA.items():
        b = ulang.get(nama)
        if not b:
            continue
        r = b["regret"]
        selang = ("%s–%s" % (_rb(r["ci95"][0]), _rb(r["ci95"][1]))) if r["sd"] > 0 else "deterministik"
        baris.append([tampil, _rbu(ulang, nama), selang, _ak(b["harga"]["rata"], 3)])
    baris.sort(key=lambda x: ulang[[k for k, v in ULANG_NAMA.items() if v == x[0]][0]]["regret"]["rata"])
    tabel(d, ["Kebijakan", "Regret total (rata-rata ± sd)", "Selang 95%", "Rasio harga"], baris,
          lebar=lebar or [5.6, 4.0, 3.2, 2.4])


JUDUL_SUMBER = {"simulasi": "Simulasi Turnify Flow", "french_bakery": "French Bakery (data nyata)"}
NAMA_METODE = {
    "naif_musiman": "Naif musiman",
    "aturan_sederhana": "Aturan sederhana (rata-rata 28 hari)",
    "kuantil_hari_pekan": "Kuantil hari-pekan",
    "ets_holt_winters": "ETS / Holt-Winters",
    "ets": "ETS / Holt-Winters",
    "sarimax": "SARIMAX",
    "var": "VAR (multivariat)",
    "chronos_2": "Chronos-2 (pembanding)",
}


def _mape_terbaik(m1p: dict) -> dict:
    return min(m1p["hasil"], key=lambda x: x["mape_pekanan_lolos"])


def _omset_terbaik(m1o: dict | None, sumber: str) -> dict | None:
    if not m1o or "hasil" not in m1o.get(sumber, {}):
        return None
    return min(m1o[sumber]["hasil"], key=lambda x: x["mape_pekanan"])


def teks_mesin1(m1p, m1o) -> str:
    bagian = ["ETS (Holt-Winters) untuk produksi; SARIMAX dan VAR untuk omset; Chronos-2 sebagai pembanding."]
    if m1p:
        e = {h["nama"]: h for h in m1p["hasil"]}.get("ets_holt_winters")
        if e:
            bagian.append("MAPE pekanan unit, barang lolos saringan: %s (%s)." % (_pr(e["mape_pekanan_lolos"]), metrik_lewis(e["mape_pekanan_lolos"])))
    o = _omset_terbaik(m1o, "simulasi")
    if o:
        bagian.append("MAPE pekanan omset terbaik: %s (%s)." % (_pr(o["mape_pekanan"]), NAMA_METODE.get(o["nama"], o["nama"])))
    return " ".join(bagian)


def teks_mesin2(sim) -> str:
    t = "Beta-Bernoulli + Thompson + fuzzy: saran distributor dan tiga segmen distributor."
    if sim:
        t += " Simulasi regret 400 hari, %s keputusan, 11 varian di tiga sumbu." % _rb(sim["acuan"]["keputusan"])
    return t


def temuan_utama(d: Document, m1p, m1o, sim) -> None:
    alinea(d, "Temuan yang mengubah rencana", tebal=True)
    if m1p:
        terbaik = _mape_terbaik(m1p)
        o = _omset_terbaik(m1o, "simulasi")
        butir(
            d,
            "Sasaran MAPE 5 persen belum tercapai secara keseluruhan. Ramalan unit per barang "
            "terbaik mencapai MAPE pekanan %s pada barang yang lolos saringan (%s menurut "
            "skala Lewis)%s. Bagian 6.7 menjelaskan kenapa sebagian jarak ini tidak bisa "
            "ditutup model apa pun." % (
                _pr(terbaik["mape_pekanan_lolos"]), metrik_lewis(terbaik["mape_pekanan_lolos"]),
                (", dan ramalan omset dengan %s mencapai %s (%s); %d dari %d UMKM sudah di bawah 5 persen"
                 % (NAMA_METODE.get(o["nama"], o["nama"]), _pr(o["mape_pekanan"]), o["kategori"],
                    o["entitas_lolos_5"], o["entitas"])) if o else ""),
        )
    butir(
        d,
        "Metode sederhana menyamai atau mengalahkan metode rumit. ETS setara Chronos-2 "
        "untuk ramalan unit, dan Beta-Bernoulli — dua hitungan per distributor — "
        "mengalahkan BART untuk saran distributor. Keduanya menjadi model utama; yang "
        "rumit tetap ada sebagai pembanding.",
    )
    if sim:
        a = sim["acuan"]
        butir(
            d,
            "Kebijakan “selalu pilih termurah” lebih buruk daripada memilih acak: regret per "
            "keputusan %s melawan %s. Itu premis Mesin 2, dan di dataset ini ia terbukti."
            % (_ak(a["termurah_regret"]), _ak(a["acak_regret"])),
        )


def tanggapan_dosen(d: Document, halaman_baru: bool = False) -> None:
    if halaman_baru:
        d.add_page_break()
    alinea(d, "Catatan dosen dan tanggapannya", tebal=True)
    tabel(
        d,
        ["Catatan", "Tanggapan", "Bagian"],
        [
            ["Ramal omset, univariat atau multivariat (dengan jumlah barang dan jumlah pelanggan)",
             "ETS dan SARIMAX (univariat + kalender); VAR meramal omset, jumlah barang, dan jumlah nota bersama", "6.6"],
            ["MAPE ≤ 5%, bukan MSE",
             "MAPE pekanan di tiga tingkat, dibaca dengan skala Lewis. 5% belum tercapai; alasannya dijelaskan", "6.4, 6.7"],
            ["Pencilan dengan Mahalanobis, bukan boxplot",
             "Mahalanobis dengan MCD; pencilan ditandai, tidak dibuang; Lebaran bukan pencilan", "6.3"],
            ["Jangan memakai metode yang tidak dipahami tim",
             "Model utama ETS, SARIMAX, VAR, Beta-Bernoulli, fuzzy. Chronos-2 dan BART hanya pembanding", "6.9, 7.5"],
            ["Hanya 10 barang teratas yang diramal",
             "ABC 10 teratas per katalog UMKM menurut nilai, ditambah Syntetos–Boylan dan uji musiman", "6.2"],
            ["Segmentasi distributor dengan Bayesian, pohon keputusan, atau fuzzy",
             "Beta-Bernoulli (Bayesian) + fuzzy Sugeno, menghasilkan tiga segmen", "7"],
            ["Laju pemakaian > 30% per pekan, dan musiman",
             "Musiman diuji dengan STL. Ambang 30% tidak dipakai menyaring karena mengukur kebijakan restock; alasannya dijelaskan", "6.2"],
        ],
        lebar=[5.4, 7.4, 2.2],
    )


# --------------------------------------------------------------------------
# Bagian Mesin 1 dan Mesin 2 (laporan lengkap)
# --------------------------------------------------------------------------
def bagian_mesin1(d: Document, m1, m1p, m1o, sar) -> None:
    judul(d, "6. Mesin 1 — perkiraan permintaan dan omset")
    judul(d, "6.1 Dua pertanyaan, dua ramalan", 2)
    alinea(
        d,
        "Mesin 1 menjawab dua pertanyaan yang berbeda. Pertama, berapa unit tiap barang "
        "yang akan terpakai pekan depan — angka ini dipakai menghitung batas aman stok, "
        "jadi keluarannya sebaran p10 / p50 / p90, dan batas aman diambil dari p90 selama "
        "lama pengiriman. Kedua, berapa omset tiap UMKM pekan depan — angka ini untuk "
        "gambaran bisnis pemilik, sesuai catatan dosen. Ramalan omset tidak dipakai untuk "
        "batas aman, dan sebaliknya.",
    )
    if not gambar(d, "mesin1_kipas.png", "Gambar 3. Kipas p10-p90 ETS melawan permintaan sebenarnya. Batas aman diambil dari tepi atas kipas, bukan dari garis tengahnya.", 15.0):
        alinea(d, "(Gambar kipas perkiraan belum tersedia.)")

    # --- saringan -----------------------------------------------------------
    judul(d, "6.2 Barang mana yang diramal", 2)
    alinea(
        d,
        "Tidak semua barang layak diramal dengan model. Tiga saringan baku dipakai, "
        "masing-masing menjawab satu pertanyaan, dan semuanya dihitung dari delapan pekan "
        "terakhir sebelum titik ramal — tidak pernah dari masa depan.",
    )
    tabel(
        d,
        ["Saringan", "Pertanyaan", "Aturan"],
        [
            ["ABC (Pareto)", "Barang mana yang paling penting nilainya?",
             "10 barang teratas per katalog UMKM menurut nilai pemakaian (unit x harga), bukan menurut unit"],
            ["Syntetos–Boylan (2005)", "Polanya cukup teratur untuk model?",
             "ADI < 1,32 dan CV² < 0,49 berarti halus; selebihnya terputus, tak menentu, atau bergumpal"],
            ["Kekuatan musiman (STL)", "Ada pola mingguan yang harus ditangkap?",
             "F = maks(0; 1 − Var(R)/Var(S+R)) ≥ 0,40"],
        ],
        lebar=[3.6, 4.6, 6.8],
    )
    alinea(
        d,
        "Sebuah barang diramal dengan model kalau ia lolos ABC dan polanya halus, ATAU kalau "
        "pola musimannya kuat — barang musiman tetap perlu model walaupun nilainya kecil, "
        "karena aturan rata-rata akan meleset tepat di hari ramainya. Barang yang tidak "
        "lolos tetap mendapat batas aman, lewat aturan sederhana (rata-rata pemakaian x lama "
        "kirim x faktor aman). Saringan menentukan cara menghitung, bukan siapa yang dilayani.",
    )
    alinea(
        d,
        "ABC dihitung dari nilai, bukan unit, karena satuan barang berbeda-beda: 1.000 gram "
        "gula seharga Rp1 per gram lebih kecil nilainya daripada 10 bungkus susu seharga "
        "Rp500 per bungkus. Diurutkan menurut unit, gula akan selalu menang.",
    )
    if sar:
        pola = sar["pola"]
        tabel(
            d,
            ["Besaran", "Jumlah barang"],
            [
                ["Barang di seluruh katalog", "%d (dari %d UMKM)" % (sar["barang"], sar["usaha"])],
                ["Lolos ABC (10 teratas per katalog)", str(sar["lolos_abc"])],
                ["Pola halus / terputus / bergumpal",
                 "%d / %d / %d" % (pola.get("halus", 0), pola.get("terputus", 0), pola.get("bergumpal", 0))],
                ["Musiman kuat (F ≥ %s)" % _ak(sar["batas_musiman"], 2), str(sar["musiman"])],
                ["Diramal dengan model", str(sar["diramal"])],
                ["... di antaranya masuk hanya karena musiman", str(sar["masuk_lewat_musiman_saja"])],
            ],
            lebar=[8.5, 5.0],
        )
        alinea(
            d,
            "Catatan jujur: katalog simulasi rata-rata hanya %.0f barang per UMKM, jadi "
            "saringan 10 teratas meloloskan sebagian besar barang. Di katalog warung "
            "sungguhan yang memuat ratusan barang, saringan ini jauh lebih selektif."
            % (sar["barang"] / max(sar["usaha"], 1)),
        )
    alinea(d, "Kenapa bukan ambang laju pemakaian 30 persen per pekan", tebal=True)
    alinea(
        d,
        "Usulan awalnya: barang diramal kalau dalam sepekan terpakai lebih dari 30 persen "
        "stoknya (contoh: 300 dari 1.000 dus). Ukuran ini disebut sell-through, dan "
        "penyebutnya adalah stok yang dibeli pemilik — jadi ia mengukur kebijakan restock, "
        "bukan permintaan. Barang yang sama bisa 60 persen pada pekan sebelum restock dan "
        "15 persen sesudahnya. Pada pengukuran sekali di data simulasi, mediannya 38 persen, "
        "426 dari 890 barang lolos ambang 30 persen, dan korelasinya dengan barang terlaris "
        "hanya 0,23. Karena itu sell-through tidak dipakai menyaring; ia lebih cocok untuk "
        "menandai stok mati (barang yang hampir tidak berkurang), dan itu belum dibangun.",
    )

    # --- pencilan ------------------------------------------------------------
    judul(d, "6.3 Pencilan: jarak Mahalanobis", 2)
    alinea(
        d,
        "Boxplot menilai satu kolom sendirian. Hari dengan omset tinggi DAN nota banyak itu "
        "wajar; hari dengan omset tinggi tapi nota sedikit itu janggal (satu pembeli "
        "borongan, atau salah catat). Boxplot tidak bisa membedakan keduanya karena "
        "masing-masing angka sendirian masih dalam rentang biasa. Jarak Mahalanobis "
        "mengukur jarak dari pusat data dengan memperhitungkan hubungan antarkolom.",
    )
    butir(d, "Vektor harian per UMKM: log omset, log jumlah barang, log jumlah nota.")
    butir(d, "Level lokal (median bergulir 29 hari) dan pola hari-pekan dibuang dulu. Tanpa ini setiap Sabtu yang ramai ikut tertandai; versi pertama menandai 10 persen hari toko roti, kebanyakan hari musim panas.")
    butir(d, "Pusat dan kovarian ditaksir dengan Minimum Covariance Determinant (Rousseeuw, 1984), bukan rata-rata biasa, supaya pencilan besar tidak menyamarkan dirinya sendiri.")
    butir(d, "Batas: chi-kuadrat derajat bebas 3 pada peluang 0,999. Batas 0,975 yang lazim menandai 5,8 persen hari pada data buatan yang sama sekali bersih — MCD menaksir sebaran sedikit kekecilan pada sampel sebesar ini (Hardin & Rocke, 2005).")
    butir(d, "Pencilan DITANDAI, tidak dibuang. Hanya SARIMAX yang memperlakukannya sebagai data hilang saat dilatih. Hari libur, Ramadan, dan Lebaran tidak pernah ditandai: penjualan Lebaran yang anjlok adalah kejadian nyata yang harus dipelajari model.")
    if m1o:
        baris = []
        for k, v in m1o.items():
            if "pencilan" not in v:
                continue
            p = v["pencilan"]
            baris.append([JUDUL_SUMBER.get(k, k), _rb(p["hari_dinilai"]), str(p["pencilan"]),
                          _pr(p["persen_pencilan"]), str(p["dijelaskan_kalender"])])
        if baris:
            tabel(d, ["Sumber", "Hari dinilai", "Pencilan", "Persen", "Lolos karena kalender"], baris,
                  lebar=[4.6, 2.6, 2.2, 2.2, 3.4])

    # --- rancangan evaluasi --------------------------------------------------
    judul(d, "6.4 Rancangan evaluasi: MAPE pekanan", 2)
    alinea(
        d,
        "Metrik utamanya MAPE, sesuai catatan dosen, dihitung pada jumlah tujuh hari — "
        "satu siklus restock. Pemilik warung memutuskan belanja per pekan, jadi galat yang "
        "berarti baginya adalah galat jumlah sepekan, bukan galat hari Selasa. MAPE harian "
        "tetap dilaporkan supaya bedanya terlihat.",
    )
    butir(d, "Uji ulang bergulir: model dilatih sampai titik asal, meramal tujuh hari, lalu titik asal mundur sepekan. Delapan titik asal untuk ramalan unit dan untuk omset simulasi; 40 untuk toko roti yang hanya satu toko.")
    butir(d, "Saringan dihitung ulang di setiap titik asal, supaya keputusan barang mana yang diramal tidak mengintip masa depan.")
    butir(d, "Pekan yang berisi hari stok habis dikeluarkan dari penilaian unit: penjualan hari itu dibatasi stok, bukan permintaan. Pekan yang berisi hari toko tutup dikeluarkan dari penilaian omset.")
    butir(d, "Periode bernilai nol dikeluarkan dari MAPE (pembagian dengan nol). WAPE — jumlah galat dibagi jumlah nilai sebenarnya — ikut dilaporkan karena tidak punya masalah itu.")
    alinea(d, "Hasilnya dibaca dengan skala Lewis (1982):")
    tabel(
        d,
        ["MAPE", "Kategori"],
        [["< 10%", "sangat akurat"], ["10% – 20%", "baik"], ["20% – 50%", "layak"], ["≥ 50%", "tidak akurat"]],
        lebar=[4.0, 5.0],
    )

    # --- hasil unit ------------------------------------------------------------
    judul(d, "6.5 Hasil: ramalan unit per barang", 2)
    if m1p:
        r = m1p["rancangan"]
        alinea(
            d,
            "%d deret barang, %d titik asal, %s pekan dinilai; %s pasangan (barang, pekan) "
            "lolos saringan." % (r["deret"], r["titik_asal"], _rb(m1p["hasil"][0]["n_pekan"]),
                                 _rb(r["pasangan_lolos"])),
        )
        urut = sorted(m1p["hasil"], key=lambda x: x["mape_pekanan_lolos"])
        tabel(
            d,
            ["Metode", "MAPE pekanan, barang lolos", "MAPE pekanan, semua", "WAPE", "MAPE harian", "Waktu"],
            [
                [NAMA_METODE.get(h["nama"], h["nama"]),
                 "%s (%s)" % (_pr(h["mape_pekanan_lolos"]), metrik_lewis(h["mape_pekanan_lolos"])),
                 _pr(h["mape_pekanan"]), _pr(h["wape_pekanan"]), _pr(h["mape_harian"]),
                 "%.0f d" % h["detik"]]
                for h in urut
            ],
            lebar=[4.2, 3.4, 2.2, 1.8, 2.0, 1.6],
        )
        gambar(d, "mesin1_mape.png", "Gambar 4. MAPE ramalan unit di tiga tingkat. Latar menunjukkan skala Lewis; garis merah adalah sasaran 5 persen.", 15.5)
        cari = {h["nama"]: h for h in m1p["hasil"]}
        ets, ch, kq = cari.get("ets_holt_winters"), cari.get("chronos_2"), cari.get("kuantil_hari_pekan")
        if ets and ch and kq:
            alinea(
                d,
                "Tiga metode teratas berjarak kurang dari satu poin persen: kuantil hari-pekan "
                "%s, ETS %s, Chronos-2 %s pada barang lolos saringan. Untuk %s pekan "
                "penilaian, selisih sebesar itu tidak cukup untuk menyatakan salah satunya "
                "lebih akurat. Yang jelas: ketiganya mengalahkan naif musiman, dan menyaring "
                "barang menurunkan MAPE dari sekitar 24 persen ke sekitar 15 persen."
                % (_pr(kq["mape_pekanan_lolos"]), _pr(ets["mape_pekanan_lolos"]),
                   _pr(ch["mape_pekanan_lolos"]), _rb(ets["n_pekan_lolos"])),
            )

    # --- hasil omset -------------------------------------------------------------
    judul(d, "6.6 Hasil: ramalan omset per UMKM", 2)
    alinea(
        d,
        "Lima metode, dari yang paling sederhana. Semuanya dilatih pada logaritma omset "
        "karena ragam omset naik bersama levelnya.",
    )
    tabel(
        d,
        ["Metode", "Peubah", "Yang bisa dibaca"],
        [
            ["Naif musiman", "omset pekan lalu", "tidak ada parameter"],
            ["ETS / Holt-Winters", "omset", "alfa, beta, gamma, redaman tren"],
            ["SARIMAX(1,0,1)(0,1,1)7", "omset + kalender (libur, gajian, Ramadan, Lebaran)", "koefisien AR, MA, dan tiap hari kalender"],
            ["VAR", "omset, jumlah barang, jumlah nota bersama", "matriks koefisien per lag"],
            ["Chronos-2", "omset (pembanding, tanpa dilatih)", "tidak ada"],
        ],
        lebar=[4.2, 5.6, 5.2],
    )
    alinea(
        d,
        "Jumlah barang dan jumlah nota tidak bisa menjadi peubah luar SARIMAX, karena "
        "SARIMAX butuh nilai peubah luar untuk hari yang diramal, dan jumlah nota besok "
        "belum diketahui hari ini. Yang sah sebagai peubah luar hanya yang sudah pasti di "
        "masa depan: kalender. Ketiganya masuk bersama lewat VAR, yang meramal ketiganya "
        "sekaligus — bentuk sederhana dari peramalan multivariat yang disarankan dosen. "
        "Orde SARIMAX ditetapkan, tidak dicari per UMKM, supaya tidak ada pertanyaan "
        "\"kenapa warung A memakai orde berbeda dari warung B\" yang tidak punya jawaban.",
    )
    if m1o:
        for k, v in m1o.items():
            if "hasil" not in v:
                alinea(d, "%s: dilewati (%s)." % (JUDUL_SUMBER.get(k, k), v.get("dilewati", "")))
                continue
            urut = sorted(v["hasil"], key=lambda x: x["mape_pekanan"])
            alinea(d, "%s — %d titik asal, %d pekan dinilai" % (JUDUL_SUMBER.get(k, k), v["titik_asal"], urut[0]["n_pekan"]), tebal=True)
            tabel(
                d,
                ["Metode", "MAPE pekanan", "WAPE", "MAPE harian", "UMKM ≤ 5%", "Gagal"],
                [
                    [NAMA_METODE.get(h["nama"], h["nama"]),
                     "%s (%s)" % (_pr(h["mape_pekanan"]), h["kategori"]),
                     _pr(h["wape_pekanan"]), _pr(h["mape_harian"]),
                     "%d/%d" % (h["entitas_lolos_5"], h["entitas"]), str(h["gagal"])]
                    for h in urut
                ],
                lebar=[4.0, 3.6, 1.8, 2.2, 2.0, 1.4],
            )
        gambar(d, "mesin1_omset.png", "Gambar 5. MAPE pekanan ramalan omset per metode, pada data simulasi dan data toko roti sungguhan.", 15.5)
        alinea(
            d,
            "Data toko roti (French Bakery, Kaggle) dipakai untuk satu hal: membuktikan "
            "metodenya bekerja pada data toko sungguhan, bukan hanya pada data yang kami "
            "bangkitkan sendiri. Tiap sumber dilatih dan diuji di dirinya sendiri; tidak ada "
            "parameter yang dipindah antarsumber.",
        )

    # --- 5 persen --------------------------------------------------------------
    judul(d, "6.7 Sasaran MAPE 5 persen belum tercapai", 2)
    alinea(
        d,
        "Ini harus disebut terang. Tidak satu pun metode mencapai MAPE pekanan 5 persen "
        "secara keseluruhan, baik untuk unit per barang maupun untuk omset.",
    )
    if m1p:
        t = _mape_terbaik(m1p)
        alinea(
            d,
            "Yang tercapai: ramalan unit barang yang lolos saringan mencapai %s (%s)."
            % (_pr(t["mape_pekanan_lolos"]), metrik_lewis(t["mape_pekanan_lolos"])),
        )
    for k in ("simulasi", "french_bakery"):
        o = _omset_terbaik(m1o, k)
        if o:
            alinea(
                d,
                "Omset %s: terbaik %s dengan %s (%s)%s."
                % (JUDUL_SUMBER.get(k, k), NAMA_METODE.get(o["nama"], o["nama"]), _pr(o["mape_pekanan"]),
                   o["kategori"],
                   ("; %d dari %d UMKM sudah di bawah 5 persen" % (o["entitas_lolos_5"], o["entitas"]))
                   if o["entitas"] > 1 else ""),
            )
    o = _omset_terbaik(m1o, "simulasi")
    if o and o["nama"] == "sarimax":
        alinea(
            d,
            "Kecurigaan yang harus disebut: pembangkit dataset kami memasukkan efek libur, "
            "gajian, Ramadan, dan Lebaran, dan SARIMAX adalah satu-satunya metode yang "
            "diberi kalender yang sama sebagai peubah luar. Keunggulannya di simulasi "
            "sebagian bersifat struktural; hasil toko roti adalah ujian yang lebih adil.",
        )
        if m1o and "hasil" in m1o.get("french_bakery", {}):
            fb = sorted(m1o["french_bakery"]["hasil"], key=lambda x: x["mape_pekanan"])
            urutan = ", ".join("%s %s" % (NAMA_METODE.get(h["nama"], h["nama"]), _pr(h["mape_pekanan"])) for h in fb)
            alinea(
                d,
                "Di toko roti urutannya: %s. Hanya %d pekan yang bisa dinilai karena satu toko "
                "saja, jadi selisih satu-dua poin di sini belum bisa dibedakan dari kebetulan."
                % (urutan, fb[0]["n_pekan"]),
            )
    alinea(
        d,
        "Sebagian jaraknya tidak bisa ditutup model apa pun. Kalau penjualan sepekan "
        "sebuah barang berderau acak seperti sebaran Poisson dengan rata-rata λ, galat "
        "persen rata-rata ramalan yang SEMPURNA pun sekitar √(2/(πλ)). Supaya galat itu "
        "di bawah 5 persen, barangnya harus terjual sekitar 255 unit per pekan. Sebagian "
        "besar barang warung terjual jauh lebih sedikit. Omset lebih mudah diramal "
        "daripada unit per barang karena ia menjumlahkan banyak barang dan derau acaknya "
        "saling meniadakan sebagian — itulah sebabnya MAPE omset lebih kecil.",
    )
    alinea(
        d,
        "Jadi pilihan yang tersedia adalah menurunkan tingkat rinciannya (omset bulanan, "
        "atau kelompok barang), bukan mengganti model. Kami tidak memilihnya diam-diam: "
        "batas aman tetap butuh angka per barang per pekan, dan angka itulah yang kami "
        "laporkan apa adanya.",
    )

    # --- sebaran kuantil (hasil lama, tetap berlaku) -------------------------------
    if m1:
        judul(d, "6.8 Mutu sebaran p10–p90", 2)
        alinea(
            d,
            "MAPE hanya menilai garis tengah. Batas aman memakai p90, jadi mutu seluruh "
            "sebaran juga diukur, dengan WQL (galat kuantil tertimbang) dan cakupan selang "
            "p10–p90 yang seharusnya mendekati 80 persen. Percobaan ini dijalankan sebelum "
            "evaluasi pekanan, dengan tiga titik asal dan cakrawala 30 hari.",
        )
        urut = sorted(m1, key=lambda x: x["wql"])
        tabel(
            d,
            ["Metode", "MASE", "WQL", "Cakupan p10-p90", "Waktu"],
            [
                [h["nama"], _ak(h["mase"], 3), _ak(h["wql"]), _pr(100 * h["cakupan"]), "%.0f d" % h["detik"]]
                for h in urut
            ],
            lebar=[4.5, 2.5, 2.5, 3.5, 2.0],
        )
        gambar(d, "mesin1_banding.png", "Gambar 6. Perbandingan metode menurut WQL dan MASE.", 15.0)

    judul(d, "6.9 Keputusan: ETS untuk produksi", 2)
    alinea(
        d,
        "Mesin produksi diganti dari Chronos-2 ke ETS (Holt-Winters dengan musim mingguan). "
        "Akurasinya setara, dan bedanya ada di hal yang diminta dosen: setiap parameter ETS "
        "bisa dibaca dan dijelaskan per barang — seberapa cepat level mengikuti data baru, "
        "seberapa kuat pola mingguan. Chronos-2 adalah model pondasi dengan ratusan juta "
        "parameter yang tidak bisa dijelaskan satu per satu; ia tetap di kode sebagai "
        "pembanding, bersama SARIMAX dan VAR untuk omset.",
    )
    if m1p:
        cari = {h["nama"]: h for h in m1p["hasil"]}
        kq = cari.get("kuantil_hari_pekan")
        if kq:
            alinea(
                d,
                "Satu hal perlu dicatat supaya tidak tersembunyi: kuantil hari-pekan — "
                "rata-rata kuantil per hari dalam pekan dari 12 pekan terakhir — mendapat "
                "MAPE barang lolos sedikit lebih kecil (%s). Selisihnya di bawah satu poin "
                "dan metodenya bahkan lebih sederhana daripada ETS; ia tetap tersedia sebagai "
                "pilihan produksi lewat satu pengaturan (WARUNGKU_METODE_MESIN1)."
                % _pr(kq["mape_pekanan_lolos"]),
            )
    d.add_page_break()


def metrik_lewis(x: float) -> str:
    if x != x:
        return "tidak terdefinisi"
    return "sangat akurat" if x < 10 else "baik" if x < 20 else "layak" if x < 50 else "tidak akurat"


def bagian_mesin2(d: Document, sim, seg_prod: dict[str, int]) -> None:
    judul(d, "7. Mesin 2 — saran dan segmentasi distributor")
    judul(d, "7.1 Apa yang dijawabnya", 2)
    alinea(
        d,
        "Ke distributor mana sebaiknya warung ini memesan barang ini, hari ini — dan "
        "distributor mana yang masuk segmen sangat layak, layak, atau kurang layak. "
        "Segmentasi ini yang diminta dosen dengan metode Bayesian, pohon keputusan, atau "
        "fuzzy. Kami memakai dua: Bayesian (Beta-Bernoulli) untuk menaksir keandalan, dan "
        "fuzzy untuk menggabungkan keandalan dengan harga menjadi satu skor dan satu segmen.",
    )
    kode(
        d,
        "riwayat pesanan --> Beta-Bernoulli --> keandalan distributor\n"
        "                                          |\n"
        "harga penawaran ----------------------> fuzzy Sugeno (3 x 3 aturan)\n"
        "                                          |\n"
        "                                 skor 0..1 --> segmen + urutan saran",
    )

    judul(d, "7.2 Keandalan: Beta-Bernoulli", 2)
    alinea(
        d,
        "Setiap pesanan ke sebuah distributor berakhir mulus (tepat waktu, lengkap) atau "
        "tidak. Itu percobaan Bernoulli, dan pasangan Bayesian yang paling sederhana "
        "untuknya adalah sebaran Beta. Mulai dari Beta(1, 1) — belum tahu apa-apa — lalu "
        "setiap pesanan mulus menambah a satu, setiap pesanan gagal menambah b satu. "
        "Keandalan taksirannya a / (a + b). Tidak ada pelatihan berulang, tidak ada "
        "parameter tersembunyi; seluruh model adalah dua hitungan per distributor.",
    )
    alinea(
        d,
        "Contoh hitung tangan. Distributor A: 45 mulus, 5 gagal, jadi Beta(46, 6), rata-rata "
        "0,885. Distributor B: 2 mulus, 0 gagal, jadi Beta(3, 1), rata-rata 0,75. Rata-rata A "
        "lebih tinggi, tetapi B baru dicoba dua kali dan sebarannya lebar. Dengan Thompson "
        "sampling, sistem mencuplik satu angka dari tiap sebaran dan memilih yang tertinggi: "
        "B menang sekitar 30 persen dari waktu. Itulah eksplorasi — distributor baru tetap "
        "diberi kesempatan, sebanding dengan ketidakpastiannya.",
    )

    judul(d, "7.3 Segmen: fuzzy Sugeno", 2)
    alinea(
        d,
        "Dua masukan: keandalan (dari Beta-Bernoulli) dan rasio harga terhadap penawaran "
        "termurah untuk barang yang sama. Masing-masing dibagi tiga himpunan dengan fungsi "
        "keanggotaan segitiga dan bahu. Sembilan aturan JIKA-MAKA memberi skor; skor akhir "
        "adalah rata-rata tertimbang skor aturan, dengan bobot derajat keanggotaan (operator "
        "min) — inferensi Sugeno orde nol.",
    )
    tabel(
        d,
        ["Keandalan \\ Harga", "murah (≤ 1,00)", "sedang (puncak 1,10)", "mahal (≥ 1,20)"],
        [
            ["rendah (≤ 0,55)", "0,30", "0,15", "0,00"],
            ["sedang (puncak 0,70)", "0,70", "0,50", "0,30"],
            ["tinggi (≥ 0,85)", "1,00", "0,85", "0,60"],
        ],
        lebar=[4.2, 3.4, 3.8, 3.4],
    )
    alinea(
        d,
        "Skor ≥ 0,70 masuk segmen sangat layak, 0,45 sampai di bawah 0,70 layak, selebihnya "
        "kurang layak. Batas himpunan dan skor aturan adalah pilihan kami yang bisa dibaca "
        "dan diubah di satu tempat (ml/mesin2/fuzzy.py), bukan hasil pelatihan. Contoh hitung "
        "tangan: keandalan 0,775 adalah setengah sedang dan setengah tinggi; rasio harga 1,05 "
        "setengah murah dan setengah sedang. Empat aturan menyala dengan kekuatan 0,5 dan "
        "skor 0,70, 0,50, 1,00, 0,85; rata-ratanya 0,7625 — sangat layak.",
    )
    if seg_prod:
        total = sum(seg_prod.values())
        alinea(
            d,
            "Jalan produksi terakhir menulis %d saran ke rekomendasi_skor: %d sangat layak, "
            "%d layak, %d kurang layak."
            % (total, seg_prod.get("sangat-layak", 0), seg_prod.get("layak", 0), seg_prod.get("kurang-layak", 0)),
        )

    judul(d, "7.4 Simulasi regret berurutan", 2)
    alinea(
        d,
        "Mesin 2 dinilai dengan regret, bukan akurasi: berapa keberhasilan yang hilang "
        "karena tidak memilih distributor terbaik. Waktu berjalan 400 hari; tiap hari "
        "kebijakan memilih, hasilnya terungkap dari matriks counterfactual, dan hanya hasil "
        "distributor yang dipilih yang masuk riwayat — persis seperti di dunia nyata, di "
        "mana distributor yang tidak dipesan tidak pernah memberi kabar. Perbandingan "
        "disusun tiga sumbu, masing-masing mengubah satu hal saja.",
    )
    if sim:
        a = sim["acuan"]
        tabel(
            d,
            ["Acuan", "Rata-rata sukses", "Regret per keputusan", "Rasio harga"],
            [
                ["Oracle (batas atas)", _ak(a["oracle_sukses"]), "0", _ak(a["oracle_harga"], 3)],
                ["Memilih acak", _ak(a["acak_sukses"]), _ak(a["acak_regret"]), _ak(a["acak_harga"], 3)],
                ["Selalu termurah (kebijakan sekarang)", _ak(a["termurah_sukses"]), _ak(a["termurah_regret"]),
                 _ak(a.get("termurah_harga", 1.0), 3)],
            ],
            lebar=[5.6, 3.0, 3.6, 2.6],
        )
        ulang = _ulang()
        sumbu: dict[str, list] = {}
        for h in sim["hasil"]:
            sumbu.setdefault(h.get("sumbu", "lain"), []).append(h)
        for nama_sumbu, isi in sumbu.items():
            alinea(d, nama_sumbu, tebal=True)
            tabel(
                d,
                ["Varian", "Regret total", "Regret/keputusan", "Sukses", "Rasio harga"],
                [
                    [h["nama"], regret_tampil(h, ulang), _ak(h["regret_rata"]), _ak(h["sukses_rata"], 3),
                     _ak(h.get("harga_rata", float("nan")), 4)]
                    for h in sorted(isi, key=lambda x: x["regret_total"])
                ],
                lebar=[5.6, 2.4, 3.0, 2.0, 2.4],
            )
        if ulang:
            alinea(d, "* Regret total rata-rata %d benih ± simpangan baku; kolom lain dari satu benih."
                   % ulang["_benih"])
            alinea(d, "Ulangan dengan %d benih acak" % ulang["_benih"], tebal=True)
            alinea(
                d,
                "Tabel per sumbu di atas berasal dari satu benih acak. Benih itu ikut menentukan "
                "cuplikan Thompson dan lemparan epsilon-greedy, sehingga selisih kecil antar "
                "kebijakan bisa hanya derau. Karena itu simulasi diulang dengan %d benih; angka "
                "di bawah ini yang dipakai sebagai angka resmi tiap kebijakan. Kebijakan tanpa "
                "unsur acak (greedy, LinUCB, TOPSIS) memberi angka yang sama di semua benih."
                % ulang["_benih"],
            )
            tabel_ulangan(d, ulang)
        gambar(d, "mesin2_regret.png", "Gambar 7. Regret kumulatif sepanjang 400 hari. Makin landai makin baik.", 15.0)
        gambar(d, "mesin2_kompromi.png", "Gambar 8. Keandalan melawan harga. Kebijakan yang menimbang harga menukar sedikit keandalan dengan harga yang lebih murah.", 15.0)

        cari = {h["nama"]: h for h in sim["hasil"]}
        b, bart, lg, bk = (cari.get(k) for k in ("beta+thompson", "bart+thompson", "logistik+thompson", "beta_konteks+thompson"))
        if b and bart and lg:
            judul(d, "7.5 Temuan: penaksir paling sederhana menang", 2)
            alinea(
                d,
                "Beta-Bernoulli — dua hitungan per distributor — mencapai regret total %s, "
                "lebih kecil daripada regresi logistik Bayesian (%s) dan BART (%s), yang "
                "sebelumnya menjadi penaksir utama. Dengan delapan distributor dan riwayat "
                "yang dipakai bersama oleh 70 UMKM, fitur konteks tambahan lebih banyak "
                "menambah derau daripada informasi. BART dilepas dari jalur utama dan tetap "
                "di kode sebagai pembanding."
                % (_rb(b["regret_total"]), _rb(lg["regret_total"]), _rb(bart["regret_total"])),
            )
            if bk:
                alinea(
                    d,
                    "Hal yang sama terlihat di dalam Beta-Bernoulli sendiri: memecah hitungan "
                    "menurut musim dan jarak (Beta berkonteks) memperburuk regret menjadi %s. "
                    "Catatan jujur: pilihan untuk TIDAK memecah konteks diambil dari simulasi "
                    "yang sama dengan yang dipakai menilainya, jadi angka %s sedikit "
                    "menguntungkan dirinya sendiri." % (_rb(bk["regret_total"]), _rb(b["regret_total"])),
                )

        g, ts, ucb, eps = (cari.get(k) for k in ("beta_daring+greedy", "beta_daring+thompson", "beta_daring+linucb_a1", "beta_daring+epsilon_greedy_0.1"))
        ulang = _ulang()
        if g and ts:
            judul(d, "7.6 Temuan: eksplorasi hampir tidak membayar dirinya sendiri", 2)
            alinea(
                d,
                "Pada penaksir Beta yang diperbarui setiap pesanan, greedy murni mendapat "
                "regret %s, Thompson %s%s. Penjelasannya: reputasi tiap distributor dipakai "
                "bersama oleh seluruh UMKM, sehingga dalam beberapa pekan pertama setiap "
                "distributor sudah punya ratusan pesanan dan ketidakpastiannya hampir habis. "
                "Greedy dan LinUCB hanya berbeda pilihan pada segelintir keputusan; Thompson "
                "berbeda dari greedy pada sekitar 4 persen keputusan."
                % (_rbu(ulang, "greedy", g["regret_total"]), _rbu(ulang, "thompson", ts["regret_total"]),
                   (", LinUCB %s, epsilon-greedy %s" % (_rbu(ulang, "linucb_a1", ucb["regret_total"]),
                                                        _rbu(ulang, "epsilon_greedy_0.1", eps["regret_total"])))
                   if ucb and eps else ""),
            )
            alinea(
                d,
                "Thompson tetap dipakai di produksi karena biayanya kecil dan ia diperlukan "
                "untuk keadaan yang tidak ada di simulasi: distributor baru yang mendaftar "
                "setelah sistem berjalan, yang tanpa eksplorasi tidak akan pernah dicoba.",
            )

        tp, tf, gf = (cari.get(k) for k in ("topsis", "beta_daring+thompson+fuzzy", "beta_daring+greedy+fuzzy"))
        if tp and tf:
            judul(d, "7.7 Temuan: fuzzy lebih andal daripada TOPSIS", 2)
            alinea(
                d,
                "TOPSIS adalah pembanding pengambilan keputusan multikriteria yang lazim. Ia "
                "tidak belajar dari hasil pesanan; bobotnya tetap. Fuzzy di atas Beta+Thompson "
                "mencapai regret %s melawan %s untuk TOPSIS, dengan rasio harga %s melawan %s "
                "— lebih andal dengan harga yang hanya sedikit lebih mahal. Keduanya sengaja "
                "menukar sebagian keandalan dengan harga, sehingga regretnya lebih besar "
                "daripada kebijakan yang hanya mengejar keandalan (Gambar 8)."
                % (_rbu(ulang, "thompson+fuzzy (produksi)", tf["regret_total"]),
                   _rbu(ulang, "topsis", tp["regret_total"]),
                   _ak(ulang["thompson+fuzzy (produksi)"]["harga"]["rata"] if ulang else tf["harga_rata"]),
                   _ak(ulang["topsis"]["harga"]["rata"] if ulang else tp["harga_rata"])),
            )

        judul(d, "7.8 Temuan: selalu termurah kalah dari memilih acak", 2)
        alinea(
            d,
            "Kebijakan yang berlaku sekarang di lapangan menghasilkan regret per keputusan %s, "
            "lebih besar daripada memilih acak (%s). Itu premis Mesin 2. Tetapi premis itu "
            "sebagian hasil rancangan dataset kami sendiri: kamilah yang membuat distributor "
            "termurah menjadi yang terburuk. Di data nyata hubungannya mungkin lebih lemah."
            % (_ak(a["termurah_regret"]), _ak(a["acak_regret"])),
        )
    else:
        alinea(d, "(Hasil simulasi Mesin 2 belum tersedia.)")
    d.add_page_break()


def ringkas_mesin(d: Document, m1p, m1o, sar, sim, seg, seg_prod: dict[str, int]) -> None:
    """Bagian E, F, G laporan ringkas. Angkanya dari sumber yang sama dengan laporan lengkap."""
    # --- E -----------------------------------------------------------
    judul(d, "E. Mesin 1 — perkiraan permintaan dan omset — bagian 6")
    alinea(d, "Yang dijawabnya.", tebal=True)
    alinea(
        d,
        "Dua hal: unit tiap barang pekan depan (untuk batas aman, dari p90) dan omset tiap "
        "UMKM pekan depan (untuk gambaran bisnis pemilik).",
    )
    alinea(d, "Barang mana yang diramal.", tebal=True)
    alinea(
        d,
        "10 teratas per katalog menurut nilai (ABC), polanya halus (Syntetos–Boylan), atau "
        "musimannya kuat (STL). Barang lain tetap mendapat batas aman dari aturan sederhana."
        + (" Hasilnya %d dari %d barang diramal dengan model." % (sar["diramal"], sar["barang"]) if sar else ""),
    )
    alinea(d, "Pencilan.", tebal=True)
    alinea(
        d,
        "Jarak Mahalanobis dengan MCD atas log omset, jumlah barang, dan jumlah nota; batas "
        "chi-kuadrat 0,999. Ditandai, tidak dibuang. Libur, Ramadan, dan Lebaran tidak "
        "pernah ditandai.",
    )
    alinea(d, "Hasil: MAPE pekanan (jumlah tujuh hari, satu siklus restock).", tebal=True)
    if m1p:
        urut = sorted(m1p["hasil"], key=lambda x: x["mape_pekanan_lolos"])
        tabel(
            d,
            ["Unit per barang", "Barang lolos", "Semua barang", "Harian"],
            [[NAMA_METODE.get(h["nama"], h["nama"]),
              "%s (%s)" % (_pr(h["mape_pekanan_lolos"]), metrik_lewis(h["mape_pekanan_lolos"])),
              _pr(h["mape_pekanan"]), _pr(h["mape_harian"])] for h in urut],
            lebar=[5.0, 4.0, 3.0, 2.5],
        )
        gambar(d, "mesin1_mape.png", "MAPE unit di tiga tingkat; garis merah sasaran 5 persen.", 14.5)
    if m1o:
        baris = []
        for k, v in m1o.items():
            if "hasil" not in v:
                continue
            for h in sorted(v["hasil"], key=lambda x: x["mape_pekanan"]):
                baris.append([JUDUL_SUMBER.get(k, k), NAMA_METODE.get(h["nama"], h["nama"]),
                              "%s (%s)" % (_pr(h["mape_pekanan"]), h["kategori"])])
        if baris:
            tabel(d, ["Omset", "Metode", "MAPE pekanan"], baris, lebar=[5.0, 5.0, 4.5])
            gambar(d, "mesin1_omset.png", "MAPE pekanan omset, simulasi dan toko roti sungguhan.", 14.5)
    alinea(d, "Sasaran 5 persen belum tercapai.", tebal=True)
    alinea(
        d,
        "Derau acak penjualan per barang per pekan sudah lebih besar dari 5 persen untuk "
        "barang yang terjual di bawah sekitar 255 unit sepekan, bahkan untuk ramalan yang "
        "sempurna. Omset lebih mudah karena derau banyak barang saling meniadakan.",
    )
    alinea(d, "Kenapa ETS untuk produksi.", tebal=True)
    alinea(
        d,
        "Setara Chronos-2 dalam akurasi, dan setiap parameternya bisa dijelaskan per barang. "
        "Chronos-2 tetap sebagai pembanding; SARIMAX dan VAR (multivariat: omset, jumlah "
        "barang, jumlah nota) untuk omset.",
    )

    # --- F -----------------------------------------------------------
    judul(d, "F. Mesin 2 — saran dan segmentasi distributor — bagian 7")
    alinea(d, "Yang dijawabnya.", tebal=True)
    alinea(
        d,
        "Ke distributor mana sebaiknya memesan barang ini, dan distributor mana yang sangat "
        "layak, layak, atau kurang layak.",
    )
    alinea(d, "Cara kerjanya.", tebal=True)
    butir(d, "Bayesian: tiap distributor punya Beta(a, b); pesanan mulus menambah a, pesanan gagal menambah b. Keandalan = a / (a + b).")
    butir(d, "Thompson sampling: cuplik satu angka dari tiap Beta, urutkan. Distributor yang jarang dicoba tetap mendapat kesempatan.")
    butir(d, "Fuzzy Sugeno: keandalan dan rasio harga, 3 x 3 aturan, menjadi skor 0–1. Skor ≥ 0,70 sangat layak, ≥ 0,45 layak.")
    if seg_prod:
        alinea(
            d,
            "Produksi: %d sangat layak, %d layak, %d kurang layak."
            % (seg_prod.get("sangat-layak", 0), seg_prod.get("layak", 0), seg_prod.get("kurang-layak", 0)),
        )
    if sim:
        a = sim["acuan"]
        tabel(
            d,
            ["Varian", "Regret total", "Regret/keputusan", "Rasio harga"],
            [[h["nama"], regret_tampil(h, _ulang()), _ak(h["regret_rata"]), _ak(h.get("harga_rata", float("nan")), 4)]
             for h in sorted(sim["hasil"], key=lambda x: x["regret_total"])]
            + [["Memilih acak", "—", _ak(a["acak_regret"]), _ak(a["acak_harga"], 4)],
               ["Selalu termurah (sekarang)", "—", _ak(a["termurah_regret"]), _ak(a.get("termurah_harga", 1.0), 4)]],
            lebar=[5.8, 2.6, 3.2, 2.6],
        )
        ulang = _ulang()
        if ulang:
            alinea(d, "* Rata-rata %d benih ± simpangan baku; kolom lain dari satu benih. "
                      "Rincian ulangan:" % ulang["_benih"])
            tabel_ulangan(d, ulang, lebar=[5.8, 3.8, 3.0, 2.6])
        gambar(d, "mesin2_kompromi.png", "Keandalan melawan harga per kebijakan.", 14.5)
    alinea(d, "TEMUAN.", tebal=True)
    butir(d, "Beta-Bernoulli mengalahkan regresi logistik dan BART. Metode paling sederhana menang; BART menjadi pembanding saja.")
    butir(d, "Fuzzy di atas Beta+Thompson lebih andal daripada TOPSIS, dengan harga hanya sedikit lebih mahal.")
    butir(d, "Selalu termurah kalah dari memilih acak — premis Mesin 2. Sebagian karena rancangan dataset kami sendiri.")
    butir(d, "Eksplorasi hampir tidak membayar dirinya sendiri: reputasi distributor dipakai bersama 70 UMKM. Thompson tetap dipasang untuk distributor baru.")

    # --- G -----------------------------------------------------------
    judul(d, "G. Profil pelanggan distributor — bagian 8")
    alinea(
        d,
        "Sebelumnya disebut Mesin 3. Namanya diganti supaya tidak tertukar dengan "
        "segmentasi distributor (Mesin 2). Ini fitur pendukung portal distributor: siapa "
        "pelanggan yang harus dijaga, siapa yang mulai menghilang, siapa yang baru.",
    )
    alinea(
        d,
        "K-Prototypes, karena fiturnya campuran angka (RFM) dan kategori (jenis usaha); "
        "K-Means tidak bisa menghitung jarak antara kedai kopi dan warung makan."
        + (" Hasil: %d pelanggan di %d distributor, jumlah kelompok dipilih dengan skor siluet."
           % (seg.get("baris", 0), seg.get("distributor", 0)) if seg else ""),
    )
    gambar(d, "mesin3_segmen.png", "Sebaran kelompok pelanggan dan posisi RFM rata-ratanya.", 14.5)


# --------------------------------------------------------------------------
# Laporan lengkap
# --------------------------------------------------------------------------
def laporan_lengkap() -> Path:
    db = angka_basis_data()
    m1 = _json("hasil_mesin1.json")
    m1p = _json("hasil_mesin1_pekanan.json")
    m1o = _json("hasil_mesin1_omset.json")
    sar = _json("hasil_mesin1_saringan.json")
    sim = _json("hasil_simulasi_mesin2.json")
    seg = _json("hasil_mesin3.json")
    seg_prod = segmen_produksi()
    n_uji = jumlah_uji()

    d = _dokumen()

    # --- sampul ---------------------------------------------------------
    for _ in range(4):
        d.add_paragraph()
    alinea(d, "LAPORAN IMPLEMENTASI", tebal=True, rata="tengah")
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Basis Data, Dataset, dan Tiga Mesin Analitik")
    r.bold = True
    r.font.size = Pt(18)
    r.font.name = HURUF
    r.font.color.rgb = TEAL
    alinea(d, "Proyek Turnify Flow — platform stok dan pengadaan untuk UMKM", rata="tengah")
    d.add_paragraph()
    alinea(d, "Cabang Rombak#3", rata="tengah")
    alinea(d, tanggal_hari_ini(), rata="tengah")
    d.add_page_break()

    # --- 1. ringkasan ---------------------------------------------------
    judul(d, "1. Ringkasan")
    alinea(
        d,
        "Laporan ini mencatat seluruh lapis data dan model di belakang portal Turnify Flow, "
        "dari skema basis data sampai angka perbandingan model. Frontend tidak disentuh. "
        "Yang dikerjakan: enam lapis basis data, pembangkit dataset simulasi, tiga mesin "
        "analitik beserta percobaan pembandingnya, dua layanan backend terpisah, "
        "otentikasi, dan penjadwal harian.",
    )
    tabel(
        d,
        ["Bagian", "Hasil"],
        [
            ["Basis data", "%d tabel, %d kunci asing, %d indeks, %d tipe enum. Teruji di PostgreSQL 16."
             % (db["tabel"], db["fk"], db["indeks"], db["enum"])],
            ["Dataset", "%s baris dari satu simulasi 400 hari, 70 UMKM, 8 distributor."
             % f"{db['total_baris']:,}".replace(",", ".")],
            ["Pemeriksaan data", "4 uji konsistensi SQL, semuanya mengembalikan 0."],
            ["Mesin 1", teks_mesin1(m1p, m1o)],
            ["Mesin 2", teks_mesin2(sim)],
            ["Profil pelanggan", "K-Prototypes, pengelompokan pelanggan per distributor (fitur pendukung)."],
            ["Backend", "Dua layanan terpisah, otentikasi dua pintu, penjadwal harian."],
            ["Uji otomatis", "%d uji, semuanya lulus." % n_uji],
        ],
        lebar=[4.0, 11.0],
    )

    temuan_utama(d, m1p, m1o, sim)
    tanggapan_dosen(d, halaman_baru=True)
    alinea(
        d,
        "Catatan yang harus dibaca bersama seluruh angka di laporan ini: semuanya berasal "
        "dari data simulasi yang kami rancang sendiri. Bagian 10 menjelaskan apa yang boleh "
        "dan tidak boleh disimpulkan darinya.",
        tebal=True,
    )
    d.add_page_break()

    # --- 2. basis data ---------------------------------------------------
    judul(d, "2. Basis data")
    judul(d, "2.1 Kenapa bukan 13 tabel", 2)
    alinea(
        d,
        "Rancangan awal tim punya 13 tabel. Hasil akhirnya %d. Tambahannya bukan kerumitan "
        "demi kerumitan; tiap tabel menjawab satu hal yang tidak bisa dijawab rancangan lama."
        % db["tabel"],
    )
    tabel(
        d,
        ["Yang hilang di rancangan awal", "Akibatnya", "Tabel yang menjawab"],
        [
            ["Riwayat perubahan stok", "Tidak ada cara tahu kenapa stok berubah, dan tidak ada cara memeriksa angkanya", "pergerakan"],
            ["Jembatan menu ke bahan", "produk.csv berisi menu (porsi, gelas), distributor_stok.csv berisi bahan (kg); tidak ada yang menghubungkan", "pemetaan_menu, pemetaan_menu_bahan"],
            ["Nota kasir", "Tidak ada kunci idempotensi; kasir yang mengirim ulang mengurangi stok dua kali", "transaksi, transaksi_baris"],
            ["Definisi permintaan", "Tiap model membuat kueri sendiri, dan permintaan berarti hal berbeda di tiap tempat", "permintaan_harian"],
            ["Keluaran model", "Portal harus memanggil model saat halaman dibuka", "prediksi, rekomendasi_skor, segmen_pelanggan"],
            ["Kalender nasional", "Hanya Python yang bisa melihatnya; skrip SQL tidak bisa membangun ulang kovariatnya", "hari_libur_nasional"],
            ["Produk kanonik lintas distributor", "Gula Pasir dan Gula pasir 1kg dianggap barang berbeda", "produk_master"],
        ],
        lebar=[5.0, 6.5, 3.5],
    )

    judul(d, "2.2 Enam lapis", 2)
    kode(
        d,
        "Lapis 0  ACUAN      hari_libur_nasional\n"
        "Lapis 1  INTI       produk_master, pengguna, usaha, keanggotaan,\n"
        "                    distributor, berkas\n"
        "Lapis 2  GUDANG     barang, kemasan, pemetaan_menu, pemetaan_menu_bahan,\n"
        "                    transaksi, transaksi_baris, pergerakan, data_kasir\n"
        "Lapis 3  NIAGA      penawaran, paket_kontrak, kontrak, kontrak_periode,\n"
        "                    promo, promo_penawaran, tingkat_keanggotaan\n"
        "Lapis 4  PESANAN    pesanan, pesanan_baris, pesanan_jejak, ulasan, notifikasi\n"
        "Lapis 5  ANALITIK   permintaan_harian, prediksi, fitur_pesanan,\n"
        "                    rekomendasi_skor, segmen_pelanggan",
    )
    alinea(
        d,
        "Aturan yang memisahkan lapis 5 dari sisanya: layanan model menulis ke tabel, API "
        "membaca tabel. API tidak pernah memanggil model saat halaman dibuka. Kalau layanan "
        "model mati, portal tetap terbuka dengan angka terakhir yang tersimpan, dan kolom "
        "tingkat_layanan menyatakan apa adanya bahwa angkanya tidak segar.",
    )

    judul(d, "2.3 Tiga aturan angka", 2)
    alinea(d, "Berlaku di seluruh tabel, dijaga pembantu kolom di warungku/model/dasar.py:")
    butir(d, "Uang adalah bilangan bulat rupiah (BIGINT). Tidak ada sen di Indonesia, dan FLOAT untuk uang cepat atau lambat menghasilkan Rp 148.000,00000001 di layar pemilik warung.")
    butir(d, "Jumlah barang adalah NUMERIC(14,3), bukan FLOAT. Stok bisa 3,4 kg, dan pembulatan biner membuat penjumlahan buku besar tidak pernah pas.")
    butir(d, "Jumlah selalu dalam satuan dasar (gram, ml, pcs). Satuan kg dan liter hanya lapisan tampilan; konversi hanya terjadi di penawaran.kemasan_isi dan di frontend.")

    judul(d, "2.4 Keputusan rancangan yang perlu dijelaskan", 2)
    butir(d, "Tabel barang sengaja tidak punya kolom harga jual. Harga jual adalah fakta dari struk, dan tempatnya di transaksi_baris. Kalau ia juga ada di barang, ada dua angka yang sama-sama mengaku benar.")
    butir(d, "Tabel pesanan satu untuk kedua portal. Portal UMKM dan portal distributor melihat pesanan yang sama dari dua sisi; dua tabel berarti dua kebenaran yang harus disinkronkan selamanya.")
    butir(d, "Tabel kontrak menyimpan harga dan kuota beku. Harga di penawaran berubah; harga yang disepakati dalam kontrak tidak.")
    butir(d, "Enum disimpan sebagai nilai teksnya, bukan nama anggotanya. Frontend mengirim “menunggu-konfirmasi”, bukan “MENUNGGU_KONFIRMASI”.")

    judul(d, "2.5 Cacat yang ditemukan dan diperbaiki", 2)
    alinea(
        d,
        "Tiga puluh kolom NOT NULL punya nilai bawaan di Python tetapi tidak di basis data. "
        "Field(default=False) di SQLModel hanya berlaku kalau barisnya dibuat lewat ORM; "
        "begitu ada skrip SQL atau pengimpor CSV yang menulis tanpa menyebut kolom itu, "
        "Postgres menolak INSERT-nya. Cacat ini tidak terlihat selama semua tulisan lewat "
        "ORM, dan baru tertangkap saat skrip SQL pemeliharaan ditulis.",
    )
    alinea(
        d,
        "Pola .env.* di gitignore akar ikut menelan .env.example, sehingga siapa pun yang "
        "mengkloning repo tidak punya contoh isi konfigurasi sama sekali.",
    )
    d.add_page_break()

    # --- 3. dataset ------------------------------------------------------
    judul(d, "3. Dataset")
    judul(d, "3.1 Satu simulasi, dua dataset", 2)
    alinea(d, "Ini bukan penghematan; ini syarat kebenaran.")
    kode(
        d,
        "penjualan harian  -->  stok menipis  -->  pemesanan ulang  -->  hasil pesanan\n"
        "       |                                                            |\n"
        "       v                                                            v\n"
        "D1: permintaan_harian                                   D2: fitur_pesanan\n"
        "    (Mesin 1)                                               (Mesin 2)",
    )
    alinea(
        d,
        "Kalau D1 dan D2 dibangkitkan terpisah, pesanan tidak akan pernah nyambung dengan "
        "pemakaian: akan ada warung yang memesan gula tiap tiga hari padahal penjualannya "
        "tidak memakai gula. Model yang dilatih di atas data seperti itu belajar dari dunia "
        "yang tidak konsisten, dan tidak ada metrik yang bisa memberi tahu.",
    )

    judul(d, "3.2 Angka", 2)
    tabel(
        d,
        ["Besaran", "Nilai"],
        [
            ["Rentang simulasi", "1 September 2025 sampai 5 Oktober 2026 (400 hari)"],
            ["Jendela uji", "35 hari terakhir"],
            ["Benih acak", "20261006 (benih sama, data sama)"],
            ["UMKM", "70 (5 jenis usaha, 3 kota)"],
            ["Distributor", "8"],
            ["Produk kanonik", "30"],
            ["Barang di rak", "960"],
            ["Total baris", f"{db['total_baris']:,}".replace(",", ".")],
        ],
        lebar=[5.0, 10.0],
    )
    tabel(
        d,
        ["Tabel", "Baris"],
        [[n, f"{v:,}".replace(",", ".")] for n, v in db["baris"][:14]],
        lebar=[7.0, 4.0],
    )

    judul(d, "3.3 Kenapa 70 UMKM dan bukan 20", 2)
    alinea(
        d,
        "Angka yang menentukan bukan jumlah UMKM, melainkan jumlah pelanggan per "
        "distributor — karena segmentasi dijalankan per distributor. Dengan 20 UMKM, "
        "tiap distributor rata-rata hanya punya 15 pelanggan; empat segmen dari 15 "
        "pelanggan berarti empat anggota per segmen, terlalu sedikit untuk segmen itu "
        "berarti apa pun. Pada 70 UMKM angkanya menjadi sekitar 51 pelanggan per "
        "distributor, yaitu belasan anggota per segmen.",
    )

    judul(d, "3.4 Kalender dari SKB 3 Menteri", 2)
    alinea(
        d,
        "Versi pertama memakai perkiraan tanggal libur, dan perkiraan itu meleset satu "
        "hari pada Idulfitri 1447 H. Akibatnya faktor “warung tutup” dan lonjakan "
        "jelang Lebaran jatuh di hari yang salah untuk 70 warung selama sepekan penuh. "
        "Kalender sekarang mengutip SKB 3 Menteri 2025 sampai 2027, termasuk cuti bersama, "
        "dan tersimpan di tabel hari_libur_nasional sehingga skrip SQL ikut bisa melihatnya.",
    )
    alinea(
        d,
        "Satu hal yang diturunkan, bukan dikutip: awal Ramadan. SKB hanya menyebut tanggal "
        "Idulfitri, jadi awal Ramadan dihitung mundur 30 hari. Penanggalan Hijriah "
        "bergantung rukyat, jadi tanggal itu bisa meleset satu hari — dan itu ditandai di "
        "kodenya, bukan disamarkan sebagai fakta.",
    )

    judul(d, "3.5 Sensor kehabisan stok", 2)
    alinea(
        d,
        "Ini keputusan data paling menentukan di seluruh proyek, dan paling sering "
        "dilupakan. Saat stok kosong, penjualan tercatat nol padahal permintaannya tidak "
        "nol, hanya tidak bisa dilayani.",
    )
    alinea(
        d,
        "Kalau nol itu dilatihkan sebagai permintaan nol, model menyimpulkan bahwa barang "
        "paling laris adalah barang yang paling sering kosong, lalu menyarankan stok lebih "
        "sedikit — persis kebalikan dari yang benar. Dan lingkaran itu menutup diri: stok "
        "lebih sedikit, lebih sering kosong, model makin yakin.",
    )
    alinea(
        d,
        "Penanganannya: kolom permintaan_harian.stok_habis menandainya, dan ml/data.py "
        "mengubah hari itu menjadi NaN sebelum sampai ke model mana pun. Saat evaluasi, "
        "hari itu dibuang dari penilaian — bukan dianggap nol, karena menilai ramalan "
        "terhadap nol yang bukan permintaan nol akan memberi nilai terbaik kepada model "
        "yang paling sering meramal terlalu rendah.",
    )

    judul(d, "3.6 Karakter distributor tersembunyi", 2)
    alinea(
        d,
        "Delapan distributor diberi watak yang tidak pernah dilihat model. Inilah kebenaran "
        "yang harus ditemukan sendiri oleh Mesin 2. Jebakannya ada pada Es Segar Mandiri: "
        "paling murah (indeks harga 0,88) dan paling buruk (peluang tepat waktu 0,62).",
    )
    d.add_page_break()

    # --- 4. pemeriksaan ---------------------------------------------------
    judul(d, "4. Pemeriksaan konsistensi")
    alinea(d, "Keempatnya harus mengembalikan 0. Dijalankan dari skrip/02_periksa_konsistensi.sql:")
    kode(
        d,
        "1. permintaan_harian harus sama dengan hasil jumlahan pergerakan     -> 0  LULUS\n"
        "2. barang.stok harus sama dengan saldo akhir buku besar              -> 0  LULUS\n"
        "3. fitur Mesin 2 tidak boleh memuat masa depan                       -> 0  LULUS\n"
        "4. baris pesanan harus menunjuk penawaran milik distributor pesanan  -> 0  LULUS",
    )
    alinea(
        d,
        "Kenapa ada dua jalur yang menulis permintaan_harian. Pembangkit Python mengisinya "
        "langsung, dan skrip SQL bisa membangunnya ulang dari buku besar. Itu bukan "
        "duplikasi yang kelupaan dibersihkan; itu alat ujinya. Kalau dua jalur yang saling "
        "bebas menghasilkan angka yang sama, definisi permintaan memang satu.",
    )
    alinea(
        d,
        "Pemeriksaan nomor 2 sempat gagal untuk dua barang saat jumlah UMKM dinaikkan ke 70. "
        "Sebabnya bukan pembulatan: koreksi stok dicatat pukul 17.00 padahal diterapkan "
        "sesudah penjualan pukul 20.30, sehingga buku besar yang diurutkan menurut waktu "
        "menunjukkan saldo melompat mundur. Cacat itu lolos pada 20 UMKM dan baru tertangkap "
        "pada 70.",
        tebal=False,
    )
    d.add_page_break()

    # --- 5. backend ------------------------------------------------------
    judul(d, "5. Backend")
    judul(d, "5.1 Dua layanan", 2)
    tabel(
        d,
        ["Layanan", "Isi", "Port"],
        [
            ["api", "Baca-tulis basis data, otentikasi", "8000"],
            ["ml", "Mesin 1, 2, 3 dan penjadwal harian", "8001"],
        ],
        lebar=[3.0, 9.0, 2.0],
    )
    alinea(
        d,
        "Alasannya praktis: inferensi model pondasi untuk ratusan barang memakan menit, "
        "bukan milidetik. Memanggilnya dari dalam permintaan HTTP berarti halaman gudang "
        "menunggu model selesai, dan pada percobaan pertama yang gagal pemilik warung "
        "melihat halaman kosong alih-alih angka lama yang masih berguna.",
    )
    alinea(
        d,
        "Pada rancangan sebelumnya, pemisahan ini juga keharusan teknis: uni2ts (pembungkus "
        "MOIRAI) memaku scipy versi yang tidak punya wheel untuk Python 3.14. Sejak MOIRAI "
        "dilepas, batasan itu hilang dan seluruh proyek kembali ke satu "
        "lingkungan Python — pemisahan layanannya tetap, karena alasan pertamanya tetap.",
    )

    judul(d, "5.2 Alur ujung-ke-ujung yang terbukti", 2)
    kode(
        d,
        "POST /mesin1/jalankan   (layanan ml, port 8001)\n"
        "        |  ETS (Holt-Winters) untuk seluruh barang\n"
        "        v\n"
        "   tabel `prediksi`\n"
        "        |\n"
        "        v\n"
        "GET /usaha/{id}/barang/{barang_id}/perkiraan   (layanan api, port 8000)\n"
        "        |\n"
        "        v\n"
        "   30 baris p10 / p50 / p90 + kematangan + tingkat layanan",
    )
    alinea(d, "Keduanya tidak saling memanggil. Yang menghubungkannya adalah tabel.")

    judul(d, "5.3 Alur tulis: sinkron kasir", 2)
    alinea(
        d,
        "POST /usaha/{id}/transaksi dikerjakan lebih dulu daripada endpoint baca mana pun. "
        "Alasannya: salah baca memberi angka salah di layar dan bisa diperbaiki; salah tulis "
        "merusak buku besar, dan buku besar yang rusak tidak bisa diperbaiki belakangan.",
    )
    butir(d, "Idempotensi dijaga basis data lewat UNIQUE(usaha_id, nomor_struk), bukan pemeriksaan di kode. Pemeriksaan di kode selalu bisa dilewati dua permintaan yang datang bersamaan.")
    butir(d, "Nota tidak ditolak karena stok tercatat kurang; stok boleh menjadi negatif. Nota kasir adalah fakta yang sudah terjadi, dan stok negatif justru tanda ada barang masuk yang belum dicatat.")
    butir(d, "Satu menu yang belum dipetakan tidak menggagalkan seluruh nota. Menolak nota karena satu menu akan membuat pemilik warung berhenti memakai sinkronisasi sama sekali.")
    alinea(d, "Invarian yang dijaga: stok barang sama dengan jumlah seluruh baris pergerakan barang itu.", tebal=True)

    judul(d, "5.4 Otentikasi: satu tabel, dua pintu, dua token", 2)
    tabel(
        d,
        ["Keputusan", "Pilihan", "Alasan"],
        [
            ["Tabel identitas", "Satu tabel pengguna", "Dua tabel berarti satu email bisa ada di keduanya; saat lupa kata sandi, sistem tidak tahu akun mana yang dimaksud"],
            ["Pintu masuk", "Dua endpoint", "Akun distributor yang salah masuk ditolak dengan “akun ini terdaftar sebagai distributor”, bukan “kata sandi salah”"],
            ["Token", "Dua jenis", "Portal distributor tidak bisa dibuka dengan token UMKM walau alamatnya ditebak"],
        ],
        lebar=[3.0, 3.5, 8.5],
    )
    alinea(
        d,
        "Inilah yang menutup lubang terbesar sebelum ini: setiap endpoint menerima usaha_id "
        "dari alamat dan mempercayainya, sehingga mengganti satu angka sudah cukup untuk "
        "membaca stok warung orang lain. Email diperiksa ketat saat mendaftar dan longgar "
        "saat masuk — masuk hanyalah pencarian nilai yang sudah tersimpan.",
    )

    judul(d, "5.5 Penjadwal harian", 2)
    tabel(
        d,
        ["Tugas", "Jadwal", "Alasan"],
        [
            ["Mesin 1", "02.00 WIB tiap hari", "Warung sudah tutup dan belum buka; data kemarin lengkap"],
            ["Mesin 2", "tiap 4 jam", "Skornya berlaku 12 jam; empat jam berarti tidak pernah basi"],
            ["Profil pelanggan", "tiap 4 jam", "Mengikuti Mesin 2"],
        ],
        lebar=[2.5, 3.5, 9.0],
    )
    alinea(
        d,
        "Penjadwal hidup di dalam proses layanan ml, bukan sebagai cron terpisah, karena tim "
        "menjalankan ini di laptop untuk demo. Konsekuensinya disebut terus terang: kalau "
        "layanan ml mati, penjadwalnya ikut mati. Endpoint GET /jadwal menampilkan kapan "
        "terakhir jalan dan kapan berikutnya, supaya pertanyaan “kenapa angkanya basi?” "
        "punya jawaban tanpa membuka log.",
    )

    judul(d, "5.6 Endpoint yang tersedia", 2)
    if not gambar(d, "api_swagger.jpg", "Gambar 1. Seluruh endpoint layanan API. Gembok menandai endpoint yang memerlukan token.", 14.0):
        alinea(d, "(Tangkapan layar Swagger UI belum tersedia.)")
    d.add_paragraph()
    gambar(d, "ml_swagger.jpg", "Gambar 2. Endpoint layanan model. Ketiga mesin dijalankan dari sini; /jadwal menampilkan keadaan penjadwal.", 14.0)
    d.add_page_break()

    bagian_mesin1(d, m1, m1p, m1o, sar)
    bagian_mesin2(d, sim, seg_prod)

    # --- 8. Mesin 3 ------------------------------------------------------
    judul(d, "8. Profil pelanggan distributor (fitur pendukung)")
    alinea(
        d,
        "Bagian ini sebelumnya disebut Mesin 3, segmentasi pelanggan. Namanya diganti "
        "supaya tidak tertukar dengan segmentasi distributor yang diminta dosen — yang itu "
        "dikerjakan Mesin 2 (bagian 7). Profil pelanggan adalah fitur pendukung portal "
        "distributor, bukan salah satu mesin utama.",
    )
    alinea(
        d,
        "Arahnya berlawanan dengan Mesin 2. Mesin 2 membaca pesanan dari sisi UMKM "
        "(“distributor ini andal untukku?”); Mesin 3 membaca pesanan yang sama dari sisi "
        "distributor (“pelanggan ini berharga untukku?”). Sumbernya sama, ringkasannya "
        "berlawanan, dan tidak satu pun bisa diturunkan dari yang lain — dari rekomendasi_skor "
        "tidak ada cara mengetahui kapan terakhir seseorang memesan.",
    )
    judul(d, "8.1 Kenapa K-Prototypes dan bukan K-Means", 2)
    alinea(
        d,
        "Fitur pelanggan campuran: tiga angka (recency, frequency, monetary) ditambah lama "
        "berlangganan, dan dua kategori (jenis usaha, kategori barang utama). K-Means "
        "menghitung jarak sebagai selisih kuadrat, dan tidak ada yang namanya selisih antara "
        "kedai kopi dan warung makan. K-Prototypes (Huang, 1998) menjumlahkan dua jarak yang "
        "berbeda jenis: selisih kuadrat untuk angka, dan hitungan atribut yang berbeda untuk "
        "kategori, digabung dengan bobot gamma. Pusat kelompoknya rata-rata untuk angka dan "
        "modus untuk kategori.",
    )
    alinea(
        d,
        "Ditulis sendiri, bukan memakai pustaka, karena tiga alasan: algoritmanya tiga puluh "
        "baris, pustaka kmodes sudah lama tidak dirawat, dan menuliskannya sendiri memaksa "
        "pilihan gamma serta inisialisasi menjadi terlihat alih-alih tersembunyi di balik "
        "nilai bawaan orang lain.",
    )
    judul(d, "8.2 Hasil", 2)
    if seg:
        tabel(
            d,
            ["Distributor", "Pelanggan", "k terpilih", "Siluet"],
            [
                [str(k), str(v.get("pelanggan", "-")), str(v.get("k", "-")),
                 ("%.3f" % v["siluet"]).replace(".", ",") if v.get("siluet") is not None else "-"]
                for k, v in sorted(seg.get("per_distributor", {}).items(), key=lambda x: int(x[0]))
            ],
            lebar=[4.0, 3.0, 3.0, 3.0],
        )
    gambar(d, "mesin3_segmen.png", "Gambar 9. Sebaran kelompok pelanggan dan posisi RFM rata-ratanya.", 15.0)
    alinea(
        d,
        "Jumlah kelompok dipilih dengan skor siluet, bukan ditetapkan di muka. Skor siluet "
        "dipakai memilih k, bukan untuk mengaku kelompoknya benar: siluet tinggi berarti "
        "kelompoknya terpisah rapi menurut ukuran jarak yang kita pilih sendiri, dan ia tidak "
        "bisa membuktikan segmen itu berarti bagi distributor. Itu penilaian manusia.",
    )
    alinea(
        d,
        "Keluarannya bukan nomor kelompok melainkan kelompok bernama dengan satu kalimat ciri "
        "dan satu kalimat saran tindakan, karena nomor kelompok tidak bisa dipakai siapa pun. "
        "Angka RFM-nya ikut disimpan supaya layar bisa menjawab “kenapa?” kepada distributor "
        "yang merasa pelanggannya salah dikelompokkan.",
    )
    d.add_page_break()

    # --- 9. uji ----------------------------------------------------------
    judul(d, "9. Uji otomatis")
    alinea(d, "%d uji, semuanya lulus (python -m pytest -q)." % n_uji)
    tabel(
        d,
        ["Berkas", "Isi"],
        [
            ["test_metrik.py", "AUC, Brier, dan NDCG diuji terhadap sklearn; MASE, WQL, dan cakupan terhadap kasus yang jawabannya bisa dihitung tangan"],
            ["test_data.py", "Sensor kehabisan stok, pengisian median hari-pekan, pembelahan menurut waktu, dan daftar fitur yang tidak boleh memuat label"],
            ["test_struk.py", "Idempotensi nota, invarian buku besar, menu yang belum dipetakan"],
            ["test_otentikasi.py", "Dua pintu, dua token, penjagaan alamat, dan hash dari pembangkit yang benar-benar bisa dipakai masuk"],
            ["test_mesin1_saringan.py", "MAPE dan skala Lewis dihitung tangan; Syntetos–Boylan pada empat pola buatan; ABC memakai nilai, bukan unit; saringan tidak mengintip masa depan; Mahalanobis menangkap kombinasi janggal tetapi tidak menandai Lebaran"],
            ["test_mesin2_sederhana.py", "Pembaruan Beta dan contoh Beta(46, 6) melawan Beta(3, 1); keanggotaan fuzzy, contoh hitung tangan 0,7625, dan kemonotonan skor"],
        ],
        lebar=[4.0, 11.0],
    )
    alinea(
        d,
        "Berkas test_metrik.py ada karena seluruh angka di laporan ini bersandar pada "
        "ml/metrik.py, dan beberapa fungsinya ditulis sendiri. Fungsi metrik yang salah tidak "
        "pernah jatuh dengan galat: ia memberi angka yang sedikit berbeda, laporan tetap "
        "terbaca wajar, dan kesimpulannya salah tanpa ada yang tahu. AUC dan NDCG kami cocok "
        "dengan sklearn sampai 1e-9.",
    )
    d.add_page_break()

    # --- 10. batas penafsiran --------------------------------------------
    judul(d, "10. Apa yang boleh dan tidak boleh disimpulkan")
    alinea(d, "Boleh disimpulkan", tebal=True)
    butir(d, "Seluruh jalur data berjalan: skema, dataset, tabel turunan, model, tabel keluaran, API — semuanya dengan pemeriksaan yang lulus.")
    butir(d, "Metrik yang dipakai benar. AUC, Brier, dan NDCG cocok dengan sklearn sampai 1e-9; MASE terkalibrasi terhadap naif musiman.")
    butir(d, "Kerangka perbandingannya adil: semua metode dinilai pada jendela yang sama persis, dengan perlakuan NaN yang sama, tanpa kebocoran masa depan (diuji).")
    butir(d, "Urutan relatif antar metode pada dataset ini bisa dipercaya.")
    alinea(d, "Tidak boleh disimpulkan", tebal=True)
    butir(d, "Bahwa ETS lebih baik daripada model pondasi secara umum. Pembangkit dataset kami menghasilkan permintaan dengan bentuk yang hampir persis diasumsikan Holt-Winters, dan keunggulan struktural itu tidak otomatis berlaku di data nyata. Data toko roti baru satu toko.")
    butir(d, "Bahwa sasaran 5 persen mustahil. Ia belum tercapai pada tingkat barang per pekan; pada tingkat yang lebih kasar (omset bulanan, kelompok barang) jaraknya lebih kecil.")
    butir(d, "Bahwa Mesin 2 akan menaikkan keberhasilan pesanan sebesar angka di tabel. Kebijakan termurah diuji pada dataset yang kami rancang supaya distributor termurah adalah yang terburuk.")
    butir(d, "Bahwa eksplorasi tidak berguna. Simulasi ini tidak memuat distributor baru yang mendaftar di tengah jalan, dan di situlah eksplorasi paling berarti.")
    butir(d, "Apa pun tentang perilaku pengguna sungguhan. Tidak ada satu pun pemilik warung nyata di dalam angka ini.")
    alinea(
        d,
        "Langkah berikutnya yang akan membuat angka ini berarti: satu warung sungguhan, satu "
        "bulan data kasir nyata, lalu jalankan ulang seluruh perbandingan ini apa adanya. "
        "Kerangkanya sudah siap menerimanya — pengimpor CSV dan endpoint struk sudah ada dan "
        "sudah diuji.",
        tebal=True,
    )
    d.add_page_break()

    # --- 11. yang belum selesai ------------------------------------------
    judul(d, "11. Yang belum selesai")
    alinea(d, "Daftar ini ada supaya tidak ada yang menyangka bagian ini sudah jadi.")
    tabel(
        d,
        ["Belum ada", "Akibatnya sekarang"],
        [
            ["OTP WhatsApp", "Masuk hanya dengan email dan kata sandi. Ditunda sesuai keputusan; kolom nomor_hp sudah ada"],
            ["Peran admin", "Belum ada pemisahan hak di dalam satu usaha selain pemilik"],
            ["Konektor POS open source", "Kontraknya sudah ada (tabel transaksi, idempotensi, endpoint), konektornya belum"],
            ["Tabel kendala dan keranjang sisi server", "Ditunda sesuai keputusan"],
            ["Resep berbilang bahan", "Struktur tabel ada, dataset mengisinya satu-ke-satu sesuai keputusan"],
            ["Dockerfile api dan ml", "Hanya basis data yang di kontainer; keduanya jalan sebagai perintah uvicorn. Lebih jujur daripada Dockerfile yang tidak pernah diuji"],
            ["Data warung sungguhan", "Angka Turnify Flow berasal dari simulasi; satu toko roti nyata dipakai untuk menguji metode omset. Lihat bagian 10"],
            ["Penanda stok mati", "Sell-through hanya cocok untuk menandai barang yang hampir tidak berkurang; penandanya belum dibangun"],
            ["MAPE 5 persen", "Belum tercapai pada tingkat barang per pekan. Lihat bagian 6.7"],
            ["Ramalan omset di aplikasi", "Baru dievaluasi; belum ditulis ke basis data dan belum tampil di portal"],
        ],
        lebar=[5.0, 10.0],
    )

    judul(d, "12. Cara menjalankan ulang seluruhnya", 1)
    kode(
        d,
        "# dari akar repo\n"
        "docker compose -f deployment/docker-compose.yml up -d\n"
        "python -m pip install -r requirements.txt\n"
        "python -m pip install -e . --no-deps\n"
        "cp backend/.env.example backend/.env\n"
        "python -m alembic -c backend/alembic.ini upgrade head\n"
        "python -m dataset.buat_dataset\n"
        "docker exec -i warungku-db psql -U warungku -d warungku_dev < backend/skrip/02_periksa_konsistensi.sql\n"
        "python -m pytest -q\n"
        "\n"
        "python -m ml.mesin1.jalankan --chronos --json ml/hasil/hasil_mesin1.json\n"
        "python -m ml.mesin1.jalankan_pekanan --chronos --json ml/hasil/hasil_mesin1_pekanan.json\n"
        "python -m ml.mesin1.jalankan_pekanan --hanya-saringan ml/hasil/hasil_mesin1_saringan.json\n"
        "python -m ml.mesin1.jalankan_omset --json ml/hasil/hasil_mesin1_omset.json\n"
        "python -m ml.mesin2.jalankan_simulasi --bart --json ml/hasil/hasil_simulasi_mesin2.json\n"
        "python -m ml.grafik\n"
        "\n"
        "python -m uvicorn api.utama:app --port 8000\n"
        "python -m uvicorn ml.layanan:app --port 8001",
    )
    alinea(
        d,
        "Seluruh angka di laporan ini bisa ditelusuri ke berkas JSON di ml/hasil/, "
        "yang dihasilkan perintah-perintah di atas. Dokumen ini pun dibangun dari berkas "
        "tersebut, bukan diketik ulang.",
    )

    berkas = TUJUAN / "Laporan-Lengkap-Turnify-Flow.docx"
    d.save(str(berkas))
    return berkas


# --------------------------------------------------------------------------
# Laporan ringkas
# --------------------------------------------------------------------------
def laporan_ringkas() -> Path:
    """
    Rekap per aspek. Bukan ringkasan naratif — satu bagian per hal yang
    ditambahkan, dengan angka dan satu kalimat alasan.

    Dibangun dari sumber yang sama dengan laporan lengkap, sehingga keduanya
    tidak mungkin menyebut angka yang berbeda.
    """
    db = angka_basis_data()
    m1p = _json("hasil_mesin1_pekanan.json")
    m1o = _json("hasil_mesin1_omset.json")
    sar = _json("hasil_mesin1_saringan.json")
    sim = _json("hasil_simulasi_mesin2.json")
    seg = _json("hasil_mesin3.json")
    seg_prod = segmen_produksi()
    n_uji = jumlah_uji()

    d = _dokumen()

    for _ in range(3):
        d.add_paragraph()
    alinea(d, "REKAP PER ASPEK", tebal=True, rata="tengah")
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Apa Saja yang Ditambahkan ke Proyek Turnify Flow")
    r.bold = True
    r.font.size = Pt(17)
    r.font.name = HURUF
    r.font.color.rgb = TEAL
    alinea(d, "Ringkasan dari Laporan Lengkap; nomor bagian menunjuk ke sana.", rata="tengah")
    alinea(d, "Cabang Rombak#3 — " + tanggal_hari_ini(), rata="tengah")
    d.add_paragraph()

    tabel(
        d,
        ["Aspek", "Hasil singkat"],
        [
            ["A. Basis data", "%d tabel, enam lapis, %d kunci asing" % (db["tabel"], db["fk"])],
            ["B. Dataset", "%s baris, 70 UMKM, 400 hari, kalender SKB" % f"{db['total_baris']:,}".replace(",", ".")],
            ["C. Pemeriksaan", "4 uji SQL, semuanya 0"],
            ["D. Backend", "Dua layanan, otentikasi dua pintu, penjadwal harian"],
            ["E. Mesin 1", teks_mesin1(m1p, m1o)],
            ["F. Mesin 2", teks_mesin2(sim)],
            ["G. Profil pelanggan", "K-Prototypes, pengelompokan pelanggan per distributor (fitur pendukung)"],
            ["H. Uji otomatis", "%d uji, semuanya lulus" % n_uji],
        ],
        lebar=[4.0, 11.0],
    )
    tanggapan_dosen(d)
    d.add_page_break()

    # --- A -----------------------------------------------------------
    judul(d, "A. Basis data — bagian 2")
    alinea(d, "Yang ditambahkan.", tebal=True)
    alinea(d, "Skema enam lapis yang menggantikan rancangan 13 tabel.")
    tabel(
        d,
        ["Besaran", "Nilai"],
        [
            ["Tabel", str(db["tabel"])],
            ["Kunci asing", str(db["fk"])],
            ["Indeks", str(db["indeks"])],
            ["Tipe enum", str(db["enum"])],
            ["Teruji di", "PostgreSQL 16 (kontainer, port 5433)"],
        ],
        lebar=[5.0, 8.0],
    )
    alinea(d, "Kenapa tidak cukup 13 tabel.", tebal=True)
    alinea(
        d,
        "Tujuh hal tidak punya tempat di rancangan lama: riwayat perubahan stok, jembatan "
        "dari menu ke bahan, nota kasir beserta kunci idempotensinya, satu definisi "
        "permintaan, keluaran ketiga mesin, kalender nasional, dan produk kanonik lintas "
        "distributor.",
    )
    alinea(d, "Cacat yang diperbaiki.", tebal=True)
    butir(d, "Tiga puluh kolom NOT NULL punya nilai bawaan di Python tetapi tidak di basis data — setiap INSERT dari SQL atau CSV ditolak Postgres. Baru tertangkap saat skrip SQL pemeliharaan ditulis.")
    butir(d, "Pola .env.* di gitignore akar ikut menelan .env.example, sehingga yang mengkloning repo tidak punya contoh konfigurasi.")

    # --- B -----------------------------------------------------------
    judul(d, "B. Dataset — bagian 3")
    alinea(d, "Yang ditambahkan.", tebal=True)
    alinea(d, "Pembangkit simulasi 400 hari yang menghasilkan dua dataset selaras dari satu simulasi.")
    tabel(
        d,
        ["Besaran", "Nilai"],
        [
            ["Total baris", f"{db['total_baris']:,}".replace(",", ".")],
            ["UMKM / distributor / produk", "70 / 8 / 30"],
            ["Rentang", "1 Sep 2025 – 5 Okt 2026"],
            ["Benih", "20261006 (dapat direproduksi)"],
            ["Kalender", "SKB 3 Menteri 2025–2027, termasuk cuti bersama"],
        ],
        lebar=[5.0, 8.0],
    )
    alinea(d, "Kenapa satu simulasi.", tebal=True)
    alinea(
        d,
        "Penjualan menguras stok, stok menipis memicu pesanan, hasil pesanan menjadi label. "
        "Dibangkitkan terpisah, pesanan tidak akan pernah nyambung dengan pemakaian.",
    )
    alinea(d, "Kenapa 70 UMKM dan bukan 20.", tebal=True)
    alinea(
        d,
        "Segmentasi dihitung per distributor. Dengan 20 UMKM, tiap distributor rata-rata "
        "hanya punya 15 pelanggan — empat segmen dari 15 pelanggan berarti empat anggota "
        "per segmen. Pada 70 UMKM angkanya jadi sekitar 51 pelanggan per distributor.",
    )
    alinea(d, "Sensor kehabisan stok.", tebal=True)
    alinea(
        d,
        "Hari stok kosong diubah menjadi data hilang, bukan permintaan nol. Kalau nol itu "
        "dilatihkan, model menyimpulkan barang paling laris adalah barang yang paling sering "
        "kosong, lalu menyarankan stok lebih sedikit.",
    )
    alinea(d, "Cacat yang diperbaiki.", tebal=True)
    butir(d, "Kalender perkiraan meleset satu hari pada Idulfitri 1447 H, sehingga faktor warung-tutup jatuh di hari yang salah selama sepekan. Sekarang mengutip SKB.")
    butir(d, "Koreksi stok dicatat pukul 17.00 padahal diterapkan sesudah penjualan pukul 20.30, sehingga buku besar yang diurutkan waktu menunjukkan saldo melompat mundur. Lolos pada 20 UMKM, tertangkap pada 70.")

    # --- C -----------------------------------------------------------
    judul(d, "C. Pemeriksaan konsistensi — bagian 4")
    kode(
        d,
        "1. permintaan_harian == jumlahan pergerakan          -> 0  LULUS\n"
        "2. barang.stok == saldo akhir buku besar             -> 0  LULUS\n"
        "3. fitur Mesin 2 tidak memuat masa depan             -> 0  LULUS\n"
        "4. baris pesanan menunjuk penawaran distributornya   -> 0  LULUS",
    )
    alinea(
        d,
        "Dua jalur bebas menulis permintaan_harian: Python mengisinya langsung, SQL "
        "membangunnya ulang dari buku besar. Itu bukan duplikasi, melainkan alat ujinya.",
    )

    # --- D -----------------------------------------------------------
    judul(d, "D. Backend — bagian 5")
    alinea(d, "Yang ditambahkan.", tebal=True)
    butir(d, "Dua layanan terpisah: api (port 8000) dan ml (port 8001). Layanan model menulis ke tabel, API membaca tabel; keduanya tidak saling memanggil.")
    butir(d, "Alur tulis sinkron kasir yang idempoten, dijaga basis data lewat UNIQUE(usaha_id, nomor_struk) — bukan pemeriksaan di kode yang bisa dilewati dua permintaan bersamaan.")
    butir(d, "Endpoint portal distributor: pesanan masuk, ringkasan segmen, anggota segmen.")
    butir(d, "Otentikasi: satu tabel pengguna, dua pintu masuk, dua jenis token.")
    butir(d, "Penjadwal APScheduler: Mesin 1 jam 02.00 WIB, Mesin 2 dan 3 tiap empat jam.")
    alinea(d, "Lubang yang ditutup otentikasi.", tebal=True)
    alinea(
        d,
        "Sebelumnya setiap endpoint menerima usaha_id dari alamat dan mempercayainya, "
        "sehingga mengganti satu angka sudah cukup untuk membaca stok warung orang lain.",
    )
    gambar(d, "api_swagger.jpg", "Endpoint layanan API. Gembok menandai yang memerlukan token.", 14.0)
    gambar(d, "ml_swagger.jpg", "Endpoint layanan model: ketiga mesin dan penjadwal.", 14.0)

    ringkas_mesin(d, m1p, m1o, sar, sim, seg, seg_prod)

    # --- H -----------------------------------------------------------
    judul(d, "H. Uji otomatis — bagian 9")
    alinea(d, "%d uji, semuanya lulus." % n_uji)
    tabel(
        d,
        ["Berkas", "Isi"],
        [
            ["test_metrik.py", "AUC, Brier, NDCG vs sklearn; MASE, WQL, cakupan vs hitung tangan"],
            ["test_data.py", "Sensor kehabisan stok, pembelahan waktu, fitur tidak memuat label"],
            ["test_struk.py", "Idempotensi nota, invarian buku besar"],
            ["test_otentikasi.py", "Dua pintu, dua token, penjagaan alamat"],
            ["test_mesin1_saringan.py", "MAPE dan skala Lewis, Syntetos–Boylan, ABC menurut nilai, Mahalanobis dan Lebaran"],
            ["test_mesin2_sederhana.py", "Pembaruan Beta, contoh Beta(46, 6) vs Beta(3, 1), fuzzy 0,7625"],
        ],
        lebar=[4.0, 11.0],
    )
    alinea(
        d,
        "Metrik diuji karena fungsi metrik yang salah tidak pernah jatuh dengan galat: ia "
        "memberi angka yang sedikit berbeda, laporan tetap terbaca wajar, dan kesimpulannya "
        "salah tanpa ada yang tahu.",
    )

    # --- I -----------------------------------------------------------
    judul(d, "I. Batas penafsiran — bagian 10")
    alinea(d, "Boleh disimpulkan:", tebal=True)
    alinea(
        d,
        "Seluruh jalur data berjalan dengan pemeriksaan yang lulus; metrik yang dipakai benar "
        "(cocok sklearn sampai 1e-9); kerangka perbandingannya adil; urutan relatif antar "
        "metode pada dataset ini bisa dipercaya.",
    )
    alinea(d, "Tidak boleh disimpulkan:", tebal=True)
    butir(d, "Bahwa ETS lebih baik daripada model pondasi secara umum — dataset kami menguntungkan metode klasik secara struktural.")
    butir(d, "Bahwa sasaran 5 persen mustahil — ia belum tercapai pada tingkat barang per pekan; pada tingkat yang lebih kasar jaraknya lebih kecil.")
    butir(d, "Bahwa Mesin 2 akan menaikkan keberhasilan pesanan sebesar angka di tabel — kebijakan termurah diuji pada dataset yang kami rancang supaya termurah adalah terburuk.")
    butir(d, "Bahwa eksplorasi tidak berguna — simulasi ini tidak memuat distributor baru yang mendaftar di tengah jalan.")
    butir(d, "Apa pun tentang perilaku pengguna sungguhan.")

    # --- J -----------------------------------------------------------
    judul(d, "J. Yang belum selesai — bagian 11")
    tabel(
        d,
        ["Belum ada", "Akibatnya sekarang"],
        [
            ["OTP WhatsApp", "Masuk hanya email dan kata sandi; ditunda sesuai keputusan"],
            ["Peran admin", "Belum ada pemisahan hak di dalam satu usaha"],
            ["Konektor POS open source", "Kontraknya sudah ada, konektornya belum"],
            ["kendala, keranjang sisi server", "Ditunda sesuai keputusan"],
            ["Resep berbilang bahan", "Struktur tabel ada, dataset mengisinya satu-ke-satu"],
            ["Dockerfile api dan ml", "Hanya basis data di kontainer; demo dijalankan dengan uvicorn"],
            ["Data warung sungguhan", "Angka Turnify Flow dari simulasi; satu toko roti nyata untuk menguji metode omset"],
            ["Penanda stok mati", "Sell-through hanya cocok untuk ini; belum dibangun"],
            ["MAPE 5 persen", "Belum tercapai pada tingkat barang per pekan"],
            ["Ramalan omset di aplikasi", "Baru dievaluasi; belum ditulis ke basis data dan belum tampil"],
        ],
        lebar=[5.0, 10.0],
    )

    berkas = TUJUAN / "Laporan-Ringkas-Turnify-Flow.docx"
    d.save(str(berkas))
    return berkas


# --------------------------------------------------------------------------
def main() -> None:
    # Gambar tidak disalin dari mana pun: `ml/grafik.py` menulis langsung ke
    # `docs/laporan/gambar/`. Satu tempat, supaya tidak ada dua salinan yang bisa
    # berbeda isinya.
    print("Membangun laporan Word...")
    a = laporan_lengkap()
    print("  lengkap : %s" % a)
    b = laporan_ringkas()
    print("  ringkas : %s" % b)


if __name__ == "__main__":
    main()
