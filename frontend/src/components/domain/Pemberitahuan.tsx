import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HanyaPembacaLayar, Lencana, Tombol } from '@/components/ui/dasar'
import { TabSegmen } from '@/components/ui/navigasi'
import {
  IkonBintang,
  IkonInfo,
  IkonJam,
  IkonKeranjang,
  IkonKontrak,
  IkonKotak,
  IkonLonceng,
  IkonPanahKanan,
  IkonPasokan,
} from '@/icons'
import { distributorAktif, promoMasihBerlaku, umkmById } from '@/data/dummy'
import { angka, cx, hariLagi, tanggalRingkas, waktuLalu, waktuNanti } from '@/lib/format'
import { PESANAN_BERJALAN } from '@/lib/label'
import { bacaPetaDibaca, kunciDibacaDistributor, simpanPetaDibaca, type PetaDibaca } from '@/lib/dibaca'
import type { KategoriNotifikasi, Notifikasi, Pesanan } from '@/lib/types'
import { useAplikasi, useKontrakMasuk, usePesananMasuk } from '@/store/aplikasi'

/**
 * Pemberitahuan untuk kedua portal (revisi 23 Okt 2026, diubah di revisi V2 dan V5).
 *
 * Di desktop lonceng di pojok kanan atas (LoncengMelayang) membuka panel ala
 * Tokopedia (revisi V5, Q99 dan Q100): tab "Perlu tindakan" dan "Semua", paling
 * banyak enam butir, "Tandai semua dibaca", dan "Lihat semua" ke halaman
 * pemberitahuan yang tampil tanpa menu samping. Di HP lonceng di bilah atas tetap
 * membuka halaman itu (Q101).
 *
 * Sisi UMKM membaca daftar pemberitahuan di store. Sisi distributor belum punya
 * daftar tersimpan, jadi isinya diturunkan dari data yang sudah dimuat: pesanan
 * menunggu jawaban, kiriman lewat perkiraan tiba, pengajuan kontrak, permintaan
 * berhenti, kontrak yang segera berakhir, dan promo yang hampir habis. Status
 * dibaca kedua sisi disimpan di peramban per akun (Q120).
 */

type Ikon = ComponentType<{ size?: number; className?: string }>

export type NadaButir = 'kritis' | 'menipis' | 'info' | 'merek' | 'netral'

export interface ButirPemberitahuan {
  kunci: string
  judul: string
  detail: string
  /** Keterangan waktu yang sudah jadi kalimat, mis. "Masuk 2 jam lalu". */
  waktu: string
  /** Kunci urut: cap waktu kejadiannya. */
  urut: number
  ke: string
  Ikon: Ikon
  nada: NadaButir
  perluTindakan: boolean
  /** Sudah dibaca atau belum; tanpa nilai berarti tidak dicatat. */
  dibaca?: boolean
  /** Label tombol di baris, mis. "Pesan Sekarang" atau "Lihat pesanan". */
  aksiLabel?: string | null
  /** Kelompok butir distributor; Beranda distributor menggabungkan per kelompok. */
  jenis?: 'tunggu' | 'telat' | 'ajuan' | 'berhenti' | 'akhir' | 'promo'
  /** Nama pemesan di butir distributor. */
  pihak?: string
}

export const WARNA_NADA: Record<NadaButir, string> = {
  kritis: 'bg-kritis-soft text-kritis-ink',
  menipis: 'bg-menipis-soft text-menipis-ink',
  info: 'bg-info-soft text-info-ink',
  merek: 'bg-brand-soft text-brand-soft-ink',
  netral: 'bg-netral-soft text-netral-ink',
}

/* ------------------------------------------------------------------ */
/* Sisi UMKM                                                          */
/* ------------------------------------------------------------------ */

export const IKON_NOTIF: Record<KategoriNotifikasi, Ikon> = {
  stok: IkonKotak,
  'saran-belanja': IkonKeranjang,
  pesanan: IkonPasokan,
  kontrak: IkonKontrak,
  sistem: IkonInfo,
}

const NADA_NOTIF: Record<KategoriNotifikasi, NadaButir> = {
  stok: 'menipis',
  'saran-belanja': 'merek',
  pesanan: 'info',
  kontrak: 'menipis',
  sistem: 'netral',
}

