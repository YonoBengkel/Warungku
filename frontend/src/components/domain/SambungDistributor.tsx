import { useState } from 'react'
import { JudulBagian, Kartu, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { IkonKeluar } from '@/icons'
import { GalatApi, ServerTakTerjangkau } from '@/lib/api'
import { useAplikasi } from '@/store/aplikasi'

/** Akun contoh dari pembangkit dataset (KATA_SANDI_CONTOH). Nilai uji untuk basis data lokal. */
const AKUN_SIMULASI = { email: 'distributor1@warungku.test', kataSandi: 'warungku123' }

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
            ? 'Server belum menyala. Nyalakan API Turnify Flow (port 8000), lalu coba lagi.'
            : e instanceof GalatApi
              ? e.message
              : 'Gagal menyambung. Coba lagi sebentar lagi.',
        )
      })
      .finally(() => setMemuat(false))
  }

  return (
    <Kartu className={className}>
      <JudulBagian judul="Sambungkan ke server" keterangan={keterangan} />
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
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Kolom
          label="Kata sandi"
          type="password"
          autoComplete="current-password"
          value={sandi}
          galat={galat ?? undefined}
          onChange={(e) => setSandi(e.target.value)}
        />
        <div className="flex flex-wrap gap-2.5">
          <Tombol type="submit" memuat={memuat}>
            Sambungkan
          </Tombol>
          <Tombol
            ragam="garis"
            onClick={() => {
              setEmail(AKUN_SIMULASI.email)
              setSandi(AKUN_SIMULASI.kataSandi)
              setGalat(null)
            }}
          >
            Isikan akun simulasi
          </Tombol>
        </div>
      </form>
      <p className="mt-3 text-[0.75rem] text-ink-3">
        Akun simulasi {AKUN_SIMULASI.email} adalah Sumber Tani Nusantara di data simulasi.
      </p>
    </Kartu>
  )
}

/** Tombol kecil untuk melepas sambungan server; portal kembali ke data contoh. */
export function TombolPutusDistributor() {
  const putus = useAplikasi((s) => s.putusDistributor)
  return (
    <Tombol ragam="garis" ukuran="kecil" ikonKiri={<IkonKeluar size={15} />} onClick={putus}>
      Putuskan dari Server
    </Tombol>
  )
}
