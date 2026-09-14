import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BannerAkun,
  KartuTindakan,
  KartuPesanan,
  KuotaBulanIni,
  PitaDataKasir,
} from '@/components/domain'
import { JudulBagian, Kartu, Kerangka, Lencana, TombolTautan } from '@/components/ui/dasar'
import { GrafikTren } from '@/components/grafik/GrafikTren'
import { Percikan } from '@/components/grafik/GrafikBatang'
import {
  IkonKeranjang,
  IkonKontrak,
  IkonPasokan,
  IkonPeringatan,
  IkonPetir,
  IkonSilang,
  IkonNota,
  IkonCentangLingkaran,
} from '@/icons'
import { angka, hariLagi, jumlahSatuan } from '@/lib/format'
import {
  hariCukup,
  perkiraanUntuk,
  saranBelanja,
  statusKuota,
  statusStok,
  trenBarang,
  sisaHariPeriode,
  distributorById,
} from '@/data/dummy'
import { PESANAN_BERJALAN } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Beranda adalah daftar "Perlu Diurus", bukan galeri grafik.
 *
 * Pertanyaan yang dijawab halaman ini cuma satu: hari ini saya harus ngapain.
 * Karena itu urutan bloknya dikunci, dan tiap kartu hanya punya satu tombol.
 *
 * Aturan yang dipegang: Beranda tidak pernah punya data sendiri. Tiap blok
 * adalah cermin dari Stok, Pesanan, atau Kontrak, dan selalu menautkan balik
 * ke sumber aslinya. Tidak ada fitur yang hanya bisa dicapai dari sini.
 *
 * Yang sengaja tidak ada di sini: kartu omzet, untung, margin, dan nilai
 * rupiah penjualan. Harga jual dikelola di aplikasi kasir, jadi angka apa pun
 * yang kami tampilkan soal itu pasti salah.
 */