/* Merah hanya untuk yang genting. Dulu semua pemberitahuan stok merah,
   termasuk yang baru menipis, sehingga merahnya kehilangan arti. */
export function nadaNotif(n: Notifikasi): NadaButir {
  if (n.kategori === 'stok' && n.tingkat === 'genting') return 'kritis'
  return NADA_NOTIF[n.kategori]
}

export function dibisukan(n: Notifikasi): boolean {
  return n.dibisukanSampai != null && +new Date(n.dibisukanSampai) > Date.now()
}

/** Barang yang sudah dipesan: dipakai untuk menurunkan baris stok jadi pasif. */
export interface Dipesan {
  pesananId: string
  tiba: string | null
}

/* Peta barang yang sedang dikirim. Inilah dasar aturan "begitu dipesan, barisnya
   jadi pasif", dipakai halaman Pemberitahuan dan panel lonceng sekaligus. */
export function petaDipesan(pesanan: Pesanan[]): Map<string, Dipesan> {
  const peta = new Map<string, Dipesan>()
  for (const p of pesanan) {
    if (!PESANAN_BERJALAN.includes(p.status) || p.status === 'draf') continue
    for (const b of p.baris) {
      if (b.barangId && !peta.has(b.barangId)) peta.set(b.barangId, { pesananId: p.id, tiba: p.perkiraanTiba })
    }
  }
  return peta
}

/**
 * Pemberitahuan UMKM sebagai butir panel lonceng: terbaru di atas, tanpa yang
 * sedang dibisukan. Angka lonceng adalah jumlah butir `perluTindakan` di sini
 * (revisi V5, Q100 dan Q120): membaca tidak menurunkannya, mengurusnya yang
 * menurunkan. Barang yang sudah dipesan dianggap sudah diurus, sama dengan
 * baris pasif di halaman Pemberitahuan.
 */
export function usePemberitahuanUsaha(): ButirPemberitahuan[] {
  const notifikasi = useAplikasi((s) => s.notifikasi)
  const pesanan = useAplikasi((s) => s.pesanan)
  return useMemo(() => {
    const dipesan = petaDipesan(pesanan)
    return notifikasi
      .filter((n) => !dibisukan(n))
      .slice()
      .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu))
      .map((n) => {
        const d = n.kategori === 'stok' && n.barangId ? dipesan.get(n.barangId) : undefined
        return {
          kunci: n.id,
          judul: n.judul,
          detail: n.detail,
          waktu: waktuLalu(n.waktu),
          urut: +new Date(n.waktu),
          ke: d ? `/pesanan/${d.pesananId}` : (n.tautan ?? '/notifikasi'),
          Ikon: IKON_NOTIF[n.kategori],
          nada: nadaNotif(n),
          perluTindakan: n.butuhTindakan && !d,
          dibaca: n.dibaca,
          aksiLabel: d ? 'Lihat pesanan' : n.aksiLabel,
        }
      })
  }, [notifikasi, pesanan])
}

/* ------------------------------------------------------------------ */
/* Sisi distributor                                                   */
/* ------------------------------------------------------------------ */

const HARI = 86_400_000
/** Kontrak dianggap "segera berakhir" bila sisa masanya kurang dari ini. */
const AMBANG_KONTRAK_HARI = 30
/** Promo dianggap "hampir habis" bila sisa masanya paling lama ini. */
const AMBANG_PROMO_HARI = 7

/**
 * Pemberitahuan distributor, diturunkan dari data yang sudah dimuat. Yang perlu
 * dijawab tampil dulu (terbaru di atas), lalu yang cukup diketahui (yang paling
 * dekat tenggatnya di atas).
 */
