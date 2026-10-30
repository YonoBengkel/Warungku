import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { KartuPromo } from '@/components/domain/KartuPromo'
import { JudulBagian, Kartu, Tombol, TombolTautan } from '@/components/ui/dasar'
import { AreaTeks, Kolom, KotakCentang, PilihanKartu } from '@/components/ui/formulir'
import { Konfirmasi } from '@/components/ui/lembar'
import { BilahAksi, KepalaHalaman, useKembali } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonBintang } from '@/icons'
import { bacaAngkaIndonesia, tanggalRingkas } from '@/lib/format'
import { LABEL_PROMO } from '@/lib/label'
import { promoMasihBerlaku } from '@/data/dummy'
import type { JenisPromo, Promo, TingkatKeanggotaan } from '@/lib/types'
import { useAplikasi, useDistributorAktif } from '@/store/aplikasi'

/**
 * Halaman satu promo distributor: `/distributor-portal/promo/<id>` untuk
 * mengubah, `/distributor-portal/promo/baru` untuk membuat (revisi V4, Q91).
 *
 * Dulu keduanya jendela pop-up di atas daftar promo. Kini halaman sendiri:
 * pratinjau kartu di Beranda pemilik usaha, formulir yang sama dengan pop-up
 * lama, Simpan di bilah bawah, dan Akhiri Sekarang di dasar halaman.
 *
 * Promo tidak pernah dihapus, hanya diakhiri. Pesanan yang sudah memakai
 * potongannya masih perlu menyebut promo mana asalnya.
 */

const URUTAN_JENIS: JenisPromo[] = ['cuci-gudang', 'produk-baru', 'membership']

const PENJELASAN_JENIS: Record<JenisPromo, string> = {
  'cuci-gudang': 'Stok yang menumpuk dilepas lebih murah sampai gudang lega. Paling pas dengan tanggal berakhir.',
  'produk-baru': 'Kabar barang yang baru masuk gudang. Potongan boleh ada, boleh tidak.',
  membership: 'Harga lebih ringan untuk pelanggan yang berlangganan kiriman rutin.',
}

const MAKS_JUDUL = 60

function tanggalInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Tiga tingkat bawaan untuk promo keanggotaan baru; isinya diubah sendiri oleh distributor. */
const TINGKAT_BAWAAN: TingkatKeanggotaan[] = [
  { nama: 'Perunggu', syarat: '', manfaat: '' },
  { nama: 'Perak', syarat: '', manfaat: '' },
  { nama: 'Emas', syarat: '', manfaat: '' },
]

function duaMingguLagi(): string {
  return tanggalInput(new Date(Date.now() + 14 * 86_400_000))
}

const DAFTAR_PROMO = '/distributor-portal/promo'

/** Kartu promo persis seperti di Beranda pemilik usaha. */
function Pratinjau({ draf, id }: { draf: Promo; id: string }) {
  return (
    <section aria-labelledby={id}>
      <JudulBagian
        id={id}
        judul="Tampil di Beranda pemilik usaha"
        keterangan="Foto dan warnanya mengikuti jenis promo, sama untuk semua toko."
      />
      <div className="max-w-[24rem]">
        <KartuPromo promo={draf} pratinjau />
      </div>
    </section>
  )
}

/* ================================================================== */
/* Formulir                                                           */
/* ================================================================== */

