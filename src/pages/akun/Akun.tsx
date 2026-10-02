import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lencana, Tombol } from '@/components/ui/dasar'
import { Konfirmasi } from '@/components/ui/lembar'
import { KepalaHalaman } from '@/components/ui/navigasi'
import {
  IkonBantuan,
  IkonBintang,
  IkonBulan,
  IkonKeluar,
  IkonKontrak,
  IkonGudang,
  IkonKunci,
  IkonLonceng,
  IkonMatahari,
  IkonPanahKanan,
  IkonProfil,
  IkonGrafik,
  IkonSinkron,
} from '@/icons'
import { cx, inisial, tanggalPanjang } from '@/lib/format'
import { JUDUL, LABEL_JENIS_USAHA } from '@/lib/label'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Akun adalah papan petunjuk, bukan tempat mengerjakan sesuatu.
 *
 * Semua yang ada di sini dibuka sebulan sekali, jadi yang dikejar bukan
 * kepadatan melainkan kejelasan: satu kolom, baris tinggi, nama menu yang
 * sama persis dengan judul layar tujuannya supaya tidak ada yang terasa
 * "hilang" setelah diketuk.
 */
export default function Akun() {
  const navigate = useNavigate()
  const profil = useAplikasi((s) => s.profil)
  const kasir = useAplikasi((s) => s.kasir)
  const tema = useAplikasi((s) => s.tema)
  const aturTema = useAplikasi((s) => s.aturTema)
  const layanan = useAplikasi((s) => s.layananPerkiraan)
  const aturLayananPerkiraan = useAplikasi((s) => s.aturLayananPerkiraan)
  const aturMasuk = useAplikasi((s) => s.aturMasuk)
  const aturPeran = useAplikasi((s) => s.aturPeran)

  const [tanyaKeluar, setTanyaKeluar] = useState(false)

  const belumDipasangkan = kasir.menuBelumDipasangkan.length

  return (
    <div className="pb-8">
      <KepalaHalaman judul={JUDUL.akun} kembaliKe="/beranda" />

      {/* Kepala identitas usaha */}
      <div className="mt-4 flex items-center gap-3.5">
        <span
          aria-hidden="true"
          style={{ background: profil.warna }}
          className="size-16 sm:size-[4.5rem] rounded-lg grid place-items-center text-white font-extrabold text-[1.375rem] shrink-0 tracking-tight"
        >
          {inisial(profil.namaUsaha)}
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.125rem] font-extrabold text-ink leading-tight truncate">
            {profil.namaUsaha}
          </h2>
          <p className="text-[0.8125rem] text-ink-3 truncate">
            {LABEL_JENIS_USAHA[profil.jenisUsaha].judul} &middot; {profil.kota}
          </p>
          <div className="mt-1.5">
            <LencanaVerifikasi />
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[0.75rem] text-ink-3">
        Bergabung sejak {tanggalPanjang(profil.bergabungSejak)}
      </p>

      {/* Dua kolom di layar lebar supaya daftar tidak jadi pita panjang */}
      <div className="mt-6 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:items-start space-y-6 lg:space-y-0">
        <div className="space-y-6">
          <Kelompok judul="Usaha">
            <BarisMenu
              ke="/akun/profil"
              ikon={<IkonProfil size={19} />}
              judul="Profil Usaha"
              keterangan="Nama, bio, kontak, dan status verifikasi"
            />
            <BarisMenu
              ke="/akun/data-usaha"
              ikon={<IkonKontrak size={19} />}
              judul="Data Usaha & Legalitas"
              keterangan="NIB, NPWP, nama pemilik, alamat"
              lencana={
                profil.verifikasi === 'perlu-diperbaiki' ? (
                  <Lencana nada="kritis">Perlu diperbaiki</Lencana>
                ) : undefined
              }
            />
          </Kelompok>

          <Kelompok judul="Data & Stok">
            <BarisMenu
              ke="/akun/kasir"
              ikon={<IkonSinkron size={19} />}
              judul={JUDUL.dataKasir}
              keterangan={
                kasir.status === 'terhubung' && kasir.merek
                  ? `Tersambung ke ${kasir.merek}`
                  : kasir.sumber === 'catat-manual'
                    ? 'Kamu mencatat pemakaian manual'
                    : 'Belum tersambung ke aplikasi kasir'
              }
              lencana={
                belumDipasangkan > 0 ? (
                  <Lencana nada="menipis">{belumDipasangkan} menu perlu dipasangkan</Lencana>
                ) : undefined
              }
            />
            <BarisMenu
              ke="/akun/jenis-usaha"
              ikon={<IkonGrafik size={19} />}
              judul={JUDUL.caraHitung}
              keterangan="Stok dihitung per barang utuh atau per racikan"
            />
          </Kelompok>

          {/* Tampilan ikut masuk kolom kiri supaya di layar lebar halaman ini
              tidak berakhir sebagai ekor panjang di bawah dua kolom menu. */}
          <section aria-labelledby="judul-tampilan">
            <h2
              id="judul-tampilan"
              className="text-[0.75rem] font-bold uppercase tracking-wide text-ink-3 mb-2"
            >
              Tampilan
            </h2>
            <p className="text-[0.8125rem] text-ink-3 mb-2.5 leading-snug">
              Berlaku di perangkat ini saja.
            </p>
            <div className="flex gap-2.5">
              <TombolPilihan
                aktif={tema === 'terang'}
                onClick={() => aturTema('terang')}
                ikon={<IkonMatahari size={17} />}
              >
                Terang
              </TombolPilihan>
              <TombolPilihan
                aktif={tema === 'gelap'}
                onClick={() => aturTema('gelap')}
                ikon={<IkonBulan size={17} />}
              >
                Gelap
              </TombolPilihan>
            </div>
          </section>
        </div>

        <div className="space-y-6 mt-6 lg:mt-0">
          <Kelompok judul="Pengaturan">
            <BarisMenu
              ke="/akun/notifikasi"
              ikon={<IkonLonceng size={19} />}
              judul="Pengaturan Pengingat"
              keterangan="Kapan dan untuk apa kami boleh mengingatkan"
            />
            <BarisMenu
              ke="/akun/pengguna"
              ikon={<IkonKunci size={19} />}
              judul="Pengguna & Hak Akses"
              keterangan="Siapa saja yang boleh memakai aplikasi ini"
            />
          </Kelompok>

          <Kelompok judul="Lainnya">
            <BarisMenu
              ke="/akun/ulasan"
              ikon={<IkonBintang size={19} />}
              judul="Ulasan Saya"
              keterangan="Penilaian yang pernah kamu tulis untuk distributor"
            />
            <BarisMenu
              ke="/akun/bantuan"
              ikon={<IkonBantuan size={19} />}
              judul="Bantuan & Tentang Aplikasi"
              keterangan="Pertanyaan yang sering ditanyakan dan kontak kami"
            />
          </Kelompok>

          {/* Alat uji. Sengaja tidak disembunyikan: purwarupa ini dipakai untuk
              memeriksa tiga tingkat turun derajat layanan perkiraan sekaligus sisi
              distributor, dan menyimpannya di menu rahasia membuat penguji tidak
              pernah menemukannya. */}
          <section aria-labelledby="judul-alat-uji">
            <div className="rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
              <h2 id="judul-alat-uji" className="text-[0.9375rem] font-bold text-ink">
                Alat uji purwarupa
              </h2>
              <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
                Hanya untuk pengembang. Yang ada di kotak ini tidak mengubah data stok, pesanan, maupun kontrakmu.
              </p>

              <h3 className="mt-4 text-[0.875rem] font-bold text-ink">Tampilan perkiraan</h3>
              <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
                Tombol ini mengubah tampilan blok perkiraan supaya tiga keadaannya bisa dilihat tanpa menunggu.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    { nilai: 'sehat', label: 'Perkiraan penuh' },
                    { nilai: 'tersimpan', label: 'Hitungan sederhana' },
                    { nilai: 'mati', label: 'Perkiraan tidak tampil' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.nilai}
                    type="button"
                    aria-pressed={layanan === o.nilai}
                    onClick={() => aturLayananPerkiraan(o.nilai)}
                    className={cx(
                      'h-11 px-3.5 rounded-md text-[0.8125rem] font-semibold border transition-colors',
                      layanan === o.nilai
                        ? 'bg-ink text-ink-inverse border-ink'
                        : 'bg-surface text-ink-2 border-line-strong hover:text-ink',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Pintu ke sisi distributor. Sengaja memakai Tombol, bukan tautan
                  biasa: perannya harus ikut berpindah sebelum layarnya dibuka,
                  supaya kerangka yang muncul benar sejak ketukan pertama. */}
              <h3 className="mt-5 text-[0.875rem] font-bold text-ink">Peran akun</h3>
              <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
                Berpindah peran adalah alat uji purwarupa. Di aplikasi yang sungguhan, satu akun hanya punya satu
                peran: pemilik usaha atau distributor, tidak keduanya.
              </p>
              <Tombol
                ragam="garis"
                ikonKiri={<IkonGudang size={17} />}
                className="mt-3"
                onClick={() => {
                  aturPeran('distributor')
                  navigate('/distributor-portal')
                }}
              >
                Buka Portal Distributor
              </Tombol>
            </div>
          </section>

          {/* Keluar */}
          <Tombol
            ragam="garis"
            penuh
            ikonKiri={<IkonKeluar size={17} />}
            onClick={() => setTanyaKeluar(true)}
            className="!text-kritis !border-kritis/40"
          >
            Keluar
          </Tombol>
        </div>
      </div>

      <p className="mt-8 text-center text-[0.75rem] text-ink-3">
        Warungku untuk Pemilik Usaha &middot; versi purwarupa
      </p>

      <Konfirmasi
        terbuka={tanyaKeluar}
        tutup={() => setTanyaKeluar(false)}
        judul="Keluar dari akun ini?"
        pesan={
          <>
            Data stok dan pesananmu tetap tersimpan. Kamu perlu memasukkan nomor HP dan kata sandi lagi untuk
            membukanya.
          </>
        }
        labelSetuju="Ya, keluar"
        ragamSetuju="bahaya"
        onSetuju={() => {
          aturMasuk(false)
          navigate('/masuk')
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Potongan khusus halaman ini                                         */
/* ------------------------------------------------------------------ */

function LencanaVerifikasi() {
  const profil = useAplikasi((s) => s.profil)
  if (profil.verifikasi === 'terverifikasi') {
    return (
      <Lencana nada="aman">
        {profil.tingkatVerifikasi === 'penuh' ? 'Terverifikasi' : 'Terverifikasi Dasar'}
      </Lencana>
    )
  }
  if (profil.verifikasi === 'menunggu') return <Lencana nada="menipis">Sedang diperiksa</Lencana>
  return <Lencana nada="kritis">Data perlu diperbaiki</Lencana>
}

function Kelompok({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section aria-label={judul}>
      <h2 className="text-[0.75rem] font-bold uppercase tracking-wide text-ink-3 mb-2">{judul}</h2>
      <div className="rounded-lg border border-line bg-surface overflow-hidden shadow-e1">{children}</div>
    </section>
  )
}

/** Tinggi minimal 56px, ikon di kiri, panah di kanan. Seluruh baris bisa ditekan. */
function BarisMenu({
  ke,
  ikon,
  judul,
  keterangan,
  lencana,
}: {
  ke: string
  ikon: ReactNode
  judul: string
  keterangan?: string
  lencana?: ReactNode
}) {
  return (
    <Link
      to={ke}
      className="flex items-center gap-3 min-h-14 px-3.5 py-3 border-b border-line last:border-b-0 transition-colors hover:bg-sunken active:bg-surface-2"
    >
      <span className="shrink-0 size-9 rounded-md bg-sunken grid place-items-center text-ink-2" aria-hidden="true">
        {ikon}
      </span>
      <span className="min-w-0 grow">
        <span className="block text-[0.9375rem] font-semibold text-ink leading-snug">{judul}</span>
        {keterangan && (
          <span className="block mt-0.5 text-[0.75rem] text-ink-3 leading-snug">{keterangan}</span>
        )}
        {/* Di layar 360px lencana yang duduk sebaris menyisakan sekitar 100px
            untuk judul, dan "Data dari Kasir" pecah jadi satu kata per baris.
            Di bawah sm ia turun ke bawah teks; di layar lebar tetap di kanan. */}
        {lencana && <span className="mt-1.5 flex sm:hidden">{lencana}</span>}
      </span>
      {lencana && <span className="shrink-0 hidden sm:block">{lencana}</span>}
      <IkonPanahKanan size={18} className="shrink-0 text-ink-3" />
    </Link>
  )
}

function TombolPilihan({
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
      aria-pressed={aktif}
      onClick={onClick}
      className={cx(
        'flex-1 h-12 rounded-md border-2 inline-flex items-center justify-center gap-2 text-[0.9375rem] font-semibold transition-colors',
        aktif
          ? 'border-brand bg-brand-soft text-brand-soft-ink'
          : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}
