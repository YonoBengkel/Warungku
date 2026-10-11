import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { JudulBagian, Kartu, Lencana, TombolTautan, type NadaLencana } from '@/components/ui/dasar'
import { KartuTindakan } from '@/components/domain'
import {
  IkonCentangLingkaran,
  IkonGudang,
  IkonJam,
  IkonKirim,
  IkonLokasi,
  IkonPanahKanan,
  IkonSilang,
} from '@/icons'
import { cx, tanggalLengkapHari, waktuLalu } from '@/lib/format'
import {
  LABEL_PESANAN_MASUK,
  LABEL_TITIK,
  NADA_PESANAN_MASUK,
  TAHAP_PESANAN_MASUK,
  WARNA_TITIK_TOKEN,
} from '@/lib/label'
import { distributorAktif, umkmById } from '@/data/dummy'
import type { StatusPesananMasuk, WarnaTitik } from '@/lib/types'
import { useJumlahPerluKonfirmasi, usePesananMasuk, useTitikPeta } from '@/store/aplikasi'

/**
 * Halaman pertama portal distributor.
 *
 * Urutannya mengikuti satu pertanyaan: "apa yang harus aku kerjakan sekarang".
 * Karena itu sambutan dibuat pendek, lalu langsung satu kartu tindakan, baru
 * rekap angka. Rekap yang ditaruh di atas tindakan membuat orang membaca
 * laporan dulu padahal ada pesanan yang menunggu dijawab.
 *
 * Lonceng ber-badge sudah hidup di kepala KerangkaDistributor, jadi di sini ia
 * TIDAK diulang. Dua lonceng dengan angka yang sama membuat orang mengira ada
 * dua daftar yang berbeda.
 */

/* Ikon dan nada tiap tahap. Tiap kartu selalu membawa ikon + teks + angka,
   jadi warnanya hanya penguat, bukan satu-satunya pembeda. */
const IKON_TAHAP: Record<StatusPesananMasuk, typeof IkonJam> = {
  'menunggu-konfirmasi': IkonJam,
  disiapkan: IkonGudang,
  dikirim: IkonKirim,
  selesai: IkonCentangLingkaran,
  ditolak: IkonSilang,
}

const CHIP_NADA: Record<NadaLencana, string> = {
  netral: 'bg-netral-soft text-netral-ink',
  merek: 'bg-brand-soft text-brand-soft-ink',
  aman: 'bg-aman-soft text-aman-ink',
  menipis: 'bg-menipis-soft text-menipis-ink',
  kritis: 'bg-kritis-soft text-kritis-ink',
  info: 'bg-info-soft text-info-ink',
}

/** Lima kartu rekap, termasuk Ditolak yang tidak punya tahap berurutan. */
const REKAP: StatusPesananMasuk[] = [...TAHAP_PESANAN_MASUK, 'ditolak']

const URUT_TITIK: WarnaTitik[] = ['merah', 'oren', 'biru']

