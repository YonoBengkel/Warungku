/**
 * Model domain untuk portal Pemilik Usaha.
 *
 * Catatan yang tercermin di tipe ini, semuanya berasal dari keputusan desain:
 * - Harga JUAL produk akhir tidak ada di sini. Itu milik POS eksternal.
 * - Stok disimpan HANYA dalam satu satuan pakai per barang. Kemasan beli
 *   adalah lapisan tampilan, bukan satuan penyimpanan.
 * - Satu kontrak mengikat tepat satu barang.
 * - Perkiraan selalu membawa tingkat kematangan data dan alasan, karena model
 *   bisa salah dan pengguna berhak tahu dasar rekomendasinya.
 */

/* ------------------------------------------------------------------ */
/* Usaha & akun                                                        */
/* ------------------------------------------------------------------ */

export type CaraHitungStok = 'racikan' | 'kemasan' | 'keduanya'

/**
 * Jenis usaha: pilihan baku, bukan teks bebas. Rekomendasi distributor
 * memetakannya ke kategori barang lewat aturan IF-ELSE, dan teks yang diketik
 * bebas seperti "Kedai kopi & camilan" tidak bisa dicocokkan dengan aturan.
 */
export type JenisUsaha =
  | 'kedai-kopi'
  | 'kedai-minuman'
  | 'warung-makan'
  | 'roti-kue'
  | 'warung-kelontong'
  | 'lainnya'
export type StatusVerifikasi = 'menunggu' | 'terverifikasi' | 'perlu-diperbaiki'
export type TingkatVerifikasi = 'penuh' | 'dasar'

export interface ProfilUsaha {
  id: string
  namaUsaha: string
  jenisUsaha: JenisUsaha
  namaPemilik: string
  nib: string
  npwp: string
  alamat: string
  kota: string
  nomorHp: string
  email: string
  bio: string
  warna: string
  caraHitung: CaraHitungStok
  verifikasi: StatusVerifikasi
  tingkatVerifikasi: TingkatVerifikasi
  /** Diisi Admin saat data ditolak. Ditampilkan sebagai daftar berbulir. */
  alasanPerbaikan: string[]
  bergabungSejak: string
  tampilkanAlamatKeDistributor: boolean
  tampilkanNomorHpKeDistributor: boolean
}

/* ------------------------------------------------------------------ */
/* Sumber data penjualan                                               */
/* ------------------------------------------------------------------ */

export type SumberPenjualan = 'kasir-digital' | 'catat-manual' | 'belum-dipilih'
export type StatusKasir = 'belum-terhubung' | 'terhubung' | 'tertunda' | 'menyinkron' | 'manual'

export interface DataKasir {
  sumber: SumberPenjualan
  status: StatusKasir
  merek: string | null
  terakhirMasuk: string | null
  jumlahTransaksiHariIni: number
  /** Menu di kasir yang belum dipasangkan ke bahan, sehingga stok tidak berkurang. */
  menuBelumDipasangkan: MenuBelumDipasangkan[]
}

export interface MenuBelumDipasangkan {
  id: string
  namaMenu: string
  jumlahTerjual: number
  sejak: string
}

export interface RiwayatKasir {
  id: string
  waktu: string
  hasil: 'lengkap' | 'sebagian' | 'tertunda'
  jumlahTransaksi: number
  /** Ditulis dalam bahasa bisnis. Tidak boleh memuat kata error/server/API/timeout. */
  keterangan: string
}

/* ------------------------------------------------------------------ */
/* Transaksi — satu database besar untuk seluruh struk sebuah toko     */
/* ------------------------------------------------------------------ */

/**
 * Satu baris pada struk.
 *
 * Tidak ada harga di sini, dan itu disengaja: harga jual dikelola di aplikasi
 * kasir. Yang dibutuhkan aplikasi ini hanya APA dan BERAPA, karena itulah yang
 * mengurangi stok gudang.
 */
export interface BarisTransaksi {
  /** Nama menu/barang apa adanya seperti tertulis di struk kasir. */
  nama: string
  jumlah: number
  satuan: string
}

/**
 * Satu struk = satu transaksi.
 *
 * Aplikasi hanya mengenal SATU format struk, yaitu format POS tunggal yang
 * didukung (lihat POS_TUNGGAL di src/data/dummy.ts). Tidak ada pemetaan antar
 * format dan tidak ada skema alternatif: struk yang bentuknya lain tidak
 * pernah sampai ke sini.
 */
