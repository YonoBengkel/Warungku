import { useMemo } from 'react'
import { create } from 'zustand'
import type {
  AlasanKoreksi,
  AlasanSelisih,
  Barang,
  BarisKeranjang,
  BuktiPengiriman,
  DataKasir,
  Kontrak,
  Notifikasi,
  Pergerakan,
  Pesanan,
  PesananMasuk,
  ProfilUsaha,
  StatusPesanan,
  StatusPesananMasuk,
  SubKeranjang,
  TitikPeta,
  Transaksi,
  WarnaTitik,
} from '@/lib/types'
import { PESANAN_BERJALAN } from '@/lib/label'
import { waktuNanti } from '@/lib/format'
import {
  POS_TUNGGAL,
  daftarBarang,
  daftarKontrak,
  daftarNotifikasi,
  daftarPergerakan,
  daftarPesanan,
  daftarPesananMasuk,
  daftarTransaksi,
  dataKasirAwal,
  paketById,
  penawaranById,
  profilAwal,
  rincianHarga,
  statusStok,
  umkmById,
  warnaTitikUntuk,
} from '@/data/dummy'

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
  /** Pesanan yang masuk ke distributor aktif. Isi portal distributor. */
  pesananMasuk: PesananMasuk[]
  tema: 'terang' | 'gelap'
  /** Mensimulasikan layanan perkiraan yang sedang tidak sehat, untuk menguji turun derajat. */
  layananPerkiraan: 'sehat' | 'tersimpan' | 'mati'
  masuk: boolean
  racun: Racun[]
  hasilKirimTerakhir: HasilKirim | null

  /* Tampilan & sesi */
  aturTema: (t: 'terang' | 'gelap') => void
  aturLayananPerkiraan: (v: 'sehat' | 'tersimpan' | 'mati') => void
  aturMasuk: (v: boolean) => void
  aturPeran: (p: 'umkm' | 'distributor') => void

  /* Profil & kasir */
  ubahProfil: (p: Partial<ProfilUsaha>) => void
  ubahKasir: (p: Partial<DataKasir>) => void
  hubungkanKasir: () => void
  pasangkanMenu: (menuId: string, barangId: string) => void
  catatPemakaianHarian: (pemakaian: Record<string, number>) => void

  /* Stok */
  koreksiStok: (barangId: string, selisih: number, alasan: AlasanKoreksi, catatan: string) => void
  aturBatasAman: (barangId: string, batas: number, sumber: 'sistem' | 'sendiri') => void
  aturBatasAmanMassal: (barangIds: string[]) => void
  tambahBarang: (b: Barang) => void
  ubahBarang: (barangId: string, p: Partial<Barang>) => void
  terapkanHitungFisik: (hasil: Record<string, number>) => void

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
  tandaiSudahDiulas: (pesananId: string) => void

  /* Pesanan masuk (portal distributor) */
  terimaPesananMasuk: (id: string) => void
  tolakPesananMasuk: (id: string, alasan: string) => void
  majukanPesananMasuk: (id: string) => void

  /* Kontrak */
  ajukanKontrak: (paketId: string) => string
  ubahPesananRutin: (kontrakId: string, aktif: boolean) => void

  /* Pemberitahuan */
  bacaNotifikasi: (id: string) => void
  bacaSemuaNotifikasi: () => void
  selesaikanNotifikasi: (id: string) => void
  tundaNotifikasi: (id: string, hari: number) => void

  /* Umpan balik */
  tampilkanRacun: (pesan: string, nada?: Racun['nada']) => void
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

