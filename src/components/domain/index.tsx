import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Barang, Kontrak, Perkiraan, Pesanan, StatusStok } from '@/lib/types'
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
import {
  angka,
  cx,
  hariLagi,
  rupiah,
  tanggalPendek,
  waktuLalu,
  waktuNanti,
} from '@/lib/format'
import { angkaTampil, jumlahTampil, satuanTampil } from '@/lib/satuan'
import {
  IkonCentangLingkaran,
  IkonPeringatan,
  IkonSilang,
  IkonJam,
  IkonPasokan,
  IkonSinkron,
  IkonTanpaSinyal,
  IkonPanahKanan,
  IkonKunci,
  IkonPena,
  IkonPetir,
} from '@/icons'
import { Kartu, Lencana, Tombol, TombolTautan, Avatar, type NadaLencana } from '@/components/ui/dasar'
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

export function ChipPesanan({ status, besar }: { status: Pesanan['status']; besar?: boolean }) {
  return (
    <Lencana nada={NADA_PESANAN[status]} besar={besar}>
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
 * Satu baris setinggi 32px di paling atas Beranda.
 *
 * Keadaan sehat sengaja dibuat paling tidak menonjol: kalau semuanya normal,
 * pita ini tidak boleh merebut perhatian dari daftar yang perlu diurus.
 */
export function PitaDataKasir() {
  const kasir = useAplikasi((s) => s.kasir)

  if (kasir.sumber === 'belum-dipilih' || kasir.status === 'belum-terhubung') {
    return (
      <PitaDasar nada="info" ikon={<IkonSinkron size={15} />}>
        <span>Aplikasi kasir belum tersambung &mdash; stok tidak berkurang otomatis</span>
        <Link to="/akun/kasir" className="font-bold underline underline-offset-2 shrink-0">
          Hubungkan
        </Link>
      </PitaDasar>
    )
  }

  if (kasir.sumber === 'catat-manual') {
    return (
      <PitaDasar nada="netral" ikon={<IkonPena size={15} />}>
        <span>Kamu mencatat pemakaian manual</span>
        <Link to="/stok/pemakaian" className="font-bold underline underline-offset-2 shrink-0">
          Catat hari ini
        </Link>
      </PitaDasar>
    )
  }

  if (kasir.status === 'menyinkron') {
    return (
      <PitaDasar nada="netral" ikon={<IkonSinkron size={15} className="animate-spin" />}>
        <span>Sedang mengambil data dari kasir&hellip;</span>
      </PitaDasar>
    )
  }

  const terakhir = kasir.terakhirMasuk ? new Date(kasir.terakhirMasuk) : null
  const jamBerlalu = terakhir ? (Date.now() - +terakhir) / 3_600_000 : 99

  if (jamBerlalu > 18) {
    return (
      <PitaDasar nada="menipis" ikon={<IkonTanpaSinyal size={15} />}>
        <span>
          Belum ada data baru dari kasir sejak {terakhir ? waktuLalu(terakhir) : 'lama'}. Angka stok di bawah
          mungkin sudah tidak sesuai.
        </span>
        <Link to="/akun/kasir" className="font-bold underline underline-offset-2 shrink-0">
          Cek Koneksi Kasir
        </Link>
      </PitaDasar>
    )
  }

  return (
    <p className="text-[0.8125rem] text-ink-3 flex items-center gap-1.5 h-8">
      <IkonCentangLingkaran size={14} className="text-aman shrink-0" />
      Data kasir masuk {terakhir ? waktuLalu(terakhir) : 'baru saja'}
    </p>
  )
}

function PitaDasar({
  nada,
  ikon,
  children,
}: {
  nada: 'info' | 'menipis' | 'netral'
  ikon: ReactNode
  children: ReactNode
}) {
  const gaya = {
    info: 'bg-info-soft text-info-ink',
    menipis: 'bg-menipis-soft text-menipis-ink',
    netral: 'bg-netral-soft text-netral-ink',
  }[nada]
  return (
    <div
      className={cx(
        'flex items-center gap-2 px-3 min-h-8 py-1.5 rounded-sm text-[0.8125rem] leading-snug',
        gaya,
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        {ikon}
      </span>
      <span className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">{children}</span>
    </div>
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
        className={cx('w-full text-left px-3 py-2 rounded-md border text-[0.8125rem] font-semibold', gaya)}
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
          <p className="text-[0.875rem] font-bold">
            {perluDiperbaiki ? 'Data usaha perlu diperbaiki' : 'Akun sedang diperiksa'}
          </p>
          {perluDiperbaiki ? (
            <ul className="mt-1.5 text-[0.8125rem] space-y-1 list-disc pl-4 opacity-90">
              {profil.alasanPerbaikan.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[0.8125rem] opacity-90 leading-relaxed">
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
              className="text-[0.8125rem] font-semibold underline underline-offset-2"
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
        <p className="pb-4 text-[0.9375rem] text-ink-2 leading-relaxed">
          Kontrak dan pesanan mengikat kamu dengan distributor, jadi keduanya baru terbuka setelah data usahamu
          diperiksa. Selama menunggu, kamu tetap bisa melihat stok, menjelajah katalog, dan membandingkan harga.
        </p>
      </Lembar>
    </>
  )
}

/* ================================================================== */
/* Kartu tindakan (Beranda)                                           */
/* ================================================================== */

/**
 * Satu kartu, satu tombol besar, dan hanya satu.
 *
 * Dengan `keKartu`, permukaan kartu ikut jadi tautan (lewat judulnya), dan
 * tombolnya mengerjakan hal yang berbeda — mis. kartu membuka Lembar Pesan
 * Cepat, tombol langsung memasukkan saran ke keranjang. Tombolnya diangkat ke
 * atas lapisan tautan supaya dua sasaran itu tidak saling rebut.
 */
export function KartuTindakan({
  nada = 'netral',
  ikon,
  judul,
  detail,
  aksiLabel,
  aksiKe,
  onAksi,
  lencana,
  keKartu,
}: {
  nada?: NadaLencana
  ikon?: ReactNode
  judul: string
  detail: ReactNode
  aksiLabel: string
  aksiKe?: string
  onAksi?: () => void
  lencana?: ReactNode
  keKartu?: string
}) {
  const garis = {
    netral: 'border-line',
    merek: 'border-brand/40',
    aman: 'border-aman/40',
    menipis: 'border-menipis/50',
    kritis: 'border-kritis/50',
    info: 'border-info/40',
  }[nada]

  return (
    <div
      className={cx(
        'relative h-full flex flex-col bg-surface border rounded-lg p-4 shadow-e1',
        keKartu && 'hover:shadow-e2 transition-shadow',
        garis,
      )}
    >
      <div className="flex items-start gap-3">
        {ikon && (
          <span
            className={cx(
              'shrink-0 size-9 rounded-md grid place-items-center',
              nada === 'kritis'
                ? 'bg-kritis-soft text-kritis-ink'
                : nada === 'menipis'
                  ? 'bg-menipis-soft text-menipis-ink'
                  : nada === 'info'
                    ? 'bg-info-soft text-info-ink'
                    : 'bg-brand-soft text-brand-soft-ink',
            )}
          >
            {ikon}
          </span>
        )}
        <div className="min-w-0 grow">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="text-[0.9375rem] font-bold text-ink leading-snug">
              {keKartu ? (
                <Link to={keKartu} className="after:absolute after:inset-0 after:rounded-lg hover:text-brand">
                  {judul}
                </Link>
              ) : (
                judul
              )}
            </h3>
            {lencana}
          </div>
          <div className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed">{detail}</div>
        </div>
      </div>
      <div className="relative z-10 mt-auto pt-3">
        {aksiKe ? (
          <TombolTautan ke={aksiKe} penuh ukuran="sedang">
            {aksiLabel}
          </TombolTautan>
        ) : (
          <Tombol penuh onClick={onAksi}>
            {aksiLabel}
          </Tombol>
        )}
      </div>
    </div>
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
          <p className="text-[0.875rem] font-bold text-ink">{JUDUL.kuotaBulanIni}</p>
          <p className="text-[0.75rem] text-ink-3">{BANTUAN.kuota}</p>
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

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-full bg-brand" aria-hidden="true" />
          Sudah diterima{' '}
          <strong className="text-ink tabular">
            {angka(diterima)} {kontrak.satuan}
          </strong>
        </span>
        {jalan > 0 && (
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="size-2.5 rounded-full bg-info/55" aria-hidden="true" />
            Dalam perjalanan{' '}
            <strong className="text-ink tabular">
              {angka(jalan)} {kontrak.satuan}
            </strong>
          </span>
        )}
        <span className="text-ink-3">
          dari {angka(kuota)} {kontrak.satuan}
        </span>
      </div>

      {/* Keadaan "sudah terpenuhi" sengaja tidak ditulis di sini. Bar yang penuh
          sudah menyatakannya, dan satu-satunya pemakai mode penuh (Rincian
          Kontrak) menyampaikannya sendiri dengan ikon dan kalimat yang lebih
          tegas. Menulisnya di dua tempat membuat kalimatnya muncul dua kali. */}
      {!ringkas && kurang > 0 && (
        <p className="mt-2 text-[0.8125rem] text-ink-2">
          Kurang{' '}
          <strong className="text-ink tabular">
            {angka(kurang)} {kontrak.satuan}
          </strong>{' '}
          &middot; sisa {sisaHari} hari
        </p>
      )}
      {!ringkas && <p className="mt-1 text-[0.75rem] text-ink-3">{BANTUAN.kuotaBertambah}</p>}
    </div>
  )
}

/* ================================================================== */
/* Kartu Perkiraan                                                    */
/* ================================================================== */

/**
 * Tiga keadaan kematangan data dan tiga tingkat turun derajat layanan,
 * keduanya diisolasi di tingkat kartu.
 *
 * Kalau layanan perkiraan tidak sehat, hanya kartu ini yang berubah. Stok,
 * belanja, pesanan, dan kontrak tetap hidup penuh, karena satu layanan yang
 * bermasalah tidak boleh mematikan seluruh layar.
 */
export function KartuPerkiraan({ barang, perkiraan }: { barang: Barang; perkiraan: Perkiraan }) {
  const layanan = useAplikasi((s) => s.layananPerkiraan)
  const cukup = hariCukup(barang)

  if (layanan === 'mati') {
    return (
      <Kartu padat>
        <p className="text-[0.9375rem] font-bold text-ink">{barang.nama}</p>
        <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
          Perkiraan belum bisa ditampilkan sekarang. Sisa stok dan pengingat batas aman tetap berjalan seperti biasa.
        </p>
        <Tombol ragam="garis" ukuran="kecil" className="mt-2.5">
          Coba lagi
        </Tombol>
      </Kartu>
    )
  }

  // Tingkat kedua: layanan tidak menjawab, tapi riwayat pemakaian masih ada.
  // Hitungan rata-rata sederhana tidak pernah memakai lencana keyakinan, karena
  // ia memang bukan perkiraan pintar dan tidak boleh menyamar jadi itu.
  if (layanan === 'tersimpan') {
    return (
      <Kartu padat>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.9375rem] font-bold text-ink">{barang.nama}</p>
          <Lencana nada="netral">Hitungan sederhana</Lencana>
        </div>
        <p className="mt-1.5 text-[1.0625rem] font-extrabold text-ink">
          Stok {barang.nama.split(' ')[0].toLowerCase()} cukup untuk &plusmn;{cukup ?? '?'} hari
        </p>
        <p className="mt-1 text-[0.75rem] text-ink-3">
          Bukan perkiraan pintar &mdash; dihitung dari rata-rata 7 hari terakhir.
        </p>
      </Kartu>
    )
  }

  if (perkiraan.kematangan === 'belum-bisa') {
    const terkumpul = barang.hariDataTerkumpul
    return (
      <Kartu padat>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.9375rem] font-bold text-ink leading-snug">{barang.nama}</p>
          <Lencana nada={NADA_KEMATANGAN['belum-bisa']}>{LABEL_KEMATANGAN['belum-bisa']}</Lencana>
        </div>
        <p className="mt-1.5 text-[0.8125rem] text-ink-2">
          sisa {jumlahTampil(barang, barang.stok)}
          {barang.pemakaianHarian > 0 && (
            <> &middot; rata-rata pakai {jumlahTampil(barang, barang.pemakaianHarian)}/hari</>
          )}
        </p>
        <div className="mt-2.5">
          <BilahProgres nilai={terkumpul} maks={14} nada="netral" tinggi={6} />
          <p className="mt-1.5 text-[0.75rem] text-ink-3">
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
        <p className="text-[0.9375rem] font-bold text-ink leading-snug">{barang.nama}</p>
        <Lencana nada={NADA_KEMATANGAN[perkiraan.kematangan]}>{LABEL_KEMATANGAN[perkiraan.kematangan]}</Lencana>
      </div>
      <Link
        to={`/stok/${barang.id}`}
        className="mt-1.5 block text-[1.125rem] font-extrabold text-ink hover:text-brand transition-colors"
      >
        Stok cukup untuk &plusmn;{perkiraan.hariCukup} hari
      </Link>
      <p className="mt-1 text-[0.8125rem] text-ink-3">
        Perkiraan pakai 3 hari ke depan: {angkaTampil(barang, perkiraan.pakaiTigaHariMin ?? 0)}&ndash;
        {angkaTampil(barang, perkiraan.pakaiTigaHariMaks ?? 0)} {satuanTampil(barang).nama}
      </p>
      {perkiraan.dibuatPada && (
        <p className="mt-1 text-[0.75rem] text-ink-3">
          Perkiraan dibuat {waktuLalu(perkiraan.dibuatPada)}.
        </p>
      )}
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
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
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
          <p className="text-[0.75rem] text-ink-3 mt-0.5">{satuanTampil(barang).nama}</p>
        </div>
      </div>

      <div className="mt-2.5 h-1 w-full rounded-full bg-sunken overflow-hidden">
        <div className={cx('h-full rounded-full', warnaMeter)} style={{ width: `${Math.max(3, rasio * 100)}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ChipStok status={status} />
        <span className="text-[0.8125rem] text-ink-2">
          sisa {jumlahTampil(barang, barang.stok)}
          {cukup != null && barang.pemakaianHarian > 0 && <> &middot; cukup &plusmn;{cukup} hari</>}
        </span>
      </div>

      {(kemasan || barang.kedaluwarsa || !barang.terhubungKasir || kontrak || (sedangDikirim?.jumlah ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.75rem] text-ink-3">
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

  return (
    <Link
      to={`/pesanan/${pesanan.id}`}
      className="block bg-surface border border-line rounded-lg p-4 min-h-[72px] transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2 active:bg-surface-2"
    >
      <div className="flex items-start gap-3">
        <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={40} />
        <div className="min-w-0 grow">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[0.9375rem] font-bold text-ink truncate">{distributor?.nama}</p>
            <ChipPesanan status={pesanan.status} />
          </div>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2 truncate">
            {utama ? `${utama.nama} ${angka(utama.jumlah)} ${utama.satuan}` : 'Pesanan kosong'}
            {lain > 0 && ` + ${lain} barang lain`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
            <span className="tabular">{rupiah(total)}</span>
            {pesanan.perkiraanTiba && pesanan.status !== 'selesai' && pesanan.status !== 'batal' && (
              <span>Perkiraan tiba {waktuNanti(pesanan.perkiraanTiba)}</span>
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
    </Link>
  )
}

