import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, JudulBagian, Kartu, Lencana, Metrik, Pemisah, Tombol } from '@/components/ui/dasar'
import {
  IkonBintang,
  IkonBintangIsi,
  IkonBulan,
  IkonCentangLingkaran,
  IkonKotak,
  IkonMatahari,
  IkonToko,
} from '@/icons'
import { angka, cx, rupiah, tanggalPendek } from '@/lib/format'
import { daftarPenawaran, distributorAktif, umkmById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Profil toko distributor.
 *
 * Halaman ini sengaja tidak punya tombol sunting. Purwarupa belum menyimpan
 * apa pun ke mana pun, dan formulir yang tidak menyimpan lebih buruk daripada
 * halaman yang jujur cuma memperlihatkan keadaan.
 *
 * Sakelar tema ikut di sini karena portal distributor tidak punya halaman
 * pengaturan lain, sedangkan pilihan terang/gelap tetap harus bisa diubah.
 */

const PENAWARAN_SAYA = daftarPenawaran.filter((p) => p.distributorId === distributorAktif.id)

const SUB_RATING: Array<{ kunci: keyof typeof distributorAktif.subRating; nama: string }> = [
  { kunci: 'ketepatanWaktu', nama: 'Ketepatan waktu' },
  { kunci: 'jumlahSesuai', nama: 'Jumlah sesuai pesanan' },
  { kunci: 'kondisiBarang', nama: 'Kondisi barang' },
]

export default function ProfilDistributor() {
  const navigate = useNavigate()
  const tema = useAplikasi((s) => s.tema)
  const aturTema = useAplikasi((s) => s.aturTema)
  const aturPeran = useAplikasi((s) => s.aturPeran)
  const pesananMasuk = useAplikasi((s) => s.pesananMasuk)

  /* Lima penilaian terbaru. Lebih dari itu halaman berubah jadi daftar ulasan,
     padahal ini halaman profil. */
  const ulasanTerbaru = useMemo(
    () =>
      pesananMasuk
        .filter((p) => p.ulasan)
        .sort((a, b) => +new Date(b.ulasan!.waktu) - +new Date(a.ulasan!.waktu))
        .slice(0, 5),
    [pesananMasuk],
  )

  function kembaliKePortalUmkm() {
    // Peran diubah lebih dulu, baru layarnya dibuka, supaya kerangka yang
    // muncul sudah benar sejak ketukan pertama.
    aturPeran('umkm')
    navigate('/beranda')
  }

  return (
    <div className="pb-6">
      {/* 1. Identitas */}
      <p className="text-[0.75rem] font-bold uppercase tracking-wide text-ink-3">Profil toko</p>
      <h1 className="mt-0.5 text-[1.25rem] font-extrabold text-ink tracking-tight leading-snug">
        {distributorAktif.nama}
      </h1>

      <div className="mt-3 flex items-start gap-3">
        <Avatar nama={distributorAktif.nama} warna={distributorAktif.warna} ukuran={56} />
        <div className="min-w-0">
          <p className="text-[0.875rem] text-ink-2 leading-snug">
            {distributorAktif.kota} &middot; bergabung {distributorAktif.sejak}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {distributorAktif.terverifikasi && (
              <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />}>
                Terverifikasi
              </Lencana>
            )}
            <Lencana nada="netral" ikon={<IkonToko size={13} />}>
              {PENAWARAN_SAYA.length} barang dijual
            </Lencana>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[0.875rem] text-ink-2 leading-relaxed max-w-[70ch]">
        {distributorAktif.deskripsi}
      </p>

      <div className="mt-5 lg:grid lg:grid-cols-12 lg:gap-5 lg:items-start space-y-6 lg:space-y-0">
        <div className="lg:col-span-7 space-y-6">
          {/* 2. Angka penilaian */}
          <section aria-labelledby="judul-penilaian">
            <JudulBagian id="judul-penilaian" judul="Penilaian dari pemilik usaha" />
            <Kartu>
              {/* Satuan ditaruh di baris bantuan, bukan di samping angka:
                  di 360px satu kolom cuma kebagian ±90px, dan "412 pesanan"
                  sejajar tidak muat tanpa melebarkan halaman. */}
              <div className="grid grid-cols-3 gap-3">
                <Metrik
                  label="Rata-rata"
                  nilai={distributorAktif.rating == null ? '—' : angka(distributorAktif.rating, 1)}
                  bantuan="dari 5 bintang"
                  nada="merek"
                />
                <Metrik
                  label="Ulasan"
                  nilai={angka(distributorAktif.jumlahUlasan)}
                  bantuan={`dari ${angka(distributorAktif.jumlahUmkmPengulas)} pemilik usaha`}
                />
                <Metrik
                  label="Selesai"
                  nilai={angka(distributorAktif.jumlahPesananSelesai)}
                  bantuan="pesanan"
                />
              </div>

              {distributorAktif.rating == null ? (
                <p className="mt-4 text-[0.8125rem] text-ink-2 leading-relaxed">
                  Belum ada penilaian yang masuk. Angkanya muncul setelah pesanan pertama selesai
                  dan pemiliknya menulis ulasan.
                </p>
              ) : (
                <>
                  <Pemisah className="my-4" />
                  <div className="space-y-3">
                    {SUB_RATING.map(({ kunci, nama }) => {
                      const nilai = distributorAktif.subRating[kunci]
                      return (
                        <div key={kunci}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[0.8125rem] text-ink-2 font-medium">{nama}</span>
                            {/* Tiga angka yang sejajar vertikal: di sini tabular
                                memang pada tempatnya. */}
                            <span className="text-[0.8125rem] font-bold text-ink tabular">
                              {angka(nilai, 1)} dari 5
                            </span>
                          </div>
                          {/* Bilahnya dekoratif: angkanya sudah tertulis di atas. */}
                          <div
                            className="mt-1.5 h-2 rounded-full bg-sunken overflow-hidden"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${(nilai / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Kartu>
          </section>

          {/* 3. Barang yang dijual */}
          <section aria-labelledby="judul-penawaran">
            <JudulBagian
              id="judul-penawaran"
              judul="Barang yang kamu jual"
              keterangan="Harga dan stok yang dilihat pemilik usaha saat memesan."
            />
            <Kartu>
              <div className="divide-y divide-line">
                {PENAWARAN_SAYA.map((pw) => (
                  <div key={pw.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.9375rem] font-bold text-ink leading-snug">{pw.nama}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
                          {pw.keterangan} &middot; per {pw.satuan}
                        </p>
                      </div>
                      <p className="text-[0.9375rem] font-bold text-ink tabular shrink-0">
                        {rupiah(pw.hargaSatuan)}
                      </p>
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] text-ink-2 leading-snug">
                      <IkonKotak size={14} className="shrink-0 mt-0.5 text-ink-3" />
                      <span>
                        Stok tersedia {angka(pw.stokTersedia)} {pw.satuan} &middot; diperbarui{' '}
                        {tanggalPendek(pw.stokDiperbaruiPada)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </Kartu>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* 4. Yang dilayani */}
          <section aria-labelledby="judul-layanan">
            <JudulBagian id="judul-layanan" judul="Yang kamu layani" />
            <Kartu>
              <h3 className="text-[0.8125rem] font-bold text-ink-2">Kategori barang</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {distributorAktif.kategori.map((k) => (
                  <Lencana key={k} nada="merek" besar>
                    {k}
                  </Lencana>
                ))}
              </div>

              <h3 className="mt-4 text-[0.8125rem] font-bold text-ink-2">Area kirim</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {distributorAktif.areaKirim.map((a) => (
                  <Lencana key={a} nada="netral" besar>
                    {a}
                  </Lencana>
                ))}
              </div>
            </Kartu>
          </section>

          {/* 5. Ulasan terbaru */}
          <section aria-labelledby="judul-ulasan">
            <JudulBagian
              id="judul-ulasan"
              judul="Ulasan terbaru"
              keterangan={
                ulasanTerbaru.length > 0 ? 'Lima penilaian paling akhir.' : undefined
              }
            />
            <Kartu>
              {ulasanTerbaru.length === 0 ? (
                <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                  Belum ada pemilik usaha yang menulis penilaian. Ulasan bisa ditulis setelah
                  pesanannya ditandai sudah sampai.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {ulasanTerbaru.map((p) => {
                    const u = p.ulasan!
                    return (
                      <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                        {/* Dibiarkan membungkus: nama usaha bisa panjang, dan
                            bintang + angkanya tidak boleh ikut menyempit
                            sampai melebarkan kartu di layar 360px. */}
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <p className="text-[0.875rem] font-bold text-ink leading-snug min-w-0">
                            {umkmById(p.umkmId)?.nama ?? 'Pemilik usaha'}
                          </p>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="flex items-center gap-0.5 text-menipis" aria-hidden="true">
                              {[1, 2, 3, 4, 5].map((i) =>
                                i <= u.rating ? (
                                  <IkonBintangIsi key={i} size={13} />
                                ) : (
                                  <IkonBintang key={i} size={13} />
                                ),
                              )}
                            </span>
                            <span className="text-[0.8125rem] font-bold text-ink">
                              {angka(u.rating, 1)} dari 5
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed max-w-[60ch]">
                          &ldquo;{u.isi}&rdquo;
                        </p>
                        <p className="mt-1 text-[0.75rem] text-ink-3">
                          {p.nomor} &middot; {tanggalPendek(u.waktu)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Kartu>
          </section>

          {/* 6. Tampilan */}
          <section aria-labelledby="judul-tampilan">
            <JudulBagian
              id="judul-tampilan"
              judul="Tampilan"
              keterangan="Berlaku di perangkat ini saja."
            />
            <div className="flex gap-2.5">
              <PilihanTema
                aktif={tema === 'terang'}
                onClick={() => aturTema('terang')}
                ikon={<IkonMatahari size={17} />}
              >
                Terang
              </PilihanTema>
              <PilihanTema
                aktif={tema === 'gelap'}
                onClick={() => aturTema('gelap')}
                ikon={<IkonBulan size={17} />}
              >
                Gelap
              </PilihanTema>
            </div>
          </section>

          {/* 7. Jalan pulang ke sisi pemilik usaha */}
          <section aria-labelledby="judul-peran">
            <JudulBagian id="judul-peran" judul="Peran akun" />
            <p className="-mt-1 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[60ch]">
              Berpindah peran adalah alat uji purwarupa. Di aplikasi yang sungguhan, satu akun hanya
              punya satu peran: pemilik usaha atau distributor, tidak keduanya.
            </p>
            <Tombol
              ragam="garis"
              className="mt-3"
              ikonKiri={<IkonToko size={17} />}
              onClick={kembaliKePortalUmkm}
            >
              Kembali ke portal UMKM
            </Tombol>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Dua pilihan tema yang saling meniadakan. Tinggi 44px, ikon + teks. */
function PilihanTema({
  aktif,
  onClick,
  ikon,
  children,
}: {
  aktif: boolean
  onClick: () => void
  ikon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={cx(
        'inline-flex items-center gap-2 h-11 px-4 rounded-md text-[0.875rem] font-semibold border',
        'transition-colors duration-150',
        aktif
          ? 'bg-ink text-ink-inverse border-ink'
          : 'bg-surface text-ink-2 border-line-strong hover:text-ink',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}
