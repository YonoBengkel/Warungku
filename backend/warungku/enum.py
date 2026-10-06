"""
Daftar nilai tetap, diselaraskan satu-satu dengan `src/lib/types.ts`.

Kalau salah satu berubah di frontend, ia WAJIB berubah di sini juga — kalau
tidak, basis data akan menerima nilai yang tidak pernah bisa ditampilkan,
atau menolak nilai yang dikirim layar yang sudah jalan.
"""

from __future__ import annotations

from enum import Enum


class TeksEnum(str, Enum):
    """Enum yang disimpan sebagai teks, supaya terbaca saat kueri manual."""

    def __str__(self) -> str:  # pragma: no cover - kenyamanan debug
        return self.value


# --------------------------------------------------------------------------
# Usaha & pengguna
# --------------------------------------------------------------------------
class JenisUsaha(TeksEnum):
    KEDAI_KOPI = "kedai-kopi"
    KEDAI_MINUMAN = "kedai-minuman"
    WARUNG_MAKAN = "warung-makan"
    ROTI_KUE = "roti-kue"
    WARUNG_KELONTONG = "warung-kelontong"
    LAINNYA = "lainnya"


class CaraHitungStok(TeksEnum):
    RACIKAN = "racikan"
    KEMASAN = "kemasan"
    KEDUANYA = "keduanya"


class StatusVerifikasi(TeksEnum):
    MENUNGGU = "menunggu"
    TERVERIFIKASI = "terverifikasi"
    PERLU_DIPERBAIKI = "perlu-diperbaiki"


class PeranPengguna(TeksEnum):
    PEMILIK = "pemilik"
    PEGAWAI = "pegawai"
    DISTRIBUTOR = "distributor"
    ADMIN = "admin"


# --------------------------------------------------------------------------
# Gudang
# --------------------------------------------------------------------------
class SumberBatasAman(TeksEnum):
    SISTEM = "sistem"
    SENDIRI = "sendiri"
    BAWAAN = "bawaan"


class JenisPergerakan(TeksEnum):
    """
    Hanya `TERJUAL` yang masuk ke data permintaan untuk model perkiraan.

    Inilah sebabnya layar Koreksi Stok tidak perlu bertanya "kenapa": jenis
    pergerakannya sendiri sudah memisahkan barang yang laku dari barang yang
    dibuang atau salah hitung.
    """

    TERJUAL = "terjual"
    MASUK = "masuk"
    KOREKSI = "koreksi"


class StatusKasir(TeksEnum):
    BELUM_TERHUBUNG = "belum-terhubung"
    TERHUBUNG = "terhubung"
    TERTUNDA = "tertunda"
    MENYINKRON = "menyinkron"
    MANUAL = "manual"


# --------------------------------------------------------------------------
# Niaga
# --------------------------------------------------------------------------
class StatusKontrak(TeksEnum):
    MENUNGGU_PERSETUJUAN = "menunggu-persetujuan"
    AKTIF = "aktif"
    AKAN_BERAKHIR = "akan-berakhir"
    SELESAI = "selesai"
    DIHENTIKAN = "dihentikan"
    DITOLAK = "ditolak"


class StatusPesanan(TeksEnum):
    DRAF = "draf"
    MENUNGGU_KONFIRMASI = "menunggu-konfirmasi"
    DISIAPKAN = "disiapkan"
    DIKIRIM = "dikirim"
    SELESAI = "selesai"
    SELESAI_CATATAN = "selesai-catatan"
    BATAL = "batal"


class StatusBayar(TeksEnum):
    BELUM_DIBAYAR = "belum-dibayar"
    BUKTI_TERKIRIM = "bukti-terkirim"
    DIKONFIRMASI = "dikonfirmasi"


class AlasanSelisih(TeksEnum):
    KURANG = "kurang"
    LEBIH = "lebih"
    RUSAK = "rusak"
    KUALITAS_BEDA = "kualitas-beda"
    SALAH_BARANG = "salah-barang"


class JenisPromo(TeksEnum):
    CUCI_GUDANG = "cuci-gudang"
    PRODUK_BARU = "produk-baru"
    MEMBERSHIP = "membership"


# --------------------------------------------------------------------------
# Pemberitahuan
# --------------------------------------------------------------------------
class KategoriNotifikasi(TeksEnum):
    STOK = "stok"
    PESANAN = "pesanan"
    KONTRAK = "kontrak"
    SISTEM = "sistem"
    SARAN_BELANJA = "saran-belanja"


class TingkatNotifikasi(TeksEnum):
    PENTING = "penting"
    BIASA = "biasa"


# --------------------------------------------------------------------------
# Analitik
# --------------------------------------------------------------------------
class KematanganPerkiraan(TeksEnum):
    """Gerbang janji produk: di bawah 14 hari data, perkiraan tidak ditampilkan."""

    BELUM_BISA = "belum-bisa"
    KASAR = "kasar"
    MANTAP = "mantap"


class TingkatLayanan(TeksEnum):
    """Turun derajat saat layanan model tidak sehat. Sudah dipakai layar Prediksi."""

    SEGAR = "segar"
    TERSIMPAN = "tersimpan"
    HITUNGAN_SEDERHANA = "hitungan-sederhana"
    TIDAK_TERSEDIA = "tidak-tersedia"
