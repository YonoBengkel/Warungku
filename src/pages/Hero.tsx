import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { TombolTautan } from '@/components/ui/dasar'
import {
  IkonCentangLingkaran,
  IkonGrafik,
  IkonKontrak,
  IkonKotak,
  IkonPanahKanan,
  IkonSinkron,
} from '@/icons'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pintu masuk pengunjung yang belum masuk.
 *
 * Satu pekerjaan, dan cuma satu: menjelaskan bahwa Warungku adalah aplikasi
 * PENDAMPING kasir, bukan penggantinya. Salah paham soal ini adalah kegagalan
 * paling mahal di halaman ini — pemilik warung yang mengira harus mengganti
 * kasirnya akan langsung menutup halaman, dan yang mengira ini kasir baru akan
 * kecewa setelah mendaftar. Karena itu kalimat add-on ditaruh paling atas,
 * sebelum satu pun fitur disebut.
 *
 * Tata letaknya mengikuti MarketCast: navbar tipis, satu blok hero dengan
 * eyebrow + judul + subjudul + dua tombol, lalu blok penjelas di bawahnya.
 */
export default function Hero() {
  const masuk = useAplikasi((s) => s.masuk)

  // Pengguna yang sudah masuk tidak perlu membaca brosur produknya lagi.
  if (masuk) return <Navigate to="/beranda" replace />

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#isi" className="skip-link">
        Langsung ke isi halaman
      </a>

      {/* ---------------------------------------------------------- */}
      {/* Navbar                                                      */}
      {/* ---------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line pt-aman">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="flex items-center gap-2.5 mr-auto min-w-0">
            <span className="size-9 rounded-md bg-brand grid place-items-center text-ink-inverse font-extrabold text-[1rem] shrink-0">
              W
            </span>
            <span className="font-extrabold text-ink text-[1.0625rem] tracking-tight truncate">
              Warungku
            </span>
          </span>

          <a
            href="#cara-kerja"
            className="hidden sm:inline-flex items-center min-h-11 px-3 text-[0.9375rem] font-semibold text-ink-2 hover:text-ink"
          >
            Cara kerjanya
          </a>

          {/* "Mulai" diganti "Login" sesuai catatan pemilik proyek, dan ia
              menaut ke formulir masuk — bukan langsung ke aplikasi. */}
          <TombolTautan ke="/masuk" className="shrink-0">
            Login
          </TombolTautan>
        </div>
      </header>

      <main id="isi">
        {/* -------------------------------------------------------- */}
        {/* Hero                                                      */}
        {/* -------------------------------------------------------- */}
        <section className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-16 sm:pb-16">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-brand">
            Pendamping aplikasi kasir &middot; UMKM &amp; Kafe
          </p>

          <h1 className="mt-3 text-[2rem] sm:text-[2.75rem] lg:text-[3.25rem] font-extrabold text-ink leading-[1.08] tracking-tight max-w-[18ch]">
            Stok gudang beres, belanja tidak telat.
          </h1>

          {/* Paragraf pembuka wajib: penjelasan add-on. */}
          <p className="mt-5 text-[1.0625rem] sm:text-[1.1875rem] text-ink-2 leading-relaxed max-w-[62ch]">
            <strong className="text-ink font-bold">
              Warungku adalah aplikasi tambahan, bukan aplikasi kasir baru.
            </strong>{' '}
            Kasir yang kamu pakai sekarang tetap jalan seperti biasa. Warungku menempel di
            sampingnya, membaca penjualan yang sudah tercatat di sana, lalu mengurus apa yang
            belum diurus siapa pun: sisa stok di gudang, perkiraan kebutuhan bulan depan, dan
            pemesanan ke distributor.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <TombolTautan ke="/masuk" ukuran="besar" ikonKanan={<IkonPanahKanan size={18} />}>
              Login
            </TombolTautan>
            <TombolTautan ke="/daftar" ukuran="besar" ragam="garis">
              Daftarkan Usaha
            </TombolTautan>
          </div>

          <p className="mt-4 text-[0.8125rem] text-ink-3">
            Belum punya akun? Pendaftarannya tiga langkah, dan bisa dilanjutkan nanti.
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Apa yang diurus Warungku                                  */}
        {/* -------------------------------------------------------- */}
        <section
          aria-labelledby="judul-tugas"
          className="border-y border-line bg-surface"
        >
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
            <h2
              id="judul-tugas"
              className="text-[1.375rem] sm:text-[1.625rem] font-extrabold text-ink tracking-tight"
            >
              Tiga pekerjaan yang tidak dikerjakan aplikasi kasir
            </h2>
            <p className="mt-2 text-[0.9375rem] text-ink-2 leading-relaxed max-w-[62ch]">
              Kasir mencatat apa yang terjual. Sisanya &mdash; berapa yang tersisa di gudang,
              kapan harus beli lagi, dan beli ke siapa &mdash; selama ini dihitung di kepala atau
              di buku tulis.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <KartuNilai
                ikon={<IkonKotak size={20} />}
                judul="Stok gudang"
                isi="Sisa tiap bahan terhitung sendiri setiap ada penjualan. Kamu diingatkan sebelum habis, bukan sesudah."
              />
              <KartuNilai
                ikon={<IkonGrafik size={20} />}
                judul="Perkiraan kebutuhan"
                isi="Berapa yang perlu ditambah bulan depan, lengkap dengan alasannya. Angkanya saran, bukan perintah."
              />
              <KartuNilai
                ikon={<IkonKontrak size={20} />}
                judul="Pengadaan ke distributor"
                isi="Bandingkan penawaran, ikat kontrak bulanan, pantau kirimannya sampai barang benar-benar diterima."
              />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Cara kerja                                                */}
        {/* -------------------------------------------------------- */}
        <section aria-labelledby="judul-cara" id="cara-kerja" className="scroll-mt-20">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
            <h2
              id="judul-cara"
              className="text-[1.375rem] sm:text-[1.625rem] font-extrabold text-ink tracking-tight"
            >
              Cara kerjanya
            </h2>

            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Langkah
                nomor={1}
                judul="Sambungkan kasirmu"
                isi="Satu kali saja. Kalau belum pakai kasir digital, kamu bisa mencatat pemakaian harian sendiri."
              />
              <Langkah
                nomor={2}
                judul="Stok berkurang sendiri"
                isi="Tiap penjualan mengurangi bahan bakunya. Tidak ada angka yang perlu kamu salin ulang."
              />
              <Langkah
                nomor={3}
                judul="Lihat perkiraannya"
                isi="Warungku menandai barang yang akan habis dan menyiapkan daftar belanjanya."
              />
              <Langkah
                nomor={4}
                judul="Pesan dan terima"
                isi="Pesan ke distributor dari dalam aplikasi. Stok gudang bertambah saat barangnya kamu terima."
              />
            </ol>

            <div className="mt-8 rounded-lg border border-line bg-surface p-5 sm:p-6">
              <h3 className="text-[1rem] font-bold text-ink flex items-center gap-2">
                <IkonSinkron size={18} className="text-brand shrink-0" />
                Yang sengaja tidak ada di sini
              </h3>
              <ul className="mt-3 space-y-2">
                {[
                  'Tidak ada kasir, tidak ada struk pelanggan, tidak ada laci uang. Itu tetap milik aplikasi kasirmu.',
                  'Tidak ada harga jual, omzet, untung, atau margin. Angka itu dikelola di kasir, jadi apa pun yang kami tampilkan pasti keliru.',
                  'Tidak ada pembayaran di dalam aplikasi. Pembayaran ke distributor dicatat di luar, seperti yang sudah kamu lakukan sekarang.',
                ].map((baris) => (
                  <li key={baris} className="flex items-start gap-2.5">
                    <IkonCentangLingkaran size={17} className="text-aman shrink-0 mt-0.5" />
                    <span className="text-[0.9375rem] text-ink-2 leading-relaxed">{baris}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Ajakan penutup                                            */}
        {/* -------------------------------------------------------- */}
        <section aria-labelledby="judul-ajakan" className="border-t border-line bg-surface">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
            <h2
              id="judul-ajakan"
              className="text-[1.375rem] sm:text-[1.625rem] font-extrabold text-ink tracking-tight max-w-[24ch]"
            >
              Kasirmu tetap yang sekarang. Gudangnya yang kami bereskan.
            </h2>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <TombolTautan ke="/masuk" ukuran="besar" ikonKanan={<IkonPanahKanan size={18} />}>
                Login
              </TombolTautan>
              <TombolTautan ke="/daftar" ukuran="besar" ragam="garis">
                Daftarkan Usaha
              </TombolTautan>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="text-[0.8125rem] text-ink-3">
            Warungku &mdash; purwarupa antarmuka, data contoh.
          </span>
          <Link
            to="/akun/bantuan"
            className="text-[0.8125rem] font-semibold text-brand hover:underline min-h-11 inline-flex items-center"
          >
            Bantuan &amp; tentang aplikasi
          </Link>
        </div>
      </footer>
    </div>
  )
}

