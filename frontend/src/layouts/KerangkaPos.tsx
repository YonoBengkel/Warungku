import { Navigate, useNavigate } from 'react-router-dom'
import { Avatar, Tombol } from '@/components/ui/dasar'
import { IkonKeluar } from '@/icons'
import { IsiHalaman, MemuatHalaman } from '@/layouts/IsiHalaman'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Kerangka Portal POS: bilah atas saja, tanpa menu samping, supaya layar kasir
 * penuh untuk menu dan nota. Portal ini butuh server, karena tiap penjualan harus
 * menjadi nota sungguhan, jadi tanpa sesi ia kembali ke halaman masuknya.
 *
 * Sesi tersimpan per tab, jadi keluar di sini tidak mengeluarkan Portal UMKM yang
 * terbuka di tab lain.
 */
export default function KerangkaPos() {
  const navigate = useNavigate()
  const sesi = useAplikasi((s) => s.sesiServer)
  const memulihkan = useAplikasi((s) => s.memulihkanSesi)
  const profil = useAplikasi((s) => s.profil)
  const aturMasuk = useAplikasi((s) => s.aturMasuk)

  if (memulihkan) return <MemuatHalaman />
  if (!sesi) return <Navigate to="/masuk/pos" replace />

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col bg-bg">
      <header className="shrink-0 flex items-center gap-3 h-16 px-4 sm:px-6 bg-surface border-b border-line">
        <Avatar nama={profil.namaUsaha} warna={profil.warna} ukuran={40} className="rounded-md" />
        <div className="min-w-0">
          <p className="text-kartu font-extrabold text-ink leading-tight truncate">{profil.namaUsaha}</p>
          <p className="text-kecil text-ink-3">Portal POS</p>
        </div>
        <Tombol
          ragam="sunyi"
          ikonKiri={<IkonKeluar size={17} />}
          className="ml-auto"
          onClick={() => {
            aturMasuk(false)
            navigate('/masuk/pos')
          }}
        >
          Keluar
        </Tombol>
      </header>
      <main id="konten" className="flex-1 min-h-0">
        <IsiHalaman />
      </main>
    </div>
  )
}
