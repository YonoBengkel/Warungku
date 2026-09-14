import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Kartu, Pemisah, Tombol, TombolTautan } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonPeringatan, IkonSalin, IkonSinkron, IkonTanpaSinyal } from '@/icons'
import { cx } from '@/lib/format'
import { merekKasir } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

type Hasil = 'belum' | 'menguji' | 'berhasil' | 'gagal'

const LANGKAH = [
  {
    nomor: 1 as const,
    judul: 'Buka menu Pengaturan di aplikasi kasirmu',
    detail: 'Biasanya ikon roda gigi di pojok, atau menu paling bawah di daftar sebelah kiri.',
  },
  {
    nomor: 2 as const,
    judul: 'Masuk ke bagian Integrasi',
    detail: 'Di dalamnya ada daftar aplikasi lain yang boleh membaca data penjualanmu.',
  },
  {
    nomor: 3 as const,
    judul: 'Salin kode sambungan yang muncul',
    detail: 'Kode ini berupa huruf dan angka. Salin seluruhnya, jangan diketik ulang supaya tidak ada yang keliru.',
  },
]

/**
 * Panduan menyambungkan satu merek kasir.
 *
 * Dua hal yang dipegang di layar ini:
 * 1. Hasil uji koneksi harus bercerita, bukan berkata "Sukses". Pemilik usaha
 *    perlu tahu APA yang ditemukan sebelum memutuskan memasukkannya ke stok.
 * 2. Kegagalan ditulis sebagai langkah perbaikan, bukan sebagai keluhan sistem.
 */
