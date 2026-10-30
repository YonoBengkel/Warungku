import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BannerAkun, KuotaBulanIni, PitaDataKasir } from '@/components/domain'
import { KartuPromo } from '@/components/domain/KartuPromo'
import { KepalaSambutan } from '@/components/domain/KepalaSambutan'
import {
  DonatStatus,
  KartuUrusan,
  BarisUrusan,
  PerluTindakan,
  type Pintasan,
  type PotonganDonat,
  type Urusan,
} from '@/components/domain/KartuBeranda'
import { KartuRingkasanPenjualan } from '@/components/domain/RingkasanPenjualan'
import { ambilRingkasanUsaha } from '@/lib/apiPenjualan'
import { Korsel } from '@/components/ui/korsel'
import { Bagian, HanyaPembacaLayar, Kartu, Kerangka, KELAS_BAGIAN, Tombol } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import {
  IkonCentangLingkaran,
  IkonJam,
  IkonKeranjang,
  IkonKontrak,
  IkonKotak,
  IkonNota,
  IkonPanahKanan,
  IkonPasokan,
  IkonPetir,
  IkonSilang,
  IkonTambah,
  IkonTrenNaik,
  IkonTrenTurun,
} from '@/icons'
import { angka, angkaJumlah, cx, hariLagi, waktuNanti } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'
import {
  layakDiperkirakan,
  penawaranById,
  penawaranUntukBarang,
  promoMasihBerlaku,
  rekomendasiDari,
  saranBelanja,
  statusKuota,
  statusStok,
  sisaHariPeriode,
  distributorById,
} from '@/data/dummy'
import { LABEL_ARAH_PREDIKSI, LABEL_PESANAN, NADA_ARAH_PREDIKSI, PESANAN_BERJALAN } from '@/lib/label'
import type { Pesanan, RekomendasiPrediksi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Beranda menjawab satu pertanyaan: hari ini saya harus ngapain.
 *
 * Susunan revisi V5 (Q110): kepala sapaan, promo distributor, Perlu Tindakan,
 * lalu "Yang perlu kamu urus hari ini" berdampingan dengan Pesanan berjalan,
 * Ringkasan Penjualan, Prediksi Stok, dan Kuota Kontrak. Halamannya boleh
 * digulir.
 *
 * Aturan yang dipegang: Beranda tidak pernah punya data sendiri. Tiap blok
 * adalah cermin dari Stok, Pesanan, Kontrak, atau model prediksi, dan selalu
 * menautkan balik ke sumber aslinya. Tidak ada fitur yang hanya bisa dicapai
 * dari sini.
 *
 * Ringkasan Penjualan dibaca dari nota kasir apa adanya (harga seperti
 * tercetak di struk). Untung dan margin tetap tidak ada: harga pokok per menu
 * tidak diketahui aplikasi ini.
 */

/** Ambang "hampir kedaluwarsa". Sama persis dengan penyaring di layar Stok,
 *  supaya angka pada lencana dan panjang daftar yang dibuka tidak pernah beda. */
const HARI_KEDALUWARSA_DEKAT = 14

/** Urutan pesanan di kartu Pesanan berjalan: yang menunggu jawaban distributor dulu. */
const URUT_BERJALAN: Record<string, number> = { 'menunggu-konfirmasi': 0, disiapkan: 1, dikirim: 2, draf: 3 }

const HARI = 86_400_000

/** Kiriman yang sudah sampai: ada bukti antar, ATAU perkiraan tibanya sudah lewat. */
function sudahSampai(p: Pesanan): boolean {
  return p.status === 'dikirim' && (p.pengiriman != null || (p.perkiraanTiba != null && +new Date(p.perkiraanTiba) <= Date.now()))
}

export default function Beranda() {
  const sesiServer = useAplikasi((s) => s.sesiServer)
  const ambilRingkasan = useMemo(
    () => (sesiServer ? () => ambilRingkasanUsaha(sesiServer) : null),
    [sesiServer],
  )
  const barang = useAplikasi((s) => s.barang)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)
  const keranjang = useAplikasi((s) => s.keranjang)
  const profil = useAplikasi((s) => s.profil)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const promoStore = useAplikasi((s) => s.promo)
  /* Promo dibaca dari store: yang baru dipasang distributor langsung muncul,
     yang sudah diakhiri langsung hilang dari Beranda. */
  const promoTampil = useMemo(() => promoStore.filter((p) => promoMasihBerlaku(p)), [promoStore])

  /* Blok prediksi sengaja dimuat belakangan: ia paling mahal dan paling tidak
     mendesak, jadi tidak boleh menahan daftar yang perlu diurus. */
  const [perkiraanSiap, setPerkiraanSiap] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setPerkiraanSiap(true), 650)
    return () => window.clearTimeout(t)
  }, [])

  const urusan = useMemo(() => {
    const hasil: Array<Urusan & { urutan: number }> = []

    /* Tombol di baris barang habis langsung memasukkan saran ke keranjang.
       Pemberitahuan sesudahnya membawa tautan "Ubah jumlah", karena jumlah
       saran bisa saja tidak cocok dengan rencana pemilik usaha hari itu. */
    function masukkanSaran(
      namaBarang: string,
      isi: { penawaranId: string; jumlah: number; kontrakId: string | null },
    ) {
      const pw = penawaranById(isi.penawaranId)
      if (!pw) return
      tambahKeKeranjang(pw.distributorId, pw.id, isi.jumlah, isi.jumlah, isi.kontrakId)
      tampilkanRacun(`${namaBarang} masuk keranjang: ${angka(isi.jumlah)} ${pw.satuan}.`, 'aman', {
        label: 'Ubah jumlah',
        ke: '/keranjang',
      })
    }

    // Saran belanja contoh merujuk barang data contoh. Di mode data server
    // barangnya tidak ada, dan baris tanpa nama barang ("…, dan 2 lainnya")
    // lebih membingungkan daripada tidak ada baris sama sekali.
    const saran = saranBelanja.find((s) => s.baris.some((r) => barang.some((b) => b.id === r.barangId)))

    /* 1. Stok habis. Yang sudah dalam perjalanan tetap tampil sebagai
       keterangan, tapi turun ke bawah dan tidak merah: sudah diurus. */
    const habis = barang.filter((b) => !b.dicatatManual && statusStok(b) === 'habis')
    for (const b of habis.slice(0, 2)) {
      const dikirim = pesanan
        .filter((p) => PESANAN_BERJALAN.includes(p.status) && p.status !== 'draf')
        .flatMap((p) => p.baris)
        .filter((x) => x.barangId === b.id)
        .reduce((a, x) => a + x.jumlah * x.isiPerSatuan, 0)

      /* Tujuan "Pilih Distributor" mengikuti barang yang habis: daftar saran
         kalau barangnya memang di sana, lalu penawaran langsung, lalu pencarian
         di Distributor. */
      const penawaranPertama = penawaranUntukBarang(b.id)[0]
      const barisSaran = saran?.baris.find((r) => r.barangId === b.id)
      const kePesan = barisSaran && saran
        ? `/pesan-cepat/${saran.id}`
        : penawaranPertama
          ? `/penawaran/${penawaranPertama.id}`
          : `/belanja?cari=${encodeURIComponent(b.nama)}`

      /* Jumlah yang dimasukkan tombol: baris saran belanja kalau barangnya ada
         di sana, lalu saran model kalau datanya cukup. Tanpa keduanya tidak ada
         angka yang bisa dipertanggungjawabkan, jadi tombolnya membuka pilihan
         distributor, bukan menebak jumlah. */
      const rekomendasi = layakDiperkirakan(b) ? rekomendasiDari(b) : undefined
      const isiPesan =
        barisSaran?.penawaranId
          ? { penawaranId: barisSaran.penawaranId, jumlah: Math.max(1, barisSaran.jumlahSaran), kontrakId: barisSaran.kontrakId }
          : rekomendasi?.arah === 'tambah' && rekomendasi.penawaranId
            ? { penawaranId: rekomendasi.penawaranId, jumlah: Math.max(1, rekomendasi.jumlah), kontrakId: rekomendasi.kontrakId }
            : null

      hasil.push(
        dikirim > 0
          ? {
              kunci: `habis-${b.id}`,
              urutan: 7,
              nada: 'info',
              Ikon: IkonPasokan,
              judul: `${b.nama} sudah habis`,
              detail: `Sedang dikirim, ${jumlahTampil(b, dikirim)} dalam perjalanan.`,
              aksi: { label: 'Lihat Stok', ke: `/stok/${b.id}` },
            }
          : {
              kunci: `habis-${b.id}`,
              urutan: 0,
              nada: 'kritis',
              Ikon: IkonSilang,
              judul: `${b.nama} sudah habis`,
              detail: `Biasanya terpakai ${jumlahTampil(b, b.pemakaianHarian)} per hari.`,
              aksi: isiPesan
                ? {
                    label: (
                      <>
                        <HanyaPembacaLayar>Masukkan ke </HanyaPembacaLayar>Keranjang
                      </>
                    ),
                    ikon: <IkonTambah size={15} />,
                    onClick: () => masukkanSaran(b.nama, isiPesan),
                  }
                : { label: 'Pilih Distributor', ke: kePesan },
            },
      )
    }

    /* 2. Saran belanja harian: dibuka dulu supaya jumlahnya bisa diperiksa. */
    if (saran && saran.baris.length > 0) {
      const nama = saran.baris
        .slice(0, 3)
        .map((r) => barang.find((b) => b.id === r.barangId)?.nama)
        .filter(Boolean)
        .join(', ')
      hasil.push({
        kunci: 'saran',
        urutan: 1,
        nada: 'menipis',
        Ikon: IkonKeranjang,
        judul: `${saran.baris.length} barang perlu dibeli minggu ini`,
        detail: saran.baris.length > 3 ? `${nama} +${saran.baris.length - 3}` : nama,
        aksi: { label: 'Lihat', ke: `/pesan-cepat/${saran.id}` },
      })
    }

    /* 3. Kuota kontrak yang kurang, digabung jadi satu baris kalau lebih dari satu. */
    const kurang = kontrak
      .filter((x) => statusKuota(x) === 'kurang')
      .map((k) => ({ k, sisa: Math.max(0, k.periodeBerjalan.kuota - k.periodeBerjalan.diterima - k.dalamPerjalanan) }))
    if (kurang.length === 1) {
      const { k, sisa } = kurang[0]
      hasil.push({
        kunci: `kuota-${k.id}`,
        urutan: 2,
        nada: 'merek',
        Ikon: IkonKontrak,
        judul: `Kuota ${k.namaBarang} masih kurang`,
        detail: `Kurang ${angkaJumlah(sisa)} ${k.satuan} dari kuota ${angkaJumlah(k.periodeBerjalan.kuota)} ${k.satuan} bulan ini. Sisa ${sisaHariPeriode()} hari.`,
        aksi: { label: 'Kontrak', ke: `/kontrak/${k.id}` },
      })
    } else if (kurang.length > 1) {
      const rincian = kurang
        .slice(0, 3)
        .map(({ k, sisa }) => `${k.namaBarang} ${angkaJumlah(sisa)} ${k.satuan}`)
        .join(' · ')
      hasil.push({
        kunci: 'kuota',
        urutan: 2,
        nada: 'merek',
        Ikon: IkonKontrak,
        judul: `${kurang.length} kuota kontrak masih kurang`,
        detail: `${rincian}${kurang.length > 3 ? ` +${kurang.length - 3}` : ''}. Sisa ${sisaHariPeriode()} hari.`,
        aksi: { label: 'Kontrak', ke: '/pesanan?tab=kontrak' },
      })
    }

    /* 4. Kontrak yang akan berakhir */
    for (const k of kontrak.filter((x) => x.status === 'akan-berakhir')) {
      const hari = Math.ceil((+new Date(k.berakhir) - Date.now()) / HARI)
      hasil.push({
        kunci: `akhir-${k.id}`,
        urutan: 3,
        nada: 'info',
        Ikon: IkonKontrak,
        judul: `Kontrak ${k.namaBarang} berakhir ${hariLagi(hari)}`,
        detail: 'Perpanjangan bisa diatur sebelum masa kontrak habis.',
        aksi: { label: 'Kontrak', ke: `/kontrak/${k.id}` },
      })
    }

    /* 5. Barang yang sudah sampai dan menunggu diperiksa. Syaratnya sama
       dengan kartu Pesanan berjalan dan pemberitahuan. */
    for (const p of pesanan.filter(sudahSampai)) {
      hasil.push({
        kunci: `terima-${p.id}`,
        urutan: 4,
        nada: 'merek',
        Ikon: IkonPasokan,
        judul: `Kiriman dari ${distributorById(p.distributorId)?.nama ?? 'distributor'} sudah sampai`,
        detail: `${p.nomor} menunggu kamu periksa. Stok bertambah setelah kamu konfirmasi.`,
        aksi: { label: 'Terima', ke: `/pesanan/${p.id}/terima` },
      })
    }

    /* 6. Draf pesanan rutin yang menunggu persetujuan */
    for (const p of pesanan.filter((x) => x.status === 'draf')) {
      hasil.push({
        kunci: `draf-${p.id}`,
        urutan: 5,
        nada: 'info',
        Ikon: IkonPetir,
        judul: 'Draf pesanan rutin menunggu diperiksa',
        detail: `${p.baris[0]?.nama} ${angka(p.baris[0]?.jumlah ?? 0)} ${p.baris[0]?.satuan} ke ${distributorById(p.distributorId)?.nama}. Tidak terkirim sebelum kamu setujui.`,
        aksi: { label: 'Periksa', ke: `/pesanan/${p.id}` },
      })
    }

    /* 7. Pesanan yang belum dibayar */
    const belumBayar = pesanan.filter(
      (p) => p.statusBayar === 'belum-dibayar' && PESANAN_BERJALAN.includes(p.status) && p.status !== 'draf',
    )
    if (belumBayar.length > 0) {
      const p = belumBayar[0]
      hasil.push({
        kunci: `bayar-${p.id}`,
        urutan: 6,
        nada: 'netral',
        Ikon: IkonNota,
        judul: `${belumBayar.length} pesanan belum dibayar`,
        detail: `${p.nomor} ke ${distributorById(p.distributorId)?.nama} belum ada catatan pembayarannya.`,
        aksi: { label: 'Lihat', ke: `/pesanan/${p.id}` },
      })
    }

    return hasil.sort((a, b) => a.urutan - b.urutan)
  }, [barang, kontrak, pesanan, tambahKeKeranjang, tampilkanRacun])

  const isiKeranjang = keranjang.reduce((a, k) => a + k.baris.length, 0)

  /* Pesanan berjalan (Q109): donat per status kita sendiri, lalu dua pesanan
     terpenting. Kiriman yang sudah sampai merah dengan tombol Terima. */
  const berjalan = useMemo(() => pesanan.filter((p) => PESANAN_BERJALAN.includes(p.status)), [pesanan])
  const donat = useMemo<PotonganDonat[]>(() => {
    const hitung = (s: Pesanan['status']) => berjalan.filter((p) => p.status === s).length
    const draf = hitung('draf')
    return [
      { kunci: 'menunggu', label: LABEL_PESANAN['menunggu-konfirmasi'], jumlah: hitung('menunggu-konfirmasi'), garis: 'stroke-seri-2', titik: 'bg-seri-2' },
      { kunci: 'disiapkan', label: LABEL_PESANAN.disiapkan, jumlah: hitung('disiapkan'), garis: 'stroke-seri-1', titik: 'bg-seri-1' },
      { kunci: 'dikirim', label: LABEL_PESANAN.dikirim, jumlah: hitung('dikirim'), garis: 'stroke-seri-4', titik: 'bg-seri-4' },
      ...(draf > 0
        ? [{ kunci: 'draf', label: 'Draf rutin', jumlah: draf, garis: 'stroke-line-strong', titik: 'bg-line-strong' }]
        : []),
    ]
  }, [berjalan])
  const pesananPenting = useMemo<Urusan[]>(() => {
    const urut = [...berjalan].sort((a, b) =>
      sudahSampai(a) !== sudahSampai(b) ? (sudahSampai(a) ? -1 : 1) : URUT_BERJALAN[a.status] - URUT_BERJALAN[b.status],
    )
    return urut.slice(0, 2).map((p): Urusan => {
      const nama = distributorById(p.distributorId)?.nama ?? 'Distributor'
      if (sudahSampai(p)) {
        const lewat = p.perkiraanTiba ? Math.floor((Date.now() - +new Date(p.perkiraanTiba)) / HARI) : 0
        return {
          kunci: p.id,
          nada: 'kritis',
          Ikon: IkonPasokan,
          judul: nama,
          detail: (
            <>
              {LABEL_PESANAN.dikirim} ·{' '}
              <strong className="font-bold text-kritis-ink">
                {lewat >= 1 ? `terlambat ${lewat} hari` : 'sudah sampai'}
              </strong>
            </>
          ),
          aksi: { label: 'Terima', ke: `/pesanan/${p.id}/terima` },
        }
      }
      return {
        kunci: p.id,
        nada: p.status === 'menunggu-konfirmasi' ? 'menipis' : p.status === 'draf' ? 'netral' : 'info',
        Ikon: p.status === 'menunggu-konfirmasi' ? IkonJam : p.status === 'disiapkan' ? IkonKotak : p.status === 'draf' ? IkonPetir : IkonPasokan,
        judul: nama,
        detail: (
          <>
            {p.status === 'draf' ? 'Draf rutin' : LABEL_PESANAN[p.status]}
            {p.statusBayar === 'belum-dibayar' && p.status !== 'draf' ? (
              <>
                {' · '}
                <strong className="font-bold text-menipis-ink">belum dibayar</strong>
              </>
            ) : p.perkiraanTiba ? (
              ` · tiba ${waktuNanti(p.perkiraanTiba)}`
            ) : null}
          </>
        ),
        aksi: { label: p.status === 'draf' ? 'Periksa' : 'Detail', ke: `/pesanan/${p.id}` },
      }
    })
  }, [berjalan])

  /**
   * Angka pada empat pintasan "Perlu Tindakan".
   *
   * Semuanya dihitung dari penyimpanan aplikasi, bukan angka contoh yang
   * ditulis tangan: lencana yang berbohong satu kali membuat pemilik warung
   * berhenti mempercayai seluruh halaman.
   *
   * Populasinya SELURUH barang, tanpa membuang yang dicatat manual. Layar
   * Stok menyaring dari seluruh barang juga, dan lencana di sini cuma boleh
   * menjanjikan panjang daftar yang nanti benar-benar terbuka.
   */
  const pintasan = useMemo<Pintasan[]>(
    () => [
      {
        kunci: 'habis',
        label: 'Stok Habis',
        ke: '/stok?filter=habis',
        jumlah: barang.filter((b) => statusStok(b) === 'habis').length,
        satuan: 'barang',
        gambar: 'stok-habis.png',
      },
      {
        kunci: 'menipis',
        label: 'Stok Menipis',
        ke: '/stok?filter=menipis',
        jumlah: barang.filter((b) => statusStok(b) === 'menipis').length,
        satuan: 'barang',
        gambar: 'stok-menipis.svg',
      },
      {
        // "Kedaluwarsa" sama dengan chip penyaring di layar Stok: satu hal, satu ejaan.
        kunci: 'kedaluwarsa',
        label: 'Segera Kedaluwarsa',
        ke: '/stok?filter=kedaluwarsa',
        jumlah: barang.filter((b) => {
          if (!b.ingatkanKedaluwarsa || !b.kedaluwarsa) return false
          return Math.ceil((+new Date(b.kedaluwarsa) - Date.now()) / HARI) <= HARI_KEDALUWARSA_DEKAT
        }).length,
        satuan: 'barang',
        gambar: 'segera-kedaluwarsa.png',
      },
      {
        kunci: 'kontrak',
        label: 'Kontrak Akan Berakhir',
        ke: '/pesanan?tab=kontrak&status=akan-berakhir',
        jumlah: kontrak.filter((k) => k.status === 'akan-berakhir').length,
        satuan: 'kontrak',
        gambar: 'kontrak-berakhir.svg',
      },
    ],
    [barang, kontrak],
  )

  /* Rekomendasi model: yang perlu ditindak dulu (tambah), lalu yang perlu
     direm (kurang). Yang "tetap" tidak ditampilkan karena tidak meminta
     keputusan apa pun dari pemilik warung.

     Dihitung ulang dari stok yang hidup di penyimpanan, bukan dari daftar
     yang dibekukan saat aplikasi dimuat. Kalau tidak, kartu masih menyuruh
     menambah stok yang baru saja bertambah lewat Terima Barang. */
  const rekomendasi = useMemo(
    () =>
      barang
        .filter(layakDiperkirakan)
        .map(rekomendasiDari)
        .filter((r) => r.arah !== 'tetap')
        .map((r) => ({ r, urutan: r.arah === 'tambah' ? 0 : 1 }))
        .sort((a, b) => a.urutan - b.urutan)
        .slice(0, 6)
        .map((x) => x.r),
    [barang],
  )

  /* Lembar "Masukkan ke Keranjang" milik kartu prediksi. Jumlah awalnya angka
     saran model, tapi pemilik warung boleh menurunkannya sesuai isi kantong. */
  const [pilihan, setPilihan] = useState<RekomendasiPrediksi | null>(null)
  const [jumlahBeli, setJumlahBeli] = useState(1)

  const penawaranPilihan = pilihan?.penawaranId ? penawaranById(pilihan.penawaranId) : undefined
  const barangPilihan = pilihan ? barang.find((b) => b.id === pilihan.barangId) : undefined

  function bukaLembar(r: RekomendasiPrediksi) {
    setPilihan(r)
    setJumlahBeli(r.jumlah)
  }

  function simpanKeKeranjang() {
    if (!pilihan || !penawaranPilihan) return
    tambahKeKeranjang(
      penawaranPilihan.distributorId,
      penawaranPilihan.id,
      jumlahBeli,
      pilihan.jumlah,
      pilihan.kontrakId,
    )
    /* Baris yang sudah ada di keranjang DIGANTI jumlahnya, bukan ditambah.
       Racun yang berbunyi "masuk keranjang" membuat pemilik warung mengira
       angkanya berakumulasi, jadi yang disebut di sini adalah jumlah akhir
       yang benar-benar ada di keranjang. */
    tampilkanRacun(
      `${barangPilihan?.nama ?? penawaranPilihan.nama} di keranjang diatur jadi ${angka(jumlahBeli)} ${penawaranPilihan.satuan}.`,
      'aman',
    )
    setPilihan(null)
  }

  return (
    <div className="pb-6">
      {/* Sambutan ditulis biasa, bukan HURUF BESAR SEMUA: pengguna sasaran
          aplikasi ini berumur 40 tahun ke atas, dan teks kapital seluruhnya
          lebih lambat dibaca. Lonceng, keranjang, dan logo tinggal di
          KerangkaAplikasi, jadi tidak diulang di sini. */}
      <KepalaSambutan nama={profil.namaUsaha} bawah={<PitaDataKasir />} />

      {/* Banner status akun */}
      <div className="mt-3 empty:mt-0">
        <BannerAkun />
      </div>

      {/* Promo distributor (revisi V5, Q107): kartu berfoto di kotak putih,
          "Lihat semua" membuka halaman semua promo. */}
      {promoTampil.length > 0 && (
        <section aria-labelledby="judul-promo" className={cx(KELAS_BAGIAN, 'mt-4')}>
          <Korsel
            label="Promo dari distributor"
            otomatis
            judul={
              <div>
                <h2 id="judul-promo" className="text-subjudul font-extrabold text-brand-soft-ink leading-tight">
                  Promo dari Distributor
                </h2>
                <p className="mt-0.5 text-isi text-ink-3 leading-snug max-sm:hidden">
                  Penawaran dari distributor langgananmu, pilih yang cocok untuk stok minggu ini.
                </p>
              </div>
            }
            aksi={
              <Link to="/promo" className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline">
                Lihat semua
                <IkonPanahKanan size={15} />
              </Link>
            }
            kelasItem="w-[85%] sm:w-[20rem] lg:w-[calc((100%-1.5rem)/3)]"
            isi={promoTampil.map((p) => ({ kunci: p.id, elemen: <KartuPromo promo={p} /> }))}
          />
        </section>
      )}

      {/* Perlu Tindakan: pintasan penyaring, bukan tindakan itu sendiri */}
      <PerluTindakan pintasan={pintasan} className="mt-3 sm:mt-4" />

      {/* Urusan konkret dan pesanan berjalan berdampingan di desktop (6 : 5,
          seperti rancangannya), bertumpuk di HP. */}
      <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-stretch">
        <KartuUrusan
          butir={urusan}
          kosong={
            <p className="flex items-center gap-2 text-kartu font-semibold text-aman-ink bg-aman-soft rounded-md px-3.5 py-3">
              <IkonCentangLingkaran size={18} />
              Semua aman hari ini.
            </p>
          }
        />

        <Bagian
          id="judul-pesanan-berjalan"
          judul="Pesanan berjalan"
          besar
          aksi={
            <Link to="/pesanan" className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline">
              Lihat semua
              <IkonPanahKanan size={15} />
            </Link>
          }
          className="flex flex-col"
        >
          {berjalan.length === 0 ? (
            <p className="text-isi text-ink-3">
              Belum ada pesanan yang sedang berjalan.{' '}
              <Link to="/belanja" className="font-semibold text-brand hover:underline">
                Cari barang di Distributor
              </Link>
              .
            </p>
          ) : (
            <>
              <DonatStatus
                potongan={donat}
                satuan="pesanan"
                label={`Dari ${berjalan.length} pesanan berjalan: ${donat
                  .filter((d) => d.jumlah > 0)
                  .map((d) => `${d.jumlah} ${d.label.toLowerCase()}`)
                  .join(', ')}`}
              />
              <ul className="mt-auto pt-3 flex flex-col gap-1">
                {/* Merah untuk tiap kiriman yang sudah sampai, tapi tombol ungu penuh
                    hanya satu: dua tombol utama sebelahan saling berebut perhatian. */}
                {pesananPenting.map((u, i) => (
                  <BarisUrusan key={u.kunci} u={u} utama={i === 0 && u.nada === 'kritis'} sorot={u.nada === 'kritis'} />
                ))}
              </ul>
            </>
          )}
        </Bagian>
      </div>

      {/* Pita belanja yang belum dikirim */}
      {isiKeranjang > 0 && (
        <Link
          to="/keranjang"
          className="mt-4 flex items-center gap-2.5 px-3.5 py-3 rounded-md bg-brand-soft text-brand-soft-ink text-isi font-semibold hover:brightness-97"
        >
          <IkonKeranjang size={18} className="shrink-0" />
          <span className="grow">Belanja belum dikirim: {isiKeranjang} barang</span>
          <span className="underline underline-offset-2 shrink-0">Lanjutkan</span>
        </Link>
      )}

      {/* Ringkasan penjualan dari nota kasir, hanya untuk data server. */}
      {ambilRingkasan && (
        <KartuRingkasanPenjualan ambil={ambilRingkasan} ke="/penjualan" className="mt-3 sm:mt-4" />
      )}

      {/* Prediksi Stok */}
      <Bagian
        id="judul-prediksi"
        judul="Prediksi Stok"
        besar
        keterangan="Perkiraan bisa meleset. Angka di bawah adalah saran, bukan jaminan."
        aksi={
          <Link to="/prediksi" className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline">
            Lihat semua
            <IkonPanahKanan size={15} />
          </Link>
        }
        className="mt-3 sm:mt-4"
      >
        {!perkiraanSiap ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            <Kerangka className="h-40 w-full rounded-lg" />
            <Kerangka className="h-40 w-full rounded-lg hidden sm:block" />
            <Kerangka className="h-40 w-full rounded-lg hidden lg:block" />
          </div>
        ) : rekomendasi.length === 0 ? (
          <Kartu padat>
            <p className="text-isi text-ink-3">
              Belum ada saran bulan depan. Data pemakaian masih dikumpulkan.
            </p>
          </Kartu>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {rekomendasi.map((r) => {
              const b = barang.find((x) => x.id === r.barangId)
              const nada = NADA_ARAH_PREDIKSI[r.arah]
              const kelasArah = {
                menipis: 'text-menipis-ink',
                info: 'text-info-ink',
                aman: 'text-aman-ink',
              }[nada]
              const IkonArah = r.arah === 'tambah' ? IkonTrenNaik : IkonTrenTurun
              const maks = Math.max(r.pemakaianBulanIni, r.perkiraanBulanDepan, 1)
              // Warnanya sama dengan grafik Prediksi: pemakaian aktual seri-1,
              // perkiraan merah.
              const bar = [
                { kunci: 'ini', label: 'Terpakai bulan ini', nilai: r.pemakaianBulanIni, warna: 'bg-seri-1' },
                {
                  kunci: 'depan',
                  label: 'Perkiraan bulan depan',
                  nilai: r.perkiraanBulanDepan,
                  warna: 'bg-seri-perkiraan',
                },
              ]
              const bisaKeranjang = r.arah === 'tambah' && r.penawaranId != null

              return (
                <Kartu key={r.barangId} padat className="flex flex-col">
                  <Link
                    to={`/prediksi?barang=${r.barangId}`}
                    className="block grow rounded-md p-1 -m-1 hover:bg-surface-2 transition-colors"
                  >
                    <p className="text-kartu font-bold text-ink leading-snug">
                      {b?.nama ?? 'Barang'}
                    </p>

                    {/* Angka saran sengaja jauh lebih besar dari kata-katanya:
                        yang ingin disorot memang angkanya. */}
                    <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                      <span className={cx('inline-flex items-center gap-1 text-isi font-bold', kelasArah)}>
                        <IkonArah size={14} />
                        {LABEL_ARAH_PREDIKSI[r.arah]}
                      </span>
                      <span className="text-[2.5rem] font-extrabold leading-none tracking-tight text-ink">
                        {angka(r.jumlah)}
                      </span>
                      <span className="text-isi font-semibold text-ink-2">
                        {r.satuanSaran} — bulan depan
                      </span>
                    </p>

                    {/* Kedua bar mengukur PEMAKAIAN, bukan sisa stok: saran
                        "tambah" muncul justru karena stok di gudang lebih kecil
                        daripada kebutuhan bulan depan. */}
                    <p className="mt-3 text-kecil text-ink-3">Pemakaian, bukan sisa stok:</p>
                    <div className="mt-1.5 space-y-2">
                      {bar.map((x) => (
                        <div key={x.kunci}>
                          <div className="flex items-baseline justify-between gap-2 text-kecil">
                            <span className="text-ink-3">{x.label}</span>
                            <span className="font-semibold text-ink-2 tabular">
                              {b ? jumlahTampil(b, x.nilai) : angka(x.nilai)}
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                            <div
                              className={cx('h-full rounded-full', x.warna)}
                              style={{ width: `${Math.max(2, Math.round((x.nilai / maks) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Link>

                  {bisaKeranjang && (
                    <div className="mt-3 pt-3 border-t border-line">
                      <Tombol
                        ragam="sekunder"
                        penuh
                        ikonKiri={<IkonKeranjang size={16} />}
                        onClick={() => bukaLembar(r)}
                      >
                        Masukkan ke Keranjang
                      </Tombol>
                    </div>
                  )}
                </Kartu>
              )
            })}
          </div>
        )}
      </Bagian>

      {/* Ringkasan kontrak: cermin dari tab Pesanan, bukan data baru */}
      {kontrak.length > 0 && (
        <Bagian
          id="judul-kontrak"
          judul="Kuota Kontrak Bulan Ini"
          besar
          keterangan={`${kontrak.length} kontrak berjalan. Setiap barang punya kontrak sendiri.`}
          aksi={
            <Link
              to="/pesanan?tab=kontrak"
              className="inline-flex items-center gap-1 min-h-11 text-isi font-bold text-brand hover:underline"
            >
              Lihat semua
              <IkonPanahKanan size={15} />
            </Link>
          }
          className="mt-3 sm:mt-4 hidden lg:block"
        >
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 [&>*]:min-w-0">
            {kontrak.slice(0, 4).map((k) => (
              <Kartu key={k.id} padat>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    to={`/kontrak/${k.id}`}
                    className="text-kartu font-bold text-ink hover:text-brand transition-colors truncate"
                  >
                    {k.namaBarang}
                  </Link>
                </div>
                <KuotaBulanIni kontrak={k} ringkas />
              </Kartu>
            ))}
          </div>
        </Bagian>
      )}

      <Lembar
        terbuka={pilihan != null}
        tutup={() => setPilihan(null)}
        judul="Masukkan ke Keranjang"
        keterangan={
          barangPilihan && penawaranPilihan
            ? `${barangPilihan.nama} dari ${distributorById(penawaranPilihan.distributorId)?.nama ?? 'distributor'}`
            : undefined
        }
        lebar="sempit"
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={() => setPilihan(null)}>
              Batal
            </Tombol>
            <Tombol penuh onClick={simpanKeKeranjang} disabled={jumlahBeli <= 0}>
              Masukkan
            </Tombol>
          </div>
        }
      >
        {pilihan && penawaranPilihan && (
          <div className="pb-4 space-y-3">
            <p className="text-isi text-ink-2 leading-relaxed">
              Model menyarankan {angka(pilihan.jumlah)} {pilihan.satuanSaran} untuk bulan depan. Kamu boleh
              menguranginya kalau kondisi hari ini tidak memungkinkan.
            </p>
            <PengaturJumlah
              nilai={jumlahBeli}
              ubah={setJumlahBeli}
              min={1}
              maks={Math.max(1, penawaranPilihan.stokTersedia)}
              satuan={penawaranPilihan.satuan}
              saranModel={pilihan.jumlah}
              label="Jumlah"
            />
            <p className="text-isi text-ink-3 leading-relaxed">
              Barang belum dipesan. Ia menunggu di keranjang sampai kamu kirim pesanannya sendiri.
            </p>
          </div>
        )}
      </Lembar>
    </div>
  )
}
