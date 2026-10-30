import { Tombol, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { BarisButir, useDibacaDistributor, usePemberitahuanDistributor } from '@/components/domain/Pemberitahuan'
import { IkonLonceng } from '@/icons'
import { JUDUL } from '@/lib/label'

/**
 * Pemberitahuan portal distributor (revisi 23 Okt 2026): halaman penuh untuk
 * lonceng di HP dan "Lihat semua" di panel desktop.
 *
 * Isinya diturunkan dari data yang sudah dimuat, bukan daftar tersimpan: butir
 * hilang sendiri begitu keadaannya selesai (pesanan dijawab, kontrak disetujui,
 * promo diganti). Status dibacanya disimpan di peramban (revisi V5, Q120), dan
 * menandai dibaca tidak mengurangi yang perlu tindakan.
 */
export default function PemberitahuanDistributor() {
  const { daftar: butir, baca, bacaSemua } = useDibacaDistributor(usePemberitahuanDistributor())
  const perlu = butir.filter((b) => b.perluTindakan)
  const diketahui = butir.filter((b) => !b.perluTindakan)
  const belumDibaca = butir.filter((b) => b.dibaca === false).length

  const kelompok = [
    { kunci: 'perlu', judul: 'Perlu tindakan', isi: perlu },
    { kunci: 'diketahui', judul: 'Untuk diketahui', isi: diketahui },
  ].filter((k) => k.isi.length > 0)

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman
        judul={JUDUL.notifikasi}
        keterangan={perlu.length > 0 ? `${perlu.length} butuh tindakan` : 'Tidak ada yang menunggu tindakan'}
        kembaliKe="/distributor-portal"
        aksi={
          belumDibaca > 0 ? (
            <Tombol ragam="sunyi" ukuran="kecil" onClick={bacaSemua}>
              <span className="sm:hidden">Tandai dibaca</span>
              <span className="hidden sm:inline">Tandai semua sudah dibaca</span>
            </Tombol>
          ) : undefined
        }
      />

      <div className="mt-4 max-w-3xl">
        {kelompok.length === 0 ? (
          <KeadaanKosong
            ikon={<IkonLonceng size={26} />}
            judul="Belum ada pemberitahuan"
            pesan="Pesanan baru, pengajuan kontrak, kiriman yang terlambat, dan promo yang hampir berakhir muncul di sini."
            aksi={<TombolTautan ke="/distributor-portal/pesanan">Buka Pesanan Masuk</TombolTautan>}
          />
        ) : (
          <div className="space-y-6">
            {kelompok.map((k) => (
              <section key={k.kunci} aria-labelledby={`kelompok-${k.kunci}`}>
                <h2
                  id={`kelompok-${k.kunci}`}
                  className="text-kecil font-bold uppercase tracking-wide text-ink-3 mb-2"
                >
                  {k.judul}
                </h2>
                <ul className="space-y-2">
                  {k.isi.map((b) => (
                    <li key={b.kunci}>
                      <BarisButir butir={b} penuh onClick={() => baca(b.kunci)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
