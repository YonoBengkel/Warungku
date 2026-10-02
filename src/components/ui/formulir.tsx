import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx, angka } from '@/lib/format'
import { IkonKurang, IkonTambah, IkonCentang } from '@/icons'

/**
 * Aturan formulir di aplikasi ini:
 * - Label selalu terlihat (bukan placeholder sebagai label) — pemilik usaha
 *   sering terinterupsi dan kehilangan konteks kalau label hilang saat mengetik.
 * - Pesan kesalahan menjelaskan CARA MEMPERBAIKI, bukan hanya menyalahkan.
 * - Tinggi kolom 48px supaya nyaman ditekan di HP.
 */

const KELAS_DASAR =
  'w-full h-12 px-3.5 rounded-md bg-surface text-ink text-[0.9375rem] ' +
  'border placeholder:text-ink-3/70 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:outline-none focus:ring-4 ' +
  'disabled:bg-sunken disabled:text-ink-3'

/**
 * Warna bingkai kolom isian: dipilih SALAH SATU, tidak pernah ditumpuk.
 *
 * Di CSS hasil Tailwind, `.border-line-strong` tercetak sesudah
 * `.border-kritis`. Kalau keduanya terpasang bersamaan, yang menang selalu
 * abu-abu, dan bingkai merah tanda galat tidak pernah terlihat.
 */
export function kelasBingkai(galat: unknown): string {
  return galat
    ? 'border-kritis focus:border-kritis focus:ring-[var(--c-kritis-soft)]'
    : 'border-line-strong focus:border-brand focus:ring-[var(--c-brand-ring)]'
}

function Bungkus({
  id,
  label,
  wajib,
  bantuan,
  galat,
  children,
  className,
}: {
  id: string
  label?: string
  wajib?: boolean
  bantuan?: ReactNode
  galat?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('w-full', className)}>
      {label && (
        <label htmlFor={id} className="block text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
          {label}
          {wajib && (
            <span className="text-kritis ml-0.5" aria-hidden="true">
              *
            </span>
          )}
          {!wajib && <span className="text-ink-3 font-normal ml-1.5">(boleh dikosongkan)</span>}
        </label>
      )}
      {children}
      {galat ? (
        <p id={`${id}-galat`} className="mt-1.5 text-[0.8125rem] text-kritis font-medium leading-snug">
          {galat}
        </p>
      ) : bantuan ? (
        <p id={`${id}-bantuan`} className="mt-1.5 text-[0.8125rem] text-ink-3 leading-snug">
          {bantuan}
        </p>
      ) : null}
    </div>
  )
}

export function Kolom({
  label,
  wajib,
  bantuan,
  galat,
  awalan,
  akhiran,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  wajib?: boolean
  bantuan?: ReactNode
  galat?: string
  awalan?: ReactNode
  akhiran?: ReactNode
}) {
  const dibuat = useId()
  const id = rest.id ?? dibuat
  return (
    <Bungkus id={id} label={label} wajib={wajib} bantuan={bantuan} galat={galat} className={className}>
      <div className="relative">
        {awalan && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 text-[0.9375rem] pointer-events-none">
            {awalan}
          </span>
        )}
        <input
          id={id}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat ? `${id}-galat` : bantuan ? `${id}-bantuan` : undefined}
          className={cx(KELAS_DASAR, awalan ? 'pl-10' : '', akhiran ? 'pr-14' : '', kelasBingkai(galat))}
          {...rest}
        />
        {akhiran && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3 text-[0.875rem] font-semibold pointer-events-none">
            {akhiran}
          </span>
        )}
      </div>
    </Bungkus>
  )
}

export function AreaTeks({
  label,
  wajib,
  bantuan,
  galat,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  wajib?: boolean
  bantuan?: ReactNode
  galat?: string
}) {
  const dibuat = useId()
  const id = rest.id ?? dibuat
  return (
    <Bungkus id={id} label={label} wajib={wajib} bantuan={bantuan} galat={galat} className={className}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={galat ? true : undefined}
        className={cx(KELAS_DASAR, 'h-auto py-3 resize-y leading-relaxed', kelasBingkai(galat))}
        {...rest}
      />
    </Bungkus>
  )
}

