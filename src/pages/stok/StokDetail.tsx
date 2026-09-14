import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Pergerakan } from '@/lib/types'
import { ALASAN_KOREKSI } from '@/lib/types'
import { ChipKedaluwarsa, ChipStok, KartuPerkiraan } from '@/components/domain'
import { Kartu, Lencana, Pemisah, TombolTautan } from '@/components/ui/dasar'
import { KepalaHalaman, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
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
import { angka, cx, hariLagi, jam, jumlahSatuan, rupiah, tanggalRingkas, waktuNanti } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import {
  dalamKemasan,
  penawaranUntukBarang,
  perkiraanUntuk,
  statusStok,
  trenBarang,
} from '@/data/dummy'
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
 *    salah, bukan gudang yang berutang, jadi jalan keluarnya hitung fisik.
 */
type TabDetail = 'ringkasan' | 'riwayat'

export default function StokDetail() {
  const { id = '' } = useParams()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))
  const pergerakan = useAplikasi((s) => s.pergerakan)
  const pesanan = useAplikasi((s) => s.pesanan)
  const kontrak = useAplikasi((s) => s.kontrak.find((k) => k.barangId === id && k.status !== 'selesai'))
  const [tab, setTab] = useState<TabDetail>('ringkasan')

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

  /* Pembongkaran penyusutan bulan berjalan. Terjual dipisah dari basi/rusak/susut
     karena hanya yang terjual boleh dibaca sebagai permintaan. */
  const bulanIni = useMemo(() => {
    const awal = new Date()
    awal.setDate(1)
    awal.setHours(0, 0, 0, 0)
    const dalamBulan = riwayat.filter((g) => +new Date(g.waktu) >= +awal)
    let terjual = 0
    let basi = 0
    let rusak = 0
    let susut = 0
    let rugiSatuan = 0
    for (const g of dalamBulan) {
      const keluar = g.jumlah < 0 ? -g.jumlah : 0
      if (g.jenis === 'terjual') terjual += keluar
      if (g.alasan === 'basi') basi += keluar
      if (g.alasan === 'rusak') rusak += keluar
      if (g.alasan === 'susut') susut += keluar
      if (g.alasan && ALASAN_KOREKSI[g.alasan].kerugian) rugiSatuan += keluar
    }
    return { terjual, basi, rusak, susut, rugiSatuan }
  }, [riwayat])

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
  const perkiraan = perkiraanUntuk(barang)
  const tren = trenBarang(barang.id)
  const penawaran = penawaranUntukBarang(barang.id)
  const kurangCatatan = barang.stok < 0 ? Math.abs(barang.stok) : 0
  const stokTampil = Math.max(0, barang.stok)
  const rugi = bulanIni.rugiSatuan * barang.hargaBeliTerakhir
  const pesananDikirim = dikirim.pesananId ? pesanan.find((p) => p.id === dikirim.pesananId) : undefined

  const lencanaBatas =
    barang.sumberBatasAman === 'sistem'
      ? { nada: 'info' as const, teks: 'Disarankan sistem' }
      : barang.sumberBatasAman === 'sendiri'
        ? { nada: 'netral' as const, teks: 'Diatur sendiri' }
        : { nada: 'menipis' as const, teks: 'Belum diatur' }

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul={barang.nama}
        keterangan={barang.kategori}
        kembaliKe="/stok"
        aksi={
          <Link
            to={`/stok/${barang.id}/ubah`}
            aria-label="Ubah data barang"
            className="size-10 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <IkonPena size={20} />
          </Link>
        }
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* ============ Kolom kiri: angka dan keputusan ============ */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* ---- Angka sisa ---- */}
          <Kartu>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Sisa tercatat</p>
                <p
                  className={cx(
                    'mt-1 text-[2.25rem] font-extrabold leading-none tracking-tight',
                    status === 'habis' ? 'text-kritis' : 'text-ink',
                  )}
                >
                  {angka(stokTampil, Number.isInteger(stokTampil) ? 0 : 1)}
                  <span className="ml-1.5 text-[1rem] font-semibold text-ink-3">{barang.satuan}</span>
                </p>
                {kemasan && <p className="mt-1.5 text-[0.8125rem] text-ink-2">= {kemasan}</p>}
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
                <p className="text-[0.875rem] font-bold">
                  0 {barang.satuan} (catatan kurang {jumlahSatuan(kurangCatatan, barang.satuan)})
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed opacity-90">
                  Kasir mencatat pemakaian lebih banyak daripada stok yang pernah masuk. Hitung fisik akan
                  meluruskan angkanya tanpa mengubah riwayat penjualan.
                </p>
                <TombolTautan
                  ke={`/stok/hitung?barang=${barang.id}`}
                  ragam="garis"
                  ukuran="kecil"
                  className="mt-2.5"
                  ikonKiri={<IkonGudang size={15} />}
                >
                  Hitung fisik sekarang
                </TombolTautan>
              </div>
            ) : (
              <p className="mt-3 text-[0.9375rem] text-ink-2 leading-relaxed">
                {barang.pemakaianHarian <= 0 ? (
                  barang.dicatatManual ? (
                    'Barang ini kamu catat manual, jadi pemakaian hariannya tidak kami hitung sendiri.'
                  ) : (
                    'Belum ada data pemakaian dari kasir, jadi kami belum bisa memperkirakan kapan stok ini perlu diisi lagi.'
                  )
                ) : status === 'habis' ? (
                  <>
                    Rata-rata terpakai{' '}
                    <strong className="text-ink">{jumlahSatuan(barang.pemakaianHarian, barang.satuan)}</strong>{' '}
                    per hari. Selama stoknya kosong, kira-kira sebanyak itu penjualan yang lepas setiap hari.
                  </>
                ) : (
                  <>
                    Rata-rata terpakai{' '}
                    <strong className="text-ink">{jumlahSatuan(barang.pemakaianHarian, barang.satuan)}</strong>{' '}
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
              <p className="mt-3 text-[0.8125rem] text-ink-2 leading-relaxed border-l-2 border-line-strong pl-3">
                {barang.catatan}
              </p>
            )}
          </Kartu>

          {/* ---- Sedang dikirim: angka kedua yang tidak pernah dijumlahkan ---- */}
          {dikirim.jumlah > 0 && (
            <Link
              to={dikirim.pesananId ? `/pesanan/${dikirim.pesananId}` : '/pesanan'}
              className="flex items-start gap-3 rounded-md border border-info/30 bg-info-soft text-info-ink p-3.5 hover:brightness-97"
            >
              <IkonPasokan size={18} className="shrink-0 mt-0.5" />
              <span className="min-w-0 grow">
                <span className="block text-[0.9375rem] font-bold">
                  Sedang dikirim {jumlahSatuan(dikirim.jumlah, barang.satuan)}
                </span>
                <span className="block text-[0.8125rem] mt-0.5 opacity-90 leading-relaxed">
                  {pesananDikirim ? `${pesananDikirim.nomor} · ` : ''}
                  {dikirim.tiba ? `perkiraan tiba ${waktuNanti(dikirim.tiba)}` : 'jadwal tiba belum dipastikan'}.
                  Jumlah ini sengaja tidak dijumlahkan dengan sisa, karena kiriman masih bisa berubah.
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
                <span className="text-[0.9375rem] font-bold text-ink">Batas aman</span>
                <Lencana nada={lencanaBatas.nada}>{lencanaBatas.teks}</Lencana>
              </span>
              <span className="block mt-1 text-[0.8125rem] text-ink-3 leading-snug">{BANTUAN.batasAman}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[1.125rem] font-bold text-ink tabular">
                {barang.batasAman > 0 ? jumlahSatuan(barang.batasAman, barang.satuan) : 'Belum diisi'}
              </span>
            </span>
            <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
          </Link>

          {/* ---- Tombol aksi ---- */}
          <div className="grid grid-cols-2 gap-2.5">
            <TombolTautan ke={`/stok/${barang.id}/koreksi`} penuh ikonKiri={<IkonPena size={16} />}>
              Koreksi Stok
            </TombolTautan>
            <TombolTautan
              ke={
                penawaran.length > 0
                  ? `/penawaran/${penawaran[0].id}`
                  : `/belanja?cari=${encodeURIComponent(barang.nama)}`
              }
              ragam="garis"
              penuh
              ikonKiri={<IkonKeranjang size={16} />}
            >
              Pesan
            </TombolTautan>
            <TombolTautan
              ke={`/stok/${barang.id}/ubah`}
              ragam="sunyi"
              penuh
              className="col-span-2"
              ikonKiri={<IkonKotak size={16} />}
            >
              Ubah Barang
            </TombolTautan>
          </div>
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
              <KartuPerkiraan barang={barang} perkiraan={perkiraan} />

              {tren.length > 0 && (
                <Kartu>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">Tren pemakaian</h2>
                      <p className="text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">
                        14 hari terakhir dan 7 hari ke depan
                      </p>
                    </div>
                    <Link
                      to={`/stok/${barang.id}/rapor`}
                      className="shrink-0 inline-flex items-center gap-1 text-[0.8125rem] font-bold text-brand hover:underline"
                    >
                      <IkonGrafik size={15} />
                      Rapor perkiraan
                    </Link>
                  </div>
                  <GrafikTren data={tren} satuan={barang.satuan} />
                </Kartu>
              )}

              {/* ---- Kenapa stok berkurang bulan ini ---- */}
              <Kartu>
                <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">
                  Kenapa stok berkurang bulan ini
                </h2>
                <p className="text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">
                  Yang terjual dipisah dari yang terbuang. Hanya angka terjual yang kami pakai menyusun
                  perkiraan.
                </p>

                {bulanIni.terjual + bulanIni.basi + bulanIni.rusak + bulanIni.susut === 0 ? (
                  <p className="mt-3 text-[0.875rem] text-ink-3 leading-relaxed">
                    Belum ada pengurangan stok yang tercatat bulan ini. Angka akan muncul setelah ada penjualan
                    dari kasir atau koreksi yang kamu simpan.
                  </p>
                ) : (
                  <div className="mt-3.5 space-y-2.5">
                    <BatangAlasan
                      label="Terjual"
                      nilai={bulanIni.terjual}
                      maks={Math.max(bulanIni.terjual, bulanIni.basi, bulanIni.rusak, bulanIni.susut)}
                      satuan={barang.satuan}
                      warna="bg-seri-1"
                    />
                    <BatangAlasan
                      label="Basi"
                      nilai={bulanIni.basi}
                      maks={Math.max(bulanIni.terjual, bulanIni.basi, bulanIni.rusak, bulanIni.susut)}
                      satuan={barang.satuan}
                      warna="bg-kritis"
                    />
                    <BatangAlasan
                      label="Rusak"
                      nilai={bulanIni.rusak}
                      maks={Math.max(bulanIni.terjual, bulanIni.basi, bulanIni.rusak, bulanIni.susut)}
                      satuan={barang.satuan}
                      warna="bg-menipis"
                    />
                    <BatangAlasan
                      label="Susut"
                      nilai={bulanIni.susut}
                      maks={Math.max(bulanIni.terjual, bulanIni.basi, bulanIni.rusak, bulanIni.susut)}
                      satuan={barang.satuan}
                      warna="bg-ink-3"
                    />
                  </div>
                )}

                <Pemisah className="my-3.5" />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.875rem] font-semibold text-ink-2">Kerugian bulan ini</span>
                  <span
                    className={cx(
                      'text-[1.125rem] font-extrabold tabular',
                      rugi > 0 ? 'text-kritis' : 'text-ink',
                    )}
                  >
                    {rupiah(rugi)}
                  </span>
                </div>
                <p className="mt-1 text-[0.75rem] text-ink-3 leading-relaxed">
                  Dihitung dari basi, rusak, hilang, dan susut dikalikan harga beli terakhir (
                  {rupiah(barang.hargaBeliTerakhir)} per {barang.satuan}). &ldquo;Salah catat&rdquo; dan
                  &ldquo;dipakai sendiri&rdquo; tidak dihitung sebagai kerugian.
                </p>
              </Kartu>
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
                      <BarisRiwayat gerak={g} satuan={barang.satuan} nomorPesanan={nomorPesanan(pesanan, g)} />
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

function nomorPesanan(
  daftar: Array<{ id: string; nomor: string }>,
  gerak: Pergerakan,
): string | null {
  if (!gerak.pesananId) return null
  return daftar.find((p) => p.id === gerak.pesananId)?.nomor ?? null
}

function BatangAlasan({
  label,
  nilai,
  maks,
  satuan,
  warna,
}: {
  label: string
  nilai: number
  maks: number
  satuan: string
  warna: string
}) {
  const rasio = maks > 0 ? nilai / maks : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] font-semibold text-ink-2">{label}</span>
        <span className="text-[0.8125rem] font-bold text-ink tabular">
          {nilai > 0 ? jumlahSatuan(nilai, satuan) : `0 ${satuan}`}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-sunken overflow-hidden">
        <div
          className={cx('h-full rounded-full transition-[width] duration-500', warna)}
          style={{ width: `${Math.max(nilai > 0 ? 3 : 0, rasio * 100)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Riwayat ditulis dalam bahasa bisnis, bukan bahasa basis data.
 * "Terjual dari kasir -5 kg" bisa dipahami tanpa penjelasan; "jenis: terjual,
 * delta: -5" tidak bisa.
 */
function BarisRiwayat({
  gerak,
  satuan,
  nomorPesanan,
}: {
  gerak: Pergerakan
  satuan: string
  nomorPesanan: string | null
}) {
  const masuk = gerak.jumlah > 0
  const besaran = `${masuk ? '+' : '−'}${jumlahSatuan(Math.abs(gerak.jumlah), satuan)}`

  let judul = 'Pergerakan stok'
  if (gerak.jenis === 'terjual') judul = 'Terjual dari kasir'
  else if (gerak.jenis === 'masuk') judul = nomorPesanan ? `Masuk dari pesanan ${nomorPesanan}` : 'Barang masuk'
  else if (gerak.jenis === 'hitung-fisik') judul = 'Hasil hitung fisik'
  else if (gerak.jenis === 'koreksi')
    judul = `Koreksi manual: ${gerak.alasan ? ALASAN_KOREKSI[gerak.alasan].label.toLowerCase() : 'tanpa alasan'}`

  const isi = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold text-ink leading-snug">{judul}</p>
        <p
          className={cx(
            'shrink-0 text-[0.9375rem] font-bold tabular',
            masuk ? 'text-aman-ink' : 'text-ink',
          )}
        >
          {besaran}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-3">
        <span>
          {tanggalRingkas(gerak.waktu)} &middot; {jam(gerak.waktu)}
        </span>
        <span>&middot;</span>
        <span>oleh {gerak.oleh}</span>
        <span>&middot;</span>
        <span>
          stok jadi {angka(Math.max(0, gerak.stokSesudah), Number.isInteger(gerak.stokSesudah) ? 0 : 1)}{' '}
          {satuan}
        </span>
      </div>
      {gerak.keterangan && gerak.jenis === 'koreksi' && (
        <p className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed">{gerak.keterangan}</p>
      )}
      {gerak.alasan && !ALASAN_KOREKSI[gerak.alasan].kerugian && (
        <p className="mt-1 text-[0.75rem] text-ink-3">Tidak dihitung sebagai kerugian.</p>
      )}
    </>
  )

  if (gerak.pesananId) {
    return (
      <Link
        to={`/pesanan/${gerak.pesananId}`}
        className="block bg-surface border border-line rounded-md p-3.5 hover:border-line-strong hover:shadow-e2 transition-[border-color,box-shadow]"
      >
        {isi}
        <p className="mt-1.5 text-[0.75rem] font-semibold text-brand">Lihat pesanannya</p>
      </Link>
    )
  }

  return <div className="bg-surface border border-line rounded-md p-3.5">{isi}</div>
}
