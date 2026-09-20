import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { IkonMata, IkonMataTutup } from '@/icons'
import { cx } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Langkah 1 dari 5: hanya nomor HP dan kata sandi.
 *
 * Akun sengaja dibuat di langkah pertama, bukan di akhir. Pendaftaran lima
 * layar hampir selalu terputus di tengah (baterai habis, pembeli datang), dan
 * kalau akunnya baru lahir di langkah tiga, semua isian sebelumnya ikut hilang.
 * Dengan pola ini nomor HP-nya sudah bisa dihubungi sejak menit pertama.
 */
export default function Daftar() {
  const navigate = useNavigate()
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [hp, setHp] = useState('')
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState<{ hp?: string; sandi?: string }>({})
  const [memuat, setMemuat] = useState(false)
  const [percobaanGagal, setPercobaanGagal] = useState(0)

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  function lanjut() {
    const baru: typeof galat = {}
    const gHp = periksaHp(hp)
    if (gHp) baru.hp = gHp
    const gSandi = periksaSandi(sandi)
    if (gSandi) baru.sandi = gSandi
    setGalat(baru)
    if (Object.keys(baru).length > 0) {
      setPercobaanGagal((n) => n + 1)
      return
    }

    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      ubahProfil({ nomorHp: hp.replace(/\D/g, '') })
      tampilkanRacun('Akun tersimpan. Nomor HP kamu sudah bisa dipakai masuk.', 'aman')
      navigate('/daftar/usaha')
    }, 650)
  }

  return (
    <LayarAuth langkah={1} judul="Buat Akun">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          lanjut()
        }}
      >
        <p className="text-[0.875rem] text-ink-3 leading-relaxed">
          Dua isian dulu. Sisanya bisa dilanjutkan setelah ini.
        </p>

        <div className="mt-4 space-y-4">
          <Kolom
            label="Nomor HP"
            wajib
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="081234567890"
            value={hp}
            galat={galat.hp}
            bantuan="Pakai nomor yang aktif WhatsApp-nya. Ke sinilah kabar pesanan dan hasil verifikasi dikirim."
            onChange={(e) => setHp(e.target.value.replace(/[^\d+]/g, ''))}
          />

          <KolomSandi
            label="Kata Sandi"
            nilai={sandi}
            ubah={setSandi}
            galat={galat.sandi}
            bantuan="Minimal 8 karakter. Boleh huruf dan angka."
            autoComplete="new-password"
          />
        </div>

        <div className="mt-5 rounded-md bg-brand-soft text-brand-soft-ink p-3.5 text-[0.8125rem] leading-relaxed">
          Begitu tombol di bawah ditekan, akunmu langsung tercipta. Kalau pendaftaran terputus di tengah jalan,
          isian yang sudah masuk tidak hilang &mdash; tinggal masuk lagi pakai nomor ini dan lanjut dari langkah
          terakhir.
        </div>

        <p className="mt-5 text-center text-[0.875rem] text-ink-2">
          Sudah punya akun?{' '}
          <Link
            to="/masuk"
            className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
          >
            Masuk
          </Link>
        </p>

        <BilahLanjut>
          <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
            {memuat ? 'Sedang membuat akun' : 'Lanjut ke Data Usaha'}
          </Tombol>
        </BilahLanjut>
      </form>
    </LayarAuth>
  )
}

/* ================================================================== */
/* Bagian yang hanya dipakai layar ini                                */
/* ================================================================== */

/**
 * Tombol utama langkah pendaftaran menempel di bawah layar.
 * Di HP, isian terakhir sering tertutup papan ketik; tombol yang ikut menggulir
 * membuat pengguna mengira langkahnya belum selesai.
 */
function BilahLanjut({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-4 bg-surface/95 backdrop-blur-sm border-t border-line rounded-b-lg">
      {children}
    </div>
  )
}

/**
 * Kerangka langkah pendaftaran: logo, bar progres tipis, lalu kartu isian.
 *
 * Penyebutnya 5, bukan 3, karena alur sebenarnya belum selesai di layar
 * legalitas: masih ada data kasir dan batas aman. Penyebut yang berbeda antar
 * layar membuat bilah progres mundur dari penuh ke 80% tepat setelah pengguna
 * diberi tahu ia menyelesaikan langkah terakhir.
 */
