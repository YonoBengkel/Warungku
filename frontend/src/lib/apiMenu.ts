import { minta, type SesiServer } from './api'
import type { BahanMenu, MenuBelumDipasangkan, ResepMenu, Transaksi } from './types'

/* ------------------------------------------------------------------ */
/* Menu kasir: menu dari nota, resepnya, dan nota terbaru              */
/* ------------------------------------------------------------------ */

interface MenuBelumApi {
  nama_menu: string
  jumlah_terjual: string | number
  sejak: string
  terakhir: string
}

interface BahanMenuApi {
  barang_id: number
  nama: string
  satuan: string
  takaran: string | number
}

interface ResepMenuApi {
  nama_menu: string
  bahan: BahanMenuApi[]
  langsung: boolean
}

interface RingkasanMenuApi {
  belum_dipasangkan: MenuBelumApi[]
  resep: ResepMenuApi[]
  nota_terakhir: string | null
  nota_hari_ini: number
}

interface NotaApi {
  id: number
  nomor_struk: string
  waktu: string
  kasir: string | null
  baris: Array<{ nama_menu: string; jumlah: string | number; satuan: string }>
}

interface HasilNotaApi {
  sudah_ada: boolean
  baris_tercatat: number
  tak_dikenali: string[]
  stok_kurang?: string[]
}

export interface RingkasanMenuKasir {
  belum: MenuBelumDipasangkan[]
  resep: ResepMenu[]
  notaTerakhir: string | null
  notaHariIni: number
}

export interface HasilNota {
  takDikenali: string[]
  stokKurang: string[]
}

/**
 * Kunci menu: huruf kecil tanpa spasi tepi, sama dengan cara server mencocokkan
 * nama menu di nota. "Kopi Susu" dan " kopi susu " adalah satu menu.
 */
export function idMenu(nama: string): string {
  return nama.trim().toLowerCase()
}

function keResep(r: ResepMenuApi): ResepMenu {
  return {
    id: idMenu(r.nama_menu),
    namaMenu: r.nama_menu,
    bahan: r.bahan.map((b) => ({ barangId: String(b.barang_id), takaran: Number(b.takaran) })),
    langsung: r.langsung,
  }
}

export async function ambilMenuKasir(sesi: SesiServer): Promise<RingkasanMenuKasir> {
  const r = await minta<RingkasanMenuApi>(`/usaha/${sesi.usahaId}/menu-kasir`, { token: sesi.token })
  return {
    belum: r.belum_dipasangkan.map((m) => ({
      id: idMenu(m.nama_menu),
      namaMenu: m.nama_menu,
      jumlahTerjual: Number(m.jumlah_terjual),
      sejak: m.sejak,
    })),
    resep: r.resep.map(keResep),
    notaTerakhir: r.nota_terakhir,
    notaHariIni: r.nota_hari_ini,
  }
}

/** Simpan resep satu menu. Menyimpan ulang menggantikan seluruh bahan sebelumnya. */
export async function simpanResep(sesi: SesiServer, namaMenu: string, bahan: BahanMenu[]): Promise<ResepMenu> {
  const r = await minta<ResepMenuApi>(`/usaha/${sesi.usahaId}/menu-kasir`, {
    method: 'PUT',
    token: sesi.token,
    body: JSON.stringify({
      nama_menu: namaMenu,
      bahan: bahan.map((b) => ({ barang_id: Number(b.barangId), takaran: b.takaran })),
    }),
  })
  return keResep(r)
}

export async function ambilNotaTerbaru(sesi: SesiServer, batas = 8): Promise<Transaksi[]> {
  const isi = await minta<NotaApi[]>(`/usaha/${sesi.usahaId}/transaksi?batas=${batas}`, { token: sesi.token })
  return isi.map((n) => ({
    id: String(n.id),
    nomorStruk: n.nomor_struk,
    waktu: n.waktu,
    kasir: n.kasir ?? 'Kasir',
    baris: n.baris.map((b) => ({ nama: b.nama_menu, jumlah: Number(b.jumlah), satuan: b.satuan })),
  }))
}

/** Kirim satu nota seperti yang dikirim aplikasi kasir. Dipakai Portal POS dan alat uji purwarupa. */
export async function kirimNota(
  sesi: SesiServer,
  nomorStruk: string,
  baris: Array<{ namaMenu: string; jumlah: number; satuan: string; harga: number }>,
  kasir = 'Alat Uji',
): Promise<HasilNota> {
  const r = await minta<HasilNotaApi>(`/usaha/${sesi.usahaId}/transaksi`, {
    method: 'POST',
    token: sesi.token,
    body: JSON.stringify({
      nomor_struk: nomorStruk,
      waktu: new Date().toISOString(),
      kasir,
      sumber: 'pos',
      baris: baris.map((b) => ({
        nama_menu: b.namaMenu,
        jumlah: b.jumlah,
        satuan: b.satuan,
        harga_jual_satuan: b.harga,
      })),
    }),
  })
  return { takDikenali: r.tak_dikenali, stokKurang: r.stok_kurang ?? [] }
}

/* ------------------------------------------------------------------ */
/* Menu Portal POS: diatur di Portal UMKM, dibaca kasir                */
/* ------------------------------------------------------------------ */

export interface MenuJual {
  namaMenu: string
  hargaJual: number
  kategori: string | null
  aktif: boolean
  /** False: nota menu ini masuk, tetapi stok bahannya belum terpotong. */
  punyaResep: boolean
}

interface MenuJualApi {
  nama_menu: string
  harga_jual: number
  kategori: string | null
  aktif: boolean
  punya_resep: boolean
}

const keMenuJual = (m: MenuJualApi): MenuJual => ({
  namaMenu: m.nama_menu,
  hargaJual: m.harga_jual,
  kategori: m.kategori,
  aktif: m.aktif,
  punyaResep: m.punya_resep,
})

export async function ambilMenuJual(sesi: SesiServer): Promise<MenuJual[]> {
  const isi = await minta<MenuJualApi[]>(`/usaha/${sesi.usahaId}/menu-jual`, { token: sesi.token })
  return isi.map(keMenuJual)
}

export async function simpanMenuJual(
  sesi: SesiServer,
  menu: { namaMenu: string; hargaJual: number; kategori: string; aktif: boolean },
): Promise<MenuJual> {
  const r = await minta<MenuJualApi>(`/usaha/${sesi.usahaId}/menu-jual`, {
    method: 'PUT',
    token: sesi.token,
    body: JSON.stringify({
      nama_menu: menu.namaMenu,
      harga_jual: menu.hargaJual,
      kategori: menu.kategori,
      aktif: menu.aktif,
    }),
  })
  return keMenuJual(r)
}
