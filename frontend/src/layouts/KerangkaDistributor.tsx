import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cx } from '@/lib/format'
import { NAV_DISTRIBUTOR } from '@/lib/label'
import {
  IkonBeranda,
  IkonBintang,
  IkonGrafik,
  IkonKontrak,
  IkonLonceng,
  IkonPasokan,
  IkonToko,
} from '@/icons'
import { useAplikasi, useDistributorAktif, useJumlahPerluKonfirmasi } from '@/store/aplikasi'
import { Toast } from '@/components/ui/umpanBalik'
import { Avatar } from '@/components/ui/dasar'
import { TandaMerek } from '@/components/ui/Merek'
import { LoncengMelayang, usePemberitahuanDistributor } from '@/components/domain/Pemberitahuan'
import { TautanSamping } from '@/components/ui/navigasi'

/**
 * Kerangka Portal Distributor: sistem desain yang sama dengan KerangkaAplikasi.
 *
 * Bentuknya sengaja meniru sisi UMKM (navigasi samping di layar lebar, bilah
 * bawah di layar sempit, kepala halaman yang tetap) supaya orang yang sudah
 * hafal satu sisi tidak perlu belajar ulang di sisi lain. Sejak revisi V4
 * (Q93) akun toko juga ditaruh seperti di UMKM: blok akun di kiri bawah menu
 * samping dan logo toko di bilah atas HP, bukan tab Profil di menu utama. Yang
 * beda hanya isinya: tidak ada keranjang, karena distributor tidak berbelanja.
 */

const TAB = [
  { ke: '/distributor-portal', label: NAV_DISTRIBUTOR.dashboard, Ikon: IkonBeranda },
  { ke: '/distributor-portal/pesanan', label: NAV_DISTRIBUTOR.pesanan, Ikon: IkonPasokan },
  { ke: '/distributor-portal/kontrak', label: NAV_DISTRIBUTOR.kontrak, Ikon: IkonKontrak },
  { ke: '/distributor-portal/promo', label: NAV_DISTRIBUTOR.promo, Ikon: IkonBintang },
  { ke: '/distributor-portal/pelanggan', label: NAV_DISTRIBUTOR.pelanggan, Ikon: IkonToko },
]

/**
 * Dashboard adalah rute indeks, jadi ia hanya aktif kalau pathname-nya persis
 * itu. Tiga tab lain justru harus tetap menyala saat pengguna berada di halaman
 * turunannya (mis. detail satu pesanan), tapi pencocokannya berhenti di batas
 * ruas rute supaya `/…/pesanan-lama` tidak ikut menyalakan tab Pesanan.
 */
export function tabDistributorAktif(pathname: string, ke: string): boolean {
  if (ke === '/distributor-portal') return pathname === '/distributor-portal' || pathname === '/distributor-portal/'
  /* Lacak Pesanan dibuka dari halaman Pesanan Masuk dan tidak punya menu sendiri
     lagi (revisi V3, Q74), jadi menu Pesanan yang menyala di sana. */
  if (ke === '/distributor-portal/pesanan' && tabDistributorAktif(pathname, '/distributor-portal/lacak')) return true
  return pathname === ke || pathname.startsWith(`${ke}/`)
}

