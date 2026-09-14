import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import type { TitikTren } from '@/lib/types'
import { angka, tanggalRingkas, tanggalLengkapHari } from '@/lib/format'
import { useLebarWadah, batasRapi, tandaSumbu, garisHalus } from './dasarGrafik'

/**
 * Tren pemakaian: yang sudah terjadi dan yang diperkirakan akan terjadi.
 *
 * Keputusan yang dipegang:
 * - Aktual dan prediksi adalah UKURAN YANG SAMA pada rentang waktu berbeda,
 *   jadi keduanya memakai satu warna. Yang membedakan adalah gaya garis
 *   (utuh untuk yang sudah terjadi, putus-putus untuk perkiraan) dan pita
 *   ketidakpastian. Memberi mereka dua warna berbeda akan menyiratkan dua hal
 *   berbeda, dan itu keliru.
 * - Pita ketidakpastian selalu ditampilkan kalau ada. Menyembunyikan rentang
 *   membuat perkiraan terlihat lebih pasti daripada kenyataannya.
 * - Ada tampilan tabel, supaya angka tetap terbaca oleh pembaca layar dan oleh
 *   pengguna yang tidak nyaman membaca grafik.
 */

const SISI = { atas: 14, kanan: 16, bawah: 26, kiri: 38 }

