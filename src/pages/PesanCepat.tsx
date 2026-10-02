import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Barang, BarisSaran, SaranBelanja } from '@/lib/types'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { KotakCentang, PengaturJumlah, PilihanKartu } from '@/components/ui/formulir'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { Lembar } from '@/components/ui/lembar'
import { KuotaBulanIni } from '@/components/domain'
import {
  IkonJam,
  IkonKeranjang,
  IkonKontrak,
  IkonPasokan,
  IkonToko,
} from '@/icons'
import { angka, cx, hariLagi, rupiah } from '@/lib/format'
import { jumlahTampil } from '@/lib/satuan'
import {
  distributorById,
  hargaBerlaku,
  hariCukup,
  penawaranById,
  penawaranUntukBarang,
  saranById,
  statusStok,
} from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Lembar Pesan Cepat: satu komponen untuk tiga pintu masuk.
 *
 * Kartu "Pesan Sekarang" di Beranda, baris di Pemberitahuan, dan pita belanja
 * yang belum dikirim semuanya berhenti di sini. Karena itu layar ini tidak
 * boleh mengandalkan konteks pemanggilnya sama sekali: semua yang dibutuhkan
 * diambil dari saran belanja lewat id di URL.
 *
 * Dua janji yang dipegang halaman ini:
 * 1. Frontend tidak pernah mengarang alasan. Chip "Kenapa segini?" hanya
 *    muncul kalau saran memang membawa butir faktanya.
 * 2. Menutup halaman tidak membuang apa pun. Jumlah yang sudah dimasukkan ke
 *    keranjang tetap ada dan muncul lagi sebagai pita di Beranda.
 */

interface KeadaanBaris {
  /** Bisa berubah lewat "Ganti pemasok", jadi disimpan terpisah dari saran. */
  penawaranId: string | null
  jumlah: number
  dipilih: boolean
  ditunda: boolean
  /** Kapan pengingatnya dijadwalkan, supaya barisnya bisa menyebut akibatnya. */
  tundaLabel: string | null
}

function keadaanAwal(saran: SaranBelanja | undefined): Record<string, KeadaanBaris> {
  const hasil: Record<string, KeadaanBaris> = {}
  for (const b of saran?.baris ?? []) {
    hasil[b.barangId] = {
      penawaranId: b.penawaranId,
      jumlah: Math.max(1, b.jumlahSaran),
      dipilih: b.varian !== 'tanpa-pemasok',
      ditunda: false,
      tundaLabel: null,
    }
  }
  return hasil
}


function perkiraanHabis(b: Barang): string | null {
  const hari = hariCukup(b)
  if (hari == null) return null
  if (hari <= 0) return 'hari ini'
  if (hari === 1) return 'besok'
  if (hari <= 6) {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(
      new Date(Date.now() + hari * 86_400_000),
    )
  }
  return hariLagi(hari)
}

/** Perkiraan hari sampai stok tinggal separuh batas aman, untuk opsi "kalau makin menipis". */
function hariSampaiMenipis(b: Barang): number {
  if (b.pemakaianHarian <= 0) return 3
  const ambang = b.batasAman > 0 ? b.batasAman / 2 : b.pemakaianHarian * 2
  const hari = Math.floor((b.stok - ambang) / b.pemakaianHarian)
  return Math.min(14, Math.max(1, hari))
}

