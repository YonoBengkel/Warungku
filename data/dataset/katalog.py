"""
Katalog produk, profil UMKM, dan profil distributor untuk simulasi.

Semua barang di sini adalah **bahan baku**, bukan menu — karena itulah yang
dijual distributor dan itulah yang disimpan di gudang. Pemetaan menu ke bahan
dibuat 1:1 sesuai keputusan pemilik proyek: struktur resepnya sudah ada di
basis data, tapi belum diisi.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from warungku.enum import JenisUsaha


@dataclass(frozen=True)
class Produk:
    nama: str
    kategori: str
    #: Satuan terkecil tempat stok disimpan.
    satuan_dasar: str
    #: Nama kemasan jual distributor dan isinya dalam satuan dasar.
    kemasan: str
    isi: float
    #: Harga acuan per kemasan jual, rupiah. Tiap distributor mengalikannya
    #: dengan indeks harganya sendiri.
    harga_acuan: int
    #: Barang yang jarang laku: permintaannya sering nol. Inilah yang membuat
    #: Croston layak jadi pembanding, dan yang merontokkan model naif.
    jarang: bool = False
    #: Barang yang biasanya dicatat manual (tisu, gas): dibuang dari data model.
    manual: bool = False
    sinonim: tuple[str, ...] = ()


KATALOG: tuple[Produk, ...] = (
    # --- Kopi & Teh ---
    Produk("Biji Kopi Arabika", "Kopi & Teh", "gram", "kg", 1000, 148_000, sinonim=("arabika", "kopi arabika")),
    Produk("Biji Kopi Robusta", "Kopi & Teh", "gram", "kg", 1000, 112_000, sinonim=("robusta",)),
    Produk("Teh Hitam", "Kopi & Teh", "gram", "kg", 1000, 96_000),
    Produk("Teh Melati", "Kopi & Teh", "gram", "kg", 1000, 85_000),
    Produk("Bubuk Cokelat", "Kopi & Teh", "gram", "kg", 1000, 112_000, sinonim=("coklat bubuk",)),
    Produk("Matcha Bubuk", "Kopi & Teh", "gram", "kg", 1000, 398_000, jarang=True),
    # --- Susu & Olahan ---
    Produk("Susu UHT Full Cream", "Susu & Olahan", "ml", "dus", 12000, 216_000, sinonim=("susu uht", "uht")),
    Produk("Susu Kental Manis", "Susu & Olahan", "ml", "dus", 6000, 180_000, sinonim=("skm", "kental manis")),
    Produk("Keju Cheddar", "Susu & Olahan", "gram", "pak", 1000, 62_000, jarang=True),
    # --- Pemanis ---
    Produk("Gula Pasir", "Pemanis", "gram", "karung", 25000, 340_000),
    Produk("Gula Aren Cair", "Pemanis", "ml", "jerigen", 5000, 187_000, sinonim=("gula aren",)),
    Produk("Sirup Vanila", "Pemanis", "ml", "botol", 750, 78_000, jarang=True),
    # --- Bahan Makanan ---
    Produk("Beras", "Bahan Makanan", "gram", "karung", 25000, 325_000),
    Produk("Minyak Goreng", "Bahan Makanan", "ml", "jerigen", 5000, 94_000),
    Produk("Tepung Terigu", "Bahan Makanan", "gram", "karung", 25000, 275_000),
    Produk("Roti Tawar", "Bahan Makanan", "pcs", "bungkus", 20, 19_500),
    Produk("Kentang Beku", "Bahan Makanan", "gram", "pak", 1000, 43_000),
    Produk("Bawang Merah", "Bahan Makanan", "gram", "kg", 1000, 32_000),
    Produk("Cabai Merah", "Bahan Makanan", "gram", "kg", 1000, 45_000),
    # --- Protein ---
    Produk("Telur Ayam", "Protein", "pcs", "krat", 180, 51_000, sinonim=("telor",)),
    Produk("Ayam Potong", "Protein", "gram", "kg", 1000, 38_000),
    Produk("Daging Sapi", "Protein", "gram", "kg", 1000, 135_000, jarang=True),
    # --- Kemasan ---
    Produk("Gelas Plastik 16 oz", "Kemasan", "pcs", "dus", 1000, 285_000, sinonim=("cup 16",)),
    Produk("Gelas Plastik 22 oz", "Kemasan", "pcs", "dus", 1000, 340_000, sinonim=("cup 22",)),
    Produk("Sedotan Kertas", "Kemasan", "pcs", "dus", 2000, 168_000),
    Produk("Kantong Plastik", "Kemasan", "pcs", "pak", 500, 28_000, sinonim=("kresek",)),
    Produk("Cup Sealer Film", "Kemasan", "pcs", "roll", 1, 115_000, jarang=True),
    # --- Pendukung ---
    Produk("Es Batu Kristal", "Pendukung", "gram", "karung", 20000, 42_000, sinonim=("es batu",)),
    Produk("Air Mineral Galon", "Pendukung", "ml", "galon", 19000, 21_000, sinonim=("galon",)),
    Produk("Tisu Makan", "Pendukung", "pcs", "pak", 500, 22_000, manual=True),
)

PRODUK_PER_NAMA = {p.nama: p for p in KATALOG}


def deskripsi_kemasan(isi: float, satuan_dasar: str, kemasan: str) -> str:
    """
    Deskripsi bawaan barang: "1 karung = 20 kg", sama dengan cara layar
    Distributor menulis isi kemasan (`tulisIsi` di frontend/src/lib/satuan.ts).
    Dulu "20000 gram per karung": tanpa titik ribuan dan dalam satuan simpan.
    Kemasan yang hanya mengulang satuannya cukup "per kg".
    """
    if satuan_dasar == "gram" and isi >= 1000:
        n, satuan = isi / 1000, "kg"
    elif satuan_dasar == "ml" and isi >= 1000:
        n, satuan = isi / 1000, "liter"
    else:
        n, satuan = isi, satuan_dasar
    teks = f"{n:,.2f}".rstrip("0").rstrip(".")
    teks = teks.replace(",", "\u2009").replace(".", ",").replace("\u2009", ".")
    if teks == "1" and satuan == kemasan:
        return f"per {kemasan}"
    return f"1 {kemasan} = {teks} {satuan}"


# --------------------------------------------------------------------------
# Barang apa yang disimpan tiap jenis usaha, dan berapa dipakai per hari
# --------------------------------------------------------------------------
#: (nama produk, pemakaian harian dasar dalam satuan dasar) untuk warung ukuran
#: sedang. Tiap warung punya pengali skalanya sendiri.
RAK: dict[JenisUsaha, tuple[tuple[str, float], ...]] = {
    JenisUsaha.KEDAI_KOPI: (
        ("Biji Kopi Arabika", 760), ("Biji Kopi Robusta", 520), ("Teh Hitam", 150),
        ("Bubuk Cokelat", 240), ("Matcha Bubuk", 55), ("Susu UHT Full Cream", 11_500),
        ("Susu Kental Manis", 2_400), ("Gula Pasir", 2_800), ("Gula Aren Cair", 1_350),
        ("Sirup Vanila", 160), ("Gelas Plastik 16 oz", 175), ("Gelas Plastik 22 oz", 95),
        ("Sedotan Kertas", 230), ("Cup Sealer Film", 0.6), ("Es Batu Kristal", 16_000),
        ("Air Mineral Galon", 9_000), ("Tisu Makan", 120),
    ),
    JenisUsaha.KEDAI_MINUMAN: (
        ("Teh Hitam", 420), ("Teh Melati", 380), ("Bubuk Cokelat", 310),
        ("Susu UHT Full Cream", 14_000), ("Susu Kental Manis", 4_200),
        ("Gula Pasir", 4_100), ("Gula Aren Cair", 1_800), ("Sirup Vanila", 240),
        ("Gelas Plastik 16 oz", 210), ("Gelas Plastik 22 oz", 140),
        ("Sedotan Kertas", 320), ("Cup Sealer Film", 0.9),
        ("Es Batu Kristal", 24_000), ("Air Mineral Galon", 11_000), ("Tisu Makan", 90),
    ),
    JenisUsaha.WARUNG_MAKAN: (
        ("Beras", 22_000), ("Minyak Goreng", 3_600), ("Bawang Merah", 1_900),
        ("Cabai Merah", 1_250), ("Telur Ayam", 85), ("Ayam Potong", 7_800),
        ("Daging Sapi", 1_400), ("Gula Pasir", 1_200), ("Teh Hitam", 220),
        ("Kantong Plastik", 130), ("Es Batu Kristal", 9_000),
        ("Air Mineral Galon", 13_000), ("Tisu Makan", 180),
    ),
    JenisUsaha.ROTI_KUE: (
        ("Tepung Terigu", 14_000), ("Gula Pasir", 5_200), ("Telur Ayam", 110),
        ("Susu UHT Full Cream", 4_800), ("Susu Kental Manis", 1_900),
        ("Keju Cheddar", 620), ("Bubuk Cokelat", 480), ("Roti Tawar", 48),
        ("Minyak Goreng", 1_100), ("Kantong Plastik", 95), ("Tisu Makan", 60),
    ),
    JenisUsaha.WARUNG_KELONTONG: (
        ("Beras", 16_000), ("Minyak Goreng", 4_400), ("Gula Pasir", 6_500),
        ("Telur Ayam", 140), ("Susu Kental Manis", 2_600), ("Roti Tawar", 36),
        ("Kantong Plastik", 240), ("Air Mineral Galon", 24_000), ("Tisu Makan", 150),
    ),
}


# --------------------------------------------------------------------------
# Pelaku
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class ProfilUmkm:
    nama: str
    jenis: JenisUsaha
    kota: str
    #: Pengali ukuran usaha terhadap pemakaian dasar di RAK.
    skala: float
    lat: float
    lng: float


UMKM: tuple[ProfilUmkm, ...] = (
    ProfilUmkm("Kopi Kita Jogja", JenisUsaha.KEDAI_KOPI, "Sleman", 1.00, -7.7548, 110.3782),
    ProfilUmkm("Kafe Ruang Tunggu", JenisUsaha.KEDAI_KOPI, "Sleman", 1.45, -7.7612, 110.3901),
    ProfilUmkm("Kopi Lereng Merapi", JenisUsaha.KEDAI_KOPI, "Sleman", 1.70, -7.7203, 110.4120),
    ProfilUmkm("Kopi Tugu Pandang", JenisUsaha.KEDAI_KOPI, "Kota Yogyakarta", 1.25, -7.7829, 110.3671),
    ProfilUmkm("Kafe Beranda Kotabaru", JenisUsaha.KEDAI_KOPI, "Kota Yogyakarta", 0.85, -7.7890, 110.3755),
    ProfilUmkm("Kedai Kopi Sudut Bantul", JenisUsaha.KEDAI_KOPI, "Bantul", 0.70, -7.8880, 110.3290),
    ProfilUmkm("Kedai Teh Sore", JenisUsaha.KEDAI_MINUMAN, "Sleman", 1.10, -7.7455, 110.3950),
    ProfilUmkm("Kedai Susu Sapi Segar", JenisUsaha.KEDAI_MINUMAN, "Sleman", 0.95, -7.7380, 110.4015),
    ProfilUmkm("Kedai Matcha Selasar", JenisUsaha.KEDAI_MINUMAN, "Sleman", 1.35, -7.7510, 110.3840),
    ProfilUmkm("Es Teh Pojok Malioboro", JenisUsaha.KEDAI_MINUMAN, "Kota Yogyakarta", 1.80, -7.7925, 110.3658),
    ProfilUmkm("Angkringan Pak Slamet", JenisUsaha.WARUNG_MAKAN, "Kota Yogyakarta", 0.80, -7.7870, 110.3700),
    ProfilUmkm("Warung Gudeg Bu Tarmi", JenisUsaha.WARUNG_MAKAN, "Kota Yogyakarta", 1.30, -7.8010, 110.3620),
    ProfilUmkm("Warmindo Barokah", JenisUsaha.WARUNG_MAKAN, "Sleman", 0.90, -7.7620, 110.4080),
    ProfilUmkm("Bakmi Jawa Mbah Wito", JenisUsaha.WARUNG_MAKAN, "Sleman", 1.05, -7.7340, 110.3920),
    ProfilUmkm("Warung Sego Abang Mbak Tar", JenisUsaha.WARUNG_MAKAN, "Bantul", 0.75, -7.8790, 110.3410),
    ProfilUmkm("Warung Makan Sumber Rejeki", JenisUsaha.WARUNG_MAKAN, "Bantul", 1.15, -7.8925, 110.3355),
    ProfilUmkm("Roti Bakar Simpang Lima", JenisUsaha.ROTI_KUE, "Sleman", 0.95, -7.7480, 110.4050),
    ProfilUmkm("Toko Kue Mekar Sari", JenisUsaha.ROTI_KUE, "Kota Yogyakarta", 1.40, -7.7955, 110.3705),
    ProfilUmkm("Toko Kelontong Berkah", JenisUsaha.WARUNG_KELONTONG, "Sleman", 1.20, -7.7290, 110.3995),
    ProfilUmkm("Warung Madura Dua Saudara", JenisUsaha.WARUNG_KELONTONG, "Kota Yogyakarta", 1.55, -7.7840, 110.3590),
)


# --------------------------------------------------------------------------
# UMKM tambahan, dibangkitkan
# --------------------------------------------------------------------------
# Dua puluh profil di atas ditulis tangan dan dipertahankan apa adanya — nama
# dan koordinatnya dipakai di contoh-contoh frontend, dan mengubahnya akan
# membuat tangkapan layar lama tidak cocok lagi.
#
# Sisanya dibangkitkan. Alasannya bukan kemalasan: **segmentasi pelanggan
# dihitung PER DISTRIBUTOR**, dan dengan 20 UMKM tiap distributor hanya punya
# rata-rata 15 pelanggan. Empat segmen dari 15 pelanggan berarti empat anggota
# per segmen — terlalu sedikit untuk segmen itu berarti apa pun. Pada 70 UMKM
# angkanya menjadi sekitar 53 pelanggan per distributor, yaitu belasan anggota
# per segmen; itu batas bawah yang masih jujur.
#
# Kotanya sengaja dibatasi pada tiga kota yang sudah dijangkau semua
# distributor. Menaruh UMKM di Kulon Progo akan membuatnya nyaris tidak punya
# pilihan distributor, dan keputusan berkandidat tunggal tidak mengajari Mesin 2
# apa pun.

_AWALAN: dict[JenisUsaha, tuple[str, ...]] = {
    JenisUsaha.KEDAI_KOPI: ("Kopi", "Kafe", "Kedai Kopi", "Warung Kopi"),
    JenisUsaha.KEDAI_MINUMAN: ("Es", "Kedai Teh", "Es Teh", "Minuman Segar"),
    JenisUsaha.WARUNG_MAKAN: ("Warung", "Warmindo", "Angkringan", "Bakmi", "Warung Makan"),
    JenisUsaha.ROTI_KUE: ("Toko Kue", "Roti", "Bakery", "Kue Basah"),
    JenisUsaha.WARUNG_KELONTONG: ("Toko Kelontong", "Warung Madura", "Toko Sembako"),
}

_BELAKANG: tuple[str, ...] = (
    "Seturan", "Babarsari", "Condongcatur", "Maguwo", "Pogung", "Gejayan",
    "Nologaten", "Sagan", "Demangan", "Timoho", "Kotagede", "Umbulharjo",
    "Wirobrajan", "Gedongkuning", "Lempuyangan", "Kaliurang", "Godean",
    "Mlati", "Pakem", "Kasihan", "Sewon", "Pleret", "Imogiri", "Banguntapan",
    "Bu Yuni", "Pak Darto", "Bu Siti", "Pak Narto", "Bu Endang", "Mas Agus",
    "Mbak Rina", "Pak Joko", "Bu Lestari", "Mas Budi", "Mbak Wati", "Pak Hadi",
    "Sumber Waras", "Barokah Jaya", "Rejeki Lancar", "Makmur Sentosa",
    "Mataram", "Prambanan", "Tugu", "Malioboro", "Alun-alun", "Pasar Kembang",
)

#: Titik tengah tiap kota, untuk menyebar koordinat di sekitarnya.
_PUSAT_KOTA: dict[str, tuple[float, float]] = {
    "Sleman": (-7.7450, 110.3950),
    "Kota Yogyakarta": (-7.7880, 110.3680),
    "Bantul": (-7.8850, 110.3350),
}

#: Berapa UMKM per jenis usaha, termasuk yang 20 di atas. Perbandingannya
#: mengikuti yang sudah ada: warung makan dan kedai kopi paling banyak.
_TARGET: tuple[tuple[JenisUsaha, int], ...] = (
    (JenisUsaha.KEDAI_KOPI, 20),
    (JenisUsaha.KEDAI_MINUMAN, 12),
    (JenisUsaha.WARUNG_MAKAN, 20),
    (JenisUsaha.ROTI_KUE, 9),
    (JenisUsaha.WARUNG_KELONTONG, 9),
)


def _bangkitkan_umkm(sudah_ada: tuple[ProfilUmkm, ...]) -> tuple[ProfilUmkm, ...]:
    """
    Lengkapi daftar UMKM sampai memenuhi `_TARGET`, dengan benih tetap.

    Benihnya tetap supaya daftar yang sama lahir di komputer siapa pun. Kalau
    acak, dua anggota tim akan punya dataset berbeda dan angka laporannya tidak
    bisa dibandingkan.
    """
    import numpy as np

    acak = np.random.default_rng(20261006)
    terpakai = {u.nama for u in sudah_ada}
    hasil: list[ProfilUmkm] = []

    for jenis, target in _TARGET:
        kurang = target - sum(1 for u in sudah_ada if u.jenis is jenis)
        dibuat = 0
        percobaan = 0
        while dibuat < kurang and percobaan < 500:
            percobaan += 1
            awalan = _AWALAN[jenis][int(acak.integers(0, len(_AWALAN[jenis])))]
            belakang = _BELAKANG[int(acak.integers(0, len(_BELAKANG)))]
            nama = f"{awalan} {belakang}"
            if nama in terpakai:
                continue
            terpakai.add(nama)

            kota = ("Sleman", "Kota Yogyakarta", "Bantul")[int(acak.integers(0, 3))]
            lat0, lng0 = _PUSAT_KOTA[kota]
            hasil.append(
                ProfilUmkm(
                    nama=nama,
                    jenis=jenis,
                    kota=kota,
                    # Skala lognormal: kebanyakan warung kecil, sedikit yang
                    # besar. Sebaran normal akan membuat warung besar dan kecil
                    # sama banyaknya, dan itu tidak seperti kenyataan.
                    skala=round(float(np.clip(acak.lognormal(0.0, 0.33), 0.45, 2.6)), 2),
                    lat=round(float(lat0 + acak.normal(0, 0.022)), 4),
                    lng=round(float(lng0 + acak.normal(0, 0.022)), 4),
                )
            )
            dibuat += 1

    return sudah_ada + tuple(hasil)


UMKM = _bangkitkan_umkm(UMKM)



@dataclass(frozen=True)
class ProfilDistributor:
    nama: str
    kota: str
    kategori: tuple[str, ...]
    area_kirim: tuple[str, ...]
    minimum_pesanan: int
    baru: bool = False
    #: Titik gudang rekaan di dalam kotanya, untuk peta Lacak Pesanan (revisi
    #: 23 Okt 2026). Bukan alamat sungguhan.
    lat: float | None = None
    lng: float | None = None


DISTRIBUTOR: tuple[ProfilDistributor, ...] = (
    ProfilDistributor("Sumber Tani Nusantara", "Sleman", ("Kopi & Teh", "Pemanis"),
                      ("Sleman", "Kota Yogyakarta", "Bantul"), 250_000, lat=-7.7383, lng=110.3612),
    ProfilDistributor("Dairy Prima Jaya", "Kota Yogyakarta", ("Susu & Olahan",),
                      ("Kota Yogyakarta", "Sleman"), 300_000, lat=-7.7998, lng=110.3825),
    ProfilDistributor("Manis Sejahtera", "Bantul", ("Pemanis", "Bahan Makanan"),
                      ("Bantul", "Kota Yogyakarta", "Sleman"), 200_000, lat=-7.8690, lng=110.3412),
    ProfilDistributor("Kemasan Andalan", "Sleman", ("Kemasan",),
                      ("Sleman", "Kota Yogyakarta", "Bantul", "Kulon Progo"), 150_000, lat=-7.7570, lng=110.3352),
    ProfilDistributor("Es Segar Mandiri", "Sleman", ("Pendukung",),
                      ("Sleman", "Kota Yogyakarta"), 0, lat=-7.7556, lng=110.4078),
    ProfilDistributor("Pangan Harian Sejati", "Kota Yogyakarta", ("Bahan Makanan", "Protein"),
                      ("Kota Yogyakarta", "Sleman", "Bantul"), 250_000, lat=-7.8152, lng=110.3668),
    ProfilDistributor("Kopi Rakyat Merapi", "Sleman", ("Kopi & Teh",),
                      ("Sleman",), 100_000, baru=True, lat=-7.6684, lng=110.4166),
    ProfilDistributor("Matcha House Supply", "Kota Yogyakarta", ("Kopi & Teh", "Susu & Olahan"),
                      ("Kota Yogyakarta", "Sleman"), 200_000, baru=True, lat=-7.7826, lng=110.3929),
)
