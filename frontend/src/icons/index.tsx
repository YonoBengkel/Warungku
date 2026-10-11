/**
 * Ikon garis (stroke) buatan sendiri.
 * Alasan tidak memakai pustaka ikon: bundel lebih kecil untuk perangkat Android
 * kelas menengah, dan ketebalan garis bisa dijamin konsisten di seluruh aplikasi.
 *
 * Semua ikon bersifat dekoratif (aria-hidden). Makna harus selalu dibawa oleh
 * teks di sebelahnya, bukan oleh ikon atau warna saja.
 */
import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ---------- Navigasi utama ---------- */

export const IkonBeranda = (p: Props) => (
  <Svg {...p}>
    <path d="M3 10.2 12 3l9 7.2" />
    <path d="M5.5 9.3V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.3" />
  </Svg>
)

export const IkonStok = (p: Props) => (
  <Svg {...p}>
    <path d="M3 7.6 12 3l9 4.6v8.8L12 21l-9-4.6Z" />
    <path d="M3 7.6 12 12l9-4.4M12 12v9" />
  </Svg>
)

export const IkonPasokan = (p: Props) => (
  <Svg {...p}>
    <path d="M2.5 7.5h10v9h-10z" />
    <path d="M12.5 10.5h4l3 3v3h-7z" />
    <circle cx="6" cy="18.5" r="1.9" />
    <circle cx="16.5" cy="18.5" r="1.9" />
  </Svg>
)

export const IkonPesanan = (p: Props) => (
  <Svg {...p}>
    <path d="M6 3.5h12a1 1 0 0 1 1 1v16l-3.2-2-3.3 2-3.3-2L6 20.5v-16a1 1 0 0 1 1-1Z" />
    <path d="M9 8.5h6M9 12.5h6" />
  </Svg>
)

export const IkonProfil = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c1.2-3.7 4-5.6 7.5-5.6s6.3 1.9 7.5 5.6" />
  </Svg>
)

/* ---------- Aksi & keadaan ---------- */

export const IkonLonceng = (p: Props) => (
  <Svg {...p}>
    <path d="M18 8.8a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </Svg>
)

export const IkonCari = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Svg>
)

export const IkonSaring = (p: Props) => (
  <Svg {...p}>
    <path d="M3 6h18M6.5 12h11M10 18h4" />
  </Svg>
)

export const IkonTambah = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IkonKurang = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const IkonSilang = (p: Props) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IkonCentang = (p: Props) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
)

export const IkonCentangLingkaran = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.3 2.8 2.7L16 9.6" />
  </Svg>
)

export const IkonPeringatan = (p: Props) => (
  <Svg {...p}>
    <path d="M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20.3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.2M12 17.1h.01" />
  </Svg>
)

export const IkonInfo = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.2M12 7.9h.01" />
  </Svg>
)

export const IkonPanahKanan = (p: Props) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
)

export const IkonPanahKiri = (p: Props) => (
  <Svg {...p}>
    <path d="m15 5-7 7 7 7" />
  </Svg>
)

export const IkonPanahBawah = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v13M5.5 12.5 12 19l6.5-6.5" />
  </Svg>
)

export const IkonPanahAtas = (p: Props) => (
  <Svg {...p}>
    <path d="M12 19V6M5.5 11.5 12 5l6.5 6.5" />
  </Svg>
)

export const IkonTrenNaik = (p: Props) => (
  <Svg {...p}>
    <path d="m3 16 5.5-5.5 3.5 3.5L21 5" />
    <path d="M15.5 5H21v5.5" />
  </Svg>
)

export const IkonTrenTurun = (p: Props) => (
  <Svg {...p}>
    <path d="m3 8 5.5 5.5L12 10l9 9" />
    <path d="M15.5 19H21v-5.5" />
  </Svg>
)

export const IkonKalender = (p: Props) => (
  <Svg {...p}>
    <rect x="3.2" y="5" width="17.6" height="16" rx="2.2" />
    <path d="M3.2 9.8h17.6M8 3v4M16 3v4" />
  </Svg>
)

export const IkonJam = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2V12l3 1.8" />
  </Svg>
)

