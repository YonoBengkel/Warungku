import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { IkonJam, IkonKilau, IkonLabel, IkonMahkota } from '@/icons'
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
 *
 * Sejak revisi V5 (Q107) rupa itu berupa satu foto per jenis promo dengan
 * bayangan warna jenisnya, menggantikan logo per kategori barang dari V4.
 */

type Ikon = ComponentType<{ size?: number; className?: string }>

/**
 * - `latar` dan `teks`: pasangan `*-soft` + `*-ink` untuk lencana kecil di jalur
 *   beli (`LencanaPromo`), sudah diuji kontrasnya di kedua tema.
 * - `bayang` dan `tinta`: warna jenis di kartu berfoto, untuk bayangan foto dan
 *   tinta lencana jenis di atas pil putih.
 */
export const TEMPLATE_PROMO: Record<
  JenisPromo,
  { latar: string; teks: string; bayang: string; tinta: string; Ikon: Ikon }
> = {
  'cuci-gudang': {
    latar: 'bg-menipis-soft',
    teks: 'text-menipis-ink',
    bayang: 'bayang-promo-cuci',
    tinta: 'text-promo-cuci',
    Ikon: IkonLabel,
  },
  'produk-baru': {
    latar: 'bg-brand-soft',
    teks: 'text-brand-soft-ink',
    bayang: 'bayang-promo-baru',
    tinta: 'text-promo-baru',
    Ikon: IkonKilau,
  },
  membership: {
    latar: 'bg-info-soft',
    teks: 'text-info-ink',
    bayang: 'bayang-promo-anggota',
    tinta: 'text-promo-anggota',
    Ikon: IkonMahkota,
  },
}

/**
 * Foto per jenis promo (revisi V5, Q114): foto Unsplash 1080 px di
 * `public/gambar/promo/`, pemberi kreditnya di DESIGN.md. `posisi` menjaga
 * bagian fotonya yang paling bercerita tetap terlihat di kartu yang pendek.
 */
const FOTO_PROMO: Record<JenisPromo, { berkas: string; posisi: string }> = {
  'cuci-gudang': { berkas: 'cuci-gudang.jpg', posisi: 'center 35%' },
  'produk-baru': { berkas: 'produk-baru.jpg', posisi: 'center 40%' },
  membership: { berkas: 'keanggotaan.jpg', posisi: 'center 55%' },
}

/** Warna jenis di bawah foto, tampil selama fotonya belum termuat. */
export const LATAR_FOTO: Record<JenisPromo, string> = {
  'cuci-gudang': 'bg-promo-cuci',
  'produk-baru': 'bg-promo-baru',
  membership: 'bg-promo-anggota',
}

/** Foto jenis promo sebagai latar: kartu promo dan spanduk rincian promo (`pekat`). */
export function FotoPromo({ jenis, redup, pekat }: { jenis: JenisPromo; redup?: boolean; pekat?: boolean }) {
  const foto = FOTO_PROMO[jenis]
  return (
    <>
      <img
        src={`${import.meta.env.BASE_URL}gambar/promo/${foto.berkas}`}
        alt=""
        loading="lazy"
        decoding="async"
        className={cx('absolute inset-0 size-full object-cover', redup && 'grayscale')}
        style={{ objectPosition: foto.posisi }}
      />
      <span
        aria-hidden="true"
        className={cx(
          'absolute inset-0',
          pekat ? 'bayang-promo-pekat' : 'bayang-promo',
          redup ? 'bayang-promo-redup' : TEMPLATE_PROMO[jenis].bayang,
        )}
      />
    </>
  )
}

/** Lencana jenis promo: pil putih bertinta warna jenisnya, di atas foto. */
export function LencanaJenisPromo({ jenis, redup }: { jenis: JenisPromo; redup?: boolean }) {
  const { Ikon, tinta } = TEMPLATE_PROMO[jenis]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full bg-foto-pil px-2.5 py-1.5 text-kecil font-bold',
        redup ? 'text-promo-redup' : tinta,
      )}
    >
      <Ikon size={14} className="shrink-0" />
      {LABEL_PROMO[jenis]}
    </span>
  )
}

/**
 * Kartu promo berfoto (revisi V5, Q107): Beranda, halaman semua promo, daftar
 * promo distributor, dan pratinjaunya, supaya keempatnya sama persis.
 */
export function KartuPromo({
  promo,
  pratinjau,
  ke,
  redup,
}: {
  promo: Promo
  /** Tampilan saja, bukan tautan: dipakai portal distributor untuk melihat kartunya sendiri. */
  pratinjau?: boolean
  /** Tujuan kartu; bawaannya rincian promo untuk pemilik usaha. */
  ke?: string
  /** Promo yang sudah berakhir: foto kelabu dan tanggal berakhirnya. */
  redup?: boolean
}) {
  const namaToko = distributorById(promo.distributorId)?.nama ?? 'Distributor'
  const sisaHari = promo.berakhir
    ? Math.ceil((+new Date(promo.berakhir) - Date.now()) / 86_400_000)
    : null
  const kelas = cx(
    'relative isolate block h-60 overflow-hidden rounded-xl',
    redup ? 'bg-promo-redup' : LATAR_FOTO[promo.jenis],
    !pratinjau && 'transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-e3',
  )

  const isi = (
    <>
      <FotoPromo jenis={promo.jenis} redup={redup} />
      <div className="relative h-full flex flex-col justify-between gap-3 px-[1.125rem] pt-4 pb-[1.125rem]">
        <div className="flex items-start">
          <LencanaJenisPromo jenis={promo.jenis} redup={redup} />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <p className="text-judul font-extrabold text-foto-ink leading-tight line-clamp-2">{promo.judul}</p>
          <p className="text-isi font-semibold text-foto-ink-2 truncate">{namaToko}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {promo.potonganPersen != null && (
              <span
                className={cx(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-kecil font-extrabold',
                  // Coral di atas jingga Cuci Gudang tidak terbaca: pil putih.
                  redup
                    ? 'bg-foto-pil text-promo-redup'
                    : promo.jenis === 'cuci-gudang'
                      ? 'bg-foto-pil text-promo-cuci'
                      : 'bg-aksen text-aksen-ink',
                )}
              >
                Potongan {persen(promo.potonganPersen)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-kecil font-semibold text-foto-ink">
              <IkonJam size={13} className="shrink-0" />
              {redup && promo.berakhir
                ? `Berakhir ${tanggalRingkas(promo.berakhir)}`
                : promo.berakhir && sisaHari != null
                  ? `Sampai ${tanggalRingkas(promo.berakhir)} · ${hariLagi(sisaHari)}`
                  : 'Tanpa tanggal berakhir'}
            </span>
          </div>
        </div>
      </div>
    </>
  )

  if (pratinjau) return <div className={kelas}>{isi}</div>

  return (
    // Seluruh kartu adalah satu tautan: target sentuhnya sebesar kartunya,
    // bukan sebesar tulisan "Lihat promo" di pojok.
    <Link to={ke ?? `/promo/${promo.id}`} className={kelas}>
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
        <span className={cx('font-semibold text-ink-3', besar ? 'text-isi' : 'text-isi')}>
          /{satuan}
        </span>
      </span>
      {dicoret && (
        <span className="text-isi text-ink-3 tabular">
          <span className="sr-only">Harga normal </span>
          <s>{rupiah(rincian.hargaNormal)}</s>
        </span>
      )}
    </span>
  )
}
