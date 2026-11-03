import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KartuSambungDistributor } from '@/components/domain/SambungDistributor'
import { useAplikasi } from '@/store/aplikasi'
import { LayarAuth } from '@/components/ui/LayarAuth'

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
    <LayarAuth kartu={false}>
        <h1 className="text-judul font-extrabold text-ink tracking-tight text-center">Masuk ke Portal Distributor</h1>
        <p className="mt-1 mb-4 text-isi text-ink-3 leading-relaxed text-center">
          Kelola pesanan masuk, kontrak, promo, dan lihat segmen pelangganmu.
        </p>
        <KartuSambungDistributor keterangan="Pakai email dan kata sandi akun distributor." />
        <p className="mt-5 text-center text-isi text-ink-2">
          Pemilik usaha?{' '}
          <Link
            to="/masuk"
            className="inline-flex items-center min-h-11 px-1 font-bold text-brand hover:underline underline-offset-2"
          >
            Masuk di sini
          </Link>
        </p>
    </LayarAuth>
  )
}
