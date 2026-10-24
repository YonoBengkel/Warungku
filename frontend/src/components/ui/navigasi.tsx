import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cx } from '@/lib/format'
import { IkonKembali } from '@/icons'

/**
 * Ruang kanan baris judul halaman di desktop, selebar lonceng pemberitahuan yang
 * melayang di pojok kanan atas ditambah jaraknya (revisi V2, Q53). Dipasang di
 * baris judul yang punya isi di kanan; baris di bawahnya boleh lewat di bawah
 * lonceng karena lonceng hanya setinggi baris pertama.
 */
export const RUANG_LONCENG = 'lg:pr-14'

/* ================================================================== */
/* Tab segmen                                                         */
/* ================================================================== */

/**
 * Tab di dalam halaman: mengganti tampilan, bukan menyaring. Di mobile bisa
 * digeser horizontal supaya jumlah tab tidak dibatasi lebar layar.
 *
 * Bentuknya jalur abu-abu dengan tab terpilih yang terangkat putih, supaya
 * berbeda dari chip penyaring (ungu muda) dan tidak bersaing dengan tombol
 * utama (ungu penuh). Dulu tab terpilih hitam pekat dan chip ungu penuh, dan
 * keduanya sering tampil bertumpuk di satu layar.
 */
export function TabSegmen<T extends string>({
  tab,
  aktif,
  ubah,
  className,
}: {
  tab: Array<{ nilai: T; label: string; jumlah?: number }>
  aktif: T
  ubah: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('flex overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" className="inline-flex shrink-0 gap-0.5 p-0.5 rounded-lg bg-sunken">
        {tab.map((t) => {
          const terpilih = t.nilai === aktif
          return (
            <button
              key={t.nilai}
              role="tab"
              aria-selected={terpilih}
              onClick={() => ubah(t.nilai)}
              className={cx(
                'shrink-0 h-11 px-3.5 rounded-md text-isi font-semibold transition-[background-color,color,box-shadow] duration-150',
                'inline-flex items-center gap-1.5',
                terpilih ? 'bg-surface text-ink shadow-e1' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
              {t.jumlah != null && t.jumlah > 0 && (
                <span
                  className={cx(
                    'text-[0.6875rem] font-bold rounded-full px-1.5 py-px tabular',
                    terpilih ? 'bg-brand-soft text-brand-soft-ink' : 'bg-surface text-ink-2',
                  )}
                >
                  {t.jumlah}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Baris chip penyaring                                               */
/* ================================================================== */

export function BarisChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      {children}
    </div>
  )
}

export function Chip({
  aktif,
  onClick,
  children,
  ikon,
  bukaMenu,
}: {
  aktif?: boolean
  onClick?: () => void
  children: ReactNode
  ikon?: ReactNode
  /**
   * Chip ini membuka pilihan (menu tarik-turun atau lembar), bukan menyaring
   * sendiri: pembaca layar mendengar "bisa dibuka" dan keadaannya, bukan
   * "ditekan".
   */
  bukaMenu?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={bukaMenu === undefined ? aktif : undefined}
      aria-haspopup={bukaMenu === undefined ? undefined : 'dialog'}
      aria-expanded={bukaMenu}
      className={cx(
        // relative: teks khusus pembaca layar di dalam chip diposisikan absolut.
        // Tanpa jangkar di sini, ia mencari leluhur berposisi terdekat - yaitu
        // kepala halaman yang sticky - lalu lolos dari wadah gulir chip dan
        // melebarkan seluruh halaman.
        'relative shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 rounded-full text-isi font-semibold',
        'border transition-colors duration-150',
        // Ungu muda, bukan ungu penuh: ungu penuh dicadangkan untuk tombol utama.
        aktif
          ? 'bg-brand-soft text-brand-soft-ink border-brand'
          : 'bg-surface text-ink-2 border-line-strong hover:border-brand hover:text-brand',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}

/* ================================================================== */
/* Kepala halaman dalam                                               */
/* ================================================================== */

/**
 * Kepala untuk halaman detail. Di mobile ia menempel di atas dengan tombol
 * kembali; di desktop tombol kembali tetap ada karena navigasi samping tidak
 * menyorot halaman detail.
 */
export function KepalaHalaman({
  judul,
  keterangan,
  kembaliKe,
  kembaliRiwayat = false,
  aksi,
  bawah,
}: {
  judul: string
  keterangan?: ReactNode
  kembaliKe?: string
  /**
   * Tombol kembali menuju halaman sebelumnya, bukan `kembaliKe`. `kembaliKe`
   * tetap dipakai bila halaman ini dibuka langsung (belum ada riwayat di
   * aplikasi). Dipakai halaman pemberitahuan yang tampil tanpa menu samping.
   */
  kembaliRiwayat?: boolean
  aksi?: ReactNode
  bawah?: ReactNode
}) {
  const navigate = useNavigate()
  const { key } = useLocation()
  const kelasKembali = '-ml-2 size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken shrink-0'
  return (
    <header className="sticky top-[var(--kepala-global,0px)] z-30 bg-bg/95 backdrop-blur-sm border-b border-line -mx-4 px-4 sm:-mx-6 sm:px-6">
      <div className={cx('flex items-center gap-2 min-h-14 py-2', RUANG_LONCENG)}>
        {kembaliRiwayat ? (
          <button
            type="button"
            aria-label="Kembali"
            // Entri pertama riwayat React Router berkunci 'default': tidak ada
            // halaman aplikasi sebelumnya, jadi mundur akan keluar dari aplikasi.
            onClick={() => (key !== 'default' ? navigate(-1) : navigate(kembaliKe ?? '/beranda'))}
            className={kelasKembali}
          >
            <IkonKembali size={22} />
          </button>
        ) : (
          kembaliKe && (
            <Link to={kembaliKe} aria-label="Kembali" className={kelasKembali}>
              <IkonKembali size={22} />
            </Link>
          )
        )}
        <div className="min-w-0 grow">
          {/* Nama layar dikunci spesifikasi, jadi ia dibungkus dua baris di layar
              sempit, bukan dipotong. Judul terpotong membuat pengguna tidak
              yakin ia sedang berada di halaman yang benar. */}
          <h1 className="text-subjudul font-extrabold text-ink leading-tight line-clamp-2 sm:truncate">
            {judul}
          </h1>
          {keterangan && <p className="text-kecil text-ink-3 truncate leading-tight">{keterangan}</p>}
        </div>
        {aksi && <div className="shrink-0 flex items-center gap-1">{aksi}</div>}
      </div>
      {bawah && <div className="pb-3">{bawah}</div>}
    </header>
  )
}

/** Halaman sudah digulir sedikit: bagian atas yang beku sedang menempel. */
function useSudahDigulir(): boolean {
  const [digulir, setDigulir] = useState(false)
  useEffect(() => {
    const baca = () => setDigulir(window.scrollY > 8)
    baca()
    window.addEventListener('scroll', baca, { passive: true })
    return () => window.removeEventListener('scroll', baca)
  }, [])
  return digulir
}

/**
 * Bagian atas halaman daftar yang tetap terlihat saat isinya digulir (revisi V2,
 * Q52). Di desktop seluruhnya menempel: `atas` (judul, keterangan) dan `inti`
 * (kotak cari, tab, chip). Di HP hanya `inti`, karena judul dan keterangan akan
 * memakan hampir sepertiga layar; pembungkus luarnya `display: contents` supaya
 * `inti` menempel terhadap halaman, bukan terhadap pembungkus yang pendek ini.
 * Begitu menempel, latarnya penuh dan bergaris bawah supaya isi yang lewat di
 * bawahnya tidak tembus.
 */
export function BagianAtasBeku({ atas, inti }: { atas: ReactNode; inti: ReactNode }) {
  const menempel = useSudahDigulir()
  return (
    <div
      className={cx(
        'max-lg:contents lg:sticky lg:top-0 lg:z-20 lg:-mx-6 lg:px-6 lg:-mt-6 lg:pt-6 lg:pb-3 lg:bg-bg',
        menempel && 'lg:border-b lg:border-line',
      )}
    >
      {atas}
      {/* Jarak ke `atas` berupa padding, bukan margin elemen pertama: margin itu
          ikut keluar dari kotak yang menempel, sehingga di HP kotak cari akan
          menempel rapat ke bilah atas. */}
      <div
        className={cx(
          'pt-3 max-lg:sticky max-lg:top-[var(--kepala-global,0px)] max-lg:z-20 max-lg:bg-bg max-lg:-mx-4 max-lg:px-4 sm:max-lg:-mx-6 sm:max-lg:px-6 max-lg:pb-3',
          menempel && 'max-lg:border-b max-lg:border-line',
        )}
      >
        {inti}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Bilah aksi menempel di bawah                                       */
/* ================================================================== */

/**
 * Untuk halaman dengan satu aksi utama (checkout, setujui kontrak).
 * Ditempel di bawah supaya selalu berada di jangkauan jempol.
 */
export function BilahAksi({ children, ringkasan }: { children: ReactNode; ringkasan?: ReactNode }) {
  return (
    // Ditempel tepat di ATAS bilah navigasi bawah, bukan di dasar layar.
    // Kalau dipatok bottom-0, navigasi yang fixed menutupinya selama halaman
    // belum digulir mentok, dan tombol utamanya benar-benar tidak bisa ditekan.
    <div className="sticky bottom-[var(--nav-h)] lg:bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface/97 backdrop-blur-sm border-t border-line pb-aman lg:pb-3 z-30">
      {/* Di desktop tombolnya berkumpul di kanan selebar ±450px, ringkasan di
          kiri. Tombol selebar 1.000px terbaca seperti spanduk, bukan tombol. */}
      <div className="lg:flex lg:items-center lg:justify-end lg:gap-6">
        {ringkasan && <div className="mb-2.5 lg:mb-0 lg:mr-auto">{ringkasan}</div>}
        <div className="lg:w-full lg:max-w-md">{children}</div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Tautan samping                                                     */
/* ================================================================== */

/**
 * Tautan kecil di navigasi samping desktop, di bawah menu utama (keranjang,
 * Lacak Pesanan), dengan angka opsional. Dipakai kedua portal.
 */
export function TautanSamping({
  ke,
  aktif,
  Ikon,
  label,
  jumlah = 0,
  nadaJumlah = 'merek',
}: {
  ke: string
  aktif: boolean
  Ikon: ComponentType<{ size?: number }>
  label: string
  jumlah?: number
  nadaJumlah?: 'kritis' | 'merek'
}) {
  return (
    <Link
      to={ke}
      aria-label={jumlah > 0 ? `${label}, ${jumlah}` : label}
      aria-current={aktif ? 'page' : undefined}
      className={cx(
        'flex items-center gap-3 h-11 px-3 rounded-md font-semibold text-isi transition-colors',
        aktif ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
      )}
    >
      <Ikon size={20} />
      <span className="grow">{label}</span>
      {jumlah > 0 && (
        <span
          className={cx(
            'min-w-[1.25rem] h-5 px-1.5 rounded-full text-[0.6875rem] font-bold grid place-items-center tabular text-ink-inverse',
            nadaJumlah === 'kritis' ? 'bg-kritis' : 'bg-brand',
          )}
        >
          {jumlah}
        </span>
      )}
    </Link>
  )
}
