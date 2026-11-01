import { useState } from 'react'
import { ChipStok } from '@/components/domain'
import { Avatar, Kartu, Kerangka, Tombol } from '@/components/ui/dasar'
import { Kolom, Pilihan } from '@/components/ui/formulir'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonPanci, IkonSilang, IkonTambah } from '@/icons'
import { GalatApi } from '@/lib/api'
import { bacaAngkaIndonesia, jumlahSatuan, rupiah } from '@/lib/format'
import type { ProdukJadi, RingkasanProduksi } from '@/lib/apiProduksi'
import { simpanProdukJadi } from '@/lib/apiProduksi'
import { useAplikasi } from '@/store/aplikasi'

type BarisBahan = { barangId: string; takaran: string }

function barisKosong(): BarisBahan {
  return { barangId: '', takaran: '' }
}

function formulirDari(p?: ProdukJadi) {
  return {
    nama: p?.nama ?? '',
    satuan: p?.satuan ?? '',
    isiBersih: p?.isiBersih ?? '',
    harga: p ? String(p.hargaJual) : '',
    bahan: p && p.resep.length > 0 ? p.resep.map((b) => ({ barangId: b.barangId, takaran: String(b.takaran) })) : [barisKosong()],
  }
}

/**
 * Tab Menu untuk UMKM produsen: produk jadi beserta komposisinya, dalam satu
 * formulir (revisi V7, Q164 dan Q165).
 *
 * Sebelum ini Bu Ratmi tidak bisa menambah apa pun: produk dan resepnya hanya
 * datang dari data demo. Formatnya sengaja disamakan dengan `TabMenu` milik
 * kedai, kartu per menu dengan harga dan komposisi di satu tempat, supaya
 * kedua jenis usaha terasa satu pola.
 *
 * Bedanya dari kedai: komposisi di sini punya beberapa baris bahan sekaligus
 * (satu produk jadi bisa memakai banyak bahan baku), jadi formulirnya adalah
 * daftar baris "bahan + takaran" yang bisa ditambah dan dibuang, bukan tombol
 * tunggal "Ubah Komposisi" yang membuka layar lain.
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
  const barang = useAplikasi((s) => s.barang)
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

  function ubahBaris(i: number, patch: Partial<BarisBahan>) {
    setForm((f) => ({ ...f, bahan: f.bahan.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  }

  async function simpan() {
    if (!sesi) return
    const nama = form.nama.trim()
    const satuan = form.satuan.trim()
    const harga = bacaAngkaIndonesia(form.harga)
    const bahanDiisi = form.bahan.filter((b) => b.barangId)
    const idUnik = new Set(bahanDiisi.map((b) => b.barangId))
    const salah = {
      nama: nama ? undefined : 'Nama produk belum diisi.',
      satuan: satuan ? undefined : 'Satuan jual belum diisi, misalnya toples atau pouch.',
      harga: Number.isInteger(harga) && harga >= 0 ? undefined : 'Tulis harga dalam Rupiah bulat.',
      bahan:
        bahanDiisi.some((b) => !(bacaAngkaIndonesia(b.takaran) > 0))
          ? 'Setiap bahan butuh takaran lebih dari 0.'
          : idUnik.size !== bahanDiisi.length
            ? 'Ada bahan yang dipilih dua kali. Gabungkan takarannya ke satu baris.'
            : undefined,
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

            <div>
              <p className="text-isi font-semibold text-ink mb-1.5">Komposisi per {form.satuan || 'satuan'}</p>
              <div className="space-y-2">
                {form.bahan.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Pilihan
                      className="grow"
                      value={b.barangId}
                      onChange={(e) => ubahBaris(i, { barangId: e.target.value })}
                    >
                      <option value="">Pilih bahan&hellip;</option>
                      {barang
                        .filter((x) => !x.dicatatManual)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nama}
                          </option>
                        ))}
                    </Pilihan>
                    <Kolom
                      className="w-32 shrink-0"
                      aria-label={`Takaran bahan baris ${i + 1}`}
                      placeholder="Takaran"
                      inputMode="decimal"
                      value={b.takaran}
                      onChange={(e) => ubahBaris(i, { takaran: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label="Buang baris bahan ini"
                      onClick={() => setForm((f) => ({ ...f, bahan: f.bahan.length > 1 ? f.bahan.filter((_, j) => j !== i) : [barisKosong()] }))}
                      className="shrink-0 mt-1 size-9 grid place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-kritis-ink"
                    >
                      <IkonSilang size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {galat.bahan && (
                <p role="alert" className="mt-1.5 text-kecil font-semibold text-kritis-ink">
                  {galat.bahan}
                </p>
              )}
              <Tombol
                ragam="garis"
                ukuran="kecil"
                className="mt-2"
                ikonKiri={<IkonTambah size={14} />}
                onClick={() => setForm((f) => ({ ...f, bahan: [...f.bahan, barisKosong()] }))}
              >
                Tambah Bahan
              </Tombol>
            </div>

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
            <li key={p.id} className="p-3.5 rounded-lg border border-line bg-surface">
              <div className="flex items-start gap-3">
                <Avatar nama={p.nama} ukuran={48} />
                <div className="min-w-0 grow">
                  <p className="text-kartu font-bold text-ink leading-snug">{p.nama}</p>
                  <p className="text-isi text-ink-2">
                    {p.isiBersih ? `${p.isiBersih} · ` : ''}
                    {rupiah(p.hargaJual)}/{p.satuan}
                  </p>
                </div>
                <ChipStok status={p.stok <= 0 ? 'habis' : p.stok < p.batasAman ? 'menipis' : 'aman'} />
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-line">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-kecil font-semibold text-ink-2">Komposisi per {p.satuan}</p>
                  <Tombol ragam="tautan" ukuran="kecil" onClick={() => bukaForm(p)}>
                    Ubah
                  </Tombol>
                </div>
                {p.resep.length === 0 ? (
                  <p className="mt-1 text-isi text-ink-3">Komposisi belum diisi, jadi produk ini belum bisa dimasak.</p>
                ) : (
                  <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                    {p.resep.map((b) => (
                      <li key={b.barangId} className="flex items-baseline justify-between gap-3 text-isi">
                        <span className="min-w-0 text-ink-2">{b.nama}</span>
                        <span className="shrink-0 font-semibold text-ink tabular">{jumlahSatuan(b.takaran, b.satuan)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
