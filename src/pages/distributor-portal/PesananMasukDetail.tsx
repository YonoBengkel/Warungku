import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LencanaPromo } from '@/components/domain/KartuPromo'
import { Avatar, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonBintang,
  IkonBintangIsi,
  IkonCentang,
  IkonKotak,
  IkonLokasi,
  IkonPanahKanan,
  IkonPasokan,
  IkonSilang,
  IkonTelepon,
  IkonToko,
} from '@/icons'
import { angka, cx, jam, nomorHp, rupiah, tanggalPendek, waktuLalu } from '@/lib/format'
import { LABEL_JENIS_USAHA, LABEL_PESANAN_MASUK, NADA_PESANAN_MASUK } from '@/lib/label'
import { promoById, umkmById } from '@/data/dummy'
import type { StatusPesananMasuk } from '@/lib/types'
import { useAplikasi, usePesananMasuk } from '@/store/aplikasi'
import { LembarTolak, totalPesananMasuk } from './PesananMasukDaftar'

/**
 * Rincian satu pesanan yang masuk ke distributor.
 *
 * Halaman ini adalah pintu ke peta sebaran: tiap baris barang punya tautan
 * "Lihat sebaran pemesan barang ini". Pintunya sengaja ada PER BARIS, bukan
 * satu tautan di kaki halaman, karena satu pesanan bisa memuat tiga barang
 * dengan sebaran pemesan yang sama sekali berbeda.
 *
 * Tidak ada tombol bayar dan tidak ada status pembayaran di sini. Uang
 * berpindah di luar aplikasi; menaruh tombolnya di layar ini akan membuat
 * orang mengira aplikasinya ikut menagih.
 */

/**
 * Titik bulat pada garis waktu.
 *
 * Bentuk ikonnya ikut berganti, bukan cuma warnanya: kejadian "ditolak" tidak
 * boleh muncul sebagai centang berwarna lain. Label teksnya tetap ada di
 * sebelah kanan tiap titik.
 */
const TITIK_JEJAK: Record<StatusPesananMasuk, { latar: string; Ikon: typeof IkonCentang | null }> = {
  // Titiknya cuma 14px. Ikon yang lebih rumit dari centang atau silang berubah
  // jadi noda pada ukuran itu, jadi tahap pertama dibiarkan bulatan polos —
  // maknanya tetap dibawa oleh label teks di sebelahnya.
  'menunggu-konfirmasi': { latar: 'bg-menipis', Ikon: null },
  disiapkan: { latar: 'bg-info', Ikon: IkonCentang },
  dikirim: { latar: 'bg-info', Ikon: IkonCentang },
  selesai: { latar: 'bg-aman', Ikon: IkonCentang },
  ditolak: { latar: 'bg-kritis', Ikon: IkonSilang },
}

