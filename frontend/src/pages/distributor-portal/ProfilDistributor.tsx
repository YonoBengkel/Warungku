import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, BarisData, JudulBagian, Kartu, Lencana, Metrik, Pemisah, Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom, Pilihan } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { BarisChip, Chip } from '@/components/ui/navigasi'
import {
  IkonBintang,
  IkonBintangIsi,
  IkonBulan,
  IkonCentangLingkaran,
  IkonKotak,
  IkonMatahari,
  IkonMata,
  IkonMataTutup,
  IkonPena,
  IkonTambah,
  IkonToko,
} from '@/icons'
import { angka, bacaAngkaIndonesia, cx, nomorHp, rupiah, tanggalPendek } from '@/lib/format'
import { kalimatIsiKemasan } from '@/lib/satuan'
import type { Distributor, InfoUsahaDistributor, Penawaran } from '@/lib/types'
import { KATEGORI_BARANG, WILAYAH_KIRIM, umkmById } from '@/data/dummy'
import { useAplikasi, useDistributorAktif, usePesananMasuk } from '@/store/aplikasi'

/**
 * Profil toko distributor (catatan B4, ON-Dist 6).
 *
 * Tiga hal yang sebelumnya hanya bisa dibaca kini bisa diatur sendiri oleh
 * distributor: barang yang dijual (harga, stok, satuan jual, kelipatan),
 * kategori dan area kirim, serta info usaha. Ketiganya langsung dibaca sisi
 * pemilik usaha: katalog, harga di keranjang, dan rekomendasi distributor
 * (yang menyaring menurut kategori dan area kirim).
 *
 * Nama toko, kota, dan lencana verifikasi tidak bisa diubah di sini: ketiganya
 * hasil verifikasi, bukan isian bebas.
 *
 * Sakelar tema ikut di sini karena portal distributor tidak punya halaman
 * pengaturan lain, sedangkan pilihan terang/gelap tetap harus bisa diubah.
 */

const SUB_RATING: Array<{ kunci: keyof Distributor['subRating']; nama: string }> = [
  { kunci: 'ketepatanWaktu', nama: 'Ketepatan waktu' },
  { kunci: 'jumlahSesuai', nama: 'Jumlah sesuai pesanan' },
  { kunci: 'kondisiBarang', nama: 'Kondisi barang' },
]

type PilihanIsi = { nilai: string; dasar: string; kali: number }

/** Pilihan satuan isi untuk barang baru, dengan pengali ke satuan dasarnya. */
const SATUAN_ISI_BEBAS: PilihanIsi[] = [
  { nilai: 'kg', dasar: 'gram', kali: 1000 },
  { nilai: 'gram', dasar: 'gram', kali: 1 },
  { nilai: 'liter', dasar: 'ml', kali: 1000 },
  { nilai: 'ml', dasar: 'ml', kali: 1 },
  { nilai: 'pcs', dasar: 'pcs', kali: 1 },
]

/**
 * Barang yang sudah terkait daftar stok pemilik usaha hanya boleh memakai
 * satuan dasar yang sama (gram boleh ditulis kg, ml boleh ditulis liter).
 * Mengganti satuan dasarnya membuat stok gudang pembeli bertambah dengan
 * angka yang salah setiap barang diterima.
 */
function pilihanIsiUntuk(penawaran: Penawaran | null): PilihanIsi[] {
  const dasar = penawaran?.barangIdTerkait ? penawaran.satuanIsi : undefined
  if (!dasar) return SATUAN_ISI_BEBAS
  const sekeluarga = SATUAN_ISI_BEBAS.filter((s) => s.dasar === dasar)
  return sekeluarga.length > 0 ? sekeluarga : [{ nilai: dasar, dasar, kali: 1 }]
}

/** "1 jerigen = 5 liter", atau "per 1 kg" kalau satuan jualnya sama dengan isinya. */
function kalimatKelipatan(pw: Penawaran): string {
  if (!pw.kemasanJual) return `per 1 ${pw.satuan}`
  if (pw.satuanIsi) return kalimatIsiKemasan(pw.kemasanJual.nama, pw.kemasanJual.isi, pw.satuanIsi) ?? `per 1 ${pw.kemasanJual.nama}`
  return `per 1 ${pw.kemasanJual.nama}`
}

/* ================================================================== */
/* Formulir barang                                                    */
/* ================================================================== */

