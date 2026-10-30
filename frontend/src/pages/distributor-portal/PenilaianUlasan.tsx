import { useMemo } from 'react'
import { JudulBagian, Kartu, Metrik, Pemisah } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { IkonBintang, IkonBintangIsi } from '@/icons'
import { angka, bintang, tanggalPendek } from '@/lib/format'
import { umkmById } from '@/data/dummy'
import { useDistributorAktif, usePesananMasuk } from '@/store/aplikasi'
import { SUB_RATING } from './formProfil'

/**
 * Penilaian & Ulasan, halaman bawahan Akun distributor (revisi V4, Q94): angka
 * penilaian di kiri, ulasan pemilik usaha di kanan. Di halaman sendiri semua
 * ulasan ditampilkan; dulu profil hanya memuat lima yang terakhir.
 */
export default function PenilaianUlasan() {
  const distributor = useDistributorAktif()
  const pesananMasuk = usePesananMasuk()

  const ulasan = useMemo(
    () =>
      pesananMasuk
        .filter((p) => p.ulasan)
        .sort((a, b) => +new Date(b.ulasan!.waktu) - +new Date(a.ulasan!.waktu)),
    [pesananMasuk],
  )

  return (
    <div className="pb-8 lg:pb-0">
      <KepalaHalaman judul="Penilaian & Ulasan" keterangan={distributor.nama} kembaliKe="/distributor-portal/profil" />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-6 lg:space-y-0">
        {/* Angka penilaian */}
        <section aria-labelledby="judul-penilaian" className="lg:col-span-5">
          <JudulBagian id="judul-penilaian" judul="Penilaian dari pemilik usaha" />
          <Kartu>
            {/* Satuan ditaruh di baris bantuan, bukan di samping angka: di 360px
                satu kolom cuma kebagian ±90px. */}
            <div className="grid grid-cols-3 gap-3">
              <Metrik
                label="Rata-rata"
                nilai={distributor.rating == null ? '—' : bintang(distributor.rating)}
                bantuan="dari 5 bintang"
                nada="merek"
              />
              <Metrik
                label="Ulasan"
                nilai={angka(distributor.jumlahUlasan)}
                bantuan={`dari ${angka(distributor.jumlahUmkmPengulas)} pemilik usaha`}
              />
              <Metrik label="Selesai" nilai={angka(distributor.jumlahPesananSelesai)} bantuan="pesanan" />
            </div>

            {distributor.rating == null ? (
              <p className="mt-4 text-isi text-ink-2 leading-relaxed">
                Belum ada penilaian yang masuk. Angkanya muncul setelah pesanan pertama selesai dan pemiliknya menulis
                ulasan.
              </p>
            ) : (
              <>
                <Pemisah className="my-4" />
                <div className="space-y-3">
                  {SUB_RATING.map(({ kunci, nama }) => {
                    const nilai = distributor.subRating[kunci]
                    return (
                      <div key={kunci}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-isi text-ink-2 font-medium">{nama}</span>
                          <span className="text-isi font-bold text-ink tabular">{angka(nilai, 1)} dari 5</span>
                        </div>
                        {/* Bilahnya dekoratif: angkanya sudah tertulis di atas. */}
                        <div className="mt-1.5 h-2 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${(nilai / 5) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Kartu>
        </section>

        {/* Ulasan */}
        <section aria-labelledby="judul-ulasan" className="lg:col-span-7">
          <JudulBagian
            id="judul-ulasan"
            judul="Ulasan dari pemilik usaha"
            keterangan={ulasan.length > 0 ? `${angka(ulasan.length)} ulasan, yang terbaru paling atas.` : undefined}
          />
          <Kartu>
            {ulasan.length === 0 ? (
              <p className="text-isi text-ink-2 leading-relaxed">
                Belum ada pemilik usaha yang menulis penilaian. Ulasan bisa ditulis setelah pesanannya ditandai sudah
                sampai.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {ulasan.map((p) => {
                  const u = p.ulasan!
                  return (
                    <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                      {/* Dibiarkan membungkus: nama usaha bisa panjang, dan bintang
                          + angkanya tidak boleh ikut menyempit sampai melebarkan
                          kartu di layar 360px. */}
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="text-isi font-bold text-ink leading-snug min-w-0">
                          {umkmById(p.umkmId)?.nama ?? 'Pemilik usaha'}
                        </p>
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="flex items-center gap-0.5 text-menipis" aria-hidden="true">
                            {[1, 2, 3, 4, 5].map((i) =>
                              i <= u.rating ? <IkonBintangIsi key={i} size={13} /> : <IkonBintang key={i} size={13} />,
                            )}
                          </span>
                          <span className="text-isi font-bold text-ink">{bintang(u.rating)} dari 5</span>
                        </span>
                      </div>
                      {u.isi && (
                        <p className="mt-1 text-isi text-ink-2 leading-relaxed max-w-[60ch]">&ldquo;{u.isi}&rdquo;</p>
                      )}
                      <p className="mt-1 text-kecil text-ink-3">
                        {p.nomor} &middot; {tanggalPendek(u.waktu)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </Kartu>
        </section>
      </div>
    </div>
  )
}
