import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Barang, RekomendasiPrediksi } from '@/lib/types'
import { BarisData, Kartu, Tombol, TombolTautan } from '@/components/ui/dasar'
import { BarisChip, BilahAksi, Chip } from '@/components/ui/navigasi'
import { PengaturJumlah } from '@/components/ui/formulir'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { GrafikTren } from '@/components/grafik/GrafikTren'
import { GrafikBatang, Percikan } from '@/components/grafik/GrafikBatang'
import {
  IkonKembali,
  IkonKeranjang,
  IkonKotak,
  IkonPanahKanan,
  IkonToko,
  IkonTrenNaik,
  IkonTrenTurun,
} from '@/icons'
import { angka, cx, rupiah, rupiahSumbu } from '@/lib/format'
import { angkaTampil, jumlahTampil, satuanTampil, trenTampil } from '@/lib/satuan'
import { JUDUL, LABEL_ARAH_PREDIKSI } from '@/lib/label'
import {
  hargaBerlaku,
  kategoriBarang,
  layakDiperkirakan,
  nilaiPemakaian,
  penawaranById,
  rekomendasiDari,
  trenBulanan,
  trenKategoriRupiah,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Halaman Prediksi: dua keadaan, dibedakan oleh query string.
 *
 * 1. `/prediksi?kategori=...` — satu kategori: deretan kartu barang, grafik
 *    nilai pemakaian setahun plus perkiraan bulan depan, dan perbandingan
 *    perkiraan antarbarang. Tanpa kategori, kategori pertama yang dibuka.
 * 2. `/prediksi?barang=b-01`  — satu barang: grafiknya, angka bulan ini dan
 *    bulan depan, lalu tombol pesan.
 *
 * Yang sengaja TIDAK ada lagi:
 * - "Semua kategori". Grafik lintas kategori menjumlahkan gram, ml, dan pcs
 *   sekaligus — angkanya tidak berarti apa-apa.
 * - Label status stok (aman/menipis/habis). Itu urusan tab Stok; tab ini
 *   bicara soal bulan depan.
 * - Penjelasan "kenapa saran ini muncul". Yang tersisa di samping grafik
 *   barang hanyalah dua angka: terpakai bulan ini dan perkiraan bulan depan.
 *
 * Grafik yang menjumlahkan beberapa barang memakai Rupiah HARGA BELI, satu-
 * satunya ukuran yang sama untuk barang bersatuan berbeda. Itu biaya beli ke
 * distributor, bukan omzet: harga jual tetap tidak pernah muncul di aplikasi
 * ini.
 */

const KALIMAT_MELESET =
  'Semua angka di halaman ini perkiraan yang disusun dari pemakaian yang sudah tercatat. Perkiraan bisa meleset, jadi pakai sebagai saran, bukan jaminan.'

/** Ruang label sumbu untuk Rupiah ringkas ("12,5 jt"), lebih lebar dari angka biasa. */
const LEBAR_SUMBU_RUPIAH = 48

/**
 * Arah perubahan dari bulan ini ke bulan depan.
 *
 * Hasilnya sengaja memisahkan `gerak` (dipakai memilih ikon) dari `kata`
 * (dibaca pengguna) dan `warna`, supaya arah selalu tersampaikan lewat ikon
 * DAN teks, tidak pernah lewat warna saja.
 */
function arahPerubahan(
  sekarang: number,
  nanti: number,
): { gerak: 'naik' | 'turun' | 'datar'; kata: string; warna: string } {
  const beda = sekarang > 0 ? Math.round(((nanti - sekarang) / sekarang) * 100) : 0
  if (beda >= 3) return { gerak: 'naik', kata: `naik ${beda}%`, warna: 'text-menipis-ink' }
  if (beda <= -3) return { gerak: 'turun', kata: `turun ${Math.abs(beda)}%`, warna: 'text-info-ink' }
  return { gerak: 'datar', kata: 'hampir sama', warna: 'text-ink-3' }
}

/** Ikon + kata, tidak pernah warna saja. */
function TandaArah({ arah }: { arah: ReturnType<typeof arahPerubahan> }) {
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold', arah.warna)}>
      {arah.gerak === 'naik' && <IkonTrenNaik size={13} />}
      {arah.gerak === 'turun' && <IkonTrenTurun size={13} />}
      {arah.kata}
    </span>
  )
}

