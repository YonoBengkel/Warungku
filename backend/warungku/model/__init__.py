"""
Seluruh tabel Warungku, disusun lima lapis.

Pembagian lapis ini bukan kosmetik — ia menentukan siapa boleh menulis ke mana:

0. **Acuan** (`hari_libur_nasional`) — data yang tidak dimiliki siapa pun
1. **Katalog** (`produk_master`) — kosakata bersama, ditulis admin
2. **Identitas** (`pengguna`, `usaha`, `keanggotaan`, `distributor`)
3. **Gudang** (`barang`, `pergerakan`, `transaksi`, pemetaan menu) — ditulis UMKM
4. **Niaga** (`penawaran`, `kontrak`, `pesanan`, `promo`, `ulasan`) — lintas pihak
5. **Analitik** (`permintaan_harian`, `prediksi`, `fitur_pesanan`,
   `rekomendasi_skor`, `segmen_pelanggan`) — HANYA ditulis layanan model,
   hanya dibaca API
"""

from .analitik import FiturPesanan, PermintaanHarian, Prediksi, RekomendasiSkor
from .referensi import HariLiburNasional
from .segmen import SegmenPelanggan
from .gudang import (
    Barang,
    DataKasir,
    Kemasan,
    PemetaanMenu,
    PemetaanMenuBahan,
    Pergerakan,
    Transaksi,
    TransaksiBaris,
)
from .inti import Berkas, Distributor, Keanggotaan, Pengguna, ProdukMaster, Usaha
from .produksi import Pembeli, Penjualan, PenjualanBaris, Produksi, ProdukJadi, ResepBahan
from .niaga import (
    Kontrak,
    KontrakPeriode,
    Notifikasi,
    PaketKontrak,
    Penawaran,
    Pesanan,
    PesananBaris,
    PesananJejak,
    Promo,
    PromoPenawaran,
    TingkatKeanggotaan,
    Ulasan,
)

__all__ = [
    # Lapis 1
    "ProdukMaster",
    # Lapis 2
    "Pengguna",
    "Usaha",
    "Keanggotaan",
    "Distributor",
    "Berkas",
    # Lapis 3
    "Barang",
    "Kemasan",
    "PemetaanMenu",
    "PemetaanMenuBahan",
    "Transaksi",
    "TransaksiBaris",
    "Pergerakan",
    "DataKasir",
    # Lapis 3b: produksi dan penjualan B2B
    "ProdukJadi",
    "ResepBahan",
    "Produksi",
    "Pembeli",
    "Penjualan",
    "PenjualanBaris",
    # Lapis 4
    "Penawaran",
    "PaketKontrak",
    "Kontrak",
    "KontrakPeriode",
    "Promo",
    "PromoPenawaran",
    "TingkatKeanggotaan",
    "Pesanan",
    "PesananBaris",
    "PesananJejak",
    "Ulasan",
    "Notifikasi",
    # Lapis 5
    "PermintaanHarian",
    "Prediksi",
    "FiturPesanan",
    "RekomendasiSkor",
    "SegmenPelanggan",
    # Lapis 0
    "HariLiburNasional",
]
