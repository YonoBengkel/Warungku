import { useEffect, useMemo, useRef, useState } from 'react'
import { Kerangka, Tombol } from '@/components/ui/dasar'
import { Kolom, PengaturJumlah } from '@/components/ui/formulir'
import { Chip } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCari, IkonNota } from '@/icons'
import { GalatApi } from '@/lib/api'
import { GambarQr } from '@/components/domain/GambarQr'
import { ambilShiftAktif, buatQr, lunaskanQr, statusQr, type Shift, type TagihanQr } from '@/lib/apiKasir'
import { ambilMenuJual, kirimNota, type MenuJual } from '@/lib/apiMenu'
import { angka, bacaAngkaIndonesia, jam, rupiah, tanggalPendek } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'
import { BukaKas } from './BukaKas'

/** Transfer tidak lagi ditawarkan sejak revisi V8 (Q179). Nota lama bertransfer tetap terbaca di daftar nota. */
type CaraBayar = 'tunai' | 'qris'

const CARA: Array<{ nilai: CaraBayar; label: string }> = [
  { nilai: 'tunai', label: 'Tunai' },
  { nilai: 'qris', label: 'QRIS' },
]

/** Seberapa sering layar kasir menanyakan apakah QR simulasi sudah dipindai. */
const JEDA_CEK_QR = 1500
const UANG_CEPAT = [50_000, 100_000]

interface BarisNota {
  namaMenu: string
  harga: number
  jumlah: number
}

