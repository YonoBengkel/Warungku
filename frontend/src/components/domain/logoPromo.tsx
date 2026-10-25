import { useMemo } from 'react'
import { GLYPH_PROMO, type KategoriLogo } from '@/data/glyphPromo'
import type { Penawaran, Promo } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Logo promo per kategori barang (revisi V4, Q92).
 *
 * Dulu ikon kartu promo hanya tiga, satu per jenis promo, sehingga tiga promo
 * Cuci Gudang tampak kembar. Kini logonya dipilih dari barang yang ikut promo,
 * dan jenis promonya tetap dikenali dari warna ubinnya (`LogoPromo` di
 * KartuPromo.tsx).
 *
 * Glyph digambar dengan skill logo-design dan dibangkitkan oleh
 * `tools/buat_logo_promo.py` ke `data/glyphPromo.ts`: isian padat satu warna
 * (`currentColor`), ruang negatif lewat evenodd, celah paling kecil 14-16 unit
 * supaya masih terlihat saat glyph selebar 24 px. Masternya di
 * `docs/desain/logo-promo/`.
 */

export type { KategoriLogo }

/**
 * Kelompok logo satu barang, dari kategori katalognya. "Kopi & Teh" dipecah
 * lewat namanya, karena kopi dan teh adalah dua promo yang berbeda rupa.
 * Protein ikut Bahan Makanan.
 */
export function kategoriLogoBarang(p: Pick<Penawaran, 'kategori' | 'nama'>): KategoriLogo {
  switch (p.kategori) {
    case 'Kopi & Teh':
      return /\b(teh|matcha)\b/i.test(p.nama) ? 'teh' : 'kopi'
    case 'Susu & Olahan':
      return 'susu'
    case 'Pemanis':
      return 'pemanis'
    case 'Kemasan':
      return 'kemasan'
    case 'Bahan Makanan':
    case 'Protein':
      return 'bahan'
    case 'Pendukung':
      return 'pendukung'
    default:
      return 'campuran'
  }
}

/** Logo satu promo: kelompok barang terbanyak. Seri atau belum ada barang: Campuran. */
export function kategoriLogoPromo(barang: Pick<Penawaran, 'kategori' | 'nama'>[]): KategoriLogo {
  const hitung = new Map<KategoriLogo, number>()
  for (const p of barang) {
    const k = kategoriLogoBarang(p)
    hitung.set(k, (hitung.get(k) ?? 0) + 1)
  }
  let terbanyak: KategoriLogo = 'campuran'
  let jumlah = 0
  let seri = false
  for (const [k, n] of hitung) {
    if (n > jumlah) {
      terbanyak = k
      jumlah = n
      seri = false
    } else if (n === jumlah) {
      seri = true
    }
  }
  return jumlah === 0 || seri ? 'campuran' : terbanyak
}

/**
 * Kategori logo promo dari katalog di store. Katalog portal distributor dicari
 * dulu (barang yang baru ditambahkan toko itu), lalu katalog pemilik usaha,
 * supaya promo toko lain di Beranda tetap mendapat logonya.
 */
export function useKategoriLogoPromo(promo: Pick<Promo, 'penawaranIds'>): KategoriLogo {
  const milikPortal = useAplikasi((s) => s.katalogDistributorServer?.penawaran)
  const katalog = useAplikasi((s) => s.katalog)
  return useMemo(() => {
    const cari = (id: string) => milikPortal?.find((p) => p.id === id) ?? katalog.find((p) => p.id === id)
    return kategoriLogoPromo(promo.penawaranIds.map(cari).filter((p): p is Penawaran => p != null))
  }, [promo.penawaranIds, milikPortal, katalog])
}

export function GlyphPromo({
  kategori,
  size = 24,
  className,
}: {
  kategori: KategoriLogo
  size?: number
  className?: string
}) {
  const g = GLYPH_PROMO[kategori]
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <path fill="currentColor" fillRule={g.ganjil ? 'evenodd' : undefined} d={g.d} />
    </svg>
  )
}
