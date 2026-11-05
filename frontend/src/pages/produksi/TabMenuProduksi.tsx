import { useState } from 'react'
import { ChipStok } from '@/components/domain'
import { Kartu, Kerangka, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonPanci, IkonTambah } from '@/icons'
import { GalatApi } from '@/lib/api'
import { angka, bacaAngkaIndonesia, jumlahSatuan, rupiah } from '@/lib/format'
import type { ProdukJadi, RingkasanProduksi } from '@/lib/apiProduksi'
import { simpanProdukJadi } from '@/lib/apiProduksi'
import { useAplikasi } from '@/store/aplikasi'
import { barisKosong, IsianKomposisi, KartuKomposisi, periksaKomposisi } from './komposisi'

function formulirDari(p?: ProdukJadi) {
  return {
    nama: p?.nama ?? '',
    satuan: p?.satuan ?? '',
    isiBersih: p?.isiBersih ?? '',
    harga: p ? String(p.hargaJual) : '',
    bahan: p && p.resep.length > 0 ? p.resep.map((b) => ({ barangId: b.barangId, takaran: angka(b.takaran, 3) })) : [barisKosong()],
  }
}

/**
 * Tab Menu untuk usaha dengan tab Produksi lengkap: produk jadi beserta
 * komposisinya, dalam satu formulir (revisi V7, Q164 dan Q165).
 *
 * Sebelum ini Bu Ratmi tidak bisa menambah apa pun: produk dan resepnya hanya
 * datang dari data demo. Sejak 4 Nov 2026 tab ini menjadi pola bagi `TabMenu`
 * milik kedai, lewat komponen bersama di `komposisi.tsx`.
 */
export function TabMenuProduksi({
  ringkasan,
  gagal,
  sesudahSimpan,
}: {
  ringkasan: RingkasanProduksi | undefined
  gagal: boolean
  sesudahSimpan: () => void
}) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [sunting, setSunting] = useState<ProdukJadi | 'baru' | null>(null)
  const [form, setForm] = useState(formulirDari())
  const [galat, setGalat] = useState<{ nama?: string; satuan?: string; harga?: string; bahan?: string; umum?: string }>({})
  const [menyimpan, setMenyimpan] = useState(false)

  function bukaForm(p?: ProdukJadi) {
    setSunting(p ?? 'baru')
    setForm(formulirDari(p))
    setGalat({})
  }

  function tutupForm() {
    setSunting(null)
  }

  async function simpan() {
    if (!sesi) return
    const nama = form.nama.trim()
    const satuan = form.satuan.trim()
    const harga = bacaAngkaIndonesia(form.harga)
    const bahanDiisi = form.bahan.filter((b) => b.barangId)
    const salah = {
      nama: nama ? undefined : 'Nama produk belum diisi.',
      satuan: satuan ? undefined : 'Satuan jual belum diisi, misalnya toples atau pouch.',
      harga: Number.isInteger(harga) && harga >= 0 ? undefined : 'Tulis harga dalam Rupiah bulat.',
      bahan: periksaKomposisi(bahanDiisi),
    }
    setGalat(salah)
    if (salah.nama || salah.satuan || salah.harga || salah.bahan) return
    setMenyimpan(true)
    try {
      const hasil = await simpanProdukJadi(sesi, {
        nama,
        satuan,
        isiBersih: form.isiBersih.trim() || null,
        hargaJual: harga,
        bahan: bahanDiisi.map((b) => ({ barangId: b.barangId, takaran: bacaAngkaIndonesia(b.takaran) })),
      })
      tampilkanRacun(`${hasil.nama} tersimpan dengan ${bahanDiisi.length} bahan.`, 'aman')
      tutupForm()
      sesudahSimpan()
    } catch (e) {
      setGalat({ umum: e instanceof GalatApi ? e.message : 'Produk belum tersimpan. Coba lagi sebentar lagi.' })
    } finally {
      setMenyimpan(false)
    }
  }

  if (!sesi) {
    return (
      <KeadaanKosong
        ikon={<IkonPanci size={26} />}
        judul="Menu butuh akun usaha"
        pesan="Saat ini aplikasi memakai data contoh. Masuk dengan akun produsenmu untuk mengatur produk."
      />
    )
  }

  if (gagal) {
    return (
      <Peringatan nada="menipis" judul="Daftar produk belum bisa dibuka">
        Coba muat ulang sebentar lagi.
      </Peringatan>
    )
  }

  if (!ringkasan) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <Kerangka key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sunting ? (
        <Kartu>
          <h2 className="text-kartu font-bold text-ink">{sunting === 'baru' ? 'Tambah produk' : `Ubah ${form.nama}`}</h2>
          <p className="mt-0.5 mb-3 text-isi text-ink-3 leading-snug">
            Komposisi di sini yang memotong bahan baku tiap sesi masak.
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
              <Kolom label="Nama produk" wajib value={form.nama} galat={galat.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Kolom
                label="Satuan jual"
                wajib
                bantuan="Misalnya toples, pouch, atau botol."
                value={form.satuan}
                galat={galat.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
              />
              <Kolom
                label="Isi bersih"
                bantuan="Misalnya 200 g. Boleh dikosongkan."
                value={form.isiBersih}
                onChange={(e) => setForm({ ...form, isiBersih: e.target.value })}
              />
            </div>
            <Kolom
              label="Harga jual"
              wajib
              inputMode="numeric"
              awalan="Rp"
              bantuan="Per satuan, ke pembeli usaha."
              value={form.harga}
              galat={galat.harga}
              onChange={(e) => setForm({ ...form, harga: e.target.value })}
            />

            <IsianKomposisi
              judul={`Komposisi per ${form.satuan || 'satuan'}`}
              bahan={form.bahan}
              galat={galat.bahan}
              ubah={(bahan) => setForm((f) => ({ ...f, bahan }))}
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
        <Tombol ikonKiri={<IkonTambah size={16} />} onClick={() => bukaForm()}>
          Tambah Produk
        </Tombol>
      )}

      {ringkasan.produk.length === 0 ? (
        <KeadaanKosong ikon={<IkonPanci size={26} />} judul="Belum ada produk" pesan="Tambahkan produk pertamamu beserta komposisinya." />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          {ringkasan.produk.map((p) => (
            <KartuKomposisi
              key={p.id}
              nama={p.nama}
              keterangan={
                <>
                  {p.isiBersih ? `${p.isiBersih} · ` : ''}
                  <span className="whitespace-nowrap">
                    {rupiah(p.hargaJual)}/{p.satuan}
                  </span>
                </>
              }
              kanan={<ChipStok status={p.stok <= 0 ? 'habis' : p.stok < p.batasAman ? 'menipis' : 'aman'} />}
              judulKomposisi={`Komposisi per ${p.satuan}`}
              ubah={() => bukaForm(p)}
              bahan={p.resep.map((b) => ({ kunci: b.barangId, nama: b.nama, jumlah: jumlahSatuan(b.takaran, b.satuan) }))}
              kosong={<p className="mt-1 text-isi text-ink-3">Komposisi belum diisi, jadi produk ini belum bisa dimasak.</p>}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
