import { useState } from 'react'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import { JudulBagian, Kartu, Lencana, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom, PilihanKartu } from '@/components/ui/formulir'
import { Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentang, IkonCentangLingkaran, IkonSalin, IkonSilang } from '@/icons'
import { nomorHp as formatHp } from '@/lib/format'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Undangan berakhir sebagai tautan yang disalin, bukan pesan yang dikirim
 * aplikasi ini.
 *
 * Alasannya praktis: pemilik warung sudah punya percakapan WhatsApp dengan
 * orang yang diundang, dan pesan dari nomor asing lebih sering diabaikan
 * daripada pesan dari bosnya sendiri. Jadi layar ini berhenti di tautan yang
 * siap ditempel, dan menjelaskan apa yang terjadi setelah tautan itu dibuka.
 */

type Peran = 'manajer' | 'kasir'

const PERAN: Record<Peran, { nama: string; ringkas: string; boleh: string[]; tidakBoleh: string[] }> = {
  kasir: {
    nama: 'Kasir',
    ringkas: 'Untuk yang menjaga warung tiap hari.',
    boleh: ['Lihat stok', 'Catat pemakaian & koreksi stok', 'Hitung stok', 'Terima kiriman yang datang'],
    tidakBoleh: ['Buat pesanan', 'Ajukan kontrak', 'Ubah pengaturan usaha'],
  },
  manajer: {
    nama: 'Manajer',
    ringkas: 'Untuk yang kamu percaya belanja atas nama usahamu.',
    boleh: ['Semua yang bisa Kasir lakukan', 'Buat pesanan ke distributor', 'Ajukan kontrak', 'Ubah batas aman'],
    tidakBoleh: ['Tambah atau hapus pengguna', 'Ubah Data Usaha & Legalitas'],
  },
}

const LANGKAH: Array<{ judul: string; isi: string }> = [
  {
    judul: 'Kamu buat tautannya.',
    isi: 'Isi nama dan nomor HP-nya, pilih peran, lalu tekan Buat Tautan Undangan.',
  },
  {
    judul: 'Kamu kirim sendiri lewat WhatsApp.',
    isi: 'Tautannya kamu salin dan tempel di percakapanmu dengan dia. Kami tidak mengirim pesan apa pun atas namamu.',
  },
  {
    judul: 'Dia buka tautan dan bikin kata sandi.',
    isi: 'Setelah itu namanya langsung muncul di daftar Pengguna & Hak Akses. Tautannya berlaku 7 hari dan sekali pakai.',
  },
]

const ID_NAMA = 'undang-nama'
const ID_HP = 'undang-hp'

function kodeUndangan(): string {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hasil = ''
  for (let i = 0; i < 6; i += 1) hasil += huruf[Math.floor(Math.random() * huruf.length)]
  return hasil
}