export function Pilihan({
  label,
  wajib,
  bantuan,
  galat,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  wajib?: boolean
  bantuan?: ReactNode
  galat?: string
}) {
  const dibuat = useId()
  const id = rest.id ?? dibuat
  return (
    <Bungkus id={id} label={label} wajib={wajib} bantuan={bantuan} galat={galat} className={className}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat ? `${id}-galat` : bantuan ? `${id}-bantuan` : undefined}
          className={cx(KELAS_DASAR, 'appearance-none pr-10 cursor-pointer', kelasBingkai(galat))}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </Bungkus>
  )
}

/* ================================================================== */
/* Pengatur jumlah (tombol tambah / kurang)                           */
/* ================================================================== */

/**
 * Komponen yang paling sering ditekan di aplikasi ini: menyesuaikan jumlah
 * pesanan yang sudah diisi otomatis oleh model prediksi.
 *
 * Keputusan desain:
 * - Tombol 44x44px, jarak antar tombol lebar, supaya tidak salah tekan.
 * - Nilai bisa diketik langsung untuk perubahan besar (dari 12 ke 200).
 * - Saat nilai berbeda dari saran model, perbedaannya ditandai, bukan disembunyikan.
 */
export function PengaturJumlah({
  nilai,
  ubah,
  langkah = 1,
  min = 0,
  maks = 999_999,
  satuan,
  saranModel,
  label = 'Jumlah',
  ukuran = 'sedang',
  desimal = 0,
}: {
  nilai: number
  ubah: (n: number) => void
  langkah?: number
  min?: number
  maks?: number
  satuan?: string
  saranModel?: number | null
  label?: string
  ukuran?: 'kecil' | 'sedang'
  /** Angka di belakang koma yang boleh diketik, mis. 2 untuk kg dan liter. */
  desimal?: number
}) {
  /* Dibulatkan ke presisi satuannya: tanpa ini 0,1 + 0,2 kg tampil sebagai
     0,30000000000000004 di kolomnya. */
  const pengali = 10 ** desimal
  const batasi = (n: number) => Math.min(maks, Math.max(min, Math.round(n * pengali) / pengali))
  const tinggi = ukuran === 'kecil' ? 'h-10' : 'h-12'
  const sisi = ukuran === 'kecil' ? 'w-10' : 'w-12'
  const berbedaDariSaran = saranModel != null && saranModel !== nilai

  return (
    <div>
      <div
        className={cx(
          'inline-flex items-stretch rounded-md border border-line-strong bg-surface overflow-hidden select-none',
          tinggi,
        )}
      >
        <button
          type="button"
          aria-label={`Kurangi ${label.toLowerCase()}`}
          disabled={nilai <= min}
          onClick={() => ubah(batasi(nilai - langkah))}
          className={cx(
            sisi,
            'grid place-items-center text-ink-2 transition-colors',
            'hover:bg-sunken active:bg-line disabled:opacity-30 disabled:pointer-events-none',
          )}
        >
          <IkonKurang size={18} />
        </button>
        <label className="sr-only" htmlFor={`jumlah-${label}`}>
          {label}
        </label>
        <input
          id={`jumlah-${label}`}
          type="number"
          inputMode={desimal > 0 ? 'decimal' : 'numeric'}
          step={desimal > 0 ? 'any' : undefined}
          value={nilai}
          min={min}
          max={maks}
          onChange={(e) => ubah(batasi(Number(e.target.value) || 0))}
          className={cx(
            'w-16 text-center bg-transparent text-ink font-bold tabular border-x border-line',
            ukuran === 'kecil' ? 'text-[0.875rem]' : 'text-[1rem]',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            'focus:outline-none focus:bg-brand-soft',
          )}
        />
        <button
          type="button"
          aria-label={`Tambah ${label.toLowerCase()}`}
          disabled={nilai >= maks}
          onClick={() => ubah(batasi(nilai + langkah))}
          className={cx(
            sisi,
            'grid place-items-center text-ink-2 transition-colors',
            'hover:bg-sunken active:bg-line disabled:opacity-30 disabled:pointer-events-none',
          )}
        >
          <IkonTambah size={18} />
        </button>
        {satuan && (
          <span className="px-3 grid place-items-center text-[0.8125rem] font-semibold text-ink-3 bg-surface-2 border-l border-line">
            {satuan}
          </span>
        )}
      </div>
      {berbedaDariSaran && (
        <button
          type="button"
          onClick={() => ubah(saranModel)}
          className="mt-1.5 block text-[0.75rem] text-brand font-semibold hover:underline"
        >
          Saran sistem {angka(saranModel, desimal)}
          {satuan ? ` ${satuan}` : ''} &middot; pakai saran
        </button>
      )}
    </div>
  )
}

