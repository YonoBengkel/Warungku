import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Barang, SubKeranjang } from '@/lib/types'
import { Avatar, BarisData, Kartu, Lencana, Pemisah, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { TombolTerkunci, useTerkunci } from '@/components/domain'
import { HargaBeli, LencanaPromo } from '@/components/domain/KartuPromo'
import { IkonKeranjang, IkonKontrak, IkonSampah, IkonToko } from '@/icons'
import { angka, cx, hariLagi, rupiah } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'
import { JUDUL } from '@/lib/label'
import {
  distributorById,
  penawaranById,
  penawaranUntukBarang,
  saranBelanja,
  statusStok,
} from '@/data/dummy'
import { useAplikasi, usePenentuHarga } from '@/store/aplikasi'

/**
 * Keranjang yang jujur soal bentuk akhirnya.
 *
 * Satu pesanan tidak bisa melintasi dua distributor, jadi keranjang ini memang
 * berbentuk beberapa sub-keranjang. Itu tidak disembunyikan: pemecahan ditulis
 * di atas tombol, dan tombolnya menyebut berapa pesanan yang akan lahir.
 *
 * Tetap SATU tombol, bukan satu tombol per sub-keranjang, karena dari sisi
 * pemilik warung ini satu tindakan belanja. Di desktop tombol itu pindah ke
 * kartu ringkasan yang ikut menggulir di kolom kanan; di layar sempit ia tetap
 * bilah lengket di bawah. Dua tempat, satu tombol — tidak pernah dua-duanya.
 */


/** Toggle "simpan untuk nanti" hidup di bentuk data, bukan di aksi store. */
function ubahSimpan(distributorId: string, simpan: boolean) {
  useAplikasi.setState((s) => ({
    keranjang: s.keranjang.map((k) =>
      k.distributorId === distributorId ? { ...k, disimpanUntukNanti: simpan } : k,
    ),
  }))
}

export default function Keranjang() {
  const keranjang = useAplikasi((s) => s.keranjang)
  const daftarBarang = useAplikasi((s) => s.barang)
  /* Kontrak dibaca dari store, bukan dari data contoh: pengajuan kontrak
     yang lahir saat aplikasi berjalan hanya ada di sini, dan harganya harus
     ikut terpakai saat keranjang menghitung. */
  const kontrakStore = useAplikasi((s) => s.kontrak)
  const { hargaBerlaku, rincianHarga } = usePenentuHarga()
  const ubahJumlahKeranjang = useAplikasi((s) => s.ubahJumlahKeranjang)
  const hapusDariKeranjang = useAplikasi((s) => s.hapusDariKeranjang)
  const terkunci = useTerkunci()

  const aktif = keranjang.filter((k) => !k.disimpanUntukNanti && k.baris.length > 0)
  const disimpan = keranjang.filter((k) => k.disimpanUntukNanti && k.baris.length > 0)

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

  /**
   * Barang yang perlu dibeli tapi belum punya pemasok sama sekali tidak bisa
   * masuk sub-keranjang mana pun. Ia tetap ditampilkan supaya tidak hilang
   * diam-diam dari daftar belanja pemilik usaha.
   */
  const tanpaPemasok = useMemo(() => {
    const kandidat = new Map<string, Barang>()
    for (const s of saranBelanja) {
      for (const r of s.baris) {
        if (r.varian !== 'tanpa-pemasok') continue
        const b = daftarBarang.find((x) => x.id === r.barangId)
        if (b) kandidat.set(b.id, b)
      }
    }
    for (const b of daftarBarang) {
      const perlu = statusStok(b) === 'habis' || statusStok(b) === 'menipis'
      if (!perlu || b.dicatatManual) continue
      if (penawaranUntukBarang(b.id).length === 0) kandidat.set(b.id, b)
    }
    return Array.from(kandidat.values())
  }, [daftarBarang])

  /* Harga baris TIDAK pernah dihitung ulang di layar. Sebelum ini keranjang
     punya rumusnya sendiri sementara pesanan yang lahir darinya memakai rumus
     lain, jadi angka yang dibaca pemilik usaha bisa berbeda dari angka yang
     tersimpan di pesanan — dan selisih itu baru ketahuan saat tagihan datang.
     Satu-satunya sumber sekarang `hargaBerlaku`. */
  function totalSub(sub: SubKeranjang): number {
    return sub.baris.reduce((a, b) => a + hargaBerlaku(b.penawaranId, b.kontrakId) * b.jumlah, 0)
  }

  const totalSemua = aktif.reduce((a, s) => a + totalSub(s), 0)

  if (keranjang.length === 0) {
    return (
      <>
        <KepalaHalaman judul={JUDUL.keranjang} kembaliKe="/beranda" />
        {/* Judul bagian khusus pembaca layar: tanpa ini urutan judul melompat
            dari h1 langsung ke h3 milik kartu keadaan kosong. */}
        <section aria-labelledby="judul-isi-keranjang">
          <h2 id="judul-isi-keranjang" className="sr-only">
            Isi keranjang
          </h2>
          <KeadaanKosong
            ikon={<IkonKeranjang size={26} />}
            judul="Keranjang kamu masih kosong"
            pesan="Belum ada barang yang disiapkan untuk dipesan. Mulai dari katalog distributor, atau buka saran belanja hari ini dari Beranda."
            aksi={<TombolTautan ke="/belanja">Cari Barang di Distributor</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/beranda" ragam="garis">
                Kembali ke Beranda
              </TombolTautan>
            }
          />
        </section>
      </>
    )
  }

  /* Satu sumber untuk kalimat pemecahan dan satu sumber untuk tombolnya, dipakai
     ulang oleh bilah bawah (HP) dan kartu ringkasan (desktop). */
  const kalimatPemecahan: ReactNode =
    jumlahPesanan === 0 ? (
      'Semua sub-keranjang sedang disimpan untuk nanti. Ikutkan lagi minimal satu supaya bisa dikirim.'
    ) : (
      <>
        <strong className="text-ink">{jumlahBarang} barang</strong> akan dikirim sebagai{' '}
        <strong className="text-ink">{jumlahPesanan} pesanan</strong> ke {jumlahDistributor} distributor.
      </>
    )

  const tombolUtama = terkunci ? (
    <TombolTerkunci label={`Buat ${jumlahPesanan} Pesanan`} penuh />
  ) : jumlahPesanan === 0 ? (
    <TombolTautan ke="/belanja" ragam="garis" penuh ukuran="besar">
      Cari Barang di Distributor
    </TombolTautan>
  ) : (
    <TombolTautan ke="/keranjang/ringkasan" penuh ukuran="besar">
      Buat {jumlahPesanan} Pesanan
    </TombolTautan>
  )

  return (
    <div className="pb-4">
      <KepalaHalaman
        judul={JUDUL.keranjang}
        keterangan={
          jumlahPesanan === 0
            ? 'Semua disimpan untuk nanti'
            : `${jumlahBarang} barang siap dipesan ke ${jumlahDistributor} distributor`
        }
        kembaliKe="/beranda"
      />

      {/* Di desktop keranjang jadi dua kolom: daftar belanja di kiri, ringkasan
          yang ikut menggulir di kanan. Satu kolom sempit di tengah layar 1360px
          membuang dua pertiga lebar tanpa menambah apa pun yang bisa dibaca. */}
      <div className="mx-auto w-full max-w-3xl lg:max-w-none mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {[...aktif, ...disimpan].map((sub) => {
            const distributor = distributorById(sub.distributorId)
            const hariTiba = Math.max(
              1,
              ...sub.baris.map((b) => {
                const pw = penawaranById(b.penawaranId)
                const brg = daftarBarang.find((x) => x.id === pw?.barangIdTerkait)
                return brg?.hariKirim ?? 2
              }),
            )

            return (
              <Kartu
                key={sub.distributorId}
                /* Sub-keranjang yang ditunda ditandai garis putus-putus, BUKAN
                   dipudarkan: memudarkan kartu menjatuhkan kontras teksnya di
                   bawah ambang baca, paling parah di tema gelap. */
                className={cx(sub.disimpanUntukNanti && 'border-dashed')}
              >
                {/* Kepala sub-keranjang: siapa yang mengirim, dan kapan kira-kira sampai */}
                <div className="flex items-start gap-3">
                  <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={40} />
                  <div className="min-w-0 grow">
                    <h2 className="text-[1rem] font-semibold text-ink leading-snug">
                      <Link
                        to={`/distributor/${sub.distributorId}`}
                        className="text-ink hover:text-brand transition-colors truncate block"
                      >
                        {distributor?.nama}
                      </Link>
                    </h2>
                    <p className="text-[0.8125rem] text-ink-3">
                      {sub.baris.length} barang &middot; perkiraan tiba {hariLagi(hariTiba)}
                    </p>
                  </div>
                  {sub.disimpanUntukNanti && <Lencana nada="netral">Disimpan untuk nanti</Lencana>}
                </div>

                <Pemisah className="my-3" />

                <div className="space-y-4">
                  {sub.baris.map((baris) => {
                    const pw = penawaranById(baris.penawaranId)
                    if (!pw) return null
                    const brg = daftarBarang.find((x) => x.id === pw.barangIdTerkait)
                    /* Kontraknya dibaca dari store karena sisa kuotanya ikut
                       berubah saat barang diterima; harganya tidak diambil dari
                       sini melainkan dari `hargaBerlaku`, satu-satunya sumber. */
                    const kontrak = baris.kontrakId
                      ? kontrakStore.find((k) => k.id === baris.kontrakId)
                      : undefined
                    /* Satu sumber dengan total di bawah dan dengan harga yang
                       nanti tersimpan di pesanan. Baris berkontrak tidak pernah
                       membawa promo: `rincianHarga` sudah memastikannya. */
                    const rincian = rincianHarga(baris.penawaranId, baris.kontrakId)
                    const harga = rincian.harga
                    const isi = pw.kemasanJual?.isi ?? 1
                    const berubah = baris.saranSistem != null && baris.saranSistem !== baris.jumlah

                    return (
                      <div key={baris.penawaranId}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[1rem] font-semibold text-ink leading-snug">{pw.nama}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                              {kontrak ? (
                                <Lencana nada="aman" ikon={<IkonKontrak size={13} />}>
                                  Kontrak
                                </Lencana>
                              ) : (
                                <Lencana nada="netral">Beli Lepas</Lencana>
                              )}
                              {/* Barisnya membungkus, bukan menggeser halaman:
                                  di 360px lencana promo turun ke baris baru. */}
                              {rincian.promo && <LencanaPromo promo={rincian.promo} />}
                              <HargaBeli rincian={rincian} satuan={pw.satuan} className="text-[0.8125rem]" />
                            </div>
                          </div>
                          <TombolIkon
                            label={`Keluarkan ${pw.nama} dari keranjang`}
                            onClick={() => hapusDariKeranjang(sub.distributorId, baris.penawaranId)}
                          >
                            <IkonSampah size={18} />
                          </TombolIkon>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <PengaturJumlah
                            nilai={baris.jumlah}
                            ubah={(n) => ubahJumlahKeranjang(sub.distributorId, baris.penawaranId, n)}
                            min={1}
                            maks={Math.max(1, pw.stokTersedia)}
                            satuan={pw.satuan}
                            ukuran="kecil"
                            label={`Jumlah ${pw.nama}`}
                          />
                          <p className="text-[1.5rem] font-bold text-ink leading-none tabular">
                            {rupiah(harga * baris.jumlah)}
                          </p>
                        </div>

                        {/* Label saran yang TIDAK PERNAH hilang: pengguna harus selalu bisa
                            membandingkan angkanya dengan angka yang disarankan sistem. */}
                        {baris.saranSistem != null && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[0.8125rem] text-ink-3">
                              {berubah ? (
                                <>
                                  Saran sistem {angka(baris.saranSistem)} {pw.satuan} &middot; kamu ubah jadi{' '}
                                  {angka(baris.jumlah)} {pw.satuan}
                                </>
                              ) : (
                                <>
                                  Saran sistem: {angka(baris.saranSistem)} {pw.satuan}
                                </>
                              )}
                            </span>
                            {berubah && (
                              <button
                                type="button"
                                onClick={() =>
                                  ubahJumlahKeranjang(
                                    sub.distributorId,
                                    baris.penawaranId,
                                    baris.saranSistem as number,
                                  )
                                }
                                className="inline-flex items-center h-9 px-3 rounded-full border border-line-strong text-[0.8125rem] font-semibold text-brand hover:border-brand"
                              >
                                Kembalikan ke saran ({angka(baris.saranSistem)} {pw.satuan})
                              </button>
                            )}
                          </div>
                        )}

                        {brg && isi > 1 && (
                          <p className="mt-1 text-[0.75rem] text-ink-3">
                            = {jumlahTampil(brg, baris.jumlah * isi)} masuk ke stok {brg.nama}
                          </p>
                        )}

                        {rincian.sumber === 'promo' && (
                          <p className="mt-1 text-[0.75rem] text-ink-3 leading-snug">
                            Hemat{' '}
                            <span className="tabular">
                              {rupiah((rincian.hargaNormal - rincian.harga) * baris.jumlah)}
                            </span>{' '}
                            dari promo, sudah masuk ke total.
                          </p>
                        )}

                        {kontrak && (
                          <p className="mt-1 text-[0.75rem] text-ink-3">
                            Harga mengikuti kontrak. Sisa kuota bulan ini{' '}
                            {angka(
                              Math.max(
                                0,
                                kontrak.periodeBerjalan.kuota -
                                  kontrak.periodeBerjalan.diterima -
                                  kontrak.dalamPerjalanan,
                              ),
                            )}{' '}
                            {kontrak.satuan}.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <Pemisah className="my-3" />

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[0.875rem] font-semibold text-ink-2">
                    Subtotal ke {distributor?.nama ?? 'distributor ini'}
                  </span>
                  <span className="text-[1.0625rem] font-bold text-ink tabular">{rupiah(totalSub(sub))}</span>
                </div>
                {/* Minimum pesanan diisi distributor di portalnya. Tidak
                    memblokir: pesanannya tetap boleh dikirim, tapi lebih baik
                    ketahuan sekarang daripada setelah ditolak. */}
                {distributor?.info &&
                  distributor.info.minimumPesanan > 0 &&
                  totalSub(sub) < distributor.info.minimumPesanan && (
                    <p className="mt-1.5 text-[0.8125rem] font-semibold text-menipis-ink leading-snug">
                      Belum mencapai minimum pesanan {distributor.nama}, {rupiah(distributor.info.minimumPesanan)}.
                      Kurang {rupiah(distributor.info.minimumPesanan - totalSub(sub))}; pesanan tetap bisa dikirim, tapi
                      distributor boleh menolaknya.
                    </p>
                  )}

                <button
                  type="button"
                  onClick={() => ubahSimpan(sub.distributorId, !sub.disimpanUntukNanti)}
                  className="mt-1 inline-flex items-center min-h-11 text-[0.8125rem] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink"
                >
                  {sub.disimpanUntukNanti
                    ? 'Ikutkan lagi sub-keranjang ini'
                    : 'Simpan sub-keranjang ini untuk nanti'}
                </button>
                {sub.disimpanUntukNanti && (
                  <p className="mt-1 text-[0.75rem] text-ink-3">
                    Tidak ikut dikirim sekarang, tapi tetap tersimpan di sini.
                  </p>
                )}
              </Kartu>
            )
          })}

          {/* Grup terakhir: barang yang memang belum punya pemasok tetap */}
          {tanpaPemasok.length > 0 && (
            <Kartu>
              <div className="flex items-start gap-3">
                <span className="size-10 rounded-md bg-sunken grid place-items-center text-ink-3 shrink-0">
                  <IkonToko size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[1rem] font-semibold text-ink leading-snug">Belum ada pemasok tetap</h2>
                  <p className="text-[0.8125rem] text-ink-3 leading-snug">
                    Barang ini perlu dibeli, tapi belum ada distributor yang memasoknya di daerah kamu. Barang
                    di bawah ini tidak ikut terkirim.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2.5">
                {tanpaPemasok.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-line bg-surface-2 p-3"
                  >
                    <div className="min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-ink truncate">{b.nama}</h3>
                      <p className="text-[0.8125rem] text-ink-3">
                        Sisa {jumlahTampil(b, b.stok)} &middot; {b.kategori}
                      </p>
                    </div>
                    <TombolTautan
                      ke={`/belanja?cari=${encodeURIComponent(b.nama)}`}
                      ragam="garis"
                      ukuran="kecil"
                    >
                      Cari Distributor
                    </TombolTautan>
                  </div>
                ))}
              </div>
            </Kartu>
          )}
        </div>

        {/* Kolom kanan desktop: ringkasan yang ikut menggulir, lengkap dengan
            tombolnya. Bilah lengket di bawah dimatikan di lebar ini supaya
            tombol "Buat N Pesanan" tidak muncul dua kali di satu layar. */}
        <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
          <Kartu>
            <h2 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
              Ringkasan belanja
            </h2>
            <p className="mt-2 text-[1.625rem] font-extrabold text-ink leading-none tabular">
              {rupiah(totalSemua)}
            </p>
            <Pemisah className="my-3" />
            <BarisData label="Barang siap dipesan" nilai={`${jumlahBarang} barang`} />
            <BarisData label="Pesanan yang akan lahir" nilai={`${jumlahPesanan} pesanan`} />
            {disimpan.length > 0 && (
              <BarisData label="Disimpan untuk nanti" nilai={`${disimpan.length} sub-keranjang`} />
            )}
            <p className="mt-2 text-[0.8125rem] text-ink-2 leading-snug">{kalimatPemecahan}</p>
            <div className="mt-4">{tombolUtama}</div>
          </Kartu>
        </aside>

        {/* Bilah aksi diangkat setinggi navigasi bawah. Kalau dibiarkan menempel
            di dasar layar, ia berada tepat di belakang navigasi mobile dan tombol
            utamanya tidak bisa ditekan sama sekali. */}
        <div className="lg:hidden sticky bottom-[var(--nav-h)] z-30">
          <BilahAksi
            ringkasan={
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[0.8125rem] text-ink-2 leading-snug">{kalimatPemecahan}</p>
                <span className="text-[1rem] font-bold text-ink tabular shrink-0">{rupiah(totalSemua)}</span>
              </div>
            }
          >
            {tombolUtama}
          </BilahAksi>
        </div>
      </div>
    </div>
  )
}