function FormBarang({
  distributor,
  penawaran,
  tutup,
}: {
  distributor: Distributor
  /** Kosong berarti barang baru. */
  penawaran: Penawaran | null
  tutup: () => void
}) {
  const simpanPenawaran = useAplikasi((s) => s.simpanPenawaran)

  const pilihanIsi = pilihanIsiUntuk(penawaran)

  /* Isi kemasan lama ditulis ulang dengan satuan yang paling wajar, supaya
     formulir ubah tidak membuka angka mentah seperti "5000 ml". */
  const isiAwal = (() => {
    const k = penawaran?.kemasanJual
    const dasar = penawaran?.satuanIsi
    if (!k || !dasar) return { isi: k ? angka(k.isi) : '1', satuan: pilihanIsi[0].nilai }
    const besar = pilihanIsi.find((s) => s.dasar === dasar && s.kali > 1 && k.isi >= s.kali)
    if (besar) return { isi: angka(k.isi / besar.kali, 2), satuan: besar.nilai }
    return { isi: angka(k.isi), satuan: pilihanIsi.find((s) => s.dasar === dasar && s.kali === 1)?.nilai ?? dasar }
  })()

  const [nama, setNama] = useState(penawaran?.nama ?? '')
  const [kategori, setKategori] = useState(penawaran?.kategori ?? distributor.kategori[0] ?? KATEGORI_BARANG[0])
  const [keterangan, setKeterangan] = useState(penawaran?.keterangan ?? '')
  const [satuan, setSatuan] = useState(penawaran?.satuan ?? '')
  const [isi, setIsi] = useState(isiAwal.isi)
  const [satuanIsi, setSatuanIsi] = useState(isiAwal.satuan)
  const [harga, setHarga] = useState(penawaran ? angka(penawaran.hargaSatuan) : '')
  const [stok, setStok] = useState(penawaran ? angka(penawaran.stokTersedia) : '')
  const [dicoba, setDicoba] = useState(false)

  const angkaIsi = bacaAngkaIndonesia(isi)
  const angkaHarga = bacaAngkaIndonesia(harga)
  const angkaStok = bacaAngkaIndonesia(stok)
  const isiTerpilih = pilihanIsi.find((s) => s.nilai === satuanIsi) ?? pilihanIsi[0]

  const galat = {
    nama: nama.trim().length < 3 ? 'Nama barang belum diisi. Tulis nama yang dikenal pembeli. Contoh: Teh Melati Kering.' : undefined,
    satuan: !satuan.trim() ? 'Satuan jual belum diisi. Tulis satuan saat barang dijual. Contoh: kg, dus, jerigen.' : undefined,
    isi:
      !Number.isFinite(angkaIsi) || angkaIsi <= 0
        ? 'Isi satu satuan jual belum diisi. Contoh: 1 dus berisi 24 pcs, tulis 24.'
        : undefined,
    harga:
      !Number.isFinite(angkaHarga) || angkaHarga <= 0
        ? `Harga per ${satuan.trim() || 'satuan jual'} belum diisi. Tulis dalam rupiah. Contoh: 96.000.`
        : undefined,
    stok:
      !Number.isFinite(angkaStok) || angkaStok < 0
        ? 'Stok belum diisi. Tulis jumlah yang siap dikirim, atau 0 kalau sedang kosong.'
        : undefined,
  }

  function simpan() {
    setDicoba(true)
    if (Object.values(galat).some(Boolean)) return
    const satuanBersih = satuan.trim()
    const isiDasar = Math.round(angkaIsi * isiTerpilih.kali * 100) / 100
    simpanPenawaran({
      id: penawaran?.id ?? `pw-${Date.now()}`,
      distributorId: distributor.id,
      nama: nama.trim(),
      kategori,
      satuan: satuanBersih,
      hargaSatuan: Math.round(angkaHarga),
      kemasanJual: { nama: satuanBersih, isi: isiDasar },
      stokTersedia: angkaStok,
      stokDiperbaruiPada: new Date().toISOString(),
      barangIdTerkait: penawaran?.barangIdTerkait ?? null,
      keterangan: keterangan.trim(),
      aktif: penawaran?.aktif ?? true,
      satuanIsi: isiTerpilih.dasar,
    })
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul={penawaran ? `Ubah ${penawaran.nama}` : 'Tambah barang'}
      keterangan="Yang tertulis di sini persis yang dilihat pemilik usaha saat memesan."
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol penuh onClick={simpan}>
            Simpan Barang
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        <Kolom label="Nama barang" wajib value={nama} onChange={(e) => setNama(e.target.value)} galat={dicoba ? galat.nama : undefined} />
        <Pilihan label="Kategori" wajib value={kategori} onChange={(e) => setKategori(e.target.value)}>
          {KATEGORI_BARANG.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Pilihan>
        <AreaTeks
          label="Keterangan singkat"
          rows={2}
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          bantuan="Misalnya ukuran kemasan atau asal barang."
        />
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <Kolom
            label="Satuan jual"
            wajib
            value={satuan}
            onChange={(e) => setSatuan(e.target.value)}
            galat={dicoba ? galat.satuan : undefined}
            placeholder="dus"
          />
          <Kolom
            label={`Harga per ${satuan.trim() || 'satuan'}`}
            wajib
            inputMode="numeric"
            awalan="Rp"
            value={harga}
            onChange={(e) => setHarga(e.target.value)}
            galat={dicoba ? galat.harga : undefined}
          />
        </div>
        {/* Isi satu satuan jual inilah kelipatan pemesanan: pemilik usaha hanya
            bisa memesan per satuan jual, dan stok gudangnya bertambah sebanyak isi ini. */}
        <div>
          <p className="text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
            Isi 1 {satuan.trim() || 'satuan jual'}
            <span className="text-kritis ml-0.5" aria-hidden="true">
              *
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Kolom
              aria-label={`Isi 1 ${satuan.trim() || 'satuan jual'}`}
              inputMode="decimal"
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
              galat={dicoba ? galat.isi : undefined}
            />
            <Pilihan
              aria-label="Satuan isi"
              value={satuanIsi}
              onChange={(e) => setSatuanIsi(e.target.value)}
              disabled={pilihanIsi.length === 1}
            >
              {pilihanIsi.map((s) => (
                <option key={s.nilai} value={s.nilai}>
                  {s.nilai}
                </option>
              ))}
            </Pilihan>
          </div>
          {penawaran?.barangIdTerkait && (
            <p className="mt-1.5 text-[0.8125rem] text-ink-3 leading-snug">
              Satuan isinya mengikuti catatan stok pembeli yang sudah ada, jadi tidak bisa diganti ke satuan lain.
            </p>
          )}
        </div>
        <Kolom
          label="Stok siap kirim"
          wajib
          inputMode="decimal"
          akhiran={satuan.trim() || undefined}
          value={stok}
          onChange={(e) => setStok(e.target.value)}
          galat={dicoba ? galat.stok : undefined}
          bantuan="Waktu pembaruan stok ikut tersimpan dan ditampilkan ke pemilik usaha."
        />
      </div>
    </Lembar>
  )
}

/* ================================================================== */
/* Formulir layanan dan info usaha                                    */
/* ================================================================== */

function FormLayanan({ distributor, tutup }: { distributor: Distributor; tutup: () => void }) {
  const ubahDistributor = useAplikasi((s) => s.ubahDistributor)
  const [kategori, setKategori] = useState<string[]>(distributor.kategori)
  const [area, setArea] = useState<string[]>(distributor.areaKirim)
  const [dicoba, setDicoba] = useState(false)

  const galatKategori = kategori.length === 0 ? 'Pilih minimal satu kategori barang yang kamu jual.' : undefined
  const galatArea = area.length === 0 ? 'Pilih minimal satu wilayah yang kamu kirimi.' : undefined

  const ganti = (daftar: string[], nilai: string) =>
    daftar.includes(nilai) ? daftar.filter((x) => x !== nilai) : [...daftar, nilai]

  function simpan() {
    setDicoba(true)
    if (galatKategori || galatArea) return
    ubahDistributor(distributor.id, { kategori, areaKirim: area })
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul="Ubah yang kamu layani"
      keterangan="Rekomendasi distributor di sisi pemilik usaha menyaring menurut dua hal ini."
      lebar="sempit"
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol penuh onClick={simpan}>
            Simpan
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-5">
        <div>
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2.5">Kategori barang</p>
          <BarisChip className="flex-wrap">
            {KATEGORI_BARANG.map((k) => (
              <Chip key={k} aktif={kategori.includes(k)} onClick={() => setKategori((d) => ganti(d, k))}>
                {k}
              </Chip>
            ))}
          </BarisChip>
          {dicoba && galatKategori && <p className="mt-2 text-[0.8125rem] text-kritis font-medium">{galatKategori}</p>}
        </div>
        <div>
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2.5">Area kirim</p>
          <BarisChip className="flex-wrap">
            {WILAYAH_KIRIM.map((w) => (
              <Chip key={w} aktif={area.includes(w)} onClick={() => setArea((d) => ganti(d, w))}>
                {w}
              </Chip>
            ))}
          </BarisChip>
          {dicoba && galatArea && <p className="mt-2 text-[0.8125rem] text-kritis font-medium">{galatArea}</p>}
        </div>
      </div>
    </Lembar>
  )
}

function FormInfoUsaha({ distributor, tutup }: { distributor: Distributor; tutup: () => void }) {
  const ubahDistributor = useAplikasi((s) => s.ubahDistributor)
  const awal: InfoUsahaDistributor = distributor.info ?? {
    alamatGudang: '',
    nomorHp: '',
    jamOperasional: '',
    minimumPesanan: 0,
  }
  const [deskripsi, setDeskripsi] = useState(distributor.deskripsi)
  const [alamat, setAlamat] = useState(awal.alamatGudang)
  const [nomor, setNomor] = useState(awal.nomorHp)
  const [jam, setJam] = useState(awal.jamOperasional)
  const [minimum, setMinimum] = useState(awal.minimumPesanan > 0 ? angka(awal.minimumPesanan) : '')
  const [dicoba, setDicoba] = useState(false)

  const angkaMinimum = minimum.trim() === '' ? 0 : bacaAngkaIndonesia(minimum)
  const galat = {
    alamat: alamat.trim().length < 8 ? 'Alamat gudang belum lengkap. Tulis nama jalan dan nomornya. Contoh: Jl. Magelang KM 7.' : undefined,
    nomor: !/^08\d{8,11}$/.test(nomor.replace(/\D/g, '')) ? 'Nomor HP harus diawali 08 dan berisi 10-13 angka. Contoh: 081234567890.' : undefined,
    jam: jam.trim().length < 5 ? 'Jam operasional belum diisi. Contoh: Senin sampai Sabtu, 07.00 - 16.00.' : undefined,
    minimum:
      !Number.isFinite(angkaMinimum) || angkaMinimum < 0
        ? 'Minimum pesanan harus angka rupiah, atau kosongkan kalau tidak ada minimum. Contoh: 250.000.'
        : undefined,
  }

  function simpan() {
    setDicoba(true)
    if (Object.values(galat).some(Boolean)) return
    ubahDistributor(distributor.id, {
      deskripsi: deskripsi.trim(),
      info: {
        alamatGudang: alamat.trim(),
        nomorHp: nomor.replace(/\D/g, ''),
        jamOperasional: jam.trim(),
        minimumPesanan: Math.round(angkaMinimum),
      },
    })
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul="Ubah info usaha"
      keterangan="Ditampilkan di halaman tokomu yang dibuka pemilik usaha."
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol penuh onClick={simpan}>
            Simpan
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        <AreaTeks label="Tentang tokomu" rows={3} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
        <AreaTeks
          label="Alamat gudang"
          wajib
          rows={2}
          value={alamat}
          onChange={(e) => setAlamat(e.target.value)}
          galat={dicoba ? galat.alamat : undefined}
        />
        <Kolom
          label="Nomor HP atau WhatsApp"
          wajib
          inputMode="tel"
          value={nomor}
          onChange={(e) => setNomor(e.target.value)}
          galat={dicoba ? galat.nomor : undefined}
        />
        <Kolom
          label="Jam operasional"
          wajib
          value={jam}
          onChange={(e) => setJam(e.target.value)}
          galat={dicoba ? galat.jam : undefined}
        />
        <Kolom
          label="Minimum pesanan"
          inputMode="numeric"
          awalan="Rp"
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
          galat={dicoba ? galat.minimum : undefined}
          bantuan="Pemilik usaha diingatkan di keranjang kalau belanjanya belum mencapai angka ini."
        />
      </div>
    </Lembar>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

export default function ProfilDistributor() {
  const navigate = useNavigate()
  const tema = useAplikasi((s) => s.tema)
  const aturTema = useAplikasi((s) => s.aturTema)
  const aturPeran = useAplikasi((s) => s.aturPeran)
  const katalog = useAplikasi((s) => s.katalog)
  const aturAktifPenawaran = useAplikasi((s) => s.aturAktifPenawaran)
  const distributor = useDistributorAktif()
  const pesananMasuk = usePesananMasuk()

  const [formBarang, setFormBarang] = useState<{ penawaran: Penawaran | null } | null>(null)
  const [formLayanan, setFormLayanan] = useState(false)
  const [formInfo, setFormInfo] = useState(false)

  const penawaranSaya = useMemo(
    () => katalog.filter((p) => p.distributorId === distributor.id),
    [katalog, distributor.id],
  )
  const jumlahDijual = penawaranSaya.filter((p) => p.aktif !== false).length

  /* Lima penilaian terbaru. Lebih dari itu halaman berubah jadi daftar ulasan,
     padahal ini halaman profil. */
  const ulasanTerbaru = useMemo(
    () =>
      pesananMasuk
        .filter((p) => p.ulasan)
        .sort((a, b) => +new Date(b.ulasan!.waktu) - +new Date(a.ulasan!.waktu))
        .slice(0, 5),
    [pesananMasuk],
  )

  function kembaliKePortalUmkm() {
    // Peran diubah lebih dulu, baru layarnya dibuka, supaya kerangka yang
    // muncul sudah benar sejak ketukan pertama.
    aturPeran('umkm')
    navigate('/beranda')
  }

  return (
    <div className="pb-6">
      {/* 1. Identitas */}
      <p className="text-[0.75rem] font-bold uppercase tracking-wide text-ink-3">Profil toko</p>
      <h1 className="mt-0.5 text-[1.25rem] font-extrabold text-ink tracking-tight leading-snug">{distributor.nama}</h1>

      <div className="mt-3 flex items-start gap-3">
        <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={56} />
        <div className="min-w-0">
          <p className="text-[0.875rem] text-ink-2 leading-snug">
            {distributor.kota} &middot; bergabung {distributor.sejak}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {distributor.terverifikasi && (
              <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />}>
                Terverifikasi
              </Lencana>
            )}
            <Lencana nada="netral" ikon={<IkonToko size={13} />}>
              {jumlahDijual} barang dijual
            </Lencana>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[0.875rem] text-ink-2 leading-relaxed max-w-[70ch]">{distributor.deskripsi}</p>

      <div className="mt-5 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-6 lg:space-y-0">
        <div className="lg:col-span-7 space-y-6">
          {/* 2. Barang yang dijual: yang paling sering diubah, jadi paling atas */}
          <section aria-labelledby="judul-penawaran">
            <JudulBagian
              id="judul-penawaran"
              judul="Barang yang kamu jual"
              keterangan="Harga dan stok yang dilihat pemilik usaha saat memesan."
              aksi={
                <Tombol
                  ragam="garis"
                  ukuran="kecil"
                  ikonKiri={<IkonTambah size={15} />}
                  onClick={() => setFormBarang({ penawaran: null })}
                >
                  Tambah
                </Tombol>
              }
            />
            <Kartu>
              <div className="divide-y divide-line">
                {penawaranSaya.map((pw) => {
                  const nonaktif = pw.aktif === false
                  return (
                    <div key={pw.id} className={cx('py-3 first:pt-0 last:pb-0', nonaktif && 'opacity-70')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[0.9375rem] font-bold text-ink leading-snug">
                            {pw.nama}
                            {nonaktif && (
                              <Lencana nada="netral" className="ml-2 align-middle">
                                Disembunyikan
                              </Lencana>
                            )}
                          </p>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
                            {[pw.keterangan, kalimatKelipatan(pw)].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <p className="text-[0.9375rem] font-bold text-ink tabular shrink-0">
                          {rupiah(pw.hargaSatuan)}
                          <span className="block text-right text-[0.75rem] font-normal text-ink-3">per {pw.satuan}</span>
                        </p>
                      </div>
                      <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] text-ink-2 leading-snug">
                        <IkonKotak size={14} className="shrink-0 mt-0.5 text-ink-3" />
                        <span>
                          Stok {angka(pw.stokTersedia)} {pw.satuan} &middot; diperbarui {tanggalPendek(pw.stokDiperbaruiPada)}
                        </span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-1">
                        <Tombol
                          ragam="sunyi"
                          ukuran="kecil"
                          ikonKiri={<IkonPena size={14} />}
                          onClick={() => setFormBarang({ penawaran: pw })}
                          aria-label={`Ubah ${pw.nama}`}
                        >
                          Ubah
                        </Tombol>
                        <Tombol
                          ragam="sunyi"
                          ukuran="kecil"
                          ikonKiri={nonaktif ? <IkonMata size={14} /> : <IkonMataTutup size={14} />}
                          onClick={() => aturAktifPenawaran(pw.id, nonaktif)}
                          aria-label={`${nonaktif ? 'Jual lagi' : 'Sembunyikan'} ${pw.nama}`}
                        >
                          {nonaktif ? 'Jual Lagi' : 'Sembunyikan'}
                        </Tombol>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Kartu>
          </section>

          {/* 3. Angka penilaian */}
          <section aria-labelledby="judul-penilaian">
            <JudulBagian id="judul-penilaian" judul="Penilaian dari pemilik usaha" />
            <Kartu>
              {/* Satuan ditaruh di baris bantuan, bukan di samping angka:
                  di 360px satu kolom cuma kebagian ±90px, dan "412 pesanan"
                  sejajar tidak muat tanpa melebarkan halaman. */}
              <div className="grid grid-cols-3 gap-3">
                <Metrik
                  label="Rata-rata"
                  nilai={distributor.rating == null ? '—' : angka(distributor.rating, 1)}
                  bantuan="dari 5 bintang"
                  nada="merek"
                />
                <Metrik
                  label="Ulasan"
                  nilai={angka(distributor.jumlahUlasan)}
                  bantuan={`dari ${angka(distributor.jumlahUmkmPengulas)} pemilik usaha`}
                />
                <Metrik label="Selesai" nilai={angka(distributor.jumlahPesananSelesai)} bantuan="pesanan" />
              </div>

              {distributor.rating == null ? (
                <p className="mt-4 text-[0.8125rem] text-ink-2 leading-relaxed">
                  Belum ada penilaian yang masuk. Angkanya muncul setelah pesanan pertama selesai dan pemiliknya menulis
                  ulasan.
                </p>
              ) : (
                <>
                  <Pemisah className="my-4" />
                  <div className="space-y-3">
                    {SUB_RATING.map(({ kunci, nama }) => {
                      const nilai = distributor.subRating[kunci]
                      return (
                        <div key={kunci}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[0.8125rem] text-ink-2 font-medium">{nama}</span>
                            {/* Tiga angka yang sejajar vertikal: di sini tabular
                                memang pada tempatnya. */}
                            <span className="text-[0.8125rem] font-bold text-ink tabular">{angka(nilai, 1)} dari 5</span>
                          </div>
                          {/* Bilahnya dekoratif: angkanya sudah tertulis di atas. */}
                          <div className="mt-1.5 h-2 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${(nilai / 5) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Kartu>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* 4. Yang dilayani */}
          <section aria-labelledby="judul-layanan">
            <JudulBagian
              id="judul-layanan"
              judul="Yang kamu layani"
              aksi={
                <Tombol ragam="sunyi" ukuran="kecil" ikonKiri={<IkonPena size={14} />} onClick={() => setFormLayanan(true)}>
                  Ubah
                </Tombol>
              }
            />
            <Kartu>
              <h3 className="text-[0.8125rem] font-bold text-ink-2">Kategori barang</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {distributor.kategori.map((k) => (
                  <Lencana key={k} nada="merek" besar>
                    {k}
                  </Lencana>
                ))}
              </div>

              <h3 className="mt-4 text-[0.8125rem] font-bold text-ink-2">Area kirim</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {distributor.areaKirim.map((a) => (
                  <Lencana key={a} nada="netral" besar>
                    {a}
                  </Lencana>
                ))}
              </div>
            </Kartu>
          </section>

          {/* 5. Info usaha */}
          <section aria-labelledby="judul-info">
            <JudulBagian
              id="judul-info"
              judul="Info usaha"
              aksi={
                <Tombol ragam="sunyi" ukuran="kecil" ikonKiri={<IkonPena size={14} />} onClick={() => setFormInfo(true)}>
                  Ubah
                </Tombol>
              }
            />
            <Kartu>
              {distributor.info ? (
                <dl>
                  <BarisData label="Alamat gudang" nilai={distributor.info.alamatGudang} />
                  <BarisData label="Nomor HP" nilai={nomorHp(distributor.info.nomorHp)} />
                  <BarisData label="Jam operasional" nilai={distributor.info.jamOperasional} />
                  <BarisData
                    label="Minimum pesanan"
                    nilai={distributor.info.minimumPesanan > 0 ? rupiah(distributor.info.minimumPesanan) : 'Tanpa minimum'}
                  />
                </dl>
              ) : (
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  Belum diisi. Lengkapi alamat gudang, kontak, dan jam operasional supaya pemilik usaha tahu kapan
                  pesanannya bisa diproses.
                </p>
              )}
            </Kartu>
          </section>

          {/* 6. Ulasan terbaru */}
          <section aria-labelledby="judul-ulasan">
            <JudulBagian
              id="judul-ulasan"
              judul="Ulasan terbaru"
              keterangan={ulasanTerbaru.length > 0 ? 'Lima penilaian paling akhir.' : undefined}
            />
            <Kartu>
              {ulasanTerbaru.length === 0 ? (
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  Belum ada pemilik usaha yang menulis penilaian. Ulasan bisa ditulis setelah pesanannya ditandai sudah
                  sampai.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {ulasanTerbaru.map((p) => {
                    const u = p.ulasan!
                    return (
                      <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                        {/* Dibiarkan membungkus: nama usaha bisa panjang, dan
                            bintang + angkanya tidak boleh ikut menyempit
                            sampai melebarkan kartu di layar 360px. */}
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <p className="text-[0.875rem] font-bold text-ink leading-snug min-w-0">
                            {umkmById(p.umkmId)?.nama ?? 'Pemilik usaha'}
                          </p>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="flex items-center gap-0.5 text-menipis" aria-hidden="true">
                              {[1, 2, 3, 4, 5].map((i) =>
                                i <= u.rating ? <IkonBintangIsi key={i} size={13} /> : <IkonBintang key={i} size={13} />,
                              )}
                            </span>
                            <span className="text-[0.8125rem] font-bold text-ink">{angka(u.rating, 1)} dari 5</span>
                          </span>
                        </div>
                        {u.isi && (
                          <p className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed max-w-[60ch]">
                            &ldquo;{u.isi}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 text-[0.75rem] text-ink-3">
                          {p.nomor} &middot; {tanggalPendek(u.waktu)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Kartu>
          </section>

          {/* 7. Tampilan */}
          <section aria-labelledby="judul-tampilan">
            <JudulBagian id="judul-tampilan" judul="Tampilan" keterangan="Berlaku di perangkat ini saja." />
            <div className="flex gap-2.5">
              <PilihanTema aktif={tema === 'terang'} onClick={() => aturTema('terang')} ikon={<IkonMatahari size={17} />}>
                Terang
              </PilihanTema>
              <PilihanTema aktif={tema === 'gelap'} onClick={() => aturTema('gelap')} ikon={<IkonBulan size={17} />}>
                Gelap
              </PilihanTema>
            </div>
          </section>

          {/* 8. Jalan pulang ke sisi pemilik usaha */}
          <section aria-labelledby="judul-peran">
            <JudulBagian id="judul-peran" judul="Peran akun" />
            <p className="-mt-1 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[60ch]">
              Berpindah peran adalah alat uji purwarupa. Di aplikasi yang sungguhan, satu akun hanya punya satu peran:
              pemilik usaha atau distributor, tidak keduanya.
            </p>
            <Tombol ragam="garis" className="mt-3" ikonKiri={<IkonToko size={17} />} onClick={kembaliKePortalUmkm}>
              Kembali ke portal UMKM
            </Tombol>
          </section>
        </div>
      </div>

      {formBarang && (
        <FormBarang distributor={distributor} penawaran={formBarang.penawaran} tutup={() => setFormBarang(null)} />
      )}
      {formLayanan && <FormLayanan distributor={distributor} tutup={() => setFormLayanan(false)} />}
      {formInfo && <FormInfoUsaha distributor={distributor} tutup={() => setFormInfo(false)} />}
    </div>
  )
}

/** Dua pilihan tema yang saling meniadakan. Tinggi 44px, ikon + teks. */
function PilihanTema({
  aktif,
  onClick,
  ikon,
  children,
}: {
  aktif: boolean
  onClick: () => void
  ikon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={cx(
        'inline-flex items-center gap-2 h-11 px-4 rounded-md text-[0.875rem] font-semibold border',
        'transition-colors duration-150',
        aktif ? 'bg-ink text-ink-inverse border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}
