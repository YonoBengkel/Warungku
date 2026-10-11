import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import KerangkaAplikasi from '@/layouts/KerangkaAplikasi'
import KerangkaDistributor from '@/layouts/KerangkaDistributor'
import { KerangkaBaris } from '@/components/ui/dasar'
import { BatasGalat } from '@/components/BatasGalat'

/**
 * Peta rute.
 *
 * Empat aturan yang mengikat di sini:
 *
 * 1. Rute datar per entitas. /kontrak/:id dan /penawaran/:id berdiri sendiri
 *    walaupun dirender di dalam sebuah tab, supaya memindahkan menu di masa
 *    depan tidak mematikan tautan pemberitahuan lama.
 * 2. Penyaring dan kata kunci hidup di query string (/stok?filter=menipis),
 *    supaya kartu di Beranda cukup jadi tautan biasa tanpa logika khusus.
 * 3. Tiap layar dimuat saat dibutuhkan. Sasaran penggunanya memakai Android
 *    kelas menengah dengan koneksi tidak stabil, jadi memuat 50 layar sekaligus
 *    di awal adalah biaya yang tidak perlu mereka bayar untuk membuka Beranda.
 * 4. Tab "Distributor" tetap tinggal di rute /belanja. Yang berganti cuma kata
 *    yang dibaca pengguna, karena /distributor/:id sudah dipakai profil satu
 *    distributor dan /distributor-portal/* adalah portal milik distributor.
 *    Tiga hal berbeda, dan hanya satu di antaranya yang perlu berubah nama.
 */

/* Pintu masuk pengunjung */
const Hero = lazy(() => import('@/pages/Hero'))

/* Otentikasi & pendaftaran */
const Masuk = lazy(() => import('@/pages/auth/Masuk'))
const Daftar = lazy(() => import('@/pages/auth/Daftar'))
const DaftarUsaha = lazy(() => import('@/pages/auth/DaftarUsaha'))
const DaftarLegalitas = lazy(() => import('@/pages/auth/DaftarLegalitas'))
const LupaSandi = lazy(() => import('@/pages/auth/LupaSandi'))
const BatasAmanAwal = lazy(() => import('@/pages/mulai/BatasAmanAwal'))

/* Tab 1 */
const Beranda = lazy(() => import('@/pages/Beranda'))
const PromoDetail = lazy(() => import('@/pages/promo/PromoDetail'))

/* Tab 2 */
const Stok = lazy(() => import('@/pages/stok/Stok'))
const StokBaru = lazy(() => import('@/pages/stok/StokBaru'))
const StokDetail = lazy(() => import('@/pages/stok/StokDetail'))
const StokUbah = lazy(() => import('@/pages/stok/StokUbah'))
const StokKoreksi = lazy(() => import('@/pages/stok/StokKoreksi'))
const StokBatasAman = lazy(() => import('@/pages/stok/StokBatasAman'))
const StokRapor = lazy(() => import('@/pages/stok/StokRapor'))
const CatatPemakaian = lazy(() => import('@/pages/stok/CatatPemakaian'))
const KelolaKategori = lazy(() => import('@/pages/stok/KelolaKategori'))

/* Tab 3 */
const Prediksi = lazy(() => import('@/pages/prediksi/Prediksi'))

/* Tab 4 — berkasnya tetap bernama belanja, labelnya "Distributor" */
const Belanja = lazy(() => import('@/pages/belanja/Belanja'))
const DistributorProfil = lazy(() => import('@/pages/belanja/DistributorProfil'))
const DistributorUlasan = lazy(() => import('@/pages/belanja/DistributorUlasan'))
const PenawaranDetail = lazy(() => import('@/pages/belanja/PenawaranDetail'))
const PilihPaket = lazy(() => import('@/pages/belanja/PilihPaket'))
const RincianPaket = lazy(() => import('@/pages/belanja/RincianPaket'))
const PeriksaKesepakatan = lazy(() => import('@/pages/belanja/PeriksaKesepakatan'))

/* Tab 5 */
const PesananDaftar = lazy(() => import('@/pages/pesanan/PesananDaftar'))
const PesananDetail = lazy(() => import('@/pages/pesanan/PesananDetail'))
const TerimaBarang = lazy(() => import('@/pages/pesanan/TerimaBarang'))
const BeriPenilaian = lazy(() => import('@/pages/pesanan/BeriPenilaian'))
const KontrakDetail = lazy(() => import('@/pages/pesanan/KontrakDetail'))
const KontrakRutin = lazy(() => import('@/pages/pesanan/KontrakRutin'))
const Mitra = lazy(() => import('@/pages/pesanan/Mitra'))