export interface Transaksi {
  id: string
  /** Nomor struk apa adanya dari kasir, dipakai sebagai rujukan ke pemilik usaha. */
  nomorStruk: string
  waktu: string
  baris: BarisTransaksi[]
  /** Kasir/nama penjaga yang tercetak di struk. */
  kasir: string
}

/* ------------------------------------------------------------------ */
/* Stok                                                                */
/* ------------------------------------------------------------------ */

export type StatusStok = 'aman' | 'menipis' | 'habis'
/** `bawaan` = pemilik usaha belum mengatur sendiri, jadi dipakai batas bawaan 10. */
export type SumberBatasAman = 'sistem' | 'sendiri' | 'bawaan'

export interface Kemasan {
  nama: string
  isi: number
}

export interface Barang {
  id: string
  nama: string
  /**
   * Ukuran, jenis, atau tipe: "1 liter", "jerigen 5 L", "16 oz". Tiap varian
   * dicatat sebagai barang sendiri, jadi tiga ukuran minyak = tiga baris stok.
   */
  deskripsi?: string | null
  /** Sebutan sehari-hari di warung. Ikut dicari supaya "skm" menemukan susu kental manis. */
  namaLain: string[]
  kategori: string
  kodeBarang: string
  /** Satu-satunya satuan tempat angka stok disimpan. */
  satuan: string
  /** Kemasan beli sebagai lapisan tampilan, boleh lebih dari satu. */
  kemasan: Kemasan[]
  /**
   * Satuan yang DITAMPILKAN di seluruh aplikasi: nama salah satu pilihan dari
   * `pilihanSatuanTampil` di lib/satuan. Kosong berarti aturan bawaan
   * (gram → kg, ml → liter, barang hitungan tetap).
   */
  satuanTampil?: string | null
  stok: number
  batasAman: number
  batasAmanSaran: number
  sumberBatasAman: SumberBatasAman
  /** Berapa hari biasanya barang sampai setelah dipesan. Dipakai menyusun saran. */
  hariKirim: number
  hargaBeliTerakhir: number
  pemakaianHarian: number
  /** Hari data pemakaian yang sudah terkumpul. Menentukan kematangan perkiraan. */
  hariDataTerkumpul: number
  ingatkanKedaluwarsa: boolean
  kedaluwarsa: string | null
  /** Terpasang ke menu di kasir? Kalau tidak, stok tidak berkurang otomatis. */
  terhubungKasir: boolean
  /** Barang yang memang dicatat manual (gas, tisu): tidak diperingatkan, tidak masuk data ML. */
  dicatatManual: boolean
  catatan: string | null
}

/**
 * Jenis pergerakan. Hanya `terjual` yang masuk ke data permintaan untuk model
 * perkiraan; `koreksi`, `masuk`, dan `hitung-fisik` tidak pernah ikut. Itulah
 * sebabnya koreksi tidak perlu bertanya "kenapa": jenisnya sendiri sudah cukup
 * memisahkan barang yang laku dari barang yang dibuang atau salah hitung.
 * (`hitung-fisik` tersisa untuk riwayat lama; layarnya sudah tidak ada.)
 */
export type JenisPergerakan = 'terjual' | 'masuk' | 'koreksi' | 'hitung-fisik'

export interface Pergerakan {
  id: string
  barangId: string
  waktu: string
  jenis: JenisPergerakan
  /** Positif untuk masuk, negatif untuk keluar. Dalam satuan pakai. */
  jumlah: number
  stokSesudah: number
  keterangan: string
  /** Pesanan asal, supaya riwayat bisa diketuk balik ke pesanannya. */
  pesananId: string | null
  /** Struk asal untuk pergerakan yang lahir dari kasir. Null untuk yang lain. */
  transaksiId: string | null
  oleh: string
}

/* ------------------------------------------------------------------ */
/* Perkiraan                                                           */
/* ------------------------------------------------------------------ */

/** Tiga tingkat kematangan data, ditentukan per barang. */
export type KematanganPerkiraan = 'belum-bisa' | 'kasar' | 'mantap'

/** Tiga tingkat turun derajat saat layanan perkiraan tidak sehat. */
export type TingkatLayanan = 'segar' | 'tersimpan' | 'hitungan-sederhana' | 'tidak-tersedia'

