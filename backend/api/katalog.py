"""
Katalog untuk pemilik usaha: distributor, penawarannya, dan ulasan sungguhan.

Dua hal dihitung di sini, bukan disimpan:

- **Rating distributor** dari tabel `ulasan`. Angka yang diketik di profil bisa
  dikarang; rata-rata ulasan tidak.
- **Barang terkait** tiap penawaran, yaitu barang di gudang usaha PEMANGGIL yang
  bertambah kalau penawaran itu dibeli. Dicocokkan lewat `produk_master_id`,
  jadi jawabannya berbeda untuk setiap usaha.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import text
from sqlmodel import Session

from warungku.basis_data import mesin
from warungku.model import Usaha

from .otentikasi import usaha_saya
from .skema import DistributorKatalog, Katalog, PenawaranKatalog, UlasanPublik, UsahaRingkas

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["katalog"])


def _nilai(x) -> str:
    return str(getattr(x, "value", x))


@rute.get("/katalog", response_model=Katalog)
def katalog(usaha_id: int = Depends(usaha_saya)) -> Katalog:
    """Semua distributor beserta penawarannya, dilihat dari usaha pemanggil."""
    with Session(mesin()) as sesi:
        u = sesi.get(Usaha, usaha_id)
        if u is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        distributor = sesi.exec(
            text(
                """
                SELECT d.id, d.nama, d.kota, d.deskripsi, d.warna, d.kategori, d.area_kirim,
                       d.terverifikasi, d.baru, d.sejak, d.alamat_gudang, d.nomor_hp,
                       d.jam_operasional, d.minimum_pesanan,
                       round(avg(ul.rating)::numeric, 2)::float               AS rating,
                       count(ul.id)                                           AS jumlah_ulasan,
                       count(DISTINCT ul.usaha_id)                            AS jumlah_umkm_pengulas,
                       round(avg(ul.aspek_ketepatan_waktu)::numeric, 2)::float AS aspek_ketepatan,
                       round(avg(ul.aspek_jumlah_sesuai)::numeric, 2)::float   AS aspek_jumlah,
                       round(avg(ul.aspek_kondisi_barang)::numeric, 2)::float  AS aspek_kondisi,
                       (SELECT count(*) FROM pesanan p
                         WHERE p.distributor_id = d.id
                           AND p.status IN ('selesai', 'selesai-catatan'))    AS jumlah_pesanan_selesai
                  FROM distributor d
                  LEFT JOIN ulasan ul ON ul.distributor_id = d.id
                 GROUP BY d.id
                 ORDER BY d.id
                """
            )
        ).all()
        penawaran = sesi.exec(
            text(
                """
                SELECT pn.id, pn.distributor_id, pn.nama, pn.kategori, pn.satuan, pn.harga_satuan,
                       pn.kemasan_nama, pn.kemasan_isi, pn.satuan_isi, pn.stok_tersedia,
                       pn.stok_diperbarui_pada, pn.keterangan, pn.aktif,
                       (SELECT b.id FROM barang b
                         WHERE b.usaha_id = :u AND b.produk_master_id = pn.produk_master_id
                         ORDER BY b.id LIMIT 1) AS barang_id_terkait
                  FROM penawaran pn
                 ORDER BY pn.distributor_id, pn.nama
                """
            ).bindparams(u=usaha_id)
        ).all()
        return Katalog(
            usaha=UsahaRingkas(id=u.id, nama=u.nama, jenis_usaha=_nilai(u.jenis_usaha), kota=u.kota, alamat=u.alamat),
            distributor=[DistributorKatalog(**dict(r._mapping)) for r in distributor],
            penawaran=[PenawaranKatalog(**dict(r._mapping)) for r in penawaran],
        )


@rute.get("/distributor/{distributor_id}/ulasan", response_model=list[UlasanPublik])
def ulasan_distributor(
    distributor_id: int = Path(ge=1),
    usaha_id: int = Depends(usaha_saya),
    batas: int = Query(60, ge=1, le=300),
) -> list[UlasanPublik]:
    """
    Ulasan terbaru untuk satu distributor.

    Label sistem (berapa pesanan penulis ke distributor ini, sejak kapan ia
    berlangganan) dihitung dari tabel pesanan, supaya pembaca bisa menimbang
    ulasan dari pelanggan lama berbeda dengan ulasan dari pembeli sekali.
    """
    with Session(mesin()) as sesi:
        baris = sesi.exec(
            text(
                """
                SELECT ul.id, ul.distributor_id, u.nama AS nama_usaha, u.kota AS kota_usaha,
                       ul.rating, ul.isi, ul.waktu, p.nomor AS nomor_pesanan,
                       ul.aspek_ketepatan_waktu, ul.aspek_jumlah_sesuai, ul.aspek_kondisi_barang,
                       h.jumlah AS jumlah_pesanan_penulis, h.sejak AS pelanggan_sejak
                  FROM ulasan ul
                  JOIN usaha u ON u.id = ul.usaha_id
                  JOIN pesanan p ON p.id = ul.pesanan_id
                  LEFT JOIN LATERAL (
                      SELECT count(*) AS jumlah, min(q.dibuat_pada)::date AS sejak
                        FROM pesanan q
                       WHERE q.usaha_id = ul.usaha_id AND q.distributor_id = ul.distributor_id
                  ) h ON TRUE
                 WHERE ul.distributor_id = :d
                 ORDER BY ul.waktu DESC
                 LIMIT :n
                """
            ).bindparams(d=distributor_id, n=batas)
        ).all()
        return [UlasanPublik(**dict(r._mapping)) for r in baris]
