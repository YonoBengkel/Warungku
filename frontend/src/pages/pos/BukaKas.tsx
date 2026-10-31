import { useState } from 'react'
import { Kartu, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { GalatApi } from '@/lib/api'
import { bukaShift, type Shift } from '@/lib/apiKasir'
import { bacaAngkaIndonesia } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Gerbang buka kas: penjualan baru bisa dimulai sesudah shift dibuka dengan uang modal di laci.
 * Uang modal 0 boleh (laci kosong). Dipakai layar Kasir dan halaman Shift.
 */
export function BukaKas({ onBuka, judul = 'Buka kas dulu' }: { onBuka: (s: Shift) => void; judul?: string }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const [teks, setTeks] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [memuat, setMemuat] = useState(false)

  async function buka() {
    if (!sesi) return
    const modal = teks.trim() === '' ? 0 : bacaAngkaIndonesia(teks)
    if (!Number.isInteger(modal) || modal < 0) {
      setGalat('Tulis uang modal dalam Rupiah bulat, misalnya 100.000. Kosongkan kalau laci kosong.')
      return
    }
    setMemuat(true)
    setGalat(null)
    try {
      onBuka(await bukaShift(sesi, modal))
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Kas belum bisa dibuka. Coba lagi sebentar lagi.')
    } finally {
      setMemuat(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-md mx-auto mt-6 sm:mt-12">
        <Kartu>
          <h1 className="text-subjudul font-extrabold text-ink">{judul}</h1>
          <p className="mt-1 mb-4 text-isi text-ink-2 leading-relaxed">
            Hitung uang di laci, lalu tulis jumlahnya sebagai modal. Saat shift ditutup, uang di laci dicocokkan dengan modal ditambah penjualan tunai.
          </p>
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void buka()
            }}
          >
            <Kolom
              label="Uang modal di laci"
              awalan="Rp"
              inputMode="numeric"
              value={teks}
              galat={galat ?? undefined}
              onChange={(e) => setTeks(e.target.value)}
            />
            <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
              Buka Kas
            </Tombol>
          </form>
        </Kartu>
      </div>
    </div>
  )
}
