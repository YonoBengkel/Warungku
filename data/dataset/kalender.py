"""
Kalender hari libur nasional dan cuti bersama Indonesia, 2025-2027.

**Sumber: SKB 3 Menteri.** Bukan tebakan. Versi sebelumnya berisi perkiraan, dan
perkiraan itu meleset satu hari pada Idulfitri 1447 H — akibatnya faktor "warung
tutup" dan lonjakan jelang Lebaran jatuh di hari yang salah untuk 20 warung
selama sepekan penuh. Sejak itu, tidak ada tanggal di berkas ini yang boleh
ditulis tanpa sumber.

Satu-satunya yang DITURUNKAN, bukan dikutip: awal Ramadan. SKB tidak
mencantumkannya. Ia dihitung mundur dari tanggal Idulfitri (29-30 hari), dan
ditandai jelas di bawah.

Modul ini satu-satunya tempat tanggal libur tertulis. `pola.py` membacanya untuk
simulasi, dan pembangkit dataset menyalinnya ke tabel `hari_libur_nasional`
supaya SQL dan API ikut bisa melihatnya — sebelumnya kalender hanya terlihat
oleh Python, sehingga skrip pemeliharaan tidak bisa membangun ulang kolom
`hari_libur`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class Libur:
    tanggal: date
    nama: str
    #: "libur-nasional" atau "cuti-bersama".
    jenis: str


def _n(t: tuple[int, int, int], nama: str) -> Libur:
    return Libur(date(*t), nama, "libur-nasional")


def _c(t: tuple[int, int, int], nama: str) -> Libur:
    return Libur(date(*t), nama, "cuti-bersama")


# --------------------------------------------------------------------------
# 2025 — SKB 3 Menteri
# --------------------------------------------------------------------------
LIBUR_2025: tuple[Libur, ...] = (
    _n((2025, 1, 1), "Tahun Baru 2025 Masehi"),
    _n((2025, 1, 27), "Isra Mikraj Nabi Muhammad SAW"),
    _n((2025, 1, 29), "Tahun Baru Imlek 2576 Kongzili"),
    _n((2025, 3, 29), "Hari Suci Nyepi (Tahun Baru Saka 1947)"),
    _n((2025, 3, 31), "Idulfitri 1446 Hijriah"),
    _n((2025, 4, 1), "Idulfitri 1446 Hijriah"),
    _n((2025, 4, 18), "Wafat Yesus Kristus"),
    _n((2025, 4, 20), "Kebangkitan Yesus Kristus (Paskah)"),
    _n((2025, 5, 1), "Hari Buruh Internasional"),
    _n((2025, 5, 12), "Hari Raya Waisak 2569 BE"),
    _n((2025, 5, 29), "Kenaikan Yesus Kristus"),
    _n((2025, 6, 1), "Hari Lahir Pancasila"),
    _n((2025, 6, 6), "Iduladha 1446 Hijriah"),
    _n((2025, 6, 27), "1 Muharam Tahun Baru Islam 1447 Hijriah"),
    _n((2025, 8, 17), "Proklamasi Kemerdekaan"),
    _n((2025, 9, 5), "Maulid Nabi Muhammad SAW"),
    _n((2025, 12, 25), "Kelahiran Yesus Kristus (Natal)"),
    _c((2025, 1, 28), "Tahun Baru Imlek 2576 Kongzili"),
    _c((2025, 3, 28), "Hari Suci Nyepi"),
    _c((2025, 4, 2), "Idulfitri 1446 Hijriah"),
    _c((2025, 4, 3), "Idulfitri 1446 Hijriah"),
    _c((2025, 4, 4), "Idulfitri 1446 Hijriah"),
    _c((2025, 4, 7), "Idulfitri 1446 Hijriah"),
    _c((2025, 5, 13), "Hari Raya Waisak 2569 BE"),
    _c((2025, 5, 30), "Kenaikan Yesus Kristus"),
    _c((2025, 6, 9), "Iduladha 1446 Hijriah"),
    _c((2025, 8, 18), "Proklamasi Kemerdekaan"),
    _c((2025, 12, 26), "Kelahiran Yesus Kristus (Natal)"),
)

# --------------------------------------------------------------------------
# 2026 — SKB 3 Menteri
# --------------------------------------------------------------------------
LIBUR_2026: tuple[Libur, ...] = (
    _n((2026, 1, 1), "Tahun Baru 2026 Masehi"),
    _n((2026, 1, 16), "Isra Mikraj Nabi Muhammad SAW"),
    _n((2026, 2, 17), "Tahun Baru Imlek 2577 Kongzili"),
    _n((2026, 3, 19), "Hari Suci Nyepi (Tahun Baru Saka 1948)"),
    _n((2026, 3, 21), "Idulfitri 1447 Hijriah"),
    _n((2026, 3, 22), "Idulfitri 1447 Hijriah"),
    _n((2026, 4, 3), "Wafat Yesus Kristus"),
    _n((2026, 4, 5), "Kebangkitan Yesus Kristus (Paskah)"),
    _n((2026, 5, 1), "Hari Buruh Internasional"),
    _n((2026, 5, 14), "Kenaikan Yesus Kristus"),
    _n((2026, 5, 27), "Iduladha 1447 Hijriah"),
    _n((2026, 5, 31), "Hari Raya Waisak 2570 BE"),
    _n((2026, 6, 1), "Hari Lahir Pancasila"),
    _n((2026, 6, 16), "1 Muharam Tahun Baru Islam 1448 Hijriah"),
    _n((2026, 8, 17), "Proklamasi Kemerdekaan"),
    _n((2026, 8, 25), "Maulid Nabi Muhammad SAW"),
    _n((2026, 12, 25), "Kelahiran Yesus Kristus (Natal)"),
    _c((2026, 2, 16), "Tahun Baru Imlek 2577 Kongzili"),
    _c((2026, 3, 18), "Hari Suci Nyepi"),
    _c((2026, 3, 20), "Idulfitri 1447 Hijriah"),
    _c((2026, 3, 23), "Idulfitri 1447 Hijriah"),
    _c((2026, 3, 24), "Idulfitri 1447 Hijriah"),
    _c((2026, 5, 15), "Kenaikan Yesus Kristus"),
    _c((2026, 5, 28), "Iduladha 1447 Hijriah"),
    _c((2026, 12, 24), "Kelahiran Yesus Kristus (Natal)"),
)

# --------------------------------------------------------------------------
# 2027 — SKB 3 Menteri
# --------------------------------------------------------------------------
# Catatan: sumber yang kami terima mencantumkan "Isra Mikraj" dua kali, pada
# 5 Januari DAN 26 Desember 2027. Yang kedua hampir pasti salah ketik di
# sumbernya (26 Desember lazimnya hari kedua Natal). Tanggalnya tetap dicatat
# sebagai hari libur karena memang disebut libur, tapi namanya ditandai supaya
# siapa pun yang memakainya tahu ada yang perlu dipastikan ulang.
LIBUR_2027: tuple[Libur, ...] = (
    _n((2027, 1, 1), "Tahun Baru 2027 Masehi"),
    _n((2027, 1, 5), "Isra Mikraj Nabi Muhammad SAW"),
    _n((2027, 2, 6), "Tahun Baru Imlek 2578 Kongzili"),
    _n((2027, 3, 8), "Hari Suci Nyepi (Tahun Baru Saka 1949)"),
    _n((2027, 3, 10), "Idulfitri 1448 Hijriah"),
    _n((2027, 3, 11), "Idulfitri 1448 Hijriah"),
    _n((2027, 3, 26), "Wafat Yesus Kristus"),
    _n((2027, 3, 28), "Kebangkitan Yesus Kristus (Paskah)"),
    _n((2027, 5, 1), "Hari Buruh Internasional"),
    _n((2027, 5, 6), "Kenaikan Yesus Kristus"),
    _n((2027, 5, 17), "Iduladha 1448 Hijriah"),
    _n((2027, 5, 20), "Hari Raya Waisak 2571 BE"),
    _n((2027, 6, 1), "Hari Lahir Pancasila"),
    _n((2027, 6, 6), "1 Muharam Tahun Baru Islam 1449 Hijriah"),
    _n((2027, 8, 15), "Maulid Nabi Muhammad SAW"),
    _n((2027, 8, 17), "Proklamasi Kemerdekaan"),
    _n((2027, 12, 25), "Kelahiran Yesus Kristus (Natal)"),
    _n((2027, 12, 26), "Libur nasional (nama di sumber perlu dipastikan ulang)"),
    _c((2027, 2, 5), "Tahun Baru Imlek 2578 Kongzili"),
    _c((2027, 3, 9), "Idulfitri 1448 Hijriah"),
    _c((2027, 3, 12), "Idulfitri 1448 Hijriah"),
    _c((2027, 3, 15), "Idulfitri 1448 Hijriah"),
    _c((2027, 3, 25), "Wafat Yesus Kristus"),
    _c((2027, 5, 18), "Iduladha 1448 Hijriah"),
    _c((2027, 5, 19), "Hari Raya Waisak 2571 BE"),
    _c((2027, 12, 24), "Kelahiran Yesus Kristus (Natal)"),
)

SEMUA_LIBUR: tuple[Libur, ...] = LIBUR_2025 + LIBUR_2026 + LIBUR_2027

#: Semua tanggal merah, termasuk cuti bersama. Cuti bersama ikut dihitung
#: karena bagi warung, hari orang tidak bekerja adalah hari orang jajan —
#: pengaruhnya pada penjualan sama saja dengan tanggal merah.
TANGGAL_LIBUR: frozenset[date] = frozenset(x.tanggal for x in SEMUA_LIBUR)

NAMA_LIBUR: dict[date, str] = {x.tanggal: x.nama for x in SEMUA_LIBUR}


# --------------------------------------------------------------------------
# Ramadan — DITURUNKAN, bukan dikutip
# --------------------------------------------------------------------------
# SKB hanya menyebut tanggal Idulfitri (1 Syawal). Awal Ramadan dihitung mundur
# 30 hari dari situ, dan akhirnya adalah sehari sebelum Idulfitri. Penanggalan
# Hijriah bergantung pada rukyat, jadi tanggal ini bisa meleset satu hari dari
# kenyataan — dan itu harus diingat saat membaca pengaruh Ramadan pada hasil
# model, bukan dianggap pasti seperti tanggal merahnya.
def _ramadan(idulfitri: date, panjang: int = 30) -> tuple[date, date]:
    akhir = idulfitri - timedelta(days=1)
    return akhir - timedelta(days=panjang - 1), akhir


RAMADAN: tuple[tuple[date, date], ...] = (
    _ramadan(date(2025, 3, 31)),  # 1446 H
    _ramadan(date(2026, 3, 21)),  # 1447 H
    _ramadan(date(2027, 3, 10)),  # 1448 H
)

#: Hari pertama dan kedua Lebaran, saat hampir semua warung tutup.
LEBARAN: frozenset[date] = frozenset(
    {
        date(2025, 3, 31), date(2025, 4, 1),
        date(2026, 3, 21), date(2026, 3, 22),
        date(2027, 3, 10), date(2027, 3, 11),
    }
)


def hari_libur(t: date) -> bool:
    return t in TANGGAL_LIBUR


def sedang_ramadan(t: date) -> bool:
    return any(mulai <= t <= akhir for mulai, akhir in RAMADAN)


def hari_ke_lebaran(t: date) -> int | None:
    """
    Berapa hari lagi menuju Idulfitri terdekat, kalau sedang Ramadan.

    Dipakai untuk lonjakan belanja tujuh hari terakhir. Dikembalikan None di
    luar Ramadan supaya pemanggilnya tidak perlu menebak maknanya.
    """
    for _, akhir in RAMADAN:
        if sedang_ramadan(t) and t <= akhir:
            return (akhir - t).days
    return None


def sedang_lebaran(t: date) -> bool:
    return t in LEBARAN
