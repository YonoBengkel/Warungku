/**
 * Hitungan untuk Lacak Pesanan (revisi 23 Okt 2026): titik gudang, titik
 * cadangan per kota, dan perkiraan posisi kiriman.
 *
 * Posisi kiriman TIDAK berasal dari GPS. Ia ditaruh di garis lurus antara
 * gudang dan tujuan, sejauh bagian waktu yang sudah lewat antara berangkat dan
 * perkiraan tiba. Layar wajib menyebutnya "perkiraan posisi".
 */

export interface Koordinat {
  lat: number
  lng: number
}

/**
 * Titik tengah kota, dipakai bila distributor belum mengisi lokasi gudangnya
 * atau tempat usaha belum punya koordinat. Kunci ditulis huruf kecil tanpa
 * awalan "kota"/"kabupaten"; lihat `pusatKota`.
 */
const PUSAT_KOTA: Record<string, Koordinat> = {
  yogyakarta: { lat: -7.7956, lng: 110.3695 },
  sleman: { lat: -7.7163, lng: 110.3556 },
  bantul: { lat: -7.8881, lng: 110.3289 },
  'kulon progo': { lat: -7.8267, lng: 110.1641 },
  'gunungkidul': { lat: -7.9655, lng: 110.6011 },
  magelang: { lat: -7.4797, lng: 110.2177 },
  klaten: { lat: -7.7058, lng: 110.6061 },
  surakarta: { lat: -7.5755, lng: 110.8243 },
  solo: { lat: -7.5755, lng: 110.8243 },
  semarang: { lat: -6.9667, lng: 110.4167 },
  jakarta: { lat: -6.2088, lng: 106.8456 },
  surabaya: { lat: -7.2575, lng: 112.7521 },
  bandung: { lat: -6.9175, lng: 107.6191 },
}

/** Cadangan terakhir bila kotanya tidak dikenal: Kota Yogyakarta. */
const PUSAT_CADANGAN = PUSAT_KOTA.yogyakarta

/** "Kota Yogyakarta", "Sleman, DI Yogyakarta", "Kab. Bantul" → titik tengahnya. */
export function pusatKota(kota: string | null | undefined): Koordinat {
  const bersih = (kota ?? '')
    .toLowerCase()
    .split(',')[0]
    .replace(/^(kota|kabupaten|kab\.?)\s+/, '')
    .trim()
  return PUSAT_KOTA[bersih] ?? PUSAT_CADANGAN
}

/** Koordinat yang sah (bukan null, bukan NaN, di dalam bola bumi). */
export function koordinatSah(lat: number | null | undefined, lng: number | null | undefined): lat is number {
  return (
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  )
}

/** Titik gudang distributor; `cadangan` true bila memakai titik tengah kota. */
export function titikGudang(d: { kota: string; lat?: number | null; lng?: number | null }): Koordinat & { cadangan: boolean } {
  if (koordinatSah(d.lat, d.lng)) return { lat: d.lat, lng: d.lng as number, cadangan: false }
  return { ...pusatKota(d.kota), cadangan: true }
}

/** Jarak garis lurus dalam kilometer (haversine). */
export function jarakKm(a: Koordinat, b: Koordinat): number {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Waktu berangkat: jejak "dikirim" yang pertama. */
export function waktuBerangkat(jejak: Array<{ waktu: string; status: string }>): string | null {
  return jejak.find((j) => j.status === 'dikirim')?.waktu ?? null
}

/**
 * Perkiraan posisi kiriman di garis gudang → tujuan.
 *
 * Kemajuan dijepit 5–95%: titik yang menempel di gudang atau di tujuan akan
 * terbaca sebagai "belum berangkat" atau "sudah sampai", padahal keduanya
 * belum pasti. Lewat perkiraan tiba, titiknya berhenti di 95%; `lewat` baru
 * true sesudah hari perkiraan tibanya berganti.
 */
export function posisiKiriman(
  dari: Koordinat,
  ke: Koordinat,
  berangkat: string | null,
  tiba: string | null,
  sekarang: number = Date.now(),
): { titik: Koordinat; kemajuan: number; lewat: boolean } {
  let t = 0.5
  let lewat = false
  if (tiba) {
    const b = +new Date(tiba)
    // Sejalan dengan "perkiraan tiba hari ini": baru disebut lewat sesudah harinya berganti.
    lewat = sekarang > b && new Date(sekarang).toDateString() !== new Date(b).toDateString()
    const a = berangkat ? +new Date(berangkat) : NaN
    if (b > a) t = (sekarang - a) / (b - a)
    else if (sekarang > b) t = 1
  }
  const kemajuan = Math.min(0.95, Math.max(0.05, t))
  return {
    titik: { lat: dari.lat + (ke.lat - dari.lat) * kemajuan, lng: dari.lng + (ke.lng - dari.lng) * kemajuan },
    kemajuan,
    lewat,
  }
}