export function GrafikTren({
  data,
  satuan,
  tinggi = 190,
  labelAktual = 'Pemakaian tercatat',
  labelPrediksi = 'Perkiraan',
}: {
  data: TitikTren[]
  satuan: string
  tinggi?: number
  labelAktual?: string
  labelPrediksi?: string
}) {
  const [wadahRef, lebar] = useLebarWadah<HTMLDivElement>()
  const [sorot, setSorot] = useState<number | null>(null)
  const [tampilTabel, setTampilTabel] = useState(false)

  const g = useMemo(() => {
    const w = Math.max(lebar, 260)
    const pw = w - SISI.kiri - SISI.kanan
    const ph = tinggi - SISI.atas - SISI.bawah

    const semuaNilai = data.flatMap((d) => [d.aktual, d.prediksi, d.batasAtas].filter((n): n is number => n != null))
    const maks = batasRapi(Math.max(1, ...semuaNilai) * 1.08)
    const x = (i: number) => SISI.kiri + (data.length <= 1 ? pw / 2 : (pw * i) / (data.length - 1))
    const y = (v: number) => SISI.atas + ph - (v / maks) * ph

    const titikAktual: Array<[number, number]> = []
    const titikPrediksi: Array<[number, number]> = []
    let indeksSambung = -1

    data.forEach((d, i) => {
      if (d.aktual != null) {
        titikAktual.push([x(i), y(d.aktual)])
        indeksSambung = i
      }
      if (d.prediksi != null) titikPrediksi.push([x(i), y(d.prediksi)])
    })

    // Sambungkan garis prediksi ke titik aktual terakhir supaya tidak terputus.
    if (indeksSambung >= 0 && data[indeksSambung].aktual != null && titikPrediksi.length > 0) {
      titikPrediksi.unshift([x(indeksSambung), y(data[indeksSambung].aktual!)])
    }

    const pitaAtas: Array<[number, number]> = []
    const pitaBawah: Array<[number, number]> = []
    data.forEach((d, i) => {
      if (d.batasAtas != null && d.batasBawah != null) {
        pitaAtas.push([x(i), y(d.batasAtas)])
        pitaBawah.push([x(i), y(d.batasBawah)])
      }
    })

    const jalurPita =
      pitaAtas.length > 1
        ? `${garisHalus(pitaAtas)} L${pitaBawah[pitaBawah.length - 1][0]},${pitaBawah[pitaBawah.length - 1][1]} ${garisHalus([...pitaBawah].reverse()).replace(/^M/, 'L')} Z`
        : ''

    return {
      w,
      ph,
      maks,
      x,
      y,
      jalurAktual: garisHalus(titikAktual),
      jalurPrediksi: garisHalus(titikPrediksi),
      jalurPita,
      indeksSambung,
      ujungAktual: titikAktual[titikAktual.length - 1],
      ujungPrediksi: titikPrediksi[titikPrediksi.length - 1],
    }
  }, [data, lebar, tinggi])

  const nilaiTerakhirPrediksi = [...data].reverse().find((d) => d.prediksi != null)?.prediksi
  const langkahLabel = Math.max(1, Math.ceil(data.length / 6))

  function saatGerak(e: PointerEvent<SVGSVGElement>) {
    const kotak = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - kotak.left
    const rel = (px - SISI.kiri) / Math.max(1, g.w - SISI.kiri - SISI.kanan)
    const i = Math.round(rel * (data.length - 1))
    setSorot(i >= 0 && i < data.length ? i : null)
  }

  const d = sorot != null ? data[sorot] : null

  return (
    <div>
      <div ref={wadahRef} className="relative select-none">
        <svg
          width={g.w}
          height={tinggi}
          role="img"
          aria-label={`Grafik tren pemakaian dalam ${satuan}. ${labelAktual} dan ${labelPrediksi}. Nilai lengkap tersedia pada tampilan tabel di bawah grafik.`}
          className="touch-pan-y"
          onPointerMove={saatGerak}
          onPointerLeave={() => setSorot(null)}
        >
          {/* Garis bantu: hairline, solid, satu langkah dari permukaan */}
          {tandaSumbu(g.maks).map((t) => (
            <g key={t}>
              <line
                x1={SISI.kiri}
                x2={g.w - SISI.kanan}
                y1={g.y(t)}
                y2={g.y(t)}
                stroke="var(--c-grid)"
                strokeWidth="1"
              />
              <text
                x={SISI.kiri - 8}
                y={g.y(t) + 4}
                textAnchor="end"
                className="tabular"
                fontSize="10.5"
                fill="var(--c-sumbu)"
              >
                {angka(t)}
              </text>
            </g>
          ))}

          {/* Pita ketidakpastian prediksi */}
          {g.jalurPita && <path d={g.jalurPita} fill="var(--c-seri-1)" opacity="0.1" />}

          {/* Batas hari ini */}
          {g.indeksSambung >= 0 && g.indeksSambung < data.length - 1 && (
            <>
              <line
                x1={g.x(g.indeksSambung)}
                x2={g.x(g.indeksSambung)}
                y1={SISI.atas}
                y2={SISI.atas + g.ph}
                stroke="var(--c-sumbu)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.65"
              />
              <text
                x={g.x(g.indeksSambung) + 5}
                y={SISI.atas + 9}
                fontSize="10"
                fontWeight="700"
                fill="var(--c-sumbu)"
              >
                hari ini
              </text>
            </>
          )}

          {/* Garis perkiraan: putus-putus karena belum terjadi */}
          <path
            d={g.jalurPrediksi}
            fill="none"
            stroke="var(--c-seri-1)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 4"
          />

          {/* Garis tercatat */}
          <path
            d={g.jalurAktual}
            fill="none"
            stroke="var(--c-seri-1)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Penanda ujung dengan cincin permukaan supaya tetap terbaca */}
          {g.ujungPrediksi && (
            <circle
              cx={g.ujungPrediksi[0]}
              cy={g.ujungPrediksi[1]}
              r="4.5"
              fill="var(--c-seri-1)"
              stroke="var(--c-surface)"
              strokeWidth="2"
            />
          )}

          {/* Garis bidik saat disentuh */}
          {sorot != null && data[sorot] && (
            <>
              <line
                x1={g.x(sorot)}
                x2={g.x(sorot)}
                y1={SISI.atas}
                y2={SISI.atas + g.ph}
                stroke="var(--c-ink-3)"
                strokeWidth="1"
              />
              <circle
                cx={g.x(sorot)}
                cy={g.y(data[sorot].aktual ?? data[sorot].prediksi ?? 0)}
                r="5"
                fill="var(--c-seri-1)"
                stroke="var(--c-surface)"
                strokeWidth="2"
              />
            </>
          )}

          {/* Label sumbu tanggal, dijarangkan supaya tidak bertabrakan */}
          {data.map((t, i) =>
            i % langkahLabel === 0 || i === data.length - 1 ? (
              <text
                key={t.tanggal}
                x={g.x(i)}
                y={tinggi - 8}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                fontSize="10.5"
                fill="var(--c-sumbu)"
              >
                {tanggalRingkas(t.tanggal)}
              </text>
            ) : null,
          )}
        </svg>

        {/* Keterangan angka saat disentuh */}
        {d && (
          <div
            className="absolute top-0 pointer-events-none bg-ink text-ink-inverse rounded-sm px-2.5 py-1.5 shadow-e2 text-[0.75rem] leading-tight"
            style={{
              left: Math.min(Math.max(g.x(sorot!) - 60, 0), Math.max(0, g.w - 130)),
            }}
          >
            <div className="font-bold">{tanggalLengkapHari(d.tanggal)}</div>
            <div className="mt-0.5 opacity-90 tabular">
              {d.aktual != null
                ? `${labelAktual}: ${angka(d.aktual)} ${satuan}`
                : `${labelPrediksi}: ${angka(d.prediksi ?? 0)} ${satuan}`}
            </div>
            {d.aktual == null && d.batasBawah != null && d.batasAtas != null && (
              <div className="opacity-70 tabular">
                Rentang {angka(d.batasBawah)}&ndash;{angka(d.batasAtas)} {satuan}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kunci baca: dua gaya garis, bukan dua warna */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="18" y2="4" stroke="var(--c-seri-1)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {labelAktual}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="18"
              y2="4"
              stroke="var(--c-seri-1)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="5 4"
            />
          </svg>
          {labelPrediksi}
          {nilaiTerakhirPrediksi != null && (
            <span className="font-semibold text-ink-2 tabular">
              &middot; {angka(nilaiTerakhirPrediksi)} {satuan}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setTampilTabel((v) => !v)}
          className="ml-auto font-semibold text-brand hover:underline"
          aria-expanded={tampilTabel}
        >
          {tampilTabel ? 'Sembunyikan tabel' : 'Lihat angkanya'}
        </button>
      </div>

      {tampilTabel && (
        <div className="mt-3 max-h-56 overflow-auto rounded-md border border-line">
          <table className="w-full text-[0.8125rem]">
            <caption className="sr-only">Angka tren pemakaian per tanggal</caption>
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-ink-3 text-left">
                <th scope="col" className="py-2 px-3 font-semibold">
                  Tanggal
                </th>
                <th scope="col" className="py-2 px-3 font-semibold text-right">
                  {labelAktual}
                </th>
                <th scope="col" className="py-2 px-3 font-semibold text-right">
                  {labelPrediksi}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.tanggal} className="border-t border-line">
                  <td className="py-1.5 px-3 text-ink-2">{tanggalRingkas(t.tanggal)}</td>
                  <td className="py-1.5 px-3 text-right tabular text-ink font-semibold">
                    {t.aktual != null ? angka(t.aktual) : '–'}
                  </td>
                  <td className="py-1.5 px-3 text-right tabular text-ink-2">
                    {t.prediksi != null ? angka(t.prediksi) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
