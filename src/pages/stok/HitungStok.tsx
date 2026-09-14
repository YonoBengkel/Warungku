import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Barang } from '@/lib/types'
import { Kartu, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KotakCentang, PilihanKartu, Pilihan } from '@/components/ui/formulir'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonKotak, IkonPanahKiri } from '@/icons'
import { angka, cx, jumlahSatuan, waktuLalu } from '@/lib/format'
import { kategoriBarang, statusStok } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Hitung Stok (opname) dalam dua babak.
 *
 * Babak pertama memilih cakupan. Ini bukan basa-basi: warung tidak punya waktu
 * menghitung 24 barang sekaligus, dan opname total yang tidak pernah selesai
 * jauh lebih buruk daripada opname 5 barang yang selesai tiap minggu.
 *
 * Babak kedua satu barang per layar. Angka sistem sengaja DISEMBUNYIKAN sampai
 * pengguna mengisi angkanya sendiri, karena angka yang sudah terlihat duluan
 * akan disalin begitu saja — dan hasil hitung yang menyalin catatan sistem
 * tidak menemukan selisih apa pun, yang justru jadi tujuan seluruh layar ini.
 */

export interface HasilHitung {
  barangId: string
  nama: string
  satuan: string
  /** Angka yang tercatat di sistem sebelum hitung fisik. */
  sistem: number
  /** Angka yang benar-benar dihitung di rak. */
  nyata: number
  hargaBeliTerakhir: number
}

type Cakupan = 'semua' | 'kategori' | 'menipis' | 'pilih'

const KUNCI_DRAF = 'warungku-hitung-draf'

interface Draf {
  ids: string[]
  teks: Record<string, string>
  indeks: number
  dibuatPada: string
}

function bacaDraf(): Draf | null {
  try {
    const mentah = window.localStorage.getItem(KUNCI_DRAF)
    if (!mentah) return null
    const d = JSON.parse(mentah) as Draf
    if (!Array.isArray(d.ids) || d.ids.length === 0) return null
    return d
  } catch {
    /* penyimpanan diblokir: hitungan tetap jalan, hanya tidak bisa ditunda */
    return null
  }
}

function simpanDraf(d: Draf | null) {
  try {
    if (d) window.localStorage.setItem(KUNCI_DRAF, JSON.stringify(d))
    else window.localStorage.removeItem(KUNCI_DRAF)
  } catch {
    /* diabaikan dengan sengaja */
  }
}

