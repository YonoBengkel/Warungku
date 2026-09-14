import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
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
import { merekKasir, riwayatKasir } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

type Tab = 'sambungan' | 'beres' | 'riwayat'
type KartuTerbuka = 'punya-kasir' | 'tidak-terdaftar' | 'tanpa-kasir' | null
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
          Dari mana data penjualanmu?
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-2 leading-relaxed">
          Kami perlu tahu ini supaya stok bisa berkurang sendiri setiap ada yang terjual. Pilih yang paling cocok
          dengan caramu berjualan sekarang.
        </p>

        <div className="mt-5">
          <PilihanSumber />
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
      <PilihanSumber />
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
 * Tiga kartu besar. Hanya satu yang terbuka pada satu waktu supaya layar 360px
 * tidak berubah jadi gulungan panjang berisi tiga formulir sekaligus.
 */
function PilihanSumber() {
  const navigate = useNavigate()
  const ubahKasir = useAplikasi((s) => s.ubahKasir)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [terbuka, setTerbuka] = useState<KartuTerbuka>(null)
  const [namaKasirLain, setNamaKasirLain] = useState('')
  const [dicatat, setDicatat] = useState<string | null>(null)

  function pilihManual() {
    ubahKasir({ sumber: 'catat-manual', status: 'manual', merek: null })
    tampilkanRacun('Mode catat pemakaian harian aktif.', 'aman')
    navigate('/stok/pemakaian')
  }

  return (
    <div className="space-y-3">
      {/* 1 */}
      <KartuPilihan
        terbuka={terbuka === 'punya-kasir'}
        buka={() => setTerbuka(terbuka === 'punya-kasir' ? null : 'punya-kasir')}
        ikon={<IkonSinkron size={20} />}
        judul="Saya pakai aplikasi kasir"
        keterangan="Penjualan masuk sendiri, stok berkurang tanpa kamu catat ulang. Paling sedikit pekerjaan harian."
        lencana={<Lencana nada="aman">Paling dianjurkan</Lencana>}
      >
        <p className="text-[0.875rem] text-ink-2 leading-relaxed">
          Pilih aplikasi kasir yang kamu pakai di kedai. Kami tunjukkan langkah menyambungkannya satu per satu.
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {merekKasir.map((m) => (
            <Link
              key={m.id}
              to={`/akun/kasir/panduan/${m.id}`}
              className="flex items-center gap-2.5 min-h-[3.5rem] p-2.5 rounded-md border border-line bg-surface hover:border-brand hover:shadow-e1 transition-[border-color,box-shadow]"
            >
              <span
                aria-hidden="true"
                style={{ background: m.warna }}
                className="size-9 rounded-md grid place-items-center text-white font-extrabold text-[0.8125rem] shrink-0"
              >
                {inisial(m.nama)}
              </span>
              <span className="text-[0.8125rem] font-semibold text-ink leading-snug">{m.nama}</span>
            </Link>
          ))}
        </div>
      </KartuPilihan>

      {/* 2 */}
      <KartuPilihan
        terbuka={terbuka === 'tidak-terdaftar'}
        buka={() => setTerbuka(terbuka === 'tidak-terdaftar' ? null : 'tidak-terdaftar')}
        ikon={<IkonTanpaSinyal size={20} />}
        judul="Kasir saya tidak ada di daftar"
        keterangan="Sebutkan namanya. Kasir yang paling banyak disebut kami sambungkan lebih dulu."
      >
        {dicatat ? (
          <div>
            <Peringatan nada="aman" judul={`${dicatat} sudah kami catat`}>
              Terima kasih. Kami kabari lewat WhatsApp begitu sambungannya siap. Sementara menunggu, cara paling
              cepat supaya stok tetap akurat adalah mencatat pemakaian harian.
            </Peringatan>
            <Tombol penuh className="mt-3" onClick={pilihManual}>
              Mulai Catat Pemakaian Harian
            </Tombol>
          </div>
        ) : (
          <div>
            <Kolom
              label="Nama aplikasi kasir yang kamu pakai"
              wajib
              value={namaKasirLain}
              onChange={(e) => setNamaKasirLain(e.target.value)}
              bantuan="Tulis apa adanya, termasuk kalau itu buatan sendiri atau catatan di buku."
            />
            <Tombol
              penuh
              className="mt-3"
              disabled={namaKasirLain.trim().length < 2}
              onClick={() => setDicatat(namaKasirLain.trim())}
            >
              Kirim Nama Kasir
            </Tombol>
          </div>
        )}
      </KartuPilihan>

      {/* 3 */}
      <KartuPilihan
        terbuka={terbuka === 'tanpa-kasir'}
        buka={() => setTerbuka(terbuka === 'tanpa-kasir' ? null : 'tanpa-kasir')}
        ikon={<IkonPena size={20} />}
        judul="Saya belum pakai kasir digital"
        keterangan="Catat sendiri berapa yang terpakai tiap hari. Satu kolom angka per barang, tidak lebih."
      >
        <p className="text-[0.875rem] text-ink-2 leading-relaxed">
          Setiap sore kamu mengisi satu angka per bahan: berapa yang terpakai hari itu. Stok langsung berkurang dan
          perkiraan kebutuhan mulai terbentuk setelah dua minggu catatan.
        </p>
        <ul className="mt-2.5 space-y-1 text-[0.8125rem] text-ink-3 list-disc pl-4">
          <li>Tidak ada kolom harga jual dan tidak ada nilai rupiah sama sekali.</li>
          <li>Butuh sekitar satu menit sehari kalau barangmu di bawah 20 jenis.</li>
          <li>Kamu tetap bisa menyambungkan aplikasi kasir nanti tanpa kehilangan catatan.</li>
        </ul>
        <Tombol penuh className="mt-3.5" onClick={pilihManual}>
          Mulai Catat Pemakaian Harian
        </Tombol>
      </KartuPilihan>

      <p className="pt-1 text-[0.75rem] text-ink-3 leading-relaxed">
        Apa pun yang kamu pilih sekarang bisa diganti nanti. Langkah berikutnya sama saja: menentukan kapan kami
        harus mengingatkanmu waktu stok mulai menipis.
      </p>
    </div>
  )
}

