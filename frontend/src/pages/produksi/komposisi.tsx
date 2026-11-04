import type { ReactNode } from 'react'
import { Avatar, Tombol } from '@/components/ui/dasar'
import { Kolom, Pilihan } from '@/components/ui/formulir'
import { IkonSilang, IkonTambah } from '@/icons'
import { bacaAngkaIndonesia } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pola tab Menu di halaman Produksi, dipakai bersama oleh kedai dan produsen
 * (keputusan Ilham, 4 Nov 2026): kartu per menu dengan komposisi di dalamnya, dan
 * satu formulir yang memuat harga sekaligus daftar bahan.
 */

export type BarisBahan = { barangId: string; takaran: string }

export function barisKosong(): BarisBahan {
  return { barangId: '', takaran: '' }
}

/** Pesan galat untuk baris yang bahannya sudah dipilih, atau undefined kalau semuanya benar. */
export function periksaKomposisi(bahanDiisi: BarisBahan[]): string | undefined {
  if (bahanDiisi.some((b) => !(bacaAngkaIndonesia(b.takaran) > 0))) return 'Setiap bahan butuh takaran lebih dari 0.'
  if (new Set(bahanDiisi.map((b) => b.barangId)).size !== bahanDiisi.length) {
    return 'Ada bahan yang dipilih dua kali. Gabungkan takarannya ke satu baris.'
  }
  return undefined
}

/**
 * Daftar baris "bahan + takaran" yang bisa ditambah dan dibuang.
 *
 * Lebar tiap kolom ditentukan pembungkusnya, bukan `className` milik `Pilihan` dan
 * `Kolom`: keduanya selalu `w-full`, sehingga `w-32` kalah dan barisnya meluber
 * keluar kartu. Di HP pilihan bahan mengambil satu baris sendiri.
 */
export function IsianKomposisi({
  judul,
  bahan,
  ubah,
  galat,
  aksi,
}: {
  judul: string
  bahan: BarisBahan[]
  ubah: (baru: BarisBahan[]) => void
  galat?: string
  /** Tombol tambahan di samping Tambah Bahan, misalnya Pakai resep saran. */
  aksi?: ReactNode
}) {
  const barang = useAplikasi((s) => s.barang)

  function ubahBaris(i: number, patch: Partial<BarisBahan>) {
    ubah(bahan.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  }

  return (
    <div>
      <p className="text-isi font-semibold text-ink mb-1.5">{judul}</p>
      <div className="space-y-2">
        {bahan.map((b, i) => (
          <div key={i} className="flex flex-wrap sm:flex-nowrap items-start gap-2">
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <Pilihan
                aria-label={`Bahan baris ${i + 1}`}
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
            </div>
            <div className="min-w-0 flex-1 sm:flex-none sm:w-40">
              <Kolom
                aria-label={`Takaran bahan baris ${i + 1}`}
                placeholder="Takaran"
                inputMode="decimal"
                akhiran={barang.find((x) => x.id === b.barangId)?.satuan}
                value={b.takaran}
                onChange={(e) => ubahBaris(i, { takaran: e.target.value })}
              />
            </div>
            <button
              type="button"
              aria-label={`Buang baris bahan ${i + 1}`}
              onClick={() => ubah(bahan.length > 1 ? bahan.filter((_, j) => j !== i) : [barisKosong()])}
              className="shrink-0 size-11 grid place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-kritis-ink"
            >
              <IkonSilang size={16} />
            </button>
          </div>
        ))}
      </div>
      {galat && (
        <p role="alert" className="mt-1.5 text-kecil font-semibold text-kritis-ink">
          {galat}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Tombol ragam="garis" ukuran="kecil" ikonKiri={<IkonTambah size={14} />} onClick={() => ubah([...bahan, barisKosong()])}>
          Tambah Bahan
        </Tombol>
        {aksi}
      </div>
    </div>
  )
}

/** Satu kartu menu atau produk: identitas di atas, komposisi di bawah. */
export function KartuKomposisi({
  nama,
  keterangan,
  kanan,
  judulKomposisi,
  ubah,
  bahan,
  kosong,
}: {
  nama: string
  keterangan: ReactNode
  /** Di pojok kanan atas: status stok untuk produk, sakelar Dijual untuk menu kedai. */
  kanan: ReactNode
  judulKomposisi: string
  ubah: () => void
  bahan: Array<{ kunci: string; nama: string; jumlah: string }>
  /** Tampil kalau komposisinya belum ada. */
  kosong: ReactNode
}) {
  return (
    <li className="p-3.5 rounded-lg border border-line bg-surface">
      <div className="flex items-start gap-3">
        <Avatar nama={nama} ukuran={48} />
        <div className="min-w-0 grow">
          <p className="text-kartu font-bold text-ink leading-snug">{nama}</p>
          <p className="text-isi text-ink-2">{keterangan}</p>
        </div>
        <div className="shrink-0">{kanan}</div>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-line">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-kecil font-semibold text-ink-2">{judulKomposisi}</p>
          <Tombol ragam="tautan" ukuran="kecil" aria-label={`Ubah ${nama}`} onClick={ubah}>
            Ubah
          </Tombol>
        </div>
        {bahan.length === 0 ? (
          kosong
        ) : (
          <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {bahan.map((b) => (
              <li key={b.kunci} className="flex items-baseline justify-between gap-3 text-isi">
                <span className="min-w-0 text-ink-2">{b.nama}</span>
                <span className="shrink-0 font-semibold text-ink tabular">{b.jumlah}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
