import { useEffect, useState } from 'react'
import type { Barang, Perkiraan, TitikTren } from '@/lib/types'
import { perkiraanUntuk, trenBarang } from '@/data/dummy'
import { ambilPerkiraan, ambilRiwayat, ambilSaran } from '@/lib/api'
import type { HariPerkiraan, HariRiwayat, SaranServer } from '@/lib/api'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Keluaran mesin analitik untuk satu barang, dari mana pun asalnya.
 *
 * Mode `contoh`: hitungan dari data contoh di memori, seperti sebelumnya.
 * Mode `server`: perkiraan Mesin 1 (LightGBM), riwayat pemakaian, dan saran
 * Mesin 2 dibaca dari API. Bentuk keluarannya sama di kedua mode, jadi
 * layar tidak perlu bercabang.
 */
export interface DataMesin {
  status: 'contoh' | 'memuat' | 'siap' | 'gagal'
  perkiraan: Perkiraan
  tren: TitikTren[]
  saran: SaranServer[]
  /** Nama model yang menghasilkan perkiraan, mis. "LightGBM". Kosong di mode contoh. */
  model: string | null
}

const HARI_RIWAYAT = 14
const HARI_DEPAN = 7

export function useDataMesin(barang: Barang | undefined): DataMesin {
  const sesi = useAplikasi((s) => s.sesiServer)
  const id = barang?.id ?? ''
  const [hasil, setHasil] = useState<{
    id: string
    perkiraan: HariPerkiraan[]
    riwayat: HariRiwayat[]
    saran: SaranServer[]
  } | null>(null)
  const [gagal, setGagal] = useState<string | null>(null)

  useEffect(() => {
    if (!sesi || !id) return
    let batal = false
    setGagal(null)
    Promise.all([ambilPerkiraan(sesi, id), ambilRiwayat(sesi, id, HARI_RIWAYAT), ambilSaran(sesi, id)])
      .then(([perkiraan, riwayat, saran]) => {
        if (!batal) setHasil({ id, perkiraan, riwayat, saran })
      })
      .catch(() => {
        if (!batal) setGagal(id)
      })
    return () => {
      batal = true
    }
  }, [sesi, id])

  if (!barang) return { status: 'contoh', perkiraan: kosong(''), tren: [], saran: [], model: null }
  if (!sesi) {
    return { status: 'contoh', perkiraan: perkiraanUntuk(barang), tren: trenBarang(barang.id), saran: [], model: null }
  }
  if (gagal === id) {
    // Server tidak menjawab: hitungan sederhana dari pemakaian rata-rata, ditandai apa adanya.
    return {
      status: 'gagal',
      perkiraan: { ...perkiraanUntuk(barang), tingkatLayanan: 'hitungan-sederhana', dibuatPada: null },
      tren: [],
      saran: [],
      model: null,
    }
  }
  if (!hasil || hasil.id !== id) {
    return { status: 'memuat', perkiraan: kosong(barang.id), tren: [], saran: [], model: null }
  }
  // Baris uji balik hanya untuk grafik; hitungan stok memakai perkiraan ke depan saja.
  const depan = hasil.perkiraan.filter((h) => !h.ujiBalik)
  return {
    status: 'siap',
    perkiraan: perkiraanDariServer(barang, depan),
    tren: trenDariServer(hasil.riwayat, hasil.perkiraan),
    saran: hasil.saran,
    model: depan[0] ? namaModel(depan[0].model) : null,
  }
}

function kosong(barangId: string): Perkiraan {
  return {
    barangId,
    kematangan: 'belum-bisa',
    tingkatLayanan: 'segar',
    dibuatPada: null,
    hariCukup: null,
    pakaiTigaHariMin: null,
    pakaiTigaHariMaks: null,
    saranBeli: 0,
    satuanSaran: '',
    alasan: [],
  }
}

