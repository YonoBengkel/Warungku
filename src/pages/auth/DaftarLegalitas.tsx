import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lencana, Tombol } from '@/components/ui/dasar'
import { Kolom, KotakCentang } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { IkonBantuan, IkonCentangLingkaran, IkonKembali, IkonSampah, IkonUnggah } from '@/icons'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Langkah 3 dari 5: data legalitas, lalu langsung diantar ke sumber data penjualan.
 *
 * Tidak ada layar "Pendaftaran Berhasil" di antaranya. Layar seperti itu cuma
 * menambah satu ketukan tanpa memberi informasi baru; kalimat "akun sedang
 * diperiksa" justru harus hidup berhari-hari, jadi tempatnya di banner Beranda.
 *
 * Usaha tanpa NIB tidak dibuang. Ia masuk lewat foto tampak depan tempat usaha
 * dan mendapat lencana Terverifikasi Dasar, karena mayoritas warung memang
 * belum pernah mendaftar ke OSS dan menolak mereka berarti menolak pasarnya.
 */
export default function DaftarLegalitas() {
  const navigate = useNavigate()
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [nib, setNib] = useState('')
  const [npwp, setNpwp] = useState('')
  const [belumPunyaNib, setBelumPunyaNib] = useState(false)
  const [foto, setFoto] = useState<{ nama: string; url: string } | null>(null)
  const [bukaBantuan, setBukaBantuan] = useState(false)
  const [galat, setGalat] = useState<{ nib?: string; npwp?: string; foto?: string }>({})
  const [memuat, setMemuat] = useState(false)
  const [percobaanGagal, setPercobaanGagal] = useState(0)
  const berkasRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (percobaanGagal > 0) sorotGalatPertama()
  }, [percobaanGagal])

  /* Pratinjau foto memakai alamat objek sementara. Alamatnya disimpan di ref,
     bukan disandarkan pada keadaan, supaya yang dilepas selalu alamat lama
     persis satu kali walau pengguna berganti foto berkali-kali. */
  const alamatFotoRef = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (alamatFotoRef.current) URL.revokeObjectURL(alamatFotoRef.current)
    }
  }, [])

  function lepasAlamatFoto() {
    if (alamatFotoRef.current) URL.revokeObjectURL(alamatFotoRef.current)
    alamatFotoRef.current = null
  }

  function pilihFoto(berkas: File | null | undefined) {
    if (!berkas) return
    lepasAlamatFoto()
    const url = URL.createObjectURL(berkas)
    alamatFotoRef.current = url
    setFoto({ nama: berkas.name, url })
    setGalat((g) => ({ ...g, foto: undefined }))
  }

  function hapusFoto() {
    lepasAlamatFoto()
    setFoto(null)
    if (berkasRef.current) berkasRef.current.value = ''
  }

  function periksa(): boolean {
    const baru: typeof galat = {}
    if (belumPunyaNib) {
      if (!foto) {
        baru.foto =
          'Foto tempat usaha belum ada. Ambil satu foto tampak depan warung dari seberang jalan supaya papan namanya ikut terlihat. Contoh: foto warung beserta spanduknya di siang hari.'
      }
    } else {
      const d = nib.replace(/\D/g, '')
      if (d.length === 0) {
        baru.nib =
          'NIB belum diisi. Salin 13 angka dari lembar NIB kamu, atau centang kotak di bawah kalau usahamu belum punya. Contoh: 1204250031298.'
      } else if (d.length !== 13) {
        baru.nib = `NIB harus tepat 13 angka, sekarang baru ${d.length}. Periksa lagi lembar NIB kamu. Contoh: 1204250031298.`
      }
    }
    const n = npwp.replace(/\D/g, '')
    if (n.length > 0 && n.length !== 15 && n.length !== 16) {
      baru.npwp = `NPWP berisi 15 atau 16 angka, sekarang ${n.length}. Salin ulang angkanya tanpa titik dan strip, atau kosongkan saja. Contoh: 0123456789012000.`
    }
    setGalat(baru)
    if (Object.keys(baru).length > 0) {
      setPercobaanGagal((n) => n + 1)
      return false
    }
    return true
  }

  function simpan() {
    if (!periksa()) return
    setMemuat(true)
    window.setTimeout(() => {
      setMemuat(false)
      ubahProfil({
        nib: belumPunyaNib ? '' : nib.replace(/\D/g, ''),
        npwp: npwp.replace(/\D/g, ''),
        verifikasi: 'menunggu',
        tingkatVerifikasi: belumPunyaNib ? 'dasar' : 'penuh',
      })
      tampilkanRacun('Data legalitas tersimpan. Kami kabari lewat WhatsApp begitu pemeriksaan selesai.', 'aman')
      navigate('/akun/kasir?langkah=mulai')
    }, 700)
  }

  function isiNanti() {
    /* Tetap menandai akun menunggu pemeriksaan: banner Beranda-lah yang nanti
       mengingatkan, bukan layar ini yang menahan pengguna di sini. */
    ubahProfil({ verifikasi: 'menunggu', tingkatVerifikasi: 'dasar' })
    tampilkanRacun('Data legalitas bisa dilengkapi kapan saja dari Akun, menu Data Usaha.', 'info')
    navigate('/akun/kasir?langkah=mulai')
  }

  return (
    <LayarAuth langkah={3} judul="Data Legalitas" kembaliKe="/daftar/usaha">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          simpan()
        }}
      >
        <p className="text-[0.875rem] text-ink-3 leading-relaxed">
          Data ini yang diperiksa sebelum kamu bisa mengajukan kontrak dan membuat pesanan. Foto KTP tidak kami minta.
        </p>

        <div className="mt-4 space-y-4">
          {belumPunyaNib ? (
            <UnggahFoto
              foto={foto}
              galat={galat.foto}
              berkasRef={berkasRef}
              pilih={pilihFoto}
              hapus={hapusFoto}
            />
          ) : (
            <div>
              <Kolom
                label="Nomor Induk Berusaha (NIB)"
                wajib
                inputMode="numeric"
                autoComplete="off"
                maxLength={13}
                placeholder="1204250031298"
                value={nib}
                galat={galat.nib}
                bantuan="13 angka dari sistem OSS, tercetak di lembar NIB kamu."
                onChange={(e) => setNib(e.target.value.replace(/\D/g, '').slice(0, 13))}
              />
              <button
                type="button"
                onClick={() => setBukaBantuan(true)}
                className="mt-1 inline-flex items-center gap-1.5 h-11 -ml-1 px-1 text-[0.8125rem] font-bold text-brand hover:underline underline-offset-2"
              >
                <IkonBantuan size={16} />
                Di mana nomor ini?
              </button>
            </div>
          )}

          {/* Target sentuh besar: seluruh kotak ini bisa ditekan, bukan cuma kotak centangnya. */}
          <div
            className={
              belumPunyaNib
                ? 'rounded-md border-2 border-brand bg-brand-soft/40 px-3.5 py-3'
                : 'rounded-md border-2 border-line px-3.5 py-3 hover:border-line-strong transition-colors'
            }
          >
            <KotakCentang
              dicentang={belumPunyaNib}
              ubah={(v) => {
                setBelumPunyaNib(v)
                setGalat({})
              }}
            >
              <span className="block text-[0.9375rem] font-semibold text-ink leading-snug">
                Usaha saya belum punya NIB
              </span>
              <span className="block mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
                Gantinya: satu foto tampak depan tempat usaha.
              </span>
            </KotakCentang>
          </div>

          <Kolom
            label="NPWP Usaha"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            placeholder="0123456789012000"
            value={npwp}
            galat={galat.npwp}
            bantuan="Tulis angkanya saja, tanpa titik dan strip. Boleh dilewati kalau belum ada."
            onChange={(e) => setNpwp(e.target.value.replace(/\D/g, '').slice(0, 16))}
          />
        </div>

        <section className="mt-6" aria-labelledby="judul-lencana">
          <h2 id="judul-lencana" className="text-[1rem] font-bold text-ink">
            Hasilnya nanti berupa lencana
          </h2>
          <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
            Lencana ini terlihat oleh distributor saat kamu mengajukan kontrak.
          </p>

          <div className="mt-3 space-y-2.5">
            <BarisLencana
              lencana={
                <Lencana nada="aman" besar ikon={<IkonCentangLingkaran size={14} />}>
                  Terverifikasi
                </Lencana>
              }
              aktif={!belumPunyaNib}
              isi="Kamu mengisi NIB dan angkanya cocok dengan data OSS. Semua distributor, termasuk yang menetapkan syarat legalitas, bisa menerima pengajuan kontrak kamu."
            />
            <BarisLencana
              lencana={
                <Lencana nada="netral" besar>
                  Terverifikasi Dasar
                </Lencana>
              }
              aktif={belumPunyaNib}
              isi="Tempat usaha kamu terbukti nyata lewat foto. Kamu tetap bisa memesan dan berkontrak dengan sebagian besar distributor; sebagian kecil mensyaratkan NIB."
            />
          </div>
        </section>

        <p className="mt-5 text-[0.8125rem] text-ink-3 leading-relaxed">
          Selama menunggu pemeriksaan, stok, perkiraan, dan penjelajahan katalog tetap jalan penuh.
        </p>

        <div className="sticky bottom-0 mt-4 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-3 pb-4 bg-surface/95 backdrop-blur-sm border-t border-line rounded-b-lg space-y-2">
          <Tombol type="submit" penuh ukuran="besar" memuat={memuat}>
            {memuat ? 'Sedang menyimpan' : 'Simpan & Lanjut ke Data Kasir'}
          </Tombol>
          {/* "Isi nanti" wajib terlihat sebagai tombol, bukan tautan kecil. */}
          <Tombol penuh ragam="garis" onClick={isiNanti}>
            Isi nanti
          </Tombol>
        </div>
      </form>

      <Lembar
        terbuka={bukaBantuan}
        tutup={() => setBukaBantuan(false)}
        judul="Di mana nomor NIB?"
        keterangan="Nomornya tercetak di bagian atas lembar NIB dari sistem OSS."
        lebar="sempit"
        kaki={
          <Tombol penuh onClick={() => setBukaBantuan(false)}>
            Mengerti
          </Tombol>
        }
      >
        <div className="pb-4">
          <GambarLembarNib />
          <ol className="mt-4 space-y-2 text-[0.875rem] text-ink-2 leading-relaxed list-decimal pl-5">
            <li>Buka lembar NIB yang kamu terima dari OSS, bentuknya PDF atau cetakan.</li>
            <li>Cari baris berlabel &ldquo;Nomor Induk Berusaha&rdquo; di bagian atas, tepat di bawah judul.</li>
            <li>Salin 13 angkanya, tanpa spasi dan tanpa titik.</li>
          </ol>
          <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
            Lembarnya hilang? Nomor yang sama bisa dilihat lagi dengan masuk ke akun OSS kamu. Kalau memang belum
            pernah mendaftar, centang &ldquo;Usaha saya belum punya NIB&rdquo; dan lanjut pakai foto.
          </p>
        </div>
      </Lembar>
    </LayarAuth>
  )
}

