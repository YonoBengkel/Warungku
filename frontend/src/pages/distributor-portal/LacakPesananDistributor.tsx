import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TampilanLacak, useSekarang, type BarisLacak } from '@/components/domain/Lacak'
import { Lencana, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonPasokan, IkonSinkron } from '@/icons'
import { umkmById } from '@/data/dummy'
import { cx } from '@/lib/format'
import { LABEL_PESANAN_MASUK, NADA_PESANAN_MASUK } from '@/lib/label'
import { koordinatSah, posisiKiriman, pusatKota, titikGudang, waktuBerangkat } from '@/lib/lacak'
import { useAplikasi, useDistributorAktif, usePesananMasuk } from '@/store/aplikasi'

/**
 * Lacak Pesanan sisi distributor (revisi 23 Okt 2026): pesanan yang sedang
 * disiapkan atau sudah di jalan, dari gudang ini ke tiap tempat usaha
 * pemesan. Pesanan yang belum diterima tidak dilacak; jumlahnya disebut di atas
 * daftar dengan tautan ke Pesanan Masuk.
 */
export default function LacakPesananDistributor() {
  const pesananMasuk = usePesananMasuk()
  const distributor = useDistributorAktif()
  const tersambung = useAplikasi((s) => s.sesiDistributor != null)
  const muatPesananMasuk = useAplikasi((s) => s.muatPesananMasuk)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [params, setParams] = useSearchParams()
  const [memeriksa, setMemeriksa] = useState(false)
  const sekarang = useSekarang()
  const terpilih = params.get('pesanan')

  const menunggu = pesananMasuk.filter((p) => p.status === 'menunggu-konfirmasi').length

  const baris = useMemo<BarisLacak[]>(() => {
    const gudang = titikGudang(distributor)
    return pesananMasuk
      .filter((p) => p.status === 'disiapkan' || p.status === 'dikirim')
      .sort(
        (a, b) =>
          (a.status === 'dikirim' ? 0 : 1) - (b.status === 'dikirim' ? 0 : 1) ||
          +new Date(a.perkiraanTiba ?? a.dibuatPada) - +new Date(b.perkiraanTiba ?? b.dibuatPada),
      )
      .map((p) => {
        const u = umkmById(p.umkmId)
        const nama = u?.nama ?? 'Pemilik usaha'
        const tujuan = u && koordinatSah(u.lat, u.lng) ? { lat: u.lat, lng: u.lng } : pusatKota(u?.kota)
        const posisi =
          p.status === 'dikirim' ? posisiKiriman(gudang, tujuan, waktuBerangkat(p.jejak), p.perkiraanTiba, sekarang) : null
        return {
          id: p.id,
          nomor: p.nomor,
          nama,
          status: <Lencana nada={NADA_PESANAN_MASUK[p.status]}>{LABEL_PESANAN_MASUK[p.status]}</Lencana>,
          ke: `/distributor-portal/pesanan/${p.id}`,
          gudang: { ...gudang, kunci: 'gudang-saya', judul: `Gudang ${distributor.nama}`, kota: distributor.kota },
          tujuan: { ...tujuan, kunci: `tujuan-${p.umkmId}`, judul: nama },
          posisi,
          perkiraanTiba: p.perkiraanTiba,
          kiriman: p.kiriman ?? null,
          kunciPeta: posisi ? p.id : `tujuan-${p.umkmId}`,
          catatan: p.status === 'disiapkan' ? 'Masih di gudangmu. Tandai dikirim di rinciannya saat barang berangkat.' : undefined,
        }
      })
  }, [pesananMasuk, distributor, sekarang])

  const diJalan = baris.filter((b) => b.posisi).length

  function pilih(id: string | null) {
    const baru = new URLSearchParams(params)
    if (id) baru.set('pesanan', id)
    else baru.delete('pesanan')
    setParams(baru, { replace: true })
  }

  async function periksa() {
    if (!tersambung) {
      tampilkanRacun('Portal ini memakai data contoh, jadi tidak ada kabar baru.', 'info')
      return
    }
    setMemeriksa(true)
    await muatPesananMasuk()
    setMemeriksa(false)
    tampilkanRacun('Daftar kiriman diperbarui.', 'aman')
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Lacak Pesanan"
        keterangan={
          baris.length === 0 ? 'Tidak ada kiriman yang dilacak' : `${baris.length} pesanan dilacak, ${diJalan} sedang di jalan`
        }
        kembaliKe="/distributor-portal/pesanan"
        aksi={
          <TombolIkon label="Periksa kabar terbaru" disabled={memeriksa} onClick={periksa}>
            <IkonSinkron size={20} className={cx(memeriksa && 'animate-spin')} />
          </TombolIkon>
        }
      />

      {menunggu > 0 && (
        <p className="mt-3 text-isi text-ink-2">
          {menunggu} pesanan masih menunggu kamu terima dan belum dilacak.{' '}
          <Link
            to="/distributor-portal/pesanan?tahap=menunggu-konfirmasi"
            className="inline-flex items-center min-h-11 font-bold text-brand hover:underline"
          >
            Buka pesanan menunggu
          </Link>
        </p>
      )}

      {baris.length === 0 ? (
        <section aria-labelledby="judul-lacak-kosong" className="mt-4">
          <h2 id="judul-lacak-kosong" className="sr-only">
            Tidak ada yang dilacak
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Belum ada kiriman yang dilacak"
            pesan="Pesanan muncul di sini sejak kamu terima dan siapkan, sampai kamu tandai sudah sampai."
            aksi={<TombolTautan ke="/distributor-portal/pesanan">Buka Pesanan Masuk</TombolTautan>}
          />
        </section>
      ) : (
        <TampilanLacak
          baris={baris}
          terpilih={terpilih}
          pilih={pilih}
          labelPeta="Peta kiriman: gudangmu, tempat usaha pemesan, dan kiriman di jalan"
        />
      )}
    </div>
  )
}
