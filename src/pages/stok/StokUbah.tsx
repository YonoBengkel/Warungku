import { useParams } from 'react-router-dom'
import { TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonKotak } from '@/icons'
import { useAplikasi } from '@/store/aplikasi'
import { FormulirBarang } from './StokBaru'

/**
 * Ubah Barang memakai formulir yang sama persis dengan Tambah Barang.
 *
 * Aturan mainnya cuma satu yang berbeda, dan itu ditangani di dalam formulir:
 * angka stok tidak bisa diedit dari sini, dan mengubah isi kemasan saat sudah
 * ada riwayat memunculkan konfirmasi bahwa stok lama tidak dihitung ulang.
 */
export default function StokUbah() {
  const { id = '' } = useParams()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))

  if (!barang) {
    return (
      <>
        <KepalaHalaman judul="Ubah Barang" kembaliKe="/stok" />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini sudah tidak ada di daftar"
          pesan="Mungkin barangnya sudah dihapus, atau tautannya sudah lama. Daftar stok yang sekarang masih lengkap."
          aksi={<TombolTautan ke="/stok">Kembali ke Daftar Stok</TombolTautan>}
        />
      </>
    )
  }

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Ubah Barang" keterangan={barang.nama} kembaliKe={`/stok/${barang.id}`} />
      <FormulirBarang barang={barang} />
    </div>
  )
}
