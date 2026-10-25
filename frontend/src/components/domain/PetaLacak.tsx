import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IkonGudang, IkonPasokan, IkonToko } from '@/icons'
import { cx } from '@/lib/format'
import type { Koordinat } from '@/lib/lacak'

/**
 * Peta Lacak Pesanan (revisi 23 Okt 2026): Leaflet dengan ubin OpenStreetMap.
 *
 * Tiga jenis titik: gudang distributor, tempat usaha tujuan, dan kiriman yang
 * sedang di jalan. Posisi kiriman adalah PERKIRAAN (lihat `posisiKiriman`),
 * bukan GPS, dan layar wajib menyebutnya begitu.
 *
 * Isi tiap penanda dirender React lewat portal ke dalam `L.divIcon`, jadi ikon
 * dan warnanya memakai ikon serta token aplikasi dan ikut tema gelap. Peta
 * dibungkus `isolate`: panel Leaflet memakai z-index ratusan, dan tanpa lapisan
 * sendiri ia menimpa kepala halaman yang menempel.
 *
 * Peta bukan satu-satunya jalan ke informasinya: daftar di sebelahnya memuat
 * hal yang sama sebagai teks. Kalau ubin gagal dimuat (tanpa internet), peta
 * menyebutnya dan daftar tetap lengkap.
 */

export type JenisTitik = 'gudang' | 'tujuan' | 'kiriman'

export interface TitikLacak extends Koordinat {
  kunci: string
  jenis: JenisTitik
  /** Nama untuk pembaca layar dan tooltip penanda. */
  judul: string
}

export interface GarisLacak {
  kunci: string
  dari: Koordinat
  ke: Koordinat
}

type Ikon = ComponentType<{ size?: number; className?: string }>

const RUPA: Record<JenisTitik, { Ikon: Ikon; kelas: string; ukuran: number }> = {
  gudang: { Ikon: IkonGudang, kelas: 'bg-brand text-ink-inverse', ukuran: 34 },
  tujuan: { Ikon: IkonToko, kelas: 'bg-surface text-ink border-2 border-ink', ukuran: 34 },
  kiriman: { Ikon: IkonPasokan, kelas: 'bg-info text-ink-inverse', ukuran: 38 },
}

export const LABEL_JENIS_TITIK: Record<JenisTitik, string> = {
  gudang: 'Gudang distributor',
  tujuan: 'Tempat usaha tujuan',
  kiriman: 'Kiriman (perkiraan posisi)',
}

/** Pusat awal sebelum titik pertama ada: Kota Yogyakarta. */
const PUSAT_AWAL: L.LatLngExpression = [-7.797, 110.37]

/**
 * Peta dasar bersama: ubin OSM dengan atribusinya, gulir halaman tidak
 * tersangkut (perbesar lewat tombol, dua jari, atau Ctrl + gulir), dan ukuran
 * diukur ulang saat wadahnya berubah, mis. dari tab tersembunyi ke terlihat.
 * Dipakai juga peta Sebaran pemesan (revisi V4, Q87).
 */
export function buatPeta(
  el: HTMLElement,
  aturGagal: (gagal: boolean) => void,
  padaUkuran: () => void,
): { peta: L.Map; lepas: () => void } {
  const peta = L.map(el, { center: PUSAT_AWAL, zoom: 11, scrollWheelZoom: false })
  let termuat = 0
  let gagal = 0
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
    .on('tileload', () => {
      termuat += 1
      aturGagal(false)
    })
    .on('tileerror', () => {
      gagal += 1
      if (termuat === 0 && gagal >= 3) aturGagal(true)
    })
    .addTo(peta)
  const gulirCtrl = (e: WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    if (e.deltaY < 0) peta.zoomIn()
    else peta.zoomOut()
  }
  el.addEventListener('wheel', gulirCtrl, { passive: false })
  const ro = new ResizeObserver(() => {
    peta.invalidateSize()
    padaUkuran()
  })
  ro.observe(el)
  return {
    peta,
    lepas: () => {
      ro.disconnect()
      el.removeEventListener('wheel', gulirCtrl)
      peta.remove()
    },
  }
}

export function PesanGagalUbin() {
  return (
    <p className="absolute inset-x-3 bottom-3 z-[1000] rounded-md bg-surface/95 border border-line p-3 text-isi text-ink-2 shadow-e2">
      Gambar peta belum termuat. Periksa koneksi internet; keterangan di luar peta tetap lengkap.
    </p>
  )
}

