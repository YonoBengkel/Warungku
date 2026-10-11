/**
 * Peta sebaran UMKM — digambar sendiri, tanpa pustaka peta dan tanpa jaringan.
 *
 * Tiga hal yang mengikat bentuk berkas ini:
 *
 * 1. Ini peta skematis, bukan peta sesungguhnya. Yang digambar cuma kotak
 *    koordinat BATAS_PETA dengan kisi tipis. Itu dinyatakan terang-terangan di
 *    layar supaya tidak ada yang mengira letak titiknya presisi sampai ke nomor
 *    rumah.
 * 2. Warna tidak pernah berdiri sendiri. Tiap titik punya bentuk cincin yang
 *    berbeda per status (penuh / putus-putus / ganda tipis), angka pesanan
 *    tertulis di dalamnya, dan keterangan lengkap dibawa `aria-label` serta
 *    `<title>`.
 * 3. Badan halaman tidak boleh bergeser horizontal. Svg-nya selebar induknya
 *    (`w-full`) dan tingginya mengikuti `viewBox`, jadi ia mengecil di layar
 *    360px alih-alih memaksa halaman melebar.
 */
import { useMemo, useState } from 'react'
import { BATAS_PETA, umkmById } from '@/data/dummy'
import { KETERANGAN_TITIK, LABEL_TITIK, WARNA_TITIK_TOKEN } from '@/lib/label'
import { angka } from '@/lib/format'
import type { TitikPeta, WarnaTitik } from '@/lib/types'

/* ================================================================== */
/* Ukuran dan pemetaan koordinat                                      */
/* ================================================================== */

/** Kira-kira 4:3, cukup lebar untuk kotak Sleman–Kota Yogyakarta. */
const LEBAR = 400
const TINGGI = 300

/**
 * Jarak dari bingkai. Diukur dari bagian terluar yang bisa digambar pada satu
 * titik — cincin sorot titik terpilih pada radius terbesar — supaya titik di
 * pinggir tidak pernah terpotong bingkai peta.
 */
const TEPI = 32

/** Jarak bersih minimal antara dua tepi lingkaran, supaya tidak saling menelan. */
const JARAK_TAMBAHAN = 4

/**
 * Radius area tekan tak terlihat.
 *
 * 29 satuan pada viewBox 400 lebar. Di layar 360px peta dirender sekitar 304px,
 * jadi satu satuan ≈ 0,76px dan garis tengah area tekannya ≈ 44px. Angka ini
 * sengaja dijaga LEBIH KECIL dari jarak minimal antar pusat titik (lihat
 * `rapikan`), sehingga menekan tepat di tengah sebuah titik tidak pernah jatuh
 * ke area tekan tetangganya.
 */
const RADIUS_TEKAN = 29

/** Urutan tetap: paling mendesak dulu. Dipakai peta maupun kartu hitungan. */
const URUTAN_WARNA: WarnaTitik[] = ['merah', 'oren', 'biru']

function jepit(n: number, min: number, maks: number): number {
  return Math.min(maks, Math.max(min, n))
}

/**
 * Lintang/bujur menjadi koordinat svg, lurus (linear) dari BATAS_PETA.
 *
 * Sumbu y dibalik: lintang yang lebih besar berarti lebih ke utara, dan utara
 * ada di ATAS layar. Tanpa pembalikan ini seluruh peta terbaca terbalik.
 */
function keSvg(lat: number, lng: number): { x: number; y: number } {
  const { latMin, latMaks, lngMin, lngMaks } = BATAS_PETA
  const bx = jepit((lng - lngMin) / (lngMaks - lngMin), 0, 1)
  const by = jepit((latMaks - lat) / (latMaks - latMin), 0, 1)
  return { x: TEPI + bx * (LEBAR - TEPI * 2), y: TEPI + by * (TINGGI - TEPI * 2) }
}

/** Titik membesar mengikuti jumlah pesanan, tapi berhenti di empat tingkat. */
function radiusTitik(jumlah: number): number {
  return 14 + Math.min(Math.max(jumlah, 1) - 1, 3) * 2
}

