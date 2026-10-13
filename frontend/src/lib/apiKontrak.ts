import type { Kontrak, KontrakPelanggan, PaketKontrak, PemenuhanBulanan, Penawaran, StatusKontrak, UmkmPemesan, JenisUsaha } from '@/lib/types'
import { angka, minta } from '@/lib/api'
import type { SesiDistributor, SesiServer } from '@/lib/api'
import { keIdDistributor, keIdUmkm } from '@/lib/apiPesanan'
import { kePromo } from '@/lib/apiPromo'
import type { PromoApi } from '@/lib/apiPromo'
import type { Promo } from '@/lib/types'

/**
 * Kontrak dan paket kontrak dari API. Bentuk yang sama dibaca kedua portal:
 * pemilik usaha lewat `Kontrak`, distributor lewat `KontrakPelanggan`.
 */

export interface PaketApi {
  id: number
  penawaran_id: number
  distributor_id: number
  kode: string
  durasi_bulan: number
  kuota_min_per_bulan: string
  harga_satuan: number
  hemat_persen: number
  ketentuan_kuota_kurang: string | null
  ketentuan_berhenti: string | null
}

export function kePaket(p: PaketApi): PaketKontrak {
  return {
    id: String(p.id),
    kode: p.kode,
    penawaranId: String(p.penawaran_id),
    distributorId: keIdDistributor(p.distributor_id),
    durasiBulan: p.durasi_bulan,
    kuotaMinPerBulan: angka(p.kuota_min_per_bulan),
    hargaSatuan: p.harga_satuan,
    hematPersen: p.hemat_persen,
    ketentuanKuotaKurang: p.ketentuan_kuota_kurang,
    ketentuanBerhenti: p.ketentuan_berhenti,
  }
}

interface KontrakApi {
  id: number
  usaha_id: number
  nama_usaha: string
  usaha_jenis: string
  usaha_kota: string
  usaha_alamat: string
  usaha_nomor_hp: string
  distributor_id: number
  penawaran_id: number
  paket_id: number | null
  barang_id: number | null
  nama_barang: string
  durasi_bulan: number
  kuota_min_per_bulan: string
  harga_satuan: number
  satuan: string
  mulai: string
  berakhir: string
  status: string
  dalam_perjalanan: string
  ketentuan_kuota_kurang: string | null
  pesanan_rutin_aktif: boolean
  pesanan_rutin_berikutnya: string | null
  alasan_ditolak: string | null
  pengajuan_berhenti_waktu: string | null
  pengajuan_berhenti_alasan: string | null
  jawaban_berhenti_waktu: string | null
  jawaban_berhenti_disetujui: boolean | null
  jawaban_berhenti_alasan: string | null
  periode: Array<{ periode: string; kuota: string; diterima: string; selesai: boolean }>
}

const kodeBulanIni = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function keKontrak(k: KontrakApi): Kontrak {
  const periode: PemenuhanBulanan[] = k.periode.map((p) => ({
    periode: p.periode,
    kuota: angka(p.kuota),
    diterima: angka(p.diterima),
    selesai: p.selesai,
  }))
  const kini = kodeBulanIni()
  const berjalan = periode.find((p) => p.periode === kini) ??
    periode[periode.length - 1] ?? { periode: kini, kuota: angka(k.kuota_min_per_bulan), diterima: 0, selesai: false }
  return {
    id: String(k.id),
    paketId: k.paket_id == null ? '' : String(k.paket_id),
    distributorId: keIdDistributor(k.distributor_id),
    penawaranId: String(k.penawaran_id),
    barangId: k.barang_id == null ? '' : String(k.barang_id),
    namaBarang: k.nama_barang,
    durasiBulan: k.durasi_bulan,
    kuotaMinPerBulan: angka(k.kuota_min_per_bulan),
    hargaSatuan: k.harga_satuan,
    satuan: k.satuan,
    mulai: k.mulai,
    berakhir: k.berakhir,
    status: k.status as StatusKontrak,
    riwayat: periode.filter((p) => p.periode < berjalan.periode),
    periodeBerjalan: berjalan,
    dalamPerjalanan: angka(k.dalam_perjalanan),
    ketentuanKuotaKurang: k.ketentuan_kuota_kurang,
    pesananRutinAktif: k.pesanan_rutin_aktif,
    pesananRutinBerikutnya: k.pesanan_rutin_berikutnya,
    alasanDitolak: k.alasan_ditolak,
    pengajuanBerhenti: k.pengajuan_berhenti_waktu
      ? { waktu: k.pengajuan_berhenti_waktu, alasan: k.pengajuan_berhenti_alasan ?? '' }
      : null,
    jawabanBerhenti: k.jawaban_berhenti_waktu
      ? { waktu: k.jawaban_berhenti_waktu, disetujui: !!k.jawaban_berhenti_disetujui, alasan: k.jawaban_berhenti_alasan }
      : null,
  }
}

function keUmkm(k: KontrakApi): UmkmPemesan {
  return {
    id: keIdUmkm(k.usaha_id),
    nama: k.nama_usaha,
    jenisUsaha: (k.usaha_jenis || 'kedai-kopi') as JenisUsaha,
    kota: k.usaha_kota,
    alamat: k.usaha_alamat,
    lat: -7.78,
    lng: 110.37,
    warna: '#5b3fc4',
    nomorHp: k.usaha_nomor_hp,
    sejak: '',
  }
}