export function usePemberitahuanDistributor(): ButirPemberitahuan[] {
  const pesanan = usePesananMasuk()
  const kontrak = useKontrakMasuk()
  const promo = useAplikasi((s) => s.katalogDistributorServer?.promo ?? s.promo)

  return useMemo(() => {
    const sekarang = Date.now()
    const nama = (id: string) => umkmById(id)?.nama ?? 'Pemilik usaha'
    const butir: ButirPemberitahuan[] = []

    for (const p of pesanan) {
      if (p.status === 'menunggu-konfirmasi') {
        butir.push({
          kunci: `tunggu-${p.id}`,
          judul: `Pesanan ${p.nomor} menunggu jawabanmu`,
          detail: `${nama(p.umkmId)} · ${p.baris.length} jenis barang`,
          waktu: `Masuk ${waktuLalu(p.dibuatPada)}`,
          urut: +new Date(p.dibuatPada),
          ke: `/distributor-portal/pesanan/${p.id}`,
          Ikon: IkonJam,
          nada: 'menipis',
          perluTindakan: true,
          aksiLabel: 'Jawab Pesanan',
          jenis: 'tunggu',
          pihak: nama(p.umkmId),
        })
      } else if (p.status === 'dikirim' && p.perkiraanTiba && +new Date(p.perkiraanTiba) < sekarang) {
        butir.push({
          kunci: `telat-${p.id}`,
          judul: `Kiriman ${p.nomor} lewat perkiraan tiba`,
          detail: `${nama(p.umkmId)} · seharusnya tiba ${tanggalRingkas(p.perkiraanTiba)}`,
          waktu: `Perkiraan tiba ${waktuNanti(p.perkiraanTiba)}`,
          urut: +new Date(p.perkiraanTiba),
          ke: `/distributor-portal/pesanan/${p.id}`,
          Ikon: IkonPasokan,
          nada: 'menipis',
          perluTindakan: true,
          aksiLabel: 'Lihat Pesanan',
          jenis: 'telat',
          pihak: nama(p.umkmId),
        })
      }
    }

    for (const k of kontrak) {
      const berakhir = +new Date(k.berakhir)
      if (k.status === 'menunggu-persetujuan') {
        butir.push({
          kunci: `ajuan-${k.id}`,
          judul: `Pengajuan kontrak ${k.namaBarang}`,
          detail: `${nama(k.umkmId)} · ${k.durasiBulan} bulan, paling sedikit ${angka(k.kuotaMinPerBulan)} ${k.satuan} per bulan`,
          waktu: `Mulai ${tanggalRingkas(k.mulai)}`,
          urut: +new Date(k.mulai),
          ke: '/distributor-portal/kontrak?tab=pengajuan',
          Ikon: IkonKontrak,
          nada: 'info',
          perluTindakan: true,
          aksiLabel: 'Tinjau Pengajuan',
          jenis: 'ajuan',
          pihak: nama(k.umkmId),
        })
      } else if (k.pengajuanBerhenti) {
        butir.push({
          kunci: `berhenti-${k.id}`,
          judul: `${nama(k.umkmId)} minta berhenti kontrak ${k.namaBarang}`,
          detail: k.pengajuanBerhenti.alasan,
          waktu: `Diajukan ${waktuLalu(k.pengajuanBerhenti.waktu)}`,
          urut: +new Date(k.pengajuanBerhenti.waktu),
          ke: '/distributor-portal/kontrak?tab=berjalan',
          Ikon: IkonKontrak,
          nada: 'menipis',
          perluTindakan: true,
          aksiLabel: 'Tinjau Permintaan',
          jenis: 'berhenti',
          pihak: nama(k.umkmId),
        })
      } else if (
        (k.status === 'aktif' || k.status === 'akan-berakhir') &&
        berakhir > sekarang &&
        berakhir - sekarang < AMBANG_KONTRAK_HARI * HARI
      ) {
        butir.push({
          kunci: `akhir-${k.id}`,
          judul: `Kontrak ${k.namaBarang} segera berakhir`,
          detail: `${nama(k.umkmId)} · berakhir ${tanggalRingkas(k.berakhir)}`,
          waktu: `Berakhir ${waktuNanti(k.berakhir)}`,
          urut: berakhir,
          ke: '/distributor-portal/kontrak?tab=berjalan',
          Ikon: IkonKontrak,
          nada: 'netral',
          perluTindakan: false,
          aksiLabel: 'Lihat Kontrak',
          jenis: 'akhir',
          pihak: nama(k.umkmId),
        })
      }
    }

    for (const p of promo) {
      if (p.distributorId !== distributorAktif.id || !p.berakhir || !promoMasihBerlaku(p, sekarang)) continue
      const sisa = Math.ceil((+new Date(p.berakhir) - sekarang) / HARI)
      if (sisa > AMBANG_PROMO_HARI) continue
      butir.push({
        kunci: `promo-${p.id}`,
        judul: `Promo ${p.judul} hampir berakhir`,
        detail: `Berlaku sampai ${tanggalRingkas(p.berakhir)}. Buat promo baru kalau masih ingin berlanjut.`,
        waktu: `Berakhir ${hariLagi(sisa)}`,
        urut: +new Date(p.berakhir),
        ke: '/distributor-portal/promo',
        Ikon: IkonBintang,
        nada: 'merek',
        perluTindakan: false,
        aksiLabel: 'Lihat Promo',
        jenis: 'promo',
      })
    }

    return butir.sort((a, b) =>
      a.perluTindakan !== b.perluTindakan
        ? a.perluTindakan
          ? -1
          : 1
        : a.perluTindakan
          ? b.urut - a.urut
          : a.urut - b.urut,
    )
  }, [pesanan, kontrak, promo])
}

