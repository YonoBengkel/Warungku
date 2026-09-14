import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom, PilihanKartu } from '@/components/ui/formulir'
import { IkonKembali, IkonLokasi } from '@/icons'
import { LABEL_CARA_HITUNG } from '@/lib/label'
import type { CaraHitungStok } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/* Urutan kartu dikunci: yang paling sering dipilih pemilik warung ada di atas. */
const URUTAN_CARA: CaraHitungStok[] = ['racikan', 'kemasan', 'keduanya']

/* Alamat contoh yang dipakai tombol "Ambil lokasi saat ini" pada purwarupa ini. */
const LOKASI_TERDETEKSI = {
  alamat: 'Jl. Kaliurang KM 5,6 No. 24, Sinduadi, Mlati',
  kota: 'Sleman, DI Yogyakarta',
}

/**
 * Langkah 2 dari 3: identitas usaha dan satu pertanyaan bisnis.
 *
 * Pertanyaan "Apa yang kamu jual?" ditulis dengan bahasa dagang, bukan bahasa
 * sistem. Jawabannya cuma menentukan bentuk awal formulir Tambah Barang, tidak
 * mengunci apa pun, jadi salah pilih di sini tidak pernah jadi jalan buntu.
 */
export default function DaftarUsaha() {
  const navigate = useNavigate()
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [namaUsaha, setNamaUsaha] = useState('')
  const [alamat, setAlamat] = useState('')
  const [kota, setKota] = useState('')
  const [namaPemilik, setNamaPemilik] = useState('')
  const [email, setEmail] = useState('')
  const [cara, setCara] = useState<CaraHitungStok | null>(null)
  const [galat, setGalat] = useState<{
    namaUsaha?: string
    alamat?: string
    namaPemilik?: string
    email?: string
    cara?: string
  }>({})
  const [mencariLokasi, setMencariLokasi] = useState(false)
  const [memuat, setMemuat] = useState(false)
  const [percobaanGagal, setPercobaanGagal] = useState(0)

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  function ambilLokasi() {
    setMencariLokasi(true)
    window.setTimeout(() => {
      setMencariLokasi(false)
      setAlamat(LOKASI_TERDETEKSI.alamat)
      setKota(LOKASI_TERDETEKSI.kota)
      setGalat((g) => ({ ...g, alamat: undefined }))
      tampilkanRacun('Alamat terisi dari lokasi kamu sekarang. Periksa dulu sebelum lanjut.', 'info')
    }, 900)
  }

  function lanjut() {
    const baru: typeof galat = {}
    if (namaUsaha.trim().length < 3) {
      baru.namaUsaha =
        'Nama usaha belum diisi atau terlalu pendek. Tulis nama yang tertera di spanduk warungmu, minimal 3 huruf. Contoh: Kopi Kita Jogja.'
    }
    if (alamat.trim().length < 8) {
      baru.alamat =
        'Alamat usaha belum lengkap. Tulis nama jalan dan nomor supaya kurir bisa menemukannya. Contoh: Jl. Kaliurang KM 5,6 No. 24.'
    }
    if (namaPemilik.trim().length < 3) {
      baru.namaPemilik =
        'Nama pemilik belum diisi. Tulis nama lengkap sesuai KTP. Contoh: Bagas Prasetyo.'
    }
    if (email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      baru.email = 'Email harus memuat tanda @ dan nama domain. Perbaiki penulisannya. Contoh: halo@kopikita.id.'
    }
    if (!cara) {
      baru.cara = 'Pilih salah satu dari tiga kartu di atas supaya formulir Tambah Barang menyesuaikan jualanmu.'
    }
    setGalat(baru)
    if (Object.keys(baru).length > 0 || !cara) {
      setPercobaanGagal((n) => n + 1)
      return
    }

    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      /* Kota hanya ditulis kalau benar-benar terbaca. Menimpanya dengan teks
         kosong akan menghapus kota yang sudah ada di profil tanpa diminta. */
      ubahProfil({
        namaUsaha: namaUsaha.trim(),
        alamat: alamat.trim(),
        namaPemilik: namaPemilik.trim(),
        email: email.trim(),
        caraHitung: cara,
        ...(kota.trim() ? { kota: kota.trim() } : {}),
      })
      tampilkanRacun(`Data ${namaUsaha.trim()} tersimpan. Tinggal satu langkah lagi.`, 'aman')
      navigate('/daftar/legalitas')
    }, 650)
  }

  return (
    <LayarAuth langkah={2} judul="Tentang Usaha Kamu" kembaliKe="/daftar">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          lanjut()
        }}
      >
        <div className="space-y-4">
          <Kolom
            label="Nama Usaha"
            wajib
            autoComplete="organization"
            placeholder="Kopi Kita Jogja"
            value={namaUsaha}
            galat={galat.namaUsaha}
            onChange={(e) => setNamaUsaha(e.target.value)}
          />

          <div>
            <AreaTeks
              label="Alamat Usaha"
              wajib
              rows={2}
              placeholder="Jl. Kaliurang KM 5,6 No. 24, Sinduadi, Mlati"
              value={alamat}
              galat={galat.alamat}
              bantuan="Alamat ini dipakai distributor untuk menghitung ongkos kirim."
              onChange={(e) => setAlamat(e.target.value)}
            />
            <Tombol
              ragam="garis"
              ukuran="sedang"
              className="mt-2.5"
              memuat={mencariLokasi}
              ikonKiri={mencariLokasi ? undefined : <IkonLokasi size={17} />}
              onClick={ambilLokasi}
            >
              {mencariLokasi ? 'Sedang mencari lokasi' : 'Ambil lokasi saat ini'}
            </Tombol>
            {kota && (
              <p className="mt-2 text-[0.8125rem] text-ink-3">
                Kota terbaca: <span className="font-semibold text-ink-2">{kota}</span>
              </p>
            )}
          </div>

          <Kolom
            label="Nama Pemilik"
            wajib
            autoComplete="name"
            placeholder="Bagas Prasetyo"
            value={namaPemilik}
            galat={galat.namaPemilik}
            onChange={(e) => setNamaPemilik(e.target.value)}
          />

          <Kolom
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="halo@kopikita.id"
            value={email}
            galat={galat.email}
            bantuan="Dipakai kalau kamu ingin menerima salinan nota pesanan."
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <section className="mt-6" aria-labelledby="judul-jualan">
          <h2 id="judul-jualan" className="text-[1rem] font-bold text-ink">
            Apa yang kamu jual?
          </h2>
          <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
            Jawaban ini cuma menentukan bentuk awal formulir Tambah Barang. Bisa diganti kapan saja dari Akun.
          </p>

          <div
            role="radiogroup"
            aria-labelledby="judul-jualan"
            aria-invalid={galat.cara ? true : undefined}
            aria-describedby={galat.cara ? 'galat-jualan' : undefined}
            className="mt-3 space-y-2.5"
          >
            {URUTAN_CARA.map((kunci) => (
              <PilihanKartu
                key={kunci}
                nilai={kunci}
                terpilih={cara === kunci}
                ubah={(v) => {
                  setCara(v as CaraHitungStok)
                  setGalat((g) => ({ ...g, cara: undefined }))
                }}
                judul={LABEL_CARA_HITUNG[kunci].judul}
                keterangan={LABEL_CARA_HITUNG[kunci].bantuan}
              />
            ))}
          </div>

          {galat.cara && (
            <p id="galat-jualan" className="mt-2 text-[0.8125rem] text-kritis font-medium leading-snug">
              {galat.cara}
            </p>
          )}
        </section>

        <div className="sticky bottom-0 mt-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-4 bg-surface/95 backdrop-blur-sm border-t border-line rounded-b-lg">
          <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
            {memuat ? 'Sedang menyimpan' : 'Lanjut ke Data Legalitas'}
          </Tombol>
        </div>
      </form>
    </LayarAuth>
  )
}

