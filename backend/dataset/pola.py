"""
Pola kalender dan karakter pelaku, dipakai simulasi pembangkit dataset.

Semua angka di sini adalah **asumsi simulasi**, bukan hasil pengukuran lapangan.
Ia dipilih supaya datanya punya struktur yang memang ada di dunia nyata —
akhir pekan ramai, tanggal gajian melonjak, Ramadan menggeser pola makan — agar
model yang dibandingkan nanti benar-benar diuji kemampuannya menangkap pola,
bukan menebak derau.

Tanggal libur TIDAK lagi ditulis di sini. Ia dibaca dari `kalender.py`, yang
mengutip SKB 3 Menteri. Versi sebelumnya menyimpan perkiraan di berkas ini, dan
perkiraan itu meleset satu hari pada Idulfitri — kesalahan yang tidak terlihat
sampai seseorang membandingkannya dengan SKB asli.
"""

from __future__ import annotations

from datetime import date

from warungku.enum import JenisUsaha

from .kalender import hari_ke_lebaran, hari_libur, sedang_lebaran, sedang_ramadan

__all__ = [
    "hari_libur", "sedang_ramadan", "sedang_lebaran", "pekan_gajian", "musim_hujan",
    "POLA_MINGGUAN", "FAKTOR_RAMADAN", "faktor_musiman", "KarakterDistributor",
    "KARAKTER", "hari_kirim_asli",
]

#: Musim hujan di Jawa: November sampai Maret.
BULAN_HUJAN = frozenset({11, 12, 1, 2, 3})


def pekan_gajian(t: date) -> bool:
    """Tanggal 25 sampai 5 bulan berikutnya — uang masih ada di kantong."""
    return t.day >= 25 or t.day <= 5


def musim_hujan(t: date) -> bool:
    return t.month in BULAN_HUJAN


# --------------------------------------------------------------------------
# Pola permintaan per jenis usaha
# --------------------------------------------------------------------------

#: Pengali per hari dalam pekan (0 = Senin ... 6 = Minggu).
POLA_MINGGUAN: dict[JenisUsaha, tuple[float, ...]] = {
    # Kedai kopi: ramai akhir pekan, Senin paling sepi.
    JenisUsaha.KEDAI_KOPI: (0.82, 0.88, 0.92, 0.98, 1.18, 1.38, 1.30),
    # Kedai minuman mirip kedai kopi tapi lebih datar.
    JenisUsaha.KEDAI_MINUMAN: (0.88, 0.92, 0.95, 1.00, 1.12, 1.22, 1.16),
    # Warung makan: puncaknya Jumat (jam makan siang setelah Jumatan).
    JenisUsaha.WARUNG_MAKAN: (1.02, 1.00, 0.98, 1.00, 1.20, 1.05, 0.88),
    # Roti & kue: akhir pekan kuat, untuk oleh-oleh dan acara.
    JenisUsaha.ROTI_KUE: (0.80, 0.85, 0.90, 0.95, 1.15, 1.45, 1.30),
    # Kelontong: nyaris datar, sedikit naik akhir pekan.
    JenisUsaha.WARUNG_KELONTONG: (0.96, 0.98, 1.00, 1.00, 1.06, 1.10, 1.02),
    JenisUsaha.LAINNYA: (1.0, 1.0, 1.0, 1.0, 1.05, 1.1, 1.05),
}

#: Pengaruh Ramadan per jenis usaha. Warung makan anjlok siang hari; kedai
#: minuman dan roti justru naik untuk takjil dan buka puasa.
FAKTOR_RAMADAN: dict[JenisUsaha, float] = {
    JenisUsaha.KEDAI_KOPI: 0.72,
    JenisUsaha.KEDAI_MINUMAN: 1.35,
    JenisUsaha.WARUNG_MAKAN: 0.65,
    JenisUsaha.ROTI_KUE: 1.45,
    JenisUsaha.WARUNG_KELONTONG: 1.20,
    JenisUsaha.LAINNYA: 1.0,
}

#: Lonjakan menjelang Lebaran: tujuh hari terakhir Ramadan.
FAKTOR_JELANG_LEBARAN = 1.6

#: Hari pertama dan kedua Lebaran: hampir semua warung tutup.
FAKTOR_LEBARAN = 0.15

FAKTOR_GAJIAN = 1.18
FAKTOR_LIBUR = 1.12


