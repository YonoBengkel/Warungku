import type { JenisUsaha, Penawaran, PesananMasuk } from '@/lib/types'
import { umkmById } from '@/data/dummy'

/**
 * Segmentasi UMKM pelanggan satu distributor (ON-Dist 2): mesin analitik
 * ketiga, setelah perkiraan stok dan rekomendasi distributor.
 *
 * Fiturnya campuran angka dan kategori:
 *   angka    — kapan terakhir memesan (R), seberapa sering (F), seberapa besar
 *              belanjanya (M), pola RFM yang lazim untuk pelanggan;
 *   kategori — jenis usaha pemesan dan kategori barang yang paling banyak ia beli.
 *
 * Karena campuran, dipakai K-Prototypes (Huang, 1998), bukan K-Means: jarak
 * angka diukur kuadrat selisih setelah dibakukan, jarak kategori dihitung dari
 * berapa banyak yang berbeda, dikalikan bobot gamma. Pusat kelompok untuk angka
 * adalah rata-rata, untuk kategori adalah modus.
 *
 * Purwarupa menjalankannya di peramban dengan inisialisasi yang tetap (bukan
 * acak), jadi hasilnya sama setiap kali dibuka. Di sistem sungguhan bagian ini
 * pindah ke layanan analitik yang sama dengan model perkiraan stok, dengan
 * data yang jauh lebih panjang dari data contoh ini.
 */

export type KunciSegmen = 'andalan' | 'rutin' | 'sedang' | 'baru' | 'kecil' | 'jarang'

export interface FiturPelanggan {
  umkmId: string
  /** Hari sejak pesanan terakhir. */
  recency: number
  /** Banyaknya pesanan yang tidak ditolak. */
  frequency: number
  /** Nilai belanja barang, rupiah. */
  monetary: number
  jenisUsaha: JenisUsaha | 'lainnya'
  kategoriUtama: string
  /** Hari sejak toko ini pertama kali memesan; hanya dipakai untuk menamai segmen "baru". */
  lamaBerlangganan: number
}

export interface Segmen {
  kunci: KunciSegmen
  nama: string
  /** Satu kalimat: siapa mereka. */
  ciri: string
  /** Satu kalimat: apa yang sebaiknya dilakukan distributor. */
  saran: string
  anggota: FiturPelanggan[]
  rataRata: { recency: number; frequency: number; monetary: number }
}

const NAMA_SEGMEN: Record<KunciSegmen, { nama: string; ciri: string; saran: string }> = {
  andalan: {
    nama: 'Pelanggan andalan',
    ciri: 'Paling sering memesan dengan belanja paling besar.',
    saran: 'Tawarkan paket kontrak atau promo keanggotaan supaya mereka bertahan.',
  },
  rutin: {
    nama: 'Pelanggan rutin',
    ciri: 'Memesan lebih sering dari kebanyakan toko, belanjanya sedang.',
    saran: 'Tawarkan kontrak supaya kuotanya pasti dan jadwal kirim bisa direncanakan.',
  },
  sedang: {
    nama: 'Pelanggan sedang',
    ciri: 'Frekuensi dan belanjanya di tengah-tengah.',
    saran: 'Kabari promo untuk kategori yang paling sering mereka beli.',
  },
  baru: {
    nama: 'Pelanggan baru',
    ciri: 'Baru mulai memesan dalam sebulan terakhir.',
    saran: 'Pastikan kiriman pertamanya tepat waktu dan jumlahnya pas.',
  },
  kecil: {
    nama: 'Belanja kecil',
    ciri: 'Memesan sesekali dengan nilai belanja paling kecil.',
    saran: 'Tawarkan pesanan gabungan supaya ongkos kirimnya sepadan.',
  },
  jarang: {
    nama: 'Mulai jarang memesan',
    ciri: 'Sudah lebih dari dua minggu tidak memesan lagi.',
    saran: 'Sapa lewat promo produk baru sebelum mereka pindah ke distributor lain.',
  },
}

/*
 * Ambang untuk nama yang menyatakan waktu. Algoritmanya hanya mengelompokkan;
 * nama yang menyebut waktu baru dipakai kalau datanya memang menunjukkannya,
 * bukan sekadar karena kelompok itu "paling" di antara yang lain.
 */
const HARI_MULAI_JARANG = 14
const HARI_PELANGGAN_BARU = 30

/** Banyaknya kelompok. Data contoh hanya belasan toko, jadi empat sudah cukup kasar. */
const K = 4
const MAKS_ULANG = 30
const HARI = 86_400_000

