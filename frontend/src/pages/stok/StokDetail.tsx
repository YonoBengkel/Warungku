import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Barang, Pergerakan } from '@/lib/types'
import { ChipKedaluwarsa, ChipStok, KartuPerkiraan } from '@/components/domain'
import { KartuStruk } from '@/components/domain/KartuStruk'
import { Bagian, Kartu, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { KepalaHalaman, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong, Penjelasan } from '@/components/ui/umpanBalik'
import { GrafikTren } from '@/components/grafik/GrafikTren'
import {
  IkonGrafik,
  IkonGudang,
  IkonKeranjang,
  IkonKotak,
  IkonKontrak,
  IkonPanahKanan,
  IkonPasokan,
  IkonPena,
  IkonPeringatan,
} from '@/icons'
import { cx, hariLagi, jam, tanggalRingkas, waktuLalu, waktuNanti } from '@/lib/format'
import { angkaTampil, jumlahTampil, satuanTampil, trenTampil } from '@/lib/satuan'
import { BANTUAN } from '@/lib/label'
import {
  BATAS_AMAN_BAWAAN,
  dalamKemasan,
  penawaranUntukBarang,
  statusStok,
  transaksiById,
} from '@/data/dummy'
import { useDataMesin } from '@/lib/dataMesin'
import { LabelMetode, METODE_SARAN, metodePrediksi } from '@/components/domain/LabelMetode'
import type { SaranServer } from '@/lib/api'
import { PESANAN_BERJALAN } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Detail Barang menjawab tiga pertanyaan berurutan: masih ada berapa, cukup
 * sampai kapan, dan kenapa berkurangnya secepat itu.
 *
 * Dua aturan yang tidak boleh dilanggar di layar ini:
 * 1. "Sedang dikirim" berdiri sendiri dan TIDAK PERNAH dijumlahkan dengan sisa.
 *    Kiriman bisa batal; menjumlahkannya membuat pemilik merasa aman palsu.
 * 2. Stok minus tidak pernah ditulis negatif. Angka minus artinya catatan yang
 *    salah, bukan gudang yang berutang, jadi jalan keluarnya Koreksi Stok.
 */
type TabDetail = 'ringkasan' | 'riwayat'

export default function StokDetail() {
  const { id = '' } = useParams()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))
  const pergerakan = useAplikasi((s) => s.pergerakan)
  const pesanan = useAplikasi((s) => s.pesanan)
  const kontrak = useAplikasi((s) => s.kontrak.find((k) => k.barangId === id && k.status !== 'selesai'))
  const [tab, setTab] = useState<TabDetail>('ringkasan')
  const mesin = useDataMesin(barang)

  /* Dihitung di sini, bukan lewat pembaca bersama, karena pembaca itu menyusun
     objek baru setiap kali store dibaca dan membuat layar ini memuat tanpa henti.
     Jumlahnya tetap berdiri sendiri: tidak pernah ditambahkan ke sisa stok. */
  const dikirim = useMemo(() => {
    let jumlah = 0
    let pesananId: string | null = null
    let tiba: string | null = null
    for (const p of pesanan) {
      if (!PESANAN_BERJALAN.includes(p.status) || p.status === 'draf') continue
      for (const b of p.baris) {
        if (b.barangId !== id) continue
        jumlah += b.jumlah * b.isiPerSatuan
        pesananId = pesananId ?? p.id
        tiba = tiba ?? p.perkiraanTiba
      }
    }
    return { jumlah, pesananId, tiba }
  }, [pesanan, id])

  const riwayat = useMemo(
    () =>
      pergerakan
        .filter((g) => g.barangId === id)
        .slice()
        .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu)),
    [pergerakan, id],
  )

  if (!barang) {
    return (
      <>
        <KepalaHalaman judul="Barang tidak ditemukan" kembaliKe="/stok" />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini sudah tidak ada di daftar"
          pesan="Mungkin barangnya sudah dihapus, atau tautannya sudah lama. Daftar stok yang sekarang masih lengkap."
          aksi={<TombolTautan ke="/stok">Kembali ke Daftar Stok</TombolTautan>}
        />
      </>
    )
  }

  const status = statusStok(barang)
  /* Berapa hari lagi sisa menyentuh batas aman — bukan berapa hari lagi habis.
     Inilah momen yang bisa ditindaklanjuti: setelah lewat, memesan sudah telat. */
  const hariSampaiBatas =
    barang.pemakaianHarian > 0
      ? Math.max(0, Math.floor((barang.stok - barang.batasAman) / barang.pemakaianHarian))
      : 0
  const kemasan = dalamKemasan(barang)
  const perkiraan = mesin.perkiraan
  const tren = mesin.tren
  const penawaran = penawaranUntukBarang(barang.id)
  const adaSaranMesin = mesin.status === 'siap' && mesin.saran.length > 0
  const kePesan = adaSaranMesin
    ? '?pesan=1'
    : penawaran.length > 0
      ? `/penawaran/${penawaran[0].id}`
      : `/belanja?cari=${encodeURIComponent(barang.nama)}`
  const aksiUtama: 'koreksi' | 'pesan' | null =
    barang.stok < 0 ? 'koreksi' : status === 'habis' || status === 'menipis' ? 'pesan' : null
  const kurangCatatan = barang.stok < 0 ? Math.abs(barang.stok) : 0
  const stokTampil = Math.max(0, barang.stok)
  const pesananDikirim = dikirim.pesananId ? pesanan.find((p) => p.id === dikirim.pesananId) : undefined

  const lencanaBatas =
    barang.sumberBatasAman === 'sistem'
      ? { nada: 'info' as const, teks: 'Disarankan sistem' }
      : barang.sumberBatasAman === 'sendiri'
        ? { nada: 'netral' as const, teks: 'Diatur sendiri' }
        : { nada: 'menipis' as const, teks: `Bawaan ${BATAS_AMAN_BAWAAN}` }

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul={barang.nama}
        keterangan={barang.deskripsi ? `${barang.deskripsi} · ${barang.kategori}` : barang.kategori}
        kembaliKe="/stok"
        aksi={
          <Link
            to={`/stok/${barang.id}/ubah`}
            aria-label="Ubah data barang"
            className="size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <IkonPena size={20} />
          </Link>
        }
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* ============ Kolom kiri: angka dan keputusan ============ */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* ---- Angka sisa ---- */}
          <Bagian>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-kecil font-semibold uppercase tracking-wide text-ink-3">Sisa tercatat</p>
                <p
                  className={cx(
                    'mt-1 text-[2.25rem] font-extrabold leading-none tracking-tight',
                    status === 'habis' ? 'text-kritis' : 'text-ink',
                  )}
                >
                  {angkaTampil(barang, stokTampil)}
                  <span className="ml-1.5 text-[1rem] font-semibold text-ink-3">{satuanTampil(barang).nama}</span>
                </p>
                {kemasan && <p className="mt-1.5 text-isi text-ink-2">= {kemasan}</p>}
              </div>
              <ChipStok status={status} besar />
            </div>

            {/* Berapa hari lagi stok cukup adalah milik Kartu Perkiraan di kolom
                sebelah. Mengulangnya di sini cuma melahirkan dua kalimat yang
                bunyinya sama — dan untuk barang yang sudah habis ia berbunyi
                "cukup untuk ±0 hari", yang tidak menolong siapa pun. Kalimat di
                bawah menjawab pertanyaan lain: kapan waktunya memesan. */}
            {kurangCatatan > 0 ? (
              /* Angka minus berarti catatannya yang salah, bukan gudangnya. */
              <div className="mt-3 rounded-md bg-kritis-soft text-kritis-ink p-3.5">
                <p className="text-isi font-bold">
                  0 {satuanTampil(barang).nama} (catatan kurang {jumlahTampil(barang, kurangCatatan)})
                </p>
                <p className="mt-1 text-isi leading-relaxed opacity-90">
                  Catatannya minus. Hitung barang di rak, lalu koreksi stok.
                </p>
                <Penjelasan label="Kenapa?">
                  Kasir mencatat pemakaian lebih banyak daripada stok yang pernah masuk. Koreksi Stok hanya
                  membetulkan sisanya; riwayat penjualannya tidak ikut berubah.
                </Penjelasan>
                <TombolTautan
                  ke={`/stok/${barang.id}/koreksi`}
                  ragam="garis"
                  ukuran="kecil"
                  className="mt-2.5"
                  ikonKiri={<IkonGudang size={15} />}
                >
                  Koreksi Stok sekarang
                </TombolTautan>
              </div>
            ) : (
              <p className="mt-3 text-kartu text-ink-2 leading-relaxed">
                {barang.pemakaianHarian <= 0 ? (
                  barang.dicatatManual ? (
                    'Barang ini kamu catat manual, jadi pemakaian hariannya tidak kami hitung sendiri.'
                  ) : (
                    'Belum ada data pemakaian dari kasir, jadi kami belum bisa memperkirakan kapan stok ini perlu diisi lagi.'
                  )
                ) : status === 'habis' ? (
                  <>
                    Rata-rata terpakai{' '}
                    <strong className="text-ink">{jumlahTampil(barang, barang.pemakaianHarian)}</strong>{' '}
                    per hari. Selama stoknya kosong, kira-kira sebanyak itu penjualan yang lepas setiap hari.
                  </>
                ) : (
                  <>
                    Rata-rata terpakai{' '}
                    <strong className="text-ink">{jumlahTampil(barang, barang.pemakaianHarian)}</strong>{' '}
                    per hari.{' '}
                    {barang.batasAman <= 0 ? (
                      'Batas amannya belum diatur, jadi kami belum bisa mengingatkan sebelum stoknya habis.'
                    ) : hariSampaiBatas <= 0 ? (
                      'Sisanya sudah menyentuh batas aman — ini waktunya memesan.'
                    ) : (
                      <>
                        Sisanya menyentuh batas aman{' '}
                        <strong className="text-ink">{hariLagi(hariSampaiBatas)}</strong>, dan di situ kami
                        mengingatkan kamu.
                      </>
                    )}
                  </>
                )}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {barang.kedaluwarsa && barang.ingatkanKedaluwarsa && (
                <ChipKedaluwarsa tanggal={barang.kedaluwarsa} />
              )}
              {!barang.terhubungKasir && !barang.dicatatManual && (
                <Lencana nada="menipis" ikon={<IkonPeringatan size={13} />}>
                  Belum terhubung ke menu
                </Lencana>
              )}
              {barang.dicatatManual && <Lencana nada="netral">Dicatat manual</Lencana>}
              {kontrak && (
                <Link to={`/kontrak/${kontrak.id}`} className="inline-flex">
                  <Lencana nada="merek" ikon={<IkonKontrak size={13} />}>
                    Kontrak &middot; lihat kuota
                  </Lencana>
                </Link>
              )}
            </div>

            {barang.catatan && (
              <p className="mt-3 text-isi text-ink-2 leading-relaxed border-l-2 border-line-strong pl-3">
                {barang.catatan}
              </p>
            )}
          </Bagian>

          {/* ---- Sedang dikirim: angka kedua yang tidak pernah dijumlahkan ---- */}
          {dikirim.jumlah > 0 && (
            <Link
              to={dikirim.pesananId ? `/pesanan/${dikirim.pesananId}` : '/pesanan'}
              className="flex items-start gap-3 rounded-md border border-info/30 bg-info-soft text-info-ink p-3.5 hover:brightness-97"
            >
              <IkonPasokan size={18} className="shrink-0 mt-0.5" />
              <span className="min-w-0 grow">
                <span className="block text-kartu font-bold">
                  Sedang dikirim {jumlahTampil(barang, dikirim.jumlah)}
                </span>
                <span className="block text-isi mt-0.5 opacity-90 leading-relaxed">
                  {pesananDikirim ? `${pesananDikirim.nomor} · ` : ''}
                  {dikirim.tiba ? `perkiraan tiba ${waktuNanti(dikirim.tiba)}` : 'jadwal tiba belum dipastikan'}.
                  Belum ditambahkan ke sisa karena kiriman bisa berubah.
                </span>
              </span>
              <IkonPanahKanan size={18} className="shrink-0 mt-0.5" />
            </Link>
          )}

          {/* ---- Batas aman ---- */}
          <Link
            to={`/stok/${barang.id}/batas-aman`}
            className="flex items-center gap-3 bg-surface border border-line rounded-lg p-4 min-h-[4rem] hover:border-line-strong hover:shadow-e2 transition-[border-color,box-shadow]"
          >
            <span className="min-w-0 grow">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-kartu font-bold text-ink">Batas aman</span>
                <Lencana nada={lencanaBatas.nada}>{lencanaBatas.teks}</Lencana>
              </span>
              <span className="block mt-1 text-isi text-ink-3 leading-snug">{BANTUAN.batasAman}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[1.125rem] font-bold text-ink tabular">
                {barang.batasAman > 0 ? jumlahTampil(barang, barang.batasAman) : 'Belum diisi'}
              </span>
            </span>
            <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
          </Link>

          {/* ---- Tombol aksi ----
              Satu tombol utama menurut keadaan barang: stok minus berarti
              angkanya salah (koreksi dulu); habis atau menipis berarti pesan.
              "Pesan" membuka saran distributor di halaman ini bila ada, dengan
              jumlah saran sudah terisi. Data barang diubah lewat ikon pena di kepala. */}
          <div className="grid grid-cols-2 gap-2.5">
            <TombolTautan
              ke={kePesan}
              ragam={aksiUtama === 'pesan' ? 'utama' : 'garis'}
              penuh
              className={cx(aksiUtama === 'pesan' && 'col-span-2')}
              ikonKiri={<IkonKeranjang size={16} />}
            >
              {aksiUtama === 'pesan' ? 'Pesan Sekarang' : 'Pesan'}
            </TombolTautan>
            <TombolTautan
              ke={`/stok/${barang.id}/koreksi`}
              ragam={aksiUtama === 'koreksi' ? 'utama' : 'garis'}
              penuh
              className={cx(aksiUtama === 'pesan' && 'col-span-2', aksiUtama === 'koreksi' && 'order-first')}
              ikonKiri={<IkonPena size={16} />}
            >
              Koreksi Stok
            </TombolTautan>
          </div>

          {/* Saran distributor tepat di bawah ringkasan stok (revisi 23 Okt 2026):
              dulu di bawah grafik di kolom kanan dan mudah terlewat, terutama di HP.
              Di luar tab, jadi tombol "Pesan" selalu menemukannya. */}
          {mesin.status === 'siap' && (
            <KartuSaranMesin
              saran={mesin.saran}
              jumlahAwal={Math.max(1, perkiraan.saranBeli)}
              satuan={barang.kemasan[barang.kemasan.length - 1]?.nama ?? barang.satuan}
            />
          )}
        </div>

        {/* ============ Kolom kanan: penjelasan ============ */}
        <div className="lg:col-span-7 xl:col-span-8 mt-6 lg:mt-0">
          <TabSegmen<TabDetail>
            tab={[
              { nilai: 'ringkasan', label: 'Ringkasan' },
              { nilai: 'riwayat', label: 'Riwayat', jumlah: riwayat.length },
            ]}
            aktif={tab}
            ubah={setTab}
          />

          {tab === 'ringkasan' ? (
            <div role="tabpanel" aria-label="Ringkasan barang" className="mt-4 space-y-4">
              {mesin.status === 'memuat' ? (
                <Kartu padat aria-busy="true">
                  <p className="text-kartu font-bold text-ink">{barang.nama}</p>
                  <p className="mt-1 text-isi text-ink-3">Memuat perkiraan&hellip;</p>
                </Kartu>
              ) : (
                <KartuPerkiraan barang={barang} perkiraan={perkiraan} />
              )}

              {tren.length > 0 && (
                <Bagian
                  id="judul-tren"
                  judul="Tren pemakaian"
                  keterangan="14 hari terakhir dan 7 hari ke depan"
                  aksi={
                    <Link
                      to={`/stok/${barang.id}/rapor`}
                      className="inline-flex items-center gap-1 text-isi font-bold text-brand hover:underline"
                    >
                      <IkonGrafik size={15} />
                      Rapor perkiraan
                    </Link>
                  }
                >
                  {mesin.model && <LabelMetode className="-mt-1 mb-2" {...metodePrediksi(mesin.model)} />}
                  <GrafikTren
                    data={trenTampil(barang, tren)}
                    satuan={satuanTampil(barang).nama}
                  />
                  {/* Nama garis pembatas sama dengan yang tertulis di grafik. */}
                  <Penjelasan label="Cara membaca grafik" className="mt-1">
                    {tren.some((t) => t.aktual != null && t.prediksi != null) &&
                      `Sebelum garis “${mesin.status === 'contoh' ? 'hari ini' : 'data terakhir'}”, garis merah adalah perkiraan yang dibuat 14 hari sebelumnya tanpa melihat pemakaian sesudahnya; bandingkan dengan garis pemakaian tercatat. `}
                    Sesudah garis &ldquo;{mesin.status === 'contoh' ? 'hari ini' : 'data terakhir'}&rdquo;, bayangan merah
                    adalah rentang perkiraan: sekitar 8 dari 10 hari jatuh di dalamnya.
                  </Penjelasan>
                </Bagian>
              )}

            </div>
          ) : (
            <div role="tabpanel" aria-label="Riwayat pergerakan" className="mt-4">
              {riwayat.length === 0 ? (
                <KeadaanKosong
                  padat
                  ikon={<IkonKotak size={26} />}
                  judul="Belum ada pergerakan tercatat"
                  pesan="Riwayat terisi otomatis saat kasir mencatat penjualan, saat kiriman diterima, atau saat kamu menyimpan koreksi."
                  aksi={<TombolTautan ke={`/stok/${barang.id}/koreksi`}>Koreksi Stok</TombolTautan>}
                />
              ) : (
                <ul className="space-y-2">
                  {riwayat.map((g) => (
                    <li key={g.id}>
                      <BarisRiwayat gerak={g} barang={barang} nomorPesanan={nomorPesanan(pesanan, g)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Potongan khusus halaman ini                                        */
/* ================================================================== */

const SEGMEN_SARAN: Record<string, { label: string; nada: 'aman' | 'info' | 'menipis' }> = {
  'sangat-layak': { label: 'Sangat layak', nada: 'aman' },
  layak: { label: 'Layak', nada: 'info' },
  'kurang-layak': { label: 'Kurang layak', nada: 'menipis' },
}

/**
 * Saran distributor (Thompson Sampling + fuzzy).
 *
 * Sejak 23 Okt 2026 semua barang dinilai, jadi daftar kosong berarti belum ada
 * distributor di daerah ini yang menawarkan barangnya, atau sarannya belum
 * dihitung. Saran yang sudah lewat masa berlakunya tetap ditampilkan, dengan
 * umurnya, karena saran beberapa jam lalu lebih berguna daripada tidak ada.
 * Penjelasan di layar tanpa angka peluang atau skor: cukup label kelayakan dan
 * satu kalimat alasan berbahasa awam.
 */
function KartuSaranMesin({
  saran,
  jumlahAwal,
  satuan,
}: {
  saran: SaranServer[]
  /** Saran jumlah beli dari Mesin 1, dalam kemasan. */
  jumlahAwal: number
  satuan: string
}) {
  const pesan = useAplikasi((s) => s.pesanDariServer)
  const navigate = useNavigate()
  const [param, setParam] = useSearchParams()
  const [dibuka, setDibuka] = useState<number | null>(null)
  const [jumlah, setJumlah] = useState(jumlahAwal)
  const [mengirim, setMengirim] = useState(false)
  const wadahRef = useRef<HTMLElement>(null)

  /* Tombol "Pesan" di kolom kiri menambahkan ?pesan=1: saran teratas langsung
     dibuka dengan jumlah saran, lalu kartunya digulir ke layar (di HP letaknya
     jauh di bawah). Parameternya dibuang lagi supaya kembali tidak membukanya ulang. */
  useEffect(() => {
    if (param.get('pesan') !== '1' || saran.length === 0) return
    setJumlah(jumlahAwal)
    setDibuka(saran[0].penawaranId)
    wadahRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const p = new URLSearchParams(param)
    p.delete('pesan')
    setParam(p, { replace: true })
  }, [param, setParam, saran, jumlahAwal])

  function kirim(penawaranId: number) {
    setMengirim(true)
    pesan(penawaranId, jumlah)
      .then((id) => {
        if (id) navigate(`/pesanan/${id}`)
      })
      .finally(() => setMengirim(false))
  }

  if (saran.length === 0) {
    return (
      <Bagian id="judul-saran" judul="Saran distributor">
        <LabelMetode className="-mt-1" {...METODE_SARAN} />
        <p className="mt-2 text-isi text-ink-3 leading-relaxed">
          Belum ada saran untuk barang ini. Bisa jadi belum ada distributor di daerahmu yang menawarkannya.
        </p>
      </Bagian>
    )
  }
  const lama = saran.some((s) => s.kedaluwarsa)
  return (
    <Bagian
      ref={wadahRef}
      id="judul-saran"
      judul="Saran distributor"
      aksi={
        <p className="text-kecil text-ink-3">
          Dihitung {waktuLalu(saran[0].dijalankanPada)}
          {lama && ' · akan diperbarui'}
        </p>
      }
      className="scroll-mt-[calc(var(--kepala-global,0px)_+_4.5rem)]"
    >
      <LabelMetode className="-mt-1" {...METODE_SARAN} />
      <ul className="mt-3 space-y-3">
        {saran.map((s, i) => {
          const seg = SEGMEN_SARAN[s.segmen ?? ''] ?? { label: s.segmen ?? '–', nada: 'info' as const }
          return (
            <li key={`${s.distributorId}-${s.penawaranId}`} className={cx(i > 0 && 'pt-3 border-t border-line')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-kartu font-bold text-ink leading-snug min-w-0">
                  {i === 0 && <span className="sr-only">Saran utama: </span>}
                  {s.namaDistributor}
                </p>
                <Lencana nada={seg.nada}>{seg.label}</Lencana>
              </div>
              {s.alasan && <p className="mt-1 text-isi text-ink-2 leading-relaxed">{s.alasan}</p>}
              {dibuka === s.penawaranId ? (
                <div className="mt-2.5 p-3 rounded-md bg-sunken space-y-2.5">
                  <PengaturJumlah
                    label={`Jumlah dipesan (${satuan})`}
                    nilai={jumlah}
                    ubah={setJumlah}
                    min={1}
                    satuan={satuan}
                    saranModel={jumlahAwal}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Tombol ukuran="kecil" memuat={mengirim} onClick={() => kirim(s.penawaranId)}>
                      Kirim Pesanan ke {s.namaDistributor}
                    </Tombol>
                    <Tombol ukuran="kecil" ragam="garis" onClick={() => setDibuka(null)}>
                      Batal
                    </Tombol>
                  </div>
                </div>
              ) : (
                <Tombol
                  ukuran="kecil"
                  ragam={i === 0 ? 'utama' : 'garis'}
                  className="mt-2"
                  onClick={() => {
                    setJumlah(jumlahAwal)
                    setDibuka(s.penawaranId)
                  }}
                >
                  Pesan dari distributor ini
                </Tombol>
              )}
            </li>
          )
        })}
      </ul>
    </Bagian>
  )
}

/* ================================================================== */
/* Potongan lain                                                      */
/* ================================================================== */

function nomorPesanan(
  daftar: Array<{ id: string; nomor: string }>,
  gerak: Pergerakan,
): string | null {
  if (!gerak.pesananId) return null
  return daftar.find((p) => p.id === gerak.pesananId)?.nomor ?? null
}

/**
 * Riwayat ditulis dalam bahasa bisnis, bukan bahasa basis data.
 * "Terjual dari kasir -5 kg" bisa dipahami tanpa penjelasan; "jenis: terjual,
 * delta: -5" tidak bisa.
 */
function BarisRiwayat({
  gerak,
  barang,
  nomorPesanan,
}: {
  gerak: Pergerakan
  barang: Barang
  nomorPesanan: string | null
}) {
  const masuk = gerak.jumlah > 0
  const besaran = `${masuk ? '+' : '−'}${jumlahTampil(barang, Math.abs(gerak.jumlah))}`

  /* Dibedakan lewat keterangannya, bukan lewat transaksiId: pergerakan dari
     kasir juga bisa tanpa struk kalau hari itu tidak ada yang tercetak, jadi
     memakai transaksiId akan melabeli penjualan kasir sebagai catatan manual. */
  const dicatatManual = gerak.keterangan === 'Pemakaian dicatat manual'

  /* Struk asal penjualan. Kalau barisnya bukan penjualan, berasal dari catatan
     manual, atau struknya tidak ketemu, pengungkapnya tidak ditampilkan sama
     sekali — diam lebih baik daripada bukti yang menunjuk barang lain. */
  const struk =
    gerak.jenis === 'terjual' && !dicatatManual && gerak.transaksiId
      ? transaksiById(gerak.transaksiId)
      : undefined

  let judul = 'Pergerakan stok'
  // Bahan baku UMKM produsen: pemakaiannya datang dari sesi masak, bukan kasir.
  if (gerak.jenis === 'terjual' && gerak.keterangan?.startsWith('Dipakai produksi')) judul = 'Dipakai produksi'
  else if (gerak.jenis === 'terjual') judul = dicatatManual ? 'Pemakaian dicatat manual' : 'Terjual dari kasir'
  else if (gerak.jenis === 'masuk') judul = nomorPesanan ? `Masuk dari pesanan ${nomorPesanan}` : 'Barang masuk'
  else if (gerak.jenis === 'hitung-fisik') judul = 'Hasil hitung fisik'
  else if (gerak.jenis === 'koreksi') judul = 'Koreksi stok'


  const isi = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-kartu font-semibold text-ink leading-snug">{judul}</p>
        <p
          className={cx(
            'shrink-0 text-kartu font-bold tabular',
            masuk ? 'text-aman-ink' : 'text-ink',
          )}
        >
          {besaran}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-kecil text-ink-3">
        <span>
          {tanggalRingkas(gerak.waktu)} &middot; {jam(gerak.waktu)}
        </span>
        <span>&middot;</span>
        <span>oleh {gerak.oleh}</span>
        <span>&middot;</span>
        <span>
          stok jadi {jumlahTampil(barang, Math.max(0, gerak.stokSesudah))}
        </span>
      </div>
    </>
  )

  if (gerak.pesananId) {
    return (
      <Link
        to={`/pesanan/${gerak.pesananId}`}
        className="block bg-surface border border-line rounded-md p-3.5 hover:border-line-strong hover:shadow-e2 transition-[border-color,box-shadow]"
      >
        {isi}
        <p className="mt-1.5 text-kecil font-semibold text-brand">Lihat pesanannya</p>
      </Link>
    )
  }

  return (
    <div className="bg-surface border border-line rounded-md p-3.5">
      {isi}
      {struk && (
        <details className="mt-1.5">
          {/* Judulnya menyebut "terakhir hari itu" karena satu baris merangkum
              pemakaian sehari penuh sementara struk yang tersimpan cuma yang
              terakhir. Tanpa itu, pemilik usaha yang menelusuri selisih stok
              membaca struk berisi barang lain sebagai penyebab angkanya. */}
          <summary className="inline-flex items-center min-h-11 text-isi font-semibold text-brand cursor-pointer select-none">
            Lihat struk terakhir hari itu
          </summary>
          <div className="mt-1">
            <p className="mb-1.5 text-kecil text-ink-3 leading-relaxed">
              Baris ini merangkum penjualan sehari penuh. Struk di bawah cuma contoh struk terakhir hari itu,
              bukan satu-satunya penyebab angkanya.
            </p>
            <KartuStruk transaksi={struk} ringkas />
          </div>
        </details>
      )}
    </div>
  )
}
