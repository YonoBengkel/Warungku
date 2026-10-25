import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Lencana, TombolTautan } from '@/components/ui/dasar'
import { IkonCentang, IkonLokasi, IkonPanahKanan, IkonPasokan } from '@/icons'
import { cx, jam, tanggalRingkas, waktuNanti } from '@/lib/format'
import type { Koordinat } from '@/lib/lacak'
import type { GarisLacak, TitikLacak } from '@/components/domain/PetaLacak'

/**
 * Lacak Pesanan untuk kedua portal (revisi V3, Q75 dan Q77): satu daftar selebar
 * halaman, satu baris per pesanan, dengan garis empat status Menunggu
 * Konfirmasi → Disiapkan → Dikirim → Selesai seperti gambar acuan Ilham.
 * Dulu daftar dan peta berdampingan; petanya kini ada di rincian tiap pesanan
 * (`PetaPesanan`), jadi peta hanya pernah menunjukkan satu pesanan.
 *
 * Halaman pemanggil menyiapkan `BarisLacak`; tampilan ini menggambar daftarnya.
 * Peta dimuat malas: Leaflet tidak ikut terunduh sebelum rincian dibuka.
 */

const PetaLacak = lazy(() => import('@/components/domain/PetaLacak').then((m) => ({ default: m.PetaLacak })))
const KeteranganPeta = lazy(() =>
  import('@/components/domain/PetaLacak').then((m) => ({ default: m.KeteranganPeta })),
)

/**
 * Jalan ke Lacak Pesanan dari halaman Pesanan, dengan jumlah kiriman yang sedang
 * di jalan. Angka itu dulu ada di menu samping, yang sejak revisi V3 (Q74) tidak
 * lagi memuat Lacak Pesanan.
 */
export function TombolLacak({ ke, jumlah, className }: { ke: string; jumlah: number; className?: string }) {
  return (
    <TombolTautan ke={ke} ragam="garis" ukuran="kecil" ikonKiri={<IkonLokasi size={15} />} className={className}>
      Lacak Pesanan
      {jumlah > 0 && (
        <>
          <span className="sr-only">, {jumlah} sedang di jalan</span>
          <span
            aria-hidden="true"
            className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular"
          >
            {jumlah}
          </span>
        </>
      )}
    </TombolTautan>
  )
}

/** Waktu sekarang yang diperbarui tiap menit, supaya perkiraan posisi ikut bergerak. */
export function useSekarang(selang = 60_000): number {
  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setSekarang(Date.now()), selang)
    return () => window.clearInterval(t)
  }, [selang])
  return sekarang
}

/* ================================================================== */
/* Garis empat status                                                 */
/* ================================================================== */

const LANGKAH = [
  { status: 'menunggu-konfirmasi', judul: 'Menunggu Konfirmasi', pendek: 'Menunggu' },
  { status: 'disiapkan', judul: 'Disiapkan', pendek: 'Disiapkan' },
  { status: 'dikirim', judul: 'Dikirim', pendek: 'Dikirim' },
  { status: 'selesai', judul: 'Selesai', pendek: 'Selesai' },
] as const

export interface LangkahLacak {
  judul: string
  pendek: string
  /** Kapan titik ini dilewati, dari riwayat pesanan; kosong bila belum. */
  waktu: string | null
  lewat: boolean
}

/**
 * Empat titik status dari riwayat pesanan. Waktu tiap titik diambil dari kabar
 * TERBARU di status itu, sama dengan garis waktu di rincian pesanan.
 */
export function langkahLacak(jejak: Array<{ status: string; waktu: string }>, status: string): LangkahLacak[] {
  const sekarang = LANGKAH.findIndex((l) => l.status === status)
  return LANGKAH.map((l, i) => {
    const lewat = i <= sekarang
    const kabar = [...jejak].reverse().find((j) => j.status === l.status)
    return { judul: l.judul, pendek: l.pendek, lewat, waktu: lewat ? (kabar?.waktu ?? null) : null }
  })
}