def faktor_musiman(t: date, jenis: JenisUsaha) -> float:
    """Pengali permintaan pada satu hari, gabungan seluruh pola kalender."""
    f = POLA_MINGGUAN[jenis][t.weekday()]

    if pekan_gajian(t):
        f *= FAKTOR_GAJIAN
    if hari_libur(t):
        f *= FAKTOR_LIBUR

    if sedang_ramadan(t):
        f *= FAKTOR_RAMADAN[jenis]
        # Tujuh hari terakhir Ramadan: belanja melonjak di semua jenis usaha.
        sisa = hari_ke_lebaran(t)
        if sisa is not None and sisa <= 7:
            f *= FAKTOR_JELANG_LEBARAN
    # Dua hari Lebaran: hampir semua warung tutup. Tanggalnya dari SKB, tidak
    # lagi ditulis tangan di sini — versi lama memakai tanggal yang meleset
    # satu hari, dan faktor 0,15 jatuh di hari yang salah.
    if sedang_lebaran(t):
        f *= FAKTOR_LEBARAN

    return f


# --------------------------------------------------------------------------
# Karakter distributor — kebenaran tersembunyi
# --------------------------------------------------------------------------


class KarakterDistributor:
    """
    Sifat asli distributor yang **tidak pernah dilihat model**.

    Inilah kebenaran yang harus ditemukan sendiri oleh Mesin 2 dari hasil
    pesanan. Kalau model berhasil memeringkat distributor sesuai urutan karakter
    ini, berarti ia benar-benar belajar; kalau tidak, ia cuma menghafal harga.
    """

    def __init__(
        self,
        nama: str,
        p_tepat_waktu: float,
        p_jumlah_sesuai: float,
        p_kondisi_baik: float,
        *,
        peka_ukuran: float = 0.0,
        peka_hujan: float = 0.0,
        peka_luar_kota: float = 0.0,
        indeks_harga: float = 1.0,
    ) -> None:
        self.nama = nama
        self.p_tepat_waktu = p_tepat_waktu
        self.p_jumlah_sesuai = p_jumlah_sesuai
        self.p_kondisi_baik = p_kondisi_baik
        #: Makin besar pesanan, makin sering telat (0 = tidak terpengaruh).
        self.peka_ukuran = peka_ukuran
        #: Musim hujan menambah keterlambatan.
        self.peka_hujan = peka_hujan
        #: Kirim ke luar kota lebih berisiko.
        self.peka_luar_kota = peka_luar_kota
        #: Pengali harga terhadap harga acuan produk.
        self.indeks_harga = indeks_harga

    def peluang_tepat_waktu(self, *, besar_relatif: float, hujan: bool, luar_kota: bool) -> float:
        p = self.p_tepat_waktu
        p -= self.peka_ukuran * max(0.0, besar_relatif - 1.0)
        if hujan:
            p -= self.peka_hujan
        if luar_kota:
            p -= self.peka_luar_kota
        return min(0.99, max(0.02, p))


#: Delapan distributor dengan watak yang sengaja dibuat berbeda-beda, supaya
#: ada yang bisa dipelajari. Perhatikan d-05: murah tapi sering telat — justru
#: kasus seperti inilah yang membuat kebijakan "selalu pilih termurah" rugi,
#: dan yang harus ditemukan Mesin 2.
KARAKTER: tuple[KarakterDistributor, ...] = (
    KarakterDistributor("Sumber Tani Nusantara", 0.94, 0.96, 0.95, peka_ukuran=0.05, indeks_harga=1.04),
    KarakterDistributor("Dairy Prima Jaya", 0.88, 0.94, 0.97, peka_hujan=0.10, indeks_harga=1.00),
    KarakterDistributor("Manis Sejahtera", 0.78, 0.90, 0.92, peka_ukuran=0.18, indeks_harga=0.95),
    KarakterDistributor("Kemasan Andalan", 0.96, 0.97, 0.94, peka_luar_kota=0.04, indeks_harga=1.08),
    KarakterDistributor("Es Segar Mandiri", 0.62, 0.88, 0.85, peka_hujan=0.22, indeks_harga=0.88),
    KarakterDistributor("Pangan Harian Sejati", 0.85, 0.92, 0.90, peka_ukuran=0.10, indeks_harga=0.98),
    KarakterDistributor("Kopi Rakyat Merapi", 0.90, 0.86, 0.93, peka_luar_kota=0.15, indeks_harga=0.92),
    KarakterDistributor("Matcha House Supply", 0.82, 0.95, 0.96, peka_hujan=0.08, indeks_harga=1.12),
)


def hari_kirim_asli(k: KarakterDistributor, tepat_waktu: bool, acak) -> int:
    """Berapa hari barang benar-benar sampai."""
    dasar = int(acak.integers(1, 4))
    if tepat_waktu:
        return dasar
    return dasar + int(acak.integers(1, 6))
