import { useMemo, useState } from 'react'
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
import { BarisChip, Chip, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { HargaBeli, LencanaPromo } from '@/components/domain/KartuPromo'
import {
  IkonBintangIsi,
  IkonCari,
  IkonKontrak,
  IkonKotak,
  IkonLokasi,
  IkonPanahKanan,
  IkonSilang,
  IkonToko,
} from '@/icons'
import { angka, cx, waktuLalu } from '@/lib/format'
import { isiKemasan } from '@/lib/satuan'
import { JUDUL } from '@/lib/label'
import type { Barang, Distributor, Penawaran } from '@/lib/types'
import {
  daftarDistributor,
  daftarPenawaran,
  distributorById,
  paketUntukPenawaran,
  promoUntukPenawaran,
  rincianHarga,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

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

/* Nilai bintang selalu satu desimal. `angka(4, 1)` menghasilkan "4", dan "4"
   berdampingan dengan "4,8" terbaca seperti dua skala yang berbeda. */
function nilaiBintang(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function rentangDurasi(penawaranId: string): string | null {
  const paket = paketUntukPenawaran(penawaranId)
  if (paket.length === 0) return null
  const durasi = paket.map((p) => p.durasiBulan)
  const min = Math.min(...durasi)
  const maks = Math.max(...durasi)
  return min === maks ? `${min} bulan` : `${min}-${maks} bulan`
}

function labelKemasan(p: Penawaran, b: Barang | undefined): string {
  if (p.kemasanJual && b) return isiKemasan(b, p.kemasanJual.nama, p.kemasanJual.isi) ?? `dijual per ${p.kemasanJual.nama}`
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
  const durasi = rentangDurasi(penawaran.id)
  /* Promo dibaca di sini, bukan dikirim lewat prop: halaman induk tidak perlu
     tahu soal promo untuk bisa menampilkan kartunya. */
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
      {/* Tidak ada foto barang di data, jadi huruf awal yang bekerja.
          Teks kartu harus tetap terbaca penuh tanpa gambar apa pun. */}
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
/* Halaman                                                            */
/* ================================================================== */

export default function Belanja() {
  const [params, setParams] = useSearchParams()
  const barangGudang = useAplikasi((s) => s.barang)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)
  const profil = useAplikasi((s) => s.profil)

  const cari = params.get('cari') ?? ''
  const tab: TabBelanja = params.get('tab') === 'distributor' ? 'distributor' : 'barang'
  const kotaSaring = params.get('kota') ?? ''
  const hanyaAdaStok = params.get('stok') === 'ada'
  const hanyaAdaKontrak = params.get('kontrak') === 'ada'

  const [lembarKota, setLembarKota] = useState(false)

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

  const daftarKota = useMemo(() => Array.from(new Set(daftarDistributor.map((d) => d.kota))).sort(), [])

  const hasil = useMemo(() => {
    const semua = daftarPenawaran
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
      .filter((x) => (hanyaAdaKontrak ? paketUntukPenawaran(x.penawaran.id).length > 0 : true))

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
  }, [barangGudang, cari, kotaSaring, hanyaAdaStok, hanyaAdaKontrak, idMitra])

  const hasilDistributor = useMemo(() => {
    const k = cari.trim().toLowerCase()
    const semua = daftarDistributor
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
  }, [cari, kotaSaring])

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

  const adaSaringAktif = Boolean(kotaSaring) || hanyaAdaStok || hanyaAdaKontrak

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
          Hapus semua saringan
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

      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault()
        }}
        role="search"
      >
        <Kolom
          type="search"
          aria-label="Cari barang"
          placeholder="Cari barang, misal: gula pasir"
          value={cari}
          onChange={(e) => aturParam({ cari: e.target.value })}
          awalan={<IkonCari size={18} />}
        />
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

      {/* Di HP penyaring jadi chip geser; di layar lebar ia pindah ke rail kiri */}
      <BarisChip className="mt-3 lg:hidden">
        <Chip aktif={Boolean(kotaSaring)} ikon={<IkonLokasi size={14} />} onClick={() => setLembarKota(true)}>
          {kotaSaring || 'Kota'}
        </Chip>
        {tab === 'barang' && (
          <>
            <Chip aktif={hanyaAdaStok} onClick={() => aturParam({ stok: hanyaAdaStok ? null : 'ada' })}>
              Stok tersedia
            </Chip>
            <Chip aktif={hanyaAdaKontrak} onClick={() => aturParam({ kontrak: hanyaAdaKontrak ? null : 'ada' })}>
              Tersedia kontrak
            </Chip>
          </>
        )}
      </BarisChip>

      <div className="mt-4 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 lg:items-start">
        <aside className="hidden lg:block sticky top-20">
          <Kartu padat>{panelSaring}</Kartu>
        </aside>

        <div className="min-w-0">
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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  {hasilDistributor.lama.length > 0 && (
                    <section aria-label="Daftar distributor">
                      <JudulBagian
                        /* Bukan "Distributor" saja: judul halaman sudah memakai
                           kata itu, dan dua judul kembar dalam satu layar
                           membuat orang kehilangan jejak posisinya. */
                        judul="Daftar Distributor"
                        keterangan={`${hasilDistributor.lama.length} distributor${kotaSaring ? ` di ${kotaSaring}` : ` yang mengirim ke ${profil.kota.split(',')[0]} dan sekitarnya`}`}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {hasilDistributor.lama.map((d) => (
                          <KartuDistributor
                            key={d.id}
                            distributor={d}
                            jumlahPenawaran={daftarPenawaran.filter((p) => p.distributorId === d.id).length}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {hasilDistributor.baru.length > 0 && (
                    <section aria-label="Distributor baru di kotamu">
                      <JudulBagian
                        judul="Distributor Baru di Kotamu"
                        keterangan="Belum ada ulasan dari UMKM lain. Mulai dari pesanan kecil dulu kalau kamu ingin mencoba."
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {hasilDistributor.baru.map((d) => (
                          <KartuDistributor
                            key={d.id}
                            distributor={d}
                            jumlahPenawaran={daftarPenawaran.filter((p) => p.distributorId === d.id).length}
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
      </div>

      <Lembar terbuka={lembarKota} tutup={() => setLembarKota(false)} judul="Pilih kota" lebar="sempit">
        <div className="pb-4 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              aturParam({ kota: null })
              setLembarKota(false)
            }}
            className={cx(
              'text-left h-12 px-3.5 rounded-md text-[0.9375rem] font-semibold transition-colors',
              !kotaSaring ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken',
            )}
          >
            Semua kota
          </button>
          {daftarKota.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                aturParam({ kota: k })
                setLembarKota(false)
              }}
              className={cx(
                'text-left h-12 px-3.5 rounded-md text-[0.9375rem] font-semibold transition-colors',
                kotaSaring === k ? 'bg-brand-soft text-brand-soft-ink' : 'text-ink-2 hover:bg-sunken',
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </Lembar>
    </div>
  )
}
