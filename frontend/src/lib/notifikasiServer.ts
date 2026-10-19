import type { Barang, Kontrak, Notifikasi, Pesanan } from '@/lib/types'
import { distributorById, statusStok } from '@/data/dummy'
import { hariLagi } from '@/lib/format'
import { PESANAN_BERJALAN } from '@/lib/label'
import { jumlahTampil } from '@/lib/satuan'

/**
 * Pemberitahuan untuk mode data server, diturunkan dari data yang sudah dimuat:
 * stok habis dan menipis, kiriman yang sudah sampai, dan kontrak yang akan
 * berakhir. Server belum punya tabel pemberitahuan; tanpa ini lonceng dan
 * halaman Pemberitahuan kosong padahal Beranda menampilkan tugas yang sama.
 *
 * Id-nya tetap per hal yang diberitahukan (`srv-stok-12`), jadi status dibaca
 * dan waktunya dipertahankan dari daftar sebelumnya setiap kali data dimuat ulang.
 */
export function notifikasiDariServer(
  isi: { barang: Barang[]; pesanan: Pesanan[]; kontrak: Kontrak[] },
  sebelumnya: Notifikasi[],
): Notifikasi[] {
  const lama = new Map(sebelumnya.filter((n) => n.id.startsWith('srv-')).map((n) => [n.id, n]))
  const sekarang = new Date().toISOString()
  const hasil: Notifikasi[] = []

  function tambah(n: Omit<Notifikasi, 'waktu' | 'dibaca' | 'dibisukanSampai'>) {
    const l = lama.get(n.id)
    hasil.push({ ...n, waktu: l?.waktu ?? sekarang, dibaca: l?.dibaca ?? false, dibisukanSampai: null })
  }

  // Jumlah yang sedang dikirim per barang, dari pesanan yang masih berjalan.
  const dikirim = new Map<string, number>()
  for (const p of isi.pesanan) {
    if (!PESANAN_BERJALAN.includes(p.status) || p.status === 'draf') continue
    for (const b of p.baris) {
      if (b.barangId) dikirim.set(b.barangId, (dikirim.get(b.barangId) ?? 0) + b.jumlah * b.isiPerSatuan)
    }
  }

  for (const b of isi.barang) {
    if (b.dicatatManual) continue
    const status = statusStok(b)
    if (status !== 'habis' && status !== 'menipis') continue
    const jalan = dikirim.get(b.id) ?? 0
    const habis = status === 'habis'
    tambah({
      id: `srv-stok-${b.id}`,
      kategori: 'stok',
      tingkat: habis ? 'genting' : 'penting',
      judul: habis ? `${b.nama} sudah habis` : `${b.nama} menipis`,
      detail:
        jalan > 0
          ? `${jumlahTampil(b, jalan)} sedang dalam perjalanan.`
          : habis
            ? `Biasanya terpakai ${jumlahTampil(b, b.pemakaianHarian)} per hari.`
            : `Tinggal ${jumlahTampil(b, b.stok)}, di bawah batas aman ${jumlahTampil(b, b.batasAman)}.`,
      // Sudah dipesan berarti tidak perlu tindakan lagi: tetap tampil, tapi
      // tidak dihitung di lonceng.
      butuhTindakan: jalan <= 0,
      tautan: jalan > 0 ? `/stok/${b.id}` : `/stok/${b.id}?pesan=1`,
      aksiLabel: jalan > 0 ? 'Lihat Stok' : 'Pesan Sekarang',
      barangId: b.id,
    })
  }

  // Syarat "sudah sampai" sama dengan Beranda dan kartu pesanan.
  for (const p of isi.pesanan) {
    const sampai =
      p.status === 'dikirim' &&
      (p.pengiriman != null || (p.perkiraanTiba != null && +new Date(p.perkiraanTiba) <= Date.now()))
    if (!sampai) continue
    tambah({
      id: `srv-sampai-${p.id}`,
      kategori: 'pesanan',
      tingkat: 'penting',
      judul: `Kiriman dari ${distributorById(p.distributorId)?.nama ?? 'distributor'} sudah sampai`,
      detail: `${p.nomor} menunggu kamu periksa. Stok bertambah setelah kamu konfirmasi.`,
      butuhTindakan: true,
      tautan: `/pesanan/${p.id}/terima`,
      aksiLabel: 'Terima Barang',
      barangId: null,
    })
  }

  for (const k of isi.kontrak) {
    if (k.status !== 'akan-berakhir') continue
    const hari = Math.ceil((+new Date(k.berakhir) - Date.now()) / 86_400_000)
    tambah({
      id: `srv-kontrak-${k.id}`,
      kategori: 'kontrak',
      tingkat: 'biasa',
      judul: `Kontrak ${k.namaBarang} berakhir ${hariLagi(hari)}`,
      detail: 'Perpanjangan bisa diatur sebelum masa kontrak habis.',
      butuhTindakan: false,
      tautan: `/kontrak/${k.id}`,
      aksiLabel: 'Lihat Kontrak',
      barangId: null,
    })
  }

  return hasil
}