/* Status dibaca distributor (revisi V5, Q120): satu salinan per tab untuk semua
   pemakai (panel lonceng dan halaman pemberitahuan), disimpan di peramban per
   distributor. Isi yang berubah membuat butirnya belum dibaca lagi. */
const pendengarDibaca = new Set<() => void>()
const PETA_KOSONG: PetaDibaca = {}
let petaDibaca: { kunci: string; peta: PetaDibaca } | null = null

function petaDibacaUntuk(kunci: string | null): PetaDibaca {
  if (!kunci) return PETA_KOSONG
  if (petaDibaca?.kunci !== kunci) petaDibaca = { kunci, peta: bacaPetaDibaca(kunci) }
  return petaDibaca.peta
}

function ubahPetaDibaca(kunci: string, peta: PetaDibaca) {
  petaDibaca = { kunci, peta }
  simpanPetaDibaca(kunci, peta)
  pendengarDibaca.forEach((f) => f())
}

function dengarPetaDibaca(f: () => void) {
  pendengarDibaca.add(f)
  return () => {
    pendengarDibaca.delete(f)
  }
}

const tandaButir = (b: ButirPemberitahuan) => `${b.judul}|${b.detail}`

/**
 * Butir distributor beserta status dibacanya. Yang disimpan hanya butir yang
 * masih ada, jadi pesanan baru dengan judul lama tidak ikut terhitung dibaca.
 */
export function useDibacaDistributor(butir: ButirPemberitahuan[]) {
  const sesi = useAplikasi((s) => s.sesiDistributor)
  const kunci = sesi ? kunciDibacaDistributor(sesi.distributorId) : null
  const peta = useSyncExternalStore(dengarPetaDibaca, () => petaDibacaUntuk(kunci))

  const daftar = useMemo(
    () => butir.map((b) => ({ ...b, dibaca: kunci ? peta[b.kunci]?.tanda === tandaButir(b) : undefined })),
    [butir, peta, kunci],
  )

  const tandai = useCallback(
    (pilih: (b: ButirPemberitahuan) => boolean) => {
      if (!kunci) return
      const baru: PetaDibaca = {}
      for (const b of butir) {
        if (peta[b.kunci]?.tanda === tandaButir(b) || pilih(b)) baru[b.kunci] = { tanda: tandaButir(b) }
      }
      ubahPetaDibaca(kunci, baru)
    },
    [butir, peta, kunci],
  )

  const baca = useCallback((k: string) => tandai((b) => b.kunci === k), [tandai])
  const bacaSemua = useCallback(() => tandai(() => true), [tandai])
  return { daftar, baca, bacaSemua }
}

/* ------------------------------------------------------------------ */
/* Tampilan                                                           */
/* ------------------------------------------------------------------ */

