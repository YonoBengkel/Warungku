import { useCallback } from 'react'
import { TampilanRingkasan } from '@/components/domain/RingkasanPenjualan'
import { TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonGrafik } from '@/icons'
import { ambilRingkasanUsaha, type RentangTanggal } from '@/lib/apiPenjualan'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Ringkasan Penjualan sisi pemilik usaha (revisi 23 Okt 2026): dari nota
 * kasir, atau dari kiriman ke pembeli usaha untuk UMKM produsen. Hanya untuk
 * data server; data contoh tidak punya nota yang bisa dirangkum.
 */
export default function RingkasanPenjualan() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const ambil = useCallback(
    (rentang?: RentangTanggal) =>
      sesi ? ambilRingkasanUsaha(sesi, rentang) : Promise.reject(new Error('Belum masuk dengan akun usaha.')),
    [sesi],
  )

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman judul="Ringkasan Penjualan" kembaliKe="/beranda" />
      {sesi ? (
        <TampilanRingkasan ambil={ambil} />
      ) : (
        <section aria-labelledby="judul-ringkasan-contoh" className="mt-4">
          <h2 id="judul-ringkasan-contoh" className="sr-only">
            Ringkasan belum tersedia
          </h2>
          <KeadaanKosong
            ikon={<IkonGrafik size={26} />}
            judul="Ringkasan butuh nota kasir yang tersimpan"
            pesan="Saat ini aplikasi memakai data contoh, yang tidak menyimpan nota kasir. Masuk dengan akun usahamu untuk melihat ringkasan penjualan dari nota."
            aksi={<TombolTautan ke="/masuk">Masuk</TombolTautan>}
          />
        </section>
      )}
    </div>
  )
}
