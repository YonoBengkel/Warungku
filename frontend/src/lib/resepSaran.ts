import { angka } from '@/lib/format'
import type { Barang } from '@/lib/types'

/**
 * Resep saran untuk demo Portal POS: menu yang belum punya resep di data demo
 * Kopi Kita. Takarannya per porsi dalam satuan dasar barang (gram, ml, pcs).
 * Tombol "Pakai Resep Saran" hanya mengisi layar pemasangan, jadi pemilik masih
 * bisa mengubah takarannya sebelum menyimpan. Sirup vanila menggantikan sirup
 * pandan, yang belum ada di katalog.
 */
const RESEP_SARAN: Record<string, Array<{ bahan: string; takaran: number }>> = {
  'kopi susu pandan': [
    { bahan: 'Biji Kopi Arabika', takaran: 18 },
    { bahan: 'Susu UHT Full Cream', takaran: 150 },
    { bahan: 'Sirup Vanila', takaran: 20 },
    { bahan: 'Es Batu Kristal', takaran: 150 },
    { bahan: 'Gelas Plastik 16 oz', takaran: 1 },
    { bahan: 'Sedotan Kertas', takaran: 1 },
  ],
  'roti bakar keju': [
    { bahan: 'Roti Tawar', takaran: 2 },
    { bahan: 'Keju Cheddar', takaran: 30 },
    { bahan: 'Susu Kental Manis', takaran: 15 },
  ],
  'kentang goreng': [
    { bahan: 'Kentang Beku', takaran: 150 },
    { bahan: 'Minyak Goreng', takaran: 30 },
  ],
}

/** Isian bahan untuk menu ini dari gudang usaha, atau null kalau tidak ada resep saran yang bahannya tersedia. */
export function resepSaranUntuk(namaMenu: string, barang: Barang[]): Array<{ id: string; takaran: string }> | null {
  const saran = RESEP_SARAN[namaMenu.trim().toLowerCase()]
  if (!saran) return null
  const isi = saran.flatMap((s) => {
    const b = barang.find((x) => x.nama.toLowerCase() === s.bahan.toLowerCase() && !x.dicatatManual)
    return b ? [{ id: b.id, takaran: angka(s.takaran, 3) }] : []
  })
  return isi.length > 0 ? isi : null
}