const waktuTitik = (w: string) => `${tanggalRingkas(w)}, ${jam(w)}`

/**
 * Garis status mendatar. Bagian yang sudah dilewati berwarna merek, sisanya
 * garis putus abu-abu. Selama barang di jalan, ikon truk berdiri di antara
 * Dikirim dan Selesai sesuai perkiraan posisinya: pengganti peta di daftar.
 */
function GarisStatus({
  langkah,
  posisi,
  sudahSampai,
}: {
  langkah: LangkahLacak[]
  posisi: { kemajuan: number; lewat: boolean } | null
  sudahSampai: boolean
}) {
  const terakhir = langkah.reduce((a, l, i) => (l.lewat ? i : a), -1)
  const diJalan = terakhir === 2 && (posisi != null || sudahSampai)
  /* Bagian garis yang terisi, 0 sampai 1, dari titik pertama ke titik terakhir. */
  const terisi = Math.max(
    0,
    terakhir / (langkah.length - 1) + (diJalan ? (sudahSampai ? 1 : Math.min(1, posisi!.kemajuan)) / (langkah.length - 1) : 0),
  )
  const lewatPerkiraan = posisi?.lewat ?? false

  return (
    <div className="relative">
      {/* Rel: dari pusat titik pertama sampai pusat titik terakhir (kolom 1/8 dan
          7/8), setinggi 2px tepat di tengah titik yang 24px. */}
      <div aria-hidden="true" className="absolute top-[11px] left-[12.5%] right-[12.5%] h-0.5">
        <div className="absolute inset-x-0 top-0 border-t-2 border-dashed border-line-strong" />
        <div className="absolute left-0 top-0 h-0.5 rounded-full bg-brand" style={{ width: `${terisi * 100}%` }} />
        {/* Di atas titik (z-20): barang yang sudah sampai tapi belum dihitung
            berdiri tepat di titik Selesai. */}
        {diJalan && (
          <span
            className={cx(
              'absolute z-20 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center size-7 rounded-full shadow-e2 text-ink-inverse',
              lewatPerkiraan ? 'bg-menipis' : 'bg-info',
            )}
            style={{ left: `${terisi * 100}%` }}
          >
            <IkonPasokan size={15} />
          </span>
        )}
      </div>

      <ol aria-label="Status pesanan" className="relative grid grid-cols-4">
        {langkah.map((l, i) => {
          const kini = i === terakhir
          return (
            <li key={l.judul} className="flex flex-col items-center text-center px-1">
              <span
                aria-hidden="true"
                className={cx(
                  'relative z-10 grid place-items-center size-6 rounded-full',
                  l.lewat ? 'bg-brand text-ink-inverse' : 'bg-surface border-2 border-line-strong',
                  kini && !diJalan && 'ring-4 ring-brand/20',
                )}
              >
                {l.lewat && <IkonCentang size={14} />}
              </span>
              <span className={cx('mt-2 text-kecil font-semibold leading-tight', l.lewat ? 'text-ink' : 'text-ink-3')}>
                {/* Di HP label penuh "Menunggu Konfirmasi" tidak muat di seperempat
                    layar 360px; pembaca layar tetap mendengar nama lengkapnya. */}
                <span aria-hidden="true" className="sm:hidden">
                  {l.pendek}
                </span>
                <span className="sr-only sm:not-sr-only">{l.judul}</span>
                <span className="sr-only">{l.lewat ? ', sudah' : ', belum'}</span>
              </span>
              {/* Di HP tanggal hanya di titik terakhir yang sudah dilewati (Q75). */}
              {l.waktu && (
                <span className={cx('mt-0.5 text-kecil text-ink-3 tabular leading-tight', !kini && 'hidden sm:block')}>
                  {waktuTitik(l.waktu)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {diJalan && (
        <p className="sr-only">
          {sudahSampai
            ? 'Barang sudah sampai, tinggal dihitung.'
            : `Perkiraan posisi kiriman: sekitar ${Math.round(posisi!.kemajuan * 100)}% perjalanan.`}
        </p>
      )}
    </div>
  )
}

/* ================================================================== */
/* Daftar lacak                                                       */
/* ================================================================== */

export interface BarisLacak {
  id: string
  nomor: string
  /** Nama pihak lain: distributor di sisi pemilik usaha, pemesan di sisi distributor. */
  nama: string
  warna?: string
  status: ReactNode
  /** Rincian pesanan. */
  ke: string
  /** Barang di pesanan ini, satu baris: "Gula Aren Cair 2 jerigen + 1 barang lain". */
  ringkas?: string
  langkah: LangkahLacak[]
  /** Hanya untuk kiriman yang sedang di jalan. */
  posisi: { kemajuan: number; lewat: boolean } | null
  /** Distributor sudah menandai barangnya sampai; tinggal dihitung pemilik usaha. */
  sudahSampai: boolean
  perkiraanTiba: string | null
  catatan?: string
  aksi?: { label: string; ke: string }
}

function BarisDaftarLacak({ b }: { b: BarisLacak }) {
  return (
    <article
      aria-labelledby={`lacak-${b.id}`}
      className="relative rounded-lg border border-line bg-surface p-4 shadow-e1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2"
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,19rem)_1fr] lg:items-center lg:gap-8">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar nama={b.nama} warna={b.warna} ukuran={40} />
          <div className="min-w-0 grow">
            <div className="flex items-start justify-between gap-2">
              <h3 id={`lacak-${b.id}`} className="min-w-0 text-kartu font-bold text-ink leading-snug">
                {/* Seluruh baris bisa ditekan lewat tautan yang direntangkan;
                    tombol Hitung Barang duduk di atasnya. */}
                <Link to={b.ke} className="after:absolute after:inset-0 after:rounded-lg">
                  {b.nama}
                </Link>
              </h3>
              <IkonPanahKanan size={18} className="shrink-0 mt-0.5 text-ink-3 lg:hidden" />
            </div>
            <p className="text-kecil text-ink-3 tabular">{b.nomor}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {b.status}
              {b.posisi?.lewat && <Lencana nada="menipis">Lewat perkiraan tiba</Lencana>}
            </div>
            {b.ringkas && <p className="mt-1.5 text-isi text-ink-2 truncate">{b.ringkas}</p>}
            <p className="mt-0.5 text-kecil text-ink-2">
              {b.sudahSampai ? (
                <strong className="font-semibold text-brand">Sudah sampai, tinggal dihitung</strong>
              ) : b.perkiraanTiba ? (
                <>
                  Perkiraan tiba <strong className="font-semibold text-ink">{waktuNanti(b.perkiraanTiba)}</strong>
                </>
              ) : (
                'Jadwal tiba belum dipastikan'
              )}
            </p>
            {b.catatan && <p className="mt-1 text-kecil text-ink-3 leading-relaxed">{b.catatan}</p>}
          </div>
        </div>

        <div className="mt-4 lg:mt-0 flex items-center gap-4">
          <div className="min-w-0 grow">
            <GarisStatus langkah={b.langkah} posisi={b.posisi} sudahSampai={b.sudahSampai} />
          </div>
          <IkonPanahKanan size={18} className="hidden lg:block shrink-0 text-ink-3" />
        </div>
      </div>

      {/* Sejajar dengan teks di atasnya (logo 40px + jarak 12px), di desktop juga
          (revisi V4, Q84). */}
      {b.aksi && (
        <div className="relative z-10 mt-3 pl-[52px]">
          <TombolTautan ke={b.aksi.ke} ukuran="kecil">
            {b.aksi.label}
          </TombolTautan>
        </div>
      )}
    </article>
  )
}

export function DaftarLacak({ baris, judul }: { baris: BarisLacak[]; judul: string }) {
  return (
    <section aria-labelledby="judul-daftar-lacak" className="mt-4">
      <h2 id="judul-daftar-lacak" className="sr-only">
        {judul}
      </h2>
      <div className="space-y-3">
        {baris.map((b) => (
          <BarisDaftarLacak key={b.id} b={b} />
        ))}
      </div>
    </section>
  )
}

/* ================================================================== */
/* Peta satu pesanan, di rinciannya                                   */
/* ================================================================== */

export interface TitikBaris extends Koordinat {
  /** Kunci penanda di peta. */
  kunci: string
  judul: string
}

/**
 * Peta satu pesanan (revisi V3, Q76 dan Q80): gudang distributor, tempat usaha
 * tujuan, garis rutenya, dan truk bila sedang di jalan. Tampil di rincian
 * pesanan selama pesanan berjalan.
 */
export function PetaPesanan({
  gudang,
  tujuan,
  posisi,
  label,
}: {
  gudang: TitikBaris & { cadangan: boolean; kota: string }
  tujuan: TitikBaris
  posisi: { titik: Koordinat; kemajuan: number } | null
  label: string
}) {
  /* Bergantung pada angkanya, bukan pada objeknya: halaman rincian membuat objek
     titik baru di setiap render, dan peta yang digambar ulang akan kembali ke
     tampilan awal setiap kali pengguna menggeser atau memperbesarnya. */
  const kiriman = posisi ? { lat: posisi.titik.lat, lng: posisi.titik.lng } : null
  const { titik, garis } = useMemo(() => {
    const dari = { lat: gudang.lat, lng: gudang.lng }
    const ke = { lat: tujuan.lat, lng: tujuan.lng }
    const t: TitikLacak[] = [
      { kunci: gudang.kunci, jenis: 'gudang', ...dari, judul: gudang.judul },
      { kunci: tujuan.kunci, jenis: 'tujuan', ...ke, judul: tujuan.judul },
    ]
    if (kiriman) t.push({ kunci: 'kiriman', jenis: 'kiriman', ...kiriman, judul: 'Kiriman ini, perkiraan posisi' })
    const g: GarisLacak[] = [{ kunci: 'rute', dari, ke }]
    return { titik: t, garis: g }
  }, [gudang.kunci, gudang.judul, gudang.lat, gudang.lng, tujuan.kunci, tujuan.judul, tujuan.lat, tujuan.lng, kiriman?.lat, kiriman?.lng])

  return (
    <section aria-labelledby="judul-peta-pesanan" className="bg-surface border border-line rounded-lg p-4 shadow-e1">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="judul-peta-pesanan" className="text-kartu font-bold text-ink">
          Posisi pesanan
        </h2>
        {posisi && (
          <span className="text-isi text-ink-2 tabular">&plusmn;{Math.round(posisi.kemajuan * 100)}% perjalanan</span>
        )}
      </div>
      <Suspense fallback={<div className="mt-3 h-60 rounded-lg skeleton" />}>
        <PetaLacak
          titik={titik}
          garis={garis}
          terpilih={posisi ? 'kiriman' : null}
          label={label}
          className="mt-3 h-60"
        />
        <KeteranganPeta className="mt-3" jenis={posisi ? ['gudang', 'tujuan', 'kiriman'] : ['gudang', 'tujuan']} />
      </Suspense>
      <p className="mt-2 text-kecil text-ink-3 leading-relaxed">
        {posisi
          ? 'Posisi kiriman diperkirakan dari waktu berangkat dan perkiraan tiba, di garis lurus antara gudang dan tempat usaha. Bukan dari GPS kurir.'
          : 'Garis menunjukkan rute dari gudang ke tempat usaha. Titik kiriman muncul begitu barang berangkat.'}
        {gudang.cadangan && ` Lokasi gudang belum diisi distributor; peta memakai titik tengah ${gudang.kota}.`}
      </p>
    </section>
  )
}
