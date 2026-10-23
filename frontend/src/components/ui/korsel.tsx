import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { HanyaPembacaLayar } from '@/components/ui/dasar'
import { IkonPanahKanan, IkonPanahKiri } from '@/icons'
import { cx } from '@/lib/format'

/** Lama satu geseran halaman (revisi 23 Okt: 300 ms). */
const LAMA_GESER = 300

/** Kurva keluar, sejalan dengan `cubic-bezier(0.22, 1, 0.36, 1)` di DESIGN.md bagian 7. */
const kurva = (p: number) => 1 - Math.pow(1 - p, 4)

/**
 * Korsel: deretan kartu yang digeser ke samping, satu HALAMAN per langkah.
 *
 * Satu halaman = kartu yang muat sekaligus di wadahnya (3 di desktop, 1 di HP
 * untuk promo Beranda). Panah, titik penanda, geseran jari, tarikan tetikus,
 * dan putaran otomatis semuanya berpindah per halaman. Titik jangkar gulir
 * (`snap-start`) hanya dipasang di kartu pertama tiap halaman, jadi geseran
 * jari pun berhenti per halaman. Halaman terakhir yang tidak penuh dijepit ke
 * ujung kanan, dan posisi halaman dihitung dari ukuran nyata, bukan nomor kartu:
 * dulu kartu aktif dipaksa menjadi kartu terakhir saat mentok kanan, sehingga
 * panah kiri menuju kartu yang sudah terlihat dan tidak bergerak sama sekali.
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
 * Tata letak kendali: tanpa `judul`, panah mengapit titik penanda di bawah.
 * Dengan `judul`, panah ‹ › pindah ke pojok kanan atas sebaris judul (pola
 * wadah promo), titiknya tetap di tengah bawah. Titiknya hiasan untuk mata;
 * posisi "halaman 2 dari 3" dibawa teks pembaca layar dan `aria-label` tiap
 * kartunya. Kalau semua kartu sudah muat, panah dan penanda disembunyikan dan
 * mode otomatis tidak berjalan.
 */
