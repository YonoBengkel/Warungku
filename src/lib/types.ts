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
export type TierLangganan = 'dasar' | 'premium'
export type StatusVerifikasi = 'menunggu' | 'terverifikasi' | 'perlu-diperbaiki'
export type TingkatVerifikasi = 'penuh' | 'dasar'

export interface ProfilUsaha {
  id: string
  namaUsaha: string
  jenisUsaha: string
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
  tier: TierLangganan
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
/* Stok                                                                */
/* ------------------------------------------------------------------ */

export type StatusStok = 'aman' | 'menipis' | 'habis' | 'kebanyakan'
export type SumberBatasAman = 'sistem' | 'sendiri' | 'belum-diatur'

export interface Kemasan {
  nama: string
  isi: number
}

export interface Barang {
  id: string
  nama: string
  /** Sebutan sehari-hari di warung. Ikut dicari supaya "skm" menemukan susu kental manis. */
  namaLain: string[]
  kategori: string
  kodeBarang: string
  /** Satu-satunya satuan tempat angka stok disimpan. */
  satuan: string
  /** Kemasan beli sebagai lapisan tampilan, boleh lebih dari satu. */
  kemasan: Kemasan[]
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

export type JenisPergerakan = 'terjual' | 'masuk' | 'koreksi' | 'hitung-fisik'

/** Alasan terstruktur supaya bisa dipisahkan dari data permintaan yang dikirim ke model. */
export type AlasanKoreksi =
  | 'basi'
  | 'rusak'
  | 'susut'
  | 'dipakai-sendiri'
  | 'hilang'
  | 'diretur'
  | 'salah-catat'
  | 'barang-datang'
  | 'retur-pelanggan'
  | 'pindahan'
  | 'lainnya'

export interface InfoAlasan {
  label: string
  arah: 'kurang' | 'tambah'
  /** Dihitung sebagai kerugian memakai harga beli terakhir. */
  kerugian: boolean
  wajibCatatan?: boolean
}

export const ALASAN_KOREKSI: Record<AlasanKoreksi, InfoAlasan> = {
  basi: { label: 'Basi / kedaluwarsa', arah: 'kurang', kerugian: true },
  rusak: { label: 'Rusak / pecah / tumpah', arah: 'kurang', kerugian: true },
  susut: { label: 'Susut saat diolah', arah: 'kurang', kerugian: true },
  'dipakai-sendiri': { label: 'Dipakai sendiri', arah: 'kurang', kerugian: false },
  hilang: { label: 'Hilang', arah: 'kurang', kerugian: true },
  diretur: { label: 'Diretur ke distributor', arah: 'kurang', kerugian: false },
  'salah-catat': { label: 'Salah catat sebelumnya', arah: 'kurang', kerugian: false },
  'barang-datang': { label: 'Barang datang belum tercatat', arah: 'tambah', kerugian: false },
  'retur-pelanggan': { label: 'Retur dari pelanggan', arah: 'tambah', kerugian: false },
  pindahan: { label: 'Pindahan dari gudang lain', arah: 'tambah', kerugian: false },
  lainnya: { label: 'Alasan lain', arah: 'kurang', kerugian: false, wajibCatatan: true },
}

export interface Pergerakan {
  id: string
  barangId: string
  waktu: string
  jenis: JenisPergerakan
  /** Positif untuk masuk, negatif untuk keluar. Dalam satuan pakai. */
  jumlah: number
  stokSesudah: number
  alasan: AlasanKoreksi | null
  keterangan: string
  /** Pesanan asal, supaya riwayat bisa diketuk balik ke pesanannya. */
  pesananId: string | null
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

export type StatusKontrak = 'menunggu-persetujuan' | 'aktif' | 'akan-berakhir' | 'selesai' | 'dihentikan'

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
