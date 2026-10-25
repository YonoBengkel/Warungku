import { useMemo, useState } from 'react'
import { ChipPesanan } from '@/components/domain'
import { DaftarLacak, langkahLacak, useSekarang, type BarisLacak } from '@/components/domain/Lacak'
import { TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonPasokan, IkonSinkron } from '@/icons'
import { ID_UMKM_SENDIRI, distributorById, umkmById } from '@/data/dummy'
import { angka, cx } from '@/lib/format'
import { posisiKiriman, pusatKota, titikGudang, waktuBerangkat } from '@/lib/lacak'
import type { StatusPesanan } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Lacak Pesanan sisi pemilik usaha: pesanan yang belum selesai, dari menunggu
 * jawaban sampai sudah di jalan. Sejak revisi V3 (Q75) berupa satu daftar
 * dengan garis empat status per pesanan; peta pindah ke rincian tiap pesanan.
 */

const DILACAK: StatusPesanan[] = ['dikirim', 'disiapkan', 'menunggu-konfirmasi']

export default function LacakPesanan() {
  const pesanan = useAplikasi((s) => s.pesanan)
  const daftarDistributor = useAplikasi((s) => s.distributor)
  const profil = useAplikasi((s) => s.profil)
  const sumberData = useAplikasi((s) => s.sumberData)
  const periksaKabarPesanan = useAplikasi((s) => s.periksaKabarPesanan)
  const [memeriksa, setMemeriksa] = useState(false)
  const sekarang = useSekarang()

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
        const sudahSampai = p.status === 'dikirim' && Boolean(p.pengiriman)
        const posisi =
          p.status === 'dikirim' && !p.pengiriman
            ? posisiKiriman(
                titikGudang(d ?? { kota: profil.kota }),
                p.tujuan ?? tujuanSaya,
                waktuBerangkat(p.jejak),
                p.perkiraanTiba,
                sekarang,
              )
            : null
        const utama = p.baris[0]
        const lain = p.baris.length - 1
        return {
          id: p.id,
          nomor: p.nomor,
          nama: d?.nama ?? 'Distributor',
          warna: d?.warna,
          status: <ChipPesanan status={p.status} />,
          ke: `/pesanan/${p.id}`,
          ringkas: utama
            ? `${utama.nama} ${angka(utama.jumlah)} ${utama.satuan}${lain > 0 ? ` + ${lain} barang lain` : ''}`
            : undefined,
          langkah: langkahLacak(p.jejak, p.status),
          posisi: posisi && { kemajuan: posisi.kemajuan, lewat: posisi.lewat },
          sudahSampai,
          perkiraanTiba: p.perkiraanTiba,
          aksi: sudahSampai ? { label: 'Hitung Barang', ke: `/pesanan/${p.id}/terima` } : undefined,
        }
      })
  }, [pesanan, daftarDistributor, profil.kota, sumberData, sekarang])

  const diJalan = baris.filter((b) => b.posisi).length

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
        <DaftarLacak baris={baris} judul="Daftar pesanan yang dilacak" />
      )}
    </div>
  )
}