function nomorPesananBaru(): string {
  const d = new Date()
  const t = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  urutPesanan += 1
  return `PS-${t}-${String(urutPesanan).padStart(2, '0')}`
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
  keranjang: [],
  peran: 'umkm',
  pesananMasuk: daftarPesananMasuk,
  tema: temaAwal(),
  layananPerkiraan: 'sehat',
  // Dimulai dari keadaan belum masuk supaya "/" benar-benar memperlihatkan
  // landing page. Rute lain tidak dijaga: ini purwarupa antarmuka, jadi
  // membuka /beranda langsung tetap boleh dan memang dipakai saat memeriksa layar.
  masuk: false,
  racun: [],
  hasilKirimTerakhir: null,

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
  aturMasuk: (v) => set({ masuk: v }),

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
        alasan: null,
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

  koreksiStok: (barangId, selisih, alasan, catatan) => {
    const barang = get().barang.find((b) => b.id === barangId)
    if (!barang || selisih === 0) return
    const stokBaru = Math.max(0, Math.round((barang.stok + selisih) * 100) / 100)
    const jejak: Pergerakan = {
      id: `pg-${Date.now()}`,
      barangId,
      waktu: stempel(),
      jenis: 'koreksi',
      jumlah: selisih,
      stokSesudah: stokBaru,
      alasan,
      keterangan: catatan,
      pesananId: null,
      transaksiId: null,
      oleh: get().profil.namaPemilik,
    }
    set((s) => ({
      barang: s.barang.map((b) => (b.id === barangId ? { ...b, stok: stokBaru } : b)),
      pergerakan: [jejak, ...s.pergerakan],
    }))
    get().tampilkanRacun(`Stok ${barang.nama} jadi ${stokBaru} ${barang.satuan}.`, 'aman')
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

  terapkanHitungFisik: (hasil) => {
    const s = get()
    const catatan: Pergerakan[] = []
    const barangBaru = s.barang.map((b) => {
      if (!(b.id in hasil)) return b
      const nyata = hasil[b.id]
      if (nyata === b.stok) return b
      catatan.push({
        id: `pg-${Date.now()}-${b.id}`,
        barangId: b.id,
        waktu: stempel(),
        jenis: 'hitung-fisik',
        jumlah: nyata - b.stok,
        stokSesudah: nyata,
        alasan: null,
        keterangan: 'Hasil hitung fisik',
        pesananId: null,
        transaksiId: null,
        oleh: s.profil.namaPemilik,
      })
      return { ...b, stok: nyata }
    })
    set({ barang: barangBaru, pergerakan: [...catatan, ...s.pergerakan] })
    get().tampilkanRacun(`Hasil hitung diterapkan pada ${catatan.length} barang.`, 'aman')
  },

  tambahKeKeranjang: (distributorId, penawaranId, jumlah, saranSistem = null, kontrakId = null) => {
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
            const harga = rincianHarga(b.penawaranId, b.kontrakId, s.kontrak)
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
        alasan: null,
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

  tandaiSudahDiulas: (pesananId) =>
    set((s) => ({ pesanan: s.pesanan.map((p) => (p.id !== pesananId ? p : { ...p, sudahDiulas: true })) })),

  terimaPesananMasuk: (id) => {
    const pesanan = get().pesananMasuk.find((p) => p.id === id)
    // Hanya pesanan yang belum dijawab yang boleh diterima. Menekan tombol dua
    // kali tidak boleh memundurkan pesanan yang sudah berjalan.
    if (!pesanan || pesanan.status !== 'menunggu-konfirmasi') return
    set((s) => ({
      pesananMasuk: s.pesananMasuk.map((p) =>
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
    get().tampilkanRacun(`Pesanan ${pesanan.nomor} kamu terima. Sekarang masuk antrean gudang.`, 'aman')
  },

  tolakPesananMasuk: (id, alasan) => {
    // Penolakan tanpa alasan tidak pernah disimpan: pemilik usaha berhak tahu
    // kenapa pesanannya batal, dan alasan kosong membuat jejaknya tidak berguna.
    const alasanBersih = alasan.trim()
    if (!alasanBersih) return
    const pesanan = get().pesananMasuk.find((p) => p.id === id)
    if (!pesanan || pesanan.status !== 'menunggu-konfirmasi') return
    set((s) => ({
      pesananMasuk: s.pesananMasuk.map((p) =>
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
  majukanPesananMasuk: (id) => {
    const pesanan = get().pesananMasuk.find((p) => p.id === id)
    if (!pesanan) return

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
      set((s) => ({
        pesananMasuk: s.pesananMasuk.map((p) =>
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
      get().tampilkanRacun(
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
      diterimaOleh: umkmById(pesanan.umkmId)?.nama ?? 'Pemilik usaha',
      waktuSampai,
      catatan: 'Barang diserahkan langsung di tempat dan dihitung bersama penerima.',
      foto: ['Foto barang saat diturunkan', 'Foto tanda terima yang sudah ditandatangani'],
    }
    set((s) => ({
      pesananMasuk: s.pesananMasuk.map((p) =>
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
    get().tampilkanRacun(`Pesanan ${pesanan.nomor} sudah sampai. Bukti pengirimannya tersimpan.`, 'aman')
  },

  /**
   * Pengajuan belum mengikat sampai distributor menyetujui: selama statusnya
   * masih 'menunggu-persetujuan' inilah satu-satunya jendela pembatalan yang
   * dipunyai pemilik usaha. Karena itu pengajuannya wajib benar-benar
   * tersimpan — layar Periksa Kesepakatan menjanjikan bahwa isinya terekam
   * sebagai bukti dan bisa dibuka lagi di daftar kontrak.
   */
  ajukanKontrak: (paketId) => {
    const id = `k-ajuan-${paketId}`
    const paket = paketById(paketId)
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

  ubahPesananRutin: (kontrakId, aktif) =>
    set((s) => ({
      kontrak: s.kontrak.map((k) => (k.id === kontrakId ? { ...k, pesananRutinAktif: aktif } : k)),
    })),

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

  tampilkanRacun: (pesan, nada = 'aman') => {
    const id = (nomorRacun += 1)
    set((s) => ({ racun: [...s.racun, { id, pesan, nada }] }))
    window.setTimeout(() => get().tutupRacun(id), 4200)
  },

  tutupRacun: (id) => set((s) => ({ racun: s.racun.filter((r) => r.id !== id) })),
}))

/* ------------------------------------------------------------------ */
/* Pembaca turunan                                                     */
/* ------------------------------------------------------------------ */

const URUT_STATUS = { habis: 0, menipis: 1, kebanyakan: 2, aman: 3 } as const

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

/** Angka merah pada lonceng distributor: pesanan yang menunggu dijawab. */
export function useJumlahPerluKonfirmasi(): number {
  return useAplikasi((s) => s.pesananMasuk.filter((p) => p.status === 'menunggu-konfirmasi').length)
}

/**
 * Semua tab pesanan distributor sekaligus.
 *
 * Dikelompokkan di luar selektor: zustand membandingkan hasil selektor dengan
 * Object.is, jadi objek baru dari dalam selektor akan memicu render tanpa henti.
 */
export function usePesananMasukPerStatus(): Record<StatusPesananMasuk, PesananMasuk[]> {
  const pesananMasuk = useAplikasi((s) => s.pesananMasuk)
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
  const pesananMasuk = useAplikasi((s) => s.pesananMasuk)
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