interface Posisi {
  titik: TitikPeta
  nama: string
  x: number
  y: number
  r: number
}

/**
 * Merapikan titik yang berimpit.
 *
 * Dua UMKM pada data contoh berjarak sekitar 11px satu sama lain di layar
 * 360px. Digambar apa adanya, yang satu menelan yang lain dan angkanya tidak
 * terbaca. Karena peta ini memang skematis, titik yang terlalu rapat didorong
 * menjauh secukupnya sampai tepinya tidak lagi bertumpuk. Pergeserannya kecil
 * dan selalu sama tiap render, dan halaman menuliskan bahwa letak titik memang
 * dirapikan — jadi tidak ada yang tertipu presisi palsu.
 */
function rapikan(awal: Posisi[]): Posisi[] {
  const p = awal.map((o) => ({ ...o }))
  for (let putaran = 0; putaran < 80; putaran++) {
    let bergeser = false
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const minimal = p[i].r + p[j].r + JARAK_TAMBAHAN
        let dx = p[j].x - p[i].x
        let dy = p[j].y - p[i].y
        let jarak = Math.hypot(dx, dy)
        if (jarak >= minimal) continue
        // Dua toko dengan koordinat identik: dorong ke arah tetap supaya
        // hasilnya tidak bergantung angka acak.
        if (jarak < 0.001) {
          dx = 1
          dy = 0
          jarak = 1
        }
        const dorong = (minimal - jarak) / 2
        const ux = (dx / jarak) * dorong
        const uy = (dy / jarak) * dorong
        p[i].x -= ux
        p[i].y -= uy
        p[j].x += ux
        p[j].y += uy
        bergeser = true
      }
    }
    for (const t of p) {
      t.x = jepit(t.x, TEPI, LEBAR - TEPI)
      t.y = jepit(t.y, TEPI, TINGGI - TEPI)
    }
    if (!bergeser) break
  }
  return p
}

/* ================================================================== */
/* Cincin status: pembeda yang bukan warna                            */
/* ================================================================== */

/**
 * Bentuk cincin per status, supaya titik tetap bisa dibedakan oleh orang yang
 * tidak membedakan merah dari oren.
 *
 * merah = cincin penuh · oren = cincin putus-putus · biru = cincin ganda tipis
 */
