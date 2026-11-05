/**
 * Isian langkah 1 pendaftaran, dipegang sampai akunnya dibuat di langkah 2. Hanya di memori:
 * kata sandi tidak pernah masuk penyimpanan peramban. Muat ulang berarti kembali ke langkah 1.
 */
let isian: { nomorHp: string; kataSandi: string } | null = null

export function simpanIsianDaftar(nomorHp: string, kataSandi: string) {
  isian = { nomorHp, kataSandi }
}

export function ambilIsianDaftar() {
  return isian
}

export function hapusIsianDaftar() {
  isian = null
}
