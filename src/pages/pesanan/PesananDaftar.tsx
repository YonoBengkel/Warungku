import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KartuPesanan, KuotaBulanIni, TombolTerkunci, useTerkunci } from '@/components/domain'
import { Lencana, Tombol, TombolTautan, type NadaLencana } from '@/components/ui/dasar'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { BarisChip, Chip, TabSegmen } from '@/components/ui/navigasi'
import {
  IkonCentangLingkaran,
  IkonKeranjang,
  IkonKontrak,
  IkonPanahKanan,
  IkonPasokan,
  IkonToko,
} from '@/icons'
import { angka, tanggalPendek } from '@/lib/format'
import { BANTUAN, LABEL_KONTRAK, PESANAN_BERJALAN } from '@/lib/label'
import { distributorById } from '@/data/dummy'
import type { Kontrak } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Tab Pesanan: tiga segmen, dan tidak satu pun menampilkan katalog.
 *
 * Pemisahan ini yang membuat pertanyaan "pesanan saya sudah dikirim belum"
 * selesai dalam satu ketukan. Katalog tinggal di tab Belanja.
 *
 * Segmen Kontrak dikelompokkan per BARANG secara bawaan karena satu kontrak
 * mengikat tepat satu barang. Pengelompokan per pemasok hanya mengubah susunan
 * kartu yang sama, bukan membuka layar baru, supaya tidak ada yang mengira
 * kontraknya digabung jadi satu perjanjian.
 */

type Segmen = 'berjalan' | 'kontrak' | 'selesai'
type Kelompok = 'barang' | 'pemasok'

const NADA_KONTRAK: Record<Kontrak['status'], NadaLencana> = {
  'menunggu-persetujuan': 'netral',
  aktif: 'merek',
  'akan-berakhir': 'menipis',
  selesai: 'netral',
  dihentikan: 'netral',
}

function sisaKuota(k: Kontrak): number {
  return Math.max(0, k.periodeBerjalan.kuota - k.periodeBerjalan.diterima - k.dalamPerjalanan)
}

/** Kuota dijumlahkan per satuan, karena 30 kg dan 10 dus tidak boleh dijadikan satu angka. */
function kewajibanBulanan(daftar: Kontrak[]): string {
  const perSatuan = new Map<string, number>()
  for (const k of daftar) {
    perSatuan.set(k.satuan, (perSatuan.get(k.satuan) ?? 0) + k.kuotaMinPerBulan)
  }
  return Array.from(perSatuan.entries())
    .map(([satuan, jumlah]) => `${angka(jumlah)} ${satuan}`)
    .join(' + ')
}

