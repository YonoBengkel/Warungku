import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { JudulBagian, Kartu, Lencana, TombolTautan } from '@/components/ui/dasar'
import { PengaturJumlah } from '@/components/ui/formulir'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Penjelasan } from '@/components/ui/umpanBalik'
import { IkonInfo, IkonKontrak, IkonToko } from '@/icons'
import { angkaJumlah, cx, rupiah } from '@/lib/format'
import type { PaketKontrak, Penawaran } from '@/lib/types'
import { distributorById, paketUntukPenawaran, penawaranById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pilih Paket Kontrak.
 *
 * Layar ini hanya punya satu tugas: membuat kuota minimum bisa dibandingkan
 * dengan pemakaian nyata. Karena itu pemakaian per bulan dipasang di paling
 * atas sebagai patokan, dan kalau kami tidak punya datanya, pengguna yang
 * mengisi sendiri - bukan layar pembandingnya yang disembunyikan.
 *
 * Tidak ada paket yang terpilih otomatis, termasuk yang dilabeli "Paling pas
 * buat kamu". Label itu saran, bukan keputusan; keputusannya mengikat tiga
 * sampai enam bulan ke depan dan harus lahir dari ketukan yang disengaja.
 */

type NadaVonis = 'aman' | 'menipis' | 'netral'

/** Pemakaian bulanan barang gudang, diterjemahkan ke satuan jual distributor. */
function pemakaianDalamSatuanJual(pemakaianHarian: number, penawaran: Penawaran): number {
  const isi = penawaran.kemasanJual?.isi ?? 1
  return Math.round(((pemakaianHarian * 30) / isi) * 10) / 10
}

/** "Jun-Agu 2026": rentang tiga bulan penuh terakhir, untuk menyebut asal angka. */
function rentangTigaBulan(): string {
  const singkat = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const akhir = new Date()
  akhir.setDate(1)
  akhir.setMonth(akhir.getMonth() - 1)
  const awal = new Date(akhir)
  awal.setMonth(awal.getMonth() - 2)
  const tahun =
    awal.getFullYear() === akhir.getFullYear()
      ? `${akhir.getFullYear()}`
      : `${awal.getFullYear()}–${akhir.getFullYear()}`
  return `${singkat[awal.getMonth()]}–${singkat[akhir.getMonth()]} ${tahun}`
}

function vonisPaket(
  paket: PaketKontrak,
  pemakaian: number,
  satuan: string,
): { teks: string; nada: NadaVonis } | null {
  if (pemakaian <= 0) return null
  if (paket.kuotaMinPerBulan > pemakaian * 1.02) {
    return {
      nada: 'menipis',
      teks: `Ketat — kuota ${angkaJumlah(paket.kuotaMinPerBulan)} ${satuan} di atas pemakaianmu ${angkaJumlah(pemakaian)} ${satuan} per bulan`,
    }
  }
  if (paket.durasiBulan >= 4) {
    return { nada: 'netral', teks: `Murah tapi lama — kamu terikat ${paket.durasiBulan} bulan` }
  }
  return {
    nada: 'aman',
    teks: `Pas — kuota ${angkaJumlah(paket.kuotaMinPerBulan)} ${satuan} masih di bawah pemakaianmu ${angkaJumlah(pemakaian)} ${satuan} per bulan`,
  }
}

const KELAS_VONIS: Record<NadaVonis, string> = {
  aman: 'bg-aman-soft text-aman-ink',
  menipis: 'bg-menipis-soft text-menipis-ink',
  netral: 'bg-netral-soft text-netral-ink',
}

export default function PilihPaket() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()

  const penawaran = penawaranById(id)
  const distributor = penawaran ? distributorById(penawaran.distributorId) : undefined
  const paketKontrak = useAplikasi((s) => s.paketKontrak)
  const paket = useMemo(() => paketUntukPenawaran(id, paketKontrak), [id, paketKontrak])

  const daftarBarangGudang = useAplikasi((s) => s.barang)
  const kasir = useAplikasi((s) => s.kasir)
  const barang = daftarBarangGudang.find((b) => b.id === penawaran?.barangIdTerkait)

  const kasirHidup = kasir.sumber === 'kasir-digital' && kasir.status === 'terhubung'
  const bisaDihitung = Boolean(barang && barang.pemakaianHarian > 0 && barang.terhubungKasir && kasirHidup)

  const pemakaianSistem =
    barang && penawaran && bisaDihitung ? pemakaianDalamSatuanJual(barang.pemakaianHarian, penawaran) : 0

  /* Kolom pemakaian sengaja mulai dari nol saat datanya tidak ada. Mengisinya
     dengan tebakan kami sendiri akan membuat layar berikutnya menyebut angka
     karangan itu sebagai "pemakaianmu". Patokan kuota paket ditulis sebagai teks
     bantu saja, bukan sebagai isi kolom. */
  const dariUrl = Number(params.get('pakai') ?? 0)
  const [pakaiManual, setPakaiManual] = useState(dariUrl > 0 ? dariUrl : 0)

  const pemakaian = bisaDihitung ? pemakaianSistem : pakaiManual

  function ubahPakaiManual(n: number) {
    setPakaiManual(n)
    const baru = new URLSearchParams(params)
    if (n > 0) baru.set('pakai', String(n))
    else baru.delete('pakai')
    setParams(baru, { replace: true })
  }

  const tautanRincian = (paketId: string) =>
    `/penawaran/${id}/kontrak/${paketId}${pemakaian > 0 ? `?pakai=${pemakaian}` : ''}`

  /* Paling pas: kuota yang masih muat di bawah pemakaian, lalu harga termurah.
     Kalau tidak ada yang muat, yang kuotanya paling kecil - dan kalau beberapa
     paket kuotanya sama, yang durasinya paling pendek. Alasan yang kami tulis
     di bawah tabel adalah "paling kecil risikonya", jadi pemenang seri tidak
     boleh ditentukan harga: harga termurah justru mengunci paling lama. */
  const idPalingPas = useMemo(() => {
    if (paket.length === 0 || pemakaian <= 0) return null
    const muat = paket.filter((p) => p.kuotaMinPerBulan <= pemakaian * 1.02)
    const kandidat = muat.length > 0 ? muat : paket
    const urut = kandidat.slice().sort((a, b) => {
      if (muat.length > 0) {
        if (a.hargaSatuan !== b.hargaSatuan) return a.hargaSatuan - b.hargaSatuan
        return a.durasiBulan - b.durasiBulan
      }
      if (a.kuotaMinPerBulan !== b.kuotaMinPerBulan) return a.kuotaMinPerBulan - b.kuotaMinPerBulan
      return a.durasiBulan - b.durasiBulan
    })
    return { id: urut[0].id, muat: muat.length > 0, durasi: urut[0].durasiBulan }
  }, [paket, pemakaian])

  if (!penawaran || !distributor) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Pilih Paket Kontrak" kembaliKe="/belanja" />
        <Kartu className="mt-6">
          <h2 className="sr-only">Paket kontrak tidak ditemukan</h2>
          <KeadaanKosong
            ikon={<IkonToko size={26} />}
            judul="Penawaran ini sudah tidak ada"
            pesan="Barangnya sudah tidak dijual, jadi paketnya ikut hilang. Cari di distributor lain."
            aksi={<TombolTautan ke="/belanja">Cari barang di Distributor</TombolTautan>}
          />
        </Kartu>
      </div>
    )
  }

  if (paket.length === 0) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Pilih Paket Kontrak" kembaliKe={`/penawaran/${id}`} />
        <Kartu className="mt-6">
          <h2 className="sr-only">Paket kontrak yang tersedia</h2>
          <KeadaanKosong
            ikon={<IkonKontrak size={26} />}
            judul="Belum ada paket kontrak untuk barang ini"
            pesan="Kamu tetap bisa beli sekali sebanyak yang kamu butuhkan."
            aksi={<TombolTautan ke={`/penawaran/${id}`}>Kembali ke penawaran</TombolTautan>}
            aksiKedua={
              <TombolTautan ke={`/belanja?cari=${encodeURIComponent(penawaran.nama)}`} ragam="garis">
                Cari distributor lain
              </TombolTautan>
            }
          />
        </Kartu>
      </div>
    )
  }

  const satuan = penawaran.satuan
  const barisTabel: Array<{ label: string; isi: (p: PaketKontrak) => string; tebal?: boolean }> = [
    { label: 'Durasi', isi: (p) => `${p.durasiBulan} bulan` },
    { label: 'Minimal ambil per bulan', isi: (p) => `${angkaJumlah(p.kuotaMinPerBulan)} ${satuan}` },
    {
      label: 'TOTAL wajib diambil selama kontrak',
      isi: (p) => `${angkaJumlah(p.kuotaMinPerBulan * p.durasiBulan)} ${satuan}`,
      tebal: true,
    },
    { label: 'Harga per satuan', isi: (p) => `${rupiah(p.hargaSatuan)}/${satuan}` },
    {
      label: 'Hemat dibanding beli sekali',
      isi: (p) =>
        p.hematPersen === 0
          ? 'Sama dengan harga beli sekali'
          : `${p.hematPersen}% · hemat ${rupiah((penawaran.hargaSatuan - p.hargaSatuan) * p.kuotaMinPerBulan * p.durasiBulan)}`,
    },
    {
      label: 'Perkiraan total belanja',
      isi: (p) => rupiah(p.hargaSatuan * p.kuotaMinPerBulan * p.durasiBulan),
      tebal: true,
    },
  ]

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Pilih Paket Kontrak"
        keterangan={`${penawaran.nama} · ${distributor.nama}`}
        kembaliKe={`/penawaran/${id}`}
      />

      {/* Pita patokan pemakaian */}
      {bisaDihitung ? (
        <div className="mt-4 rounded-md bg-brand-soft text-brand-soft-ink px-3.5 py-3 flex items-start gap-2.5">
          <IkonInfo size={18} className="shrink-0 mt-px" />
          <p className="text-isi leading-relaxed">
            Pemakaianmu sekitar{' '}
            <strong>
              {angkaJumlah(pemakaian)} {satuan}/bulan
            </strong>{' '}
            (rata-rata 3 bulan terakhir, {rentangTigaBulan()}), patokan kuota di bawah.
          </p>
        </div>
      ) : (
        <Kartu className="mt-4">
          <h2 className="text-kartu font-bold text-ink">Kira-kira berapa kamu pakai per bulan?</h2>
          <p className="mt-1 text-isi text-ink-3 leading-relaxed">
            Isi kira-kira saja; angka ini hanya untuk membandingkan kuota.
          </p>
          <Penjelasan label="Kenapa diminta?">
            {barang
              ? 'Data pemakaian dari kasir belum cukup untuk barang ini.'
              : 'Barang ini belum ada di daftar stok kamu, jadi riwayat pemakaiannya belum ada.'}{' '}
            Angka yang kamu isi tidak disimpan sebagai data pemakaian.
          </Penjelasan>
          <div className="mt-3">
            <PengaturJumlah
              nilai={pakaiManual}
              ubah={ubahPakaiManual}
              min={0}
              langkah={5}
              satuan={`${satuan}/bulan`}
              label="Pemakaian per bulan"
            />
          </div>
          {pakaiManual > 0 ? (
            <div className="mt-2.5">
              <Lencana nada="netral" besar>
                Perkiraan kamu: {angkaJumlah(pakaiManual)} {satuan}/bulan
              </Lencana>
            </div>
          ) : (
            <p className="mt-2.5 text-isi text-ink-3 leading-relaxed">
              Paket di bawah minta {angkaJumlah(Math.min(...paket.map((p) => p.kuotaMinPerBulan)))}&ndash;
              {angkaJumlah(Math.max(...paket.map((p) => p.kuotaMinPerBulan)))} {satuan} per bulan; selama kolom ini nol,
              belum ada yang dinilai.
            </p>
          )}
        </Kartu>
      )}

      {/* Judul bagian ini bukan hiasan: tanpa dia, urutan judul layar melompat
          dari judul halaman langsung ke kode paket di dalam kartu. */}
      <div className="mt-5">
        <JudulBagian
          judul={`Bandingkan ${paket.length} paket kontrak`}
          keterangan={
            pemakaian > 0
              ? `Semua ditimbang terhadap pemakaianmu ${angkaJumlah(pemakaian)} ${satuan}/bulan.`
              : 'Isi dulu perkiraan pemakaianmu di atas supaya tiap paket bisa dinilai.'
          }
        />
      </div>

      {/* Mobile: lima kartu yang digeser. Tabel tidak pernah muncul di HP. */}
      <div className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 snap-x snap-mandatory pb-1">
          {paket.map((p) => {
            const v = vonisPaket(p, pemakaian, satuan)
            const pas = idPalingPas?.id === p.id
            return (
              <div
                key={p.id}
                className={cx(
                  'shrink-0 w-[17rem] snap-start bg-surface border rounded-lg p-4 shadow-e1',
                  pas ? 'border-brand' : 'border-line',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[1rem] font-extrabold text-ink">{p.kode}</h3>
                  {pas && <Lencana nada="merek">Paling pas buat kamu</Lencana>}
                </div>

                <dl className="mt-3 divide-y divide-line">
                  {barisTabel.map((b) => (
                    <div key={b.label} className="py-2">
                      <dt className="text-kecil text-ink-3 leading-snug">{b.label}</dt>
                      <dd
                        className={cx(
                          'mt-0.5 text-ink',
                          b.tebal ? 'text-[1rem] font-extrabold' : 'text-kartu font-semibold',
                        )}
                      >
                        {b.isi(p)}
                      </dd>
                    </div>
                  ))}
                </dl>

                {v && (
                  <p className={cx('mt-3 rounded-sm px-2.5 py-2 text-isi font-semibold leading-snug', KELAS_VONIS[v.nada])}>
                    {v.teks}
                  </p>
                )}

                <TombolTautan ke={tautanRincian(p.id)} ragam={pas ? 'utama' : 'garis'} penuh className="mt-3">
                  Lihat Rincian
                </TombolTautan>
              </div>
            )
          })}
        </div>
      </div>

      {/* Desktop: tabel lima kolom, menggulir di dalam wadahnya sendiri */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-line bg-surface shadow-e1">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Perbandingan {paket.length} paket kontrak {penawaran.nama} dari {distributor.nama}: durasi, kuota
            minimal per bulan, total wajib diambil, harga per satuan, penghematan, dan perkiraan total belanja.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="p-3.5 text-isi font-semibold text-ink-3 w-[17rem]">
                Rincian paket
              </th>
              {paket.map((p) => {
                const pas = idPalingPas?.id === p.id
                return (
                  <th
                    key={p.id}
                    scope="col"
                    className={cx('p-3.5 align-top', pas && 'bg-brand-soft')}
                  >
                    <span className="block text-[1rem] font-extrabold text-ink">{p.kode}</span>
                    {/* text-ink-2, bukan ink-3: di kolom bertanda "paling pas"
                        latarnya bg-brand-soft dan ink-3 jatuh di bawah 4,5:1. */}
                    <span className="block text-kecil font-normal text-ink-2 mt-0.5">
                      {p.durasiBulan} bulan
                    </span>
                    {pas && (
                      <span className="mt-1.5 inline-block">
                        <Lencana nada="merek">Paling pas buat kamu</Lencana>
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {barisTabel.map((b) => (
              <tr key={b.label} className="border-b border-line">
                <th scope="row" className="p-3.5 text-isi font-medium text-ink-2 align-top">
                  {b.label}
                </th>
                {paket.map((p) => (
                  <td
                    key={p.id}
                    className={cx(
                      'p-3.5 align-top text-ink tabular',
                      b.tebal ? 'text-[1rem] font-extrabold' : 'text-kartu font-semibold',
                      idPalingPas?.id === p.id && 'bg-brand-soft',
                    )}
                  >
                    {b.isi(p)}
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-b border-line">
              <th scope="row" className="p-3.5 text-isi font-medium text-ink-2 align-top">
                Cocok tidak buat kamu
              </th>
              {paket.map((p) => {
                const v = vonisPaket(p, pemakaian, satuan)
                return (
                  <td key={p.id} className={cx('p-3.5 align-top', idPalingPas?.id === p.id && 'bg-brand-soft')}>
                    {v ? (
                      <span
                        className={cx(
                          'inline-block rounded-sm px-2.5 py-2 text-isi font-semibold leading-snug',
                          KELAS_VONIS[v.nada],
                        )}
                      >
                        {v.teks}
                      </span>
                    ) : (
                      <span className="text-isi text-ink-3">
                        Isi dulu perkiraan pemakaianmu di atas supaya bisa dibandingkan.
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>

            <tr>
              <th scope="row" className="p-3.5 text-isi font-medium text-ink-2 align-top">
                Langkah berikutnya
              </th>
              {paket.map((p) => (
                <td key={p.id} className={cx('p-3.5 align-top', idPalingPas?.id === p.id && 'bg-brand-soft')}>
                  <TombolTautan ke={tautanRincian(p.id)} ragam={idPalingPas?.id === p.id ? 'utama' : 'garis'} penuh>
                    Lihat Rincian
                  </TombolTautan>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Alasan satu baris untuk label "Paling pas buat kamu" */}
      {idPalingPas && (
        <>
          <p className="mt-3 text-isi text-ink-2 leading-relaxed px-1">
            Label &ldquo;Paling pas&rdquo; hanya saran; tidak ada paket terpilih sampai kamu menekannya.
          </p>
          <Penjelasan label="Kenapa paling pas?" className="px-1">
            {idPalingPas.muat
              ? `Kuotanya masih di bawah pemakaianmu ${angkaJumlah(pemakaian)} ${satuan}/bulan dan harganya paling murah di antara paket yang muat.`
              : `Semua paket kuotanya di atas pemakaianmu ${angkaJumlah(pemakaian)} ${satuan}/bulan, jadi yang ditandai adalah kuota terkecil dengan ikatan terpendek (${idPalingPas.durasi} bulan), paling kecil risikonya kalau bulan sepi datang.`}
          </Penjelasan>
        </>
      )}

      {/* Catatan tetap di bawah */}
      <p className="mt-4 rounded-md bg-sunken px-3.5 py-3 text-isi text-ink-2 leading-relaxed">
        Kalau bulan ramai dan bulan sepi kamu beda jauh, ambil durasi lebih pendek.
      </p>

      <p className="mt-3 text-isi text-ink-3 leading-relaxed px-1">
        Angka hemat hanya berlaku kalau kuotanya benar-benar terpakai.
      </p>
      <Penjelasan label="Cara dihitung" className="px-1">
        Selisih harga beli sekali sekarang ({rupiah(penawaran.hargaSatuan)}/{satuan}) dengan harga paket, dikalikan
        total yang wajib kamu ambil.
      </Penjelasan>
    </div>
  )
}
