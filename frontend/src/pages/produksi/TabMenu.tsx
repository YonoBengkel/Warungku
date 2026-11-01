import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Kartu, Kerangka, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom, Sakelar } from '@/components/ui/formulir'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonNota } from '@/icons'
import { GalatApi } from '@/lib/api'
import { ambilMenuJual, simpanMenuJual, type MenuJual } from '@/lib/apiMenu'
import { angka, bacaAngkaIndonesia, jumlahSatuan, rupiah } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

const FORMULIR_KOSONG = { namaMenu: '', kategori: '', harga: '' }

/**
 * Menu kedai: nama, harga jual, dan komposisinya, dalam satu daftar (revisi V7,
 * Q164).
 *
 * Dulu ini dua tab terpisah di Akun, Data dari Kasir: "Menu & Harga" dan "Resep
 * Menu". Keduanya berbicara tentang menu yang sama, jadi memisahkannya memaksa
 * pemilik bolak-balik untuk menjawab satu pertanyaan. Sekarang satu kartu per
 * menu memuat keduanya, dan tempatnya tab Produksi, bukan terkubur di Akun.
 *
 * Harga tetap hanya diatur di sini: Portal POS membacanya, jadi kasir tidak bisa
 * mengubah harga. Harga baru berlaku untuk nota berikutnya, karena tiap baris
 * nota menyimpan harganya sendiri. Menu dimatikan, bukan dihapus, supaya namanya
 * tetap dikenali di nota lama.
 */
