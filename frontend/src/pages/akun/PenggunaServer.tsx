import { useEffect, useState } from 'react'
import { KepalaHalaman } from '@/components/ui/navigasi'
import { Avatar, JudulBagian, Kartu, Lencana, Tombol } from '@/components/ui/dasar'
import { Kolom } from '@/components/ui/formulir'
import { Lembar } from '@/components/ui/lembar'
import { KeadaanKosong, Peringatan } from '@/components/ui/umpanBalik'
import { IkonCentang, IkonProfil, IkonSilang, IkonTambah } from '@/icons'
import { GalatApi } from '@/lib/api'
import { ambilKasir, tambahKasir, ubahKasir, type AkunKasir } from '@/lib/apiKasir'
import { useAplikasi } from '@/store/aplikasi'

const KOSONG = { nama: '', email: '', nomorHp: '', kataSandi: '' }

const BOLEH = ['Masuk ke Portal POS dan menjual', 'Membuka dan menutup kas', 'Mengajukan pembatalan nota dengan alasan']
const TIDAK_BOLEH = [
  'Tidak bisa membatalkan nota',
  'Tidak bisa mengubah menu, harga, atau resep',
  'Tidak bisa membuka Portal UMKM, stok, atau laporan',
]

/**
 * Pengguna & Hak Akses untuk data server: pemilik dan akun kasir Portal POS. Akun kasir dibuat
 * pemilik dengan kata sandi awal yang ia sampaikan sendiri. Hak kasir ditegakkan server: token
 * kasir hanya diterima endpoint POS, jadi daftar hak di bawah bukan sekadar petunjuk.
 */
