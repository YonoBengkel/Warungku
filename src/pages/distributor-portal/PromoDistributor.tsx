import { useMemo, useState } from 'react'
import { KartuPromo } from '@/components/domain/KartuPromo'
import { JudulBagian, Kartu, Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom, KotakCentang, PilihanKartu } from '@/components/ui/formulir'
import { Konfirmasi, Lembar } from '@/components/ui/lembar'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonBintang, IkonPena, IkonTambah } from '@/icons'
import { bacaAngkaIndonesia, tanggalRingkas } from '@/lib/format'
import { LABEL_PROMO } from '@/lib/label'
import { daftarPenawaran, distributorAktif, promoMasihBerlaku } from '@/data/dummy'
import type { JenisPromo, Promo } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Promo di portal distributor (catatan B2, ON-Dist 4).
 *
 * Promo yang dipasang di sini langsung tampil di Beranda pemilik usaha, dan
 * potongannya masuk ke harga BELI SEKALI lewat `rincianHarga`. Harga kontrak
 * tidak ikut terpotong: kontrak adalah kesepakatan yang sudah dikunci.
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

function duaMingguLagi(): string {
  return tanggalInput(new Date(Date.now() + 14 * 86_400_000))
}

/* ================================================================== */
/* Formulir promo                                                     */
/* ================================================================== */

function FormPromo({ promo, tutup }: { promo: Promo | null; tutup: () => void }) {
  const simpanPromo = useAplikasi((s) => s.simpanPromo)
  const semuaPromo = useAplikasi((s) => s.promo)
  const penawaranSaya = daftarPenawaran.filter((p) => p.distributorId === distributorAktif.id)
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
  const [dicoba, setDicoba] = useState(false)

  const hariIni = tanggalInput(new Date())
  /** Promo lain milik toko ini yang sedang berjalan dan sudah memuat barang yang sama. */
  const promoLain = (penawaranId: string) =>
    semuaPromo.find(
      (x) =>
        x.id !== promo?.id &&
        x.distributorId === distributorAktif.id &&
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
        ? 'Keterangan belum diisi. Ceritakan singkat kenapa ada promo ini. Contoh: Stok panen bulan lalu masih banyak.'
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
  const adaGalat = Object.values(galat).some(Boolean)

  const draf: Promo = {
    id: promo?.id ?? 'pratinjau',
    jenis,
    distributorId: distributorAktif.id,
    judul: judul.trim() || 'Judul promo kamu',
    keterangan: keterangan.trim(),
    berakhir: tanpaTenggat || !tanggal ? null : new Date(`${tanggal}T23:59:00`).toISOString(),
    penawaranIds: barang,
    potonganPersen: angkaPotongan != null && Number.isFinite(angkaPotongan) && angkaPotongan > 0 ? angkaPotongan : null,
  }

  function simpan() {
    setDicoba(true)
    if (adaGalat) return
    simpanPromo({ ...draf, id: promo?.id ?? `pr-${Date.now()}`, judul: judul.trim() })
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul={promo ? 'Ubah promo' : 'Buat promo'}
      keterangan="Kartunya tampil di Beranda pemilik usaha dengan rupa sesuai jenis promonya."
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol penuh onClick={simpan}>
            {promo ? 'Simpan Promo' : 'Pasang Promo'}
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-5">
        {/* Pratinjau di atas: yang sedang disusun langsung terlihat persis
            seperti yang akan dilihat pemilik usaha. */}
        <div>
          <p className="text-[0.8125rem] font-semibold text-ink-3 mb-2">Pratinjau di Beranda pemilik usaha</p>
          <div className="max-w-[22rem]">
            <KartuPromo promo={draf} lebar pratinjau />
          </div>
        </div>

        <fieldset>
          <legend className="text-[0.875rem] font-semibold text-ink-2 mb-2">Jenis promo</legend>
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

        <fieldset>
          <legend className="text-[0.875rem] font-semibold text-ink-2 mb-1">
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
                  <span className="block text-[0.75rem] font-normal text-ink-3">
                    Sudah ikut &ldquo;{promoLain(p.id)!.judul}&rdquo;. Kalau dua-duanya memotong harga, yang dipakai
                    potongan terbesar.
                  </span>
                )}
              </KotakCentang>
            ))}
          </div>
          {dicoba && galat.barang && (
            <p className="mt-1.5 text-[0.8125rem] text-kritis font-medium leading-snug">{galat.barang}</p>
          )}
        </fieldset>

        <div>
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
        </div>
      </div>
    </Lembar>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

