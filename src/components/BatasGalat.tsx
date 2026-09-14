import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Tombol } from '@/components/ui/dasar'

/**
 * Menahan kegagalan render supaya tidak menjatuhkan seluruh aplikasi.
 *
 * Yang dilihat pemilik warung bukan tumpukan galat teknis: ia tidak bisa
 * berbuat apa-apa dengan informasi itu, dan layar putih tanpa penjelasan jauh
 * lebih menakutkan daripada satu kartu yang gagal tampil. Rinciannya tetap
 * dicatat ke konsol untuk pengembang.
 *
 * Kuncinya pada `key` di pemakaian: batas ini dipasang ulang setiap kali rute
 * berubah, sehingga berpindah halaman selalu memulihkan keadaan.
 */
interface Props {
  children: ReactNode
}

interface State {
  gagal: boolean
}

export class BatasGalat extends Component<Props, State> {
  state: State = { gagal: false }

  static getDerivedStateFromError(): State {
    return { gagal: true }
  }

  componentDidCatch(galat: Error, info: ErrorInfo) {
    // Sengaja dibiarkan hanya di konsol, tidak pernah ditampilkan ke pengguna.
    console.error('Render gagal:', galat, info.componentStack)
  }

  render() {
    if (!this.state.gagal) return this.props.children

    return (
      <div className="py-14 px-6 text-center flex flex-col items-center">
        <h1 className="text-[1.125rem] font-extrabold text-ink">Halaman ini belum bisa ditampilkan</h1>
        <p className="mt-2 text-[0.9375rem] text-ink-2 leading-relaxed max-w-[40ch]">
          Data stok dan pesanan kamu tetap aman. Coba buka halaman ini lagi, atau kembali ke Beranda dulu.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <Tombol onClick={() => this.setState({ gagal: false })}>Coba tampilkan lagi</Tombol>
          <Tombol ragam="garis" onClick={() => window.location.assign('/beranda')}>
            Kembali ke Beranda
          </Tombol>
        </div>
      </div>
    )
  }
}