/** Menerima "3.400" maupun "3,5", dan menolak apa pun yang bukan angka. */
function bacaAngka(teks: string): number | null {
  const bersih = teks.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (bersih === '') return null
  const n = Number(bersih)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function HitungStok() {
  const barang = useAplikasi((s) => s.barang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const idDariUrl = params.get('barang')
  const barangDariUrl = idDariUrl ? (barang.find((b) => b.id === idDariUrl) ?? null) : null

  const [fase, setFase] = useState<'cakupan' | 'jalan'>(barangDariUrl ? 'jalan' : 'cakupan')
  const [ids, setIds] = useState<string[]>(barangDariUrl ? [barangDariUrl.id] : [])
  const [indeks, setIndeks] = useState(0)
  const [teks, setTeks] = useState<Record<string, string>>({})
  const [terungkap, setTerungkap] = useState<Record<string, boolean>>({})
  const [dilewati, setDilewati] = useState<string[]>([])

  const [cakupan, setCakupan] = useState<Cakupan>('semua')
  const [kategori, setKategori] = useState(kategoriBarang[0] ?? '')
  const [pilihSendiri, setPilihSendiri] = useState<string[]>([])
  const [draf, setDraf] = useState<Draf | null>(() => (idDariUrl ? null : bacaDraf()))

  /* Draf ditulis tiap perubahan supaya "Simpan dulu, lanjut nanti" tidak
     bergantung pada tombol yang mungkin tidak sempat ditekan. */
  useEffect(() => {
    if (fase !== 'jalan' || ids.length === 0) return
    simpanDraf({ ids, teks, indeks, dibuatPada: new Date().toISOString() })
  }, [fase, ids, teks, indeks])

  const calonCakupan = useMemo(() => {
    const menipis = barang.filter((b) => statusStok(b) === 'menipis' || statusStok(b) === 'habis')
    const perKategori = barang.filter((b) => b.kategori === kategori)
    return { semua: barang, menipis, kategori: perKategori }
  }, [barang, kategori])

  const daftarPilihan: Barang[] =
    cakupan === 'semua'
      ? calonCakupan.semua
      : cakupan === 'menipis'
        ? calonCakupan.menipis
        : cakupan === 'kategori'
          ? calonCakupan.kategori
          : barang.filter((b) => pilihSendiri.includes(b.id))

  function mulai(daftar: Barang[]) {
    if (daftar.length === 0) return
    setIds(daftar.map((b) => b.id))
    setIndeks(0)
    setTeks({})
    setTerungkap({})
    setDilewati([])
    setFase('jalan')
  }

  function lanjutkanDraf() {
    if (!draf) return
    const masihAda = draf.ids.filter((id) => barang.some((b) => b.id === id))
    if (masihAda.length === 0) {
      simpanDraf(null)
      setDraf(null)
      return
    }
    setIds(masihAda)
    setTeks(draf.teks ?? {})
    setIndeks(Math.min(draf.indeks ?? 0, masihAda.length - 1))
    setFase('jalan')
    setDraf(null)
  }

  function buangDraf() {
    simpanDraf(null)
    setDraf(null)
  }

  const barangSekarang = barang.find((b) => b.id === ids[indeks]) ?? null
  const nilaiSekarang = barangSekarang ? bacaAngka(teks[barangSekarang.id] ?? '') : null
  const selesai = ids.filter((id) => bacaAngka(teks[id] ?? '') != null || dilewati.includes(id)).length
  const terakhir = indeks >= ids.length - 1

  function kumpulkanHasil(): HasilHitung[] {
    const hasil: HasilHitung[] = []
    for (const id of ids) {
      const b = barang.find((x) => x.id === id)
      if (!b) continue
      const n = bacaAngka(teks[id] ?? '')
      if (n == null) continue
      hasil.push({
        barangId: b.id,
        nama: b.nama,
        satuan: b.satuan,
        sistem: b.stok,
        nyata: n,
        hargaBeliTerakhir: b.hargaBeliTerakhir,
      })
    }
    return hasil
  }

  function keRingkasan() {
    const hasil = kumpulkanHasil()
    simpanDraf(null)
    navigate('/stok/hitung/ringkasan', {
      state: { hasil, jumlahDilewati: ids.length - hasil.length },
    })
  }

  function lanjut() {
    if (terakhir) keRingkasan()
    else setIndeks((i) => i + 1)
  }

  function lewatiBarangIni() {
    const ini = barangSekarang
    if (ini && !dilewati.includes(ini.id)) setDilewati((lama) => [...lama, ini.id])
    if (terakhir) keRingkasan()
    else setIndeks((i) => i + 1)
  }

  function simpanDuluLanjutNanti() {
    tampilkanRacun('Hitunganmu disimpan. Buka Hitung Stok lagi untuk melanjutkan.', 'info')
    navigate('/stok')
  }

  /* ---------------------------------------------------------------- */
  /* Barang di URL tidak ditemukan                                     */
  /* ---------------------------------------------------------------- */

  if (idDariUrl && !barangDariUrl) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Hitung Stok" kembaliKe="/stok" />
        {/* KeadaanKosong menulis judulnya sebagai h3; h2 ini menjaga urutan
            judul halaman supaya tidak melompat dari h1 ke h3. */}
        <h2 className="sr-only">Barang tidak ditemukan</h2>
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini tidak ada di daftar stok"
          pesan="Mungkin barangnya sudah dihapus atau tautannya sudah lama. Pilih sendiri barang yang mau kamu hitung."
          aksi={<TombolTautan ke="/stok/hitung">Pilih Barang Lain</TombolTautan>}
          aksiKedua={
            <TombolTautan ke="/stok" ragam="garis">
              Kembali ke Stok
            </TombolTautan>
          }
        />
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Babak 1: pilih cakupan                                            */
  /* ---------------------------------------------------------------- */

  if (fase === 'cakupan') {
    return (
      <div className="pb-6">
        <KepalaHalaman
          judul="Hitung Stok"
          keterangan="Pilih dulu barang mana yang mau dihitung"
          kembaliKe="/stok"
        />

        <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
          <div className="lg:col-span-7 max-w-xl space-y-3">
          {draf && (
            <Peringatan
              nada="info"
              judul="Ada hitungan yang belum selesai"
              aksi={
                <div className="flex flex-wrap gap-2">
                  <Tombol onClick={lanjutkanDraf}>Lanjutkan</Tombol>
                  <Tombol ragam="garis" onClick={buangDraf}>
                    Mulai dari awal
                  </Tombol>
                </div>
              }
            >
              Kamu berhenti di tengah hitungan {waktuLalu(draf.dibuatPada)}, {angka(draf.ids.length)}{' '}
              barang dalam daftarnya. Angka yang sudah kamu isi masih tersimpan.
            </Peringatan>
          )}

          <p className="text-[0.875rem] text-ink-2 leading-relaxed">
            Menghitung sedikit barang tapi rutin jauh lebih berguna daripada menghitung semuanya
            sekali setahun. Ambil cakupan yang selesai dalam sekali jalan.
          </p>

          <PilihanKartu
            nilai="semua"
            terpilih={cakupan === 'semua'}
            ubah={(v) => setCakupan(v as Cakupan)}
            judul="Semua barang"
            keterangan="Paling lengkap, tapi paling lama. Biasanya dipakai sebulan sekali."
            kanan={<Lencana nada="netral">{angka(calonCakupan.semua.length)} barang</Lencana>}
          />

          <PilihanKartu
            nilai="kategori"
            terpilih={cakupan === 'kategori'}
            ubah={(v) => setCakupan(v as Cakupan)}
            judul="Per kategori"
            keterangan={`Hitung satu rak atau satu lemari sekaligus. Kategori yang sedang dipilih: ${kategori || 'belum ada'}.`}
            kanan={<Lencana nada="netral">{angka(calonCakupan.kategori.length)} barang</Lencana>}
          />

          {/* Pemilih kategori berdiri di luar kartu pilihan: kolom pilih tidak
              boleh bersarang di dalam tombol, karena satu ketukan akan menabrak
              keduanya sekaligus. */}
          {cakupan === 'kategori' && (
            <Kartu padat>
              <Pilihan label="Kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}>
                {kategoriBarang.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Pilihan>
            </Kartu>
          )}

          <PilihanKartu
            nilai="menipis"
            terpilih={cakupan === 'menipis'}
            ubah={(v) => setCakupan(v as Cakupan)}
            judul="Hanya yang menipis"
            keterangan="Barang yang stoknya di bawah batas aman atau sudah habis."
            kanan={<Lencana nada="menipis">{angka(calonCakupan.menipis.length)} barang</Lencana>}
          />

          <PilihanKartu
            nilai="pilih"
            terpilih={cakupan === 'pilih'}
            ubah={(v) => setCakupan(v as Cakupan)}
            judul="Pilih sendiri"
            keterangan="Centang barang yang kamu curigai angkanya tidak cocok."
            kanan={<Lencana nada="netral">{angka(pilihSendiri.length)} barang</Lencana>}
          />

          {cakupan === 'pilih' && (
            <Kartu padat>
              <div className="max-h-80 overflow-y-auto pr-1 space-y-1">
                {barang.map((b) => (
                  <KotakCentang
                    key={b.id}
                    dicentang={pilihSendiri.includes(b.id)}
                    ubah={(v) =>
                      setPilihSendiri((lama) =>
                        v ? [...lama, b.id] : lama.filter((x) => x !== b.id),
                      )
                    }
                  >
                    <span className="font-semibold text-ink">{b.nama}</span>{' '}
                    <span className="text-ink-3">&middot; {jumlahSatuan(b.stok, b.satuan)}</span>
                  </KotakCentang>
                ))}
              </div>
            </Kartu>
          )}
          </div>

          {/* Layar lebar memakai sisa ruangnya untuk memperlihatkan isi cakupan
              sebelum hitungan dimulai. Angka "18 barang" saja tidak cukup untuk
              memutuskan apakah cakupannya selesai dalam sekali jalan. */}
          <aside className="hidden lg:block lg:col-span-5">
            <h2 className="mb-2 text-[0.9375rem] font-bold text-ink">Barang yang akan dihitung</h2>
            <Kartu padat>
              {daftarPilihan.length === 0 ? (
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  {cakupan === 'pilih'
                    ? 'Kamu belum mencentang satu barang pun. Centang dulu barang yang mau dihitung di daftar sebelah kiri.'
                    : 'Cakupan ini sedang tidak berisi barang apa pun. Pilih cakupan lain di sebelah kiri.'}
                </p>
              ) : (
                <>
                  <ol className="max-h-96 overflow-y-auto divide-y divide-line -my-1">
                    {daftarPilihan.slice(0, 40).map((b, i) => (
                      <li key={b.id} className="flex items-baseline gap-2.5 py-2">
                        <span className="w-6 shrink-0 text-[0.8125rem] text-ink-3 tabular">{i + 1}.</span>
                        <span className="min-w-0 grow text-[0.875rem] font-semibold text-ink truncate">
                          {b.nama}
                        </span>
                        <span className="shrink-0 text-[0.8125rem] text-ink-3">{b.kategori}</span>
                      </li>
                    ))}
                  </ol>
                  {daftarPilihan.length > 40 && (
                    <p className="mt-2 text-[0.8125rem] text-ink-3">
                      dan {angka(daftarPilihan.length - 40)} barang lain.
                    </p>
                  )}
                  <p className="mt-3 pt-3 border-t border-line text-[0.8125rem] text-ink-3 leading-relaxed">
                    Catatan sistem tiap barang baru diperlihatkan setelah kamu mengisi angka rak, supaya
                    angkanya tidak ikut menuntun hitunganmu.
                  </p>
                </>
              )}
            </Kartu>
          </aside>
        </div>

        <BilahAksi
          ringkasan={
            <p className="text-[0.8125rem] text-ink-2">
              {daftarPilihan.length === 0
                ? cakupan === 'pilih'
                  ? 'Kamu belum mencentang satu barang pun.'
                  : 'Cakupan ini sedang tidak berisi barang apa pun.'
                : `${angka(daftarPilihan.length)} barang akan dihitung, satu per satu.`}
            </p>
          }
        >
          <Tombol
            penuh
            ukuran="besar"
            disabled={daftarPilihan.length === 0}
            onClick={() => mulai(daftarPilihan)}
          >
            Mulai Hitung
          </Tombol>
        </BilahAksi>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Babak 2: satu barang per layar                                    */
  /* ---------------------------------------------------------------- */

  if (!barangSekarang) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Hitung Stok" kembaliKe="/stok" />
        <h2 className="sr-only">Daftar hitung masih kosong</h2>
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Tidak ada barang yang dihitung"
          pesan="Daftar hitungnya kosong. Pilih cakupan dulu, lalu kami tampilkan barangnya satu per satu."
          aksi={<Tombol onClick={() => setFase('cakupan')}>Pilih Cakupan</Tombol>}
        />
      </div>
    )
  }

  const tampilkanCatatan = terungkap[barangSekarang.id] === true || nilaiSekarang != null
  const selisih = nilaiSekarang == null ? 0 : Math.round((nilaiSekarang - barangSekarang.stok) * 100) / 100

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Hitung Stok"
        keterangan={`Barang ke-${angka(indeks + 1)} dari ${angka(ids.length)}`}
        kembaliKe="/stok"
        bawah={
          <BilahProgres
            nilai={selesai}
            maks={ids.length}
            label={`${angka(selesai)} dari ${angka(ids.length)} barang`}
            tinggi={6}
          />
        }
      />

      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* Daftar hitung hanya muncul di layar lebar. Di HP ia akan memakan
            layar yang seharusnya milik satu angka besar, dan urutan maju-mundur
            sudah cukup dilayani tombol "Barang sebelumnya". */}
        <aside className="hidden lg:block lg:col-span-4">
          <h2 className="mb-2 text-[0.9375rem] font-bold text-ink">Daftar hitung</h2>
          <Kartu padat>
            <ol className="max-h-[24rem] overflow-y-auto divide-y divide-line -my-1">
              {ids.map((id, i) => {
                const b = barang.find((x) => x.id === id)
                if (!b) return null
                const sudah = bacaAngka(teks[id] ?? '') != null
                const lewat = dilewati.includes(id)
                const sekarang = i === indeks
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setIndeks(i)}
                      aria-current={sekarang ? 'true' : undefined}
                      className={cx(
                        'w-full text-left flex items-baseline gap-2.5 py-2 px-2 -mx-2 rounded-sm',
                        'min-h-11 transition-colors',
                        sekarang ? 'bg-brand-soft' : 'hover:bg-sunken',
                      )}
                    >
                      {/* Baris yang sedang dibuka berlatar brand-soft, jadi
                          teks abu-abu di atasnya jatuh di bawah rasio aman. */}
                      <span
                        className={cx(
                          'w-6 shrink-0 text-[0.8125rem] tabular',
                          sekarang ? 'text-brand-soft-ink' : 'text-ink-3',
                        )}
                      >
                        {i + 1}.
                      </span>
                      <span
                        className={cx(
                          'min-w-0 grow text-[0.875rem] truncate',
                          sekarang ? 'font-bold text-brand-soft-ink' : 'font-semibold text-ink',
                        )}
                      >
                        {b.nama}
                      </span>
                      <span
                        className={cx(
                          'shrink-0 text-[0.8125rem]',
                          sekarang ? 'text-brand-soft-ink' : 'text-ink-3',
                        )}
                      >
                        {sudah ? 'Terisi' : lewat ? 'Dilewati' : 'Belum'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </Kartu>
          <div className="mt-2">
            <Tombol ragam="sunyi" onClick={() => setFase('cakupan')}>
              Ganti cakupan hitungan
            </Tombol>
          </div>
        </aside>

        <div className="lg:col-span-8 max-w-lg mx-auto w-full">
        <Kartu>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
                {barangSekarang.kategori}
              </p>
              <h2 className="mt-0.5 text-[1.25rem] font-extrabold text-ink leading-tight">
                {barangSekarang.nama}
              </h2>
            </div>
            {dilewati.includes(barangSekarang.id) && <Lencana nada="netral">Dilewati</Lencana>}
          </div>

          <label
            htmlFor="hasil-hitung"
            className="mt-5 block text-[0.875rem] font-semibold text-ink-2 text-center"
          >
            Berapa yang benar-benar ada di rak sekarang?
          </label>

          {/* Satu angka besar, papan angka HP, tanpa tombol tambah-kurang:
              hasil opname diketik utuh, bukan dinaik-turunkan dari angka lama. */}
          <div className="mt-2 flex items-end justify-center gap-2">
            <input
              id="hasil-hitung"
              key={barangSekarang.id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={teks[barangSekarang.id] ?? ''}
              onChange={(e) =>
                setTeks((lama) => ({ ...lama, [barangSekarang.id]: e.target.value }))
              }
              className={cx(
                'w-40 h-20 text-center bg-sunken rounded-lg border-2 border-line-strong',
                'text-[2.5rem] font-extrabold text-ink leading-none',
                'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]',
                'placeholder:text-ink-3',
              )}
            />
            <span className="text-[0.9375rem] font-semibold text-ink-3 pb-5">
              {barangSekarang.satuan}
            </span>
          </div>

          {teks[barangSekarang.id] && nilaiSekarang == null && (
            <p className="mt-2 text-center text-[0.8125rem] text-kritis font-medium leading-snug">
              Isi dengan angka saja, tanpa huruf. Contoh: 12.
            </p>
          )}

          {/* Angka sistem baru boleh muncul setelah angka rak diisi, atau kalau
              pengguna sendiri yang minta melihatnya. */}
          <div className="mt-5 min-h-[3.5rem] grid place-items-center">
            {!tampilkanCatatan ? (
              <button
                type="button"
                onClick={() =>
                  setTerungkap((lama) => ({ ...lama, [barangSekarang.id]: true }))
                }
                className="inline-flex items-center min-h-11 px-3 text-[0.875rem] font-bold text-brand hover:underline underline-offset-2"
              >
                Lihat catatan sistem
              </button>
            ) : (
              <p className="text-center text-[0.9375rem] text-ink-2 leading-relaxed">
                Catatan sistem{' '}
                <strong className="text-ink">
                  {jumlahSatuan(barangSekarang.stok, barangSekarang.satuan)}
                </strong>
                {nilaiSekarang != null && (
                  <>
                    {' '}
                    &middot;{' '}
                    <strong
                      className={cx(
                        'font-bold',
                        selisih === 0 ? 'text-aman' : selisih < 0 ? 'text-kritis' : 'text-info',
                      )}
                    >
                      {selisih === 0 ? (
                        'Cocok, tanpa selisih'
                      ) : (
                        <>
                          Selisih {selisih > 0 ? '+' : '−'}
                          {jumlahSatuan(Math.abs(selisih), barangSekarang.satuan)}
                        </>
                      )}
                    </strong>
                  </>
                )}
              </p>
            )}
          </div>
        </Kartu>

        {/* Dua label ini tidak muat berdampingan di layar 360px, jadi barisnya
            dibiarkan membungkus daripada menggeser badan halaman ke samping. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Tombol
            ragam="sunyi"
            ikonKiri={<IkonPanahKiri size={16} />}
            disabled={indeks === 0}
            onClick={() => setIndeks((i) => Math.max(0, i - 1))}
            className="grow sm:grow-0"
          >
            Barang sebelumnya
          </Tombol>
          <Tombol ragam="garis" onClick={lewatiBarangIni} className="grow sm:grow-0">
            Lewati barang ini
          </Tombol>
        </div>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          <button
            type="button"
            onClick={simpanDuluLanjutNanti}
            className="inline-flex items-center min-h-11 px-1 text-[0.875rem] font-semibold text-brand hover:underline underline-offset-2"
          >
            Simpan dulu, lanjut nanti
          </button>
        }
      >
        <Tombol penuh ukuran="besar" disabled={nilaiSekarang == null} onClick={lanjut}>
          {terakhir ? 'Lihat Ringkasan' : 'Lanjut'}
        </Tombol>
      </BilahAksi>
    </div>
  )
}
