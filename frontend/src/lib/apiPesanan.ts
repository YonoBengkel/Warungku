import type {
  AlasanSelisih,
  BuktiPengiriman,
  JenisUsaha,
  Pesanan,
  PesananMasuk,
  StatusBayar,
  StatusPesanan,
  StatusPesananMasuk,
  UmkmPemesan,
} from '@/lib/types'
import { angka, minta } from '@/lib/api'
import type { SesiDistributor, SesiServer } from '@/lib/api'

/**
 * Pesanan dari API, diterjemahkan ke `Pesanan` (sisi pemilik usaha) dan
 * `PesananMasuk` (sisi distributor). Keduanya dibaca dari baris server yang
 * sama, jadi status di dua portal tidak bisa saling selisih.
 */

/** Delapan distributor server sama dengan delapan distributor data contoh: id 1 = 'd-01'. */
export const keIdDistributor = (n: number) => `d-${String(n).padStart(2, '0')}`
/** UMKM server diberi awalan supaya tidak tertukar dengan UMKM data contoh ('u-01'). */
export const keIdUmkm = (n: number) => `srv-u-${n}`

interface PesananApi {
  id: number
  nomor: string
  usaha_id: number
  nama_usaha: string
  usaha_jenis: string
  usaha_kota: string
  usaha_alamat: string
  usaha_nomor_hp: string
  usaha_lat: number | null
  usaha_lng: number | null
  distributor_id: number
  kontrak_id: number | null
  dibuat_pada: string
  status: string
  status_bayar: string
  ongkos_kirim: number
  perkiraan_tiba: string | null
  jumlah_bukti: number
  dari_saran: boolean
  dari_rutin: boolean
  catatan_untuk_distributor: string | null
  sudah_diulas: boolean
  kode_belanja: string | null
  alasan_tolak: string | null
  kirim_kurir: string | null
  kirim_pengantar: string | null
  kirim_nomor_resi: string | null
  kirim_diterima_oleh: string | null
  kirim_waktu_sampai: string | null
  kirim_catatan: string | null
  baris: Array<{
    id: number
    penawaran_id: number
    barang_id: number | null
    nama: string
    jumlah: string
    satuan: string
    harga_satuan: number
    harga_normal: number | null
    promo_id: number | null
    isi_per_satuan: string
    jumlah_diterima: string | null
    alasan_selisih: string | null
    catatan_penerimaan: string | null
  }>
  jejak: Array<{ waktu: string; status: string; keterangan: string | null }>
}

function buktiDari(p: PesananApi): BuktiPengiriman | null {
  if (!p.kirim_waktu_sampai) return null
  return {
    // Portal distributor belum menanyakan isian ini; kosong ditulis apa adanya, bukan dikarang.
    kurir: p.kirim_kurir || 'Belum dicatat',
    namaPengantar: p.kirim_pengantar || 'Belum dicatat',
    nomorResi: p.kirim_nomor_resi || 'Belum dicatat',
    diterimaOleh: p.kirim_diterima_oleh || 'Belum dicatat',
    waktuSampai: p.kirim_waktu_sampai,
    catatan: p.kirim_catatan ?? '',
    foto: [],
  }
}

/** Pesanan dari sisi pemilik usaha. `barisId` dibawa untuk mengirim penerimaan. */
export function kePesanan(p: PesananApi): Pesanan {
  return {
    id: String(p.id),
    nomor: p.nomor,
    distributorId: keIdDistributor(p.distributor_id),
    kontrakId: p.kontrak_id == null ? null : String(p.kontrak_id),
    dibuatPada: p.dibuat_pada,
    status: p.status as StatusPesanan,
    baris: p.baris.map((b) => ({
      barisId: String(b.id),
      penawaranId: String(b.penawaran_id),
      barangId: b.barang_id == null ? null : String(b.barang_id),
      nama: b.nama,
      jumlah: angka(b.jumlah),
      satuan: b.satuan,
      hargaSatuan: b.harga_satuan,
      hargaNormal: b.harga_normal ?? undefined,
      promoId: b.promo_id == null ? null : String(b.promo_id),
      isiPerSatuan: angka(b.isi_per_satuan),
      jumlahDiterima: b.jumlah_diterima == null ? null : angka(b.jumlah_diterima),
      alasanSelisih: (b.alasan_selisih as AlasanSelisih | null) ?? null,
      catatanPenerimaan: b.catatan_penerimaan,
    })),
    ongkosKirim: p.ongkos_kirim,
    perkiraanTiba: p.perkiraan_tiba,
    jejak: p.jejak.map((j) => ({ waktu: j.waktu, status: j.status as StatusPesanan, keterangan: j.keterangan ?? '' })),
    statusBayar: p.status_bayar as StatusBayar,
    jumlahBukti: p.jumlah_bukti,
    dariSaran: p.dari_saran,
    dariRutin: p.dari_rutin,
    catatanUntukDistributor: p.catatan_untuk_distributor ?? '',
    sudahDiulas: p.sudah_diulas,
    kodeBelanja: p.kode_belanja,
    alasanTolak: p.alasan_tolak,
    pengiriman: buktiDari(p),
    ulasan: null,
  }
}

/**
 * Status di sisi distributor. "Sudah sampai" menurut distributor berarti
 * selesai baginya, walaupun pemilik usaha belum menghitung barangnya.
 */
