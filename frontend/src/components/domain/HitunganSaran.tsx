import type { Barang, Kemasan, RekomendasiPrediksi } from '@/lib/types'
import { BarisData } from '@/components/ui/dasar'
import { angka } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'

/**
 * Asal angka saran beli (revisi V3, Q70 dan Q79): perkiraan pemakaian bulan
 * depan dikurangi sisa stok, dibagi isi satu kemasan, lalu dibulatkan ke atas.
 * Hitungannya sama dengan `rekomendasiDari`, jadi angka di sini selalu sama
 * dengan angka di tombol keranjang, dan pemilik usaha bisa memeriksanya sendiri.
 *
 * Untuk stok yang cukup atau berlebih, hitungan yang sama tetap ditampilkan,
 * tanpa angka beli. Kalimat alasan otomatis dari data contoh sengaja tidak
 * dipakai: sebagian bukan hasil hitungan ("akhir pekan selalu 40% lebih ramai").
 */
export function HitunganSaran({
  barang,
  rekomendasi,
  kemasan,
  satuanBeli,
  ringkas = false,
}: {
  barang: Barang
  rekomendasi: RekomendasiPrediksi
  /**
   * Kemasan beli. Bawaannya kemasan terbesar barang itu, sama dengan saran
   * model; halaman distributor mengisinya dengan kemasan jual penawarannya.
   */
  kemasan?: Kemasan | null
  /** Nama satuan beli bila tidak ada kemasan (penawaran yang dijual per satuan). */
  satuanBeli?: string
  /** Tanpa baris pemakaian bulan ini, untuk kartu kecil. */
  ringkas?: boolean
}) {
  const perkiraan = rekomendasi.perkiraanBulanDepan
  const sisa = Math.max(0, barang.stok)
  const k = kemasan === undefined ? (barang.kemasan[barang.kemasan.length - 1] ?? null) : kemasan
  const isi = k?.isi ?? 1
  const kurang = perkiraan - barang.stok
  const beliMentah = kurang / isi
  const jumlahBeli = Math.max(1, Math.ceil(beliMentah))
  // Satu desimal cukup untuk menunjukkan pembulatannya: "4,5 dus".
  const beliSepersepuluh = Math.round(beliMentah * 10) / 10
  const namaBeli = k?.nama ?? satuanBeli

  return (
    <div>
      <dl>
        {!ringkas && <BarisData label="Terpakai bulan ini" nilai={jumlahTampil(barang, rekomendasi.pemakaianBulanIni)} />}
        <BarisData label="Perkiraan bulan depan" nilai={jumlahTampil(barang, perkiraan)} />
        <BarisData label="Sisa tercatat" nilai={<>&minus; {jumlahTampil(barang, sisa)}</>} />
      </dl>

      <div className="mt-1.5 pt-1.5 border-t border-line">
        {rekomendasi.arah === 'tambah' ? (
          <>
            <BarisData label="Kurang" nilai={jumlahTampil(barang, kurang)} tebal />
            {k && <BarisData label={`Isi 1 ${k.nama}`} nilai={jumlahTampil(barang, isi)} />}
            <div className="mt-2 rounded-md bg-brand-soft/60 px-3 py-2.5">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-isi font-semibold text-brand-soft-ink">Saran beli</span>
                <span className="text-subjudul font-extrabold text-ink tabular">
                  {namaBeli ? `${angka(jumlahBeli)} ${namaBeli}` : jumlahTampil(barang, jumlahBeli)}
                </span>
              </p>
              {k && beliSepersepuluh !== jumlahBeli && (
                <p className="mt-0.5 text-kecil text-ink-2">
                  {angka(beliSepersepuluh, 1)} {k.nama}, dibulatkan ke atas.
                </p>
              )}
            </div>
          </>
        ) : rekomendasi.arah === 'kurang' ? (
          <>
            <BarisData label="Lebih dari perkiraan" nilai={jumlahTampil(barang, sisa - perkiraan)} tebal />
            <p className="mt-1.5 text-isi text-ink-2 leading-snug">
              Stok sudah berlebih, jadi <strong className="text-ink">tidak ada saran beli</strong>.
            </p>
          </>
        ) : (
          <p className="pt-1 text-isi text-ink-2 leading-snug">
            Sisa menutup <strong className="text-ink tabular">{angka(Math.min(100, (sisa / Math.max(perkiraan, 1e-9)) * 100))}%</strong>{' '}
            perkiraan bulan depan, jadi <strong className="text-ink">belum ada saran beli</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