/* ================================================================== */
/* Bagian yang hanya dipakai layar ini                                */
/* ================================================================== */

/**
 * Kolom atau kotak unggah pertama yang salah dibawa ke layar. Isian NIB berada
 * di atas, tapi pesan soal foto muncul di tengah halaman yang panjang, jadi
 * tanpa ini tombol simpan terasa tidak bereaksi.
 */
function sorotGalatPertama() {
  const sasaran = document.querySelector<HTMLElement>(
    'input[aria-invalid="true"], textarea[aria-invalid="true"], button[aria-invalid="true"]',
  )
  sasaran?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  sasaran?.focus({ preventScroll: true })
}

function BarisLencana({
  lencana,
  isi,
  aktif,
}: {
  lencana: ReactNode
  isi: string
  aktif: boolean
}) {
  return (
    <div
      className={
        aktif
          ? 'rounded-md border-2 border-line-strong bg-surface-2 p-3.5'
          : 'rounded-md border-2 border-line bg-surface p-3.5'
      }
    >
      <div className="flex items-center gap-2">
        {lencana}
        {aktif && <span className="text-[0.75rem] font-semibold text-ink-2">&larr; pilihan kamu sekarang</span>}
      </div>
      <p className="mt-1.5 text-[0.8125rem] text-ink-2 leading-relaxed">{isi}</p>
    </div>
  )
}

