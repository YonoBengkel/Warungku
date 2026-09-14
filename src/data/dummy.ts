import type {
  Barang,
  DataKasir,
  Distributor,
  Kontrak,
  Notifikasi,
  PaketKontrak,
  Penawaran,
  Pergerakan,
  Perkiraan,
  Pesanan,
  ProfilUsaha,
  RiwayatKasir,
  SaranBelanja,
  StatusKuota,
  StatusStok,
  TitikTren,
  Ulasan,
} from '@/lib/types'

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
  tier: 'dasar',
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

export const merekKasir = [
  { id: 'kasir-open-pos', nama: 'Kasir Open POS', warna: '#0f766e' },
  { id: 'moka', nama: 'Moka POS', warna: '#1d4ed8' },
  { id: 'majoo', nama: 'Majoo', warna: '#b45309' },
  { id: 'olsera', nama: 'Olsera', warna: '#4a3aa7' },
  { id: 'pawoon', nama: 'Pawoon', warna: '#0e7490' },
  { id: 'qasir', nama: 'Qasir', warna: '#9a3412' },
]

/* ================================================================== */
/* Stok                                                               */
/* ================================================================== */

export const daftarBarang: Barang[] = [
  {
    id: 'b-01',
    nama: 'Biji Kopi Arabika Gayo',
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
    namaLain: ['keju'],
    kategori: 'Susu & Olahan',
    kodeBarang: 'KJ-010',
    satuan: 'lembar',
    kemasan: [{ nama: 'pak', isi: 50 }],
    stok: 118,
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
    namaLain: ['film', 'sealer'],
    kategori: 'Kemasan',
    kodeBarang: 'KM-015',
    satuan: 'roll',
    kemasan: [],
    stok: 5,
    batasAman: 0,
    batasAmanSaran: 3,
    sumberBatasAman: 'belum-diatur',
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
 * Status stok. "Kebanyakan" muncul kalau stok melebihi 6x batas aman dan
 * pemakaiannya lambat, karena menumpuk barang juga sebuah masalah biaya.
 */
export function statusStok(b: Barang): StatusStok {
  if (b.stok <= 0) return 'habis'
  if (b.batasAman > 0 && b.stok < b.batasAman) return 'menipis'
  if (b.batasAman > 0 && b.stok > b.batasAman * 6 && b.pemakaianHarian > 0) {
    const hari = b.stok / b.pemakaianHarian
    if (hari > 120) return 'kebanyakan'
  }
  return 'aman'
}

export function hariCukup(b: Barang): number | null {
  if (b.pemakaianHarian <= 0) return null
  return Math.floor(b.stok / b.pemakaianHarian)
}

/** Menampilkan stok sebagai kemasan beli, mis. "3 dus + 2 pcs". */
export function dalamKemasan(b: Barang): string | null {
  const k = b.kemasan[b.kemasan.length - 1]
  if (!k || k.isi <= 1) return null
  const utuh = Math.floor(b.stok / k.isi)
  const sisa = Math.round((b.stok - utuh * k.isi) * 10) / 10
  if (utuh === 0) return null
  return sisa > 0 ? `${utuh} ${k.nama} + ${sisa} ${b.satuan}` : `${utuh} ${k.nama}`
}

/* ================================================================== */
/* Riwayat pergerakan                                                 */
/* ================================================================== */

function bangkitkanPergerakan(): Pergerakan[] {
  const hasil: Pergerakan[] = []
  const rnd = acakBersemai(20260913)
  let n = 0

  for (const b of daftarBarang) {
    if (!b.terhubungKasir) continue
    let stok = b.stok
    for (let h = 0; h < 9; h++) {
      const pakai = Math.round(b.pemakaianHarian * (0.75 + rnd() * 0.5) * 10) / 10
      if (pakai <= 0) continue
      hasil.push({
        id: `pg-${(n += 1)}`,
        barangId: b.id,
        waktu: hariKe(-h, 23, 50),
        jenis: 'terjual',
        jumlah: -pakai,
        stokSesudah: Math.round(stok * 10) / 10,
        alasan: null,
        keterangan: 'Terjual dari kasir',
        pesananId: null,
        oleh: 'Data kasir',
      })
      stok += pakai
    }
  }

  hasil.push(
    {
      id: 'pg-m1',
      barangId: 'b-02',
      waktu: hariKe(-1, 9, 15),
      jenis: 'koreksi',
      jumlah: -2000,
      stokSesudah: 9600,
      alasan: 'basi',
      keterangan: 'Kulkas mati semalam, 2 liter susu terpaksa dibuang.',
      pesananId: null,
      oleh: 'Bagas Prasetyo',
    },
    {
      id: 'pg-m2',
      barangId: 'b-08',
      waktu: hariKe(-2, 8, 40),
      jenis: 'koreksi',
      jumlah: -6,
      stokSesudah: 40,
      alasan: 'basi',
      keterangan: 'Roti berjamur, dibuang.',
      pesananId: null,
      oleh: 'Sinta',
    },
    {
      id: 'pg-m3',
      barangId: 'b-01',
      waktu: hariKe(-4, 10, 5),
      jenis: 'masuk',
      jumlah: 5000,
      stokSesudah: 9100,
      alasan: null,
      keterangan: 'Masuk dari pesanan PS-260907-04',
      pesananId: 'ps-04',
      oleh: 'Bagas Prasetyo',
    },
    {
      id: 'pg-m4',
      barangId: 'b-05',
      waktu: hariKe(-6, 14, 20),
      jenis: 'hitung-fisik',
      jumlah: -45,
      stokSesudah: 1580,
      alasan: null,
      keterangan: 'Hasil hitung fisik bulanan',
      pesananId: null,
      oleh: 'Bagas Prasetyo',
    },
    {
      id: 'pg-m5',
      barangId: 'b-03',
      waktu: hariKe(-3, 16, 0),
      jenis: 'koreksi',
      jumlah: -150,
      stokSesudah: 3200,
      alasan: 'susut',
      keterangan: 'Sisa di dasar jerigen tidak terpakai.',
      pesananId: null,
      oleh: 'Bagas Prasetyo',
    },
  )

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
    alasan.push(`Rata-rata terpakai ${Math.round(b.pemakaianHarian)} ${b.satuan} per hari.`)
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
