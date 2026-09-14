import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Avatar,
  HanyaPembacaLayar,
  JudulBagian,
  Kartu,
  Lencana,
  Pemisah,
  TombolTautan,
} from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonBintangIsi,
  IkonCentangLingkaran,
  IkonKirim,
  IkonKontrak,
  IkonLokasi,
  IkonPanahKanan,
  IkonToko,
} from '@/icons'
import { angka, rupiah, tanggalPendek, waktuLalu } from '@/lib/format'
import type { Distributor, Penawaran } from '@/lib/types'
import { daftarPenawaran, distributorById, paketUntukPenawaran } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Profil distributor.
 *
 * Keputusan yang paling menentukan di layar ini: rating tidak pernah tampil
 * sebagai satu angka telanjang. Angka 4,6 tanpa konteks bisa berarti 4,6 dari
 * tiga ulasan atau dari empat ratus. Karena itu kepala rating selalu membawa
 * jumlah ulasan, jumlah UMKM yang menulis, dan jumlah pesanan selesai.
 *
 * Distributor baru tidak dipaksa masuk skala bintang. "0,0" adalah vonis, dan
 * mereka belum pernah diadili. Seluruh blok rating diganti kalimat jujur.
 */

const LABEL_SUB: Array<{ kunci: keyof Distributor['subRating']; label: string }> = [
  { kunci: 'ketepatanWaktu', label: 'Ketepatan waktu kirim' },
  { kunci: 'jumlahSesuai', label: 'Jumlah sesuai pesanan' },
  { kunci: 'kondisiBarang', label: 'Kondisi barang' },
]

/* Nilai bintang selalu satu desimal. `angka(4, 1)` menghasilkan "4", dan "4"
   berdampingan dengan "4,7" terbaca seperti dua skala yang berbeda. */
