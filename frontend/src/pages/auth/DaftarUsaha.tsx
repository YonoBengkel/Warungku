import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom, Pilihan, PilihanKartu } from '@/components/ui/formulir'
import { Peringatan } from '@/components/ui/umpanBalik'
import { daftarUmkm, GalatApi, ServerTakTerjangkau } from '@/lib/api'
import { LABEL_CARA_HITUNG, LABEL_JENIS_USAHA, URUTAN_JENIS_USAHA } from '@/lib/label'
import { ambilIsianDaftar, hapusIsianDaftar } from '@/lib/pendaftaran'
import type { CaraHitungStok, JenisUsaha } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'
import { CATATAN_DAFTAR, LayarAuth } from '@/components/ui/LayarAuth'

/* Urutan kartu dikunci: yang paling sering dipilih pemilik warung ada di atas. */
const URUTAN_CARA: CaraHitungStok[] = ['racikan', 'kemasan', 'keduanya']

/* Wilayah yang dilayani distributor di purwarupa ini. Saran distributor mencocokkan kota ini dengan area kirimnya. */
const DAFTAR_KOTA = ['Kota Yogyakarta', 'Sleman', 'Bantul', 'Kulon Progo']

/**
 * Langkah 2 dari 5: identitas usaha dan satu pertanyaan bisnis. Akunnya dibuat di sini,
 * lalu pendaftar langsung masuk. Kembali ke layar ini sesudahnya hanya memperbarui profil.
 *
 * Pertanyaan "Apa yang kamu jual?" ditulis dengan bahasa dagang, bukan bahasa
 * sistem. Jawabannya cuma menentukan bentuk awal formulir Tambah Barang, tidak
 * mengunci apa pun, jadi salah pilih di sini tidak pernah jadi jalan buntu.
 */
