import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bagian, Kartu, Kerangka, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { BarisChip, Chip } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { GrafikBatang } from '@/components/grafik/GrafikBatang'
import { IkonGrafik, IkonNota, IkonPanahKanan, IkonTrenNaik, IkonTrenTurun, IkonUang } from '@/icons'
import { angka, cx, rupiah, rupiahRingkas, rupiahSumbu, tanggalPendek, tanggalRingkas } from '@/lib/format'
import type { RentangTanggal, RingkasanPenjualan, SumberPenjualan } from '@/lib/apiPenjualan'

/**
 * Tampilan Ringkasan Penjualan (revisi 23 Okt 2026), pola majoo: rentang
 * tanggal, angka utama berpita warna, grafik per hari, lalu rincian. Satu
 * tampilan untuk tiga sumber; istilahnya mengikuti `sumber` dari server.
 *
 * Tanpa biaya promosi dan laba kotor: harga pokok per menu tidak ada. Angka
 * utama dibandingkan dengan periode sebelumnya yang sama panjang, selalu dengan
 * ikon dan kata, tidak pernah warna saja.
 */

interface Istilah {
  total: string
  transaksi: string
  pihak: string | null
  judulPihak: string | null
  sumber: string
}

const ISTILAH: Record<SumberPenjualan, Istilah> = {
  nota: {
    total: 'Total penjualan',
    transaksi: 'nota',
    pihak: null,
    judulPihak: null,
    sumber: 'Dihitung dari nota kasir apa adanya: nama dan harga seperti tercetak di struk. Nota demo tidak dihitung.',
  },
  'penjualan-usaha': {
    total: 'Total penjualan',
    transaksi: 'kiriman',
    pihak: 'pembeli',
    judulPihak: 'Pembeli teratas',
    sumber: 'Dihitung dari kiriman produk jadi ke pembeli usaha yang dicatat di halaman Produksi.',
  },
  'pesanan-selesai': {
    total: 'Pendapatan',
    transaksi: 'pesanan',
    pihak: 'pelanggan',
    judulPihak: 'Pelanggan teratas',
    sumber:
      'Dihitung dari pesanan yang sudah selesai (barang sampai), menurut tanggal pesanan: nilai barang ditambah ongkos kirim. Pesanan variasi demo tidak dihitung.',
  },
}

/** "2026-09-06" dibaca sebagai tanggal setempat, bukan tengah malam UTC. */
function tanggalLokal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function keIso(t: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}

function mundur(s: string, hari: number): string {
  const t = tanggalLokal(s)
  t.setDate(t.getDate() - hari)
  return keIso(t)
}

/** 382281 ml → "382,3 liter"; 26316 gram → "26,3 kg". Nama satuan lain apa adanya. */
function jumlahBaca(jumlah: number, satuan: string): string {
  const s = satuan.toLowerCase()
  if ((s === 'gram' || s === 'g') && jumlah >= 1000) return `${angka(jumlah / 1000, 1)} kg`
  if (s === 'ml' && jumlah >= 1000) return `${angka(jumlah / 1000, 1)} liter`
  return `${angka(jumlah, Number.isInteger(jumlah) ? 0 : 1)} ${satuan}`
}

function Banding({ sekarang, lalu, hari }: { sekarang: number; lalu: number; hari: number }) {
  if (lalu <= 0) return <span className="text-kecil text-ink-3">Belum ada pembanding</span>
  const beda = Math.round(((sekarang - lalu) / lalu) * 100)
  const teks = `${hari} hari sebelumnya`
  if (beda >= 1)
    return (
      <span className="inline-flex items-center gap-1 text-kecil font-semibold text-aman-ink">
        <IkonTrenNaik size={13} />
        naik {beda}% dari {teks}
      </span>
    )
  if (beda <= -1)
    return (
      <span className="inline-flex items-center gap-1 text-kecil font-semibold text-menipis-ink">
        <IkonTrenTurun size={13} />
        turun {Math.abs(beda)}% dari {teks}
      </span>
    )
  return <span className="text-kecil text-ink-3">sama dengan {teks}</span>
}