/* ================================================================== */
/* Bagian yang hanya dipakai layar ini                                */
/* ================================================================== */

/**
 * Bagian pertama yang salah dibawa ke layar. Pertanyaan "Apa yang kamu jual?"
 * ada jauh di bawah, jadi tanpa ini pengguna menekan tombol dan seolah tidak
 * terjadi apa-apa karena pesannya berada di luar layar.
 */
function sorotGalatPertama() {
  const kolom = document.querySelector<HTMLElement>(
    'input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"]',
  )
  const sasaran = kolom ?? document.querySelector<HTMLElement>('[aria-invalid="true"]')
  sasaran?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  kolom?.focus({ preventScroll: true })
}

function LayarAuth({
  langkah,
  judul,
  kembaliKe,
  children,
}: {
  langkah: number
  judul: string
  kembaliKe: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-bg px-4 pt-aman pb-aman">
      <div className="w-full max-w-[28rem] mx-auto py-8 sm:py-12">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span
            className="size-9 rounded-md bg-brand text-ink-inverse grid place-items-center font-extrabold text-[1.125rem] leading-none"
            aria-hidden="true"
          >
            W
          </span>
          <span className="text-[1.125rem] font-extrabold text-ink tracking-tight">Warungku</span>
        </div>

        <div className="bg-surface border border-line rounded-lg shadow-e1 p-5 sm:p-6 anim-muncul">
          <Link
            to={kembaliKe}
            className="inline-flex items-center gap-1.5 h-11 -ml-1.5 pr-2.5 pl-1.5 rounded-md text-[0.8125rem] font-semibold text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
          >
            <IkonKembali size={18} />
            Kembali
          </Link>

          <div className="mt-2 mb-4">
            <div
              className="h-1 w-full rounded-full bg-sunken overflow-hidden"
              role="progressbar"
              aria-valuenow={langkah}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-label={`Langkah ${langkah} dari 3`}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${(langkah / 3) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">{judul}</h1>
              <span className="text-[0.8125rem] font-semibold text-ink-3 shrink-0">Langkah {langkah} dari 3</span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
