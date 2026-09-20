import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { JudulBagian, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { KepalaHalaman, TabSegmen } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonCentangLingkaran,
  IkonJam,
  IkonKotak,
  IkonNota,
  IkonPanahKanan,
  IkonPena,
  IkonPeringatan,
  IkonSinkron,
  IkonTanpaSinyal,
} from '@/icons'
import {
  angka,
  cx,
  inisial,
  jam,
  jumlahSatuan,
  tanggalPendek,
  tanggalRingkas,
  waktuLalu,
} from '@/lib/format'
import { JUDUL } from '@/lib/label'
import type { Barang, RiwayatKasir } from '@/lib/types'
import { POS_TUNGGAL, daftarTransaksi, riwayatKasir } from '@/data/dummy'
import { KartuStruk } from '@/components/domain/KartuStruk'
import { useAplikasi } from '@/store/aplikasi'

type Tab = 'sambungan' | 'beres' | 'riwayat'
/** Tugas yang tidak berasal dari daftar menu, jadi keadaannya dipegang layar ini. */
type TugasLain = 'salinan' | 'satuan'

/** Penjualan kembar yang sudah diabaikan sistem. Contoh tetap, dari data purwarupa. */
const PENJUALAN_KEMBAR = { jam: '12.40', jumlah: 2 }

/**
 * Satu komponen, dua kerangka.
 *
 * Dengan ?langkah=mulai ia adalah langkah onboarding: bar progres, satu
 * pertanyaan, dan jalan keluar berupa teks. Tanpa itu ia adalah halaman
 * pengaturan bertab. Isinya sengaja sama persis supaya pengguna yang melewati
 * langkah ini saat mendaftar menemukan layar yang ia kenali saat kembali.
 */
