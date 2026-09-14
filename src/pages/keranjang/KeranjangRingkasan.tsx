import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, BarisData, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { TombolTerkunci, useTerkunci } from '@/components/domain'
import { IkonKeranjang, IkonKontrak, IkonNota } from '@/icons'
import { angka, hariLagi, rupiah } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import { distributorById, penawaranById } from '@/data/dummy'
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
  const daftarKontrak = useAplikasi((s) => s.kontrak)
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

  function hargaBaris(penawaranId: string, kontrakId: string | null): number {
    const kontrak = kontrakId ? daftarKontrak.find((k) => k.id === kontrakId) : undefined
    if (kontrak) return kontrak.hargaSatuan
    return penawaranById(penawaranId)?.hargaSatuan ?? 0
  }

  const totalSemua = aktif.reduce(
    (a, sub) => a + sub.baris.reduce((x, b) => x + hargaBaris(b.penawaranId, b.kontrakId) * b.jumlah, 0),
    0,
  )
  const jumlahBarang = aktif.reduce((a, k) => a + k.baris.length, 0)
  const jumlahPesanan = aktif.length

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
            aksi={<TombolTautan ke="/belanja">Cari Barang di Belanja</TombolTautan>}
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
              (a, b) => a + hargaBaris(b.penawaranId, b.kontrakId) * b.jumlah,
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
                    const harga = hargaBaris(b.penawaranId, b.kontrakId)
                    return (
                      <div key={b.penawaranId} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[0.9375rem] font-semibold text-ink leading-snug">{pw.nama}</h3>
                          <p className="text-[0.8125rem] text-ink-3 tabular">
                            {angka(b.jumlah)} {pw.satuan} &times; {rupiah(harga)}
                          </p>
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
              <strong className="text-ink">{jumlahPesanan} pesanan</strong> ke {jumlahPesanan} distributor.
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
                  <strong className="text-ink">{jumlahPesanan} pesanan</strong> ke {jumlahPesanan} distributor.
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
