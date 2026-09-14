import { useEffect, useRef, useState } from 'react'

/**
 * Mengukur lebar wadah supaya grafik bisa digambar dalam piksel nyata.
 *
 * Alternatifnya adalah viewBox yang diregangkan, tapi itu ikut meregangkan
 * ketebalan garis dan ukuran teks, sehingga grafik yang sama terlihat berbeda
 * di HP dan di desktop. Menggambar dengan lebar nyata menghindari itu.
 */
export function useLebarWadah<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [lebar, setLebar] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entri) => {
      const w = entri[0]?.contentRect.width ?? 0
      setLebar((sebelum) => (Math.abs(sebelum - w) > 1 ? w : sebelum))
    })
    ro.observe(el)
    setLebar(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  return [ref, lebar] as const
}

/** Membulatkan batas atas sumbu ke angka yang enak dibaca (0 / 50 / 100 / 250). */
export function batasRapi(maks: number): number {
  if (maks <= 0) return 1
  const pangkat = Math.pow(10, Math.floor(Math.log10(maks)))
  const rasio = maks / pangkat
  const pengali = rasio <= 1 ? 1 : rasio <= 2 ? 2 : rasio <= 2.5 ? 2.5 : rasio <= 5 ? 5 : 10
  return pengali * pangkat
}

export function tandaSumbu(maks: number, jumlah = 4): number[] {
  const atas = batasRapi(maks)
  return Array.from({ length: jumlah + 1 }, (_, i) => (atas / jumlah) * i)
}

/** Kurva halus (Catmull-Rom ke Bezier) supaya garis tidak patah-patah kasar. */
export function garisHalus(titik: Array<[number, number]>): string {
  if (titik.length === 0) return ''
  if (titik.length < 3) return titik.map((t, i) => `${i === 0 ? 'M' : 'L'}${t[0]},${t[1]}`).join(' ')

  let d = `M${titik[0][0]},${titik[0][1]}`
  for (let i = 0; i < titik.length - 1; i++) {
    const p0 = titik[Math.max(0, i - 1)]
    const p1 = titik[i]
    const p2 = titik[i + 1]
    const p3 = titik[Math.min(titik.length - 1, i + 2)]
    const ketegangan = 6
    const c1x = p1[0] + (p2[0] - p0[0]) / ketegangan
    const c1y = p1[1] + (p2[1] - p0[1]) / ketegangan
    const c2x = p2[0] - (p3[0] - p1[0]) / ketegangan
    const c2y = p2[1] - (p3[1] - p1[1]) / ketegangan
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}
