import type { ButtonHTMLAttributes, ReactNode, HTMLAttributes, Ref } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/lib/format'
import { gambarUntuk } from '@/lib/gambar'

/* ================================================================== */
/* Tombol                                                             */
/* ================================================================== */

type RagamTombol = 'utama' | 'sekunder' | 'halus' | 'garis' | 'bahaya' | 'bahaya-garis' | 'sunyi' | 'tautan'
type UkuranTombol = 'kecil' | 'sedang' | 'besar'

const RAGAM: Record<RagamTombol, string> = {
  // text-ink-inverse, bukan text-white: di tema gelap --c-brand jadi teal terang
  // dan teks putih di atasnya cuma 1,9:1. Token pembalik otomatis jadi putih di
  // tema terang dan nyaris hitam di tema gelap.
  utama: 'bg-brand text-ink-inverse hover:bg-brand-hover active:bg-brand-hover shadow-e1',
  sekunder: 'bg-brand-soft text-brand-soft-ink hover:brightness-95 active:brightness-90',
  garis: 'bg-surface text-ink border border-line-strong hover:bg-sunken active:bg-sunken',
  halus: 'bg-sunken text-ink-2 hover:text-ink hover:brightness-95',
  bahaya: 'bg-kritis text-ink-inverse hover:brightness-110 active:brightness-95 shadow-e1',
  sunyi: 'bg-transparent text-ink-2 hover:bg-sunken hover:text-ink',
  // Pemicu aksi berbahaya di luar dialog konfirmasi: merah hanya di teks dan bingkai.
  'bahaya-garis': 'bg-surface text-kritis-ink border border-kritis/40 hover:bg-kritis-soft active:bg-kritis-soft',
  // Aksi tersier yang tampil sebagai tautan teks. Menggantikan Link bergaya
  // text-brand yang ditulis ulang di banyak halaman.
  tautan: 'bg-transparent text-brand hover:underline underline-offset-2',
}

/**
 * Tinggi sentuh minimum 44px.
 *
 * Ragam "kecil" tetap ramping secara visual supaya hierarki tombol terjaga,
 * tapi area sentuhnya diperlebar ke atas dan ke bawah lewat pseudo-element
 * sehingga jempol tetap mengenainya. Tombol yang terlihat kecil tapi susah
 * ditekan adalah cacat yang tidak terlihat di tangkapan layar.
 */
const UKURAN: Record<UkuranTombol, string> = {
  kecil:
    'h-9 px-3 text-isi gap-1.5 rounded-sm relative ' +
    'after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-[""]',
  sedang: 'h-11 px-4 text-kartu gap-2 rounded-md',
  besar: 'h-[3.25rem] px-5 text-base gap-2 rounded-md',
}

/** Ragam tautan tidak berbantalan; tinggi sentuhnya tetap 44px. */
const UKURAN_TAUTAN: Record<UkuranTombol, string> = {
  kecil: 'min-h-11 px-0 text-isi gap-1',
  sedang: 'min-h-11 px-0 text-isi gap-1.5',
  besar: 'min-h-11 px-0 text-kartu gap-1.5',
}

/**
 * `penuh="hp"`: selebar wadah di HP, selebar isinya mulai 640px. Tombol
 * selebar 1.000px di desktop terbaca seperti spanduk, bukan tombol.
 */
type Penuh = boolean | 'hp'

function kelasUkuran(ragam: RagamTombol, ukuran: UkuranTombol, penuh?: Penuh): string {
  return cx(
    ragam === 'tautan' ? UKURAN_TAUTAN[ukuran] : UKURAN[ukuran],
    penuh === 'hp' ? 'w-full sm:w-auto' : penuh && 'w-full',
  )
}

interface PropsTombol extends ButtonHTMLAttributes<HTMLButtonElement> {
  ragam?: RagamTombol
  ukuran?: UkuranTombol
  penuh?: Penuh
  memuat?: boolean
  ikonKiri?: ReactNode
  ikonKanan?: ReactNode
}

