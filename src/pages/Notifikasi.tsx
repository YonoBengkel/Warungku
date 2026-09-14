import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { KategoriNotifikasi, Notifikasi as TipeNotifikasi } from '@/lib/types'
import { HanyaPembacaLayar, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { BarisChip, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import {
  IkonCentangLingkaran,
  IkonInfo,
  IkonKeranjang,
  IkonKontrak,
  IkonKotak,
  IkonLonceng,
  IkonPanahKanan,
  IkonPasokan,
} from '@/icons'
import { cx, waktuLalu, waktuNanti } from '@/lib/format'
import { JUDUL, LABEL_KATEGORI_NOTIF, PESANAN_BERJALAN } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pemberitahuan: daftar persisten, bukan tumpukan yang habis dibaca.
 *
 * Aturan anti-banjir yang benar-benar terlihat di layar ini:
 * - Satu barang hanya punya satu pemberitahuan aktif. Kondisi yang memburuk
 *   memperbarui isi barisnya, bukan menambah baris baru.
 * - Begitu barangnya dipesan, barisnya turun jadi pasif: chip hijau "Sudah
 *   dipesan", tombolnya berubah jadi "Lihat pesanan".
 * - Yang sudah ditangani tidak dihapus, hanya diredupkan. Karena itu tidak ada
 *   tombol "hapus semua" di sini: menghapus riwayat menghilangkan jejak
 *   keputusan, dan pemilik usaha sering perlu menengok balik.
 * - Badge lonceng hanya menghitung yang butuh tindakan, supaya angkanya berarti.
 */

type Penyaring = 'semua' | 'stok' | 'saran-belanja' | 'pesanan' | 'kontrak'

const PENYARING: Array<{ nilai: Penyaring; label: string }> = [
  { nilai: 'semua', label: 'Semua' },
  { nilai: 'stok', label: LABEL_KATEGORI_NOTIF.stok },
  { nilai: 'saran-belanja', label: LABEL_KATEGORI_NOTIF['saran-belanja'] },
  { nilai: 'pesanan', label: LABEL_KATEGORI_NOTIF.pesanan },
  { nilai: 'kontrak', label: LABEL_KATEGORI_NOTIF.kontrak },
]

const IKON: Record<KategoriNotifikasi, ReactNode> = {
  stok: <IkonKotak size={18} />,
  'saran-belanja': <IkonKeranjang size={18} />,
  pesanan: <IkonPasokan size={18} />,
  kontrak: <IkonKontrak size={18} />,
  sistem: <IkonInfo size={18} />,
}

/** Warna ikon mengikuti kategori, tapi status tidak pernah hanya warna:
    judul, detail, dan tombolnya selalu menyebutkan sendiri apa yang terjadi. */
const WARNA: Record<KategoriNotifikasi, string> = {
  stok: 'bg-kritis-soft text-kritis-ink',
  'saran-belanja': 'bg-brand-soft text-brand-soft-ink',
  pesanan: 'bg-info-soft text-info-ink',
  kontrak: 'bg-menipis-soft text-menipis-ink',
  sistem: 'bg-netral-soft text-netral-ink',
}

const KEPALA = ['Hari Ini', 'Kemarin', 'Minggu Ini', 'Lebih Lama'] as const
type Kepala = (typeof KEPALA)[number]

/** Barang yang sudah dipesan: dipakai untuk menurunkan baris jadi pasif. */
interface Dipesan {
  pesananId: string
  tiba: string | null
}

function kelompok(waktu: string): Kepala {
  const t = new Date(waktu)
  const ms = 86_400_000
  const hariIni = new Date()
  const a = Date.UTC(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate())
  const b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
  const selisih = Math.round((a - b) / ms)
  if (selisih <= 0) return 'Hari Ini'
  if (selisih === 1) return 'Kemarin'
  if (selisih < 7) return 'Minggu Ini'
  return 'Lebih Lama'
}

function dibisukan(n: TipeNotifikasi): boolean {
  return n.dibisukanSampai != null && +new Date(n.dibisukanSampai) > Date.now()
}

const ANTI_BANJIR =
  'Satu barang hanya punya satu pemberitahuan aktif — kalau keadaannya memburuk, barisnya diperbarui dan naik ke atas, bukan ditambah baris baru.'

export default function Notifikasi() {
  const notifikasi = useAplikasi((s) => s.notifikasi)
  const pesanan = useAplikasi((s) => s.pesanan)
  const bacaNotifikasi = useAplikasi((s) => s.bacaNotifikasi)
  const bacaSemuaNotifikasi = useAplikasi((s) => s.bacaSemuaNotifikasi)
  const selesaikanNotifikasi = useAplikasi((s) => s.selesaikanNotifikasi)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [params, setParams] = useSearchParams()

  const dariUrl = params.get('kategori')
  const aktif: Penyaring = PENYARING.some((p) => p.nilai === dariUrl) ? (dariUrl as Penyaring) : 'semua'
  const belumDibaca = notifikasi.filter((n) => !n.dibaca).length

  /* Peta barang yang sedang dikirim. Inilah dasar aturan "begitu dipesan,
     barisnya jadi pasif" — bukan bendera terpisah yang bisa basi sendiri. */
  const dipesanPerBarang = useMemo(() => {
    const peta = new Map<string, Dipesan>()
    for (const p of pesanan) {
      if (!PESANAN_BERJALAN.includes(p.status) || p.status === 'draf') continue
      for (const b of p.baris) {
        if (b.barangId && !peta.has(b.barangId)) peta.set(b.barangId, { pesananId: p.id, tiba: p.perkiraanTiba })
      }
    }
    return peta
  }, [pesanan])

  const hitungan = useMemo(() => {
    const h: Record<Penyaring, number> = {
      semua: notifikasi.length,
      stok: 0,
      'saran-belanja': 0,
      pesanan: 0,
      kontrak: 0,
    }
    for (const n of notifikasi) {
      if (n.kategori === 'stok') h.stok += 1
      else if (n.kategori === 'saran-belanja') h['saran-belanja'] += 1
      else if (n.kategori === 'pesanan') h.pesanan += 1
      else if (n.kategori === 'kontrak') h.kontrak += 1
    }
    return h
  }, [notifikasi])

  const tersaring = useMemo(
    () =>
      notifikasi
        .filter((n) => aktif === 'semua' || n.kategori === aktif)
        .slice()
        .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu)),
    [notifikasi, aktif],
  )

  const grup = useMemo(() => {
    const peta = new Map<Kepala, TipeNotifikasi[]>()
    for (const n of tersaring) {
      const k = kelompok(n.waktu)
      const isi = peta.get(k) ?? []
      isi.push(n)
      peta.set(k, isi)
    }
    return KEPALA.filter((k) => peta.has(k)).map((k) => ({ kepala: k, isi: peta.get(k) as TipeNotifikasi[] }))
  }, [tersaring])

  function pilih(p: Penyaring) {
    const baru = new URLSearchParams(params)
    if (p === 'semua') baru.delete('kategori')
    else baru.set('kategori', p)
    setParams(baru, { replace: true })
  }

  function lewatiMingguIni(id: string) {
    selesaikanNotifikasi(id)
    tampilkanRacun('Saran belanja minggu ini dilewati. Kami ingatkan lagi minggu depan.', 'info')
  }

  const labelAktif = PENYARING.find((p) => p.nilai === aktif)?.label ?? 'Semua'

  const daftar =
    tersaring.length === 0 ? (
      <KeadaanKosong
        ikon={<IkonLonceng size={26} />}
        judul={
          aktif === 'semua'
            ? 'Belum ada pemberitahuan'
            : `Belum ada pemberitahuan ${labelAktif.toLowerCase()}`
        }
        pesan={
          aktif === 'semua'
            ? 'Kami mengabari kamu kalau ada stok yang menipis, pesanan yang bergerak, atau kuota kontrak yang perlu dikejar.'
            : 'Coba lihat kategori lain, atau buka daftar stok untuk memeriksa keadaan sekarang.'
        }
        aksi={
          aktif === 'semua' ? (
            <TombolTautan ke="/stok?filter=menipis">Lihat Stok Menipis</TombolTautan>
          ) : (
            <Tombol onClick={() => pilih('semua')}>Lihat Semua Pemberitahuan</Tombol>
          )
        }
        aksiKedua={
          aktif === 'semua' ? (
            <TombolTautan ke="/beranda" ragam="garis">
              Kembali ke Beranda
            </TombolTautan>
          ) : undefined
        }
      />
    ) : (
      <div className="space-y-6">
        {grup.map((g) => (
          /* Id tidak boleh mengandung spasi: aria-labelledby membaca spasi
             sebagai pemisah daftar id, bukan bagian dari satu nama. */
          <section key={g.kepala} aria-labelledby={`kepala-${g.kepala.replace(/\s+/g, '-')}`}>
            <h3
              id={`kepala-${g.kepala.replace(/\s+/g, '-')}`}
              className="text-[0.75rem] font-bold uppercase tracking-wide text-ink-3 mb-2"
            >
              {g.kepala}
            </h3>
            <div className="space-y-2">
              {g.isi.map((n) => (
                <BarisNotifikasi
                  key={n.id}
                  notif={n}
                  dipesan={n.barangId ? dipesanPerBarang.get(n.barangId) : undefined}
                  baca={() => bacaNotifikasi(n.id)}
                  lewati={() => lewatiMingguIni(n.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    )

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={JUDUL.notifikasi}
        keterangan={belumDibaca > 0 ? `${belumDibaca} belum dibaca` : 'Semua sudah dibaca'}
        kembaliKe="/beranda"
        aksi={
          belumDibaca > 0 ? (
            <Tombol ragam="sunyi" ukuran="kecil" onClick={bacaSemuaNotifikasi}>
              <span className="sm:hidden">Tandai dibaca</span>
              <span className="hidden sm:inline">Tandai semua sudah dibaca</span>
            </Tombol>
          ) : undefined
        }
        bawah={
          /* Chip geser hanya di layar sempit. Di desktop penyaringnya pindah ke
             kolom kiri supaya jadi daftar tegak yang selalu terlihat. */
          <div className="lg:hidden">
            <BarisChip>
              {PENYARING.map((p) => (
                <Chip key={p.nilai} aktif={aktif === p.nilai} onClick={() => pilih(p.nilai)}>
                  {p.label}
                  <span className="tabular font-bold">{hitungan[p.nilai]}</span>
                  <HanyaPembacaLayar>pemberitahuan</HanyaPembacaLayar>
                </Chip>
              ))}
            </BarisChip>
          </div>
        }
      />

      {/* Dua kolom di desktop: penyaring dan penjelasan pindah ke kiri supaya
          daftarnya dapat lebar penuh dan judul barisnya berhenti terpotong. */}
      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 space-y-5">
          <nav aria-labelledby="judul-saring">
            <h2 id="judul-saring" className="text-[0.75rem] font-bold uppercase tracking-wide text-ink-3 mb-2">
              Kategori
            </h2>
            <ul className="space-y-0.5">
              {PENYARING.map((p) => (
                <li key={p.nilai}>
                  <button
                    type="button"
                    onClick={() => pilih(p.nilai)}
                    aria-current={aktif === p.nilai ? 'true' : undefined}
                    className={cx(
                      'w-full flex items-center justify-between gap-3 h-11 px-3 rounded-md',
                      'text-[0.875rem] font-semibold transition-colors duration-150',
                      aktif === p.nilai
                        ? 'bg-brand-soft text-brand-soft-ink'
                        : 'text-ink-2 hover:bg-sunken hover:text-ink',
                    )}
                  >
                    <span className="truncate">{p.label}</span>
                    <span className="tabular shrink-0">
                      {hitungan[p.nilai]}
                      <HanyaPembacaLayar> pemberitahuan</HanyaPembacaLayar>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <p className="text-[0.8125rem] text-ink-3 leading-relaxed max-w-[40ch]">{ANTI_BANJIR}</p>
        </aside>

        <div className="lg:col-span-8 xl:col-span-9">
          <p className="lg:hidden mb-4 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[68ch]">
            {ANTI_BANJIR}
          </p>

          {/* Judul bagian yang hanya dibaca pembaca layar. Tanpa ini, urutan judul
              melompat dari h1 langsung ke h3 milik kartu keadaan kosong. */}
          <section aria-labelledby="judul-daftar-notif">
            <h2 id="judul-daftar-notif" className="sr-only">
              Daftar pemberitahuan {labelAktif.toLowerCase()}
            </h2>
            {daftar}
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * Satu baris = satu target sentuh. Tombol tindakannya bagian dari baris itu,
 * bukan tautan terpisah, supaya jempol tidak perlu membidik dua kali.
 *
 * Aksi sekunder ("Lewati minggu ini") sengaja diletakkan di luar tautan baris:
 * tombol di dalam tautan membuat pembaca layar dan jempol sama-sama bingung
 * mana yang sebenarnya sedang ditekan.
 */
function BarisNotifikasi({
  notif,
  dipesan,
  baca,
  lewati,
}: {
  notif: TipeNotifikasi
  dipesan?: Dipesan
  baca: () => void
  lewati: () => void
}) {
  const pasif = dipesan != null && notif.kategori === 'stok'
  /** Saran belanja yang sudah dipesan atau dilewati: tidak dihapus, cuma turun pangkat. */
  const sudahDitangani = notif.kategori === 'saran-belanja' && !notif.butuhTindakan
  const redup = dibisukan(notif) || pasif || sudahDitangani
  const tautan = pasif ? `/pesanan/${dipesan.pesananId}` : notif.tautan
  const aksiLabel = pasif ? 'Lihat pesanan' : notif.aksiLabel
  const bisaDilewati = notif.kategori === 'saran-belanja' && notif.butuhTindakan

  const isi = (
    <div className="flex items-start gap-3 min-h-[72px]">
      <span className={cx('shrink-0 size-10 rounded-md grid place-items-center', WARNA[notif.kategori])}>
        {IKON[notif.kategori]}
      </span>

      <div className="min-w-0 grow">
        <div className="flex items-start gap-2">
          <p
            className={cx(
              'text-[0.9375rem] text-ink leading-snug truncate grow',
              notif.dibaca ? 'font-medium' : 'font-bold',
            )}
          >
            {notif.judul}
          </p>
          {!notif.dibaca && (
            <>
              <span className="shrink-0 mt-1.5 size-2.5 rounded-full bg-info" aria-hidden="true" />
              <HanyaPembacaLayar>Belum dibaca</HanyaPembacaLayar>
            </>
          )}
        </div>

        <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-snug truncate">{notif.detail}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="text-[0.75rem] text-ink-3" title={new Date(notif.waktu).toLocaleString('id-ID')}>
            {waktuLalu(notif.waktu)}
          </span>
          <span className="text-[0.75rem] text-ink-3">&middot;</span>
          <span className="text-[0.75rem] text-ink-3">{LABEL_KATEGORI_NOTIF[notif.kategori]}</span>
          {pasif && (
            <Lencana nada="aman" ikon={<IkonPasokan size={13} />}>
              Sudah dipesan{dipesan.tiba ? ` · tiba ${waktuNanti(dipesan.tiba)}` : ''}
            </Lencana>
          )}
          {/* Tanpa lencana ini, menekan "Lewati minggu ini" hanya membuat tombolnya
              hilang — dari sisi pengguna itu terbaca seperti tombol yang rusak. */}
          {sudahDitangani && (
            <Lencana nada="netral" ikon={<IkonCentangLingkaran size={13} />}>
              Sudah ditangani
            </Lencana>
          )}
          {!pasif && redup && notif.dibisukanSampai && (
            <Lencana nada="netral">Dibisukan sampai {waktuNanti(notif.dibisukanSampai)}</Lencana>
          )}
          {!redup && !notif.dibaca && notif.butuhTindakan && <Lencana nada="menipis">Perlu tindakan</Lencana>}

          {/* Label aksi ikut di baris keterangan, bukan di kolom kanan: di layar
              360px kolom kanan memakan judulnya sampai tinggal beberapa huruf. */}
          {aksiLabel && tautan ? (
            <span className="ml-auto inline-flex items-center h-9 px-3 rounded-sm bg-sunken text-ink-2 text-[0.8125rem] font-semibold whitespace-nowrap">
              {aksiLabel}
              <IkonPanahKanan size={15} className="ml-1" />
            </span>
          ) : tautan ? (
            <IkonPanahKanan size={18} className="ml-auto text-ink-3" />
          ) : null}
        </div>
      </div>
    </div>
  )

  /* Baris yang sudah ditangani dibuat MENJOROK ke dalam (bg-sunken), bukan
     dipudarkan. Memudarkan teks menjatuhkan kontrasnya di bawah ambang baca,
     dan di tema gelap bg-surface-2 justru lebih terang daripada kartu biasa. */
  const kelas = cx(
    'rounded-lg border p-3.5 transition-[border-color,box-shadow,background-color]',
    redup ? 'border-line bg-sunken' : 'border-line bg-surface shadow-e1',
    tautan && 'hover:border-line-strong hover:shadow-e2',
  )

  return (
    <div className={kelas}>
      {tautan ? (
        <Link to={tautan} onClick={baca} className="block rounded-md active:opacity-80">
          {isi}
        </Link>
      ) : (
        isi
      )}

      {bisaDilewati && (
        <div className="mt-2.5 pt-2.5 border-t border-line">
          <Tombol ragam="sunyi" ukuran="kecil" onClick={lewati}>
            Lewati minggu ini
          </Tombol>
        </div>
      )}
    </div>
  )
}
