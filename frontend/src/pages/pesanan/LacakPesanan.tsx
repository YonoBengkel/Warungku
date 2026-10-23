import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChipPesanan } from '@/components/domain'
import { TampilanLacak, useSekarang, type BarisLacak } from '@/components/domain/Lacak'
import { TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonPasokan, IkonSinkron } from '@/icons'
import { ID_UMKM_SENDIRI, distributorById, umkmById } from '@/data/dummy'
import { cx } from '@/lib/format'
import { posisiKiriman, pusatKota, titikGudang, waktuBerangkat } from '@/lib/lacak'
import type { StatusPesanan } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Lacak Pesanan sisi pemilik usaha (revisi 23 Okt 2026): pesanan yang belum
 * selesai, dari menunggu jawaban sampai sudah di jalan, dalam daftar dan peta.
 * Tujuannya selalu tempat usaha ini sendiri; asalnya gudang tiap distributor.
 */

const DILACAK: StatusPesanan[] = ['dikirim', 'disiapkan', 'menunggu-konfirmasi']

export default function LacakPesanan() {
  const pesanan = useAplikasi((s) => s.pesanan)
  const daftarDistributor = useAplikasi((s) => s.distributor)
  const profil = useAplikasi((s) => s.profil)
  const sumberData = useAplikasi((s) => s.sumberData)
  const periksaKabarPesanan = useAplikasi((s) => s.periksaKabarPesanan)
  const [params, setParams] = useSearchParams()
  const [memeriksa, setMemeriksa] = useState(false)
  const sekarang = useSekarang()
  const terpilih = params.get('pesanan')

  const baris = useMemo<BarisLacak[]>(() => {
    const aktif = pesanan.filter((p) => DILACAK.includes(p.status))
    // Semua pesanan menuju tempat yang sama; koordinatnya dibawa pesanan dari
    // server. Data contoh memakai titik usaha contoh yang juga dilihat portal distributor.
    const contoh = sumberData !== 'server' ? umkmById(ID_UMKM_SENDIRI) : undefined
    const tujuanSaya =
      aktif.find((p) => p.tujuan)?.tujuan ?? (contoh ? { lat: contoh.lat, lng: contoh.lng } : pusatKota(profil.kota))
    const urut = (b: (typeof aktif)[number]) =>
      b.status === 'dikirim' ? (b.pengiriman ? 1 : 0) : b.status === 'disiapkan' ? 2 : 3
    return aktif
      .slice()
      .sort((a, b) => urut(a) - urut(b) || +new Date(a.perkiraanTiba ?? a.dibuatPada) - +new Date(b.perkiraanTiba ?? b.dibuatPada))
      .map((p) => {
        const d = daftarDistributor.find((x) => x.id === p.distributorId) ?? distributorById(p.distributorId)
        const nama = d?.nama ?? 'Distributor'
        const gudang = titikGudang(d ?? { kota: profil.kota })
        const tujuan = p.tujuan ?? tujuanSaya
        const diJalan = p.status === 'dikirim' && !p.pengiriman
        const posisi = diJalan ? posisiKiriman(gudang, tujuan, waktuBerangkat(p.jejak), p.perkiraanTiba, sekarang) : null
        return {
          id: p.id,
          nomor: p.nomor,
          nama,
          status: <ChipPesanan status={p.status} />,
          ke: `/pesanan/${p.id}`,
          gudang: { ...gudang, kunci: `gudang-${p.distributorId}`, judul: `Gudang ${nama}`, kota: d?.kota ?? profil.kota },
          tujuan: { ...tujuan, kunci: 'tujuan-saya', judul: profil.namaUsaha || 'Tempat usahamu' },
          posisi,
          perkiraanTiba: p.pengiriman ? null : p.perkiraanTiba,
          kiriman: p.kiriman ?? null,
          kunciPeta: posisi ? p.id : `gudang-${p.distributorId}`,
          catatan:
            p.status === 'dikirim' && p.pengiriman
              ? 'Distributor menandai barangnya sudah sampai. Hitung barangnya supaya stok gudang bertambah.'
              : p.status === 'menunggu-konfirmasi'
                ? 'Menunggu distributor menerima pesanan ini.'
                : p.status === 'disiapkan'
                  ? 'Barang sedang disiapkan di gudang distributor.'
                  : undefined,
          aksi: p.status === 'dikirim' && p.pengiriman ? { label: 'Hitung Barang', ke: `/pesanan/${p.id}/terima` } : undefined,
        }
      })
  }, [pesanan, daftarDistributor, profil.kota, profil.namaUsaha, sumberData, sekarang])

  const diJalan = baris.filter((b) => b.posisi).length

  function pilih(id: string | null) {
    const baru = new URLSearchParams(params)
    if (id) baru.set('pesanan', id)
    else baru.delete('pesanan')
    setParams(baru, { replace: true })
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Lacak Pesanan"
        keterangan={
          baris.length === 0 ? 'Tidak ada pesanan berjalan' : `${baris.length} pesanan berjalan, ${diJalan} sedang di jalan`
        }
        kembaliKe="/pesanan"
        aksi={
          <TombolIkon
            label="Periksa kabar terbaru"
            disabled={memeriksa}
            onClick={() => {
              setMemeriksa(true)
              periksaKabarPesanan().finally(() => setMemeriksa(false))
            }}
          >
            <IkonSinkron size={20} className={cx(memeriksa && 'animate-spin')} />
          </TombolIkon>
        }
      />

      {baris.length === 0 ? (
        <section aria-labelledby="judul-lacak-kosong" className="mt-4">
          <h2 id="judul-lacak-kosong" className="sr-only">
            Tidak ada yang dilacak
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Belum ada pesanan yang berjalan"
            pesan="Pesanan muncul di sini sejak dikirim ke distributor sampai barangnya kamu hitung."
            aksi={<TombolTautan ke="/belanja">Cari Barang di Distributor</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/pesanan" ragam="garis">
                Kembali ke Pesanan
              </TombolTautan>
            }
          />
        </section>
      ) : (
        <TampilanLacak
          baris={baris}
          terpilih={terpilih}
          pilih={pilih}
          labelPeta="Peta pesanan berjalan: gudang distributor, tempat usahamu, dan kiriman di jalan"
        />
      )}
    </div>
  )
}
