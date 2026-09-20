import { useMemo, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  HanyaPembacaLayar,
  JudulBagian,
  Kartu,
  Lencana,
  TombolTautan,
} from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonBintang,
  IkonBintangIsi,
  IkonCentang,
  IkonCentangLingkaran,
  IkonGudang,
  IkonJam,
  IkonKalender,
  IkonKirim,
  IkonLokasi,
  IkonNota,
  IkonPanahKanan,
  IkonSilang,
  IkonTelepon,
  IkonToko,
} from '@/icons'
import {
  angka,
  cx,
  jam,
  jumlahSatuan,
  nomorHp,
  tanggalPanjang,
  tanggalPendek,
  waktuLalu,
  waktuNanti,
} from '@/lib/format'
import { LABEL_PESANAN_MASUK, NADA_PESANAN_MASUK, TAHAP_PESANAN_MASUK } from '@/lib/label'
import type { JejakPesananMasuk, PesananMasuk, StatusPesananMasuk, UlasanPelanggan } from '@/lib/types'
import { umkmById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu toko, dilihat dari sisi distributor.
 *
 * Isinya berganti mengikuti keadaan yang dibawa dari halaman Lacak Pesanan,
 * karena pertanyaannya memang berbeda:
 *
 * - Sedang Diproses → "barangnya sudah sampai mana". Yang ditampilkan seluruh
 *   rute, termasuk langkah yang belum terjadi, supaya terlihat berapa lagi
 *   sisanya. Rute yang hanya menampilkan langkah tercatat membuat orang
 *   mengira pesanan sudah hampir selesai padahal baru separuh jalan.
 * - Selesai → "pelanggannya puas atau tidak, dan apa buktinya barang benar
 *   diantar". Penilaian dan bukti pengantaran berdiri berdampingan.
 */

type Keadaan = 'proses' | 'selesai'

const STATUS_PROSES: StatusPesananMasuk[] = ['disiapkan', 'dikirim']

interface HitunganToko {
  menunggu: number
  ditolak: number
  berjalan: number
  selesai: number
}

/**
 * Kalimat keadaan kosong dirakit dari angka yang benar-benar ada.
 *
 * Kalimat tetap gampang berbohong: toko yang sama bisa masih punya pesanan
 * yang menunggu konfirmasi atau yang sudah ditolak, jadi kosongnya daftar di
 * sini tidak berarti semuanya sudah sampai. Halaman ini juga tidak punya
 * sakelar keadaan, jadi arahnya disebut apa adanya — tab Pesanan untuk yang
 * belum dijawab, halaman Lacak Pesanan untuk keadaan yang satunya.
 */
function pesanKosong(keadaan: Keadaan, h: HitunganToko): string {
  const bagian: string[] = [
    keadaan === 'proses'
      ? 'Yang masuk ke sini hanya pesanan yang sedang disiapkan di gudang atau sedang dikirim.'
      : 'Yang masuk ke sini hanya pesanan yang sudah sampai di tujuan.',
  ]

  const diTabPesanan: string[] = []
  if (h.menunggu > 0) {
    diTabPesanan.push(`${angka(h.menunggu)} pesanan yang menunggu konfirmasi kamu`)
  }
  if (h.ditolak > 0) diTabPesanan.push(`${angka(h.ditolak)} pesanan yang sudah kamu tolak`)
  if (diTabPesanan.length > 0) {
    bagian.push(`Di tab Pesanan, toko ini masih punya ${diTabPesanan.join(' dan ')}.`)
  }

  const lain = keadaan === 'proses' ? h.selesai : h.berjalan
  if (lain > 0) {
    bagian.push(
      keadaan === 'proses'
        ? `${angka(lain)} pesanan toko ini sudah sampai dan bisa dilihat di keadaan Selesai pada Lacak Pesanan.`
        : `${angka(lain)} pesanan toko ini masih berjalan dan bisa dilihat di keadaan Sedang Diproses pada Lacak Pesanan.`,
    )
  }

  if (bagian.length === 1) bagian.push('Toko ini memang belum punya pesanan lain yang tercatat.')
  return bagian.join(' ')
}

/** Status selalu ikon + teks + warna. */
const IKON_STATUS: Record<StatusPesananMasuk, ReactNode> = {
  'menunggu-konfirmasi': <IkonJam size={13} />,
  disiapkan: <IkonGudang size={13} />,
  dikirim: <IkonKirim size={13} />,
  selesai: <IkonCentangLingkaran size={13} />,
  ditolak: <IkonSilang size={13} />,
}

/**
 * Ikon foto ditulis lokal di berkas ini, bukan ditambahkan ke pustaka ikon
 * bersama: hanya layar ini yang memerlukannya, dan berkas ikon dipakai
 * bersama-sama oleh seluruh aplikasi.
 */
function IkonFoto({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5 3.5 3.5 3-2.5L20 17" />
    </svg>
  )
}

const ASPEK: Array<{ kunci: keyof UlasanPelanggan['aspek']; label: string }> = [
  { kunci: 'ketepatanWaktu', label: 'Ketepatan waktu kirim' },
  { kunci: 'jumlahSesuai', label: 'Jumlah sesuai pesanan' },
  { kunci: 'kondisiBarang', label: 'Kondisi barang' },
]

/**
 * Bintang kosong memakai `text-ink-3` penuh, bukan versi separuh transparan:
 * di tema gelap yang separuh itu nyaris hilang.
 */
function Bintang({ nilai }: { nilai: number }) {
  return (
    <span className="inline-flex items-center gap-px text-menipis">
      {[1, 2, 3, 4, 5].map((n) =>
        n <= nilai ? (
          <IkonBintangIsi key={n} size={16} />
        ) : (
          <IkonBintang key={n} size={16} className="text-ink-3" />
        ),
      )}
      <HanyaPembacaLayar>{angka(nilai)} dari 5 bintang</HanyaPembacaLayar>
    </span>
  )
}

function KepalaPesanan({ pesanan }: { pesanan: PesananMasuk }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[1rem] font-bold text-ink leading-snug">{pesanan.nomor}</h3>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3">
          Dipesan {tanggalPendek(pesanan.dibuatPada)}, {jam(pesanan.dibuatPada)}
        </p>
      </div>
      <Lencana nada={NADA_PESANAN_MASUK[pesanan.status]} ikon={IKON_STATUS[pesanan.status]}>
        {LABEL_PESANAN_MASUK[pesanan.status]}
      </Lencana>
    </div>
  )
}

