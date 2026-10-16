import { GAMBAR_PRODUK, LOGO_TOKO } from '@/data/gambar'

/**
 * Gambar untuk sebuah nama di layar: logo toko atau gambar produk.
 *
 * - Logo toko (UMKM dan distributor) dicocokkan dengan nama persis.
 * - Gambar produk dicocokkan dengan nama baku terpanjang yang terkandung di
 *   nama penawaran, supaya "Biji Kopi Arabika Gayo" tetap mendapat gambar
 *   "Biji Kopi Arabika".
 *
 * Mengembalikan null kalau tidak ada gambarnya (toko yang baru mendaftar,
 * produk di luar katalog); pemanggil lalu memakai huruf awal.
 * Berkasnya dibuat oleh `tools/buat_gambar.py`.
 */
export function gambarUntuk(nama: string): string | null {
  const dasar = import.meta.env.BASE_URL
  const logo = LOGO_TOKO[nama]
  if (logo) return `${dasar}gambar/logo/${logo}`
  const kecil = nama.toLowerCase()
  let terbaik: string | null = null
  let panjang = 0
  for (const [baku, berkas] of Object.entries(GAMBAR_PRODUK)) {
    if (baku.length > panjang && kecil.includes(baku.toLowerCase())) {
      terbaik = berkas
      panjang = baku.length
    }
  }
  return terbaik ? `${dasar}gambar/produk/${terbaik}` : null
}
