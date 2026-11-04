/**
 * Akun simulasi di basis data lokal. Nilai uji untuk data simulasi, bukan akun sungguhan.
 *
 * - Kopi Kita Jogja: `data/dataset/buat_dataset.py` (KATA_SANDI_CONTOH).
 * - Dapur Sambal Bu Ratmi, UMKM produsen: `data/dataset/umkm_produksi.py`;
 *   kata sandinya sama dengan akun contoh lain.
 * - Warung Madura Barokah 24 Jam: `data/dataset/warung_madura.py`, begitu juga.
 *
 * - Sumber Tani Nusantara, distributor: `data/dataset/buat_dataset.py` (distributor1).
 * - Agen Rokok dan Gas Merapi, pemasok Warung Madura: `data/dataset/warung_madura.py`.
 *
 * Dipakai tombol isi otomatis di halaman Masuk, tombol pindah akun di kotak
 * Alat uji purwarupa (halaman Akun), dan tombol Buka Portal Distributor.
 */
export interface AkunSimulasi {
  namaUsaha: string
  /** Untuk label tombol yang sempit, mis. "Pindah ke Bu Ratmi". */
  namaPendek?: string
  email: string
  kataSandi: string
}

export const AKUN_KOPI_KITA: AkunSimulasi = { namaUsaha: 'Kopi Kita Jogja', namaPendek: 'Kopi Kita', email: 'umkm1@warungku.test', kataSandi: 'warungku123' }
export const AKUN_BU_RATMI: AkunSimulasi = {
  namaUsaha: 'Dapur Sambal Bu Ratmi',
  namaPendek: 'Bu Ratmi',
  email: 'produksi1@warungku.test',
  kataSandi: AKUN_KOPI_KITA.kataSandi,
}

export const AKUN_WARUNG_MADURA: AkunSimulasi = {
  namaUsaha: 'Warung Madura Barokah 24 Jam',
  namaPendek: 'Warung Madura',
  email: 'madura1@warungku.test',
  kataSandi: AKUN_KOPI_KITA.kataSandi,
}

/** Kasir simulasi Kopi Kita (peran pegawai): hanya bisa masuk ke Portal POS. Kata sandinya sama dengan akun contoh lain. */
export const AKUN_KASIR: AkunSimulasi = {
  namaUsaha: 'Kopi Kita Jogja',
  email: 'kasir1@warungku.test',
  kataSandi: AKUN_KOPI_KITA.kataSandi,
}

/** Akun UMKM yang bisa saling berpindah lewat Alat uji purwarupa. */
export const AKUN_SIMULASI_UMKM: readonly AkunSimulasi[] = [AKUN_KOPI_KITA, AKUN_BU_RATMI, AKUN_WARUNG_MADURA]

/** Distributor simulasi yang portalnya dibuka saat demo (Sumber Tani Nusantara). */
export const AKUN_DISTRIBUTOR: { email: string; kataSandi: string } = { email: 'distributor1@warungku.test', kataSandi: 'warungku123' }

/** Pemasok Warung Madura yang portalnya dibuka saat demo warung kelontong. */
export const AKUN_DISTRIBUTOR_KELONTONG: { email: string; kataSandi: string } = {
  email: 'distributor12@warungku.test',
  kataSandi: AKUN_DISTRIBUTOR.kataSandi,
}
