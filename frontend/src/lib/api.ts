import type { Barang, KematanganPerkiraan, SumberBatasAman, TingkatLayanan } from '@/lib/types'
import type { BulananBarang } from '@/data/dummy'

/**
 * Satu-satunya tempat frontend berbicara dengan backend.
 *
 * Layar tidak pernah memanggil `fetch` sendiri. Semua jawaban server
 * diterjemahkan di sini ke tipe yang sudah dipakai layar (`Barang`, dst.),
 * supaya komponen tidak perlu tahu apakah datanya datang dari server atau dari
 * data contoh. Angka dari server berupa string desimal (`"3400.000"`) karena
 * NUMERIC di PostgreSQL; di sini diubah ke `number` sekali saja.
 */

const ALAMAT = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const KUNCI_SESI = 'turnify-sesi'

/** Server menjawab, tapi menolak (401, 403, 404, 422). `pesan` aman ditampilkan ke pengguna. */
export class GalatApi extends Error {
  status: number
  constructor(status: number, pesan: string) {
    super(pesan)
    this.status = status
  }
}

/** Server tidak bisa dihubungi sama sekali: belum dinyalakan, atau jaringan putus. */
export class ServerTakTerjangkau extends Error {}

export interface SesiServer {
  token: string
  usahaId: number
  namaPengguna: string
  namaUsaha: string | null
  kedaluwarsaPada: string
}

/* ------------------------------------------------------------------ */
/* Sesi                                                                */
/* ------------------------------------------------------------------ */

/** Disimpan di sessionStorage: hilang saat tab ditutup, tidak menumpuk di peramban bersama. */
export function sesiTersimpan(): SesiServer | null {
  try {
    const teks = window.sessionStorage.getItem(KUNCI_SESI)
    if (!teks) return null
    const sesi = JSON.parse(teks) as SesiServer
    return new Date(sesi.kedaluwarsaPada).getTime() > Date.now() ? sesi : null
  } catch {
    return null
  }
}

export function simpanSesi(sesi: SesiServer | null) {
  try {
    if (sesi) window.sessionStorage.setItem(KUNCI_SESI, JSON.stringify(sesi))
    else window.sessionStorage.removeItem(KUNCI_SESI)
  } catch {
    /* Penyimpanan diblokir (mode privat): sesi tetap hidup di memori sampai halaman dimuat ulang. */
  }
}

