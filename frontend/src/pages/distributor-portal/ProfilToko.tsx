import { useState } from 'react'
import { BarisData, JudulBagian, Kartu, Lencana, Tombol } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { IkonPena } from '@/icons'
import { angka, nomorHp, rupiah } from '@/lib/format'
import { koordinatSah } from '@/lib/lacak'
import { useDistributorAktif } from '@/store/aplikasi'
import { FormInfoUsaha, FormLayanan, FormLokasiGudang } from './formProfil'

/**
 * Profil Toko, halaman bawahan Akun distributor (revisi V4, Q94): info usaha
 * (termasuk deskripsi), kategori dan area kirim, serta lokasi gudang. Semuanya
 * dibaca pemilik usaha, dan masing-masing diubah lewat formulirnya sendiri.
 */
export default function ProfilToko() {
  const distributor = useDistributorAktif()
  const [formLayanan, setFormLayanan] = useState(false)
  const [formInfo, setFormInfo] = useState(false)
  const [formLokasi, setFormLokasi] = useState(false)

  const tombolUbah = (buka: () => void) => (
    <Tombol ragam="sunyi" ukuran="kecil" ikonKiri={<IkonPena size={14} />} onClick={buka}>
      Ubah
    </Tombol>
  )

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Profil Toko" keterangan={distributor.nama} kembaliKe="/distributor-portal/profil" />

      <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start space-y-6 lg:space-y-0">
        {/* Info usaha: deskripsi dan kontak yang dilihat pemilik usaha */}
        <section aria-labelledby="judul-info">
          <JudulBagian id="judul-info" judul="Info usaha" aksi={tombolUbah(() => setFormInfo(true))} />
          <Kartu>
            <p className="text-isi text-ink-2 leading-relaxed">{distributor.deskripsi}</p>
            {distributor.info ? (
              <dl className="mt-3 pt-3 border-t border-line">
                <BarisData label="Alamat gudang" nilai={distributor.info.alamatGudang} />
                <BarisData label="Nomor HP" nilai={nomorHp(distributor.info.nomorHp)} />
                <BarisData label="Jam operasional" nilai={distributor.info.jamOperasional} />
                <BarisData
                  label="Minimum pesanan"
                  nilai={distributor.info.minimumPesanan > 0 ? rupiah(distributor.info.minimumPesanan) : 'Tanpa minimum'}
                />
              </dl>
            ) : (
              <p className="mt-3 pt-3 border-t border-line text-isi text-ink-2 leading-relaxed">
                Belum diisi. Lengkapi alamat gudang, kontak, dan jam operasional supaya pemilik usaha tahu kapan
                pesanannya bisa diproses.
              </p>
            )}
          </Kartu>
        </section>

        <div className="space-y-6">
          {/* Yang dilayani: dipakai rekomendasi distributor di sisi pemilik usaha */}
          <section aria-labelledby="judul-layanan">
            <JudulBagian id="judul-layanan" judul="Yang kamu layani" aksi={tombolUbah(() => setFormLayanan(true))} />
            <Kartu>
              <h3 className="text-isi font-bold text-ink-2">Kategori barang</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {distributor.kategori.map((k) => (
                  <Lencana key={k} nada="merek" besar>
                    {k}
                  </Lencana>
                ))}
              </div>

              <h3 className="mt-4 text-isi font-bold text-ink-2">Area kirim</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {distributor.areaKirim.map((a) => (
                  <Lencana key={a} nada="netral" besar>
                    {a}
                  </Lencana>
                ))}
              </div>
            </Kartu>
          </section>

          {/* Lokasi gudang: titik di peta rincian pesanan (revisi 23 Okt, V3) */}
          <section aria-labelledby="judul-lokasi">
            <JudulBagian
              id="judul-lokasi"
              judul="Lokasi gudang"
              keterangan="Pemilik usaha yang memesan darimu melihat titik ini di peta rincian pesanannya."
              aksi={tombolUbah(() => setFormLokasi(true))}
            />
            <Kartu>
              {koordinatSah(distributor.lat, distributor.lng) ? (
                <p className="text-isi text-ink-2">
                  Titik dipilih di peta:{' '}
                  <span className="tabular font-semibold text-ink">
                    lintang {angka(distributor.lat, 5)} &middot; bujur {angka(distributor.lng as number, 5)}
                  </span>
                </p>
              ) : (
                <p className="text-isi text-ink-2 leading-relaxed">
                  Belum diisi. Peta memakai titik tengah {distributor.kota} sampai kamu memilih titik gudangmu.
                </p>
              )}
            </Kartu>
          </section>
        </div>
      </div>

      {formLayanan && <FormLayanan distributor={distributor} tutup={() => setFormLayanan(false)} />}
      {formInfo && <FormInfoUsaha distributor={distributor} tutup={() => setFormInfo(false)} />}
      {formLokasi && <FormLokasiGudang distributor={distributor} tutup={() => setFormLokasi(false)} />}
    </div>
  )
}
