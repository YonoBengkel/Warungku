/**
 * Status dibaca pemberitahuan, disimpan di peramban per akun (revisi V5, Q120).
 *
 * Server belum punya tabel pemberitahuan: isi lonceng diturunkan ulang dari data
 * setiap kali dimuat, jadi tanpa catatan ini semua pemberitahuan kembali "belum
 * dibaca" setiap halaman dimuat ulang. Tiap entri mengingat isi pemberitahuan saat
 * dibaca (`tanda`). Kalau isinya berubah, misalnya barang yang menipis lalu habis,
 * pemberitahuan itu muncul lagi sebagai belum dibaca.
 *
 * Penyimpanan bisa kosong atau ditolak peramban (jendela pribadi, data situs
 * dihapus); dalam keadaan itu aplikasi tetap jalan, hanya tanpa ingatan.
 */

export interface EntriDibaca {
  tanda: string
  /** Waktu pemberitahuan itu muncul, supaya urutannya tetap sesudah dimuat ulang. */
  waktu?: string
}

export type PetaDibaca = Record<string, EntriDibaca>

export const kunciDibacaUsaha = (usahaId: string | number) => `turnify-dibaca-usaha-${usahaId}`
export const kunciDibacaDistributor = (distributorId: string | number) => `turnify-dibaca-distributor-${distributorId}`

export function bacaPetaDibaca(kunci: string): PetaDibaca {
  try {
    const teks = window.localStorage.getItem(kunci)
    const isi = teks ? (JSON.parse(teks) as unknown) : null
    return isi && typeof isi === 'object' ? (isi as PetaDibaca) : {}
  } catch {
    return {}
  }
}

export function simpanPetaDibaca(kunci: string, peta: PetaDibaca): void {
  try {
    window.localStorage.setItem(kunci, JSON.stringify(peta))
  } catch {
    /* Penyimpanan penuh atau ditolak: status dibaca cukup diingat selama tab terbuka. */
  }
}