export default function PesananMasukDetail() {
  const { id = '' } = useParams()
  const pesanan = usePesananMasuk().find((p) => p.id === id)
  const terimaPesananMasuk = useAplikasi((s) => s.terimaPesananMasuk)
  const majukanPesananMasuk = useAplikasi((s) => s.majukanPesananMasuk)
  const [lembarTolak, setLembarTolak] = useState(false)

  if (!pesanan) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Pesanan" kembaliKe="/distributor-portal/pesanan" />
        {/* Judul tingkat dua menjaga urutan h1 → h2 walaupun isinya cuma satu blok. */}
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Pesanan tidak ditemukan
          </h2>
          <KeadaanKosong
            tingkat="h3"
            ikon={<IkonPasokan size={26} />}
            judul="Pesanan ini sudah tidak ada"
            pesan="Tautannya mungkin sudah lama atau nomornya berubah. Daftar pesanan kamu masih lengkap di halaman Pesanan."
            aksi={
              <TombolTautan ke="/distributor-portal/pesanan">Kembali ke Daftar Pesanan</TombolTautan>
            }
          />
        </section>
      </div>
    )
  }

  const p = pesanan
  const umkm = umkmById(p.umkmId)
  const subtotal = p.baris.reduce((a, b) => a + b.jumlah * b.hargaSatuan, 0)
  const total = totalPesananMasuk(p)
  const perluDijawab = p.status === 'menunggu-konfirmasi'

  const labelMaju =
    p.status === 'disiapkan'
      ? 'Tandai Sedang Dikirim'
      : p.status === 'dikirim'
        ? 'Tandai Sudah Sampai'
        : null

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={p.nomor}
        keterangan={umkm?.nama ?? 'Pemilik usaha'}
        kembaliKe="/distributor-portal/pesanan"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Lencana nada={NADA_PESANAN_MASUK[p.status]} besar>
          {LABEL_PESANAN_MASUK[p.status]}
        </Lencana>
        <span className="text-[0.8125rem] text-ink-3">Masuk {waktuLalu(p.dibuatPada)}</span>
      </div>

      {p.status === 'ditolak' && (
        <Peringatan nada="kritis" judul="Pesanan ini kamu tolak" className="mt-3 lg:max-w-[70ch]">
          Alasan yang terkirim ke pemilik usaha: &ldquo;{p.alasanTolak}&rdquo;
        </Peringatan>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Siapa yang memesan */}
          <section aria-labelledby="judul-pemesan">
            <Kartu>
              <h2 id="judul-pemesan" className="text-[0.9375rem] font-bold text-ink mb-3">
                Pemesan
              </h2>
              {umkm ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar nama={umkm.nama} warna={umkm.warna} ukuran={44} />
                    <div className="min-w-0">
                      <p className="text-[1.0625rem] font-bold text-ink leading-snug">{umkm.nama}</p>
                      <p className="text-[0.8125rem] text-ink-3 leading-snug">{LABEL_JENIS_USAHA[umkm.jenisUsaha].judul}</p>
                    </div>
                  </div>

                  <p className="mt-3 flex items-start gap-2 text-[0.875rem] text-ink-2 leading-relaxed">
                    <IkonLokasi size={16} className="shrink-0 mt-0.5 text-ink-3" />
                    <span>
                      {umkm.alamat}
                      <span className="block text-ink-3">{umkm.kota}</span>
                    </span>
                  </p>

                  <a
                    href={`tel:${umkm.nomorHp}`}
                    className="mt-1 inline-flex items-center gap-2 min-h-11 text-[0.875rem] font-semibold text-brand hover:underline"
                  >
                    <IkonTelepon size={16} />
                    {nomorHp(umkm.nomorHp)}
                  </a>
                </>
              ) : (
                <p className="text-[0.875rem] text-ink-2">
                  Data pemilik usaha ini belum lengkap di catatan kami.
                </p>
              )}

              {p.catatanDariUmkm && (
                <p className="mt-3 text-[0.8125rem] text-ink-2 bg-sunken rounded-md px-3 py-2.5 leading-relaxed max-w-[68ch]">
                  Catatan dari pemesan: &ldquo;{p.catatanDariUmkm}&rdquo;
                </p>
              )}
            </Kartu>
          </section>

          {/* 2. Barang yang dipesan, lengkap dengan pintu ke peta sebaran */}
          <section aria-labelledby="judul-barang">
            <Kartu>
              <h2 id="judul-barang" className="text-[0.9375rem] font-bold text-ink mb-3">
                Barang yang Dipesan
              </h2>
              <div className="space-y-3">
                {p.baris.map((b) => {
                  /* Promo dibaca dari catatan baris, bukan ditebak dari tanggal:
                     potongannya sudah masuk ke harga saat pemesan mengirim, dan
                     catatan pesanan tidak boleh berubah belakangan. */
                  const promo = b.promoId ? promoById(b.promoId) : undefined
                  const dipotong = b.hargaNormal != null && b.hargaNormal > b.hargaSatuan
                  return (
                  <div key={b.penawaranId}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[1rem] font-semibold text-ink leading-snug">{b.nama}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-3 tabular">
                          {angka(b.jumlah)} {b.satuan} &times; {rupiah(b.hargaSatuan)}
                        </p>
                        {/* Tanpa tautan: /promo/:id milik portal pemilik usaha,
                            dan kamu tidak boleh dilempar keluar portalmu sendiri.
                            Wadah bloknya membuat lencana turun baris di 360px,
                            bukan mendorong angka subtotal ke luar layar. */}
                        {(promo || dipotong) && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {promo && <LencanaPromo promo={promo} tanpaTautan />}
                            {dipotong && (
                              <span className="text-[0.75rem] text-ink-3">
                                harga normal <s className="tabular">{rupiah(b.hargaNormal!)}</s>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-[0.9375rem] font-bold text-ink tabular shrink-0">
                        {rupiah(b.jumlah * b.hargaSatuan)}
                      </p>
                    </div>
                    <Link
                      to={`/distributor-portal/lacak/barang/${b.penawaranId}`}
                      className="inline-flex items-center gap-1.5 min-h-11 text-[0.8125rem] font-semibold text-brand hover:underline"
                    >
                      <IkonLokasi size={15} />
                      Lihat sebaran pemesan barang ini
                      <IkonPanahKanan size={15} />
                    </Link>
                  </div>
                  )
                })}
              </div>

              <Pemisah className="my-3" />
              <div className="flex items-baseline justify-between gap-4 py-1">
                <span className="text-[0.8125rem] text-ink-3">Subtotal barang</span>
                <span className="text-[0.875rem] font-semibold text-ink tabular">
                  {rupiah(subtotal)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-1">
                <span className="text-[0.8125rem] text-ink-3">Ongkos kirim</span>
                <span className="text-[0.875rem] font-semibold text-ink tabular">
                  {p.ongkosKirim > 0 ? rupiah(p.ongkosKirim) : 'Gratis'}
                </span>
              </div>
              <Pemisah className="my-2" />
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.875rem] font-bold text-ink">Total</span>
                <span className="text-[1.25rem] font-extrabold text-ink">{rupiah(total)}</span>
              </div>
              {/* Tidak ada tombol bayar dan tidak ada status pembayaran:
                  uangnya berpindah di luar aplikasi. */}
              <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">
                Pembayaran dicatat di luar aplikasi, jadi angka di atas hanya nilai pesanannya.
              </p>
            </Kartu>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* 3. Jejak: satu baris per kejadian, ikon + teks, bukan warna saja */}
          <section aria-labelledby="judul-jejak">
            <Kartu>
              <h2 id="judul-jejak" className="text-[0.9375rem] font-bold text-ink mb-3">
                Jejak Pesanan
              </h2>
              <ol>
                {p.jejak.map((j, i) => {
                  const { latar, Ikon } = TITIK_JEJAK[j.status]
                  return (
                    <li key={`${j.waktu}-${i}`} className="relative pl-7 pb-4 last:pb-0">
                      {i < p.jejak.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[6px] top-4 bottom-0 border-l-2 border-dotted border-line-strong"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={cx(
                          'absolute left-0 top-1 size-3.5 rounded-full grid place-items-center text-ink-inverse',
                          latar,
                        )}
                      >
                        {Ikon && <Ikon size={9} strokeWidth={3.5} />}
                      </span>
                      <p className="text-[0.875rem] font-semibold text-ink leading-snug">
                        {LABEL_PESANAN_MASUK[j.status]}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug max-w-[60ch]">
                        {tanggalPendek(j.waktu)}, {jam(j.waktu)} &middot; {j.keterangan}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </Kartu>
          </section>

          {/* 4. Bukti pengiriman, hanya setelah barang sampai */}
          {p.status === 'selesai' && p.pengiriman && (
            <section aria-labelledby="judul-bukti">
              <Kartu>
                <h2 id="judul-bukti" className="text-[0.9375rem] font-bold text-ink mb-3">
                  Bukti Pengiriman
                </h2>
                <dl className="space-y-1.5">
                  <BarisBukti label="Jasa kirim" nilai={p.pengiriman.kurir} />
                  <BarisBukti label="Pengantar" nilai={p.pengiriman.namaPengantar} />
                  <BarisBukti label="Nomor resi" nilai={p.pengiriman.nomorResi} />
                  <BarisBukti label="Diterima oleh" nilai={p.pengiriman.diterimaOleh} />
                  <BarisBukti
                    label="Waktu sampai"
                    nilai={`${tanggalPendek(p.pengiriman.waktuSampai)}, ${jam(p.pengiriman.waktuSampai)}`}
                  />
                </dl>

                <p className="mt-3 text-[0.8125rem] text-ink-2 leading-relaxed max-w-[60ch]">
                  {p.pengiriman.catatan}
                </p>

                {/* Bingkai berlabel, bukan gambar. Foto palsu akan membuat layar
                    ini terlihat lebih jadi daripada keadaannya. */}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {p.pengiriman.foto.map((keterangan) => (
                    <div
                      key={keterangan}
                      className="border-2 border-dashed border-line-strong rounded-md p-3 text-center"
                    >
                      <IkonKotak size={20} className="mx-auto text-ink-3" />
                      <p className="mt-1.5 text-[0.75rem] text-ink-2 leading-snug">{keterangan}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[0.75rem] text-ink-3 leading-relaxed">
                  Berkas fotonya belum ikut disimpan di purwarupa ini, yang tercatat baru
                  keterangannya.
                </p>
              </Kartu>
            </section>
          )}

          {/* 5. Ulasan dari pemilik usaha */}
          {p.status === 'selesai' && p.ulasan && (
            <section aria-labelledby="judul-ulasan">
              <Kartu>
                <h2 id="judul-ulasan" className="text-[0.9375rem] font-bold text-ink mb-3">
                  Penilaian dari Pemesan
                </h2>
                <Bintang nilai={p.ulasan.rating} />
                {/* Cerita ulasan boleh dikosongkan pemesan; kutipan kosong tidak ditampilkan. */}
                {p.ulasan.isi && (
                  <p className="mt-2 text-[0.875rem] text-ink-2 leading-relaxed max-w-[60ch]">
                    &ldquo;{p.ulasan.isi}&rdquo;
                  </p>
                )}
                <p className="mt-1 text-[0.75rem] text-ink-3">Ditulis {waktuLalu(p.ulasan.waktu)}</p>

                <Pemisah className="my-3" />
                <dl className="space-y-1.5">
                  <BarisBukti
                    label="Ketepatan waktu"
                    nilai={`${angka(p.ulasan.aspek.ketepatanWaktu, 1)} dari 5`}
                  />
                  <BarisBukti
                    label="Jumlah sesuai"
                    nilai={`${angka(p.ulasan.aspek.jumlahSesuai, 1)} dari 5`}
                  />
                  <BarisBukti
                    label="Kondisi barang"
                    nilai={`${angka(p.ulasan.aspek.kondisiBarang, 1)} dari 5`}
                  />
                </dl>
              </Kartu>
            </section>
          )}

          {p.status === 'selesai' && !p.ulasan && (
            <p className="flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-relaxed">
              <IkonToko size={15} className="shrink-0 mt-0.5" />
              <span>Pemilik usaha ini belum menulis penilaian untuk pesanan tersebut.</span>
            </p>
          )}
        </div>
      </div>

      {/* 6. Aksi menempel di bawah, isinya berubah menurut tahap */}
      {(perluDijawab || labelMaju) && (
        <BilahAksi>
          {perluDijawab ? (
            <div className="flex gap-2.5">
              <Tombol
                penuh
                ukuran="besar"
                ikonKiri={<IkonCentang size={18} />}
                onClick={() => terimaPesananMasuk(p.id)}
              >
                Terima
              </Tombol>
              <Tombol
                ragam="garis"
                penuh
                ukuran="besar"
                ikonKiri={<IkonSilang size={18} />}
                onClick={() => setLembarTolak(true)}
              >
                Tolak
              </Tombol>
            </div>
          ) : (
            <Tombol penuh ukuran="besar" onClick={() => majukanPesananMasuk(p.id)}>
              {labelMaju}
            </Tombol>
          )}
        </BilahAksi>
      )}

      {lembarTolak && <LembarTolak pesanan={p} tutup={() => setLembarTolak(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Potongan kecil                                                      */
/* ------------------------------------------------------------------ */

function BarisBukti({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[0.8125rem] text-ink-3 shrink-0">{label}</dt>
      <dd className="text-[0.875rem] font-semibold text-ink text-right min-w-0 break-words">
        {nilai}
      </dd>
    </div>
  )
}

/** Bintang selalu ditemani angkanya, supaya tidak bergantung pada bentuk saja. */
function Bintang({ nilai }: { nilai: number }) {
  return (
    <p className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5 text-menipis" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) =>
          i <= nilai ? <IkonBintangIsi key={i} size={16} /> : <IkonBintang key={i} size={16} />,
        )}
      </span>
      <span className="text-[0.9375rem] font-bold text-ink">{angka(nilai, 1)} dari 5</span>
    </p>
  )
}