export interface Perkiraan {
  barangId: string
  kematangan: KematanganPerkiraan
  tingkatLayanan: TingkatLayanan
  /** Stempel waktu perkiraan dibuat. Wajib tampil saat memakai data tersimpan. */
  dibuatPada: string | null
  hariCukup: number | null
  pakaiTigaHariMin: number | null
  pakaiTigaHariMaks: number | null
  saranBeli: number
  satuanSaran: string
  /** Maksimal 3 alasan berbasis fakta. Kosong berarti chip alasan tidak ditampilkan. */
  alasan: string[]
}

export interface TitikTren {
  tanggal: string
  aktual: number | null
  prediksi: number | null
  batasBawah?: number
  batasAtas?: number
}

/* ------------------------------------------------------------------ */
/* Distributor & penawaran                                             */
/* ------------------------------------------------------------------ */

export interface Distributor {
  id: string
  nama: string
  kota: string
  deskripsi: string
  warna: string
  rating: number | null
  jumlahUlasan: number
  jumlahUmkmPengulas: number
  jumlahPesananSelesai: number
  terverifikasi: boolean
  sejak: string
  subRating: { ketepatanWaktu: number; jumlahSesuai: number; kondisiBarang: number }
  kategori: string[]
  areaKirim: string[]
  /** Distributor baru tidak pernah ditampilkan sebagai "0,0 bintang". */
  baru: boolean
}

export interface Penawaran {
  id: string
  distributorId: string
  nama: string
  kategori: string
  /** Satuan jual distributor, mis. "kg". */
  satuan: string
  hargaSatuan: number
  /** Kelipatan pemesanan: 1 dus = 24 pcs. */
  kemasanJual: Kemasan | null
  stokTersedia: number
  stokDiperbaruiPada: string
  barangIdTerkait: string | null
  keterangan: string
}

/* ------------------------------------------------------------------ */
/* Kontrak                                                             */
/* ------------------------------------------------------------------ */

export interface PaketKontrak {
  id: string
  kode: string
  penawaranId: string
  distributorId: string
  durasiBulan: number
  kuotaMinPerBulan: number
  hargaSatuan: number
  hematPersen: number
  /** Ditulis distributor/admin. Kosong berarti UI menulis bahwa ketentuan belum dicantumkan. */
  ketentuanKuotaKurang: string | null
  ketentuanBerhenti: string | null
}

export type StatusKontrak =
  | 'menunggu-persetujuan'
  | 'aktif'
  | 'akan-berakhir'
  | 'selesai'
  | 'dihentikan'
  | 'ditolak'

/** Tiga status netral. Tidak memblokir apa pun, hanya memberi tahu. */
export type StatusKuota = 'aman' | 'perlu-dikejar' | 'kurang'

export interface PemenuhanBulanan {
  periode: string
  kuota: number
  diterima: number
  selesai: boolean
}

export interface Kontrak {
  id: string
  paketId: string
  distributorId: string
  penawaranId: string
  barangId: string
  namaBarang: string
  durasiBulan: number
  kuotaMinPerBulan: number
  hargaSatuan: number
  satuan: string
  mulai: string
  berakhir: string
  status: StatusKontrak
  riwayat: PemenuhanBulanan[]
  periodeBerjalan: PemenuhanBulanan
  /** Jumlah yang sudah dipesan tapi belum diterima. Segmen kedua pada bar kuota. */
  dalamPerjalanan: number
  ketentuanKuotaKurang: string | null
  pesananRutinAktif: boolean
  pesananRutinBerikutnya: string | null
  /** Alasan distributor saat menolak pengajuan kontrak; statusnya menjadi 'ditolak'. */
  alasanDitolak?: string | null
  /** Pengajuan berhenti dari pemilik usaha yang belum dijawab distributor. */
  pengajuanBerhenti?: { waktu: string; alasan: string } | null
  /** Jawaban distributor atas pengajuan berhenti yang terakhir. */
  jawabanBerhenti?: { waktu: string; disetujui: boolean; alasan: string | null } | null
}

/** Kontrak seperti yang dibaca distributor: selalu tahu milik toko yang mana. */
export interface KontrakPelanggan extends Kontrak {
  umkmId: string
}

/* ------------------------------------------------------------------ */
/* Pesanan                                                             */
/* ------------------------------------------------------------------ */

