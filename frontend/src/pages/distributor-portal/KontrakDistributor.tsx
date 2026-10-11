import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Kartu, Lencana, Tombol } from '@/components/ui/dasar'
import { AreaTeks, Kolom, PengaturJumlah } from '@/components/ui/formulir'
import { Konfirmasi, Lembar } from '@/components/ui/lembar'
import { BarisChip, Chip, TabSegmen } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentangLingkaran, IkonJam, IkonKontrak, IkonPena, IkonSampah, IkonTambah } from '@/icons'
import { angka, bacaAngkaIndonesia, rupiah, tanggalPendek, waktuLalu, waktuNanti } from '@/lib/format'
import {
  ALASAN_TOLAK_BERHENTI,
  ALASAN_TOLAK_KONTRAK,
  LABEL_JENIS_USAHA,
  LABEL_KUOTA,
  NADA_KUOTA,
} from '@/lib/label'
import { distributorAktif, statusKuota, umkmById } from '@/data/dummy'
import type { KontrakPelanggan, PaketKontrak, Penawaran } from '@/lib/types'
import { useAplikasi, useKontrakMasuk, usePesananMasuk } from '@/store/aplikasi'

/**
 * Kontrak di portal distributor (catatan B1, ON-Dist 1 dan 3).
 *
 * Empat urusan, satu tab masing-masing, diurutkan menurut yang paling perlu
 * dijawab: pengajuan baru, kontrak yang berjalan, permintaan berhenti, lalu
 * paket yang ditawarkan. Pengajuan dan permintaan berhenti datang dari pemilik
 * usaha dan menunggu keputusan; selama belum dijawab, pengajuan tidak bisa
 * dipakai memesan dengan harga kontrak dan kontrak yang minta berhenti tetap
 * berjalan.
 */

type TabKontrak = 'pengajuan' | 'berjalan' | 'berhenti' | 'paket'
type Tampilan = 'toko' | 'barang'

const SEMUA_TAB: TabKontrak[] = ['pengajuan', 'berjalan', 'berhenti', 'paket']

/** Panjang catatan bebas paling pendek yang masih bisa dibaca sebagai alasan. */
const MIN_CATATAN = 5

const HURUF_PAKET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function berjalan(k: KontrakPelanggan): boolean {
  return k.status === 'aktif' || k.status === 'akan-berakhir'
}

/* ================================================================== */
/* Potongan kecil                                                     */
/* ================================================================== */

function IdentitasToko({ umkmId, kanan }: { umkmId: string; kanan?: ReactNode }) {
  const umkm = umkmById(umkmId)
  return (
    <div className="flex items-start gap-3">
      <Avatar nama={umkm?.nama ?? '?'} warna={umkm?.warna} ukuran={40} />
      <div className="min-w-0 grow">
        <p className="text-[0.9375rem] font-bold text-ink leading-snug">{umkm?.nama ?? 'Pemilik usaha'}</p>
        {umkm && (
          <p className="text-[0.8125rem] text-ink-3">
            {LABEL_JENIS_USAHA[umkm.jenisUsaha].judul} &middot; {umkm.kota}
          </p>
        )}
      </div>
      {kanan}
    </div>
  )
}

/**
 * Pemenuhan kuota bulan ini untuk satu kontrak, dari sisi distributor:
 * berapa yang sudah sampai dan berapa yang sedang di jalan. Status kuotanya
 * ditulis sebagai kata, warna batang hanya pelengkap.
 */
