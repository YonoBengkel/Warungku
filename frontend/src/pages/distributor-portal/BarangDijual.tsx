import { useMemo, useState } from 'react'
import { Kartu, Lencana, Tombol } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { IkonKotak, IkonMata, IkonMataTutup, IkonPena, IkonTambah } from '@/icons'
import { angka, cx, rupiah, tanggalPendek } from '@/lib/format'
import type { Penawaran } from '@/lib/types'
import { useAplikasi, useDistributorAktif } from '@/store/aplikasi'
import { FormBarang, kalimatKelipatan } from './formProfil'

/**
 * Barang yang Dijual, halaman bawahan Akun distributor (revisi V4, Q94): harga,
 * stok, dan kelipatan yang dilihat pemilik usaha saat memesan. Dulu daftar ini
 * membuka halaman profil; kini halamannya sendiri, satu kotak per barang.
 */
export default function BarangDijual() {
  const katalog = useAplikasi((s) => s.katalog)
  const aturAktifPenawaran = useAplikasi((s) => s.aturAktifPenawaran)
  const distributor = useDistributorAktif()
  const [formBarang, setFormBarang] = useState<{ penawaran: Penawaran | null } | null>(null)

  const penawaranSaya = useMemo(
    () => katalog.filter((p) => p.distributorId === distributor.id),
    [katalog, distributor.id],
  )
  const jumlahDijual = penawaranSaya.filter((p) => p.aktif !== false).length

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul="Barang yang Dijual"
        keterangan={`${angka(jumlahDijual)} barang dijual · harga dan stok yang dilihat pemilik usaha`}
        kembaliKe="/distributor-portal/profil"
        aksi={
          <Tombol ukuran="kecil" ikonKiri={<IkonTambah size={15} />} onClick={() => setFormBarang({ penawaran: null })}>
            Tambah
          </Tombol>
        }
      />

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        {penawaranSaya.map((pw) => {
          const nonaktif = pw.aktif === false
          return (
            <li key={pw.id}>
              <Kartu className={cx('h-full flex flex-col', nonaktif && 'opacity-70')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-kartu font-bold text-ink leading-snug">
                      {pw.nama}
                      {nonaktif && (
                        <Lencana nada="netral" className="ml-2 align-middle">
                          Disembunyikan
                        </Lencana>
                      )}
                    </p>
                    <p className="mt-0.5 text-isi text-ink-3 leading-snug">
                      {[pw.keterangan, kalimatKelipatan(pw)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="text-kartu font-bold text-ink tabular shrink-0">
                    {rupiah(pw.hargaSatuan)}
                    <span className="block text-right text-kecil font-normal text-ink-3">per {pw.satuan}</span>
                  </p>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-isi text-ink-2 leading-snug">
                  <IkonKotak size={14} className="shrink-0 mt-0.5 text-ink-3" />
                  <span>
                    Stok {angka(pw.stokTersedia)} {pw.satuan} &middot; diperbarui {tanggalPendek(pw.stokDiperbaruiPada)}
                  </span>
                </p>
                <div className="mt-auto pt-1 flex flex-wrap gap-x-1">
                  <Tombol
                    ragam="sunyi"
                    ukuran="kecil"
                    ikonKiri={<IkonPena size={14} />}
                    onClick={() => setFormBarang({ penawaran: pw })}
                    aria-label={`Ubah ${pw.nama}`}
                  >
                    Ubah
                  </Tombol>
                  <Tombol
                    ragam="sunyi"
                    ukuran="kecil"
                    ikonKiri={nonaktif ? <IkonMata size={14} /> : <IkonMataTutup size={14} />}
                    onClick={() => aturAktifPenawaran(pw.id, nonaktif)}
                    aria-label={`${nonaktif ? 'Jual lagi' : 'Sembunyikan'} ${pw.nama}`}
                  >
                    {nonaktif ? 'Jual Lagi' : 'Sembunyikan'}
                  </Tombol>
                </div>
              </Kartu>
            </li>
          )
        })}
      </ul>

      {formBarang && (
        <FormBarang distributor={distributor} penawaran={formBarang.penawaran} tutup={() => setFormBarang(null)} />
      )}
    </div>
  )
}
