import { useEffect, useMemo, useRef, useState } from 'react'
import { Kerangka, Tombol } from '@/components/ui/dasar'
import { Kolom, PengaturJumlah } from '@/components/ui/formulir'
import { Chip } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCari, IkonNota } from '@/icons'
import { GalatApi } from '@/lib/api'
import { ambilMenuJual, kirimNota, type MenuJual } from '@/lib/apiMenu'
import { rupiah } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

interface BarisNota {
  namaMenu: string
  harga: number
  jumlah: number
}

interface HasilKirim {
  nomor: string
  total: number
  tanpaResep: string[]
  stokKurang: string[]
}

const SEMUA = 'Semua'

/**
 * Nomor nota dibuat di peramban sebelum dikirim, dan baru diganti sesudah nota
 * diterima. Kalau koneksi putus di tengah jalan, kirim ulang memakai nomor yang
 * sama, dan server menangkisnya supaya stok tidak terpotong dua kali. Awalannya
 * bukan `DEMO-`, karena nota berawalan itu tidak dihitung di Ringkasan Penjualan.
 */
function buatNomor(): string {
  const w = new Date()
  const d = (n: number, p = 2) => String(n).padStart(p, '0')
  const acak = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `POS-${w.getFullYear()}${d(w.getMonth() + 1)}${d(w.getDate())}-${d(w.getHours())}${d(w.getMinutes())}${d(w.getSeconds())}-${acak}`
}

/**
 * Layar kasir (Portal POS, tahap 1): kisi menu di kiri, nota berjalan di kanan.
 * Menu, harga, dan resep diatur pemilik di Portal UMKM, jadi di sini hanya dibaca.
 * Menu tanpa resep tetap bisa dijual: notanya masuk, tetapi stok bahannya belum
 * terpotong, dan pemiliknya melihatnya sebagai menu yang perlu dipasangkan.
 */
