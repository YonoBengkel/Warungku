import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Kartu, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { GalatApi, ServerTakTerjangkau } from '@/lib/api'
import { AKUN_KOPI_KITA } from '@/lib/akunSimulasi'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Masuk ke Portal POS. Untuk sekarang memakai akun usaha yang sudah ada; akun
 * kasir khusus menyusul. Sesi tersimpan per tab, jadi portal ini bisa terbuka
 * berdampingan dengan Portal UMKM.
 */
export default function MasukPos() {
  const navigate = useNavigate()
  const sesi = useAplikasi((s) => s.sesiServer)
  const masukServer = useAplikasi((s) => s.masukServer)
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (sesi) navigate('/pos', { replace: true })
  }, [sesi, navigate])

  function kirim() {
    setMemuat(true)
    setGalat(null)
    masukServer(email.trim(), sandi)
      .catch((e: unknown) => {
        setGalat(
          e instanceof ServerTakTerjangkau
            ? 'Turnify Flow belum bisa dihubungi. Portal POS butuh server, jadi pastikan layanannya menyala.'
            : e instanceof GalatApi
              ? e.message
              : 'Gagal masuk. Coba lagi sebentar lagi.',
        )
      })
      .finally(() => setMemuat(false))
  }

  return (
    <div className="min-h-dvh bg-bg px-4 pt-aman pb-aman">
      <div className="w-full max-w-[28rem] mx-auto py-8 sm:py-12">
        <h1 className="text-judul font-extrabold text-ink tracking-tight text-center">Masuk ke Portal POS</h1>
        <p className="mt-1 mb-4 text-isi text-ink-3 leading-relaxed text-center">
          Catat penjualan di konter. Stok usahamu ikut berkurang dari setiap nota.
        </p>
        <Kartu>
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              kirim()
            }}
          >
            <Kolom
              label="Email usaha"
              wajib
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Kolom
              label="Kata sandi"
              wajib
              type="password"
              autoComplete="current-password"
              value={sandi}
              galat={galat ?? undefined}
              onChange={(e) => setSandi(e.target.value)}
            />
            <div className="flex flex-wrap gap-2.5">
              <Tombol type="submit" memuat={memuat}>
                Masuk
              </Tombol>
              <Tombol
                ragam="garis"
                onClick={() => {
                  setEmail(AKUN_KOPI_KITA.email)
                  setSandi(AKUN_KOPI_KITA.kataSandi)
                  setGalat(null)
                }}
              >
                Isikan akun simulasi
              </Tombol>
            </div>
          </form>
          <p className="mt-3 text-kecil text-ink-3">Akun simulasi {AKUN_KOPI_KITA.email} adalah {AKUN_KOPI_KITA.namaUsaha}.</p>
        </Kartu>
        <p className="mt-5 text-center text-isi text-ink-2">
          Pemilik usaha?{' '}
          <Link
            to="/masuk"
            className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
          >
            Masuk ke Portal UMKM
          </Link>
        </p>
      </div>
    </div>
  )
}
