import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HanyaPembacaLayar, Lencana, Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom } from '@/components/ui/formulir'
import { Konfirmasi, Lembar } from '@/components/ui/lembar'
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
import { bintang, cx, rupiah, waktuLalu } from '@/lib/format'
import {
  ALASAN_TOLAK,
  LABEL_PESANAN_MASUK,
  TAHAP_PESANAN_MASUK,
} from '@/lib/label'
import { umkmById } from '@/data/dummy'
import { TombolPutusDistributor } from '@/components/domain/SambungDistributor'
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
  /* Peringatan "alasan wajib" baru muncul setelah Tolak ditekan tanpa alasan.
     Menampilkannya sejak lembar dibuka terasa seperti dimarahi sebelum
     sempat mengetik apa pun. */
  const [dicoba, setDicoba] = useState(false)

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
    if (!bolehKirim) {
      setDicoba(true)
      return
    }
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
          <Tombol ragam="bahaya" penuh onClick={kirim}>
            Tolak Pesanan
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        <p className="text-isi text-ink-2 leading-relaxed">Alasan ini dikirim ke pemesan.</p>

        <div>
          <p className="text-isi font-semibold text-ink-2 mb-2.5">Alasan siap pakai</p>
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

        {dicoba && !bolehKirim && (
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
  const dariServer = useAplikasi((s) => s.pesananMasukServer !== null)
  const [params, setParams] = useSearchParams()
  const perStatus = usePesananMasukPerStatus()
  const terimaPesananMasuk = useAplikasi((s) => s.terimaPesananMasuk)
  const terimaSemuaPesananMasuk = useAplikasi((s) => s.terimaSemuaPesananMasuk)
  const [tanyaTerimaSemua, setTanyaTerimaSemua] = useState(false)
  const majukanSemuaPesananMasuk = useAplikasi((s) => s.majukanSemuaPesananMasuk)
  const [lembarMajuSemua, setLembarMajuSemua] = useState(false)
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

  /* Pesanan yang menunggu dijawab diurutkan dari yang paling lama: yang
     terlama paling mendesak, dan urutan terbaru dulu menenggelamkannya. */
  const daftar =
    tahap === 'menunggu-konfirmasi'
      ? [...perStatus[tahap]].sort((a, b) => new Date(a.dibuatPada).getTime() - new Date(b.dibuatPada).getTime())
      : perStatus[tahap]
  const IkonKosong = IKON_TAHAP[tahap]

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-judul font-extrabold text-ink tracking-tight">Pesanan</h1>
          <p className="mt-1 text-isi text-ink-3 leading-snug max-w-[70ch]">
            Semua pesanan yang masuk ke tokomu, dikelompokkan menurut tahapnya.
            {dariServer ? '' : ' Saat ini memakai data contoh.'}
          </p>
        </div>
        {dariServer && <TombolPutusDistributor />}
      </div>
      {!dariServer && (
        <p className="mt-3 text-isi text-ink-2">
          Mau memakai pesanan sungguhan?{' '}
          <Link to="/masuk/distributor" className="inline-flex items-center min-h-11 font-bold text-brand hover:underline">
            Masuk sebagai distributor
          </Link>
        </p>
      )}

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

        {/* Aksi massal untuk keputusan yang seragam pada banyak pesanan kecil:
            terima, berangkatkan bersama, tandai sampai. Tolak tetap satu per
            satu karena tiap pesanan butuh alasannya sendiri. */}
        {tahap === 'menunggu-konfirmasi' && daftar.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-isi text-ink-2">
              {daftar.length} pesanan menunggu, yang paling lama di atas.
            </p>
            <Tombol ukuran="kecil" ikonKiri={<IkonCentang size={15} />} onClick={() => setTanyaTerimaSemua(true)}>
              Terima Semua ({daftar.length})
            </Tombol>
          </div>
        )}
        {(tahap === 'disiapkan' || tahap === 'dikirim') && daftar.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-isi text-ink-2">
              {tahap === 'disiapkan'
                ? `${daftar.length} pesanan siap berangkat.`
                : `${daftar.length} pesanan sedang di jalan.`}
            </p>
            <Tombol ukuran="kecil" ikonKiri={<IkonKirim size={15} />} onClick={() => setLembarMajuSemua(true)}>
              {tahap === 'disiapkan' ? `Kirim Semua (${daftar.length})` : `Tandai Semua Sampai (${daftar.length})`}
            </Tombol>
          </div>
        )}

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

      {lembarMajuSemua && (tahap === 'disiapkan' || tahap === 'dikirim') && (
        <LembarBukti
          tahap={tahap}
          tutup={() => setLembarMajuSemua(false)}
          kirim={(bukti) => {
            majukanSemuaPesananMasuk(
              daftar.map((x) => x.id),
              bukti,
            )
            setLembarMajuSemua(false)
          }}
        />
      )}

      <Konfirmasi
        terbuka={tanyaTerimaSemua}
        tutup={() => setTanyaTerimaSemua(false)}
        judul={`Terima ${daftar.length} pesanan sekaligus?`}
        pesan={
          <>
            Total {rupiah(daftar.reduce((a, x) => a + totalPesananMasuk(x), 0))} dari{' '}
            {new Set(daftar.map((x) => x.umkmId)).size} pemesan. Semuanya pindah ke Disiapkan di Gudang. Pesanan yang
            barangnya tidak cukup sebaiknya ditolak dulu satu per satu.
          </>
        }
        labelSetuju={`Ya, terima ${daftar.length}`}
        onSetuju={() => {
          terimaSemuaPesananMasuk(daftar.map((x) => x.id))
          setTanyaTerimaSemua(false)
        }}
      />

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

