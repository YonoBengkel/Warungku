import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { KuotaBulanIni, TombolTerkunci, useTerkunci } from '@/components/domain'
import { Avatar, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { KepalaHalaman, TabSegmen } from '@/components/ui/navigasi'
import { Konfirmasi } from '@/components/ui/lembar'
import {
  IkonCentangLingkaran,
  IkonInfo,
  IkonJam,
  IkonKeranjang,
  IkonKontrak,
  IkonPetir,
  IkonSalin,
} from '@/icons'
import { angka, jam, jumlahSatuan, rupiah, tanggalPanjang, tanggalPendek, waktuNanti } from '@/lib/format'
import { BANTUAN, LABEL_KONTRAK } from '@/lib/label'
import { distributorById, penawaranById, sisaHariPeriode } from '@/data/dummy'
import type { Barang, Kontrak } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Rincian satu kontrak. Satu kontrak mengikat tepat satu barang.
 *
 * Ini satu-satunya tempat konsekuensi kuota kurang ditulis, dan teksnya datang
 * dari kolom data yang diisi distributor — bukan dikarang antarmuka. Kalau
 * kolomnya kosong, yang tampil adalah pengakuan jujur bahwa ketentuannya belum
 * dicantumkan, bukan ancaman umum yang belum tentu berlaku.
 */

type Segmen = 'ringkasan' | 'riwayat' | 'dokumen'

function namaPeriode(periode: string): string {
  const [tahun, bulan] = periode.split('-')
  const d = new Date(Number(tahun), Number(bulan) - 1, 1)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d)
}

/**
 * Terjemahan angka kontrak ke bahasa gudang: "20 kg" jadi "1 karung lagi".
 * Kalau kemasan belinya bernama sama dengan satuan kontrak, kita turun ke
 * satuan pakai barangnya daripada mengulang angka yang sama.
 */
function konversiAwam(kontrak: Kontrak, barang: Barang | undefined, jumlah: number): string | null {
  if (!barang || jumlah <= 0) return null
  const isi = penawaranById(kontrak.penawaranId)?.kemasanJual?.isi ?? 1
  const totalSatuanPakai = jumlah * isi
  const kandidat = barang.kemasan
    .filter((k) => k.nama !== kontrak.satuan && k.isi > 1)
    .sort((a, b) => b.isi - a.isi)
    .find((k) => totalSatuanPakai / k.isi >= 1)

  if (kandidat) {
    return `${jumlahSatuan(jumlah, kontrak.satuan)} = ${angka(totalSatuanPakai / kandidat.isi, 1)} ${kandidat.nama} lagi`
  }
  if (barang.satuan === kontrak.satuan || isi <= 1) return null
  return `${jumlahSatuan(jumlah, kontrak.satuan)} = ${jumlahSatuan(totalSatuanPakai, barang.satuan)}`
}

