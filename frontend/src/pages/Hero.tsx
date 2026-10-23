import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { TombolTautan } from '@/components/ui/dasar'
import {
  IkonCentang,
  IkonCentangLingkaran,
  IkonGrafik,
  IkonKotak,
  IkonPanahKanan,
  IkonSinkron,
  IkonTelepon,
  IkonToko,
} from '@/icons'
import { useAplikasi } from '@/store/aplikasi'
import { TandaMerek } from '@/components/ui/Merek'
import { cx } from '@/lib/format'

/**
 * Pintu masuk pengunjung yang belum masuk.
 *
 * Satu pekerjaan, dan cuma satu: menjelaskan bahwa Turnify Flow adalah aplikasi
 * PENDAMPING kasir, bukan penggantinya. Salah paham soal ini adalah kegagalan
 * paling mahal di halaman ini — pemilik warung yang mengira harus mengganti
 * kasirnya akan langsung menutup halaman, dan yang mengira ini kasir baru akan
 * kecewa setelah mendaftar. Karena itu kalimat add-on ditaruh di hero, sebelum
 * satu pun fitur disebut.
 *
 * Susunan revisi 23 Okt 2026 (acuan "Technology Landing Page"): bilah atas
 * dengan tautan bagian dan tombol Masuk; hero ungu dengan teks di kiri dan foto
 * di kanan yang dibatasi satu lengkung; tiga blok fitur; satu blok untuk
 * distributor; kontak dan kaki halaman.
 *
 * Foto kasir di hero dan blok distributor diambil dari folder referensi tim
 * (unduhan Downpic.cc, tanpa lisensi). Memakainya di repo publik adalah
 * keputusan Ilham selama proyek belum dikomersialkan; ganti dengan foto
 * berlisensi sebelum itu. Resolusinya hanya 390 × 260, jadi wadahnya sengaja
 * tidak dibuat lebar.
 */

const BAGIAN = [
  { ke: '#beranda', label: 'Beranda' },
  { ke: '#fitur', label: 'Fitur' },
  { ke: '#distributor', label: 'Untuk Distributor' },
  { ke: '#kontak', label: 'Kontak' },
] as const

