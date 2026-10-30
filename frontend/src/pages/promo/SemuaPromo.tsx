import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KartuPromo } from '@/components/domain/KartuPromo'
import { HanyaPembacaLayar, Tombol, TombolTautan } from '@/components/ui/dasar'
import { BarisChip, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonBintang } from '@/icons'
import { LABEL_PROMO } from '@/lib/label'
import { promoMasihBerlaku } from '@/data/dummy'
import type { JenisPromo } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Semua promo yang masih berlaku (revisi V5, Q116), dibuka dari "Lihat semua"
 * di kartu promo Beranda. Kisi tiga kolom di desktop dan satu di HP, urut dari
 * yang paling cepat berakhir; promo tanpa tanggal berakhir di paling bawah.
 * Chip jenis promo menyaring lewat alamat (`?jenis=`), jadi tombol Kembali
 * peramban mengembalikan pilihan sebelumnya.
 */

const JENIS: JenisPromo[] = ['cuci-gudang', 'produk-baru', 'membership']

export default function SemuaPromo() {
  const promoStore = useAplikasi((s) => s.promo)
  const [params, setParams] = useSearchParams()
  const dariUrl = params.get('jenis')
  const aktif = JENIS.find((j) => j === dariUrl) ?? null

  const berlaku = useMemo(
    () =>
      promoStore
        .filter((p) => promoMasihBerlaku(p))
        .slice()
        .sort((a, b) => {
          if (a.berakhir == null) return b.berakhir == null ? 0 : 1
          if (b.berakhir == null) return -1
          return +new Date(a.berakhir) - +new Date(b.berakhir)
        }),
    [promoStore],
  )
  const tampil = aktif ? berlaku.filter((p) => p.jenis === aktif) : berlaku

  function pilih(j: JenisPromo | null) {
    const baru = new URLSearchParams(params)
    if (j) baru.set('jenis', j)
    else baru.delete('jenis')
    setParams(baru, { replace: true })
  }

  const jumlah = (j: JenisPromo | null) => (j ? berlaku.filter((p) => p.jenis === j).length : berlaku.length)

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman
        judul="Promo dari Distributor"
        keterangan={berlaku.length > 0 ? `${berlaku.length} promo masih berlaku` : 'Belum ada promo yang berlaku'}
        kembaliKe="/beranda"
        bawah={
          berlaku.length > 0 ? (
            <BarisChip className="pt-1 pb-3">
              {[null, ...JENIS].map((j) => (
                <Chip key={j ?? 'semua'} aktif={aktif === j} onClick={() => pilih(j)}>
                  {j ? LABEL_PROMO[j] : 'Semua'}
                  <span className="tabular font-bold">{jumlah(j)}</span>
                  <HanyaPembacaLayar>promo</HanyaPembacaLayar>
                </Chip>
              ))}
            </BarisChip>
          ) : undefined
        }
      />

      <section aria-labelledby="judul-daftar-promo" className="mt-4">
        <h2 id="judul-daftar-promo" className="sr-only">
          {aktif ? `Promo ${LABEL_PROMO[aktif]}` : 'Semua promo'}
        </h2>
        {tampil.length === 0 ? (
          <KeadaanKosong
            ikon={<IkonBintang size={26} />}
            judul={aktif ? `Belum ada promo ${LABEL_PROMO[aktif]}` : 'Belum ada promo yang berlaku'}
            pesan="Promo dari distributor langgananmu muncul di sini begitu dipasang."
            aksi={
              aktif ? (
                <Tombol onClick={() => pilih(null)}>Lihat Semua Promo</Tombol>
              ) : (
                <TombolTautan ke="/belanja">Cari Barang di Distributor</TombolTautan>
              )
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {tampil.map((p) => (
              <li key={p.id}>
                <KartuPromo promo={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
