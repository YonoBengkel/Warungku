import { useState } from 'react'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Peringatan } from '@/components/ui/umpanBalik'
import { Lembar } from '@/components/ui/lembar'
import { IkonCentang, IkonInfo, IkonNota, IkonSilang } from '@/icons'
import { BANTUAN } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Halaman perbandingan yang tidak berjualan.
 *
 * Paket Dasar ditampilkan sebagai pilihan yang sah dan cukup, bukan sebagai
 * versi cacat dari Premium. Karena itu kolom Dasar tidak pernah diisi tanda
 * silang untuk hal yang memang tidak dijanjikan, dan tombolnya berbunyi
 * "Pelajari Premium", bukan ajakan menaikkan paket.
 *
 * Satu perbedaan nyata yang boleh disebut cuma pembayaran. Sisanya sama persis,
 * dan itu ditulis apa adanya walaupun membuat Premium terdengar kecil.
 */

interface BarisBanding {
  hal: string
  dasar: { teks: string; ada: boolean }
  premium: { teks: string; ada: boolean }
}

const BANDING: BarisBanding[] = [
  {
    hal: 'Catatan stok & riwayat pergerakan',
    dasar: { teks: 'Lengkap', ada: true },
    premium: { teks: 'Sama persis', ada: true },
  },
  {
    hal: 'Perkiraan kebutuhan & saran belanja',
    dasar: { teks: 'Lengkap', ada: true },
    premium: { teks: 'Sama persis', ada: true },
  },
  {
    hal: 'Belanja ke distributor & kontrak',
    dasar: { teks: 'Lengkap', ada: true },
    premium: { teks: 'Sama persis', ada: true },
  },
  {
    hal: 'Pengguna & hak akses',
    dasar: { teks: 'Lengkap', ada: true },
    premium: { teks: 'Sama persis', ada: true },
  },
  {
    hal: 'Cara membayar pesanan',
    dasar: { teks: 'Kamu bayar langsung ke distributor di luar aplikasi', ada: true },
    premium: { teks: 'Pembayaran bisa diotomasikan lewat aplikasi', ada: true },
  },
  {
    hal: 'Bukti pembayaran',
    dasar: { teks: 'Kamu unggah sendiri fotonya', ada: true },
    premium: { teks: 'Tercatat otomatis, tidak perlu diunggah', ada: true },
  },
  {
    hal: 'Status pesanan setelah dibayar',
    dasar: { teks: 'Berubah setelah distributor memeriksa buktimu', ada: true },
    premium: { teks: 'Berubah sendiri begitu pembayaran terkonfirmasi', ada: true },
  },
  {
    hal: 'Biaya bulanan',
    dasar: { teks: 'Tidak ada', ada: true },
    premium: { teks: 'Ada. Rinciannya kami kirim sebelum kamu memutuskan', ada: false },
  },
]