export type StatusPesanan =
  | 'draf'
  | 'menunggu-konfirmasi'
  | 'disiapkan'
  | 'dikirim'
  | 'selesai'
  | 'selesai-catatan'
  | 'batal'

export type StatusBayar = 'belum-dibayar' | 'bukti-terkirim' | 'dikonfirmasi'

export type AlasanSelisih = 'kurang' | 'lebih' | 'rusak' | 'kualitas-beda' | 'salah-barang'

export const LABEL_SELISIH: Record<AlasanSelisih, string> = {
  kurang: 'Kurang',
  lebih: 'Lebih',
  rusak: 'Rusak / bocor',
  'kualitas-beda': 'Kualitas beda',
  'salah-barang': 'Salah barang',
}

export interface BarisPesanan {
  penawaranId: string
  barangId: string | null
  nama: string
  jumlah: number
  satuan: string
  hargaSatuan: number
  /**
   * Harga sebelum potongan promo, dicatat saat pesanan dibuat. Kosong untuk
   * pesanan lama dan baris tanpa promo: artinya `hargaSatuan` sudah harga penuh.
   */
  hargaNormal?: number
  /** Promo yang memotong harga baris ini. Dicatat, bukan ditebak ulang dari tanggal. */
  promoId?: string | null
  /** Isi satuan pakai per satuan jual, untuk menghitung penambahan stok. */
  isiPerSatuan: number
  jumlahDiterima: number | null
  alasanSelisih: AlasanSelisih | null
  catatanPenerimaan: string | null
}

export interface JejakPesanan {
  waktu: string
  status: StatusPesanan
  keterangan: string
}

export interface Pesanan {
  id: string
  nomor: string
  distributorId: string
  kontrakId: string | null
  dibuatPada: string
  status: StatusPesanan
  baris: BarisPesanan[]
  ongkosKirim: number
  perkiraanTiba: string | null
  jejak: JejakPesanan[]
  statusBayar: StatusBayar
  jumlahBukti: number
  /** Pesanan yang lahir dari saran sistem, untuk mengukur kegunaan perkiraan. */
  dariSaran: boolean
  /** Pesanan rutin yang menunggu persetujuan tiap siklus. */
  dariRutin: boolean
  catatanUntukDistributor: string
  sudahDiulas: boolean
  /** Kode induk belanja saat satu keranjang melahirkan beberapa pesanan. */
  kodeBelanja: string | null
  /*
   * Tiga isian di bawah diisi dari sisi DISTRIBUTOR atau dibaca olehnya.
   * Pesanan disimpan sekali saja; portal distributor membaca pesanan yang sama
   * lewat `gabungPesananMasuk`, jadi tidak ada salinan yang bisa saling selisih.
   */
  /** Alasan distributor saat menolak. Terisi hanya kalau pesanan batal karena ditolak. */
  alasanTolak?: string | null
  /** Bukti antar dari distributor, terisi saat distributor menandai barang sudah sampai. */
  pengiriman?: BuktiPengiriman | null
  /** Penilaian yang dikirim pemilik usaha setelah pesanan selesai. */
  ulasan?: UlasanPelanggan | null
}

/* ------------------------------------------------------------------ */
/* Keranjang                                                           */
/* ------------------------------------------------------------------ */

export interface BarisKeranjang {
  penawaranId: string
  jumlah: number
  /** Jumlah yang semula disarankan sistem. Perubahan pengguna ditandai, bukan disembunyikan. */
  saranSistem: number | null
  /** Terikat kontrak aktif? Menentukan chip Kontrak vs Beli Lepas. */
  kontrakId: string | null
}

export interface SubKeranjang {
  distributorId: string
  baris: BarisKeranjang[]
  disimpanUntukNanti: boolean
}

/* ------------------------------------------------------------------ */
/* Saran belanja (sumber Lembar Pesan Cepat)                           */
/* ------------------------------------------------------------------ */

/** Tiga varian baris pada Lembar Pesan Cepat. */
export type VarianSaran = 'ada-kontrak' | 'ada-pemasok' | 'tanpa-pemasok'

