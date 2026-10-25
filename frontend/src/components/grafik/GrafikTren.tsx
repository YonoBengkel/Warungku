import { useMemo, useState } from 'react'
import type { PointerEvent } from 'react'
import type { TitikTren } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'
import { angka, bulanRingkas, bulanTahun, cx, tanggalRingkas, tanggalLengkapHari } from '@/lib/format'
import { useLebarWadah, useTinggiWadah, batasRapi, tandaSumbu, garisHalus } from './dasarGrafik'

/**
 * Tren pemakaian: yang sudah terjadi dan yang diperkirakan akan terjadi.
 *
 * Keputusan yang dipegang:
 * - Aktual dan perkiraan memakai dua warna (seri-1 dan merah perkiraan) dan dua
 *   gaya garis (utuh dan putus-putus), atas permintaan dosen pengampu
 *   (16 Okt 2026). Dulu satu warna; sekarang kedua garis bisa tumpang tindih
 *   di hari yang sudah tercatat (perkiraan uji balik), jadi keduanya harus
 *   bisa dibedakan. Gaya garis tetap ada supaya warna tidak bekerja sendirian.
 * - Bentuknya mengikuti sketsa tim (19 Okt 2026). Masa lalu: dua garis, aktual
 *   dan perkiraan uji balik, tanpa pita. Masa depan: garis perkiraan dan pita
 *   rentang yang berangkat dari titik aktual terakhir, tempat ketidakpastian
 *   masih nol, lalu mengembang seperti kipas.
 * - Perkiraan uji balik dan perkiraan ke depan adalah dua ramalan berbeda
 *   (dibuat dari titik asal yang berbeda), jadi digambar sebagai dua ruas yang
 *   tidak saling disambung. Lompatan kecil di garis "data terakhir" itu jujur.
 * - Pita di masa depan selalu ditampilkan kalau ada. Menyembunyikan rentang
 *   membuat perkiraan terlihat lebih pasti daripada kenyataannya. Lebarnya
 *   mengikuti model, tidak dipaksa melebar.
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
  format,
  // Angka kecil (mis. 0,5 kg) butuh desimal; tanpa itu sumbu terbaca "0 1 1 2 2".
  formatSumbu = (n: number) => angka(n, Math.abs(n) < 10 ? 2 : 0),
  lebarSumbu = SISI.kiri,
  bulanan = false,
  labelBatas,
  isiTinggi = false,
}: {
  data: TitikTren[]
  satuan: string
  tinggi?: number
  labelAktual?: string
  labelPrediksi?: string
  /** Nilai lengkap beserta satuannya, untuk keterangan sentuh dan tabel. Bawaan: "12 kg". */
  format?: (n: number) => string
  /** Label sumbu tegak, sebaiknya ringkas. */
  formatSumbu?: (n: number) => string
  /** Lebar ruang label sumbu tegak, untuk label yang lebih panjang dari angka biasa. */
  lebarSumbu?: number
  /** Titik data per bulan: sumbu mendatar menulis nama bulan, bukan tanggal. */
  bulanan?: boolean
  /** Tulisan di garis pemisah riwayat dan perkiraan. */
  labelBatas?: string
  /**
   * Grafik memanjang mengisi sisa tinggi wadahnya (revisi V3, Q68); `tinggi`
   * menjadi tinggi paling pendek. Wadahnya harus kolom flex yang tingginya
   * sudah tertentu. Di luar itu grafiknya setinggi `tinggi`.
   */
  isiTinggi?: boolean
}) {
  // Data server berhenti di hari terakhir yang tercatat, belum tentu hari ini.
  const sumberServer = useAplikasi((s) => s.sumberData === 'server')
  const tulisBatas = labelBatas ?? (sumberServer ? 'data terakhir' : 'hari ini')
  // Desimal untuk angka kecil (mis. 0,87 kg), supaya rentang tidak terbaca "0 kg–1 kg".
  const tulis = format ?? ((n: number) => `${angka(n, Math.abs(n) < 10 ? 2 : 0)} ${satuan}`)
  const tulisTanggal = bulanan ? bulanRingkas : tanggalRingkas
  const tulisTanggalPanjang = bulanan ? bulanTahun : tanggalLengkapHari
  const sisi = { ...SISI, kiri: lebarSumbu }
  const [wadahRef, lebar] = useLebarWadah<HTMLDivElement>()
  const [tinggiRef, tinggiTersedia] = useTinggiWadah<HTMLDivElement>()
  const tinggiGambar = isiTinggi ? Math.max(tinggi, Math.floor(tinggiTersedia)) : tinggi
  const [sorot, setSorot] = useState<number | null>(null)
  const [tampilTabel, setTampilTabel] = useState(false)

  const g = useMemo(() => {
    const w = Math.max(lebar, 260)
    const pw = w - sisi.kiri - sisi.kanan
    const ph = tinggiGambar - sisi.atas - sisi.bawah

    const semuaNilai = data.flatMap((d) => [d.aktual, d.prediksi, d.batasAtas].filter((n): n is number => n != null))
    const maks = batasRapi(Math.max(1, ...semuaNilai) * 1.08)
    const x = (i: number) => sisi.kiri + (data.length <= 1 ? pw / 2 : (pw * i) / (data.length - 1))
    const y = (v: number) => sisi.atas + ph - (v / maks) * ph

    const titikAktual: Array<[number, number]> = []
    let indeksSambung = -1
    data.forEach((d, i) => {
      if (d.aktual != null) {
        titikAktual.push([x(i), y(d.aktual)])
        indeksSambung = i
      }
    })

    // Dua ruas perkiraan: uji balik di hari yang sudah tercatat, dan perkiraan
    // ke depan sesudah hari terakhir. Pita hanya untuk yang ke depan.
    const titikLalu: Array<[number, number]> = []
    const titikDepan: Array<[number, number]> = []
    const pitaAtas: Array<[number, number]> = []
    const pitaBawah: Array<[number, number]> = []
    data.forEach((d, i) => {
      const lalu = i <= indeksSambung
      if (d.prediksi != null) (lalu ? titikLalu : titikDepan).push([x(i), y(d.prediksi)])
      if (!lalu && d.batasAtas != null && d.batasBawah != null) {
        pitaAtas.push([x(i), y(d.batasAtas)])
        pitaBawah.push([x(i), y(d.batasBawah)])
      }
    })

    // Perkiraan ke depan dan pitanya berangkat dari titik aktual terakhir: di
    // sana yang terjadi sudah diketahui, jadi rentangnya mulai dari nol.
    if (indeksSambung >= 0) {
      const awal: [number, number] = [x(indeksSambung), y(data[indeksSambung].aktual!)]
      if (titikDepan.length > 0) titikDepan.unshift(awal)
      if (pitaAtas.length > 0) {
        pitaAtas.unshift(awal)
        pitaBawah.unshift(awal)
      }
    }

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
      jalurPrediksi: [titikLalu, titikDepan]
        .filter((t) => t.length > 0)
        .map(garisHalus)
        .join(' '),
      jalurPita,
      indeksSambung,
      ujungAktual: titikAktual[titikAktual.length - 1],
      ujungPrediksi: titikDepan[titikDepan.length - 1] ?? titikLalu[titikLalu.length - 1],
    }
    // `sisi` lahir dari `lebarSumbu`, jadi cukup itu yang dipantau.
  }, [data, lebar, tinggiGambar, lebarSumbu])

  const nilaiTerakhirPrediksi = [...data].reverse().find((d) => d.prediksi != null)?.prediksi
  const adaPita = data.some((t) => t.batasBawah != null && t.batasAtas != null)
  // Label tanggal kira-kira selebar 60px: di layar sempit jumlahnya dikurangi
  // supaya "22 Sep" dan "26 Sep" tidak bertabrakan.
  const muatLabel = Math.max(2, Math.min(6, Math.floor((g.w - sisi.kiri - sisi.kanan) / 60)))
  const langkahLabel = Math.max(1, Math.ceil(data.length / muatLabel))
  const tampilLabel = (i: number) =>
    i === data.length - 1 || (i % langkahLabel === 0 && data.length - 1 - i >= langkahLabel / 2)

  function saatGerak(e: PointerEvent<SVGSVGElement>) {
    const kotak = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - kotak.left
    const rel = (px - sisi.kiri) / Math.max(1, g.w - sisi.kiri - sisi.kanan)
    const i = Math.round(rel * (data.length - 1))
    setSorot(i >= 0 && i < data.length ? i : null)
  }

  const d = sorot != null ? data[sorot] : null

  /* Gambar dan keterangan sentuhnya. Di mode `isiTinggi` keduanya duduk di
     lapisan `absolute`, supaya wadahnya diukur dari sisa kolom, bukan dari
     tinggi gambar yang sedang tampil. */
  const gambar = (
    <>
      <svg
        width={g.w}
        height={tinggiGambar}
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
              x1={sisi.kiri}
              x2={g.w - sisi.kanan}
              y1={g.y(t)}
              y2={g.y(t)}
              stroke="var(--c-grid)"
              strokeWidth="1"
            />
            <text
              x={sisi.kiri - 8}
              y={g.y(t) + 4}
              textAnchor="end"
              className="tabular"
              fontSize="10.5"
              fill="var(--c-sumbu)"
            >
              {formatSumbu(t)}
            </text>
          </g>
        ))}

        {/* Pita ketidakpastian prediksi */}
        {g.jalurPita && <path d={g.jalurPita} fill="var(--c-pita-perkiraan)" />}

        {/* Batas hari ini */}
        {g.indeksSambung >= 0 && g.indeksSambung < data.length - 1 && (
          <>
            <line
              x1={g.x(g.indeksSambung)}
              x2={g.x(g.indeksSambung)}
              y1={sisi.atas}
              y2={sisi.atas + g.ph}
              stroke="var(--c-sumbu)"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.65"
            />
            {/* Dekat tepi kanan (grafik bulanan) tulisan pindah ke kiri garis supaya tidak terpotong. */}
            <text
              x={g.x(g.indeksSambung) + (g.x(g.indeksSambung) > g.w - sisi.kanan - 75 ? -5 : 5)}
              y={sisi.atas + 9}
              textAnchor={g.x(g.indeksSambung) > g.w - sisi.kanan - 75 ? 'end' : 'start'}
              fontSize="10"
              fontWeight="700"
              fill="var(--c-sumbu)"
            >
              {tulisBatas}
            </text>
          </>
        )}

        {/* Garis tercatat */}
        <path
          d={g.jalurAktual}
          fill="none"
          stroke="var(--c-seri-1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Garis perkiraan di atas garis tercatat: celah putus-putusnya
            membiarkan garis tercatat tetap terlihat saat tumpang tindih. */}
        <path
          d={g.jalurPrediksi}
          fill="none"
          stroke="var(--c-seri-perkiraan)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />

        {/* Penanda ujung dengan cincin permukaan supaya tetap terbaca */}
        {g.ujungPrediksi && (
          <circle
            cx={g.ujungPrediksi[0]}
            cy={g.ujungPrediksi[1]}
            r="4.5"
            fill="var(--c-seri-perkiraan)"
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
              y1={sisi.atas}
              y2={sisi.atas + g.ph}
              stroke="var(--c-ink-3)"
              strokeWidth="1"
            />
            {data[sorot].prediksi != null && (
              <circle
                cx={g.x(sorot)}
                cy={g.y(data[sorot].prediksi!)}
                r="5"
                fill="var(--c-seri-perkiraan)"
                stroke="var(--c-surface)"
                strokeWidth="2"
              />
            )}
            {data[sorot].aktual != null && (
              <circle
                cx={g.x(sorot)}
                cy={g.y(data[sorot].aktual!)}
                r="5"
                fill="var(--c-seri-1)"
                stroke="var(--c-surface)"
                strokeWidth="2"
              />
            )}
          </>
        )}

        {/* Label sumbu tanggal, dijarangkan supaya tidak bertabrakan */}
        {data.map((t, i) =>
          tampilLabel(i) ? (
            <text
              key={t.tanggal}
              x={g.x(i)}
              y={tinggiGambar - 8}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              fontSize="10.5"
              fill="var(--c-sumbu)"
            >
              {tulisTanggal(t.tanggal)}
            </text>
          ) : null,
        )}
      </svg>

      {/* Keterangan angka saat disentuh */}
      {d && (
        <div
          className="absolute top-0 pointer-events-none bg-ink text-ink-inverse rounded-sm px-2.5 py-1.5 shadow-e2 text-kecil leading-tight"
          style={{
            left: Math.min(Math.max(g.x(sorot!) - 60, 0), Math.max(0, g.w - 130)),
          }}
        >
          <div className="font-bold">{tulisTanggalPanjang(d.tanggal)}</div>
          {d.aktual != null && (
            <div className="mt-0.5 opacity-90 tabular">{`${labelAktual}: ${tulis(d.aktual)}`}</div>
          )}
          {d.prediksi != null && (
            <div className="mt-0.5 opacity-90 tabular">{`${labelPrediksi}: ${tulis(d.prediksi)}`}</div>
          )}
          {d.batasBawah != null && d.batasAtas != null && (
            <div className="opacity-70 tabular">
              Rentang {tulis(d.batasBawah)}&ndash;{tulis(d.batasAtas)}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className={cx(isiTinggi && 'flex-1 min-h-0 flex flex-col')}>
      {isiTinggi ? (
        <div ref={tinggiRef} className="relative flex-1" style={{ minHeight: tinggi }}>
          <div ref={wadahRef} className="absolute inset-0 select-none">
            {gambar}
          </div>
        </div>
      ) : (
        <div ref={wadahRef} className="relative select-none">
          {gambar}
        </div>
      )}

      {/* Kunci baca: dua warna dan dua gaya garis, ditambah pita rentang */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-kecil text-ink-3">
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
              stroke="var(--c-seri-perkiraan)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="5 4"
            />
          </svg>
          {labelPrediksi}
          {nilaiTerakhirPrediksi != null && (
            <span className="font-semibold text-ink-2 tabular">
              &middot; {tulis(nilaiTerakhirPrediksi)}
            </span>
          )}
        </span>
        {g.jalurPita && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="10" aria-hidden="true">
              <rect x="0" y="0" width="18" height="10" rx="2" fill="var(--c-pita-perkiraan)" />
            </svg>
            {/* "8 dari 10" hanya berlaku untuk rentang harian (p10-p90 tiap hari).
                Rentang bulanan adalah jumlah batas harian, jadi peluangnya lain. */}
            {bulanan ? 'Rentang perkiraan' : 'Rentang perkiraan (8 dari 10 hari)'}
          </span>
        )}
        <button
          type="button"
          onClick={() => setTampilTabel((v) => !v)}
          /* Area sentuh dilebarkan lewat pseudo-element supaya tombolnya tetap
             ramping di dalam baris legenda, tapi jempol tetap mengenainya. */
          className="relative ml-auto font-semibold text-brand hover:underline after:absolute after:inset-x-0 after:-top-3 after:-bottom-3 after:content-['']"
          aria-expanded={tampilTabel}
        >
          {tampilTabel ? 'Sembunyikan tabel' : 'Lihat angkanya'}
        </button>
      </div>

      {tampilTabel && (
        <div className="mt-3 max-h-56 overflow-auto rounded-md border border-line">
          <table className="w-full text-isi">
            <caption className="sr-only">Angka tren pemakaian per tanggal</caption>
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-ink-3 text-left">
                <th scope="col" className="py-2 px-3 font-semibold">
                  {bulanan ? 'Bulan' : 'Tanggal'}
                </th>
                <th scope="col" className="py-2 px-3 font-semibold text-right">
                  {labelAktual}
                </th>
                <th scope="col" className="py-2 px-3 font-semibold text-right">
                  {labelPrediksi}
                </th>
                {adaPita && (
                  <th scope="col" className="py-2 px-3 font-semibold text-right">
                    Rentang
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.tanggal} className="border-t border-line">
                  <td className="py-1.5 px-3 text-ink-2">{tulisTanggalPanjang(t.tanggal)}</td>
                  <td className="py-1.5 px-3 text-right tabular text-ink font-semibold">
                    {t.aktual != null ? tulis(t.aktual) : '–'}
                  </td>
                  <td className="py-1.5 px-3 text-right tabular text-ink-2">
                    {t.prediksi != null ? tulis(t.prediksi) : '–'}
                  </td>
                  {adaPita && (
                    <td className="py-1.5 px-3 text-right tabular text-ink-3 whitespace-nowrap">
                      {t.batasBawah != null && t.batasAtas != null
                        ? `${tulis(t.batasBawah)}–${tulis(t.batasAtas)}`
                        : '–'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
