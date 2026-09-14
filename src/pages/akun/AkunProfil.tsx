import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { AreaTeks, Kolom } from '@/components/ui/formulir'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonCentang,
  IkonCentangLingkaran,
  IkonJam,
  IkonMata,
  IkonPeringatan,
} from '@/icons'
import { cx, inisial, tanggalPanjang } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pilihan warna papan nama. Nilainya milik data usaha, jadi boleh berupa hex
 * dan dipasang lewat atribut style. Namanya ikut disimpan supaya pembaca layar
 * mendengar "Hijau tosca", bukan deretan kode warna.
 */
const WARNA_USAHA = [
  { nilai: '#0f766e', nama: 'Hijau tosca' },
  { nilai: '#166534', nama: 'Hijau daun' },
  { nilai: '#1d4ed8', nama: 'Biru' },
  { nilai: '#4a3aa7', nama: 'Ungu' },
  { nilai: '#9a3412', nama: 'Cokelat bata' },
  { nilai: '#b45309', nama: 'Oranye' },
  { nilai: '#be123c', nama: 'Merah' },
  { nilai: '#0e7490', nama: 'Biru laut' },
]

const MAKS_BIO = 160

/**
 * Satu layar untuk dua hal yang di kepala pengguna memang satu: "bagaimana
 * akunku sekarang" dan "apa yang orang lihat tentang usahaku".
 *
 * Layar status verifikasi terpisah sengaja tidak dibuat. Banner di Beranda
 * butuh tujuan, dan tujuan terbaiknya adalah tempat yang juga menyediakan
 * tombol perbaikannya.
 */
