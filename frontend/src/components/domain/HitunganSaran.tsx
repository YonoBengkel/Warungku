import type { Barang, Kemasan, RekomendasiPrediksi } from '@/lib/types'
import { BarisData } from '@/components/ui/dasar'
import { HARI_PERSEDIAAN, kekuranganStok } from '@/data/dummy'
import { angka } from '@/lib/format'
import { jumlahTampil, satuanTampil } from '@/lib/satuan'

/**
 * Banyak kemasan beli yang menutup kekurangan: `kekuranganStok` ÷ isi kemasan,
 * dibulatkan ke atas, paling sedikit 1. Rumus `rekomendasiDari`, dipakai juga untuk
 * kemasan jual distributor supaya kartu hitungan dan jumlah awal Beli Sekali tidak
 * pernah berbeda angka.
 */
export function jumlahBeliUntuk(barang: Barang, rekomendasi: RekomendasiPrediksi, isiKemasan: number): number {
  return Math.max(1, Math.ceil(kekuranganStok(barang, rekomendasi.kebutuhanPersediaan) / isiKemasan))
}

/**
 * Asal angka saran beli (revisi V3, Q70 dan Q79, aturannya sejak 4 Nov 2026 sama
 * dengan simulasi laporan): perkiraan pemakaian 21 hari ditambah batas aman, dikurangi
 * sisa stok dan yang sudah dipesan, dibagi isi satu kemasan, lalu dibulatkan ke atas.
 * Hitungannya sama dengan `rekomendasiDari`, jadi angka di sini selalu sama dengan
 * angka di tombol keranjang, dan pemilik usaha bisa memeriksanya sendiri.
 *
 * Untuk stok yang cukup atau berlebih, angka pembandingnya tetap ditampilkan, tanpa
 * angka beli. Kalimat alasan otomatis dari data contoh sengaja tidak dipakai: sebagian
 * bukan hasil hitungan ("akhir pekan selalu 40% lebih ramai").
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
  const dipesan = barang.dalamPerjalanan ?? 0
  const kurang = kekuranganStok(barang, rekomendasi.kebutuhanPersediaan)
  const tambah = rekomendasi.arah === 'tambah'
  const beliMentah = kurang / isi
  const jumlahBeli = jumlahBeliUntuk(barang, rekomendasi, isi)
  // Satu desimal cukup untuk menunjukkan pembulatannya: "4,5 dus".
  const beliSepersepuluh = Math.round(beliMentah * 10) / 10
  const namaBeli = k?.nama ?? satuanBeli

  return (
    <div>
      <div>
        {!ringkas && <BarisData label="Terpakai bulan ini" nilai={jumlahTampil(barang, rekomendasi.pemakaianBulanIni)} />}
        {tambah ? (
          <BarisData
            label={`Perkiraan ${HARI_PERSEDIAAN} hari ke depan`}
            nilai={jumlahTampil(barang, rekomendasi.kebutuhanPersediaan)}
          />
        ) : (
          <BarisData label="Perkiraan bulan depan" nilai={jumlahTampil(barang, perkiraan)} />
        )}
        {rekomendasi.arah !== 'kurang' && (
          <BarisData label="Batas aman" nilai={<>{tambah && '+ '}{jumlahTampil(barang, barang.batasAman)}</>} />
        )}
        <BarisData
          label="Sisa tercatat"
          nilai={<>{rekomendasi.arah !== 'tetap' && <>&minus; </>}{jumlahTampil(barang, sisa)}</>}
        />
        {rekomendasi.arah !== 'kurang' && dipesan > 0 && (
          <BarisData label="Sudah dipesan" nilai={<>{tambah && <>&minus; </>}{jumlahTampil(barang, dipesan)}</>} />
        )}
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-line">
        {tambah ? (
          <>
            <BarisData label="Kurang" nilai={jumlahTampil(barang, kurang)} tebal />
            {/* "Isi 1 kg: 1 kg" tidak menjelaskan apa-apa, jadi baris isi hanya
                untuk kemasan yang berbeda dari satuan tampil barangnya. */}
            {k && k.nama !== satuanTampil(barang).nama && (
              <BarisData label={`Isi 1 ${k.nama}`} nilai={jumlahTampil(barang, isi)} />
            )}
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
            {sisa < barang.batasAman
              ? 'Sisa sudah di bawah batas aman, tetapi pesanan yang belum diterima menutupinya, jadi '
              : 'Sisa masih di atas batas aman, jadi '}
            <strong className="text-ink">belum ada saran beli</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
