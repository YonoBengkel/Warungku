import { minta, type SesiServer } from './api'
import { rupiah } from './format'

/* ------------------------------------------------------------------ */
/* Shift kas dan akun kasir (Portal POS, tahap 5)                      */
/* ------------------------------------------------------------------ */

export interface Shift {
  id: number
  namaKasir: string
  dibukaPada: string
  ditutupPada: string | null
  modalAwal: number
  jumlahNota: number
  tunai: number
  qris: number
  transfer: number
  /** Modal awal ditambah tunai dari nota shift ini. */
  tunaiDiharapkan: number
  uangDihitung: number | null
  /** Uang dihitung dikurangi yang diharapkan. Negatif: laci kurang. */
  selisih: number | null
  catatan: string | null
}

interface ShiftApi {
  id: number
  nama_kasir: string
  dibuka_pada: string
  ditutup_pada: string | null
  modal_awal: number
  jumlah_nota: number
  tunai: number
  qris: number
  transfer: number
  tunai_diharapkan: number
  uang_dihitung: number | null
  selisih: number | null
  catatan: string | null
}

const keShift = (s: ShiftApi): Shift => ({
  id: s.id,
  namaKasir: s.nama_kasir,
  dibukaPada: s.dibuka_pada,
  ditutupPada: s.ditutup_pada,
  modalAwal: s.modal_awal,
  jumlahNota: s.jumlah_nota,
  tunai: s.tunai,
  qris: s.qris,
  transfer: s.transfer,
  tunaiDiharapkan: s.tunai_diharapkan,
  uangDihitung: s.uang_dihitung,
  selisih: s.selisih,
  catatan: s.catatan,
})

export async function ambilShiftAktif(sesi: SesiServer): Promise<Shift | null> {
  const s = await minta<ShiftApi | null>(`/usaha/${sesi.usahaId}/shift/aktif`, { token: sesi.token })
  return s ? keShift(s) : null
}

export async function bukaShift(sesi: SesiServer, modalAwal: number): Promise<Shift> {
  const s = await minta<ShiftApi>(`/usaha/${sesi.usahaId}/shift/buka`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ modal_awal: modalAwal }),
  })
  return keShift(s)
}

export async function tutupShift(sesi: SesiServer, uangDihitung: number, catatan: string): Promise<Shift> {
  const s = await minta<ShiftApi>(`/usaha/${sesi.usahaId}/shift/tutup`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ uang_dihitung: uangDihitung, catatan: catatan.trim() || null }),
  })
  return keShift(s)
}

/** Riwayat shift untuk pemilik. */
export async function ambilRiwayatShift(sesi: SesiServer, batas = 5, mulai = 0): Promise<Shift[]> {
  const isi = await minta<ShiftApi[]>(`/usaha/${sesi.usahaId}/shift?batas=${batas}&mulai=${mulai}`, { token: sesi.token })
  return isi.map(keShift)
}

/** "Pas", "Lebih Rp 5.000", atau "Kurang Rp 5.000". */
export function kataSelisih(selisih: number): string {
  if (selisih === 0) return 'Pas'
  return selisih > 0 ? `Lebih ${rupiah(selisih)}` : `Kurang ${rupiah(-selisih)}`
}

export interface AkunKasir {
  penggunaId: number
  nama: string
  email: string | null
  nomorHp: string
  aktif: boolean
  dibuatPada: string | null
}

interface AkunKasirApi {
  pengguna_id: number
  nama: string
  email: string | null
  nomor_hp: string
  aktif: boolean
  dibuat_pada: string | null
}

const keAkun = (a: AkunKasirApi): AkunKasir => ({
  penggunaId: a.pengguna_id,
  nama: a.nama,
  email: a.email,
  nomorHp: a.nomor_hp,
  aktif: a.aktif,
  dibuatPada: a.dibuat_pada,
})

export async function ambilKasir(sesi: SesiServer): Promise<AkunKasir[]> {
  return (await minta<AkunKasirApi[]>(`/usaha/${sesi.usahaId}/kasir`, { token: sesi.token })).map(keAkun)
}

export async function tambahKasir(
  sesi: SesiServer,
  isi: { nama: string; email: string; nomorHp: string; kataSandi: string },
): Promise<AkunKasir> {
  const r = await minta<AkunKasirApi>(`/usaha/${sesi.usahaId}/kasir`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ nama: isi.nama, email: isi.email, nomor_hp: isi.nomorHp, kata_sandi: isi.kataSandi }),
  })
  return keAkun(r)
}

export async function ubahKasir(sesi: SesiServer, penggunaId: number, isi: { aktif?: boolean; kataSandi?: string }): Promise<AkunKasir> {
  const r = await minta<AkunKasirApi>(`/usaha/${sesi.usahaId}/kasir/${penggunaId}`, {
    method: 'PATCH',
    token: sesi.token,
    body: JSON.stringify({ aktif: isi.aktif, kata_sandi: isi.kataSandi }),
  })
  return keAkun(r)
}
