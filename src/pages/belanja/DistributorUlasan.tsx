import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  HanyaPembacaLayar,
  Kartu,
  Lencana,
  Pemisah,
  Tombol,
  TombolTautan,
} from '@/components/ui/dasar'
import { BarisChip, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonBintang, IkonBintangIsi, IkonInfo, IkonToko } from '@/icons'
import { angka, cx, tanggalPendek, waktuLalu } from '@/lib/format'
import type { Ulasan } from '@/lib/types'
import { distributorById, ulasanUntuk } from '@/data/dummy'

/**
 * Daftar ulasan satu distributor.
 *
 * Dua hal yang dijaga di layar ini:
 * 1. Label sistem ("Terverifikasi - 9 pesanan - pelanggan sejak Feb 2025")
 *    berasal dari riwayat pesanan, bukan dari penulis ulasan, dan itu
 *    dinyatakan terang-terangan supaya bobotnya berbeda dari isi ulasan.
 * 2. Sebaran bintang ditampilkan penuh 5 sampai 1. Rata-rata sendirian
 *    menyembunyikan pola "bagus sekali atau jelek sekali" yang justru paling
 *    penting diketahui sebelum mengikat kontrak.
 */

const ASPEK: Array<{ kunci: keyof Ulasan['aspek']; label: string }> = [
  { kunci: 'ketepatanWaktu', label: 'Ketepatan waktu kirim' },
  { kunci: 'jumlahSesuai', label: 'Jumlah sesuai pesanan' },
  { kunci: 'kondisiBarang', label: 'Kondisi barang' },
]

/**
 * Bintang kosong memakai `text-ink-3` penuh, bukan versi separuh transparan:
 * di mode gelap yang separuh itu turun ke 2,2:1 dan bintangnya seperti hilang.
 *
 * `srNilai` dipakai saat gambar bintang dibulatkan tapi angka yang tertulis di
 * sebelahnya tidak — pembaca layar harus mendengar angka yang sama.
 */
function Bintang({ nilai, ukuran = 15, srNilai }: { nilai: number; ukuran?: number; srNilai?: number }) {
  return (
    <span className="inline-flex items-center gap-px text-menipis">
      {[1, 2, 3, 4, 5].map((n) =>
        n <= nilai ? (
          <IkonBintangIsi key={n} size={ukuran} />
        ) : (
          <IkonBintang key={n} size={ukuran} className="text-ink-3" />
        ),
      )}
      <HanyaPembacaLayar>{angka(srNilai ?? nilai, 1)} dari 5 bintang</HanyaPembacaLayar>
    </span>
  )
}