/** Isi struk yang tampil sesudah nota diterima. Angkanya dibekukan saat dikirim. */
interface Struk {
  nomor: string
  waktu: Date
  baris: BarisNota[]
  subtotal: number
  diskon: number
  total: number
  caraBayar: CaraBayar
  uang: number | null
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

/** Angka Rupiah yang diketik kasir. Kosong atau tidak terbaca dianggap 0. */
function bacaRupiah(teks: string): number {
  const n = bacaAngkaIndonesia(teks)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/**
 * Layar kasir (Portal POS): kisi menu di kiri, nota berjalan di kanan.
 * Menu, harga, dan resep diatur pemilik di Portal UMKM, jadi di sini hanya dibaca.
 * Menu tanpa resep tetap bisa dijual: notanya masuk, tetapi stok bahannya belum
 * terpotong, dan pemiliknya melihatnya sebagai menu yang perlu dipasangkan.
 *
 * Pembayaran hanya dicatat (tahap 3): tunai dengan kembalian, atau QRIS. Uangnya tidak
 * lewat aplikasi ini. Uang tunai yang dikosongkan dianggap pas.
 *
 * QRIS memakai QR simulasi (revisi V8, Q178): layar menampilkan QR berisi tautan ke
 * server, HP pelanggan membukanya di jaringan yang sama, dan nota baru dikirim sesudah
 * tagihannya lunas. Bukan QRIS sungguhan. Tombol "Anggap Sudah Dibayar" menjadi
 * cadangan kalau HP tidak bisa menjangkau laptop (Wi-Fi kampus sering memblokirnya).
 */
export default function Kasir() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const profil = useAplikasi((s) => s.profil)
  const [menu, setMenu] = useState<MenuJual[] | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [kategori, setKategori] = useState(SEMUA)
  const [cari, setCari] = useState('')
  const [nota, setNota] = useState<BarisNota[]>([])
  const [caraBayar, setCaraBayar] = useState<CaraBayar>('tunai')
  const [diskonTeks, setDiskonTeks] = useState('')
  const [uangTeks, setUangTeks] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [galatKirim, setGalatKirim] = useState<string | null>(null)
  const [struk, setStruk] = useState<Struk | null>(null)
  const [tagihan, setTagihan] = useState<TagihanQr | null>(null)
  const [membuatQr, setMembuatQr] = useState(false)
  const [galatQr, setGalatQr] = useState<string | null>(null)
  const nomor = useRef(buatNomor())
  // undefined: belum dicek. null: belum ada shift terbuka, jadi kasir diminta membuka kas lebih dulu.
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  // Gagal dicek tidak sama dengan belum ada shift: dulu kasir langsung diminta membuka
  // kas, padahal shift-nya mungkin sudah berjalan (audit 3 Nov 2026).
  const [galatShift, setGalatShift] = useState<string | null>(null)

  function periksaShift() {
    if (!sesi) return
    setGalatShift(null)
    ambilShiftAktif(sesi)
      .then(setShift)
      .catch((e: unknown) =>
        setGalatShift(
          e instanceof GalatApi ? e.message : 'Shift yang sedang berjalan belum bisa dicek. Periksa sambungan, lalu coba lagi.',
        ),
      )
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- dicek ulang hanya saat sesi berganti
  useEffect(periksaShift, [sesi])

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

  const subtotal = nota.reduce((a, b) => a + b.harga * b.jumlah, 0)
  const diskonDiminta = bacaRupiah(diskonTeks)
  const diskon = Math.min(diskonDiminta, subtotal)
  const total = subtotal - diskon
  const uangDiketik = bacaRupiah(uangTeks)
  const uang = uangTeks.trim() === '' ? total : uangDiketik
  const kurang = caraBayar === 'tunai' ? Math.max(0, total - uang) : 0
  const bisaKirim = nota.length > 0 && !mengirim && kurang === 0

  function tambah(m: MenuJual) {
    // Selama QR simulasi tampil, jumlah tagihannya sudah dibekukan di server.
    if (tagihan) return
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
    if (!sesi || !bisaKirim) return
    setMengirim(true)
    setGalatKirim(null)
    try {
      const h = await kirimNota(
        sesi,
        nomor.current,
        nota.map((b) => ({ namaMenu: b.namaMenu, jumlah: b.jumlah, satuan: 'porsi', harga: b.harga })),
        'Portal POS',
        { caraBayar, diskon, uangDiterima: caraBayar === 'tunai' ? uang : null },
      )
      setStruk({
        nomor: nomor.current,
        waktu: new Date(),
        baris: nota,
        subtotal,
        diskon,
        total,
        caraBayar,
        uang: caraBayar === 'tunai' ? uang : null,
        tanpaResep: h.takDikenali,
        stokKurang: h.stokKurang,
      })
    } catch (e) {
      setGalatKirim(e instanceof GalatApi ? e.message : 'Nota belum terkirim. Isinya masih aman, coba kirim lagi.')
    } finally {
      setMengirim(false)
    }
  }

  async function mulaiQr() {
    if (!sesi || !bisaKirim) return
    setMembuatQr(true)
    setGalatQr(null)
    try {
      setTagihan(await buatQr(sesi, nomor.current, total))
    } catch (e) {
      setGalatQr(e instanceof GalatApi ? e.message : 'QR belum bisa dibuat. Periksa sambungan, lalu coba lagi.')
    } finally {
      setMembuatQr(false)
    }
  }

  async function anggapDibayar() {
    if (!sesi || !tagihan) return
    setGalatQr(null)
    try {
      setTagihan(await lunaskanQr(sesi, tagihan.token))
    } catch (e) {
      setGalatQr(e instanceof GalatApi ? e.message : 'Belum bisa ditandai lunas. Coba lagi.')
    }
  }

  // Tanyakan status tagihan selama menunggu dipindai, dan berhenti begitu lunas
  // atau kedaluwarsa. Hanya selama tab ini terlihat, seperti pengecekan nota masuk.
  const tokenMenunggu = tagihan?.status === 'menunggu' ? tagihan.token : null
  useEffect(() => {
    if (!sesi || !tokenMenunggu) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      statusQr(sesi, tokenMenunggu)
        .then((q) => {
          if (q.status !== 'menunggu') setTagihan(q)
        })
        .catch(() => undefined)
    }, JEDA_CEK_QR)
    return () => window.clearInterval(id)
  }, [sesi, tokenMenunggu])

  // Lunas, lewat pindai maupun tombol: kirim notanya sekali saja.
  const sudahDikirim = useRef<string | null>(null)
  useEffect(() => {
    if (tagihan?.status !== 'lunas' || sudahDikirim.current === tagihan.token) return
    sudahDikirim.current = tagihan.token
    void kirim()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kirim memakai keadaan nota saat itu
  }, [tagihan])

