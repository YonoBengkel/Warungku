import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BannerAkun,
  KartuTindakan,
  KartuPesanan,
  KuotaBulanIni,
  PitaDataKasir,
} from '@/components/domain'
import { KartuPromo } from '@/components/domain/KartuPromo'
import { Korsel } from '@/components/ui/korsel'
import { JudulBagian, Kartu, Kerangka, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import {
  IkonKalender,
  IkonKeranjang,
  IkonKontrak,
  IkonPasokan,
  IkonPeringatan,
  IkonPetir,
  IkonSilang,
  IkonNota,
  IkonCentangLingkaran,
  IkonTrenNaik,
  IkonTrenTurun,
} from '@/icons'
import { angka, cx, hariLagi, tanggalLengkapHari } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'
import {
  daftarPromo,
  layakDiperkirakan,
  penawaranById,
  penawaranUntukBarang,
  rekomendasiDari,
  saranBelanja,
  statusKuota,
  statusStok,
  sisaHariPeriode,
  distributorById,
} from '@/data/dummy'
import { LABEL_ARAH_PREDIKSI, NADA_ARAH_PREDIKSI, PESANAN_BERJALAN } from '@/lib/label'
import type { RekomendasiPrediksi } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Beranda menjawab satu pertanyaan: hari ini saya harus ngapain.
 *
 * Urutan bloknya dikunci: sambutan, promo distributor, pintasan "Perlu
 * Tindakan", kartu tindakan konkret, lalu Prediksi Stok.
 *
 * Aturan yang dipegang: Beranda tidak pernah punya data sendiri. Tiap blok
 * adalah cermin dari Stok, Pesanan, Kontrak, atau model prediksi, dan selalu
 * menautkan balik ke sumber aslinya. Tidak ada fitur yang hanya bisa dicapai
 * dari sini.
 *
 * Yang sengaja tidak ada di sini: kartu omzet, untung, margin, dan nilai
 * rupiah penjualan. Harga jual dikelola di aplikasi kasir, jadi angka apa pun
 * yang kami tampilkan soal itu pasti salah.
 */

/** Ambang "hampir kedaluwarsa". Sama persis dengan penyaring di layar Stok,
 *  supaya angka pada lencana dan panjang daftar yang dibuka tidak pernah beda. */
const HARI_KEDALUWARSA_DEKAT = 14

export default function Beranda() {
  const barang = useAplikasi((s) => s.barang)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)
  const keranjang = useAplikasi((s) => s.keranjang)
  const profil = useAplikasi((s) => s.profil)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  /* Blok prediksi sengaja dimuat belakangan: ia paling mahal dan paling tidak
     mendesak, jadi tidak boleh menahan daftar yang perlu diurus. */
  const [perkiraanSiap, setPerkiraanSiap] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setPerkiraanSiap(true), 650)
    return () => window.clearTimeout(t)
  }, [])

  const tugas = useMemo(() => {
    const hasil: Array<{ kunci: string; urutan: number; elemen: ReactNode }> = []

    /* Tombol di kartu langsung memasukkan saran ke keranjang; kartunya sendiri
       membuka Lembar Pesan Cepat untuk yang mau memeriksa dulu. Pemberitahuan
       sesudahnya membawa tautan "Ubah jumlah", karena jumlah saran bisa saja
       tidak cocok dengan rencana pemilik usaha hari itu. */
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

    /* Dipakai dua kali: sebagai tujuan kartu "habis" (kalau barangnya memang
       ada di dalamnya) dan sebagai kartu saran belanja sendiri. */
    const saran = saranBelanja[0]

    /* 1. Stok habis dan menipis */
    const kritis = barang
      .filter((b) => !b.dicatatManual && (statusStok(b) === 'habis' || statusStok(b) === 'menipis'))
      .sort((a, b) => (statusStok(a) === 'habis' ? -1 : 1) - (statusStok(b) === 'habis' ? -1 : 1))

    const habis = kritis.filter((b) => statusStok(b) === 'habis')
    for (const b of habis.slice(0, 2)) {
      const dikirim = pesanan
        .filter((p) => PESANAN_BERJALAN.includes(p.status) && p.status !== 'draf')
        .flatMap((p) => p.baris)
        .filter((x) => x.barangId === b.id)
        .reduce((a, x) => a + x.jumlah * x.isiPerSatuan, 0)

      /* Tujuan "Pesan Sekarang" mengikuti barang yang habis, bukan selalu
         saran belanja harian. Menaruh pemilik warung di daftar yang tidak
         memuat barangnya sama saja dengan menyuruh dia mencari sendiri tanpa
         memberi tahu. Urutannya: daftar saran kalau barangnya memang di sana,
         lalu penawaran langsung, lalu pencarian di Distributor. */
      const penawaranPertama = penawaranUntukBarang(b.id)[0]
      const barisSaran = saran?.baris.find((r) => r.barangId === b.id)
      const kePesan = barisSaran
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

      hasil.push({
        kunci: `habis-${b.id}`,
        urutan: 0,
        elemen: (
          <KartuTindakan
            nada="kritis"
            ikon={<IkonSilang size={18} />}
            judul={`${b.nama} sudah habis`}
            lencana={dikirim > 0 ? <Lencana nada="info">Sudah dipesan, sedang dikirim</Lencana> : undefined}
            detail={
              dikirim > 0
                ? `Stok tercatat 0. ${jumlahTampil(b, dikirim)} sedang dikirim.`
                : `Stok tercatat 0. Rata-rata terpakai ${jumlahTampil(b, b.pemakaianHarian)} per hari.`
            }
            aksiLabel={dikirim > 0 ? 'Lihat Stok' : isiPesan ? 'Pesan Sekarang' : 'Pilih Distributor'}
            aksiKe={dikirim > 0 ? `/stok/${b.id}` : isiPesan ? undefined : kePesan}
            onAksi={isiPesan && dikirim <= 0 ? () => masukkanSaran(b.nama, isiPesan) : undefined}
            keKartu={dikirim > 0 ? undefined : kePesan}
          />
        ),
      })
    }

    /* 2. Saran belanja harian */
    if (saran && saran.baris.length > 0) {
      hasil.push({
        kunci: 'saran',
        urutan: 1,
        elemen: (
          <KartuTindakan
            nada="menipis"
            ikon={<IkonKeranjang size={18} />}
            judul={`${saran.baris.length} barang perlu dibeli minggu ini`}
            detail={saran.baris
              .slice(0, 3)
              .map((r) => barang.find((b) => b.id === r.barangId)?.nama)
              .filter(Boolean)
              .join(', ')
              .concat(saran.baris.length > 3 ? `, dan ${saran.baris.length - 3} lainnya` : '')}
            aksiLabel="Masukkan Saran ke Keranjang"
            onAksi={() => {
              const bisa = saran.baris.filter((r) => r.penawaranId != null)
              for (const r of bisa) {
                const pw = penawaranById(r.penawaranId!)
                if (pw) tambahKeKeranjang(pw.distributorId, pw.id, Math.max(1, r.jumlahSaran), r.jumlahSaran, r.kontrakId)
              }
              tampilkanRacun(`${bisa.length} barang dari saran belanja masuk keranjang.`, 'aman', {
                label: 'Lihat keranjang',
                ke: '/keranjang',
              })
            }}
            keKartu={`/pesan-cepat/${saran.id}`}
          />
        ),
      })
    }

    /* 3. Kuota kontrak yang kurang */
    for (const k of kontrak.filter((x) => statusKuota(x) === 'kurang')) {
      const kurang = Math.max(0, k.periodeBerjalan.kuota - k.periodeBerjalan.diterima - k.dalamPerjalanan)
      hasil.push({
        kunci: `kuota-${k.id}`,
        urutan: 2,
        elemen: (
          <KartuTindakan
            nada="menipis"
            ikon={<IkonKontrak size={18} />}
            judul={`Kuota ${k.namaBarang} masih kurang`}
            detail={`Kurang ${angka(kurang)} ${k.satuan} dari kuota ${angka(k.periodeBerjalan.kuota)} ${k.satuan} bulan ini. Sisa ${sisaHariPeriode()} hari.`}
            aksiLabel="Lihat Kontrak"
            aksiKe={`/kontrak/${k.id}`}
          />
        ),
      })
    }

    /* 4. Kontrak yang akan berakhir */
    for (const k of kontrak.filter((x) => x.status === 'akan-berakhir')) {
      const hari = Math.ceil((+new Date(k.berakhir) - Date.now()) / 86_400_000)
      hasil.push({
        kunci: `akhir-${k.id}`,
        urutan: 3,
        elemen: (
          <KartuTindakan
            nada="info"
            ikon={<IkonKontrak size={18} />}
            judul={`Kontrak ${k.namaBarang} berakhir ${hariLagi(hari)}`}
            detail={`Kalau ingin melanjutkan, perpanjangan bisa diatur sebelum masa kontrak habis.`}
            aksiLabel="Lihat Kontrak"
            aksiKe={`/kontrak/${k.id}`}
          />
        ),
      })
    }

    /* 5. Barang yang sudah sampai dan menunggu diperiksa */
    for (const p of pesanan.filter(
      (x) => x.status === 'dikirim' && x.perkiraanTiba && +new Date(x.perkiraanTiba) <= Date.now(),
    )) {
      const d = distributorById(p.distributorId)
      hasil.push({
        kunci: `terima-${p.id}`,
        urutan: 4,
        elemen: (
          <KartuTindakan
            nada="merek"
            ikon={<IkonPasokan size={18} />}
            judul={`Kiriman dari ${d?.nama} sudah sampai`}
            detail={`${p.nomor} menunggu kamu periksa. Stok baru bertambah setelah kamu konfirmasi.`}
            aksiLabel="Barang Sudah Sampai"
            aksiKe={`/pesanan/${p.id}/terima`}
          />
        ),
      })
    }

    /* 6. Draf pesanan rutin yang menunggu persetujuan */
    for (const p of pesanan.filter((x) => x.status === 'draf')) {
      const d = distributorById(p.distributorId)
      hasil.push({
        kunci: `draf-${p.id}`,
        urutan: 5,
        elemen: (
          <KartuTindakan
            nada="info"
            ikon={<IkonPetir size={18} />}
            judul="Draf pesanan rutin menunggu diperiksa"
            detail={`${p.baris[0]?.nama} ${angka(p.baris[0]?.jumlah ?? 0)} ${p.baris[0]?.satuan} ke ${d?.nama}. Tidak akan terkirim sebelum kamu setujui.`}
            aksiLabel="Periksa Draf"
            aksiKe={`/pesanan/${p.id}`}
          />
        ),
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
        elemen: (
          <KartuTindakan
            nada="netral"
            ikon={<IkonNota size={18} />}
            judul={`${belumBayar.length} pesanan belum dibayar`}
            detail={`${p.nomor} ke ${distributorById(p.distributorId)?.nama} belum ada catatan pembayarannya.`}
            aksiLabel="Lihat Pesanan"
            aksiKe={`/pesanan/${p.id}`}
          />
        ),
      })
    }

    return hasil.sort((a, b) => a.urutan - b.urutan).slice(0, 5)
  }, [barang, kontrak, pesanan, tambahKeKeranjang, tampilkanRacun])

  const berjalan = pesanan.filter((p) => PESANAN_BERJALAN.includes(p.status))
  const isiKeranjang = keranjang.reduce((a, k) => a + k.baris.length, 0)

  /**
   * Angka pada empat pintasan "Perlu Tindakan".
   *
   * Semuanya dihitung dari penyimpanan aplikasi, bukan angka contoh yang
   * ditulis tangan: lencana yang berbohong satu kali membuat pemilik warung
   * berhenti mempercayai seluruh halaman.
   *
   * Populasinya SELURUH barang, tanpa membuang yang dicatat manual. Layar
   * Stok menyaring dari seluruh barang juga, dan lencana di sini cuma boleh
   * menjanjikan panjang daftar yang nanti benar-benar terbuka. Lagi pula
   * barang yang dicatat manual tetap stok gudang yang perlu diurus kalau
   * habis — yang tidak bisa kami hitung cuma perkiraannya, bukan sisanya.
   */
  const hitungTindakan = useMemo(() => {
    return {
      habis: barang.filter((b) => statusStok(b) === 'habis').length,
      menipis: barang.filter((b) => statusStok(b) === 'menipis').length,
      kedaluwarsa: barang.filter((b) => {
        if (!b.ingatkanKedaluwarsa || !b.kedaluwarsa) return false
        const hari = Math.ceil((+new Date(b.kedaluwarsa) - Date.now()) / 86_400_000)
        return hari <= HARI_KEDALUWARSA_DEKAT
      }).length,
      kontrak: kontrak.filter((k) => k.status === 'akan-berakhir').length,
    }
  }, [barang, kontrak])

  /**
   * Empat pintasan penyaring. Kata "Kedaluwarsa" dipakai konsisten dengan chip
   * penyaring di layar Stok; satu hal yang sama tidak boleh punya dua ejaan.
   */
  const pintasan = [
    {
      kunci: 'habis',
      label: ['Stok', 'Habis'],
      ke: '/stok?filter=habis',
      jumlah: hitungTindakan.habis,
      satuan: 'barang',
      Ikon: IkonSilang,
      warna: 'bg-kritis-soft text-kritis-ink',
    },
    {
      kunci: 'menipis',
      label: ['Stok', 'Menipis'],
      ke: '/stok?filter=menipis',
      jumlah: hitungTindakan.menipis,
      satuan: 'barang',
      Ikon: IkonPeringatan,
      warna: 'bg-menipis-soft text-menipis-ink',
    },
    {
      kunci: 'kedaluwarsa',
      label: ['Hampir', 'Kedaluwarsa'],
      ke: '/stok?filter=kedaluwarsa',
      jumlah: hitungTindakan.kedaluwarsa,
      satuan: 'barang',
      Ikon: IkonKalender,
      warna: 'bg-info-soft text-info-ink',
    },
    {
      kunci: 'kontrak',
      label: ['Kontrak', 'Habis'],
      ke: '/pesanan?tab=kontrak&status=akan-berakhir',
      jumlah: hitungTindakan.kontrak,
      satuan: 'kontrak',
      Ikon: IkonKontrak,
      warna: 'bg-brand-soft text-brand-soft-ink',
    },
  ]

  /* Rekomendasi model: yang perlu ditindak dulu (tambah), lalu yang perlu
     direm (kurang). Yang "tetap" tidak ditampilkan karena tidak meminta
     keputusan apa pun dari pemilik warung.

     Dihitung ulang dari stok yang hidup di penyimpanan, bukan dari daftar
     yang dibekukan saat aplikasi dimuat. Kalau tidak, kartu masih menyuruh
     menambah stok yang baru saja bertambah lewat Terima Barang — dan sisi
     kirinya sendiri sudah menampilkan angka baru. */
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
      {/* Sambutan ditulis biasa, bukan HURUF BESAR SEMUA seperti di catatan
          aslinya: pengguna sasaran aplikasi ini berumur 40 tahun ke atas, dan
          teks kapital seluruhnya kehilangan bentuk kata sehingga lebih lambat
          dibaca. Maknanya sama, kecepatan bacanya tidak.
          Lonceng, keranjang, logo, dan nama aplikasi tinggal di
          KerangkaAplikasi, jadi tidak diulang di sini. */}
      <header className="mb-3">
        <h1 className="text-[1.375rem] font-extrabold text-ink tracking-tight leading-tight">
          Selamat datang, {profil.namaUsaha}
        </h1>
        <p className="mt-0.5 text-[0.875rem] text-ink-3">{tanggalLengkapHari(new Date())}</p>
      </header>

      {/* Pita data kasir */}
      <PitaDataKasir />

      {/* Banner status akun */}
      <div className="mt-3 empty:mt-0">
        <BannerAkun />
      </div>

      {/* Promo distributor */}
      <section aria-labelledby="judul-promo" className="mt-6">
        <JudulBagian
          id="judul-promo"
          judul="Promo dari Distributor"
          keterangan="Berganti sendiri. Geser, atau tekan jeda kalau mau membaca lebih lama."
        />
        <Korsel
          label="Promo dari distributor"
          otomatis
          kelasItem="w-[85%] sm:w-[20rem] lg:w-[calc((100%-1.5rem)/3)]"
          isi={daftarPromo.map((p) => ({ kunci: p.id, elemen: <KartuPromo promo={p} lebar /> }))}
        />
      </section>

      {/* Perlu Tindakan: pintasan penyaring, bukan tindakan itu sendiri */}
      <section aria-labelledby="judul-perlu-tindakan" className="mt-6">
        <JudulBagian
          id="judul-perlu-tindakan"
          judul="Perlu Tindakan"
          keterangan="Empat pintasan ke daftar yang sudah tersaring."
        />
        <div
          aria-label="Pintasan ke daftar stok dan kontrak yang perlu ditindak"
          className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {pintasan.map((p) => (
            <Link
              key={p.kunci}
              to={p.ke}
              aria-label={
                p.jumlah > 0
                  ? `${p.label.join(' ')}, ${p.jumlah} ${p.satuan}`
                  : `${p.label.join(' ')}, tidak ada ${p.satuan}`
              }
              className="shrink-0 w-[4.75rem] sm:w-[5.5rem] flex flex-col items-center gap-1.5 rounded-md py-1 hover:bg-sunken transition-colors"
            >
              {/* relative: lencana angka ditempel ke lingkaran ini, bukan ke
                  leluhur berposisi entah di mana di luar wadah gulir. */}
              <span className={cx('relative size-12 rounded-full grid place-items-center', p.warna)}>
                <p.Ikon size={22} />
                {p.jumlah > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-kritis text-ink-inverse text-[0.6875rem] font-bold grid place-items-center"
                  >
                    {p.jumlah > 99 ? '99+' : p.jumlah}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className="text-[0.6875rem] sm:text-[0.75rem] font-semibold text-ink-2 text-center leading-tight"
              >
                {p.label[0]}
                <br />
                {p.label[1]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Kartu tindakan konkret.
          Sengaja hidup berdampingan dengan baris ikon di atas dan bukan
          menggantikannya: baris ikon hanya membuka daftar yang sudah
          tersaring, sedangkan kartu di bawah ini adalah satu tindakan yang
          sudah jelas - termasuk satu-satunya jalan cepat ke "Barang Sudah
          Sampai" dan ke Lembar Pesan Cepat. */}
      <section aria-labelledby="judul-perlu-diurus" className="mt-6">
        <JudulBagian
          id="judul-perlu-diurus"
          judul="Yang perlu kamu urus hari ini"
          keterangan={tugas.length > 0 ? `${tugas.length} hal menunggu keputusan kamu.` : undefined}
        />
        {tugas.length === 0 ? (
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-aman-ink bg-aman-soft rounded-md px-3.5 py-3">
            <IkonCentangLingkaran size={18} />
            Semua aman hari ini.
          </p>
        ) : (
          /* Geser manual, tidak pernah berjalan sendiri: isinya tugas, termasuk
             satu-satunya jalan cepat ke "Barang Sudah Sampai". Kartu yang
             berpindah sendiri bisa membuat tugas terlewat, atau tombol kartu lain
             tertekan saat ia sedang bergerak. */
          <Korsel
            label="Yang perlu kamu urus hari ini"
            kelasItem="w-[88%] sm:w-[22rem] lg:w-[calc((100%-0.75rem)/2)]"
            isi={tugas.map((t) => ({ kunci: t.kunci, elemen: t.elemen }))}
          />
        )}
      </section>

      {/* Prediksi Stok */}
      <section aria-labelledby="judul-prediksi" className="mt-6">
        <JudulBagian
          id="judul-prediksi"
          judul="Prediksi Stok"
          keterangan="Perkiraan bisa meleset. Angka di bawah adalah saran, bukan jaminan."
          aksi={
            <Link to="/prediksi" className="text-[0.8125rem] font-bold text-brand hover:underline">
              Lihat semua
            </Link>
          }
        />

        {!perkiraanSiap ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            <Kerangka className="h-40 w-full rounded-lg" />
            <Kerangka className="h-40 w-full rounded-lg hidden sm:block" />
            <Kerangka className="h-40 w-full rounded-lg hidden lg:block" />
          </div>
        ) : rekomendasi.length === 0 ? (
          <Kartu padat>
            <p className="text-[0.875rem] text-ink-3">
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
              const bar = [
                { kunci: 'ini', label: 'Terpakai bulan ini', nilai: r.pemakaianBulanIni, warna: 'bg-seri-3' },
                {
                  kunci: 'depan',
                  label: 'Perkiraan bulan depan',
                  nilai: r.perkiraanBulanDepan,
                  warna: 'bg-seri-1',
                },
              ]
              const bisaKeranjang = r.arah === 'tambah' && r.penawaranId != null

              return (
                <Kartu key={r.barangId} padat className="flex flex-col">
                  <Link
                    to={`/prediksi?barang=${r.barangId}`}
                    className="block grow rounded-md p-1 -m-1 hover:bg-surface-2 transition-colors"
                  >
                    <p className="text-[0.9375rem] font-bold text-ink leading-snug">
                      {b?.nama ?? 'Barang'}
                    </p>

                    {/* Angka saran sengaja jauh lebih besar dari kata-katanya:
                        yang ingin disorot memang angkanya. */}
                    <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                      <span className={cx('inline-flex items-center gap-1 text-[0.8125rem] font-bold', kelasArah)}>
                        <IkonArah size={14} />
                        {LABEL_ARAH_PREDIKSI[r.arah]}
                      </span>
                      <span className="text-[2.5rem] font-extrabold leading-none tracking-tight text-ink">
                        {angka(r.jumlah)}
                      </span>
                      <span className="text-[0.8125rem] font-semibold text-ink-2">
                        {r.satuanSaran} — bulan depan
                      </span>
                    </p>

                    {/* Proporsi pemakaian: dua bar dengan skala yang sama,
                        masing-masing membawa angkanya sendiri supaya artinya
                        tidak bergantung pada warna.

                        Kedua bar mengukur PEMAKAIAN, bukan sisa stok. Tanpa
                        keterangan itu, angka saran di atas bisa terbaca
                        bertentangan dengan bar yang menurun — padahal saran
                        "tambah" muncul justru karena stok di gudang lebih
                        kecil daripada kebutuhan bulan depan. */}
                    <p className="mt-3 text-[0.75rem] text-ink-3">Pemakaian, bukan sisa stok:</p>
                    <div className="mt-1.5 space-y-2">
                      {bar.map((x) => (
                        <div key={x.kunci}>
                          <div className="flex items-baseline justify-between gap-2 text-[0.75rem]">
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
      </section>

      {/* Pesanan berjalan */}
      <section aria-labelledby="judul-pesanan-berjalan" className="mt-6">
        <JudulBagian
          id="judul-pesanan-berjalan"
          judul="Pesanan Berjalan"
          keterangan={berjalan.length === 0 ? undefined : `${berjalan.length} pesanan sedang diproses`}
          aksi={
            berjalan.length > 3 ? (
              <Link to="/pesanan" className="text-[0.8125rem] font-bold text-brand hover:underline">
                Lihat semua
              </Link>
            ) : undefined
          }
        />
        {berjalan.length === 0 ? (
          <Kartu padat>
            <p className="text-[0.875rem] text-ink-3">
              Belum ada pesanan yang sedang berjalan.{' '}
              <Link to="/belanja" className="font-semibold text-brand hover:underline">
                Cari barang di Distributor
              </Link>
              .
            </p>
          </Kartu>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
            {berjalan.slice(0, 4).map((p) => (
              <KartuPesanan key={p.id} pesanan={p} />
            ))}
          </div>
        )}
      </section>

      {/* Pita belanja yang belum dikirim */}
      {isiKeranjang > 0 && (
        <Link
          to="/keranjang"
          className="mt-4 flex items-center gap-2.5 px-3.5 py-3 rounded-md bg-brand-soft text-brand-soft-ink text-[0.875rem] font-semibold hover:brightness-97"
        >
          <IkonKeranjang size={18} className="shrink-0" />
          <span className="grow">Belanja belum dikirim: {isiKeranjang} barang</span>
          <span className="underline underline-offset-2 shrink-0">Lanjutkan</span>
        </Link>
      )}

      {/* Ringkasan kontrak: cermin dari tab Pesanan, bukan data baru */}
      {kontrak.length > 0 && (
        <section aria-labelledby="judul-kontrak" className="mt-6 hidden lg:block">
          <JudulBagian
            id="judul-kontrak"
            judul="Kuota Kontrak Bulan Ini"
            keterangan={`${kontrak.length} kontrak berjalan. Setiap barang punya kontrak sendiri.`}
            aksi={
              <Link to="/pesanan?tab=kontrak" className="text-[0.8125rem] font-bold text-brand hover:underline">
                Lihat semua
              </Link>
            }
          />
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 [&>*]:min-w-0">
            {kontrak.slice(0, 4).map((k) => (
              <Kartu key={k.id} padat>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    to={`/kontrak/${k.id}`}
                    className="text-[0.9375rem] font-bold text-ink hover:text-brand transition-colors truncate"
                  >
                    {k.namaBarang}
                  </Link>
                </div>
                <KuotaBulanIni kontrak={k} ringkas />
              </Kartu>
            ))}
          </div>
        </section>
      )}

      {/* Jalan keluar yang selalu ada, supaya Beranda tidak pernah jadi buntu */}
      <div className="mt-8 flex flex-wrap gap-2.5">
        <TombolTautan ke="/stok?filter=menipis" ragam="garis" ukuran="kecil" ikonKiri={<IkonPeringatan size={15} />}>
          Lihat semua stok menipis
        </TombolTautan>
        <TombolTautan ke="/belanja" ragam="garis" ukuran="kecil">
          Cari barang di Distributor
        </TombolTautan>
      </div>

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
            <p className="text-[0.875rem] text-ink-2 leading-relaxed">
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
            <p className="text-[0.8125rem] text-ink-3 leading-relaxed">
              Barang belum dipesan. Ia menunggu di keranjang sampai kamu kirim pesanannya sendiri.
            </p>
          </div>
        )}
      </Lembar>
    </div>
  )
}
