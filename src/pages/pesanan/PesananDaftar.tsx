import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KartuPesanan, KuotaBulanIni, TombolTerkunci, useTerkunci } from '@/components/domain'
import {
  HanyaPembacaLayar,
  Lencana,
  Tombol,
  TombolTautan,
  type NadaLencana,
} from '@/components/ui/dasar'
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
import type { Kontrak, Pesanan } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Tab Pesanan: dua segmen, dan tidak satu pun menampilkan katalog.
 *
 * Catatan pemilik proyek meminta penggabungan. Pesanan yang masih draf, yang
 * sedang berjalan, dan yang sudah selesai tinggal di satu segmen; kontrak yang
 * belum dan sudah selesai juga jadi satu. Statusnya tidak hilang, ia cuma
 * turun satu tingkat jadi baris chip penyaring yang hidup di query string.
 * Dengan begitu pertanyaan "pesanan saya sudah dikirim belum" tetap selesai
 * dalam satu ketukan, tanpa memaksa siapa pun menebak jawabannya ada di tab
 * yang mana.
 *
 * Katalog tinggal di tab Distributor.
 *
 * Segmen Kontrak dikelompokkan per BARANG secara bawaan karena satu kontrak
 * mengikat tepat satu barang. Pengelompokan per pemasok hanya mengubah susunan
 * kartu yang sama, bukan membuka layar baru, supaya tidak ada yang mengira
 * kontraknya digabung jadi satu perjanjian.
 */

type Tab = 'pesanan' | 'kontrak'
type SaringPesanan = 'semua' | 'berjalan' | 'selesai'
type SaringKontrak = 'semua' | 'berjalan' | 'akan-berakhir' | 'selesai'
type Kelompok = 'barang' | 'pemasok'

const SARING_PESANAN: readonly SaringPesanan[] = ['semua', 'berjalan', 'selesai']
const SARING_KONTRAK: readonly SaringKontrak[] = ['semua', 'berjalan', 'akan-berakhir', 'selesai']

const LABEL_SARING_PESANAN: Record<SaringPesanan, string> = {
  semua: 'Semua',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
}

const LABEL_SARING_KONTRAK: Record<SaringKontrak, string> = {
  semua: 'Semua',
  berjalan: 'Berjalan',
  'akan-berakhir': 'Akan berakhir',
  selesai: 'Selesai',
}

/** Dipakai untuk merangkai kalimat hitungan: "3 kontrak berjalan". */
const KATA_KONTRAK: Record<SaringKontrak, string> = {
  semua: 'kontrak',
  berjalan: 'kontrak berjalan',
  'akan-berakhir': 'kontrak akan berakhir',
  selesai: 'kontrak selesai',
}

const NADA_KONTRAK: Record<Kontrak['status'], NadaLencana> = {
  'menunggu-persetujuan': 'netral',
  aktif: 'merek',
  'akan-berakhir': 'menipis',
  selesai: 'netral',
  dihentikan: 'netral',
  ditolak: 'netral',
}

function sisaKuota(k: Kontrak): number {
  return Math.max(0, k.periodeBerjalan.kuota - k.periodeBerjalan.diterima - k.dalamPerjalanan)
}

/** Kontrak yang kuotanya masih bisa dikejar bulan ini. */
function masihBerjalan(k: Kontrak): boolean {
  return k.status === 'aktif' || k.status === 'akan-berakhir'
}

function sudahSelesai(k: Kontrak): boolean {
  return k.status === 'selesai' || k.status === 'dihentikan' || k.status === 'ditolak'
}

/**
 * Kontrak yang masih "menunggu-persetujuan" ikut penyaring Berjalan.
 * Dari sisi pemilik usaha ia jelas belum selesai, dan lencana di kartunya
 * sudah menyebut sendiri bahwa distributor belum menyetujui. Kalau tidak
 * dimasukkan ke sini, ia hanya muncul di Semua dan gampang terlewat.
 */