/**
 * Nama barang dipendekkan khusus untuk label batang: nama lengkap saling
 * menimpa di layar sempit. Nama utuhnya tetap ada pada daftar di bawah grafik.
 */
function labelPendek(nama: string): string {
  const kata = nama.split(' ')[0]
  return kata.length > 9 ? `${kata.slice(0, 8)}…` : kata
}

export default function Prediksi() {
  const barang = useAplikasi((s) => s.barang)
  const [param, setParam] = useSearchParams()

  /* Nilai yang tidak dikenali dikembalikan ke kategori pertama, bukan dibiarkan
     kosong: alamat halaman bisa saja diketik sendiri atau dibagikan dari versi
     lama yang masih punya "Semua kategori". */
  const kategoriMentah = param.get('kategori') ?? ''
  const kategori = kategoriBarang.includes(kategoriMentah) ? kategoriMentah : (kategoriBarang[0] ?? '')
  const barangMentah = param.get('barang') ?? ''
  const barangTerpilih = barangMentah ? barang.find((b) => b.id === barangMentah) : undefined
  /* Pulang ke kategori asal kalau datang dari sana, ke kategori barangnya kalau
     datang dari luar (Beranda, pemberitahuan) — bukan ke kategori pertama. */
  const kategoriKembali = kategoriBarang.includes(kategoriMentah)
    ? kategoriMentah
    : (barangTerpilih?.kategori ?? kategori)

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

  /* Dari barang yang hidup di store, bukan daftar contoh yang dibekukan: harga
     beli terakhir berubah setiap kali barang diterima, dan angka Rupiah di
     grafik harus ikut. */
  const barangKategori = useMemo(() => barang.filter((b) => b.kategori === kategori), [barang, kategori])

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
          pesan="Mungkin barangnya sudah dihapus, atau tautannya sudah lama. Perkiraan untuk barang lain masih bisa kamu buka dari kategorinya."
          aksi={<TombolTautan ke="/prediksi">Buka Prediksi</TombolTautan>}
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
          kembaliKe={alamat({ barang: null, kategori: kategoriKembali })}
          labelKembali={`Kembali ke ${kategoriKembali}`}
        />
      ) : (
        <>
          {/* -------- Pemilih kategori: geser mendatar di wadahnya sendiri -------- */}
          <BarisChip className="mt-4">
            {kategoriBarang.map((k) => (
              <Chip key={k} aktif={k === kategori} onClick={() => aturParam({ kategori: k, barang: null })}>
                {k}
              </Chip>
            ))}
          </BarisChip>

          {/* Di HP urutannya grafik garis → kartu barang → grafik batang, sesuai
              alur "pilih kategori, lihat grafiknya, lalu pilih barang". Di layar
              lebar kartu barang di kiri, dua grafik bertumpuk di kanan. Baris
              kedua kisi `1fr` supaya tinggi kolom kiri tidak menarik grafik
              garis menjauh dari grafik batang di bawahnya. */}
          <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-6 lg:items-start">
            <div className="min-w-0 lg:col-start-8 lg:col-span-5 lg:row-start-1">
              <GrafikKategori kategori={kategori} daftar={barangKategori} />
            </div>
            <div className="min-w-0 lg:col-start-1 lg:col-span-7 lg:row-start-1 lg:row-span-2">
              <DaftarBarangKategori kategori={kategori} daftar={barangKategori} alamat={alamat} />
            </div>
            <div className="min-w-0 lg:col-start-8 lg:col-span-5 lg:row-start-2">
              <PerbandinganBarang daftar={barangKategori} alamat={alamat} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ================================================================== */
/* Keadaan 1: satu kategori                                           */
/* ================================================================== */

function GrafikKategori({ kategori, daftar }: { kategori: string; daftar: Barang[] }) {
  const tren = useMemo(() => trenKategoriRupiah(daftar), [daftar])
  const adaData = daftar.some(layakDiperkirakan)
  const bulanIni = [...tren].reverse().find((t) => t.aktual != null)?.aktual ?? 0
  const bulanDepan = tren[tren.length - 1]?.prediksi ?? 0
  const arah = arahPerubahan(bulanIni, bulanDepan)

  return (
    <section aria-labelledby="judul-tren-kategori">
      <Kartu>
        <h2 id="judul-tren-kategori" className="text-[0.9375rem] font-bold text-ink leading-tight">
          Nilai pemakaian {kategori}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
          Setahun terakhir dan perkiraan bulan depan, dalam Rupiah harga beli.
        </p>
        {adaData ? (
          <>
            <div className="mt-3 min-w-0">
              <GrafikTren
                data={tren}
                satuan="Rupiah"
                tinggi={200}
                bulanan
                labelAktual="Nilai pemakaian"
                format={rupiah}
                formatSumbu={rupiahSumbu}
                lebarSumbu={LEBAR_SUMBU_RUPIAH}
              />
            </div>
            <p className="mt-3 text-[0.875rem] text-ink-2 leading-relaxed">
              Bulan depan diperkirakan <strong className="text-ink tabular">{rupiah(bulanDepan)}</strong>,{' '}
              <TandaArah arah={arah} /> dari bulan ini.
            </p>
          </>
        ) : (
          <KeadaanKosong
            padat
            tingkat="h3"
            ikon={<IkonKotak size={26} />}
            judul="Datanya belum cukup untuk digambar"
            pesan="Belum ada barang di kategori ini yang riwayat pemakaiannya sudah 14 hari. Grafiknya muncul setelah datanya terkumpul."
          />
        )}
      </Kartu>
    </section>
  )
}

function DaftarBarangKategori({
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
      <h2 id="judul-isi-kategori" className="text-[0.9375rem] font-bold text-ink leading-tight">
        Barang di {kategori}
      </h2>
      <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
        {daftar.length} barang. Tekan salah satu untuk melihat grafiknya dan memesan.
      </p>

      {daftar.length === 0 ? (
        <Kartu className="mt-3">
          <KeadaanKosong
            padat
            tingkat="h3"
            ikon={<IkonKotak size={26} />}
            judul="Belum ada barang di kategori ini"
            pesan="Kategori ini masih kosong, jadi belum ada yang bisa diperkirakan. Barang yang kamu tambahkan ke kategori ini akan muncul di sini."
            aksi={<TombolTautan ke="/stok/baru">Tambah Barang</TombolTautan>}
          />
        </Kartu>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 [&>*]:min-w-0">
          {daftar.map((b) => (
            <li key={b.id}>
              <KartuBarangPrediksi barang={b} ke={alamat({ barang: b.id })} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Kartu satu barang: nama dan angka perkiraannya, tidak lebih.
 *
 * Angkanya PERKIRAAN PEMAKAIAN bulan depan, bukan saran beli. Saran beli sudah
 * dikurangi sisa stok; menampilkannya tanpa sisa di sebelahnya membuat orang
 * bertanya kenapa angkanya lebih kecil dari kebutuhan. Saran beli muncul di
 * halaman barangnya, tepat di atas tombol keranjang.
 */
function KartuBarangPrediksi({ barang, ke }: { barang: Barang; ke: string }) {
  /* Dihitung dari barang yang datang dari store, bukan dari daftar rekomendasi
     yang dibekukan saat aplikasi dimuat. */
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

  return (
    <Link
      to={ke}
      className="flex h-full flex-col gap-2 min-h-[5.5rem] bg-surface border border-line rounded-lg p-3.5 shadow-e1 hover:border-line-strong hover:shadow-e2 transition-[border-color,box-shadow]"
    >
      {/* Nama di baris sendiri, angka dan garis tren di baris bawah: dua
          kolom kartu di layar menengah tidak menyisakan ruang untuk
          ketiganya sebaris tanpa memecah nama barang per kata. */}
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[0.9375rem] font-semibold text-ink leading-snug">{barang.nama}</span>
        <IkonPanahKanan size={18} className="shrink-0 mt-0.5 text-ink-3" />
      </span>
      <span className="mt-auto flex items-end justify-between gap-3">
        {rekomendasi ? (
          <span className="min-w-0">
            <span className="block text-[0.75rem] text-ink-3">Perkiraan bulan depan</span>
            <span className="block text-[1.125rem] font-extrabold text-ink leading-tight">
              {jumlahTampil(barang, rekomendasi.perkiraanBulanDepan)}
            </span>
          </span>
        ) : (
          <span className="min-w-0 text-[0.8125rem] text-ink-3 leading-snug">
            {barang.dicatatManual ? 'Dicatat manual, tidak diperkirakan.' : 'Perkiraannya belum bisa dibuat.'}
          </span>
        )}
        <Percikan data={deret} label={`Tren pemakaian ${barang.nama} setahun terakhir`} />
      </span>
    </Link>
  )
}

/** Grafik batang perkiraan antarbarang, lalu naik-turunnya per barang. */
function PerbandinganBarang({
  daftar,
  alamat,
}: {
  daftar: Barang[]
  alamat: (ubahan: Record<string, string | null>) => string
}) {
  const baris = useMemo(
    () =>
      daftar.filter(layakDiperkirakan).map((b) => {
        const r = rekomendasiDari(b)
        return {
          barang: b,
          nilaiIni: nilaiPemakaian(b, r.pemakaianBulanIni),
          nilaiDepan: nilaiPemakaian(b, r.perkiraanBulanDepan),
          arah: arahPerubahan(r.pemakaianBulanIni, r.perkiraanBulanDepan),
        }
      }),
    [daftar],
  )

  if (baris.length === 0) return null

  return (
    <section aria-labelledby="judul-perbandingan">
      <Kartu>
        <h2 id="judul-perbandingan" className="text-[0.9375rem] font-bold text-ink leading-tight">
          Perkiraan bulan depan per barang
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
          Dalam Rupiah harga beli, supaya barang bersatuan berbeda bisa dibandingkan.
        </p>
        {/* Batang yang banyak tidak muat di layar 360px. Yang digulir wadah
            grafiknya, bukan badan halaman. */}
        <div className="mt-3 overflow-x-auto no-scrollbar">
          <div className={cx(baris.length > 5 && 'min-w-[28rem]')}>
            <GrafikBatang
              data={baris.map((x) => ({ label: labelPendek(x.barang.nama), nilai: x.nilaiDepan }))}
              satuan="Rupiah"
              tinggi={170}
              format={rupiahSumbu}
              formatSumbu={rupiahSumbu}
              lebarSumbu={LEBAR_SUMBU_RUPIAH}
            />
          </div>
        </div>

        <ul className="mt-3 space-y-1">
          {baris.map((x) => (
            <li key={x.barang.id}>
              <Link
                to={alamat({ barang: x.barang.id })}
                className="flex items-center gap-3 min-h-11 -mx-2 px-2 py-1.5 rounded-md hover:bg-sunken transition-colors"
              >
                <span className="min-w-0 grow">
                  <span className="block text-[0.875rem] font-semibold text-ink truncate">{x.barang.nama}</span>
                  <span className="block text-[0.75rem] text-ink-3">
                    <TandaArah arah={x.arah} /> dari bulan ini
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[0.875rem] font-bold text-ink tabular">{rupiah(x.nilaiDepan)}</span>
                  <span className="block text-[0.75rem] text-ink-3 tabular">dari {rupiah(x.nilaiIni)}</span>
                </span>
                <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </Kartu>
    </section>
  )
}

/* ================================================================== */
/* Keadaan 2: satu barang dan tombol pesan                            */
/* ================================================================== */

/**
 * Kalimat saran di bilah bawah, dipisah per arah.
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
     daftar yang dibekukan saat aplikasi dimuat, angka saran masih berdasar
     stok lama setelah stoknya baru saja naik lewat Terima Barang — dan pemilik
     usaha bisa memesan dua kali. */
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
        {/* ---------------- Grafik barang ini ---------------- */}
        <section aria-labelledby="judul-barang" className="lg:col-span-8 min-w-0">
          <Kartu>
            <h2 id="judul-barang" className="text-[1.0625rem] font-extrabold text-ink leading-tight">
              {barang.nama}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">{barang.kategori}</p>

            <div className="mt-3.5">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Sisa tercatat</p>
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
                  Pemakaian setahun terakhir dan perkiraan bulan depan
                </h3>
                <div className="mt-2 min-w-0">
                  <GrafikTren
                    data={trenTampil(barang, tren)}
                    satuan={satuanTampil(barang).nama}
                    tinggi={200}
                    bulanan
                  />
                </div>
                <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">
                  Garis putus-putus dan pita di sekelilingnya adalah perkiraan, bukan kenyataan. Ia bisa meleset ke
                  atas maupun ke bawah.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-[0.875rem] text-ink-3 leading-relaxed">
                Riwayat bulanan barang ini belum terkumpul, jadi grafiknya belum bisa digambar.
              </p>
            )}
          </Kartu>
        </section>

        {/* ---------------- Bulan ini dan bulan depan ---------------- */}
        <section aria-labelledby="judul-angka" className="lg:col-span-4 min-w-0 mt-4 lg:mt-0">
          <Kartu>
            <h2 id="judul-angka" className="text-[0.9375rem] font-bold text-ink leading-tight">
              Bulan ini dan bulan depan
            </h2>

            {rekomendasi ? (
              <div className="mt-2">
                <BarisData label="Terpakai bulan ini" nilai={jumlahTampil(barang, rekomendasi.pemakaianBulanIni)} />
                <BarisData
                  label="Perkiraan bulan depan"
                  nilai={jumlahTampil(barang, rekomendasi.perkiraanBulanDepan)}
                  tebal
                />
              </div>
            ) : (
              /* Data belum cukup. Layar menyebutkan berapa yang sudah terkumpul
                 dan berhenti di situ, tanpa menampilkan angka karangan. */
              <div className="mt-3">
                {barang.dicatatManual ? (
                  <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                    Barang ini kamu catat manual, jadi pemakaiannya tidak kami hitung sendiri dan perkiraannya tidak
                    kami buat. Jumlah belinya kamu yang paling tahu.
                  </p>
                ) : (
                  <>
                    <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                      Perkiraan untuk {barang.nama} belum bisa dibuat. Riwayat pemakaiannya baru terkumpul{' '}
                      {barang.hariDataTerkumpul} dari 14 hari yang diperlukan.
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
                      <strong className="text-ink">Tidak ada saran beli</strong> untuk bulan depan — kalau tetap mau
                      memesan, atur sendiri jumlahnya.
                    </>
                  ) : rekomendasi.arah === 'tetap' ? (
                    <>
                      <strong className="text-ink">{kalimatSaran(rekomendasi)}</strong>. Kamu tetap boleh memesan
                      kalau mau, tapi jumlahnya kamu sendiri yang tentukan.
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
                    {rupiah(jumlah * hargaBerlaku(penawaran.id, rekomendasi.kontrakId ?? null, kontrakStore))}
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
            Belum ada distributor yang menawarkan {barang.nama} di aplikasi, jadi kami tidak bisa memasukkannya ke
            keranjang untuk kamu. Kamu masih bisa mencarinya sendiri di daftar Distributor.
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