export default function PenggunaServer() {
  const sesi = useAplikasi((s) => s.sesiServer)
  const profil = useAplikasi((s) => s.profil)
  const kelontong = profil.jenisUsaha === 'warung-kelontong'
  const tampilkanRacun = useAplikasi((s) => s.tampilkanRacun)
  const [daftar, setDaftar] = useState<AkunKasir[] | null>(null)
  const [galatMuat, setGalatMuat] = useState<string | null>(null)
  const [tambah, setTambah] = useState(false)
  const [form, setForm] = useState(KOSONG)
  const [galat, setGalat] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const [aturSandi, setAturSandi] = useState<AkunKasir | null>(null)
  const [sandiBaru, setSandiBaru] = useState('')

  useEffect(() => {
    if (!sesi) return
    ambilKasir(sesi)
      .then(setDaftar)
      .catch((e: unknown) => setGalatMuat(e instanceof GalatApi ? e.message : 'Daftar kasir belum bisa dimuat. Coba lagi sebentar lagi.'))
  }, [sesi])

  async function simpan() {
    if (!sesi) return
    if (!form.nama.trim() || !form.email.trim() || !form.nomorHp.trim() || form.kataSandi.length < 6) {
      setGalat('Isi nama, email, nomor HP, dan kata sandi awal (paling sedikit 6 karakter).')
      return
    }
    setMenyimpan(true)
    setGalat(null)
    try {
      const akun = await tambahKasir(sesi, { ...form, nama: form.nama.trim(), email: form.email.trim(), nomorHp: form.nomorHp.trim() })
      setDaftar((d) => [...(d ?? []), akun])
      setTambah(false)
      setForm(KOSONG)
      tampilkanRacun(`Akun kasir ${akun.nama} dibuat. Sampaikan email dan kata sandi awalnya langsung kepadanya.`, 'aman')
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Akun belum tersimpan. Coba lagi sebentar lagi.')
    } finally {
      setMenyimpan(false)
    }
  }

  async function ubah(akun: AkunKasir, isi: { aktif?: boolean; kataSandi?: string }, kabar: string) {
    if (!sesi) return
    try {
      const baru = await ubahKasir(sesi, akun.penggunaId, isi)
      setDaftar((d) => d?.map((x) => (x.penggunaId === baru.penggunaId ? baru : x)) ?? d)
      tampilkanRacun(kabar, 'aman')
      return true
    } catch (e) {
      tampilkanRacun(e instanceof GalatApi ? e.message : 'Perubahan belum tersimpan. Coba lagi sebentar lagi.', 'kritis')
      return false
    }
  }

  return (
    <div className="pb-6 lg:pb-0">
      <KepalaHalaman
        judul="Pengguna & Hak Akses"
        keterangan={daftar ? `${1 + daftar.length} orang punya akses` : undefined}
        kembaliKe="/akun"
        aksi={
          kelontong ? undefined : (
            <Tombol ukuran="kecil" ikonKiri={<IkonTambah size={15} />} onClick={() => { setTambah(true); setGalat(null) }}>
              Tambah Kasir
            </Tombol>
          )
        }
      />

      <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className="lg:col-span-7 space-y-3">
          <JudulBagian judul="Orang yang bisa masuk" keterangan="Kasir masuk lewat Portal POS dengan emailnya sendiri, bukan memakai akunmu." className="mb-1" />

          <Kartu padat>
            <div className="flex items-start gap-3">
              <Avatar nama={profil.namaPemilik || profil.namaUsaha} warna={profil.warna} ukuran={44} />
              <div className="min-w-0 grow">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[1rem] font-semibold text-ink leading-snug truncate">{profil.namaPemilik || profil.namaUsaha}</p>
                  <Lencana nada="merek" className="shrink-0">Pemilik</Lencana>
                </div>
                <p className="mt-1 text-isi text-ink-2">Bisa semuanya, termasuk membatalkan nota dan mengatur menu.</p>
              </div>
            </div>
          </Kartu>

          {galatMuat ? (
            <Peringatan nada="kritis" judul="Daftar kasir belum bisa dimuat">{galatMuat}</Peringatan>
          ) : daftar === null ? (
            <p className="text-isi text-ink-3">Memuat&hellip;</p>
          ) : kelontong ? (
            <KeadaanKosong
              ikon={<IkonProfil size={26} />}
              judul="Portal POS belum untuk warung kelontong"
              pesan="Barang warung dijual apa adanya dan belum punya daftar menu, jadi akun kasir belum bisa dipakai."
            />
          ) : daftar.length === 0 ? (
            <KeadaanKosong ikon={<IkonProfil size={26} />} judul="Belum ada akun kasir" pesan="Tambah kasir supaya penjualan di Portal POS tercatat atas namanya, dan kasir tidak memakai akunmu." padat />
          ) : (
            daftar.map((a) => (
              <Kartu key={a.penggunaId} padat>
                <div className="flex items-start gap-3">
                  <Avatar nama={a.nama} ukuran={44} />
                  <div className="min-w-0 grow">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[1rem] font-semibold text-ink leading-snug truncate">{a.nama}</p>
                      <Lencana nada={a.aktif ? 'netral' : 'menipis'} className="shrink-0">{a.aktif ? 'Kasir' : 'Nonaktif'}</Lencana>
                    </div>
                    <p className="mt-0.5 text-isi text-ink-3 break-all">{a.email}</p>
                    <p className="text-isi text-ink-3 tabular">{a.nomorHp}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Tombol
                        ragam="garis"
                        ukuran="kecil"
                        onClick={() => void ubah(a, { aktif: !a.aktif }, a.aktif ? `${a.nama} dinonaktifkan. Ia tidak bisa masuk lagi.` : `${a.nama} diaktifkan lagi.`)}
                      >
                        {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </Tombol>
                      <Tombol ragam="garis" ukuran="kecil" onClick={() => { setAturSandi(a); setSandiBaru('') }}>
                        Atur Ulang Kata Sandi
                      </Tombol>
                    </div>
                  </div>
                </div>
              </Kartu>
            ))
          )}
        </div>

        <div className="lg:col-span-5 mt-6 lg:mt-0">
          <Kartu>
            <h2 className="text-kartu font-bold text-ink">Yang bisa dilakukan kasir</h2>
            <ul className="mt-2 space-y-1.5">
              {BOLEH.map((t) => (
                <li key={t} className="flex gap-2 text-isi text-ink-2"><IkonCentang size={16} className="mt-0.5 shrink-0 text-aman" />{t}</li>
              ))}
              {TIDAK_BOLEH.map((t) => (
                <li key={t} className="flex gap-2 text-isi text-ink-2"><IkonSilang size={16} className="mt-0.5 shrink-0 text-kritis" />{t}</li>
              ))}
            </ul>
          </Kartu>
        </div>
      </div>

      <Lembar
        terbuka={tambah}
        tutup={() => setTambah(false)}
        judul="Tambah kasir"
        keterangan="Kasir masuk ke Portal POS dengan email dan kata sandi ini."
        kaki={
          <Tombol penuh memuat={menyimpan} onClick={() => void simpan()}>
            Buat Akun Kasir
          </Tombol>
        }
      >
        <div className="space-y-3">
          <Kolom label="Nama" wajib value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          <Kolom label="Email" wajib type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Kolom label="Nomor HP" wajib inputMode="tel" value={form.nomorHp} onChange={(e) => setForm({ ...form, nomorHp: e.target.value })} />
          <Kolom label="Kata sandi awal" wajib type="password" autoComplete="new-password" value={form.kataSandi} galat={galat ?? undefined} onChange={(e) => setForm({ ...form, kataSandi: e.target.value })} />
        </div>
      </Lembar>

      <Lembar
        terbuka={aturSandi !== null}
        tutup={() => setAturSandi(null)}
        judul={`Kata sandi baru untuk ${aturSandi?.nama ?? ''}`}
        lebar="sempit"
        kaki={
          <Tombol
            penuh
            disabled={sandiBaru.length < 6}
            onClick={async () => {
              if (aturSandi && (await ubah(aturSandi, { kataSandi: sandiBaru }, `Kata sandi ${aturSandi.nama} diganti.`))) setAturSandi(null)
            }}
          >
            Simpan Kata Sandi
          </Tombol>
        }
      >
        <Kolom label="Kata sandi baru" wajib type="password" autoComplete="new-password" bantuan="Paling sedikit 6 karakter." value={sandiBaru} onChange={(e) => setSandiBaru(e.target.value)} />
      </Lembar>
    </div>
  )
}