export const IkonSinkron = (p: Props) => (
  <Svg {...p}>
    <path d="M20.5 11.5a8.5 8.5 0 0 0-15-4.6" />
    <path d="M3.5 12.5a8.5 8.5 0 0 0 15 4.6" />
    <path d="M4.8 3.2v3.9h3.9M19.2 20.8v-3.9h-3.9" />
  </Svg>
)

export const IkonKontrak = (p: Props) => (
  <Svg {...p}>
    <path d="M6.5 2.8h7.2L19 8.2v13H6.5z" />
    <path d="M13.4 2.8v5.6H19" />
    <path d="M9.4 13.4h6.2M9.4 17h4" />
  </Svg>
)

export const IkonKeranjang = (p: Props) => (
  <Svg {...p}>
    <path d="M2.6 3.5h2.6l2.3 11.2a1.8 1.8 0 0 0 1.8 1.4h8.3a1.8 1.8 0 0 0 1.8-1.4l1.4-6.8H6" />
    <circle cx="9.6" cy="20" r="1.5" />
    <circle cx="17.8" cy="20" r="1.5" />
  </Svg>
)

export const IkonKotak = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 8.2 12 4l8.5 4.2v7.6L12 20l-8.5-4.2Z" />
    <path d="M7.7 6 16.4 10.2v4" />
  </Svg>
)

export const IkonToko = (p: Props) => (
  <Svg {...p}>
    <path d="M4 9.3V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.3" />
    <path d="M2.8 9.3 4.6 4a1 1 0 0 1 .95-.7h12.9a1 1 0 0 1 .95.7l1.8 5.3a3.1 3.1 0 0 1-5.3 2.2 3.1 3.1 0 0 1-5.3 0 3.1 3.1 0 0 1-5.3 0 3.1 3.1 0 0 1-2.5-2.2Z" />
  </Svg>
)

export const IkonBintang = (p: Props) => (
  <Svg {...p}>
    <path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.78L12 16.9l-5.2 2.73 1-5.78-4.2-4.1 5.8-.85z" />
  </Svg>
)

export const IkonBintangIsi = ({ size = 20, ...rest }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.78L12 16.9l-5.2 2.73 1-5.78-4.2-4.1 5.8-.85z" />
  </svg>
)

export const IkonPena = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20.1h4l10.3-10.3a2.4 2.4 0 0 0-3.4-3.4L4.6 16.7Z" />
    <path d="m14.4 7.1 2.5 2.5" />
  </Svg>
)

export const IkonPengaturan = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.5 14.4a1.4 1.4 0 0 0 .3 1.6l.1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.4 1.4 0 0 0-1.6-.3 1.4 1.4 0 0 0-.85 1.3v.3a1.7 1.7 0 1 1-3.4 0v-.15a1.4 1.4 0 0 0-.92-1.3 1.4 1.4 0 0 0-1.6.3l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.4 1.4 0 0 0 .3-1.6 1.4 1.4 0 0 0-1.3-.85h-.3a1.7 1.7 0 1 1 0-3.4h.15a1.4 1.4 0 0 0 1.3-.92 1.4 1.4 0 0 0-.3-1.6l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.4 1.4 0 0 0 1.6.3h.07A1.4 1.4 0 0 0 11.5 4.4v-.3a1.7 1.7 0 1 1 3.4 0v.15a1.4 1.4 0 0 0 .85 1.3 1.4 1.4 0 0 0 1.6-.3l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.4 1.4 0 0 0-.3 1.6v.07a1.4 1.4 0 0 0 1.3.85h.3a1.7 1.7 0 1 1 0 3.4h-.15a1.4 1.4 0 0 0-1.3.85Z" />
  </Svg>
)

export const IkonKeluar = (p: Props) => (
  <Svg {...p}>
    <path d="M9.5 20.5H5.4a1.9 1.9 0 0 1-1.9-1.9V5.4a1.9 1.9 0 0 1 1.9-1.9h4.1" />
    <path d="m15.5 16.5 4.5-4.5-4.5-4.5M20 12H9.2" />
  </Svg>
)

export const IkonTiga = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Svg>
)

export const IkonBulan = (p: Props) => (
  <Svg {...p}>
    <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />
  </Svg>
)

export const IkonMatahari = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.2v2.1M12 19.7v2.1M4.2 12H2.1M21.9 12h-2.1M6.1 6.1 4.6 4.6M19.4 19.4l-1.5-1.5M6.1 17.9l-1.5 1.5M19.4 4.6l-1.5 1.5" />
  </Svg>
)

