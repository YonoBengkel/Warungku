import type { Barang, Kemasan, TitikTren } from '@/lib/types'
import { angka } from '@/lib/format'

/**
 * Satuan simpan dan satuan tampil.
 *
 * Stok DISIMPAN dalam satuan terkecilnya (gram, ml, pcs) karena kasir
 * mengurangi stok per takaran: 18 gram kopi per gelas tidak bisa dicatat dalam
 * kilogram tanpa membulatkan. Tapi angka sekecil itu sulit dibaca cepat —
 * "9.600 ml" butuh waktu untuk dipahami, "9,6 liter" tidak.
 *
 * Jadi yang DITAMPILKAN adalah satuan tampil, dengan aturan:
 * 1. Bawaannya, berat dan volume naik ke kg dan liter. Barang hitungan (pcs,
 *    lembar, butir) tetap, karena "620 gelas" lebih jelas daripada "0,62 dus".
 * 2. Pemilik usaha boleh menggantinya per barang dengan salah satu kemasannya,
 *    misalnya air mineral dalam dus.
 *
 * Semua layar yang menampilkan atau meminta jumlah stok WAJIB lewat sini.
 * Angka yang ditampilkan dalam satu satuan lalu diketik balik dalam satuan lain
 * adalah cara tercepat membuat stok melompat seribu kali lipat.
 */

export type SatuanTampil = Kemasan

/** Satuan yang otomatis naik kalau pemilik usaha belum memilih sendiri. */
const NAIK: Record<string, SatuanTampil> = {
  gram: { nama: 'kg', isi: 1000 },
  ml: { nama: 'liter', isi: 1000 },
}

type SumberSatuan = Pick<Barang, 'satuan' | 'kemasan'> & { satuanTampil?: string | null }

/** Pilihan satuan tampil untuk satu barang, urut dari yang disarankan. */
export function pilihanSatuanTampil(b: SumberSatuan): SatuanTampil[] {
  const daftar: SatuanTampil[] = []
  const tambah = (s: SatuanTampil) => {
    if (s.isi > 0 && !daftar.some((x) => x.nama === s.nama)) daftar.push(s)
  }
  const naik = NAIK[b.satuan]
  if (naik) tambah(naik)
  tambah({ nama: b.satuan, isi: 1 })
  for (const k of b.kemasan) tambah({ nama: k.nama, isi: k.isi })
  return daftar
}

/** Satuan bawaan sebuah barang kalau pemilik usaha belum memilih. */
export function satuanTampilBawaan(b: Pick<Barang, 'satuan'>): SatuanTampil {
  return NAIK[b.satuan] ?? { nama: b.satuan, isi: 1 }
}

/** Satuan tampil yang berlaku untuk satu barang. */
export function satuanTampil(b: SumberSatuan): SatuanTampil {
  if (b.satuanTampil) {
    const dipilih = pilihanSatuanTampil(b).find((p) => p.nama === b.satuanTampil)
    if (dipilih) return dipilih
  }
  return satuanTampilBawaan(b)
}

/** Nilai dalam satuan simpan → nilai dalam satuan tampil. */
export function keTampil(b: SumberSatuan, nilaiSimpan: number): number {
  return nilaiSimpan / satuanTampil(b).isi
}

/**
 * Nilai yang diketik dalam satuan tampil → nilai dalam satuan simpan.
 * Dibulatkan ke satuan simpan terkecil supaya 0,1 kg tidak tersimpan sebagai
 * 100,00000000000001 gram.
 */
export function dariTampil(b: SumberSatuan, nilaiTampil: number): number {
  return Math.round(nilaiTampil * satuanTampil(b).isi * 100) / 100
}

/** Berapa angka di belakang koma yang masuk akal untuk satuan tampil ini. */
export function desimalTampil(b: SumberSatuan): number {
  return satuanTampil(b).isi > 1 ? 2 : 0
}

/** Nilai simpan → satuan tampil, dibulatkan ke presisi kolom isian. */
export function keTampilBulat(b: SumberSatuan, nilaiSimpan: number): number {
  const p = 10 ** desimalTampil(b)
  return Math.round(keTampil(b, nilaiSimpan) * p) / p
}

