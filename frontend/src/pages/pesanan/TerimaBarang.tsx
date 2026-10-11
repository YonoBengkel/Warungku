import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { AreaTeks, Kolom, PengaturJumlah } from '@/components/ui/formulir'
import { BarisChip, BilahAksi, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentangLingkaran, IkonPasokan, IkonUnggah } from '@/icons'
import { angka, cx, jumlahSatuan, rupiah, tanggalLengkapHari } from '@/lib/format'
import { isiKemasan, jumlahTampil } from '@/lib/satuan'
import { LABEL_SELISIH, type AlasanSelisih } from '@/lib/types'
import { distributorById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu-satunya tempat stok gudang bertambah.
 *
 * Jalur 80% kasus adalah satu ketukan: jumlah yang dipesan dianggap benar, dan
 * tombol "Ya, semua sesuai" menutup pesanan. Koreksi baru muncul kalau pemilik
 * usaha sendiri yang membukanya, supaya orang yang barangnya memang beres tidak
 * dipaksa membaca formulir selisih.
 *
 * Pesanan TIDAK PERNAH macet di Dikirim. Kalau ada selisih, pesanan tetap maju
 * ke "Selesai (ada catatan)", karena satu-satunya jalan keluar pengguna dari
 * layar yang macet adalah tidak menekan apa pun — dan stok jadi tidak pernah masuk.
 */

/**
 * Ini formulir satu alur, jadi di layar lebar ia tetap satu kolom — tapi
 * terpusat, bukan menempel kiri. Melebarkannya jadi dua kolom akan memaksa
 * mata bolak-balik saat orang sedang menghitung barang di depan kurir.
 */
const KOLOM = 'pb-6 mx-auto w-full max-w-[46rem]'

interface Koreksi {
  dibuka: boolean
  jumlah: number
  alasan: AlasanSelisih | null
  catatan: string
  foto: number
}

function tanggalInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TerimaBarang() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const pesanan = useAplikasi((s) => s.pesanan.find((p) => p.id === id))
  const barang = useAplikasi((s) => s.barang)
  const terimaBarang = useAplikasi((s) => s.terimaBarang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const hariIni = tanggalInput(new Date())
  const [tanggal, setTanggal] = useState(hariIni)
  const [galat, setGalat] = useState<string | null>(null)
  const [koreksi, setKoreksi] = useState<Record<string, Koreksi>>(() => {
    const awal: Record<string, Koreksi> = {}
    for (const b of pesanan?.baris ?? []) {
      awal[b.penawaranId] = { dibuka: false, jumlah: b.jumlah, alasan: null, catatan: '', foto: 0 }
    }
    return awal
  })

  const adaKoreksi = useMemo(
    () =>
      (pesanan?.baris ?? []).some((b) => {
        const k = koreksi[b.penawaranId]
        return k && (k.jumlah !== b.jumlah || k.alasan !== null)
      }),
    [pesanan, koreksi],
  )

  /* Keadaan awal disusun sekali dari baris pesanan. Kalau ada baris yang belum
     punya entri, kita pakai jumlah pesanan sebagai kebenaran bawaan daripada
     membiarkan layar kosong. */
  function bacaKoreksi(penawaranId: string, jumlahDipesan: number): Koreksi {
    return koreksi[penawaranId] ?? { dibuka: false, jumlah: jumlahDipesan, alasan: null, catatan: '', foto: 0 }
  }

  if (!pesanan) {
    return (
      <div className={KOLOM}>
        <KepalaHalaman judul="Terima Barang" kembaliKe="/pesanan" />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Pesanan tidak ditemukan
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Pesanan ini sudah tidak ada"
            pesan="Tautannya mungkin sudah lama. Semua pesanan yang sedang dikirim masih ada di halaman Pesanan."
            aksi={<TombolTautan ke="/pesanan">Kembali ke Daftar Pesanan</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  if (pesanan.status === 'selesai' || pesanan.status === 'selesai-catatan') {
    return (
      <div className={KOLOM}>
        <KepalaHalaman judul="Terima Barang" kembaliKe={`/pesanan/${pesanan.id}`} />
        <section aria-labelledby="judul-sudah-diterima">
          <h2 id="judul-sudah-diterima" className="sr-only">
            Kiriman ini sudah diterima
          </h2>
          <KeadaanKosong
            ikon={<IkonCentangLingkaran size={26} />}
            judul="Pesanan ini sudah diterima"
            pesan={`${pesanan.nomor} sudah kamu periksa dan stoknya sudah bertambah. Rinciannya ada di halaman pesanan.`}
            aksi={<TombolTautan ke={`/pesanan/${pesanan.id}`}>Lihat Pesanan</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  const ps = pesanan
  const distributor = distributorById(pesanan.distributorId)

  function ubahKoreksi(penawaranId: string, jumlahDipesan: number, isi: Partial<Koreksi>) {
    setKoreksi((s) => ({
      ...s,
      [penawaranId]: {
        ...(s[penawaranId] ?? { dibuka: false, jumlah: jumlahDipesan, alasan: null, catatan: '', foto: 0 }),
        ...isi,
      },
    }))
    setGalat(null)
  }

  /**
   * Ringkasan jujur: yang masuk gudang adalah jumlah yang diakui, bukan yang
   * dipesan. Pembandingnya ditulis dalam DUA satuan sekaligus ("3 karung = 60
   * kg") karena pesanan dihitung per kemasan sedangkan stok per satuan pakai —
   * menyebut satu saja membuat selisihnya terbaca seperti salah hitung.
   */
  function ringkasanStok(): string[] {
    return ps.baris.map((b) => {
      const diakui = koreksi[b.penawaranId]?.jumlah ?? b.jumlah
      const bar = barang.find((x) => x.id === b.barangId)
      /* Jumlah yang masuk ke stok ditulis dalam satuan tampil barangnya, sama
         dengan angka yang akan dibaca di daftar Stok sesaat lagi. */
      const tulis = (n: number) => (bar ? jumlahTampil(bar, n) : jumlahSatuan(n, b.satuan))
      const isi = bar ? diakui * b.isiPerSatuan : diakui
      const dipesanIsi = bar ? b.jumlah * b.isiPerSatuan : b.jumlah
      const asal =
        diakui === b.jumlah
          ? ''
          : !bar
            ? ` — dipesan ${jumlahSatuan(b.jumlah, b.satuan)}`
            : ` — dipesan ${jumlahSatuan(b.jumlah, b.satuan)} = ${tulis(dipesanIsi)}`
      if (diakui <= 0) return `${b.nama}: tidak ada yang masuk${asal}`
      return `${b.nama} ${tulis(isi)}${asal}`
    })
  }

  function simpan() {
    /* Kolom tanggal bisa dikosongkan pengguna. Tanpa penjagaan ini, tanggal
       kosong akan diteruskan sebagai waktu yang tidak sah ke catatan stok. */
    // Hari ini memakai jam sekarang, supaya jejaknya tetap berurutan setelah
    // distributor menandai barang sampai. Tanggal yang dimundurkan memakai jam
    // 09.00 supaya tidak melompat ke hari sebelumnya saat diubah ke waktu
    // universal.
    const waktuTerima = tanggal === hariIni ? new Date() : new Date(`${tanggal}T09:00:00`)
    if (!tanggal || Number.isNaN(waktuTerima.getTime())) {
      setGalat(
        `Tanggal barang diterima belum terisi. Ketuk kolom tanggal lalu pilih hari barangnya datang. Contoh: ${hariIni}.`,
      )
      return
    }

    const kurangAlasan = ps.baris.find((b) => {
      const k = koreksi[b.penawaranId]
      return k && k.jumlah !== b.jumlah && k.alasan === null
    })
    if (kurangAlasan) {
      setGalat(
        `Jumlah ${kurangAlasan.nama} kamu ubah tapi alasannya belum dipilih. Pilih satu chip alasan di baris itu. Contoh: Kurang.`,
      )
      return
    }

    const diterima: Record<string, { jumlah: number; alasan: AlasanSelisih | null; catatan: string }> = {}
    for (const b of ps.baris) {
      const k = koreksi[b.penawaranId]
      diterima[b.penawaranId] = {
        jumlah: k?.jumlah ?? b.jumlah,
        alasan: k?.alasan ?? null,
        catatan: k?.catatan.trim() ?? '',
      }
    }

    terimaBarang(ps.id, diterima, waktuTerima.toISOString())
    navigate(`/pesanan/${ps.id}`)
  }

  return (
    <div className={KOLOM}>
      <KepalaHalaman
        judul="Terima Barang"
        keterangan={`${pesanan.nomor} · ${distributor?.nama ?? 'Distributor'}`}
        kembaliKe={`/pesanan/${pesanan.id}`}
      />

      <Peringatan nada="info" judul="Stok bertambah setelah kamu menekan tombol di bawah" className="mt-4">
        Hitung dulu barangnya di tempat. Jumlah yang kamu akui di sini persis itulah yang masuk ke gudang.
      </Peringatan>

      <section aria-labelledby="judul-tanggal" className="mt-4">
        <h2 id="judul-tanggal" className="sr-only">
          Tanggal terima
        </h2>
        <Kartu padat>
          <Kolom
            label="Tanggal barang diterima"
            wajib
            type="date"
            value={tanggal}
            max={hariIni}
            onChange={(e) => setTanggal(e.target.value)}
            bantuan={`Bawaannya hari ini (${tanggalLengkapHari(new Date())}). Kalau barangnya datang kemarin, mundurkan tanggalnya — itu yang tercatat sebagai tanggal stok masuk.`}
          />
        </Kartu>
      </section>

      <section aria-labelledby="judul-barang" className="mt-4">
        <h2 id="judul-barang" className="text-[0.9375rem] font-bold text-ink mb-1">
          {pesanan.baris.length} barang dalam kiriman ini
        </h2>
        <p className="text-[0.8125rem] text-ink-3 mb-3">
          Jumlah di bawah dianggap benar. Buka tautan kecil hanya kalau ada yang tidak cocok.
        </p>

        <div className="space-y-3">
          {pesanan.baris.map((b) => {
            const k = bacaKoreksi(b.penawaranId, b.jumlah)
            const jumlahBerubah = k.jumlah !== b.jumlah
            const bar = barang.find((x) => x.id === b.barangId)
            return (
              <Kartu key={b.penawaranId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 grow">
                    <p className="text-[1rem] font-semibold text-ink leading-snug">{b.nama}</p>
                    <p className="mt-0.5 text-[0.8125rem] text-ink-3 tabular">
                      {rupiah(b.hargaSatuan)} per {b.satuan}
                      {bar && b.isiPerSatuan > 1 && isiKemasan(bar, b.satuan, b.isiPerSatuan) && (
                        <> &middot; {isiKemasan(bar, b.satuan, b.isiPerSatuan)}</>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cx('text-[1.5rem] font-bold leading-none', jumlahBerubah ? 'text-ink-3 line-through' : 'text-ink')}>
                      {angka(b.jumlah)}
                    </p>
                    <p className="text-[0.75rem] text-ink-3 mt-0.5">{b.satuan} dipesan</p>
                    {jumlahBerubah && (
                      <p className="mt-1 text-[0.9375rem] font-bold text-menipis-ink tabular">
                        diakui {angka(k.jumlah)} {b.satuan}
                      </p>
                    )}
                  </div>
                </div>

                {!k.dibuka ? (
                  <button
                    type="button"
                    onClick={() => ubahKoreksi(b.penawaranId, b.jumlah, { dibuka: true })}
                    className="mt-2 min-h-11 text-[0.8125rem] font-semibold text-brand hover:underline text-left"
                  >
                    Jumlahnya beda / barang rusak
                  </button>
                ) : (
                  <div className="mt-3 border-t border-line pt-3 space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[0.8125rem] font-semibold text-ink-2 mb-1.5">Jumlah yang benar-benar diterima</p>
                        <PengaturJumlah
                          nilai={k.jumlah}
                          ubah={(n) => ubahKoreksi(b.penawaranId, b.jumlah, { jumlah: n })}
                          min={0}
                          maks={b.jumlah * 3}
                          satuan={b.satuan}
                          saranModel={b.jumlah}
                          label={`Jumlah ${b.nama}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          ubahKoreksi(b.penawaranId, b.jumlah, {
                            dibuka: false,
                            jumlah: b.jumlah,
                            alasan: null,
                            catatan: '',
                            foto: 0,
                          })
                        }
                        className="min-h-11 text-[0.8125rem] font-semibold text-ink-3 hover:text-ink"
                      >
                        Batal, jumlahnya sudah benar
                      </button>
                    </div>

                    <div>
                      <p className="text-[0.8125rem] font-semibold text-ink-2 mb-2">Apa yang terjadi?</p>
                      <BarisChip className="flex-wrap">
                        {(Object.keys(LABEL_SELISIH) as AlasanSelisih[]).map((a) => (
                          <Chip
                            key={a}
                            aktif={k.alasan === a}
                            onClick={() => ubahKoreksi(b.penawaranId, b.jumlah, { alasan: k.alasan === a ? null : a })}
                          >
                            {LABEL_SELISIH[a]}
                          </Chip>
                        ))}
                      </BarisChip>
                    </div>

                    <AreaTeks
                      label="Catatan untuk distributor"
                      placeholder="Contoh: 14 butir pecah waktu diturunkan dari motor."
                      value={k.catatan}
                      onChange={(e) => ubahKoreksi(b.penawaranId, b.jumlah, { catatan: e.target.value })}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-sunken text-ink-2 text-[0.875rem] font-semibold cursor-pointer hover:brightness-95">
                        <IkonUnggah size={16} />
                        Ambil Foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            const n = e.target.files?.length ?? 0
                            if (n > 0) ubahKoreksi(b.penawaranId, b.jumlah, { foto: k.foto + n })
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {k.foto > 0 && (
                        <Lencana nada="aman">
                          {k.foto} foto terlampir
                        </Lencana>
                      )}
                    </div>
                  </div>
                )}
              </Kartu>
            )
          })}
        </div>
      </section>

      {galat && (
        <Peringatan nada="kritis" judul="Ada satu isian yang belum lengkap" className="mt-4">
          {galat}
        </Peringatan>
      )}

      <BilahAksi
        ringkasan={
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink-2">Stok yang akan ditambahkan:</p>
            <ul className="mt-1 space-y-0.5">
              {ringkasanStok().map((t) => (
                <li key={t} className="text-[0.8125rem] text-ink leading-snug">
                  {t}
                </li>
              ))}
            </ul>
            {adaKoreksi && (
              <>
                <Pemisah className="my-2" />
                <p className="text-[0.8125rem] text-menipis-ink leading-snug">
                  Pesanan tetap ditutup sebagai Selesai (ada catatan). Selisihnya diteruskan ke distributor sebagai
                  catatan, penyelesaiannya lewat telepon.
                </p>
              </>
            )}
          </div>
        }
      >
        <Tombol penuh ukuran="besar" onClick={simpan} ikonKiri={<IkonCentangLingkaran size={18} />}>
          {adaKoreksi ? 'Terima dengan catatan' : 'Ya, semua sesuai'}
        </Tombol>
        <button
          type="button"
          onClick={() => {
            tampilkanRacun('Belum ada yang dicatat. Stok gudang tidak berubah.', 'info')
            navigate(`/pesanan/${ps.id}`)
          }}
          className="w-full min-h-11 mt-1 text-[0.875rem] font-semibold text-ink-3 hover:text-ink"
        >
          Nanti saja, barangnya belum saya hitung
        </button>
      </BilahAksi>
    </div>
  )
}
