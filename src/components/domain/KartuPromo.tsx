import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { IkonJam, IkonKotak, IkonBintang, IkonSinkron, IkonToko } from '@/icons'
import { distributorById } from '@/data/dummy'
import { LABEL_PROMO } from '@/lib/label'
import { cx, hariLagi, persen, tanggalRingkas } from '@/lib/format'
import type { JenisPromo, Promo } from '@/lib/types'

/**
 * Kartu promo distributor.
 *
 * Aturan yang mengikat dari catatan pemilik proyek: "masing-masing promo punya
 * template background yang sama. Misalkan cuci gudang, toko A dan toko B
 * sama-sama punya background dan style card yang sama, tetapi hanya beda di
 * nama tokonya saja."
 *
 * Jadi yang menentukan rupa kartu adalah JENIS promonya, bukan tokonya. Nama
 * toko tidak pernah ada di dalam template: ia dibaca dari `distributorById`
 * saat dirender. Efeknya di layar, pemilik warung mengenali "ini cuci gudang"
 * dari bentuk kartunya sebelum sempat membaca satu kata pun.
 */

type Ikon = ComponentType<{ size?: number; className?: string }>

/**
 * Latar sengaja memakai pasangan `*-soft` + `*-ink` yang sudah dipakai di
 * seluruh aplikasi, bukan gradien karangan baru. Pasangan itu sudah diuji
 * kontrasnya di tema terang DAN gelap, sedangkan warna baru harus diuji ulang
 * dua kali untuk keuntungan yang tidak dirasakan siapa pun.
 *
 * `aksen` dipakai untuk medali ikon dan lencana jenis promo: warna padat
 * dengan `text-ink-inverse`, bukan `text-white`, supaya tetap terbaca saat
 * token warnanya berubah terang di tema gelap.
 */
export const TEMPLATE_PROMO: Record<
  JenisPromo,
  { latar: string; teks: string; aksen: string; Ikon: Ikon }
> = {
  'cuci-gudang': {
    latar: 'bg-menipis-soft',
    teks: 'text-menipis-ink',
    aksen: 'bg-menipis text-ink-inverse',
    Ikon: IkonKotak,
  },
  'produk-baru': {
    latar: 'bg-brand-soft',
    teks: 'text-brand-soft-ink',
    aksen: 'bg-brand text-ink-inverse',
    Ikon: IkonBintang,
  },
  membership: {
    latar: 'bg-info-soft',
    teks: 'text-info-ink',
    aksen: 'bg-info text-ink-inverse',
    Ikon: IkonSinkron,
  },
}

export function KartuPromo({ promo, lebar }: { promo: Promo; lebar?: boolean }) {
  const template = TEMPLATE_PROMO[promo.jenis]
  const namaToko = distributorById(promo.distributorId)?.nama ?? 'Distributor'
  const sisaHari = promo.berakhir
    ? Math.ceil((+new Date(promo.berakhir) - Date.now()) / 86_400_000)
    : null

  return (
    // Seluruh kartu adalah satu tautan: target sentuhnya sebesar kartunya,
    // bukan sebesar tulisan "Lihat promo" di pojok.
    <Link
      to={`/promo/${promo.id}`}
      className={cx(
        'group flex flex-col gap-2.5 rounded-lg p-4 min-h-[9.5rem]',
        'transition-[filter,box-shadow] duration-150 hover:brightness-97 hover:shadow-e2',
        template.latar,
        template.teks,
        lebar ? 'w-full' : 'snap-start shrink-0 w-[85%] sm:w-[20rem] lg:w-full',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cx('shrink-0 size-9 rounded-md grid place-items-center', template.aksen)}>
          <template.Ikon size={18} />
        </span>
        <span
          className={cx(
            'inline-flex items-center rounded-sm px-2 py-[3px] text-[0.6875rem] font-bold',
            template.aksen,
          )}
        >
          {LABEL_PROMO[promo.jenis]}
        </span>
      </div>

      <p className="text-[1.0625rem] font-extrabold leading-snug line-clamp-2">{promo.judul}</p>

      <p className="flex items-center gap-1.5 text-[0.875rem] font-semibold min-w-0">
        <IkonToko size={15} className="shrink-0" />
        <span className="truncate">{namaToko}</span>
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {promo.potonganPersen != null && (
          <span className="inline-flex items-center rounded-sm bg-surface text-ink px-2 py-[3px] text-[0.75rem] font-bold">
            Potongan {persen(promo.potonganPersen)}
          </span>
        )}
        {promo.berakhir && sisaHari != null && (
          <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold">
            <IkonJam size={13} className="shrink-0" />
            Sampai {tanggalRingkas(promo.berakhir)} · {hariLagi(sisaHari)}
          </span>
        )}
      </div>
    </Link>
  )
}
