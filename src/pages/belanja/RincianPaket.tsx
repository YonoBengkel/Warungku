import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { BarisData, Kartu, Lencana, Pemisah, TombolTautan } from '@/components/ui/dasar'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { IkonKontrak, IkonPanahBawah, IkonToko } from '@/icons'
import { angka, rupiah, tanggalPanjang } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import type { Penawaran } from '@/lib/types'
import { distributorById, paketById, penawaranById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Rincian satu paket kontrak. Layar penuh, bukan jendela kecil.
 *
 * Alasannya sederhana: angka yang ditampilkan di sini adalah total uang yang
 * wajib dibelanjakan sampai beberapa bulan ke depan. Jendela kecil mengajari
 * orang menutupnya cepat-cepat; layar penuh memaksa angkanya dibaca, dan
 * tombol "Lanjut Tinjau" tetap satu-satunya jalan maju.
 *
 * Isi kedua akordeon tidak pernah dikarang antarmuka. Kalau distributor belum
 * mengisi ketentuannya, yang tampil adalah pengakuan bahwa ketentuannya memang
 * belum ada - bukan kalimat penenang buatan sendiri.
 */

/* Desimal mengikuti angkanya, bukan besarannya. Aturan lama menulis pemakaian
   23,4 sebagai "23" tapi selisihnya sebagai "6,6" — pembaca melihat 30 - 23
   menghasilkan 6,6 dan menyangka layarnya salah hitung. */
function fmtJml(n: number): string {
  return angka(n, Number.isInteger(n) ? 0 : 1)
}

function pemakaianDalamSatuanJual(pemakaianHarian: number, penawaran: Penawaran): number {
  const isi = penawaran.kemasanJual?.isi ?? 1
  return Math.round(((pemakaianHarian * 30) / isi) * 10) / 10
}

function Akordeon({ judul, children, terbukaAwal }: { judul: string; children: ReactNode; terbukaAwal?: boolean }) {
  return (
    <details open={terbukaAwal} className="group bg-surface border border-line rounded-lg shadow-e1">
      <summary className="flex items-center gap-3 px-4 min-h-[3.25rem] py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="grow text-[0.9375rem] font-bold text-ink leading-snug">{judul}</span>
        <IkonPanahBawah
          size={18}
          className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4 text-[0.875rem] text-ink-2 leading-relaxed">{children}</div>
    </details>
  )
}

export default function RincianPaket() {
  const { id = '', paket: paketId = '' } = useParams()
  const [params] = useSearchParams()

  const penawaran = penawaranById(id)
  const paket = paketById(paketId)
  const distributor = penawaran ? distributorById(penawaran.distributorId) : undefined

  const daftarBarangGudang = useAplikasi((s) => s.barang)
  const kasir = useAplikasi((s) => s.kasir)
  const barang = daftarBarangGudang.find((b) => b.id === penawaran?.barangIdTerkait)

  /* Angka pemakaian dibawa dari layar pembanding lewat query string. Asalnya ikut
     dicatat: kalau sistem tidak bisa menghitungnya sendiri, angka itu isian
     pengguna dan harus disebut begitu, bukan disamakan dengan data kasir. */
  const { pemakaian, dariKamu } = useMemo(() => {
    const kasirHidup = kasir.sumber === 'kasir-digital' && kasir.status === 'terhubung'
    const sistem =
      penawaran && barang && kasirHidup && barang.terhubungKasir && barang.pemakaianHarian > 0
        ? pemakaianDalamSatuanJual(barang.pemakaianHarian, penawaran)
        : 0
    const dariUrl = Number(params.get('pakai') ?? 0)
    if (dariUrl > 0) return { pemakaian: dariUrl, dariKamu: sistem <= 0 }
    return { pemakaian: sistem, dariKamu: false }
  }, [params, penawaran, barang, kasir])

  if (!penawaran || !paket || !distributor || paket.penawaranId !== penawaran.id) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Rincian Paket Kontrak" kembaliKe={penawaran ? `/penawaran/${id}/kontrak` : '/belanja'} />
        <Kartu className="mt-6">
          <h2 className="sr-only">Paket kontrak tidak ditemukan</h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Paket kontrak ini tidak ada lagi"
            pesan="Distributor mungkin sudah menurunkan paketnya, atau tautannya salah salin. Lihat lagi paket yang masih tersedia untuk barang ini."
            aksi={
              <TombolTautan ke={penawaran ? `/penawaran/${id}/kontrak` : '/belanja'}>
                {penawaran ? 'Lihat paket yang tersedia' : 'Cari barang di Belanja'}
              </TombolTautan>
            }
          />
        </Kartu>
      </div>
    )
  }

  const satuan = penawaran.satuan
  const kuota = paket.kuotaMinPerBulan
  const totalWajib = kuota * paket.durasiBulan
  const kewajibanBulanan = kuota * paket.hargaSatuan
  const totalKomitmen = totalWajib * paket.hargaSatuan
  const hematRupiah = (penawaran.hargaSatuan - paket.hargaSatuan) * totalWajib

  const mulai = new Date()
  const selesai = new Date()
  selesai.setMonth(selesai.getMonth() + paket.durasiBulan)

  const banding =
    pemakaian <= 0
      ? null
      : kuota <= pemakaian * 0.85
        ? { label: 'Aman', nada: 'aman' as const, teks: `Kuota ${fmtJml(kuota)} ${satuan} jauh di bawah pemakaianmu ${fmtJml(pemakaian)} ${satuan} per bulan. Kuota segini biasanya habis sendiri.` }
        : kuota <= pemakaian * 1.02
          ? { label: 'Pas', nada: 'merek' as const, teks: `Kuota ${fmtJml(kuota)} ${satuan} hampir sama dengan pemakaianmu ${fmtJml(pemakaian)} ${satuan} per bulan. Bulan sepi bisa membuatnya kurang sedikit.` }
          : { label: 'Di atas pemakaian', nada: 'menipis' as const, teks: `Kuota ${fmtJml(kuota)} ${satuan} lebih besar dari pemakaianmu ${fmtJml(pemakaian)} ${satuan} per bulan. Selisih ${fmtJml(kuota - pemakaian)} ${satuan} tiap bulan tetap wajib kamu ambil.` }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Rincian Paket Kontrak"
        keterangan={`${paket.kode} · ${penawaran.nama} · ${distributor.nama}`}
        kembaliKe={`/penawaran/${id}/kontrak${pemakaian > 0 ? `?pakai=${pemakaian}` : ''}`}
      />

      <div className="mt-4 space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Total komitmen: satu-satunya angka besar di layar ini */}
          <div className="rounded-lg border border-brand/40 bg-brand-soft p-5">
            <h2 className="text-[0.875rem] font-bold text-brand-soft-ink uppercase tracking-wide">
              Total Komitmen Kamu
            </h2>
            <p className="mt-1.5 text-[2rem] sm:text-[2.25rem] font-extrabold text-brand-soft-ink leading-none tracking-tight">
              {rupiah(totalKomitmen)}
            </p>
            <p className="mt-2.5 text-[0.9375rem] font-semibold text-brand-soft-ink">
              {fmtJml(kuota)} {satuan} &times; {rupiah(paket.hargaSatuan)} &times; {paket.durasiBulan} bulan
            </p>

            <Pemisah className="my-3.5" />

            <p className="text-[0.9375rem] font-bold text-brand-soft-ink">
              Kewajiban tiap bulan: {rupiah(kewajibanBulanan)}
            </p>
            <p className="mt-1 text-[0.8125rem] text-brand-soft-ink leading-relaxed">
              Yang wajib kamu ambil selama kontrak {fmtJml(totalWajib)} {satuan}. Angka ini belum termasuk ongkos
              kirim, dan {BANTUAN.bayarLuar.toLowerCase()}
            </p>
          </div>

          {/* 2. Dibanding pemakaian kamu */}
          <Kartu>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[0.9375rem] font-bold text-ink">Dibanding pemakaian kamu</h2>
              {banding ? (
                <Lencana nada={banding.nada} besar>
                  {banding.label}
                </Lencana>
              ) : (
                <Lencana nada="netral" besar>
                  Belum bisa dibandingkan
                </Lencana>
              )}
            </div>
            {banding ? (
              <>
                <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">{banding.teks}</p>
                <p className="mt-1.5 text-[0.75rem] text-ink-3 leading-relaxed">
                  {dariKamu
                    ? 'Angka pemakaian di atas adalah perkiraan yang kamu isi sendiri di layar sebelumnya, bukan hitungan dari data kasir.'
                    : 'Angka pemakaian di atas dihitung dari data kasir tiga bulan terakhir.'}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed">
                Kami belum punya angka pemakaian untuk barang ini, jadi kuota {fmtJml(kuota)} {satuan} per bulan
                belum ada pembandingnya.{' '}
                <Link to={`/penawaran/${id}/kontrak`} className="font-bold text-brand hover:underline">
                  Isi perkiraan pemakaianmu
                </Link>{' '}
                dulu supaya perbandingannya muncul di sini.
              </p>
            )}
          </Kartu>

          {/* 3 & 4. Ketentuan dari distributor, bukan dari antarmuka */}
          <Akordeon judul="Kalau kuota tidak terpenuhi" terbukaAwal>
            {paket.ketentuanKuotaKurang ? (
              <p>{paket.ketentuanKuotaKurang}</p>
            ) : (
              <>
                <p>{BANTUAN.ketentuanKosong}</p>
                <p className="mt-2 text-ink-3">
                  Kalau ini penting buat kamu, tanyakan langsung ke {distributor.nama} sebelum mengajukan kontrak.
                  Kami tidak menuliskan aturan yang tidak mereka cantumkan.
                </p>
              </>
            )}
          </Akordeon>

          <Akordeon judul="Kalau ingin berhenti di tengah jalan">
            {paket.ketentuanBerhenti ? (
              <p>{paket.ketentuanBerhenti}</p>
            ) : (
              <>
                <p>{BANTUAN.ketentuanKosong}</p>
                <p className="mt-2 text-ink-3">
                  Yang pasti: setelah distributor menyetujui pengajuan, kontrak tidak bisa kamu batalkan sendiri
                  lewat aplikasi.
                </p>
              </>
            )}
          </Akordeon>
        </div>

        {/* Ringkasan pendamping */}
        <div className="lg:col-span-5">
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink mb-1">Isi paket {paket.kode}</h2>
            <dl>
              <BarisData label="Barang" nilai={penawaran.nama} />
              <BarisData label="Distributor" nilai={distributor.nama} />
              <BarisData label="Durasi" nilai={`${paket.durasiBulan} bulan`} />
              <BarisData label="Mulai" nilai={tanggalPanjang(mulai)} />
              <BarisData label="Berakhir" nilai={tanggalPanjang(selesai)} />
              <BarisData label="Minimal ambil per bulan" nilai={`${fmtJml(kuota)} ${satuan}`} />
              <BarisData label="Total wajib diambil" nilai={`${fmtJml(totalWajib)} ${satuan}`} tebal />
              <BarisData label="Harga kontrak" nilai={`${rupiah(paket.hargaSatuan)}/${satuan}`} />
              <BarisData label="Harga beli sekali" nilai={`${rupiah(penawaran.hargaSatuan)}/${satuan}`} />
              <BarisData
                label="Selisihnya selama kontrak"
                nilai={hematRupiah > 0 ? `hemat ${rupiah(hematRupiah)}` : 'tidak ada selisih'}
                nada={hematRupiah > 0 ? 'aman' : 'biasa'}
                tebal
              />
            </dl>
            <p className="mt-2.5 text-[0.75rem] text-ink-3 leading-relaxed">
              Hemat itu baru nyata kalau seluruh kuota benar-benar kamu ambil. Kalau tidak, yang tersisa justru
              kewajiban.
            </p>

            <Pemisah className="my-3.5" />

            <Link
              to={`/penawaran/${id}/kontrak${pemakaian > 0 ? `?pakai=${pemakaian}` : ''}`}
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-brand hover:underline"
            >
              <IkonKontrak size={15} />
              Bandingkan lagi dengan paket lain
            </Link>
          </Kartu>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.8125rem] text-ink-3">Total komitmen {paket.durasiBulan} bulan</span>
            <span className="text-[1.125rem] font-extrabold text-ink tabular">{rupiah(totalKomitmen)}</span>
          </div>
        }
      >
        <TombolTautan
          ke={`/penawaran/${id}/kontrak/${paket.id}/tinjau${pemakaian > 0 ? `?pakai=${pemakaian}` : ''}`}
          penuh
          ukuran="besar"
        >
          Lanjut Tinjau
        </TombolTautan>
      </BilahAksi>
    </div>
  )
}
