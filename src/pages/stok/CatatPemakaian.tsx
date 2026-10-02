import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Kartu, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { BarisChip, BilahAksi, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentangLingkaran, IkonKotak } from '@/icons'
import { angka, bacaAngkaIndonesia, cx, tanggalLengkapHari } from '@/lib/format'
import { angkaTampil, dariTampil, desimalTampil, jumlahTampil, satuanTampil } from '@/lib/satuan'
import type { Barang } from '@/lib/types'
import { kategoriBarang } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Catat Pemakaian Harian — mode untuk pemilik usaha yang belum memakai kasir
 * digital. Tanpa layar ini, stok mereka tidak pernah berkurang dan seluruh
 * perkiraan jadi tidak berguna.
 *
 * BATAS YANG SENGAJA DIPASANG DAN TIDAK BOLEH DILONGGARKAN:
 *   1. Tepat SATU kolom angka per barang, yaitu "terpakai hari ini".
 *   2. TIDAK PERNAH ada angka rupiah di layar ini — tidak harga jual, tidak
 *      harga beli, tidak nilai pemakaian.
 *   3. TIDAK ADA kolom kedua. Bukan "harga", bukan "sisa", bukan "terjual vs
 *      terbuang".
 *
 * Alasannya satu: begitu layar ini punya kolom kedua dan kolom rupiah, ia
 * berubah pelan-pelan jadi aplikasi kasir bayangan — pencatatan ganda yang
 * lebih lambat daripada kasir sungguhan, lebih sering salah, dan angkanya
 * bertabrakan dengan kasir yang dipakai pemiliknya nanti. Yang kami butuhkan
 * dari layar ini cuma satu hal: berapa banyak barang yang keluar hari ini.
 * Sisanya urusan aplikasi kasir, dan itu memang bukan wilayah kami.
 *
 * Di layar lebar penyaring kategori pindah jadi rail kiri. Daftar isian tetap
 * satu kolom sempit karena mata harus turun lurus dari satu kolom angka ke
 * kolom angka berikutnya; yang diisi ruang kosongnya adalah penyaring dan
 * aturan mainnya, bukan lebar barisnya.
 */

interface Isian {
  nilai: number | null
  galat: string | null
}

/** Barang yang benar-benar berubah, dipakai untuk layar sesudah simpan. */
interface Tercatat {
  id: string
  nama: string
  /** Sudah dalam satuan tampil, mis. "0,4 kg". */
  terpakai: string
  sisa: string
}

/**
 * Menerima "3.400" maupun "3,5" seperti kebiasaan menulis angka di Indonesia.
 * Angka yang diketik dalam SATUAN TAMPIL barangnya (kg, liter, dus); yang
 * dikembalikan sudah dalam satuan simpan, siap dikurangkan dari stok.
 */
function bacaIsian(teks: string, b: Barang): Isian {
  const stok = b.stok
  if (teks.trim() === '') return { nilai: null, galat: null }
  const n = dariTampil(b, bacaAngkaIndonesia(teks))
  if (!Number.isFinite(n)) {
    return { nilai: null, galat: 'Isi dengan angka saja, tanpa huruf. Contoh: 12.' }
  }
  if (n < 0) {
    return { nilai: null, galat: 'Jumlah terpakai tidak bisa minus. Tulis angka positif. Contoh: 12.' }
  }
  /* Barang bersisa 0 tidak boleh berujung pesan "kurangi angkanya sampai 0" —
     itu menyuruh pengguna mengetik angka yang tidak berarti apa-apa. Jalan
     keluarnya adalah membetulkan sisa stoknya dulu lewat Koreksi Stok. */
  if (n > 0 && stok === 0) {
    return {
      nilai: null,
      galat: `Sisa barang ini tercatat ${jumlahTampil(b, 0)}, jadi belum ada yang bisa dikurangi. Betulkan dulu sisanya lewat Koreksi Stok, baru catat pemakaiannya. Contoh setelah sisa dibetulkan: 12.`,
    }
  }
  if (n > stok) {
    return {
      nilai: null,
      galat: `Terpakai tidak boleh lebih besar dari sisa ${jumlahTampil(b, stok)}. Turunkan angkanya, atau tambah dulu stoknya lewat Koreksi Stok. Contoh: ${angkaTampil(b, stok)}.`,
    }
  }
  return { nilai: n, galat: null }
}

