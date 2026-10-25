import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Lencana, Tombol } from '@/components/ui/dasar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { BarisMenu, Kelompok, TombolPilihan } from '@/components/ui/menuAkun'
import { IkonBintang, IkonBulan, IkonCentangLingkaran, IkonKeluar, IkonKotak, IkonMatahari, IkonToko } from '@/icons'
import { angka, bintang } from '@/lib/format'
import { useAplikasi, useDistributorAktif } from '@/store/aplikasi'

/**
 * Akun distributor (revisi V4, Q93–Q94): papan petunjuk seperti Akun pemilik
 * usaha, dibuka dari blok akun di kiri bawah menu samping (di HP dari logo toko
 * di bilah atas), bukan lagi dari menu utama.
 *
 * Isinya dipecah ke tiga halaman bawahan: Profil Toko (deskripsi, info usaha,
 * yang dilayani, lokasi gudang), Barang yang Dijual, serta Penilaian & Ulasan.
 * Dulu semuanya satu halaman panjang yang dibuka dengan daftar barang, padahal
 * halaman profil pertama-tama menjawab "toko ini siapa".
 *
 * Alat uji purwarupa (berpindah peran dan sesi distributor) pindah ke sini dari
 * pita kuning di menu samping, sama seperti di Akun pemilik usaha.
 */