export function Korsel({
  label,
  isi,
  kelasItem,
  otomatis = false,
  selang = 3000,
  judul,
  nada = 'biasa',
}: {
  /** Nama korsel untuk pembaca layar, mis. "Promo dari distributor". */
  label: string
  isi: Array<{ kunci: string; elemen: ReactNode }>
  /** Lebar satu kartu, mis. "w-[85%] sm:w-[20rem]". */
  kelasItem: string
  otomatis?: boolean
  /** Jeda antarhalaman dalam milidetik untuk mode otomatis. */
  selang?: number
  /** Judul di kiri atas; panah lalu tampil di pojok kanan atas. */
  judul?: ReactNode
  /** `aksen`: korsel di dalam wadah coral, panahnya bulat putih. */
  nada?: 'biasa' | 'aksen'
}) {
  const wadah = useRef<HTMLDivElement>(null)
  /** Posisi gulir awal tiap halaman, dalam piksel. */
  const [halaman, setHalaman] = useState<number[]>([0])
  const halamanRef = useRef<number[]>([0])
  const [perHalaman, setPerHalaman] = useState(1)
  const [aktif, setAktif] = useState(0)
  /** Pengguna sudah mengambil alih (menekan panah, menggeser, atau menarik). */
  const [diambilAlih, setDiambilAlih] = useState(false)
  const [disentuh, setDisentuh] = useState(false)
  const [menyeret, setMenyeret] = useState(false)
  const [kurangiGerak, setKurangiGerak] = useState(false)
  const animasi = useRef<number | null>(null)
  const penutupAnimasi = useRef<number | null>(null)
  const seret = useRef<{ x: number; kiri: number; id: number; jalan: boolean; dari: number } | null>(null)
  const baruDiseret = useRef(false)
  const jumlah = isi.length
  const jumlahHalaman = halaman.length
  const bisaGeser = jumlahHalaman > 1

  /* Ukur ulang halaman setiap kali lebar wadah atau jumlah kartu berubah. */
  useEffect(() => {
    const el = wadah.current
    if (!el) return
    const ukur = () => {
      const anak = Array.from(el.children) as HTMLElement[]
      const lebarKartu = anak[0]?.getBoundingClientRect().width ?? 0
      // Wadah tersembunyi (mis. korsel tugas di desktop): biarkan satu halaman.
      if (lebarKartu <= 0) {
        halamanRef.current = [0]
        setHalaman([0])
        return
      }
      const gaya = getComputedStyle(el)
      const padKiri = parseFloat(gaya.paddingLeft) || 0
      const ruang = el.clientWidth - padKiri - (parseFloat(gaya.paddingRight) || 0)
      const celah = parseFloat(gaya.columnGap) || 0
      const per = Math.max(1, Math.floor((ruang + celah + 1) / (lebarKartu + celah)))
      const maks = Math.max(0, el.scrollWidth - el.clientWidth)
      const kiriWadah = el.getBoundingClientRect().left
      const posisi: number[] = []
      for (let i = 0; i < anak.length; i += per) {
        const x = anak[i].getBoundingClientRect().left - kiriWadah + el.scrollLeft - padKiri
        const dijepit = Math.min(maks, Math.max(0, x))
        if (posisi.length === 0 || dijepit - posisi[posisi.length - 1] > 4) posisi.push(dijepit)
      }
      halamanRef.current = posisi
      setHalaman(posisi)
      setPerHalaman(per)
    }
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

  useEffect(() => () => {
    if (animasi.current) cancelAnimationFrame(animasi.current)
    if (penutupAnimasi.current) window.clearTimeout(penutupAnimasi.current)
  }, [])

  /* Halaman aktif = halaman yang posisi awalnya paling dekat dengan posisi gulir. */
  const bacaAktif = useCallback(() => {
    const el = wadah.current
    if (!el) return
    const x = el.scrollLeft
    let terdekat = 0
    let jarak = Infinity
    halamanRef.current.forEach((h, i) => {
      const j = Math.abs(h - x)
      if (j < jarak) {
        jarak = j
        terdekat = i
      }
    })
    setAktif(terdekat)
  }, [])

  const hentikanAnimasi = useCallback(() => {
    if (animasi.current) {
      cancelAnimationFrame(animasi.current)
      animasi.current = null
    }
    if (penutupAnimasi.current) {
      window.clearTimeout(penutupAnimasi.current)
      penutupAnimasi.current = null
    }
    if (wadah.current) wadah.current.style.scrollSnapType = ''
  }, [])

  /* Gulir sendiri, bukan `behavior: 'smooth'`: lama geseran bawaan peramban
     berbeda-beda, sedangkan revisi meminta 300 ms. Jangkar gulir dilepas selama
     animasi supaya tiap langkah kecil tidak ditarik balik ke kartu terdekat. */
  const keHalaman = useCallback(
    (i: number) => {
      const el = wadah.current
      const posisi = halamanRef.current
      if (!el || posisi.length === 0) return
      const indeks = Math.min(posisi.length - 1, Math.max(0, i))
      const tujuan = posisi[indeks]
      // Penanda langsung pindah; event gulir menyusul dan menyetujuinya.
      setAktif(indeks)
      hentikanAnimasi()
      // Tab tersembunyi tidak menjalankan requestAnimationFrame: langsung lompat.
      if (kurangiGerak || document.hidden) {
        el.scrollLeft = tujuan
        return
      }
      const awal = el.scrollLeft
      const beda = tujuan - awal
      if (Math.abs(beda) < 1) return
      el.style.scrollSnapType = 'none'
      const mulai = performance.now()
      const langkah = (t: number) => {
        const p = Math.min(1, (t - mulai) / LAMA_GESER)
        el.scrollLeft = awal + beda * kurva(p)
        if (p < 1) {
          animasi.current = requestAnimationFrame(langkah)
        } else {
          hentikanAnimasi()
        }
      }
      animasi.current = requestAnimationFrame(langkah)
      // Peramban yang menjarangkan bingkai (hemat daya, jendela tertutup) tetap
      // sampai di halaman tujuan tepat waktu.
      penutupAnimasi.current = window.setTimeout(() => {
        el.scrollLeft = tujuan
        hentikanAnimasi()
      }, LAMA_GESER + 60)
    },
    [kurangiGerak, hentikanAnimasi],
  )

  /** Dipanggil saat pengguna menekan panah: korsel berhenti sendiri. */
  const ambilAlih = useCallback(
    (i: number) => {
      setDiambilAlih(true)
      keHalaman(i)
    },
    [keHalaman],
  )

  const berjalan = otomatis && bisaGeser && !diambilAlih && !disentuh && !kurangiGerak

  useEffect(() => {
    if (!berjalan) return
    const t = window.setTimeout(() => {
      if (document.hidden) return
      keHalaman((aktif + 1) % jumlahHalaman)
    }, selang)
    return () => window.clearTimeout(t)
  }, [berjalan, aktif, jumlahHalaman, selang, keHalaman])

  /* Tarikan tetikus di desktop. Penangkapan penunjuk baru dipasang setelah
     tetikus bergerak lebih dari 6px, supaya klik biasa tetap sampai ke tombol
     dan tautan di dalam kartu. */
  const selesaiSeret = (clientX: number) => {
    const s = seret.current
    seret.current = null
    const el = wadah.current
    if (!s || !s.jalan || !el) return
    baruDiseret.current = true
    window.setTimeout(() => {
      baruDiseret.current = false
    }, 0)
    setMenyeret(false)
    const dx = clientX - s.x
    const ambang = Math.min(80, el.clientWidth * 0.15)
    const n = halamanRef.current.length
    const tujuan = dx < -ambang ? Math.min(n - 1, s.dari + 1) : dx > ambang ? Math.max(0, s.dari - 1) : s.dari
    keHalaman(tujuan)
  }

  if (jumlah === 0) return null

  const panah = (arah: 'kiri' | 'kanan') => {
    const kiri = arah === 'kiri'
    return (
      <button
        type="button"
        onClick={() => ambilAlih(kiri ? aktif - 1 : aktif + 1)}
        disabled={kiri ? aktif === 0 : aktif >= jumlahHalaman - 1}
        aria-label={kiri ? 'Kartu sebelumnya' : 'Kartu berikutnya'}
        className={cx(
          'size-11 grid place-items-center disabled:pointer-events-none transition-colors',
          nada === 'aksen'
            ? 'rounded-full bg-surface text-ink shadow-e1 hover:bg-surface-2 disabled:opacity-50'
            : 'rounded-md text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30',
        )}
      >
        {kiri ? <IkonPanahKiri size={18} /> : <IkonPanahKanan size={18} />}
      </button>
    )
  }

  const titik = (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {halaman.map((_, i) => (
        <span
          key={i}
          className={cx(
            'h-1.5 rounded-full transition-[width,background-color]',
            i === aktif
              ? cx('w-4', nada === 'aksen' ? 'bg-aksen-ink' : 'bg-brand')
              : cx('w-1.5', nada === 'aksen' ? 'bg-aksen-ink/30' : 'bg-line-strong'),
          )}
        />
      ))}
    </div>
  )

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
      {judul && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">{judul}</div>
          {bisaGeser && (
            <div className="flex shrink-0 gap-2">
              {panah('kiri')}
              {panah('kanan')}
            </div>
          )}
        </div>
      )}

      {/* Wadah gulirnya sendiri: tarikan tepi negatif hanya di layar sempit
          supaya kartu tidak terlihat terpotong paksa, dan badan halaman tetap
          tidak bergeser di 360px. `scroll-px-4` menggeser titik jangkar ke tepi
          isi yang sama. */}
      <div
        ref={wadah}
        onScroll={bacaAktif}
        onTouchStart={() => {
          hentikanAnimasi()
          setDisentuh(true)
          setDiambilAlih(true)
        }}
        onWheel={hentikanAnimasi}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0 || !bisaGeser || !wadah.current) return
          hentikanAnimasi()
          seret.current = { x: e.clientX, kiri: wadah.current.scrollLeft, id: e.pointerId, jalan: false, dari: aktif }
        }}
        onPointerMove={(e) => {
          const s = seret.current
          const el = wadah.current
          if (!s || !el || e.pointerId !== s.id) return
          const dx = e.clientX - s.x
          if (!s.jalan) {
            if (Math.abs(dx) < 6) return
            s.jalan = true
            try {
              el.setPointerCapture(e.pointerId)
            } catch {
              // Penunjuk sudah lepas sebelum sempat ditangkap; tarikan tetap jalan.
            }
            el.style.scrollSnapType = 'none'
            setMenyeret(true)
            setDiambilAlih(true)
          }
          el.scrollLeft = s.kiri - dx
        }}
        onPointerUp={(e) => selesaiSeret(e.clientX)}
        onPointerCancel={(e) => selesaiSeret(e.clientX)}
        onClickCapture={(e) => {
          if (baruDiseret.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        className={cx(
          'flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0',
          bisaGeser && '[@media(pointer:fine)]:cursor-grab',
          menyeret && 'cursor-grabbing select-none',
        )}
      >
        {isi.map((x, i) => (
          <div
            key={x.kunci}
            role="group"
            aria-roledescription="kartu"
            aria-label={`${i + 1} dari ${jumlah}`}
            className={cx('shrink-0 [&>*]:h-full', i % perHalaman === 0 && 'snap-start', kelasItem)}
          >
            {x.elemen}
          </div>
        ))}
      </div>

      {bisaGeser && (
        <div className="mt-2.5">
          {judul ? (
            <div className="py-1.5">{titik}</div>
          ) : (
            /* Tiga kolom: panah mengisi kedua tepi, titiknya di kolom tengah.
               Kedua panah berukuran sama, jadi titiknya jatuh tepat di tengah
               korsel, bukan sekadar di tengah sisa ruang. */
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              {panah('kiri')}
              {titik}
              {panah('kanan')}
            </div>
          )}

          <HanyaPembacaLayar>
            Halaman {aktif + 1} dari {jumlahHalaman}.
          </HanyaPembacaLayar>
        </div>
      )}
    </div>
  )
}
