import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HanyaPembacaLayar, Lencana, Tombol, type NadaLencana } from '@/components/ui/dasar'
import { AreaTeks } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { BarisChip, Chip, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonBintangIsi,
  IkonCentang,
  IkonCentangLingkaran,
  IkonGudang,
  IkonJam,
  IkonKirim,
  IkonSilang,
} from '@/icons'
import { angka, cx, rupiah, waktuLalu } from '@/lib/format'
import {
  ALASAN_TOLAK,
  LABEL_PESANAN_MASUK,
  NADA_PESANAN_MASUK,
  TAHAP_PESANAN_MASUK,
} from '@/lib/label'
import { umkmById } from '@/data/dummy'
import type { PesananMasuk, StatusPesananMasuk } from '@/lib/types'
import { useAplikasi, usePesananMasukPerStatus } from '@/store/aplikasi'

/**
 * Daftar pesanan yang masuk ke distributor.
 *
 * Bentuknya tab, bukan papan Kanban. Kanban terlihat rapi di layar lebar tapi
 * di HP ia berubah jadi lima kolom sempit yang harus digeser ke samping, dan
 * pekerjaan sehari-hari distributor justru dimulai dari HP.
 *
 * Tab aktif disimpan di query `?tahap=` supaya Dashboard, lonceng, dan tautan
 * yang dikirim lewat pesan bisa membuka tab yang tepat, bukan selalu tab
 * pertama.
 *
 * Cara tombol aksi tidak mencuri ketukan tautan baris: BARIS BUKAN TAUTAN.
 * Barisnya `<div className="relative">`, tautannya menempel pada nomor pesanan
 * dan dilebarkan ke seluruh kartu lewat `after:absolute after:inset-0`. Tombol
 * Terima/Tolak duduk di atas lapisan itu dengan `relative z-10`, jadi ketukan
 * di tombol tidak pernah sampai ke tautan. Satu pola ini dipakai di semua tab.
 */

/* ------------------------------------------------------------------ */
/* Bagian yang dipakai bersama dengan halaman rincian                  */
/* ------------------------------------------------------------------ */

/** Nilai satu pesanan: barang ditambah ongkos kirim. */
export function totalPesananMasuk(p: PesananMasuk): number {
  return p.baris.reduce((a, b) => a + b.jumlah * b.hargaSatuan, 0) + p.ongkosKirim
}

/** "Biji Kopi Arabika Gayo +2 lainnya" */
export function ringkasanBarang(p: PesananMasuk): string {
  const sisa = p.baris.length - 1
  return sisa > 0 ? `${p.baris[0].nama} +${sisa} lainnya` : p.baris[0].nama
}

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

const SEMUA_TAHAP: StatusPesananMasuk[] = [...TAHAP_PESANAN_MASUK, 'ditolak']

/** Panjang catatan bebas paling pendek yang masih bisa dibaca sebagai alasan. */
const MIN_CATATAN = 5

/**
 * Lembar alasan penolakan.
 *
 * Dipakai dua kali: di daftar ini dan di halaman rincian. Ia tinggal di berkas
 * daftar supaya aturan "alasan wajib" hanya ditulis sekali — kalau disalin ke
 * dua tempat, cepat atau lambat salah satunya akan longgar.
 *
 * Komponen ini selalu dipasang dalam keadaan terbuka dan dilepas saat ditutup,
 * jadi isi chip dan catatannya tidak pernah tertinggal dari pesanan sebelumnya.
 */
