import type { Transaksi } from '@/lib/types'
import { angka, jam, jumlahSatuan, tanggalRingkas } from '@/lib/format'

/**
 * Satu-satunya tampilan struk di aplikasi.
 *
 * Bentuk di bawah ini adalah **format struk POS_TUNGGAL** (Kasir Open POS,
 * lihat `POS_TUNGGAL` di `src/data/dummy.ts`) — satu-satunya skema struk yang
 * dikenal aplikasi. Tidak ada format kedua dan tidak ada pemetaan antar format:
 * struk yang bentuknya lain tidak pernah sampai ke layar ini. Kalau suatu saat
 * ada POS lain, yang berubah adalah pembacanya di lapisan data, bukan komponen
 * ini — supaya struk tetap terbaca sama di mana pun ia muncul.
 *
 * TIDAK ADA HARGA SAMA SEKALI di sini, dan itu bukan kelalaian. Harga jual
 * adalah milik aplikasi kasir; aplikasi ini hanya mengurus stok gudang, jadi
 * yang dibutuhkan cuma APA dan BERAPA. Jangan menambahkan kolom harga, subtotal,
 * atau total rupiah ke komponen ini.
 *
 * Sengaja tanpa <h2>/<h3>: kartu ini menumpang di dua halaman dengan susunan
 * judul yang berbeda, dan judul di dalamnya akan membuat tingkatnya melompat.
 */

/** Batas baris yang ditampilkan versi ringkas, sebelum sisanya diringkas jadi satu kalimat. */
const BARIS_RINGKAS = 3

export function KartuStruk({ transaksi, ringkas }: { transaksi: Transaksi; ringkas?: boolean }) {
  const tampil = ringkas ? transaksi.baris.slice(0, BARIS_RINGKAS) : transaksi.baris
  const sisaBaris = transaksi.baris.length - tampil.length
  const totalItem = transaksi.baris.reduce((t, b) => t + b.jumlah, 0)

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3.5">
      {/* Kepala struk: nomor, waktu, dan siapa yang jaga saat itu. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 break-words font-mono text-[0.8125rem] font-bold text-ink leading-snug">
          {transaksi.nomorStruk}
        </p>
        <p className="shrink-0 text-[0.75rem] text-ink-3">
          {tanggalRingkas(transaksi.waktu)} &middot; {jam(transaksi.waktu)}
        </p>
      </div>
      <p className="mt-0.5 text-[0.75rem] text-ink-3">Kasir {transaksi.kasir}</p>

      {/* Pemisah putus-putus memakai token garis, bukan hex. */}
      <div className="my-2.5 border-t border-dashed border-line-strong" aria-hidden="true" />

      {/* Nama item boleh membungkus; kolom jumlah tidak pernah ikut melebar,
          supaya struk selebar apa pun tidak menggeser badan halaman di 360px. */}
      <ul className="space-y-1.5">
        {tampil.map((b, i) => (
          <li key={`${b.nama}-${i}`} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words text-[0.8125rem] text-ink-2 leading-snug">{b.nama}</span>
            <span className="shrink-0 text-[0.8125rem] font-semibold text-ink tabular">
              {jumlahSatuan(b.jumlah, b.satuan)}
            </span>
          </li>
        ))}
      </ul>

      {sisaBaris > 0 && (
        <p className="mt-1.5 text-[0.75rem] text-ink-3">dan {angka(sisaBaris)} item lainnya</p>
      )}

      <div className="my-2.5 border-t border-dashed border-line-strong" aria-hidden="true" />

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] font-semibold text-ink-2">Total item</span>
        <span className="shrink-0 text-[0.9375rem] font-extrabold text-ink tabular">{angka(totalItem)}</span>
      </div>
    </div>
  )
}
