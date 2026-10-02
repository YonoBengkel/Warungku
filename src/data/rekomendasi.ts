import type { Barang, Distributor, JenisUsaha, Penawaran, Promo } from '@/lib/types'
import { daftarDistributor, daftarPenawaran, daftarPromo, rincianHarga } from '@/data/dummy'

/**
 * Rekomendasi distributor (Skenario A), dua lapis.
 *
 * Lapis 1 — aturan IF-ELSE dari data pendaftaran. Distributor hanya lolos kalau
 * ketiga syarat ini terpenuhi, diperiksa berurutan:
 *
 *   kategori barangnya cocok dengan jenis usahamu   → kalau tidak: 'kategori'
 *   area kirimnya mencakup kotamu                    → kalau tidak: 'area'
 *   masih ada barang yang stoknya tersedia           → kalau tidak: 'stok'
 *
 * Lapis ini yang bekerja sejak hari pertama: pemilik usaha yang baru mendaftar
 * belum punya riwayat pesanan, tapi jenis usaha dan kotanya sudah diketahui.
 *
 * Lapis 2 — skor dari data yang dikumpulkan aplikasi, untuk mengurutkan
 * distributor yang lolos: tiga aspek ulasan UMKM (ketepatan waktu, kesesuaian
 * jumlah, kondisi barang) dan harga. Nilai ulasan dihaluskan secara Bayesian:
 * distributor dengan sedikit ulasan ditarik ke rata-rata semua distributor,
 * jadi satu ulasan bintang lima tidak langsung mengalahkan enam puluh ulasan
 * bintang 4,8, dan distributor baru tidak dianggap bernilai nol.
 */

/**
 * Kategori barang distributor yang dibutuhkan tiap jenis usaha. `null` berarti
 * tidak menyaring kategori: usaha di luar daftar tetap mendapat rekomendasi.
 */
export const KATEGORI_JENIS_USAHA: Record<JenisUsaha, string[] | null> = {
  'kedai-kopi': ['Kopi & Teh', 'Susu & Olahan', 'Pemanis', 'Kemasan', 'Pendukung', 'Bahan Makanan'],
  'kedai-minuman': ['Kopi & Teh', 'Susu & Olahan', 'Pemanis', 'Kemasan', 'Pendukung'],
  'warung-makan': ['Bahan Makanan', 'Protein', 'Pemanis', 'Kopi & Teh', 'Pendukung', 'Kemasan'],
  'roti-kue': ['Bahan Makanan', 'Protein', 'Susu & Olahan', 'Pemanis', 'Kemasan'],
  'warung-kelontong': ['Bahan Makanan', 'Pemanis', 'Susu & Olahan', 'Kopi & Teh', 'Pendukung'],
  lainnya: null,
}

export type AspekUlasan = keyof Distributor['subRating']

const ASPEK: AspekUlasan[] = ['ketepatanWaktu', 'jumlahSesuai', 'kondisiBarang']

/** Kekuatan rata-rata awal pada penghalusan Bayesian, setara sekian ulasan. */
export const BOBOT_AWAL = 10

/** Bobot tiap komponen skor. Jumlahnya 1; harga dilewati kalau tidak ada pembandingnya. */
const BOBOT_SKOR: Record<AspekUlasan | 'harga', number> = {
  ketepatanWaktu: 0.3,
  jumlahSesuai: 0.25,
  kondisiBarang: 0.25,
  harga: 0.2,
}

export type AlasanTersaring = 'kategori' | 'area' | 'stok'

export interface DistributorDirekomendasikan {
  distributor: Distributor
  /** 0..1, hanya untuk mengurutkan. Tidak ditampilkan sebagai angka. */
  skor: number
  /** Nilai ulasan per aspek setelah dihaluskan, skala 1–5. */
  aspek: Record<AspekUlasan, number>
  /**
   * Rata-rata (harga termurah ÷ harga distributor ini) untuk barang di daftar
   * stokmu yang juga dijual distributor lain. 1 = selalu termurah. `null`
   * kalau tidak ada satu pun barang yang punya pembanding.
   */
  indeksHarga: number | null
  /** Nama penawaran distributor ini yang paling murah di antara penjual barang yang sama. */
  termurah: string[]
  /** Kategori distributor yang cocok dengan jenis usahamu. */
  kategoriCocok: string[]
}

export interface DistributorTersaring {
  distributor: Distributor
  /** Syarat pertama yang tidak terpenuhi. */
  alasan: AlasanTersaring
}

/**
 * Nilai yang dihaluskan: rata-rata berbobot antara nilai distributor
 * (sebanyak `jumlahUlasan`) dan rata-rata semua distributor (sebanyak
 * `bobotAwal`). Tanpa ulasan sama sekali, hasilnya persis rata-rata.
 */
export function nilaiDihaluskan(nilai: number, jumlahUlasan: number, rataRata: number, bobotAwal = BOBOT_AWAL): number {
  return (bobotAwal * rataRata + jumlahUlasan * nilai) / (bobotAwal + jumlahUlasan)
}

/** Rata-rata tiap aspek di semua distributor, ditimbang dengan jumlah ulasannya. */
export function rataRataAspek(kumpulan: Distributor[]): Record<AspekUlasan, number> {
  const totalUlasan = kumpulan.reduce((s, d) => s + d.jumlahUlasan, 0)
  const hasil = {} as Record<AspekUlasan, number>
  for (const a of ASPEK) {
    // Belum ada ulasan di mana pun: titik tengah skala, bukan nol.
    hasil[a] = totalUlasan > 0 ? kumpulan.reduce((s, d) => s + d.subRating[a] * d.jumlahUlasan, 0) / totalUlasan : 3
  }
  return hasil
}

