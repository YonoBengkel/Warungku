import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LogoPromo, TEMPLATE_PROMO } from '@/components/domain/KartuPromo'
import { JudulBagian, Kartu, TombolTautan } from '@/components/ui/dasar'
import { RUANG_LONCENG } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonBintang, IkonJam, IkonPanahKanan, IkonTambah } from '@/icons'
import { cx, hariLagi, persen, tanggalRingkas } from '@/lib/format'
import { LABEL_PROMO } from '@/lib/label'
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
 * bawah kartu serta jendela pop-up-nya sudah tidak ada. Nama toko tidak
 * ditulis: semua promo di sini milik toko ini sendiri.
 */

/** Barang ikut yang ditulis di kotak; sisanya cukup "+N". */
const MAKS_NAMA_BARANG = 3

function KotakPromo({ promo, namaBarang, berakhir }: { promo: Promo; namaBarang: string[]; berakhir?: boolean }) {
  const template = TEMPLATE_PROMO[promo.jenis]
  const sisaHari = promo.berakhir ? Math.ceil((+new Date(promo.berakhir) - Date.now()) / 86_400_000) : null
  const tampil = namaBarang.slice(0, MAKS_NAMA_BARANG)
  const sisa = namaBarang.length - tampil.length

  return (
    // Seluruh kotak satu tautan: target sentuhnya sebesar kotaknya.
    <Link
      to={`/distributor-portal/promo/${promo.id}`}
      className="group h-full flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-e1 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-e2"
    >
      <div className="flex items-start gap-3">
        <LogoPromo promo={promo} ukuran={48} redup={berakhir} />
        <div className="min-w-0 grow">
          <span
            className={cx(
              'inline-flex items-center rounded-sm px-2 py-[3px] text-[0.6875rem] font-bold',
              berakhir ? 'bg-sunken text-ink-2' : template.aksen,
            )}
          >
            {LABEL_PROMO[promo.jenis]}
          </span>
          <p className="mt-1 text-subjudul font-extrabold text-ink leading-snug line-clamp-2">{promo.judul}</p>
        </div>
        <IkonPanahKanan size={18} className="shrink-0 mt-1 text-ink-3 group-hover:text-ink transition-colors" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {promo.potonganPersen != null ? (
          <span
            className={cx(
              'inline-flex items-center rounded-sm px-2 py-[3px] text-kecil font-bold',
              berakhir ? 'bg-sunken text-ink-2' : cx(template.latar, template.teks),
            )}
          >
            Potongan {persen(promo.potonganPersen)}
          </span>
        ) : (
          <span className="text-kecil font-semibold text-ink-3">Tanpa potongan</span>
        )}
        <span className="inline-flex items-center gap-1 text-kecil font-semibold text-ink-2">
          <IkonJam size={13} className="shrink-0" />
          {berakhir && promo.berakhir
            ? `Berakhir ${tanggalRingkas(promo.berakhir)}`
            : promo.berakhir && sisaHari != null
              ? `Sampai ${tanggalRingkas(promo.berakhir)} · ${hariLagi(sisaHari)}`
              : 'Tanpa tanggal berakhir'}
        </span>
      </div>

      <p className="mt-auto pt-3 border-t border-line text-isi text-ink-2 leading-snug">
        <span className="text-ink-3">Barang ikut:</span>{' '}
        {tampil.length > 0 ? tampil.join(', ') : 'belum ada'}
        {sisa > 0 && <span className="font-semibold text-ink"> +{sisa}</span>}
      </p>
    </Link>
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
