import type {
  ArahPrediksi,
  Barang,
  BarisPesananMasuk,
  BarisTransaksi,
  DataKasir,
  Distributor,
  Kontrak,
  Notifikasi,
  PaketKontrak,
  Penawaran,
  Pergerakan,
  Perkiraan,
  Pesanan,
  PesananMasuk,
  ProfilUsaha,
  Promo,
  RekomendasiPrediksi,
  RincianHarga,
  RiwayatKasir,
  SaranBelanja,
  StatusKuota,
  StatusStok,
  TitikTren,
  Transaksi,
  Ulasan,
  UmkmPemesan,
  WarnaTitik,
} from '@/lib/types'
import { angka } from '@/lib/format'
import { dariTampil, jumlahTampil, satuanTampil, satuanTampilBawaan } from '@/lib/satuan'
import { JAM_TITIK_BIRU } from '@/lib/label'

/**
 * Data contoh untuk skenario "ekosistem sudah berjalan".
 *
 * Semua tanggal dihitung relatif terhadap hari ini supaya kalimat "3 hari lagi"
 * dan "kemarin" selalu masuk akal. Angka pemakaian dibangkitkan dengan
 * pembangkit acak bersemai supaya grafik tidak berubah tiap render.
 */

export const HARI_INI = new Date(new Date().setHours(0, 0, 0, 0))

export function hariKe(selisih: number, jam = 0, menit = 0): string {
  const d = new Date(HARI_INI)
  d.setDate(d.getDate() + selisih)
  d.setHours(jam, menit, 0, 0)
  return d.toISOString()
}

function menitLalu(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

/**
 * Kejadian yang umurnya diukur dalam jam, bukan hari.
 *
 * Dipakai untuk hal-hal yang harus tetap "baru" kapan pun aplikasi dibuka,
 * misalnya pesanan yang belum dikonfirmasi dan titik peta yang hanya hidup 12
 * jam. Kalau memakai jam tetap pada hari ini, contohnya ikut basi tiap sore.
 */
function jamLalu(n: number): string {
  return menitLalu(Math.round(n * 60))
}

/** Potongan tanggal YYMMDD untuk nomor struk dan nomor pesanan. */
function kodeTanggal(selisih: number): string {
  const d = new Date(HARI_INI)
  d.setDate(d.getDate() + selisih)
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function acakBersemai(semai: number) {
  let a = semai >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ================================================================== */
/* Profil usaha                                                       */
/* ================================================================== */

export const profilAwal: ProfilUsaha = {
  id: 'usaha-1',
  namaUsaha: 'Kopi Kita Jogja',
  jenisUsaha: 'Kedai kopi & camilan',
  namaPemilik: 'Bagas Prasetyo',
  nib: '1204250031298',
  npwp: '',
  alamat: 'Jl. Kaliurang KM 5,6 No. 24, Sinduadi, Mlati',
  kota: 'Sleman, DI Yogyakarta',
  nomorHp: '081338827410',
  email: 'halo@kopikita.id',
  bio: 'Kedai kopi rumahan sejak 2021. Buka 07.00 sampai 23.00. Andalan kami kopi susu gula aren dan gorengan hangat.',
  warna: '#0f766e',
  caraHitung: 'keduanya',
  verifikasi: 'terverifikasi',
  tingkatVerifikasi: 'penuh',
  alasanPerbaikan: [],
  bergabungSejak: hariKe(-214),
  tampilkanAlamatKeDistributor: true,
  tampilkanNomorHpKeDistributor: true,
}

/* ================================================================== */
/* Data dari kasir                                                    */
/* ================================================================== */

export const dataKasirAwal: DataKasir = {
  sumber: 'kasir-digital',
  status: 'terhubung',
  merek: 'Kasir Open POS',
  terakhirMasuk: menitLalu(12),
  jumlahTransaksiHariIni: 63,
  menuBelumDipasangkan: [
    { id: 'mn-1', namaMenu: 'Kopi Susu Pandan', jumlahTerjual: 41, sejak: hariKe(-6) },
    { id: 'mn-2', namaMenu: 'Roti Bakar Keju', jumlahTerjual: 18, sejak: hariKe(-3) },
  ],
}

export const riwayatKasir: RiwayatKasir[] = [
  {
    id: 'rk-1',
    waktu: menitLalu(12),
    hasil: 'lengkap',
    jumlahTransaksi: 63,
    keterangan: '63 penjualan masuk. 41 baris bahan baku berkurang otomatis.',
  },
  {
    id: 'rk-2',
    waktu: hariKe(-1, 23, 58),
    hasil: 'sebagian',
    jumlahTransaksi: 118,
    keterangan: '118 penjualan masuk. 2 menu belum dipasangkan ke bahan, jadi stoknya belum berkurang.',
  },
  {
    id: 'rk-3',
    waktu: hariKe(-2, 23, 55),
    hasil: 'lengkap',
    jumlahTransaksi: 96,
    keterangan: '96 penjualan masuk. Semua bahan berkurang otomatis.',
  },
  {
    id: 'rk-4',
    waktu: hariKe(-3, 12, 10),
    hasil: 'tertunda',
    jumlahTransaksi: 0,
    keterangan: 'Data dari kasir sempat tertahan 8 menit, lalu masuk semua pada pencatatan berikutnya.',
  },
  {
    id: 'rk-5',
    waktu: hariKe(-3, 23, 57),
    hasil: 'lengkap',
    jumlahTransaksi: 134,
    keterangan: '134 penjualan masuk, termasuk yang sempat tertahan siang harinya.',
  },
]

/** Satu-satunya POS yang didukung. Formatnya jadi satu-satunya format struk yang dikenal aplikasi. */
export const POS_TUNGGAL = { id: 'kasir-open-pos', nama: 'Kasir Open POS', warna: '#0f766e' } as const

/* ================================================================== */
/* Transaksi — satu database struk untuk seluruh toko                 */
/* ================================================================== */

/**
 * Menu yang bisa muncul di struk, beserta bobot kemunculannya.
 *
 * Ini nama MENU JADI, bukan bahan baku. Struk memang tidak tahu apa-apa soal
 * gudang: pemetaan menu ke bahan baku terjadi belakangan, dan menu yang belum
 * dipetakan itulah yang muncul di `dataKasirAwal.menuBelumDipasangkan`.
 */
const MENU_STRUK: Array<{ nama: string; satuan: string; bobot: number }> = [
  { nama: 'Kopi Susu Gula Aren', satuan: 'gelas', bobot: 10 },
  { nama: 'Americano', satuan: 'gelas', bobot: 5 },
  { nama: 'Cappuccino', satuan: 'gelas', bobot: 4 },
  { nama: 'Es Teh Manis', satuan: 'gelas', bobot: 4 },
  { nama: 'Matcha Latte', satuan: 'gelas', bobot: 3 },
  { nama: 'Cokelat Panas', satuan: 'gelas', bobot: 3 },
  { nama: 'Teh Tarik', satuan: 'gelas', bobot: 3 },
  { nama: 'Roti Bakar Cokelat', satuan: 'porsi', bobot: 3 },
  { nama: 'Roti Bakar Keju', satuan: 'porsi', bobot: 2 },
  { nama: 'Kentang Goreng', satuan: 'porsi', bobot: 3 },
  { nama: 'Pisang Goreng Madu', satuan: 'porsi', bobot: 2 },
  { nama: 'Air Mineral', satuan: 'pcs', bobot: 2 },
]

const TOTAL_BOBOT_MENU = MENU_STRUK.reduce((t, m) => t + m.bobot, 0)

const KASIR_JAGA = ['Bagas Prasetyo', 'Sinta', 'Rizal']

function pilihMenu(undi: number) {
  let sisa = undi * TOTAL_BOBOT_MENU
  for (const m of MENU_STRUK) {
    sisa -= m.bobot
    if (sisa < 0) return m
  }
  return MENU_STRUK[MENU_STRUK.length - 1]
}

/**
 * Struk sembilan hari terakhir, dikelompokkan per hari.
 *
 * Kelompoknya sengaja dipertahankan karena riwayat pergerakan perlu menunjuk
 * struk terakhir pada hari yang sama, dan mencocokkan ulang lewat tanggal ISO
 * rawan meleset satu hari untuk zona waktu di timur UTC.
 */
function bangkitkanTransaksi(): Transaksi[][] {
  const rnd = acakBersemai(20260918)
  const perHari: Transaksi[][] = []
  let n = 0

  for (let h = 0; h < 9; h++) {
    // Hari ini baru berjalan separuh, jadi contohnya lebih sedikit daripada hari penuh.
    const jumlahStruk = h === 0 ? 4 + Math.floor(rnd() * 3) : 7 + Math.floor(rnd() * 4)
    // Yang benar-benar terjadi di kasir jauh lebih banyak; yang disimpan di sini cuplikan.
    const totalHariItu = 60 + Math.floor(rnd() * 70)
    const hariIni: Transaksi[] = []

    for (let i = 0; i < jumlahStruk; i++) {
      // Jam buka 07.30 sampai 22.30, digeser maju supaya urutannya selalu menanjak.
      const total = 7 * 60 + 30 + Math.floor(((i + rnd() * 0.8) / jumlahStruk) * 15 * 60)
      const jam = Math.floor(total / 60)
      const menit = total % 60

      const baris: BarisTransaksi[] = []
      const jumlahBaris = 1 + Math.floor(rnd() * 4)
      for (let j = 0; j < jumlahBaris; j++) {
        const menu = pilihMenu(rnd())
        const jumlah = 1 + Math.floor(rnd() * 3)
        const sudahAda = baris.find((x) => x.nama === menu.nama)
        // Satu menu cuma boleh sekali per struk; pesanan kedua menambah jumlahnya.
        if (sudahAda) sudahAda.jumlah += jumlah
        else baris.push({ nama: menu.nama, jumlah, satuan: menu.satuan })
      }

      const urut = Math.max(1, Math.round(((i + 1) / jumlahStruk) * totalHariItu))
      hariIni.push({
        id: `tr-${String((n += 1)).padStart(3, '0')}`,
        nomorStruk: `KOP-${kodeTanggal(-h)}-${String(urut).padStart(4, '0')}`,
        waktu: hariKe(-h, jam, menit),
        baris,
        // Kedai ini dua sif: yang jaga pagi bukan yang jaga malam.
        kasir: jam < 15 ? KASIR_JAGA[h % 3] : KASIR_JAGA[(h + 1) % 3],
      })
    }

    perHari.push(hariIni)
  }

  return perHari
}

/** Indeks = berapa hari lalu. Tiap kelompok urut menanjak menurut waktu. */
const strukPerHari = bangkitkanTransaksi()

export const daftarTransaksi: Transaksi[] = strukPerHari
  .flat()
  .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu))

export function transaksiById(id: string): Transaksi | undefined {
  return daftarTransaksi.find((t) => t.id === id)
}

/* ================================================================== */
/* Stok                                                               */
/* ================================================================== */

export const daftarBarang: Barang[] = [
  {
    id: 'b-01',
    nama: 'Biji Kopi Arabika Gayo',
    deskripsi: 'Biji utuh, sangrai medium',
    namaLain: ['kopi gayo', 'arabika'],
    kategori: 'Kopi & Teh',
    kodeBarang: 'KP-001',
    satuan: 'gram',
    kemasan: [{ nama: 'kg', isi: 1000 }],
    stok: 3400,
    batasAman: 5000,
    batasAmanSaran: 6200,
    sumberBatasAman: 'sendiri',
    hariKirim: 2,
    hargaBeliTerakhir: 148,
    pemakaianHarian: 780,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: true,
    kedaluwarsa: hariKe(41),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Giling halus untuk espresso.',
  },
  {
    id: 'b-02',
    nama: 'Susu UHT Full Cream',
    deskripsi: 'Kotak 1 liter',
    namaLain: ['susu', 'uht'],
    kategori: 'Susu & Olahan',
    kodeBarang: 'SS-002',
    satuan: 'ml',
    kemasan: [
      { nama: 'liter', isi: 1000 },
      { nama: 'dus', isi: 12000 },
    ],
    stok: 9600,
    batasAman: 24000,
    batasAmanSaran: 28000,
    sumberBatasAman: 'sistem',
    hariKirim: 2,
    hargaBeliTerakhir: 18,
    pemakaianHarian: 4100,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: true,
    kedaluwarsa: hariKe(12),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-03',
    nama: 'Gula Aren Cair',
    deskripsi: 'Jeriken 5 liter',
    namaLain: ['gula aren', 'aren'],
    kategori: 'Pemanis',
    kodeBarang: 'GA-003',
    satuan: 'ml',
    kemasan: [{ nama: 'jerigen', isi: 5000 }],
    stok: 1800,
    batasAman: 4000,
    batasAmanSaran: 5500,
    sumberBatasAman: 'sendiri',
    hariKirim: 3,
    hargaBeliTerakhir: 37.4,
    pemakaianHarian: 950,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(64),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Bahan utama menu terlaris.',
  },
  {
    id: 'b-04',
    nama: 'Es Batu Kristal',
    deskripsi: 'Karung 20 kg',
    namaLain: ['es', 'es balok'],
    kategori: 'Pendukung',
    kodeBarang: 'ES-004',
    satuan: 'kg',
    kemasan: [{ nama: 'karung', isi: 20 }],
    stok: 4,
    batasAman: 25,
    batasAmanSaran: 32,
    sumberBatasAman: 'sistem',
    hariKirim: 1,
    hargaBeliTerakhir: 2100,
    pemakaianHarian: 11,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: null,
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Dikirim harian, tidak bisa ditimbun.',
  },
  {
    id: 'b-05',
    nama: 'Gelas Plastik 16 oz',
    deskripsi: '16 oz, bening',
    namaLain: ['gelas', 'cup'],
    kategori: 'Kemasan',
    kodeBarang: 'KM-005',
    satuan: 'pcs',
    kemasan: [{ nama: 'dus', isi: 1000 }],
    stok: 620,
    batasAman: 1500,
    batasAmanSaran: 1800,
    sumberBatasAman: 'sistem',
    hariKirim: 1,
    hargaBeliTerakhir: 285,
    pemakaianHarian: 132,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: null,
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-06',
    nama: 'Sedotan Kertas',
    deskripsi: 'Diameter 6 mm',
    namaLain: ['sedotan', 'straw'],
    kategori: 'Kemasan',
    kodeBarang: 'KM-006',
    satuan: 'pcs',
    kemasan: [{ nama: 'dus', isi: 2000 }],
    stok: 2450,
    batasAman: 1200,
    batasAmanSaran: 1400,
    sumberBatasAman: 'sistem',
    hariKirim: 1,
    hargaBeliTerakhir: 84,
    pemakaianHarian: 128,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: null,
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-07',
    nama: 'Teh Hitam Premium',
    deskripsi: 'Daun kering, curah',
    namaLain: ['teh'],
    kategori: 'Kopi & Teh',
    kodeBarang: 'TH-007',
    satuan: 'gram',
    kemasan: [{ nama: 'kg', isi: 1000 }],
    stok: 1850,
    batasAman: 800,
    batasAmanSaran: 900,
    sumberBatasAman: 'sistem',
    hariKirim: 2,
    hargaBeliTerakhir: 96,
    pemakaianHarian: 62,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(120),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-08',
    nama: 'Roti Tawar Gandum',
    deskripsi: 'Bungkus isi 20 lembar',
    namaLain: ['roti'],
    kategori: 'Bahan Makanan',
    kodeBarang: 'RT-008',
    satuan: 'lembar',
    kemasan: [{ nama: 'bungkus', isi: 20 }],
    stok: 34,
    batasAman: 60,
    batasAmanSaran: 72,
    sumberBatasAman: 'sendiri',
    hariKirim: 1,
    hargaBeliTerakhir: 975,
    pemakaianHarian: 22,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: true,
    kedaluwarsa: hariKe(3),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Masa simpan pendek, jangan pesan banyak.',
  },
  {
    id: 'b-09',
    nama: 'Telur Ayam Negeri',
    deskripsi: 'Ukuran sedang',
    namaLain: ['telor', 'telur'],
    kategori: 'Protein',
    kodeBarang: 'TL-009',
    satuan: 'butir',
    kemasan: [{ nama: 'krat', isi: 180 }],
    stok: 96,
    batasAman: 120,
    batasAmanSaran: 150,
    sumberBatasAman: 'sistem',
    hariKirim: 2,
    hargaBeliTerakhir: 283,
    pemakaianHarian: 28,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: true,
    kedaluwarsa: hariKe(9),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-10',
    nama: 'Keju Cheddar Lembaran',
    deskripsi: 'Pak isi 50 lembar',
    namaLain: ['keju'],
    kategori: 'Susu & Olahan',
    kodeBarang: 'KJ-010',
    satuan: 'lembar',
    kemasan: [{ nama: 'pak', isi: 50 }],
    // Sengaja di atas kebutuhan sebulan (perkiraan 233 lembar): setelah arah
    // "kurang" diperketat, contoh barang yang benar-benar berlebih tinggal
    // satu, padahal layar Beranda dan Prediksi perlu lebih dari satu.
    stok: 260,
    batasAman: 60,
    batasAmanSaran: 65,
    sumberBatasAman: 'sistem',
    hariKirim: 2,
    hargaBeliTerakhir: 1240,
    pemakaianHarian: 9,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: true,
    kedaluwarsa: hariKe(28),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-11',
    nama: 'Sirup Vanila',
    deskripsi: 'Botol 750 ml',
    namaLain: ['vanila', 'sirup'],
    kategori: 'Pemanis',
    kodeBarang: 'SR-011',
    satuan: 'ml',
    kemasan: [{ nama: 'botol', isi: 750 }],
    stok: 410,
    batasAman: 600,
    batasAmanSaran: 700,
    sumberBatasAman: 'sistem',
    hariKirim: 3,
    hargaBeliTerakhir: 104,
    pemakaianHarian: 78,
    hariDataTerkumpul: 21,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(150),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-12',
    nama: 'Air Mineral Galon',
    deskripsi: 'Galon 19 liter',
    namaLain: ['galon', 'air'],
    kategori: 'Pendukung',
    kodeBarang: 'AR-012',
    satuan: 'galon',
    kemasan: [],
    stok: 7,
    batasAman: 4,
    batasAmanSaran: 5,
    sumberBatasAman: 'sistem',
    hariKirim: 1,
    hargaBeliTerakhir: 21000,
    pemakaianHarian: 1.4,
    hariDataTerkumpul: 0,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: null,
    terhubungKasir: false,
    dicatatManual: true,
    catatan: 'Dicatat manual, memang tidak lewat kasir.',
  },
  {
    id: 'b-13',
    nama: 'Kentang Beku Shoestring',
    deskripsi: 'Pak 1 kg',
    namaLain: ['kentang', 'french fries'],
    kategori: 'Bahan Makanan',
    kodeBarang: 'KT-013',
    satuan: 'gram',
    kemasan: [{ nama: 'pak', isi: 1000 }],
    stok: 2100,
    batasAman: 3000,
    batasAmanSaran: 3400,
    sumberBatasAman: 'sistem',
    hariKirim: 2,
    hargaBeliTerakhir: 43,
    pemakaianHarian: 380,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(85),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-14',
    nama: 'Minyak Goreng Kemasan',
    deskripsi: 'Jeriken 5 liter',
    namaLain: ['minyak'],
    kategori: 'Bahan Makanan',
    kodeBarang: 'MG-014',
    satuan: 'ml',
    kemasan: [{ nama: 'jerigen', isi: 5000 }],
    stok: 0,
    batasAman: 4000,
    batasAmanSaran: 5000,
    sumberBatasAman: 'sistem',
    hariKirim: 2,
    hargaBeliTerakhir: 18.8,
    pemakaianHarian: 320,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(200),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Habis sejak kemarin sore.',
  },
  {
    id: 'b-15',
    nama: 'Cup Sealer Film',
    deskripsi: 'Gulungan untuk cup 16–22 oz',
    namaLain: ['film', 'sealer'],
    kategori: 'Kemasan',
    kodeBarang: 'KM-015',
    satuan: 'roll',
    kemasan: [],
    stok: 5,
    batasAman: 10,
    batasAmanSaran: 3,
    sumberBatasAman: 'bawaan',
    hariKirim: 2,
    hargaBeliTerakhir: 115000,
    pemakaianHarian: 0.12,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: null,
    terhubungKasir: false,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-16',
    nama: 'Bubuk Cokelat',
    deskripsi: 'Bubuk murni, kantong 1 kg',
    namaLain: ['coklat', 'cokelat'],
    kategori: 'Kopi & Teh',
    kodeBarang: 'CK-016',
    satuan: 'gram',
    kemasan: [{ nama: 'kg', isi: 1000 }],
    stok: 740,
    batasAman: 900,
    batasAmanSaran: 1100,
    sumberBatasAman: 'sendiri',
    hariKirim: 2,
    hargaBeliTerakhir: 112,
    pemakaianHarian: 96,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(75),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: null,
  },
  {
    id: 'b-17',
    nama: 'Matcha Bubuk',
    deskripsi: 'Grade latte',
    namaLain: ['matcha', 'greentea'],
    kategori: 'Kopi & Teh',
    kodeBarang: 'MC-017',
    satuan: 'gram',
    kemasan: [{ nama: 'kg', isi: 1000 }],
    stok: 640,
    batasAman: 400,
    batasAmanSaran: 520,
    sumberBatasAman: 'sistem',
    hariKirim: 3,
    hargaBeliTerakhir: 420,
    pemakaianHarian: 54,
    hariDataTerkumpul: 6,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: hariKe(110),
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Menu baru, dijual sejak minggu lalu.',
  },
  {
    id: 'b-18',
    nama: 'Gelas Plastik 22 oz',
    deskripsi: '22 oz, bening',
    namaLain: ['gelas besar'],
    kategori: 'Kemasan',
    kodeBarang: 'KM-018',
    satuan: 'pcs',
    kemasan: [{ nama: 'dus', isi: 1000 }],
    stok: 4800,
    batasAman: 800,
    batasAmanSaran: 900,
    sumberBatasAman: 'sistem',
    hariKirim: 1,
    hargaBeliTerakhir: 340,
    pemakaianHarian: 14,
    hariDataTerkumpul: 96,
    ingatkanKedaluwarsa: false,
    kedaluwarsa: null,
    terhubungKasir: true,
    dicatatManual: false,
    catatan: 'Kebanyakan pesan bulan lalu.',
  },
]

export const kategoriBarang = Array.from(new Set(daftarBarang.map((b) => b.kategori))).sort()

/**
 * Batas aman bawaan, dalam SATUAN TAMPIL barangnya: 10 kg, 10 liter, 10 pcs.
 * Dipakai selama pemilik usaha belum mengatur angkanya sendiri.
 */
export const BATAS_AMAN_BAWAAN = 10

/** Batas aman bawaan dalam satuan simpan barang ini. */
export function batasAmanBawaan(b: Pick<Barang, 'satuan' | 'kemasan' | 'satuanTampil'>): number {
  return dariTampil(b, BATAS_AMAN_BAWAAN)
}

/**
 * Status stok: tiga tingkat, IF-ELSE dengan ambang yang diatur pemilik usaha.
 *
 *   sisa ≤ 0            → habis
 *   sisa < batas aman   → menipis
 *   selain itu          → aman
 *
 * Tidak ada tingkat keempat. Batas aman yang belum diatur pun tetap punya
 * angka (bawaan 10), jadi tidak ada barang yang diam-diam tidak pernah
 * menipis sampai tiba-tiba habis.
 */
export function statusStok(b: Barang): StatusStok {
  if (b.stok <= 0) return 'habis'
  const batas = b.batasAman > 0 ? b.batasAman : batasAmanBawaan(b)
  if (b.stok < batas) return 'menipis'
  return 'aman'
}

export function hariCukup(b: Barang): number | null {
  if (b.pemakaianHarian <= 0) return null
  return Math.floor(b.stok / b.pemakaianHarian)
}

/** Menampilkan stok sebagai kemasan beli, mis. "3 dus + 2 pcs". */
/**
 * Sisa stok dipecah ke kemasan terbesarnya: "3 dus + 6 liter".
 *
 * Kosong kalau satuan tampilnya memang kemasan itu (angkanya sudah dalam dus,
 * jadi pecahan ini cuma mengulang), atau kalau isinya belum genap satu kemasan.
 * Sisa pecahannya ditulis dalam satuan bawaan (kg/liter), bukan gram/ml.
 */
export function dalamKemasan(b: Barang): string | null {
  const k = b.kemasan[b.kemasan.length - 1]
  if (!k || k.isi <= 1) return null
  if (satuanTampil(b).nama === k.nama) return null
  const utuh = Math.floor(b.stok / k.isi)
  const sisa = Math.round((b.stok - utuh * k.isi) * 10) / 10
  if (utuh === 0) return null
  if (sisa <= 0) return `${utuh} ${k.nama}`
  const bawaan = satuanTampilBawaan(b)
  const sisaTampil = sisa / bawaan.isi
  return `${utuh} ${k.nama} + ${angka(sisaTampil, Number.isInteger(sisaTampil) ? 0 : 2)} ${bawaan.nama}`
}

/* ================================================================== */
/* Riwayat pergerakan                                                 */
/* ================================================================== */

/**
 * Pergerakan yang ditulis tangan: koreksi, barang masuk, dan hitung fisik.
 *
 * Sengaja tanpa `stokSesudah`. Kolom "stok jadi" adalah satu-satunya cara
 * pemilik usaha mengaudit selisih stok, jadi angkanya tidak boleh ditulis
 * tangan berdampingan dengan angka yang dihitung — dulu begitu, dan hasilnya
 * stok terlihat naik setelah menjual.
 */
const pergerakanManual: Array<Omit<Pergerakan, 'stokSesudah'>> = [
  {
    id: 'pg-m1',
    barangId: 'b-02',
    waktu: hariKe(-1, 9, 15),
    jenis: 'koreksi',
    jumlah: -2000,
    keterangan: 'Koreksi stok',
    pesananId: null,
    transaksiId: null,
    oleh: 'Bagas Prasetyo',
  },
  {
    id: 'pg-m2',
    barangId: 'b-08',
    waktu: hariKe(-2, 8, 40),
    jenis: 'koreksi',
    jumlah: -6,
    keterangan: 'Koreksi stok',
    pesananId: null,
    transaksiId: null,
    oleh: 'Sinta',
  },
  {
    id: 'pg-m3',
    barangId: 'b-01',
    waktu: hariKe(-4, 10, 5),
    jenis: 'masuk',
    jumlah: 5000,
    keterangan: 'Masuk dari pesanan PS-260907-04',
    pesananId: 'ps-04',
    transaksiId: null,
    oleh: 'Bagas Prasetyo',
  },
  {
    id: 'pg-m4',
    barangId: 'b-05',
    waktu: hariKe(-6, 14, 20),
    jenis: 'hitung-fisik',
    jumlah: -45,
    keterangan: 'Hasil hitung fisik bulanan',
    pesananId: null,
    transaksiId: null,
    oleh: 'Bagas Prasetyo',
  },
  {
    id: 'pg-m5',
    barangId: 'b-03',
    waktu: hariKe(-3, 16, 0),
    jenis: 'koreksi',
    jumlah: -150,
    keterangan: 'Koreksi stok',
    pesananId: null,
    transaksiId: null,
    oleh: 'Bagas Prasetyo',
  },
]

function bangkitkanPergerakan(): Pergerakan[] {
  const tanpaStok: Array<Omit<Pergerakan, 'stokSesudah'>> = []
  const rnd = acakBersemai(20260913)
  let n = 0

  for (const b of daftarBarang) {
    if (!b.terhubungKasir) continue
    for (let h = 0; h < 9; h++) {
      const pakai = Math.round(b.pemakaianHarian * (0.75 + rnd() * 0.5) * 10) / 10
      if (pakai <= 0) continue
      // Satu baris merangkum pemakaian sehari penuh, jadi yang dirujuk struk
      // terakhir hari itu: dari situ pemilik usaha bisa menelusuri ke belakang.
      const strukHariItu = strukPerHari[h]
      tanpaStok.push({
        id: `pg-${(n += 1)}`,
        barangId: b.id,
        // Hari ini dicatat sejam sebelum sekarang, bukan jam 23.50 yang belum
        // terjadi: koreksi yang disimpan pengguna harus tampil di atasnya.
        waktu: h === 0 ? menitLalu(60) : hariKe(-h, 23, 50),
        jenis: 'terjual',
        jumlah: -pakai,
            keterangan: 'Terjual dari kasir',
        pesananId: null,
        transaksiId: strukHariItu.length > 0 ? strukHariItu[strukHariItu.length - 1].id : null,
        oleh: 'Data kasir',
      })
    }
  }

  tanpaStok.push(...pergerakanManual)

  // Semua pergerakan satu barang — dari kasir maupun tulisan tangan — ikut
  // satu jalan mundur: baris terbaru berakhir di stok sekarang, baris di
  // bawahnya dihitung dari baris di atasnya. Dengan begitu tiap baris riwayat
  // bisa dijumlahkan dari baris di bawahnya, berapa pun urutan kejadiannya.
  const hasil: Pergerakan[] = []
  for (const b of daftarBarang) {
    const milikBarang = tanpaStok
      .filter((p) => p.barangId === b.id)
      .sort((x, y) => +new Date(y.waktu) - +new Date(x.waktu))
    let stok = b.stok
    for (const p of milikBarang) {
      hasil.push({ ...p, stokSesudah: Math.round(stok * 10) / 10 })
      stok -= p.jumlah
    }
  }

  return hasil.sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu))
}

