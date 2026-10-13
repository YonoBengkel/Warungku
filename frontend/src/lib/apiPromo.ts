import type { JenisPromo, Promo } from '@/lib/types'
import { minta } from '@/lib/api'
import type { SesiDistributor } from '@/lib/api'
import { keIdDistributor } from '@/lib/apiPesanan'

/** Promo dari API. Dibaca pemilik usaha lewat katalog, dikelola distributor di portalnya. */

export interface PromoApi {
  id: number
  distributor_id: number
  jenis: string
  judul: string
  keterangan: string | null
  berakhir: string | null
  potongan_persen: number | null
  penawaran_ids: number[]
  tingkat: Array<{ nama: string; syarat: string | null; manfaat: string | null }>
}

export function kePromo(p: PromoApi): Promo {
  return {
    id: String(p.id),
    jenis: p.jenis as JenisPromo,
    distributorId: keIdDistributor(p.distributor_id),
    judul: p.judul,
    keterangan: p.keterangan ?? '',
    berakhir: p.berakhir,
    penawaranIds: p.penawaran_ids.map(String),
    potonganPersen: p.potongan_persen,
    ...(p.tingkat.length > 0
      ? { tingkat: p.tingkat.map((t) => ({ nama: t.nama, syarat: t.syarat ?? '', manfaat: t.manfaat ?? '' })) }
      : {}),
  }
}

/** Tambah (id bukan angka) atau ubah (id angka) satu promo. */
export async function simpanPromoServer(sesi: SesiDistributor, promo: Promo): Promise<Promo> {
  const baru = !/^\d+$/.test(promo.id)
  const p = await minta<PromoApi>(
    baru ? `/distributor/${sesi.distributorId}/promo` : `/distributor/${sesi.distributorId}/promo/${promo.id}`,
    {
      method: baru ? 'POST' : 'PUT',
      token: sesi.token,
      body: JSON.stringify({
        jenis: promo.jenis,
        judul: promo.judul,
        keterangan: promo.keterangan || null,
        berakhir: promo.berakhir,
        potongan_persen: promo.potonganPersen,
        penawaran_ids: promo.penawaranIds.filter((id) => /^\d+$/.test(id)).map(Number),
        tingkat: (promo.tingkat ?? []).map((t) => ({ nama: t.nama, syarat: t.syarat || null, manfaat: t.manfaat || null })),
      }),
    },
  )
  return kePromo(p)
}

export async function akhiriPromoServer(sesi: SesiDistributor, promoId: string): Promise<Promo> {
  return kePromo(
    await minta<PromoApi>(`/distributor/${sesi.distributorId}/promo/${promoId}/akhiri`, {
      method: 'POST',
      token: sesi.token,
      body: '{}',
    }),
  )
}