function KartuUlasan({ ulasan }: { ulasan: Ulasan }) {
  return (
    <article className="bg-surface border border-line rounded-lg p-4 shadow-e1">
      <div className="flex items-start gap-3">
        <Avatar nama={ulasan.namaUsaha} ukuran={40} />
        <div className="min-w-0 grow">
          <h3 className="text-[0.9375rem] font-bold text-ink leading-snug">{ulasan.namaUsaha}</h3>
          <p className="text-[0.8125rem] text-ink-3">{ulasan.kotaUsaha}</p>
        </div>
        <div className="shrink-0 text-right">
          <Bintang nilai={ulasan.rating} />
          <p className="mt-0.5 text-[0.75rem] text-ink-3" title={tanggalPendek(ulasan.waktu)}>
            {waktuLalu(ulasan.waktu)}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-[0.875rem] text-ink-2 leading-relaxed">{ulasan.isi}</p>

      {/* Label sistem sengaja dipisah dari isi ulasan: penulisnya tidak bisa
          mengarangnya, jadi bobot buktinya beda. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Lencana nada="netral">{ulasan.labelSistem}</Lencana>
        <span className="inline-flex items-center gap-1 text-[0.75rem] text-ink-3">
          <IkonInfo size={13} />
          Ditulis sistem dari riwayat pesanan
        </span>
      </div>

      <Pemisah className="my-3" />

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
        {ASPEK.map(({ kunci, label }) => (
          <div key={kunci} className="flex items-center justify-between gap-2 sm:block">
            <dt className="text-[0.75rem] text-ink-3 sm:mb-1">{label}</dt>
            <dd>
              <Bintang nilai={ulasan.aspek[kunci]} ukuran={13} />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default function DistributorUlasan() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const distributor = distributorById(id)
  const semua = useMemo(() => ulasanUntuk(id), [id])

  const saringBintang = Number(params.get('bintang') ?? 0)

  function aturBintang(n: number) {
    const baru = new URLSearchParams(params)
    if (n === 0) baru.delete('bintang')
    else baru.set('bintang', String(n))
    setParams(baru, { replace: true })
  }

  const sebaran = useMemo(() => {
    const hitung: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const u of semua) hitung[u.rating] = (hitung[u.rating] ?? 0) + 1
    return hitung
  }, [semua])

  const rataRata = useMemo(
    () => (semua.length > 0 ? semua.reduce((a, u) => a + u.rating, 0) / semua.length : 0),
    [semua],
  )

  const terlihat = useMemo(
    () =>
      semua
        .filter((u) => (saringBintang > 0 ? u.rating === saringBintang : true))
        .slice()
        .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu)),
    [semua, saringBintang],
  )

  if (!distributor) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Ulasan" kembaliKe="/belanja?tab=distributor" />
        <Kartu className="mt-6">
          <h2 className="sr-only">Distributor tidak ditemukan</h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Distributor ini tidak ada lagi"
            pesan="Ulasan yang kamu cari milik distributor yang sudah tidak terdaftar di aplikasi."
            aksi={<TombolTautan ke="/belanja?tab=distributor">Lihat daftar distributor</TombolTautan>}
          />
        </Kartu>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Ulasan"
        keterangan={distributor.nama}
        kembaliKe={`/distributor/${distributor.id}`}
      />

      {semua.length === 0 ? (
        <Kartu className="mt-4">
          <h2 className="sr-only">Ulasan dari UMKM lain</h2>
          <KeadaanKosong
            ikon={<IkonBintang size={26} />}
            judul="Belum ada ulasan untuk distributor ini"
            pesan={
              distributor.baru
                ? `${distributor.nama} baru bergabung ${distributor.sejak} dan belum ada UMKM yang menulis ulasan. Kami tidak menampilkan nilai bintang sebelum ada ulasan pertama.`
                : `Belum ada UMKM yang menulis ulasan untuk ${distributor.nama}. Kamu bisa jadi yang pertama setelah pesanan kamu selesai.`
            }
            aksi={<TombolTautan ke={`/distributor/${distributor.id}`}>Kembali ke profil</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/belanja?tab=distributor" ragam="garis">
                Bandingkan distributor lain
              </TombolTautan>
            }
          />
        </Kartu>
      ) : (
        <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
          {/* Ringkasan sebaran */}
          <div className="lg:col-span-5">
            <Kartu>
              <h2 className="text-[0.9375rem] font-bold text-ink">Sebaran penilaian</h2>

              <div className="mt-3 flex items-center gap-4">
                <div>
                  <p className="text-[1.625rem] font-extrabold text-ink leading-none tracking-tight">
                    {angka(rataRata, 1)}
                  </p>
                  <div className="mt-1.5">
                    <Bintang nilai={Math.round(rataRata)} srNilai={rataRata} />
                  </div>
                </div>
                <p className="text-[0.8125rem] text-ink-2 leading-relaxed">
                  Rata-rata dari {semua.length} ulasan yang bisa ditampilkan
                  {distributor.jumlahUlasan > semua.length && (
                    <>, dari total {distributor.jumlahUlasan} ulasan yang tercatat</>
                  )}
                  .
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {[5, 4, 3, 2, 1].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => aturBintang(saringBintang === n ? 0 : n)}
                    aria-pressed={saringBintang === n}
                    className={cx(
                      'w-full min-h-11 flex items-center gap-3 px-2 py-1.5 rounded-sm transition-colors text-left',
                      saringBintang === n ? 'bg-brand-soft' : 'hover:bg-sunken',
                    )}
                  >
                    <span className="shrink-0 w-14 text-[0.8125rem] font-semibold text-ink-2 tabular">
                      {n} bintang
                    </span>
                    <span className="grow">
                      <BilahProgres
                        nilai={sebaran[n] ?? 0}
                        maks={semua.length}
                        nada={n >= 4 ? 'aman' : n === 3 ? 'menipis' : 'kritis'}
                        tinggi={8}
                        label={`${sebaran[n] ?? 0} dari ${semua.length} ulasan memberi ${n} bintang`}
                      />
                    </span>
                    <span className="shrink-0 w-6 text-right text-[0.8125rem] font-bold text-ink tabular">
                      {sebaran[n] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[0.75rem] text-ink-3 leading-relaxed">
                Ketuk salah satu baris untuk menyaring daftar ulasannya.
              </p>
            </Kartu>
          </div>

          {/* Daftar ulasan */}
          <div className="lg:col-span-7 mt-5 lg:mt-0">
            {/* Chip penyaring hanya untuk layar sempit. Di layar lebar kartu
                sebaran di sebelah kiri sudah jadi penyaringnya, dan dua kendali
                yang sama persis terlihat bersamaan cuma membingungkan. */}
            <BarisChip className="mb-3 lg:hidden">
              <Chip aktif={saringBintang === 0} onClick={() => aturBintang(0)}>
                Semua ({semua.length})
              </Chip>
              {[5, 4, 3, 2, 1].map((n) => (
                <Chip key={n} aktif={saringBintang === n} onClick={() => aturBintang(n)}>
                  {n} bintang ({sebaran[n] ?? 0})
                </Chip>
              ))}
            </BarisChip>

            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 className="text-[0.9375rem] font-bold text-ink">
                {saringBintang > 0
                  ? `Ulasan ${saringBintang} bintang (${terlihat.length})`
                  : `Semua ulasan (${terlihat.length})`}
              </h2>
              {saringBintang > 0 && (
                <Tombol ragam="sunyi" ukuran="kecil" onClick={() => aturBintang(0)}>
                  Tampilkan semua ulasan
                </Tombol>
              )}
            </div>

            {terlihat.length === 0 ? (
              <Kartu>
                <KeadaanKosong
                  padat
                  ikon={<IkonBintang size={24} />}
                  judul={`Tidak ada ulasan ${saringBintang} bintang`}
                  pesan="Belum ada UMKM yang memberi nilai sebanyak itu untuk distributor ini. Coba lihat semua ulasan supaya gambarannya utuh."
                  aksi={<Tombol onClick={() => aturBintang(0)}>Tampilkan semua ulasan</Tombol>}
                />
              </Kartu>
            ) : (
              <div className="space-y-3">
                {terlihat.map((u) => (
                  <KartuUlasan key={u.id} ulasan={u} />
                ))}
              </div>
            )}

            <p className="mt-5 text-[0.8125rem] text-ink-3 leading-relaxed px-1">
              Kamu bisa menulis ulasan setelah pesanan kamu selesai. Penilaian yang sudah terkirim tidak bisa
              dihapus sendiri, supaya rekam jejaknya tetap bisa dipercaya distributor maupun UMKM lain.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
