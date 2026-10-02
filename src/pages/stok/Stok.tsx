import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Barang } from '@/lib/types'
import { BarisStok, ChipStok } from '@/components/domain'
import { Lencana, Tombol, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { BarisChip, Chip } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { Lembar } from '@/components/ui/lembar'
import { PilihanKartu } from '@/components/ui/formulir'
import {
  IkonCari,
  IkonGudang,
  IkonKeranjang,
  IkonKotak,
  IkonPanahBawah,
  IkonPanahAtas,
  IkonPanahKanan,
  IkonPena,
  IkonPeringatan,
  IkonSaring,
  IkonSilang,
  IkonTambah,
  IkonTiga,
} from '@/icons'
import { angka, cx } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'
import { hariCukup, kategoriBarang, penawaranUntukBarang, statusStok } from '@/data/dummy'
import { PESANAN_BERJALAN } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Daftar Stok adalah DAFTAR KEPUTUSAN, bukan tabel inventori.
 *
 * Pertanyaan yang dijawab layar ini: barang mana yang harus saya urus sekarang.
 * Karena itu urutan bawaannya "Paling genting dulu" dan tiap baris membawa
 * angka konkret, bukan kode dan bukan kolom yang harus dibaca menyamping.
 *
 * Divergensi yang disengaja: di bawah 1024px ini daftar kartu setinggi 88px,
 * di atasnya berubah jadi tabel kerja yang bisa diurutkan. Di HP tabel memaksa
 * geser horizontal; di layar lebar daftar kartu membuang ruang dan
 * menyembunyikan perbandingan antar barang yang justru dicari di meja kerja.
 *
 * Seluruh penyaring hidup di query string supaya kartu di Beranda dan
 * pemberitahuan cukup jadi tautan biasa (/stok?filter=menipis).
 */

type Penyaring =
  | 'semua'
  | 'perlu-dibeli'
  | 'menipis'
  | 'habis'
  | 'aman'
  | 'kedaluwarsa'
  | 'batas-belum-diatur'
  | 'tidak-bergerak'

type Urutan = 'genting' | 'nama' | 'terakhir' | 'sisa' | 'kategori' | 'batas' | 'status' | 'cukup'

const HARI_KEDALUWARSA_DEKAT = 14
const HARI_TIDAK_BERGERAK = 30

const LABEL_PENYARING: Record<Penyaring, string> = {
  semua: 'Semua barang',
  'perlu-dibeli': 'Perlu dibeli',
  menipis: 'Menipis',
  habis: 'Habis',
  aman: 'Aman',
  kedaluwarsa: 'Segera kedaluwarsa',
  'batas-belum-diatur': 'Batas aman belum diatur',
  'tidak-bergerak': 'Tidak bergerak',
}

const PENYARING_SAH = Object.keys(LABEL_PENYARING) as Penyaring[]

const LABEL_URUTAN: Record<Urutan, string> = {
  genting: 'Paling genting dulu',
  nama: 'Nama A-Z',
  terakhir: 'Terakhir berubah',
  sisa: 'Sisa terbanyak',
  kategori: 'Urut kategori',
  batas: 'Urut batas aman',
  status: 'Urut status',
  cukup: 'Urut cukup berapa hari',
}

const URUTAN_SAH = Object.keys(LABEL_URUTAN) as Urutan[]

/** Menyeragamkan teks supaya "Gula Aren" dan "gula-aren" dianggap sama. */
function normal(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Pencarian toleran: setiap potongan kata yang diketik cukup cocok sebagai
 * AWALAN kata mana pun pada nama, sebutan warung, atau kode barang. Pemilik
 * mengetik "skm", "telor", "gulaku" — pencocokan persis akan selalu gagal.
 */
function cocokKata(b: Barang, kata: string): boolean {
  const q = normal(kata)
  if (!q) return true
  const sumber = [b.nama, ...b.namaLain, b.kodeBarang].map(normal).filter(Boolean)
  const rapat = sumber.map((s) => s.replace(/ /g, ''))
  return q.split(' ').every(
    (potong) =>
      sumber.some((s) => s.split(' ').some((w) => w.startsWith(potong))) ||
      rapat.some((s) => s.includes(potong)),
  )
}

function hariMenujuKedaluwarsa(b: Barang): number | null {
  if (!b.ingatkanKedaluwarsa || !b.kedaluwarsa) return null
  return Math.ceil((+new Date(b.kedaluwarsa) - Date.now()) / 86_400_000)
}

function segeraKedaluwarsa(b: Barang): boolean {
  const hari = hariMenujuKedaluwarsa(b)
  return hari != null && hari <= HARI_KEDALUWARSA_DEKAT
}

export default function Stok() {
  const barang = useAplikasi((s) => s.barang)
  const pesanan = useAplikasi((s) => s.pesanan)
  const pergerakan = useAplikasi((s) => s.pergerakan)
  const aturBatasAmanMassal = useAplikasi((s) => s.aturBatasAmanMassal)

  const [param, setParam] = useSearchParams()
  const [bukaSortir, setBukaSortir] = useState(false)
  const [bukaKategori, setBukaKategori] = useState(false)
  const [menuUntuk, setMenuUntuk] = useState<Barang | null>(null)

  const cari = param.get('cari') ?? ''
  const kategori = param.get('kategori') ?? ''
  const filterMentah = param.get('filter') ?? 'semua'
  const filter: Penyaring = PENYARING_SAH.includes(filterMentah as Penyaring)
    ? (filterMentah as Penyaring)
    : 'semua'
  /* Alamat halaman bisa saja diketik atau dibagikan dengan nilai lama; urutan
     yang tidak dikenali dikembalikan ke bawaan, bukan dibiarkan kosong. */
  const urutMentah = param.get('urut') ?? 'genting'
  const urut: Urutan = URUTAN_SAH.includes(urutMentah as Urutan) ? (urutMentah as Urutan) : 'genting'

  function aturParam(ubahan: Record<string, string | null>) {
    const p = new URLSearchParams(param)
    for (const [kunci, nilai] of Object.entries(ubahan)) {
      if (nilai == null || nilai === '') p.delete(kunci)
      else p.set(kunci, nilai)
    }
    setParam(p, { replace: true })
  }

  /* Jumlah yang sedang dikirim per barang. Angka ini TIDAK PERNAH dijumlahkan
     dengan sisa stok; ia hanya dipakai untuk menahan saran "perlu dibeli"
     supaya barang yang sudah di jalan tidak dipesan dua kali. */
  const dikirimPerBarang = useMemo(() => {
    const peta = new Map<string, { jumlah: number; pesananId: string | null; tiba: string | null }>()
    for (const p of pesanan) {
      if (!PESANAN_BERJALAN.includes(p.status) || p.status === 'draf') continue
      for (const b of p.baris) {
        if (!b.barangId) continue
        const lama = peta.get(b.barangId)
        peta.set(b.barangId, {
          jumlah: (lama?.jumlah ?? 0) + b.jumlah * b.isiPerSatuan,
          pesananId: lama?.pesananId ?? p.id,
          tiba: lama?.tiba ?? p.perkiraanTiba,
        })
      }
    }
    return peta
  }, [pesanan])

  const terakhirTerjual = useMemo(() => {
    const peta = new Map<string, number>()
    for (const g of pergerakan) {
      if (g.jenis !== 'terjual') continue
      const waktu = +new Date(g.waktu)
      if (waktu > (peta.get(g.barangId) ?? 0)) peta.set(g.barangId, waktu)
    }
    return peta
  }, [pergerakan])

  /** Pergerakan apa pun, bukan cuma penjualan: dipakai urutan "Terakhir berubah". */
  const terakhirBerubah = useMemo(() => {
    const peta = new Map<string, number>()
    for (const g of pergerakan) {
      const waktu = +new Date(g.waktu)
      if (waktu > (peta.get(g.barangId) ?? 0)) peta.set(g.barangId, waktu)
    }
    return peta
  }, [pergerakan])

  function tidakBergerak(b: Barang): boolean {
    const terakhir = terakhirTerjual.get(b.id)
    if (b.dicatatManual) return false
    if (!terakhir) return true
    return (Date.now() - terakhir) / 86_400_000 > HARI_TIDAK_BERGERAK
  }

  const jumlahStatus = useMemo(() => {
    let habis = 0
    let menipis = 0
    let aman = 0
    for (const b of barang) {
      const s = statusStok(b)
      if (s === 'habis') habis += 1
      else if (s === 'menipis') menipis += 1
      else aman += 1
    }
    return { habis, menipis, aman }
  }, [barang])

  const tersaring = useMemo(() => {
    const cocokFilter = (b: Barang): boolean => {
      const s = statusStok(b)
      switch (filter) {
        case 'perlu-dibeli': {
          if (b.dicatatManual || (s !== 'habis' && s !== 'menipis')) return false
          const kurang = Math.max(0, b.batasAman - b.stok)
          return (dikirimPerBarang.get(b.id)?.jumlah ?? 0) < kurang
        }
        case 'menipis':
          return s === 'menipis'
        case 'habis':
          return s === 'habis'
        case 'aman':
          return s === 'aman' || s === 'kebanyakan'
        case 'kedaluwarsa':
          return segeraKedaluwarsa(b)
        case 'batas-belum-diatur':
          return b.sumberBatasAman === 'belum-diatur' || b.batasAman <= 0
        case 'tidak-bergerak':
          return tidakBergerak(b)
        default:
          return true
      }
    }

    const hasil = barang.filter(
      (b) => cocokFilter(b) && (!kategori || b.kategori === kategori) && cocokKata(b, cari),
    )

    const genting = (b: Barang): number => {
      const s = statusStok(b)
      if (s === 'habis') return 0
      if (s === 'menipis') return 1
      if (segeraKedaluwarsa(b)) return 2
      if (b.sumberBatasAman === 'belum-diatur' || b.batasAman <= 0) return 3
      return 4
    }
    const urutStatus: Record<string, number> = { habis: 0, menipis: 1, kebanyakan: 2, aman: 3 }

    return hasil.slice().sort((a, b) => {
      switch (urut) {
        case 'nama':
          return a.nama.localeCompare(b.nama, 'id')
        case 'terakhir':
          return (terakhirBerubah.get(b.id) ?? 0) - (terakhirBerubah.get(a.id) ?? 0)
        case 'sisa':
          return b.stok - a.stok
        case 'kategori':
          return a.kategori.localeCompare(b.kategori, 'id') || a.nama.localeCompare(b.nama, 'id')
        case 'batas':
          return b.batasAman - a.batasAman
        case 'status':
          return (
            urutStatus[statusStok(a)] - urutStatus[statusStok(b)] || a.nama.localeCompare(b.nama, 'id')
          )
        case 'cukup':
          return (hariCukup(a) ?? 9999) - (hariCukup(b) ?? 9999)
        default:
          return genting(a) - genting(b) || a.nama.localeCompare(b.nama, 'id')
      }
    })
  }, [barang, filter, kategori, cari, urut, dikirimPerBarang, terakhirTerjual, terakhirBerubah])

  const belumDiaturIds = tersaring
    .filter((b) => b.sumberBatasAman === 'belum-diatur' || b.batasAman <= 0)
    .map((b) => b.id)

  /** Menekan chip yang sedang aktif berarti melepasnya, bukan memilihnya lagi. */
  const chipAktif = (n: Penyaring): string | null => (filter === n ? null : n)

  return (
    <div className="pb-6">
      {/* ---------------- Kepala lengket ---------------- */}
      <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 pb-3 bg-bg/96 backdrop-blur-sm border-b border-line">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight mr-auto">Stok</h1>
          <TombolTautan ke="/stok/hitung" ragam="garis" ukuran="kecil" ikonKiri={<IkonGudang size={15} />}>
            Hitung Stok
          </TombolTautan>
          <TombolTautan ke="/stok/baru" ukuran="kecil" ikonKiri={<IkonTambah size={15} />}>
            Tambah Barang
          </TombolTautan>
        </div>

        {/* Di layar lebar kolom cari dan tiga angka berdiri berdampingan. Kolom
            cari selebar layar hanya membuang ruang: yang diketik ke dalamnya
            paling panjang tiga kata. */}
        <div className="lg:flex lg:items-center lg:gap-3">
          <div className="relative lg:flex-1 lg:min-w-0 lg:max-w-[22rem]">
            <label htmlFor="cari-stok" className="sr-only">
              Cari barang di daftar stok
            </label>
            <IkonCari
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            />
            <input
              id="cari-stok"
              type="search"
              value={cari}
              onChange={(e) => aturParam({ cari: e.target.value })}
              placeholder="Cari barang, misal: gula aren"
              className={cx(
                'w-full h-12 pl-11 pr-11 rounded-md bg-surface text-ink text-[0.9375rem]',
                'border border-line-strong placeholder:text-ink-3/70',
                'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]',
                '[&::-webkit-search-cancel-button]:appearance-none',
              )}
            />
            {cari && (
              <button
                type="button"
                onClick={() => aturParam({ cari: null })}
                aria-label="Hapus kata pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <IkonSilang size={18} />
              </button>
            )}
          </div>

          {/* Tiga angka yang bisa ditekan: ringkasan sekaligus penyaring */}
          <div className="mt-3 lg:mt-0 grid grid-cols-3 gap-2 lg:flex lg:gap-2.5 lg:shrink-0">
            <TombolAngka
              label="Habis"
              nilai={jumlahStatus.habis}
              nada="kritis"
              aktif={filter === 'habis'}
              onClick={() => aturParam({ filter: chipAktif('habis') })}
            />
            <TombolAngka
              label="Menipis"
              nilai={jumlahStatus.menipis}
              nada="menipis"
              aktif={filter === 'menipis'}
              onClick={() => aturParam({ filter: chipAktif('menipis') })}
            />
            <TombolAngka
              label="Aman"
              nilai={jumlahStatus.aman}
              nada="aman"
              aktif={filter === 'aman'}
              onClick={() => aturParam({ filter: chipAktif('aman') })}
            />
          </div>
        </div>

        <BarisChip className="mt-3">
          <Chip aktif={filter === 'perlu-dibeli'} onClick={() => aturParam({ filter: chipAktif('perlu-dibeli') })}>
            Perlu dibeli
          </Chip>
          <Chip aktif={filter === 'menipis'} onClick={() => aturParam({ filter: chipAktif('menipis') })}>
            Menipis
          </Chip>
          <Chip aktif={filter === 'kedaluwarsa'} onClick={() => aturParam({ filter: chipAktif('kedaluwarsa') })}>
            Segera kedaluwarsa
          </Chip>
          <Chip
            aktif={filter === 'batas-belum-diatur'}
            onClick={() => aturParam({ filter: chipAktif('batas-belum-diatur') })}
          >
            Batas aman belum diatur
          </Chip>
          <Chip
            aktif={filter === 'tidak-bergerak'}
            onClick={() => aturParam({ filter: chipAktif('tidak-bergerak') })}
          >
            Tidak bergerak
          </Chip>
          <Chip aktif={!!kategori} onClick={() => setBukaKategori(true)} ikon={<IkonKotak size={15} />}>
            {kategori || 'Kategori'}
          </Chip>
          <Chip onClick={() => setBukaSortir(true)} ikon={<IkonSaring size={15} />}>
            {LABEL_URUTAN[urut] ?? 'Urutkan'}
          </Chip>
        </BarisChip>
      </div>

      {/* ---------------- Ringkasan penyaring aktif ---------------- */}
      {(filter !== 'semua' || kategori || cari) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap text-[0.8125rem] text-ink-2">
          <span>
            Menampilkan <strong className="text-ink tabular">{angka(tersaring.length)}</strong> dari{' '}
            {angka(barang.length)} barang
            {filter !== 'semua' && <> &middot; {LABEL_PENYARING[filter]}</>}
            {kategori && <> &middot; {kategori}</>}
            {cari && <> &middot; cari &ldquo;{cari}&rdquo;</>}
          </span>
          <button
            type="button"
            onClick={() => aturParam({ filter: null, kategori: null, cari: null })}
            className="font-semibold text-brand hover:underline"
          >
            Bersihkan penyaring
          </button>
        </div>
      )}

      {/* Aksi massal hanya muncul di penyaring yang memang butuh keputusan borongan */}
      {filter === 'batas-belum-diatur' && belumDiaturIds.length > 0 && (
        <Peringatan
          nada="info"
          judul={`${belumDiaturIds.length} barang belum punya batas aman`}
          className="mt-3"
          aksi={
            <Tombol ukuran="kecil" onClick={() => aturBatasAmanMassal(belumDiaturIds)}>
              {belumDiaturIds.length === 1
                ? `Pakai saran sistem untuk ${tersaring.find((b) => b.id === belumDiaturIds[0])?.nama}`
                : 'Pakai saran sistem untuk semua barang ini'}
            </Tombol>
          }
        >
          Tanpa batas aman kami tidak bisa mengingatkan kamu sebelum barangnya habis. Saran sistem dihitung dari
          pemakaian harian dan berapa lama kiriman biasanya sampai.
        </Peringatan>
      )}

      {/* ---------------- Isi ---------------- */}
      {barang.length === 0 ? (
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Daftar stok masih kosong"
          pesan="Belum ada barang yang dicatat. Mulai dari bahan yang paling sering habis, misalnya gula aren atau susu."
          aksi={<TombolTautan ke="/stok/baru">Tambah Barang</TombolTautan>}
        />
      ) : tersaring.length === 0 ? (
        cari ? (
          /* Hasil cari nihil tidak pernah jadi layar buntu: jalan keluarnya
             adalah menambahkan barang yang barusan diketik. */
          <KeadaanKosong
            ikon={<IkonCari size={26} />}
            judul={`Tidak ada barang bernama "${cari}"`}
            pesan="Mungkin barangnya belum pernah dicatat, atau di warung kamu namanya lain. Kamu bisa langsung menambahkannya."
            aksi={
              <TombolTautan ke={`/stok/baru?nama=${encodeURIComponent(cari)}`} ikonKiri={<IkonTambah size={16} />}>
                Tambah &ldquo;{cari}&rdquo; sebagai barang baru
              </TombolTautan>
            }
            aksiKedua={
              <Tombol ragam="garis" onClick={() => aturParam({ cari: null })}>
                Hapus kata pencarian
              </Tombol>
            }
          />
        ) : (
          <KeadaanKosong
            ikon={<IkonSaring size={26} />}
            judul={
              filter === 'semua'
                ? `Belum ada barang di kategori ${kategori}`
                : filter === 'batas-belum-diatur'
                  ? 'Semua barang sudah punya batas aman'
                  : `Tidak ada barang yang ${LABEL_PENYARING[filter].toLowerCase()}`
            }
            /* Layar kosong sesudah aksi massal harus terbaca sebagai hasil
               kerja, bukan sebagai penyaring yang gagal menemukan apa pun. */
            pesan={
              filter === 'perlu-dibeli'
                ? 'Semua barang masih di atas batas aman, atau yang kurang sudah dalam perjalanan. Tidak ada yang perlu dibeli hari ini.'
                : filter === 'batas-belum-diatur'
                  ? 'Tiap barang di daftar sudah punya angka batas aman, jadi kami bisa mengingatkan kamu sebelum stoknya habis.'
                  : 'Penyaring yang kamu pilih tidak menemukan barang apa pun. Coba lepas penyaringnya untuk melihat seluruh daftar.'
            }
            aksi={
              <Tombol onClick={() => aturParam({ filter: null, kategori: null })}>Lihat semua barang</Tombol>
            }
          />
        )
      ) : (
        <>
          {/* Mobile & tablet: daftar keputusan. Tombol aksi berdiri di kolom
              sendiri supaya tidak bertumpuk di atas kartu yang seluruhnya bisa
              ditekan menuju Detail Barang. */}
          <ul className="mt-3 space-y-2.5 lg:hidden">
            {tersaring.map((b) => (
              <li key={b.id} className="flex items-stretch gap-2">
                <div className="min-w-0 grow">
                  <BarisStok barang={b} sedangDikirim={dikirimPerBarang.get(b.id)} />
                </div>
                <TombolIkon
                  label={`Aksi cepat untuk ${b.nama}`}
                  ragam="garis"
                  className="self-center"
                  onClick={() => setMenuUntuk(b)}
                >
                  <IkonTiga size={18} />
                </TombolIkon>
              </li>
            ))}
          </ul>

          {/* Desktop: tabel kerja yang bisa diurutkan */}
          {/* `relative` bukan hiasan: tanpa blok penampung sendiri, teks
              sr-only di dalam tabel (yang diposisikan absolut) lolos dari
              kliping wadah ini dan membuat SELURUH halaman bisa digeser
              menyamping di lebar 1024-1200px. */}
          <div className="relative hidden lg:block mt-4 bg-surface border border-line rounded-lg shadow-e1 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <caption className="sr-only">
                Daftar stok barang beserta sisa, batas aman, status, dan perkiraan berapa hari lagi cukup
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <KepalaKolom kunci="nama" urut={urut} atur={aturParam} rata="kiri">
                    Nama
                  </KepalaKolom>
                  <KepalaKolom kunci="kategori" urut={urut} atur={aturParam} rata="kiri">
                    Kategori
                  </KepalaKolom>
                  <KepalaKolom kunci="sisa" urut={urut} atur={aturParam} rata="kanan">
                    Sisa
                  </KepalaKolom>
                  <KepalaKolom kunci="batas" urut={urut} atur={aturParam} rata="kanan">
                    Batas aman
                  </KepalaKolom>
                  <KepalaKolom kunci="status" urut={urut} atur={aturParam} rata="kiri">
                    Status
                  </KepalaKolom>
                  <KepalaKolom kunci="cukup" urut={urut} atur={aturParam} rata="kanan">
                    Cukup berapa hari
                  </KepalaKolom>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Aksi cepat</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tersaring.map((b) => {
                  const s = statusStok(b)
                  const cukup = hariCukup(b)
                  const dikirim = dikirimPerBarang.get(b.id)
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0 hover:bg-sunken/60">
                      <td className="py-3.5 px-4 align-middle">
                        <Link
                          to={`/stok/${b.id}`}
                          className="text-[0.9375rem] font-semibold text-ink hover:text-brand transition-colors"
                        >
                          {b.nama}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-3">
                          {b.namaLain.length > 0 && <span>{b.namaLain.join(', ')}</span>}
                          {(dikirim?.jumlah ?? 0) > 0 && (
                            <Lencana nada="info">
                              Sedang dikirim {jumlahTampil(b, dikirim!.jumlah)}
                            </Lencana>
                          )}
                          {b.dicatatManual && <Lencana nada="netral">Dicatat manual</Lencana>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-middle text-[0.875rem] text-ink-2">{b.kategori}</td>
                      <td className="py-3.5 px-4 align-middle text-right">
                        <span
                          className={cx(
                            'text-[0.9375rem] font-bold tabular',
                            s === 'habis' ? 'text-kritis' : 'text-ink',
                          )}
                        >
                          {jumlahTampil(b, Math.max(0, b.stok))}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 align-middle text-right">
                        {b.sumberBatasAman === 'belum-diatur' || b.batasAman <= 0 ? (
                          <Link
                            to={`/stok/${b.id}/batas-aman`}
                            className="text-[0.8125rem] font-semibold text-brand hover:underline"
                          >
                            Belum diatur
                          </Link>
                        ) : (
                          <span className="text-[0.875rem] text-ink-2 tabular">
                            {jumlahTampil(b, b.batasAman)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-middle">
                        <ChipStok status={s} />
                      </td>
                      {/* "0 hari" tidak berarti apa-apa buat pemilik warung.
                          Yang ia perlu tahu: sisanya sudah tidak ada, atau
                          angkanya memang belum bisa dihitung. */}
                      <td className="py-3.5 px-4 align-middle text-right text-[0.875rem] text-ink-2">
                        {b.stok <= 0 ? (
                          <span>Tidak ada sisa</span>
                        ) : cukup == null ? (
                          <span className="text-ink-3">
                            {b.dicatatManual ? 'Dicatat manual' : 'Belum terbaca'}
                          </span>
                        ) : cukup === 0 ? (
                          <span>Habis hari ini</span>
                        ) : (
                          <span className="tabular">{angka(cukup)} hari</span>
                        )}
                      </td>
                      <td className="py-2 px-2 align-middle text-right">
                        <TombolIkon label={`Aksi cepat untuk ${b.nama}`} onClick={() => setMenuUntuk(b)}>
                          <IkonTiga size={18} />
                        </TombolIkon>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------------- Lembar sortir ---------------- */}
      <Lembar
        terbuka={bukaSortir}
        tutup={() => setBukaSortir(false)}
        judul="Urutkan daftar"
        keterangan="Urutan tersimpan di alamat halaman, jadi tautan yang kamu bagikan membawa urutan yang sama."
        lebar="sempit"
      >
        <div className="space-y-2.5 pb-4">
          <PilihanKartu
            terpilih={urut === 'genting'}
            nilai="genting"
            ubah={(v) => {
              aturParam({ urut: v === 'genting' ? null : v })
              setBukaSortir(false)
            }}
            judul="Paling genting dulu"
            keterangan="Habis, lalu menipis, lalu yang segera kedaluwarsa, lalu yang batas amannya belum diatur."
          />
          <PilihanKartu
            terpilih={urut === 'nama'}
            nilai="nama"
            ubah={(v) => {
              aturParam({ urut: v })
              setBukaSortir(false)
            }}
            judul="Nama A-Z"
            keterangan="Untuk mencari barang tertentu saat kamu sudah tahu namanya."
          />
          <PilihanKartu
            terpilih={urut === 'terakhir'}
            nilai="terakhir"
            ubah={(v) => {
              aturParam({ urut: v })
              setBukaSortir(false)
            }}
            judul="Terakhir berubah"
            keterangan="Barang yang stoknya paling baru bergerak, entah terjual, masuk, atau dikoreksi."
          />
          <PilihanKartu
            terpilih={urut === 'sisa'}
            nilai="sisa"
            ubah={(v) => {
              aturParam({ urut: v })
              setBukaSortir(false)
            }}
            judul="Sisa terbanyak"
            keterangan="Untuk melihat barang yang menumpuk dan mengikat uang."
          />
        </div>
      </Lembar>

      {/* ---------------- Lembar kategori ---------------- */}
      <Lembar
        terbuka={bukaKategori}
        tutup={() => setBukaKategori(false)}
        judul="Saring menurut kategori"
        keterangan="Kategori hanya penyaring, bukan folder. Satu barang tetap punya satu tempat di daftar."
        lebar="sempit"
        kaki={
          <Link
            to="/stok/kategori"
            className="block text-center text-[0.875rem] font-bold text-brand hover:underline"
          >
            Kelola daftar kategori
          </Link>
        }
      >
        <div className="pb-4 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              aturParam({ kategori: null })
              setBukaKategori(false)
            }}
            className={cx(
              'w-full flex items-center justify-between gap-3 h-12 px-3.5 rounded-md text-left text-[0.9375rem] font-semibold',
              !kategori ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink hover:bg-sunken',
            )}
          >
            Semua kategori
            <span className="text-[0.8125rem] text-ink-3 tabular">{angka(barang.length)}</span>
          </button>
          {kategoriBarang.map((k) => {
            const jumlah = barang.filter((b) => b.kategori === k).length
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  aturParam({ kategori: k })
                  setBukaKategori(false)
                }}
                className={cx(
                  'w-full flex items-center justify-between gap-3 h-12 px-3.5 rounded-md text-left text-[0.9375rem] font-semibold',
                  kategori === k ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink hover:bg-sunken',
                )}
              >
                {k}
                <span className="text-[0.8125rem] text-ink-3 tabular">{angka(jumlah)}</span>
              </button>
            )
          })}
        </div>
      </Lembar>

      {/* ---------------- Lembar aksi per baris ---------------- */}
      <LembarAksiBaris barang={menuUntuk} tutup={() => setMenuUntuk(null)} />
    </div>
  )
}

/* ================================================================== */
/* Potongan khusus halaman ini                                        */
/* ================================================================== */

function TombolAngka({
  label,
  nilai,
  nada,
  aktif,
  onClick,
}: {
  label: string
  nilai: number
  nada: 'kritis' | 'menipis' | 'aman'
  aktif: boolean
  onClick: () => void
}) {
  const warna = {
    kritis: 'text-kritis',
    menipis: 'text-menipis-ink',
    aman: 'text-aman-ink',
  }[nada]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      /* Angka sendirian ("1 · Habis") tidak menyebut satuannya. Pembaca layar
         perlu mendengar apa yang dihitung dan apa yang terjadi kalau ditekan. */
      aria-label={`${angka(nilai)} barang ${label.toLowerCase()}. ${
        aktif ? 'Ketuk untuk melepas penyaring ini.' : 'Ketuk untuk menyaring daftar.'
      }`}
      className={cx(
        'min-h-[3rem] rounded-md border px-3 py-2 text-left transition-colors lg:w-[7.5rem]',
        aktif ? 'border-brand bg-brand-soft/50' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span aria-hidden="true" className={cx('block text-[1.5rem] font-bold leading-none', warna)}>
        {angka(nilai)}
      </span>
      <span aria-hidden="true" className="block text-[0.75rem] font-semibold text-ink-2 mt-1">
        {label}
      </span>
    </button>
  )
}

function KepalaKolom({
  kunci,
  urut,
  atur,
  rata,
  children,
}: {
  kunci: Urutan
  urut: Urutan
  atur: (u: Record<string, string | null>) => void
  rata: 'kiri' | 'kanan'
  children: string
}) {
  const aktif = urut === kunci
  const menurun = kunci === 'sisa' || kunci === 'batas'
  return (
    <th
      scope="col"
      aria-sort={aktif ? (menurun ? 'descending' : 'ascending') : 'none'}
      className={cx('px-4 py-2.5', rata === 'kanan' ? 'text-right' : 'text-left')}
    >
      <button
        type="button"
        onClick={() => atur({ urut: aktif ? null : kunci })}
        className={cx(
          'inline-flex items-center gap-1 text-[0.75rem] font-bold uppercase tracking-wide',
          aktif ? 'text-brand' : 'text-ink-2 hover:text-ink',
        )}
      >
        {children}
        {aktif ? (
          menurun ? (
            <IkonPanahBawah size={13} />
          ) : (
            <IkonPanahAtas size={13} />
          )
        ) : (
          <IkonPanahBawah size={13} className="opacity-0" />
        )}
      </button>
    </th>
  )
}

/**
 * Tiga aksi yang paling sering dibutuhkan dari daftar, tanpa harus membuka
 * Detail Barang lebih dulu. Semuanya berpindah halaman, tidak ada yang bekerja
 * diam-diam di belakang layar.
 */
function LembarAksiBaris({ barang, tutup }: { barang: Barang | null; tutup: () => void }) {
  if (!barang) return null
  const penawaran = penawaranUntukBarang(barang.id)
  const kePesan =
    penawaran.length > 0
      ? `/penawaran/${penawaran[0].id}`
      : `/belanja?cari=${encodeURIComponent(barang.nama)}`

  const aksi = [
    {
      ke: `/stok/${barang.id}/koreksi`,
      ikon: <IkonPena size={18} />,
      judul: 'Koreksi Stok',
      bantuan: 'Catat barang yang basi, rusak, susut, atau datang tanpa pesanan.',
    },
    {
      ke: kePesan,
      ikon: <IkonKeranjang size={18} />,
      judul: 'Pesan',
      bantuan:
        penawaran.length > 0
          ? 'Buka penawaran distributor untuk barang ini.'
          : 'Belum ada penawaran tersimpan, kami carikan di Distributor.',
    },
    {
      ke: `/stok/${barang.id}/batas-aman`,
      ikon: <IkonPeringatan size={18} />,
      judul: 'Atur batas aman',
      bantuan: 'Tentukan kapan kami mulai mengingatkan kamu.',
    },
  ]

  return (
    <Lembar terbuka tutup={tutup} judul={barang.nama} keterangan="Pilih satu tindakan" lebar="sempit">
      <div className="pb-4 space-y-2">
        {aksi.map((a) => (
          <Link
            key={a.judul}
            to={a.ke}
            onClick={tutup}
            className="flex items-center gap-3 min-h-[3.5rem] px-3.5 py-3 rounded-md border border-line bg-surface hover:border-line-strong hover:bg-sunken transition-colors"
          >
            <span className="shrink-0 size-9 rounded-md bg-sunken text-ink-2 grid place-items-center">
              {a.ikon}
            </span>
            <span className="min-w-0 grow">
              <span className="block text-[0.9375rem] font-bold text-ink leading-snug">{a.judul}</span>
              <span className="block text-[0.8125rem] text-ink-3 leading-snug mt-0.5">{a.bantuan}</span>
            </span>
            <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
          </Link>
        ))}
      </div>
    </Lembar>
  )
}