export function TabMenu() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const resepMenu = useAplikasi((s) => s.resepMenu)
  const barang = useAplikasi((s) => s.barang)
  const [menu, setMenu] = useState<MenuJual[] | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [form, setForm] = useState(FORMULIR_KOSONG)
  const [mengubah, setMengubah] = useState(false)
  const [galat, setGalat] = useState<{ nama?: string; harga?: string; umum?: string }>({})
  const [menyimpan, setMenyimpan] = useState(false)

  useEffect(() => {
    if (!sesi) return
    ambilMenuJual(sesi)
      .then(setMenu)
      .catch((e: unknown) => setGalatMuat(e instanceof GalatApi ? e.message : 'Menu belum bisa dimuat. Coba lagi sebentar lagi.'))
  }, [sesi])

  function pasangHasil(baru: MenuJual) {
    setMenu((m) => {
      const lain = (m ?? []).filter((x) => x.namaMenu !== baru.namaMenu)
      return [...lain, baru].sort((a, b) => (a.kategori ?? '~').localeCompare(b.kategori ?? '~', 'id') || a.namaMenu.localeCompare(b.namaMenu, 'id'))
    })
  }

  async function simpan() {
    if (!sesi) return
    const nama = form.namaMenu.trim()
    const harga = bacaAngkaIndonesia(form.harga)
    const salah = {
      nama: nama ? undefined : 'Nama menu belum diisi.',
      harga: Number.isInteger(harga) && harga > 0 ? undefined : 'Tulis harga dalam Rupiah bulat, misalnya 22.000.',
    }
    setGalat(salah)
    if (salah.nama || salah.harga) return
    setMenyimpan(true)
    try {
      const lama = menu?.find((m) => m.namaMenu.toLowerCase() === nama.toLowerCase())
      const baru = await simpanMenuJual(sesi, { namaMenu: nama, hargaJual: harga, kategori: form.kategori, aktif: lama?.aktif ?? true })
      pasangHasil(baru)
      setForm(FORMULIR_KOSONG)
      setMengubah(false)
      tampilkanRacun(`${baru.namaMenu} tersimpan dengan harga ${rupiah(baru.hargaJual)}.`, 'aman')
    } catch (e) {
      setGalat({ umum: e instanceof GalatApi ? e.message : 'Menu belum tersimpan. Coba lagi sebentar lagi.' })
    } finally {
      setMenyimpan(false)
    }
  }

  async function ubahAktif(m: MenuJual, aktif: boolean) {
    if (!sesi) return
    try {
      pasangHasil(await simpanMenuJual(sesi, { namaMenu: m.namaMenu, hargaJual: m.hargaJual, kategori: m.kategori ?? '', aktif }))
    } catch (e) {
      tampilkanRacun(e instanceof GalatApi ? e.message : 'Status menu belum tersimpan. Coba lagi sebentar lagi.', 'kritis')
    }
  }

  if (!sesi) {
    return (
      <KeadaanKosong
        ikon={<IkonNota size={26} />}
        judul="Menu butuh akun usaha"
        pesan="Saat ini aplikasi memakai data contoh. Masuk dengan email akun usahamu untuk mengatur menu Portal POS."
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start [&>*]:min-w-0">
      <Kartu>
        <h2 className="text-kartu font-bold text-ink">{mengubah ? `Ubah ${form.namaMenu}` : 'Tambah menu'}</h2>
        <p className="mt-0.5 mb-3 text-isi text-ink-3 leading-snug">Harga baru berlaku untuk nota berikutnya.</p>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void simpan()
          }}
        >
          {!mengubah && (
            <Kolom
              label="Nama menu"
              wajib
              value={form.namaMenu}
              galat={galat.nama}
              onChange={(e) => setForm({ ...form, namaMenu: e.target.value })}
            />
          )}
          <Kolom
            label="Kategori"
            bantuan="Misalnya Minuman atau Makanan."
            value={form.kategori}
            onChange={(e) => setForm({ ...form, kategori: e.target.value })}
          />
          <Kolom
            label="Harga jual"
            wajib
            inputMode="numeric"
            awalan="Rp"
            value={form.harga}
            galat={galat.harga}
            onChange={(e) => setForm({ ...form, harga: e.target.value })}
          />
          {galat.umum && (
            <p role="alert" className="text-isi font-semibold text-kritis-ink">
              {galat.umum}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <Tombol type="submit" memuat={menyimpan}>
              Simpan
            </Tombol>
            {mengubah && (
              <Tombol
                ragam="garis"
                onClick={() => {
                  setForm(FORMULIR_KOSONG)
                  setMengubah(false)
                  setGalat({})
                }}
              >
                Batal
              </Tombol>
            )}
          </div>
        </form>
        <Link
          to="/pos"
          target="_blank"
          className="mt-4 inline-flex items-center min-h-11 text-isi font-bold text-brand hover:underline underline-offset-2"
        >
          Buka Portal POS di tab baru
        </Link>
      </Kartu>

      <div>
        <h2 className="sr-only">Daftar menu Portal POS</h2>
        {galatMuat ? (
          <Peringatan nada="kritis" judul="Menu belum bisa dimuat">
            {galatMuat}
          </Peringatan>
        ) : menu === null ? (
          <div aria-busy="true" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Kerangka key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : menu.length === 0 ? (
          <KeadaanKosong ikon={<IkonNota size={26} />} judul="Belum ada menu" pesan="Tambahkan menu pertamamu supaya bisa dijual di Portal POS." />
        ) : (
          <ul className="space-y-2">
            {menu.map((m) => {
              // Resep dicocokkan dengan nama, sama seperti yang dilakukan kasir
              // saat nota masuk, supaya yang tampil di sini persis yang memotong
              // stok nanti.
              const resep = resepMenu.find((r) => r.namaMenu.toLowerCase() === m.namaMenu.toLowerCase() && !r.langsung)
              return (
                <li key={m.namaMenu} className="p-3.5 rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-kartu font-bold text-ink">{m.namaMenu}</p>
                      <p className="text-isi text-ink-2">
                        {m.kategori ?? 'Tanpa kategori'} &middot; {rupiah(m.hargaJual)}
                      </p>
                    </div>
                    <Sakelar aktif={m.aktif} ubah={(v) => void ubahAktif(m, v)} label="Dijual" />
                    <Tombol
                      ragam="garis"
                      ukuran="kecil"
                      aria-label={`Ubah harga ${m.namaMenu}`}
                      onClick={() => {
                        setForm({ namaMenu: m.namaMenu, kategori: m.kategori ?? '', harga: angka(m.hargaJual) })
                        setMengubah(true)
                        setGalat({})
                      }}
                    >
                      Ubah Harga
                    </Tombol>
                  </div>

                  {/* Komposisi: inilah yang memotong stok bahan tiap porsi terjual. */}
                  <div className="mt-2.5 pt-2.5 border-t border-line">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-kecil font-semibold text-ink-2">Komposisi per porsi</p>
                      {resep && (
                        <TombolTautan ke={`/akun/kasir/pasangkan/${encodeURIComponent(resep.id)}`} ragam="tautan" ukuran="kecil">
                          Ubah Komposisi
                        </TombolTautan>
                      )}
                    </div>
                    {!resep ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2.5">
                        <Lencana nada="menipis">Komposisi belum dipasangkan</Lencana>
                        <TombolTautan ke="/akun/kasir?tab=beres" ragam="garis" ukuran="kecil">
                          Pasangkan Sekarang
                        </TombolTautan>
                      </div>
                    ) : (
                      <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                        {resep.bahan.map((b) => {
                          const brg = barang.find((x) => x.id === b.barangId)
                          return (
                            <li key={b.barangId} className="flex items-baseline justify-between gap-3 text-isi">
                              <span className="min-w-0 text-ink-2">{brg?.nama ?? 'Bahan'}</span>
                              <span className="shrink-0 font-semibold text-ink tabular">
                                {brg ? jumlahSatuan(b.takaran, brg.satuan) : angka(b.takaran, 3)}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
