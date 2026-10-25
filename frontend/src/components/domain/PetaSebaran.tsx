/**
 * Peta sebaran UMKM: Leaflet dengan ubin OpenStreetMap (revisi V4, Q87), dasar
 * yang sama dengan peta rincian pesanan (`buatPeta` di PetaLacak.tsx).
 *
 * Dulu peta ini digambar sendiri sebagai kotak koordinat berkisi, dengan titik
 * yang dirapikan supaya tidak berimpit. Kini letaknya letak sungguhan; titik
 * yang berdempetan dipisahkan dengan memperbesar peta, dan daftar toko di
 * sebelah peta tetap jadi jalan lain untuk memilihnya.
 *
 * Warna tidak pernah berdiri sendiri. Tiap titik punya bentuk cincin yang
 * berbeda per status (penuh / putus-putus / ganda tipis, lihat `Cincin`),
 * angka pesanan tertulis di dalamnya, dan keterangan lengkap dibawa
 * `aria-label`. Penanda dirender React lewat portal ke dalam `L.divIcon`, jadi
 * warnanya ikut token tema.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { umkmById } from '@/data/dummy'
import { LABEL_TITIK, WARNA_TITIK_TOKEN } from '@/lib/label'
import { angka, cx } from '@/lib/format'
import type { TitikPeta, WarnaTitik } from '@/lib/types'
import { buatPeta, PesanGagalUbin } from './PetaLacak'
import { Cincin, TandaTitik } from './TandaTitik'

/** Urutan tetap: paling mendesak dulu. Dipakai peta maupun kartu hitungan. */
const URUTAN_WARNA: WarnaTitik[] = ['merah', 'oren', 'biru']

/** Titik membesar mengikuti jumlah pesanan, tapi berhenti di empat tingkat (px). */
function radiusTitik(jumlah: number): number {
  return 14 + Math.min(Math.max(jumlah, 1) - 1, 3) * 2
}

/** Sisi kotak penanda: cukup untuk cincin terluar dan cincin sorot titik terpilih. */
function sisiPenanda(r: number): number {
  return 2 * (r + 12)
}

interface Posisi {
  titik: TitikPeta
  nama: string
  lat: number
  lng: number
  r: number
}

/**
 * Keterangan satu titik untuk pembaca layar. Titik cuma berwarna kondisi yang
 * paling mendesak, jadi menyebut seluruh jumlahPesanan sebagai pesanan
 * berkondisi itu tidak jujur untuk toko yang pesanannya berbeda-beda.
 */
function keterangan(p: Posisi, aktif: boolean): string {
  const warna = p.titik.warna
  const padaKondisi = p.titik.perWarna[warna]
  const kondisiLain = p.titik.jumlahPesanan - padaKondisi
  return (
    `${p.nama}. ${angka(padaKondisi)} pesanan ${LABEL_TITIK[warna].toLowerCase()}` +
    (kondisiLain > 0 ? `, ${angka(kondisiLain)} pesanan pada kondisi lain. ` : '. ') +
    (aktif ? 'Sedang terpilih, tekan lagi untuk menutup rincian.' : 'Tekan untuk melihat rincian toko.')
  )
}

