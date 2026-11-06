import type {
  Barang,
  CaraHitungStok,
  JenisPergerakan,
  JenisUsaha,
  KematanganPerkiraan,
  Pergerakan,
  ProfilUsaha,
  StatusVerifikasi,
  SumberBatasAman,
  TingkatLayanan,
  TingkatVerifikasi,
} from '@/lib/types'
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

/* Balasan bawaan FastAPI untuk rute yang tidak dikenalnya. Dari layar ini
   artinya API yang menyala lebih tua daripada frontend-nya (revisi V2: Ringkasan
   Penjualan menulis "Not Found"), jadi diganti kalimat yang menyebut jalan
   keluarnya. Pesan buatan backend sendiri tetap ditampilkan apa adanya. */
const RUTE_TIDAK_DIKENAL = new Set(['Not Found', 'Method Not Allowed'])
const PESAN_RUTE_TIDAK_DIKENAL =
  'Bagian ini belum ada di aplikasi yang sedang menyala. Matikan lalu nyalakan ulang aplikasinya (matikan.cmd, lalu nyalakan.cmd).'

/* Galat validasi (422) dari pydantic berupa daftar berbahasa Inggris. Yang tampil
   cukup nama kolomnya dalam bahasa layar, supaya pemilik usaha tahu isian mana
   yang harus diperbaiki (audit 3 Nov 2026). */
function pesanValidasi(daftar: Array<{ loc?: unknown }>): string {
  const kolom = [
    ...new Set(
      daftar
        .map((d) => (Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null))
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.replace(/_/g, ' ')),
    ),
  ]
  if (kolom.length === 0) return 'Ada isian yang belum sesuai. Periksa lagi isiannya, lalu coba simpan ulang.'
  return `Isian ${kolom.map((k) => `"${k}"`).join(', ')} belum sesuai. Periksa lagi isinya, lalu coba simpan ulang.`
}

export interface SesiServer {
  token: string
  usahaId: number
  namaPengguna: string
  namaUsaha: string | null
  kedaluwarsaPada: string
  /** Email yang dipakai masuk. Kosong untuk sesi yang tersimpan sebelum kolom ini ada. */
  email?: string
  /** Akun kasir (Portal POS) hanya diterima endpoint POS. Kosong berarti pemilik. */
  peran?: 'umkm' | 'kasir'
  /** Akun simulasi saat pameran: boleh melihat dan menekan apa saja, tetapi tidak ada yang tersimpan. */
  bacaSaja?: boolean
}

/* Tidak semua pemanggil menampilkan galatnya, padahal tombol yang diam terlihat seperti rusak.
   Penolakan baca saja disampaikan dari satu tempat. Store mengisinya, karena store mengimpor berkas ini. */
let saatDitolakBacaSaja: ((pesan: string) => void) | null = null
export function aturSaatDitolakBacaSaja(fn: (pesan: string) => void) {
  saatDitolakBacaSaja = fn
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
    throw new ServerTakTerjangkau('Turnify Flow belum bisa dihubungi. Coba lagi sebentar lagi.')
  }
  if (!jawab.ok) {
    let pesan = 'Permintaan belum berhasil. Coba lagi sebentar lagi.'
    try {
      const isi = await jawab.json()
      if (typeof isi?.detail === 'string') pesan = isi.detail
      if (isi?.baca_saja) saatDitolakBacaSaja?.(pesan)
      else if (Array.isArray(isi?.detail) && isi.detail.length > 0) pesan = pesanValidasi(isi.detail)
    } catch {
      /* Badan bukan JSON; pakai pesan bawaan. */
    }
    if (RUTE_TIDAK_DIKENAL.has(pesan)) pesan = PESAN_RUTE_TIDAK_DIKENAL
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
  baca_saja?: boolean | null
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
    email,
    bacaSaja: t.baca_saja === true,
  }
}