function KartuPilihan({
  terbuka,
  buka,
  ikon,
  judul,
  keterangan,
  lencana,
  children,
}: {
  terbuka: boolean
  buka: () => void
  ikon: ReactNode
  judul: string
  keterangan: string
  lencana?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={cx(
        'rounded-lg border-2 bg-surface transition-[border-color] duration-150',
        terbuka ? 'border-brand shadow-e2' : 'border-line hover:border-line-strong',
      )}
    >
      <button
        type="button"
        onClick={buka}
        aria-expanded={terbuka}
        className="w-full text-left flex items-start gap-3 p-4 min-h-[5rem]"
      >
        <span
          className={cx(
            'shrink-0 size-11 rounded-md grid place-items-center',
            /* text-ink-inverse: di tema gelap warna merek justru terang, jadi
               ikon putih di atasnya nyaris tidak terlihat. */
            terbuka ? 'bg-brand text-ink-inverse' : 'bg-brand-soft text-brand-soft-ink',
          )}
          aria-hidden="true"
        >
          {ikon}
        </span>
        <span className="min-w-0 grow">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[1rem] font-bold text-ink leading-snug">{judul}</span>
            {lencana}
          </span>
          <span className="block mt-1 text-[0.8125rem] text-ink-2 leading-relaxed">{keterangan}</span>
        </span>
        <IkonPanahKanan
          size={20}
          className={cx('shrink-0 mt-1 text-ink-3 transition-transform', terbuka && 'rotate-90')}
        />
      </button>
      {terbuka && <div className="px-4 pb-4 anim-muncul">{children}</div>}
    </div>
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
      <p className="text-[0.875rem] text-ink-2 leading-relaxed max-w-[70ch]">
        Ringkasan per hari. Yang dicatat di sini adalah akibatnya ke stokmu; rinciannya bisa kamu buka kalau perlu.
      </p>

      <ol className="mt-4 grid gap-2.5 lg:grid-cols-2 lg:items-start">
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
