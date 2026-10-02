import type { ReactNode } from 'react'
import { cx, angka, persen } from '@/lib/format'
import { IkonPeringatan, IkonInfo, IkonCentangLingkaran, IkonSilang } from '@/icons'
import { Tombol, type NadaLencana } from './dasar'

/* ================================================================== */
/* Peringatan / kotak informasi                                       */
/* ================================================================== */

type NadaPeringatan = 'info' | 'aman' | 'menipis' | 'kritis' | 'netral'

const GAYA: Record<NadaPeringatan, { kotak: string; ikon: ReactNode }> = {
  info: {
    kotak: 'bg-info-soft text-info-ink border-info/25',
    ikon: <IkonInfo size={18} />,
  },
  aman: {
    kotak: 'bg-aman-soft text-aman-ink border-aman/25',
    ikon: <IkonCentangLingkaran size={18} />,
  },
  menipis: {
    kotak: 'bg-menipis-soft text-menipis-ink border-menipis/30',
    ikon: <IkonPeringatan size={18} />,
  },
  kritis: {
    kotak: 'bg-kritis-soft text-kritis-ink border-kritis/30',
    ikon: <IkonPeringatan size={18} />,
  },
  netral: {
    kotak: 'bg-netral-soft text-netral-ink border-line',
    ikon: <IkonInfo size={18} />,
  },
}