export default function PesanCepat() {
  const { idSaran } = useParams<{ idSaran: string }>()
  const navigate = useNavigate()

  const daftarBarang = useAplikasi((s) => s.barang)
  const daftarKontrak = useAplikasi((s) => s.kontrak)
  const daftarNotifikasi = useAplikasi((s) => s.notifikasi)
  const tambahKeKeranjang = useAplikasi((s) => s.tambahKeKeranjang)
  const tundaNotifikasi = useAplikasi((s) => s.tundaNotifikasi)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const saran = idSaran ? saranById(idSaran) : undefined

  const [keadaan, setKeadaan] = useState<Record<string, KeadaanBaris>>(() => keadaanAwal(saran))
  const [lembarPemasok, setLembarPemasok] = useState<string | null>(null)
  const [lembarIngat, setLembarIngat] = useState<string | null>(null)

  const terpilih = useMemo(() => {
    const baris = saran?.baris ?? []
    return baris.filter((r) => {
      const k = keadaan[r.barangId]
      return k && k.dipilih && !k.ditunda && k.penawaranId
    })
  }, [saran, keadaan])

  /* Saran bisa berganti isi tanpa komponennya dilepas (misal berpindah dari satu
     pemberitahuan ke pemberitahuan lain), jadi baris yang belum punya keadaan
     dijatuhkan ke nilai saran, bukan dibiarkan kosong dan membuat layar mati. */
  const keadaanBaris = (r: BarisSaran): KeadaanBaris =>
    keadaan[r.barangId] ?? {
      penawaranId: r.penawaranId,
      jumlah: Math.max(1, r.jumlahSaran),
      dipilih: false,
      ditunda: false,
      tundaLabel: null,
    }

  const distributorTerpilih = useMemo(() => {
    const set = new Set<string>()
    for (const r of terpilih) {
      const pw = penawaranById(keadaan[r.barangId].penawaranId ?? '')
      if (pw) set.add(pw.distributorId)
    }
    return set
  }, [terpilih, keadaan])

  if (!saran) {
    return (
      <>
        <KepalaHalaman judul="Pesan Cepat" kembaliKe="/beranda" />
        {/* Judul bagian khusus pembaca layar: tanpa ini urutan judul melompat
            dari h1 langsung ke h3 milik kartu keadaan kosong. */}
        <section aria-labelledby="judul-isi-saran">
          <h2 id="judul-isi-saran" className="sr-only">
            Isi saran belanja
          </h2>
          <KeadaanKosong
            ikon={<IkonKeranjang size={26} />}
            judul="Saran belanja ini sudah tidak ada"
            pesan="Mungkin saran hariannya sudah diperbarui atau barangnya sudah kamu pesan. Daftar stok selalu menunjukkan keadaan terbaru."
            aksi={<TombolTautan ke="/beranda">Kembali ke Beranda</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/stok?filter=menipis" ragam="garis">
                Lihat stok menipis
              </TombolTautan>
            }
          />
        </section>
      </>
    )
  }

  const ubahBaris = (barangId: string, p: Partial<KeadaanBaris>) =>
    setKeadaan((k) => {
      const r = saran.baris.find((x) => x.barangId === barangId)
      const dasar =
        k[barangId] ??
        ({
          penawaranId: r?.penawaranId ?? null,
          jumlah: Math.max(1, r?.jumlahSaran ?? 1),
          dipilih: false,
          ditunda: false,
          tundaLabel: null,
        } satisfies KeadaanBaris)
      return { ...k, [barangId]: { ...dasar, ...p } }
    })

  const barangDari = (id: string) => daftarBarang.find((b) => b.id === id)

  function masukkanKeKeranjang() {
    if (terpilih.length === 0) return
    for (const r of terpilih) {
      const k = keadaan[r.barangId]
      const pw = penawaranById(k.penawaranId ?? '')
      if (!pw) continue
      tambahKeKeranjang(pw.distributorId, pw.id, k.jumlah, r.jumlahSaran, r.kontrakId)
    }
    tampilkanRacun(`${terpilih.length} barang tersimpan di keranjang.`, 'aman')
    navigate('/keranjang')
  }

  function terapkanIngatkan(r: BarisSaran, hari: number, labelOpsi: string) {
    const b = barangDari(r.barangId)
    const notif = daftarNotifikasi.find((n) => n.barangId === r.barangId && n.kategori === 'stok')
    if (notif) {
      tundaNotifikasi(notif.id, hari)
    } else {
      tampilkanRacun(
        `Kami ingatkan lagi soal ${b?.nama ?? 'barang ini'} ${labelOpsi.toLowerCase()}.`,
        'info',
      )
    }
    ubahBaris(r.barangId, { ditunda: true, dipilih: false, tundaLabel: labelOpsi })
    setLembarIngat(null)
  }

  const jumlahPesanan = distributorTerpilih.size

  return (
    <div className="pb-4">
      <KepalaHalaman
        judul="Lembar Pesan Cepat"
        keterangan={saran.judul}
        kembaliKe="/beranda"
      />

      {/* Di layar sempit wujudnya satu kolom seperti bottom sheet. Di layar lebar
          kartunya berdampingan dua-dua: tiap baris adalah keputusan yang berdiri
          sendiri, jadi menumpuknya satu kolom di tengah 1360px hanya memaksa
          menggulir lima kali untuk pekerjaan yang muat dalam satu layar.
          Teks pengantarnya tetap ditahan ~68 karakter supaya enak dibaca. */}
      <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">
        <p className="mt-4 text-[0.875rem] text-ink-2 leading-relaxed max-w-[68ch]">
          Jumlah di bawah ini sudah diisi dari perkiraan pemakaianmu. Ubah sesukamu &mdash; angka saran tetap
          ditampilkan supaya kamu bisa membandingkan.
        </p>

        <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed max-w-[68ch]">
          Kalau kamu tutup halaman ini, barang yang sudah masuk keranjang tetap tersimpan dan muncul lagi sebagai
          pita &ldquo;Belanja belum dikirim&rdquo; di Beranda.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 lg:items-start">
          {saran.baris.map((r) => {
            const b = barangDari(r.barangId)
            if (!b) return null
            const k = keadaanBaris(r)
            const pw = penawaranById(k.penawaranId ?? '')
            const distributor = pw ? distributorById(pw.distributorId) : undefined
            const kontrak = r.kontrakId ? daftarKontrak.find((x) => x.id === r.kontrakId) : undefined
            const isi = pw?.kemasanJual?.isi ?? 1
            const habis = perkiraanHabis(b)
            const status = statusStok(b)
            const kandidat = penawaranUntukBarang(b.id)
              .slice()
              .sort((x, y) => hargaBerlaku(x.id) - hargaBerlaku(y.id))
              .slice(0, 5)

            return (
              <Kartu
                key={r.barangId}
                /* Baris yang ditunda ditandai garis putus-putus, BUKAN dipudarkan:
                   memudarkan kartu menjatuhkan kontras semua teks di dalamnya di
                   bawah ambang baca, paling parah di tema gelap. */
                className={cx(k.ditunda && 'border-dashed')}
              >
                {/* Lapis 1: konteks stok, supaya angka jumlah punya dasar yang terlihat */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[1rem] font-semibold text-ink leading-snug">{b.nama}</h2>
                    <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                      {status === 'habis'
                        ? `Stok tercatat ${jumlahTampil(b, 0)}`
                        : `Sisa ${jumlahTampil(b, b.stok)}`}
                      {habis && status !== 'habis' && <> &middot; diperkirakan habis {habis}</>}
                    </p>
                    {r.sedangDikirim > 0 && (
                      <p className="mt-1 text-[0.8125rem] text-info-ink">
                        {angka(r.sedangDikirim)} {pw?.satuan ?? 'unit'} sedang dikirim dan sudah dikurangkan dari
                        saran ini.
                      </p>
                    )}
                  </div>
                  {r.varian !== 'tanpa-pemasok' && (
                    <div className="shrink-0">
                      <KotakCentang
                        dicentang={k.dipilih}
                        ubah={(v) => ubahBaris(r.barangId, { dipilih: v, ditunda: v ? false : k.ditunda })}
                      >
                        <span className="whitespace-nowrap">
                          Ikut dipesan
                          <span className="sr-only"> &mdash; {b.nama}</span>
                        </span>
                      </KotakCentang>
                    </div>
                  )}
                </div>

                {/* Varian C: tidak ada pemasok, jadi tidak ada yang bisa dipesan. */}
                {r.varian === 'tanpa-pemasok' || !pw ? (
                  <div className="mt-3">
                    <Peringatan nada="netral" judul={`Belum ada distributor yang memasok ${b.nama} di daerah kamu`}>
                      Kalau kamu tetap membelinya sendiri di pasar atau toko grosir, catat pembeliannya supaya angka
                      stok dan perkiraan tetap benar.
                    </Peringatan>
                    <TombolTautan
                      ke={`/stok/${b.id}/koreksi`}
                      ragam="garis"
                      penuh
                      className="mt-2.5"
                    >
                      Catat pembelian manual
                    </TombolTautan>
                  </div>
                ) : (
                  <>
                    <Pemisah className="my-3" />

                    {/* Baris pemasok. Varian A menerangkan kenapa pemasok ini yang dipilih. */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.875rem] font-semibold text-ink flex items-center gap-1.5">
                          <IkonToko size={15} className="text-ink-3 shrink-0" />
                          <span className="truncate">{distributor?.nama}</span>
                        </p>
                        {r.alasanPemasok && (
                          <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">{r.alasanPemasok}</p>
                        )}
                        <p className="mt-1 text-[0.8125rem] text-ink-2 tabular">
                          {rupiah(hargaBerlaku(pw.id, kontrak?.id ?? null, daftarKontrak))} / {pw.satuan}
                          <span className="text-ink-3"> &middot; sisa stok {angka(pw.stokTersedia)} {pw.satuan}</span>
                        </p>
                      </div>
                      {kontrak ? (
                        <Lencana nada="aman" ikon={<IkonKontrak size={13} />}>
                          Kontrak
                        </Lencana>
                      ) : (
                        <Lencana nada="netral">Beli Lepas</Lencana>
                      )}
                    </div>

                    {r.varian === 'ada-kontrak' && kandidat.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLembarPemasok(r.barangId)}
                        className="mt-1.5 text-[0.8125rem] font-semibold text-brand hover:underline"
                      >
                        Ganti pemasok
                      </button>
                    )}

                    {/* Varian B: dua tombol milik baris ini. "Pesan sekali ini" hanya
                        muncul kalau barisnya memang sedang tidak ikut dipesan, supaya
                        tidak ada tombol yang ditekan tapi tidak mengubah apa pun. */}
                    {r.varian === 'ada-pemasok' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(!k.dipilih || k.ditunda) && (
                          <Tombol
                            ragam="garis"
                            ukuran="kecil"
                            onClick={() => ubahBaris(r.barangId, { dipilih: true, ditunda: false })}
                          >
                            Pesan sekali ini
                          </Tombol>
                        )}
                        <TombolTautan ke={`/penawaran/${pw.id}/kontrak`} ragam="sunyi" ukuran="kecil">
                          Lihat kontrak
                        </TombolTautan>
                      </div>
                    )}

                    {/* Kandidat lain ditampilkan terbuka, bukan disembunyikan di balik
                        tautan: di varian ini belum ada kontrak yang mengikat pilihan. */}
                    {r.varian === 'ada-pemasok' && kandidat.some((c) => c.id !== pw.id) && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[0.75rem] font-semibold text-ink-3 uppercase tracking-wide">
                          Pemasok lain untuk barang ini
                        </p>
                        {kandidat
                          .filter((c) => c.id !== pw.id)
                          .slice(0, 2)
                          .map((c) => {
                            const d = distributorById(c.distributorId)
                            const lebihMurah =
                              hargaBerlaku(c.id) < hargaBerlaku(pw.id, kontrak?.id ?? null, daftarKontrak)
                            return (
                              <div key={c.id} className="rounded-md border border-line bg-surface-2 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[0.875rem] font-semibold text-ink truncate">{d?.nama}</p>
                                    <p className="text-[0.8125rem] text-ink-2 tabular">
                                      {rupiah(hargaBerlaku(c.id))} / {c.satuan}
                                      <span className="text-ink-3">
                                        {' '}
                                        &middot; sisa stok {angka(c.stokTersedia)} {c.satuan}
                                      </span>
                                    </p>
                                  </div>
                                  {lebihMurah && <Lencana nada="aman">Lebih murah</Lencana>}
                                </div>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  <Tombol
                                    ragam="garis"
                                    ukuran="kecil"
                                    onClick={() =>
                                      ubahBaris(r.barangId, {
                                        penawaranId: c.id,
                                        dipilih: true,
                                        ditunda: false,
                                        jumlah: Math.min(k.jumlah, Math.max(1, c.stokTersedia)),
                                      })
                                    }
                                  >
                                    Pesan sekali ini
                                  </Tombol>
                                  <TombolTautan ke={`/penawaran/${c.id}/kontrak`} ragam="sunyi" ukuran="kecil">
                                    Lihat kontrak
                                  </TombolTautan>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}

                    {/* Lapis 2: pengatur jumlah yang melangkah sesuai kelipatan jual distributor */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <PengaturJumlah
                        nilai={k.jumlah}
                        ubah={(n) => ubahBaris(r.barangId, { jumlah: n })}
                        min={1}
                        maks={Math.max(1, pw.stokTersedia)}
                        label={`Jumlah ${b.nama}`}
                      />
                      <div className="min-w-0">
                        <p className="text-[1.5rem] font-bold text-ink leading-none">
                          {angka(k.jumlah)} <span className="text-[1rem] font-semibold">{pw.satuan}</span>
                        </p>
                        <p className="mt-1 text-[0.8125rem] text-ink-3">
                          = {jumlahTampil(b, k.jumlah * isi)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                      Saran sistem {angka(r.jumlahSaran)} {pw.satuan}
                      {k.jumlah !== r.jumlahSaran && (
                        <>
                          {' '}
                          &middot; kamu ubah jadi {angka(k.jumlah)} {pw.satuan}
                        </>
                      )}
                      {k.jumlah >= pw.stokTersedia && (
                        <>
                          {' '}
                          &middot; sisa stok distributor cuma {angka(pw.stokTersedia)} {pw.satuan}
                        </>
                      )}
                    </p>

                    {/* Lapis 3: tunda. Penjelasan "kenapa segini" sengaja tidak ada:
                        angka saran berdiri sendiri, dan jumlahnya boleh diubah. */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Tombol
                        ragam="sunyi"
                        ukuran="kecil"
                        ikonKiri={<IkonJam size={15} />}
                        onClick={() => setLembarIngat(r.barangId)}
                      >
                        Ingatkan nanti
                      </Tombol>
                    </div>

                    {/* Lapis 4: baris kuota, hanya untuk barang yang terikat kontrak */}
                    {kontrak && (
                      <div className="mt-3 rounded-md bg-sunken p-3">
                        <KuotaBulanIni kontrak={kontrak} ringkas />
                      </div>
                    )}

                    {k.ditunda && (
                      <p className="mt-3 text-[0.8125rem] font-semibold text-info-ink">
                        {k.tundaLabel
                          ? `Ditunda — kami ingatkan lagi ${k.tundaLabel.toLowerCase()}.`
                          : 'Ditunda.'}{' '}
                        Barang ini tidak ikut masuk keranjang sekarang.{' '}
                        <button
                          type="button"
                          onClick={() =>
                            ubahBaris(r.barangId, { ditunda: false, dipilih: true, tundaLabel: null })
                          }
                          className="underline underline-offset-2"
                        >
                          Ikutkan lagi
                        </button>
                      </p>
                    )}
                  </>
                )}
              </Kartu>
            )
          })}
        </div>

        {/* Bilah aksi diangkat setinggi navigasi bawah. Tanpa ini, bilahnya
            menempel di dasar layar tepat di belakang navigasi mobile dan tombol
            utamanya tidak bisa ditekan sama sekali. */}
        <div className="sticky bottom-[var(--nav-h)] lg:bottom-0 z-30">
          <BilahAksi
            ringkasan={
              <p className="text-[0.8125rem] text-ink-2 leading-snug">
                {terpilih.length === 0 ? (
                  'Belum ada barang yang dipilih. Centang minimal satu barang untuk melanjutkan.'
                ) : (
                  <>
                    <strong className="text-ink">{terpilih.length} barang</strong> akan dikirim sebagai{' '}
                    <strong className="text-ink">{jumlahPesanan} pesanan</strong> ke {jumlahPesanan} distributor.
                  </>
                )}
              </p>
            }
          >
            <Tombol
              penuh
              ukuran="besar"
              ikonKiri={<IkonKeranjang size={18} />}
              disabled={terpilih.length === 0}
              onClick={masukkanKeKeranjang}
            >
              {terpilih.length === 0
                ? 'Masukkan ke Keranjang'
                : `Masukkan ${terpilih.length} Barang ke Keranjang`}
            </Tombol>
          </BilahAksi>
        </div>

        {/* Jalan keluar yang selalu ada, supaya lembar ini tidak pernah jadi buntu */}
        <div className="mt-4 flex flex-wrap gap-2.5">
          <TombolTautan ke="/belanja" ragam="garis" ukuran="kecil" ikonKiri={<IkonPasokan size={15} />}>
            Cari barang lain di Distributor
          </TombolTautan>
          <TombolTautan ke="/keranjang" ragam="sunyi" ukuran="kecil">
            Lihat keranjang
          </TombolTautan>
        </div>
      </div>

      {/* ---------------- Lembar: ganti pemasok ---------------- */}
      {saran.baris.map((r) => {
        const b = barangDari(r.barangId)
        if (!b) return null
        const k = keadaanBaris(r)
        const kandidat = penawaranUntukBarang(b.id)
          .slice()
          .sort((x, y) => hargaBerlaku(x.id) - hargaBerlaku(y.id))
          .slice(0, 5)

        return (
          <Lembar
            key={`pemasok-${r.barangId}`}
            terbuka={lembarPemasok === r.barangId}
            tutup={() => setLembarPemasok(null)}
            judul="Ganti pemasok"
            keterangan={`${kandidat.length} distributor memasok ${b.nama} di daerah kamu.`}
          >
            <div className="pb-4 space-y-2.5">
              {kandidat.map((c) => {
                const d = distributorById(c.distributorId)
                return (
                  <PilihanKartu
                    key={c.id}
                    terpilih={k.penawaranId === c.id}
                    nilai={c.id}
                    ubah={(v) => {
                      ubahBaris(r.barangId, {
                        penawaranId: v,
                        jumlah: Math.min(k.jumlah, penawaranById(v)?.stokTersedia ?? k.jumlah),
                      })
                      setLembarPemasok(null)
                    }}
                    judul={d?.nama ?? 'Distributor'}
                    keterangan={`${rupiah(hargaBerlaku(c.id))} / ${c.satuan} · sisa stok ${angka(c.stokTersedia)} ${c.satuan}`}
                    kanan={
                      c.id === r.penawaranId ? <Lencana nada="merek">Saran sistem</Lencana> : undefined
                    }
                  />
                )
              })}
              <p className="pt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
                Mengganti pemasok di sini hanya berlaku untuk pesanan ini. Kontrak yang sedang berjalan tidak ikut
                berubah.
              </p>
            </div>
          </Lembar>
        )
      })}

      {/* ---------------- Lembar: ingatkan nanti ---------------- */}
      {saran.baris.map((r) => {
        const b = barangDari(r.barangId)
        if (!b) return null
        const menipis = hariSampaiMenipis(b)
        /* "Kalau makin menipis" tidak berarti apa-apa untuk barang yang stoknya
           sudah nol — tidak ada lagi yang bisa menipis. Untuk barang seperti itu
           pilihan ketiganya diganti penundaan panjang, lengkap dengan akibatnya. */
        const opsi =
          statusStok(b) === 'habis'
            ? [
                {
                  nilai: 'besok',
                  label: 'Besok pagi',
                  hari: 1,
                  keterangan: 'Pengingat muncul lagi besok pukul 07.00.',
                },
                {
                  nilai: 'tiga',
                  label: '3 hari lagi',
                  hari: 3,
                  keterangan: 'Pilih ini kalau kamu sudah punya gantinya dari pasar atau toko grosir.',
                },
                {
                  nilai: 'minggu',
                  label: 'Minggu depan',
                  hari: 7,
                  keterangan: `Stok ${b.nama.toLowerCase()} sekarang 0. Selama seminggu itu menu yang memakainya belum bisa dibuat.`,
                },
              ]
            : [
                {
                  nilai: 'besok',
                  label: 'Besok pagi',
                  hari: 1,
                  keterangan: 'Pengingat muncul lagi besok pukul 07.00.',
                },
                {
                  nilai: 'tiga',
                  label: '3 hari lagi',
                  hari: 3,
                  keterangan: 'Cocok kalau stok masih cukup untuk akhir pekan.',
                },
                {
                  nilai: 'menipis',
                  label: 'Kalau makin menipis',
                  hari: menipis,
                  keterangan: `Dengan pemakaian sekarang, kira-kira ${hariLagi(menipis)}.`,
                },
              ]
        return (
          <Lembar
            key={`ingat-${r.barangId}`}
            terbuka={lembarIngat === r.barangId}
            tutup={() => setLembarIngat(null)}
            judul="Ingatkan nanti"
            keterangan={`Kapan kami ingatkan lagi soal ${b.nama}?`}
            lebar="sempit"
          >
            <div className="pb-4 space-y-2.5">
              {opsi.map((o) => (
                <PilihanKartu
                  key={o.nilai}
                  terpilih={false}
                  nilai={o.nilai}
                  ubah={() => terapkanIngatkan(r, o.hari, o.label)}
                  judul={o.label}
                  keterangan={o.keterangan}
                />
              ))}
              <p className="pt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
                Selama ditunda, barang ini tidak akan muncul lagi di pemberitahuan. Peringatan stok tetap terlihat di
                daftar Stok.
              </p>
            </div>
          </Lembar>
        )
      })}
    </div>
  )
}
