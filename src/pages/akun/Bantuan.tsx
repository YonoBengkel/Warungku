import { useState, type ReactNode } from 'react'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { JudulBagian, Kartu, Pemisah, Tombol } from '@/components/ui/dasar'
import { Peringatan } from '@/components/ui/umpanBalik'
import { Lembar } from '@/components/ui/lembar'
import {
  IkonBantuan,
  IkonCentang,
  IkonPanahBawah,
  IkonPanahKanan,
  IkonSalin,
  IkonSilang,
  IkonTelepon,
} from '@/icons'
import { cx, nomorHp as formatHp } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu-satunya layar tempat cara kerja model prediksi boleh dijelaskan.
 *
 * Semua pertanyaan di bawah bukan karangan: tiap satu menjawab kebingungan yang
 * lahir langsung dari keputusan desain aplikasi ini. Kalau nanti ada keputusan
 * yang berubah, jawabannya harus ikut diperbaiki di sini — jawaban yang basi
 * lebih merusak kepercayaan daripada tidak ada jawaban sama sekali.
 */

const NOMOR_BANTUAN = '081137700190'
const VERSI = '1.0.0'

interface ButirFaq {
  id: string
  tanya: string
  jawab: ReactNode
}

const FAQ: ButirFaq[] = [
  {
    id: 'faq-stok-tidak-berkurang',
    tanya: 'Kenapa stok saya tidak berkurang?',
    jawab: (
      <>
        <p>
          Stok berkurang kalau ada penjualan yang masuk dari aplikasi kasirmu, dan menu yang terjual sudah dipasangkan
          ke bahannya. Kalau salah satu belum beres, angka stok diam di tempat.
        </p>
        <p className="mt-2">Tiga sebab yang paling sering:</p>
        <ul className="mt-1.5 space-y-1.5 list-disc pl-5">
          <li>Aplikasi kasir belum tersambung, jadi tidak ada penjualan yang masuk sama sekali.</li>
          <li>
            Menunya belum dipasangkan ke bahan. Contoh: "Kopi Susu Pandan" terjual 41 kali, tapi aplikasi belum tahu
            satu gelasnya memakai berapa gram biji kopi.
          </li>
          <li>Barangnya sengaja kamu tandai sebagai dicatat manual, misalnya gas atau tisu.</li>
        </ul>
        <p className="mt-2.5">
          Cek daftar yang perlu dibereskan di <strong className="text-ink">Data dari Kasir</strong>. Di sana tiap
          menu yang belum dipasangkan punya satu tombol untuk membereskannya.
        </p>
      </>
    ),
  },
  {
    id: 'faq-perkiraan-belum-muncul',
    tanya: 'Kenapa butuh 14 hari sebelum ada perkiraan?',
    jawab: (
      <>
        <p>
          Perkiraan dihitung dari pola pemakaian barang itu sendiri. Barang yang baru kamu daftarkan belum punya
          pola apa pun, jadi tidak ada yang bisa dihitung.
        </p>
        <p className="mt-2">
          Kami menunggu <strong className="text-ink">14 hari data pemakaian</strong> sebelum menampilkan perkiraan.
          Sebelum itu, kartu barangnya berbunyi "Data terkumpul 6 dari 14 hari" supaya kamu tahu ini soal waktu,
          bukan soal aplikasinya rusak.
        </p>
        <p className="mt-2">
          Selama menunggu, batas aman tetap berjalan penuh. Kamu tetap diingatkan saat stok menipis, hanya saja
          angkanya memakai batas yang kamu atur sendiri, bukan hasil prediksi.
        </p>
        <p className="mt-2 text-ink-3">
          Prediksi ini belajar dari berapa banyak barang terpakai tiap hari, hari apa saja yang biasanya ramai, dan
          seberapa naik-turun pemakaiannya. Ia tidak tahu apa-apa soal promo dadakan, hajatan di kampung sebelah,
          atau cuaca &mdash; jadi di hari-hari seperti itu ia memang akan meleset.
        </p>
      </>
    ),
  },
  {
    id: 'faq-kuota-belum-bertambah',
    tanya: 'Kenapa kuota kontrak belum bertambah padahal sudah pesan?',
    jawab: (
      <>
        <p>
          Karena kuota hanya dihitung dari barang yang sudah benar-benar kamu terima. Selama pesanannya masih di
          jalan, jumlahnya berdiri di segmen <strong className="text-ink">Dalam perjalanan</strong> pada bar Kuota
          Bulan Ini &mdash; terlihat, tapi belum dihitung.
        </p>
        <p className="mt-2">{BANTUAN.kuotaBertambah} Begitu kamu menekan Barang Sudah Sampai dan mengakui jumlah
          yang datang, angka itu pindah ke segmen Sudah diterima pada hari itu juga.</p>
        <p className="mt-2">
          Alasannya sederhana: kiriman bisa batal, bisa kurang, bisa pecah di jalan. Kalau kuota naik sejak pesanan
          dibuat, kamu bisa merasa aman di akhir bulan padahal barangnya tidak pernah sampai &mdash; dan yang
          menanggung selisihnya kamu, bukan aplikasi ini.
        </p>
        <p className="mt-2">
          Kalau kiriman datang kurang dari yang dipesan, yang dihitung adalah jumlah yang kamu akui diterima. Selisih
          yang kamu catat ikut terkirim ke distributor sebagai catatan pada pesanan itu.
        </p>
      </>
    ),
  },
  {
    id: 'faq-kuota-vs-target',
    tanya: 'Apa bedanya kuota kontrak dengan target?',
    jawab: (
      <>
        <p>
          <strong className="text-ink">Kuota adalah janji yang kamu tanda tangani</strong> dengan distributor: minimal
          sekian per bulan selama masa kontrak. Ia datang dari dokumen kontrak, bukan dari aplikasi ini.
        </p>
        <p className="mt-2">
          Target adalah angka yang kamu tentukan sendiri untuk mengejar penjualan. Aplikasi ini tidak punya fitur
          target, dan sengaja tidak membuatnya, supaya angka di layar tidak tercampur antara yang mengikat secara
          hukum dan yang sekadar niat.
        </p>
        <p className="mt-2">
          Karena itu bar "Kuota Bulan Ini" hanya memberi tahu, tidak pernah menghalangi. Tombol pesan tidak akan
          dimatikan dengan alasan kuota, dan aplikasi tidak menghitung denda apa pun. Apa yang terjadi kalau kuota
          tidak terpenuhi ada di kolom ketentuan pada Rincian Kontrak &mdash; ditulis distributor, bukan oleh kami.
        </p>
      </>
    ),
  },
  {
    id: 'faq-barang-sudah-sampai',
    tanya: 'Kenapa stok baru bertambah setelah saya tekan Barang Sudah Sampai?',
    jawab: (
      <>
        <p>
          Karena barang yang statusnya "dikirim" belum tentu sudah ada di gudangmu, dan jumlah yang dikirim belum
          tentu sama dengan jumlah yang sampai.
        </p>
        <p className="mt-2">
          Kalau stok ditambah otomatis saat distributor menekan "dikirim", angka di layar bisa berbeda dari isi rak
          selama berhari-hari. Sekali itu terjadi, semua perkiraan yang dihitung dari angka itu ikut salah.
        </p>
        <p className="mt-2">
          Jadi penambahan stok menunggu satu ketukan darimu. Supaya tidak merepotkan, jumlahnya sudah diisi penuh
          lebih dulu dan ada jalur satu ketukan "Ya, semua sesuai". Kalau ada yang kurang atau pecah, kamu ubah
          angkanya dan pesanan tetap maju ke Selesai dengan catatan &mdash; tidak pernah macet.
        </p>
      </>
    ),
  },
  {
    id: 'faq-satu-kontrak-satu-barang',
    tanya: 'Kenapa satu kontrak cuma untuk satu barang?',
    jawab: (
      <>
        <p>
          Karena kuota, harga, dan masa berlaku menempel pada barangnya. Kontrak biji kopi 20 kg per bulan tidak bisa
          dicampur dengan kontrak susu 30 liter per bulan tanpa membuat salah satunya jadi kabur.
        </p>
        <p className="mt-2">
          Dengan satu kontrak untuk satu barang, kamu selalu bisa menjawab satu pertanyaan dengan pasti: barang ini
          kurang berapa bulan ini. Kalau satu kontrak memuat lima barang, jawabannya jadi tergantung cara membaginya,
          dan pembagian itu tidak tertulis di dokumen mana pun.
        </p>
        <p className="mt-2">
          Kalau kamu punya beberapa kontrak dengan distributor yang sama, halaman Pesanan bisa mengelompokkannya per
          pemasok dan menawarkan "Pesan sekaligus", jadi kamu tidak perlu memesan satu per satu.
        </p>
      </>
    ),
  },
  {
    id: 'faq-harga-jual',
    tanya: 'Kenapa harga jual tidak ada di aplikasi ini?',
    jawab: (
      <>
        <p>
          Harga jual, diskon, dan promo dikelola di aplikasi kasirmu. Kalau kami ikut menyimpannya, akan ada dua
          angka untuk satu barang, dan cepat atau lambat keduanya berbeda.
        </p>
        <p className="mt-2">
          Akibatnya kami juga tidak menampilkan omzet, untung, dan margin. Angka apa pun yang kami tampilkan soal itu
          pasti salah, karena kami hanya tahu harga beli dari distributor, bukan harga yang kamu pasang di etalase.
        </p>
        <p className="mt-2">
          Yang kami kerjakan adalah sisi belanjanya: berapa sisa stokmu, kapan habis, berapa perlu dibeli, dan berapa
          kamu bayar ke distributor.
        </p>
      </>
    ),
  },
]

