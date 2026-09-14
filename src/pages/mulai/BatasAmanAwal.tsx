import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Tombol, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentangLingkaran, IkonPetir, IkonStok } from '@/icons'
import { angka, cx, jumlahSatuan } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import type { Barang } from '@/lib/types'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Langkah terakhir onboarding: satu angka per barang, dan angkanya sudah terisi.
 *
 * Layar ini ada di sini, bukan disembunyikan di balik penyaring di tab Stok,
 * karena inilah satu-satunya momen daftar barangnya baru saja terisi dan
 * perhatian pemilik usaha masih di situ. Aksi massal yang harus dicari sendiri
 * tidak akan pernah disentuh pengguna baru.
 *
 * Taruhannya besar: tanpa batas aman, pengingat stok tipis tidak pernah
 * berbunyi, dan pemilik usaha menyimpulkan fiturnya tidak bekerja.
 */
export default function BatasAmanAwal() {
  const navigate = useNavigate()
  const barang = useAplikasi((s) => s.barang)
  const aturBatasAman = useAplikasi((s) => s.aturBatasAman)
  const aturBatasAmanMassal = useAplikasi((s) => s.aturBatasAmanMassal)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  /* Barang yang sengaja dicatat manual tidak pernah diperingatkan, jadi
     memintanya di sini cuma menambah pekerjaan tanpa hasil. */
  const daftar = useMemo(() => barang.filter((b) => !b.dicatatManual), [barang])
  const jumlahManual = barang.length - daftar.length

  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(daftar.map((b) => [b.id, String(b.batasAmanSaran)])),
  )
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [semuaSaran, setSemuaSaran] = useState(false)

  const jumlahIkutSaran = daftar.filter((b) => nilai[b.id] === String(b.batasAmanSaran)).length

  function pakaiSemuaSaran() {
    setNilai(Object.fromEntries(daftar.map((b) => [b.id, String(b.batasAmanSaran)])))
    setGalat({})
    setSemuaSaran(true)
    aturBatasAmanMassal(daftar.map((b) => b.id))
  }

  function ubahNilai(id: string, v: string) {
    /* Hanya angka bulat: batas aman selalu ditulis dalam satuan pakai, dan
       titik pemisah ribuan yang ikut terketik akan terbaca sebagai desimal. */
    setNilai((n) => ({ ...n, [id]: v.replace(/\D/g, '') }))
    setGalat((g) => {
      if (!g[id]) return g
      const sisa = { ...g }
      delete sisa[id]
      return sisa
    })
    setSemuaSaran(false)
  }

  function simpan() {
    const baru: Record<string, string> = {}
    for (const b of daftar) {
      const n = Number(nilai[b.id] ?? '')
      if (!Number.isFinite(n) || n <= 0) {
        baru[b.id] =
          `Angka pengingat ${b.nama} belum terisi benar. Tulis angka lebih dari nol dalam satuan ${b.satuan}. Contoh: ${b.batasAmanSaran}.`
      }
    }
    setGalat(baru)
    if (Object.keys(baru).length > 0) {
      const pertama = document.getElementById(`batas-${Object.keys(baru)[0]}`)
      pertama?.focus()
      pertama?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    for (const b of daftar) {
      const n = Number(nilai[b.id] ?? '')
      aturBatasAman(b.id, n, n === b.batasAmanSaran ? 'sistem' : 'sendiri')
    }
    tampilkanRacun(`Pengingat stok tipis menyala untuk ${daftar.length} barang.`, 'aman')
    navigate('/beranda')
  }

  return (
    <LayarMulai>
      {/* Prosa ditahan selebar kolom baca walau layarnya lebar: baris kalimat
          yang melar sampai seribu piksel justru lebih sulit dibaca. */}
      <div className="lg:max-w-[36rem]">
        <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight leading-snug">
          Kapan kami harus mengingatkan kamu?
        </h1>
        <p className="mt-1.5 text-[0.875rem] text-ink-2 leading-relaxed">
          Tanpa batas aman, pengingat stok tipis tidak pernah berbunyi &mdash; kamu baru tahu barangnya habis waktu
          pembeli sudah menunggu di depan.
        </p>
      </div>

      {daftar.length === 0 ? (
        <div className="mt-4 lg:max-w-[36rem] bg-surface border border-line rounded-lg shadow-e1">
          <h2 className="sr-only">Belum ada barang yang bisa diatur</h2>
          <KeadaanKosong
            ikon={<IkonStok size={26} />}
            judul="Daftar barang kamu masih kosong"
            pesan="Pengingat baru bisa diatur setelah ada barang yang dicatat. Tambah satu barang dulu, angka pengingatnya nanti kami isikan otomatis."
            aksi={<TombolTautan ke="/stok/baru">Tambah Barang</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/beranda" ragam="garis">
                Ke Beranda dulu
              </TombolTautan>
            }
          />
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            simpan()
          }}
        >
          {/* Tombol satu ketukan ditaruh di ATAS: mayoritas pengguna cukup
              menerima saran, dan mereka tidak boleh perlu menggulir untuk itu. */}
          <div className="mt-4 lg:max-w-[36rem]">
            {semuaSaran ? (
              <Peringatan nada="aman" judul="Semua angka mengikuti saran sistem">
                Kamu masih bisa mengubah angka mana pun di bawah sebelum menyimpan.
              </Peringatan>
            ) : (
              <Tombol
                penuh
                ukuran="besar"
                ragam="sekunder"
                ikonKiri={<IkonPetir size={18} />}
                onClick={pakaiSemuaSaran}
              >
                Pakai semua saran
              </Tombol>
            )}
            <p className="mt-2 text-[0.8125rem] text-ink-2 leading-relaxed">
              {BANTUAN.batasAman} Saran dihitung dari rata-rata pemakaian harian ditambah lama kirim distributor.
            </p>
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[0.9375rem] font-bold text-ink">{daftar.length} barang</h2>
            <p className="text-[0.8125rem] text-ink-2 tabular">
              {jumlahIkutSaran === daftar.length
                ? 'Semuanya ikut saran'
                : `${jumlahIkutSaran} ikut saran · ${daftar.length - jumlahIkutSaran} diubah sendiri`}
            </p>
          </div>

          {/* Di layar lebar daftarnya dipecah dua kolom. Satu kolom sempit
              membuat 17 barang jadi gulungan sepanjang empat layar padahal dua
              pertiga lebar layarnya menganggur. */}
          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2 lg:items-start">
            {daftar.map((b) => (
              <BarisBatas
                key={b.id}
                barang={b}
                nilai={nilai[b.id] ?? ''}
                galat={galat[b.id]}
                ubah={(v) => ubahNilai(b.id, v)}
                kembalikanSaran={() => ubahNilai(b.id, String(b.batasAmanSaran))}
              />
            ))}
          </div>

          {jumlahManual > 0 && (
            <p className="mt-3 lg:max-w-[36rem] text-[0.8125rem] text-ink-2 leading-relaxed">
              {jumlahManual} barang yang kamu tandai dicatat manual tidak ada di daftar ini, karena barang seperti
              itu memang tidak kami ingatkan.
            </p>
          )}

          <div className="sticky bottom-0 mt-5 -mx-1 px-1 pt-3 pb-3 bg-bg/95 backdrop-blur-sm border-t border-line">
            <div className="mx-auto w-full max-w-[28rem]">
              <Tombol type="submit" penuh ukuran="besar">
                Simpan &amp; Nyalakan Pengingat
              </Tombol>
              <div className="mt-2 text-center">
                <Link
                  to="/beranda"
                  className="inline-flex items-center justify-center h-11 px-2 text-[0.875rem] font-semibold text-ink-2 hover:text-ink underline underline-offset-2"
                >
                  Lewati, atur nanti dari tab Stok
                </Link>
              </div>
            </div>
          </div>
        </form>
      )}
    </LayarMulai>
  )
}

