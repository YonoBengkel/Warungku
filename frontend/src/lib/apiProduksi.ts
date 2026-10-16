import { angka, minta } from '@/lib/api'
import type { SesiServer } from '@/lib/api'

/**
 * Produksi dan penjualan antarusaha untuk UMKM produsen (`backend/api/produksi.py`).
 *
 * Hanya ada di mode data server: data contoh tidak punya usaha produsen.
 * Jumlah dalam satuan dasar bahan (gram, ml, pcs) dan satuan jual produk (toples).
 */

export interface BahanResep {
  barangId: string
  nama: string
  satuan: string
  /** Takaran untuk satu satuan produk jadi. */
  takaran: number
  stok: number
  cukupUntuk: number
}

export interface ProdukJadi {
  id: number
  nama: string
  satuan: string
  isiBersih: string | null
  stok: number
  batasAman: number
  hargaJual: number
  ukuranSesi: number
  resep: BahanResep[]
  bisaDibuat: number
  terjual28Hari: number
  perkiraan7Hari: number
  saranProduksi: number
}

export interface PembeliUsaha {
  id: number
  nama: string
  jenis: string
  kota: string | null
  ketentuan: string | null
  sejak: string | null
  kiriman28Hari: number
  nilai28Hari: number
  terakhir: string | null
}

export interface RingkasanProduksi {
  tanggalAcuan: string
  produk: ProdukJadi[]
  pembeli: PembeliUsaha[]
  omsetBulanan: Array<{ bulan: string; total: number; kiriman: number }>
}

export interface SesiProduksi {
  id: number
  waktu: string
  produkJadiId: number
  namaProduk: string
  jumlah: number
  oleh: string | null
  catatan: string | null
}

export interface KirimanPembeli {
  id: number
  nomor: string
  waktu: string
  pembeliId: number
  namaPembeli: string
  total: number
  catatan: string | null
  baris: Array<{ produkJadiId: number; nama: string; jumlah: number; hargaSatuan: number }>
}

interface ProdukApi {
  id: number
  nama: string
  satuan: string
  isi_bersih: string | null
  stok: string
  batas_aman: string
  harga_jual: number
  ukuran_sesi: number
  resep: Array<{ barang_id: number; nama: string; satuan: string; takaran: string; stok: string; cukup_untuk: number }>
  bisa_dibuat: number
  terjual_28_hari: string
  perkiraan_7_hari: string
  saran_produksi: number
}

interface KirimanApi {
  id: number
  nomor: string
  waktu: string
  pembeli_id: number
  nama_pembeli: string
  total: number
  catatan: string | null
  baris: Array<{ produk_jadi_id: number; nama: string; jumlah: string; harga_satuan: number }>
}

function keKiriman(k: KirimanApi): KirimanPembeli {
  return {
    id: k.id,
    nomor: k.nomor,
    waktu: k.waktu,
    pembeliId: k.pembeli_id,
    namaPembeli: k.nama_pembeli,
    total: k.total,
    catatan: k.catatan,
    baris: k.baris.map((b) => ({
      produkJadiId: b.produk_jadi_id,
      nama: b.nama,
      jumlah: angka(b.jumlah),
      hargaSatuan: b.harga_satuan,
    })),
  }
}

interface SesiApi {
  id: number
  waktu: string
  produk_jadi_id: number
  nama_produk: string
  jumlah: string
  oleh: string | null
  catatan: string | null
}

function keSesi(s: SesiApi): SesiProduksi {
  return {
    id: s.id,
    waktu: s.waktu,
    produkJadiId: s.produk_jadi_id,
    namaProduk: s.nama_produk,
    jumlah: angka(s.jumlah),
    oleh: s.oleh,
    catatan: s.catatan,
  }
}

export async function ambilRingkasanProduksi(sesi: SesiServer): Promise<RingkasanProduksi> {
  const isi = await minta<{
    tanggal_acuan: string
    produk: ProdukApi[]
    pembeli: Array<{
      id: number
      nama: string
      jenis: string
      kota: string | null
      ketentuan: string | null
      sejak: string | null
      kiriman_28_hari: number
      nilai_28_hari: number
      terakhir: string | null
    }>
    omset_bulanan: Array<{ bulan: string; total: number; kiriman: number }>
  }>(`/usaha/${sesi.usahaId}/produksi/ringkasan`, { token: sesi.token })
  return {
    tanggalAcuan: isi.tanggal_acuan,
    produk: isi.produk.map((p) => ({
      id: p.id,
      nama: p.nama,
      satuan: p.satuan,
      isiBersih: p.isi_bersih,
      stok: angka(p.stok),
      batasAman: angka(p.batas_aman),
      hargaJual: p.harga_jual,
      ukuranSesi: p.ukuran_sesi,
      resep: p.resep.map((b) => ({
        barangId: String(b.barang_id),
        nama: b.nama,
        satuan: b.satuan,
        takaran: angka(b.takaran),
        stok: angka(b.stok),
        cukupUntuk: b.cukup_untuk,
      })),
      bisaDibuat: p.bisa_dibuat,
      terjual28Hari: angka(p.terjual_28_hari),
      perkiraan7Hari: angka(p.perkiraan_7_hari),
      saranProduksi: p.saran_produksi,
    })),
    pembeli: isi.pembeli.map((b) => ({
      id: b.id,
      nama: b.nama,
      jenis: b.jenis,
      kota: b.kota,
      ketentuan: b.ketentuan,
      sejak: b.sejak,
      kiriman28Hari: b.kiriman_28_hari,
      nilai28Hari: b.nilai_28_hari,
      terakhir: b.terakhir,
    })),
    omsetBulanan: isi.omset_bulanan,
  }
}

export async function ambilRiwayatProduksi(sesi: SesiServer, hari = 21): Promise<SesiProduksi[]> {
  const isi = await minta<SesiApi[]>(`/usaha/${sesi.usahaId}/produksi?hari=${hari}`, { token: sesi.token })
  return isi.map(keSesi)
}

export async function catatProduksi(
  sesi: SesiServer,
  produkJadiId: number,
  jumlah: number,
  catatan?: string,
): Promise<SesiProduksi> {
  const isi = await minta<SesiApi>(`/usaha/${sesi.usahaId}/produksi`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({ produk_jadi_id: produkJadiId, jumlah: String(jumlah), catatan: catatan || null }),
  })
  return keSesi(isi)
}

export async function ambilKiriman(sesi: SesiServer, hari = 21): Promise<KirimanPembeli[]> {
  const isi = await minta<KirimanApi[]>(`/usaha/${sesi.usahaId}/penjualan?hari=${hari}`, { token: sesi.token })
  return isi.map(keKiriman)
}

export async function catatKiriman(
  sesi: SesiServer,
  pembeliId: number,
  baris: Array<{ produkJadiId: number; jumlah: number }>,
  catatan?: string,
): Promise<KirimanPembeli> {
  const isi = await minta<KirimanApi>(`/usaha/${sesi.usahaId}/penjualan`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({
      pembeli_id: pembeliId,
      baris: baris.map((b) => ({ produk_jadi_id: b.produkJadiId, jumlah: String(b.jumlah) })),
      catatan: catatan || null,
    }),
  })
  return keKiriman(isi)
}