function cocokKontrak(k: Kontrak, saring: SaringKontrak): boolean {
  switch (saring) {
    case 'berjalan':
      return k.status === 'aktif' || k.status === 'menunggu-persetujuan'
    case 'akan-berakhir':
      return k.status === 'akan-berakhir'
    case 'selesai':
      return sudahSelesai(k)
    default:
      return true
  }
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

/** Menerima nilai query hanya kalau ia memang salah satu pilihan yang ada. */
function pilihSah<T extends string>(pilihan: readonly T[], nilai: string | null): T | null {
  return nilai != null && (pilihan as readonly string[]).includes(nilai) ? (nilai as T) : null
}

/**
 * Menerjemahkan query string jadi keadaan layar, termasuk menghidupkan
 * kembali alamat dari susunan lama.
 *
 * Dulu layar ini punya tiga segmen dan menuliskannya di `?tab=`: `berjalan`,
 * `kontrak`, `selesai`. Tautan ke bentuk itu masih tersebar di layar lain
 * (Detail Pesanan, Beri Penilaian, Beranda, Periksa Kesepakatan, Mitra), dan
 * tautan yang mendarat di tab yang salah lebih buruk daripada tautan yang
 * mati, sebab tidak ada yang sadar ia salah. Jadi nilai lama tetap dikenali
 * dan dipetakan, bukan dibuang:
 *
 *   ?tab=berjalan  ->  ?tab=pesanan&status=berjalan
 *   ?tab=selesai   ->  ?tab=pesanan&status=selesai
 *   ?tab=kontrak   ->  tetap, sekarang dengan penyaring status sendiri
 *
 * Pemetaan ini boleh dihapus kalau suatu hari semua tautan lama sudah
 * ditulis ulang, tidak sebelum itu.
 */
function bacaAlamat(params: URLSearchParams): {
  tab: Tab
  saringPesanan: SaringPesanan
  saringKontrak: SaringKontrak
  kelompok: Kelompok
} {
  const tabMentah = params.get('tab')
  const warisan: SaringPesanan | null =
    tabMentah === 'berjalan' || tabMentah === 'selesai' ? tabMentah : null
  const status = params.get('status')

  return {
    tab: tabMentah === 'kontrak' ? 'kontrak' : 'pesanan',
    saringPesanan: warisan ?? pilihSah(SARING_PESANAN, status) ?? 'semua',
    saringKontrak: pilihSah(SARING_KONTRAK, status) ?? 'semua',
    kelompok: params.get('kelompok') === 'pemasok' ? 'pemasok' : 'barang',
  }
}

export default function PesananDaftar() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const terkunci = useTerkunci()

  const pesanan = useAplikasi((s) => s.pesanan)
  const kontrak = useAplikasi((s) => s.kontrak)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const { tab, saringPesanan, saringKontrak, kelompok } = bacaAlamat(params)

  const berjalan = useMemo(() => pesanan.filter((p) => PESANAN_BERJALAN.includes(p.status)), [pesanan])
  const selesai = useMemo(() => pesanan.filter((p) => !PESANAN_BERJALAN.includes(p.status)), [pesanan])

  /* Kelompok pesanan dihitung lebih dulu supaya keadaan kosong, sub-judul, dan
     daftar kartunya membaca sumber yang sama - tidak ada peluang salah satu
     bilang kosong sementara yang lain menggambar kartu. */
  const kelompokPesanan = useMemo(() => {
    const semua = [
      { kunci: 'berjalan' as const, judul: 'Sedang berjalan', daftar: berjalan },
      { kunci: 'selesai' as const, judul: 'Sudah selesai', daftar: selesai },
    ]
    if (saringPesanan === 'semua') return semua.filter((k) => k.daftar.length > 0)
    return semua.filter((k) => k.kunci === saringPesanan)
  }, [berjalan, selesai, saringPesanan])

  const jumlahPesananTerlihat = kelompokPesanan.reduce((a, k) => a + k.daftar.length, 0)

  const kontrakBerjalan = useMemo(() => kontrak.filter(masihBerjalan), [kontrak])
  const kontrakTerlihat = useMemo(
    () => kontrak.filter((k) => cocokKontrak(k, saringKontrak)),
    [kontrak, saringKontrak],
  )

  /* Pengelompokan dihitung ulang tiap penyaring berganti, tapi tetap dari data
     yang sudah ada di memori: menekan sakelar terasa seketika, tidak ada
     pemuatan ulang, hanya susunan kartu yang berganti. */
  const grup = useMemo(() => {
    const kunci = (k: Kontrak) => (kelompok === 'barang' ? k.barangId : k.distributorId)
    const peta = new Map<string, Kontrak[]>()
    for (const k of kontrakTerlihat) {
      const kk = kunci(k)
      peta.set(kk, [...(peta.get(kk) ?? []), k])
    }
    return Array.from(peta.entries()).map(([id, daftar]) => ({
      id,
      judul: kelompok === 'barang' ? daftar[0].namaBarang : (distributorById(id)?.nama ?? 'Distributor'),
      daftar,
      berjalan: daftar.filter(masihBerjalan),
    }))
  }, [kontrakTerlihat, kelompok])

  /* Penyaring sengaja tidak dibawa pindah antar tab: kosakatanya berbeda
     ("akan berakhir" tidak ada di sisi pesanan), dan memilihkan penyaring
     diam-diam di tab yang baru dibuka lebih membingungkan daripada memulai
     dari Semua. */
  function gantiTab(nilai: Tab) {
    const baru = new URLSearchParams(params)
    baru.set('tab', nilai)
    baru.delete('status')
    setParams(baru, { replace: true })
  }

  /* `tab` ikut ditulis ulang supaya alamat warisan (?tab=selesai) tidak
     tertinggal di URL dan menimpa penyaring yang baru saja dipilih. */
  function gantiSaring(nilai: SaringPesanan | SaringKontrak) {
    const baru = new URLSearchParams(params)
    baru.set('tab', tab)
    baru.set('status', nilai)
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
   *
   * Daftarnya diambil dari kelompok yang sedang tampil, bukan dari seluruh
   * kontrak distributor itu: tombol tidak boleh memesan barang yang tidak
   * kelihatan di layar saat tombolnya ditekan.
   */
  function pesanSekaligus(distributorId: string, daftar: Kontrak[]) {
    const nama = distributorById(distributorId)?.nama ?? 'distributor ini'
    let dimasukkan = 0
    for (const k of daftar) {
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
          Cari barang di Distributor
        </Link>
      </div>
      {/* Baris prosa ditahan sekitar 70 karakter: di layar lebar kalimat yang
          membentang penuh justru lebih sulit dikejar matanya. */}
      <p className="mt-1 text-[0.8125rem] text-ink-3 leading-snug max-w-[70ch]">
        Semua pesanan dan kontrak bulananmu, dari yang masih berjalan sampai yang sudah selesai.
      </p>

      <TabSegmen<Tab>
        className="mt-4"
        aktif={tab}
        ubah={gantiTab}
        tab={[
          /* Angka di lencana tab sengaja menghitung yang masih berjalan saja,
             bukan seluruh isi tab: yang perlu dipantau itu yang belum kelar. */
          { nilai: 'pesanan', label: 'Pesanan', jumlah: berjalan.length },
          { nilai: 'kontrak', label: 'Kontrak', jumlah: kontrakBerjalan.length },
        ]}
      />

      {/* Baris chip penyaring. Ia menggulir di dalam wadahnya sendiri, jadi di
          360px badan halaman tetap diam meski chipnya tidak muat. */}
      {tab === 'pesanan' ? (
        <BarisChip className="mt-3">
          {SARING_PESANAN.map((s) => (
            <Chip key={s} aktif={saringPesanan === s} onClick={() => gantiSaring(s)}>
              {LABEL_SARING_PESANAN[s]}
              <span className="tabular font-bold">
                {s === 'semua' ? pesanan.length : s === 'berjalan' ? berjalan.length : selesai.length}
              </span>
              <HanyaPembacaLayar>pesanan</HanyaPembacaLayar>
            </Chip>
          ))}
        </BarisChip>
      ) : (
        <BarisChip className="mt-3">
          {SARING_KONTRAK.map((s) => (
            <Chip key={s} aktif={saringKontrak === s} onClick={() => gantiSaring(s)}>
              {LABEL_SARING_KONTRAK[s]}
              <span className="tabular font-bold">
                {kontrak.filter((k) => cocokKontrak(k, s)).length}
              </span>
              <HanyaPembacaLayar>kontrak</HanyaPembacaLayar>
            </Chip>
          ))}
        </BarisChip>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Segmen Pesanan                                             */}
      {/* ---------------------------------------------------------- */}
      {tab === 'pesanan' && (
        <section aria-labelledby="judul-segmen-pesanan" className="mt-4">
          <h2 id="judul-segmen-pesanan" className="sr-only">
            {saringPesanan === 'berjalan'
              ? 'Pesanan yang sedang berjalan'
              : saringPesanan === 'selesai'
                ? 'Pesanan yang sudah selesai'
                : 'Semua pesanan'}
          </h2>

          {jumlahPesananTerlihat === 0 ? (
            <KosongPesanan saring={saringPesanan} />
          ) : (
            <div className="space-y-6">
              {kelompokPesanan.map((k) => (
                <div key={k.kunci}>
                  {/* Sub-judul hanya perlu saat dua kelompok berdiri
                      bersebelahan. Kalau chipnya sudah memilih satu kelompok,
                      judulnya cuma mengulang bunyi chip yang sedang menyala. */}
                  {saringPesanan === 'semua' && (
                    <h3 className="text-[0.9375rem] font-bold text-ink mb-2">
                      {k.judul} ({angka(k.daftar.length)})
                    </h3>
                  )}
                  <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0">
                    {k.daftar.map((p: Pesanan) => (
                      <KartuPesanan key={p.id} pesanan={p} />
                    ))}
                  </div>
                </div>
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
            Daftar {KATA_KONTRAK[saringKontrak]}
          </h2>
          {kontrakTerlihat.length === 0 ? (
            <KosongKontrak saring={saringKontrak} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.9375rem] font-bold text-ink">
                  {angka(kontrakTerlihat.length)} {KATA_KONTRAK[saringKontrak]}
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
                            {g.judul} &mdash; {angka(g.daftar.length)} {KATA_KONTRAK[saringKontrak]}
                          </h3>
                          {/* Kewajiban bulanan hanya dihitung dari kontrak yang
                              masih berjalan. Menjumlahkan kontrak yang sudah
                              selesai bikin angkanya menagih sesuatu yang sudah
                              tidak ditagih siapa-siapa. */}
                          {g.berjalan.length > 0 && (
                            <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                              Kewajiban kontrak: <strong className="text-ink">{kewajibanBulanan(g.berjalan)}</strong>
                              /bulan
                              {g.berjalan.length > 1 && ` dari ${g.berjalan.length} kontrak berjalan`}
                            </p>
                          )}
                        </div>

                        {/* Label tombol menyebut nama distributor lengkap, jadi di layar
                            360px barisnya digeser di dalam wadahnya sendiri — badan
                            halaman tidak boleh ikut bergeser. */}
                        {distributor && (
                          <div className="flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar py-1 lg:overflow-visible">
                            {/* Tidak ada gunanya menawarkan "pesan sekaligus" untuk
                                kelompok yang semua kontraknya sudah selesai. */}
                            {g.berjalan.length > 0 &&
                              (terkunci ? (
                                <TombolTerkunci label={`Pesan sekaligus ke ${distributor.nama}`} />
                              ) : (
                                <Tombol
                                  ukuran="kecil"
                                  className="shrink-0"
                                  ikonKiri={<IkonKeranjang size={15} />}
                                  onClick={() => pesanSekaligus(distributor.id, g.berjalan)}
                                >
                                  Pesan sekaligus ke {distributor.nama}
                                </Tombol>
                              ))}
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
    </div>
  )
}

/* ================================================================== */
/* Keadaan kosong                                                     */
/* ================================================================== */

/**
 * Tiap penyaring punya kalimatnya sendiri. Satu kalimat umum untuk semua
 * keadaan terdengar seperti sistemnya tidak tahu apa yang barusan diminta.
 */
function KosongPesanan({ saring }: { saring: SaringPesanan }) {
  if (saring === 'berjalan') {
    return (
      <KeadaanKosong
        ikon={<IkonPasokan size={26} />}
        judul="Belum ada pesanan berjalan"
        pesan="Semua pesananmu sudah selesai. Kalau ada stok yang mulai menipis, mulai dari Distributor untuk memilih pemasoknya."
        aksi={<TombolTautan ke="/belanja">Cari Barang di Distributor</TombolTautan>}
        aksiKedua={
          <TombolTautan ke="/pesanan?tab=pesanan&status=selesai" ragam="garis">
            Lihat Pesanan Selesai
          </TombolTautan>
        }
      />
    )
  }

  if (saring === 'selesai') {
    return (
      <KeadaanKosong
        ikon={<IkonCentangLingkaran size={26} />}
        judul="Belum ada pesanan yang selesai"
        pesan="Pesanan pindah ke sini setelah kamu menekan Barang Sudah Sampai dan mencatat jumlah yang diterima."
        aksi={
          <TombolTautan ke="/pesanan?tab=pesanan&status=berjalan">Lihat Pesanan Berjalan</TombolTautan>
        }
      />
    )
  }

  return (
    <KeadaanKosong
      ikon={<IkonPasokan size={26} />}
      judul="Belum ada pesanan sama sekali"
      pesan="Pesanan muncul di sini begitu kamu mengirim keranjang. Kalau ada stok yang mulai menipis, mulai dari Distributor untuk memilih pemasoknya."
      aksi={<TombolTautan ke="/belanja">Cari Barang di Distributor</TombolTautan>}
    />
  )
}

function KosongKontrak({ saring }: { saring: SaringKontrak }) {
  if (saring === 'akan-berakhir') {
    return (
      <KeadaanKosong
        ikon={<IkonKontrak size={26} />}
        judul="Tidak ada kontrak yang akan berakhir"
        pesan="Semua kontrakmu masih punya sisa waktu. Kontrak pindah ke sini kalau masa berlakunya tinggal sebentar lagi."
        aksi={<TombolTautan ke="/pesanan?tab=kontrak&status=semua">Lihat Semua Kontrak</TombolTautan>}
      />
    )
  }

  if (saring === 'selesai') {
    return (
      <KeadaanKosong
        ikon={<IkonKontrak size={26} />}
        judul="Belum ada kontrak yang selesai"
        pesan="Kontrak pindah ke sini setelah masa berlakunya habis atau dihentikan. Isinya tetap bisa kamu buka sebagai catatan."
        aksi={
          <TombolTautan ke="/pesanan?tab=kontrak&status=berjalan">Lihat Kontrak Berjalan</TombolTautan>
        }
      />
    )
  }

  return (
    <KeadaanKosong
      ikon={<IkonKontrak size={26} />}
      judul={saring === 'berjalan' ? 'Belum ada kontrak berjalan' : 'Belum ada kontrak'}
      pesan="Kontrak mengunci harga dan jumlah minimal tiap bulan. Kamu bisa mengajukannya dari halaman penawaran distributor."
      aksi={<TombolTautan ke="/belanja">Lihat Penawaran Distributor</TombolTautan>}
    />
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
  const berakhir = sudahSelesai(kontrak)

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
            {kontrak.durasiBulan} bulan
            {/* Tanggalnya tidak diulang untuk kontrak yang sudah berakhir:
                barisnya sudah disebut di bawah, lengkap dengan konteksnya. */}
            {!berakhir && <> &middot; sampai {tanggalPendek(kontrak.berakhir)}</>}
          </p>
        </div>
        <Lencana nada={NADA_KONTRAK[kontrak.status]}>{LABEL_KONTRAK[kontrak.status]}</Lencana>
      </div>

      {/* Kuota Bulan Ini tidak tahu kontraknya sudah berakhir - ia selalu
          menghitung periode berjalan dan mengajak mengejar kekurangan. Untuk
          kontrak yang sudah selesai ajakan itu keliru, jadi barnya diganti
          satu baris ringkas yang menyatakan kapan kontraknya berakhir. */}
      {berakhir ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
          <IkonKontrak size={15} className="shrink-0 text-ink-3" />
          {kontrak.status === 'dihentikan' ? 'Kontrak dihentikan' : 'Kontrak selesai'}{' '}
          {tanggalPendek(kontrak.berakhir)}
        </p>
      ) : (
        <>
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
        </>
      )}
    </Link>
  )
}