/** Buat akun pemilik usaha beserta usahanya. Sesudah ini tinggal masuk seperti biasa. */
export async function daftarUmkm(isi: {
  email: string
  kataSandi: string
  nama: string
  nomorHp: string
  namaUsaha: string
  jenisUsaha: string
  kota: string
  alamat: string
  caraHitung: string
}): Promise<void> {
  await minta<TokenApi>('/auth/umkm/daftar', {
    method: 'POST',
    body: JSON.stringify({
      email: isi.email,
      kata_sandi: isi.kataSandi,
      nama: isi.nama,
      nomor_hp: isi.nomorHp,
      nama_usaha: isi.namaUsaha,
      jenis_usaha: isi.jenisUsaha,
      kota: isi.kota,
      alamat: isi.alamat,
      cara_hitung: isi.caraHitung,
    }),
  })
}

/** Pintu Portal POS: pemilik mendapat sesi penuh, kasir mendapat sesi yang hanya diterima endpoint POS. */
export async function masukPos(email: string, kataSandi: string): Promise<SesiServer> {
  const t = await minta<TokenApi>('/auth/pos/masuk', {
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
    email,
    peran: t.peran === 'kasir' ? 'kasir' : 'umkm',
    bacaSaja: t.baca_saja === true,
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
  dalam_perjalanan?: string
  sumber_batas_aman: string
  hari_kirim: number
  harga_beli_terakhir: number
  harga_beli_per_satuan: string
  pemakaian_harian: string
  hari_data_terkumpul: number
  ingatkan_kedaluwarsa: boolean
  kedaluwarsa: string | null
  hari_tanpa_pemakaian?: number | null
  terakhir_berubah?: string | null
  penawaran_saran_id?: number | null
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
    dalamPerjalanan: b.dalam_perjalanan == null ? 0 : angka(b.dalam_perjalanan),
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
    // null = belum pernah terpakai. Dibedakan dari undefined (data contoh).
    hariTanpaPemakaian: b.hari_tanpa_pemakaian ?? null,
    terakhirBerubah: b.terakhir_berubah ?? null,
    penawaranSaranId: b.penawaran_saran_id != null ? String(b.penawaran_saran_id) : null,
    terhubungKasir: b.terhubung_kasir,
    dicatatManual: b.dicatat_manual,
    catatan: b.catatan,
  }
}

export async function ambilBarang(sesi: SesiServer): Promise<Barang[]> {
  const isi = await minta<BarangApi[]>(`/usaha/${sesi.usahaId}/barang`, { token: sesi.token })
  return isi.map(keBarang)
}

/* Tulis stok (audit 3 Nov 2026). Dulu layar Stok hanya mengubah data di peramban. */

/** Angka desimal untuk kolom Numeric(14,3): paling banyak tiga angka di belakang koma. */
const desimal = (x: number) => String(Math.round(x * 1000) / 1000)

function keBadanBarang(p: Partial<Barang>): Record<string, unknown> {
  const badan: Record<string, unknown> = {}
  if (p.nama !== undefined) badan.nama = p.nama
  if (p.deskripsi !== undefined) badan.deskripsi = p.deskripsi
  if (p.namaLain !== undefined) badan.nama_lain = p.namaLain
  if (p.kategori !== undefined) badan.kategori = p.kategori
  if (p.kodeBarang) badan.kode_barang = p.kodeBarang
  if (p.satuan !== undefined) badan.satuan = p.satuan
  if (p.satuanTampil !== undefined) badan.satuan_tampil = p.satuanTampil
  if (p.kemasan !== undefined) badan.kemasan = p.kemasan.map((k) => ({ nama: k.nama, isi: desimal(k.isi) }))
  if (p.batasAman !== undefined) badan.batas_aman = desimal(p.batasAman)
  if (p.sumberBatasAman !== undefined) badan.sumber_batas_aman = p.sumberBatasAman
  if (p.hariKirim !== undefined) badan.hari_kirim = p.hariKirim
  if (p.ingatkanKedaluwarsa !== undefined) badan.ingatkan_kedaluwarsa = p.ingatkanKedaluwarsa
  if (p.kedaluwarsa !== undefined) badan.kedaluwarsa = p.kedaluwarsa
  if (p.dicatatManual !== undefined) badan.dicatat_manual = p.dicatatManual
  if (p.catatan !== undefined) badan.catatan = p.catatan
  return badan
}

export async function tambahBarangServer(sesi: SesiServer, b: Barang): Promise<Barang> {
  const isi = await minta<BarangApi>(`/usaha/${sesi.usahaId}/barang`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ ...keBadanBarang(b), stok_awal: desimal(b.stok) }),
  })
  return keBarang(isi)
}

