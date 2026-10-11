import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { TabSegmen } from '@/components/ui/navigasi'
import { Peringatan } from '@/components/ui/umpanBalik'
import { IkonMata, IkonMataTutup, IkonTelepon } from '@/icons'
import { cx, nomorHp } from '@/lib/format'
import { profilAwal } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Masuk berdiri di luar kerangka 4 tab, jadi ia membangun tata letaknya sendiri:
 * satu kolom terpusat, kartu putih, tanpa navigasi bawah.
 *
 * Nomor HP jadi cara masuk utama karena itulah yang selalu diingat pemilik
 * warung dan satu-satunya kanal yang kami pakai untuk mengabari hasil verifikasi.
 * Email disimpan sebagai tab kedua, bukan dihapus, karena sebagian pemilik
 * mendaftarkan usahanya lewat email kantor.
 */
export default function Masuk() {
  const navigate = useNavigate()
  const aturMasuk = useAplikasi((s) => s.aturMasuk)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [tab, setTab] = useState<'hp' | 'email'>('hp')
  const [hp, setHp] = useState('')
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState<{ hp?: string; email?: string; sandi?: string }>({})
  const [memuat, setMemuat] = useState(false)
  const [percobaanGagal, setPercobaanGagal] = useState(0)

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  function kirim() {
    const baru: typeof galat = {}
    if (tab === 'hp') {
      const g = periksaHp(hp)
      if (g) baru.hp = g
    } else {
      const g = periksaEmail(email)
      if (g) baru.email = g
    }
    if (sandi.length === 0) {
      baru.sandi = 'Kata sandi belum diisi. Tulis kata sandi yang kamu pakai saat mendaftar. Contoh: warungku2024.'
    }
    setGalat(baru)
    if (Object.keys(baru).length > 0) {
      setPercobaanGagal((n) => n + 1)
      return
    }

    /* Isian sengaja tidak dikosongkan saat menunggu: kalau sesuatu meleset,
       pengguna tidak perlu mengetik ulang dari nol. */
    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      aturMasuk(true)
      tampilkanRacun('Selamat datang kembali di Warungku.', 'aman')
      navigate('/beranda')
    }, 700)
  }

  function isiAkunContoh() {
    setTab('hp')
    setHp(profilAwal.nomorHp)
    setSandi('warungku2024')
    setGalat({})
  }

  return (
    <LayarAuth>
      <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Masuk ke Warungku</h1>
      <p className="mt-1 text-[0.875rem] text-ink-3 leading-relaxed">
        Pakai nomor HP yang kamu daftarkan. Nomor itu juga yang kami hubungi kalau ada kabar soal pesanan.
      </p>

      <TabSegmen
        className="mt-4"
        aktif={tab}
        ubah={(v) => {
          setTab(v)
          setGalat({})
        }}
        tab={[
          { nilai: 'hp', label: 'Pakai Nomor HP' },
          { nilai: 'email', label: 'Pakai Email' },
        ]}
      />

      {/* Formulir sungguhan supaya tombol Enter di papan ketik HP ikut mengirim. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          kirim()
        }}
        className="mt-4 space-y-4"
      >
        {tab === 'hp' ? (
          <Kolom
            label="Nomor HP"
            wajib
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="081234567890"
            value={hp}
            galat={galat.hp}
            onChange={(e) => setHp(e.target.value.replace(/[^\d+]/g, ''))}
          />
        ) : (
          <Kolom
            label="Email"
            wajib
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="halo@kopikita.id"
            value={email}
            galat={galat.email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        <KolomSandi
          label="Kata Sandi"
          nilai={sandi}
          ubah={setSandi}
          galat={galat.sandi}
          autoComplete="current-password"
        />

        <div className="flex justify-end -mt-1">
          <Link
            to="/lupa-sandi"
            className="inline-flex items-center min-h-11 px-1 text-[0.8125rem] font-bold text-brand hover:underline underline-offset-2"
          >
            Lupa kata sandi
          </Link>
        </div>

        <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
          {memuat ? 'Sedang membuka akun kamu' : 'Masuk'}
        </Tombol>
      </form>

      <p className="mt-5 text-center text-[0.875rem] text-ink-2">
        Belum punya akun?{' '}
        <Link
          to="/daftar"
          className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
        >
          Daftar
        </Link>
      </p>

      {/* Purwarupa: satu ketukan untuk mencoba tanpa mengingat nomor contoh. */}
      <div className="mt-5 pt-4 border-t border-line">
        <Peringatan nada="netral" judul="Mau melihat-lihat dulu?">
          Akun contoh memakai nomor {nomorHp(profilAwal.nomorHp)} atas nama {profilAwal.namaUsaha}.
          <button
            type="button"
            onClick={isiAkunContoh}
            className="mt-1 inline-flex items-center gap-1.5 min-h-11 text-[0.8125rem] font-bold underline underline-offset-2"
          >
            <IkonTelepon size={14} />
            Isikan nomor akun contoh
          </button>
        </Peringatan>
      </div>
    </LayarAuth>
  )
}

/* ================================================================== */
/* Bagian yang hanya dipakai layar ini                                */
/* ================================================================== */

/** Kerangka layar di luar 4 tab: satu kolom terpusat, kartu di tengah. */
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

const KELAS_SANDI =
  'w-full h-12 pl-3.5 pr-14 rounded-md bg-surface text-ink text-[0.9375rem] ' +
  'border border-line-strong placeholder:text-ink-3/70 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]'

/**
 * Kolom kata sandi dengan tombol mata.
 *
 * Tidak memakai komponen Kolom karena akhirannya sengaja tidak bisa ditekan,
 * sementara tombol mata di sini harus punya target sentuh penuh 44px.
 */
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
 * Setelah pesan kesalahan muncul, kolom pertama yang salah langsung dibawa ke
 * layar dan diberi fokus. Tanpa ini, di HP pesannya sering berada di bawah
 * papan ketik dan pengguna cuma melihat tombol yang seperti tidak bereaksi.
 */
function sorotGalatPertama() {
  const kolom = document.querySelector<HTMLElement>(
    'input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"]',
  )
  kolom?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  kolom?.focus({ preventScroll: true })
}

/** Pesan kesalahan selalu tiga unsur: apa yang salah, cara memperbaiki, contoh benar. */
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

function periksaEmail(v: string): string | null {
  const t = v.trim()
  if (t.length === 0) {
    return 'Email belum diisi. Tulis email yang kamu pakai saat mendaftar. Contoh: halo@kopikita.id.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) {
    return 'Email harus memuat tanda @ dan nama domain. Perbaiki penulisannya. Contoh: halo@kopikita.id.'
  }
  return null
}
