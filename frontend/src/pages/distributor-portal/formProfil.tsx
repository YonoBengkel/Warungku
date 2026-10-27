import { lazy, Suspense, useRef, useState } from 'react'
import { Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom, Pilihan } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { BarisChip, Chip } from '@/components/ui/navigasi'
import { angka, bacaAngkaIndonesia } from '@/lib/format'
import { kalimatIsiKemasan } from '@/lib/satuan'
import type { Distributor, InfoUsahaDistributor, Penawaran } from '@/lib/types'
import { koordinatSah, pusatKota, type Koordinat } from '@/lib/lacak'
import { KATEGORI_BARANG, WILAYAH_KIRIM } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Formulir dan potongan bersama halaman akun distributor (revisi V4, Q94).
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
 * Formulirnya dipakai halaman bawahan Profil Toko dan Barang yang Dijual.
 */

export const SUB_RATING: Array<{ kunci: keyof Distributor['subRating']; nama: string }> = [
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
export function kalimatKelipatan(pw: Penawaran): string {
  if (!pw.kemasanJual) return `per 1 ${pw.satuan}`
  if (pw.satuanIsi) return kalimatIsiKemasan(pw.kemasanJual.nama, pw.kemasanJual.isi, pw.satuanIsi) ?? `per 1 ${pw.kemasanJual.nama}`
  return `per 1 ${pw.kemasanJual.nama}`
}

/* ================================================================== */
/* Formulir barang                                                    */
/* ================================================================== */

export function FormBarang({
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
          <p className="text-isi font-semibold text-ink-2 mb-1.5">
            Isi 1 {satuan.trim() || 'satuan jual'}
            <span className="text-ink-3 ml-0.5" aria-hidden="true">
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
            <p className="mt-1.5 text-isi text-ink-3 leading-snug">
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

export function FormLayanan({ distributor, tutup }: { distributor: Distributor; tutup: () => void }) {
  const ubahDistributor = useAplikasi((s) => s.ubahDistributor)
  const [kategori, setKategori] = useState<string[]>(distributor.kategori)
  const [area, setArea] = useState<string[]>(distributor.areaKirim)
  const [dicoba, setDicoba] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)

  const galatKategori = kategori.length === 0 ? 'Pilih minimal satu kategori barang yang kamu jual.' : undefined
  const galatArea = area.length === 0 ? 'Pilih minimal satu wilayah yang kamu kirimi.' : undefined

  const ganti = (daftar: string[], nilai: string) =>
    daftar.includes(nilai) ? daftar.filter((x) => x !== nilai) : [...daftar, nilai]

  async function simpan() {
    setDicoba(true)
    if (galatKategori || galatArea) return
    setMenyimpan(true)
    const tersimpan = await ubahDistributor(distributor.id, { kategori, areaKirim: area })
    setMenyimpan(false)
    // Ditolak atau gagal: lembar tetap terbuka supaya pilihannya tidak hilang.
    if (tersimpan) tutup()
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
          <Tombol penuh memuat={menyimpan} onClick={simpan}>
            Simpan
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-5">
        <div>
          <p className="text-isi font-semibold text-ink-2 mb-2.5">Kategori barang</p>
          <BarisChip className="flex-wrap">
            {KATEGORI_BARANG.map((k) => (
              <Chip key={k} aktif={kategori.includes(k)} onClick={() => setKategori((d) => ganti(d, k))}>
                {k}
              </Chip>
            ))}
          </BarisChip>
          {dicoba && galatKategori && <p className="mt-2 text-isi text-kritis font-medium">{galatKategori}</p>}
        </div>
        <div>
          <p className="text-isi font-semibold text-ink-2 mb-2.5">Area kirim</p>
          <BarisChip className="flex-wrap">
            {WILAYAH_KIRIM.map((w) => (
              <Chip key={w} aktif={area.includes(w)} onClick={() => setArea((d) => ganti(d, w))}>
                {w}
              </Chip>
            ))}
          </BarisChip>
          {dicoba && galatArea && <p className="mt-2 text-isi text-kritis font-medium">{galatArea}</p>}
        </div>
      </div>
    </Lembar>
  )
}

export function FormInfoUsaha({ distributor, tutup }: { distributor: Distributor; tutup: () => void }) {
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
  const [menyimpan, setMenyimpan] = useState(false)

  /* Aturan dan pesannya sama dengan PUT /distributor/{id}/profil. Batas jam
     mengikuti panjang kolomnya; minimum di atas Rp 1 miliar hampir pasti salah ketik. */
  const angkaMinimum = minimum.trim() === '' ? 0 : bacaAngkaIndonesia(minimum)
  const galat = {
    alamat: alamat.trim().length < 8 ? 'Alamat gudang belum lengkap. Tulis nama jalan dan nomornya. Contoh: Jl. Magelang KM 7.' : undefined,
    nomor: !/^08\d{8,11}$/.test(nomor.replace(/\D/g, '')) ? 'Nomor HP harus diawali 08 dan berisi 10-13 angka. Contoh: 081234567890.' : undefined,
    jam:
      jam.trim().length < 5
        ? 'Jam operasional belum diisi. Contoh: Senin sampai Sabtu, 07.00 - 16.00.'
        : jam.trim().length > 120
          ? 'Jam operasional terlalu panjang. Ringkas jadi paling banyak 120 huruf.'
          : undefined,
    minimum:
      !Number.isFinite(angkaMinimum) || angkaMinimum < 0
        ? 'Minimum pesanan harus angka rupiah, atau kosongkan kalau tidak ada minimum. Contoh: 250.000.'
        : Math.round(angkaMinimum) > 1_000_000_000
          ? 'Minimum pesanan terlalu besar. Tulis paling banyak 1.000.000.000.'
          : undefined,
  }

  async function simpan() {
    setDicoba(true)
    if (Object.values(galat).some(Boolean)) return
    setMenyimpan(true)
    const tersimpan = await ubahDistributor(distributor.id, {
      deskripsi: deskripsi.trim(),
      info: {
        alamatGudang: alamat.trim(),
        nomorHp: nomor.replace(/\D/g, ''),
        jamOperasional: jam.trim(),
        minimumPesanan: Math.round(angkaMinimum),
      },
    })
    setMenyimpan(false)
    // Ditolak atau gagal: lembar tetap terbuka supaya isiannya tidak hilang.
    if (tersimpan) tutup()
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
          <Tombol penuh memuat={menyimpan} onClick={simpan}>
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

/* Leaflet hanya diunduh saat lembar lokasi dibuka. */
const PetaPilihTitik = lazy(() =>
  import('@/components/domain/PetaLacak').then((m) => ({ default: m.PetaPilihTitik })),
)

/**
 * Lokasi gudang (revisi 23 Okt 2026): titik yang dilihat pemilik usaha di peta
 * Lacak Pesanan. Boleh kosong; peta lalu memakai titik tengah kota distributor.
 * Titik dipilih dengan mengetuk peta, atau, tanpa tetikus, dengan menggeser
 * peta memakai tombol panah lalu "Pakai titik tengah peta".
 */
export function FormLokasiGudang({ distributor, tutup }: { distributor: Distributor; tutup: () => void }) {
  const simpanLokasiGudang = useAplikasi((s) => s.simpanLokasiGudang)
  const awal: Koordinat | null = koordinatSah(distributor.lat, distributor.lng)
    ? { lat: distributor.lat, lng: distributor.lng as number }
    : null
  const [titik, setTitik] = useState<Koordinat | null>(awal)
  const [menyimpan, setMenyimpan] = useState(false)
  const tengahRef = useRef<(() => Koordinat | null) | null>(null)

  async function simpan(nilai: Koordinat | null) {
    setMenyimpan(true)
    const tersimpan = await simpanLokasiGudang(nilai)
    setMenyimpan(false)
    if (tersimpan) tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul="Lokasi gudang"
      keterangan="Ketuk peta di titik gudangmu. Pemilik usaha yang memesan darimu melihatnya di peta rincian pesanannya."
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol penuh memuat={menyimpan} disabled={!titik} onClick={() => simpan(titik)}>
            Simpan
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-3">
        <Suspense fallback={<div className="h-72 sm:h-80 rounded-lg skeleton" />}>
          <PetaPilihTitik
            nilai={titik}
            ubah={setTitik}
            pusat={pusatKota(distributor.kota)}
            label="Peta untuk memilih titik gudang"
            className="h-72 sm:h-80"
            pakaiTengahRef={tengahRef}
          />
        </Suspense>
        <p className="text-isi text-ink-2">
          {titik ? (
            <>
              Titik terpilih:{' '}
              <span className="tabular font-semibold text-ink">
                lintang {angka(titik.lat, 5)} &middot; bujur {angka(titik.lng, 5)}
              </span>
            </>
          ) : (
            'Belum ada titik. Ketuk peta, atau geser peta lalu pakai titik tengahnya.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Tombol
            ragam="garis"
            ukuran="kecil"
            onClick={() => {
              const tengah = tengahRef.current?.()
              if (tengah) setTitik(tengah)
            }}
          >
            Pakai titik tengah peta
          </Tombol>
          {awal && (
            <Tombol ragam="sunyi" ukuran="kecil" disabled={menyimpan} onClick={() => simpan(null)}>
              Kosongkan titik
            </Tombol>
          )}
        </div>
      </div>
    </Lembar>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */
