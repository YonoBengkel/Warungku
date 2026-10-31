import { useEffect, useState } from 'react'
import { Bagian, Lencana } from '@/components/ui/dasar'
import { ambilRiwayatShift, kataSelisih, type Shift } from '@/lib/apiKasir'
import { jam, rupiah, tanggalPendek } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Lima shift kasir terakhir di Ringkasan Penjualan, untuk pemilik: siapa yang menjaga, berapa
 * tunai yang masuk, dan selisih laci. Angka shift tertutup dibekukan saat ditutup.
 */
export function DaftarShift() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tanda = useAplikasi((s) => s.notaTerbaru?.[0]?.nomorStruk)
  const [daftar, setDaftar] = useState<Shift[] | null>(null)

  useEffect(() => {
    if (!sesi) return
    let batal = false
    ambilRiwayatShift(sesi)
      .then((d) => !batal && setDaftar(d))
      .catch(() => !batal && setDaftar([]))
    return () => {
      batal = true
    }
  }, [sesi, tanda])

  if (!daftar || daftar.length === 0) return null

  return (
    <Bagian id="judul-shift" judul="Shift kasir" keterangan="Selisih laci dihitung dari uang modal ditambah tunai." className="mt-4">
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
    </Bagian>
  )
}