export function Peringatan({
  nada = 'info',
  judul,
  children,
  aksi,
  tutup,
  className,
}: {
  nada?: NadaPeringatan
  judul?: string
  children?: ReactNode
  aksi?: ReactNode
  tutup?: () => void
  className?: string
}) {
  const g = GAYA[nada]
  return (
    <div
      role={nada === 'kritis' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-md border p-3.5', g.kotak, className)}
    >
      <span className="shrink-0 mt-px" aria-hidden="true">
        {g.ikon}
      </span>
      <div className="min-w-0 grow">
        {judul && <p className="text-[0.875rem] font-bold leading-snug">{judul}</p>}
        {children && (
          <div className={cx('text-[0.8125rem] leading-relaxed opacity-90', judul && 'mt-1')}>
            {children}
          </div>
        )}
        {aksi && <div className="mt-2.5">{aksi}</div>}
      </div>
      {tutup && (
        <button
          type="button"
          onClick={tutup}
          aria-label="Tutup pemberitahuan"
          className="shrink-0 -mt-0.5 -mr-0.5 p-1 rounded hover:bg-ink/10"
        >
          <IkonSilang size={16} />
        </button>
      )}
    </div>
  )
}

/* ================================================================== */
/* Keadaan kosong                                                     */
/* ================================================================== */

/**
 * Keadaan kosong tidak boleh membuat pengguna mengira aplikasinya rusak.
 * Karena itu polanya selalu: apa yang terjadi, kenapa kosong, apa langkah
 * berikutnya yang bisa ditekan sekarang juga.
 */
export function KeadaanKosong({
  ikon,
  judul,
  pesan,
  aksi,
  aksiKedua,
  padat,
  tingkat: Judul = 'h2',
}: {
  ikon?: ReactNode
  judul: string
  pesan: ReactNode
  aksi?: ReactNode
  aksiKedua?: ReactNode
  padat?: boolean
  /** Bawaan h2. Komponen ini sering jadi satu-satunya isi di bawah h1 halaman,
   *  jadi h3 akan membuat tingkat judulnya melompat. */
  tingkat?: 'h2' | 'h3'
}) {
  return (
    <div
      className={cx(
        'text-center flex flex-col items-center',
        padat ? 'py-8 px-4' : 'py-14 px-6',
      )}
    >
      {ikon && (
        <div className="size-14 rounded-xl bg-sunken grid place-items-center text-ink-3 mb-4" aria-hidden="true">
          {ikon}
        </div>
      )}
      <Judul className="text-[1rem] font-bold text-ink">{judul}</Judul>
      <p className="mt-1.5 text-[0.875rem] text-ink-3 leading-relaxed max-w-[36ch]">{pesan}</p>
      {(aksi || aksiKedua) && (
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5">
          {aksi}
          {aksiKedua}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Progres                                                            */
/* ================================================================== */

export function BilahProgres({
  nilai,
  maks,
  nada = 'merek',
  tinggi = 8,
  label,
  tampilkanAngka,
}: {
  nilai: number
  maks: number
  nada?: NadaLencana
  tinggi?: number
  label?: string
  tampilkanAngka?: boolean
}) {
  const rasio = maks > 0 ? Math.min(1, Math.max(0, nilai / maks)) : 0
  const warna: Record<NadaLencana, string> = {
    netral: 'bg-ink-3',
    merek: 'bg-brand',
    aman: 'bg-aman',
    menipis: 'bg-menipis',
    kritis: 'bg-kritis',
    info: 'bg-info',
  }
  return (
    <div>
      {(label || tampilkanAngka) && (
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          {label && <span className="text-[0.8125rem] text-ink-2 font-medium">{label}</span>}
          {tampilkanAngka && (
            <span className="text-[0.8125rem] font-bold text-ink tabular">
              {angka(nilai)} / {angka(maks)}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(rasio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progres'}
        style={{ height: tinggi }}
        className="w-full rounded-full bg-sunken overflow-hidden"
      >
        <div
          style={{ width: `${rasio * 100}%` }}
          className={cx('h-full rounded-full transition-[width] duration-500', warna[nada])}
        />
      </div>
    </div>
  )
}

/** Cincin progres untuk kuota kontrak. Angka besar di tengah agar terbaca sekilas. */
export function CincinProgres({
  nilai,
  maks,
  ukuran = 92,
  nada = 'merek',
  bawah,
}: {
  nilai: number
  maks: number
  ukuran?: number
  nada?: NadaLencana
  bawah?: ReactNode
}) {
  const rasio = maks > 0 ? Math.min(1, Math.max(0, nilai / maks)) : 0
  const r = (ukuran - 10) / 2
  const keliling = 2 * Math.PI * r
  const warna: Record<NadaLencana, string> = {
    netral: 'var(--c-ink-3)',
    merek: 'var(--c-brand)',
    aman: 'var(--c-aman)',
    menipis: 'var(--c-menipis)',
    kritis: 'var(--c-kritis)',
    info: 'var(--c-info)',
  }
  return (
    <div className="relative inline-grid place-items-center" style={{ width: ukuran, height: ukuran }}>
      <svg width={ukuran} height={ukuran} className="-rotate-90" aria-hidden="true">
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          stroke="var(--c-surface-sunken)"
          strokeWidth="9"
        />
        <circle
          cx={ukuran / 2}
          cy={ukuran / 2}
          r={r}
          fill="none"
          stroke={warna[nada]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={keliling}
          strokeDashoffset={keliling * (1 - rasio)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="text-[1.125rem] font-extrabold text-ink tabular">{persen(rasio * 100)}</div>
          {bawah && <div className="text-[0.6875rem] text-ink-3 mt-0.5">{bawah}</div>}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Notifikasi tempel (toast)                                          */
/* ================================================================== */

export function Toast({
  pesan,
  nada = 'aman',
  aksiLabel,
  aksi,
  tutup,
}: {
  pesan: string
  nada?: NadaPeringatan
  aksiLabel?: string
  aksi?: () => void
  tutup?: () => void
}) {
  // Semua nada memakai token pembalik: warna status justru menjadi TERANG di
  // tema gelap, sehingga teks putih di atasnya nyaris tidak terbaca.
  const warna =
    nada === 'kritis'
      ? 'bg-kritis text-ink-inverse'
      : nada === 'menipis'
        ? 'bg-menipis text-ink-inverse'
        : nada === 'info'
          ? 'bg-info text-ink-inverse'
          : 'bg-ink text-ink-inverse'
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'pointer-events-auto flex items-center gap-3 rounded-md px-4 py-3 shadow-e3 anim-muncul',
        warna,
      )}
    >
      <span className="text-[0.875rem] font-semibold grow leading-snug">{pesan}</span>
      {aksiLabel && aksi && (
        <button
          type="button"
          onClick={aksi}
          className="min-h-11 px-1 text-[0.8125rem] font-bold underline underline-offset-2 shrink-0 opacity-90 hover:opacity-100"
        >
          {aksiLabel}
        </button>
      )}
      {tutup && (
        <button type="button" onClick={tutup} aria-label="Tutup" className="shrink-0 opacity-70 hover:opacity-100">
          <IkonSilang size={16} />
        </button>
      )}
    </div>
  )
}

/* ================================================================== */
/* Keadaan galat layanan                                              */
/* ================================================================== */

/**
 * Dipakai saat layanan prediksi tidak bisa dihubungi. Bagian lain halaman
 * harus tetap berfungsi — kegagalan satu layanan tidak boleh mematikan layar.
 */
export function GalatLayanan({
  judul = 'Layanan prediksi belum bisa dihubungi',
  pesan = 'Data stok kamu tetap aman dan bisa dipakai seperti biasa. Kami akan mencoba lagi otomatis.',
  coba,
}: {
  judul?: string
  pesan?: string
  coba?: () => void
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface-2 p-5 text-center">
      <p className="text-[0.9375rem] font-bold text-ink">{judul}</p>
      <p className="mt-1.5 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[42ch] mx-auto">{pesan}</p>
      {coba && (
        <Tombol ragam="garis" ukuran="kecil" className="mt-3.5" onClick={coba}>
          Coba lagi sekarang
        </Tombol>
      )}
    </div>
  )
}
