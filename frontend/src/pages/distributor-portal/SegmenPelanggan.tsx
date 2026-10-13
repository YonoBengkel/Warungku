import { useEffect, useMemo, useState } from 'react'
import { JudulBagian, Kartu, Lencana } from '@/components/ui/dasar'
import { KartuSambungDistributor, TombolPutusDistributor } from '@/components/domain/SambungDistributor'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonProfil } from '@/icons'
import { angka, cx, rupiah, rupiahRingkas, tanggalRingkas, waktuLalu } from '@/lib/format'
import { GalatApi, ambilAnggotaSegmen, ambilSegmen } from '@/lib/api'
import { useAplikasi } from '@/store/aplikasi'
import type { AnggotaSegmen, RingkasanSegmen, SesiDistributor } from '@/lib/api'
import { LABEL_JENIS_USAHA } from '@/lib/label'
import type { JenisUsaha } from '@/lib/types'

/**
 * Pelanggan: segmen pelanggan distributor dari Mesin 3 (K-Prototypes).
 *
 * Halaman ini hanya punya data server. Tidak ada segmen contoh, karena segmen
 * karangan akan terlihat seperti hasil analisis padahal bukan. Selama portal
 * distributor belum punya login sendiri, halaman ini menyambung ke server
 * dengan akun distributor, terpisah dari sesi pemilik usaha.
 */

const NADA_SEGMEN: Record<string, 'aman' | 'info' | 'menipis' | 'netral' | 'merek'> = {
  andalan: 'aman',
  rutin: 'info',
  baru: 'merek',
  jarang: 'menipis',
}