export async function minta<T>(jalur: string, opsi: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...sisa } = opsi
  let jawab: Response
  try {
    jawab = await fetch(ALAMAT + jalur, {
      ...sisa,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new ServerTakTerjangkau(`Server Turnify Flow di ${ALAMAT} tidak bisa dihubungi.`)
  }
  if (!jawab.ok) {
    let pesan = `Server menjawab ${jawab.status}.`
    try {
      const isi = await jawab.json()
      if (typeof isi?.detail === 'string') pesan = isi.detail
    } catch {
      /* Badan bukan JSON; pakai pesan bawaan. */
    }
    throw new GalatApi(jawab.status, pesan)
  }
  // 204 No Content (mis. hapus paket) tidak punya badan untuk dibaca.
  if (jawab.status === 204) return undefined as T
  return (await jawab.json()) as T
}

/* ------------------------------------------------------------------ */
/* Otentikasi                                                          */
/* ------------------------------------------------------------------ */

interface TokenApi {
  token: string
  peran: string
  pengguna_id: number
  nama: string
  usaha_id: number | null
  nama_usaha?: string | null
  kedaluwarsa_pada: string
}

export async function masukUmkm(email: string, kataSandi: string): Promise<SesiServer> {
  const t = await minta<TokenApi>('/auth/umkm/masuk', {
    method: 'POST',
    body: JSON.stringify({ email, kata_sandi: kataSandi }),
  })
  if (t.usaha_id == null) throw new GalatApi(403, 'Akun ini belum punya usaha.')
  return {
    token: t.token,
    usahaId: t.usaha_id,
    namaPengguna: t.nama,
    namaUsaha: t.nama_usaha ?? null,
    kedaluwarsaPada: t.kedaluwarsa_pada,
  }
}

/* ------------------------------------------------------------------ */
/* Gudang                                                              */
/* ------------------------------------------------------------------ */

interface BarangApi {
  id: number
  nama: string
  deskripsi: string | null
  nama_lain: string[]
  kategori: string
  kode_barang: string
  satuan: string
  satuan_tampil: string | null
  kemasan: Array<{ nama: string; isi: string }>
  stok: string
  batas_aman: string
  batas_aman_saran: string
  sumber_batas_aman: string
  hari_kirim: number
  harga_beli_terakhir: number
  harga_beli_per_satuan: string
  pemakaian_harian: string
  hari_data_terkumpul: number
  ingatkan_kedaluwarsa: boolean
  kedaluwarsa: string | null
  terhubung_kasir: boolean
  dicatat_manual: boolean
  catatan: string | null
}

export const angka = (x: string | number | null | undefined) => (x == null ? 0 : Number(x))

function keBarang(b: BarangApi): Barang {
  return {
    id: String(b.id),
    nama: b.nama,
    deskripsi: b.deskripsi,
    namaLain: b.nama_lain ?? [],
    kategori: b.kategori,
    kodeBarang: b.kode_barang,
    satuan: b.satuan,
    kemasan: (b.kemasan ?? []).map((k) => ({ nama: k.nama, isi: angka(k.isi) })),
    satuanTampil: b.satuan_tampil,
    stok: angka(b.stok),
    batasAman: angka(b.batas_aman),
    batasAmanSaran: angka(b.batas_aman_saran),
    sumberBatasAman: (['sistem', 'sendiri', 'bawaan'].includes(b.sumber_batas_aman)
      ? b.sumber_batas_aman
      : 'sistem') as SumberBatasAman,
    hariKirim: b.hari_kirim,
    // Layar mengalikan harga dengan jumlah dalam satuan simpan, jadi yang dipakai harga per satuan.
    hargaBeliTerakhir: angka(b.harga_beli_per_satuan),
    pemakaianHarian: angka(b.pemakaian_harian),
    hariDataTerkumpul: b.hari_data_terkumpul,
    ingatkanKedaluwarsa: b.ingatkan_kedaluwarsa,
    kedaluwarsa: b.kedaluwarsa,
    terhubungKasir: b.terhubung_kasir,
    dicatatManual: b.dicatat_manual,
    catatan: b.catatan,
  }
}

export async function ambilBarang(sesi: SesiServer): Promise<Barang[]> {
  const isi = await minta<BarangApi[]>(`/usaha/${sesi.usahaId}/barang`, { token: sesi.token })
  return isi.map(keBarang)
}

/* ------------------------------------------------------------------ */
/* Keluaran mesin analitik                                             */
/* ------------------------------------------------------------------ */

/** Satu hari perkiraan Mesin 1: quantile p10, p50, p90 dalam satuan dasar barang. */
export interface HariPerkiraan {
  tanggal: string
  p10: number
  p50: number
  p90: number
  model: string
  dijalankanPada: string
  kematangan: KematanganPerkiraan
  tingkatLayanan: TingkatLayanan
  /**
   * Uji balik: perkiraan untuk hari yang sudah tercatat, dibuat dari titik
   * 14 hari sebelum data terakhir. Digambar menumpang garis aktual supaya
   * terlihat seberapa dekat perkiraan dengan kenyataan. Bukan perkiraan ke depan.
   */
  ujiBalik: boolean
}

export interface HariRiwayat {
  tanggal: string
  jumlah: number
  stokHabis: boolean
}

/** Satu kandidat distributor dari Mesin 2. */
export interface SaranServer {
  distributorId: number
  penawaranId: number
  namaDistributor: string
  peluangSukses: number
  skor: number
  alasan: string | null
  segmen: string | null
  dijalankanPada: string
  kedaluwarsa: boolean
}

const KEMATANGAN: Record<string, KematanganPerkiraan> = {
  belum_bisa: 'belum-bisa',
  'belum-bisa': 'belum-bisa',
  kasar: 'kasar',
  mantap: 'mantap',
}
const LAYANAN: Record<string, TingkatLayanan> = {
  segar: 'segar',
  tersimpan: 'tersimpan',
  hitungan_sederhana: 'hitungan-sederhana',
  'hitungan-sederhana': 'hitungan-sederhana',
  tidak_tersedia: 'tidak-tersedia',
  'tidak-tersedia': 'tidak-tersedia',
}

export async function ambilPerkiraan(sesi: SesiServer, barangId: string): Promise<HariPerkiraan[]> {
  const isi = await minta<
    Array<{
      tanggal_target: string
      p10: string
      p50: string
      p90: string
      model_nama: string
      dijalankan_pada: string
      kematangan: string
      tingkat_layanan: string
      uji_balik?: boolean
    }>
  >(`/usaha/${sesi.usahaId}/barang/${barangId}/perkiraan`, { token: sesi.token })
  return isi.map((h) => ({
    tanggal: h.tanggal_target,
    p10: angka(h.p10),
    p50: angka(h.p50),
    p90: angka(h.p90),
    model: h.model_nama,
    dijalankanPada: h.dijalankan_pada,
    kematangan: KEMATANGAN[h.kematangan] ?? 'kasar',
    tingkatLayanan: LAYANAN[h.tingkat_layanan] ?? 'tersimpan',
    ujiBalik: h.uji_balik ?? false,
  }))
}

export async function ambilRiwayat(sesi: SesiServer, barangId: string, hari = 28): Promise<HariRiwayat[]> {
  const isi = await minta<Array<{ tanggal: string; jumlah: string; stok_habis: boolean }>>(
    `/usaha/${sesi.usahaId}/barang/${barangId}/riwayat?hari=${hari}`,
    { token: sesi.token },
  )
  return isi.map((h) => ({ tanggal: h.tanggal, jumlah: angka(h.jumlah), stokHabis: h.stok_habis }))
}

export async function ambilSaran(sesi: SesiServer, barangId: string): Promise<SaranServer[]> {
  const isi = await minta<
    Array<{
      distributor_id: number
      penawaran_id: number
      nama_distributor: string
      p_sukses: number
      skor: number
      alasan: string | null
      segmen: string | null
      dijalankan_pada: string
      kedaluwarsa: boolean
    }>
  >(`/usaha/${sesi.usahaId}/barang/${barangId}/saran`, { token: sesi.token })
  return isi.map((s) => ({
    distributorId: s.distributor_id,
    penawaranId: s.penawaran_id,
    namaDistributor: s.nama_distributor,
    peluangSukses: s.p_sukses,
    skor: s.skor,
    alasan: s.alasan,
    segmen: s.segmen,
    dijalankanPada: s.dijalankan_pada,
    kedaluwarsa: s.kedaluwarsa,
  }))
}

/** Pemakaian per 30 hari (12 periode) dan perkiraan 30 hari ke depan, untuk semua barang. */
export async function ambilPemakaianBulanan(sesi: SesiServer): Promise<Map<string, BulananBarang>> {
  const isi = await minta<
    Array<{
      barang_id: number
      periode: Array<{ tanggal: string; jumlah: string; uji_balik?: string | null }>
      perkiraan_p10: string | null
      perkiraan_p50: string | null
      perkiraan_p90: string | null
      model_nama: string | null
    }>
  >(`/usaha/${sesi.usahaId}/pemakaian-bulanan`, { token: sesi.token })
  const peta = new Map<string, BulananBarang>()
  for (const b of isi) {
    peta.set(String(b.barang_id), {
      periode: b.periode.map((p) => ({
        tanggal: p.tanggal,
        jumlah: angka(p.jumlah),
        ujiBalik: p.uji_balik == null ? null : angka(p.uji_balik),
      })),
      p10: b.perkiraan_p10 == null ? null : angka(b.perkiraan_p10),
      p50: b.perkiraan_p50 == null ? null : angka(b.perkiraan_p50),
      p90: b.perkiraan_p90 == null ? null : angka(b.perkiraan_p90),
      model: b.model_nama,
    })
  }
  return peta
}

/* ------------------------------------------------------------------ */
/* Portal distributor (Mesin 3)                                        */
/* ------------------------------------------------------------------ */

const KUNCI_SESI_DISTRIBUTOR = 'turnify-sesi-distributor'

export interface SesiDistributor {
  token: string
  distributorId: number
  namaPengguna: string
  kedaluwarsaPada: string
}

/** Sesi portal distributor terpisah dari sesi UMKM: tokennya pun berbeda jenis. */
export function sesiDistributorTersimpan(): SesiDistributor | null {
  try {
    const teks = window.sessionStorage.getItem(KUNCI_SESI_DISTRIBUTOR)
    if (!teks) return null
    const sesi = JSON.parse(teks) as SesiDistributor
    return new Date(sesi.kedaluwarsaPada).getTime() > Date.now() ? sesi : null
  } catch {
    return null
  }
}

export function simpanSesiDistributor(sesi: SesiDistributor | null) {
  try {
    if (sesi) window.sessionStorage.setItem(KUNCI_SESI_DISTRIBUTOR, JSON.stringify(sesi))
    else window.sessionStorage.removeItem(KUNCI_SESI_DISTRIBUTOR)
  } catch {
    /* Penyimpanan diblokir: sesi hanya hidup di memori. */
  }
}

export async function masukDistributor(email: string, kataSandi: string): Promise<SesiDistributor> {
  const t = await minta<TokenApi & { distributor_id: number | null }>('/auth/distributor/masuk', {
    method: 'POST',
    body: JSON.stringify({ email, kata_sandi: kataSandi }),
  })
  if (t.distributor_id == null) throw new GalatApi(403, 'Akun ini bukan distributor.')
  return { token: t.token, distributorId: t.distributor_id, namaPengguna: t.nama, kedaluwarsaPada: t.kedaluwarsa_pada }
}

export interface RingkasanSegmen {
  segmen: string
  namaSegmen: string
  ciri: string | null
  saran: string | null
  jumlah: number
  rataRecency: number
  rataFrequency: number
  rataMonetary: number
  dijalankanPada: string
  tanggalAcuan: string
}

export interface AnggotaSegmen {
  usahaId: number
  namaUsaha: string
  kota: string
  recency: number
  frequency: number
  monetary: number
  lamaBerlangganan: number
  jenisUsaha: string
  kategoriUtama: string
  jarakKePusat: number
}

export async function ambilSegmen(sesi: SesiDistributor): Promise<RingkasanSegmen[]> {
  const isi = await minta<
    Array<{
      segmen: string
      nama_segmen: string
      ciri: string | null
      saran: string | null
      jumlah: number
      rata_recency: number
      rata_frequency: number
      rata_monetary: number
      dijalankan_pada: string
      tanggal_acuan: string
    }>
  >(`/distributor/${sesi.distributorId}/segmen`, { token: sesi.token })
  return isi.map((s) => ({
    segmen: s.segmen,
    namaSegmen: s.nama_segmen,
    ciri: s.ciri,
    saran: s.saran,
    jumlah: s.jumlah,
    rataRecency: s.rata_recency,
    rataFrequency: s.rata_frequency,
    rataMonetary: s.rata_monetary,
    dijalankanPada: s.dijalankan_pada,
    tanggalAcuan: s.tanggal_acuan,
  }))
}

export async function ambilAnggotaSegmen(sesi: SesiDistributor, segmen: string): Promise<AnggotaSegmen[]> {
  const isi = await minta<
    Array<{
      usaha_id: number
      nama_usaha: string
      kota: string
      recency: number
      frequency: number
      monetary: number
      lama_berlangganan: number
      jenis_usaha: string
      kategori_utama: string
      jarak_ke_pusat: number
    }>
  >(`/distributor/${sesi.distributorId}/segmen/${encodeURIComponent(segmen)}`, { token: sesi.token })
  return isi.map((a) => ({
    usahaId: a.usaha_id,
    namaUsaha: a.nama_usaha,
    kota: a.kota,
    recency: a.recency,
    frequency: a.frequency,
    monetary: a.monetary,
    lamaBerlangganan: a.lama_berlangganan,
    jenisUsaha: a.jenis_usaha,
    kategoriUtama: a.kategori_utama,
    jarakKePusat: a.jarak_ke_pusat,
  }))
}
