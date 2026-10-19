import { useMemo } from 'react'
import { create } from 'zustand'
import type {
  AlasanSelisih,
  Barang,
  BarisKeranjang,
  BuktiPengiriman,
  DataKasir,
  Distributor,
  Kontrak,
  KontrakPelanggan,
  Notifikasi,
  PaketKontrak,
  Penawaran,
  Pergerakan,
  Promo,
  Pesanan,
  PesananMasuk,
  ProfilUsaha,
  StatusPesanan,
  StatusPesananMasuk,
  SubKeranjang,
  TitikPeta,
  Transaksi,
  UlasanPelanggan,
  WarnaTitik,
} from '@/lib/types'
import { PESANAN_BERJALAN } from '@/lib/label'
import { waktuNanti } from '@/lib/format'
import {
  POS_TUNGGAL,
  daftarBarang,
  daftarDistributor,
  daftarKontrak,
  daftarKontrakUmkmLain,
  daftarNotifikasi,
  daftarPaket,
  daftarPenawaran,
  daftarPromo,
  daftarPergerakan,
  daftarPesanan,
  daftarPesananMasuk,
  daftarTransaksi,
  dataKasirAwal,
  distributorAktif,
  gabungKontrakMasuk,
  gabungPesananMasuk,
  hargaBerlaku as hargaBerlakuDasar,
  kontrakBisaDipakai,
  paketById,
  pasangDataServer,
  pasangUmkmServer,
  penawaranById,
  profilAwal,
  promoById as promoByIdDasar,
  promoUntukPenawaran as promoUntukPenawaranDasar,
  rincianHarga,
  sinkronKatalog,
  statusStok,
  umkmById,
  warnaTitikUntuk,
} from '@/data/dummy'
import { jumlahTampil } from '@/lib/satuan'
import {
  ambilBarang,
  ambilPemakaianBulanan,
  masukDistributor,
  masukUmkm,
  sesiDistributorTersimpan,
  sesiTersimpan,
  simpanSesi,
  simpanSesiDistributor,
} from '@/lib/api'
import type { SesiDistributor, SesiServer } from '@/lib/api'
import {
  aksiPesananMasuk,
  ambilPesanan,
  ambilPesananMasuk,
  batalkanPesananServer,
  buatPesanan,
  terimaBarangServer,
} from '@/lib/apiPesanan'
import type { AksiDistributor } from '@/lib/apiPesanan'
import { ambilKatalog } from '@/lib/apiKatalog'
import {
  aksiKontrakServer,
  ajukanKontrakServer,
  ambilKatalogDistributor,
  ambilKontrak,
  ambilKontrakMasuk,
  berhentiKontrakServer,
  hapusPaketServer,
  rutinKontrakServer,
  simpanPaketServer,
} from '@/lib/apiKontrak'
import type { AksiKontrak } from '@/lib/apiKontrak'
import { akhiriPromoServer, simpanPromoServer } from '@/lib/apiPromo'

/**
 * Satu tempat penyimpanan untuk seluruh keadaan portal.
 *
 * Karena ini purwarupa antarmuka dengan data contoh, semua perubahan hanya
 * hidup di memori. Bentuk aksinya sengaja menyerupai panggilan API yang nanti
 * menggantikannya, supaya pindah ke backend sungguhan tidak mengubah komponen.
 */

export interface Racun {
  id: number
  pesan: string
  nada: 'aman' | 'info' | 'menipis' | 'kritis'
  /** Satu tautan lanjutan, mis. "Ubah jumlah" setelah barang masuk keranjang. */
  aksi?: { label: string; ke: string }
}

export interface HasilKirim {
  kodeBelanja: string
  pesanan: Array<{ id: string; nomor: string; distributorId: string; berhasil: boolean }>
}

interface KeadaanAplikasi {
  profil: ProfilUsaha
  kasir: DataKasir
  barang: Barang[]
  pergerakan: Pergerakan[]
  /** Satu database struk untuk seluruh toko. Pergerakan dari kasir merujuk ke sini. */
  transaksi: Transaksi[]
  kontrak: Kontrak[]
  pesanan: Pesanan[]
  notifikasi: Notifikasi[]
  keranjang: SubKeranjang[]
  /** Portal yang sedang dilihat. Alat uji demo, bukan hak akses sungguhan. */
  peran: 'umkm' | 'distributor'
  /**
   * Pesanan dari UMKM LAIN ke distributor aktif. Pesanan milik pemilik aplikasi
   * ini tidak disalin ke sini: portal distributor membacanya langsung dari
   * `pesanan` lewat `usePesananMasuk`, supaya satu pesanan tidak punya dua
   * versi yang bisa saling selisih.
   */
  pesananUmkmLain: PesananMasuk[]
  /** Kontrak UMKM lain dengan distributor aktif; kontrak milik sendiri ada di `kontrak`. */
  kontrakUmkmLain: KontrakPelanggan[]
  /** Paket kontrak semua distributor. Distributor aktif bisa menambah, mengubah, dan menghapus miliknya. */
  paketKontrak: PaketKontrak[]
  /**
   * Promo semua distributor, termasuk yang sudah berakhir (pesanan lama masih
   * merujuknya). Distributor aktif bisa memasang, mengubah, dan mengakhiri miliknya.
   */
  promo: Promo[]
  /** Katalog seluruh distributor. Distributor aktif mengelola barang miliknya di portal. */
  katalog: Penawaran[]
  /** Profil seluruh distributor. Distributor aktif mengubah kategori, area kirim, dan info usahanya. */
  distributor: Distributor[]
  tema: 'terang' | 'gelap'
  /** Mensimulasikan layanan perkiraan yang sedang tidak sehat, untuk menguji turun derajat. */
  layananPerkiraan: 'sehat' | 'tersimpan' | 'mati'
  masuk: boolean
  /**
   * Asal data gudang. `server`: barang, perkiraan, dan saran dibaca dari API
   * (keluaran mesin analitik sungguhan). `contoh`: data contoh di memori.
   * Bagian lain (pesanan, kontrak, katalog) masih data contoh di kedua mode.
   */
  sumberData: 'contoh' | 'server'
  sesiServer: SesiServer | null
  /** True selama sesi dari tab ini sedang dipulihkan sesudah halaman dimuat ulang. */
  memulihkanSesi: boolean
  /** Sesi portal distributor di server. Terpisah dari sesi pemilik usaha: tokennya pun berbeda jenis. */
  sesiDistributor: SesiDistributor | null
  /** Pesanan masuk dari server. `null` berarti portal distributor masih memakai data contoh. */
  pesananMasukServer: PesananMasuk[] | null
  /** Kontrak pelanggan dari server untuk portal distributor; `null` = data contoh. */
  kontrakMasukServer: KontrakPelanggan[] | null
  /** Penawaran dan paket milik distributor yang tersambung; `null` = data contoh. */
  katalogDistributorServer: { penawaran: Penawaran[]; paket: PaketKontrak[]; promo: Promo[] } | null
  racun: Racun[]
  hasilKirimTerakhir: HasilKirim | null
  /** Pesanan masuk yang aksinya sedang dikirim ke server. Tombolnya memuat dan tidak bisa ditekan dua kali. */
  pesananDiproses: string[]

  /* Tampilan & sesi */
  aturTema: (t: 'terang' | 'gelap') => void
  aturLayananPerkiraan: (v: 'sehat' | 'tersimpan' | 'mati') => void
  aturMasuk: (v: boolean) => void
  /** Masuk lewat API. Melempar GalatApi (ditolak) atau ServerTakTerjangkau (server mati). */
  masukServer: (email: string, kataSandi: string) => Promise<void>
  /** Dipanggil sekali saat aplikasi dibuka: memakai sesi yang masih berlaku di tab ini. */
  pulihkanSesiServer: () => Promise<void>
  /** Pesan satu penawaran langsung dari saran Mesin 2. Mengembalikan id pesanan baru. */
  pesanDariServer: (penawaranId: number, jumlah: number) => Promise<string | null>
  sambungDistributor: (email: string, kataSandi: string) => Promise<void>
  putusDistributor: () => void
  muatPesananMasuk: () => Promise<void>
  /** Muat ulang stok gudang dari server, mis. sesudah produksi memotong bahan baku. */
  segarkanGudangServer: () => Promise<void>
  aturPeran: (p: 'umkm' | 'distributor') => void

  /* Profil & kasir */
  ubahProfil: (p: Partial<ProfilUsaha>) => void
  ubahKasir: (p: Partial<DataKasir>) => void
  hubungkanKasir: () => void
  pasangkanMenu: (menuId: string, barangId: string) => void
  catatPemakaianHarian: (pemakaian: Record<string, number>) => void

  /* Stok */
  /** Menyimpan sisa hasil hitung di rak. Selisihnya dicatat sebagai pergerakan berjenis koreksi. */
  koreksiStok: (barangId: string, stokBaru: number) => void
  aturBatasAman: (barangId: string, batas: number, sumber: 'sistem' | 'sendiri') => void
  aturBatasAmanMassal: (barangIds: string[]) => void
  tambahBarang: (b: Barang) => void
  ubahBarang: (barangId: string, p: Partial<Barang>) => void

  /* Keranjang */
  tambahKeKeranjang: (
    distributorId: string,
    penawaranId: string,
    jumlah: number,
    saranSistem?: number | null,
    kontrakId?: string | null,
  ) => void
  ubahJumlahKeranjang: (distributorId: string, penawaranId: string, jumlah: number) => void
  hapusDariKeranjang: (distributorId: string, penawaranId: string) => void
  kosongkanKeranjang: () => void
  kirimKeranjang: () => HasilKirim
  /** Kirim keranjang ke server (mode data server). `null` kalau gagal; racun sudah ditampilkan. */
  kirimKeranjangServer: () => Promise<HasilKirim | null>

  /* Pesanan */
  kirimDraf: (pesananId: string) => void
  terimaBarang: (
    pesananId: string,
    diterima: Record<string, { jumlah: number; alasan: AlasanSelisih | null; catatan: string }>,
    tanggal: string,
  ) => void
  batalkanPesanan: (pesananId: string, alasan: string) => void
  unggahBukti: (pesananId: string) => void
  tandaiBayarTunai: (pesananId: string) => void
  tandaiSudahDiulas: (pesananId: string, ulasan?: UlasanPelanggan) => void

  /* Pesanan masuk (portal distributor) */
  /** `diam`: tanpa pemberitahuan per pesanan; dipakai aksi massal yang memberi satu ringkasan. */
  terimaPesananMasuk: (id: string, diam?: boolean) => void
  /** Terima beberapa pesanan sekaligus, dengan satu pemberitahuan ringkasan. */
  terimaSemuaPesananMasuk: (ids: string[]) => void
  tolakPesananMasuk: (id: string, alasan: string) => void
  /** `bukti` hanya dipakai di data server: isian kurir/pengantar/resi (kirim) atau penerima/catatan (sampai). */
  majukanPesananMasuk: (id: string, bukti?: Record<string, string | null>, diam?: boolean) => void
  /** Majukan beberapa pesanan setahap (berangkat atau sampai) dengan bukti yang sama, satu ringkasan. */
  majukanSemuaPesananMasuk: (ids: string[], bukti?: Record<string, string | null>) => void