function statusMasuk(p: PesananApi): StatusPesananMasuk {
  if (p.status === 'batal') return 'ditolak'
  if (p.status === 'selesai' || p.status === 'selesai-catatan') return 'selesai'
  if (p.status === 'dikirim' && p.kirim_waktu_sampai) return 'selesai'
  return p.status as StatusPesananMasuk
}

function statusJejakMasuk(s: string): StatusPesananMasuk {
  if (s === 'batal') return 'ditolak'
  if (s === 'selesai-catatan') return 'selesai'
  return s as StatusPesananMasuk
}

export function kePesananMasuk(p: PesananApi): PesananMasuk {
  return {
    id: String(p.id),
    nomor: p.nomor,
    umkmId: keIdUmkm(p.usaha_id),
    distributorId: keIdDistributor(p.distributor_id),
    dibuatPada: p.dibuat_pada,
    status: statusMasuk(p),
    baris: p.baris.map((b) => ({
      penawaranId: String(b.penawaran_id),
      nama: b.nama,
      jumlah: angka(b.jumlah),
      satuan: b.satuan,
      hargaSatuan: b.harga_satuan,
      hargaNormal: b.harga_normal ?? undefined,
      promoId: b.promo_id == null ? null : String(b.promo_id),
    })),
    ongkosKirim: p.ongkos_kirim,
    perkiraanTiba: p.perkiraan_tiba,
    jejak: p.jejak.map((j) => ({ waktu: j.waktu, status: statusJejakMasuk(j.status), keterangan: j.keterangan ?? '' })),
    alasanTolak: p.status === 'batal' ? (p.alasan_tolak ?? 'Dibatalkan pemilik usaha.') : null,
    catatanDariUmkm: p.catatan_untuk_distributor ?? '',
    pengiriman: buktiDari(p),
    ulasan: null,
  }
}

/** Kartu pemesan untuk portal distributor, dari data pesanan itu sendiri. */
function keUmkm(p: PesananApi): UmkmPemesan {
  return {
    id: keIdUmkm(p.usaha_id),
    nama: p.nama_usaha,
    jenisUsaha: (p.usaha_jenis || 'kedai-kopi') as JenisUsaha,
    kota: p.usaha_kota,
    alamat: p.usaha_alamat,
    lat: p.usaha_lat ?? -7.78,
    lng: p.usaha_lng ?? 110.37,
    warna: '#5b3fc4',
    nomorHp: p.usaha_nomor_hp,
    sejak: '',
  }
}

/* ------------------------------------------------------------------ */
/* Sisi pemilik usaha                                                  */
/* ------------------------------------------------------------------ */

export async function ambilPesanan(sesi: SesiServer): Promise<Pesanan[]> {
  const isi = await minta<PesananApi[]>(`/usaha/${sesi.usahaId}/pesanan?batas=100`, { token: sesi.token })
  return isi.map(kePesanan)
}

export async function buatPesanan(
  sesi: SesiServer,
  baris: Array<{ penawaranId: number; jumlah: number }>,
  dariSaran: boolean,
): Promise<Pesanan[]> {
  const isi = await minta<PesananApi[]>(`/usaha/${sesi.usahaId}/pesanan`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({
      baris: baris.map((b) => ({ penawaran_id: b.penawaranId, jumlah: b.jumlah })),
      dari_saran: dariSaran,
    }),
  })
  return isi.map(kePesanan)
}

export async function terimaBarangServer(
  sesi: SesiServer,
  pesananId: string,
  baris: Array<{ barisId: string; jumlah: number; alasan: AlasanSelisih | null; catatan: string }>,
): Promise<Pesanan> {
  const p = await minta<PesananApi>(`/usaha/${sesi.usahaId}/pesanan/${pesananId}/terima`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({
      baris: baris.map((b) => ({
        baris_id: Number(b.barisId),
        jumlah_diterima: b.jumlah,
        alasan_selisih: b.alasan,
        catatan: b.catatan || null,
      })),
    }),
  })
  return kePesanan(p)
}

export async function batalkanPesananServer(sesi: SesiServer, pesananId: string, alasan: string): Promise<Pesanan> {
  const p = await minta<PesananApi>(`/usaha/${sesi.usahaId}/pesanan/${pesananId}/batal`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ alasan }),
  })
  return kePesanan(p)
}

/* ------------------------------------------------------------------ */
/* Sisi distributor                                                    */
/* ------------------------------------------------------------------ */

export async function ambilPesananMasuk(
  sesi: SesiDistributor,
): Promise<{ pesanan: PesananMasuk[]; umkm: UmkmPemesan[] }> {
  const isi = await minta<PesananApi[]>(`/distributor/${sesi.distributorId}/pesanan-masuk?batas=100`, {
    token: sesi.token,
  })
  const umkm = new Map<string, UmkmPemesan>()
  for (const p of isi) umkm.set(keIdUmkm(p.usaha_id), keUmkm(p))
  return { pesanan: isi.map(kePesananMasuk), umkm: [...umkm.values()] }
}

export type AksiDistributor = 'konfirmasi' | 'tolak' | 'kirim' | 'sampai'

export async function aksiPesananMasuk(
  sesi: SesiDistributor,
  pesananId: string,
  aksi: AksiDistributor,
  badan: Record<string, unknown> = {},
): Promise<void> {
  await minta<unknown>(`/distributor/${sesi.distributorId}/pesanan/${pesananId}/${aksi}`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify(badan),
  })
}
