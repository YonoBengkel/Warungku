import { useEffect, useMemo, useState } from 'react'
import { JudulBagian, Kartu, Lencana, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { RUANG_LONCENG } from '@/components/ui/navigasi'
import { IkonProfil } from '@/icons'
import { angka, cx, rupiah, rupiahRingkas, tanggalRingkas, waktuLalu } from '@/lib/format'
import { GalatApi, ambilAnggotaSegmen, ambilSegmen } from '@/lib/api'
import { useAplikasi } from '@/store/aplikasi'
import { LabelMetode, METODE_SEGMEN } from '@/components/domain/LabelMetode'
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

/**
 * Tempat menjalankan saran tiap segmen (saran ditulis Mesin 3,
 * ml/mesin3/segmentasi.py). "Mulai menjauh" sengaja tanpa tombol: sarannya
 * menghubungi pemilik usaha, dan nomor HP baru terbuka untuk distributor
 * lewat pesanan. "Kecil" juga tanpa tombol, karena sarannya membiarkan.
 */
const TINDAKAN_SEGMEN: Record<string, { label: string; ke: string } | undefined> = {
  andalan: { label: 'Atur Paket Kontrak', ke: '/distributor-portal/kontrak?tab=paket' },
  rutin: { label: 'Atur Paket Kontrak', ke: '/distributor-portal/kontrak?tab=paket' },
  sedang: { label: 'Buat Promo', ke: '/distributor-portal/promo' },
  baru: { label: 'Lihat Pesanan Disiapkan', ke: '/distributor-portal/pesanan?tahap=disiapkan' },
}

/** Recency dibulatkan ke hari: 0 hari dibaca "hari ini", bukan "0 hari lalu". */
function hariLalu(hari: number): string {
  const h = Math.round(hari)
  return h <= 0 ? 'hari ini' : h === 1 ? 'kemarin' : `${angka(h)} hari lalu`
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
    <div className="pb-6 lg:pb-0">
      {/* Label metode di kanan judul (revisi V2, Q42); cara mengelompokkan
          dijelaskan di gelembungnya. Di layar sempit ia turun ke bawah judul. */}
      <div data-sejajar-lonceng className={cx('flex items-center justify-between gap-x-3 gap-y-2 flex-wrap', RUANG_LONCENG)}>
        <h1 className="text-judul font-extrabold text-ink tracking-tight">Pelanggan</h1>
        <LabelMetode {...METODE_SEGMEN} />
      </div>
      <p className="mt-1 text-isi text-ink-2 leading-relaxed max-w-[62ch]">
        Dipakai untuk memutuskan siapa ditawari kontrak dan siapa perlu dihubungi.
      </p>

      {!sesi ? (
        <Peringatan nada="netral" className="mt-4 max-w-[32rem]" judul="Perlu masuk sebagai distributor">
          Segmen pelanggan dihitung dari pesanan sungguhan di akun distributormu.
          <div className="mt-2.5">
            <TombolTautan ke="/masuk/distributor" ukuran="kecil">
              Masuk sebagai distributor
            </TombolTautan>
          </div>
        </Peringatan>
      ) : galat ? (
        <Peringatan nada="kritis" className="mt-4" judul="Segmen pelanggan gagal dimuat">
          {galat}
        </Peringatan>
      ) : segmen === null ? (
        <Kartu className="mt-4" aria-busy="true">
          <p className="text-isi text-ink-3">Memuat segmen pelanggan&hellip;</p>
        </Kartu>
      ) : segmen.length === 0 ? (
        <KeadaanKosong
          ikon={<IkonProfil size={26} />}
          judul="Segmen belum dihitung"
          pesan="Pelanggan kamu belum dikelompokkan. Kelompoknya dihitung ulang otomatis setiap empat jam."
        />
      ) : (
        <>
          <p className="mt-3 text-kecil text-ink-3">
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
                    <p className="text-kartu font-bold text-ink leading-snug">{s.namaSegmen}</p>
                    <Lencana nada={NADA_SEGMEN[s.segmen] ?? 'netral'}>{angka(s.jumlah)} toko</Lencana>
                  </div>
                  {s.ciri && <p className="mt-1 text-isi text-ink-2 leading-snug">{s.ciri}</p>}
                  <dl className="mt-2.5 grid grid-cols-3 gap-2 text-kecil">
                    <div>
                      <dt className="text-ink-3">Terakhir pesan</dt>
                      <dd className="font-bold text-ink">{hariLalu(s.rataRecency)}</dd>
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
                    <p className="mt-2.5 pt-2.5 border-t border-line text-isi text-ink-2 leading-snug">
                      <span className="font-bold text-ink">Saran: </span>
                      {s.saran}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-kecil text-ink-3">Angka di kartu adalah rata-rata anggota segmen.</p>

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
      <JudulBagian
        id="judul-anggota"
        judul={nama}
        keterangan="Diurutkan dari belanja terbesar."
        aksi={
          TINDAKAN_SEGMEN[segmen] && (
            <TombolTautan ke={TINDAKAN_SEGMEN[segmen].ke} ragam="garis" ukuran="kecil">
              {TINDAKAN_SEGMEN[segmen].label}
            </TombolTautan>
          )
        }
      />
      {galat ? (
        <Peringatan nada="kritis" judul="Anggota segmen gagal dimuat">
          {galat}
        </Peringatan>
      ) : !anggota || anggota.segmen !== segmen ? (
        <p className="text-isi text-ink-3">Memuat anggota&hellip;</p>
      ) : (
        <Kartu className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-isi">
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
                        <p className="mt-0.5 text-kecil text-menipis-ink">Kurang mirip anggota lain di segmen ini</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{hariLalu(a.recency)}</td>
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
