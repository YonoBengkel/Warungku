import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, TombolTautan, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonCari,
  IkonCentang,
  IkonInfo,
  IkonKotak,
  IkonSilang,
  IkonTambah,
} from '@/icons'
import { angka, cx, jumlahSatuan, tanggalPendek, waktuLalu } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'
import { useAplikasi } from '@/store/aplikasi'

interface BahanTerpilih {
  id: string
  takaran: string
}

/**
 * Memasangkan satu menu di kasir ke bahan-bahan yang dipakainya.
 *
 * Janji yang sengaja dijaga kecil: pemasangan ini hanya berlaku untuk penjualan
 * BERIKUTNYA. Penjualan yang sudah lewat tidak ditarik ulang, dan itu ditulis
 * terang-terangan di layar. Menjanjikan koreksi mundur yang tidak terjadi akan
 * membuat pemilik usaha berhenti memercayai angka stoknya.
 */
export default function KasirPasangkan() {
  const { idMenu } = useParams<{ idMenu: string }>()
  const navigate = useNavigate()

  const menu = useAplikasi((s) => s.kasir.menuBelumDipasangkan.find((m) => m.id === idMenu))
  const barang = useAplikasi((s) => s.barang)
  const caraHitung = useAplikasi((s) => s.profil.caraHitung)
  const pasangkanMenu = useAplikasi((s) => s.pasangkanMenu)
  const ubahBarang = useAplikasi((s) => s.ubahBarang)

  const [cari, setCari] = useState('')
  const [dipilih, setDipilih] = useState<BahanTerpilih[]>([])
  const [sudahDicoba, setSudahDicoba] = useState(false)

  /* Takaran per porsi hanya masuk akal untuk usaha yang meracik. Toko kelontong
     memasangkan menu ke satu barang utuh, jadi kolomnya tidak ditampilkan. */
  const pakaiTakaran = caraHitung === 'racikan' || caraHitung === 'keduanya'

  const hasilCari = useMemo(() => {
    const kunci = cari.trim().toLowerCase()
    const terpilih = new Set(dipilih.map((d) => d.id))
    const tersedia = barang.filter((b) => !terpilih.has(b.id))
    if (!kunci) return tersedia.slice(0, 6)
    return tersedia
      .filter(
        (b) =>
          b.nama.toLowerCase().includes(kunci) ||
          b.kategori.toLowerCase().includes(kunci) ||
          b.namaLain.some((n) => n.toLowerCase().includes(kunci)),
      )
      .slice(0, 8)
  }, [cari, barang, dipilih])

  if (!menu) {
    return (
      <div className="pb-8">
        <KepalaHalaman judul="Pasangkan Menu ke Bahan" kembaliKe="/akun/kasir?tab=beres" />
        {/* KeadaanKosong memakai h3; tanpa h2 di antaranya tingkat judul
            halaman ini melompat dari h1 ke h3. */}
        <h2 className="sr-only">Menu tidak ditemukan</h2>
        <KeadaanKosong
          ikon={<IkonCentang size={26} />}
          judul="Menu ini sudah tidak perlu dipasangkan"
          pesan="Mungkin kamu atau rekanmu baru saja memasangkannya, atau menunya sudah dihapus di aplikasi kasir."
          aksi={<TombolTautan ke="/akun/kasir?tab=beres">Lihat yang Perlu Dibereskan</TombolTautan>}
          aksiKedua={
            <TombolTautan ke="/stok" ragam="sunyi">
              Buka daftar Stok
            </TombolTautan>
          }
        />
      </div>
    )
  }

  const belumDiisi = pakaiTakaran
    ? dipilih.filter((d) => !(Number(d.takaran.replace(',', '.')) > 0)).map((d) => d.id)
    : []

  function tambah(id: string) {
    setDipilih((s) => [...s, { id, takaran: '' }])
    setCari('')
  }

  function hapus(id: string) {
    setDipilih((s) => s.filter((d) => d.id !== id))
  }

  function ubahTakaran(id: string, nilai: string) {
    setDipilih((s) => s.map((d) => (d.id === id ? { ...d, takaran: nilai } : d)))
  }

  function simpan() {
    setSudahDicoba(true)
    if (dipilih.length === 0 || belumDiisi.length > 0) return

    /* Bahan yang dipasangkan ditandai terhubung ke menu, supaya daftar Stok
       berhenti memperingatkan bahwa stoknya tidak berkurang otomatis. */
    for (const d of dipilih) ubahBarang(d.id, { terhubungKasir: true })
    /* pasangkanMenu sendiri sudah memunculkan racun konfirmasi. Menambah racun
       kedua dari sini membuat dua kalimat berisi hal yang sama menumpuk di
       layar yang sama. */
    pasangkanMenu(menu!.id, dipilih[0].id)
    navigate('/akun/kasir?tab=beres')
  }

  const bahanById = (id: string) => barang.find((b) => b.id === id)

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul="Pasangkan Menu ke Bahan"
        keterangan={menu.namaMenu}
        kembaliKe="/akun/kasir?tab=beres"
      />

      {/* Di layar lebar: memilih di kiri, akibatnya di kanan. Daftar bahan yang
          sudah dipilih dan batas janji "hanya berlaku ke depan" harus terlihat
          bersamaan dengan pencarian, bukan dua layar gulir di bawahnya. */}
      <div className="mt-4 max-w-2xl lg:max-w-6xl lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className="space-y-5">
          {/* Menu yang sedang dibereskan */}
          <Kartu>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Menu di kasir</p>
                <h2 className="mt-0.5 text-[1.125rem] font-extrabold text-ink leading-snug">{menu.namaMenu}</h2>
              </div>
              <Lencana nada="menipis">Belum dipasangkan</Lencana>
            </div>
            <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
              Terjual <strong className="text-ink">{angka(menu.jumlahTerjual)} kali</strong> sejak{' '}
              {waktuLalu(menu.sejak)} ({tanggalPendek(menu.sejak)}), tapi belum ada bahan yang berkurang karenanya.
            </p>
          </Kartu>

          {/* Pencarian bahan */}
          <section aria-labelledby="judul-pilih-bahan">
            <h2 id="judul-pilih-bahan" className="text-[0.9375rem] font-bold text-ink mb-1">
              Bahan apa yang terpakai untuk menu ini?
            </h2>
            <p className="text-[0.8125rem] text-ink-3 leading-relaxed mb-3">
              Boleh lebih dari satu. Contohnya kopi susu memakai biji kopi, susu, dan gula aren sekaligus.
            </p>

            {barang.length === 0 ? (
              <KeadaanKosong
                padat
                ikon={<IkonKotak size={24} />}
                judul="Daftar stokmu masih kosong"
                pesan="Tambahkan dulu bahan yang kamu pakai, baru menu dari kasir bisa dipasangkan ke sana."
                aksi={<TombolTautan ke="/stok/baru">Tambah Barang</TombolTautan>}
              />
            ) : (
              <>
                {/* Kolom pencarian ditulis langsung, bukan lewat komponen Kolom:
                    Kolom selalu menempelkan "(boleh dikosongkan)" pada label yang
                    tidak wajib, dan kalimat itu tidak masuk akal untuk pencarian. */}
                <div>
                  <label htmlFor="cari-bahan" className="block text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
                    Cari bahan di daftar stok
                  </label>
                  <div className="relative">
                    <IkonCari
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
                    />
                    <input
                      id="cari-bahan"
                      type="search"
                      value={cari}
                      onChange={(e) => setCari(e.target.value)}
                      placeholder="Ketik nama bahan, misal: susu"
                      aria-describedby="cari-bahan-bantuan"
                      className={cx(
                        'w-full h-12 pl-11 pr-3.5 rounded-md bg-surface text-ink text-[0.9375rem]',
                        'border border-line-strong placeholder:text-ink-3/70',
                        'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]',
                      )}
                    />
                  </div>
                  <p id="cari-bahan-bantuan" className="mt-1.5 text-[0.8125rem] text-ink-3 leading-snug">
                    Sebutan sehari-hari juga dicari. Mengetik &lsquo;skm&rsquo; menemukan susu kental manis.
                  </p>
                </div>

                {hasilCari.length === 0 ? (
                  <p className="mt-3 text-[0.875rem] text-ink-3 leading-relaxed">
                    Tidak ada bahan bernama &ldquo;{cari}&rdquo; di daftar stokmu.{' '}
                    <Link to="/stok/baru" className="font-semibold text-brand hover:underline">
                      Tambahkan dulu barangnya
                    </Link>
                    , lalu kembali ke sini.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {hasilCari.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => tambah(b.id)}
                          className="w-full text-left flex items-center gap-3 min-h-[3.5rem] px-3.5 py-2.5 rounded-md border border-line bg-surface hover:border-brand hover:bg-brand-soft/30 transition-colors"
                        >
                          <span className="shrink-0 size-9 rounded-md bg-sunken text-ink-3 grid place-items-center">
                            <IkonKotak size={18} />
                          </span>
                          <span className="min-w-0 grow">
                            <span className="block text-[0.9375rem] font-semibold text-ink truncate">{b.nama}</span>
                            <span className="block text-[0.75rem] text-ink-3">
                              {b.kategori} &middot; sisa {jumlahTampil(b, b.stok)}
                            </span>
                          </span>
                          <span className="shrink-0 text-brand">
                            <IkonTambah size={20} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        <div className="space-y-5 mt-5 lg:mt-0">
          {/* Bahan yang sudah dipilih */}
          {dipilih.length > 0 && (
            <section aria-labelledby="judul-dipilih">
              <h2 id="judul-dipilih" className="text-[0.9375rem] font-bold text-ink mb-3">
                Bahan yang dipasangkan ({dipilih.length})
              </h2>
              <ul className="space-y-3">
                {dipilih.map((d) => {
                  const b = bahanById(d.id)
                  if (!b) return null
                  const galat =
                    sudahDicoba && belumDiisi.includes(d.id)
                      ? `Takaran belum diisi. Tulis berapa ${b.satuan} bahan ini yang terpakai untuk satu porsi. Contoh: 18.`
                      : undefined
                  return (
                    <li key={d.id}>
                      <div
                        className={cx(
                          'rounded-lg border bg-surface p-3.5',
                          galat ? 'border-kritis' : 'border-line',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[0.9375rem] font-bold text-ink leading-snug">{b.nama}</p>
                            <p className="text-[0.75rem] text-ink-3 mt-0.5">
                              Stok disimpan dalam satuan {b.satuan}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Batal memakai ${b.nama}`}
                            onClick={() => hapus(d.id)}
                            className="shrink-0 size-11 -mt-1.5 -mr-1.5 grid place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
                          >
                            <IkonSilang size={18} />
                          </button>
                        </div>

                        {pakaiTakaran && (
                          <div className="mt-3">
                            <Kolom
                              label={`Terpakai untuk 1 porsi ${menu.namaMenu}`}
                              wajib
                              inputMode="decimal"
                              value={d.takaran}
                              onChange={(e) => ubahTakaran(d.id, e.target.value)}
                              akhiran={b.satuan}
                              galat={galat}
                              bantuan={
                                galat
                                  ? undefined
                                  : 'Perkiraan kasar sudah cukup. Angka ini yang dikurangi dari stok tiap kali menu ini terjual.'
                              }
                            />
                            {Number(d.takaran.replace(',', '.')) > 0 && (
                              <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                                {angka(menu.jumlahTerjual)} penjualan seperti kemarin akan memakai{' '}
                                <strong className="text-ink-2">
                                  {jumlahSatuan(
                                    Number(d.takaran.replace(',', '.')) * menu.jumlahTerjual,
                                    b.satuan,
                                  )}
                                </strong>
                                .
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Batas janji: ditulis sebelum tombol simpan, bukan sesudahnya */}
          <Peringatan nada="info" judul="Yang berubah setelah disimpan">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                Penjualan <strong>berikutnya</strong> langsung mengurangi stok bahan di atas.
              </li>
              <li>
                {angka(menu.jumlahTerjual)} penjualan yang sudah lewat <strong>tidak</strong> ditarik ulang. Kalau sisa
                di rak sudah tidak cocok, betulkan lewat{' '}
                <Link to="/stok/hitung" className="font-bold underline underline-offset-2">
                  Hitung Stok
                </Link>
                .
              </li>
              <li>Kamu bisa mengubah takarannya kapan saja dari detail barang.</li>
            </ul>
          </Peringatan>

          <div className="rounded-md bg-sunken p-3.5">
            <p className="flex items-start gap-2 text-[0.8125rem] text-ink-2 leading-relaxed">
              <IkonInfo size={16} className="shrink-0 mt-px text-ink-3" />
              Menu ini campuran dan bahannya tidak tetap? Pasangkan bahan utamanya saja. Sisa selisihnya akan muncul
              saat kamu menghitung stok fisik, dan itu lebih baik daripada tidak berkurang sama sekali.
            </p>
          </div>

          <Pemisah />

          <p className="text-[0.8125rem] text-ink-3 leading-relaxed">
            Salah menu?{' '}
            <Link to="/akun/kasir?tab=beres" className="font-semibold text-brand hover:underline">
              Kembali ke daftar menu yang perlu dibereskan
            </Link>
            .
          </p>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          dipilih.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-3">Pilih minimal satu bahan dulu.</p>
          ) : sudahDicoba && belumDiisi.length > 0 ? (
            <p className="text-[0.8125rem] font-semibold text-kritis">
              {belumDiisi.length} bahan belum diisi takarannya.
            </p>
          ) : (
            <p className="text-[0.8125rem] text-ink-3">
              {dipilih.length} bahan akan berkurang setiap {menu.namaMenu} terjual.
            </p>
          )
        }
      >
        <Tombol penuh ukuran="besar" disabled={dipilih.length === 0} onClick={simpan}>
          Simpan Pemasangan
        </Tombol>
      </BilahAksi>
    </div>
  )
}
