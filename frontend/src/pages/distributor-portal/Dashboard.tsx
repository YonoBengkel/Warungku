import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Bagian, Lencana } from '@/components/ui/dasar'
import { DonatStatus, KartuUrusan, type PotonganDonat, type Urusan } from '@/components/domain/KartuBeranda'
import { KepalaSambutan } from '@/components/domain/KepalaSambutan'
import { usePemberitahuanDistributor, type ButirPemberitahuan } from '@/components/domain/Pemberitahuan'
import { TandaTitik } from '@/components/domain/TandaTitik'
import { IkonCentangLingkaran, IkonJam, IkonKirim, IkonKontrak, IkonPanahKanan } from '@/icons'
import { angka, cx, rupiah, waktuLalu } from '@/lib/format'
import { LABEL_PESANAN_MASUK, LABEL_TITIK, NADA_PESANAN_MASUK } from '@/lib/label'
import { umkmById } from '@/data/dummy'
import type { PesananMasuk, StatusPesananMasuk, WarnaTitik } from '@/lib/types'
import { useAplikasi, useDistributorAktif, usePesananMasuk, useTitikPeta } from '@/store/aplikasi'
import { KartuRingkasanPenjualan } from '@/components/domain/RingkasanPenjualan'
import { ambilRingkasanDistributor } from '@/lib/apiPenjualan'

/**
 * Halaman pertama portal distributor.
 *
 * Urutannya mengikuti satu pertanyaan: "apa yang harus aku kerjakan sekarang".
 * Karena itu sambutan dibuat pendek, lalu langsung daftar urusan, baru rekap
 * angka. Rekap yang ditaruh di atas tindakan membuat orang membaca laporan
 * dulu padahal ada pesanan yang menunggu dijawab.
 *
 * Susunan revisi V5 (Q119): kepala sapaan, "Yang perlu kamu urus hari ini"
 * berdampingan dengan donat Rekap pesanan, Ringkasan Penjualan, Sebaran
 * pemesan, lalu Pesanan terbaru. Gaya kartunya sama dengan Beranda UMKM.
 *
 * Lonceng ber-badge sudah hidup di KerangkaDistributor, jadi di sini ia TIDAK
 * diulang. Dua lonceng dengan angka yang sama membuat orang mengira ada dua
 * daftar yang berbeda.
 */

type TahapBerjalan = Extract<StatusPesananMasuk, 'menunggu-konfirmasi' | 'disiapkan' | 'dikirim'>

/** Tahap yang masuk donat, urut seperti alur pesanan. */
const BERJALAN: TahapBerjalan[] = ['menunggu-konfirmasi', 'disiapkan', 'dikirim']

/* Warna potongan donat: palet yang sama dengan donat Pesanan berjalan UMKM. */
const WARNA_TAHAP: Record<TahapBerjalan, { garis: string; titik: string }> = {
  'menunggu-konfirmasi': { garis: 'stroke-seri-2', titik: 'bg-seri-2' },
  disiapkan: { garis: 'stroke-seri-1', titik: 'bg-seri-1' },
  dikirim: { garis: 'stroke-seri-4', titik: 'bg-seri-4' },
}

const URUT_TITIK: WarnaTitik[] = ['merah', 'oren', 'biru']

/** Petak seperti Perlu Tindakan di Beranda UMKM: tanda dan angka berdampingan di tengah, nama di bawah. */
const KELAS_PETAK = 'min-w-0 flex flex-col items-center gap-1.5 p-3 text-center bg-surface border border-line rounded-lg shadow-e1'

function TautanLihat({ ke, children }: { ke: string; children: string }) {
  return (
    <Link to={ke} className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline">
      {children}
      <IkonPanahKanan size={15} />
    </Link>
  )
}

/**
 * Kartu satu pesanan masuk, bergaya kartu pesanan pemilik usaha (`KartuPesanan`):
 * logo dan nama pemesan, status, barang ringkas, total, dan waktu masuk.
 */
