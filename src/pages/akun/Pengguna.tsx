import { useState } from 'react'
import { KepalaHalaman } from '@/components/ui/navigasi'
import {
  Avatar,
  JudulBagian,
  Kartu,
  Lencana,
  Pemisah,
  Tombol,
  TombolTautan,
  type NadaLencana,
} from '@/components/ui/dasar'
import { PilihanKartu } from '@/components/ui/formulir'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { Konfirmasi, Lembar } from '@/components/ui/lembar'
import { IkonCentang, IkonProfil, IkonSampah, IkonSilang, IkonTambah } from '@/icons'
import { nomorHp as formatHp } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Hak akses ditulis sebagai kalimat "boleh" dan "tidak boleh", bukan matriks izin.
 *
 * Pemilik warung memilih peran berdasarkan siapa orangnya dan apa yang dia
 * kerjakan tiap hari, bukan berdasarkan nama teknis sebuah izin. Karena itu tiap
 * peran menyebut pekerjaan nyata: mencatat pemakaian, menerima kiriman,
 * membuat pesanan, mengikat kontrak.
 *
 * Satu aturan yang dikunci: peran yang bisa mengikat usaha ke pihak ketiga
 * (pesanan dan kontrak) selalu disebut eksplisit, karena itulah risiko yang
 * sebenarnya diserahkan saat menambah pengguna.
 */

type Peran = 'pemilik' | 'manajer' | 'kasir'
/** Peran yang bisa diberikan ke orang lain. Pemilik tidak termasuk: ia melekat pada akun usaha. */
type PeranDiberikan = Exclude<Peran, 'pemilik'>

const PERAN: Record<Peran, { nama: string; nada: NadaLencana; ringkas: string }> = {
  pemilik: {
    nama: 'Pemilik',
    nada: 'merek',
    ringkas: 'Bisa semuanya, termasuk mengatur pengguna dan langganan.',
  },
  manajer: {
    nama: 'Manajer',
    nada: 'info',
    ringkas: 'Bisa belanja dan mengikat kontrak atas nama usahamu.',
  },
  kasir: {
    nama: 'Kasir',
    nada: 'netral',
    ringkas: 'Bisa mengurus stok harian, tidak bisa mengeluarkan uang.',
  },
}

/* Dua peran, dua daftar pekerjaan nyata. Sengaja bukan matriks izin: pemilik
   warung memilih berdasarkan apa yang orangnya kerjakan tiap hari. */
const HAK: Record<PeranDiberikan, { boleh: string[]; tidakBoleh: string[] }> = {
  kasir: {
    boleh: [
      'Melihat daftar stok dan sisa tiap barang',
      'Mencatat pemakaian dan mengoreksi stok',
      'Melakukan hitung stok',
      'Menekan Barang Sudah Sampai saat kiriman datang',
    ],
    tidakBoleh: [
      'Tidak boleh membuat pesanan ke distributor',
      'Tidak boleh mengikat kontrak',
      'Tidak boleh mengubah pengaturan usaha',
    ],
  },
  manajer: {
    boleh: [
      'Semua yang bisa dilakukan Kasir',
      'Membuat pesanan ke distributor',
      'Mengajukan dan menghentikan kontrak',
      'Mengubah batas aman dan pengaturan pengingat',
    ],
    tidakBoleh: ['Tidak boleh menambah atau menghapus pengguna', 'Tidak boleh mengubah langganan'],
  },
}

interface PenggunaUsaha {
  id: string
  nama: string
  nomorHp: string
  peran: Peran
  sejak: string
}

/* Data contoh khusus layar ini: pengelolaan pengguna belum punya tempat di
   penyimpanan bersama, dan menambahkannya akan menyentuh berkas milik orang lain. */
const PENGGUNA_AWAL: PenggunaUsaha[] = [
  { id: 'pg-01', nama: 'Bagas Prasetyo', nomorHp: '081338827410', peran: 'pemilik', sejak: 'Februari 2026' },
  { id: 'pg-02', nama: 'Sinta Rahmawati', nomorHp: '082114560932', peran: 'kasir', sejak: 'Mei 2026' },
]

