import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tombol, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { Kolom, Pilihan } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonPena, IkonSaring, IkonSampah, IkonTambah } from '@/icons'
import { angka } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Kelola Kategori.
 *
 * Kategori di aplikasi ini adalah PENYARING, bukan folder. Barang tidak pernah
 * "berada di dalam" kategori: ia cuma punya satu label yang membantu menyaring
 * daftar Stok. Karena itu menghapus kategori tidak pernah menghapus barang, dan
 * kategori yang masih dipakai tidak bisa dihapus begitu saja — barangnya akan
 * kehilangan label dan menghilang dari semua penyaringan, padahal wujud
 * fisiknya masih ada di rak.
 *
 * Jalan keluarnya selalu "Gabungkan ke ...", bukan "Hapus paksa".
 */

type ModeLembar = 'tambah' | 'ubah' | 'gabung' | 'tolak-hapus' | 'hapus-kosong'

interface Baris {
  nama: string
  jumlah: number
}

export default function KelolaKategori() {
  const barang = useAplikasi((s) => s.barang)
  const ubahBarang = useAplikasi((s) => s.ubahBarang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  /* Kategori tidak punya tabel sendiri: ia hidup di dalam barang. Kategori baru
     yang belum punya barang karena itu hanya bertahan selama halaman terbuka,
     dan itu dinyatakan apa adanya di layar, bukan disembunyikan. */
  const [kategoriKosong, setKategoriKosong] = useState<string[]>([])

  const [mode, setMode] = useState<ModeLembar | null>(null)
  const [target, setTarget] = useState<string>('')
  const [teks, setTeks] = useState('')
  const [tujuan, setTujuan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  const daftar: Baris[] = useMemo(() => {
    const hitung = new Map<string, number>()
    for (const k of kategoriKosong) hitung.set(k, 0)
    for (const b of barang) hitung.set(b.kategori, (hitung.get(b.kategori) ?? 0) + 1)
    return Array.from(hitung, ([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) =>
      a.nama.localeCompare(b.nama, 'id'),
    )
  }, [barang, kategoriKosong])

  const jumlahTarget = daftar.find((d) => d.nama === target)?.jumlah ?? 0
  const kategoriLain = daftar.filter((d) => d.nama !== target)

  function tutup() {
    setMode(null)
    setGalat(null)
    setTeks('')
  }

  function buka(m: ModeLembar, nama = '') {
    setMode(m)
    setTarget(nama)
    setTeks(m === 'ubah' ? nama : '')
    setTujuan(daftar.find((d) => d.nama !== nama)?.nama ?? '')
    setGalat(null)
  }

  /** Satu pemeriksaan untuk Tambah dan Ubah nama, pesannya bertiga unsur. */
  function periksaNama(nama: string, kecuali?: string): string | null {
    const bersih = nama.trim()
    if (bersih === '') return 'Nama kategori belum diisi. Tulis nama yang gampang kamu kenali. Contoh: Kopi & Teh.'
    if (bersih.length < 3)
      return 'Nama kategori terlalu pendek, minimal 3 huruf. Tambahkan hurufnya. Contoh: Kopi & Teh.'
    if (daftar.some((d) => d.nama.toLowerCase() === bersih.toLowerCase() && d.nama !== kecuali))
      return `Kategori "${bersih}" sudah ada. Pakai nama lain, atau gabungkan kategori lama ke sana. Contoh: Kopi & Teh Dingin.`
    return null
  }

  function simpanTambah() {
    const pesan = periksaNama(teks)
    if (pesan) {
      setGalat(pesan)
      return
    }
    const bersih = teks.trim()
    setKategoriKosong((lama) => [...lama, bersih])
    tampilkanRacun(`Kategori ${bersih} dibuat. Pilih kategori ini saat menambah barang.`, 'aman')
    tutup()
  }

  function simpanUbah() {
    const pesan = periksaNama(teks, target)
    if (pesan) {
      setGalat(pesan)
      return
    }
    const bersih = teks.trim()
    for (const b of barang) if (b.kategori === target) ubahBarang(b.id, { kategori: bersih })
    setKategoriKosong((lama) => lama.map((k) => (k === target ? bersih : k)))
    tampilkanRacun(`Kategori ${target} sekarang bernama ${bersih}.`, 'aman')
    tutup()
  }

  function simpanGabung() {
    if (!tujuan) {
      setGalat('Pilih dulu kategori tujuannya. Kategori yang kamu pilih akan menampung semua barang di sini.')
      return
    }
    const dipindah = barang.filter((b) => b.kategori === target).length
    for (const b of barang) if (b.kategori === target) ubahBarang(b.id, { kategori: tujuan })
    setKategoriKosong((lama) => lama.filter((k) => k !== target))
    tampilkanRacun(
      dipindah > 0
        ? `${angka(dipindah)} barang pindah ke kategori ${tujuan}.`
        : `Kategori ${target} digabungkan ke ${tujuan}.`,
      'aman',
    )
    tutup()
  }

  function hapusKosong() {
    setKategoriKosong((lama) => lama.filter((k) => k !== target))
    tampilkanRacun(`Kategori ${target} dihapus. Tidak ada barang yang terpengaruh.`, 'aman')
    tutup()
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Kelola Kategori"
        keterangan={`${angka(daftar.length)} kategori untuk ${angka(barang.length)} barang`}
        kembaliKe="/stok"
        aksi={
          <TombolIkon label="Tambah kategori" ragam="sekunder" onClick={() => buka('tambah')}>
            <IkonTambah size={20} />
          </TombolIkon>
        }
      />

      {/* Daftar kategori tidak butuh baris selebar layar, jadi ruang sisa di
          desktop diisi penjelasan dan tombol tambah yang di HP hanya berupa
          ikon di kepala halaman. */}
      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 max-w-2xl">
        <h2 className="sr-only">Daftar kategori</h2>

        {daftar.length === 0 ? (
          <KeadaanKosong
            ikon={<IkonSaring size={26} />}
            judul="Belum ada kategori"
            pesan="Kategori muncul sendiri begitu kamu memberi label pada barang. Kamu juga bisa menyiapkan namanya lebih dulu di sini."
            aksi={<Tombol onClick={() => buka('tambah')}>Tambah Kategori</Tombol>}
            aksiKedua={
              <TombolTautan ke="/stok/baru" ragam="garis">
                Tambah Barang
              </TombolTautan>
            }
          />
        ) : (
          <ul className="mt-4 space-y-2.5">
            {daftar.map((k) => (
              <li
                key={k.nama}
                className="bg-surface border border-line rounded-lg p-4 min-h-[72px] flex flex-wrap items-center gap-x-3 gap-y-2.5"
              >
                <div className="min-w-0 grow">
                  <p className="text-[1rem] font-semibold text-ink leading-snug">{k.nama}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                    {k.jumlah === 0 ? (
                      <>Belum ada barang &mdash; kategori ini tersimpan setelah dipakai satu barang</>
                    ) : (
                      <Link
                        to={`/stok?kategori=${encodeURIComponent(k.nama)}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {angka(k.jumlah)} barang
                      </Link>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Tanpa kategori kedua, menggabungkan tidak punya tujuan —
                      jadi tombolnya tidak ditampilkan, bukan ditampilkan mati. */}
                  {daftar.length > 1 && (
                    <Tombol ragam="garis" onClick={() => buka('gabung', k.nama)}>
                      Gabungkan
                    </Tombol>
                  )}
                  <TombolIkon label={`Ubah nama kategori ${k.nama}`} onClick={() => buka('ubah', k.nama)}>
                    <IkonPena size={18} />
                  </TombolIkon>
                  <TombolIkon
                    label={`Hapus kategori ${k.nama}`}
                    onClick={() => buka(k.jumlah > 0 ? 'tolak-hapus' : 'hapus-kosong', k.nama)}
                  >
                    <IkonSampah size={18} />
                  </TombolIkon>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>

        <div className="lg:col-span-5 mt-6 lg:mt-0 space-y-3">
          <Peringatan nada="netral" judul="Kategori itu penyaring, bukan folder">
            Barang tidak disimpan di dalam kategori. Kategori cuma label yang memudahkan kamu
            menyaring daftar Stok. Mengganti nama atau menggabungkan kategori tidak pernah mengubah
            jumlah stok maupun riwayat barangnya.
          </Peringatan>

          {/* Di HP tombol tambah cukup berupa ikon di kepala halaman; di desktop
              ruangnya ada, jadi ditulis lengkap supaya tidak perlu ditebak. */}
          {daftar.length > 0 && (
            <div className="hidden lg:block">
              <Tombol ikonKiri={<IkonTambah size={17} />} onClick={() => buka('tambah')}>
                Tambah Kategori
              </Tombol>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Tambah & ubah nama ---------------- */}
      <Lembar
        terbuka={mode === 'tambah' || mode === 'ubah'}
        tutup={tutup}
        judul={mode === 'ubah' ? 'Ubah nama kategori' : 'Tambah kategori'}
        keterangan={
          mode === 'ubah'
            ? 'Semua barang berlabel kategori ini ikut berganti nama labelnya.'
            : 'Nama kategori sebaiknya memakai istilah yang biasa kamu ucapkan di warung.'
        }
        lebar="sempit"
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={tutup}>
              Batal
            </Tombol>
            <Tombol penuh onClick={mode === 'ubah' ? simpanUbah : simpanTambah}>
              {mode === 'ubah' ? 'Ganti Nama' : 'Tambah Kategori'}
            </Tombol>
          </div>
        }
      >
        <div className="pb-4">
          <Kolom
            data-fokus-awal
            label="Nama kategori"
            wajib
            value={teks}
            galat={galat ?? undefined}
            bantuan="Contoh: Kopi & Teh, Kemasan, Bahan Makanan."
            onChange={(e) => {
              setTeks(e.target.value)
              setGalat(null)
            }}
          />
        </div>
      </Lembar>

      {/* ---------------- Gabungkan ---------------- */}
      <Lembar
        terbuka={mode === 'gabung'}
        tutup={tutup}
        judul={`Gabungkan ${target}`}
        keterangan="Semua barang berlabel kategori ini akan pindah label. Jumlah stok dan riwayatnya tidak berubah."
        lebar="sempit"
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={tutup}>
              Batal
            </Tombol>
            {kategoriLain.length === 0 ? (
              <Tombol penuh onClick={() => buka('tambah')}>
                Tambah Kategori
              </Tombol>
            ) : (
              <Tombol penuh onClick={simpanGabung}>
                Gabungkan
              </Tombol>
            )}
          </div>
        }
      >
        <div className="pb-4">
          {kategoriLain.length === 0 ? (
            <p className="text-[0.9375rem] text-ink-2 leading-relaxed">
              Ini satu-satunya kategori yang kamu punya, jadi belum ada tujuan untuk menggabungkannya.
              Buat dulu kategori lain, lalu gabungkan yang ini ke sana.
            </p>
          ) : (
            <>
              <Pilihan
                label="Gabungkan ke"
                wajib
                value={tujuan}
                galat={galat ?? undefined}
                onChange={(e) => {
                  setTujuan(e.target.value)
                  setGalat(null)
                }}
              >
                {kategoriLain.map((k) => (
                  <option key={k.nama} value={k.nama}>
                    {k.nama} ({angka(k.jumlah)} barang)
                  </option>
                ))}
              </Pilihan>
              <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
                {jumlahTarget === 0
                  ? `Kategori ${target} belum berisi barang, jadi tidak ada yang dipindahkan. Namanya saja yang hilang dari daftar penyaring.`
                  : `${angka(jumlahTarget)} barang akan berpindah label ke ${tujuan || 'kategori tujuan'}.`}
              </p>
            </>
          )}
        </div>
      </Lembar>

      {/* ---------------- Hapus ditolak karena masih berisi ---------------- */}
      <Lembar
        terbuka={mode === 'tolak-hapus'}
        tutup={tutup}
        judul={`${target} masih dipakai ${angka(jumlahTarget)} barang`}
        lebar="sempit"
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={tutup}>
              Nanti saja
            </Tombol>
            <Tombol penuh onClick={() => buka('gabung', target)}>
              Gabungkan ke kategori lain
            </Tombol>
          </div>
        }
      >
        <div className="pb-4 text-[0.9375rem] text-ink-2 leading-relaxed space-y-3">
          <p>
            Kategori yang masih dipakai tidak bisa dihapus. Kalau labelnya hilang, {angka(jumlahTarget)}{' '}
            barang itu tidak akan muncul lagi di penyaring mana pun, padahal barangnya tetap ada di rak
            dan tetap perlu dibeli ulang.
          </p>
          <p>
            Yang biasanya kamu maksud adalah memindahkannya: gabungkan kategori ini ke kategori lain,
            lalu namanya hilang sendiri dari daftar.
          </p>
        </div>
      </Lembar>

      {/* ---------------- Hapus kategori kosong ---------------- */}
      <Lembar
        terbuka={mode === 'hapus-kosong'}
        tutup={tutup}
        judul={`Hapus kategori ${target}?`}
        lebar="sempit"
        kunciLatar
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={tutup}>
              Batal
            </Tombol>
            <Tombol ragam="bahaya" penuh data-fokus-awal onClick={hapusKosong}>
              Ya, hapus
            </Tombol>
          </div>
        }
      >
        <p className="pb-4 text-[0.9375rem] text-ink-2 leading-relaxed">
          Kategori ini belum dipakai barang mana pun, jadi menghapusnya tidak mengubah stok apa pun.
          Kamu bisa membuatnya lagi kapan saja.
        </p>
      </Lembar>
    </div>
  )
}
