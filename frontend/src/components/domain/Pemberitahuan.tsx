import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { HanyaPembacaLayar, Lencana } from '@/components/ui/dasar'
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
  IkonSilang,
} from '@/icons'
import { distributorAktif, promoMasihBerlaku, umkmById } from '@/data/dummy'
import { angka, cx, hariLagi, tanggalRingkas, waktuLalu, waktuNanti } from '@/lib/format'
import type { KategoriNotifikasi, Notifikasi } from '@/lib/types'
import { useAplikasi, useKontrakMasuk, usePesananMasuk } from '@/store/aplikasi'

/**
 * Pemberitahuan ringkas untuk kedua portal (revisi 23 Okt 2026).
 *
 * Di desktop, menu "Pemberitahuan" di navigasi samping membuka panel kecil di
 * samping menu, bukan pindah halaman; halaman penuhnya tetap ada lewat "Lihat
 * semua". Di HP lonceng di bilah atas tetap membuka halaman penuh.
 *
 * Sisi UMKM membaca daftar pemberitahuan yang tersimpan. Sisi distributor belum
 * punya daftar tersimpan, jadi isinya diturunkan dari data yang sudah dimuat:
 * pesanan menunggu jawaban, kiriman lewat perkiraan tiba, pengajuan kontrak,
 * permintaan berhenti, kontrak yang segera berakhir, dan promo yang hampir habis.
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
  /** Hanya sisi UMKM yang mencatat sudah dibaca atau belum. */
  dibaca?: boolean
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

/** Pemberitahuan tersimpan → butir panel, terbaru dulu. */
export function butirDariNotifikasi(daftar: Notifikasi[]): ButirPemberitahuan[] {
  return daftar
    .slice()
    .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu))
    .map((n) => ({
      kunci: n.id,
      judul: n.judul,
      detail: n.detail,
      waktu: waktuLalu(n.waktu),
      urut: +new Date(n.waktu),
      ke: n.tautan ?? '/notifikasi',
      Ikon: IKON_NOTIF[n.kategori],
      nada: nadaNotif(n),
      perluTindakan: n.butuhTindakan && !n.dibaca,
      dibaca: n.dibaca,
    }))
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
        </span>
      </span>
      {butir.dibaca === false ? (
        <>
          <span className="shrink-0 mt-1.5 size-2.5 rounded-full bg-info" aria-hidden="true" />
          <HanyaPembacaLayar>Belum dibaca</HanyaPembacaLayar>
        </>
      ) : (
        penuh && <IkonPanahKanan size={18} className="shrink-0 mt-0.5 text-ink-3" />
      )}
    </Link>
  )
}

/** Banyaknya butir di panel; sisanya di halaman penuh. */
const MAKS_PANEL = 6

/**
 * Menu "Pemberitahuan" di navigasi samping desktop beserta panelnya.
 *
 * Panel tertutup saat Esc (fokus kembali ke menunya), saat mengetuk di luar,
 * saat salah satu butirnya dibuka, dan saat layar menyempit di bawah 1024px
 * (navigasi sampingnya hilang). Ia dialog non-modal: halaman di belakangnya
 * tetap bisa dipakai.
 */
