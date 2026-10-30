import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Barang, BuktiPengiriman, Kontrak, Perkiraan, Pesanan, StatusStok } from '@/lib/types'
import {
  BANTUAN,
  JUDUL,
  LABEL_KEMATANGAN,
  LABEL_KUOTA,
  LABEL_PESANAN,
  LABEL_STOK,
  NADA_KEMATANGAN,
  NADA_KUOTA,
  NADA_PESANAN,
  NADA_STOK,
} from '@/lib/label'
import { angka, angkaJumlah, cx, hariLagi, jam, rupiah, tanggalPendek, waktuLalu, waktuNanti } from '@/lib/format'
import { angkaTampil, jumlahTampil, satuanTampil } from '@/lib/satuan'
import {
  IkonCentangLingkaran,
  IkonPeringatan,
  IkonSilang,
  IkonJam,
  IkonPasokan,
  IkonPanahKanan,
  IkonKunci,
  IkonPetir,
  IkonKotak,
} from '@/icons'
import { Kartu, Lencana, Tombol, TombolTautan, Avatar } from '@/components/ui/dasar'
import { BilahProgres } from '@/components/ui/umpanBalik'
import { Lembar } from '@/components/ui/lembar'
import {
  dalamKemasan,
  hariCukup,
  statusKuota,
  sisaHariPeriode,
  distributorById,
  statusStok,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/* ================================================================== */
/* Chip status                                                        */
/* ================================================================== */

const IKON_STOK: Record<StatusStok, ReactNode> = {
  aman: <IkonCentangLingkaran size={13} />,
  menipis: <IkonPeringatan size={13} />,
  habis: <IkonSilang size={13} />,
}

/**
 * Status selalu tiga lapis: ikon, teks, warna.
 * Warna sendirian tidak pernah cukup, baik untuk pengguna buta warna maupun
 * untuk layar HP murah yang kontrasnya rendah di bawah sinar matahari.
 */
export function ChipStok({ status, besar }: { status: StatusStok; besar?: boolean }) {
  return (
    <Lencana nada={NADA_STOK[status]} ikon={IKON_STOK[status]} besar={besar}>
      {LABEL_STOK[status]}
    </Lencana>
  )
}

export function ChipPesanan({
  status,
  besar,
  className,
}: {
  status: Pesanan['status']
  besar?: boolean
  className?: string
}) {
  return (
    <Lencana nada={NADA_PESANAN[status]} besar={besar} className={className}>
      {LABEL_PESANAN[status]}
    </Lencana>
  )
}

export function ChipKedaluwarsa({ tanggal }: { tanggal: string }) {
  const hari = Math.ceil((+new Date(tanggal) - Date.now()) / 86_400_000)
  if (hari > 14) return null
  return (
    <Lencana nada={hari <= 3 ? 'kritis' : 'menipis'} ikon={<IkonJam size={13} />}>
      Kedaluwarsa {hariLagi(hari)}
    </Lencana>
  )
}

/* ================================================================== */
/* Pita Data Kasir                                                    */
/* ================================================================== */

/**
 * Baris ketiga kepala Beranda: dari mana angka stok datang dan seberapa baru.
 *
 * Sejak revisi V6 (Q124, Q131) semua keadaan memakai satu gaya, seperti
 * "Data kasir masuk 12 menit lalu" di gambar referensi: ikon bulat bergradien
 * dan teks kecil, tanpa pita berwarna. Ikonnya di `public/gambar/status/`:
 * centang dari Ilham untuk data yang baru, dan tiga ikon sejenis untuk data
 * yang sudah lama (amber), produsen dan catat manual (ungu), serta kasir yang
 * belum tersambung atau sedang menyinkron (biru). Maknanya selalu dibawa teks.
 */
export function PitaDataKasir() {
  const kasir = useAplikasi((s) => s.kasir)
  const produsen = useAplikasi((s) => s.profil.jenisUsaha === 'produksi-makanan')

  // Usaha produsen tidak memakai kasir: pemakaian bahan datang dari sesi masak.
  if (produsen) {
    return (
      <BarisStatus ikon="produksi" tautan={{ ke: '/produksi', label: 'Buka Produksi' }}>
        Pemakaian bahan baku dicatat dari sesi masak
      </BarisStatus>
    )
  }

  if (kasir.sumber === 'belum-dipilih' || kasir.status === 'belum-terhubung') {
    return (
      <BarisStatus ikon="info" tautan={{ ke: '/akun/kasir', label: 'Hubungkan' }}>
        Aplikasi kasir belum tersambung, stok tidak berkurang otomatis
      </BarisStatus>
    )
  }

  if (kasir.sumber === 'catat-manual') {
    return (
      <BarisStatus ikon="produksi" tautan={{ ke: '/stok/pemakaian', label: 'Catat hari ini' }}>
        Kamu mencatat pemakaian manual
      </BarisStatus>
    )
  }

  if (kasir.status === 'menyinkron') {
    return <BarisStatus ikon="info">Sedang mengambil data dari kasir&hellip;</BarisStatus>
  }

  const terakhir = kasir.terakhirMasuk ? new Date(kasir.terakhirMasuk) : null
  const jamBerlalu = terakhir ? (Date.now() - +terakhir) / 3_600_000 : 99

  if (jamBerlalu > 18) {
    return (
      <BarisStatus ikon="amber" tautan={{ ke: '/akun/kasir', label: 'Cek Koneksi Kasir' }}>
        Data kasir terakhir masuk <b className="font-bold text-ink">{terakhir ? waktuLalu(terakhir) : 'sudah lama'}</b>,
        angka stok mungkin belum sesuai
      </BarisStatus>
    )
  }

  return (
    <BarisStatus ikon="centang">
      Data kasir masuk <b className="font-bold text-ink">{terakhir ? waktuLalu(terakhir) : 'baru saja'}</b>
    </BarisStatus>
  )
}

const IKON_STATUS = {
  centang: 'centang.png',
  amber: 'amber.svg',
  produksi: 'produksi.svg',
  info: 'info.svg',
} as const

function BarisStatus({
  ikon,
  tautan,
  children,
}: {
  ikon: keyof typeof IKON_STATUS
  tautan?: { ke: string; label: string }
  children: ReactNode
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 min-h-8 text-isi text-ink-2 leading-snug">
      <img
        src={`${import.meta.env.BASE_URL}gambar/status/${IKON_STATUS[ikon]}`}
        alt=""
        width={18}
        height={18}
        className="size-[1.125rem] shrink-0"
      />
      <span>{children}</span>
      {tautan && (
        <Link to={tautan.ke} className="font-bold text-brand hover:underline underline-offset-2">
          {tautan.label}
        </Link>
      )}
    </p>
  )
}

/* ================================================================== */
/* Banner status akun                                                 */
/* ================================================================== */

/**
 * Bisa diciutkan, tapi tidak bisa ditutup. Akun yang datanya ditolak harus
 * selalu punya jalan keluar yang terlihat, bukan tersembunyi di pengaturan.
 */
export function BannerAkun() {
  const profil = useAplikasi((s) => s.profil)
  const [ciut, setCiut] = useState(false)

  if (profil.verifikasi === 'terverifikasi') return null

  const perluDiperbaiki = profil.verifikasi === 'perlu-diperbaiki'
  const gaya = perluDiperbaiki
    ? 'bg-kritis-soft text-kritis-ink border-kritis/30'
    : 'bg-menipis-soft text-menipis-ink border-menipis/30'

  if (ciut) {
    return (
      <button
        type="button"
        onClick={() => setCiut(false)}
        className={cx('w-full text-left px-3 py-2 rounded-md border text-isi font-semibold', gaya)}
      >
        {perluDiperbaiki ? 'Data usaha perlu diperbaiki' : 'Akun sedang diperiksa'} &middot; lihat detail
      </button>
    )
  }

  return (
    <div className={cx('rounded-md border p-3.5', gaya)}>
      <div className="flex items-start gap-2.5">
        <IkonPeringatan size={18} className="shrink-0 mt-px" />
        <div className="min-w-0 grow">
          <p className="text-isi font-bold">
            {perluDiperbaiki ? 'Data usaha perlu diperbaiki' : 'Akun sedang diperiksa'}
          </p>
          {perluDiperbaiki ? (
            <ul className="mt-1.5 text-isi space-y-1 list-disc pl-4 opacity-90">
              {profil.alasanPerbaikan.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-isi opacity-90 leading-relaxed">
              Kami kabari lewat WhatsApp begitu selesai. Sementara ini kamu tetap bisa memakai semua fitur kecuali
              mengajukan kontrak dan membuat pesanan.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <TombolTautan ke={perluDiperbaiki ? '/akun/data-usaha' : '/akun/profil'} ragam="garis" ukuran="kecil">
              {perluDiperbaiki ? 'Perbaiki Data' : 'Lihat status'}
            </TombolTautan>
            <button
              type="button"
              onClick={() => setCiut(true)}
              className="text-isi font-semibold underline underline-offset-2"
            >
              Ciutkan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Tombol yang mengikat pihak ketiga tetap TERLIHAT saat akun belum diverifikasi,
 * hanya digembok. Menyembunyikannya membuat pengguna mengira fiturnya tidak ada.
 */
export function useTerkunci() {
  const verifikasi = useAplikasi((s) => s.profil.verifikasi)
  return verifikasi !== 'terverifikasi'
}

export function TombolTerkunci({ label, penuh }: { label: string; penuh?: boolean }) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Tombol
        ragam="halus"
        penuh={penuh}
        ikonKiri={<IkonKunci size={16} />}
        onClick={() => setBuka(true)}
        className="!text-ink-3"
      >
        {label}
      </Tombol>
      <Lembar
        terbuka={buka}
        tutup={() => setBuka(false)}
        judul="Fitur ini aktif setelah akun diverifikasi"
        lebar="sempit"
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={() => setBuka(false)}>
              Nanti saja
            </Tombol>
            <TombolTautan ke="/akun/profil" penuh>
              Cek Status
            </TombolTautan>
          </div>
        }
      >
        <p className="pb-4 text-kartu text-ink-2 leading-relaxed">
          Kontrak dan pesanan mengikat kamu dengan distributor, jadi keduanya baru terbuka setelah data usahamu
          diperiksa. Selama menunggu, kamu tetap bisa melihat stok, menjelajah katalog, dan membandingkan harga.
        </p>
      </Lembar>
    </>
  )
}

/* ================================================================== */
/* Kuota Bulan Ini                                                    */
/* ================================================================== */

/**
 * Bar dua segmen: yang sudah diterima, dan yang sedang dalam perjalanan.
 *
 * Keduanya sengaja dipisah karena hanya barang yang benar-benar diterima yang
 * menghitung kuota. Menggabungkannya akan membuat pemilik usaha merasa aman
 * padahal kirimannya bisa saja batal.
 *
 * Komponen ini tidak pernah menonaktifkan tombol apa pun. Ia memberi tahu,
 * bukan menghukum, karena aturan sanksinya ada di kontrak, bukan di aplikasi.
 */
export function KuotaBulanIni({ kontrak, ringkas }: { kontrak: Kontrak; ringkas?: boolean }) {
  const status = statusKuota(kontrak)
  const { kuota, diterima } = kontrak.periodeBerjalan
  const jalan = kontrak.dalamPerjalanan
  const kurang = Math.max(0, kuota - diterima - jalan)
  const sisaHari = sisaHariPeriode()
  const persenDiterima = Math.min(100, (diterima / kuota) * 100)
  const persenJalan = Math.min(100 - persenDiterima, (jalan / kuota) * 100)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-isi font-bold text-ink">{JUDUL.kuotaBulanIni}</p>
          <p className="text-kecil text-ink-3">{BANTUAN.kuota}</p>
        </div>
        <Lencana nada={NADA_KUOTA[status]} besar>
          {LABEL_KUOTA[status]}
        </Lencana>
      </div>

      <div className="h-2.5 w-full rounded-full bg-sunken overflow-hidden flex">
        <div
          className="h-full bg-brand transition-[width] duration-500"
          style={{ width: `${persenDiterima}%` }}
        />
        {persenJalan > 0 && (
          <div
            className="h-full bg-info/55 transition-[width] duration-500"
            style={{ width: `${persenJalan}%`, marginLeft: 2 }}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-isi">
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-full bg-brand" aria-hidden="true" />
          Sudah diterima{' '}
          <strong className="text-ink tabular">
            {angkaJumlah(diterima)} {kontrak.satuan}
          </strong>
        </span>
        {jalan > 0 && (
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="size-2.5 rounded-full bg-info/55" aria-hidden="true" />
            Dalam perjalanan{' '}
            <strong className="text-ink tabular">
              {angkaJumlah(jalan)} {kontrak.satuan}
            </strong>
          </span>
        )}
        <span className="text-ink-3">
          dari {angkaJumlah(kuota)} {kontrak.satuan}
        </span>
      </div>

      {/* Keadaan "sudah terpenuhi" sengaja tidak ditulis di sini. Bar yang penuh
          sudah menyatakannya, dan satu-satunya pemakai mode penuh (Rincian
          Kontrak) menyampaikannya sendiri dengan ikon dan kalimat yang lebih
          tegas. Menulisnya di dua tempat membuat kalimatnya muncul dua kali. */}
      {!ringkas && kurang > 0 && (
        <p className="mt-2 text-isi text-ink-2">
          Kurang{' '}
          <strong className="text-ink tabular">
            {angkaJumlah(kurang)} {kontrak.satuan}
          </strong>{' '}
          &middot; sisa {sisaHari} hari
        </p>
      )}
      {!ringkas && <p className="mt-1 text-kecil text-ink-3">{BANTUAN.kuotaBertambah}</p>}
    </div>
  )
}

/* ================================================================== */
/* Kartu Perkiraan                                                    */
/* ================================================================== */

/**
 * Tiga keadaan kematangan data, diisolasi di tingkat kartu. Simulasi turun
 * derajat layanan (hitungan sederhana, perkiraan tidak tampil) dihapus di
 * revisi V5 (Q103) bersama tombolnya di Akun.
 */
export function KartuPerkiraan({
  barang,
  perkiraan,
  bawah,
}: {
  barang: Barang
  perkiraan: Perkiraan
  /** Isi tambahan di bawah perkiraan, mis. rincian tiga hari ke depan. */
  bawah?: ReactNode
}) {
  if (perkiraan.kematangan === 'belum-bisa') {
    const terkumpul = barang.hariDataTerkumpul
    return (
      <Kartu padat>
        <div className="flex items-start justify-between gap-2">
          <p className="text-kartu font-bold text-ink leading-snug">{barang.nama}</p>
          <Lencana nada={NADA_KEMATANGAN['belum-bisa']}>{LABEL_KEMATANGAN['belum-bisa']}</Lencana>
        </div>
        <p className="mt-1.5 text-isi text-ink-2">
          sisa {jumlahTampil(barang, barang.stok)}
          {barang.pemakaianHarian > 0 && (
            <> &middot; rata-rata pakai {jumlahTampil(barang, barang.pemakaianHarian)}/hari</>
          )}
        </p>
        <div className="mt-2.5">
          <BilahProgres nilai={terkumpul} maks={14} nada="netral" tinggi={6} />
          <p className="mt-1.5 text-kecil text-ink-3">
            Data terkumpul {terkumpul} dari 14 hari &mdash; perkiraan mulai muncul {14 - terkumpul} hari lagi.
          </p>
        </div>
        <TombolTautan ke={`/stok/${barang.id}/batas-aman`} ragam="garis" ukuran="kecil" className="mt-2.5">
          Atur batas aman
        </TombolTautan>
      </Kartu>
    )
  }

  return (
    <Kartu padat>
      <div className="flex items-start justify-between gap-2">
        <p className="text-kartu font-bold text-ink leading-snug">{barang.nama}</p>
        <Lencana nada={NADA_KEMATANGAN[perkiraan.kematangan]}>{LABEL_KEMATANGAN[perkiraan.kematangan]}</Lencana>
      </div>
      <Link
        to={`/stok/${barang.id}`}
        className="mt-1.5 block text-[1.125rem] font-extrabold text-ink hover:text-brand transition-colors"
      >
        {/* Nol hari berarti perkiraan pemakaian hari pertama saja sudah melebihi
            sisa stok; "cukup untuk ±0 hari" dulu terbaca janggal (revisi 23 Okt). */}
        {perkiraan.hariCukup === 0 ? 'Stok tidak cukup' : <>Stok cukup untuk &plusmn;{perkiraan.hariCukup} hari</>}
      </Link>
      <p className="mt-1 text-isi text-ink-3">
        Perkiraan pakai 3 hari ke depan: {angkaTampil(barang, perkiraan.pakaiTigaHariMin ?? 0)}&ndash;
        {angkaTampil(barang, perkiraan.pakaiTigaHariMaks ?? 0)} {satuanTampil(barang).nama}
      </p>
      {perkiraan.dibuatPada && (
        <p className="mt-1 text-kecil text-ink-3">
          Perkiraan dibuat {waktuLalu(perkiraan.dibuatPada)}.
        </p>
      )}
      {bawah}
    </Kartu>
  )
}

/* ================================================================== */
/* Baris daftar stok                                                  */
/* ================================================================== */

/**
 * Baris keputusan, bukan baris tabel.
 *
 * Aturan yang tidak boleh dilanggar: hanya satu angka yang boleh besar dalam
 * satu baris. Angka sisa stok memenangkan tempat itu, karena itulah yang
 * dicari pemilik usaha saat membuka daftar ini.
 */
export function BarisStok({ barang, sedangDikirim }: { barang: Barang; sedangDikirim?: { jumlah: number; pesananId: string | null; tiba: string | null } }) {
  const status = statusStok(barang)
  const cukup = hariCukup(barang)
  const kemasan = dalamKemasan(barang)
  const kontrak = useAplikasi((s) => s.kontrak.find((k) => k.barangId === barang.id && k.status !== 'selesai'))

  const rasio = barang.batasAman > 0 ? Math.min(1, barang.stok / barang.batasAman) : 1
  const warnaMeter =
    status === 'habis' ? 'bg-kritis' : status === 'menipis' ? 'bg-menipis' : 'bg-aman'

  return (
    <Link
      to={`/stok/${barang.id}`}
      className="block bg-surface border border-line rounded-lg p-4 min-h-[88px] transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2 active:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 grow">
          <p className="text-[1rem] font-semibold text-ink leading-snug line-clamp-2">{barang.nama}</p>
          <p className="mt-0.5 text-kecil text-ink-3">
            {barang.deskripsi ? `${barang.deskripsi} · ${barang.kategori}` : barang.kategori}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cx(
              'text-[1.5rem] font-bold leading-none tabular',
              status === 'habis' ? 'text-kritis' : 'text-ink',
            )}
          >
            {angkaTampil(barang, barang.stok)}
          </p>
          <p className="text-kecil text-ink-3 mt-0.5">{satuanTampil(barang).nama}</p>
        </div>
      </div>

      <div className="mt-2.5 h-1 w-full rounded-full bg-sunken overflow-hidden">
        <div className={cx('h-full rounded-full', warnaMeter)} style={{ width: `${Math.max(3, rasio * 100)}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ChipStok status={status} />
        <span className="text-isi text-ink-2">
          sisa {jumlahTampil(barang, barang.stok)}
          {cukup != null && cukup > 0 && barang.pemakaianHarian > 0 && <> &middot; cukup &plusmn;{cukup} hari</>}
        </span>
      </div>

      {(kemasan || barang.kedaluwarsa || !barang.terhubungKasir || kontrak || (sedangDikirim?.jumlah ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-kecil text-ink-3">
          {kemasan && <span>= {kemasan}</span>}
          {barang.kedaluwarsa && barang.ingatkanKedaluwarsa && <ChipKedaluwarsa tanggal={barang.kedaluwarsa} />}
          {!barang.terhubungKasir && !barang.dicatatManual && (
            <Lencana nada="menipis">Belum terhubung ke menu</Lencana>
          )}
          {barang.dicatatManual && <Lencana nada="netral">Dicatat manual</Lencana>}
          {kontrak && <Lencana nada="merek">Kontrak</Lencana>}
          {(sedangDikirim?.jumlah ?? 0) > 0 && (
            <Lencana nada="info" ikon={<IkonPasokan size={13} />}>
              Sedang dikirim {jumlahTampil(barang, sedangDikirim!.jumlah)}
              {sedangDikirim!.tiba ? ` (tiba ${tanggalPendek(sedangDikirim!.tiba)})` : ''}
            </Lencana>
          )}
        </div>
      )}
    </Link>
  )
}

/* ================================================================== */
/* Kartu pesanan                                                      */
/* ================================================================== */

export function KartuPesanan({ pesanan }: { pesanan: Pesanan }) {
  const distributor = distributorById(pesanan.distributorId)
  const total =
    pesanan.baris.reduce((a, b) => a + b.jumlah * b.hargaSatuan, 0) + pesanan.ongkosKirim
  const utama = pesanan.baris[0]
  const lain = pesanan.baris.length - 1

  /* Seluruh kartu tetap bisa ditekan lewat tautan yang direntangkan di nama
     distributor; tombol "Terima Barang" duduk di atasnya, jadi tidak ada
     tautan di dalam tautan. */
  const bisaDiterima = pesanan.status === 'dikirim'
  return (
    <div className="relative bg-surface border border-line rounded-lg p-4 min-h-[72px] transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2 active:bg-surface-2">
      <div className="flex items-start gap-3">
        <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={40} />
        <div className="min-w-0 grow">
          {/* Baris judul boleh membungkus: kalau sempit, lencana status turun ke
              bawah nama, bukan memotong nama distributor ("Sumber Tani Nus…"). */}
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <p className="min-w-0 text-kartu font-bold text-ink line-clamp-2">
              <Link to={`/pesanan/${pesanan.id}`} className="after:absolute after:inset-0 after:rounded-lg">
                {distributor?.nama}
              </Link>
            </p>
            <ChipPesanan status={pesanan.status} className="shrink-0 whitespace-nowrap" />
          </div>
          <p className="mt-0.5 text-isi text-ink-2 truncate">
            {utama ? `${utama.nama} ${angka(utama.jumlah)} ${utama.satuan}` : 'Pesanan kosong'}
            {lain > 0 && ` + ${lain} barang lain`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-kecil text-ink-3">
            <span className="tabular">{rupiah(total)}</span>
            {pesanan.status === 'dikirim' && pesanan.pengiriman ? (
              <span className="text-brand font-semibold">Sudah sampai, tinggal dihitung</span>
            ) : (
              pesanan.perkiraanTiba &&
              pesanan.status !== 'selesai' &&
              pesanan.status !== 'batal' && <span>Perkiraan tiba {waktuNanti(pesanan.perkiraanTiba)}</span>
            )}
            {pesanan.statusBayar === 'belum-dibayar' && pesanan.status !== 'draf' && (
              <span className="text-menipis-ink font-semibold">Belum dibayar</span>
            )}
            {pesanan.dariRutin && (
              <span className="inline-flex items-center gap-1">
                <IkonPetir size={12} /> Pesanan rutin
              </span>
            )}
          </div>
        </div>
        <IkonPanahKanan size={18} className="shrink-0 text-ink-3 mt-1" />
      </div>
      {bisaDiterima && (
        <div className="relative z-10 mt-3 pl-[52px]">
          <TombolTautan ke={`/pesanan/${pesanan.id}/terima`} ragam="sekunder" ukuran="kecil" penuh="hp">
            Terima Barang
          </TombolTautan>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Bukti pengiriman                                                   */
/* ================================================================== */

/** Satu baris label-nilai di kartu bukti dan ringkasan ulasan. */
export function BarisBukti({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-isi text-ink-3 shrink-0">{label}</dt>
      <dd className="text-isi font-semibold text-ink text-right min-w-0 break-words">{nilai}</dd>
    </div>
  )
}

/**
 * Bukti antar dari distributor: siapa yang mengantar, kapan sampai, dan foto
 * serah terima. Dipakai di DUA sisi, distributor yang mencatatnya dan pemilik
 * usaha yang menerima barangnya, jadi keduanya selalu membaca bukti yang sama.
 */
export function KartuBuktiPengiriman({ bukti, keterangan }: { bukti: BuktiPengiriman; keterangan?: ReactNode }) {
  const idJudul = useId()
  return (
    <section aria-labelledby={idJudul}>
      <Kartu>
        <h2 id={idJudul} className="text-kartu font-bold text-ink mb-3">
          Bukti Pengiriman
        </h2>
        {keterangan && (
          <p className="-mt-1.5 mb-3 text-isi text-ink-2 leading-relaxed max-w-[60ch]">{keterangan}</p>
        )}
        <dl className="space-y-1.5">
          <BarisBukti label="Jasa kirim" nilai={bukti.kurir} />
          <BarisBukti label="Pengantar" nilai={bukti.namaPengantar} />
          <BarisBukti label="Nomor resi" nilai={bukti.nomorResi} />
          <BarisBukti label="Diterima oleh" nilai={bukti.diterimaOleh} />
          <BarisBukti label="Waktu sampai" nilai={`${tanggalPendek(bukti.waktuSampai)}, ${jam(bukti.waktuSampai)}`} />
        </dl>

        <p className="mt-3 text-isi text-ink-2 leading-relaxed max-w-[60ch]">{bukti.catatan}</p>

        {/* Bingkai berlabel, bukan gambar. Foto palsu akan membuat layar ini
            terlihat lebih jadi daripada keadaannya. */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {bukti.foto.map((k) => (
            <div key={k} className="border-2 border-dashed border-line-strong rounded-md p-3 text-center">
              <IkonKotak size={20} className="mx-auto text-ink-3" />
              <p className="mt-1.5 text-kecil text-ink-2 leading-snug">{k}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-kecil text-ink-3 leading-relaxed">
          Berkas fotonya belum ikut disimpan di purwarupa ini, yang tercatat baru keterangannya.
        </p>
      </Kartu>
    </section>
  )
}
