/**
 * Akun simulasi di basis data lokal. Nilai uji untuk data simulasi, bukan akun sungguhan.
 *
 * - Kopi Kita Jogja: `data/dataset/buat_dataset.py` (KATA_SANDI_CONTOH).
 * - Dapur Sambal Bu Ratmi, UMKM produsen: `data/dataset/umkm_produksi.py`;
 *   kata sandinya sama dengan akun contoh lain.
 *
 * - Sumber Tani Nusantara, distributor: `data/dataset/buat_dataset.py` (distributor1).
 *
 * Dipakai tombol isi otomatis di halaman Masuk, tombol pindah akun di kotak
 * Alat uji purwarupa (halaman Akun), dan tombol Buka Portal Distributor.
 */
export interface AkunSimulasi {
  namaUsaha: string
  email: string
  kataSandi: string
}

export const AKUN_KOPI_KITA: AkunSimulasi = { namaUsaha: 'Kopi Kita Jogja', email: 'umkm1@warungku.test', kataSandi: 'warungku123' }
export const AKUN_BU_RATMI: AkunSimulasi = {
  namaUsaha: 'Dapur Sambal Bu Ratmi',
  email: 'produksi1@warungku.test',
  kataSandi: AKUN_KOPI_KITA.kataSandi,
}

/** Dua akun UMKM yang bisa saling berpindah lewat Alat uji purwarupa. */
export const AKUN_SIMULASI_UMKM: readonly AkunSimulasi[] = [AKUN_KOPI_KITA, AKUN_BU_RATMI]

/** Distributor simulasi yang portalnya dibuka saat demo (Sumber Tani Nusantara). */
export const AKUN_DISTRIBUTOR: { email: string; kataSandi: string } = { email: 'distributor1@warungku.test', kataSandi: 'warungku123' }
