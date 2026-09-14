import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AlasanKoreksi } from '@/lib/types'
import { ALASAN_KOREKSI } from '@/lib/types'
import { Kartu, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { AreaTeks, PengaturJumlah } from '@/components/ui/formulir'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import {
  IkonCari,
  IkonGudang,
  IkonJam,
  IkonKirim,
  IkonKotak,
  IkonPanahAtas,
  IkonPanahBawah,
  IkonPasokan,
  IkonPena,
  IkonPeringatan,
  IkonProfil,
  IkonSilang,
  IkonTiga,
  IkonToko,
  IkonTrenTurun,
  IkonUnggah,
} from '@/icons'
import { cx, jumlahSatuan, rupiah } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Koreksi stok beralasan sekali-ketuk.
 *
 * Alasan bukan basa-basi administratif: ia yang memisahkan "barang terjual"
 * dari "barang terbuang". Kalau susut ikut terbaca sebagai permintaan, saran
 * belanja terus membesar dan barang justru makin banyak yang basi. Karena itu
 * layar ini tidak pernah menyediakan jalan pintas "koreksi tanpa alasan".
 *
 * Tiga langkah sengaja ditaruh di satu halaman yang sama, terbuka berurutan,
 * supaya pemilik selalu melihat keputusan yang sudah diambil di atasnya.
 */

const IKON_ALASAN: Record<AlasanKoreksi, ReactNode> = {
  basi: <IkonJam size={20} />,
  rusak: <IkonPeringatan size={20} />,
  susut: <IkonTrenTurun size={20} />,
  'dipakai-sendiri': <IkonProfil size={20} />,
  hilang: <IkonCari size={20} />,
  diretur: <IkonKirim size={20} />,
  'salah-catat': <IkonPena size={20} />,
  'barang-datang': <IkonPasokan size={20} />,
  'retur-pelanggan': <IkonToko size={20} />,
  pindahan: <IkonGudang size={20} />,
  lainnya: <IkonTiga size={20} />,
}

/**
 * Urutan alasan dikunci mengikuti spesifikasi, bukan urutan kunci objek.
 * "Salah catat sebelumnya" sengaja muncul di kedua arah walaupun tersimpan
 * sebagai alasan pengurangan: angka yang keliru bisa kelebihan maupun kekurangan.
 * "Alasan lain" selalu paling bawah karena ia yang paling mahal untuk diisi.
 */
const URUTAN_ALASAN: Record<'kurang' | 'tambah', AlasanKoreksi[]> = {
  kurang: ['basi', 'rusak', 'susut', 'dipakai-sendiri', 'hilang', 'diretur', 'salah-catat', 'lainnya'],
  tambah: ['barang-datang', 'retur-pelanggan', 'salah-catat', 'pindahan', 'lainnya'],
}

export default function StokKoreksi() {
  const { id = '' } = useParams()
  const navigasi = useNavigate()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))
  const koreksiStok = useAplikasi((s) => s.koreksiStok)

  const [arah, setArah] = useState<'kurang' | 'tambah' | null>(null)
  const [alasan, setAlasan] = useState<AlasanKoreksi | null>(null)
  const [jumlah, setJumlah] = useState(0)
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState<string[]>([])
  const [dicoba, setDicoba] = useState(false)
  const berkasRef = useRef<HTMLInputElement>(null)

  /* Langkah ukur menyesuaikan satuan: menekan tombol 100 kali untuk 1 kg
     gula yang disimpan dalam gram adalah siksaan yang tidak perlu. */
  const langkah = useMemo(() => {
    if (!barang) return 1
    return barang.satuan === 'gram' || barang.satuan === 'ml' ? 50 : 1
  }, [barang])

  if (!barang) {
    return (
      <>
        <KepalaHalaman judul="Koreksi Stok" kembaliKe="/stok" />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini tidak ada di daftar stok"
          pesan="Koreksi hanya bisa disimpan untuk barang yang sudah tercatat. Daftar stok yang sekarang masih lengkap."
          aksi={<TombolTautan ke="/stok">Kembali ke Daftar Stok</TombolTautan>}
        />
      </>
    )
  }

  const info = alasan ? ALASAN_KOREKSI[alasan] : null
  const selisih = arah === 'kurang' ? -jumlah : jumlah
  const stokSesudah = Math.max(0, Math.round((barang.stok + selisih) * 100) / 100)
  const wajibCatatan = info?.wajibCatatan === true
  const catatanKosong = catatan.trim().length === 0

  const galatJumlah =
    dicoba && jumlah <= 0
      ? `Isi dulu berapa banyak stok yang ${arah === 'tambah' ? 'bertambah' : 'berkurang'}. Angkanya harus lebih dari 0. Contoh: 2.`
      : undefined
  const galatCatatan =
    dicoba && wajibCatatan && catatanKosong
      ? 'Alasan lain wajib ditulis supaya riwayatnya masih bisa dipahami bulan depan. Tulis satu kalimat pendek. Contoh: Dipinjam cabang Godean.'
      : undefined

  /* Ditulis sebagai const supaya penjagaan "barang tidak ditemukan" di atas
     tetap berlaku di dalam penangan ini. */
  const simpan = () => {
    setDicoba(true)
    if (!alasan || jumlah <= 0) return
    if (wajibCatatan && catatanKosong) return
    const keterangan = [catatan.trim(), foto.length > 0 ? `${foto.length} foto dilampirkan` : '']
      .filter(Boolean)
      .join(' · ')
    koreksiStok(barang.id, selisih, alasan, keterangan || ALASAN_KOREKSI[alasan].label)
    navigasi(`/stok/${barang.id}`)
  }

  return (
    <div className="pb-8">
      <KepalaHalaman judul="Koreksi Stok" keterangan={barang.nama} kembaliKe={`/stok/${barang.id}`} />

      <div className="mt-4 max-w-2xl mx-auto space-y-4">
        <Kartu padat>
          <p className="text-[0.8125rem] text-ink-3">Stok tercatat sekarang</p>
          <p className="mt-0.5 text-[1.5rem] font-extrabold text-ink leading-none">
            {jumlahSatuan(Math.max(0, barang.stok), barang.satuan)}
          </p>
        </Kartu>

        {/* ---------- Langkah 1 ---------- */}
        <section aria-labelledby="langkah-1">
          <JudulLangkah nomor={1} id="langkah-1" teks="Stoknya berkurang atau bertambah?" />
          <div className="grid grid-cols-2 gap-2.5">
            <TombolArah
              aktif={arah === 'kurang'}
              onClick={() => {
                setArah('kurang')
                setAlasan(null)
                setDicoba(false)
              }}
              ikon={<IkonPanahBawah size={22} />}
              judul="Stok berkurang"
              keterangan="Basi, rusak, susut, hilang"
              nada="kritis"
            />
            <TombolArah
              aktif={arah === 'tambah'}
              onClick={() => {
                setArah('tambah')
                setAlasan(null)
                setDicoba(false)
              }}
              ikon={<IkonPanahAtas size={22} />}
              judul="Stok bertambah"
              keterangan="Barang datang, retur, pindahan"
              nada="aman"
            />
          </div>
        </section>

        {/* ---------- Langkah 2 ---------- */}
        {arah && (
          <section aria-labelledby="langkah-2" className="anim-muncul">
            <JudulLangkah nomor={2} id="langkah-2" teks="Kenapa stoknya berubah?" />
            <div className="grid grid-cols-2 gap-2.5">
              {URUTAN_ALASAN[arah].map((k) => {
                const a = ALASAN_KOREKSI[k]
                const terpilih = alasan === k
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={terpilih}
                    onClick={() => {
                      setAlasan(k)
                      setDicoba(false)
                    }}
                    className={cx(
                      'min-h-[5.5rem] rounded-lg border-2 p-3 text-left transition-[border-color,background-color]',
                      k === 'lainnya' && 'col-span-2',
                      terpilih
                        ? 'border-brand bg-brand-soft/40'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <span
                      className={cx(
                        'inline-grid place-items-center size-9 rounded-md mb-1.5',
                        terpilih ? 'bg-brand text-ink-inverse' : 'bg-sunken text-ink-2',
                      )}
                    >
                      {IKON_ALASAN[k]}
                    </span>
                    <span className="block text-[0.875rem] font-bold text-ink leading-snug">{a.label}</span>
                    {/* text-ink-3 di atas latar berwarna lembut jatuh di bawah
                        ambang keterbacaan; ink-2 aman di terang dan gelap. */}
                    <span className="block mt-0.5 text-[0.75rem] text-ink-2 leading-snug">
                      {a.kerugian ? 'Dihitung kerugian' : 'Tidak dihitung kerugian'}
                    </span>
                  </button>
                )
              })}
            </div>

            <Peringatan nada="netral" className="mt-3">
              <strong>Salah catat</strong> tidak dihitung kerugian karena barangnya memang tidak pernah hilang,
              hanya angkanya yang keliru. <strong>Basi, rusak, hilang, dan susut</strong> dihitung kerugian
              memakai harga beli terakhir, {rupiah(barang.hargaBeliTerakhir)} per {barang.satuan}. Semua alasan
              selain penjualan dikeluarkan dari data yang kami pakai menyusun perkiraan, supaya saran belanja
              tidak ikut membesar gara-gara barang yang terbuang.
            </Peringatan>
          </section>
        )}

        {/* ---------- Langkah 3 ---------- */}
        {arah && alasan && (
          <section aria-labelledby="langkah-3" className="anim-muncul">
            <JudulLangkah nomor={3} id="langkah-3" teks="Berapa banyak?" />
            <Kartu>
              <PengaturJumlah
                nilai={jumlah}
                ubah={setJumlah}
                langkah={langkah}
                min={0}
                maks={arah === 'kurang' ? Math.max(0, barang.stok) : 999_999}
                satuan={barang.satuan}
                label="Jumlah koreksi"
              />
              {galatJumlah && (
                <p className="mt-2 text-[0.8125rem] text-kritis font-medium leading-snug">{galatJumlah}</p>
              )}
              {arah === 'kurang' && jumlah >= barang.stok && barang.stok > 0 && (
                <p className="mt-2 text-[0.8125rem] text-ink-3 leading-snug">
                  Paling banyak {jumlahSatuan(barang.stok, barang.satuan)}, sebanyak stok yang tercatat. Kalau
                  kenyataannya lebih sedikit lagi, pakai Hitung Stok supaya angkanya diluruskan sekalian.
                </p>
              )}

              <div className="mt-4">
                <AreaTeks
                  label="Catatan"
                  wajib={wajibCatatan}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Kulkas mati semalam, dua liter terpaksa dibuang."
                  bantuan="Catatan ini yang kamu baca bulan depan saat mencari tahu ke mana perginya stok."
                  galat={galatCatatan}
                />
              </div>

              <div className="mt-4">
                <p className="text-[0.8125rem] font-semibold text-ink-2 mb-1.5">
                  Foto <span className="text-ink-3 font-normal">(boleh dikosongkan)</span>
                </p>
                <input
                  ref={berkasRef}
                  id="foto-koreksi"
                  type="file"
                  accept="image/*"
                  multiple
                  aria-label="Pilih foto barang yang dikoreksi"
                  className="sr-only"
                  onChange={(e) => {
                    const nama = Array.from(e.target.files ?? []).map((f) => f.name)
                    if (nama.length > 0) setFoto((lama) => [...lama, ...nama].slice(0, 4))
                    e.target.value = ''
                  }}
                />
                <Tombol
                  ragam="garis"
                  ukuran="kecil"
                  ikonKiri={<IkonUnggah size={15} />}
                  onClick={() => berkasRef.current?.click()}
                >
                  Tambah foto
                </Tombol>
                {foto.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {foto.map((f, i) => (
                      <li key={`${f}-${i}`}>
                        <span className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-sm bg-sunken text-[0.75rem] font-semibold text-ink-2">
                          {f}
                          <button
                            type="button"
                            aria-label={`Hapus foto ${f}`}
                            onClick={() => setFoto((lama) => lama.filter((_, j) => j !== i))}
                            className="size-6 grid place-items-center rounded hover:bg-line"
                          >
                            <IkonSilang size={14} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-[0.8125rem] text-ink-3 leading-snug">
                  Foto membantu kalau nanti kamu mau menuntut penggantian ke distributor.
                </p>
              </div>
            </Kartu>
          </section>
        )}

        {/* ---------- Ringkasan & simpan ---------- */}
        {arah && alasan && (
          <Kartu className="anim-muncul">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.8125rem] text-ink-2">Setelah disimpan</p>
                {/* "Stok jadi 3.400 gram dari 3.400 gram" adalah kalimat kosong.
                    Selama jumlahnya belum diisi, tulis saja apa yang kurang. */}
                <p className="mt-0.5 text-[1.25rem] font-extrabold text-ink leading-tight">
                  {jumlah > 0
                    ? `Stok jadi ${jumlahSatuan(stokSesudah, barang.satuan)} dari ${jumlahSatuan(
                        Math.max(0, barang.stok),
                        barang.satuan,
                      )}`
                    : 'Tinggal isi jumlahnya di langkah 3'}
                </p>
              </div>
              <Lencana nada={info?.kerugian ? 'kritis' : 'netral'} besar>
                {info?.kerugian ? 'Dihitung kerugian' : 'Tidak dihitung kerugian'}
              </Lencana>
            </div>

            {info?.kerugian && jumlah > 0 && (
              <p className="mt-2 text-[0.875rem] text-ink-2">
                Nilai kerugiannya{' '}
                <strong className="text-kritis">{rupiah(jumlah * barang.hargaBeliTerakhir)}</strong>, memakai
                harga beli terakhir.
              </p>
            )}

            {/* Pesan galat di langkah 3 bisa satu layar di atas tombol ini. Di
                HP itu artinya tombol terasa mati tanpa keterangan. */}
            {(galatJumlah || galatCatatan) && (
              <p className="mt-3 text-[0.8125rem] font-semibold text-kritis leading-snug">
                Belum bisa disimpan: {galatJumlah ? 'jumlahnya belum diisi' : ''}
                {galatJumlah && galatCatatan ? ' dan ' : ''}
                {galatCatatan ? 'catatannya belum ditulis' : ''}. Keterangannya ada di langkah 3 di atas.
              </p>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
              <Tombol penuh onClick={simpan}>
                Simpan Koreksi
              </Tombol>
              <TombolTautan ke={`/stok/${barang.id}`} ragam="garis" penuh>
                Batal
              </TombolTautan>
            </div>
          </Kartu>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Potongan khusus halaman ini                                        */
/* ================================================================== */

function JudulLangkah({ nomor, teks, id }: { nomor: number; teks: string; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 mb-3">
      <span className="size-7 shrink-0 rounded-full bg-ink text-ink-inverse grid place-items-center text-[0.8125rem] font-bold">
        {nomor}
      </span>
      <span className="text-[1rem] font-bold text-ink leading-tight">{teks}</span>
    </h2>
  )
}

function TombolArah({
  aktif,
  onClick,
  ikon,
  judul,
  keterangan,
  nada,
}: {
  aktif: boolean
  onClick: () => void
  ikon: ReactNode
  judul: string
  keterangan: string
  nada: 'kritis' | 'aman'
}) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cx(
        'min-h-[7rem] rounded-lg border-2 p-3.5 text-left transition-[border-color,background-color]',
        aktif
          ? nada === 'kritis'
            ? 'border-kritis bg-kritis-soft'
            : 'border-aman bg-aman-soft'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span
        className={cx(
          'inline-grid place-items-center size-10 rounded-md mb-2',
          nada === 'kritis' ? 'text-kritis-ink' : 'text-aman-ink',
          aktif ? 'bg-surface' : nada === 'kritis' ? 'bg-kritis-soft' : 'bg-aman-soft',
        )}
      >
        {ikon}
      </span>
      <span className="block text-[1rem] font-bold text-ink leading-snug">{judul}</span>
      <span className="block mt-0.5 text-[0.8125rem] text-ink-2 leading-snug">{keterangan}</span>
    </button>
  )
}
