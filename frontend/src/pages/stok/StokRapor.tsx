import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { BatangData } from '@/components/grafik/GrafikBatang'
import { GrafikBatang } from '@/components/grafik/GrafikBatang'
import { Kartu, Lencana, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentang, IkonKotak, IkonPeringatan, IkonSilang } from '@/icons'
import { angka, cx, jumlahSatuan, namaHariSingkat, tanggalRingkas } from '@/lib/format'
import { satuanTampil } from '@/lib/satuan'
import { perkiraanUntuk, trenBarang } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Rapor Perkiraan — layar tempat kami mempertanggungjawabkan angka sendiri.
 *
 * Dua keputusan yang menentukan isi layar ini:
 *
 * 1. Ketepatan ditulis dalam satuan barang ("meleset kurang dari 1 liter"),
 *    bukan persentase. Pemilik warung mengambil keputusan dalam liter dan kilo,
 *    dan "akurasi 92%" tidak memberi tahu apakah ia perlu pesan satu dus lebih.
 *
 * 2. Hari saat stok habis ditandai dan DIKELUARKAN dari data yang dipakai
 *    menyusun perkiraan. Kalau tidak, model belajar bahwa permintaan hari itu
 *    turun — padahal yang terjadi adalah barangnya tidak ada. Efeknya menumpuk:
 *    perkiraan mengecil, saran belanja ikut mengecil, barang makin sering
 *    habis, dan datanya makin salah. Karena itu penandaannya otomatis, dan
 *    alasannya ditulis terang-terangan di layar, bukan disembunyikan.
 */

interface BarisRapor {
  tanggal: string
  perkiraan: number
  kenyataan: number
  habis: boolean
}

