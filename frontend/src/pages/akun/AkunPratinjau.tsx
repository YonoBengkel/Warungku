import type { ReactNode } from 'react'
import { Avatar, Kartu, Lencana, Pemisah, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { Penjelasan, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonLokasi,
  IkonMataTutup,
  IkonPena,
  IkonTelepon,
  IkonToko,
} from '@/icons'
import { nomorHp, tanggalPanjang } from '@/lib/format'
import { LABEL_JENIS_USAHA } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu-satunya cara melihat akibat dari sakelar privasi.
 *
 * Keputusan penting di layar ini: data yang disembunyikan tetap muncul sebagai
 * baris abu bertuliskan "Disembunyikan", bukan dihilangkan. Kalau barisnya
 * hilang, pengguna tidak pernah tahu apa yang sedang ia sembunyikan, dan
 * sakelar privasi berubah jadi tebakan.
 */
export default function AkunPratinjau() {
  const profil = useAplikasi((s) => s.profil)

  const lencanaVerifikasi =
    profil.verifikasi === 'terverifikasi' ? (
      <Lencana nada="aman" besar>
        {profil.tingkatVerifikasi === 'penuh' ? 'Terverifikasi' : 'Terverifikasi Dasar'}
      </Lencana>
    ) : (
      <Lencana nada="netral" besar>
        Belum terverifikasi
      </Lencana>
    )

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Lihat sebagai Distributor" kembaliKe="/akun/profil" />

      {/* Di layar lebar kartu pratinjau dan penjelasannya berdiri berdampingan:
          keduanya perlu dibaca bersamaan, dan menumpuknya membuat alasan privasi
          jatuh di bawah lipatan justru saat pengguna sedang menimbangnya. */}
      <div className="mt-4 max-w-2xl lg:max-w-5xl lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div>
          <Peringatan nada="info" judul="Ini hanya pratinjau">
            Begini kartumu terlihat oleh distributor yang belum pernah menerima pesananmu.
          </Peringatan>

          {/* Kartu usaha, dirender persis seperti sisi distributor */}
          <div className="mt-4 rounded-lg border-2 border-dashed border-line-strong p-2.5 bg-surface-2">
            <p className="text-kecil font-semibold uppercase tracking-wide text-ink-3 px-1 pb-2">
              Tampilan di aplikasi distributor
            </p>
            <Kartu>
              <div className="flex items-start gap-3.5">
                <Avatar nama={profil.namaUsaha} warna={profil.warna} ukuran={64} className="rounded-lg" />
                <div className="min-w-0 grow">
                  <h2 className="text-subjudul font-extrabold text-ink leading-tight">{profil.namaUsaha}</h2>
                  <p className="mt-0.5 text-isi text-ink-2">{LABEL_JENIS_USAHA[profil.jenisUsaha].judul}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-isi text-ink-3">
                    <IkonLokasi size={14} className="shrink-0" />
                    {profil.kota}
                  </p>
                  <div className="mt-2">{lencanaVerifikasi}</div>
                </div>
              </div>
  
              {profil.bio && (
                <p className="mt-3.5 text-isi text-ink-2 leading-relaxed whitespace-pre-line">{profil.bio}</p>
              )}
  
              <p className="mt-2.5 text-kecil text-ink-3">
                Pembeli di Turnify Flow sejak {tanggalPanjang(profil.bergabungSejak)}
              </p>
  
              <Pemisah className="my-4" />
  
              <h3 className="text-isi font-bold text-ink-2 uppercase tracking-wide">Kontak &amp; pengiriman</h3>
              <div className="mt-2 space-y-2">
                <BarisPratinjau
                  ikon={<IkonLokasi size={17} />}
                  label="Alamat lengkap"
                  nilai={profil.alamat}
                  terlihat={profil.tampilkanAlamatKeDistributor}
                  alasanTertutup="Terbuka otomatis untuk distributor begitu kamu membuat pesanan ke mereka."
                />
                <BarisPratinjau
                  ikon={<IkonTelepon size={17} />}
                  label="Nomor HP"
                  nilai={nomorHp(profil.nomorHp)}
                  terlihat={profil.tampilkanNomorHpKeDistributor}
                  alasanTertutup="Kurir tetap bisa menghubungimu saat mengantar pesanan."
                />
                <BarisPratinjau ikon={<IkonToko size={17} />} label="Kota / kabupaten" nilai={profil.kota} terlihat />
              </div>
            </Kartu>
          </div>
        </div>

        <div className="mt-5 lg:mt-0 rounded-md bg-sunken p-4">
          <h2 className="text-kartu font-bold text-ink">Kenapa ada yang disembunyikan?</h2>
          <p className="mt-1 text-isi text-ink-2 leading-relaxed max-w-[70ch]">
            Alamat dan nomor HP paling sering dipakai untuk menawarkan barang tanpa kamu minta.
          </p>
          <Penjelasan label="Lalu barangnya diantar ke mana?" className="max-w-[70ch]">
            Bawaannya tertutup sampai kamu sendiri yang memulai transaksi. Begitu pesanan dibuat, distributor yang
            bersangkutan langsung melihat alamat dan nomor HP-mu.
          </Penjelasan>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <TombolTautan ke="/akun/profil" ragam="garis" ukuran="kecil" ikonKiri={<IkonPena size={15} />}>
              Ubah yang terlihat
            </TombolTautan>
            <TombolTautan ke="/akun" ragam="sunyi" ukuran="kecil">
              Kembali ke Akun
            </TombolTautan>
          </div>
        </div>
      </div>
    </div>
  )
}

function BarisPratinjau({
  ikon,
  label,
  nilai,
  terlihat,
  alasanTertutup,
}: {
  ikon: ReactNode
  label: string
  nilai: string
  terlihat: boolean
  alasanTertutup?: string
}) {
  return (
    <div className="flex items-start gap-2.5 min-h-11">
      <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
        {terlihat ? ikon : <IkonMataTutup size={17} />}
      </span>
      <div className="min-w-0 grow">
        <p className="text-kecil text-ink-3">{label}</p>
        {terlihat ? (
          <p className="text-isi font-semibold text-ink leading-snug">{nilai}</p>
        ) : (
          <>
            <p className="text-isi font-semibold text-ink-3 leading-snug">Disembunyikan</p>
            {alasanTertutup && (
              <p className="mt-0.5 text-kecil text-ink-3 leading-snug">{alasanTertutup}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