export default function ProfilDistributor() {
  const navigate = useNavigate()
  const tema = useAplikasi((s) => s.tema)
  const aturTema = useAplikasi((s) => s.aturTema)
  const aturPeran = useAplikasi((s) => s.aturPeran)
  const katalog = useAplikasi((s) => s.katalog)
  const sesi = useAplikasi((s) => s.sesiDistributor)
  const putus = useAplikasi((s) => s.putusDistributor)
  const distributor = useDistributorAktif()

  const jumlahDijual = katalog.filter((p) => p.distributorId === distributor.id && p.aktif !== false).length

  function kembaliKePortalUmkm() {
    // Peran diubah lebih dulu, baru layarnya dibuka, supaya kerangka yang
    // muncul sudah benar sejak ketukan pertama.
    aturPeran('umkm')
    navigate('/beranda')
  }

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Akun" kembaliKe="/distributor-portal" />

      {/* Kepala identitas toko */}
      <div className="mt-4 flex items-center gap-3.5">
        <Avatar nama={distributor.nama} warna={distributor.warna} ukuran={64} className="rounded-lg" />
        <div className="min-w-0">
          <h2 className="text-[1.125rem] font-extrabold text-ink leading-tight truncate">{distributor.nama}</h2>
          <p className="text-isi text-ink-3 truncate">
            Distributor &middot; {distributor.kota}
            {distributor.rating != null && (
              <>
                {' '}
                &middot; <IkonBintang size={13} className="inline align-[-2px] text-menipis" /> {bintang(distributor.rating)}
              </>
            )}
          </p>
          {distributor.terverifikasi && (
            <div className="mt-1.5">
              <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />}>
                Terverifikasi
              </Lencana>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2.5 text-kecil text-ink-3">Bergabung sejak {distributor.sejak}</p>

      {/* Dua kolom di layar lebar supaya daftar tidak jadi pita panjang */}
      <div className="mt-6 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:items-start space-y-6 lg:space-y-0">
        <div className="space-y-6">
          <Kelompok judul="Toko">
            <BarisMenu
              ke="/distributor-portal/profil/toko"
              ikon={<IkonToko size={19} />}
              judul="Profil Toko"
              keterangan="Deskripsi, info usaha, yang kamu layani, dan lokasi gudang"
            />
            <BarisMenu
              ke="/distributor-portal/profil/barang"
              ikon={<IkonKotak size={19} />}
              judul="Barang yang Dijual"
              keterangan={`${angka(jumlahDijual)} barang dijual · harga dan stok yang dilihat pemilik usaha`}
            />
          </Kelompok>

          <section aria-labelledby="judul-tampilan">
            <h2 id="judul-tampilan" className="text-kecil font-bold uppercase tracking-wide text-ink-3 mb-2">
              Tampilan
            </h2>
            <p className="text-isi text-ink-3 mb-2.5 leading-snug">Berlaku di perangkat ini saja.</p>
            <div className="flex gap-2.5">
              <TombolPilihan aktif={tema === 'terang'} onClick={() => aturTema('terang')} ikon={<IkonMatahari size={17} />}>
                Terang
              </TombolPilihan>
              <TombolPilihan aktif={tema === 'gelap'} onClick={() => aturTema('gelap')} ikon={<IkonBulan size={17} />}>
                Gelap
              </TombolPilihan>
            </div>
          </section>
        </div>

        <div className="space-y-6 mt-6 lg:mt-0">
          <Kelompok judul="Penilaian">
            <BarisMenu
              ke="/distributor-portal/profil/ulasan"
              ikon={<IkonBintang size={19} />}
              judul="Penilaian & Ulasan"
              keterangan={
                distributor.rating == null
                  ? 'Belum ada penilaian dari pemilik usaha'
                  : `${bintang(distributor.rating)} dari 5 · ${angka(distributor.jumlahUlasan)} ulasan dari pemilik usaha`
              }
            />
          </Kelompok>
        </div>
      </div>

      {/* Alat uji. Sengaja tidak disembunyikan, sama dengan Akun pemilik usaha:
          purwarupa ini dipakai untuk menelusuri kedua sisi. */}
      <section aria-labelledby="judul-alat-uji" className="mt-6">
        <div className="rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
          <h2 id="judul-alat-uji" className="text-kartu font-bold text-ink">
            Alat uji purwarupa
          </h2>
          <p className="mt-1 text-isi text-ink-3 leading-relaxed">
            Hanya untuk pengembang. Yang ada di kotak ini tidak mengubah pesanan, kontrak, maupun katalogmu.
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-2 lg:gap-6">
            {/* Asal data portal ini: server (dengan akun distributor) atau data contoh. */}
            <div>
              <h3 className="text-isi font-bold text-ink">Akun distributor</h3>
              {sesi ? (
                <>
                  <p className="mt-1 text-isi text-ink-3 leading-relaxed">
                    Masuk sebagai {sesi.namaPengguna}. Keluar mengembalikan portal ini ke data contoh.
                  </p>
                  <Tombol ragam="garis" ikonKiri={<IkonKeluar size={17} />} className="mt-3" onClick={putus}>
                    Keluar
                  </Tombol>
                </>
              ) : (
                <>
                  <p className="mt-1 text-isi text-ink-3 leading-relaxed">
                    Portal ini memakai data contoh. Masuk dengan akun distributor untuk melihat pesanan sungguhan.
                  </p>
                  <Link
                    to="/masuk/distributor"
                    className="mt-2 inline-flex items-center min-h-11 text-isi font-bold text-brand hover:underline"
                  >
                    Masuk sebagai distributor
                  </Link>
                </>
              )}
            </div>

            {/* Jalan pulang ke sisi pemilik usaha. Tombol, bukan tautan biasa:
                perannya harus ikut berpindah sebelum layarnya dibuka. */}
            <div>
              <h3 className="text-isi font-bold text-ink">Peran akun</h3>
              <p className="mt-1 text-isi text-ink-3 leading-relaxed">
                Berpindah peran adalah alat uji purwarupa. Di aplikasi yang sungguhan, satu akun hanya punya satu
                peran: pemilik usaha atau distributor, tidak keduanya.
              </p>
              <Tombol ragam="garis" className="mt-3" ikonKiri={<IkonToko size={17} />} onClick={kembaliKePortalUmkm}>
                Kembali ke portal UMKM
              </Tombol>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-8 text-center text-kecil text-ink-3">Turnify Flow untuk Distributor &middot; versi purwarupa</p>
    </div>
  )
}