function LayarAuth({
  langkah,
  judul,
  children,
}: {
  langkah: number
  judul: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-bg px-4 pt-aman pb-aman">
      <div className="w-full max-w-[28rem] mx-auto py-8 sm:py-12">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span
            className="size-9 rounded-md bg-brand text-ink-inverse grid place-items-center font-extrabold text-[1.125rem] leading-none"
            aria-hidden="true"
          >
            W
          </span>
          <span className="text-[1.125rem] font-extrabold text-ink tracking-tight">Warungku</span>
        </div>

        <div className="bg-surface border border-line rounded-lg shadow-e1 p-5 sm:p-6 anim-muncul">
          <div className="mb-4">
            <div
              className="h-1 w-full rounded-full bg-sunken overflow-hidden"
              role="progressbar"
              aria-valuenow={langkah}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-label={`Langkah ${langkah} dari 5`}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${(langkah / 5) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">{judul}</h1>
              <span className="text-[0.8125rem] font-semibold text-ink-3 shrink-0">Langkah {langkah} dari 5</span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

const KELAS_SANDI =
  'w-full h-12 pl-3.5 pr-14 rounded-md bg-surface text-ink text-[0.9375rem] ' +
  'border border-line-strong placeholder:text-ink-3/70 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]'

/** Tombol mata butuh target sentuh penuh, jadi kolom ini tidak memakai akhiran Kolom. */
function KolomSandi({
  label,
  nilai,
  ubah,
  galat,
  bantuan,
  autoComplete,
}: {
  label: string
  nilai: string
  ubah: (v: string) => void
  galat?: string
  bantuan?: string
  autoComplete?: string
}) {
  const id = useId()
  const [lihat, setLihat] = useState(false)

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
        {label}
        <span className="text-kritis ml-0.5" aria-hidden="true">
          *
        </span>
      </label>
      <div className="relative">
        <input
          id={id}
          type={lihat ? 'text' : 'password'}
          value={nilai}
          autoComplete={autoComplete}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat ? `${id}-galat` : bantuan ? `${id}-bantuan` : undefined}
          onChange={(e) => ubah(e.target.value)}
          className={cx(KELAS_SANDI, galat && 'border-kritis focus:border-kritis')}
        />
        <button
          type="button"
          onClick={() => setLihat((v) => !v)}
          aria-pressed={lihat}
          aria-label={lihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
          title={lihat ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 size-11 grid place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-sunken transition-colors"
        >
          {lihat ? <IkonMataTutup size={20} /> : <IkonMata size={20} />}
        </button>
      </div>
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

/**
 * Kolom pertama yang salah dibawa ke layar dan diberi fokus. Di HP, pesan
 * kesalahan sering tertutup papan ketik, dan tombol yang "tidak bereaksi"
 * membuat pengguna menekannya berkali-kali.
 */
function sorotGalatPertama() {
  const kolom = document.querySelector<HTMLElement>(
    'input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"]',
  )
  kolom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  kolom?.focus({ preventScroll: true })
}

function periksaHp(v: string): string | null {
  const d = v.replace(/\D/g, '')
  if (d.length === 0) {
    return 'Nomor HP belum diisi. Tulis nomor HP aktif yang diawali 08. Contoh: 081234567890.'
  }
  if (!d.startsWith('08') || d.length < 10 || d.length > 13) {
    return 'Nomor HP harus diawali 08 dan berisi 10-13 angka. Contoh: 081234567890.'
  }
  return null
}

function periksaSandi(v: string): string | null {
  if (v.length === 0) {
    return 'Kata sandi belum diisi. Buat kata sandi minimal 8 karakter yang mudah kamu ingat. Contoh: warungku2024.'
  }
  if (v.length < 8) {
    return 'Kata sandi masih kurang dari 8 karakter. Tambahkan huruf atau angka lagi. Contoh: warungku2024.'
  }
  return null
}
