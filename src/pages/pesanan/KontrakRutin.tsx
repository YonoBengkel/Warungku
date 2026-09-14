import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom, PengaturJumlah, Sakelar } from '@/components/ui/formulir'
import { BarisChip, BilahAksi, Chip, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonBulan, IkonKontrak, IkonKunci, IkonPetir } from '@/icons'
import { angka, rupiah, tanggalPendek } from '@/lib/format'
import { BANTUAN } from '@/lib/label'
import { distributorById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Pengaturan pesanan rutin untuk satu kontrak.
 *
 * Aturan yang tidak boleh dilanggar: sistem TIDAK PERNAH mengirim pesanan
 * sendiri. Yang dibuat otomatis hanyalah DRAF, dan draf yang tidak ditanggapi
 * tetap draf lalu naik jadi kartu menonjol di Beranda. Pesanan rutin yang
 * mengirim sendiri akan membuat pemilik usaha berhenti mempercayai seluruh
 * aplikasi begitu sekali saja salah kirim.
 */

type Jadwal = 'mingguan' | 'dua-mingguan' | 'tanggal'

const JADWAL: Array<{ nilai: Jadwal; label: string; perBulan: number }> = [
  { nilai: 'mingguan', label: 'Tiap minggu', perBulan: 4 },
  { nilai: 'dua-mingguan', label: 'Tiap 2 minggu', perBulan: 2 },
  { nilai: 'tanggal', label: 'Tiap tanggal tertentu', perBulan: 1 },
]

export default function KontrakRutin() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const kontrak = useAplikasi((s) => s.kontrak.find((k) => k.id === id))
  const ubahPesananRutin = useAplikasi((s) => s.ubahPesananRutin)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [jumlah, setJumlah] = useState(kontrak?.kuotaMinPerBulan ?? 1)
  const [jadwal, setJadwal] = useState<Jadwal>('mingguan')
  const [tanggalBulanan, setTanggalBulanan] = useState(20)
  const [libur, setLibur] = useState(false)

  if (!kontrak) {
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Atur Pesanan Rutin" kembaliKe="/pesanan?tab=kontrak" />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Kontrak tidak ditemukan
          </h2>
          <KeadaanKosong
            ikon={<IkonKontrak size={26} />}
            judul="Kontrak ini sudah tidak ada"
            pesan="Pesanan rutin selalu menempel pada satu kontrak. Pilih dulu kontrak yang mau diatur dari tab Pesanan."
            aksi={<TombolTautan ke="/pesanan?tab=kontrak">Lihat Kontrak Berjalan</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  const kt = kontrak
  const distributor = distributorById(kontrak.distributorId)
  const pilihanJadwal = JADWAL.find((j) => j.nilai === jadwal) ?? JADWAL[0]
  const perBulan = jumlah * pilihanJadwal.perBulan
  const cukupKuota = perBulan >= kontrak.kuotaMinPerBulan

  /**
   * Tombol simpan tidak boleh diam-diam menyalakan pesanan rutin yang sengaja
   * dimatikan pemiliknya. Kalau sakelarnya mati, label tombolnya menyebut
   * penyalaan itu terang-terangan sehingga tidak ada kejutan.
   */
  function simpan() {
    const sebelumnyaMati = !kt.pesananRutinAktif
    ubahPesananRutin(kt.id, true)
    tampilkanRacun(
      sebelumnyaMati
        ? `Pesanan rutin ${kt.namaBarang} dinyalakan dan jadwalnya tersimpan. Draf pertama muncul H-2 sebelum jadwal, bukan langsung terkirim.`
        : `Jadwal pesanan rutin ${kt.namaBarang} tersimpan. Drafnya muncul H-2 sebelum jadwal, bukan langsung terkirim.`,
      'aman',
    )
    navigate(`/kontrak/${kt.id}`)
  }

  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Atur Pesanan Rutin"
        keterangan={`${kontrak.namaBarang} · ${distributor?.nama ?? 'Distributor'}`}
        kembaliKe={`/kontrak/${kontrak.id}`}
      />

      {/* Semua blok masuk ke dalam satu kisi dua kolom di layar lebar: kolom
          kiri menjawab "apa dan berapa", kolom kanan "kapan dan bagaimana". */}
      <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
        <div className="space-y-4">
          <section aria-labelledby="judul-sakelar">
            <h2 id="judul-sakelar" className="sr-only">
              Sakelar pesanan rutin
            </h2>
            <Kartu>
              <Sakelar
                aktif={kontrak.pesananRutinAktif}
                ubah={(v) => {
                  ubahPesananRutin(kt.id, v)
                  tampilkanRacun(
                    v
                      ? 'Pesanan rutin dinyalakan. Draf pertama dibuat H-2 sebelum jadwal.'
                      : 'Pesanan rutin dimatikan. Tidak ada draf baru yang dibuat.',
                    v ? 'aman' : 'info',
                  )
                }}
                label="Nyalakan pesanan rutin"
                keterangan="Sistem menyiapkan draf pesanan sesuai jadwal di halaman ini. Kamu tetap yang menekan kirim."
              />
              {kontrak.pesananRutinAktif && kontrak.pesananRutinBerikutnya && (
                <p className="mt-1 text-[0.8125rem] text-ink-2">
                  Jadwal berikutnya <strong className="text-ink">{tanggalPendek(kontrak.pesananRutinBerikutnya)}</strong>.
                </p>
              )}
            </Kartu>
            {!kontrak.pesananRutinAktif && (
              <Peringatan nada="netral" className="mt-3">
                Pesanan rutin sedang mati. Pengaturan di halaman ini tetap bisa kamu siapkan, dan mulai berjalan begitu
                sakelarnya dinyalakan.
              </Peringatan>
            )}
          </section>

          {/* Barang terkunci: satu kontrak mengikat tepat satu barang. */}
          <section aria-labelledby="judul-barang">
            <h2 id="judul-barang" className="text-[0.9375rem] font-bold text-ink mb-2">
              Barang
            </h2>
            <Kartu padat>
              <div className="flex items-start gap-3">
                <span className="shrink-0 size-9 rounded-md grid place-items-center bg-sunken text-ink-3">
                  <IkonKunci size={18} />
                </span>
                <div className="min-w-0 grow">
                  <p className="text-[1rem] font-semibold text-ink leading-snug">{kontrak.namaBarang}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                    {rupiah(kontrak.hargaSatuan)} per {kontrak.satuan} &middot; harga kontrak
                  </p>
                </div>
                <Lencana nada="netral">Terkunci</Lencana>
              </div>
              <p className="mt-2 text-[0.8125rem] text-ink-3 leading-relaxed">
                {BANTUAN.satuKontrakSatuBarang} Barangnya tidak bisa diganti di sini. Kalau kamu mau barang lain rutin
                juga, buat kontrak sendiri untuk barang itu.
              </p>
            </Kartu>
          </section>

          <section aria-labelledby="judul-jumlah">
            <h2 id="judul-jumlah" className="text-[0.9375rem] font-bold text-ink mb-2">
              Jumlah per pengiriman
            </h2>
            <Kartu padat>
              <PengaturJumlah
                nilai={jumlah}
                ubah={setJumlah}
                min={1}
                maks={kontrak.kuotaMinPerBulan * 6}
                satuan={kontrak.satuan}
                saranModel={kontrak.kuotaMinPerBulan}
                label="Jumlah per pengiriman"
              />
              <p className="mt-3 text-[0.8125rem] text-ink-2 leading-relaxed">
                {pilihanJadwal.label.toLowerCase()} {angka(jumlah)} {kontrak.satuan} berarti kira-kira{' '}
                <strong className="text-ink">
                  {angka(perBulan)} {kontrak.satuan}
                </strong>{' '}
                per bulan. Kuota kontrak {angka(kontrak.kuotaMinPerBulan)} {kontrak.satuan} per bulan.
              </p>
              <Pemisah className="my-2.5" />
              <p className={`text-[0.8125rem] font-semibold ${cukupKuota ? 'text-aman-ink' : 'text-menipis-ink'}`}>
                {cukupKuota
                  ? 'Jadwal ini sudah cukup menutup kuota bulanan.'
                  : 'Jadwal ini belum menutup kuota bulanan. Sisanya perlu kamu pesan manual.'}
              </p>
            </Kartu>
          </section>
        </div>

        <div className="space-y-4">
          <section aria-labelledby="judul-jadwal">
            <h2 id="judul-jadwal" className="text-[0.9375rem] font-bold text-ink mb-2">
              Jadwal
            </h2>
            <Kartu padat>
              <BarisChip className="flex-wrap">
                {JADWAL.map((j) => (
                  <Chip key={j.nilai} aktif={jadwal === j.nilai} onClick={() => setJadwal(j.nilai)}>
                    {j.label}
                  </Chip>
                ))}
              </BarisChip>

              {jadwal === 'tanggal' && (
                <div className="mt-3">
                  <Kolom
                    label="Tanggal tiap bulan"
                    wajib
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={28}
                    value={tanggalBulanan}
                    onChange={(e) => setTanggalBulanan(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                    bantuan="Pilih 1 sampai 28 supaya jadwalnya tetap ada di setiap bulan, termasuk Februari."
                  />
                </div>
              )}
            </Kartu>
          </section>

          {/* Perilaku sistem ditulis apa adanya, bukan disembunyikan di bantuan. */}
          <section aria-labelledby="judul-cara-kerja">
            <h2 id="judul-cara-kerja" className="text-[0.9375rem] font-bold text-ink mb-2">
              Cara kerjanya
            </h2>
            <Kartu padat>
              <ol className="space-y-3">
                <LangkahRutin
                  nomor={1}
                  judul="H-2 sebelum jadwal, draf dibuat"
                  detail={`Sistem menyiapkan draf "${kontrak.namaBarang} ${angka(jumlah)} ${kontrak.satuan} ke ${distributor?.nama ?? 'distributor'}" dan mengirim pemberitahuan ke HP kamu.`}
                />
                <LangkahRutin
                  nomor={2}
                  judul="Kamu periksa dan tekan kirim"
                  detail="Jumlahnya masih bisa diubah. Pesanan baru sampai ke distributor setelah kamu menekan Kirim Pesanan Sekarang."
                />
                <LangkahRutin
                  nomor={3}
                  judul="Kalau tidak ditanggapi, draf tetap draf"
                  detail="Tidak pernah terkirim sendiri. Drafnya naik jadi kartu menonjol di Beranda sampai kamu urus."
                />
              </ol>
            </Kartu>
          </section>

          <section aria-labelledby="judul-libur">
            <h2 id="judul-libur" className="sr-only">
              Jeda pesanan rutin
            </h2>
            {libur ? (
              <Peringatan
                nada="info"
                judul="Bulan ini diliburkan"
                aksi={
                  <Tombol ragam="garis" ukuran="kecil" onClick={() => setLibur(false)}>
                    Batalkan libur
                  </Tombol>
                }
              >
                Tidak ada draf yang dibuat sampai bulan depan. Kuota kontrak tetap berjalan, jadi kalau perlu kamu masih
                bisa memesan manual dari halaman kontrak.
              </Peringatan>
            ) : (
              <Tombol
                ragam="garis"
                penuh
                ikonKiri={<IkonBulan size={16} />}
                onClick={() => {
                  setLibur(true)
                  tampilkanRacun('Pesanan rutin diliburkan untuk bulan ini.', 'info')
                }}
              >
                Libur dulu bulan ini
              </Tombol>
            )}
          </section>
        </div>
      </div>

      <BilahAksi
        ringkasan={
          <p className="text-[0.8125rem] text-ink-2 leading-snug max-w-[70ch]">
            <IkonPetir size={14} className="inline align-[-2px] mr-1" />
            {pilihanJadwal.label}
            {jadwal === 'tanggal' ? ` (tanggal ${tanggalBulanan})` : ''} &middot; {angka(jumlah)} {kontrak.satuan} per
            pengiriman &middot; draf, bukan kirim otomatis.
            {libur && ' Bulan ini diliburkan, jadi draf berikutnya baru dibuat bulan depan.'}
          </p>
        }
      >
        <Tombol penuh ukuran="besar" onClick={simpan}>
          {kontrak.pesananRutinAktif ? 'Simpan Jadwal Rutin' : 'Nyalakan & Simpan Jadwal Rutin'}
        </Tombol>
      </BilahAksi>
    </div>
  )
}

function LangkahRutin({ nomor, judul, detail }: { nomor: number; judul: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 size-7 rounded-full grid place-items-center bg-brand-soft text-brand-soft-ink text-[0.8125rem] font-extrabold tabular">
        {nomor}
      </span>
      <div className="min-w-0">
        <p className="text-[0.875rem] font-bold text-ink leading-snug">{judul}</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-2 leading-relaxed">{detail}</p>
      </div>
    </li>
  )
}