function IsiPesanan({ pesanan }: { pesanan: PesananMasuk }) {
  return (
    <ul className="mt-2.5 space-y-0.5">
      {pesanan.baris.map((b) => (
        <li key={b.penawaranId} className="text-[0.875rem] text-ink-2 leading-snug">
          {b.nama} <span className="text-ink-3">&middot; {jumlahSatuan(b.jumlah, b.satuan)}</span>
        </li>
      ))}
    </ul>
  )
}

function TautanPesanan({ id }: { id: string }) {
  return (
    <Link
      to={`/distributor-portal/pesanan/${id}`}
      className="mt-3 inline-flex items-center gap-1.5 min-h-11 text-[0.875rem] font-bold text-brand hover:underline"
    >
      Buka rincian pesanan
      <IkonPanahKanan size={16} />
    </Link>
  )
}

/* ================================================================== */
/* Sedang Diproses: perjalanan barang                                 */
/* ================================================================== */

function PerjalananBarang({ pesanan }: { pesanan: PesananMasuk }) {
  // Jejak terakhir per tahap yang menang: kalau satu tahap tercatat dua kali,
  // yang ditampilkan catatan paling baru.
  const jejakPerTahap = new Map<StatusPesananMasuk, JejakPesananMasuk>()
  for (const j of pesanan.jejak) jejakPerTahap.set(j.status, j)
  const indeksSekarang = TAHAP_PESANAN_MASUK.indexOf(pesanan.status)

  return (
    <ol className="mt-3">
      {TAHAP_PESANAN_MASUK.map((tahap, i) => {
        const jejak = jejakPerTahap.get(tahap)
        const lewat = i < indeksSekarang
        const sekarang = i === indeksSekarang
        const sudah = lewat || sekarang
        return (
          <li key={tahap} className="relative pl-8 pb-5 last:pb-0">
            {i < TAHAP_PESANAN_MASUK.length - 1 && (
              <span
                aria-hidden="true"
                className={cx(
                  'absolute left-[7px] top-5 bottom-0 border-l-2 border-dotted',
                  lewat ? 'border-brand' : 'border-line-strong',
                )}
              />
            )}
            {/* Tinta terbalik, bukan putih tetap: di tema gelap warna merek
                jadi terang dan putih di atasnya praktis hilang. */}
            <span
              aria-hidden="true"
              className={cx(
                'absolute left-0 top-1 size-4 rounded-full border-2 grid place-items-center',
                sudah ? 'bg-brand border-brand text-ink-inverse' : 'bg-surface border-line-strong',
              )}
            >
              {lewat && <IkonCentang size={10} strokeWidth={3.5} />}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cx(
                  'text-[0.9375rem] leading-snug',
                  sudah ? 'font-bold text-ink' : 'font-semibold text-ink-3',
                )}
              >
                {LABEL_PESANAN_MASUK[tahap]}
              </p>
              {sekarang && (
                <Lencana nada="merek" ikon={<IkonLokasi size={13} />}>
                  Posisi sekarang
                </Lencana>
              )}
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug max-w-[68ch]">
              {jejak
                ? `${tanggalPendek(jejak.waktu)}, ${jam(jejak.waktu)} · ${jejak.keterangan}`
                : 'Belum terjadi.'}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

/* ================================================================== */
/* Selesai: penilaian dan bukti pengantaran                           */
/* ================================================================== */

function Penilaian({ ulasan }: { ulasan: UlasanPelanggan | null }) {
  if (!ulasan) {
    return (
      <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
        Toko ini belum menulis penilaian untuk pesanan tersebut. Penilaian memang tidak wajib, jadi
        kosong di sini bukan berarti mereka kecewa.
      </p>
    )
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Bintang nilai={ulasan.rating} />
        <span className="text-[0.8125rem] text-ink-3">{waktuLalu(ulasan.waktu)}</span>
      </div>
      <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed max-w-[68ch]">{ulasan.isi}</p>
      <ul className="mt-3 space-y-2.5">
        {ASPEK.map(({ kunci, label }) => (
          <li key={kunci}>
            <BilahProgres
              nilai={ulasan.aspek[kunci]}
              maks={5}
              label={label}
              tampilkanAngka
              nada={ulasan.aspek[kunci] >= 4 ? 'aman' : 'menipis'}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function BuktiAntar({ pesanan }: { pesanan: PesananMasuk }) {
  const b = pesanan.pengiriman
  if (!b) {
    return (
      <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
        Bukti pengantaran pesanan ini belum tercatat. Mintakan catatannya ke pengantar sebelum arsip
        bulan ini ditutup.
      </p>
    )
  }
  const rincian: Array<{ label: string; nilai: string; Ikon: typeof IkonKirim }> = [
    { label: 'Kurir', nilai: b.kurir, Ikon: IkonKirim },
    { label: 'Nama pengantar', nilai: b.namaPengantar, Ikon: IkonToko },
    { label: 'Nomor resi', nilai: b.nomorResi, Ikon: IkonNota },
    { label: 'Diterima oleh', nilai: b.diterimaOleh, Ikon: IkonCentangLingkaran },
    {
      label: 'Waktu sampai',
      nilai: `${tanggalPendek(b.waktuSampai)}, ${jam(b.waktuSampai)}`,
      Ikon: IkonKalender,
    },
  ]
  return (
    <div className="mt-2">
      <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
        {rincian.map(({ label, nilai, Ikon }) => (
          <div key={label} className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
              <Ikon size={16} />
            </span>
            <div className="min-w-0">
              <dt className="text-[0.75rem] text-ink-3">{label}</dt>
              <dd className="text-[0.875rem] text-ink font-semibold leading-snug break-words">
                {nilai}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[0.875rem] text-ink-2 leading-relaxed max-w-[68ch]">
        {b.catatan || 'Pengantar tidak meninggalkan catatan tambahan.'}
      </p>

      {b.foto.length > 0 && (
        <div className="mt-3">
          <p className="text-[0.8125rem] font-bold text-ink-2">
            {angka(b.foto.length)} foto terlampir
          </p>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {b.foto.map((keterangan) => (
              <li
                key={keterangan}
                className="flex items-center gap-2.5 rounded-md border border-dashed border-line-strong bg-sunken p-3"
              >
                <span className="shrink-0 text-ink-3" aria-hidden="true">
                  <IkonFoto size={18} />
                </span>
                <span className="min-w-0 text-[0.8125rem] text-ink-2 leading-snug">
                  {keterangan}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.75rem] text-ink-3 leading-snug max-w-[68ch]">
            Purwarupa ini baru memuat keterangan fotonya, berkas gambarnya belum ikut. Bingkai di
            atas menandai tempat foto akan muncul, bukan fotonya sendiri.
          </p>
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

export default function LacakToko() {
  const { umkmId = '' } = useParams()
  const [params] = useSearchParams()
  const keadaan: Keadaan = params.get('status') === 'selesai' ? 'selesai' : 'proses'

  const umkm = umkmById(umkmId)
  const pesananMasuk = useAplikasi((s) => s.pesananMasuk)

  const daftar = useMemo(() => {
    const diterima: StatusPesananMasuk[] = keadaan === 'selesai' ? ['selesai'] : STATUS_PROSES
    return pesananMasuk
      .filter((p) => p.umkmId === umkmId && diterima.includes(p.status))
      .sort((a, b) => +new Date(b.dibuatPada) - +new Date(a.dibuatPada))
  }, [pesananMasuk, umkmId, keadaan])

  // Seluruh pesanan toko ini dihitung per kondisi, bukan hanya yang lolos
  // saringan keadaan: keadaan kosong perlu tahu apa yang sebenarnya masih
  // tersisa sebelum berani menyimpulkan sesuatu.
  const hitungan = useMemo<HitunganToko>(() => {
    const milikToko = pesananMasuk.filter((p) => p.umkmId === umkmId)
    const hitung = (cocok: (s: StatusPesananMasuk) => boolean) =>
      milikToko.filter((p) => cocok(p.status)).length
    return {
      menunggu: hitung((s) => s === 'menunggu-konfirmasi'),
      ditolak: hitung((s) => s === 'ditolak'),
      berjalan: hitung((s) => STATUS_PROSES.includes(s)),
      selesai: hitung((s) => s === 'selesai'),
    }
  }, [pesananMasuk, umkmId])

  const kembaliKe = `/distributor-portal/lacak?status=${keadaan}`

  if (!umkm) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Toko tidak ditemukan" kembaliKe={kembaliKe} />
        <h2 className="sr-only">Toko tidak ditemukan</h2>
        <KeadaanKosong
          ikon={<IkonToko size={26} />}
          judul="Tokonya tidak ada di daftar pelangganmu"
          pesan="Tautannya mungkin sudah lama, atau toko itu memang belum pernah memesan ke kamu. Kembali ke Lacak Pesanan untuk memilih toko yang ada."
          tingkat="h3"
          aksi={<TombolTautan ke={kembaliKe}>Kembali ke Lacak Pesanan</TombolTautan>}
        />
      </div>
    )
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={umkm.nama}
        keterangan={`${umkm.kota} · ${umkm.jenisUsaha}`}
        kembaliKe={kembaliKe}
      />

      {/* 1. Siapa tokonya */}
      <section aria-labelledby="judul-toko" className="mt-4">
        <Kartu>
          <JudulBagian id="judul-toko" judul="Tentang toko ini" />
          <dl className="space-y-2.5">
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
                <IkonLokasi size={16} />
              </span>
              <div className="min-w-0">
                <dt className="text-[0.75rem] text-ink-3">Alamat</dt>
                <dd className="text-[0.875rem] text-ink leading-snug">{umkm.alamat}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
                <IkonTelepon size={16} />
              </span>
              <div className="min-w-0">
                <dt className="text-[0.75rem] text-ink-3">Nomor HP</dt>
                <dd className="text-[0.875rem] text-ink leading-snug">{nomorHp(umkm.nomorHp)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
                <IkonKalender size={16} />
              </span>
              <div className="min-w-0">
                <dt className="text-[0.75rem] text-ink-3">Bergabung sejak</dt>
                <dd className="text-[0.875rem] text-ink leading-snug">
                  {tanggalPanjang(umkm.sejak)}
                </dd>
              </div>
            </div>
          </dl>
        </Kartu>
      </section>

      {/* 2. Isi yang berganti mengikuti keadaan */}
      <section aria-labelledby="judul-daftar" className="mt-5">
        <JudulBagian
          id="judul-daftar"
          judul={keadaan === 'proses' ? 'Perjalanan barang' : 'Hasil pengantaran'}
          keterangan={
            keadaan === 'proses'
              ? 'Seluruh rute ditampilkan, termasuk langkah yang belum terjadi.'
              : 'Penilaian yang mereka tulis dan bukti bahwa barang benar diantar.'
          }
        />

        {daftar.length === 0 ? (
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul={
              keadaan === 'proses'
                ? 'Tidak ada pesanan yang sedang berjalan'
                : 'Belum ada pesanan yang selesai'
            }
            pesan={pesanKosong(keadaan, hitungan)}
            tingkat="h3"
            aksi={<TombolTautan ke={kembaliKe}>Kembali ke Lacak Pesanan</TombolTautan>}
          />
        ) : (
          <ul className="space-y-4">
            {daftar.map((p) => (
              <li key={p.id}>
                <Kartu>
                  <KepalaPesanan pesanan={p} />
                  <IsiPesanan pesanan={p} />

                  {keadaan === 'proses' ? (
                    <>
                      {p.perkiraanTiba && (
                        <p className="mt-3 text-[0.875rem] text-ink-2">
                          Perkiraan tiba{' '}
                          <strong className="text-ink">{waktuNanti(p.perkiraanTiba)}</strong>
                        </p>
                      )}
                      <h4 className="mt-3 text-[0.8125rem] font-bold text-ink-2 uppercase tracking-wide">
                        Rute barang
                      </h4>
                      <PerjalananBarang pesanan={p} />
                    </>
                  ) : (
                    <>
                      <h4 className="mt-4 text-[0.8125rem] font-bold text-ink-2 uppercase tracking-wide">
                        Penilaian pelanggan
                      </h4>
                      <Penilaian ulasan={p.ulasan} />

                      <h4 className="mt-5 text-[0.8125rem] font-bold text-ink-2 uppercase tracking-wide">
                        Bukti pengantaran
                      </h4>
                      <BuktiAntar pesanan={p} />
                    </>
                  )}

                  <TautanPesanan id={p.id} />
                </Kartu>
              </li>
            ))}
          </ul>
        )}
      </section>

      {keadaan === 'proses' && daftar.length > 0 && (
        <Peringatan nada="info" className="mt-5">
          Langkah yang belum terjadi sengaja tetap ditampilkan supaya terlihat berapa tahap lagi
          yang tersisa. Waktunya baru terisi setelah tahapnya benar-benar dilalui.
        </Peringatan>
      )}
    </div>
  )
}
