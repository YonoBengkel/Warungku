import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, BarisData, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { TombolTerkunci, useTerkunci } from '@/components/domain'
import { KALIMAT_PROMO, LencanaPromo } from '@/components/domain/KartuPromo'
import { IkonKeranjang, IkonKontrak, IkonNota } from '@/icons'
import { angka, hariLagi, rupiah } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import {
  distributorById,
  hargaBerlaku,
  penawaranById,
  perkiraanHematPromo,
  promoUntukPenawaran,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Langkah baca-saja sebelum pesanan benar-benar lahir.
 *
 * Tiga pengaman yang sengaja dipasang di sini:
 * 1. Tidak ada yang bisa diubah di layar ini. Kalau angkanya salah, jalannya
 *    kembali ke keranjang, bukan mengedit di detik terakhir.
 * 2. Tombol kirim TIDAK menempati posisi tombol di langkah sebelumnya. Di
 *    Keranjang tombolnya selebar layar; di sini ia berbagi baris dengan
 *    "Ubah dulu" di kiri, supaya jempol tidak melanjutkan kebiasaan mengetuk.
 * 3. Tombol terkunci 3 detik dan dijaga ref, supaya tekanan ganda tidak pernah
 *    melahirkan pesanan kedua.
 */

const DETIK_KUNCI = 3

export default function KeranjangRingkasan() {
  const navigate = useNavigate()
  const keranjang = useAplikasi((s) => s.keranjang)
  /* Kontrak dibaca dari store: pengajuan yang lahir saat aplikasi berjalan
     tidak pernah ada di data contoh, dan harganya harus ikut terpakai. */
  const kontrakStore = useAplikasi((s) => s.kontrak)
  const daftarBarang = useAplikasi((s) => s.barang)
  const kirimKeranjang = useAplikasi((s) => s.kirimKeranjang)
  const terkunci = useTerkunci()

  const [sisaDetik, setSisaDetik] = useState(DETIK_KUNCI)
  const [mengirim, setMengirim] = useState(false)
  /** Penjaga tekanan ganda: sekali true, tidak pernah kembali false. */
  const sudahKirim = useRef(false)

  useEffect(() => {
    if (sisaDetik <= 0) return
    const t = window.setTimeout(() => setSisaDetik((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [sisaDetik])

  const aktif = keranjang.filter((k) => !k.disimpanUntukNanti && k.baris.length > 0)

  /* Rumus harga lokal dihapus. Layar terakhir sebelum pesanan lahir tidak boleh
     memakai rumusnya sendiri: sebelum ini angka di sini bisa berbeda dari harga
     yang benar-benar tersimpan di pesanan, dan selisihnya baru ketahuan saat
     tagihan distributor datang. `hargaBerlaku` adalah satu-satunya sumber. */
  const totalSemua = aktif.reduce(
    (a, sub) => a + sub.baris.reduce((x, b) => x + hargaBerlaku(b.penawaranId, b.kontrakId, kontrakStore) * b.jumlah, 0),
    0,
  )
  const jumlahBarang = aktif.reduce((a, k) => a + k.baris.length, 0)
  /* Satu sub-keranjang bisa melahirkan LEBIH DARI SATU pesanan: pesanan
     tidak pernah melintasi dua kontrak, jadi baris berkontrak berbeda
     dipecah walau distributornya sama. Hitungannya harus mengikuti aturan
     itu, bukan sekadar menghitung distributor. */
  const jumlahPesanan = aktif.reduce(
    (a, k) => a + new Set(k.baris.map((b) => b.kontrakId ?? '')).size,
    0,
  )
  const jumlahDistributor = aktif.length

  /* Promo dihitung sekali untuk seluruh belanja: kartu total dirender dua kali
     (kolom kanan desktop dan di bawah daftar pada layar sempit) dan keduanya
     wajib berbunyi sama. */
  const barisAktif = aktif.flatMap((s) => s.baris)
  const adaPromo = barisAktif.some((b) => promoUntukPenawaran(b.penawaranId) != null)
  const adaPromoPadaKontrak = barisAktif.some(
    (b) => b.kontrakId != null && promoUntukPenawaran(b.penawaranId) != null,
  )

  function kirim() {
    if (sudahKirim.current) return
    sudahKirim.current = true
    setMengirim(true)
    kirimKeranjang()
    navigate('/keranjang/selesai', { replace: true })
  }

  if (jumlahPesanan === 0) {
    return (
      <>
        <KepalaHalaman judul="Periksa Belanja" kembaliKe="/keranjang" />
        {/* Judul bagian khusus pembaca layar: tanpa ini urutan judul melompat
            dari h1 langsung ke h3 milik kartu keadaan kosong. */}
        <section aria-labelledby="judul-periksa-belanja">
          <h2 id="judul-periksa-belanja" className="sr-only">
            Belanja yang akan dikirim
          </h2>
          <KeadaanKosong
            ikon={<IkonKeranjang size={26} />}
            judul="Tidak ada yang bisa diperiksa"
            pesan="Keranjang kamu kosong atau semua sub-keranjangnya sedang disimpan untuk nanti."
            aksi={<TombolTautan ke="/belanja">Cari Barang di Distributor</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/keranjang" ragam="garis">
                Buka Keranjang
              </TombolTautan>
            }
          />
        </section>
      </>
    )
  }

  /* Kartu total dirender dua kali dengan isi yang sama: menempel di kolom kanan
     desktop, dan menyusul daftar di layar sempit. Isinya satu sumber supaya
     angkanya tidak pernah bisa berbeda antara dua tempat itu. */
  const kartuTotal = (
    <Kartu>
      <div className="flex items-center gap-2 text-ink-3 mb-1">
        <IkonNota size={16} />
        <h2 className="text-[0.75rem] font-semibold uppercase tracking-wide">Total keseluruhan</h2>
      </div>
      <p className="text-[1.625rem] font-extrabold text-ink leading-none tabular">{rupiah(totalSemua)}</p>
      <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">
        Ongkos kirim belum termasuk. Tiap distributor menentukan sendiri dan mencatatnya setelah pesanan
        dikonfirmasi.
      </p>
      {/* Totalnya tetap harga penuh; yang ditambahkan di sini cuma keterangan.
          Menambahkan baris "Hemat" ke rincian total akan terbaca seperti
          potongan yang sudah masuk, padahal distributor belum menyetujuinya. */}
      {adaPromo && (
        <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">{KALIMAT_PROMO.totalTetapPenuh}</p>
      )}
      {adaPromo && adaPromoPadaKontrak && (
        <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">{KALIMAT_PROMO.kontrakTidakIkut}</p>
      )}
      <Pemisah className="my-3" />
      <p className="text-[0.875rem] font-semibold text-ink">{BANTUAN.bayarLuar}</p>
    </Kartu>
  )

  /* Satu pasang tombol, dua tempat tayang. Id keterangan kuncinya dibedakan
     supaya aria-describedby tidak pernah menunjuk dua elemen sekaligus. */
  const aksi = (kunci: string) => (
    <div className="flex gap-2.5">
      <TombolTautan ke="/keranjang" ragam="garis" ukuran="besar" className="shrink-0">
        Ubah dulu
      </TombolTautan>
      {terkunci ? (
        <TombolTerkunci label={`Buat ${jumlahPesanan} Pesanan`} penuh />
      ) : (
        <Tombol
          ukuran="besar"
          penuh
          className="min-w-0"
          memuat={mengirim}
          disabled={sisaDetik > 0 || mengirim}
          aria-describedby={sisaDetik > 0 ? kunci : undefined}
          onClick={kirim}
        >
          Buat {jumlahPesanan} Pesanan
        </Tombol>
      )}
    </div>
  )

  const keteranganKunci = (id: string) =>
    sisaDetik > 0 && !terkunci ? (
      <p id={id} className="text-[0.8125rem] text-ink-3 leading-snug">
        Tombolnya terbuka {sisaDetik} detik lagi &mdash; sengaja, supaya kamu sempat membaca angkanya dulu.
      </p>
    ) : null

  return (
    <div className="pb-4">
      <KepalaHalaman
        judul="Periksa Belanja"
        keterangan="Belum terkirim. Periksa dulu, baru kirim."
        kembaliKe="/keranjang"
      />

      {/* Desktop: rincian per distributor di kiri, total dan tombol kirim di
          kanan yang ikut menggulir. Keduanya perlu terlihat bersamaan justru
          di langkah ini, karena inilah layar terakhir sebelum uang berangkat. */}
      <div className="mx-auto w-full max-w-2xl lg:max-w-none mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          <Peringatan nada="netral" judul="Periksa sekali lagi sebelum dikirim">
            Halaman ini hanya untuk dibaca. Kalau ada jumlah yang perlu diubah, kembali dulu ke keranjang.
          </Peringatan>

          {aktif.map((sub) => {
            const distributor = distributorById(sub.distributorId)
            const hariTiba = Math.max(
              1,
              ...sub.baris.map((b) => {
                const pw = penawaranById(b.penawaranId)
                const brg = daftarBarang.find((x) => x.id === pw?.barangIdTerkait)
                return brg?.hariKirim ?? 2
              }),
            )
            const subtotal = sub.baris.reduce(
              (a, b) => a + hargaBerlaku(b.penawaranId, b.kontrakId, kontrakStore) * b.jumlah,
              0,
            )

            return (
              <Kartu key={sub.distributorId}>
                <div className="flex items-start gap-3">
                  <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={40} />
                  <div className="min-w-0 grow">
                    <h2 className="text-[1rem] font-semibold text-ink truncate">{distributor?.nama}</h2>
                    <p className="text-[0.8125rem] text-ink-3">
                      1 pesanan &middot; perkiraan tiba {hariLagi(hariTiba)}
                    </p>
                  </div>
                </div>

                <Pemisah className="my-3" />

                <div className="space-y-2">
                  {sub.baris.map((b) => {
                    const pw = penawaranById(b.penawaranId)
                    if (!pw) return null
                    const harga = hargaBerlaku(b.penawaranId, b.kontrakId, kontrakStore)
                    /* Promo ditandai juga di layar terakhir ini supaya pemilik
                       usaha tidak baru tahu soal promonya setelah pesanan lahir. */
                    const promo = promoUntukPenawaran(b.penawaranId)
                    const hematSatuan = perkiraanHematPromo(b.penawaranId, b.kontrakId)
                    return (
                      <div key={b.penawaranId} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[0.9375rem] font-semibold text-ink leading-snug">{pw.nama}</h3>
                          <p className="text-[0.8125rem] text-ink-3 tabular">
                            {angka(b.jumlah)} {pw.satuan} &times; {rupiah(harga)}
                          </p>
                          {/* Lencananya sengaja tanpa tautan: layar ini cuma
                              untuk dibaca, jadi tidak boleh ada jalan keluar
                              baru tepat sebelum tombol kirim ditekan. */}
                          {promo && !b.kontrakId && (
                            <span className="mt-1 flex flex-wrap">
                              <LencanaPromo promo={promo} tanpaTautan />
                            </span>
                          )}
                          {hematSatuan != null && (
                            <p className="mt-1 text-[0.75rem] text-ink-3 leading-snug">
                              Hemat <span className="tabular">{rupiah(hematSatuan * b.jumlah)}</span>{' '}
                              &middot; {KALIMAT_PROMO.hematPerkiraan}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[0.9375rem] font-semibold text-ink tabular">
                            {rupiah(harga * b.jumlah)}
                          </p>
                          {b.kontrakId && (
                            <Lencana nada="aman" ikon={<IkonKontrak size={13} />} className="mt-1">
                              Kontrak
                            </Lencana>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Pemisah className="my-3" />
                <BarisData
                  label={`Subtotal ke ${distributor?.nama ?? 'distributor ini'}`}
                  nilai={rupiah(subtotal)}
                  tebal
                />
              </Kartu>
            )
          })}

          <div className="lg:hidden">{kartuTotal}</div>
        </div>

        <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-3">
          {kartuTotal}
          <Kartu>
            <p className="text-[0.8125rem] text-ink-2 leading-snug">
              <strong className="text-ink">{jumlahBarang} barang</strong> akan dikirim sebagai{' '}
              <strong className="text-ink">{jumlahPesanan} pesanan</strong> ke {jumlahDistributor} distributor.
            </p>
            <div className="mt-1">{keteranganKunci('alasan-kunci-samping')}</div>
            <div className="mt-3">{aksi('alasan-kunci-samping')}</div>
          </Kartu>
        </aside>

        {/* Bilah aksi diangkat setinggi navigasi bawah, supaya tombol kirim tidak
            tertutup navigasi mobile dan benar-benar bisa ditekan. */}
        <div className="lg:hidden sticky bottom-[var(--nav-h)] z-30">
          <BilahAksi
            ringkasan={
              <div className="space-y-1">
                <p className="text-[0.8125rem] text-ink-2 leading-snug">
                  <strong className="text-ink">{jumlahBarang} barang</strong> akan dikirim sebagai{' '}
                  <strong className="text-ink">{jumlahPesanan} pesanan</strong> ke {jumlahDistributor} distributor.
                </p>
                {keteranganKunci('alasan-kunci-bawah')}
              </div>
            }
          >
            {/* Tombol kirim sengaja tidak selebar layar seperti langkah sebelumnya:
                posisinya bergeser supaya jempol tidak melanjutkan kebiasaan mengetuk. */}
            {aksi('alasan-kunci-bawah')}
          </BilahAksi>
        </div>
      </div>
    </div>
  )
}