export default function SegmenPelanggan() {
  const sesi = useAplikasi((s) => s.sesiDistributor)
  const putus = useAplikasi((s) => s.putusDistributor)
  const [segmen, setSegmen] = useState<RingkasanSegmen[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [terpilih, setTerpilih] = useState<string | null>(null)

  useEffect(() => {
    if (!sesi) return
    let batal = false
    setGalat(null)
    ambilSegmen(sesi)
      .then((s) => {
        if (batal) return
        setSegmen(s)
        setTerpilih((t) => t ?? s[0]?.segmen ?? null)
      })
      .catch((e: unknown) => {
        if (batal) return
        if (e instanceof GalatApi && e.status === 401) {
          // Token hangus (server dimuat ulang): minta sambung ulang.
          putus()
          return
        }
        setGalat(e instanceof Error ? e.message : 'Segmen gagal dimuat.')
      })
    return () => {
      batal = true
    }
  }, [sesi, putus])

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Pelanggan</h1>
          <p className="mt-1 text-[0.8125rem] text-ink-3 leading-snug max-w-[70ch]">
            Pelanggan kamu dikelompokkan menurut kapan terakhir memesan, seberapa sering, dan seberapa besar belanjanya.
            Dipakai untuk memutuskan siapa yang perlu ditawari kontrak dan siapa yang perlu dihubungi.
          </p>
        </div>
        {sesi && <TombolPutusDistributor />}
      </div>

      {!sesi ? (
        <KartuSambungDistributor
          className="mt-4 max-w-[32rem]"
          keterangan="Segmen pelanggan dihitung mesin analitik dari pesanan sungguhan, jadi halaman ini perlu data server."
        />
      ) : galat ? (
        <Peringatan nada="kritis" className="mt-4" judul="Segmen pelanggan gagal dimuat">
          {galat}
        </Peringatan>
      ) : segmen === null ? (
        <Kartu className="mt-4" aria-busy="true">
          <p className="text-[0.875rem] text-ink-3">Mengambil segmen pelanggan dari server&hellip;</p>
        </Kartu>
      ) : segmen.length === 0 ? (
        <KeadaanKosong
          ikon={<IkonProfil size={26} />}
          judul="Segmen belum dihitung"
          pesan="Mesin analitik belum mengelompokkan pelanggan kamu. Segmen dihitung ulang otomatis setiap empat jam."
        />
      ) : (
        <>
          <p className="mt-3 text-[0.75rem] text-ink-3">
            Dihitung {waktuLalu(segmen[0].dijalankanPada)}, dari pesanan sampai {tanggalRingkas(segmen[0].tanggalAcuan)}{' '}
            &middot; {angka(segmen.reduce((t, s) => t + s.jumlah, 0))} pelanggan.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Segmen pelanggan">
            {segmen.map((s) => (
              <li key={s.segmen}>
                <button
                  type="button"
                  onClick={() => setTerpilih(s.segmen)}
                  aria-pressed={terpilih === s.segmen}
                  className={cx(
                    'w-full h-full text-left rounded-lg border bg-surface p-4 transition-colors min-h-11',
                    terpilih === s.segmen ? 'border-brand ring-2 ring-[var(--c-brand-ring)]' : 'border-line hover:border-line-strong',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.9375rem] font-bold text-ink leading-snug">{s.namaSegmen}</p>
                    <Lencana nada={NADA_SEGMEN[s.segmen] ?? 'netral'}>{angka(s.jumlah)} toko</Lencana>
                  </div>
                  {s.ciri && <p className="mt-1 text-[0.8125rem] text-ink-2 leading-snug">{s.ciri}</p>}
                  <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[0.75rem]">
                    <div>
                      <dt className="text-ink-3">Terakhir pesan</dt>
                      <dd className="font-bold text-ink">{angka(s.rataRecency)} hari lalu</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Pesanan</dt>
                      <dd className="font-bold text-ink">{angka(s.rataFrequency)} kali</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Belanja</dt>
                      <dd className="font-bold text-ink">{rupiahRingkas(s.rataMonetary)}</dd>
                    </div>
                  </dl>
                  {s.saran && (
                    <p className="mt-2.5 pt-2.5 border-t border-line text-[0.8125rem] text-ink-2 leading-snug">
                      <span className="font-bold text-ink">Saran: </span>
                      {s.saran}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.75rem] text-ink-3">Angka di kartu adalah rata-rata anggota segmen.</p>

          {terpilih && sesi && (
            <DaftarAnggota
              sesi={sesi}
              segmen={terpilih}
              nama={segmen.find((s) => s.segmen === terpilih)?.namaSegmen ?? terpilih}
            />
          )}
        </>
      )}
    </div>
  )
}

/* ================================================================== */

/* ================================================================== */

/**
 * Anggota satu segmen. Pelanggan yang jauh dari pusat segmennya ditandai:
 * ia masuk ke segmen ini karena paling dekat, bukan karena benar-benar mirip,
 * dan layar tidak boleh terdengar lebih yakin daripada itu.
 */
function DaftarAnggota({ sesi, segmen, nama }: { sesi: SesiDistributor; segmen: string; nama: string }) {
  const [anggota, setAnggota] = useState<{ segmen: string; isi: AnggotaSegmen[] } | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    setGalat(null)
    ambilAnggotaSegmen(sesi, segmen)
      .then((isi) => !batal && setAnggota({ segmen, isi }))
      .catch((e: unknown) => !batal && setGalat(e instanceof Error ? e.message : 'Anggota gagal dimuat.'))
    return () => {
      batal = true
    }
  }, [sesi, segmen])

  const ambangJauh = useMemo(() => {
    if (!anggota || anggota.isi.length < 4) return Infinity
    const urut = anggota.isi.map((a) => a.jarakKePusat).sort((a, b) => a - b)
    return urut[Math.floor(urut.length / 2)] * 2
  }, [anggota])

  return (
    <section aria-labelledby="judul-anggota" className="mt-6">
      <JudulBagian id="judul-anggota" judul={nama} keterangan="Diurutkan dari belanja terbesar." />
      {galat ? (
        <Peringatan nada="kritis" judul="Anggota segmen gagal dimuat">
          {galat}
        </Peringatan>
      ) : !anggota || anggota.segmen !== segmen ? (
        <p className="text-[0.875rem] text-ink-3">Memuat anggota&hellip;</p>
      ) : (
        <Kartu className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <caption className="sr-only">Anggota segmen {nama}</caption>
              <thead className="bg-surface-2 text-ink-3 text-left">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Toko</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold whitespace-nowrap">Terakhir pesan</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Pesanan</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">Total belanja</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Kategori utama</th>
                </tr>
              </thead>
              <tbody>
                {anggota.isi.map((a) => (
                  <tr key={a.usahaId} className="border-t border-line align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-ink">{a.namaUsaha}</p>
                      <p className="text-ink-3">
                        {a.kota} &middot; {LABEL_JENIS_USAHA[a.jenisUsaha as JenisUsaha]?.judul ?? a.jenisUsaha} &middot; langganan {angka(a.lamaBerlangganan)} hari
                      </p>
                      {a.jarakKePusat > ambangJauh && (
                        <p className="mt-0.5 text-[0.75rem] text-menipis-ink">Kurang mirip anggota lain di segmen ini</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{angka(a.recency)} hari lalu</td>
                    <td className="px-3 py-2.5 text-right">{angka(a.frequency)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{rupiah(a.monetary)}</td>
                    <td className="px-4 py-2.5">{a.kategoriUtama}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kartu>
      )}
    </section>
  )
}