/** "Sleman, DI Yogyakarta" dan "Kab. Sleman" sama-sama menjadi "sleman". */
function namaWilayah(teks: string): string {
  return teks
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/^(kabupaten|kab\.?)\s+/, '')
}

/** Kota di profil diketik bebas, jadi "Yogyakarta" tetap dianggap sama dengan area "Kota Yogyakarta". */
export function areaMencakup(area: string, kota: string): boolean {
  const a = namaWilayah(area)
  const k = namaWilayah(kota)
  return a === k || a === `kota ${k}` || k === `kota ${a}`
}

/** Harga beli sekali per satuan simpan barang (per gram, ml, pcs), sudah termasuk potongan promo. */
function hargaPerSatuanSimpan(p: Penawaran, promo: Promo[]): number {
  return rincianHarga(p.id, null, undefined, promo).harga / (p.kemasanJual?.isi ?? 1)
}

export function rekomendasiDistributor({
  jenisUsaha,
  kota,
  barang,
  promo = daftarPromo,
  distributor = daftarDistributor,
  penawaran = daftarPenawaran,
}: {
  jenisUsaha: JenisUsaha
  kota: string
  /** Daftar stok pemilik usaha; dipakai untuk membandingkan harga barang yang memang ia beli. */
  barang: Barang[]
  promo?: Promo[]
  distributor?: Distributor[]
  penawaran?: Penawaran[]
}): { direkomendasikan: DistributorDirekomendasikan[]; tersaring: DistributorTersaring[] } {
  const kategoriDicari = KATEGORI_JENIS_USAHA[jenisUsaha]

  /* ---------------- Lapis 1: IF-ELSE ---------------- */
  const lolos: Array<{ d: Distributor; kategoriCocok: string[] }> = []
  const tersaring: DistributorTersaring[] = []
  for (const d of distributor) {
    const kategoriCocok = kategoriDicari ? d.kategori.filter((k) => kategoriDicari.includes(k)) : d.kategori
    if (kategoriCocok.length === 0) {
      tersaring.push({ distributor: d, alasan: 'kategori' })
    } else if (!d.areaKirim.some((a) => areaMencakup(a, kota))) {
      tersaring.push({ distributor: d, alasan: 'area' })
    } else if (!penawaran.some((p) => p.distributorId === d.id && p.stokTersedia > 0)) {
      tersaring.push({ distributor: d, alasan: 'stok' })
    } else {
      lolos.push({ d, kategoriCocok })
    }
  }

  /* ---------------- Lapis 2: skor ---------------- */
  const rataRata = rataRataAspek(distributor)

  // Harga termurah per barang, dihitung hanya dari distributor yang lolos:
  // membandingkan dengan penjual yang tidak mengirim ke kotamu tidak adil.
  const idLolos = new Set(lolos.map((x) => x.d.id))
  const idBarangKamu = new Set(barang.map((b) => b.id))
  const penjualPerBarang = new Map<string, Array<{ p: Penawaran; harga: number }>>()
  for (const p of penawaran) {
    if (!p.barangIdTerkait || !idBarangKamu.has(p.barangIdTerkait) || !idLolos.has(p.distributorId)) continue
    if (p.stokTersedia <= 0) continue
    const daftar = penjualPerBarang.get(p.barangIdTerkait) ?? []
    daftar.push({ p, harga: hargaPerSatuanSimpan(p, promo) })
    penjualPerBarang.set(p.barangIdTerkait, daftar)
  }

  const direkomendasikan = lolos.map(({ d, kategoriCocok }): DistributorDirekomendasikan => {
    const aspek = {} as Record<AspekUlasan, number>
    for (const a of ASPEK) aspek[a] = nilaiDihaluskan(d.subRating[a], d.jumlahUlasan, rataRata[a])

    const rasio: number[] = []
    const termurah: string[] = []
    for (const penjual of penjualPerBarang.values()) {
      if (penjual.length < 2) continue // tidak ada pembanding
      const milikSendiri = penjual.find((x) => x.p.distributorId === d.id)
      if (!milikSendiri) continue
      const minimum = Math.min(...penjual.map((x) => x.harga))
      rasio.push(minimum / milikSendiri.harga)
      if (milikSendiri.harga <= minimum) termurah.push(milikSendiri.p.nama)
    }
    const indeksHarga = rasio.length > 0 ? rasio.reduce((s, r) => s + r, 0) / rasio.length : null

    // Skala 1–5 diubah ke 0..1 supaya sejajar dengan indeks harga.
    let jumlah = 0
    let bobot = 0
    for (const a of ASPEK) {
      jumlah += BOBOT_SKOR[a] * ((aspek[a] - 1) / 4)
      bobot += BOBOT_SKOR[a]
    }
    if (indeksHarga != null) {
      jumlah += BOBOT_SKOR.harga * indeksHarga
      bobot += BOBOT_SKOR.harga
    }

    return { distributor: d, skor: jumlah / bobot, aspek, indeksHarga, termurah, kategoriCocok }
  })

  direkomendasikan.sort(
    (a, b) =>
      b.skor - a.skor ||
      b.distributor.jumlahUlasan - a.distributor.jumlahUlasan ||
      a.distributor.nama.localeCompare(b.distributor.nama),
  )

  return { direkomendasikan, tersaring }
}
