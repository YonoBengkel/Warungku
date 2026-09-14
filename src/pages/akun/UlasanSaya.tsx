import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { Avatar, JudulBagian, Kartu, Lencana, Pemisah, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonBintang, IkonBintangIsi, IkonKunci, IkonPena } from '@/icons'
import { angka, tanggalPendek, waktuLalu } from '@/lib/format'
import { daftarUlasan, distributorById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Jalur pemulihan untuk ajakan menilai yang sekali tayang.
 *
 * Di halaman pesanan, ajakan memberi penilaian hanya muncul satu kali dan bisa
 * ditutup. Tanpa layar ini, pesanan yang ajakannya telanjur ditutup tidak punya
 * jalan kembali sama sekali — dan penilaian yang hilang merugikan distributor
 * yang bekerja baik, bukan aplikasinya.
 */

function Bintang({ nilai }: { nilai: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-menipis">
      {[1, 2, 3, 4, 5].map((i) =>
        i <= nilai ? <IkonBintangIsi key={i} size={15} /> : <IkonBintang key={i} size={15} className="text-ink-3" />,
      )}
      <span className="sr-only">{nilai} dari 5 bintang</span>
    </span>
  )
}

export default function UlasanSaya() {
  const pesanan = useAplikasi((s) => s.pesanan)
  const namaUsaha = useAplikasi((s) => s.profil.namaUsaha)

  const belumDinilai = useMemo(
    () =>
      pesanan
        .filter((p) => (p.status === 'selesai' || p.status === 'selesai-catatan') && !p.sudahDiulas)
        .sort((a, b) => +new Date(b.dibuatPada) - +new Date(a.dibuatPada)),
    [pesanan],
  )

  const sudahDinilai = useMemo(
    () =>
      daftarUlasan
        .filter((u) => u.namaUsaha === namaUsaha)
        .slice()
        .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu)),
    [namaUsaha],
  )

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Ulasan Saya"
        keterangan={`${belumDinilai.length} belum dinilai · ${sudahDinilai.length} sudah ditulis`}
        kembaliKe="/akun"
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Belum kamu nilai */}
          <section aria-label="Belum kamu nilai">
            <JudulBagian
              judul="Belum kamu nilai"
              keterangan="Pesanan yang sudah selesai tapi penilaiannya belum kamu tulis."
              className="mb-3"
            />

            {belumDinilai.length === 0 ? (
              <Kartu>
                <KeadaanKosong
                  padat
                  ikon={<IkonPena size={26} />}
                  judul="Semua pesananmu sudah dinilai"
                  pesan="Begitu ada pesanan baru yang selesai, ia muncul di sini supaya kamu bisa menilainya kapan pun sempat."
                  aksi={
                    <TombolTautan ke="/pesanan" ragam="garis">
                      Lihat Pesanan
                    </TombolTautan>
                  }
                />
              </Kartu>
            ) : (
              <div className="space-y-3">
                {belumDinilai.map((p) => {
                  const d = distributorById(p.distributorId)
                  const selesaiPada = p.jejak[p.jejak.length - 1]?.waktu ?? p.dibuatPada
                  const utama = p.baris[0]
                  const lain = p.baris.length - 1
                  return (
                    <Kartu key={p.id} padat className="min-h-[88px]">
                      <div className="flex items-start gap-3">
                        <Avatar nama={d?.nama ?? '?'} warna={d?.warna} ukuran={44} className="mt-0.5" />
                        <div className="min-w-0 grow">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[1rem] font-semibold text-ink leading-snug truncate">{d?.nama}</p>
                            {p.status === 'selesai-catatan' && (
                              <Lencana nada="menipis" className="shrink-0 mt-0.5">
                                Ada catatan
                              </Lencana>
                            )}
                          </div>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-2 truncate">
                            {utama ? `${utama.nama} ${angka(utama.jumlah)} ${utama.satuan}` : 'Pesanan kosong'}
                            {lain > 0 && ` + ${lain} barang lain`}
                          </p>
                          <p className="mt-0.5 text-[0.75rem] text-ink-3">
                            {p.nomor} &middot; selesai {waktuLalu(selesaiPada)}
                          </p>
                          <div className="mt-2.5">
                            <TombolTautan
                              ke={`/pesanan/${p.id}/ulasan`}
                              ukuran="kecil"
                              ikonKiri={<IkonPena size={15} />}
                            >
                              Beri Penilaian
                            </TombolTautan>
                          </div>
                        </div>
                      </div>
                    </Kartu>
                  )
                })}
              </div>
            )}
          </section>

          {/* 2. Sudah kamu nilai */}
          <section aria-label="Sudah kamu nilai">
            <JudulBagian
              judul="Sudah kamu nilai"
              keterangan="Ulasan ini tampil di profil distributor dengan nama usahamu."
              className="mb-3"
            />

            {sudahDinilai.length === 0 ? (
              <Kartu>
                <KeadaanKosong
                  padat
                  ikon={<IkonBintang size={26} />}
                  judul="Kamu belum pernah menulis ulasan"
                  pesan="Ulasan pertamamu bisa ditulis dari pesanan yang sudah selesai di bagian atas halaman ini."
                  aksi={
                    <TombolTautan ke="/pesanan" ragam="garis">
                      Lihat Pesanan Selesai
                    </TombolTautan>
                  }
                />
              </Kartu>
            ) : (
              <div className="space-y-3">
                {sudahDinilai.map((u) => {
                  const d = distributorById(u.distributorId)
                  return (
                    <Kartu key={u.id} padat>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/distributor/${u.distributorId}`}
                            className="text-[0.9375rem] font-bold text-ink hover:text-brand transition-colors truncate block"
                          >
                            {d?.nama ?? 'Distributor'}
                          </Link>
                          <p className="mt-0.5 text-[0.75rem] text-ink-3">
                            {u.pesananId} &middot; {tanggalPendek(u.waktu)}
                          </p>
                        </div>
                        <Bintang nilai={u.rating} />
                      </div>

                      <p className="mt-2.5 text-[0.875rem] text-ink-2 leading-relaxed">{u.isi}</p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-ink-3">
                        <span>Tepat waktu {u.aspek.ketepatanWaktu}/5</span>
                        <span>Jumlah sesuai {u.aspek.jumlahSesuai}/5</span>
                        <span>Kondisi barang {u.aspek.kondisiBarang}/5</span>
                      </div>

                      <Pemisah className="my-2.5" />

                      <p className="flex items-start gap-2 text-[0.75rem] text-ink-3 leading-snug">
                        <IkonKunci size={14} className="shrink-0 mt-0.5" />
                        <span>
                          Label sistem: <span className="text-ink-2">{u.labelSistem}</span>
                        </span>
                      </p>
                    </Kartu>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Aturan penilaian, ditaruh sekali dan berlaku untuk kedua bagian */}
        <div className="lg:col-span-5 mt-6 lg:mt-0 space-y-4">
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">Aturan menulis ulasan</h2>
            <ul className="mt-3 space-y-3 text-[0.875rem] text-ink-2 leading-relaxed">
              <li>
                <strong className="text-ink">Hanya setelah pesanan selesai.</strong> Ulasan tidak bisa ditulis untuk
                pesanan yang masih berjalan atau yang dibatalkan, supaya penilaian selalu berdasarkan barang yang
                benar-benar kamu terima.
              </li>
              <li>
                <strong className="text-ink">Satu pesanan, satu ulasan.</strong> Kamu menilai pengalaman pada
                pesanan itu, bukan distributornya secara umum. Kalau pesanan berikutnya lebih baik, tulis ulasan baru
                untuk pesanan itu.
              </li>
              <li>
                <strong className="text-ink">Tiap ulasan membawa label sistem.</strong> Baris seperti "Terverifikasi
                &middot; 7 pesanan &middot; pelanggan sejak Feb 2026" ditulis sistem dari riwayat pesananmu dan tidak
                bisa kamu ubah, juga tidak bisa diubah distributor.
              </li>
            </ul>
          </Kartu>

          <Peringatan nada="info">
            Ulasanmu tampil dengan nama usaha, bukan nama pribadimu. Alamat dan nomor HP tidak pernah ikut
            ditampilkan di sana.
          </Peringatan>
        </div>
      </div>
    </div>
  )
}