export function Tombol({
  ragam = 'utama',
  ukuran = 'sedang',
  penuh,
  memuat,
  ikonKiri,
  ikonKanan,
  children,
  className,
  disabled,
  ...rest
}: PropsTombol) {
  return (
    <button
      type="button"
      disabled={disabled || memuat}
      aria-busy={memuat || undefined}
      className={cx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none',
        'transition-[background-color,color,filter,opacity] duration-150',
        'disabled:opacity-45 disabled:pointer-events-none',
        RAGAM[ragam],
        kelasUkuran(ragam, ukuran, penuh),
        className,
      )}
      {...rest}
    >
      {memuat ? <Pemuat /> : ikonKiri}
      {children}
      {ikonKanan}
    </button>
  )
}

/** Tombol yang sebenarnya tautan. Dipakai untuk navigasi, bukan aksi. */
export function TombolTautan({
  ke,
  ragam = 'utama',
  ukuran = 'sedang',
  penuh,
  ikonKiri,
  ikonKanan,
  children,
  className,
}: {
  ke: string
  ragam?: RagamTombol
  ukuran?: UkuranTombol
  penuh?: Penuh
  ikonKiri?: ReactNode
  ikonKanan?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={ke}
      className={cx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none',
        'transition-[background-color,color,filter] duration-150',
        RAGAM[ragam],
        kelasUkuran(ragam, ukuran, penuh),
        className,
      )}
    >
      {ikonKiri}
      {children}
      {ikonKanan}
    </Link>
  )
}

