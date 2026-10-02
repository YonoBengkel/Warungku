import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom, PengaturJumlah } from '@/components/ui/formulir'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonKotak, IkonPetir, IkonCentang } from '@/icons'
import { angka } from '@/lib/format'
import {
  angkaTampil,
  dariTampil,
  desimalTampil,
  jumlahTampil,
  keTampilBulat,
  langkahTampil,
  satuanTampil,
} from '@/lib/satuan'
import { BANTUAN, JUDUL } from '@/lib/label'
import { BATAS_AMAN_BAWAAN } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Batas aman hibrida: sistem menyarankan, pemilik memutuskan.
 *
 * Saran ditulis sebagai KALIMAT, bukan rumus. Pemilik warung tidak perlu tahu
 * "safety stock = lead time x demand"; ia perlu tahu kenapa angkanya delapan.
 * Begitu alasannya bisa dibaca, angka yang diatur sendiri pun jadi lebih masuk
 * akal, dan itu yang membuat pengingat stok tipis dipercaya.
 */
export default function StokBatasAman() {
  const { id = '' } = useParams()
  const navigasi = useNavigate()
  const barang = useAplikasi((s) => s.barang.find((b) => b.id === id))
  const aturBatasAman = useAplikasi((s) => s.aturBatasAman)
  const ubahBarang = useAplikasi((s) => s.ubahBarang)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [aturSendiri, setAturSendiri] = useState(false)
  /* Angka di kolom ini dalam SATUAN TAMPIL (kg, liter, dus); dikonversi ke
     satuan simpan hanya saat disimpan. */
  const [nilai, setNilai] = useState(() => (barang ? keTampilBulat(barang, barang.batasAman) : 0))
  const [hariKirim, setHariKirim] = useState(() => String(barang?.hariKirim ?? 2))
  const [saranDitutup, setSaranDitutup] = useState(false)
  const [dicoba, setDicoba] = useState(false)

  if (!barang) {
    return (
      <>
        <KepalaHalaman judul={JUDUL.batasAman} kembaliKe="/stok" />
        <KeadaanKosong
          ikon={<IkonKotak size={26} />}
          judul="Barang ini tidak ada di daftar stok"
          pesan="Batas aman hanya bisa diatur untuk barang yang sudah tercatat. Daftar stok yang sekarang masih lengkap."
          aksi={<TombolTautan ke="/stok">Kembali ke Daftar Stok</TombolTautan>}
        />
      </>
    )
  }

  const saran = barang.batasAmanSaran
  const hariKirimAngka = Math.max(0, Number(hariKirim) || 0)
  const hariKirimGalat =
    hariKirim.trim() !== '' && (!Number.isFinite(Number(hariKirim)) || Number(hariKirim) < 0)
      ? 'Isi dengan angka hari, mulai dari 0. Contoh: 3.'
      : undefined

  const lencanaSumber =
    barang.sumberBatasAman === 'sistem'
      ? { nada: 'info' as const, teks: 'Disarankan sistem' }
      : barang.sumberBatasAman === 'sendiri'
        ? { nada: 'netral' as const, teks: 'Diatur sendiri' }
        : { nada: 'menipis' as const, teks: `Bawaan ${BATAS_AMAN_BAWAAN}` }

  /* Kalau pemakaian belakangan naik jauh dari angka yang diatur sendiri, kami
     bertanya sekali dengan tenang. Mengubahnya diam-diam akan membuat pemilik
     kehilangan kepercayaan pada seluruh pengingat. */
  const usulanNaik =
    barang.sumberBatasAman === 'sendiri' &&
    barang.batasAman > 0 &&
    saran >= barang.batasAman * 1.3 &&
    !saranDitutup

  const kalimatSaran =
    barang.pemakaianHarian > 0
      ? `Disarankan ${jumlahTampil(barang, saran)}. Biasanya habis ${jumlahTampil(
          barang,
          barang.pemakaianHarian,
        )} per hari, dan barang ini sampai ${barang.hariKirim} hari setelah dipesan.`
      : `Disarankan ${jumlahTampil(barang, saran)}. Pemakaian hariannya belum terbaca, jadi angka ini masih kasar dan akan kami perbarui setelah ada riwayat penjualan.`

  /* Ditulis sebagai const supaya penjagaan "barang tidak ditemukan" di atas
     tetap berlaku di dalam kedua penangan ini. */
  const pakaiSaran = () => {
    aturBatasAman(barang.id, saran, 'sistem')
    tampilkanRacun(
      `Batas aman ${barang.nama} jadi ${jumlahTampil(barang, saran)}, mengikuti saran sistem.`,
      'aman',
    )
    navigasi(`/stok/${barang.id}`)
  }

  /* Batas aman 0 sama artinya dengan mematikan pengingat diam-diam: stok tidak
     pernah dianggap menipis sampai benar-benar habis. Kalau memang itu yang
     dimau, sakelar "dicatat manual" di Ubah Barang tempatnya, bukan di sini. */
  const nilaiGalat =
    dicoba && nilai <= 0
      ? `Batas aman harus lebih dari 0, kalau tidak kami tidak punya angka untuk mengingatkan kamu. Contoh: ${
          saran > 0 ? angkaTampil(barang, saran) : 10
        }.`
      : undefined

  const simpanSendiri = () => {
    setDicoba(true)
    if (hariKirimGalat || nilai <= 0) return
    aturBatasAman(barang.id, dariTampil(barang, nilai), 'sendiri')
    if (hariKirimAngka !== barang.hariKirim) ubahBarang(barang.id, { hariKirim: hariKirimAngka })
    tampilkanRacun(
      `Batas aman ${barang.nama} kamu atur jadi ${angkaTampil(barang, dariTampil(barang, nilai))} ${satuanTampil(barang).nama}.`,
      'aman',
    )
    navigasi(`/stok/${barang.id}`)
  }

  return (
    <div className="pb-8">
      <KepalaHalaman judul={JUDUL.batasAman} keterangan={barang.nama} kembaliKe={`/stok/${barang.id}`} />

      <div className="mt-4 max-w-2xl mx-auto space-y-4">
        {/* ---- Angka yang berlaku sekarang ---- */}
        <Kartu>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.8125rem] text-ink-3">Batas aman sekarang</p>
              <p className="mt-0.5 text-[1.75rem] font-extrabold text-ink leading-none">
                {barang.batasAman > 0 ? jumlahTampil(barang, barang.batasAman) : 'Belum diisi'}
              </p>
            </div>
            <Lencana nada={lencanaSumber.nada} besar>
              {lencanaSumber.teks}
            </Lencana>
          </div>
          <p className="mt-2.5 text-[0.875rem] text-ink-2 leading-relaxed">{BANTUAN.batasAman}</p>
          <Pemisah className="my-3" />
          <p className="text-[0.8125rem] text-ink-3 leading-relaxed">
            Sisa tercatat sekarang {jumlahTampil(barang, Math.max(0, barang.stok))}.
          </p>
        </Kartu>

        {usulanNaik && (
          <Peringatan
            nada="menipis"
            judul="Belakangan barang ini lebih cepat habis"
            aksi={
              <div className="flex gap-2.5">
                <Tombol ukuran="kecil" onClick={pakaiSaran}>
                  Ya
                </Tombol>
                <Tombol ragam="garis" ukuran="kecil" onClick={() => setSaranDitutup(true)}>
                  Biarkan
                </Tombol>
              </div>
            }
          >
            Naikkan batas aman jadi {jumlahTampil(barang, saran)}? Kami tidak mengubahnya sendiri karena
            angka yang kamu atur biasanya punya alasan yang tidak terbaca dari data.
          </Peringatan>
        )}

        {/* ---- Saran dalam kalimat ---- */}
        <Kartu>
          <div className="flex items-start gap-3">
            <span className="shrink-0 size-9 rounded-md bg-info-soft text-info-ink grid place-items-center">
              <IkonPetir size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">Saran kami</h2>
              <p className="mt-1 text-[1rem] text-ink-2 leading-relaxed">{kalimatSaran}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <Tombol penuh onClick={pakaiSaran} ikonKiri={<IkonCentang size={16} />}>
              Pakai saran ini
            </Tombol>
            <Tombol
              ragam="garis"
              penuh
              aria-expanded={aturSendiri}
              onClick={() => {
                setAturSendiri(true)
                setNilai(keTampilBulat(barang, barang.batasAman > 0 ? barang.batasAman : saran))
              }}
            >
              Atur sendiri
            </Tombol>
          </div>
        </Kartu>

        {/* ---- Atur sendiri ---- */}
        {aturSendiri && (
          <Kartu className="anim-muncul">
            <h2 className="text-[0.9375rem] font-bold text-ink leading-tight">Atur sendiri</h2>
            <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
              Kalau kamu tahu ada hari ramai yang tidak terbaca dari data, angka kamu yang dipakai.
            </p>

            <div className="mt-3.5">
              <PengaturJumlah
                nilai={nilai}
                ubah={setNilai}
                langkah={langkahTampil(barang)}
                desimal={desimalTampil(barang)}
                min={0}
                satuan={satuanTampil(barang).nama}
                saranModel={keTampilBulat(barang, saran)}
                label="Batas aman"
              />
              {nilaiGalat && (
                <p className="mt-2 text-[0.8125rem] text-kritis font-medium leading-snug">{nilaiGalat}</p>
              )}
            </div>

            <div className="mt-4">
              <Kolom
                label="Biasanya barang sampai berapa hari?"
                type="number"
                inputMode="numeric"
                min={0}
                value={hariKirim}
                onChange={(e) => setHariKirim(e.target.value)}
                akhiran="hari"
                galat={hariKirimGalat}
                bantuan="Dihitung dari tanggal kamu memesan sampai barangnya benar-benar sampai. Makin lama kiriman, makin tinggi batas amannya."
              />
            </div>

            {barang.pemakaianHarian > 0 && nilai > 0 && (
              <p className="mt-3 text-[0.875rem] text-ink-2 leading-relaxed">
                Dengan angka ini, kami mengingatkan kamu saat sisa tinggal{' '}
                <strong className="text-ink">
                  {angka(nilai, desimalTampil(barang))} {satuanTampil(barang).nama}
                </strong>{' '}
                &mdash; kira-kira{' '}
                <strong className="text-ink">
                  {angka(Math.floor(dariTampil(barang, nilai) / barang.pemakaianHarian))} hari
                </strong>{' '}
                sebelum benar-benar habis.
                {hariKirimAngka > Math.floor(dariTampil(barang, nilai) / barang.pemakaianHarian) && (
                  <>
                    {' '}
                    Kiriman butuh {hariKirimAngka} hari, jadi angka ini berisiko membuat kamu kehabisan
                    sebelum barang sampai.
                  </>
                )}
              </p>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
              <Tombol penuh onClick={simpanSendiri}>
                Simpan Batas Aman
              </Tombol>
              <Tombol ragam="garis" penuh onClick={() => setAturSendiri(false)}>
                Batal
              </Tombol>
            </div>
          </Kartu>
        )}
      </div>
    </div>
  )
}
