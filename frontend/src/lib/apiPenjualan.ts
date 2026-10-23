import { minta } from '@/lib/api'
import type { SesiDistributor, SesiServer } from '@/lib/api'

/**
 * Ringkasan Penjualan (revisi 23 Okt 2026), satu bentuk untuk ketiga sumber:
 * nota kasir, penjualan ke pembeli usaha (UMKM produsen), dan pesanan selesai
 * (distributor). Lihat backend/api/penjualan.py.
 */

export type SumberPenjualan = 'nota' | 'penjualan-usaha' | 'pesanan-selesai'

export interface RingkasanPenjualan {
  sumber: SumberPenjualan
  dari: string
  sampai: string
  /** Tanggal terakhir yang punya data (tanpa data demo); rentang bawaan berakhir di sini. */
  dataTerakhir: string | null
  total: number
  jumlahTransaksi: number
  /** Pembeli atau pelanggan berbeda; null untuk nota kasir. */
  jumlahPihak: number | null
  rataRata: number
  pembandingTotal: number
  pembandingJumlah: number
  rincian: Array<{ label: string; nilai: number }>
  perHari: Array<{ tanggal: string; total: number; jumlah: number }>
  terlaris: Array<{ nama: string; satuan: string; jumlah: number; total: number }>
  pihakTeratas: Array<{ nama: string; jumlah: number; total: number }>
}

export interface RentangTanggal {
  dari: string
  sampai: string
}

interface RingkasanApi {
  sumber: SumberPenjualan
  dari: string
  sampai: string
  data_terakhir: string | null
  total: number
  jumlah_transaksi: number
  jumlah_pihak: number | null
  rata_rata: number
  pembanding_total: number
  pembanding_jumlah: number
  rincian: Array<{ label: string; nilai: number }>
  per_hari: Array<{ tanggal: string; total: number; jumlah: number }>
  terlaris: Array<{ nama: string; satuan: string; jumlah: number; total: number }>
  pihak_teratas: Array<{ nama: string; jumlah: number; total: number }>
}

function keRingkasan(r: RingkasanApi): RingkasanPenjualan {
  return {
    sumber: r.sumber,
    dari: r.dari,
    sampai: r.sampai,
    dataTerakhir: r.data_terakhir,
    total: r.total,
    jumlahTransaksi: r.jumlah_transaksi,
    jumlahPihak: r.jumlah_pihak,
    rataRata: r.rata_rata,
    pembandingTotal: r.pembanding_total,
    pembandingJumlah: r.pembanding_jumlah,
    rincian: r.rincian,
    perHari: r.per_hari,
    terlaris: r.terlaris,
    pihakTeratas: r.pihak_teratas,
  }
}

function kueri(rentang?: RentangTanggal): string {
  return rentang ? `?dari=${rentang.dari}&sampai=${rentang.sampai}` : ''
}

export async function ambilRingkasanUsaha(sesi: SesiServer, rentang?: RentangTanggal): Promise<RingkasanPenjualan> {
  return keRingkasan(
    await minta<RingkasanApi>(`/usaha/${sesi.usahaId}/ringkasan-penjualan${kueri(rentang)}`, { token: sesi.token }),
  )
}

export async function ambilRingkasanDistributor(
  sesi: SesiDistributor,
  rentang?: RentangTanggal,
): Promise<RingkasanPenjualan> {
  return keRingkasan(
    await minta<RingkasanApi>(`/distributor/${sesi.distributorId}/ringkasan-penjualan${kueri(rentang)}`, {
      token: sesi.token,
    }),
  )
}
