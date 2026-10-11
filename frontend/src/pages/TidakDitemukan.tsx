import { Link, useLocation } from 'react-router-dom'
import { TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonBantuan } from '@/icons'
import { potong } from '@/lib/format'

/**
 * Halaman yang tidak ada.
 *
 * Alamat lama dari pemberitahuan atau pesan WhatsApp bisa saja sudah tidak
 * berlaku, jadi layar ini tidak boleh jadi jalan buntu: selalu ada satu tombol
 * utama dan dua jalan samping ke tempat yang paling sering dituju.
 *
 * Layar ini sengaja TETAP satu kolom terpusat di lebar berapa pun. Tidak ada
 * isi kedua yang pantas ditaruh di sebelahnya; melebarkannya cuma memanjangkan
 * baris kalimat yang justru bikin susah dibaca.
 */
export default function TidakDitemukan() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto w-full max-w-2xl lg:py-10">
      {/* Judul halaman tetap ada untuk pembaca layar walau yang terlihat adalah
          judul keadaan kosong. Judul bagian di bawahnya juga hanya untuk pembaca
          layar, supaya urutannya h1 → h2 → h3 tanpa melompat. */}
      <h1 className="sr-only">Halaman tidak ditemukan</h1>

      <section aria-labelledby="judul-alamat-asing">
        <h2 id="judul-alamat-asing" className="sr-only">
          Alamat yang tidak dikenali
        </h2>
        <KeadaanKosong
          ikon={<IkonBantuan size={26} />}
          judul="Halaman ini tidak ada"
          pesan={
            <>
              Alamat <span className="font-semibold text-ink-2">{potong(pathname, 42)}</span> tidak kami kenali.
              Bisa jadi tautannya sudah lama, atau ada huruf yang tertukar saat disalin.
            </>
          }
          aksi={<TombolTautan ke="/beranda">Kembali ke Beranda</TombolTautan>}
        />
      </section>

      <section aria-labelledby="judul-jalan-keluar">
        <h2 id="judul-jalan-keluar" className="sr-only">
          Jalan keluar lain
        </h2>
        <p className="text-center text-[0.875rem] text-ink-3">
          Mau langsung ke{' '}
          <Link to="/stok" className="font-semibold text-brand hover:underline">
            Stok
          </Link>{' '}
          atau{' '}
          <Link to="/pesanan" className="font-semibold text-brand hover:underline">
            Pesanan
          </Link>
          ?
        </p>
      </section>
    </div>
  )
}
