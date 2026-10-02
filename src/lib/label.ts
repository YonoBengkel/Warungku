import type {
  ArahPrediksi,
  JenisPromo,
  KategoriNotifikasi,
  StatusKontrak,
  StatusKuota,
  StatusPesanan,
  StatusPesananMasuk,
  StatusStok,
  KematanganPerkiraan,
  CaraHitungStok,
  JenisUsaha,
  WarnaTitik,
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

/**
 * Label lima tab utama.
 *
 * `belanja` memang berbunyi "Distributor": yang berubah hanya kata yang
 * dibaca pengguna. Rute, nama berkas, dan nama variabelnya tetap `belanja`,
 * karena `/distributor/:id` sudah dipakai untuk profil satu distributor dan
 * menukar rutenya cuma memindahkan kebingungan, bukan menghapusnya.
 */
export const NAV = {
  beranda: 'Beranda',
  stok: 'Stok',
  prediksi: 'Prediksi',
  belanja: 'Distributor',
  pesanan: 'Pesanan',
} as const

export const JUDUL = {
  beranda: 'Beranda',
  stok: 'Stok',
  prediksi: 'Prediksi Stok',
  belanja: 'Distributor',
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
}

/** Nada visual. Warna tidak pernah berdiri sendiri: selalu ikon + teks + warna. */
export const NADA_STOK: Record<StatusStok, 'aman' | 'menipis' | 'kritis' | 'info'> = {
  aman: 'aman',
  menipis: 'menipis',
  habis: 'kritis',
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
  ditolak: 'Ditolak distributor',
}

/** Alasan siap pakai saat pemilik usaha mengajukan berhenti dari kontrak. */
export const ALASAN_BERHENTI = [
  'Usaha sedang sepi',
  'Barang ini tidak lagi kami pakai',
  'Kualitas barang tidak sesuai',
  'Harga sudah tidak cocok',
] as const

/** Alasan siap pakai saat distributor menolak pengajuan kontrak. */
export const ALASAN_TOLAK_KONTRAK = [
  'Kuota di luar kemampuan kami',
  'Stok untuk masa kontrak belum terjamin',
  'Alamat di luar jadwal kirim rutin',
  'Harga paket sedang kami tinjau',
] as const

/** Alasan siap pakai saat distributor menolak pengajuan berhenti. */
export const ALASAN_TOLAK_BERHENTI = [
  'Barang untuk masa kontrak sudah kami siapkan',
  'Sisa masa kontrak tinggal sebentar',
  'Kuota bulan ini belum diselesaikan',
] as const

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

/** Urutan di daftar pilihan: yang paling banyak mendaftar ada di atas, "Lainnya" selalu terakhir. */
export const URUTAN_JENIS_USAHA: JenisUsaha[] = [
  'kedai-kopi',
  'kedai-minuman',
  'warung-makan',
  'roti-kue',
  'warung-kelontong',
  'lainnya',
]

export const LABEL_JENIS_USAHA: Record<JenisUsaha, { judul: string; contoh: string }> = {
  'kedai-kopi': { judul: 'Kedai kopi & kafe', contoh: 'Kopi susu, kopi seduh, kafe dengan camilan' },
  'kedai-minuman': { judul: 'Kedai teh, susu & minuman', contoh: 'Es teh, susu segar, boba, jus' },
  'warung-makan': { judul: 'Warung makan & angkringan', contoh: 'Nasi rames, bakmi, angkringan' },
  'roti-kue': { judul: 'Roti & kue', contoh: 'Roti bakar, toko kue, jajanan pasar' },
  'warung-kelontong': { judul: 'Warung kelontong', contoh: 'Warung Madura, toko sembako' },
  lainnya: { judul: 'Lainnya', contoh: 'Usaha makanan atau minuman yang tidak ada di daftar' },
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

/* ------------------------------------------------------------------ */
/* Promo                                                               */
/* ------------------------------------------------------------------ */

export const LABEL_PROMO: Record<JenisPromo, string> = {
  'cuci-gudang': 'Cuci Gudang',
  'produk-baru': 'Produk Baru',
  // "Keanggotaan", bukan "Membership": satu-satunya kata Inggris yang tersisa
  // pada lencana kartu promo.
  membership: 'Promo Keanggotaan',
}

/* ------------------------------------------------------------------ */
/* Prediksi                                                            */
/* ------------------------------------------------------------------ */

export const LABEL_ARAH_PREDIKSI: Record<ArahPrediksi, string> = {
  tambah: 'tambah',
  kurang: 'kurang',
  tetap: 'cukup',
}

export const NADA_ARAH_PREDIKSI: Record<ArahPrediksi, 'menipis' | 'info' | 'aman'> = {
  tambah: 'menipis',
  kurang: 'info',
  tetap: 'aman',
}

/* ------------------------------------------------------------------ */
/* Portal Distributor                                                  */
/* ------------------------------------------------------------------ */

export const NAV_DISTRIBUTOR = {
  // "Beranda", bukan "Dashboard Utama": kata asing, dan di bilah bawah 360px
  // ia membungkus jadi dua baris. Ikonnya pun sudah IkonBeranda.
  dashboard: 'Beranda',
  pesanan: 'Pesanan',
  kontrak: 'Kontrak',
  lacak: 'Lacak Pesanan',
  profil: 'Profil',
} as const

/**
 * Empat tahap pesanan di sisi distributor.
 *
 * Catatan aslinya menulis "Perlu konfirmasi / Gudang / Sedang diantar / Sudah
 * sampai" lalu meminta kata-katanya diperbaiki. Penamaan di bawah dipilih
 * supaya sama persis dengan LABEL_PESANAN di sisi UMKM: satu kejadian yang
 * sama tidak boleh punya dua nama tergantung siapa yang melihatnya.
 */
export const LABEL_PESANAN_MASUK: Record<StatusPesananMasuk, string> = {
  'menunggu-konfirmasi': 'Menunggu Konfirmasi',
  disiapkan: 'Disiapkan di Gudang',
  dikirim: 'Sedang Dikirim',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
}

export const NADA_PESANAN_MASUK: Record<
  StatusPesananMasuk,
  'netral' | 'info' | 'aman' | 'menipis' | 'kritis'
> = {
  'menunggu-konfirmasi': 'menipis',
  disiapkan: 'info',
  dikirim: 'info',
  selesai: 'aman',
  ditolak: 'kritis',
}

/** Urutan tab pada halaman Pesanan distributor. Ditolak tidak punya tab sendiri. */
export const TAHAP_PESANAN_MASUK: StatusPesananMasuk[] = [
  'menunggu-konfirmasi',
  'disiapkan',
  'dikirim',
  'selesai',
]

/** Alasan penolakan siap pakai. Distributor tetap boleh menulis alasan sendiri. */
export const ALASAN_TOLAK = [
  'Stok kami sedang kosong',
  'Jumlahnya di luar kemampuan kami',
  'Alamat di luar area kirim',
  'Harga sudah berubah',
  'Pembayaran belum jelas',
] as const

/* ------------------------------------------------------------------ */
/* Titik peta sebaran                                                  */
/* ------------------------------------------------------------------ */

/**
 * Tiga warna titik, masing-masing selalu dipasangkan dengan keterangannya.
 * Warna tidak pernah jadi satu-satunya penanda status.
 */
export const LABEL_TITIK: Record<WarnaTitik, string> = {
  // Namanya disamakan persis dengan LABEL_PESANAN_MASUK. Sebelumnya tertulis
  // "Belum di-approve": kata Inggris di layar, sekaligus nama kedua untuk
  // keadaan yang di halaman Pesanan sudah bernama "Menunggu Konfirmasi".
  merah: 'Menunggu Konfirmasi',
  oren: 'Belum sampai tujuan',
  biru: 'Sudah sampai',
}

export const KETERANGAN_TITIK: Record<WarnaTitik, string> = {
  merah: 'Pesanan masuk yang belum kamu terima atau tolak.',
  oren: 'Sudah kamu terima, barangnya masih di jalan atau di gudang.',
  biru: 'Sudah sampai di pemilik usaha. Titik ini hilang sendiri setelah 12 jam.',
}

/** Warna titik memakai token grafik, bukan token status, karena ini peta bukan lencana. */
export const WARNA_TITIK_TOKEN: Record<WarnaTitik, string> = {
  merah: 'var(--c-kritis)',
  oren: 'var(--c-menipis)',
  biru: 'var(--c-info)',
}

/** Titik "sudah sampai" hanya bertahan 12 jam, sesuai catatan. */
export const JAM_TITIK_BIRU = 12