export default function AkunProfil() {
  const profil = useAplikasi((s) => s.profil)
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [namaUsaha, setNamaUsaha] = useState(profil.namaUsaha)
  const [jenisUsaha, setJenisUsaha] = useState(profil.jenisUsaha)
  const [bio, setBio] = useState(profil.bio)
  const [alamat, setAlamat] = useState(profil.alamat)
  const [kota, setKota] = useState(profil.kota)
  const [nomor, setNomor] = useState(profil.nomorHp)
  const [email, setEmail] = useState(profil.email)
  const [warna, setWarna] = useState(profil.warna)
  const [sudahDicoba, setSudahDicoba] = useState(false)

  const galat = useMemo(() => {
    const g: Record<string, string> = {}
    if (!namaUsaha.trim()) {
      g.nama = 'Nama usaha belum diisi. Tulis nama yang tertera di papan namamu. Contoh: Kopi Kita Jogja.'
    }
    const angkaHp = nomor.replace(/\D/g, '')
    if (!/^08\d{8,11}$/.test(angkaHp)) {
      g.nomor = 'Nomor HP harus diawali 08 dan berisi 10-13 angka. Contoh: 081234567890.'
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      g.email = 'Email belum lengkap. Tulis alamat utuh dengan tanda @ dan nama domain. Contoh: halo@kopikita.id.'
    }
    if (bio.length > MAKS_BIO) {
      g.bio = `Bio kepanjangan ${bio.length - MAKS_BIO} huruf. Potong sampai ${MAKS_BIO} huruf supaya muat di kartu distributor.`
    }
    return g
  }, [namaUsaha, nomor, email, bio])

  const berubah =
    namaUsaha !== profil.namaUsaha ||
    jenisUsaha !== profil.jenisUsaha ||
    bio !== profil.bio ||
    alamat !== profil.alamat ||
    kota !== profil.kota ||
    nomor !== profil.nomorHp ||
    email !== profil.email ||
    warna !== profil.warna

  function simpan() {
    setSudahDicoba(true)
    if (Object.keys(galat).length > 0) return
    ubahProfil({
      namaUsaha: namaUsaha.trim(),
      jenisUsaha: jenisUsaha.trim(),
      bio: bio.trim(),
      alamat: alamat.trim(),
      kota: kota.trim(),
      nomorHp: nomor.replace(/\D/g, ''),
      email: email.trim(),
      warna,
    })
    /* Racun menyebut apa yang berubah, bukan sekadar "tersimpan": setelah
       menekan Simpan yang ingin diketahui pemilik usaha adalah versi mana yang
       sekarang dilihat distributor. */
    tampilkanRacun(`Tersimpan. Distributor kini melihat ${namaUsaha.trim()} dengan data yang baru.`, 'aman')
  }

  const tampilkan = (kunci: string) => (sudahDicoba ? galat[kunci] : undefined)

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Profil Usaha" kembaliKe="/akun" />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-6">
          <BlokVerifikasi />

          {/* Kartu identitas: yang paling sering dilihat orang lain */}
          <section aria-labelledby="judul-identitas">
            <h2 id="judul-identitas" className="text-[0.9375rem] font-bold text-ink mb-3">
              Identitas Usaha
            </h2>
            <Kartu>
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  style={{ background: warna }}
                  className="size-20 rounded-lg grid place-items-center text-white font-extrabold text-[1.625rem] shrink-0 tracking-tight"
                >
                  {inisial(namaUsaha || profil.namaUsaha)}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-semibold text-ink-2">Warna papan nama</p>
                  <p className="text-[0.75rem] text-ink-3 leading-snug mt-0.5">
                    Dipakai sebagai penanda usahamu di daftar distributor.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WARNA_USAHA.map((w) => (
                      <button
                        key={w.nilai}
                        type="button"
                        aria-label={`Pakai warna ${w.nama}`}
                        aria-pressed={warna === w.nilai}
                        onClick={() => setWarna(w.nilai)}
                        style={{ background: w.nilai }}
                        className={cx(
                          'size-11 rounded-md grid place-items-center text-white transition-transform',
                          warna === w.nilai
                            ? 'ring-2 ring-offset-2 ring-offset-surface ring-ink scale-105'
                            : 'hover:scale-105',
                        )}
                      >
                        {warna === w.nilai && <IkonCentang size={18} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Pemisah className="my-4" />

              <div className="space-y-4">
                <Kolom
                  label="Nama Usaha"
                  wajib
                  value={namaUsaha}
                  onChange={(e) => setNamaUsaha(e.target.value)}
                  galat={tampilkan('nama')}
                  bantuan="Tulis seperti yang tertera di papan nama atau spanduk."
                />
                <Kolom
                  label="Jenis Usaha"
                  wajib
                  value={jenisUsaha}
                  onChange={(e) => setJenisUsaha(e.target.value)}
                  bantuan="Contoh: Kedai kopi & camilan, Warung makan, Toko kelontong."
                />
                <div>
                  <AreaTeks
                    label="Bio"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    galat={tampilkan('bio')}
                    bantuan="Satu atau dua kalimat tentang usahamu. Ini yang dibaca distributor sebelum menerima pesanan."
                  />
                  <p
                    className={cx(
                      'mt-1 text-right text-[0.75rem] tabular',
                      bio.length > MAKS_BIO ? 'text-kritis font-semibold' : 'text-ink-3',
                    )}
                  >
                    {bio.length} / {MAKS_BIO} huruf
                  </p>
                </div>
              </div>
            </Kartu>
          </section>

          {/* Kontak */}
          <section aria-labelledby="judul-kontak">
            <h2 id="judul-kontak" className="text-[0.9375rem] font-bold text-ink mb-3">
              Alamat & Kontak
            </h2>
            <Kartu>
              <div className="space-y-4">
                <Kolom
                  label="Alamat Usaha"
                  wajib
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  bantuan="Alamat tempat barang diantar."
                />
                <Kolom
                  label="Kota / Kabupaten"
                  wajib
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  bantuan="Bagian ini selalu terlihat oleh distributor supaya mereka tahu area kirimnya."
                />
                <Kolom
                  label="Nomor HP"
                  wajib
                  inputMode="numeric"
                  value={nomor}
                  onChange={(e) => setNomor(e.target.value)}
                  galat={tampilkan('nomor')}
                  bantuan="Nomor yang kami hubungi lewat WhatsApp untuk kabar verifikasi dan pesanan."
                />
                <Kolom
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  galat={tampilkan('email')}
                  bantuan="Dipakai untuk mengirim salinan nota pesanan."
                />
              </div>
            </Kartu>
          </section>
        </div>

        {/* Privasi: keputusan yang paling sering disesali kalau salah, jadi
            konsekuensinya ditulis di sebelah sakelarnya, bukan di halaman bantuan. */}
        <div className="lg:col-span-5 mt-6 lg:mt-0">
          <section aria-labelledby="judul-dilihat">
            <h2 id="judul-dilihat" className="text-[0.9375rem] font-bold text-ink mb-3">
              Yang Dilihat Distributor
            </h2>
            <Kartu>
              <p className="text-[0.8125rem] text-ink-2 leading-relaxed">
                Nama usaha, jenis usaha, kota, bio, dan lencana verifikasi <strong>selalu terlihat</strong> oleh
                semua distributor. Dua hal di bawah ini kamu yang menentukan.
              </p>

              <div className="mt-3 space-y-1 divide-y divide-line">
                <SakelarPrivasi
                  aktif={profil.tampilkanAlamatKeDistributor}
                  ubah={(v) => {
                    ubahProfil({ tampilkanAlamatKeDistributor: v })
                    tampilkanRacun(
                      v ? 'Alamat lengkap kini terlihat oleh semua distributor.' : 'Alamat lengkap disembunyikan.',
                      'info',
                    )
                  }}
                  label="Alamat lengkap"
                  keteranganAktif="Semua distributor bisa melihat alamat lengkapmu, termasuk yang belum pernah kamu pesan."
                  keteranganMati="Meski disembunyikan, barang tetap bisa dikirim — alamat otomatis terbuka begitu kamu membuat pesanan."
                />
                <SakelarPrivasi
                  aktif={profil.tampilkanNomorHpKeDistributor}
                  ubah={(v) => {
                    ubahProfil({ tampilkanNomorHpKeDistributor: v })
                    tampilkanRacun(
                      v ? 'Nomor HP kini terlihat oleh semua distributor.' : 'Nomor HP disembunyikan.',
                      'info',
                    )
                  }}
                  label="Nomor HP"
                  keteranganAktif="Distributor mana pun bisa menghubungimu langsung, termasuk untuk menawarkan barang."
                  keteranganMati="Kurir tetap bisa menghubungimu saat mengantar — nomormu otomatis terbuka begitu kamu membuat pesanan."
                />
              </div>

              <Pemisah className="my-4" />

              <TombolTautan ke="/akun/profil/pratinjau" ragam="garis" penuh ikonKiri={<IkonMata size={17} />}>
                Lihat sebagai Distributor
              </TombolTautan>
            </Kartu>

            <p className="mt-3 text-[0.75rem] text-ink-3 leading-relaxed">
              Bergabung sejak {tanggalPanjang(profil.bergabungSejak)}. Data usaha dan legalitas diatur terpisah di{' '}
              <Link to="/akun/data-usaha" className="font-semibold text-brand hover:underline">
                Data Usaha &amp; Legalitas
              </Link>
              .
            </p>
          </section>
        </div>
      </div>

      {berubah && (
        <BilahAksi
          ringkasan={
            sudahDicoba && Object.keys(galat).length > 0 ? (
              <p className="text-[0.8125rem] font-semibold text-kritis">
                Masih ada isian yang perlu dibetulkan di atas.
              </p>
            ) : (
              <p className="text-[0.8125rem] text-ink-3">Perubahan belum tersimpan.</p>
            )
          }
        >
          <Tombol penuh ukuran="besar" onClick={simpan}>
            Simpan Perubahan
          </Tombol>
        </BilahAksi>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Blok status verifikasi                                              */
/* ------------------------------------------------------------------ */

/**
 * Tiga keadaan, satu blok. Keadaan merah selalu membawa daftar alasannya dan
 * tombol menuju kolom yang harus dibetulkan, karena pengguna yang ditolak
 * tanpa tahu apa yang salah akan berhenti mencoba.
 */
function BlokVerifikasi() {
  const profil = useAplikasi((s) => s.profil)

  if (profil.verifikasi === 'terverifikasi') {
    return (
      <section aria-label="Status verifikasi">
        <Peringatan
          nada="aman"
          judul={profil.tingkatVerifikasi === 'penuh' ? 'Akun terverifikasi' : 'Akun terverifikasi dasar'}
        >
          {profil.tingkatVerifikasi === 'penuh' ? (
            <>
              Data usahamu sudah diperiksa. Kamu bisa mengajukan kontrak dan membuat pesanan tanpa batasan.
            </>
          ) : (
            <>
              Data usahamu sudah diperiksa memakai foto tempat usaha. Menambahkan NIB akan menaikkan lencanamu jadi
              Terverifikasi penuh dan membuat lebih banyak distributor menerima pengajuan kontrak.
            </>
          )}
          <div className="mt-2.5">
            <GarisWaktu langkahAktif={3} gagal={false} />
          </div>
        </Peringatan>
      </section>
    )
  }

  if (profil.verifikasi === 'menunggu') {
    return (
      <section aria-label="Status verifikasi">
        <Peringatan nada="menipis" judul="Akun sedang diperiksa">
          Kami kabari lewat WhatsApp begitu selesai. Sementara ini kamu tetap bisa memakai semua fitur kecuali
          mengajukan kontrak dan membuat pesanan.
          <div className="mt-2.5">
            <GarisWaktu langkahAktif={2} gagal={false} />
          </div>
        </Peringatan>
      </section>
    )
  }

  return (
    <section aria-label="Status verifikasi">
      <Peringatan
        nada="kritis"
        judul="Data usaha perlu diperbaiki"
        aksi={
          <TombolTautan ke="/akun/data-usaha" ragam="garis" ukuran="kecil">
            Perbaiki dan Kirim Ulang
          </TombolTautan>
        }
      >
        Pemeriksaan berhenti karena hal berikut:
        <ul className="mt-1.5 space-y-1 list-disc pl-4">
          {profil.alasanPerbaikan.length > 0 ? (
            profil.alasanPerbaikan.map((a) => <li key={a}>{a}</li>)
          ) : (
            <li>Ada data usaha yang belum cocok dengan dokumen yang kamu kirim.</li>
          )}
        </ul>
        <div className="mt-2.5">
          <GarisWaktu langkahAktif={3} gagal />
        </div>
      </Peringatan>
    </section>
  )
}

function GarisWaktu({ langkahAktif, gagal }: { langkahAktif: 1 | 2 | 3; gagal: boolean }) {
  const langkah = [
    { nomor: 1 as const, label: 'Dikirim' },
    { nomor: 2 as const, label: 'Diperiksa' },
    { nomor: 3 as const, label: gagal ? 'Perlu diperbaiki' : 'Selesai' },
  ]
  return (
    <ol className="flex items-center gap-1.5">
      {langkah.map((l, i) => {
        const selesai = l.nomor < langkahAktif || (l.nomor === langkahAktif && !gagal && langkahAktif === 3)
        const berjalan = l.nomor === langkahAktif && !selesai
        const merah = gagal && l.nomor === 3
        return (
          <li key={l.nomor} className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx(
                  'size-5 rounded-full grid place-items-center shrink-0',
                  /* text-ink-inverse, bukan text-white: di tema gelap warna
                     status justru jadi terang, dan ikon putih di atasnya hilang. */
                  merah
                    ? 'bg-kritis text-ink-inverse'
                    : selesai
                      ? 'bg-aman text-ink-inverse'
                      : berjalan
                        ? 'bg-menipis text-ink-inverse'
                        : 'bg-current opacity-20',
                )}
              >
                {merah ? (
                  <IkonPeringatan size={12} />
                ) : selesai ? (
                  <IkonCentangLingkaran size={12} />
                ) : berjalan ? (
                  <IkonJam size={12} />
                ) : null}
              </span>
              <span className="text-[0.75rem] font-semibold whitespace-nowrap">{l.label}</span>
            </span>
            {i < langkah.length - 1 && (
              <span className="h-px w-4 sm:w-6 bg-current opacity-30 shrink-0" aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Dua pilihan saja, keduanya terbaca sekaligus.
 *
 * Sakelar hidup/mati dipakai lebih dulu lalu diganti: dengan sakelar, pengguna
 * hanya melihat satu keadaan dan harus menebak arti keadaan lawannya. Di sini
 * kedua kemungkinan tertulis lengkap, dan akibat dari yang sedang aktif
 * dijelaskan tepat di bawahnya.
 */
function SakelarPrivasi({
  aktif,
  ubah,
  label,
  keteranganAktif,
  keteranganMati,
}: {
  aktif: boolean
  ubah: (v: boolean) => void
  label: string
  keteranganAktif: string
  keteranganMati: string
}) {
  const pilihan = [
    { nilai: false, teks: 'Terbuka setelah saya memesan' },
    { nilai: true, teks: 'Terbuka untuk semua distributor' },
  ]
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.9375rem] font-semibold text-ink">{label}</p>
        <Lencana nada={aktif ? 'info' : 'netral'}>{aktif ? 'Terbuka' : 'Tertutup'}</Lencana>
      </div>
      <div role="group" aria-label={`Siapa yang boleh melihat ${label.toLowerCase()}`} className="mt-2 flex gap-2">
        {pilihan.map((p) => (
          <button
            key={String(p.nilai)}
            type="button"
            aria-pressed={aktif === p.nilai}
            onClick={() => aktif !== p.nilai && ubah(p.nilai)}
            className={cx(
              'flex-1 min-h-11 px-3 py-2 rounded-md border-2 text-[0.8125rem] font-semibold leading-snug text-left',
              'transition-[border-color,background-color] duration-150',
              aktif === p.nilai
                ? 'border-brand bg-brand-soft text-brand-soft-ink'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
            )}
          >
            <span className="flex items-start gap-1.5">
              <span className="shrink-0 mt-px" aria-hidden="true">
                {aktif === p.nilai ? <IkonCentang size={14} strokeWidth={3} /> : <span className="block size-3.5" />}
              </span>
              {p.teks}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">
        {aktif ? keteranganAktif : keteranganMati}
      </p>
    </div>
  )
}