function UnggahFoto({
  foto,
  galat,
  berkasRef,
  pilih,
  hapus,
}: {
  foto: { nama: string; url: string } | null
  galat?: string
  berkasRef: RefObject<HTMLInputElement | null>
  pilih: (b: File | null | undefined) => void
  hapus: () => void
}) {
  return (
    <div>
      <p className="block text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
        Foto Tampak Depan Tempat Usaha
        <span className="text-kritis ml-0.5" aria-hidden="true">
          *
        </span>
      </p>

      <input
        ref={berkasRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Pilih foto tampak depan tempat usaha"
        onChange={(e) => pilih(e.target.files?.[0])}
      />

      {foto ? (
        <div className="rounded-md border border-line-strong bg-surface-2 p-3">
          <img
            src={foto.url}
            alt={`Pratinjau foto tempat usaha: ${foto.nama}`}
            className="w-full h-44 object-cover rounded-sm bg-sunken"
          />
          <p className="mt-2 text-[0.8125rem] text-ink-3 truncate">{foto.nama}</p>
          <div className="mt-2.5 flex gap-2.5">
            <Tombol ragam="garis" onClick={() => berkasRef.current?.click()}>
              Ganti foto
            </Tombol>
            <Tombol ragam="sunyi" ikonKiri={<IkonSampah size={16} />} onClick={hapus}>
              Hapus
            </Tombol>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => berkasRef.current?.click()}
          aria-invalid={galat ? true : undefined}
          aria-describedby="bantuan-foto-usaha"
          className={
            galat
              ? 'w-full rounded-md border-2 border-dashed border-kritis bg-surface p-6 text-center'
              : 'w-full rounded-md border-2 border-dashed border-line-strong bg-surface p-6 text-center hover:border-brand hover:bg-brand-soft/30 transition-colors'
          }
        >
          <span className="size-12 rounded-xl bg-sunken text-ink-3 grid place-items-center mx-auto">
            <IkonUnggah size={22} />
          </span>
          <span className="mt-3 block text-[0.9375rem] font-bold text-ink">Ambil atau pilih satu foto</span>
          <span className="mt-1 block text-[0.8125rem] text-ink-3 leading-relaxed">
            Tampak depan warung dari seberang jalan, papan namanya ikut kelihatan.
          </span>
        </button>
      )}

      {galat ? (
        <p id="bantuan-foto-usaha" className="mt-1.5 text-[0.8125rem] text-kritis font-medium leading-snug">
          {galat}
        </p>
      ) : (
        <p id="bantuan-foto-usaha" className="mt-1.5 text-[0.8125rem] text-ink-2 leading-snug">
          Cukup satu foto. Tidak perlu surat izin apa pun.
        </p>
      )}
    </div>
  )
}

