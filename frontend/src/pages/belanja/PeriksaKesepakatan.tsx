import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KotakCentang } from '@/components/ui/formulir'
import { Konfirmasi } from '@/components/ui/lembar'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { BilahProgres, KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { TombolTerkunci, useTerkunci } from '@/components/domain'
import { IkonJam, IkonKontrak, IkonPeringatan, IkonSalin, IkonToko } from '@/icons'
import { angka, jam, rupiah, tanggalLengkapHari, tanggalPanjang, tanggalPendek } from '@/lib/format'
import { BANTUAN, LABEL_KONTRAK } from '@/lib/label'
import type { Penawaran } from '@/lib/types'
import { distributorById, paketById, penawaranById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Periksa Kesepakatan: layar terakhir sebelum kontrak diajukan.
 *
 * Tiga kotak centang sengaja dipisah. Satu centang gabungan memang lebih cepat,
 * tapi yang dibuktikan cuma bahwa jarinya bergerak - bukan bahwa ketiga
 * kewajibannya dibaca. Dipisah begini, tiap kalimat harus dilewati sendiri.
 *
 * Yang sengaja TIDAK dipakai: tekan-tahan dan ketik-nama-untuk-konfirmasi.
 * Dua pola itu asing untuk literasi digital menengah, dan kekuatan buktinya
 * tidak lebih besar daripada jejak tersimpan: waktu, akun, dan isi ringkasan.
 *
 * Kontrak yang tumpang tindih TIDAK diblokir. Punya dua kontrak untuk barang
 * yang sama itu sah secara bisnis - yang tidak boleh adalah membiarkannya
 * terjadi tanpa pemilik usaha sadar kewajibannya berlipat.
 */

/* Desimal mengikuti angkanya, bukan besarannya, supaya kuota gabungan dan
   pemakaian yang dibandingkan sebaris tidak ditulis dengan ketelitian berbeda. */
function fmtJml(n: number): string {
  return angka(n, Number.isInteger(n) ? 0 : 1)
}

function pemakaianDalamSatuanJual(pemakaianHarian: number, penawaran: Penawaran): number {
  const isi = penawaran.kemasanJual?.isi ?? 1
  return Math.round(((pemakaianHarian * 30) / isi) * 10) / 10
}

function BarisKuitansi({ label, nilai, bantuan, utama }: { label: string; nilai: string; bantuan?: string; utama?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-ink-3">{label}</p>
        {bantuan && <p className="text-[0.75rem] text-ink-3 mt-0.5 leading-snug">{bantuan}</p>}
      </div>
      <p
        className={
          utama
            ? 'shrink-0 text-right text-[1.25rem] font-extrabold text-ink leading-tight'
            : 'shrink-0 text-right text-[1rem] font-bold text-ink leading-tight'
        }
      >
        {nilai}
      </p>
    </div>
  )
}

export default function PeriksaKesepakatan() {
  const { id = '', paket: paketId = '' } = useParams()
  const [params] = useSearchParams()
  const terkunci = useTerkunci()

  const penawaran = penawaranById(id)
  const paketKontrak = useAplikasi((s) => s.paketKontrak)
  const paket = paketById(paketId, paketKontrak)
  const distributor = penawaran ? distributorById(penawaran.distributorId) : undefined

  const daftarBarangGudang = useAplikasi((s) => s.barang)
  const daftarKontrak = useAplikasi((s) => s.kontrak)
  const kasir = useAplikasi((s) => s.kasir)
  const profil = useAplikasi((s) => s.profil)
  const ajukanKontrak = useAplikasi((s) => s.ajukanKontrak)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const barang = daftarBarangGudang.find((b) => b.id === penawaran?.barangIdTerkait)

  /* Sama seperti layar sebelumnya: asal angka ikut dibawa, karena perkiraan yang
     diisi sendiri tidak boleh terbaca seolah-olah hitungan dari data kasir. */
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

  /* Dibaca dari penyimpanan aplikasi, bukan berkas contoh, supaya kontrak yang
     baru saja berubah ikut terhitung saat memperingatkan tumpang tindih. */
  const kontrakBerjalan = useMemo(
    () =>
      barang
        ? daftarKontrak.filter(
            (k) => k.barangId === barang.id && (k.status === 'aktif' || k.status === 'akan-berakhir'),
          )
        : [],
    [barang, daftarKontrak],
  )

  const [centang1, setCentang1] = useState(false)
  const [centang2, setCentang2] = useState(false)
  const [centang3, setCentang3] = useState(false)
  const [centang4, setCentang4] = useState(false)
  const [diajukanPada, setDiajukanPada] = useState<Date | null>(null)
  const [konfirmasiBatal, setKonfirmasiBatal] = useState(false)

  if (!penawaran || !paket || !distributor || paket.penawaranId !== penawaran.id) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Periksa Kesepakatan" kembaliKe={penawaran ? `/penawaran/${id}/kontrak` : '/belanja'} />
        <Kartu className="mt-6">
          <h2 className="sr-only">Paket kontrak tidak ditemukan</h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Paket kontrak ini tidak ada lagi"
            pesan="Tidak ada yang bisa ditinjau karena paketnya sudah tidak tersedia. Lihat lagi paket yang masih dipasang distributor untuk barang ini."
            aksi={
              <TombolTautan ke={penawaran ? `/penawaran/${id}/kontrak` : '/belanja'}>
                {penawaran ? 'Lihat paket yang tersedia' : 'Cari barang di Distributor'}
              </TombolTautan>
            }
          />
        </Kartu>
      </div>
    )
  }

  const satuan = penawaran.satuan
  const kuota = paket.kuotaMinPerBulan
  const idPaket = paket.id
  const totalWajib = kuota * paket.durasiBulan
  const totalKomitmen = totalWajib * paket.hargaSatuan

  const selesai = new Date()
  selesai.setMonth(selesai.getMonth() + paket.durasiBulan)

  const adaTumpangTindih = kontrakBerjalan.length > 0
  const kuotaSekarang = kontrakBerjalan.reduce((a, k) => a + k.kuotaMinPerBulan, 0)
  const kuotaGabungan = kuotaSekarang + kuota
  const skalaBanding = Math.max(kuotaGabungan, pemakaian, 1)

  const wajibDicentang = adaTumpangTindih ? 4 : 3
  const sudahDicentang =
    [centang1, centang2, centang3].filter(Boolean).length + (adaTumpangTindih && centang4 ? 1 : 0)
  const semuaTercentang = sudahDicentang === wajibDicentang

  const ringkasanTeks = [
    'Ringkasan pengajuan kontrak',
    `Barang: ${penawaran.nama}`,
    `Distributor: ${distributor.nama} (${distributor.kota})`,
    `Paket: ${paket.kode} - ${paket.durasiBulan} bulan, sampai ${tanggalPanjang(selesai)}`,
    `Minimal ambil per bulan: ${fmtJml(kuota)} ${satuan}`,
    `Total wajib diambil: ${fmtJml(totalWajib)} ${satuan}`,
    `Harga kontrak: ${rupiah(paket.hargaSatuan)}/${satuan}`,
    `Total komitmen: ${rupiah(totalKomitmen)}`,
    `Diajukan oleh: ${profil.namaUsaha} (${profil.namaPemilik})`,
  ].join('\n')

  function ajukan() {
    ajukanKontrak(idPaket)
    setDiajukanPada(new Date())
    window.scrollTo(0, 0)
  }

  async function salinRingkasan() {
    try {
      await navigator.clipboard.writeText(ringkasanTeks)
      tampilkanRacun('Ringkasan tersalin. Tinggal tempel di WhatsApp atau surel.', 'aman')
    } catch {
      /* Sebelum diajukan belum ada riwayat apa pun, jadi jangan menjanjikan
         salinan tersimpan. Yang bisa dijanjikan cuma teksnya masih di layar. */
      tampilkanRacun(
        'Peramban ini belum mengizinkan penyalinan otomatis. Blok sendiri teks ringkasan di layar, lalu salin.',
        'menipis',
      )
    }
  }

  function batalkanPengajuan() {
    setDiajukanPada(null)
    setCentang1(false)
    setCentang2(false)
    setCentang3(false)
    setCentang4(false)
    tampilkanRacun('Pengajuan kontrak dibatalkan. Tidak ada yang terkirim ke distributor.', 'menipis')
  }

  /* ---------------- Keadaan sesudah diajukan ---------------- */
  if (diajukanPada) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Pengajuan Kontrak" keterangan={penawaran.nama} kembaliKe="/pesanan?tab=kontrak" />

        <div className="mt-4 max-w-2xl mx-auto space-y-4">
          <Kartu>
            <div className="flex items-start gap-3">
              <span className="shrink-0 size-10 rounded-md bg-menipis-soft text-menipis-ink grid place-items-center">
                <IkonJam size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.0625rem] font-extrabold text-ink leading-snug">
                  {LABEL_KONTRAK['menunggu-persetujuan']}
                </h2>
                <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">
                  Pengajuan kamu sudah sampai ke {distributor.nama}. Kontrak belum berjalan dan belum ada kewajiban
                  apa pun sampai mereka menyetujuinya.
                </p>
              </div>
            </div>

            <Pemisah className="my-4" />

            <dl className="space-y-2.5 text-[0.875rem]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Diajukan</dt>
                <dd className="text-right font-semibold text-ink">
                  {tanggalLengkapHari(diajukanPada)} pukul {jam(diajukanPada)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Atas nama</dt>
                <dd className="text-right font-semibold text-ink">
                  {profil.namaUsaha} &middot; {profil.namaPemilik}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Total komitmen</dt>
                <dd className="text-right font-extrabold text-ink">{rupiah(totalKomitmen)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-[0.75rem] text-ink-3 leading-relaxed">
              Waktu, akun, dan isi ringkasan di atas tersimpan sebagai bukti pengajuan. Kamu bisa menyalinnya untuk
              disimpan sendiri.
            </p>
          </Kartu>

          {/* Kalimat yang tidak boleh dilunakkan */}
          <Peringatan nada="menipis" judul="Ini satu-satunya kesempatan membatalkan">
            Setelah distributor menyetujui, kontrak tidak bisa dibatalkan sendiri. Selama masih menunggu, kamu
            masih boleh menariknya kembali tanpa alasan apa pun.
          </Peringatan>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Tombol ragam="garis" penuh ikonKiri={<IkonSalin size={16} />} onClick={salinRingkasan}>
              Salin ringkasan
            </Tombol>
            <Tombol ragam="garis" penuh onClick={() => setKonfirmasiBatal(true)}>
              Batalkan pengajuan
            </Tombol>
          </div>

          <TombolTautan ke="/pesanan?tab=kontrak" penuh ukuran="besar">
            Lihat daftar kontrak
          </TombolTautan>

          <p className="text-center text-[0.8125rem] text-ink-3">
            <Link to="/belanja" className="font-semibold text-brand hover:underline">
              Kembali belanja
            </Link>
          </p>
        </div>

        <Konfirmasi
          terbuka={konfirmasiBatal}
          tutup={() => setKonfirmasiBatal(false)}
          judul="Batalkan pengajuan kontrak?"
          pesan={`Pengajuan ${paket.kode} untuk ${penawaran.nama} akan ditarik dari ${distributor.nama}. Tidak ada kewajiban yang tertinggal, dan kamu bisa mengajukan lagi kapan saja.`}
          labelSetuju="Ya, batalkan"
          labelBatal="Biarkan menunggu"
          ragamSetuju="bahaya"
          onSetuju={batalkanPengajuan}
        />
      </div>
    )
  }

  /* ---------------- Keadaan sebelum diajukan ---------------- */
  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Periksa Kesepakatan"
        keterangan={`${paket.kode} · ${penawaran.nama}`}
        kembaliKe={`/penawaran/${id}/kontrak/${paket.id}${pemakaian > 0 ? `?pakai=${pemakaian}` : ''}`}
      />

      <div className="mt-4 max-w-2xl mx-auto space-y-4">
        {/* Ringkasan gaya kuitansi */}
        <Kartu>
          <h2 className="text-[0.9375rem] font-bold text-ink">Isi kesepakatan</h2>
          <div className="mt-1 divide-y divide-line">
            <BarisKuitansi label="Barang" nilai={penawaran.nama} bantuan={BANTUAN.satuKontrakSatuBarang} />
            <BarisKuitansi label="Distributor" nilai={distributor.nama} bantuan={distributor.kota} />
            <BarisKuitansi
              label="Lama kontrak"
              nilai={`${paket.durasiBulan} bulan`}
              bantuan={`Sampai ${tanggalPanjang(selesai)}`}
            />
            <BarisKuitansi label="Minimal ambil tiap bulan" nilai={`${fmtJml(kuota)} ${satuan}`} />
            <BarisKuitansi
              label="Total wajib diambil selama kontrak"
              nilai={`${fmtJml(totalWajib)} ${satuan}`}
              bantuan={`${rupiah(paket.hargaSatuan)} per ${satuan}`}
            />
            {/* Total komitmen diulang di sini, bukan cuma di layar sebelumnya */}
            <BarisKuitansi
              label="Total Komitmen Kamu"
              nilai={rupiah(totalKomitmen)}
              bantuan={`${fmtJml(kuota)} ${satuan} x ${rupiah(paket.hargaSatuan)} x ${paket.durasiBulan} bulan`}
              utama
            />
          </div>
          <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">
            Angka di atas belum termasuk ongkos kirim. {BANTUAN.bayarLuarPanjang}
          </p>
        </Kartu>

        {/* Kartu kuning: kontrak yang sudah berjalan untuk barang yang sama */}
        {adaTumpangTindih && (
          <div className="rounded-lg border border-menipis/40 bg-menipis-soft p-4">
            <div className="flex items-start gap-3">
              <IkonPeringatan size={20} className="shrink-0 text-menipis-ink mt-px" />
              <div className="min-w-0 grow">
                <h2 className="text-[0.9375rem] font-extrabold text-menipis-ink leading-snug">
                  Kamu sudah punya kontrak untuk {penawaran.nama}
                </h2>
                <p className="mt-1 text-[0.8125rem] text-menipis-ink leading-relaxed">
                  Ini tidak dilarang. Banyak usaha sengaja memakai dua pemasok untuk barang yang sama. Yang perlu
                  kamu pastikan cuma satu: kewajiban keduanya berjalan bersamaan.
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {kontrakBerjalan.map((k) => {
                const d = distributorById(k.distributorId)
                return (
                  <li key={k.id} className="bg-surface border border-line rounded-md px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.875rem] font-bold text-ink truncate">{d?.nama}</p>
                        <p className="text-[0.75rem] text-ink-3">
                          Minimal {fmtJml(k.kuotaMinPerBulan)} {k.satuan}/bulan &middot; berakhir{' '}
                          {tanggalPendek(k.berakhir)}
                        </p>
                      </div>
                      <Link
                        to={`/kontrak/${k.id}`}
                        className="shrink-0 text-[0.8125rem] font-bold text-brand hover:underline"
                      >
                        Lihat
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>

            <p className="mt-3 text-[0.875rem] font-semibold text-menipis-ink leading-relaxed">
              Sekarang {fmtJml(kuotaSekarang)} {satuan}/bulan, kalau kontrak ini jalan jadi{' '}
              {fmtJml(kuotaGabungan)} {satuan}/bulan.{' '}
              {pemakaian > 0
                ? `Pemakaianmu sekitar ${fmtJml(pemakaian)} ${satuan}/bulan${dariKamu ? ' (perkiraan yang kamu isi sendiri)' : ''}.`
                : 'Pemakaianmu belum bisa kami hitung, jadi bandingkan sendiri dengan kenyataan warungmu.'}
            </p>

            <div className="mt-3 space-y-2.5 bg-surface rounded-md p-3.5">
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-[0.8125rem] text-ink-2 font-medium">Kewajiban kalau kontrak ini jalan</span>
                  <span className="text-[0.8125rem] font-bold text-ink tabular">
                    {fmtJml(kuotaGabungan)} {satuan}/bulan
                  </span>
                </div>
                <BilahProgres
                  nilai={kuotaGabungan}
                  maks={skalaBanding}
                  nada={pemakaian > 0 && kuotaGabungan > pemakaian ? 'menipis' : 'merek'}
                  tinggi={12}
                  label="Kewajiban per bulan kalau kontrak ini jalan"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-[0.8125rem] text-ink-2 font-medium">Pemakaianmu per bulan</span>
                  <span className="text-[0.8125rem] font-bold text-ink tabular">
                    {pemakaian > 0 ? `${fmtJml(pemakaian)} ${satuan}/bulan` : 'belum terhitung'}
                  </span>
                </div>
                <BilahProgres
                  nilai={pemakaian}
                  maks={skalaBanding}
                  nada="aman"
                  tinggi={12}
                  label="Pemakaianmu per bulan"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tiga (atau empat) kotak centang terpisah */}
        <Kartu>
          <h2 className="text-[0.9375rem] font-bold text-ink">Yang kamu setujui</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
            Centang satu per satu. Tiap baris adalah kewajiban yang berbeda, jadi tidak kami gabung jadi satu.
          </p>

          <div className="mt-3 space-y-3">
            <KotakCentang dicentang={centang1} ubah={setCentang1}>
              Saya wajib mengambil minimal{' '}
              <strong className="text-ink">
                {fmtJml(kuota)} {satuan}
              </strong>{' '}
              setiap bulan.
            </KotakCentang>
            <KotakCentang dicentang={centang2} ubah={setCentang2}>
              Kontrak ini berjalan{' '}
              <strong className="text-ink">{paket.durasiBulan} bulan</strong> sampai{' '}
              <strong className="text-ink">{tanggalPendek(selesai)}</strong> dan tidak bisa saya batalkan sendiri
              di tengah jalan.
            </KotakCentang>
            <KotakCentang dicentang={centang3} ubah={setCentang3}>
              Total yang wajib saya ambil selama kontrak{' '}
              <strong className="text-ink">
                {fmtJml(totalWajib)} {satuan}
              </strong>
              , senilai <strong className="text-ink">{rupiah(totalKomitmen)}</strong>.
            </KotakCentang>
            {adaTumpangTindih && (
              <KotakCentang dicentang={centang4} ubah={setCentang4}>
                Saya tahu saya sudah punya kontrak berjalan untuk barang ini, dan kewajiban keduanya berjalan
                bersamaan jadi{' '}
                <strong className="text-ink">
                  {fmtJml(kuotaGabungan)} {satuan}
                </strong>{' '}
                per bulan.
              </KotakCentang>
            )}
          </div>

          {/* Penghitung saja. Alasan tombol masih mati ditulis sekali, di dekat
              tombolnya, bukan dua kali di layar yang sama. */}
          <p className="mt-3 text-[0.8125rem] text-ink-2 font-medium leading-snug" aria-live="polite">
            {semuaTercentang
              ? `Semua ${wajibDicentang} kewajiban sudah kamu centang.`
              : `Sudah kamu centang ${sudahDicentang} dari ${wajibDicentang} kewajiban.`}
          </p>

          <Pemisah className="my-3.5" />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Tombol ragam="sunyi" ukuran="kecil" ikonKiri={<IkonSalin size={15} />} onClick={salinRingkasan}>
              Salin ringkasan ini
            </Tombol>
            <p className="text-[0.75rem] text-ink-3 leading-relaxed">
              Waktu, akun, dan isi ringkasan tersimpan otomatis sebagai bukti pengajuan.
            </p>
          </div>
        </Kartu>

        <p className="text-[0.8125rem] text-ink-3 leading-relaxed px-1">
          Mengajukan belum berarti terikat. Kontrak baru berjalan setelah {distributor.nama} menyetujui, dan
          sebelum itu kamu masih bisa membatalkan pengajuannya.
        </p>

        {/* Status yang akan terbentuk ditulis sebelum tombol, bukan sesudahnya,
            supaya tidak tertutup bilah aksi yang menempel di bawah layar. */}
        <div className="flex justify-center">
          <Lencana nada="netral" besar>
            Status setelah diajukan: {LABEL_KONTRAK['menunggu-persetujuan']}
          </Lencana>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.8125rem] text-ink-3">
              Total komitmen {paket.durasiBulan} bulan &middot; {fmtJml(totalWajib)} {satuan}
            </span>
            <span className="text-[1.125rem] font-extrabold text-ink tabular">{rupiah(totalKomitmen)}</span>
          </div>
        }
      >
        {terkunci ? (
          <TombolTerkunci label="Ajukan Kontrak" penuh />
        ) : (
          <div>
            <Tombol
              penuh
              ukuran="besar"
              disabled={!semuaTercentang}
              onClick={ajukan}
              ikonKiri={<IkonKontrak size={18} />}
            >
              Ajukan Kontrak
            </Tombol>
            {!semuaTercentang && (
              <p className="mt-2 text-center text-[0.75rem] text-ink-3">
                Masih ada {wajibDicentang - sudahDicentang} kotak persetujuan di atas yang belum kamu centang.
              </p>
            )}
          </div>
        )}
      </BilahAksi>
    </div>
  )
}
