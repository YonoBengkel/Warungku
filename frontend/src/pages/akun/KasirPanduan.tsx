import { useHref, useSearchParams } from 'react-router-dom'
import { Kartu, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { Peringatan } from '@/components/ui/umpanBalik'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Panduan agar nota kasir masuk ke Turnify Flow.
 *
 * Satu-satunya jalur nota yang benar-benar bekerja adalah Portal POS, jadi layar
 * ini menjelaskan jalur itu. Dulu di sini ada kolom kode sambungan dan uji koneksi
 * yang hasilnya dikarang (audit 5 Nov 2026). Jangan dikembalikan sebelum ada
 * sambungan sungguhan ke aplikasi kasir lain.
 */
export default function KasirPanduan() {
  const [params] = useSearchParams()
  const server = useAplikasi((s) => s.sumberData === 'server')
  const kelontong = useAplikasi((s) => s.profil.jenisUsaha === 'warung-kelontong')
  const alamatPos = useHref('/masuk/pos')

  /* Halaman ini dipakai dua kali: sebagai langkah pendaftaran dan dari halaman
     Data dari Kasir. Penandanya ikut dibawa pada jalan kembali, supaya pendaftar
     tidak terlempar keluar dari alurnya di tengah jalan. */
  const onboarding = params.get('langkah') === 'mulai'
  const tautanKembali = onboarding ? '/akun/kasir?langkah=mulai' : '/akun/kasir'

  const langkah = [
    {
      judul: 'Buat akun untuk kasirmu',
      detail: 'Di Akun, bagian Pengguna, tambahkan orang yang menjaga kasir. Ia masuk dengan email dan kata sandi sendiri.',
    },
    {
      judul: 'Kasir masuk ke Portal POS',
      detail: 'Portal POS kasir peraga yang berjalan di peramban. Bukalah di tab atau perangkat lain, karena sesinya terpisah dari akun pemilik.',
    },
    {
      judul: 'Nota masuk sendiri',
      detail: 'Setiap nota dari Portal POS langsung masuk ke Turnify Flow dan memotong stok lewat resep tiap menu. Tidak ada kode yang perlu disalin.',
    },
  ]

  return (
    <div className="pb-8 lg:pb-0">
      <KepalaHalaman judul="Panduan Nota Kasir" keterangan="Lewat Portal POS" kembaliKe={tautanKembali} />

      <div className="mt-4 max-w-2xl">
        {kelontong ? (
          <Peringatan nada="info" judul="Portal POS belum untuk warung kelontong">
            Barang warung dijual apa adanya dan belum punya daftar menu, jadi kasir peraganya belum bisa dipakai. Pemakaian
            barang bisa dicatat sendiri lewat Catat Pemakaian di tab Stok.
          </Peringatan>
        ) : (
        <>
        <ol className="space-y-3">
          {langkah.map((l, i) => (
            <li key={l.judul}>
              <Kartu>
                <p className="inline-flex items-center gap-2">
                  {/* text-ink-inverse: di tema gelap bg-brand jadi terang, dan angka putih di atasnya hampir hilang. */}
                  <span className="size-6 rounded-full bg-brand text-ink-inverse grid place-items-center text-kecil font-extrabold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[1rem] font-bold text-ink leading-snug">{l.judul}</span>
                </p>
                <p className="mt-1.5 text-isi text-ink-2 leading-relaxed">{l.detail}</p>
              </Kartu>
            </li>
          ))}
        </ol>

        <Peringatan nada="info" judul="Sambungan ke aplikasi kasir lain belum tersedia" className="mt-4">
          Di purwarupa ini nota hanya masuk lewat Portal POS. Aplikasi kasir yang sudah kamu pakai belum bisa mengirim
          notanya ke sini.
        </Peringatan>
        </>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          {onboarding ? (
            <TombolTautan ke="/mulai/batas-aman" penuh>
              Lanjut ke Batas Aman
            </TombolTautan>
          ) : kelontong ? (
            <TombolTautan ke="/stok/pemakaian" penuh>
              Catat Pemakaian
            </TombolTautan>
          ) : (
            <TombolTautan ke="/akun/pengguna" penuh>
              Buat Akun Kasir
            </TombolTautan>
          )}
          {server && !kelontong && (
            /* Tab baru: Portal POS memakai kunci sesi yang sama, jadi sesi pemilik akan terganti. */
            <a
              href={alamatPos}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full h-11 px-4 rounded-md border border-line-strong text-isi font-bold text-ink hover:bg-sunken"
            >
              Buka Portal POS
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