export function MenuPemberitahuan({
  butir,
  semuaKe,
  aktif,
  jumlah,
  bacaButir,
  tandaiSemuaDibaca,
}: {
  butir: ButirPemberitahuan[]
  /** Halaman pemberitahuan penuh. */
  semuaKe: string
  /** Halaman penuh sedang terbuka. */
  aktif: boolean
  /** Angka di lencana menu: yang butuh tindakan. */
  jumlah: number
  bacaButir?: (kunci: string) => void
  tandaiSemuaDibaca?: () => void
}) {
  const [buka, setBuka] = useState(false)
  const [atas, setAtas] = useState(16)
  const tombol = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const adaBelumDibaca = butir.some((b) => b.dibaca === false)

  useEffect(() => {
    if (!buka) return
    const luar = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || tombol.current?.contains(t)) return
      setBuka(false)
    }
    const tombolKunci = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setBuka(false)
      tombol.current?.focus()
    }
    const lebar = window.matchMedia('(min-width: 1024px)')
    const sempit = () => {
      if (!lebar.matches) setBuka(false)
    }
    document.addEventListener('pointerdown', luar)
    document.addEventListener('keydown', tombolKunci)
    lebar.addEventListener('change', sempit)
    panel.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', luar)
      document.removeEventListener('keydown', tombolKunci)
      lebar.removeEventListener('change', sempit)
    }
  }, [buka])

  function alih() {
    if (!buka && tombol.current) {
      // Sejajar dengan menunya, tapi tidak keluar dari bawah layar.
      const r = tombol.current.getBoundingClientRect()
      setAtas(Math.max(16, Math.min(r.top - 8, window.innerHeight - 16 - 560)))
    }
    setBuka((b) => !b)
  }

  return (
    <>
      <button
        ref={tombol}
        type="button"
        onClick={alih}
        aria-haspopup="dialog"
        aria-expanded={buka}
        aria-controls={buka ? id : undefined}
        aria-label={jumlah > 0 ? `Pemberitahuan, ${jumlah} butuh tindakan` : 'Pemberitahuan'}
        className={cx(
          'w-full flex items-center gap-3 h-11 px-3 rounded-md font-semibold text-isi text-left transition-colors',
          aktif || buka ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
        )}
      >
        <IkonLonceng size={20} />
        <span className="grow">Pemberitahuan</span>
        {jumlah > 0 && (
          <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
            {jumlah}
          </span>
        )}
      </button>

      {/* Dipasang di body: navigasi samping `sticky` membentuk lapisan
          tumpukan sendiri, sehingga panel di dalamnya tertimpa isi halaman. */}
      {buka &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-labelledby={`${id}-judul`}
            tabIndex={-1}
            className="fixed z-50 w-[24rem] flex flex-col rounded-xl border border-line bg-surface shadow-e3 anim-muncul outline-none"
            style={{ top: atas, left: 'calc(var(--rail-w) + 0.5rem)', maxHeight: `calc(100dvh - ${atas + 16}px)` }}
          >
            <div className="flex items-start gap-2 pl-4 pr-2 pt-3 pb-2 border-b border-line">
              <div className="min-w-0 grow pt-1">
                <h2 id={`${id}-judul`} className="text-kartu font-bold text-ink leading-tight">
                  Pemberitahuan
                </h2>
                <p className="mt-0.5 text-kecil text-ink-3">
                  {jumlah > 0 ? `${jumlah} butuh tindakan` : 'Tidak ada yang menunggu tindakan'}
                </p>
              </div>
              {tandaiSemuaDibaca && adaBelumDibaca && (
                <button
                  type="button"
                  onClick={tandaiSemuaDibaca}
                  className="shrink-0 min-h-11 px-2 rounded-md text-kecil font-semibold text-brand hover:bg-sunken"
                >
                  Tandai dibaca
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setBuka(false)
                  tombol.current?.focus()
                }}
                aria-label="Tutup pemberitahuan"
                className="shrink-0 size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
              >
                <IkonSilang size={18} />
              </button>
            </div>

            {butir.length === 0 ? (
              <p className="px-4 py-8 text-center text-isi text-ink-3">Belum ada pemberitahuan.</p>
            ) : (
              <ul className="overflow-y-auto overscroll-contain p-2 space-y-0.5">
                {butir.slice(0, MAKS_PANEL).map((b) => (
                  <li key={b.kunci}>
                    <BarisButir
                      butir={b}
                      onClick={() => {
                        bacaButir?.(b.kunci)
                        setBuka(false)
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-line p-2">
              <Link
                to={semuaKe}
                onClick={() => setBuka(false)}
                className="flex items-center justify-center gap-1 min-h-11 rounded-md text-isi font-bold text-brand hover:bg-sunken"
              >
                {butir.length > MAKS_PANEL ? `Lihat semua (${butir.length})` : 'Buka halaman pemberitahuan'}
                <IkonPanahKanan size={15} />
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