export function PetaLacak({
  titik,
  garis = [],
  terpilih,
  pilih,
  label,
  className,
}: {
  titik: TitikLacak[]
  garis?: GarisLacak[]
  /** Kunci titik yang disorot; peta terbang ke sana. */
  terpilih?: string | null
  pilih?: (kunci: string) => void
  /** Nama wilayah peta untuk pembaca layar. */
  label: string
  className?: string
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const peta = useRef<L.Map | null>(null)
  const lapisan = useRef<L.LayerGroup | null>(null)
  const penanda = useRef(new Map<string, L.Marker>())
  const pilihRef = useRef(pilih)
  /** Batas yang harus dipaskan begitu peta punya ukuran (di tab tersembunyi ia nol). */
  const batasTertunda = useRef<L.LatLng[] | null>(null)
  const [isi, setIsi] = useState<Array<{ kunci: string; el: HTMLElement; jenis: JenisTitik }>>([])
  const [gagalUbin, setGagalUbin] = useState(false)

  useEffect(() => {
    pilihRef.current = pilih
  }, [pilih])

  /* Hanya membaca ref, jadi cukup dibuat sekali. */
  const pasBatas = useCallback(() => {
    const m = peta.current
    const titikBatas = batasTertunda.current
    if (!m || !titikBatas || !wadah.current || wadah.current.clientWidth === 0) return
    batasTertunda.current = null
    if (titikBatas.length === 1) m.setView(titikBatas[0], 13)
    else if (titikBatas.length > 1) m.fitBounds(L.latLngBounds(titikBatas), { padding: [36, 36], maxZoom: 14 })
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

  /* Titik dan garis digambar ulang setiap kali datanya berubah. */
  useEffect(() => {
    const m = peta.current
    const g = lapisan.current
    if (!m || !g) return
    g.clearLayers()
    penanda.current.clear()

    for (const x of garis) {
      L.polyline(
        [
          [x.dari.lat, x.dari.lng],
          [x.ke.lat, x.ke.lng],
        ],
        { className: 'garis-lacak', interactive: false },
      ).addTo(g)
    }

    const baru: Array<{ kunci: string; el: HTMLElement; jenis: JenisTitik }> = []
    for (const t of titik) {
      const el = document.createElement('div')
      const { ukuran } = RUPA[t.jenis]
      const mk = L.marker([t.lat, t.lng], {
        icon: L.divIcon({ html: el, className: 'titik-lacak', iconSize: [ukuran, ukuran], iconAnchor: [ukuran / 2, ukuran / 2] }),
        title: t.judul,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: t.jenis === 'kiriman' ? 500 : t.jenis === 'gudang' ? 200 : 0,
      })
      mk.on('click', () => pilihRef.current?.(t.kunci))
      mk.on('add', () => {
        const ikon = mk.getElement()
        ikon?.setAttribute('role', 'button')
        ikon?.setAttribute('aria-label', t.judul)
      })
      mk.addTo(g)
      penanda.current.set(t.kunci, mk)
      baru.push({ kunci: t.kunci, el, jenis: t.jenis })
    }
    setIsi(baru)

    batasTertunda.current = titik.map((t) => L.latLng(t.lat, t.lng))
    pasBatas()
  }, [titik, garis, pasBatas])

  /* Terbang ke titik terpilih. */
  useEffect(() => {
    const m = peta.current
    if (!m || !terpilih || !wadah.current || wadah.current.clientWidth === 0) return
    const mk = penanda.current.get(terpilih)
    if (!mk) return
    const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tujuan = mk.getLatLng()
    const zoom = Math.max(m.getZoom(), 13)
    if (kurangiGerak) m.setView(tujuan, zoom)
    else m.flyTo(tujuan, zoom, { duration: 0.6 })
  }, [terpilih])

  return (
    <div className={cx('relative isolate overflow-hidden rounded-lg border border-line bg-sunken', className)}>
      <div ref={wadah} role="region" aria-label={label} className="peta-lacak h-full w-full" />
      {isi.map(({ kunci, el, jenis }) => {
        const { Ikon, kelas, ukuran } = RUPA[jenis]
        return createPortal(
          <span
            className={cx(
              'grid place-items-center rounded-full shadow-e2 transition-transform duration-150',
              kelas,
              terpilih === kunci && 'ring-4 ring-brand/40 scale-110',
            )}
            style={{ width: ukuran, height: ukuran }}
          >
            <Ikon size={jenis === 'kiriman' ? 20 : 18} />
          </span>,
          el,
          kunci,
        )
      })}
      {gagalUbin && <PesanGagalUbin />}
    </div>
  )
}

/** Keterangan tiga jenis penanda, untuk ditaruh di bawah peta. */
export function KeteranganPeta({ jenis = ['gudang', 'tujuan', 'kiriman'], className }: { jenis?: JenisTitik[]; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 text-kecil text-ink-2', className)}>
      {jenis.map((j) => {
        const { Ikon, kelas } = RUPA[j]
        return (
          <span key={j} className="inline-flex items-center gap-1.5">
            <span className={cx('grid place-items-center size-6 rounded-full', kelas)} aria-hidden="true">
              <Ikon size={13} />
            </span>
            {LABEL_JENIS_TITIK[j]}
          </span>
        )
      })}
    </div>
  )
}

/** Enam angka di belakang koma (sekitar 10 cm) sudah lebih dari cukup untuk titik gudang. */
const bulatkan = (c: { lat: number; lng: number }): Koordinat => ({
  lat: Math.round(c.lat * 1e6) / 1e6,
  lng: Math.round(c.lng * 1e6) / 1e6,
})

/**
 * Peta untuk memilih satu titik (lokasi gudang di Profil distributor).
 *
 * Titik dipasang dengan mengetuk peta. Pengguna keyboard menggeser peta dengan
 * tombol panah lalu memakai tombol "Pakai titik tengah peta" (`pakaiTengah`),
 * yang ditandai garis bidik di tengah peta.
 */
export function PetaPilihTitik({
  nilai,
  ubah,
  pusat,
  label,
  className,
  pakaiTengahRef,
}: {
  nilai: Koordinat | null
  ubah: (k: Koordinat) => void
  /** Titik awal tampilan bila `nilai` kosong, mis. titik tengah kota. */
  pusat: Koordinat
  label: string
  className?: string
  /** Diisi fungsi yang membaca titik tengah peta saat ini. */
  pakaiTengahRef?: { current: (() => Koordinat | null) | null }
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const peta = useRef<L.Map | null>(null)
  const penanda = useRef<L.Marker | null>(null)
  const ubahRef = useRef(ubah)
  const [elPenanda] = useState(() => document.createElement('div'))
  const [gagalUbin, setGagalUbin] = useState(false)

  useEffect(() => {
    ubahRef.current = ubah
  }, [ubah])

  useEffect(() => {
    const el = wadah.current
    if (!el) return
    const awal = nilai ?? pusat
    const { peta: m, lepas } = buatPeta(el, setGagalUbin, () => undefined)
    m.setView([awal.lat, awal.lng], nilai ? 15 : 13)
    m.on('click', (e: L.LeafletMouseEvent) => ubahRef.current(bulatkan(e.latlng)))
    peta.current = m
    if (pakaiTengahRef) {
      pakaiTengahRef.current = () => {
        const c = peta.current?.getCenter()
        return c ? bulatkan(c) : null
      }
    }
    return () => {
      lepas()
      peta.current = null
      penanda.current = null
      if (pakaiTengahRef) pakaiTengahRef.current = null
    }
    // Peta dibuat sekali; nilai awal hanya menentukan tampilan pertama.
  }, [])

  /* Penanda mengikuti nilai. */
  useEffect(() => {
    const m = peta.current
    if (!m) return
    if (!nilai) {
      penanda.current?.remove()
      penanda.current = null
      return
    }
    if (!penanda.current) {
      penanda.current = L.marker([nilai.lat, nilai.lng], {
        icon: L.divIcon({ html: elPenanda, className: 'titik-lacak', iconSize: [34, 34], iconAnchor: [17, 17] }),
        interactive: false,
        keyboard: false,
      }).addTo(m)
    } else {
      penanda.current.setLatLng([nilai.lat, nilai.lng])
    }
  }, [nilai, elPenanda])

  const { Ikon, kelas } = RUPA.gudang
  return (
    <div className={cx('relative isolate overflow-hidden rounded-lg border border-line bg-sunken', className)}>
      <div ref={wadah} role="region" aria-label={label} className="peta-lacak h-full w-full cursor-crosshair" />
      {/* Garis bidik titik tengah peta, untuk tombol "Pakai titik tengah peta". */}
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2">
        <span className="block size-5 rounded-full border-2 border-ink/60" />
      </span>
      {nilai &&
        createPortal(
          <span className={cx('grid place-items-center rounded-full shadow-e2 size-[34px]', kelas)}>
            <Ikon size={18} />
          </span>,
          elPenanda,
        )}
      {gagalUbin && <PesanGagalUbin />}
    </div>
  )
}