export default function Kasir() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const [menu, setMenu] = useState<MenuJual[] | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [kategori, setKategori] = useState(SEMUA)
  const [cari, setCari] = useState('')
  const [nota, setNota] = useState<BarisNota[]>([])
  const [mengirim, setMengirim] = useState(false)
  const [galatKirim, setGalatKirim] = useState<string | null>(null)
  const [hasil, setHasil] = useState<HasilKirim | null>(null)
  const nomor = useRef(buatNomor())

  function muat() {
    if (!sesi) return
    setGalatMuat(null)
    ambilMenuJual(sesi)
      .then((semua) => setMenu(semua.filter((m) => m.aktif)))
      .catch((e: unknown) =>
        setGalatMuat(e instanceof GalatApi ? e.message : 'Daftar menu belum bisa dimuat. Periksa sambungan, lalu coba lagi.'),
      )
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup sekali saat layar dibuka
  useEffect(muat, [])

  const daftarKategori = useMemo(() => {
    const ada = new Set((menu ?? []).map((m) => m.kategori ?? 'Lainnya'))
    return [SEMUA, ...ada]
  }, [menu])

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase()
    return (menu ?? []).filter(
      (m) =>
        (kategori === SEMUA || (m.kategori ?? 'Lainnya') === kategori) && (!kata || m.namaMenu.toLowerCase().includes(kata)),
    )
  }, [menu, kategori, cari])

  const total = nota.reduce((a, b) => a + b.harga * b.jumlah, 0)

  function tambah(m: MenuJual) {
    setHasil(null)
    setGalatKirim(null)
    setNota((n) =>
      n.some((b) => b.namaMenu === m.namaMenu)
        ? n.map((b) => (b.namaMenu === m.namaMenu ? { ...b, jumlah: b.jumlah + 1 } : b))
        : [...n, { namaMenu: m.namaMenu, harga: m.hargaJual, jumlah: 1 }],
    )
  }

  function ubahJumlah(namaMenu: string, jumlah: number) {
    setNota((n) => (jumlah <= 0 ? n.filter((b) => b.namaMenu !== namaMenu) : n.map((b) => (b.namaMenu === namaMenu ? { ...b, jumlah } : b))))
  }

  async function kirim() {
    if (!sesi || nota.length === 0) return
    setMengirim(true)
    setGalatKirim(null)
    try {
      const h = await kirimNota(
        sesi,
        nomor.current,
        nota.map((b) => ({ namaMenu: b.namaMenu, jumlah: b.jumlah, satuan: 'porsi', harga: b.harga })),
        'Portal POS',
      )
      setHasil({ nomor: nomor.current, total, tanpaResep: h.takDikenali, stokKurang: h.stokKurang })
      setNota([])
      nomor.current = buatNomor()
    } catch (e) {
      setGalatKirim(e instanceof GalatApi ? e.message : 'Nota belum terkirim. Isinya masih aman, coba kirim lagi.')
    } finally {
      setMengirim(false)
    }
  }

  return (
    <div className="h-full lg:grid lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section aria-label="Daftar menu" className="min-w-0 lg:overflow-y-auto p-4 sm:p-6">
        <Kolom
          aria-label="Cari menu"
          placeholder="Cari menu"
          type="search"
          value={cari}
          awalan={<IkonCari size={18} />}
          onChange={(e) => setCari(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {daftarKategori.map((k) => (
            <Chip key={k} aktif={kategori === k} onClick={() => setKategori(k)}>
              {k}
            </Chip>
          ))}
        </div>

        <div className="mt-4">
          {galatMuat ? (
            <Peringatan
              nada="kritis"
              judul="Daftar menu belum bisa dimuat"
              aksi={
                <Tombol ragam="garis" ukuran="kecil" onClick={muat}>
                  Coba Lagi
                </Tombol>
              }
            >
              {galatMuat}
            </Peringatan>
          ) : menu === null ? (
            <div aria-busy="true" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Kerangka key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : menu.length === 0 ? (
            <KeadaanKosong
              ikon={<IkonNota size={26} />}
              judul="Belum ada menu untuk dijual"
              pesan="Pemilik usaha mengatur menu dan harganya di Portal UMKM: Akun, Data dari Kasir, tab Menu & Harga."
            />
          ) : tampil.length === 0 ? (
            <KeadaanKosong ikon={<IkonCari size={26} />} judul="Menu tidak ditemukan" pesan="Coba kata lain, atau pilih kategori Semua." />
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 [&>*]:min-w-0">
              {tampil.map((m) => (
                <li key={m.namaMenu}>
                  <button
                    type="button"
                    onClick={() => tambah(m)}
                    className="w-full h-full min-h-28 flex flex-col gap-1 p-3.5 text-left rounded-lg border border-line bg-surface transition-colors duration-150 hover:border-brand hover:bg-brand-soft"
                  >
                    <span className="text-kartu font-bold text-ink leading-snug">{m.namaMenu}</span>
                    {!m.punyaResep && <span className="text-kecil font-semibold text-menipis-ink">Resep belum dipasangkan</span>}
                    <span className="mt-auto pt-1 text-kartu font-extrabold text-ink">{rupiah(m.hargaJual)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside aria-label="Nota berjalan" className="flex flex-col min-h-0 bg-surface border-t lg:border-t-0 lg:border-l border-line">
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-line">
          <h1 className="text-kartu font-extrabold text-ink">Nota berjalan</h1>
          <p className="text-kecil text-ink-3 break-all">{nomor.current}</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          {nota.length === 0 ? (
            <p className="py-8 text-center text-isi text-ink-3">Tekan menu untuk menambahkannya.</p>
          ) : (
            <ul>
              {nota.map((b) => (
                <li key={b.namaMenu} className="py-3 border-b border-line">
                  <p className="text-isi font-semibold text-ink">{b.namaMenu}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <PengaturJumlah
                      nilai={b.jumlah}
                      ubah={(n) => ubahJumlah(b.namaMenu, n)}
                      ukuran="kecil"
                      label={`Jumlah ${b.namaMenu}`}
                    />
                    <span className="text-isi font-bold text-ink">{rupiah(b.harga * b.jumlah)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-line">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-kartu font-bold text-ink">Total</span>
            <strong className="text-angka font-extrabold text-ink tracking-tight">{rupiah(total)}</strong>
          </div>
          <Tombol penuh ukuran="besar" className="mt-3" disabled={nota.length === 0} memuat={mengirim} onClick={kirim}>
            Kirim Nota
          </Tombol>
          <div role="status" className="min-h-5">
            {hasil && (
              <div className="mt-2 text-kecil leading-snug">
                <p className="font-semibold text-aman-ink">
                  Nota {rupiah(hasil.total)} terkirim.
                </p>
                {hasil.tanpaResep.length > 0 && (
                  <p className="mt-0.5 text-menipis-ink">Stok belum terpotong untuk {hasil.tanpaResep.join(', ')}, karena resepnya belum dipasangkan.</p>
                )}
                {hasil.stokKurang.length > 0 && (
                  <p className="mt-0.5 text-menipis-ink">Catatan stok {hasil.stokKurang.join(', ')} sudah habis.</p>
                )}
              </div>
            )}
          </div>
          {galatKirim && (
            <p role="alert" className="mt-2 text-kecil font-semibold text-kritis-ink leading-snug">
              {galatKirim}
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