  /* Kontrak */
  ajukanKontrak: (paketId: string) => string
  ajukanBerhenti: (kontrakId: string, alasan: string) => void

  // Portal distributor — kontrak
  setujuiKontrak: (id: string) => void
  tolakKontrak: (id: string, alasan: string) => void
  jawabBerhenti: (id: string, setuju: boolean, alasan?: string) => void
  simpanPaket: (paket: PaketKontrak) => void
  hapusPaket: (id: string) => void

  // Portal distributor — promo
  simpanPromo: (promo: Promo) => void
  akhiriPromo: (id: string) => void

  // Portal distributor — profil dan katalog
  simpanPenawaran: (penawaran: Penawaran) => void
  aturAktifPenawaran: (id: string, aktif: boolean) => void
  ubahDistributor: (id: string, ubahan: Partial<Distributor>) => void
  ubahPesananRutin: (kontrakId: string, aktif: boolean) => void

  /* Pemberitahuan */
  bacaNotifikasi: (id: string) => void
  bacaSemuaNotifikasi: () => void
  selesaikanNotifikasi: (id: string) => void
  tundaNotifikasi: (id: string, hari: number) => void

  /* Umpan balik */
  tampilkanRacun: (pesan: string, nada?: Racun['nada'], aksi?: Racun['aksi']) => void
  tutupRacun: (id: number) => void
}

let nomorRacun = 0
let urutPesanan = 10
let urutBelanja = 0