function FormPromo({ promo }: { promo: Promo | null }) {
  const simpanPromo = useAplikasi((s) => s.simpanPromo)
  const akhiriPromo = useAplikasi((s) => s.akhiriPromo)
  const semuaPromo = useAplikasi((s) => s.katalogDistributorServer?.promo ?? s.promo)
  const katalog = useAplikasi((s) => s.katalogDistributorServer?.penawaran ?? s.katalog)
  const distributor = useDistributorAktif()
  const kembali = useKembali()
  const penawaranSaya = katalog.filter((p) => p.distributorId === distributor.id && p.aktif !== false)
  const masihBerlaku = promo ? promoMasihBerlaku(promo) : true

  const [jenis, setJenis] = useState<JenisPromo>(promo?.jenis ?? 'cuci-gudang')
  const [judul, setJudul] = useState(promo?.judul ?? '')
  const [keterangan, setKeterangan] = useState(promo?.keterangan ?? '')
  const [potongan, setPotongan] = useState(promo?.potonganPersen != null ? String(promo.potonganPersen) : '')
  const [barang, setBarang] = useState<string[]>(promo?.penawaranIds ?? [])
  const [tanpaTenggat, setTanpaTenggat] = useState(promo ? promo.berakhir == null : false)
  /* Promo yang sudah berakhir dibuka dengan tanggal baru, supaya "pasang lagi"
     tidak langsung tersimpan sebagai promo yang sudah lewat. */
  const [tanggal, setTanggal] = useState(
    promo?.berakhir && masihBerlaku ? tanggalInput(new Date(promo.berakhir)) : duaMingguLagi(),
  )
  const [tingkat, setTingkat] = useState<TingkatKeanggotaan[]>(
    promo?.tingkat && promo.tingkat.length > 0 ? promo.tingkat : TINGKAT_BAWAAN,
  )
  const [dicoba, setDicoba] = useState(false)
  const [akanDiakhiri, setAkanDiakhiri] = useState(false)

  function ubahTingkat(i: number, ubahan: Partial<TingkatKeanggotaan>) {
    setTingkat((lama) => lama.map((t, j) => (j === i ? { ...t, ...ubahan } : t)))
  }

  const hariIni = tanggalInput(new Date())
  /** Promo lain milik toko ini yang sedang berjalan dan sudah memuat barang yang sama. */
  const promoLain = (penawaranId: string) =>
    semuaPromo.find(
      (x) =>
        x.id !== promo?.id &&
        x.distributorId === distributor.id &&
        promoMasihBerlaku(x) &&
        x.penawaranIds.includes(penawaranId),
    )
  const angkaPotongan = potongan.trim() === '' ? null : bacaAngkaIndonesia(potongan)

  const galat = {
    judul: !judul.trim()
      ? 'Judul promo belum diisi. Tulis satu kalimat pendek tanpa nama tokomu. Contoh: Cuci Gudang Teh Hitam.'
      : judul.trim().length > MAKS_JUDUL
        ? `Judul kepanjangan ${judul.trim().length - MAKS_JUDUL} huruf. Potong supaya muat di kartu. Contoh: Panen Baru Dataran Gayo.`
        : undefined,
    keterangan:
      keterangan.trim().length < 10
        ? keterangan.trim().length === 0
          ? 'Keterangan belum diisi. Ceritakan singkat kenapa ada promo ini. Contoh: Stok panen bulan lalu masih banyak.'
          : 'Keterangan terlalu pendek. Tulis paling sedikit 10 huruf. Contoh: Stok panen bulan lalu masih banyak.'
        : undefined,
    potongan:
      angkaPotongan != null && (!Number.isInteger(angkaPotongan) || angkaPotongan < 1 || angkaPotongan > 90)
        ? 'Potongan harus angka bulat 1 sampai 90 persen, atau dikosongkan kalau promo ini hanya kabar. Contoh: 10.'
        : undefined,
    barang: barang.length === 0 ? 'Pilih minimal satu barang yang ikut promo ini.' : undefined,
    tanggal:
      !tanpaTenggat && (!tanggal || tanggal < hariIni)
        ? `Tanggal berakhir sudah lewat. Pilih hari ini atau sesudahnya. Contoh: ${tanggalRingkas(new Date(Date.now() + 14 * 86_400_000).toISOString())}.`
        : undefined,
  }
  const NAMA_KOLOM: Record<keyof typeof galat, string> = {
    judul: 'Judul',
    keterangan: 'Keterangan',
    potongan: 'Potongan',
    barang: 'Barang yang ikut',
    tanggal: 'Berlaku sampai',
  }
  const kolomBelum = (Object.keys(galat) as (keyof typeof galat)[]).filter((k) => galat[k]).map((k) => NAMA_KOLOM[k])
  const adaGalat = kolomBelum.length > 0

  const draf: Promo = {
    id: promo?.id ?? 'pratinjau',
    jenis,
    distributorId: distributor.id,
    judul: judul.trim() || 'Judul promo kamu',
    keterangan: keterangan.trim(),
    berakhir: tanpaTenggat || !tanggal ? null : new Date(`${tanggal}T23:59:00`).toISOString(),
    penawaranIds: barang,
    potonganPersen: angkaPotongan != null && Number.isFinite(angkaPotongan) && angkaPotongan > 0 ? angkaPotongan : null,
    // Tingkat yang belum diisi keuntungannya tidak ikut disimpan: pemilik usaha
    // tidak perlu membaca tingkat kosong.
    tingkat:
      jenis === 'membership'
        ? tingkat
            .map((t) => ({ nama: t.nama.trim(), syarat: t.syarat.trim(), manfaat: t.manfaat.trim() }))
            .filter((t) => t.nama && t.manfaat)
        : undefined,
  }

  function simpan() {
    setDicoba(true)
    if (adaGalat) return
    simpanPromo({ ...draf, id: promo?.id ?? `pr-${Date.now()}`, judul: judul.trim() })
    kembali(DAFTAR_PROMO)
  }

  return (
    <>
      {promo && !masihBerlaku && (
        <Peringatan nada="netral" judul="Promo ini sudah berakhir" className="mt-4 lg:max-w-[70ch]">
          Kartunya tidak tampil lagi di Beranda. Pasang Lagi menyimpannya dengan tanggal berakhir yang baru.
        </Peringatan>
      )}

      {/* Pratinjau paling atas di HP (Q91). Di desktop ia memimpin kolom kanan,
          jadi kartunya digambar dua kali dan yang tidak terpakai disembunyikan. */}
      <div className="mt-4 lg:hidden">
        <Pratinjau draf={draf} id="judul-pratinjau-hp" />
      </div>

      {/* Dua kolom seimbang mulai 1024px: kiri jenis, isi kartu, dan masa
          berlaku; kanan pratinjau dan barang yang ikut. Dulu satu kolom panjang. */}
      <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start space-y-4 lg:space-y-0 [&>*]:min-w-0">
        <div className="space-y-4">
          <Kartu>
            <fieldset>
              <legend className="text-kartu font-bold text-ink mb-3">Jenis promo</legend>
              <div role="radiogroup" className="space-y-2">
                {URUTAN_JENIS.map((j) => (
                  <PilihanKartu
                    key={j}
                    nilai={j}
                    terpilih={jenis === j}
                    ubah={(v) => setJenis(v as JenisPromo)}
                    judul={LABEL_PROMO[j]}
                    keterangan={PENJELASAN_JENIS[j]}
                  />
                ))}
              </div>
            </fieldset>
          </Kartu>

          <Kartu>
            <h2 className="text-kartu font-bold text-ink mb-3">Isi kartu</h2>
            <div className="space-y-4">
              <Kolom
                label="Judul promo"
                wajib
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                galat={dicoba ? galat.judul : undefined}
                bantuan="Nama tokomu tidak perlu ditulis, kartunya sudah menampilkannya."
              />
              <AreaTeks
                label="Keterangan"
                wajib
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                galat={dicoba ? galat.keterangan : undefined}
                bantuan="Dibaca pemilik usaha di halaman promo, di atas daftar barangnya."
              />
              <Kolom
                label="Potongan harga (persen)"
                inputMode="numeric"
                akhiran="%"
                value={potongan}
                onChange={(e) => setPotongan(e.target.value)}
                galat={dicoba ? galat.potongan : undefined}
                bantuan="Berlaku untuk beli sekali, tidak untuk harga kontrak. Kosongkan kalau promo ini hanya kabar."
              />
            </div>
          </Kartu>

          <Kartu>
            <h2 className="text-kartu font-bold text-ink mb-3">Masa berlaku</h2>
            <Kolom
              label="Berlaku sampai"
              type="date"
              min={hariIni}
              value={tanggal}
              disabled={tanpaTenggat}
              onChange={(e) => setTanggal(e.target.value)}
              galat={dicoba ? galat.tanggal : undefined}
            />
            <div className="mt-1.5">
              <KotakCentang dicentang={tanpaTenggat} ubah={setTanpaTenggat}>
                Tanpa tanggal berakhir
              </KotakCentang>
            </div>
          </Kartu>
        </div>

        <div className="space-y-4">
          <div className="hidden lg:block">
            <Pratinjau draf={draf} id="judul-pratinjau" />
          </div>
          <Kartu>
            <fieldset>
              <legend className="text-kartu font-bold text-ink mb-1">
                Barang yang ikut <span className="text-kritis" aria-hidden="true">*</span>
              </legend>
              <div className="space-y-0.5">
                {penawaranSaya.map((p) => (
                  <KotakCentang
                    key={p.id}
                    dicentang={barang.includes(p.id)}
                    ubah={(v) => setBarang((lama) => (v ? [...lama, p.id] : lama.filter((x) => x !== p.id)))}
                    galat={dicoba && !!galat.barang}
                  >
                    {p.nama}
                    {promoLain(p.id) && (
                      <span className="block text-kecil font-normal text-ink-3">
                        Sudah ikut &ldquo;{promoLain(p.id)!.judul}&rdquo;. Kalau dua-duanya memotong harga, yang dipakai
                        potongan terbesar.
                      </span>
                    )}
                  </KotakCentang>
                ))}
              </div>
              {dicoba && galat.barang && (
                <p className="mt-1.5 text-isi text-kritis font-medium leading-snug">{galat.barang}</p>
              )}
            </fieldset>
          </Kartu>
        </div>
      </div>

      {/* Keanggotaan: keuntungan per tingkat (catatan C3). Potongan di atas
          tetap berlaku untuk semua anggota; tingkat menambah keuntungan lain. */}
      {jenis === 'membership' && (
        <Kartu className="mt-4">
          <fieldset>
            <legend className="text-kartu font-bold text-ink mb-1">Keuntungan per tingkat</legend>
            <p className="text-isi text-ink-3 leading-snug mb-3">
              Boleh dikosongkan. Tingkat tanpa keuntungan tidak ditampilkan ke pemilik usaha.
            </p>
            <div className="grid gap-3 lg:grid-cols-3 [&>*]:min-w-0">
              {tingkat.map((t, i) => (
                <div key={i} className="rounded-md border border-line p-3 space-y-2.5">
                  <Kolom
                    label={`Nama tingkat ${i + 1}`}
                    value={t.nama}
                    onChange={(e) => ubahTingkat(i, { nama: e.target.value })}
                  />
                  <Kolom
                    label="Syarat"
                    value={t.syarat}
                    placeholder="Belanja minimal Rp 1,5 jt per bulan"
                    onChange={(e) => ubahTingkat(i, { syarat: e.target.value })}
                  />
                  <Kolom
                    label="Keuntungan"
                    value={t.manfaat}
                    placeholder="Gratis ongkos kirim"
                    onChange={(e) => ubahTingkat(i, { manfaat: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </Kartu>
      )}

      {/* Akhiri Sekarang di dasar halaman, merah bergaris (Q91): jauh dari
          Simpan, dan tetap meminta konfirmasi. */}
      {promo && masihBerlaku && (
        <section aria-labelledby="judul-akhiri" className="mt-6">
          <h2 id="judul-akhiri" className="text-kartu font-bold text-ink">
            Akhiri promo ini
          </h2>
          <p className="mt-1 text-isi text-ink-2 leading-relaxed max-w-[62ch]">
            Kartunya hilang dari Beranda dan harga kembali normal. Pesanan yang sudah memakai potongannya tetap
            mencatat harga promo.
          </p>
          <Tombol ragam="bahaya-garis" className="mt-3" onClick={() => setAkanDiakhiri(true)}>
            Akhiri Sekarang
          </Tombol>
        </section>
      )}

      <BilahAksi
        ringkasan={
          dicoba && adaGalat ? (
            <p className="text-isi font-semibold text-kritis leading-snug">
              {kolomBelum.length === 1 ? `${kolomBelum[0]} belum beres` : `${kolomBelum.length} kolom belum beres`}:{' '}
              {kolomBelum.join(', ')}. Keterangannya ada tepat di bawah kolomnya.
            </p>
          ) : (
            <p className="hidden lg:block text-isi text-ink-3">Kolom bertanda * wajib diisi.</p>
          )
        }
      >
        <div className="grid grid-cols-[2fr_1fr] gap-2.5">
          <Tombol penuh ukuran="besar" onClick={simpan}>
            {!promo ? 'Pasang Promo' : masihBerlaku ? 'Simpan Promo' : 'Pasang Lagi'}
          </Tombol>
          <Tombol ragam="garis" ukuran="besar" penuh onClick={() => kembali(DAFTAR_PROMO)}>
            Batal
          </Tombol>
        </div>
      </BilahAksi>

      <Konfirmasi
        terbuka={akanDiakhiri}
        tutup={() => setAkanDiakhiri(false)}
        judul="Akhiri promo sekarang?"
        labelSetuju="Akhiri Promo"
        labelBatal="Belum"
        ragamSetuju="bahaya"
        onSetuju={() => {
          if (!promo) return
          akhiriPromo(promo.id)
          kembali(DAFTAR_PROMO)
        }}
        pesan={
          promo &&
          `Kartu "${promo.judul}" hilang dari Beranda dan harga kembali normal; pesanan lama tetap memakai harga promo.`
        }
      />
    </>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

export default function PromoUbah() {
  const { id } = useParams()
  const semuaPromo = useAplikasi((s) => s.katalogDistributorServer?.promo ?? s.promo)
  const distributor = useDistributorAktif()
  const promo = id ? semuaPromo.find((p) => p.id === id && p.distributorId === distributor.id) : undefined

  if (id && !promo) {
    return (
      <div className="pb-6 lg:pb-0">
        <KepalaHalaman judul="Promo" kembaliKe={DAFTAR_PROMO} />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Promo tidak ditemukan
          </h2>
          <KeadaanKosong
            tingkat="h3"
            ikon={<IkonBintang size={26} />}
            judul="Promo ini sudah tidak ada"
            pesan="Tautannya mungkin salah salin. Semua promo tokomu, yang berjalan maupun yang sudah berakhir, ada di halaman Promo."
            aksi={<TombolTautan ke={DAFTAR_PROMO}>Kembali ke Promo</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman
        judul={promo ? 'Ubah Promo' : 'Buat Promo'}
        keterangan={promo ? promo.judul : 'Tampil di Beranda pemilik usaha begitu dipasang'}
        kembaliKe={DAFTAR_PROMO}
      />
      {/* Kunci per promo: formulir dibuat ulang dari data promonya, juga saat
          katalog server baru tiba sesudah halaman dibuka. */}
      <FormPromo key={promo?.id ?? 'baru'} promo={promo ?? null} />
    </div>
  )
}