/* ------------------------------------------------------------------ */
/* Fitur                                                               */
/* ------------------------------------------------------------------ */

export function fiturPelanggan(
  pesanan: PesananMasuk[],
  katalog: Penawaran[],
  sekarang: number = Date.now(),
): FiturPelanggan[] {
  const perToko = new Map<string, PesananMasuk[]>()
  for (const p of pesanan) {
    if (p.status === 'ditolak') continue
    perToko.set(p.umkmId, [...(perToko.get(p.umkmId) ?? []), p])
  }

  const hasil: FiturPelanggan[] = []
  for (const [umkmId, daftar] of perToko) {
    const terakhir = Math.max(...daftar.map((p) => +new Date(p.dibuatPada)))
    const perKategori = new Map<string, number>()
    let monetary = 0
    for (const p of daftar) {
      for (const b of p.baris) {
        const nilai = b.jumlah * b.hargaSatuan
        monetary += nilai
        const kategori = katalog.find((x) => x.id === b.penawaranId)?.kategori ?? 'Lainnya'
        perKategori.set(kategori, (perKategori.get(kategori) ?? 0) + nilai)
      }
    }
    const kategoriUtama = [...perKategori.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Lainnya'
    const umkm = umkmById(umkmId)
    const pertama = Math.min(...daftar.map((p) => +new Date(p.dibuatPada)), umkm ? +new Date(umkm.sejak) : Infinity)
    hasil.push({
      umkmId,
      recency: Math.max(0, Math.round((sekarang - terakhir) / HARI)),
      frequency: daftar.length,
      monetary,
      jenisUsaha: umkm?.jenisUsaha ?? 'lainnya',
      kategoriUtama,
      lamaBerlangganan: Math.max(0, Math.round((sekarang - pertama) / HARI)),
    })
  }
  return hasil
}

/* ------------------------------------------------------------------ */
/* K-Prototypes                                                        */
/* ------------------------------------------------------------------ */

interface Titik {
  angka: number[]
  kategori: string[]
}

function baku(nilai: number[]): number[] {
  const rata = nilai.reduce((s, x) => s + x, 0) / nilai.length
  const sb = Math.sqrt(nilai.reduce((s, x) => s + (x - rata) ** 2, 0) / nilai.length)
  return nilai.map((x) => (sb > 0 ? (x - rata) / sb : 0))
}

function jarak(a: Titik, pusat: Titik, gamma: number): number {
  let d = 0
  for (let i = 0; i < a.angka.length; i++) d += (a.angka[i] - pusat.angka[i]) ** 2
  for (let i = 0; i < a.kategori.length; i++) if (a.kategori[i] !== pusat.kategori[i]) d += gamma
  return d
}

function modus(nilai: string[]): string {
  const hitung = new Map<string, number>()
  for (const v of nilai) hitung.set(v, (hitung.get(v) ?? 0) + 1)
  return [...hitung.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
}

/**
 * Mengelompokkan titik campuran angka dan kategori ke `k` kelompok.
 * Mengembalikan nomor kelompok tiap titik.
 */
export function kPrototypes(titik: Titik[], k: number, gamma: number): number[] {
  const n = titik.length
  if (n === 0) return []
  const kEfektif = Math.min(k, n)

  // Inisialisasi tetap: titik diurutkan menurut angka pertamanya (nilai
  // belanja), lalu diambil berjarak sama. Hasilnya bisa diulang, dan pusat
  // awalnya sudah tersebar dari yang kecil sampai yang besar.
  const urut = [...titik.keys()].sort((a, b) => titik[a].angka[0] - titik[b].angka[0])
  let pusat: Titik[] = Array.from({ length: kEfektif }, (_, i) => {
    const t = titik[urut[Math.floor(((i + 0.5) * n) / kEfektif)]]
    return { angka: [...t.angka], kategori: [...t.kategori] }
  })

  let label = new Array<number>(n).fill(-1)
  for (let ulang = 0; ulang < MAKS_ULANG; ulang++) {
    const baru = titik.map((t) => {
      let terbaik = 0
      let dTerbaik = Infinity
      pusat.forEach((c, j) => {
        const d = jarak(t, c, gamma)
        if (d < dTerbaik) {
          dTerbaik = d
          terbaik = j
        }
      })
      return terbaik
    })
    const berubah = baru.some((l, i) => l !== label[i])
    label = baru
    if (!berubah) break

    pusat = pusat.map((c, j) => {
      const anggota = titik.filter((_, i) => label[i] === j)
      // Kelompok kosong mempertahankan pusat lamanya, bukan dibuang: jumlah
      // kelompok harus tetap supaya setiap peran segmen tetap punya tempat.
      if (anggota.length === 0) return c
      return {
        angka: c.angka.map((_, d) => anggota.reduce((s, t) => s + t.angka[d], 0) / anggota.length),
        kategori: c.kategori.map((_, d) => modus(anggota.map((t) => t.kategori[d]))),
      }
    })
  }
  return label
}

/* ------------------------------------------------------------------ */
/* Segmen siap tampil                                                  */
/* ------------------------------------------------------------------ */

function rata(daftar: FiturPelanggan[], ambil: (f: FiturPelanggan) => number): number {
  return daftar.length ? daftar.reduce((s, f) => s + ambil(f), 0) / daftar.length : 0
}

/**
 * Segmen pelanggan, diurutkan dari yang paling berharga. Nama segmen tidak
 * datang dari algoritmanya (ia hanya memberi nomor kelompok) tetapi dari ciri
 * rata-rata tiap kelompok: yang skornya paling tinggi jadi "andalan", yang
 * paling lama tidak memesan jadi "mulai jarang", dan seterusnya.
 */
export function segmentasiPelanggan(pesanan: PesananMasuk[], katalog: Penawaran[]): Segmen[] {
  const fitur = fiturPelanggan(pesanan, katalog)
  if (fitur.length === 0) return []

  // Nilai belanja dilog dulu supaya satu toko besar tidak menelan skala.
  const m = baku(fitur.map((f) => Math.log1p(f.monetary)))
  const f = baku(fitur.map((x) => x.frequency))
  const r = baku(fitur.map((x) => x.recency))
  const titik: Titik[] = fitur.map((x, i) => ({
    angka: [m[i], f[i], r[i]],
    kategori: [x.jenisUsaha, x.kategoriUtama],
  }))

  // Bobot kategori setengah simpangan baku angka (yang sudah 1 setelah
  // dibakukan), sesuai anjuran Huang untuk data berskala campuran.
  const label = kPrototypes(titik, K, 0.5)

  const kelompok = new Map<number, FiturPelanggan[]>()
  label.forEach((l, i) => kelompok.set(l, [...(kelompok.get(l) ?? []), fitur[i]]))
  const daftar = [...kelompok.values()].map((anggota) => ({
    anggota,
    rataRata: {
      recency: rata(anggota, (x) => x.recency),
      frequency: rata(anggota, (x) => x.frequency),
      monetary: rata(anggota, (x) => x.monetary),
    },
    lamaBerlangganan: rata(anggota, (x) => x.lamaBerlangganan),
  }))
  type Kelompok = (typeof daftar)[number]

  // Pemberian nama: tiap kelompok mendapat satu peran, diambil berurutan.
  // Peran yang menyebut waktu (jarang, baru) hanya dipakai kalau ambangnya
  // terpenuhi; sisanya dinamai menurut belanja dan frekuensi.
  const skor = (k: Kelompok) =>
    Math.log1p(k.rataRata.monetary) / 15 + k.rataRata.frequency / 4 - k.rataRata.recency / 14
  const sisa = [...daftar]
  const peran = new Map<Kelompok, KunciSegmen>()
  const ambil = (kunci: KunciSegmen, urut: (a: Kelompok, b: Kelompok) => number, syarat: (k: Kelompok) => boolean = () => true) => {
    const calon = sisa.filter(syarat).sort(urut)[0]
    if (!calon) return
    peran.set(calon, kunci)
    sisa.splice(sisa.indexOf(calon), 1)
  }
  ambil('andalan', (a, b) => skor(b) - skor(a))
  ambil('jarang', (a, b) => b.rataRata.recency - a.rataRata.recency, (k) => k.rataRata.recency >= HARI_MULAI_JARANG)
  ambil('baru', (a, b) => a.lamaBerlangganan - b.lamaBerlangganan, (k) => k.lamaBerlangganan <= HARI_PELANGGAN_BARU)
  ambil('rutin', (a, b) => b.rataRata.frequency - a.rataRata.frequency)
  ambil('kecil', (a, b) => a.rataRata.monetary - b.rataRata.monetary)
  for (const k of sisa) peran.set(k, 'sedang')

  const urutan: KunciSegmen[] = ['andalan', 'rutin', 'sedang', 'baru', 'kecil', 'jarang']
  return daftar
    .map((k) => {
      const kunci = peran.get(k) ?? 'sedang'
      return { kunci, ...NAMA_SEGMEN[kunci], anggota: k.anggota, rataRata: k.rataRata }
    })
    .sort((a, b) => urutan.indexOf(a.kunci) - urutan.indexOf(b.kunci))
}
