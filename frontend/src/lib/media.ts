import { useEffect, useState } from 'react'

/**
 * Cocok atau tidaknya satu kueri media, ikut berubah saat jendela berubah.
 * Nilai awalnya dibaca seketika, jadi tidak ada tata letak salah sekejap.
 */
export function useKueriMedia(kueri: string): boolean {
  const [cocok, setCocok] = useState(() => window.matchMedia(kueri).matches)
  useEffect(() => {
    const mq = window.matchMedia(kueri)
    const ubah = () => setCocok(mq.matches)
    ubah()
    mq.addEventListener('change', ubah)
    return () => mq.removeEventListener('change', ubah)
  }, [kueri])
  return cocok
}

/** Desktop: batas `lg` Tailwind (1024px), tempat menu samping mulai tampil. */
export const KUERI_DESKTOP = '(min-width: 1024px)'