/** Pembangkit acak bersemai supaya angka rapor tidak berubah tiap render. */
function acak(semai: number) {
  let a = semai >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Batas toleransi dibulatkan ke angka yang enak diucapkan, bukan 78 gram. */
function bulatRapi(n: number): number {
  const skala = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  return skala.find((s) => s >= n) ?? 1000
}

export default function StokRapor() {
  const { id = '' } = useParams()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))

  const rapor = useMemo(() => {
    if (!barang) return null

    const titik = trenBarang(barang.id)
      .filter((t) => t.aktual != null)
      .slice(-14)
    if (titik.length === 0) return null

    const rnd = acak(barang.id.split('').reduce((a, c) => a + c.charCodeAt(0), 131))
    const baris: BarisRapor[] = titik.map((t) => {
      const nyata = t.aktual as number
      const perkiraan = Math.max(1, Math.round(nyata * (0.88 + rnd() * 0.24)))
      const habis = rnd() < 0.1
      return {
        tanggal: t.tanggal,
        perkiraan,
        kenyataan: habis ? Math.round(perkiraan * 0.3) : nyata,
        habis,
      }
    })

    // Selalu ada minimal satu hari kehabisan dalam rapor: kalau tidak pernah
    // muncul, aturan pengecualiannya jadi tidak pernah terlihat pengguna.
    if (!baris.some((x) => x.habis)) {
      let paling = 0
      for (let i = 1; i < baris.length - 1; i++) {
        if (baris[i].kenyataan < baris[paling].kenyataan) paling = i
      }
      baris[paling] = {
        ...baris[paling],
        habis: true,
        kenyataan: Math.round(baris[paling].perkiraan * 0.3),
      }
    }

    // Satuan yang sama dengan daftar Stok dan detail barang (lib/satuan). Rapor
    // dengan satuannya sendiri membuat angka yang sama terbaca berbeda di dua
    // layar yang dibuka berurutan.
    const { isi: faktor, nama: unit } = satuanTampil(barang)

    const dipakai = baris.filter((x) => !x.habis)
    const rataTampil = dipakai.reduce((a, x) => a + x.kenyataan, 0) / Math.max(1, dipakai.length) / faktor
    const toleransi = bulatRapi(Math.max(faktor > 1 ? 0.05 : 1, rataTampil * 0.12))
    const tepat = dipakai.filter(
      (x) => Math.abs(x.perkiraan - x.kenyataan) / faktor < toleransi,
    ).length

    return { baris, faktor, unit, toleransi, tepat, dinilai: dipakai.length, habis: baris.length - dipakai.length }
  }, [barang])

  /* ---------------------------------------------------------------- */
  /* Barang tidak ditemukan                                            */
  /* ---------------------------------------------------------------- */

  if (!barang) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Rapor Perkiraan" kembaliKe="/stok" />
        {/* KeadaanKosong menulis judulnya sebagai h3; tanpa h2 di depannya
            urutan judul halaman melompat dari h1 langsung ke h3. */}
        <h2 className="sr-only">Barang tidak ditemukan</h2>
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini tidak ada di daftar stok"
          pesan="Mungkin barangnya sudah dihapus, atau tautan yang kamu buka sudah lama. Coba cari lagi dari daftar Stok."
          aksi={<TombolTautan ke="/stok">Kembali ke Stok</TombolTautan>}
        />
      </div>
    )
  }

  const perkiraan = perkiraanUntuk(barang)

  /* ---------------------------------------------------------------- */
  /* Belum ada perkiraan yang bisa dinilai                             */
  /* ---------------------------------------------------------------- */

  if (perkiraan.kematangan === 'belum-bisa' || !rapor) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Rapor Perkiraan" keterangan={barang.nama} kembaliKe={`/stok/${barang.id}`} />
        <div className="mt-4 max-w-xl mx-auto">
          <Kartu>
            <h2 className="text-[1.0625rem] font-extrabold text-ink leading-snug">
              Belum ada perkiraan yang bisa dinilai
            </h2>
            {barang.dicatatManual ? (
              <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
                {barang.nama} kamu tandai sebagai barang yang dicatat manual, jadi kami memang tidak
                menyusun perkiraan untuknya. Pengingat batas aman tetap berjalan seperti biasa.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
                  Rapor ini membandingkan perkiraan kami dengan kenyataan. Untuk {barang.nama}, kami
                  belum pernah mengeluarkan perkiraan, jadi belum ada yang bisa dinilai.
                </p>
                {/* Bilah ini hanya masuk akal selagi datanya memang belum cukup.
                    Barang baru yang riwayat pemakaiannya belum terbentuk tidak
                    boleh diberi bilah "96 dari 14 hari". */}
                {barang.hariDataTerkumpul < 14 ? (
                  <div className="mt-4">
                    <BilahProgres
                      nilai={barang.hariDataTerkumpul}
                      maks={14}
                      nada="netral"
                      tinggi={6}
                      label={`Data terkumpul ${angka(barang.hariDataTerkumpul)} dari 14 hari`}
                    />
                    <p className="mt-1.5 text-[0.75rem] text-ink-3">
                      Perkiraan mulai muncul {angka(14 - barang.hariDataTerkumpul)} hari lagi.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-[0.8125rem] text-ink-3 leading-relaxed">
                    Riwayat pemakaiannya belum terbentuk, jadi belum ada perkiraan lama yang bisa
                    diadu dengan kenyataan. Rapor ini terisi sendiri setelah beberapa hari penjualan
                    tercatat.
                  </p>
                )}
              </>
            )}
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <TombolTautan ke={`/stok/${barang.id}`} ragam="garis" penuh>
                Lihat Detail Barang
              </TombolTautan>
              <TombolTautan ke={`/stok/${barang.id}/batas-aman`} ragam="garis" penuh>
                Atur Batas Aman
              </TombolTautan>
            </div>
          </Kartu>
        </div>
      </div>
    )
  }

  const tampil = (n: number) => Math.round((n / rapor.faktor) * 100) / 100
  const tujuhTerakhir = rapor.baris.slice(-7)

  /* Grafik memakai satuan tampil yang sama dengan tabel. Dua satuan berbeda
     dalam satu layar membuat pembacanya harus mengalikan seribu di kepala. */
  const dataGrafik: BatangData[] = tujuhTerakhir.map((r) => ({
    label: namaHariSingkat(r.tanggal),
    nilai: tampil(r.kenyataan),
    sorot: r.habis,
  }))

  const hariHabis = tujuhTerakhir.filter((r) => r.habis)

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Rapor Perkiraan"
        keterangan={barang.nama}
        kembaliKe={`/stok/${barang.id}`}
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-4">
          <Kartu>
            {/* Angka besar di kalimat ini harus cocok dengan angka pembaginya.
                Yang dinilai adalah hari tanpa kehabisan stok, bukan 14 hari
                penuh, jadi kalimatnya menyebut jumlah yang benar-benar dinilai. */}
            <p className="text-[1.0625rem] font-extrabold text-ink leading-snug">
              Dari {angka(rapor.dinilai)} hari yang bisa dinilai, perkiraan kami meleset kurang dari{' '}
              {jumlahSatuan(rapor.toleransi, rapor.unit)} di {angka(rapor.tepat)} hari.
            </p>
            <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">
              {rapor.habis === 0
                ? `Semua ${angka(rapor.baris.length)} hari terakhir ikut dinilai karena stoknya tidak pernah habis.`
                : `${angka(rapor.habis)} hari lain dari ${angka(rapor.baris.length)} hari terakhir tidak ikut dinilai karena stoknya habis — penjualan hari itu tidak menggambarkan permintaan yang sebenarnya.`}
            </p>
          </Kartu>

          {/* 7 baris terakhir. Di bawah 1024px daftar ini berupa kartu, bukan
              tabel, supaya badan halaman tidak pernah bergeser ke samping. */}
          <section aria-labelledby="judul-tujuh-hari">
            <h2 id="judul-tujuh-hari" className="mb-3 text-[0.9375rem] font-bold text-ink">
              Tujuh hari terakhir
            </h2>

            <ul className="space-y-2.5 lg:hidden">
              {tujuhTerakhir.map((r) => {
                const beda = Math.abs(r.perkiraan - r.kenyataan) / rapor.faktor
                const tepat = beda < rapor.toleransi
                return (
                  <li key={r.tanggal} className="bg-surface border border-line rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.9375rem] font-semibold text-ink">
                        {namaHariSingkat(r.tanggal)}, {tanggalRingkas(r.tanggal)}
                      </p>
                      <PenandaKetepatan habis={r.habis} tepat={tepat} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
                      <span className="text-ink-2">
                        Perkiraan{' '}
                        <strong className="text-ink tabular">
                          {jumlahSatuan(tampil(r.perkiraan), rapor.unit)}
                        </strong>
                      </span>
                      <span className="text-ink-2">
                        Kenyataan{' '}
                        <strong className="text-ink tabular">
                          {jumlahSatuan(tampil(r.kenyataan), rapor.unit)}
                        </strong>
                      </span>
                    </div>
                    {r.habis && <KeteranganHabis />}
                  </li>
                )
              })}
            </ul>

            <div className="hidden lg:block overflow-x-auto border border-line rounded-lg bg-surface">
              <table className="w-full text-left border-collapse">
                <caption className="sr-only">
                  Perbandingan perkiraan dan kenyataan pemakaian {barang.nama} pada tujuh hari terakhir
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2">
                      Tanggal
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Perkiraan
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Kenyataan
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Hasil
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tujuhTerakhir.map((r) => {
                    const beda = Math.abs(r.perkiraan - r.kenyataan) / rapor.faktor
                    const tepat = beda < rapor.toleransi
                    return (
                      <tr
                        key={r.tanggal}
                        className={cx('border-b border-line last:border-0', r.habis && 'bg-surface-2')}
                      >
                        <td className="px-4 py-3 text-[0.875rem] font-semibold text-ink align-top">
                          {namaHariSingkat(r.tanggal)}, {tanggalRingkas(r.tanggal)}
                          {r.habis && (
                            <span className="block mt-1 text-[0.8125rem] font-normal text-ink-2 leading-snug">
                              Stok habis &mdash; penjualan hari ini tidak dihitung
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[0.875rem] text-ink-2 text-right tabular align-top">
                          {jumlahSatuan(tampil(r.perkiraan), rapor.unit)}
                        </td>
                        <td className="px-4 py-3 text-[0.875rem] font-bold text-ink text-right tabular align-top">
                          {jumlahSatuan(tampil(r.kenyataan), rapor.unit)}
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <PenandaKetepatan habis={r.habis} tepat={tepat} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-4 mt-4 lg:mt-0">
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink">
              Pemakaian tujuh hari terakhir ({rapor.unit})
            </h2>
            <p className="mt-0.5 mb-2 text-[0.8125rem] text-ink-3 leading-snug">
              {hariHabis.length === 0
                ? 'Tidak ada hari kehabisan stok dalam tujuh hari ini.'
                : `Hari saat stok habis: ${hariHabis
                    .map((r) => `${namaHariSingkat(r.tanggal)} ${tanggalRingkas(r.tanggal)}`)
                    .join(', ')}. Batangnya rendah karena barangnya tidak ada, bukan karena sepi.`}
            </p>
            <div className="overflow-x-auto">
              <GrafikBatang data={dataGrafik} satuan={rapor.unit} tinggi={170} />
            </div>
          </Kartu>

          <Peringatan nada="info" judul="Kenapa hari kehabisan stok dibuang">
            Kalau hari itu tetap dihitung, sistem akan menyimpulkan permintaan {barang.nama} sedang
            turun &mdash; padahal barangnya yang tidak ada. Akibatnya saran belanja berikutnya ikut
            mengecil, barang makin sering habis, dan datanya makin melenceng. Karena itu tanggalnya
            ditandai otomatis dan tidak dipakai menyusun perkiraan.
          </Peringatan>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <TombolTautan ke={`/stok/${barang.id}`} ragam="garis" penuh>
              Lihat Detail Barang
            </TombolTautan>
            <TombolTautan ke={`/stok/${barang.id}/batas-aman`} ragam="garis" penuh>
              Atur Batas Aman
            </TombolTautan>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Status tidak pernah hanya warna: selalu ikon, teks, dan warna sekaligus. */
function PenandaKetepatan({ habis, tepat }: { habis: boolean; tepat: boolean }) {
  if (habis) {
    return (
      <Lencana nada="netral" ikon={<IkonSilang size={13} />}>
        Tidak dihitung
      </Lencana>
    )
  }
  return tepat ? (
    <Lencana nada="aman" ikon={<IkonCentang size={13} />}>
      Tepat
    </Lencana>
  ) : (
    <Lencana nada="menipis" ikon={<IkonPeringatan size={13} />}>
      Meleset
    </Lencana>
  )
}

function KeteranganHabis() {
  return (
    <p className="mt-2 text-[0.8125rem] text-ink-2 leading-snug border-t border-line pt-2">
      Stok habis &mdash; penjualan hari ini tidak dihitung
    </p>
  )
}