const TIDAK_DILAKUKAN = [
  'Tidak menggantikan aplikasi kasirmu. Penjualan tetap dicatat di sana, aplikasi ini membaca hasilnya.',
  'Tidak memproses pembayaran. Kamu membayar langsung ke distributor; aplikasi hanya menyimpan catatan dan buktinya.',
  'Tidak mengurus harga jual, promo, atau hitungan untung. Itu semua milik aplikasi kasir.',
  'Tidak menjamin barang pasti tersedia di distributor. Stok yang tampil adalah yang mereka laporkan.',
]

const DILAKUKAN = [
  'Mencatat sisa stok tiap bahan dan barang, lengkap dengan riwayat siapa mengubah apa.',
  'Memperkirakan kapan sebuah barang habis dan berapa perlu dibeli, berdasarkan pemakaian nyatamu.',
  'Menyusun saran belanja harian dan mengingatkanmu sebelum stok benar-benar kosong.',
  'Menghubungkanmu ke distributor: membandingkan penawaran, membuat pesanan, dan memantau kuota kontrak.',
]

const KETENTUAN: Array<{ judul: string; isi: string }> = [
  {
    judul: 'Datamu milikmu',
    isi: 'Daftar stok, riwayat pergerakan, dan catatan pesananmu adalah milik usahamu. Kamu boleh memintanya dalam bentuk berkas kapan saja, dan kami tidak menjualnya ke siapa pun.',
  },
  {
    judul: 'Yang dilihat distributor cuma yang kamu izinkan',
    isi: 'Distributor melihat nama usaha, jenis usaha, kota, foto, dan lencana verifikasimu. Alamat lengkap dan nomor HP baru terbuka sesuai pilihanmu di halaman Profil Usaha, dan otomatis terbuka begitu kamu membuat pesanan ke mereka.',
  },
  {
    judul: 'Pembayaran dan pengiriman urusan kamu dengan distributor',
    isi: 'Kami mencatat pesanan dan menyimpan buktinya, tapi uangnya tidak lewat kami. Kalau barang telat, kurang, atau tidak sesuai, yang bertanggung jawab adalah distributor sesuai kesepakatan di pesanan atau kontrakmu.',
  },
  {
    judul: 'Kontrak mengikat di luar aplikasi',
    isi: 'Kuota, harga, dan masa berlaku pada kontrak berasal dari kesepakatanmu dengan distributor. Aplikasi ini hanya menampilkan dan mengingatkan; ia tidak menambah, mengurangi, atau membatalkan kewajiban apa pun di sana.',
  },
  {
    judul: 'Perkiraan adalah saran, bukan jaminan',
    isi: 'Angka perkiraan bisa meleset dan keputusan membeli tetap ada di tanganmu. Kami tidak menanggung kerugian yang timbul karena kamu mengikuti atau tidak mengikuti saran belanja.',
  },
  {
    judul: 'Kamu boleh berhenti kapan saja',
    isi: 'Akun bisa kamu tutup kapan pun lewat bantuan. Sebelum ditutup, kami kirimkan salinan datamu, dan kontrak yang masih berjalan dengan distributor tetap berlaku karena ia tidak pernah hidup di aplikasi ini.',
  },
]

