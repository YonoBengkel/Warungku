import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Kartu, Kerangka, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom, Sakelar } from '@/components/ui/formulir'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonNota, IkonTambah } from '@/icons'
import { GalatApi } from '@/lib/api'
import { ambilMenuJual, idMenu, simpanMenuJual, simpanResep, type MenuJual } from '@/lib/apiMenu'
import { angka, bacaAngkaIndonesia, jumlahSatuan, rupiah } from '@/lib/format'
import { resepSaranUntuk } from '@/lib/resepSaran'
import { useAplikasi } from '@/store/aplikasi'
import { barisKosong, IsianKomposisi, KartuKomposisi, periksaKomposisi, type BarisBahan } from './komposisi'

const FORMULIR_KOSONG = { namaMenu: '', kategori: '', harga: '', bahan: [barisKosong()] as BarisBahan[] }

/**
 * Menu kedai: nama, harga jual, dan komposisinya, dalam satu kartu per menu.
 *
 * Polanya sama dengan tab Menu Bu Ratmi (`TabMenuProduksi`, keputusan Ilham 4 Nov
 * 2026): satu formulir memuat harga sekaligus daftar bahan, sehingga menu baru
 * langsung punya komposisi tanpa menunggu nota pertamanya.
 *
 * Harga tetap hanya diatur di sini: Portal POS membacanya, jadi kasir tidak bisa
 * mengubah harga. Harga baru berlaku untuk nota berikutnya, karena tiap baris
 * nota menyimpan harganya sendiri. Menu dimatikan, bukan dihapus, supaya namanya
 * tetap dikenali di nota lama.
 *
 * `judul` diisi kalau tab ini tampil di bawah daftar produk, untuk usaha yang
 * punya tab Produksi lengkap tetapi juga berjualan lewat Portal POS.
 */
