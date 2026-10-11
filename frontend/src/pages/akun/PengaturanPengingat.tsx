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
    matikan:
      'Kalau dimatikan, kamu baru tahu barang habis ketika membuka halaman Stok sendiri. Angka stoknya tetap dihitung, cuma tidak ada yang mengetuk pundakmu.',
  },
  {
    kunci: 'saran-belanja',
    judul: 'Saran belanja',
    ikon: IkonKeranjang,
    isi: 'Satu kiriman per hari berisi semua barang yang perlu dibeli, bukan satu pesan per barang.',
    matikan:
      'Kalau dimatikan, daftar sarannya tetap disusun dan tetap bisa dibuka dari Beranda. Yang hilang hanya pengingatnya, jadi kamu perlu ingat sendiri untuk mengeceknya.',
  },
  {
    kunci: 'pesanan',
    judul: 'Status pesanan',
    ikon: IkonPasokan,
    isi: 'Dikirim saat distributor menerima pesanan, saat barang dikirim, dan saat kiriman sudah sampai.',
    matikan:
      'Kalau dimatikan, kamu bisa melewatkan kiriman yang sudah datang. Stok baru bertambah setelah kamu menekan Barang Sudah Sampai, jadi angka stok bisa tertinggal berhari-hari tanpa kamu sadari.',
  },
  {
    kunci: 'kontrak',
    judul: 'Kontrak',
    ikon: IkonKontrak,
    isi: 'Dikirim saat kuota bulan ini masih kurang menjelang akhir periode, dan saat masa kontrak mau habis.',
    matikan:
      'Kalau dimatikan, kamu bisa melewatkan akhir periode kuota dan tanggal berakhirnya kontrak. Aplikasi tidak bisa mengejar keduanya untukmu — ketentuannya ada di kontrak, bukan di sini.',
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
                          <p className="mt-1 sm:ml-14 text-[0.8125rem] text-menipis-ink bg-menipis-soft rounded-sm px-3 py-2 leading-relaxed">
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
                  <p className="text-[0.9375rem] font-semibold text-ink leading-snug">
                    Saran belanja datang sekali sehari, pukul {JAM_SARAN} WIB
                  </p>
                  <p className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed">
                    Jamnya dipatok, tidak bisa diubah. Satu jam tetap membuat kamu tahu kapan harus mengeceknya,
                    sementara barangnya sendiri dikumpulkan jadi satu kiriman &mdash; bukan satu pesan per barang.
                  </p>
                  {!aktif['saran-belanja'] && (
                    <p className="mt-2 text-[0.8125rem] text-menipis-ink bg-menipis-soft rounded-sm px-3 py-2 leading-relaxed">
                      Pengingat saran belanja sedang kamu matikan, jadi kiriman pukul {JAM_SARAN} ini tidak berjalan.
                      Daftarnya tetap disusun dan bisa dibuka sendiri dari Beranda.
                    </p>
                  )}
                </div>
              </div>

              <Pemisah className="my-4" />

              <p className="flex items-start gap-2 text-[0.8125rem] text-ink-2 leading-relaxed">
                <IkonPeringatan size={16} className="shrink-0 mt-0.5 text-ink-3" />
                Peringatan stok yang sisanya tinggal untuk sehari tidak menunggu jam ini. Yang itu dikirim seketika,
                karena menundanya sampai besok pagi sudah terlambat.
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
                  Dengan kedua saluran mati, tidak ada pengingat yang sampai ke kamu sama sekali. Daftar Perlu Diurus
                  di Beranda tetap terisi, tapi kamu harus membukanya sendiri.
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
                <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">
                  Kami sudah menahan diri lebih dulu
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
                  Tiga aturan ini berjalan otomatis, tanpa perlu kamu atur.
                </p>
              </div>
            </div>

            <ol className="mt-3.5 space-y-3.5">
              <li className="flex items-start gap-3">
                <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-[0.8125rem] font-bold grid place-items-center tabular">
                  1
                </span>
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  <strong className="text-ink">Satu barang cuma punya satu pemberitahuan aktif.</strong> Kalau
                  keadaannya memburuk, isi pemberitahuan yang lama diperbarui dari "sisa 2 hari" jadi "sisa 1 hari" —
                  tidak lahir baris baru yang menumpuk.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-[0.8125rem] font-bold grid place-items-center tabular">
                  2
                </span>
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  <strong className="text-ink">Barang yang sudah kamu pesan langsung dibisukan.</strong> Ia berhenti
                  mengingatkan sampai pesanannya selesai atau dibatalkan, karena kamu sudah mengerjakan bagianmu.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-[0.8125rem] font-bold grid place-items-center tabular">
                  3
                </span>
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  <strong className="text-ink">Semua barang yang perlu dibeli digabung jadi satu kiriman.</strong>{' '}
                  Sepuluh barang menipis tetap jadi satu pemberitahuan pukul {JAM_SARAN}, dan di dalamnya ada tombol
                  "Ingatkan nanti" kalau hari ini kamu memang belum sempat belanja.
                </p>
              </li>
            </ol>

            <Pemisah className="my-4" />

            <p className="text-[0.8125rem] text-ink-3 leading-relaxed">
              Angka merah di lonceng hanya menghitung yang benar-benar butuh tindakan darimu. Kabar yang sekadar
              memberi tahu tidak ikut dihitung supaya angkanya tetap punya arti.
            </p>
          </Kartu>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          berubah ? (
            <p className="text-[0.8125rem] text-ink-3 text-center leading-snug">
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