export function LembarTolak({ pesanan, tutup }: { pesanan: PesananMasuk; tutup: () => void }) {
  const tolakPesananMasuk = useAplikasi((s) => s.tolakPesananMasuk)
  const [alasanTerpilih, setAlasanTerpilih] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')

  const catatanBersih = catatan.trim()
  const catatanCukup = catatanBersih.length >= MIN_CATATAN
  const bolehKirim = alasanTerpilih !== null || catatanCukup

  /* Pesan validasi selalu tiga bagian: apa yang kurang, cara memperbaikinya,
     lalu satu contoh yang benar. Tanpa contoh, orang menebak panjang dan
     bentuk yang diharapkan.

     Kalimatnya sengaja tidak memuat jumlah huruf yang sedang diketik: teks ini
     hidup di dalam wilayah yang dibacakan pembaca layar, dan angka yang
     berubah tiap ketukan akan dibacakan berulang-ulang. */
  const pesanKurang = catatanBersih.length
    ? `Catatan kamu masih terlalu pendek. Pilih satu alasan siap pakai di atas, atau tulis minimal ${MIN_CATATAN} huruf. Contoh: "Stok Arabika Gayo habis sampai Senin depan."`
    : `Alasan penolakan belum diisi. Pilih satu alasan siap pakai di atas, atau tulis sendiri minimal ${MIN_CATATAN} huruf. Contoh: "Stok Arabika Gayo habis sampai Senin depan."`

  function kirim() {
    if (!bolehKirim) return
    /* Chip dan catatan digabung jadi satu kalimat, bukan dua baris terpisah:
       yang sampai ke pemilik usaha harus terbaca sebagai alasan utuh. Catatan
       yang sudah terlanjur diketik tidak pernah dibuang diam-diam, sependek
       apa pun, selama chip-nya sudah dipilih. */
    const alasan = alasanTerpilih
      ? catatanBersih
        ? `${alasanTerpilih}. ${catatanBersih}`
        : alasanTerpilih
      : catatanBersih
    tolakPesananMasuk(pesanan.id, alasan)
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul="Tolak Pesanan"
      keterangan={`${pesanan.nomor} dari ${umkmById(pesanan.umkmId)?.nama ?? 'pemilik usaha'}`}
      lebar="sempit"
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Tidak jadi
          </Tombol>
          <Tombol ragam="bahaya" penuh disabled={!bolehKirim} onClick={kirim}>
            Tolak Pesanan
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        <p className="text-[0.875rem] text-ink-2 leading-relaxed">
          Alasannya ikut terkirim ke pemilik usaha, jadi tulis yang benar-benar terjadi. Tanpa
          alasan, mereka cuma melihat pesanannya hilang.
        </p>

        <div>
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2.5">Alasan siap pakai</p>
          <BarisChip className="flex-wrap">
            {ALASAN_TOLAK.map((a) => (
              <Chip
                key={a}
                aktif={alasanTerpilih === a}
                onClick={() => setAlasanTerpilih(alasanTerpilih === a ? null : a)}
              >
                {a}
              </Chip>
            ))}
          </BarisChip>
        </div>

        <AreaTeks
          label="Catatan tambahan"
          bantuan="Boleh dikosongkan kalau kamu sudah memilih salah satu alasan di atas."
          placeholder="Misalnya: barangnya baru datang lagi hari Senin."
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />

        {!bolehKirim && (
          <Peringatan nada="menipis" judul="Alasan wajib diisi">
            {pesanKurang}
          </Peringatan>
        )}
      </div>
    </Lembar>
  )
}

/* ------------------------------------------------------------------ */
/* Halaman                                                             */
/* ------------------------------------------------------------------ */

