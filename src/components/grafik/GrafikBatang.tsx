import { useMemo, useState } from 'react'
import { angka } from '@/lib/format'
import { useLebarWadah, batasRapi } from './dasarGrafik'

/**
 * Batang vertikal untuk perbandingan magnitudo antar hari / antar barang.
 *
 * Spesifikasi tanda yang dipegang:
 * - Batang maksimal 24px, sisa slot dibiarkan jadi ruang kosong.
 * - Ujung data membulat 4px, pangkal tetap siku di garis dasar.
 * - Jarak 2px berwarna permukaan memisahkan batang yang bersentuhan.
 * - Label nilai hanya di batang tertinggi, tidak di semua batang.
 */

const SISI = { atas: 18, kanan: 8, bawah: 24, kiri: 34 }

export interface BatangData {
  label: string
  nilai: number
  /** Batang yang ingin ditonjolkan, mis. hari ini atau barang terpilih. */
  sorot?: boolean
}

export function GrafikBatang({
  data,
  satuan,
  tinggi = 160,
  warna = 'var(--c-seri-1)',
}: {
  data: BatangData[]
  satuan: string
  tinggi?: number
  warna?: string
}) {
  const [wadahRef, lebar] = useLebarWadah<HTMLDivElement>()
  const [sorot, setSorot] = useState<number | null>(null)

  const g = useMemo(() => {
    const w = Math.max(lebar, 240)
    const pw = w - SISI.kiri - SISI.kanan
    const ph = tinggi - SISI.atas - SISI.bawah
    const maks = batasRapi(Math.max(1, ...data.map((d) => d.nilai)) * 1.12)
    const slot = pw / Math.max(1, data.length)
    // Jarak 2px di kedua sisi menjadi pemisah antar batang yang bersentuhan.
    const tebal = Math.min(24, Math.max(6, slot - 8))
    return { w, ph, maks, slot, tebal, pw }
  }, [data, lebar, tinggi])

  const indeksTertinggi = data.reduce((a, d, i) => (d.nilai > data[a].nilai ? i : a), 0)

  return (
    <div ref={wadahRef} className="relative select-none">
      <svg
        width={g.w}
        height={tinggi}
        role="img"
        aria-label={`Grafik batang ${data.length} periode dalam ${satuan}. Nilai tertinggi ${angka(data[indeksTertinggi]?.nilai ?? 0)} ${satuan} pada ${data[indeksTertinggi]?.label ?? '-'}.`}
        onPointerLeave={() => setSorot(null)}
      >
        <line
          x1={SISI.kiri}
          x2={g.w - SISI.kanan}
          y1={SISI.atas + g.ph}
          y2={SISI.atas + g.ph}
          stroke="var(--c-grid)"
          strokeWidth="1"
        />
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={SISI.kiri}
            x2={g.w - SISI.kanan}
            y1={SISI.atas + g.ph - g.ph * f}
            y2={SISI.atas + g.ph - g.ph * f}
            stroke="var(--c-grid)"
            strokeWidth="1"
          />
        ))}
        {[0.5, 1].map((f) => (
          <text
            key={f}
            x={SISI.kiri - 7}
            y={SISI.atas + g.ph - g.ph * f + 4}
            textAnchor="end"
            fontSize="10.5"
            fill="var(--c-sumbu)"
            className="tabular"
          >
            {angka(g.maks * f)}
          </text>
        ))}

        {data.map((d, i) => {
          const t = (d.nilai / g.maks) * g.ph
          const x = SISI.kiri + g.slot * i + (g.slot - g.tebal) / 2
          const y = SISI.atas + g.ph - t
          const aktif = sorot === i
          const r = Math.min(4, t / 2)
          return (
            <g key={d.label + i} onPointerEnter={() => setSorot(i)}>
              {/* Sasaran sentuh lebih lebar daripada batangnya */}
              <rect
                x={SISI.kiri + g.slot * i}
                y={SISI.atas}
                width={g.slot}
                height={g.ph}
                fill="transparent"
              />
              <path
                d={`M${x},${SISI.atas + g.ph} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + g.tebal - r},${y} Q${x + g.tebal},${y} ${x + g.tebal},${y + r} L${x + g.tebal},${SISI.atas + g.ph} Z`}
                fill={warna}
                opacity={d.sorot || aktif ? 1 : sorot != null ? 0.45 : 0.82}
                style={{ transition: 'opacity .15s' }}
              />
              {(i === indeksTertinggi || aktif) && (
                <text
                  x={x + g.tebal / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  fill="var(--c-ink-2)"
                  className="tabular"
                >
                  {angka(d.nilai)}
                </text>
              )}
              <text
                x={x + g.tebal / 2}
                y={tinggi - 7}
                textAnchor="middle"
                fontSize="10.5"
                fill={d.sorot || aktif ? 'var(--c-ink)' : 'var(--c-sumbu)'}
                fontWeight={d.sorot ? 700 : 400}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * Garis mungil 12 titik untuk kartu ringkasan. Tanpa sumbu, tanpa label:
 * tugasnya hanya menunjukkan arah, bukan nilai.
 */
export function Percikan({
  data,
  lebar = 72,
  tinggi = 26,
  warna = 'var(--c-seri-1)',
  label,
}: {
  data: number[]
  lebar?: number
  tinggi?: number
  warna?: string
  label: string
}) {
  if (data.length < 2) return null
  const maks = Math.max(...data)
  const min = Math.min(...data)
  const rentang = maks - min || 1
  const titik = data.map((v, i) => {
    const x = (lebar * i) / (data.length - 1)
    const y = tinggi - 3 - ((v - min) / rentang) * (tinggi - 6)
    return `${x},${y}`
  })
  const akhir = titik[titik.length - 1].split(',').map(Number)

  return (
    <svg width={lebar} height={tinggi} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <polyline
        points={titik.join(' ')}
        fill="none"
        stroke={warna}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <circle cx={akhir[0]} cy={akhir[1]} r="3.2" fill={warna} stroke="var(--c-surface)" strokeWidth="2" />
    </svg>
  )
}
