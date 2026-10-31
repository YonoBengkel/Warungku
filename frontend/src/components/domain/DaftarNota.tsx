import { useEffect, useState } from 'react'
import { Bagian, Tombol } from '@/components/ui/dasar'
import { ambilNotaTerbaru } from '@/lib/apiMenu'
import { angka, jam, rupiah, tanggalPendek } from '@/lib/format'
import type { Transaksi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

const HALAMAN_AWAL = 8
const HALAMAN_BERIKUT = 25

/**
 * Nota baru masuk di atas daftar yang sudah dibuka. Kalau halaman terbaru tidak
 * bersinggungan sama sekali dengan daftar lama (lebih dari satu halaman nota masuk
 * di antara dua pengecekan), daftar lama dibuang: menyambungnya meninggalkan celah
 * yang tidak akan pernah dimuat, karena halaman berikutnya dihitung dari panjang daftar.
 */
function gabung(baru: Transaksi[], lama: Transaksi[]): Transaksi[] {
  const ada = new Set(lama.map((n) => n.nomorStruk))
  if (!baru.some((n) => ada.has(n.nomorStruk))) return baru
  return [...baru.filter((n) => !ada.has(n.nomorStruk)), ...lama]
}

/**
 * Nota dari kasir di bawah Ringkasan Penjualan (Portal POS, tahap 2): delapan
 * terbaru, dan "Lihat Semua Nota" memuat 25 lebih lama setiap ditekan. Tidak
 * memuat semuanya sekaligus, karena data simulasi punya nota ratusan hari.
 * Nota baru dari kasir masuk di atas daftar tanpa menutup yang sudah dibuka.
 */
export function DaftarNota() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const terakhir = useAplikasi((s) => s.notaTerbaru?.[0]?.nomorStruk)
  const [daftar, setDaftar] = useState<Transaksi[] | null>(null)
  // Nomor nota paling lama yang diketahui sudah menjadi ujung. Daftar yang pendek bukan tanda habis, dan
  // daftar yang dibuang lalu dimuat ulang otomatis tidak lagi berujung di nota itu.
  const [ujung, setUjung] = useState<string | null>(null)
  const [diperluas, setDiperluas] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [memuat, setMemuat] = useState(false)

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
  }, [sesi, terakhir])

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
            const total = n.baris.reduce((a, b) => a + (b.harga ?? 0) * b.jumlah, 0)
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
                </div>
                <p className="shrink-0 text-isi font-bold text-ink tabular">{adaHarga ? rupiah(total) : '-'}</p>
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
    </Bagian>
  )
}
