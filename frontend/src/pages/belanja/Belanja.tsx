import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  HanyaPembacaLayar,
  JudulBagian,
  Kartu,
  Lencana,
  Tombol,
  TombolTautan,
} from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { Chip, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { HargaBeli, LencanaPromo } from '@/components/domain/KartuPromo'
import { KeteranganMetode, METODE_MESIN2 } from '@/components/domain/KeteranganMetode'
import {
  IkonBintangIsi,
  IkonCari,
  IkonKontrak,
  IkonKotak,
  IkonPanahKanan,
  IkonSaring,
  IkonSilang,
  IkonToko,
} from '@/icons'
import { angka, cx, persen, waktuLalu } from '@/lib/format'
import { isiKemasan, kalimatIsiKemasan } from '@/lib/satuan'
import { JUDUL, LABEL_JENIS_USAHA } from '@/lib/label'
import type { Barang, Distributor, PaketKontrak, Penawaran } from '@/lib/types'
import { ambilRingkasanSaran, type RingkasanSaranServer } from '@/lib/apiKatalog'
import { distributorById, paketUntukPenawaran } from '@/data/dummy'
import { rekomendasiDistributor, type AspekUlasan, type DistributorDirekomendasikan } from '@/data/rekomendasi'
import { useAplikasi, usePenentuHarga } from '@/store/aplikasi'

/**
 * Distributor (rute tetap `/belanja`): satu kolom cari, hasil di layar yang sama.
 *
 * Satuan hasil pencarian adalah PENAWARAN (1 barang x 1 distributor), bukan
 * barang dan bukan distributor. Itu sejajar dengan aturan 1 kontrak = 1 barang:
 * apa pun yang diketuk pemilik usaha di sini, langkah berikutnya selalu jelas
 * milik siapa dan harganya berapa.
 *
 * Distributor tanpa ulasan tidak pernah ditulis "0,0 bintang". Nol bintang
 * berarti "dinilai jelek", padahal kenyataannya "belum pernah dinilai". Mereka
 * dipisah ke bagiannya sendiri supaya tetap punya kesempatan dilihat tanpa
 * harus berbohong soal reputasi.
 */

type TabBelanja = 'barang' | 'distributor'

/** Satu saringan yang sedang berlaku; `kunci` sama dengan nama parameter URL-nya. */
type Saringan = { kunci: 'kota' | 'stok' | 'kontrak'; label: string }

/* Nilai bintang selalu satu desimal. `angka(4, 1)` menghasilkan "4", dan "4"
   berdampingan dengan "4,8" terbaca seperti dua skala yang berbeda. */
function nilaiBintang(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function rentangDurasi(penawaranId: string, paketTersedia: PaketKontrak[]): string | null {
  const paket = paketUntukPenawaran(penawaranId, paketTersedia)
  if (paket.length === 0) return null
  const durasi = paket.map((p) => p.durasiBulan)
  const min = Math.min(...durasi)
  const maks = Math.max(...durasi)
  return min === maks ? `${min} bulan` : `${min}-${maks} bulan`
}

function labelKemasan(p: Penawaran, b: Barang | undefined): string {
  if (p.kemasanJual && b) return isiKemasan(b, p.kemasanJual.nama, p.kemasanJual.isi) ?? `dijual per ${p.kemasanJual.nama}`
  if (p.kemasanJual && p.satuanIsi) {
    return kalimatIsiKemasan(p.kemasanJual.nama, p.kemasanJual.isi, p.satuanIsi) ?? `dijual per ${p.kemasanJual.nama}`
  }
  if (p.kemasanJual) return `1 ${p.kemasanJual.nama} = ${angka(p.kemasanJual.isi)} satuan pakai`
  return `dijual per ${p.satuan}`
}

function cocokKataKunci(p: Penawaran, b: Barang | undefined, d: Distributor | undefined, q: string): boolean {
  if (!q) return true
  const k = q.trim().toLowerCase()
  return (
    p.nama.toLowerCase().includes(k) ||
    p.kategori.toLowerCase().includes(k) ||
    (d?.nama.toLowerCase().includes(k) ?? false) ||
    (d?.kota.toLowerCase().includes(k) ?? false) ||
    (b?.namaLain.some((n) => n.toLowerCase().includes(k)) ?? false)
  )
}

/* ================================================================== */
/* Kartu penawaran: tepat lima baris                                  */
/* ================================================================== */

function KartuPenawaran({
  penawaran,
  distributor,
  barang,
  mitra,
}: {
  penawaran: Penawaran
  distributor: Distributor
  barang: Barang | undefined
  mitra: boolean
}) {
  const paketKontrak = useAplikasi((s) => s.paketKontrak)
  const durasi = rentangDurasi(penawaran.id, paketKontrak)
  /* Promo dibaca di sini, bukan dikirim lewat prop: halaman induk tidak perlu
     tahu soal promo untuk bisa menampilkan kartunya. */
  const { promoUntukPenawaran, rincianHarga } = usePenentuHarga()
  const promo = promoUntukPenawaran(penawaran.id)

  const lencana = distributor.baru ? (
    <Lencana nada="netral">
      Distributor Baru &middot; belum ada ulasan &middot; bergabung {distributor.sejak}
    </Lencana>
  ) : mitra ? (
    <Lencana nada="merek" ikon={<IkonKontrak size={13} />}>
      Mitra kamu
    </Lencana>
  ) : durasi ? (
    <Lencana nada="info" ikon={<IkonKontrak size={13} />}>
      Ada kontrak {durasi}
    </Lencana>
  ) : (
    <Lencana nada="netral">Hanya beli sekali</Lencana>
  )

  return (
    <div className="relative flex gap-3 bg-surface border border-line rounded-lg p-4 min-h-[88px] shadow-e1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2">
      {/* Gambar produk (ilustrasi dari tools/buat_gambar.py); huruf awal kalau
          produknya tidak punya gambar. Teks kartu harus tetap terbaca penuh
          tanpa gambar apa pun. */}
      <Avatar nama={penawaran.nama} warna={distributor.warna} ukuran={56} />

      <div className="min-w-0 grow">
        {/* 1. Nama barang + kemasan */}
        <h3 className="text-[1rem] font-semibold text-ink leading-snug">
          <Link to={`/penawaran/${penawaran.id}`} className="after:absolute after:inset-0 hover:text-brand">
            {penawaran.nama}
          </Link>
        </h3>
        <p className="text-[0.8125rem] text-ink-3 leading-snug">{labelKemasan(penawaran, barang)}</p>

        {/* 2. Harga beli sekali. Lewat rincianHarga supaya potongan promo yang
            masuk ke keranjang juga yang tampil di sini — bukan rumus kedua. */}
        <p className="mt-1.5 text-[1rem]">
          <HargaBeli rincian={rincianHarga(penawaran.id, null)} satuan={penawaran.satuan} />
        </p>

        {/* 3. Nama distributor + kota, selalu bisa diketuk sendiri */}
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          <Link
            to={`/distributor/${distributor.id}`}
            className="relative z-10 font-semibold hover:text-brand hover:underline"
          >
            {distributor.nama}
          </Link>
          <span className="text-ink-3"> &middot; {distributor.kota}</span>
        </p>

        {/* 4. Stok distributor + kapan diperbarui */}
        <p className="mt-0.5 text-[0.8125rem] text-ink-3">
          Stok distributor: {angka(penawaran.stokTersedia)} {penawaran.satuan} &middot; diperbarui{' '}
          {waktuLalu(penawaran.stokDiperbaruiPada)}
        </p>

        {/* 5. Lencana konteks. Aturannya tetap satu lencana hubungan; promo
            adalah satu-satunya yang boleh menemaninya karena ia menerangkan hal
            lain: yang pertama soal hubungan kamu dengan distributornya, yang
            kedua soal kabar yang sedang berjalan di barangnya.

            `tanpaTautan` wajib: seluruh kartu ini sudah jadi satu target lewat
            `after:absolute after:inset-0` pada judulnya, jadi tautan kedua di
            atas permukaan yang sama cuma jadi rebutan sasaran ketuk.

            `flex-wrap` + `min-w-0`: dua lencana berdampingan harus turun baris
            di layar 360px, bukan melebarkan kartunya. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 min-w-0">
          {lencana}
          {promo && <LencanaPromo promo={promo} tanpaTautan />}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Kartu distributor (segmen kedua)                                   */
/* ================================================================== */

function KartuDistributor({ distributor, jumlahPenawaran }: { distributor: Distributor; jumlahPenawaran: number }) {
  return (
    <Link
      to={`/distributor/${distributor.id}`}
      className="flex items-start gap-3 bg-surface border border-line rounded-lg p-4 min-h-[88px] shadow-e1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2"
    >
      <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={56} />
      <div className="min-w-0 grow">
        <p className="text-[1rem] font-semibold text-ink leading-snug">{distributor.nama}</p>
        <p className="text-[0.8125rem] text-ink-3">{distributor.kota}</p>
        <p className="mt-1.5 text-[0.8125rem] text-ink-2 line-clamp-2 leading-relaxed">{distributor.deskripsi}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {distributor.baru || distributor.rating == null ? (
            <Lencana nada="netral">
              Distributor Baru &middot; belum ada ulasan &middot; bergabung {distributor.sejak}
            </Lencana>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
              <IkonBintangIsi size={14} className="text-menipis" />
              {nilaiBintang(distributor.rating)}
              <HanyaPembacaLayar> dari 5 bintang</HanyaPembacaLayar>
              <span className="font-normal text-ink-3">
                &middot; {distributor.jumlahUlasan} ulasan dari {distributor.jumlahUmkmPengulas} UMKM
              </span>
            </span>
          )}
          <span className="text-[0.8125rem] text-ink-3">{jumlahPenawaran} barang dijual</span>
        </div>
      </div>
      <IkonPanahKanan size={18} className="shrink-0 text-ink-3 mt-1" />
    </Link>
  )
}

/* ================================================================== */
/* Kartu rekomendasi distributor                                      */
/* ================================================================== */

const LABEL_ASPEK: Record<AspekUlasan, string> = {
  ketepatanWaktu: 'ketepatan waktu',
  jumlahSesuai: 'kesesuaian jumlah',
  kondisiBarang: 'kondisi barang',
}

/** "A", "A dan B", atau "A, B, dan 3 lainnya". */
function daftarNama(nama: string[]): string {
  if (nama.length <= 2) return nama.join(' dan ')
  return `${nama.slice(0, 2).join(', ')}, dan ${nama.length - 2} lainnya`
}

function KartuRekomendasi({
  rekomendasi,
  urutan,
  mitra,
  mesin2,
}: {
  rekomendasi: DistributorDirekomendasikan
  urutan: number
  mitra: boolean
  /** Ringkasan saran Mesin 2 untuk distributor ini; kosong di data contoh atau bila belum dinilai. */
  mesin2?: RingkasanSaranServer
}) {
  const d = rekomendasi.distributor
  const belumDiulas = d.baru || d.rating == null
  const terkuat = (Object.keys(d.subRating) as AspekUlasan[]).reduce((a, b) =>
    d.subRating[b] > d.subRating[a] ? b : a,
  )
  /* Satu alasan per kartu, yang paling membedakan distributor ini dari yang
     lain. Daftar alasan yang panjang cuma memindahkan kerja memilih ke
     pemilik usaha lagi. */
  const alasan = mesin2
    ? mesin2.barangTeratas.length > 0
      ? `Pilihan pertama Mesin 2 untuk ${daftarNama(mesin2.barangTeratas)}`
      : `Dinilai Mesin 2 untuk ${mesin2.jumlahBarang} barang yang perlu kamu beli`
    : rekomendasi.termurah.length > 0
      ? `Harga termurah: ${rekomendasi.termurah.join(', ')}`
      : belumDiulas
        ? 'Dinilai setara rata-rata distributor lain sampai ada ulasan'
        : `Terbaik di ${LABEL_ASPEK[terkuat]}: ${nilaiBintang(d.subRating[terkuat])}\u00a0dari\u00a05`

  return (
    <Link
      to={`/distributor/${d.id}`}
      className="flex h-full items-start gap-3 bg-surface border border-line rounded-lg p-4 shadow-e1 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-e2"
    >
      {/* Nomor urut cukup untuk mata; pembaca layar sudah mendengarnya dari <ol>. */}
      <span
        aria-hidden="true"
        className="shrink-0 size-7 mt-0.5 rounded-full bg-brand text-ink-inverse grid place-items-center text-[0.8125rem] font-extrabold tabular"
      >
        {urutan}
      </span>
      <div className="min-w-0 grow">
        <p className="text-[1rem] font-semibold text-ink leading-snug">{d.nama}</p>
        <p className="text-[0.8125rem] text-ink-3">
          {d.kota} &middot; {rekomendasi.kategoriCocok.join(', ')}
        </p>
        <div className="mt-1.5">
          {belumDiulas ? (
            <Lencana nada="netral">Distributor Baru &middot; belum ada ulasan</Lencana>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
              <IkonBintangIsi size={14} className="text-menipis" />
              {nilaiBintang(d.rating ?? 0)}
              <HanyaPembacaLayar> dari 5 bintang</HanyaPembacaLayar>
              <span className="font-normal text-ink-3">&middot; {d.jumlahUlasan} ulasan</span>
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[0.8125rem] text-ink-2 leading-snug">{alasan}</p>
        {mesin2 && (
          <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
            Peluang pesanan lancar {persen(mesin2.peluangSuksesRata * 100)}
          </p>
        )}
        {mitra && (
          <div className="mt-2">
            <Lencana nada="merek" ikon={<IkonKontrak size={13} />}>
              Mitra kamu
            </Lencana>
          </div>
        )}
      </div>
      <IkonPanahKanan size={18} className="shrink-0 text-ink-3 mt-1" />
    </Link>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

export default function Belanja() {
  const [params, setParams] = useSearchParams()
  const barangGudang = useAplikasi((s) => s.barang)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)
  const profil = useAplikasi((s) => s.profil)
  const paketKontrak = useAplikasi((s) => s.paketKontrak)
  const promoStore = useAplikasi((s) => s.promo)
  /* Katalog dan profil distributor dibaca dari store: distributor bisa
     menambah, mengubah, dan menyembunyikan barangnya saat aplikasi berjalan. */
  const katalog = useAplikasi((s) => s.katalog)
  const semuaDistributor = useAplikasi((s) => s.distributor)
  const katalogAktif = useMemo(() => katalog.filter((p) => p.aktif !== false), [katalog])
  const sesiServer = useAplikasi((s) => s.sesiServer)

  /* Saran Mesin 2 dirangkum per distributor (data server saja). Disimpan
     bersama id usahanya supaya sesudah pindah akun ringkasan akun lama tidak
     sempat dipakai. */
  const [ringkasanMesin2, setRingkasanMesin2] = useState<{ usahaId: number; isi: RingkasanSaranServer[] } | null>(
    null,
  )
  useEffect(() => {
    if (!sesiServer) return
    let batal = false
    ambilRingkasanSaran(sesiServer)
      .then((isi) => {
        if (!batal) setRingkasanMesin2({ usahaId: sesiServer.usahaId, isi })
      })
      .catch(() => {
        /* Tanpa ringkasan Mesin 2, urutan dari ulasan dan harga tetap dipakai. */
      })
    return () => {
      batal = true
    }
  }, [sesiServer])
  const saranMesin2 = useMemo(() => {
    const isi = sesiServer && ringkasanMesin2?.usahaId === sesiServer.usahaId ? ringkasanMesin2.isi : []
    return new Map(isi.map((r) => [r.distributorId, r]))
  }, [sesiServer, ringkasanMesin2])

  const cari = params.get('cari') ?? ''
  const tab: TabBelanja = params.get('tab') === 'distributor' ? 'distributor' : 'barang'
  const kotaSaring = params.get('kota') ?? ''
  const hanyaAdaStok = params.get('stok') === 'ada'
  const hanyaAdaKontrak = params.get('kontrak') === 'ada'

  const [lembarSaring, setLembarSaring] = useState(false)

  function aturParam(ubahan: Record<string, string | null>) {
    const baru = new URLSearchParams(params)
    for (const [kunci, nilai] of Object.entries(ubahan)) {
      if (nilai === null || nilai === '') baru.delete(kunci)
      else baru.set(kunci, nilai)
    }
    setParams(baru, { replace: true })
  }

  /* Distributor yang sudah pernah mengikat kita lewat kontrak atau pesanan
     selesai disebut "mitra". Urutannya dinaikkan karena hubungan yang sudah
     berjalan lebih berharga daripada selisih harga beberapa ratus rupiah. */
  const idMitra = useMemo(() => {
    const kumpulan = new Set<string>()
    for (const k of kontrak) if (k.status === 'aktif' || k.status === 'akan-berakhir') kumpulan.add(k.distributorId)
    for (const p of pesanan) if (p.status === 'selesai' || p.status === 'selesai-catatan') kumpulan.add(p.distributorId)
    return kumpulan
  }, [kontrak, pesanan])

  const daftarKota = useMemo(
    () => Array.from(new Set(semuaDistributor.map((d) => d.kota))).sort(),
    [semuaDistributor],
  )

  const hasil = useMemo(() => {
    const semua = katalogAktif
      .map((p) => ({
        penawaran: p,
        distributor: distributorById(p.distributorId),
        barang: barangGudang.find((b) => b.id === p.barangIdTerkait),
      }))
      .filter((x): x is { penawaran: Penawaran; distributor: Distributor; barang: Barang | undefined } =>
        Boolean(x.distributor),
      )
      .filter((x) => cocokKataKunci(x.penawaran, x.barang, x.distributor, cari))
      .filter((x) => (kotaSaring ? x.distributor.kota === kotaSaring : true))
      .filter((x) => (hanyaAdaStok ? x.penawaran.stokTersedia > 0 : true))
      .filter((x) => (hanyaAdaKontrak ? paketUntukPenawaran(x.penawaran.id, paketKontrak).length > 0 : true))

    const lama = semua
      .filter((x) => !x.distributor.baru)
      .sort((a, b) => {
        const mitraA = idMitra.has(a.distributor.id) ? 1 : 0
        const mitraB = idMitra.has(b.distributor.id) ? 1 : 0
        if (mitraA !== mitraB) return mitraB - mitraA
        return (b.distributor.rating ?? 0) - (a.distributor.rating ?? 0)
      })

    // Distributor baru TIDAK ikut diurutkan berdasarkan rating: mereka tidak
    // punya rating, dan memaksakan nol akan menenggelamkannya selamanya.
    const baru = semua.filter((x) => x.distributor.baru)
    return { lama, baru, jumlah: semua.length }
  }, [barangGudang, cari, kotaSaring, hanyaAdaStok, hanyaAdaKontrak, idMitra, paketKontrak, katalogAktif])

  const hasilDistributor = useMemo(() => {
    const k = cari.trim().toLowerCase()
    const semua = semuaDistributor
      .filter((d) => (kotaSaring ? d.kota === kotaSaring : true))
      .filter(
        (d) =>
          !k ||
          d.nama.toLowerCase().includes(k) ||
          d.kota.toLowerCase().includes(k) ||
          d.kategori.some((x) => x.toLowerCase().includes(k)),
      )
    return {
      lama: semua.filter((d) => !d.baru).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
      baru: semua.filter((d) => d.baru),
    }
  }, [cari, kotaSaring, semuaDistributor])

  /* Rekomendasi dihitung dari profil, bukan dari saringan di layar: ia
     menjawab "distributor mana yang cocok untuk usahaku", jadi hanya tampil
     selama daftar belum dipersempit kata kunci atau kota. */
  const rekomendasi = useMemo(
    () =>
      rekomendasiDistributor({
        jenisUsaha: profil.jenisUsaha,
        kota: profil.kota,
        barang: barangGudang,
        promo: promoStore,
        distributor: semuaDistributor,
        penawaran: katalogAktif,
      }),
    [profil.jenisUsaha, profil.kota, barangGudang, promoStore, semuaDistributor, katalogAktif],
  )
  const tampilkanRekomendasi = tab === 'distributor' && !cari && !kotaSaring
  /* Data server: distributor yang sudah dinilai Mesin 2 naik lebih dulu,
     diurutkan dari rata-rata skornya atas barang yang perlu dibeli. Yang belum
     dinilai menyusul dengan urutan ulasan dan harga (urutan sort stabil). */
  const pakaiMesin2 = saranMesin2.size > 0
  const urutanRekomendasi = useMemo(() => {
    if (!pakaiMesin2) return rekomendasi.direkomendasikan
    const skor = (id: string) => saranMesin2.get(id)?.skorRata ?? -1
    return [...rekomendasi.direkomendasikan].sort((a, b) => skor(b.distributor.id) - skor(a.distributor.id))
  }, [rekomendasi, saranMesin2, pakaiMesin2])
  const rekomendasiTeratas = tampilkanRekomendasi ? urutanRekomendasi.slice(0, 3) : []
  const dihitungMesin2 = useMemo(() => {
    const waktu = [...saranMesin2.values()].map((r) => new Date(r.dijalankanPada).getTime())
    return waktu.length > 0 ? new Date(Math.max(...waktu)) : null
  }, [saranMesin2])
  const adaBelumDinilai = rekomendasiTeratas.some((r) => !saranMesin2.has(r.distributor.id))
  const dasarUrutan =
    pakaiMesin2 && dihitungMesin2
      ? `Diurutkan dari skor Mesin 2 untuk barang yang perlu kamu beli, dihitung ${waktuLalu(dihitungMesin2)}.` +
        (adaBelumDinilai ? ' Yang belum dinilai Mesin 2 menyusul, diurutkan dari penilaian UMKM lain dan harga.' : '')
      : 'Diurutkan dari penilaian UMKM lain dan harga.'
  /* Seperti "Perlu kamu isi ulang": distributor yang sudah naik ke atas tidak
     diulang di daftar di bawahnya. */
  const idTeratas = new Set(rekomendasiTeratas.map((r) => r.distributor.id))
  const distributorLama = hasilDistributor.lama.filter((d) => !idTeratas.has(d.id))
  const distributorBaru = hasilDistributor.baru.filter((d) => !idTeratas.has(d.id))
  const wilayahProfil = profil.kota.split(',')[0].trim()
  const jenisProfil = LABEL_JENIS_USAHA[profil.jenisUsaha].judul.toLowerCase()

  /* Tanpa kata kunci, layar tidak boleh kosong. Yang paling berguna dibuka
     duluan: barang yang stoknya sedang tipis di gudang sendiri. */
  const perluDiisi = useMemo(() => {
    if (cari) return []
    const tipis = barangGudang.filter((b) => !b.dicatatManual && b.batasAman > 0 && b.stok < b.batasAman)
    return hasil.lama.filter((x) => x.barang && tipis.some((t) => t.id === x.barang?.id)).slice(0, 6)
  }, [cari, barangGudang, hasil.lama])

  /* Penawaran yang sudah naik ke bagian "Perlu kamu isi ulang" tidak diulang di
     bagian bawah. Kartu yang sama muncul dua kali membuat orang mengira ada dua
     penawaran berbeda dari distributor yang sama. */
  const sisaHasil = useMemo(() => {
    if (perluDiisi.length === 0) return hasil.lama
    const sudah = new Set(perluDiisi.map((x) => x.penawaran.id))
    return hasil.lama.filter((x) => !sudah.has(x.penawaran.id))
  }, [hasil.lama, perluDiisi])

  /* Saringan yang sedang berlaku. Stok dan kontrak hanya berarti di tab
     barang, jadi di tab distributor yang dihitung cuma kota. */
  const saringAktif: Saringan[] = []
  if (kotaSaring) saringAktif.push({ kunci: 'kota', label: kotaSaring })
  if (tab === 'barang' && hanyaAdaStok) saringAktif.push({ kunci: 'stok', label: 'Stok tersedia' })
  if (tab === 'barang' && hanyaAdaKontrak) saringAktif.push({ kunci: 'kontrak', label: 'Tersedia kontrak' })
  const adaSaringAktif = saringAktif.length > 0

  const panelSaring = (
    <div className="space-y-4">
      <div>
        <p className="text-[0.8125rem] font-bold text-ink mb-2">Kota</p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => aturParam({ kota: null })}
            aria-pressed={!kotaSaring}
            className={cx(
              'text-left h-11 px-3 rounded-md text-[0.875rem] font-semibold transition-colors',
              !kotaSaring ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken',
            )}
          >
            Semua kota
          </button>
          {daftarKota.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => aturParam({ kota: k })}
              aria-pressed={kotaSaring === k}
              className={cx(
                'text-left h-11 px-3 rounded-md text-[0.875rem] font-semibold transition-colors',
                kotaSaring === k ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken',
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {tab === 'barang' && (
        <div className="border-t border-line pt-4">
          <p className="text-[0.8125rem] font-bold text-ink mb-2">Saring hasil</p>
          <div className="flex flex-col gap-2">
            <Chip aktif={hanyaAdaStok} onClick={() => aturParam({ stok: hanyaAdaStok ? null : 'ada' })}>
              Stok tersedia
            </Chip>
            <Chip aktif={hanyaAdaKontrak} onClick={() => aturParam({ kontrak: hanyaAdaKontrak ? null : 'ada' })}>
              Tersedia kontrak
            </Chip>
          </div>
        </div>
      )}

      {adaSaringAktif && (
        <Tombol
          ragam="sunyi"
          ukuran="kecil"
          ikonKiri={<IkonSilang size={14} />}
          onClick={() => aturParam({ kota: null, stok: null, kontrak: null })}
        >
          Hapus semua
        </Tombol>
      )}
    </div>
  )

  return (
    <div className="pb-6">
      <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">{JUDUL.belanja}</h1>
      {/* Halaman ini berjudul sama dengan salah satu sub-tabnya, jadi kalimat
          pembuka harus langsung menerangkan apa yang bisa dikerjakan di sini. */}
      <p className="mt-0.5 text-[0.8125rem] text-ink-3">
        Tempat kamu mencari barang dan memilih distributor untuk dipesan. Harga dan stok di bawah berasal
        dari distributor, bukan dari gudang kamu.
      </p>

      {/* Kolom cari dan tombol Filter sebaris: saringan dipindah ke atas,
          dekat tempat orang mulai mencari, bukan di rail samping atau baris
          chip yang tenggelam di bawah tab. */}
      <form
        className="mt-3 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
        }}
        role="search"
      >
        <Kolom
          type="search"
          aria-label={tab === 'barang' ? 'Cari barang atau kategori' : 'Cari distributor, kota, atau kategori'}
          placeholder={tab === 'barang' ? 'Cari barang atau kategori, misal: gula' : 'Cari distributor atau kota'}
          value={cari}
          onChange={(e) => aturParam({ cari: e.target.value })}
          awalan={<IkonCari size={18} />}
          className="min-w-0 grow"
        />
        <button
          type="button"
          onClick={() => setLembarSaring(true)}
          aria-haspopup="dialog"
          aria-label={adaSaringAktif ? `Filter, ${saringAktif.length} sedang dipakai` : 'Filter'}
          className={cx(
            'relative shrink-0 inline-flex items-center gap-2 h-12 px-4 rounded-md border text-[0.9375rem] font-semibold transition-colors',
            adaSaringAktif
              ? 'border-brand bg-brand-soft text-brand-soft-ink'
              : 'border-line-strong bg-surface text-ink-2 hover:border-brand hover:text-brand',
          )}
        >
          <IkonSaring size={18} />
          <span className="hidden sm:inline">Filter</span>
          {adaSaringAktif && (
            <span
              aria-hidden="true"
              className="min-w-5 h-5 px-1 rounded-full bg-brand text-ink-inverse text-[0.6875rem] font-bold grid place-items-center tabular"
            >
              {saringAktif.length}
            </span>
          )}
        </button>
      </form>

      <TabSegmen<TabBelanja>
        className="mt-3"
        aktif={tab}
        ubah={(v) => aturParam({ tab: v === 'barang' ? null : v })}
        /* Label tab sengaja tidak sama dengan judul halaman: dua hal berbeda
           dengan nama yang sama membuat orang mengira sedang di layar lain.
           Nilai query (`barang`/`distributor`) TIDAK ikut berubah — banyak
           tautan di layar lain sudah memakainya. */
        tab={[
          { nilai: 'barang', label: 'Cari Barang' },
          { nilai: 'distributor', label: 'Daftar Distributor' },
        ]}
      />

      {/* Saringan yang sedang berlaku, satu chip per saringan. Mengetuk chip
          melepasnya, jadi tidak perlu membuka pop-up hanya untuk menghapus. */}
      {adaSaringAktif && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {saringAktif.map((s) => (
            <button
              key={s.kunci}
              type="button"
              onClick={() => aturParam({ [s.kunci]: null })}
              aria-label={`Lepas saringan ${s.label}`}
              className="inline-flex items-center gap-1.5 h-11 pl-3.5 pr-3 rounded-full bg-brand-soft text-brand-soft-ink text-[0.8125rem] font-semibold hover:brightness-97"
            >
              {s.label}
              <IkonSilang size={14} className="shrink-0" />
            </button>
          ))}
          {saringAktif.length > 1 && (
            <button
              type="button"
              onClick={() => aturParam({ kota: null, stok: null, kontrak: null })}
              className="inline-flex items-center h-11 px-2 text-[0.8125rem] font-semibold text-brand hover:underline"
            >
              Hapus semua
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        {tab === 'barang' ? (
          <>
            {/* Jumlah hasil hanya ditulis kalau memang ada hasilnya. Saat nol,
                kalimat ini persis mengulang judul keadaan kosong di bawahnya. */}
            {cari && hasil.jumlah > 0 && (
              <p className="text-[0.875rem] text-ink-2 mb-3">
                <strong className="text-ink">{hasil.jumlah} penawaran</strong> cocok dengan &ldquo;{cari}&rdquo;
                {kotaSaring && ` di ${kotaSaring}`}.
              </p>
            )}

            {hasil.jumlah === 0 ? (
              <Kartu>
                <h2 className="sr-only">Hasil pencarian barang</h2>
                <KeadaanKosong
                  ikon={<IkonCari size={26} />}
                  judul={cari ? `Belum ada yang cocok dengan "${cari}"` : 'Belum ada penawaran yang cocok'}
                  pesan={
                    adaSaringAktif
                      ? 'Saringan yang kamu pasang mempersempit hasilnya. Coba lepas salah satu, atau ganti kata kunci dengan nama yang lebih umum.'
                      : 'Coba kata yang lebih umum, misalnya "kopi" saja tanpa merek, atau lihat daftar distributor di kotamu.'
                  }
                  aksi={
                    adaSaringAktif ? (
                      <Tombol onClick={() => aturParam({ kota: null, stok: null, kontrak: null })}>
                        Hapus semua saringan
                      </Tombol>
                    ) : (
                      <Tombol onClick={() => aturParam({ tab: 'distributor' })}>
                        Lihat Daftar Distributor
                      </Tombol>
                    )
                  }
                  aksiKedua={
                    cari ? (
                      <Tombol ragam="garis" onClick={() => aturParam({ cari: null })}>
                        Kosongkan pencarian
                      </Tombol>
                    ) : undefined
                  }
                />
              </Kartu>
            ) : (
              <div className="space-y-6">
                {!cari && perluDiisi.length > 0 && (
                  <section aria-label="Perlu kamu isi ulang">
                    <JudulBagian
                      judul="Perlu kamu isi ulang"
                      keterangan="Barang yang stoknya sudah di bawah batas aman gudangmu"
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                      {perluDiisi.map((x) => (
                        <KartuPenawaran
                          key={x.penawaran.id}
                          penawaran={x.penawaran}
                          distributor={x.distributor}
                          barang={x.barang}
                          mitra={idMitra.has(x.distributor.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {sisaHasil.length > 0 && (
                  <section aria-label="Hasil pencarian">
                    <JudulBagian
                      judul={cari ? 'Hasil pencarian' : 'Semua penawaran di kotamu'}
                      /* Jumlahnya sudah disebut sebaris di atas saat ada kata
                         kunci, jadi di sini cukup penjelasan isinya. */
                      keterangan={
                        cari
                          ? 'Dari distributor yang sudah punya rekam jejak di aplikasi'
                          : `${sisaHasil.length} penawaran dari distributor yang sudah punya rekam jejak`
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                      {sisaHasil.map((x) => (
                        <KartuPenawaran
                          key={x.penawaran.id}
                          penawaran={x.penawaran}
                          distributor={x.distributor}
                          barang={x.barang}
                          mitra={idMitra.has(x.distributor.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {hasil.baru.length > 0 && (
                  <section aria-label="Distributor baru di kotamu">
                    <JudulBagian
                      judul="Distributor Baru di Kotamu"
                      keterangan="Belum punya ulasan, jadi belum bisa diurutkan berdasarkan penilaian. Kami tampilkan apa adanya."
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                      {hasil.baru.map((x) => (
                        <KartuPenawaran
                          key={x.penawaran.id}
                          penawaran={x.penawaran}
                          distributor={x.distributor}
                          barang={x.barang}
                          mitra={false}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {/* Seperti Mesin 1 di Prediksi: nama metode di atas bagian yang
                memakai keluarannya. Hanya bila urutannya memang dari Mesin 2. */}
            {tampilkanRekomendasi && pakaiMesin2 && (
              <KeteranganMetode
                className="max-w-[62ch]"
                mesin="Mesin 2"
                metode={METODE_MESIN2.metode}
                masukan={`${METODE_MESIN2.masukan} Di halaman ini skor tiap barang dirata-rata per distributor.`}
              />
            )}
            {tampilkanRekomendasi && (
              <section aria-labelledby="judul-rekomendasi">
                <JudulBagian
                  id="judul-rekomendasi"
                  judul="Rekomendasi untuk usahamu"
                  keterangan={
                    profil.jenisUsaha === 'lainnya'
                      ? `Mengirim ke ${wilayahProfil}. ${dasarUrutan}`
                      : `Cocok untuk ${jenisProfil} dan mengirim ke ${wilayahProfil}. ${dasarUrutan}`
                  }
                />
                {rekomendasiTeratas.length > 0 ? (
                  <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                    {rekomendasiTeratas.map((r, i) => (
                      <li key={r.distributor.id}>
                        <KartuRekomendasi
                          rekomendasi={r}
                          urutan={i + 1}
                          mitra={idMitra.has(r.distributor.id)}
                          mesin2={saranMesin2.get(r.distributor.id)}
                        />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Kartu padat>
                    <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                      Belum ada distributor yang mengirim ke {wilayahProfil} dan menjual barang untuk {jenisProfil}.
                      Semua distributor tetap bisa kamu lihat di daftar di bawah.
                    </p>
                  </Kartu>
                )}
                <p className="mt-2.5 text-[0.8125rem] text-ink-3">
                  Jenis usaha atau kotamu berubah?{' '}
                  <Link to="/akun/profil" className="font-semibold text-brand hover:underline">
                    Perbarui di Profil Usaha
                  </Link>
                </p>
              </section>
            )}

            {hasilDistributor.lama.length === 0 && hasilDistributor.baru.length === 0 ? (
              <Kartu>
                <h2 className="sr-only">Hasil pencarian distributor</h2>
                <KeadaanKosong
                  ikon={<IkonToko size={26} />}
                  judul="Belum ada distributor yang cocok"
                  pesan={`Belum ada distributor yang namanya atau kategorinya cocok${kotaSaring ? ` di ${kotaSaring}` : ''}. Coba lepas saringan kota atau cari lewat nama barangnya.`}
                  aksi={
                    <Tombol onClick={() => aturParam({ kota: null, cari: null })}>
                      Hapus saringan, tampilkan semua distributor
                    </Tombol>
                  }
                />
              </Kartu>
            ) : (
              <>
                {distributorLama.length > 0 && (
                  <section aria-label="Daftar distributor">
                    <JudulBagian
                      /* Bukan "Distributor" saja: judul halaman sudah memakai
                         kata itu, dan dua judul kembar dalam satu layar
                         membuat orang kehilangan jejak posisinya. */
                      judul="Daftar Distributor"
                      keterangan={
                        idTeratas.size > 0
                          ? `${distributorLama.length} distributor lain yang mengirim ke ${wilayahProfil} dan sekitarnya`
                          : `${distributorLama.length} distributor${kotaSaring ? ` di ${kotaSaring}` : ` yang mengirim ke ${wilayahProfil} dan sekitarnya`}`
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                      {distributorLama.map((d) => (
                        <KartuDistributor
                          key={d.id}
                          distributor={d}
                          jumlahPenawaran={katalogAktif.filter((p) => p.distributorId === d.id).length}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {distributorBaru.length > 0 && (
                  <section aria-label="Distributor baru di kotamu">
                    <JudulBagian
                      judul="Distributor Baru di Kotamu"
                      keterangan="Belum ada ulasan dari UMKM lain. Mulai dari pesanan kecil dulu kalau kamu ingin mencoba."
                    />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
                      {distributorBaru.map((d) => (
                        <KartuDistributor
                          key={d.id}
                          distributor={d}
                          jumlahPenawaran={katalogAktif.filter((p) => p.distributorId === d.id).length}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2.5">
          <TombolTautan ke="/stok?filter=menipis" ragam="garis" ukuran="kecil" ikonKiri={<IkonKotak size={15} />}>
            Lihat stok yang menipis
          </TombolTautan>
          <TombolTautan ke="/keranjang" ragam="sunyi" ukuran="kecil">
            Buka keranjang
          </TombolTautan>
        </div>
      </div>

      {/* Satu pop-up untuk semua saringan: lembar bawah di HP, panel di layar
          lebar. Perubahan langsung berlaku, jadi tombolnya cukup "Selesai". */}
      <Lembar
        terbuka={lembarSaring}
        tutup={() => setLembarSaring(false)}
        judul="Filter"
        keterangan={
          adaSaringAktif
            ? `${saringAktif.length} saringan sedang dipakai.`
            : 'Belum ada saringan yang dipakai. Pilih yang kamu perlukan.'
        }
        lebar="sempit"
        kaki={
          <Tombol penuh onClick={() => setLembarSaring(false)}>
            Selesai
          </Tombol>
        }
      >
        <div className="pb-4">{panelSaring}</div>
      </Lembar>
    </div>
  )
}
