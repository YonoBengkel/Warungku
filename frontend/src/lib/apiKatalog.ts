import type { Distributor, JenisUsaha, Penawaran, Ulasan } from '@/lib/types'
import { angka, minta } from '@/lib/api'
import type { SesiServer } from '@/lib/api'
import { keIdDistributor } from '@/lib/apiPesanan'

/**
 * Katalog dari API: distributor (dengan rating dari ulasan sungguhan),
 * penawarannya, dan ulasan per distributor. Diterjemahkan ke tipe yang sudah
 * dipakai halaman Belanja, Profil Distributor, dan Keranjang.
 */

interface DistributorApi {
  id: number
  nama: string
  kota: string
  deskripsi: string | null
  warna: string
  kategori: string[]
  area_kirim: string[]
  terverifikasi: boolean
  baru: boolean
  sejak: string
  alamat_gudang: string | null
  nomor_hp: string | null
  jam_operasional: string | null
  minimum_pesanan: number
  rating: number | null
  jumlah_ulasan: number
  jumlah_umkm_pengulas: number
  jumlah_pesanan_selesai: number
  aspek_ketepatan: number | null
  aspek_jumlah: number | null
  aspek_kondisi: number | null
}

interface PenawaranApi {
  id: number
  distributor_id: number
  nama: string
  kategori: string
  satuan: string
  harga_satuan: number
  kemasan_nama: string
  kemasan_isi: string
  satuan_isi: string
  stok_tersedia: string
  stok_diperbarui_pada: string
  keterangan: string | null
  aktif: boolean
  barang_id_terkait: number | null
}

export interface UsahaServer {
  id: number
  nama: string
  jenisUsaha: JenisUsaha
  kota: string
  alamat: string
}

const bulanTahun = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(iso))

function keDistributor(d: DistributorApi): Distributor {
  return {
    id: keIdDistributor(d.id),
    nama: d.nama,
    kota: d.kota,
    deskripsi: d.deskripsi ?? '',
    warna: d.warna,
    // Tanpa ulasan tidak ada rating: layar menulis "baru", bukan "0,0 bintang".
    rating: d.jumlah_ulasan > 0 ? d.rating : null,
    jumlahUlasan: d.jumlah_ulasan,
    jumlahUmkmPengulas: d.jumlah_umkm_pengulas,
    jumlahPesananSelesai: d.jumlah_pesanan_selesai,
    terverifikasi: d.terverifikasi,
    sejak: bulanTahun(d.sejak),
    subRating: {
      ketepatanWaktu: d.aspek_ketepatan ?? 0,
      jumlahSesuai: d.aspek_jumlah ?? 0,
      kondisiBarang: d.aspek_kondisi ?? 0,
    },
    kategori: d.kategori,
    areaKirim: d.area_kirim,
    // Kolom `baru` di basis data simulasi bertentangan dengan ulasannya (distributor
    // ber-ratusan ulasan bertanda baru), sedangkan layar menulis "belum ada ulasan"
    // untuk distributor baru. Yang dipakai karena itu faktanya: belum punya ulasan.
    baru: d.jumlah_ulasan === 0,
    info: {
      alamatGudang: d.alamat_gudang ?? '',
      nomorHp: d.nomor_hp ?? '',
      jamOperasional: d.jam_operasional ?? '',
      minimumPesanan: d.minimum_pesanan,
    },
  }
}

function kePenawaran(p: PenawaranApi): Penawaran {
  return {
    id: String(p.id),
    distributorId: keIdDistributor(p.distributor_id),
    nama: p.nama,
    kategori: p.kategori,
    satuan: p.satuan,
    hargaSatuan: p.harga_satuan,
    kemasanJual: { nama: p.kemasan_nama, isi: angka(p.kemasan_isi) },
    stokTersedia: angka(p.stok_tersedia),
    stokDiperbaruiPada: p.stok_diperbarui_pada,
    barangIdTerkait: p.barang_id_terkait == null ? null : String(p.barang_id_terkait),
    keterangan: p.keterangan ?? '',
    aktif: p.aktif,
    satuanIsi: p.satuan_isi,
  }
}

export async function ambilKatalog(
  sesi: SesiServer,
): Promise<{ usaha: UsahaServer; distributor: Distributor[]; penawaran: Penawaran[] }> {
  const k = await minta<{
    usaha: { id: number; nama: string; jenis_usaha: string; kota: string; alamat: string }
    distributor: DistributorApi[]
    penawaran: PenawaranApi[]
  }>(`/usaha/${sesi.usahaId}/katalog`, { token: sesi.token })
  return {
    usaha: {
      id: k.usaha.id,
      nama: k.usaha.nama,
      jenisUsaha: k.usaha.jenis_usaha as JenisUsaha,
      kota: k.usaha.kota,
      alamat: k.usaha.alamat,
    },
    distributor: k.distributor.map(keDistributor),
    penawaran: k.penawaran.map(kePenawaran),
  }
}

export async function ambilUlasan(sesi: SesiServer, distributorId: string, batas = 60): Promise<Ulasan[]> {
  const id = Number(distributorId.replace(/^d-0*/, ''))
  const isi = await minta<
    Array<{
      id: number
      distributor_id: number
      nama_usaha: string
      kota_usaha: string
      rating: number
      isi: string | null
      waktu: string
      nomor_pesanan: string
      aspek_ketepatan_waktu: number
      aspek_jumlah_sesuai: number
      aspek_kondisi_barang: number
      jumlah_pesanan_penulis: number
      pelanggan_sejak: string | null
    }>
  >(`/usaha/${sesi.usahaId}/distributor/${id}/ulasan?batas=${batas}`, { token: sesi.token })
  return isi.map((u) => ({
    id: `srv-ul-${u.id}`,
    distributorId: keIdDistributor(u.distributor_id),
    namaUsaha: u.nama_usaha,
    kotaUsaha: u.kota_usaha,
    rating: u.rating,
    isi: u.isi ?? '',
    waktu: u.waktu,
    pesananId: u.nomor_pesanan,
    labelSistem:
      `Terverifikasi · ${u.jumlah_pesanan_penulis} pesanan` +
      (u.pelanggan_sejak ? ` · pelanggan sejak ${bulanTahun(u.pelanggan_sejak)}` : ''),
    aspek: {
      ketepatanWaktu: u.aspek_ketepatan_waktu,
      jumlahSesuai: u.aspek_jumlah_sesuai,
      kondisiBarang: u.aspek_kondisi_barang,
    },
  }))
}
