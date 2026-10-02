import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KartuHitungTitik, PetaSebaran } from '@/components/domain/PetaSebaran'
import {
  BarisData,
  JudulBagian,
  Kartu,
  Lencana,
  TombolIkon,
  TombolTautan,
} from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
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
import { angka, jumlahSatuan, nomorHp, rupiah, waktuLalu } from '@/lib/format'
import { LABEL_JENIS_USAHA, LABEL_PESANAN_MASUK, NADA_PESANAN_MASUK } from '@/lib/label'
import type { PesananMasuk, StatusPesananMasuk } from '@/lib/types'
import { distributorAktif, penawaranById, umkmById } from '@/data/dummy'
import { useAplikasi, useTitikPeta } from '@/store/aplikasi'

/**
 * Sebaran satu barang: siapa saja yang memesannya, dan sedang di tahap mana.
 *
 * Halaman ini dibuka saat sebuah barang di daftar lacak ditekan. Pertanyaan
 * yang dijawabnya bukan "pesanan ini sampai mana" melainkan "barang ini
 * sedang ditunggu siapa saja, dan menumpuk di sebelah mana" — jadi yang
 * ditampilkan sebaran seluruh toko, bukan satu pesanan.
 *
 * Hitungan titik sengaja diletakkan DI ATAS peta: angkanya yang paling sering
 * dicari, dan menaruhnya di bawah peta berarti orang harus menggulir melewati
 * gambar dulu setiap kali membuka halaman.
 */

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
  const { penawaranId = '' } = useParams()
  // Pemiliknya ikut diperiksa: tanpa itu tautan ke barang distributor lain
  // membuka nama, harga satuan, dan stok pesaing di halaman ini. Barang orang
  // lain diperlakukan seperti tidak ada, jadi keadaan kosong di bawah yang
  // menanganinya.
  const kandidat = penawaranById(penawaranId)
  const penawaran = kandidat?.distributorId === distributorAktif.id ? kandidat : undefined

  const titik = useTitikPeta(penawaranId)
  const pesananMasuk = useAplikasi((s) => s.pesananMasuk)
  const [dipilih, setDipilih] = useState<string | null>(null)

  const terpilih = titik.find((t) => t.umkmId === dipilih) ?? null
  const umkm = terpilih ? umkmById(terpilih.umkmId) : undefined

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

  const daftarTitikTerurut = useMemo(() => {
    return [...titik]
      .map((t) => ({ t, nama: umkmById(t.umkmId)?.nama ?? 'Toko' }))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }, [titik])

  if (!penawaran) {
    return (
      <div className="pb-6">
        <KepalaHalaman
          judul="Barang tidak ditemukan"
          keterangan="Sebaran UMKM yang memesan barang ini"
          kembaliKe="/distributor-portal/lacak"
        />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barangnya tidak ada di katalogmu"
          pesan="Tautannya mungkin sudah lama, atau barangnya sudah dihapus dari daftar jual. Kembali ke Lacak Pesanan untuk memilih barang yang masih ada."
          aksi={<TombolTautan ke="/distributor-portal/lacak">Kembali ke Lacak Pesanan</TombolTautan>}
        />
      </div>
    )
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul={penawaran.nama}
        keterangan="Sebaran UMKM yang memesan barang ini"
        kembaliKe="/distributor-portal/lacak"
      />

      {/* 1. Barangnya sendiri, supaya tidak perlu bolak-balik ke katalog */}
      <section aria-labelledby="judul-barang" className="mt-4">
        <Kartu>
          <JudulBagian id="judul-barang" judul="Tentang barang ini" />
          <BarisData label="Satuan" nilai={penawaran.satuan} />
          <BarisData label="Harga satuan" nilai={rupiah(penawaran.hargaSatuan)} />
          <BarisData
            label="Stok tersedia"
            nilai={jumlahSatuan(penawaran.stokTersedia, penawaran.satuan)}
            nada={penawaran.stokTersedia > 0 ? 'aman' : 'kritis'}
          />
          <p className="mt-2 text-[0.8125rem] text-ink-2 leading-relaxed">
            {penawaran.keterangan || 'Keterangan barang ini belum kamu tulis.'}
          </p>
        </Kartu>
      </section>

      {/* 2. Hitungan titik: di ATAS peta, sesuai permintaan */}
      <section aria-labelledby="judul-hitung" className="mt-5">
        <JudulBagian
          id="judul-hitung"
          judul="Hitungan titik"
          keterangan="Tiga kondisi, masing-masing dengan bentuk cincin dan keterangannya sendiri."
        />
        <KartuHitungTitik titik={titik} />
      </section>

      {titik.length === 0 ? (
        <KeadaanKosong
          ikon={<IkonLokasi size={26} />}
          judul="Belum ada titik untuk barang ini"
          pesan="Tidak ada pesanan berjalan yang memuat barang ini, dan pesanan yang sudah sampai lebih dari 12 jam lalu memang hilang sendiri dari peta. Peta akan terisi lagi begitu ada pesanan baru masuk."
          aksi={<TombolTautan ke="/distributor-portal/lacak">Kembali ke Lacak Pesanan</TombolTautan>}
        />
      ) : (
        <div className="mt-5 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
          {/* 3. Peta */}
          <section aria-labelledby="judul-peta" className="lg:col-span-7">
            <JudulBagian id="judul-peta" judul="Peta sebaran" />
            <Kartu padat className="sm:p-4">
              <PetaSebaran titik={titik} dipilih={dipilih} pilih={setDipilih} />
            </Kartu>
          </section>

          {/* 4. Panel rincian: memanjang ke bawah peta di layar sempit, dan
                 berdiri di sampingnya begitu layarnya cukup lebar. */}
          <section aria-labelledby="judul-panel" className="lg:col-span-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 id="judul-panel" className="text-[0.9375rem] font-bold text-ink leading-tight">
                  Rincian toko
                </h2>
                <p className="text-[0.8125rem] text-ink-3 mt-0.5 leading-snug">
                  {umkm ? 'Pesanan toko ini untuk barang di atas.' : 'Pilih satu titik di peta, atau satu nama di daftar.'}
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
                        <dd className="text-[0.875rem] text-ink leading-snug">
                          {nomorHp(umkm.nomorHp)}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <h4 className="mt-4 text-[0.8125rem] font-bold text-ink-2 uppercase tracking-wide">
                    {angka(pesananTerpilih.length)} pesanan barang ini
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {pesananTerpilih.map((p) => {
                      const baris = p.baris.find((b) => b.penawaranId === penawaranId)
                      return (
                        <li key={p.id}>
                          <Link
                            to={`/distributor-portal/pesanan/${p.id}`}
                            className="block rounded-md border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-ink text-[0.875rem] leading-snug">
                                {p.nomor}
                              </span>
                              <span className="shrink-0 text-ink-3" aria-hidden="true">
                                <IkonPanahKanan size={16} />
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <LencanaStatus status={p.status} />
                            </div>
                            <p className="mt-1.5 text-[0.875rem] text-ink-2">
                              {baris ? jumlahSatuan(baris.jumlah, baris.satuan) : 'Jumlah tidak tercatat'}
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
                    Angka di dalam titik adalah jumlah pesanan toko itu untuk barang ini. Tekan
                    titiknya untuk membuka rincian, atau pilih namanya di bawah kalau titiknya
                    berdempetan.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {daftarTitikTerurut.map(({ t, nama }) => (
                      <li key={t.umkmId}>
                        <button
                          type="button"
                          onClick={() => setDipilih(t.umkmId)}
                          className="w-full min-h-11 flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                        >
                          <span className="min-w-0 text-[0.875rem] font-semibold text-ink truncate">
                            {nama}
                          </span>
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
        </div>
      )}
    </div>
  )
}