/** "sarima-1-0-1-0-1-1-7" → "SARIMA(1,0,1)(0,1,1)7"; nama lain ditulis kapital. */
export function namaModel(kode: string): string {
  const m = /^sarima-(\d)-(\d)-(\d)-(\d)-(\d)-(\d)-(\d+)$/.exec(kode)
  if (m) return `SARIMA(${m[1]},${m[2]},${m[3]})(${m[4]},${m[5]},${m[6]})${m[7]}`
  if (kode.startsWith('lightgbm')) return 'LightGBM'
  if (kode.startsWith('ets') || kode.startsWith('holt')) return 'ETS (Holt-Winters)'
  return kode.split('-')[0].toUpperCase()
}

/**
 * Perkiraan di layar dari kuantil Mesin 1 (hanya hari sesudah data terakhir).
 *
 * - Hari cukup: berapa hari sisa stok bertahan bila pemakaian mengikuti p50.
 * - Pakai 3 hari: jumlah p10 sampai jumlah p90 tiga hari pertama.
 * - Saran beli: kekurangan untuk 14 hari pemakaian p50, dalam kemasan terbesar.
 */
function perkiraanDariServer(b: Barang, hari: HariPerkiraan[]): Perkiraan {
  if (hari.length === 0 || b.dicatatManual) return kosong(b.id)
  let sisa = Math.max(0, b.stok)
  let cukup = hari.length
  for (let i = 0; i < hari.length; i++) {
    sisa -= hari[i].p50
    if (sisa < 0) {
      cukup = i
      break
    }
  }
  const tiga = hari.slice(0, 3)
  const butuh14 = hari.slice(0, 14).reduce((a, h) => a + h.p50, 0)
  const kemasan = b.kemasan[b.kemasan.length - 1]
  const isi = kemasan?.isi ?? 1
  const kurang = Math.max(0, butuh14 - b.stok)
  return {
    barangId: b.id,
    kematangan: hari[0].kematangan,
    tingkatLayanan: hari[0].tingkatLayanan,
    dibuatPada: hari[0].dijalankanPada,
    hariCukup: cukup,
    pakaiTigaHariMin: Math.round(tiga.reduce((a, h) => a + h.p10, 0)),
    pakaiTigaHariMaks: Math.round(tiga.reduce((a, h) => a + h.p90, 0)),
    saranBeli: kurang > 0 ? Math.max(1, Math.ceil(kurang / isi)) : 0,
    satuanSaran: kemasan?.nama ?? b.satuan,
    alasan: [],
  }
}

/**
 * 14 hari pemakaian tercatat, lalu 7 hari p50 dengan pita p10–p90.
 *
 * Di 14 hari tercatat itu ikut digambar perkiraan uji balik (dibuat dari titik
 * 14 hari sebelum data terakhir), jadi garis aktual dan garis perkiraan
 * tumpang tindih, tanpa pita. Sesudah data terakhir hanya garis perkiraan
 * beserta pita p10-p90 yang tersisa.
 * Hari tersensor (stok habis) tidak digambar di garis aktual.
 */
function trenDariServer(riwayat: HariRiwayat[], perkiraan: HariPerkiraan[]): TitikTren[] {
  const balik = new Map(perkiraan.filter((h) => h.ujiBalik).map((h) => [h.tanggal, h]))
  const titik: TitikTren[] = riwayat.map((h) => {
    const b = balik.get(h.tanggal)
    return {
      tanggal: h.tanggal,
      aktual: h.stokHabis ? null : Math.round(h.jumlah),
      prediksi: b ? Math.round(b.p50) : null,
    }
  })
  const terakhir = riwayat[riwayat.length - 1]?.tanggal ?? ''
  for (const h of perkiraan.filter((x) => !x.ujiBalik && x.tanggal > terakhir).slice(0, HARI_DEPAN)) {
    titik.push({
      tanggal: h.tanggal,
      aktual: null,
      prediksi: Math.round(h.p50),
      batasBawah: Math.round(h.p10),
      batasAtas: Math.round(h.p90),
    })
  }
  return titik
}
