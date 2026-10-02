import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { HanyaPembacaLayar } from '@/components/ui/dasar'
import { IkonPanahKanan, IkonPanahKiri } from '@/icons'
import { cx } from '@/lib/format'

/**
 * Korsel: deretan kartu yang digeser ke samping, satu kartu per langkah.
 *
 * Dua mode, dipilih per pemakaian:
 * - `otomatis` — berjalan sendiri (promo), tapi berhenti pada kesempatan
 *   pertama pengguna menunjukkan ia sedang membaca: saat kartunya disentuh,
 *   disorot tetikus, atau fokus keyboard masuk ke dalamnya, saat tab peramban
 *   tidak terlihat, dan selamanya begitu panahnya ditekan atau kartunya
 *   digeser. Ia TIDAK PERNAH berjalan kalau pengguna meminta gerak dikurangi
 *   (`prefers-reduced-motion`).
 * - manual — hanya bergeser kalau digeser atau tombol panahnya ditekan. Dipakai
 *   untuk daftar tugas: kartu yang berpindah sendiri bisa membuat tugas
 *   terlewat, atau tombol kartu lain tertekan saat ia sedang bergerak.
 *
 * Tidak ada tombol jeda: pemilik proyek memintanya dihapus supaya bilah
 * kendalinya bersih. Gantinya, sekali pengguna mengambil alih, korsel berhenti
 * dan tidak pernah berjalan sendiri lagi sampai halaman dibuka ulang.
 *
 * Titik penanda berada tepat di tengah bawah, panah di kedua tepinya. Titiknya
 * hiasan untuk mata; posisi "2 dari 5" dibawa teks pembaca layar dan oleh
 * `aria-label` tiap kartunya. Kalau semua kartu sudah muat di layar, panah dan
 * penandanya disembunyikan dan mode otomatis tidak berjalan — tidak ada yang
 * perlu digeser.
 */
export function Korsel({
  label,
  isi,
  kelasItem,
  otomatis = false,
  selang = 6000,
}: {
  /** Nama korsel untuk pembaca layar, mis. "Promo dari distributor". */
  label: string
  isi: Array<{ kunci: string; elemen: ReactNode }>
  /** Lebar satu kartu, mis. "w-[85%] sm:w-[20rem]". */
  kelasItem: string
  otomatis?: boolean
  /** Jeda antarlangkah dalam milidetik untuk mode otomatis. */
  selang?: number
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const [aktif, setAktif] = useState(0)
  const [bisaGeser, setBisaGeser] = useState(false)
  /** Pengguna sudah mengambil alih (menekan panah atau menggeser kartunya). */
  const [diambilAlih, setDiambilAlih] = useState(false)
  const [disentuh, setDisentuh] = useState(false)
  const [kurangiGerak, setKurangiGerak] = useState(false)
  const jumlah = isi.length

  /* Pantau apakah kartunya memang melebihi lebar wadah. */
  useEffect(() => {
    const el = wadah.current
    if (!el) return
    const ukur = () => setBisaGeser(el.scrollWidth - el.clientWidth > 4)
    ukur()
    const ro = new ResizeObserver(ukur)
    ro.observe(el)
    return () => ro.disconnect()
  }, [jumlah])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const ubah = () => setKurangiGerak(mq.matches)
    ubah()
    mq.addEventListener('change', ubah)
    return () => mq.removeEventListener('change', ubah)
  }, [])

  /* Kartu aktif = kartu yang tepi kirinya paling dekat dengan posisi gulir. */
  const bacaAktif = useCallback(() => {
    const el = wadah.current
    if (!el) return
    const anak = Array.from(el.children) as HTMLElement[]
    const awal = el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft || '0')
    let terdekat = 0
    let jarak = Infinity
    anak.forEach((a, i) => {
      const j = Math.abs(a.getBoundingClientRect().left - awal)
      if (j < jarak) {
        jarak = j
        terdekat = i
      }
    })
    // Sudah mentok kanan: kartu terakhir yang dianggap aktif, walau tepinya
    // tidak bisa lagi mencapai kiri wadah.
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) terdekat = anak.length - 1
    setAktif(terdekat)
  }, [])

  const keKartu = useCallback(
    (i: number) => {
      const el = wadah.current
      if (!el) return
      const tujuan = el.children[i] as HTMLElement | undefined
      if (!tujuan) return
      const geser = tujuan.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0')
      el.scrollTo({ left: geser, behavior: kurangiGerak ? 'auto' : 'smooth' })
    },
    [kurangiGerak],
  )

  /** Dipanggil saat pengguna menggeser atau menekan panah: korsel berhenti sendiri. */
  const ambilAlih = useCallback((i: number) => {
    setDiambilAlih(true)
    keKartu(i)
  }, [keKartu])

  const berjalan = otomatis && bisaGeser && !diambilAlih && !disentuh && !kurangiGerak

  useEffect(() => {
    if (!berjalan) return
    const t = window.setInterval(() => {
      if (document.hidden) return
      const el = wadah.current
      const mentok = el ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 : false
      keKartu(mentok ? 0 : (aktif + 1) % jumlah)
    }, selang)
    return () => window.clearInterval(t)
  }, [berjalan, aktif, jumlah, selang, keKartu])

  if (jumlah === 0) return null

  return (
    <div
      role="region"
      aria-roledescription="korsel"
      aria-label={label}
      onPointerEnter={() => setDisentuh(true)}
      onPointerLeave={() => setDisentuh(false)}
      onFocusCapture={() => setDisentuh(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDisentuh(false)
      }}
    >
      {/* Wadah gulirnya sendiri: tarikan tepi negatif hanya di layar sempit
          supaya kartu tidak terlihat terpotong paksa, dan badan halaman tetap
          tidak bergeser di 360px. */}
      <div
        ref={wadah}
        onScroll={bacaAktif}
        onTouchStart={() => {
          setDisentuh(true)
          setDiambilAlih(true)
        }}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {isi.map((x, i) => (
          <div
            key={x.kunci}
            role="group"
            aria-roledescription="kartu"
            aria-label={`${i + 1} dari ${jumlah}`}
            className={cx('snap-start shrink-0 [&>*]:h-full', kelasItem)}
          >
            {x.elemen}
          </div>
        ))}
      </div>

      {bisaGeser && (
        <div className="mt-2.5">
          {/* Tiga kolom: panah mengisi kedua tepi, titiknya di kolom tengah.
              Kedua panah berukuran sama, jadi titiknya jatuh tepat di tengah
              korsel, bukan sekadar di tengah sisa ruang. */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => ambilAlih(Math.max(0, aktif - 1))}
              disabled={aktif === 0}
              aria-label="Kartu sebelumnya"
              className="size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
            >
              <IkonPanahKiri size={18} />
            </button>

            <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
              {isi.map((x, i) => (
                <span
                  key={x.kunci}
                  className={cx(
                    'h-1.5 rounded-full transition-[width,background-color]',
                    i === aktif ? 'w-4 bg-brand' : 'w-1.5 bg-line-strong',
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => ambilAlih(Math.min(jumlah - 1, aktif + 1))}
              disabled={aktif >= jumlah - 1}
              aria-label="Kartu berikutnya"
              className="size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
            >
              <IkonPanahKanan size={18} />
            </button>
          </div>

          <HanyaPembacaLayar>
            Kartu {aktif + 1} dari {jumlah}.
          </HanyaPembacaLayar>
        </div>
      )}
    </div>
  )
}