export function PetaSebaran({
  titik,
  dipilih,
  pilih,
  className,
}: {
  titik: TitikPeta[]
  dipilih: string | null
  /** Menekan titik yang sedang terpilih mengirim null, jadi panelnya tertutup. */
  pilih: (umkmId: string | null) => void
  className?: string
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const peta = useRef<L.Map | null>(null)
  const lapisan = useRef<L.LayerGroup | null>(null)
  const penanda = useRef(new Map<string, L.Marker>())
  const pilihRef = useRef(pilih)
  const dipilihRef = useRef(dipilih)
  /** Batas yang harus dipaskan begitu peta punya ukuran. */
  const batasTertunda = useRef<L.LatLng[] | null>(null)
  const [isi, setIsi] = useState<Array<{ umkmId: string; el: HTMLElement }>>([])
  const [gagalUbin, setGagalUbin] = useState(false)

  useEffect(() => {
    pilihRef.current = pilih
    dipilihRef.current = dipilih
  }, [pilih, dipilih])

  const posisi = useMemo(() => {
    const hasil: Posisi[] = []
    for (const t of titik) {
      const umkm = umkmById(t.umkmId)
      if (!umkm) continue
      hasil.push({ titik: t, nama: umkm.nama, lat: umkm.lat, lng: umkm.lng, r: radiusTitik(t.jumlahPesanan) })
    }
    return hasil
  }, [titik])

  /* Hanya membaca ref, jadi cukup dibuat sekali. */
  const pasBatas = useCallback(() => {
    const m = peta.current
    const titikBatas = batasTertunda.current
    if (!m || !titikBatas || !wadah.current || wadah.current.clientWidth === 0) return
    batasTertunda.current = null
    if (titikBatas.length === 1) m.setView(titikBatas[0], 14)
    else if (titikBatas.length > 1) m.fitBounds(L.latLngBounds(titikBatas), { padding: [40, 40], maxZoom: 15 })
  }, [])

  /* Peta dibuat sekali. */
  useEffect(() => {
    const el = wadah.current
    if (!el) return
    const { peta: m, lepas } = buatPeta(el, setGagalUbin, pasBatas)
    lapisan.current = L.layerGroup().addTo(m)
    peta.current = m
    return () => {
      lepas()
      peta.current = null
      lapisan.current = null
    }
  }, [pasBatas])

  /* Penanda digambar ulang setiap kali titiknya berubah. */
  useEffect(() => {
    const g = lapisan.current
    if (!g) return
    g.clearLayers()
    penanda.current.clear()
    const baru: Array<{ umkmId: string; el: HTMLElement }> = []
    for (const p of posisi) {
      const el = document.createElement('div')
      const sisi = sisiPenanda(p.r)
      const mk = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ html: el, className: 'titik-lacak', iconSize: [sisi, sisi], iconAnchor: [sisi / 2, sisi / 2] }),
        title: p.nama,
        keyboard: true,
        riseOnHover: true,
        // Titik kecil di atas titik besar, supaya yang kecil tidak terkubur.
        zIndexOffset: (30 - p.r) * 10,
      })
      mk.on('click', () => {
        const id = p.titik.umkmId
        pilihRef.current(dipilihRef.current === id ? null : id)
      })
      mk.on('add', () => mk.getElement()?.setAttribute('role', 'button'))
      mk.addTo(g)
      penanda.current.set(p.titik.umkmId, mk)
      baru.push({ umkmId: p.titik.umkmId, el })
    }
    setIsi(baru)
    batasTertunda.current = posisi.map((p) => L.latLng(p.lat, p.lng))
    pasBatas()
  }, [posisi, pasBatas])

  /* Keterangan dan keadaan tekan ikut pilihan; titik terpilih naik ke atas,
     dan peta bergeser kalau titiknya di luar pandangan (dipilih dari daftar). */
  useEffect(() => {
    for (const p of posisi) {
      const mk = penanda.current.get(p.titik.umkmId)
      const ikon = mk?.getElement()
      const aktif = p.titik.umkmId === dipilih
      ikon?.setAttribute('aria-label', keterangan(p, aktif))
      ikon?.setAttribute('aria-pressed', String(aktif))
      mk?.setZIndexOffset(aktif ? 1000 : (30 - p.r) * 10)
    }
    const m = peta.current
    const mk = dipilih ? penanda.current.get(dipilih) : undefined
    if (!m || !mk || !wadah.current || wadah.current.clientWidth === 0) return
    const tujuan = mk.getLatLng()
    if (!m.getBounds().pad(-0.15).contains(tujuan)) {
      const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      m.panTo(tujuan, { animate: !kurangiGerak })
    }
  }, [dipilih, posisi, isi])

  const posisiPer = useMemo(() => new Map(posisi.map((p) => [p.titik.umkmId, p])), [posisi])

  return (
    <div className={cx('relative isolate overflow-hidden rounded-lg border border-line bg-sunken', className)}>
      <div
        ref={wadah}
        role="region"
        aria-label={`Peta sebaran ${angka(posisi.length)} toko`}
        className="peta-lacak h-full w-full"
      />
      {isi.map(({ umkmId, el }) => {
        const p = posisiPer.get(umkmId)
        if (!p) return null
        const sisi = sisiPenanda(p.r)
        const warna = p.titik.warna
        return createPortal(
          <svg
            viewBox={`${-sisi / 2} ${-sisi / 2} ${sisi} ${sisi}`}
            width={sisi}
            height={sisi}
            aria-hidden="true"
            className="block overflow-visible"
          >
            {umkmId === dipilih && (
              <circle r={p.r + 10} fill="none" stroke="var(--c-ink)" strokeWidth={2.5} opacity={0.85} />
            )}
            <Cincin warna={warna} r={p.r} />
            {/* Garis tepi sewarna permukaan memisahkan dua titik yang bersebelahan. */}
            <circle r={p.r} fill={WARNA_TITIK_TOKEN[warna]} stroke="var(--c-surface)" strokeWidth={1.5} />
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
          </svg>,
          el,
          umkmId,
        )
      })}
      {gagalUbin && <PesanGagalUbin />}
    </div>
  )
}

/* ================================================================== */
/* Kartu hitungan titik                                               */
/* ================================================================== */

/**
 * Tiga kartu angka: merah, oren, biru. Titik dulu (dengan angkanya di dalam),
 * lalu nama kondisinya dan jumlah pesanan serta tokonya. Kalimat penjelas tiap
 * kondisi dihapus atas permintaan Ilham (revisi V4, Q84).
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
    <ul className="grid grid-cols-3 gap-2 sm:gap-3">
      {URUTAN_WARNA.map((w) => (
        <li key={w} className="min-w-0">
          <div className="h-full bg-surface border border-line rounded-lg shadow-e1 p-2.5 sm:p-3.5 flex flex-col items-center text-center">
            <TandaTitik warna={w} jumlah={hitung[w].pesanan} />
            <p className="mt-1.5 text-kecil sm:text-isi font-bold text-ink leading-tight">{LABEL_TITIK[w]}</p>
            <p className="mt-0.5 text-[0.6875rem] sm:text-kecil text-ink-2 leading-snug">
              {angka(hitung[w].pesanan)} pesanan di {angka(hitung[w].toko)} toko
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