/** Satu butir: seluruh baris adalah satu tautan. */
export function BarisButir({
  butir,
  penuh,
  onClick,
}: {
  butir: ButirPemberitahuan
  /** Halaman penuh: berbingkai kartu. Panel: baris rata tanpa bingkai. */
  penuh?: boolean
  onClick?: () => void
}) {
  const { Ikon } = butir
  return (
    <Link
      to={butir.ke}
      onClick={onClick}
      className={cx(
        'flex items-start gap-3 transition-[background-color,border-color,box-shadow]',
        penuh
          ? 'rounded-lg border border-line bg-surface shadow-e1 p-3.5 hover:border-line-strong hover:shadow-e2'
          : 'rounded-md p-2.5 hover:bg-sunken',
      )}
    >
      <span className={cx('shrink-0 rounded-md grid place-items-center', penuh ? 'size-10' : 'size-9', WARNA_NADA[butir.nada])}>
        <Ikon size={penuh ? 18 : 17} />
      </span>
      <span className="min-w-0 grow">
        <span
          className={cx(
            'block text-ink leading-snug',
            penuh ? 'text-kartu' : 'text-isi',
            butir.dibaca ? 'font-medium' : 'font-bold',
          )}
        >
          {butir.judul}
        </span>
        <span className={cx('block mt-0.5 text-ink-2 leading-snug', penuh ? 'text-isi' : 'text-kecil line-clamp-2')}>
          {butir.detail}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-kecil text-ink-3">{butir.waktu}</span>
          {butir.perluTindakan && <Lencana nada="menipis">Perlu tindakan</Lencana>}
          {/* Label tombol yang sama dengan halaman pemberitahuan (Pesan Sekarang,
              Lihat pesanan). Seluruh baris tetap satu tautan. */}
          {butir.aksiLabel && (
            <span className="ml-auto inline-flex items-center h-8 px-2.5 rounded-sm bg-sunken text-ink-2 text-kecil font-semibold whitespace-nowrap">
              {butir.aksiLabel}
              <IkonPanahKanan size={14} className="ml-1" />
            </span>
          )}
        </span>
      </span>
      {butir.dibaca === false ? (
        <>
          <span className="shrink-0 mt-1.5 size-2.5 rounded-full bg-info" aria-hidden="true" />
          <HanyaPembacaLayar>Belum dibaca</HanyaPembacaLayar>
        </>
      ) : (
        penuh && !butir.aksiLabel && <IkonPanahKanan size={18} className="shrink-0 mt-0.5 text-ink-3" />
      )}
    </Link>
  )
}

/** Tepi kanan lonceng dan panelnya: sejajar tepi kanan isi `<main>` (paling lebar 1400px di tengah). */
const KANAN_LONCENG = 'max(1.5rem, calc((100vw - var(--rail-w) - 1400px) / 2 + 1.5rem))'
/** Paling banyak butir di panel; sisanya lewat "Lihat semua" (Q100). */
const BATAS_PANEL = 6

type TabPanel = 'perlu' | 'semua'

/**
 * Lonceng pemberitahuan di desktop: tombol bulat yang melayang di pojok kanan
 * atas area halaman dan tetap di tempat saat halaman digulir (revisi V2, Q53).
 * Sejak revisi V5 (Q99, Q100) menekannya membuka panel ala Tokopedia tepat di
 * bawahnya, bukan langsung pindah halaman. Panel tertutup oleh ketukan di luar,
 * Esc, pindah halaman, atau memilih butir. Di HP lonceng tetap di bilah atas dan
 * membuka halaman penuh (Q101).
 *
 * Baris judul yang punya isi di kanan memberi ruang lewat RUANG_LONCENG.
 */
