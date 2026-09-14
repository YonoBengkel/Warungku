import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KepalaHalaman, BilahAksi } from '@/components/ui/navigasi'
import { Kartu, Tombol, JudulBagian } from '@/components/ui/dasar'
import { PilihanKartu } from '@/components/ui/formulir'
import { Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentangLingkaran, IkonKotak, IkonToko } from '@/icons'
import { JUDUL, LABEL_CARA_HITUNG } from '@/lib/label'
import type { CaraHitungStok } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu pertanyaan, tiga jawaban, dan janji yang harus ditepati: jawaban ini
 * TIDAK mengunci apa pun.
 *
 * Layar ini menentukan bentuk bawaan formulir Tambah Barang saja. Karena itu
 * seluruh penjelasannya ditulis lewat contoh yang benar-benar terjadi di warung
 * (segelas kopi susu vs sebotol teh), bukan lewat istilah sistem. Pemilik usaha
 * tidak perlu tahu nama teknis dari perbedaan ini untuk memilih dengan benar.
 */

const CONTOH: Record<CaraHitungStok, { ikon: typeof IkonToko; contoh: string; bentukForm: string }> = {
  racikan: {
    ikon: IkonToko,
    contoh:
      'Satu gelas kopi susu terjual, yang berkurang adalah biji kopi dan susunya — bukan "kopi susu"-nya.',
    bentukForm:
      'Detail Barang menampilkan tab "Resep", tempat kamu menulis bahan dan takaran untuk satu porsi.',
  },
  kemasan: {
    ikon: IkonKotak,
    contoh: 'Satu botol teh terjual, stok botol teh berkurang satu. Selesai, tidak ada hitungan lain.',
    bentukForm: 'Detail Barang menyembunyikan tab "Resep", karena tidak ada bahan yang perlu dipotong.',
  },
  keduanya: {
    ikon: IkonToko,
    contoh:
      'Kopi susu memotong biji kopi dan susu, sementara botol teh di kulkas berkurang satu per satu. Dua-duanya jalan berdampingan.',
    bentukForm:
      'Detail Barang tetap menampilkan tab "Resep", dan kamu cukup mengisinya untuk barang yang memang diracik.',
  },
}

export default function JenisUsaha() {
  const navigate = useNavigate()
  const caraHitung = useAplikasi((s) => s.profil.caraHitung)
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [pilihan, setPilihan] = useState<CaraHitungStok>(caraHitung)
  const berubah = pilihan !== caraHitung

  function simpan() {
    ubahProfil({ caraHitung: pilihan })
    tampilkanRacun(`Tersimpan. Detail Barang sekarang mengikuti pilihan "${LABEL_CARA_HITUNG[pilihan].judul}".`, 'aman')
    navigate('/akun')
  }

  return (
    <div className="pb-6">
      <KepalaHalaman judul={JUDUL.caraHitung} kembaliKe="/akun" />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7">
          <section aria-labelledby="judul-pertanyaan">
            <h2 id="judul-pertanyaan" className="text-[1.25rem] font-extrabold text-ink tracking-tight leading-snug">
              Apa yang kamu jual?
            </h2>
            <p className="mt-1.5 text-[0.875rem] text-ink-2 leading-relaxed max-w-[52ch]">
              Jawabannya menentukan cara stok berkurang setiap kali ada penjualan. Pilih yang paling mirip dengan
              daganganmu sehari-hari.
            </p>

            <div className="mt-4 space-y-3">
              {(Object.keys(LABEL_CARA_HITUNG) as CaraHitungStok[]).map((kunci) => {
                const info = LABEL_CARA_HITUNG[kunci]
                const tambahan = CONTOH[kunci]
                const Ikon = tambahan.ikon
                return (
                  <PilihanKartu
                    key={kunci}
                    nilai={kunci}
                    terpilih={pilihan === kunci}
                    ubah={(v) => setPilihan(v as CaraHitungStok)}
                    judul={info.judul}
                    keterangan={info.bantuan}
                    anakan={
                      <span className="mt-2.5 block rounded-sm bg-sunken px-3 py-2.5">
                        <span className="flex items-start gap-2 text-[0.8125rem] text-ink-2 leading-relaxed">
                          <Ikon size={16} className="shrink-0 mt-0.5 text-ink-3" />
                          <span>{tambahan.contoh}</span>
                        </span>
                      </span>
                    }
                  />
                )
              })}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 mt-6 lg:mt-0 space-y-4">
          <Kartu>
            <JudulBagian
              judul="Yang berubah kalau kamu ganti pilihan"
              keterangan="Hanya satu hal, dan itu bisa dibatalkan kapan saja."
            />
            <p className="text-[0.875rem] text-ink-2 leading-relaxed">
              {CONTOH[pilihan].bentukForm} Itu saja. Jawaban ini tidak mengunci akunmu: daftar stok, perkiraan,
              pesanan, dan kontrak yang sudah berjalan tidak ikut berubah.
            </p>
            <ul className="mt-3 space-y-2 text-[0.8125rem] text-ink-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <IkonCentangLingkaran size={16} className="shrink-0 mt-0.5 text-aman" />
                Barang yang sudah terdaftar tetap seperti sekarang.
              </li>
              <li className="flex items-start gap-2">
                <IkonCentangLingkaran size={16} className="shrink-0 mt-0.5 text-aman" />
                Kamu boleh kembali ke sini dan mengganti jawabannya sesering yang kamu mau.
              </li>
              <li className="flex items-start gap-2">
                <IkonCentangLingkaran size={16} className="shrink-0 mt-0.5 text-aman" />
                Tiap barang tetap bisa diatur sendiri-sendiri, tidak harus ikut jawaban ini.
              </li>
            </ul>
          </Kartu>

          {/* Janji yang paling penting untuk ditulis hitam di atas putih: data
              yang sudah diisi tidak pernah hilang karena mengganti pilihan. */}
          <Peringatan nada="info" judul="Resep yang sudah kamu isi tidak dihapus">
            Kalau kamu pindah ke barang kemasan siap jual, resep yang sudah pernah kamu isi berhenti dipakai untuk
            mengurangi stok, tapi tetap tersimpan. Begitu kamu balik lagi ke racikan, resep itu langsung dipakai
            seperti semula, jadi tidak ada yang perlu kamu ketik ulang.
          </Peringatan>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          berubah ? (
            <p className="text-[0.8125rem] text-ink-3 text-center leading-snug">
              Pilihan sekarang: <strong className="text-ink">{LABEL_CARA_HITUNG[caraHitung].judul}</strong> &rarr;{' '}
              <strong className="text-ink">{LABEL_CARA_HITUNG[pilihan].judul}</strong>
            </p>
          ) : undefined
        }
      >
        <Tombol penuh ukuran="besar" disabled={!berubah} onClick={simpan}>
          {berubah ? 'Simpan Pilihan' : 'Belum ada yang diubah'}
        </Tombol>
      </BilahAksi>
    </div>
  )
}
