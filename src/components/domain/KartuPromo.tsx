import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { IkonJam, IkonKotak, IkonBintang, IkonSinkron, IkonToko } from '@/icons'
import { distributorById } from '@/data/dummy'
import { LABEL_PROMO } from '@/lib/label'
import { cx, hariLagi, persen, rupiah, tanggalRingkas } from '@/lib/format'
import type { JenisPromo, Promo, RincianHarga } from '@/lib/types'

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

export function KartuPromo({
  promo,
  lebar,
  pratinjau,
}: {
  promo: Promo
  lebar?: boolean
  /** Tampilan saja, bukan tautan: dipakai portal distributor untuk melihat kartunya sendiri. */
  pratinjau?: boolean
}) {
  const template = TEMPLATE_PROMO[promo.jenis]
  const namaToko = distributorById(promo.distributorId)?.nama ?? 'Distributor'
  const sisaHari = promo.berakhir
    ? Math.ceil((+new Date(promo.berakhir) - Date.now()) / 86_400_000)
    : null
  const kelas = cx(
    'group flex flex-col gap-2.5 rounded-lg p-4 min-h-[9.5rem]',
    !pratinjau && 'transition-[filter,box-shadow] duration-150 hover:brightness-97 hover:shadow-e2',
    template.latar,
    template.teks,
    lebar ? 'w-full' : 'snap-start shrink-0 w-[85%] sm:w-[20rem] lg:w-full',
  )

  const isi = (
    <>
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
    </>
  )

  if (pratinjau) return <div className={kelas}>{isi}</div>

  return (
    // Seluruh kartu adalah satu tautan: target sentuhnya sebesar kartunya,
    // bukan sebesar tulisan "Lihat promo" di pojok.
    <Link to={`/promo/${promo.id}`} className={kelas}>
      {isi}
    </Link>
  )
}

/**
 * Penanda promo di sepanjang jalur beli: katalog, detail penawaran, keranjang,
 * sampai pesanan yang dilihat distributor.
 *
 * Lencana ini menerangkan ASAL potongan; angkanya sendiri ditampilkan oleh
 * `HargaBeli`, yang membaca `rincianHarga` — satu-satunya sumber harga baris.
 */
export function LencanaPromo({ promo, tanpaTautan }: { promo: Promo; tanpaTautan?: boolean }) {
  const template = TEMPLATE_PROMO[promo.jenis]
  const isi = (
    <>
      <template.Ikon size={12} className="shrink-0" />
      <span className="min-w-0 break-words">
        {LABEL_PROMO[promo.jenis]}
        {promo.potonganPersen != null && ` · potongan ${promo.potonganPersen}%`}
      </span>
    </>
  )
  const kelas = cx(
    'relative inline-flex items-center gap-1 rounded-sm px-2 py-[3px] text-[0.6875rem] font-semibold max-w-full',
    template.latar,
    template.teks,
  )

  // Di dalam kartu yang seluruhnya sudah jadi tautan, lencana ini tidak boleh
  // jadi tautan kedua: tautan bersarang tidak sah dan membingungkan pembaca layar.
  if (tanpaTautan) return <span className={kelas}>{isi}</span>

  // Sebagai tautan, lencananya cuma setinggi ±20px. Area sentuhnya dilebarkan
  // lewat pseudo-element supaya jempol tetap mengenainya tanpa membuat lencana
  // terlihat gemuk di antara chip lain yang sebaris dengannya.
  return (
    <Link
      to={`/promo/${promo.id}`}
      className={cx(
        kelas,
        'hover:brightness-97',
        'after:absolute after:inset-x-0 after:-top-3 after:-bottom-3 after:content-[""]',
      )}
    >
      {isi}
    </Link>
  )
}

/**
 * Kalimat baku soal promo, dipakai di keranjang, detail penawaran, dan pesanan.
 * Ditulis sekali supaya dua layar tidak menjanjikan hal yang berbeda.
 */
export const KALIMAT_PROMO = {
  sudahDipotong: 'Potongan promo sudah masuk ke harga ini.',
  hanyaBeliSekali: 'Potongan promo berlaku untuk beli sekali.',
  kontrakTidakIkut: 'Barang yang terikat kontrak memakai harga kontrak, jadi tidak ikut promo.',
} as const

/**
 * Harga satu baris beli, dengan harga normal dicoret kalau promo memotongnya.
 *
 * Harga coret di sini sah karena potongannya memang masuk ke angka yang
 * disimpan di pesanan (`rincianHarga` sumber keduanya). Untuk baris berkontrak
 * harga normal TIDAK dicoret: harga kontrak adalah kesepakatan, bukan diskon,
 * dan mencoretnya membuat kontrak terbaca seperti promo yang bisa berakhir.
 */
export function HargaBeli({
  rincian,
  satuan,
  besar,
  className,
}: {
  rincian: RincianHarga
  satuan: string
  besar?: boolean
  className?: string
}) {
  const dicoret = rincian.sumber === 'promo' && rincian.hargaNormal > rincian.harga
  return (
    <span className={cx('relative inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <span className={cx('tabular', besar ? 'text-[1.5rem] font-extrabold text-ink' : 'font-bold text-ink')}>
        {rupiah(rincian.harga)}
        <span className={cx('font-semibold text-ink-3', besar ? 'text-[0.875rem]' : 'text-[0.8125rem]')}>
          /{satuan}
        </span>
      </span>
      {dicoret && (
        <span className="text-[0.8125rem] text-ink-3 tabular">
          <span className="sr-only">Harga normal </span>
          <s>{rupiah(rincian.hargaNormal)}</s>
        </span>
      )}
    </span>
  )
}
