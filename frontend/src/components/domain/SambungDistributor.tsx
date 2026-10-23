import { useState } from 'react'
import { JudulBagian, Kartu, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { GalatApi, ServerTakTerjangkau } from '@/lib/api'
import { useAplikasi } from '@/store/aplikasi'
import { AKUN_DISTRIBUTOR } from '@/lib/akunSimulasi'


/**
 * Menyambungkan portal distributor ke server.
 *
 * Portal distributor belum punya halaman masuk sendiri; selama itu, halaman
 * yang butuh data server (Pelanggan, Pesanan) memakai kartu ini. Sesi
 * distributor terpisah dari sesi pemilik usaha dan tokennya berbeda jenis.
 */
export function KartuSambungDistributor({ keterangan, className }: { keterangan: string; className?: string }) {
  const sambung = useAplikasi((s) => s.sambungDistributor)
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  function kirim() {
    setMemuat(true)
    setGalat(null)
    sambung(email.trim(), sandi)
      .catch((e: unknown) => {
        setGalat(
          e instanceof ServerTakTerjangkau
            ? 'Turnify Flow belum bisa dihubungi. Pastikan layanannya menyala, lalu coba lagi.'
            : e instanceof GalatApi
              ? e.message
              : 'Gagal menyambung. Coba lagi sebentar lagi.',
        )
      })
      .finally(() => setMemuat(false))
  }

  return (
    <Kartu className={className}>
      <JudulBagian judul="Masuk sebagai distributor" keterangan={keterangan} />
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          kirim()
        }}
      >
        <Kolom
          label="Email distributor"
          wajib
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Kolom
          label="Kata sandi"
          wajib
          type="password"
          autoComplete="current-password"
          value={sandi}
          galat={galat ?? undefined}
          onChange={(e) => setSandi(e.target.value)}
        />
        <div className="flex flex-wrap gap-2.5">
          <Tombol type="submit" memuat={memuat}>
            Masuk
          </Tombol>
          <Tombol
            ragam="garis"
            onClick={() => {
              setEmail(AKUN_DISTRIBUTOR.email)
              setSandi(AKUN_DISTRIBUTOR.kataSandi)
              setGalat(null)
            }}
          >
            Isikan akun simulasi
          </Tombol>
        </div>
      </form>
      <p className="mt-3 text-kecil text-ink-3">
        Akun simulasi {AKUN_DISTRIBUTOR.email} adalah Sumber Tani Nusantara di data simulasi.
      </p>
    </Kartu>
  )
}
