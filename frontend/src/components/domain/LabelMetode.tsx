import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { IkonGrafik, IkonInfo } from '@/icons'
import { cx } from '@/lib/format'

/**
 * Nama metode analitik di atas halaman atau kartu yang memakai keluarannya.
 *
 * Revisi 23 Okt 2026: cukup nama metodenya, tanpa "Mesin 1/2/3" dan tanpa kotak
 * berisi daftar masukan. Penjelasannya muncul di gelembung: saat kursor di atas
 * label (hanya di perangkat yang punya hover; varian `hover:` Tailwind 4 sudah
 * dibatasi begitu), saat diketuk di HP, atau saat difokus papan ketik. Diketuk
 * lagi, diketuk di luar, atau Esc menutupnya.
 */
export function LabelMetode({
  metode,
  penjelasan,
  className,
}: {
  metode: string
  /** Dua sampai tiga kalimat berbahasa awam, tanpa rumus. */
  penjelasan: string
  className?: string
}) {
  const [buka, setBuka] = useState(false)
  const [rataKanan, setRataKanan] = useState(false)
  const id = useId()
  const wadah = useRef<HTMLSpanElement>(null)

  /* Sejak revisi V2 label ini sering duduk di kanan judul. Gelembung yang
     tertambat ke tepi kiri label lalu keluar layar, jadi ia dirata kanan bila
     dari kiri ia tidak muat. Diukur ulang saat layar berubah ukuran dan sesaat
     sebelum gelembung dibuka (disorot, difokus, diketuk). */
  const ukur = useCallback(() => {
    const r = wadah.current?.getBoundingClientRect()
    if (!r) return
    const lebarGelembung = Math.min(320, window.innerWidth - 32)
    setRataKanan(r.left + lebarGelembung > window.innerWidth - 16)
  }, [])
  useLayoutEffect(() => {
    ukur()
    window.addEventListener('resize', ukur)
    return () => window.removeEventListener('resize', ukur)
  }, [ukur])

  useEffect(() => {
    if (!buka) return
    function diLuar(e: PointerEvent) {
      if (!wadah.current?.contains(e.target as Node)) setBuka(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setBuka(false)
    }
    document.addEventListener('pointerdown', diLuar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', diLuar)
      document.removeEventListener('keydown', esc)
    }
  }, [buka])

  return (
    <span
      ref={wadah}
      onPointerEnter={ukur}
      onFocusCapture={ukur}
      className={cx('group relative inline-flex max-w-full', className)}
    >
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={buka}
        onClick={() => {
          ukur()
          setBuka((b) => !b)
        }}
        className={cx(
          'inline-flex items-center gap-1.5 min-h-11 max-w-full rounded-full px-3.5',
          'bg-brand-soft text-brand-soft-ink text-kecil font-semibold',
          'border border-brand/25 hover:border-brand transition-colors duration-150',
        )}
      >
        <IkonGrafik size={14} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 truncate">{metode}</span>
        <IkonInfo size={14} aria-hidden="true" className="shrink-0 opacity-70" />
      </button>
      {/* Selalu ada di DOM supaya aria-describedby terbaca pembaca layar,
          disembunyikan secara visual sampai dibuka. */}
      <span
        role="tooltip"
        id={id}
        className={cx(
          'absolute top-full z-40 mt-1.5 w-[min(20rem,calc(100vw-2rem))]',
          rataKanan ? 'right-0' : 'left-0',
          'rounded-md border border-line bg-surface p-3 shadow-e3',
          'text-isi font-normal text-ink-2 leading-relaxed',
          buka ? 'block' : 'hidden group-hover:block group-has-[:focus-visible]:block',
        )}
      >
        {penjelasan}
      </span>
    </span>
  )
}

/** Metode prakiraan pemakaian menurut kode model di tabel `prediksi`. Tanpa data server: model produksi. */
export function metodePrediksi(kode: string | null): { metode: string; penjelasan: string } {
  const k = (kode ?? 'lightgbm').toLowerCase()
  if (k.startsWith('lightgbm')) {
    return {
      metode: 'LightGBM',
      penjelasan:
        'Perkiraan disusun dari pola pemakaian harian tiap barang: hari dalam pekan, pemakaian pekan-pekan sebelumnya, serta tanggal gajian, libur nasional, dan Ramadan. Selain angka tengah, ditunjukkan juga rentang yang paling mungkin terjadi.',
    }
  }
  if (k.startsWith('sarima')) {
    return {
      metode: 'SARIMA',
      penjelasan:
        'Perkiraan disusun dari pola pemakaian harian yang berulang tiap pekan, ditambah tanggal gajian, libur nasional, dan Ramadan.',
    }
  }
  return {
    metode: 'ETS (Holt-Winters)',
    penjelasan: 'Perkiraan disusun dari pemakaian harian terbaru, dengan pola pekanan yang terus diperbarui.',
  }
}

/** Saran dan urutan distributor. */
export const METODE_SARAN = {
  metode: 'Thompson Sampling + fuzzy',
  penjelasan:
    'Distributor diurutkan dari catatan pesanan sebelumnya, yaitu seberapa sering tepat waktu, jumlahnya sesuai, dan barangnya baik, lalu ditimbang dengan harganya. Distributor yang catatannya masih sedikit sesekali ikut dicoba supaya punya kesempatan dinilai.',
}

/** Kelompok pelanggan di portal distributor. */
export const METODE_SEGMEN = {
  metode: 'K-Prototypes',
  penjelasan:
    'Pelanggan dikelompokkan dari kapan terakhir memesan, seberapa sering, nilai belanjanya, lama berlangganan, jenis usaha, dan barang yang paling sering dibeli. Pelanggan dengan pola yang mirip masuk satu kelompok.',
}
