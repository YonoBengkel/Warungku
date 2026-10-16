import type { ReactNode } from 'react'
import { IkonGrafik } from '@/icons'
import { cx } from '@/lib/format'

/**
 * Keterangan metode mesin analitik, di atas halaman atau kartu yang memakai
 * keluarannya. Diminta dosen pengampu (2026-10-16): nama model dan masukannya
 * ditulis terang-terangan, menggantikan aturan lama "nama algoritma tidak tampil".
 */
export function KeteranganMetode({
  mesin,
  metode,
  masukan,
  className,
}: {
  mesin: string
  metode: string
  /** Variabel yang dipakai model, ditulis biasa. */
  masukan?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-md border border-line bg-brand-soft/60 px-3 py-2.5 text-[0.8125rem]',
        className,
      )}
    >
      <IkonGrafik size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
      <p className="min-w-0 leading-relaxed text-ink-2">
        <span className="font-bold text-ink">
          {mesin} · {metode}
        </span>
        {masukan && <span className="block text-ink-3">{masukan}</span>}
      </p>
    </div>
  )
}

/** Metode Mesin 1 menurut kode model di tabel `prediksi`. Tanpa data server: model produksi yang dipakai. */
export function metodeMesin1(kode: string | null): { metode: string; masukan: string } {
  const k = (kode ?? 'lightgbm').toLowerCase()
  if (k.startsWith('lightgbm')) {
    return {
      metode: 'LightGBM',
      masukan:
        'Masukan: riwayat pemakaian harian (lag 7, 14, 21, 28 hari dan rata-rata 7 & 28 hari), hari dalam pekan, serta kalender libur nasional, pekan gajian, dan Ramadan.',
    }
  }
  if (k.startsWith('sarima')) {
    return {
      metode: 'SARIMA(1,0,1)(0,1,1)7',
      masukan: 'Masukan: riwayat pemakaian harian serta kalender libur nasional, pekan gajian, dan Ramadan.',
    }
  }
  return { metode: 'ETS (Holt-Winters)', masukan: 'Masukan: riwayat pemakaian harian.' }
}

export const METODE_MESIN2 = {
  metode: 'Thompson Sampling (Beta-Bernoulli) + logika fuzzy Sugeno',
  masukan:
    'Masukan: riwayat tiap pesanan ke distributor (tepat waktu, jumlah sesuai, kondisi baik) dan rasio harga terhadap penawaran termurah.',
}

export const METODE_MESIN3 = {
  metode: 'Segmentasi dengan K-Prototypes + log transform',
  masukan:
    'Masukan: recency, frequency, dan monetary (log), lama berlangganan, jenis usaha, dan kategori barang utama tiap pelanggan.',
}