/* Kepala halaman */
const Notifikasi = lazy(() => import('@/pages/Notifikasi'))
const Keranjang = lazy(() => import('@/pages/keranjang/Keranjang'))
const KeranjangRingkasan = lazy(() => import('@/pages/keranjang/KeranjangRingkasan'))
const KeranjangSelesai = lazy(() => import('@/pages/keranjang/KeranjangSelesai'))
const PesanCepat = lazy(() => import('@/pages/PesanCepat'))

/* Akun */
const Akun = lazy(() => import('@/pages/akun/Akun'))
const AkunProfil = lazy(() => import('@/pages/akun/AkunProfil'))
const AkunPratinjau = lazy(() => import('@/pages/akun/AkunPratinjau'))
const DataUsaha = lazy(() => import('@/pages/akun/DataUsaha'))
const AkunKasir = lazy(() => import('@/pages/akun/AkunKasir'))
const KasirPanduan = lazy(() => import('@/pages/akun/KasirPanduan'))
const KasirPasangkan = lazy(() => import('@/pages/akun/KasirPasangkan'))
const JenisUsaha = lazy(() => import('@/pages/akun/JenisUsaha'))
const PengaturanPengingat = lazy(() => import('@/pages/akun/PengaturanPengingat'))
const Pengguna = lazy(() => import('@/pages/akun/Pengguna'))
const PenggunaUndang = lazy(() => import('@/pages/akun/PenggunaUndang'))
const UlasanSaya = lazy(() => import('@/pages/akun/UlasanSaya'))
const Bantuan = lazy(() => import('@/pages/akun/Bantuan'))

/* Portal Distributor */
const DistributorDashboard = lazy(() => import('@/pages/distributor-portal/Dashboard'))
const PesananMasukDaftar = lazy(() => import('@/pages/distributor-portal/PesananMasukDaftar'))
const PesananMasukDetail = lazy(() => import('@/pages/distributor-portal/PesananMasukDetail'))
const KontrakDistributor = lazy(() => import('@/pages/distributor-portal/KontrakDistributor'))
const PromoDistributor = lazy(() => import('@/pages/distributor-portal/PromoDistributor'))
const PetaSebaran = lazy(() => import('@/pages/distributor-portal/PetaSebaran'))
const ProfilDistributor = lazy(() => import('@/pages/distributor-portal/ProfilDistributor'))

const TidakDitemukan = lazy(() => import('@/pages/TidakDitemukan'))

/**
 * Penanda muat berbentuk baris, bukan pemutar di tengah layar.
 * Bentuknya menyerupai isi yang akan datang, sehingga perpindahan halaman
 * tidak terasa seperti layar kosong yang menggantung.
 */
function SedangMemuat() {
  return (
    <div className="py-6">
      <KerangkaBaris jumlah={4} />
    </div>
  )
}

