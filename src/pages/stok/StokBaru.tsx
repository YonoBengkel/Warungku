import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Barang, Kemasan, SumberBatasAman } from '@/lib/types'
import { Kartu, Lencana, Pemisah, Tombol, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { AreaTeks, Kolom, Pilihan, Sakelar } from '@/components/ui/formulir'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { Konfirmasi } from '@/components/ui/lembar'
import { Peringatan } from '@/components/ui/umpanBalik'
import { IkonPanahKanan, IkonSampah, IkonSilang, IkonTambah } from '@/icons'
import { angka, cx, jumlahSatuan } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import { kategoriBarang } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu formulir dipakai dua layar: Tambah Barang dan Ubah Barang.
 *
 * Digabung karena aturannya memang harus sama persis. Satuan pakai, kemasan,
 * dan batas aman yang berbeda antara layar tambah dan layar ubah adalah cara
 * paling cepat melahirkan dua versi kebenaran untuk satu barang yang sama.
 *
 * Keputusan yang dipegang formulir ini:
 * - Satu Satuan Pakai per barang. Kemasan beli hanyalah lapisan tampilan.
 * - Nama yang mirip barang lama dicegat lebih dulu. Duplikat tidak cuma
 *   mengacaukan angka stok, ia memecah riwayat dan membuat perkiraan meleset.
 * - Angka stok tidak boleh diedit diam-diam saat mengubah barang; perubahan
 *   stok harus lewat Koreksi Stok supaya alasannya ikut tercatat.
 */

const SATUAN_PAKAI = ['gram', 'kg', 'ml', 'liter', 'pcs', 'butir', 'lembar', 'roll', 'galon', 'ikat']

const KATEGORI_BARU = '__baru'

function normal(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Cukup longgar untuk menangkap "gula aren" vs "Gula Aren Cair", cukup ketat untuk tidak berisik. */
function serupa(a: string, b: string): boolean {
  const x = normal(a)
  const y = normal(b)
  if (x.length < 3 || y.length < 3) return false
  if (x === y) return true
  if (y.startsWith(x) || x.startsWith(y)) return true
  const kataX = x.split(' ').filter((w) => w.length >= 4)
  const kataY = y.split(' ').filter((w) => w.length >= 4)
  return kataX.some((w) => kataY.includes(w))
}

interface BarisKemasan {
  nama: string
  isi: string
}

export function FormulirBarang({ barang }: { barang?: Barang }) {
  const navigasi = useNavigate()
  const [param] = useSearchParams()
  const semuaBarang = useAplikasi((s) => s.barang)
  const pergerakan = useAplikasi((s) => s.pergerakan)
  const tambahBarang = useAplikasi((s) => s.tambahBarang)
  const ubahBarang = useAplikasi((s) => s.ubahBarang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const mengubah = barang != null

  const [nama, setNama] = useState(() => barang?.nama ?? param.get('nama') ?? '')
  const [namaLain, setNamaLain] = useState<string[]>(() => barang?.namaLain ?? [])
  const [sebutanBaru, setSebutanBaru] = useState('')
  const [kategori, setKategori] = useState(() => barang?.kategori ?? '')
  const [kategoriBaru, setKategoriBaru] = useState('')
  const [kode, setKode] = useState(() => barang?.kodeBarang ?? '')
  const [satuan, setSatuan] = useState(() => barang?.satuan ?? 'pcs')
  const [pakaiKemasan, setPakaiKemasan] = useState(() => (barang?.kemasan.length ?? 0) > 0)
  const [kemasan, setKemasan] = useState<BarisKemasan[]>(() =>
    (barang?.kemasan ?? []).map((k) => ({ nama: k.nama, isi: String(k.isi) })),
  )
  const [stokAwal, setStokAwal] = useState('0')
  const [pemakaian, setPemakaian] = useState(() => String(barang?.pemakaianHarian ?? ''))
  const [hariKirim, setHariKirim] = useState(() => String(barang?.hariKirim ?? 2))
  const [batasAman, setBatasAman] = useState(() => String(barang?.batasAman ?? ''))
  const [ingatkanKedaluwarsa, setIngatkanKedaluwarsa] = useState(
    () => barang?.ingatkanKedaluwarsa ?? false,
  )
  const [tanggalKedaluwarsa, setTanggalKedaluwarsa] = useState(
    () => barang?.kedaluwarsa?.slice(0, 10) ?? '',
  )
  const [dicatatManual, setDicatatManual] = useState(() => barang?.dicatatManual ?? false)
  const [catatan, setCatatan] = useState(() => barang?.catatan ?? '')
  const [dicoba, setDicoba] = useState(false)
  const [konfirmasiKemasan, setKonfirmasiKemasan] = useState(false)

  const daftarKategori = useMemo(
    () => Array.from(new Set([...kategoriBarang, ...semuaBarang.map((b) => b.kategori)])).sort(),
    [semuaBarang],
  )

  const angkaPemakaian = Number(pemakaian) || 0
  const angkaHariKirim = Math.max(0, Number(hariKirim) || 0)

  /* Saran batas aman untuk barang baru dihitung terbuka: pemakaian sehari
     dikali lama kiriman ditambah dua hari cadangan. Untuk barang lama kami
     memakai angka saran yang sudah dihitung dari riwayat aslinya. */
  const saranBatas = barang
    ? barang.batasAmanSaran
    : angkaPemakaian > 0
      ? Math.ceil(angkaPemakaian * (angkaHariKirim + 2))
      : 0

  const kembar = useMemo(() => {
    if (nama.trim().length < 3) return undefined
    return semuaBarang.find(
      (b) =>
        b.id !== barang?.id &&
        (serupa(nama, b.nama) || b.namaLain.some((n) => serupa(nama, n))),
    )
  }, [nama, semuaBarang, barang?.id])

  const kategoriTerpakai = kategori === KATEGORI_BARU ? kategoriBaru.trim() : kategori

  const galat = {
    nama: dicoba && nama.trim().length < 2
      ? 'Nama barang belum diisi. Tulis nama yang kamu pakai sehari-hari, minimal dua huruf. Contoh: Gula Aren Cair.'
      : undefined,
    kategori: dicoba && !kategoriTerpakai
      ? 'Kategori belum dipilih. Pilih salah satu dari daftar, atau buat kategori baru. Contoh: Pemanis.'
      : undefined,
    stok: dicoba && !mengubah && (Number(stokAwal) < 0 || !Number.isFinite(Number(stokAwal)))
      ? `Stok awal harus berupa angka, boleh 0 kalau barangnya belum ada. Contoh: 12.`
      : undefined,
    batas: dicoba && (Number(batasAman) < 0 || !Number.isFinite(Number(batasAman)))
      ? 'Batas aman harus berupa angka, mulai dari 0. Contoh: 8.'
      : undefined,
    kemasan:
      dicoba &&
      pakaiKemasan &&
      (kemasan.length === 0 || kemasan.some((k) => !k.nama.trim() || !(Number(k.isi) > 0)))
        ? `Isi kemasan belum lengkap. Tulis nama kemasannya dan berapa ${satuan} di dalamnya. Contoh: 1 dus isi 24 ${satuan}.`
        : undefined,
    kedaluwarsa:
      dicoba && ingatkanKedaluwarsa && !tanggalKedaluwarsa
        ? 'Tanggal kedaluwarsa belum diisi, jadi kami tidak punya patokan untuk mengingatkan. Isi tanggal dari kiriman yang paling cepat kedaluwarsa, atau matikan pengingatnya. Contoh: 30-09-2026.'
        : undefined,
  }

  /* Tombol simpan berada jauh di bawah kolom yang bermasalah. Menyuruh pemilik
     "cari yang bertanda merah" berarti menyuruhnya menggulir balik menebak —
     dan tanda merah saja bukan penanda yang bisa diandalkan. Sebut namanya. */
  const LABEL_KOLOM: Record<keyof typeof galat, string> = {
    nama: 'Nama barang',
    kategori: 'Kategori',
    stok: 'Stok awal',
    batas: 'Batas aman',
    kemasan: 'Isi kemasan',
    kedaluwarsa: 'Tanggal kedaluwarsa terdekat',
  }
  const kolomBelum = (Object.keys(galat) as Array<keyof typeof galat>)
    .filter((k) => galat[k])
    .map((k) => LABEL_KOLOM[k])
  const adaGalat = kolomBelum.length > 0

  const kemasanBersih: Kemasan[] = pakaiKemasan
    ? kemasan
        .filter((k) => k.nama.trim() && Number(k.isi) > 0)
        .map((k) => ({ nama: k.nama.trim(), isi: Number(k.isi) }))
    : []

  /* Mengubah isi kemasan tidak boleh menghitung ulang stok yang sudah tercatat:
     angka lama lahir dari penerimaan nyata, bukan dari konversi. */
  const isiKemasanBerubah =
    barang != null &&
    (kemasanBersih.length !== barang.kemasan.length ||
      kemasanBersih.some((k, i) => barang.kemasan[i] != null && barang.kemasan[i].isi !== k.isi))
  const adaRiwayat = barang != null && pergerakan.some((g) => g.barangId === barang.id)

  function tambahSebutan() {
    const bersih = sebutanBaru.trim()
    if (!bersih) return
    if (namaLain.some((n) => n.toLowerCase() === bersih.toLowerCase())) {
      setSebutanBaru('')
      return
    }
    setNamaLain((lama) => [...lama, bersih])
    setSebutanBaru('')
  }

  function kirim() {
    setDicoba(true)
    if (nama.trim().length < 2 || !kategoriTerpakai) return
    if (pakaiKemasan && kemasan.some((k) => !k.nama.trim() || !(Number(k.isi) > 0))) return
    if (!Number.isFinite(Number(batasAman)) || Number(batasAman) < 0) return
    if (!barang && (!Number.isFinite(Number(stokAwal)) || Number(stokAwal) < 0)) return
    if (ingatkanKedaluwarsa && !tanggalKedaluwarsa) return

    if (isiKemasanBerubah && adaRiwayat) {
      setKonfirmasiKemasan(true)
      return
    }
    terapkan()
  }

  function terapkan() {
    const batas = Number(batasAman) || 0
    const sumber: SumberBatasAman =
      batas <= 0 ? 'belum-diatur' : batas === saranBatas ? 'sistem' : 'sendiri'

    if (barang) {
      ubahBarang(barang.id, {
        nama: nama.trim(),
        namaLain,
        kategori: kategoriTerpakai,
        kodeBarang: kode.trim(),
        satuan,
        kemasan: kemasanBersih,
        batasAman: batas,
        sumberBatasAman: sumber,
        hariKirim: angkaHariKirim,
        pemakaianHarian: angkaPemakaian,
        ingatkanKedaluwarsa,
        kedaluwarsa: ingatkanKedaluwarsa && tanggalKedaluwarsa ? tanggalKedaluwarsa : null,
        dicatatManual,
        catatan: catatan.trim() || null,
      })
      tampilkanRacun(`Perubahan ${nama.trim()} tersimpan.`, 'aman')
      navigasi(`/stok/${barang.id}`)
      return
    }

    const baru: Barang = {
      id: `b-baru-${Date.now()}`,
      nama: nama.trim(),
      namaLain,
      kategori: kategoriTerpakai,
      kodeBarang: kode.trim(),
      satuan,
      kemasan: kemasanBersih,
      stok: Number(stokAwal) || 0,
      batasAman: batas,
      batasAmanSaran: saranBatas > 0 ? saranBatas : batas,
      sumberBatasAman: sumber,
      hariKirim: angkaHariKirim,
      hargaBeliTerakhir: 0,
      pemakaianHarian: angkaPemakaian,
      hariDataTerkumpul: 0,
      ingatkanKedaluwarsa,
      kedaluwarsa: ingatkanKedaluwarsa && tanggalKedaluwarsa ? tanggalKedaluwarsa : null,
      terhubungKasir: false,
      dicatatManual,
      catatan: catatan.trim() || null,
    }
    tambahBarang(baru)
    navigasi(`/stok/${baru.id}`)
  }

  return (
    <div className="mt-4 max-w-2xl mx-auto space-y-4 pb-8">
      {/* ---------------- Identitas barang ---------------- */}
      <Kartu>
        <h2 className="text-[0.9375rem] font-bold text-ink mb-3">Nama dan kategori</h2>

        <Kolom
          label="Nama barang"
          wajib
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Contoh: Gula Aren Cair"
          galat={galat.nama}
          bantuan="Pakai nama yang kamu sebut sehari-hari, bukan nama di faktur distributor."
        />

        {/* Cegat duplikat sebelum lahir, bukan sesudah stoknya terlanjur pecah dua. */}
        {kembar && (
          <div className="mt-2.5 flex items-start gap-3 rounded-md border border-menipis/40 bg-menipis-soft text-menipis-ink p-3">
            <div className="min-w-0 grow">
              <p className="text-[0.875rem] font-bold leading-snug">
                Sudah ada &lsquo;{kembar.nama}&rsquo;. Maksud kamu ini?
              </p>
              <p className="mt-0.5 text-[0.8125rem] opacity-90">
                Sisa {jumlahSatuan(Math.max(0, kembar.stok), kembar.satuan)} &middot; {kembar.kategori}
              </p>
            </div>
            <Link
              to={`/stok/${kembar.id}`}
              className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-sm bg-surface text-[0.8125rem] font-bold text-ink hover:bg-sunken"
            >
              Pakai yang sudah ada
              <IkonPanahKanan size={15} />
            </Link>
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="sebutan" className="block text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
            Nama lain / sebutan di warung{' '}
            <span className="text-ink-3 font-normal">(boleh dikosongkan)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="sebutan"
              value={sebutanBaru}
              onChange={(e) => setSebutanBaru(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  tambahSebutan()
                }
              }}
              placeholder="Contoh: gula aren"
              className={cx(
                'w-full h-12 px-3.5 rounded-md bg-surface text-ink text-[0.9375rem]',
                'border border-line-strong placeholder:text-ink-3/70',
                'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]',
              )}
            />
            <Tombol ragam="garis" onClick={tambahSebutan} ikonKiri={<IkonTambah size={16} />}>
              Tambah
            </Tombol>
          </div>
          <p className="mt-1.5 text-[0.8125rem] text-ink-3 leading-snug">
            Sebutan ini ikut dicari. Kalau kamu biasa mengetik &ldquo;skm&rdquo; atau &ldquo;telor&rdquo;,
            tulis di sini supaya barangnya ketemu.
          </p>
          {namaLain.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {namaLain.map((n) => (
                <li key={n}>
                  <span className="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-sunken text-[0.8125rem] font-semibold text-ink-2">
                    {n}
                    <button
                      type="button"
                      aria-label={`Hapus sebutan ${n}`}
                      onClick={() => setNamaLain((lama) => lama.filter((x) => x !== n))}
                      className="size-7 grid place-items-center rounded-full hover:bg-line"
                    >
                      <IkonSilang size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <Pilihan
            label="Kategori"
            wajib
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            galat={galat.kategori}
          >
            <option value="">Pilih kategori</option>
            {daftarKategori.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
            <option value={KATEGORI_BARU}>+ Kategori baru</option>
          </Pilihan>

          <Kolom
            label="Kode barang"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            placeholder="Contoh: GA-003"
            bantuan="Isi kalau kamu punya penomoran sendiri. Tidak wajib."
          />
        </div>

        {kategori === KATEGORI_BARU && (
          <div className="mt-4">
            <Kolom
              label="Nama kategori baru"
              wajib
              value={kategoriBaru}
              onChange={(e) => setKategoriBaru(e.target.value)}
              placeholder="Contoh: Bumbu Dapur"
              bantuan="Kategori hanya dipakai sebagai penyaring di daftar Stok, bukan folder."
            />
          </div>
        )}
      </Kartu>

      {/* ---------------- Satuan & kemasan ---------------- */}
      <Kartu>
        <h2 className="text-[0.9375rem] font-bold text-ink">Satuan pakai</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
          Stok disimpan hanya dalam satu satuan ini. Kemasan beli cuma cara menampilkannya, jadi angka di
          daftar Stok tidak pernah berubah-ubah artinya.
        </p>

        <div className="mt-3.5">
          <Pilihan label="Satuan pakai" wajib value={satuan} onChange={(e) => setSatuan(e.target.value)}>
            {SATUAN_PAKAI.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Pilihan>
        </div>

        <Pemisah className="my-4" />

        <Sakelar
          aktif={pakaiKemasan}
          ubah={(v) => {
            setPakaiKemasan(v)
            if (v && kemasan.length === 0) setKemasan([{ nama: '', isi: '' }])
          }}
          label="Beli dalam kemasan?"
          keterangan={`Nyalakan kalau kamu membelinya per dus, karung, atau jerigen. Di daftar Stok akan muncul baris kecil "= 3 dus + 2 ${satuan}".`}
        />

        {pakaiKemasan && (
          <div className="mt-3 space-y-2.5">
            {kemasan.map((k, i) => (
              <div key={i} className="rounded-md border border-line bg-surface-2 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="h-12 grid place-items-center text-[0.9375rem] font-bold text-ink-2 shrink-0">
                    1
                  </span>
                  <Kolom
                    label="Nama kemasan"
                    wajib
                    className="min-w-[7rem] flex-1"
                    value={k.nama}
                    onChange={(e) =>
                      setKemasan((lama) =>
                        lama.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)),
                      )
                    }
                    placeholder="dus"
                  />
                  <span className="h-12 grid place-items-center text-[0.875rem] text-ink-2 shrink-0">isi</span>
                  <Kolom
                    label="Isi"
                    wajib
                    className="w-32"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={k.isi}
                    onChange={(e) =>
                      setKemasan((lama) => lama.map((x, j) => (j === i ? { ...x, isi: e.target.value } : x)))
                    }
                    placeholder="24"
                    akhiran={satuan}
                  />
                  <TombolIkon
                    label={`Hapus kemasan ${k.nama || i + 1}`}
                    onClick={() => setKemasan((lama) => lama.filter((_, j) => j !== i))}
                    className="mb-0"
                  >
                    <IkonSampah size={18} />
                  </TombolIkon>
                </div>
                {Number(k.isi) > 0 && k.nama.trim() && (
                  <p className="mt-2 text-[0.8125rem] text-ink-2">
                    1 {k.nama.trim()} = {angka(Number(k.isi))} {satuan}
                  </p>
                )}
              </div>
            ))}

            {galat.kemasan && (
              <p className="text-[0.8125rem] text-kritis font-medium leading-snug">{galat.kemasan}</p>
            )}

            <Tombol
              ragam="garis"
              ukuran="kecil"
              ikonKiri={<IkonTambah size={15} />}
              onClick={() => setKemasan((lama) => [...lama, { nama: '', isi: '' }])}
            >
              Tambah kemasan lain
            </Tombol>
          </div>
        )}
      </Kartu>

      {/* ---------------- Angka ---------------- */}
      <Kartu>
        <h2 className="text-[0.9375rem] font-bold text-ink mb-3">Stok dan batas aman</h2>

        {barang ? (
          /* Angka stok sengaja tidak bisa diedit di sini: setiap perubahan stok
             harus punya alasan yang tercatat, dan itu tugas Koreksi Stok. */
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3.5">
            {/* Latar surface-2 menaikkan ambang keterbacaan: ink-3 di atasnya
                jatuh di bawah 4,5:1, jadi teks di dalam panel ini pakai ink-2. */}
            <div className="min-w-0 grow">
              <p className="text-[0.8125rem] text-ink-2">Stok tercatat</p>
              <p className="mt-0.5 text-[1.125rem] font-bold text-ink">
                {jumlahSatuan(Math.max(0, barang.stok), barang.satuan)}
              </p>
              <p className="mt-1 text-[0.8125rem] text-ink-2 leading-snug">
                Angka stok diubah lewat Koreksi Stok supaya alasannya ikut tercatat di riwayat.
              </p>
            </div>
            <TombolTautan ke={`/stok/${barang.id}/koreksi`} ragam="garis" ukuran="kecil">
              Koreksi Stok
            </TombolTautan>
          </div>
        ) : (
          <Kolom
            label="Stok awal"
            type="number"
            inputMode="numeric"
            min={0}
            value={stokAwal}
            onChange={(e) => setStokAwal(e.target.value)}
            akhiran={satuan}
            galat={galat.stok}
            bantuan="Berapa yang ada di gudang sekarang. Boleh 0 kalau barangnya belum datang."
          />
        )}

        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <Kolom
            label="Biasanya terpakai per hari"
            type="number"
            inputMode="numeric"
            min={0}
            value={pemakaian}
            onChange={(e) => setPemakaian(e.target.value)}
            akhiran={satuan}
            bantuan="Kira-kira saja. Angka ini dipakai menyusun saran batas aman sampai riwayat penjualannya terkumpul."
          />
          <Kolom
            label="Biasanya barang sampai berapa hari?"
            type="number"
            inputMode="numeric"
            min={0}
            value={hariKirim}
            onChange={(e) => setHariKirim(e.target.value)}
            akhiran="hari"
            bantuan="Dihitung dari tanggal memesan sampai barangnya benar-benar sampai."
          />
        </div>

        <div className="mt-4">
          <Kolom
            label="Batas aman"
            type="number"
            inputMode="numeric"
            min={0}
            value={batasAman}
            onChange={(e) => setBatasAman(e.target.value)}
            akhiran={satuan}
            galat={galat.batas}
            bantuan={BANTUAN.batasAman}
          />
          {saranBatas > 0 && Number(batasAman) !== saranBatas && (
            <button
              type="button"
              onClick={() => setBatasAman(String(saranBatas))}
              className="mt-2 text-[0.8125rem] font-bold text-brand hover:underline"
            >
              Pakai saran {jumlahSatuan(saranBatas, satuan)}
            </button>
          )}
          {saranBatas > 0 && Number(batasAman) === saranBatas && (
            <Lencana nada="info" className="mt-2">
              Mengikuti saran sistem
            </Lencana>
          )}
        </div>
      </Kartu>

      {/* ---------------- Sakelar ---------------- */}
      <Kartu>
        <h2 className="text-[0.9375rem] font-bold text-ink mb-1">Pengingat</h2>

        <Sakelar
          aktif={ingatkanKedaluwarsa}
          ubah={setIngatkanKedaluwarsa}
          label="Ingatkan tanggal kedaluwarsa"
          keterangan="Mati secara bawaan. Nyalakan untuk susu, daging, sayur, dan roti. Kami hanya mencatat satu tanggal, tidak memecah stok per batch."
        />

        {ingatkanKedaluwarsa && (
          <div className="mt-2 mb-2">
            <Kolom
              label="Tanggal kedaluwarsa terdekat"
              wajib
              type="date"
              value={tanggalKedaluwarsa}
              onChange={(e) => setTanggalKedaluwarsa(e.target.value)}
              galat={galat.kedaluwarsa}
              bantuan="Tanggal dari kiriman yang paling cepat kedaluwarsa. Bisa diperbarui setiap kali barang datang."
            />
          </div>
        )}

        <Pemisah className="my-2" />

        <Sakelar
          aktif={dicatatManual}
          ubah={setDicatatManual}
          label="Barang ini memang dicatat manual"
          keterangan="Untuk gas, tisu, dan barang yang tidak dijual lewat kasir. Chip peringatan hilang permanen dan barangnya tidak ikut menyusun perkiraan."
        />

        <div className="mt-3">
          <AreaTeks
            label="Catatan"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: Giling halus untuk espresso."
            bantuan="Hal yang perlu diingat saat memakai atau memesan barang ini. Muncul di Detail Barang."
          />
        </div>
      </Kartu>

      {dicoba && adaGalat && (
        <Peringatan
          nada="kritis"
          judul={
            kolomBelum.length === 1
              ? `${kolomBelum[0]} belum beres`
              : `${kolomBelum.length} kolom belum beres`
          }
        >
          Yang masih perlu diperbaiki: {kolomBelum.join(', ')}. Keterangannya ada tepat di bawah masing-masing
          kolom itu, lalu simpan sekali lagi.
        </Peringatan>
      )}

      {/* ---------------- Simpan ---------------- */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <Tombol penuh ukuran="besar" onClick={kirim}>
          {mengubah ? 'Simpan Perubahan' : 'Simpan Barang'}
        </Tombol>
        <TombolTautan
          ke={barang ? `/stok/${barang.id}` : '/stok'}
          ragam="garis"
          ukuran="besar"
          penuh
        >
          Batal
        </TombolTautan>
      </div>

      <Konfirmasi
        terbuka={konfirmasiKemasan}
        tutup={() => setKonfirmasiKemasan(false)}
        judul="Isi kemasan berubah"
        labelSetuju="Ya, simpan"
        pesan={
          <>
            <p>
              <strong>Stok yang sudah tercatat tidak dihitung ulang.</strong> Angka stok sekarang lahir dari
              penerimaan barang yang nyata, jadi mengubahnya otomatis justru membuat catatan lama jadi salah.
            </p>
            <p className="mt-2.5">
              Isi kemasan yang baru berlaku untuk penerimaan berikutnya. Kalau angka stok sekarang memang
              sudah tidak cocok, luruskan lewat Hitung Stok.
            </p>
          </>
        }
        onSetuju={terapkan}
      />
    </div>
  )
}

/**
 * Tambah Barang.
 *
 * Bisa dibuka dari daftar Stok yang kosong hasil pencarian, membawa kata yang
 * barusan diketik lewat ?nama= supaya pemilik tidak perlu mengetik dua kali.
 */
export default function StokBaru() {
  const [param] = useSearchParams()
  const namaAwal = param.get('nama') ?? ''

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul="Tambah Barang"
        keterangan={namaAwal ? `Dari pencarian "${namaAwal}"` : 'Barang baru di daftar stok'}
        kembaliKe="/stok"
      />
      <FormulirBarang />
    </div>
  )
}
