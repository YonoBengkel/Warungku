import { useState } from 'react'
import { Avatar, Kartu, Lencana, Pemisah, Tombol, TombolIkon, TombolTautan } from '@/components/ui/dasar'
import { KeadaanKosong } from '@/components/ui/umpanBalik'
import { BilahAksi, KepalaHalaman } from '@/components/ui/navigasi'
import {
  IkonCentangLingkaran,
  IkonPasokan,
  IkonPeringatan,
  IkonSalin,
} from '@/icons'
import { BANTUAN } from '@/lib/label'
import { distributorById } from '@/data/dummy'
import { useAplikasi } from '@/store/aplikasi'

/**
 * Bukti bahwa belanja tadi benar-benar berangkat.
 *
 * Kegagalan sebagian tidak boleh memaksa mengulang seluruh keranjang, jadi
 * tombol "Kirim ulang" hanya muncul pada baris yang memang belum terkirim.
 * Baris yang sudah terkirim tidak punya tombol sama sekali, supaya tidak ada
 * jalan tak sengaja menuju pesanan kembar.
 */
export default function KeranjangSelesai() {
  const hasil = useAplikasi((s) => s.hasilKirimTerakhir)
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [sedangUlang, setSedangUlang] = useState<string | null>(null)

  function salinKode(kode: string) {
    const proses = navigator.clipboard?.writeText(kode)
    if (!proses) {
      tampilkanRacun(`Penyalinan belum bisa dipakai di sini. Catat kodenya manual: ${kode}.`, 'menipis')
      return
    }
    proses.then(
      () => tampilkanRacun('Kode belanja tersalin.', 'aman'),
      () => tampilkanRacun(`Kode belanja belum bisa disalin. Catat manual: ${kode}.`, 'menipis'),
    )
  }

  function kirimUlang(id: string) {
    setSedangUlang(id)
    // Menyusul pola aksi store: perubahan status hidup di keadaan bersama,
    // bukan di keadaan lokal halaman ini.
    window.setTimeout(() => {
      const sekarang = useAplikasi.getState().hasilKirimTerakhir
      if (sekarang) {
        useAplikasi.setState({
          hasilKirimTerakhir: {
            ...sekarang,
            pesanan: sekarang.pesanan.map((p) => (p.id === id ? { ...p, berhasil: true } : p)),
          },
        })
      }
      setSedangUlang(null)
      tampilkanRacun('Pesanan terkirim ke distributor.', 'aman')
    }, 900)
  }

  if (!hasil || hasil.pesanan.length === 0) {
    return (
      <>
        <KepalaHalaman judul="Belanja Terkirim" kembaliKe="/pesanan" />
        {/* Judul bagian khusus pembaca layar: tanpa ini urutan judul melompat
            dari h1 langsung ke h3 milik kartu keadaan kosong. */}
        <section aria-labelledby="judul-hasil-kirim">
          <h2 id="judul-hasil-kirim" className="sr-only">
            Hasil pengiriman belanja
          </h2>
          <KeadaanKosong
            ikon={<IkonPasokan size={26} />}
            judul="Belum ada belanja yang baru dikirim"
            pesan="Ringkasan pengiriman hanya muncul tepat setelah kamu membuat pesanan. Semua pesanan lama tetap tersimpan di daftar Pesanan."
            aksi={<TombolTautan ke="/pesanan">Lihat Pesanan Saya</TombolTautan>}
            aksiKedua={
              <TombolTautan ke="/belanja" ragam="garis">
                Cari Barang di Belanja
              </TombolTautan>
            }
          />
        </section>
      </>
    )
  }

  const terkirim = hasil.pesanan.filter((p) => p.berhasil).length
  const gagal = hasil.pesanan.length - terkirim

  /* Kartu bukti dipakai dua kali: menempel di kolom kanan desktop, dan
     mendahului daftar di layar sempit. Satu sumber isi, dua tempat tayang. */
  const kartuBukti = (
    <Kartu>
      <div className="flex items-start gap-3">
        <span
          className={
            gagal === 0
              ? 'size-10 rounded-md grid place-items-center shrink-0 bg-aman-soft text-aman-ink'
              : 'size-10 rounded-md grid place-items-center shrink-0 bg-menipis-soft text-menipis-ink'
          }
        >
          {gagal === 0 ? <IkonCentangLingkaran size={20} /> : <IkonPeringatan size={20} />}
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.0625rem] font-bold text-ink leading-snug">
            {gagal === 0
              ? `${terkirim} pesanan terkirim ke distributor`
              : `${terkirim} dari ${hasil.pesanan.length} pesanan terkirim`}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2 leading-relaxed">
            {gagal === 0
              ? 'Distributor akan mengonfirmasi satu per satu. Kamu bisa memantau setiap pesanan di tab Pesanan.'
              : `${gagal} pesanan masih menunggu di HP kamu. Yang sudah terkirim tidak perlu diulang — kirim ulang hanya baris yang belum berangkat.`}
          </p>
        </div>
      </div>

      <Pemisah className="my-3" />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-3">
            Kode induk belanja
          </p>
          <p className="text-[1.0625rem] font-bold text-ink tabular">{hasil.kodeBelanja}</p>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3 leading-snug">
            Satu belanja, beberapa pesanan. Sebut kode ini kalau kamu menghubungi distributor.
          </p>
        </div>
        <TombolIkon label="Salin kode belanja" onClick={() => salinKode(hasil.kodeBelanja)}>
          <IkonSalin size={18} />
        </TombolIkon>
      </div>
    </Kartu>
  )

  return (
    <div className="pb-4">
      <KepalaHalaman
        judul="Belanja Terkirim"
        keterangan={
          gagal === 0
            ? `${terkirim} pesanan sudah berangkat`
            : `${terkirim} dari ${hasil.pesanan.length} pesanan sudah berangkat`
        }
        kembaliKe="/pesanan"
      />

      {/* Desktop: bukti pengiriman menetap di kanan sementara daftar pesanan yang
          baru lahir mengisi kiri. Di layar sempit keduanya bertumpuk seperti biasa. */}
      <div className="mx-auto w-full max-w-2xl lg:max-w-none mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          <div className="lg:hidden">{kartuBukti}</div>

          <section aria-labelledby="judul-daftar-pesanan">
            <h2 id="judul-daftar-pesanan" className="sr-only">
              Daftar pesanan yang terbentuk
            </h2>
            <div className="space-y-2.5">
              {hasil.pesanan.map((p) => {
                const distributor = distributorById(p.distributorId)
                return (
                  <Kartu key={p.id} padat>
                    <div className="flex items-start gap-3 min-h-[72px]">
                      <Avatar nama={distributor?.nama ?? '?'} warna={distributor?.warna} ukuran={40} />
                      <div className="min-w-0 grow">
                        <h3 className="text-[0.9375rem] font-bold text-ink truncate">{distributor?.nama}</h3>
                        <p className="text-[0.8125rem] text-ink-2 tabular">{p.nomor}</p>
                        <div className="mt-1.5">
                          {p.berhasil ? (
                            <Lencana nada="aman" ikon={<IkonCentangLingkaran size={13} />}>
                              Terkirim ke distributor
                            </Lencana>
                          ) : (
                            <Lencana nada="menipis" ikon={<IkonPeringatan size={13} />}>
                              Belum berangkat
                            </Lencana>
                          )}
                        </div>
                        {!p.berhasil && (
                          <p className="mt-1.5 text-[0.8125rem] text-ink-3 leading-snug">
                            Pesanan ini masih tersimpan lengkap. Tekan kirim ulang kalau kamu sudah siap.
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {p.berhasil ? (
                          <TombolTautan ke={`/pesanan/${p.id}`} ragam="garis" ukuran="kecil">
                            Lihat pesanan
                          </TombolTautan>
                        ) : (
                          <Tombol
                            ragam="garis"
                            ukuran="kecil"
                            memuat={sedangUlang === p.id}
                            onClick={() => kirimUlang(p.id)}
                          >
                            Kirim ulang
                          </Tombol>
                        )}
                      </div>
                    </div>
                  </Kartu>
                )
              })}
            </div>
          </section>

          <p className="text-[0.8125rem] text-ink-3 leading-relaxed px-1 max-w-[68ch]">
            {BANTUAN.bayarLuarPanjang}
          </p>
        </div>

        <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-3">
          {kartuBukti}
          <Kartu>
            <TombolTautan ke="/pesanan" penuh ukuran="besar" ikonKiri={<IkonPasokan size={18} />}>
              Lihat Pesanan Saya
            </TombolTautan>
          </Kartu>
        </aside>

        {/* Bilah aksi diangkat setinggi navigasi bawah, supaya tombolnya tidak
            berada tepat di belakang navigasi mobile. */}
        <div className="lg:hidden sticky bottom-[var(--nav-h)] z-30">
          <BilahAksi>
            <TombolTautan ke="/pesanan" penuh ukuran="besar" ikonKiri={<IkonPasokan size={18} />}>
              Lihat Pesanan Saya
            </TombolTautan>
          </BilahAksi>
        </div>
      </div>
    </div>
  )
}