export default function Pengguna() {
  const namaPemilik = useAplikasi((s) => s.profil.namaPemilik)
  const warnaUsaha = useAplikasi((s) => s.profil.warna)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [daftar, setDaftar] = useState<PenggunaUsaha[]>(PENGGUNA_AWAL)
  const [ubahPeranUntuk, setUbahPeranUntuk] = useState<PenggunaUsaha | null>(null)
  const [peranBaru, setPeranBaru] = useState<PeranDiberikan>('kasir')
  const [hapusUntuk, setHapusUntuk] = useState<PenggunaUsaha | null>(null)

  const lain = daftar.filter((p) => p.peran !== 'pemilik')

  function bukaUbahPeran(p: PenggunaUsaha) {
    setPeranBaru(p.peran === 'pemilik' ? 'kasir' : p.peran)
    setUbahPeranUntuk(p)
  }

  function simpanPeran() {
    if (!ubahPeranUntuk) return
    const orang = ubahPeranUntuk
    setDaftar((s) => s.map((p) => (p.id === orang.id ? { ...p, peran: peranBaru } : p)))
    setUbahPeranUntuk(null)
    tampilkanRacun(
      `Tersimpan. ${orang.nama.split(' ')[0]} sekarang berperan sebagai ${PERAN[peranBaru].nama}.`,
      'aman',
    )
  }

  function hapus() {
    if (!hapusUntuk) return
    const orang = hapusUntuk
    setDaftar((s) => s.filter((p) => p.id !== orang.id))
    tampilkanRacun(`${orang.nama} tidak lagi punya akses ke usahamu.`, 'menipis')
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Pengguna & Hak Akses"
        keterangan={`${daftar.length} orang punya akses`}
        kembaliKe="/akun"
        aksi={
          <TombolTautan ke="/akun/pengguna/undang" ukuran="kecil" ikonKiri={<IkonTambah size={15} />}>
            Tambah
          </TombolTautan>
        }
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-6">
          <section aria-label="Orang yang bisa masuk">
            <JudulBagian
              judul="Orang yang bisa masuk"
              keterangan="Tiap orang masuk dengan nomor HP-nya sendiri, bukan memakai akunmu."
              className="mb-3"
            />

            <div className="space-y-3">
              {daftar.map((p) => {
                const info = PERAN[p.peran]
                const pemilik = p.peran === 'pemilik'
                return (
                  <Kartu key={p.id} padat className="min-h-[88px]">
                    <div className="flex items-start gap-3">
                      <Avatar
                        nama={p.nama}
                        warna={pemilik ? warnaUsaha : undefined}
                        ukuran={44}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 grow">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[1rem] font-semibold text-ink leading-snug truncate">
                            {pemilik ? namaPemilik : p.nama}
                          </p>
                          <Lencana nada={info.nada} className="shrink-0 mt-0.5">
                            {info.nama}
                          </Lencana>
                        </div>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-3 tabular">{formatHp(p.nomorHp)}</p>
                        <p className="mt-1 text-[0.8125rem] text-ink-2 leading-snug">{info.ringkas}</p>
                        <p className="mt-1 text-[0.75rem] text-ink-3">Punya akses sejak {p.sejak}</p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {pemilik ? (
                            <p className="text-[0.8125rem] text-ink-3">
                              Peran pemilik tidak bisa diubah atau dihapus dari sini.
                            </p>
                          ) : (
                            <>
                              <Tombol ragam="garis" ukuran="kecil" onClick={() => bukaUbahPeran(p)}>
                                Ubah Peran
                              </Tombol>
                              <Tombol
                                ragam="sunyi"
                                ukuran="kecil"
                                ikonKiri={<IkonSampah size={15} />}
                                onClick={() => setHapusUntuk(p)}
                                className="!text-kritis"
                              >
                                Hapus
                              </Tombol>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Kartu>
                )
              })}
            </div>

            {lain.length === 0 && (
              <Kartu className="mt-3">
                <KeadaanKosong
                  padat
                  ikon={<IkonProfil size={26} />}
                  judul="Baru kamu sendiri yang punya akses"
                  pesan="Kalau ada yang membantu jaga warung, tambahkan dia supaya koreksi stok dan penerimaan barang tidak menumpuk menunggu kamu."
                  aksi={
                    <TombolTautan ke="/akun/pengguna/undang" ikonKiri={<IkonTambah size={16} />}>
                      Tambah Pengguna
                    </TombolTautan>
                  }
                />
              </Kartu>
            )}

            {/* Hanya muncul kalau daftar sudah berisi orang lain: saat kosong,
                ajakan yang sama sudah berdiri di dalam KeadaanKosong di atas. */}
            {lain.length > 0 && (
              <div className="mt-3 hidden sm:block">
                <TombolTautan
                  ke="/akun/pengguna/undang"
                  ragam="garis"
                  penuh
                  ikonKiri={<IkonTambah size={16} />}
                >
                  Tambah Pengguna
                </TombolTautan>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5 mt-6 lg:mt-0">
          <section aria-label="Apa arti tiap peran">
            <JudulBagian
              judul="Apa arti tiap peran"
              keterangan="Ditulis sebagai pekerjaan sehari-hari, bukan daftar izin."
              className="mb-3"
            />
            <div className="space-y-3">
              {(['kasir', 'manajer'] as PeranDiberikan[]).map((kunci) => {
                const info = HAK[kunci]
                return (
                  <Kartu key={kunci} padat>
                    <div className="flex items-center gap-2">
                      <Lencana nada={PERAN[kunci].nada} besar>
                        {PERAN[kunci].nama}
                      </Lencana>
                      <span className="text-[0.8125rem] text-ink-3 truncate">
                        {daftar.filter((p) => p.peran === kunci).length} orang
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {info.boleh.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-[0.8125rem] text-ink-2 leading-snug">
                          <IkonCentang size={15} className="shrink-0 mt-0.5 text-aman" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Pemisah className="my-2.5" />
                    <ul className="space-y-1.5">
                      {info.tidakBoleh.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-snug">
                          <IkonSilang size={15} className="shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </Kartu>
                )
              })}
            </div>

            <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
              Peran <strong className="text-ink-2">Pemilik</strong> tidak ada di daftar ini karena ia melekat pada
              akun usaha dan tidak bisa diberikan ke orang lain. Pemilik bisa melakukan semua pekerjaan Manajer,
              ditambah menambah atau menghapus pengguna dan mengubah langganan.
            </p>
          </section>
        </div>
      </div>

      {/* Mengubah peran bisa menambah kewenangan mengikat kontrak, jadi pilihannya
          diberi ruang penuh dengan ringkasan hak akses, bukan menu tarik-turun. */}
      <Lembar
        terbuka={ubahPeranUntuk !== null}
        tutup={() => setUbahPeranUntuk(null)}
        judul={ubahPeranUntuk ? `Peran untuk ${ubahPeranUntuk.nama.split(' ')[0]}` : 'Ubah peran'}
        keterangan="Berlaku begitu disimpan, tanpa perlu dia masuk ulang."
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={() => setUbahPeranUntuk(null)}>
              Batal
            </Tombol>
            <Tombol penuh onClick={simpanPeran} disabled={peranBaru === ubahPeranUntuk?.peran}>
              Simpan Peran
            </Tombol>
          </div>
        }
      >
        <div className="space-y-3 pb-4">
          {(['kasir', 'manajer'] as PeranDiberikan[]).map((kunci) => (
            <PilihanKartu
              key={kunci}
              nilai={kunci}
              terpilih={peranBaru === kunci}
              ubah={(v) => setPeranBaru(v as PeranDiberikan)}
              judul={PERAN[kunci].nama}
              keterangan={PERAN[kunci].ringkas}
              anakan={
                <span className="mt-2 block text-[0.8125rem] text-ink-3 leading-relaxed">
                  {HAK[kunci].tidakBoleh[0]}.
                </span>
              }
            />
          ))}
        </div>
      </Lembar>

      <Konfirmasi
        terbuka={hapusUntuk !== null}
        tutup={() => setHapusUntuk(null)}
        judul="Hapus akses pengguna ini?"
        pesan={
          hapusUntuk ? (
            <>
              <strong className="text-ink">{hapusUntuk.nama}</strong> tidak bisa lagi masuk ke usahamu mulai sekarang.
              Catatan koreksi stok dan penerimaan barang yang pernah dia buat tetap tersimpan lengkap dengan namanya,
              jadi riwayatmu tidak berlubang.
            </>
          ) : (
            ''
          )
        }
        labelSetuju="Ya, hapus akses"
        ragamSetuju="bahaya"
        onSetuju={hapus}
      />
    </div>
  )
}
