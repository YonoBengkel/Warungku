import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Bagian, Lencana, type NadaLencana } from '@/components/ui/dasar'
import { KartuTindakan } from '@/components/domain'
import { TandaTitik } from '@/components/domain/TandaTitik'
import { IkonCentangLingkaran, IkonGudang, IkonJam, IkonKirim, IkonPanahKanan, IkonSilang } from '@/icons'
import { angka, cx, rupiah, tanggalLengkapHari, waktuLalu } from '@/lib/format'
import { RUANG_LONCENG } from '@/components/ui/navigasi'
import { LABEL_PESANAN_MASUK, LABEL_TITIK, NADA_PESANAN_MASUK, TAHAP_PESANAN_MASUK } from '@/lib/label'
import { distributorAktif, umkmById } from '@/data/dummy'
import type { PesananMasuk, StatusPesananMasuk, WarnaTitik } from '@/lib/types'
import { useAplikasi, useJumlahPerluKonfirmasi, usePesananMasuk, useTitikPeta } from '@/store/aplikasi'
import { KartuRingkasanPenjualan } from '@/components/domain/RingkasanPenjualan'
import { ambilRingkasanDistributor } from '@/lib/apiPenjualan'

/**
 * Halaman pertama portal distributor.
 *
 * Urutannya mengikuti satu pertanyaan: "apa yang harus aku kerjakan sekarang".
 * Karena itu sambutan dibuat pendek, lalu langsung satu kartu tindakan, baru
 * rekap angka. Rekap yang ditaruh di atas tindakan membuat orang membaca
 * laporan dulu padahal ada pesanan yang menunggu dijawab.
 *
 * Sejak revisi V4 (Q95) isinya tetap, tapi kotaknya meniru Beranda pemilik
 * usaha: kotak "Yang perlu kamu urus hari ini", petak berikon bulat seperti
 * Perlu Tindakan, dan kartu pesanan seperti di daftar Pesanan pemilik usaha.
 *
 * Lonceng ber-badge sudah hidup di KerangkaDistributor, jadi di sini ia TIDAK
 * diulang. Dua lonceng dengan angka yang sama membuat orang mengira ada dua
 * daftar yang berbeda.
 */

/* Ikon dan nada tiap tahap. Tiap petak selalu membawa ikon + teks + angka,
   jadi warnanya hanya penguat, bukan satu-satunya pembeda. */
const IKON_TAHAP: Record<StatusPesananMasuk, typeof IkonJam> = {
  'menunggu-konfirmasi': IkonJam,
  disiapkan: IkonGudang,
  dikirim: IkonKirim,
  selesai: IkonCentangLingkaran,
  ditolak: IkonSilang,
}

const CHIP_NADA: Record<NadaLencana, string> = {
  netral: 'bg-netral-soft text-netral-ink',
  merek: 'bg-brand-soft text-brand-soft-ink',
  aman: 'bg-aman-soft text-aman-ink',
  menipis: 'bg-menipis-soft text-menipis-ink',
  kritis: 'bg-kritis-soft text-kritis-ink',
  info: 'bg-info-soft text-info-ink',
}

/** Lima petak rekap, termasuk Ditolak yang tidak punya tahap berurutan. */
const REKAP: StatusPesananMasuk[] = [...TAHAP_PESANAN_MASUK, 'ditolak']

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

export default function Dashboard() {
  const sesiDistributor = useAplikasi((s) => s.sesiDistributor)
  const ambilRingkasan = useMemo(
    () => (sesiDistributor ? () => ambilRingkasanDistributor(sesiDistributor) : null),
    [sesiDistributor],
  )
  const pesananMasuk = usePesananMasuk()
  const perluKonfirmasi = useJumlahPerluKonfirmasi()
  const titik = useTitikPeta()

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

  return (
    <div className="pb-6">
      {/* 1. Sambutan: nama toko ditulis apa adanya, bukan huruf kapital semua */}
      <h1 className={cx('text-judul font-extrabold text-ink tracking-tight leading-snug', RUANG_LONCENG)}>
        Selamat datang, {distributorAktif.nama}
      </h1>
      <p className="mt-1 text-isi text-ink-3">{tanggalLengkapHari(new Date())}</p>

      {/* 2. Satu tindakan, di kotak yang sama dengan Beranda UMKM. Kartunya
          selebar kartu tugas di sana (setengah, lalu sepertiga baris). */}
      <Bagian
        id="judul-perlu-diurus"
        judul="Yang perlu kamu urus hari ini"
        keterangan={perluKonfirmasi > 0 ? '1 hal menunggu keputusan kamu.' : undefined}
        className="mt-4"
      >
        {perluKonfirmasi > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            <KartuTindakan
              utama
              nada="menipis"
              ikon={<IkonJam size={19} />}
              judul={`${perluKonfirmasi} pesanan menunggu kamu jawab`}
              detail="Pemesan menunggu kepastian barangnya jadi dikirim atau tidak."
              aksiLabel="Lihat Pesanan Masuk"
              aksiKe="/distributor-portal/pesanan?tahap=menunggu-konfirmasi"
            />
          </div>
        ) : (
          <p className="flex items-center gap-2 text-kartu font-semibold text-aman-ink bg-aman-soft rounded-md px-3.5 py-3">
            <IkonCentangLingkaran size={18} />
            Semua aman hari ini.
          </p>
        )}
      </Bagian>

      {/* 3. Rekap tahap: tiap petak adalah pintu ke tab yang sama di halaman
          Pesanan. Di HP dua kolom, petak kelima selebar dua kolom. */}
      <Bagian
        id="judul-rekap"
        judul="Rekap pesanan"
        keterangan="Ketuk salah satu untuk membuka daftarnya."
        className="mt-3 sm:mt-4"
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
          {REKAP.map((status, i) => {
            const Ikon = IKON_TAHAP[status]
            const jumlah = jumlahPerTahap[status]
            return (
              <Link
                key={status}
                to={`/distributor-portal/pesanan?tahap=${status}`}
                aria-label={`${LABEL_PESANAN_MASUK[status]}, ${angka(jumlah)} pesanan`}
                className={cx(
                  KELAS_PETAK,
                  'hover:border-line-strong transition-colors',
                  i === REKAP.length - 1 && 'col-span-2 lg:col-span-1',
                )}
              >
                <span aria-hidden="true" className="flex items-center justify-center gap-2.5">
                  <span
                    className={cx(
                      'size-10 sm:size-12 rounded-full grid place-items-center shrink-0',
                      CHIP_NADA[NADA_PESANAN_MASUK[status]],
                    )}
                  >
                    <Ikon size={20} />
                  </span>
                  <span className={cx('text-angka font-extrabold tabular', jumlah > 0 ? 'text-ink' : 'text-ink-3')}>
                    {angka(jumlah)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-kecil font-semibold text-ink-2 leading-tight">
                  {LABEL_PESANAN_MASUK[status]}
                </span>
              </Link>
            )
          })}
        </div>
      </Bagian>

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
