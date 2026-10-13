import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KartuSambungDistributor } from '@/components/domain/SambungDistributor'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Masuk ke portal distributor.
 *
 * Pintu terpisah dari Masuk pemilik usaha, sama seperti di API: akun
 * distributor yang salah masuk ke pintu UMKM ditolak dengan penjelasan, dan
 * tokennya berbeda jenis. Setelah berhasil, portal distributor membaca pesanan,
 * kontrak, promo, dan segmen pelanggan dari server.
 */
export default function MasukDistributor() {
  const navigate = useNavigate()
  const sesi = useAplikasi((s) => s.sesiDistributor)
  const aturPeran = useAplikasi((s) => s.aturPeran)

  useEffect(() => {
    if (!sesi) return
    aturPeran('distributor')
    navigate('/distributor-portal', { replace: true })
  }, [sesi, aturPeran, navigate])

  return (
    <div className="min-h-dvh bg-bg px-4 pt-aman pb-aman">
      <div className="w-full max-w-[28rem] mx-auto py-8 sm:py-12">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span
            className="size-9 rounded-md bg-brand text-ink-inverse grid place-items-center font-extrabold text-[1.125rem] leading-none"
            aria-hidden="true"
          >
            T
          </span>
          <span className="text-[1.125rem] font-extrabold text-ink tracking-tight">Turnify Flow</span>
        </div>
        <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight text-center">Masuk ke Portal Distributor</h1>
        <p className="mt-1 mb-4 text-[0.875rem] text-ink-3 leading-relaxed text-center">
          Kelola pesanan masuk, kontrak, promo, dan lihat segmen pelangganmu.
        </p>
        <KartuSambungDistributor keterangan="Pakai email dan kata sandi akun distributor." />
        <p className="mt-5 text-center text-[0.875rem] text-ink-2">
          Pemilik usaha?{' '}
          <Link
            to="/masuk"
            className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
          >
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  )
}