export default function App() {
  // Batas galat dipasang ulang tiap kali rute berubah, sehingga berpindah
  // halaman selalu memulihkan keadaan tanpa perlu memuat ulang aplikasi.
  const { pathname } = useLocation()

  return (
    <BatasGalat key={pathname}>
      <Suspense fallback={<SedangMemuat />}>
      <Routes>
        {/* Di luar kerangka: landing page, otentikasi, dan pendaftaran punya
            tata letaknya sendiri */}
        <Route path="/" element={<Hero />} />
        <Route path="/masuk" element={<Masuk />} />
        <Route path="/daftar" element={<Daftar />} />
        <Route path="/daftar/usaha" element={<DaftarUsaha />} />
        <Route path="/daftar/legalitas" element={<DaftarLegalitas />} />
        <Route path="/lupa-sandi" element={<LupaSandi />} />
        <Route path="/mulai/batas-aman" element={<BatasAmanAwal />} />

        <Route element={<KerangkaAplikasi />}>
          <Route path="/beranda" element={<Beranda />} />
          <Route path="/promo/:id" element={<PromoDetail />} />

          <Route path="/stok" element={<Stok />} />
          <Route path="/stok/baru" element={<StokBaru />} />
          <Route path="/stok/pemakaian" element={<CatatPemakaian />} />
          <Route path="/stok/kategori" element={<KelolaKategori />} />
          <Route path="/stok/:id" element={<StokDetail />} />
          <Route path="/stok/:id/ubah" element={<StokUbah />} />
          <Route path="/stok/:id/koreksi" element={<StokKoreksi />} />
          <Route path="/stok/:id/batas-aman" element={<StokBatasAman />} />
          <Route path="/stok/:id/rapor" element={<StokRapor />} />

          <Route path="/prediksi" element={<Prediksi />} />

          <Route path="/belanja" element={<Belanja />} />
          <Route path="/distributor/:id" element={<DistributorProfil />} />
          <Route path="/distributor/:id/ulasan" element={<DistributorUlasan />} />
          <Route path="/penawaran/:id" element={<PenawaranDetail />} />
          <Route path="/penawaran/:id/kontrak" element={<PilihPaket />} />
          <Route path="/penawaran/:id/kontrak/:paket" element={<RincianPaket />} />
          <Route path="/penawaran/:id/kontrak/:paket/tinjau" element={<PeriksaKesepakatan />} />

          <Route path="/pesanan" element={<PesananDaftar />} />
          <Route path="/pesanan/:id" element={<PesananDetail />} />
          <Route path="/pesanan/:id/terima" element={<TerimaBarang />} />
          <Route path="/pesanan/:id/ulasan" element={<BeriPenilaian />} />
          <Route path="/kontrak/:id" element={<KontrakDetail />} />
          <Route path="/kontrak/:id/rutin" element={<KontrakRutin />} />
          <Route path="/mitra/:id" element={<Mitra />} />

          <Route path="/notifikasi" element={<Notifikasi />} />
          <Route path="/keranjang" element={<Keranjang />} />
          <Route path="/keranjang/ringkasan" element={<KeranjangRingkasan />} />
          <Route path="/keranjang/selesai" element={<KeranjangSelesai />} />
          <Route path="/pesan-cepat/:idSaran" element={<PesanCepat />} />

          <Route path="/akun" element={<Akun />} />
          <Route path="/akun/profil" element={<AkunProfil />} />
          <Route path="/akun/profil/pratinjau" element={<AkunPratinjau />} />
          <Route path="/akun/data-usaha" element={<DataUsaha />} />
          <Route path="/akun/kasir" element={<AkunKasir />} />
          {/* Tanpa parameter merek: aplikasi hanya mendukung satu POS. */}
          <Route path="/akun/kasir/panduan" element={<KasirPanduan />} />
          <Route path="/akun/kasir/pasangkan/:idMenu" element={<KasirPasangkan />} />
          <Route path="/akun/jenis-usaha" element={<JenisUsaha />} />
          <Route path="/akun/notifikasi" element={<PengaturanPengingat />} />
          <Route path="/akun/pengguna" element={<Pengguna />} />
          <Route path="/akun/pengguna/undang" element={<PenggunaUndang />} />
          <Route path="/akun/ulasan" element={<UlasanSaya />} />
          <Route path="/akun/bantuan" element={<Bantuan />} />

          <Route path="*" element={<TidakDitemukan />} />
        </Route>

        {/* Portal Distributor: peran lain, kerangka lain, sidebar empat menu */}
        <Route path="/distributor-portal" element={<KerangkaDistributor />}>
          <Route index element={<DistributorDashboard />} />
          <Route path="pesanan" element={<PesananMasukDaftar />} />
          <Route path="pesanan/:id" element={<PesananMasukDetail />} />
          <Route path="kontrak" element={<KontrakDistributor />} />
          <Route path="promo" element={<PromoDistributor />} />
          <Route path="sebaran" element={<PetaSebaran />} />
          <Route path="sebaran/:penawaranId" element={<PetaSebaran />} />
          {/* Menu Lacak Pesanan sudah dilebur ke Pesanan dan Sebaran (catatan
              B6). Tautan lama diarahkan, bukan dibiarkan jadi halaman kosong. */}
          <Route path="lacak" element={<Navigate to="/distributor-portal/pesanan" replace />} />
          <Route path="lacak/toko/:umkmId" element={<Navigate to="/distributor-portal/pesanan" replace />} />
          <Route path="lacak/barang/:penawaranId" element={<AlihKeSebaran />} />
          <Route path="profil" element={<ProfilDistributor />} />
          <Route path="*" element={<TidakDitemukan />} />
        </Route>
      </Routes>
      </Suspense>
    </BatasGalat>
  )
}

/** Alamat lama peta per barang (`/lacak/barang/:id`) dibawa ke alamat barunya. */
function AlihKeSebaran() {
  const { penawaranId = '' } = useParams()
  return <Navigate to={`/distributor-portal/sebaran/${penawaranId}`} replace />
}