/* ================================================================== */
/* Sakelar & kotak centang                                            */
/* ================================================================== */

export function Sakelar({
  aktif,
  ubah,
  label,
  keterangan,
  nonaktif,
}: {
  aktif: boolean
  ubah: (v: boolean) => void
  label: string
  keterangan?: string
  nonaktif?: boolean
}) {
  return (
    <label
      className={cx(
        'flex items-start gap-3 py-2 cursor-pointer',
        nonaktif && 'opacity-50 cursor-not-allowed',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={aktif}
        aria-label={label}
        disabled={nonaktif}
        onClick={() => !nonaktif && ubah(!aktif)}
        className={cx(
          'relative shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors duration-200',
          // Sakelar hanya setinggi 24px supaya tidak mendominasi baris, jadi
          // area sentuhnya diperluas ke 44px lewat pseudo-element.
          'after:absolute after:inset-x-0 after:-top-2.5 after:-bottom-2.5 after:content-[""]',
          aktif ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-e1 transition-transform duration-200',
            aktif && 'translate-x-5',
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-ink leading-snug">{label}</span>
        {keterangan && (
          <span className="block text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">{keterangan}</span>
        )}
      </span>
    </label>
  )
}

export function KotakCentang({
  dicentang,
  ubah,
  children,
  galat,
}: {
  dicentang: boolean
  ubah: (v: boolean) => void
  children: ReactNode
  galat?: boolean
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-1">
      <span
        className={cx(
          'shrink-0 mt-0.5 size-[22px] rounded-[6px] border-2 grid place-items-center transition-colors',
          dicentang
            ? 'bg-brand border-brand text-ink-inverse'
            : galat
              ? 'border-kritis bg-surface'
              : 'border-line-strong bg-surface group-hover:border-brand',
        )}
      >
        {dicentang && <IkonCentang size={14} strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        checked={dicentang}
        onChange={(e) => ubah(e.target.checked)}
        className="sr-only"
      />
      <span className="text-[0.875rem] text-ink-2 leading-relaxed">{children}</span>
    </label>
  )
}

/* ================================================================== */
/* Pilihan kartu (radio besar)                                        */
/* ================================================================== */

export function PilihanKartu({
  terpilih,
  ubah,
  nilai,
  judul,
  keterangan,
  kanan,
  anakan,
}: {
  terpilih: boolean
  ubah: (v: string) => void
  nilai: string
  judul: ReactNode
  keterangan?: ReactNode
  kanan?: ReactNode
  anakan?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => ubah(nilai)}
      aria-pressed={terpilih}
      className={cx(
        'w-full text-left rounded-lg border-2 p-3.5 transition-[border-color,background-color] duration-150',
        terpilih ? 'border-brand bg-brand-soft/40' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className="flex items-start gap-3">
        <span
          className={cx(
            'shrink-0 mt-0.5 size-5 rounded-full border-2 grid place-items-center transition-colors',
            terpilih ? 'border-brand' : 'border-line-strong',
          )}
        >
          {terpilih && <span className="size-2.5 rounded-full bg-brand" />}
        </span>
        <span className="min-w-0 grow">
          <span className="block text-[0.9375rem] font-bold text-ink leading-snug">{judul}</span>
          {keterangan && (
            <span className="block text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">{keterangan}</span>
          )}
          {anakan}
        </span>
        {kanan && <span className="shrink-0 text-right">{kanan}</span>}
      </span>
    </button>
  )
}