  function transaksiBaru() {
    setTagihan(null)
    setGalatQr(null)
    setStruk(null)
    setNota([])
    setDiskonTeks('')
    setUangTeks('')
    setCaraBayar('tunai')
    setGalatKirim(null)
    nomor.current = buatNomor()
  }

  if (galatShift)
    return (
      <div className="p-4 sm:p-6 max-w-xl">
        <Peringatan
          nada="kritis"
          judul="Shift belum bisa dicek"
          aksi={
            <Tombol ragam="garis" ukuran="kecil" onClick={periksaShift}>
              Coba Lagi
            </Tombol>
          }
        >
          {galatShift}
        </Peringatan>
      </div>
    )
  if (shift === null) return <BukaKas onBuka={setShift} />

  return (
    <div className="h-full lg:grid lg:grid-cols-[minmax(0,1fr)_23rem]">
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
              pesan="Pemilik usaha mengatur menu dan harganya di Portal UMKM, tab Produksi."
            />
          ) : tampil.length === 0 ? (
            <KeadaanKosong ikon={<IkonCari size={26} />} judul="Menu tidak ditemukan" pesan="Coba kata lain, atau pilih kategori Semua." />
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 [&>*]:min-w-0">
              {tampil.map((m) => (
                <li key={m.namaMenu}>
                  <button
                    type="button"
                    disabled={struk !== null || tagihan !== null}
                    onClick={() => tambah(m)}
                    className="w-full h-full min-h-28 flex flex-col gap-1 p-3.5 text-left rounded-lg border border-line bg-surface transition-colors duration-150 hover:border-brand hover:bg-brand-soft disabled:opacity-55 disabled:hover:border-line disabled:hover:bg-surface"
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

      <aside aria-label={struk ? 'Struk' : 'Nota berjalan'} className="flex flex-col min-h-0 bg-surface border-t lg:border-t-0 lg:border-l border-line">
        {struk ? (
          <StrukLayar struk={struk} namaUsaha={profil.namaUsaha} onBaru={transaksiBaru} />
        ) : tagihan ? (
          <PanelQr
            tagihan={tagihan}
            mengirim={mengirim}
            galat={galatQr ?? galatKirim}
            onAnggapDibayar={anggapDibayar}
            onQrBaru={mulaiQr}
            membuatQr={membuatQr}
            onBatal={() => {
              setTagihan(null)
              setGalatQr(null)
            }}
          />
        ) : (
          <>
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

            <div className="shrink-0 p-4 border-t border-line space-y-3">
              <Kolom
                label="Diskon"
                awalan="Rp"
                inputMode="numeric"
                value={diskonTeks}
                disabled={nota.length === 0}
                bantuan={diskonDiminta > subtotal && subtotal > 0 ? `Diskon dibatasi sebesar belanja, ${rupiah(subtotal)}.` : undefined}
                onChange={(e) => setDiskonTeks(e.target.value)}
              />

              <div>
                <p className="text-isi font-semibold text-ink mb-1.5">Cara bayar</p>
                <div className="flex flex-wrap gap-2">
                  {CARA.map((c) => (
                    <Chip key={c.nilai} aktif={caraBayar === c.nilai} onClick={() => setCaraBayar(c.nilai)}>
                      {c.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {caraBayar === 'tunai' ? (
                <div>
                  <Kolom
                    label="Uang diterima"
                    bantuan="Kosongkan kalau uangnya pas."
                    awalan="Rp"
                    inputMode="numeric"
                    value={uangTeks}
                    disabled={nota.length === 0}
                    onChange={(e) => setUangTeks(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Tombol ragam="garis" ukuran="kecil" disabled={nota.length === 0} onClick={() => setUangTeks('')}>
                      Uang Pas
                    </Tombol>
                    {UANG_CEPAT.map((u) => (
                      <Tombol key={u} ragam="garis" ukuran="kecil" disabled={nota.length === 0} onClick={() => setUangTeks(String(u))}>
                        {angka(u)}
                      </Tombol>
                    ))}
                  </div>
                  {nota.length > 0 && (
                    <p role="status" className={kurang > 0 ? 'mt-2 text-isi font-bold text-kritis-ink' : 'mt-2 text-isi font-bold text-aman-ink'}>
                      {kurang > 0 ? `Uang kurang ${rupiah(kurang)}` : `Kembalian ${rupiah(uang - total)}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-kecil text-ink-2 leading-snug">
                  Pelanggan memindai QR simulasi dari layar ini dengan HP. Bukan QRIS sungguhan, tidak ada uang yang berpindah.
                </p>
              )}

              <div>
                {diskon > 0 && (
                  <>
                    <p className="flex justify-between text-isi text-ink-2">
                      <span>Subtotal</span>
                      <span className="tabular">{rupiah(subtotal)}</span>
                    </p>
                    <p className="flex justify-between text-isi text-ink-2">
                      <span>Diskon</span>
                      <span className="tabular">-{rupiah(diskon)}</span>
                    </p>
                  </>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-kartu font-bold text-ink">Total</span>
                  <strong className="text-angka font-extrabold text-ink tracking-tight">{rupiah(total)}</strong>
                </div>
              </div>

              {caraBayar === 'qris' ? (
                <Tombol penuh ukuran="besar" disabled={!bisaKirim} memuat={membuatQr} onClick={mulaiQr}>
                  Tampilkan QR Pembayaran
                </Tombol>
              ) : (
                <Tombol penuh ukuran="besar" disabled={!bisaKirim} memuat={mengirim} onClick={kirim}>
                  Bayar dan Kirim Nota
                </Tombol>
              )}
              {(galatKirim || galatQr) && (
                <p role="alert" className="text-kecil font-semibold text-kritis-ink leading-snug">
                  {galatQr ?? galatKirim}
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

const NAMA_CARA: Record<CaraBayar, string> = { tunai: 'Tunai', qris: 'QRIS' }

/**
 * Panel kanan selama QR simulasi menunggu dipindai. Nota baru dikirim sesudah lunas,
 * jadi menekan Batal tidak meninggalkan nota apa pun: tagihannya kedaluwarsa sendiri.
 */
function PanelQr({
  tagihan,
  mengirim,
  galat,
  membuatQr,
  onAnggapDibayar,
  onQrBaru,
  onBatal,
}: {
  tagihan: TagihanQr
  mengirim: boolean
  galat: string | null
  membuatQr: boolean
  onAnggapDibayar: () => void
  onQrBaru: () => void
  onBatal: () => void
}) {
  const kedaluwarsa = tagihan.status === 'kedaluwarsa'
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center text-center">
      <span className="rounded-full bg-brand-soft px-3 py-1 text-kecil font-bold text-brand-soft-ink">
        Simulasi, bukan QRIS sungguhan
      </span>
      <h1 className="mt-3 text-kartu font-extrabold text-ink">Pindai untuk membayar</h1>
      <p className="mt-1 text-angka font-extrabold text-ink tracking-tight">{rupiah(tagihan.jumlah)}</p>

      <div className={kedaluwarsa ? 'mt-4 opacity-30' : 'mt-4'}>
        <GambarQr isi={tagihan.url} label={`QR simulasi pembayaran ${rupiah(tagihan.jumlah)}`} />
      </div>

      <p role="status" className="mt-3 text-isi font-semibold text-ink-2">
        {mengirim
          ? 'Lunas. Mengirim nota\u2026'
          : tagihan.status === 'lunas'
            ? 'Lunas.'
            : kedaluwarsa
              ? 'QR ini sudah kedaluwarsa. Buat QR baru.'
              : 'Menunggu dipindai dari HP pelanggan\u2026'}
      </p>

      {!tagihan.terjangkauHp && !kedaluwarsa && (
        <Peringatan nada="menipis" className="mt-3 text-left" judul="HP mungkin tidak bisa membuka QR ini">
          Alamat jaringan laptop tidak diketahui. Pakai tombol Anggap Sudah Dibayar.
        </Peringatan>
      )}
      <p className="mt-2 text-kecil text-ink-3 leading-snug max-w-[18rem]">
        HP dan laptop harus di jaringan yang sama. Kalau Wi-Fi memblokir, sambungkan laptop ke hotspot HP.
      </p>

      <div className="mt-4 w-full space-y-2">
        {kedaluwarsa ? (
          <Tombol penuh memuat={membuatQr} onClick={onQrBaru}>
            Buat QR Baru
          </Tombol>
        ) : (
          <Tombol penuh ragam="garis" disabled={tagihan.status === 'lunas' || mengirim} onClick={onAnggapDibayar}>
            Anggap Sudah Dibayar
          </Tombol>
        )}
        <Tombol penuh ragam="sunyi" disabled={mengirim} onClick={onBatal}>
          Batal
        </Tombol>
      </div>
      {galat && (
        <p role="alert" className="mt-3 text-kecil font-semibold text-kritis-ink leading-snug">
          {galat}
        </p>
      )}
    </div>
  )
}

/** Struk di layar sesudah nota diterima. Satu-satunya tombolnya membuka transaksi baru. */
function StrukLayar({ struk, namaUsaha, onBaru }: { struk: Struk; namaUsaha: string; onBaru: () => void }) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <h1 className="text-kartu font-extrabold text-aman-ink">Nota terkirim</h1>
        <div className="mt-3 pb-3 border-b border-dashed border-line-strong text-center">
          <p className="text-kartu font-extrabold text-ink">{namaUsaha}</p>
          <p className="text-kecil text-ink-3">
            {tanggalPendek(struk.waktu)}, {jam(struk.waktu)} &middot; Portal POS
          </p>
          <p className="text-kecil text-ink-3 break-all">{struk.nomor}</p>
        </div>

        <ul className="py-3 border-b border-dashed border-line-strong space-y-1.5">
          {struk.baris.map((b) => (
            <li key={b.namaMenu} className="text-isi text-ink">
              <span className="font-semibold">{b.namaMenu}</span>
              <span className="flex justify-between text-ink-2">
                <span>
                  {angka(b.jumlah)} &times; {rupiah(b.harga)}
                </span>
                <span className="tabular">{rupiah(b.harga * b.jumlah)}</span>
              </span>
            </li>
          ))}
        </ul>

        <dl className="py-3 text-isi text-ink-2 space-y-1">
          {struk.diskon > 0 && (
            <>
              <Baris label="Subtotal" nilai={rupiah(struk.subtotal)} />
              <Baris label="Diskon" nilai={`-${rupiah(struk.diskon)}`} />
            </>
          )}
          <Baris label="Total" nilai={rupiah(struk.total)} tebal />
          <Baris label="Cara bayar" nilai={NAMA_CARA[struk.caraBayar]} />
          {struk.uang !== null && (
            <>
              <Baris label="Uang diterima" nilai={rupiah(struk.uang)} />
              <Baris label="Kembalian" nilai={rupiah(struk.uang - struk.total)} tebal />
            </>
          )}
        </dl>

        <div role="status" className="text-kecil leading-snug space-y-1">
          {struk.tanpaResep.length > 0 && (
            <p className="text-menipis-ink">
              Stok belum terpotong untuk {struk.tanpaResep.join(', ')}, karena resepnya belum dipasangkan.
            </p>
          )}
          {struk.stokKurang.length > 0 && <p className="text-menipis-ink">Catatan stok {struk.stokKurang.join(', ')} sudah habis.</p>}
        </div>
      </div>
      <div className="shrink-0 p-4 border-t border-line">
        <Tombol penuh ukuran="besar" onClick={onBaru} autoFocus>
          Transaksi Baru
        </Tombol>
      </div>
    </>
  )
}

function Baris({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className={tebal ? 'flex justify-between font-extrabold text-ink' : 'flex justify-between'}>
      <dt>{label}</dt>
      <dd className="tabular">{nilai}</dd>
    </div>
  )
}
