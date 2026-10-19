import { useState } from 'react'
import { KepalaHalaman, BilahAksi } from '@/components/ui/navigasi'
import { JudulBagian, Kartu, Lencana, Pemisah, Tombol } from '@/components/ui/dasar'
import { Sakelar } from '@/components/ui/formulir'
import { Peringatan } from '@/components/ui/umpanBalik'
import { IkonJam, IkonKeranjang, IkonKontrak, IkonLonceng, IkonPasokan, IkonPeringatan } from '@/icons'
import type { KategoriNotifikasi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pengaturan pengingat ditulis sebagai daftar konsekuensi, bukan daftar fitur.
 *
 * Sakelar yang hanya berbunyi "Stok menipis" memaksa pengguna menebak apa yang
 * hilang kalau dimatikan. Karena itu tiap sakelar membawa satu kalimat jujur
 * tentang apa yang berhenti dikerjakan aplikasi — termasuk saat itu merugikan
 * kami sendiri.
 *
 * Aturan anti-berisik ditaruh di layar ini, bukan disembunyikan di Bantuan,
 * supaya pengguna yang merasa terlalu sering diganggu tahu bahwa aplikasi sudah
 * menahan diri sebelum memutuskan mematikan semuanya.
 */

type KunciPengingat = Exclude<KategoriNotifikasi, 'sistem'>

const PENGINGAT: Array<{
  kunci: KunciPengingat
  judul: string
  ikon: typeof IkonLonceng
  isi: string
  matikan: string
}> = [
  {
    kunci: 'stok',
    judul: 'Stok menipis',
    ikon: IkonPeringatan,
    isi: 'Dikirim saat sisa stok menyentuh batas aman, dan saat sisanya tinggal untuk sehari.',
    matikan: 'Kamu baru tahu barang habis saat membuka halaman Stok sendiri; angkanya tetap dihitung.',
  },
  {
    kunci: 'saran-belanja',
    judul: 'Saran belanja',
    ikon: IkonKeranjang,
    isi: 'Satu kiriman per hari berisi semua barang yang perlu dibeli, bukan satu pesan per barang.',
    matikan: 'Daftar saran tetap disusun di Beranda, tapi kamu harus ingat sendiri untuk mengeceknya.',
  },
  {
    kunci: 'pesanan',
    judul: 'Status pesanan',
    ikon: IkonPasokan,
    isi: 'Dikirim saat distributor menerima pesanan, saat barang dikirim, dan saat kiriman sudah sampai.',
    matikan: 'Kiriman yang datang bisa terlewat; stok baru bertambah setelah kamu tekan Barang Sudah Sampai.',
  },
  {
    kunci: 'kontrak',
    judul: 'Kontrak',
    ikon: IkonKontrak,
    isi: 'Dikirim saat kuota bulan ini masih kurang menjelang akhir periode, dan saat masa kontrak mau habis.',
    matikan: 'Akhir periode kuota dan berakhirnya kontrak bisa terlewat tanpa kamu sadari.',
  },
]

/** Jam kiriman saran belanja dipatok, bukan disetel. Lihat kartu penjelasannya di layar. */
const JAM_SARAN = '07.00'

const AKTIF_AWAL: Record<KunciPengingat, boolean> = {
  stok: true,
  'saran-belanja': true,
  pesanan: true,
  kontrak: true,
}

/** "stok menipis dan kontrak" / "stok menipis, saran belanja, dan kontrak". */
function gabungNama(daftar: string[]): string {
  if (daftar.length <= 1) return daftar[0] ?? ''
  if (daftar.length === 2) return `${daftar[0]} dan ${daftar[1]}`
  return `${daftar.slice(0, -1).join(', ')}, dan ${daftar[daftar.length - 1]}`
}

export default function PengaturanPengingat() {
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [aktif, setAktif] = useState<Record<KunciPengingat, boolean>>(AKTIF_AWAL)
  const [dalamAplikasi, setDalamAplikasi] = useState(true)

  /* Patokan "sudah tersimpan" ikut bergerak setiap kali disimpan. Tanpa ini
     tombolnya tetap menyala setelah ditekan, seolah simpanannya tidak masuk. */
  const [tersimpan, setTersimpan] = useState<{ aktif: Record<KunciPengingat, boolean>; dalamAplikasi: boolean }>({
    aktif: AKTIF_AWAL,
    dalamAplikasi: true,
  })

  const jumlahMati = Object.values(aktif).filter((v) => !v).length
  const berubah =
    dalamAplikasi !== tersimpan.dalamAplikasi ||
    (Object.keys(AKTIF_AWAL) as KunciPengingat[]).some((k) => aktif[k] !== tersimpan.aktif[k])

  function simpan() {
    setTersimpan({ aktif, dalamAplikasi })

    if (!dalamAplikasi) {
      tampilkanRacun(
        'Tersimpan. Lonceng di aplikasi dimatikan, jadi tidak ada pengingat yang sampai ke kamu.',
        'menipis',
      )
      return
    }

    const mati = PENGINGAT.filter((p) => !aktif[p.kunci]).map((p) => p.judul.toLowerCase())
    if (mati.length === 0) {
      tampilkanRacun(
        `Tersimpan. Semua pengingat hidup, saran belanja tetap datang tiap hari pukul ${JAM_SARAN} WIB.`,
        'aman',
      )
      return
    }
    tampilkanRacun(
      mati.length === PENGINGAT.length
        ? 'Tersimpan. Keempat pengingat dimatikan, jadi aplikasi tidak akan mengetuk pundakmu lagi.'
        : `Tersimpan. Pengingat ${gabungNama(mati)} dimatikan, sisanya tetap jalan.`,
      'menipis',
    )
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Pengaturan Pengingat"
        keterangan="Pilih yang perlu kamu dengar, matikan yang mengganggu"
        kembaliKe="/akun"
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-6">
          <section aria-label="Jenis pengingat">
            <JudulBagian
              judul="Jenis pengingat"
              keterangan="Tiap baris menjelaskan apa yang berhenti dikerjakan aplikasi kalau kamu matikan."
              className="mb-3"
            />
            <div className="space-y-3">
              {PENGINGAT.map((p) => {
                const Ikon = p.ikon
                const hidup = aktif[p.kunci]
                return (
                  <Kartu key={p.kunci} padat>
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 size-9 rounded-md grid place-items-center bg-sunken text-ink-2">
                        <Ikon size={18} />
                      </span>
                      <div className="min-w-0 grow">
                        <Sakelar
                          aktif={hidup}
                          ubah={(v) =>
                            setAktif((s) => {
                              const baru: Record<KunciPengingat, boolean> = { ...s }
                              baru[p.kunci] = v
                              return baru
                            })
                          }
                          label={p.judul}
                          keterangan={p.isi}
                        />
                        {!hidup && (
                          <p className="mt-1 sm:ml-14 text-isi text-menipis-ink bg-menipis-soft rounded-sm px-3 py-2 leading-relaxed">
                            {p.matikan}
                          </p>
                        )}
                      </div>
                    </div>
                  </Kartu>
                )
              })}
            </div>
          </section>

          {/* Jam kiriman sengaja tidak bisa disetel: satu jam tetap lebih mudah
              dipercaya daripada setelan yang tidak pernah disentuh siapa pun. */}
          <section aria-label="Kapan pengingat dikirim">
            <JudulBagian
              judul="Kapan pengingat dikirim"
              keterangan="Satu kiriman per hari, berisi seluruh barang yang perlu dibeli."
              className="mb-3"
            />
            <Kartu>
              <div className="flex items-start gap-3">
                <span className="shrink-0 size-9 rounded-md grid place-items-center bg-brand-soft text-brand-soft-ink">
                  <IkonJam size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-kartu font-semibold text-ink leading-snug">
                    Saran belanja datang sekali sehari, pukul {JAM_SARAN} WIB
                  </p>
                  <p className="mt-1 text-isi text-ink-2 leading-relaxed">
                    Jamnya dipatok supaya kamu tahu kapan harus mengecek.
                  </p>
                  {!aktif['saran-belanja'] && (
                    <p className="mt-2 text-isi text-menipis-ink bg-menipis-soft rounded-sm px-3 py-2 leading-relaxed">
                      Pengingat ini sedang mati; daftar sarannya tetap bisa dibuka dari Beranda.
                    </p>
                  )}
                </div>
              </div>

              <Pemisah className="my-4" />

              <p className="flex items-start gap-2 text-isi text-ink-2 leading-relaxed">
                <IkonPeringatan size={16} className="shrink-0 mt-0.5 text-ink-3" />
                Stok yang tinggal untuk sehari diperingatkan seketika, tanpa menunggu jam ini.
              </p>
            </Kartu>
          </section>

          <section aria-label="Lewat mana pengingatnya sampai">
            <JudulBagian judul="Lewat mana pengingatnya sampai" className="mb-3" />
            <Kartu>
              <Sakelar
                aktif={dalamAplikasi}
                ubah={setDalamAplikasi}
                label="Di dalam aplikasi"
                keterangan="Muncul di lonceng dan di daftar Perlu Diurus pada Beranda."
              />
              <Pemisah className="my-3" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 grow opacity-60">
                  <Sakelar
                    aktif={false}
                    ubah={() => undefined}
                    label="WhatsApp"
                    keterangan="Dikirim ke nomor HP yang terdaftar di profil usahamu."
                    nonaktif
                  />
                </div>
                <Lencana nada="netral" className="mt-3 shrink-0">
                  Segera hadir
                </Lencana>
              </div>
              {!dalamAplikasi && (
                <Peringatan nada="menipis" className="mt-3">
                  Tidak ada pengingat yang sampai; daftar Perlu Diurus di Beranda harus kamu buka sendiri.
                </Peringatan>
              )}
            </Kartu>
          </section>
        </div>

        {/* Aturan anti-berisik: dipasang berdampingan dengan sakelarnya supaya
            keputusan "matikan saja semua" diambil dengan informasi lengkap. */}
        <div className="lg:col-span-5 mt-6 lg:mt-0">
          <Kartu>
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 size-9 rounded-md grid place-items-center bg-brand-soft text-brand-soft-ink">
                <IkonLonceng size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-kartu font-bold text-ink leading-tight">
                  Kami sudah menahan diri lebih dulu
                </h2>
                <p className="mt-0.5 text-isi text-ink-3 leading-snug">
                  Tiga aturan ini berjalan otomatis, tanpa perlu kamu atur.
                </p>
              </div>
            </div>

            <ol className="mt-3.5 space-y-3.5">
              <li className="flex items-start gap-3">
                <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-isi font-bold grid place-items-center tabular">
                  1
                </span>
                <p className="text-isi text-ink-2 leading-relaxed">
                  <strong className="text-ink">Satu barang cuma punya satu pemberitahuan aktif.</strong> Isinya
                  diperbarui, misalnya "sisa 2 hari" jadi "sisa 1 hari".
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-isi font-bold grid place-items-center tabular">
                  2
                </span>
                <p className="text-isi text-ink-2 leading-relaxed">
                  <strong className="text-ink">Barang yang sudah kamu pesan langsung dibisukan</strong> sampai
                  pesanannya selesai atau dibatalkan.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-isi font-bold grid place-items-center tabular">
                  3
                </span>
                <p className="text-isi text-ink-2 leading-relaxed">
                  <strong className="text-ink">Semua barang yang perlu dibeli digabung jadi satu kiriman</strong>{' '}
                  pukul {JAM_SARAN}, lengkap dengan tombol "Ingatkan nanti".
                </p>
              </li>
            </ol>

            <Pemisah className="my-4" />

            <p className="text-isi text-ink-3 leading-relaxed">
              Angka merah di lonceng hanya menghitung yang butuh tindakanmu, bukan kabar biasa.
            </p>
          </Kartu>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          berubah ? (
            <p className="text-isi text-ink-3 text-center leading-snug">
              {jumlahMati === 0
                ? 'Semua jenis pengingat tetap hidup'
                : `${jumlahMati} dari ${PENGINGAT.length} jenis pengingat akan dimatikan`}
              {!dalamAplikasi && ' · lonceng di aplikasi akan dimatikan juga'}
            </p>
          ) : undefined
        }
      >
        <Tombol penuh ukuran="besar" disabled={!berubah} onClick={simpan}>
          {berubah ? 'Simpan Pengaturan' : 'Belum ada yang diubah'}
        </Tombol>
      </BilahAksi>
    </div>
  )
}
