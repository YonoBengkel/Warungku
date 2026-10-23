import { minta } from '@/lib/api'
import type { SesiDistributor } from '@/lib/api'

/**
 * Profil distributor dari portalnya sendiri (revisi 23 Okt 2026). Sejauh ini
 * yang dipakai hanya titik gudang untuk peta Lacak Pesanan.
 */

export interface LokasiGudang {
  lat: number | null
  lng: number | null
}

interface ProfilDistributorApi {
  id: number
  lat: number | null
  lng: number | null
}

export async function ambilLokasiGudang(sesi: SesiDistributor): Promise<LokasiGudang> {
  const p = await minta<ProfilDistributorApi>(`/distributor/${sesi.distributorId}/profil`, { token: sesi.token })
  return { lat: p.lat, lng: p.lng }
}

/** Keduanya null: kembali memakai titik tengah kota. */
export async function simpanLokasiGudang(sesi: SesiDistributor, lokasi: LokasiGudang): Promise<LokasiGudang> {
  const p = await minta<ProfilDistributorApi>(`/distributor/${sesi.distributorId}/lokasi`, {
    method: 'PUT',
    token: sesi.token,
    body: JSON.stringify(lokasi),
  })
  return { lat: p.lat, lng: p.lng }
}