export default function Bantuan() {
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [terbuka, setTerbuka] = useState<string[]>([FAQ[0].id])
  const [hubungi, setHubungi] = useState(false)
  const [ketentuan, setKetentuan] = useState(false)

  function alih(id: string) {
    setTerbuka((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function salinNomor() {
    try {
      await navigator.clipboard.writeText(NOMOR_BANTUAN)
      tampilkanRacun('Nomor bantuan tersalin.', 'aman')
    } catch {
      /* Penyalinan diblokir peramban: nomornya tetap terbaca di layar. */
      tampilkanRacun('Nomornya belum bisa disalin otomatis. Catat manual dari layar, ya.', 'menipis')
    }
  }

  return (
    <div className="pb-6">
      {/* Nomor versi sengaja tidak ditaruh di sini: ia sudah punya tempat tetap
          di kartu Tentang, dan menulisnya dua kali cuma memakan baris. */}
      <KepalaHalaman
        judul="Bantuan & Tentang Aplikasi"
        keterangan="Jawaban, batasan, dan nomor bantuan"
        kembaliKe="/akun"
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* Pertanyaan yang sering muncul */}
        <div className="lg:col-span-7">
          <section aria-label="Pertanyaan yang sering muncul">
            <JudulBagian
              judul="Pertanyaan yang sering muncul"
              keterangan="Dijawab dengan alasan sebenarnya, bukan dengan kalimat penenang."
              className="mb-3"
            />

            <div className="bg-surface border border-line rounded-lg shadow-e1 overflow-hidden">
              {FAQ.map((f, i) => {
                const buka = terbuka.includes(f.id)
                return (
                  <div key={f.id} className={cx(i > 0 && 'border-t border-line')}>
                    <h3>
                      <button
                        type="button"
                        onClick={() => alih(f.id)}
                        aria-expanded={buka}
                        aria-controls={`panel-${f.id}`}
                        className="w-full text-left flex items-start gap-3 px-4 py-4 min-h-[56px] hover:bg-sunken transition-colors"
                      >
                        <span className="grow text-[0.9375rem] font-semibold text-ink leading-snug">{f.tanya}</span>
                        <IkonPanahBawah
                          size={18}
                          className={cx(
                            'shrink-0 mt-0.5 text-ink-3 transition-transform duration-200',
                            buka && 'rotate-180',
                          )}
                        />
                      </button>
                    </h3>
                    <div
                      id={`panel-${f.id}`}
                      hidden={!buka}
                      className="px-4 pb-4 text-[0.875rem] text-ink-2 leading-relaxed"
                    >
                      {f.jawab}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
              Tidak ketemu jawabannya? Hubungi bantuan lewat tombol di bawah. Sebutkan nomor pesanan atau nama
              barangnya supaya kami bisa langsung melihat kasusnya.
            </p>
          </section>
        </div>

        {/* Tentang aplikasi */}
        <div className="lg:col-span-5 mt-6 lg:mt-0 space-y-4">
          <section aria-label="Tentang aplikasi ini">
            <JudulBagian judul="Tentang aplikasi ini" className="mb-3" />
            <Kartu>
              <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                Aplikasi ini mengurus satu hal: memastikan bahan dan barang daganganmu tidak pernah habis mendadak,
                dan belanja ke distributor tidak jadi tebak-tebakan.
              </p>

              <Pemisah className="my-3.5" />

              <h3 className="text-[0.8125rem] font-bold text-ink uppercase tracking-wide">Yang dilakukan</h3>
              <ul className="mt-2 space-y-2">
                {DILAKUKAN.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[0.875rem] text-ink-2 leading-relaxed">
                    <IkonCentang size={16} className="shrink-0 mt-0.5 text-aman" />
                    {t}
                  </li>
                ))}
              </ul>

              <Pemisah className="my-3.5" />

              <h3 className="text-[0.8125rem] font-bold text-ink uppercase tracking-wide">Yang TIDAK dilakukan</h3>
              <ul className="mt-2 space-y-2">
                {TIDAK_DILAKUKAN.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[0.875rem] text-ink-3 leading-relaxed">
                    <IkonSilang size={16} className="shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </Kartu>
          </section>

          {/* Disclaimer perkiraan ditulis di luar akordeon supaya terbaca tanpa
              harus dibuka lebih dulu. */}
          <Peringatan nada="menipis" judul="Perkiraan adalah saran, bukan jaminan">
            Angka perkiraan dihitung dari pemakaian barangmu selama ini. Ia bisa meleset, terutama saat ada hari
            ramai yang tidak biasa, promo dadakan, atau perubahan menu. Keputusan akhir berapa yang dibeli tetap ada
            di tanganmu &mdash; aplikasi ini tidak pernah memesan apa pun tanpa kamu tekan.
          </Peringatan>

          <Kartu padat>
            <button
              type="button"
              onClick={() => setKetentuan(true)}
              className="w-full text-left flex items-center justify-between gap-3 min-h-11 rounded-sm px-1 -mx-1 hover:bg-sunken transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold text-ink">Ketentuan layanan</span>
                <span className="block text-[0.8125rem] text-ink-3 leading-snug">
                  Apa yang kami janjikan, dan apa yang jadi tanggung jawabmu
                </span>
              </span>
              <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
            </button>

            <Pemisah className="my-3" />

            <div className="flex items-baseline gap-2">
              <p className="text-[0.8125rem] font-semibold text-ink-2">Versi aplikasi</p>
              <p className="text-[0.8125rem] text-ink-3 tabular">{VERSI}</p>
            </div>
          </Kartu>

          <Tombol penuh ukuran="besar" ikonKiri={<IkonBantuan size={18} />} onClick={() => setHubungi(true)}>
            Hubungi Bantuan
          </Tombol>
        </div>
      </div>

      <Lembar
        terbuka={hubungi}
        tutup={() => setHubungi(false)}
        judul="Hubungi bantuan"
        keterangan="Dijawab pada jam kerja, Senin sampai Sabtu 08.00-17.00."
        lebar="sempit"
        kaki={
          <Tombol ragam="garis" penuh onClick={() => setHubungi(false)}>
            Tutup
          </Tombol>
        }
      >
        <div className="pb-4">
          <div className="flex items-center gap-3 rounded-md bg-sunken border border-line px-3.5 py-3">
            <span className="shrink-0 size-10 rounded-md grid place-items-center bg-surface text-ink-2 border border-line">
              <IkonTelepon size={18} />
            </span>
            <div className="min-w-0 grow">
              <p className="text-[0.75rem] text-ink-3">WhatsApp bantuan</p>
              <p className="text-[1rem] font-bold text-ink tabular">{formatHp(NOMOR_BANTUAN)}</p>
            </div>
            <Tombol ragam="garis" ukuran="kecil" ikonKiri={<IkonSalin size={15} />} onClick={salinNomor}>
              Salin
            </Tombol>
          </div>

          <p className="mt-3.5 text-[0.875rem] text-ink-2 leading-relaxed">
            Supaya cepat ketemu, sebutkan tiga hal ini di pesan pertamamu:
          </p>
          <ol className="mt-2 space-y-1.5 list-decimal pl-5 text-[0.875rem] text-ink-2 leading-relaxed">
            <li>Nama usahamu seperti yang tertulis di profil.</li>
            <li>Nomor pesanan atau nama barang yang bermasalah.</li>
            <li>Apa yang kamu harapkan terjadi, dan apa yang kamu lihat di layar.</li>
          </ol>

          <p className="mt-3.5 text-[0.8125rem] text-ink-3 leading-relaxed">
            Untuk urusan barang yang kurang, pecah, atau telat sampai, hubungi distributornya lebih dulu lewat
            halaman pesanan. Mereka yang memegang barangnya, jadi jawabannya jauh lebih cepat.
          </p>
        </div>
      </Lembar>

      {/* Ketentuan layanan ditulis sebagai enam janji pendek, bukan pasal.
          Ketentuan yang tidak terbaca sama saja dengan tidak ada ketentuan. */}
      <Lembar
        terbuka={ketentuan}
        tutup={() => setKetentuan(false)}
        judul="Ketentuan layanan"
        keterangan={`Berlaku untuk versi ${VERSI}. Kalau berubah, kami beri tahu lebih dulu di layar ini.`}
        kaki={
          <Tombol ragam="garis" penuh onClick={() => setKetentuan(false)}>
            Tutup
          </Tombol>
        }
      >
        <div className="pb-4 space-y-3.5">
          {KETENTUAN.map((k) => (
            <div key={k.judul}>
              <h3 className="text-[0.9375rem] font-bold text-ink leading-snug">{k.judul}</h3>
              <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">{k.isi}</p>
            </div>
          ))}

          <Peringatan nada="netral">
            Ada bagian yang tidak kamu setujui atau tidak kamu mengerti? Hubungi bantuan lewat WhatsApp sebelum kamu
            membuat pesanan atau mengikat kontrak. Lebih mudah dibicarakan sekarang daripada setelah barangnya jalan.
          </Peringatan>
        </div>
      </Lembar>
    </div>
  )
}