/* ------------------------------------------------------------------ */
/* Sisi pemilik usaha                                                  */
/* ------------------------------------------------------------------ */

export async function ambilKontrak(sesi: SesiServer): Promise<Kontrak[]> {
  return (await minta<KontrakApi[]>(`/usaha/${sesi.usahaId}/kontrak`, { token: sesi.token })).map(keKontrak)
}

export async function ajukanKontrakServer(sesi: SesiServer, paketId: string): Promise<Kontrak> {
  const k = await minta<KontrakApi>(`/usaha/${sesi.usahaId}/kontrak`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ paket_id: Number(paketId) }),
  })
  return keKontrak(k)
}

export async function berhentiKontrakServer(sesi: SesiServer, kontrakId: string, alasan: string): Promise<Kontrak> {
  const k = await minta<KontrakApi>(`/usaha/${sesi.usahaId}/kontrak/${kontrakId}/berhenti`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ alasan }),
  })
  return keKontrak(k)
}

export async function rutinKontrakServer(sesi: SesiServer, kontrakId: string, aktif: boolean): Promise<Kontrak> {
  const k = await minta<KontrakApi>(`/usaha/${sesi.usahaId}/kontrak/${kontrakId}/rutin`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ aktif }),
  })
  return keKontrak(k)
}

/* ------------------------------------------------------------------ */
/* Sisi distributor                                                    */
/* ------------------------------------------------------------------ */

export async function ambilKontrakMasuk(
  sesi: SesiDistributor,
): Promise<{ kontrak: KontrakPelanggan[]; umkm: UmkmPemesan[] }> {
  const isi = await minta<KontrakApi[]>(`/distributor/${sesi.distributorId}/kontrak`, { token: sesi.token })
  return {
    kontrak: isi.map((k) => ({ ...keKontrak(k), umkmId: keIdUmkm(k.usaha_id) })),
    umkm: isi.map(keUmkm),
  }
}

export type AksiKontrak = 'setujui' | 'tolak' | 'jawab-berhenti'

export async function aksiKontrakServer(
  sesi: SesiDistributor,
  kontrakId: string,
  aksi: AksiKontrak,
  badan: Record<string, unknown> = {},
): Promise<void> {
  await minta<unknown>(`/distributor/${sesi.distributorId}/kontrak/${kontrakId}/${aksi}`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify(badan),
  })
}

/** Penawaran dan paket milik distributor sendiri, untuk portalnya. */
export async function ambilKatalogDistributor(
  sesi: SesiDistributor,
): Promise<{ penawaran: Penawaran[]; paket: PaketKontrak[]; promo: Promo[] }> {
  const k = await minta<{
    penawaran: Array<{
      id: number
      distributor_id: number
      nama: string
      kategori: string
      satuan: string
      harga_satuan: number
      kemasan_nama: string
      kemasan_isi: string
      satuan_isi: string
      stok_tersedia: string
      stok_diperbarui_pada: string
      keterangan: string | null
      aktif: boolean
    }>
    paket: PaketApi[]
    promo: PromoApi[]
  }>(`/distributor/${sesi.distributorId}/katalog`, { token: sesi.token })
  return {
    penawaran: k.penawaran.map((p) => ({
      id: String(p.id),
      distributorId: keIdDistributor(p.distributor_id),
      nama: p.nama,
      kategori: p.kategori,
      satuan: p.satuan,
      hargaSatuan: p.harga_satuan,
      kemasanJual: { nama: p.kemasan_nama, isi: angka(p.kemasan_isi) },
      stokTersedia: angka(p.stok_tersedia),
      stokDiperbaruiPada: p.stok_diperbarui_pada,
      barangIdTerkait: null,
      keterangan: p.keterangan ?? '',
      aktif: p.aktif,
      satuanIsi: p.satuan_isi,
    })),
    paket: k.paket.map(kePaket),
    promo: (k.promo ?? []).map(kePromo),
  }
}

/** Tambah (id bukan angka) atau ubah (id angka) satu paket kontrak. */
export async function simpanPaketServer(sesi: SesiDistributor, paket: PaketKontrak): Promise<PaketKontrak> {
  const baru = !/^\d+$/.test(paket.id)
  const p = await minta<PaketApi>(
    baru ? `/distributor/${sesi.distributorId}/paket` : `/distributor/${sesi.distributorId}/paket/${paket.id}`,
    {
      method: baru ? 'POST' : 'PUT',
      token: sesi.token,
      body: JSON.stringify({
        penawaran_id: Number(paket.penawaranId),
        kode: paket.kode,
        durasi_bulan: paket.durasiBulan,
        kuota_min_per_bulan: paket.kuotaMinPerBulan,
        harga_satuan: paket.hargaSatuan,
        hemat_persen: paket.hematPersen,
        ketentuan_kuota_kurang: paket.ketentuanKuotaKurang,
        ketentuan_berhenti: paket.ketentuanBerhenti,
      }),
    },
  )
  return kePaket(p)
}

export async function hapusPaketServer(sesi: SesiDistributor, paketId: string): Promise<void> {
  await minta<unknown>(`/distributor/${sesi.distributorId}/paket/${paketId}`, { method: 'DELETE', token: sesi.token })
}