/**
 * Ilustrasi buatan sendiri, bukan gambar dari luar: bentuknya cukup menjelaskan
 * posisi nomor tanpa membawa berkas gambar yang berat di jaringan lambat.
 */
function GambarLembarNib() {
  return (
    <svg
      viewBox="0 0 320 216"
      className="w-full h-auto rounded-md border border-line bg-surface-2"
      role="img"
      aria-label="Gambaran lembar NIB. Nomor 13 angka berada di bagian atas lembar, tepat di bawah judul, disorot dengan kotak."
    >
      {/* Lembar kertas */}
      <rect x="28" y="12" width="264" height="192" rx="8" fill="var(--c-surface)" stroke="var(--c-border-strong)" />

      {/* Kepala dokumen */}
      <rect x="44" y="26" width="18" height="18" rx="4" fill="var(--c-brand-soft)" />
      <rect x="70" y="28" width="112" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.55" />
      <rect x="70" y="38" width="76" height="5" rx="2.5" fill="var(--c-ink-3)" opacity="0.3" />
      <line x1="44" y1="56" x2="276" y2="56" stroke="var(--c-border)" />

      {/* Judul dokumen */}
      <rect x="96" y="66" width="128" height="7" rx="3.5" fill="var(--c-ink-3)" opacity="0.55" />

      {/* Sorotan posisi nomor */}
      <rect
        x="40"
        y="84"
        width="240"
        height="42"
        rx="7"
        fill="var(--c-menipis-soft)"
        stroke="var(--c-menipis)"
        strokeWidth="2"
      />
      <text x="52" y="101" fontSize="9" fontWeight="700" fill="var(--c-menipis-ink)">
        Nomor Induk Berusaha
      </text>
      <text x="52" y="119" fontSize="15" fontWeight="800" fill="var(--c-ink)" letterSpacing="1.6">
        1204250031298
      </text>

      {/* Penunjuk dari luar lembar */}
      <path
        d="M300 74 C 300 96, 292 104, 284 105"
        fill="none"
        stroke="var(--c-menipis)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M290 99 l-7 6 8 4" fill="none" stroke="var(--c-menipis)" strokeWidth="2" strokeLinecap="round" />
      <text x="248" y="68" fontSize="9" fontWeight="700" fill="var(--c-menipis-ink)">
        13 angka
      </text>

      {/* Sisa isi dokumen */}
      <rect x="44" y="142" width="80" height="5" rx="2.5" fill="var(--c-ink-3)" opacity="0.3" />
      <rect x="44" y="154" width="188" height="5" rx="2.5" fill="var(--c-ink-3)" opacity="0.22" />
      <rect x="44" y="166" width="164" height="5" rx="2.5" fill="var(--c-ink-3)" opacity="0.22" />
      <rect x="44" y="178" width="120" height="5" rx="2.5" fill="var(--c-ink-3)" opacity="0.22" />
    </svg>
  )
}

/**
 * Penyebut progres dikunci ke 5, sama dengan dua layar pendaftaran sebelumnya.
 * Layar ini bukan yang terakhir: sesudahnya masih ada data kasir dan batas
 * aman, jadi "3 dari 3" akan membuat bilah progres penuh lalu mundur lagi.
 */
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
              aria-valuemax={5}
              aria-label={`Langkah ${langkah} dari 5`}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${(langkah / 5) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">{judul}</h1>
              <span className="text-[0.8125rem] font-semibold text-ink-3 shrink-0">Langkah {langkah} dari 5</span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
