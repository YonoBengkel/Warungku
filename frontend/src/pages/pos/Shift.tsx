import { useEffect, useState } from 'react'
import { Kartu, Kerangka, Lencana, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { Peringatan } from '@/components/ui/umpanBalik'
import { GalatApi } from '@/lib/api'
import { ambilShiftAktif, kataSelisih, tutupShift, type Shift } from '@/lib/apiKasir'
import { bacaAngkaIndonesia, jam, rupiah, tanggalPendek } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'
import { BukaKas } from './BukaKas'

/**
 * Shift kas (Portal POS, tahap 5): rekap shift yang sedang buka, dan tutup kas dengan uang yang
 * dihitung di laci. QRIS dan transfer tidak masuk laci, jadi hanya tunai yang dicocokkan.
 * Sesudah ditutup, rekapnya dibekukan: pembatalan nota sesudahnya tidak mengubahnya.
 */
export default function ShiftPos() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [tutupan, setTutupan] = useState<Shift | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)

  function muat() {
    if (!sesi) return
    setGalatMuat(null)
    ambilShiftAktif(sesi)
      .then(setShift)
      .catch((e: unknown) => setGalatMuat(e instanceof GalatApi ? e.message : 'Shift belum bisa dimuat. Periksa sambungan, lalu coba lagi.'))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup sekali saat halaman dibuka
  useEffect(muat, [])

  if (galatMuat) {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto">
        <Peringatan nada="kritis" judul="Shift belum bisa dimuat" aksi={<Tombol ragam="garis" ukuran="kecil" onClick={muat}>Coba Lagi</Tombol>}>
          {galatMuat}
        </Peringatan>
      </div>
    )
  }
  if (shift === undefined) {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto" aria-busy="true">
        <Kerangka className="h-40 rounded-lg" />
      </div>
    )
  }
  if (tutupan) return <RekapTutup shift={tutupan} onBaru={() => setTutupan(null)} />
  if (shift === null) return <BukaKas onBuka={setShift} judul="Belum ada shift yang terbuka" />
  return <ShiftBerjalan shift={shift} onTutup={(s) => { setShift(null); setTutupan(s) }} />
}

function Angka({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-isi text-ink-2">{label}</dt>
      <dd className={tebal ? 'text-isi font-extrabold text-ink tabular' : 'text-isi font-semibold text-ink tabular'}>{nilai}</dd>
    </div>
  )
}

function ShiftBerjalan({ shift, onTutup }: { shift: Shift; onTutup: (s: Shift) => void }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const [uangTeks, setUangTeks] = useState('')
  const [catatan, setCatatan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [menutup, setMenutup] = useState(false)

  const uang = bacaAngkaIndonesia(uangTeks)
  const adaUang = uangTeks.trim() !== '' && Number.isInteger(uang) && uang >= 0
  const selisih = adaUang ? uang - shift.tunaiDiharapkan : null

  async function tutup() {
    if (!sesi) return
    if (!adaUang) {
      setGalat('Tulis uang yang kamu hitung di laci, dalam Rupiah bulat. Tulis 0 kalau laci kosong.')
      return
    }
    setMenutup(true)
    setGalat(null)
    try {
      onTutup(await tutupShift(sesi, uang, catatan))
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Kas belum bisa ditutup. Coba lagi sebentar lagi.')
    } finally {
      setMenutup(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div>
          <h1 className="text-judul font-extrabold text-ink tracking-tight">Shift berjalan</h1>
          <p className="mt-1 text-isi text-ink-2">
            {shift.namaKasir}, dibuka {tanggalPendek(shift.dibukaPada)} pukul {jam(shift.dibukaPada)}.
          </p>
        </div>

        <Kartu>
          <dl className="divide-y divide-line">
            <Angka label="Uang modal" nilai={rupiah(shift.modalAwal)} />
            <Angka label={`Nota (${shift.jumlahNota})`} nilai={rupiah(shift.tunai + shift.qris + shift.transfer)} />
            <Angka label="Tunai" nilai={rupiah(shift.tunai)} />
            <Angka label="QRIS (tidak masuk laci)" nilai={rupiah(shift.qris)} />
            <Angka label="Transfer (tidak masuk laci)" nilai={rupiah(shift.transfer)} />
            <Angka label="Uang yang seharusnya ada di laci" nilai={rupiah(shift.tunaiDiharapkan)} tebal />
          </dl>
        </Kartu>

        <Kartu>
          <h2 className="text-kartu font-bold text-ink">Tutup kas</h2>
          <p className="mt-0.5 mb-3 text-isi text-ink-3 leading-snug">Hitung uang di laci, lalu tulis jumlahnya.</p>
          <form
            noValidate
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void tutup()
            }}
          >
            <Kolom label="Uang yang dihitung di laci" wajib awalan="Rp" inputMode="numeric" value={uangTeks} galat={galat ?? undefined} onChange={(e) => setUangTeks(e.target.value)} />
            {selisih !== null && (
              <p role="status" className={selisih === 0 ? 'text-isi font-bold text-aman-ink' : selisih < 0 ? 'text-isi font-bold text-kritis-ink' : 'text-isi font-bold text-info-ink'}>
                Selisih: {kataSelisih(selisih)}
              </p>
            )}
            <Kolom label="Catatan" bantuan="Misalnya alasan selisih." value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            <Tombol type="submit" penuh ukuran="besar" memuat={menutup}>
              Tutup Kas
            </Tombol>
          </form>
        </Kartu>
      </div>
    </div>
  )
}

function RekapTutup({ shift, onBaru }: { shift: Shift; onBaru: () => void }) {
  const selisih = shift.selisih ?? 0
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div>
          <h1 className="text-judul font-extrabold text-aman-ink tracking-tight">Kas ditutup</h1>
          <p className="mt-1 text-isi text-ink-2">
            {shift.namaKasir}, {jam(shift.dibukaPada)} sampai {shift.ditutupPada ? jam(shift.ditutupPada) : '-'}.
          </p>
        </div>
        <Kartu>
          <dl className="divide-y divide-line">
            <Angka label="Uang modal" nilai={rupiah(shift.modalAwal)} />
            <Angka label={`Tunai dari ${shift.jumlahNota} nota`} nilai={rupiah(shift.tunai)} />
            <Angka label="QRIS" nilai={rupiah(shift.qris)} />
            <Angka label="Transfer" nilai={rupiah(shift.transfer)} />
            <Angka label="Seharusnya di laci" nilai={rupiah(shift.tunaiDiharapkan)} />
            <Angka label="Dihitung di laci" nilai={rupiah(shift.uangDihitung ?? 0)} />
          </dl>
          <p className="mt-3 flex items-center gap-2 text-kartu font-extrabold text-ink">
            Selisih <Lencana nada={selisih === 0 ? 'aman' : selisih < 0 ? 'kritis' : 'info'}>{kataSelisih(selisih)}</Lencana>
          </p>
          {shift.catatan && <p className="mt-2 text-isi text-ink-2 break-words">Catatan: {shift.catatan}</p>}
        </Kartu>
        <Tombol penuh ukuran="besar" onClick={onBaru}>
          Buka Kas Baru
        </Tombol>
      </div>
    </div>
  )
}
