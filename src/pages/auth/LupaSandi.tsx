import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tombol } from '@/components/ui/dasar'
import { Kolom, kelasBingkai } from '@/components/ui/formulir'
import { IkonKembali, IkonMata, IkonMataTutup } from '@/icons'
import { cx, nomorHp } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

const JEDA_KIRIM_ULANG = 60

/**
 * Tiga keadaan dalam satu layar: minta nomor, minta kode, lalu buat sandi baru.
 *
 * Sengaja tidak dipecah jadi tiga rute supaya tombol kembali perangkat tidak
 * melempar pengguna keluar dari alur di tengah menunggu SMS. Kata sandi baru
 * dibuat sendiri di sini, tidak pernah dikirimkan lewat SMS, karena sandi yang
 * pernah lewat pesan teks berhenti jadi rahasia.
 */
export default function LupaSandi() {
  const navigate = useNavigate()
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [tahap, setTahap] = useState<'nomor' | 'kode' | 'sandi'>('nomor')
  const [hp, setHp] = useState('')
  const [galatHp, setGalatHp] = useState<string | undefined>()
  const [galatKode, setGalatKode] = useState<string | undefined>()
  const [galatSandi, setGalatSandi] = useState<string | undefined>()
  const [kode, setKode] = useState<string[]>(Array(6).fill(''))
  const [sandi, setSandi] = useState('')
  const [sisaDetik, setSisaDetik] = useState(JEDA_KIRIM_ULANG)
  const [memuat, setMemuat] = useState(false)
  const [percobaanGagal, setPercobaanGagal] = useState(0)
  const kotakRef = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  useEffect(() => {
    if (tahap !== 'kode' || sisaDetik <= 0) return
    const t = window.setInterval(() => setSisaDetik((d) => Math.max(0, d - 1)), 1000)
    return () => window.clearInterval(t)
  }, [tahap, sisaDetik])

  function kirimKode() {
    const g = periksaHp(hp)
    setGalatHp(g ?? undefined)
    if (g) {
      setPercobaanGagal((n) => n + 1)
      return
    }

    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      setTahap('kode')
      setSisaDetik(JEDA_KIRIM_ULANG)
      setKode(Array(6).fill(''))
      window.setTimeout(() => kotakRef.current[0]?.focus(), 50)
    }, 700)
  }

  function kirimUlang() {
    setSisaDetik(JEDA_KIRIM_ULANG)
    setKode(Array(6).fill(''))
    setGalatKode(undefined)
    kotakRef.current[0]?.focus()
    tampilkanRacun(`Kode baru terkirim lewat SMS ke ${nomorHp(hp)}.`, 'info')
  }

  function isiKotak(i: number, nilai: string) {
    const angkaSaja = nilai.replace(/\D/g, '')
    if (angkaSaja.length === 0) {
      setKode((k) => k.map((x, idx) => (idx === i ? '' : x)))
      return
    }
    /* Satu kotak boleh menerima tempelan penuh: kode dari SMS biasanya disalin
       sekaligus, bukan diketik satu-satu. */
    setKode((k) => {
      const baru = [...k]
      for (let j = 0; j < angkaSaja.length && i + j < 6; j += 1) baru[i + j] = angkaSaja[j]
      return baru
    })
    setGalatKode(undefined)
    const berikut = Math.min(5, i + angkaSaja.length)
    kotakRef.current[berikut]?.focus()
    kotakRef.current[berikut]?.select()
  }

  function tombolKotak(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && kode[i] === '' && i > 0) {
      e.preventDefault()
      setKode((k) => k.map((x, idx) => (idx === i - 1 ? '' : x)))
      kotakRef.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && i > 0) kotakRef.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) kotakRef.current[i + 1]?.focus()
  }

  function periksaKode() {
    const gabung = kode.join('')
    if (gabung.length < 6) {
      setGalatKode(
        gabung.length === 0
          ? 'Kode belum diisi. Ketik 6 angka dari SMS yang masuk ke nomor kamu. Contoh: 482159.'
          : `Kode baru terisi ${gabung.length} dari 6 angka. Lengkapi sisa kotaknya sesuai SMS yang masuk. Contoh: 482159.`,
      )
      /* Fokus dibawa ke kotak kosong pertama supaya pengguna tidak perlu
         menebak kotak mana yang belum terisi. */
      const kosong = kode.findIndex((x) => x === '')
      kotakRef.current[kosong < 0 ? 0 : kosong]?.focus()
      return
    }
    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      setTahap('sandi')
    }, 700)
  }

  function simpanSandi() {
    const g = periksaSandi(sandi)
    setGalatSandi(g ?? undefined)
    if (g) {
      setPercobaanGagal((n) => n + 1)
      return
    }

    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      tampilkanRacun('Kata sandi baru tersimpan. Silakan masuk memakai sandi itu.', 'aman')
      navigate('/masuk')
    }, 700)
  }

  return (
    <LayarAuth>
      {tahap === 'nomor' && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            kirimKode()
          }}
        >
          <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Lupa Kata Sandi</h1>
          <p className="mt-1 text-[0.875rem] text-ink-3 leading-relaxed">
            Tulis nomor HP yang kamu pakai mendaftar. Kami kirim kode 6 angka lewat SMS ke nomor itu.
          </p>

          <div className="mt-4">
            <Kolom
              label="Nomor HP"
              wajib
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="081234567890"
              value={hp}
              galat={galatHp}
              onChange={(e) => setHp(e.target.value.replace(/[^\d+]/g, ''))}
            />
          </div>

          <div className="mt-5">
            <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
              {memuat ? 'Sedang mengirim kode' : 'Kirim Kode'}
            </Tombol>
          </div>

          <p className="mt-5 text-center text-[0.875rem] text-ink-2">
            Ingat kata sandinya?{' '}
            <Link
              to="/masuk"
              className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
            >
              Kembali ke Masuk
            </Link>
          </p>
        </form>
      )}

      {tahap === 'kode' && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            periksaKode()
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTahap('nomor')
              setGalatKode(undefined)
            }}
            className="inline-flex items-center gap-1.5 h-11 -ml-1.5 pr-2.5 pl-1.5 rounded-md text-[0.8125rem] font-semibold text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
          >
            <IkonKembali size={18} />
            Ubah nomor
          </button>

          <h1 className="mt-2 text-[1.25rem] font-extrabold text-ink tracking-tight">Masukkan Kode</h1>
          <p className="mt-1 text-[0.875rem] text-ink-3 leading-relaxed">
            Kode 6 angka sudah dikirim lewat SMS ke{' '}
            <span className="font-semibold text-ink-2">{nomorHp(hp)}</span>. Biasanya sampai dalam satu menit.
          </p>

          <div
            role="group"
            aria-label="Kode 6 angka dari SMS"
            className="mt-5 grid grid-cols-6 gap-1.5 sm:gap-2.5"
          >
            {kode.map((nilai, i) => (
              <input
                key={i}
                ref={(el) => {
                  kotakRef.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                value={nilai}
                aria-label={`Angka ke-${i + 1}`}
                aria-invalid={galatKode ? true : undefined}
                aria-describedby={galatKode ? 'galat-kode' : undefined}
                onChange={(e) => isiKotak(i, e.target.value)}
                onKeyDown={(e) => tombolKotak(i, e)}
                onFocus={(e) => e.target.select()}
                className={cx(
                  'h-14 w-full rounded-md bg-surface text-center text-[1.25rem] font-extrabold text-ink tabular',
                  'border transition-[border-color,box-shadow] duration-150',
                  'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]',
                  galatKode ? 'border-kritis' : 'border-line-strong',
                )}
              />
            ))}
          </div>

          {galatKode && (
            <p id="galat-kode" className="mt-2 text-[0.8125rem] text-kritis font-medium leading-snug">
              {galatKode}
            </p>
          )}

          <div className="mt-4 min-h-11 flex items-center">
            {sisaDetik > 0 ? (
              <p className="text-[0.8125rem] text-ink-3">
                Belum masuk? Kirim ulang bisa dalam{' '}
                <span className="font-bold text-ink-2 tabular">{sisaDetik} detik</span>.
              </p>
            ) : (
              <button
                type="button"
                onClick={kirimUlang}
                className="inline-flex items-center h-11 -ml-1 px-1 text-[0.875rem] font-bold text-brand hover:underline underline-offset-2"
              >
                Kirim ulang kode
              </button>
            )}
          </div>

          <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
            {memuat ? 'Sedang memeriksa kode' : 'Lanjutkan'}
          </Tombol>

          <p className="mt-4 text-[0.8125rem] text-ink-3 leading-relaxed">
            Nomor sudah tidak aktif? Hubungi kami lewat menu Bantuan, sertakan nama usaha dan alamatnya.
          </p>
        </form>
      )}

      {tahap === 'sandi' && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            simpanSandi()
          }}
        >
          <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Buat Kata Sandi Baru</h1>
          <p className="mt-1 text-[0.875rem] text-ink-3 leading-relaxed">
            Kodenya cocok. Sekarang buat kata sandi baru untuk nomor{' '}
            <span className="font-semibold text-ink-2">{nomorHp(hp)}</span>.
          </p>

          <div className="mt-4">
            <KolomSandi
              label="Kata Sandi Baru"
              nilai={sandi}
              ubah={(v) => {
                setSandi(v)
                setGalatSandi(undefined)
              }}
              galat={galatSandi}
              bantuan="Minimal 8 karakter. Boleh huruf dan angka."
              autoComplete="new-password"
            />
          </div>

          <div className="mt-5">
            <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
              {memuat ? 'Sedang menyimpan' : 'Simpan Kata Sandi'}
            </Tombol>
          </div>

          <p className="mt-4 text-[0.8125rem] text-ink-3 leading-relaxed">
            Setelah tersimpan, kamu diantar ke layar Masuk dan bisa langsung memakai kata sandi yang baru.
          </p>
        </form>
      )}
    </LayarAuth>
  )
}