export default function Langganan() {
  const tier = useAplikasi((s) => s.profil.tier)
  const [pelajari, setPelajari] = useState(false)

  const dasarAktif = tier === 'dasar'

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Langganan"
        keterangan={dasarAktif ? 'Kamu memakai paket Dasar' : 'Kamu memakai paket Premium'}
        kembaliKe="/akun"
      />

      <div className="mt-4 max-w-4xl">
        <Peringatan nada="netral" judul="Paket Dasar sudah cukup untuk menjalankan warung">
          Semua yang kamu pakai tiap hari &mdash; stok, perkiraan, saran belanja, pesanan, dan kontrak &mdash; ada di
          paket Dasar tanpa batas dan tanpa biaya. Premium tidak menambah fitur baru di layar mana pun; ia hanya
          mengganti cara pembayaran pesanan dicatat.
        </Peringatan>

        {/* Mobile: dua kartu bertumpuk. Desktop: satu tabel yang bisa dibandingkan
            baris per baris tanpa memindai bolak-balik. */}
        <div className="mt-5 space-y-3 lg:hidden">
          <KartuPaket
            nama="Dasar"
            sedangDipakai={dasarAktif}
            ringkas="Mencatat semuanya. Pembayaran diurus langsung antara kamu dan distributor."
            isi={BANDING.map((b) => ({ hal: b.hal, ...b.dasar }))}
          />
          <KartuPaket
            nama="Premium"
            sedangDipakai={!dasarAktif}
            ringkas="Sama seperti Dasar, ditambah pembayaran yang bisa berjalan sendiri."
            isi={BANDING.map((b) => ({ hal: b.hal, ...b.premium }))}
          />
        </div>

        <div className="mt-5 hidden lg:block">
          <Kartu className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Perbandingan isi paket Dasar dan paket Premium</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2.5 pr-4 text-[0.8125rem] font-semibold text-ink-3 w-[30%]">
                    Hal yang dibandingkan
                  </th>
                  <th scope="col" className="py-2.5 px-4 text-[0.9375rem] font-bold text-ink w-[35%]">
                    <span className="inline-flex items-center gap-2">
                      Dasar
                      {dasarAktif && <Lencana nada="merek">Sedang dipakai</Lencana>}
                    </span>
                  </th>
                  <th scope="col" className="py-2.5 pl-4 text-[0.9375rem] font-bold text-ink w-[35%]">
                    <span className="inline-flex items-center gap-2">
                      Premium
                      {!dasarAktif && <Lencana nada="merek">Sedang dipakai</Lencana>}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {BANDING.map((b) => (
                  <tr key={b.hal} className="border-b border-line last:border-0 align-top">
                    <th
                      scope="row"
                      className="py-3 pr-4 text-[0.875rem] font-semibold text-ink-2 leading-snug text-left"
                    >
                      {b.hal}
                    </th>
                    <td className="py-3 px-4 text-[0.875rem] text-ink-2 leading-snug">
                      <Nilai ada={b.dasar.ada} teks={b.dasar.teks} />
                    </td>
                    <td className="py-3 pl-4 text-[0.875rem] text-ink-2 leading-snug">
                      <Nilai ada={b.premium.ada} teks={b.premium.teks} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        </div>

        {/* Di layar lebar catatan dan tombol berdiri berdampingan: barisnya jadi
            lebih pendek untuk dibaca, dan tombolnya tidak terdorong jauh ke bawah. */}
        <div className="mt-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
          <Kartu>
            <div className="flex items-start gap-3">
              <span className="shrink-0 size-9 rounded-md grid place-items-center bg-sunken text-ink-2">
                <IkonNota size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">
                  Halaman pesananmu tidak berubah bentuk
                </h2>
                <p className="mt-1.5 text-[0.875rem] text-ink-2 leading-relaxed">
                  Kalau nanti kamu memakai Premium, otomasi pembayaran mengganti isi blok Pembayaran di halaman
                  pesanan. Letak dan tata letaknya tetap sama: kotak yang sekarang berisi tombol unggah bukti akan
                  berisi status pembayaran yang berjalan sendiri. Tidak ada tombol yang pindah, tidak ada halaman
                  baru yang harus kamu pelajari.
                </p>
                <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">
                  {BANTUAN.bayarLuarPanjang} Itu yang berlaku selama kamu di paket Dasar.
                </p>
              </div>
            </div>
          </Kartu>

          <div className="mt-5 lg:mt-0">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Tombol ragam="garis" penuh onClick={() => setPelajari(true)}>
                Pelajari Premium
              </Tombol>
              <TombolTautan ke="/akun" ragam="sunyi" penuh>
                {dasarAktif ? 'Tetap di Paket Dasar' : 'Kembali ke Akun'}
              </TombolTautan>
            </div>

            <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
              Kami tidak menampilkan ajakan Premium di Beranda atau di daftar stok. Kalau kamu tidak membuka halaman
              ini, kamu tidak akan ditawari apa pun.
            </p>
          </div>
        </div>
      </div>

      <Lembar
        terbuka={pelajari}
        tutup={() => setPelajari(false)}
        judul="Premium: apa yang benar-benar berubah"
        keterangan="Ditulis apa adanya, termasuk yang tidak berubah."
        kaki={
          <Tombol ragam="garis" penuh onClick={() => setPelajari(false)}>
            Tutup
          </Tombol>
        }
      >
        <div className="pb-4 space-y-4">
          <div>
            <h3 className="text-[0.9375rem] font-bold text-ink">Yang berubah</h3>
            <ul className="mt-2 space-y-2">
              {[
                'Pembayaran pesanan bisa dijalankan dari dalam aplikasi, tidak lagi lewat transfer terpisah.',
                'Kamu tidak perlu memotret dan mengunggah bukti transfer satu per satu.',
                'Status pesanan berpindah sendiri begitu pembayaran terkonfirmasi, tanpa menunggu distributor memeriksa bukti.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-[0.875rem] text-ink-2 leading-relaxed">
                  <IkonCentang size={16} className="shrink-0 mt-0.5 text-aman" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <Pemisah />

          <div>
            <h3 className="text-[0.9375rem] font-bold text-ink">Yang tidak berubah</h3>
            <ul className="mt-2 space-y-2">
              {[
                'Perkiraan kebutuhan dan saran belanja sama persis, tidak jadi lebih pintar.',
                'Harga barang dari distributor tidak berubah, dan tidak ada potongan khusus.',
                'Batas jumlah barang, pengguna, dan kontrak tetap tanpa batas seperti di paket Dasar.',
                'Tata letak halaman pesanan tetap sama; hanya isi blok Pembayaran yang diganti.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-[0.875rem] text-ink-3 leading-relaxed">
                  <IkonInfo size={16} className="shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <Peringatan nada="netral">
            Kalau pembayaran ke distributormu selama ini lancar lewat transfer biasa, Premium tidak akan terasa
            bedanya. Ia paling berguna kalau kamu punya banyak pesanan tiap minggu dan lelah mengunggah bukti satu
            per satu.
          </Peringatan>

          <p className="text-[0.8125rem] text-ink-3 leading-relaxed">
            Kami belum membuka pendaftaran Premium di dalam aplikasi. Kalau tertarik, hubungi bantuan lewat halaman
            Bantuan &amp; Tentang Aplikasi dan kami kirimkan rincian biayanya lebih dulu.
          </p>
        </div>
      </Lembar>
    </div>
  )
}

function Nilai({ ada, teks }: { ada: boolean; teks: string }) {
  return (
    <span className="flex items-start gap-2">
      {ada ? (
        <IkonCentang size={16} className="shrink-0 mt-0.5 text-aman" />
      ) : (
        <IkonSilang size={16} className="shrink-0 mt-0.5 text-ink-3" />
      )}
      <span>{teks}</span>
    </span>
  )
}

function KartuPaket({
  nama,
  sedangDipakai,
  ringkas,
  isi,
}: {
  nama: string
  sedangDipakai: boolean
  ringkas: string
  isi: Array<{ hal: string; teks: string; ada: boolean }>
}) {
  return (
    <Kartu className={sedangDipakai ? 'ring-2 ring-brand' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.125rem] font-extrabold text-ink tracking-tight">{nama}</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2 leading-snug">{ringkas}</p>
        </div>
        {sedangDipakai && (
          <Lencana nada="merek" besar className="shrink-0">
            Sedang dipakai
          </Lencana>
        )}
      </div>

      <Pemisah className="my-3.5" />

      <dl className="space-y-3">
        {isi.map((b) => (
          <div key={b.hal}>
            <dt className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">{b.hal}</dt>
            <dd className="mt-1 text-[0.875rem] text-ink-2 leading-snug">
              <Nilai ada={b.ada} teks={b.teks} />
            </dd>
          </div>
        ))}
      </dl>
    </Kartu>
  )
}