function BarisKuota({ kontrak, label }: { kontrak: KontrakPelanggan; label: ReactNode }) {
  const status = statusKuota(kontrak)
  const { kuota, diterima } = kontrak.periodeBerjalan
  const jalan = kontrak.dalamPerjalanan
  const persenDiterima = Math.min(100, (diterima / kuota) * 100)
  const persenJalan = Math.min(100 - persenDiterima, (jalan / kuota) * 100)
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{label}</div>
        <Lencana nada={NADA_KUOTA[status]}>{LABEL_KUOTA[status]}</Lencana>
      </div>
      <div
        role="img"
        aria-label={`${angka(diterima)} dari ${angka(kuota)} ${kontrak.satuan} sudah diterima${
          jalan > 0 ? `, ${angka(jalan)} ${kontrak.satuan} dalam perjalanan` : ''
        }`}
        className="mt-2 h-2 w-full rounded-full bg-sunken overflow-hidden flex"
      >
        <div className="h-full bg-brand" style={{ width: `${persenDiterima}%` }} />
        {persenJalan > 0 && <div className="h-full bg-info/55" style={{ width: `${persenJalan}%`, marginLeft: 2 }} />}
      </div>
      <p className="mt-1.5 text-[0.8125rem] text-ink-2 tabular">
        <strong className="text-ink">{angka(diterima)}</strong>
        {jalan > 0 && <> + {angka(jalan)} di jalan</>} dari {angka(kuota)} {kontrak.satuan} bulan ini
      </p>
    </div>
  )
}

/**
 * Lembar alasan untuk dua penolakan di halaman ini. Alasannya ikut terkirim
 * ke pemilik usaha, jadi isiannya wajib: chip siap pakai atau catatan sendiri.
 */
function LembarAlasan({
  judul,
  keterangan,
  pengantar,
  pilihan,
  labelKirim,
  kirim,
  tutup,
}: {
  judul: string
  keterangan: string
  pengantar: string
  pilihan: readonly string[]
  labelKirim: string
  kirim: (alasan: string) => void
  tutup: () => void
}) {
  const [alasanTerpilih, setAlasanTerpilih] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const catatanBersih = catatan.trim()
  const bolehKirim = alasanTerpilih !== null || catatanBersih.length >= MIN_CATATAN

  function kirimAlasan() {
    if (!bolehKirim) return
    kirim(alasanTerpilih ? (catatanBersih ? `${alasanTerpilih}. ${catatanBersih}` : alasanTerpilih) : catatanBersih)
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul={judul}
      keterangan={keterangan}
      lebar="sempit"
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Tidak jadi
          </Tombol>
          <Tombol ragam="bahaya" penuh disabled={!bolehKirim} onClick={kirimAlasan}>
            {labelKirim}
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        <p className="text-[0.875rem] text-ink-2 leading-relaxed">{pengantar}</p>
        <div>
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2.5">Alasan siap pakai</p>
          <BarisChip className="flex-wrap">
            {pilihan.map((a) => (
              <Chip key={a} aktif={alasanTerpilih === a} onClick={() => setAlasanTerpilih(alasanTerpilih === a ? null : a)}>
                {a}
              </Chip>
            ))}
          </BarisChip>
        </div>
        <AreaTeks
          label="Catatan tambahan"
          bantuan="Boleh dikosongkan kalau sudah memilih salah satu alasan di atas."
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
        {!bolehKirim && (
          <Peringatan nada="menipis" judul="Alasan wajib diisi">
            Pilih satu alasan siap pakai di atas, atau tulis sendiri minimal {MIN_CATATAN} huruf. Contoh: &ldquo;Stok
            untuk tiga bulan ke depan belum pasti.&rdquo;
          </Peringatan>
        )}
      </div>
    </Lembar>
  )
}

/* ================================================================== */
/* Formulir paket                                                     */
/* ================================================================== */