function Cincin({ warna, r }: { warna: WarnaTitik; r: number }) {
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

/* ================================================================== */
/* Peta                                                               */
/* ================================================================== */

export function PetaSebaran({
  titik,
  dipilih,
  pilih,
}: {
  titik: TitikPeta[]
  dipilih: string | null
  /** Menekan titik yang sedang terpilih mengirim null, jadi panelnya tertutup. */
  pilih: (umkmId: string | null) => void
}) {
  // Fokus papan ketik digambar sendiri: garis luar bawaan peramban pada <g>
  // svg sering terpotong oleh bingkai peta, dan cincin sorot ini terlihat sama
  // di tema terang maupun gelap.
  const [berfokus, setBerfokus] = useState<string | null>(null)

  const posisi = useMemo(() => {
    const awal: Posisi[] = []
    for (const t of titik) {
      const umkm = umkmById(t.umkmId)
      if (!umkm) continue
      const { x, y } = keSvg(umkm.lat, umkm.lng)
      awal.push({ titik: t, nama: umkm.nama, x, y, r: radiusTitik(t.jumlahPesanan) })
    }
    return rapikan(awal)
  }, [titik])

  // Titik besar digambar lebih dulu supaya yang kecil tidak terkubur, dan yang
  // sedang terpilih paling akhir supaya cincin sorotnya utuh.
  const urut = useMemo(() => {
    return [...posisi].sort((a, b) => {
      const ap = a.titik.umkmId === dipilih ? 1 : 0
      const bp = b.titik.umkmId === dipilih ? 1 : 0
      if (ap !== bp) return ap - bp
      if (a.r !== b.r) return b.r - a.r
      return a.y - b.y
    })
  }, [posisi, dipilih])

  const kisiX = [1, 2, 3, 4, 5].map((n) => (LEBAR / 6) * n)
  const kisiY = [1, 2, 3, 4].map((n) => (TINGGI / 5) * n)

  return (
    <div>
      {/* Ukurannya diatur CSS (w-full h-auto) dari rasio viewBox. Atribut
          height="auto" sengaja tidak dipakai: itu bukan panjang yang sah untuk
          svg, dan peramban mencatatnya sebagai galat di konsol. */}
      <svg
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        width="100%"
        role="group"
        aria-label={`Peta sebaran ${angka(posisi.length)} toko`}
        className="block w-full h-auto rounded-md border border-line"
      >
        <rect x={0} y={0} width={LEBAR} height={TINGGI} fill="var(--c-surface-sunken)" />

        {/* Kisi tipis: cukup untuk terbaca sebagai bidang berskala, tidak
            cukup untuk disangka jalan atau sungai. */}
        <g stroke="var(--c-grid)" strokeWidth={1}>
          {kisiX.map((x) => (
            <line key={`x${x}`} x1={x} y1={0} x2={x} y2={TINGGI} />
          ))}
          {kisiY.map((y) => (
            <line key={`y${y}`} x1={0} y1={y} x2={LEBAR} y2={y} />
          ))}
        </g>

        {urut.map((p) => {
          const warna = p.titik.warna
          const aktif = p.titik.umkmId === dipilih
          const sorot = aktif || berfokus === p.titik.umkmId
          // Titik cuma berwarna kondisi yang paling mendesak, jadi menyebut
          // seluruh jumlahPesanan sebagai pesanan berkondisi itu tidak jujur
          // untuk toko yang pesanannya berbeda-beda. Sisanya disebut terpisah.
          const padaKondisi = p.titik.perWarna[warna]
          const kondisiLain = p.titik.jumlahPesanan - padaKondisi
          const keterangan =
            `${p.nama}. ${angka(padaKondisi)} pesanan ${LABEL_TITIK[warna].toLowerCase()}` +
            (kondisiLain > 0 ? `, ${angka(kondisiLain)} pesanan pada kondisi lain. ` : '. ') +
            (aktif ? 'Sedang terpilih, tekan lagi untuk menutup rincian.' : 'Tekan untuk melihat rincian toko.')
          return (
            <g
              key={p.titik.umkmId}
              role="button"
              tabIndex={0}
              aria-pressed={aktif}
              aria-label={keterangan}
              transform={`translate(${p.x} ${p.y})`}
              className="cursor-pointer focus:outline-none"
              onClick={() => pilih(aktif ? null : p.titik.umkmId)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
                e.preventDefault()
                pilih(aktif ? null : p.titik.umkmId)
              }}
              onFocus={() => setBerfokus(p.titik.umkmId)}
              onBlur={() => setBerfokus(null)}
            >
              <title>{keterangan}</title>

              {/* Area tekan tak terlihat: lingkaran isinya harus "transparent",
                  bukan "none", supaya tetap menerima sentuhan. */}
              <circle r={RADIUS_TEKAN} fill="transparent" />

              {sorot && (
                <circle
                  r={p.r + 10}
                  fill="none"
                  stroke="var(--c-ink)"
                  strokeWidth={2.5}
                  opacity={0.85}
                />
              )}

              <Cincin warna={warna} r={p.r} />

              {/* Garis tepi sewarna permukaan memisahkan dua titik yang
                  bersebelahan tanpa perlu menjauhkannya lebih dari perlunya. */}
              <circle
                r={p.r}
                fill={WARNA_TITIK_TOKEN[warna]}
                stroke="var(--c-surface)"
                strokeWidth={1.5}
              />

              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={p.r * 1.05}
                fontWeight={800}
                fill="var(--c-ink-inverse)"
              >
                {p.titik.jumlahPesanan}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="mt-2 text-[0.75rem] text-ink-3 leading-snug">
        Ini gambaran sebaran, bukan peta sesungguhnya. Letaknya diperkirakan dari koordinat toko dan
        titik yang terlalu rapat sedikit dirapikan supaya tidak saling menutup. Angka di dalam titik
        adalah jumlah pesanan toko itu.
      </p>
      {posisi.length === 0 && (
        <p className="mt-1 text-[0.8125rem] text-ink-2">Belum ada titik yang perlu ditampilkan.</p>
      )}
    </div>
  )
}

/* ================================================================== */
/* Kartu hitungan titik                                               */
/* ================================================================== */

/** Contoh titik untuk kartu hitungan. Bentuk cincinnya sama persis dengan peta. */
function TandaTitik({ warna, jumlah }: { warna: WarnaTitik; jumlah: number }) {
  return (
    <svg viewBox="0 0 56 56" width={48} height={48} aria-hidden="true" className="shrink-0">
      <g transform="translate(28 28)">
        <Cincin warna={warna} r={17} />
        <circle r={17} fill={WARNA_TITIK_TOKEN[warna]} stroke="var(--c-surface)" strokeWidth={1.5} />
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
      </g>
    </svg>
  )
}

/**
 * Tiga kartu angka: merah, oren, biru — susunannya titik dulu (dengan angkanya
 * di dalam), lalu nama statusnya, lalu keterangan apa arti titik itu.
 *
 * Ketiganya selalu ditampilkan walaupun nol, karena kartu ini sekaligus jadi
 * legenda peta. Legenda yang hilang saat angkanya nol membuat orang harus
 * menebak arti cincin yang baru muncul besok.
 */
export function KartuHitungTitik({ titik }: { titik: TitikPeta[] }) {
  const hitung = useMemo(() => {
    const awal: Record<WarnaTitik, { pesanan: number; toko: number }> = {
      merah: { pesanan: 0, toko: 0 },
      oren: { pesanan: 0, toko: 0 },
      biru: { pesanan: 0, toko: 0 },
    }
    // Dihitung dari rincian per kondisi, bukan dari warna dominan titik.
    // Menaruh seluruh pesanan satu toko ke ember warna yang paling mendesak
    // membuat angka kartu ini berbeda dari tab di halaman Pesanan, dari
    // lonceng, dan dari Rekap di Beranda — padahal semuanya menghitung hal
    // yang sama. Satu toko boleh terhitung di lebih dari satu kartu.
    for (const t of titik) {
      for (const w of URUTAN_WARNA) {
        if (t.perWarna[w] <= 0) continue
        awal[w].pesanan += t.perWarna[w]
        awal[w].toko += 1
      }
    }
    return awal
  }, [titik])

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {URUTAN_WARNA.map((w) => (
          <li key={w} className="min-w-0">
            <div className="h-full bg-surface border border-line rounded-lg shadow-e1 p-2.5 sm:p-3.5 flex flex-col items-center text-center">
              <TandaTitik warna={w} jumlah={hitung[w].pesanan} />
              <p className="mt-1.5 text-[0.75rem] sm:text-[0.8125rem] font-bold text-ink leading-tight">
                {LABEL_TITIK[w]}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-ink-2 leading-snug">
                {angka(hitung[w].pesanan)} pesanan di {angka(hitung[w].toko)} toko
              </p>
              <p className="mt-1 text-[0.6875rem] text-ink-3 leading-snug">{KETERANGAN_TITIK[w]}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Tanpa kalimat ini, jumlah toko ketiga kartu terbaca lebih banyak
          daripada jumlah titik di peta, dan itu terlihat seperti salah hitung. */}
      <p className="mt-2 text-[0.75rem] text-ink-3 leading-snug">
        Satu toko bisa muncul di lebih dari satu kartu kalau pesanannya berbeda kondisi. Di peta ia
        tetap satu titik saja, berwarna kondisi yang paling mendesak.
      </p>
    </div>
  )
}
