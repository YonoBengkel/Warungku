import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TandaMerek } from '@/components/ui/Merek'
import { IkonKembali } from '@/icons'

const KELAS_TAUTAN_KEMBALI =
  'inline-flex items-center gap-1.5 h-11 -ml-1.5 pr-2.5 pl-1.5 rounded-md text-isi font-semibold text-ink-2 hover:text-ink hover:bg-sunken transition-colors'

/**
 * Kerangka semua halaman masuk dan daftar: Masuk, Masuk Distributor, Masuk POS,
 * ketiga langkah Daftar, dan Lupa Sandi.
 *
 * Dulu tiap halaman menyalin kerangkanya sendiri (lima salinan, ditambah dua
 * versi lain di Masuk Distributor dan Masuk POS), dan tidak satu pun punya jalan
 * kembali ke halaman depan. Sejak revisi V8 (Q173) semuanya memakai kerangka
 * ini, dengan "Kembali ke beranda" di pojok kiri atas.
 *
 * Tautan itu berbeda dari `kembaliKe`, yang mundur satu langkah pendaftaran.
 *
 * Penyebut bilah langkah dikunci ke 5 di ketiga layar pendaftaran: alurnya baru
 * selesai sesudah data kasir dan batas aman, dan penyebut yang berbeda antar
 * layar membuat bilah progres mundur di tengah jalan.
 */
export function LayarAuth({
  children,
  langkah,
  judul,
  kembaliKe,
  kartu = true,
}: {
  children: ReactNode
  /** Langkah pendaftaran, 1 sampai 5. Tampil bersama `judul` di atas isi kotak. */
  langkah?: number
  judul?: string
  /** Langkah pendaftaran sebelumnya. */
  kembaliKe?: string
  /** Halaman yang menaruh judulnya di luar kotak (Masuk Distributor, Masuk POS) memasang kotaknya sendiri. */
  kartu?: boolean
}) {
  const isi = (
    <>
      {kembaliKe && (
        <Link to={kembaliKe} className={KELAS_TAUTAN_KEMBALI}>
          <IkonKembali size={18} />
          Kembali
        </Link>
      )}
      {langkah != null && judul && (
        <div className={kembaliKe ? 'mt-2 mb-4' : 'mb-4'}>
          <div
            className="h-1 w-full rounded-full bg-sunken overflow-hidden"
            role="progressbar"
            aria-valuenow={langkah}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label={`Langkah ${langkah} dari 5`}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${(langkah / 5) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h1 className="text-judul font-extrabold text-ink tracking-tight">{judul}</h1>
            <span className="text-isi font-semibold text-ink-3 shrink-0">Langkah {langkah} dari 5</span>
          </div>
        </div>
      )}
      {children}
    </>
  )

  return (
    <div className="relative min-h-dvh bg-bg px-4 pt-aman pb-aman">
      {/* Di layar lebar menempel di pojok kiri atas. Di HP satu baris sendiri di
          atas logo, karena di 360 px tautan dan logo yang di tengah bertumpuk. */}
      <div className="pt-2 sm:pt-0 sm:absolute sm:top-5 sm:left-6">
        <Link to="/" className={KELAS_TAUTAN_KEMBALI}>
          <IkonKembali size={18} />
          Kembali ke beranda
        </Link>
      </div>
      <div className="w-full max-w-[28rem] mx-auto pt-3 pb-8 sm:py-12">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <TandaMerek ukuran={36} />
          <span className="text-[1.125rem] font-extrabold text-ink tracking-tight">Turnify Flow</span>
        </div>
        {kartu ? (
          <div className="bg-surface border border-line rounded-lg shadow-e1 p-5 sm:p-6 anim-muncul">{isi}</div>
        ) : (
          isi
        )}
      </div>
    </div>
  )
}