function FormPaket({
  penawaran,
  paket,
  paketLain,
  tutup,
}: {
  penawaran: Penawaran
  /** Kosong berarti paket baru. */
  paket: PaketKontrak | null
  /** Paket lain untuk barang yang sama, untuk mencegah dua paket berdurasi sama. */
  paketLain: PaketKontrak[]
  tutup: () => void
}) {
  const simpanPaket = useAplikasi((s) => s.simpanPaket)
  const [durasi, setDurasi] = useState(paket?.durasiBulan ?? 1)
  const [kuota, setKuota] = useState(paket?.kuotaMinPerBulan ?? 10)
  const [harga, setHarga] = useState(paket ? angka(paket.hargaSatuan) : '')
  const [ketentuanKurang, setKetentuanKurang] = useState(paket?.ketentuanKuotaKurang ?? '')
  const [ketentuanBerhenti, setKetentuanBerhenti] = useState(paket?.ketentuanBerhenti ?? '')
  const [dicoba, setDicoba] = useState(false)

  const eceran = penawaran.hargaSatuan
  const hargaAngka = bacaAngkaIndonesia(harga)
  const kembar = paketLain.find((p) => p.durasiBulan === durasi)
  const hemat = Number.isFinite(hargaAngka) && hargaAngka > 0 ? Math.round((1 - hargaAngka / eceran) * 100) : null

  const galatHarga = !Number.isFinite(hargaAngka) || hargaAngka <= 0
    ? `Harga kontrak belum diisi. Tulis harga per ${penawaran.satuan} dalam rupiah. Contoh: ${angka(Math.round(eceran * 0.95))}.`
    : hargaAngka > eceran
      ? `Harga kontrak lebih mahal dari harga beli sekali (${rupiah(eceran)}). Pemilik usaha tidak punya alasan memilihnya. Turunkan, misalnya ke ${angka(Math.round(eceran * 0.95))}.`
      : undefined
  const galatDurasi = kembar
    ? `Sudah ada paket ${durasi} bulan untuk barang ini (${kembar.kode}). Ubah paket itu saja, atau pilih lama kontrak yang lain.`
    : undefined

  function simpan() {
    setDicoba(true)
    if (galatHarga || galatDurasi) return
    const huruf =
      paket?.kode.replace('Kontrak ', '') ??
      HURUF_PAKET.split('').find((h) => !paketLain.some((p) => p.kode === `Kontrak ${h}`)) ??
      String(paketLain.length + 1)
    simpanPaket({
      id: paket?.id ?? `pk-${penawaran.id}-${huruf}`,
      kode: `Kontrak ${huruf}`,
      penawaranId: penawaran.id,
      distributorId: penawaran.distributorId,
      durasiBulan: durasi,
      kuotaMinPerBulan: kuota,
      hargaSatuan: Math.round(hargaAngka),
      hematPersen: Math.max(0, hemat ?? 0),
      ketentuanKuotaKurang: ketentuanKurang.trim() || null,
      ketentuanBerhenti: ketentuanBerhenti.trim() || null,
    })
    tutup()
  }

  return (
    <Lembar
      terbuka
      tutup={tutup}
      judul={paket ? `Ubah ${paket.kode}` : 'Tambah paket kontrak'}
      keterangan={`${penawaran.nama} · harga beli sekali ${rupiah(eceran)}/${penawaran.satuan}`}
      lebar="sempit"
      kunciLatar
      kaki={
        <div className="flex gap-2.5">
          <Tombol ragam="garis" penuh onClick={tutup}>
            Batal
          </Tombol>
          <Tombol penuh onClick={simpan}>
            Simpan Paket
          </Tombol>
        </div>
      }
    >
      <div className="pb-4 space-y-4">
        <div>
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2">Lama kontrak</p>
          <PengaturJumlah nilai={durasi} ubah={setDurasi} min={1} maks={12} satuan="bulan" label="Lama kontrak" />
          {dicoba && galatDurasi && (
            <p className="mt-2 text-[0.8125rem] text-kritis font-medium leading-snug">{galatDurasi}</p>
          )}
        </div>
        <div>
          <p className="text-[0.875rem] font-semibold text-ink-2 mb-2">Minimal ambil tiap bulan</p>
          <PengaturJumlah
            nilai={kuota}
            ubah={setKuota}
            min={1}
            satuan={penawaran.satuan}
            label="Minimal ambil tiap bulan"
          />
        </div>
        <Kolom
          label={`Harga kontrak per ${penawaran.satuan}`}
          wajib
          inputMode="numeric"
          awalan="Rp"
          value={harga}
          onChange={(e) => setHarga(e.target.value)}
          galat={dicoba ? galatHarga : undefined}
          bantuan={
            hemat != null && hemat >= 0
              ? `Pemilik usaha hemat ${hemat}% dari harga beli sekali.`
              : 'Biasanya sedikit di bawah harga beli sekali, sebagai imbalan kuota yang pasti.'
          }
        />
        <AreaTeks
          label="Kalau kuota tidak terpenuhi"
          rows={3}
          value={ketentuanKurang}
          onChange={(e) => setKetentuanKurang(e.target.value)}
          bantuan="Ditampilkan apa adanya kepada pemilik usaha sebelum ia menyetujui. Kosong berarti ketentuannya belum dicantumkan."
        />
        <AreaTeks
          label="Kalau ingin berhenti di tengah jalan"
          rows={3}
          value={ketentuanBerhenti}
          onChange={(e) => setKetentuanBerhenti(e.target.value)}
        />
        {paket && (
          <p className="text-[0.8125rem] text-ink-3 leading-relaxed">
            Kontrak yang sudah berjalan dengan paket ini tetap memakai ketentuan lamanya. Perubahan hanya berlaku untuk
            pengajuan berikutnya.
          </p>
        )}
      </div>
    </Lembar>
  )
}