export default function KerangkaDistributor() {
  const { pathname } = useLocation()
  const racun = useAplikasi((s) => s.racun)
  const tutupRacun = useAplikasi((s) => s.tutupRacun)
  const perluKonfirmasi = useJumlahPerluKonfirmasi()
  const pemberitahuan = usePemberitahuanDistributor()
  const distributor = useDistributorAktif()
  const jumlahTindakan = pemberitahuan.filter((b) => b.perluTindakan).length
  /* Sama dengan portal usaha (revisi V2, Q58): halaman pemberitahuan tanpa menu
     samping di desktop, dan lonceng melayang disembunyikan di sana. */
  const fokus = pathname.startsWith('/distributor-portal/pemberitahuan')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="kerangka-distributor min-h-dvh bg-bg lg:flex">
      <a href="#konten" className="skip-link">
        Langsung ke isi halaman
      </a>

      {/* Navigasi samping: hanya muncul di layar lebar, isinya sama persis */}
      <nav
        aria-label="Menu portal distributor"
        className={cx(
          'hidden',
          !fokus && 'lg:flex lg:flex-col lg:shrink-0 lg:border-r lg:border-line lg:bg-surface lg:h-dvh lg:sticky lg:top-0',
        )}
        style={{ width: 'var(--rail-w)' }}
      >
        {/* Merek aplikasi di atas, nama toko di blok akun bawah (revisi V4, Q93) */}
        <div className="px-5 py-5">
          <Link to="/distributor-portal" className="flex items-center gap-2.5 min-w-0">
            <TandaMerek ukuran={36} />
            <span className="min-w-0">
              <span className="block font-extrabold text-ink text-subjudul tracking-tight leading-tight">Turnify Flow</span>
              <span className="block text-kecil text-ink-3">Portal Distributor</span>
            </span>
          </Link>
        </div>

        <div className="px-3 flex flex-col gap-1">
          {TAB.map(({ ke, label, Ikon }) => {
            const terpilih = tabDistributorAktif(pathname, ke)
            return (
              <NavLink
                key={ke}
                to={ke}
                end={ke === '/distributor-portal'}
                className={cx(
                  'flex items-center gap-3 h-12 px-3 rounded-md font-semibold text-kartu transition-colors',
                  terpilih
                    ? 'bg-brand-soft text-brand-soft-ink'
                    : 'text-ink-2 hover:bg-sunken hover:text-ink',
                )}
              >
                <Ikon size={22} />
                <span className="grow">{label}</span>
                {/* Angka pesanan yang menunggu dijawab, langsung di menunya. */}
                {ke === '/distributor-portal/pesanan' && perluKonfirmasi > 0 && (
                  <span
                    aria-label={`${perluKonfirmasi} menunggu konfirmasi`}
                    className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular"
                  >
                    {perluKonfirmasi}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Ringkasan Penjualan (revisi 23 Okt). Pemberitahuan tidak lagi di sini:
            lonceng melayang di pojok kanan atas (revisi V2). Lacak Pesanan juga
            tidak: ia dibuka dari halaman Pesanan Masuk (revisi V3, Q74). */}
        <div className="mt-3 mx-3 pt-3 border-t border-line flex flex-col gap-1">
          <TautanSamping
            ke="/distributor-portal/penjualan"
            aktif={pathname.startsWith('/distributor-portal/penjualan')}
            Ikon={IkonGrafik}
            label="Ringkasan Penjualan"
          />
        </div>

        {/* Blok akun seperti di portal usaha: pintu ke halaman akun, yang kini
            juga memuat alat uji purwarupa dari pita kuning yang lama. */}
        <div className="mt-auto p-3 border-t border-line">
          <Link
            to="/distributor-portal/profil"
            className={cx(
              'flex items-center gap-3 p-2.5 rounded-md transition-colors',
              pathname.startsWith('/distributor-portal/profil') ? 'bg-sunken' : 'hover:bg-sunken',
            )}
          >
            <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={36} />
            <span className="min-w-0">
              <span className="block text-isi font-bold text-ink truncate">{distributor.nama}</span>
              <span className="block text-kecil text-ink-3 truncate">Lihat akun</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Kepala halaman: siapa yang sedang dilihat, dan apa yang menunggu */}
        <header className="lg:hidden sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line pt-aman">
          <div className="h-14 px-4 sm:px-6 flex items-center gap-2 max-w-[1400px] mx-auto w-full">
            <Link
              to="/distributor-portal"
              className="flex items-center gap-2 mr-auto min-w-0 min-h-11 pr-2"
            >
              <TandaMerek ukuran={32} />
              <span className="font-extrabold text-ink text-kartu truncate">Turnify Flow</span>
            </Link>

            <Link
              to="/distributor-portal/pemberitahuan"
              aria-label={jumlahTindakan > 0 ? `Pemberitahuan, ${jumlahTindakan} butuh tindakan` : 'Pemberitahuan'}
              className="relative size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
            >
              <IkonLonceng size={22} />
              {jumlahTindakan > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
                  {jumlahTindakan}
                </span>
              )}
            </Link>

            {/* Logo toko membuka halaman akun, seperti avatar di portal usaha. */}
            <Link
              to="/distributor-portal/profil"
              aria-label={`Akun ${distributor.nama}`}
              className="size-11 grid place-items-center rounded-md shrink-0"
            >
              <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={36} />
            </Link>
          </div>
        </header>

        <main
          id="konten"
          className="flex-1 px-4 sm:px-6 pb-[calc(var(--nav-h)+1rem)] lg:pb-8 pt-4 lg:pt-6 max-w-[1400px] mx-auto w-full"
        >
          <Outlet />
        </main>
      </div>

      {!fokus && <LoncengMelayang ke="/distributor-portal/pemberitahuan" jumlah={jumlahTindakan} />}

      {/* Navigasi bawah: zona jempol, hanya di layar sempit */}
      <nav
        aria-label="Menu portal distributor"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-aman"
      >
        <div className="flex">
          {TAB.map(({ ke, label, Ikon }) => {
            const terpilih = tabDistributorAktif(pathname, ke)
            return (
              <NavLink
                key={ke}
                to={ke}
                end={ke === '/distributor-portal'}
                aria-current={terpilih ? 'page' : undefined}
                className={cx(
                  // `min-w-0` menjaga `flex-1` benar-benar membagi rata; tanpa itu
                  // label panjang bisa melebarkan bilah dan menggeser halaman.
                  'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-[4.5rem]',
                  'transition-colors',
                  terpilih ? 'text-brand' : 'text-ink-3',
                )}
              >
                <Ikon size={22} strokeWidth={terpilih ? 2.1 : 1.75} />
                {/* "Dashboard Utama" terlalu panjang untuk satu baris di layar
                    sempit. Membiarkannya turun ke baris kedua lebih jujur
                    daripada memendekkan jadi singkatan yang tidak dikenal. */}
                <span
                  className={cx(
                    'text-[0.625rem] leading-tight text-center px-0.5',
                    terpilih ? 'font-bold' : 'font-semibold',
                  )}
                >
                  {label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Pemberitahuan singkat: umpan balik Terima/Tolak muncul di sini */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--nav-h)+var(--tinggi-bilah,0px)+1rem)] lg:bottom-[calc(var(--tinggi-bilah,0px)+1.5rem)] z-50 flex flex-col gap-2 w-[min(30rem,calc(100vw-2rem))] pointer-events-none">
        {racun.map((r) => (
          <Toast key={r.id} pesan={r.pesan} nada={r.nada} tutup={() => tutupRacun(r.id)} />
        ))}
      </div>
    </div>
  )
}
