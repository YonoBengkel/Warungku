import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Kartu, Tombol, TombolTautan } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonKotak } from '@/icons'
import {
  dariTampil,
  desimalTampil,
  jumlahTampil,
  keTampilBulat,
  langkahTampil,
  satuanTampil,
} from '@/lib/satuan'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Koreksi stok: satu pertanyaan saja — sisanya sekarang berapa.
 *
 * Tidak ada pertanyaan "kenapa". Pemilik usaha menghitung barang di rak lalu
 * mengetik angkanya; selisihnya dihitung sistem. Yang tetap tercatat TANPA
 * ditanyakan: siapa, kapan, angka sebelum-sesudah, dan jenisnya sebagai
 * koreksi. Jenis itu yang menjaga data perkiraan tetap bersih — koreksi tidak
 * pernah terbaca sebagai penjualan, jadi barang basi yang dibuang tidak
 * membuat saran belanja ikut membesar.
 *
 * Yang ditanyakan adalah SISA, bukan selisih: orang lebih mudah menghitung isi
 * rak daripada menghitung berapa yang hilang.
 */
export default function StokKoreksi() {
  const { id = '' } = useParams()
  const navigasi = useNavigate()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))
  const koreksiStok = useAplikasi((s) => s.koreksiStok)

  /* Dalam SATUAN TAMPIL, sama dengan angka di daftar Stok. Dimulai dari stok
     tercatat supaya orang cukup menggeser angkanya, bukan mengetik dari nol. */
  const [nilai, setNilai] = useState(() => (barang ? keTampilBulat(barang, Math.max(0, barang.stok)) : 0))
  const [dicoba, setDicoba] = useState(false)

  if (!barang) {
    return (
      <>
        <KepalaHalaman judul="Koreksi Stok" kembaliKe="/stok" />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini tidak ada di daftar stok"
          pesan="Koreksi hanya bisa disimpan untuk barang yang sudah tercatat. Daftar stok yang sekarang masih lengkap."
          aksi={<TombolTautan ke="/stok">Kembali ke Daftar Stok</TombolTautan>}
        />
      </>
    )
  }

  const tercatat = Math.max(0, barang.stok)
  const stokBaru = dariTampil(barang, nilai)
  const selisih = Math.round((stokBaru - tercatat) * 100) / 100
  const sama = Math.abs(selisih) < 0.005

  const galat =
    dicoba && sama
      ? `Angkanya masih sama dengan stok tercatat, ${jumlahTampil(barang, tercatat)}. Kalau sisanya memang segitu, tidak ada yang perlu disimpan.`
      : undefined

  /* Ditulis sebagai const supaya penjagaan "barang tidak ditemukan" di atas
     tetap berlaku di dalam penangan ini. */
  const simpan = () => {
    setDicoba(true)
    if (sama) return
    koreksiStok(barang.id, stokBaru)
    navigasi(`/stok/${barang.id}`)
  }

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Koreksi Stok" keterangan={barang.nama} kembaliKe={`/stok/${barang.id}`} />

      <div className="mt-4 max-w-2xl mx-auto space-y-4">
        <Kartu padat>
          <p className="text-[0.8125rem] text-ink-3">Stok tercatat sekarang</p>
          <p className="mt-0.5 text-[1.5rem] font-extrabold text-ink leading-none">
            {jumlahTampil(barang, tercatat)}
          </p>
        </Kartu>

        <Kartu>
          <h2 className="text-[1rem] font-bold text-ink leading-tight">Sisa sekarang berapa?</h2>
          <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">
            Hitung barangnya di rak, lalu tulis jumlahnya. Selisihnya kami catat sendiri.
          </p>

          <div className="mt-3.5">
            <PengaturJumlah
              nilai={nilai}
              ubah={(n) => {
                setNilai(n)
                setDicoba(false)
              }}
              langkah={langkahTampil(barang)}
              desimal={desimalTampil(barang)}
              min={0}
              satuan={satuanTampil(barang).nama}
              label="Sisa sekarang"
            />
            {galat && <p className="mt-2 text-[0.8125rem] text-kritis font-medium leading-snug">{galat}</p>}
          </div>

          {/* "Stok jadi 3,4 kg dari 3,4 kg" adalah kalimat kosong, jadi kalimat
              ringkasan baru muncul setelah angkanya benar-benar berubah. */}
          {!sama && (
            <p className="mt-4 text-[0.9375rem] text-ink-2 leading-relaxed anim-muncul">
              Stok jadi <strong className="text-ink">{jumlahTampil(barang, stokBaru)}</strong>,{' '}
              {selisih < 0 ? 'berkurang' : 'bertambah'}{' '}
              <strong className="text-ink">{jumlahTampil(barang, Math.abs(selisih))}</strong> dari catatan.
            </p>
          )}

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <Tombol penuh onClick={simpan}>
              Simpan Koreksi
            </Tombol>
            <TombolTautan ke={`/stok/${barang.id}`} ragam="garis" penuh>
              Batal
            </TombolTautan>
          </div>
        </Kartu>
      </div>
    </div>
  )
}
