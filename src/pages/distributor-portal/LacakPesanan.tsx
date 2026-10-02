import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KartuHitungTitik } from '@/components/domain/PetaSebaran'
import { JudulBagian, KartuTautan, Lencana, TombolTautan } from '@/components/ui/dasar'
import { TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import {
  IkonCentangLingkaran,
  IkonGudang,
  IkonKirim,
  IkonLokasi,
  IkonPanahKanan,
  IkonToko,
} from '@/icons'
import { angka, jumlahSatuan } from '@/lib/format'
import { LABEL_PESANAN_MASUK, NADA_PESANAN_MASUK } from '@/lib/label'
import type { PesananMasuk, StatusPesananMasuk } from '@/lib/types'
import { daftarPenawaran, distributorAktif, umkmById } from '@/data/dummy'
import { usePesananMasuk, useTitikPeta } from '@/store/aplikasi'

/**
 * Lacak Pesanan: dua keadaan saja, Sedang Diproses dan Selesai.
 *
 * Yang didaftar di sini TOKO, bukan pesanan. Alasannya: pertanyaan yang
 * dibawa distributor ke layar ini hampir selalu "siapa yang masih menunggu",
 * dan satu toko sering punya beberapa pesanan sekaligus. Mendaftar pesanan
 * satu per satu membuat nama toko yang sama muncul berkali-kali dan
 * menyembunyikan jumlah sebenarnya.
 *
 * Rinciannya ada satu ketukan lebih dalam, dan bentuknya berbeda per keadaan:
 * yang diproses menampilkan perjalanan barang, yang selesai menampilkan
 * penilaian pelanggan dan bukti pengantaran.
 */

type Keadaan = 'proses' | 'selesai'

const STATUS_PER_KEADAAN: Record<Keadaan, StatusPesananMasuk[]> = {
  proses: ['disiapkan', 'dikirim'],
  selesai: ['selesai'],
}

const IKON_STATUS: Record<'disiapkan' | 'dikirim' | 'selesai', typeof IkonGudang> = {
  disiapkan: IkonGudang,
  dikirim: IkonKirim,
  selesai: IkonCentangLingkaran,
}

/** Katalog toko ini. Tetap sepanjang sesi, jadi dihitung sekali di luar komponen. */
const BARANG_KAMI = daftarPenawaran.filter((p) => p.distributorId === distributorAktif.id)

interface Kelompok {
  umkmId: string
  nama: string
  kota: string
  daftar: PesananMasuk[]
}

/** Barang yang sedang berjalan di satu toko, digabung per penawaran. */
function ringkasBarang(daftar: PesananMasuk[]) {
  const peta = new Map<string, { nama: string; jumlah: number; satuan: string }>()
  for (const p of daftar) {
    for (const b of p.baris) {
      const ada = peta.get(b.penawaranId)
      if (ada) ada.jumlah += b.jumlah
      else peta.set(b.penawaranId, { nama: b.nama, jumlah: b.jumlah, satuan: b.satuan })
    }
  }
  return Array.from(peta.values()).sort((a, b) => b.jumlah - a.jumlah)
}

export default function LacakPesanan() {
  const [params, setParams] = useSearchParams()
  const keadaan: Keadaan = params.get('status') === 'selesai' ? 'selesai' : 'proses'

  const pesananMasuk = usePesananMasuk()
  const titik = useTitikPeta()

  const perKeadaan = useMemo(() => {
    function kelompokkan(k: Keadaan): Kelompok[] {
      const diterima = STATUS_PER_KEADAAN[k]
      const peta = new Map<string, PesananMasuk[]>()
      for (const p of pesananMasuk) {
        if (!diterima.includes(p.status)) continue
        peta.set(p.umkmId, [...(peta.get(p.umkmId) ?? []), p])
      }
      const hasil: Kelompok[] = []
      for (const [umkmId, daftar] of peta) {
        const umkm = umkmById(umkmId)
        if (!umkm) continue
        hasil.push({ umkmId, nama: umkm.nama, kota: umkm.kota, daftar })
      }
      return hasil.sort(
        (a, b) => b.daftar.length - a.daftar.length || a.nama.localeCompare(b.nama, 'id'),
      )
    }
    return { proses: kelompokkan('proses'), selesai: kelompokkan('selesai') }
  }, [pesananMasuk])

  const daftar = perKeadaan[keadaan]

  function gantiKeadaan(nilai: Keadaan) {
    const baru = new URLSearchParams(params)
    baru.set('status', nilai)
    setParams(baru, { replace: true })
  }

  return (
    <div className="pb-6">
      <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Lacak Pesanan</h1>
      <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed max-w-[70ch]">
        Dua keadaan: yang masih kamu kerjakan, dan yang sudah sampai. Tekan satu toko untuk melihat
        perjalanan barangnya atau penilaian yang mereka tulis.
      </p>

      {/* 1. Hitungan titik sebagai ringkasan sekaligus legenda peta */}
      <section aria-labelledby="judul-hitung" className="mt-4">
        <JudulBagian
          id="judul-hitung"
          judul="Sebaran hari ini"
          keterangan="Angka di dalam titik adalah jumlah pesanan. Warna selalu ditemani bentuk cincin dan keterangan."
        />
        <KartuHitungTitik titik={titik} />
      </section>

      {/* 2. Pintasan ke peta per barang. Peta memang selalu dibuka per barang:
             satu peta gabungan tidak bisa menjawab "barang mana yang menumpuk
             di sebelah mana", dan itu pertanyaan yang dipakai untuk mengatur
             muatan armada. */}
      <section aria-labelledby="judul-sebaran" className="mt-5">
        <JudulBagian
          id="judul-sebaran"
          judul="Sebaran per barang"
          keterangan="Buka petanya untuk melihat toko mana saja yang sedang memesan satu barang."
        />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
          {BARANG_KAMI.map((p) => (
            <Link
              key={p.id}
              to={`/distributor-portal/lacak/barang/${p.id}`}
              // relative: kalau nanti ada teks khusus pembaca layar di dalam
              // chip ini, ia harus berjangkar di sini — bukan lolos keluar dari
              // wadah gulir dan melebarkan halaman.
              className="relative shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 rounded-full text-[0.8125rem] font-semibold bg-surface text-ink-2 border border-line-strong transition-colors duration-150 hover:border-brand hover:text-brand"
            >
              <IkonLokasi size={16} />
              {p.nama}
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Dua keadaan */}
      <section aria-labelledby="judul-daftar" className="mt-5">
        <h2 id="judul-daftar" className="sr-only">
          Daftar toko per keadaan
        </h2>
        <TabSegmen<Keadaan>
          tab={[
            { nilai: 'proses', label: 'Sedang Diproses', jumlah: perKeadaan.proses.length },
            { nilai: 'selesai', label: 'Selesai', jumlah: perKeadaan.selesai.length },
          ]}
          aktif={keadaan}
          ubah={gantiKeadaan}
        />

        {daftar.length === 0 ? (
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul={
              keadaan === 'proses' ? 'Tidak ada yang sedang dikerjakan' : 'Belum ada yang selesai'
            }
            pesan={
              keadaan === 'proses'
                ? 'Semua pesanan yang sudah kamu terima sudah sampai di tujuan. Pesanan baru muncul di sini begitu kamu menerimanya.'
                : 'Pesanan pindah ke sini setelah barangnya sampai dan kamu tandai selesai.'
            }
            tingkat="h3"
            aksi={<TombolTautan ke="/distributor-portal/pesanan">Buka daftar pesanan</TombolTautan>}
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {daftar.map((g) => {
              const barang = ringkasBarang(g.daftar)
              const perStatus = STATUS_PER_KEADAAN[keadaan]
                .map((s) => ({ status: s, jumlah: g.daftar.filter((p) => p.status === s).length }))
                .filter((x) => x.jumlah > 0)
              return (
                <li key={g.umkmId}>
                  <KartuTautan ke={`/distributor-portal/lacak/toko/${g.umkmId}?status=${keadaan}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[1rem] font-bold text-ink leading-snug">{g.nama}</h3>
                        <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                          {g.kota} &middot; {angka(g.daftar.length)} pesanan
                        </p>
                      </div>
                      <span className="shrink-0 text-ink-3 mt-0.5" aria-hidden="true">
                        <IkonPanahKanan size={18} />
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {perStatus.map(({ status, jumlah }) => {
                        const Ikon = IKON_STATUS[status as 'disiapkan' | 'dikirim' | 'selesai']
                        return (
                          <Lencana
                            key={status}
                            nada={NADA_PESANAN_MASUK[status]}
                            ikon={<Ikon size={13} />}
                          >
                            {angka(jumlah)} {LABEL_PESANAN_MASUK[status]}
                          </Lencana>
                        )
                      })}
                    </div>

                    <ul className="mt-2.5 space-y-0.5">
                      {barang.map((b) => (
                        <li key={b.nama} className="text-[0.875rem] text-ink-2 leading-snug">
                          {b.nama}{' '}
                          <span className="text-ink-3">&middot; {jumlahSatuan(b.jumlah, b.satuan)}</span>
                        </li>
                      ))}
                    </ul>
                  </KartuTautan>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
