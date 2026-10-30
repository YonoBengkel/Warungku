import type { ReactNode } from 'react'
import { IkonKalender } from '@/icons'
import { tanggalLengkapHari } from '@/lib/format'
import { RUANG_LONCENG } from '@/components/ui/navigasi'

/**
 * Kepala Beranda kedua portal (revisi V5, Q106, mengikuti `Selamat Datang.jpeg`):
 * "Selamat datang," besar dan tebal, nama usaha miring berwarna ungu dengan
 * sapuan stabilo, keterangan kecil di bawahnya (data kasir, hanya UMKM), dan
 * pil tanggal di kanan sebelah lonceng. Di HP ditumpuk, pil tanggal di bawah.
 *
 * Ukuran sapaannya pengecualian dari enam token tipografi, tercatat di
 * DESIGN.md: ini satu-satunya teks sebesar itu di aplikasi.
 */
export function KepalaSambutan({ nama, bawah }: { nama: string; bawah?: ReactNode }) {
  return (
    <header className={`flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${RUANG_LONCENG}`}>
      <div className="min-w-0">
        <h1 className="text-[1.875rem] lg:text-[2.5rem] font-extrabold text-ink tracking-tight leading-[1.1]">
          Selamat datang,
          <span className="block mt-0.5">
            <span className="stabilo italic text-brand">{nama}</span>
          </span>
        </h1>
        {bawah && <div className="mt-2">{bawah}</div>}
      </div>
      <p className="self-start shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-brand-soft text-brand-soft-ink text-isi font-bold lg:mt-0.5">
        <IkonKalender size={17} className="shrink-0" />
        {tanggalLengkapHari(new Date())}
      </p>
    </header>
  )
}
