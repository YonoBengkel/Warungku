import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cx } from '@/lib/format'
import { IkonKembali } from '@/icons'

/* ================================================================== */
/* Tab segmen                                                         */
/* ================================================================== */

/**
 * Tab di dalam halaman. Di mobile bisa digeser horizontal supaya jumlah tab
 * tidak dibatasi lebar layar.
 */
export function TabSegmen<T extends string>({
  tab,
  aktif,
  ubah,
  className,
}: {
  tab: Array<{ nilai: T; label: string; jumlah?: number }>
  aktif: T
  ubah: (v: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cx('flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0', className)}
    >
      {tab.map((t) => {
        const terpilih = t.nilai === aktif
        return (
          <button
            key={t.nilai}
            role="tab"
            aria-selected={terpilih}
            onClick={() => ubah(t.nilai)}
            className={cx(
              'shrink-0 h-11 px-3.5 rounded-md text-[0.875rem] font-semibold transition-colors duration-150',
              'inline-flex items-center gap-1.5',
              terpilih ? 'bg-ink text-ink-inverse' : 'bg-sunken text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.jumlah != null && t.jumlah > 0 && (
              <span
                className={cx(
                  'text-[0.6875rem] font-bold rounded-full px-1.5 py-px tabular',
                  terpilih ? 'bg-ink-inverse/20' : 'bg-surface text-ink-2',
                )}
              >
                {t.jumlah}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Tab yang mengubah URL, supaya bisa ditautkan langsung dari notifikasi. */
export function TabTautan({
  tab,
  className,
}: {
  tab: Array<{ ke: string; label: string; jumlah?: number }>
  className?: string
}) {
  const { pathname } = useLocation()
  return (
    <div className={cx('flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      {tab.map((t) => {
        const terpilih = pathname === t.ke || pathname.startsWith(`${t.ke}/`)
        return (
          <Link
            key={t.ke}
            to={t.ke}
            aria-current={terpilih ? 'page' : undefined}
            className={cx(
              'shrink-0 h-11 px-3.5 rounded-md text-[0.875rem] font-semibold transition-colors duration-150',
              'inline-flex items-center gap-1.5',
              terpilih ? 'bg-ink text-ink-inverse' : 'bg-sunken text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.jumlah != null && t.jumlah > 0 && (
              <span
                className={cx(
                  'text-[0.6875rem] font-bold rounded-full px-1.5 py-px tabular',
                  terpilih ? 'bg-ink-inverse/20' : 'bg-surface text-ink-2',
                )}
              >
                {t.jumlah}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/* Baris chip penyaring                                               */
/* ================================================================== */

export function BarisChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      {children}
    </div>
  )
}

export function Chip({
  aktif,
  onClick,
  children,
  ikon,
}: {
  aktif?: boolean
  onClick?: () => void
  children: ReactNode
  ikon?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={cx(
        // relative: teks khusus pembaca layar di dalam chip diposisikan absolut.
        // Tanpa jangkar di sini, ia mencari leluhur berposisi terdekat - yaitu
        // kepala halaman yang sticky - lalu lolos dari wadah gulir chip dan
        // melebarkan seluruh halaman.
        'relative shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 rounded-full text-[0.8125rem] font-semibold',
        'border transition-colors duration-150',
        aktif
          ? 'bg-brand text-ink-inverse border-brand'
          : 'bg-surface text-ink-2 border-line-strong hover:border-brand hover:text-brand',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}

/* ================================================================== */
/* Kepala halaman dalam                                               */
/* ================================================================== */

/**
 * Kepala untuk halaman detail. Di mobile ia menempel di atas dengan tombol
 * kembali; di desktop tombol kembali tetap ada karena navigasi samping tidak
 * menyorot halaman detail.
 */
export function KepalaHalaman({
  judul,
  keterangan,
  kembaliKe,
  aksi,
  bawah,
}: {
  judul: string
  keterangan?: ReactNode
  kembaliKe?: string
  aksi?: ReactNode
  bawah?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-sm border-b border-line -mx-4 px-4 sm:-mx-6 sm:px-6 pt-aman">
      <div className="flex items-center gap-2 min-h-14 py-2">
        {kembaliKe && (
          <Link
            to={kembaliKe}
            aria-label="Kembali"
            className="-ml-2 size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken shrink-0"
          >
            <IkonKembali size={22} />
          </Link>
        )}
        <div className="min-w-0 grow">
          {/* Nama layar dikunci spesifikasi, jadi ia dibungkus dua baris di layar
              sempit, bukan dipotong. Judul terpotong membuat pengguna tidak
              yakin ia sedang berada di halaman yang benar. */}
          <h1 className="text-[1.0625rem] font-extrabold text-ink leading-tight line-clamp-2 sm:truncate">
            {judul}
          </h1>
          {keterangan && <p className="text-[0.75rem] text-ink-3 truncate leading-tight">{keterangan}</p>}
        </div>
        {aksi && <div className="shrink-0 flex items-center gap-1">{aksi}</div>}
      </div>
      {bawah && <div className="pb-3">{bawah}</div>}
    </header>
  )
}

/* ================================================================== */
/* Bilah aksi menempel di bawah                                       */
/* ================================================================== */

/**
 * Untuk halaman dengan satu aksi utama (checkout, setujui kontrak).
 * Ditempel di bawah supaya selalu berada di jangkauan jempol.
 */
export function BilahAksi({ children, ringkasan }: { children: ReactNode; ringkasan?: ReactNode }) {
  return (
    // Ditempel tepat di ATAS bilah navigasi bawah, bukan di dasar layar.
    // Kalau dipatok bottom-0, navigasi yang fixed menutupinya selama halaman
    // belum digulir mentok, dan tombol utamanya benar-benar tidak bisa ditekan.
    <div className="sticky bottom-[var(--nav-h)] lg:bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface/97 backdrop-blur-sm border-t border-line pb-aman lg:pb-0 z-30">
      {ringkasan && <div className="mb-2.5">{ringkasan}</div>}
      {children}
    </div>
  )
}
