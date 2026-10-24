import { useMemo, type ComponentType } from 'react'
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
} from '@/icons'
import { distributorAktif, promoMasihBerlaku, umkmById } from '@/data/dummy'
import { angka, cx, hariLagi, tanggalRingkas, waktuLalu, waktuNanti } from '@/lib/format'
import type { KategoriNotifikasi, Notifikasi } from '@/lib/types'
import { useAplikasi, useKontrakMasuk, usePesananMasuk } from '@/store/aplikasi'

/**
 * Pemberitahuan untuk kedua portal (revisi 23 Okt 2026, diubah di revisi V2).
 *
 * Di desktop lonceng melayang di pojok kanan atas (LoncengMelayang) dan langsung
 * membuka halaman pemberitahuan, yang tampil tanpa menu samping. Panel kecil
 * yang dulu keluar dari menu samping sudah dihapus. Di HP lonceng di bilah atas
 * membuka halaman yang sama.
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

/**
 * Lonceng pemberitahuan di desktop (revisi V2, Q53): tombol bulat yang melayang
 * di pojok kanan atas area halaman dan tetap di tempat saat halaman digulir.
 * Menekannya langsung membuka halaman pemberitahuan; panel kecil yang dulu keluar
 * dari menu samping sudah tidak ada. Di HP lonceng tetap di bilah atas.
 *
 * Tepi kanannya sejajar tepi kanan isi `<main>` (paling lebar 1400px di tengah),
 * jadi di layar sangat lebar ia tidak terlempar jauh dari isi halaman. Baris
 * judul yang punya isi di kanan memberinya ruang lewat RUANG_LONCENG.
 */
export function LoncengMelayang({ ke, jumlah }: { ke: string; jumlah: number }) {
  return (
    <Link
      to={ke}
      aria-label={jumlah > 0 ? `Pemberitahuan, ${jumlah} butuh tindakan` : 'Pemberitahuan'}
      className="hidden lg:grid fixed top-4 z-40 size-11 place-items-center rounded-full bg-surface text-ink-2 border border-line shadow-e2 hover:text-ink hover:border-line-strong transition-colors"
      style={{ right: 'max(1.5rem, calc((100vw - var(--rail-w) - 1400px) / 2 + 1.5rem))' }}
    >
      <IkonLonceng size={22} />
      {jumlah > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular">
          {jumlah > 99 ? '99+' : jumlah}
        </span>
      )}
    </Link>
  )
}