export interface BarisSaran {
  barangId: string
  varian: VarianSaran
  penawaranId: string | null
  kontrakId: string | null
  jumlahSaran: number
  /** Kalimat pendek yang menjelaskan kenapa pemasok ini yang dipilih. */
  alasanPemasok: string | null
  /** Maksimal 3 butir fakta. Kosong berarti chip "Kenapa segini?" tidak ditampilkan. */
  alasanJumlah: string[]
  /** Jumlah yang sedang dikirim, sudah dikurangkan dari saran. */
  sedangDikirim: number
  kandidatLain: string[]
}

export interface SaranBelanja {
  id: string
  judul: string
  dibuatPada: string
  baris: BarisSaran[]
}

/* ------------------------------------------------------------------ */
/* Pemberitahuan                                                       */
/* ------------------------------------------------------------------ */

export type KategoriNotifikasi = 'stok' | 'saran-belanja' | 'pesanan' | 'kontrak' | 'sistem'
export type TingkatNotifikasi = 'genting' | 'penting' | 'biasa'

export interface Notifikasi {
  id: string
  kategori: KategoriNotifikasi
  tingkat: TingkatNotifikasi
  judul: string
  detail: string
  waktu: string
  dibaca: boolean
  /** Butuh tindakan? Hanya yang ini dihitung pada badge lonceng. */
  butuhTindakan: boolean
  tautan: string | null
  aksiLabel: string | null
  barangId: string | null
  /** Dibisukan sampai pesanan terkait selesai atau batal. */
  dibisukanSampai: string | null
}

/* ------------------------------------------------------------------ */
/* Ulasan                                                              */
/* ------------------------------------------------------------------ */

export interface Ulasan {
  id: string
  distributorId: string
  namaUsaha: string
  kotaUsaha: string
  rating: number
  isi: string
  waktu: string
  pesananId: string
  /** Label sistem yang tidak bisa diedit penulis. */
  labelSistem: string
  aspek: { ketepatanWaktu: number; jumlahSesuai: number; kondisiBarang: number }
}

/* ------------------------------------------------------------------ */
/* Promo distributor (slider Beranda)                                  */
/* ------------------------------------------------------------------ */

/**
 * Tiga skenario promo, dan hanya tiga.
 *
 * Jenis promo menentukan TEMPLATE KARTUNYA, bukan sekadar warnanya: dua toko
 * yang sama-sama mengadakan cuci gudang memakai latar dan susunan kartu yang
 * identik, dan yang berbeda cuma nama tokonya. Itu permintaan eksplisit dari
 * catatan, dan alasannya masuk akal: pemilik warung mengenali jenis promonya
 * dari bentuk kartu sebelum sempat membaca namanya.
 */
export type JenisPromo = 'cuci-gudang' | 'produk-baru' | 'membership'

export interface Promo {
  id: string
  jenis: JenisPromo
  distributorId: string
  /** Kalimat pendek di kartu. Nama toko TIDAK ditulis di sini, ia diambil dari distributor. */
  judul: string
  keterangan: string
  /** Berlaku sampai kapan. Null berarti tidak ada tenggat. */
  berakhir: string | null
  /** Penawaran yang ikut promo ini, dipakai halaman promo toko. */
  penawaranIds: string[]
  /** Potongan dalam persen. Null untuk promo yang tidak memotong harga. */
  potonganPersen: number | null
}

/**
 * Hasil penentuan harga satu baris beli. Dihasilkan HANYA oleh `rincianHarga`
 * di data/dummy, supaya katalog, keranjang, dan pesanan membaca angka yang sama.
 */
export interface RincianHarga {
  /** Harga yang benar-benar dibayar per satuan jual. */
  harga: number
  /** Harga penawaran sebelum kontrak atau promo menyentuhnya. */
  hargaNormal: number
  /** Promo yang memotong harga. Selalu null untuk baris berkontrak. */
  promo: Promo | null
  sumber: 'kontrak' | 'promo' | 'normal'
}

/* ------------------------------------------------------------------ */
/* Prediksi stok                                                       */
/* ------------------------------------------------------------------ */

/** Arah saran model: tambah stok, kurangi stok, atau biarkan saja. */
export type ArahPrediksi = 'tambah' | 'kurang' | 'tetap'

/**
 * Satu kartu rekomendasi hasil model.
 *
 * `jumlah` selalu positif dan selalu dalam SATUAN BELI, karena angka inilah
 * yang langsung masuk keranjang. Arahnya dibaca dari `arah`, bukan dari tanda
 * minus, supaya tidak ada layar yang menampilkan "−12 dus" kepada pemilik
 * warung.
 */