export default function KasirPanduan() {
  const { merek: idMerek } = useParams<{ merek: string }>()
  const navigate = useNavigate()
  const hubungkanKasir = useAplikasi((s) => s.hubungkanKasir)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)

  const [kode, setKode] = useState('')
  const [hasil, setHasil] = useState<Hasil>('belum')

  const merek = merekKasir.find((m) => m.id === idMerek)

  if (!merek) {
    return (
      <div className="pb-8">
        <KepalaHalaman judul="Panduan Sambungkan Kasir" kembaliKe="/akun/kasir" />
        {/* KeadaanKosong memakai h3; tanpa h2 di antaranya tingkat judul
            halaman ini melompat dari h1 ke h3. */}
        <h2 className="sr-only">Aplikasi kasir tidak ditemukan</h2>
        <KeadaanKosong
          ikon={<IkonTanpaSinyal size={26} />}
          judul="Aplikasi kasir ini tidak kami kenali"
          pesan="Tautan yang kamu buka menunjuk ke merek kasir yang tidak ada di daftar kami. Pilih ulang dari daftar aplikasi kasir."
          aksi={
            <TombolTautan ke="/akun/kasir">Kembali ke Data dari Kasir</TombolTautan>
          }
        />
      </div>
    )
  }

  async function tempel() {
    try {
      const teks = await navigator.clipboard.readText()
      if (teks.trim()) {
        setKode(teks.trim())
        setHasil('belum')
        tampilkanRacun('Kode sambungan tertempel.', 'aman')
      } else {
        tampilkanRacun('Belum ada yang tersalin. Salin dulu kodenya dari aplikasi kasirmu.', 'menipis')
      }
    } catch {
      /* Sebagian peramban HP menolak membaca papan klip tanpa izin. Jangan
         menyalahkan pengguna: beri jalan manual yang memang bisa ia lakukan. */
      tampilkanRacun('Belum bisa menempel otomatis. Tekan lama di kolom kode, lalu pilih Tempel.', 'menipis')
    }
  }

  function uji(paksa?: 'berhasil' | 'gagal') {
    setHasil('menguji')
    window.setTimeout(() => {
      setHasil(paksa ?? (kode.replace(/\s/g, '').length >= 8 ? 'berhasil' : 'gagal'))
    }, 1200)
  }

  function masukkanSekarang() {
    hubungkanKasir(merek!.nama)
    navigate('/mulai/batas-aman')
  }

  return (
    <div className="pb-8">
      <KepalaHalaman
        judul="Panduan Sambungkan Kasir"
        keterangan={merek.nama}
        kembaliKe="/akun/kasir"
      />

      <div className="mt-4 max-w-2xl lg:max-w-6xl">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            style={{ background: merek.warna }}
            className="size-12 rounded-md grid place-items-center text-white font-extrabold text-[1rem] shrink-0"
          >
            {merek.nama.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="text-[1.125rem] font-extrabold text-ink leading-tight">{merek.nama}</h2>
            <p className="text-[0.8125rem] text-ink-3">Tiga langkah, kira-kira dua menit.</p>
          </div>
        </div>

        {/* Di layar lebar langkah dan kolom kode berdampingan: pengguna sedang
            bolak-balik antara aplikasi kasirnya dan layar ini, jadi langkah
            ketiga harus tetap terbaca saat kodenya ditempel. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
          <div>
            {/* Tiga langkah bergambar */}
            <ol className="mt-5 space-y-3">
              {LANGKAH.map((l) => (
                <li key={l.nomor}>
                  <Kartu>
                    <div className="sm:flex sm:items-start sm:gap-4">
                      <div className="shrink-0 w-full sm:w-44 mb-3 sm:mb-0">
                        <Ilustrasi langkah={l.nomor} warnaMerek={merek.warna} />
                      </div>
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-2">
                          {/* text-ink-inverse: di tema gelap bg-brand jadi tosca
                              terang, dan angka putih di atasnya hampir hilang. */}
                          <span className="size-6 rounded-full bg-brand text-ink-inverse grid place-items-center text-[0.75rem] font-extrabold shrink-0">
                            {l.nomor}
                          </span>
                          <span className="text-[1rem] font-bold text-ink leading-snug">{l.judul}</span>
                        </p>
                        <p className="mt-1.5 text-[0.875rem] text-ink-2 leading-relaxed">{l.detail}</p>
                      </div>
                    </div>
                  </Kartu>
                </li>
              ))}
            </ol>
          </div>

          <div>
            {/* Satu kolom kode, satu tombol tempel besar */}
            <div className="mt-5">
              <Kartu>
                <h2 className="text-[1rem] font-bold text-ink">Tempel kode sambungan di sini</h2>
                <p className="mt-1 text-[0.875rem] text-ink-2 leading-relaxed">
                  Kode ini hanya memberi izin membaca data penjualan. Kami tidak bisa mengubah apa pun di aplikasi
                  kasirmu.
                </p>

                <div className="mt-3.5">
                  <Kolom
                    label="Kode sambungan"
                    wajib
                    value={kode}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="Contoh: KOP-8F42-2C90-17AB"
                    onChange={(e) => {
                      setKode(e.target.value)
                      setHasil('belum')
                    }}
                    className="font-mono"
                  />
                </div>

                <Tombol
                  penuh
                  ukuran="besar"
                  ragam="sekunder"
                  className="mt-3"
                  ikonKiri={<IkonSalin size={18} />}
                  onClick={tempel}
                >
                  Tempel
                </Tombol>

                <Tombol
                  penuh
                  ukuran="besar"
                  className="mt-2.5"
                  memuat={hasil === 'menguji'}
                  disabled={kode.trim().length === 0}
                  onClick={() => uji()}
                >
                  {hasil === 'menguji' ? 'Sedang mencoba menyambung' : 'Uji Koneksi'}
                </Tombol>

                {/* Hasil uji: satu-satunya bagian layar yang berubah */}
                <div aria-live="polite" className="mt-4 empty:mt-0">
                  {hasil === 'berhasil' && (
                    <Peringatan nada="aman" judul={`Tersambung ke ${merek.nama}`}>
                      Ditemukan <strong>128 barang</strong> dan <strong>penjualan 30 hari terakhir</strong>. Mau kami
                      masukkan sekarang?
                      <p className="mt-1.5">
                        Setelah dimasukkan, daftar Stok langsung terisi dan kamu tinggal menentukan batas aman tiap
                        barang di langkah berikutnya.
                      </p>
                      <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
                        <Tombol penuh onClick={masukkanSekarang}>
                          Ya, masukkan sekarang
                        </Tombol>
                        <TombolTautan ke="/akun/kasir" ragam="garis" penuh>
                          Nanti saja
                        </TombolTautan>
                      </div>
                    </Peringatan>
                  )}

                  {hasil === 'gagal' && (
                    <Peringatan nada="kritis" judul="Kode sambungan ditolak oleh sistem kasirmu">
                      Salin ulang kode dari menu Pengaturan lalu Integrasi, lalu coba lagi. Kode biasanya hangus setelah
                      15 menit, jadi ambil yang paling baru.
                      <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
                        <Tombol penuh onClick={() => uji()} ikonKiri={<IkonSinkron size={17} />}>
                          Coba Lagi
                        </Tombol>
                        <TombolTautan ke="/akun/kasir" ragam="garis" penuh>
                          Pilih cara lain
                        </TombolTautan>
                      </div>
                    </Peringatan>
                  )}
                </div>

                <Pemisah className="my-4" />

                <p className="flex items-start gap-2 text-[0.8125rem] text-ink-3 leading-relaxed">
                  <IkonPeringatan size={16} className="shrink-0 mt-px" />
                  Belum ketemu menu Integrasi? Di sebagian aplikasi kasir namanya &ldquo;Aplikasi Terhubung&rdquo; atau
                  &ldquo;Kunci Akses&rdquo;.
                </p>
              </Kartu>
            </div>

            {/* Alat uji tampilan hasil */}
            <div className="mt-5 rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
              <h2 className="text-[0.9375rem] font-bold text-ink">Alat uji tampilan hasil</h2>
              <p className="mt-1 text-[0.8125rem] text-ink-3 leading-relaxed">
                Hanya untuk pengembang. Tombol ini memaksa hasil uji koneksi supaya kedua tampilannya bisa dilihat tanpa
                kasir sungguhan.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <TombolUji aktif={hasil === 'berhasil'} onClick={() => uji('berhasil')}>
                  Tampilkan hasil tersambung
                </TombolUji>
                <TombolUji aktif={hasil === 'gagal'} onClick={() => uji('gagal')}>
                  Tampilkan hasil ditolak
                </TombolUji>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ilustrasi langkah                                                   */
/* ------------------------------------------------------------------ */

const KETERANGAN_GAMBAR: Record<1 | 2 | 3, string> = {
  1: 'Gambar layar aplikasi kasir dengan menu Pengaturan disorot di daftar sebelah kiri.',
  2: 'Gambar layar aplikasi kasir dengan pilihan Integrasi disorot di panel kanan.',
  3: 'Gambar layar aplikasi kasir yang menampilkan kotak kode sambungan dan tombol salin.',
}

/**
 * Gambar dibuat sendiri sebagai SVG, bukan tangkapan layar, karena tampilan
 * tiap merek kasir berbeda dan berubah. Yang perlu dikenali pengguna hanyalah
 * POSISI menunya: kiri untuk daftar menu, kanan untuk isinya.
 */
function Ilustrasi({ langkah, warnaMerek }: { langkah: 1 | 2 | 3; warnaMerek: string }) {
  const sorotMenu = langkah === 1
  const sorotIsi = langkah === 2
  const sorotKode = langkah === 3

  return (
    <svg
      viewBox="0 0 176 108"
      className="w-full h-auto rounded-md border border-line bg-surface-2"
      role="img"
      aria-label={KETERANGAN_GAMBAR[langkah]}
    >
      {/* Badan layar */}
      <rect x="6" y="6" width="164" height="96" rx="7" fill="var(--c-surface)" stroke="var(--c-border)" />
      {/* Bilah judul */}
      <path d="M6 13a7 7 0 0 1 7-7h150a7 7 0 0 1 7 7v9H6z" fill={warnaMerek} opacity="0.9" />
      <circle cx="15" cy="14" r="2.4" fill="#fff" opacity="0.75" />
      <rect x="22" y="12" width="34" height="4.5" rx="2.2" fill="#fff" opacity="0.75" />

      {/* Daftar menu kiri */}
      <rect x="6" y="22" width="52" height="80" fill="var(--c-surface-sunken)" />
      {[32, 44, 56, 68].map((y, i) => {
        const menuTerpilih = i === 2
        return (
          <g key={y}>
            {menuTerpilih && (
              <rect
                x="10"
                y={y - 5}
                width="44"
                height="14"
                rx="4"
                fill={sorotMenu ? 'var(--c-brand-soft)' : 'var(--c-surface)'}
                stroke={sorotMenu ? 'var(--c-brand)' : 'none'}
                strokeWidth="1.6"
              />
            )}
            <circle cx="17" cy={y + 2} r="2.6" fill="var(--c-ink-3)" opacity={menuTerpilih ? 0.9 : 0.45} />
            <rect
              x="24"
              y={y}
              width={i === 2 ? 26 : 22}
              height="4.5"
              rx="2.2"
              fill="var(--c-ink-3)"
              opacity={menuTerpilih ? 0.9 : 0.45}
            />
          </g>
        )
      })}

      {/* Panel kanan */}
      <rect x="64" y="30" width="98" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.35" />

      {sorotIsi ? (
        <>
          <rect
            x="64"
            y="44"
            width="98"
            height="18"
            rx="5"
            fill="var(--c-brand-soft)"
            stroke="var(--c-brand)"
            strokeWidth="1.8"
          />
          <rect x="71" y="50" width="44" height="5" rx="2.5" fill="var(--c-brand)" />
          <rect x="64" y="68" width="98" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
          <rect x="64" y="80" width="72" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
        </>
      ) : sorotKode ? (
        <>
          <rect
            x="64"
            y="44"
            width="98"
            height="24"
            rx="5"
            fill="var(--c-surface-sunken)"
            stroke="var(--c-brand)"
            strokeWidth="1.8"
            strokeDasharray="4 3"
          />
          {[70, 84, 98, 112].map((x) => (
            <rect key={x} x={x} y="53" width="11" height="6" rx="2" fill="var(--c-ink-3)" opacity="0.7" />
          ))}
          <rect x="126" y="50" width="30" height="12" rx="4" fill="var(--c-brand)" />
          {/* Tulisan pada tombol merek ikut token, bukan putih tetap: di tema
              gelap warna merek terang dan putih di atasnya lenyap. */}
          <rect x="132" y="54.5" width="18" height="3.5" rx="1.75" fill="var(--c-ink-inverse)" opacity="0.9" />
          <rect x="64" y="76" width="72" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
        </>
      ) : (
        <>
          <rect x="64" y="44" width="98" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
          <rect x="64" y="56" width="84" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
          <rect x="64" y="68" width="92" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
          <rect x="64" y="80" width="60" height="6" rx="3" fill="var(--c-ink-3)" opacity="0.25" />
        </>
      )}
    </svg>
  )
}

function TombolUji({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cx(
        'h-11 px-3.5 rounded-md text-[0.8125rem] font-semibold border transition-colors',
        aktif ? 'bg-ink text-ink-inverse border-ink' : 'bg-surface text-ink-2 border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