export default function KontrakDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const terkunci = useTerkunci()

  const kontrak = useAplikasi((s) => s.kontrak.find((k) => k.id === id))
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === kontrak?.barangId))
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [dialogHenti, setDialogHenti] = useState(false)
  /* Penghentian tidak pernah berlaku seketika, jadi layar hanya boleh berubah
     jadi "menunggu jawaban" — bukan mengubah status kontrak di penyimpanan. */
  const [pengajuanHenti, setPengajuanHenti] = useState(false)

  const tabMentah = params.get('tab')
  const tab: Segmen = tabMentah === 'riwayat' || tabMentah === 'dokumen' ? tabMentah : 'ringkasan'

  if (!kontrak) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Kontrak" kembaliKe="/pesanan?tab=kontrak" />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Kontrak tidak ditemukan
          </h2>
          <KeadaanKosong
            ikon={<IkonKontrak size={26} />}
            judul="Kontrak ini sudah tidak ada"
            pesan="Mungkin kontraknya sudah berakhir atau tautannya sudah lama. Semua kontrak berjalan ada di tab Pesanan."
            aksi={<TombolTautan ke="/pesanan?tab=kontrak">Lihat Kontrak Berjalan</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  const kt = kontrak
  const distributor = distributorById(kontrak.distributorId)
  const kurang = Math.max(0, kontrak.periodeBerjalan.kuota - kontrak.periodeBerjalan.diterima - kontrak.dalamPerjalanan)
  const sisaHari = sisaHariPeriode()
  const konversi = konversiAwam(kontrak, barang, kurang)
  const totalWajib = kontrak.kuotaMinPerBulan * kontrak.durasiBulan
  const nilaiTotal = totalWajib * kontrak.hargaSatuan
  const ketentuan = kontrak.ketentuanKuotaKurang ?? BANTUAN.ketentuanKosong

  function gantiTab(nilai: Segmen) {
    const baru = new URLSearchParams(params)
    baru.set('tab', nilai)
    setParams(baru, { replace: true })
  }

  function pesanKekurangan() {
    if (kurang <= 0) return
    tambahKeKeranjang(kt.distributorId, kt.penawaranId, kurang, kurang, kt.id)
    tampilkanRacun(`${angka(kurang)} ${kt.satuan} ${kt.namaBarang} masuk keranjang.`, 'aman')
    navigate('/keranjang')
  }

  function salinRingkasan() {
    const teks = [
      `Kontrak ${kt.namaBarang} — ${kt.durasiBulan} bulan`,
      `Distributor: ${distributor?.nama ?? '-'}`,
      `Minimal ambil: ${angka(kt.kuotaMinPerBulan)} ${kt.satuan} per bulan`,
      `Harga kontrak: ${rupiah(kt.hargaSatuan)} per ${kt.satuan}`,
      `Berjalan: ${tanggalPanjang(kt.mulai)} sampai ${tanggalPanjang(kt.berakhir)}`,
      `Total wajib selama kontrak: ${angka(totalWajib)} ${kt.satuan} (${rupiah(nilaiTotal)})`,
      `Kalau kuota tidak terpenuhi: ${ketentuan}`,
    ].join('\n')
    navigator.clipboard
      ?.writeText(teks)
      .then(() => tampilkanRacun('Ringkasan kesepakatan disalin. Tinggal tempel di WhatsApp.', 'aman'))
      .catch(() => tampilkanRacun('Penyalinan otomatis tidak jalan di HP ini. Ringkasannya tetap bisa dibaca di layar.', 'info'))
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={kontrak.namaBarang}
        keterangan={`${distributor?.nama ?? 'Distributor'} · kontrak ${kontrak.durasiBulan} bulan`}
        kembaliKe="/pesanan?tab=kontrak"
      />

      {/* Kepala halaman sudah menyebut nama barang dan distributornya, jadi
          baris ini tidak mengulanginya: isinya kota pemasok dan jalan pintas ke
          seluruh kerja sama dengan pemasok yang sama. */}
      <div className="mt-4 flex items-center gap-3">
        <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={44} />
        <div className="min-w-0 grow">
          <Link
            to={`/distributor/${kontrak.distributorId}`}
            className="text-[1.0625rem] font-bold text-ink leading-tight hover:text-brand transition-colors"
          >
            {distributor?.nama}
          </Link>
          <p className="text-[0.8125rem] text-ink-3 truncate">{distributor?.kota}</p>
        </div>
        <Lencana nada={kontrak.status === 'akan-berakhir' ? 'menipis' : 'merek'} besar>
          {LABEL_KONTRAK[kontrak.status]}
        </Lencana>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[0.8125rem] text-ink-3 max-w-[70ch]">{BANTUAN.satuKontrakSatuBarang}</p>
        <Link
          to={`/mitra/${kontrak.distributorId}`}
          className="text-[0.8125rem] font-bold text-brand hover:underline shrink-0"
        >
          Lihat semua kerja sama
        </Link>
      </div>

      <TabSegmen<Segmen>
        className="mt-4"
        aktif={tab}
        ubah={gantiTab}
        tab={[
          { nilai: 'ringkasan', label: 'Ringkasan' },
          { nilai: 'riwayat', label: 'Riwayat Bulanan' },
          { nilai: 'dokumen', label: 'Dokumen' },
        ]}
      />

      {/* ---------------------------------------------------------- */}
      {tab === 'ringkasan' && (
        <div className="mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
          <section aria-labelledby="judul-kuota">
            <Kartu>
              <h2 id="judul-kuota" className="sr-only">
                Kuota bulan ini
              </h2>
              <KuotaBulanIni kontrak={kontrak} />

              {kurang > 0 ? (
                <div className="mt-4 border-t border-line pt-3.5">
                  <p className="text-[1rem] font-bold text-ink">
                    Kurang {angka(kurang)} {kontrak.satuan} &middot; sisa {sisaHari} hari di bulan ini
                  </p>
                  {konversi && <p className="mt-0.5 text-[0.8125rem] text-ink-2">{konversi}</p>}
                  <div className="mt-3">
                    {terkunci ? (
                      <TombolTerkunci label={`Pesan ${angka(kurang)} ${kontrak.satuan}`} penuh />
                    ) : (
                      <Tombol penuh ikonKiri={<IkonKeranjang size={16} />} onClick={pesanKekurangan}>
                        Pesan {angka(kurang)} {kontrak.satuan}
                      </Tombol>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 border-t border-line pt-3.5 flex items-center gap-2 text-[0.9375rem] font-semibold text-aman-ink">
                  <IkonCentangLingkaran size={18} />
                  Kuota bulan ini sudah terpenuhi.
                </p>
              )}
            </Kartu>
          </section>

          <div className="space-y-4">
            <section aria-labelledby="judul-isi">
              <Kartu>
                <h2 id="judul-isi" className="text-[0.9375rem] font-bold text-ink mb-3">
                  Isi kesepakatan
                </h2>
                <div className="space-y-1">
                  <BarisIsi label="Minimal ambil tiap bulan" nilai={`${angka(kontrak.kuotaMinPerBulan)} ${kontrak.satuan}`} />
                  <BarisIsi label="Harga kontrak" nilai={`${rupiah(kontrak.hargaSatuan)} / ${kontrak.satuan}`} />
                  <BarisIsi label="Mulai" nilai={tanggalPendek(kontrak.mulai)} />
                  <BarisIsi
                    label="Berakhir"
                    nilai={`${tanggalPendek(kontrak.berakhir)} (${waktuNanti(kontrak.berakhir)})`}
                  />
                </div>
                <Pemisah className="my-3" />
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
                      Total wajib selama kontrak
                    </p>
                    <p className="mt-1 text-[1.625rem] font-extrabold text-ink leading-none">
                      {angka(totalWajib)} <span className="text-[0.8125rem] font-semibold text-ink-3">{kontrak.satuan}</span>
                    </p>
                  </div>
                  <p className="text-[0.9375rem] font-bold text-ink tabular text-right">{rupiah(nilaiTotal)}</p>
                </div>
                <p className="mt-1 text-[0.75rem] text-ink-3 tabular">
                  {angka(kontrak.kuotaMinPerBulan)} {kontrak.satuan} &times; {kontrak.durasiBulan} bulan
                </p>
              </Kartu>
            </section>

            {/* Satu-satunya tempat konsekuensi ditulis, dan isinya milik distributor. */}
            <section aria-labelledby="judul-ketentuan">
              <h2 id="judul-ketentuan" className="sr-only">
                Ketentuan kuota kurang
              </h2>
              <Peringatan nada={kontrak.ketentuanKuotaKurang ? 'netral' : 'menipis'}>
                <strong className="font-bold">Kalau kuota tidak terpenuhi:</strong> {ketentuan}
              </Peringatan>
            </section>

            <section aria-labelledby="judul-rutin">
              <Kartu padat>
                <h2 id="judul-rutin" className="sr-only">
                  Pesanan rutin
                </h2>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 size-9 rounded-md grid place-items-center bg-brand-soft text-brand-soft-ink">
                    <IkonPetir size={18} />
                  </span>
                  <div className="min-w-0 grow">
                    <p className="text-[0.9375rem] font-bold text-ink leading-snug">
                      Pesanan rutin:{' '}
                      {kontrak.pesananRutinAktif ? (
                        <>
                          aktif, berikutnya{' '}
                          {kontrak.pesananRutinBerikutnya ? tanggalPendek(kontrak.pesananRutinBerikutnya) : 'belum dijadwalkan'}
                        </>
                      ) : (
                        'belum diatur'
                      )}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
                      Sistem cuma menyiapkan draf. Tidak ada pesanan yang terkirim tanpa kamu setujui.
                    </p>
                  </div>
                </div>
                <TombolTautan ke={`/kontrak/${kontrak.id}/rutin`} ragam="garis" ukuran="kecil" className="mt-3">
                  {kontrak.pesananRutinAktif ? 'Atur Pesanan Rutin' : 'Nyalakan Pesanan Rutin'}
                </TombolTautan>
              </Kartu>
            </section>

            {pengajuanHenti ? (
              <Peringatan nada="menipis" judul="Pengajuan penghentian sudah terkirim">
                {distributor?.nama ?? 'Distributor'} akan menjawab lewat pemberitahuan. Sampai ada jawaban, kontrak ini
                tetap berjalan dan kewajiban {angka(kontrak.kuotaMinPerBulan)} {kontrak.satuan} per bulan masih berlaku.
              </Peringatan>
            ) : (
              <Tombol ragam="garis" penuh onClick={() => setDialogHenti(true)}>
                Ajukan Penghentian (perlu persetujuan distributor)
              </Tombol>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {tab === 'riwayat' && (
        <section aria-labelledby="judul-riwayat" className="mt-4">
          <h2 id="judul-riwayat" className="sr-only">
            Riwayat pemenuhan bulanan
          </h2>
          <p className="text-[0.8125rem] text-ink-3 mb-3 max-w-[70ch]">{BANTUAN.kuotaBertambah}</p>
          {/* Tiap bulan adalah kartu setara, jadi di layar lebar ia berjajar
              ketimbang menumpuk jadi satu kolom kurus di kiri. */}
          <div className="space-y-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:space-y-0 lg:items-start">
            <BarisBulan
              periode={kontrak.periodeBerjalan.periode}
              kuota={kontrak.periodeBerjalan.kuota}
              diterima={kontrak.periodeBerjalan.diterima}
              satuan={kontrak.satuan}
              berjalan
            />
            {kontrak.riwayat.length === 0 ? (
              <p className="text-[0.875rem] text-ink-3 bg-sunken rounded-md px-3.5 py-3 leading-relaxed max-w-[70ch]">
                Belum ada bulan yang selesai. Kontrak ini baru mulai {tanggalPendek(kontrak.mulai)}, jadi riwayatnya
                terisi setelah bulan pertama lewat.
              </p>
            ) : (
              kontrak.riwayat
                .slice()
                .reverse()
                .map((r) => (
                  <BarisBulan
                    key={r.periode}
                    periode={r.periode}
                    kuota={r.kuota}
                    diterima={r.diterima}
                    satuan={kontrak.satuan}
                  />
                ))
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- */}
      {tab === 'dokumen' && (
        <section
          aria-labelledby="judul-dokumen"
          className="mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start"
        >
          <h2 id="judul-dokumen" className="sr-only lg:col-span-2">
            Dokumen kontrak
          </h2>
          <Kartu>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-[0.9375rem] font-bold text-ink">Salinan ringkasan kesepakatan</h3>
              <Tombol ragam="garis" ukuran="kecil" ikonKiri={<IkonSalin size={15} />} onClick={salinRingkasan}>
                Salin
              </Tombol>
            </div>
            <div className="space-y-1">
              <BarisIsi label="Barang" nilai={kontrak.namaBarang} />
              <BarisIsi label="Distributor" nilai={distributor?.nama ?? '-'} />
              <BarisIsi label="Lama kontrak" nilai={`${kontrak.durasiBulan} bulan`} />
              <BarisIsi label="Minimal ambil tiap bulan" nilai={`${angka(kontrak.kuotaMinPerBulan)} ${kontrak.satuan}`} />
              <BarisIsi label="Harga kontrak" nilai={`${rupiah(kontrak.hargaSatuan)} / ${kontrak.satuan}`} />
              <BarisIsi label="Total wajib selama kontrak" nilai={`${angka(totalWajib)} ${kontrak.satuan}`} />
              <BarisIsi label="Berlaku" nilai={`${tanggalPanjang(kontrak.mulai)} – ${tanggalPanjang(kontrak.berakhir)}`} />
            </div>
            <p className="mt-3 text-[0.8125rem] text-ink-2 leading-relaxed bg-sunken rounded-md px-3 py-2.5">
              <strong className="font-bold">Kalau kuota tidak terpenuhi:</strong> {ketentuan}
            </p>
          </Kartu>

          <Kartu>
            <h3 className="text-[0.9375rem] font-bold text-ink mb-1">Jejak waktu dan versi teks</h3>
            <p className="text-[0.8125rem] text-ink-3 mb-3 max-w-[70ch]">
              Inilah kekuatan bukti kesepakatan ini: siapa menyetujui, kapan, dan versi teks yang mana.
            </p>
            <ol className="space-y-3">
              <JejakDokumen
                waktu={kontrak.mulai}
                judul="Kesepakatan disetujui kedua pihak"
                detail={`Disetujui dari akun pemilik usaha dan dikonfirmasi ${distributor?.nama ?? 'distributor'}.`}
              />
              <JejakDokumen
                waktu={kontrak.mulai}
                judul="Teks ketentuan versi 1.0 dikunci"
                detail={
                  kontrak.ketentuanKuotaKurang
                    ? 'Ketentuan kuota kurang dicantumkan distributor dan tidak bisa diubah sepihak selama kontrak berjalan.'
                    : 'Distributor belum mencantumkan ketentuan kuota kurang saat kesepakatan dikunci.'
                }
              />
              <JejakDokumen
                waktu={kontrak.berakhir}
                judul="Masa kontrak berakhir"
                detail="Setelah tanggal ini harga kembali ke harga beli sekali, kecuali kamu memperpanjang."
                akanDatang
              />
            </ol>
          </Kartu>
        </section>
      )}

      <Konfirmasi
        terbuka={dialogHenti}
        tutup={() => setDialogHenti(false)}
        judul="Ajukan penghentian kontrak"
        labelSetuju="Kirim Pengajuan"
        labelBatal="Tidak jadi"
        onSetuju={() => {
          setPengajuanHenti(true)
          tampilkanRacun('Pengajuan penghentian terkirim. Kontrak tetap berjalan sampai distributor menjawab.', 'info')
        }}
        pesan={
          <>
            Kontrak {kontrak.namaBarang} berjalan sampai {tanggalPanjang(kontrak.berakhir)} dan tidak bisa dihentikan
            sepihak. Pengajuan ini dikirim ke {distributor?.nama ?? 'distributor'} untuk dijawab.
            <span className="mt-2 block text-[0.875rem] text-ink-3">
              Selama menunggu jawaban, kewajiban {angka(kontrak.kuotaMinPerBulan)} {kontrak.satuan} per bulan masih
              berlaku.
            </span>
          </>
        }
      />
    </div>
  )
}

/* ================================================================== */
/* Potongan khusus halaman ini                                        */
/* ================================================================== */

function BarisIsi({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[0.8125rem] text-ink-3">{label}</span>
      <span className="text-[0.875rem] font-semibold text-ink text-right">{nilai}</span>
    </div>
  )
}

function BarisBulan({
  periode,
  kuota,
  diterima,
  satuan,
  berjalan,
}: {
  periode: string
  kuota: number
  diterima: number
  satuan: string
  berjalan?: boolean
}) {
  const terpenuhi = diterima >= kuota
  return (
    <Kartu padat>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-bold text-ink">{namaPeriode(periode)}</p>
          <p className="text-[0.8125rem] text-ink-3 tabular">
            {angka(diterima)} dari {angka(kuota)} {satuan} diterima
          </p>
        </div>
        <Lencana nada={terpenuhi ? 'aman' : berjalan ? 'menipis' : 'kritis'} ikon={berjalan ? <IkonJam size={13} /> : undefined}>
          {terpenuhi ? 'Terpenuhi' : berjalan ? 'Masih berjalan' : 'Kurang'}
        </Lencana>
      </div>
      <BilahProgres nilai={diterima} maks={kuota} nada={terpenuhi ? 'aman' : 'menipis'} tinggi={6} />
    </Kartu>
  )
}

function JejakDokumen({
  waktu,
  judul,
  detail,
  akanDatang,
}: {
  waktu: string
  judul: string
  detail: string
  akanDatang?: boolean
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`shrink-0 size-8 rounded-md grid place-items-center ${akanDatang ? 'bg-sunken text-ink-3' : 'bg-aman-soft text-aman-ink'}`}
      >
        {akanDatang ? <IkonJam size={16} /> : <IkonInfo size={16} />}
      </span>
      <div className="min-w-0">
        <p className="text-[0.875rem] font-bold text-ink leading-snug">{judul}</p>
        <p className="text-[0.75rem] text-ink-3">
          {tanggalPanjang(waktu)}, {jam(waktu)}
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-relaxed">{detail}</p>
      </div>
    </li>
  )
}
