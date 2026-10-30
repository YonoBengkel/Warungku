import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/lib/format'
import { Avatar } from '@/components/ui/dasar'
import { TandaMerek } from '@/components/ui/Merek'

/**
 * Menu samping desktop untuk kedua portal (revisi V5, Q111): rancangan teman
 * Ilham (`referensi/Revisi 30 Oct V5/SIdebar.html`) yang disesuaikan ke token.
 *
 * - Sejak revisi V6 (Q122, Q129) latarnya lavender terang dengan teks ungu tua,
 *   dan menu aktif ditandai pil jingga terang bertinta gelap di dalam tab
 *   sewarna latar halaman yang berlengkung cekung, bentuk dari rancangan itu.
 * - Tab dan pil itu satu penanda yang bergeser antarmenu, meniru saklar situs
 *   portofolio Ilham (Q121): posisinya diukur dari menu tujuan, dan ia sudah
 *   berangkat begitu menu diklik, sebelum halaman barunya siap. Menu tambahan di
 *   bawah garis pemisah ikut terjangkau. Gerak dikurangi mematikan geraknya.
 * - Kartu akun di dasar menu.
 *
 * Di HP menu ini tidak tampil; kedua kerangka tetap memakai bilah bawah.
 */

type Ikon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

export interface ButirMenuSamping {
  ke: string
  label: string
  Ikon: Ikon
  aktif: boolean
  /** Angka kecil di kanan label, mis. isi keranjang atau pesanan menunggu. */
  angka?: number
  labelAngka?: string
  nadaAngka?: 'kritis' | 'merek'
}