export function LoncengMelayang({
  butir,
  jumlah,
  keSemua,
  baca,
  bacaSemua,
}: {
  butir: ButirPemberitahuan[]
  /** Angka di lonceng: butir yang masih butuh tindakan. */
  jumlah: number
  keSemua: string
  baca: (kunci: string) => void
  bacaSemua: () => void
}) {
  const [buka, setBuka] = useState(false)
  const [tab, setTab] = useState<TabPanel>('perlu')
  const tombolRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  const perlu = useMemo(() => butir.filter((b) => b.perluTindakan), [butir])
  const belumDibaca = butir.filter((b) => b.dibaca === false).length
  const tampil = (tab === 'perlu' ? perlu : butir).slice(0, BATAS_PANEL)

  const tutup = useCallback((kembalikanFokus = false) => {
    setBuka(false)
    if (kembalikanFokus) tombolRef.current?.focus()
  }, [])

  // Pindah halaman (termasuk lewat butir panel) menutup panel.
  useEffect(() => {
    setBuka(false)
  }, [pathname])

  useEffect(() => {
    if (!buka) return
    panelRef.current?.focus()
    const ketuk = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !tombolRef.current?.contains(t)) tutup()
    }
    const tombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup(true)
    }
    document.addEventListener('mousedown', ketuk)
    document.addEventListener('keydown', tombol)
    return () => {
      document.removeEventListener('mousedown', ketuk)
      document.removeEventListener('keydown', tombol)
    }
  }, [buka, tutup])

  function alih() {
    if (buka) {
      tutup()
      return
    }
    setTab(perlu.length > 0 ? 'perlu' : 'semua')
    setBuka(true)
  }

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        onClick={alih}
        aria-label={jumlah > 0 ? `Pemberitahuan, ${jumlah} butuh tindakan` : 'Pemberitahuan'}
        aria-haspopup="dialog"
        aria-expanded={buka}
        aria-controls="panel-pemberitahuan"
        className={cx(
          'hidden lg:grid fixed top-4 z-40 size-11 place-items-center rounded-full bg-surface border shadow-e2 transition-colors',
          buka ? 'text-brand border-brand' : 'text-ink-2 border-line hover:text-ink hover:border-line-strong',
        )}
        style={{ right: KANAN_LONCENG }}
      >
        <IkonLonceng size={22} />
        {jumlah > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
            {jumlah > 99 ? '99+' : jumlah}
          </span>
        )}
      </button>

      {buka && (
        <div
          ref={panelRef}
          id="panel-pemberitahuan"
          role="dialog"
          aria-labelledby="judul-panel-pemberitahuan"
          tabIndex={-1}
          className="hidden lg:flex fixed z-50 flex-col rounded-xl border border-line bg-surface shadow-e3 outline-none anim-muncul"
          style={{
            top: '4.25rem',
            right: KANAN_LONCENG,
            width: 'min(25rem, calc(100vw - var(--rail-w) - 3rem))',
            maxHeight: 'calc(100dvh - 5.5rem)',
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
            <h2 id="judul-panel-pemberitahuan" className="text-kartu font-extrabold text-ink">
              Pemberitahuan
            </h2>
            {belumDibaca > 0 && (
              <Tombol ragam="tautan" ukuran="kecil" onClick={bacaSemua}>
                Tandai semua dibaca
              </Tombol>
            )}
          </div>

          {/* Jaraknya di pembungkus: TabSegmen menolkan padding sendiri mulai 640px. */}
          <div className="px-4 pt-2.5">
            <TabSegmen<TabPanel>
              tab={[
                { nilai: 'perlu', label: 'Perlu tindakan', jumlah: perlu.length },
                { nilai: 'semua', label: 'Semua', jumlah: butir.length },
              ]}
              aktif={tab}
              ubah={setTab}
            />
          </div>

          <div className="mt-2 min-h-0 overflow-y-auto px-2 pb-2">
            {tampil.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="mx-auto size-14 rounded-full bg-brand-soft text-brand grid place-items-center">
                  <IkonLonceng size={26} />
                </span>
                <p className="mt-3 text-kartu font-bold text-ink">
                  {tab === 'perlu' ? 'Tidak ada yang perlu diurus' : 'Belum ada pemberitahuan'}
                </p>
                <p className="mt-1 text-isi text-ink-2 leading-relaxed">
                  Kami kabari begitu ada yang perlu kamu lihat atau putuskan.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {tampil.map((b) => (
                  <li key={b.kunci} className="py-0.5">
                    <BarisButir
                      butir={b}
                      onClick={() => {
                        baca(b.kunci)
                        tutup()
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-4 flex items-center justify-between gap-3">
            <span className="text-kecil text-ink-3">
              {(tab === 'perlu' ? perlu.length : butir.length) > BATAS_PANEL
                ? `${BATAS_PANEL} dari ${angka(tab === 'perlu' ? perlu.length : butir.length)} ditampilkan`
                : ''}
            </span>
            {/* Menutup sendiri juga: kalau halaman pemberitahuan sudah terbuka,
                alamatnya tidak berubah dan panel tidak tertutup otomatis. */}
            <Link
              to={keSemua}
              onClick={() => tutup()}
              className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline"
            >
              Lihat semua
              <IkonPanahKanan size={15} />
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