/* ================================================================== */
/* Bagian yang hanya dipakai layar ini                                */
/* ================================================================== */

/** Kolom yang salah dibawa ke layar supaya tombol tidak terasa mati di HP. */
function sorotGalatPertama() {
  const kolom = document.querySelector<HTMLElement>('input[aria-invalid="true"]')
  kolom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  kolom?.focus({ preventScroll: true })
}

function LayarAuth({ children }: { children: ReactNode }) {
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
        <div className="bg-surface border border-line rounded-lg shadow-e1 p-5 sm:p-6 anim-muncul">{children}</div>
      </div>
    </div>
  )
}

/* Warna bingkai tidak ditulis di sini: `kelasBingkai` memilih abu-abu atau
   merah, supaya keduanya tidak terpasang bersamaan. */
const KELAS_SANDI =
  'w-full h-12 pl-3.5 pr-14 rounded-md bg-surface text-ink text-[0.9375rem] ' +
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

function periksaHp(v: string): string | null {
  const d = v.replace(/\D/g, '')
  if (d.length === 0) {
    return 'Nomor HP belum diisi. Tulis nomor HP yang kamu pakai mendaftar, diawali 08. Contoh: 081234567890.'
  }
  if (!d.startsWith('08') || d.length < 10 || d.length > 13) {
    return 'Nomor HP harus diawali 08 dan berisi 10-13 angka. Contoh: 081234567890.'
  }
  return null
}

function periksaSandi(v: string): string | null {
  if (v.length === 0) {
    return 'Kata sandi baru belum diisi. Buat kata sandi minimal 8 karakter yang mudah kamu ingat. Contoh: warungku2024.'
  }
  if (v.length < 8) {
    return 'Kata sandi masih kurang dari 8 karakter. Tambahkan huruf atau angka lagi. Contoh: warungku2024.'
  }
  return null
}
