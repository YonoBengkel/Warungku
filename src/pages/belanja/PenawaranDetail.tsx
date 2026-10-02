import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  BarisData,
  HanyaPembacaLayar,
  Kartu,
  Lencana,
  Pemisah,
  Tombol,
  TombolTautan,
} from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { ChipStok, KuotaBulanIni, TombolTerkunci, useTerkunci } from '@/components/domain'
import { HargaBeli, KALIMAT_PROMO, LencanaPromo } from '@/components/domain/KartuPromo'
import {
  IkonBintangIsi,
  IkonKeranjang,
  IkonKontrak,
  IkonKotak,
  IkonPanahKanan,
  IkonToko,
} from '@/icons'
import { angka, rupiah, waktuLalu } from '@/lib/format'
import { isiKemasan, jumlahBawaan, jumlahTampil } from '@/lib/satuan'
import { BANTUAN } from '@/lib/label'
import {
  distributorById,
  hargaBerlaku,
  hariCukup,
  paketUntukPenawaran,
  penawaranById,
  rincianHarga,
  statusStok,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Detail satu penawaran: satu barang dari satu distributor.
 *
 * Dua tombol di kaki layar sengaja dibedakan bobotnya. "Ikat Kontrak" penuh dan
 * berwarna, "Beli Sekali" bergaris. Bukan untuk mendorong kontrak diam-diam,
 * tapi karena kontrak adalah keputusan yang perlu dipikirkan, jadi jalur menuju
 * layar pembandingnya harus paling mudah ditemukan. Harga kedua jalur ditulis
 * bersebelahan tepat di atas tombol supaya perbandingannya tidak bisa dilewati.
 */
export default function PenawaranDetail() {
  const { id = '' } = useParams()
  const navigasi = useNavigate()
  const terkunci = useTerkunci()

  const penawaran = penawaranById(id)
  const distributor = penawaran ? distributorById(penawaran.distributorId) : undefined
  const paketKontrak = useAplikasi((s) => s.paketKontrak)
  const paket = useMemo(() => paketUntukPenawaran(id, paketKontrak), [id, paketKontrak])

  const daftarBarangGudang = useAplikasi((s) => s.barang)
  const daftarKontrakAktif = useAplikasi((s) => s.kontrak)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const barang = daftarBarangGudang.find((b) => b.id === penawaran?.barangIdTerkait)
  const kontrakTerkait = daftarKontrakAktif.filter(
    (k) => k.penawaranId === id && (k.status === 'aktif' || k.status === 'akan-berakhir'),
  )

  const [lembarBeli, setLembarBeli] = useState(false)
  const [jumlah, setJumlah] = useState(1)

  if (!penawaran || !distributor) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Penawaran" kembaliKe="/belanja" />
        <Kartu className="mt-6">
          <h2 className="sr-only">Penawaran tidak ditemukan</h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Penawaran ini sudah tidak ada"
            pesan="Distributor mungkin sudah menurunkan barang ini dari daftar jualnya, atau tautannya salah salin. Cari barang yang sama dari distributor lain."
            aksi={<TombolTautan ke="/belanja">Cari barang di Distributor</TombolTautan>}
          />
        </Kartu>
      </div>
    )
  }

  const hargaKontrakTermurah = paket.length > 0 ? Math.min(...paket.map((p) => p.hargaSatuan)) : null
  const kelipatan = penawaran.kemasanJual
  const habisDiDistributor = penawaran.stokTersedia <= 0
  /* Kontrak dibaca dari penyimpanan aplikasi, bukan dari berkas contoh, supaya
     kontrak yang baru berubah di layar lain langsung ikut terlihat di sini. */
  const kontrakBarang = barang
    ? daftarKontrakAktif.filter(
        (k) => k.barangId === barang.id && (k.status === 'aktif' || k.status === 'akan-berakhir'),
      )
    : []
  const kontrakUntukPenawaranIni = kontrakTerkait[0] ?? null
  /* Lewat hargaBerlaku, bukan harga eceran mentah: kalau penawaran ini terikat
     kontrak, keranjang akan memakai harga kontrak. Menghitung sendiri di sini
     membuat lembar "Beli sekali" menjanjikan satu angka lalu keranjang
     menampilkan angka lain untuk baris yang sama persis. */
  const hargaSatuanBerlaku = hargaBerlaku(
    penawaran.id,
    kontrakUntukPenawaranIni?.id ?? null,
    daftarKontrakAktif,
  )
  const subtotal = jumlah * hargaSatuanBerlaku

  /* Harga beli sekali, sudah termasuk potongan promo kalau ada. Angka besar di
     kartu atas memakai ini; lembar beli memakai `hargaSatuanBerlaku`, yang
     berbeda hanya kalau kamu punya kontrak untuk barang ini. */
  const rincianBeliSekali = rincianHarga(penawaran.id, null, daftarKontrakAktif)
  const promo = rincianBeliSekali.promo

  function bukaLembarBeli() {
    setJumlah(1)
    setLembarBeli(true)
  }

  function simpanKeKeranjang() {
    if (!penawaran) return
    tambahKeKeranjang(
      penawaran.distributorId,
      penawaran.id,
      jumlah,
      null,
      kontrakUntukPenawaranIni?.id ?? null,
    )
    setLembarBeli(false)
    tampilkanRacun(`${jumlah} ${penawaran.satuan} ${penawaran.nama} masuk keranjang.`, 'aman')
  }

  return (
    <div className="pb-6">
      <KepalaHalaman judul={penawaran.nama} keterangan={distributor.nama} kembaliKe="/belanja" />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-4">
          {/* Identitas barang. Nama barang tidak diulang di sini: ia sudah ada
              di kepala halaman yang lengket di atas layar. */}
          <Kartu>
            <h2 className="text-[0.9375rem] font-bold text-ink mb-2.5">Harga dan ketersediaan</h2>
            <div className="flex items-start gap-3.5">
              <Avatar nama={penawaran.nama} warna={distributor.warna} ukuran={56} />
              <div className="min-w-0 grow">
                <p className="text-[0.9375rem] font-semibold text-ink leading-snug">{penawaran.kategori}</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-relaxed">{penawaran.keterangan}</p>
              </div>
            </div>

            <Pemisah className="my-3.5" />

            {/* Harga beli sekali: satu-satunya angka besar di blok ini. Kalau
                promo memotongnya, harga normal dicoret di sebelahnya — potongan
                itu memang masuk ke harga yang tercatat di pesanan. */}
            <HargaBeli rincian={rincianBeliSekali} satuan={penawaran.satuan} besar />
            <p className="mt-1 text-[0.8125rem] text-ink-3">Harga beli sekali, belum termasuk ongkos kirim.</p>

            {/* Asal potongan ditulis tepat di bawah harga: di sinilah pemilik
                usaha memutuskan membeli. `items-start` menahan lencana selebar
                isinya supaya membungkus, bukan melebarkan halaman di 360px. */}
            {promo && (
              <div className="mt-2.5 flex flex-col items-start gap-1.5">
                <LencanaPromo promo={promo} />
                <p className="text-[0.8125rem] text-ink-2 leading-relaxed">
                  {kontrakUntukPenawaranIni ? KALIMAT_PROMO.kontrakTidakIkut : KALIMAT_PROMO.hanyaBeliSekali}
                </p>
              </div>
            )}

            <dl className="mt-3.5">
              {/* Stok distributor dan waktu pembaruannya wajib tampil: angka stok
                  tanpa stempel waktu membuat orang memesan barang yang sudah habis. */}
              <BarisData
                label="Stok distributor"
                nilai={`${angka(penawaran.stokTersedia)} ${penawaran.satuan}`}
                tebal
              />
              <BarisData label="Diperbarui" nilai={waktuLalu(penawaran.stokDiperbaruiPada)} />
              <BarisData
                label="Kelipatan pemesanan"
                nilai={
                  kelipatan && barang
                    ? (isiKemasan(barang, kelipatan.nama, kelipatan.isi) ?? `per 1 ${kelipatan.nama}`)
                    : kelipatan
                      ? `1 ${kelipatan.nama} = ${angka(kelipatan.isi)} satuan pakai`
                      : `per 1 ${penawaran.satuan}`
                }
              />
              <BarisData label="Area kirim" nilai={distributor.areaKirim.join(', ')} />
            </dl>

            {/* Penjualnya dibaca di kartu yang sama dengan harganya: harga, stok,
                dan area kirim di atas adalah janji distributor ini, jadi rekam
                jejaknya ikut ditimbang di tempat yang sama, bukan di kartu
                terpisah yang mudah terlewat. */}
            <Pemisah className="my-3.5" />
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">Dijual oleh</p>
            <Link
              to={`/distributor/${distributor.id}`}
              className="-mx-2 mt-1 flex items-center gap-3 rounded-md px-2 py-2 min-h-14 hover:bg-sunken"
            >
              <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={40} />
              <div className="min-w-0 grow">
                <p className="text-[0.9375rem] font-bold text-ink leading-snug">
                  {distributor.nama}
                  <span className="font-normal text-ink-3"> &middot; {distributor.kota}</span>
                </p>
                <div className="mt-1">
                  {distributor.baru || distributor.rating == null ? (
                    <Lencana nada="netral">
                      Distributor Baru &middot; belum ada ulasan &middot; bergabung {distributor.sejak}
                    </Lencana>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-ink-2">
                      <IkonBintangIsi size={14} className="text-menipis" />
                      <strong className="text-ink">{distributor.rating.toFixed(1).replace('.', ',')}</strong>
                      <HanyaPembacaLayar>dari 5 bintang &middot;</HanyaPembacaLayar>
                      {distributor.jumlahUlasan} ulasan dari {distributor.jumlahUmkmPengulas} UMKM &middot;{' '}
                      {angka(distributor.jumlahPesananSelesai)} pesanan selesai
                    </span>
                  )}
                </div>
                <span className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-bold text-brand">
                  Lihat profil distributor
                  <IkonPanahKanan size={15} />
                </span>
              </div>
            </Link>
          </Kartu>
        </div>

        <div className="lg:col-span-5 mt-4 lg:mt-0 space-y-4">
          {/* Barang gudang yang terkait */}
          {barang ? (
            <Kartu padat>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[0.875rem] font-bold text-ink">Stok kamu untuk barang ini</h2>
                <ChipStok status={statusStok(barang)} />
              </div>
              <p className="mt-2 text-[0.875rem] text-ink-2">
                Sisa <strong className="text-ink">{jumlahTampil(barang, barang.stok)}</strong>
                {barang.pemakaianHarian > 0 && hariCukup(barang) != null && (
                  <> &middot; cukup &plusmn;{hariCukup(barang)} hari</>
                )}
              </p>
              <Link
                to={`/stok/${barang.id}`}
                className="mt-2 inline-flex items-center gap-1 text-[0.8125rem] font-bold text-brand hover:underline"
              >
                Buka detail stok
                <IkonPanahKanan size={15} />
              </Link>
            </Kartu>
          ) : (
            <Kartu padat>
              <h2 className="text-[0.875rem] font-bold text-ink">Belum ada di daftar stok kamu</h2>
              <p className="mt-1.5 text-[0.8125rem] text-ink-2 leading-relaxed">
                Barang ini belum terdaftar di gudangmu, jadi kami belum bisa menghitung pemakaian dan perkiraan
                kebutuhannya. Stok baru bertambah otomatis setelah pesanan pertama kamu terima.
              </p>
              <TombolTautan ke="/stok/baru" ragam="garis" ukuran="kecil" className="mt-2.5">
                Tambah ke daftar stok
              </TombolTautan>
            </Kartu>
          )}

          {/* Kontrak aktif yang sudah ada untuk barang ini */}
          {kontrakBarang.length > 0 && (
            <section aria-label="Kontrak aktif untuk barang ini" className="space-y-2.5">
              <h2 className="text-[0.875rem] font-bold text-ink px-1">
                Kamu sudah punya kontrak untuk barang ini
              </h2>
              {kontrakBarang.map((k) => {
                const d = distributorById(k.distributorId)
                return (
                  <Kartu key={k.id} padat>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-[0.9375rem] font-bold text-ink truncate">{d?.nama}</p>
                        <p className="text-[0.75rem] text-ink-3">
                          {k.durasiBulan} bulan &middot; {rupiah(k.hargaSatuan)}/{k.satuan}
                        </p>
                      </div>
                      <Lencana nada="merek" ikon={<IkonKontrak size={13} />}>
                        Berjalan
                      </Lencana>
                    </div>
                    <KuotaBulanIni kontrak={k} ringkas />
                    <Link
                      to={`/kontrak/${k.id}`}
                      className="mt-2.5 inline-flex items-center gap-1 text-[0.8125rem] font-bold text-brand hover:underline"
                    >
                      Lihat kontrak
                      <IkonPanahKanan size={15} />
                    </Link>
                  </Kartu>
                )
              })}
              <p className="text-[0.75rem] text-ink-3 px-1">{BANTUAN.satuKontrakSatuBarang}</p>
            </section>
          )}

          {paket.length === 0 && (
            <Peringatan nada="netral" judul="Distributor belum membuka kontrak untuk barang ini">
              Kamu tetap bisa membeli sekali sebanyak yang kamu butuhkan. Harga kontrak baru bisa dibandingkan
              kalau distributor sudah memasang paketnya.
            </Peringatan>
          )}
        </div>
      </div>

      {/* Kaki lengket: satu baris pembanding, lalu dua tombol berbeda bobot */}
      <BilahAksi
        ringkasan={
          <p className="text-[0.875rem] text-ink-2 leading-snug">
            Beli sekali{' '}
            <strong className="text-ink">
              {rupiah(rincianBeliSekali.harga)}/{penawaran.satuan}
            </strong>
            {hargaKontrakTermurah != null ? (
              <>
                {' '}
                &mdash; Harga kontrak mulai{' '}
                <strong className="text-brand">
                  {rupiah(hargaKontrakTermurah)}/{penawaran.satuan}
                </strong>
              </>
            ) : (
              <> &mdash; belum ada paket kontrak untuk barang ini</>
            )}
            {habisDiDistributor && (
              <>
                {' '}
                <span className="block mt-1 font-semibold text-menipis-ink">
                  Stok distributor sedang kosong, jadi belum bisa dibeli sekali. Kamu masih bisa mengikat kontrak
                  supaya kebagian kiriman berikutnya.
                </span>
              </>
            )}
          </p>
        }
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          {paket.length > 0 &&
            (terkunci ? (
              <div className="sm:flex-1">
                <TombolTerkunci label="Ikat Kontrak" penuh />
              </div>
            ) : (
              <TombolTautan
                ke={`/penawaran/${penawaran.id}/kontrak`}
                penuh
                ukuran="besar"
                className="sm:flex-1"
                ikonKiri={<IkonKontrak size={18} />}
              >
                Ikat Kontrak
              </TombolTautan>
            ))}

          {terkunci ? (
            <div className="sm:flex-1">
              <TombolTerkunci label="Beli Sekali" penuh />
            </div>
          ) : (
            <Tombol
              ragam="garis"
              penuh
              ukuran="besar"
              className="sm:flex-1"
              ikonKiri={<IkonKeranjang size={18} />}
              onClick={bukaLembarBeli}
              disabled={habisDiDistributor}
            >
              Beli Sekali
            </Tombol>
          )}
        </div>
      </BilahAksi>

      {/* Lembar beli sekali */}
      <Lembar
        terbuka={lembarBeli}
        tutup={() => setLembarBeli(false)}
        judul="Beli sekali"
        keterangan={`${penawaran.nama} dari ${distributor.nama}`}
        lebar="sempit"
        kaki={
          <div className="space-y-2.5">
            <Tombol penuh ukuran="besar" onClick={simpanKeKeranjang} disabled={jumlah <= 0}>
              Masukkan ke Keranjang
            </Tombol>
            <Tombol
              ragam="sunyi"
              penuh
              onClick={() => {
                simpanKeKeranjang()
                navigasi('/keranjang')
              }}
              disabled={jumlah <= 0}
            >
              Masukkan lalu buka keranjang
            </Tombol>
          </div>
        }
      >
        <div className="pb-4 space-y-4">
          <div>
            <p className="text-[0.875rem] font-semibold text-ink-2 mb-2">Berapa yang kamu ambil?</p>
            <PengaturJumlah
              nilai={jumlah}
              ubah={setJumlah}
              min={1}
              maks={Math.max(1, penawaran.stokTersedia)}
              satuan={penawaran.satuan}
              label="Jumlah"
            />
            <p className="mt-2 text-[0.8125rem] text-ink-3">
              {kelipatan && barang ? (
                <>
                  = {jumlahBawaan(barang, jumlah * kelipatan.isi)} &middot; kelipatan 1 {kelipatan.nama}
                </>
              ) : (
                <>Pemesanan naik turun per 1 {penawaran.satuan}.</>
              )}
            </p>
            <p className="mt-1 text-[0.8125rem] text-ink-3">
              Stok distributor {angka(penawaran.stokTersedia)} {penawaran.satuan}, diperbarui{' '}
              {waktuLalu(penawaran.stokDiperbaruiPada)}.
            </p>
          </div>

          <div className="rounded-md bg-sunken p-3.5">
            <BarisData
              label={`${angka(jumlah)} ${penawaran.satuan} x ${rupiah(hargaSatuanBerlaku)}`}
              nilai={rupiah(subtotal)}
              tebal
            />
            <p className="mt-1 text-[0.75rem] text-ink-3 leading-relaxed">
              Ongkos kirim ditentukan distributor saat pesanan dikonfirmasi. {BANTUAN.bayarLuar}
            </p>
          </div>

          {kontrakUntukPenawaranIni && (
            <Peringatan nada="info" judul="Pembelian ini ikut menghitung kuota kontrak">
              Kamu punya kontrak berjalan untuk barang ini. Jumlah yang kamu ambil sekarang akan dihitung sebagai
              pemenuhan kuota bulan ini setelah barangnya kamu terima.
              {/* Angka besar di atas adalah harga eceran; yang dipakai di sini
                  harga kontrak. Selisihnya disebutkan supaya tidak terbaca
                  sebagai dua angka yang saling bertentangan. */}
              {hargaSatuanBerlaku !== penawaran.hargaSatuan && (
                <>
                  {' '}
                  Harganya pun mengikuti kontrak, {rupiah(hargaSatuanBerlaku)}/{penawaran.satuan}, bukan harga
                  eceran {rupiah(penawaran.hargaSatuan)}/{penawaran.satuan}.
                </>
              )}
            </Peringatan>
          )}

          {barang && (
            <p className="text-[0.8125rem] text-ink-3 leading-relaxed flex items-start gap-2">
              <IkonKotak size={15} className="shrink-0 mt-px" />
              Stok gudang kamu sekarang {jumlahTampil(barang, barang.stok)}. Angka ini baru bertambah
              setelah barang kamu terima dan kamu periksa.
            </p>
          )}
        </div>
      </Lembar>
    </div>
  )
}
