import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, Kartu, Lencana, Tombol, TombolTautan } from '@/components/ui/dasar'
import { AreaTeks } from '@/components/ui/formulir'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonBintang, IkonBintangIsi, IkonCentangLingkaran, IkonKunci, IkonPasokan } from '@/icons'
import { angka, cx, tanggalPendek } from '@/lib/format'
import { distributorById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Satu-satunya pintu masuk menulis ulasan.
 *
 * Ulasan hanya lahir dari pesanan yang benar-benar selesai diterima, dan tiap
 * ulasan membawa label sistem yang TIDAK BISA diedit penulisnya. Label itulah
 * yang membedakan pengalaman nyata dari ulasan titipan: pembacanya bisa melihat
 * berapa kali orang ini benar-benar berbelanja.
 */

const ASPEK = [
  { kunci: 'ketepatanWaktu', label: 'Ketepatan waktu kirim', bantuan: 'Datang sesuai janji atau molor?' },
  { kunci: 'jumlahSesuai', label: 'Jumlah sesuai pesanan', bantuan: 'Yang dikirim pas dengan yang dipesan?' },
  { kunci: 'kondisiBarang', label: 'Kondisi barang', bantuan: 'Utuh, segar, tidak penyok atau bocor?' },
] as const

const KATA_NILAI = ['Belum dinilai', 'Kecewa', 'Kurang', 'Biasa saja', 'Bagus', 'Bagus sekali']

/* Formulir satu alur: di layar lebar tetap satu kolom, tapi terpusat. */
const KOLOM = 'pb-6 mx-auto w-full max-w-[42rem]'

export default function BeriPenilaian() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const pesanan = useAplikasi((s) => s.pesanan.find((p) => p.id === id))
  const semuaPesanan = useAplikasi((s) => s.pesanan)
  const profil = useAplikasi((s) => s.profil)
  const tandaiSudahDiulas = useAplikasi((s) => s.tandaiSudahDiulas)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [nilai, setNilai] = useState<Record<string, number>>({
    ketepatanWaktu: 0,
    jumlahSesuai: 0,
    kondisiBarang: 0,
  })
  const [isi, setIsi] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  if (!pesanan) {
    return (
      <div className={KOLOM}>
        <KepalaHalaman judul="Beri Penilaian" kembaliKe="/pesanan" />
        <section aria-labelledby="judul-tidak-ada">
          <h2 id="judul-tidak-ada" className="sr-only">
            Pesanan tidak ditemukan
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Pesanan ini sudah tidak ada"
            pesan="Tautannya mungkin sudah lama. Semua pesanan yang bisa kamu nilai ada di daftar pesanan selesai."
            aksi={<TombolTautan ke="/pesanan?tab=pesanan&status=selesai">Lihat Pesanan Selesai</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  const selesai = pesanan.status === 'selesai' || pesanan.status === 'selesai-catatan'

  if (!selesai) {
    return (
      <div className={KOLOM}>
        <KepalaHalaman judul="Beri Penilaian" kembaliKe={`/pesanan/${pesanan.id}`} />
        <section aria-labelledby="judul-belum-bisa">
          <h2 id="judul-belum-bisa" className="sr-only">
            Penilaian belum bisa ditulis
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Penilaian terbuka setelah barang diterima"
            pesan={`${pesanan.nomor} belum kamu tandai sudah sampai. Periksa dulu barangnya, baru penilaian bisa ditulis.`}
            aksi={<TombolTautan ke={`/pesanan/${pesanan.id}`}>Kembali ke Pesanan</TombolTautan>}
          />
        </section>
      </div>
    )
  }

  if (pesanan.sudahDiulas) {
    return (
      <div className={KOLOM}>
        <KepalaHalaman judul="Beri Penilaian" kembaliKe={`/pesanan/${pesanan.id}`} />
        <section aria-labelledby="judul-sudah-dinilai">
          <h2 id="judul-sudah-dinilai" className="sr-only">
            Penilaian sudah pernah dikirim
          </h2>
          <KeadaanKosong
            ikon={<IkonCentangLingkaran size={26} />}
            judul="Pesanan ini sudah kamu nilai"
            pesan="Satu pesanan cuma bisa dinilai sekali supaya angkanya jujur. Semua ulasanmu tersimpan di Akun."
            aksi={<TombolTautan ke="/akun/ulasan">Lihat Ulasan Saya</TombolTautan>}
            aksiKedua={
              <TombolTautan ke={`/pesanan/${pesanan.id}`} ragam="garis">
                Kembali ke Pesanan
              </TombolTautan>
            }
          />
        </section>
      </div>
    )
  }

  const ps = pesanan
  const distributor = distributorById(pesanan.distributorId)
  const jumlahPesananSelesai = semuaPesanan.filter(
    (p) => p.distributorId === pesanan.distributorId && (p.status === 'selesai' || p.status === 'selesai-catatan'),
  ).length
  const sejak = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(
    new Date(profil.bergabungSejak),
  )
  const labelSistem = `Terverifikasi · ${jumlahPesananSelesai} pesanan · pelanggan sejak ${sejak}`

  function kirim() {
    const belum = ASPEK.find((a) => nilai[a.kunci] === 0)
    if (belum) {
      setGalat(
        `Bintang untuk "${belum.label}" belum diisi. Ketuk salah satu bintang di bagian itu. Contoh: 4 bintang kalau kirimannya bagus tapi tidak sempurna.`,
      )
      return
    }
    const rata = (nilai.ketepatanWaktu + nilai.jumlahSesuai + nilai.kondisiBarang) / 3
    tandaiSudahDiulas(ps.id)
    tampilkanRacun(
      `Penilaian ${angka(rata, 1)} bintang untuk ${distributor?.nama ?? 'distributor'} terkirim${
        isi.trim() ? ' bersama ceritamu' : ''
      }. Terima kasih.`,
      'aman',
    )
    navigate(`/pesanan/${ps.id}`)
  }

  return (
    <div className={KOLOM}>
      <KepalaHalaman
        judul="Beri Penilaian"
        keterangan={`${pesanan.nomor} · selesai ${tanggalPendek(pesanan.jejak[pesanan.jejak.length - 1].waktu)}`}
        kembaliKe={`/pesanan/${pesanan.id}`}
      />

      <div className="mt-4 flex items-center gap-3">
        <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={48} />
        <div className="min-w-0">
          <p className="text-[1.0625rem] font-bold text-ink leading-tight">{distributor?.nama}</p>
          <p className="text-[0.8125rem] text-ink-3">
            {pesanan.baris[0]?.nama}
            {pesanan.baris.length > 1 && ` + ${pesanan.baris.length - 1} barang lain`}
          </p>
        </div>
      </div>

      <section aria-labelledby="judul-aspek" className="mt-5">
        <h2 id="judul-aspek" className="text-[0.9375rem] font-bold text-ink">
          Nilai tiga hal ini
        </h2>
        <p className="text-[0.8125rem] text-ink-3 mt-0.5 mb-3">
          Dipisah supaya pembaca tahu apa yang bagus dan apa yang perlu diperbaiki.
        </p>

        <div className="space-y-3">
          {ASPEK.map((a) => (
            <Kartu key={a.kunci} padat>
              <p className="text-[0.9375rem] font-semibold text-ink leading-snug">{a.label}</p>
              <p className="text-[0.8125rem] text-ink-3">{a.bantuan}</p>
              <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label={a.label}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const terisi = n <= nilai[a.kunci]
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={nilai[a.kunci] === n}
                      aria-label={`${n} dari 5 bintang untuk ${a.label}`}
                      onClick={() => {
                        setNilai((s) => ({ ...s, [a.kunci]: n }))
                        setGalat(null)
                      }}
                      className={cx(
                        'size-11 grid place-items-center rounded-md transition-colors',
                        terisi ? 'text-menipis' : 'text-ink-3',
                        'hover:bg-sunken',
                      )}
                    >
                      {terisi ? <IkonBintangIsi size={28} /> : <IkonBintang size={28} />}
                    </button>
                  )
                })}
                <span
                  className={cx(
                    'ml-2 text-[0.8125rem] font-semibold',
                    nilai[a.kunci] === 0 ? 'text-ink-3' : 'text-ink',
                  )}
                >
                  {KATA_NILAI[nilai[a.kunci]]}
                </span>
              </div>
            </Kartu>
          ))}
        </div>
      </section>

      <section aria-labelledby="judul-cerita" className="mt-5">
        <h2 id="judul-cerita" className="sr-only">
          Cerita tambahan
        </h2>
        <AreaTeks
          label="Ceritanya kalau mau ditambah"
          placeholder="Contoh: Kirimannya selalu pagi, jadi bisa langsung dipakai buka toko."
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          rows={4}
          bantuan="Boleh dikosongkan. Bintangnya saja sudah cukup membantu pemilik usaha lain."
        />
      </section>

      {/* Label sistem sengaja ditampilkan sebelum dikirim: penulis berhak tahu
          persis apa yang ikut terbit bersama ulasannya. */}
      <section aria-labelledby="judul-label" className="mt-5">
        <h2 id="judul-label" className="text-[0.9375rem] font-bold text-ink mb-2">
          Yang ikut tampil di ulasanmu
        </h2>
        <Kartu padat>
          <div className="flex items-center gap-2 flex-wrap">
            <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />} besar>
              {labelSistem}
            </Lencana>
          </div>
          <p className="mt-2 flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-relaxed">
            <IkonKunci size={15} className="shrink-0 mt-0.5" />
            <span>
              Label ini dihitung sistem dari riwayat pesananmu dan tidak bisa diubah siapa pun, termasuk kamu. Nama yang
              tampil adalah {profil.namaUsaha}, {profil.kota}.
            </span>
          </p>
        </Kartu>
      </section>

      {galat && (
        <Peringatan nada="kritis" judul="Penilaian belum lengkap" className="mt-4">
          {galat}
        </Peringatan>
      )}

      <BilahAksi>
        <Tombol penuh ukuran="besar" onClick={kirim}>
          Kirim Penilaian
        </Tombol>
        <button
          type="button"
          onClick={() => navigate(`/pesanan/${ps.id}`)}
          className="w-full min-h-11 mt-1 text-[0.875rem] font-semibold text-ink-3 hover:text-ink"
        >
          Nanti saja
        </button>
      </BilahAksi>
    </div>
  )
}