function satuDesimal(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function nadaNilai(n: number): 'aman' | 'merek' | 'menipis' | 'kritis' {
  if (n >= 4.5) return 'aman'
  if (n >= 4) return 'merek'
  if (n >= 3.5) return 'menipis'
  return 'kritis'
}

function BarisPenawaran({ penawaran }: { penawaran: Penawaran }) {
  const paket = paketUntukPenawaran(penawaran.id)
  return (
    <Link
      to={`/penawaran/${penawaran.id}`}
      className="flex items-center gap-3 bg-surface border border-line rounded-md px-3.5 py-3 min-h-[72px] transition-[border-color] hover:border-line-strong active:bg-surface-2"
    >
      <div className="min-w-0 grow">
        <p className="text-[0.9375rem] font-semibold text-ink leading-snug">{penawaran.nama}</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2">
          {rupiah(penawaran.hargaSatuan)}
          <span className="text-ink-3">/{penawaran.satuan}</span>
          <span className="text-ink-3">
            {' '}
            &middot; stok {angka(penawaran.stokTersedia)} {penawaran.satuan}
          </span>
        </p>
        {paket.length > 0 && (
          <div className="mt-1.5">
            <Lencana nada="info" ikon={<IkonKontrak size={13} />}>
              Tersedia kontrak {Math.min(...paket.map((p) => p.durasiBulan))}-
              {Math.max(...paket.map((p) => p.durasiBulan))} bulan
            </Lencana>
          </div>
        )}
      </div>
      <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
    </Link>
  )
}

export default function DistributorProfil() {
  const { id = '' } = useParams()
  const distributor = distributorById(id)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)

  const penawaran = useMemo(() => daftarPenawaran.filter((p) => p.distributorId === id), [id])

  const kontrakBerjalan = kontrak.filter(
    (k) => k.distributorId === id && (k.status === 'aktif' || k.status === 'akan-berakhir'),
  )
  /* Diurutkan dari yang paling baru supaya kalimat "terakhir ..." di bawah tidak
     menyebut pesanan lama hanya karena ia kebetulan berada di awal daftar. */
  const pesananSelesai = pesanan
    .filter((p) => p.distributorId === id && (p.status === 'selesai' || p.status === 'selesai-catatan'))
    .slice()
    .sort((a, b) => +new Date(b.dibuatPada) - +new Date(a.dibuatPada))
  const belumDiulas = pesananSelesai.find((p) => !p.sudahDiulas)

  if (!distributor) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Distributor" kembaliKe="/belanja?tab=distributor" />
        <Kartu className="mt-6">
          <h2 className="sr-only">Distributor tidak ditemukan</h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Distributor ini tidak ada lagi"
            pesan="Tautan yang kamu buka menunjuk ke distributor yang sudah tidak terdaftar. Isinya mungkin dihapus atau tautannya salah salin."
            aksi={<TombolTautan ke="/belanja?tab=distributor">Lihat daftar distributor</TombolTautan>}
          />
        </Kartu>
      </div>
    )
  }

  const belumDinilai = distributor.baru || distributor.rating == null
  const satuanJual = Array.from(new Set(penawaran.map((p) => p.satuan)))

  return (
    <div className="pb-6">
      <KepalaHalaman judul={distributor.nama} keterangan={distributor.kota} kembaliKe="/belanja?tab=distributor" />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-5 space-y-4">
          {/* Identitas. Nama dan kota tidak diulang di sini: keduanya sudah
              menempel permanen di kepala halaman yang lengket di atas layar. */}
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink mb-2.5">Tentang distributor ini</h2>
            <div className="flex items-start gap-3.5">
              <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={56} />
              <div className="min-w-0 grow">
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">{distributor.deskripsi}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Lencana nada="netral" ikon={<IkonLokasi size={13} />}>
                    Berkantor di {distributor.kota}
                  </Lencana>
                  {distributor.terverifikasi ? (
                    <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />}>
                      Terverifikasi
                    </Lencana>
                  ) : (
                    <Lencana nada="netral">Belum terverifikasi</Lencana>
                  )}
                  {kontrakBerjalan.length > 0 && (
                    <Lencana nada="merek" ikon={<IkonKontrak size={13} />}>
                      Mitra kamu
                    </Lencana>
                  )}
                </div>
              </div>
            </div>
          </Kartu>

          {/* Kepala rating: konteks, bukan satu angka */}
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink mb-2.5">Penilaian dari UMKM lain</h2>

            {belumDinilai ? (
              <>
                <Lencana nada="netral" besar>
                  Distributor Baru &middot; belum ada ulasan &middot; bergabung {distributor.sejak}
                </Lencana>
                <p className="mt-2.5 text-[0.875rem] text-ink-2 leading-relaxed">
                  Kami tidak menampilkan nilai bintang sebelum ada ulasan pertama, karena angka nol akan terbaca
                  sebagai penilaian buruk padahal mereka memang belum pernah dinilai.
                </p>
                <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
                  Sudah {angka(distributor.jumlahPesananSelesai)} pesanan selesai lewat aplikasi. Kalau kamu ingin
                  mencoba, mulai dari jumlah kecil dulu sebelum mengikat kontrak panjang.
                </p>
              </>
            ) : (
              <>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="inline-flex items-baseline gap-1.5 text-[1.625rem] font-extrabold text-ink leading-none tracking-tight">
                    <IkonBintangIsi size={22} className="text-menipis self-center" />
                    {satuDesimal(distributor.rating ?? 0)}
                    <HanyaPembacaLayar> dari 5 bintang</HanyaPembacaLayar>
                  </span>
                  <span className="text-[0.875rem] text-ink-2">
                    {distributor.jumlahUlasan} ulasan dari {distributor.jumlahUmkmPengulas} UMKM &middot;{' '}
                    {angka(distributor.jumlahPesananSelesai)} pesanan selesai
                  </span>
                </p>

                <div className="mt-4 space-y-3">
                  {LABEL_SUB.map(({ kunci, label }) => {
                    const nilai = distributor.subRating[kunci]
                    return (
                      <div key={kunci}>
                        <div className="flex items-baseline justify-between gap-3 mb-1.5">
                          <span className="text-[0.8125rem] text-ink-2 font-medium">{label}</span>
                          <span className="text-[0.8125rem] font-bold text-ink tabular">
                            {satuDesimal(nilai)} <span className="font-normal text-ink-3">dari 5</span>
                          </span>
                        </div>
                        <BilahProgres nilai={nilai} maks={5} nada={nadaNilai(nilai)} tinggi={8} label={label} />
                      </div>
                    )
                  })}
                </div>

                <Pemisah className="my-3.5" />

                <Link
                  to={`/distributor/${distributor.id}/ulasan`}
                  className="inline-flex items-center gap-1.5 text-[0.875rem] font-bold text-brand hover:underline"
                >
                  Baca ulasan dari UMKM lain
                  <IkonPanahKanan size={16} />
                </Link>
              </>
            )}
          </Kartu>

          {/* Teks status menggantikan tombol tulis ulasan: ulasan hanya lahir dari
              satu pintu, yaitu pesanan yang sudah selesai, supaya penilaian selalu
              punya dasar yang bisa diperiksa. */}
          {belumDiulas ? (
            <Peringatan nada="info" judul="Penilaianmu ditunggu">
              Pesanan {belumDiulas.nomor} dari distributor ini sudah selesai, jadi kamu bisa menuliskan
              penilaiannya dari halaman pesanan itu.
              <div className="mt-2.5">
                <Link
                  to={`/pesanan/${belumDiulas.id}`}
                  className="inline-flex items-center gap-1 text-[0.8125rem] font-bold underline underline-offset-2"
                >
                  Buka pesanan {belumDiulas.nomor}
                  <IkonPanahKanan size={15} />
                </Link>
              </div>
            </Peringatan>
          ) : (
            <p className="text-[0.875rem] text-ink-3 leading-relaxed px-1">
              Kamu bisa menulis ulasan setelah pesanan kamu selesai.
            </p>
          )}

          {/* Fakta pengiriman */}
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink mb-2.5">Pengiriman &amp; keanggotaan</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-[0.8125rem] text-ink-3 flex items-center gap-1.5">
                  <IkonKirim size={14} /> Area kirim
                </dt>
                <dd className="mt-1 text-[0.875rem] font-semibold text-ink leading-relaxed">
                  {distributor.areaKirim.join(' · ')}
                </dd>
              </div>
              <div>
                <dt className="text-[0.8125rem] text-ink-3">Minimum kirim</dt>
                <dd className="mt-1 text-[0.875rem] font-semibold text-ink leading-relaxed">
                  {satuanJual.length > 0
                    ? `Minimal 1 ${satuanJual.join(' / ')} per barang, mengikuti kemasan jual distributor`
                    : 'Belum ada barang yang dijual, jadi minimum kirim belum berlaku'}
                </dd>
              </div>
              <div>
                <dt className="text-[0.8125rem] text-ink-3">Bergabung sejak</dt>
                <dd className="mt-1 text-[0.875rem] font-semibold text-ink">{distributor.sejak}</dd>
              </div>
              <div>
                <dt className="text-[0.8125rem] text-ink-3">Kategori barang</dt>
                <dd className="mt-1 text-[0.875rem] font-semibold text-ink">{distributor.kategori.join(', ')}</dd>
              </div>
            </dl>
          </Kartu>
        </div>

        <div className="lg:col-span-7 mt-6 lg:mt-0 space-y-6">
          {/* Kontrak yang sedang berjalan dengan distributor ini */}
          {kontrakBerjalan.length > 0 && (
            <section aria-label="Kontrak berjalan dengan distributor ini">
              <JudulBagian
                judul="Kontrak kamu dengan distributor ini"
                keterangan="Setiap barang punya kontrak sendiri."
              />
              <div className="space-y-2.5">
                {kontrakBerjalan.map((k) => (
                  <Link
                    key={k.id}
                    to={`/kontrak/${k.id}`}
                    className="flex items-center gap-3 bg-surface border border-line rounded-md px-3.5 py-3 min-h-[72px] hover:border-line-strong"
                  >
                    <div className="min-w-0 grow">
                      <p className="text-[0.9375rem] font-semibold text-ink">{k.namaBarang}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                        Minimal {angka(k.kuotaMinPerBulan)} {k.satuan}/bulan &middot; berakhir{' '}
                        {tanggalPendek(k.berakhir)}
                      </p>
                    </div>
                    <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Barang yang dijual distributor ini">
            <JudulBagian
              judul="Barang yang dijual"
              keterangan={
                penawaran.length > 0
                  ? `${penawaran.length} barang · harga di bawah berlaku untuk pembelian sekali`
                  : undefined
              }
            />
            {penawaran.length === 0 ? (
              <Kartu>
                <KeadaanKosong
                  padat
                  ikon={<IkonToko size={24} />}
                  judul="Belum ada barang yang dipasang"
                  pesan="Distributor ini belum memasang satu pun barang untuk dijual di aplikasi. Coba lihat distributor lain yang mengirim ke kotamu."
                  aksi={<TombolTautan ke="/belanja">Cari barang di Belanja</TombolTautan>}
                />
              </Kartu>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {penawaran.map((p) => (
                  <BarisPenawaran key={p.id} penawaran={p} />
                ))}
              </div>
            )}
          </section>

          {pesananSelesai.length > 0 && (
            <p className="text-[0.8125rem] text-ink-3 px-1">
              Kamu sudah {pesananSelesai.length} kali menyelesaikan pesanan dari distributor ini. Terakhir{' '}
              {waktuLalu(pesananSelesai[0].dibuatPada)}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