export function TabMenu({ judul }: { judul?: string }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const resepMenu = useAplikasi((s) => s.resepMenu)
  const barang = useAplikasi((s) => s.barang)
  const belumDipasangkan = useAplikasi((s) => s.kasir.menuBelumDipasangkan)
  const muatMenuKasir = useAplikasi((s) => s.muatMenuKasir)
  const segarkanGudang = useAplikasi((s) => s.segarkanGudangServer)
  const [menu, setMenu] = useState<MenuJual[] | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [form, setForm] = useState(FORMULIR_KOSONG)
  const [sunting, setSunting] = useState<MenuJual | 'baru' | null>(null)
  const [galat, setGalat] = useState<{ nama?: string; harga?: string; bahan?: string; umum?: string }>({})
  const [menyimpan, setMenyimpan] = useState(false)

  useEffect(() => {
    if (!sesi) return
    ambilMenuJual(sesi)
      .then(setMenu)
      .catch((e: unknown) => setGalatMuat(e instanceof GalatApi ? e.message : 'Menu belum bisa dimuat. Coba lagi sebentar lagi.'))
  }, [sesi])

  // Resep dicocokkan dengan nama, sama seperti yang dilakukan kasir saat nota masuk,
  // supaya yang tampil di sini persis yang memotong stok nanti.
  const resepUntuk = (nama: string) => resepMenu.find((r) => r.id === idMenu(nama) && !r.langsung)

  function pasangHasil(baru: MenuJual) {
    setMenu((m) => {
      const lain = (m ?? []).filter((x) => x.namaMenu !== baru.namaMenu)
      return [...lain, baru].sort((a, b) => (a.kategori ?? '~').localeCompare(b.kategori ?? '~', 'id') || a.namaMenu.localeCompare(b.namaMenu, 'id'))
    })
  }

  function bukaForm(m?: MenuJual) {
    const resep = m ? resepUntuk(m.namaMenu) : undefined
    setSunting(m ?? 'baru')
    setForm({
      namaMenu: m?.namaMenu ?? '',
      kategori: m?.kategori ?? '',
      harga: m ? angka(m.hargaJual) : '',
      bahan: resep ? resep.bahan.map((b) => ({ barangId: b.barangId, takaran: angka(b.takaran, 3) })) : [barisKosong()],
    })
    setGalat({})
  }

  function tutupForm() {
    setSunting(null)
    setForm(FORMULIR_KOSONG)
    setGalat({})
  }

  async function simpan() {
    if (!sesi) return
    const nama = form.namaMenu.trim()
    const harga = bacaAngkaIndonesia(form.harga)
    const bahanDiisi = form.bahan.filter((b) => b.barangId)
    const salah = {
      nama: nama ? undefined : 'Nama menu belum diisi.',
      harga: Number.isInteger(harga) && harga > 0 ? undefined : 'Tulis harga dalam Rupiah bulat, misalnya 22.000.',
      bahan:
        periksaKomposisi(bahanDiisi) ??
        (bahanDiisi.length === 0 && resepUntuk(nama)
          ? 'Komposisi yang sudah ada tidak bisa dikosongkan. Kalau menu ini tidak dijual lagi, matikan sakelar Dijual.'
          : undefined),
    }
    setGalat(salah)
    if (salah.nama || salah.harga || salah.bahan) return
    setMenyimpan(true)
    try {
      const lama = menu?.find((m) => m.namaMenu.toLowerCase() === nama.toLowerCase())
      const baru = await simpanMenuJual(sesi, { namaMenu: nama, hargaJual: harga, kategori: form.kategori, aktif: lama?.aktif ?? true })
      pasangHasil(baru)
      if (bahanDiisi.length > 0) {
        try {
          await simpanResep(sesi, baru.namaMenu, bahanDiisi.map((b) => ({ barangId: b.barangId, takaran: bacaAngkaIndonesia(b.takaran) })))
        } catch (e) {
          // Harganya sudah masuk. Formulir tetap terbuka supaya komposisinya bisa dicoba lagi.
          setSunting(baru)
          setGalat({ umum: `Harga ${baru.namaMenu} tersimpan, tetapi komposisinya belum. ${e instanceof GalatApi ? e.message : 'Coba lagi sebentar lagi.'}` })
          return
        }
        pasangHasil({ ...baru, punyaResep: true })
        // Bahan yang dipasangkan kini terhubung ke kasir, jadi daftar stok ikut dimuat ulang.
        await Promise.all([muatMenuKasir(), segarkanGudang().catch(() => undefined)])
      }
      tampilkanRacun(
        bahanDiisi.length > 0
          ? `${baru.namaMenu} tersimpan dengan ${bahanDiisi.length} bahan. Setiap porsi berikutnya memotong bahan itu.`
          : `${baru.namaMenu} tersimpan dengan harga ${rupiah(baru.hargaJual)}. Komposisinya belum diisi, jadi stok bahan belum terpotong.`,
        bahanDiisi.length > 0 ? 'aman' : 'menipis',
      )
      tutupForm()
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

  const saran = sunting ? resepSaranUntuk(form.namaMenu, barang) : null
  const menuNotaSaja = belumDipasangkan.filter((b) => !menu?.some((m) => idMenu(m.namaMenu) === b.id))

  return (
    <div className="space-y-4">
      {judul && (
        <div>
          <h2 className="text-kartu font-bold text-ink">{judul}</h2>
          <p className="mt-0.5 text-isi text-ink-3 leading-snug">Menu yang dijual lewat Portal POS. Tiap porsi memotong bahan sesuai komposisinya.</p>
        </div>
      )}

      {sunting ? (
        <Kartu>
          <h2 className="text-kartu font-bold text-ink">{sunting === 'baru' ? 'Tambah menu' : `Ubah ${form.namaMenu}`}</h2>
          <p className="mt-0.5 mb-3 text-isi text-ink-3 leading-snug">
            Harga baru berlaku untuk nota berikutnya. Komposisi di sini yang memotong bahan baku tiap porsi terjual.
          </p>
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void simpan()
            }}
          >
            {sunting === 'baru' && (
              <Kolom
                label="Nama menu"
                wajib
                value={form.namaMenu}
                galat={galat.nama}
                onChange={(e) => setForm({ ...form, namaMenu: e.target.value })}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
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
                bantuan="Per porsi."
                value={form.harga}
                galat={galat.harga}
                onChange={(e) => setForm({ ...form, harga: e.target.value })}
              />
            </div>

            <IsianKomposisi
              judul="Komposisi per porsi"
              bahan={form.bahan}
              galat={galat.bahan}
              ubah={(bahan) => setForm((f) => ({ ...f, bahan }))}
              aksi={
                saran && form.bahan.every((b) => !b.barangId) ? (
                  <Tombol
                    ragam="tautan"
                    ukuran="kecil"
                    onClick={() => setForm((f) => ({ ...f, bahan: saran.map((s) => ({ barangId: s.id, takaran: s.takaran })) }))}
                  >
                    Pakai resep saran
                  </Tombol>
                ) : undefined
              }
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
              <Tombol ragam="garis" onClick={tutupForm}>
                Batal
              </Tombol>
            </div>
          </form>
        </Kartu>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Tombol ikonKiri={<IkonTambah size={16} />} onClick={() => bukaForm()}>
            Tambah Menu
          </Tombol>
          <Link
            to="/pos"
            target="_blank"
            className="inline-flex items-center min-h-11 text-isi font-bold text-brand hover:underline underline-offset-2"
          >
            Buka Portal POS di tab baru
          </Link>
        </div>
      )}

      {menuNotaSaja.length > 0 && (
        <Peringatan nada="info" judul={`${angka(menuNotaSaja.length)} menu dari nota belum ada di daftar ini`}>
          {menuNotaSaja
            .slice(0, 3)
            .map((m) => m.namaMenu)
            .join(', ')}
          {menuNotaSaja.length > 3 ? ', dan lainnya' : ''}. Stok bahannya belum terpotong.
          <div className="mt-2">
            <TombolTautan ke="/akun/kasir?tab=beres" ragam="garis" ukuran="kecil">
              Pasangkan Sekarang
            </TombolTautan>
          </div>
        </Peringatan>
      )}

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
        <ul className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          {menu.map((m) => (
            <KartuKomposisi
              key={m.namaMenu}
              nama={m.namaMenu}
              keterangan={
                <>
                  {m.kategori ?? 'Tanpa kategori'} &middot;{' '}
                  <span className="whitespace-nowrap">{rupiah(m.hargaJual)}/porsi</span>
                </>
              }
              kanan={<Sakelar aktif={m.aktif} ubah={(v) => void ubahAktif(m, v)} label="Dijual" />}
              judulKomposisi="Komposisi per porsi"
              ubah={() => bukaForm(m)}
              bahan={(resepUntuk(m.namaMenu)?.bahan ?? []).map((b) => {
                const brg = barang.find((x) => x.id === b.barangId)
                return {
                  kunci: b.barangId,
                  nama: brg?.nama ?? 'Bahan',
                  jumlah: brg ? jumlahSatuan(b.takaran, brg.satuan) : angka(b.takaran, 3),
                }
              })}
              kosong={
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Lencana nada="menipis">Komposisi belum dipasangkan</Lencana>
                  <span className="text-isi text-ink-3">Nota menu ini masuk, tetapi stok bahannya belum terpotong.</span>
                </div>
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
