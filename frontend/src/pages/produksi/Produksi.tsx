import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChipStok } from '@/components/domain'
import { Avatar, Kartu, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { RUANG_LONCENG, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong, Penjelasan, Peringatan } from '@/components/ui/umpanBalik'
import { GrafikBatang } from '@/components/grafik/GrafikBatang'
import { IkonPanci, IkonPeringatan, IkonKirim } from '@/icons'
import { GalatApi } from '@/lib/api'
import {
  ambilKiriman,
  ambilRingkasanProduksi,
  ambilRiwayatProduksi,
  catatKiriman,
  catatProduksi,
} from '@/lib/apiProduksi'
import type { KirimanPembeli, ProdukJadi, RingkasanProduksi, SesiProduksi } from '@/lib/apiProduksi'
import { angka, bulanRingkas, rupiah, rupiahSumbu, tanggalLengkapHari, tanggalPanjang } from '@/lib/format'
import { NAV } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Produksi untuk UMKM produsen (permintaan dosen pengampu, 16 Okt 2026).
 *
 * Alurnya mengikuti dapur sungguhan: bahan baku dari tab Stok dimasak menjadi
 * barang jadi (tab "Produksi"), lalu barang jadi dikirim ke toko dan ritel yang
 * memesan (tab "Kiriman"). Setiap sesi masak memotong bahan sesuai resep, jadi
 * pemakaian bahan baku tercatat dan Mesin 1 bisa meramal kapan harus belanja.
 *
 * Halaman ini hanya punya data server. Data contoh tidak punya usaha produsen.
 */

type Tab = 'produksi' | 'kiriman'

const LABEL_PEMBELI: Record<string, string> = {
  'ritel-modern': 'Ritel modern',
  'toko-oleh-oleh': 'Toko oleh-oleh',
  katering: 'Katering',
  warung: 'Warung',
}

/** 110 gram → "110 g", 1.400 ml → "1,4 liter". Takaran resep memakai satuan dasar bahan. */
function jumlahBahan(n: number, satuan: string): string {
  if (satuan === 'gram') return n >= 1000 ? `${angka(n / 1000, 2)} kg` : `${angka(n, 1)} g`
  if (satuan === 'ml') return n >= 1000 ? `${angka(n / 1000, 2)} liter` : `${angka(n, 1)} ml`
  return `${angka(n, 1)} ${satuan}`
}

function statusJadi(p: ProdukJadi): 'aman' | 'menipis' | 'habis' {
  if (p.stok <= 0) return 'habis'
  if (p.stok < p.batasAman) return 'menipis'
  return 'aman'
}

export default function Produksi() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const jenis = useAplikasi((s) => s.profil.jenisUsaha)
  const memulihkan = useAplikasi((s) => s.memulihkanSesi)
  const [tab, setTab] = useState<Tab>('produksi')
  const [data, setData] = useState<{
    ringkasan: RingkasanProduksi
    riwayat: SesiProduksi[]
    kiriman: KirimanPembeli[]
  } | null>(null)
  const [gagal, setGagal] = useState(false)
  const [versi, setVersi] = useState(0)

  useEffect(() => {
    if (!sesi || jenis !== 'produksi-makanan') return
    let batal = false
    Promise.all([ambilRingkasanProduksi(sesi), ambilRiwayatProduksi(sesi), ambilKiriman(sesi)])
      .then(([ringkasan, riwayat, kiriman]) => {
        if (!batal) {
          setData({ ringkasan, riwayat, kiriman })
          setGagal(false)
        }
      })
      .catch(() => {
        if (!batal) setGagal(true)
      })
    return () => {
      batal = true
    }
  }, [sesi, jenis, versi])

  // Sesudah muat ulang halaman, sesi dipulihkan sebentar kemudian. Jangan
  // sempat menampilkan "halaman ini bukan untukmu" selama itu.
  if (!sesi && memulihkan) {
    return (
      <p className="pt-6 text-isi text-ink-3" role="status">
        Memuat data produksi…
      </p>
    )
  }

  if (!sesi || jenis !== 'produksi-makanan') {
    return (
      <div className="pb-8 lg:pb-0">
        <h1 className="text-judul font-extrabold text-ink tracking-tight">{NAV.produksi}</h1>
        <KeadaanKosong
          ikon={<IkonPanci size={26} />}
          judul="Halaman ini untuk usaha yang memproduksi barang"
          pesan="Catat sesi masak dan kiriman ke toko langganan di sini. Coba dengan akun simulasi produsen: Dapur Sambal Bu Ratmi."
          aksi={<TombolTautan ke="/masuk">Masuk dengan akun produsen</TombolTautan>}
        />
      </div>
    )
  }

  const muatUlang = () => setVersi((v) => v + 1)

  return (
    <div className="pb-8 lg:pb-0">
      <div data-sejajar-lonceng className={`flex items-baseline justify-between gap-3 flex-wrap ${RUANG_LONCENG}`}>
        <h1 className="text-judul font-extrabold text-ink tracking-tight">{NAV.produksi}</h1>
        {data && (
          <p className="text-isi text-ink-3">Data sampai {tanggalPanjang(data.ringkasan.tanggalAcuan)}</p>
        )}
      </div>
      <p className="mt-1 text-isi text-ink-2 leading-relaxed max-w-[62ch]">
        Setiap sesi masak memotong bahan baku sesuai resep, lalu hasilnya dikirim ke pemesan.
      </p>

      <TabSegmen<Tab>
        className="mt-4"
        tab={[
          { nilai: 'produksi', label: 'Produksi' },
          { nilai: 'kiriman', label: 'Kiriman ke pembeli', jumlah: data?.kiriman.length },
        ]}
        aktif={tab}
        ubah={setTab}
      />

      {gagal ? (
        <Peringatan nada="menipis" className="mt-4" judul="Data produksi belum bisa dibuka">
          Coba muat ulang sebentar lagi.
          <div className="mt-2.5">
            <Tombol ukuran="kecil" ragam="garis" onClick={muatUlang}>
              Muat ulang
            </Tombol>
          </div>
        </Peringatan>
      ) : !data ? (
        <p className="mt-6 text-isi text-ink-3" role="status">
          Memuat data produksi…
        </p>
      ) : tab === 'produksi' ? (
        <TabProduksi ringkasan={data.ringkasan} riwayat={data.riwayat} sesudahSimpan={muatUlang} />
      ) : (
        <TabKiriman ringkasan={data.ringkasan} kiriman={data.kiriman} sesudahSimpan={muatUlang} />
      )}
    </div>
  )
}