export const IkonKembali = IkonPanahKiri

export const IkonGudang = (p: Props) => (
  <Svg {...p}>
    <path d="M3 20.5V9.2L12 4l9 5.2v11.3" />
    <path d="M7.5 20.5v-6.8h9v6.8M7.5 17h9" />
  </Svg>
)

export const IkonNota = (p: Props) => (
  <Svg {...p}>
    <path d="M5.5 3.5h13v17l-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5-2.2-1.5z" />
    <path d="M9 8h6M9 12h6" />
  </Svg>
)

export const IkonKirim = (p: Props) => (
  <Svg {...p}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.6 18-3.9-7.5L3 9.6z" />
  </Svg>
)

export const IkonTelepon = (p: Props) => (
  <Svg {...p}>
    <path d="M21.5 16.9v2.6a1.8 1.8 0 0 1-2 1.8 17.6 17.6 0 0 1-7.7-2.7 17.4 17.4 0 0 1-5.3-5.3A17.6 17.6 0 0 1 3.8 5.5a1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.55c.1.85.3 1.68.58 2.47a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.4 14.4 0 0 0 5.4 5.4l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.79.28 1.62.48 2.47.58a1.8 1.8 0 0 1 1.55 1.83Z" />
  </Svg>
)

export const IkonLokasi = (p: Props) => (
  <Svg {...p}>
    <path d="M20 10.4c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10.2" r="2.9" />
  </Svg>
)

export const IkonMata = (p: Props) => (
  <Svg {...p}>
    <path d="M2.2 12S5.8 5.4 12 5.4 21.8 12 21.8 12 18.2 18.6 12 18.6 2.2 12 2.2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const IkonMataTutup = (p: Props) => (
  <Svg {...p}>
    <path d="M9.9 5.7A9.4 9.4 0 0 1 12 5.4c6.2 0 9.8 6.6 9.8 6.6a17.6 17.6 0 0 1-2.7 3.7M6.3 7.4A17.4 17.4 0 0 0 2.2 12S5.8 18.6 12 18.6a9.3 9.3 0 0 0 3.9-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Svg>
)

export const IkonGrafik = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 3.5v15a2 2 0 0 0 2 2h15" />
    <path d="M7.5 16V11M12 16V6.5M16.5 16v-7" />
  </Svg>
)

export const IkonBantuan = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.4a2.6 2.6 0 0 1 5 .85c0 1.7-2.5 2.55-2.5 2.55" />
    <path d="M12 16.8h.01" />
  </Svg>
)

export const IkonKunci = (p: Props) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10.2" rx="2" />
    <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
  </Svg>
)

export const IkonSalin = (p: Props) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
  </Svg>
)

export const IkonUnggah = (p: Props) => (
  <Svg {...p}>
    <path d="M20.5 15.5v3.6a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9v-3.6" />
    <path d="m16.5 8 -4.5-4.5L7.5 8M12 3.5V15" />
  </Svg>
)

export const IkonSampah = (p: Props) => (
  <Svg {...p}>
    <path d="M3.8 6.2h16.4M8.6 6.2V4.5a1.5 1.5 0 0 1 1.5-1.5h3.8a1.5 1.5 0 0 1 1.5 1.5v1.7" />
    <path d="M18.3 6.2 17.6 19a1.8 1.8 0 0 1-1.8 1.7H8.2A1.8 1.8 0 0 1 6.4 19L5.7 6.2" />
  </Svg>
)

export const IkonPetir = (p: Props) => (
  <Svg {...p}>
    <path d="M13.3 2.5 4.2 13.4h6.5L10.7 21.5l9.1-10.9h-6.5z" />
  </Svg>
)

export const IkonTanpaSinyal = (p: Props) => (
  <Svg {...p}>
    <path d="M2 3l20 18" />
    <path d="M5.5 12.8a9.3 9.3 0 0 1 3.2-2.1M2.2 9.2a14 14 0 0 1 3.6-2.4M18.5 12.8a9.3 9.3 0 0 0-4.8-2.55M21.8 9.2a14 14 0 0 0-8.6-3.35" />
    <path d="M9.2 16.3a4.3 4.3 0 0 1 5.6 0M12 20h.01" />
  </Svg>
)

