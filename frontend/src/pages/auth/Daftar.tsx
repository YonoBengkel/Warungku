import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Tombol } from '@/components/ui/dasar'
import { Kolom, kelasBingkai } from '@/components/ui/formulir'
import { IkonMata, IkonMataTutup } from '@/icons'
import { cx } from '@/lib/format'
import { simpanIsianDaftar } from '@/lib/pendaftaran'
import { useAplikasi } from '@/store/aplikasi'
import { CATATAN_DAFTAR, LayarAuth } from '@/components/ui/LayarAuth'

/**
 * Langkah 1 dari 5: hanya nomor HP dan kata sandi.
 *
 * Akunnya dibuat di langkah 2, karena server butuh data usaha sekaligus. Sesudah itu
 * pendaftar sudah masuk, jadi langkah 3 sampai 5 boleh terputus tanpa kehilangan akun.
 */
export default function Daftar() {
  const navigate = useNavigate()
  const sudahAkun = useAplikasi((s) => s.sesiServer != null)

  const [hp, setHp] = useState('')
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState<{ hp?: string; sandi?: string }>({})
  const [percobaanGagal, setPercobaanGagal] = useState(0)

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  // Akunnya sudah ada: nomor dan kata sandi yang diisi di sini tidak akan terpakai.
  if (sudahAkun) return <Navigate to="/daftar/usaha" replace />

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

    simpanIsianDaftar(hp.replace(/\D/g, ''), sandi)
    navigate('/daftar/usaha')
  }

  return (
    <LayarAuth langkah={1} judul="Buat Akun" purwarupa={CATATAN_DAFTAR}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          lanjut()
        }}
      >
        <p className="text-isi text-ink-3 leading-relaxed">
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
            bantuan="Nomor ini tampil untuk distributor yang menerima pesananmu."
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

        <div className="mt-5 rounded-md bg-brand-soft text-brand-soft-ink p-3.5 text-isi leading-relaxed">
          Akunmu dibuat di langkah berikutnya, begitu data usaha terisi. Sesudah itu kamu masuk dengan email di langkah
          itu dan kata sandi ini.
        </div>

        <p className="mt-5 text-center text-isi text-ink-2">
          Sudah punya akun?{' '}
          <Link
            to="/masuk"
            className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
          >
            Masuk
          </Link>
        </p>

        <BilahLanjut>
          <Tombol type="submit" penuh ukuran="besar">
            Lanjut ke Data Usaha
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

/* Warna bingkai tidak ditulis di sini: `kelasBingkai` memilih abu-abu atau
   merah, supaya keduanya tidak terpasang bersamaan. */
const KELAS_SANDI =
  'w-full h-12 pl-3.5 pr-14 rounded-md bg-surface text-ink text-kartu ' +
  'border placeholder:text-ink-3/70 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:outline-none focus:ring-4'

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
      <label htmlFor={id} className="block text-isi font-semibold text-ink-2 mb-1.5">
        {label}
        <span className="text-ink-3 ml-0.5" aria-hidden="true">
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
          className={cx(KELAS_SANDI, kelasBingkai(galat))}
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
        <p id={`${id}-galat`} className="mt-1.5 text-isi text-kritis font-medium leading-snug">
          {galat}
        </p>
      ) : bantuan ? (
        <p id={`${id}-bantuan`} className="mt-1.5 text-isi text-ink-3 leading-snug">
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
    return 'Kata sandi belum diisi. Buat kata sandi minimal 8 karakter yang mudah kamu ingat. Contoh: turnify2024.'
  }
  if (v.length < 8) {
    return 'Kata sandi masih kurang dari 8 karakter. Tambahkan huruf atau angka lagi. Contoh: turnify2024.'
  }
  return null
}