/* ================================================================== */
/* Tab Produksi                                                        */
/* ================================================================== */

function TabProduksi({
  ringkasan,
  riwayat,
  sesudahSimpan,
}: {
  ringkasan: RingkasanProduksi
  riwayat: SesiProduksi[]
  sesudahSimpan: () => void
}) {
  return (
    <div role="tabpanel" aria-label="Produksi" className="mt-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {ringkasan.produk.map((p) => (
          <KartuProduk key={p.id} produk={p} sesudahSimpan={sesudahSimpan} />
        ))}
      </div>
      <div className="max-w-[62ch]">
        <p className="text-kecil text-ink-3 leading-relaxed">
          Kebutuhan bahan baku diramal di halaman Prediksi.
        </p>
        <Penjelasan label="Cara menghitung perkiraan pesanan">
          Perkiraan pesanan 7 hari adalah rata-rata pesanan pada hari yang sama dalam 4 pekan terakhir, karena
          toko dan ritel memesan dengan jadwal mingguan.
        </Penjelasan>
      </div>

      <Kartu>
        <h2 className="text-kartu font-bold text-ink">Riwayat masak 3 pekan terakhir</h2>
        {riwayat.length === 0 ? (
          <p className="mt-2 text-isi text-ink-3">Belum ada sesi masak dalam 3 pekan terakhir.</p>
        ) : (
          /* Di desktop dibagi dua kolom, yang terbaru di kiri atas, supaya daftar
             sesi tiga pekan tidak memanjang dua layar (revisi V2, final touch).
             Di HP kedua bagian bersambung menjadi satu daftar. */
          <div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-10">
            {[riwayat.slice(0, Math.ceil(riwayat.length / 2)), riwayat.slice(Math.ceil(riwayat.length / 2))].map(
              (isi, k) =>
                isi.length > 0 && (
                  <ul key={k} className={`divide-y divide-line ${k === 1 ? 'max-lg:border-t max-lg:border-line' : ''}`}>
                    {isi.map((r) => (
                      <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-isi font-semibold text-ink truncate">{r.namaProduk}</span>
                          <span className="block text-kecil text-ink-3">
                            {tanggalLengkapHari(r.waktu)}
                            {r.oleh ? ` · ${r.oleh}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-isi font-bold text-ink tabular">{angka(r.jumlah)} toples</span>
                      </li>
                    ))}
                  </ul>
                ),
            )}
          </div>
        )}
      </Kartu>
    </div>
  )
}

function KartuProduk({ produk: p, sesudahSimpan }: { produk: ProdukJadi; sesudahSimpan: () => void }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const segarkanGudang = useAplikasi((s) => s.segarkanGudangServer)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [buka, setBuka] = useState(false)
  const [jumlah, setJumlah] = useState(() => Math.max(6, Math.min(p.saranProduksi || p.ukuranSesi, p.bisaDibuat)))
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  // Bahan pembatas: yang paling sedikit mencukupi. Bila stoknya kurang dari
  // saran masak, itulah bahan yang perlu dibeli lebih dulu.
  const pembatas = useMemo(
    () => [...p.resep].sort((a, b) => a.cukupUntuk - b.cukupUntuk)[0],
    [p.resep],
  )
  const kurangBahan = p.saranProduksi > 0 && p.bisaDibuat < p.saranProduksi

  async function simpan() {
    if (!sesi) return
    setMenyimpan(true)
    setGalat(null)
    try {
      await catatProduksi(sesi, p.id, jumlah)
      tampilkanRacun(`Tersimpan: ${angka(jumlah)} ${p.satuan} ${p.nama}. Bahan baku sudah dipotong.`, 'aman')
      setBuka(false)
      await segarkanGudang().catch(() => undefined)
      sesudahSimpan()
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Belum tersimpan. Periksa sambungan, lalu coba lagi.')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <Kartu>
      <div className="flex items-start gap-3">
        <Avatar nama={p.nama} ukuran={56} />
        <div className="min-w-0 grow">
          <h2 className="text-[1rem] font-bold text-ink leading-snug">{p.nama}</h2>
          <p className="text-isi text-ink-3">
            {p.isiBersih ? `${p.isiBersih} per ${p.satuan} · ` : ''}
            {rupiah(p.hargaJual)}/{p.satuan} ke pembeli
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-kecil font-semibold uppercase tracking-wide text-ink-3">Stok barang jadi</p>
          <p className="mt-1 text-[1.75rem] font-extrabold leading-none tracking-tight text-ink">
            {angka(p.stok)}
            <span className="ml-1.5 text-kartu font-semibold text-ink-3">{p.satuan}</span>
          </p>
        </div>
        <ChipStok status={statusJadi(p)} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-isi">
        <div>
          <dt className="text-ink-3">Perkiraan pesanan 7 hari</dt>
          <dd className="font-bold text-ink tabular">
            {angka(p.perkiraan7Hari)} {p.satuan}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Terkirim 28 hari terakhir</dt>
          <dd className="font-bold text-ink tabular">
            {angka(p.terjual28Hari)} {p.satuan}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Bisa dibuat dari bahan sekarang</dt>
          <dd className="font-bold text-ink tabular">
            {angka(p.bisaDibuat)} {p.satuan}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Saran masak</dt>
          <dd className="font-bold text-ink tabular">
            {p.saranProduksi > 0 ? `${angka(p.saranProduksi)} ${p.satuan}` : 'Stok sudah cukup'}
          </dd>
        </div>
      </dl>

      {kurangBahan && pembatas && (
        <Peringatan nada="menipis" className="mt-3" judul={
            p.bisaDibuat > 0
              ? `Bahan cukup untuk ${angka(p.bisaDibuat)} ${p.satuan} saja`
              : `Bahan belum cukup untuk satu ${p.satuan} pun`
          }>
          {pembatas.nama} paling cepat habis. Pesan dulu supaya saran masak bisa terpenuhi.
          <div className="mt-2">
            <Link
              to={`/stok/${pembatas.barangId}`}
              className="inline-flex items-center min-h-11 font-bold text-brand hover:underline"
            >
              Buka stok {pembatas.nama}
            </Link>
          </div>
        </Peringatan>
      )}

      <details className="mt-3 group">
        <summary className="cursor-pointer min-h-11 flex items-center text-isi font-semibold text-brand">
          Resep per {p.satuan} ({p.resep.length} bahan)
        </summary>
        <ul className="mt-1 divide-y divide-line text-isi">
          {p.resep.map((b) => (
            <li key={b.barangId} className="py-2 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-ink-2">{b.nama}</span>
              <span className="shrink-0 tabular text-ink font-semibold">{jumlahBahan(b.takaran, b.satuan)}</span>
            </li>
          ))}
        </ul>
      </details>

      {buka ? (
        <div className="mt-3 rounded-md border border-line p-3 bg-surface-2">
          <h3 className="text-isi font-bold text-ink">Catat sesi masak</h3>
          <div className="mt-2">
            <PengaturJumlah
              nilai={jumlah}
              ubah={setJumlah}
              langkah={6}
              min={1}
              maks={Math.max(1, p.bisaDibuat)}
              satuan={p.satuan}
              saranModel={p.saranProduksi > 0 ? Math.min(p.saranProduksi, p.bisaDibuat) : null}
              label={`Jumlah ${p.satuan} yang dimasak`}
            />
          </div>
          <p className="mt-3 text-kecil font-semibold uppercase tracking-wide text-ink-3">Bahan yang terpakai</p>
          <ul className="mt-1 text-isi divide-y divide-line">
            {p.resep.map((b) => {
              const pakai = b.takaran * jumlah
              const cukup = b.stok >= pakai
              return (
                <li key={b.barangId} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink-2">{b.nama}</span>
                  <span className={cukup ? 'shrink-0 tabular text-ink' : 'shrink-0 tabular text-kritis-ink font-bold'}>
                    {!cukup && <IkonPeringatan size={13} className="inline mr-1 -mt-0.5" />}
                    {jumlahBahan(pakai, b.satuan)} dari {jumlahBahan(b.stok, b.satuan)}
                  </span>
                </li>
              )
            })}
          </ul>
          {galat && (
            <p className="mt-2 text-isi text-kritis-ink" role="alert">
              {galat}
            </p>
          )}
          <div className="mt-3 flex gap-2 flex-wrap">
            <Tombol onClick={simpan} memuat={menyimpan} disabled={p.bisaDibuat < 1}>
              Simpan sesi masak
            </Tombol>
            <Tombol ragam="garis" onClick={() => setBuka(false)}>
              Batal
            </Tombol>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Tombol ikonKiri={<IkonPanci size={18} />} onClick={() => setBuka(true)} disabled={p.bisaDibuat < 1}>
            Catat produksi
          </Tombol>
          {p.bisaDibuat < 1 && (
            <p className="mt-1.5 text-isi text-ink-3">Bahan belum cukup untuk satu {p.satuan} pun.</p>
          )}
        </div>
      )}
    </Kartu>
  )
}

/* ================================================================== */
/* Tab Kiriman                                                         */
/* ================================================================== */

function TabKiriman({
  ringkasan,
  kiriman,
  sesudahSimpan,
}: {
  ringkasan: RingkasanProduksi
  kiriman: KirimanPembeli[]
  sesudahSimpan: () => void
}) {
  const batang = ringkasan.omsetBulanan.map((b, i, semua) => ({
    label: bulanRingkas(`${b.bulan}-01`),
    nilai: b.total,
    sorot: i === semua.length - 1,
  }))
  const bulanPenuh = ringkasan.omsetBulanan.slice(0, -1)
  const terakhir = bulanPenuh[bulanPenuh.length - 1]
  const awal = bulanPenuh[0]

  return (
    <div role="tabpanel" aria-label="Kiriman ke pembeli" className="mt-4 space-y-4">
      <Kartu>
        <h2 className="text-kartu font-bold text-ink">Nilai kiriman per bulan</h2>
        {awal && terakhir && (
          <p className="mt-0.5 text-isi text-ink-3 leading-snug">
            Dari {rupiah(awal.total)} ({bulanRingkas(`${awal.bulan}-01`)}) menjadi {rupiah(terakhir.total)} (
            {bulanRingkas(`${terakhir.bulan}-01`)}). Bulan terakhir baru berjalan sebagian.
          </p>
        )}
        <div className="mt-3 min-w-0">
          <GrafikBatang data={batang} satuan="Rupiah" format={rupiah} formatSumbu={rupiahSumbu} lebarSumbu={52} />
        </div>
      </Kartu>

      <FormKiriman ringkasan={ringkasan} sesudahSimpan={sesudahSimpan} />

      <section aria-labelledby="judul-pembeli">
        <h2 id="judul-pembeli" className="text-kartu font-bold text-ink">
          Pembeli langganan
        </h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          {ringkasan.pembeli.map((b) => (
            <li key={b.id}>
              <Kartu padat className="h-full">
                <div className="flex items-start gap-3">
                  <Avatar nama={b.nama} ukuran={40} />
                  <div className="min-w-0">
                    <h3 className="text-kartu font-bold text-ink leading-snug">{b.nama}</h3>
                    <p className="text-kecil text-ink-3">
                      {LABEL_PEMBELI[b.jenis] ?? b.jenis}
                      {b.kota ? ` · ${b.kota}` : ''}
                    </p>
                  </div>
                </div>
                {b.ketentuan && <p className="mt-2 text-isi text-ink-2 leading-snug">{b.ketentuan}</p>}
                <p className="mt-2 text-isi text-ink">
                  <span className="font-bold tabular">{b.kiriman28Hari} kiriman</span> senilai{' '}
                  <span className="font-bold tabular">{rupiah(b.nilai28Hari)}</span> dalam 28 hari
                </p>
              </Kartu>
            </li>
          ))}
        </ul>
      </section>

      <Kartu>
        <h2 className="text-kartu font-bold text-ink">Kiriman 3 pekan terakhir</h2>
        {kiriman.length === 0 ? (
          <p className="mt-2 text-isi text-ink-3">Belum ada kiriman dalam 3 pekan terakhir.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {kiriman.map((k) => (
              <li key={k.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-isi font-semibold text-ink truncate">{k.namaPembeli}</span>
                    <span className="block text-kecil text-ink-3">
                      {k.nomor} · {tanggalLengkapHari(k.waktu)}
                    </span>
                  </span>
                  <span className="shrink-0 text-isi font-bold text-ink tabular">{rupiah(k.total)}</span>
                </div>
                <p className="mt-0.5 text-isi text-ink-2">
                  {k.baris.map((b) => `${angka(b.jumlah)} ${b.nama}`).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </div>
  )
}

function FormKiriman({ ringkasan, sesudahSimpan }: { ringkasan: RingkasanProduksi; sesudahSimpan: () => void }) {
  const sesi = useAplikasi((s) => s.sesiServer)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [pembeliId, setPembeliId] = useState<number>(ringkasan.pembeli[0]?.id ?? 0)
  const [jumlah, setJumlah] = useState<Record<number, number>>({})
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const baris = ringkasan.produk
    .map((p) => ({ produkJadiId: p.id, jumlah: jumlah[p.id] ?? 0 }))
    .filter((b) => b.jumlah > 0)
  const total = ringkasan.produk.reduce((t, p) => t + (jumlah[p.id] ?? 0) * p.hargaJual, 0)

  async function simpan() {
    if (!sesi || baris.length === 0) return
    setMenyimpan(true)
    setGalat(null)
    try {
      const k = await catatKiriman(sesi, pembeliId, baris)
      tampilkanRacun(`Kiriman ${k.nomor} ke ${k.namaPembeli} tercatat. Stok barang jadi berkurang.`, 'aman')
      setJumlah({})
      sesudahSimpan()
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Belum tersimpan. Periksa sambungan, lalu coba lagi.')
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <Kartu>
      <h2 className="text-kartu font-bold text-ink inline-flex items-center gap-2">
        <IkonKirim size={18} />
        Catat kiriman
      </h2>
      <label className="mt-3 block text-isi font-semibold text-ink-2" htmlFor="pilih-pembeli">
        Pembeli
      </label>
      <select
        id="pilih-pembeli"
        value={pembeliId}
        onChange={(e) => setPembeliId(Number(e.target.value))}
        className="mt-1 w-full h-11 rounded-md border border-line-strong bg-surface px-3 text-kartu text-ink"
      >
        {ringkasan.pembeli.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nama}
          </option>
        ))}
      </select>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {ringkasan.produk.map((p) => (
          <div key={p.id}>
            <p className="mb-1.5 flex items-center gap-2 text-isi font-semibold text-ink">
              <Avatar nama={p.nama} ukuran={28} />
              {p.nama}
            </p>
            <PengaturJumlah
              nilai={jumlah[p.id] ?? 0}
              ubah={(n) => setJumlah((j) => ({ ...j, [p.id]: n }))}
              langkah={6}
              min={0}
              maks={p.stok}
              satuan={p.satuan}
              label={p.nama}
            />
            <p className="mt-1 text-kecil text-ink-3">
              Stok {angka(p.stok)} {p.satuan}
            </p>
          </div>
        ))}
      </div>
      {galat && (
        <p className="mt-2 text-isi text-kritis-ink" role="alert">
          {galat}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-isi text-ink-2">
          Nilai kiriman <strong className="text-ink tabular">{rupiah(total)}</strong>
        </p>
        <Tombol onClick={simpan} memuat={menyimpan} disabled={baris.length === 0 || !pembeliId}>
          Simpan kiriman
        </Tombol>
      </div>
      {ringkasan.produk.every((p) => p.stok <= 0) && (
        <Lencana nada="menipis" ikon={<IkonPeringatan size={13} />} className="mt-2">
          Stok barang jadi habis. Catat produksi dulu.
        </Lencana>
      )}
    </Kartu>
  )
}
