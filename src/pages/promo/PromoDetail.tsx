import { Link, useParams } from 'react-router-dom'
import { Avatar, JudulBagian, Kartu, KartuTautan, Lencana, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { HargaBeli, TEMPLATE_PROMO } from '@/components/domain/KartuPromo'
import { IkonJam, IkonPanahKanan, IkonSilang, IkonToko } from '@/icons'
import { cx, hariLagi, jumlahSatuan, persen, tanggalPanjang } from '@/lib/format'
import { LABEL_PROMO } from '@/lib/label'
import type { Penawaran, Promo, RincianHarga } from '@/lib/types'
import { distributorById, penawaranById, promoMasihBerlaku } from '@/data/dummy'
import { usePenentuHarga } from '@/store/aplikasi'

/**
 * Laman promo satu toko, dibuka dari kartu promo di Beranda (catatan C1–C3).
 *
 * Satu laman, tiga susunan. Jenis promo menentukan apa yang paling ditonjolkan:
 * - Produk Baru: etalase. Barangnya sendiri yang jadi tontonan, berjajar dalam
 *   kisi yang menyesuaikan lebar layar.
 * - Cuci Gudang: batas waktu dan sisa stok. Promonya berhenti saat waktunya
 *   habis ATAU barangnya habis, jadi dua angka itu yang dibesarkan.
 * - Promo Keanggotaan: keuntungan per tingkat, diisi distributor di portalnya.
 *
 * Kisinya fluid: satu kolom di HP, lalu bertambah sesuai lebar layar sampai
 * empat kolom, bukan satu kolom panjang yang melebar sampai 1.400 piksel.
 *
 * Blok kepalanya memakai template yang sama persis dengan kartunya supaya
 * pemilik warung yakin ia mendarat di promo yang tadi ditekan: warna, ikon,
 * dan lencana jenisnya tidak berubah, yang bertambah hanya isinya.
 *
 * Harga yang tampil di sini adalah harga BELI dari distributor, lewat
 * `rincianHarga`, sumber yang sama dengan halaman penawaran, keranjang, dan
 * pesanan. Potongan promo berlaku untuk beli sekali; barang yang terikat
 * kontrak tetap memakai harga kontrak.
 */

/** Stok di bawah angka ini disebut "hampir habis" di promo cuci gudang. */
const STOK_HAMPIR_HABIS = 60

/* ================================================================== */
/* Sorotan di kepala promo                                            */
/* ================================================================== */

function Sorotan({ promo, jumlahBarang, sisaHari }: { promo: Promo; jumlahBarang: number; sisaHari: number | null }) {
  let besar: string
  let kecil: string
  if (promo.jenis === 'cuci-gudang') {
    if (sisaHari == null) {
      besar = 'Selagi ada'
      kecil = 'Berakhir saat stoknya habis'
    } else if (sisaHari <= 0) {
      besar = 'Hari ini'
      kecil = 'Hari terakhir promo'
    } else {
      besar = `${sisaHari} hari`
      kecil = `lagi, sampai ${tanggalPanjang(promo.berakhir!)}`
    }
  } else if (promo.jenis === 'produk-baru') {
    besar = `${jumlahBarang} barang`
    kecil = 'baru masuk gudang'
  } else {
    besar = promo.potonganPersen ? `Hemat ${persen(promo.potonganPersen)}` : `${promo.tingkat?.length ?? 0} tingkat`
    kecil = promo.potonganPersen ? 'untuk semua anggota' : 'keuntungan keanggotaan'
  }
  return (
    <div className="rounded-md bg-surface text-ink px-4 py-3 text-center lg:min-w-[11rem]">
      <p className="text-[1.5rem] font-extrabold leading-tight tracking-tight">{besar}</p>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-snug">{kecil}</p>
    </div>
  )
}

/* ================================================================== */
/* Tiga bentuk kartu barang                                           */
/* ================================================================== */

function StokTeks({ p, tegas }: { p: Penawaran; tegas?: boolean }) {
  if (p.stokTersedia <= 0) {
    return (
      <Lencana nada="kritis" ikon={<IkonSilang size={12} />}>
        Stok distributor kosong
      </Lencana>
    )
  }
  const hampirHabis = tegas && p.stokTersedia < STOK_HAMPIR_HABIS
  return (
    <span className={cx('text-[0.8125rem]', tegas ? 'font-semibold text-ink' : 'text-ink-3')}>
      Sisa {jumlahSatuan(p.stokTersedia, p.satuan)}
      {hampirHabis && (
        <Lencana nada="menipis" className="ml-2 align-middle">
          Hampir habis
        </Lencana>
      )}
    </span>
  )
}

/** Produk Baru: kartu tegak seperti etalase. */
function KartuEtalase({ p, rincian, warna }: { p: Penawaran; rincian: RincianHarga; warna?: string }) {
  return (
    <KartuTautan ke={`/penawaran/${p.id}`} className="h-full">
      <div className="flex h-full flex-col">
        <Avatar nama={p.nama} warna={warna} ukuran={56} />
        <p className="mt-3 text-[0.9375rem] font-bold text-ink leading-snug">{p.nama}</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug line-clamp-2">{p.keterangan}</p>
        <div className="mt-auto pt-3">
          {/* Angka yang sama persis dengan halaman penawaran dan keranjang. */}
          <HargaBeli rincian={rincian} satuan={p.satuan} />
          <div className="mt-1">
            <StokTeks p={p} />
          </div>
        </div>
      </div>
    </KartuTautan>
  )
}

/** Cuci Gudang dan Keanggotaan: kartu mendatar, harga di kanan. */
function KartuBaris({ p, rincian, stokTegas }: { p: Penawaran; rincian: RincianHarga; stokTegas?: boolean }) {
  return (
    <KartuTautan ke={`/penawaran/${p.id}`} className="h-full">
      <div className="flex items-start gap-3">
        <div className="min-w-0 grow">
          <p className="text-[0.9375rem] font-bold text-ink leading-snug">{p.nama}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">{p.keterangan}</p>
          <div className="mt-1.5">
            <StokTeks p={p} tegas={stokTegas} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <HargaBeli rincian={rincian} satuan={p.satuan} className="justify-end" />
        </div>
      </div>
    </KartuTautan>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

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
  const sisaHari = promo.berakhir ? Math.ceil((+new Date(promo.berakhir) - Date.now()) / 86_400_000) : null
  const penawaran = promo.penawaranIds
    .map((x) => penawaranById(x))
    .filter((p): p is Penawaran => p != null && p.aktif !== false)
  /* Cuci gudang: yang stoknya paling tipis lebih dulu, karena itu yang paling
     cepat hilang dari promo. */
  const urutan =
    promo.jenis === 'cuci-gudang' ? [...penawaran].sort((a, b) => a.stokTersedia - b.stokTersedia) : penawaran

  return (
    <div className="pb-6">
      <KepalaHalaman judul={promo.judul} keterangan={namaToko} kembaliKe="/beranda" />

      {/* Kepala promo: template dibaca dari jenis promo, nama toko dari datanya.
          Di layar lebar sorotannya berdiri di kanan, di HP turun ke bawah. */}
      <div
        className={cx(
          'mt-4 rounded-lg p-4 sm:p-5 lg:p-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center',
          template.latar,
          template.teks,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cx('shrink-0 size-10 rounded-md grid place-items-center', template.aksen)}>
              <template.Ikon size={20} />
            </span>
            <span className={cx('inline-flex items-center rounded-sm px-2.5 py-1 text-[0.8125rem] font-bold', template.aksen)}>
              {LABEL_PROMO[promo.jenis]}
            </span>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[1.0625rem] font-extrabold min-w-0">
            <IkonToko size={18} className="shrink-0" />
            <span className="truncate">{namaToko}</span>
          </p>

          <p className="mt-1.5 text-[0.875rem] leading-relaxed max-w-[70ch]">{promo.keterangan}</p>

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

        <Sorotan promo={promo} jumlahBarang={penawaran.length} sisaHari={sisaHari} />
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

      {/* Keanggotaan: keuntungan per tingkat, sebelum daftar barangnya. */}
      {promo.jenis === 'membership' && (
        <section aria-labelledby="judul-tingkat" className="mt-6">
          <JudulBagian
            id="judul-tingkat"
            judul="Keuntungan per tingkat"
            keterangan={
              promo.potonganPersen
                ? `Potongan ${persen(promo.potonganPersen)} berlaku untuk semua anggota. Tingkat yang lebih tinggi menambah keuntungan lain.`
                : 'Ditulis langsung oleh distributornya.'
            }
          />
          {promo.tingkat && promo.tingkat.length > 0 ? (
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
              {promo.tingkat.map((t, i) => (
                <li key={t.nama}>
                  <Kartu padat className="h-full">
                    <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Tingkat {i + 1}</p>
                    <p className="mt-0.5 text-[1.0625rem] font-extrabold text-ink">{t.nama}</p>
                    <p className="mt-1.5 text-[0.8125rem] text-ink-2 leading-snug">
                      <span className="text-ink-3">Syarat:</span> {t.syarat}
                    </p>
                    <p className="mt-1 text-[0.875rem] font-semibold text-ink leading-snug">{t.manfaat}</p>
                  </Kartu>
                </li>
              ))}
            </ol>
          ) : (
            <Kartu padat>
              <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                {namaToko} belum menuliskan tingkat keanggotaannya. Tanyakan langsung saat mendaftar.
              </p>
            </Kartu>
          )}
        </section>
      )}

      <section aria-labelledby="judul-barang-promo" className="mt-6">
        <JudulBagian
          id="judul-barang-promo"
          judul={promo.jenis === 'produk-baru' ? 'Barang yang baru masuk' : 'Barang yang ikut promo'}
          keterangan={
            promo.potonganPersen
              ? `Harga beli sekali dari ${namaToko}, sudah dipotong promo. Barang yang terikat kontrak tetap memakai harga kontrak.`
              : `Harga beli sekali dari ${namaToko}.`
          }
        />

        {urutan.length === 0 ? (
          <Kartu padat>
            <p className="text-[0.875rem] text-ink-3">Barang yang ikut promo ini belum dicantumkan distributor.</p>
          </Kartu>
        ) : promo.jenis === 'produk-baru' ? (
          <div className="grid gap-3 grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 [&>*]:min-w-0">
            {urutan.map((p) => (
              <KartuEtalase key={p.id} p={p} rincian={rincianHarga(p.id, null)} warna={distributor?.warna} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            {urutan.map((p) => (
              <KartuBaris
                key={p.id}
                p={p}
                rincian={rincianHarga(p.id, null)}
                stokTegas={promo.jenis === 'cuci-gudang'}
              />
            ))}
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