export default function PenggunaUndang() {
  const namaUsaha = useAplikasi((s) => s.profil.namaUsaha)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [nama, setNama] = useState('')
  const [hp, setHp] = useState('')
  const [peran, setPeran] = useState<Peran>('kasir')
  const [disentuh, setDisentuh] = useState(false)
  const [terkirim, setTerkirim] = useState<{ nama: string; hp: string; peran: Peran; tautan: string } | null>(null)

  const angkaHp = hp.replace(/\D/g, '')
  const galatNama = nama.trim().length >= 2 ? undefined : 'Nama belum diisi. Tulis nama panggilan yang kamu pakai sehari-hari. Contoh: Sinta.'
  const galatHp =
    angkaHp.startsWith('08') && angkaHp.length >= 10 && angkaHp.length <= 13
      ? undefined
      : 'Nomor HP harus diawali 08 dan berisi 10-13 angka. Contoh: 081234567890.'
  const bolehKirim = !galatNama && !galatHp

  function buatTautan() {
    setDisentuh(true)
    if (!bolehKirim) {
      /* Tombolnya lengket di bawah layar, jadi pesan galat di atas bisa lolos
         dari pandangan. Fokus dipindah supaya kolom yang salah terbaca. */
      const id = galatNama ? ID_NAMA : ID_HP
      document.getElementById(id)?.focus()
      return
    }
    setTerkirim({ nama: nama.trim(), hp: angkaHp, peran, tautan: `warungku.id/gabung/${kodeUndangan()}` })
  }

  async function salin(teks: string) {
    try {
      await navigator.clipboard.writeText(teks)
      tampilkanRacun('Tautan undangan tersalin. Tinggal tempel di WhatsApp.', 'aman')
    } catch {
      /* Penyalinan otomatis diblokir peramban: tautan tetap terlihat dan bisa
         disalin manual, jadi alurnya tidak pernah buntu. */
      tampilkanRacun('Tautannya belum bisa disalin otomatis. Tahan tautan di atas lalu salin sendiri.', 'menipis')
    }
  }

  /* ---------------- Keadaan terkirim ---------------- */
  if (terkirim) {
    const pesanWa = `Halo ${terkirim.nama}, ini tautan buat masuk ke aplikasi stok ${namaUsaha}: https://${terkirim.tautan}`
    return (
      <div className="pb-6">
        <KepalaHalaman judul="Tambah Pengguna" kembaliKe="/akun/pengguna" />

        <div className="mt-4 max-w-xl mx-auto">
          <div className="text-center">
            <span className="inline-grid place-items-center size-14 rounded-xl bg-aman-soft text-aman-ink">
              <IkonCentangLingkaran size={28} />
            </span>
            <h2 className="mt-3 text-[1.25rem] font-extrabold text-ink tracking-tight">Undangan siap dikirim</h2>
            <p className="mt-1.5 text-[0.875rem] text-ink-2 leading-relaxed max-w-[40ch] mx-auto">
              Salin tautan di bawah lalu kirim ke {terkirim.nama} lewat WhatsApp. Dia masuk dengan nomor HP-nya
              sendiri, bukan memakai akunmu.
            </p>
          </div>

          <Kartu className="mt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[1rem] font-semibold text-ink">{terkirim.nama}</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3 tabular">{formatHp(terkirim.hp)}</p>
              </div>
              <Lencana nada={terkirim.peran === 'manajer' ? 'info' : 'netral'} besar>
                {PERAN[terkirim.peran].nama}
              </Lencana>
            </div>

            <Pemisah className="my-4" />

            <p className="text-[0.8125rem] font-semibold text-ink-2 mb-1.5">Tautan undangan</p>
            <p className="rounded-md bg-sunken border border-line px-3.5 py-3 text-[0.9375rem] font-semibold text-ink break-all select-all">
              {terkirim.tautan}
            </p>

            <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
              <Tombol penuh ikonKiri={<IkonSalin size={16} />} onClick={() => salin(`https://${terkirim.tautan}`)}>
                Salin Tautan
              </Tombol>
              <Tombol ragam="garis" penuh ikonKiri={<IkonSalin size={16} />} onClick={() => salin(pesanWa)}>
                Salin Pesan Lengkap
              </Tombol>
            </div>

            <p className="mt-3 text-[0.8125rem] text-ink-3 leading-relaxed">
              Tautan ini berlaku 7 hari dan hanya bisa dipakai sekali. Kalau kedaluwarsa, buat undangan baru dari
              halaman Pengguna &amp; Hak Akses.
            </p>
          </Kartu>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <TombolTautan ke="/akun/pengguna" ragam="garis" penuh>
              Kembali ke Daftar Pengguna
            </TombolTautan>
            <Tombol
              ragam="sunyi"
              penuh
              onClick={() => {
                setTerkirim(null)
                setNama('')
                setHp('')
                setDisentuh(false)
              }}
            >
              Undang Orang Lain
            </Tombol>
          </div>
        </div>
      </div>
    )
  }

  /* ---------------- Formulir ---------------- */
  return (
    <div className="pb-6">
      <KepalaHalaman
        judul="Tambah Pengguna"
        keterangan="Undang lewat nomor HP"
        kembaliKe="/akun/pengguna"
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-6">
          <section aria-label="Siapa yang kamu undang">
            <JudulBagian judul="Siapa yang kamu undang" className="mb-3" />
            <Kartu className="space-y-4">
              <Kolom
                id={ID_NAMA}
                label="Nama"
                wajib
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Sinta"
                autoComplete="name"
                galat={disentuh ? galatNama : undefined}
                bantuan="Nama ini yang muncul di riwayat koreksi stok, supaya kamu tahu siapa mencatat apa."
              />
              <Kolom
                id={ID_HP}
                label="Nomor HP"
                wajib
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="081234567890"
                inputMode="numeric"
                autoComplete="tel"
                galat={disentuh ? galatHp : undefined}
                bantuan="Nomor ini yang dia pakai untuk masuk. Pastikan nomornya aktif di WhatsApp."
              />
            </Kartu>
          </section>

          <section aria-label="Dia boleh melakukan apa">
            <JudulBagian
              judul="Dia boleh melakukan apa"
              keterangan="Bisa diubah kapan saja dari halaman Pengguna & Hak Akses."
              className="mb-3"
            />
            <div className="space-y-3">
              {(['kasir', 'manajer'] as Peran[]).map((kunci) => {
                const info = PERAN[kunci]
                return (
                  <PilihanKartu
                    key={kunci}
                    nilai={kunci}
                    terpilih={peran === kunci}
                    ubah={(v) => setPeran(v as Peran)}
                    judul={info.nama}
                    keterangan={info.ringkas}
                    anakan={
                      <span className="mt-2.5 block">
                        <span className="block text-[0.75rem] font-bold uppercase tracking-wide text-ink-3">
                          Boleh
                        </span>
                        <span className="mt-1 block space-y-1.5">
                          {info.boleh.map((b) => (
                            <span
                              key={b}
                              className="flex items-start gap-2 text-[0.8125rem] text-ink-2 leading-snug"
                            >
                              <IkonCentang size={15} className="shrink-0 mt-0.5 text-aman" />
                              {b}
                            </span>
                          ))}
                        </span>
                        <span className="mt-2.5 block text-[0.75rem] font-bold uppercase tracking-wide text-ink-3">
                          Tidak boleh
                        </span>
                        <span className="mt-1 block space-y-1.5">
                          {info.tidakBoleh.map((b) => (
                            <span
                              key={b}
                              className="flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-snug"
                            >
                              <IkonSilang size={15} className="shrink-0 mt-0.5" />
                              {b}
                            </span>
                          ))}
                        </span>
                      </span>
                    }
                  />
                )
              })}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 mt-6 lg:mt-0 space-y-4">
          <Kartu>
            <JudulBagian judul="Tiga langkah sampai dia bisa masuk" className="mb-3" />
            <ol className="space-y-3.5">
              {LANGKAH.map((l, i) => (
                <li key={l.judul} className="flex items-start gap-3">
                  <span className="shrink-0 size-6 rounded-full bg-sunken text-ink-2 text-[0.8125rem] font-bold grid place-items-center tabular">
                    {i + 1}
                  </span>
                  <p className="text-[0.875rem] text-ink-2 leading-relaxed">
                    <strong className="text-ink">{l.judul}</strong> {l.isi}
                  </p>
                </li>
              ))}
            </ol>
          </Kartu>

          <Peringatan nada="info" judul="Yang terjadi setelah tautan dibuka">
            Orang yang kamu undang membuat kata sandinya sendiri dan masuk dengan nomor HP-nya. Dia tidak pernah
            melihat kata sandimu, dan kamu bisa mencabut aksesnya kapan saja tanpa memutus riwayat yang sudah dia
            catat.
          </Peringatan>
        </div>
      </div>

      {/* Labelnya menyebut akibat yang sebenarnya: aplikasi ini tidak mengirim
          apa pun, ia membuat tautan yang kamu kirim sendiri lewat WhatsApp. */}
      <BilahAksi
        ringkasan={
          <p className="text-[0.8125rem] text-ink-3 text-center leading-snug">
            {nama.trim() ? `${nama.trim()} akan masuk sebagai ${PERAN[peran].nama}` : `Peran: ${PERAN[peran].nama}`}
          </p>
        }
      >
        <Tombol penuh ukuran="besar" onClick={buatTautan}>
          Buat Tautan Undangan
        </Tombol>
      </BilahAksi>
    </div>
  )
}