function Petak({
  label,
  nilai,
  bawah,
  pita,
  lebar,
}: {
  label: string
  nilai: string
  bawah?: ReactNode
  /** Pita warna di kaki petak, pola majoo. Hanya hiasan; maknanya ada di label. */
  pita: string
  /** Di HP selebar dua kolom: angka rupiah besar tidak muat setengah layar 360px. */
  lebar?: boolean
}) {
  return (
    <Kartu padat className={cx('border-b-4 min-w-0', pita, lebar && 'col-span-2 lg:col-span-1')}>
      <p className="text-isi text-ink-2 leading-snug">{label}</p>
      {/* Tanpa break-words: angka hanya boleh turun baris di spasi ("Rp" | angka), tidak di tengah angka. */}
      <p className="mt-1 text-[1.125rem] sm:text-[1.375rem] font-extrabold text-ink tabular leading-tight">{nilai}</p>
      {bawah && <div className="mt-1">{bawah}</div>}
    </Kartu>
  )
}

type Preset = 7 | 30 | 90 | 'atur'

export function TampilanRingkasan({
  ambil,
}: {
  ambil: (rentang?: RentangTanggal) => Promise<RingkasanPenjualan>
}) {
  const [data, setData] = useState<RingkasanPenjualan | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>(30)
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')

  const muat = useCallback(
    (rentang?: RentangTanggal) => {
      setMemuat(true)
      setGalat(null)
      ambil(rentang)
        .then((r) => {
          setData(r)
          setDari(r.dari)
          setSampai(r.sampai)
        })
        .catch((e: unknown) => setGalat(e instanceof Error ? e.message : 'Ringkasan belum bisa dimuat.'))
        .finally(() => setMemuat(false))
    },
    [ambil],
  )

  useEffect(() => {
    muat()
  }, [muat])

  /** Rentang siap pakai selalu berakhir di tanggal data terakhir, bukan hari ini. */
  function pilihPreset(p: Preset) {
    setPreset(p)
    if (p === 'atur' || !data) return
    const akhir = data.dataTerakhir ?? data.sampai
    muat({ dari: mundur(akhir, p - 1), sampai: akhir })
  }

  const istilah = data ? ISTILAH[data.sumber] : null
  const panjang = data ? Math.round((+tanggalLokal(data.sampai) - +tanggalLokal(data.dari)) / 86_400_000) + 1 : 0
  const adaPihak = !!data && !!istilah?.judulPihak && data.pihakTeratas.length > 0
  /** Tanpa kotak rincian dan daftar pembeli, Terlaris sendirian di baris bawah. */
  const terlarisSendiri = !!data && data.rincian.length === 0 && !adaPihak
  /* Rincian dan pelanggan teratas sama-sama ada: keduanya bertumpuk di kolom
     kiri dan Terlaris setinggi dua baris di kanan (revisi V4, Q84). Dulu
     pelanggan teratas menunggu di baris kedua, di bawah Terlaris yang panjang,
     sehingga ada celah lebar di bawah rincian. Baris kedua `1fr` supaya
     kelebihan tinggi Terlaris jatuh ke sana, bukan menjarakkan kedua kotak. */
  const tigaKotak = !!data && data.rincian.length > 0 && adaPihak

  const batang = useMemo(() => {
    if (!data) return []
    const maks = Math.max(...data.perHari.map((h) => h.total))
    return data.perHari.map((h) => ({
      label: data.perHari.length > 31 ? tanggalRingkas(tanggalLokal(h.tanggal)) : String(tanggalLokal(h.tanggal).getDate()),
      nilai: h.total,
      sorot: h.total === maks && maks > 0,
    }))
  }, [data])

  const tersibuk = data?.perHari.reduce((a, h) => (h.total > a.total ? h : a), data.perHari[0])
  const galatRentang = preset === 'atur' && dari && sampai && dari > sampai ? 'Tanggal awal harus sebelum tanggal akhir.' : undefined

  return (
    <div>
      {/* ---------------- Rentang tanggal ---------------- */}
      <section aria-labelledby="judul-rentang" className="mt-4">
        <h2 id="judul-rentang" className="sr-only">
          Rentang tanggal
        </h2>
        <BarisChip>
          {([7, 30, 90] as const).map((n) => (
            <Chip key={n} aktif={preset === n} onClick={() => pilihPreset(n)}>
              {n} hari
            </Chip>
          ))}
          <Chip aktif={preset === 'atur'} onClick={() => pilihPreset('atur')}>
            Pilih tanggal
          </Chip>
        </BarisChip>
        {preset === 'atur' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Kolom label="Dari" type="date" value={dari} max={sampai || undefined} onChange={(e) => setDari(e.target.value)} className="w-44" />
            <Kolom
              label="Sampai"
              type="date"
              value={sampai}
              min={dari || undefined}
              onChange={(e) => setSampai(e.target.value)}
              galat={galatRentang}
              className="w-44"
            />
            <Tombol ukuran="sedang" disabled={!dari || !sampai || !!galatRentang} memuat={memuat} onClick={() => muat({ dari, sampai })}>
              Tampilkan
            </Tombol>
          </div>
        )}
        {data && istilah && (
          <p className="mt-3 text-isi text-ink-2 leading-relaxed max-w-[75ch]">
            <strong className="text-ink">
              {tanggalPendek(tanggalLokal(data.dari))} &ndash; {tanggalPendek(tanggalLokal(data.sampai))}
            </strong>{' '}
            ({panjang} hari).{' '}
            {data.dataTerakhir
              ? `Data terakhir tercatat ${tanggalPendek(tanggalLokal(data.dataTerakhir))}; pilihan 7, 30, dan 90 hari dihitung mundur dari tanggal itu. `
              : ''}
            {istilah.sumber}
          </p>
        )}
      </section>

      {galat && (
        <Peringatan
          nada="kritis"
          judul="Ringkasan belum bisa dimuat"
          className="mt-4"
          aksi={
            <Tombol ragam="garis" ukuran="kecil" onClick={() => muat(data ? { dari, sampai } : undefined)}>
              Coba lagi
            </Tombol>
          }
        >
          {galat}
        </Peringatan>
      )}

      {!data && memuat && (
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Kerangka key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {data && istilah && data.dataTerakhir == null && (
        <KeadaanKosong
          ikon={<IkonGrafik size={26} />}
          judul="Belum ada penjualan tercatat"
          pesan={`Ringkasan muncul setelah ada ${istilah.transaksi} pertama.`}
        />
      )}

      {data && istilah && data.dataTerakhir != null && (
        <div className={cx('transition-opacity', memuat && 'opacity-60')} aria-busy={memuat}>
          {/* ---------------- Angka utama ---------------- */}
          <section aria-labelledby="judul-angka-utama" className="mt-4">
            <h2 id="judul-angka-utama" className="sr-only">
              Angka utama
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 [&>*]:min-w-0">
              <Petak
                label={istilah.total}
                nilai={rupiah(data.total)}
                pita="border-b-brand"
                lebar
                bawah={<Banding sekarang={data.total} lalu={data.pembandingTotal} hari={panjang} />}
              />
              <Petak
                label={`Jumlah ${istilah.transaksi}`}
                nilai={angka(data.jumlahTransaksi)}
                pita="border-b-aksen"
                bawah={<Banding sekarang={data.jumlahTransaksi} lalu={data.pembandingJumlah} hari={panjang} />}
              />
              <Petak label={`Rata-rata per ${istilah.transaksi}`} nilai={rupiah(data.rataRata)} pita="border-b-kuning" />
              {data.jumlahPihak != null && istilah.pihak ? (
                <Petak label={`Jumlah ${istilah.pihak}`} nilai={angka(data.jumlahPihak)} pita="border-b-info" lebar />
              ) : (
                <Petak
                  label="Hari tersibuk"
                  nilai={tersibuk && tersibuk.total > 0 ? tanggalRingkas(tanggalLokal(tersibuk.tanggal)) : '–'}
                  pita="border-b-info"
                  lebar
                  bawah={
                    tersibuk && tersibuk.total > 0 ? (
                      <span className="text-kecil text-ink-2 tabular">{rupiah(tersibuk.total)}</span>
                    ) : undefined
                  }
                />
              )}
            </div>
          </section>

          {/* ---------------- Per hari ---------------- */}
          <Bagian
            id="judul-per-hari"
            judul="Penjualan per hari"
            keterangan={`Batang tertinggi diberi angka. ${istilah.total} dalam Rupiah.`}
            className="mt-4"
          >
            {data.total === 0 ? (
              <p className="text-isi text-ink-3">Belum ada penjualan di rentang ini.</p>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <div className={cx(batang.length > 14 && 'min-w-[36rem]')}>
                  <GrafikBatang data={batang} satuan="Rupiah" tinggi={200} format={rupiah} formatSumbu={rupiahSumbu} lebarSumbu={52} />
                </div>
              </div>
            )}
          </Bagian>

          <div className={cx('mt-4 grid gap-4 lg:grid-cols-2 lg:items-start [&>*]:min-w-0', tigaKotak && 'lg:grid-rows-[auto_1fr]')}>
            {/* ---------------- Rincian ---------------- */}
            {data.rincian.length > 0 && (
              <Bagian id="judul-rincian" judul="Rincian pendapatan" className={cx(tigaKotak && 'lg:col-start-1 lg:row-start-1')}>
                <dl className="divide-y divide-line">
                  {data.rincian.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
                      <dt className="text-isi text-ink-2">{r.label}</dt>
                      <dd className="text-isi font-semibold text-ink tabular">{rupiah(r.nilai)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-isi font-bold text-ink">{istilah.total}</dt>
                    <dd className="text-isi font-extrabold text-ink tabular">{rupiah(data.total)}</dd>
                  </div>
                </dl>
              </Bagian>
            )}

            {/* ---------------- Terlaris ----------------
                Tanpa rincian dan tanpa daftar pembeli (nota kasir), Terlaris
                sendirian di kisi: ia dilebarkan dan daftarnya dibagi dua kolom,
                1-5 di kiri dan 6-10 di kanan, supaya tidak menyisakan separuh
                layar kosong dan tingginya separuh (revisi V2, final touch). */}
            <Bagian
              id="judul-terlaris"
              judul="Terlaris"
              keterangan={data.sumber === 'nota' ? 'Menurut nilai penjualan, dengan nama seperti di nota.' : 'Menurut nilai penjualan.'}
              className={cx(terlarisSendiri && 'lg:col-span-2', tigaKotak && 'lg:col-start-2 lg:row-start-1 lg:row-span-2')}
            >
              {data.terlaris.length === 0 ? (
                <p className="text-isi text-ink-3">Belum ada penjualan di rentang ini.</p>
              ) : (
                <ol
                  className={cx(
                    'space-y-3',
                    terlarisSendiri &&
                      'lg:space-y-0 lg:grid lg:grid-flow-col lg:grid-rows-[repeat(5,auto)] lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3',
                  )}
                >
                  {data.terlaris.map((t, i) => (
                    <li key={`${t.nama}-${t.satuan}`} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 text-isi text-ink">
                          <span className="tabular text-ink-3">{i + 1}. </span>
                          <span className="font-semibold break-words">{t.nama}</span>
                        </p>
                        <p className="shrink-0 text-isi font-semibold text-ink tabular">{rupiah(t.total)}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-2.5">
                        <div className="h-1.5 grow rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-seri-1"
                            style={{ width: `${Math.max(2, Math.round((t.total / Math.max(1, data.terlaris[0].total)) * 100))}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-kecil text-ink-3 tabular">{jumlahBaca(t.jumlah, t.satuan)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Bagian>

            {/* ---------------- Pembeli atau pelanggan teratas ---------------- */}
            {adaPihak && (
              <Bagian id="judul-pihak" judul={istilah.judulPihak ?? undefined} className={cx(tigaKotak && 'lg:col-start-1 lg:row-start-2')}>
                <ol className="divide-y divide-line">
                  {data.pihakTeratas.map((p, i) => (
                    <li key={p.nama} className="flex items-baseline justify-between gap-3 py-2.5">
                      <p className="min-w-0 text-isi text-ink">
                        <span className="tabular text-ink-3">{i + 1}. </span>
                        <span className="font-semibold break-words">{p.nama}</span>
                        <span className="block text-kecil text-ink-3">
                          {angka(p.jumlah)} {istilah.transaksi}
                        </span>
                      </p>
                      <p className="shrink-0 text-isi font-semibold text-ink tabular">{rupiah(p.total)}</p>
                    </li>
                  ))}
                </ol>
              </Bagian>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Kartu ringkas di Beranda dan Dashboard distributor: angka 30 hari sampai data
 * terakhir, dengan tautan ke halaman lengkap. Tidak tampil untuk data contoh.
 */
/** Chip naik/turun di petak kartu Beranda: ikon + kata + warna, tidak pernah warna saja. */
function ChipBanding({ sekarang, lalu, hari }: { sekarang: number; lalu: number; hari: number }) {
  if (lalu <= 0) return <span className="text-kecil text-ink-3">Belum ada pembanding</span>
  const beda = Math.round(((sekarang - lalu) / lalu) * 100)
  const teks = <span className="text-kecil text-ink-3">dari {hari} hari sebelumnya</span>
  if (Math.abs(beda) < 1) return <span className="text-kecil text-ink-3">Sama dengan {hari} hari sebelumnya</span>
  const naik = beda > 0
  const Ikon = naik ? IkonTrenNaik : IkonTrenTurun
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-kecil font-bold',
          naik ? 'bg-aman-soft text-aman-ink' : 'bg-menipis-soft text-menipis-ink',
        )}
      >
        <Ikon size={13} />
        {naik ? 'naik' : 'turun'} {Math.abs(beda)}%
      </span>
      {teks}
    </span>
  )
}

/**
 * Batang penjualan per hari (seri-1). Batang tertinggi tegas dan diberi angka,
 * sisanya pudar; tiap batang membawa tanggal dan nilainya sebagai gelembung
 * keterangan saat disorot.
 */
function BatangPerHari({ perHari }: { perHari: RingkasanPenjualan['perHari'] }) {
  if (perHari.length === 0) return null
  const lebar = 960
  const tinggi = 110
  const atas = 22
  const celah = 4
  const w = (lebar - celah * (perHari.length - 1)) / perHari.length
  const maks = Math.max(...perHari.map((h) => h.total), 1)
  const iPuncak = perHari.findIndex((h) => h.total === maks)
  const puncak = perHari[iPuncak]
  const label = `${rupiahRingkas(puncak.total)} · ${tanggalRingkas(tanggalLokal(puncak.tanggal))}`
  // Label puncak dijepit di dalam bidang supaya tidak terpotong di tepi.
  const xLabel = Math.min(lebar - 90, Math.max(90, iPuncak * (w + celah) + w / 2))
  return (
    <>
      <svg
        viewBox={`0 0 ${lebar} ${tinggi}`}
        width="100%"
        height={tinggi}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Penjualan per hari, tertinggi ${rupiahRingkas(puncak.total)} pada ${tanggalRingkas(tanggalLokal(puncak.tanggal))}`}
        className="block overflow-visible"
      >
        {perHari.map((h, i) => {
          const t = Math.max(2, (h.total / maks) * (tinggi - atas))
          return (
            <rect
              key={h.tanggal}
              x={i * (w + celah)}
              y={tinggi - t}
              width={w}
              height={t}
              rx={2}
              className={cx('fill-seri-1', i !== iPuncak && 'opacity-55')}
            >
              <title>{`${tanggalRingkas(tanggalLokal(h.tanggal))}: ${rupiahRingkas(h.total)}`}</title>
            </rect>
          )
        })}
      </svg>
      {/* Label puncak di luar SVG: SVG yang direntang tidak boleh ikut meregangkan hurufnya. */}
      <div className="relative h-0" aria-hidden="true">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-kecil font-bold text-ink"
          style={{ left: `${(xLabel / lebar) * 100}%`, bottom: tinggi - atas + 3 }}
        >
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-kecil text-ink-3" aria-hidden="true">
        <span>{tanggalRingkas(tanggalLokal(perHari[0].tanggal))}</span>
        <span>{tanggalRingkas(tanggalLokal(perHari[perHari.length - 1].tanggal))}</span>
      </div>
    </>
  )
}

/**
 * Ringkasan Penjualan di Beranda kedua portal (revisi V5, butir 4A, mockup
 * yang disetujui Ilham): tiga petak berikon dengan chip naik atau turun
 * dibanding periode sebelumnya yang sama panjang, lalu batang per hari.
 */
export function KartuRingkasanPenjualan({
  ambil,
  ke,
  className,
}: {
  ambil: () => Promise<RingkasanPenjualan>
  ke: string
  className?: string
}) {
  const [data, setData] = useState<RingkasanPenjualan | null>(null)
  const [gagal, setGagal] = useState(false)

  useEffect(() => {
    let batal = false
    ambil()
      .then((r) => !batal && setData(r))
      .catch(() => !batal && setGagal(true))
    return () => {
      batal = true
    }
  }, [ambil])

  const istilah = data ? ISTILAH[data.sumber] : null
  const panjang = data ? Math.round((+tanggalLokal(data.sampai) - +tanggalLokal(data.dari)) / 86_400_000) + 1 : 30
  const rataLalu = data && data.pembandingJumlah > 0 ? data.pembandingTotal / data.pembandingJumlah : 0

  return (
    <Bagian
      id="judul-ringkasan-penjualan"
      judul="Ringkasan Penjualan"
      besar
      keterangan={
        data
          ? `${panjang} hari sampai ${tanggalPendek(tanggalLokal(data.sampai))}, tanggal data terakhir${
              data.jumlahPihak != null && istilah?.pihak ? ` · ${angka(data.jumlahPihak)} ${istilah.pihak}` : ''
            }`
          : 'Dari data penjualan yang tersimpan.'
      }
      aksi={
        <Link to={ke} className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline">
          Lihat ringkasan
          <IkonPanahKanan size={15} />
        </Link>
      }
      className={className}
    >
      {gagal ? (
        <p className="text-isi text-ink-3">Ringkasan belum bisa dimuat. Buka halamannya untuk mencoba lagi.</p>
      ) : !data || !istilah ? (
        <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Kerangka key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-3 [&>*]:min-w-0">
            {[
              { label: istilah.total, nilai: rupiahRingkas(data.total), Ikon: IkonUang, sekarang: data.total, lalu: data.pembandingTotal },
              {
                label: `Jumlah ${istilah.transaksi}`,
                nilai: angka(data.jumlahTransaksi),
                Ikon: IkonNota,
                sekarang: data.jumlahTransaksi,
                lalu: data.pembandingJumlah,
              },
              {
                label: `Rata-rata per ${istilah.transaksi}`,
                nilai: rupiahRingkas(data.rataRata),
                Ikon: IkonGrafik,
                sekarang: data.rataRata,
                lalu: rataLalu,
              },
            ].map((p) => (
              // HP: kepala dan angka sebaris, chip di bawahnya. Desktop: bertumpuk.
              <li
                key={p.label}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface-2 px-3.5 py-3 sm:block sm:p-4"
              >
                <p className="flex items-center gap-2.5 min-w-0">
                  <span className="size-10 shrink-0 rounded-full bg-brand-soft text-brand grid place-items-center">
                    <p.Ikon size={20} />
                  </span>
                  <span className="text-isi font-semibold text-ink-2 leading-snug">{p.label}</span>
                </p>
                <p className="text-right sm:text-left sm:mt-3 text-angka font-extrabold text-ink tracking-tight">{p.nilai}</p>
                <div className="col-span-2 sm:mt-2.5">
                  <ChipBanding sekarang={p.sekarang} lalu={p.lalu} hari={panjang} />
                </div>
              </li>
            ))}
          </ul>

          {data.perHari.length > 1 && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-isi font-bold text-ink">Penjualan per hari</span>
                <span className="text-kecil text-ink-3">batang tertinggi diberi angka</span>
              </p>
              <BatangPerHari perHari={data.perHari} />
            </div>
          )}
        </>
      )}
    </Bagian>
  )
}