/* ================================================================== */
/* Halaman                                                            */
/* ================================================================== */

export default function KontrakDistributor() {
  const [params, setParams] = useSearchParams()
  const semua = useKontrakMasuk()
  const pesananMasuk = usePesananMasuk()
  const paketKontrak = useAplikasi((s) => s.paketKontrak)
  const katalog = useAplikasi((s) => s.katalog)
  const setujuiKontrak = useAplikasi((s) => s.setujuiKontrak)
  const tolakKontrak = useAplikasi((s) => s.tolakKontrak)
  const jawabBerhenti = useAplikasi((s) => s.jawabBerhenti)
  const hapusPaket = useAplikasi((s) => s.hapusPaket)

  const [akanDisetujui, setAkanDisetujui] = useState<KontrakPelanggan | null>(null)
  const [akanDitolak, setAkanDitolak] = useState<KontrakPelanggan | null>(null)
  const [berhentiDisetujui, setBerhentiDisetujui] = useState<KontrakPelanggan | null>(null)
  const [berhentiDitolak, setBerhentiDitolak] = useState<KontrakPelanggan | null>(null)
  const [formPaket, setFormPaket] = useState<{ penawaran: Penawaran; paket: PaketKontrak | null } | null>(null)
  const [paketDihapus, setPaketDihapus] = useState<PaketKontrak | null>(null)

  const tabMentah = params.get('tab')
  const tab: TabKontrak = SEMUA_TAB.find((t) => t === tabMentah) ?? 'pengajuan'
  const tampilan: Tampilan = params.get('lihat') === 'barang' ? 'barang' : 'toko'

  function aturParam(kunci: string, nilai: string) {
    const baru = new URLSearchParams(params)
    baru.set(kunci, nilai)
    setParams(baru, { replace: true })
  }

  const pengajuan = useMemo(
    () =>
      semua
        .filter((k) => k.status === 'menunggu-persetujuan')
        .sort((a, b) => +new Date(b.mulai) - +new Date(a.mulai)),
    [semua],
  )
  const kontrakBerjalan = useMemo(() => semua.filter(berjalan), [semua])
  const mintaBerhenti = useMemo(() => kontrakBerjalan.filter((k) => k.pengajuanBerhenti), [kontrakBerjalan])
  const penawaranSaya = katalog.filter((p) => p.distributorId === distributorAktif.id && p.aktif !== false)
  const paketSaya = paketKontrak.filter((p) => p.distributorId === distributorAktif.id)

  /* Riwayat singkat toko yang mengajukan: bahan pertimbangan utama sebelum
     mengikat diri menyediakan barang berbulan-bulan. */
  function riwayatToko(umkmId: string): string {
    const selesai = pesananMasuk.filter((p) => p.umkmId === umkmId && p.status === 'selesai').length
    const ditolak = pesananMasuk.filter((p) => p.umkmId === umkmId && p.status === 'ditolak').length
    if (selesai === 0) return 'Belum pernah ada pesanan selesai dari toko ini.'
    return `${selesai} pesanan selesai${ditolak > 0 ? `, ${ditolak} pernah kamu tolak` : ''}.`
  }

  const perToko = useMemo(() => {
    const peta = new Map<string, KontrakPelanggan[]>()
    for (const k of kontrakBerjalan) peta.set(k.umkmId, [...(peta.get(k.umkmId) ?? []), k])
    return Array.from(peta.entries()).sort((a, b) =>
      (umkmById(a[0])?.nama ?? '').localeCompare(umkmById(b[0])?.nama ?? '', 'id'),
    )
  }, [kontrakBerjalan])

  const perBarang = useMemo(() => {
    const peta = new Map<string, KontrakPelanggan[]>()
    for (const k of kontrakBerjalan) peta.set(k.penawaranId, [...(peta.get(k.penawaranId) ?? []), k])
    return Array.from(peta.entries())
  }, [kontrakBerjalan])

  return (
    <div className="pb-6">
      <h1 className="text-[1.25rem] font-extrabold text-ink tracking-tight">Kontrak</h1>
      <p className="mt-1 text-[0.8125rem] text-ink-3 leading-snug max-w-[70ch]">
        Pengajuan dari pemilik usaha, kontrak yang sedang berjalan, dan paket yang kamu tawarkan.
      </p>

      <TabSegmen<TabKontrak>
        className="mt-4"
        aktif={tab}
        ubah={(v) => aturParam('tab', v)}
        tab={[
          { nilai: 'pengajuan', label: 'Pengajuan', jumlah: pengajuan.length },
          { nilai: 'berjalan', label: 'Berjalan', jumlah: kontrakBerjalan.length },
          { nilai: 'berhenti', label: 'Minta Berhenti', jumlah: mintaBerhenti.length },
          { nilai: 'paket', label: 'Paket Saya', jumlah: paketSaya.length },
        ]}
      />

      {/* -------------------------------------------------------------- */}
      {tab === 'pengajuan' && (
        <section aria-labelledby="judul-pengajuan" className="mt-4">
          <h2 id="judul-pengajuan" className="sr-only">
            Pengajuan kontrak yang menunggu jawaban
          </h2>
          {pengajuan.length === 0 ? (
            <Kartu>
              <KeadaanKosong
                ikon={<IkonCentangLingkaran size={26} />}
                judul="Tidak ada pengajuan yang menunggu"
                pesan="Pengajuan kontrak baru dari pemilik usaha akan muncul di sini untuk kamu setujui atau tolak."
              />
            </Kartu>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {pengajuan.map((k) => {
                const totalWajib = k.kuotaMinPerBulan * k.durasiBulan
                return (
                  <Kartu key={k.id}>
                    <IdentitasToko
                      umkmId={k.umkmId}
                      kanan={
                        <span className="shrink-0 inline-flex items-center gap-1 text-[0.75rem] text-ink-3">
                          <IkonJam size={13} /> {waktuLalu(k.mulai)}
                        </span>
                      }
                    />
                    <div className="mt-3 rounded-md bg-sunken p-3">
                      <p className="text-[0.9375rem] font-semibold text-ink leading-snug">{k.namaBarang}</p>
                      {/* Tiap potongan dikunci satu baris: "Rp" yang terpisah dari
                          angkanya di layar 360px terbaca seperti dua harga. */}
                      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                        {k.durasiBulan} bulan &middot;{' '}
                        <span className="whitespace-nowrap">
                          minimal {angka(k.kuotaMinPerBulan)} {k.satuan}/bulan
                        </span>{' '}
                        &middot;{' '}
                        <span className="whitespace-nowrap">
                          {rupiah(k.hargaSatuan)}/{k.satuan}
                        </span>
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-ink-3 tabular">
                        Total wajib {angka(totalWajib)} {k.satuan} &middot; {rupiah(totalWajib * k.hargaSatuan)}
                      </p>
                    </div>
                    <p className="mt-2.5 text-[0.8125rem] text-ink-2">{riwayatToko(k.umkmId)}</p>
                    <div className="mt-3 flex gap-2.5">
                      <Tombol ragam="garis" penuh onClick={() => setAkanDitolak(k)}>
                        Tolak
                      </Tombol>
                      <Tombol penuh onClick={() => setAkanDisetujui(k)}>
                        Setujui
                      </Tombol>
                    </div>
                  </Kartu>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------------------- */}
      {tab === 'berjalan' && (
        <section aria-labelledby="judul-berjalan" className="mt-4">
          <h2 id="judul-berjalan" className="sr-only">
            Kontrak yang sedang berjalan
          </h2>
          {kontrakBerjalan.length === 0 ? (
            <Kartu>
              <KeadaanKosong
                ikon={<IkonKontrak size={26} />}
                judul="Belum ada kontrak yang berjalan"
                pesan="Kontrak yang kamu setujui akan muncul di sini, lengkap dengan pemenuhan kuota tiap bulannya."
              />
            </Kartu>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.875rem] text-ink-2">
                  <strong className="text-ink">{kontrakBerjalan.length} kontrak</strong> dengan {perToko.length} toko
                </p>
                <BarisChip>
                  <Chip aktif={tampilan === 'toko'} onClick={() => aturParam('lihat', 'toko')}>
                    Per toko
                  </Chip>
                  <Chip aktif={tampilan === 'barang'} onClick={() => aturParam('lihat', 'barang')}>
                    Per barang
                  </Chip>
                </BarisChip>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
                {tampilan === 'toko'
                  ? perToko.map(([umkmId, daftar]) => (
                      <Kartu key={umkmId}>
                        <IdentitasToko
                          umkmId={umkmId}
                          kanan={<span className="shrink-0 text-[0.75rem] text-ink-3">{daftar.length} kontrak</span>}
                        />
                        <div className="mt-3 space-y-4">
                          {daftar.map((k) => (
                            <BarisKuota
                              key={k.id}
                              kontrak={k}
                              label={
                                <>
                                  <p className="text-[0.875rem] font-semibold text-ink leading-snug">{k.namaBarang}</p>
                                  <p className="text-[0.75rem] text-ink-3">
                                    Berakhir {tanggalPendek(k.berakhir)} ({waktuNanti(k.berakhir)})
                                    {k.pengajuanBerhenti && ' · minta berhenti'}
                                  </p>
                                </>
                              }
                            />
                          ))}
                        </div>
                      </Kartu>
                    ))
                  : perBarang.map(([penawaranId, daftar]) => {
                      const satuan = daftar[0].satuan
                      const totalKuota = daftar.reduce((a, k) => a + k.periodeBerjalan.kuota, 0)
                      const totalDiterima = daftar.reduce((a, k) => a + k.periodeBerjalan.diterima, 0)
                      return (
                        <Kartu key={penawaranId}>
                          <p className="text-[0.9375rem] font-bold text-ink leading-snug">{daftar[0].namaBarang}</p>
                          <p className="mt-0.5 text-[0.8125rem] text-ink-3 tabular">
                            {daftar.length} toko &middot; wajib {angka(totalKuota)} {satuan} bulan ini, sudah sampai{' '}
                            {angka(totalDiterima)} {satuan}
                          </p>
                          <div className="mt-3 space-y-4">
                            {daftar.map((k) => (
                              <BarisKuota
                                key={k.id}
                                kontrak={k}
                                label={
                                  <p className="text-[0.875rem] font-semibold text-ink leading-snug">
                                    {umkmById(k.umkmId)?.nama ?? 'Pemilik usaha'}
                                  </p>
                                }
                              />
                            ))}
                          </div>
                        </Kartu>
                      )
                    })}
              </div>
            </>
          )}
        </section>
      )}

      {/* -------------------------------------------------------------- */}
      {tab === 'berhenti' && (
        <section aria-labelledby="judul-berhenti" className="mt-4">
          <h2 id="judul-berhenti" className="sr-only">
            Permintaan berhenti dari pemilik usaha
          </h2>
          {mintaBerhenti.length === 0 ? (
            <Kartu>
              <KeadaanKosong
                ikon={<IkonCentangLingkaran size={26} />}
                judul="Tidak ada permintaan berhenti"
                pesan="Kalau pemilik usaha ingin berhenti sebelum masa kontraknya habis, permintaannya muncul di sini untuk kamu jawab."
              />
            </Kartu>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {mintaBerhenti.map((k) => (
                <Kartu key={k.id}>
                  <IdentitasToko
                    umkmId={k.umkmId}
                    kanan={
                      <span className="shrink-0 inline-flex items-center gap-1 text-[0.75rem] text-ink-3">
                        <IkonJam size={13} /> {waktuLalu(k.pengajuanBerhenti!.waktu)}
                      </span>
                    }
                  />
                  <div className="mt-3">
                    <BarisKuota
                      kontrak={k}
                      label={
                        <>
                          <p className="text-[0.875rem] font-semibold text-ink leading-snug">{k.namaBarang}</p>
                          <p className="text-[0.75rem] text-ink-3">
                            Masa kontrak sampai {tanggalPendek(k.berakhir)} ({waktuNanti(k.berakhir)})
                          </p>
                        </>
                      }
                    />
                  </div>
                  <p className="mt-3 rounded-md bg-sunken px-3 py-2.5 text-[0.8125rem] text-ink-2 leading-relaxed">
                    Alasan dari pemilik usaha: &ldquo;{k.pengajuanBerhenti!.alasan}&rdquo;
                  </p>
                  <div className="mt-3 flex gap-2.5">
                    <Tombol ragam="garis" penuh onClick={() => setBerhentiDitolak(k)}>
                      Tolak
                    </Tombol>
                    <Tombol penuh onClick={() => setBerhentiDisetujui(k)}>
                      Setujui Berhenti
                    </Tombol>
                  </div>
                </Kartu>
              ))}
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------------------- */}
      {tab === 'paket' && (
        <section aria-labelledby="judul-paket" className="mt-4">
          <h2 id="judul-paket" className="sr-only">
            Paket kontrak yang kamu tawarkan
          </h2>
          <p className="text-[0.8125rem] text-ink-3 leading-relaxed max-w-[70ch]">
            Paket inilah yang dipilih pemilik usaha saat mengajukan kontrak. Mengubah paket tidak mengubah kontrak yang
            sudah berjalan.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            {penawaranSaya.map((pw) => {
              const daftar = paketSaya
                .filter((p) => p.penawaranId === pw.id)
                .sort((a, b) => a.durasiBulan - b.durasiBulan)
              return (
                <Kartu key={pw.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-bold text-ink leading-snug">{pw.nama}</p>
                      <p className="text-[0.8125rem] text-ink-3">
                        Harga beli sekali {rupiah(pw.hargaSatuan)}/{pw.satuan}
                      </p>
                    </div>
                    <Tombol
                      ragam="garis"
                      ukuran="kecil"
                      ikonKiri={<IkonTambah size={15} />}
                      onClick={() => setFormPaket({ penawaran: pw, paket: null })}
                    >
                      Tambah
                    </Tombol>
                  </div>

                  {daftar.length === 0 ? (
                    <p className="mt-3 text-[0.8125rem] text-ink-2 leading-relaxed">
                      Belum ada paket. Tanpa paket, pemilik usaha hanya bisa membeli sekali untuk barang ini.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line">
                      {daftar.map((p) => {
                        const dipakai = kontrakBerjalan.filter((k) => k.paketId === p.id).length
                        return (
                          <li key={p.id} className="py-2.5 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[0.875rem] font-semibold text-ink">
                                {p.kode} &middot; {p.durasiBulan} bulan
                              </p>
                              <p className="text-[0.8125rem] text-ink-2 tabular">
                                <span className="whitespace-nowrap">
                                  Min {angka(p.kuotaMinPerBulan)} {pw.satuan}/bulan
                                </span>{' '}
                                &middot; <span className="whitespace-nowrap">{rupiah(p.hargaSatuan)}</span>
                                {p.hematPersen > 0 && ` · hemat ${p.hematPersen}%`}
                              </p>
                              {dipakai > 0 && (
                                <p className="text-[0.75rem] text-ink-3">Dipakai {dipakai} kontrak berjalan</p>
                              )}
                            </div>
                            <div className="shrink-0 flex items-center">
                              <button
                                type="button"
                                onClick={() => setFormPaket({ penawaran: pw, paket: p })}
                                aria-label={`Ubah ${p.kode} ${pw.nama}`}
                                className="size-11 grid place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
                              >
                                <IkonPena size={17} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaketDihapus(p)}
                                aria-label={`Hapus ${p.kode} ${pw.nama}`}
                                className="size-11 grid place-items-center rounded-md text-ink-2 hover:bg-kritis-soft hover:text-kritis-ink"
                              >
                                <IkonSampah size={17} />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Kartu>
              )
            })}
          </div>
        </section>
      )}

      {/* ---------------- Dialog dan lembar ---------------- */}
      <Konfirmasi
        terbuka={akanDisetujui !== null}
        tutup={() => setAkanDisetujui(null)}
        judul="Setujui kontrak ini?"
        labelSetuju="Setujui Kontrak"
        labelBatal="Belum"
        onSetuju={() => akanDisetujui && setujuiKontrak(akanDisetujui.id)}
        pesan={
          akanDisetujui && (
            <>
              Mulai hari ini {umkmById(akanDisetujui.umkmId)?.nama ?? 'pemilik usaha'} mengambil minimal{' '}
              {angka(akanDisetujui.kuotaMinPerBulan)} {akanDisetujui.satuan} {akanDisetujui.namaBarang} per bulan selama{' '}
              {akanDisetujui.durasiBulan} bulan, dengan harga {rupiah(akanDisetujui.hargaSatuan)}/{akanDisetujui.satuan}.
              Kamu wajib menyediakan barangnya selama masa itu.
            </>
          )
        }
      />

      <Konfirmasi
        terbuka={berhentiDisetujui !== null}
        tutup={() => setBerhentiDisetujui(null)}
        judul="Setujui penghentian?"
        labelSetuju="Hentikan Kontrak"
        labelBatal="Belum"
        ragamSetuju="bahaya"
        onSetuju={() => berhentiDisetujui && jawabBerhenti(berhentiDisetujui.id, true)}
        pesan={
          berhentiDisetujui && (
            <>
              Kontrak {berhentiDisetujui.namaBarang} dengan {umkmById(berhentiDisetujui.umkmId)?.nama ?? 'pemilik usaha'}{' '}
              berhenti hari ini. Pesanan berikutnya dari toko ini kembali memakai harga beli sekali.
            </>
          )
        }
      />

      <Konfirmasi
        terbuka={paketDihapus !== null}
        tutup={() => setPaketDihapus(null)}
        judul={paketDihapus ? `Hapus ${paketDihapus.kode}?` : 'Hapus paket?'}
        labelSetuju="Hapus Paket"
        labelBatal="Batal"
        ragamSetuju="bahaya"
        onSetuju={() => paketDihapus && hapusPaket(paketDihapus.id)}
        pesan="Pemilik usaha tidak bisa memilih paket ini lagi. Kontrak yang sudah berjalan dengan paket ini tidak terpengaruh."
      />

      {akanDitolak && (
        <LembarAlasan
          judul="Tolak pengajuan kontrak"
          keterangan={`${akanDitolak.namaBarang} · ${umkmById(akanDitolak.umkmId)?.nama ?? 'pemilik usaha'}`}
          pengantar="Alasannya ikut terkirim ke pemilik usaha, supaya ia bisa memilih paket lain atau distributor lain."
          pilihan={ALASAN_TOLAK_KONTRAK}
          labelKirim="Tolak Pengajuan"
          kirim={(alasan) => tolakKontrak(akanDitolak.id, alasan)}
          tutup={() => setAkanDitolak(null)}
        />
      )}

      {berhentiDitolak && (
        <LembarAlasan
          judul="Tolak permintaan berhenti"
          keterangan={`${berhentiDitolak.namaBarang} · ${umkmById(berhentiDitolak.umkmId)?.nama ?? 'pemilik usaha'}`}
          pengantar="Kontrak tetap berjalan sampai masanya habis. Alasanmu ikut terkirim ke pemilik usaha."
          pilihan={ALASAN_TOLAK_BERHENTI}
          labelKirim="Tolak Permintaan"
          kirim={(alasan) => jawabBerhenti(berhentiDitolak.id, false, alasan)}
          tutup={() => setBerhentiDitolak(null)}
        />
      )}

      {formPaket && (
        <FormPaket
          penawaran={formPaket.penawaran}
          paket={formPaket.paket}
          paketLain={paketSaya.filter(
            (p) => p.penawaranId === formPaket.penawaran.id && p.id !== formPaket.paket?.id,
          )}
          tutup={() => setFormPaket(null)}
        />
      )}
    </div>
  )
}