export default function CatatPemakaian() {
  const barang = useAplikasi((s) => s.barang)
  const catatPemakaianHarian = useAplikasi((s) => s.catatPemakaianHarian)

  const [kategori, setKategori] = useState('semua')
  const [teks, setTeks] = useState<Record<string, string>>({})
  const [dilewati, setDilewati] = useState<string[]>([])
  const [tersimpan, setTersimpan] = useState<Tercatat[] | null>(null)

  const isian = useMemo(() => {
    const peta: Record<string, Isian> = {}
    for (const b of barang) peta[b.id] = bacaIsian(teks[b.id] ?? '', b)
    return peta
  }, [barang, teks])

  const terisi = barang.filter((b) => (isian[b.id]?.nilai ?? 0) > 0)
  const adaGalat = barang.some((b) => isian[b.id]?.galat)

  const jumlahPerKategori = useMemo(() => {
    const peta: Record<string, number> = {}
    for (const b of barang) peta[b.kategori] = (peta[b.kategori] ?? 0) + 1
    return peta
  }, [barang])

  const tampil = useMemo(
    () =>
      barang.filter(
        (b) => (kategori === 'semua' || b.kategori === kategori) && !dilewati.includes(b.id),
      ),
    [barang, kategori, dilewati],
  )

  function lewatiYangKosong() {
    const kosong = tampil.filter((b) => (teks[b.id] ?? '').trim() === '').map((b) => b.id)
    setDilewati((lama) => [...lama, ...kosong])
  }

  function simpan() {
    const pemakaian: Record<string, number> = {}
    const catatan: Tercatat[] = []
    for (const b of barang) {
      const n = isian[b.id]?.nilai
      if (n && n > 0) {
        pemakaian[b.id] = n
        catatan.push({
          id: b.id,
          nama: b.nama,
          terpakai: jumlahTampil(b, n),
          sisa: jumlahTampil(b, Math.max(0, Math.round((b.stok - n) * 100) / 100)),
        })
      }
    }
    catatPemakaianHarian(pemakaian)
    setTersimpan(catatan)
    setTeks({})
    setDilewati([])
  }

  /* ---------------------------------------------------------------- */
  /* Sesudah simpan                                                    */
  /* ---------------------------------------------------------------- */

  if (tersimpan != null) {
    return (
      <div className="pb-6">
        <KepalaHalaman
          judul="Catat Pemakaian Harian"
          keterangan={tanggalLengkapHari(new Date())}
          kembaliKe="/stok"
        />
        <Kartu className="mt-6 max-w-lg mx-auto">
          <div className="text-center">
            <span className="inline-grid place-items-center size-12 rounded-xl bg-aman-soft text-aman-ink">
              <IkonCentangLingkaran size={26} />
            </span>
            <h2 className="mt-3 text-[1.375rem] font-extrabold text-ink leading-tight">
              Sisa stok {angka(tersimpan.length)} barang sudah dikurangi
            </h2>
          </div>

          {/* "Tersimpan" saja tidak memberi tahu apa yang berubah. Daftar di
              bawah menyebut angka barunya supaya pengguna bisa mengoreksi
              kalau ada yang salah ketik. */}
          <ul className="mt-4 divide-y divide-line border border-line rounded-md overflow-hidden">
            {tersimpan.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
                <Link
                  to={`/stok/${t.id}`}
                  className="text-[0.9375rem] font-semibold text-ink hover:text-brand transition-colors min-w-0 truncate"
                >
                  {t.nama}
                </Link>
                <span className="text-[0.8125rem] text-ink-2 shrink-0 tabular">
                  terpakai {t.terpakai} &middot; sisa <strong className="text-ink">{t.sisa}</strong>
                </span>
              </li>
            ))}
            {tersimpan.length > 6 && (
              <li className="px-3.5 py-2.5 text-[0.8125rem] text-ink-3">
                dan {angka(tersimpan.length - 6)} barang lain ikut berkurang.
              </li>
            )}
          </ul>

          <p className="mt-3 text-[0.875rem] text-ink-2 leading-relaxed">
            Angka hari ini juga dipakai untuk menyusun perkiraan kebutuhan minggu depan.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center">
            <TombolTautan ke="/stok" penuh>
              Lihat Stok
            </TombolTautan>
            <Tombol ragam="garis" penuh onClick={() => setTersimpan(null)}>
              Catat barang lain
            </Tombol>
          </div>
        </Kartu>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Belum ada barang sama sekali                                      */
  /* ---------------------------------------------------------------- */

  if (barang.length === 0) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Catat Pemakaian Harian" kembaliKe="/stok" />
        {/* KeadaanKosong menulis judulnya sebagai h3, jadi tanpa h2 ini urutan
            judul halaman melompat dari h1 langsung ke h3. */}
        <h2 className="sr-only">Daftar barang masih kosong</h2>
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Belum ada barang untuk dicatat"
          pesan="Daftar stok kamu masih kosong, jadi belum ada yang bisa dicatat pemakaiannya. Tambahkan dulu barang yang kamu jual sehari-hari."
          aksi={<TombolTautan ke="/stok/baru">Tambah Barang</TombolTautan>}
          aksiKedua={
            <TombolTautan ke="/stok" ragam="garis">
              Kembali ke Stok
            </TombolTautan>
          }
        />
      </div>
    )
  }

  const kendaliLewati = (
    <div className="flex flex-wrap items-center gap-2">
      <Tombol ragam="garis" onClick={lewatiYangKosong}>
        Sembunyikan barang yang belum diisi
      </Tombol>
      {dilewati.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-3">
          {angka(dilewati.length)} barang disembunyikan
          <Tombol ragam="sunyi" onClick={() => setDilewati([])}>
            Tampilkan lagi
          </Tombol>
        </span>
      )}
    </div>
  )

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Catat Pemakaian Harian"
        keterangan={tanggalLengkapHari(new Date())}
        kembaliKe="/stok"
        bawah={
          /* Di layar lebar penyaring pindah ke rail kiri, jadi chip geser ini
             hanya dipakai selama lebarnya belum cukup untuk rail. */
          <BarisChip className="lg:hidden">
            <Chip aktif={kategori === 'semua'} onClick={() => setKategori('semua')}>
              Semua ({angka(barang.length)})
            </Chip>
            {kategoriBarang.map((k) => (
              <Chip key={k} aktif={kategori === k} onClick={() => setKategori(k)}>
                {k} ({angka(jumlahPerKategori[k] ?? 0)})
              </Chip>
            ))}
          </BarisChip>
        }
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* Rail kiri di desktop: penyaring kategori + aturan main + kendali daftar */}
        <div className="lg:col-span-4 space-y-4">
          <nav aria-label="Saring menurut kategori" className="hidden lg:block">
            <h2 className="mb-2 text-[0.9375rem] font-bold text-ink">Kategori</h2>
            <ul className="space-y-1">
              {[
                { nilai: 'semua', label: 'Semua barang', jumlah: barang.length },
                ...kategoriBarang.map((k) => ({
                  nilai: k,
                  label: k,
                  jumlah: jumlahPerKategori[k] ?? 0,
                })),
              ].map((k) => (
                <li key={k.nilai}>
                  <button
                    type="button"
                    aria-current={kategori === k.nilai ? 'true' : undefined}
                    onClick={() => setKategori(k.nilai)}
                    className={cx(
                      'w-full min-h-11 px-3 rounded-md flex items-center justify-between gap-2',
                      'text-[0.875rem] font-semibold transition-colors',
                      kategori === k.nilai
                        ? 'bg-brand-soft text-brand-soft-ink'
                        : 'text-ink-2 hover:bg-sunken hover:text-ink',
                    )}
                  >
                    <span className="min-w-0 truncate">{k.label}</span>
                    <span className="shrink-0 text-[0.8125rem] tabular">{angka(k.jumlah)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <Peringatan nada="netral" judul="Satu angka saja per barang">
            Isi berapa banyak yang keluar hari ini. Yang tidak dipakai boleh dikosongkan &mdash; stoknya
            tidak akan berubah. Harga tidak ditanyakan di sini; urusan harga jual ada di aplikasi kasir.
          </Peringatan>

          {kendaliLewati}
        </div>

        <div className="lg:col-span-8 mt-4 lg:mt-0 max-w-2xl">
          <h2 className="sr-only">Daftar barang dan jumlah yang terpakai hari ini</h2>

          {tampil.length === 0 ? (
            <KeadaanKosong
              padat
              judul={
                dilewati.length > 0
                  ? 'Semua barang di daftar ini sudah disembunyikan'
                  : 'Belum ada barang di kategori ini'
              }
              pesan={
                dilewati.length > 0
                  ? 'Kamu bisa menampilkannya lagi, memilih kategori lain, atau langsung menyimpan angka yang sudah diisi.'
                  : 'Kategori yang kamu pilih belum berisi barang apa pun. Pilih kategori lain, atau lihat semua barang sekaligus.'
              }
              aksi={
                dilewati.length > 0 ? (
                  <Tombol ragam="garis" onClick={() => setDilewati([])}>
                    Tampilkan lagi
                  </Tombol>
                ) : (
                  <Tombol ragam="garis" onClick={() => setKategori('semua')}>
                    Lihat semua barang
                  </Tombol>
                )
              }
            />
          ) : (
            <ul
              aria-label="Daftar barang dan jumlah yang terpakai hari ini"
              className="divide-y divide-line border border-line rounded-lg bg-surface overflow-hidden"
            >
              {/* Kepala kolom tetap terlihat di HP: tanpa ini kolom angkanya
                  tidak punya label yang bisa dibaca mata, hanya oleh pembaca layar. */}
              <li className="flex items-center gap-3 px-3.5 py-2 bg-surface-2">
                {/* ink-3 pada 12px kapital tidak lolos rasio kontras di atas
                    surface-2, jadi kepala kolom naik ke ink-2. */}
                <span className="min-w-0 grow text-[0.75rem] font-semibold uppercase tracking-wide text-ink-2">
                  Barang
                </span>
                <span className="w-[8.5rem] shrink-0 text-[0.75rem] font-semibold uppercase tracking-wide text-ink-2">
                  Terpakai hari ini
                </span>
              </li>
              {tampil.map((b) => {
                const info = isian[b.id]
                const aktif = (info?.nilai ?? 0) > 0
                return (
                  <li
                    key={b.id}
                    className={cx('px-3.5 py-3 transition-colors', aktif && 'bg-brand-soft')}
                  >
                    {/* Saat ada pesan kesalahan, kolom angka melebar dan turun ke
                        bawah nama barang: pesan tiga unsur tidak terbaca kalau
                        dijejalkan ke kolom selebar 136px di layar 360px. */}
                    <div
                      className={cx(
                        'flex gap-3',
                        info?.galat ? 'flex-col sm:flex-row sm:items-start' : 'items-start',
                      )}
                    >
                      <div className="min-w-0 grow pt-1.5">
                        <p className="text-[1rem] font-semibold text-ink leading-snug">{b.nama}</p>
                        {/* Baris yang sudah terisi berlatar brand-soft; teks
                            abu-abu di atasnya jatuh di bawah rasio aman, jadi
                            barisnya naik satu tingkat ke ink-2. */}
                        <p
                          className={cx(
                            'mt-0.5 text-[0.8125rem]',
                            aktif ? 'text-ink-2' : 'text-ink-3',
                          )}
                        >
                          {b.kategori} &middot; sisa {jumlahTampil(b, b.stok)}
                        </p>
                        {/* Barang bersisa 0 tidak bisa dikurangi lagi, jadi jalan
                            keluarnya ditawarkan sebelum pengguna mengetik. */}
                        {b.stok === 0 && (
                          <Link
                            to={`/stok/${b.id}/koreksi`}
                            className="mt-1 inline-flex items-center min-h-11 text-[0.8125rem] font-semibold text-brand hover:underline underline-offset-2"
                          >
                            Sisa tercatat 0 &mdash; betulkan lewat Koreksi Stok
                          </Link>
                        )}
                      </div>
                      {/* Satu-satunya kolom angka di layar ini. Jangan tambah kolom kedua. */}
                      <div className={cx('shrink-0', info?.galat ? 'w-full sm:w-56' : 'w-[8.5rem]')}>
                        <Kolom
                          aria-label={`Terpakai hari ini untuk ${b.nama} dalam ${satuanTampil(b).nama}`}
                          inputMode={desimalTampil(b) > 0 ? 'decimal' : 'numeric'}
                          placeholder="0"
                          akhiran={satuanTampil(b).nama}
                          value={teks[b.id] ?? ''}
                          galat={info?.galat ?? undefined}
                          onChange={(e) => setTeks((lama) => ({ ...lama, [b.id]: e.target.value }))}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <BilahAksi
        ringkasan={
          <p className={cx('text-[0.8125rem]', adaGalat ? 'text-kritis-ink' : 'text-ink-2')}>
            {adaGalat
              ? 'Ada angka yang perlu dibetulkan dulu sebelum bisa disimpan.'
              : terisi.length === 0
                ? 'Belum ada angka yang diisi.'
                : `${angka(terisi.length)} barang siap disimpan.`}
          </p>
        }
      >
        <Tombol penuh ukuran="besar" disabled={terisi.length === 0 || adaGalat} onClick={simpan}>
          Simpan &amp; Kurangi Stok
        </Tombol>
      </BilahAksi>
    </div>
  )
}
