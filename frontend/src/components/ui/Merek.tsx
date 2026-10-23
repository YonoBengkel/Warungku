/**
 * Tanda merek Turnify Flow: gambar toko dengan panah naik, tanpa tulisan.
 *
 * Nama "Turnify Flow" sengaja tidak ikut di gambar. Teks tetap tajam di semua
 * ukuran, mengikuti warna tema gelap, dan terbaca pembaca layar; gambar
 * tulisan akan buram di 32 piksel dan hilang di tema gelap.
 *
 * Gambarnya dipotong dari docs/aset/logo-turnify-flow.jpeg (lihat docs/aset/logo-mark.png).
 * Sejak revisi 23 Okt 2026 tokonya ungu #4A148C. Ungu sepekat itu hanya 1,4:1
 * di permukaan gelap, jadi tema gelap memakai versi ungu terang
 * (logo-mark-gelap.png, #A26CE5 seperti warna merek tema gelap). Kedua gambar
 * dipasang dan kelas `dark:` memilih salah satunya, karena tema bisa diganti
 * pengguna tanpa memuat ulang halaman.
 */
export function TandaMerek({ ukuran = 36, className }: { ukuran?: number; className?: string }) {
  const kelas = ['shrink-0 object-contain select-none', className].filter(Boolean).join(' ')
  return (
    <>
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        width={ukuran}
        height={ukuran}
        className={`${kelas} dark:hidden`}
        draggable={false}
      />
      <img
        src="/logo-mark-gelap.png"
        alt=""
        aria-hidden="true"
        width={ukuran}
        height={ukuran}
        className={`${kelas} hidden dark:inline`}
        draggable={false}
      />
    </>
  )
}
