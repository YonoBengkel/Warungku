import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Barang, RekomendasiPrediksi } from '@/lib/types'
import { ChipStok } from '@/components/domain'
import { BarisData, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { BarisChip, BilahAksi, Chip } from '@/components/ui/navigasi'
import { PengaturJumlah } from '@/components/ui/formulir'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { GrafikTren } from '@/components/grafik/GrafikTren'
import { GrafikBatang, Percikan } from '@/components/grafik/GrafikBatang'
import {
  IkonGrafik,
  IkonKembali,
  IkonKeranjang,
  IkonKotak,
  IkonPanahKanan,
  IkonToko,
  IkonTrenNaik,
  IkonTrenTurun,
} from '@/icons'
import { angka, cx, rupiah } from '@/lib/format'
import { angkaTampil, jumlahTampil, satuanTampil, trenTampil } from '@/lib/satuan'
import { JUDUL, LABEL_ARAH_PREDIKSI, NADA_ARAH_PREDIKSI } from '@/lib/label'
import {
  hargaBerlaku,
  kategoriBarang,
  layakDiperkirakan,
  penawaranById,
  rekomendasiDari,
  ringkasanKategori,
  statusStok,
  trenBulanan,
  trenKategori,
  trenKeseluruhan,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Halaman Prediksi: satu halaman, tiga keadaan, dibedakan oleh query string.
 *
 * 1. `/prediksi`                 — keseluruhan usaha lalu perbandingan kategori.
 * 2. `/prediksi?kategori=...`    — satu kategori beserta semua barang di dalamnya.
 * 3. `/prediksi?barang=b-01`     — satu barang: tren, alasan, dan tombol pesan.
 *
 * Alasan ketiganya tinggal di satu berkas dan satu alamat: pemilik usaha masuk
 * dari dua pintu yang berbeda (tab di bawah, dan kartu rekomendasi di Beranda)
 * tetapi sedang menjawab satu pertanyaan yang sama — "bulan depan saya perlu
 * berapa, dan kenapa segitu". Memecahnya menjadi tiga halaman akan memutus
 * jalan pulang dari detail barang ke kategorinya.
 *
 * Dua janji yang dipegang layar ini:
 * 1. Tidak ada angka perkiraan yang berdiri tanpa kalimat bahwa ia bisa
 *    meleset. Perkiraan yang terlihat pasti lebih berbahaya daripada tidak ada
 *    perkiraan sama sekali.
 * 2. Angka gabungan lintas barang selalu disertai pengakuan bahwa satuannya
 *    dijumlahkan walaupun berbeda. Yang boleh dibaca dari grafik gabungan cuma
 *    bentuk kurvanya.
 *
 * Yang sengaja tidak ada: harga jual, omzet, dan margin. Harga yang muncul di
 * bilah bawah adalah perkiraan biaya beli ke distributor, bukan pendapatan.
 */

/** Grafik gabungan menjumlahkan gram, ml, dan pcs sekaligus, jadi satuannya netral. */
const SATUAN_GABUNGAN = 'satuan'

const KALIMAT_MELESET =
  'Semua angka di halaman ini perkiraan yang disusun dari pemakaian yang sudah tercatat. Perkiraan bisa meleset, jadi pakai sebagai saran, bukan jaminan.'

const KALIMAT_GABUNGAN =
  'Angka pada grafik ini menjumlahkan satuan yang berbeda — gram, ml, dan pcs dihitung jadi satu. Yang bisa kamu baca dari sini bentuk kurvanya, naik atau turun, bukan besar angkanya.'

/**
 * Keyakinan model ditulis sebagai kata.
 *
 * "0,74" tidak memberi tahu pemilik warung apa pun yang bisa ditindaklanjuti,
 * sementara "sedang" langsung terbaca sebagai "boleh dipakai, tapi jangan
 * dipertaruhkan".
 */
function kataKeyakinan(n: number): { teks: string; nada: 'aman' | 'menipis' | 'netral' } {
  if (n >= 0.8) return { teks: 'cukup mantap', nada: 'aman' }
  if (n >= 0.7) return { teks: 'sedang', nada: 'menipis' }
  return { teks: 'masih kasar', nada: 'netral' }
}

/**
 * Arah sebuah kategori.
 *
 * Hasilnya sengaja memisahkan `gerak` (dipakai memilih ikon) dari `kata`
 * (dibaca pengguna) dan `warna`, supaya arah selalu tersampaikan lewat ikon
 * DAN teks, tidak pernah lewat warna saja.
 */
function arahKategori(
  sekarang: number,
  nanti: number,
): { gerak: 'naik' | 'turun' | 'datar'; kata: string; warna: string } {
  const beda = sekarang > 0 ? Math.round(((nanti - sekarang) / sekarang) * 100) : 0
  if (beda >= 3) return { gerak: 'naik', kata: `naik ${beda}%`, warna: 'text-menipis-ink' }
  if (beda <= -3) return { gerak: 'turun', kata: `turun ${Math.abs(beda)}%`, warna: 'text-info-ink' }
  return { gerak: 'datar', kata: 'hampir sama', warna: 'text-ink-3' }
}

/**
 * Kalimat lencana saran, dipisah per arah.
 *
 * Kata bakunya tetap diambil dari LABEL_ARAH_PREDIKSI, tapi arah "tetap"
 * dirangkai berbeda: menempelkan angka langsung ke katanya akan berbunyi
 * "cukup 12 kg", yang terbaca seperti perintah membeli 12 kg padahal artinya
 * stoknya memang sudah cukup.
 */
function kalimatSaran(r: RekomendasiPrediksi): string {
  const banyak = `${angka(r.jumlah)} ${r.satuanSaran}`
  if (r.arah === 'tetap') return `Stok dinilai ${LABEL_ARAH_PREDIKSI.tetap}, perlu sekitar ${banyak} bulan depan`
  return `Saran ${LABEL_ARAH_PREDIKSI[r.arah]} ${banyak} bulan depan`
}

/**
 * Nama kategori dipendekkan khusus untuk label batang: tujuh label lengkap
 * saling menimpa di layar sempit. Nama utuhnya tetap ada pada daftar di bawah
 * grafik, jadi tidak ada keterangan yang hilang.
 */
function labelPendek(kategori: string): string {
  const kata = kategori.split(' ')[0]
  return kata.length > 9 ? `${kata.slice(0, 8)}…` : kata
}

export default function Prediksi() {
  const barang = useAplikasi((s) => s.barang)
  const [param, setParam] = useSearchParams()

  /* Nilai yang tidak dikenali dikembalikan ke bawaan, bukan dibiarkan kosong:
     alamat halaman bisa saja diketik sendiri atau dibagikan dari versi lama. */
  const kategoriMentah = param.get('kategori') ?? ''
  const kategori = kategoriBarang.includes(kategoriMentah) ? kategoriMentah : ''
  const barangMentah = param.get('barang') ?? ''
  const barangTerpilih = barangMentah ? barang.find((b) => b.id === barangMentah) : undefined

  function aturParam(ubahan: Record<string, string | null>) {
    const p = new URLSearchParams(param)
    for (const [kunci, nilai] of Object.entries(ubahan)) {
      if (nilai == null || nilai === '') p.delete(kunci)
      else p.set(kunci, nilai)
    }
    setParam(p, { replace: true })
  }

  function alamat(ubahan: Record<string, string | null>): string {
    const p = new URLSearchParams(param)
    for (const [kunci, nilai] of Object.entries(ubahan)) {
      if (nilai == null || nilai === '') p.delete(kunci)
      else p.set(kunci, nilai)
    }
    const kueri = p.toString()
    return kueri ? `/prediksi?${kueri}` : '/prediksi'
  }

  const trenAtas = useMemo(
    () => (kategori ? trenKategori(kategori) : trenKeseluruhan()),
    [kategori],
  )
  const ringkasan = useMemo(() => ringkasanKategori(), [])
  const barangKategori = useMemo(
    () => (kategori ? barang.filter((b) => b.kategori === kategori) : []),
    [barang, kategori],
  )

  return (
    <div className="pb-8">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">{JUDUL.prediksi}</h1>
        <p className="text-[0.8125rem] text-ink-3">Perkiraan untuk bulan depan</p>
      </div>
      <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed max-w-[62ch]">{KALIMAT_MELESET}</p>

      {barangMentah && !barangTerpilih ? (
        /* Tautan lama atau id yang salah salin. Halaman tidak boleh jadi buntu. */
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini sudah tidak ada di daftar"
          pesan="Mungkin barangnya sudah dihapus, atau tautannya sudah lama. Perkiraan untuk barang lain masih bisa kamu buka dari daftar kategori."
          aksi={<TombolTautan ke="/prediksi">Lihat perkiraan keseluruhan</TombolTautan>}
          aksiKedua={
            <TombolTautan ke="/stok" ragam="garis">
              Buka Daftar Stok
            </TombolTautan>
          }
        />
      ) : barangTerpilih ? (
        /* Diberi kunci supaya jumlah pesanan kembali ke saran model setiap kali
           barangnya berganti, bukan membawa angka barang sebelumnya. */
        <DetailBarang
          key={barangTerpilih.id}
          barang={barangTerpilih}
          kembaliKe={alamat({ barang: null })}
          labelKembali={kategori ? `Kembali ke ${kategori}` : 'Kembali ke semua kategori'}
        />
      ) : (
        <>
          {/* -------- Pemilih kategori: geser mendatar di wadahnya sendiri -------- */}
          <BarisChip className="mt-4">
            <Chip aktif={!kategori} onClick={() => aturParam({ kategori: null, barang: null })}>
              Semua kategori
            </Chip>
            {kategoriBarang.map((k) => (
              <Chip
                key={k}
                aktif={k === kategori}
                onClick={() => aturParam({ kategori: k, barang: null })}
              >
                {k}
              </Chip>
            ))}
          </BarisChip>

          <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
            {/* -------- Grafik atas: keseluruhan usaha atau satu kategori -------- */}
            <section
              aria-labelledby="judul-tren-atas"
              className="lg:col-span-7 min-w-0"
            >
              <Kartu>
                <h2 id="judul-tren-atas" className="text-[0.9375rem] font-bold text-ink leading-tight">
                  {kategori ? `Pemakaian ${kategori}` : 'Pemakaian seluruh barang'}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
                  Enam bulan yang sudah tercatat dan satu bulan perkiraan.
                </p>

                <div className="mt-3 min-w-0">
                  <GrafikTren data={trenAtas} satuan={SATUAN_GABUNGAN} tinggi={200} />
                </div>

                <Peringatan nada="netral" className="mt-3">
                  {KALIMAT_GABUNGAN}
                </Peringatan>
              </Kartu>
            </section>

            {/* -------- Bagian bawah: kategori, atau isi satu kategori -------- */}
            <div className="lg:col-span-5 min-w-0 mt-4 lg:mt-0">
              {kategori ? (
                <IsiKategori kategori={kategori} daftar={barangKategori} alamat={alamat} />
              ) : (
                <PerbandinganKategori ringkasan={ringkasan} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ================================================================== */
/* Keadaan 1: perbandingan seluruh kategori                           */
/* ================================================================== */

function PerbandinganKategori({
  ringkasan,
}: {
  ringkasan: Array<{
    kategori: string
    pemakaianBulanIni: number
    perkiraanBulanDepan: number
    jumlahBarang: number
  }>
}) {
  /* Urutannya sengaja sama dengan urutan chip di atas, bukan diurutkan dari
     yang terbesar: mata pengguna memetakan batang ke chip, dan urutan yang
     berpindah-pindah merusak pemetaan itu. */
  const batang = ringkasan.map((r) => ({
    label: labelPendek(r.kategori),
    nilai: r.perkiraanBulanDepan,
  }))

  return (
    <section aria-labelledby="judul-kategori">
      <Kartu>
        <h2 id="judul-kategori" className="text-[0.9375rem] font-bold text-ink leading-tight">
          Perkiraan per kategori
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
          Perkiraan pemakaian bulan depan untuk tiap kategori. Nama pada grafik dipendekkan; nama
          lengkapnya ada di daftar bawah.
        </p>

        {/* Tujuh batang tidak muat di layar 360px. Yang digulir wadah grafiknya,
            bukan badan halaman. */}
        <div className="mt-3 overflow-x-auto no-scrollbar">
          <div className="min-w-[28rem]">
            <GrafikBatang data={batang} satuan={SATUAN_GABUNGAN} tinggi={170} />
          </div>
        </div>

        <Peringatan nada="netral" className="mt-3">
          {KALIMAT_GABUNGAN}
        </Peringatan>

        <Pemisah className="my-3.5" />

        <ul className="space-y-1">
          {ringkasan.map((r) => {
            const arah = arahKategori(r.pemakaianBulanIni, r.perkiraanBulanDepan)
            return (
              <li key={r.kategori}>
                <Link
                  to={`/prediksi?kategori=${encodeURIComponent(r.kategori)}`}
                  className="flex items-center gap-3 min-h-11 -mx-2 px-2 py-1.5 rounded-md hover:bg-sunken transition-colors"
                >
                  <span className="min-w-0 grow">
                    <span className="block text-[0.875rem] font-semibold text-ink truncate">
                      {r.kategori}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-ink-3">
                      <span>{r.jumlahBarang} barang</span>
                      <span aria-hidden="true">&middot;</span>
                      <span className={cx('inline-flex items-center gap-1 font-semibold', arah.warna)}>
                        {arah.gerak === 'naik' && <IkonTrenNaik size={13} />}
                        {arah.gerak === 'turun' && <IkonTrenTurun size={13} />}
                        {arah.kata}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[0.875rem] font-bold text-ink tabular">
                      {angka(r.perkiraanBulanDepan)}
                    </span>
                    <span className="block text-[0.75rem] text-ink-3 tabular">
                      dari {angka(r.pemakaianBulanIni)}
                    </span>
                  </span>
                  <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            )
          })}
        </ul>
      </Kartu>
    </section>
  )
}

/* ================================================================== */
/* Keadaan 2: semua barang dalam satu kategori                        */
/* ================================================================== */

function IsiKategori({
  kategori,
  daftar,
  alamat,
}: {
  kategori: string
  daftar: Barang[]
  alamat: (ubahan: Record<string, string | null>) => string
}) {
  return (
    <section aria-labelledby="judul-isi-kategori">
      <Kartu>
        <h2 id="judul-isi-kategori" className="text-[0.9375rem] font-bold text-ink leading-tight">
          Barang di {kategori}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
          {daftar.length} barang. Tekan salah satu untuk melihat alasan sarannya.
        </p>

        {daftar.length === 0 ? (
          <KeadaanKosong
            padat
            tingkat="h3"
            ikon={<IkonKotak size={26} />}
            judul="Belum ada barang di kategori ini"
            pesan="Kategori ini masih kosong, jadi belum ada yang bisa diperkirakan. Barang yang kamu tambahkan ke kategori ini akan muncul di sini."
            aksi={<TombolTautan ke="/stok/baru">Tambah Barang</TombolTautan>}
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {daftar.map((b) => (
              <li key={b.id}>
                <KartuBarangKategori barang={b} ke={alamat({ barang: b.id })} />
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </section>
  )
}

function KartuBarangKategori({ barang, ke }: { barang: Barang; ke: string }) {
  /* Dihitung dari barang yang datang dari penyimpanan, bukan dari daftar
     rekomendasi yang dibekukan saat aplikasi dimuat: sisa stok di baris ini
     dan saran di lencananya harus berasal dari angka yang sama. */
  const rekomendasi = useMemo(
    () => (layakDiperkirakan(barang) ? rekomendasiDari(barang) : undefined),
    [barang],
  )
  const deret = useMemo(
    () =>
      trenBulanan(barang.id)
        .filter((t) => t.aktual != null)
        .map((t) => t.aktual as number),
    [barang.id],
  )
  const sisa = Math.max(0, barang.stok)

  return (
    <Link
      to={ke}
      className="flex items-center gap-3 min-h-11 bg-surface border border-line rounded-md p-3 hover:border-line-strong hover:shadow-e2 transition-[border-color,box-shadow]"
    >
      <span className="min-w-0 grow">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.9375rem] font-semibold text-ink leading-snug">{barang.nama}</span>
          <ChipStok status={statusStok(barang)} />
        </span>
        <span className="block mt-1 text-[0.8125rem] text-ink-3 leading-snug">
          Sisa {jumlahTampil(barang, sisa)}
        </span>
        {rekomendasi ? (
          <span className="mt-1.5 flex">
            <Lencana nada={NADA_ARAH_PREDIKSI[rekomendasi.arah]}>{kalimatSaran(rekomendasi)}</Lencana>
          </span>
        ) : (
          <span className="block mt-1 text-[0.75rem] text-ink-3 leading-snug">
            Perkiraannya belum bisa dibuat.
          </span>
        )}
      </span>
      <Percikan data={deret} label={`Tren pemakaian ${barang.nama} enam bulan terakhir`} />
      <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
    </Link>
  )
}

/* ================================================================== */
/* Keadaan 3: satu barang, alasan, dan tombol pesan                   */
/* ================================================================== */

function DetailBarang({
  barang,
  kembaliKe,
  labelKembali,
}: {
  barang: Barang
  kembaliKe: string
  labelKembali: string
}) {
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const kontrakStore = useAplikasi((s) => s.kontrak)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  /* Dihitung ulang dari barang yang hidup di penyimpanan. Kalau memakai
     daftar yang dibekukan saat aplikasi dimuat, kartu ini masih beralasan
     "stok sekarang cuma 4 kg" di sebelah angka sisa 64 kg yang baru saja
     naik lewat Terima Barang — dan pemilik usaha bisa memesan dua kali. */
  const rekomendasi = useMemo(
    () => (layakDiperkirakan(barang) ? rekomendasiDari(barang) : undefined),
    [barang],
  )
  const tren = useMemo(() => trenBulanan(barang.id), [barang.id])
  const penawaran = rekomendasi?.penawaranId ? penawaranById(rekomendasi.penawaranId) : undefined

  /* Hanya arah "tambah" yang punya angka beli.

     Arah "kurang" adalah angka KELEBIHAN stok, bukan angka beli: memuatnya
     sebagai nilai awal keranjang justru menyuruh membeli lebih banyak,
     persis kebalikan dari sarannya. Arah "tetap" sama sekali tidak menyuruh
     membeli — menyodorkan pengatur jumlah yang sudah terisi di bawah kalimat
     "stok dinilai cukup" membuat sekali tekan jadi pembelian yang tidak
     pernah disarankan. Untuk keduanya jumlahnya mulai dari satu dan pemilik
     usaha yang memutuskan sendiri. */
  const saranBeli = rekomendasi?.arah === 'tambah' ? Math.max(1, rekomendasi.jumlah) : null
  const [jumlah, setJumlah] = useState(saranBeli ?? 1)

  const sisa = Math.max(0, barang.stok)
  const keyakinan = rekomendasi ? kataKeyakinan(rekomendasi.keyakinan) : null

  function masukkanKeKeranjang() {
    if (!penawaran) return
    tambahKeKeranjang(
      penawaran.distributorId,
      penawaran.id,
      jumlah,
      saranBeli,
      rekomendasi?.kontrakId ?? null,
    )
    /* Baris yang sudah ada di keranjang DIGANTI jumlahnya, bukan ditambah.
       Kalimat yang menyiratkan penambahan membuat pemilik usaha mengira
       18 karung tadi masih ada di bawah 5 karung yang baru, jadi yang
       disebut di sini adalah jumlah akhir yang benar-benar di keranjang. */
    tampilkanRacun(
      `${barang.nama} di keranjang diatur jadi ${angka(jumlah)} ${penawaran.satuan}.`,
      'aman',
    )
  }

  return (
    <>
      <div className="mt-4">
        <TombolTautan ke={kembaliKe} ragam="garis" ukuran="kecil" ikonKiri={<IkonKembali size={15} />}>
          {labelKembali}
        </TombolTautan>
      </div>

      <div className="mt-3 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* ---------------- Tren barang ini ---------------- */}
        <section aria-labelledby="judul-barang" className="lg:col-span-7 min-w-0">
          <Kartu>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="judul-barang" className="text-[1.0625rem] font-extrabold text-ink leading-tight">
                  {barang.nama}
                </h2>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">{barang.kategori}</p>
              </div>
              <ChipStok status={statusStok(barang)} besar />
            </div>

            <div className="mt-3.5">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
                Sisa tercatat
              </p>
              {/* Angka besar yang berdiri sendiri memakai lebar digit proporsional,
                  bukan tabular-nums: tidak ada kolom angka yang perlu disejajarkan. */}
              <p className="mt-1 text-[2rem] font-extrabold leading-none tracking-tight text-ink">
                {angkaTampil(barang, sisa)}
                <span className="ml-1.5 text-[1rem] font-semibold text-ink-3">{satuanTampil(barang).nama}</span>
              </p>
            </div>

            {tren.length > 0 ? (
              <div className="mt-4 min-w-0">
                <h3 className="text-[0.875rem] font-bold text-ink leading-tight">
                  Pemakaian enam bulan terakhir dan perkiraan bulan depan
                </h3>
                <div className="mt-2 min-w-0">
                  <GrafikTren data={trenTampil(barang, tren)} satuan={satuanTampil(barang).nama} tinggi={200} />
                </div>
                <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">
                  Garis putus-putus dan pita di sekelilingnya adalah perkiraan, bukan kenyataan. Ia
                  bisa meleset ke atas maupun ke bawah.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-[0.875rem] text-ink-3 leading-relaxed">
                Riwayat bulanan barang ini belum terkumpul, jadi grafiknya belum bisa digambar.
              </p>
            )}
          </Kartu>
        </section>

        {/* ---------------- Kenapa saran ini muncul ---------------- */}
        <section aria-labelledby="judul-alasan" className="lg:col-span-5 min-w-0 mt-4 lg:mt-0">
          <Kartu>
            <h2 id="judul-alasan" className="text-[0.9375rem] font-bold text-ink leading-tight">
              Kenapa saran ini muncul
            </h2>

            {rekomendasi && keyakinan ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Lencana nada={NADA_ARAH_PREDIKSI[rekomendasi.arah]} besar>
                    {kalimatSaran(rekomendasi)}
                  </Lencana>
                </div>

                <ul className="mt-3.5 space-y-2">
                  {rekomendasi.alasan.map((a, i) => (
                    <li
                      key={`${barang.id}-${i}`}
                      className="flex items-start gap-2 text-[0.875rem] text-ink-2 leading-relaxed"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[0.4rem] size-1.5 rounded-full bg-brand shrink-0"
                      />
                      <span className="min-w-0">{a}</span>
                    </li>
                  ))}
                </ul>

                <Pemisah className="my-3.5" />

                <BarisData
                  label="Terpakai bulan ini"
                  nilai={jumlahTampil(barang, rekomendasi.pemakaianBulanIni)}
                />
                <BarisData
                  label="Perkiraan bulan depan"
                  nilai={jumlahTampil(barang, rekomendasi.perkiraanBulanDepan)}
                  tebal
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[0.8125rem] text-ink-3">Keyakinan perkiraan:</span>
                  <Lencana nada={keyakinan.nada} ikon={<IkonGrafik size={13} />}>
                    {keyakinan.teks}
                  </Lencana>
                </div>
                <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">
                  Dihitung dari panjang riwayat yang sudah terkumpul ({barang.hariDataTerkumpul} hari).
                  Makin panjang riwayatnya, makin jarang perkiraannya meleset — tapi meleset tetap
                  mungkin.
                </p>
              </>
            ) : (
              /* Data belum cukup. Layar menyebutkan berapa yang sudah terkumpul
                 dan berhenti di situ, tanpa menampilkan angka karangan. */
              <div className="mt-3">
                {barang.dicatatManual ? (
                  <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                    Barang ini kamu catat manual, jadi pemakaiannya tidak kami hitung sendiri dan
                    perkiraannya tidak kami buat. Jumlah belinya kamu yang paling tahu.
                  </p>
                ) : (
                  <>
                    <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                      Perkiraan untuk {barang.nama} belum bisa kami buat. Riwayat pemakaiannya baru
                      terkumpul {barang.hariDataTerkumpul} dari 14 hari yang kami perlukan. Daripada
                      menampilkan angka karangan, kami menunggu datanya cukup.
                    </p>
                    <div className="mt-3">
                      <BilahProgres
                        nilai={Math.min(barang.hariDataTerkumpul, 14)}
                        maks={14}
                        label="Hari data terkumpul"
                        tampilkanAngka
                      />
                    </div>
                  </>
                )}
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <TombolTautan ke={`/stok/${barang.id}`} ragam="garis" ukuran="kecil">
                    Buka detail barang
                  </TombolTautan>
                  <TombolTautan
                    ke={`/belanja?cari=${encodeURIComponent(barang.nama)}`}
                    ragam="sunyi"
                    ukuran="kecil"
                    ikonKiri={<IkonToko size={15} />}
                  >
                    Cari di Distributor
                  </TombolTautan>
                </div>
              </div>
            )}
          </Kartu>
        </section>
      </div>

      {/* ---------------- Pesan sesuai perkiraan ---------------- */}
      {rekomendasi &&
        (penawaran ? (
          <BilahAksi
            ringkasan={
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                {/* Satu cabang per arah. Kalimatnya harus sejalan dengan
                    pengatur jumlah di bawahnya: menyebut angka saran padahal
                    pengaturnya mulai dari satu (atau sebaliknya) membuat
                    pemilik usaha menekan tombol tanpa tahu berapa yang ikut. */}
                <p className="text-[0.8125rem] text-ink-2 leading-snug">
                  {rekomendasi.arah === 'kurang' ? (
                    <>
                      Menurut perkiraan, stok {barang.nama} justru sudah berlebih.{' '}
                      <strong className="text-ink">Tidak ada saran beli</strong> untuk bulan depan —
                      kalau tetap mau memesan, atur sendiri jumlahnya.
                    </>
                  ) : rekomendasi.arah === 'tetap' ? (
                    <>
                      <strong className="text-ink">Stoknya dinilai cukup</strong> untuk bulan depan.
                      Kamu tetap boleh memesan kalau mau, tapi jumlahnya kamu sendiri yang tentukan.
                    </>
                  ) : (
                    <>
                      Saran model{' '}
                      <strong className="text-ink">
                        {angka(rekomendasi.jumlah)} {rekomendasi.satuanSaran}
                      </strong>
                      . Jumlahnya boleh kamu ubah, dan perkiraannya bisa meleset.
                    </>
                  )}
                </p>
                <p className="text-[0.8125rem] text-ink-3">
                  Perkiraan biaya beli{' '}
                  <strong className="text-ink tabular">
                    {rupiah(jumlah * hargaBerlaku(penawaran.id, rekomendasi?.kontrakId ?? null, kontrakStore))}
                  </strong>
                </p>
              </div>
            }
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
              <PengaturJumlah
                nilai={jumlah}
                ubah={setJumlah}
                min={1}
                maks={Math.max(1, penawaran.stokTersedia)}
                satuan={penawaran.satuan}
                saranModel={saranBeli}
                label={`Jumlah ${barang.nama}`}
              />
              <Tombol
                penuh
                ukuran="besar"
                ikonKiri={<IkonKeranjang size={18} />}
                onClick={masukkanKeKeranjang}
                className="sm:w-auto sm:grow"
              >
                Masukkan ke Keranjang
              </Tombol>
            </div>
          </BilahAksi>
        ) : (
          /* Tidak ada penawaran berarti tidak ada yang bisa dipesan dari sini.
             Dikatakan apa adanya, bukan disembunyikan di balik tombol mati. */
          <Peringatan nada="netral" className="mt-4" judul="Belum bisa dipesan dari halaman ini">
            Belum ada distributor yang menawarkan {barang.nama} di aplikasi, jadi kami tidak bisa
            memasukkannya ke keranjang untuk kamu. Kamu masih bisa mencarinya sendiri di daftar
            Distributor.
            <div className="mt-2.5">
              <TombolTautan
                ke={`/belanja?cari=${encodeURIComponent(barang.nama)}`}
                ragam="garis"
                ukuran="kecil"
                ikonKiri={<IkonToko size={15} />}
              >
                Cari di Distributor
              </TombolTautan>
            </div>
          </Peringatan>
        ))}
    </>
  )
}
