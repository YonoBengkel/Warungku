import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/lib/format'

/* Perangkat bertetikus dengan layar cukup lebar. Di sana penyaring memakai menu
   tarik-turun; di HP dan tablet sentuh tetap lembar bawah, karena tidak ada
   kursor yang bisa diarahkan (revisi V2, Q49). */
const KUERI_TETIKUS = '(hover: hover) and (pointer: fine) and (min-width: 640px)'

export function usePakaiMenuTarik(): boolean {
  const [cocok, setCocok] = useState(() => window.matchMedia(KUERI_TETIKUS).matches)
  useEffect(() => {
    const mq = window.matchMedia(KUERI_TETIKUS)
    const ubah = () => setCocok(mq.matches)
    ubah()
    mq.addEventListener('change', ubah)
    return () => mq.removeEventListener('change', ubah)
  }, [])
  return cocok
}

/**
 * Menu tarik-turun untuk penyaring di desktop (revisi V2, Q49 dan Q56).
 *
 * Terbuka saat kursor diarahkan ke pemicunya (jeda 150 ms supaya tidak terbuka
 * saat kursor sekadar lewat), saat pemicunya diklik, atau saat ditekan Enter.
 * Tertutup saat kursor pergi (jeda 250 ms, cukup untuk menyeberang ke isinya),
 * saat Esc ditekan (fokus kembali ke pemicu), saat mengetuk di luar, saat fokus
 * keyboard keluar, dan setelah memilih (halaman memanggil `ubahBuka(false)`).
 *
 * Keadaan buka-tutupnya milik halaman, supaya satu keadaan yang sama bisa
 * membuka menu ini di desktop atau Lembar di HP.
 */
export function MenuTarik({
  buka,
  ubahBuka,
  label,
  isi,
  rata = 'kiri',
  className,
  children,
}: {
  buka: boolean
  ubahBuka: (buka: boolean) => void
  /** Nama panelnya untuk pembaca layar. */
  label: string
  isi: ReactNode
  rata?: 'kiri' | 'kanan'
  className?: string
  /** Pemicunya: chip atau tombol yang onClick-nya membalik `buka`. */
  children: ReactNode
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const jeda = useRef<number | undefined>(undefined)

  function setelah(nilai: boolean, ms: number) {
    window.clearTimeout(jeda.current)
    jeda.current = window.setTimeout(() => ubahBuka(nilai), ms)
  }
  useEffect(() => () => window.clearTimeout(jeda.current), [])

  useEffect(() => {
    if (!buka) return
    function diLuar(e: PointerEvent) {
      if (!wadah.current?.contains(e.target as Node)) ubahBuka(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      ubahBuka(false)
      wadah.current?.querySelector<HTMLElement>('button, a')?.focus()
    }
    document.addEventListener('pointerdown', diLuar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', diLuar)
      document.removeEventListener('keydown', esc)
    }
  }, [buka, ubahBuka])

  return (
    <div
      ref={wadah}
      className={cx('relative', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setelah(true, 150)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setelah(false, 250)}
      onBlurCapture={(e) => {
        if (buka && !e.currentTarget.contains(e.relatedTarget as Node | null)) ubahBuka(false)
      }}
      onClickCapture={(e) => {
        /* Kursor biasanya menyorot dulu baru mengklik. Klik tetikus pada pemicu
           saat menu sudah terbuka karena disorot tidak boleh menutupnya lagi;
           Enter dari papan ketik (detail 0) tetap membuka dan menutup. */
        if (buka && e.detail > 0 && !panel.current?.contains(e.target as Node)) {
          e.stopPropagation()
          e.preventDefault()
        }
      }}
    >
      {children}
      {buka && (
        /* Padding atas, bukan margin: celahnya ikut menjadi bagian menu, jadi
           kursor yang menyeberang dari pemicu ke isi tidak menutupnya. */
        <div ref={panel} className={cx('absolute top-full z-40 pt-2', rata === 'kanan' ? 'right-0' : 'left-0')}>
          <div
            role="dialog"
            aria-label={label}
            className="w-[21rem] max-h-[min(32rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-2 shadow-e3 anim-muncul"
          >
            {isi}
          </div>
        </div>
      )}
    </div>
  )
}
