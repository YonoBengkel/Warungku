import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { HasilHitung } from '@/pages/stok/HitungStok'
import { Kartu, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Konfirmasi } from '@/components/ui/lembar'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentangLingkaran, IkonKotak } from '@/icons'
import { angka, cx, jumlahSatuan, rupiah } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Ringkasan hasil hitung fisik.
 *
 * Satu tombol, satu keputusan: terapkan semuanya atau tidak sama sekali. Kalau
 * pengguna boleh memilih selisih mana yang dipakai, hasil hitungnya berhenti
 * jadi potret rak dan berubah jadi daftar keinginan, dan riwayatnya tidak bisa
 * lagi dibaca sebagai satu kejadian.
 *
 * Nilai rupiah di sini memakai harga BELI terakhir, bukan harga jual. Harga
 * jual ada di aplikasi kasir dan bukan milik kami.
 */

interface KeadaanRute {
  hasil?: HasilHitung[]
  jumlahDilewati?: number
}

export default function HitungRingkasan() {
  const lokasi = useLocation()
  const navigate = useNavigate()
  const terapkanHitungFisik = useAplikasi((s) => s.terapkanHitungFisik)
  const [konfirmasi, setKonfirmasi] = useState(false)

  const keadaan = (lokasi.state ?? null) as KeadaanRute | null
  const hasil = useMemo(() => keadaan?.hasil ?? [], [keadaan])
  const dilewati = keadaan?.jumlahDilewati ?? 0

  const berselisih = useMemo(() => hasil.filter((h) => h.nyata !== h.sistem), [hasil])
  const cocok = hasil.length - berselisih.length
  const nilaiSelisih = berselisih.reduce(
    (a, h) => a + Math.abs(h.nyata - h.sistem) * h.hargaBeliTerakhir,
    0,
  )

  function terapkan() {
    const peta: Record<string, number> = {}
    for (const h of hasil) peta[h.barangId] = h.nyata
    terapkanHitungFisik(peta)
    navigate('/stok')
  }

  /* ---------------------------------------------------------------- */
  /* Dibuka langsung tanpa melewati layar hitung                       */
  /* ---------------------------------------------------------------- */

  if (hasil.length === 0) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Ringkasan Hasil Hitung" kembaliKe="/stok/hitung" />
        {/* KeadaanKosong menulis judulnya sebagai h3; h2 ini menjaga urutan
            judul halaman supaya tidak melompat dari h1 ke h3. */}
        <h2 className="sr-only">Belum ada hasil hitung</h2>
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul={
            dilewati > 0 ? 'Semua barang tadi kamu lewati' : 'Belum ada hasil hitung untuk ditampilkan'
          }
          pesan={
            dilewati > 0
              ? `${angka(dilewati)} barang dilewati tanpa diisi angkanya, jadi tidak ada selisih yang bisa diterapkan. Mulai lagi kalau kamu sudah sempat menghitung raknya.`
              : 'Halaman ini menampilkan hasil dari layar Hitung Stok. Karena belum ada barang yang dihitung, belum ada selisih yang bisa diterapkan.'
          }
          aksi={<TombolTautan ke="/stok/hitung">Mulai Hitung Stok</TombolTautan>}
          aksiKedua={
            <TombolTautan ke="/stok" ragam="garis">
              Kembali ke Stok
            </TombolTautan>
          }
        />
      </div>
    )
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Ringkasan Hasil Hitung"
        keterangan={`${angka(hasil.length)} barang dihitung`}
        kembaliKe="/stok/hitung"
      />

      {/* Di layar lebar tabel selisih memakai kolom kiri yang lebar, sementara
          penjelasan dan catatan pindah ke kolom kanan. Keduanya sama-sama perlu
          terlihat sebelum tombol terapkan ditekan. */}
      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-8 max-w-3xl">
        <Kartu>
          <p className="text-[1.125rem] font-extrabold text-ink leading-snug">
            {berselisih.length === 0 ? (
              'Semua angka cocok dengan catatan sistem'
            ) : (
              <>
                Selisih ditemukan pada {angka(berselisih.length)} barang &middot; Total nilai selisih{' '}
                {rupiah(nilaiSelisih)}
              </>
            )}
          </p>
          <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">
            {berselisih.length === 0
              ? 'Tidak ada yang perlu dikoreksi, tapi hasil hitung tetap dicatat supaya kamu punya bukti kapan terakhir rak diperiksa.'
              : `Nilai dihitung dari harga beli terakhir, bukan harga jual.${
                  dilewati > 0 ? ` ${angka(dilewati)} barang kamu lewati tanpa diisi.` : ''
                }`}
          </p>
        </Kartu>

        {berselisih.length > 0 && (
          <>
            <h2 className="mt-6 mb-3 text-[0.9375rem] font-bold text-ink">Barang yang berselisih</h2>

            {/* Mobile: kartu satu kolom. Tabel baru muncul di layar lebar. */}
            <ul className="space-y-2.5 lg:hidden">
              {berselisih.map((h) => {
                const beda = Math.round((h.nyata - h.sistem) * 100) / 100
                return (
                  <li key={h.barangId} className="bg-surface border border-line rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[1rem] font-semibold text-ink leading-snug min-w-0">
                        {h.nama}
                      </p>
                      <Lencana nada={beda < 0 ? 'kritis' : 'info'}>
                        {beda > 0 ? '+' : '−'}
                        {jumlahSatuan(Math.abs(beda), h.satuan)}
                      </Lencana>
                    </div>
                    <p className="mt-1.5 text-[0.8125rem] text-ink-2">
                      Catatan sistem {jumlahSatuan(h.sistem, h.satuan)} &rarr; hasil hitung{' '}
                      <strong className="text-ink">{jumlahSatuan(h.nyata, h.satuan)}</strong>
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-3">
                      Nilai selisih {rupiah(Math.abs(beda) * h.hargaBeliTerakhir)}
                    </p>
                  </li>
                )
              })}
            </ul>

            <div className="hidden lg:block overflow-x-auto border border-line rounded-lg bg-surface">
              <table className="w-full text-left border-collapse">
                <caption className="sr-only">
                  Daftar barang yang angkanya berbeda antara catatan sistem dan hasil hitung fisik
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2">
                      Barang
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Catatan sistem
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Hasil hitung
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Selisih
                    </th>
                    <th scope="col" className="px-4 py-3 text-[0.8125rem] font-bold text-ink-2 text-right">
                      Nilai selisih
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {berselisih.map((h) => {
                    const beda = Math.round((h.nyata - h.sistem) * 100) / 100
                    return (
                      <tr key={h.barangId} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 text-[0.9375rem] font-semibold text-ink">{h.nama}</td>
                        <td className="px-4 py-3 text-[0.875rem] text-ink-2 text-right tabular">
                          {jumlahSatuan(h.sistem, h.satuan)}
                        </td>
                        <td className="px-4 py-3 text-[0.875rem] font-bold text-ink text-right tabular">
                          {jumlahSatuan(h.nyata, h.satuan)}
                        </td>
                        <td
                          className={cx(
                            'px-4 py-3 text-[0.875rem] font-bold text-right tabular',
                            beda < 0 ? 'text-kritis' : 'text-info',
                          )}
                        >
                          {beda > 0 ? '+' : '−'}
                          {jumlahSatuan(Math.abs(beda), h.satuan)}
                        </td>
                        <td className="px-4 py-3 text-[0.875rem] text-ink-2 text-right tabular">
                          {rupiah(Math.abs(beda) * h.hargaBeliTerakhir)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        </div>

        <div className="lg:col-span-4 mt-4 lg:mt-0 space-y-3">
          {cocok > 0 && (
            <p className="flex items-center gap-2 text-[0.875rem] text-aman-ink bg-aman-soft rounded-md px-3.5 py-2.5">
              <IkonCentangLingkaran size={17} className="shrink-0" />
              {angka(cocok)} barang cocok dengan catatan sistem.
            </p>
          )}

          <Peringatan nada="netral" judul="Yang terjadi setelah diterapkan">
            Semua perubahan ini masuk riwayat sebagai satu kelompok beralasan &ldquo;Hasil hitung
            fisik&rdquo;, bukan sebagai penjualan. Selisih ini tidak ikut dipakai menyusun perkiraan
            kebutuhan.
          </Peringatan>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          berselisih.length > 0 ? (
            <p className="text-[0.8125rem] text-ink-2">
              {angka(berselisih.length)} angka stok akan diperbarui begitu kamu menerapkannya.
            </p>
          ) : undefined
        }
      >
        <Tombol penuh ukuran="besar" onClick={() => setKonfirmasi(true)}>
          Terapkan hasil hitung
        </Tombol>
      </BilahAksi>

      <Konfirmasi
        terbuka={konfirmasi}
        tutup={() => setKonfirmasi(false)}
        judul="Terapkan hasil hitung?"
        labelSetuju="Ya, terapkan"
        labelBatal="Periksa lagi"
        onSetuju={terapkan}
        pesan={
          berselisih.length === 0
            ? 'Tidak ada angka yang berubah. Hasil hitung tetap dicatat sebagai bukti pemeriksaan rak hari ini.'
            : `Angka stok ${angka(berselisih.length)} barang akan mengikuti hasil hitungmu. Setelah ini, catatan lama tidak dipakai lagi, tapi jejaknya tetap bisa dilihat di riwayat tiap barang.`
        }
      />
    </div>
  )
}