/* ================================================================== */
/* Potongan khusus halaman ini                                        */
/* ================================================================== */

function KartuNilai({
  ikon,
  judul,
  isi,
}: {
  ikon: ReactNode
  judul: string
  isi: string
}) {
  return (
    <div className="rounded-lg border border-line bg-bg p-5">
      <span
        aria-hidden="true"
        className="size-11 rounded-md bg-brand-soft text-brand-soft-ink grid place-items-center"
      >
        {ikon}
      </span>
      <h3 className="mt-3.5 text-[1.0625rem] font-bold text-ink leading-snug">{judul}</h3>
      <p className="mt-1.5 text-[0.9375rem] text-ink-2 leading-relaxed">{isi}</p>
    </div>
  )
}

function Langkah({ nomor, judul, isi }: { nomor: number; judul: string; isi: string }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-5">
      <span
        aria-hidden="true"
        className="size-9 rounded-full bg-brand text-ink-inverse grid place-items-center font-extrabold text-[0.9375rem] tabular"
      >
        {nomor}
      </span>
      <h3 className="mt-3 text-[1rem] font-bold text-ink leading-snug">{judul}</h3>
      <p className="mt-1.5 text-[0.875rem] text-ink-2 leading-relaxed">{isi}</p>
    </li>
  )
}