/** Jarak gulir di bawah bilah atas yang menempel (dua baris di HP). */
const GESER_JANGKAR = 'scroll-mt-32 md:scroll-mt-20'

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
      {/* Bilah atas                                                  */}
      {/* ---------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line pt-aman">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <a href="#beranda" className="flex items-center gap-2.5 mr-auto min-w-0 min-h-11">
            <TandaMerek ukuran={36} />
            <span className="font-extrabold text-ink text-subjudul tracking-tight truncate">Turnify Flow</span>
          </a>
          <nav aria-label="Bagian halaman" className="hidden md:flex items-center gap-1">
            {BAGIAN.map((b) => (
              <TautanBagian key={b.ke} {...b} />
            ))}
          </nav>
          <TombolTautan ke="/masuk" className="shrink-0">
            Masuk
          </TombolTautan>
        </div>
        {/* Di HP tautan bagian turun ke baris kedua dan boleh digeser. */}
        <nav aria-label="Bagian halaman" className="md:hidden border-t border-line">
          <div className="max-w-[1100px] mx-auto flex gap-1 overflow-x-auto no-scrollbar px-2">
            {BAGIAN.map((b) => (
              <TautanBagian key={b.ke} {...b} />
            ))}
          </div>
        </nav>
      </header>

      <main id="isi">
        {/* -------------------------------------------------------- */}
        {/* Hero                                                      */}
        {/* -------------------------------------------------------- */}
        <section id="beranda" aria-labelledby="judul-hero" className={GESER_JANGKAR}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
            <div className="relative overflow-hidden rounded-xl bg-brand text-ink-inverse lg:grid lg:grid-cols-12 lg:min-h-[30rem]">
              <div className="relative z-10 p-6 sm:p-10 lg:col-span-7 lg:py-14 lg:pl-12 lg:pr-6">
                <p className="text-kecil font-bold uppercase tracking-[0.12em]">
                  Pendamping aplikasi kasir &middot; UMKM &amp; Kafe
                </p>
                <h1
                  id="judul-hero"
                  className="mt-3 text-[2rem] sm:text-[2.75rem] lg:text-[3.25rem] font-extrabold leading-[1.08] tracking-tight max-w-[15ch]"
                >
                  Stok gudang beres, belanja tidak telat.
                </h1>
                {/* Garis kuning di bawah judul: sorotan dari warna panah logo. */}
                <span aria-hidden="true" className="mt-5 block h-1.5 w-16 rounded-full bg-kuning" />
                {/* Paragraf pembuka wajib: penjelasan add-on. */}
                <p className="mt-5 text-subjudul leading-relaxed max-w-[52ch]">
                  <strong className="font-bold">Turnify Flow adalah aplikasi tambahan, bukan aplikasi kasir baru.</strong>{' '}
                  Kasir yang kamu pakai sekarang tetap jalan seperti biasa. Turnify Flow menempel di sampingnya, membaca
                  penjualan yang sudah tercatat di sana, lalu mengurus sisa stok di gudang, perkiraan kebutuhan bulan
                  depan, dan pemesanan ke distributor.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <TombolAtasUngu ke="/masuk" utama>
                    Masuk
                    <IkonPanahKanan size={18} />
                  </TombolAtasUngu>
                  <TombolAtasUngu ke="/daftar">Daftarkan Usaha</TombolAtasUngu>
                </div>
                <p className="mt-4 text-isi">Belum punya akun? Pendaftarannya tiga langkah, dan bisa dilanjutkan nanti.</p>
              </div>

              {/* Foto sumbernya hanya 390 × 260, jadi ia tidak dibentangkan setinggi
                  panel (akan buram): lebarnya dibatasi dan bentuknya kapsul yang muncul
                  dari tepi kanan. Lengkung kirinya menjadi potongan lengkung acuan. Di HP
                  foto turun ke bawah teks dengan sudut atas melengkung. */}
              <div className="relative lg:col-span-5 lg:flex lg:items-center lg:justify-end lg:py-10">
                <img
                  src="/gambar/landing/kasir-swalayan.jpg"
                  alt="Pembeli menyerahkan belanjaan di meja kasir swalayan."
                  width={390}
                  height={260}
                  fetchPriority="high"
                  className="block w-full aspect-[3/2] object-cover rounded-t-[2.5rem] lg:max-w-[27rem] lg:rounded-t-none lg:rounded-l-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Fitur                                                     */}
        {/* -------------------------------------------------------- */}
        <section id="fitur" aria-labelledby="judul-fitur" className={GESER_JANGKAR}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-14">
            <h2
              id="judul-fitur"
              className="text-[1.375rem] sm:text-angka font-extrabold text-ink tracking-tight leading-tight"
            >
              Tiga pekerjaan yang tidak dikerjakan aplikasi kasir
            </h2>
            <p className="mt-2 text-kartu text-ink-2 leading-relaxed max-w-[62ch]">
              Kasir mencatat apa yang terjual. Sisanya &mdash; berapa yang tersisa di gudang, kapan harus beli lagi, dan
              beli ke siapa &mdash; selama ini dihitung di kepala atau di buku tulis.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
              <KartuFitur
                ikon={<IkonKotak size={20} />}
                judul="Stok gudang"
                isi="Sisa tiap bahan terhitung sendiri dari setiap penjualan di kasir. Kamu diingatkan sebelum habis, bukan sesudah."
                rincian={['Pengingat stok menipis dan hampir kedaluwarsa', 'Koreksi stok kalau hitungan di rak berbeda']}
              />
              <KartuFitur
                ikon={<IkonGrafik size={20} />}
                judul="Perkiraan kebutuhan"
                isi="Berapa yang perlu ditambah bulan depan, dari pola pemakaianmu sendiri. Angkanya saran, bukan perintah."
                rincian={['Grafik pemakaian dan perkiraan per barang', 'Ringkasan penjualan dari nota kasir']}
              />
              <KartuFitur
                ikon={<IkonToko size={20} />}
                judul="Belanja ke distributor"
                isi="Bandingkan penawaran, pesan sekali atau ikat kontrak bulanan, lalu ikuti kirimannya sampai barang diterima."
                rincian={['Saran distributor yang paling cocok', 'Lacak pesanan di peta dan pantau kuota kontrak']}
              />
            </div>

            <div className="mt-8 rounded-lg border border-line bg-surface p-5 sm:p-6">
              <h3 className="text-[1rem] font-bold text-ink flex items-center gap-2">
                <IkonSinkron size={18} className="text-brand shrink-0" />
                Yang sengaja tidak ada di sini
              </h3>
              <ul className="mt-3 space-y-2">
                {[
                  'Tidak ada kasir, tidak ada struk pelanggan, tidak ada laci uang. Itu tetap milik aplikasi kasirmu.',
                  'Tidak ada untung atau margin. Ringkasan penjualan dibaca dari nota kasirmu apa adanya; harga jualnya tetap diatur di kasir.',
                  'Tidak ada pembayaran di dalam aplikasi. Pembayaran ke distributor dicatat di luar, seperti yang sudah kamu lakukan sekarang.',
                ].map((baris) => (
                  <li key={baris} className="flex items-start gap-2.5">
                    <IkonCentangLingkaran size={17} className="text-aman shrink-0 mt-0.5" />
                    <span className="text-kartu text-ink-2 leading-relaxed">{baris}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Untuk distributor                                         */}
        {/* -------------------------------------------------------- */}
        <section id="distributor" aria-labelledby="judul-distributor" className={GESER_JANGKAR}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pb-14">
            <div className="rounded-xl border border-line bg-surface shadow-e1 overflow-hidden md:grid md:grid-cols-12 md:items-center">
              {/* Foto berbingkai dengan perbandingan aslinya (3:2), tidak dibentangkan
                  setinggi teks: sumbernya hanya 390 × 260. */}
              <div className="md:col-span-5 md:p-6 md:self-center">
                <img
                  src="/gambar/landing/kasir-topi-merah.jpg"
                  alt="Penjaga toko bertopi merah melayani pembeli di meja kasir."
                  width={390}
                  height={260}
                  loading="lazy"
                  decoding="async"
                  className="block w-full aspect-[3/2] object-cover md:rounded-lg"
                />
              </div>
              <div className="p-6 sm:p-8 md:col-span-7">
                <span className="inline-flex items-center rounded-sm bg-aksen text-aksen-ink px-2.5 py-1 text-kecil font-bold">
                  Untuk distributor
                </span>
                <h2
                  id="judul-distributor"
                  className="mt-3 text-[1.375rem] sm:text-angka font-extrabold text-ink tracking-tight leading-tight max-w-[24ch]"
                >
                  Pesanan warung dan kafe di area kirimmu, dalam satu portal.
                </h2>
                <p className="mt-2 text-kartu text-ink-2 leading-relaxed max-w-[56ch]">
                  Distributor menerima pesanan dari usaha yang mencari barangnya, menawarkan kontrak bulanan dan promo,
                  dan melihat ke mana saja barangnya dikirim.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    'Pesanan masuk per tahap, dari menunggu jawaban sampai selesai',
                    'Kontrak, paket, dan promo yang kamu atur sendiri',
                    'Lacak kiriman di peta dan ringkasan penjualan dari pesanan selesai',
                  ].map((baris) => (
                    <li key={baris} className="flex items-start gap-2.5">
                      <IkonCentang size={17} className="text-brand shrink-0 mt-0.5" />
                      <span className="text-kartu text-ink-2 leading-relaxed">{baris}</span>
                    </li>
                  ))}
                </ul>
                <TombolTautan
                  ke="/masuk/distributor"
                  ragam="garis"
                  className="mt-6"
                  ikonKanan={<IkonPanahKanan size={16} />}
                >
                  Masuk sebagai Distributor
                </TombolTautan>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Kontak dan ajakan penutup                                 */}
        {/* -------------------------------------------------------- */}
        <section id="kontak" aria-labelledby="judul-kontak" className={cx('border-t border-line bg-surface', GESER_JANGKAR)}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2
                id="judul-kontak"
                className="text-[1.375rem] sm:text-angka font-extrabold text-ink tracking-tight leading-tight max-w-[24ch]"
              >
                Kasirmu tetap yang sekarang. Gudangnya yang kami bereskan.
              </h2>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <TombolTautan ke="/masuk" ukuran="besar" ikonKanan={<IkonPanahKanan size={18} />}>
                  Masuk
                </TombolTautan>
                <TombolTautan ke="/daftar" ukuran="besar" ragam="garis">
                  Daftarkan Usaha
                </TombolTautan>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-bg p-5 sm:p-6">
              <h3 className="text-subjudul font-bold text-ink">Kontak</h3>
              <p className="mt-1.5 text-kartu text-ink-2 leading-relaxed">
                Tanya soal Turnify Flow, uji coba di usahamu, atau kerja sama sebagai distributor.
              </p>
              <p className="mt-3 flex items-center gap-2 text-subjudul font-bold text-ink tabular">
                <IkonTelepon size={18} className="text-brand shrink-0" />
                08xxx-xxxx-xxxx
              </p>
              <Link
                to="/akun/bantuan"
                className="mt-3 inline-flex items-center gap-1 min-h-11 text-isi font-semibold text-brand hover:underline"
              >
                Bantuan &amp; tentang aplikasi
                <IkonPanahKanan size={15} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="flex items-center gap-2 text-isi text-ink-3">
            <TandaMerek ukuran={24} />
            Turnify Flow &mdash; purwarupa, berisi data simulasi.
          </span>
          <nav aria-label="Tautan kaki halaman" className="flex flex-wrap gap-x-4">
            {BAGIAN.map((b) => (
              <a key={b.ke} href={b.ke} className="inline-flex items-center min-h-11 text-isi text-ink-2 hover:text-ink">
                {b.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}

/* ================================================================== */
/* Potongan khusus halaman ini                                        */
/* ================================================================== */

function TautanBagian({ ke, label }: { ke: string; label: string }) {
  return (
    <a
      href={ke}
      className="shrink-0 inline-flex items-center min-h-11 px-3 rounded-md text-isi md:text-kartu font-semibold text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
    >
      {label}
    </a>
  )
}

/**
 * Tombol di atas latar ungu hero. Tombol utama biasa juga ungu, jadi di sini ia
 * dibalik: isian permukaan dengan teks ungu, dan tombol kedua bergaris. Cincin
 * fokus memakai tinta pembalik, karena cincin ungu bawaan hilang di atas ungu.
 */
function TombolAtasUngu({ ke, utama, children }: { ke: string; utama?: boolean; children: ReactNode }) {
  return (
    <Link
      to={ke}
      className={cx(
        'inline-flex items-center justify-center gap-2 min-h-[52px] px-6 rounded-md text-kartu font-bold transition-colors',
        'focus-visible:outline-ink-inverse',
        utama
          ? 'bg-surface text-brand hover:bg-brand-soft'
          : 'border-2 border-ink-inverse text-ink-inverse hover:bg-ink-inverse/10',
      )}
    >
      {children}
    </Link>
  )
}

function KartuFitur({
  ikon,
  judul,
  isi,
  rincian,
}: {
  ikon: ReactNode
  judul: string
  isi: string
  rincian: string[]
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6 shadow-e1">
      <span aria-hidden="true" className="size-11 rounded-md bg-brand-soft text-brand-soft-ink grid place-items-center">
        {ikon}
      </span>
      <h3 className="mt-3.5 text-subjudul font-bold text-ink leading-snug">{judul}</h3>
      <p className="mt-1.5 text-kartu text-ink-2 leading-relaxed">{isi}</p>
      <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
        {rincian.map((r) => (
          <li key={r} className="flex items-start gap-2 text-isi text-ink-2 leading-snug">
            <IkonCentang size={15} className="text-brand shrink-0 mt-0.5" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  )
}