export function MenuSamping({
  label,
  merekKe,
  subjudul,
  utama,
  tambahan,
  akun,
  sembunyi,
}: {
  label: string
  merekKe: string
  subjudul?: string
  utama: ButirMenuSamping[]
  tambahan: ButirMenuSamping[]
  akun: { ke: string; nama: string; warna: string; aktif: boolean }
  /** Halaman fokus (pemberitahuan) tampil tanpa menu samping. */
  sembunyi?: boolean
}) {
  const wadahRef = useRef<HTMLDivElement>(null)
  const butirRef = useRef(new Map<string, HTMLAnchorElement>())
  const [posisi, setPosisi] = useState<{ y: number; tinggi: number } | null>(null)
  const [gerak, setGerak] = useState(false)
  const keAktif = [...utama, ...tambahan].find((b) => b.aktif)?.ke ?? null
  /* Menu yang baru diklik. Penanda langsung berangkat ke sana; begitu alamatnya
     berganti (atau klik itu batal), menu aktif dari kerangka yang dipakai lagi. */
  const [tujuan, setTujuan] = useState<{ ke: string; dari: string | null } | null>(null)
  const keTampil = tujuan && tujuan.dari === keAktif ? tujuan.ke : keAktif
  // Tujuan lama dibuang begitu menu aktif berganti, supaya tidak hidup lagi
  // saat pengguna kembali ke halaman asal lewat tautan lain.
  useEffect(() => setTujuan(null), [keAktif])

  useLayoutEffect(() => {
    const wadah = wadahRef.current
    if (!wadah) return
    const ukur = () => {
      const el = keTampil ? butirRef.current.get(keTampil) : null
      if (!el) {
        setPosisi(null)
        return
      }
      const a = el.getBoundingClientRect()
      const w = wadah.getBoundingClientRect()
      setPosisi({ y: a.top - w.top, tinggi: a.height })
    }
    ukur()
    // Huruf yang baru termuat atau ukuran layar yang berubah menggeser menu.
    const pengamat = new ResizeObserver(ukur)
    pengamat.observe(wadah)
    return () => pengamat.disconnect()
  }, [keTampil, sembunyi])

  // Posisi pertama dipasang tanpa gerak; sesudahnya penanda bergeser halus.
  useEffect(() => {
    if (!posisi || gerak) return
    const id = requestAnimationFrame(() => setGerak(true))
    return () => cancelAnimationFrame(id)
  }, [posisi, gerak])

  const daftar = (isi: ButirMenuSamping[]) =>
    isi.map((b) => {
      // Rupa aktif mengikuti penanda (termasuk menu yang baru diklik); yang
      // dibacakan sebagai halaman ini tetap alamat sebenarnya.
      const tampilAktif = b.ke === keTampil
      return (
        <li key={b.ke}>
          <Link
            to={b.ke}
            ref={(el) => {
              if (el) butirRef.current.set(b.ke, el)
              else butirRef.current.delete(b.ke)
            }}
            onClick={(e) => {
              // Klik dengan tombol pengubah membuka tab baru: halaman ini tetap.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              setTujuan({ ke: b.ke, dari: keAktif })
            }}
            aria-current={b.aktif ? 'page' : undefined}
            aria-label={b.angka ? `${b.label}, ${b.labelAngka ?? b.angka}` : undefined}
            className="group relative z-10 block py-1 pl-1 rounded-l-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-samping-ink"
          >
            <span
              className={cx(
                'flex items-center gap-3.5 h-9 px-3.5 rounded-lg text-kartu transition-[background-color,color,translate] duration-200',
                tampilAktif
                  ? 'font-bold text-pil-ink'
                  : 'font-semibold text-samping-ink group-hover:bg-samping-hover group-hover:translate-x-[3px]',
              )}
            >
              <b.Ikon
                size={21}
                className={cx('shrink-0 transition-[scale] duration-200', !tampilAktif && 'group-hover:scale-110')}
              />
              <span className="grow min-w-0 truncate">{b.label}</span>
              {b.angka !== undefined && b.angka > 0 && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'min-w-5 h-5 px-1.5 rounded-full text-[0.6875rem] font-bold grid place-items-center tabular',
                    b.nadaAngka === 'kritis' ? 'bg-kritis text-ink-inverse' : 'bg-brand text-ink-inverse',
                  )}
                >
                  {b.angka > 99 ? '99+' : b.angka}
                </span>
              )}
            </span>
          </Link>
        </li>
      )
    })

  return (
    <nav
      aria-label={label}
      className={cx(
        'hidden',
        !sembunyi && 'menu-samping lg:flex lg:flex-col lg:shrink-0 lg:h-dvh lg:sticky lg:top-0 pt-5 pb-4 pl-3.5',
      )}
      style={{ width: 'var(--rail-w)' }}
    >
      <Link
        to={merekKe}
        className="flex items-center gap-3 pr-3.5 pb-6 pt-1 min-w-0 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-samping-ink"
      >
        <span className="size-13 shrink-0 rounded-lg bg-surface grid place-items-center shadow-e3">
          <TandaMerek ukuran={38} />
        </span>
        <span className="min-w-0">
          <span className="block text-judul font-extrabold text-samping-ink leading-tight truncate">Turnify Flow</span>
          {subjudul && <span className="block text-kecil text-samping-ink-2 truncate">{subjudul}</span>}
        </span>
      </Link>

      <div ref={wadahRef} className="relative">
        {posisi && (
          <div
            aria-hidden="true"
            className={cx('penanda-samping', gerak && 'penanda-samping-gerak')}
            style={{ transform: `translateY(${posisi.y}px)`, height: posisi.tinggi }}
          >
            <span className="penanda-samping-pil" />
          </div>
        )}
        <ul className="flex flex-col gap-1.5">{daftar(utama)}</ul>
        {tambahan.length > 0 && (
          <>
            <div className="h-px bg-samping-garis my-4 ml-2.5 mr-3.5" />
            <ul className="flex flex-col gap-1.5">{daftar(tambahan)}</ul>
          </>
        )}
      </div>

      <Link
        to={akun.ke}
        aria-current={akun.aktif ? 'page' : undefined}
        className="kartu-akun-samping mt-auto mr-3.5 flex items-center gap-3 p-3 rounded-xl min-w-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-samping-ink"
      >
        <span className="size-11 shrink-0 rounded-full bg-surface grid place-items-center shadow-e2">
          <Avatar nama={akun.nama} warna={akun.warna} ukuran={36} />
        </span>
        <span className="min-w-0">
          {/* Nama toko boleh dua baris: "Sumber Tani Nusantara" tidak muat satu baris. */}
          <span className="block text-kartu font-bold text-akun-samping-ink leading-snug line-clamp-2">{akun.nama}</span>
          <span className="block text-kecil text-akun-samping-ink-2 truncate">Lihat akun</span>
        </span>
      </Link>
    </nav>
  )
}
