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
import { LoncengMelayang, useDibacaDistributor, usePemberitahuanDistributor } from '@/components/domain/Pemberitahuan'
import { MenuSamping } from '@/components/ui/MenuSamping'

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
  const { daftar: pemberitahuan, baca, bacaSemua } = useDibacaDistributor(usePemberitahuanDistributor())
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

      {/* Navigasi samping: hanya muncul di layar lebar, isinya sama persis.
          Merek aplikasi di atas, nama toko di kartu akun bawah (revisi V4, Q93),
          dengan rancangan yang sama dengan portal usaha (revisi V5, Q111).
          Angka pesanan yang menunggu dijawab langsung di menunya. Pemberitahuan
          di pojok kanan atas halaman, Lacak Pesanan dibuka dari Pesanan Masuk. */}
      <MenuSamping
        label="Menu portal distributor"
        merekKe="/distributor-portal"
        subjudul="Portal Distributor"
        sembunyi={fokus}
        utama={TAB.map(({ ke, label, Ikon }) => ({
          ke,
          label,
          Ikon,
          aktif: tabDistributorAktif(pathname, ke),
          ...(ke === '/distributor-portal/pesanan'
            ? { angka: perluKonfirmasi, labelAngka: `${perluKonfirmasi} menunggu konfirmasi`, nadaAngka: 'kritis' as const }
            : {}),
        }))}
        tambahan={[
          {
            ke: '/distributor-portal/penjualan',
            label: 'Ringkasan Penjualan',
            Ikon: IkonGrafik,
            aktif: pathname.startsWith('/distributor-portal/penjualan'),
          },
        ]}
        akun={{
          ke: '/distributor-portal/profil',
          nama: distributor.nama,
          warna: distributor.warna,
          aktif: pathname.startsWith('/distributor-portal/profil'),
        }}
      />

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

      {!fokus && (
        <LoncengMelayang
          butir={pemberitahuan}
          jumlah={jumlahTindakan}
          keSemua="/distributor-portal/pemberitahuan"
          baca={baca}
          bacaSemua={bacaSemua}
        />
      )}

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