export default function PromoDistributor() {
  const semuaPromo = useAplikasi((s) => s.promo)
  const akhiriPromo = useAplikasi((s) => s.akhiriPromo)

  const [form, setForm] = useState<{ promo: Promo | null } | null>(null)
  const [akanDiakhiri, setAkanDiakhiri] = useState<Promo | null>(null)

  const { berjalan, berakhir } = useMemo(() => {
    const milikSaya = semuaPromo.filter((p) => p.distributorId === distributorAktif.id)
    return {
      berjalan: milikSaya.filter((p) => promoMasihBerlaku(p)),
      berakhir: milikSaya.filter((p) => !promoMasihBerlaku(p)),
    }
  }, [semuaPromo])

  const namaBarang = (ids: string[]) =>
    ids
      .map((id) => daftarPenawaran.find((p) => p.id === id)?.nama)
      .filter(Boolean)
      .join(', ')

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Promo</h1>
          <p className="mt-1 text-[0.8125rem] text-ink-3 leading-snug max-w-[70ch]">
            Promo yang kamu pasang tampil di Beranda pemilik usaha. Potongannya langsung masuk ke harga beli sekali;
            harga kontrak tidak ikut terpotong.
          </p>
        </div>
        <Tombol ikonKiri={<IkonTambah size={17} />} onClick={() => setForm({ promo: null })}>
          Buat Promo
        </Tombol>
      </div>

      <section aria-labelledby="judul-promo-berjalan" className="mt-5">
        <JudulBagian
          id="judul-promo-berjalan"
          judul="Sedang berjalan"
          keterangan={berjalan.length > 0 ? `${berjalan.length} promo tampil di Beranda pemilik usaha` : undefined}
        />
        {berjalan.length === 0 ? (
          <Kartu>
            <KeadaanKosong
              ikon={<IkonBintang size={26} />}
              judul="Belum ada promo yang berjalan"
              pesan="Pasang promo untuk mengabarkan barang baru atau melepas stok yang menumpuk. Kartunya langsung muncul di Beranda pemilik usaha."
              aksi={<Tombol onClick={() => setForm({ promo: null })}>Buat Promo</Tombol>}
            />
          </Kartu>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            {berjalan.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <KartuPromo promo={p} lebar pratinjau />
                <p className="text-[0.8125rem] text-ink-2 leading-snug">
                  <span className="text-ink-3">Barang ikut:</span> {namaBarang(p.penawaranIds)}
                </p>
                <div className="flex gap-2">
                  <Tombol
                    ragam="garis"
                    ukuran="kecil"
                    ikonKiri={<IkonPena size={15} />}
                    onClick={() => setForm({ promo: p })}
                  >
                    Ubah
                  </Tombol>
                  <Tombol ragam="sunyi" ukuran="kecil" onClick={() => setAkanDiakhiri(p)}>
                    Akhiri Sekarang
                  </Tombol>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {berakhir.length > 0 && (
        <section aria-labelledby="judul-promo-berakhir" className="mt-8">
          <JudulBagian
            id="judul-promo-berakhir"
            judul="Sudah berakhir"
            keterangan="Tidak tampil lagi di Beranda. Pesanan yang sempat memakai potongannya tetap mencatatnya."
          />
          <Kartu>
            <ul className="divide-y divide-line">
              {berakhir.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-ink leading-snug">{p.judul}</p>
                    <p className="text-[0.8125rem] text-ink-3">
                      {LABEL_PROMO[p.jenis]}
                      {p.berakhir && ` · berakhir ${tanggalRingkas(p.berakhir)}`}
                    </p>
                  </div>
                  <Tombol ragam="garis" ukuran="kecil" onClick={() => setForm({ promo: p })}>
                    Pasang Lagi
                  </Tombol>
                </li>
              ))}
            </ul>
          </Kartu>
        </section>
      )}

      {form && <FormPromo promo={form.promo} tutup={() => setForm(null)} />}

      <Konfirmasi
        terbuka={akanDiakhiri !== null}
        tutup={() => setAkanDiakhiri(null)}
        judul="Akhiri promo sekarang?"
        labelSetuju="Akhiri Promo"
        labelBatal="Belum"
        ragamSetuju="bahaya"
        onSetuju={() => akanDiakhiri && akhiriPromo(akanDiakhiri.id)}
        pesan={
          akanDiakhiri &&
          `Kartu "${akanDiakhiri.judul}" hilang dari Beranda pemilik usaha dan harga kembali normal. Pesanan yang sudah dibuat tetap memakai harga promonya.`
        }
      />
    </div>
  )
}