export default function AkunKasir() {
  const [params, setParams] = useSearchParams()
  const kasir = useAplikasi((s) => s.kasir)
  const barang = useAplikasi((s) => s.barang)

  /* Dipegang di sini, bukan di dalam tab, supaya tugas yang sudah dibereskan
     tidak muncul lagi setiap pengguna berpindah tab. */
  const [tugasBeres, setTugasBeres] = useState<TugasLain[]>([])

  const onboarding = params.get('langkah') === 'mulai'
  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'beres' || tabParam === 'riwayat' ? tabParam : 'sambungan'

  /* Bahan yang satuannya tidak sama dengan cara kasir menghitung porsi. */
  const bahanPorsi = barang.find((b) => b.satuan === 'gram' && !b.dicatatManual) ?? null
  const semuaTugasLain: TugasLain[] = bahanPorsi ? ['salinan', 'satuan'] : ['salinan']
  const tugasLain = semuaTugasLain.filter((t) => !tugasBeres.includes(t))
  const jumlahPerluDibereskan = kasir.menuBelumDipasangkan.length + tugasLain.length

  function gantiTab(t: Tab) {
    const baru = new URLSearchParams(params)
    if (t === 'sambungan') baru.delete('tab')
    else baru.set('tab', t)
    setParams(baru, { replace: true })
  }

  if (onboarding) {
    return (
      <div className="pb-10 max-w-2xl mx-auto">
        <div className="mt-2">
          <BilahProgres nilai={4} maks={5} label="Langkah 4 dari 5" tinggi={6} />
        </div>

        <h1 className="mt-5 text-[1.375rem] font-extrabold text-ink leading-tight tracking-tight">
          Apakah kamu sudah memiliki data transaksi sebelumnya?
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-2 leading-relaxed">
          Warungku berdiri terpisah dari aplikasi kasirmu — kami mengurus stok gudang, kasir mengurus penjualan.
          Karena itu catatan penjualan yang sudah kamu punya perlu disambungkan ke sini. Kalau tidak, perkiraan
          kebutuhan mulai dari nol dan baru bisa diandalkan setelah dua minggu berjalan.
        </p>

        <div className="mt-5">
          <DaftarKonektor />
        </div>

        {/* Jalan keluar disengaja berupa teks, bukan tombol setara: melewati
            langkah ini boleh, tapi tidak boleh terasa sama menariknya. */}
        <div className="mt-7 text-center">
          <Link
            to="/mulai/batas-aman"
            className="inline-flex items-center justify-center min-h-11 px-3 text-[0.9375rem] font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
          >
            Lewati untuk saat ini
          </Link>
          <p className="mt-1.5 text-[0.75rem] text-ink-3">
            Kamu bisa menyambungkannya kapan saja lewat Akun &rsaquo; Data dari Kasir.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul={JUDUL.dataKasir}
        kembaliKe="/akun"
        bawah={
          <TabSegmen<Tab>
            aktif={tab}
            ubah={gantiTab}
            tab={[
              { nilai: 'sambungan', label: 'Sambungan' },
              { nilai: 'beres', label: 'Perlu Dibereskan', jumlah: jumlahPerluDibereskan },
              { nilai: 'riwayat', label: 'Riwayat' },
            ]}
          />
        }
      />

      {/* Lebar isi mengikuti bentuk tiap tab: Sambungan adalah satu keputusan
          dan tetap satu kolom di tengah, sedangkan dua tab lainnya adalah daftar
          kartu yang boleh berdampingan di layar lebar. */}
      <div className={cx('mt-4', tab === 'sambungan' ? 'max-w-3xl mx-auto' : 'max-w-6xl')}>
        {tab === 'sambungan' && <TabSambungan jumlahPerluDibereskan={jumlahPerluDibereskan} />}
        {tab === 'beres' && (
          <TabPerluDibereskan
            tugasLain={tugasLain}
            bahanPorsi={bahanPorsi}
            selesaikan={(t) => setTugasBeres((s) => [...s, t])}
          />
        )}
        {tab === 'riwayat' && <TabRiwayat />}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Tab Sambungan                                                      */
/* ================================================================== */

function TabSambungan({ jumlahPerluDibereskan }: { jumlahPerluDibereskan: number }) {
  const kasir = useAplikasi((s) => s.kasir)
  const [gantiSumber, setGantiSumber] = useState(false)

  const tersambung = kasir.sumber === 'kasir-digital' && kasir.status !== 'belum-terhubung'

  if (tersambung && !gantiSumber) {
    return (
      <div className="space-y-5">
        <KeadaanTersambung jumlahPerluDibereskan={jumlahPerluDibereskan} />
        <div className="text-center">
          <TombolGantiSumber onClick={() => setGantiSumber(true)} />
        </div>
      </div>
    )
  }

  if (kasir.sumber === 'catat-manual' && !gantiSumber) {
    return (
      <div className="space-y-5">
        <Kartu>
          <div className="flex items-start gap-3">
            <span className="shrink-0 size-10 rounded-md bg-netral-soft text-netral-ink grid place-items-center">
              <IkonPena size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[1rem] font-bold text-ink">Kamu mencatat pemakaian harian sendiri</h2>
              <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">
                Setiap sore kamu mengisi berapa banyak tiap bahan yang terpakai hari itu, lalu stok berkurang
                sesuai angka tersebut. Perkiraan kebutuhan tetap jalan selama catatannya rutin.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <TombolTautan ke="/stok/pemakaian" penuh>
              Catat Pemakaian Hari Ini
            </TombolTautan>
          </div>
        </Kartu>
        <div className="text-center">
          <TombolGantiSumber onClick={() => setGantiSumber(true)} />
        </div>
      </div>
    )
  }

  return (
    <div>
      {gantiSumber && (
        <Peringatan
          nada="menipis"
          className="mb-4"
          judul="Mengganti sumber data"
          /* Tanpa jalan kembali, membuka daftar ini adalah pintu satu arah:
             satu-satunya cara membatalkan adalah meninggalkan halaman. */
          aksi={
            <Tombol ragam="garis" ukuran="kecil" onClick={() => setGantiSumber(false)}>
              Batal, Pakai yang Sekarang
            </Tombol>
          }
        >
          Sambungan yang sekarang berhenti dipakai begitu kamu memilih yang baru. Riwayat penjualan yang sudah
          masuk tidak terhapus.
        </Peringatan>
      )}
      <DaftarKonektor />
    </div>
  )
}

function TombolGantiSumber({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center min-h-11 px-3 text-[0.875rem] font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
    >
      Ganti sumber data penjualan
    </button>
  )
}

/**
 * Daftar konektor — satu baris per sumber data, dengan status dan satu tombol
 * di kanan. Bentuknya sengaja menyerupai halaman konektor yang sudah umum
 * dikenal orang, bukan tumpukan kartu yang harus dibuka satu-satu.
 *
 * Dipakai di DUA tempat: langkah terakhir pendaftaran dan tab Sambungan.
 * Isinya sama persis supaya pengguna yang melewati langkah ini saat mendaftar
 * menemukan layar yang ia kenali saat kembali.
 *
 * Hanya ada SATU POS yang didukung, yaitu POS_TUNGGAL. Tidak ada pemilihan
 * merek kasir di sini maupun di mana pun — jangan menambahkannya kembali.
 */
function DaftarKonektor() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const kasir = useAplikasi((s) => s.kasir)
  const ubahKasir = useAplikasi((s) => s.ubahKasir)
  const hubungkanKasir = useAplikasi((s) => s.hubungkanKasir)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [unggah, setUnggah] = useState(false)

  const tersambungPos = kasir.sumber === 'kasir-digital' && kasir.status !== 'belum-terhubung'
  const modeManual = kasir.sumber === 'catat-manual'

  /* Penanda pendaftaran diteruskan ke panduan supaya panduan tahu ia sedang
     menjadi bagian alur pendaftaran. Tanpa penanda ini, pengguna lama yang
     menekan "Atur Ulang" ikut dilempar ke langkah batas aman awal — layar yang
     menimpa seluruh batas aman yang pernah ia atur sendiri. */
  const onboarding = params.get('langkah') === 'mulai'
  const tautanPanduan = onboarding ? '/akun/kasir/panduan?langkah=mulai' : '/akun/kasir/panduan'

  function pilihManual() {
    ubahKasir({ sumber: 'catat-manual', status: 'manual', merek: null })
    tampilkanRacun('Mode catat pemakaian harian aktif.', 'aman')
    navigate('/stok/pemakaian')
  }

  /* Purwarupa: jalur Gmail dan Spreadsheet belum punya pembacanya sendiri, jadi
     yang benar-benar dijalankan tetap sambungan ke POS tunggal. Kalimatnya
     dibuat jujur supaya tidak ada yang mengira dua jalur itu sudah hidup. */
  function sambungkanLewat(nama: string) {
    hubungkanKasir()
    tampilkanRacun(
      `Sambungan lewat ${nama} masih kami siapkan. Sementara ini penjualan diambil dari ${POS_TUNGGAL.nama}.`,
      'info',
    )
  }

  const belumTersambung = <Lencana nada="netral">Belum tersambung</Lencana>

  return (
    <div>
      {/* Judul hanya untuk pembaca layar: di kedua tempat pemakaian, kalimat
          pengantarnya sudah terbaca sebagai judul halaman. */}
      <h2 className="sr-only">Sumber data transaksi</h2>

      <ul className="space-y-2.5">
        <BarisKonektor
          nama={POS_TUNGGAL.nama}
          keterangan="Penjualan masuk sendiri, stok berkurang tanpa dicatat ulang."
          logo="bg-brand-soft text-brand-soft-ink"
          status={
            tersambungPos ? (
              <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />}>
                Tersambung
              </Lencana>
            ) : (
              belumTersambung
            )
          }
          aksi={
            <TombolTautan
              ke={tautanPanduan}
              ragam={tersambungPos ? 'garis' : 'utama'}
              className="w-full sm:w-auto"
              ikonKanan={<IkonPanahKanan size={16} />}
            >
              {tersambungPos ? 'Atur Ulang' : 'Hubungkan'}
            </TombolTautan>
          }
        />

        <BarisKonektor
          nama="Gmail"
          keterangan="Tarik rekap penjualan yang dikirim ke emailmu."
          logo="bg-info-soft text-info-ink"
          status={belumTersambung}
          aksi={
            <Tombol ragam="garis" className="w-full sm:w-auto" onClick={() => sambungkanLewat('Gmail')}>
              Hubungkan
            </Tombol>
          }
        />

        <BarisKonektor
          nama="Google Spreadsheet"
          keterangan="Baca catatan penjualan dari satu berkas spreadsheet."
          logo="bg-aman-soft text-aman-ink"
          status={belumTersambung}
          aksi={
            <Tombol
              ragam="garis"
              className="w-full sm:w-auto"
              onClick={() => sambungkanLewat('Google Spreadsheet')}
            >
              Hubungkan
            </Tombol>
          }
        />

        <BarisKonektor
          nama="Unggah berkas sendiri"
          keterangan="Kirim berkas rekap transaksi yang sudah kamu punya."
          logo="bg-netral-soft text-netral-ink"
          status={belumTersambung}
          aksi={
            <Tombol ragam="garis" className="w-full sm:w-auto" onClick={() => setUnggah(true)}>
              Hubungkan
            </Tombol>
          }
        />

        <BarisKonektor
          nama="Belum punya data transaksi"
          keterangan="Catat pemakaian harian sendiri, satu angka per barang."
          logo="bg-menipis-soft text-menipis-ink"
          status={
            modeManual ? (
              <Lencana nada="aman" ikon={<IkonPena size={13} />}>
                Sedang dipakai
              </Lencana>
            ) : undefined
          }
          aksi={
            <Tombol ragam="garis" className="w-full sm:w-auto" onClick={pilihManual}>
              Mulai Mencatat
            </Tombol>
          }
        />
      </ul>

      <p className="pt-3 text-[0.75rem] text-ink-3 leading-relaxed">
        Apa pun yang kamu pilih sekarang bisa diganti nanti lewat Akun &rsaquo; Data dari Kasir. Tidak ada kolom
        harga jual di mana pun — itu tetap tinggal di aplikasi kasirmu.
      </p>

      <Lembar
        terbuka={unggah}
        tutup={() => setUnggah(false)}
        judul="Kirim berkas rekap transaksimu"
        keterangan="Untuk catatan penjualan yang sudah kamu simpan sendiri di luar aplikasi kasir."
        lebar="sempit"
        kaki={
          <Tombol penuh ukuran="besar" onClick={() => setUnggah(false)}>
            Mengerti
          </Tombol>
        }
      >
        <div className="pb-4 space-y-3 text-[0.875rem] text-ink-2 leading-relaxed">
          <p>
            Yang kami baca cuma tiga kolom: <strong className="text-ink">tanggal</strong>,{' '}
            <strong className="text-ink">nama barang atau menu</strong>, dan{' '}
            <strong className="text-ink">jumlah yang terjual</strong>. Kolom lain kami lewati, termasuk kolom
            harga kalau ada.
          </p>
          <p>
            Satu baris untuk satu barang pada satu tanggal sudah cukup. Berkas berbentuk tabel — spreadsheet atau
            CSV — yang paling mudah kami baca.
          </p>
          <p className="text-ink-3">
            Pengiriman berkas belum bisa dicoba di purwarupa ini. Sementara menunggu, sambungkan{' '}
            {POS_TUNGGAL.nama} atau catat pemakaian harian supaya stok tetap ikut berkurang.
          </p>
        </div>
      </Lembar>
    </div>
  )
}

/**
 * Satu baris konektor.
 *
 * Di 360px baris ini menumpuk ke bawah — logo dan keterangan di satu baris,
 * tombolnya turun selebar penuh — supaya tidak ada yang mendorong badan
 * halaman ke samping. Status tidak pernah hanya warna: lencananya selalu
 * berteks, dan yang sudah tersambung juga berikon.
 */
function BarisKonektor({
  nama,
  keterangan,
  logo,
  status,
  aksi,
}: {
  nama: string
  keterangan: string
  /** Kelas token untuk kotak inisial. Tidak pernah hex langsung. */
  logo: string
  status?: ReactNode
  aksi: ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 min-h-[4.5rem] p-3.5 rounded-lg border border-line bg-surface">
      <span
        aria-hidden="true"
        className={cx(
          'shrink-0 size-11 rounded-md grid place-items-center text-[0.8125rem] font-extrabold',
          logo,
        )}
      >
        {inisial(nama)}
      </span>
      <div className="min-w-0 grow basis-[11rem]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[0.9375rem] font-bold text-ink leading-snug">{nama}</span>
          {status}
        </div>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-relaxed">{keterangan}</p>
      </div>
      <div className="w-full sm:w-auto sm:shrink-0">{aksi}</div>
    </li>
  )
}

/* ================================================================== */
/* Keadaan tersambung                                                 */
/* ================================================================== */

function KeadaanTersambung({ jumlahPerluDibereskan }: { jumlahPerluDibereskan: number }) {
  const kasir = useAplikasi((s) => s.kasir)
  const ubahKasir = useAplikasi((s) => s.ubahKasir)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const sedangAmbil = kasir.status === 'menyinkron'
  const terakhir = kasir.terakhirMasuk ? new Date(kasir.terakhirMasuk) : null
  const jamBerlalu = terakhir ? (Date.now() - +terakhir) / 3_600_000 : 99
  const basi = jamBerlalu > 18

  function ambilSekarang() {
    ubahKasir({ status: 'menyinkron' })
    window.setTimeout(() => {
      /* Dibaca ulang dari store, bukan dari nilai render ini: 1,5 detik cukup
         lama untuk membuat angka yang tertangkap closure jadi basi. */
      const sebelum = useAplikasi.getState().kasir
      ubahKasir({
        status: 'terhubung',
        terakhirMasuk: new Date().toISOString(),
        jumlahTransaksiHariIni: sebelum.jumlahTransaksiHariIni + 4,
      })
      tampilkanRacun('4 penjualan baru masuk. Stok bahannya sudah ikut berkurang.', 'aman')
    }, 1500)
  }

  return (
    <Kartu>
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'shrink-0 size-11 rounded-md grid place-items-center',
            basi ? 'bg-menipis-soft text-menipis-ink' : 'bg-aman-soft text-aman-ink',
          )}
          aria-hidden="true"
        >
          {basi ? <IkonTanpaSinyal size={20} /> : <IkonCentangLingkaran size={20} />}
        </span>
        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1rem] font-bold text-ink leading-snug">
              Tersambung ke {kasir.merek ?? 'aplikasi kasir'}
            </h2>
            <Lencana nada={basi ? 'menipis' : 'aman'}>{basi ? 'Data belum baru' : 'Berjalan'}</Lencana>
          </div>
          <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">
            {basi ? (
              <>
                Belum ada data baru sejak {terakhir ? waktuLalu(terakhir) : 'lama'}. Angka stok mungkin sudah tidak
                sesuai dengan yang ada di rak.
              </>
            ) : (
              <>Penjualan masuk sendiri dan bahan bakunya langsung berkurang dari stok.</>
            )}
          </p>
        </div>
      </div>

      <Pemisah className="my-4" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Data terakhir masuk</p>
          <p className="mt-1 text-[0.9375rem] font-bold text-ink">
            {sedangAmbil ? 'Sedang diambil…' : terakhir ? waktuLalu(terakhir) : 'Belum pernah'}
          </p>
          {terakhir && !sedangAmbil && (
            <p className="text-[0.75rem] text-ink-3">
              {tanggalRingkas(terakhir)} pukul {jam(terakhir)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Masuk hari ini</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-[1.5rem] font-extrabold text-ink leading-none">
              {angka(kasir.jumlahTransaksiHariIni)}
            </span>
            <span className="text-[0.8125rem] text-ink-3 font-semibold">penjualan</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
        <Tombol
          penuh
          memuat={sedangAmbil}
          onClick={ambilSekarang}
          ikonKiri={sedangAmbil ? undefined : <IkonSinkron size={17} />}
        >
          {sedangAmbil ? 'Sedang mengambil data' : 'Ambil Data Sekarang'}
        </Tombol>
        {jumlahPerluDibereskan > 0 && (
          <TombolTautan ke="/akun/kasir?tab=beres" ragam="garis" penuh>
            {jumlahPerluDibereskan} hal perlu dibereskan
          </TombolTautan>
        )}
      </div>
    </Kartu>
  )
}

/* ================================================================== */
/* Tab Perlu Dibereskan                                               */
/* ================================================================== */

/**
 * Tiga jenis tugas, satu bentuk kartu: kalimat yang bisa dimengerti pemilik
 * usaha, lalu satu tombol yang benar-benar menyelesaikannya. Tidak ada kode
 * kesalahan dan tidak ada istilah teknis di sini.
 */
function TabPerluDibereskan({
  tugasLain,
  bahanPorsi,
  selesaikan,
}: {
  tugasLain: TugasLain[]
  bahanPorsi: Barang | null
  selesaikan: (t: TugasLain) => void
}) {
  const menu = useAplikasi((s) => s.kasir.menuBelumDipasangkan)
  const ubahBarang = useAplikasi((s) => s.ubahBarang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [aturTakaran, setAturTakaran] = useState(false)
  const [takaran, setTakaran] = useState('')
  const [galatTakaran, setGalatTakaran] = useState<string | undefined>(undefined)

  const total = menu.length + tugasLain.length

  function simpanTakaran() {
    if (!bahanPorsi) return
    const nilai = Number(takaran.replace(',', '.'))
    if (!(nilai > 0)) {
      setGalatTakaran(
        `Takaran belum diisi. Tulis berapa ${bahanPorsi.satuan} yang terpakai untuk satu porsi. Contoh: 18.`,
      )
      return
    }
    /* Setelah takarannya jelas, bahan ini boleh ikut berkurang otomatis. */
    ubahBarang(bahanPorsi.id, { terhubungKasir: true })
    selesaikan('satuan')
    setAturTakaran(false)
    tampilkanRacun(
      `Takaran tersimpan. Satu porsi kini mengurangi ${jumlahSatuan(nilai, bahanPorsi.satuan)} ${bahanPorsi.nama}.`,
      'aman',
    )
  }

  if (total === 0) {
    return (
      <>
        {/* Judul hanya untuk pembaca layar: KeadaanKosong memakai h3, dan tanpa
            h2 di antaranya tingkat judul halaman ini melompat dari h1 ke h3. */}
        <h2 className="sr-only">Perlu dibereskan</h2>
        <KeadaanKosong
          ikon={<IkonCentangLingkaran size={26} />}
          judul="Tidak ada yang perlu dibereskan"
          pesan="Semua menu sudah dipasangkan ke bahan dan satuannya cocok, jadi setiap penjualan langsung mengurangi stok."
          aksi={
            <TombolTautan ke="/akun/kasir" ragam="garis">
              Lihat Sambungan
            </TombolTautan>
          }
          aksiKedua={
            <TombolTautan ke="/stok" ragam="sunyi">
              Buka daftar Stok
            </TombolTautan>
          }
        />
      </>
    )
  }

  return (
    <div>
      {menu.length > 0 && (
        <Peringatan nada="menipis" judul={`${menu.length} menu belum dipasangkan ke bahan`}>
          Penjualannya tetap tercatat. Yang tertinggal cuma stok bahannya, jadi selama belum dipasangkan angka
          stok di aplikasi lebih besar daripada isi rak yang sebenarnya.
        </Peringatan>
      )}

      {/* Kartu tugas berdampingan di layar lebar: tiap kartu berdiri sendiri
          dan tidak perlu dibaca berurutan, jadi satu pita panjang cuma memaksa
          menggulir tanpa menambah kejelasan. */}
      <ul className="mt-4 grid gap-3 lg:grid-cols-2 lg:items-start">
        {menu.map((m) => (
          <li key={m.id}>
            <KartuTugas
              nada="menipis"
              ikon={<IkonPeringatan size={18} />}
              judul={`Menu “${m.namaMenu}” terjual ${angka(m.jumlahTerjual)} kali tanpa mengurangi stok`}
              detail={
                <>
                  Penjualan pertamanya tercatat {waktuLalu(m.sejak)} ({tanggalPendek(m.sejak)}). Bahan apa saja
                  yang dipakai menu ini belum pernah kamu tentukan.
                </>
              }
              utama={
                <TombolTautan ke={`/akun/kasir/pasangkan/${m.id}`} penuh>
                  Pasangkan Sekarang
                </TombolTautan>
              }
            />
          </li>
        ))}

        {tugasLain.includes('salinan') && (
          <li>
            <KartuTugas
              nada="info"
              ikon={<IkonNota size={18} />}
              judul={`Penjualan pukul ${PENJUALAN_KEMBAR.jam} masuk ${PENJUALAN_KEMBAR.jumlah} kali`}
              detail={
                <>
                  Salinannya sudah kami abaikan, jadi stok hanya berkurang satu kali. Tidak ada yang perlu kamu
                  lakukan kalau di jam itu memang cuma ada satu pembeli.
                </>
              }
              utama={
                <Tombol
                  penuh
                  ragam="garis"
                  onClick={() => {
                    selesaikan('salinan')
                    tampilkanRacun('Salinan tetap diabaikan. Stok tidak berubah.', 'aman')
                  }}
                >
                  Benar, Cuma Satu Pembeli
                </Tombol>
              }
              kedua={
                <Tombol
                  penuh
                  ragam="sunyi"
                  onClick={() => {
                    selesaikan('salinan')
                    tampilkanRacun(
                      'Penjualan kedua ikut dihitung. Stok bahannya menyesuaikan pada pencatatan berikutnya.',
                      'info',
                    )
                  }}
                >
                  Ternyata memang 2 transaksi
                </Tombol>
              }
            />
          </li>
        )}

        {tugasLain.includes('satuan') && bahanPorsi && (
          <li>
            <KartuTugas
              nada="menipis"
              ikon={<IkonKotak size={18} />}
              judul={`Satuan tidak cocok: kasir mencatat “porsi”, bahan memakai ${bahanPorsi.satuan}`}
              detail={
                <>
                  Kasir mengirim penjualan dalam hitungan porsi, sedangkan {bahanPorsi.nama} disimpan dalam{' '}
                  {bahanPorsi.satuan}. Selama takarannya belum ditentukan, stok bahan ini tidak ikut berkurang.
                </>
              }
              utama={
                <Tombol
                  penuh
                  onClick={() => {
                    setGalatTakaran(undefined)
                    setAturTakaran(true)
                  }}
                >
                  Tentukan 1 porsi = &hellip; {bahanPorsi.satuan}
                </Tombol>
              }
            />
          </li>
        )}
      </ul>

      {menu.length > 0 && (
        <p className="mt-4 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[70ch]">
          Penjualan yang sudah lewat tidak ikut dikurangi otomatis. Setelah memasangkan, cocokkan sisa stok lewat{' '}
          <Link to="/stok/hitung" className="font-semibold text-brand hover:underline">
            Hitung Stok
          </Link>
          .
        </p>
      )}

      {bahanPorsi && (
        <Lembar
          terbuka={aturTakaran}
          tutup={() => setAturTakaran(false)}
          judul={`Satu porsi sama dengan berapa ${bahanPorsi.satuan}?`}
          keterangan={`Dipakai untuk mengurangi stok ${bahanPorsi.nama} setiap kasir mencatat satu porsi.`}
          lebar="sempit"
          kaki={
            <Tombol penuh ukuran="besar" onClick={simpanTakaran}>
              Simpan Takaran
            </Tombol>
          }
        >
          <div className="pb-4">
            <Kolom
              label="Takaran satu porsi"
              wajib
              inputMode="decimal"
              value={takaran}
              akhiran={bahanPorsi.satuan}
              galat={galatTakaran}
              onChange={(e) => {
                setTakaran(e.target.value)
                setGalatTakaran(undefined)
              }}
              bantuan="Perkiraan kasar sudah cukup. Kamu bisa membetulkannya kapan saja dari detail barang."
            />
            <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
              Sisa {jumlahSatuan(bahanPorsi.stok, bahanPorsi.satuan)} yang tercatat sekarang tidak ikut dihitung
              ulang. Takaran ini berlaku untuk penjualan berikutnya.
            </p>
          </div>
        </Lembar>
      )}
    </div>
  )
}

function KartuTugas({
  nada,
  ikon,
  judul,
  detail,
  utama,
  kedua,
}: {
  nada: 'menipis' | 'info'
  ikon: ReactNode
  judul: string
  detail: ReactNode
  utama: ReactNode
  kedua?: ReactNode
}) {
  const garis = nada === 'menipis' ? 'border-menipis/50' : 'border-info/40'
  const lencana = nada === 'menipis' ? 'bg-menipis-soft text-menipis-ink' : 'bg-info-soft text-info-ink'
  return (
    <div className={cx('bg-surface border rounded-lg p-4 shadow-e1', garis)}>
      <div className="flex items-start gap-3">
        <span className={cx('shrink-0 size-9 rounded-md grid place-items-center', lencana)} aria-hidden="true">
          {ikon}
        </span>
        <div className="min-w-0 grow">
          {/* h2, bukan h3: kartu ini bersarang langsung di bawah judul halaman,
              dan h3 membuat tingkat judul melompat. */}
          <h2 className="text-[1rem] font-bold text-ink leading-snug">{judul}</h2>
          <div className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">{detail}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
        {utama}
        {kedua}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Tab Riwayat                                                        */
/* ================================================================== */

const LABEL_HASIL = {
  lengkap: { teks: 'Lengkap', nada: 'aman' as const },
  sebagian: { teks: 'Sebagian belum terpakai', nada: 'menipis' as const },
  tertunda: { teks: 'Sempat tertahan', nada: 'netral' as const },
}

/** Satu baris per hari, bukan satu baris per pengambilan data. */
const RIWAYAT_HARIAN: Array<{ tanggal: string; masuk: number; catatan: RiwayatKasir[] }> = (() => {
  const peta = new Map<string, { tanggal: string; masuk: number; catatan: RiwayatKasir[] }>()
  for (const r of riwayatKasir) {
    const tanggal = tanggalRingkas(r.waktu)
    const hari = peta.get(tanggal) ?? { tanggal, masuk: 0, catatan: [] }
    hari.masuk += r.jumlahTransaksi
    hari.catatan.push(r)
    peta.set(tanggal, hari)
  }
  return [...peta.values()]
})()

/** Cuplikan struk paling baru. `daftarTransaksi` sudah urut dari yang terbaru. */
const STRUK_TERBARU = daftarTransaksi.slice(0, 8)

/** Riwayat ditulis sebagai catatan kejadian usaha, bukan catatan teknis. */
function TabRiwayat() {
  if (RIWAYAT_HARIAN.length === 0) {
    return (
      <>
        {/* Lihat catatan yang sama di tab Perlu Dibereskan: menjaga h1 → h2 → h3. */}
        <h2 className="sr-only">Riwayat data dari kasir</h2>
        <KeadaanKosong
          ikon={<IkonJam size={26} />}
          judul="Belum ada riwayat"
          pesan="Riwayat muncul setelah data penjualan pertama masuk dari aplikasi kasirmu."
          aksi={
            <TombolTautan ke="/akun/kasir" ragam="garis">
              Atur Sambungan
            </TombolTautan>
          }
        />
      </>
    )
  }

  return (
    <div>
      <JudulBagian
        id="riwayat-harian"
        judul="Ringkasan per hari"
        keterangan="Yang dicatat di sini adalah akibatnya ke stokmu; rinciannya bisa kamu buka kalau perlu."
      />

      <ol aria-labelledby="riwayat-harian" className="grid gap-2.5 lg:grid-cols-2 lg:items-start">
        {RIWAYAT_HARIAN.map((h) => {
          const perluDilihat = h.catatan.find((c) => c.hasil !== 'lengkap')
          return (
            <li key={h.tanggal} className="bg-surface border border-line rounded-lg p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[0.9375rem] font-bold text-ink">{h.tanggal}</span>
                <span className="text-[0.875rem] text-ink-2">
                  {angka(h.masuk)} penjualan masuk dalam {h.catatan.length} kali pencatatan
                </span>
                {perluDilihat && (
                  <Lencana nada={LABEL_HASIL[perluDilihat.hasil].nada}>
                    {LABEL_HASIL[perluDilihat.hasil].teks}
                  </Lencana>
                )}
              </div>

              <details className="mt-2">
                <summary className="inline-flex items-center min-h-11 text-[0.8125rem] font-semibold text-brand cursor-pointer select-none">
                  Lihat rinciannya
                </summary>
                <ul className="mt-1 space-y-2.5 border-l-2 border-line pl-3.5">
                  {h.catatan.map((r) => (
                    <li key={r.id}>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[0.8125rem] font-bold text-ink tabular">pukul {jam(r.waktu)}</span>
                        <Lencana nada={LABEL_HASIL[r.hasil].nada}>{LABEL_HASIL[r.hasil].teks}</Lencana>
                      </div>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-relaxed">{r.keterangan}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )
        })}
      </ol>

      {/* Struk mentahnya, supaya pemilik usaha bisa mencocokkan angka ringkasan
          di atas dengan apa yang benar-benar tercetak di kasir. */}
      <div className="mt-7">
        <JudulBagian
          id="riwayat-struk"
          judul="Struk terbaru"
          keterangan={`Inilah bentuk struk yang dikenal aplikasi — format ${POS_TUNGGAL.nama}, satu-satunya yang kami baca. Harga jual tidak ikut masuk ke sini; itu tetap tinggal di aplikasi kasirmu.`}
        />
        <ul aria-labelledby="riwayat-struk" className="grid gap-2.5 lg:grid-cols-2 lg:items-start">
          {STRUK_TERBARU.map((t) => (
            <li key={t.id}>
              <KartuStruk transaksi={t} />
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[70ch]">
        Riwayat lebih lama dari 30 hari tidak disimpan. Kalau ada angka stok yang terasa tidak masuk akal, buka{' '}
        <Link to="/stok" className="font-semibold text-brand hover:underline">
          daftar Stok
        </Link>{' '}
        dan lihat riwayat pergerakan barangnya.
      </p>
    </div>
  )
}
