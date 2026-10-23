import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { TabSegmen } from '@/components/ui/navigasi'
import { BilahProgres } from '@/components/ui/umpanBalik'
import { IkonLokasi, IkonPanahKanan } from '@/icons'
import { angka, cx, waktuNanti } from '@/lib/format'
import { jarakKm, type Koordinat } from '@/lib/lacak'
import type { InfoKiriman } from '@/lib/types'
import type { GarisLacak, TitikLacak } from '@/components/domain/PetaLacak'

/**
 * Tampilan Lacak Pesanan bersama untuk kedua portal (revisi 23 Okt 2026):
 * daftar dan peta berdampingan di desktop, dua tab (Daftar · Peta) di HP.
 *
 * Halaman pemanggil menyiapkan `BarisLacak` (siapa pihak lainnya, titik asal,
 * titik tujuan, perkiraan posisi), tampilan ini menggambar daftar, titik peta,
 * dan garisnya. Peta dimuat malas: Leaflet tidak ikut terunduh sebelum
 * halaman ini dibuka.
 */

const PetaLacak = lazy(() => import('@/components/domain/PetaLacak').then((m) => ({ default: m.PetaLacak })))
const KeteranganPeta = lazy(() =>
  import('@/components/domain/PetaLacak').then((m) => ({ default: m.KeteranganPeta })),
)

export interface TitikBaris extends Koordinat {
  /** Kunci penanda di peta; satu gudang atau satu tujuan bisa dipakai banyak baris. */
  kunci: string
  judul: string
}

