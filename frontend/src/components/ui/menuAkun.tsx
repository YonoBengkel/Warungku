import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IkonPanahKanan } from '@/icons'
import { cx } from '@/lib/format'

/**
 * Potongan halaman akun yang dipakai kedua portal (revisi V4, Q94): kelompok
 * menu berjudul, baris menu yang membuka halaman bawahan, dan tombol pilihan
 * tema. Dulu hanya ada di Akun pemilik usaha; halaman akun distributor kini
 * memakai susunan yang sama.
 */

export function Kelompok({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section aria-label={judul}>
      <h2 className="text-kecil font-bold uppercase tracking-wide text-ink-3 mb-2">{judul}</h2>
      <div className="rounded-lg border border-line bg-surface overflow-hidden shadow-e1">{children}</div>
    </section>
  )
}

/** Tinggi minimal 56px, ikon di kiri, panah di kanan. Seluruh baris bisa ditekan. */
export function BarisMenu({
  ke,
  ikon,
  judul,
  keterangan,
  lencana,
}: {
  ke: string
  ikon: ReactNode
  judul: string
  keterangan?: string
  lencana?: ReactNode
}) {
  return (
    <Link
      to={ke}
      className="flex items-center gap-3 min-h-14 px-3.5 py-3 border-b border-line last:border-b-0 transition-colors hover:bg-sunken active:bg-surface-2"
    >
      <span className="shrink-0 size-9 rounded-md bg-sunken grid place-items-center text-ink-2" aria-hidden="true">
        {ikon}
      </span>
      <span className="min-w-0 grow">
        <span className="block text-kartu font-semibold text-ink leading-snug">{judul}</span>
        {keterangan && (
          <span className="block mt-0.5 text-kecil text-ink-3 leading-snug">{keterangan}</span>
        )}
        {/* Di layar 360px lencana yang duduk sebaris menyisakan sekitar 100px
            untuk judul, dan "Data dari Kasir" pecah jadi satu kata per baris.
            Di bawah sm ia turun ke bawah teks; di layar lebar tetap di kanan. */}
        {lencana && <span className="mt-1.5 flex sm:hidden">{lencana}</span>}
      </span>
      {lencana && <span className="shrink-0 hidden sm:block">{lencana}</span>}
      <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
    </Link>
  )
}

export function TombolPilihan({
  aktif,
  onClick,
  ikon,
  children,
}: {
  aktif: boolean
  onClick: () => void
  ikon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cx(
        'flex-1 h-12 rounded-md border-2 inline-flex items-center justify-center gap-2 text-kartu font-semibold transition-colors',
        aktif
          ? 'border-brand bg-brand-soft text-brand-soft-ink'
          : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}