export interface RekomendasiPrediksi {
  barangId: string
  arah: ArahPrediksi
  /** Selalu positif, dalam satuan beli (satuanSaran). */
  jumlah: number
  satuanSaran: string
  /** Pemakaian bulan ini vs perkiraan bulan depan, dalam satuan pakai. */
  pemakaianBulanIni: number
  perkiraanBulanDepan: number
  /** Keyakinan model 0..1. Ditampilkan sebagai kata, bukan sebagai angka mentah. */
  keyakinan: number
  /** Maksimal 3 butir fakta yang menjelaskan kenapa saran ini muncul. */
  alasan: string[]
  penawaranId: string | null
  kontrakId: string | null
}

/* ------------------------------------------------------------------ */
/* Portal Distributor                                                  */
/* ------------------------------------------------------------------ */

/**
 * UMKM yang memesan kepada distributor.
 *
 * Koordinatnya dummy di sekitar Sleman & Kota Yogyakarta, cukup untuk
 * memperlihatkan sebaran titik pada peta purwarupa. Tidak ada integrasi peta
 * sungguhan: peta digambar sendiri dari kotak koordinat di bawah.
 */
export interface UmkmPemesan {
  id: string
  nama: string
  jenisUsaha: JenisUsaha
  kota: string
  alamat: string
  lat: number
  lng: number
  warna: string
  nomorHp: string
  sejak: string
}

/** Empat tahap pesanan di sisi distributor, hasil perbaikan kata dari catatan. */
export type StatusPesananMasuk =
  | 'menunggu-konfirmasi'
  | 'disiapkan'
  | 'dikirim'
  | 'selesai'
  | 'ditolak'

export interface BarisPesananMasuk {
  penawaranId: string
  nama: string
  jumlah: number
  satuan: string
  hargaSatuan: number
  /** Harga sebelum potongan promo; kosong berarti tidak ada potongan. */
  hargaNormal?: number
  promoId?: string | null
}

export interface JejakPesananMasuk {
  waktu: string
  status: StatusPesananMasuk
  keterangan: string
}

/** Bukti bahwa barang benar-benar diantar, ditampilkan pada lacak yang sudah Selesai. */
export interface BuktiPengiriman {
  kurir: string
  namaPengantar: string
  nomorResi: string
  diterimaOleh: string
  waktuSampai: string
  catatan: string
  /**
   * Keterangan foto bukti. Purwarupa ini menggambar bingkai berlabel, bukan
   * memuat berkas gambar: menaruh foto palsu akan membuat layar ini terlihat
   * lebih jadi daripada keadaannya.
   */
  foto: string[]
}

/** Penilaian dari UMKM setelah pesanan selesai, dilihat distributor. */
export interface UlasanPelanggan {
  rating: number
  isi: string
  waktu: string
  aspek: { ketepatanWaktu: number; jumlahSesuai: number; kondisiBarang: number }
}

export interface PesananMasuk {
  id: string
  nomor: string
  umkmId: string
  distributorId: string
  dibuatPada: string
  status: StatusPesananMasuk
  baris: BarisPesananMasuk[]
  ongkosKirim: number
  perkiraanTiba: string | null
  jejak: JejakPesananMasuk[]
  /** Wajib terisi begitu status menjadi 'ditolak'. */
  alasanTolak: string | null
  catatanDariUmkm: string
  /** Terisi saat status 'selesai'. */
  pengiriman: BuktiPengiriman | null
  ulasan: UlasanPelanggan | null
}

/**
 * Warna titik pada peta sebaran.
 *
 * Tiga status, bukan dua. Catatan asli menulis "ada 2 jenis titik" lalu
 * menyebut tiga warna; yang dipakai adalah tiga, dan tiap titik selalu
 * membawa keterangan teks di sampingnya karena warna tidak pernah berdiri
 * sendiri sebagai penanda status.
 */
export type WarnaTitik = 'biru' | 'merah' | 'oren'

export interface TitikPeta {
  umkmId: string
  warna: WarnaTitik
  /** Berapa pesanan UMKM ini yang masih punya titik di peta. Dipakai untuk angka di dalam lingkaran. */
  jumlahPesanan: number
  /** Rincian jumlahPesanan per kondisi. Kartu hitungan memakai ini, bukan warna dominan. */
  perWarna: Record<WarnaTitik, number>
  pesananIds: string[]
}
