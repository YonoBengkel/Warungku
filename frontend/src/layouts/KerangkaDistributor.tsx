import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cx } from '@/lib/format'
import { NAV_DISTRIBUTOR } from '@/lib/label'
import {
  IkonBeranda,
  IkonBintang,
  IkonKembali,
  IkonKontrak,
  IkonLonceng,
  IkonPasokan,
  IkonProfil,
  IkonToko,
} from '@/icons'
import { distributorAktif } from '@/data/dummy'
import { useAplikasi, useJumlahPerluKonfirmasi } from '@/store/aplikasi'
import { Toast } from '@/components/ui/umpanBalik'
import { Avatar } from '@/components/ui/dasar'

/**
 * Kerangka Portal Distributor: empat item, sistem desain yang sama dengan
 * KerangkaAplikasi.
 *
 * Bentuknya sengaja meniru sisi UMKM (navigasi samping di layar lebar, bilah
 * bawah di layar sempit, kepala halaman yang tetap) supaya orang yang sudah
 * hafal satu sisi tidak perlu belajar ulang di sisi lain. Yang beda hanya
 * isinya: tidak ada keranjang dan tidak ada avatar akun, karena distributor
 * tidak berbelanja dan profilnya sudah punya tab sendiri.
 */

const TAB = [
  { ke: '/distributor-portal', label: NAV_DISTRIBUTOR.dashboard, Ikon: IkonBeranda },
  { ke: '/distributor-portal/pesanan', label: NAV_DISTRIBUTOR.pesanan, Ikon: IkonPasokan },
  { ke: '/distributor-portal/kontrak', label: NAV_DISTRIBUTOR.kontrak, Ikon: IkonKontrak },
  { ke: '/distributor-portal/promo', label: NAV_DISTRIBUTOR.promo, Ikon: IkonBintang },
  { ke: '/distributor-portal/pelanggan', label: NAV_DISTRIBUTOR.pelanggan, Ikon: IkonToko },
  { ke: '/distributor-portal/profil', label: NAV_DISTRIBUTOR.profil, Ikon: IkonProfil },
]

/**
 * Dashboard adalah rute indeks, jadi ia hanya aktif kalau pathname-nya persis
 * itu. Tiga tab lain justru harus tetap menyala saat pengguna berada di halaman
 * turunannya (mis. detail satu pesanan), tapi pencocokannya berhenti di batas
 * ruas rute supaya `/…/pesanan-lama` tidak ikut menyalakan tab Pesanan.
 */
export function tabDistributorAktif(pathname: string, ke: string): boolean {
  if (ke === '/distributor-portal') return pathname === '/distributor-portal' || pathname === '/distributor-portal/'
  return pathname === ke || pathname.startsWith(`${ke}/`)
}

/**
 * Berpindah peran bukan fitur produk, hanya jalan pintas supaya purwarupa bisa
 * ditelusuri dari dua sisi. Karena itu pitanya dibiarkan mencolok dan diberi
 * keterangan, bukan disembunyikan di balik menu.
 */
function PitaAlatUji({ kelas }: { kelas?: string }) {
  const sesi = useAplikasi((s) => s.sesiDistributor)
  const putus = useAplikasi((s) => s.putusDistributor)
  return (
    <div className={cx('bg-menipis-soft border-line px-3 py-2.5', kelas)}>
      {/* Asal data portal ini: server (dengan akun distributor) atau data contoh. */}
      <p className="text-kecil leading-snug text-menipis-ink">
        {sesi ? (
          <>
            Masuk sebagai {sesi.namaPengguna}.{' '}
            <button type="button" onClick={putus} className="font-bold underline underline-offset-2 min-h-11">
              Keluar
            </button>
          </>
        ) : (
          <>
            Memakai data contoh.{' '}
            <Link to="/masuk/distributor" className="font-bold underline underline-offset-2 inline-flex items-center min-h-11">
              Masuk sebagai distributor
            </Link>
          </>
        )}
      </p>
      <Link
        to="/beranda"
        className="flex items-center gap-2 min-h-11 font-bold text-isi text-menipis-ink"
      >
        <IkonKembali size={18} />
        Kembali ke portal UMKM
      </Link>
      <p className="text-kecil leading-snug text-menipis-ink">
        Berpindah peran adalah alat uji purwarupa, bukan bagian dari aplikasi yang dipakai pemilik
        usaha.
      </p>
    </div>
  )
}

export default function KerangkaDistributor() {
  const { pathname } = useLocation()
  const racun = useAplikasi((s) => s.racun)
  const tutupRacun = useAplikasi((s) => s.tutupRacun)
  const tema = useAplikasi((s) => s.tema)
  const perluKonfirmasi = useJumlahPerluKonfirmasi()

  // Portal ini layout terpisah: kalau pengguna membuka rutenya langsung, kelas
  // tema harus tetap terpasang tanpa menumpang pada kerangka sisi UMKM.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'gelap')
  }, [tema])

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
        className="hidden lg:flex lg:flex-col lg:shrink-0 lg:border-r lg:border-line lg:bg-surface lg:h-dvh lg:sticky lg:top-0"
        style={{ width: 'var(--rail-w)' }}
      >
        <div className="px-5 py-5">
          <Link to="/distributor-portal" className="flex items-center gap-2.5 min-w-0">
            <Avatar nama={distributorAktif.nama} warna={distributorAktif.warna} ukuran={36} />
            <span className="min-w-0">
              <span className="block font-extrabold text-ink text-[1rem] tracking-tight truncate">
                {distributorAktif.nama}
              </span>
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
                {/* Di desktop angka lonceng pindah ke sini: lonceng di bilah atas
                    hanya membuka Pesanan, dan bilah itu disembunyikan. */}
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

        <PitaAlatUji kelas="mt-auto border-t" />
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Kepala halaman: siapa yang sedang dilihat, dan apa yang menunggu */}
        <header className="lg:hidden sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line pt-aman">
          <div className="h-14 px-4 sm:px-6 flex items-center gap-2 max-w-[1400px] mx-auto w-full">
            <Link
              to="/distributor-portal"
              className="flex items-center gap-2 mr-auto min-w-0 min-h-11 pr-2"
            >
              <Avatar nama={distributorAktif.nama} warna={distributorAktif.warna} ukuran={32} />
              <span className="font-extrabold text-ink text-kartu truncate">
                {distributorAktif.nama}
              </span>
            </Link>

            <Link
              to="/distributor-portal/pesanan"
              aria-label={
                perluKonfirmasi > 0
                  ? `Pemberitahuan, ${perluKonfirmasi} pesanan menunggu konfirmasi`
                  : 'Pemberitahuan'
              }
              className="relative size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
            >
              <IkonLonceng size={22} />
              {perluKonfirmasi > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
                  {perluKonfirmasi}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Di layar sempit navigasi samping tidak ada, jadi jalan pulang ke
            portal UMKM ikut dibawa ke bawah kepala halaman. */}
        <PitaAlatUji kelas="lg:hidden border-b" />

        <main
          id="konten"
          className="flex-1 px-4 sm:px-6 pb-[calc(var(--nav-h)+1rem)] lg:pb-8 pt-4 lg:pt-6 max-w-[1400px] mx-auto w-full"
        >
          <Outlet />
        </main>
      </div>

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
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--nav-h)+1rem)] lg:bottom-6 z-50 flex flex-col gap-2 w-[min(30rem,calc(100vw-2rem))] pointer-events-none">
        {racun.map((r) => (
          <Toast key={r.id} pesan={r.pesan} nada={r.nada} tutup={() => tutupRacun(r.id)} />
        ))}
      </div>
    </div>
  )
}