/* ================================================================== */
/* Bagian yang hanya dipakai layar ini                                */
/* ================================================================== */

/**
 * Satu baris, satu angka yang boleh besar.
 * Sisa stok sekarang ditulis kecil supaya tidak bersaing dengan kolom isian.
 */
function BarisBatas({
  barang,
  nilai,
  galat,
  ubah,
  kembalikanSaran,
}: {
  barang: Barang
  nilai: string
  galat?: string
  ubah: (v: string) => void
  kembalikanSaran: () => void
}) {
  const id = `batas-${barang.id}`
  const berbeda = nilai !== String(barang.batasAmanSaran)

  return (
    <div
      className={cx(
        'bg-surface border rounded-lg p-3.5 shadow-e1 transition-colors',
        galat ? 'border-kritis' : 'border-line',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[1rem] font-semibold text-ink leading-snug min-w-0">{barang.nama}</p>
        <p className="text-[0.75rem] text-ink-2 shrink-0">{barang.kategori}</p>
      </div>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
        sisa sekarang {jumlahSatuan(barang.stok, barang.satuan)}
        {barang.pemakaianHarian > 0 && (
          <> &middot; rata-rata pakai {jumlahSatuan(barang.pemakaianHarian, barang.satuan)}/hari</>
        )}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <label htmlFor={id} className="text-[0.875rem] text-ink-2">
          ingatkan kalau sisa kurang dari
        </label>
        <span className="inline-flex items-center gap-2">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={nilai}
            aria-invalid={galat ? true : undefined}
            aria-describedby={galat ? `${id}-galat` : undefined}
            onChange={(e) => ubah(e.target.value)}
            onFocus={(e) => e.target.select()}
            className={cx(
              'h-12 w-24 px-3 rounded-md bg-surface text-right text-[1.125rem] font-bold text-ink tabular',
              'border transition-[border-color,box-shadow] duration-150',
              'focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--c-brand-ring)]',
              galat ? 'border-kritis' : 'border-line-strong',
            )}
          />
          <span className="text-[0.8125rem] font-semibold text-ink-2">{barang.satuan}</span>
        </span>
      </div>

      {/* Pesan kesalahan TIDAK menggantikan tombol "pakai saran". Kalau angkanya
          dikosongkan, satu ketukan itulah jalan keluar tercepat; menyembunyikannya
          persis saat dibutuhkan membuat barisnya jadi buntu. */}
      {galat && (
        <p id={`${id}-galat`} className="mt-1 text-[0.8125rem] text-kritis font-medium leading-snug">
          {galat}
        </p>
      )}

      <div className="mt-1 min-h-11 flex items-center">
        {berbeda ? (
          <button
            type="button"
            onClick={kembalikanSaran}
            className="inline-flex items-center h-11 -ml-1 px-1 text-[0.8125rem] font-semibold text-brand hover:underline underline-offset-2"
          >
            Pakai saran sistem: {angka(barang.batasAmanSaran)} {barang.satuan}
          </button>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-2">
            <IkonCentangLingkaran size={13} className="text-aman" />
            Mengikuti saran sistem
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Layar onboarding berdiri di luar kerangka 4 tab, jadi tata letaknya dibangun
 * sendiri. Berbeda dari layar pendaftaran, isinya daftar panjang — jadi di layar
 * lebar kolomnya dilebarkan supaya daftarnya muat dua kolom.
 */
function LayarMulai({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg px-4 pt-aman pb-aman">
      <div className="w-full max-w-[28rem] lg:max-w-[64rem] mx-auto py-8 sm:py-12">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span
            className="size-9 rounded-md bg-brand text-ink-inverse grid place-items-center font-extrabold text-[1.125rem] leading-none"
            aria-hidden="true"
          >
            W
          </span>
          <span className="text-[1.125rem] font-extrabold text-ink tracking-tight">Warungku</span>
        </div>
        <div className="anim-muncul">{children}</div>
      </div>
    </div>
  )
}
