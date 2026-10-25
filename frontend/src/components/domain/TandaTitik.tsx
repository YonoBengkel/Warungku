import { WARNA_TITIK_TOKEN } from '@/lib/label'
import type { WarnaTitik } from '@/lib/types'

/**
 * Bentuk titik sebaran pemesan, dipakai penanda peta Sebaran, kartu hitungan
 * titik, dan petak Sebaran pemesan di Beranda distributor.
 *
 * Berkas ini sengaja tanpa Leaflet: Beranda cukup menggambar cincinnya, tidak
 * perlu ikut memuat pustaka peta.
 */

/**
 * Bentuk cincin per status, supaya titik tetap bisa dibedakan oleh orang yang
 * tidak membedakan merah dari oren.
 *
 * merah = cincin penuh · oren = cincin putus-putus · biru = cincin ganda tipis
 */
export function Cincin({ warna, r }: { warna: WarnaTitik; r: number }) {
  const goresan = WARNA_TITIK_TOKEN[warna]
  if (warna === 'biru') {
    return (
      <>
        <circle r={r + 3} fill="none" stroke={goresan} strokeWidth={1.3} />
        <circle r={r + 6.5} fill="none" stroke={goresan} strokeWidth={1.3} />
      </>
    )
  }
  return (
    <circle
      r={r + 4}
      fill="none"
      stroke={goresan}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeDasharray={warna === 'oren' ? '6 5' : undefined}
    />
  )
}

/**
 * Satu titik seperti di peta: cincin, bulatan berwarna, dan angka di dalamnya.
 * Tanpa `jumlah` ia jadi tanda legenda saja, untuk dipasang di samping angka
 * yang ditulis besar.
 */
export function TandaTitik({ warna, jumlah, ukuran = 48 }: { warna: WarnaTitik; jumlah?: number; ukuran?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={ukuran} height={ukuran} aria-hidden="true" className="shrink-0">
      <g transform="translate(28 28)">
        <Cincin warna={warna} r={17} />
        <circle r={17} fill={WARNA_TITIK_TOKEN[warna]} stroke="var(--c-surface)" strokeWidth={1.5} />
        {jumlah != null && (
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={18}
            fontWeight={800}
            fill="var(--c-ink-inverse)"
          >
            {jumlah}
          </text>
        )}
      </g>
    </svg>
  )
}