export default function PesananMasukDaftar() {
  const [params, setParams] = useSearchParams()
  const perStatus = usePesananMasukPerStatus()
  const terimaPesananMasuk = useAplikasi((s) => s.terimaPesananMasuk)
  const majukanPesananMasuk = useAplikasi((s) => s.majukanPesananMasuk)

  const [pesananDitolak, setPesananDitolak] = useState<PesananMasuk | null>(null)

  /* Tahap yang tidak dikenal (atau kosong) jatuh ke tahap pertama, bukan ke
     halaman kosong: tautan lama tidak boleh berakhir sebagai layar buntu. */
  const tahapMentah = params.get('tahap')
  const tahap: StatusPesananMasuk = SEMUA_TAHAP.find((s) => s === tahapMentah) ?? 'menunggu-konfirmasi'

  function gantiTahap(nilai: StatusPesananMasuk) {
    const baru = new URLSearchParams(params)
    baru.set('tahap', nilai)
    setParams(baru, { replace: true })
  }

  const daftar = perStatus[tahap]
  const IkonKosong = IKON_TAHAP[tahap]

  return (
    <div className="pb-6">
      <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Pesanan</h1>
      <p className="mt-1 text-[0.8125rem] text-ink-3 leading-snug max-w-[70ch]">
        Semua pesanan yang masuk ke tokomu, dikelompokkan menurut tahapnya.
      </p>

      {/* Ringkasan jumlah. Di 360px barisnya digeser di dalam wadahnya sendiri,
          badan halaman tidak ikut bergeser. */}
      <section aria-labelledby="judul-ringkasan" className="mt-4">
        <h2 id="judul-ringkasan" className="sr-only">
          Ringkasan jumlah pesanan per tahap
        </h2>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
          {SEMUA_TAHAP.map((status) => {
            const Ikon = IKON_TAHAP[status]
            return (
              <div
                key={status}
                className="flex-1 min-w-[9.5rem] bg-surface border border-line rounded-lg p-3 shadow-e1"
              >
                <span
                  className={cx(
                    'size-7 rounded-md grid place-items-center',
                    CHIP_NADA[NADA_PESANAN_MASUK[status]],
                  )}
                  aria-hidden="true"
                >
                  <Ikon size={15} />
                </span>
                <p className="mt-2 text-[1.375rem] font-extrabold text-ink leading-none tracking-tight">
                  {perStatus[status].length}
                </p>
                <p className="mt-1 text-[0.75rem] font-semibold text-ink-2 leading-snug">
                  {LABEL_PESANAN_MASUK[status]}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <TabSegmen<StatusPesananMasuk>
        className="mt-4"
        aktif={tahap}
        ubah={gantiTahap}
        tab={SEMUA_TAHAP.map((status) => ({
          nilai: status,
          label: LABEL_PESANAN_MASUK[status],
          jumlah: perStatus[status].length,
        }))}
      />

      <section aria-labelledby="judul-daftar" className="mt-4">
        <h2 id="judul-daftar" className="sr-only">
          {LABEL_PESANAN_MASUK[tahap]}
        </h2>

        {daftar.length === 0 ? (
          <KeadaanKosong
            tingkat="h3"
            ikon={<IkonKosong size={26} />}
            judul={KOSONG[tahap].judul}
            pesan={KOSONG[tahap].pesan}
          />
        ) : (
          <div className="space-y-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5 lg:space-y-0 lg:items-start">
            {daftar.map((p) => (
              <BarisPesanan
                key={p.id}
                pesanan={p}
                terima={() => terimaPesananMasuk(p.id)}
                tolak={() => setPesananDitolak(p)}
                majukan={() => majukanPesananMasuk(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {pesananDitolak && (
        <LembarTolak
          key={pesananDitolak.id}
          pesanan={pesananDitolak}
          tutup={() => setPesananDitolak(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Keadaan kosong per tab                                              */
/* ------------------------------------------------------------------ */

const KOSONG: Record<StatusPesananMasuk, { judul: string; pesan: string }> = {
  'menunggu-konfirmasi': {
    judul: 'Tidak ada yang menunggu dijawab',
    pesan: 'Semua pesanan yang masuk sudah kamu terima atau tolak. Pesanan baru muncul di sini sendiri.',
  },
  disiapkan: {
    judul: 'Gudang sedang kosong',
    pesan: 'Pesanan pindah ke sini setelah kamu menekan Terima. Dari sini barangnya tinggal dikemas lalu ditandai berangkat.',
  },
  dikirim: {
    judul: 'Tidak ada barang di jalan',
    pesan: 'Pesanan masuk ke sini setelah kamu menandainya berangkat dari gudang.',
  },
  selesai: {
    judul: 'Belum ada yang sampai tujuan',
    pesan: 'Pesanan pindah ke sini setelah kamu menandainya sudah sampai di pemilik usaha.',
  },
  ditolak: {
    judul: 'Belum ada pesanan yang kamu tolak',
    pesan: 'Pesanan yang kamu tolak tersimpan di sini lengkap dengan alasannya, jadi bisa dilihat lagi kapan saja.',
  },
}

/* ------------------------------------------------------------------ */
/* Satu baris pesanan                                                  */
/* ------------------------------------------------------------------ */

function BarisPesanan({
  pesanan,
  terima,
  tolak,
  majukan,
}: {
  pesanan: PesananMasuk
  terima: () => void
  tolak: () => void
  majukan: () => void
}) {
  const umkm = umkmById(pesanan.umkmId)
  const perluDijawab = pesanan.status === 'menunggu-konfirmasi'
  const labelMaju =
    pesanan.status === 'disiapkan'
      ? 'Tandai Sedang Dikirim'
      : pesanan.status === 'dikirim'
        ? 'Tandai Sudah Sampai'
        : null

  return (
    <div
      className={cx(
        // `relative` adalah jangkar untuk lapisan tautan di bawah, sekaligus
        // untuk teks pembaca layar di dalam kartu.
        'relative bg-surface border border-line rounded-lg p-3.5 shadow-e1',
        'transition-[border-color,box-shadow] duration-150',
        'hover:border-line-strong hover:shadow-e2',
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-bold text-ink leading-snug">
            <Link
              to={`/distributor-portal/pesanan/${pesanan.id}`}
              className="after:absolute after:inset-0 after:rounded-lg hover:underline"
            >
              {pesanan.nomor}
              <HanyaPembacaLayar> — buka rincian pesanan</HanyaPembacaLayar>
            </Link>
          </h3>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-snug">
            {umkm?.nama ?? 'Pemilik usaha'}
            {umkm && <span className="text-ink-3"> &middot; {umkm.kota}</span>}
          </p>
        </div>
        <Lencana nada={NADA_PESANAN_MASUK[pesanan.status]}>
          {LABEL_PESANAN_MASUK[pesanan.status]}
        </Lencana>
      </div>

      <p className="mt-2 text-[0.8125rem] text-ink-3 leading-snug">
        {pesanan.baris.length} jenis barang &middot; {ringkasanBarang(pesanan)}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[0.75rem] text-ink-3">Masuk {waktuLalu(pesanan.dibuatPada)}</span>
        <span className="text-[1rem] font-bold text-ink">{rupiah(totalPesananMasuk(pesanan))}</span>
      </div>

      {/* Pengganti tampilan "Selesai" di menu Lacak yang sudah dihapus: penilaian
          pemesan dan ada-tidaknya bukti antar terbaca tanpa membuka rinciannya. */}
      {pesanan.status === 'selesai' && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
          {pesanan.ulasan ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <IkonBintangIsi size={13} className="text-menipis" />
              {angka(pesanan.ulasan.rating, 1)} dari 5
            </span>
          ) : (
            <span className="text-ink-3">Belum dinilai</span>
          )}
          <span className={pesanan.pengiriman ? 'text-ink-2' : 'text-ink-3'}>
            {pesanan.pengiriman ? 'Bukti antar tersimpan' : 'Tanpa bukti antar'}
          </span>
        </p>
      )}

      {/* Tombol duduk di atas lapisan tautan kartu, jadi ketukannya tidak
          pernah nyasar ke halaman rincian. */}
      {perluDijawab && (
        <div className="relative z-10 mt-3 flex gap-2">
          {/* Ukuran "sedang" (44px penuh), bukan "kecil": ini aksi utama kartu
              dan tingginya harus benar-benar terlihat, bukan cuma dilebarkan
              diam-diam oleh pseudo-element. */}
          <Tombol penuh ikonKiri={<IkonCentang size={16} />} onClick={terima}>
            Terima
          </Tombol>
          <Tombol ragam="garis" penuh ikonKiri={<IkonSilang size={16} />} onClick={tolak}>
            Tolak
          </Tombol>
        </div>
      )}

      {labelMaju && (
        <div className="relative z-10 mt-3">
          <Tombol ragam="sekunder" penuh onClick={majukan}>
            {labelMaju}
          </Tombol>
        </div>
      )}
    </div>
  )
}