export const daftarPergerakan = bangkitkanPergerakan()

/* ================================================================== */
/* Perkiraan                                                          */
/* ================================================================== */

/**
 * Kematangan ditentukan per barang, bukan per akun. Di bawah 14 hari data,
 * tidak ada angka perkiraan sama sekali — peringatan stok tipis tetap jalan
 * karena ia hanya butuh rata-rata sederhana, bukan model.
 */
export function perkiraanUntuk(b: Barang): Perkiraan {
  const kematangan =
    b.hariDataTerkumpul < 14 ? 'belum-bisa' : b.hariDataTerkumpul < 28 ? 'kasar' : 'mantap'
  const cukup = hariCukup(b)

  // Barang yang dicatat manual tidak punya data permintaan, jadi tidak diperkirakan.
  if (b.dicatatManual) {
    return {
      barangId: b.id,
      kematangan: 'belum-bisa',
      tingkatLayanan: 'segar',
      dibuatPada: null,
      hariCukup: null,
      pakaiTigaHariMin: null,
      pakaiTigaHariMaks: null,
      saranBeli: 0,
      satuanSaran: b.satuan,
      alasan: [],
    }
  }

  const lebar = kematangan === 'kasar' ? 0.34 : 0.16
  const pakai3 = b.pemakaianHarian * 3
  const kemasan = b.kemasan[b.kemasan.length - 1]
  const isi = kemasan?.isi ?? 1
  const butuh = Math.max(0, b.pemakaianHarian * 14 - b.stok)

  const alasan: string[] = []
  if (kematangan !== 'belum-bisa') {
    alasan.push(`Rata-rata terpakai ${jumlahTampil(b, b.pemakaianHarian)} per hari.`)
    if (b.id === 'b-02' || b.id === 'b-03') alasan.push('Akhir pekan lalu pemakaiannya naik 40%.')
    alasan.push(`Kiriman biasanya sampai ${b.hariKirim} hari setelah dipesan.`)
  }

  return {
    barangId: b.id,
    kematangan,
    tingkatLayanan: 'segar',
    dibuatPada: hariKe(0, 6, 0),
    hariCukup: kematangan === 'belum-bisa' ? null : cukup,
    pakaiTigaHariMin: kematangan === 'belum-bisa' ? null : Math.round(pakai3 * (1 - lebar)),
    pakaiTigaHariMaks: kematangan === 'belum-bisa' ? null : Math.round(pakai3 * (1 + lebar)),
    saranBeli: Math.max(butuh > 0 ? 1 : 0, Math.ceil(butuh / isi)),
    satuanSaran: kemasan?.nama ?? b.satuan,
    alasan: alasan.slice(0, 3),
  }
}