export interface BarisLacak {
  id: string
  nomor: string
  /** Nama pihak lain: distributor di sisi pemilik usaha, pemesan di sisi distributor. */
  nama: string
  status: ReactNode
  /** Rincian pesanan. */
  ke: string
  gudang: TitikBaris & { cadangan: boolean; kota: string }
  tujuan: TitikBaris & { cadangan?: boolean }
  /** Hanya untuk kiriman yang sedang di jalan. */
  posisi: { titik: Koordinat; kemajuan: number; lewat: boolean } | null
  perkiraanTiba: string | null
  kiriman: InfoKiriman | null
  /** Kunci penanda yang didatangi peta saat baris ini dipilih. */
  kunciPeta: string
  catatan?: string
  aksi?: { label: string; ke: string }
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

function KartuLacak({
  b,
  terpilih,
  lihatPeta,
}: {
  b: BarisLacak
  terpilih: boolean
  lihatPeta: () => void
}) {
  const jarak = jarakKm(b.gudang, b.tujuan)
  return (
    <article
      aria-labelledby={`lacak-${b.id}`}
      className={cx(
        'rounded-lg border bg-surface p-3.5 shadow-e1 transition-[border-color,box-shadow] scroll-mt-24',
        terpilih ? 'border-brand ring-2 ring-brand/25' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 id={`lacak-${b.id}`} className="text-kartu font-bold text-ink leading-snug">
            {b.nama}
          </h3>
          <p className="mt-0.5 text-isi text-ink-3 tabular">{b.nomor}</p>
        </div>
        <div className="shrink-0">{b.status}</div>
      </div>

      <p className="mt-2 text-isi text-ink-2">
        {b.perkiraanTiba ? (
          <>
            Perkiraan tiba <strong className="text-ink">{waktuNanti(b.perkiraanTiba)}</strong>
          </>
        ) : (
          'Jadwal tiba belum dipastikan'
        )}
        <span className="text-ink-3"> &middot; jarak &plusmn;{angka(jarak, jarak < 10 ? 1 : 0)} km</span>
      </p>

      {b.kiriman && (
        <p className="mt-1 text-isi text-ink-2 break-words">
          {b.kiriman.kurir ?? 'Jasa kirim belum dicatat'}
          {b.kiriman.pengantar && <> &middot; {b.kiriman.pengantar}</>}
          <span className="text-ink-3"> &middot; resi </span>
          <span className="tabular font-semibold text-ink">{b.kiriman.nomorResi ?? 'belum dicatat'}</span>
        </p>
      )}

      {b.posisi && (
        <div className="mt-2.5">
          <BilahProgres
            nilai={Math.round(b.posisi.kemajuan * 100)}
            maks={100}
            nada="info"
            tinggi={6}
            label={`Perkiraan posisi: ±${Math.round(b.posisi.kemajuan * 100)}% perjalanan`}
          />
          {b.posisi.lewat && (
            <Lencana nada="menipis" className="mt-2">
              Lewat perkiraan tiba
            </Lencana>
          )}
        </div>
      )}

      {b.catatan && <p className="mt-2 text-isi text-ink-2 leading-relaxed">{b.catatan}</p>}
      {b.gudang.cadangan && (
        <p className="mt-2 text-kecil text-ink-3 leading-relaxed">
          Lokasi gudang belum diisi distributor; peta memakai titik tengah {b.gudang.kota}.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {b.aksi && (
          <TombolTautan ke={b.aksi.ke} ukuran="kecil">
            {b.aksi.label}
          </TombolTautan>
        )}
        <Tombol ragam="garis" ukuran="kecil" ikonKiri={<IkonLokasi size={15} />} onClick={lihatPeta}>
          Lihat di peta
        </Tombol>
        <Link
          to={b.ke}
          className="inline-flex items-center gap-1 min-h-11 px-1 text-isi font-bold text-brand hover:underline"
        >
          Rincian
          <IkonPanahKanan size={15} />
        </Link>
      </div>
    </article>
  )
}

type Tampilan = 'daftar' | 'peta'

export function TampilanLacak({
  baris,
  terpilih,
  pilih,
  labelPeta,
}: {
  baris: BarisLacak[]
  /** Id baris yang disorot. */
  terpilih: string | null
  pilih: (id: string | null) => void
  labelPeta: string
}) {
  const [tampilan, setTampilan] = useState<Tampilan>(terpilih ? 'peta' : 'daftar')
  const daftarRef = useRef<HTMLDivElement>(null)

  const { titik, garis } = useMemo(() => {
    const t = new Map<string, TitikLacak>()
    const g: GarisLacak[] = []
    for (const b of baris) {
      t.set(b.gudang.kunci, { kunci: b.gudang.kunci, jenis: 'gudang', lat: b.gudang.lat, lng: b.gudang.lng, judul: b.gudang.judul })
      t.set(b.tujuan.kunci, { kunci: b.tujuan.kunci, jenis: 'tujuan', lat: b.tujuan.lat, lng: b.tujuan.lng, judul: b.tujuan.judul })
      if (b.posisi) {
        t.set(b.id, {
          kunci: b.id,
          jenis: 'kiriman',
          lat: b.posisi.titik.lat,
          lng: b.posisi.titik.lng,
          judul: `Kiriman ${b.nomor} untuk ${b.tujuan.judul}, perkiraan posisi`,
        })
        g.push({ kunci: b.id, dari: b.gudang, ke: b.tujuan })
      }
    }
    return { titik: [...t.values()], garis: g }
  }, [baris])

  const barisTerpilih = baris.find((b) => b.id === terpilih) ?? null

  function lihatPeta(id: string) {
    pilih(id)
    setTampilan('peta')
  }

  /* Ketukan penanda: pilih baris pertama yang memakai penanda itu dan
     tunjukkan kartunya di daftar (desktop) atau di bawah peta (HP). */
  function pilihDariPeta(kunci: string) {
    const b = baris.find((x) => x.id === kunci) ?? baris.find((x) => x.kunciPeta === kunci)
      ?? baris.find((x) => x.gudang.kunci === kunci || x.tujuan.kunci === kunci)
    if (!b) return
    pilih(b.id)
    daftarRef.current?.querySelector(`[aria-labelledby="lacak-${b.id}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <>
      <TabSegmen<Tampilan>
        className="mt-4 lg:hidden"
        aktif={tampilan}
        ubah={setTampilan}
        tab={[
          { nilai: 'daftar', label: 'Daftar', jumlah: baris.length },
          { nilai: 'peta', label: 'Peta' },
        ]}
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start">
        <section
          aria-labelledby="judul-daftar-lacak"
          className={cx('lg:col-span-5', tampilan !== 'daftar' && 'hidden lg:block')}
        >
          <h2 id="judul-daftar-lacak" className="sr-only">
            Daftar pesanan yang dilacak
          </h2>
          <div ref={daftarRef} className="space-y-3">
            {baris.map((b) => (
              <KartuLacak key={b.id} b={b} terpilih={b.id === terpilih} lihatPeta={() => lihatPeta(b.id)} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="judul-peta-lacak"
          className={cx('lg:col-span-7 lg:sticky lg:top-6', tampilan !== 'peta' && 'hidden lg:block')}
        >
          <h2 id="judul-peta-lacak" className="sr-only">
            Peta
          </h2>
          <Suspense fallback={<div className="h-[60vh] min-h-[22rem] rounded-lg skeleton" />}>
            <PetaLacak
              titik={titik}
              garis={garis}
              terpilih={barisTerpilih?.kunciPeta ?? null}
              pilih={pilihDariPeta}
              label={labelPeta}
              className="h-[60vh] min-h-[22rem] lg:h-[calc(100dvh-12rem)]"
            />
            <KeteranganPeta className="mt-3" />
          </Suspense>
          <p className="mt-2 text-kecil text-ink-3 leading-relaxed max-w-[70ch]">
            Posisi kiriman diperkirakan dari waktu berangkat dan perkiraan tiba, di garis lurus antara gudang dan
            tempat usaha. Bukan dari GPS kurir.
          </p>
          {/* Di HP daftarnya ada di tab lain, jadi kartu yang dipilih ditaruh di bawah peta. */}
          {barisTerpilih && (
            <div className="mt-3 lg:hidden">
              <KartuLacak b={barisTerpilih} terpilih lihatPeta={() => pilih(barisTerpilih.id)} />
            </div>
          )}
        </section>
      </div>
    </>
  )
}
