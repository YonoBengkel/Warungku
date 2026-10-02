import { useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChipPesanan, KartuBuktiPengiriman, TombolTerkunci, useTerkunci } from '@/components/domain'
import { KALIMAT_PROMO, LencanaPromo } from '@/components/domain/KartuPromo'
import { Avatar, Kartu, Lencana, Pemisah, Tombol, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { BarisChip, BilahAksi, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { Lembar } from '@/components/ui/lembar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonBintang,
  IkonCentang,
  IkonKontrak,
  IkonMata,
  IkonNota,
  IkonPasokan,
  IkonPetir,
  IkonSalin,
  IkonSinkron,
  IkonUnggah,
} from '@/icons'
import { angka, cx, jam, rupiah, tanggalPendek, tanggalRingkas, waktuLalu, waktuNanti } from '@/lib/format'
import { BANTUAN, LABEL_PESANAN } from '@/lib/label'
import { distributorById, promoById } from '@/data/dummy'
import type { BarisPesanan, StatusPesanan } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Rincian satu pesanan.
 *
 * Dua keputusan yang mengikat seluruh layar ini:
 *
 * 1. Pengiriman dan pembayaran adalah DUA jalur sejajar dengan bentuk visual
 *    berbeda — garis waktu bertitik untuk pengiriman, blok kotak untuk
 *    pembayaran. Disamakan bentuknya, orang akan mengira pembayaran adalah
 *    salah satu langkah pengiriman, padahal pembayarannya terjadi di luar
 *    aplikasi dan urutannya bebas.
 *
 * 2. Status pembayaran TIDAK PERNAH menonaktifkan tombol apa pun, termasuk
 *    "Barang Sudah Sampai". Barang yang sudah di depan mata tetap harus bisa
 *    dicatat masuk walaupun transfernya baru besok.
 */

const LANGKAH: Array<{ status: StatusPesanan; judul: string; bila: string }> = [
  { status: 'menunggu-konfirmasi', judul: 'Menunggu Konfirmasi', bila: 'Distributor belum membaca pesanan ini.' },
  { status: 'disiapkan', judul: 'Disiapkan', bila: 'Barang sedang dikemas di gudang distributor.' },
  { status: 'dikirim', judul: 'Dikirim', bila: 'Kurir sudah berangkat menuju tempatmu.' },
  { status: 'selesai', judul: 'Selesai', bila: 'Kamu sudah memeriksa barang dan stok bertambah.' },
]

const ALASAN_BATAL = ['Salah jumlah', 'Salah barang', 'Sudah tidak butuh', 'Terlalu lama'] as const

const LABEL_BAYAR = {
  'belum-dibayar': 'Belum Dibayar',
  'bukti-terkirim': 'Bukti Terkirim',
  dikonfirmasi: 'Sudah Dikonfirmasi Distributor',
} as const

export default function PesananDetail() {
  const { id = '' } = useParams()
  const terkunci = useTerkunci()

  const pesanan = useAplikasi((s) => s.pesanan.find((p) => p.id === id))
  const profil = useAplikasi((s) => s.profil)
  const kirimDraf = useAplikasi((s) => s.kirimDraf)
  const batalkanPesanan = useAplikasi((s) => s.batalkanPesanan)
  const unggahBukti = useAplikasi((s) => s.unggahBukti)
  const tandaiBayarTunai = useAplikasi((s) => s.tandaiBayarTunai)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const berkasRef = useRef<HTMLInputElement>(null)
  const [dialogBatal, setDialogBatal] = useState<'langsung' | 'ajukan' | null>(null)
  const [alasan, setAlasan] = useState<string>(ALASAN_BATAL[0])
  const [pembatalanDiajukan, setPembatalanDiajukan] = useState(false)

  if (!pesanan) {
    return (
      <div className="pb-6">
        {/* Judul kepala dibuat netral supaya kalimat "sudah tidak ada" hanya
            terbaca sekali, dan judul tingkat dua menjaga urutan h1 → h2 → h3. */}
        <KepalaHalaman judul="Pesanan" kembaliKe="/pesanan" />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Pesanan tidak ditemukan
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Pesanan ini sudah tidak ada"
            pesan="Tautannya mungkin sudah lama atau nomor pesanannya berubah. Daftar pesanan kamu masih lengkap di halaman Pesanan."
            aksi={<TombolTautan ke="/pesanan">Kembali ke Daftar Pesanan</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  /* Salinan tanpa-kosong supaya penangan peristiwa di bawah tidak perlu
     memeriksa ulang keberadaan pesanan yang sudah dijamin di atas. */
  const ps = pesanan
  const distributor = distributorById(pesanan.distributorId)
  const subtotal = pesanan.baris.reduce((a, b) => a + b.jumlah * b.hargaSatuan, 0)
  const total = subtotal + pesanan.ongkosKirim
  const jejakTerakhir = pesanan.jejak[pesanan.jejak.length - 1]
  const selesai = pesanan.status === 'selesai' || pesanan.status === 'selesai-catatan'
  const indeksLangkah = LANGKAH.findIndex((l) => l.status === pesanan.status)
  /* Pesanan batal tetap memperlihatkan sejauh mana ia sempat berjalan, supaya
     jelas apakah barangnya sudah sempat disiapkan atau belum. */
  const indeksJejakTerjauh = pesanan.jejak.reduce((maks, j) => {
    const i = LANGKAH.findIndex(
      (l) => l.status === j.status || (l.status === 'selesai' && j.status === 'selesai-catatan'),
    )
    return i > maks ? i : maks
  }, -1)
  const langkahAktif = selesai ? 3 : indeksLangkah >= 0 ? indeksLangkah : indeksJejakTerjauh

  /**
   * Promo yang memotong satu baris, dibaca dari CATATAN pesanan (`promoId`),
   * bukan ditebak ulang dari tanggal. Pesanan adalah catatan: angkanya tidak
   * boleh berubah hanya karena daftar promo hari ini berbeda.
   */
  function promoBaris(b: BarisPesanan) {
    return b.promoId ? promoById(b.promoId) : undefined
  }

  const adaBarisPromo = ps.baris.some((b) => promoBaris(b) != null)

  function salinNomor() {
    const teks = ps.nomor
    navigator.clipboard
      ?.writeText(teks)
      .then(() => tampilkanRacun(`Nomor ${teks} disalin. Tinggal tempel di WhatsApp.`, 'aman'))
      .catch(() =>
        tampilkanRacun(`Nomor pesanan: ${teks}. Catat manual ya, penyalinan otomatis tidak jalan di HP ini.`, 'info'),
      )
  }

  function padaBerkasBukti(e: ChangeEvent<HTMLInputElement>) {
    const jumlahBerkas = e.target.files?.length ?? 0
    for (let i = 0; i < jumlahBerkas; i += 1) unggahBukti(ps.id)
    e.target.value = ''
  }

  function konfirmasiBatal() {
    if (dialogBatal === 'ajukan') {
      setPembatalanDiajukan(true)
      tampilkanRacun('Permintaan pembatalan terkirim. Distributor akan mengabari.', 'info')
    } else {
      batalkanPesanan(ps.id, alasan)
    }
    setDialogBatal(null)
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={distributor?.nama ?? 'Pesanan'}
        keterangan={`${LABEL_PESANAN[pesanan.status]} · dibuat ${tanggalPendek(pesanan.dibuatPada)}`}
        kembaliKe="/pesanan"
        aksi={
          <TombolIkon label="Periksa kabar terbaru" onClick={() => tampilkanRacun('Belum ada kabar baru dari distributor.', 'info')}>
            <IkonSinkron size={20} />
          </TombolIkon>
        }
      />

      {/* 1. Nomor pesanan yang bisa disalin: ini yang dikirim lewat WhatsApp */}
      <div className="mt-4 flex items-center gap-3 bg-surface border border-line rounded-lg p-4 shadow-e1">
        <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={44} />
        <div className="min-w-0 grow">
          <p className="text-[0.75rem] text-ink-3">Nomor pesanan</p>
          <p className="text-[1.125rem] font-extrabold text-ink tabular leading-tight">{pesanan.nomor}</p>
        </div>
        <Tombol ragam="garis" ukuran="kecil" ikonKiri={<IkonSalin size={15} />} onClick={salinNomor}>
          Salin
        </Tombol>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-3">
        <span>Diperbarui {waktuLalu(jejakTerakhir.waktu)}</span>
        <ChipPesanan status={pesanan.status} />
        {pesanan.dariRutin && (
          <span className="inline-flex items-center gap-1">
            <IkonPetir size={13} /> Dari pesanan rutin
          </span>
        )}
        {pesanan.kontrakId && (
          <Link to={`/kontrak/${pesanan.kontrakId}`} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            <IkonKontrak size={13} /> Masuk hitungan kontrak
          </Link>
        )}
      </div>

      {pembatalanDiajukan && (
        <Peringatan nada="menipis" judul="Pembatalan sudah diajukan" className="mt-3 lg:max-w-[70ch]">
          Distributor akan mengabari apakah pembatalannya bisa diterima. Sampai ada jawaban, pesanan ini tetap berjalan.
        </Peringatan>
      )}

      {/* Ditolak distributor dan dibatalkan sendiri sama-sama berakhir "batal",
          tapi yang perlu dilakukan berbeda: penolakan membawa alasan dari
          distributor, jadi kalimat itulah yang dibaca lebih dulu. */}
      {pesanan.status === 'batal' && (
        <Peringatan
          nada="netral"
          judul={pesanan.alasanTolak ? 'Distributor menolak pesanan ini' : 'Pesanan ini dibatalkan'}
          className="mt-3 lg:max-w-[70ch]"
          aksi={
            <TombolTautan ke="/belanja" ragam="garis" ukuran="kecil">
              Cari Barang di Distributor
            </TombolTautan>
          }
        >
          {pesanan.alasanTolak
            ? `Alasannya: ${pesanan.alasanTolak.replace(/[.\s]+$/, '')}.`
            : jejakTerakhir.keterangan} Jumlahnya sudah
          dikeluarkan dari hitungan barang yang sedang dikirim, jadi peringatan stok tipis muncul lagi seperti
          seharusnya.
        </Peringatan>
      )}

      {/* Di layar lebar halaman dibelah dua: kiri perjalanan barangnya, kanan
          urusan uang dan jejak data. Keduanya memang jalur terpisah, jadi
          berdampingan justru menegaskan bahwa satu tidak menunggu yang lain. */}
      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
        <div className="lg:col-span-7 space-y-4">
          {/* 2a. Jalur pengiriman: garis waktu bertitik */}
          <section aria-labelledby="judul-pengiriman" className="bg-surface border border-line rounded-lg p-4 shadow-e1">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 id="judul-pengiriman" className="text-[0.9375rem] font-bold text-ink">
                Pengiriman
              </h2>
              {pesanan.perkiraanTiba && !selesai && pesanan.status !== 'batal' && (
                <span className="text-[0.8125rem] text-ink-2">
                  Perkiraan tiba <strong className="text-ink">{waktuNanti(pesanan.perkiraanTiba)}</strong>
                </span>
              )}
            </div>

            {pesanan.status === 'draf' ? (
              <p className="text-[0.875rem] text-ink-2 leading-relaxed bg-sunken rounded-md p-3.5 max-w-[68ch]">
                Pesanan ini masih draf dan belum sampai ke distributor. Garis waktu pengiriman mulai berjalan setelah
                kamu menekan Kirim Pesanan Sekarang.
              </p>
            ) : (
              <ol className="mt-1">
                {LANGKAH.map((l, i) => {
                  const lewat = i <= langkahAktif
                  // Kabar TERBARU di tahap ini: di tahap "Dikirim" itu bisa
                  // berarti "distributor menandai barang sudah sampai".
                  const jejak = [...pesanan.jejak]
                    .reverse()
                    .find((j) => j.status === l.status || (l.status === 'selesai' && j.status === 'selesai-catatan'))
                  const judul =
                    l.status === 'selesai' && pesanan.status === 'selesai-catatan' ? 'Selesai (ada catatan)' : l.judul
                  return (
                    <li key={l.status} className="relative pl-8 pb-5 last:pb-0">
                      {i < LANGKAH.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={cx(
                            'absolute left-[7px] top-5 bottom-0 border-l-2 border-dotted',
                            lewat ? 'border-brand' : 'border-line-strong',
                          )}
                        />
                      )}
                      {/* Ikon centang memakai tinta terbalik, bukan putih tetap:
                          di tema gelap warna merek jadi terang, dan putih di
                          atasnya praktis hilang. */}
                      <span
                        aria-hidden="true"
                        className={cx(
                          'absolute left-0 top-1 size-4 rounded-full border-2 grid place-items-center',
                          lewat ? 'bg-brand border-brand text-ink-inverse' : 'bg-surface border-line-strong',
                        )}
                      >
                        {lewat && <IkonCentang size={10} strokeWidth={3.5} />}
                      </span>
                      <p className={cx('text-[0.9375rem] leading-snug', lewat ? 'font-bold text-ink' : 'font-semibold text-ink-3')}>
                        {judul}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug max-w-[68ch]">
                        {jejak ? `${tanggalPendek(jejak.waktu)}, ${jam(jejak.waktu)} · ${jejak.keterangan}` : l.bila}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          {/* 2c. Bukti antar dari distributor (catatan A5). Muncul begitu
              distributor menandai barang sampai, sebelum pemilik usaha
              menghitungnya, karena di saat itulah bukti ini paling berguna. */}
          {pesanan.pengiriman && (
            <KartuBuktiPengiriman
              bukti={pesanan.pengiriman}
              keterangan={
                pesanan.status === 'dikirim'
                  ? 'Distributor menandai barangnya sudah sampai. Hitung dulu barangnya, lalu tekan Barang Sudah Sampai supaya stok gudang bertambah.'
                  : undefined
              }
            />
          )}

          {/* 3. Rincian harga */}
          <section aria-labelledby="judul-rincian">
            <Kartu>
              <h2 id="judul-rincian" className="text-[0.9375rem] font-bold text-ink mb-3">
                Rincian Pesanan
              </h2>
              <div className="space-y-3">
                {pesanan.baris.map((b) => {
                  const promo = promoBaris(b)
                  const dipotong = b.hargaNormal != null && b.hargaNormal > b.hargaSatuan
                  return (
                    <div key={b.penawaranId} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[1rem] font-semibold text-ink leading-snug">{b.nama}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-3 tabular">
                          {angka(b.jumlah)} {b.satuan} &times; {rupiah(b.hargaSatuan)}
                        </p>
                        {/* Lencana ditaruh di kolom kiri yang min-w-0 dan diberi
                            wadah blok sendiri: di layar 360px ia turun ke baris
                            baru, bukan mendorong angka subtotal ke luar layar. */}
                        {(promo || dipotong) && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {promo && <LencanaPromo promo={promo} />}
                            {dipotong && (
                              <span className="text-[0.75rem] text-ink-3">
                                harga normal <s className="tabular">{rupiah(b.hargaNormal!)}</s>
                              </span>
                            )}
                          </div>
                        )}
                        {b.jumlahDiterima != null && b.jumlahDiterima !== b.jumlah && (
                          <p className="mt-1 text-[0.8125rem] text-menipis-ink font-semibold">
                            Diterima {angka(b.jumlahDiterima)} {b.satuan}
                            {b.catatanPenerimaan ? ` · ${b.catatanPenerimaan}` : ''}
                          </p>
                        )}
                      </div>
                      <p className="text-[0.9375rem] font-bold text-ink tabular shrink-0">
                        {rupiah(b.jumlah * b.hargaSatuan)}
                      </p>
                    </div>
                  )
                })}
              </div>

              <Pemisah className="my-3" />
              <div className="flex items-baseline justify-between gap-4 py-1">
                <span className="text-[0.8125rem] text-ink-3">Subtotal barang</span>
                <span className="text-[0.875rem] font-semibold text-ink tabular">{rupiah(subtotal)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-1">
                <span className="text-[0.8125rem] text-ink-3">Ongkos kirim</span>
                <span className="text-[0.875rem] font-semibold text-ink tabular">
                  {pesanan.ongkosKirim > 0 ? rupiah(pesanan.ongkosKirim) : 'Gratis'}
                </span>
              </div>
              <Pemisah className="my-2" />
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.875rem] font-bold text-ink">Total</span>
                <span className="text-[1.25rem] font-extrabold text-ink">{rupiah(total)}</span>
              </div>

              {/* Kalimat baku, satu sumber dengan keranjang dan detail penawaran. */}
              {adaBarisPromo && (
                <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed max-w-[68ch]">
                  {KALIMAT_PROMO.sudahDipotong}
                </p>
              )}

              {pesanan.catatanUntukDistributor && (
                <p className="mt-3 text-[0.8125rem] text-ink-2 bg-sunken rounded-md px-3 py-2.5 leading-relaxed max-w-[68ch]">
                  Catatan kamu untuk distributor: &ldquo;{pesanan.catatanUntukDistributor}&rdquo;
                </p>
              )}
            </Kartu>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* 2b. Jalur pembayaran: sengaja berbentuk kotak, bukan garis waktu */}
          <section
            aria-labelledby="judul-pembayaran"
            className="bg-surface-2 border-2 border-dashed border-line-strong rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="judul-pembayaran" className="text-[0.9375rem] font-bold text-ink">
                  Pembayaran
                </h2>
                <p className="text-[0.75rem] text-ink-3">Dicatat di luar aplikasi</p>
              </div>
              <Lencana
                nada={pesanan.statusBayar === 'dikonfirmasi' ? 'aman' : pesanan.statusBayar === 'bukti-terkirim' ? 'info' : 'menipis'}
                ikon={<IkonNota size={13} />}
                besar
              >
                {LABEL_BAYAR[pesanan.statusBayar]}
              </Lencana>
            </div>

            <p className="mt-3 text-[1.5rem] font-bold text-ink leading-none">{rupiah(total)}</p>
            <p className="mt-1 text-[0.8125rem] text-ink-3">
              {pesanan.jumlahBukti > 0
                ? `${pesanan.jumlahBukti} bukti tersimpan. Boleh tambah lagi kalau kamu bayar bertahap (DP).`
                : 'Belum ada bukti yang kamu simpan di sini.'}
            </p>

            <div className="mt-3 space-y-2">
              <input
                ref={berkasRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                aria-hidden="true"
                aria-label="Pilih foto atau berkas bukti transfer"
                tabIndex={-1}
                className="sr-only"
                onChange={padaBerkasBukti}
              />
              <Tombol
                ragam="sekunder"
                penuh
                ikonKiri={<IkonUnggah size={16} />}
                onClick={() => berkasRef.current?.click()}
              >
                Unggah Bukti Transfer
              </Tombol>
              {/* Tombol tunai hanya muncul selama belum ada catatan pembayaran:
                  menekannya setelah distributor mengonfirmasi justru akan
                  memundurkan status yang sudah beres. Teks penggantinya tidak
                  mengulang bunyi lencana di atas, tapi menjawab "lalu apa". */}
              {pesanan.statusBayar === 'belum-dibayar' ? (
                <button
                  type="button"
                  onClick={() => tandaiBayarTunai(ps.id)}
                  className="w-full min-h-11 text-[0.875rem] font-semibold text-brand hover:underline"
                >
                  Tandai sudah dibayar tunai
                </button>
              ) : (
                <p className="text-center text-[0.8125rem] text-ink-3 leading-snug px-2">
                  {pesanan.statusBayar === 'dikonfirmasi'
                    ? 'Tidak ada lagi yang perlu kamu kirim untuk pesanan ini.'
                    : 'Tinggal menunggu distributor mencocokkannya. Kamu tidak perlu mengirim apa pun lagi.'}
                </p>
              )}
            </div>

            <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">{BANTUAN.bayarLuarPanjang}</p>
          </section>

          {/* 4. Ajakan menilai: satu-satunya pintu masuk menulis ulasan */}
          {selesai && !pesanan.sudahDiulas && (
            <Peringatan
              nada="info"
              judul="Beri Penilaian untuk distributor ini"
              aksi={
                <TombolTautan ke={`/pesanan/${pesanan.id}/ulasan`} ukuran="kecil" ikonKiri={<IkonBintang size={15} />}>
                  Beri Penilaian
                </TombolTautan>
              }
            >
              Penilaianmu membantu pemilik usaha lain memilih pemasok. Bisa juga nanti lewat Akun &rsaquo; Ulasan Saya.
            </Peringatan>
          )}

          {/* 5. Jejak privasi: siapa melihat apa, dan sejak kapan */}
          <p className="flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-relaxed">
            <IkonMata size={15} className="shrink-0 mt-0.5" />
            <span>
              Distributor ini bisa melihat{' '}
              {profil.tampilkanAlamatKeDistributor && profil.tampilkanNomorHpKeDistributor
                ? 'alamat & nomor HP kamu'
                : profil.tampilkanAlamatKeDistributor
                  ? 'alamat kamu'
                  : profil.tampilkanNomorHpKeDistributor
                    ? 'nomor HP kamu'
                    : 'nama usaha kamu'}{' '}
              (terbuka {tanggalRingkas(pesanan.dibuatPada)} karena pesanan ini).{' '}
              <Link to="/akun/profil" className="font-semibold text-brand hover:underline">
                Atur di Profil
              </Link>
            </span>
          </p>
        </div>
      </div>

      {/* 6. Satu tombol aksi utama, berubah menurut status.
             Tidak pernah ada tombol mati tanpa keterangan. */}
      {pesanan.status !== 'batal' && (
        <BilahAksi>
          {pesanan.status === 'draf' && (
            <div className="space-y-2">
              {terkunci ? (
                <TombolTerkunci label="Kirim Pesanan Sekarang" penuh />
              ) : (
                <Tombol penuh ukuran="besar" onClick={() => kirimDraf(ps.id)}>
                  Kirim Pesanan Sekarang
                </Tombol>
              )}
              <button
                type="button"
                onClick={() => setDialogBatal('langsung')}
                className="w-full min-h-11 text-[0.875rem] font-semibold text-ink-3 hover:text-kritis"
              >
                Batalkan Pesanan
              </button>
              <p className="text-center text-[0.8125rem] text-ink-3 leading-snug">
                Draf ini belum pernah sampai ke distributor, jadi membatalkannya tidak mengganggu siapa pun.
              </p>
            </div>
          )}

          {pesanan.status === 'menunggu-konfirmasi' && (
            <div className="space-y-2">
              <Tombol ragam="garis" penuh ukuran="besar" onClick={() => setDialogBatal('langsung')}>
                Batalkan Pesanan
              </Tombol>
              <p className="text-center text-[0.8125rem] text-ink-3">
                Distributor belum mulai menyiapkan, jadi pembatalan masih langsung berlaku.
              </p>
            </div>
          )}

          {(pesanan.status === 'disiapkan' || pesanan.status === 'dikirim') && (
            <div className="space-y-2">
              <TombolTautan ke={`/pesanan/${pesanan.id}/terima`} penuh ukuran="besar" ikonKiri={<IkonPasokan size={18} />}>
                Barang Sudah Sampai
              </TombolTautan>
              {/* Barang yang sudah diserahkan tidak bisa dibatalkan lagi; yang
                  tersisa hanya menghitungnya dan mencatat selisih kalau ada. */}
              {pesanan.pengiriman ? (
                <p className="text-center text-[0.8125rem] text-ink-3 leading-snug">
                  Barang sudah diserahkan. Kalau jumlahnya beda atau ada yang rusak, catat di langkah berikutnya.
                </p>
              ) : !pembatalanDiajukan && (
                <>
                  <button
                    type="button"
                    onClick={() => setDialogBatal('ajukan')}
                    className="w-full min-h-11 text-[0.875rem] font-semibold text-ink-3 hover:text-kritis"
                  >
                    Ajukan Pembatalan
                  </button>
                  <p className="text-center text-[0.8125rem] text-ink-3 leading-snug">
                    Barang mungkin sudah disiapkan. Distributor akan mengonfirmasi dulu.
                  </p>
                </>
              )}
            </div>
          )}

          {selesai && (
            <div className="space-y-2">
              {pesanan.sudahDiulas ? (
                <TombolTautan ke="/pesanan?tab=pesanan&status=selesai" ragam="garis" penuh ukuran="besar">
                  Kembali ke Daftar Pesanan
                </TombolTautan>
              ) : (
                <TombolTautan ke={`/pesanan/${pesanan.id}/ulasan`} penuh ukuran="besar" ikonKiri={<IkonBintang size={18} />}>
                  Beri Penilaian untuk distributor ini
                </TombolTautan>
              )}
              <p className="text-center text-[0.8125rem] text-ink-3">
                Pesanan sudah selesai, jadi tidak ada lagi pembatalan di sini.
              </p>
            </div>
          )}
        </BilahAksi>
      )}

      <Lembar
        terbuka={dialogBatal !== null}
        tutup={() => setDialogBatal(null)}
        judul={dialogBatal === 'ajukan' ? 'Ajukan Pembatalan' : 'Batalkan Pesanan'}
        keterangan={
          dialogBatal === 'ajukan'
            ? 'Barang mungkin sudah disiapkan. Distributor akan mengonfirmasi dulu.'
            : 'Pilih alasannya supaya distributor tahu apa yang perlu diperbaiki.'
        }
        lebar="sempit"
        kunciLatar
        kaki={
          <div className="flex gap-2.5">
            <Tombol ragam="garis" penuh onClick={() => setDialogBatal(null)}>
              Tidak jadi
            </Tombol>
            <Tombol ragam="bahaya" penuh onClick={konfirmasiBatal}>
              {dialogBatal === 'ajukan' ? 'Kirim Permintaan' : 'Batalkan Pesanan'}
            </Tombol>
          </div>
        }
      >
        <div className="pb-4">
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2.5">Alasan pembatalan</p>
          <BarisChip className="flex-wrap">
            {ALASAN_BATAL.map((a) => (
              <Chip key={a} aktif={alasan === a} onClick={() => setAlasan(a)}>
                {a}
              </Chip>
            ))}
          </BarisChip>
          <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
            {pesanan.nomor} ke {distributor?.nama}, total {rupiah(total)}.
          </p>
        </div>
      </Lembar>
    </div>
  )
}
