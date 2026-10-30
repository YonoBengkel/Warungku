import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bagian, HanyaPembacaLayar, Tombol, TombolTautan } from '@/components/ui/dasar'
import { IkonPanahBawah } from '@/icons'
import { cx } from '@/lib/format'

/**
 * Kartu Beranda revisi V5 yang dipakai kedua portal (butir 4D dan 4E,
 * `Card Promo Distributor – Perlu Tindakan.html` dan
 * `kartu-beranda (diurus + pesanan).html`).
 */

type Ikon = ComponentType<{ size?: number; className?: string }>

/* ================================================================== */
/* Perlu Tindakan                                                     */
/* ================================================================== */

export interface Pintasan {
  kunci: string
  label: string
  ke: string
  jumlah: number
  /** Kata benda untuk pembaca layar, mis. "barang" atau "kontrak". */
  satuan: string
  /** Ikon ilustrasi dari rancangan (Q108), di `public/gambar/tindakan/`. */
  gambar: string
}

/**
 * Empat pintasan penyaring tanpa bingkai (revisi V5, Q108): ikon ilustrasi
 * dan angka berdampingan, namanya di bawah. Saat disorot atau difokus ubinnya
 * terangkat, ikonnya membesar sedikit, dan garis coral muncul di bawah; bila
 * gerak dikurangi, hanya warnanya yang berubah.
 */