/** "Menunggu 3 jam", bukan "Masuk 3 jam lalu": yang dijawab distributor adalah lamanya menunggu. */
function lamaMenunggu(dibuatPada: string): string {
  const w = waktuLalu(dibuatPada)
  if (w === 'baru saja') return 'Baru masuk'
  if (w === 'kemarin') return 'Menunggu sejak kemarin'
  return `Menunggu ${w.replace(/ lalu$/, '')}`
}

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
  const diproses = useAplikasi((s) => s.pesananDiproses.includes(pesanan.id))
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
          <h3 className="text-kartu font-bold text-ink leading-snug">
            <Link
              to={`/distributor-portal/pesanan/${pesanan.id}`}
              className="after:absolute after:inset-0 after:rounded-lg hover:underline"
            >
              {pesanan.nomor}
              <HanyaPembacaLayar> — buka rincian pesanan</HanyaPembacaLayar>
            </Link>
          </h3>
          <p className="mt-0.5 text-isi text-ink-2 leading-snug">
            {umkm?.nama ?? 'Pemilik usaha'}
            {umkm && <span className="text-ink-3"> &middot; {umkm.kota}</span>}
          </p>
        </div>
        {perluDijawab && <Lencana nada="menipis">{lamaMenunggu(pesanan.dibuatPada)}</Lencana>}
      </div>

      <p className="mt-2 text-isi text-ink-3 leading-snug">
        {pesanan.baris.length} jenis barang &middot; {ringkasanBarang(pesanan)}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        {/* Lama menunggu sudah di lencana kartu yang perlu dijawab. */}
        <span className="text-kecil text-ink-3">{perluDijawab ? '' : `Masuk ${waktuLalu(pesanan.dibuatPada)}`}</span>
        <span className="text-[1rem] font-bold text-ink">{rupiah(totalPesananMasuk(pesanan))}</span>
      </div>

      {/* Pengganti tampilan "Selesai" di menu Lacak yang sudah dihapus: penilaian
          pemesan dan ada-tidaknya bukti antar terbaca tanpa membuka rinciannya. */}
      {pesanan.status === 'selesai' && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-isi">
          {pesanan.ulasan ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <IkonBintangIsi size={13} className="text-menipis" />
              {bintang(pesanan.ulasan.rating)} dari 5
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
          <Tombol ragam="sekunder" penuh memuat={diproses} ikonKiri={<IkonCentang size={16} />} onClick={terima}>
            Terima
          </Tombol>
          <Tombol ragam="garis" penuh disabled={diproses} ikonKiri={<IkonSilang size={16} />} onClick={tolak}>
            Tolak
          </Tombol>
        </div>
      )}

      {labelMaju && (
        <div className="relative z-10 mt-3">
          <Tombol ragam="sekunder" penuh memuat={diproses} onClick={majukan}>
            {labelMaju}
          </Tombol>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Lembar bukti antar (dipakai rincian dan aksi massal)                */
/* ------------------------------------------------------------------ */

/**
 * Bukti antar: saat berangkat (kurir, pengantar, resi) dan saat sampai
 * (penerima, catatan). Semuanya boleh kosong; yang kosong tertulis "Belum
 * dicatat" di rincian, bukan dikarang.
 */
export function LembarBukti({
  tahap,
  tutup,
  kirim,
}: {
  tahap: 'disiapkan' | 'dikirim'
  tutup: () => void
  kirim: (bukti: Record<string, string | null>) => void
}) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('')
  const berangkat = tahap === 'disiapkan'
  const kosongJadiNull = (v: string) => v.trim() || null
  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul={berangkat ? 'Catat pengiriman' : 'Catat barang sampai'}
      keterangan={
        berangkat
          ? 'Isian ini tampil di rincian pesanan pemilik usaha. Boleh dikosongkan.'
          : 'Stok pemilik usaha bertambah setelah ia menghitung barangnya sendiri.'
      }
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol
            penuh
            onClick={() =>
              kirim(
                berangkat
                  ? { kurir: kosongJadiNull(a), pengantar: kosongJadiNull(b), nomor_resi: kosongJadiNull(c) }
                  : { diterima_oleh: kosongJadiNull(a), catatan: kosongJadiNull(b) },
              )
            }
          >
            {berangkat ? 'Tandai Sedang Dikirim' : 'Tandai Sudah Sampai'}
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        {berangkat ? (
          <>
            <Kolom label="Jasa kirim" placeholder="Armada sendiri" value={a} onChange={(e) => setA(e.target.value)} />
            <Kolom label="Nama pengantar" value={b} onChange={(e) => setB(e.target.value)} />
            <Kolom label="Nomor resi" value={c} onChange={(e) => setC(e.target.value)} />
          </>
        ) : (
          <>
            <Kolom label="Diterima oleh" value={a} onChange={(e) => setA(e.target.value)} />
            <Kolom label="Catatan" value={b} onChange={(e) => setB(e.target.value)} />
          </>
        )}
      </div>
    </Lembar>
  )
}
