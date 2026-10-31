import { useEffect, useState } from 'react'
import { Kerangka, Lencana, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonNota } from '@/icons'
import { GalatApi } from '@/lib/api'
import { ajukanBatalNota, ambilNotaTerbaru } from '@/lib/apiMenu'
import { angka, jam, rupiah, tanggalPendek } from '@/lib/format'
import type { Transaksi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

const NAMA_CARA = { tunai: 'Tunai', qris: 'QRIS', transfer: 'Transfer' } as const

/**
 * Nota terbaru di Portal POS (tahap 4). Kasir bisa mengajukan pembatalan dengan
 * alasan, tetapi tidak membatalkan sendiri: stok dan laporan baru berubah kalau
 * pemilik membatalkannya di Portal UMKM. Pemisahan ini baru di antarmuka, karena
 * selama POS memakai akun pemilik server belum bisa membedakan keduanya.
 */
export default function NotaPos() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const [daftar, setDaftar] = useState<Transaksi[] | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [membuka, setMembuka] = useState<string | null>(null)
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [mengirim, setMengirim] = useState(false)
  const [kabar, setKabar] = useState<string | null>(null)

  function muat() {
    if (!sesi) return
    setGalatMuat(null)
    ambilNotaTerbaru(sesi, 20)
      .then(setDaftar)
      .catch((e: unknown) => setGalatMuat(e instanceof GalatApi ? e.message : 'Nota belum bisa dimuat. Periksa sambungan, lalu coba lagi.'))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup sekali saat halaman dibuka
  useEffect(muat, [])

  async function ajukan(n: Transaksi) {
    if (!sesi) return
    if (alasan.trim().length < 3) {
      setGalat('Tulis alasannya, paling sedikit 3 huruf.')
      return
    }
    setMengirim(true)
    setGalat(null)
    try {
      const h = await ajukanBatalNota(sesi, n.nomorStruk, alasan.trim())
      setKabar(
        h.status === 'sudah-dibatalkan'
          ? `Nota ${n.nomorStruk} sudah dibatalkan pemilik.`
          : `Pengajuan untuk ${n.nomorStruk} terkirim. Menunggu pemilik membatalkannya.`,
      )
      setMembuka(null)
      setAlasan('')
      muat()
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Pengajuan belum terkirim. Coba lagi sebentar lagi.')
    } finally {
      setMengirim(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-judul font-extrabold text-ink tracking-tight">Nota terbaru</h1>
          <Tombol ragam="garis" ukuran="kecil" onClick={muat}>
            Muat Ulang
          </Tombol>
        </div>
        <p className="mt-1 text-isi text-ink-2 leading-relaxed">
          Salah catat? Ajukan pembatalan dengan alasan. Pemilik yang membatalkannya, supaya stok dan laporan tetap cocok.
        </p>

        {kabar && (
          <p role="status" className="mt-3 text-isi font-semibold text-aman-ink">
            {kabar}
          </p>
        )}

        <div className="mt-4">
          {galatMuat ? (
            <Peringatan nada="kritis" judul="Nota belum bisa dimuat">
              {galatMuat}
            </Peringatan>
          ) : daftar === null ? (
            <div aria-busy="true" className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Kerangka key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : daftar.length === 0 ? (
            <KeadaanKosong ikon={<IkonNota size={26} />} judul="Belum ada nota" pesan="Nota yang kamu kirim dari layar Kasir muncul di sini." />
          ) : (
            <ul className="space-y-2">
              {daftar.map((n) => {
                const total = Math.max(0, n.baris.reduce((a, b) => a + (b.harga ?? 0) * b.jumlah, 0) - n.diskon)
                return (
                  <li key={n.nomorStruk} className="p-3.5 rounded-lg border border-line bg-surface">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-isi font-semibold text-ink break-all">{n.nomorStruk}</p>
                        <p className="text-kecil text-ink-3">
                          {tanggalPendek(n.waktu)}, {jam(n.waktu)}
                          {n.caraBayar ? ` · ${NAMA_CARA[n.caraBayar]}` : ''}
                        </p>
                        <p className="mt-0.5 text-kecil text-ink-2 break-words">
                          {n.baris.map((b) => `${angka(b.jumlah, 2)} ${b.nama}`).join(', ')}
                        </p>
                      </div>
                      <p className="shrink-0 text-isi font-bold text-ink tabular">{rupiah(total)}</p>
                    </div>

                    {n.pengajuanBatal ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Lencana nada="menipis">Menunggu pemilik</Lencana>
                        <span className="text-kecil text-ink-2 break-words">{n.pengajuanBatal}</span>
                      </div>
                    ) : membuka === n.nomorStruk ? (
                      <form
                        noValidate
                        className="mt-3 space-y-2.5"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void ajukan(n)
                        }}
                      >
                        <Kolom label="Alasan" wajib value={alasan} galat={galat ?? undefined} onChange={(e) => setAlasan(e.target.value)} />
                        <div className="flex gap-2.5">
                          <Tombol type="submit" ukuran="kecil" memuat={mengirim}>
                            Kirim Pengajuan
                          </Tombol>
                          <Tombol
                            ragam="garis"
                            ukuran="kecil"
                            onClick={() => {
                              setMembuka(null)
                              setGalat(null)
                            }}
                          >
                            Batal
                          </Tombol>
                        </div>
                      </form>
                    ) : (
                      <Tombol
                        ragam="garis"
                        ukuran="kecil"
                        className="mt-2"
                        onClick={() => {
                          setMembuka(n.nomorStruk)
                          setAlasan('')
                          setGalat(null)
                          setKabar(null)
                        }}
                      >
                        Ajukan Pembatalan
                      </Tombol>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