function temaAwal(): 'terang' | 'gelap' {
  if (typeof window === 'undefined') return 'terang'
  try {
    const disimpan = window.localStorage.getItem('warungku-tema')
    if (disimpan === 'terang' || disimpan === 'gelap') return disimpan
  } catch {
    /* penyimpanan diblokir: pakai preferensi sistem */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang'
}

function stempel(): string {
  return new Date().toISOString()
}

/**
 * Mengubah satu kontrak di tempat ia disimpan: kontrak milik pemilik aplikasi
 * ada di `kontrak`, kontrak UMKM lain di `kontrakUmkmLain`.
 */
function ubahKontrak(
  s: KeadaanAplikasi,
  id: string,
  ubah: (k: Kontrak) => Kontrak,
): Pick<KeadaanAplikasi, 'kontrak'> | Pick<KeadaanAplikasi, 'kontrakUmkmLain'> {
  if (s.kontrak.some((k) => k.id === id)) {
    return { kontrak: s.kontrak.map((k) => (k.id === id ? ubah(k) : k)) }
  }
  return { kontrakUmkmLain: s.kontrakUmkmLain.map((k) => (k.id === id ? { ...ubah(k), umkmId: k.umkmId } : k)) }
}

/** Pesanan masuk distributor aktif, termasuk pesanan pemilik aplikasi ini. */
function cariPesananMasuk(s: KeadaanAplikasi, id: string): PesananMasuk | undefined {
  if (s.pesananMasukServer) return s.pesananMasukServer.find((p) => p.id === id)
  return gabungPesananMasuk(s.pesanan, s.pesananUmkmLain).find((p) => p.id === id)
}

/** Sesudah promo berubah: portal distributor dimuat ulang, dan katalog pemilik usaha kalau sedang masuk. */
async function segarkanPromo(get: () => KeadaanAplikasi): Promise<void> {
  await get().muatPesananMasuk()
  const umkm = get().sesiServer
  if (umkm) {
    const k = await ambilKatalog(umkm).catch(() => null)
    if (k) useAplikasi.setState({ promo: k.promo })
  }
}

/** Satu aksi distributor atas kontrak, lalu kedua portal dimuat ulang. */
function aksiKontrak(
  get: () => KeadaanAplikasi,
  aksi: AksiKontrak,
  id: string,
  badan: Record<string, unknown>,
  pesan: string,
): void {
  const sesi = get().sesiDistributor
  if (!sesi) return
  aksiKontrakServer(sesi, id, aksi, badan)
    .then(async () => {
      await get().muatPesananMasuk()
      const umkm = get().sesiServer
      if (umkm) {
        const kontrak = await ambilKontrak(umkm).catch(() => null)
        if (kontrak) useAplikasi.setState({ kontrak })
      }
      get().tampilkanRacun(pesan, aksi === 'tolak' ? 'menipis' : 'aman')
    })
    .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Aksi gagal disimpan.', 'kritis'))
}

/**
 * Satu aksi distributor ke server, lalu daftar pesanan masuk dimuat ulang.
 * Kalau pemilik usaha yang sama juga sedang masuk di tab ini, daftar pesanannya
 * ikut dimuat ulang supaya kedua portal langsung melihat status yang sama.
 */
function aksiServer(
  get: () => KeadaanAplikasi,
  aksi: AksiDistributor,
  id: string,
  badan: Record<string, unknown>,
  pesan: string,
): void {
  const sesi = get().sesiDistributor
  if (!sesi) return
  // Ketukan kedua selagi yang pertama belum selesai diabaikan, bukan dikirim lagi.
  if (get().pesananDiproses.includes(id)) return
  useAplikasi.setState((s) => ({ pesananDiproses: [...s.pesananDiproses, id] }))
  aksiPesananMasuk(sesi, id, aksi, badan)
    .then(async () => {
      await get().muatPesananMasuk()
      const umkm = get().sesiServer
      if (umkm) {
        const pesanan = await ambilPesanan(umkm).catch(() => null)
        if (pesanan) useAplikasi.setState({ pesanan })
      }
      get().tampilkanRacun(pesan, aksi === 'tolak' ? 'menipis' : 'aman')
    })
    .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Aksi gagal disimpan.', 'kritis'))
    .finally(() => useAplikasi.setState((s) => ({ pesananDiproses: s.pesananDiproses.filter((x) => x !== id) })))
}

/** Pesanan ini milik pemilik aplikasi, jadi yang diubah adalah pesanan aslinya. */
function adalahPesananSendiri(s: KeadaanAplikasi, id: string): boolean {
  return s.pesanan.some((p) => p.id === id)
}

/** Satu langkah jejak pada pesanan pemilik usaha, dilakukan dari sisi distributor. */
function majukanPesananSendiri(
  pesanan: Pesanan[],
  id: string,
  langkah: { status: StatusPesanan; keterangan: string; waktu?: string },
  tambahan: Partial<Pesanan> = {},
): Pesanan[] {
  return pesanan.map((p) =>
    p.id !== id
      ? p
      : {
          ...p,
          ...tambahan,
          status: langkah.status,
          jejak: [
            ...p.jejak,
            { waktu: langkah.waktu ?? stempel(), status: langkah.status, keterangan: langkah.keterangan },
          ],
        },
  )
}

function nomorPesananBaru(): string {
  const d = new Date()
  const t = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  urutPesanan += 1
  return `PS-${t}-${String(urutPesanan).padStart(2, '0')}`
}

/**
 * Barang dan pemakaian bulanan dari server. Pemakaian bulanan dipasang SEBELUM
 * barang masuk store, supaya layar yang menghitung ulang saat `barang` berubah
 * langsung membaca angka server. Kalau endpoint bulanan gagal, gudang tetap
 * terbuka dan halaman Prediksi memakai hitungan data contoh.
 */
async function muatGudangServer(sesi: SesiServer): Promise<Barang[]> {
  const [barang, bulanan] = await Promise.all([ambilBarang(sesi), ambilPemakaianBulanan(sesi).catch(() => null)])
  pasangDataServer(bulanan, barang)
  return barang
}

/* ------------------------------------------------------------------ */
/* Keranjang tersimpan di peramban                                     */
/* ------------------------------------------------------------------ */

/**
 * Keranjang disimpan di localStorage, satu per usaha (data contoh punya kuncinya
 * sendiri), supaya tidak hilang saat tab HP dimuat ulang. Ini cukup untuk demo:
 * keranjang tidak ikut pindah perangkat, dan itu disengaja.
 */
function kunciKeranjang(sesi: SesiServer | null): string {
  return sesi ? `turnify-keranjang-usaha-${sesi.usahaId}` : 'turnify-keranjang-contoh'
}

/** Baris yang penawarannya sudah tidak ada atau nonaktif dibuang saat keranjang dibuka lagi. */
function bacaKeranjang(kunci: string, katalog: Penawaran[]): SubKeranjang[] {
  try {
    const teks = window.localStorage.getItem(kunci)
    if (!teks) return []
    const aktif = new Set(katalog.filter((p) => p.aktif !== false).map((p) => p.id))
    return (JSON.parse(teks) as SubKeranjang[])
      .map((k) => ({ ...k, baris: k.baris.filter((b) => aktif.has(b.penawaranId)) }))
      .filter((k) => k.baris.length > 0)
  } catch {
    return []
  }
}

function simpanKeranjang(kunci: string, keranjang: SubKeranjang[]): void {
  try {
    if (keranjang.length === 0) window.localStorage.removeItem(kunci)
    else window.localStorage.setItem(kunci, JSON.stringify(keranjang))
  } catch {
    /* Penyimpanan diblokir (mode privat): keranjang tetap hidup di memori. */
  }
}

interface IsiServer {
  barang: Barang[]
  pesanan: Pesanan[]
  kontrak: Kontrak[]
  katalog: Awaited<ReturnType<typeof ambilKatalog>> | null
}

/** Semua yang dibaca dari server saat masuk: gudang, pesanan, dan katalog. */
async function muatSemuaServer(sesi: SesiServer): Promise<IsiServer> {
  const [barang, pesanan, katalog, kontrak] = await Promise.all([
    muatGudangServer(sesi),
    ambilPesanan(sesi).catch(() => [] as Pesanan[]),
    ambilKatalog(sesi).catch(() => null),
    ambilKontrak(sesi).catch(() => [] as Kontrak[]),
  ])
  return { barang, pesanan, katalog, kontrak }
}

/**
 * Keadaan store untuk mode data server.
 *
 * Promo, paket kontrak, kontrak, dan pemberitahuan data contoh dikosongkan:
 * semuanya merujuk ke barang dan penawaran contoh yang tidak ada di server, dan
 * menampilkannya di samping data server berarti mencampur angka karangan dengan
 * angka sungguhan. Keranjang ikut dikosongkan karena barisnya merujuk katalog lama.
 */
function keadaanServer(s: KeadaanAplikasi, sesi: SesiServer, isi: IsiServer): Partial<KeadaanAplikasi> & { profil: ProfilUsaha } {
  const k = isi.katalog
  return {
    masuk: true,
    sumberData: 'server',
    sesiServer: sesi,
    barang: isi.barang,
    pesanan: isi.pesanan,
    ...(k
      ? {
          katalog: k.penawaran,
          distributor: k.distributor,
          promo: k.promo,
          paketKontrak: k.paket,
          kontrak: isi.kontrak,
          notifikasi: [],
          keranjang: bacaKeranjang(kunciKeranjang(sesi), k.penawaran),
        }
      : {}),
    profil: {
      ...s.profil,
      id: String(sesi.usahaId),
      namaUsaha: k?.usaha.nama ?? sesi.namaUsaha ?? s.profil.namaUsaha,
      namaPemilik: sesi.namaPengguna,
      ...(k ? { jenisUsaha: k.usaha.jenisUsaha, kota: k.usaha.kota, alamat: k.usaha.alamat } : {}),
    },
  }
}

export const useAplikasi = create<KeadaanAplikasi>((set, get) => ({
  profil: profilAwal,
  kasir: dataKasirAwal,
  barang: daftarBarang,
  pergerakan: daftarPergerakan,
  transaksi: daftarTransaksi,
  kontrak: daftarKontrak,
  pesanan: daftarPesanan,
  notifikasi: daftarNotifikasi,
  keranjang: bacaKeranjang(kunciKeranjang(null), daftarPenawaran),
  peran: 'umkm',
  pesananUmkmLain: daftarPesananMasuk,
  kontrakUmkmLain: daftarKontrakUmkmLain,
  paketKontrak: daftarPaket,
  promo: daftarPromo,
  katalog: daftarPenawaran,
  distributor: daftarDistributor,
  tema: temaAwal(),
  layananPerkiraan: 'sehat',
  // Dimulai dari keadaan belum masuk supaya "/" benar-benar memperlihatkan
  // landing page. Rute lain tidak dijaga: ini purwarupa antarmuka, jadi
  // membuka /beranda langsung tetap boleh dan memang dipakai saat memeriksa layar.
  masuk: false,
  sumberData: 'contoh',
  sesiServer: null,
  memulihkanSesi: sesiTersimpan() != null,
  sesiDistributor: null,
  pesananMasukServer: null,
  kontrakMasukServer: null,
  katalogDistributorServer: null,
  racun: [],
  hasilKirimTerakhir: null,
  pesananDiproses: [],

  aturTema: (t) => {
    try {
      window.localStorage.setItem('warungku-tema', t)
    } catch {
      /* abaikan: tema tetap berlaku untuk sesi ini */
    }
    document.documentElement.classList.toggle('dark', t === 'gelap')
    set({ tema: t })
  },

  aturLayananPerkiraan: (v) => set({ layananPerkiraan: v }),
  aturMasuk: (v) => {
    if (v) return set({ masuk: true })
    // Keluar: sesi server dilepas dan gudang kembali ke data contoh.
    simpanSesi(null)
    pasangDataServer(null)
    set({
      masuk: false,
      sumberData: 'contoh',
      sesiServer: null,
      barang: daftarBarang,
      pesanan: daftarPesanan,
      profil: profilAwal,
      katalog: daftarPenawaran,
      distributor: daftarDistributor,
      promo: daftarPromo,
      paketKontrak: daftarPaket,
      kontrak: daftarKontrak,
      notifikasi: daftarNotifikasi,
      keranjang: bacaKeranjang(kunciKeranjang(null), daftarPenawaran),
    })
  },

  masukServer: async (email, kataSandi) => {
    const sesi = await masukUmkm(email, kataSandi)
    const isi = await muatSemuaServer(sesi)
    simpanSesi(sesi)
    set((s) => ({ ...keadaanServer(s, sesi, isi), profil: { ...keadaanServer(s, sesi, isi).profil, email } }))
  },

  pulihkanSesiServer: async () => {
    const sesi = sesiTersimpan()
    if (!sesi || get().sesiServer) {
      set({ memulihkanSesi: false })
      return
    }
    try {
      const isi = await muatSemuaServer(sesi)
      set((s) => ({ ...keadaanServer(s, sesi, isi), memulihkanSesi: false }))
    } catch {
      // Token hangus (server dimuat ulang) atau server mati: mulai lagi dari data contoh.
      simpanSesi(null)
      pasangDataServer(null)
      set({ memulihkanSesi: false })
    }
  },

  kirimKeranjangServer: async () => {
    const s = get()
    const sesi = s.sesiServer
    if (!sesi) return null
    const dikirim = s.keranjang.filter((k) => !k.disimpanUntukNanti && k.baris.length > 0)
    const baris = dikirim.flatMap((k) =>
      k.baris.map((b) => ({
        penawaranId: Number(b.penawaranId),
        jumlah: b.jumlah,
        kontrakId: b.kontrakId ? Number(b.kontrakId) : null,
      })),
    )
    if (baris.length === 0) return null
    try {
      // Satu permintaan untuk seluruh keranjang: server memecahnya menjadi satu
      // pesanan per distributor dengan kode belanja yang sama.
      const dariSaran = dikirim.some((k) => k.baris.some((b) => b.saranSistem != null))
      const baru = await buatPesanan(sesi, baris, dariSaran)
      const hasil: HasilKirim = {
        kodeBelanja: baru[0]?.kodeBelanja ?? baru[0]?.nomor ?? '',
        pesanan: baru.map((p) => ({ id: p.id, nomor: p.nomor, distributorId: p.distributorId, berhasil: true })),
      }
      set((st) => ({
        pesanan: [...baru, ...st.pesanan],
        keranjang: st.keranjang.filter((k) => k.disimpanUntukNanti),
        hasilKirimTerakhir: hasil,
      }))
      return hasil
    } catch (e) {
      get().tampilkanRacun(e instanceof Error ? e.message : 'Belanja gagal dikirim. Keranjang tidak berubah.', 'kritis')
      return null
    }
  },

  pesanDariServer: async (penawaranId, jumlah) => {
    const sesi = get().sesiServer
    if (!sesi) return null
    try {
      const [baru] = await buatPesanan(sesi, [{ penawaranId, jumlah }], true)
      set((s) => ({ pesanan: [baru, ...s.pesanan] }))
      get().tampilkanRacun(`Pesanan ${baru.nomor} terkirim ke distributor.`, 'aman', {
        label: 'Lihat pesanan',
        ke: `/pesanan/${baru.id}`,
      })
      return baru.id
    } catch (e) {
      get().tampilkanRacun(e instanceof Error ? e.message : 'Pesanan gagal dikirim.', 'kritis')
      return null
    }
  },

  sambungDistributor: async (email, kataSandi) => {
    const sesi = await masukDistributor(email, kataSandi)
    simpanSesiDistributor(sesi)
    set({ sesiDistributor: sesi })
    await get().muatPesananMasuk()
  },

  putusDistributor: () => {
    simpanSesiDistributor(null)
    pasangUmkmServer([])
    set({ sesiDistributor: null, pesananMasukServer: null, kontrakMasukServer: null, katalogDistributorServer: null })
  },

  segarkanGudangServer: async () => {
    const sesi = get().sesiServer
    if (!sesi) return
    const barang = await muatGudangServer(sesi)
    set({ barang })
  },

  muatPesananMasuk: async () => {
    const sesi = get().sesiDistributor ?? sesiDistributorTersimpan()
    if (!sesi) return
    try {
      const [masuk, kontrak, katalog] = await Promise.all([
        ambilPesananMasuk(sesi),
        ambilKontrakMasuk(sesi),
        ambilKatalogDistributor(sesi),
      ])
      pasangUmkmServer([...masuk.umkm, ...kontrak.umkm])
      set({
        sesiDistributor: sesi,
        pesananMasukServer: masuk.pesanan,
        kontrakMasukServer: kontrak.kontrak,
        katalogDistributorServer: katalog,
      })
    } catch {
      // Token hangus atau server mati: portal kembali ke data contoh.
      get().putusDistributor()
    }
  },

  // Sakelar portal untuk keperluan demo. Di produk sungguhan peran datang dari
  // akun yang masuk, bukan dari tombol yang bisa ditekan siapa saja.
  aturPeran: (p) => set({ peran: p }),

  ubahProfil: (p) => set((s) => ({ profil: { ...s.profil, ...p } })),
  ubahKasir: (p) => set((s) => ({ kasir: { ...s.kasir, ...p } })),

  /**
   * Hanya satu aplikasi kasir yang didukung, jadi tidak ada merek yang perlu
   * dipilih maupun dikirim: namanya diambil langsung dari POS_TUNGGAL.
   */
  hubungkanKasir: () => {
    set((s) => ({ kasir: { ...s.kasir, status: 'menyinkron' } }))
    window.setTimeout(() => {
      set((s) => ({
        kasir: {
          ...s.kasir,
          sumber: 'kasir-digital',
          status: 'terhubung',
          merek: POS_TUNGGAL.nama,
          terakhirMasuk: stempel(),
        },
      }))
      get().tampilkanRacun(`Tersambung ke ${POS_TUNGGAL.nama}. Data penjualan mulai masuk.`, 'aman')
    }, 1500)
  },

  pasangkanMenu: (menuId, barangId) => {
    const nama = get().barang.find((b) => b.id === barangId)?.nama ?? 'bahan'
    set((s) => ({
      kasir: {
        ...s.kasir,
        menuBelumDipasangkan: s.kasir.menuBelumDipasangkan.filter((m) => m.id !== menuId),
      },
    }))
    get().tampilkanRacun(`Menu dipasangkan ke ${nama}. Penjualan berikutnya akan mengurangi stok.`, 'aman')
  },

  catatPemakaianHarian: (pemakaian) => {
    const s = get()
    const catatan: Pergerakan[] = []
    const barangBaru = s.barang.map((b) => {
      const pakai = pemakaian[b.id]
      if (!pakai || pakai <= 0) return b
      const stokBaru = Math.max(0, b.stok - pakai)
      catatan.push({
        id: `pg-${Date.now()}-${b.id}`,
        barangId: b.id,
        waktu: stempel(),
        jenis: 'terjual',
        jumlah: -pakai,
        stokSesudah: stokBaru,
        keterangan: 'Pemakaian dicatat manual',
        pesananId: null,
        transaksiId: null,
        oleh: s.profil.namaPemilik,
      })
      return { ...b, stok: stokBaru }
    })
    set({ barang: barangBaru, pergerakan: [...catatan, ...s.pergerakan] })
    get().tampilkanRacun(`Pemakaian ${catatan.length} barang tersimpan.`, 'aman')
  },

  koreksiStok: (barangId, stokBaruMentah) => {
    const barang = get().barang.find((b) => b.id === barangId)
    if (!barang) return
    const stokBaru = Math.max(0, Math.round(stokBaruMentah * 100) / 100)
    // Selisih dari angka yang tampil (stok minus ditampilkan 0), supaya riwayat
    // berbunyi sama dengan yang dilihat pemilik usaha saat mengoreksi.
    const selisih = Math.round((stokBaru - Math.max(0, barang.stok)) * 100) / 100
    if (selisih === 0) return
    const jejak: Pergerakan = {
      id: `pg-${Date.now()}`,
      barangId,
      waktu: stempel(),
      // Jenis inilah yang mengeluarkan baris ini dari data permintaan untuk
      // model perkiraan — tanpa perlu bertanya kenapa stoknya berubah.
      jenis: 'koreksi',
      jumlah: selisih,
      stokSesudah: stokBaru,
      keterangan: 'Koreksi stok',
      pesananId: null,
      transaksiId: null,
      oleh: get().profil.namaPemilik,
    }
    set((s) => ({
      barang: s.barang.map((b) => (b.id === barangId ? { ...b, stok: stokBaru } : b)),
      pergerakan: [jejak, ...s.pergerakan],
    }))
    get().tampilkanRacun(`Stok ${barang.nama} jadi ${jumlahTampil(barang, stokBaru)}.`, 'aman')
  },

  aturBatasAman: (barangId, batas, sumber) =>
    set((s) => ({
      barang: s.barang.map((b) => (b.id === barangId ? { ...b, batasAman: batas, sumberBatasAman: sumber } : b)),
    })),

  aturBatasAmanMassal: (barangIds) => {
    set((s) => ({
      barang: s.barang.map((b) =>
        barangIds.includes(b.id) ? { ...b, batasAman: b.batasAmanSaran, sumberBatasAman: 'sistem' } : b,
      ),
    }))
    get().tampilkanRacun(`Batas aman ${barangIds.length} barang mengikuti saran sistem.`, 'aman')
  },

  tambahBarang: (b) => {
    set((s) => ({ barang: [b, ...s.barang] }))
    get().tampilkanRacun(`${b.nama} ditambahkan ke daftar stok.`, 'aman')
  },

  ubahBarang: (barangId, p) =>
    set((s) => ({ barang: s.barang.map((b) => (b.id === barangId ? { ...b, ...p } : b)) })),

  tambahKeKeranjang: (distributorId, penawaranId, jumlah, saranSistem = null, kontrakIdDiminta = null) => {
    // Pengajuan yang belum disetujui (atau kontrak yang sudah berakhir) tidak
    // boleh menurunkan harga: barisnya masuk sebagai beli sekali.
    const kontrakDiminta = kontrakIdDiminta ? get().kontrak.find((k) => k.id === kontrakIdDiminta) : undefined
    const kontrakId = kontrakDiminta && kontrakBisaDipakai(kontrakDiminta) ? kontrakDiminta.id : null
    set((s) => {
      const sub = s.keranjang.find((k) => k.distributorId === distributorId)
      if (!sub) {
        return {
          keranjang: [
            ...s.keranjang,
            { distributorId, disimpanUntukNanti: false, baris: [{ penawaranId, jumlah, saranSistem, kontrakId }] },
          ],
        }
      }
      const ada = sub.baris.find((b) => b.penawaranId === penawaranId)
      return {
        keranjang: s.keranjang.map((k) =>
          k.distributorId !== distributorId
            ? k
            : {
                ...k,
                baris: ada
                  ? k.baris.map((b) => (b.penawaranId === penawaranId ? { ...b, jumlah } : b))
                  : [...k.baris, { penawaranId, jumlah, saranSistem, kontrakId }],
              },
        ),
      }
    })
  },

  ubahJumlahKeranjang: (distributorId, penawaranId, jumlah) =>
    set((s) => ({
      keranjang: s.keranjang
        .map((k) =>
          k.distributorId !== distributorId
            ? k
            : { ...k, baris: k.baris.map((b) => (b.penawaranId === penawaranId ? { ...b, jumlah } : b)) },
        )
        .filter((k) => k.baris.length > 0),
    })),

  hapusDariKeranjang: (distributorId, penawaranId) =>
    set((s) => ({
      keranjang: s.keranjang
        .map((k) =>
          k.distributorId !== distributorId ? k : { ...k, baris: k.baris.filter((b) => b.penawaranId !== penawaranId) },
        )
        .filter((k) => k.baris.length > 0),
    })),

  kosongkanKeranjang: () => set({ keranjang: [] }),

  /**
   * Satu keranjang bisa melahirkan beberapa pesanan, karena satu pesanan tidak
   * bisa melintasi dua distributor maupun dua kontrak. Semuanya diikat satu
   * kode belanja supaya pengguna tetap melihatnya sebagai satu tindakan.
   */
  kirimKeranjang: () => {
    const s = get()
    const d = new Date()
    urutBelanja += 1
    const kodeBelanja = `Belanja #${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(urutBelanja).padStart(2, '0')}`

    const pesananBaru: Pesanan[] = []
    for (const sub of s.keranjang) {
      if (sub.disimpanUntukNanti || sub.baris.length === 0) continue

      // Keranjang hanya dikelompokkan per distributor, padahal satu pesanan
      // cuma bisa membawa satu kontrakId. Dua kontrak dari distributor yang
      // sama karena itu harus dipecah: kalau tidak, kuota kontrak kedua tidak
      // pernah ikut bergerak dan tombol "Pesan sisanya" tetap menagih barang
      // yang sebetulnya sudah dipesan.
      const perKontrak = new Map<string | null, BarisKeranjang[]>()
      for (const b of sub.baris) {
        const kunci = b.kontrakId ?? null
        const kumpulan = perKontrak.get(kunci)
        if (kumpulan) kumpulan.push(b)
        else perKontrak.set(kunci, [b])
      }

      for (const [kontrakId, barisKelompok] of perKontrak) {
        // Nomor diambil lebih dulu supaya id memakai urutan yang sama dan tidak
        // ada dua pesanan yang berbagi id saat satu keranjang pecah jadi banyak.
        const nomor = nomorPesananBaru()
        pesananBaru.push({
          id: `ps-baru-${urutPesanan}`,
          nomor,
          distributorId: sub.distributorId,
          kontrakId,
          dibuatPada: stempel(),
          status: 'menunggu-konfirmasi',
          baris: barisKelompok.map((b) => {
            const p = penawaranById(b.penawaranId)
            // Lewat rincianHarga, bukan harga penawaran mentah: baris berkontrak
            // tercatat dengan HARGA KONTRAK, beli sekali yang ikut promo dengan
            // harga SETELAH potongan. Harga normal dan promonya ikut dicatat,
            // supaya pesanan ini tetap bisa menjelaskan angkanya walau promonya
            // sudah berakhir.
            const harga = rincianHarga(b.penawaranId, b.kontrakId, s.kontrak, s.promo)
            return {
              penawaranId: b.penawaranId,
              barangId: p?.barangIdTerkait ?? null,
              nama: p?.nama ?? 'Barang',
              jumlah: b.jumlah,
              satuan: p?.satuan ?? 'pcs',
              hargaSatuan: harga.harga,
              hargaNormal: harga.hargaNormal,
              promoId: harga.promo?.id ?? null,
              isiPerSatuan: p?.kemasanJual?.isi ?? 1,
              jumlahDiterima: null,
              alasanSelisih: null,
              catatanPenerimaan: null,
            }
          }),
          ongkosKirim: 0,
          perkiraanTiba: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          jejak: [{ waktu: stempel(), status: 'menunggu-konfirmasi', keterangan: 'Pesanan dikirim ke distributor.' }],
          statusBayar: 'belum-dibayar',
          jumlahBukti: 0,
          dariSaran: barisKelompok.some((b) => b.saranSistem != null),
          dariRutin: false,
          catatanUntukDistributor: '',
          sudahDiulas: false,
          kodeBelanja,
        })
      }
    }

    // Jumlah yang dipesan langsung dihitung sebagai "dalam perjalanan" pada kuota
    // kontrak, tapi TIDAK sebagai kuota terpenuhi. Kuota baru naik saat diterima.
    const kontrakBaru = s.kontrak.map((k) => {
      const tambah = pesananBaru
        .filter((p) => p.kontrakId === k.id)
        .flatMap((p) => p.baris)
        .filter((b) => b.penawaranId === k.penawaranId)
        .reduce((a, b) => a + b.jumlah, 0)
      return tambah > 0 ? { ...k, dalamPerjalanan: k.dalamPerjalanan + tambah } : k
    })

    const hasil: HasilKirim = {
      kodeBelanja,
      pesanan: pesananBaru.map((p) => ({
        id: p.id,
        nomor: p.nomor,
        distributorId: p.distributorId,
        berhasil: true,
      })),
    }

    set({
      pesanan: [...pesananBaru, ...s.pesanan],
      kontrak: kontrakBaru,
      keranjang: s.keranjang.filter((k) => k.disimpanUntukNanti),
      hasilKirimTerakhir: hasil,
    })
    return hasil
  },

  kirimDraf: (pesananId) => {
    const pesanan = get().pesanan.find((p) => p.id === pesananId)
    // Hanya draf yang boleh dikirim. Tanpa penjaga ini, menekan tombolnya dua
    // kali akan menghitung kuota kontraknya dua kali.
    if (!pesanan || pesanan.status !== 'draf') return
    set((s) => ({
      pesanan: s.pesanan.map((p) =>
        p.id !== pesananId
          ? p
          : {
              ...p,
              status: 'menunggu-konfirmasi' as StatusPesanan,
              jejak: [
                ...p.jejak,
                { waktu: stempel(), status: 'menunggu-konfirmasi' as StatusPesanan, keterangan: 'Pesanan dikirim ke distributor.' },
              ],
            },
      ),
      // Draf yang dikirim sama saja dengan kirim dari keranjang, jadi kuotanya
      // ikut pindah ke "dalam perjalanan". Kalau tidak, layar kontrak tetap
      // menagih jumlah yang sebetulnya sudah berangkat.
      kontrak: s.kontrak.map((k) => {
        if (k.id !== pesanan.kontrakId) return k
        const tambah = pesanan.baris
          .filter((b) => b.penawaranId === k.penawaranId)
          .reduce((a, b) => a + b.jumlah, 0)
        return tambah > 0 ? { ...k, dalamPerjalanan: k.dalamPerjalanan + tambah } : k
      }),
    }))
    get().tampilkanRacun('Pesanan terkirim ke distributor.', 'aman')
  },

  /**
   * Satu-satunya tempat stok gudang bertambah.
   *
   * Sengaja tidak otomatis saat pesanan berstatus dikirim: gudang hanya boleh
   * mencatat barang yang benar-benar sudah dihitung di tempat. Kalau ada
   * selisih, pesanan tetap maju ke "Selesai (ada catatan)" dan tidak pernah
   * macet, karena pesanan yang macet membuat stok tidak pernah masuk sama sekali.
   */
  terimaBarang: (pesananId, diterima, tanggal) => {
    const s = get()
    const pesanan = s.pesanan.find((p) => p.id === pesananId)
    if (!pesanan) return

    // Pesanan server: stok dinaikkan server dari hitungan ini, lalu gudang dimuat ulang.
    if (s.sesiServer && pesanan.baris.every((b) => b.barisId)) {
      const sesi = s.sesiServer
      const baris = pesanan.baris.map((b) => {
        const info = diterima[b.penawaranId] ?? { jumlah: b.jumlah, alasan: null, catatan: '' }
        return { barisId: b.barisId!, jumlah: info.jumlah, alasan: info.alasan, catatan: info.catatan }
      })
      terimaBarangServer(sesi, pesananId, baris)
        .then(async (baru) => {
          const barang = await muatGudangServer(sesi)
          set((st) => ({ barang, pesanan: st.pesanan.map((p) => (p.id === baru.id ? baru : p)) }))
          const catatan = baru.status === 'selesai-catatan'
          get().tampilkanRacun(
            catatan
              ? 'Diterima dengan catatan. Stok bertambah sesuai jumlah yang diakui.'
              : 'Barang diterima. Stok gudang bertambah.',
            catatan ? 'menipis' : 'aman',
          )
        })
        .catch((e: unknown) =>
          get().tampilkanRacun(e instanceof Error ? e.message : 'Penerimaan gagal disimpan.', 'kritis'),
        )
      return
    }

    let adaSelisih = false
    const catatan: Pergerakan[] = []
    const barangBaru = [...s.barang]

    for (const baris of pesanan.baris) {
      const info = diterima[baris.penawaranId] ?? { jumlah: baris.jumlah, alasan: null, catatan: '' }
      if (info.jumlah !== baris.jumlah || info.alasan) adaSelisih = true
      if (!baris.barangId || info.jumlah <= 0) continue
      const idx = barangBaru.findIndex((b) => b.id === baris.barangId)
      if (idx < 0) continue
      const b = barangBaru[idx]
      const tambah = info.jumlah * baris.isiPerSatuan
      const stokBaru = Math.round((b.stok + tambah) * 100) / 100
      barangBaru[idx] = {
        ...b,
        stok: stokBaru,
        hargaBeliTerakhir: baris.isiPerSatuan > 0 ? baris.hargaSatuan / baris.isiPerSatuan : baris.hargaSatuan,
      }
      catatan.push({
        id: `pg-${Date.now()}-${baris.penawaranId}`,
        barangId: b.id,
        waktu: tanggal,
        jenis: 'masuk',
        jumlah: tambah,
        stokSesudah: stokBaru,
        keterangan: `Masuk dari pesanan ${pesanan.nomor}`,
        pesananId: pesanan.id,
        transaksiId: null,
        oleh: s.profil.namaPemilik,
      })
    }

    const statusBaru: StatusPesanan = adaSelisih ? 'selesai-catatan' : 'selesai'

    set((st) => ({
      barang: barangBaru,
      pergerakan: [...catatan, ...st.pergerakan],
      pesanan: st.pesanan.map((p) =>
        p.id !== pesananId
          ? p
          : {
              ...p,
              status: statusBaru,
              baris: p.baris.map((b) => {
                const info = diterima[b.penawaranId]
                return {
                  ...b,
                  jumlahDiterima: info?.jumlah ?? b.jumlah,
                  alasanSelisih: info?.alasan ?? null,
                  catatanPenerimaan: info?.catatan || null,
                }
              }),
              jejak: [
                ...p.jejak,
                {
                  waktu: tanggal,
                  status: statusBaru,
                  keterangan: adaSelisih
                    ? 'Diterima dengan catatan. Selisihnya dilaporkan ke distributor.'
                    : 'Diterima lengkap, stok gudang sudah bertambah.',
                },
              ],
            },
      ),
      kontrak: st.kontrak.map((k) => {
        if (k.id !== pesanan.kontrakId) return k
        const jml = pesanan.baris
          .filter((b) => b.penawaranId === k.penawaranId)
          .reduce((a, b) => a + (diterima[b.penawaranId]?.jumlah ?? b.jumlah), 0)
        const dipesan = pesanan.baris
          .filter((b) => b.penawaranId === k.penawaranId)
          .reduce((a, b) => a + b.jumlah, 0)
        return {
          ...k,
          periodeBerjalan: { ...k.periodeBerjalan, diterima: k.periodeBerjalan.diterima + jml },
          dalamPerjalanan: Math.max(0, k.dalamPerjalanan - dipesan),
        }
      }),
      // Barang yang sudah masuk tidak perlu diperingatkan lagi.
      notifikasi: st.notifikasi.map((n) =>
        n.barangId && pesanan.baris.some((b) => b.barangId === n.barangId) && n.kategori === 'stok'
          ? { ...n, butuhTindakan: false, dibaca: true }
          : n,
      ),
    }))

    get().tampilkanRacun(
      adaSelisih ? 'Diterima dengan catatan. Stok bertambah sesuai jumlah yang diakui.' : 'Barang diterima. Stok gudang bertambah.',
      adaSelisih ? 'menipis' : 'aman',
    )
  },

  batalkanPesanan: (pesananId, alasan) => {
    const s = get()
    const pesanan = s.pesanan.find((p) => p.id === pesananId)
    if (s.sesiServer && pesanan?.baris.every((b) => b.barisId)) {
      batalkanPesananServer(s.sesiServer, pesananId, alasan || 'Dibatalkan pemilik usaha')
        .then((baru) => {
          set((st) => ({ pesanan: st.pesanan.map((p) => (p.id === baru.id ? baru : p)) }))
          get().tampilkanRacun('Pesanan dibatalkan.', 'menipis')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Pembatalan gagal.', 'kritis'))
      return
    }
    set((st) => ({
      pesanan: st.pesanan.map((p) =>
        p.id !== pesananId
          ? p
          : {
              ...p,
              status: 'batal' as StatusPesanan,
              jejak: [...p.jejak, { waktu: stempel(), status: 'batal' as StatusPesanan, keterangan: `Dibatalkan: ${alasan}` }],
            },
      ),
      // Pesanan batal wajib menghapus jumlahnya dari angka "sedang dikirim",
      // supaya peringatan stok tipis muncul lagi seperti seharusnya.
      kontrak: st.kontrak.map((k) => {
        if (!pesanan || k.id !== pesanan.kontrakId) return k
        const dipesan = pesanan.baris
          .filter((b) => b.penawaranId === k.penawaranId)
          .reduce((a, b) => a + b.jumlah, 0)
        return { ...k, dalamPerjalanan: Math.max(0, k.dalamPerjalanan - dipesan) }
      }),
    }))
    get().tampilkanRacun('Pesanan dibatalkan.', 'menipis')
  },

  unggahBukti: (pesananId) => {
    set((s) => ({
      pesanan: s.pesanan.map((p) =>
        p.id !== pesananId ? p : { ...p, statusBayar: 'bukti-terkirim', jumlahBukti: p.jumlahBukti + 1 },
      ),
    }))
    get().tampilkanRacun('Bukti transfer tersimpan.', 'aman')
  },

  tandaiBayarTunai: (pesananId) => {
    set((s) => ({
      pesanan: s.pesanan.map((p) => (p.id !== pesananId ? p : { ...p, statusBayar: 'bukti-terkirim' })),
    }))
    get().tampilkanRacun('Ditandai sudah dibayar tunai.', 'aman')
  },

  /* Isi penilaiannya ikut disimpan di pesanan, supaya distributor membaca
     penilaian yang sama di pesanan yang sama. */
  tandaiSudahDiulas: (pesananId, ulasan) =>
    set((s) => ({
      pesanan: s.pesanan.map((p) =>
        p.id !== pesananId ? p : { ...p, sudahDiulas: true, ulasan: ulasan ?? p.ulasan ?? null },
      ),
    })),

  terimaPesananMasuk: (id, diam = false) => {
    if (get().pesananMasukServer) return aksiServer(get, 'konfirmasi', id, {}, 'Pesanan kamu terima. Sekarang masuk antrean gudang.')
    const pesanan = cariPesananMasuk(get(), id)
    // Hanya pesanan yang belum dijawab yang boleh diterima. Menekan tombol dua
    // kali tidak boleh memundurkan pesanan yang sudah berjalan.
    if (!pesanan || pesanan.status !== 'menunggu-konfirmasi') return
    if (adalahPesananSendiri(get(), id)) {
      set((s) => ({
        pesanan: majukanPesananSendiri(s.pesanan, id, {
          status: 'disiapkan',
          keterangan: 'Distributor menerima pesanan dan mulai menyiapkan barang.',
        }),
      }))
      if (!diam) get().tampilkanRacun(`Pesanan ${pesanan.nomor} kamu terima. Sekarang masuk antrean gudang.`, 'aman')
      return
    }
    set((s) => ({
      pesananUmkmLain: s.pesananUmkmLain.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              status: 'disiapkan' as StatusPesananMasuk,
              jejak: [
                ...p.jejak,
                {
                  waktu: stempel(),
                  status: 'disiapkan' as StatusPesananMasuk,
                  keterangan: 'Pesanan kamu terima. Barang mulai disiapkan di gudang.',
                },
              ],
            },
      ),
    }))
    if (!diam) get().tampilkanRacun(`Pesanan ${pesanan.nomor} kamu terima. Sekarang masuk antrean gudang.`, 'aman')
  },

  terimaSemuaPesananMasuk: (ids) => {
    const sesi = get().sesiDistributor
    if (!get().pesananMasukServer || !sesi) {
      for (const id of ids) get().terimaPesananMasuk(id, true)
      get().tampilkanRacun(`${ids.length} pesanan kamu terima. Semuanya masuk antrean gudang.`, 'aman')
      return
    }
    const baru = ids.filter((id) => !get().pesananDiproses.includes(id))
    if (baru.length === 0) return
    set((s) => ({ pesananDiproses: [...s.pesananDiproses, ...baru] }))
    // Endpoint server per pesanan: dikirim bersamaan, lalu satu ringkasan.
    Promise.allSettled(baru.map((id) => aksiPesananMasuk(sesi, id, 'konfirmasi', {})))
      .then(async (hasil) => {
        const gagal = hasil.filter((h) => h.status === 'rejected').length
        await get().muatPesananMasuk()
        const umkm = get().sesiServer
        if (umkm) {
          const pesanan = await ambilPesanan(umkm).catch(() => null)
          if (pesanan) useAplikasi.setState({ pesanan })
        }
        const diterima = baru.length - gagal
        get().tampilkanRacun(
          gagal === 0
            ? `${diterima} pesanan kamu terima. Semuanya masuk antrean gudang.`
            : `${diterima} pesanan diterima, ${gagal} gagal disimpan. Coba terima yang tersisa sekali lagi.`,
          gagal === 0 ? 'aman' : 'menipis',
        )
      })
      .finally(() => set((s) => ({ pesananDiproses: s.pesananDiproses.filter((x) => !baru.includes(x)) })))
  },

  tolakPesananMasuk: (id, alasan) => {
    // Penolakan tanpa alasan tidak pernah disimpan: pemilik usaha berhak tahu
    // kenapa pesanannya batal, dan alasan kosong membuat jejaknya tidak berguna.
    const alasanBersih = alasan.trim()
    if (!alasanBersih) return
    if (get().pesananMasukServer) {
      return aksiServer(get, 'tolak', id, { alasan: alasanBersih }, 'Pesanan ditolak. Alasannya ikut terkirim ke pemilik usaha.')
    }
    const pesanan = cariPesananMasuk(get(), id)
    if (!pesanan || pesanan.status !== 'menunggu-konfirmasi') return
    if (adalahPesananSendiri(get(), id)) {
      const asal = get().pesanan.find((p) => p.id === id)
      set((s) => ({
        pesanan: majukanPesananSendiri(
          s.pesanan,
          id,
          { status: 'batal', keterangan: `Ditolak distributor: ${alasanBersih}` },
          { alasanTolak: alasanBersih },
        ),
        // Sama seperti pembatalan: jumlah yang tadinya "sedang dikirim" pada
        // kuota kontrak dikembalikan, supaya peringatan stok tipis muncul lagi.
        kontrak: s.kontrak.map((k) => {
          if (!asal || k.id !== asal.kontrakId) return k
          const dipesan = asal.baris
            .filter((b) => b.penawaranId === k.penawaranId)
            .reduce((a, b) => a + b.jumlah, 0)
          return { ...k, dalamPerjalanan: Math.max(0, k.dalamPerjalanan - dipesan) }
        }),
      }))
      get().tampilkanRacun(`Pesanan ${pesanan.nomor} ditolak. Alasannya ikut terkirim ke pemilik usaha.`, 'menipis')
      return
    }
    set((s) => ({
      pesananUmkmLain: s.pesananUmkmLain.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              status: 'ditolak' as StatusPesananMasuk,
              alasanTolak: alasanBersih,
              jejak: [
                ...p.jejak,
                {
                  waktu: stempel(),
                  status: 'ditolak' as StatusPesananMasuk,
                  keterangan: `Ditolak: ${alasanBersih}`,
                },
              ],
            },
      ),
    }))
    get().tampilkanRacun(`Pesanan ${pesanan.nomor} ditolak. Alasannya ikut terkirim ke pemilik usaha.`, 'menipis')
  },

  /**
   * Satu tombol untuk maju satu tahap, karena tahapnya memang berurutan dan
   * distributor tidak pernah boleh melompati pengiriman.
   */
  majukanPesananMasuk: (id, isianBukti = {}, diam = false) => {
    const pesanan = cariPesananMasuk(get(), id)
    if (!pesanan) return
    if (get().pesananMasukServer) {
      if (pesanan.status === 'disiapkan') return aksiServer(get, 'kirim', id, isianBukti, 'Pesanan ditandai sedang dikirim.')
      if (pesanan.status === 'dikirim')
        return aksiServer(get, 'sampai', id, isianBukti, 'Pesanan ditandai sudah sampai. Stok pemilik usaha bertambah setelah ia menghitung barangnya.')
      return
    }
    const sendiri = adalahPesananSendiri(get(), id)

    if (pesanan.status === 'disiapkan') {
      // Perkiraan yang sudah dijanjikan ke pemilik usaha tidak boleh mundur
      // justru pada saat barangnya berangkat. Tanggal baru hanya dipakai kalau
      // memang belum ada atau sudah telanjur lewat.
      const lama = pesanan.perkiraanTiba ? +new Date(pesanan.perkiraanTiba) : NaN
      const masihDiDepan = Number.isFinite(lama) && lama > Date.now()
      const tiba =
        masihDiDepan && pesanan.perkiraanTiba
          ? pesanan.perkiraanTiba
          : new Date(Date.now() + 2 * 86_400_000).toISOString()
      if (sendiri) {
        set((s) => ({
          pesanan: majukanPesananSendiri(
            s.pesanan,
            id,
            { status: 'dikirim', keterangan: 'Barang berangkat dari gudang distributor.' },
            { perkiraanTiba: tiba },
          ),
        }))
        if (!diam) get().tampilkanRacun(
          `Pesanan ${pesanan.nomor} ditandai sedang dikirim. Perkiraan sampai ${waktuNanti(tiba)}.`,
          'info',
        )
        return
      }
      set((s) => ({
        pesananUmkmLain: s.pesananUmkmLain.map((p) =>
          p.id !== id
            ? p
            : {
                ...p,
                status: 'dikirim' as StatusPesananMasuk,
                perkiraanTiba: tiba,
                jejak: [
                  ...p.jejak,
                  {
                    waktu: stempel(),
                    status: 'dikirim' as StatusPesananMasuk,
                    keterangan: 'Barang berangkat dari gudang.',
                  },
                ],
              },
        ),
      }))
      // Racunnya menyebut tanggal yang benar-benar tersimpan, bukan angka tetap.
      if (!diam) get().tampilkanRacun(
        `Pesanan ${pesanan.nomor} ditandai sedang dikirim. Perkiraan sampai ${waktuNanti(tiba)}.`,
        'info',
      )
      return
    }

    if (pesanan.status !== 'dikirim') return

    const waktuSampai = stempel()
    const bukti: BuktiPengiriman = {
      kurir: 'Kirim Cepat Jogja',
      namaPengantar: 'Sigit Nugroho',
      nomorResi: `KCJ-${pesanan.nomor}`,
      diterimaOleh: sendiri ? get().profil.namaPemilik : (umkmById(pesanan.umkmId)?.nama ?? 'Pemilik usaha'),
      waktuSampai,
      catatan: 'Barang diserahkan langsung di tempat dan dihitung bersama penerima.',
      foto: ['Foto barang saat diturunkan', 'Foto tanda terima yang sudah ditandatangani'],
    }
    if (sendiri) {
      // Di sisi distributor pesanan ini selesai. Di sisi pemilik usaha ia tetap
      // "dikirim" sampai barangnya dihitung lewat Terima Barang: stok gudang
      // hanya boleh bertambah dari hitungan pemilik usaha sendiri.
      set((s) => ({
        pesanan: majukanPesananSendiri(
          s.pesanan,
          id,
          {
            status: 'dikirim',
            keterangan: 'Distributor menandai barang sudah sampai. Hitung barangnya, lalu konfirmasi penerimaan.',
            waktu: waktuSampai,
          },
          { pengiriman: bukti },
        ),
      }))
      if (!diam) get().tampilkanRacun(`Pesanan ${pesanan.nomor} sudah sampai. Bukti pengirimannya tersimpan.`, 'aman')
      return
    }
    set((s) => ({
      pesananUmkmLain: s.pesananUmkmLain.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              status: 'selesai' as StatusPesananMasuk,
              pengiriman: bukti,
              jejak: [
                ...p.jejak,
                {
                  waktu: waktuSampai,
                  status: 'selesai' as StatusPesananMasuk,
                  keterangan: 'Barang sampai di pemilik usaha.',
                },
              ],
            },
      ),
    }))
    if (!diam) get().tampilkanRacun(`Pesanan ${pesanan.nomor} sudah sampai. Bukti pengirimannya tersimpan.`, 'aman')
  },

  /**
   * Pengajuan belum mengikat sampai distributor menyetujui: selama statusnya
   * masih 'menunggu-persetujuan' inilah satu-satunya jendela pembatalan yang
   * dipunyai pemilik usaha. Karena itu pengajuannya wajib benar-benar
   * tersimpan — layar Periksa Kesepakatan menjanjikan bahwa isinya terekam
   * sebagai bukti dan bisa dibuka lagi di daftar kontrak.
   */

  majukanSemuaPesananMasuk: (ids, bukti = {}) => {
    const daftar = ids.map((id) => cariPesananMasuk(get(), id)).filter((p): p is PesananMasuk => p != null)
    if (daftar.length === 0) return
    const berangkat = daftar[0].status === 'disiapkan'
    const kalimat = (n: number) =>
      berangkat ? `${n} pesanan ditandai sedang dikirim.` : `${n} pesanan ditandai sudah sampai.`
    const sesi = get().sesiDistributor
    if (!get().pesananMasukServer || !sesi) {
      for (const p of daftar) get().majukanPesananMasuk(p.id, bukti, true)
      get().tampilkanRacun(kalimat(daftar.length), 'aman')
      return
    }
    const baru = daftar.map((p) => p.id).filter((id) => !get().pesananDiproses.includes(id))
    if (baru.length === 0) return
    set((s) => ({ pesananDiproses: [...s.pesananDiproses, ...baru] }))
    Promise.allSettled(baru.map((id) => aksiPesananMasuk(sesi, id, berangkat ? 'kirim' : 'sampai', bukti)))
      .then(async (hasil) => {
        const gagal = hasil.filter((h) => h.status === 'rejected').length
        await get().muatPesananMasuk()
        const umkm = get().sesiServer
        if (umkm) {
          const pesanan = await ambilPesanan(umkm).catch(() => null)
          if (pesanan) useAplikasi.setState({ pesanan })
        }
        get().tampilkanRacun(
          gagal === 0
            ? kalimat(baru.length)
            : `${baru.length - gagal} pesanan berhasil, ${gagal} gagal disimpan. Coba yang tersisa sekali lagi.`,
          gagal === 0 ? 'aman' : 'menipis',
        )
      })
      .finally(() => set((s) => ({ pesananDiproses: s.pesananDiproses.filter((x) => !baru.includes(x)) })))
  },

  ajukanKontrak: (paketId) => {
    const sesi = get().sesiServer
    if (sesi && /^\d+$/.test(paketId)) {
      ajukanKontrakServer(sesi, paketId)
        .then((k) => {
          set((s) => ({ kontrak: [k, ...s.kontrak.filter((x) => x.id !== k.id)] }))
          get().tampilkanRacun('Pengajuan kontrak terkirim. Menunggu persetujuan distributor.', 'info')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Pengajuan gagal dikirim.', 'kritis'))
      return `srv-ajuan-${paketId}`
    }
    const id = `k-ajuan-${paketId}`
    const paket = paketById(paketId, get().paketKontrak)
    const penawaran = paket ? penawaranById(paket.penawaranId) : undefined
    // Menekan tombolnya dua kali tidak boleh melahirkan dua pengajuan kembar.
    const sudahAda = get().kontrak.some((k) => k.id === id)

    if (paket && penawaran && !sudahAda) {
      const mulai = new Date()
      const berakhir = new Date(mulai)
      berakhir.setMonth(berakhir.getMonth() + paket.durasiBulan)
      const pengajuan: Kontrak = {
        id,
        paketId,
        distributorId: paket.distributorId,
        penawaranId: paket.penawaranId,
        barangId: penawaran.barangIdTerkait ?? '',
        namaBarang: penawaran.nama,
        durasiBulan: paket.durasiBulan,
        kuotaMinPerBulan: paket.kuotaMinPerBulan,
        hargaSatuan: paket.hargaSatuan,
        satuan: penawaran.satuan,
        mulai: mulai.toISOString(),
        berakhir: berakhir.toISOString(),
        status: 'menunggu-persetujuan',
        riwayat: [],
        periodeBerjalan: {
          periode: `${mulai.getFullYear()}-${String(mulai.getMonth() + 1).padStart(2, '0')}`,
          kuota: paket.kuotaMinPerBulan,
          diterima: 0,
          selesai: false,
        },
        dalamPerjalanan: 0,
        ketentuanKuotaKurang: paket.ketentuanKuotaKurang,
        pesananRutinAktif: false,
        pesananRutinBerikutnya: null,
      }
      set((s) => ({ kontrak: [pengajuan, ...s.kontrak] }))
    }

    get().tampilkanRacun('Pengajuan kontrak terkirim. Menunggu persetujuan distributor.', 'info')
    return id
  },

  /**
   * Kontrak tidak bisa dihentikan sepihak: pengajuan ini hanya tersimpan dan
   * menunggu jawaban distributor. Sampai dijawab, kewajiban kuota tetap ada.
   */
  ajukanBerhenti: (kontrakId, alasan) => {
    const sesi = get().sesiServer
    if (sesi && /^\d+$/.test(kontrakId)) {
      berhentiKontrakServer(sesi, kontrakId, alasan.trim())
        .then((k) => {
          set((s) => ({ kontrak: s.kontrak.map((x) => (x.id === k.id ? k : x)) }))
          get().tampilkanRacun('Pengajuan penghentian terkirim. Kontrak tetap berjalan sampai distributor menjawab.', 'info')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Pengajuan gagal dikirim.', 'kritis'))
      return
    }
    set((s) => ({
      kontrak: s.kontrak.map((k) =>
        k.id !== kontrakId
          ? k
          : { ...k, pengajuanBerhenti: { waktu: stempel(), alasan: alasan.trim() }, jawabanBerhenti: null },
      ),
    }))
    get().tampilkanRacun('Pengajuan penghentian terkirim. Kontrak tetap berjalan sampai distributor menjawab.', 'info')
  },

  setujuiKontrak: (id) => {
    if (get().kontrakMasukServer) return aksiKontrak(get, 'setujui', id, {}, 'Kontrak disetujui. Harga kontrak berlaku mulai hari ini.')
    const k = gabungKontrakMasuk(get().kontrak, get().kontrakUmkmLain).find((x) => x.id === id)
    if (!k || k.status !== 'menunggu-persetujuan') return
    // Masa kontrak dihitung sejak disetujui, bukan sejak diajukan: sebelum
    // disetujui belum ada kewajiban apa pun bagi kedua pihak.
    const mulai = new Date()
    const berakhir = new Date(mulai)
    berakhir.setMonth(berakhir.getMonth() + k.durasiBulan)
    set((s) =>
      ubahKontrak(s, id, (x) => ({
        ...x,
        status: 'aktif',
        mulai: mulai.toISOString(),
        berakhir: berakhir.toISOString(),
        periodeBerjalan: {
          periode: `${mulai.getFullYear()}-${String(mulai.getMonth() + 1).padStart(2, '0')}`,
          kuota: x.kuotaMinPerBulan,
          diterima: 0,
          selesai: false,
        },
      })),
    )
    get().tampilkanRacun(
      `Kontrak ${k.namaBarang} untuk ${umkmById(k.umkmId)?.nama ?? 'pemilik usaha'} disetujui. Harga kontrak berlaku mulai hari ini.`,
      'aman',
    )
  },

  tolakKontrak: (id, alasan) => {
    const alasanBersih = alasan.trim()
    if (!alasanBersih) return
    if (get().kontrakMasukServer) {
      return aksiKontrak(get, 'tolak', id, { alasan: alasanBersih }, 'Pengajuan kontrak ditolak. Alasannya ikut terkirim ke pemilik usaha.')
    }
    const k = gabungKontrakMasuk(get().kontrak, get().kontrakUmkmLain).find((x) => x.id === id)
    if (!k || k.status !== 'menunggu-persetujuan') return
    set((s) => ubahKontrak(s, id, (x) => ({ ...x, status: 'ditolak', alasanDitolak: alasanBersih })))
    get().tampilkanRacun('Pengajuan kontrak ditolak. Alasannya ikut terkirim ke pemilik usaha.', 'menipis')
  },

  jawabBerhenti: (id, setuju, alasan = '') => {
    if (get().kontrakMasukServer) {
      if (!setuju && !alasan.trim()) return
      return aksiKontrak(
        get,
        'jawab-berhenti',
        id,
        { setuju, alasan: setuju ? null : alasan.trim() },
        setuju ? 'Kontrak dihentikan. Pemilik usaha kembali membeli dengan harga biasa.' : 'Pengajuan berhenti ditolak. Kontrak tetap berjalan.',
      )
    }
    const k = gabungKontrakMasuk(get().kontrak, get().kontrakUmkmLain).find((x) => x.id === id)
    if (!k?.pengajuanBerhenti) return
    const waktu = stempel()
    if (setuju) {
      set((s) =>
        ubahKontrak(s, id, (x) => ({
          ...x,
          status: 'dihentikan',
          berakhir: waktu,
          pesananRutinAktif: false,
          pesananRutinBerikutnya: null,
          pengajuanBerhenti: null,
          jawabanBerhenti: { waktu, disetujui: true, alasan: null },
        })),
      )
      get().tampilkanRacun(`Kontrak ${k.namaBarang} dihentikan. Pemilik usaha kembali membeli dengan harga biasa.`, 'info')
      return
    }
    const alasanBersih = alasan.trim()
    if (!alasanBersih) return
    set((s) =>
      ubahKontrak(s, id, (x) => ({
        ...x,
        pengajuanBerhenti: null,
        jawabanBerhenti: { waktu, disetujui: false, alasan: alasanBersih },
      })),
    )
    get().tampilkanRacun('Pengajuan berhenti ditolak. Kontrak tetap berjalan sampai masanya habis.', 'menipis')
  },

  simpanPaket: (paket) => {
    const sesiD = get().sesiDistributor
    if (sesiD && get().katalogDistributorServer) {
      simpanPaketServer(sesiD, paket)
        .then(async (p) => {
          await get().muatPesananMasuk()
          get().tampilkanRacun(`${p.kode} tersimpan. Kontrak yang sudah berjalan tetap memakai ketentuan lamanya.`, 'aman')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Paket gagal disimpan.', 'kritis'))
      return
    }
    const ada = get().paketKontrak.some((p) => p.id === paket.id)
    set((s) => ({
      paketKontrak: ada ? s.paketKontrak.map((p) => (p.id === paket.id ? paket : p)) : [...s.paketKontrak, paket],
    }))
    get().tampilkanRacun(
      ada ? `${paket.kode} diperbarui. Kontrak yang sudah berjalan tetap memakai ketentuan lamanya.` : `${paket.kode} ditambahkan.`,
      'aman',
    )
  },

  hapusPaket: (id) => {
    const sesiD = get().sesiDistributor
    if (sesiD && get().katalogDistributorServer) {
      hapusPaketServer(sesiD, id)
        .then(async () => {
          await get().muatPesananMasuk()
          get().tampilkanRacun('Paket dihapus. Kontrak yang sudah berjalan dengan paket ini tidak terpengaruh.', 'info')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Paket gagal dihapus.', 'kritis'))
      return
    }
    const paket = get().paketKontrak.find((p) => p.id === id)
    if (!paket) return
    set((s) => ({ paketKontrak: s.paketKontrak.filter((p) => p.id !== id) }))
    get().tampilkanRacun(`${paket.kode} dihapus. Kontrak yang sudah berjalan dengan paket ini tidak terpengaruh.`, 'info')
  },

  simpanPromo: (promo) => {
    const sesiD = get().sesiDistributor
    if (sesiD && get().katalogDistributorServer) {
      simpanPromoServer(sesiD, promo)
        .then(async (p) => {
          await segarkanPromo(get)
          get().tampilkanRacun(`Promo "${p.judul}" tersimpan dan tampil di Beranda pemilik usaha.`, 'aman')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Promo gagal disimpan.', 'kritis'))
      return
    }
    const ada = get().promo.some((p) => p.id === promo.id)
    set((s) => ({ promo: ada ? s.promo.map((p) => (p.id === promo.id ? promo : p)) : [promo, ...s.promo] }))
    get().tampilkanRacun(
      ada
        ? `Promo "${promo.judul}" diperbarui. Kartunya di Beranda pemilik usaha ikut berubah.`
        : `Promo "${promo.judul}" terpasang dan tampil di Beranda pemilik usaha.`,
      'aman',
    )
  },

  /* Promo tidak dihapus, hanya diakhiri: pesanan yang sudah memakai
     potongannya masih perlu menyebut promo mana asalnya. */
  akhiriPromo: (id) => {
    const sesiD = get().sesiDistributor
    if (sesiD && get().katalogDistributorServer) {
      akhiriPromoServer(sesiD, id)
        .then(async () => {
          await segarkanPromo(get)
          get().tampilkanRacun('Promo diakhiri. Pesanan yang sudah memakainya tetap memakai harga potongan.', 'info')
        })
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Promo gagal diakhiri.', 'kritis'))
      return
    }
    const promo = get().promo.find((p) => p.id === id)
    if (!promo) return
    const kemarin = new Date(Date.now() - 60_000).toISOString()
    set((s) => ({ promo: s.promo.map((p) => (p.id === id ? { ...p, berakhir: kemarin } : p)) }))
    get().tampilkanRacun(`Promo "${promo.judul}" diakhiri. Harga kembali normal mulai sekarang.`, 'info')
  },

  simpanPenawaran: (penawaran) => {
    const ada = get().katalog.some((p) => p.id === penawaran.id)
    set((s) => ({
      katalog: ada ? s.katalog.map((p) => (p.id === penawaran.id ? penawaran : p)) : [...s.katalog, penawaran],
    }))
    get().tampilkanRacun(
      ada
        ? `${penawaran.nama} diperbarui. Pemilik usaha melihat harga dan stok yang baru.`
        : `${penawaran.nama} ditambahkan ke katalogmu.`,
      'aman',
    )
  },

  aturAktifPenawaran: (id, aktif) => {
    const pw = get().katalog.find((p) => p.id === id)
    if (!pw) return
    set((s) => ({ katalog: s.katalog.map((p) => (p.id === id ? { ...p, aktif } : p)) }))
    get().tampilkanRacun(
      aktif
        ? `${pw.nama} dijual lagi dan kembali tampil di katalog pemilik usaha.`
        : `${pw.nama} disembunyikan dari katalog. Pesanan dan kontrak yang sudah ada tidak terpengaruh.`,
      'info',
    )
  },

  ubahDistributor: (id, ubahan) => {
    set((s) => ({ distributor: s.distributor.map((d) => (d.id === id ? { ...d, ...ubahan } : d)) }))
    get().tampilkanRacun('Profil toko tersimpan. Pemilik usaha langsung melihat versi yang baru.', 'aman')
  },

  ubahPesananRutin: (kontrakId, aktif) => {
    const sesi = get().sesiServer
    if (sesi && /^\d+$/.test(kontrakId)) {
      rutinKontrakServer(sesi, kontrakId, aktif)
        .then((k) => set((s) => ({ kontrak: s.kontrak.map((x) => (x.id === k.id ? k : x)) })))
        .catch((e: unknown) => get().tampilkanRacun(e instanceof Error ? e.message : 'Pesanan rutin gagal diubah.', 'kritis'))
      return
    }
    set((s) => ({
      kontrak: s.kontrak.map((k) => (k.id === kontrakId ? { ...k, pesananRutinAktif: aktif } : k)),
    }))
  },

  bacaNotifikasi: (id) =>
    set((s) => ({ notifikasi: s.notifikasi.map((n) => (n.id === id ? { ...n, dibaca: true } : n)) })),

  bacaSemuaNotifikasi: () => set((s) => ({ notifikasi: s.notifikasi.map((n) => ({ ...n, dibaca: true })) })),

  selesaikanNotifikasi: (id) =>
    set((s) => ({
      notifikasi: s.notifikasi.map((n) => (n.id === id ? { ...n, dibaca: true, butuhTindakan: false } : n)),
    })),

  tundaNotifikasi: (id, hari) => {
    const sampai = new Date(Date.now() + hari * 86_400_000).toISOString()
    set((s) => ({
      notifikasi: s.notifikasi.map((n) =>
        n.id === id ? { ...n, dibaca: true, butuhTindakan: false, dibisukanSampai: sampai } : n,
      ),
    }))
    get().tampilkanRacun(
      hari === 1
        ? 'Diingatkan lagi besok pagi.'
        : hari >= 7
          ? 'Diingatkan lagi minggu depan.'
          : `Diingatkan lagi ${hari} hari lagi.`,
      'info',
    )
  },

  tampilkanRacun: (pesan, nada = 'aman', aksi) => {
    const id = (nomorRacun += 1)
    set((s) => ({ racun: [...s.racun, { id, pesan, nada, aksi }] }))
    // Pemberitahuan yang membawa tautan diberi waktu lebih lama: orang perlu
    // membaca DAN memutuskan menekan tautannya.
    window.setTimeout(() => get().tutupRacun(id), aksi ? 7000 : 4200)
  },

  tutupRacun: (id) => set((s) => ({ racun: s.racun.filter((r) => r.id !== id) })),
}))

/* ------------------------------------------------------------------ */
/* Pembaca turunan                                                     */
/* ------------------------------------------------------------------ */

const URUT_STATUS = { habis: 0, menipis: 1, aman: 2 } as const

export function useBarangPerluPerhatian(): Barang[] {
  return useAplikasi((s) =>
    s.barang
      .filter((b) => !b.dicatatManual && (statusStok(b) === 'habis' || statusStok(b) === 'menipis'))
      .slice()
      .sort((a, b) => URUT_STATUS[statusStok(a)] - URUT_STATUS[statusStok(b)]),
  )
}

/** Badge lonceng hanya menghitung yang benar-benar butuh tindakan. */
export function useJumlahPerluTindakan(): number {
  return useAplikasi((s) => s.notifikasi.filter((n) => n.butuhTindakan && !n.dibaca).length)
}

export function useJumlahKeranjang(): number {
  return useAplikasi((s) => s.keranjang.reduce((a, k) => a + k.baris.length, 0))
}

export function usePesananBerjalan(): Pesanan[] {
  return useAplikasi((s) => s.pesanan.filter((p) => PESANAN_BERJALAN.includes(p.status)))
}

/**
 * Struk yang membuat stok satu barang berkurang, terbaru dulu.
 *
 * Dibatasi 10 karena ini dipakai sebagai bukti di Detail Barang, bukan sebagai
 * daftar transaksi lengkap.
 */
export function useTransaksiUntukBarang(barangId: string): Transaksi[] {
  const pergerakan = useAplikasi((s) => s.pergerakan)
  const transaksi = useAplikasi((s) => s.transaksi)
  return useMemo(() => {
    const indeks = new Map(transaksi.map((t) => [t.id, t]))
    const sudah = new Set<string>()
    const hasil: Transaksi[] = []
    for (const p of pergerakan) {
      if (p.barangId !== barangId || p.jenis !== 'terjual' || !p.transaksiId) continue
      if (sudah.has(p.transaksiId)) continue
      const t = indeks.get(p.transaksiId)
      if (!t) continue
      sudah.add(p.transaksiId)
      hasil.push(t)
    }
    return hasil.sort((a, b) => b.waktu.localeCompare(a.waktu)).slice(0, 10)
  }, [pergerakan, transaksi, barangId])
}

/** Jumlah satu barang yang sedang dalam perjalanan, dari semua pesanan berjalan. */
export function useSedangDikirim(barangId: string): { jumlah: number; pesananId: string | null; tiba: string | null } {
  return useAplikasi((s) => {
    let jumlah = 0
    let pesananId: string | null = null
    let tiba: string | null = null
    for (const p of s.pesanan) {
      if (!PESANAN_BERJALAN.includes(p.status) || p.status === 'draf') continue
      for (const b of p.baris) {
        if (b.barangId !== barangId) continue
        jumlah += b.jumlah * b.isiPerSatuan
        pesananId = pesananId ?? p.id
        tiba = tiba ?? p.perkiraanTiba
      }
    }
    return { jumlah, pesananId, tiba }
  })
}

/* ------------------------------------------------------------------ */
/* Pembaca turunan — portal distributor                                */
/* ------------------------------------------------------------------ */

/**
 * Kotak masuk distributor aktif: pesanan pemilik aplikasi ini (dibaca langsung
 * dari daftar pesanannya) ditambah pesanan UMKM lain. Satu-satunya pintu
 * portal distributor untuk membaca pesanan.
 */
export function usePesananMasuk(): PesananMasuk[] {
  const pesanan = useAplikasi((s) => s.pesanan)
  const lain = useAplikasi((s) => s.pesananUmkmLain)
  const server = useAplikasi((s) => s.pesananMasukServer)
  return useMemo(() => server ?? gabungPesananMasuk(pesanan, lain), [server, pesanan, lain])
}

/*
 * Satu titik sinkron: setiap kali katalog atau profil distributor berubah,
 * pembaca di data/dummy (penawaranById, distributorById, ...) ikut membaca
 * versi terbaru, termasuk fungsi murni seperti rincianHarga dan rekomendasi.
 */
// Setiap perubahan keranjang disimpan ke kunci milik usaha yang sedang aktif.
useAplikasi.subscribe((s, sebelum) => {
  if (s.keranjang !== sebelum.keranjang) simpanKeranjang(kunciKeranjang(s.sesiServer), s.keranjang)
})

useAplikasi.subscribe((s, sebelum) => {
  if (s.katalog !== sebelum.katalog || s.distributor !== sebelum.distributor) {
    sinkronKatalog(s.distributor, s.katalog)
  }
})

/** Profil distributor yang membuka portal, versi terbaru dari store. */
export function useDistributorAktif(): Distributor {
  return useAplikasi((s) => s.distributor.find((d) => d.id === distributorAktif.id) ?? distributorAktif)
}

/**
 * Penentu harga yang sudah terikat ke kontrak dan promo di store.
 *
 * Namanya sengaja sama dengan fungsi di data/dummy, jadi layar cukup mengganti
 * asal impornya. Tidak ada lagi pemanggilan yang lupa mengirim daftar kontrak
 * atau promo yang sedang berlaku: kelupaan itu membuat harga di satu layar
 * berbeda dengan harga yang akhirnya tercatat di pesanan.
 */
export function usePenentuHarga() {
  const kontrak = useAplikasi((s) => s.kontrak)
  const promo = useAplikasi((s) => s.promo)
  return useMemo(
    () => ({
      rincianHarga: (penawaranId: string, kontrakId: string | null = null) =>
        rincianHarga(penawaranId, kontrakId, kontrak, promo),
      hargaBerlaku: (penawaranId: string, kontrakId: string | null = null) =>
        hargaBerlakuDasar(penawaranId, kontrakId, kontrak, promo),
      promoUntukPenawaran: (penawaranId: string) => promoUntukPenawaranDasar(penawaranId, undefined, promo),
      promoById: (id: string) => promoByIdDasar(id, promo),
    }),
    [kontrak, promo],
  )
}

/** Semua kontrak distributor aktif, termasuk milik pemilik aplikasi ini. */
export function useKontrakMasuk(): KontrakPelanggan[] {
  const kontrak = useAplikasi((s) => s.kontrak)
  const lain = useAplikasi((s) => s.kontrakUmkmLain)
  const server = useAplikasi((s) => s.kontrakMasukServer)
  return useMemo(() => server ?? gabungKontrakMasuk(kontrak, lain), [server, kontrak, lain])
}

/** Angka merah pada lonceng distributor: pesanan yang menunggu dijawab. */
/** Sumbernya sama dengan usePesananMasuk: data server bila ada, supaya spanduk dan lonceng cocok dengan rekap. */
export function useJumlahPerluKonfirmasi(): number {
  return useAplikasi(
    (s) =>
      (s.pesananMasukServer ?? gabungPesananMasuk(s.pesanan, s.pesananUmkmLain)).filter(
        (p) => p.status === 'menunggu-konfirmasi',
      ).length,
  )
}

/**
 * Semua tab pesanan distributor sekaligus.
 *
 * Dikelompokkan di luar selektor: zustand membandingkan hasil selektor dengan
 * Object.is, jadi objek baru dari dalam selektor akan memicu render tanpa henti.
 */
export function usePesananMasukPerStatus(): Record<StatusPesananMasuk, PesananMasuk[]> {
  const pesananMasuk = usePesananMasuk()
  return useMemo(() => {
    const per: Record<StatusPesananMasuk, PesananMasuk[]> = {
      'menunggu-konfirmasi': [],
      disiapkan: [],
      dikirim: [],
      selesai: [],
      ditolak: [],
    }
    for (const p of pesananMasuk) per[p.status].push(p)
    return per
  }, [pesananMasuk])
}

/** Warna paling mendesak menang saat satu UMKM punya beberapa kondisi sekaligus. */
const URUT_WARNA_TITIK: Record<WarnaTitik, number> = { merah: 0, oren: 1, biru: 2 }

/**
 * Satu titik per UMKM pada peta sebaran.
 *
 * Diberi `penawaranId` kalau petanya dibuka dari satu barang: yang dihitung
 * hanya pesanan yang memuat penawaran itu. Pesanan yang sudah tidak punya
 * warna (mis. titik biru yang lewat 12 jam) tidak ikut, termasuk tidak ikut
 * dihitung pada angka di atas titik.
 */
export function useTitikPeta(penawaranId?: string): TitikPeta[] {
  const pesananMasuk = usePesananMasuk()
  return useMemo(() => {
    const perUmkm = new Map<string, TitikPeta>()
    for (const p of pesananMasuk) {
      if (penawaranId && !p.baris.some((b) => b.penawaranId === penawaranId)) continue
      const warna = warnaTitikUntuk(p)
      if (!warna) continue
      const titik = perUmkm.get(p.umkmId)
      if (!titik) {
        // `perWarna` dihitung terpisah dari `warna`: satu UMKM bisa punya
        // pesanan di beberapa kondisi sekaligus, dan kartu hitungan harus
        // menghitung tiap pesanan pada warnanya sendiri. Tanpa ini seluruh
        // pesanan satu UMKM tertumpuk di warna yang paling mendesak dan
        // angkanya bertabrakan dengan lonceng serta Rekap.
        const perWarna: Record<WarnaTitik, number> = { merah: 0, oren: 0, biru: 0 }
        perWarna[warna] = 1
        perUmkm.set(p.umkmId, { umkmId: p.umkmId, warna, jumlahPesanan: 1, perWarna, pesananIds: [p.id] })
        continue
      }
      if (URUT_WARNA_TITIK[warna] < URUT_WARNA_TITIK[titik.warna]) titik.warna = warna
      titik.perWarna[warna] += 1
      titik.jumlahPesanan += 1
      titik.pesananIds.push(p.id)
    }
    return Array.from(perUmkm.values())
  }, [pesananMasuk, penawaranId])
}
