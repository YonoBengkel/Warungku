import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KartuPesanan, KuotaBulanIni, TombolTerkunci, useTerkunci } from '@/components/domain'
import { Avatar, JudulBagian, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import {
  IkonBintangIsi,
  IkonCentangLingkaran,
  IkonKeranjang,
  IkonKontrak,
  IkonPanahKanan,
  IkonToko,
} from '@/icons'
import { angka, cx, rupiah, tanggalPendek } from '@/lib/format'
import { BANTUAN, LABEL_KONTRAK } from '@/lib/label'
import { distributorById } from '@/data/dummy'
import type { Kontrak } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Drill-down dari header grup "Per pemasok" di tab Pesanan.
 *
 * Layar ini ada supaya satu hal bisa dikatakan sejelas mungkin: berbisnis
 * dengan satu distributor lewat beberapa kontrak BUKAN berarti kontraknya
 * digabung. Tiap barang tetap punya kontraknya sendiri, dengan kuota dan
 * tanggal berakhir sendiri. Yang digabung hanya kemudahan memesannya.
 */

function sisaKuota(k: Kontrak): number {
  return Math.max(0, k.periodeBerjalan.kuota - k.periodeBerjalan.diterima - k.dalamPerjalanan)
}

/**
 * Angka kontrak SELALU dijumlahkan per satuan. Menjumlahkan 30 kg dengan 10 dus
 * jadi "40" akan membuat pemilik usaha salah menghitung kewajibannya sendiri,
 * dan itu kesalahan yang baru ketahuan saat kuota terlanjur meleset.
 */
function jumlahPerSatuan(daftar: Kontrak[], ambil: (k: Kontrak) => number): string {
  const peta = new Map<string, number>()
  for (const k of daftar) {
    const n = ambil(k)
    if (n <= 0) continue
    peta.set(k.satuan, (peta.get(k.satuan) ?? 0) + n)
  }
  return Array.from(peta.entries())
    .map(([satuan, jumlah]) => `${angka(jumlah)} ${satuan}`)
    .join(' + ')
}

export default function Mitra() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const terkunci = useTerkunci()

  const distributor = distributorById(id)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const kontrakAktif = useMemo(
    () => kontrak.filter((k) => k.distributorId === id && (k.status === 'aktif' || k.status === 'akan-berakhir')),
    [kontrak, id],
  )
  const riwayatPesanan = useMemo(
    () => pesanan.filter((p) => p.distributorId === id),
    [pesanan, id],
  )

  if (!distributor) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Kerja Sama" kembaliKe="/pesanan?tab=kontrak&kelompok=pemasok" />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Distributor tidak ditemukan
          </h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Distributor ini tidak ditemukan"
            pesan="Tautannya mungkin sudah lama. Semua pemasok yang punya kontrak denganmu ada di tab Pesanan, bagian Kontrak."
            aksi={<TombolTautan ke="/pesanan?tab=kontrak&kelompok=pemasok">Lihat Kontrak Per Pemasok</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  const mitra = distributor
  const kewajibanTeks = jumlahPerSatuan(kontrakAktif, (k) => k.kuotaMinPerBulan)
  const sisaTeks = jumlahPerSatuan(kontrakAktif, sisaKuota)
  const nilaiBulanan = kontrakAktif.reduce((a, k) => a + k.kuotaMinPerBulan * k.hargaSatuan, 0)
  const adaSisa = kontrakAktif.some((k) => sisaKuota(k) > 0)
  const selesai = riwayatPesanan.filter((p) => p.status === 'selesai' || p.status === 'selesai-catatan').length

  /** Satu sub-keranjang, diisi sisa kuota tiap kontrak yang belum terpenuhi. */
  function pesanSekaligus() {
    let dimasukkan = 0
    for (const k of kontrakAktif) {
      const sisa = sisaKuota(k)
      if (sisa <= 0) continue
      tambahKeKeranjang(k.distributorId, k.penawaranId, sisa, sisa, k.id)
      dimasukkan += 1
    }
    if (dimasukkan === 0) {
      tampilkanRacun(`Kuota semua kontrak ${mitra.nama} bulan ini sudah terpenuhi.`, 'info')
      return
    }
    tampilkanRacun(`${dimasukkan} barang masuk keranjang ${mitra.nama}. Periksa dulu sebelum dikirim.`, 'aman')
    navigate('/keranjang')
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={`Kerja Sama dengan ${distributor.nama}`}
        keterangan={`${kontrakAktif.length} kontrak berjalan · ${distributor.kota}`}
        kembaliKe="/pesanan?tab=kontrak&kelompok=pemasok"
      />

      {/* Di layar lebar: kiri ringkasan kewajiban yang tetap terlihat sambil
          menggulir, kanan daftar kontrak dan riwayat pesanannya. Ringkasan itu
          yang dipakai membaca daftar di sebelahnya, jadi keduanya perlu
          terlihat bersamaan. */}
      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-6 lg:space-y-0">
        <section aria-labelledby="judul-mitra" className="lg:col-span-5">
          <h2 id="judul-mitra" className="sr-only">
            Ringkasan kerja sama
          </h2>
          <Kartu>
            <div className="flex items-start gap-3">
              <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={48} />
              <div className="min-w-0 grow">
                <p className="text-[1.0625rem] font-bold text-ink leading-tight">{distributor.nama}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-3">
                  {distributor.baru ? (
                    <Lencana nada="info">Pemasok baru</Lencana>
                  ) : (
                    distributor.rating != null && (
                      <span className="inline-flex items-center gap-1 text-ink-2">
                        <IkonBintangIsi size={14} className="text-menipis" />
                        <strong className="text-ink">{angka(distributor.rating, 1)}</strong>
                        <span>dari {distributor.jumlahUlasan} ulasan</span>
                      </span>
                    )
                  )}
                  {distributor.terverifikasi && (
                    <span className="inline-flex items-center gap-1">
                      <IkonCentangLingkaran size={14} className="text-aman" />
                      Terverifikasi
                    </span>
                  )}
                  <span>Sejak {distributor.sejak}</span>
                </div>
              </div>
              <Link
                to={`/distributor/${distributor.id}`}
                className="shrink-0 inline-flex items-center gap-1 text-[0.8125rem] font-bold text-brand hover:underline"
              >
                Profil <IkonPanahKanan size={15} />
              </Link>
            </div>

            <Pemisah className="my-3.5" />

            {/* Angka di sini dibiarkan berukuran sedang, bukan angka raksasa: isinya
                sering berupa dua satuan sekaligus ("30 kg + 10 dus") yang akan
                melewati tepi layar 360px kalau ditulis besar. Tiap keterangan di
                bawah angka menerangkan angka itu sendiri, bukan angka tetangganya. */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
                  <IkonKontrak size={14} />
                  Kewajiban bulanan
                </dt>
                <dd className="mt-1 text-[1.0625rem] font-extrabold text-ink leading-snug break-words">
                  {kewajibanTeks || 'Belum ada'}
                </dd>
                <p className="mt-0.5 text-[0.75rem] text-ink-3 leading-snug">
                  Gabungan dari {kontrakAktif.length} kontrak
                </p>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
                  Sisa kuota bulan ini
                </dt>
                <dd
                  className={cx(
                    'mt-1 text-[1.0625rem] font-extrabold leading-snug break-words',
                    adaSisa ? 'text-menipis-ink' : 'text-aman-ink',
                  )}
                >
                  {adaSisa ? sisaTeks : 'Terpenuhi'}
                </dd>
                <p className="mt-0.5 text-[0.75rem] text-ink-3 leading-snug">
                  {adaSisa ? 'Dihitung per satuan, tidak dicampur' : 'Semua kuota sudah terpenuhi'}
                </p>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
                  Nilai kontrak bulanan
                </dt>
                <dd className="mt-1 text-[1.0625rem] font-extrabold text-ink leading-snug break-words">
                  {rupiah(nilaiBulanan)}
                </dd>
                <p className="mt-0.5 text-[0.75rem] text-ink-3 leading-snug">
                  Kalau kuota minimum diambil penuh
                </p>
              </div>
              <div className="min-w-0">
                <dt className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Pesanan selesai</dt>
                <dd className="mt-1 text-[1.0625rem] font-extrabold text-ink leading-snug">
                  {angka(selesai)} pesanan
                </dd>
                <p className="mt-0.5 text-[0.75rem] text-ink-3 leading-snug">
                  Dari {riwayatPesanan.length} pesanan ke pemasok ini
                </p>
              </div>
            </dl>

            <p className="mt-3 text-[0.8125rem] text-ink-2 leading-relaxed bg-sunken rounded-md px-3 py-2.5">
              {BANTUAN.satuKontrakSatuBarang} Angka di atas hanya penjumlahan supaya mudah dibaca &mdash; kontraknya
              sendiri tetap terpisah, dengan kuota dan tanggal berakhir masing-masing.
            </p>

            {kontrakAktif.length > 0 && (
              <div className="mt-3">
                {terkunci ? (
                  <TombolTerkunci label={`Pesan sekaligus ke ${distributor.nama}`} penuh />
                ) : (
                  <Tombol penuh ikonKiri={<IkonKeranjang size={16} />} onClick={pesanSekaligus}>
                    Pesan sekaligus ke {distributor.nama}
                  </Tombol>
                )}
                {adaSisa && (
                  <p className="mt-1.5 text-[0.8125rem] font-semibold text-ink-2">
                    Sisa kuota yang akan dimasukkan: {sisaTeks}
                  </p>
                )}
                <p className="mt-1.5 text-[0.75rem] text-ink-3 leading-snug">
                  Mengisi satu keranjang untuk {distributor.nama} dengan sisa kuota tiap kontrak. Jumlahnya masih bisa
                  kamu ubah sebelum dikirim.
                </p>
              </div>
            )}
          </Kartu>
        </section>

        <div className="lg:col-span-7 space-y-6">
          {/* Nama bagian datang dari <h2> milik JudulBagian, jadi section ini
              tidak perlu label sendiri. */}
          <section>
            <JudulBagian
              judul={`${kontrakAktif.length} kontrak berjalan dengan ${distributor.nama}`}
              keterangan="Setiap barang punya kontraknya sendiri. Ketuk salah satu untuk melihat ketentuannya."
            />
            {kontrakAktif.length === 0 ? (
              <Kartu padat>
                <p className="text-[0.875rem] text-ink-3 leading-relaxed max-w-[70ch]">
                  Belum ada kontrak berjalan dengan {distributor.nama}. Kamu tetap bisa membeli lepas dari penawarannya.{' '}
                  <Link to={`/distributor/${distributor.id}`} className="font-semibold text-brand hover:underline">
                    Lihat penawaran
                  </Link>
                  .
                </p>
              </Kartu>
            ) : (
              <div className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0">
                {kontrakAktif.map((k) => {
                  const sisa = sisaKuota(k)
                  return (
                    <Link
                      key={k.id}
                      to={`/kontrak/${k.id}`}
                      className="block bg-surface border border-line rounded-lg p-4 shadow-e1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2 active:bg-surface-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[1.0625rem] font-bold text-ink leading-snug">{k.namaBarang}</p>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                            {k.durasiBulan} bulan &middot; sampai {tanggalPendek(k.berakhir)} &middot;{' '}
                            {rupiah(k.hargaSatuan)}/{k.satuan}
                          </p>
                        </div>
                        <Lencana nada={k.status === 'akan-berakhir' ? 'menipis' : 'merek'}>
                          {LABEL_KONTRAK[k.status]}
                        </Lencana>
                      </div>
                      <div className="mt-3">
                        <KuotaBulanIni kontrak={k} ringkas />
                      </div>
                      <p className="mt-2 text-[0.8125rem] text-ink-2">
                        {sisa > 0 ? (
                          <>
                            Kurang{' '}
                            <strong className="text-ink tabular">
                              {angka(sisa)} {k.satuan}
                            </strong>{' '}
                            bulan ini
                          </>
                        ) : (
                          'Kuota bulan ini sudah terpenuhi.'
                        )}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <JudulBagian
              judul={`Pesanan ke ${distributor.nama}`}
              keterangan={
                riwayatPesanan.length > 0
                  ? `${riwayatPesanan.length} pesanan, termasuk yang beli lepas tanpa kontrak`
                  : undefined
              }
            />
            {riwayatPesanan.length === 0 ? (
              <Kartu padat>
                <p className="text-[0.875rem] text-ink-3 leading-relaxed max-w-[70ch]">
                  Belum ada pesanan ke {distributor.nama}. Begitu ada, riwayatnya muncul di sini lengkap dengan
                  statusnya.
                </p>
              </Kartu>
            ) : (
              <div className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0">
                {riwayatPesanan.map((p) => (
                  <KartuPesanan key={p.id} pesanan={p} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