/** Tren 14 hari ke belakang + 7 hari perkiraan. */
export function trenBarang(barangId: string): TitikTren[] {
  const b = daftarBarang.find((x) => x.id === barangId)
  if (!b) return []
  const rnd = acakBersemai(barangId.split('').reduce((a, c) => a + c.charCodeAt(0), 7))
  const titik: TitikTren[] = []

  for (let i = -13; i <= 0; i++) {
    const d = new Date(HARI_INI)
    d.setDate(d.getDate() + i)
    const akhirPekan = d.getDay() === 0 || d.getDay() === 6
    const dasar = b.pemakaianHarian * (akhirPekan ? 1.32 : 0.94)
    titik.push({ tanggal: hariKe(i), aktual: Math.round(dasar * (0.85 + rnd() * 0.3)), prediksi: null })
  }

  const perkiraan = perkiraanUntuk(b)
  if (perkiraan.kematangan === 'belum-bisa') return titik

  const lebarDasar = perkiraan.kematangan === 'kasar' ? 0.2 : 0.1
  for (let i = 1; i <= 7; i++) {
    const d = new Date(HARI_INI)
    d.setDate(d.getDate() + i)
    const akhirPekan = d.getDay() === 0 || d.getDay() === 6
    const p = Math.round(b.pemakaianHarian * (akhirPekan ? 1.32 : 0.96) * (0.95 + rnd() * 0.12))
    const lebar = lebarDasar + i * 0.028
    titik.push({
      tanggal: hariKe(i),
      aktual: null,
      prediksi: p,
      batasBawah: Math.round(p * (1 - lebar)),
      batasAtas: Math.round(p * (1 + lebar)),
    })
  }
  return titik
}

/* ================================================================== */
/* Tren bulanan (halaman Prediksi)                                    */
/* ================================================================== */

/**
 * Sebulan dihitung 30 hari, bukan panjang kalender sebenarnya.
 *
 * Halaman Prediksi membandingkan bulan dengan bulan, dan perbandingan itu jadi
 * menyesatkan kalau Februari otomatis terlihat lebih sepi hanya karena harinya
 * lebih sedikit.
 */
const HARI_PER_BULAN = 30

function semaiDari(teks: string): number {
  let a = 2166136261
  for (let i = 0; i < teks.length; i++) a = Math.imul(a ^ teks.charCodeAt(i), 16777619)
  return a >>> 0
}