function KartuPesananMasuk({ pesanan: p }: { pesanan: PesananMasuk }) {
  const umkm = umkmById(p.umkmId)
  const nama = umkm?.nama ?? 'Pemilik usaha'
  const total = p.baris.reduce((a, b) => a + b.jumlah * b.hargaSatuan, 0) + p.ongkosKirim
  const utama = p.baris[0]
  const lain = p.baris.length - 1
  return (
    <Link
      to={`/distributor-portal/pesanan/${p.id}`}
      className="block h-full bg-surface border border-line rounded-lg p-4 min-h-[72px] transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2 active:bg-surface-2"
    >
      <div className="flex items-start gap-3">
        <Avatar nama={nama} warna={umkm?.warna} ukuran={40} />
        <div className="min-w-0 grow">
          {/* Lencana status turun ke bawah nama bila sempit, bukan memotong namanya. */}
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <p className="min-w-0 text-kartu font-bold text-ink line-clamp-2">{nama}</p>
            <Lencana nada={NADA_PESANAN_MASUK[p.status]} className="shrink-0 whitespace-nowrap">
              {LABEL_PESANAN_MASUK[p.status]}
            </Lencana>
          </div>
          <p className="mt-0.5 text-isi text-ink-2 truncate">
            {utama ? `${utama.nama} ${angka(utama.jumlah)} ${utama.satuan}` : 'Pesanan kosong'}
            {lain > 0 && ` + ${lain} barang lain`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-kecil text-ink-3">
            <span className="tabular">{rupiah(total)}</span>
            <span>masuk {waktuLalu(p.dibuatPada)}</span>
            <span className="tabular">{p.nomor}</span>
          </div>
        </div>
        <IkonPanahKanan size={18} className="shrink-0 text-ink-3 mt-1" />
      </div>
    </Link>
  )
}

/** Nama pemesan untuk baris gabungan: dua nama, sisanya "+N". */
function namaPemesan(butir: ButirPemberitahuan[]): string {
  const nama = [...new Set(butir.map((b) => b.pihak).filter((n): n is string => !!n))]
  return nama.length > 2 ? `${nama.slice(0, 2).join(', ')} +${nama.length - 2}` : nama.join(', ')
}

export default function Dashboard() {
  const sesiDistributor = useAplikasi((s) => s.sesiDistributor)
  const ambilRingkasan = useMemo(
    () => (sesiDistributor ? () => ambilRingkasanDistributor(sesiDistributor) : null),
    [sesiDistributor],
  )
  const distributor = useDistributorAktif()
  const pesananMasuk = usePesananMasuk()
  const pemberitahuan = usePemberitahuanDistributor()
  const titik = useTitikPeta()

  /* "Yang perlu kamu urus hari ini" (revisi V5, Q104): butir yang sama dengan
     tab "Perlu tindakan" di lonceng, digabung per kelompok supaya satu baris
     satu keputusan. Kiriman yang lewat perkiraan tiba paling atas dan merah. */
  const urusan = useMemo<Urusan[]>(() => {
    const per = (j: ButirPemberitahuan['jenis']) => pemberitahuan.filter((b) => b.perluTindakan && b.jenis === j)
    const hasil: Urusan[] = []
    const telat = per('telat')
    if (telat.length > 0)
      hasil.push({
        kunci: 'telat',
        nada: 'kritis',
        Ikon: IkonKirim,
        judul: telat.length === 1 ? telat[0].judul : `${telat.length} kiriman lewat perkiraan tiba`,
        detail: telat.length === 1 ? telat[0].detail : namaPemesan(telat),
        aksi: { label: 'Lihat', ke: telat.length === 1 ? telat[0].ke : '/distributor-portal/pesanan?tahap=dikirim' },
      })
    const tunggu = per('tunggu')
    if (tunggu.length > 0)
      hasil.push({
        kunci: 'tunggu',
        nada: 'menipis',
        Ikon: IkonJam,
        judul: `${tunggu.length} pesanan menunggu kamu jawab`,
        detail: `${namaPemesan(tunggu)} menunggu kepastian barangnya dikirim.`,
        aksi: { label: 'Jawab', ke: '/distributor-portal/pesanan?tahap=menunggu-konfirmasi' },
      })
    const ajuan = per('ajuan')
    if (ajuan.length > 0)
      hasil.push({
        kunci: 'ajuan',
        nada: 'info',
        Ikon: IkonKontrak,
        judul: ajuan.length === 1 ? ajuan[0].judul : `${ajuan.length} pengajuan kontrak baru`,
        detail: ajuan.length === 1 ? ajuan[0].detail : namaPemesan(ajuan),
        aksi: { label: 'Tinjau', ke: '/distributor-portal/kontrak?tab=pengajuan' },
      })
    const berhenti = per('berhenti')
    if (berhenti.length > 0)
      hasil.push({
        kunci: 'berhenti',
        nada: 'menipis',
        Ikon: IkonKontrak,
        judul: berhenti.length === 1 ? berhenti[0].judul : `${berhenti.length} permintaan berhenti kontrak`,
        detail: berhenti.length === 1 ? berhenti[0].detail : namaPemesan(berhenti),
        aksi: { label: 'Tinjau', ke: '/distributor-portal/kontrak?tab=berjalan' },
      })
    return hasil
  }, [pemberitahuan])

  const jumlahPerTahap = useMemo(() => {
    const per: Record<StatusPesananMasuk, number> = {
      'menunggu-konfirmasi': 0,
      disiapkan: 0,
      dikirim: 0,
      selesai: 0,
      ditolak: 0,
    }
    for (const p of pesananMasuk) per[p.status] += 1
    return per
  }, [pesananMasuk])

  /* Yang dihitung adalah TITIK, bukan pesanan. Satu UMKM selalu jadi satu
     titik walau punya beberapa pesanan sekaligus, dan warnanya diambil dari
     kondisi yang paling mendesak. Menjumlahkan pesanan di sini akan membuat
     angka merah membengkak oleh pesanan yang sebetulnya sudah berjalan. */
  const jumlahPerWarna = useMemo(() => {
    const per: Record<WarnaTitik, number> = { merah: 0, oren: 0, biru: 0 }
    for (const t of titik) per[t.warna] += 1
    return per
  }, [titik])

  /* Lima pesanan terbaru, diurutkan dari waktu masuknya. Daftar aslinya tidak
     disalin-urutkan di tempat supaya urutan di halaman Pesanan tidak ikut
     berubah. */
  const terbaru = useMemo(
    () => [...pesananMasuk].sort((a, b) => +new Date(b.dibuatPada) - +new Date(a.dibuatPada)).slice(0, 5),
    [pesananMasuk],
  )

  /* Donat Rekap pesanan (Q118): hanya pesanan yang masih berjalan; ratusan
     pesanan Selesai akan membuat potongan lain terlalu tipis untuk terlihat. */
  const donat: PotonganDonat[] = BERJALAN.map((status) => ({
    kunci: status,
    label: LABEL_PESANAN_MASUK[status],
    jumlah: jumlahPerTahap[status],
    garis: WARNA_TAHAP[status].garis,
    titik: WARNA_TAHAP[status].titik,
    ke: `/distributor-portal/pesanan?tahap=${status}`,
  }))
  const jumlahBerjalan = BERJALAN.reduce((a, s) => a + jumlahPerTahap[s], 0)

  return (
    <div className="pb-6 lg:pb-0">
      {/* 1. Sambutan, sama dengan Beranda UMKM tanpa baris data kasir (Q106) */}
      <KepalaSambutan nama={distributor.nama} />

      {/* 2. Urusan hari ini berdampingan dengan donat Rekap pesanan (Q104, Q119) */}
      <div className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-stretch">
        <KartuUrusan
          butir={urusan}
          kosong={
            <p className="flex items-center gap-2 text-kartu font-semibold text-aman-ink bg-aman-soft rounded-md px-3.5 py-3">
              <IkonCentangLingkaran size={18} />
              Semua aman hari ini.
            </p>
          }
        />

        <Bagian
          id="judul-rekap"
          judul="Rekap pesanan"
          besar
          keterangan="Pesanan yang masih berjalan. Ketuk satu status untuk membuka daftarnya."
          aksi={<TautanLihat ke="/distributor-portal/pesanan">Lihat semua</TautanLihat>}
          className="flex flex-col"
        >
          <DonatStatus
            potongan={donat}
            satuan="pesanan"
            label={`Dari ${jumlahBerjalan} pesanan berjalan: ${donat
              .map((d) => `${d.jumlah} ${d.label.toLowerCase()}`)
              .join(', ')}`}
          />
          {/* Selesai dan Ditolak tidak masuk donat, tapi tetap satu ketukan dari sini. */}
          <p className="mt-auto pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line text-isi text-ink-2">
            {(['selesai', 'ditolak'] as const).map((status) => (
              <Link
                key={status}
                to={`/distributor-portal/pesanan?tahap=${status}`}
                className="inline-flex items-center gap-1.5 min-h-11 font-semibold hover:text-brand"
              >
                {LABEL_PESANAN_MASUK[status]}
                <span className="font-extrabold text-ink tabular">{angka(jumlahPerTahap[status])}</span>
                <IkonPanahKanan size={14} className="text-ink-3" />
              </Link>
            ))}
          </p>
        </Bagian>
      </div>

      {/* Ringkasan penjualan dari pesanan selesai (revisi 23 Okt), hanya untuk portal tersambung. */}
      {ambilRingkasan && (
        <KartuRingkasanPenjualan
          ambil={ambilRingkasan}
          ke="/distributor-portal/penjualan"
          className="mt-3 sm:mt-4"
        />
      )}

      {/* 4. Sebaran titik: petak bergaya sama, dengan cincin seperti di peta */}
      <Bagian
        id="judul-sebaran"
        judul="Sebaran pemesan"
        besar
        keterangan="Jumlah titik di peta. Satu pemilik usaha dihitung satu titik."
        aksi={<TautanLihat ke="/distributor-portal/sebaran">Buka peta</TautanLihat>}
        className="mt-3 sm:mt-4"
      >
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
          {URUT_TITIK.map((warna) => {
            const jumlah = jumlahPerWarna[warna]
            return (
              <li key={warna} className={KELAS_PETAK}>
                <span className="flex items-center justify-center gap-2 sm:gap-2.5">
                  <TandaTitik warna={warna} ukuran={40} />
                  <span className={cx('text-angka font-extrabold tabular', jumlah > 0 ? 'text-ink' : 'text-ink-3')}>
                    {angka(jumlah)}
                  </span>
                </span>
                <span className="text-kecil font-semibold text-ink-2 leading-tight">{LABEL_TITIK[warna]}</span>
              </li>
            )
          })}
        </ul>
      </Bagian>

      {/* 5. Lima pesanan terbaru, dua sebaris mulai 1024px dan tiga mulai 1280px */}
      <Bagian
        id="judul-terbaru"
        judul="Pesanan terbaru"
        besar
        aksi={<TautanLihat ke="/distributor-portal/pesanan">Lihat semua</TautanLihat>}
        className="mt-3 sm:mt-4"
      >
        <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
          {terbaru.map((p) => (
            <li key={p.id}>
              <KartuPesananMasuk pesanan={p} />
            </li>
          ))}
        </ul>
      </Bagian>
    </div>
  )
}