/** Langkah tombol tambah/kurang dalam satuan tampil. */
export function langkahTampil(b: SumberSatuan): number {
  const s = satuanTampil(b)
  if (s.isi === 1) return b.satuan === 'gram' || b.satuan === 'ml' ? 50 : 1
  return NAIK[b.satuan]?.nama === s.nama ? 0.1 : 1
}

/** Angka saja, dalam satuan tampil: 3400 gram → "3,4". */
export function angkaTampil(b: SumberSatuan, nilaiSimpan: number): string {
  const n = keTampil(b, nilaiSimpan)
  const desimal = Number.isInteger(n) ? 0 : Math.abs(n) < 10 ? 2 : 1
  return angka(n, desimal)
}

/** Angka dan satuannya: 3400 gram → "3,4 kg". */
export function jumlahTampil(b: SumberSatuan, nilaiSimpan: number): string {
  return `${angkaTampil(b, nilaiSimpan)} ${satuanTampil(b).nama}`
}

/** Titik grafik dalam satuan simpan → satuan tampil, supaya sumbu dan label grafik sama dengan angka di kartu. */
export function trenTampil(b: SumberSatuan, data: TitikTren[]): TitikTren[] {
  const isi = satuanTampil(b).isi
  if (isi === 1) return data
  const ubah = (n: number | null | undefined) => (n == null ? n : n / isi)
  return data.map((t) => ({
    ...t,
    aktual: ubah(t.aktual) as number | null,
    prediksi: ubah(t.prediksi) as number | null,
    batasBawah: ubah(t.batasBawah) as number | undefined,
    batasAtas: ubah(t.batasAtas) as number | undefined,
  }))
}

/**
 * Isi kemasan ditulis dalam satuan BAWAAN (kg/liter), bukan satuan tampil:
 * "1 dus = 12 liter". Memakai satuan tampil akan menghasilkan "1 dus = 1 dus"
 * untuk barang yang memang ditampilkan per dus.
 */
export function jumlahBawaan(b: Pick<Barang, 'satuan'>, nilaiSimpan: number): string {
  const s = satuanTampilBawaan(b)
  const n = nilaiSimpan / s.isi
  return `${angka(n, Number.isInteger(n) ? 0 : Math.abs(n) < 10 ? 2 : 1)} ${s.nama}`
}

/**
 * "1 dus = 12 liter", atau null kalau isinya cuma mengulang namanya sendiri
 * ("1 kg = 1 kg" tidak menerangkan apa pun).
 */
export function isiKemasan(b: Pick<Barang, 'satuan'>, nama: string, isi: number): string | null {
  const teks = jumlahBawaan(b, isi)
  return teks === `1 ${nama}` ? null : `1 ${nama} = ${teks}`
}

/**
 * Isi satu satuan jual dalam satuan dasar, ditulis dengan satuan yang wajar:
 * 5000 ml jadi "5 liter", 1000 gram jadi "1 kg", 24 pcs tetap "24 pcs".
 * Dipakai untuk barang distributor yang belum terkait daftar stok pemilik usaha.
 */
export function tulisIsi(isi: number, satuanIsi: string): string {
  if (satuanIsi === 'gram' && isi >= 1000) return `${angka(isi / 1000, 2)} kg`
  if (satuanIsi === 'ml' && isi >= 1000) return `${angka(isi / 1000, 2)} liter`
  return `${angka(isi)} ${satuanIsi}`
}

/**
 * "1 jerigen = 5 liter" untuk kemasan jual yang isinya tercatat sendiri.
 * Kosong kalau kalimatnya cuma mengulang dirinya ("1 kg = 1 kg").
 */
export function kalimatIsiKemasan(nama: string, isi: number, satuanIsi: string): string | null {
  const isiTertulis = tulisIsi(isi, satuanIsi)
  return isiTertulis === `1 ${nama}` ? null : `1 ${nama} = ${isiTertulis}`
}