/** Tombol hanya-ikon. Wajib punya label untuk pembaca layar. */
export function TombolIkon({
  label,
  children,
  ragam = 'sunyi',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; ragam?: RagamTombol }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-grid place-items-center size-11 rounded-md shrink-0 transition-colors duration-150',
        'disabled:opacity-40 disabled:pointer-events-none',
        RAGAM[ragam],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Pemuat({ ukuran = 16 }: { ukuran?: number }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      className="animate-spin shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" fill="none" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/* ================================================================== */
/* Kartu                                                              */
/* ================================================================== */

export function Kartu({
  children,
  className,
  padat,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padat?: boolean }) {
  return (
    <div
      className={cx(
        'bg-surface border border-line rounded-lg shadow-e1',
        padat ? 'p-3' : 'p-4 sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/** Kartu yang seluruhnya bisa ditekan. Target sentuh = seluruh kartu. */
export function KartuTautan({
  ke,
  children,
  className,
}: {
  ke: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={ke}
      className={cx(
        'block bg-surface border border-line rounded-lg shadow-e1 p-4',
        'transition-[border-color,box-shadow] duration-150',
        'hover:border-line-strong hover:shadow-e2 active:bg-surface-2',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function JudulBagian({
  id,
  judul,
  keterangan,
  aksi,
  className,
}: {
  /** Diteruskan ke <h2> supaya aria-labelledby pada <section> punya sasaran. */
  id?: string
  judul: string
  keterangan?: string
  aksi?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-kartu font-bold text-ink leading-tight">
          {judul}
        </h2>
        {keterangan && <p className="text-isi text-ink-3 mt-0.5 leading-snug">{keterangan}</p>}
      </div>
      {aksi && <div className="shrink-0">{aksi}</div>}
    </div>
  )
}

/** Rupa kotak Bagian, untuk kotak tanpa judul yang harus serupa. */
export const KELAS_BAGIAN =
  'bg-surface border-y border-line -mx-4 px-4 py-4 sm:mx-0 sm:p-5 sm:border-x sm:rounded-xl sm:shadow-e1'

/**
 * Bagian halaman dalam kotak putih bersudut bulat beserta judulnya (revisi
 * 23 Okt, pola referensi UI: satu kotak per bagian di atas latar abu-abu).
 *
 * Di HP kotaknya menjadi pita putih selebar layar tanpa sudut, supaya lebar isi
 * tidak berkurang dua kali oleh jarak tepi; mulai 640px ia kotak bersudut.
 * Korsel dan baris geser di dalamnya tetap memakai tarikan `-mx-4 px-4`, yang
 * kini berhenti tepat di tepi pita. Hanya untuk anak langsung isi halaman:
 * tarikan `-mx-4` mengandaikan jarak tepi halaman 16px.
 *
 * Dengan `id` + `judul` ia `<section>` berjudul `JudulBagian`; dengan `id` +
 * `kepala` judulnya dibuat sendiri (wajib memuat elemen ber-`id` itu); tanpa
 * `id` ia sekadar kotak.
 */
export function Bagian({
  id,
  judul,
  keterangan,
  aksi,
  kepala,
  className,
  children,
  ref,
  ...rest
}: {
  id?: string
  judul?: string
  keterangan?: string
  aksi?: ReactNode
  kepala?: ReactNode
  className?: string
  children: ReactNode
  ref?: Ref<HTMLElement>
} & Omit<HTMLAttributes<HTMLElement>, 'id' | 'className' | 'children'>) {
  const kelas = cx(KELAS_BAGIAN, className)
  if (!id) {
    return (
      <div ref={ref as Ref<HTMLDivElement>} className={kelas} {...rest}>
        {children}
      </div>
    )
  }
  return (
    <section ref={ref} aria-labelledby={id} className={kelas} {...rest}>
      {kepala ?? (judul && <JudulBagian id={id} judul={judul} keterangan={keterangan} aksi={aksi} />)}
      {children}
    </section>
  )
}

/* ================================================================== */
/* Lencana                                                            */
/* ================================================================== */

export type NadaLencana = 'netral' | 'merek' | 'aman' | 'menipis' | 'kritis' | 'info'

const NADA: Record<NadaLencana, string> = {
  netral: 'bg-netral-soft text-netral-ink',
  merek: 'bg-brand-soft text-brand-soft-ink',
  aman: 'bg-aman-soft text-aman-ink',
  menipis: 'bg-menipis-soft text-menipis-ink',
  kritis: 'bg-kritis-soft text-kritis-ink',
  info: 'bg-info-soft text-info-ink',
}

export function Lencana({
  nada = 'netral',
  ikon,
  children,
  className,
  besar,
}: {
  nada?: NadaLencana
  ikon?: ReactNode
  children: ReactNode
  className?: string
  besar?: boolean
}) {
  return (
    // Sengaja TIDAK memakai whitespace-nowrap. Lencana status memang pendek dan
    // tidak akan pernah membungkus, tapi lencana konteks bisa sepanjang
    // "Distributor Baru - belum ada ulasan - bergabung Agu 2026". Satu lencana
    // yang menolak membungkus cukup untuk melebarkan seluruh halaman di layar
    // 360px, dan badan halaman tidak boleh pernah bergeser horizontal.
    <span
      className={cx(
        'inline-flex items-center gap-1 font-semibold rounded-sm max-w-full',
        besar ? 'text-isi px-2.5 py-1' : 'text-[0.6875rem] px-2 py-[3px]',
        NADA[nada],
        className,
      )}
    >
      {ikon && <span className="shrink-0">{ikon}</span>}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

/** Titik status kecil. Selalu dipasangkan dengan teks, tidak pernah sendirian. */
export function Titik({ nada = 'netral' }: { nada?: NadaLencana }) {
  const warna: Record<NadaLencana, string> = {
    netral: 'bg-ink-3',
    merek: 'bg-brand',
    aman: 'bg-aman',
    menipis: 'bg-menipis',
    kritis: 'bg-kritis',
    info: 'bg-info',
  }
  return <span className={cx('inline-block size-2 rounded-full shrink-0', warna[nada])} aria-hidden="true" />
}

/* ================================================================== */
/* Avatar                                                             */
/* ================================================================== */

export function Avatar({
  nama,
  warna,
  ukuran = 40,
  className,
}: {
  nama: string
  warna?: string
  ukuran?: number
  className?: string
}) {
  // Logo toko atau gambar produk kalau ada (lihat `gambarUntuk`); huruf awal
  // tetap menjadi cadangan untuk toko baru dan produk di luar katalog.
  const gambar = gambarUntuk(nama)
  if (gambar) {
    return (
      <img
        src={gambar}
        alt=""
        aria-hidden="true"
        width={ukuran}
        height={ukuran}
        loading="lazy"
        decoding="async"
        style={{ width: ukuran, height: ukuran }}
        className={cx('inline-block shrink-0', className)}
      />
    )
  }
  const huruf = nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden="true"
      style={{
        width: ukuran,
        height: ukuran,
        background: warna ?? 'var(--c-brand-soft)',
        color: warna ? '#fff' : 'var(--c-brand-soft-ink)',
        // Warna latar di sini milik data distributor dan bisa saja terang,
        // jadi inisialnya diberi bayangan tipis supaya tetap terbaca.
        textShadow: warna ? '0 1px 2px rgb(0 0 0 / 0.35)' : undefined,
        fontSize: ukuran * 0.36,
      }}
      className={cx(
        'inline-grid place-items-center rounded-md font-extrabold shrink-0 tracking-tight',
        className,
      )}
    >
      {huruf}
    </span>
  )
}

/* ================================================================== */
/* Kerangka pemuatan                                                  */
/* ================================================================== */

export function Kerangka({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />
}

export function KerangkaBaris({ jumlah = 3 }: { jumlah?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat data">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Kerangka className="size-11 rounded-md" />
          <div className="flex-1 space-y-2">
            <Kerangka className="h-3.5 w-2/5" />
            <Kerangka className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/* Tata letak kecil                                                   */
/* ================================================================== */

export function Pemisah({ className }: { className?: string }) {
  return <hr className={cx('border-0 border-t border-line', className)} />
}

/** Baris label-nilai untuk ringkasan dan detail. */
export function BarisData({
  label,
  nilai,
  tebal,
  nada,
}: {
  label: ReactNode
  nilai: ReactNode
  tebal?: boolean
  nada?: 'biasa' | 'kritis' | 'aman'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-isi text-ink-3 shrink-0">{label}</span>
      <span
        className={cx(
          'text-right tabular',
          tebal ? 'text-kartu font-bold' : 'text-isi font-semibold',
          nada === 'kritis' ? 'text-kritis' : nada === 'aman' ? 'text-aman' : 'text-ink',
        )}
      >
        {nilai}
      </span>
    </div>
  )
}

/** Angka besar dengan label, untuk kartu ringkasan di Beranda. */
export function Metrik({
  label,
  nilai,
  satuan,
  bantuan,
  nada = 'biasa',
  ikon,
}: {
  label: string
  nilai: ReactNode
  satuan?: string
  bantuan?: ReactNode
  nada?: 'biasa' | 'aman' | 'menipis' | 'kritis' | 'merek'
  ikon?: ReactNode
}) {
  const warnaNilai = {
    biasa: 'text-ink',
    aman: 'text-aman',
    menipis: 'text-menipis',
    kritis: 'text-kritis',
    merek: 'text-brand',
  }[nada]
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-ink-3">
        {ikon}
        <span className="text-kecil font-semibold uppercase tracking-wide truncate">{label}</span>
      </div>
      {/* Angka besar berdiri sendiri memakai lebar digit proporsional.
          tabular-nums hanya untuk kolom angka yang harus sejajar vertikal. */}
      <div className={cx('mt-1 flex items-baseline gap-1', warnaNilai)}>
        <span className="text-angka font-extrabold leading-none tracking-tight">{nilai}</span>
        {satuan && <span className="text-isi font-semibold text-ink-3">{satuan}</span>}
      </div>
      {bantuan && <div className="mt-1 text-kecil text-ink-3 leading-snug">{bantuan}</div>}
    </div>
  )
}

/** Teks khusus pembaca layar. */
export function HanyaPembacaLayar({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>
}
