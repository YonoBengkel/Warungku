import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cx, inisial } from '@/lib/format'
import { NAV } from '@/lib/label'
import {
  IkonBeranda,
  IkonKotak,
  IkonToko,
  IkonPasokan,
  IkonLonceng,
  IkonKeranjang,
} from '@/icons'
import { useAplikasi, useJumlahKeranjang, useJumlahPerluTindakan } from '@/store/aplikasi'
import { Toast } from '@/components/ui/umpanBalik'

/**
 * Kerangka empat tab.
 *
 * Aturan yang dipegang:
 * - Item dan rute di mobile dan desktop sama persis. Tidak ada menu khusus
 *   desktop; kalau sebuah fitur hanya muat di desktop, fiturnya yang salah.
 * - Belanja tidak pernah menampilkan pesanan, Pesanan tidak pernah menampilkan
 *   katalog. Pemisahan ini yang membuat pertanyaan "pesanan saya sudah dikirim
 *   belum" selesai dalam satu ketukan.
 * - Akun ada di balik avatar, bukan tab kelima, karena ia dibuka sebulan sekali.
 */

const TAB = [
  { ke: '/beranda', label: NAV.beranda, Ikon: IkonBeranda },
  { ke: '/stok', label: NAV.stok, Ikon: IkonKotak },
  { ke: '/belanja', label: NAV.belanja, Ikon: IkonToko },
  { ke: '/pesanan', label: NAV.pesanan, Ikon: IkonPasokan },
]

/** Halaman detail tetap menyorot tab induknya, supaya pengguna tidak merasa tersesat. */
const INDUK: Array<[RegExp, string]> = [
  [/^\/(beranda)/, '/beranda'],
  [/^\/stok/, '/stok'],
  [/^\/(belanja|distributor|penawaran)/, '/belanja'],
  [/^\/(pesanan|kontrak|mitra)/, '/pesanan'],
]

export function tabInduk(pathname: string): string | null {
  for (const [pola, tab] of INDUK) if (pola.test(pathname)) return tab
  return null
}

export default function KerangkaAplikasi() {
  const { pathname } = useLocation()
  const profil = useAplikasi((s) => s.profil)
  const racun = useAplikasi((s) => s.racun)
  const tutupRacun = useAplikasi((s) => s.tutupRacun)
  const tema = useAplikasi((s) => s.tema)
  const perluTindakan = useJumlahPerluTindakan()
  const isiKeranjang = useJumlahKeranjang()
  const aktif = tabInduk(pathname)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'gelap')
  }, [tema])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh bg-bg lg:flex">
      <a href="#konten" className="skip-link">
        Langsung ke isi halaman
      </a>

      {/* Navigasi samping: hanya muncul di layar lebar, isinya sama persis */}
      <nav
        aria-label="Menu utama"
        className="hidden lg:flex lg:flex-col lg:shrink-0 lg:border-r lg:border-line lg:bg-surface lg:h-dvh lg:sticky lg:top-0"
        style={{ width: 'var(--rail-w)' }}
      >
        <div className="px-5 py-5">
          <Link to="/beranda" className="flex items-center gap-2.5">
            <span className="size-9 rounded-md bg-brand grid place-items-center text-ink-inverse font-extrabold text-[1rem]">
              W
            </span>
            <span className="font-extrabold text-ink text-[1.0625rem] tracking-tight">Warungku</span>
          </Link>
        </div>

        <div className="px-3 flex flex-col gap-1">
          {TAB.map(({ ke, label, Ikon }) => (
            <NavLink
              key={ke}
              to={ke}
              className={cx(
                'flex items-center gap-3 h-12 px-3 rounded-md font-semibold text-[0.9375rem] transition-colors',
                aktif === ke ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
              )}
            >
              <Ikon size={22} />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto p-3 border-t border-line">
          <Link
            to="/akun"
            className={cx(
              'flex items-center gap-3 p-2.5 rounded-md transition-colors',
              pathname.startsWith('/akun') ? 'bg-sunken' : 'hover:bg-sunken',
            )}
          >
            <span
              className="size-9 rounded-md grid place-items-center text-white font-extrabold text-[0.8125rem] shrink-0"
              style={{ background: profil.warna }}
            >
              {inisial(profil.namaUsaha)}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.875rem] font-bold text-ink truncate">{profil.namaUsaha}</span>
              <span className="block text-[0.75rem] text-ink-3 truncate">Lihat akun</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Kepala halaman global: tiga ikon tetap di semua tab */}
        <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line pt-aman">
          <div className="h-14 px-4 sm:px-6 flex items-center gap-2 max-w-[1400px] mx-auto w-full">
            <Link to="/beranda" className="lg:hidden flex items-center gap-2 mr-auto min-w-0 min-h-11 pr-2">
              <span className="size-8 rounded-md bg-brand grid place-items-center text-ink-inverse font-extrabold text-[0.875rem] shrink-0">
                W
              </span>
              <span className="font-extrabold text-ink text-[0.9375rem] truncate">{profil.namaUsaha}</span>
            </Link>
            <span className="hidden lg:block mr-auto" />

            <Link
              to="/notifikasi"
              aria-label={
                perluTindakan > 0 ? `Pemberitahuan, ${perluTindakan} butuh tindakan` : 'Pemberitahuan'
              }
              className="relative size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
            >
              <IkonLonceng size={22} />
              {perluTindakan > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
                  {perluTindakan}
                </span>
              )}
            </Link>

            <Link
              to="/keranjang"
              aria-label={isiKeranjang > 0 ? `Keranjang, ${isiKeranjang} barang` : 'Keranjang'}
              className="relative size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
            >
              <IkonKeranjang size={22} />
              {isiKeranjang > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
                  {isiKeranjang}
                </span>
              )}
            </Link>

            <Link
              to="/akun"
              aria-label="Akun"
              className="lg:hidden size-11 grid place-items-center rounded-md shrink-0"
            >
              <span
                className="size-9 rounded-md grid place-items-center text-white font-extrabold text-[0.8125rem]"
                style={{ background: profil.warna }}
              >
                {inisial(profil.namaUsaha)}
              </span>
            </Link>
          </div>
        </header>

        <main
          id="konten"
          className="flex-1 px-4 sm:px-6 pb-[calc(var(--nav-h)+1rem)] lg:pb-8 pt-4 max-w-[1400px] mx-auto w-full"
        >
          <Outlet />
        </main>
      </div>

      {/* Navigasi bawah: zona jempol, hanya di layar sempit */}
      <nav
        aria-label="Menu utama"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-aman"
      >
        <div className="flex">
          {TAB.map(({ ke, label, Ikon }) => {
            const terpilih = aktif === ke
            return (
              <NavLink
                key={ke}
                to={ke}
                aria-current={terpilih ? 'page' : undefined}
                className={cx(
                  'flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-[4.5rem]',
                  'transition-colors',
                  terpilih ? 'text-brand' : 'text-ink-3',
                )}
              >
                <Ikon size={24} strokeWidth={terpilih ? 2.1 : 1.75} />
                <span className={cx('text-[0.6875rem]', terpilih ? 'font-bold' : 'font-semibold')}>{label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Pemberitahuan singkat */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--nav-h)+1rem)] lg:bottom-6 z-50 flex flex-col gap-2 w-[min(30rem,calc(100vw-2rem))] pointer-events-none">
        {racun.map((r) => (
          <Toast key={r.id} pesan={r.pesan} nada={r.nada} tutup={() => tutupRacun(r.id)} />
        ))}
      </div>
    </div>
  )
}