export async function ubahBarangServer(sesi: SesiServer, barangId: string, p: Partial<Barang>): Promise<Barang> {
  const isi = await minta<BarangApi>(`/usaha/${sesi.usahaId}/barang/${barangId}`, {
    method: 'PATCH',
    token: sesi.token,
    body: JSON.stringify(keBadanBarang(p)),
  })
  return keBarang(isi)
}

export async function koreksiStokServer(sesi: SesiServer, barangId: string, stok: number): Promise<Barang> {
  const isi = await minta<BarangApi>(`/usaha/${sesi.usahaId}/barang/${barangId}/koreksi`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ stok: desimal(stok) }),
  })
  return keBarang(isi)
}

export async function catatPemakaianServer(
  sesi: SesiServer,
  pemakaian: Record<string, number>,
): Promise<{ tercatat: number; stokKurang: string[] }> {
  const baris = Object.entries(pemakaian)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ barang_id: Number(id), jumlah: desimal(n) }))
  const isi = await minta<{ tercatat: number; stok_kurang: string[] }>(`/usaha/${sesi.usahaId}/pemakaian`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ baris }),
  })
  return { tercatat: isi.tercatat, stokKurang: isi.stok_kurang }
}

export async function batasAmanIkutSaranServer(sesi: SesiServer, barangIds: string[]): Promise<number> {
  const isi = await minta<{ diubah: number }>(`/usaha/${sesi.usahaId}/batas-aman/ikut-saran`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ barang_id: barangIds.map(Number) }),
  })
  return isi.diubah
}

export async function gantiKategoriServer(sesi: SesiServer, dari: string[], ke: string): Promise<number> {
  const isi = await minta<{ diubah: number }>(`/usaha/${sesi.usahaId}/kategori/ganti`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ dari, ke }),
  })
  return isi.diubah
}

/* ------------------------------------------------------------------ */
/* Profil usaha                                                        */
/* ------------------------------------------------------------------ */

interface ProfilUsahaApi {
  id: number
  nama: string
  jenis_usaha: JenisUsaha
  nama_pemilik: string
  nib: string | null
  npwp: string | null
  alamat: string
  kota: string
  nomor_hp: string
  email: string | null
  bio: string | null
  warna: string
  cara_hitung: CaraHitungStok
  verifikasi: StatusVerifikasi
  tingkat_verifikasi: TingkatVerifikasi
  bergabung_sejak: string
  tampilkan_alamat: boolean
  tampilkan_nomor_hp: boolean
}

/** Profil dari server. Alasan perbaikan belum disimpan server, jadi tidak ikut di sini. */
function keProfil(p: ProfilUsahaApi): Omit<ProfilUsaha, 'alasanPerbaikan'> {
  return {
    id: String(p.id),
    namaUsaha: p.nama,
    jenisUsaha: p.jenis_usaha,
    namaPemilik: p.nama_pemilik,
    nib: p.nib ?? '',
    npwp: p.npwp ?? '',
    alamat: p.alamat,
    kota: p.kota,
    nomorHp: p.nomor_hp,
    email: p.email ?? '',
    bio: p.bio ?? '',
    warna: p.warna,
    caraHitung: p.cara_hitung,
    verifikasi: p.verifikasi,
    tingkatVerifikasi: p.tingkat_verifikasi,
    bergabungSejak: p.bergabung_sejak,
    tampilkanAlamatKeDistributor: p.tampilkan_alamat,
    tampilkanNomorHpKeDistributor: p.tampilkan_nomor_hp,
  }
}

