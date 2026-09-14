/**
 * Pemformatan lokal Indonesia.
 *
 * Aturan yang dipegang di seluruh aplikasi:
 * - Rupiah memakai pemisah ribuan titik, tanpa desimal (Rp 1.250.000).
 * - Angka besar diringkas saat ruang sempit (1,2 jt) tapi TIDAK PERNAH pada
 *   nilai yang harus diverifikasi pengguna (total komitmen kontrak, total bayar).
 * - Waktu ditulis relatif ("2 hari lagi") karena lebih cepat dibaca sambil
 *   melayani pembeli, dengan tanggal penuh sebagai title/tooltip.
 */

const nfID = new Intl.NumberFormat('id-ID')

/** 1250000 -> "1.250.000" */
export function angka(n: number, maksDesimal = 0): string {
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maksDesimal,
  }).format(n)
}

/** 1250000 -> "Rp 1.250.000" */
export function rupiah(n: number): string {
  if (!Number.isFinite(n)) return 'Rp 0'
  return `Rp ${nfID.format(Math.round(n))}`
}

/**
 * Versi ringkas untuk kartu sempit: 1250000 -> "Rp 1,25 jt".
 * Jangan dipakai pada nilai yang jadi dasar keputusan finansial pengguna.
 */
export function rupiahRingkas(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `Rp ${angka(n / 1_000_000_000, 2)} m`
  if (abs >= 1_000_000) return `Rp ${angka(n / 1_000_000, 2)} jt`
  if (abs >= 100_000) return `Rp ${angka(n / 1000, 0)} rb`
  return rupiah(n)
}

/** Jumlah + satuan, mis. 12.5 kg -> "12,5 kg" */
export function jumlahSatuan(n: number, satuan: string): string {
  const desimal = Number.isInteger(n) ? 0 : n < 10 ? 2 : 1
  return `${angka(n, desimal)} ${satuan}`
}

export function persen(n: number, desimal = 0): string {
  return `${angka(n, desimal)}%`
}

/* ------------------------------------------------------------------ */
/* Waktu                                                               */
/* ------------------------------------------------------------------ */

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d)
}

/** "13 September 2026" */
export function tanggalPanjang(d: Date | string | number): string {
  const t = toDate(d)
  return `${t.getDate()} ${BULAN[t.getMonth()]} ${t.getFullYear()}`
}

/** "13 Sep 2026" */
export function tanggalPendek(d: Date | string | number): string {
  const t = toDate(d)
  return `${t.getDate()} ${BULAN_SINGKAT[t.getMonth()]} ${t.getFullYear()}`
}

/** "13 Sep" */
export function tanggalRingkas(d: Date | string | number): string {
  const t = toDate(d)
  return `${t.getDate()} ${BULAN_SINGKAT[t.getMonth()]}`
}

/** "Sabtu, 13 September 2026" */
export function tanggalLengkapHari(d: Date | string | number): string {
  const t = toDate(d)
  return `${HARI[t.getDay()]}, ${tanggalPanjang(t)}`
}

export function namaHariSingkat(d: Date | string | number): string {
  return HARI[toDate(d).getDay()].slice(0, 3)
}

/** "14:05" */
export function jam(d: Date | string | number): string {
  const t = toDate(d)
  return `${String(t.getHours()).padStart(2, '0')}.${String(t.getMinutes()).padStart(2, '0')}`
}

function selisihHari(a: Date, b: Date): number {
  const ms = 86_400_000
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ua - ub) / ms)
}

/**
 * Waktu relatif ke masa lalu: "baru saja", "5 menit lalu", "kemarin", "3 hari lalu".
 * Dipakai untuk stempel sinkronisasi dan riwayat.
 */
export function waktuLalu(d: Date | string | number, sekarang = new Date()): string {
  const t = toDate(d)
  const detik = Math.floor((sekarang.getTime() - t.getTime()) / 1000)
  if (detik < 45) return 'baru saja'
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`
  const hari = selisihHari(sekarang, t)
  if (hari === 0) return `${Math.floor(detik / 3600)} jam lalu`
  if (hari === 1) return 'kemarin'
  if (hari < 7) return `${hari} hari lalu`
  if (hari < 30) return `${Math.floor(hari / 7)} minggu lalu`
  return tanggalPendek(t)
}

/**
 * Waktu relatif ke masa depan: "hari ini", "besok", "3 hari lagi", "2 minggu lagi".
 * Dipakai untuk perkiraan stok habis dan tenggat kontrak.
 */
export function waktuNanti(d: Date | string | number, sekarang = new Date()): string {
  const t = toDate(d)
  const hari = selisihHari(t, sekarang)
  if (hari < 0) return `lewat ${Math.abs(hari)} hari`
  if (hari === 0) return 'hari ini'
  if (hari === 1) return 'besok'
  if (hari < 14) return `${hari} hari lagi`
  if (hari < 60) return `${Math.round(hari / 7)} minggu lagi`
  return `${Math.round(hari / 30)} bulan lagi`
}

/**
 * "3 hari lagi" dari jumlah hari langsung (tanpa objek Date).
 *
 * Nol berarti hari ini, bukan sudah lewat. Bedanya penting: stok yang cukup
 * untuk nol hari artinya habis hari ini juga, dan kalimat "diperkirakan habis
 * sudah lewat" tidak berarti apa-apa buat pemilik warung.
 */
export function hariLagi(hari: number): string {
  if (hari < 0) return 'sudah lewat'
  if (hari === 0) return 'hari ini'
  if (hari === 1) return 'besok'
  if (hari < 14) return `${hari} hari lagi`
  if (hari < 60) return `${Math.round(hari / 7)} minggu lagi`
  return `${Math.round(hari / 30)} bulan lagi`
}

export function durasiBulan(n: number): string {
  return `${n} bulan`
}

/* ------------------------------------------------------------------ */
/* Teks                                                                */
/* ------------------------------------------------------------------ */

export function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** 081234567890 -> "0812-3456-7890" */
export function nomorHp(n: string): string {
  const d = n.replace(/\D/g, '')
  if (d.length < 7) return n
  return d.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
}

export function potong(teks: string, maks: number): string {
  return teks.length <= maks ? teks : `${teks.slice(0, maks - 1).trimEnd()}…`
}

/** Menggabungkan kelas Tailwind secara kondisional. */
export function cx(...bagian: Array<string | false | null | undefined>): string {
  return bagian.filter(Boolean).join(' ')
}
