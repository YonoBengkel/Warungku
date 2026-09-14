import type {
  KategoriNotifikasi,
  StatusKontrak,
  StatusKuota,
  StatusPesanan,
  StatusStok,
  KematanganPerkiraan,
  CaraHitungStok,
} from './types'

/**
 * Kamus label tunggal.
 *
 * Semua teks yang muncul di layar diambil dari sini, tidak ditulis ulang di
 * komponen. Alasannya bukan kerapian: satu istilah yang berbeda di dua layar
 * membuat pengguna mengira itu dua hal yang berbeda.
 *
 * Istilah yang sengaja TIDAK dilunakkan: "Distributor" dan "Kontrak".
 * Keduanya tercetak di dokumen yang mengikat secara hukum, jadi mengganti
 * namanya di aplikasi justru menyesatkan.
 */

export const NAV = {
  beranda: 'Beranda',
  stok: 'Stok',
  belanja: 'Belanja',
  pesanan: 'Pesanan',
} as const

export const JUDUL = {
  beranda: 'Beranda',
  stok: 'Stok',
  belanja: 'Belanja Stok dari Distributor',
  pesanan: 'Pesanan',
  notifikasi: 'Pemberitahuan',
  keranjang: 'Keranjang',
  akun: 'Akun',
  dataKasir: 'Data dari Kasir',
  hubungkanKasir: 'Hubungkan Aplikasi Kasir',
  riwayatKasir: 'Riwayat Data Kasir',
  batasAman: 'Batas Aman',
  caraHitung: 'Cara Hitung Stok',
  kuotaBulanIni: 'Kuota Bulan Ini',
  perkiraan: 'Perkiraan',
} as const

export const BANTUAN = {
  batasAman: 'Kalau stok turun sampai angka ini, kami kirim pengingat.',
  kuota: 'minimal ambil per bulan',
  kuotaBertambah: 'Kuota bertambah setelah pesanan selesai diterima.',
  bayarLuar: 'Pembayaran dilakukan di luar aplikasi, langsung ke distributor.',
  bayarLuarPanjang:
    'Aplikasi hanya menyimpan catatan dan bukti. Pembayaran dilakukan langsung ke distributor.',
  ketentuanKosong: 'Distributor belum mencantumkan ketentuan ini.',
  satuKontrakSatuBarang: 'Setiap barang punya kontrak sendiri.',
} as const

/* ------------------------------------------------------------------ */
/* Status stok                                                         */
/* ------------------------------------------------------------------ */

export const LABEL_STOK: Record<StatusStok, string> = {
  aman: 'Aman',
  menipis: 'Menipis',
  habis: 'Habis',
  kebanyakan: 'Kebanyakan',
}

/** Nada visual. Warna tidak pernah berdiri sendiri: selalu ikon + teks + warna. */
export const NADA_STOK: Record<StatusStok, 'aman' | 'menipis' | 'kritis' | 'info'> = {
  aman: 'aman',
  menipis: 'menipis',
  habis: 'kritis',
  kebanyakan: 'info',
}

/* ------------------------------------------------------------------ */
/* Status pesanan                                                      */
/* ------------------------------------------------------------------ */

export const LABEL_PESANAN: Record<StatusPesanan, string> = {
  draf: 'Draf',
  'menunggu-konfirmasi': 'Menunggu Konfirmasi',
  disiapkan: 'Disiapkan',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  'selesai-catatan': 'Selesai (ada catatan)',
  batal: 'Batal',
}

export const NADA_PESANAN: Record<StatusPesanan, 'netral' | 'info' | 'aman' | 'menipis' | 'kritis'> = {
  draf: 'netral',
  'menunggu-konfirmasi': 'menipis',
  disiapkan: 'info',
  dikirim: 'info',
  selesai: 'aman',
  'selesai-catatan': 'menipis',
  batal: 'netral',
}

/** Pesanan yang masih berjalan, dipakai untuk memisahkan segmen di tab Pesanan. */
export const PESANAN_BERJALAN: StatusPesanan[] = ['draf', 'menunggu-konfirmasi', 'disiapkan', 'dikirim']

/* ------------------------------------------------------------------ */
/* Kontrak & kuota                                                     */
/* ------------------------------------------------------------------ */

export const LABEL_KONTRAK: Record<StatusKontrak, string> = {
  'menunggu-persetujuan': 'Menunggu persetujuan distributor',
  aktif: 'Berjalan',
  'akan-berakhir': 'Akan berakhir',
  selesai: 'Selesai',
  dihentikan: 'Dihentikan',
}

export const LABEL_KUOTA: Record<StatusKuota, string> = {
  aman: 'Aman',
  'perlu-dikejar': 'Perlu Dikejar',
  kurang: 'Kurang',
}

export const NADA_KUOTA: Record<StatusKuota, 'aman' | 'menipis' | 'kritis'> = {
  aman: 'aman',
  'perlu-dikejar': 'menipis',
  kurang: 'kritis',
}

/* ------------------------------------------------------------------ */
/* Perkiraan                                                           */
/* ------------------------------------------------------------------ */

export const LABEL_KEMATANGAN: Record<KematanganPerkiraan, string> = {
  'belum-bisa': 'Belum bisa diperkirakan',
  kasar: 'Perkiraan masih kasar',
  mantap: 'Perkiraan cukup mantap',
}

export const NADA_KEMATANGAN: Record<KematanganPerkiraan, 'netral' | 'menipis' | 'aman'> = {
  'belum-bisa': 'netral',
  kasar: 'menipis',
  mantap: 'aman',
}

/* ------------------------------------------------------------------ */
/* Pemberitahuan                                                       */
/* ------------------------------------------------------------------ */

export const LABEL_KATEGORI_NOTIF: Record<KategoriNotifikasi, string> = {
  stok: 'Stok',
  'saran-belanja': 'Saran Belanja',
  pesanan: 'Pesanan',
  kontrak: 'Kontrak',
  sistem: 'Sistem',
}

/* ------------------------------------------------------------------ */
/* Cara hitung stok                                                    */
/* ------------------------------------------------------------------ */

export const LABEL_CARA_HITUNG: Record<CaraHitungStok, { judul: string; bantuan: string }> = {
  racikan: { judul: 'Makanan & minuman racikan', bantuan: 'Stok dihitung dari bahan bakunya' },
  kemasan: { judul: 'Barang kemasan siap jual', bantuan: 'Stok dihitung per buah' },
  keduanya: { judul: 'Dua-duanya', bantuan: 'Sebagian racikan, sebagian barang kemasan' },
}

/* ------------------------------------------------------------------ */
/* Kata yang dilarang muncul di layar                                  */
/* ------------------------------------------------------------------ */

/**
 * Dipakai oleh pemeriksaan pengembangan. Kata-kata ini memindahkan beban
 * memahami kegagalan sistem ke pemilik warung, yang tidak bisa berbuat apa-apa
 * dengan informasi itu.
 */
export const KATA_TERLARANG = ['error', 'server', 'API', 'timeout', 'sinkron gagal'] as const