/** Tanggal 1 pada bulan sekian, dipakai sebagai sumbu grafik bulanan. */
function awalBulan(selisih: number): string {
  const d = new Date(HARI_INI)
  d.setDate(1)
  d.setMonth(d.getMonth() + selisih)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Pemakaian satu barang pada bulan tertentu, `mundur` bulan ke belakang.
 *
 * Satu-satunya sumber angka bulanan di berkas ini. Semua fungsi tren dan kartu
 * rekomendasi memanggil ini supaya layar tidak pernah memperlihatkan dua angka
 * berbeda untuk bulan yang sama.
 */
function pemakaianBulan(b: Barang, mundur: number): number {
  const rnd = acakBersemai(semaiDari(`${b.id}|${mundur}`))
  // Usaha yang sedang tumbuh: makin ke belakang, makin sepi.
  const arah = Math.max(0.5, 1 - mundur * 0.05)
  return Math.max(0, Math.round(b.pemakaianHarian * HARI_PER_BULAN * arah * (0.9 + rnd() * 0.2)))
}

/**
 * Perkiraan bulan depan: laju bulan ini terhadap bulan lalu, dijaga di rentang
 * wajar. Model boleh salah, tapi tidak boleh melompat dua kali lipat hanya
 * karena satu bulan kebetulan ramai.
 */
function perkiraanBulanDepan(b: Barang): number {
  const bulanIni = pemakaianBulan(b, 0)
  const bulanLalu = pemakaianBulan(b, 1)
  const laju = bulanLalu > 0 ? bulanIni / bulanLalu : 1
  return Math.max(0, Math.round(bulanIni * Math.min(1.25, Math.max(0.85, laju))))
}

/** Bentuk baku semua grafik bulanan: 6 bulan aktual + 1 bulan perkiraan. */
function trenDari(kumpulan: Barang[]): TitikTren[] {
  const titik: TitikTren[] = []
  for (let i = 5; i >= 0; i--) {
    titik.push({
      tanggal: awalBulan(-i),
      aktual: kumpulan.reduce((t, b) => t + pemakaianBulan(b, i), 0),
      prediksi: null,
    })
  }
  const p = kumpulan.reduce((t, b) => t + perkiraanBulanDepan(b), 0)
  titik.push({
    tanggal: awalBulan(1),
    aktual: null,
    prediksi: p,
    batasBawah: Math.round(p * 0.88),
    batasAtas: Math.round(p * 1.12),
  })
  return titik
}

export function trenBulanan(barangId: string): TitikTren[] {
  const b = daftarBarang.find((x) => x.id === barangId)
  return b ? trenDari([b]) : []
}

/**
 * Tren satu kategori. Angkanya penjumlahan satuan pakai yang berbeda-beda
 * (gram, pcs, lembar), jadi yang dibaca pemilik usaha adalah bentuk kurvanya,
 * bukan nilai mutlaknya — dan layar wajib menuliskannya begitu.
 */
export function trenKategori(kategori: string): TitikTren[] {
  // Hanya barang yang layak diperkirakan. Kalau tidak disaring, grafik
  // kategori menghitung barang yang halaman yang sama nyatakan datanya
  // belum cukup — dua pernyataan bertentangan di satu layar.
  return trenDari(daftarBarang.filter((b) => b.kategori === kategori && layakDiperkirakan(b)))
}

export function trenKeseluruhan(): TitikTren[] {
  return trenDari(daftarBarang.filter(layakDiperkirakan))
}

export function ringkasanKategori(): Array<{
  kategori: string
  pemakaianBulanIni: number
  perkiraanBulanDepan: number
  jumlahBarang: number
  jumlahDiperkirakan: number
}> {
  return kategoriBarang.map((kategori) => {
    const isi = daftarBarang.filter((b) => b.kategori === kategori)
    // Angkanya hanya dari barang yang layak diperkirakan, tapi `jumlahBarang`
    // tetap seluruh isi kategori — itu memang jumlah barangnya. Selisihnya
    // dibaca dari `jumlahDiperkirakan` supaya layar bisa berterus terang
    // berapa barang yang benar-benar ikut dihitung.
    const diperkirakan = isi.filter(layakDiperkirakan)
    return {
      kategori,
      pemakaianBulanIni: diperkirakan.reduce((t, b) => t + pemakaianBulan(b, 0), 0),
      perkiraanBulanDepan: diperkirakan.reduce((t, b) => t + perkiraanBulanDepan(b), 0),
      jumlahBarang: isi.length,
      jumlahDiperkirakan: diperkirakan.length,
    }
  })
}

/* ================================================================== */
/* Distributor                                                        */
/* ================================================================== */

export const daftarDistributor: Distributor[] = [
  {
    id: 'd-01',
    nama: 'Sumber Tani Nusantara',
    kota: 'Sleman',
    deskripsi:
      'Pemasok biji kopi single origin dan teh dari petani binaan di Gayo, Toraja, dan Temanggung. Sangrai sesuai pesanan.',
    warna: '#0f766e',
    rating: 4.7,
    jumlahUlasan: 38,
    jumlahUmkmPengulas: 26,
    jumlahPesananSelesai: 412,
    terverifikasi: true,
    sejak: 'Mar 2019',
    subRating: { ketepatanWaktu: 4.8, jumlahSesuai: 4.7, kondisiBarang: 4.6 },
    kategori: ['Kopi & Teh'],
    areaKirim: ['Sleman', 'Kota Yogyakarta', 'Bantul'],
    baru: false,
  },
  {
    id: 'd-02',
    nama: 'Dairy Prima Jaya',
    kota: 'Kota Yogyakarta',
    deskripsi: 'Distributor susu UHT, keju, dan olahan susu dengan rantai dingin terjaga sampai lokasi.',
    warna: '#1d4ed8',
    rating: 4.5,
    jumlahUlasan: 24,
    jumlahUmkmPengulas: 19,
    jumlahPesananSelesai: 286,
    terverifikasi: true,
    sejak: 'Jul 2020',
    subRating: { ketepatanWaktu: 4.3, jumlahSesuai: 4.6, kondisiBarang: 4.7 },
    kategori: ['Susu & Olahan'],
    areaKirim: ['Kota Yogyakarta', 'Sleman'],
    baru: false,
  },
  {
    id: 'd-03',
    nama: 'Manis Sejahtera',
    kota: 'Bantul',
    deskripsi: 'Gula aren cair, sirup, dan minyak goreng kemasan untuk usaha makanan dan minuman.',
    warna: '#b45309',
    rating: 4.2,
    jumlahUlasan: 17,
    jumlahUmkmPengulas: 14,
    jumlahPesananSelesai: 193,
    terverifikasi: true,
    sejak: 'Feb 2021',
    subRating: { ketepatanWaktu: 3.8, jumlahSesuai: 4.4, kondisiBarang: 4.5 },
    kategori: ['Pemanis', 'Bahan Makanan'],
    areaKirim: ['Bantul', 'Kota Yogyakarta', 'Sleman'],
    baru: false,
  },
  {
    id: 'd-04',
    nama: 'Kemasan Andalan',
    kota: 'Sleman',
    deskripsi: 'Gelas plastik, sedotan, dan film sealer. Bisa cetak logo mulai 5 dus.',
    warna: '#4a3aa7',
    rating: 4.8,
    jumlahUlasan: 61,
    jumlahUmkmPengulas: 44,
    jumlahPesananSelesai: 738,
    terverifikasi: true,
    sejak: 'Sep 2018',
    subRating: { ketepatanWaktu: 4.9, jumlahSesuai: 4.8, kondisiBarang: 4.7 },
    kategori: ['Kemasan'],
    areaKirim: ['Sleman', 'Kota Yogyakarta', 'Bantul', 'Kulon Progo'],
    baru: false,
  },
  {
    id: 'd-05',
    nama: 'Es Segar Mandiri',
    kota: 'Sleman',
    deskripsi: 'Es batu kristal dan air mineral galon. Pengiriman harian pagi dan sore.',
    warna: '#0e7490',
    rating: 4.0,
    jumlahUlasan: 12,
    jumlahUmkmPengulas: 9,
    jumlahPesananSelesai: 604,
    terverifikasi: true,
    sejak: 'Jan 2022',
    subRating: { ketepatanWaktu: 3.4, jumlahSesuai: 4.4, kondisiBarang: 4.2 },
    kategori: ['Pendukung'],
    areaKirim: ['Sleman', 'Kota Yogyakarta'],
    baru: false,
  },
  {
    id: 'd-06',
    nama: 'Pangan Harian Sejati',
    kota: 'Kota Yogyakarta',
    deskripsi: 'Telur, roti, kentang beku, dan bahan makanan harian untuk kafe dan resto.',
    warna: '#9a3412',
    rating: 4.4,
    jumlahUlasan: 21,
    jumlahUmkmPengulas: 16,
    jumlahPesananSelesai: 254,
    terverifikasi: true,
    sejak: 'Nov 2020',
    subRating: { ketepatanWaktu: 4.2, jumlahSesuai: 4.5, kondisiBarang: 4.4 },
    kategori: ['Bahan Makanan', 'Protein'],
    areaKirim: ['Kota Yogyakarta', 'Sleman', 'Bantul'],
    baru: false,
  },
  {
    id: 'd-07',
    nama: 'Kopi Rakyat Merapi',
    kota: 'Sleman',
    deskripsi: 'Koperasi petani kopi lereng Merapi. Harga lebih murah, stok terbatas mengikuti musim panen.',
    warna: '#166534',
    rating: null,
    jumlahUlasan: 0,
    jumlahUmkmPengulas: 0,
    jumlahPesananSelesai: 6,
    terverifikasi: false,
    sejak: 'Agu 2026',
    subRating: { ketepatanWaktu: 0, jumlahSesuai: 0, kondisiBarang: 0 },
    kategori: ['Kopi & Teh'],
    areaKirim: ['Sleman'],
    baru: true,
  },
  {
    id: 'd-08',
    nama: 'Matcha House Supply',
    kota: 'Kota Yogyakarta',
    deskripsi: 'Bubuk matcha, hojicha, dan bahan minuman Jepang untuk kedai kopi.',
    warna: '#15803d',
    rating: null,
    jumlahUlasan: 0,
    jumlahUmkmPengulas: 0,
    jumlahPesananSelesai: 2,
    terverifikasi: false,
    sejak: 'Agu 2026',
    subRating: { ketepatanWaktu: 0, jumlahSesuai: 0, kondisiBarang: 0 },
    kategori: ['Kopi & Teh'],
    areaKirim: ['Kota Yogyakarta', 'Sleman'],
    baru: true,
  },
]

export function distributorById(id: string): Distributor | undefined {
  return daftarDistributor.find((d) => d.id === id)
}

/* ================================================================== */
/* Penawaran                                                          */
/* ================================================================== */

export const daftarPenawaran: Penawaran[] = [
  {
    id: 'pw-01',
    distributorId: 'd-01',
    nama: 'Biji Kopi Arabika Gayo',
    kategori: 'Kopi & Teh',
    satuan: 'kg',
    hargaSatuan: 148000,
    kemasanJual: { nama: 'kg', isi: 1000 },
    stokTersedia: 320,
    stokDiperbaruiPada: hariKe(0, 6, 30),
    barangIdTerkait: 'b-01',
    keterangan: 'Grade 1, sangrai medium',
  },
  {
    id: 'pw-02',
    distributorId: 'd-01',
    nama: 'Teh Hitam Premium',
    kategori: 'Kopi & Teh',
    satuan: 'kg',
    hargaSatuan: 96000,
    kemasanJual: { nama: 'kg', isi: 1000 },
    stokTersedia: 88,
    stokDiperbaruiPada: hariKe(0, 6, 30),
    barangIdTerkait: 'b-07',
    keterangan: 'BOP Grade A',
  },
  {
    id: 'pw-03',
    distributorId: 'd-01',
    nama: 'Bubuk Cokelat',
    kategori: 'Kopi & Teh',
    satuan: 'kg',
    hargaSatuan: 112000,
    kemasanJual: { nama: 'kg', isi: 1000 },
    stokTersedia: 54,
    stokDiperbaruiPada: hariKe(-1, 17, 0),
    barangIdTerkait: 'b-16',
    keterangan: 'Kandungan kakao 32%',
  },
  {
    id: 'pw-04',
    distributorId: 'd-02',
    nama: 'Susu UHT Full Cream',
    kategori: 'Susu & Olahan',
    satuan: 'dus',
    hargaSatuan: 216000,
    kemasanJual: { nama: 'dus', isi: 12000 },
    stokTersedia: 145,
    stokDiperbaruiPada: hariKe(0, 7, 15),
    barangIdTerkait: 'b-02',
    keterangan: '1 dus isi 12 liter',
  },
  {
    id: 'pw-05',
    distributorId: 'd-02',
    nama: 'Keju Cheddar Lembaran',
    kategori: 'Susu & Olahan',
    satuan: 'pak',
    hargaSatuan: 62000,
    kemasanJual: { nama: 'pak', isi: 50 },
    stokTersedia: 210,
    stokDiperbaruiPada: hariKe(0, 7, 15),
    barangIdTerkait: 'b-10',
    keterangan: '1 pak isi 50 lembar',
  },
  {
    id: 'pw-06',
    distributorId: 'd-03',
    nama: 'Gula Aren Cair',
    kategori: 'Pemanis',
    satuan: 'jerigen',
    hargaSatuan: 187000,
    kemasanJual: { nama: 'jerigen', isi: 5000 },
    stokTersedia: 62,
    stokDiperbaruiPada: hariKe(-1, 9, 0),
    barangIdTerkait: 'b-03',
    keterangan: '1 jerigen 5 liter, tanpa pengawet',
  },
  {
    id: 'pw-07',
    distributorId: 'd-03',
    nama: 'Sirup Vanila',
    kategori: 'Pemanis',
    satuan: 'botol',
    hargaSatuan: 78000,
    kemasanJual: { nama: 'botol', isi: 750 },
    stokTersedia: 130,
    stokDiperbaruiPada: hariKe(-1, 9, 0),
    barangIdTerkait: 'b-11',
    keterangan: '750 ml per botol',
  },
  {
    id: 'pw-08',
    distributorId: 'd-03',
    nama: 'Minyak Goreng Kemasan',
    kategori: 'Bahan Makanan',
    satuan: 'jerigen',
    hargaSatuan: 94000,
    kemasanJual: { nama: 'jerigen', isi: 5000 },
    stokTersedia: 240,
    stokDiperbaruiPada: hariKe(0, 8, 0),
    barangIdTerkait: 'b-14',
    keterangan: '1 jerigen 5 liter',
  },
  {
    id: 'pw-09',
    distributorId: 'd-04',
    nama: 'Gelas Plastik 16 oz',
    kategori: 'Kemasan',
    satuan: 'dus',
    hargaSatuan: 285000,
    kemasanJual: { nama: 'dus', isi: 1000 },
    stokTersedia: 96,
    stokDiperbaruiPada: hariKe(0, 5, 45),
    barangIdTerkait: 'b-05',
    keterangan: '1 dus isi 1.000 pcs, bahan PP food grade',
  },
  {
    id: 'pw-10',
    distributorId: 'd-04',
    nama: 'Sedotan Kertas',
    kategori: 'Kemasan',
    satuan: 'dus',
    hargaSatuan: 168000,
    kemasanJual: { nama: 'dus', isi: 2000 },
    stokTersedia: 74,
    stokDiperbaruiPada: hariKe(0, 5, 45),
    barangIdTerkait: 'b-06',
    keterangan: '1 dus isi 2.000 pcs',
  },
  {
    id: 'pw-11',
    distributorId: 'd-04',
    nama: 'Cup Sealer Film',
    kategori: 'Kemasan',
    satuan: 'roll',
    hargaSatuan: 115000,
    kemasanJual: null,
    stokTersedia: 41,
    stokDiperbaruiPada: hariKe(-2, 11, 0),
    barangIdTerkait: 'b-15',
    keterangan: 'Polos, cukup untuk 3.000 gelas',
  },
  {
    id: 'pw-12',
    distributorId: 'd-05',
    nama: 'Es Batu Kristal',
    kategori: 'Pendukung',
    satuan: 'karung',
    hargaSatuan: 42000,
    kemasanJual: { nama: 'karung', isi: 20 },
    stokTersedia: 500,
    stokDiperbaruiPada: hariKe(0, 5, 0),
    barangIdTerkait: 'b-04',
    keterangan: '1 karung 20 kg',
  },
  {
    id: 'pw-13',
    distributorId: 'd-05',
    nama: 'Air Mineral Galon',
    kategori: 'Pendukung',
    satuan: 'galon',
    hargaSatuan: 21000,
    kemasanJual: null,
    stokTersedia: 180,
    stokDiperbaruiPada: hariKe(0, 5, 0),
    barangIdTerkait: 'b-12',
    keterangan: '19 liter isi ulang',
  },
  {
    id: 'pw-14',
    distributorId: 'd-06',
    nama: 'Telur Ayam Negeri',
    kategori: 'Protein',
    satuan: 'krat',
    hargaSatuan: 51000,
    kemasanJual: { nama: 'krat', isi: 180 },
    stokTersedia: 88,
    stokDiperbaruiPada: hariKe(0, 6, 0),
    barangIdTerkait: 'b-09',
    keterangan: '1 krat isi 180 butir',
  },
  {
    id: 'pw-15',
    distributorId: 'd-06',
    nama: 'Roti Tawar Gandum',
    kategori: 'Bahan Makanan',
    satuan: 'bungkus',
    hargaSatuan: 19500,
    kemasanJual: { nama: 'bungkus', isi: 20 },
    stokTersedia: 120,
    stokDiperbaruiPada: hariKe(0, 6, 0),
    barangIdTerkait: 'b-08',
    keterangan: '1 bungkus isi 20 lembar',
  },
  {
    id: 'pw-16',
    distributorId: 'd-06',
    nama: 'Kentang Beku Shoestring',
    kategori: 'Bahan Makanan',
    satuan: 'pak',
    hargaSatuan: 43000,
    kemasanJual: { nama: 'pak', isi: 1000 },
    stokTersedia: 165,
    stokDiperbaruiPada: hariKe(0, 6, 0),
    barangIdTerkait: 'b-13',
    keterangan: '1 pak 1 kg',
  },
  {
    id: 'pw-17',
    distributorId: 'd-07',
    nama: 'Biji Kopi Arabika Merapi',
    kategori: 'Kopi & Teh',
    satuan: 'kg',
    hargaSatuan: 121000,
    kemasanJual: { nama: 'kg', isi: 1000 },
    stokTersedia: 45,
    stokDiperbaruiPada: hariKe(-3, 15, 0),
    barangIdTerkait: 'b-01',
    keterangan: 'Grade 2, sangrai medium dark',
  },
  {
    id: 'pw-18',
    distributorId: 'd-08',
    nama: 'Matcha Bubuk Culinary',
    kategori: 'Kopi & Teh',
    satuan: 'kg',
    hargaSatuan: 398000,
    kemasanJual: { nama: 'kg', isi: 1000 },
    stokTersedia: 24,
    stokDiperbaruiPada: hariKe(-1, 10, 0),
    barangIdTerkait: 'b-17',
    keterangan: 'Culinary grade, asal Uji',
  },
  {
    id: 'pw-19',
    distributorId: 'd-04',
    nama: 'Gelas Plastik 22 oz',
    kategori: 'Kemasan',
    satuan: 'dus',
    hargaSatuan: 340000,
    kemasanJual: { nama: 'dus', isi: 1000 },
    stokTersedia: 60,
    stokDiperbaruiPada: hariKe(0, 5, 45),
    barangIdTerkait: 'b-18',
    keterangan: '1 dus isi 1.000 pcs',
  },
]

export function penawaranById(id: string): Penawaran | undefined {
  return daftarPenawaran.find((p) => p.id === id)
}

export function penawaranUntukBarang(barangId: string): Penawaran[] {
  return daftarPenawaran.filter((p) => p.barangIdTerkait === barangId)
}

/* ================================================================== */
/* Promo distributor                                                  */
/* ================================================================== */

/**
 * Tiga jenis promo, tujuh kartu.
 *
 * Tiap jenis sengaja dipakai lebih dari satu distributor supaya terlihat di
 * layar bahwa kartunya memang kembar: yang membedakan cuma nama toko, dan nama
 * toko itu tidak pernah ditulis di `judul` — ia diambil dari distributornya
 * saat dirender.
 */
export const daftarPromo: Promo[] = [
  {
    id: 'pr-01',
    jenis: 'cuci-gudang',
    distributorId: 'd-04',
    judul: 'Cuci Gudang Kemasan',
    keterangan: 'Gelas dan sedotan menumpuk sebelum kiriman baru datang. Harga turun sampai gudang lega.',
    berakhir: hariKe(10),
    penawaranIds: ['pw-09', 'pw-10', 'pw-19'],
    potonganPersen: 15,
  },
  {
    id: 'pr-02',
    jenis: 'cuci-gudang',
    distributorId: 'd-06',
    judul: 'Cuci Gudang Bahan Dapur',
    keterangan: 'Roti dan kentang beku dilepas lebih murah karena masa simpannya tinggal sebentar.',
    berakhir: hariKe(6),
    penawaranIds: ['pw-15', 'pw-16'],
    potonganPersen: 12,
  },
  {
    id: 'pr-03',
    jenis: 'cuci-gudang',
    distributorId: 'd-03',
    judul: 'Cuci Gudang Pemanis',
    keterangan: 'Sisa stok gula aren, sirup, dan minyak dari kiriman bulan lalu.',
    berakhir: hariKe(3),
    penawaranIds: ['pw-06', 'pw-07', 'pw-08'],
    potonganPersen: 10,
  },
  {
    id: 'pr-04',
    jenis: 'produk-baru',
    distributorId: 'd-01',
    judul: 'Panen Baru Dataran Gayo',
    keterangan: 'Biji dari panen Juli baru masuk gudang. Sangrai menyusul sesuai pesanan.',
    berakhir: hariKe(21),
    penawaranIds: ['pw-01', 'pw-02', 'pw-03'],
    // Satu-satunya promo berpotongan milik d-01, distributor yang portalnya bisa
    // dibuka. Dengan ini alur "promo dipasang distributor → harga beli sekali di
    // sisi UMKM ikut turun" bisa diperlihatkan memakai data contoh.
    potonganPersen: 8,
  },
  {
    id: 'pr-05',
    jenis: 'produk-baru',
    distributorId: 'd-08',
    judul: 'Matcha Culinary Baru Datang',
    keterangan: 'Culinary grade asal Uji, giling halus, cocok untuk latte dan adonan.',
    berakhir: null,
    penawaranIds: ['pw-18'],
    potonganPersen: null,
  },
  {
    id: 'pr-06',
    jenis: 'membership',
    distributorId: 'd-02',
    judul: 'Langganan Susu & Keju Bulanan',
    keterangan: 'Daftar sekali, kiriman datang tiap Senin dan Kamis dengan harga tetap sebulan penuh.',
    berakhir: null,
    penawaranIds: ['pw-04', 'pw-05'],
    potonganPersen: 8,
  },
  {
    id: 'pr-07',
    jenis: 'membership',
    distributorId: 'd-05',
    judul: 'Langganan Kirim Harian',
    keterangan: 'Es dan air datang tiap pagi tanpa perlu pesan ulang. Bisa dihentikan kapan saja.',
    berakhir: null,
    penawaranIds: ['pw-12', 'pw-13'],
    potonganPersen: 5,
  },
]

export function promoById(id: string): Promo | undefined {
  return daftarPromo.find((p) => p.id === id)
}

/* ================================================================== */
/* Paket kontrak                                                      */
/* ================================================================== */

/**
 * Pola penawaran: makin panjang komitmen, makin rendah kuota minimum per bulan
 * dan makin besar potongan harganya. Persis pola Kontrak A sampai E.
 */
function buatPaket(
  distributorId: string,
  penawaranId: string,
  hargaEceran: number,
  kuotaDasar: number,
  ketentuan: string | null,
): PaketKontrak[] {
  const pola = [
    { kode: 'A', durasi: 1, faktor: 1.0, hemat: 0 },
    { kode: 'B', durasi: 2, faktor: 0.84, hemat: 3 },
    { kode: 'C', durasi: 3, faktor: 0.8, hemat: 5 },
    { kode: 'D', durasi: 4, faktor: 0.77, hemat: 7 },
    { kode: 'E', durasi: 6, faktor: 0.73, hemat: 10 },
  ]
  return pola.map((p) => ({
    id: `pk-${penawaranId}-${p.kode}`,
    kode: `Kontrak ${p.kode}`,
    penawaranId,
    distributorId,
    durasiBulan: p.durasi,
    kuotaMinPerBulan: Math.round((kuotaDasar * p.faktor) / 5) * 5,
    hargaSatuan: Math.round((hargaEceran * (1 - p.hemat / 100)) / 500) * 500,
    hematPersen: p.hemat,
    ketentuanKuotaKurang: ketentuan,
    ketentuanBerhenti:
      'Penghentian di tengah masa kontrak hanya bisa lewat persetujuan distributor, dan kekurangan kuota bulan berjalan tetap dihitung.',
  }))
}

const KETENTUAN_UMUM =
  'Kekurangan kuota bulan berjalan ditagihkan pada bulan berikutnya. Kalau kurang dua bulan berturut-turut, harga kembali ke harga beli sekali.'

export const daftarPaket: PaketKontrak[] = [
  ...buatPaket('d-01', 'pw-01', 148000, 40, KETENTUAN_UMUM),
  ...buatPaket('d-01', 'pw-02', 96000, 10, KETENTUAN_UMUM),
  ...buatPaket('d-01', 'pw-03', 112000, 10, KETENTUAN_UMUM),
  ...buatPaket('d-02', 'pw-04', 216000, 20, KETENTUAN_UMUM),
  ...buatPaket('d-02', 'pw-05', 62000, 10, null),
  ...buatPaket('d-03', 'pw-06', 187000, 15, KETENTUAN_UMUM),
  ...buatPaket('d-03', 'pw-07', 78000, 10, null),
  ...buatPaket('d-03', 'pw-08', 94000, 15, KETENTUAN_UMUM),
  ...buatPaket('d-04', 'pw-09', 285000, 10, KETENTUAN_UMUM),
  ...buatPaket('d-04', 'pw-10', 168000, 5, KETENTUAN_UMUM),
  ...buatPaket('d-05', 'pw-12', 42000, 60, KETENTUAN_UMUM),
  ...buatPaket('d-06', 'pw-14', 51000, 20, null),
  ...buatPaket('d-06', 'pw-15', 19500, 60, null),
  ...buatPaket('d-06', 'pw-16', 43000, 25, KETENTUAN_UMUM),
  ...buatPaket('d-07', 'pw-17', 121000, 25, null),
  ...buatPaket('d-08', 'pw-18', 398000, 8, null),
]

export function paketUntukPenawaran(penawaranId: string): PaketKontrak[] {
  return daftarPaket.filter((p) => p.penawaranId === penawaranId)
}

export function paketById(id: string): PaketKontrak | undefined {
  return daftarPaket.find((p) => p.id === id)
}

/* ================================================================== */
/* Kontrak aktif                                                      */
/* ================================================================== */

function periode(selisihBulan: number): string {
  const d = new Date(HARI_INI)
  d.setMonth(d.getMonth() + selisihBulan)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const daftarKontrak: Kontrak[] = [
  {
    id: 'k-01',
    paketId: 'pk-pw-01-C',
    distributorId: 'd-01',
    penawaranId: 'pw-01',
    barangId: 'b-01',
    namaBarang: 'Biji Kopi Arabika Gayo',
    durasiBulan: 3,
    kuotaMinPerBulan: 30,
    hargaSatuan: 140500,
    satuan: 'kg',
    mulai: hariKe(-52),
    berakhir: hariKe(38),
    status: 'aktif',
    riwayat: [
      { periode: periode(-2), kuota: 30, diterima: 35, selesai: true },
      { periode: periode(-1), kuota: 30, diterima: 30, selesai: true },
    ],
    periodeBerjalan: { periode: periode(0), kuota: 30, diterima: 18, selesai: false },
    dalamPerjalanan: 0,
    ketentuanKuotaKurang: KETENTUAN_UMUM,
    pesananRutinAktif: true,
    pesananRutinBerikutnya: hariKe(7),
  },
  {
    id: 'k-02',
    paketId: 'pk-pw-03-B',
    distributorId: 'd-01',
    penawaranId: 'pw-03',
    barangId: 'b-16',
    namaBarang: 'Bubuk Cokelat',
    durasiBulan: 2,
    kuotaMinPerBulan: 10,
    hargaSatuan: 108500,
    satuan: 'kg',
    mulai: hariKe(-24),
    berakhir: hariKe(36),
    status: 'aktif',
    riwayat: [{ periode: periode(-1), kuota: 10, diterima: 12, selesai: true }],
    periodeBerjalan: { periode: periode(0), kuota: 10, diterima: 4, selesai: false },
    dalamPerjalanan: 0,
    ketentuanKuotaKurang: KETENTUAN_UMUM,
    pesananRutinAktif: false,
    pesananRutinBerikutnya: null,
  },
  {
    id: 'k-03',
    paketId: 'pk-pw-04-C',
    distributorId: 'd-02',
    penawaranId: 'pw-04',
    barangId: 'b-02',
    namaBarang: 'Susu UHT Full Cream',
    durasiBulan: 3,
    kuotaMinPerBulan: 15,
    hargaSatuan: 205000,
    satuan: 'dus',
    mulai: hariKe(-71),
    berakhir: hariKe(19),
    status: 'akan-berakhir',
    riwayat: [
      { periode: periode(-2), kuota: 15, diterima: 16, selesai: true },
      { periode: periode(-1), kuota: 15, diterima: 15, selesai: true },
    ],
    periodeBerjalan: { periode: periode(0), kuota: 15, diterima: 6, selesai: false },
    dalamPerjalanan: 4,
    ketentuanKuotaKurang: KETENTUAN_UMUM,
    pesananRutinAktif: true,
    pesananRutinBerikutnya: hariKe(4),
  },
  {
    id: 'k-04',
    paketId: 'pk-pw-09-A',
    distributorId: 'd-04',
    penawaranId: 'pw-09',
    barangId: 'b-05',
    namaBarang: 'Gelas Plastik 16 oz',
    durasiBulan: 1,
    kuotaMinPerBulan: 10,
    hargaSatuan: 285000,
    satuan: 'dus',
    mulai: hariKe(-18),
    berakhir: hariKe(12),
    status: 'aktif',
    riwayat: [],
    periodeBerjalan: { periode: periode(0), kuota: 10, diterima: 3, selesai: false },
    dalamPerjalanan: 3,
    ketentuanKuotaKurang: KETENTUAN_UMUM,
    pesananRutinAktif: false,
    pesananRutinBerikutnya: null,
  },
  {
    id: 'k-05',
    paketId: 'pk-pw-12-A',
    distributorId: 'd-05',
    penawaranId: 'pw-12',
    barangId: 'b-04',
    namaBarang: 'Es Batu Kristal',
    durasiBulan: 1,
    kuotaMinPerBulan: 60,
    hargaSatuan: 42000,
    satuan: 'karung',
    mulai: hariKe(-9),
    berakhir: hariKe(21),
    status: 'aktif',
    riwayat: [],
    periodeBerjalan: { periode: periode(0), kuota: 60, diterima: 41, selesai: false },
    dalamPerjalanan: 3,
    ketentuanKuotaKurang: null,
    pesananRutinAktif: true,
    pesananRutinBerikutnya: hariKe(1),
  },
  {
    id: 'k-06',
    paketId: 'pk-pw-10-B',
    distributorId: 'd-04',
    penawaranId: 'pw-10',
    barangId: 'b-06',
    namaBarang: 'Sedotan Kertas',
    durasiBulan: 2,
    kuotaMinPerBulan: 5,
    hargaSatuan: 163000,
    satuan: 'dus',
    mulai: hariKe(-40),
    berakhir: hariKe(20),
    status: 'aktif',
    riwayat: [{ periode: periode(-1), kuota: 5, diterima: 5, selesai: true }],
    periodeBerjalan: { periode: periode(0), kuota: 5, diterima: 5, selesai: true },
    dalamPerjalanan: 1,
    ketentuanKuotaKurang: KETENTUAN_UMUM,
    pesananRutinAktif: false,
    pesananRutinBerikutnya: null,
  },
]

export function kontrakUntukBarang(barangId: string): Kontrak[] {
  return daftarKontrak.filter((k) => k.barangId === barangId && (k.status === 'aktif' || k.status === 'akan-berakhir'))
}

/* ------------------------------------------------------------------ */
/* Harga beli — satu sumber untuk seluruh aplikasi                     */
/* ------------------------------------------------------------------ */

/**
 * Promo berpotongan yang sedang berjalan untuk satu penawaran, kalau ada.
 *
 * `promoTersedia` diisi dari store oleh layar yang punya aksesnya. Bawaannya
 * data contoh, supaya fungsi murni seperti penyusun saran tetap bisa dipakai.
 */
export function promoUntukPenawaran(
  penawaranId: string,
  pada?: string,
  promoTersedia: Promo[] = daftarPromo,
): Promo | undefined {
  const waktu = pada ? +new Date(pada) : Date.now()
  return promoTersedia.find(
    (p) =>
      p.potonganPersen != null &&
      p.potonganPersen > 0 &&
      p.penawaranIds.includes(penawaranId) &&
      (p.berakhir == null || +new Date(p.berakhir) >= waktu),
  )
}

/**
 * Harga yang benar-benar berlaku untuk satu baris pembelian, beserta asalnya.
 *
 * SATU-SATUNYA tempat harga baris ditentukan. Kalau ada layar yang menghitung
 * sendiri, cepat atau lambat angka di keranjang berbeda dengan angka yang
 * tercatat di pesanan — dan selisih itu baru ketahuan saat tagihan datang.
 *
 * Tiga tingkat, dan urutannya tidak boleh dibalik:
 * 1. Baris yang terikat kontrak memakai HARGA KONTRAK. Kontrak adalah dokumen
 *    yang mengikat kedua pihak; promo tidak pernah menyentuhnya.
 * 2. Beli sekali pada barang yang sedang ikut promo berpotongan memakai harga
 *    SETELAH potongan. Promonya dipasang distributor sendiri, jadi potongan ini
 *    janji yang ia buat, bukan tebakan aplikasi.
 * 3. Selain itu harga penawaran yang sedang berlaku.
 *
 * `kontrakTersedia` dan `promoTersedia` wajib diisi dari store oleh layar yang
 * punya aksesnya: kontrak dan promo yang lahir saat aplikasi berjalan hanya ada
 * di store, dan tanpa daftar yang benar fungsi ini diam-diam jatuh ke harga
 * penuh.
 */
export function rincianHarga(
  penawaranId: string,
  kontrakId?: string | null,
  kontrakTersedia: Kontrak[] = daftarKontrak,
  promoTersedia: Promo[] = daftarPromo,
  pada?: string,
): RincianHarga {
  const hargaNormal = penawaranById(penawaranId)?.hargaSatuan ?? 0
  const kontrak = kontrakId ? kontrakTersedia.find((k) => k.id === kontrakId) : undefined
  if (kontrak) return { harga: kontrak.hargaSatuan, hargaNormal, promo: null, sumber: 'kontrak' }

  const promo = promoUntukPenawaran(penawaranId, pada, promoTersedia)
  if (promo?.potonganPersen) {
    const harga = Math.round((hargaNormal * (100 - promo.potonganPersen)) / 100)
    return { harga, hargaNormal, promo, sumber: 'promo' }
  }
  return { harga: hargaNormal, hargaNormal, promo: null, sumber: 'normal' }
}

/** Jalan pintas ke `rincianHarga` untuk layar yang cuma butuh angkanya. */
export function hargaBerlaku(
  penawaranId: string,
  kontrakId?: string | null,
  kontrakTersedia: Kontrak[] = daftarKontrak,
  promoTersedia: Promo[] = daftarPromo,
): number {
  return rincianHarga(penawaranId, kontrakId, kontrakTersedia, promoTersedia).harga
}

/**
 * Tiga status netral. Tidak pernah memblokir tombol apa pun; tugasnya hanya
 * memberi tahu sedini mungkin supaya kekurangan masih sempat dikejar.
 */
export function statusKuota(k: Kontrak): StatusKuota {
  const total = k.periodeBerjalan.diterima + k.dalamPerjalanan
  if (total >= k.periodeBerjalan.kuota) return 'aman'
  const akhirBulan = new Date(HARI_INI)
  akhirBulan.setMonth(akhirBulan.getMonth() + 1, 0)
  const sisaHari = Math.max(0, Math.ceil((+akhirBulan - +HARI_INI) / 86_400_000))
  const kurang = k.periodeBerjalan.kuota - total
  const rasio = kurang / k.periodeBerjalan.kuota
  if (sisaHari <= 7 && rasio > 0.25) return 'kurang'
  if (rasio > 0.5) return 'perlu-dikejar'
  return sisaHari <= 12 ? 'perlu-dikejar' : 'aman'
}

export function sisaHariPeriode(): number {
  const akhirBulan = new Date(HARI_INI)
  akhirBulan.setMonth(akhirBulan.getMonth() + 1, 0)
  return Math.max(0, Math.ceil((+akhirBulan - +HARI_INI) / 86_400_000))
}

/* ================================================================== */
/* Rekomendasi prediksi                                               */
/* ================================================================== */

/**
 * Barang yang layak diperkirakan.
 *
 * Dua saringan, dan keduanya jujur: barang yang memang dicatat manual tidak
 * punya data permintaan sama sekali, dan di bawah 14 hari data model belum
 * boleh bersuara. Barang yang tersaring tetap muncul di halaman Stok, cuma
 * tidak punya kartu rekomendasi.
 */
export function layakDiperkirakan(b: Barang): boolean {
  return !b.dicatatManual && b.hariDataTerkumpul >= 14
}

/** 14 hari data → 0,62. 90 hari atau lebih → 0,93. Di antaranya lurus saja. */
function keyakinanDari(hariData: number): number {
  const t = Math.min(1, Math.max(0, (hariData - 14) / (90 - 14)))
  return Math.round((0.62 + t * 0.31) * 100) / 100
}

function arahUntuk(b: Barang, perkiraan: number): ArahPrediksi {
  // Kelebihan diukur dari batas aman, bukan dari nol: stok dua kali lipat
  // batas aman yang masih cukup sebulan lebih memang kebanyakan.
  // Syarat `b.stok >= perkiraan` wajib ada: belum boleh disebut berlebih
  // kalau kebutuhan bulan depan saja belum tertutup. Tanpa itu, barang bisa
  // dilencanai "kurangi" padahal pemilik usaha justru akan kehabisan.
  const cukup = hariCukup(b)
  if (
    b.batasAman > 0 &&
    b.stok > b.batasAman * 2 &&
    cukup !== null &&
    cukup > 25 &&
    b.stok >= perkiraan
  ) {
    return 'kurang'
  }
  if (b.stok < perkiraan * 0.8) return 'tambah'
  return 'tetap'
}

/**
 * Maksimal tiga butir fakta, dan urutannya ikut arah saran.
 *
 * Kartu "kurang" dibuka dengan berapa lama stoknya masih cukup, bukan dengan
 * angka pertumbuhan, supaya tidak terbaca seperti menyuruh menambah dan
 * mengurangi sekaligus.
 */
function alasanUntuk(b: Barang, arah: ArahPrediksi, bulanIni: number, perkiraan: number): string[] {
  const bulanLalu = pemakaianBulan(b, 1)
  const beda = bulanLalu > 0 ? Math.round(((bulanIni - bulanLalu) / bulanLalu) * 100) : 0
  const perubahan =
    beda >= 3
      ? `Pemakaian naik ${beda}% dibanding bulan lalu.`
      : beda <= -3
        ? `Pemakaian turun ${Math.abs(beda)}% dibanding bulan lalu.`
        : 'Pemakaian sebulan terakhir hampir sama dengan bulan lalu.'

  if (arah === 'kurang') {
    const cukup = hariCukup(b)
    const alasan = ['Sudah dua kali lipat batas aman yang kamu atur sendiri.']
    if (cukup !== null) alasan.unshift(`Stok sekarang cukup untuk ${cukup} hari ke depan.`)
    alasan.push(perubahan)
    return alasan.slice(0, 3)
  }

  // Untuk saran "tambah", perbandingan stok vs kebutuhan adalah ALASAN
  // SEBENARNYA dan harus berdiri paling depan. Kalau ia ditaruh terakhir,
  // pemotongan tiga butir membuangnya — dan yang tersisa justru bisa berbunyi
  // "pemakaian turun" di bawah saran "tambah", yang terbaca bertentangan.
  const alasan: string[] = []
  if (arah === 'tambah' && perkiraan > b.stok) {
    alasan.push(
      `Kebutuhan bulan depan ${jumlahTampil(b, perkiraan)}, stok sekarang cuma ${jumlahTampil(b, Math.max(0, b.stok))}.`,
    )
  }
  alasan.push(perubahan)
  if (b.pemakaianHarian >= 100) alasan.push('Akhir pekan selalu 40% lebih ramai.')
  alasan.push(`Kiriman biasanya sampai ${b.hariKirim} hari setelah dipesan.`)
  return alasan.slice(0, 3)
}

/**
 * Satu kartu per barang yang layak. Jumlahnya selalu positif dan selalu dalam
 * satuan beli, karena angka itulah yang langsung masuk keranjang — arah dibaca
 * dari `arah`, bukan dari tanda minus.
 */
/**
 * Kartu untuk satu barang, dihitung dari barang yang diberikan — bukan dari
 * `daftarBarang`. Dipisah jadi fungsi supaya layar bisa menghitung ulang dari
 * stok hidup di store: setelah Terima Barang menaikkan stok, kartunya tidak
 * boleh lagi menyuruh menambah barang yang baru saja diterima.
 */
export function rekomendasiDari(b: Barang): RekomendasiPrediksi {
  const bulanIni = pemakaianBulan(b, 0)
  const perkiraan = perkiraanBulanDepan(b)
  const arah = arahUntuk(b, perkiraan)
  const kemasan = b.kemasan[b.kemasan.length - 1]
  const isi = kemasan?.isi ?? 1

  // Tambah: kekurangan terhadap kebutuhan bulan depan.
  // Kurang: kelebihan di atas batas aman, bukan seluruh stok.
  // Tetap: kebutuhan bulan depan sebagai angka rujukan kalau memang mau pesan.
  const dasar =
    arah === 'tambah' ? perkiraan - b.stok : arah === 'kurang' ? b.stok - b.batasAman : perkiraan

  return {
    barangId: b.id,
    arah,
    jumlah: Math.max(1, Math.ceil(dasar / isi)),
    satuanSaran: kemasan?.nama ?? b.satuan,
    pemakaianBulanIni: bulanIni,
    perkiraanBulanDepan: perkiraan,
    keyakinan: keyakinanDari(b.hariDataTerkumpul),
    alasan: alasanUntuk(b, arah, bulanIni, perkiraan),
    penawaranId: penawaranUntukBarang(b.id)[0]?.id ?? null,
    kontrakId: kontrakUntukBarang(b.id)[0]?.id ?? null,
  }
}

export const daftarRekomendasi: RekomendasiPrediksi[] = daftarBarang
  .filter(layakDiperkirakan)
  .map(rekomendasiDari)

export function rekomendasiUntuk(barangId: string): RekomendasiPrediksi | undefined {
  return daftarRekomendasi.find((r) => r.barangId === barangId)
}

/* ================================================================== */
/* Pesanan                                                            */
/* ================================================================== */

export const daftarPesanan: Pesanan[] = [
  {
    id: 'ps-01',
    nomor: 'PS-260913-08',
    distributorId: 'd-02',
    kontrakId: 'k-03',
    dibuatPada: hariKe(0, 8, 12),
    status: 'menunggu-konfirmasi',
    baris: [
      {
        penawaranId: 'pw-04',
        barangId: 'b-02',
        nama: 'Susu UHT Full Cream',
        jumlah: 4,
        satuan: 'dus',
        hargaSatuan: 205000,
        isiPerSatuan: 12000,
        jumlahDiterima: null,
        alasanSelisih: null,
        catatanPenerimaan: null,
      },
    ],
    ongkosKirim: 0,
    perkiraanTiba: hariKe(2),
    jejak: [{ waktu: hariKe(0, 8, 12), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim ke distributor.' }],
    statusBayar: 'belum-dibayar',
    jumlahBukti: 0,
    dariSaran: true,
    dariRutin: false,
    catatanUntukDistributor: 'Tolong kirim pagi sebelum jam 9.',
    sudahDiulas: false,
    kodeBelanja: null,
  },
  {
    id: 'ps-02',
    nomor: 'PS-260912-06',
    distributorId: 'd-05',
    kontrakId: 'k-05',
    dibuatPada: hariKe(-1, 16, 40),
    status: 'dikirim',
    baris: [
      {
        penawaranId: 'pw-12',
        barangId: 'b-04',
        nama: 'Es Batu Kristal',
        jumlah: 3,
        satuan: 'karung',
        hargaSatuan: 42000,
        isiPerSatuan: 20,
        jumlahDiterima: null,
        alasanSelisih: null,
        catatanPenerimaan: null,
      },
    ],
    ongkosKirim: 15000,
    perkiraanTiba: hariKe(0),
    jejak: [
      { waktu: hariKe(-1, 16, 40), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim ke distributor.' },
      { waktu: hariKe(-1, 17, 5), status: 'disiapkan', keterangan: 'Distributor menyiapkan barang.' },
      { waktu: hariKe(0, 5, 30), status: 'dikirim', keterangan: 'Kurir berangkat dari gudang.' },
    ],
    statusBayar: 'bukti-terkirim',
    jumlahBukti: 1,
    dariSaran: false,
    dariRutin: true,
    catatanUntukDistributor: '',
    sudahDiulas: false,
    kodeBelanja: null,
  },
  {
    id: 'ps-03',
    nomor: 'PS-260910-03',
    distributorId: 'd-04',
    kontrakId: 'k-04',
    dibuatPada: hariKe(-3, 10, 15),
    status: 'dikirim',
    baris: [
      {
        penawaranId: 'pw-09',
        barangId: 'b-05',
        nama: 'Gelas Plastik 16 oz',
        jumlah: 3,
        satuan: 'dus',
        hargaSatuan: 285000,
        isiPerSatuan: 1000,
        jumlahDiterima: null,
        alasanSelisih: null,
        catatanPenerimaan: null,
      },
      {
        penawaranId: 'pw-10',
        barangId: 'b-06',
        nama: 'Sedotan Kertas',
        jumlah: 1,
        satuan: 'dus',
        hargaSatuan: 163000,
        isiPerSatuan: 2000,
        jumlahDiterima: null,
        alasanSelisih: null,
        catatanPenerimaan: null,
      },
    ],
    ongkosKirim: 0,
    perkiraanTiba: hariKe(-1),
    jejak: [
      { waktu: hariKe(-3, 10, 15), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim ke distributor.' },
      { waktu: hariKe(-3, 11, 0), status: 'disiapkan', keterangan: 'Distributor menyiapkan barang.' },
      { waktu: hariKe(-2, 7, 20), status: 'dikirim', keterangan: 'Kurir berangkat dari gudang.' },
    ],
    statusBayar: 'dikonfirmasi',
    jumlahBukti: 1,
    dariSaran: false,
    dariRutin: false,
    catatanUntukDistributor: '',
    sudahDiulas: false,
    kodeBelanja: null,
  },
  {
    id: 'ps-04',
    nomor: 'PS-260907-04',
    distributorId: 'd-01',
    kontrakId: 'k-01',
    dibuatPada: hariKe(-6, 9, 0),
    status: 'selesai',
    baris: [
      {
        penawaranId: 'pw-01',
        barangId: 'b-01',
        nama: 'Biji Kopi Arabika Gayo',
        jumlah: 5,
        satuan: 'kg',
        hargaSatuan: 140500,
        isiPerSatuan: 1000,
        jumlahDiterima: 5,
        alasanSelisih: null,
        catatanPenerimaan: null,
      },
    ],
    ongkosKirim: 0,
    perkiraanTiba: hariKe(-4),
    jejak: [
      { waktu: hariKe(-6, 9, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim ke distributor.' },
      { waktu: hariKe(-6, 9, 30), status: 'disiapkan', keterangan: 'Distributor menyiapkan barang.' },
      { waktu: hariKe(-5, 8, 0), status: 'dikirim', keterangan: 'Kurir berangkat dari gudang.' },
      { waktu: hariKe(-4, 10, 5), status: 'selesai', keterangan: 'Diterima lengkap, stok bertambah 5 kg.' },
    ],
    statusBayar: 'dikonfirmasi',
    jumlahBukti: 1,
    dariSaran: true,
    dariRutin: false,
    catatanUntukDistributor: '',
    sudahDiulas: false,
    kodeBelanja: null,
  },
  {
    id: 'ps-05',
    nomor: 'PS-260901-02',
    distributorId: 'd-06',
    kontrakId: null,
    dibuatPada: hariKe(-12, 14, 30),
    status: 'selesai-catatan',
    baris: [
      {
        penawaranId: 'pw-14',
        barangId: 'b-09',
        nama: 'Telur Ayam Negeri',
        jumlah: 2,
        satuan: 'krat',
        hargaSatuan: 51000,
        isiPerSatuan: 180,
        jumlahDiterima: 2,
        alasanSelisih: 'rusak',
        catatanPenerimaan: '14 butir pecah saat diterima.',
      },
    ],
    ongkosKirim: 12000,
    perkiraanTiba: hariKe(-10),
    jejak: [
      { waktu: hariKe(-12, 14, 30), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim ke distributor.' },
      { waktu: hariKe(-11, 8, 0), status: 'dikirim', keterangan: 'Kurir berangkat dari gudang.' },
      { waktu: hariKe(-10, 9, 40), status: 'selesai-catatan', keterangan: 'Diterima dengan catatan: 14 butir pecah.' },
    ],
    statusBayar: 'dikonfirmasi',
    jumlahBukti: 1,
    dariSaran: false,
    dariRutin: false,
    catatanUntukDistributor: '',
    sudahDiulas: true,
    kodeBelanja: null,
  },
  {
    id: 'ps-06',
    nomor: 'PS-260913-09',
    distributorId: 'd-01',
    kontrakId: 'k-01',
    dibuatPada: hariKe(0, 6, 0),
    status: 'draf',
    baris: [
      {
        penawaranId: 'pw-01',
        barangId: 'b-01',
        nama: 'Biji Kopi Arabika Gayo',
        jumlah: 12,
        satuan: 'kg',
        hargaSatuan: 140500,
        isiPerSatuan: 1000,
        jumlahDiterima: null,
        alasanSelisih: null,
        catatanPenerimaan: null,
      },
    ],
    ongkosKirim: 0,
    perkiraanTiba: null,
    jejak: [{ waktu: hariKe(0, 6, 0), status: 'draf', keterangan: 'Draf pesanan rutin dibuat sistem, menunggu kamu periksa.' }],
    statusBayar: 'belum-dibayar',
    jumlahBukti: 0,
    dariSaran: false,
    dariRutin: true,
    catatanUntukDistributor: '',
    sudahDiulas: false,
    kodeBelanja: null,
  },
]

/* ================================================================== */
/* Saran belanja                                                      */
/* ================================================================== */

export const saranBelanja: SaranBelanja[] = [
  {
    id: 'sr-harian',
    judul: 'Saran belanja hari ini',
    dibuatPada: hariKe(0, 7, 0),
    baris: [
      {
        barangId: 'b-14',
        varian: 'ada-pemasok',
        penawaranId: 'pw-08',
        kontrakId: null,
        jumlahSaran: 2,
        alasanPemasok: 'Dipilih karena harga termurah: Rp 94.000/jerigen',
        alasanJumlah: [
          'Stok minyak goreng habis sejak kemarin sore.',
          'Rata-rata terpakai 320 ml per hari.',
          'Kiriman Manis Sejahtera biasanya sampai 2 hari.',
        ],
        sedangDikirim: 0,
        kandidatLain: [],
      },
      {
        barangId: 'b-04',
        varian: 'ada-kontrak',
        penawaranId: 'pw-12',
        kontrakId: 'k-05',
        jumlahSaran: 5,
        alasanPemasok: 'Dipilih karena kuota kontrak bulan ini kurang 16 karung',
        alasanJumlah: [
          'Sisa es batu 4 kg, rata-rata terpakai 11 kg per hari.',
          'Saran 8 karung dikurangi 3 karung yang sedang dikirim.',
        ],
        sedangDikirim: 3,
        kandidatLain: [],
      },
      {
        barangId: 'b-03',
        varian: 'ada-pemasok',
        penawaranId: 'pw-06',
        kontrakId: null,
        jumlahSaran: 3,
        alasanPemasok: 'Dipilih karena harga termurah: Rp 187.000/jerigen',
        alasanJumlah: [
          'Sisa gula aren 1,8 liter, cukup untuk sekitar 2 hari.',
          'Akhir pekan lalu pemakaiannya naik 40%.',
        ],
        sedangDikirim: 0,
        kandidatLain: ['pw-06'],
      },
      {
        barangId: 'b-05',
        varian: 'ada-kontrak',
        penawaranId: 'pw-09',
        kontrakId: 'k-04',
        jumlahSaran: 4,
        alasanPemasok: 'Dipilih karena kuota kontrak bulan ini kurang 4 dus',
        alasanJumlah: ['Sisa gelas 620 pcs, rata-rata terpakai 132 pcs per hari.'],
        sedangDikirim: 3,
        kandidatLain: [],
      },
      {
        barangId: 'b-13',
        varian: 'ada-pemasok',
        penawaranId: 'pw-16',
        kontrakId: null,
        jumlahSaran: 4,
        alasanPemasok: 'Dipilih karena harga termurah: Rp 43.000/pak',
        alasanJumlah: ['Sisa kentang 2,1 kg, rata-rata terpakai 380 gram per hari.'],
        sedangDikirim: 0,
        kandidatLain: [],
      },
    ],
  },
]

export function saranById(id: string): SaranBelanja | undefined {
  return saranBelanja.find((s) => s.id === id)
}

/* ================================================================== */
/* Pemberitahuan                                                      */
/* ================================================================== */

export const daftarNotifikasi: Notifikasi[] = [
  {
    id: 'n-01',
    kategori: 'stok',
    tingkat: 'genting',
    judul: 'Minyak goreng sudah habis',
    detail: 'Stok tercatat 0 sejak kemarin sore. Menu gorengan belum bisa dibuat sampai stok masuk.',
    waktu: menitLalu(42),
    dibaca: false,
    butuhTindakan: true,
    tautan: '/pesan-cepat/sr-harian',
    aksiLabel: 'Pesan Sekarang',
    barangId: 'b-14',
    dibisukanSampai: null,
  },
  {
    id: 'n-02',
    kategori: 'stok',
    tingkat: 'genting',
    judul: 'Es batu tinggal 4 kg',
    detail: 'Rata-rata terpakai 11 kg per hari. 3 karung sedang dikirim dan diperkirakan tiba hari ini.',
    waktu: menitLalu(126),
    dibaca: false,
    butuhTindakan: false,
    tautan: '/stok/b-04',
    aksiLabel: 'Lihat Stok',
    barangId: 'b-04',
    dibisukanSampai: hariKe(2),
  },
  {
    id: 'n-03',
    kategori: 'saran-belanja',
    tingkat: 'penting',
    judul: '5 barang perlu dibeli minggu ini',
    detail: 'Minyak goreng, es batu, gula aren, gelas plastik, dan kentang beku diperkirakan segera habis.',
    waktu: hariKe(0, 7, 0),
    dibaca: false,
    butuhTindakan: true,
    tautan: '/pesan-cepat/sr-harian',
    aksiLabel: 'Lihat Saran Belanja',
    barangId: null,
    dibisukanSampai: null,
  },
  {
    id: 'n-04',
    kategori: 'pesanan',
    tingkat: 'penting',
    judul: 'Pesanan gelas plastik sudah sampai',
    detail: 'PS-260910-03 dari Kemasan Andalan menunggu kamu periksa dan konfirmasi.',
    waktu: hariKe(-1, 9, 45),
    dibaca: false,
    butuhTindakan: true,
    tautan: '/pesanan/ps-03',
    aksiLabel: 'Terima Barang',
    barangId: null,
    dibisukanSampai: null,
  },
  {
    id: 'n-05',
    kategori: 'kontrak',
    tingkat: 'penting',
    judul: 'Kuota gelas plastik masih kurang',
    detail: 'Baru 3 dari 10 dus diterima, 3 dus sedang dikirim. Kontrak berakhir 12 hari lagi.',
    waktu: hariKe(0, 7, 0),
    dibaca: false,
    butuhTindakan: true,
    tautan: '/kontrak/k-04',
    aksiLabel: 'Lihat Kontrak',
    barangId: 'b-05',
    dibisukanSampai: null,
  },
  {
    id: 'n-06',
    kategori: 'kontrak',
    tingkat: 'biasa',
    judul: 'Kontrak susu UHT berakhir 19 hari lagi',
    detail: 'Kalau ingin melanjutkan, perpanjangan bisa diatur sebelum masa kontrak habis.',
    waktu: hariKe(-1, 10, 0),
    dibaca: true,
    butuhTindakan: false,
    tautan: '/kontrak/k-03',
    aksiLabel: 'Lihat Kontrak',
    barangId: 'b-02',
    dibisukanSampai: null,
  },
  {
    id: 'n-07',
    kategori: 'sistem',
    tingkat: 'biasa',
    judul: '2 menu kasir belum dipasangkan',
    detail: '"Kopi Susu Pandan" dan "Roti Bakar Keju" belum dihubungkan ke bahan, jadi stoknya belum berkurang.',
    waktu: hariKe(-1, 23, 58),
    dibaca: true,
    butuhTindakan: true,
    tautan: '/akun/kasir?tab=beres',
    aksiLabel: 'Pasangkan Sekarang',
    barangId: null,
    dibisukanSampai: null,
  },
  {
    id: 'n-08',
    kategori: 'pesanan',
    tingkat: 'biasa',
    judul: 'Pesanan es batu sedang dikirim',
    detail: 'PS-260912-06 berangkat dari gudang pukul 05.30. Perkiraan tiba hari ini.',
    waktu: hariKe(0, 5, 30),
    dibaca: true,
    butuhTindakan: false,
    tautan: '/pesanan/ps-02',
    aksiLabel: null,
    barangId: null,
    dibisukanSampai: null,
  },
  {
    id: 'n-09',
    kategori: 'pesanan',
    tingkat: 'penting',
    judul: 'Draf pesanan rutin kopi menunggu diperiksa',
    detail: 'Pesanan rutin 12 kg Biji Kopi Arabika Gayo ke Sumber Tani Nusantara siap dikirim. Cek dulu?',
    waktu: hariKe(0, 6, 0),
    dibaca: false,
    butuhTindakan: true,
    tautan: '/pesanan/ps-06',
    aksiLabel: 'Periksa Draf',
    barangId: 'b-01',
    dibisukanSampai: null,
  },
]

/* ================================================================== */
/* Ulasan                                                             */
/* ================================================================== */

export const daftarUlasan: Ulasan[] = [
  {
    id: 'u-01',
    distributorId: 'd-01',
    namaUsaha: 'Kedai Senja',
    kotaUsaha: 'Bantul',
    rating: 5,
    isi: 'Biji kopinya konsisten dari bulan ke bulan. Sangrai sesuai permintaan dan pengiriman selalu tepat waktu.',
    waktu: hariKe(-11),
    pesananId: 'PS-260902-07',
    labelSistem: 'Terverifikasi · 9 pesanan · pelanggan sejak Feb 2025',
    aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 5 },
  },
  {
    id: 'u-02',
    distributorId: 'd-01',
    namaUsaha: 'Warung Kopi Pak Di',
    kotaUsaha: 'Sleman',
    rating: 4,
    isi: 'Kualitas bagus, harga wajar. Sempat telat sehari waktu musim hujan tapi dikabari lebih dulu.',
    waktu: hariKe(-26),
    pesananId: 'PS-260818-04',
    labelSistem: 'Terverifikasi · 4 pesanan · pelanggan sejak Mei 2026',
    aspek: { ketepatanWaktu: 3, jumlahSesuai: 5, kondisiBarang: 5 },
  },
  {
    id: 'u-03',
    distributorId: 'd-04',
    namaUsaha: 'Teh Poci Malioboro',
    kotaUsaha: 'Kota Yogyakarta',
    rating: 5,
    isi: 'Paling cepat responnya. Pesan pagi, sore sudah sampai. Gelasnya tebal, tidak penyok di perjalanan.',
    waktu: hariKe(-5),
    pesananId: 'PS-260908-02',
    labelSistem: 'Terverifikasi · 22 pesanan · pelanggan sejak Jan 2024',
    aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 5 },
  },
  {
    id: 'u-04',
    distributorId: 'd-05',
    namaUsaha: 'Es Teler Mbak Nur',
    kotaUsaha: 'Sleman',
    rating: 3,
    isi: 'Es batunya bagus tapi jadwal kirim sore sering meleset satu sampai dua jam.',
    waktu: hariKe(-8),
    pesananId: 'PS-260905-11',
    labelSistem: 'Terverifikasi · 31 pesanan · pelanggan sejak Mar 2025',
    aspek: { ketepatanWaktu: 2, jumlahSesuai: 4, kondisiBarang: 4 },
  },
  {
    id: 'u-05',
    distributorId: 'd-03',
    namaUsaha: 'Kopi Kita Jogja',
    kotaUsaha: 'Sleman',
    rating: 4,
    isi: 'Gula arennya kental dan wangi. Pengiriman kadang mundur sehari kalau pesan di akhir pekan.',
    waktu: hariKe(-19),
    pesananId: 'PS-260825-06',
    labelSistem: 'Terverifikasi · 7 pesanan · pelanggan sejak Feb 2026',
    aspek: { ketepatanWaktu: 3, jumlahSesuai: 5, kondisiBarang: 4 },
  },
  {
    id: 'u-06',
    distributorId: 'd-02',
    namaUsaha: 'Susu Segar Depok',
    kotaUsaha: 'Sleman',
    rating: 5,
    isi: 'Rantai dinginnya benar-benar dijaga. Belum pernah dapat susu yang sudah pecah.',
    waktu: hariKe(-14),
    pesananId: 'PS-260830-09',
    labelSistem: 'Terverifikasi · 12 pesanan · pelanggan sejak Sep 2025',
    aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 5 },
  },
  {
    id: 'u-07',
    distributorId: 'd-04',
    namaUsaha: 'Kopi Kita Jogja',
    kotaUsaha: 'Sleman',
    rating: 5,
    isi: 'Pesan sore, besok pagi sudah sampai. Harga kontraknya juga paling masuk akal.',
    waktu: hariKe(-30),
    pesananId: 'PS-260814-03',
    labelSistem: 'Terverifikasi · 7 pesanan · pelanggan sejak Feb 2026',
    aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 4 },
  },
]

export function ulasanUntuk(distributorId: string): Ulasan[] {
  return daftarUlasan.filter((u) => u.distributorId === distributorId)
}

/* ================================================================== */
/* Portal Distributor — toko yang sedang masuk                        */
/* ================================================================== */

/** Distributor yang sedang membuka portal. Purwarupa hanya punya satu. */
export const distributorAktif: Distributor = daftarDistributor[0]

/**
 * Kotak koordinat peta sebaran.
 *
 * Peta digambar sendiri dari kotak ini, tanpa layanan peta mana pun. Semua
 * UMKM di bawah wajib berada di dalamnya, kalau tidak titiknya jatuh di luar
 * bingkai.
 */
export const BATAS_PETA = { latMin: -7.83, latMaks: -7.67, lngMin: 110.31, lngMaks: 110.45 }

export const daftarUmkm: UmkmPemesan[] = [
  {
    // Toko pemilik aplikasi sendiri. Datanya sengaja dibuat sama dengan profilAwal
    // supaya jelas bahwa dua portal ini melihat usaha yang sama dari dua sisi.
    id: 'u-01',
    nama: 'Kopi Kita Jogja',
    jenisUsaha: 'Kedai kopi & camilan',
    kota: 'Sleman',
    alamat: 'Jl. Kaliurang KM 5,6 No. 24, Sinduadi, Mlati',
    lat: -7.7548,
    lng: 110.3782,
    warna: '#0f766e',
    nomorHp: '081338827410',
    sejak: hariKe(-214),
  },
  {
    id: 'u-02',
    nama: 'Angkringan Pak Slamet',
    jenisUsaha: 'Angkringan',
    kota: 'Kota Yogyakarta',
    alamat: 'Jl. Wongsodirjan No. 8, Sosromenduran',
    lat: -7.7902,
    lng: 110.3641,
    warna: '#b45309',
    nomorHp: '081227734510',
    sejak: hariKe(-320),
  },
  {
    id: 'u-03',
    nama: 'Kedai Teh Sore',
    jenisUsaha: 'Kedai teh & roti',
    kota: 'Sleman',
    alamat: 'Jl. Palagan Tentara Pelajar KM 8, Ngaglik',
    lat: -7.7211,
    lng: 110.3765,
    warna: '#1d4ed8',
    nomorHp: '081392214477',
    sejak: hariKe(-180),
  },
  {
    id: 'u-04',
    nama: 'Warung Gudeg Bu Tarmi',
    jenisUsaha: 'Warung makan',
    kota: 'Kota Yogyakarta',
    alamat: 'Jl. Bantul No. 41, Gedongkiwo',
    lat: -7.8122,
    lng: 110.3568,
    warna: '#9a3412',
    nomorHp: '082134556710',
    sejak: hariKe(-402),
  },
  {
    id: 'u-05',
    nama: 'Kafe Ruang Tunggu',
    jenisUsaha: 'Kafe & ruang kerja',
    kota: 'Sleman',
    alamat: 'Jl. Seturan Raya No. 12, Caturtunggal',
    lat: -7.7648,
    lng: 110.4062,
    warna: '#4a3aa7',
    nomorHp: '081226640912',
    sejak: hariKe(-146),
  },
  {
    id: 'u-06',
    nama: 'Warmindo Barokah',
    jenisUsaha: 'Warung mi & kopi',
    kota: 'Sleman',
    alamat: 'Jl. Affandi Gg. Kinanti, Condongcatur',
    lat: -7.7583,
    lng: 110.3928,
    warna: '#0e7490',
    nomorHp: '085643312208',
    sejak: hariKe(-268),
  },
  {
    id: 'u-07',
    nama: 'Kopi Lereng Merapi',
    jenisUsaha: 'Kedai kopi',
    kota: 'Sleman',
    alamat: 'Jl. Kaliurang KM 17, Pakem',
    lat: -7.6902,
    lng: 110.4205,
    warna: '#166534',
    nomorHp: '081904452310',
    sejak: hariKe(-95),
  },
  {
    id: 'u-08',
    nama: 'Bakmi Jawa Mbah Wito',
    jenisUsaha: 'Warung bakmi',
    kota: 'Sleman',
    alamat: 'Jl. Magelang KM 6, Mlati',
    lat: -7.7405,
    lng: 110.3466,
    warna: '#7c2d12',
    nomorHp: '082226610045',
    sejak: hariKe(-512),
  },
  {
    id: 'u-09',
    nama: 'Kedai Susu Sapi Segar',
    jenisUsaha: 'Kedai susu',
    kota: 'Sleman',
    alamat: 'Jl. Kaliurang KM 12, Ngaglik',
    lat: -7.7016,
    lng: 110.4081,
    warna: '#0369a1',
    nomorHp: '081328890076',
    sejak: hariKe(-231),
  },
  {
    id: 'u-10',
    nama: 'Kopi Tugu Pandang',
    jenisUsaha: 'Kedai kopi',
    kota: 'Kota Yogyakarta',
    alamat: 'Jl. Margo Utomo No. 33, Gowongan',
    lat: -7.7825,
    lng: 110.3672,
    warna: '#a21caf',
    nomorHp: '087738812204',
    sejak: hariKe(-168),
  },
  {
    id: 'u-11',
    nama: 'Warung Sego Abang Mbak Tar',
    jenisUsaha: 'Warung makan',
    kota: 'Kota Yogyakarta',
    alamat: 'Jl. Sisingamangaraja No. 7, Brontokusuman',
    lat: -7.8168,
    lng: 110.3745,
    warna: '#be123c',
    nomorHp: '085100237744',
    sejak: hariKe(-355),
  },
  {
    id: 'u-12',
    nama: 'Kafe Beranda Kotabaru',
    jenisUsaha: 'Kafe',
    kota: 'Kota Yogyakarta',
    alamat: 'Jl. Suroto No. 5, Kotabaru',
    lat: -7.7789,
    lng: 110.3802,
    warna: '#c2410c',
    nomorHp: '081215567890',
    sejak: hariKe(-121),
  },
  {
    id: 'u-13',
    nama: 'Kedai Matcha Selasar',
    jenisUsaha: 'Kedai minuman',
    kota: 'Sleman',
    alamat: 'Jl. Gejayan No. 28, Depok',
    lat: -7.7702,
    lng: 110.3891,
    warna: '#15803d',
    nomorHp: '082198004411',
    sejak: hariKe(-77),
  },
  {
    id: 'u-14',
    nama: 'Roti Bakar Simpang Lima',
    jenisUsaha: 'Kedai roti bakar',
    kota: 'Sleman',
    alamat: 'Jl. Godean KM 5, Gamping',
    lat: -7.7936,
    lng: 110.3305,
    warna: '#854d0e',
    nomorHp: '085725513390',
    sejak: hariKe(-189),
  },
]

export function umkmById(id: string): UmkmPemesan | undefined {
  return daftarUmkm.find((u) => u.id === id)
}

/* ================================================================== */
/* Portal Distributor — pesanan masuk                                 */
/* ================================================================== */

/**
 * Baris pesanan selalu mengutip penawaran aslinya.
 *
 * Nama, satuan, dan harga tidak pernah ditulis ulang di sini supaya katalog
 * dan pesanan tidak bisa berselisih angka.
 */
function barisPM(penawaranId: string, jumlah: number): BarisPesananMasuk {
  const p = penawaranById(penawaranId)!
  return { penawaranId, nama: p.nama, jumlah, satuan: p.satuan, hargaSatuan: p.hargaSatuan }
}

/**
 * Pesanan yang masuk ke Sumber Tani Nusantara.
 *
 * Semuanya milik d-01, jadi barisnya hanya bisa berisi pw-01, pw-02, dan
 * pw-03 — tiga penawaran yang memang dijual toko ini.
 */
export const daftarPesananMasuk: PesananMasuk[] = [
  /* --- Menunggu konfirmasi (baru, umurnya dihitung dalam jam) --- */
  {
    id: 'pm-01',
    nomor: `PM-${kodeTanggal(0)}-07`,
    umkmId: 'u-01',
    distributorId: 'd-01',
    dibuatPada: jamLalu(1.5),
    status: 'menunggu-konfirmasi',
    baris: [barisPM('pw-01', 12)],
    ongkosKirim: 25000,
    perkiraanTiba: null,
    jejak: [
      { waktu: jamLalu(1.6), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim dari aplikasi pemilik usaha.' },
      { waktu: jamLalu(1.5), status: 'menunggu-konfirmasi', keterangan: 'Masuk ke daftarmu, menunggu diterima atau ditolak.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Tolong sangrai medium seperti biasa.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-02',
    nomor: `PM-${kodeTanggal(0)}-06`,
    umkmId: 'u-05',
    distributorId: 'd-01',
    dibuatPada: jamLalu(3),
    status: 'menunggu-konfirmasi',
    baris: [barisPM('pw-01', 8), barisPM('pw-03', 4)],
    ongkosKirim: 25000,
    perkiraanTiba: null,
    jejak: [
      { waktu: jamLalu(3.1), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim dari aplikasi pemilik usaha.' },
      { waktu: jamLalu(3), status: 'menunggu-konfirmasi', keterangan: 'Masuk ke daftarmu, menunggu diterima atau ditolak.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-03',
    nomor: `PM-${kodeTanggal(0)}-05`,
    umkmId: 'u-03',
    distributorId: 'd-01',
    dibuatPada: jamLalu(6),
    status: 'menunggu-konfirmasi',
    baris: [barisPM('pw-02', 10)],
    ongkosKirim: 20000,
    perkiraanTiba: null,
    jejak: [
      { waktu: jamLalu(6.2), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim dari aplikasi pemilik usaha.' },
      { waktu: jamLalu(6), status: 'menunggu-konfirmasi', keterangan: 'Masuk ke daftarmu, menunggu diterima atau ditolak.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Kalau bisa sampai sebelum Jumat.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-04',
    nomor: `PM-${kodeTanggal(0)}-04`,
    umkmId: 'u-09',
    distributorId: 'd-01',
    dibuatPada: jamLalu(9),
    status: 'menunggu-konfirmasi',
    baris: [barisPM('pw-03', 6)],
    ongkosKirim: 22000,
    perkiraanTiba: null,
    jejak: [
      { waktu: jamLalu(9.2), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim dari aplikasi pemilik usaha.' },
      { waktu: jamLalu(9), status: 'menunggu-konfirmasi', keterangan: 'Masuk ke daftarmu, menunggu diterima atau ditolak.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-05',
    nomor: `PM-${kodeTanggal(-1)}-11`,
    umkmId: 'u-12',
    distributorId: 'd-01',
    dibuatPada: jamLalu(14),
    status: 'menunggu-konfirmasi',
    baris: [barisPM('pw-01', 5), barisPM('pw-02', 3)],
    ongkosKirim: 20000,
    perkiraanTiba: null,
    jejak: [
      { waktu: jamLalu(14.3), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim dari aplikasi pemilik usaha.' },
      { waktu: jamLalu(14), status: 'menunggu-konfirmasi', keterangan: 'Masuk ke daftarmu, menunggu diterima atau ditolak.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Titip nota, buat laporan bulanan.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-06',
    nomor: `PM-${kodeTanggal(-1)}-09`,
    umkmId: 'u-14',
    distributorId: 'd-01',
    dibuatPada: jamLalu(19),
    status: 'menunggu-konfirmasi',
    baris: [barisPM('pw-03', 9)],
    ongkosKirim: 18000,
    perkiraanTiba: null,
    jejak: [
      { waktu: jamLalu(19.4), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim dari aplikasi pemilik usaha.' },
      { waktu: jamLalu(19), status: 'menunggu-konfirmasi', keterangan: 'Masuk ke daftarmu, menunggu diterima atau ditolak.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },

  /* --- Disiapkan di gudang --- */
  {
    id: 'pm-07',
    nomor: `PM-${kodeTanggal(-1)}-03`,
    umkmId: 'u-02',
    distributorId: 'd-01',
    dibuatPada: hariKe(-1, 9, 20),
    status: 'disiapkan',
    baris: [barisPM('pw-02', 4)],
    ongkosKirim: 15000,
    perkiraanTiba: hariKe(1, 9, 0),
    jejak: [
      { waktu: hariKe(-1, 9, 20), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-1, 10, 5), status: 'disiapkan', keterangan: 'Kamu terima. Barang mulai disiapkan di gudang.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Buat stok akhir pekan.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-08',
    nomor: `PM-${kodeTanggal(-1)}-06`,
    umkmId: 'u-05',
    distributorId: 'd-01',
    dibuatPada: hariKe(-1, 14, 5),
    status: 'disiapkan',
    baris: [barisPM('pw-01', 15)],
    ongkosKirim: 25000,
    perkiraanTiba: hariKe(1, 11, 0),
    jejak: [
      { waktu: hariKe(-1, 14, 5), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-1, 15, 30), status: 'disiapkan', keterangan: 'Kamu terima. Sangrai dijadwalkan besok pagi.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-09',
    nomor: `PM-${kodeTanggal(-1)}-08`,
    umkmId: 'u-07',
    distributorId: 'd-01',
    dibuatPada: hariKe(-1, 16, 40),
    status: 'disiapkan',
    baris: [barisPM('pw-01', 20), barisPM('pw-03', 5)],
    ongkosKirim: 35000,
    perkiraanTiba: hariKe(1, 14, 0),
    jejak: [
      { waktu: hariKe(-1, 16, 40), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-1, 17, 15), status: 'disiapkan', keterangan: 'Kamu terima. Dipisah dua koli karena jumlahnya besar.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Kirim pagi ya, sore kedai tutup.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-10',
    nomor: `PM-${kodeTanggal(-2)}-02`,
    umkmId: 'u-10',
    distributorId: 'd-01',
    dibuatPada: hariKe(-2, 8, 15),
    status: 'disiapkan',
    baris: [barisPM('pw-01', 9)],
    ongkosKirim: 22000,
    perkiraanTiba: hariKe(0, 16, 0),
    jejak: [
      { waktu: hariKe(-2, 8, 15), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-2, 9, 0), status: 'disiapkan', keterangan: 'Kamu terima. Menunggu giliran sangrai.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-11',
    nomor: `PM-${kodeTanggal(-2)}-05`,
    umkmId: 'u-13',
    distributorId: 'd-01',
    dibuatPada: hariKe(-2, 11, 30),
    status: 'disiapkan',
    baris: [barisPM('pw-03', 7), barisPM('pw-02', 2)],
    ongkosKirim: 20000,
    perkiraanTiba: hariKe(0, 13, 0),
    jejak: [
      { waktu: hariKe(-2, 11, 30), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-2, 12, 10), status: 'disiapkan', keterangan: 'Kamu terima. Barang sudah ditimbang dan dikemas.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },

  /* --- Sedang dikirim --- */
  {
    id: 'pm-12',
    nomor: `PM-${kodeTanggal(-2)}-01`,
    umkmId: 'u-01',
    distributorId: 'd-01',
    dibuatPada: hariKe(-2, 7, 45),
    status: 'dikirim',
    baris: [barisPM('pw-03', 4)],
    ongkosKirim: 20000,
    perkiraanTiba: hariKe(0, 15, 0),
    jejak: [
      { waktu: hariKe(-2, 7, 45), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-2, 8, 30), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-1, 7, 20), status: 'dikirim', keterangan: 'Berangkat dari gudang bersama armada pagi.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-13',
    nomor: `PM-${kodeTanggal(-2)}-07`,
    umkmId: 'u-04',
    distributorId: 'd-01',
    dibuatPada: hariKe(-2, 13, 10),
    status: 'dikirim',
    baris: [barisPM('pw-02', 6)],
    ongkosKirim: 28000,
    perkiraanTiba: hariKe(0, 17, 30),
    jejak: [
      { waktu: hariKe(-2, 13, 10), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-2, 14, 0), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-1, 13, 45), status: 'dikirim', keterangan: 'Diambil kurir, lewat jalur selatan.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Rumah cat hijau, pagar besi.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-14',
    nomor: `PM-${kodeTanggal(-3)}-02`,
    umkmId: 'u-06',
    distributorId: 'd-01',
    dibuatPada: hariKe(-3, 9, 0),
    status: 'dikirim',
    baris: [barisPM('pw-01', 6), barisPM('pw-02', 3)],
    ongkosKirim: 18000,
    perkiraanTiba: hariKe(1, 10, 0),
    jejak: [
      { waktu: hariKe(-3, 9, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-3, 10, 20), status: 'disiapkan', keterangan: 'Kamu terima. Menunggu giliran sangrai.' },
      { waktu: hariKe(0, 8, 10), status: 'dikirim', keterangan: 'Berangkat dari gudang pagi ini.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-15',
    nomor: `PM-${kodeTanggal(-3)}-06`,
    umkmId: 'u-11',
    distributorId: 'd-01',
    dibuatPada: hariKe(-3, 15, 25),
    status: 'dikirim',
    baris: [barisPM('pw-02', 8)],
    ongkosKirim: 30000,
    perkiraanTiba: hariKe(1, 13, 0),
    jejak: [
      { waktu: hariKe(-3, 15, 25), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-3, 16, 5), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(0, 9, 30), status: 'dikirim', keterangan: 'Diambil kurir pagi ini.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Warung buka mulai jam 10.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-16',
    nomor: `PM-${kodeTanggal(-4)}-01`,
    umkmId: 'u-13',
    distributorId: 'd-01',
    dibuatPada: hariKe(-4, 8, 30),
    status: 'dikirim',
    baris: [barisPM('pw-01', 11)],
    ongkosKirim: 20000,
    perkiraanTiba: hariKe(0, 11, 0),
    jejak: [
      { waktu: hariKe(-4, 8, 30), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-4, 9, 15), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-1, 16, 40), status: 'dikirim', keterangan: 'Berangkat sore, menginap semalam di pul kurir.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },

  /* --- Selesai, baru sampai (titik biru masih hidup) --- */
  {
    id: 'pm-17',
    nomor: `PM-${kodeTanggal(-3)}-03`,
    umkmId: 'u-05',
    distributorId: 'd-01',
    dibuatPada: hariKe(-3, 10, 0),
    status: 'selesai',
    baris: [barisPM('pw-01', 18)],
    ongkosKirim: 25000,
    perkiraanTiba: jamLalu(4),
    jejak: [
      { waktu: hariKe(-3, 10, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-3, 11, 0), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-1, 7, 30), status: 'dikirim', keterangan: 'Berangkat dari gudang.' },
      { waktu: jamLalu(2), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Armada sendiri',
      namaPengantar: 'Wahyu Nugroho',
      nomorResi: 'STN-0917-0231',
      diterimaOleh: 'Dimas (barista)',
      waktuSampai: jamLalu(2),
      catatan: 'Diturunkan lewat pintu samping karena depan sedang ramai.',
      foto: ['Barang diturunkan di depan kedai', 'Tanda terima ditandatangani'],
    },
    ulasan: {
      rating: 5,
      isi: 'Datang tepat waktu dan bijinya masih hangat. Aromanya beda.',
      waktu: jamLalu(1),
      aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 5 },
    },
  },
  {
    id: 'pm-18',
    nomor: `PM-${kodeTanggal(-4)}-02`,
    umkmId: 'u-02',
    distributorId: 'd-01',
    dibuatPada: hariKe(-4, 9, 30),
    status: 'selesai',
    baris: [barisPM('pw-02', 5)],
    ongkosKirim: 15000,
    perkiraanTiba: jamLalu(6),
    jejak: [
      { waktu: hariKe(-4, 9, 30), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-4, 10, 10), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-2, 8, 0), status: 'dikirim', keterangan: 'Diambil kurir.' },
      { waktu: jamLalu(5), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Titip di warung sebelah kalau saya belum datang.',
    pengiriman: {
      kurir: 'Kurir Harian Jogja',
      namaPengantar: 'Tri Handoko',
      nomorResi: 'STN-0916-0198',
      diterimaOleh: 'Pak Slamet',
      waktuSampai: jamLalu(5),
      catatan: 'Diterima langsung oleh pemilik.',
      foto: ['Barang diserahkan ke pemilik', 'Tanda terima ditandatangani'],
    },
    ulasan: {
      rating: 4,
      isi: 'Tehnya sesuai pesanan. Kirimannya agak siang dari perkiraan, tapi tidak masalah.',
      waktu: jamLalu(3),
      aspek: { ketepatanWaktu: 4, jumlahSesuai: 5, kondisiBarang: 4 },
    },
  },
  {
    id: 'pm-19',
    nomor: `PM-${kodeTanggal(-4)}-05`,
    umkmId: 'u-08',
    distributorId: 'd-01',
    dibuatPada: hariKe(-4, 14, 0),
    status: 'selesai',
    baris: [barisPM('pw-03', 3)],
    ongkosKirim: 18000,
    perkiraanTiba: jamLalu(10),
    jejak: [
      { waktu: hariKe(-4, 14, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-4, 15, 0), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-2, 13, 20), status: 'dikirim', keterangan: 'Berangkat dari gudang.' },
      { waktu: jamLalu(9), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Armada sendiri',
      namaPengantar: 'Wahyu Nugroho',
      nomorResi: 'STN-0916-0205',
      diterimaOleh: 'Mbak Ria',
      waktuSampai: jamLalu(9),
      catatan: '',
      foto: ['Barang diturunkan di depan warung'],
    },
    ulasan: null,
  },

  /* --- Selesai, sudah lewat 12 jam (titik birunya hilang) --- */
  {
    id: 'pm-20',
    nomor: `PM-${kodeTanggal(-6)}-04`,
    umkmId: 'u-01',
    distributorId: 'd-01',
    dibuatPada: hariKe(-6, 8, 0),
    status: 'selesai',
    baris: [barisPM('pw-01', 10), barisPM('pw-02', 2)],
    ongkosKirim: 25000,
    perkiraanTiba: hariKe(-4, 10, 0),
    jejak: [
      { waktu: hariKe(-6, 8, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-6, 9, 0), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-5, 7, 15), status: 'dikirim', keterangan: 'Berangkat dari gudang.' },
      { waktu: hariKe(-4, 11, 20), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Armada sendiri',
      namaPengantar: 'Wahyu Nugroho',
      nomorResi: 'STN-0914-0177',
      diterimaOleh: 'Bagas Prasetyo',
      waktuSampai: hariKe(-4, 11, 20),
      catatan: 'Ditimbang ulang di tempat, jumlahnya pas.',
      foto: ['Barang diturunkan di depan kedai', 'Timbangan diperlihatkan ke pemilik', 'Tanda terima ditandatangani'],
    },
    ulasan: {
      rating: 5,
      isi: 'Sudah langganan lama, belum pernah mengecewakan.',
      waktu: hariKe(-4, 15, 0),
      aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 5 },
    },
  },
  {
    id: 'pm-21',
    nomor: `PM-${kodeTanggal(-8)}-03`,
    umkmId: 'u-03',
    distributorId: 'd-01',
    dibuatPada: hariKe(-8, 9, 15),
    status: 'selesai',
    baris: [barisPM('pw-02', 12)],
    ongkosKirim: 20000,
    perkiraanTiba: hariKe(-6, 13, 0),
    jejak: [
      { waktu: hariKe(-8, 9, 15), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-8, 10, 0), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-7, 8, 40), status: 'dikirim', keterangan: 'Diambil kurir.' },
      { waktu: hariKe(-6, 14, 0), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Kurir Harian Jogja',
      namaPengantar: 'Tri Handoko',
      nomorResi: 'STN-0912-0140',
      diterimaOleh: 'Nanda',
      waktuSampai: hariKe(-6, 14, 0),
      catatan: 'Satu karung sempat tertukar, langsung ditukar di tempat.',
      foto: ['Barang diturunkan di depan kedai', 'Tanda terima ditandatangani'],
    },
    ulasan: {
      rating: 4,
      isi: 'Sempat ada barang tertukar, tapi langsung dibetulkan hari itu juga.',
      waktu: hariKe(-6, 18, 0),
      aspek: { ketepatanWaktu: 5, jumlahSesuai: 3, kondisiBarang: 5 },
    },
  },
  {
    id: 'pm-22',
    nomor: `PM-${kodeTanggal(-11)}-06`,
    umkmId: 'u-04',
    distributorId: 'd-01',
    dibuatPada: hariKe(-11, 10, 30),
    status: 'selesai',
    baris: [barisPM('pw-03', 8)],
    ongkosKirim: 28000,
    perkiraanTiba: hariKe(-9, 10, 0),
    jejak: [
      { waktu: hariKe(-11, 10, 30), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-11, 11, 15), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-10, 7, 50), status: 'dikirim', keterangan: 'Berangkat dari gudang.' },
      { waktu: hariKe(-9, 9, 40), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Ekspedisi Merapi Kargo',
      namaPengantar: 'Adi Kurniawan',
      nomorResi: 'STN-0909-0112',
      diterimaOleh: 'Bu Tarmi',
      waktuSampai: hariKe(-9, 9, 40),
      catatan: '',
      foto: ['Barang diturunkan di depan warung', 'Tanda terima ditandatangani'],
    },
    ulasan: null,
  },
  {
    id: 'pm-23',
    nomor: `PM-${kodeTanggal(-14)}-02`,
    umkmId: 'u-07',
    distributorId: 'd-01',
    dibuatPada: hariKe(-14, 13, 0),
    status: 'selesai',
    baris: [barisPM('pw-01', 25)],
    ongkosKirim: 35000,
    perkiraanTiba: hariKe(-12, 11, 0),
    jejak: [
      { waktu: hariKe(-14, 13, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-14, 14, 20), status: 'disiapkan', keterangan: 'Kamu terima. Sangrai dijadwalkan besok pagi.' },
      { waktu: hariKe(-13, 7, 40), status: 'dikirim', keterangan: 'Berangkat dari gudang, dua koli.' },
      { waktu: hariKe(-12, 10, 15), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: 'Jalan menanjak, mobil besar susah masuk.',
    pengiriman: {
      kurir: 'Ekspedisi Merapi Kargo',
      namaPengantar: 'Adi Kurniawan',
      nomorResi: 'STN-0906-0088',
      diterimaOleh: 'Mas Yoga',
      waktuSampai: hariKe(-12, 10, 15),
      catatan: 'Dipindah ke motor bak di pertigaan karena jalan sempit.',
      foto: ['Barang dipindah ke motor bak', 'Barang diturunkan di depan kedai', 'Tanda terima ditandatangani'],
    },
    ulasan: {
      rating: 5,
      isi: 'Mau repot memindah barang ke motor supaya tetap sampai. Salut.',
      waktu: hariKe(-12, 16, 0),
      aspek: { ketepatanWaktu: 4, jumlahSesuai: 5, kondisiBarang: 5 },
    },
  },
  {
    id: 'pm-24',
    nomor: `PM-${kodeTanggal(-18)}-04`,
    umkmId: 'u-09',
    distributorId: 'd-01',
    dibuatPada: hariKe(-18, 8, 45),
    status: 'selesai',
    baris: [barisPM('pw-03', 5), barisPM('pw-02', 4)],
    ongkosKirim: 22000,
    perkiraanTiba: hariKe(-16, 14, 0),
    jejak: [
      { waktu: hariKe(-18, 8, 45), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-18, 9, 30), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-17, 8, 0), status: 'dikirim', keterangan: 'Diambil kurir.' },
      { waktu: hariKe(-16, 15, 30), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Kurir Harian Jogja',
      namaPengantar: 'Tri Handoko',
      nomorResi: 'STN-0902-0061',
      diterimaOleh: 'Mbak Fitri',
      waktuSampai: hariKe(-16, 15, 30),
      catatan: '',
      foto: ['Barang diturunkan di depan kedai'],
    },
    ulasan: null,
  },
  {
    id: 'pm-25',
    nomor: `PM-${kodeTanggal(-23)}-01`,
    umkmId: 'u-10',
    distributorId: 'd-01',
    dibuatPada: hariKe(-23, 11, 0),
    status: 'selesai',
    baris: [barisPM('pw-01', 7)],
    ongkosKirim: 22000,
    perkiraanTiba: hariKe(-21, 12, 0),
    jejak: [
      { waktu: hariKe(-23, 11, 0), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-23, 12, 30), status: 'disiapkan', keterangan: 'Kamu terima. Barang disiapkan di gudang.' },
      { waktu: hariKe(-22, 7, 25), status: 'dikirim', keterangan: 'Berangkat dari gudang.' },
      { waktu: hariKe(-21, 12, 45), status: 'selesai', keterangan: 'Barang sampai dan diterima di tempat.' },
    ],
    alasanTolak: null,
    catatanDariUmkm: '',
    pengiriman: {
      kurir: 'Armada sendiri',
      namaPengantar: 'Wahyu Nugroho',
      nomorResi: 'STN-0828-0034',
      diterimaOleh: 'Mas Rendra',
      waktuSampai: hariKe(-21, 12, 45),
      catatan: 'Pesanan pertama dari kedai ini.',
      foto: ['Barang diturunkan di depan kedai', 'Tanda terima ditandatangani'],
    },
    ulasan: {
      rating: 5,
      isi: 'Pesanan pertama langsung cocok. Bijinya bersih, tidak banyak pecah.',
      waktu: hariKe(-20, 9, 0),
      aspek: { ketepatanWaktu: 5, jumlahSesuai: 5, kondisiBarang: 5 },
    },
  },

  /* --- Ditolak --- */
  {
    id: 'pm-26',
    nomor: `PM-${kodeTanggal(-5)}-08`,
    umkmId: 'u-12',
    distributorId: 'd-01',
    dibuatPada: hariKe(-5, 16, 20),
    status: 'ditolak',
    baris: [barisPM('pw-01', 40)],
    ongkosKirim: 20000,
    perkiraanTiba: null,
    jejak: [
      { waktu: hariKe(-5, 16, 20), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-5, 17, 0), status: 'ditolak', keterangan: 'Kamu tolak: jumlahnya di luar kemampuan kami.' },
    ],
    alasanTolak: 'Jumlahnya di luar kemampuan kami',
    catatanDariUmkm: 'Untuk persiapan acara kantor.',
    pengiriman: null,
    ulasan: null,
  },
  {
    id: 'pm-27',
    nomor: `PM-${kodeTanggal(-9)}-03`,
    umkmId: 'u-14',
    distributorId: 'd-01',
    dibuatPada: hariKe(-9, 10, 10),
    status: 'ditolak',
    baris: [barisPM('pw-02', 6)],
    ongkosKirim: 18000,
    perkiraanTiba: null,
    jejak: [
      { waktu: hariKe(-9, 10, 10), status: 'menunggu-konfirmasi', keterangan: 'Pesanan masuk.' },
      { waktu: hariKe(-9, 11, 5), status: 'ditolak', keterangan: 'Kamu tolak: alamatnya di luar area kirim.' },
    ],
    alasanTolak: 'Alamat di luar area kirim',
    catatanDariUmkm: '',
    pengiriman: null,
    ulasan: null,
  },
]

export function pesananMasukById(id: string): PesananMasuk | undefined {
  return daftarPesananMasuk.find((p) => p.id === id)
}

/**
 * Warna titik satu pesanan di peta sebaran, atau null kalau pesanan itu tidak
 * perlu ditampilkan lagi.
 *
 * Batas 12 jam untuk titik biru datang dari catatan pemilik proyek: pesanan
 * yang sudah sampai hanya perlu terlihat sebentar sebagai kabar baik, setelah
 * itu peta harus kembali bersih supaya yang tersisa cuma yang butuh tindakan.
 * Pesanan yang ditolak tidak pernah punya titik sama sekali.
 */
export function warnaTitikUntuk(p: PesananMasuk): WarnaTitik | null {
  if (p.status === 'menunggu-konfirmasi') return 'merah'
  if (p.status === 'disiapkan' || p.status === 'dikirim') return 'oren'
  if (p.status === 'selesai' && p.pengiriman) {
    const umurJam = (Date.now() - +new Date(p.pengiriman.waktuSampai)) / 3_600_000
    return umurJam < JAM_TITIK_BIRU ? 'biru' : null
  }
  return null
}