export default function Dashboard() {
  const pesananMasuk = usePesananMasuk()
  const perluKonfirmasi = useJumlahPerluKonfirmasi()
  const titik = useTitikPeta()

  const jumlahPerTahap = useMemo(() => {
    const per: Record<StatusPesananMasuk, number> = {
      'menunggu-konfirmasi': 0,
      disiapkan: 0,
      dikirim: 0,
      selesai: 0,
      ditolak: 0,
    }
    for (const p of pesananMasuk) per[p.status] += 1
    return per
  }, [pesananMasuk])

  /* Yang dihitung adalah TITIK, bukan pesanan. Satu UMKM selalu jadi satu
     titik walau punya beberapa pesanan sekaligus, dan warnanya diambil dari
     kondisi yang paling mendesak. Menjumlahkan pesanan di sini akan membuat
     angka merah membengkak oleh pesanan yang sebetulnya sudah berjalan. */
  const jumlahPerWarna = useMemo(() => {
    const per: Record<WarnaTitik, number> = { merah: 0, oren: 0, biru: 0 }
    for (const t of titik) per[t.warna] += 1
    return per
  }, [titik])

  /* Lima pesanan terbaru, diurutkan dari waktu masuknya. Daftar aslinya tidak
     disalin-urutkan di tempat supaya urutan di halaman Pesanan tidak ikut
     berubah. */
  const terbaru = useMemo(
    () => [...pesananMasuk].sort((a, b) => +new Date(b.dibuatPada) - +new Date(a.dibuatPada)).slice(0, 5),
    [pesananMasuk],
  )

  return (
    <div className="pb-6">
      {/* 1. Sambutan: nama toko ditulis apa adanya, bukan huruf kapital semua */}
      <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight leading-snug">
        Selamat datang, {distributorAktif.nama}
      </h1>
      <p className="mt-1 text-[0.8125rem] text-ink-3">{tanggalLengkapHari(new Date())}</p>

      {/* 2. Satu tindakan, di tempat yang paling dulu dibaca */}
      <section aria-labelledby="judul-tindakan" className="mt-4">
        <h2 id="judul-tindakan" className="sr-only">
          Yang perlu kamu kerjakan
        </h2>
        {perluKonfirmasi > 0 ? (
          <KartuTindakan
            nada="menipis"
            ikon={<IkonJam size={19} />}
            judul={`${perluKonfirmasi} pesanan menunggu kamu jawab`}
            detail="Selama belum diterima atau ditolak, pemilik usaha tidak tahu barangnya jadi dikirim atau tidak."
            aksiLabel="Lihat Pesanan Masuk"
            aksiKe="/distributor-portal/pesanan?tahap=menunggu-konfirmasi"
          />
        ) : (
          <Kartu className="flex items-start gap-3">
            <span
              className="shrink-0 size-9 rounded-md grid place-items-center bg-aman-soft text-aman-ink"
              aria-hidden="true"
            >
              <IkonCentangLingkaran size={19} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] font-bold text-ink leading-snug">
                Tidak ada pesanan yang menunggu
              </h3>
              <p className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed max-w-[60ch]">
                Semua pesanan yang masuk sudah kamu jawab. Pesanan baru muncul di sini begitu ada
                yang memesan.
              </p>
            </div>
          </Kartu>
        )}
      </section>

      {/* 3. Rekap tahap: tiap kartu adalah pintu ke tab yang sama di halaman Pesanan */}
      <section aria-labelledby="judul-rekap" className="mt-6">
        <JudulBagian
          id="judul-rekap"
          judul="Rekap pesanan"
          keterangan="Ketuk salah satu untuk membuka daftarnya."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {REKAP.map((status) => {
            const Ikon = IKON_TAHAP[status]
            return (
              <Link
                key={status}
                to={`/distributor-portal/pesanan?tahap=${status}`}
                className={cx(
                  'block bg-surface border border-line rounded-lg p-3.5 shadow-e1',
                  'transition-[border-color,box-shadow] duration-150',
                  'hover:border-line-strong hover:shadow-e2 active:bg-surface-2',
                )}
              >
                <span
                  className={cx(
                    'size-8 rounded-md grid place-items-center',
                    CHIP_NADA[NADA_PESANAN_MASUK[status]],
                  )}
                  aria-hidden="true"
                >
                  <Ikon size={17} />
                </span>
                {/* Angka besar yang berdiri sendiri: lebar digit proporsional,
                    bukan tabular-nums. */}
                <p className="mt-2.5 text-[1.5rem] font-extrabold text-ink leading-none tracking-tight">
                  {jumlahPerTahap[status]}
                </p>
                <p className="mt-1 text-[0.8125rem] font-semibold text-ink-2 leading-snug">
                  {LABEL_PESANAN_MASUK[status]}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* 4. Sebaran titik: warna dulu, angka di dalamnya, keterangan di bawah */}
      <section aria-labelledby="judul-sebaran" className="mt-6">
        <JudulBagian
          id="judul-sebaran"
          judul="Sebaran pemesan"
          keterangan="Jumlah titik di peta. Satu pemilik usaha dihitung satu titik."
          aksi={
            <TombolTautan
              ke="/distributor-portal/sebaran"
              ragam="garis"
              ukuran="kecil"
              ikonKiri={<IkonLokasi size={15} />}
            >
              Buka Peta
            </TombolTautan>
          }
        />
        <Kartu>
          <div className="grid grid-cols-3 gap-3">
            {URUT_TITIK.map((warna) => (
              <div key={warna} className="flex flex-col items-center text-center min-w-0">
                <span
                  className="size-14 rounded-full grid place-items-center text-ink-inverse text-[1.125rem] font-extrabold"
                  style={{ background: WARNA_TITIK_TOKEN[warna] }}
                >
                  {jumlahPerWarna[warna]}
                </span>
                <p className="mt-2 text-[0.8125rem] font-semibold text-ink leading-snug">
                  {LABEL_TITIK[warna]}
                </p>
              </div>
            ))}
          </div>
        </Kartu>
      </section>

      {/* 5. Lima pesanan terbaru */}
      <section aria-labelledby="judul-terbaru" className="mt-6">
        <JudulBagian
          id="judul-terbaru"
          judul="Pesanan terbaru"
          aksi={
            <Link
              to="/distributor-portal/pesanan"
              className="inline-flex items-center gap-1 min-h-11 text-[0.8125rem] font-bold text-brand hover:underline"
            >
              Lihat semua
              <IkonPanahKanan size={15} />
            </Link>
          }
        />
        <div className="space-y-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5 lg:space-y-0">
          {terbaru.map((p) => {
            const umkm = umkmById(p.umkmId)
            const jumlahBaris = p.baris.length
            return (
              <Link
                key={p.id}
                to={`/distributor-portal/pesanan/${p.id}`}
                className={cx(
                  'block bg-surface border border-line rounded-lg p-3.5 shadow-e1',
                  'transition-[border-color,box-shadow] duration-150',
                  'hover:border-line-strong hover:shadow-e2 active:bg-surface-2',
                )}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-bold text-ink leading-snug">{p.nomor}</p>
                    <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-snug">
                      {umkm?.nama ?? 'Pemilik usaha'}
                    </p>
                  </div>
                  <Lencana nada={NADA_PESANAN_MASUK[p.status]}>
                    {LABEL_PESANAN_MASUK[p.status]}
                  </Lencana>
                </div>
                <p className="mt-2 text-[0.8125rem] text-ink-3 leading-snug">
                  {jumlahBaris} jenis barang &middot; masuk {waktuLalu(p.dibuatPada)}
                </p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
