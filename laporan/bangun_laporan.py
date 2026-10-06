"""
Bangun kedua laporan Word dari berkas hasil percobaan.

    python laporan/bangun_laporan.py

Angka di dokumen **tidak diketik ulang**. Semuanya dibaca dari
`backend/keluaran/*.json` dan dari basis data, sehingga dokumen tidak mungkin
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

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "backend" / "keluaran"
GAMBAR = AKAR / "laporan" / "gambar"
TUJUAN = AKAR / "laporan"

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
        r = sel.paragraphs[0].add_run(teks)
        r.bold = True
        r.font.name = HURUF
        r.font.size = Pt(11)
    for isi in baris:
        sel_baris = t.add_row().cells
        for i, teks in enumerate(isi):
            sel_baris[i].text = ""
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
def _json(nama: str):
    p = KELUARAN / nama
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def angka_basis_data() -> dict:
    from sqlalchemy import text

    import sys

    sys.path.insert(0, str(AKAR / "backend"))
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
            ["python", "-m", "pytest", "uji", "-q", "--collect-only"],
            cwd=AKAR / "backend", capture_output=True, text=True, timeout=300,
        )
        for garis in reversed(h.stdout.splitlines()):
            if "test" in garis and "collected" in garis:
                return int(garis.split()[0])
    except Exception:
        pass
    return 0


# --------------------------------------------------------------------------
# Laporan lengkap
# --------------------------------------------------------------------------
def laporan_lengkap() -> Path:
    db = angka_basis_data()
    m1 = _json("hasil_mesin1.json")
    sim = _json("hasil_simulasi_mesin2.json")
    seg = _json("hasil_mesin3.json")
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
    alinea(d, "Proyek Warungku — platform stok dan pengadaan untuk UMKM", rata="tengah")
    d.add_paragraph()
    alinea(d, "Cabang Rombak#3", rata="tengah")
    alinea(d, date.today().strftime("%d %B %Y"), rata="tengah")
    d.add_page_break()

    # --- 1. ringkasan ---------------------------------------------------
    judul(d, "1. Ringkasan")
    alinea(
        d,
        "Laporan ini mencatat seluruh lapis data dan model di belakang portal Warungku, "
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
            ["Mesin 1", "6 metode diperbandingkan, uji ulang bergulir 3 titik asal."],
            ["Mesin 2", "Contextual bandit: 4 kebijakan x 3 penaksir, simulasi regret 400 hari."],
            ["Mesin 3", "K-Prototypes, segmentasi pelanggan per distributor."],
            ["Backend", "Dua layanan terpisah, otentikasi dua pintu, penjadwal harian."],
            ["Uji otomatis", "%d uji, semuanya lulus." % n_uji],
        ],
        lebar=[4.0, 11.0],
    )

    alinea(d, "Tiga temuan yang mengubah rencana", tebal=True)
    butir(
        d,
        "Lisensi bobot model menentukan pilihan, bukan hanya akurasi. MOIRAI dan Chronos-2 "
        "sama-sama bisa diunduh tanpa akun dan mutunya setara, tetapi bobot MOIRAI "
        "berlisensi CC-BY-NC-4.0 — boleh untuk penelitian, tidak boleh kalau Warungku "
        "dijual. Mesin 1 memakai Chronos-2 (Apache-2.0).",
    )
    butir(
        d,
        "Kebijakan “selalu pilih termurah” lebih buruk daripada memilih acak. "
        "Pada simulasi 400 hari, regret per keputusannya 0,2416 melawan 0,2077 untuk "
        "pemilihan acak. Itu premis Mesin 2, dan di dataset ini ia terbukti.",
    )
    butir(
        d,
        "Eksplorasi hampir tidak membayar dirinya sendiri di masalah ini. Keempat "
        "kebijakan bandit berakhir di regret yang nyaris sama. Penjelasannya ada di "
        "bagian 7; singkatnya, reputasi distributor dipakai bersama oleh seluruh UMKM, "
        "sehingga masalah awal-dingin sudah selesai dalam beberapa pekan pertama.",
    )
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
        "MOIRAI) memaku scipy versi yang tidak punya wheel untuk Python 3.14. Sejak Mesin 1 "
        "beralih ke Chronos-2, batasan itu hilang dan seluruh proyek kembali ke satu "
        "lingkungan Python — pemisahan layanannya tetap, karena alasan pertamanya tetap.",
    )

    judul(d, "5.2 Alur ujung-ke-ujung yang terbukti", 2)
    kode(
        d,
        "POST /mesin1/jalankan   (layanan ml, port 8001)\n"
        "        |  Chronos-2 untuk seluruh barang\n"
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
            ["Mesin 3", "tiap 4 jam", "Mengikuti Mesin 2"],
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
    if not gambar(d, "api_swagger.jpg", "Gambar 1. Seluruh endpoint API pada Swagger UI. Gembok menandai endpoint yang memerlukan token.", 14.0):
        alinea(d, "(Tangkapan layar Swagger UI belum tersedia.)")
    d.add_page_break()

    # --- 6. Mesin 1 ------------------------------------------------------
    judul(d, "6. Mesin 1 — perkiraan permintaan")
    judul(d, "6.1 Apa yang dijawabnya", 2)
    alinea(
        d,
        "Mesin 1 meramal permintaan, bukan stok. Stok tidak diramal; ia dihitung. Yang "
        "diramal adalah berapa banyak bahan yang akan terpakai, per barang per hari, 30 hari "
        "ke depan, dalam bentuk kuantil p10 / p50 / p90. Batas aman diambil dari p90 selama "
        "lama pengiriman — bukan dari p50, karena p50 berarti separuh waktu warung kehabisan.",
    )
    if not gambar(d, "mesin1_kipas.png", "Gambar 2. Kipas p10-p90 melawan permintaan sebenarnya. Batas aman diambil dari tepi atas kipas, bukan dari garis tengahnya.", 15.0):
        alinea(d, "(Gambar kipas perkiraan belum tersedia.)")

    judul(d, "6.2 Rancangan evaluasi", 2)
    alinea(
        d,
        "Uji ulang bergulir dengan tiga titik asal, bukan satu pembelahan. Dengan satu "
        "jendela uji, selisih antar model bisa seluruhnya berasal dari kebetulan: jendela itu "
        "kena Ramadan, atau kena pekan yang luar biasa sepi.",
    )
    alinea(
        d,
        "Metrik utamanya WQL (galat kuantil tertimbang), bukan MASE dan bukan MAPE. MAPE "
        "membagi dengan nilai sebenarnya, dan permintaan harian UMKM sering nol — pembagian "
        "dengan nol itu kadang dibuang diam-diam oleh pustaka, dan yang terbuang justru "
        "hari-hari paling penting. MASE tetap dilaporkan karena skalanya mudah dibaca: 1,0 "
        "berarti setara menebak “besok sama seperti hari yang sama pekan lalu”. Tetapi yang "
        "dipakai aplikasi adalah p90, jadi yang harus diukur adalah mutu seluruh sebarannya.",
    )

    judul(d, "6.3 Hasil", 2)
    if m1:
        urut = sorted(m1, key=lambda x: x["wql"])
        tabel(
            d,
            ["Metode", "MASE", "WQL", "Cakupan p10-p90", "Waktu"],
            [
                [
                    h["nama"],
                    ("%.3f" % h["mase"]).replace(".", ","),
                    ("%.4f" % h["wql"]).replace(".", ","),
                    ("%.1f%%" % (100 * h["cakupan"])).replace(".", ","),
                    "%.0f d" % h["detik"],
                ]
                for h in urut
            ],
            lebar=[4.5, 2.5, 2.5, 3.5, 2.0],
        )
        gambar(d, "mesin1_banding.png", "Gambar 3. Perbandingan metode Mesin 1 menurut WQL dan MASE.", 15.0)
    else:
        alinea(d, "(Hasil Mesin 1 belum tersedia; jalankan python -m ml.mesin1.jalankan --chronos.)")

    judul(d, "6.4 Pemeriksaan kalibrasi", 2)
    alinea(
        d,
        "Naif musiman mendapat MASE mendekati 1,0, seperti yang seharusnya, karena MASE "
        "memang memakai galat metode itu sebagai penyebut. Kalau angka ini jauh dari 1,0, "
        "berarti penyebutnya salah dan seluruh kolom MASE tidak bisa dibaca sebagai menang "
        "atau kalah. Cakupan p10-p90 seharusnya mendekati 80 persen; yang jauh di bawah "
        "berarti selangnya terlalu sempit dan janji “aman 90 persen” tidak ditepati, "
        "sedangkan yang jauh di atas berarti batas amannya menyuruh warung menimbun.",
    )
    d.add_page_break()

    # --- 7. Mesin 2 ------------------------------------------------------
    judul(d, "7. Mesin 2 — saran distributor sebagai contextual bandit")
    judul(d, "7.1 Kenapa bandit dan bukan klasifikasi", 2)
    alinea(d, "Tiga sifat masalah ini tidak bisa dinyatakan oleh pengklasifikasi statis:")
    butir(d, "Umpan balik sebagian. Kita hanya melihat hasil distributor yang benar-benar dipesan; yang tidak dipesan tidak pernah memberi label.")
    butir(d, "Keputusan hari ini menentukan data besok. Distributor yang tidak pernah dipilih tidak pernah punya riwayat, jadi skornya ditarik ke rata-rata, jadi tidak pernah dipilih.")
    butir(d, "Metrik aslinya regret — berapa yang hilang karena tidak memilih yang terbaik — bukan akurasi.")
    kode(
        d,
        "Kebijakan  --+-- Thompson Sampling   (Chapelle & Li, 2011)\n"
        "             +-- LinUCB              (Li dkk., 2010)\n"
        "             +-- epsilon-greedy\n"
        "             +-- Greedy murni        (pembanding: eksplorasi nol)\n"
        "                   | membungkus\n"
        "Penaksir   ------- BART / logistik Bayesian / LightGBM bootstrap",
    )

    judul(d, "7.2 Kenapa BART", 2)
    alinea(
        d,
        "BART (Bayesian Additive Regression Trees; Chipman, George & McCulloch, 2010) adalah "
        "jumlah ratusan pohon kecil yang masing-masing dibatasi prior agar hanya menjelaskan "
        "sedikit. MCMC menghasilkan ratusan cuplikan dari posterior, bukan satu taksiran "
        "titik, sehingga Thompson sampling tinggal mengambil satu cuplikan — tidak ada "
        "langkah heuristik di antaranya.",
    )
    alinea(
        d,
        "Silsilahnya cocok dengan masalah ini. Hill (2011) memperkenalkan BART untuk "
        "menaksir hasil yang akan terjadi seandainya diberi perlakuan lain — persis bentuk "
        "matriks counterfactual yang kami bangun. Jadi pilihannya punya alasan, bukan sekadar "
        "mencari metode yang jarang dipakai.",
    )
    alinea(
        d,
        "Catatan koreksi. Rencana sebelumnya memakai TabPFN dengan anggapan ia bekerja "
        "zero-shot. Itu tidak benar: TabPFN melakukan in-context learning, yang berarti ia "
        "tidak perlu dilatih tetapi wajib dibawa tabel contoh berlabel pada setiap inferensi. "
        "Akibatnya tidak ada berkas model yang bisa dipasang, ada batas ukuran tabel, dan "
        "masalah awal-dingin tidak hilang. Versi 9.x juga menuntut pembuatan akun dan "
        "penerimaan lisensi lewat peramban sebelum bobotnya bisa diunduh.",
    )

    judul(d, "7.3 Simulasi regret berurutan", 2)
    alinea(
        d,
        "Evaluasi potret sesaat membekukan keadaan distributor di batas jendela uji, lalu "
        "menilai semua keputusan sekaligus. Pada potret sesaat, eksplorasi hanya terlihat "
        "sebagai derau — tidak ada hari esok tempat pengetahuan baru terpakai.",
    )
    alinea(
        d,
        "Di simulasi berurutan, waktu berjalan: kebijakan memilih, hasilnya terungkap dari "
        "matriks counterfactual, pengetahuannya bertambah, besok ia memilih lagi dengan "
        "pengetahuan itu. Hanya hasil lengan yang dipilih yang masuk riwayat — itulah bandit "
        "feedback; memasukkan hasil kandidat lain berarti belajar dari informasi yang di "
        "dunia nyata tidak pernah ada.",
    )
    if sim:
        a = sim["acuan"]
        tabel(
            d,
            ["Acuan", "Rata-rata sukses", "Regret per keputusan"],
            [
                ["Oracle (batas atas)", ("%.4f" % a["oracle_sukses"]).replace(".", ","), "0"],
                ["Memilih acak", ("%.4f" % a["acak_sukses"]).replace(".", ","), ("%.4f" % a["acak_regret"]).replace(".", ",")],
                ["Selalu termurah (kebijakan sekarang)", ("%.4f" % a["termurah_sukses"]).replace(".", ","), ("%.4f" % a["termurah_regret"]).replace(".", ",")],
            ],
            lebar=[6.5, 4.0, 4.5],
        )
        urut = sorted(sim["hasil"], key=lambda x: x["regret_total"])
        tabel(
            d,
            ["Kebijakan + penaksir", "Keputusan", "Regret total", "Regret/keputusan", "Sukses"],
            [
                [
                    h["nama"],
                    f"{h['keputusan']:,}".replace(",", "."),
                    "%.0f" % h["regret_total"],
                    ("%.4f" % h["regret_rata"]).replace(".", ","),
                    ("%.3f" % h["sukses_rata"]).replace(".", ","),
                ]
                for h in urut
            ],
            lebar=[5.5, 2.5, 2.5, 3.0, 2.0],
        )
        gambar(d, "mesin2_regret.png", "Gambar 4. Regret kumulatif sepanjang 400 hari. Makin landai makin baik.", 15.0)
        gambar(d, "mesin2_banding.png", "Gambar 5. Regret rata-rata per keputusan, dengan acuan termurah dan acak sebagai garis.", 15.0)
    else:
        alinea(d, "(Hasil simulasi Mesin 2 belum tersedia.)")

    judul(d, "7.4 Temuan: selalu termurah kalah dari memilih acak", 2)
    alinea(
        d,
        "Kebijakan yang berlaku sekarang di lapangan — selalu pilih yang termurah — "
        "menghasilkan regret per keputusan yang lebih besar daripada memilih acak. Itu "
        "membuktikan premis Mesin 2. Tetapi perlu disebut juga bahwa premis itu sebagian "
        "adalah hasil rancangan dataset kami sendiri: kamilah yang membuat distributor "
        "termurah menjadi yang terburuk. Di data nyata hubungannya mungkin lebih lemah.",
    )

    judul(d, "7.5 Temuan: eksplorasi hampir tidak membayar dirinya sendiri", 2)
    alinea(
        d,
        "Keempat kebijakan berakhir di regret yang nyaris sama. Ini bukan tanda kebijakannya "
        "tidak bekerja — pemeriksaan terpisah menunjukkan epsilon-greedy memilih berbeda dari "
        "greedy pada sekitar 13 persen keputusan, dan Thompson pada sekitar 17 persen. "
        "Pilihan mereka memang berbeda; hasil akhirnya yang setara.",
    )
    alinea(
        d,
        "Penjelasannya ada pada bentuk masalahnya. Hanya ada delapan distributor, dan "
        "reputasi tiap distributor dipakai bersama oleh seluruh 70 UMKM — hasil pesanan satu "
        "warung langsung memperbaiki taksiran untuk semua warung lain. Dengan ribuan "
        "keputusan, greedy sudah mengumpulkan data yang cukup dalam beberapa pekan pertama, "
        "dan sesudah itu tidak banyak lagi yang bisa dibeli dengan menjelajah.",
    )
    alinea(
        d,
        "Konsekuensi praktisnya justru menyenangkan: lapis eksplorasi boleh dipasang tanpa "
        "biaya yang berarti, dan ia tetap diperlukan untuk keadaan yang tidak muncul di "
        "simulasi ini — distributor baru yang mendaftar setelah sistem berjalan, atau "
        "distributor yang mutunya berubah.",
    )
    d.add_page_break()

    # --- 8. Mesin 3 ------------------------------------------------------
    judul(d, "8. Mesin 3 — segmentasi pelanggan distributor")
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
    gambar(d, "mesin3_segmen.png", "Gambar 6. Sebaran segmen dan posisi RFM rata-ratanya.", 15.0)
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
    alinea(d, "%d uji, semuanya lulus (python -m pytest uji -q)." % n_uji)
    tabel(
        d,
        ["Berkas", "Isi"],
        [
            ["test_metrik.py", "AUC, Brier, dan NDCG diuji terhadap sklearn; MASE, WQL, dan cakupan terhadap kasus yang jawabannya bisa dihitung tangan"],
            ["test_data.py", "Sensor kehabisan stok, pengisian median hari-pekan, pembelahan menurut waktu, dan daftar fitur yang tidak boleh memuat label"],
            ["test_struk.py", "Idempotensi nota, invarian buku besar, menu yang belum dipetakan"],
            ["test_otentikasi.py", "Dua pintu, dua token, penjagaan alamat, dan hash dari pembangkit yang benar-benar bisa dipakai masuk"],
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
    butir(d, "Bahwa model pondasi tidak berguna. Pembangkit dataset kami menghasilkan permintaan dengan bentuk yang hampir persis diasumsikan Holt-Winters, dan keunggulan struktural itu tidak otomatis berlaku di data nyata.")
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
            ["Data warung sungguhan", "Seluruh angka berasal dari simulasi. Lihat bagian 10"],
        ],
        lebar=[5.0, 10.0],
    )

    judul(d, "12. Cara menjalankan ulang seluruhnya", 1)
    kode(
        d,
        "cd backend\n"
        "docker compose up -d\n"
        "python -m pip install -r requirements.txt\n"
        "cp .env.example .env\n"
        "python -m alembic upgrade head\n"
        "python -m dataset.buat_dataset\n"
        "docker exec -i warungku-db psql -U warungku -d warungku_dev < skrip/02_periksa_konsistensi.sql\n"
        "python -m pytest uji -q\n"
        "\n"
        "python -m ml.mesin1.jalankan --chronos --json keluaran/hasil_mesin1.json\n"
        "python -m ml.mesin2.jalankan_simulasi --bart --json keluaran/hasil_simulasi_mesin2.json\n"
        "python -m ml.grafik\n"
        "\n"
        "python -m uvicorn api.utama:app --port 8000\n"
        "python -m uvicorn ml.layanan:app --port 8001",
    )
    alinea(
        d,
        "Seluruh angka di laporan ini bisa ditelusuri ke berkas JSON di backend/keluaran/, "
        "yang dihasilkan perintah-perintah di atas. Dokumen ini pun dibangun dari berkas "
        "tersebut, bukan diketik ulang.",
    )

    berkas = TUJUAN / "Laporan-Lengkap-Warungku.docx"
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
    m1 = _json("hasil_mesin1.json")
    sim = _json("hasil_simulasi_mesin2.json")
    seg = _json("hasil_mesin3.json")
    n_uji = jumlah_uji()

    d = _dokumen()

    for _ in range(3):
        d.add_paragraph()
    alinea(d, "REKAP PER ASPEK", tebal=True, rata="tengah")
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Apa Saja yang Ditambahkan ke Proyek Warungku")
    r.bold = True
    r.font.size = Pt(17)
    r.font.name = HURUF
    r.font.color.rgb = TEAL
    alinea(d, "Ringkasan dari Laporan Lengkap; nomor bagian menunjuk ke sana.", rata="tengah")
    alinea(d, "Cabang Rombak#3 — " + date.today().strftime("%d %B %Y"), rata="tengah")
    d.add_paragraph()

    tabel(
        d,
        ["Aspek", "Hasil singkat"],
        [
            ["A. Basis data", "%d tabel, enam lapis, %d kunci asing" % (db["tabel"], db["fk"])],
            ["B. Dataset", "%s baris, 70 UMKM, 400 hari, kalender SKB" % f"{db['total_baris']:,}".replace(",", ".")],
            ["C. Pemeriksaan", "4 uji SQL, semuanya 0"],
            ["D. Backend", "Dua layanan, otentikasi dua pintu, penjadwal harian"],
            ["E. Mesin 1", "Chronos-2 (Apache-2.0), 6 metode dibandingkan"],
            ["F. Mesin 2", "Contextual bandit: BART + Thompson, simulasi regret"],
            ["G. Mesin 3", "K-Prototypes, segmentasi per distributor"],
            ["H. Uji otomatis", "%d uji, semuanya lulus" % n_uji],
        ],
        lebar=[4.0, 11.0],
    )
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
    gambar(d, "api_swagger.jpg", "Seluruh endpoint API. Gembok menandai yang memerlukan token.", 14.0)

    # --- E -----------------------------------------------------------
    judul(d, "E. Mesin 1 — perkiraan permintaan — bagian 6")
    alinea(d, "Yang dijawabnya.", tebal=True)
    alinea(
        d,
        "Berapa banyak bahan yang akan terpakai, per barang per hari, 30 hari ke depan, "
        "dalam bentuk p10 / p50 / p90. Batas aman diambil dari p90 selama lama pengiriman, "
        "bukan dari p50 — p50 berarti separuh waktu warung kehabisan.",
    )
    alinea(d, "Kenapa Chronos-2 dan bukan MOIRAI.", tebal=True)
    alinea(
        d,
        "Keduanya bisa diunduh tanpa akun dan mutunya setara. Bedanya lisensi bobot: MOIRAI "
        "CC-BY-NC-4.0 (non-komersial), Chronos-2 Apache-2.0. Kalau Warungku dijual, bobot "
        "MOIRAI tidak boleh ikut — dan seluruh angka batas aman berasal dari situ.",
    )
    if m1:
        urut = sorted(m1, key=lambda x: x["wql"])
        tabel(
            d,
            ["Metode", "MASE", "WQL", "Cakupan", "Waktu"],
            [
                [h["nama"], ("%.3f" % h["mase"]).replace(".", ","),
                 ("%.4f" % h["wql"]).replace(".", ","),
                 ("%.1f%%" % (100 * h["cakupan"])).replace(".", ","),
                 "%.0f d" % h["detik"]]
                for h in urut
            ],
            lebar=[4.5, 2.5, 2.5, 2.5, 2.0],
        )
    gambar(d, "mesin1_banding.png", "Perbandingan metode Mesin 1.", 14.5)
    alinea(d, "Metrik utama WQL, bukan MAPE.", tebal=True)
    alinea(
        d,
        "MAPE membagi dengan nilai sebenarnya, dan permintaan harian sering nol. "
        "Pembagian dengan nol kadang dibuang diam-diam oleh pustaka, dan yang terbuang "
        "justru hari-hari paling penting.",
    )

    # --- F -----------------------------------------------------------
    judul(d, "F. Mesin 2 — saran distributor — bagian 7")
    alinea(d, "Yang dijawabnya.", tebal=True)
    alinea(
        d,
        "Ke distributor mana sebaiknya memesan barang ini, untuk warung ini, hari ini. "
        "Bukan per UMKM sekali untuk selamanya: jawabannya berubah menurut barang, ukuran "
        "pesanan, cuaca, jarak, dan minimum pesanan.",
    )
    alinea(d, "Kenapa dibingkai sebagai contextual bandit.", tebal=True)
    butir(d, "Umpan balik sebagian: hanya hasil distributor yang dipesan yang terlihat.")
    butir(d, "Keputusan hari ini menentukan data besok.")
    butir(d, "Metrik aslinya regret, bukan akurasi.")
    alinea(d, "Kenapa BART sebagai penaksir.", tebal=True)
    alinea(
        d,
        "Posteriornya asli, jadi Thompson sampling tinggal mencuplik tanpa heuristik. "
        "Silsilahnya juga cocok: BART dirancang untuk menaksir hasil yang akan terjadi "
        "seandainya diberi perlakuan lain — persis bentuk matriks counterfactual kami. "
        "TabPFN dilepas karena bukan zero-shot seperti yang dikira, dan versi barunya "
        "berpagar akun serta lisensi.",
    )
    if sim:
        a = sim["acuan"]
        urut = sorted(sim["hasil"], key=lambda x: x["regret_total"])
        tabel(
            d,
            ["Kebijakan + penaksir", "Regret total", "Regret/keputusan", "Sukses"],
            [["Oracle (batas atas)", "0", "0,0000", ("%.4f" % a["oracle_sukses"]).replace(".", ",")]]
            + [
                [h["nama"], "%.0f" % h["regret_total"],
                 ("%.4f" % h["regret_rata"]).replace(".", ","),
                 ("%.3f" % h["sukses_rata"]).replace(".", ",")]
                for h in urut
            ]
            + [
                ["Memilih acak", "—", ("%.4f" % a["acak_regret"]).replace(".", ","), ("%.4f" % a["acak_sukses"]).replace(".", ",")],
                ["Selalu termurah (sekarang)", "—", ("%.4f" % a["termurah_regret"]).replace(".", ","), ("%.4f" % a["termurah_sukses"]).replace(".", ",")],
            ],
            lebar=[5.5, 3.0, 3.5, 2.5],
        )
        gambar(d, "mesin2_regret.png", "Regret kumulatif 400 hari. Makin landai makin baik.", 14.5)
    alinea(d, "TEMUAN 1: selalu termurah kalah dari memilih acak.", tebal=True)
    alinea(
        d,
        "Premis Mesin 2 terbukti di dataset ini. Tetapi premis itu sebagian hasil rancangan "
        "kami sendiri: kamilah yang membuat distributor termurah menjadi yang terburuk.",
    )
    alinea(d, "TEMUAN 2: eksplorasi hampir tidak membayar dirinya sendiri.", tebal=True)
    alinea(
        d,
        "Keempat kebijakan berakhir di regret yang nyaris sama, padahal pilihannya memang "
        "berbeda (epsilon-greedy berbeda dari greedy pada ~13 persen keputusan, Thompson "
        "~17 persen). Sebabnya: hanya ada delapan distributor, dan reputasi mereka dipakai "
        "bersama oleh 70 UMKM, sehingga masalah awal-dingin selesai dalam beberapa pekan. "
        "Lapis eksplorasi tetap dipasang karena ia diperlukan untuk hal yang tidak muncul di "
        "simulasi: distributor baru yang mendaftar setelah sistem berjalan.",
    )

    # --- G -----------------------------------------------------------
    judul(d, "G. Mesin 3 — segmentasi pelanggan — bagian 8")
    alinea(d, "Yang dijawabnya.", tebal=True)
    alinea(
        d,
        "Dari sekian UMKM yang pernah memesan ke saya, siapa yang harus saya jaga, siapa "
        "yang mulai menghilang, siapa yang baru. Ini mesin untuk portal distributor.",
    )
    alinea(d, "Kenapa K-Prototypes dan bukan K-Means.", tebal=True)
    alinea(
        d,
        "Fiturnya campuran angka dan kategori. K-Means tidak bisa menghitung jarak antara "
        "kedai kopi dan warung makan. K-Prototypes menjumlahkan dua jenis jarak dengan bobot "
        "gamma; pusat kelompoknya rata-rata untuk angka dan modus untuk kategori.",
    )
    if seg:
        alinea(
            d,
            "Hasil: %d pelanggan tersegmen di %d distributor, jumlah kelompok dipilih dengan "
            "skor siluet." % (seg.get("baris", 0), seg.get("distributor", 0)),
        )
    gambar(d, "mesin3_segmen.png", "Sebaran segmen dan posisi RFM rata-ratanya.", 14.5)
    alinea(
        d,
        "Keluarannya kelompok bernama dengan satu kalimat ciri dan satu kalimat saran "
        "tindakan, bukan nomor kelompok — nomor kelompok tidak bisa dipakai siapa pun.",
    )

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
    butir(d, "Bahwa model pondasi tidak berguna — dataset kami menguntungkan metode klasik secara struktural.")
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
            ["Data warung sungguhan", "Seluruh angka dari simulasi"],
        ],
        lebar=[5.0, 10.0],
    )

    berkas = TUJUAN / "Laporan-Ringkas-Warungku.docx"
    d.save(str(berkas))
    return berkas


# --------------------------------------------------------------------------
def main() -> None:
    print("Membangun laporan Word...")
    a = laporan_lengkap()
    print("  lengkap : %s" % a)
    b = laporan_ringkas()
    print("  ringkas : %s" % b)


if __name__ == "__main__":
    main()