export function PerluTindakan({ pintasan, className }: { pintasan: Pintasan[]; className?: string }) {
  return (
    <Bagian id="judul-perlu-tindakan" judul="Perlu Tindakan" besar className={className}>
      <ul
        aria-label="Pintasan ke daftar stok dan kontrak yang perlu ditindak"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {pintasan.map((p) => (
          <li key={p.kunci} className="min-w-0">
            <Link
              to={p.ke}
              aria-label={p.jumlah > 0 ? `${p.label}, ${p.jumlah} ${p.satuan}` : `${p.label}, tidak ada ${p.satuan}`}
              className="group relative flex flex-col items-center gap-2.5 rounded-xl px-2 pt-4 pb-5 sm:px-3 sm:pt-5 sm:pb-[1.375rem] text-center transition-[background-color,translate,box-shadow] duration-200 hover:bg-brand-soft hover:shadow-e2 focus-visible:bg-brand-soft motion-safe:hover:-translate-y-1"
            >
              <span aria-hidden="true" className="flex items-center justify-center gap-2.5 sm:gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}gambar/tindakan/${p.gambar}`}
                  alt=""
                  width={52}
                  height={52}
                  className="size-11 sm:size-[3.25rem] shrink-0 transition-[scale,rotate] duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-safe:group-hover:scale-[1.14] motion-safe:group-hover:-rotate-6"
                />
                <span
                  className={cx(
                    'text-[1.875rem] sm:text-[2.25rem] font-extrabold leading-none tabular transition-colors group-hover:text-brand',
                    p.jumlah > 0 ? 'text-ink' : 'text-ink-3',
                  )}
                >
                  {p.jumlah > 99 ? '99+' : p.jumlah}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="text-isi font-semibold text-ink-2 leading-tight transition-colors group-hover:text-brand"
              >
                {p.label}
              </span>
              <span
                aria-hidden="true"
                className="absolute left-1/2 bottom-2.5 h-[3px] w-7 -translate-x-1/2 scale-x-0 rounded-full bg-aksen transition-[scale] duration-200 group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Bagian>
  )
}

/* ================================================================== */
/* Baris urusan                                                       */
/* ================================================================== */

export type NadaUrusan = 'kritis' | 'menipis' | 'info' | 'merek' | 'netral'

const GELEMBUNG: Record<NadaUrusan, string> = {
  kritis: 'bg-kritis-soft text-kritis-ink',
  menipis: 'bg-menipis-soft text-menipis-ink',
  info: 'bg-info-soft text-info-ink',
  merek: 'bg-brand-soft text-brand-soft-ink',
  netral: 'bg-netral-soft text-netral-ink',
}

export interface Urusan {
  kunci: string
  nada: NadaUrusan
  Ikon: Ikon
  judul: string
  detail: ReactNode
  /**
   * Satu tombol per baris: tautan (`ke`) atau aksi langsung (`onClick`). Label
   * pendek boleh membawa awalan khusus pembaca layar, mis. "Masukkan ke" sebelum
   * "Keranjang".
   */
  aksi: { label: ReactNode; ke?: string; onClick?: () => void; ikon?: ReactNode }
}

/**
 * Satu baris: gelembung ikon, judul dan keterangan, satu tombol. `sorot`
 * memberi latar merah untuk butir yang paling genting; `utama` membuat
 * tombolnya ungu penuh, hanya untuk baris teratas.
 */
export function BarisUrusan({ u, utama, sorot }: { u: Urusan; utama?: boolean; sorot?: boolean }) {
  const ragam = utama ? 'utama' : 'garis'
  return (
    <li
      className={cx(
        'flex items-center gap-2.5 min-h-14 px-2.5 py-2',
        sorot ? 'rounded-lg bg-kritis-soft' : 'not-first:border-t border-line',
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-9 shrink-0 rounded-full grid place-items-center', sorot ? 'bg-kritis/15 text-kritis-ink' : GELEMBUNG[u.nada])}
      >
        <u.Ikon size={18} />
      </span>
      <div className="min-w-0 grow">
        <p className="text-isi font-bold text-ink leading-snug">{u.judul}</p>
        <p className="mt-px text-kecil text-ink-2 leading-snug">{u.detail}</p>
      </div>
      {u.aksi.ke ? (
        <TombolTautan ke={u.aksi.ke} ragam={ragam} ukuran="kecil" ikonKiri={u.aksi.ikon} className="shrink-0">
          {u.aksi.label}
        </TombolTautan>
      ) : (
        <Tombol ragam={ragam} ukuran="kecil" ikonKiri={u.aksi.ikon} onClick={u.aksi.onClick} className="shrink-0">
          {u.aksi.label}
        </Tombol>
      )}
    </li>
  )
}

/* ================================================================== */
/* Yang perlu kamu urus hari ini                                      */
/* ================================================================== */

/**
 * Daftar urusan (revisi V5, Q109): angka besar "N hal menunggu keputusanmu",
 * lalu tiga butir paling mendesak. "Lihat semua" membuka sisanya di kartu ini
 * juga, bukan pindah halaman. Butir pertama yang genting berlatar merah.
 */
export function KartuUrusan({
  butir,
  kosong,
  batas = 3,
  className,
}: {
  butir: Urusan[]
  /** Isi kartu saat tidak ada urusan. */
  kosong: ReactNode
  batas?: number
  className?: string
}) {
  const [semua, setSemua] = useState(false)
  const tampil = semua ? butir : butir.slice(0, batas)
  return (
    <Bagian
      id="judul-perlu-diurus"
      judul="Yang perlu kamu urus hari ini"
      besar
      aksi={
        butir.length > batas ? (
          <Tombol
            ragam="tautan"
            ukuran="kecil"
            aria-expanded={semua}
            aria-controls="daftar-urusan"
            onClick={() => setSemua((s) => !s)}
            ikonKanan={<IkonPanahBawah size={15} className={cx('transition-transform', semua && 'rotate-180')} />}
          >
            {semua ? 'Lebih sedikit' : 'Lihat semua'}
          </Tombol>
        ) : undefined
      }
      className={cx('flex flex-col', className)}
    >
      {butir.length === 0 ? (
        kosong
      ) : (
        <>
          <p className="flex items-baseline gap-2 mb-2.5">
            <span className="text-[2.25rem] font-extrabold leading-none text-ink tabular">{butir.length}</span>
            <span className="text-isi font-semibold text-ink-2">hal menunggu keputusanmu</span>
          </p>
          <ul id="daftar-urusan" className="flex flex-col gap-1">
            {tampil.map((u, i) => (
              <BarisUrusan key={u.kunci} u={u} utama={i === 0} sorot={i === 0 && u.nada === 'kritis'} />
            ))}
          </ul>
        </>
      )}
    </Bagian>
  )
}

/* ================================================================== */
/* Donat status                                                       */
/* ================================================================== */

export interface PotonganDonat {
  kunci: string
  label: string
  jumlah: number
  /** Kelas warna garis potongan (`stroke-*`) dan titik keterangannya (`bg-*`). */
  garis: string
  titik: string
  /** Baris keterangan menjadi tautan ke daftar yang tersaring. */
  ke?: string
}

const R = 42
const KELILING = 2 * Math.PI * R
/** Celah sewarna kartu di antara potongan, supaya batasnya tidak hanya warna. */
const CELAH = 2

/**
 * Donat jumlah per status dengan keterangan di kanan (revisi V5, Q109 dan
 * Q118). Angka tengahnya total; tiap potongan juga tertulis di keterangan,
 * jadi warnanya tidak bekerja sendirian. Palet `seri-2`, `seri-1`, `seri-4`
 * sudah lolos validator dataviz di kedua tema; draf memakai abu-abu garis.
 */
export function DonatStatus({
  potongan,
  satuan,
  label,
}: {
  potongan: PotonganDonat[]
  satuan: string
  /** Kalimat ringkas untuk pembaca layar, mis. "Dari 6 pesanan: ...". */
  label: string
}) {
  const total = potongan.reduce((a, p) => a + p.jumlah, 0)
  const ada = potongan.filter((p) => p.jumlah > 0)
  let jalan = 0
  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <div className="relative size-[6.75rem] shrink-0">
        <svg viewBox="0 0 108 108" width="108" height="108" role="img" aria-label={label} className="block">
          <g transform="rotate(-90 54 54)" fill="none" strokeWidth={14}>
            <circle cx="54" cy="54" r={R} className="stroke-sunken" />
            {total > 0 &&
              ada.map((p) => {
                const panjang = (p.jumlah / total) * KELILING
                const garis = Math.max(0.5, panjang - (ada.length > 1 ? CELAH : 0))
                const awal = jalan
                jalan += panjang
                return (
                  <circle
                    key={p.kunci}
                    cx="54"
                    cy="54"
                    r={R}
                    className={p.garis}
                    strokeDasharray={`${garis} ${KELILING - garis}`}
                    strokeDashoffset={-awal}
                  >
                    <title>{`${p.label}: ${p.jumlah}`}</title>
                  </circle>
                )
              })}
          </g>
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.875rem] font-extrabold leading-none text-ink tabular">{total}</span>
          <span className="mt-0.5 text-kecil font-semibold text-ink-2">{satuan}</span>
        </div>
      </div>
      <ul className="min-w-0 grow flex flex-col gap-1">
        {potongan.map((p) => {
          const isi = (
            <>
              <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', p.titik)} />
              <span className="min-w-0 grow truncate">{p.label}</span>
              <span className="ml-auto text-kartu font-extrabold text-ink tabular">{p.jumlah}</span>
            </>
          )
          const kelas = 'flex items-center gap-2 min-h-8 text-isi font-semibold text-ink'
          return (
            <li key={p.kunci}>
              {p.ke ? (
                <Link to={p.ke} className={cx(kelas, 'rounded-sm hover:text-brand')}>
                  {isi}
                  <HanyaPembacaLayar> {satuan}</HanyaPembacaLayar>
                </Link>
              ) : (
                <span className={kelas}>{isi}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
