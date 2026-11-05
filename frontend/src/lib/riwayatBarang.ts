import { useEffect, useMemo, useState } from 'react'
import { ambilPergerakan } from '@/lib/api'
import type { Barang, Pergerakan } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Riwayat pergerakan satu barang, dari mana pun asalnya.
 *
 * Mode data contoh: dibaca dari store, termasuk koreksi yang baru saja dicatat.
 * Mode server: dibaca berhalaman dari API, karena satu barang bisa punya ratusan
 * baris dan seluruh buku besar usaha tidak pernah dimuat ke peramban.
 */
export interface RiwayatBarang {
  status: 'memuat' | 'siap' | 'gagal'
  baris: Pergerakan[]
  /** Jumlah seluruh pergerakan barang ini, termasuk yang belum dimuat. */
  total: number
  memuatLagi: boolean
  muatLagi: () => void
  cobaLagi: () => void
}

const UKURAN_HALAMAN = 30

/** `awal` lebih baru dari `akhir`. Halaman bisa bertumpuk kalau ada baris baru di antara dua permintaan. */
function gabung(awal: Pergerakan[], akhir: Pergerakan[]): Pergerakan[] {
  const ada = new Set(awal.map((g) => g.id))
  return [...awal, ...akhir.filter((g) => !ada.has(g.id))]
}

export function useRiwayatPergerakan(barang: Barang | undefined): RiwayatBarang {
  const sesi = useAplikasi((s) => s.sesiServer)
  const pergerakanContoh = useAplikasi((s) => s.pergerakan)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const id = barang?.id ?? ''
  const stok = barang?.stok
  const [hasil, setHasil] = useState<{ id: string; total: number; baris: Pergerakan[] } | null>(null)
  const [gagal, setGagal] = useState<string | null>(null)
  const [percobaan, setPercobaan] = useState(0)
  const [memuatLagi, setMemuatLagi] = useState(false)

  // Stok yang berubah berarti ada baris baru, mis. nota yang baru masuk dari kasir.
  useEffect(() => {
    if (!sesi || !id) return
    let batal = false
    setGagal(null)
    ambilPergerakan(sesi, id, 0, UKURAN_HALAMAN).then(
      (h) => {
        if (batal) return
        setHasil((lama) => ({ id, total: h.total, baris: lama?.id === id ? gabung(h.baris, lama.baris) : h.baris }))
      },
      () => {
        if (!batal) setGagal(id)
      },
    )
    return () => {
      batal = true
    }
  }, [sesi, id, stok, percobaan])

  const contoh = useMemo(
    () =>
      pergerakanContoh
        .filter((g) => g.barangId === id)
        .slice()
        .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu)),
    [pergerakanContoh, id],
  )

  function muatLagi() {
    if (!sesi || hasil?.id !== id || memuatLagi) return
    setMemuatLagi(true)
    ambilPergerakan(sesi, id, hasil.baris.length, UKURAN_HALAMAN)
      .then((h) => {
        setHasil((lama) => (lama?.id === id ? { id, total: h.total, baris: gabung(lama.baris, h.baris) } : lama))
      })
      .catch(() => tampilkanRacun('Riwayat berikutnya belum bisa dimuat. Coba lagi sebentar lagi.', 'kritis'))
      .finally(() => setMemuatLagi(false))
  }

  const aksi = { memuatLagi, muatLagi, cobaLagi: () => setPercobaan((n) => n + 1) }
  if (!sesi) return { status: 'siap', baris: contoh, total: contoh.length, ...aksi }
  if (hasil?.id === id) return { status: 'siap', baris: hasil.baris, total: hasil.total, ...aksi }
  return { status: gagal === id ? 'gagal' : 'memuat', baris: [], total: 0, ...aksi }
}