export default function PesananDaftar() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const terkunci = useTerkunci()

  const pesanan = useAplikasi((s) => s.pesanan)
  const kontrak = useAplikasi((s) => s.kontrak)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const tabMentah = params.get('tab')
  const tab: Segmen = tabMentah === 'kontrak' || tabMentah === 'selesai' ? tabMentah : 'berjalan'
  const kelompok: Kelompok = params.get('kelompok') === 'pemasok' ? 'pemasok' : 'barang'

  const berjalan = useMemo(() => pesanan.filter((p) => PESANAN_BERJALAN.includes(p.status)), [pesanan])
  const selesai = useMemo(
    () => pesanan.filter((p) => !PESANAN_BERJALAN.includes(p.status)),
    [pesanan],
  )
  const kontrakBerjalan = useMemo(
    () => kontrak.filter((k) => k.status === 'aktif' || k.status === 'akan-berakhir'),
    [kontrak],
  )

  /* Pengelompokan dihitung dua-duanya sekaligus supaya menekan toggle terasa
     seketika: tidak ada pemuatan ulang, hanya susunan kartu yang berganti. */
  const grup = useMemo(() => {
    const kunci = (k: Kontrak) => (kelompok === 'barang' ? k.barangId : k.distributorId)
    const peta = new Map<string, Kontrak[]>()
    for (const k of kontrakBerjalan) {
      const kk = kunci(k)
      peta.set(kk, [...(peta.get(kk) ?? []), k])
    }
    return Array.from(peta.entries()).map(([id, daftar]) => ({
      id,
      judul: kelompok === 'barang' ? daftar[0].namaBarang : (distributorById(id)?.nama ?? 'Distributor'),
      daftar,
    }))
  }, [kontrakBerjalan, kelompok])

  function gantiTab(nilai: Segmen) {
    const baru = new URLSearchParams(params)
    baru.set('tab', nilai)
    setParams(baru, { replace: true })
  }

  function gantiKelompok(nilai: Kelompok) {
    const baru = new URLSearchParams(params)
    baru.set('tab', 'kontrak')
    baru.set('kelompok', nilai)
    setParams(baru, { replace: true })
  }

  /**
   * Mengisi SATU sub-keranjang milik distributor itu dengan sisa kuota tiap
   * kontraknya. Kontrak yang kuotanya sudah terpenuhi sengaja dilewati, bukan
   * dimasukkan sebagai nol, supaya keranjang tidak berisi baris kosong.
   */
  function pesanSekaligus(distributorId: string) {
    const nama = distributorById(distributorId)?.nama ?? 'distributor ini'
    const aktif = kontrakBerjalan.filter((k) => k.distributorId === distributorId)
    let dimasukkan = 0
    for (const k of aktif) {
      const sisa = sisaKuota(k)
      if (sisa <= 0) continue
      tambahKeKeranjang(k.distributorId, k.penawaranId, sisa, sisa, k.id)
      dimasukkan += 1
    }
    if (dimasukkan === 0) {
      tampilkanRacun(`Kuota semua kontrak ${nama} bulan ini sudah terpenuhi.`, 'info')
      return
    }
    tampilkanRacun(`${dimasukkan} barang masuk keranjang ${nama}. Periksa dulu sebelum dikirim.`, 'aman')
    navigate('/keranjang')
  }

  return (
    <div className="pb-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Pesanan</h1>
        <Link to="/belanja" className="text-[0.8125rem] font-bold text-brand hover:underline shrink-0">
          Cari barang di Belanja
        </Link>
      </div>
      {/* Baris prosa ditahan sekitar 70 karakter: di layar lebar kalimat yang
          membentang penuh justru lebih sulit dikejar matanya. */}
      <p className="mt-1 text-[0.8125rem] text-ink-3 leading-snug max-w-[70ch]">
        Pesanan yang sedang berjalan, kontrak bulanan, dan riwayat yang sudah selesai.
      </p>

      <TabSegmen<Segmen>
        className="mt-4"
        aktif={tab}
        ubah={gantiTab}
        tab={[
          { nilai: 'berjalan', label: 'Berjalan', jumlah: berjalan.length },
          { nilai: 'kontrak', label: 'Kontrak' },
          { nilai: 'selesai', label: 'Selesai' },
        ]}
      />

      {/* ---------------------------------------------------------- */}
      {/* Segmen Berjalan                                            */}
      {/* ---------------------------------------------------------- */}
      {tab === 'berjalan' && (
        <section aria-labelledby="judul-berjalan" className="mt-4">
          <h2 id="judul-berjalan" className="sr-only">
            Pesanan berjalan
          </h2>
          {berjalan.length === 0 ? (
            <KeadaanKosong
              ikon={<IkonPasokan size={26} />}
              judul="Belum ada pesanan berjalan"
              pesan="Semua pesananmu sudah selesai. Kalau ada stok yang mulai menipis, mulai dari Belanja untuk memilih distributor."
              aksi={<TombolTautan ke="/belanja">Cari Barang di Belanja</TombolTautan>}
              aksiKedua={
                <TombolTautan ke="/pesanan?tab=selesai" ragam="garis">
                  Lihat Pesanan Selesai
                </TombolTautan>
              }
            />
          ) : (
            <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0">
              {berjalan.map((p) => (
                <KartuPesanan key={p.id} pesanan={p} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Segmen Kontrak                                             */}
      {/* ---------------------------------------------------------- */}
      {tab === 'kontrak' && (
        <section aria-labelledby="judul-segmen-kontrak" className="mt-4">
          <h2 id="judul-segmen-kontrak" className="sr-only">
            Kontrak berjalan
          </h2>
          {kontrakBerjalan.length === 0 ? (
            <KeadaanKosong
              ikon={<IkonKontrak size={26} />}
              judul="Belum ada kontrak berjalan"
              pesan="Kontrak mengunci harga dan jumlah minimal tiap bulan. Kamu bisa mengajukannya dari halaman penawaran distributor."
              aksi={<TombolTautan ke="/belanja">Lihat Penawaran Distributor</TombolTautan>}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.9375rem] font-bold text-ink">
                  {kontrakBerjalan.length} kontrak berjalan
                </p>
                <BarisChip className="sm:justify-end">
                  <Chip aktif={kelompok === 'barang'} onClick={() => gantiKelompok('barang')}>
                    Per barang
                  </Chip>
                  <Chip aktif={kelompok === 'pemasok'} onClick={() => gantiKelompok('pemasok')}>
                    Per pemasok
                  </Chip>
                </BarisChip>
              </div>
              <p className="mt-1 text-[0.8125rem] text-ink-3 max-w-[70ch]">{BANTUAN.satuKontrakSatuBarang}</p>

              <div className="mt-4 space-y-6">
                {grup.map((g) => {
                  const distributor = kelompok === 'pemasok' ? distributorById(g.id) : null
                  return (
                    <div key={g.id}>
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0">
                          <h3 className="text-[0.9375rem] font-bold text-ink leading-snug">
                            {g.judul} &mdash; {g.daftar.length} kontrak berjalan
                          </h3>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                            Kewajiban kontrak: <strong className="text-ink">{kewajibanBulanan(g.daftar)}</strong>
                            /bulan
                            {g.daftar.length > 1 && ` dari ${g.daftar.length} kontrak`}
                          </p>
                        </div>

                        {/* Label tombol menyebut nama distributor lengkap, jadi di layar
                            360px barisnya digeser di dalam wadahnya sendiri — badan
                            halaman tidak boleh ikut bergeser. */}
                        {distributor && (
                          <div className="flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar py-1 lg:overflow-visible">
                            {terkunci ? (
                              <TombolTerkunci label={`Pesan sekaligus ke ${distributor.nama}`} />
                            ) : (
                              <Tombol
                                ukuran="kecil"
                                className="shrink-0"
                                ikonKiri={<IkonKeranjang size={15} />}
                                onClick={() => pesanSekaligus(distributor.id)}
                              >
                                Pesan sekaligus ke {distributor.nama}
                              </Tombol>
                            )}
                            <TombolTautan
                              ke={`/mitra/${distributor.id}`}
                              ragam="garis"
                              ukuran="kecil"
                              className="shrink-0"
                              ikonKanan={<IkonPanahKanan size={15} />}
                            >
                              Lihat kerja sama
                            </TombolTautan>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                        {g.daftar.map((k) => (
                          <KartuKontrak key={k.id} kontrak={k} tampilkanDistributor={kelompok === 'barang'} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Segmen Selesai                                             */}
      {/* ---------------------------------------------------------- */}
      {tab === 'selesai' && (
        <section aria-labelledby="judul-selesai" className="mt-4">
          <h2 id="judul-selesai" className="sr-only">
            Pesanan selesai
          </h2>
          {selesai.length === 0 ? (
            <KeadaanKosong
              ikon={<IkonCentangLingkaran size={26} />}
              judul="Belum ada pesanan yang selesai"
              pesan="Pesanan pindah ke sini setelah kamu menekan Barang Sudah Sampai dan mencatat jumlah yang diterima."
              aksi={<TombolTautan ke="/pesanan">Lihat Pesanan Berjalan</TombolTautan>}
            />
          ) : (
            <>
              <p className="text-[0.8125rem] text-ink-3 mb-3 max-w-[70ch]">
                {selesai.length} pesanan. Ketuk salah satu untuk melihat rincian dan memberi penilaian.
              </p>
              <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0">
                {selesai.map((p) => (
                  <KartuPesanan key={p.id} pesanan={p} />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

/* ================================================================== */
/* Kartu kontrak                                                      */
/* ================================================================== */

/**
 * Judulnya NAMA BARANG, bukan kode paket. Nama distributor turun jadi baris
 * kedua yang kecil, karena yang dicari pemilik usaha saat membuka daftar ini
 * adalah "kopi saya bagaimana", bukan "pemasok nomor berapa".
 */
function KartuKontrak({ kontrak, tampilkanDistributor }: { kontrak: Kontrak; tampilkanDistributor: boolean }) {
  const distributor = distributorById(kontrak.distributorId)
  const sisa = sisaKuota(kontrak)

  return (
    <Link
      to={`/kontrak/${kontrak.id}`}
      className="block bg-surface border border-line rounded-lg p-4 shadow-e1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2 active:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1.0625rem] font-bold text-ink leading-snug">{kontrak.namaBarang}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
            {tampilkanDistributor && (
              <span className="inline-flex items-center gap-1 align-middle">
                <IkonToko size={13} />
                {distributor?.nama} &middot;{' '}
              </span>
            )}
            {kontrak.durasiBulan} bulan &middot; sampai {tanggalPendek(kontrak.berakhir)}
          </p>
        </div>
        <Lencana nada={NADA_KONTRAK[kontrak.status]}>{LABEL_KONTRAK[kontrak.status]}</Lencana>
      </div>

      <div className="mt-3">
        <KuotaBulanIni kontrak={kontrak} ringkas />
      </div>

      <p className="mt-2 text-[0.8125rem] text-ink-2">
        {sisa > 0 ? (
          <>
            Kurang{' '}
            <strong className="text-ink tabular">
              {angka(sisa)} {kontrak.satuan}
            </strong>{' '}
            bulan ini
          </>
        ) : (
          'Kuota bulan ini sudah terpenuhi.'
        )}
      </p>
    </Link>
  )
}