export default function Beranda() {
  const barang = useAplikasi((s) => s.barang)
  const kontrak = useAplikasi((s) => s.kontrak)
  const pesanan = useAplikasi((s) => s.pesanan)
  const keranjang = useAplikasi((s) => s.keranjang)
  const profil = useAplikasi((s) => s.profil)

  /* Blok perkiraan sengaja dimuat belakangan: ia paling mahal dan paling tidak
     mendesak, jadi tidak boleh menahan daftar yang perlu diurus. */
  const [perkiraanSiap, setPerkiraanSiap] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setPerkiraanSiap(true), 650)
    return () => window.clearTimeout(t)
  }, [])

  const tugas = useMemo(() => {
    const hasil: Array<{ kunci: string; urutan: number; elemen: ReactNode }> = []

    /* 1. Stok habis dan menipis */
    const kritis = barang
      .filter((b) => !b.dicatatManual && (statusStok(b) === 'habis' || statusStok(b) === 'menipis'))
      .sort((a, b) => (statusStok(a) === 'habis' ? -1 : 1) - (statusStok(b) === 'habis' ? -1 : 1))

    const habis = kritis.filter((b) => statusStok(b) === 'habis')
    for (const b of habis.slice(0, 2)) {
      const dikirim = pesanan
        .filter((p) => PESANAN_BERJALAN.includes(p.status) && p.status !== 'draf')
        .flatMap((p) => p.baris)
        .filter((x) => x.barangId === b.id)
        .reduce((a, x) => a + x.jumlah * x.isiPerSatuan, 0)

      hasil.push({
        kunci: `habis-${b.id}`,
        urutan: 0,
        elemen: (
          <KartuTindakan
            nada="kritis"
            ikon={<IkonSilang size={18} />}
            judul={`${b.nama} sudah habis`}
            lencana={dikirim > 0 ? <Lencana nada="info">Sudah dipesan, sedang dikirim</Lencana> : undefined}
            detail={
              dikirim > 0
                ? `Stok tercatat 0. ${jumlahSatuan(dikirim, b.satuan)} sedang dikirim.`
                : `Stok tercatat 0. Rata-rata terpakai ${jumlahSatuan(b.pemakaianHarian, b.satuan)} per hari.`
            }
            aksiLabel={dikirim > 0 ? 'Lihat Stok' : 'Pesan Sekarang'}
            aksiKe={dikirim > 0 ? `/stok/${b.id}` : `/pesan-cepat/${saranBelanja[0].id}`}
          />
        ),
      })
    }

    /* 2. Saran belanja harian */
    const saran = saranBelanja[0]
    if (saran && saran.baris.length > 0) {
      hasil.push({
        kunci: 'saran',
        urutan: 1,
        elemen: (
          <KartuTindakan
            nada="menipis"
            ikon={<IkonKeranjang size={18} />}
            judul={`${saran.baris.length} barang perlu dibeli minggu ini`}
            detail={saran.baris
              .slice(0, 3)
              .map((r) => barang.find((b) => b.id === r.barangId)?.nama)
              .filter(Boolean)
              .join(', ')
              .concat(saran.baris.length > 3 ? `, dan ${saran.baris.length - 3} lainnya` : '')}
            aksiLabel="Lihat Saran Belanja"
            aksiKe={`/pesan-cepat/${saran.id}`}
          />
        ),
      })
    }

    /* 3. Kuota kontrak yang kurang */
    for (const k of kontrak.filter((x) => statusKuota(x) === 'kurang')) {
      const kurang = Math.max(0, k.periodeBerjalan.kuota - k.periodeBerjalan.diterima - k.dalamPerjalanan)
      hasil.push({
        kunci: `kuota-${k.id}`,
        urutan: 2,
        elemen: (
          <KartuTindakan
            nada="menipis"
            ikon={<IkonKontrak size={18} />}
            judul={`Kuota ${k.namaBarang} masih kurang`}
            detail={`Kurang ${angka(kurang)} ${k.satuan} dari kuota ${angka(k.periodeBerjalan.kuota)} ${k.satuan} bulan ini. Sisa ${sisaHariPeriode()} hari.`}
            aksiLabel="Lihat Kontrak"
            aksiKe={`/kontrak/${k.id}`}
          />
        ),
      })
    }

    /* 4. Kontrak yang akan berakhir */
    for (const k of kontrak.filter((x) => x.status === 'akan-berakhir')) {
      const hari = Math.ceil((+new Date(k.berakhir) - Date.now()) / 86_400_000)
      hasil.push({
        kunci: `akhir-${k.id}`,
        urutan: 3,
        elemen: (
          <KartuTindakan
            nada="info"
            ikon={<IkonKontrak size={18} />}
            judul={`Kontrak ${k.namaBarang} berakhir ${hariLagi(hari)}`}
            detail={`Kalau ingin melanjutkan, perpanjangan bisa diatur sebelum masa kontrak habis.`}
            aksiLabel="Lihat Kontrak"
            aksiKe={`/kontrak/${k.id}`}
          />
        ),
      })
    }

    /* 5. Barang yang sudah sampai dan menunggu diperiksa */
    for (const p of pesanan.filter(
      (x) => x.status === 'dikirim' && x.perkiraanTiba && +new Date(x.perkiraanTiba) <= Date.now(),
    )) {
      const d = distributorById(p.distributorId)
      hasil.push({
        kunci: `terima-${p.id}`,
        urutan: 4,
        elemen: (
          <KartuTindakan
            nada="merek"
            ikon={<IkonPasokan size={18} />}
            judul={`Kiriman dari ${d?.nama} sudah sampai`}
            detail={`${p.nomor} menunggu kamu periksa. Stok baru bertambah setelah kamu konfirmasi.`}
            aksiLabel="Barang Sudah Sampai"
            aksiKe={`/pesanan/${p.id}/terima`}
          />
        ),
      })
    }

    /* 6. Draf pesanan rutin yang menunggu persetujuan */
    for (const p of pesanan.filter((x) => x.status === 'draf')) {
      const d = distributorById(p.distributorId)
      hasil.push({
        kunci: `draf-${p.id}`,
        urutan: 5,
        elemen: (
          <KartuTindakan
            nada="info"
            ikon={<IkonPetir size={18} />}
            judul="Draf pesanan rutin menunggu diperiksa"
            detail={`${p.baris[0]?.nama} ${angka(p.baris[0]?.jumlah ?? 0)} ${p.baris[0]?.satuan} ke ${d?.nama}. Tidak akan terkirim sebelum kamu setujui.`}
            aksiLabel="Periksa Draf"
            aksiKe={`/pesanan/${p.id}`}
          />
        ),
      })
    }

    /* 7. Pesanan yang belum dibayar */
    const belumBayar = pesanan.filter(
      (p) => p.statusBayar === 'belum-dibayar' && PESANAN_BERJALAN.includes(p.status) && p.status !== 'draf',
    )
    if (belumBayar.length > 0) {
      const p = belumBayar[0]
      hasil.push({
        kunci: `bayar-${p.id}`,
        urutan: 6,
        elemen: (
          <KartuTindakan
            nada="netral"
            ikon={<IkonNota size={18} />}
            judul={`${belumBayar.length} pesanan belum dibayar`}
            detail={`${p.nomor} ke ${distributorById(p.distributorId)?.nama} belum ada catatan pembayarannya.`}
            aksiLabel="Lihat Pesanan"
            aksiKe={`/pesanan/${p.id}`}
          />
        ),
      })
    }

    return hasil.sort((a, b) => a.urutan - b.urutan).slice(0, 5)
  }, [barang, kontrak, pesanan])

  const berjalan = pesanan.filter((p) => PESANAN_BERJALAN.includes(p.status))
  const isiKeranjang = keranjang.reduce((a, k) => a + k.baris.length, 0)

  /* Barang paling genting untuk blok perkiraan, maksimal 3 */
  const barangPerkiraan = useMemo(
    () =>
      barang
        .filter((b) => !b.dicatatManual && b.pemakaianHarian > 0)
        .map((b) => ({ b, hari: hariCukup(b) ?? 999 }))
        .sort((x, y) => x.hari - y.hari)
        .slice(0, 3),
    [barang],
  )

  const barangGrafik = barangPerkiraan[0]?.b
  const tren = useMemo(() => (barangGrafik ? trenBarang(barangGrafik.id) : []), [barangGrafik])

  return (
    <div className="pb-6">
      {/* Beranda tidak memakai KepalaHalaman karena ia tab akar, jadi judul
          halamannya disediakan khusus untuk pembaca layar. Tanpa ini, halaman
          paling sering dibuka justru satu-satunya yang tidak punya h1. */}
      <h1 className="sr-only">Beranda</h1>

      {/* 1. Pita data kasir */}
      <PitaDataKasir />

      {/* 2. Banner status akun */}
      <div className="mt-3 empty:mt-0">
        <BannerAkun />
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* Kolom kiri di desktop: daftar yang perlu diurus */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <section aria-labelledby="judul-perlu-diurus">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 id="judul-perlu-diurus" className="text-[1.25rem] font-extrabold text-ink tracking-tight">
                Perlu Diurus
              </h2>
              <p className="text-[0.8125rem] text-ink-3">
                {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(
                  new Date(),
                )}
              </p>
            </div>

            {tugas.length === 0 ? (
              <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-aman-ink bg-aman-soft rounded-md px-3.5 py-3">
                <IkonCentangLingkaran size={18} />
                Semua aman hari ini.
              </p>
            ) : (
              <div className="space-y-3">
                {tugas.map((t) => (
                  <div key={t.kunci}>{t.elemen}</div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Pesanan berjalan */}
          <section aria-labelledby="judul-pesanan-berjalan">
            <JudulBagian
              judul="Pesanan Berjalan"
              keterangan={berjalan.length === 0 ? undefined : `${berjalan.length} pesanan sedang diproses`}
              aksi={
                berjalan.length > 3 ? (
                  <Link to="/pesanan" className="text-[0.8125rem] font-bold text-brand hover:underline">
                    Lihat semua
                  </Link>
                ) : undefined
              }
            />
            {berjalan.length === 0 ? (
              <Kartu padat>
                <p className="text-[0.875rem] text-ink-3">
                  Belum ada pesanan yang sedang berjalan.{' '}
                  <Link to="/belanja" className="font-semibold text-brand hover:underline">
                    Cari barang di Belanja
                  </Link>
                  .
                </p>
              </Kartu>
            ) : (
              <div className="space-y-2.5">
                {berjalan.slice(0, 3).map((p) => (
                  <KartuPesanan key={p.id} pesanan={p} />
                ))}
              </div>
            )}
          </section>

          {/* 6. Pita belanja yang belum dikirim */}
          {isiKeranjang > 0 && (
            <Link
              to="/keranjang"
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-md bg-brand-soft text-brand-soft-ink text-[0.875rem] font-semibold hover:brightness-97"
            >
              <IkonKeranjang size={18} className="shrink-0" />
              <span className="grow">Belanja belum dikirim: {isiKeranjang} barang</span>
              <span className="underline underline-offset-2 shrink-0">Lanjutkan</span>
            </Link>
          )}
        </div>

        {/* Kolom kanan di desktop: perkiraan dan kontrak */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 mt-6 lg:mt-0">
          {/* 5. Perkiraan kebutuhan */}
          <section aria-labelledby="judul-perkiraan">
            <JudulBagian
              judul="Perkiraan Kebutuhan Minggu Depan"
              keterangan="Perkiraan bisa meleset. Angka di bawah adalah saran, bukan jaminan."
            />

            {!perkiraanSiap ? (
              <div className="space-y-3">
                <Kerangka className="h-5 w-3/5" />
                <Kerangka className="h-20 w-full rounded-md" />
              </div>
            ) : (
              <>
                {barangPerkiraan.length > 0 && barangPerkiraan[0].hari < 900 && (
                  <p className="text-[1rem] font-semibold text-ink mb-3 leading-snug">
                    {barangPerkiraan[0].b.nama} diperkirakan habis{' '}
                    <span className="text-menipis-ink">{hariLagi(barangPerkiraan[0].hari)}</span>.
                  </p>
                )}

                <div className="space-y-2.5">
                  {barangPerkiraan.map(({ b }) => {
                    const p = perkiraanUntuk(b)
                    const deret = trenBarang(b.id)
                      .filter((t) => t.aktual != null)
                      .slice(-12)
                      .map((t) => t.aktual as number)
                    return (
                      <Link
                        key={b.id}
                        to={`/stok/${b.id}`}
                        className="flex items-center gap-3 bg-surface border border-line rounded-md px-3.5 py-3 hover:border-line-strong transition-colors"
                      >
                        <div className="min-w-0 grow">
                          <p className="text-[0.9375rem] font-semibold text-ink truncate">{b.nama}</p>
                          <p className="text-[0.8125rem] text-ink-3">
                            {p.kematangan === 'belum-bisa'
                              ? `Data terkumpul ${b.hariDataTerkumpul} dari 14 hari`
                              : `Cukup ±${p.hariCukup} hari · saran beli ${angka(p.saranBeli)} ${p.satuanSaran}`}
                          </p>
                        </div>
                        <Percikan data={deret} label={`Tren pemakaian ${b.nama}`} />
                      </Link>
                    )
                  })}
                </div>

                {/* Grafik garis penuh hanya di layar lebar. Di HP ia mahal
                    dirender dan paling sedikit dipakai untuk mengambil keputusan. */}
                {barangGrafik && tren.length > 0 && (
                  <Kartu className="mt-4 hidden lg:block">
                    <JudulBagian
                      judul={`Tren pemakaian ${barangGrafik.nama}`}
                      keterangan="14 hari terakhir dan 7 hari ke depan"
                      aksi={
                        <Link
                          to={`/stok/${barangGrafik.id}`}
                          className="text-[0.8125rem] font-bold text-brand hover:underline"
                        >
                          Buka detail
                        </Link>
                      }
                    />
                    <GrafikTren data={tren} satuan={barangGrafik.satuan} />
                  </Kartu>
                )}
              </>
            )}
          </section>

          {/* Ringkasan kontrak: cermin dari tab Pesanan, bukan data baru */}
          {kontrak.length > 0 && (
            <section aria-labelledby="judul-kontrak" className="hidden lg:block">
              <JudulBagian
                judul="Kuota Kontrak Bulan Ini"
                keterangan={`${kontrak.length} kontrak berjalan. Setiap barang punya kontrak sendiri.`}
                aksi={
                  <Link to="/pesanan?tab=kontrak" className="text-[0.8125rem] font-bold text-brand hover:underline">
                    Lihat semua
                  </Link>
                }
              />
              <div className="grid sm:grid-cols-2 gap-3">
                {kontrak.slice(0, 4).map((k) => (
                  <Kartu key={k.id} padat>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link
                        to={`/kontrak/${k.id}`}
                        className="text-[0.9375rem] font-bold text-ink hover:text-brand transition-colors truncate"
                      >
                        {k.namaBarang}
                      </Link>
                    </div>
                    <KuotaBulanIni kontrak={k} ringkas />
                  </Kartu>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Jalan keluar yang selalu ada, supaya Beranda tidak pernah jadi buntu */}
      <div className="mt-8 flex flex-wrap gap-2.5">
        <TombolTautan ke="/stok?filter=menipis" ragam="garis" ukuran="kecil" ikonKiri={<IkonPeringatan size={15} />}>
          Lihat semua stok menipis
        </TombolTautan>
        <TombolTautan ke="/belanja" ragam="garis" ukuran="kecil">
          Cari barang di Belanja
        </TombolTautan>
        {profil.tier === 'dasar' && (
          <TombolTautan ke="/akun/langganan" ragam="sunyi" ukuran="kecil">
            Lihat paket langganan
          </TombolTautan>
        )}
      </div>
    </div>
  )
}
