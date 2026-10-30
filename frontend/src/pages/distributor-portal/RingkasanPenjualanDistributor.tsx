import { useCallback } from 'react'
import { TampilanRingkasan } from '@/components/domain/RingkasanPenjualan'
import { TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonGrafik } from '@/icons'
import { ambilRingkasanDistributor, type RentangTanggal } from '@/lib/apiPenjualan'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Ringkasan Penjualan sisi distributor (revisi 23 Okt 2026): dari pesanan yang
 * sudah selesai. Hanya untuk portal yang tersambung ke server.
 */
export default function RingkasanPenjualanDistributor() {
  const sesi = useAplikasi((s) => s.sesiDistributor)
  const ambil = useCallback(
    (rentang?: RentangTanggal) =>
      sesi ? ambilRingkasanDistributor(sesi, rentang) : Promise.reject(new Error('Belum masuk sebagai distributor.')),
    [sesi],
  )

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman judul="Ringkasan Penjualan" kembaliKe="/distributor-portal" />
      {sesi ? (
        <TampilanRingkasan ambil={ambil} />
      ) : (
        <section aria-labelledby="judul-ringkasan-contoh" className="mt-4">
          <h2 id="judul-ringkasan-contoh" className="sr-only">
            Ringkasan belum tersedia
          </h2>
          <KeadaanKosong
            ikon={<IkonGrafik size={26} />}
            judul="Ringkasan butuh pesanan yang tersimpan"
            pesan="Portal ini sedang memakai data contoh. Masuk sebagai distributor untuk melihat ringkasan dari pesanan yang sudah selesai."
            aksi={<TombolTautan ke="/masuk/distributor">Masuk sebagai distributor</TombolTautan>}
          />
        </section>
      )}
    </div>
  )
}
