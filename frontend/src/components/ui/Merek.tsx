/**
 * Tanda merek Turnify Flow: gambar toko dengan panah naik, tanpa tulisan.
 *
 * Nama "Turnify Flow" sengaja tidak ikut di gambar. Teks tetap tajam di semua
 * ukuran, mengikuti warna tema gelap, dan terbaca pembaca layar; gambar
 * tulisan akan buram di 32 piksel dan hilang di tema gelap.
 *
 * Gambarnya dipotong dari docs/aset/logo-turnify-flow.jpeg (lihat docs/aset/logo-mark.png).
 */
export function TandaMerek({ ukuran = 36, className }: { ukuran?: number; className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={ukuran}
      height={ukuran}
      className={['shrink-0 object-contain select-none', className].filter(Boolean).join(' ')}
      draggable={false}
    />
  )
}
