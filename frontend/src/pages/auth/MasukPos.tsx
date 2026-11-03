import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Kartu, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { GalatApi, ServerTakTerjangkau } from '@/lib/api'
import { AKUN_KASIR, AKUN_KOPI_KITA } from '@/lib/akunSimulasi'
import { useAplikasi } from '@/store/aplikasi'
import { LayarAuth } from '@/components/ui/LayarAuth'

function pesanGalat(e: unknown): string {
  if (e instanceof ServerTakTerjangkau) {
    return 'Turnify Flow belum bisa dihubungi. Portal POS butuh server, jadi pastikan layanannya menyala.'
  }
  return e instanceof GalatApi ? e.message : 'Gagal masuk. Coba lagi sebentar lagi.'
}

/**
 * Masuk ke Portal POS, untuk pemilik dan untuk akun kasir yang dibuat pemilik di
 * Pengguna & Hak Akses. Sesi tersimpan per tab, jadi portal ini bisa terbuka
 * berdampingan dengan Portal UMKM.
 */
export default function MasukPos() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sesi = useAplikasi((s) => s.sesiServer)
  const masukPos = useAplikasi((s) => s.masukPos)
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  /* "Masuk Kasir" di Alat uji purwarupa membuka halaman ini di tab baru dengan
     ?kasir=1&langsung=1 (revisi V8, Q174): kasir simulasi langsung masuk tanpa
     menekan tombol. Selama itu, sesi lain yang mungkin sudah ada di tab ini
     tidak dipakai untuk melompat ke /pos, supaya tab ini benar-benar milik kasir. */
  const langsung = searchParams.get('kasir') === '1' && searchParams.get('langsung') === '1'

  useEffect(() => {
    if (sesi && !langsung) navigate('/pos', { replace: true })
  }, [sesi, langsung, navigate])

  useEffect(() => {
    if (!langsung) return
    let batal = false
    setMemuat(true)
    masukPos(AKUN_KASIR.email, AKUN_KASIR.kataSandi)
      .then(() => {
        if (!batal) navigate('/pos', { replace: true })
      })
      .catch((e: unknown) => {
        if (!batal) setGalat(pesanGalat(e))
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [langsung, masukPos, navigate])

  useEffect(() => {
    if (searchParams.get('kasir') === '1') {
      setEmail(AKUN_KASIR.email)
      setSandi(AKUN_KASIR.kataSandi)
    } else if (searchParams.get('pemilik') === '1') {
      setEmail(AKUN_KOPI_KITA.email)
      setSandi(AKUN_KOPI_KITA.kataSandi)
    }
  }, [searchParams])

  function kirim() {
    setMemuat(true)
    setGalat(null)
    masukPos(email.trim(), sandi)
      .then(() => navigate('/pos', { replace: true }))
      .catch((e: unknown) => setGalat(pesanGalat(e)))
      .finally(() => setMemuat(false))
  }

  return (
    <LayarAuth kartu={false}>
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
                Isikan akun pemilik
              </Tombol>
              <Tombol
                ragam="garis"
                onClick={() => {
                  setEmail(AKUN_KASIR.email)
                  setSandi(AKUN_KASIR.kataSandi)
                  setGalat(null)
                }}
              >
                Isikan akun kasir
              </Tombol>
            </div>
          </form>
          <p className="mt-3 text-kecil text-ink-3">
            Akun simulasi {AKUN_KOPI_KITA.email} adalah pemilik {AKUN_KOPI_KITA.namaUsaha}, dan {AKUN_KASIR.email} adalah kasirnya.
          </p>
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
    </LayarAuth>
  )
}
