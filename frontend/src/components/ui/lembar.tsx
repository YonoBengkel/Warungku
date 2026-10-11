import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/lib/format'
import { IkonSilang } from '@/icons'
import { Tombol, TombolIkon } from './dasar'

/**
 * Satu komponen, dua wujud.
 *
 * Di layar sempit ia naik dari bawah (bottom sheet) supaya jempol bisa
 * menjangkau tombol aksinya. Di layar lebar ia jadi jendela di tengah.
 * Ini persis perilaku yang diminta untuk alur "Pesan Cepat" dari notifikasi.
 *
 * Tanggung jawab aksesibilitas yang sudah ditangani di sini:
 * - Escape menutup, klik latar menutup.
 * - Fokus dipindah ke dalam lembar saat dibuka dan dikurung di dalamnya.
 * - Gulir halaman di belakang dikunci.
 * - role="dialog" aria-modal dengan judul yang tertaut.
 */

let penghitungLembar = 0

export function Lembar({
  terbuka,
  tutup,
  judul,
  keterangan,
  children,
  kaki,
  lebar = 'sedang',
  kunciLatar,
}: {
  terbuka: boolean
  tutup: () => void
  judul: string
  keterangan?: string
  children: ReactNode
  kaki?: ReactNode
  lebar?: 'sempit' | 'sedang' | 'lebar'
  /** Kalau true, klik latar tidak menutup. Untuk alur yang tidak boleh hilang tak sengaja. */
  kunciLatar?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pemicuRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!terbuka) return
    pemicuRef.current = document.activeElement
    penghitungLembar += 1
    const gulirSebelum = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const fokusAwal = panel?.querySelector<HTMLElement>('[data-fokus-awal]') ?? panel
    fokusAwal?.focus({ preventScroll: true })

    function padaTombol(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        tutup()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const bisaFokus = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (bisaFokus.length === 0) return
      const pertama = bisaFokus[0]
      const terakhir = bisaFokus[bisaFokus.length - 1]
      if (e.shiftKey && document.activeElement === pertama) {
        e.preventDefault()
        terakhir.focus()
      } else if (!e.shiftKey && document.activeElement === terakhir) {
        e.preventDefault()
        pertama.focus()
      }
    }

    document.addEventListener('keydown', padaTombol, true)
    return () => {
      document.removeEventListener('keydown', padaTombol, true)
      penghitungLembar = Math.max(0, penghitungLembar - 1)
      if (penghitungLembar === 0) document.body.style.overflow = gulirSebelum
      ;(pemicuRef.current as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
  }, [terbuka, tutup])

  if (!terbuka) return null

  const lebarKelas = {
    sempit: 'sm:max-w-md',
    sedang: 'sm:max-w-lg',
    lebar: 'sm:max-w-2xl',
  }[lebar]

  const idJudul = `lembar-judul-${judul.replace(/\s+/g, '-').toLowerCase()}`

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/45 anim-pudar"
        onClick={kunciLatar ? undefined : tutup}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        tabIndex={-1}
        className={cx(
          'relative w-full bg-surface shadow-e3 outline-none',
          'rounded-t-xl sm:rounded-xl',
          'max-h-[92vh] sm:max-h-[85vh] flex flex-col',
          'anim-naik sm:anim-muncul',
          lebarKelas,
        )}
      >
        {/* Gagang geser: penanda visual khas bottom sheet, hanya di mobile */}
        <div className="sm:hidden pt-2.5 pb-1 grid place-items-center shrink-0" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>

        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-3 sm:pt-5 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 id={idJudul} className="text-[1.0625rem] font-extrabold text-ink leading-tight">
              {judul}
            </h2>
            {keterangan && (
              <p className="text-[0.8125rem] text-ink-3 mt-1 leading-snug">{keterangan}</p>
            )}
          </div>
          <TombolIkon label="Tutup" onClick={tutup} className="-mt-1.5 -mr-1.5">
            <IkonSilang size={20} />
          </TombolIkon>
        </div>

        <div className="px-4 sm:px-6 overflow-y-auto grow overscroll-contain">{children}</div>

        {kaki && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-line bg-surface-2 rounded-b-none sm:rounded-b-xl shrink-0 pb-aman">
            {kaki}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Dialog konfirmasi untuk aksi yang sulit dibatalkan.
 * Dipakai sebelum menyetujui kontrak, membatalkan pesanan, dan menghapus data.
 */
export function Konfirmasi({
  terbuka,
  tutup,
  judul,
  pesan,
  labelSetuju = 'Ya, lanjutkan',
  labelBatal = 'Batal',
  ragamSetuju = 'utama',
  onSetuju,
}: {
  terbuka: boolean
  tutup: () => void
  judul: string
  pesan: ReactNode
  labelSetuju?: string
  labelBatal?: string
  ragamSetuju?: 'utama' | 'bahaya'
  onSetuju: () => void
}) {
  return (
    <Lembar
      terbuka={terbuka}
      tutup={tutup}
      judul={judul}
      lebar="sempit"
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            {labelBatal}
          </Tombol>
          <Tombol
            ragam={ragamSetuju}
            penuh
            data-fokus-awal
            onClick={() => {
              onSetuju()
              tutup()
            }}
          >
            {labelSetuju}
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 text-[0.9375rem] text-ink-2 leading-relaxed">{pesan}</div>
    </Lembar>
  )
}
