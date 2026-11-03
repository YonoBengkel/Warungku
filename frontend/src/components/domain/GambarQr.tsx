import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/**
 * Gambar QR sebagai SVG dari sebuah tautan, untuk QR simulasi Portal POS (revisi V8, Q178).
 *
 * Warnanya sengaja hitam di atas putih, di tema terang maupun gelap: pemindai di HP
 * paling andal membaca kontras itu, jadi di sini tidak memakai token warna. Tepi putih
 * empat modul adalah zona sepi yang diwajibkan standar QR.
 */
export function GambarQr({ isi, ukuran = 224, label }: { isi: string; ukuran?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(isi)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    }
    return { n, d }
  }, [isi])

  return (
    <svg
      viewBox={`-4 -4 ${n + 8} ${n + 8}`}
      width={ukuran}
      height={ukuran}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="block rounded-md"
    >
      <rect x={-4} y={-4} width={n + 8} height={n + 8} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  )
}
