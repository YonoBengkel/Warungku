import { useMemo } from 'react'
import { KartuPromo } from '@/components/domain/KartuPromo'
import { JudulBagian, Kartu, TombolTautan } from '@/components/ui/dasar'
import { RUANG_LONCENG } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonBintang, IkonTambah } from '@/icons'
import { promoMasihBerlaku } from '@/data/dummy'
import type { Promo } from '@/lib/types'
import { useAplikasi, useDistributorAktif } from '@/store/aplikasi'

/**
 * Promo di portal distributor (catatan B2, ON-Dist 4).
 *
 * Promo yang dipasang di sini langsung tampil di Beranda pemilik usaha, dan
 * potongannya masuk ke harga BELI SEKALI lewat `rincianHarga`. Harga kontrak
 * tidak ikut terpotong: kontrak adalah kesepakatan yang sudah dikunci.
 *
 * Sejak revisi V4 (Q90) tiap promo satu kotak utuh, tiga per baris, yang
 * membuka halamannya sendiri (`PromoUbah`). Tombol Ubah dan Akhiri Sekarang di
 * bawah kartu serta jendela pop-up-nya sudah tidak ada. Sejak revisi V5 kotaknya
 * kartu berfoto yang sama dengan Beranda pemilik usaha, jadi nama toko ikut
 * tertulis seperti yang dilihat pemesan.
 */

/** Barang ikut yang ditulis di kotak; sisanya cukup "+N". */
const MAKS_NAMA_BARANG = 3

/**
 * Satu promo: kartu berfoto yang sama persis dengan Beranda pemilik usaha
 * (revisi V5, Q107), membuka halaman ubahnya. Barang yang ikut ditulis di
 * bawah kartu, karena hanya distributor yang perlu melihatnya di sini.
 */
function KotakPromo({ promo, namaBarang, berakhir }: { promo: Promo; namaBarang: string[]; berakhir?: boolean }) {
  const tampil = namaBarang.slice(0, MAKS_NAMA_BARANG)
  const sisa = namaBarang.length - tampil.length

  return (
    <div className="flex flex-col gap-2">
      <KartuPromo promo={promo} ke={`/distributor-portal/promo/${promo.id}`} redup={berakhir} />
      <p className="px-1 text-isi text-ink-2 leading-snug">
        <span className="text-ink-3">Barang ikut:</span>{' '}
        {tampil.length > 0 ? tampil.join(', ') : 'belum ada'}
        {sisa > 0 && <span className="font-semibold text-ink"> +{sisa}</span>}
      </p>
    </div>
  )
}

export default function PromoDistributor() {
  const semuaPromo = useAplikasi((s) => s.katalogDistributorServer?.promo ?? s.promo)
  const katalog = useAplikasi((s) => s.katalogDistributorServer?.penawaran ?? s.katalog)
  const distributor = useDistributorAktif()

  const { berjalan, berakhir } = useMemo(() => {
    const milikSaya = semuaPromo.filter((p) => p.distributorId === distributor.id)
    return {
      berjalan: milikSaya.filter((p) => promoMasihBerlaku(p)),
      berakhir: milikSaya.filter((p) => !promoMasihBerlaku(p)),
    }
  }, [semuaPromo, distributor.id])

  const namaBarang = (ids: string[]) =>
    ids.map((id) => katalog.find((p) => p.id === id)?.nama).filter((n): n is string => !!n)

  const kisi = (daftar: Promo[], sudahBerakhir?: boolean) => (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
      {daftar.map((p) => (
        <li key={p.id}>
          <KotakPromo promo={p} namaBarang={namaBarang(p.penawaranIds)} berakhir={sudahBerakhir} />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="pb-6">
      <div className={`flex flex-wrap items-start justify-between gap-3 ${RUANG_LONCENG}`}>
        <div className="min-w-0">
          <h1 className="text-judul font-extrabold text-ink tracking-tight">Promo</h1>
          <p className="mt-1 text-isi text-ink-2 leading-relaxed max-w-[62ch]">
            Promo tampil di Beranda pemilik usaha. Potongan hanya untuk beli sekali.
          </p>
        </div>
        <TombolTautan ke="/distributor-portal/promo/baru" ikonKiri={<IkonTambah size={17} />}>
          Buat Promo
        </TombolTautan>
      </div>

      <section aria-labelledby="judul-promo-berjalan" className="mt-5">
        <JudulBagian
          id="judul-promo-berjalan"
          judul="Sedang berjalan"
          keterangan={berjalan.length > 0 ? `${berjalan.length} promo tampil di Beranda pemilik usaha` : undefined}
        />
        {berjalan.length === 0 ? (
          <Kartu>
            <KeadaanKosong
              ikon={<IkonBintang size={26} />}
              judul="Belum ada promo yang berjalan"
              pesan="Pasang promo untuk mengabarkan barang baru atau melepas stok yang menumpuk."
              aksi={<TombolTautan ke="/distributor-portal/promo/baru">Buat Promo</TombolTautan>}
            />
          </Kartu>
        ) : (
          kisi(berjalan)
        )}
      </section>

      {berakhir.length > 0 && (
        <section aria-labelledby="judul-promo-berakhir" className="mt-8">
          <JudulBagian
            id="judul-promo-berakhir"
            judul="Sudah berakhir"
            keterangan="Tidak tampil lagi di Beranda. Buka promonya untuk memasangnya lagi dengan tanggal baru."
          />
          {kisi(berakhir, true)}
        </section>
      )}
    </div>
  )
}
