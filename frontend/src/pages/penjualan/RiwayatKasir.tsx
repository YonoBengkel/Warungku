import { useSearchParams } from 'react-router-dom'
import { DaftarNota } from '@/components/domain/DaftarNota'
import { DaftarShift } from '@/components/domain/DaftarShift'
import { TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonNota } from '@/icons'
import { useAplikasi } from '@/store/aplikasi'

type Tab = 'nota' | 'shift'

/**
 * Riwayat Kasir: satu halaman dengan dua tab, Nota dan Shift (revisi V7, Q162
 * dan Q163).
 *
 * Sebelum ini keduanya hanya bagian di Ringkasan Penjualan, dan "Lihat Semua
 * Nota" memanjangkan daftarnya ke bawah di tempat yang sama sampai puluhan
 * baris. Sekarang bagian di Ringkasan dibatasi lima baris dan menautkan ke
 * sini, mengikuti pola halaman Pemberitahuan dan Promo.
 *
 * Tab aktif disimpan di alamat (`?tab=shift`), supaya tautan dari bagian Shift
 * langsung membuka tab yang benar dan tombol Back peramban tetap masuk akal.
 */
export default function RiwayatKasir() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const [param, setParam] = useSearchParams()
  const tab: Tab = param.get('tab') === 'shift' ? 'shift' : 'nota'

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman judul="Riwayat Kasir" kembaliKe="/penjualan" />
      {sesi ? (
        <>
          <TabSegmen<Tab>
            className="mt-4"
            aktif={tab}
            ubah={(v) => setParam(v === 'nota' ? {} : { tab: v }, { replace: true })}
            tab={[
              { nilai: 'nota', label: 'Nota' },
              { nilai: 'shift', label: 'Shift' },
            ]}
          />
          {tab === 'nota' ? <DaftarNota /> : <DaftarShift />}
        </>
      ) : (
        <section aria-labelledby="judul-riwayat-contoh" className="mt-4">
          <h2 id="judul-riwayat-contoh" className="sr-only">
            Riwayat belum tersedia
          </h2>
          <KeadaanKosong
            ikon={<IkonNota size={26} />}
            judul="Riwayat butuh nota kasir yang tersimpan"
            pesan="Saat ini aplikasi memakai data contoh, yang tidak menyimpan nota kasir. Masuk dengan akun usahamu untuk melihat nota dan shift dari Portal POS."
            aksi={<TombolTautan ke="/masuk">Masuk</TombolTautan>}
          />
        </section>
      )}
    </div>
  )
}