export async function ambilProfilServer(sesi: SesiServer): Promise<Omit<ProfilUsaha, 'alasanPerbaikan'>> {
  return keProfil(await minta<ProfilUsahaApi>(`/usaha/${sesi.usahaId}/profil`, { token: sesi.token }))
}

/**
 * Simpan sebagian profil. Hanya kolom yang ada di `p` yang dikirim. Status verifikasi
 * tidak bisa diisi: "menunggu" dikirim sebagai pengajuan pemeriksaan ulang.
 */
export async function ubahProfilServer(
  sesi: SesiServer,
  p: Partial<ProfilUsaha>,
): Promise<Omit<ProfilUsaha, 'alasanPerbaikan'>> {
  const badan: Record<string, unknown> = {}
  const pasang: Array<[keyof ProfilUsaha, string]> = [
    ['namaUsaha', 'nama'],
    ['jenisUsaha', 'jenis_usaha'],
    ['namaPemilik', 'nama_pemilik'],
    ['nib', 'nib'],
    ['npwp', 'npwp'],
    ['alamat', 'alamat'],
    ['kota', 'kota'],
    ['nomorHp', 'nomor_hp'],
    ['email', 'email'],
    ['bio', 'bio'],
    ['warna', 'warna'],
    ['caraHitung', 'cara_hitung'],
    ['tampilkanAlamatKeDistributor', 'tampilkan_alamat'],
    ['tampilkanNomorHpKeDistributor', 'tampilkan_nomor_hp'],
  ]
  for (const [kunci, kolom] of pasang) if (p[kunci] !== undefined) badan[kolom] = p[kunci]
  if (p.verifikasi === 'menunggu') badan.ajukan_verifikasi = true
  const isi = await minta<ProfilUsahaApi>(`/usaha/${sesi.usahaId}/profil`, {
    method: 'PATCH',
    token: sesi.token,
    body: JSON.stringify(badan),
  })
  return keProfil(isi)
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

/** Satu halaman buku besar satu barang, terbaru di atas. `total` menghitung semua barisnya. */
export async function ambilPergerakan(
  sesi: SesiServer,
  barangId: string,
  mulai: number,
  batas: number,
): Promise<{ total: number; baris: Pergerakan[] }> {
  const isi = await minta<{
    total: number
    baris: Array<{
      id: number
      waktu: string
      jenis: JenisPergerakan
      jumlah: string
      stok_sesudah: string
      keterangan: string | null
      pesanan_id: number | null
      nomor_pesanan: string | null
      transaksi_id: number | null
      oleh: string | null
    }>
  }>(`/usaha/${sesi.usahaId}/barang/${barangId}/pergerakan?batas=${batas}&mulai=${mulai}`, { token: sesi.token })
  return {
    total: isi.total,
    baris: isi.baris.map((g) => ({
      id: String(g.id),
      barangId,
      waktu: g.waktu,
      jenis: g.jenis,
      jumlah: angka(g.jumlah),
      stokSesudah: angka(g.stok_sesudah),
      keterangan: g.keterangan ?? '',
      pesananId: g.pesanan_id != null ? String(g.pesanan_id) : null,
      nomorPesanan: g.nomor_pesanan,
      transaksiId: g.transaksi_id != null ? String(g.transaksi_id) : null,
      oleh: g.oleh ?? '',
    })),
  }
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
      perkiraan_persediaan?: string | null
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
      p50Persediaan: b.perkiraan_persediaan == null ? null : angka(b.perkiraan_persediaan),
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
  bacaSaja?: boolean
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
  return { token: t.token, distributorId: t.distributor_id, namaPengguna: t.nama, kedaluwarsaPada: t.kedaluwarsa_pada, bacaSaja: t.baca_saja === true }
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
