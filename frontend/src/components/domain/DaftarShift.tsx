import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bagian, Lencana, Tombol } from '@/components/ui/dasar'
import { IkonPanahKanan } from '@/icons'
import { ambilRiwayatShift, kataSelisih, type Shift } from '@/lib/apiKasir'
import { jam, rupiah, tanggalPendek } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/** Berapa shift yang tampil di bagian Ringkasan Penjualan (revisi V7, Q163). */
const RINGKAS = 5
const HALAMAN = 25

/**
 * Shift kasir untuk pemilik: siapa yang menjaga, berapa tunai yang masuk, dan selisih laci.
 * Angka shift tertutup dibekukan saat ditutup.
 *
 * Dua wujud, sama seperti `DaftarNota` (revisi V7, Q163): `ringkas` menampilkan lima shift
 * terakhir di Ringkasan Penjualan dengan tautan ke Riwayat Kasir, sedangkan halaman penuh
 * memuat 25 dan menambah 25 lagi tiap tombolnya ditekan.
 */
export function DaftarShift({ ringkas = false }: { ringkas?: boolean }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tanda = useAplikasi((s) => s.notaTerbaru?.[0]?.nomorStruk)
  const [daftar, setDaftar] = useState<Shift[] | null>(null)
  const [habis, setHabis] = useState(false)
  const [memuat, setMemuat] = useState(false)
  const batasAwal = ringkas ? RINGKAS : HALAMAN

  useEffect(() => {
    if (!sesi) return
    let batal = false
    ambilRiwayatShift(sesi, batasAwal)
      .then((d) => {
        if (batal) return
        // Daftar yang baru dimuat menggantikan yang lama seluruhnya, jadi
        // penanda "sudah habis" dari halaman sebelumnya ikut dilupakan.
        setDaftar(d)
        setHabis(d.length < batasAwal)
      })
      .catch(() => !batal && setDaftar([]))
    return () => {
      batal = true
    }
  }, [sesi, tanda, batasAwal])

  async function lihatLagi() {
    if (!sesi || !daftar) return
    setMemuat(true)
    try {
      const d = await ambilRiwayatShift(sesi, HALAMAN, daftar.length)
      const ada = new Set(daftar.map((s) => s.id))
      setDaftar([...daftar, ...d.filter((s) => !ada.has(s.id))])
      setHabis(d.length < HALAMAN)
    } finally {
      setMemuat(false)
    }
  }

  // Di Ringkasan Penjualan bagian ini hilang saja kalau belum ada shift, supaya
  // halaman tidak penuh kotak kosong. Di halamannya sendiri ia harus tetap
  // menjawab, karena pengguna sengaja membuka tab itu.
  if ((!daftar || daftar.length === 0) && ringkas) return null

  return (
    <Bagian
      id="judul-shift"
      judul="Shift kasir"
      keterangan="Selisih laci dihitung dari uang modal ditambah tunai."
      aksi={
        ringkas ? (
          <Link
            to="/penjualan/riwayat?tab=shift"
            className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline"
          >
            Lihat Semua Shift
            <IkonPanahKanan size={15} />
          </Link>
        ) : undefined
      }
      className="mt-4"
    >
      {daftar === null ? (
        <p className="text-isi text-ink-3">Memuat shift&hellip;</p>
      ) : daftar.length === 0 ? (
        <p className="text-isi text-ink-3">Belum ada shift kasir yang tercatat.</p>
      ) : (
      <ul className="divide-y divide-line">
        {daftar.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-isi font-semibold text-ink">{s.namaKasir}</p>
              <p className="text-kecil text-ink-3">
                {tanggalPendek(s.dibukaPada)}, {jam(s.dibukaPada)} sampai {s.ditutupPada ? jam(s.ditutupPada) : 'sekarang'} &middot; {s.jumlahNota} nota
              </p>
              {s.catatan && <p className="mt-0.5 text-kecil text-ink-2 break-words">{s.catatan}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-isi font-bold text-ink tabular">Tunai {rupiah(s.tunai)}</p>
              {s.ditutupPada === null ? (
                <Lencana nada="info">Sedang buka</Lencana>
              ) : (
                <Lencana nada={s.selisih === 0 ? 'aman' : (s.selisih ?? 0) < 0 ? 'kritis' : 'info'}>{kataSelisih(s.selisih ?? 0)}</Lencana>
              )}
            </div>
          </li>
        ))}
      </ul>
      )}
      {!ringkas && daftar !== null && daftar.length > 0 && !habis && (
        <Tombol ragam="garis" className="mt-3" memuat={memuat} onClick={lihatLagi}>
          Muat {HALAMAN} Shift Lagi
        </Tombol>
      )}
      {!ringkas && habis && (daftar?.length ?? 0) > HALAMAN && (
        <p className="mt-3 text-kecil text-ink-3">Itu shift paling awal yang tersimpan.</p>
      )}
    </Bagian>
  )
}
