import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KartuHitungTitik, PetaSebaran } from '@/components/domain/PetaSebaran'
import { BarisData, JudulBagian, Kartu, Lencana, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { BarisChip, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import {
  IkonCentangLingkaran,
  IkonGudang,
  IkonJam,
  IkonKirim,
  IkonKotak,
  IkonLokasi,
  IkonPanahKanan,
  IkonSilang,
  IkonTelepon,
} from '@/icons'
import { angka, cx, jumlahSatuan, nomorHp, rupiah, waktuLalu } from '@/lib/format'
import { LABEL_JENIS_USAHA, LABEL_PESANAN_MASUK, NADA_PESANAN_MASUK } from '@/lib/label'
import type { PesananMasuk, StatusPesananMasuk } from '@/lib/types'
import { distributorAktif, umkmById } from '@/data/dummy'
import { useAplikasi, usePesananMasuk, useTitikPeta } from '@/store/aplikasi'

/**
 * Sebaran pemesan (catatan B3, B5, B6).
 *
 * Satu-satunya peta di portal sejak menu Lacak Pesanan dihapus. Tanpa barang
 * terpilih ia memperlihatkan seluruh pemesan; dengan barang terpilih
 * (`/sebaran/:penawaranId`, dibuka dari tautan "Lihat sebaran" di tiap barang
 * pesanan) ia menjawab "barang ini sedang ditunggu siapa saja".
 *
 * Di desktop seluruh halaman muat satu layar: kolom kiri hitungan titik dan
 * peta, kolom kanan info barang dan daftar toko yang digulir di dalam
 * kolomnya sendiri. Di HP keduanya bertumpuk seperti biasa.
 *
 * Hitungan titik sengaja diletakkan DI ATAS peta: angkanya yang paling sering
 * dicari, dan menaruhnya di bawah peta berarti orang harus menggulir melewati
 * gambar dulu setiap kali membuka halaman.
 */

/** Status yang dihitung sebagai "Stok Dipesan": belum sampai di pemilik usaha. */
const STATUS_DIPESAN: StatusPesananMasuk[] = ['menunggu-konfirmasi', 'disiapkan', 'dikirim']

/** Status selalu ikon + teks + warna. Ikon sendirian tidak pernah jadi maknanya. */
const IKON_STATUS: Record<StatusPesananMasuk, ReactNode> = {
  'menunggu-konfirmasi': <IkonJam size={13} />,
  disiapkan: <IkonGudang size={13} />,
  dikirim: <IkonKirim size={13} />,
  selesai: <IkonCentangLingkaran size={13} />,
  ditolak: <IkonSilang size={13} />,
}

function LencanaStatus({ status }: { status: StatusPesananMasuk }) {
  return (
    <Lencana nada={NADA_PESANAN_MASUK[status]} ikon={IKON_STATUS[status]}>
      {LABEL_PESANAN_MASUK[status]}
    </Lencana>
  )
}

export default function PetaSebaranBarang() {
  const { penawaranId } = useParams()
  const navigate = useNavigate()
  const katalog = useAplikasi((s) => s.katalog)
  const barangSaya = katalog.filter((p) => p.distributorId === distributorAktif.id)

  // Pemiliknya ikut diperiksa: tanpa itu tautan ke barang distributor lain
  // membuka nama, harga satuan, dan stok pesaing di halaman ini. Barang orang
  // lain diperlakukan seperti tidak ada.
  const penawaran = penawaranId ? barangSaya.find((p) => p.id === penawaranId) : undefined
  const barangTidakAda = penawaranId != null && !penawaran

  const titik = useTitikPeta(penawaran?.id)
  const pesananMasuk = usePesananMasuk()
  const [dipilih, setDipilih] = useState<string | null>(null)

  const terpilih = titik.find((t) => t.umkmId === dipilih) ?? null
  const umkm = terpilih ? umkmById(terpilih.umkmId) : undefined

  /* Stok Dipesan (B5): jumlah barang ini di pesanan yang belum sampai, yaitu
     menunggu, disiapkan, dan dikirim. Bukan stok gudang: angka ini menjawab
     "berapa yang sedang ditunggu pemesan". */
  const dipesan = useMemo(() => {
    if (!penawaran) return null
    let jumlah = 0
    let pesanan = 0
    for (const p of pesananMasuk) {
      if (!STATUS_DIPESAN.includes(p.status)) continue
      const baris = p.baris.find((b) => b.penawaranId === penawaran.id)
      if (!baris) continue
      jumlah += baris.jumlah
      pesanan += 1
    }
    return { jumlah, pesanan }
  }, [penawaran, pesananMasuk])

  // Pesanan dibaca dari store, bukan dari data contoh, supaya perubahan status
  // yang baru saja dilakukan di layar Pesanan langsung ikut terlihat di sini.
  const pesananTerpilih = useMemo<PesananMasuk[]>(() => {
    if (!terpilih) return []
    const indeks = new Map<string, PesananMasuk>(pesananMasuk.map((p) => [p.id, p]))
    return terpilih.pesananIds
      .map((id) => indeks.get(id))
      .filter((p): p is PesananMasuk => Boolean(p))
      .sort((a, b) => +new Date(b.dibuatPada) - +new Date(a.dibuatPada))
  }, [terpilih, pesananMasuk])

  const daftarTitikTerurut = useMemo(
    () =>
      [...titik]
        .map((t) => ({ t, nama: umkmById(t.umkmId)?.nama ?? 'Toko' }))
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [titik],
  )

  function pilihBarang(id: string | null) {
    setDipilih(null)
    navigate(id ? `/distributor-portal/sebaran/${id}` : '/distributor-portal/sebaran', { replace: true })
  }

  if (barangTidakAda) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Barang tidak ditemukan" keterangan="Sebaran pemesan" kembaliKe="/distributor-portal/sebaran" />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barangnya tidak ada di katalogmu"
          pesan="Tautannya mungkin sudah lama, atau barangnya bukan milik tokomu. Sebaran semua barang tetap bisa kamu lihat."
          aksi={<TombolTautan ke="/distributor-portal/sebaran">Lihat Sebaran Semua Barang</TombolTautan>}
        />
      </div>
    )
  }

  return (
    // Desktop: tinggi halaman dikunci ke layar (kepala portal 3,5rem dengan
    // garis bawahnya 1px, plus jarak atas-bawah 3rem), lalu isinya menggulir
    // di dalam kotaknya sendiri-sendiri.
    <div className="pb-6 lg:pb-0 lg:h-[calc(100dvh-6.5rem-1px)] lg:flex lg:flex-col">
      <KepalaHalaman
        judul={penawaran ? penawaran.nama : 'Sebaran pemesan'}
        keterangan={penawaran ? 'Sebaran UMKM yang memesan barang ini' : 'Semua barang yang sedang dipesan'}
        kembaliKe="/distributor-portal/pesanan"
      />

      {/* Pilihan barang: pengganti daftar di halaman Lacak yang sudah dihapus. */}
      <div role="group" aria-label="Pilih barang" className="mt-3 lg:shrink-0">
        <BarisChip>
          <Chip aktif={!penawaran} onClick={() => pilihBarang(null)}>
            Semua barang
          </Chip>
          {barangSaya.map((p) => (
            <Chip key={p.id} aktif={penawaran?.id === p.id} onClick={() => pilihBarang(p.id)}>
              {p.nama}
            </Chip>
          ))}
        </BarisChip>
      </div>

      {/* HP: info barang, hitungan titik, peta, lalu rincian toko, bertumpuk
          dalam urutan itu (hitungan selalu di atas peta). Desktop: peta
          mengisi kolom kiri setinggi layar; di kanan hitungan titik paling
          atas supaya terlihat tanpa menggulir, lalu info barang dan rincian
          toko yang menggulir di dalam kotaknya sendiri. */}
      <div
        className={cx(
          'mt-4 space-y-5 lg:space-y-0 lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-12 lg:gap-x-5 lg:gap-y-4',
          penawaran ? 'lg:grid-rows-[auto_auto_minmax(0,1fr)]' : 'lg:grid-rows-[auto_minmax(0,1fr)]',
        )}
      >
        {penawaran && dipesan && (
          <section aria-labelledby="judul-barang" className="lg:col-start-7 lg:col-span-6 lg:row-start-2">
            <Kartu>
              <JudulBagian id="judul-barang" judul="Tentang barang ini" />
              <BarisData label="Harga satuan" nilai={`${rupiah(penawaran.hargaSatuan)} / ${penawaran.satuan}`} />
              <BarisData label="Stok dipesan" nilai={jumlahSatuan(dipesan.jumlah, penawaran.satuan)} tebal />
              <p className="mt-1.5 text-[0.75rem] text-ink-3 leading-relaxed">
                {dipesan.pesanan > 0
                  ? `Dari ${dipesan.pesanan} pesanan yang belum sampai: menunggu, disiapkan, dan dikirim.`
                  : 'Belum ada pesanan berjalan yang memuat barang ini.'}
              </p>
            </Kartu>
          </section>
        )}
        <section aria-labelledby="judul-hitung" className="lg:col-start-7 lg:col-span-6 lg:row-start-1">
          <JudulBagian
            id="judul-hitung"
            judul="Hitungan titik"
            keterangan="Tiga kondisi, masing-masing dengan bentuk cincin dan keterangannya sendiri."
          />
          <KartuHitungTitik titik={titik} />
        </section>
        <section
          aria-labelledby="judul-peta"
          className={cx(
            'lg:col-start-1 lg:col-span-6 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto',
            penawaran ? 'lg:row-span-3' : 'lg:row-span-2',
          )}
        >
          <JudulBagian id="judul-peta" judul="Peta sebaran" />
          {titik.length === 0 ? (
            <Kartu>
              <KeadaanKosong
                tingkat="h3"
                ikon={<IkonLokasi size={26} />}
                judul="Belum ada titik"
                pesan="Tidak ada pesanan berjalan di sini, dan pesanan yang sudah sampai lebih dari 12 jam lalu memang hilang sendiri dari peta. Peta terisi lagi begitu ada pesanan baru."
              />
            </Kartu>
          ) : (
            <Kartu padat className="sm:p-4">
              <PetaSebaran titik={titik} dipilih={dipilih} pilih={setDipilih} />
            </Kartu>
          )}
        </section>
        {titik.length > 0 && (
          <section
            aria-labelledby="judul-panel"
            className={cx(
              'lg:col-start-7 lg:col-span-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1',
              penawaran ? 'lg:row-start-3' : 'lg:row-start-2',
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 id="judul-panel" className="text-[0.9375rem] font-bold text-ink leading-tight">
                  Rincian toko
                </h2>
                <p className="text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">
                  {umkm
                    ? penawaran
                      ? 'Pesanan toko ini untuk barang di atas.'
                      : 'Pesanan toko ini yang masih punya titik di peta.'
                    : 'Pilih satu titik di peta, atau satu nama di daftar.'}
                </p>
              </div>
              {umkm && (
                <TombolIkon label="Tutup rincian toko" onClick={() => setDipilih(null)}>
                  <IkonSilang size={20} />
                </TombolIkon>
              )}
            </div>

            <Kartu>
              {umkm && terpilih ? (
                <>
                  <h3 className="text-[1rem] font-extrabold text-ink leading-snug">{umkm.nama}</h3>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                    {LABEL_JENIS_USAHA[umkm.jenisUsaha].judul} &middot; {umkm.kota}
                  </p>

                  <dl className="mt-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
                        <IkonLokasi size={16} />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[0.75rem] text-ink-3">Alamat</dt>
                        <dd className="text-[0.875rem] text-ink leading-snug">{umkm.alamat}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-ink-3" aria-hidden="true">
                        <IkonTelepon size={16} />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[0.75rem] text-ink-3">Nomor HP</dt>
                        <dd className="text-[0.875rem] text-ink leading-snug">{nomorHp(umkm.nomorHp)}</dd>
                      </div>
                    </div>
                  </dl>

                  <h4 className="mt-4 text-[0.8125rem] font-bold text-ink-2 uppercase tracking-wide">
                    {angka(pesananTerpilih.length)} pesanan
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {pesananTerpilih.map((p) => {
                      const baris = penawaran ? p.baris.find((b) => b.penawaranId === penawaran.id) : undefined
                      return (
                        <li key={p.id}>
                          <Link
                            to={`/distributor-portal/pesanan/${p.id}`}
                            className="block rounded-md border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-ink text-[0.875rem] leading-snug">{p.nomor}</span>
                              <span className="shrink-0 text-ink-3" aria-hidden="true">
                                <IkonPanahKanan size={16} />
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <LencanaStatus status={p.status} />
                            </div>
                            <p className="mt-1.5 text-[0.875rem] text-ink-2">
                              {baris
                                ? jumlahSatuan(baris.jumlah, baris.satuan)
                                : `${p.baris.length} jenis barang`}
                            </p>
                            <p className="text-[0.75rem] text-ink-3">Masuk {waktuLalu(p.dibuatPada)}</p>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                    Angka di dalam titik adalah jumlah pesanan toko itu. Tekan titiknya untuk membuka rincian, atau
                    pilih namanya di bawah kalau titiknya berdempetan.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {daftarTitikTerurut.map(({ t, nama }) => (
                      <li key={t.umkmId}>
                        <button
                          type="button"
                          onClick={() => setDipilih(t.umkmId)}
                          className="w-full min-h-11 flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                        >
                          <span className="min-w-0 text-[0.875rem] font-semibold text-ink truncate">{nama}</span>
                          <span className="shrink-0 text-[0.75rem] text-ink-3 tabular">
                            {angka(t.jumlahPesanan)} pesanan
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Kartu>
          </section>
        )}
      </div>
    </div>
  )
}