export default function DaftarUsaha() {
  const navigate = useNavigate()
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const masukServer = useAplikasi((s) => s.masukServer)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const sudahAkun = useAplikasi((s) => s.sesiServer != null)
  const profil = useAplikasi((s) => s.profil)
  const isian = ambilIsianDaftar()

  const [namaUsaha, setNamaUsaha] = useState(sudahAkun ? profil.namaUsaha : '')
  const [jenisUsaha, setJenisUsaha] = useState<JenisUsaha | ''>(sudahAkun ? profil.jenisUsaha : '')
  const [alamat, setAlamat] = useState(sudahAkun ? profil.alamat : '')
  const [kota, setKota] = useState(sudahAkun ? profil.kota : '')
  const [namaPemilik, setNamaPemilik] = useState(sudahAkun ? profil.namaPemilik : '')
  const [email, setEmail] = useState(sudahAkun ? profil.email : '')
  const [cara, setCara] = useState<CaraHitungStok | null>(sudahAkun ? profil.caraHitung : null)
  const [galat, setGalat] = useState<{
    namaUsaha?: string
    jenisUsaha?: string
    alamat?: string
    kota?: string
    namaPemilik?: string
    email?: string
    cara?: string
  }>({})
  const [galatUmum, setGalatUmum] = useState<string | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [percobaanGagal, setPercobaanGagal] = useState(0)

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  // Dibuka langsung atau sesudah muat ulang: kata sandinya sudah tidak ada, jadi mulai dari langkah 1.
  if (!isian && !sudahAkun) return <Navigate to="/daftar" replace />

  async function lanjut() {
    const baru: typeof galat = {}
    if (namaUsaha.trim().length < 3) {
      baru.namaUsaha =
        'Nama usaha belum diisi atau terlalu pendek. Tulis nama yang tertera di spanduk warungmu, minimal 3 huruf. Contoh: Kopi Kita Jogja.'
    }
    if (!jenisUsaha) {
      baru.jenisUsaha =
        'Jenis usaha belum dipilih. Pilih yang paling mirip dengan daganganmu; kalau tidak ada yang cocok, pilih Lainnya.'
    }
    if (alamat.trim().length < 8) {
      baru.alamat =
        'Alamat usaha belum lengkap. Tulis nama jalan dan nomor supaya kurir bisa menemukannya. Contoh: Jl. Kaliurang KM 5,6 No. 24.'
    }
    if (!kota) {
      baru.kota = 'Kota belum dipilih. Pilih wilayah tempat usahamu berada. Contoh: Sleman.'
    }
    if (namaPemilik.trim().length < 3) {
      baru.namaPemilik =
        'Nama pemilik belum diisi. Tulis nama lengkap sesuai KTP. Contoh: Bagas Prasetyo.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      baru.email = 'Email dipakai untuk masuk, dan harus memuat tanda @ dan nama domain. Contoh: halo@kopikita.id.'
    }
    if (!cara) {
      baru.cara = 'Pilih salah satu dari tiga kartu di atas supaya formulir Tambah Barang menyesuaikan jualanmu.'
    }
    setGalat(baru)
    setGalatUmum(null)
    if (Object.keys(baru).length > 0 || !cara || !jenisUsaha) {
      setPercobaanGagal((n) => n + 1)
      return
    }

    const isiProfil = {
      namaUsaha: namaUsaha.trim(),
      jenisUsaha,
      alamat: alamat.trim(),
      kota,
      namaPemilik: namaPemilik.trim(),
      email: email.trim(),
      caraHitung: cara,
    }

    setMemuat(true)
    if (sudahAkun || !isian) {
      const tersimpan = await ubahProfil(isiProfil)
      setMemuat(false)
      if (tersimpan) navigate('/daftar/legalitas')
      return
    }
    try {
      await daftarUmkm({
        email: isiProfil.email,
        kataSandi: isian.kataSandi,
        nama: isiProfil.namaPemilik,
        nomorHp: isian.nomorHp,
        namaUsaha: isiProfil.namaUsaha,
        jenisUsaha,
        kota,
        alamat: isiProfil.alamat,
        caraHitung: cara,
      })
    } catch (e) {
      setMemuat(false)
      if (e instanceof ServerTakTerjangkau) {
        // Server mati saat demo: alurnya tetap bisa dilihat, dan toast menyebut akunnya belum ada.
        await ubahProfil({ ...isiProfil, nomorHp: isian.nomorHp })
        tampilkanRacun('Turnify Flow belum bisa dihubungi, jadi akunnya belum dibuat. Isianmu hanya tercatat di peramban ini.', 'menipis')
        navigate('/daftar/legalitas')
        return
      }
      const pesan = e instanceof GalatApi ? e.message : 'Akun belum bisa dibuat. Coba lagi sebentar lagi.'
      if (pesan.startsWith('Email')) setGalat({ email: pesan })
      // Server lebih ketat daripada pemeriksaan di layar: domain seperti contoh.test ditolak di sana.
      else if (e instanceof GalatApi && e.status === 422 && pesan.includes('"email"')) {
        setGalat({ email: 'Alamat email ini tidak diterima. Pakai alamat email yang aktif. Contoh: halo@kopikita.id.' })
      } else setGalatUmum(pesan)
      setPercobaanGagal((n) => n + 1)
      return
    }
    try {
      await masukServer(isiProfil.email, isian.kataSandi)
    } catch {
      // Akunnya sudah ada, hanya langkah masuknya yang gagal. Mengulang formulir ini akan ditolak.
      setMemuat(false)
      hapusIsianDaftar()
      tampilkanRacun('Akunmu sudah dibuat. Masuk dengan email dan kata sandi tadi.', 'info')
      navigate('/masuk')
      return
    }
    setMemuat(false)
    hapusIsianDaftar()
    tampilkanRacun('Akunmu sudah dibuat. Berikutnya data legalitas.', 'aman')
    navigate('/daftar/legalitas')
  }

  return (
    <LayarAuth langkah={2} judul="Tentang Usaha Kamu" kembaliKe={sudahAkun ? undefined : '/daftar'} purwarupa={CATATAN_DAFTAR}>
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

          {/* Pilihan baku: dari sinilah rekomendasi distributor pertama kali
              dibuat, sebelum ada riwayat pesanan apa pun. */}
          <Pilihan
            label="Jenis Usaha"
            wajib
            value={jenisUsaha}
            galat={galat.jenisUsaha}
            bantuan={
              jenisUsaha
                ? `Contoh: ${LABEL_JENIS_USAHA[jenisUsaha].contoh}.`
                : 'Dipakai untuk memilihkan distributor yang menjual barang untuk usahamu.'
            }
            onChange={(e) => {
              setJenisUsaha(e.target.value as JenisUsaha | '')
              setGalat((g) => ({ ...g, jenisUsaha: undefined }))
            }}
          >
            <option value="" disabled>
              Pilih jenis usaha
            </option>
            {URUTAN_JENIS_USAHA.map((j) => (
              <option key={j} value={j}>
                {LABEL_JENIS_USAHA[j].judul}
              </option>
            ))}
          </Pilihan>

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
          </div>

          <Pilihan
            label="Kota atau Kabupaten"
            wajib
            value={kota}
            galat={galat.kota}
            bantuan="Saran distributor mencocokkan wilayah ini dengan area kirimnya. Di purwarupa ini distributor mengirim ke empat wilayah ini."
            onChange={(e) => {
              setKota(e.target.value)
              setGalat((g) => ({ ...g, kota: undefined }))
            }}
          >
            <option value="" disabled>
              Pilih wilayah
            </option>
            {DAFTAR_KOTA.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Pilihan>

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
            wajib
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="halo@kopikita.id"
            value={email}
            galat={galat.email}
            bantuan="Dipakai untuk masuk ke akunmu."
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <section className="mt-6" aria-labelledby="judul-jualan">
          <h2 id="judul-jualan" className="text-[1rem] font-bold text-ink">
            Apa yang kamu jual?
          </h2>
          <p className="mt-1 text-isi text-ink-3 leading-relaxed">
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
            <p id="galat-jualan" className="mt-2 text-isi text-kritis font-medium leading-snug">
              {galat.cara}
            </p>
          )}
        </section>

        {galatUmum && (
          <Peringatan nada="kritis" judul="Akun belum bisa dibuat" className="mt-5">
            {galatUmum}
          </Peringatan>
        )}

        <div className="sticky bottom-0 mt-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-4 bg-surface/95 backdrop-blur-sm border-t border-line rounded-b-lg">
          <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
            {memuat ? 'Sedang membuat akun' : sudahAkun ? 'Simpan dan Lanjut' : 'Buat Akun dan Lanjut'}
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

