import { Link, useParams } from 'react-router-dom'
import { JudulBagian, Kartu, KartuTautan, Lencana, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { HargaBeli, TEMPLATE_PROMO } from '@/components/domain/KartuPromo'
import { IkonJam, IkonPanahKanan, IkonSilang, IkonToko } from '@/icons'
import { cx, hariLagi, jumlahSatuan, persen, tanggalPanjang } from '@/lib/format'
import { LABEL_PROMO } from '@/lib/label'
import type { Penawaran } from '@/lib/types'
import { distributorById, penawaranById, promoMasihBerlaku } from '@/data/dummy'
import { usePenentuHarga } from '@/store/aplikasi'

/**
 * Laman promo satu toko, dibuka dari kartu promo di Beranda.
 *
 * Blok kepalanya memakai template yang sama persis dengan kartunya supaya
 * pemilik warung yakin ia mendarat di promo yang tadi ditekan: warna, ikon,
 * dan lencana jenisnya tidak berubah, yang bertambah hanya isinya.
 *
 * Harga yang tampil di sini adalah harga BELI dari distributor. Itu bukan
 * harga jual produk akhir — harga jual tetap milik aplikasi kasir dan tidak
 * pernah muncul di aplikasi ini.
 *
 * Harganya dibaca lewat `rincianHarga`, sumber yang sama dengan halaman
 * penawaran, keranjang, dan pesanan. Potongan promo berlaku untuk beli sekali;
 * barang yang terikat kontrak tetap memakai harga kontrak.
 */
export default function PromoDetail() {
  const { id = '' } = useParams()
  const { promoById, rincianHarga } = usePenentuHarga()
  const promo = promoById(id)

  if (!promo) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Promo" kembaliKe="/beranda" />
        <Kartu className="mt-6">
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Promo ini sudah tidak ada"
            pesan="Masa promonya mungkin sudah lewat, atau tautannya salah salin. Promo yang sedang berjalan bisa kamu lihat lagi di Beranda."
            aksi={<TombolTautan ke="/beranda">Kembali ke Beranda</TombolTautan>}
          />
        </Kartu>
      </div>
    )
  }

  const template = TEMPLATE_PROMO[promo.jenis]
  const distributor = distributorById(promo.distributorId)
  const namaToko = distributor?.nama ?? 'Distributor'
  const sisaHari = promo.berakhir
    ? Math.ceil((+new Date(promo.berakhir) - Date.now()) / 86_400_000)
    : null
  const penawaran = promo.penawaranIds
    .map((x) => penawaranById(x))
    .filter((p): p is Penawaran => p != null)

  return (
    <div className="pb-6">
      <KepalaHalaman judul={promo.judul} keterangan={namaToko} kembaliKe="/beranda" />

      {/* Kepala promo: template dibaca dari jenis promo, nama toko dari datanya. */}
      <div className={cx('mt-4 rounded-lg p-4 sm:p-5', template.latar, template.teks)}>
        <div className="flex items-center gap-2">
          <span className={cx('shrink-0 size-10 rounded-md grid place-items-center', template.aksen)}>
            <template.Ikon size={20} />
          </span>
          <span
            className={cx(
              'inline-flex items-center rounded-sm px-2.5 py-1 text-[0.8125rem] font-bold',
              template.aksen,
            )}
          >
            {LABEL_PROMO[promo.jenis]}
          </span>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[1.0625rem] font-extrabold min-w-0">
          <IkonToko size={18} className="shrink-0" />
          <span className="truncate">{namaToko}</span>
        </p>

        <p className="mt-1.5 text-[0.875rem] leading-relaxed">{promo.keterangan}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {promo.potonganPersen != null && (
            <span className="inline-flex items-center rounded-sm bg-surface text-ink px-2.5 py-1 text-[0.8125rem] font-bold">
              Potongan {persen(promo.potonganPersen)}
            </span>
          )}
          {promo.berakhir && sisaHari != null ? (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
              <IkonJam size={14} className="shrink-0" />
              Sampai {tanggalPanjang(promo.berakhir)} · {hariLagi(sisaHari)}
            </span>
          ) : (
            <span className="text-[0.8125rem] font-semibold">Tidak ada tanggal berakhir.</span>
          )}
        </div>
      </div>

      {/* Tautan lama ke promo yang sudah diakhiri tetap terbuka, tapi harganya
          sudah harga biasa. Kalimat ini mencegah orang mengira potongannya
          masih berlaku. */}
      {!promoMasihBerlaku(promo) && (
        <Peringatan nada="netral" judul="Promo ini sudah berakhir" className="mt-4 lg:max-w-[70ch]">
          Harga di bawah sudah kembali ke harga beli sekali yang biasa. Pesanan yang dibuat selama promo berjalan tetap
          mencatat harga promonya.
        </Peringatan>
      )}

      <section aria-labelledby="judul-barang-promo" className="mt-6">
        <JudulBagian
          id="judul-barang-promo"
          judul="Barang yang ikut promo"
          keterangan={
            promo.potonganPersen
              ? `Harga beli sekali dari ${namaToko}, sudah dipotong promo. Barang yang terikat kontrak tetap memakai harga kontrak.`
              : `Harga beli sekali dari ${namaToko}.`
          }
        />

        {penawaran.length === 0 ? (
          <Kartu padat>
            <p className="text-[0.875rem] text-ink-3">
              Barang yang ikut promo ini belum dicantumkan distributor.
            </p>
          </Kartu>
        ) : (
          <div className="space-y-2.5">
            {penawaran.map((p) => {
              const kosong = p.stokTersedia <= 0
              return (
                <KartuTautan key={p.id} ke={`/penawaran/${p.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 grow">
                      <p className="text-[0.9375rem] font-bold text-ink">{p.nama}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-3">{p.keterangan}</p>
                      <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                        {kosong ? (
                          <Lencana nada="kritis" ikon={<IkonSilang size={12} />}>
                            Stok distributor kosong
                          </Lencana>
                        ) : (
                          <>Stok distributor {jumlahSatuan(p.stokTersedia, p.satuan)}</>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {/* Angka yang sama persis dengan yang dipakai halaman
                          penawaran dan keranjang. Satu barang tidak boleh
                          punya dua harga di dua layar. */}
                      <HargaBeli rincian={rincianHarga(p.id, null)} satuan={p.satuan} className="justify-end" />
                    </div>
                  </div>
                </KartuTautan>
              )
            })}
          </div>
        )}
      </section>

      <div className="mt-6">
        <Link
          to={`/distributor/${promo.distributorId}`}
          className="inline-flex items-center gap-1.5 min-h-11 text-[0.875rem] font-bold text-brand hover:underline"
        >
          Lihat semua barang dari {namaToko}
          <IkonPanahKanan size={16} className="shrink-0" />
        </Link>
      </div>
    </div>
  )
}
