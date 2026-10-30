import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BatasGalat } from '@/components/BatasGalat'
import { KerangkaBaris } from '@/components/ui/dasar'

/** Kerangka abu-abu selama halaman lazy dimuat. */
export function MemuatHalaman() {
  return (
    <div className="py-6">
      <KerangkaBaris jumlah={4} />
    </div>
  )
}

/**
 * Isi halaman di dalam kerangka portal (revisi V6, Q121). Batas galat dan
 * `Suspense` membungkus isi halaman saja, tidak lagi seluruh aplikasi: dulu
 * batas galat dipasang ulang per alamat di `App.tsx`, sehingga menu samping
 * ikut dipasang ulang setiap pindah halaman dan penanda menunya tidak pernah
 * bergeser, dan halaman lazy yang belum termuat menyembunyikan menu samping.
 * Batas ini tetap dipasang ulang per alamat, jadi pindah halaman memulihkan
 * halaman yang gagal tampil.
 */
export function IsiHalaman() {
  const { pathname } = useLocation()
  return (
    <BatasGalat key={pathname}>
      <Suspense fallback={<MemuatHalaman />}>
        <Outlet />
      </Suspense>
    </BatasGalat>
  )
}
