import { useEffect, useState } from 'react'
import { Bagian, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { GalatApi } from '@/lib/api'
import { ambilNotaTerbaru, batalkanNota } from '@/lib/apiMenu'
import { angka, jam, rupiah, tanggalPendek } from '@/lib/format'
import type { Transaksi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

const HALAMAN_AWAL = 8
const HALAMAN_BERIKUT = 25
const NAMA_CARA = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' } as const

/**
 * Halaman pertama yang baru dimuat menggantikan bagian atas daftar yang sudah dibuka.
 * Nota di daftar lama yang ada di dalam rentang itu tetapi tidak ikut kembali sudah
 * dibatalkan (mungkin dari tab lain), jadi dibuang. Kalau tidak ada yang bersinggungan
 * sama sekali (lebih dari satu halaman nota masuk di antara dua pengecekan), daftar
 * lama dibuang seluruhnya: menyambungnya meninggalkan celah yang tidak akan pernah
 * dimuat, karena halaman berikutnya dihitung dari panjang daftar.
 */
function gabung(baru: Transaksi[], lama: Transaksi[]): Transaksi[] {
  const ada = new Set(baru.map((n) => n.nomorStruk))
  let sambung = -1
  lama.forEach((n, i) => {
    if (ada.has(n.nomorStruk)) sambung = i
  })
  return sambung === -1 ? baru : [...baru, ...lama.slice(sambung + 1)]
}

const hargaNota = (n: Transaksi) => Math.max(0, n.baris.reduce((a, b) => a + (b.harga ?? 0) * b.jumlah, 0) - n.diskon)

/**
 * Nota dari kasir di bawah Ringkasan Penjualan (Portal POS): delapan terbaru, dan
 * "Lihat Semua Nota" memuat 25 lebih lama setiap ditekan. Tidak memuat semuanya
 * sekaligus, karena data simulasi punya nota ratusan hari. Nota baru dari kasir
 * masuk di atas daftar tanpa menutup yang sudah dibuka.
 *
 * Pemilik membatalkan nota dari sini (tahap 4). Kasir hanya bisa mengajukan, dan
 * alasannya muncul di baris nota sebagai bahan keputusan pemilik.
 */
export function DaftarNota({ setelahBatal }: { setelahBatal?: () => void }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tanda = useAplikasi((s) => s.notaTerbaru?.map((n) => n.nomorStruk + (n.pengajuanBatal ? '!' : '')).join(','))
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const muatMenuKasir = useAplikasi((s) => s.muatMenuKasir)
  const segarkanGudangServer = useAplikasi((s) => s.segarkanGudangServer)
  const [daftar, setDaftar] = useState<Transaksi[] | null>(null)
  // Nomor nota paling lama yang diketahui sudah menjadi ujung. Daftar yang pendek bukan tanda habis, dan
  // daftar yang dibuang lalu dimuat ulang otomatis tidak lagi berujung di nota itu.
  const [ujung, setUjung] = useState<string | null>(null)
  const [diperluas, setDiperluas] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [memuat, setMemuat] = useState(false)
  const [target, setTarget] = useState<Transaksi | null>(null)
  const [alasan, setAlasan] = useState('')
  const [galatBatal, setGalatBatal] = useState<string | null>(null)
  const [membatalkan, setMembatalkan] = useState(false)

  useEffect(() => {
    if (!sesi) return
    let batal = false
    ambilNotaTerbaru(sesi, HALAMAN_AWAL)
      .then((d) => {
        if (batal) return
        setDaftar((lama) => (lama ? gabung(d, lama) : d))
        setGalat(null)
      })
      .catch(() => !batal && setGalat('Nota belum bisa dimuat. Coba lagi sebentar lagi.'))
    return () => {
      batal = true
    }
  }, [sesi, tanda])

  async function lihatLagi() {
    if (!sesi || !daftar) return
    setMemuat(true)
    try {
      const d = await ambilNotaTerbaru(sesi, HALAMAN_BERIKUT, daftar.length)
      const ada = new Set(daftar.map((n) => n.nomorStruk))
      const baru = [...daftar, ...d.filter((n) => !ada.has(n.nomorStruk))]
      setDaftar(baru)
      setDiperluas(true)
      setUjung(d.length < HALAMAN_BERIKUT ? (baru[baru.length - 1]?.nomorStruk ?? null) : null)
    } catch {
      setGalat('Nota yang lebih lama belum bisa dimuat. Coba lagi sebentar lagi.')
    } finally {
      setMemuat(false)
    }
  }

  function tutupLembar() {
    setTarget(null)
    setAlasan('')
    setGalatBatal(null)
  }

  async function batalkan() {
    if (!sesi || !target) return
    if (alasan.trim().length < 3) {
      setGalatBatal('Tulis alasan pembatalan, paling sedikit 3 huruf.')
      return
    }
    setMembatalkan(true)
    setGalatBatal(null)
    try {
      const h = await batalkanNota(sesi, target.nomorStruk, alasan.trim())
      setDaftar((lama) => lama?.filter((n) => n.nomorStruk !== target.nomorStruk) ?? lama)
      tampilkanRacun(
        h.stokDikembalikan.length > 0
          ? `Nota ${target.nomorStruk} dibatalkan. Stok ${h.stokDikembalikan.join(', ')} dikembalikan.`
          : `Nota ${target.nomorStruk} dibatalkan.`,
        'aman',
      )
      tutupLembar()
      await Promise.all([muatMenuKasir(), segarkanGudangServer().catch(() => undefined)])
      setelahBatal?.()
    } catch (e) {
      setGalatBatal(e instanceof GalatApi ? e.message : 'Nota belum bisa dibatalkan. Coba lagi sebentar lagi.')
    } finally {
      setMembatalkan(false)
    }
  }

  return (
    <Bagian
      id="judul-nota-kasir"
      judul="Nota dari kasir"
      keterangan="Nama dan harga seperti tercetak di struk, yang terbaru di atas."
      className="mt-4"
    >
      {galat ? (
        <p role="alert" className="text-isi font-semibold text-kritis-ink">
          {galat}
        </p>
      ) : daftar === null ? (
        <p className="text-isi text-ink-3">Memuat nota&hellip;</p>
      ) : daftar.length === 0 ? (
        <p className="text-isi text-ink-3">Belum ada nota masuk dari kasir.</p>
      ) : (
        <ul className="divide-y divide-line">
          {daftar.map((n) => {
            const adaHarga = n.baris.some((b) => b.harga != null)
            return (
              <li key={n.nomorStruk} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-isi font-semibold text-ink break-all">{n.nomorStruk}</p>
                  <p className="text-kecil text-ink-3">
                    {tanggalPendek(n.waktu)}, {jam(n.waktu)} &middot; {n.kasir}
                  </p>
                  <p className="mt-0.5 text-kecil text-ink-2 break-words">
                    {n.baris.map((b) => `${angka(b.jumlah, 2)} ${b.nama}`).join(', ')}
                  </p>
                  {n.pengajuanBatal && (
                    <p className="mt-1 text-kecil font-semibold text-menipis-ink break-words">
                      Kasir mengajukan pembatalan: {n.pengajuanBatal}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-isi font-bold text-ink tabular">{adaHarga ? rupiah(hargaNota(n)) : '-'}</p>
                  {(n.caraBayar || n.diskon > 0) && (
                    <p className="text-kecil text-ink-3">
                      {[n.caraBayar && NAMA_CARA[n.caraBayar], n.diskon > 0 && `diskon ${rupiah(n.diskon)}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <Tombol
                    ragam="bahaya-garis"
                    ukuran="kecil"
                    className="mt-1.5"
                    aria-label={`Batalkan nota ${n.nomorStruk}`}
                    onClick={() => {
                      setTarget(n)
                      setAlasan(n.pengajuanBatal ?? '')
                    }}
                  >
                    Batalkan
                  </Tombol>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {daftar && daftar.length >= HALAMAN_AWAL && daftar[daftar.length - 1]?.nomorStruk !== ujung && (
        <Tombol ragam="garis" className="mt-3" memuat={memuat} onClick={lihatLagi}>
          {diperluas ? `Muat ${HALAMAN_BERIKUT} Nota Lagi` : 'Lihat Semua Nota'}
        </Tombol>
      )}
      {daftar && daftar.length > HALAMAN_AWAL && daftar[daftar.length - 1]?.nomorStruk === ujung && (
        <p className="mt-3 text-kecil text-ink-3">Itu nota paling awal yang tersimpan.</p>
      )}

      <Lembar
        terbuka={target !== null}
        tutup={tutupLembar}
        judul="Batalkan nota ini?"
        lebar="sempit"
        kunciLatar
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={tutupLembar}>
              Tidak Jadi
            </Tombol>
            <Tombol ragam="bahaya" penuh memuat={membatalkan} onClick={batalkan}>
              Batalkan Nota
            </Tombol>
          </div>
        }
      >
        {target && (
          <div className="space-y-3">
            <p className="text-isi text-ink-2 leading-relaxed">
              <span className="font-semibold text-ink break-all">{target.nomorStruk}</span>, {rupiah(hargaNota(target))}. Stok bahan yang
              dipotong nota ini dikembalikan, dan nota tidak dihitung lagi di Ringkasan Penjualan. Ini tidak bisa dibatalkan lagi.
            </p>
            <Kolom label="Alasan pembatalan" wajib value={alasan} galat={galatBatal ?? undefined} onChange={(e) => setAlasan(e.target.value)} />
          </div>
        )}
      </Lembar>
    </Bagian>
  )
}
