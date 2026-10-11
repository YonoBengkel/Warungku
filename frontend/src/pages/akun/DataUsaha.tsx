import { useMemo, useState, type ComponentProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { Kartu, Lencana, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { Peringatan } from '@/components/ui/umpanBalik'
import { IkonInfo, IkonPeringatan } from '@/icons'
import { cx } from '@/lib/format'
import type { StatusVerifikasi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

type KunciKolom = 'nib' | 'npwp' | 'namaPemilik' | 'alamat'

/** Kata kunci yang dipakai mencocokkan alasan Admin ke kolom yang harus disorot. */
const PETUNJUK: Record<KunciKolom, string[]> = {
  nib: ['nib', 'induk berusaha', 'oss'],
  npwp: ['npwp', 'pajak'],
  namaPemilik: ['pemilik', 'nama di ktp', 'penanggung jawab'],
  alamat: ['alamat', 'lokasi', 'domisili'],
}

/** Contoh alasan penolakan untuk alat uji. Di produksi ini datang dari Admin. */
const CONTOH_ALASAN = [
  'Nomor NIB tidak cocok dengan data OSS. Pastikan 13 angkanya sama persis dengan yang tercetak di lembar NIB.',
  'Alamat usaha di formulir berbeda dengan alamat pada lembar NIB. Tulis alamat yang sama dengan dokumen.',
]

const URUTAN_KOLOM: KunciKolom[] = ['nib', 'npwp', 'namaPemilik', 'alamat']

/**
 * Satu alasan hanya boleh menyorot SATU kolom.
 *
 * Kalimat Admin sering menyebut dua hal sekaligus ("Alamat usaha berbeda dengan
 * alamat pada lembar NIB"). Kalau setiap kata kunci dihitung, kolom NIB ikut
 * merah padahal yang salah alamatnya. Karena subjek kalimat hampir selalu
 * disebut lebih dulu, kata kunci yang muncul PALING AWAL yang menentukan.
 */
function kolomUntukAlasan(alasan: string): KunciKolom | null {
  const teks = alasan.toLowerCase()
  let terbaik: { kolom: KunciKolom; posisi: number } | null = null
  for (const kolom of URUTAN_KOLOM) {
    for (const kunci of PETUNJUK[kolom]) {
      const posisi = teks.indexOf(kunci)
      if (posisi >= 0 && (terbaik === null || posisi < terbaik.posisi)) terbaik = { kolom, posisi }
    }
  }
  return terbaik === null ? null : terbaik.kolom
}

/**
 * Layar perbaikan, bukan layar pendaftaran ulang.
 *
 * Karena itu saat Admin menolak, yang disorot HANYA kolom yang disebut di
 * alasan penolakan. Menyorot semuanya membuat pengguna mengulang dari nol dan
 * mengirim ulang kesalahan yang sama.
 */
export default function DataUsaha() {
  const navigate = useNavigate()
  const profil = useAplikasi((s) => s.profil)
  const ubahProfil = useAplikasi((s) => s.ubahProfil)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [nib, setNib] = useState(profil.nib)
  const [npwp, setNpwp] = useState(profil.npwp)
  const [namaPemilik, setNamaPemilik] = useState(profil.namaPemilik)
  const [alamat, setAlamat] = useState(profil.alamat)
  const [sudahDicoba, setSudahDicoba] = useState(false)

  const perluDiperbaiki = profil.verifikasi === 'perlu-diperbaiki'
  const alasan = profil.alasanPerbaikan

  const ditolak = useMemo<Partial<Record<KunciKolom, string[]>>>(() => {
    if (!perluDiperbaiki) return {}
    const hasil: Partial<Record<KunciKolom, string[]>> = {}
    for (const a of alasan) {
      const kolom = kolomUntukAlasan(a)
      if (!kolom) continue
      hasil[kolom] = [...(hasil[kolom] ?? []), a]
    }
    return hasil
  }, [perluDiperbaiki, alasan])

  const galat = useMemo(() => {
    const g: Partial<Record<KunciKolom, string>> = {}
    const angkaNib = nib.replace(/\D/g, '')
    if (angkaNib.length !== 13) {
      g.nib =
        'Nomor Induk Berusaha berisi 13 angka tanpa spasi. Salin ulang dari lembar NIB sistem OSS. Contoh: 1204250031298.'
    }
    const angkaNpwp = npwp.replace(/\D/g, '')
    if (npwp.trim() && angkaNpwp.length !== 15 && angkaNpwp.length !== 16) {
      g.npwp =
        'NPWP usaha berisi 15 atau 16 angka. Ketik angkanya saja tanpa titik, strip, atau spasi. Contoh: 091234567890000.'
    }
    if (namaPemilik.trim().length < 3) {
      g.namaPemilik =
        'Nama pemilik belum diisi lengkap. Tulis nama sesuai KTP penanggung jawab usaha. Contoh: Bagas Prasetyo.'
    }
    if (alamat.trim().length < 10) {
      g.alamat =
        'Alamat usaha masih terlalu pendek. Tulis jalan, nomor, dan kelurahan seperti di lembar NIB. Contoh: Jl. Kaliurang KM 5,6 No. 24, Sinduadi, Mlati.'
    }
    return g
  }, [nib, npwp, namaPemilik, alamat])

  const adaGalat = Object.keys(galat).length > 0
  const adaSorotan = Object.keys(ditolak).length > 0

  const berubah =
    nib !== profil.nib ||
    npwp !== profil.npwp ||
    namaPemilik !== profil.namaPemilik ||
    alamat !== profil.alamat

  /* Mengirim ulang tanpa mengubah apa pun akan menurunkan lencana yang sudah
     terverifikasi jadi "sedang diperiksa" — kerugian murni. Jadi tombolnya mati
     selama belum ada yang dibetulkan, kecuali memang sedang ditolak. */
  const bolehKirim = berubah || perluDiperbaiki

  function kirimUlang() {
    setSudahDicoba(true)
    if (adaGalat) return
    ubahProfil({
      nib: nib.replace(/\D/g, ''),
      npwp: npwp.replace(/\D/g, ''),
      namaPemilik: namaPemilik.trim(),
      alamat: alamat.trim(),
      verifikasi: 'menunggu',
      alasanPerbaikan: [],
    })
    tampilkanRacun('Data usaha terkirim. Kami kabari lewat WhatsApp begitu pemeriksaan selesai.', 'info')
    navigate('/akun/profil')
  }

  /* Alat uji: memindahkan keadaan verifikasi tanpa menunggu Admin sungguhan. */
  function ujiKeadaan(v: StatusVerifikasi) {
    ubahProfil({
      verifikasi: v,
      alasanPerbaikan: v === 'perlu-diperbaiki' ? CONTOH_ALASAN : [],
    })
  }

  const tampilkan = (k: KunciKolom) => (sudahDicoba ? galat[k] : undefined)

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul="Data Usaha & Legalitas"
        kembaliKe="/akun"
        keterangan="Dipakai untuk memverifikasi usahamu"
      />

      {/* Satu alur formulir: tetap satu kolom, tapi benar-benar di tengah
          supaya di layar lebar ia tidak menempel ke tepi kiri. */}
      <div className="mt-4 max-w-2xl mx-auto space-y-5">
        {perluDiperbaiki ? (
          <Peringatan nada="kritis" judul="Yang perlu kamu betulkan">
            {adaSorotan
              ? 'Pemeriksa kami menandai bagian di bawah ini. Kolom yang bermasalah diberi bingkai merah pada formulir; kolom lain tidak perlu kamu ubah.'
              : 'Pemeriksa kami menandai hal berikut. Cocokkan lagi setiap isian di bawah dengan dokumen usahamu, lalu kirim ulang.'}
            <ul className="mt-2 space-y-1 list-disc pl-4">
              {alasan.length > 0 ? (
                alasan.map((a) => <li key={a}>{a}</li>)
              ) : (
                <li>Ada data yang belum cocok dengan dokumen yang kamu kirim.</li>
              )}
            </ul>
            <p className="mt-2 font-semibold">
              Setelah dibetulkan, tekan &ldquo;Kirim Ulang untuk Diperiksa&rdquo; di bawah.
            </p>
          </Peringatan>
        ) : profil.verifikasi === 'menunggu' ? (
          <Peringatan nada="menipis" judul="Akun sedang diperiksa">
            Datamu sudah kami terima. Kamu masih boleh membetulkan isian di bawah; perubahan yang disimpan ikut
            diperiksa.
          </Peringatan>
        ) : (
          <Peringatan nada="aman" judul="Data usaha sudah diperiksa">
            Kalau kamu mengubah salah satu isian di bawah, pemeriksaan diulang dari awal dan lencana verifikasi
            sementara kembali jadi &ldquo;sedang diperiksa&rdquo;.
          </Peringatan>
        )}

        <Kartu>
          <div className="space-y-4">
            <KolomLegalitas
              label="Nomor Induk Berusaha (NIB)"
              wajib
              inputMode="numeric"
              value={nib}
              onChange={(e) => setNib(e.target.value)}
              galat={tampilkan('nib')}
              ditolak={ditolak.nib}
              bantuan="13 angka dari sistem OSS, tercetak di bagian atas lembar NIB."
            />
            <KolomLegalitas
              label="NPWP Usaha"
              inputMode="numeric"
              value={npwp}
              onChange={(e) => setNpwp(e.target.value)}
              galat={tampilkan('npwp')}
              ditolak={ditolak.npwp}
              bantuan="Mengisinya membuat distributor bisa menerbitkan faktur atas nama usahamu."
            />
            <KolomLegalitas
              label="Nama Pemilik"
              wajib
              value={namaPemilik}
              onChange={(e) => setNamaPemilik(e.target.value)}
              galat={tampilkan('namaPemilik')}
              ditolak={ditolak.namaPemilik}
              bantuan="Sesuai KTP penanggung jawab usaha."
            />
            <KolomLegalitas
              label="Alamat Usaha"
              wajib
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              galat={tampilkan('alamat')}
              ditolak={ditolak.alamat}
              bantuan="Tulis sama persis dengan alamat pada lembar NIB."
            />
          </div>

          <p className="mt-4 flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-relaxed">
            <IkonInfo size={16} className="shrink-0 mt-px" />
            Foto KTP tidak kami minta. Pemeriksaan memakai NIB dan alamat usaha saja.
          </p>
        </Kartu>

        {/* Alat uji tampilan. Diberi bingkai putus-putus dan label eksplisit
            supaya tidak pernah terbaca sebagai pengaturan akun sungguhan. */}
        <div className="rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
          <h2 className="text-[0.9375rem] font-bold text-ink">Alat uji tampilan verifikasi</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
            Hanya untuk pengembang. Tombol ini memindahkan keadaan verifikasi supaya ketiga tampilannya bisa dilihat
            tanpa menunggu pemeriksa. Tidak ada apa pun yang terkirim.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { nilai: 'terverifikasi', label: 'Terverifikasi' },
                { nilai: 'menunggu', label: 'Sedang diperiksa' },
                { nilai: 'perlu-diperbaiki', label: 'Perlu diperbaiki' },
              ] as const
            ).map((o) => (
              <button
                key={o.nilai}
                type="button"
                aria-pressed={profil.verifikasi === o.nilai}
                onClick={() => ujiKeadaan(o.nilai)}
                className={cx(
                  'h-11 px-3.5 rounded-md text-[0.8125rem] font-semibold border transition-colors',
                  profil.verifikasi === o.nilai
                    ? 'bg-ink text-ink-inverse border-ink'
                    : 'bg-surface text-ink-2 border-line-strong hover:text-ink',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          <div className="max-w-2xl mx-auto">
            {sudahDicoba && adaGalat ? (
              <p className="text-[0.8125rem] font-semibold text-kritis">
                Masih ada isian yang perlu dibetulkan di atas.
              </p>
            ) : !bolehKirim ? (
              <p className="text-[0.8125rem] text-ink-3">
                Belum ada isian yang kamu ubah. Betulkan dulu salah satunya kalau ada yang tidak cocok dengan
                dokumen usahamu.
              </p>
            ) : (
              <p className="text-[0.8125rem] text-ink-3">
                Pemeriksaan biasanya selesai dalam 1 hari kerja. Kabarnya lewat WhatsApp ke nomor di profilmu.
              </p>
            )}
          </div>
        }
      >
        <div className="max-w-2xl mx-auto">
          <Tombol penuh ukuran="besar" disabled={!bolehKirim} onClick={kirimUlang}>
            {perluDiperbaiki ? 'Kirim Ulang untuk Diperiksa' : 'Simpan dan Minta Diperiksa Ulang'}
          </Tombol>
        </div>
      </BilahAksi>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Kolom dengan sorotan alasan penolakan                               */
/* ------------------------------------------------------------------ */

function KolomLegalitas({
  ditolak,
  galat,
  ...rest
}: ComponentProps<typeof Kolom> & { ditolak?: string[] }) {
  const disorot = (ditolak?.length ?? 0) > 0
  return (
    <div
      className={cx(
        disorot && 'rounded-md border border-kritis bg-kritis-soft/40 p-3 -mx-1',
      )}
    >
      {disorot && (
        <p className="flex items-center gap-1.5 mb-2">
          <Lencana nada="kritis" ikon={<IkonPeringatan size={13} />}>
            Kolom ini ditandai pemeriksa
          </Lencana>
        </p>
      )}
      <Kolom {...rest} galat={galat} />
      {disorot && (
        <ul className="mt-2 space-y-1 text-[0.8125rem] text-kritis-ink leading-snug list-disc pl-4">
          {ditolak?.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </div>
  )
}
