import { minta } from '@/lib/api'
import type { SesiDistributor } from '@/lib/api'
import type { InfoUsahaDistributor } from '@/lib/types'

/**
 * Profil distributor dari portalnya sendiri (revisi 23 Okt 2026): titik gudang
 * untuk peta Lacak Pesanan, tentang toko dan info usaha yang dibaca pemilik
 * usaha di halaman toko dan keranjang, serta kategori dan area kirim yang
 * menyaring rekomendasi distributor.
 */

export interface LokasiGudang {
  lat: number | null
  lng: number | null
}

/** Bagian profil yang disimpan di server. Di portal, ia menimpa data contoh. */
export interface ProfilServer extends LokasiGudang {
  deskripsi: string
  /** Kosong kalau distributor belum pernah mengisinya; layar lalu menulis "Belum diisi". */
  info: InfoUsahaDistributor | undefined
  kategori: string[]
  areaKirim: string[]
}

interface ProfilDistributorApi {
  id: number
  deskripsi: string | null
  kategori: string[]
  area_kirim: string[]
  alamat_gudang: string | null
  nomor_hp: string | null
  jam_operasional: string | null
  minimum_pesanan: number
  lat: number | null
  lng: number | null
}

function keProfil(p: ProfilDistributorApi): ProfilServer {
  const diisi = p.alamat_gudang != null || p.nomor_hp != null || p.jam_operasional != null || p.minimum_pesanan > 0
  return {
    deskripsi: p.deskripsi ?? '',
    info: diisi
      ? {
          alamatGudang: p.alamat_gudang ?? '',
          nomorHp: p.nomor_hp ?? '',
          jamOperasional: p.jam_operasional ?? '',
          minimumPesanan: p.minimum_pesanan,
        }
      : undefined,
    kategori: p.kategori,
    areaKirim: p.area_kirim,
    lat: p.lat,
    lng: p.lng,
  }
}

export async function ambilProfilDistributor(sesi: SesiDistributor): Promise<ProfilServer> {
  return keProfil(await minta<ProfilDistributorApi>(`/distributor/${sesi.distributorId}/profil`, { token: sesi.token }))
}

/** Keduanya null: kembali memakai titik tengah kota. */
export async function simpanLokasiGudang(sesi: SesiDistributor, lokasi: LokasiGudang): Promise<ProfilServer> {
  const p = await minta<ProfilDistributorApi>(`/distributor/${sesi.distributorId}/lokasi`, {
    method: 'PUT',
    token: sesi.token,
    body: JSON.stringify(lokasi),
  })
  return keProfil(p)
}

/** Isian yang ditolak server (422) membawa pesan yang bisa ditampilkan apa adanya. */
export async function simpanInfoUsaha(
  sesi: SesiDistributor,
  isi: { deskripsi: string; info: InfoUsahaDistributor },
): Promise<ProfilServer> {
  const p = await minta<ProfilDistributorApi>(`/distributor/${sesi.distributorId}/profil`, {
    method: 'PUT',
    token: sesi.token,
    body: JSON.stringify({
      deskripsi: isi.deskripsi,
      alamat_gudang: isi.info.alamatGudang,
      nomor_hp: isi.info.nomorHp,
      jam_operasional: isi.info.jamOperasional,
      minimum_pesanan: isi.info.minimumPesanan,
    }),
  })
  return keProfil(p)
}

/** Hanya pilihan dari daftar chip yang diterima; nilai lain ditolak dengan pesan untuk layar. */
export async function simpanLayanan(
  sesi: SesiDistributor,
  isi: { kategori: string[]; areaKirim: string[] },
): Promise<ProfilServer> {
  const p = await minta<ProfilDistributorApi>(`/distributor/${sesi.distributorId}/layanan`, {
    method: 'PUT',
    token: sesi.token,
    body: JSON.stringify({ kategori: isi.kategori, area_kirim: isi.areaKirim }),
  })
  return keProfil(p)
}
